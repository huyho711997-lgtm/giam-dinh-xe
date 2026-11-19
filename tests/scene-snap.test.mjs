import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../js/features/scene/', import.meta.url);
const read = f => fs.readFileSync(new URL(f, root), 'utf8');
function load(zoom = 1) {
  const context = vm.createContext({
    Math, Number, Array, JSON, Map, Set, String, Object, console, Date,
    document: { getElementById: () => null }, window: {},
    sceneShapes: [], sceneTemplateMeta: null, SCENE_LOGICAL_WIDTH: 1000, SCENE_LOGICAL_HEIGHT: 700,
    selectedShapeIds: [], currentSceneZoom: zoom, genShapeId: (() => { let n = 0; return () => ++n; })()
  });
  for (const f of ['geometry', 'objects', 'traffic-signs', 'rendering', 'interaction-export']) vm.runInContext(read(f + '.js'), context);
  return code => vm.runInContext(code, context);
}
const setup = `
  var line = { id: 'L', type: 'line', x1: 0, y1: 100, x2: 600, y2: 100, color: '#000', width: 1.5 };
  var box = { id: 'B', type: 'goods_damaged', startX: 200, startY: 40, angle: 0, objectW: 120, objectH: 60, color: '#000', width: 1.5, sizeScale: 1 };
  sceneShapes = [line, box];
  var orig = JSON.parse(JSON.stringify(box));`;

test('tắt hít dính: kéo tự do đúng theo chuột', () => {
  const run = load();
  run(setup);
  run('setSceneSnapEnabled(false)');
  const r = run('computeSmartSnapping(box, orig, 3, 3, false, false)');
  assert.equal(r.dx, 3); assert.equal(r.dy, 3); assert.equal(r.guides.length, 0);
  assert.equal(run('findSnapPoint({ x: 1, y: 101 })'), null);
});

test('giữ Alt cũng tắt hít dính', () => {
  const run = load();
  run(setup);
  const r = run('computeSmartSnapping(box, orig, 3, 3, false, true)');
  assert.equal(r.dx, 3); assert.equal(r.dy, 3);
});

test('ngưỡng hít theo pixel màn hình: phóng to thì vùng hít nhỏ lại', () => {
  assert.ok(load(1)('getSceneSnapDistance(6)') > load(2)('getSceneSnapDistance(6)'));
  assert.equal(load(2)('getSceneSnapDistance(6)'), 3);
});

test('tâm vật không còn bị hút lên nét (không tự căn giữa vào đường)', () => {
  const run = load();
  // Vật đặt sao cho TÂM cách nét 4px còn các mép ở xa.
  run(`sceneShapes = [{ id: 'L', type: 'line', x1: 0, y1: 300, x2: 600, y2: 300, color: '#000', width: 1.5 },
        { id: 'B', type: 'goods_damaged', startX: 200, startY: 296, angle: 0, objectW: 120, objectH: 200, color: '#000', width: 1.5, sizeScale: 1 }];
       var b = sceneShapes[1]; var o = JSON.parse(JSON.stringify(b));`);
  const r = run('computeSmartSnapping(b, o, 0, 0, false, false)');
  assert.ok(!r.guides.some(g => /nét|mép/.test(g.label || '')), JSON.stringify(r.guides));
});

test('nút bật/tắt hít dính có trên thanh zoom', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="sceneSnapToggle" onclick="toggleSceneSnap\(\)"/);
});

test('vẫn dính khi mép vật áp sát nét từ bên ngoài', () => {
  const run = load();
  run(`sceneShapes = [{ id: 'L', type: 'line', x1: 0, y1: 300, x2: 600, y2: 300, color: '#000', width: 1.5 },
        { id: 'B', type: 'goods_damaged', startX: 200, startY: 200, angle: 0, objectW: 120, objectH: 60, color: '#000', width: 1.5, sizeScale: 1 }];
       var b = sceneShapes[1]; var o = JSON.parse(JSON.stringify(b));
       var bottom = Math.max.apply(null, getShapeSnapAnchorsWithOffset(b, 0, 0).map(a => a.y));`);
  const gap = run('300 - bottom');
  const r = run(`computeSmartSnapping(b, o, 0, ${gap - 3}, false, false)`);
  assert.ok(Math.abs(run('bottom') + r.dy - 300) < 0.01, JSON.stringify(r));
});

test('giữ lựa chọn: bấm chỗ có nét đè vẫn kéo đúng vật đang chọn', () => {
  const run = load();
  run(`sceneShapes = [{ id: 'B', type: 'goods_damaged', startX: 200, startY: 200, angle: 0, objectW: 120, objectH: 60, color: '#000', width: 1.5, sizeScale: 1 },
                      { id: 'L', type: 'line', x1: 260, y1: 100, x2: 260, y2: 300, color: '#000', width: 1.5 }];
       selectedShapeIds = ['B'];`);
  const keep = run(`pickSceneStickySelectionCandidate([{ shape: sceneShapes[1], priority: 9, area: 1 }, { shape: sceneShapes[0], priority: 1, area: 999 }], { x: 260, y: 200 })`);
  assert.equal(keep.shape.id, 'B');
  run(`selectedShapeIds = ['L']`);
  const near = run(`getSceneSelectedShapeNearPointer({ x: 266, y: 150 }, [])`);
  assert.equal(near.shape.id, 'L', 'bấm lệch vài px khỏi nét mảnh đang chọn vẫn bắt trúng');
  assert.equal(run(`getSceneSelectedShapeNearPointer({ x: 300, y: 150 }, [])`), null);
  assert.match(read('objects.js'), /if \(e\.altKey && !e\.ctrlKey && !e\.metaKey && lastHitCandidates/);
});
