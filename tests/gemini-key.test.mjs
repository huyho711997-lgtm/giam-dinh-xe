import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/ai/gemini-key.js', import.meta.url), 'utf8');

function setup({ uid = 'u1', stored = {}, local = {}, failWrite = false, failRead = false } = {}) {
  const store = { ...stored };
  const calls = { set: [], remove: [] };
  const db = { ref: path => ({
    once: async () => { if (failRead) throw new Error('denied'); return { val: () => store[path] ?? null }; },
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
  vm.runInContext(`${source}\n;this.api = GeminiKeyStore;`, context);
  return { api: context.api, store, ls, calls };
}

test('khoá được đọc theo uid của tài khoản đăng nhập', async () => {
  const env = setup({ stored: { 'user_secrets/u1/geminiApiKey': 'KEY-A' } });
  assert.equal(await env.api.get(), 'KEY-A');
});

test('khoá cũ trên trình duyệt được chuyển lên tài khoản rồi xoá local', async () => {
  const env = setup({ local: { gemini_api_key: 'OLD' } });
  assert.equal(await env.api.get(), 'OLD');
  assert.deepEqual(JSON.parse(JSON.stringify(env.calls.set)), [['user_secrets/u1/geminiApiKey', 'OLD']]);
  assert.equal(env.ls.gemini_api_key, undefined);
});

test('lưu khoá vào tài khoản; hai tài khoản không dùng chung khoá', async () => {
  const first = setup({ uid: 'u1' });
  assert.deepEqual(JSON.parse(JSON.stringify(await first.api.set('  KEY-1  '))), { scope: 'account' });
  assert.equal(first.store['user_secrets/u1/geminiApiKey'], 'KEY-1');
  const second = setup({ uid: 'u2', stored: first.store });
  assert.equal(await second.api.get(), '');
});

test('rules chưa cho ghi: lưu tạm trên trình duyệt và báo scope=browser', async () => {
  const env = setup({ failWrite: true });
  assert.deepEqual(JSON.parse(JSON.stringify(await env.api.set('K'))), { scope: 'browser' });
  assert.equal(env.ls.gemini_api_key, 'K');
});

test('đọc bị từ chối: dùng khoá local; chưa đăng nhập: dùng khoá local', async () => {
  assert.equal(await setup({ failRead: true, local: { gemini_api_key: 'L' } }).api.get(), 'L');
  assert.equal(await setup({ uid: '', local: { gemini_api_key: 'L2' } }).api.get(), 'L2');
});

test('từ chối khoá rỗng hoặc có khoảng trắng', async () => {
  const env = setup();
  await assert.rejects(() => env.api.set('   '), /Nhập khoá/);
  await assert.rejects(() => env.api.set('a b'), /không hợp lệ/);
});
