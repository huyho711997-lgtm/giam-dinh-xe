/* Bảng chi tiết hồ sơ dưới BÁO CÁO TUẦN / THÁNG: liệt kê từng hồ sơ làm nên các con số ở bảng tổng hợp,
 * theo đúng kỳ (từ ngày – đến ngày), GĐV và quy tắc đang chọn phía trên.
 * Phần tính (WeeklyDetail.build / filter) không đụng DOM/Firebase, nhận hàm phân loại qua `h` → có unit test.
 * Điều kiện từng nhóm sao chép từ getWeeklyZoneReportData (weekly-annual.js): đổi ở đó thì đổi ở đây. */
const WeeklyDetail = (() => {
  const BUCKETS = [
    {id: 'phatSinh', label: 'Phát sinh', color: '#3b82f6'},
    {id: 'daDuyet', label: 'Đã duyệt HSBT', color: '#10b981'},
    {id: 'chuaDuyet', label: 'Chưa duyệt PASC', color: '#f59e0b'},
    {id: 'carpla', label: 'Carpla', color: '#06b6d4'},
    {id: 'tndsTon', label: 'TNDS tồn', color: '#6366f1'},
    {id: 'tonQuaHan', label: 'Tồn quá hạn', color: '#ef4444'}
  ];
  // Hồ sơ "trong kỳ" = thuộc ít nhất một nhóm tính theo kỳ; TNDS tồn / Tồn quá hạn không theo kỳ nên chỉ hiện khi chọn riêng nhóm đó.
  const PERIOD_IDS = ['phatSinh', 'daDuyet', 'chuaDuyet', 'carpla'];
  const CHUA_DUYET_KEYS = ['moi', 'cho_giam_dinh_ht', 'da_giam_dinh_ht', 'cho_gdct', 'da_gdct', 'cho_duyet_pasc'];
  const CHUA_DUYET_TEXT = ['chờ giám định ht', 'cho giam dinh ht', 'đã giám định ht', 'da giam dinh ht', 'chờ gđct', 'cho gdct', 'đã gđct', 'da gdct', 'chờ duyệt pasc', 'cho duyet pasc'];
  const isChuaDuyetStatus = value => {
    const st = String(value || '').toLowerCase().trim();
    return CHUA_DUYET_KEYS.includes(st) || st === 'mới' || CHUA_DUYET_TEXT.some(text => st.includes(text));
  };
  const gdvOf = c => String(c.gdvTiepNhan || c.canBoXuLy || c.gdvHo || c.canBoBoiThuong || c.gdvName || c.createdByName || 'Chưa phân công').trim();
  const amountOf = c => parseInt(String(c.ttbtTongSoTienBoiThuong || '0').replace(/[^0-9]/g, ''), 10) || 0;
  const norm = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

  // opts: {claims: {id: claim}|[claim], period:{startDate,endDate}, rules, h:{getClaimDateMs,getClaimTimestamp,isPhatSinh,isTndsClaim,isUnpaidClaim,isDuyetHsbtApproved,isOnlyDaDuyetHsbt}, selectedGdv:[], now}
  function build(opts) {
    const {period, rules: r, h} = opts, now = opts.now || Date.now();
    const start = period.startDate.getTime(), end = period.endDate.getTime();
    const inRange = ms => ms === -1 || (ms >= start && ms <= end);
    const list = Array.isArray(opts.claims) ? opts.claims.map((c, i) => ({id: String(c._id ?? i), c})) : Object.entries(opts.claims || {}).map(([id, c]) => ({id, c}));
    const selected = (opts.selectedGdv || []).map(name => String(name).trim().toLowerCase()).filter(Boolean);
    const rows = [], counts = Object.fromEntries(BUCKETS.map(b => [b.id, 0]));
    list.forEach(({id, c}) => {
      if (!c || typeof c !== 'object') return;
      const gdv = gdvOf(c);
      if (selected.length && !selected.includes(gdv.toLowerCase())) return;
      const dateOf = (field, fallback) => h.getClaimDateMs(c, r[field] || fallback);
      const openMs = h.getClaimDateMs(c, 'ngayMoHs');
      const hsTonMs = dateOf('hsTonDateField', 'ngayMoHs');
      const stamp = h.getClaimTimestamp(c);
      const b = {
        phatSinh: inRange(dateOf('phatSinhDateField', 'ngayMoHs')) && !!h.isPhatSinh(c),
        daDuyet: inRange(dateOf('daDuyetDateField', 'ngayMoHs')) && !!h.isDuyetHsbtApproved(c),
        chuaDuyet: stamp >= start && stamp <= end && isChuaDuyetStatus(c.trangThai),
        carpla: inRange(dateOf('carplaDateField', 'toTrinhNgayDuyet')) && String(c.tenGaraVietTat || '').toLowerCase().includes('carpla'),
        tndsTon: inRange(dateOf('tndsTonDateField', 'none')) && !!h.isTndsClaim(c) && !!h.isUnpaidClaim(c),
        tonQuaHan: !!h.isOnlyDaDuyetHsbt(c) && hsTonMs > 0 && (now - hsTonMs > (Number(r.hsTonDays) || 30) * 86400000)
      };
      BUCKETS.forEach(bucket => { if (b[bucket.id]) counts[bucket.id]++; });
      if (!BUCKETS.some(bucket => b[bucket.id])) return;
      rows.push({id, claim: c, gdv, openMs: openMs > 0 ? openMs : 0, amount: amountOf(c), buckets: b, inPeriod: PERIOD_IDS.some(key => b[key])});
    });
    rows.sort((a, b) => b.openMs - a.openMs || String(a.claim.soHoSoBoiThuong || '').localeCompare(String(b.claim.soHoSoBoiThuong || '')));
    counts.all = rows.filter(row => row.inPeriod).length;
    return {rows, counts};
  }

  // bucket: 'all' (hồ sơ trong kỳ) hoặc id nhóm; query: tìm không dấu theo số HSBT, biển số, chủ xe, GĐV, gara.
  function filter(rows, bucket, query, ownerOf) {
    const words = norm(query).split(/\s+/).filter(Boolean);
    return rows.filter(row => {
      if (bucket && bucket !== 'all' ? !row.buckets[bucket] : !row.inPeriod) return false;
      if (!words.length) return true;
      const c = row.claim, hay = norm([c.soHoSoBoiThuong, c.bienSo, ownerOf ? ownerOf(c) : '', row.gdv, c.tenGaraVietTat, c.tenGara].join(' '));
      return words.every(word => hay.includes(word));
    });
  }
  // Cột của bảng: sort theo `type` (text/number), lọc nhiều giá trị với cột có filter:true.
  const COLUMNS = [
    {key: 'stt', label: 'STT', sort: false},
    {key: 'hsbt', label: 'Số HSBT', type: 'text'},
    {key: 'bienSo', label: 'Biển số', type: 'text'},
    {key: 'owner', label: 'Chủ xe', type: 'text'},
    {key: 'gdv', label: 'GĐV', type: 'text', filter: true},
    {key: 'gara', label: 'Gara', type: 'text', filter: true},
    {key: 'date', label: 'Ngày mở HS', type: 'number'},
    {key: 'status', label: 'Trạng thái', type: 'text', filter: true},
    {key: 'amount', label: 'Số tiền BT', type: 'number'},
    {key: 'groups', label: 'Thuộc nhóm', type: 'text', filter: true}
  ];
  const groupLabels = row => BUCKETS.filter(b => row.buckets[b.id]).map(b => b.label);
  // ctx: {ownerOf(claim), statusOf(claim) → nhãn}
  function valueOf(row, key, ctx) {
    const c = row.claim, x = ctx || {};
    switch (key) {
      case 'hsbt': return String(c.soHoSoBoiThuong || '');
      case 'bienSo': return String(c.bienSo || '');
      case 'owner': { const v = x.ownerOf ? x.ownerOf(c) : ''; return v === 'N/A' ? '' : String(v || ''); }
      case 'gdv': return row.gdv;
      case 'gara': return String(c.tenGaraVietTat || c.tenGara || '');
      case 'date': return row.openMs || 0;
      case 'status': return x.statusOf ? String(x.statusOf(c) || '') : String(c.trangThai || '');
      case 'amount': return row.amount || 0;
      case 'groups': return groupLabels(row).join(', ');
      default: return '';
    }
  }
  // Giá trị riêng của cột (cột "groups" có nhiều giá trị/hàng); rỗng → '(Trống)'.
  const valuesOf = (row, key, ctx) => key === 'groups' ? groupLabels(row) : [valueOf(row, key, ctx) || '(Trống)'];
  // filters: {key: [giá trị được giữ]}; mảng rỗng/không có = không lọc.
  function applyColumnFilters(rows, filters, ctx) {
    const active = Object.entries(filters || {}).filter(([, list]) => Array.isArray(list) && list.length);
    if (!active.length) return rows;
    return rows.filter(row => active.every(([key, list]) => valuesOf(row, key, ctx).some(value => list.includes(value))));
  }
  function distinct(rows, key, ctx) {
    const map = new Map();
    rows.forEach(row => valuesOf(row, key, ctx).forEach(value => map.set(value, (map.get(value) || 0) + 1)));
    return [...map.entries()].map(([value, count]) => ({value, count})).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'vi'));
  }
  function sortRows(rows, sort, ctx) {
    const col = COLUMNS.find(item => item.key === (sort && sort.key));
    if (!col || col.sort === false || !sort.dir) return rows;
    const sign = sort.dir === 'desc' ? -1 : 1;
    return rows.map((row, index) => ({row, index, v: valueOf(row, col.key, ctx)})).sort((a, b) => {
      let d = col.type === 'number' ? a.v - b.v : String(a.v).localeCompare(String(b.v), 'vi', {numeric: true, sensitivity: 'base'});
      // hàng trống luôn xuống cuối dù tăng hay giảm
      const ea = a.v === '' || a.v === 0, eb = b.v === '' || b.v === 0;
      if (ea !== eb) return ea ? 1 : -1;
      return d * sign || a.index - b.index;
    }).map(item => item.row);
  }
  return {BUCKETS, PERIOD_IDS, COLUMNS, build, filter, applyColumnFilters, distinct, sortRows, valueOf, isChuaDuyetStatus, gdvOf, amountOf, norm};
})();

// ---- Giao diện (dùng biến/hàm toàn cục của webapp) ----
var weeklyDetailState = {bucket: 'all', query: '', limit: 50, sort: {key: '', dir: ''}, colFilters: {}, pop: ''};
function weeklyDetailData() {
  const period = getWeeklyZoneReportPeriod();
  const claims = Object.entries(cachedPendingClaimsPayload || {}).map(([id, claim]) => { claim._id = id; return claim; });
  const result = WeeklyDetail.build({
    claims, period, rules: cachedReportRules, selectedGdv: typeof activeSelectedGdvNames !== 'undefined' ? activeSelectedGdvNames : [],
    h: {getClaimDateMs, getClaimTimestamp, isPhatSinh, isTndsClaim, isUnpaidClaim, isDuyetHsbtApproved, isOnlyDaDuyetHsbt}
  });
  return {period, ...result};
}
function weeklyDetailStatusLabel(c) { const cfg = (typeof PENDING_STATUS_MAP !== 'undefined' && PENDING_STATUS_MAP[c.trangThai]) || null; return cfg ? cfg.label : (c.trangThai || 'Mới'); }
function weeklyDetailCtx() { return {ownerOf: extractClaimOwnerName, statusOf: weeklyDetailStatusLabel}; }
// Danh sách đang hiển thị = nhóm + tìm kiếm + lọc theo cột + sắp xếp (dùng chung cho bảng và Xuất Excel).
function weeklyDetailRows(data, ignoreKey) {
  const st = weeklyDetailState, ctx = weeklyDetailCtx();
  let rows = WeeklyDetail.filter(data.rows, st.bucket, st.query, extractClaimOwnerName);
  const filters = ignoreKey ? Object.fromEntries(Object.entries(st.colFilters).filter(([key]) => key !== ignoreKey)) : st.colFilters;
  rows = WeeklyDetail.applyColumnFilters(rows, filters, ctx);
  return ignoreKey ? rows : WeeklyDetail.sortRows(rows, st.sort, ctx);
}
const weeklyDetailActiveFilters = () => Object.values(weeklyDetailState.colFilters).filter(list => list && list.length).length;
function weeklyDetailBodyHtml(data) {
  const st = weeklyDetailState, esc = escapeHtmlOutput;
  const rows = weeklyDetailRows(data);
  const shown = rows.slice(0, st.limit);
  const fmtDate = ms => { if (!ms) return '—'; const d = new Date(ms); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); };
  const statusColor = c => { const cfg = (typeof PENDING_STATUS_MAP !== 'undefined' && PENDING_STATUS_MAP[c.trangThai]) || null; return cfg ? cfg.color : '#64748b'; };
  const hsbtHtml = value => { const text = String(value || ''); const m = text.match(/^(.*\/)([^\/]+)$/); return m ? '<span class="wkd-pre">' + esc(m[1]) + '</span>' + esc(m[2]) : esc(text || '—'); };
  const body = shown.map((row, index) => {
    const c = row.claim, owner = extractClaimOwnerName(c);
    const chips = WeeklyDetail.BUCKETS.filter(b => row.buckets[b.id]).map(b => '<span class="wkd-chip" style="--c:' + b.color + '">' + esc(b.label) + '</span>').join('');
    return '<tr><td class="wkd-n">' + (index + 1) + '</td><td class="wkd-hsbt">' + hsbtHtml(c.soHoSoBoiThuong) + '</td><td class="wkd-plate-cell">' + (c.bienSo ? '<span class="wkd-plate">' + esc(c.bienSo) + '</span>' : '—') + '</td><td class="wkd-l wkd-own" title="' + esc(owner === 'N/A' ? '' : owner) + '">' + esc(owner === 'N/A' ? '—' : owner) + '</td><td class="wkd-l wkd-gdv">' + esc(row.gdv) + '</td><td class="wkd-l wkd-gara" title="' + esc(c.tenGaraVietTat || c.tenGara || '') + '">' + esc(c.tenGaraVietTat || c.tenGara || '—') + '</td><td>' + fmtDate(row.openMs) + '</td><td><span class="wkd-status" style="--c:' + statusColor(c) + '">' + esc(weeklyDetailStatusLabel(c)) + '</span></td><td class="wkd-r">' + (row.amount ? row.amount.toLocaleString('vi-VN') + ' đ' : '—') + '</td><td class="wkd-l"><div class="wkd-chips">' + chips + '</div></td></tr>';
  }).join('');
  const more = rows.length > shown.length ? '<div class="wkd-more"><button type="button" class="btn-premium btn-secondary" onclick="weeklyDetailShowMore()">Xem thêm ' + Math.min(50, rows.length - shown.length) + ' hồ sơ (còn ' + (rows.length - shown.length) + ')</button></div>' : '';
  const heads = WeeklyDetail.COLUMNS.map(col => {
    if (col.sort === false) return '<th>' + esc(col.label) + '</th>';
    const dir = st.sort.key === col.key ? st.sort.dir : '', fl = (st.colFilters[col.key] || []).length;
    const arrow = '<span class="wkd-arrow" aria-hidden="true">' + (dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : '↕') + '</span>';
    const funnel = col.filter ? '<button type="button" class="wkd-funnel' + (fl ? ' is-on' : '') + '" onclick="weeklyDetailOpenFilter(\'' + col.key + '\', event)" title="Lọc theo ' + esc(col.label) + '" aria-label="Lọc theo ' + esc(col.label) + '"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"></path></svg>' + (fl ? '<i>' + fl + '</i>' : '') + '</button>' : '';
    return '<th class="wkd-th' + (dir ? ' is-sorted' : '') + '" data-wkd-col="' + col.key + '" onclick="weeklyDetailSort(\'' + col.key + '\')" title="Bấm để sắp xếp" aria-sort="' + (dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none') + '"><span class="wkd-th-in"><span>' + esc(col.label) + '</span>' + arrow + funnel + '</span></th>';
  }).join('');
  const nFilters = weeklyDetailActiveFilters();
  const clear = nFilters ? ' <button type="button" class="wkd-clear" onclick="weeklyDetailClearFilters()">Xoá lọc cột (' + nFilters + ')</button>' : '';
  return '<div class="wkd-sum"><b>' + rows.length.toLocaleString('vi-VN') + '</b> hồ sơ' + (st.query ? ' khớp “' + esc(st.query) + '”' : '') + clear + '</div>'
    + '<div class="wkd-scroll"><table class="wkd-table"><thead><tr>' + heads + '</tr></thead><tbody>'
    + (body || '<tr><td colspan="10" class="wkd-empty">Không có hồ sơ nào trong kỳ theo bộ lọc hiện tại.</td></tr>') + '</tbody></table></div>' + more;
}
function weeklyDetailBucketHtml(data) {
  const st = weeklyDetailState, esc = escapeHtmlOutput, open = typeof activeOpenDropdownId !== 'undefined' && activeOpenDropdownId === 'ddWeeklyDetailBucketMenu';
  const all = [{id: 'all', label: 'Tất cả hồ sơ trong kỳ'}].concat(WeeklyDetail.BUCKETS);
  const cur = all.find(b => b.id === st.bucket) || all[0];
  const check = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--primary)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  const items = all.map(b => '<div class="custom-select-item report-filter-select-item' + (b.id === cur.id ? ' active' : '') + '" onclick="weeklyDetailSetBucket(\'' + b.id + '\')" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 14px;' + (b.id === cur.id ? ' background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850;' : '') + '"><span>' + esc(b.label) + '</span><span style="display:inline-flex;align-items:center;gap:8px;"><b style="font-size:12px;color:var(--text-soft);font-weight:850;">' + (data.counts[b.id] || 0) + '</b>' + (b.id === cur.id ? check : '') + '</span></div>').join('');
  return '<button type="button" class="custom-select-trigger report-filter-select-trigger' + (open ? ' is-open' : '') + '" onclick="toggleCustomDropdownMenu(\'ddWeeklyDetailBucketMenu\', event)" style="padding: 9px 16px; border-radius: 12px; background: var(--bg-soft); border: 1px solid var(--border-strong); font-size: 13px; font-weight: 800; color: var(--text-main); display: inline-flex; align-items: center; gap: 10px; cursor: pointer; min-width: 200px; justify-content: space-between;">'
    + '<span style="display: flex; align-items: center; gap: 6px;"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg><span>' + esc(cur.label) + ' (' + (data.counts[cur.id] || 0) + ')</span></span>'
    + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--text-soft);"><polyline points="6 9 12 15 18 9"></polyline></svg></button>'
    + '<div id="ddWeeklyDetailBucketMenu" class="custom-select-menu report-filter-select-menu report-filter-claim-menu" style="display: ' + (open ? 'block' : 'none') + '; position: absolute; top: calc(100% + 8px); left: 0; z-index: 999; text-align: left;">'
    + '<div class="report-filter-menu-head"><span class="report-filter-menu-head__icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg></span><div><div class="report-filter-menu-head__title">Nhóm hồ sơ</div><div class="report-filter-menu-head__meta">Số đếm khớp bảng tổng hợp phía trên</div></div></div>'
    + '<div class="report-filter-menu-body">' + items + '</div></div>';
}
function renderWeeklyZoneDetailHtml() {
  const data = weeklyDetailData(), st = weeklyDetailState, esc = escapeHtmlOutput;
  weeklyDetailState.data = data;
  return '<section class="wkd-card" id="weeklyDetailCard">'
    + '<div class="weekly-report-title-block"><span class="weekly-report-eyebrow">CHI TIẾT HỒ SƠ</span><h2>DANH SÁCH HỒ SƠ TRONG KỲ</h2><div class="weekly-report-period">' + esc(data.period.label) + '</div></div>'
    + '<div class="wkd-bar hide-on-screenshot"><div class="custom-select-wrapper" id="weeklyDetailBucketHost" style="position: relative;">' + weeklyDetailBucketHtml(data) + '</div>'
    + '<label class="wkd-searchbox"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><input type="search" placeholder="Tìm số HSBT, biển số, chủ xe, GĐV, gara…" value="' + esc(st.query) + '" oninput="weeklyDetailSearch(this.value)" aria-label="Tìm hồ sơ" autocomplete="off"></label>'
    + '<button type="button" class="weekly-report-image-export" onclick="weeklyDetailExport()" title="Xuất danh sách đang hiển thị ra Excel" style="padding: 8px 16px; border-radius: 11px; background: var(--bg-soft); border: 1px solid var(--border-strong); color: var(--text-main); font-size: 12.5px; font-weight: 850; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: var(--shadow-xs); transition: all 0.2s ease;"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg><span>Xuất Excel</span></button>'
    + '</div>'
    + '<div id="weeklyDetailBody">' + weeklyDetailBodyHtml(data) + '</div></section>';
}
function weeklyDetailRepaint() { const box = document.getElementById('weeklyDetailBody'); if (box && weeklyDetailState.data) box.innerHTML = weeklyDetailBodyHtml(weeklyDetailState.data); }
let weeklyDetailTimer = 0;
function weeklyDetailSearch(value) { clearTimeout(weeklyDetailTimer); weeklyDetailTimer = setTimeout(() => { weeklyDetailState.query = String(value || '').trim(); weeklyDetailState.limit = 50; weeklyDetailRepaint(); }, 180); }
function weeklyDetailSetBucket(id) {
  weeklyDetailState.bucket = id || 'all'; weeklyDetailState.limit = 50;
  if (typeof activeOpenDropdownId !== 'undefined') activeOpenDropdownId = null;
  const host = document.getElementById('weeklyDetailBucketHost');
  if (host && weeklyDetailState.data) host.innerHTML = weeklyDetailBucketHtml(weeklyDetailState.data);
  weeklyDetailClosePop(); weeklyDetailRepaint();
}
function weeklyDetailShowMore() { weeklyDetailState.limit += 50; weeklyDetailRepaint(); }
// Bấm tiêu đề cột: tăng dần → giảm dần → bỏ sắp xếp.
function weeklyDetailSort(key) {
  const st = weeklyDetailState, same = st.sort.key === key;
  st.sort = same ? {key: st.sort.dir === 'desc' ? '' : key, dir: st.sort.dir === 'asc' ? 'desc' : st.sort.dir === 'desc' ? '' : 'asc'} : {key, dir: 'asc'};
  st.limit = 50; weeklyDetailRepaint();
}
function weeklyDetailClearFilters() { weeklyDetailState.colFilters = {}; weeklyDetailState.limit = 50; weeklyDetailClosePop(); weeklyDetailRepaint(); }
function weeklyDetailClosePop() { weeklyDetailState.pop = ''; document.getElementById('weeklyDetailPop')?.remove(); }
function weeklyDetailPopHtml(key) {
  const st = weeklyDetailState, esc = escapeHtmlOutput, col = WeeklyDetail.COLUMNS.find(item => item.key === key);
  const options = WeeklyDetail.distinct(weeklyDetailRows(st.data, key), key, weeklyDetailCtx());
  const chosen = st.colFilters[key] || [];
  const items = options.map((opt, i) => '<label class="wkd-opt' + (chosen.includes(opt.value) ? ' is-on' : '') + '"><input type="checkbox" data-wkd-val="' + i + '"' + (chosen.includes(opt.value) ? ' checked' : '') + '><span class="wkd-opt-t">' + esc(opt.value) + '</span><b>' + opt.count + '</b></label>').join('');
  return '<div class="wkd-pop-head"><div><div class="report-filter-menu-head__title">Lọc theo ' + esc(col.label) + '</div><div class="report-filter-menu-head__meta">' + (chosen.length ? 'Đang chọn ' + chosen.length + ' giá trị' : 'Chọn một hoặc nhiều giá trị') + '</div></div><button type="button" class="wkd-pop-clear" data-wkd-reset' + (chosen.length ? '' : ' disabled') + '>Bỏ chọn</button></div><div class="wkd-pop-list">' + (items || '<div class="wkd-empty">Không có giá trị nào.</div>') + '</div>';
}
function weeklyDetailOpenFilter(key, event) {
  if (event) event.stopPropagation();
  const st = weeklyDetailState, card = document.getElementById('weeklyDetailCard'), th = card && card.querySelector('th[data-wkd-col="' + key + '"]');
  if (!card || !th) return;
  const wasOpen = st.pop === key; weeklyDetailClosePop(); if (wasOpen) return;
  st.pop = key;
  const pop = document.createElement('div'); pop.id = 'weeklyDetailPop'; pop.className = 'wkd-pop';
  pop.innerHTML = weeklyDetailPopHtml(key);
  card.appendChild(pop);
  const cr = card.getBoundingClientRect(), tr = th.getBoundingClientRect();
  pop.style.top = (tr.bottom - cr.top + 6) + 'px';
  pop.style.left = Math.max(8, Math.min(tr.left - cr.left, cr.width - pop.offsetWidth - 8)) + 'px';
  pop.addEventListener('click', e => e.stopPropagation());
  const refresh = () => { const list = pop.querySelector('.wkd-pop-list'), top = list ? list.scrollTop : 0; pop.innerHTML = weeklyDetailPopHtml(key); const next = pop.querySelector('.wkd-pop-list'); if (next) next.scrollTop = top; weeklyDetailRepaint(); };
  pop.addEventListener('change', e => {
    const box = e.target.closest('[data-wkd-val]'); if (!box) return;
    const options = WeeklyDetail.distinct(weeklyDetailRows(st.data, key), key, weeklyDetailCtx()), value = options[Number(box.dataset.wkdVal)]?.value;
    if (value === undefined) return;
    const set = new Set(st.colFilters[key] || []); if (box.checked) set.add(value); else set.delete(value);
    if (set.size) st.colFilters[key] = [...set]; else delete st.colFilters[key];
    st.limit = 50; refresh();
  });
  pop.addEventListener('click', e => { if (e.target.closest('[data-wkd-reset]')) { delete st.colFilters[key]; st.limit = 50; refresh(); } });
  setTimeout(() => document.addEventListener('click', function close(e) { if (!pop.isConnected) { document.removeEventListener('click', close); return; } if (!pop.contains(e.target)) { document.removeEventListener('click', close); weeklyDetailClosePop(); } }), 0);
}
function weeklyDetailExport() {
  const data = weeklyDetailState.data; if (!data) return;
  if (typeof XLSX === 'undefined') { triggerToast('Thư viện Excel đang tải, vui lòng thử lại sau vài giây.', 'warning'); return; }
  const rows = weeklyDetailRows(data);
  if (!rows.length) { triggerToast('Không có hồ sơ để xuất.', 'warning'); return; }
  const sheet = XLSX.utils.json_to_sheet(rows.map((row, index) => ({
    'STT': index + 1, 'Số HSBT': row.claim.soHoSoBoiThuong || '', 'Biển số': row.claim.bienSo || '', 'Chủ xe': extractClaimOwnerName(row.claim) === 'N/A' ? '' : extractClaimOwnerName(row.claim),
    'GĐV': row.gdv, 'Gara': row.claim.tenGaraVietTat || row.claim.tenGara || '', 'Ngày mở HS': row.openMs ? new Date(row.openMs).toLocaleDateString('vi-VN') : '',
    'Trạng thái': weeklyDetailStatusLabel(row.claim), 'Số tiền bồi thường': row.amount || '',
    'Thuộc nhóm': WeeklyDetail.BUCKETS.filter(b => row.buckets[b.id]).map(b => b.label).join(', ')
  })));
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Chi tiết hồ sơ');
  XLSX.writeFile(book, 'chi-tiet-ho-so-' + data.period.label.replace(/[^0-9]+/g, '-').replace(/^-|-$/g, '') + '.xlsx');
}
