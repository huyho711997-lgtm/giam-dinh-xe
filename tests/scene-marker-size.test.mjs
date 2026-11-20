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
    sceneShapes: [], selectedShapeIds: [], selectedShapeId: null, currentSceneZoom: 1, currentDrawTool: 'select',
    SCENE_LOGICAL_WIDTH: 1000, SCENE_LOGICAL_HEIGHT: 700, genShapeId: () => 'x', sceneCanvas: null, sceneCtx: null
  });
  for (const f of ['geometry', 'objects', 'traffic-signs']) vm.runInContext(read(f + '.js'), context);
  return code => vm.runInContext(code, context);
}

test('cột mốc lộ giới: cỡ mặc định 30, thu nhỏ được tới 12; các vật khác giữ giới hạn cũ', () => {
  const run = load();
  assert.equal(run(`getSceneryMinimumLength('road_boundary_marker')`), 30);
  assert.equal(run(`getSceneryResizeMinLength('road_boundary_marker')`), 12);
  assert.equal(run(`getMinimumVehicleLength({ type: 'road_boundary_marker' })`), 12);
  assert.equal(run(`getSceneryResizeMinHeight('road_boundary_marker')`), 4);
  for (const type of ['utility_pole', 'tree', 'house', 'pothole']) {
    assert.equal(run(`getSceneryResizeMinLength('${type}')`), run(`getSceneryMinimumLength('${type}')`));
    assert.equal(run(`getSceneryResizeMinHeight('${type}')`), run(`Math.max(12, getSceneryMinimumLength('${type}') * getSceneryAspectRatio('${type}') * 0.35)`));
  }
});

test('nút − thu cột mốc từng bước tới đúng giới hạn, giữ tỉ lệ, không méo', () => {
  const run = load();
  run(`sceneShapes = [{ id: 'm', type: 'road_boundary_marker', startX: 300, startY: 300, angle: 0, objectW: 46, objectH: 21.16, color: '#000', width: 1.5, sizeScale: 1 }];
       selectedShapeId = 'm'; selectedShapeIds = ['m']; saveDrawingState = () => {}; redrawSceneCanvas = () => {}; updateSelectionBadge = () => {};
       for (let i = 0; i < 20; i++) scaleSelectedInfrastructure(0.9);`);
  const w = run('sceneShapes[0].objectW'), h = run('sceneShapes[0].objectH');
  assert.equal(w, 12);
  assert.ok(h >= 4 && Math.abs(h / w - 0.46) < 0.02, `tỉ lệ ${h / w}`);
});
