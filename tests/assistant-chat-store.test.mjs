import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/ai/assistant-chat-store.js', import.meta.url), 'utf8');
function setup({ uid = 'u1', stored = {}, local = {}, failWrite = false, failRead = false } = {}) {
  const store = { ...stored }, calls = [];
  const db = { ref: path => ({
    once: async () => { if (failRead) throw new Error('denied'); return { val: () => store[path] ?? null }; },
    set: async value => { if (failWrite) throw new Error('denied'); calls.push(['set', path, value]); store[path] = JSON.parse(JSON.stringify(value)); },
    remove: async () => { calls.push(['remove', path]); delete store[path]; }
  }) };
  const ls = { ...local };
  const ctx = vm.createContext({ console, String, Number, Date, Math, Promise, Array, Object, JSON, Error, setTimeout, clearTimeout,
    localStorage: { getItem: k => ls[k] ?? null, setItem: (k, v) => { ls[k] = v; }, removeItem: k => { delete ls[k]; } },
    firebase: { auth: () => ({ currentUser: uid ? { uid } : null }) }, dbNodeInstance: db });
  vm.runInContext(source + '\n;this.api = TascoChatStore;', ctx);
  return { api: ctx.api, store, ls, calls };
}
const plain = value => JSON.parse(JSON.stringify(value));

test('đọc lịch sử từ tài khoản, chấp nhận dạng object của Firebase và bỏ dòng hỏng', async () => {
  const { api } = setup({ stored: { 'user_chats/u1': { messages: { 0: { r: 'u', x: 'xin chào', t: 1 }, 1: { r: 'a', x: 'chào bạn', t: 2 }, 2: { r: 'z', x: 'sai', t: 3 }, 3: { r: 'u', x: '  ', t: 4 } }, freq: [{ k: 'a', x: 'A', n: 3 }] } } });
  const state = await api.load();
  assert.deepEqual(plain(api.messages).map(item => item.r), ['u', 'a']);
  assert.equal(state.scope, 'account');
  assert.deepEqual(plain(api.frequent()), ['A']);
});

test('ghi vào tài khoản sau khi chờ gộp, kèm tiêu đề cập nhật; không để lại bản local', async () => {
  const { api, store, ls } = setup({ local: { 'tasco_ai_chat_v1:u1': '{}' } });
  await api.load();
  api.add('user', 'câu hỏi'); api.add('ai', 'trả lời');
  await api.flush();
  const saved = store['user_chats/u1'];
  assert.deepEqual(saved.messages.map(item => item.r), ['u', 'a']);
  assert.equal(typeof saved.updatedAt, 'number');
  assert.equal(ls['tasco_ai_chat_v1:u1'], undefined);
});

test('rules chưa cho phép ghi → lưu dự phòng trên trình duyệt và đọc lại được', async () => {
  const first = setup({ failWrite: true });
  await first.api.load();
  first.api.add('user', 'giữ lại giúp tôi');
  await first.api.flush();
  assert.equal(first.api.scope, 'browser');
  const second = setup({ failRead: true, local: first.ls });
  await second.api.load();
  assert.equal(plain(second.api.messages)[0].x, 'giữ lại giúp tôi');
});

test('giới hạn 40 tin và 4000 ký tự mỗi tin; xoá cuộc trò chuyện xoá node nhưng giữ câu hay hỏi', async () => {
  const { api, store } = setup();
  await api.load();
  for (let index = 0; index < 55; index++) api.add('user', 'm' + index + 'x'.repeat(index === 54 ? 5000 : 0));
  assert.equal(api.messages.length, 40);
  assert.equal(api.messages.at(-1).x.length, 4000);
  api.countQuestion('Hồ sơ tồn quá 7 ngày?'); api.countQuestion('hồ sơ  TỒN quá 7 ngày');
  api.countQuestion('một lần thôi');
  assert.deepEqual(plain(api.frequent()), ['hồ sơ  TỒN quá 7 ngày']);
  await api.clear();
  assert.equal(api.messages.length, 0);
  assert.equal(store['user_chats/u1'].messages.length, 0);
  assert.equal(api.frequent().length, 1);
});

test('chưa đăng nhập dùng localStorage riêng; câu hỏi quá dài không được đếm', async () => {
  const { api, ls } = setup({ uid: '' });
  await api.load();
  api.add('user', 'x'); api.countQuestion('y'.repeat(300));
  await api.flush();
  assert.ok(ls['tasco_ai_chat_v1:anon']);
  assert.equal(api.frequent().length, 0);
});
