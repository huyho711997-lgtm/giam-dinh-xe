import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../js/features/scene/', import.meta.url);
const read = f => fs.readFileSync(new URL(f, root), 'utf8');
function load() {
  const context = vm.createContext({
    Math, Number, Array, JSON, Map, String, Object, console, Date,
    document: { getElementById: () => null }, window: {},
    sceneShapes: [], sceneTemplateMeta: null, SCENE_LOGICAL_WIDTH: 1000, SCENE_LOGICAL_HEIGHT: 700,
    genShapeId: (() => { let n = 0; return () => ++n; })()
  });
  for (const f of ['geometry', 'objects', 'traffic-signs', 'rendering', 'interaction-export', 'terrain-assets', 'goods-assets', 'debris-assets']) vm.runInContext(read(f + '.js'), context);
  const log = [];
  context.ctx = new Proxy({ measureText: t => ({ width: String(t).length * 6 }) }, {
    get(t, p) { return p in t ? t[p] : (...a) => { log.push([p, ...a]); }; },
    set(t, p, v) { t[p] = v; return true; }
  });
  return { log, run: code => vm.runInContext(code, context) };
}
const shape = (extra = {}) => JSON.stringify({ id: 'd1', type: 'parts_debris', startX: 10, startY: 10, angle: 0, objectW: 220, objectH: 100, color: '#000000', width: 1.5, sizeScale: 1, ...extra });
const draw = (run, extra = {}, w = 220, h = 100) => run(`drawSceneryAsset(ctx, 'parts_debris', ${w / 2}, ${h / 2}, '#000', 1.5, ${w}, ${h}, ${shape({ objectW: w, objectH: h, ...extra })})`);

test('đăng ký công cụ Mảnh vỡ phụ tùng', () => {
  const { run } = load();
  assert.equal(run("isSceneryAssetType('parts_debris')"), true);
  assert.equal(run("isSceneDebrisType('parts_debris')"), true);
  assert.equal(run("isSceneDebrisType('house')"), false);
  assert.ok(run("getSceneryMinimumLength('parts_debris')") >= 50);
  assert.equal(run("getShapeDisplayName({ type: 'parts_debris' })"), 'Mảnh vỡ phụ tùng');
  const runtime = read('runtime.js');
  assert.match(runtime, /id: 'parts_debris', name: 'Mảnh vỡ phụ tùng'/);
  assert.match(runtime, /\n  parts_debris: '<svg/);
  assert.match(read('scene-editor-ui.js'), /'goods_damaged', 'parts_debris'\]/);
  for (const page of ['../index.html', '../so-do-hien-truong.html']) {
    assert.match(fs.readFileSync(new URL(page, import.meta.url), 'utf8'), /scene\/debris-assets\.js\?v=/, page);
  }
});

test('công cụ nằm trong nhóm Dấu vết & vật chứng', () => {
  const runtime = read('runtime.js');
  const group = runtime.slice(runtime.indexOf("  evidence: {"), runtime.indexOf("  evidence: {") + 900);
  assert.match(group, /parts_debris/);
});

test('vẽ nhiều mảnh, kéo rộng thì thêm mảnh, không dùng gạch chéo/hàng hóa', () => {
  const small = load();
  draw(small.run);
  const pieces = small.log.filter(c => c[0] === 'translate').length;
  assert.ok(pieces >= 8, `chỉ có ${pieces} mảnh`);
  assert.ok(small.log.some(c => c[0] === 'setLineDash'), 'viền nét đứt');
  assert.ok(!small.log.some(c => c[0] === 'clip'));
  const big = load();
  draw(big.run, {}, 440, 100);
  assert.ok(big.log.filter(c => c[0] === 'translate').length > pieces);
});

test('vị trí mảnh cố định theo id (vẽ lại giống hệt), khác id thì khác', () => {
  const a = load(); draw(a.run); const b = load(); draw(b.run);
  assert.deepEqual(JSON.stringify(a.log), JSON.stringify(b.log));
  const c = load(); draw(c.run, { id: 'd2' });
  assert.notEqual(JSON.stringify(a.log), JSON.stringify(c.log));
});

test('đủ các loại mảnh và vùng nhỏ vẫn có mảnh', () => {
  const { run } = load();
  const kinds = new Set();
  for (let i = 0; i < 400; i++) kinds.add(run(`pickSceneDebrisKind(${(i + 0.5) / 400})`));
  assert.deepEqual([...kinds].sort(), [0, 1, 2, 3, 4]);
  for (const [w, h] of [[60, 36], [70, 70], [110, 30]]) {
    const t = load(); draw(t.run, {}, w, h);
    assert.ok(t.log.filter(c => c[0] === 'translate').length >= 2, `${w}x${h}`);
  }
});

test('ranh giới tự vẽ không ném lỗi; nhãn tự đặt được giữ, mặc định không có nhãn', () => {
  const { run, log } = load();
  const outline = [[0.05, 0.5], [0.4, 0.05], [0.95, 0.3], [0.8, 0.95], [0.2, 0.9]].map(([x, y]) => ({ x, y }));
  draw(run, { areaShape: 'custom', areaOutline: outline });
  assert.ok(!log.some(c => c[0] === 'fillText'), 'mặc định không vẽ chữ');
  const named = load();
  draw(named.run, { areaLabel: 'MẢNH CẢN' });
  assert.ok(named.log.some(c => c[0] === 'fillText' && /MẢNH CẢN/.test(c[1])));
});
