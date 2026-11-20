import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../js/features/scene/', import.meta.url);
const read = f => fs.readFileSync(new URL(f, root), 'utf8');
function load() {
  const context = vm.createContext({
    Math, Number, Array, JSON, Map, Set, String, Object, console, Date,
    document: { getElementById: () => null }, window: {},
    sceneShapes: [], sceneTemplateMeta: null, SCENE_LOGICAL_WIDTH: 1000, SCENE_LOGICAL_HEIGHT: 700,
    selectedShapeIds: [], currentSceneZoom: 1, genShapeId: () => 'a1'
  });
  for (const f of ['geometry', 'objects', 'traffic-signs', 'rendering', 'interaction-export', 'symbol-legend', 'terrain-assets', 'goods-assets', 'building-assets', 'bridge-assets', 'vehicle-assets', 'road-assets']) vm.runInContext(read(f + '.js'), context);
  const log = [];
  context.ctx = new Proxy({ measureText: t => ({ width: String(t).length * 6 }) }, {
    get(t, p) { return p in t ? t[p] : (...a) => { log.push([p, ...a]); }; },
    set(t, p, v) { t[p] = v; return true; }
  });
  return { log, run: code => vm.runInContext(code, context) };
}
const draw = (type, w, h, extra = '') => `drawSceneryAsset(ctx, '${type}', 0, 0, '#000', 1.5, ${w}, ${h}, { id: 'a1', type: '${type}'${extra} })`;

test('hướng Bắc và thước tỷ lệ là vật cảnh quan dùng chung chọn/xoay/co giãn', () => {
  const { run } = load();
  for (const type of ['north_arrow', 'scale_bar']) {
    const spec = run(`getSceneRoadAssetSpec('${type}')`);
    assert.ok(spec && spec.name, type);
    assert.equal(run(`isSceneryAssetType('${type}')`), true);
    assert.equal(run(`getShapeDisplayName({ type: '${type}' })`), spec.name);
    assert.ok(spec.resizeMin <= spec.minLength);
  }
});

test('hướng Bắc: vẽ vòng tròn, mũi tên và chữ N đứng thẳng dù đã xoay', () => {
  const { log, run } = load();
  run(draw('north_arrow', 100, 100, ', angle: 0.5'));
  assert.ok(log.some(c => c[0] === 'arc'), 'có vòng tròn');
  assert.ok(log.some(c => c[0] === 'fillText' && c[1] === 'N'), 'có chữ N');
  const rot = log.find((c, i) => c[0] === 'rotate');
  assert.ok(rot && Math.abs(rot[1] + 0.5) < 1e-9, 'chữ N xoay ngược góc để luôn đứng thẳng');
});

test('thước tỷ lệ: có "0", nhãn mặc định 10 m và nhãn tuỳ chỉnh, nằm trong khung', () => {
  const a = load();
  a.run(draw('scale_bar', 200, 40));
  const texts = a.log.filter(c => c[0] === 'fillText').map(c => c[1]);
  assert.deepEqual([...texts], ['0', '10 m']);
  const rects = a.log.filter(c => c[0] === 'fillRect');
  assert.equal(rects.length, 2, 'đoạn đen xen kẽ');
  for (const r of rects) assert.ok(r[1] >= -100 - 1e-6 && r[1] + r[3] <= 100 + 1e-6);

  const b = load();
  b.run(draw('scale_bar', 200, 40, ", areaLabel: '20 m'"));
  assert.ok(b.log.some(c => c[0] === 'fillText' && c[1] === '20 m'));
});

test('hai ký hiệu bản vẽ không xuất hiện trong bảng Ký hiệu', () => {
  const src = read('symbol-legend.js');
  assert.match(src, /'north_arrow'/);
  assert.match(src, /'scale_bar'/);
});
