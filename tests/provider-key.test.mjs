import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/ai/provider-key.js', import.meta.url), 'utf8');
function setup({ uid = 'u1', stored = {}, local = {}, failWrite = false } = {}) {
  const store = { ...stored }, calls = { set: [] }, ls = { ...local };
  const db = { ref: path => ({
    once: async () => ({ val: () => store[path] ?? null }),
    set: async value => { if (failWrite) throw new Error('denied'); calls.set.push([path, value]); store[path] = value; },
    remove: async () => { delete store[path]; }
  }) };
  const context = vm.createContext({ console, String, Error, Promise,
    localStorage: { getItem: k => ls[k] ?? null, setItem: (k, v) => { ls[k] = v; }, removeItem: k => { delete ls[k]; } },
    firebase: { auth: () => ({ currentUser: uid ? { uid } : null }) }, dbNodeInstance: db });
  vm.runInContext(`${source}\n;this.api = ProviderKeyStore;`, context);
  return { api: context.api, store, ls, calls };
}

test('khoá Groq và khoá tuỳ chỉnh lưu ở các nút riêng của tài khoản', async () => {
  const env = setup({ stored: { 'user_secrets/u1/groqApiKey': 'gsk-a' } });
  assert.equal(await env.api.groq.get(), 'gsk-a');
  assert.equal(await env.api.custom.get(), '');
  assert.equal((await env.api.custom.set('  sk-or  ')).scope, 'account');
  assert.deepEqual(env.calls.set, [['user_secrets/u1/customAiApiKey', 'sk-or']]);
});

test('khoá cũ ở trình duyệt được chuyển lên tài khoản; ghi thất bại thì giữ ở trình duyệt; khoá sai định dạng bị từ chối', async () => {
  const moved = setup({ local: { groq_api_key: 'gsk-local' } });
  assert.equal(await moved.api.groq.get(), 'gsk-local');
  assert.equal(moved.ls.groq_api_key, undefined);
  const blocked = setup({ failWrite: true });
  assert.equal((await blocked.api.groq.set('gsk-x')).scope, 'browser');
  assert.equal(blocked.ls.groq_api_key, 'gsk-x');
  await assert.rejects(blocked.api.groq.set('có khoảng trắng'), /không hợp lệ/);
  await blocked.api.groq.clear();
  assert.equal(blocked.ls.groq_api_key, undefined);
});
