// Báo cáo KPI bồi thường theo Zone: hàm TÍNH THUẦN (không đụng DOM, không gọi mạng).
// Nhận các dòng B001 (mảng object theo tên cột) + tháng cần xem → trả về kết quả.
// Giao diện nằm ở kpi-zone-page.js; kiểm thử ở tests/kpi-zone.test.mjs.
const KpiZoneCalc = (() => {
  const REQUIRED_COLUMNS = {
    id: 'Số hồ sơ bồi thường',
    gdv: 'GĐV HO',
    zone: 'Zone bồi thường',
    open: 'Ngày mở hs',
    approve: 'Tờ trình BT - Ngày duyệt cuối',
    status: 'Trạng thái hồ sơ',
    paid: 'TTBT - Tổng số tiền bồi thường',
    reserve: 'Dự phòng bồi thường',
    damage: 'Ước thiệt hại'
  };

  // Ba GĐV tính KPI mặc định. Chỗ sau này thay bằng bảng Zone → GĐV (ZONE_GDV_MAP) nếu muốn lọc theo Zone.
  const DEFAULT_GDVS = ['Huỳnh Văn Phúc', 'Hồ Quang Huy', 'Nguyễn Quang Huy_DL'];
  const ZONE_GDV_MAP = {}; // ví dụ: {'Đắk Lắk': ['Huỳnh Văn Phúc', ...]}; để trống = lọc theo cột "GĐV HO"

  const STATUSES = ['Mới', 'Đã giám định HT', 'Chờ duyệt PASC', 'Đã duyệt PASC', 'Chờ GĐCT', 'Đã GĐCT',
    'Đã duyệt HSBT', 'Chờ KT duyệt', 'KT duyệt', 'Đã Thanh toán', 'Từ chối'];
  // Tồn chưa giải quyết = còn ở các bước trước khi duyệt HSBT (không gồm "Từ chối").
  const TON_STATUSES = ['Mới', 'Đã giám định HT', 'Chờ duyệt PASC', 'Đã duyệt PASC', 'Chờ GĐCT', 'Đã GĐCT'];
  const REJECTED = 'Từ chối';

  const KPI = {
    completion: {key: 'completion', label: 'Tỷ lệ hồ sơ hoàn thành zone', weight: 0.5, target: 0.9, higherBetter: true},
    cost: {key: 'cost', label: 'CP bình quân', weight: 0.4, target: 3500000, higherBetter: false},
    backlog: {key: 'backlog', label: 'Tỉ lệ tồn hồ sơ', weight: 0.1, target: 0.1, higherBetter: false}
  };
  const COST_CAP = 10000000; // chỉ tính hồ sơ có 0 ≤ ST/DPBT < 10 triệu vào CP bình quân
  const AGE_BUCKETS = [
    {key: 'b1', label: '≤ 3 ngày', max: 3}, {key: 'b2', label: '4–7 ngày', max: 7},
    {key: 'b3', label: '8–14 ngày', max: 14}, {key: 'b4', label: '15–30 ngày', max: 30},
    {key: 'b5', label: '> 30 ngày', max: Infinity}
  ];

  // ---------- Ngày giờ (giờ Việt Nam, không lệch múi giờ) ----------
  // Ngày được giữ dạng "số serial Excel" (ngày + phần lẻ của ngày) và hiểu là GIỜ TƯỜNG VN, nên không phụ thuộc múi giờ máy.
  const EPOCH_MS = Date.UTC(1899, 11, 30);
  const DAY_MS = 86400000;
  const VN_OFFSET_MS = 7 * 3600000;

  function serialFromParts(y, m, d, hh = 0, mm = 0, ss = 0) {
    return (Date.UTC(y, m - 1, d, hh, mm, ss) - EPOCH_MS) / DAY_MS;
  }
  const monthStart = (y, m) => serialFromParts(y, m, 1);
  const monthEndExclusive = (y, m) => (m === 12 ? monthStart(y + 1, 1) : monthStart(y, m + 1));
  function partsOf(serial) {
    const d = new Date(EPOCH_MS + Math.round(serial * 86400) * 1000);
    return {y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate()};
  }

  // Trả về serial, null (ô trống) hoặc NaN (có giá trị nhưng không đọc được).
  function parseDate(value) {
    if (value === null || value === undefined) return null;
    if (Object.prototype.toString.call(value) === '[object Date]') {
      if (Number.isNaN(value.getTime())) return NaN;
      return (value.getTime() + VN_OFFSET_MS - EPOCH_MS) / DAY_MS; // thời điểm thật → giờ VN
    }
    if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : NaN;
    const text = String(value).trim();
    if (!text) return null;
    if (/^\d+(\.\d+)?$/.test(text) && Number(text) > 20000 && Number(text) < 80000) return Number(text);
    let m = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) return validParts(+m[3], +m[2], +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) return validParts(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    return NaN;
  }
  function validParts(y, mo, d, hh, mm, ss) {
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || hh > 23 || mm > 59 || ss > 59) return NaN;
    const serial = serialFromParts(y, mo, d, hh, mm, ss);
    const p = partsOf(serial);
    return p.m === mo && p.d === d ? serial : NaN;
  }

  function parseMoney(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    let text = String(value).replace(/[\s₫đ]|VN[DĐ]/gi, '');
    if (!text) return 0;
    if (/^-?\d{1,3}([.,]\d{3})+$/.test(text)) text = text.replace(/[.,]/g, '');
    else text = text.replace(',', '.');
    const n = Number(text);
    return Number.isFinite(n) ? n : NaN;
  }

  const norm = text => String(text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  const nameKey = text => norm(text).toLowerCase();

  // ---------- Kiểm tra cột & chuẩn hoá dòng ----------
  function validateColumns(headers) {
    const have = new Set((headers || []).map(norm));
    const missing = Object.values(REQUIRED_COLUMNS).filter(name => !have.has(norm(name)));
    return {ok: !missing.length, missing};
  }

  // rows: mảng object {tên cột: giá trị}. Không ném lỗi vì dữ liệu bẩn: gom vào warnings để trang vẫn hiển thị.
  function prepare(rows) {
    const headers = rows && rows.length ? Object.keys(rows[0]) : [];
    const check = validateColumns(headers);
    if (!check.ok) {
      const error = new Error('File B001 thiếu cột: ' + check.missing.map(name => '"' + name + '"').join(', ') + '.');
      error.missing = check.missing;
      throw error;
    }
    // Khoá thật của từng cột (đề phòng tiêu đề có khoảng trắng thừa).
    const real = {};
    for (const [field, name] of Object.entries(REQUIRED_COLUMNS)) real[field] = headers.find(h => norm(h) === norm(name));
    const records = [], seen = new Set();
    const warnings = {noId: 0, duplicate: 0, noOpen: 0, badOpen: 0, badApprove: 0, badMoney: 0, unknownStatus: new Set()};
    for (const row of rows) {
      const id = norm(row[real.id]);
      if (!id) { warnings.noId++; continue; }
      if (seen.has(id)) { warnings.duplicate++; continue; }
      seen.add(id);
      const open = parseDate(row[real.open]);
      if (open === null) { warnings.noOpen++; continue; }
      if (Number.isNaN(open)) { warnings.badOpen++; continue; }
      let approve = parseDate(row[real.approve]);
      if (Number.isNaN(approve)) { warnings.badApprove++; approve = null; }
      let paid = parseMoney(row[real.paid]), reserve = parseMoney(row[real.reserve]), damage = parseMoney(row[real.damage]);
      if (Number.isNaN(paid) || Number.isNaN(reserve) || Number.isNaN(damage)) warnings.badMoney++;
      paid = Number.isNaN(paid) ? 0 : paid; reserve = Number.isNaN(reserve) ? 0 : reserve; damage = Number.isNaN(damage) ? 0 : damage;
      const status = norm(row[real.status]);
      if (status && !STATUSES.includes(status)) warnings.unknownStatus.add(status);
      records.push({
        id, gdv: norm(row[real.gdv]), zone: norm(row[real.zone]), open, approve, status,
        amount: paid > 0 ? paid : reserve, // ST/DPBT: ưu tiên số tiền bồi thường, không có thì lấy dự phòng
        damage
      });
    }
    let asOf = 0;
    for (const r of records) { asOf = Math.max(asOf, r.open, r.approve || 0); }
    return {records, warnings: {...warnings, unknownStatus: [...warnings.unknownStatus]}, asOf, total: rows.length};
  }

  // ---------- Điểm ----------
  const positive = n => typeof n === 'number' && Number.isFinite(n) && n > 0;
  function score(kpi, result) {
    if (!positive(result)) return null; // chia cho 0 / không có dữ liệu → "-"
    const ratio = kpi.higherBetter ? result / kpi.target : kpi.target / result;
    return ratio * kpi.weight;
  }
  const shortfall = (kpi, s) => (s === null ? null : kpi.weight - Math.min(s, kpi.weight));
  const sum = list => list.reduce((a, b) => a + (b === null ? 0 : b), 0);

  function buildKpis(agg) {
    const rows = [
      {kpi: KPI.completion, result: agg.completion},
      {kpi: KPI.cost, result: agg.cost},
      {kpi: KPI.backlog, result: agg.backlogRate}
    ].map(({kpi, result}) => {
      const s = score(kpi, result);
      return {key: kpi.key, label: kpi.label, weight: kpi.weight, target: kpi.target, result: positive(result) ? result : null,
        score: s, cappedScore: s === null ? null : Math.min(s, kpi.weight), shortfall: shortfall(kpi, s),
        pass: s === null ? null : (kpi.higherBetter ? result >= kpi.target : result <= kpi.target)};
    });
    return {
      rows,
      uncapped: sum(rows.map(r => r.score)),
      capped: sum(rows.map(r => r.cappedScore))
    };
  }

  // ---------- Tổng hợp cho một nhóm hồ sơ ----------
  const inRange = (v, a, b) => v !== null && v >= a && v < b;

  function aggregate(recs, ctx) {
    const {start, end, yearStart, estimate} = ctx;
    let issued = 0, approved = 0, ytd = 0, sampleSum = 0, sample = 0, excluded = 0;
    const tonList = [];
    for (const r of recs) {
      const openedInMonth = inRange(r.open, start, end);
      if (openedInMonth) {
        issued++;
        if (r.amount >= 0 && r.amount < COST_CAP) { sample++; sampleSum += r.amount; } else excluded++;
      }
      if (inRange(r.approve, start, end)) approved++;
      if (inRange(r.open, yearStart, end)) ytd++;
      if (r.open < end && isTon(r, end, estimate)) tonList.push(r);
    }
    const completion = issued > 0 ? approved / issued : null;
    const cost = sample > 0 ? sampleSum / sample : null;
    const backlogRate = ytd > 0 ? tonList.length / ytd : null;
    return {issued, approved, completion, sample, excluded, cost, ton: tonList.length, tonList, ytd, backlogRate,
      needMore: Math.max(0, Math.ceil(Math.round(KPI.completion.target * issued * 1e6) / 1e6) - approved)};
  }

  // Tháng đã qua chỉ có thể ước tính: đã mở tới cuối tháng, chưa có ngày duyệt (hoặc duyệt sau tháng đó), không "Từ chối".
  function isTon(r, end, estimate) {
    if (estimate) return (r.approve === null || r.approve >= end) && r.status !== REJECTED;
    return TON_STATUSES.includes(r.status);
  }

  function pickRecords(records, gdvs, zone) {
    const wanted = new Set((gdvs || []).map(nameKey));
    const zoneMap = ZONE_GDV_MAP[zone];
    return records.filter(r => wanted.has(nameKey(r.gdv)) && (!zone || !zoneMap || zoneMap.map(nameKey).includes(nameKey(r.gdv))));
  }

  function daysBetween(refDay, openSerial) { return Math.max(0, Math.floor(refDay) - Math.floor(openSerial)); }

  function bucketOf(days) { return AGE_BUCKETS.find(b => days <= b.max); }

  // ---------- Tính một tháng ----------
  // options: {year, month, gdvs, asOf, zone?}
  function computeMonth(records, options) {
    const {year, month} = options;
    const gdvs = options.gdvs && options.gdvs.length ? options.gdvs : DEFAULT_GDVS;
    const asOf = options.asOf ?? records.reduce((a, r) => Math.max(a, r.open, r.approve || 0), 0);
    const snap = partsOf(asOf);
    const snapIndex = snap.y * 12 + snap.m, index = year * 12 + month;
    const ctx = {start: monthStart(year, month), end: monthEndExclusive(year, month), yearStart: monthStart(year, 1),
      estimate: index < snapIndex};
    const refDay = Math.min(Math.floor(asOf), Math.floor(ctx.end) - 1);
    const picked = pickRecords(records, gdvs, options.zone);

    const total = aggregate(picked, ctx);
    const kpis = buildKpis(total);
    const perGdv = gdvs.map(name => {
      const agg = aggregate(picked.filter(r => nameKey(r.gdv) === nameKey(name)), ctx);
      const open = picked.filter(r => nameKey(r.gdv) === nameKey(name) && inRange(r.open, ctx.start, ctx.end) && r.approve === null).length;
      return {gdv: name, issued: agg.issued, approved: agg.approved, completion: agg.completion, cost: agg.cost,
        sample: agg.sample, ton: agg.ton, ytd: agg.ytd, backlogRate: agg.backlogRate, unapproved: open};
    });

    // Hồ sơ mở trong tháng mà chưa có ngày duyệt (tính tới thời điểm dữ liệu).
    const unapproved = picked.filter(r => inRange(r.open, ctx.start, ctx.end) && r.approve === null)
      .map(r => ({id: r.id, gdv: r.gdv, status: r.status, open: r.open, days: daysBetween(asOf, r.open), damage: r.damage}))
      .sort((a, b) => b.days - a.days);

    const ageBuckets = AGE_BUCKETS.map(b => ({key: b.key, label: b.label, count: 0}));
    const byStatus = {};
    for (const r of total.tonList) {
      ageBuckets.find(b => b.key === bucketOf(daysBetween(refDay, r.open)).key).count++;
      const status = r.status || '(trống)';
      byStatus[status] = (byStatus[status] || 0) + 1;
    }

    const {tonList, ...totals} = total;
    return {year, month, estimate: ctx.estimate, asOf, futureMonth: index > snapIndex, gdvs, totals, kpis, perGdv, unapproved,
      ageBuckets, byStatus: Object.entries(byStatus).map(([status, count]) => ({status, count})).sort((a, b) => b.count - a.count),
      needMore: total.needMore, target: Math.ceil(Math.round(KPI.completion.target * total.issued * 1e6) / 1e6)};
  }

  function previousMonth(year, month) { return month === 1 ? {year: year - 1, month: 12} : {year, month: month - 1}; }

  // Tháng chọn + tháng liền trước + chênh lệch.
  function computeReport(records, options) {
    const current = computeMonth(records, options);
    const p = previousMonth(options.year, options.month);
    const previous = computeMonth(records, {...options, year: p.year, month: p.month});
    const diff = (a, b) => (a === null || b === null || a === undefined || b === undefined ? null : a - b);
    const compare = {
      issued: diff(current.totals.issued, previous.totals.issued),
      approved: diff(current.totals.approved, previous.totals.approved),
      completion: diff(current.totals.completion, previous.totals.completion),
      cost: diff(current.totals.cost, previous.totals.cost),
      ton: diff(current.totals.ton, previous.totals.ton),
      backlogRate: diff(current.totals.backlogRate, previous.totals.backlogRate),
      uncapped: diff(current.kpis.uncapped, previous.kpis.uncapped),
      capped: diff(current.kpis.capped, previous.kpis.capped)
    };
    return {current, previous, compare};
  }

  // Danh sách GĐV có trong dữ liệu (để người dùng chọn thêm), kèm số hồ sơ.
  function listGdvs(records) {
    const map = new Map();
    for (const r of records) {
      const key = nameKey(r.gdv);
      if (!key) continue;
      const item = map.get(key) || {name: r.gdv, count: 0};
      item.count++; map.set(key, item);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }

  // ---------- Định dạng hiển thị ----------
  const dash = '-';
  const fmtInt = n => (n === null || n === undefined || Number.isNaN(n) ? dash : Math.round(n).toLocaleString('vi-VN'));
  const fmtPct = (n, digits = 1) => (n === null || n === undefined || Number.isNaN(n) ? dash : (n * 100).toFixed(digits).replace('.', ',') + '%');
  const fmtScore = n => (n === null || n === undefined || Number.isNaN(n) ? dash : n.toFixed(4).replace('.', ','));
  function fmtDate(serial) {
    if (serial === null || serial === undefined) return dash;
    const p = partsOf(serial);
    return String(p.d).padStart(2, '0') + '/' + String(p.m).padStart(2, '0') + '/' + p.y;
  }

  return {REQUIRED_COLUMNS, DEFAULT_GDVS, ZONE_GDV_MAP, STATUSES, TON_STATUSES, KPI, COST_CAP, AGE_BUCKETS,
    parseDate, parseMoney, validateColumns, prepare, score, computeMonth, computeReport, previousMonth, listGdvs,
    monthStart, monthEndExclusive, partsOf, serialFromParts, fmtInt, fmtPct, fmtScore, fmtDate, nameKey};
})();
