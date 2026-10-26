// Thao tác nhanh cho cổng giám định Workshop: lọc theo trạng thái ảnh và nhảy tới hạng mục chưa chụp.
window.workshopStatusFilter = window.workshopStatusFilter || 'all';

function syncWorkshopFilterChips() {
  const cards = document.querySelectorAll('[data-garage-portal="active"] .evidence-request-card');
  if (!cards.length && !document.getElementById('workshopSticky')) return;
  const total = cards.length;
  let done = 0;
  cards.forEach(card => { if (card.classList.contains('is-complete')) done++; });
  const counts = {wsCountAll: total, wsCountPending: total - done, wsCountDone: done};
  Object.keys(counts).forEach(id => { const node = document.getElementById(id); if (node) node.textContent = String(counts[id]); });
  const current = window.workshopStatusFilter || 'all';
  document.querySelectorAll('[data-ws-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.wsFilter === current)));
  const next = document.querySelector('.workshop-next');
  if (next) next.disabled = total > 0 && done === total;
}

function setWorkshopStatusFilter(value) {
  window.workshopStatusFilter = ['pending', 'done'].includes(value) ? value : 'all';
  filterPortalHangMucCards(typeof portalSearchTerm === 'string' ? portalSearchTerm : '');
  syncWorkshopFilterChips();
}

function goToNextPendingWorkshopItem() {
  const cards = [...document.querySelectorAll('[data-garage-portal="active"] .evidence-request-card')];
  if (!cards.length) return;
  const target = cards.find(card => !card.classList.contains('is-complete'));
  if (!target) { if (typeof triggerToast === 'function') triggerToast('Đã có ảnh cho tất cả hạng mục. Bạn có thể bấm Gửi kết quả.'); return; }
  // Nếu mục đang bị ẩn bởi bộ lọc/tìm kiếm thì bỏ lọc để nhảy tới được.
  if (target.style.display === 'none' || target.closest('.evidence-group-section')?.style.display === 'none') {
    window.workshopStatusFilter = 'all';
    const search = document.getElementById('searchPortalHangMucInput');
    if (search) search.value = '';
    filterPortalHangMucCards('');
    syncWorkshopFilterChips();
  }
  const key = target.closest('.evidence-group-section')?.querySelector('.evidence-group-header')?.id.replace('evidenceGroupHeader_', '');
  if (key && window.sectionCollapseState && window.sectionCollapseState[key]) toggleEvidenceGroupSection(key);
  const index = Number(target.id.split('_').pop());
  if (window.cardCollapseState ? window.cardCollapseState[index] !== false : true) toggleSingleCardCollapse(index);
  const sticky = document.getElementById('workshopSticky');
  target.style.scrollMarginTop = ((sticky ? sticky.offsetHeight : 0) + 12) + 'px';
  target.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
  target.classList.add('is-spotlight');
  setTimeout(() => target.classList.remove('is-spotlight'), 1800);
}
