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

  const STATUSES = ['Mới', 'Chờ giám định HT', 'Đã giám định HT', 'Chờ duyệt PASC', 'Đã duyệt PASC', 'Chờ GĐCT', 'Đã GĐCT',
    'Đã duyệt HSBT', 'Chờ duyệt HSBT', 'Chờ duyệt ĐNTT', 'Chờ KT duyệt', 'KT duyệt', 'Đã Thanh toán', 'Từ chối'];
  // Tồn chưa giải quyết = còn ở các bước trước khi duyệt HSBT (không gồm "Từ chối").
  const TON_STATUSES = ['Mới', 'Chờ giám định HT', 'Đã giám định HT', 'Chờ duyệt PASC', 'Đã duyệt PASC', 'Chờ GĐCT', 'Đã GĐCT'];
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
    if (typeof value === 'number') {
      if (value >= 1e11) return (value + VN_OFFSET_MS - EPOCH_MS) / DAY_MS; // mốc thời gian (ms) do ứng dụng lưu
      return Number.isFinite(value) && value > 0 ? value : NaN;
    }
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

  // Hồ sơ bồi thường trong hệ thống (pending_claims, do nhập từ B001): chuyển về cùng dạng bản ghi để tính.
  // statusMap: {khoá: {label}} (PENDING_STATUS_MAP) để đổi mã trạng thái thành tên hiển thị.
  const FIELD_FALLBACK = {gdv: ['gdvHo', 'gdvTiepNhan'], approve: ['toTrinhNgayDuyet', 'toTrinhBtNgayDuyet', 'ngayDuyetHsbt']};
  const firstFilled = (c, names) => { for (const n of names) { const v = c[n]; if (v !== undefined && v !== null && String(v).trim() !== '' && v !== '—' && v !== '-') return v; } return null; };
  function statusLabel(raw, statusMap) {
    const text = norm(raw), lower = text.toLowerCase();
    for (const [key, info] of Object.entries(statusMap || {})) if (lower === key || lower === String(info.label).toLowerCase()) return info.label;
    return text;
  }
  function fromClaims(payload, statusMap) {
    const records = [], warnings = {noId: 0, duplicate: 0, noOpen: 0, badOpen: 0, badApprove: 0, badMoney: 0, unknownStatus: new Set()};
    const seen = new Set(); let total = 0;
    for (const [key, c] of Object.entries(payload || {})) {
      if (!c || typeof c !== 'object') continue;
      total++;
      const id = norm(c.soHoSoBoiThuong || c.maVuTonThat || key);
      if (seen.has(id)) { warnings.duplicate++; continue; }
      seen.add(id);
      const open = parseDate(firstFilled(c, ['ngayMoHs']));
      if (open === null) { warnings.noOpen++; continue; }
      if (Number.isNaN(open)) { warnings.badOpen++; continue; }
      let approve = parseDate(firstFilled(c, FIELD_FALLBACK.approve));
      if (Number.isNaN(approve)) { warnings.badApprove++; approve = null; }
      let paid = parseMoney(c.ttbtTongSoTienBoiThuong), reserve = parseMoney(c.duPhongBoiThuong), damage = parseMoney(c.uocThietHai);
      if (Number.isNaN(paid) || Number.isNaN(reserve) || Number.isNaN(damage)) warnings.badMoney++;
      paid = Number.isNaN(paid) ? 0 : paid; reserve = Number.isNaN(reserve) ? 0 : reserve; damage = Number.isNaN(damage) ? 0 : damage;
      const status = statusLabel(c.trangThai, statusMap);
      if (status && !STATUSES.includes(status)) warnings.unknownStatus.add(status);
      records.push({id, gdv: norm(firstFilled(c, FIELD_FALLBACK.gdv)), zone: norm(c.zoneBoiThuong), open, approve, status,
        amount: paid > 0 ? paid : reserve, damage});
    }
    let asOf = 0;
    for (const r of records) asOf = Math.max(asOf, r.open, r.approve || 0);
    return {records, warnings: {...warnings, unknownStatus: [...warnings.unknownStatus]}, asOf, total};
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
    const tonList = [], leads = [], amounts = [];
    for (const r of recs) {
      const openedInMonth = inRange(r.open, start, end);
      if (openedInMonth) {
        issued++; amounts.push(r.amount);
        if (r.amount >= 0 && r.amount < COST_CAP) { sample++; sampleSum += r.amount; } else excluded++;
      }
      if (inRange(r.approve, start, end)) { approved++; leads.push(Math.max(0, Math.floor(r.approve) - Math.floor(r.open))); }
      if (inRange(r.open, yearStart, end)) ytd++;
      if (r.open < end && isTon(r, end, estimate)) tonList.push(r);
    }
    const completion = issued > 0 ? approved / issued : null;
    const cost = sample > 0 ? sampleSum / sample : null;
    const backlogRate = ytd > 0 ? tonList.length / ytd : null;
    return {issued, approved, completion, sample, excluded, cost, ton: tonList.length, tonList, ytd, backlogRate, leads, amounts,
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
      const tonAges = agg.tonList.map(r => daysBetween(refDay, r.open));
      const need = Math.ceil(Math.round(KPI.completion.target * agg.issued * 1e6) / 1e6);
      const open = picked.filter(r => nameKey(r.gdv) === nameKey(name) && inRange(r.open, ctx.start, ctx.end) && r.approve === null).length;
      return {gdv: name, issued: agg.issued, approved: agg.approved, completion: agg.completion, cost: agg.cost,
        gap: need - agg.approved, // dương = còn thiếu so với 90%, âm = đang dư
        ages: bucketCounts(tonAges), tonOver30: tonAges.filter(d => d > 30).length, lead: describe(agg.leads),
        costDescribe: describe(agg.amounts.filter(a => a >= 0 && a < COST_CAP)),
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

    const lead = describe(total.leads);
    const analysis = {
      lead: {...lead, buckets: bucketCounts(total.leads)},
      cost: {buckets: histogram(COST_BUCKETS, total.amounts), ...describe(total.amounts.filter(a => a >= 0 && a < COST_CAP)),
        outlierCount: total.amounts.filter(a => a >= COST_CAP || a < 0).length,
        outlierSum: total.amounts.filter(a => a >= COST_CAP).reduce((a, b) => a + b, 0)},
      tonOver30: total.tonList.filter(r => daysBetween(refDay, r.open) > 30).length,
      // Mỗi hồ sơ duyệt thêm làm điểm hoàn thành tăng bao nhiêu (0 khi đã đạt mục tiêu vì điểm bị giới hạn).
      marginalApproval: total.issued > 0 && total.approved < Math.ceil(Math.round(KPI.completion.target * total.issued * 1e6) / 1e6)
        ? KPI.completion.weight / (KPI.completion.target * total.issued) : 0,
      // Số hồ sơ tồn có thể phát sinh thêm mà vẫn không vượt 10% (âm = cần giải quyết bớt).
      backlogHeadroom: total.ytd > 0 ? Math.floor(Math.round(KPI.backlog.target * total.ytd * 1e6) / 1e6) - total.ton : null,
      costGap: total.cost === null ? null : total.cost - KPI.cost.target
    };
    const {tonList, leads, amounts, ...totals} = total;
    const result = {year, month, estimate: ctx.estimate, asOf, futureMonth: index > snapIndex, gdvs, totals, kpis, perGdv, unapproved, analysis,
      ageBuckets, byStatus: Object.entries(byStatus).map(([status, count]) => ({status, count})).sort((a, b) => b.count - a.count),
      needMore: total.needMore, target: Math.ceil(Math.round(KPI.completion.target * total.issued * 1e6) / 1e6)};
    result.pace = buildPace(result, ctx, asOf);
    return result;
  }

  // ---------- Phân tích chuyên sâu ----------
  function quantile(sorted, q) {
    if (!sorted.length) return null;
    const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }
  function describe(list) {
    if (!list.length) return {n: 0, mean: null, median: null, p90: null, max: null};
    const sorted = [...list].sort((a, b) => a - b);
    return {n: list.length, mean: sorted.reduce((a, b) => a + b, 0) / sorted.length, median: quantile(sorted, 0.5), p90: quantile(sorted, 0.9), max: sorted[sorted.length - 1]};
  }
  const COST_BUCKETS = [
    {key: 'c1', label: 'Dưới 1 triệu', max: 1e6}, {key: 'c2', label: '1–2 triệu', max: 2e6}, {key: 'c3', label: '2–3,5 triệu', max: 3.5e6},
    {key: 'c4', label: '3,5–5 triệu', max: 5e6}, {key: 'c5', label: '5–10 triệu', max: COST_CAP}, {key: 'c6', label: 'Từ 10 triệu (loại)', max: Infinity}
  ];
  function histogram(buckets, values) {
    const out = buckets.map(b => ({key: b.key, label: b.label, count: 0, excluded: b.max === Infinity}));
    for (const v of values) { const i = buckets.findIndex(b => v < b.max); out[i < 0 ? out.length - 1 : i].count++; }
    return out;
  }
  const bucketCounts = list => { const c = AGE_BUCKETS.map(b => ({key: b.key, label: b.label, count: 0})); for (const d of list) c[AGE_BUCKETS.findIndex(b => d <= b.max)].count++; return c; };

  function daysIn(year, month) { return Math.round(monthEndExclusive(year, month) - monthStart(year, month)); }

  // Nhịp duyệt hiện tại và dự báo cuối tháng (chỉ cho tháng đang chạy).
  function buildPace(c, ctx, asOf) {
    const total = daysIn(c.year, c.month), elapsed = Math.min(total, Math.floor(asOf) - Math.floor(ctx.start) + 1);
    const t = c.totals;
    if (c.estimate || c.futureMonth || elapsed < 1) return null;
    const left = Math.max(0, total - elapsed);
    const perDayApproved = t.approved / elapsed, perDayIssued = t.issued / elapsed;
    const projApproved = t.approved + perDayApproved * left, projIssued = t.issued + perDayIssued * left;
    return {daysInMonth: total, elapsed, left, perDayApproved, perDayIssued, projApproved, projIssued,
      projCompletion: projIssued > 0 ? projApproved / projIssued : null,
      requiredPerDay: left > 0 ? Math.max(0, c.needMore) / left : null};
  }

  function previousMonth(year, month) { return month === 1 ? {year: year - 1, month: 12} : {year, month: month - 1}; }

  // Chuỗi các tháng gần nhất (mặc định 12) để xem xu hướng; tháng đã qua có tồn ước tính.
  function computeTrend(records, options, months = 12) {
    const out = [];
    let y = options.year, m = options.month;
    for (let i = 0; i < months; i++) {
      const r = computeMonth(records, {...options, year: y, month: m});
      out.unshift({year: y, month: m, label: 'T' + m + (m === 1 || i === months - 1 ? '/' + String(y).slice(2) : ''), estimate: r.estimate, futureMonth: r.futureMonth,
        issued: r.totals.issued, approved: r.totals.approved, completion: r.totals.completion, cost: r.totals.cost, ton: r.totals.ton,
        backlogRate: r.totals.backlogRate, capped: r.kpis.capped, uncapped: r.kpis.uncapped, scores: r.kpis.rows.map(k => k.score)});
      const p = previousMonth(y, m); y = p.year; m = p.month;
    }
    return out;
  }

  // Nhận định tự động bằng lời; mỗi mục có mức: good / warn / bad / info.
  function buildInsights(report, trend) {
    const c = report.current, t = c.totals, a = c.analysis, out = [];
    const add = (tone, title, text) => out.push({tone, title, text});
    const pct = fmtPct, int = fmtInt;
    if (c.futureMonth || !t.issued) { add('info', 'Chưa có số liệu', 'Tháng này chưa có hồ sơ phát sinh trong dữ liệu hiện có.'); return out; }
    if (c.estimate) add('info', 'Tháng đã qua', 'Tồn của tháng này là ước tính (hồ sơ mở tới cuối tháng, chưa có ngày duyệt hoặc duyệt sau đó, không bị từ chối), nên điểm tồn có thể lệch nhẹ so với thời điểm đó.');

    // 1. Hoàn thành
    if (t.completion !== null) {
      if (t.completion >= KPI.completion.target) add('good', 'Hoàn thành đạt mục tiêu', 'Đã duyệt ' + int(t.approved) + '/' + int(t.issued) + ' hồ sơ phát sinh (' + pct(t.completion) + '), vượt mức 90%. Điểm hoàn thành bị giới hạn ở ' + KPI.completion.weight + ' nên duyệt thêm không làm tăng điểm tháng.');
      else {
        let text = 'Mới duyệt ' + int(t.approved) + '/' + int(t.issued) + ' (' + pct(t.completion) + '), còn thiếu ' + int(c.needMore) + ' hồ sơ để đạt 90%.';
        if (c.pace && c.pace.left > 0) text += ' Còn ' + c.pace.left + ' ngày: cần duyệt ' + c.pace.requiredPerDay.toFixed(1).replace('.', ',') + ' hồ sơ/ngày, trong khi nhịp hiện tại là ' + c.pace.perDayApproved.toFixed(1).replace('.', ',') + '. Giữ nhịp này, cuối tháng dự kiến đạt khoảng ' + pct(c.pace.projCompletion) + '.';
        else if (c.pace) text += ' Dữ liệu đã tới cuối tháng.';
        if (a.marginalApproval > 0) text += ' Mỗi hồ sơ duyệt thêm cộng khoảng ' + (a.marginalApproval).toFixed(4).replace('.', ',') + ' điểm.';
        add(t.completion >= 0.75 ? 'warn' : 'bad', 'Hoàn thành chưa đạt', text);
      }
    }
    // 2. Chi phí
    if (t.cost !== null) {
      const over = t.cost > KPI.cost.target;
      let text = 'CP bình quân ' + int(t.cost) + ' đ (mục tiêu ' + int(KPI.cost.target) + ' đ), mẫu ' + int(t.sample) + ' hồ sơ.';
      if (a.cost.median !== null && t.cost > a.cost.median * 1.15) text += ' Trung vị chỉ ' + int(a.cost.median) + ' đ: vài hồ sơ giá trị cao đang kéo trung bình lên.';
      if (a.cost.outlierCount) text += ' ' + int(a.cost.outlierCount) + ' hồ sơ từ 10 triệu (tổng ' + int(a.cost.outlierSum / 1e6) + ' triệu) đã được loại khỏi mẫu theo quy định.';
      add(over ? 'warn' : 'good', over ? 'Chi phí vượt mục tiêu' : 'Chi phí trong mục tiêu', text);
    }
    // 3. Tồn
    if (t.backlogRate !== null) {
      const ok = t.backlogRate <= KPI.backlog.target;
      let text = 'Tồn lũy kế ' + int(t.ton) + ' hồ sơ trên ' + int(t.ytd) + ' hồ sơ phát sinh từ đầu năm (' + pct(t.backlogRate, 2) + ', mục tiêu 10%).';
      text += a.backlogHeadroom >= 0 ? ' Còn dư địa ' + int(a.backlogHeadroom) + ' hồ sơ tồn trước khi vượt 10%.' : ' Cần giải quyết bớt ' + int(-a.backlogHeadroom) + ' hồ sơ để về dưới 10%.';
      if (a.tonOver30 > 0 && t.ton > 0) text += ' ' + int(a.tonOver30) + ' hồ sơ tồn quá 30 ngày (' + pct(a.tonOver30 / t.ton, 0) + ' số tồn).';
      add(ok ? (a.tonOver30 / Math.max(1, t.ton) > 0.4 ? 'warn' : 'good') : 'bad', ok ? 'Tồn trong mục tiêu' : 'Tồn vượt mục tiêu', text);
    }
    // 4. Theo GĐV
    const withData = c.perGdv.filter(g => g.issued >= 5 && g.completion !== null);
    if (withData.length > 1) {
      const sorted = [...withData].sort((x, y) => x.completion - y.completion), low = sorted[0], high = sorted[sorted.length - 1];
      if (high.completion - low.completion >= 0.15) add('warn', 'Chênh lệch giữa các GĐV', low.gdv + ' hoàn thành ' + pct(low.completion) + ' (thiếu ' + int(Math.max(0, low.gap)) + ' hồ sơ), trong khi ' + high.gdv + ' đạt ' + pct(high.completion) + '. KPI tính gộp nên GĐV dư có thể bù cho GĐV thiếu, nhưng nên cân đối lại hồ sơ.');
    }
    const heaviest = [...c.perGdv].sort((x, y) => y.ton - x.ton)[0];
    if (heaviest && t.ton > 0 && heaviest.ton / t.ton >= 0.45 && c.perGdv.length > 1) add('warn', 'Tồn tập trung', heaviest.gdv + ' giữ ' + int(heaviest.ton) + '/' + int(t.ton) + ' hồ sơ tồn (' + pct(heaviest.ton / t.ton, 0) + '), tỉ lệ tồn riêng ' + pct(heaviest.backlogRate, 1) + '.');
    // 5. Điểm bị cắt
    const capped = c.kpis.rows.filter(k => k.score !== null && k.score > k.weight);
    if (capped.length) add('info', 'Điểm vượt tỷ trọng bị cắt', capped.map(k => k.label + ' (' + fmtScore(k.score) + '/' + k.weight + ')').join('; ') + '. Phần vượt không bù được cho nhóm khác: tổng có giới hạn ' + fmtScore(c.kpis.capped) + ', chưa giới hạn ' + fmtScore(c.kpis.uncapped) + '.');
    // 6. Xu hướng
    const series = (trend || []).filter(x => !x.futureMonth && x.issued > 0);
    if (series.length >= 4) {
      const last = series[series.length - 1], best = [...series].sort((x, y) => y.capped - x.capped)[0], worst = [...series].sort((x, y) => x.capped - y.capped)[0];
      const avg3 = series.slice(-4, -1).reduce((acc, x) => acc + x.capped, 0) / 3;
      add(last.capped >= avg3 ? 'good' : 'warn', 'Xu hướng ' + series.length + ' tháng', 'Điểm có giới hạn tháng này ' + fmtScore(last.capped) + ', ' + (last.capped >= avg3 ? 'cao hơn' : 'thấp hơn') + ' trung bình 3 tháng trước (' + fmtScore(avg3) + '). Cao nhất T' + best.month + '/' + best.year + ' (' + fmtScore(best.capped) + '), thấp nhất T' + worst.month + '/' + worst.year + ' (' + fmtScore(worst.capped) + ').');
    }
    // 7. Thời gian xử lý
    if (a.lead.n >= 5 && a.lead.median !== null) add('info', 'Thời gian xử lý', 'Hồ sơ duyệt trong tháng có thời gian từ lúc mở tới lúc duyệt trung vị ' + a.lead.median.toFixed(0) + ' ngày, 9/10 hồ sơ xong trong ' + a.lead.p90.toFixed(0) + ' ngày.');
    return out;
  }

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
    const trend = computeTrend(records, options, options.trendMonths || 12);
    return {current, previous, compare, trend, insights: buildInsights({current, previous}, trend)};
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
    parseDate, parseMoney, validateColumns, prepare, fromClaims, computeTrend, buildInsights, COST_BUCKETS, describe, score, computeMonth, computeReport, previousMonth, listGdvs,
    monthStart, monthEndExclusive, partsOf, serialFromParts, fmtInt, fmtPct, fmtScore, fmtDate, nameKey};
})();
