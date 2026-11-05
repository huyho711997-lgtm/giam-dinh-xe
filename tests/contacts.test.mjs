import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../js/features/contacts/contact-calc.js', import.meta.url), 'utf8');
const C = vm.runInContext(src + '\n;ContactCalc', vm.createContext({}));

const HEAD = ['STT', 'Mã NV', 'Họ và tên', 'Đơn vị', 'Phòng/ban/Chi nhánh', 'Tổ/nhóm', 'Chức danh', 'Nơi làm việc', 'Năm sinh', 'Giới tính', 'Số điện thoại', 'Email Công ty'];
const SHEET = [
  ['DANH SÁCH NHÂN SỰ'], [],
  HEAD,
  ['', '', 'HĐTV + BAN ĐIỀU HÀNH'],
  [134, 'TIC2125', 'Võ Hoàng Việt', 'HO', 'Phòng Phát triển sản phẩm', '', 'Chuyên viên', 'Hà Nội', 2000, 'Nam', '0981236966', 'viet.vh@baohiemtasco.vn'],
  ['', '', 'CHI NHÁNH THANH HÓA'],
  [135, 'TIC0446', 'Nguyễn Thành Hưng', 'Chi nhánh', 'Chi nhánh Thanh Hóa', 'Ban Giám đốc', 'Giám đốc chi nhánh', 'Thanh Hóa', 1986, 'Nam', '945676666', 'hung.nt1@baohiemtasco.vn'],
  [137, 'TIC0469', 'Phạm Thị Nhung', 'Chi nhánh', 'Chi nhánh Thanh Hóa', 'Phòng Kế toán tổng hợp', 'Phụ trách Kế toán', 'Thanh Hóa', 1994, 'Nữ', '+84 962 643 757', 'NHUNG.PT@baohiemtasco.vn'],
  [138, 'TIC0499', 'Đàm Nguyễn Thu Trang', 'Chi nhánh', 'Chi nhánh Thanh Hóa', 'Phòng Kế toán tổng hợp', 'Kế toán viên', 'Thanh Hóa', 1997, 'Nữ', '0974725853', 'sai-email']
];

test('nhận diện dòng tiêu đề & gán khối/nhóm từ dòng banner', () => {
  const r = C.parseRows(SHEET, 2026);
  assert.equal(r.ok, true);
  assert.equal(r.records.length, 4);
  assert.equal(r.records[0].nhom, 'HĐTV + BAN ĐIỀU HÀNH');
  assert.equal(r.records[1].nhom, 'CHI NHÁNH THANH HÓA');
  assert.deepEqual([...r.mapped].sort(), ['chucDanh', 'donVi', 'email', 'gioiTinh', 'hoTen', 'maNv', 'namSinh', 'noiLamViec', 'phong', 'sdt', 'to']);
});
test('chuẩn hoá SĐT: thêm số 0 bị mất, đổi +84, giữ định dạng số', () => {
  const r = C.parseRows(SHEET, 2026).records;
  assert.equal(r[1].sdt, '0945676666');
  assert.equal(r[2].sdt, '0962643757');
  assert.equal(C.normPhone('12345').valid, false);
  assert.equal(C.normPhone('').empty, true);
  assert.equal(C.fmtPhone('0981236966'), '0981 236 966');
});
test('email: chữ thường, loại email sai kèm cảnh báo', () => {
  const r = C.parseRows(SHEET, 2026);
  assert.equal(r.records[2].email, 'nhung.pt@baohiemtasco.vn');
  assert.equal(r.records[3].email, '');
  assert.ok(r.warnings.some(w => /Email không hợp lệ/.test(w.reason) && w.line === 9));
});
test('bỏ dòng thiếu tên và dòng trùng Mã NV; không có tiêu đề thì báo lỗi', () => {
  const rows = [HEAD, [1, 'A1', 'An', '', '', '', '', '', '', '', '', ''], [2, 'A1', 'Bình', '', '', '', '', '', '', '', '', ''], [3, 'A3', '', '', '', '', '', '', 5, '', '', 'x@y.vn']];
  const r = C.parseRows(rows, 2026);
  assert.equal(r.records.length, 1);
  assert.deepEqual([...r.skipped.map(s => s.reason.split(' ')[0])], ['Trùng', 'Thiếu']);
  assert.equal(C.parseRows([['a', 'b'], [1, 2]], 2026).ok, false);
});
test('khoá bản ghi hợp lệ cho Firebase', () => {
  assert.equal(C.makeKey({maNv: 'tic-21.25'}), 'TIC-2125');
  assert.match(C.makeKey({hoTen: 'Võ Việt', email: 'a.b@x.vn'}), /^EM_[a-z0-9_]+$/);
  assert.match(C.makeKey({hoTen: 'Võ Việt', sdt: '0981236966'}), /^N_vovit_236966$|^N_voviet_236966$/);
});
test('so sánh khi nhập lại: mới / cập nhật / không đổi / bị xoá khi thay thế', () => {
  const recs = C.parseRows(SHEET, 2026).records;
  const existing = {TIC2125: {...recs[0]}, TIC0446: {...recs[1], chucDanh: 'Khác'}, OLD1: {key: 'OLD1', hoTen: 'Cũ'}};
  const d = C.diff(existing, recs, 'replace');
  assert.equal(d.added.length, 2); assert.equal(d.updated.length, 1); assert.equal(d.unchanged.length, 1);
  assert.deepEqual([...d.removed], ['OLD1']);
  assert.equal(C.diff(existing, recs, 'merge').removed.length, 0);
});
test('tìm kiếm không phân biệt dấu, theo SĐT một phần và nhiều từ khoá', () => {
  const r = C.parseRows(SHEET, 2026).records[0];
  assert.equal(C.matches(r, 'viet phat trien'), true);
  assert.equal(C.matches(r, '0981 236'), true);
  assert.equal(C.matches(r, 'TIC2125'), true);
  assert.equal(C.matches(r, 'thanh hoa'), false);
  assert.equal(C.matches(r, ''), true);
  assert.equal(C.initials('Võ Hoàng Việt'), 'HV');
});
test('tìm kiếm khớp theo đầu từ, không khớp chuỗi con giữa từ (lỗi "nguyen quang huy")', () => {
  const mk = o => { const r = {hoTen: '', maNv: '', sdt: '', email: '', chucDanh: '', phong: '', to: '', noiLamViec: '', donVi: '', nhom: '', ...o}; r._s = C.searchText(r); return r; };
  const chinh = mk({hoTen: 'Nguyễn Ngọc Chính', maNv: 'TIC2336', chucDanh: 'Chuyên viên Giải pháp bảo hiểm', phong: 'Chi nhánh Quảng Ninh', noiLamViec: 'Quảng Ninh', email: 'chinh.nn@baohiemtasco.vn'});
  const huy = mk({hoTen: 'Nguyễn Quang Huy_DL', maNv: 'TIC0001', chucDanh: 'Giám định viên', noiLamViec: 'Đắk Lắk'});
  const huyHo = mk({hoTen: 'Hồ Quang Huy', maNv: 'TIC0002', noiLamViec: 'Đắk Lắk'});
  assert.equal(C.matches(chinh, 'nguyen quang huy'), false);   // "huy" nằm giữa "chuyên", "quang" chỉ có ở "Quảng"
  assert.equal(C.matches(huy, 'nguyen quang huy'), true);
  assert.equal(C.matches(huyHo, 'nguyen quang huy'), false);
  assert.equal(C.matches(huyHo, 'quang huy'), true);
  assert.equal(C.matches(chinh, 'chuyen vien'), true);         // vẫn tìm được theo chức danh
  assert.equal(C.matches(chinh, 'chinh.nn@bao'), true);        // email dán vào ô tìm kiếm
});
test('xếp hạng: khớp liền trong tên < đủ từ trong tên < khớp nhờ trường khác', () => {
  const mk = o => ({hoTen: '', maNv: '', sdt: '', email: '', chucDanh: '', phong: '', noiLamViec: '', ...o});
  const exact = mk({hoTen: 'Nguyễn Quang Huy_DL'}), loose = mk({hoTen: 'Huy Nguyễn Quang'}), other = mk({hoTen: 'Lê Văn A', maNv: 'NQH1', chucDanh: 'Huy', phong: 'Quang Nguyen'});
  assert.equal(C.rank(exact, 'nguyen quang huy'), 0);
  assert.equal(C.rank(loose, 'nguyen quang huy'), 1);
  assert.equal(C.rank(other, 'nguyen quang huy'), 3);
  assert.equal(C.rank(exact, ''), 9);
});
test('vCard có tên, số điện thoại và email', () => {
  const v = C.vcard(C.parseRows(SHEET, 2026).records[0]);
  assert.match(v, /FN:Võ Hoàng Việt/); assert.match(v, /TEL;TYPE=CELL:0981236966/); assert.match(v, /EMAIL;TYPE=WORK:viet\.vh@baohiemtasco\.vn/);
});

test('normYear: ô trống hợp lệ (không phải năm 0), năm sai bị từ chối', () => {
  const src = fs.readFileSync(new URL('../js/features/contacts/contact-calc.js', import.meta.url), 'utf8');
  const C = vm.runInContext(src + ';ContactCalc', vm.createContext({}));
  assert.deepEqual({...C.normYear('')}, {value: null, valid: true});
  assert.deepEqual({...C.normYear('1990')}, {value: 1990, valid: true});
  assert.equal(C.normYear('abc').valid, false);
  assert.equal(C.normYear('1800').valid, false);
});
