


function workshopIcon(name) {
  const paths={search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',layers:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',chevron:'<path d="m6 9 6 6 6-6"/>',collapse:'<path d="m8 4 4 4 4-4M8 20l4-4 4 4"/>',expand:'<path d="m8 8 4-4 4 4M8 16l4 4 4-4"/>',save:'<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z"/><path d="M7 3v6h10V3M7 21v-8h10v8"/>',check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',car:'<path d="m5 6-2 6v6h2m14-12 2 6v6h-2M5 6h14M3 12h18M7 18h10M7 12v6M17 12v6"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>'};
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.layers}</svg>`;
}

function renderWorkshopToolbar(definitions) {
  const count=definitions.filter(def=>def.key==='damages'||localActiveRequestedItems.some(item=>getCategoryGroupInfo(item.tenHangMuc,!!item.taoBoiGara).key===def.key)).length;
  return `<div class="workshop-toolbar"><div class="workshop-toolbar-heading"><span class="workshop-toolbar-icon">${workshopIcon('layers')}</span><div><h2>Hạng mục giám định</h2><p>${count} nhóm <span>·</span> ${localActiveRequestedItems.length} hạng mục</p></div></div><div class="workshop-disclosure-actions" role="group" aria-label="Hiển thị các nhóm hạng mục"><button type="button" onclick="toggleAllSections(false)">${workshopIcon('collapse')}Thu gọn</button><button type="button" onclick="toggleAllSections(true)">${workshopIcon('expand')}Mở rộng</button></div></div><div class="workshop-search">${workshopIcon('search')}<input type="search" id="searchPortalHangMucInput" value="${escapeAttributeData(portalSearchTerm||'')}" placeholder="Tìm hạng mục cần chụp ảnh…" aria-label="Tìm hạng mục giám định" autocomplete="off" oninput="filterPortalHangMucCards(this.value)"></div>`;
}

function renderWorkshopGroupHeader(def,done,total,collapsed) {
  const labels={documents:'Hồ sơ pháp lý & giấy tờ xe',overall:'Hình ảnh tổng thể xe',damages:'Giám định tổn thất & báo giá'};
  const notes={documents:'Giấy tờ xe, giấy phép lái xe và hồ sơ bảo hiểm.',overall:'Ảnh tổng thể, tem đăng kiểm và số khung.',damages:'Chọn phương án xử lý và bổ sung ảnh tại xưởng.'};
  return `<button type="button" id="evidenceGroupHeader_${def.key}" class="evidence-group-header workshop-group-header" aria-expanded="${!collapsed}" aria-controls="evidenceGroupBody_${def.key}" onclick="toggleEvidenceGroupSection('${def.key}')"><span class="workshop-group-icon">${def.iconSvg}</span><span class="workshop-group-copy"><span class="workshop-group-meta"><span>Nhóm ${def.indexNum}</span><span class="workshop-group-count ${done===total&&total?'is-complete':''}" aria-label="${done} trên ${total} hạng mục có ảnh">${done}<span>/</span>${total}</span></span><span class="workshop-group-title">${labels[def.key]}</span><span class="workshop-group-note">${notes[def.key]}</span></span><span id="evidenceGroupChevron_${def.key}" class="workshop-chevron">${workshopIcon('chevron')}</span></button>`;
}

function renderWorkshopCardHeader(item,index,urls,canDelete,collapsed) {
  const key=getCategoryGroupInfo(item.tenHangMuc,!!item.taoBoiGara).key;
  const label=item.taoBoiGara?'Camera bắt buộc':{documents:'Giấy tờ xe',overall:'Ảnh tổng thể',damages:'Hạng mục tổn thất'}[key];
  return `<div class="evidence-request-head workshop-card-head" role="button" tabindex="0" aria-expanded="${!collapsed}" aria-controls="evidenceCardBody_${index}" onclick="toggleSingleCardCollapse(${index})" onkeydown="if(event.target===this&&(event.key==='Enter'||event.key===' ')){event.preventDefault();toggleSingleCardCollapse(${index});}"><div class="workshop-card-meta"><span class="workshop-card-identity"><span class="evidence-request-number">${String(index+1).padStart(2,'0')}</span><span class="workshop-item-category ${item.taoBoiGara?'workshop-camera-required':''}">${label}</span></span><span class="workshop-card-state"><span id="evidenceStatus_${index}" class="evidence-request-status badge-status ${urls.length?'completed':'pending'}">${urls.length?`${urls.length} ảnh đã lưu`:'Chưa có ảnh'}</span>${canDelete?`<button type="button" class="workshop-delete-item" aria-label="Xóa hạng mục ${escapeAttributeData(item.tenHangMuc||'')}" title="Xóa hạng mục" onclick="event.stopPropagation();triggerRemoveGarageCustomItem(${index})">${SVGS.TRASH}</button>`:''}<span id="evidenceCardChevron_${index}" class="workshop-chevron">${workshopIcon('chevron')}</span></span></div><h3>${escapeHtmlOutput(item.tenHangMuc||`Hạng mục ${index+1}`)}</h3></div>`;
}

function renderWorkshopHero(node,themeIcon) {
  return `<header class="portal-hero-banner workshop-hero"><div class="workshop-hero-top"><span class="workshop-eyebrow"><i></i>Cổng giám định Workshop</span><button type="button" class="workshop-theme theme-toggle-btn-node" title="Chuyển đổi giao diện Sáng/Tối" aria-label="Chuyển đổi giao diện Sáng/Tối" onclick="toggleTheme()">${themeIcon}</button></div><h1>Khai báo phương án xử lý<br class="workshop-mobile-break"> & giám định tại xưởng</h1><div class="workshop-vehicle"><span class="workshop-plate">${workshopIcon('car')}${escapeHtmlOutput(node.bienSo||'N/A')}</span><span class="workshop-garage">${escapeHtmlOutput(node.tenGara||'N/A')}</span></div><div class="workshop-progress-summary"><span>Đã ghi tên <strong id="garageHeaderNoteCounter">00/00</strong></span><span>Hạng mục có ảnh <strong id="garageHeaderEvidenceCounter">00/00</strong></span></div><div class="workshop-progress-line"><div class="workshop-progress-track"><div id="garageProgressFill"></div></div><span id="garageProgressPercent" class="garage-progress-percent">0%</span></div></header>`;
}

function renderWorkshopBottomBar() {
  return `<div class="mobile-bottom-bar workshop-bottom-bar" aria-label="Lưu và gửi hồ sơ"><div class="mobile-bottom-bar-info"><span class="workshop-progress-label">Tiến độ</span><span id="mobileBottomBarProgressPercent" class="mobile-bottom-bar-percentage" aria-live="polite">0%</span></div><div class="mobile-bottom-bar-actions"><button type="button" id="btnMobileDraftGarageResponse" class="btn-premium btn-secondary workshop-draft">${workshopIcon('save')}<span>Lưu nháp</span></button><button type="button" id="btnMobileSubmitGarageResponse" class="btn-premium workshop-submit">${workshopIcon('check')}<span>Gửi kết quả</span></button></div></div>`;
}

function syncWorkshopDisclosures() {
  document.querySelectorAll('[data-garage-portal="active"] [aria-controls^="evidence"]').forEach(header=>{
    const body=document.getElementById(header.getAttribute('aria-controls'));
    header.setAttribute('aria-expanded',String(!!body&&body.style.display!=='none'&&!body.classList.contains('is-hidden')));
  });
  const groupHeaders=[...document.querySelectorAll('.workshop-group-header')],cardHeaders=[...document.querySelectorAll('.workshop-card-head')];
  document.querySelectorAll('.workshop-disclosure-actions button').forEach((button,index)=>{
    const all=groupHeaders.length>0&&[...groupHeaders,...cardHeaders].every(header=>header.getAttribute('aria-expanded')===String(index===1));
    button.setAttribute('aria-pressed',String(all));
  });
}
