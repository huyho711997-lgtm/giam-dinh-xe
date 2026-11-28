import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/reports/weekly-detail.js', import.meta.url), 'utf8');
// Chỉ nạp phần tính thuần (trước phần giao diện).
const pure = source.slice(0, source.indexOf('// ---- Giao diện'));
const ctx = vm.createContext({ String, Number, Date, Math, Array, Object, JSON, parseInt });
vm.runInContext(pure + '\n;this.W = WeeklyDetail;', ctx);
const W = ctx.W;

const day = (d, m, y = 2026) => new Date(y, m - 1, d, 12).getTime();
const h = {
  getClaimDateMs: (c, field) => field === 'none' ? -1 : (c[field] || c.ngayMoHs || 0),
  getClaimTimestamp: c => c.ngayMoHs || 0,
  isPhatSinh: c => c.trangThai !== 'tu_choi',
  isChuyenDntt: c => !!c.dntt,
  isTndsClaim: c => !!c.tnds,
  isUnpaidClaim: c => c.trangThai !== 'da_thanh_toan',
  isDuyetHsbtApproved: c => ['da_duyet_hsbt', 'da_thanh_toan'].includes(c.trangThai),
  isOnlyDaDuyetHsbt: c => c.trangThai === 'da_duyet_hsbt'
};
const period = { startDate: new Date(2026, 10, 1, 0, 0, 0), endDate: new Date(2026, 10, 28, 23, 59, 59) };
const claims = {
  a: { soHoSoBoiThuong: 'A1', bienSo: '47A-111.11', khachHang: 'Nguyễn Văn Lê', gdvTiepNhan: 'Huy', trangThai: 'da_duyet_hsbt', ngayMoHs: day(5, 11), ttbtTongSoTienBoiThuong: '8.500.000' },
  b: { soHoSoBoiThuong: 'B2', bienSo: '47B-222.22', gdvTiepNhan: 'Phúc', trangThai: 'moi', ngayMoHs: day(20, 11) },
  c: { soHoSoBoiThuong: 'C3', gdvTiepNhan: 'Huy', trangThai: 'da_duyet_hsbt', ngayMoHs: day(1, 8) },            // mở từ tháng 8: ngoài kỳ nhưng tồn quá hạn
  d: { soHoSoBoiThuong: 'D4', gdvTiepNhan: 'Huy', trangThai: 'tu_choi', ngayMoHs: day(10, 11) },                  // từ chối: không phát sinh, không thuộc nhóm nào
  e: { soHoSoBoiThuong: 'E5', gdvTiepNhan: 'Phúc', trangThai: 'moi', ngayMoHs: day(3, 11), tenGaraVietTat: 'CARPLA Đắk Lắk', tnds: true }
};
const run = extra => W.build({ claims, period, rules: { hsTonDays: 30 }, h, now: day(28, 11), ...extra });

test('hồ sơ trong kỳ: gộp các nhóm theo kỳ, bỏ hồ sơ ngoài kỳ không thuộc nhóm nào', () => {
  const { rows, counts } = run();
  const inPeriod = rows.filter(row => row.inPeriod).map(row => row.claim.soHoSoBoiThuong).sort();
  assert.deepEqual([...inPeriod], ['A1', 'B2', 'E5']);
  assert.equal(counts.all, 3);
  assert.equal(counts.phatSinh, 3);
  assert.equal(counts.daDuyet, 1);
  assert.equal(counts.chuaDuyet, 2);
  assert.equal(counts.carpla, 1);
});
test('Tồn quá hạn và TNDS tồn không theo kỳ: chỉ hiện khi chọn riêng nhóm', () => {
  const { rows, counts } = run();
  assert.equal(counts.tonQuaHan, 1);                       // chỉ C3 (mở 1/8); A1 mới 23 ngày chưa quá hạn
  const over = W.filter(rows, 'tonQuaHan', '').map(row => row.claim.soHoSoBoiThuong);
  assert.ok([...over].includes('C3'));
  assert.ok(![...W.filter(rows, 'all', '').map(row => row.claim.soHoSoBoiThuong)].includes('C3'));
  assert.deepEqual([...W.filter(rows, 'tndsTon', '').map(row => row.claim.soHoSoBoiThuong)], ['E5']);
});
test('lọc GĐV đang chọn (không phân biệt hoa thường)', () => {
  const { rows } = run({ selectedGdv: ['  HUY '] });
  assert.ok(rows.every(row => row.gdv === 'Huy'));
});
test('tìm không dấu theo số HSBT, biển số, chủ xe, GĐV, gara; sắp xếp mới nhất trước', () => {
  const { rows } = run();
  const owner = c => c.khachHang || '';
  assert.deepEqual([...W.filter(rows, 'all', 'nguyen van le', owner).map(row => row.claim.soHoSoBoiThuong)], ['A1']);
  assert.deepEqual([...W.filter(rows, 'all', '47b', owner).map(row => row.claim.soHoSoBoiThuong)], ['B2']);
  assert.deepEqual([...W.filter(rows, 'all', 'phuc carpla', owner).map(row => row.claim.soHoSoBoiThuong)], ['E5']);
  assert.deepEqual([...W.filter(rows, 'all', '', owner).map(row => row.claim.soHoSoBoiThuong)], ['B2', 'A1', 'E5']);
});
test('số tiền bồi thường đọc từ chuỗi có dấu chấm', () => {
  assert.equal(W.amountOf({ ttbtTongSoTienBoiThuong: '8.500.000' }), 8500000);
  assert.equal(run().rows.find(row => row.id === 'a').amount, 8500000);
});
