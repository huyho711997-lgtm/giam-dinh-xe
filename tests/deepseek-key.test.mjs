import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/ai/deepseek-key.js', import.meta.url), 'utf8');

function setup({ uid = 'u1', stored = {}, local = {}, failWrite = false } = {}) {
  const store = { ...stored };
  const calls = { set: [], remove: [] };
  const db = { ref: path => ({
    once: async () => ({ val: () => store[path] ?? null }),
    set: async value => { if (failWrite) throw new Error('denied'); calls.set.push([path, value]); store[path] = value; },
    remove: async () => { calls.remove.push(path); delete store[path]; }
  }) };
  const ls = { ...local };
  const context = vm.createContext({
    console, String, Error, Promise,
    localStorage: { getItem: k => ls[k] ?? null, setItem: (k, v) => { ls[k] = v; }, removeItem: k => { delete ls[k]; } },
    firebase: { auth: () => ({ currentUser: uid ? { uid } : null }) },
    dbNodeInstance: db
  });
  vm.runInContext(`${source}\n;this.api = DeepSeekKeyStore;`, context);
  return { api: context.api, store, ls, calls };
}

test('khoá DeepSeek đọc/ghi theo tài khoản, tách biệt với khoá Gemini', async () => {
  const env = setup({ stored: { 'user_secrets/u1/geminiApiKey': 'G', 'user_secrets/u1/deepseekApiKey': 'sk-a' } });
  assert.equal(await env.api.get(), 'sk-a');
  const result = await env.api.set('  sk-b  ');
  assert.equal(result.scope, 'account');
  assert.deepEqual(env.calls.set, [['user_secrets/u1/deepseekApiKey', 'sk-b']]);
  assert.equal(env.store['user_secrets/u1/geminiApiKey'], 'G');
});

test('khoá cũ trên trình duyệt được chuyển lên tài khoản; ghi thất bại thì giữ ở trình duyệt', async () => {
  const moved = setup({ local: { deepseek_api_key: 'sk-local' } });
  assert.equal(await moved.api.get(), 'sk-local');
  assert.equal(moved.ls.deepseek_api_key, undefined);
  const blocked = setup({ failWrite: true });
  assert.equal((await blocked.api.set('sk-x')).scope, 'browser');
  assert.equal(blocked.ls.deepseek_api_key, 'sk-x');
  assert.equal(await blocked.api.get(), 'sk-x');
});

test('từ chối khoá rỗng/không hợp lệ và xoá được khoá', async () => {
  const env = setup({ stored: { 'user_secrets/u1/deepseekApiKey': 'sk-a' } });
  await assert.rejects(() => env.api.set('   '), /Nhập khoá/);
  await assert.rejects(() => env.api.set('có khoảng trắng'), /không hợp lệ/);
  await env.api.clear();
  assert.deepEqual(env.calls.remove, ['user_secrets/u1/deepseekApiKey']);
  assert.equal(await env.api.get(), '');
});
