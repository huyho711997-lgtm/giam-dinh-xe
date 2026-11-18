import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../js/features/contacts/contact-store.js', import.meta.url), 'utf8');
const ctx = vm.createContext({document: {addEventListener() {}, hidden: false}});
const {ContactStore, ClaimsMirror} = vm.runInContext(src + '\n;({ContactStore, ClaimsMirror})', ctx);
const P = ContactStore.pure, M = ClaimsMirror.pure;
const plain = value => JSON.parse(JSON.stringify(value));   // đưa mảng/đối tượng từ vm về realm hiện tại để deepEqual so được

test('bản ghi danh bạ → hàng Supabase, giới hạn độ dài và tách trường cá nhân', () => {
  const rec = {key: 'TIC0446', hoTen: '  Nguyễn   Thành Hưng ', donVi: 'Chi nhánh', phong: 'Chi nhánh Thanh Hóa', to: 'Ban Giám đốc', chucDanh: 'Giám đốc', noiLamViec: 'Thanh Hóa', nhom: 'CN', sdt: '0945676666', email: 'a@b.vn', namSinh: 1986, gioiTinh: 'Nam'};
  const row = P.toRow(rec, 'Admin', '2026-11-18T00:00:00Z');
  assert.equal(row.ma_nv, 'TIC0446'); assert.equal(row.ho_ten, 'Nguyễn Thành Hưng'); assert.equal(row.to_nhom, 'Ban Giám đốc');
  assert.equal('nam_sinh' in row, false); assert.equal('gioi_tinh' in row, false);
  assert.deepEqual({...P.toPrivate(rec)}, {ma_nv: 'TIC0446', nam_sinh: 1986, gioi_tinh: 'Nam'});
  assert.equal(P.toPrivate({key: 'X', namSinh: 1800, gioiTinh: 'khác'}).nam_sinh, null);
  assert.equal(P.toPrivate({key: 'X', gioiTinh: 'khác'}).gioi_tinh, '');
  assert.equal(P.toRow({key: 'A', hoTen: 'x'.repeat(500)}, '', 'z').ho_ten.length, 120);
});

test('ghép hàng Supabase với trường cá nhân; không có quyền thì không có năm sinh', () => {
  const rows = [{ma_nv: 'TIC1', ho_ten: 'A', don_vi: '', phong: 'P', to_nhom: 'T', chuc_danh: 'C', noi_lam_viec: 'N', nhom: 'G', sdt: '09', email: 'e', updated_by: 'u', updated_at: '2026-11-18T00:00:00Z'}, {ma_nv: 'EM_a_b', ho_ten: 'B', don_vi: '', phong: '', to_nhom: '', chuc_danh: '', noi_lam_viec: '', nhom: '', sdt: '', email: 'a@b', updated_by: '', updated_at: '2026-11-18T00:00:00Z'}];
  const admin = P.fromRows(rows, [{ma_nv: 'TIC1', nam_sinh: 1990, gioi_tinh: 'Nữ'}]);
  assert.equal(admin[0].namSinh, 1990); assert.equal(admin[0].gioiTinh, 'Nữ'); assert.equal(admin[0].to, 'T'); assert.equal(admin[0].maNv, 'TIC1');
  assert.equal(admin[1].maNv, '');                       // khoá tự sinh = không có Mã NV
  const user = P.fromRows(rows, []);
  assert.equal('namSinh' in user[0], false);
});

test('đọc contact_directory từ Firebase: bỏ bản ghi hỏng và khoá không hợp lệ', () => {
  const r = P.fromFirebase({TIC1: {hoTen: 'A', namSinh: 1990}, 'BAD KEY': {hoTen: 'B'}, TIC2: {hoTen: ''}, TIC3: null, TIC4: {hoTen: 'D', namSinh: 'x'}});
  assert.deepEqual(plain(r.records.map(x => x.key)), ['TIC1', 'TIC4']);
  assert.equal(r.records[0].namSinh, 1990); assert.equal(r.records[1].namSinh, null);
  assert.equal(r.skipped.length, 3);
});

test('chia lô', () => { assert.deepEqual(plain(P.chunks([1, 2, 3, 4, 5], 2)), [[1, 2], [3, 4], [5]]); });

test('bản rút gọn hồ sơ không mang số tiền / SĐT', () => {
  const row = M.toRow('-Nabc', {soHoSoBoiThuong: 'HS1', bienSo: '47A-123.45', gdvTiepNhan: 'Huy', trangThai: 'Chờ điền', ttbtTongSoTienBoiThuong: 9e9, sdtLaiXe: '0900000000', ngayTonThat: 1700000000000});
  assert.equal(row.bien_so, '47A-123.45'); assert.equal(row.ngay_ton_that, '1700000000000');
  assert.equal(Object.keys(row).some(k => /tien|sdt|dien_thoai/.test(k)), false);
  assert.equal(JSON.stringify(row).includes('0900000000'), false);
});

test('kế hoạch đồng bộ: chỉ ghi hàng đổi, xóa hàng đã mất, không xóa sạch khi payload rỗng', () => {
  const payload = {a1: {bienSo: '1'}, a2: {bienSo: '2'}, 'bad id!': {bienSo: '3'}};
  const first = M.plan(payload, new Map());
  assert.deepEqual(plain(first.rows.map(r => r.id)), ['a1', 'a2']); assert.deepEqual(plain(first.removeIds), []);
  const pushed = new Map(first.rows.map(r => [r.id, M.fingerprint(r)]));
  assert.equal(M.plan(payload, pushed).rows.length, 0);
  payload.a2.bienSo = '22';
  assert.deepEqual(plain(M.plan(payload, pushed).rows.map(r => r.id)), ['a2']);
  assert.deepEqual(plain(M.plan({a1: payload.a1}, pushed).removeIds), ['a2']);
  assert.deepEqual(plain(M.plan({}, pushed).removeIds), []);
  pushed.set('old', 'x');
  assert.deepEqual(plain(M.plan(payload, pushed).removeIds), ['old']);
});
