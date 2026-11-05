import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../js/features/admin/users.js', import.meta.url), 'utf8');
const ctx = vm.createContext({activeUserProfile: null});
vm.runInContext(src, ctx);
const can = (profile, module, action) => { ctx.activeUserProfile = profile; return vm.runInContext(`hasUserPermission(${JSON.stringify(module)}, ${JSON.stringify(action)})`, ctx); };
const gdv = permissions => ({role: 'Giám định viên', permissions});
const ACTIONS = ['view', 'add', 'edit', 'delete'];
const row = (profile, module) => ACTIONS.map(a => can(profile, module, a));

test('Danh bạ nội bộ: chưa cấp quyền riêng → xem được, thêm/sửa/xóa theo quyền Admin hệ thống; Admin có đủ', () => {
  assert.deepEqual(row(gdv({list: {view: true}}), 'contacts'), [true, false, false, false]);
  assert.deepEqual(row(gdv({users: {admin: true}}), 'contacts'), [true, true, true, true]);
  assert.deepEqual(row({role: 'Admin'}, 'contacts'), [true, true, true, true]);
  assert.deepEqual(row(gdv({contacts: {view: true, edit: true}}), 'contacts'), [true, false, true, false]);
  assert.deepEqual(row(gdv({contacts: {view: false}}), 'contacts'), [false, false, false, false]);
});

test('Chi phí cứu hộ / Biểu mẫu dùng chung: tài khoản có sẵn giữ nguyên quyền cũ, Admin hạn chế được từng thao tác', () => {
  for (const module of ['rescue_cost', 'shared_forms']) {
    assert.deepEqual(row(gdv({list: {view: true}}), module), [true, true, true, true], module + ': chưa cấp riêng → như cũ');
    assert.deepEqual(row({role: 'Giám định viên'}, module), [true, true, true, true], module + ': chưa có permissions');
    assert.deepEqual(row(gdv({[module]: {view: true, add: false, edit: false, delete: false}}), module), [true, false, false, false]);
    assert.deepEqual(row(gdv({[module]: {view: false}}), module), [false, true, true, true], 'khóa chưa khai báo vẫn mặc định cho phép; Admin cần bỏ tick từng ô');
    assert.deepEqual(row({role: 'Admin'}, module), [true, true, true, true]);
  }
});

test('Hiện trường: Sửa/Xóa mới mặc định cho phép, quyền Xem/Tạo/Duyệt giữ nguyên cách tính cũ', () => {
  const old = gdv({field_reimb: {view: true, create: true, review: false}});
  assert.equal(can(old, 'field_reimb', 'edit'), true);
  assert.equal(can(old, 'field_reimb', 'delete'), true);
  assert.equal(can(old, 'field_reimb', 'review'), false);
  const limited = gdv({field_reimb: {view: true, create: true, edit: false, delete: false, review: false}});
  assert.equal(can(limited, 'field_reimb', 'edit'), false);
  assert.equal(can(limited, 'field_reimb', 'delete'), false);
  assert.equal(can(limited, 'field_reimb', 'create'), true);
  assert.equal(can({role: 'Admin'}, 'field_reimb', 'delete'), true);
});
