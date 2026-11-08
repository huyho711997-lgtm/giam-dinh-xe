// Trang báo cáo "Hồ sơ tồn cần xử lý" (Báo cáo & thống kê GĐV): cảnh báo hồ sơ tồn quá hạn / sắp quá hạn và việc cần xử lý theo từng GĐV.
// Dữ liệu lấy từ hồ sơ bồi thường trong hệ thống (pending_claims), cùng phạm vi Zone/GĐV với báo cáo KPI (dùng chung Zone BT map đã gán).
// Phần tính nằm ở kpi-zone-worklist.js (hàm thuần, có test); file này chỉ vẽ giao diện và xuất Excel.
const BacklogWatchPage = (() => {
  const K = KpiZoneCalc, W = KpiWorklist;
  const XLSX_SRC = 'js/vendor/xlsx-js-style-1.2.0.bundle.js?v=20261031-kpi-4';
  const PREF_KEY = 'kpiBacklogWatch:v1', ZONE_KEY = 'kpiZoneBtMap:v1';
  const PAGE = 100;
  const LEVEL_TABS = [{key: 'todo', label: 'Cần xử lý'}, {key: 'over', label: 'Quá hạn'}, {key: 'soon', label: 'Sắp quá hạn'}, {key: 'ok', label: 'Trong hạn'}, {key: 'all', label: 'Tất cả'}];
  const SORTS = [{key: 'age', label: 'Tuổi hồ sơ giảm dần'}, {key: 'age_asc', label: 'Tuổi hồ sơ tăng dần'}, {key: 'damage', label: 'Ước thiệt hại giảm dần'}, {key: 'id', label: 'Số hồ sơ A → Z'}];

  const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const plain = text => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
  const int = K.fmtInt;

  if (typeof SharedFormsControls !== 'undefined' && SharedFormsControls.registerIcons) {
    SharedFormsControls.registerIcons({
      'bw-alert': '<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.2M12 17v.01"/>',
      'bw-hourglass': '<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/>',
      'bw-users': '<circle cx="9" cy="8" r="3.4"/><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0M16 5.2a3.2 3.2 0 0 1 0 6M18 14.4a6 6 0 0 1 3.2 5.6"/>',
      'bw-bell': '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.6 2H4.4zM10 21h4"/>',
      'bw-play': '<path d="M7 4.5v15l12-7.5z"/>',
      'bw-stack': '<path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5"/>'
    });
  }
  const icon = name => (typeof SharedFormsControls !== 'undefined' ? SharedFormsControls.icon(name) : '');

  let host = null, prep = null, data = null, syncing = false, searchTimer = 0;
  const ui = {gdv: '', status: '', sort: 'age', q: '', shown: PAGE};
  const loadJson = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v && typeof v === 'object' ? v : fallback; } catch (_) { return fallback; } };
  const saved = loadJson(PREF_KEY, {});
  const prefs = {limit: W.cleanLimit(saved.limit), level: LEVEL_TABS.some(t => t.key === saved.level) ? saved.level : 'todo'};
  const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (_) { /* trình duyệt chặn lưu: vẫn dùng trong phiên */ } };

  // ----- Thư viện xuất xlsx (nằm trong thư mục dự án, nạp khi cần) -----
  let xlsxPromise = null;
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    xlsxPromise = xlsxPromise || new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = XLSX_SRC;
      script.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error('Không nạp được thư viện Excel.')));
      script.onerror = () => { xlsxPromise = null; reject(new Error('Không nạp được thư viện Excel (js/vendor).')); };
      document.head.appendChild(script);
    });
    return xlsxPromise;
  }
  const toast = (text, type) => { if (typeof triggerToast === 'function') triggerToast(text, type); };

  // ----- Dữ liệu -----
  function selectedGdvs() {
    const known = K.listGdvs(prep.records).map(x => x.name);
    const picked = known.filter(n => K.DEFAULT_GDVS.map(K.nameKey).includes(K.nameKey(n)));
    return picked.length ? picked : [...K.DEFAULT_GDVS];
  }
  function compute() {
    if (!prep || !prep.records.length) { data = null; return; }
    data = W.build(prep.records, K, {gdvs: selectedGdvs(), zoneMap: loadJson(ZONE_KEY, {}), asOf: prep.asOf, limit: prefs.limit});
    if (ui.gdv && !data.groups.some(g => g.gdv === ui.gdv)) ui.gdv = '';
    if (ui.status && !data.items.some(i => i.status === ui.status)) ui.status = '';
  }
  function loadClaims() {
    const statusMap = typeof PENDING_STATUS_MAP !== 'undefined' ? PENDING_STATUS_MAP : {};
    prep = K.fromClaims(typeof cachedPendingClaimsPayload !== 'undefined' ? cachedPendingClaimsPayload : {}, statusMap);
  }

  // Danh sách sau khi lọc theo GĐV / trạng thái / tìm kiếm (chưa lọc mức) → dùng để đếm số trên các tab mức.
  function baseList() {
    if (!data) return [];
    const q = plain(ui.q);
    return data.items.filter(x => (!ui.gdv || K.nameKey(x.gdv) === K.nameKey(ui.gdv)) && (!ui.status || x.status === ui.status) && (!q || plain(x.id).includes(q)));
  }
  const matchesLevel = (x, level) => level === 'all' || (level === 'todo' ? x.level !== 'ok' : x.level === level);
  function sorted(list) {
    const out = [...list];
    if (ui.sort === 'age_asc') out.sort((a, b) => a.days - b.days || String(a.id).localeCompare(String(b.id)));
    else if (ui.sort === 'damage') out.sort((a, b) => b.damage - a.damage || b.days - a.days);
    else if (ui.sort === 'id') out.sort((a, b) => String(a.id).localeCompare(String(b.id), 'vi', {numeric: true}));
    return out; // mặc định 'age': build() đã xếp quá hạn → sắp quá hạn → trong hạn, tuổi giảm dần
  }
  const visible = () => sorted(baseList().filter(x => matchesLevel(x, prefs.level)));

  // ----- Thành phần giao diện -----
  const initials = name => {
    const words = String(name || '').replace(/_.*$/, '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
  };
  const stack = c => {
    const total = c.total || 1;
    return '<span class="bw-stack" role="img" aria-label="' + c.over + ' quá hạn, ' + c.soon + ' sắp quá hạn, ' + c.ok + ' trong hạn">' +
      (c.over ? '<i class="o" style="flex:' + c.over / total + '"></i>' : '') + (c.soon ? '<i class="s" style="flex:' + c.soon / total + '"></i>' : '') + (c.ok ? '<i class="k" style="flex:' + c.ok / total + '"></i>' : '') + '</span>';
  };

  function boardHtml() {
    const card = (value, name, c, sub) => '<button type="button" class="bw-gcard' + (ui.gdv === value ? ' is-active' : '') + '" data-bw-gdv="' + esc(value) + '" aria-pressed="' + (ui.gdv === value) + '">' +
      '<span class="bw-gtop"><span class="bw-av">' + (value ? esc(initials(name)) : icon('bw-users')) + '</span><span class="bw-gname">' + esc(name) + '<small>' + sub + '</small></span></span>' +
      '<span class="bw-gnum"><b>' + int(c.todo) + '</b><span>việc cần xử lý</span></span>' + stack(c) +
      '<span class="bw-gmeta"><em class="o">' + int(c.over) + ' quá hạn</em><em class="s">' + int(c.soon) + ' sắp quá hạn</em>' + (c.chase ? '<em>' + int(c.chase) + ' chờ duyệt</em>' : '') + '</span></button>';
    return '<section class="sf-library bw-board"><div class="sf-library-heading"><div><span class="sf-eyebrow">PHÂN BỔ THEO GĐV</span><h2>Ai đang giữ bao nhiêu hồ sơ tồn</h2><p>Chọn một GĐV để xem danh sách việc cần xử lý của người đó.</p></div></div>' +
      '<div class="bw-board-grid">' + card('', 'Tất cả GĐV', data.counts, int(data.counts.total) + ' hồ sơ tồn') + data.groups.map(g => card(g.gdv, g.gdv, g.counts, int(g.counts.total) + ' hồ sơ tồn')).join('') + '</div></section>';
  }

  const tabsHtml = () => {
    const base = baseList(), count = key => base.filter(x => matchesLevel(x, key)).length;
    return LEVEL_TABS.map(t => '<button type="button" class="sf-source-tab bw-tab" data-bw-level="' + t.key + '" aria-pressed="' + (prefs.level === t.key) + '">' + t.label + '<span class="bw-n ' + (t.key === 'over' && count('over') ? 'o' : t.key === 'soon' && count('soon') ? 's' : '') + '">' + int(count(t.key)) + '</span></button>').join('');
  };

  function rowHtml(x) {
    const lv = W.LEVELS[x.level], over = Math.max(0, x.days - data.limit), ratio = Math.min(1, x.days / Math.max(1, data.limit));
    return '<tr class="bw-row ' + x.level + '"><td class="bw-id">' + esc(x.id) + '</td><td>' + esc(x.gdv) + '</td>' +
      '<td><span class="bw-status' + (x.chase ? ' chase' : '') + '">' + esc(x.status) + '</span></td><td class="n">' + K.fmtDate(x.open) + '</td>' +
      '<td class="n"><div class="bw-age"><b>' + x.days + '</b><small>ngày' + (over ? ' · quá ' + over : '') + '</small><span class="bw-meter"><i style="width:' + (ratio * 100).toFixed(0) + '%"></i></span></div></td>' +
      '<td><span class="bw-tag ' + x.level + '">' + lv.label + '</span></td>' +
      '<td><span class="bw-act' + (x.chase ? ' chase' : '') + '">' + icon(x.chase ? 'bw-bell' : 'bw-play') + esc(x.action) + '</span></td><td class="n">' + int(x.damage) + '</td></tr>';
  }

  function listHtml() {
    const all = visible(), rows = all.slice(0, ui.shown);
    if (!rows.length) {
      const msg = prefs.level === 'todo' || prefs.level === 'over' || prefs.level === 'soon' ? 'Không có hồ sơ nào cần xử lý theo bộ lọc hiện tại. Tốt!' : 'Không có hồ sơ khớp bộ lọc.';
      return '<tr><td colspan="8"><div class="bw-empty">' + icon('bw-stack') + '<b>' + msg + '</b></div></td></tr>';
    }
    return rows.map(rowHtml).join('');
  }

  const SHELL = () => '<div data-bw-msg></div><div data-bw-hero></div><div data-bw-board></div>' +
    '<section class="sf-library bw-list"><div class="sf-library-heading bw-list-heading"><div><span class="sf-eyebrow">CHI TIẾT HỒ SƠ</span><h2>Danh sách cần theo dõi</h2><p>Lọc theo mức cảnh báo, trạng thái và thời gian xử lý.</p></div></div><div class="sf-library-bar"><div class="sf-sources" role="group" aria-label="Mức cảnh báo" data-bw-tabs></div><span class="sf-count" data-bw-count></span></div>' +
    '<div class="sf-library-filters"><div class="sf-controls">' +
    '<label class="sf-search">' + icon('search') + '<input type="search" data-bw-q placeholder="Tìm theo số hồ sơ…" autocomplete="off" aria-label="Tìm theo số hồ sơ"></label>' +
    '<select data-bw-limit data-sf-select data-sf-label="Hạn xử lý" data-sf-description="Hồ sơ tồn quá số ngày này bị coi là quá hạn" data-sf-icon="clock">' + W.LIMITS.map(n => '<option value="' + n + '">Hạn xử lý: ' + n + ' ngày</option>').join('') + '</select>' +
    '<select data-bw-status data-sf-select data-sf-label="Trạng thái" data-sf-description="Lọc theo trạng thái hồ sơ" data-sf-icon="tag"></select>' +
    '<select data-bw-sort data-sf-select data-sf-label="Sắp xếp" data-sf-description="Thứ tự hiển thị danh sách" data-sf-icon="sort">' + SORTS.map(s => '<option value="' + s.key + '">' + s.label + '</option>').join('') + '</select>' +
    '<button type="button" class="sf-button" data-bw-export>' + icon('download') + 'Xuất Excel</button></div></div>' +
    '<div class="bw-scroll" data-bw-scroll><table class="bw-table"><thead><tr><th>Số hồ sơ</th><th>GĐV</th><th>Trạng thái</th><th class="n">Ngày mở</th><th class="n">Tuổi hồ sơ</th><th>Mức cảnh báo</th><th>Việc cần làm</th><th class="n">Ước thiệt hại</th></tr></thead><tbody data-bw-body></tbody></table></div>' +
    '<div class="bw-more" data-bw-more hidden></div><p class="bw-note" data-bw-note></p></section>';

  // ----- Vẽ -----
  const slot = name => host.querySelector('[data-bw-' + name + ']');
  function setSelect(el, value) { syncing = true; el.value = value; el.dispatchEvent(new Event('change', {bubbles: true})); syncing = false; }
  function paintControls() {
    const statuses = [...new Set(data.items.map(i => i.status))].sort((a, b) => a.localeCompare(b, 'vi'));
    const st = slot('status');
    st.innerHTML = '<option value="">Trạng thái: Tất cả</option>' + statuses.map(s => '<option value="' + esc(s) + '">' + esc(s) + '</option>').join('');
    setSelect(st, ui.status); setSelect(slot('limit'), String(prefs.limit)); setSelect(slot('sort'), ui.sort);
    if (typeof SharedFormsControls !== 'undefined') SharedFormsControls.enhance(host);
  }
  function paintList() {
    const all = visible();
    slot('tabs').innerHTML = tabsHtml();
    slot('body').innerHTML = listHtml();
    slot('count').textContent = int(all.length) + ' hồ sơ';
    const more = slot('more'), left = all.length - ui.shown;
    more.hidden = left <= 0;
    more.innerHTML = left > 0 ? '<button type="button" class="sf-button" data-bw-more-btn>Hiện thêm ' + Math.min(PAGE, left) + ' hồ sơ <span class="bw-muted">(còn ' + int(left) + ')</span></button>' : '';
    slot('note').innerHTML = 'Chỉ gồm hồ sơ mà báo cáo KPI đang tính là <b>tồn</b> (cùng phạm vi Zone/GĐV và Zone BT map). Tuổi tính từ ngày mở hồ sơ tới ' + K.fmtDate(data.asOf) +
      '. “Sắp quá hạn” là ' + data.soonDays + ' ngày cuối trước hạn. Hồ sơ chờ PASC/GĐCT duyệt cần đôn đốc, các hồ sơ còn lại GĐV tự xử lý.';
  }
  function paintAll() {
    const msg = slot('msg');
    if (!data) {
      msg.innerHTML = ''; slot('hero').innerHTML = ''; slot('board').innerHTML = '';
      host.querySelector('.bw-list').hidden = true;
      slot('hero').innerHTML = '<div class="sf-library bw-blank"><div class="sf-empty">' + icon('bw-stack') + '<h3>Chưa có hồ sơ bồi thường</h3><p>Nhập hồ sơ từ Excel B001 ở trang Hồ sơ bồi thường để xem cảnh báo hồ sơ tồn.</p></div></div>';
      return;
    }
    host.querySelector('.bw-list').hidden = false;
    const stale = W.staleDays(data.asOf, K.parseDate(new Date()));
    msg.innerHTML = stale >= 3 ? '<div class="kz-msg warn">Dữ liệu hồ sơ đã cũ ' + stale + ' ngày (đến ' + K.fmtDate(data.asOf) + '): tuổi hồ sơ thực tế còn lớn hơn số hiển thị. Hãy nhập lại B001 mới nhất.</div>' : '';
    slot('hero').innerHTML = '';
    slot('board').innerHTML = boardHtml();
    paintControls(); paintList();
  }

  // ----- Xuất Excel -----
  async function exportExcel(button) {
    if (!data) return;
    button.disabled = true;
    try {
      const XLSX = await loadXlsx(), book = XLSX.utils.book_new(), rows = visible();
      const head = {font: {bold: true}, fill: {fgColor: {rgb: 'F3E7C9'}}, alignment: {horizontal: 'center', vertical: 'center', wrapText: true}};
      const cell = v => ({v, t: typeof v === 'number' ? 'n' : 's'});
      const sheet = (name, aoa, widths) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = widths.map(w => ({wch: w})); XLSX.utils.book_append_sheet(book, ws, name); };
      sheet('Việc cần xử lý', [[{v: 'Hồ sơ tồn cần xử lý đến ' + K.fmtDate(data.asOf) + ' · hạn ' + data.limit + ' ngày', t: 's', s: {font: {bold: true, sz: 13}}}], [],
        ['Số hồ sơ', 'GĐV', 'Trạng thái', 'Ngày mở', 'Tuổi (ngày)', 'Mức cảnh báo', 'Việc cần làm', 'Ước thiệt hại'].map(v => ({v, t: 's', s: head})),
        ...rows.map(x => [cell(x.id), cell(x.gdv), cell(x.status), cell(K.fmtDate(x.open)), cell(x.days), cell(W.LEVELS[x.level].label), cell(x.action), cell(x.damage)])], [28, 26, 20, 12, 12, 16, 30, 16]);
      sheet('Theo GĐV', [['GĐV', 'Hồ sơ tồn', 'Quá hạn', 'Sắp quá hạn', 'Trong hạn', 'Chờ duyệt (đôn đốc)'], ...data.groups.map(g => [g.gdv, g.counts.total, g.counts.over, g.counts.soon, g.counts.ok, g.counts.chase]),
        ['Tổng', data.counts.total, data.counts.over, data.counts.soon, data.counts.ok, data.counts.chase]], [28, 12, 12, 14, 12, 20]);
      const file = 'ho-so-ton-can-xu-ly-' + K.fmtDate(data.asOf).replace(/\//g, '-') + '.xlsx';
      XLSX.writeFile(book, file); toast('Đã xuất ' + file + ' (' + rows.length + ' hồ sơ)', 'success');
    } catch (error) { console.error(error); toast('Không xuất được Excel: ' + (error && error.message || 'lỗi không xác định'), 'error'); }
    finally { button.disabled = false; }
  }

  // ----- Vòng đời -----
  function mount(container) {
    leave();
    host = document.createElement('section');
    host.className = 'sf-workspace bw-workspace';
    host.setAttribute('aria-label', 'Hồ sơ tồn cần xử lý');
    host.innerHTML = SHELL();
    host.addEventListener('click', event => {
      const gdv = event.target.closest('[data-bw-gdv]');
      if (gdv) { ui.gdv = gdv.dataset.bwGdv; ui.shown = PAGE; slot('board').innerHTML = boardHtml(); paintList(); return; }
      const level = event.target.closest('[data-bw-level]');
      if (level) { prefs.level = level.dataset.bwLevel; savePrefs(); ui.shown = PAGE; paintList(); return; }
      if (event.target.closest('[data-bw-more-btn]')) { ui.shown += PAGE; paintList(); return; }
      const exp = event.target.closest('[data-bw-export]'); if (exp) exportExcel(exp);
    });
    host.addEventListener('change', event => {
      if (syncing) return;
      const el = event.target;
      if (el.matches('[data-bw-limit]')) { prefs.limit = W.cleanLimit(el.value); savePrefs(); ui.shown = PAGE; compute(); if (data) paintAll(); }
      else if (el.matches('[data-bw-status]')) { ui.status = el.value; ui.shown = PAGE; paintList(); }
      else if (el.matches('[data-bw-sort]')) { ui.sort = el.value; ui.shown = PAGE; paintList(); }
    });
    host.addEventListener('input', event => {
      if (!event.target.matches('[data-bw-q]')) return;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { ui.q = event.target.value; ui.shown = PAGE; if (host && data) paintList(); }, 120);
    });
    container.replaceChildren(host);
    refresh();
  }

  // Tính lại từ hồ sơ hiện có (gọi khi mở trang và mỗi lần danh sách hồ sơ cập nhật).
  function refresh() {
    if (!host || !host.isConnected) return;
    try { loadClaims(); compute(); } catch (error) { console.error(error); prep = null; data = null; }
    paintAll();
  }
  function leave() { clearTimeout(searchTimer); if (typeof SharedFormsControls !== 'undefined') SharedFormsControls.close(); host = null; }

  return {mount, refresh, leave};
})();
