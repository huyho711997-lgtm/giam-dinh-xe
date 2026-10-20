// A claim may receive a new internal ID on every Excel import. HSBT remains stable.
const claimDocumentLegacyCache=new Map();

function normalizeClaimHsbt(value) {
  const number=String(value||'').normalize('NFKC').replace(/\s+/gu,'').toUpperCase();
  return ['', '—', '-', 'CHƯACÓ', 'CHUACO', 'N/A'].includes(number)?'':number;
}

function claimDocumentStorageKey(id,reference={}) {
  const number=normalizeClaimHsbt(reference.soHoSoBoiThuong);
  if(!number)return claimDocumentId(id);
  const hex=[...new TextEncoder().encode(number)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  if(hex.length>740)throw new Error('Số HSBT quá dài để lưu tài liệu.');
  return 'hsbt_'+hex;
}

function claimDocumentRecordNumber(record) {
  return normalizeClaimHsbt(record?.hsbtNormalized||record?.claimReference?.soHoSoBoiThuong);
}

function claimDocumentFormNumberMatches(reference) {
  const input=document.getElementById('modalPendingSoHoSoBoiThuong');
  return !input || normalizeClaimHsbt(input.value)===normalizeClaimHsbt(reference.soHoSoBoiThuong);
}

function claimDocumentMatchesNumber(record,number,sameId=false) {
  const stored=claimDocumentRecordNumber(record);
  return stored===number || sameId&&!stored;
}

async function resolveClaimDocument(node,id,reference={},embedded=null) {
  const key=claimDocumentStorageKey(id,reference),number=normalizeClaimHsbt(reference.soHoSoBoiThuong);
  const canonical=await dbNodeInstance.ref(node+'/'+key).once('value');
  if(canonical.exists())return canonical.val(); // Includes tombstones for explicitly removed diagrams.
  let record=null;
  if(key!==id) {
    const previous=await dbNodeInstance.ref(node+'/'+claimDocumentId(id)).once('value');
    if(previous.exists() && claimDocumentMatchesNumber(previous.val(),number,true))record=previous.val();
    if(!record) {
      const user=firebase.auth().currentUser?.uid||'';
      const cacheKey=user+':'+node;
      if(!claimDocumentLegacyCache.has(cacheKey)) {
        const request=dbNodeInstance.ref(node).once('value').then(snapshot=>snapshot.val()||{}).catch(error=>{claimDocumentLegacyCache.delete(cacheKey);throw error;});
        claimDocumentLegacyCache.set(cacheKey,request);
      }
      const records=await claimDocumentLegacyCache.get(cacheKey);
      record=Object.values(records).filter(item=>claimDocumentMatchesNumber(item,number)).sort((a,b)=>(Number(b.updatedAt)||0)-(Number(a.updatedAt)||0))[0]||null;
    }
  }
  record=record||embedded;
  if(!record)return null;
  if(!hasUserPermission('pending','edit'))return record;
  const migrated={...record,id:key,storageKey:key,hsbtNormalized:number,claimReference:{...(record.claimReference||{}),...claimDocumentReference(id,reference)}};
  const result=await dbNodeInstance.ref(node+'/'+key).transaction(current=>current||migrated);
  return result.snapshot.val();
}

function buildEmbeddedSceneStorageRecord(id,item) {
  const user=firebase.auth().currentUser;
  return {id,claimId:id,imageDataUrl:typeof item.soDoHienTruong==='string'?item.soDoHienTruong:'',shapes:JSON.stringify(parseStoredSceneDiagramShapes(item.soDoHienTruongData||item.duLieuSoDoHienTruong)),templateMeta:JSON.stringify(parseStoredSceneTemplateMeta(item.soDoHienTruongMeta||item.thongTinSoDoHienTruong)||{}),createdAt:item.soDoHienTruongUpdatedAt||Date.now(),updatedAt:item.soDoHienTruongUpdatedAt||Date.now(),savedByUid:String(user?.uid||''),savedByName:String(activeUserProfile?.displayName||user?.email||''),claimReference:claimDocumentReference(id,item)};
}

async function preserveClaimDocumentsByHsbt(claims) {
  const entries=Object.entries(claims||{});
  for(let offset=0;offset<entries.length;offset+=8) {
    await Promise.all(entries.slice(offset,offset+8).map(async([id,item])=>{
      const guide=item.huongDanThuThapHoSo?.version===1?buildCollectionGuideStorageRecord(id,item,item.huongDanThuThapHoSo):null;
      await resolveClaimDocument('collection_guides',id,item,guide);
      const scene=hasEmbeddedSceneDiagramData(item)?buildEmbeddedSceneStorageRecord(id,item):null;
      await resolveClaimDocument('scene_diagrams',id,item,scene);
    }));
  }
}
