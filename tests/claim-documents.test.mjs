import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const source=fs.readFileSync(new URL('../google-apps-script/claim-documents/Code.gs',import.meta.url),'utf8');
const iterator=items=>({hasNext:()=>items.length>0,next:()=>items.shift()});
function service({uid='allowed',claim={bienSo:'TEST'},networkError=false,belongs=false,uploadedBy='allowed',profileRole='user',withCache=false,mime='image/jpeg'}={}) {
  let driveCalls=0,created=0,trashed=false,locks=0,authCalls=0,searches=0;const store=new Map();
  const props={FIREBASE_API_KEY:'test',FIREBASE_DATABASE_URL:'https://test.firebaseio.com',ALLOWED_UIDS:'allowed',ROOT_FOLDER_ID:'root'};
  const saved={getId:()=> 'saved',getName:()=> 'test.pdf',getSize:()=>1,getMimeType:()=> 'application/pdf',getDateCreated:()=> new Date(0),getDescription:()=>JSON.stringify({uploadedBy:'allowed',requestId:'same-request-123456'}),isTrashed:()=>false};
  const group={getId:()=> 'correct-group',isTrashed:()=>false,getFiles:()=>iterator([saved]),getFilesByName:()=>iterator([saved]),createFile:()=>{created++;throw Error('Unexpected duplicate');}};
  const claimFolder={getId:()=> 'claim-folder',isTrashed:()=>false,setDescription:()=>{},getFoldersByName:()=>iterator([group])};
  const root={getSharingAccess:()=> 'private',searchFolders:()=>{searches++;return iterator([claimFolder]);}};
  const folders={root,'claim-folder':claimFolder,'correct-group':group};
  const context=vm.createContext({
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>props[key]})},
    ...(withCache?{CacheService:{getScriptCache:()=>({get:key=>store.get(key)??null,put:(key,value)=>store.set(key,value),remove:key=>store.delete(key)})}}:{}),
    UrlFetchApp:{fetch:url=>{if(networkError)throw Error('secret-token-in-url');authCalls++;return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(url.includes('accounts:lookup')?{users:[{localId:uid}]}:url.includes('/profile.json')?{role:profileRole}:claim)};}},
    DriveApp:{Access:{PRIVATE:'private'},getFolderById:id=>{driveCalls++;return folders[id];},getFileById:fileId=>({getParents:()=>iterator([{getId:()=> belongs&&!String(fileId).startsWith('foreign')?'correct-group':'foreign-group'}]),isTrashed:()=>false,getSize:()=>1,getDescription:()=>JSON.stringify({uploadedBy}),setTrashed:value=>{trashed=value;},getMimeType:()=> mime,getThumbnail:()=>({getContentType:()=> 'image/jpeg',getBytes:()=>[1,2]}),getBlob:()=>{throw Error('Must not read original bytes for a thumbnail');}})},
    LockService:{getScriptLock:()=>({tryLock:()=>{locks++;return true;},releaseLock:()=>{}})},
    Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,value)=>[...crypto.createHash('sha256').update(value).digest()],base64Decode:value=>[...Buffer.from(value,'base64')],base64Encode:value=>Buffer.from(value).toString('base64')},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:body=>({setMimeType:()=>body})}
  });
  vm.runInContext(source,context);
  return {call:request=>JSON.parse(context.doPost({postData:{contents:JSON.stringify({token:'test',claimId:'claim-one',...request})}})),driveCalls:()=>driveCalls,created:()=>created,trashed:()=>trashed,locks:()=>locks,authCalls:()=>authCalls,searches:()=>searches,store};
}
test('unknown user cannot reach Drive',()=>{const s=service({uid:'other'});assert.equal(s.call({action:'list'}).ok,false);assert.equal(s.driveCalls(),0);});
test('missing claim is denied before Drive access',()=>{const s=service({claim:null});assert.equal(s.call({action:'list'}).ok,false);assert.equal(s.driveCalls(),0);});
test('claim path injection is denied',()=>{const s=service();assert.equal(s.call({action:'list',claimId:'../other'}).ok,false);assert.equal(s.driveCalls(),0);});
test('download cannot read a file from a different claim folder',()=>{const s=service();const result=s.call({action:'download',fileId:'foreign'});assert.equal(result.ok,false);assert.match(result.error,/Không có quyền/);});
test('retry with the same request ID returns saved file without creating a duplicate',()=>{const s=service();const result=s.call({action:'upload',source:'upload',name:'test.pdf',data:'YQ==',requestId:'same-request-123456'});assert.equal(result.ok,true);assert.equal(result.file.id,'saved');assert.equal(s.created(),0);});
test('authentication network errors do not expose token-bearing URLs',()=>{const s=service({networkError:true});const result=s.call({action:'list'});assert.equal(result.ok,false);assert.doesNotMatch(result.error,/secret-token/);});
test('delete cannot reach a file outside the current claim',()=>{const s=service();assert.equal(s.call({action:'remove',fileId:'foreign'}).ok,false);assert.equal(s.trashed(),false);});
test('uploader can move their file to recoverable Drive trash',()=>{const s=service({belongs:true});assert.equal(s.call({action:'remove',fileId:'mine'}).ok,true);assert.equal(s.trashed(),true);});
test('ordinary users cannot delete files uploaded by someone else',()=>{const s=service({belongs:true,uploadedBy:'other'});assert.equal(s.call({action:'remove',fileId:'other-file'}).ok,false);assert.equal(s.trashed(),false);});
test('administrator can remove a file from this claim',()=>{const s=service({belongs:true,uploadedBy:'other',profileRole:'admin'});assert.equal(s.call({action:'remove',fileId:'other-file'}).ok,true);assert.equal(s.trashed(),true);});
test('thumbnail reads use the small image and do not take the global upload lock',()=>{const s=service({belongs:true});const result=s.call({action:'thumbnail',fileId:'image'});assert.equal(result.ok,true);assert.equal(result.data,'AQI=');assert.equal(s.locks(),0);});
test('listing does not hold the upload lock',()=>{const s=service();assert.equal(s.call({action:'list'}).ok,true);assert.equal(s.locks(),0);});
test('batch thumbnails return only images that belong to this claim, in one request and without the lock',()=>{
  const s=service({belongs:true});const result=s.call({action:'thumbnails',fileIds:['image-a','foreign-b','image-c']});
  assert.equal(result.ok,true);assert.deepEqual(result.items.map(item=>[item.id,item.ok]),[['image-a',true],['foreign-b',false],['image-c',true]]);
  assert.equal(result.items[0].data,'AQI=');assert.equal(s.locks(),0);
});
test('batch thumbnails reject malformed IDs and cap the batch size',()=>{
  const s=service({belongs:true});assert.equal(s.call({action:'thumbnails',fileIds:['../x']}).ok,false);
  assert.equal(s.call({action:'thumbnails',fileIds:[]}).ok,false);
  assert.equal(s.call({action:'thumbnails',fileIds:Array.from({length:30},(_,i)=>'img'+i)}).items.length,12);
});
test('batch thumbnails skip non-image files',()=>{const s=service({belongs:true,mime:'application/pdf'});assert.equal(s.call({action:'thumbnails',fileIds:['doc']}).items[0].ok,false);});
test('repeat requests reuse cached authorization and folder lookup',()=>{
  const s=service({withCache:true});assert.equal(s.call({action:'list'}).ok,true);
  const auth=s.authCalls(),search=s.searches();assert.equal(auth,2);assert.equal(search,1);
  assert.equal(s.call({action:'list'}).ok,true);assert.equal(s.authCalls(),auth);assert.equal(s.searches(),search);
  assert(![...s.store.values()].some(value=>String(value).includes('"token"')),'token must never be cached');
});
test('cached authorization is bound to the claim it was checked for',()=>{
  const s=service({withCache:true});s.call({action:'list'});const auth=s.authCalls();
  s.call({action:'list',claimId:'claim-two'});assert.equal(s.authCalls(),auth+2);
});
test('a stale cached folder ID falls back to searching Drive',()=>{
  const s=service({withCache:true});s.call({action:'list'});s.store.set([...s.store.keys()].find(key=>key.startsWith('folder:')),'missing-folder');
  assert.equal(s.call({action:'list'}).ok,true);assert.equal(s.searches(),2);
});

function client() {
  const requests=[];
  const context=vm.createContext({
    CONFIG:{CLAIM_DOCUMENTS_ENDPOINT:'https://script.google.com/macros/s/test/exec'},editingPendingClaimId:'claim-one',
    firebase:{auth:()=>({currentUser:{uid:context.uid,getIdToken:async()=> 'token'}})},
    uid:'first-user',crypto,AbortSignal,triggerToast:()=>{},
    FileReader:class {readAsDataURL(){this.result='data:application/octet-stream;base64,YQ==';this.onload();}},
    fetch:async(_,options)=>{requests.push(JSON.parse(options.body));return {ok:true,json:async()=>({ok:true,file:{id:'saved-word',name:'test.docx'}})};}
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
