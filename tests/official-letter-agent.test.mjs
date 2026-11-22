import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL('../js/' + name, import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const turn = () => new Promise(resolve => setTimeout(resolve, 0));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return {promise, resolve, reject}; };
const analysis = '{"fields":{"recipient":"Khách hàng A"},"outline":["Thông báo kết quả"]}';
const draft = '{"subject":"Thông báo kết quả","paragraphs":[{"type":"p","text":"Nội dung công văn mới."}]}';

function setup(reply, options = {}) {
  const host = {querySelector:() => null, querySelectorAll:() => [], removeEventListener() {}};
  const ctx = vm.createContext({setTimeout:options.fastTimers ? fn => setTimeout(fn, 0) : setTimeout, clearTimeout, AbortController, DOMException,
    window:{removeEventListener() {}}, document:{removeEventListener() {}}, localStorage:{getItem:() => null},
    testReply:reply, testHost:host, DeepSeekKeyStore:{get:async () => 'test-key'}, OfficialLetterAI:{DEFAULT_MODEL:'deepseek-flash', call:reply},
    ...(options.legal ? {OfficialLetterLegal:options.legal} : {})});
  const expose = `host=testHost; renderAll=() => {}; updateHistory=() => {};
    ${options.realCall ? '' : 'callAI=testReply;'}
    return {run, compose, leave, restore, snapshot, stepState, stepsHtml, workHtml, refineHtml, startAgent, step, setStatus,
      set:values => Object.assign(st, values), state:() => st};`;
  vm.runInContext(read('data/official-letter-templates.js') + read('features/documents/official-letter-core.js') + read('features/documents/official-letter-revisions.js')
    + read('features/documents/official-letter-page.js').replace('return {mount, leave};', expose) + '\nthis.page=OfficialLetterPage;this.core=OfficialLetterCore;', ctx);
  ctx.page.set({brief:'Thông báo kết quả hồ sơ', templateId:'tu_do'});
  return ctx;
}

test('agent chuyển bước theo kết quả thật của phân tích, thư viện và soạn thảo', async () => {
  const readGate = deferred(), legalGate = deferred(), writeGate = deferred(); let calls = 0;
  const legal = {buildQueries:() => ['quy tắc'], retrieve:() => legalGate.promise, renumber:items => items, promptBlock:() => ''};
  const {page} = setup(() => ++calls === 1 ? readGate.promise : writeGate.promise, {legal});
  const running = page.run(); await turn();
  assert.equal(page.state().steps.read.state, 'run'); assert.equal(page.state().steps.write.state, 'idle');
  assert.match(page.stepsHtml(), /is-running/); assert.match(page.stepsHtml(), /Bước 1\/3/);
  readGate.resolve(analysis); await turn();
  assert.equal(page.state().steps.read.state, 'done'); assert.equal(page.state().steps.legal.state, 'run');
  legalGate.resolve({sources:[], error:''}); await turn();
  assert.equal(page.state().steps.legal.state, 'skip'); assert.equal(page.state().steps.write.state, 'run');
  assert.match(page.stepsHtml(), /Bước 3\/3/);
  writeGate.resolve(draft); await running;
  assert.equal(page.stepState().running, false); assert.equal(page.state().steps.write.state, 'done');
  assert.match(page.stepsHtml(), /is-ready/); assert.match(page.stepsHtml(), /Công văn đã sẵn sàng/);
  assert.match(page.stepsHtml(), /id="ol-agent-details" hidden/);
});

test('tiến trình nằm trong dock chỉnh sửa, không nằm giữa tiêu đề và bản thảo', async () => {
  let calls = 0; const {page} = setup(async () => ++calls === 1 ? analysis : draft);
  await page.run();
  const html = page.workHtml(), dock = html.indexOf('class="ola-refine');
  assert.equal((html.match(/data-ol-steps/g) || []).length, 1);
  assert.ok(html.indexOf('data-ol-steps') > dock);
  assert.doesNotMatch(html, /ola-progress|ola-track|olp-busy|--p:/);
});

test('sửa đoạn khởi tạo tác vụ mới và chỉ báo chờ duyệt sau khi nhận đề xuất', async () => {
  const gate = deferred(); const {page, core} = setup(() => gate.promise);
  const letter = core.assembleLetter(core.findTemplate('tu_do'), {recipient:'A'}, {}, JSON.parse(draft));
  page.set({letter:plain(letter), values:{recipient:'A'}, steps:{read:{state:'done'}, legal:{state:'done'}, write:{state:'done'}}});
  const running = page.compose('Viết ngắn hơn'); await turn();
  assert.equal(page.state().agentTask, 'refine'); assert.equal(page.state().steps.write.state, 'run');
  assert.match(page.stepsHtml(), /Chỉnh sửa công văn/); assert.equal(page.state().pending, null);
  gate.resolve('{"subject":"Thông báo kết quả","paragraphs":[{"type":"p","text":"Nội dung rút gọn."}]}'); await running;
  assert.ok(page.state().pending); assert.match(page.stepsHtml(), /is-review/);
  assert.match(page.stepsHtml(), /đang chờ bạn duyệt/); assert.deepEqual(plain(page.state().letter), plain(letter));
  assert.match(page.refineHtml(), /data-ol-act="review"/);
});

test('lỗi xử lý không biến thành hoàn tất; lần thử tiếp theo bỏ trạng thái lỗi cũ', async () => {
  let broken = true;
  const {page, core} = setup(async () => { if (broken) throw Error('Mất mạng'); return draft; });
  page.set({letter:plain(core.assembleLetter(core.findTemplate('tu_do'), {recipient:'A'}, {}, JSON.parse(draft))), values:{recipient:'A'}});
  await page.compose('Sửa');
  assert.equal(page.state().steps.write.state, 'err'); assert.match(page.stepsHtml(), /is-error/);
  assert.doesNotMatch(page.stepsHtml(), /Công văn đã sẵn sàng/);
  broken = false; await page.compose('Sửa lại');
  assert.equal(page.state().notice, null); assert.equal(page.state().steps.write.state, 'done');
  assert.doesNotMatch(page.stepsHtml(), /is-error/);
});

test('mở lịch sử có bước đang chạy không khởi động animation hoặc báo đã xong', () => {
  const {page} = setup(async () => draft);
  page.restore({steps:{read:{state:'done'}, legal:{state:'skip'}, write:{state:'run', text:'Đang viết'}}});
  assert.match(page.stepsHtml(), /is-paused/); assert.doesNotMatch(page.stepsHtml(), /is-running|olp-spinner/);
  assert.match(page.stepsHtml(), /Phiên xử lý trước đã dừng/);
});

test('mô tả tiến trình được escape và có thể mở chi tiết khi đang xử lý', () => {
  const {page} = setup(async () => draft);
  page.startAgent('refine', '<img onerror="x">'); page.set({busy:'run', status:'<script>x</script>', agentOpen:true});
  const html = page.stepsHtml();
  assert.doesNotMatch(html, /<script>|<img/); assert.match(html, /&lt;script/);
  assert.match(html, /aria-expanded="true"/); assert.match(html, /aria-current="step"/);
  assert.doesNotMatch(html, /id="ol-agent-details" hidden/);
});

test('sau đếm ngược thử lại, tiêu đề trở về tác vụ đang chạy', async () => {
  let calls = 0, page;
  ({page} = setup(async () => {
    calls++;
    if (calls === 1) throw Object.assign(Error('429'), {retryable:true});
    assert.doesNotMatch(page.state().status, /tự thử lại/);
    return calls === 2 ? analysis : draft;
  }, {realCall:true, fastTimers:true}));
  await page.run(); assert.equal(calls, 3); assert.equal(page.state().steps.write.state, 'done');
});

test('rời trang trong khi chờ AI không áp dụng phản hồi muộn', async () => {
  const gate = deferred(); const {page} = setup(() => gate.promise);
  const running = page.run(); await turn(); page.leave(); gate.resolve(analysis); await running;
  assert.equal(page.state().letter, null); assert.equal(page.stepState().running, false);
});
