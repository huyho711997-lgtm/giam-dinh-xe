import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/scene/scene-samples.js', import.meta.url), 'utf8');
function load(extra = {}) {
  let n = 0;
  const ctx = vm.createContext({ console, Math, Number, Array, JSON, String, genShapeId: () => 'id' + (++n), ...extra });
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.runInContext(source, ctx);
  return ctx;
}
const AREA = { x: 21.6, y: 86.6, width: 796.8, height: 471.8 };
const plain = v => JSON.parse(JSON.stringify(v));
const STYLE = { color: '#123456', width: 2 };

function inside(shape) {
  const pts = [];
  if ('x1' in shape) pts.push([shape.x1, shape.y1], [shape.x2, shape.y2]);
  if ('cx' in shape) pts.push([shape.cx, shape.cy]);
  if (shape.type === 'bridge') pts.push([shape.startX, shape.startY], [shape.startX + shape.objectW, shape.startY]);
  return pts.every(([x, y]) => x >= AREA.x && x <= AREA.x + AREA.width && y >= AREA.y && y <= AREA.y + AREA.height);
}

test('có đủ 5 mẫu, mỗi mẫu có tên, mô tả và biểu tượng', () => {
  const api = load().SceneSamples;
  assert.deepEqual(plain(api.SAMPLES.map(s => s.id)), ['straight', 't_junction', 'crossroad', 'curve', 'bridge']);
  for (const s of api.SAMPLES) assert.ok(s.name && s.desc && s.icon, s.id);
});

test('mỗi mẫu: shape có id duy nhất, cùng groupId, màu/nét theo người dùng, nằm trong khung vẽ', () => {
  const api = load().SceneSamples;
  for (const { id } of api.SAMPLES) {
    const shapes = plain(api.buildSample(id, STYLE, AREA));
    assert.ok(shapes.length >= 3, id);
    assert.equal(new Set(shapes.map(s => s.id)).size, shapes.length, id + ': id trùng');
    assert.equal(new Set(shapes.map(s => s.groupId)).size, 1, id + ': phải cùng một nhóm');
    assert.match(shapes[0].groupId, new RegExp('^sample_' + id + '_'));
    assert.ok(shapes.every(s => s.color === '#123456' && s.width === 2), id);
    assert.ok(shapes.every(inside), id + ': có nét ra ngoài khung vẽ');
  }
});

test('ngã tư đối xứng quanh tâm; ngã ba có đúng một nhánh rẽ xuống; cầu có 1 cầu + đường hai đầu', () => {
  const api = load().SceneSamples;
  const cross = plain(api.buildSample('crossroad', STYLE, AREA));
  assert.equal(cross.filter(s => s.type === 'road_line').length, 8);
  assert.equal(cross.filter(s => s.type === 'road_dashed').length, 4);

  const tee = plain(api.buildSample('t_junction', STYLE, AREA));
  assert.equal(tee.filter(s => s.type === 'road_line').length, 5);
  assert.equal(tee.filter(s => s.type === 'road_dashed').length, 2);
  const vertical = tee.filter(s => s.x1 === s.x2);
  assert.ok(vertical.every(s => s.y2 > s.y1), 'nhánh chỉ đi xuống');

  const bridge = plain(api.buildSample('bridge', STYLE, AREA));
  const b = bridge.filter(s => s.type === 'bridge');
  assert.equal(b.length, 1);
  assert.equal(b[0].objectH, b[0].objectW * 0.22);
  assert.equal(bridge.filter(s => s.type === 'road_line').length, 4);
});

test('đường cong: hai mép cong + vạch giữa đứt, điểm đầu/cuối cách nhau đúng một bề rộng đường', () => {
  const api = load().SceneSamples;
  const shapes = plain(api.buildSample('curve', STYLE, AREA));
  assert.deepEqual(shapes.map(s => s.type).sort(), ['curve', 'curve', 'curve_dashed']);
  const [a, b] = shapes.filter(s => s.type === 'curve');
  assert.equal(Math.abs(a.y1 - b.y1), 88);
  assert.equal(Math.abs(a.x2 - b.x2), 88);
});

test('mẫu không biết → mảng rỗng; insertSample thêm xuống dưới cùng, chọn cả nhóm và lưu lịch sử', () => {
  const calls = [];
  const sceneShapes = [{ id: 'car1', type: 'car' }];
  const ctx = load({
    sceneShapes, document: { getElementById: () => null },
    setSelectedShapes: ids => calls.push(['select', ids.length]),
    saveDrawingState: () => calls.push(['save']),
    setActiveDrawTool: t => calls.push(['tool', t]),
    redrawSceneCanvas: () => calls.push(['redraw']),
    showToast: () => calls.push(['toast'])
  });
  const api = ctx.SceneSamples;
  assert.deepEqual(plain(api.buildSample('khong-co', STYLE, AREA)), []);
  assert.equal(api.insertSample('khong-co'), false);
  assert.equal(api.insertSample('crossroad'), true);
  assert.equal(sceneShapes.length, 13);
  assert.equal(sceneShapes[sceneShapes.length - 1].id, 'car1', 'xe cũ vẫn nằm trên cùng');
  assert.deepEqual(plain(calls.map(c => c[0])), ['select', 'save', 'tool', 'redraw', 'toast']);
  assert.equal(calls[0][1], 12);
});

test('cả hai trang nạp scene-samples.js sau toolbar-ui.js và có nút Sơ đồ mẫu', () => {
  for (const page of ['../index.html', '../so-do-hien-truong.html']) {
    const html = fs.readFileSync(new URL(page, import.meta.url), 'utf8');
    const a = html.indexOf('scene/toolbar-ui.js'), b = html.indexOf('scene/scene-samples.js');
    assert.ok(a > 0 && b > a, page);
    assert.match(html, /id="toolBtnSamples"/);
  }
});
