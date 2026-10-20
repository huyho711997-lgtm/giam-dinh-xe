


function inspectionRegisterIcon(name) {
  const paths={plus:'<path d="M12 5v14M5 12h14"/>',image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-5-5L5 21"/>'};
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}

function renderInspectionRegisterPage() {
  const metrics=[
    {key:'all',id:'lblTotalCases',label:'Tổng hồ sơ',tone:'gold',icon:'folder',note:'Toàn bộ hồ sơ giám định'},
    {key:'pending',id:'lblPendingCases',label:'Đang chờ Garage',tone:'amber',icon:'clock',note:'Chờ Garage cập nhật hồ sơ'},
    {key:'completed',id:'lblCompletedCases',label:'Đã có kết quả',tone:'green',icon:'check',note:'Đã hoàn tất khai báo'}
  ];
  return `<section class="inspection-page">
    <header class="inspection-hero"><div class="inspection-hero-copy"><span class="inspection-eyebrow">${transferRegisterIcon('folder')}Hồ sơ giám định</span><h1>Quản lý hồ sơ giám định</h1><p>Quản lý hồ sơ bồi thường, theo dõi ảnh tổn thất từ Garage và kết quả giám định.</p></div>${hasUserPermission('list','add')?`<button type="button" class="btn-premium inspection-create" onclick="navigateHeaderTab('create')">${inspectionRegisterIcon('plus')}<span>Tạo hồ sơ giám định</span></button>`:''}</header>
    <div class="claims-metrics-grid accounting-metrics inspection-metrics" aria-label="Tổng quan hồ sơ giám định">${metrics.map(metric=>`<button type="button" class="claims-metric-card claims-metric-card--${metric.tone}" data-inspection-filter="${metric.key}" aria-pressed="${activeCaseFilter===metric.key}" onclick="setCaseFilter('${metric.key}')"><div class="claims-metric-head"><span class="claims-metric-icon" aria-hidden="true">${transferRegisterIcon(metric.icon)}</span><span class="claims-metric-label">${metric.label}</span></div><div class="claims-metric-value-row"><strong id="${metric.id}" class="claims-metric-value">0</strong><span class="claims-metric-unit">hồ sơ</span></div><div class="claims-metric-foot"><span>${metric.note}</span><strong data-inspection-share>0%</strong></div><div class="claims-metric-track" aria-hidden="true"><i></i></div></button>`).join('')}</div>
    <div class="inspection-register"><div class="transfer-register-toolbar inspection-toolbar">
      <div class="transfer-register-search">${transferRegisterIcon('search')}<input id="caseSearchInput" class="input-premium" type="search" aria-label="Tìm hồ sơ giám định" autocomplete="off" placeholder="Tìm biển số, Garage, người tạo…" oninput="debouncedExecuteUIRenderCasesTable()"><button type="button" class="transfer-search-clear" aria-label="Xóa tìm kiếm" hidden onclick="clearInspectionSearch()">${transferRegisterIcon('close')}</button></div>
      <select id="inspectionStatusFilter" data-premium-select class="input-premium" aria-label="Lọc trạng thái hồ sơ giám định" onchange="setInspectionFilter(this.value)"><option value="all">Tất cả trạng thái</option><option value="pending">Đang chờ Garage</option><option value="completed">Đã có kết quả</option></select>
      <div class="transfer-register-controls"><span class="transfer-register-result" role="status" aria-live="polite"><strong id="casePaginationRange">0–0</strong> / <span id="casePaginationTotal">0</span> hồ sơ</span><select id="inspectionPerPage" data-premium-select class="input-premium" aria-label="Số hồ sơ giám định mỗi trang" onchange="setInspectionPerPage(this.value)">${[10,20,50].map(n=>`<option value="${n}" ${activeCasePerPage===n?'selected':''}>${n} / trang</option>`).join('')}</select><div id="casePaginationControls"></div></div>
    </div><div class="transfer-register-table-shell inspection-table-shell"><table class="p-table inspection-table"><colgroup><col style="width:31%"><col style="width:14%"><col style="width:19%"><col style="width:12%"><col style="width:24%"></colgroup><thead><tr><th scope="col">Phương tiện / Garage</th><th scope="col">Ngày khởi tạo</th><th scope="col">Tiến độ hình ảnh</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead><tbody id="tblCasesBodyContainer"></tbody></table></div></div>
  </section>`;
}

function updateInspectionSummary(total,pending,completed) {
  const counts={all:total,pending,completed};
  document.querySelectorAll('[data-inspection-filter]').forEach(card=>{
    const key=card.dataset.inspectionFilter,count=counts[key],share=total?Math.round(count/total*100):0;
    card.setAttribute('aria-pressed',String(activeCaseFilter===key));
    card.setAttribute('aria-label',card.querySelector('.claims-metric-label').textContent+': '+count+' hồ sơ');
    card.querySelector('[data-inspection-share]').textContent=share+'%';card.querySelector('.claims-metric-track i').style.setProperty('--metric-progress',share+'%');
  });
  const select=document.getElementById('inspectionStatusFilter');
  if(select){
    const labels={all:'Tất cả trạng thái',pending:'Đang chờ Garage',completed:'Đã có kết quả'};
    [...select.options].forEach(option=>{const text=labels[option.value]+' · '+counts[option.value];if(option.textContent!==text)option.textContent=text;});
    select.value=activeCaseFilter;const widget=adminSelectWidgets.get(select);if(widget)refreshAdminSelect(widget);
  }
  const clear=document.querySelector('.inspection-register .transfer-search-clear');if(clear)clear.hidden=!document.getElementById('caseSearchInput')?.value;
}

function renderInspectionPages(page,totalPages) {
  const pages=new Set([1,totalPages]);
  for(let p=Math.max(1,Math.min(page-1,totalPages-2));p<=Math.min(totalPages,Math.max(page+1,3));p++)pages.add(p);
  let previous=0,buttons='';
  [...pages].sort((a,b)=>a-b).forEach(p=>{if(p-previous>1)buttons+='<span class="transfer-page-gap" aria-hidden="true">…</span>';buttons+=`<button type="button" class="transfer-page" aria-label="Trang ${p}" ${p===page?'aria-current="page"':''} onclick="navigateInspectionPage(${p})">${p}</button>`;previous=p;});
  return `<nav class="transfer-register-pages" aria-label="Phân trang hồ sơ giám định"><button type="button" class="transfer-page" aria-label="Trang trước" ${page===1?'disabled':''} onclick="navigateInspectionPage(${page-1})">${transferRegisterIcon('left')}</button>${buttons}<button type="button" class="transfer-page" aria-label="Trang sau" ${page===totalPages?'disabled':''} onclick="navigateInspectionPage(${page+1})">${transferRegisterIcon('right')}</button></nav>`;
}

function renderInspectionRows(entries) {
  const user=firebase.auth().currentUser,isAdmin=String(activeUserProfile?.role||'').trim().toLowerCase()==='admin';
  return entries.map(([key,item])=>{
    const jsKey=escapeAttributeData(JSON.stringify(key)),plate=String(item.bienSo||'Chưa có biển số'),jsPlate=escapeAttributeData(JSON.stringify(plate));
    const done=item.trangThai===STATUS_COMPLETED,canManage=isAdmin||item.nguoiTao?.uid===user?.uid;
    const date=formatCaseTimestamp(item.createdAt);
    const required=Array.isArray(item.hangMucYeuCauAnh)?item.hangMucYeuCauAnh:Object.values(item.hangMucYeuCauAnh||{}),complete=required.filter(row=>normalizeEvidenceImageUrls(row).length>0).length;
    const full=required.length>0&&complete===required.length,percent=required.length?Math.round(complete/required.length*100):0;
    const action=(label,icon,handler,tone='',text=true)=>`<button type="button" class="inspection-action ${tone}" title="${label}" aria-label="${label} · ${escapeAttributeData(plate)}" onclick="event.stopPropagation();${handler}">${transferRegisterIcon(icon)}${text?`<span class="inspection-action-text">${label}</span>`:''}</button>`;
    return `<tr class="inspection-row" data-case-id="${escapeAttributeData(key)}" onclick="navigateToCase(${jsKey},'result')">
      <td><div class="inspection-vehicle"><span class="inspection-avatar" aria-hidden="true">${escapeHtmlOutput(plate.replace(/[^A-Za-z0-9]/g,'').slice(0,2).toUpperCase()||'HS')}</span><div class="inspection-vehicle-copy"><div class="inspection-plate-line"><button type="button" class="inspection-plate" onclick="event.stopPropagation();navigateToCase(${jsKey},'result')">${escapeHtmlOutput(plate)}</button>${full?`<span class="inspection-evidence-complete" title="Đã có ảnh cho tất cả hạng mục" aria-label="Đã có ảnh cho tất cả hạng mục">${transferRegisterIcon('check')}</span>`:''}</div><span class="inspection-garage" title="${escapeAttributeData(item.tenGara||'Chưa xác định Garage')}">${escapeHtmlOutput(item.tenGara||'Chưa xác định Garage')}</span></div></div></td>
      <td><div class="inspection-date"><span>${escapeHtmlOutput(date.date)}</span><small>${transferRegisterIcon('clock')}${escapeHtmlOutput(date.time)}</small></div></td>
      <td><div class="inspection-evidence ${full?'inspection-evidence--complete':''}"><strong>${inspectionRegisterIcon('image')}${Number(item.soLuongAnh||0)} ảnh hiện trạng</strong><span>${required.length?`${complete} / ${required.length} hạng mục có ảnh`:'Chưa yêu cầu hạng mục ảnh'}</span><div class="inspection-evidence-track" role="progressbar" aria-label="Hạng mục đã có ảnh" aria-valuenow="${complete}" aria-valuemin="0" aria-valuemax="${required.length||1}"><i style="width:${percent}%"></i></div></div></td>
      <td><span class="transfer-status-badge transfer-status-badge--${done?'green':'amber'}">${transferRegisterIcon(done?'check':'clock')}<span>${escapeHtmlOutput(item.trangThai||STATUS_PENDING)}</span></span></td>
      <td><div class="inspection-actions">${action('Garage','open',`navigateToCase(${jsKey})`)}${canManage?action('Sửa hồ sơ','edit',`triggerEditCaseFlow(${jsKey})`,'inspection-action--edit',false):''}${action('Kết quả','check',`navigateToCase(${jsKey},'result')`,'inspection-action--result')}${canManage?action('Xóa hồ sơ','trash',`triggerDestructiveDeleteCase(${jsKey},${jsPlate})`,'inspection-action--danger',false):''}</div></td>
    </tr>`;
  }).join('');
}

function setInspectionFilter(value) {setCaseFilter(value);document.getElementById('inspectionStatusFilter')?.parentElement.querySelector('.admin-select-trigger')?.focus({preventScroll:true});}

function setInspectionPerPage(value) {setCasePerPage(Number(value));document.getElementById('inspectionPerPage')?.parentElement.querySelector('.admin-select-trigger')?.focus({preventScroll:true});}

function navigateInspectionPage(page) {setCasePage(page);document.querySelector('#casePaginationControls [aria-current="page"]')?.focus({preventScroll:true});}

function clearInspectionSearch() {clearTimeout(debounceCaseTimeout);const input=document.getElementById('caseSearchInput');if(input){input.value='';input.focus({preventScroll:true});}activeCasePage=1;executeUIRenderCasesTable();}
