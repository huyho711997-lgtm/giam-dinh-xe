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
    selectedShapeIds: [], currentSceneZoom: 1, genShapeId: (() => { let n = 0; return () => 'd' + (++n); })()
  });
  for (const f of ['geometry', 'objects', 'traffic-signs', 'rendering', 'interaction-export', 'symbol-legend', 'direction-label']) vm.runInContext(read(f + '.js'), context);
  const log = [];
  context.ctx = new Proxy({ measureText: t => ({ width: String(t).length * 7 }) }, {
    get(t, p) { return p in t ? t[p] : (...a) => { log.push([p, ...a]); }; },
    set(t, p, v) { t[p] = v; return true; }
  });
  return { log, run: code => vm.runInContext(code, context) };
}

test('tạo mặc định "Hướng về", đối tượng tuyến tính chọn được cả vùng chữ', () => {
  const { run } = load();
  run("var d = createSceneDirectionLabel(100, 300, 300, 300, '#000', 1.5); d.text = 'Buôn Hồ'; sceneShapes = [d];");
  assert.equal(run('d.prefix'), 'Hướng về');
  assert.equal(run('isLinearResizableShape(d)'), true);
  assert.equal(run('hitTestShape(d, 200, 300 - 20)'), true, 'bấm vào dòng chữ trên');
  assert.equal(run('hitTestShape(d, 200, 300 + 20)'), true, 'bấm vào dòng chữ dưới');
  assert.equal(run('hitTestShape(d, 200, 300 + 70)'), false);
  assert.equal(run('getShapeDisplayName(d)'), 'Hướng: Hướng về Buôn Hồ');
  assert.equal(run("SCENE_SYMBOL_LEGEND_SKIP_TYPES.includes('direction_label')"), true);
});

test('vẽ: mũi tên + chữ trên/dưới; mũi tên sang trái chữ vẫn đứng thẳng', () => {
  const { log, run } = load();
  run("drawSceneDirectionLabel(ctx, { x1: 300, y1: 100, x2: 100, y2: 100, prefix: 'Hướng về', text: 'Buôn Hồ', fontSize: 16, color: '#000', width: 1.5 })");
  const texts = log.filter(c => c[0] === 'fillText');
  assert.deepEqual(texts.map(c => c[1]), ['Hướng về', 'Buôn Hồ']);
  assert.ok(texts[0][3] < 0 && texts[1][3] > 0, 'Hướng về ở trên, nơi đến ở dưới');
  const rotate = log.find(c => c[0] === 'rotate');
  assert.ok(Math.abs(rotate[1]) < 1e-9, 'mũi tên chỉ sang trái: chữ không bị lộn ngược');
  assert.ok(Math.abs(run('getSceneDirectionReadableAngle(0, 0, -10, -10)')) <= Math.PI / 2);
});

test('chưa nhập nơi đến thì chừa chỗ chấm', () => {
  const { log, run } = load();
  run("drawSceneDirectionLabel(ctx, { x1: 0, y1: 0, x2: 200, y2: 0, prefix: 'Hướng về', text: '', color: '#000', width: 1.5 })");
  assert.ok(log.some(c => c[0] === 'fillText' && /…/.test(c[1])));
});

test('đã nối vào thanh công cụ, vẽ, bấm đúp, index.html', () => {
  assert.match(read('runtime.js'), /id: 'direction_label', name: 'Hướng về… \(mũi tên \+ chữ\)'/);
  assert.match(read('objects.js'), /openSceneDirectionEditor\(newShape, true\)/);
  assert.match(read('geometry.js'), /openSceneDirectionEditor\(sceneShapes\[i\], false\)/);
  assert.match(read('geometry.js'), /drawSceneDirectionLabel\(ctx, shape, color, width\)/);
  assert.match(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), /scene\/direction-label\.js\?v=/);
});
