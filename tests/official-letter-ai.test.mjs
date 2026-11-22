import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL('../js/' + name, import.meta.url), 'utf8');
const context = vm.createContext({atob, btoa, TextEncoder, TextDecoder, AbortController, DOMException});
vm.runInContext(read('data/official-letter-templates.js') + read('features/documents/official-letter-core.js') + read('features/documents/official-letter-revisions.js') + read('features/documents/official-letter-ai.js') + '\nthis.AI=OfficialLetterAI; this.C=OfficialLetterCore; this.R=OfficialLetterRevisions;', context);
const {AI, C, R} = context;
const plain = value => JSON.parse(JSON.stringify(value));
const gemini = (extra = {}) => ({system_instruction: {parts: [{text: 'Hệ thống. Trả JSON.'}]}, contents: [{role: 'user', parts: [{text: 'Xin chào'}]}], generationConfig: {responseMimeType: 'application/json', temperature: 0.3}, ...extra});
const ok = content => ({ok: true, status: 200, json: async () => ({choices: [{message: {content}, finish_reason: 'stop'}]})});
const fail = (status, error) => ({ok: false, status, json: async () => ({error: {message: error || 'lỗi'}})});

test('đổi yêu cầu dạng Gemini sang chat/completions của DeepSeek', () => {
  const body = plain(AI.toChatRequest(gemini(), {model: 'deepseek-flash'}));
  assert.equal(body.model, 'deepseek-flash');
  assert.deepEqual(body.messages, [{role: 'system', content: 'Hệ thống. Trả JSON.'}, {role: 'user', content: 'Xin chào'}]);
  assert.deepEqual(body.response_format, {type: 'json_object'});
  assert.deepEqual(body.thinking, {type: 'disabled'});
  assert.equal(body.temperature, 0.3);
  assert.equal(body.stream, false);
  assert.ok(body.max_tokens >= 4096);
});

test('JSON mode luôn có chữ "json" trong prompt; bật suy luận thì không gửi temperature', () => {
  const body = plain(AI.toChatRequest(gemini({system_instruction: {parts: [{text: 'Chỉ trả lời.'}]}}), {thinking: true}));
  assert.match(body.messages[0].content, /JSON/);
  assert.deepEqual(body.thinking, {type: 'enabled'});
  assert.equal('temperature' in body, false);
  const noJson = plain(AI.toChatRequest({contents: [{role: 'user', parts: [{text: 'a'}]}]}));
  assert.equal('response_format' in noJson, false);
  assert.equal(noJson.messages[0].role, 'user');
});

test('ảnh → image_url, PDF đã đọc chữ (text/plain) → đoạn văn bản, PDF thô bị từ chối', () => {
  const text = AI.utf8ToBase64('Nội dung tiếng Việt có dấu: Điều 5');
  const body = plain(AI.toChatRequest(gemini({contents: [{role: 'user', parts: [{text: 'Tệp 1'}, {inlineData: {mimeType: 'image/jpeg', data: 'QUJD'}}, {text: 'Tệp 2'}, {inlineData: {mimeType: 'text/plain', data: text}}]}]})));
  const content = body.messages[1].content;
  assert.deepEqual(content[0], {type: 'text', text: 'Tệp 1'});
  assert.deepEqual(content[1], {type: 'image_url', image_url: {url: 'data:image/jpeg;base64,QUJD'}});
  assert.equal(content[2].type, 'text');
  assert.match(content[2].text, /Tệp 2\n\nNội dung tiếng Việt có dấu: Điều 5/);
  assert.throws(() => AI.toChatRequest(gemini({contents: [{role: 'user', parts: [{inlineData: {mimeType: 'application/pdf', data: 'QUJD'}}]}]})), /không đọc được tệp/);
  assert.throws(() => AI.toChatRequest({system_instruction: {parts: [{text: 'x'}]}, contents: []}), /trống/);
});

test('mọi yêu cầu thật của Công văn AI đều đổi được (phân tích, soạn, chỉnh sửa)', () => {
  const tpl = C.findTemplate('tu_do');
  const analyze = C.buildAnalyzeRequest(tpl, {brief: 'xin bổ sung giấy tờ', current: {}, files: [{name: 'a.jpg', mimeType: 'image/jpeg', data: 'QUJD'}]});
  const compose = C.buildComposeRequest(tpl, {recipient: 'A'}, {signerName: 'B'}, 'xin bổ sung', null, {files: [{name: 'p.pdf', mimeType: 'text/plain', data: AI.utf8ToBase64('chữ')}]});
  for (const request of [analyze, compose]) {
    const body = plain(AI.toChatRequest(request));
    assert.equal(body.messages[0].role, 'system');
    assert.deepEqual(body.response_format, {type: 'json_object'});
    assert.ok(body.messages.at(-1).role === 'user');
  }
  assert.ok(Array.isArray(plain(AI.toChatRequest(analyze)).messages[1].content));
  const revision = R.buildRequest({contents: [{parts: [{text: 'Ngữ cảnh'}]}]}, {paragraphs: [{type: 'p', text: 'Đoạn cần sửa của công văn.'}]}, [{path: 'para:0', start: 0, end: 8, before: 'Đoạn cần sửa của công văn.'}], 'Ngắn hơn');
  assert.deepEqual(plain(AI.toChatRequest(revision)).response_format, {type: 'json_object'});
});

test('đọc phản hồi: lấy nội dung, báo lỗi khi bị cắt/rỗng/bị lọc', () => {
  assert.equal(AI.parseChatResponse({choices: [{message: {content: '{"a":1}'}, finish_reason: 'stop'}]}), '{"a":1}');
  assert.throws(() => AI.parseChatResponse({choices: [{message: {content: '{"a"'}, finish_reason: 'length'}]}), /quá dài/);
  assert.throws(() => AI.parseChatResponse({choices: [{message: {content: '   '}, finish_reason: 'stop'}]}), /không trả về nội dung/);
  assert.throws(() => AI.parseChatResponse({choices: [{message: {content: 'x'}, finish_reason: 'content_filter'}]}), /bộ lọc/);
  assert.throws(() => AI.parseChatResponse({}), /không trả về nội dung/);
});

test('gọi API: gửi đúng URL, khoá Bearer, trả về chuỗi', async () => {
  let seen;
  const text = await AI.call(gemini(), {apiKey: 'sk-test', model: 'deepseek-flash', fetchImpl: async (url, init) => { seen = {url, init}; return ok('{"x":1}'); }});
  assert.equal(text, '{"x":1}');
  assert.equal(seen.url, 'https://api.deepseek.com/chat/completions');
  assert.equal(seen.init.method, 'POST');
  assert.equal(seen.init.headers.Authorization, 'Bearer sk-test');
  assert.equal(JSON.parse(seen.init.body).model, 'deepseek-flash');
  await assert.rejects(() => AI.call(gemini(), {apiKey: '', fetchImpl: async () => ok('x')}), /Chưa có khoá/);
});

test('mã lỗi HTTP được dịch rõ ràng; 429/500/503 đánh dấu retryable', async () => {
  const run = status => AI.call(gemini(), {apiKey: 'k', fetchImpl: async () => fail(status)}).then(() => null, error => error);
  assert.match((await run(401)).message, /không đúng/);
  assert.match((await run(402)).message, /hết số dư/);
  assert.match((await run(422)).message, /từ chối yêu cầu: lỗi/);
  for (const status of [429, 500, 503]) { const error = await run(status); assert.equal(error.retryable, true); }
  for (const status of [401, 402, 422]) assert.ok(!(await run(status)).retryable);
});

test('lỗi mạng báo rõ và cho thử lại; huỷ (AbortError) được giữ nguyên', async () => {
  const net = await AI.call(gemini(), {apiKey: 'k', fetchImpl: async () => { throw new TypeError('Failed to fetch'); }}).catch(error => error);
  assert.match(net.message, /Không kết nối được/); assert.equal(net.retryable, true);
  const abort = await AI.call(gemini(), {apiKey: 'k', fetchImpl: async () => { throw new DOMException('x', 'AbortError'); }}).catch(error => error);
  assert.equal(abort.name, 'AbortError');
});

test('nội dung rỗng (JSON mode) tự thử lại đúng một lần', async () => {
  let calls = 0;
  const text = await AI.call(gemini(), {apiKey: 'k', fetchImpl: async () => ok(++calls === 1 ? '  ' : '{"ok":true}')});
  assert.equal(text, '{"ok":true}'); assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(() => AI.call(gemini(), {apiKey: 'k', fetchImpl: async () => { calls++; return ok(''); }}), /không trả về nội dung/);
  assert.equal(calls, 2);
});

test('base64 ↔ UTF-8 giữ nguyên tiếng Việt', () => {
  const sample = 'Công văn số 12/TASCO — Đắk Lắk ✓';
  assert.equal(AI.base64ToUtf8(AI.utf8ToBase64(sample)), sample);
});

test('số token: đọc usage, cộng dồn nhiều lượt, gọi onUsage kể cả lượt phải thử lại', async () => {
  assert.equal(AI.parseUsage({}), null);
  assert.deepEqual(plain(AI.parseUsage({usage: {prompt_tokens: 1000, completion_tokens: 200, prompt_cache_hit_tokens: 600, prompt_cache_miss_tokens: 400, total_tokens: 1200}})), {prompt: 1000, completion: 200, hit: 600, miss: 400, total: 1200});
  assert.deepEqual(plain(AI.parseUsage({usage: {prompt_tokens: 'x', completion_tokens: -5}})), {prompt: 0, completion: 0, hit: 0, miss: 0, total: 0});
  const sum = [{prompt: 10, completion: 2, hit: 4, miss: 6, total: 12}, {prompt: 30, completion: 5, hit: 0, miss: 30, total: 35}].reduce((acc, u) => AI.addUsage(acc, u), null);
  assert.deepEqual(plain(sum), {calls: 2, prompt: 40, completion: 7, hit: 4, miss: 36, total: 47});
  assert.equal(plain(AI.addUsage(sum, null)).calls, 2);
  assert.equal(AI.formatTokens(850), '850'); assert.match(AI.formatTokens(24100), /^24,1k$/);
  const seen = [];
  let n = 0;
  const reply = {ok: true, status: 200, json: async () => ({choices: [{message: {content: n++ ? '{"x":1}' : '  '}, finish_reason: 'stop'}], usage: {prompt_tokens: 100, completion_tokens: 10, total_tokens: 110}})};
  await AI.call(gemini(), {apiKey: 'k', fetchImpl: async () => reply, onUsage: usage => seen.push(plain(usage).total)});
  assert.deepEqual(seen, [110, 110]);
});
