import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL('../js/' + name, import.meta.url), 'utf8');
const ls = {};
const context = vm.createContext({atob, btoa, TextEncoder, TextDecoder, AbortController, DOMException, JSON, localStorage: {getItem: k => ls[k] ?? null, setItem: (k, v) => { ls[k] = v; }, removeItem: k => { delete ls[k]; }}});
vm.runInContext(read('features/documents/official-letter-ai.js') + read('features/documents/official-letter-models.js') + '\nthis.AI=OfficialLetterAI; this.M=OfficialLetterModels;', context);
const {AI, M} = context;
const plain = value => JSON.parse(JSON.stringify(value));
const gemini = (extra = {}) => ({system_instruction: {parts: [{text: 'Hệ thống.'}]}, contents: [{role: 'user', parts: [{text: 'Xin chào'}]}], generationConfig: {temperature: 0.3}, ...extra});
const image = {inlineData: {mimeType: 'image/png', data: 'AAAA'}};
const ok = content => ({ok: true, status: 200, json: async () => ({choices: [{message: {content}, finish_reason: 'stop'}]})});
const fail = (status, error) => ({ok: false, status, json: async () => ({error: {message: error || 'lỗi'}})});

test('cấu hình mặc định có DeepSeek, Gemini, Groq và chọn sẵn mô hình đầu tiên', () => {
  const cfg = M.defaults();
  assert.equal(cfg.selected, 'deepseek:deepseek-flash');
  const ids = M.entries(cfg).map(entry => entry.id);
  assert.ok(ids.includes('gemini:gemini-3.8-flash') && ids.includes('groq:openai/gpt-oss-120b') && ids.includes('groq:llama-3.3-70b-versatile'));
  assert.equal(M.entries(cfg).find(entry => entry.id === 'groq:openai/gpt-oss-120b').label, 'Groq · gpt-oss-120b');
  assert.deepEqual(plain(cfg.providers.custom.models), []);
});

test('chuẩn hoá cấu hình: tên mô hình/địa chỉ gốc hợp lệ, mô hình đã chọn không còn thì quay về mô hình đầu', () => {
  const cfg = M.normalize({selected: 'groq:không-có', providers: {groq: {models: 'a/b-1, a/b-1; xấu tên!, c'}, custom: {base: 'https://openrouter.ai/api/v1/chat/completions/', label: '  OR  ', models: ['x/y:free']}}});
  assert.deepEqual(plain(cfg.providers.groq.models), ['a/b-1', 'c']);
  assert.equal(cfg.providers.custom.base, 'https://openrouter.ai/api/v1');
  assert.equal(cfg.providers.custom.label, 'OR');
  assert.equal(cfg.selected, 'deepseek:deepseek-flash');
  assert.equal(M.normalizeBase('http://evil.com/v1'), '');
  assert.equal(M.normalizeBase('http://localhost:11434/v1'), 'http://localhost:11434/v1');
  assert.equal(M.normalize({selected: 'custom:x/y:free', providers: {custom: {base: 'https://openrouter.ai/api/v1', models: ['x/y:free']}}}).selected, 'custom:x/y:free');
});

test('resolve: địa chỉ gọi, nhãn và khả năng của từng nhà cung cấp', () => {
  const cfg = M.normalize({providers: {custom: {base: 'https://openrouter.ai/api/v1', label: 'OpenRouter', models: ['meta/llama:free']}}});
  const gem = M.resolve(cfg, 'gemini:gemini-3.8-flash');
  assert.equal(gem.endpoint, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
  assert.equal(gem.profile.reasoning, 'effort');
  const oss = M.resolve(cfg, 'groq:openai/gpt-oss-120b'), llama = M.resolve(cfg, 'groq:llama-3.3-70b-versatile');
  assert.equal(oss.endpoint, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(oss.profile.reasoning, 'effort');
  assert.equal(llama.profile.reasoning, 'none');
  assert.equal(llama.profile.vision, false);
  assert.ok(llama.profile.maxOut > 0 && llama.profile.maxSources > 0);
  const custom = M.resolve(cfg, 'custom:meta/llama:free');
  assert.equal(custom.endpoint, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(custom.label, 'OpenRouter · llama:free');
  assert.equal(M.resolve(cfg, 'không-có').id, 'deepseek:deepseek-flash');
});

test('Antigravity được chọn và lưu lại, địa chỉ chỉ trỏ về máy đang dùng', () => {
  const cfg = M.normalize({selected:'antigravity:gemini-3-flash'});
  const item = M.resolve(cfg);
  assert.equal(item.provider,'antigravity');
  assert.equal(item.endpoint,'http://127.0.0.1:18318/v1/chat/completions');
  assert.equal(item.model,'gemini-3-flash');
  const upgraded = M.resolve(M.normalize({selected:'antigravity:gemini-3.8-flash-tiered'}));
  assert.equal(upgraded.model,'gemini-3.8-flash-tiered');
  assert.equal(upgraded.provider,'antigravity');
  assert.equal(M.normalize(cfg).selected,item.id);
});

test('toChatRequest: Gemini dùng reasoning_effort, không gửi tham số thinking của DeepSeek', () => {
  const prof = M.profile('gemini', 'gemini-3.8-flash');
  const deep = plain(AI.toChatRequest(gemini(), {model: 'gemini-3.8-flash', profile: prof, thinking: true, maxTokens: 16000}));
  assert.equal(deep.reasoning_effort, 'high'); assert.equal(deep.thinking, undefined); assert.equal(deep.temperature, undefined); assert.equal(deep.max_tokens, 16000);
  const fast = plain(AI.toChatRequest(gemini(), {model: 'gemini-3.8-flash', profile: prof, thinking: false}));
  assert.equal(fast.reasoning_effort, 'low'); assert.equal(fast.temperature, 0.3); assert.equal(fast.thinking, undefined);
  const ds = plain(AI.toChatRequest(gemini(), {model: 'deepseek-flash', thinking: true}));
  assert.deepEqual(ds.thinking, {type: 'enabled'});
});

test('toChatRequest: Groq giới hạn max_tokens và chỉ gửi reasoning_effort cho gpt-oss', () => {
  const oss = plain(AI.toChatRequest(gemini(), {profile: M.profile('groq', 'openai/gpt-oss-120b'), thinking: true, maxTokens: 16000}));
  assert.equal(oss.max_tokens, 4000); assert.equal(oss.reasoning_effort, 'medium');
  const llama = plain(AI.toChatRequest(gemini(), {profile: M.profile('groq', 'llama-3.3-70b-versatile'), thinking: true, maxTokens: 16000}));
  assert.equal(llama.reasoning_effort, undefined); assert.equal(llama.thinking, undefined); assert.equal(llama.max_tokens, 4000); assert.equal(llama.temperature, undefined);
});

test('mô hình không đọc được ảnh thì báo lỗi rõ thay vì gửi đi', () => {
  const withImage = gemini({contents: [{role: 'user', parts: [{text: 'xem ảnh'}, image]}]});
  assert.throws(() => AI.toChatRequest(withImage, {profile: M.profile('groq', 'llama-3.3-70b-versatile')}), /không đọc được ảnh/);
  assert.doesNotThrow(() => AI.toChatRequest(withImage, {profile: M.profile('gemini', 'gemini-3.8-flash')}));
  assert.doesNotThrow(() => AI.toChatRequest(withImage, {}));
});

test('call: gọi đúng địa chỉ + khoá của nhà cung cấp; lỗi mang tên nhà cung cấp', async () => {
  const seen = [];
  const fetchImpl = async (url, init) => { seen.push([url, init.headers.Authorization]); return ok('xong'); };
  const text = await AI.call(gemini(), {apiKey: 'gsk-1', endpoint: 'https://api.groq.com/openai/v1/chat/completions', label: 'Groq', model: 'm', fetchImpl});
  assert.equal(text, 'xong');
  assert.deepEqual(seen[0], ['https://api.groq.com/openai/v1/chat/completions', 'Bearer gsk-1']);
  await assert.rejects(AI.call(gemini(), {apiKey: 'k', label: 'Groq', fetchImpl: async () => fail(401)}), /Khoá Groq API không đúng/);
  await assert.rejects(AI.call(gemini(), {apiKey: 'k', label: 'Google Gemini', fetchImpl: async () => fail(404)}), /Google Gemini không tìm thấy mô hình/);
  await assert.rejects(AI.call(gemini(), {apiKey: 'k', label: 'Groq', fetchImpl: async () => fail(413)}), /quá lớn so với giới hạn của Groq/);
  const limited = await AI.call(gemini(), {apiKey: 'k', label: 'Groq', fetchImpl: async () => fail(429)}).catch(error => error);
  assert.equal(limited.retryable, true); assert.match(limited.message, /Groq đang giới hạn lưu lượng.*miễn phí/);
  assert.equal(AI.httpError(402, null).message, 'Tài khoản DeepSeek đã hết số dư. Nạp thêm tại platform.deepseek.com rồi thử lại.');
  await assert.rejects(AI.call(gemini(), {label: 'Groq'}), /Chưa có khoá Groq API/);
});

test('call: dịch vụ không hỗ trợ JSON mode thì tự thử lại một lần không có response_format', async () => {
  const bodies = [];
  const fetchImpl = async (url, init) => { const body = JSON.parse(init.body); bodies.push(body); return body.response_format ? fail(400, "'response_format' is not supported with this model") : ok('{"a":1}'); };
  const request = gemini({generationConfig: {responseMimeType: 'application/json'}});
  assert.equal(await AI.call(request, {apiKey: 'k', label: 'X', fetchImpl}), '{"a":1}');
  assert.equal(bodies.length, 2); assert.ok(bodies[0].response_format); assert.equal(bodies[1].response_format, undefined);
});

test('listModels: lọc mô hình không phải chat, bỏ tiền tố models/', async () => {
  const cfg = M.defaults();
  const withData = data => async url => ({ok: true, status: 200, json: async () => ({data}), url});
  const gem = await M.listModels('gemini', cfg, {apiKey: 'k', fetchImpl: withData([{id: 'models/gemini-3.8-flash'}, {id: 'models/text-embedding-004'}, {id: 'models/gemini-3.8-pro'}, {id: 'models/gemini-3-image'}])});
  assert.deepEqual(plain(gem), ['gemini-3.8-flash', 'gemini-3.8-pro']);
  const groq = await M.listModels('groq', cfg, {apiKey: 'k', fetchImpl: withData([{id: 'whisper-large-v3'}, {id: 'llama-3.3-70b-versatile'}, {id: 'openai/gpt-oss-120b'}])});
  assert.deepEqual(plain(groq), ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b']);
  await assert.rejects(M.listModels('groq', cfg, {apiKey: 'k', fetchImpl: async () => fail(401)}), /Khoá Groq không đúng/);
  await assert.rejects(M.listModels('custom', cfg, {apiKey: 'k'}), /địa chỉ gốc/i);
});

test('lưu/đọc cấu hình ở localStorage và thông báo thiếu khoá', () => {
  const saved = M.save({selected: 'groq:llama-3.3-70b-versatile'});
  assert.equal(saved.selected, 'groq:llama-3.3-70b-versatile');
  assert.equal(M.load().selected, 'groq:llama-3.3-70b-versatile');
  ls[M.KEY] = '{hỏng';
  assert.equal(M.load().selected, 'deepseek:deepseek-flash');
  assert.match(M.noKeyMessage('groq', M.defaults()), /Chưa có khoá Groq.*console\.groq\.com\/keys/);
});

test('Antigravity có suy luận sâu: reasoning_effort high khi bật, low khi tắt; hạn chờ dài hơn khi suy luận và chỉ áp cho Antigravity', () => {
  const prof = M.profile('antigravity', 'gemini-3-flash');
  assert.equal(prof.reasoning, 'effort'); assert.equal(prof.effortOn, 'high'); assert.equal(prof.effortOff, 'low');
  assert.equal(M.resolve(M.normalize({selected: 'antigravity:gemini-3-flash'})).profile.reasoning, 'effort');
  const deep = plain(AI.toChatRequest(gemini(), {model: 'gemini-3-flash', profile: prof, thinking: true, maxTokens: 16000}));
  assert.equal(deep.reasoning_effort, 'high'); assert.equal(deep.thinking, undefined); assert.equal(deep.temperature, undefined); assert.equal(deep.max_tokens, 16000);
  const fast = plain(AI.toChatRequest(gemini(), {model: 'gemini-3-flash', profile: prof}));
  assert.equal(fast.reasoning_effort, 'low'); assert.equal(fast.thinking, undefined); assert.equal(fast.temperature, 0.3);
  assert.equal(M.timeoutMs('antigravity', false), 45000);
  assert.ok(M.timeoutMs('antigravity', true) > 120000 && M.timeoutMs('antigravity', true) < 180000);   // dài hơn lượt thường nhưng ngắn hơn hạn 180 giây của cầu nối
  for (const id of ['deepseek', 'gemini', 'groq', 'custom']) assert.equal(M.timeoutMs(id, true), 0);
});

test('Antigravity hỗ trợ endpoint HTTPS Tailscale (.ts.net) theo trình duyệt và từ chối URL không hợp lệ', () => {
  // Mặc định vẫn là localhost
  assert.equal(M.resolve(M.defaults(), 'antigravity:gemini-3-flash').endpoint, 'http://127.0.0.1:18318/v1/chat/completions');
  // Chuẩn hoá các dạng URL Tailscale HTTPS hợp lệ
  assert.equal(M.normalizeAntigravityBase('https://relay-node.tail1234.ts.net'), 'https://relay-node.tail1234.ts.net/v1');
  assert.equal(M.normalizeAntigravityBase('https://RELAY-NODE.tail1234.ts.net/v1/'), 'https://relay-node.tail1234.ts.net/v1');
  assert.equal(M.normalizeAntigravityBase('https://relay-node.tail1234.ts.net/v1/chat/completions'), 'https://relay-node.tail1234.ts.net/v1');
  // Từ chối HTTP, non-Tailscale, IP, username/password, query, hash, path lạ
  for (const bad of [
    'http://relay-node.tail1234.ts.net',
    'http://127.0.0.1:18318/v1',
    'https://100.64.0.1/v1',
    'https://evil.example.com/v1',
    'https://relay-node.tail1234.ts.net.evil.com',
    'https://ts.net',
    'https://single.ts.net',
    'https://user:pass@relay-node.tail1234.ts.net',
    'https://user@relay-node.tail1234.ts.net',
    'https://relay-node.tail1234.ts.net?foo=1',
    'https://relay-node.tail1234.ts.net/v1?token=abc',
    'https://relay-node.tail1234.ts.net/v1#frag',
    'https://relay-node.tail1234.ts.net/other'
  ]) {
    assert.equal(M.normalizeAntigravityBase(bad), '', 'phải từ chối: ' + bad);
  }
  // Lưu vào localStorage, không lưu khoá relay và giữ nguyên danh sách model cố định
  const saved = M.save({selected: 'antigravity:gemini-3-flash', providers: {antigravity: {base: 'https://relay-node.tail1234.ts.net', apiKey: 'should-drop', models: ['evil-model']}}});
  const loaded = M.load();
  const active = M.resolve(loaded, 'antigravity:gemini-3-flash');
  assert.equal(active.endpoint, 'https://relay-node.tail1234.ts.net/v1/chat/completions');
  assert.equal(active.providerLabel, 'Antigravity (Tailscale)');
  assert.equal(loaded.providers.antigravity.apiKey, undefined);
  assert.deepEqual(plain(M.entries(loaded).filter(e => e.provider === 'antigravity').map(e => e.model)), ['gemini-3.8-flash-tiered', 'gemini-3-flash']);
  assert.equal(saved.providers.antigravity.base, 'https://relay-node.tail1234.ts.net/v1');
  // Xoá endpoint Tailscale thì quay lại localhost mặc định
  M.save({selected: 'antigravity:gemini-3-flash', providers: {antigravity: {base: ''}}});
  assert.equal(M.resolve(M.load(), 'antigravity:gemini-3-flash').endpoint, 'http://127.0.0.1:18318/v1/chat/completions');
});
