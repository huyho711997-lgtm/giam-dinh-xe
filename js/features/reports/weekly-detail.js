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
  return {BUCKETS, PERIOD_IDS, build, filter, isChuaDuyetStatus, gdvOf, amountOf, norm};
})();

// ---- Giao diện (dùng biến/hàm toàn cục của webapp) ----
var weeklyDetailState = {bucket: 'all', query: '', limit: 50};
function weeklyDetailData() {
  const period = getWeeklyZoneReportPeriod();
  const claims = Object.entries(cachedPendingClaimsPayload || {}).map(([id, claim]) => { claim._id = id; return claim; });
  const result = WeeklyDetail.build({
    claims, period, rules: cachedReportRules, selectedGdv: typeof activeSelectedGdvNames !== 'undefined' ? activeSelectedGdvNames : [],
    h: {getClaimDateMs, getClaimTimestamp, isPhatSinh, isTndsClaim, isUnpaidClaim, isDuyetHsbtApproved, isOnlyDaDuyetHsbt}
  });
  return {period, ...result};
}
function weeklyDetailBodyHtml(data) {
  const st = weeklyDetailState, esc = escapeHtmlOutput;
  const rows = WeeklyDetail.filter(data.rows, st.bucket, st.query, extractClaimOwnerName);
  const shown = rows.slice(0, st.limit);
  const fmtDate = ms => { if (!ms) return '—'; const d = new Date(ms); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); };
  const statusOf = c => { const cfg = (typeof PENDING_STATUS_MAP !== 'undefined' && PENDING_STATUS_MAP[c.trangThai]) || null; return {label: cfg ? cfg.label : (c.trangThai || 'Mới'), color: cfg ? cfg.color : '#64748b'}; };
  const body = shown.map((row, index) => {
    const c = row.claim, s = statusOf(c), owner = extractClaimOwnerName(c);
    const chips = WeeklyDetail.BUCKETS.filter(b => row.buckets[b.id]).map(b => '<span class="wkd-chip" style="--c:' + b.color + '">' + esc(b.label) + '</span>').join('');
    return '<tr><td class="wkd-n">' + (index + 1) + '</td><td class="wkd-hsbt">' + esc(c.soHoSoBoiThuong || '—') + '</td><td>' + esc(c.bienSo || '—') + '</td><td class="wkd-l">' + esc(owner === 'N/A' ? '—' : owner) + '</td><td class="wkd-l">' + esc(row.gdv) + '</td><td class="wkd-l">' + esc(c.tenGaraVietTat || c.tenGara || '—') + '</td><td>' + fmtDate(row.openMs) + '</td><td><span class="wkd-status" style="--c:' + s.color + '">' + esc(s.label) + '</span></td><td class="wkd-r">' + (row.amount ? row.amount.toLocaleString('vi-VN') + ' đ' : '—') + '</td><td class="wkd-l">' + chips + '</td></tr>';
  }).join('');
  const more = rows.length > shown.length ? '<div class="wkd-more"><button type="button" class="btn-premium btn-secondary" onclick="weeklyDetailShowMore()">Xem thêm ' + Math.min(50, rows.length - shown.length) + ' hồ sơ (còn ' + (rows.length - shown.length) + ')</button></div>' : '';
  return '<div class="wkd-sum">' + rows.length.toLocaleString('vi-VN') + ' hồ sơ' + (st.query ? ' khớp “' + esc(st.query) + '”' : '') + '</div>'
    + '<div class="wkd-scroll"><table class="wkd-table"><thead><tr><th>STT</th><th>Số HSBT</th><th>Biển số</th><th>Chủ xe</th><th>GĐV</th><th>Gara</th><th>Ngày mở HS</th><th>Trạng thái</th><th>Số tiền BT</th><th>Thuộc nhóm</th></tr></thead><tbody>'
    + (body || '<tr><td colspan="10" class="wkd-empty">Không có hồ sơ nào trong kỳ theo bộ lọc hiện tại.</td></tr>') + '</tbody></table></div>' + more;
}
function renderWeeklyZoneDetailHtml() {
  const data = weeklyDetailData(), st = weeklyDetailState, esc = escapeHtmlOutput;
  weeklyDetailState.data = data;
  const options = [{id: 'all', label: 'Tất cả hồ sơ trong kỳ'}].concat(WeeklyDetail.BUCKETS).map(b => '<option value="' + b.id + '"' + (st.bucket === b.id ? ' selected' : '') + '>' + esc(b.label) + ' (' + (data.counts[b.id] || 0) + ')</option>').join('');
  return '<section class="wkd-card" id="weeklyDetailCard">'
    + '<div class="wkd-toolbar hide-on-screenshot"><input type="search" class="wkd-search" placeholder="Tìm số HSBT, biển số, chủ xe, GĐV, gara…" value="' + esc(st.query) + '" oninput="weeklyDetailSearch(this.value)" aria-label="Tìm hồ sơ">'
    + '<select class="wkd-select" onchange="weeklyDetailSetBucket(this.value)" aria-label="Nhóm hồ sơ">' + options + '</select>'
    + '<button type="button" class="btn-premium btn-secondary wkd-export" onclick="weeklyDetailExport()">Xuất Excel</button></div>'
    + '<div class="weekly-report-title-block"><span class="weekly-report-eyebrow">CHI TIẾT HỒ SƠ</span><h2>DANH SÁCH HỒ SƠ TRONG KỲ</h2><div class="weekly-report-period">' + esc(data.period.label) + '</div></div>'
    + '<div id="weeklyDetailBody">' + weeklyDetailBodyHtml(data) + '</div></section>';
}
function weeklyDetailRepaint() { const box = document.getElementById('weeklyDetailBody'); if (box && weeklyDetailState.data) box.innerHTML = weeklyDetailBodyHtml(weeklyDetailState.data); }
let weeklyDetailTimer = 0;
function weeklyDetailSearch(value) { clearTimeout(weeklyDetailTimer); weeklyDetailTimer = setTimeout(() => { weeklyDetailState.query = String(value || '').trim(); weeklyDetailState.limit = 50; weeklyDetailRepaint(); }, 180); }
function weeklyDetailSetBucket(id) { weeklyDetailState.bucket = id || 'all'; weeklyDetailState.limit = 50; weeklyDetailRepaint(); }
function weeklyDetailShowMore() { weeklyDetailState.limit += 50; weeklyDetailRepaint(); }
function weeklyDetailExport() {
  const data = weeklyDetailState.data; if (!data) return;
  if (typeof XLSX === 'undefined') { triggerToast('Thư viện Excel đang tải, vui lòng thử lại sau vài giây.', 'warning'); return; }
  const rows = WeeklyDetail.filter(data.rows, weeklyDetailState.bucket, weeklyDetailState.query, extractClaimOwnerName);
  if (!rows.length) { triggerToast('Không có hồ sơ để xuất.', 'warning'); return; }
  const sheet = XLSX.utils.json_to_sheet(rows.map((row, index) => ({
    'STT': index + 1, 'Số HSBT': row.claim.soHoSoBoiThuong || '', 'Biển số': row.claim.bienSo || '', 'Chủ xe': extractClaimOwnerName(row.claim) === 'N/A' ? '' : extractClaimOwnerName(row.claim),
    'GĐV': row.gdv, 'Gara': row.claim.tenGaraVietTat || row.claim.tenGara || '', 'Ngày mở HS': row.openMs ? new Date(row.openMs).toLocaleDateString('vi-VN') : '',
    'Trạng thái': (PENDING_STATUS_MAP[row.claim.trangThai] || {}).label || row.claim.trangThai || '', 'Số tiền bồi thường': row.amount || '',
    'Thuộc nhóm': WeeklyDetail.BUCKETS.filter(b => row.buckets[b.id]).map(b => b.label).join(', ')
  })));
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Chi tiết hồ sơ');
  XLSX.writeFile(book, 'chi-tiet-ho-so-' + data.period.label.replace(/[^0-9]+/g, '-').replace(/^-|-$/g, '') + '.xlsx');
}
