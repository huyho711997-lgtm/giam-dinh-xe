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
    selectedShapeIds: [], currentSceneZoom: 1, genShapeId: () => 'h1'
  });
  for (const f of ['geometry', 'objects', 'traffic-signs', 'rendering', 'interaction-export', 'terrain-assets', 'goods-assets', 'building-assets']) vm.runInContext(read(f + '.js'), context);
  const log = [];
  context.ctx = new Proxy({ measureText: t => ({ width: String(t).length * 6 }) }, {
    get(t, p) { return p in t ? t[p] : (...a) => { log.push([p, ...a]); }; },
    set(t, p, v) { t[p] = v; return true; }
  });
  return { log, run: code => vm.runInContext(code, context) };
}

test('nóc mái theo chiều dài; nhà vuông thành mái chóp', () => {
  const { run } = load();
  const r = run('getSceneHouseRidge(200, 100)');
  assert.deepEqual([r.a.x, r.a.y, r.b.x, r.b.y], [-50, 0, 50, 0]);
  const v = run('getSceneHouseRidge(80, 200)');
  assert.deepEqual([v.a.x, v.a.y, v.b.x, v.b.y], [0, -60, 0, 60]);
  const sq = run('getSceneHouseRidge(100, 100)');
  assert.equal(sq.a.x, sq.b.x);
});

test('kéo chéo góc → góc theo mọi hướng; bấm 1 cái tạo nhà mặc định', () => {
  const { run } = load();
  assert.deepEqual({ ...run('getSceneHouseRectFromDrag(100, 100, 300, 220)') }, { startX: 100, startY: 160, objectW: 200, objectH: 120 });
  assert.deepEqual({ ...run('getSceneHouseRectFromDrag(300, 220, 100, 100)') }, { startX: 100, startY: 160, objectW: 200, objectH: 120 });
  assert.deepEqual({ ...run('getSceneHouseRectFromDrag(100, 100, 101, 102)') }, { startX: 40, startY: 100, objectW: 120, objectH: 70 });
});

test('vẽ: khung + 5 nét mái, là vật cảnh quan có tên "Nhà"', () => {
  const { log, run } = load();
  run("drawSceneryAsset(ctx, 'house', 200, 100, '#000', 1.5, 200, 100, { id: 'h1', type: 'house' })");
  assert.ok(log.some(c => c[0] === 'strokeRect'));
  assert.equal(log.filter(c => c[0] === 'lineTo').length, 5);
  assert.equal(run("isSceneryAssetType('house')"), true);
  assert.equal(run("getShapeDisplayName({ type: 'house' })"), 'Nhà');
  assert.match(read('runtime.js'), /id: 'house', name: 'Nhà \(mái 4 mái\)'/);
  assert.match(read('objects.js'), /currentDrawTool === 'house'/);
  assert.match(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), /scene\/building-assets\.js\?v=/);
});
