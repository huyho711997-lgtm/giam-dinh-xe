/* Tiến độ hồ sơ tồn — theo dõi tuổi tồn, ghi chú tiến độ, hẹn xử lý, xuất Excel.
 * Dữ liệu: cachedPendingClaimsPayload (hồ sơ) + cachedPendingNotesPayload (pending_notes/{BSX|Mã HS}/history[]).
 * Giao diện dùng token --sf-* và dropdown .kz-dd* chung với trang Báo cáo KPI Zone (css/pending-notes.css). */
const PendingNotesPage = (() => {
  const TON_STATUSES = ['moi', 'cho_giam_dinh_ht', 'da_giam_dinh_ht', 'cho_gdct', 'da_gdct', 'cho_duyet_pasc', 'da_duyet_pasc', 'cho_duyet_hsbt'];
  const STALE_DAYS = 3;               // ghi chú cũ hơn số ngày này (hoặc chưa có) => "cần cập nhật"
  const DAY_MS = 86400000;
  const XLSX_SRC = 'js/vendor/xlsx-js-style-1.2.0.bundle.js?v=20261031-kpi-4';
  const AGE_BUCKETS = [
    {key: 'b1', label: '≤ 7 ngày', tone: 'ok', test: a => a <= 7},
    {key: 'b2', label: '8 – 14 ngày', tone: 'warn', test: a => a >= 8 && a <= 14},
    {key: 'b3', label: '15 – 30 ngày', tone: 'hot', test: a => a >= 15 && a <= 30},
    {key: 'over30', label: '> 30 ngày', tone: 'crit', test: a => a > 30}
  ];
  const TEMPLATES = ['Đã liên hệ khách hàng', 'Chờ khách bổ sung hồ sơ', 'Chờ garage báo giá', 'Đã gửi hồ sơ lên PASC', 'Chờ PASC duyệt', 'Hồ sơ vướng, cần hỗ trợ'];
  const SORTS = [
    {key: 'age', label: 'Tồn lâu nhất'},
    {key: 'stale', label: 'Cần cập nhật trước'},
    {key: 'note', label: 'Ghi chú mới nhất'},
    {key: 'due', label: 'Hẹn gần nhất'},
    {key: 'new', label: 'Mới mở nhất'}
  ];
  const PER_PAGE = [10, 20, 50, 100];
  const state = {q: '', status: 'all', gdv: 'all', quick: 'all', sort: 'age', page: 1, per: 20};
  let host = null, rows = [], modal = null, ddOpen = null, searchTimer = 0, xlsxPromise = null;

  const I = {
    note: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>', user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    sort: '<path d="M3 6h13M3 12h9M3 18h5M17 10v10m0 0-3-3m3 3 3-3"/>', rows: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    chev: '<path d="m6 9 6 6 6-6"/>', check: '<path d="m5 12 5 5 9-10"/>', reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    xls: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 13l4 5M13 13l-4 5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4m0 4h.01"/>',
    list: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h8"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>', left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>', pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>'
  };
  const svg = (name, size = 16) => '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (I[name] || '') + '</svg>';
  const esc = v => (typeof escapeHtmlOutput === 'function' ? escapeHtmlOutput(v) : String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch])));
  const attr = v => esc(v);
  const plain = text => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
  const toast = (message, kind) => { if (typeof triggerToast === 'function') triggerToast(message, kind || 'success'); };
  const calc = () => (typeof KpiZoneCalc !== 'undefined' ? KpiZoneCalc : null);

  // ----- Dữ liệu -----
  const statusKey = c => String(c.trangThai || 'moi').toLowerCase();
  const gdvName = c => String(c.gdvHo || c.canBoXuLy || '').trim() || 'Chưa rõ';
  const identifierOf = c => String(c.bienSo || c.soHoSoBoiThuong || c.id || '').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
  const statusInfo = key => (typeof PENDING_STATUS_MAP !== 'undefined' && PENDING_STATUS_MAP[key]) || {label: key, bg: 'rgba(148,163,184,.14)', color: '#64748b', border: 'rgba(148,163,184,.35)'};
  const median = list => { if (!list.length) return null; const s = [...list].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };

  function todaySerial() {
    const K = calc();
    if (K) { const v = K.parseDate(new Date()); if (Number.isFinite(v)) return v; }
    return Date.now() / DAY_MS + 25569;
  }
  function openSerial(c) {
    const K = calc();
    if (K) { const v = K.parseDate(c.ngayMoHs); if (v !== null && Number.isFinite(v)) return v; }
    return Number(c.createdAt) > 1e11 ? (K ? K.parseDate(Number(c.createdAt)) : Number(c.createdAt) / DAY_MS + 25569) : null;
  }
  function notesOf(identifier) {
    const history = (typeof cachedPendingNotesPayload !== 'undefined' && cachedPendingNotesPayload[identifier] || {}).history || {};
    return Object.values(history).filter(n => n && typeof n === 'object' && n.content).sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
  }
  function ago(ms, now) {
    const d = Math.floor((now - ms) / DAY_MS);
    if (d <= 0) return 'hôm nay';
    if (d === 1) return 'hôm qua';
    return d + ' ngày trước';
  }
  function isoDate(date) { const p = n => String(n).padStart(2, '0'); return date.getFullYear() + '-' + p(date.getMonth() + 1) + '-' + p(date.getDate()); }
  function viDate(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
  const viDateTime = ms => new Date(ms).toLocaleString('vi-VN');

  function buildRows() {
    const K = calc(), today = todaySerial(), todayDay = Math.floor(today), now = Date.now();
    const me = plain(typeof activeUserProfile !== 'undefined' && activeUserProfile ? activeUserProfile.displayName : '');
    const out = [];
    for (const [key, c] of Object.entries(typeof cachedPendingClaimsPayload !== 'undefined' ? cachedPendingClaimsPayload || {} : {})) {
      if (!c || typeof c !== 'object' || !TON_STATUSES.includes(statusKey(c))) continue;
      const id = c.id || key, identifier = identifierOf({...c, id});
      const open = openSerial(c), age = open === null ? null : Math.max(0, Math.floor(today - open));
      const history = notesOf(identifier), last = history[history.length - 1] || null;
      const noteDays = last ? Math.max(0, Math.floor((now - Number(last.timestamp || 0)) / DAY_MS)) : null;
      const dueIso = last && /^\d{4}-\d{2}-\d{2}$/.test(String(last.due || '')) ? last.due : '';
      const dueSerial = dueIso && K ? K.parseDate(dueIso) : null;
      const dueIn = dueSerial !== null && Number.isFinite(dueSerial) ? Math.floor(dueSerial) - todayDay : null;
      const gdv = gdvName(c);
      out.push({
        id, identifier, c, gdv, status: statusKey(c), age, bucket: age === null ? null : AGE_BUCKETS.find(b => b.test(age)).key,
        history, last, noteDays, stale: !last || noteDays > STALE_DAYS, fresh: !!last && noteDays <= STALE_DAYS,
        dueIso, dueIn, overdue: dueIn !== null && dueIn < 0, mine: !!me && plain(gdv) === me,
        owner: typeof extractClaimOwnerName === 'function' ? extractClaimOwnerName(c) : (c.khachHang || c.tenChuXe || ''),
        openText: String(c.ngayMoHs || '').trim().split(/\s+/)[0] || ''
      });
    }
    return out;
  }

  const matchesSearch = (r, q) => !q || [r.c.bienSo, r.c.soHoSoBoiThuong, r.gdv, r.owner, r.c.moTaTonThat, r.c.hangXe, r.c.hieuXe].some(v => plain(v).includes(q));
  const quickTest = {
    all: () => true, mine: r => r.mine, over30: r => r.bucket === 'over30', b1: r => r.bucket === 'b1', b2: r => r.bucket === 'b2', b3: r => r.bucket === 'b3',
    stale: r => r.stale, overdue: r => r.overdue, fresh: r => r.fresh
  };
  function sortRows(list) {
    const by = {
      age: (a, b) => (b.age ?? -1) - (a.age ?? -1),
      stale: (a, b) => (a.last ? 1 : 0) - (b.last ? 1 : 0) || (b.noteDays ?? 0) - (a.noteDays ?? 0) || (b.age ?? -1) - (a.age ?? -1),
      note: (a, b) => Number(b.last?.timestamp || 0) - Number(a.last?.timestamp || 0),
      due: (a, b) => (a.dueIn === null ? 1e9 : a.dueIn) - (b.dueIn === null ? 1e9 : b.dueIn) || (b.age ?? -1) - (a.age ?? -1),
      new: (a, b) => (a.age ?? 1e9) - (b.age ?? 1e9)
    };
    return list.sort(by[state.sort] || by.age);
  }
  function view() {
    const q = plain(state.q);
    const scoped = rows.filter(r => (state.status === 'all' || r.status === state.status) && (state.gdv === 'all' || r.gdv === state.gdv) && matchesSearch(r, q));
    const list = sortRows(scoped.filter(quickTest[state.quick] || quickTest.all));
    return {scoped, list};
  }

  // ----- Thành phần giao diện -----
  function dd(name, icon, caption, value, options, extraClass) {
    const current = options.find(o => String(o.value) === String(value)) || options[0];
    return '<div class="kz-dd ' + (extraClass || '') + '" data-pn-dd="' + name + '"><button type="button" class="kz-dd-trigger" aria-haspopup="listbox" aria-expanded="false">' +
      '<span class="kz-dd-ic">' + svg(icon, 15) + '</span><span class="kz-dd-label"><small>' + esc(caption) + '</small> <b>' + esc(current.label) + '</b></span><span class="kz-dd-chev">' + svg('chev', 14) + '</span></button>' +
      '<div class="kz-dd-menu" role="listbox" hidden><div class="kz-dd-head">' + esc(caption) + '</div><div class="kz-dd-list">' +
      options.map(o => '<button type="button" class="kz-dd-opt' + (String(o.value) === String(value) ? ' is-selected' : '') + '" role="option" data-pn-opt="' + attr(o.value) + '"><span>' + esc(o.label) + (o.count !== undefined ? ' <small>(' + o.count + ')</small>' : '') + '</span>' + (String(o.value) === String(value) ? svg('check', 14) : '') + '</button>').join('') +
      '</div></div></div>';
  }
  function ageBadge(r) {
    if (r.age === null) return '<span class="pn-age pn-age--na">—</span>';
    const bucket = AGE_BUCKETS.find(b => b.key === r.bucket);
    return '<span class="pn-age pn-age--' + bucket.tone + '" title="Mở hồ sơ ' + attr(r.openText) + '"><i></i>' + r.age + ' ngày</span>';
  }
  function dueChip(r) {
    if (!r.dueIso) return '';
    const text = r.overdue ? 'Quá hẹn ' + (-r.dueIn) + ' ngày' : r.dueIn === 0 ? 'Hẹn hôm nay' : 'Hẹn ' + viDate(r.dueIso);
    return '<span class="pn-due ' + (r.overdue ? 'is-late' : r.dueIn === 0 ? 'is-today' : '') + '">' + svg('cal', 12) + esc(text) + '</span>';
  }
  function tags(c) {
    const out = [];
    if (c.vcx) out.push('<span class="pn-tag pn-tag--blue">VCX</span>');
    if (c.tnds) {
      out.push('<span class="pn-tag pn-tag--violet">TNDS</span>');
      const text = plain(c.loaiTonThat);
      if (/nguoi/.test(text)) out.push('<span class="pn-tag pn-tag--rose">Con người</span>');
      if (/tai san|xe|hang hoa/.test(text)) out.push('<span class="pn-tag pn-tag--green">Tài sản</span>');
    }
    return out.join('');
  }

  function renderSummary(all) {
    const ages = all.map(r => r.age).filter(a => a !== null);
    const total = all.length, over30 = all.filter(r => r.bucket === 'over30').length, stale = all.filter(r => r.stale).length, noNote = all.filter(r => !r.last).length;
    const overdue = all.filter(r => r.overdue).length, scheduled = all.filter(r => r.dueIso).length, fresh = all.filter(r => r.fresh).length;
    const pct = (n, d) => (d ? Math.round(n / d * 100) : 0) + '%';
    const card = (quick, tone, icon, label, value, unit, sub) => '<button type="button" class="pn-kpi pn-kpi--' + tone + (state.quick === quick ? ' is-active' : '') + '" data-pn-quick="' + quick + '"><span class="pn-kpi-top"><span class="pn-kpi-ic">' + svg(icon, 15) + '</span>' + esc(label) + '</span><span class="pn-kpi-val">' + value + (unit ? '<small>' + unit + '</small>' : '') + '</span><span class="pn-kpi-sub">' + sub + '</span></button>';
    return card('all', 'gold', 'list', 'Tổng hồ sơ tồn', total, 'hồ sơ', ages.length ? 'Tuổi trung vị <b>' + median(ages) + '</b> ngày · lâu nhất <b>' + Math.max(...ages) + '</b> ngày' : 'Chưa có dữ liệu ngày mở') +
      card('over30', 'rose', 'alert', 'Tồn quá 30 ngày', over30, 'hồ sơ', '<b>' + pct(over30, total) + '</b> tổng số hồ sơ tồn') +
      card('stale', 'amber', 'clock', 'Cần cập nhật', stale, 'hồ sơ', '<b>' + noNote + '</b> chưa có ghi chú · <b>' + (stale - noNote) + '</b> quá ' + STALE_DAYS + ' ngày') +
      card(overdue ? 'overdue' : 'fresh', overdue ? 'rose' : 'green', overdue ? 'cal' : 'pulse', overdue ? 'Quá hẹn xử lý' : 'Đã cập nhật gần đây', overdue || fresh, 'hồ sơ',
        overdue ? '<b>' + scheduled + '</b> hồ sơ đang có lịch hẹn' : '<b>' + pct(fresh, total) + '</b> được ghi chú trong ' + STALE_DAYS + ' ngày');
  }
  function renderAges(all) {
    const total = all.length || 1;
    const seg = AGE_BUCKETS.map(b => ({...b, n: all.filter(r => r.bucket === b.key).length}));
    const unknown = all.filter(r => r.bucket === null).length;
    return '<div class="pn-card-head"><h2>Tuổi hồ sơ tồn</h2><span>Bấm vào nhóm để lọc danh sách</span></div>' +
      '<div class="pn-stack" role="img" aria-label="Phân bố tuổi hồ sơ tồn">' + seg.filter(s => s.n).map(s => '<button type="button" class="pn-stack-seg pn-tone-' + s.tone + (state.quick === s.key ? ' is-active' : '') + '" style="flex:' + s.n + '" data-pn-quick="' + s.key + '" title="' + attr(s.label + ': ' + s.n + ' hồ sơ') + '"><span>' + s.n + '</span></button>').join('') + '</div>' +
      '<ul class="pn-legend">' + seg.map(s => '<li><button type="button" data-pn-quick="' + s.key + '" class="' + (state.quick === s.key ? 'is-active' : '') + '"><i class="pn-tone-' + s.tone + '"></i><span>' + s.label + '</span><b>' + s.n + '</b><small>' + Math.round(s.n / total * 100) + '%</small></button></li>').join('') + '</ul>' +
      '<div class="pn-sub-head">Theo trạng thái</div><div class="pn-statuses">' + TON_STATUSES.filter(k => all.some(r => r.status === k)).map(k => { const st = statusInfo(k); return '<button type="button" data-pn-status="' + k + '" class="' + (state.status === k ? 'is-active' : '') + '"><i style="background:' + st.color + '"></i>' + esc(st.label) + ' <b>' + all.filter(r => r.status === k).length + '</b></button>'; }).join('') + '</div>' +
      (unknown ? '<p class="pn-hint">' + unknown + ' hồ sơ chưa có ngày mở nên không tính tuổi.</p>' : '');
  }
  function renderGdvs(all) {
    const map = new Map();
    for (const r of all) { const g = map.get(r.gdv) || {name: r.gdv, n: 0, over30: 0, stale: 0}; g.n++; if (r.bucket === 'over30') g.over30++; if (r.stale) g.stale++; map.set(r.gdv, g); }
    const list = [...map.values()].sort((a, b) => b.n - a.n), max = Math.max(1, ...list.map(g => g.n));
    return '<div class="pn-card-head"><h2>Theo giám định viên</h2><span>Bấm tên để lọc</span></div><div class="pn-gdv-head"><span>GĐV</span><span>Tồn</span><span>&gt; 30 ngày</span><span>Cần cập nhật</span></div>' +
      '<ul class="pn-gdv">' + list.map(g => '<li><button type="button" data-pn-gdv="' + attr(g.name) + '" class="' + (state.gdv === g.name ? 'is-active' : '') + '"><span class="pn-gdv-name"><b>' + esc(g.name) + '</b><span class="pn-gdv-bar"><i style="width:' + Math.round(g.n / max * 100) + '%"></i></span></span><span class="pn-num">' + g.n + '</span><span class="pn-num ' + (g.over30 ? 'is-crit' : '') + '">' + g.over30 + '</span><span class="pn-num ' + (g.stale ? 'is-warn' : '') + '">' + g.stale + '</span></button></li>').join('') + '</ul>';
  }
  function renderChips(scoped) {
    const items = [['all', 'Tất cả'], ['mine', 'Của tôi'], ['over30', 'Quá 30 ngày'], ['stale', 'Cần cập nhật'], ['overdue', 'Quá hẹn'], ['fresh', 'Đã cập nhật']];
    const hasMine = rows.some(r => r.mine);
    const html = items.filter(([key]) => key !== 'mine' || hasMine).map(([key, label]) => '<button type="button" class="pn-chip' + (state.quick === key ? ' is-active' : '') + '" data-pn-quick="' + key + '">' + label + '<small>' + scoped.filter(quickTest[key]).length + '</small></button>').join('');
    const extra = /^b[123]$/.test(state.quick) ? '<button type="button" class="pn-chip is-active" data-pn-quick="all">' + AGE_BUCKETS.find(b => b.key === state.quick).label + ' ' + svg('close', 12) + '</button>' : '';
    return html + extra;
  }
  function renderRow(r, index) {
    const c = r.c, st = statusInfo(r.status), last = r.last;
    const note = last
      ? '<div class="pn-note-text">' + esc(last.content) + '</div><div class="pn-note-meta"><b>' + esc(last.author || '—') + '</b><span>·</span><span title="' + attr(viDateTime(Number(last.timestamp))) + '">' + ago(Number(last.timestamp), Date.now()) + '</span>' + dueChip(r) + '</div>'
      : '<div class="pn-note-empty"><i></i>Chưa có ghi chú</div>';
    return '<tr class="pn-row' + (r.stale ? ' is-stale' : '') + '" data-pn-open="' + attr(r.id) + '" tabindex="0">' +
      '<td class="pn-c-stt">' + String(index + 1).padStart(2, '0') + '</td>' +
      '<td><div class="pn-plate">' + esc(c.bienSo || '—') + '</div><div class="pn-code">' + esc(c.soHoSoBoiThuong || '—') + '</div><div class="pn-owner" title="' + attr(r.owner) + '">' + esc(r.owner || '—') + '</div></td>' +
      '<td><span class="pn-status" style="background:' + st.bg + ';color:' + st.color + ';border-color:' + st.border + '">' + esc(st.label) + '</span><div class="pn-sub">Mở ' + esc(r.openText || '—') + '</div></td>' +
      '<td>' + ageBadge(r) + '</td>' +
      '<td><div class="pn-car" title="' + attr((c.hangXe || '') + ' ' + (c.hieuXe || '')) + '">' + esc((c.hangXe || '—') + ' ' + (c.hieuXe || '')) + '</div><div class="pn-sub" title="' + attr(c.donViCapDon || '') + '">' + esc(c.donViCapDon || '—') + '</div><div class="pn-tags">' + tags(c) + '</div></td>' +
      '<td><div class="pn-damage">' + esc(c.moTaTonThat || c.nguyenNhan || '—') + '</div></td>' +
      '<td class="pn-gdv-cell">' + esc(r.gdv === 'Chưa rõ' ? '—' : r.gdv) + '</td>' +
      '<td class="pn-c-note">' + note + '</td>' +
      '<td class="pn-c-act"><button type="button" class="sf-button' + (r.stale ? ' sf-primary' : '') + '" data-pn-open-btn="' + attr(r.id) + '">' + svg('note', 14) + (last ? 'Cập nhật' : 'Ghi chú') + (r.history.length ? '<em>' + r.history.length + '</em>' : '') + '</button></td></tr>';
  }
  function pageButtons(page, pages) {
    const out = [], push = n => out.push('<button type="button" class="pn-page' + (n === page ? ' is-active' : '') + '" data-pn-page="' + n + '"' + (n === page ? ' aria-current="page"' : '') + '>' + n + '</button>');
    const set = new Set([1, pages, page - 1, page, page + 1].filter(n => n >= 1 && n <= pages));
    let prev = 0;
    for (const n of [...set].sort((a, b) => a - b)) { if (n - prev > 1) out.push('<span class="pn-gap">…</span>'); push(n); prev = n; }
    return out.join('');
  }

  // ----- Vẽ lại các vùng động (không đụng tới ô tìm kiếm / hộp thoại đang mở) -----
  function paint() {
    if (!host) return;
    const {scoped, list} = view();
    const total = list.length, pages = Math.max(1, Math.ceil(total / state.per));
    state.page = Math.min(Math.max(1, state.page), pages);
    const start = (state.page - 1) * state.per, pageRows = list.slice(start, start + state.per);
    const set = (id, html) => { const el = host.querySelector(id); if (el) el.innerHTML = html; };
    set('#pnSummary', renderSummary(rows));
    set('#pnAges', renderAges(rows));
    set('#pnGdvs', renderGdvs(rows));
    set('#pnChips', renderChips(scoped));
    const statusOptions = [{value: 'all', label: 'Tất cả trạng thái', count: rows.length}, ...TON_STATUSES.filter(k => rows.some(r => r.status === k)).map(k => ({value: k, label: statusInfo(k).label, count: rows.filter(r => r.status === k).length}))];
    const gdvs = [...new Set(rows.map(r => r.gdv))].sort((a, b) => a.localeCompare(b, 'vi'));
    if (state.gdv !== 'all' && !gdvs.includes(state.gdv)) state.gdv = 'all';
    if (state.status !== 'all' && !statusOptions.some(o => o.value === state.status)) state.status = 'all';
    const keepOpen = ddOpen; closeDd();
    set('#pnFilters', dd('status', 'filter', 'Trạng thái', state.status, statusOptions) + dd('gdv', 'user', 'GĐV', state.gdv, [{value: 'all', label: 'Tất cả GĐV'}, ...gdvs.map(g => ({value: g, label: g, count: rows.filter(r => r.gdv === g).length}))]) + dd('sort', 'sort', 'Sắp xếp', state.sort, SORTS.map(s => ({value: s.key, label: s.label}))));
    const filtered = state.q || state.status !== 'all' || state.gdv !== 'all' || state.quick !== 'all';
    host.querySelector('[data-pn-reset]').disabled = !filtered;
    host.querySelector('#pnCount').innerHTML = '<b>' + total + '</b> / ' + rows.length + ' hồ sơ';
    host.querySelector('#pnBody').innerHTML = pageRows.length ? pageRows.map((r, i) => renderRow(r, start + i)).join('')
      : '<tr><td colspan="9"><div class="pn-empty">' + svg('search', 28) + '<b>' + (rows.length ? 'Không có hồ sơ phù hợp bộ lọc' : 'Chưa có hồ sơ tồn') + '</b><span>' + (rows.length ? 'Thử bỏ bớt bộ lọc hoặc đổi từ khóa tìm kiếm.' : 'Hồ sơ tồn sẽ xuất hiện ở đây khi có dữ liệu.') + '</span>' + (rows.length && filtered ? '<button type="button" class="sf-button" data-pn-reset>Xóa bộ lọc</button>' : '') + '</div></td></tr>';
    host.querySelector('#pnPager').innerHTML = total ? '<div class="pn-pager-info">Hiển thị <b>' + (start + 1) + '–' + Math.min(start + state.per, total) + '</b> / ' + total + '</div>' +
      '<div class="pn-pager-nav"><button type="button" class="pn-page" data-pn-page="' + (state.page - 1) + '" ' + (state.page <= 1 ? 'disabled' : '') + ' aria-label="Trang trước">' + svg('left', 14) + '</button>' + pageButtons(state.page, pages) +
      '<button type="button" class="pn-page" data-pn-page="' + (state.page + 1) + '" ' + (state.page >= pages ? 'disabled' : '') + ' aria-label="Trang sau">' + svg('right', 14) + '</button></div>' +
      dd('per', 'rows', 'Mỗi trang', state.per, PER_PAGE.map(n => ({value: n, label: n + ' hồ sơ'})), 'kz-dd-sm pn-dd-up') : '';
    if (keepOpen) { const el = host.querySelector('[data-pn-dd="' + keepOpen + '"]'); if (el) openDd(el); }
    if (modal) paintModalHistory();
  }

  // ----- Dropdown (cùng kiểu với trang KPI Zone) -----
  function closeDd() {
    if (!host) return;
    host.querySelectorAll('.kz-dd.is-open').forEach(el => { el.classList.remove('is-open'); el.querySelector('.kz-dd-menu').hidden = true; el.querySelector('.kz-dd-trigger').setAttribute('aria-expanded', 'false'); });
    ddOpen = null;
  }
  function placeDd(wrap) {
    const trigger = wrap.querySelector('.kz-dd-trigger'), menu = wrap.querySelector('.kz-dd-menu'), rect = trigger.getBoundingClientRect();
    const width = Math.max(rect.width, 230);
    menu.style.width = width + 'px';
    menu.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)) + 'px';
    const room = window.innerHeight - rect.bottom - 14, above = rect.top - 14, up = room < 240 && above > room, space = Math.max(160, Math.min(360, up ? above : room));
    menu.querySelector('.kz-dd-list').style.maxHeight = (space - 44) + 'px';
    menu.style.top = up ? Math.max(8, rect.top - Math.min(menu.offsetHeight || space, space) - 6) + 'px' : (rect.bottom + 6) + 'px';
  }
  function openDd(wrap) {
    closeDd();
    wrap.classList.add('is-open');
    const menu = wrap.querySelector('.kz-dd-menu'); menu.hidden = false;
    wrap.querySelector('.kz-dd-trigger').setAttribute('aria-expanded', 'true');
    ddOpen = wrap.dataset.pnDd; placeDd(wrap);
    (menu.querySelector('.is-selected') || menu.querySelector('.kz-dd-opt'))?.focus({preventScroll: true});
  }
  const onViewportMove = () => { if (ddOpen && host) { const wrap = host.querySelector('.kz-dd.is-open'); if (wrap) placeDd(wrap); } };

  // ----- Hộp thoại ghi chú -----
  function openModal(id) {
    const r = rows.find(x => String(x.id) === String(id));
    if (!r) return;
    modal = {id: r.id, identifier: r.identifier};
    const el = host.querySelector('#pnModal');
    el.querySelector('#pnModalTitle').textContent = (r.c.bienSo || '—') + ' · ' + (r.c.soHoSoBoiThuong || '—');
    el.querySelector('#pnModalMeta').innerHTML = [statusInfo(r.status).label, r.age !== null ? 'Tồn ' + r.age + ' ngày' : '', r.gdv !== 'Chưa rõ' ? 'GĐV ' + r.gdv : '', r.owner].filter(Boolean).map(t => '<span>' + esc(t) + '</span>').join('');
    el.querySelector('#pnNoteInput').value = '';
    el.querySelector('#pnDueInput').value = '';
    el.querySelector('#pnDueInput').min = isoDate(new Date());
    el.querySelector('[data-pn-save]').disabled = false;
    paintModalHistory(true);
    el.hidden = false;
    document.body.classList.add('pn-modal-open');
    setTimeout(() => el.querySelector('#pnNoteInput').focus(), 30);
  }
  function closeModal() {
    modal = null;
    const el = host && host.querySelector('#pnModal');
    if (el) el.hidden = true;
    document.body.classList.remove('pn-modal-open');
  }
  function paintModalHistory(scrollTop) {
    const box = host.querySelector('#pnHistory'), r = rows.find(x => String(x.id) === String(modal.id));
    if (!box) return;
    const history = r ? r.history : notesOf(modal.identifier);
    box.innerHTML = history.length ? history.slice().reverse().map((n, i) => '<li class="' + (i === 0 ? 'is-latest' : '') + '"><div class="pn-h-meta"><b>' + esc(n.author || '—') + '</b><span>' + esc(viDateTime(Number(n.timestamp))) + '</span>' + (/^\d{4}-\d{2}-\d{2}$/.test(String(n.due || '')) ? '<span class="pn-due">' + svg('cal', 12) + 'Hẹn ' + viDate(n.due) + '</span>' : '') + '</div><p>' + esc(n.content) + '</p></li>').join('')
      : '<li class="pn-h-empty">Chưa có lịch sử ghi chú cho hồ sơ này.</li>';
    host.querySelector('#pnHistoryCount').textContent = history.length;
    if (scrollTop) box.scrollTop = 0;
  }
  async function saveNote() {
    if (!modal) return;
    const el = host.querySelector('#pnModal'), input = el.querySelector('#pnNoteInput'), due = el.querySelector('#pnDueInput').value;
    const content = input.value.trim();
    if (!content) { toast('Vui lòng nhập nội dung ghi chú', 'warning'); input.focus(); return; }
    const button = el.querySelector('[data-pn-save]'); button.disabled = true;
    try {
      const author = (typeof activeUserProfile !== 'undefined' && activeUserProfile && activeUserProfile.displayName) || (firebase.auth().currentUser && firebase.auth().currentUser.email) || 'Unknown';
      const note = {content, author, timestamp: Date.now()};
      if (/^\d{4}-\d{2}-\d{2}$/.test(due)) note.due = due;
      const ref = dbNodeInstance.ref('pending_notes/' + modal.identifier + '/history');
      // Giao dịch: hai người ghi chú cùng lúc không ghi đè lên nhau.
      await ref.transaction(current => { const list = Array.isArray(current) ? current.slice() : Object.values(current || {}); list.push(note); return list; });
      toast('Đã lưu ghi chú' + (note.due ? ' · hẹn ' + viDate(note.due) : ''), 'success');
      closeModal();
    } catch (error) {
      console.error(error);
      toast('Lỗi lưu ghi chú: ' + (error && error.message || 'không xác định'), 'error');
      button.disabled = false;
    }
  }

  // ----- Xuất Excel (đúng danh sách đang lọc/sắp xếp, mọi trang) -----
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    xlsxPromise = xlsxPromise || new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = XLSX_SRC;
      script.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error('Không nạp được thư viện Excel.')));
      script.onerror = () => { xlsxPromise = null; reject(new Error('Không nạp được thư viện Excel.')); };
      document.head.appendChild(script);
    });
    return xlsxPromise;
  }
  async function exportExcel(button) {
    const {list} = view();
    if (!list.length) { toast('Không có hồ sơ để xuất', 'warning'); return; }
    button.disabled = true;
    try {
      const XLSX = await loadXlsx();
      const head = ['STT', 'Biển số', 'Số HSBT', 'Chủ xe', 'Hãng xe', 'Đơn vị cấp', 'Trạng thái', 'Ngày mở HS', 'Tuổi tồn (ngày)', 'Nội dung tổn thất', 'GĐV xử lý', 'Ghi chú mới nhất', 'Người ghi', 'Thời điểm ghi', 'Hẹn xử lý', 'Cần cập nhật'];
      const body = list.map((r, i) => [i + 1, r.c.bienSo || '', r.c.soHoSoBoiThuong || '', r.owner || '', ((r.c.hangXe || '') + ' ' + (r.c.hieuXe || '')).trim(), r.c.donViCapDon || '', statusInfo(r.status).label, r.openText, r.age === null ? '' : r.age,
        r.c.moTaTonThat || r.c.nguyenNhan || '', r.gdv === 'Chưa rõ' ? '' : r.gdv, r.last ? r.last.content : '', r.last ? r.last.author || '' : '', r.last ? viDateTime(Number(r.last.timestamp)) : '', viDate(r.dueIso), r.stale ? 'Có' : 'Không']);
      const ws = XLSX.utils.aoa_to_sheet([head, ...body]);
      const border = {top: {style: 'thin', color: {rgb: 'E7E3D9'}}, bottom: {style: 'thin', color: {rgb: 'E7E3D9'}}, left: {style: 'thin', color: {rgb: 'E7E3D9'}}, right: {style: 'thin', color: {rgb: 'E7E3D9'}}};
      const wrap = new Set([3, 5, 9, 11]);
      for (let c = 0; c < head.length; c++) {
        ws[XLSX.utils.encode_cell({r: 0, c})].s = {font: {bold: true, color: {rgb: 'FFFFFF'}}, fill: {fgColor: {rgb: '8A6A32'}}, alignment: {horizontal: 'center', vertical: 'center', wrapText: true}, border};
        for (let r = 1; r <= body.length; r++) {
          const cell = ws[XLSX.utils.encode_cell({r, c})]; if (!cell) continue;
          const crit = c === 8 && Number(cell.v) > 30;
          cell.s = {alignment: {vertical: 'top', wrapText: wrap.has(c), horizontal: c === 0 || c === 8 ? 'center' : 'left'}, border, ...(crit ? {font: {bold: true, color: {rgb: 'B34C48'}}} : {})};
        }
      }
      ws['!cols'] = [6, 12, 22, 24, 22, 20, 18, 12, 10, 38, 20, 44, 18, 20, 12, 12].map(wch => ({wch}));
      ws['!rows'] = [{hpt: 32}];
      ws['!autofilter'] = {ref: XLSX.utils.encode_range({s: {r: 0, c: 0}, e: {r: body.length, c: head.length - 1}})};
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Hồ sơ tồn');
      XLSX.writeFile(wb, 'tien-do-ho-so-ton-' + isoDate(new Date()) + '.xlsx');
      toast('Đã xuất ' + list.length + ' hồ sơ ra Excel', 'success');
    } catch (error) { toast('Không xuất được Excel: ' + (error && error.message || 'lỗi không xác định'), 'error'); }
    finally { button.disabled = false; }
  }

  // ----- Khung trang & sự kiện -----
  function skeleton() {
    return '<div class="sf-workspace pn-workspace" id="pnRoot">' +
      '<header class="sf-page-head"><div class="sf-page-title"><span class="sf-page-emblem" aria-hidden="true">' + svg('note', 22) + '</span><div><div class="sf-eyebrow">NGHIỆP VỤ · HỒ SƠ BỒI THƯỜNG</div><h1>Tiến độ hồ sơ tồn</h1><p>Theo dõi tuổi tồn, ghi chú tiến độ và lịch hẹn xử lý của từng hồ sơ — hồ sơ cần chú ý nhất được xếp lên đầu.</p></div></div>' +
      '<div class="sf-toolbar"><button type="button" class="sf-button" data-pn-refresh title="Tính lại theo dữ liệu mới nhất">' + svg('reset', 15) + 'Làm mới</button><button type="button" class="sf-button sf-primary" data-pn-export>' + svg('xls', 15) + 'Xuất Excel</button></div></header>' +
      '<section class="pn-kpis" id="pnSummary" aria-label="Tổng quan hồ sơ tồn"></section>' +
      '<section class="pn-insight"><div class="sf-library pn-card" id="pnAges"></div><div class="sf-library pn-card" id="pnGdvs"></div></section>' +
      '<section class="sf-library pn-library"><div class="pn-bar"><label class="pn-search">' + svg('search', 16) + '<input type="search" id="pnSearch" placeholder="Tìm biển số, số HSBT, chủ xe, GĐV, tổn thất…" autocomplete="off" aria-label="Tìm hồ sơ tồn"></label><div class="pn-filters" id="pnFilters"></div>' +
      '<button type="button" class="sf-button" data-pn-reset>' + svg('reset', 14) + 'Xóa lọc</button><span class="pn-count" id="pnCount"></span></div>' +
      '<div class="pn-chips" id="pnChips" role="group" aria-label="Lọc nhanh"></div>' +
      '<div class="pn-tablewrap"><table class="pn-table"><thead><tr><th class="pn-c-stt">#</th><th>Hồ sơ</th><th>Trạng thái</th><th>Tuổi tồn</th><th>Xe &amp; đơn vị cấp</th><th>Nội dung tổn thất</th><th>GĐV xử lý</th><th>Tiến độ gần nhất</th><th></th></tr></thead><tbody id="pnBody"></tbody></table></div>' +
      '<div class="pn-pager" id="pnPager"></div></section>' +
      '<div class="pn-modal" id="pnModal" hidden role="dialog" aria-modal="true" aria-labelledby="pnModalTitle"><div class="pn-dialog"><header><div><span class="sf-eyebrow">TIẾN ĐỘ HỒ SƠ</span><h3 id="pnModalTitle"></h3><div class="pn-modal-meta" id="pnModalMeta"></div></div><button type="button" class="pn-x" data-pn-close aria-label="Đóng">' + svg('close', 18) + '</button></header>' +
      '<div class="pn-dialog-body"><div class="pn-h-title">Lịch sử ghi chú <span id="pnHistoryCount">0</span></div><ul class="pn-history" id="pnHistory"></ul>' +
      '<label class="pn-label" for="pnNoteInput">Ghi chú mới</label><div class="pn-templates">' + TEMPLATES.map(t => '<button type="button" data-pn-tpl="' + attr(t) + '">' + esc(t) + '</button>').join('') + '</div>' +
      '<textarea id="pnNoteInput" rows="3" placeholder="VD: Đã liên hệ khách hàng, hẹn bổ sung đăng kiểm trong tuần…"></textarea>' +
      '<div class="pn-due-row"><label class="pn-label" for="pnDueInput">Hẹn xử lý tiếp <small>(tuỳ chọn)</small></label><input type="date" id="pnDueInput"><div class="pn-due-quick"><button type="button" data-pn-due="1">+1 ngày</button><button type="button" data-pn-due="3">+3 ngày</button><button type="button" data-pn-due="7">+7 ngày</button><button type="button" data-pn-due="0">Bỏ hẹn</button></div></div></div>' +
      '<footer><span class="pn-kbd">Ctrl + Enter để lưu</span><button type="button" class="sf-button" data-pn-close>Hủy</button><button type="button" class="sf-button sf-primary" data-pn-save>' + svg('check', 14) + 'Lưu ghi chú</button></footer></div></div></div>';
  }
  function setQuick(value) { state.quick = state.quick === value && value !== 'all' ? 'all' : value; state.page = 1; paint(); }
  function onClick(event) {
    const t = event.target;
    const opt = t.closest('[data-pn-opt]');
    if (opt) {
      const name = opt.closest('[data-pn-dd]').dataset.pnDd, value = opt.dataset.pnOpt;
      closeDd();
      if (name === 'per') state.per = Number(value) || 20; else state[name] = value;
      state.page = 1; paint(); return;
    }
    const trigger = t.closest('.kz-dd-trigger');
    if (trigger) { const wrap = trigger.closest('[data-pn-dd]'); wrap.classList.contains('is-open') ? closeDd() : openDd(wrap); return; }
    if (!t.closest('.kz-dd')) closeDd();
    const q = t.closest('[data-pn-quick]'); if (q) return void setQuick(q.dataset.pnQuick);
    const sb = t.closest('[data-pn-status]'); if (sb) { state.status = state.status === sb.dataset.pnStatus ? 'all' : sb.dataset.pnStatus; state.page = 1; return void paint(); }
    const g = t.closest('[data-pn-gdv]'); if (g) { state.gdv = state.gdv === g.dataset.pnGdv ? 'all' : g.dataset.pnGdv; state.page = 1; return void paint(); }
    const page = t.closest('[data-pn-page]'); if (page && !page.disabled) { state.page = Number(page.dataset.pnPage); paint(); return void host.querySelector('.pn-library').scrollIntoView({behavior: 'smooth', block: 'start'}); }
    if (t.closest('[data-pn-reset]')) { Object.assign(state, {q: '', status: 'all', gdv: 'all', quick: 'all', page: 1}); host.querySelector('#pnSearch').value = ''; return void paint(); }
    if (t.closest('[data-pn-refresh]')) { rows = buildRows(); paint(); return void toast('Đã làm mới theo dữ liệu mới nhất', 'success'); }
    if (t.closest('[data-pn-export]')) return void exportExcel(t.closest('[data-pn-export]'));
    if (t.closest('[data-pn-close]') || t.id === 'pnModal') return void closeModal();
    if (t.closest('[data-pn-save]')) return void saveNote();
    const tpl = t.closest('[data-pn-tpl]');
    if (tpl) { const input = host.querySelector('#pnNoteInput'); input.value = input.value.trim() ? input.value.trim() + '\n' + tpl.dataset.pnTpl : tpl.dataset.pnTpl; return void input.focus(); }
    const due = t.closest('[data-pn-due]');
    if (due) { const days = Number(due.dataset.pnDue), input = host.querySelector('#pnDueInput'); input.value = days ? isoDate(new Date(Date.now() + days * DAY_MS)) : ''; return; }
    const open = t.closest('[data-pn-open]'); if (open) openModal(open.dataset.pnOpen);
  }
  function onKey(event) {
    if (event.key === 'Escape') { if (ddOpen) { const name = ddOpen; closeDd(); host.querySelector('[data-pn-dd="' + name + '"] .kz-dd-trigger')?.focus(); } else if (modal) closeModal(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && modal) { event.preventDefault(); return void saveNote(); }
    if (event.key === 'Enter' && event.target.matches && event.target.matches('tr[data-pn-open]')) return void openModal(event.target.dataset.pnOpen);
    if (ddOpen && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      const items = [...host.querySelectorAll('.kz-dd.is-open .kz-dd-opt')], at = items.indexOf(document.activeElement);
      if (items.length) { event.preventDefault(); items[(at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); }
    }
  }
  function onInput(event) {
    if (event.target.id !== 'pnSearch') return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.q = event.target.value; state.page = 1; paint(); }, 160);
  }

  function render(container) {
    const target = container || document.getElementById('tabContentContainer');
    if (!target) return;
    rows = buildRows();
    if (!target.querySelector('#pnRoot')) {
      closeModal();
      target.innerHTML = skeleton();
      host = target.querySelector('#pnRoot');
      host.addEventListener('click', onClick);
      host.addEventListener('keydown', onKey);
      host.addEventListener('input', onInput);
      host.querySelector('#pnSearch').value = state.q;
      window.removeEventListener('resize', onViewportMove); window.addEventListener('resize', onViewportMove);
      window.removeEventListener('scroll', onViewportMove, true); window.addEventListener('scroll', onViewportMove, true);
    } else host = target.querySelector('#pnRoot');
    paint();
  }
  return {render, refresh: () => { if (host && host.isConnected) { rows = buildRows(); paint(); } else render(); }};
})();

// Các hàm toàn cục mà workspace.js gọi khi dữ liệu hồ sơ / ghi chú thay đổi.
function renderPendingNotesTrackerPage(targetContainer) { PendingNotesPage.render(targetContainer); }
function executeUIRenderPendingNotesTable() { PendingNotesPage.refresh(); }
