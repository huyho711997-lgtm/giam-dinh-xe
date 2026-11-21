import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

function extractFunction(src, name) {
  const m = new RegExp('\\n[ \\t]*function ' + name + '\\(').exec(src);
  assert.ok(m, 'Không tìm thấy hàm ' + name);
  const open = src.indexOf('{', src.indexOf(')', m.index));
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(m.index + 1, i + 1);
  }
  throw new Error('Hàm không đóng: ' + name);
}

const runtimeSrc = read('js/core/runtime.js');
const reservesSrc = read('js/features/reports/reserves.js');
const weeklyEngineSrc = read('js/features/reports/weekly-engine.js');
const filtersSrc = read('js/features/reports/filters-settings.js');

const statusMapStr = /const PENDING_STATUS_MAP = \{[\s\S]*?\n    \};/.exec(runtimeSrc)[0];

const ctx = vm.createContext({
  console,
  setTimeout,
  clearTimeout
});

vm.runInContext([
  'var window = globalThis;',
  statusMapStr,
  'var cachedPendingClaimsPayload = {};',
  'var cachedReportRules = { tndsKeywords: "tnds, trách nhiệm dân sự" };',
  'var activeGdvReportMonth = "11";',
  'var activeGdvReportYear = "2026";',
  'var activeReportClaimType = "all";',
  'var activeSelectedGdvNames = [];',
  'var activeGdvReportBranch = "all";',
  'var activeMonthlyOpenedChartType = "bar";',
  'function formatCurrencyInputNumber(n) { return (parseInt(String(n || 0).replace(/\\D/g, ""), 10) || 0).toLocaleString("vi-VN"); }',
  'function formatDateDisplay(d) { return d || ""; }',
  'function escapeHtmlOutput(s) { return String(s || ""); }',
  'function escapeAttributeData(s) { return String(s || ""); }',
  extractFunction(weeklyEngineSrc, 'parseDateParts'),
  extractFunction(filtersSrc, 'getRuleArray'),
  extractFunction(filtersSrc, 'isTndsClaim'),
  extractFunction(reservesSrc, 'getClaimOpenDateInfo'),
  extractFunction(reservesSrc, 'getClaimReserveAmountValue'),
  extractFunction(reservesSrc, 'isTndsClaimMonthlyRecord'),
  extractFunction(reservesSrc, 'getMonthlyOpenedClaimsData'),
  "const MONTHLY_OPENED_NO_GARAGE = 'Chưa xác định gara';",
  extractFunction(reservesSrc, 'getMonthlyOpenedGarageName'),
  extractFunction(reservesSrc, 'getMonthlyOpenedClaimsSorted'),
  extractFunction(reservesSrc, 'getMonthlyOpenedChartData'),
  extractFunction(reservesSrc, 'renderMonthlyOpenedClaimsReportHtml')
].join('\n'), ctx);

test('getClaimOpenDateInfo trích xuất ngày mở hồ sơ chuẩn xác trên nhiều định dạng', () => {
  const c1 = { ngayMoHs: '05/11/2026' };
  const d1 = ctx.getClaimOpenDateInfo(c1);
  assert.equal(d1.day, 5);
  assert.equal(d1.month, 11);
  assert.equal(d1.year, 2026);
  assert.equal(d1.display, '05/11/2026');

  const c2 = { ngayMoHs: '2026-11-18 09:30' };
  const d2 = ctx.getClaimOpenDateInfo(c2);
  assert.equal(d2.day, 18);
  assert.equal(d2.month, 11);
  assert.equal(d2.year, 2026);

  const c3 = { 'Ngày mở hồ sơ': '12/10/2025' };
  const d3 = ctx.getClaimOpenDateInfo(c3);
  assert.equal(d3.month, 10);
  assert.equal(d3.year, 2025);

  const cEmpty = { ngayMoHs: '—' };
  assert.equal(ctx.getClaimOpenDateInfo(cEmpty), null);
  assert.equal(ctx.getClaimOpenDateInfo({}), null);
});

test('getClaimReserveAmountValue lấy đúng số tiền dự phòng bồi thường', () => {
  assert.equal(ctx.getClaimReserveAmountValue({ duPhongBoiThuong: '15.000.000' }), 15000000);
  assert.equal(ctx.getClaimReserveAmountValue({ duPhongBoiThuong: '25,500,000 đ' }), 25500000);
  assert.equal(ctx.getClaimReserveAmountValue({ soTienDuPhong: '8.000.000' }), 8000000);
  assert.equal(ctx.getClaimReserveAmountValue({ duPhong: '12000000' }), 12000000);
  assert.equal(ctx.getClaimReserveAmountValue({ 'Dự phòng bồi thường': '5.000.000' }), 5000000);
  assert.equal(ctx.getClaimReserveAmountValue({ duPhongBoiThuong: '' }), 0);
  assert.equal(ctx.getClaimReserveAmountValue({}), 0);
});

test('getMonthlyOpenedClaimsData lọc chính xác hồ sơ mở trong tháng và tính tổng xe & dự phòng', () => {
  ctx.cachedPendingClaimsPayload = {
    c1: {
      bienSo: '51F-123.45',
      soHoSoBoiThuong: 'HSBT-001',
      ngayMoHs: '02/11/2026',
      duPhongBoiThuong: '10.000.000',
      gdvTiepNhan: 'Huỳnh Văn Phúc',
      loaiHoSo: 'Vật chất xe'
    },
    c2: {
      bienSo: '47C-888.88',
      soHoSoBoiThuong: 'HSBT-002',
      ngayMoHs: '15/11/2026',
      duPhongBoiThuong: '25.000.000',
      gdvTiepNhan: 'Hồ Quang Huy',
      loaiHoSo: 'Vật chất xe'
    },
    c3: {
      bienSo: '47C-888.88', // Cùng xe nhưng mở vụ thứ 2 trong tháng
      soHoSoBoiThuong: 'HSBT-003',
      ngayMoHs: '28/11/2026',
      duPhongBoiThuong: '5.000.000',
      gdvTiepNhan: 'Hồ Quang Huy',
      loaiHoSo: 'TNDS'
    },
    c4_diff_month: {
      bienSo: '30E-999.99',
      soHoSoBoiThuong: 'HSBT-004',
      ngayMoHs: '20/10/2026', // Tháng 10
      duPhongBoiThuong: '50.000.000',
      gdvTiepNhan: 'Huỳnh Văn Phúc'
    },
    c5_diff_year: {
      bienSo: '29A-111.11',
      soHoSoBoiThuong: 'HSBT-005',
      ngayMoHs: '10/11/2025', // Năm 2025
      duPhongBoiThuong: '100.000.000'
    }
  };

  ctx.activeGdvReportMonth = '11';
  ctx.activeGdvReportYear = '2026';
  ctx.activeReportClaimType = 'all';
  ctx.activeSelectedGdvNames = [];
  ctx.activeGdvReportBranch = 'all';

  const monthlyClaims = ctx.getMonthlyOpenedClaimsData();
  assert.equal(monthlyClaims.length, 3, 'Phải có 3 hồ sơ mở trong tháng 11/2026');

  // Đếm số lượng xe (unique plates)
  const uniquePlates = new Set(monthlyClaims.map(c => c.bienSo));
  assert.equal(uniquePlates.size, 2, 'Có 2 xe duy nhất (51F-123.45 và 47C-888.88)');

  // Tổng tiền dự phòng bồi thường
  const totalReserve = monthlyClaims.reduce((s, c) => s + c._reserveVal, 0);
  assert.equal(totalReserve, 40000000, 'Tổng tiền dự phòng bồi thường là 40.000.000 đ');

  // Kiểm tra render HTML
  const html = ctx.renderMonthlyOpenedClaimsReportHtml();
  assert.ok(html.includes('40.000.000'), 'HTML phải hiển thị tổng dự phòng 40.000.000 đ');
  assert.ok(html.includes('3'), 'HTML phải hiển thị tổng số 3 hồ sơ');
  assert.ok(!html.includes('<table'), 'Trang hiển thị bằng biểu đồ, không còn bảng danh sách');
  assert.ok(!html.includes('51F-123.45'), 'Không liệt kê từng biển số trên trang');
  for (const id of ['monthlyOpenedTimelineCanvas', 'monthlyOpenedGaraCanvas', 'monthlyOpenedGdvCanvas', 'monthlyOpenedStatusCanvas']) assert.ok(html.includes('id="' + id + '"'), 'Thiếu biểu đồ ' + id);
  assert.ok(html.includes('initMonthlyOpenedClaimsCharts'), 'Phải kích hoạt vẽ biểu đồ sau khi render');
});

test('Bộ lọc nghiệp vụ vẫn áp dụng cho dữ liệu báo cáo', () => {
  ctx.activeReportClaimType = 'TNDS';
  const tndsClaims = ctx.getMonthlyOpenedClaimsData();
  assert.equal(tndsClaims.length, 1, 'Chỉ có 1 hồ sơ TNDS trong tháng 11/2026');
  assert.equal(tndsClaims[0].soHoSoBoiThuong, 'HSBT-003');
  ctx.activeReportClaimType = 'all';
});

test('getMonthlyOpenedClaimsSorted: mới nhất trước (dùng cho xuất Excel)', () => {
  const sorted = ctx.getMonthlyOpenedClaimsSorted();
  assert.deepEqual(JSON.parse(JSON.stringify(sorted.map(c => c.soHoSoBoiThuong))), ['HSBT-003', 'HSBT-002', 'HSBT-001']);
});

test('getMonthlyOpenedChartData: theo ngày trong tháng, theo GĐV, theo trạng thái; khớp tổng', () => {
  ctx.activeGdvReportMonth = '11'; ctx.activeGdvReportYear = '2026'; ctx.activeReportClaimType = 'all';
  const d = JSON.parse(JSON.stringify(ctx.getMonthlyOpenedChartData()));
  assert.equal(d.mode, 'day');
  assert.equal(d.timeline.labels.length, 30, 'Tháng 11 có 30 ngày');
  assert.equal(d.timeline.count[1], 1, 'Ngày 02: 1 hồ sơ');
  assert.equal(d.timeline.count[14], 1, 'Ngày 15: 1 hồ sơ');
  assert.equal(d.timeline.reserve[27], 5000000, 'Ngày 28: dự phòng 5.000.000');
  assert.equal(d.timeline.tnds[27], 1);
  assert.equal(d.timeline.vcx[27], 0);
  assert.equal(d.timeline.count.reduce((a, b) => a + b, 0), 3);
  assert.equal(d.timeline.reserve.reduce((a, b) => a + b, 0), 40000000);
  assert.equal(d.total, 3);
  assert.equal(d.totalReserve, 40000000);
  assert.deepEqual(d.gdv.labels, ['Hồ Quang Huy', 'Huỳnh Văn Phúc'], 'GĐV nhiều hồ sơ nhất trước');
  assert.deepEqual(d.gdv.count, [2, 1]);
  assert.deepEqual(d.gdv.reserve, [30000000, 10000000]);
  assert.deepEqual(d.status.labels, ['Mới'], 'Hồ sơ không có trạng thái tính là "Mới"');
  assert.deepEqual(d.status.count, [3]);
});

test('getMonthlyOpenedChartData: cả năm → 12 tháng; nhiều năm → theo tháng/năm; gộp GĐV thừa thành "Khác"', () => {
  ctx.activeGdvReportMonth = 'all'; ctx.activeGdvReportYear = '2026';
  let d = JSON.parse(JSON.stringify(ctx.getMonthlyOpenedChartData()));
  assert.equal(d.mode, 'month');
  assert.equal(d.timeline.labels.length, 12);
  assert.equal(d.timeline.count[9], 1, 'Tháng 10: 1 hồ sơ');
  assert.equal(d.timeline.count[10], 3, 'Tháng 11: 3 hồ sơ');
  ctx.activeGdvReportYear = 'all';
  d = JSON.parse(JSON.stringify(ctx.getMonthlyOpenedChartData()));
  assert.equal(d.mode, 'period');
  assert.deepEqual(d.timeline.labels, ['11/2025', '10/2026', '11/2026']);
  // 12 GĐV → 10 người + "Khác"
  const many = {};
  for (let i = 1; i <= 12; i++) many['x' + i] = { bienSo: 'B' + i, ngayMoHs: '03/11/2026', duPhongBoiThuong: String(i * 1000000), gdvTiepNhan: 'GĐV ' + i };
  ctx.cachedPendingClaimsPayload = many; ctx.activeGdvReportMonth = '11'; ctx.activeGdvReportYear = '2026';
  d = JSON.parse(JSON.stringify(ctx.getMonthlyOpenedChartData()));
  assert.equal(d.gdv.labels.length, 11);
  assert.equal(d.gdv.labels[10], 'Khác');
  assert.equal(d.gdv.count[10], 2);
  // không có dữ liệu → các mảng rỗng, không lỗi
  ctx.cachedPendingClaimsPayload = {};
  d = JSON.parse(JSON.stringify(ctx.getMonthlyOpenedChartData()));
  assert.equal(d.total, 0); assert.equal(d.gdv.labels.length, 0);
  assert.ok(ctx.renderMonthlyOpenedClaimsReportHtml().includes('Không có hồ sơ nào mở'));
});

test('Theo gara: số hồ sơ và dự phòng từng gara, gộp "Khác", "Chưa xác định gara" luôn cuối', () => {
  assert.equal(ctx.getMonthlyOpenedGarageName({ tenGaraVietTat: ' Tiên Phong ', tenGara: 'Gara khác' }), 'Tiên Phong', 'ưu tiên tên viết tắt');
  assert.equal(ctx.getMonthlyOpenedGarageName({ tenGara: 'Gara A' }), 'Gara A');
  assert.equal(ctx.getMonthlyOpenedGarageName({ garaSuaChua: 'Gara B' }), 'Gara B');
  assert.equal(ctx.getMonthlyOpenedGarageName({ tenGara: '—' }), 'Chưa xác định gara');
  assert.equal(ctx.getMonthlyOpenedGarageName({}), 'Chưa xác định gara');

  ctx.activeGdvReportMonth = '11'; ctx.activeGdvReportYear = '2026'; ctx.activeReportClaimType = 'all';
  ctx.cachedPendingClaimsPayload = {
    a: { bienSo: '1', ngayMoHs: '01/11/2026', duPhongBoiThuong: '10.000.000', tenGaraVietTat: 'Tiên Phong', loaiHoSo: 'Vật chất xe' },
    b: { bienSo: '2', ngayMoHs: '02/11/2026', duPhongBoiThuong: '20.000.000', tenGaraVietTat: 'Tiên Phong', loaiHoSo: 'TNDS' },
    c: { bienSo: '3', ngayMoHs: '03/11/2026', duPhongBoiThuong: '50.000.000', tenGara: 'Ford Buôn Ma Thuột' },
    d: { bienSo: '4', ngayMoHs: '04/11/2026', duPhongBoiThuong: '7.000.000' }
  };
  let d = JSON.parse(JSON.stringify(ctx.getMonthlyOpenedChartData()));
  assert.deepEqual(d.gara.labels, ['Tiên Phong', 'Ford Buôn Ma Thuột', 'Chưa xác định gara']);
  assert.deepEqual(d.gara.count, [2, 1, 1]);
  assert.deepEqual(d.gara.reserve, [30000000, 50000000, 7000000]);
  assert.deepEqual(d.gara.vcx, [1, 1, 1]);
  assert.deepEqual(d.gara.tnds, [1, 0, 0]);
  assert.equal(d.garaNamedCount, 2);
  assert.equal(d.gara.reserve.reduce((a, b) => a + b, 0), d.totalReserve, 'tổng theo gara khớp tổng dự phòng');

  // 17 gara có tên → 15 gara đầu + "Khác", "Chưa xác định gara" vẫn cuối
  const many = { z: { bienSo: 'Z', ngayMoHs: '05/11/2026', duPhongBoiThuong: '1.000.000' } };
  for (let i = 1; i <= 17; i++) many['g' + i] = { bienSo: 'B' + i, ngayMoHs: '05/11/2026', duPhongBoiThuong: String(i * 1000000), tenGara: 'Gara ' + String(i).padStart(2, '0') };
  ctx.cachedPendingClaimsPayload = many;
  d = JSON.parse(JSON.stringify(ctx.getMonthlyOpenedChartData()));
  assert.equal(d.gara.labels.length, 17, '15 gara + Khác + Chưa xác định');
  assert.equal(d.gara.labels[15], 'Khác');
  assert.equal(d.gara.labels[16], 'Chưa xác định gara');
  assert.equal(d.gara.count[15], 2);
  assert.equal(d.garaNamedCount, 17);
  ctx.cachedPendingClaimsPayload = {};
});
