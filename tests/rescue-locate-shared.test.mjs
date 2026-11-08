import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL('../js/features/' + name, import.meta.url), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(read('reimbursements/location-parse.js') + '\n;this.FieldLocationParse = FieldLocationParse;', ctx);
const R = vm.runInContext(read('rescue/rescue-locate.js') + '\n;RescueLocate', ctx);

test('đọc link Google Maps khách gửi qua Zalo', () => {
  const r = R.readShared('Vị trí của tôi: https://www.google.com/maps?q=12.686955,108.054487&z=17');
  assert.equal(r.point.lat, 12.686955); assert.equal(r.point.lon, 108.054487); assert.equal(r.source, 'link');
  const at = R.readShared('https://www.google.com/maps/place/Dak+Lak/@12.6667,108.0383,15z');
  assert.equal(at.point.lat, 12.6667);
});

test('đọc toạ độ trần và toạ độ trong tin nhắn', () => {
  assert.equal(R.readShared('12.686955, 108.054487').point.lon, 108.054487);
  assert.equal(R.readShared('Xe hỏng ở 12.686955, 108.054487 anh ơi').point.lat, 12.686955);
  assert.equal(R.readShared('12°41\'13.0"N 108°03\'16.1"E').source, 'dms');
});

test('link rút gọn Google Maps trả về shortLink để báo người dùng', () => {
  const r = R.readShared('https://maps.app.goo.gl/AbCdEf123');
  assert.equal(r.shortLink, true); assert.ok(!r.point);
});

test('địa chỉ có số nhìn giống toạ độ không bị nhầm (vẫn đi tìm địa chỉ)', () => {
  for (const text of ['Số 12, 108 Lê Duẩn, Buôn Ma Thuột', '12, 108 Nguyễn Tất Thành', 'Km 15, 110 QL14', 'Buôn Ma Thuột', 'Ngã tư Phan Chu Trinh']) {
    assert.equal(R.readShared(text), null, text);
  }
});

test('nội dung rỗng hoặc không phải vị trí → null, không ném lỗi', () => {
  for (const v of [undefined, null, '', '   ', 'alo anh ơi', 'https://example.com/abc']) assert.equal(R.readShared(v), null, String(v));
});

test('toạ độ ngoài phạm vi hợp lệ bị loại', () => {
  assert.equal(R.readShared('123.456789, 200.123456'), null);
  assert.equal(R.readShared('0, 0'), null);
});
