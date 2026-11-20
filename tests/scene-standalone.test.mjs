import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { syncScenePage, extractSceneBlock, localAssetRefs } from '../scripts/sync-scene-page.mjs';

const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const indexHtml = read('index.html'), pageHtml = read('so-do-hien-truong.html');

test('trang vẽ độc lập dùng đúng khối trình vẽ của index.html (không lệch giao diện)', () => {
  assert.equal(syncScenePage(indexHtml, pageHtml), pageHtml, 'Chạy: npm run sync:scene-page');
  assert.ok(extractSceneBlock(pageHtml, 'page').text.includes('id="sceneDrawingCanvas"'));
});

test('trang vẽ độc lập nạp đủ module vẽ, cùng thứ tự và cùng ?v= với index.html', () => {
  const scripts = html => [...html.matchAll(/<script src="(js\/features\/(?:scene\/|admin\/select-controls)[^"]+)"/g)].map(m => m[1]);
  const fromIndex = scripts(indexHtml), fromPage = scripts(pageHtml).filter(s => !s.startsWith('js/features/scene/standalone.js'));
  assert.deepEqual(fromPage.slice(0, fromIndex.length), fromIndex.slice(0, fromPage.length));
  assert.deepEqual([...fromPage].sort(), [...fromIndex].sort());
  // Bộ chuyển đổi phải nạp SAU CÙNG để ghi đè hàm gắn với hồ sơ.
  assert.match(scripts(pageHtml).at(-1), /scene\/standalone\.js/);
  const refs = localAssetRefs(indexHtml);
  for (const m of pageHtml.matchAll(/\b(?:src|href)="([^"]+\?v=[^"]+)"/g)) {
    const known = refs.get(m[1].split('?')[0]);
    if (known) assert.equal(m[1], known);
  }
});

test('trang vẽ độc lập không kéo theo Firebase/đăng nhập', () => {
  assert.ok(!/firebase/i.test(pageHtml.replace(/<!-- SCENE-EDITOR:BEGIN[\s\S]*SCENE-EDITOR:END -->/, '')));
});

test('menu bên của app có lối vào trang vẽ độc lập (mở thẻ mới)', () => {
  const nav = read('js/core/navigation.js');
  assert.match(nav, /tab: 'scene_standalone'[^}]*href: 'so-do-hien-truong\.html'/);
  assert.match(nav, /window\.open\('\$\{item\.href\}','_blank','noopener'\)/);
});

// ---- Bộ chuyển đổi ----
// Dựng môi trường giả: bắt handler DOMContentLoaded để chạy start() thật, hàng đợi timer để tự tay "chạy" các setTimeout.
function load(seed = {}) {
  const store = new Map(Object.entries(seed)), timers = [], calls = { apply: [] };
  let ready = null, failWrites = false;
  const context = vm.createContext({
    JSON, Math, Number, Object, Array, String, Date, Promise, Error, URL, Blob: class {}, FileReader: class {}, console,
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => { if (failWrites) throw new Error('QuotaExceededError'); store.set(k, v); } },
    document: {
      readyState: 'loading', addEventListener: (type, fn) => { if (type === 'DOMContentLoaded') ready = fn; },
      getElementById: () => null, querySelector: () => null, createElement: () => ({ style: {}, appendChild() {}, addEventListener() {} }),
      body: { appendChild() {}, classList: { add() {} } }, hidden: false
    },
    addEventListener() {},
    sceneShapes: [], sceneTemplateMeta: null,
    cloneSceneDiagramShapes: s => JSON.parse(JSON.stringify(s)), cloneSceneTemplateMeta: m => ({ ...m }), ensureSceneTemplateMeta: () => ({ reportDate: '01/01/2026' }),
    applySceneDiagramStoredData: record => calls.apply.push(record), openSceneDrawingModal() { calls.opened = true; }
  });
  context.window = context;
  vm.runInContext(read('js/features/scene/standalone.js') + '\nthis.__api = SceneStandalone;', context);
  const boot = () => { ready(); while (timers.length) timers.shift()(); };
  return { api: context.__api, store, context, calls, boot, failWrites: v => { failWrites = v; } };
}
const fileOf = obj => JSON.stringify({ format: 'tasco-scene-diagram', version: 1, ...obj });

test('đọc file: nhận sơ đồ hợp lệ, lọc phần tử rác', () => {
  const { api } = load();
  const out = api.parseFile(fileOf({ shapes: [{ type: 'car', x: 1 }, null, 5, 'x', [], { noType: 1 }, { type: 'line' }], templateMeta: { reportPlace: 'BMT' } }));
  assert.deepEqual(out.shapes.map(s => s.type), ['car', 'line']);
  assert.equal(out.templateMeta.reportPlace, 'BMT');
});

test('đọc file: từ chối JSON hỏng, sai định dạng, phiên bản mới hơn, quá nhiều đối tượng', () => {
  const { api } = load();
  assert.throws(() => api.parseFile('{không phải json'), /JSON/);
  assert.throws(() => api.parseFile(JSON.stringify({ hello: 1 })), /không phải sơ đồ/);
  assert.throws(() => api.parseFile(JSON.stringify({ format: 'khac', version: 1, shapes: [] })), /không phải sơ đồ/);
  assert.throws(() => api.parseFile(fileOf({ version: 99, shapes: [] })), /phiên bản mới/);
  assert.throws(() => api.parseFile(fileOf({ shapes: 'abc' })), /không chứa dữ liệu/);
  assert.throws(() => api.parseFile(fileOf({ shapes: Array.from({ length: 5001 }, () => ({ type: 'car' })) })), /quá nhiều/);
});

test('tự lưu nháp: chưa khởi động thì không ghi; sau đó chỉ ghi khi có thay đổi', () => {
  const t = load();
  assert.equal(t.api.writeDraft(false), false);
  assert.equal(t.store.size, 0);
  t.boot();
  assert.equal(t.calls.opened, true, 'trang tự mở trình vẽ');
  assert.equal(t.api.writeDraft(false), false, 'chưa vẽ gì → không ghi nháp rỗng đè lên nháp cũ');
  t.context.sceneShapes.push({ type: 'car', x: 10 });
  assert.equal(t.api.writeDraft(false), true);
  const saved = JSON.parse(t.store.get(t.api.DRAFT_KEY));
  assert.equal(saved.shapes.length, 1);
  assert.equal(saved.version, 1);
  assert.equal(t.api.writeDraft(false), false, 'dữ liệu y nguyên → không ghi lại');
});

test('tự lưu nháp: tải lại trang khôi phục đúng sơ đồ đã vẽ, bỏ qua nháp hỏng', () => {
  const draft = JSON.stringify({ version: 1, updatedAt: 1, shapes: [{ type: 'car' }, { type: 'line' }], templateMeta: { reportPlace: 'Đắk Lắk' } });
  const t = load({ 'sceneStandalone.v1': draft });
  t.boot();
  assert.equal(t.calls.apply.length, 1);
  assert.equal(JSON.parse(t.calls.apply[0].shapes).length, 2);
  assert.equal(JSON.parse(t.calls.apply[0].templateMeta).reportPlace, 'Đắk Lắk');
  const broken = load({ 'sceneStandalone.v1': '{hỏng' });
  broken.boot();
  assert.equal(broken.calls.apply.length, 0);
  assert.equal(broken.calls.opened, true, 'nháp hỏng không làm trang treo');
});

test('tự lưu nháp: bộ nhớ đầy thì báo lỗi nhẹ, không ném ngoại lệ', () => {
  const t = load();
  t.boot();
  t.failWrites(true);
  t.context.sceneShapes.push({ type: 'car' });
  assert.equal(t.api.writeDraft(false), false);
});

test('trang độc lập ghi đè hàm gắn với hồ sơ (lưu theo HSBT, đóng modal) và hàm tự lưu theo hồ sơ', () => {
  const t = load();
  t.boot();
  for (const name of ['saveSceneDrawing', 'closeSceneDrawingModal', 'scheduleSceneDocumentAutoSave', 'triggerToast', 'showToast']) assert.equal(typeof t.context[name], 'function', name);
});
