import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const storage=fs.readFileSync(new URL('../js/features/documents/storage.js',import.meta.url),'utf8');
const editor=fs.readFileSync(new URL('../js/features/claims/pending-editor.js',import.meta.url),'utf8');
const guide={version:1,meta:{assessor:'GĐV mẫu'},items:{paper:{selected:true,status:'missing',date:''}},extras:[]};
const claim={id:'claim_a',bienSo:'DEMO-001',maVuTonThat:'VTT-DEMO-001',khachHang:'Khách hàng mẫu',createdByUid:'owner',huongDanThuThapHoSo:guide,soDoHienTruong:'data:image/png;base64,fixture',soDoHienTruongData:JSON.stringify([{id:1,type:'car'}]),soDoHienTruongMeta:JSON.stringify({location:'Vị trí mẫu'})};

function setup(seed={},failure='') {
  const data=structuredClone(seed),writes=[],toasts=[],fields={};let fail=failure;
  const read=path=>path.split('/').filter(Boolean).reduce((value,key)=>value?.[key],data);
  const write=(path,value)=>{
    if(fail && path.startsWith(fail))throw new Error('PERMISSION_DENIED');
    writes.push(path);const parts=path.split('/').filter(Boolean);let target=data;
    for(const key of parts.slice(0,-1))target=target[key]??={};
    if(value===null)delete target[parts.at(-1)];else target[parts.at(-1)]=structuredClone(value);
  };
  const snapshot=value=>({val:()=>structuredClone(value??null),exists:()=>value!==undefined&&value!==null});
  const ref=path=>({
    once:async()=>{if(fail&&path.startsWith(fail))throw new Error('PERMISSION_DENIED');return snapshot(read(path));},
    set:async value=>write(path,value),remove:async()=>write(path,null),
    child:suffix=>ref(path+'/'+suffix),
    update:async values=>{for(const [key,value] of Object.entries(values))write([path,key].filter(Boolean).join('/'),value);},
    transaction:async callback=>{const next=callback(structuredClone(read(path)??null));if(next!==undefined)write(path,next);return {committed:next!==undefined,snapshot:snapshot(next)};}
  });
  const context=vm.createContext({
    console,structuredClone,Date,JSON,Map,Set,Promise,
    document:{getElementById:id=>fields[id]||null,querySelector:()=>null},
    firebase:{auth:()=>({currentUser:{uid:'owner',email:'owner@example.test'}})},
    activeUserProfile:{role:'Admin',displayName:'GĐV mẫu'},editingPendingClaimId:'claim_a',sceneDiagramLoadSequence:0,
    activeDashboardTab:'pending',cachedPendingClaimsPayload:structuredClone(seed.pending_claims||{}),
    dbNodeInstance:{ref:path=>ref(path||'')},hasUserPermission:()=>true,
    filterPendingClaimsByUserPrivileges:(values,user)=>Object.fromEntries(Object.entries(values).filter(([,value])=>value.createdByUid===user.uid)),
    hasEmbeddedSceneDiagramData:item=>!!(item?.soDoHienTruong||item?.soDoHienTruongData||item?.soDoHienTruongMeta),
    parseStoredSceneDiagramShapes:value=>typeof value==='string'?JSON.parse(value):value||[],
    parseStoredSceneTemplateMeta:value=>typeof value==='string'?JSON.parse(value):value||{},
    collectionDocumentDraftIdentity:snapshot=>({source:JSON.stringify(snapshot)}),
    collectionDocumentReadEdits:()=>({'3':'<span>Nội dung chỉnh sửa đã lưu</span>'}),
    collectionDocumentWriteEdits:(snapshot,edits)=>{context.restoredEdits=structuredClone(edits);},
    initializeCollectionGuide:item=>{context.currentGuide=structuredClone(item.huongDanThuThapHoSo);},
    getCollectionGuideState:()=>structuredClone(context.currentGuide||guide),
    collectionGuidePrepareContact:async()=>{},clearCollectionGuideDraft:()=>{},
    triggerToast:(message,type)=>toasts.push({message,type}),loadClaimDocumentLibrary:async()=>{},
    window:{},formatCleanDateField:value=>value,formatCurrencyInputNumber:value=>value,
    findExistingClaimByMaVTT:()=>null,executeUIRenderPendingClaims:()=>{},renderGdvReportPage:()=>{},
    sceneDiagramDataUrl:'',getSceneDiagramClaimReference:()=>({})
  });
  vm.runInContext(storage,context);
  return {context,data,writes,toasts,fields,ref,setFailure:value=>{fail=value;},run:source=>vm.runInContext(source,context)};
}

test('Deleting one legacy claim retains its editable scene, guide, reference and document edits',async()=>{
  const fixture=setup({pending_claims:{claim_a:claim}});
  await fixture.context.deletePendingClaimKeepingDocuments('claim_a');
  assert.equal(fixture.data.pending_claims.claim_a,undefined);
  assert.deepEqual(fixture.data.collection_guides.claim_a.state,guide);
  assert.equal(fixture.data.collection_guides.claim_a.documentEdits['3'],'<span>Nội dung chỉnh sửa đã lưu</span>');
  assert.equal(fixture.data.collection_guides.claim_a.claimReference.bienSo,'DEMO-001');
  assert.equal(fixture.data.scene_diagrams.claim_a.shapes,claim.soDoHienTruongData);
  assert.equal(fixture.data.scene_diagrams.claim_a.claimReference.createdByUid,'owner');
  const deletion=fixture.writes.indexOf('pending_claims/claim_a');
  assert(deletion>fixture.writes.indexOf('collection_guides/claim_a'));
  assert(deletion>fixture.writes.indexOf('scene_diagrams/claim_a'));
});

test('An archive permission failure blocks deletion and leaves the claim intact',async()=>{
  const fixture=setup({pending_claims:{claim_a:claim}},'collection_guides');
  await assert.rejects(fixture.context.deletePendingClaimKeepingDocuments('claim_a'),/PERMISSION_DENIED/);
  assert.deepEqual(fixture.data.pending_claims.claim_a,claim);
  assert(!fixture.writes.includes('pending_claims/claim_a'));
});

test('Existing independent guide and scene data win over an older embedded copy',async()=>{
  const newerGuide={id:'claim_a',state:{...guide,meta:{assessor:'Người cập nhật mới'}},updatedAt:99};
  const newerScene={id:'claim_a',shapes:'[{"id":"newer"}]',imageDataUrl:'newer',updatedAt:99};
  const fixture=setup({pending_claims:{claim_a:claim},collection_guides:{claim_a:newerGuide},scene_diagrams:{claim_a:newerScene}});
  await fixture.context.deletePendingClaimKeepingDocuments('claim_a');
  assert.deepEqual(fixture.data.collection_guides.claim_a,newerGuide);
  assert.equal(fixture.data.scene_diagrams.claim_a.shapes,newerScene.shapes);
  assert.equal(fixture.data.scene_diagrams.claim_a.imageDataUrl,'newer');
});

test('Bulk delete archives the server snapshot, including claims absent from the filtered client cache',async()=>{
  const fixture=setup({pending_claims:{claim_a:claim,claim_b:{...claim,id:'claim_b',bienSo:'DEMO-002'}}});
  fixture.context.cachedPendingClaimsPayload={claim_a:claim};
  await fixture.context.deleteAllPendingClaimsKeepingDocuments();
  assert.equal(fixture.data.pending_claims,undefined);
  assert.equal(Object.keys(fixture.data.collection_guides).length,2);
  assert.equal(fixture.data.scene_diagrams.claim_b.claimReference.bienSo,'DEMO-002');
});

test('A bulk archival failure prevents deleting the pending_claims branch',async()=>{
  const fixture=setup({pending_claims:{claim_a:claim,claim_b:{...claim,id:'claim_b'}}},'scene_diagrams/claim_b');
  await assert.rejects(fixture.context.deleteAllPendingClaimsKeepingDocuments(),/PERMISSION_DENIED/);
  assert.equal(Object.keys(fixture.data.pending_claims).length,2);
});

test('Archived-only save updates the guide without recreating the deleted claim',async()=>{
  const fixture=setup({collection_guides:{claim_a:{state:guide}}});
  fixture.context.currentGuide=guide;
  vm.runInContext(editor,fixture.context);
  fixture.run("claimDocumentStore.ready=true;claimDocumentStore.context={id:'claim_a',documentOnly:true,reference:{bienSo:'DEMO-001',createdByUid:'owner'}};");
  await fixture.context.saveAddPendingClaimFromModal();
  assert.equal(fixture.data.pending_claims,undefined);
  assert.deepEqual(fixture.data.collection_guides.claim_a.state,guide);
  assert(fixture.writes.every(path=>path.startsWith('collection_guides/')));
});

test('Normal claim save writes guide and claim together, with no embedded guide field',async()=>{
  const fixture=setup({pending_claims:{claim_a:claim}});
  fixture.context.currentGuide=guide;
  fixture.fields.modalPendingBienSo={value:'DEMO-001'};
  fixture.fields.modalPendingMaVuTonThat={value:'VTT-DEMO-001'};
  vm.runInContext(editor,fixture.context);
  fixture.run('claimDocumentStore.ready=true;');
  await fixture.context.saveAddPendingClaimFromModal();
  assert.equal(fixture.data.pending_claims.claim_a.huongDanThuThapHoSo,undefined);
  assert.equal(fixture.data.pending_claims.claim_a.bienSo,'DEMO-001');
  assert.deepEqual(fixture.data.collection_guides.claim_a.state,guide);
});

test('Independent guide is loaded before the embedded fallback and restores its document edits',async()=>{
  const fixture=setup();const reference=fixture.context.claimDocumentReference('claim_a',claim);
  const state={...guide,meta:{assessor:'GĐV cập nhật'}};
  const record=fixture.context.buildCollectionGuideStorageRecord('claim_a',reference,state);
  fixture.data.collection_guides={claim_a:structuredClone(record)};
  await fixture.context.loadCollectionGuideForClaim(claim,'claim_a');
  assert.deepEqual(fixture.context.currentGuide,state);
  assert.equal(fixture.context.restoredEdits['3'],'<span>Nội dung chỉnh sửa đã lưu</span>');
  assert.equal(fixture.run('claimDocumentStore.ready'),true);
});

test('Saving a previously open claim after it was deleted only retains documents',async()=>{
  const fixture=setup();
  fixture.context.cachedPendingClaimsPayload={claim_a:claim};fixture.context.currentGuide=guide;
  fixture.fields.modalPendingBienSo={value:'DEMO-001'};fixture.fields.modalPendingMaVuTonThat={value:'VTT-DEMO-001'};
  vm.runInContext(editor,fixture.context);fixture.run('claimDocumentStore.ready=true;');
  await fixture.context.saveAddPendingClaimFromModal();
  assert.equal(fixture.data.pending_claims,undefined);
  assert.deepEqual(fixture.data.collection_guides.claim_a.state,guide);
});

test('An archive read denial keeps normal claim editing available and retains an embedded fallback',async()=>{
  const fixture=setup({pending_claims:{claim_a:claim}},'collection_guides');
  fixture.context.currentGuide=guide;
  fixture.fields.modalPendingBienSo={value:'DEMO-001'};fixture.fields.modalPendingMaVuTonThat={value:'VTT-DEMO-001'};
  vm.runInContext(editor,fixture.context);
  fixture.run("claimDocumentStore.guideError=new Error('PERMISSION_DENIED');");
  await fixture.context.saveAddPendingClaimFromModal();
  assert.deepEqual(fixture.data.pending_claims.claim_a.huongDanThuThapHoSo,guide);
  assert.equal(fixture.data.collection_guides,undefined);
  assert(fixture.toasts.some(toast=>toast.type==='warning'&&toast.message.includes('Chưa lưu được vào kho riêng')));
});

test('A late guide response cannot overwrite another open claim',async()=>{
  const fixture=setup();let resolve;
  const delayed=new Promise(done=>{resolve=done;});
  fixture.context.dbNodeInstance.ref=()=>({once:()=>delayed});
  const request=fixture.context.loadCollectionGuideForClaim(claim,'claim_a');
  fixture.context.editingPendingClaimId='claim_b';fixture.run('resetClaimDocumentContext()');
  fixture.context.currentGuide={version:1,meta:{assessor:'Hồ sơ mới'}};
  resolve({val:()=>({state:guide})});await request;
  assert.equal(fixture.context.currentGuide.meta.assessor,'Hồ sơ mới');
});

test('Archive visibility retains the original owner and assignment restrictions',()=>{
  const fixture=setup();fixture.context.activeUserProfile={role:'Giám định viên',displayName:'GĐV mẫu'};
  assert.equal(fixture.context.claimDocumentCanView({claimReference:{createdByUid:'owner'}}),true);
  assert.equal(fixture.context.claimDocumentCanView({claimReference:{createdByUid:'other'}}),false);
  assert.equal(fixture.context.claimDocumentCanView({claimReference:{canBoXuLy:'GĐV mẫu',createdByUid:'other'}}),true);
});

test('Invalid Firebase keys cannot escape the document storage branch',()=>{
  const fixture=setup();
  for(const id of ['','a/b','a.b','a#b','a$b','a[b','a]b','a\u0000b'])assert.throws(()=>fixture.context.claimDocumentId(id));
});
