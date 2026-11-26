import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/documents/official-letter-samples.js', import.meta.url), 'utf8');
const coreSrc = fs.readFileSync(new URL('../js/features/documents/official-letter-core.js', import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
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
    set: async value => { if (failWrite) throw new Error('denied'); put(path, value); },
    remove: async () => { put(path, null); }
  }) };
  const ctx = vm.createContext({ console, String, Number, Date, Math, Promise, Array, Object, JSON, Error, RegExp,
    localStorage: { getItem: k => ls[k] ?? null, setItem: (k, v) => { ls[k] = v; }, removeItem: k => { delete ls[k]; } },
    firebase: { auth: () => ({ currentUser: uid ? { uid } : null }) }, dbNodeInstance: db });
  vm.runInContext(source + '\n;this.api = OfficialLetterSamples;', ctx);
  return { api: ctx.api, tree, ls };
}

test('lưu mẫu lên tài khoản, tải lại thấy đủ', async () => {
  const { api, tree } = setup();
  const saved = await api.save({ name: 'Từ chối BT', templateId: 'tu_choi', text: 'Kính gửi…\r\n\r\n\r\n\r\nNội dung' });
  assert.equal(api.scope(), 'account');
  assert.equal(tree.user_letter_samples.u1[saved.id].text, 'Kính gửi…\n\nNội dung');
  assert.equal(plain(api.list()).length, 1);
});
test('lỗi ghi Firebase → giữ trên trình duyệt, không mất mẫu', async () => {
  const { api, ls } = setup({ failWrite: true });
  const saved = await api.save({ name: 'A', text: 'abc' });
  assert.equal(api.scope(), 'browser');
  assert.ok(JSON.parse(ls['officialLetter.samples.v1:u1'])[saved.id]);
});
test('nội dung trống bị từ chối; sửa giữ nguyên id; xoá được', async () => {
  const { api } = setup();
  await assert.rejects(() => api.save({ name: 'x', text: '  ' }), /trống/);
  const a = await api.save({ name: 'A', text: 'một' });
  const b = await api.save({ id: a.id, name: 'A2', text: 'hai' });
  assert.equal(b.id, a.id); assert.equal(api.list().length, 1); assert.equal(api.get(a.id).text, 'hai');
  await api.remove(a.id); assert.equal(api.list().length, 0);
});
test('pick: none / id / auto theo loại công văn, mới nhất thắng', () => {
  const { api } = setup();
  const s = [{ id: 'aaaaaa', templateId: 't1', updatedAt: 1 }, { id: 'bbbbbb', templateId: 't1', updatedAt: 5 }, { id: 'cccccc', templateId: '', updatedAt: 9 }];
  assert.equal(api.pick(s, 'none', 't1'), null);
  assert.equal(api.pick(s, 'aaaaaa', 't2').id, 'aaaaaa');
  assert.equal(api.pick(s, 'auto', 't1').id, 'bbbbbb');
  assert.equal(api.pick(s, 'auto', 't2'), null);
  assert.equal(api.pick(s, 'zzzzzz', 't1'), null);
});
test('core: mẫu người dùng được đưa vào prompt soạn thay mẫu hệ thống', () => {
  const ctx = vm.createContext({ console, String, Number, Date, Math, Array, Object, JSON, Error, RegExp, Set, Map });
  vm.runInContext(coreSrc + '\n;this.C = OfficialLetterCore;', ctx);
  const C = ctx.C;
  assert.equal(typeof C.userSampleBlock, 'function');
  assert.match(C.userSampleBlock({ name: 'MẪU-X', text: 'NỘI-DUNG-MẪU' }), /NỘI-DUNG-MẪU/);
});
