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
    selectedShapeIds: [], currentSceneZoom: 1, currentDrawTool: 'select', genShapeId: () => 'x',
    sceneCanvas: null, sceneCtx: null
  });
  for (const f of ['geometry', 'objects', 'traffic-signs', 'rendering', 'interaction-export', 'selection-marquee']) vm.runInContext(read(f + '.js'), context);
  return code => vm.runInContext(code, context);
}
const setup = `
  sceneShapes = [
    { id: 'H', type: 'house', startX: 200, startY: 300, angle: 0, objectW: 160, objectH: 70, color: '#000', width: 1.5, sizeScale: 1 },
    { id: 'G', type: 'goods_damaged', startX: 400, startY: 300, angle: 0, objectW: 100, objectH: 60, color: '#000', width: 1.5, sizeScale: 1 },
    { id: 'L', type: 'line', x1: 100, y1: 450, x2: 700, y2: 450, color: '#000', width: 1.5 },
    { id: 'A', type: 'rect', x: 600, y: 100, w: 40, h: 40, color: '#000', width: 1.5, groupId: 'g1' },
    { id: 'B', type: 'rect', x: 800, y: 100, w: 40, h: 40, color: '#000', width: 1.5, groupId: 'g1' }
  ];`;
const ids = (run, rect) => [...run(`getSceneShapeIdsInMarquee(${JSON.stringify(rect)}, sceneShapes)`)];

test('kéo trái→phải: chỉ chọn vật nằm TRỌN trong khung', () => {
  const run = load(); run(setup);
  const rect = { x1: 150, y1: 230, x2: 560, y2: 380, crossing: false };
  assert.deepEqual(ids(run, rect), ['H', 'G']);
  // Nét dài chỉ cắt qua khung thì KHÔNG được chọn khi kéo kiểu "trọn khung".
  assert.deepEqual(ids(run, { x1: 300, y1: 430, x2: 400, y2: 470, crossing: false }), []);
});

test('kéo phải→trái: chọn mọi vật chạm khung (kể cả nét dài)', () => {
  const run = load(); run(setup);
  assert.deepEqual(ids(run, { x1: 600, y1: 430, x2: 650, y2: 470, crossing: true }), ['L']);
});

test('chọn một thành viên của nhóm thì chọn cả nhóm', () => {
  const run = load(); run(setup);
  assert.deepEqual(ids(run, { x1: 580, y1: 80, x2: 660, y2: 160, crossing: false }), ['A', 'B']);
});

test('trạng thái kéo khung: Shift/Ctrl cộng thêm, Esc bỏ khung', () => {
  const run = load(); run(setup);
  run(`setSelectedShapes(['L']); beginSceneMarquee({ x: 150, y: 230 }, true); updateSceneMarquee({ x: 560, y: 380 });`);
  assert.deepEqual([...run('selectedShapeIds')].sort(), ['G', 'H', 'L']);
  run('finishSceneMarquee({ x: 560, y: 380 })');
  assert.equal(run('sceneMarqueeState'), null);
  run(`setSelectedShapes([]); beginSceneMarquee({ x: 150, y: 230 }, false); updateSceneMarquee({ x: 560, y: 380 });`);
  assert.equal(run('cancelSceneMarquee()'), true);
  assert.equal(run('sceneMarqueeState'), null);
});

test('bấm không kéo thì không tạo khung (không chọn gì)', () => {
  const run = load(); run(setup);
  run(`setSelectedShapes([]); beginSceneMarquee({ x: 700, y: 600 }, false); updateSceneMarquee({ x: 701, y: 601 }); finishSceneMarquee({ x: 701, y: 601 });`);
  assert.deepEqual([...run('selectedShapeIds')], []);
});

test('Ctrl+A chọn tất cả; có tệp và phím tắt được nối vào', () => {
  const run = load(); run(setup);
  assert.equal(run('selectAllSceneShapes()'), 5);
  assert.deepEqual([...run('selectedShapeIds')], ['H', 'G', 'L', 'A', 'B']);
  assert.match(read('runtime.js'), /selectAllSceneShapes\(\)/);
  assert.match(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), /selection-marquee\.js\?v=/);
});
