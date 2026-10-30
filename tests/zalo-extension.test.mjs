import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const dir = new URL('../tools/zalo-embed-extension/', import.meta.url);
const read = name => fs.readFileSync(new URL(name, dir), 'utf8');

test('manifest hợp lệ và chỉ xin quyền cần thiết cho Zalo', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions.sort(), ['cookies', 'declarativeNetRequest']);
  assert.ok(manifest.host_permissions.every(url => /zalo(app)?\.(me|com)/.test(url)));
  for (const file of [manifest.background.service_worker, manifest.declarative_net_request.rule_resources[0].path, ...manifest.content_scripts[0].js]) assert.ok(fs.existsSync(new URL(file, dir)), file);
});

test('luật gỡ tiêu đề chỉ áp dụng cho khung Zalo do tên miền của app nhúng', () => {
  const [rule] = JSON.parse(read('rules.json'));
  assert.deepEqual(rule.condition.resourceTypes, ['sub_frame']);
  assert.deepEqual(rule.condition.requestDomains, ['zalo.me', 'zaloapp.com']);
  assert.ok(rule.condition.initiatorDomains.length > 0, 'phải giới hạn trang nhúng');
  assert.ok(!rule.condition.initiatorDomains.includes('*'));
  assert.deepEqual(rule.action.responseHeaders.map(item => item.header).sort(), ['content-security-policy', 'content-security-policy-report-only', 'x-frame-options']);
});

test('đổi cookie Zalo sang SameSite=None; Secure, bỏ qua tên miền khác và cookie đã đúng', async () => {
  const set = [];
  const ctx = vm.createContext({ console, String, Promise, globalThis: {}, chrome: { cookies: { set: async details => { set.push(details); }, getAll: async () => [], onChanged: { addListener() {} } }, runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} } } } });
  vm.runInContext(read('background.js') + '\n;this.api = globalThis.__zaloEmbed;', ctx);
  const api = ctx.api;
  assert.equal(api.inScope('.chat.zalo.me'), true);
  assert.equal(api.inScope('zalo.me'), true);
  assert.equal(api.inScope('notzalo.me'), false, 'không khớp hậu tố giả');
  assert.equal(api.inScope('example.com'), false);
  await api.relax({ domain: '.zalo.me', name: 'zpsid', value: 'x', path: '/', sameSite: 'lax', httpOnly: true, hostOnly: false, session: false, expirationDate: 1900000000, storeId: '0' });
  await api.relax({ domain: 'example.com', name: 'a', value: 'b', sameSite: 'lax' });
  await api.relax({ domain: 'id.zalo.me', name: 'c', value: 'd', sameSite: 'no_restriction' });
  assert.equal(set.length, 1);
  assert.deepEqual({ ...set[0] }, { url: 'https://zalo.me/', name: 'zpsid', value: 'x', path: '/', secure: true, httpOnly: true, sameSite: 'no_restriction', storeId: '0', domain: '.zalo.me', expirationDate: 1900000000 });
});
