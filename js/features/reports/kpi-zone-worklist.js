// Cảnh báo hồ sơ tồn / sắp quá hạn + danh sách "việc cần xử lý hôm nay" theo từng GĐV (Zone Đắk Lắk).
// Hồ sơ tồn chiếm 10% KPI (càng thấp càng tốt), nên file này chỉ chọn đúng các hồ sơ mà KpiZoneCalc đang tính là "tồn"
// (cùng quy tắc gán zone/GĐV, cùng danh sách trạng thái) rồi xếp mức cảnh báo theo tuổi hồ sơ. Không đụng DOM, không gọi mạng.
const KpiWorklist = (() => {
  // Hồ sơ đang chờ bên khác duyệt: GĐV không tự xử lý được, việc cần làm là đôn đốc.
  const CHASE = {'Chờ duyệt PASC': 'Đôn đốc PASC duyệt', 'Chờ GĐCT': 'Đôn đốc GĐCT duyệt'};
  const DO_IT = 'GĐV xử lý bước tiếp theo';
  const LIMITS = [7, 10, 14, 21, 30];
  const DEFAULT_LIMIT = 30; // trùng mốc "tồn > 30 ngày" của báo cáo KPI
  const LEVELS = {over: {rank: 0, label: 'Quá hạn'}, soon: {rank: 1, label: 'Sắp quá hạn'}, ok: {rank: 2, label: 'Trong hạn'}};

  const cleanLimit = value => { const n = Math.floor(Number(value)); return Number.isFinite(n) && n >= 1 && n <= 365 ? n : DEFAULT_LIMIT; };
  // Cửa sổ "sắp quá hạn" = khoảng 1/4 hạn, tối thiểu 2 ngày (hạn 30 ngày → cảnh báo từ ngày 22).
  const soonWindow = limit => Math.max(2, Math.round(limit / 4));

  function levelOf(days, limit) {
    const lim = cleanLimit(limit);
    if (days > lim) return 'over';
    if (days >= lim - soonWindow(lim)) return 'soon';
    return 'ok';
  }
  const nextAction = status => CHASE[status] || DO_IT;
  const isChase = status => Object.prototype.hasOwnProperty.call(CHASE, status);

  // Số ngày dữ liệu đã cũ so với hôm nay (cả hai là số serial ngày giờ VN). Dữ liệu cũ thì tuổi hồ sơ thực tế còn lớn hơn số hiển thị.
  function staleDays(asOf, nowSerial) {
    if (typeof asOf !== 'number' || typeof nowSerial !== 'number' || !Number.isFinite(asOf) || !Number.isFinite(nowSerial)) return 0;
    return Math.max(0, Math.floor(nowSerial) - Math.floor(asOf));
  }

  // records: kết quả KpiZoneCalc.fromClaims().records. options: {gdvs, zoneMap, asOf, limit}.
  function build(records, K, options = {}) {
    const limit = cleanLimit(options.limit), soonDays = soonWindow(limit);
    const list = Array.isArray(records) ? records : [];
    const gdvs = options.gdvs && options.gdvs.length ? options.gdvs : K.DEFAULT_GDVS;
    const asOf = options.asOf ?? list.reduce((a, r) => Math.max(a, r.open, r.approve || 0), 0);
    const empty = {limit, soonDays, asOf: asOf || null, empty: true, totals: {ton: 0, ytd: 0, backlogRate: null, headroom: null, needResolve: 0},
      counts: {over: 0, soon: 0, ok: 0, todo: 0, chase: 0}, groups: [], items: []};
    if (!list.length || !asOf) return empty;

    const snap = K.partsOf(asOf), end = K.monthEndExclusive(snap.y, snap.m), ref = Math.floor(asOf);
    // Số liệu tổng lấy đúng từ báo cáo KPI của tháng chứa ngày dữ liệu, để con số trên cảnh báo khớp với báo cáo.
    const month = K.computeMonth(list, {year: snap.y, month: snap.m, gdvs, zoneMap: options.zoneMap, asOf});
    const items = K.pickRecords(list, gdvs, options.zoneMap)
      .filter(r => r.open < end && K.TON_STATUSES.includes(r.status))
      .map(r => {
        const days = K.daysBetween(ref, r.open), level = levelOf(days, limit), status = r.status || '(trống)';
        return {id: r.id, gdv: r.gdv || 'Chưa phân công', status, open: r.open, days, level, chase: isChase(status), action: nextAction(status), damage: r.damage || 0};
      })
      .sort((a, b) => LEVELS[a.level].rank - LEVELS[b.level].rank || b.days - a.days || String(a.id).localeCompare(String(b.id)));

    const tally = rows => {
      const c = {over: 0, soon: 0, ok: 0, total: rows.length, todo: 0, chase: 0};
      for (const r of rows) { c[r.level]++; if (r.level !== 'ok') { c.todo++; if (r.chase) c.chase++; } }
      return c;
    };
    const names = [], seen = new Set();
    for (const n of [...gdvs, ...items.map(i => i.gdv)]) { const k = K.nameKey(n); if (k && !seen.has(k)) { seen.add(k); names.push(n); } }
    const groups = names.map(name => {
      const mine = items.filter(i => K.nameKey(i.gdv) === K.nameKey(name));
      return {gdv: name, counts: tally(mine), items: mine};
    });
    const counts = tally(items);
    const headroom = month.analysis.backlogHeadroom;
    return {limit, soonDays, asOf, empty: false,
      totals: {ton: month.totals.ton, ytd: month.totals.ytd, backlogRate: month.totals.backlogRate, headroom, needResolve: headroom === null ? 0 : Math.max(0, -headroom)},
      counts, groups, items};
  }

  return {LIMITS, DEFAULT_LIMIT, LEVELS, cleanLimit, soonWindow, levelOf, nextAction, isChase, staleDays, build};
})();
