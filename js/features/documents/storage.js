// Document data lives outside pending_claims. Deleting a claim must never delete these nodes.
const claimDocumentStore = {context:null, guideRecord:null, guideError:null, sequence:0, formSequence:0, ready:false};

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
  const record={id:claimDocumentId(id),claimId:claimDocumentId(id),version:1,state:structuredClone(state),claimReference:claimDocumentReference(id,reference),createdAt:previous?.createdAt||Date.now(),updatedAt:Date.now(),savedByUid:String(user?.uid||''),savedByName:String(activeUserProfile?.displayName||user?.email||''),documentEdits:collectionDocumentReadEdits(snapshot),editsSource:collectionDocumentDraftIdentity(snapshot).source};
  return record;
}

function claimDocumentCanView(record,liveClaim=null) {
  const user=firebase.auth().currentUser;
  if(!user || !hasUserPermission('pending','view'))return false;
  if(String(activeUserProfile?.role||'').trim().toLowerCase()==='admin')return true;
  if(liveClaim)return !!filterPendingClaimsByUserPrivileges({claim:liveClaim},user).claim;
  const ref=record.claimReference||{};
  const names=[activeUserProfile?.displayName,activeUserProfile?.email,user.email].filter(Boolean).map(value=>String(value).trim().toLowerCase());
  return [ref.createdByUid,ref.nguoiTao?.uid,record.savedByUid].includes(user.uid) || [ref.gdvTiepNhan,ref.canBoXuLy].some(value=>value&&names.includes(String(value).trim().toLowerCase()));
}

function resetClaimDocumentContext() {
  claimDocumentStore.sequence++;
  claimDocumentStore.formSequence++;
  claimDocumentStore.context=null;claimDocumentStore.guideRecord=null;claimDocumentStore.guideError=null;claimDocumentStore.ready=false;
  const banner=document.getElementById('claimDocumentArchiveNotice');if(banner)banner.hidden=true;
  const submit=document.getElementById('btnSubmitAddPendingClaim');if(submit)submit.removeAttribute('data-document-only');
}

async function loadCollectionGuideForClaim(item,id) {
  const sequence=++claimDocumentStore.sequence;
  claimDocumentStore.ready=false;claimDocumentStore.guideRecord=null;claimDocumentStore.guideError=null;
  initializeCollectionGuide(item);
  try {
    const snapshot=await dbNodeInstance.ref('collection_guides/'+claimDocumentId(id)).once('value');
    if(sequence!==claimDocumentStore.sequence || editingPendingClaimId!==id)return false;
    const record=snapshot.val();
    if(record && record.state?.version!==1)throw new Error('Định dạng hướng dẫn trong kho chưa được hỗ trợ.');
    if(record?.state?.version===1) {
      claimDocumentStore.guideRecord=record;
      initializeCollectionGuide({...item,huongDanThuThapHoSo:record.state});
      const current=claimDocumentSnapshot(getCollectionGuideState(),claimDocumentFormReference(id,item));
      if(record.editsSource===collectionDocumentDraftIdentity(current).source && record.documentEdits)collectionDocumentWriteEdits(current,record.documentEdits);
    }
    claimDocumentStore.ready=true;return true;
  }catch(error){
    if(sequence!==claimDocumentStore.sequence)return false;
    claimDocumentStore.guideError=error;
    triggerToast('Chưa tải được hướng dẫn đã lưu. Vui lòng mở lại hồ sơ trước khi lưu tài liệu.','error');return false;
  }
}

async function saveCollectionGuideToLibrary({close=false}={}) {
  if(!hasUserPermission('pending','edit'))return triggerToast('Bạn không có quyền lưu tài liệu.','error');
  const id=editingPendingClaimId;
  if(!id)return triggerToast('Hãy lưu hồ sơ lần đầu để tạo mã lưu hướng dẫn riêng.','info');
  if(!claimDocumentStore.ready || claimDocumentStore.guideError)return triggerToast('Chưa tải xong tài liệu. Vui lòng mở lại hồ sơ rồi thử lưu.','warning');
  const button=document.getElementById('btnSaveCollectionGuideIndependent');if(button)button.disabled=true;
  try {
    const sequence=claimDocumentStore.sequence;
    document.getElementById('collectionGuidePreview')?._guideEditor?.flush();
    await collectionGuidePrepareContact();
    if(sequence!==claimDocumentStore.sequence || editingPendingClaimId!==id)return;
    const base=claimDocumentStore.context?.reference || cachedPendingClaimsPayload?.[id] || {};
    const reference=claimDocumentFormReference(id,base);
    const record=buildCollectionGuideStorageRecord(id,reference,getCollectionGuideState(),claimDocumentStore.guideRecord);
    await dbNodeInstance.ref('collection_guides/'+claimDocumentId(id)).set(record);
    if(sequence===claimDocumentStore.sequence)claimDocumentStore.guideRecord=record;
    triggerToast('Đã lưu hướng dẫn vào kho riêng. Xoá hồ sơ sẽ không xoá hướng dẫn này.','success');
    if(close && sequence===claimDocumentStore.sequence)closeAddPendingClaimModal();
    if(activeDashboardTab==='document_library')void loadClaimDocumentLibrary();
  }catch(error){triggerToast('Chưa lưu được hướng dẫn vào kho: '+error.message,'error');}
  finally{if(button)button.disabled=false;}
}

// Migrate old embedded data before deletion. Transactions preserve newer independent records.
// Any failed archival write rejects the operation, so callers cannot continue deleting claims.
async function preserveClaimDocumentsBeforeDelete(claims) {
  const entries=Object.entries(claims||{});
  for(let offset=0;offset<entries.length;offset+=6) {
    await Promise.all(entries.slice(offset,offset+6).map(async ([id,item])=>{
      const key=claimDocumentId(id),reference=claimDocumentReference(key,item);
      if(item.huongDanThuThapHoSo?.version===1) {
        const record=buildCollectionGuideStorageRecord(key,reference,item.huongDanThuThapHoSo);
        await dbNodeInstance.ref('collection_guides/'+key).transaction(current=>current||record);
      }
      if(hasEmbeddedSceneDiagramData(item)) {
        const user=firebase.auth().currentUser;
        const record={id:key,claimId:key,imageDataUrl:typeof item.soDoHienTruong==='string'?item.soDoHienTruong:'',shapes:JSON.stringify(parseStoredSceneDiagramShapes(item.soDoHienTruongData||item.duLieuSoDoHienTruong)),templateMeta:JSON.stringify(parseStoredSceneTemplateMeta(item.soDoHienTruongMeta||item.thongTinSoDoHienTruong)||{}),createdAt:item.soDoHienTruongUpdatedAt||Date.now(),updatedAt:item.soDoHienTruongUpdatedAt||Date.now(),savedByUid:String(user?.uid||''),savedByName:String(activeUserProfile?.displayName||user?.email||''),claimReference:reference};
        await dbNodeInstance.ref('scene_diagrams/'+key).transaction(current=>current||record);
      }
      // Enrich old scene references while the claim is still available, without replacing vectors.
      const sceneRef=dbNodeInstance.ref('scene_diagrams/'+key);
      const scene=await sceneRef.once('value');
      if(scene.exists())await sceneRef.transaction(current=>current?{...current,claimReference:{...(current.claimReference||{}),...reference}}:undefined);
    }));
  }
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
