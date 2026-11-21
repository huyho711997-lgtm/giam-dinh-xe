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
    sceneShapes: [], sceneTemplateMeta: null,
    SCENE_LOGICAL_WIDTH: 1000, SCENE_LOGICAL_HEIGHT: 700,
    genShapeId: (() => { let n = 0; return () => ++n; })()
  });
  for (const f of ['geometry', 'objects', 'traffic-signs', 'rendering', 'interaction-export', 'terrain-assets']) vm.runInContext(read(f + '.js'), context);
  return { context, run: code => vm.runInContext(code, context) };
}

// Hình chữ L (6 đỉnh) trong khung 200x120: nếu bị bo cong thì số điểm lấy mẫu sẽ nhiều hơn 6 và lệch khỏi đỉnh.
const L = [[0, 0], [1, 0], [1, 0.5], [0.5, 0.5], [0.5, 1], [0, 1]];
const outlineOf = (extra) => `getSceneryAreaOutline(${JSON.stringify({ areaShape: 'custom', areaOutline: L, ...extra })}, 10, 10, 200, 120)`;

test('ranh giới tự vẽ mặc định: cạnh THẲNG – đúng các đỉnh đã bấm, không bo', () => {
  const { run } = load();
  const pts = JSON.parse(JSON.stringify(run(outlineOf({}))));
  assert.equal(pts.length, L.length);
  pts.forEach((p, i) => {
    assert.ok(Math.abs(p.x - (10 + L[i][0] * 200)) < 1e-6 && Math.abs(p.y - (10 + L[i][1] * 120)) < 1e-6, 'đỉnh ' + i);
  });
});

test('areaEdge=straight tương đương mặc định; areaEdge=curve mới bo mượt (nhiều điểm hơn)', () => {
  const { run } = load();
  assert.equal(run(outlineOf({ areaEdge: 'straight' })).length, L.length);
  assert.ok(run(outlineOf({ areaEdge: 'curve' })).length > L.length * 4);
});

test('vùng "natural" (đồi) vẫn bo mềm như cũ', () => {
  const { run } = load();
  const n = run("getSceneryAreaOutline({ areaShape: 'natural', areaOutline: null }, 10, 10, 200, 120)");
  assert.ok(n && n.length > 8);
});

test('sceneAreaEdgeIsSmooth: chỉ custom + cạnh thẳng mới KHÔNG làm mượt thêm đường đồng mức', () => {
  const { run } = load();
  assert.equal(run("sceneAreaEdgeIsSmooth({ areaShape: 'custom' })"), false);
  assert.equal(run("sceneAreaEdgeIsSmooth({ areaShape: 'custom', areaEdge: 'curve' })"), true);
  assert.equal(run("sceneAreaEdgeIsSmooth({ areaShape: 'natural' })"), true);
});

test('UI: bấm điểm/Enter/nhấp đúp → straight; rê tay → curve; thêm điểm theo đoạn thẳng; công tắc cạnh có mặt ở cả 2 trang', () => {
  const ui = read('scene-editor-ui.js');
  assert.match(ui, /finish\(points\.slice\(\), 'straight'\)/);
  assert.match(ui, /finish\(smoothSceneFreehand\(drawn\), 'curve'\)/);
  assert.match(ui, /function setSelectedSceneryAreaEdge/);
  assert.match(ui, /sceneAreaSegmentDistance\(pos, a, anchors\[/);
  for (const page of ['../../../index.html', '../../../so-do-hien-truong.html']) {
    const html = fs.readFileSync(new URL(page, root), 'utf8');
    assert.match(html, /data-area-edge="straight"/);
    assert.match(html, /data-area-edge="curve"/);
  }
});

test('sceneAreaSegmentDistance: khoảng cách tới đoạn thẳng', () => {
  const { run } = load();
  // hàm nằm trong scene-editor-ui.js (cần DOM) → trích riêng để thử
  const src = read('scene-editor-ui.js').match(/function sceneAreaSegmentDistance[\s\S]*?\n}\n/)[0];
  const ctx = vm.createContext({ Math });
  vm.runInContext(src, ctx);
  assert.equal(vm.runInContext('sceneAreaSegmentDistance({x:5,y:3},{x:0,y:0},{x:10,y:0})', ctx), 3);
  assert.equal(vm.runInContext('sceneAreaSegmentDistance({x:-4,y:3},{x:0,y:0},{x:10,y:0})', ctx), 5);
  void run;
});
