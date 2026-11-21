import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/documents/official-letter-history.js', import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
// Firebase giả: lưu theo đường dẫn phẳng, hỗ trợ once / update (đa đường dẫn, null = xoá).
function setup({ uid = 'u1', failWrite = false, failRead = false, local = {} } = {}) {
  const tree = {}, ls = { ...local };
  const get = path => path.split('/').filter(Boolean).reduce((node, key) => node && node[key], tree);
  const put = (path, value) => {
    const keys = path.split('/').filter(Boolean); let node = tree;
    keys.slice(0, -1).forEach(key => { node[key] = node[key] || {}; node = node[key]; });
    if (value === null) delete node[keys.at(-1)]; else node[keys.at(-1)] = JSON.parse(JSON.stringify(value));
  };
  const db = { ref: path => ({
    once: async () => { if (failRead) throw new Error('denied'); return { val: () => get(path) ?? null }; },
    update: async updates => { if (failWrite) throw new Error('denied'); Object.entries(updates).forEach(([key, value]) => put(path + '/' + key, value)); }
  }) };
  const ctx = vm.createContext({ console, String, Number, Date, Math, Promise, Array, Object, JSON, Error,
    localStorage: { getItem: k => ls[k] ?? null, setItem: (k, v) => { ls[k] = v; }, removeItem: k => { delete ls[k]; } },
    firebase: { auth: () => ({ currentUser: uid ? { uid } : null }) }, dbNodeInstance: db });
  vm.runInContext(source + '\n;this.api = OfficialLetterHistory;', ctx);
  return { api: ctx.api, tree, ls };
}

test('lưu theo tài khoản: chỉ mục nhẹ tách khỏi nội dung, mở lại đúng dữ liệu, ghi đè cùng id', async () => {
  const { api, tree } = setup();
  await api.load();
  const first = await api.save('', { title: 'V/v đề nghị cung cấp hồ sơ', sub: '47A-123.45', data: { brief: 'xin biên bản', letter: { subject: 's' } } });
  assert.equal(first.scope, 'account');
  assert.match(first.id, /^[a-z0-9]{6,32}$/);
  assert.deepEqual(Object.keys(tree.user_letters.u1.index[first.id]).sort(), ['sub', 'title', 'updatedAt']);
  assert.equal(typeof tree.user_letters.u1.items[first.id].data, 'string');
  assert.deepEqual(plain(await api.get(first.id)), { brief: 'xin biên bản', letter: { subject: 's' } });
  const again = await api.save(first.id, { title: 'V/v mới', data: { brief: 'sửa' } });
  assert.equal(again.id, first.id);
  assert.equal(api.list().length, 1);
  assert.equal(api.list()[0].title, 'V/v mới');
  const fresh = setup(); Object.assign(fresh.tree, JSON.parse(JSON.stringify(tree)));
  assert.equal((await fresh.api.load()).length, 1, 'máy khác đăng nhập cùng tài khoản thấy lịch sử');
});

test('mất mạng/chưa có quyền → lưu trên trình duyệt; mới nhất trước; xoá được', async () => {
  const { api, ls } = setup({ failWrite: true });
  await api.load();
  const a = await api.save('', { title: 'A', data: { n: 1 } });
  const b = await api.save('', { title: 'B', data: { n: 2 } });
  assert.equal(a.scope, 'browser');
  assert.equal(api.scope(), 'browser');
  assert.ok(ls['officialLetter.history.v1:u1']);
  assert.deepEqual(plain(api.list().map(item => item.title)).sort(), ['A', 'B']);
  assert.deepEqual(plain(await api.get(b.id)), { n: 2 });
  await api.remove(a.id);
  assert.deepEqual(plain(api.list().map(item => item.title)), ['B']);
  assert.equal(JSON.parse(ls['officialLetter.history.v1:u1']).index[a.id], undefined);
});

test('chưa đăng nhập vẫn dùng được (trình duyệt); id lạ/hỏng bị bỏ qua; dữ liệu quá lớn bị từ chối', async () => {
  const { api } = setup({ uid: '', local: { 'officialLetter.history.v1:anon': JSON.stringify({ index: { 'BAD!': { title: 'x' }, abcdef12: { title: 'Hợp lệ', updatedAt: 5 } }, items: { abcdef12: '{"ok":1}' } }) } });
  const list = plain(await api.load());
  assert.deepEqual(list.map(item => item.id), ['abcdef12']);
  assert.deepEqual(plain(await api.get('abcdef12')), { ok: 1 });
  assert.equal(await api.get('../../x'), null);
  await assert.rejects(api.save('', { title: 'to', data: { x: 'a'.repeat(160000) } }), /quá dài/);
});

test('nhóm theo thời gian: Hôm nay / Hôm qua / 7 ngày / 30 ngày / Cũ hơn', () => {
  const { api } = setup();
  const now = new Date(2026, 10, 21, 15, 0).getTime(), day = 86400000;
  const groups = plain(api.groups([{ id: 'a', updatedAt: now - 3600000 }, { id: 'b', updatedAt: now - day }, { id: 'c', updatedAt: now - 3 * day }, { id: 'd', updatedAt: now - 20 * day }, { id: 'e', updatedAt: now - 90 * day }], now));
  assert.deepEqual(groups.map(group => group.label), ['Hôm nay', 'Hôm qua', '7 ngày qua', '30 ngày qua', 'Cũ hơn']);
});

test('index.html nạp official-letter-history.js trước trang Công văn AI', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const at = name => html.indexOf('js/features/documents/official-letter-' + name + '.js');
  assert.ok(at('history') > 0 && at('history') < at('page'));
});
