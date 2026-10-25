import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/claims/claim-email.js', import.meta.url), 'utf8');
const sandbox = {document: {getElementById: () => null}, triggerToast() {}, JSON};
const context = vm.createContext(sandbox);
const Email = vm.runInContext(source + '\n;ClaimEmail', context);
const ctx = {unit: 'Chi nhánh Đắk Lắk', plate: '47H11450', hsbt: 'HSBT/1', facts: ['- Biển số xe: 47H11450'], sender: 'Hồ Quang Huy'};

test('thư yêu cầu hình ảnh liệt kê đúng các mục đã chọn và yêu cầu khác', () => {
  const mail = Email.buildImageRequest(ctx, {items: ['body', 'odometer'], note: 'Hình xe sau sửa chữa\n- Biên bản bàn giao'});
  assert.equal(mail.subject, '[Yêu cầu cung cấp hình ảnh cấp đơn] 47H11450 – HSBT/1');
  assert.match(mail.body, /^Kính gửi Chi nhánh Đắk Lắk,/);
  assert.match(mail.body, /- Hình ảnh các mặt xe lúc cấp đơn/);
  assert.match(mail.body, /- Hình ảnh đồng hồ công-tơ-mét/);
  assert.ok(!mail.body.includes('số khung'), 'mục không chọn thì không có trong thư');
  assert.match(mail.body, /- Hình xe sau sửa chữa\n- Biên bản bàn giao/);
  assert.match(mail.body, /Trân trọng,\nHồ Quang Huy$/);
});

test('chữ ký thư đổi khi đổi lựa chọn → nháp cũ không ghi đè nội dung mới', () => {
  const a = Email.buildImageRequest(ctx, {items: ['body'], note: ''}).signature;
  const b = Email.buildImageRequest(ctx, {items: ['body', 'chassis'], note: ''}).signature;
  assert.notEqual(a, b);
});

test('lưu / nạp trạng thái: giữ lựa chọn, bỏ mục lạ, mặc định chỉ tích hình các mặt xe', () => {
  assert.deepEqual([...Email.getState().imageRequest.items], ['body'], 'mặc định chỉ tích hình ảnh các mặt xe');
  Email.load({imageRequest: {items: ['body', 'khong-ton-tai'], note: 'x', mail: {to: 'a@x.vn', cc: 'b@x.vn', body: 'nháp', extra: 'bỏ'}}});
  const state = Email.getState().imageRequest;
  assert.deepEqual([...state.items], ['body']);
  assert.equal(state.note, 'x');
  assert.equal(state.mail.to, 'a@x.vn');
  assert.ok(!('extra' in state.mail), 'khóa lạ bị loại');
  Email.load({});
  assert.equal(Email.getState().imageRequest.note, '');
});

test('thư hình ảnh: khối diễn biến tổn thất nằm sau thông tin hồ sơ, đổi diễn biến thì đổi signature', () => {
  const withIncident = {...ctx, incident: ['', 'DIỄN BIẾN TỔN THẤT', 'Xe va quệt với xe tải.']};
  const mail = Email.buildImageRequest(withIncident, {items: ['body'], note: ''});
  assert.match(mail.body, /- Biển số xe: 47H11450\n\nDIỄN BIẾN TỔN THẤT\nXe va quệt với xe tải\.\n\nNỘI DUNG ĐỀ NGHỊ CUNG CẤP/);
  assert.doesNotMatch(mail.body, /Mã vụ tổn thất/);
  const other = Email.buildImageRequest({...ctx, incident: ['', 'DIỄN BIẾN TỔN THẤT', 'Khác.']}, {items: ['body'], note: ''});
  assert.notEqual(mail.signature, other.signature);
  assert.doesNotMatch(Email.buildImageRequest(ctx, {items: ['body'], note: ''}).body, /DIỄN BIẾN/);
});
