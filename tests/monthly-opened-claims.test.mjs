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
  'var activeMonthlyOpenedSearch = "";',
  'var activeMonthlyOpenedStatus = "all";',
  'var activeMonthlyOpenedSort = "date_desc";',
  'var activeMonthlyOpenedPage = 1;',
  'var activeMonthlyOpenedPageSize = 25;',
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
  extractFunction(reservesSrc, 'getFilteredMonthlyOpenedClaims'),
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
  assert.ok(html.includes('51F-123.45'), 'HTML phải chứa biển số xe 51F-123.45');
  assert.ok(html.includes('47C-888.88'), 'HTML phải chứa biển số xe 47C-888.88');
});

test('Bộ lọc nghiệp vụ và tìm kiếm hoạt động chuẩn xác', () => {
  ctx.activeReportClaimType = 'TNDS';
  const tndsClaims = ctx.getMonthlyOpenedClaimsData();
  assert.equal(tndsClaims.length, 1, 'Chỉ có 1 hồ sơ TNDS trong tháng 11/2026');
  assert.equal(tndsClaims[0].soHoSoBoiThuong, 'HSBT-003');

  ctx.activeReportClaimType = 'all';
  ctx.activeMonthlyOpenedSearch = 'Hồ Quang Huy';
  const huyClaims = ctx.getFilteredMonthlyOpenedClaims();
  assert.equal(huyClaims.length, 2, 'Có 2 hồ sơ của GĐV Hồ Quang Huy');

  ctx.activeMonthlyOpenedSearch = '51F-123';
  const plateFiltered = ctx.getFilteredMonthlyOpenedClaims();
  assert.equal(plateFiltered.length, 1, 'Lọc biển số 51F-123 ra đúng 1 ca');
});

test('Sắp xếp theo số tiền dự phòng và ngày mở', () => {
  ctx.activeMonthlyOpenedSearch = '';
  ctx.activeMonthlyOpenedStatus = 'all';
  ctx.activeReportClaimType = 'all';

  ctx.activeMonthlyOpenedSort = 'reserve_desc';
  const sortedByReserveDesc = ctx.getFilteredMonthlyOpenedClaims();
  assert.equal(sortedByReserveDesc[0].soHoSoBoiThuong, 'HSBT-002', 'Dự phòng cao nhất là 25.000.000 (HSBT-002)');
  assert.equal(sortedByReserveDesc[2].soHoSoBoiThuong, 'HSBT-003', 'Dự phòng thấp nhất là 5.000.000 (HSBT-003)');

  ctx.activeMonthlyOpenedSort = 'reserve_asc';
  const sortedByReserveAsc = ctx.getFilteredMonthlyOpenedClaims();
  assert.equal(sortedByReserveAsc[0].soHoSoBoiThuong, 'HSBT-003', 'Dự phòng thấp nhất lên đầu (HSBT-003)');

  ctx.activeMonthlyOpenedSort = 'date_asc';
  const sortedByDateAsc = ctx.getFilteredMonthlyOpenedClaims();
  assert.equal(sortedByDateAsc[0].soHoSoBoiThuong, 'HSBT-001', 'Ngày mở sớm nhất là 02/11 (HSBT-001)');
});

