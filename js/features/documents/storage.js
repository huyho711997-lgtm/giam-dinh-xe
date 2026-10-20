// Document data lives outside pending_claims. Deleting a claim must never delete these nodes.
const claimDocumentStore = {guideRecord:null,guideError:null,sceneError:null,sequence:0,formSequence:0,bindingVersion:0,ready:false,binding:null,draftId:null,guideDirty:false,sceneDirty:false,guideTimer:null,sceneTimer:null,guideBaseline:'',saving:0,saveError:null,bindingPromise:null};

function claimDocumentId(id) {
  const key=String(id || '');
  if(!key || [...key].some(char=>'.#$[]/'.includes(char)||char.charCodeAt(0)<32||char.charCodeAt(0)===127)) throw new Error('Mã lưu tài liệu không hợp lệ.');
  return key;
}

function claimDocumentReference(id,item={}) {
  const reference={id:claimDocumentId(id),claimId:claimDocumentId(id)};
  for(const key of ['maVuTonThat','soHoSoBoiThuong','bienSo','khachHang','chuXe','soKhungSoMay','ngayVTT','ngayTonThat','diaDiemVTT','hienTruong','nguyenNhan','moTaTonThat','laiXe','nguoiLienHe','gdvTiepNhan','canBoXuLy','tinhTonThat','createdByUid','createdByName']) {
    if(item[key]!==undefined && item[key]!==null) reference[key]=String(item[key]).slice(0,10000);
  }
  if(item.nguoiTao?.uid) reference.nguoiTao={uid:String(item.nguoiTao.uid)};
  return reference;
}

function claimDocumentFormReference(id,base={}) {
  const reference=claimDocumentReference(id,base);
  const fields={maVuTonThat:'MaVuTonThat',soHoSoBoiThuong:'SoHoSoBoiThuong',bienSo:'BienSo',khachHang:'KhachHang',soKhungSoMay:'SoKhungSoMay',ngayVTT:'NgayVTT',diaDiemVTT:'DiaDiemVTT',hienTruong:'HienTruong',nguyenNhan:'NguyenNhan',moTaTonThat:'MoTaTonThat',laiXe:'LaiXe',nguoiLienHe:'NguoiLienHe',gdvTiepNhan:'GdvTiepNhan',canBoXuLy:'CanBoXuLy',tinhTonThat:'TinhTonThat'};
  for(const [key,suffix] of Object.entries(fields)) {
    const input=document.getElementById('modalPending'+suffix);
    if(input)reference[key]=String(input.value||'').trim().slice(0,10000);
  }
  return reference;
}

function claimDocumentSnapshot(state,reference) {
  return {state:structuredClone(state),claim:{number:reference.soHoSoBoiThuong||'',customer:reference.khachHang||reference.chuXe||'',plate:reference.bienSo||'',chassis:reference.soKhungSoMay||'',lossDate:reference.ngayVTT||reference.ngayTonThat||''}};
}

function buildCollectionGuideStorageRecord(id,reference,state,previous=null) {
  const user=firebase.auth().currentUser;
  const snapshot=claimDocumentSnapshot(state,reference);
  const record={id:claimDocumentStorageKey(id,reference),claimId:claimDocumentId(id),version:1,storageKey:claimDocumentStorageKey(id,reference),hsbtNormalized:normalizeClaimHsbt(reference.soHoSoBoiThuong),state:structuredClone(state),claimReference:claimDocumentReference(id,reference),createdAt:previous?.createdAt||Date.now(),updatedAt:Date.now(),savedByUid:String(user?.uid||''),savedByName:String(activeUserProfile?.displayName||user?.email||''),documentEdits:collectionDocumentReadEdits(snapshot),editsSource:collectionDocumentDraftIdentity(snapshot).source};
  return record;
}



function resetClaimDocumentContext() {
  flushClaimDocumentAutoSave().catch(error=>triggerToast('Chưa tự lưu được tài liệu: '+error.message,'error'));
  clearTimeout(claimDocumentStore.guideTimer);clearTimeout(claimDocumentStore.sceneTimer);
  claimDocumentStore.sequence++;claimDocumentStore.formSequence++;
  claimDocumentStore.bindingVersion++;
  Object.assign(claimDocumentStore,{ready:false,binding:null,draftId:'claim_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),guideRecord:null,guideError:null,sceneError:null,guideDirty:false,sceneDirty:false,guideBaseline:'',saveError:null,bindingPromise:null});
}

async function loadCollectionGuideForClaim(item,id) {
  const sequence=++claimDocumentStore.sequence;
  claimDocumentStore.ready=false;claimDocumentStore.guideRecord=null;claimDocumentStore.guideError=null;
  initializeCollectionGuide(item);
  try {
    const embedded=item.huongDanThuThapHoSo?.version===1?buildCollectionGuideStorageRecord(id,item,item.huongDanThuThapHoSo):null;
    const record=await resolveClaimDocument('collection_guides',id,item,embedded);
    if(sequence!==claimDocumentStore.sequence || currentClaimDocumentId()!==id || !claimDocumentFormNumberMatches(item))return false;
    if(record && record.state?.version!==1)throw new Error('Định dạng hướng dẫn chưa được hỗ trợ.');
    if(record?.state?.version===1) {
      claimDocumentStore.guideRecord=record;
      initializeCollectionGuide({...item,huongDanThuThapHoSo:record.state});
      const current=claimDocumentSnapshot(getCollectionGuideState(),claimDocumentFormReference(id,item));
      if(record.editsSource||record.documentEdits)collectionDocumentWriteEdits(current,record.documentEdits||{});
    }
    bindCurrentClaimDocuments(id,item);claimDocumentStore.ready=true;updateClaimDocumentAutoStatus();return true;
  }catch(error){
    if(sequence!==claimDocumentStore.sequence)return false;
    bindCurrentClaimDocuments(id,item);claimDocumentStore.guideError=error;claimDocumentStore.ready=true;
    updateClaimDocumentAutoStatus();return false;
  }
}



// Migrate old embedded data before deletion. Transactions preserve newer independent records.
// Any failed archival write rejects the operation, so callers cannot continue deleting claims.
async function preserveClaimDocumentsBeforeDelete(claims) {
  await flushClaimDocumentAutoSave();
  await retryClaimDocumentAutoSave();
  await preserveClaimDocumentsByHsbt(claims);
}

async function deletePendingClaimKeepingDocuments(id) {
  const key=claimDocumentId(id);
  const snapshot=await dbNodeInstance.ref('pending_claims/'+key).once('value');
  try {if(snapshot.exists())await preserveClaimDocumentsBeforeDelete({[key]:snapshot.val()});}
  catch(error){throw new Error('Chưa lưu giữ được tài liệu; hồ sơ chưa bị xoá. '+error.message);}
  await dbNodeInstance.ref('pending_claims/'+key).remove();
}

async function deleteAllPendingClaimsKeepingDocuments() {
  const snapshot=await dbNodeInstance.ref('pending_claims').once('value');
  try {await preserveClaimDocumentsBeforeDelete(snapshot.val()||{});}
  catch(error){throw new Error('Chưa lưu giữ được toàn bộ tài liệu; dữ liệu hồ sơ chưa bị xoá. '+error.message);}
  await dbNodeInstance.ref('pending_claims').remove();
}
