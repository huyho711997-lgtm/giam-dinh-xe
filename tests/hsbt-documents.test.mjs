import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const scripts=['js/features/documents/hsbt.js','js/features/documents/storage.js','js/features/documents/autosave.js','js/features/scene/interaction-export.js','js/features/claims/pending-editor.js'].map(read);
const guide={version:1,meta:{assessor:'GĐV mẫu'},items:{paper:{selected:true,status:'missing',date:''}},extras:[]};
const claim={id:'old_id',bienSo:'DEMO-001',maVuTonThat:'VTT-DEMO',soHoSoBoiThuong:'HSBT/XCG/2026/0096788',khachHang:'Khách hàng mẫu',createdByUid:'owner',huongDanThuThapHoSo:guide,soDoHienTruong:'data:image/png;base64,fixture',soDoHienTruongData:'[{"id":1,"type":"car"}]',soDoHienTruongMeta:'{"location":"Vị trí mẫu"}'};

function setup(seed={},failure='') {
  const data=structuredClone(seed),writes=[],toasts=[],timers=new Map(),fields={modalPendingSoHoSoBoiThuong:{value:claim.soHoSoBoiThuong},modalPendingBienSo:{value:claim.bienSo},modalPendingMaVuTonThat:{value:claim.maVuTonThat}};let fail=failure,timerId=0,beforeSet=async()=>{};
  const get=path=>path.split('/').filter(Boolean).reduce((value,key)=>value?.[key],data);
  const set=(path,value)=>{
    if(fail&&path.startsWith(fail))throw new Error('PERMISSION_DENIED');
    writes.push(path);const parts=path.split('/').filter(Boolean);let target=data;
    for(const key of parts.slice(0,-1))target=target[key]??={};
    if(value===null)delete target[parts.at(-1)];else target[parts.at(-1)]=structuredClone(value);
  };
  const snapshot=value=>({val:()=>structuredClone(value??null),exists:()=>value!=null});
  const ref=path=>({
    once:async()=>{if(fail&&path.startsWith(fail))throw new Error('PERMISSION_DENIED');return snapshot(get(path));},
    set:async value=>{await beforeSet(path,value);set(path,value);},remove:async()=>set(path,null),child:key=>ref(path+'/'+key),
    update:async values=>{for(const [key,value] of Object.entries(values))set([path,key].filter(Boolean).join('/'),value);},
    transaction:async callback=>{const value=callback(structuredClone(get(path)??null));if(value!==undefined)set(path,value);return {committed:value!==undefined,snapshot:snapshot(value)};}
  });
  const context=vm.createContext({console,structuredClone,TextEncoder,Date,JSON,Map,Set,Promise,queueMicrotask,
    setTimeout:callback=>{const id=++timerId;timers.set(id,callback);return id;},clearTimeout:id=>timers.delete(id),
    document:{getElementById:id=>fields[id]||null,querySelector:()=>null,addEventListener:()=>{}},window:{addEventListener:()=>{}},
    firebase:{auth:()=>({currentUser:{uid:'owner',email:'owner@example.test'}})},
    activeUserProfile:{role:'Admin',displayName:'GĐV mẫu'},editingPendingClaimId:'old_id',sceneDiagramLoadSequence:0,activeDashboardTab:'pending',cachedPendingClaimsPayload:structuredClone(seed.pending_claims||{}),
    dbNodeInstance:{ref:path=>ref(path||'')},hasUserPermission:()=>true,
    // pending-editor.js phụ thuộc module thông báo giảm trừ (nạp trước nó trong index.html); test chỉ cần stub trạng thái.
    ClaimReductionNotice:{load:()=>{},getState:()=>({}),mount:()=>{},close:()=>{},show:()=>{}},
    collectionDocumentDraftIdentity:snapshot=>({source:JSON.stringify(snapshot)}),collectionDocumentReadEdits:()=>structuredClone(context.currentEdits),
    collectionDocumentWriteEdits:(snapshot,edits)=>{context.currentEdits=structuredClone(edits);},
    initializeCollectionGuide:item=>{context.collectionGuideDraft=structuredClone(item.huongDanThuThapHoSo||{version:1,meta:{},items:{},extras:[]});},
    getCollectionGuideState:()=>structuredClone(context.collectionGuideDraft),collectionGuidePrepareContact:async()=>{},clearCollectionGuideDraft:()=>{context.collectionGuideDraft=null;},
    currentEdits:{'3':'<span>Nội dung A4 đã chỉnh</span>'},collectionGuideDraft:structuredClone(guide),
    triggerToast:(message,type)=>toasts.push({message,type}),formatCleanDateField:value=>value,formatCurrencyInputNumber:value=>value,findExistingClaimByMaVTT:()=>null,executeUIRenderPendingClaims:()=>{},renderGdvReportPage:()=>{},
    sceneCanvas:null,sceneCtx:null,sceneShapes:[],sceneDiagramDataUrl:'',sceneDiagramShapesSnapshot:[],sceneDiagramTemplateMetaSnapshot:{},sceneTemplateMeta:{},sceneDiagramCreatedAt:null,sceneDiagramUpdatedAt:null,drawingHistory:[],historyIndex:-1,selectedShapeId:null,selectedShapeIds:[]
  });
  for(const source of scripts)vm.runInContext(source,context);
  // Only canvas/DOM rendering is stubbed. Storage, loading, autosave and claim deletion use production code.
  context.createSceneDrawingExportDataUrl=()=> 'data:image/png;base64,exported';
  context.cloneSceneTemplateMeta=value=>structuredClone(value||{});context.ensureSceneTemplateMeta=()=>structuredClone(context.sceneTemplateMeta);
  context.updateSceneDiagramPreview=()=>{};
  context.applySceneDiagramStoredData=record=>{
    context.sceneDiagramDataUrl=record?.imageDataUrl||'';
    context.sceneShapes=record?.shapes?JSON.parse(record.shapes):[];
    context.sceneDiagramShapesSnapshot=structuredClone(context.sceneShapes);
    context.sceneTemplateMeta=record?.templateMeta?JSON.parse(record.templateMeta):{};
  };
  const run=source=>vm.runInContext(source,context);
  const key=(item=claim,id=item.id)=>context.claimDocumentStorageKey(id,item);
  const bind=(item=claim,id=item.id)=>{context.editingPendingClaimId=id;fields.modalPendingSoHoSoBoiThuong.value=item.soHoSoBoiThuong||'';context.bindCurrentClaimDocuments(id,item);run('claimDocumentStore.ready=true;');};
  const settle=async()=>{await Promise.all(run('[...claimDocumentWriteQueues.values()]'));};
  const tick=async()=>{const callbacks=[...timers.values()];timers.clear();for(const callback of callbacks)await callback();await settle();};
  return {context,data,writes,toasts,fields,timers,ref,run,key,bind,settle,tick,setFailure:value=>{fail=value;},setHook:callback=>{beforeSet=callback;}};
}

test('HSBT keys normalize whitespace/case and encode Firebase-forbidden punctuation without collisions',()=>{
  const f=setup();
  assert.equal(f.key(),f.key({...claim,soHoSoBoiThuong:' hsbt / xcg / 2026 / 0096788 '}));
  assert.notEqual(f.key(),f.key({...claim,soHoSoBoiThuong:'HSBT/XCG/2026/0096789'}));
  assert.notEqual(f.key({...claim,soHoSoBoiThuong:'A/B'}),f.key({...claim,soHoSoBoiThuong:'AB'}));
  assert.doesNotMatch(f.key({...claim,soHoSoBoiThuong:'HSBT/.#$[]/1'}),/[.#$\[\]/]/);
});

test('Delete and reimport under a different internal ID restores guide, A4 edits and scene by HSBT',async()=>{
  const f=setup({pending_claims:{old_id:claim}});
  await f.context.deletePendingClaimKeepingDocuments('old_id');
  assert.equal(f.data.pending_claims.old_id,undefined);
  assert.deepEqual(f.data.collection_guides[f.key()].state,guide);
  const reimported={...claim,id:'excel_new_id',huongDanThuThapHoSo:undefined,soDoHienTruong:undefined,soDoHienTruongData:undefined,soDoHienTruongMeta:undefined};
  f.data.pending_claims.excel_new_id=reimported;f.context.editingPendingClaimId='excel_new_id';
  await f.context.loadSceneDiagramForClaim(reimported,'excel_new_id');
  await f.context.loadCollectionGuideForClaim(reimported,'excel_new_id');
  assert.deepEqual(f.context.collectionGuideDraft,guide);
  assert.equal(f.context.currentEdits['3'],'<span>Nội dung A4 đã chỉnh</span>');
  assert.equal(f.context.sceneShapes[0].id,1);
  assert.equal(f.run('claimDocumentStore.binding.key'),f.key());
});

test('Legacy ID-keyed archives of an already deleted claim are found automatically by normalized HSBT',async()=>{
  const f=setup();
  const record=f.context.buildCollectionGuideStorageRecord('gone_id',claim,guide);
  delete record.hsbtNormalized;delete record.storageKey;
  f.data.collection_guides={gone_id:record};
  const imported={...claim,id:'new_id',soHoSoBoiThuong:' hsbt / xcg / 2026 / 0096788 '};
  f.bind(imported);await f.context.loadCollectionGuideForClaim(imported,'new_id');
  assert.deepEqual(f.context.collectionGuideDraft,guide);
  assert(f.data.collection_guides[f.key(imported)]);
});

test('Two HSBTs with the same plate never share documents',async()=>{
  const f=setup();f.data.collection_guides={[f.key()]:f.context.buildCollectionGuideStorageRecord('old_id',claim,guide)};
  const other={...claim,id:'other',soHoSoBoiThuong:'HSBT/OTHER',huongDanThuThapHoSo:undefined};
  f.bind(other);await f.context.loadCollectionGuideForClaim(other,'other');
  assert.deepEqual(f.context.collectionGuideDraft.items,{});
});

test('Claims without HSBT remain isolated by internal ID',()=>{
  const f=setup();
  assert.equal(f.key({...claim,id:'a',soHoSoBoiThuong:''}),'a');
  assert.equal(f.key({...claim,id:'b',soHoSoBoiThuong:'—'}),'b');
});

test('Guide edits save automatically after debounce without a save button',async()=>{
  const f=setup();f.bind();f.context.collectionGuideDraft.items.paper.status='have';
  f.context.scheduleCollectionGuideAutoSave();assert(f.timers.size);
  await f.tick();
  assert.equal(f.data.collection_guides[f.key()].state.items.paper.status,'have');
});

test('Closing the claim captures edits before the debounce timer and does not recreate a claim',async()=>{
  const f=setup();f.bind();f.context.collectionGuideDraft.items.paper.status='have';
  f.context.closeAddPendingClaimModal();await f.settle();
  assert.equal(f.data.collection_guides[f.key()].state.items.paper.status,'have');
  assert.equal(f.data.pending_claims,undefined);
});

test('Scene changes autosave editable vectors, template and image under the same HSBT key',async()=>{
  const f=setup();f.bind();f.context.sceneShapes=[{id:7,type:'car'}];f.context.sceneTemplateMeta={location:'Địa điểm mới'};
  f.context.scheduleSceneDocumentAutoSave();await f.tick();
  const record=f.data.scene_diagrams[f.key()];
  assert.equal(JSON.parse(record.shapes)[0].id,7);
  assert.equal(JSON.parse(record.templateMeta).location,'Địa điểm mới');
  assert.equal(record.imageDataUrl,'data:image/png;base64,exported');
});

test('Switching HSBT saves pending edits to the old number before loading the new number',async()=>{
  const f=setup();const other={...claim,soHoSoBoiThuong:'HSBT/SECOND'};
  f.data.collection_guides={[f.key(other)]:f.context.buildCollectionGuideStorageRecord('old_id',other,{...guide,meta:{assessor:'Số thứ hai'}})};
  f.bind();f.context.collectionGuideDraft.items.paper.status='have';f.context.scheduleCollectionGuideAutoSave();
  f.fields.modalPendingSoHoSoBoiThuong.value=other.soHoSoBoiThuong;
  await f.context.rebindClaimDocumentsByHsbt();
  assert.equal(f.data.collection_guides[f.key()].state.items.paper.status,'have');
  assert.equal(f.context.collectionGuideDraft.meta.assessor,'Số thứ hai');
  assert.equal(f.data.collection_guides[f.key()].claimReference.soHoSoBoiThuong,claim.soHoSoBoiThuong);
});

test('Assigning HSBT to a new draft retains previously selected papers',async()=>{
  const f=setup();f.context.editingPendingClaimId=null;f.run("claimDocumentStore.draftId='draft_id';");
  f.fields.modalPendingSoHoSoBoiThuong.value='';f.context.bindCurrentClaimDocuments('draft_id',{...claim,soHoSoBoiThuong:''});f.run('claimDocumentStore.ready=true;');
  f.context.collectionGuideDraft.items.paper.status='have';
  f.fields.modalPendingSoHoSoBoiThuong.value=claim.soHoSoBoiThuong;
  await f.context.rebindClaimDocumentsByHsbt();
  assert.equal(f.context.collectionGuideDraft.items.paper.status,'have');
  assert.equal(f.data.collection_guides[f.key()].state.items.paper.status,'have');
});

test('A failed autosave can retry and failed archival blocks deletion',async()=>{
  const f=setup({pending_claims:{old_id:claim}});f.bind();f.setFailure('collection_guides');
  f.context.collectionGuideDraft.items.paper.status='have';f.context.scheduleCollectionGuideAutoSave();
  await assert.rejects(f.context.flushClaimDocumentAutoSave(),/PERMISSION_DENIED/);
  await assert.rejects(f.context.deletePendingClaimKeepingDocuments('old_id'),/chưa bị xoá/);
  assert(f.data.pending_claims.old_id);
  f.setFailure('');await f.context.retryClaimDocumentAutoSave();
  assert.equal(f.data.collection_guides[f.key()].state.items.paper.status,'have');
});

test('Slow older autosaves cannot overwrite newer edits to the same HSBT',async()=>{
  const f=setup();f.bind();let release;const gate=new Promise(done=>{release=done;});const started=[];
  f.setHook(async(path,record)=>{started.push(record.version);if(record.version===1)await gate;});
  const first=f.context.enqueueClaimDocumentWrite('guide',{version:1,updatedAt:1});
  const second=f.context.enqueueClaimDocumentWrite('guide',{version:2,updatedAt:2});
  await Promise.resolve();await Promise.resolve();
  assert.deepEqual(started,[1]);release();await Promise.all([first,second]);
  assert.deepEqual(started,[1,2]);assert.equal(f.data.collection_guides[f.key()].version,2);
});

test('An old internal ID reused with another HSBT does not load the old number documents',async()=>{
  const f=setup();f.data.collection_guides={old_id:f.context.buildCollectionGuideStorageRecord('old_id',claim,guide)};
  const other={...claim,soHoSoBoiThuong:'HSBT/OTHER',huongDanThuThapHoSo:undefined};
  f.bind(other);await f.context.loadCollectionGuideForClaim(other,'old_id');
  assert.deepEqual(f.context.collectionGuideDraft.items,{});
});

test('Bulk deletion retains documents for the server snapshot, not just the filtered cache',async()=>{
  const second={...claim,id:'second',soHoSoBoiThuong:'HSBT/SECOND'};
  const f=setup({pending_claims:{old_id:claim,second}});f.context.cachedPendingClaimsPayload={old_id:claim};
  await f.context.deleteAllPendingClaimsKeepingDocuments();
  assert.equal(f.data.pending_claims,undefined);
  assert(f.data.collection_guides[f.key()]);assert(f.data.collection_guides[f.key(second)]);
  assert(f.data.scene_diagrams[f.key(second)]);
});

test('An existing canonical guide takes precedence over old embedded data',async()=>{
  const f=setup({pending_claims:{old_id:claim}});const newer={...guide,meta:{assessor:'Bản mới hơn'}};
  f.data.collection_guides={[f.key()]:f.context.buildCollectionGuideStorageRecord('old_id',claim,newer)};
  await f.context.deletePendingClaimKeepingDocuments('old_id');
  assert.equal(f.data.collection_guides[f.key()].state.meta.assessor,'Bản mới hơn');
});

test('An explicitly deleted scene tombstone prevents restoring an older ID-keyed diagram',async()=>{
  const f=setup();f.data.scene_diagrams={old_id:{claimReference:claim,shapes:claim.soDoHienTruongData},[f.key()]:{deleted:true,hsbtNormalized:claim.soHoSoBoiThuong}};
  await f.context.loadSceneDiagramForClaim(claim,'old_id');
  assert.deepEqual(f.context.sceneShapes,[]);
});

test('Normal claim save uses HSBT paths and stores no embedded guide',async()=>{
  const f=setup({pending_claims:{old_id:claim}});f.bind();await f.context.saveAddPendingClaimFromModal();
  assert.equal(f.data.pending_claims.old_id.huongDanThuThapHoSo,undefined);
  assert.deepEqual(f.data.collection_guides[f.key()].state,guide);
  assert.equal(f.context.editingPendingClaimId,'old_id','saving keeps the claim open for further edits');
  assert.equal(f.toasts.at(-1)?.type,'success');
});

test('Delayed old form responses cannot replace another claim',async()=>{
  const f=setup();let resolve;const wait=new Promise(done=>{resolve=done;});
  f.context.dbNodeInstance.ref=()=>({once:()=>wait});
  const request=f.context.loadCollectionGuideForClaim(claim,'old_id');
  f.context.resetClaimDocumentContext();f.context.editingPendingClaimId='new_id';f.context.collectionGuideDraft={version:1,meta:{assessor:'Màn hình mới'},items:{},extras:[]};
  resolve({exists:()=>true,val:()=>({state:guide})});await request;
  assert.equal(f.context.collectionGuideDraft.meta.assessor,'Màn hình mới');
});

test('Invalid internal Firebase keys cannot escape the storage branch',()=>{
  const f=setup();for(const id of ['','a/b','a.b','a#b','a$b','a[b','a]b','a\u0000b'])assert.throws(()=>f.context.claimDocumentId(id));
});
