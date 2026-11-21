import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const plain = x => JSON.parse(JSON.stringify(x));
class FakeURL extends URL { static createObjectURL() { return 'blob:fake'; } static revokeObjectURL() {} }

const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const CFG = { CLOUDINARY_CLOUD_NAME: 'democloud', CLOUDINARY_UPLOAD_PRESET: 'preset_x', CLOUDINARY_FOLDER: 'giam_dinh_xe' };
const GOOD_URL = 'https://res.cloudinary.com/democloud/raw/upload/v1730000000/giam_dinh_xe/scene_diagrams/abc_123.json';
const GOOD_REF = 'v1730000000/giam_dinh_xe/scene_diagrams/abc_123.json';

// Môi trường giả: localStorage, fetch có thể điều khiển, DOM tối thiểu; nạp scene-cloud.js (+ standalone.js nếu cần).
function load({ seed = {}, withStandalone = false, fetchImpl, search = '' } = {}) {
  const store = new Map(Object.entries(seed)), timers = [], fetches = [], clicks = [], calls = { apply: [] }, toasts = [];
  let ready = null;
  const context = vm.createContext({
    JSON, Math, Number, Object, Array, String, Date, Promise, Error, URL: FakeURL, URLSearchParams, console, CONFIG: { ...CFG },
    Blob: class { constructor(parts) { this.size = parts.join('').length; } },
    FormData: class { constructor() { this.f = {}; } append(k, v, n) { this.f[k] = v; if (n) this.name = n; } },
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => { store.set(k, String(v)); }, removeItem: k => { store.delete(k); } },
    fetch: async (url, init) => { fetches.push({ url, init }); return fetchImpl(url, init); },
    navigator: { clipboard: { writeText: async t => { context.__copied = t; } } },
    location: { href: 'https://app.test/so-do-hien-truong.html' + search, search },
    history: { replaceState: (_s, _t, url) => { context.__url = url; } },
    document: {
      readyState: 'loading', addEventListener: (type, fn) => { if (type === 'DOMContentLoaded') ready = fn; }, removeEventListener() {},
      getElementById: () => null, querySelector: () => null, hidden: false,
      createElement: () => ({ style: {}, children: [], appendChild(c) { this.children.push(c); }, addEventListener() {}, setAttribute() {}, click() { clicks.push(1); }, remove() {} }),
      createTextNode: t => ({ t }), body: { appendChild() {}, classList: { add() {} } }
    },
    addEventListener() {},
    sceneShapes: [], sceneTemplateMeta: null,
    cloneSceneDiagramShapes: s => JSON.parse(JSON.stringify(s)), cloneSceneTemplateMeta: m => ({ ...m }), ensureSceneTemplateMeta: () => ({ reportDate: '01/01/2026' }),
    applySceneDiagramStoredData: record => calls.apply.push(record), openSceneDrawingModal() {},
    setActiveDrawTool() {}, redrawSceneCanvas() {}, resetSceneZoom() {}, updateUndoRedoButtonsState() {}, initSceneDrawing() {}
  });
  context.window = context;
  vm.runInContext(read('js/features/scene-cloud/scene-cloud.js') + '\nthis.__cloud = SceneCloud;', context);
  if (withStandalone) vm.runInContext(read('js/features/scene/standalone.js') + '\nthis.__api = SceneStandalone;', context);
  const boot = () => { ready(); while (timers.length) timers.shift()(); };
  const original = context.window.triggerToast;
  return { cloud: context.__cloud, api: context.__api, store, context, calls, fetches, clicks, boot, toasts, original };
}
const ok = body => ({ ok: true, status: 200, json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)), headers: { get: () => null } });
const fail = (status, body) => ({ ok: false, status, json: async () => body, text: async () => '', headers: { get: () => null } });

test('ref: chỉ nhận đường dẫn trong thư mục scene_diagrams, không có "..", không ký tự lạ', () => {
  const { cloud } = load();
  assert.equal(cloud.isValidRef(GOOD_REF), true);
  assert.equal(cloud.isValidRef('giam_dinh_xe/scene_diagrams/abc'), true);
  for (const bad of ['', 'v1/giam_dinh_xe/other/abc.json', 'v1/giam_dinh_xe/scene_diagrams/../../x', 'http://evil.test/x', 'a b/scene_diagrams/c', '/scene_diagrams/x', 'scene_diagrams', 'v1/x/scene_diagrams/<img>', null, 42])
    assert.equal(cloud.isValidRef(bad), false, String(bad));
});

test('URL <-> ref: chỉ chấp nhận https://res.cloudinary.com/<cloud cấu hình>/raw/upload/...', () => {
  const { cloud } = load();
  assert.equal(cloud.refFromUrl(GOOD_URL, 'democloud'), GOOD_REF);
  assert.equal(cloud.refFromUrl(GOOD_URL, 'khac'), '', 'sai cloud');
  assert.equal(cloud.refFromUrl(GOOD_URL.replace('https', 'http'), 'democloud'), '');
  assert.equal(cloud.refFromUrl(GOOD_URL.replace('res.cloudinary.com', 'evil.test'), 'democloud'), '');
  assert.equal(cloud.refFromUrl(GOOD_URL.replace('/raw/upload/', '/image/upload/'), 'democloud'), '');
  assert.equal(cloud.refFromUrl('https://res.cloudinary.com/democloud/raw/upload/v1/giam_dinh_xe/forms/x.docx', 'democloud'), '', 'ngoài thư mục sơ đồ');
  assert.equal(cloud.urlFromRef(GOOD_REF, 'democloud'), GOOD_URL);
});

test('liên kết chia sẻ: dựng từ trang, nhận lại từ liên kết đầy đủ / ?cloud= / ref trần', () => {
  const { cloud } = load();
  const link = cloud.shareLink('https://app.test/so-do-hien-truong.html?cloud=cu&x=1#h', GOOD_REF);
  assert.equal(link, 'https://app.test/so-do-hien-truong.html?cloud=' + encodeURIComponent(GOOD_REF));
  assert.equal(cloud.refFromInput(link), GOOD_REF);
  assert.equal(cloud.refFromInput('?cloud=' + encodeURIComponent(GOOD_REF)), GOOD_REF);
  assert.equal(cloud.refFromInput('  ' + GOOD_REF + '  '), GOOD_REF);
  assert.equal(cloud.refFromInput(GOOD_URL), GOOD_REF, 'dán thẳng URL Cloudinary');
  // ref trong liên kết của trang khác vẫn chỉ được tải từ cloud đã cấu hình (URL luôn do urlFromRef dựng), nên vô hại.
  assert.equal(cloud.refFromInput('https://khac.test/x.html?cloud=v1/a/scene_diagrams/x'), 'v1/a/scene_diagrams/x');
  for (const bad of ['', 'xin chào', 'https://evil.test/file.json', '?cloud=../../etc/passwd', '?cloud=%E0%A4%A']) assert.equal(cloud.refFromInput(bad), '', bad);
});

test('danh sách đã lưu: thêm đầu danh sách, thay bản cũ, đổi tên, gỡ, giới hạn 50, bỏ mục hỏng', () => {
  const { cloud, store } = load();
  cloud.remember({ ref: GOOD_REF, name: 'A', savedAt: 1, shapes: 3, bytes: 10 }, '');
  const ref2 = 'v2/giam_dinh_xe/scene_diagrams/b.json';
  cloud.remember({ ref: ref2, name: 'A', savedAt: 2, shapes: 4, bytes: 12 }, GOOD_REF);
  assert.deepEqual(plain(cloud.readIndex().map(i => i.ref)), [ref2], 'bản mới thay bản cũ của cùng sơ đồ');
  cloud.rename(ref2, '  Sơ đồ Buôn Ma Thuột  ');
  assert.equal(cloud.readIndex()[0].name, 'Sơ đồ Buôn Ma Thuột');
  cloud.rename(ref2, '   ');
  assert.equal(cloud.readIndex()[0].name, 'Sơ đồ Buôn Ma Thuột', 'tên rỗng bị bỏ qua');
  for (let i = 0; i < 60; i++) cloud.remember({ ref: `v${i}/giam_dinh_xe/scene_diagrams/n${i}.json`, name: 'n' + i, savedAt: i, shapes: 1, bytes: 1 }, '');
  assert.equal(cloud.readIndex().length, 50);
  assert.equal(cloud.forget('v59/giam_dinh_xe/scene_diagrams/n59.json').length, 49);
  store.set(cloud.INDEX_KEY, JSON.stringify([{ ref: 'bậy' }, null, { ref: GOOD_REF, name: 'ok' }]));
  assert.deepEqual(plain(cloud.readIndex().map(i => i.ref)), [GOOD_REF]);
  store.set(cloud.INDEX_KEY, '{hỏng');
  assert.deepEqual(plain(cloud.readIndex()), []);
});

test('upload: gửi raw/upload với preset + thư mục scene_diagrams, trả ref; lỗi được dịch ra tiếng Việt', async () => {
  const t = load({ fetchImpl: async () => ok({ secure_url: GOOD_URL }) });
  const out = await t.cloud.upload('{"a":1}', 'so-do');
  assert.equal(out.ref, GOOD_REF);
  assert.match(t.fetches[0].url, /^https:\/\/api\.cloudinary\.com\/v1_1\/democloud\/raw\/upload$/);
  assert.equal(t.fetches[0].init.body.f.upload_preset, 'preset_x');
  assert.equal(t.fetches[0].init.body.f.folder, 'giam_dinh_xe/scene_diagrams');
  assert.equal(t.fetches[0].init.body.name, 'so-do.json');
  await assert.rejects(load({ fetchImpl: async () => fail(400, { error: { message: 'Upload preset not found' } }) }).cloud.upload('{}', 'x'), /Upload preset not found/);
  await assert.rejects(load({ fetchImpl: async () => { throw new Error('net'); } }).cloud.upload('{}', 'x'), /Mất kết nối/);
  await assert.rejects(load({ fetchImpl: async () => ok({ secure_url: 'https://res.cloudinary.com/democloud/raw/upload/v1/giam_dinh_xe/khac/x.json' }) }).cloud.upload('{}', 'x'), /scene_diagrams/);
  const big = load({ fetchImpl: async () => ok({}) });
  await assert.rejects(big.cloud.upload('x'.repeat(9 * 1024 * 1024), 'x'), /8 MB/);
  assert.equal(big.fetches.length, 0, 'quá lớn thì không gửi');
});

test('upload: chưa cấu hình Cloudinary thì báo rõ, không gọi mạng', async () => {
  const t = load({ fetchImpl: async () => ok({}) });
  t.context.CONFIG = {};
  assert.equal(t.cloud.configured(), false);
  await assert.rejects(t.cloud.upload('{}', 'x'), /Chưa cấu hình Cloudinary/);
  assert.equal(t.fetches.length, 0);
});

test('download: chỉ tải đường dẫn hợp lệ từ cloud đã cấu hình; 404/lỗi có thông báo riêng', async () => {
  const t = load({ fetchImpl: async () => ok('{"format":"x"}') });
  assert.equal(await t.cloud.download(GOOD_REF), '{"format":"x"}');
  assert.equal(t.fetches[0].url, GOOD_URL);
  await assert.rejects(t.cloud.download('http://evil.test/x'), /không hợp lệ/);
  assert.equal(t.fetches.length, 1, 'ref sai thì không gọi mạng');
  await assert.rejects(load({ fetchImpl: async () => fail(404) }).cloud.download(GOOD_REF), /Không tìm thấy/);
  await assert.rejects(load({ fetchImpl: async () => fail(500) }).cloud.download(GOOD_REF), /lỗi 500/);
});

test('Lưu (saveCloud): tải lên, ghi danh sách + gắn liên kết vào địa chỉ trang, chép liên kết', async () => {
  const t = load({ withStandalone: true, fetchImpl: async () => ok({ secure_url: GOOD_URL }) });
  t.boot();
  t.context.sceneShapes.push({ type: 'car' }, { type: 'line' });
  assert.equal(await t.api.saveCloud(), true);
  const sent = t.fetches[0].init.body.f.file;
  assert.ok(sent.size > 0);
  const index = t.cloud.readIndex();
  assert.equal(index.length, 1); assert.equal(index[0].ref, GOOD_REF); assert.equal(index[0].shapes, 2);
  assert.equal(t.store.get('sceneStandalone.cloudRef.v1'), GOOD_REF);
  assert.equal(t.context.__url, 'https://app.test/so-do-hien-truong.html?cloud=' + encodeURIComponent(GOOD_REF));
  assert.equal(t.context.__copied, t.context.__url);
  // Lưu lần nữa → bản mới thay bản cũ trong danh sách
  t.fetches.length = 0;
  t.context.fetch = async () => ok({ secure_url: GOOD_URL.replace('abc_123', 'def_456') });
  await t.api.saveCloud();
  assert.deepEqual(plain(t.cloud.readIndex().map(i => i.ref)), ['v1730000000/giam_dinh_xe/scene_diagrams/def_456.json']);
});

test('Lưu (saveCloud): lỗi đám mây → tự tải file .json về máy, không mất dữ liệu', async () => {
  const t = load({ withStandalone: true, fetchImpl: async () => fail(400, { error: { message: 'Upload preset not found' } }) });
  t.boot();
  t.context.sceneShapes.push({ type: 'car' });
  assert.equal(await t.api.saveCloud(), false);
  assert.equal(t.clicks.length, 1, 'đã kích hoạt tải file dự phòng');
  assert.equal(t.cloud.readIndex().length, 0);
  assert.equal(t.store.has('sceneStandalone.cloudRef.v1'), false);
});

test('Mở liên kết ?cloud=: tải & áp sơ đồ; nháp đang gắn đúng liên kết đó thì giữ nháp, không tải lại', async () => {
  const file = JSON.stringify({ format: 'tasco-scene-diagram', version: 1, name: 'Sơ đồ ngã tư', shapes: [{ type: 'car' }, { type: 'line' }], templateMeta: null });
  const link = '?cloud=' + encodeURIComponent(GOOD_REF);
  const t = load({ withStandalone: true, search: link, fetchImpl: async () => ok(file) });
  t.boot();
  await new Promise(r => setImmediate(r));
  assert.equal(t.fetches.length, 1);
  assert.equal(t.fetches[0].url, GOOD_URL);
  assert.equal(JSON.parse(t.calls.apply.at(-1).shapes).length, 2);
  assert.equal(t.cloud.readIndex()[0].name, 'Sơ đồ ngã tư');
  const draft = JSON.stringify({ version: 1, updatedAt: 1, shapes: [{ type: 'car' }], templateMeta: null });
  const same = load({ withStandalone: true, search: link, seed: { 'sceneStandalone.v1': draft, 'sceneStandalone.cloudRef.v1': GOOD_REF }, fetchImpl: async () => ok(file) });
  same.boot();
  await new Promise(r => setImmediate(r));
  assert.equal(same.fetches.length, 0);
});

test('Mở liên kết: ref lạ trong ?cloud= bị bỏ qua, không gọi mạng', async () => {
  const t = load({ withStandalone: true, search: '?cloud=' + encodeURIComponent('../../etc/passwd'), fetchImpl: async () => ok('x') });
  t.boot();
  await new Promise(r => setImmediate(r));
  assert.equal(t.fetches.length, 0);
});

test('trang độc lập nạp config.js + scene-cloud.js trước standalone.js; nút Lưu & Mở sơ đồ được nối', () => {
  const page = read('so-do-hien-truong.html');
  const order = ['js/config.js', 'js/features/scene-cloud/scene-cloud.js', 'js/features/scene/standalone.js'].map(s => page.indexOf('<script src="' + s));
  assert.ok(order.every(i => i > 0) && order[0] < order[1] && order[1] < order[2]);
  assert.match(page, /css\/scene-cloud\.css/);
  const ui = read('js/features/scene/standalone.js');
  assert.match(ui, /window\.saveSceneDrawing = async \(\) => saveCloud\(\)/);
  assert.match(ui, /btnSceneOpenFile', 'Mở sơ đồ'/);
});
