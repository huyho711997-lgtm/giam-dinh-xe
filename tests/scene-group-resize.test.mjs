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
    selectedShapeIds: [], selectedShapeId: null, currentSceneZoom: 1,
    sceneCanvas: { getBoundingClientRect: () => ({ width: 1000, height: 700 }) },
    genShapeId: (() => { let n = 0; return () => ++n; })()
  });
  for (const f of ['geometry', 'objects', 'traffic-signs', 'rendering', 'interaction-export', 'group-resize']) vm.runInContext(read(f + '.js'), context);
  return code => vm.runInContext(code, context);
}
const setup = `
  var house = { id: 'H', type: 'house', startX: 100, startY: 200, angle: 0, objectW: 200, objectH: 80, color: '#000', width: 1.5, sizeScale: 1 };
  var goods = { id: 'G', type: 'goods_damaged', startX: 320, startY: 200, angle: 0, objectW: 100, objectH: 60, color: '#000', width: 1.5, sizeScale: 1 };
  var line = { id: 'L', type: 'line', x1: 100, y1: 300, x2: 300, y2: 300, color: '#000', width: 1.5 };
  sceneShapes = [house, goods, line];
  setSelectedShapes(['H', 'G', 'L']);`;

test('có tay nắm nhóm: bấm trúng cạnh phải thì nhận ra tay nắm e', () => {
  const run = load(); run(setup);
  const box = run('getCollectiveBoundingBox(getSelectedShapes())');
  const hit = run(`hitTestSceneGroupResizeHandle(${box.x2 + 8}, ${box.cy})`);
  assert.equal(hit, 'e');
  assert.equal(run('hitTestSceneGroupResizeHandle(5, 5)'), null);
});

test('kéo cạnh phải: giãn ngang cả nhóm, neo ở cạnh trái, chiều dọc giữ nguyên', () => {
  const run = load(); run(setup);
  const box = run('getCollectiveBoundingBox(getSelectedShapes())');
  const oldW = box.maxX - box.minX;
  run(`var st = beginSceneGroupResize('e', { x: ${box.x2 + 8}, y: ${box.cy} });`);
  run(`resizeSceneGroupFromPointer(st, ${box.x2 + 8 + oldW / 2}, ${box.cy}, false)`);
  // Nhà giãn 1.5 lần theo trục ngang, cao không đổi.
  assert.ok(run('house.objectW') > 200 && run("house.objectW") < 320, run('house.objectW'));
  assert.equal(run('house.objectH'), 80);
  assert.ok(Math.abs(run('goods.objectW') / run('house.objectW') - 0.5) < 0.001);
  // Neo trái: CẠNH KHUNG bên trái không dịch, cạnh phải bám đúng chuột (đã bù viền đệm).
  const nb = run('getCollectiveBoundingBox(getSelectedShapes())');
  assert.ok(Math.abs(nb.minX - box.minX) < 0.5, nb.minX + ' vs ' + box.minX);
  assert.ok(Math.abs(nb.maxX - (box.maxX + oldW / 2)) < 0.5, nb.maxX);
  assert.equal(run('line.y1'), 300);
});

test('kéo góc giữ tỷ lệ; Shift kéo tự do', () => {
  const run = load(); run(setup);
  const box = run('getCollectiveBoundingBox(getSelectedShapes())');
  run(`var st = beginSceneGroupResize('se', { x: ${box.x2 + 8}, y: ${box.y2 + 8} });`);
  run(`resizeSceneGroupFromPointer(st, ${box.x2 + 8 + 100}, ${box.y2 + 8 + 5}, false)`);
  const ratio = run('house.objectH') / run('house.objectW');
  assert.ok(Math.abs(ratio - 80 / 200) < 0.001, ratio);
  run(`resizeSceneGroupFromPointer(st, ${box.x2 + 8 + 100}, ${box.y2 + 8 + 5}, true)`);
  assert.ok(Math.abs(run('house.objectH') / run('house.objectW') - 0.4) > 0.01);
});

test('kéo lại từ dữ liệu gốc: không cộng dồn sai số, thu về đúng kích cỡ ban đầu', () => {
  const run = load(); run(setup);
  const box = run('getCollectiveBoundingBox(getSelectedShapes())');
  run(`var st = beginSceneGroupResize('e', { x: ${box.x2 + 8}, y: ${box.cy} });`);
  run(`resizeSceneGroupFromPointer(st, ${box.x2 + 108}, ${box.cy}, false)`);
  run(`resizeSceneGroupFromPointer(st, ${box.x2 + 8}, ${box.cy}, false)`);
  assert.equal(run('house.objectW'), 200);
  assert.equal(run('house.startX'), 100);
});

test('không thu nhỏ quá nhỏ và không vượt ra ngoài ô vẽ', () => {
  const run = load(); run(setup);
  const box = run('getCollectiveBoundingBox(getSelectedShapes())');
  run(`var st = beginSceneGroupResize('e', { x: ${box.x2 + 8}, y: ${box.cy} });`);
  run(`resizeSceneGroupFromPointer(st, ${box.minX - 500}, ${box.cy}, false)`);
  const b1 = run('getCollectiveBoundingBox(getSelectedShapes())');
  assert.ok(b1.maxX - b1.minX > 5);
  run(`resizeSceneGroupFromPointer(st, 99999, ${box.cy}, false)`);
  const bounds = run('getSceneDrawingAreaBounds()');
  assert.ok(run('line.x2') <= bounds.x + bounds.width + 0.01, run('line.x2'));
});

test('xoay + giãn: vật nghiêng vẫn co theo trục cục bộ, tâm đúng vị trí', () => {
  const run = load();
  run(`var v = { id: 'V', type: 'car', startX: 200, startY: 300, angle: Math.PI / 2, carW: 40, vehicleH: 20, color: '#000', width: 1.5, sizeScale: 1 };
       var t = { id: 'T', type: 'text', x: 400, y: 300, text: 'Ab', fontSize: 16, color: '#000' };
       var n = { id: 'N', type: 'number_note', x: 500, y: 300, radius: 13, color: '#000' };
       sceneShapes = [v, t, n]; setSelectedShapes(['V','T','N']);`);
  const box = run('getCollectiveBoundingBox(getSelectedShapes())');
  run(`var st = beginSceneGroupResize('e', { x: ${box.x2 + 8}, y: ${box.cy} });`);
  run(`resizeSceneGroupFromPointer(st, ${box.x2 + 8 + (box.maxX - box.minX) / 4}, ${box.cy}, false)`);
  // Xe quay 90°: trục dọc cục bộ nằm ngang màn hình → vehicleH nở theo, carW giữ nguyên.
  assert.ok(run('v.vehicleH') > 20 * 1.1, run('v.vehicleH'));
  assert.ok(Math.abs(run('v.carW') - 40) < 0.5, run('v.carW'));
  assert.ok(run('t.fontSize') > 16 && run('n.radius') > 13);
});

test('Esc hoàn tác: restoreSceneGroupResize trả đúng dữ liệu gốc', () => {
  const run = load(); run(setup);
  const box = run('getCollectiveBoundingBox(getSelectedShapes())');
  run(`var st = beginSceneGroupResize('s', { x: ${box.cx}, y: ${box.y2 + 8} });`);
  run(`resizeSceneGroupFromPointer(st, ${box.cx}, ${box.y2 + 80}, false)`);
  assert.notEqual(run('house.objectH'), 80);
  run('restoreSceneGroupResize(st)');
  assert.equal(run('house.objectH'), 80);
  assert.equal(run('line.y1'), 300);
});

test('index.html nạp group-resize.js', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /group-resize\.js\?v=/);
});
