import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/reports/kpi-zone-calc.js', import.meta.url), 'utf8');
const K = vm.runInContext(source + '\n;KpiZoneCalc', vm.createContext({}));
const C = K.REQUIRED_COLUMNS;
const G = ['Huỳnh Văn Phúc', 'Hồ Quang Huy', 'Nguyễn Quang Huy_DL'];

// ----- Bộ dữ liệu tổng hợp khớp các số ở mục 6 của hướng dẫn (không phải dữ liệu thật) -----
function spread(total, count) { const base = Math.floor(total / count), rest = total - base * count; return Array.from({length: count}, (_, i) => base + (i < rest ? 1 : 0)); }
function build() {
  const rows = []; let seq = 0;
  const add = (gdv, open, approve, status, amount) => {
    seq++;
    const useReserve = seq % 2 === 0;
    rows.push({
      [C.id]: 'HS' + String(seq).padStart(5, '0'), [C.gdv]: gdv, [C.zone]: 'Đắk Lắk',
      [C.open]: open, [C.approve]: approve ?? '', [C.status]: status,
      [C.paid]: useReserve ? 0 : amount, [C.reserve]: useReserve ? amount : 0, [C.damage]: 5000000, 'Cột khác': 'x'
    });
  };
  const S = (y, m, d, hh = 9) => K.serialFromParts(y, m, d, hh, 30, 0);
  // Chi phí: mẫu có tổng = mean * size, chia đều; hồ sơ bị loại = 12 triệu.
  const amountsFor = (issued, size, mean) => [...spread(mean * size, size), ...Array(issued - size).fill(12000000)];

  // Tháng 9: 150 hồ sơ mở (60/10/80), mẫu 130, TB 3.612.568; tất cả duyệt trong T9.
  const sepAmounts = amountsFor(150, 130, 3612568);
  const sepGdv = [...Array(60).fill(G[0]), ...Array(10).fill(G[1]), ...Array(80).fill(G[2])];
  sepGdv.forEach((g, i) => add(g, i === 0 ? S(2026, 9, 30, 23) + 0.0166 : S(2026, 9, 1 + (i % 29)), S(2026, 9, 1 + (i % 29), 17), 'Đã Thanh toán', sepAmounts[i]));
  // Tháng 10: 184 hồ sơ mở (88/14/82); chưa duyệt 18/9/35; mẫu 151, TB 3.643.812.
  const octAmounts = amountsFor(184, 151, 3643812);
  const octPlan = [[G[0], 88, 18], [G[1], 14, 9], [G[2], 82, 35]];
  let k = 0;
  for (const [g, n, pending] of octPlan) for (let i = 0; i < n; i++, k++) {
    const day = 1 + (k % 29), blank = i < pending;
    add(g, S(2026, 10, day), blank ? null : S(2026, 10, Math.min(30, day + 1), 14), blank ? TONS[i % TONS.length] : 'Đã duyệt HSBT', octAmounts[k]);
  }
  // Jan–Aug: 1111 hồ sơ (564/445/102). Trong đó: tồn cũ 7/18/27, 4 hồ sơ lệch (Phúc), duyệt T10 7/2/7, duyệt T9 23.
  const quota = {[G[0]]: 564, [G[1]]: 445, [G[2]]: 102};
  const old = {[G[0]]: {ton: 7, odd: 4, oct: 7, sep: 12}, [G[1]]: {ton: 18, odd: 0, oct: 2, sep: 6}, [G[2]]: {ton: 27, odd: 0, oct: 7, sep: 5}};
  for (const g of G) {
    const o = old[g]; let n = 0;
    const push = (count, approve, status) => { for (let i = 0; i < count; i++, n++) add(g, S(2026, 1 + (n % 8), 1 + (n % 27)), approve && approve(i), status, 3000000); };
    push(o.ton, null, 'Chờ duyệt PASC');
    push(o.odd, null, 'Đã Thanh toán');
    push(o.oct, i => S(2026, 10, 2 + i), 'Đã duyệt HSBT');
    push(o.sep, i => S(2026, 9, 3 + i), 'Đã duyệt HSBT');
    push(quota[g] - n, () => S(2026, 8, 20), 'Đã Thanh toán');
  }
  // Người khác (không tính KPI) và một hồ sơ mở cuối ngày dữ liệu để asOf = 30/10.
  for (let i = 0; i < 30; i++) add('TT247-Võ Trung Minh Triều', S(2026, 10, i === 29 ? 30 : 1 + (i % 28), 8), null, 'Mới', 1000000);
  return rows;
}
const TONS = ['Mới', 'Đã giám định HT', 'Chờ duyệt PASC', 'Đã duyệt PASC', 'Chờ GĐCT', 'Đã GĐCT'];

const rows = build();
const near = (actual, expected, tol = 0.0001) => assert.ok(Math.abs(actual - expected) <= tol, actual + ' != ' + expected);

test('tháng 10/2026 khớp mục 6', () => {
  const prep = K.prepare(rows);
  const m = K.computeMonth(prep.records, {year: 2026, month: 10, gdvs: G, asOf: prep.asOf});
  assert.equal(m.estimate, false);
  const t = m.totals;
  assert.deepEqual([t.issued, t.approved, t.sample, t.excluded, t.ton, t.ytd], [184, 138, 151, 33, 114, 1445]);
  near(t.completion, 0.75, 1e-9);
  near(t.cost, 3643812, 0.5);
  near(t.backlogRate, 0.0789, 0.0001);
  const [c, p, b] = m.kpis.rows;
  near(c.score, 0.4167); near(p.score, 0.3842); near(b.score, 0.1268);
  near(m.kpis.uncapped, 0.9276); near(m.kpis.capped, 0.9009);
  assert.equal(m.needMore, 28); assert.equal(m.target, 166);
  assert.equal(m.unapproved.length, 62);
  const by = Object.fromEntries(m.perGdv.map(x => [x.gdv, [x.issued, x.approved, x.unapproved, x.ton, x.ytd]]));
  assert.deepEqual(by[G[0]], [88, 77, 18, 25, 712]);
  assert.deepEqual(by[G[1]], [14, 7, 9, 27, 469]);
  assert.deepEqual(by[G[2]], [82, 54, 35, 62, 264]);
});

test('tháng 9/2026 khớp mục 6 và tồn là ước tính', () => {
  const prep = K.prepare(rows);
  const m = K.computeMonth(prep.records, {year: 2026, month: 9, gdvs: G, asOf: prep.asOf});
  assert.equal(m.estimate, true);
  const t = m.totals;
  assert.deepEqual([t.issued, t.approved, t.sample, t.excluded, t.ton, t.ytd], [150, 173, 130, 20, 72, 1261]);
  near(t.completion, 1.1533, 0.0001); near(t.cost, 3612568, 0.5); near(t.backlogRate, 0.0571, 0.0001);
  const [c, p, b] = m.kpis.rows;
  near(c.score, 0.6407); near(p.score, 0.3875); near(b.score, 0.1751);
  near(m.kpis.uncapped, 1.2034); near(m.kpis.capped, 0.9875);
  assert.equal(m.needMore, 0); // đã vượt 90%
});

test('so sánh với tháng trước và GĐV ngoài danh sách bị loại', () => {
  const prep = K.prepare(rows);
  const r = K.computeReport(prep.records, {year: 2026, month: 10, gdvs: G, asOf: prep.asOf});
  near(r.compare.uncapped, 0.9276 - 1.2034); near(r.compare.capped, 0.9009 - 0.9875);
  assert.equal(r.compare.issued, 34);
  const all = K.computeMonth(prep.records, {year: 2026, month: 10, gdvs: [...G, 'TT247-Võ Trung Minh Triều'], asOf: prep.asOf});
  assert.equal(all.totals.issued, 214);
  assert.equal(K.listGdvs(prep.records).length, 4);
});

test('bậc tuổi tồn cộng đủ tổng tồn, theo trạng thái cũng đủ', () => {
  const prep = K.prepare(rows);
  const m = K.computeMonth(prep.records, {year: 2026, month: 10, gdvs: G, asOf: prep.asOf});
  assert.equal(m.ageBuckets.reduce((a, b) => a + b.count, 0), 114);
  assert.equal(m.byStatus.reduce((a, b) => a + b.count, 0), 114);
  assert.ok(m.byStatus.every(x => K.TON_STATUSES.includes(x.status)));
  assert.ok(m.unapproved.every((x, i, a) => !i || a[i - 1].days >= x.days));
});

test('công thức: điểm hụt, mẫu 0 hoặc kết quả 0 hiện "-" và không lỗi', () => {
  near(K.score(K.KPI.completion, 0.45), 0.25, 1e-9);
  near(K.score(K.KPI.cost, 7000000), 0.2, 1e-9);
  assert.equal(K.score(K.KPI.cost, 0), null);
  assert.equal(K.score(K.KPI.backlog, null), null);
  const empty = K.computeMonth(K.prepare(rows).records, {year: 2026, month: 12, gdvs: G, asOf: K.prepare(rows).asOf});
  assert.equal(empty.futureMonth, true);
  assert.equal(empty.kpis.rows[0].score, null);
  assert.equal(K.fmtScore(null), '-'); assert.equal(K.fmtPct(null), '-');
  const short = K.computeMonth(K.prepare(rows).records, {year: 2026, month: 10, gdvs: G, asOf: K.prepare(rows).asOf}).kpis.rows[0];
  near(short.shortfall, 0.5 - 0.4167);
});

test('ngày giờ: không lệch múi giờ, đọc được serial, chuỗi và Date', () => {
  const s = K.parseDate(K.serialFromParts(2026, 9, 30, 23, 59, 59));
  assert.deepEqual({...K.partsOf(s)}, {y: 2026, m: 9, d: 30});
  assert.deepEqual({...K.partsOf(K.parseDate('01/10/2026 00:00:01'))}, {y: 2026, m: 10, d: 1});
  assert.deepEqual({...K.partsOf(K.parseDate('2026-10-31 08:00'))}, {y: 2026, m: 10, d: 31});
  assert.deepEqual({...K.partsOf(K.parseDate(new Date('2026-09-30T17:30:00Z')))}, {y: 2026, m: 10, d: 1}); // 00:30 giờ VN
  assert.equal(K.parseDate(''), null); assert.ok(Number.isNaN(K.parseDate('abc'))); assert.ok(Number.isNaN(K.parseDate('31/02/2026')));
  assert.equal(K.parseMoney('1.234.567'), 1234567); assert.equal(K.parseMoney(''), 0);
});

test('thiếu cột báo rõ tên cột; dữ liệu bẩn vào cảnh báo, không làm hỏng', () => {
  const bad = rows.slice(0, 3).map(r => { const { [C.damage]: _, ...rest } = r; return rest; });
  assert.throws(() => K.prepare(bad), /"Ước thiệt hại"/);
  const dirty = [{...rows[0]}, {...rows[0]}, {...rows[1], [C.open]: 'hỏng'}, {...rows[2], [C.id]: ''}, {...rows[3], [C.approve]: 'xx'}];
  const prep = K.prepare(dirty);
  assert.equal(prep.records.length, 2);
  assert.equal(prep.warnings.duplicate, 1); assert.equal(prep.warnings.badOpen, 1); assert.equal(prep.warnings.noId, 1); assert.equal(prep.warnings.badApprove, 1);
});

test('khoảng 3.000 dòng tính dưới 1 giây', () => {
  const big = []; while (big.length < 3000) big.push(...rows);
  big.length = 3000; big.forEach((r, i) => { r[C.id] = 'X' + i; });
  const t0 = performance.now();
  const prep = K.prepare(big);
  K.computeReport(prep.records, {year: 2026, month: 10, gdvs: G, asOf: prep.asOf});
  assert.ok(performance.now() - t0 < 1000);
});

// ----- Dữ liệu lấy từ hồ sơ bồi thường trong hệ thống (pending_claims) -----
const STATUS_KEYS = {'Mới': 'moi', 'Chờ duyệt PASC': 'cho_duyet_pasc', 'Đã giám định HT': 'da_giam_dinh_ht', 'Đã duyệt PASC': 'da_duyet_pasc',
  'Chờ GĐCT': 'cho_gdct', 'Đã GĐCT': 'da_gdct', 'Đã duyệt HSBT': 'da_duyet_hsbt', 'Đã Thanh toán': 'da_thanh_toan'};
const STATUS_MAP = Object.fromEntries(Object.entries(STATUS_KEYS).map(([label, key]) => [key, {label}]));
function toClaims(list) {
  const out = {};
  list.forEach((r, i) => {
    const asText = serial => { const p = K.partsOf(serial); const frac = serial - Math.floor(serial); const mins = Math.round(frac * 1440);
      return String(p.d).padStart(2, '0') + '/' + String(p.m).padStart(2, '0') + '/' + p.y + ' ' + String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0'); };
    const asMs = serial => Date.UTC(1899, 11, 30) + serial * 86400000 - 7 * 3600000;
    out['-N' + i] = {
      soHoSoBoiThuong: r[C.id], gdvHo: r[C.gdv], zoneBoiThuong: r[C.zone], trangThai: i % 2 ? STATUS_KEYS[r[C.status]] : r[C.status],
      ngayMoHs: i % 3 ? asText(r[C.open]) : asMs(r[C.open]), toTrinhNgayDuyet: r[C.approve] === '' ? '' : (i % 3 ? asText(r[C.approve]) : asMs(r[C.approve])),
      ttbtTongSoTienBoiThuong: r[C.paid] ? String(r[C.paid]).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '0', duPhongBoiThuong: r[C.reserve], uocThietHai: r[C.damage]
    };
  });
  return out;
}

test('lấy từ hồ sơ bồi thường trong hệ thống cho cùng kết quả mục 6', () => {
  const prep = K.fromClaims(toClaims(rows), STATUS_MAP);
  assert.equal(prep.records.length, rows.length);
  assert.equal(prep.warnings.unknownStatus.length, 0);
  const r = K.computeReport(prep.records, {year: 2026, month: 10, gdvs: G, asOf: prep.asOf});
  const t = r.current.totals;
  assert.deepEqual([t.issued, t.approved, t.ton, t.ytd, t.sample, t.excluded], [184, 138, 114, 1445, 151, 33]);
  near(r.current.kpis.uncapped, 0.9276); near(r.current.kpis.capped, 0.9009);
  near(r.previous.kpis.uncapped, 1.2034); assert.equal(r.previous.totals.ton, 72);
});

test('hồ sơ thiếu ngày mở hoặc trùng số hồ sơ vào cảnh báo, không làm hỏng', () => {
  const claims = toClaims(rows.slice(0, 4));
  claims['-N1'].ngayMoHs = ''; claims['-N2'].soHoSoBoiThuong = claims['-N0'].soHoSoBoiThuong; claims['-N3'].trangThai = 'trạng_thái_lạ';
  const prep = K.fromClaims(claims, STATUS_MAP);
  assert.equal(prep.records.length, 2); assert.equal(prep.warnings.noOpen, 1); assert.equal(prep.warnings.duplicate, 1);
  assert.equal(prep.warnings.unknownStatus[0], 'trạng_thái_lạ');
  assert.equal(K.fromClaims(null, STATUS_MAP).records.length, 0);
});

test('phân tích chuyên sâu: nhịp duyệt, thời gian xử lý, phân bố chi phí, xu hướng, nhận định', () => {
  const prep = K.prepare(rows);
  const r = K.computeReport(prep.records, {year: 2026, month: 10, gdvs: G, asOf: prep.asOf});
  const c = r.current, a = c.analysis;
  // Nhịp: dữ liệu tới 30/10 → đã qua 30 ngày, còn 1 ngày; cần 28 hồ sơ.
  assert.equal(c.pace.elapsed, 30); assert.equal(c.pace.left, 1);
  near(c.pace.requiredPerDay, 28, 1e-9);
  near(c.pace.projApproved, 138 + 138 / 30, 1e-9);
  // Phân bố chi phí cộng đủ số hồ sơ phát sinh; nhóm "từ 10 triệu" = số bị loại.
  assert.equal(a.cost.buckets.reduce((x, b) => x + b.count, 0), 184);
  assert.equal(a.cost.buckets[a.cost.buckets.length - 1].count, 33);
  assert.equal(a.lead.buckets.reduce((x, b) => x + b.count, 0), 138);
  assert.equal(a.lead.n, 138);
  near(a.marginalApproval, 0.5 / (0.9 * 184), 1e-9);
  assert.equal(a.backlogHeadroom, Math.floor(0.1 * 1445) - 114); // 144 - 114 = 30
  // Mỗi GĐV: khoảng thiếu/dư so với 90% và tuổi tồn cộng đủ.
  const phuc = c.perGdv.find(g => g.gdv === G[0]);
  assert.equal(phuc.gap, Math.ceil(0.9 * 88) - 77);
  assert.equal(phuc.ages.reduce((x, b) => x + b.count, 0), phuc.ton);
  // Xu hướng 12 tháng, tháng cuối trùng tháng chọn; tháng trước là ước tính.
  assert.equal(r.trend.length, 12);
  near(r.trend[11].capped, 0.9009); assert.equal(r.trend[10].estimate, true); near(r.trend[10].capped, 0.9875);
  // Nhận định có đủ mức và nhắc số hồ sơ còn thiếu.
  assert.ok(r.insights.some(x => x.tone === 'warn' || x.tone === 'bad'));
  assert.ok(r.insights.some(x => /28 hồ sơ/.test(x.text)));
  // Tháng đã qua không có nhịp.
  assert.equal(K.computeMonth(prep.records, {year: 2026, month: 9, gdvs: G, asOf: prep.asOf}).pace, null);
});
