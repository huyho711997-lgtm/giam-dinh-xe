import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ctx = vm.createContext({ console, String, Number, Math, Array, Object, JSON, Promise, Error, Set, document: {} });
vm.runInContext(fs.readFileSync(new URL('../js/features/ai/assistant-vision.js', import.meta.url), 'utf8') + '\n;this.api = TascoVision;', ctx);
const api = ctx.api, plain = value => JSON.parse(JSON.stringify(value));

const raw = JSON.stringify({ giay_to: [
  { tep: 1, loai: 'đăng ký xe', bien_so: ' 47h-114.50 ', so_khung: 'rlh123abc', so_may: 'm456', chu_xe: 'Trần Văn Hiệp', hang_xe: 'Honda', nam_san_xuat: '2019 ', ngay_ton_that: '' },
  { tep: 2, loai: 'báo giá', bien_so: '47H11450', ngay_ton_que: 'x', ngay_ton_that: '5-3-2026', ten_gara: 'Gara Á Châu', tong_tien: '12.500.000 đ', hang_muc: [{ ten: 'Cản trước', thanh_tien: 3500000 }, { ten: '', thanh_tien: 1 }, { ten: 'Sơn', thanh_tien: '9.000.000' }] }
] });

test('chuẩn hoá kết quả: số tiền, ngày dd/mm/yyyy, bỏ hạng mục rỗng, chịu được rào mã ```json', () => {
  const docs = plain(api.parseExtraction('```json\n' + raw + '\n```'));
  assert.equal(docs.length, 2);
  assert.equal(docs[0].bien_so, '47H-114.50');
  assert.equal(docs[0].nam_san_xuat, '2019');
  assert.equal(docs[1].ngay_ton_that, '05/03/2026');
  assert.equal(docs[1].tong_tien, 12500000);
  assert.deepEqual(docs[1].hang_muc.map(row => row.thanh_tien), [3500000, 9000000]);
  assert.deepEqual(plain(api.parseExtraction('không phải json')), []);
});

test('gộp giấy tờ: lấy giá trị đầu tiên có dữ liệu, ghép số khung/số máy, ghi nguồn', () => {
  const { merged, source } = plain(api.mergeDocs(plain(api.parseExtraction(raw))));
  assert.equal(merged.so_khung_so_may, 'RLH123ABC / M456');
  assert.equal(merged.ten_gara, 'Gara Á Châu');
  assert.equal(source.ten_gara, 'báo giá');
  assert.equal(merged.ngay_ton_that, '05/03/2026');
});

test('đối chiếu với hồ sơ: ô đã khớp không tự chọn, ô khác hiện giá trị hiện có', () => {
  const { merged, source } = plain(api.mergeDocs(plain(api.parseExtraction(raw))));
  const rows = plain(api.fieldRows(merged, source, { bienSo: '47H 114.50', khachHang: 'NGUYỄN VĂN B', hangXe: 'HONDA', uocThietHai: '12500000' }));
  const byKey = Object.fromEntries(rows.map(row => [row.key, row]));
  assert.equal(byKey.bien_so.same, true);
  assert.equal(byKey.tong_tien.same, true);
  assert.equal(byKey.hang_xe.same, true, 'khác hoa/thường vẫn là khớp');
  assert.equal(byKey.chu_xe.same, false);
  assert.equal(byKey.chu_xe.current, 'NGUYỄN VĂN B');
  assert.equal(api.plateKey('47h-114.50'), '47H11450');
});

test('không có trường nào trích số CCCD/GPLX và nội dung dài bị cắt', () => {
  assert.ok(!Object.keys(api.FIELDS).some(key => /cccd|cmnd|gplx/i.test(key)));
  const docs = plain(api.parseExtraction(JSON.stringify([{ loai: 'x'.repeat(500), chu_xe: 'y'.repeat(500) }])));
  assert.equal(docs[0].chu_xe.length, 200);
});
