import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/zalo/zalo-window.js', import.meta.url), 'utf8');
function setup({ blocked = false } = {}) {
  const opened = [], classes = new Set(), attrs = {}, toasts = [];
  const fakeWindow = { closed: false, focused: 0, opener: 'app', location: { href: '' }, focus() { this.focused++; } };
  const button = { classList: { toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)) }, setAttribute: (key, value) => { attrs[key] = value; } };
  const ctx = vm.createContext({ console, Number, Math, String, setInterval: () => 1, clearInterval() {},
    document: { getElementById: id => (id === 'tasco-zalo-btn' ? button : null) },
    window: { screen: { availWidth: 1920, availHeight: 1040, availLeft: 0, availTop: 0 }, open: (url, name, features) => { opened.push({ url, name, features }); return blocked ? null : fakeWindow; } },
    triggerToast: (message, kind) => toasts.push([message, kind]) });
  vm.runInContext(source + '\n;this.api = ZaloWindow;', ctx);
  return { api: ctx.api, opened, fakeWindow, classes, attrs, toasts };
}

test('cửa sổ nổi đặt ở góc phải-dưới vùng làm việc', () => {
  const { api } = setup();
  assert.equal(api.features({ availWidth: 1920, availHeight: 1040, availLeft: 0, availTop: 0 }), 'popup=yes,width=440,height=720,left=1464,top=304,resizable=yes,scrollbars=yes');
  assert.match(api.features({ availWidth: 1920, availHeight: 1040, availLeft: -1920, availTop: 0 }), /left=-456,/, 'màn hình phụ bên trái có toạ độ âm');
});

test('màn hình nhỏ: thu cửa sổ lại nhưng không nhỏ hơn mức tối thiểu', () => {
  const { api } = setup();
  assert.match(api.features({ availWidth: 600, availHeight: 600 }), /width=440,height=568,left=144,top=16,/);
  assert.match(api.features({ availWidth: 300, availHeight: 300 }), /width=320,height=420,/);
  assert.match(api.features({}), /left=\d+,top=\d+/, 'thiếu thông tin màn hình vẫn có giá trị mặc định');
});

test('mở: trang trắng → ngắt opener → chuyển tới Zalo; nhấn lại thì chỉ đưa lên trước', () => {
  const { api, opened, fakeWindow } = setup();
  const win = api.open();
  assert.equal(opened.length, 1);
  assert.equal(opened[0].url, 'about:blank');
  assert.equal(opened[0].name, 'tasco_zalo_web');
  assert.equal(win.opener, null, 'Zalo không giữ tham chiếu ngược về app');
  assert.equal(fakeWindow.location.href, 'https://chat.zalo.me/');
  assert.equal(api.isOpen(), true);
  api.open();
  assert.equal(opened.length, 1, 'không mở thêm cửa sổ thứ hai');
  assert.equal(fakeWindow.focused, 1);
  fakeWindow.closed = true;
  assert.equal(api.isOpen(), false);
  api.open();
  assert.equal(opened.length, 2, 'đóng rồi thì mở lại được');
});

test('bị trình duyệt chặn pop-up: báo hướng dẫn, không lỗi', () => {
  const { api, toasts } = setup({ blocked: true });
  assert.equal(api.open(), null);
  assert.match(toasts[0][0], /pop-up/);
});
