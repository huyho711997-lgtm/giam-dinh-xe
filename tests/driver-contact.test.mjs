import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ctx = vm.createContext({});
const D = vm.runInContext(fs.readFileSync(new URL('../js/features/claims/driver-contact.js', import.meta.url), 'utf8') + '\n;DriverContact', ctx);

// Cấu trúc đúng như file mẫu insurance.claim.profile: dòng nhóm "cancel (430)" rồi tới dòng dữ liệu.
const HEAD = ['Status', 'Tên', 'Biển kiểm soát', 'Tên lái xe', 'Điện thoại', 'Ngày tổn thất', 'Địa điểm tổn thất'];
const sample = [HEAD, ['cancel (430)', '', '', '', '', '', ''], ['cancel', 'HSBT/XCG/2024/0008131', '48A20644', 'Nguyễn Xuân Bắc', '0888208208', '', 'Đắk Drô']];

test('tách dữ liệu cũ "Tên - SĐT"', () => {
  assert.deepEqual({...D.splitLegacy('Nguyễn Xuân Bắc - 0888208208')}, {name: 'Nguyễn Xuân Bắc', phone: '0888208208'});
  assert.deepEqual({...D.splitLegacy('0912 345 678 Trần Văn A')}, {name: 'Trần Văn A', phone: '0912345678'});
  assert.deepEqual({...D.splitLegacy('Lê B, SĐT: +84 912.345.678')}, {name: 'Lê B', phone: '0912345678'});
  assert.deepEqual({...D.splitLegacy('Chỉ có tên')}, {name: 'Chỉ có tên', phone: ''});
  assert.deepEqual({...D.splitLegacy('—')}, {name: '', phone: ''});
});

test('chuẩn hoá số điện thoại (Excel mất số 0 đầu)', () => {
  assert.equal(D.normPhone(888208208), '0888208208');
  assert.equal(D.normPhone('0888 208 208'), '0888208208');
  assert.equal(D.normPhone('84888208208'), '0888208208');
  assert.equal(D.normPhone('888208208.0'), '0888208208');
  assert.equal(D.normPhone('—'), '');
});

test('đọc file mẫu: lấy Số HSBT làm khoá, bỏ dòng nhóm', () => {
  const p = D.parseSheet(sample);
  assert.equal(p.rows.length, 1);
  assert.equal(p.skipped, 1);
  assert.equal(p.rows[0].hsbt, 'HSBT/XCG/2024/0008131');
  assert.equal(p.rows[0].name, 'Nguyễn Xuân Bắc');
  assert.equal(p.rows[0].phone, '0888208208');
});

test('không nhận file đầy đủ hàng chục cột và file thiếu cột lái xe', () => {
  const wide = Array.from({length: 40}, (_, i) => 'Cột ' + i); wide[1] = 'Tên'; wide[3] = 'Tên lái xe';
  assert.equal(D.parseSheet([wide, ['x']]), null);
  assert.equal(D.parseSheet([['Tên', 'Biển kiểm soát'], ['HSBT/1', '48A1']]), null);
  assert.equal(D.parseSheet([]), null);
});

test('đối chiếu theo Số HSBT: cập nhật, không đổi, không tìm thấy', () => {
  const claims = {
    a: {soHoSoBoiThuong: 'HSBT/XCG/2024/0008131', bienSo: '48A20644', laiXe: 'Nguyễn Xuân Bắc - 0888208208'}, // dữ liệu cũ gộp, giá trị trùng file
    b: {soHoSoBoiThuong: 'HSBT/XCG/2024/0000002', laiXe: '—'},
    c: {soHoSoBoiThuong: 'HSBT/XCG/2024/0000003', laiXe: 'Tên cũ', dienThoaiLaiXe: '0911111111'},
    d: {laiXe: 'Không có số HSBT'}
  };
  const parsed = D.parseSheet([HEAD,
    ['x', 'hsbt/xcg/2024/0008131', '', 'Nguyễn Xuân Bắc', '0888208208'],
    ['x', 'HSBT/XCG/2024/0000002', '', 'Phạm Văn C', 888111222],
    ['x', 'HSBT/XCG/2024/0000003', '', '', '0922222222'],        // chỉ đổi SĐT, giữ tên
    ['x', 'HSBT/XCG/2024/0000099', '', 'Người lạ', '0933333333']]);
  const planned = D.plan(claims, parsed);
  assert.equal(planned.summary.unchanged, 1);
  assert.equal(planned.summary.changed, 2);
  assert.equal(planned.summary.notFound, 1);
  const b = planned.changes.find(x => x.id === 'b'), c = planned.changes.find(x => x.id === 'c');
  assert.deepEqual({...b.after}, {name: 'Phạm Văn C', phone: '0888111222'});
  assert.deepEqual({...c.after}, {name: 'Tên cũ', phone: '0922222222'});
  const up = D.updates(planned, 5);
  assert.equal(up['pending_claims/b/laiXe'], 'Phạm Văn C');
  assert.equal(up['pending_claims/c/dienThoaiLaiXe'], '0922222222');
  assert.equal(up['pending_claims/b/updatedAt'], 5);
  assert.equal(Object.keys(up).some(k => k.includes('/a/') || k.includes('/d/')), false);
});

test('ô trống trong file không xoá dữ liệu đang có', () => {
  const claims = {a: {soHoSoBoiThuong: 'H1', laiXe: 'An', dienThoaiLaiXe: '0900000001'}};
  const planned = D.plan(claims, D.parseSheet([HEAD, ['x', 'H1', '', '', '']]));
  assert.equal(planned.summary.changed, 0);
  assert.equal(planned.summary.empty, 1);
});
