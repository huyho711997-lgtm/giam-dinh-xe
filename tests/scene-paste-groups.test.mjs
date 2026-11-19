import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../js/features/scene/', import.meta.url);
const read = f => fs.readFileSync(new URL(f, root), 'utf8');
function load() {
  let n = 0;
  const context = vm.createContext({
    Math, Number, Array, JSON, Map, Set, String, Object, console, Date,
    document: { getElementById: () => null }, window: {},
    sceneShapes: [], sceneTemplateMeta: null, SCENE_LOGICAL_WIDTH: 1000, SCENE_LOGICAL_HEIGHT: 700,
    selectedShapeIds: [], currentSceneZoom: 1, currentDrawTool: 'select', genShapeId: () => 'n' + (++n),
    sceneCanvas: null, sceneCtx: null, sceneClipboardShapes: null, sceneClipboard: null
  });
  for (const f of ['geometry', 'objects', 'traffic-signs', 'rendering', 'interaction-export']) vm.runInContext(read(f + '.js'), context);
  // Ghi đè sau khi nạp: các hàm giao diện thật phụ thuộc DOM.
  vm.runInContext('setActiveDrawTool = () => {}; updateSelectionBadge = () => {}; redrawSceneCanvas = () => {}; saveDrawingState = () => {};', context);
  return code => vm.runInContext(code, context);
}
const rect = (id, x, groupId) => ({ id, type: 'rect', x, y: 100, w: 40, h: 40, color: '#000', width: 1.5, groupId });

test('dán nhiều nhóm: mỗi nhóm gốc thành đúng một nhóm mới, tách biệt', () => {
  const run = load();
  run(`sceneShapes = ${JSON.stringify([rect('A', 0, 'g1'), rect('B', 60, 'g1'), rect('C', 120, 'g2'), rect('D', 180, 'g2'), rect('E', 240, null)])};
       setSelectedShapes(['A','B','C','D','E']); copySelectedShape(); pasteCopiedShape();`);
  const pasted = JSON.parse(run('JSON.stringify(sceneShapes.slice(5))'));
  assert.equal(pasted.length, 5);
  const [a, b, c, d, e] = pasted;
  assert.equal(a.groupId, b.groupId);
  assert.equal(c.groupId, d.groupId);
  assert.notEqual(a.groupId, c.groupId);
  assert.ok(a.groupId && a.groupId !== 'g1' && c.groupId !== 'g2');
  assert.equal(e.groupId, null);
});

test('dán một đối tượng đơn lẻ thuộc nhóm: không dính vào nhóm cũ', () => {
  const run = load();
  run(`sceneShapes = ${JSON.stringify([rect('A', 0, 'g1'), rect('B', 60, 'g1')])};
       sceneClipboardShapes = [JSON.parse(JSON.stringify(sceneShapes[0]))]; pasteCopiedShape();`);
  const last = JSON.parse(run('JSON.stringify(sceneShapes[sceneShapes.length - 1])'));
  assert.equal(last.groupId, null);
});
