const claimDocumentLibrary={rows:[],query:'',filter:'all',page:1,loading:false,error:'',sequence:0};

function renderClaimDocumentLibraryPage(container=document.getElementById('tabContentContainer')) {
  if(!container)return;
  if(!hasUserPermission('pending','view')){container.innerHTML='<p>Bạn không có quyền xem kho tài liệu.</p>';return;}
  container.innerHTML=`<section class="document-library p-card">
    <header class="document-library-header"><div><span class="document-library-eyebrow">TÀI LIỆU GIÁM ĐỊNH</span><h2>Kho sơ đồ & hướng dẫn</h2><p>Lưu riêng sơ đồ hiện trường và hướng dẫn thu thập. Tài liệu vẫn còn khi hồ sơ gốc bị xoá.</p></div>
      <div class="document-library-actions"><button type="button" class="btn-premium btn-secondary" onclick="loadClaimDocumentLibrary()">Làm mới</button>${hasUserPermission('pending','edit')?'<button id="btnMigrateClaimDocuments" type="button" class="btn-premium" onclick="migrateClaimDocumentsToLibrary()">Lưu giữ tài liệu hiện có</button>':''}</div></header>
    <div id="claimDocumentLibraryStats" class="document-library-stats" aria-live="polite"></div>
    <div class="document-library-toolbar"><label class="document-library-search"><span>Tìm tài liệu</span><input class="input-premium" type="search" placeholder="Biển số, số HSBT, mã VTT, khách hàng…" aria-label="Tìm trong kho tài liệu" oninput="filterClaimDocumentLibrary(this.value)" id="claimDocumentLibrarySearch"></label>
      <label><span>Loại tài liệu</span><select class="input-premium" id="claimDocumentLibraryFilter" onchange="setClaimDocumentLibraryFilter(this.value)"><option value="all">Tất cả tài liệu</option><option value="scene">Có sơ đồ hiện trường</option><option value="guide">Có hướng dẫn thu thập</option><option value="orphan">Hồ sơ gốc đã xoá</option></select></label></div>
    <div id="claimDocumentLibraryResults" aria-live="polite"></div>
  </section>`;
  document.getElementById('claimDocumentLibrarySearch').value=claimDocumentLibrary.query;
  document.getElementById('claimDocumentLibraryFilter').value=claimDocumentLibrary.filter;
  void loadClaimDocumentLibrary();
}

async function loadClaimDocumentLibrary() {
  if(!dbNodeInstance || !firebase.auth().currentUser || !hasUserPermission('pending','view'))return;
  const sequence=++claimDocumentLibrary.sequence,uid=firebase.auth().currentUser.uid;
  claimDocumentLibrary.loading=true;claimDocumentLibrary.error='';renderClaimDocumentLibraryRows();
  try {
    const [scenes,guides,pending]=await Promise.all(['scene_diagrams','collection_guides','pending_claims'].map(node=>dbNodeInstance.ref(node).once('value')));
    if(sequence!==claimDocumentLibrary.sequence || firebase.auth().currentUser?.uid!==uid)return;
    const sceneData=scenes.val()||{},guideData=guides.val()||{},liveData=pending.val()||{};
    const ids=new Set([...Object.keys(sceneData),...Object.keys(guideData),...Object.keys(liveData).filter(id=>liveData[id]?.huongDanThuThapHoSo || hasEmbeddedSceneDiagramData(liveData[id]))]);
    const rows=[];
    for(const id of ids) {
      const live=liveData[id]||null,scene=sceneData[id]||null,guide=guideData[id]||null;
      const records=[scene,guide].filter(Boolean).sort((a,b)=>(Number(a.updatedAt)||0)-(Number(b.updatedAt)||0));
      const reference=Object.assign({},...records.map(record=>record.claimReference||{}),live||{});
      if(!claimDocumentCanView({claimReference:reference,savedByUid:records.at(-1)?.savedByUid},live))continue;
      const hasScene=!!scene || hasEmbeddedSceneDiagramData(live);
      const hasGuide=!!guide?.state || !!live?.huongDanThuThapHoSo;
      if(!hasScene&&!hasGuide)continue;
      rows.push({id,reference:claimDocumentReference(id,reference),live:!!live,scene,guide,hasScene,hasGuide,legacy:(!scene&&hasScene)||(!guide&&hasGuide),updatedAt:Math.max(...records.map(record=>Number(record.updatedAt)||0),Number(live?.updatedAt)||0)});
    }
    claimDocumentLibrary.rows=rows.sort((a,b)=>b.updatedAt-a.updatedAt||a.id.localeCompare(b.id));
  }catch(error){
    if(sequence===claimDocumentLibrary.sequence){claimDocumentLibrary.rows=[];claimDocumentLibrary.error='Chưa tải được kho tài liệu. Hãy thử lại hoặc kiểm tra quyền truy cập dữ liệu: '+error.message;}
  }finally{
    if(sequence===claimDocumentLibrary.sequence){claimDocumentLibrary.loading=false;renderClaimDocumentLibraryRows();}
  }
}

function filterClaimDocumentLibrary(query){claimDocumentLibrary.query=query;claimDocumentLibrary.page=1;renderClaimDocumentLibraryRows();}
function setClaimDocumentLibraryFilter(filter){claimDocumentLibrary.filter=filter;claimDocumentLibrary.page=1;renderClaimDocumentLibraryRows();}
function setClaimDocumentLibraryPage(page){claimDocumentLibrary.page=page;renderClaimDocumentLibraryRows();}

function renderClaimDocumentLibraryRows() {
  const target=document.getElementById('claimDocumentLibraryResults');if(!target || activeDashboardTab!=='document_library')return;
  const all=claimDocumentLibrary.rows,escape=escapeHtmlOutput;
  const stats=document.getElementById('claimDocumentLibraryStats');
  if(stats)stats.innerHTML=[['Bộ tài liệu',all.length],['Sơ đồ hiện trường',all.filter(row=>row.hasScene).length],['Hướng dẫn thu thập',all.filter(row=>row.hasGuide).length],['Hồ sơ gốc đã xoá',all.filter(row=>!row.live).length]].map(([label,total])=>`<div><span>${label}</span><strong>${total}</strong></div>`).join('');
  if(claimDocumentLibrary.loading){target.innerHTML='<div class="document-library-empty" role="status">Đang tải tài liệu đã lưu…</div>';return;}
  if(claimDocumentLibrary.error){target.innerHTML=`<div class="document-library-empty" role="alert"><strong>Không thể tải tài liệu</strong><p>${escape(claimDocumentLibrary.error)}</p><button type="button" class="btn-premium" onclick="loadClaimDocumentLibrary()">Thử lại</button></div>`;return;}
  const query=removeVietnameseTones(claimDocumentLibrary.query).toLowerCase().trim();
  const filtered=all.filter(row=>{
    if(claimDocumentLibrary.filter==='scene'&&!row.hasScene || claimDocumentLibrary.filter==='guide'&&!row.hasGuide || claimDocumentLibrary.filter==='orphan'&&row.live)return false;
    return !query || removeVietnameseTones([row.reference.bienSo,row.reference.soHoSoBoiThuong,row.reference.maVuTonThat,row.reference.khachHang,row.reference.gdvTiepNhan,row.reference.canBoXuLy].join(' ')).toLowerCase().includes(query);
  });
  const totalPages=Math.max(1,Math.ceil(filtered.length/20));claimDocumentLibrary.page=Math.min(totalPages,Math.max(1,claimDocumentLibrary.page));
  if(!filtered.length){target.innerHTML='<div class="document-library-empty"><strong>Chưa có tài liệu phù hợp</strong><p>Lưu sơ đồ hoặc hướng dẫn từ hồ sơ, hoặc chọn “Lưu giữ tài liệu hiện có”. Bạn cũng có thể đổi từ khoá và bộ lọc.</p></div>';return;}
  target.innerHTML=`<p class="document-library-result-count">${filtered.length} bộ tài liệu · Trang ${claimDocumentLibrary.page}/${totalPages}</p><div class="document-library-table-wrap"><table class="document-library-table"><thead><tr><th>Biển số / Khách hàng</th><th>Số hồ sơ / Mã vụ tổn thất</th><th>Tài liệu lưu giữ</th><th>Hồ sơ gốc</th><th>Cập nhật</th><th>Mở tài liệu</th></tr></thead><tbody>${filtered.slice((claimDocumentLibrary.page-1)*20,claimDocumentLibrary.page*20).map(row=>{
    const ref=row.reference;
    const button=(kind,label)=>`<button type="button" class="btn-premium btn-secondary" data-document-id="${escape(row.id)}" data-document-open="${kind}">${label}</button>`;
    return `<tr><td><strong>${escape(ref.bienSo||'Chưa có biển số')}</strong><small>${escape(ref.khachHang||ref.chuXe||'Chưa có tên khách hàng')}</small></td><td><strong>${escape(ref.soHoSoBoiThuong||'Chưa có số HSBT')}</strong><small>${escape(ref.maVuTonThat||'')}</small></td><td><div class="document-library-tags">${row.hasScene?'<span>Sơ đồ hiện trường</span>':''}${row.hasGuide?'<span>Hướng dẫn thu thập</span>':''}</div>${row.legacy?'<small>Có dữ liệu cũ cần lưu giữ</small>':''}</td><td><span class="document-library-status ${row.live?'':'is-retained'}">${row.live?'Còn trong danh sách':'Đã xoá · Tài liệu được giữ'}</span></td><td>${row.updatedAt?escape(new Date(row.updatedAt).toLocaleString('vi-VN')):'—'}</td><td><div class="document-library-actions">${row.hasScene?button('scene','Mở sơ đồ'):''}${row.hasGuide?button('guide','Mở hướng dẫn'):''}</div></td></tr>`;
  }).join('')}</tbody></table></div><footer class="document-library-pagination"><button type="button" class="btn-premium btn-secondary" onclick="setClaimDocumentLibraryPage(${claimDocumentLibrary.page-1})" ${claimDocumentLibrary.page===1?'disabled':''}>Trang trước</button><span>Trang ${claimDocumentLibrary.page} / ${totalPages}</span><button type="button" class="btn-premium btn-secondary" onclick="setClaimDocumentLibraryPage(${claimDocumentLibrary.page+1})" ${claimDocumentLibrary.page===totalPages?'disabled':''}>Trang sau</button></footer>`;
  target.querySelectorAll('[data-document-open]').forEach(button=>button.addEventListener('click',()=>openClaimDocumentFromLibrary(button.dataset.documentId,button.dataset.documentOpen)));
}

async function migrateClaimDocumentsToLibrary() {
  if(!hasUserPermission('pending','edit'))return;
  const button=document.getElementById('btnMigrateClaimDocuments');if(button)button.disabled=true;
  try {
    const snapshot=await dbNodeInstance.ref('pending_claims').once('value');
    const visible=filterPendingClaimsByUserPrivileges(snapshot.val()||{},firebase.auth().currentUser);
    await preserveClaimDocumentsBeforeDelete(visible);
    triggerToast('Đã lưu giữ tài liệu hiện có vào kho riêng.','success');
    await loadClaimDocumentLibrary();
  }catch(error){triggerToast('Chưa lưu giữ được tài liệu: '+error.message,'error');}
  finally{if(button)button.disabled=false;}
}

async function openClaimDocumentFromLibrary(id,kind) {
  const row=claimDocumentLibrary.rows.find(item=>item.id===id);if(!row)return;
  if(!claimDocumentCanView({claimReference:row.reference,savedByUid:row.guide?.savedByUid||row.scene?.savedByUid},row.live?row.reference:null))return;
  try {
    // Read existence again: a claim can be deleted while the library is open.
    const snapshot=await dbNodeInstance.ref('pending_claims/'+claimDocumentId(id)).once('value');
    const live=snapshot.val();
    const item=live || {...row.reference,id,huongDanThuThapHoSo:row.guide?.state};
    if(live && !claimDocumentCanView({claimReference:live},live))throw new Error('Bạn không còn quyền mở hồ sơ này.');
    await openEditPendingClaimModal(id,kind==='guide'?'CollectionGuide':'Event',{claim:item,documentOnly:!live});
    if(editingPendingClaimId===id && kind==='scene')openSceneDrawingModal();
  }catch(error){triggerToast('Không thể mở tài liệu: '+error.message,'error');}
}

function configureClaimDocumentOnlyForm(reference) {
  const id=editingPendingClaimId;
  claimDocumentStore.context={id,reference:claimDocumentReference(id,reference),documentOnly:true};
  updateHeaderCancelClaimProposalButton(null);
  const title=document.getElementById('addPendingClaimModalTitle');if(title)title.textContent='Tài liệu lưu riêng'+(reference.bienSo?' ('+reference.bienSo+')':'');
  const submit=document.getElementById('btnSubmitAddPendingClaim');if(submit){submit.dataset.documentOnly='true';submit.querySelector('span').textContent='Lưu tài liệu vào kho riêng';}
  const banner=document.getElementById('claimDocumentArchiveNotice');if(banner){banner.hidden=false;banner.textContent='Hồ sơ gốc đã được xoá. Bạn đang xem và chỉnh sửa bản tài liệu lưu riêng; lưu tại đây sẽ không tạo lại hồ sơ.';}
}
