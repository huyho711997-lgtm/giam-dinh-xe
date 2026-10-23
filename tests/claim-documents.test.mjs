import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const source=fs.readFileSync(new URL('../google-apps-script/claim-documents/Code.gs',import.meta.url),'utf8');
const iterator=items=>({hasNext:()=>items.length>0,next:()=>items.shift()});
function service({uid='allowed',claim={bienSo:'TEST'},networkError=false}={}) {
  let driveCalls=0,created=0;
  const props={FIREBASE_API_KEY:'test',FIREBASE_DATABASE_URL:'https://test.firebaseio.com',ALLOWED_UIDS:'allowed',ROOT_FOLDER_ID:'root'};
  const saved={getId:()=> 'saved',getName:()=> 'test.pdf',getSize:()=>1,getMimeType:()=> 'application/pdf',getDateCreated:()=> new Date(0),getDescription:()=>JSON.stringify({uploadedBy:'allowed',requestId:'same-request-123456'}),isTrashed:()=>false};
  const group={getId:()=> 'correct-group',getFiles:()=>iterator([saved]),createFile:()=>{created++;throw Error('Unexpected duplicate');}};
  const claimFolder={setDescription:()=>{},getFoldersByName:()=>iterator([group])};
  const context=vm.createContext({
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>props[key]})},
    UrlFetchApp:{fetch:url=>{if(networkError)throw Error('secret-token-in-url');return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(url.includes('accounts:lookup')?{users:[{localId:uid}]}:claim)};}},
    DriveApp:{Access:{PRIVATE:'private'},getFolderById:()=>{driveCalls++;return {getSharingAccess:()=> 'private',searchFolders:()=>iterator([claimFolder])};},getFileById:()=>({getParents:()=>iterator([{getId:()=> 'foreign-group'}]),getBlob:()=>{throw Error('Must not read foreign bytes');}})},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
    Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,value)=>[...crypto.createHash('sha256').update(value).digest()],base64Decode:value=>[...Buffer.from(value,'base64')]},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:body=>({setMimeType:()=>body})}
  });
  vm.runInContext(source,context);
  return {call:request=>JSON.parse(context.doPost({postData:{contents:JSON.stringify({token:'test',claimId:'claim-one',...request})}})),driveCalls:()=>driveCalls,created:()=>created};
}
test('unknown user cannot reach Drive',()=>{const s=service({uid:'other'});assert.equal(s.call({action:'list'}).ok,false);assert.equal(s.driveCalls(),0);});
test('missing claim is denied before Drive access',()=>{const s=service({claim:null});assert.equal(s.call({action:'list'}).ok,false);assert.equal(s.driveCalls(),0);});
test('claim path injection is denied',()=>{const s=service();assert.equal(s.call({action:'list',claimId:'../other'}).ok,false);assert.equal(s.driveCalls(),0);});
test('download cannot read a file from a different claim folder',()=>{const s=service();const result=s.call({action:'download',fileId:'foreign'});assert.equal(result.ok,false);assert.match(result.error,/Không có quyền/);});
test('retry with the same request ID returns saved file without creating a duplicate',()=>{const s=service();const result=s.call({action:'upload',source:'upload',name:'test.pdf',data:'YQ==',requestId:'same-request-123456'});assert.equal(result.ok,true);assert.equal(result.file.id,'saved');assert.equal(s.created(),0);});
test('authentication network errors do not expose token-bearing URLs',()=>{const s=service({networkError:true});const result=s.call({action:'list'});assert.equal(result.ok,false);assert.doesNotMatch(result.error,/secret-token/);});

function client() {
  const requests=[];
  const context=vm.createContext({
    CONFIG:{CLAIM_DOCUMENTS_ENDPOINT:'https://script.google.com/macros/s/test/exec'},editingPendingClaimId:'claim-one',
    firebase:{auth:()=>({currentUser:{uid:context.uid,getIdToken:async()=> 'token'}})},
    uid:'first-user',crypto,AbortSignal,triggerToast:()=>{},
    FileReader:class {readAsDataURL(){this.result='data:application/octet-stream;base64,YQ==';this.onload();}},
    fetch:async(_,options)=>{requests.push(JSON.parse(options.body));return {ok:true,json:async()=>({ok:true})};}
  });
  vm.runInContext(fs.readFileSync(new URL('../js/features/documents/claim-documents.js',import.meta.url),'utf8')+'\nthis.documents=ClaimDocuments;',context);
  return {context,requests};
}
test('Word keeps the original claim even if another claim is opened while generating it',async()=>{
  const {context,requests}=client(), captured=context.documents.capture();
  context.editingPendingClaimId='claim-two';
  await context.documents.saveWord({size:1},'test.docx',captured);
  assert.equal(requests.length,1);assert.equal(requests[0].claimId,'claim-one');
});
test('Word upload stops if the signed-in account changes during generation',async()=>{
  const {context,requests}=client(), captured=context.documents.capture();context.uid='second-user';
  await context.documents.saveWord({size:1},'test.docx',captured);assert.equal(requests.length,0);
});
