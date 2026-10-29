// Giao diện phiên bản dữ liệu hồ sơ: xem trước khi nhập · lịch sử cập nhật · so sánh 2 file · khôi phục.
// Logic dữ liệu nằm ở ClaimImportVersions (import-versions.js). Chỉ quản trị viên.
const ClaimImportUI = (() => {
  const V = () => ClaimImportVersions;
  const rowsCache = new Map();
  let pendingImport = null, historyOverlay = null, versions = [];
  const LIMIT = 200;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
  const svg = path => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  const ICON = {
    plus:svg('<path d="M12 5v14M5 12h14"/>'), edit:svg('<path d="M4 20h4L19 9l-4-4L4 16Z"/>'), minus:svg('<path d="M5 12h14"/>'),
    equal:svg('<path d="M5 9h14M5 15h14"/>'), lock:svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    history:svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>'), close:svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    compare:svg('<path d="M8 3v18M16 3v18"/><path d="m4 7 4-4 4 4M12 17l4 4 4-4"/>'), restore:svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
    back:svg('<path d="m15 18-6-6 6-6"/>'), file:svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'),
    search:svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'), alert:svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v5m0 3h.01"/>'), arrow:svg('<path d="M5 12h14m-5-5 5 5-5 5"/>')
  };
  const statusLabel = value => (typeof PENDING_STATUS_MAP !== 'undefined' && PENDING_STATUS_MAP[value]?.label) || value;
  // Trường tiền: hiển thị có dấu chấm phân cách (7.500.000) khi giá trị là số thuần.
  const MONEY = /^(soTien|duPhong|ttbt|pascSoTien|uocThietHai|chiPhi|giaTriXe|phiBh|tongBoiThuong|thuDoiDongBhSoTien|dongBhFollowSoTien)/;
  const money = text => { const digits = String(text).replace(/[.,\s₫đ]/g,''); return /^\d{4,}$/.test(digits) ? Number(digits).toLocaleString('vi-VN') : String(text); };
  const show = (field, value) => value === '' || value === undefined || value === null ? '∅ trống' : field === 'trangThai' ? statusLabel(value) : MONEY.test(field) ? money(value) : String(value);
  const when = time => time ? new Date(time).toLocaleString('vi-VN', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '—';
  const toast = (message, type = 'success') => typeof triggerToast === 'function' ? triggerToast(message, type) : alert(message);
  const title = data => data?.soHoSoBoiThuong || data?.maVuTonThat || data?.bienSo || '—';
  const subtitle = data => [data?.bienSo, data?.khachHang, data?.trangThai ? statusLabel(data.trangThai) : ''].filter(Boolean).join(' · ');

  function guard() {
    if (V().isAdmin()) return true;
    toast('Chỉ quản trị viên được dùng chức năng cập nhật và phiên bản dữ liệu hồ sơ.', 'error');
    return false;
  }
  async function rowsOf(id) {
    if (!id) return null;
    if (!rowsCache.has(id)) rowsCache.set(id, V().blob(id, 'rows').catch(error => { rowsCache.delete(id); throw error; }));
    return rowsCache.get(id);
  }

  function stats(items) {
    return '<div class="cim-stats">' + items.map(([kind, iconName, label, value, hint]) =>
      '<div class="cim-stat is-' + kind + '"><span class="cim-stat-icon">' + ICON[iconName] + '</span><span><strong>' + Number(value || 0).toLocaleString('vi-VN') + '</strong><small>' + label + '</small>' + (hint ? '<em>' + hint + '</em>' : '') + '</span></div>').join('') + '</div>';
  }
  // Trường phụ được ghi kèm (tên gara, ngày tổn thất/duyệt trùng ngày VTT) – không lặp lại khi hiển thị.
  const MIRRORS = new Set(['tenGara','ngayTonThat','ngayDuyetBT']);
  function changeLines(all, limit = 4) {
    const changes = all.filter(change => !MIRRORS.has(change.field));
    const shown = changes.slice(0, limit).map(change => '<li><b>' + esc(V().label(change.field)) + '</b><span class="cim-from">' + esc(show(change.field, change.from)) + '</span>' + ICON.arrow + '<span class="cim-to">' + esc(show(change.field, change.to)) + '</span></li>').join('');
    return '<ul class="cim-changes">' + shown + (changes.length > limit ? '<li class="cim-more">+ ' + (changes.length - limit) + ' trường khác</li>' : '') + '</ul>';
  }
  function itemList(items, render, empty) {
    if (!items.length) return '<p class="cim-empty">' + empty + '</p>';
    return '<ol class="cim-list">' + items.slice(0, LIMIT).map(render).join('') + (items.length > LIMIT ? '<li class="cim-more">… và ' + (items.length - LIMIT).toLocaleString('vi-VN') + ' hồ sơ khác</li>' : '') + '</ol>';
  }
  function tabs(id, panes) {
    const first = panes.find(pane => pane.count) || panes[0];
    return '<div class="cim-tabs" role="tablist">' + panes.map(pane => '<button type="button" role="tab" class="cim-tab" data-cim-tab="' + id + ':' + pane.key + '" aria-selected="' + (pane === first) + '">' + pane.label + '<em>' + pane.count.toLocaleString('vi-VN') + '</em></button>').join('') + '</div>'
      + panes.map(pane => '<div class="cim-tabpane" data-cim-pane="' + id + ':' + pane.key + '"' + (pane === first ? '' : ' hidden') + '>' + pane.html + '</div>').join('');
  }
  function bindTabs(root) {
    root.addEventListener('click', event => {
      const tab = event.target.closest('[data-cim-tab]'); if (!tab) return;
      const [group] = tab.dataset.cimTab.split(':');
      root.querySelectorAll('[data-cim-tab^="' + group + ':"]').forEach(other => other.setAttribute('aria-selected', String(other === tab)));
      root.querySelectorAll('[data-cim-pane^="' + group + ':"]').forEach(pane => { pane.hidden = pane.dataset.cimPane !== tab.dataset.cimTab; });
    });
  }

  // ---- Xem trước khi nhập ----------------------------------------------------------------------
  async function renderPreview(parsedRows, fileName) {
    const box = document.getElementById('excelPreviewContainer'), submit = document.getElementById('btnSubmitImportExcel');
    if (!box) return;
    pendingImport = null; submit.disabled = true;
    box.style.display = 'block';
    box.innerHTML = '<div class="cim-loading" role="status"><span class="cim-spinner"></span>Đang đối chiếu với dữ liệu hiện tại…</div>';
    try {
      const file = V().rowsFromFile(parsedRows);
      const history = await V().list();
      const previous = history[0] ? await rowsOf(history[0].id) : null;
      const claims = typeof cachedPendingClaimsPayload !== 'undefined' ? cachedPendingClaimsPayload : {};
      const planned = V().plan(claims, file, previous);
      pendingImport = {file, fileName};
      const s = planned.summary;
      document.getElementById('lblSubmitCount').textContent = s.total.toLocaleString('vi-VN');
      submit.disabled = !s.total;
      const notes = [];
      if (planned.duplicates) notes.push(planned.duplicates + ' dòng trùng khóa hồ sơ – dùng dòng cuối cùng trong file.');
      if (planned.skipped) notes.push(planned.skipped + ' dòng không có Số HSBT, Mã VTT hoặc Biển số – bỏ qua.');
      if (s.removed) notes.push(s.removed + ' hồ sơ không còn trong file sẽ được gỡ khỏi danh sách. Có thể khôi phục từ Lịch sử cập nhật.');
      box.innerHTML = '<div class="cim-file"><span class="cim-file-icon">' + ICON.file + '</span><div><strong>' + esc(fileName || 'Tệp Excel') + '</strong><small>' + s.total.toLocaleString('vi-VN') + ' hồ sơ trong file' + (history[0] ? ' · so với lần cập nhật ' + when(history[0].createdAt) : ' · lần cập nhật đầu tiên có lưu phiên bản') + '</small></div></div>'
        + stats([['add','plus','Thêm mới',s.added],['change','edit','Thay đổi',s.changed],['remove','minus','Gỡ khỏi danh sách',s.removed],['same','equal','Không đổi',s.unchanged],['keep','lock','Giữ nguyên',s.kept,'tạo trong ứng dụng']])
        + (notes.length ? '<div class="cim-note">' + ICON.alert + '<div>' + notes.map(text => '<p>' + esc(text) + '</p>').join('') + '</div></div>' : '')
        + tabs('pv', [
          {key:'changed', label:'Thay đổi', count:s.changed, html:itemList(planned.changed.filter(item => !item.silent), item => '<li><div class="cim-item-head"><strong>' + esc(title(item.claim)) + '</strong><small>' + esc(subtitle(item.claim)) + '</small><span class="cim-count">' + item.changes.filter(change => !MIRRORS.has(change.field)).length + ' trường</span></div>' + changeLines(item.changes) + '</li>', 'Không có hồ sơ nào thay đổi.')},
          {key:'added', label:'Thêm mới', count:s.added, html:itemList(planned.added, item => '<li><div class="cim-item-head"><strong>' + esc(title(item.data)) + '</strong><small>' + esc(subtitle(item.data)) + '</small></div></li>', 'Không có hồ sơ mới.')},
          {key:'removed', label:'Gỡ khỏi danh sách', count:s.removed, html:itemList(planned.removed, item => '<li class="is-removed"><div class="cim-item-head"><strong>' + esc(title(item.claim)) + '</strong><small>' + esc(subtitle(item.claim)) + '</small></div></li>', 'Không có hồ sơ nào bị gỡ.')},
          {key:'kept', label:'Giữ nguyên', count:s.kept, html:'<p class="cim-hint">Hồ sơ tạo trong ứng dụng, chưa có Số HSBT và chưa từng có trong file: không bị thay đổi hoặc gỡ.</p>' + itemList(planned.kept, item => '<li><div class="cim-item-head"><strong>' + esc(title(item.claim)) + '</strong><small>' + esc(subtitle(item.claim)) + '</small></div></li>', 'Không có.')}
        ]);
      bindTabs(box);
    } catch (error) {
      box.innerHTML = '<div class="cim-note is-error">' + ICON.alert + '<div><p>' + esc(error.message) + '</p></div></div>';
    }
  }
  async function applyPending(progress) {
    if (!guard() || !pendingImport) return null;
    const {file, fileName} = pendingImport;
    pendingImport = null;
    const result = await V().apply(file, {fileName, onProgress:progress});
    rowsCache.set(result.entry.id, Promise.resolve(file.rows));
    return result;
  }

  // ---- Lịch sử cập nhật ------------------------------------------------------------------------
  function closeHistory() { historyOverlay?.remove(); historyOverlay = null; document.removeEventListener('keydown', escClose); }
  function escClose(event) { if (event.key === 'Escape' && historyOverlay && !document.querySelector('dialog[open]')) { event.preventDefault(); closeHistory(); } }
  function shell(content, heading, sub, back) {
    return '<section class="cim-panel cim-history" role="dialog" aria-modal="true" aria-labelledby="cimHistoryTitle"><header class="cim-head">'
      + (back ? '<button type="button" class="cim-icon-btn" data-cim-back aria-label="Quay lại lịch sử" title="Quay lại">' + ICON.back + '</button>' : '<span class="cim-emblem" aria-hidden="true">' + ICON.history + '</span>')
      + '<div><small>DỮ LIỆU HỒ SƠ · QUẢN TRỊ VIÊN</small><h3 id="cimHistoryTitle">' + heading + '</h3><p>' + sub + '</p></div><button type="button" class="cim-icon-btn" data-cim-close aria-label="Đóng" title="Đóng (Esc)">' + ICON.close + '</button></header><div class="cim-body">' + content + '</div></section>';
  }
  function versionLabel(item) { return (item.kind === 'restore' ? 'Khôi phục' : 'Nhập file') + ' · ' + when(item.createdAt); }
  async function openHistory() {
    if (!guard()) return;
    closeHistory();
    historyOverlay = document.createElement('div');
    historyOverlay.className = 'p-modal-overlay cim-overlay cim-history-overlay';
    historyOverlay.style.display = 'grid';
    historyOverlay.innerHTML = shell('<div class="cim-loading" role="status"><span class="cim-spinner"></span>Đang tải lịch sử…</div>', 'Lịch sử cập nhật dữ liệu', 'Mỗi lần nhập file hoặc khôi phục đều được lưu thành một phiên bản.');
    document.body.append(historyOverlay);
    document.addEventListener('keydown', escClose);
    historyOverlay.addEventListener('click', onHistoryClick);
    bindTabs(historyOverlay);
    await renderHistory();
  }
  async function renderHistory() {
    if (!historyOverlay) return;
    try { versions = await V().list(); }
    catch (error) { historyOverlay.querySelector('.cim-body').innerHTML = '<div class="cim-note is-error">' + ICON.alert + '<div><p>' + esc(error.message) + '</p><p>Kiểm tra quyền Firebase tại claim_import_history (xem firebase/claim-imports.rules.json).</p></div></div>'; return; }
    const options = versions.map(item => '<option value="' + esc(item.id) + '">' + esc(versionLabel(item) + ' — ' + (item.fileName || '')) + '</option>').join('');
    const body = !versions.length
      ? '<div class="cim-empty-state">' + ICON.history + '<strong>Chưa có phiên bản nào</strong><p>Lần nhập file Excel tiếp theo sẽ tự lưu phiên bản đầu tiên kèm bản sao lưu dữ liệu hiện tại.</p></div>'
      : '<div class="cim-compare-bar"><span>' + ICON.compare + 'So sánh hai file</span><label><small>Bản cũ</small><select data-cim-a data-sf-select data-sf-menu-fit data-sf-label="Bản cũ" data-sf-description="Chọn phiên bản làm mốc để so sánh" data-sf-icon="clock">' + options + '</select></label>' + ICON.arrow + '<label><small>Bản mới</small><select data-cim-b data-sf-select data-sf-menu-fit data-sf-label="Bản mới" data-sf-description="Chọn phiên bản mới hơn để so sánh" data-sf-icon="clock">' + options + '</select></label><button type="button" class="cim-btn" data-cim-compare-selected>So sánh</button></div>'
        + '<ol class="cim-timeline">' + versions.map((item, index) => {
          const s = item.summary || {}, current = index === 0;
          const chips = item.kind === 'restore' ? '<span class="cim-chip">' + (s.total || 0).toLocaleString('vi-VN') + ' hồ sơ sau khôi phục</span>'
            : ['add:+' + (s.added || 0) + ' mới', 'change:~' + (s.changed || 0) + ' thay đổi', 'remove:−' + (s.removed || 0) + ' gỡ', 'same:' + (s.total || 0).toLocaleString('vi-VN') + ' hồ sơ'].map(text => { const [kind, label] = text.split(/:(.*)/); return '<span class="cim-chip is-' + kind + '">' + label + '</span>'; }).join('');
          const canDiff = item.kind !== 'restore';
          return '<li class="cim-version' + (current ? ' is-current' : '') + (item.kind === 'restore' ? ' is-restore' : '') + '"><span class="cim-dot" aria-hidden="true"></span><div class="cim-version-main">'
            + '<div class="cim-version-head"><strong>' + esc(item.fileName || 'Tệp Excel') + '</strong>' + (current ? '<span class="cim-badge">Đang dùng</span>' : '') + (item.kind === 'restore' ? '<span class="cim-badge is-muted">Khôi phục</span>' : '') + '</div>'
            + '<small>' + when(item.createdAt) + ' · ' + esc(item.createdBy?.name || '—') + (item.storedBytes ? ' · sao lưu ' + Math.max(1, Math.round(item.storedBytes / 1024)).toLocaleString('vi-VN') + ' KB' : '') + '</small><div class="cim-chips">' + chips + '</div></div>'
            + '<div class="cim-version-actions">' + (canDiff && item.prevVersionId ? '<button type="button" class="cim-btn" data-cim-diff="' + esc(item.id) + '">' + ICON.compare + '<span>Xem thay đổi</span></button>' : '')
            + '<button type="button" class="cim-btn cim-btn--warn" data-cim-restore="' + esc(item.id) + '" title="Đưa toàn bộ danh sách hồ sơ về đúng trạng thái trước lần cập nhật này">' + ICON.restore + '<span>Khôi phục về trước lần này</span></button></div></li>';
        }).join('') + '</ol>';
    historyOverlay.innerHTML = shell(body, 'Lịch sử cập nhật dữ liệu', versions.length + ' phiên bản · Khôi phục luôn tự sao lưu dữ liệu hiện tại trước, nên có thể hoàn tác.');
    const a = historyOverlay.querySelector('[data-cim-a]'), b = historyOverlay.querySelector('[data-cim-b]');
    const imports = versions.filter(item => item.kind !== 'restore');
    if (a && b && imports.length) { b.value = imports[0].id; a.value = (imports[1] || imports[0]).id; }
    // Ô chọn dùng chung hệ thống thiết kế (có tìm kiếm, bảng chọn rộng bằng ô chọn) thay cho dropdown mặc định của trình duyệt.
    if (typeof SharedFormsControls !== 'undefined') SharedFormsControls.enhance(historyOverlay);
  }
  async function onHistoryClick(event) {
    if (event.target === historyOverlay || event.target.closest('[data-cim-close]')) { closeHistory(); return; }
    if (event.target.closest('[data-cim-back]')) { await renderHistory(); return; }
    const diff = event.target.closest('[data-cim-diff]'), restoreBtn = event.target.closest('[data-cim-restore]'), selected = event.target.closest('[data-cim-compare-selected]');
    if (diff) { const item = versions.find(v => v.id === diff.dataset.cimDiff); if (item) compare(item.prevVersionId, item.id); }
    else if (selected) {
      const a = historyOverlay.querySelector('[data-cim-a]').value, b = historyOverlay.querySelector('[data-cim-b]').value;
      if (a === b) { toast('Chọn hai phiên bản khác nhau để so sánh.', 'warning'); return; }
      const [older, newer] = [versions.find(v => v.id === a), versions.find(v => v.id === b)].sort((x, y) => x.createdAt - y.createdAt);
      compare(older.id, newer.id);
    }
    else if (restoreBtn) restore(restoreBtn.dataset.cimRestore, restoreBtn);
  }

  // ---- So sánh hai file -------------------------------------------------------------------------
  async function compare(olderId, newerId) {
    const older = versions.find(v => v.id === olderId), newer = versions.find(v => v.id === newerId);
    historyOverlay.innerHTML = shell('<div class="cim-loading" role="status"><span class="cim-spinner"></span>Đang tải dữ liệu hai phiên bản…</div>', 'So sánh dữ liệu', '', true);
    try {
      const [a, b] = await Promise.all([rowsOf(olderId), rowsOf(newerId)]);
      const d = V().diffRows(a, b);
      const top = Object.entries(d.fieldCounts).sort((x, y) => y[1] - x[1]).slice(0, 8);
      const body = '<div class="cim-versus"><div><small>Bản cũ</small><strong>' + esc(older?.fileName || '—') + '</strong><span>' + esc(older ? versionLabel(older) : '') + '</span></div>' + ICON.arrow + '<div><small>Bản mới</small><strong>' + esc(newer?.fileName || '—') + '</strong><span>' + esc(newer ? versionLabel(newer) : '') + '</span></div></div>'
        + stats([['add','plus','Thêm mới',d.added.length],['change','edit','Thay đổi',d.changed.length],['remove','minus','Không còn trong file',d.removed.length],['same','equal','Không đổi',d.unchanged]])
        + (top.length ? '<div class="cim-fields"><span>Trường thay đổi nhiều nhất</span>' + top.map(([field, count]) => '<button type="button" class="cim-chip" data-cim-field="' + esc(field) + '">' + esc(V().label(field)) + ' <em>' + count + '</em></button>').join('') + '</div>' : '')
        + '<label class="cim-search">' + ICON.search + '<input type="search" data-cim-search placeholder="Lọc theo Số HSBT, biển số, khách hàng…" aria-label="Lọc hồ sơ"></label>'
        + tabs('df', [
          {key:'changed', label:'Thay đổi', count:d.changed.length, html:itemList(d.changed, item => '<li data-cim-text="' + esc((title(item.data) + ' ' + subtitle(item.data)).toLowerCase()) + '" data-cim-fields="' + esc(item.fields.map(f => f.field).join(' ')) + '"><div class="cim-item-head"><strong>' + esc(title(item.data)) + '</strong><small>' + esc(subtitle(item.data)) + '</small><span class="cim-count">' + item.fields.length + ' trường</span></div>' + changeLines(item.fields, 6) + '</li>', 'Không có hồ sơ nào thay đổi giữa hai file.')},
          {key:'added', label:'Thêm mới', count:d.added.length, html:itemList(d.added, item => '<li data-cim-text="' + esc((title(item.data) + ' ' + subtitle(item.data)).toLowerCase()) + '"><div class="cim-item-head"><strong>' + esc(title(item.data)) + '</strong><small>' + esc(subtitle(item.data)) + '</small></div></li>', 'Không có hồ sơ mới.')},
          {key:'removed', label:'Không còn trong file', count:d.removed.length, html:itemList(d.removed, item => '<li class="is-removed" data-cim-text="' + esc((title(item.data) + ' ' + subtitle(item.data)).toLowerCase()) + '"><div class="cim-item-head"><strong>' + esc(title(item.data)) + '</strong><small>' + esc(subtitle(item.data)) + '</small></div></li>', 'Không có hồ sơ nào bị bỏ.')}
        ]);
      historyOverlay.innerHTML = shell(body, 'So sánh dữ liệu giữa hai file', 'Đối chiếu theo khóa hồ sơ (Số HSBT); hiển thị tối đa ' + LIMIT + ' hồ sơ mỗi nhóm – dùng ô lọc để tìm.', true);
      // Lọc theo từ khóa / trường
      let fieldFilter = '';
      const apply = () => {
        const text = (historyOverlay.querySelector('[data-cim-search]')?.value || '').trim().toLowerCase();
        historyOverlay.querySelectorAll('[data-cim-text]').forEach(li => { li.hidden = (text && !li.dataset.cimText.includes(text)) || (fieldFilter && li.dataset.cimFields !== undefined && !(' ' + li.dataset.cimFields + ' ').includes(' ' + fieldFilter + ' ')); });
      };
      historyOverlay.querySelector('[data-cim-search]')?.addEventListener('input', apply);
      historyOverlay.querySelectorAll('[data-cim-field]').forEach(chip => chip.addEventListener('click', () => {
        fieldFilter = fieldFilter === chip.dataset.cimField ? '' : chip.dataset.cimField;
        historyOverlay.querySelectorAll('[data-cim-field]').forEach(other => other.setAttribute('aria-pressed', String(other.dataset.cimField === fieldFilter)));
        historyOverlay.querySelector('[data-cim-tab="df:changed"]')?.click(); apply();
      }));
    } catch (error) {
      historyOverlay.innerHTML = shell('<div class="cim-note is-error">' + ICON.alert + '<div><p>' + esc(error.message) + '</p></div></div>', 'So sánh dữ liệu', '', true);
    }
  }

  // ---- Khôi phục ------------------------------------------------------------------------------
  async function restore(versionId, button) {
    if (!guard()) return;
    const item = versions.find(v => v.id === versionId); if (!item) return;
    const ok = typeof showPremiumConfirmModal === 'function' ? await showPremiumConfirmModal({
      eyebrow:'KHÔI PHỤC DỮ LIỆU HỒ SƠ', title:'Khôi phục về trước lần cập nhật này?',
      message:'Toàn bộ danh sách hồ sơ sẽ trở về đúng trạng thái ngay trước "' + (item.fileName || item.id) + '" (' + when(item.createdAt) + '). Dữ liệu hiện tại được tự động sao lưu thành một phiên bản mới nên bạn có thể hoàn tác.',
      items:['Chỉnh sửa trong ứng dụng sau thời điểm đó cũng trở về như cũ', 'Ghi chú tiến độ, tài liệu Drive, sơ đồ hiện trường lưu riêng – không bị ảnh hưởng'],
      confirmText:'Khôi phục'
    }) : confirm('Khôi phục dữ liệu về trước lần cập nhật này?');
    if (!ok) return;
    button.disabled = true;
    const progress = typeof updateBackgroundImportProgress === 'function' ? updateBackgroundImportProgress : () => {};
    try {
      progress(5, 'Đang khôi phục dữ liệu hồ sơ…');
      await V().restore(versionId, {onProgress:(percent, text) => progress(percent, text)});
      progress(100, 'Đã khôi phục.', true, false, 'Đã khôi phục dữ liệu về trước "' + (item.fileName || item.id) + '".');
      toast('Đã khôi phục dữ liệu hồ sơ. Bản trước khi khôi phục được lưu trong lịch sử.');
      await renderHistory();
      if (typeof executeUIRenderPendingClaims === 'function') executeUIRenderPendingClaims();
    } catch (error) {
      progress(100, 'Không khôi phục được.', false, true, error.message);
      toast('Không khôi phục được: ' + error.message, 'error');
      button.disabled = false;
    }
  }

  return {renderPreview, applyPending, openHistory, closeHistory, hasPending:() => !!pendingImport};
})();
function openClaimImportHistory() { ClaimImportUI.openHistory(); }
