// Capture before a modal closes, then serialize writes per document so older requests cannot win.
const claimDocumentWriteQueues=new Map();
const claimDocumentFailedWrites=new Map();

function currentClaimDocumentId(){return editingPendingClaimId||claimDocumentStore.draftId;}

function bindCurrentClaimDocuments(id,reference={}) {
  claimDocumentStore.binding={id,reference:claimDocumentReference(id,reference),key:claimDocumentStorageKey(id,reference)};
  claimDocumentStore.guideBaseline=claimDocumentGuideSignature();
  claimDocumentStore.guideDirty=false;claimDocumentStore.sceneDirty=false;
  updateClaimDocumentAutoStatus();
}

function currentClaimDocumentReference() {
  const binding=claimDocumentStore.binding;
  if(!binding)return null;
  const reference=claimDocumentFormReference(binding.id,binding.reference);
  // During an HSBT change, pending edits still belong to the number that was loaded.
  reference.soHoSoBoiThuong=binding.reference.soHoSoBoiThuong||'';
  return reference;
}

function claimDocumentGuideSignature() {
  if(!collectionGuideDraft)return '';
  const binding=claimDocumentStore.binding;
  if(!binding)return '';
  const reference=currentClaimDocumentReference();
  const state=getCollectionGuideState(),snapshot=claimDocumentSnapshot(state,reference);
  return JSON.stringify({state,claim:snapshot.claim,edits:collectionDocumentReadEdits(snapshot)});
}

function updateClaimDocumentAutoStatus(message='') {
  const binding=claimDocumentStore.binding;
  let text=message || (claimDocumentStore.guideError||claimDocumentStore.sceneError?'Chưa tải được tài liệu. Vui lòng mở lại hồ sơ.':claimDocumentStore.saveError?'Chưa tự lưu được. Đang giữ bản chỉnh sửa để thử lại.':claimDocumentStore.guideDirty||claimDocumentStore.sceneDirty||claimDocumentStore.saving?'Đang tự lưu…':binding&&normalizeClaimHsbt(binding.reference.soHoSoBoiThuong)?'Tự lưu theo số HSBT '+binding.reference.soHoSoBoiThuong:'Nhập số HSBT để tự khôi phục tài liệu khi nạp lại hồ sơ.');
  for(const id of ['claimDocumentAutoStatus','sceneDocumentAutoStatus','authorityRequestAutoStatus']) {
    const node=document.getElementById(id);if(node){node.textContent=text;node.dataset.error=String(!!claimDocumentStore.saveError);}
  }
}

function enqueueClaimDocumentWrite(kind,record,binding=claimDocumentStore.binding) {
  const path=(kind==='guide'?'collection_guides/':'scene_diagrams/')+binding.key;
  const uid=firebase.auth().currentUser?.uid||'',sequence=claimDocumentStore.formSequence;
  const task={path,record:structuredClone(record),uid,kind,binding:structuredClone(binding)};
  const previous=claimDocumentWriteQueues.get(path)||Promise.resolve();
  claimDocumentStore.saving++;updateClaimDocumentAutoStatus();
  const promise=previous.catch(()=>{}).then(async()=>{
    if(firebase.auth().currentUser?.uid!==uid)throw new Error('Phiên đăng nhập đã thay đổi.');
    await dbNodeInstance.ref(path).set(task.record);
    if(claimDocumentFailedWrites.get(path)?.record.updatedAt<=task.record.updatedAt)claimDocumentFailedWrites.delete(path);
    if(sequence===claimDocumentStore.formSequence&&claimDocumentStore.binding?.key===binding.key){claimDocumentStore.saveError=null;if(kind==='guide')claimDocumentStore.guideRecord=task.record;}
  }).catch(error=>{
    claimDocumentFailedWrites.set(path,task);
    if(sequence===claimDocumentStore.formSequence&&claimDocumentStore.binding?.key===binding.key)claimDocumentStore.saveError=error;
    throw error;
  }).finally(()=>{
    if(claimDocumentWriteQueues.get(path)===promise)claimDocumentWriteQueues.delete(path);
    claimDocumentStore.saving=Math.max(0,claimDocumentStore.saving-1);updateClaimDocumentAutoStatus();
  });
  claimDocumentWriteQueues.set(path,promise);
  return promise;
}

function canAutoSaveClaimDocuments() {
  return claimDocumentStore.ready && claimDocumentStore.binding && hasUserPermission('pending',editingPendingClaimId?'edit':'add') && !!firebase.auth().currentUser && (editingPendingClaimId || normalizeClaimHsbt(claimDocumentStore.binding.reference.soHoSoBoiThuong));
}

function scheduleCollectionGuideAutoSave() {
  if(!canAutoSaveClaimDocuments() || claimDocumentStore.guideError)return;
  if(claimDocumentGuideSignature()===claimDocumentStore.guideBaseline)return;
  claimDocumentStore.guideDirty=true;clearTimeout(claimDocumentStore.guideTimer);
  claimDocumentStore.guideTimer=setTimeout(()=>flushClaimDocumentAutoSave({scene:false}).catch(()=>{}),650);
  updateClaimDocumentAutoStatus();
}

function scheduleSceneDocumentAutoSave() {
  if(!canAutoSaveClaimDocuments() || claimDocumentStore.sceneError)return;
  if(!sceneShapes.length&&!sceneDiagramDataUrl&&!claimDocumentStore.sceneDirty)return;
  claimDocumentStore.sceneDirty=true;clearTimeout(claimDocumentStore.sceneTimer);
  claimDocumentStore.sceneTimer=setTimeout(()=>flushClaimDocumentAutoSave({guide:false}).catch(()=>{}),1000);
  updateClaimDocumentAutoStatus();
}

async function flushClaimDocumentAutoSave({guide=true,scene=true}={}) {
  const jobs=[];
  if(guide)clearTimeout(claimDocumentStore.guideTimer);
  if(scene)clearTimeout(claimDocumentStore.sceneTimer);
  if(canAutoSaveClaimDocuments()) {
    const binding=structuredClone(claimDocumentStore.binding),reference=currentClaimDocumentReference();
    if(guide && claimDocumentStore.guideDirty && !claimDocumentStore.guideError) {
      document.getElementById('collectionGuidePreview')?._guideEditor?.flush();
      const record=buildCollectionGuideStorageRecord(binding.id,reference,getCollectionGuideState(),claimDocumentStore.guideRecord);
      claimDocumentStore.guideBaseline=claimDocumentGuideSignature();claimDocumentStore.guideDirty=false;
      jobs.push(enqueueClaimDocumentWrite('guide',record,binding));
    }
    if(scene && claimDocumentStore.sceneDirty && !claimDocumentStore.sceneError) {
      sceneDiagramDataUrl=createSceneDrawingExportDataUrl();
      sceneDiagramShapesSnapshot=cloneSceneDiagramShapes(sceneShapes);
      sceneDiagramTemplateMetaSnapshot=cloneSceneTemplateMeta(ensureSceneTemplateMeta());
      sceneDiagramUpdatedAt=Date.now();
      updateSceneDiagramPreview(sceneDiagramDataUrl);
      const record=buildSceneDiagramStorageRecord(binding.id,reference);
      claimDocumentStore.sceneDirty=false;
      jobs.push(enqueueClaimDocumentWrite('scene',record,binding));
    }
  }
  jobs.push(...claimDocumentWriteQueues.values());
  await Promise.all(jobs);
}

async function retryClaimDocumentAutoSave(storageKey=null) {
  const uid=firebase.auth().currentUser?.uid;
  const jobs=[...claimDocumentFailedWrites.values()].filter(task=>task.uid===uid&&(!storageKey||task.binding.key===storageKey)&&!claimDocumentWriteQueues.has(task.path)).map(task=>enqueueClaimDocumentWrite(task.kind,task.record,task.binding));
  await Promise.all(jobs);
}

async function rebindClaimDocumentsByHsbt() {
  const binding=claimDocumentStore.binding,id=currentClaimDocumentId();
  if(!binding||!id)return;
  const reference=claimDocumentFormReference(id,binding.reference);
  if(claimDocumentStorageKey(id,reference)===binding.key)return;
  const bindingVersion=++claimDocumentStore.bindingVersion;
  if(!normalizeClaimHsbt(binding.reference.soHoSoBoiThuong)) {
    reference.huongDanThuThapHoSo=getCollectionGuideState();
    if(sceneShapes.length||sceneDiagramDataUrl){
      reference.soDoHienTruong=sceneDiagramDataUrl;
      reference.soDoHienTruongData=JSON.stringify(sceneShapes);
      reference.soDoHienTruongMeta=JSON.stringify(ensureSceneTemplateMeta());
    }
  }
  const formSequence=claimDocumentStore.formSequence;
  await flushClaimDocumentAutoSave();
  await retryClaimDocumentAutoSave(binding.key);
  if(formSequence!==claimDocumentStore.formSequence||bindingVersion!==claimDocumentStore.bindingVersion)return;
  claimDocumentStore.ready=false;
  await loadSceneDiagramForClaim(reference,id);
  if(formSequence!==claimDocumentStore.formSequence||bindingVersion!==claimDocumentStore.bindingVersion||!claimDocumentFormNumberMatches(reference))return;
  await loadCollectionGuideForClaim(reference,id);
}

document.addEventListener('input',event=>{
  if(event.target.id==='modalPendingSoHoSoBoiThuong')return;
  if(event.target.closest('#addPendingClaimModalOverlay,#tndsAdvanceDialog'))queueMicrotask(scheduleCollectionGuideAutoSave);
});
document.addEventListener('change',event=>{
  if(event.target.id==='modalPendingSoHoSoBoiThuong') {
    claimDocumentStore.bindingPromise=rebindClaimDocumentsByHsbt().catch(error=>{claimDocumentStore.saveError=error;updateClaimDocumentAutoStatus();});
  }else if(event.target.closest('#tabPane_CollectionGuide,#tabPane_AuthorityRequest,#tndsAdvanceDialog'))queueMicrotask(scheduleCollectionGuideAutoSave);
});
window.addEventListener('online',()=>retryClaimDocumentAutoSave().catch(()=>{}));
window.addEventListener('pagehide',()=>flushClaimDocumentAutoSave().catch(()=>{}));
