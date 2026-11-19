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
    selectedShapeIds: [], currentSceneZoom: zoom, genShapeId: () => 'x'
  });
  for (const f of ['geometry', 'objects', 'traffic-signs', 'rendering', 'interaction-export']) vm.runInContext(read(f + '.js'), context);
  const log = [];
  context.ctx = new Proxy({ measureText: t => ({ width: String(t).length * 6 }) }, {
    get(t, p) { return p in t ? t[p] : (...a) => { log.push([p, ...a]); }; },
    set(t, p, v) { t[p] = v; if (['fillStyle', 'strokeStyle', 'shadowBlur', 'globalAlpha'].includes(p)) log.push(['set:' + p, v]); return true; }
  });
  return { log, run: code => vm.runInContext(code, context) };
}

test('tay nắm rỗng ruột: ruột chỉ phủ màu rất nhạt, chỉ vẽ viền (vòng trắng + viền sẫm) nên không che vật bên dưới', () => {
  const { log, run } = load();
  run("drawSceneSelectionHandle(ctx, 100, 100, { size: 10 })");
  const alphaSets = log.filter(c => c[0] === 'set:globalAlpha').map(c => c[1]);
  assert.ok(alphaSets.length && alphaSets[0] <= 0.2, 'ruột gần như trong suốt');
  const strokes = log.filter(c => c[0] === 'set:strokeStyle').map(c => c[1]);
  assert.equal(strokes[0], '#ffffff', 'vòng trắng ngoài tách khỏi nét đen');
  assert.equal(strokes.length, 2, 'rồi tới viền sẫm');
  // Không có lệnh tô đặc nào ở độ mờ 100% (nền trắng cũ đã bị bỏ).
  const fillIdx = log.findIndex(c => c[0] === 'fill');
  const opaqueBefore = log.slice(0, fillIdx).some(c => c[0] === 'set:globalAlpha' && c[1] === 1);
  assert.equal(opaqueBefore, false);
  assert.ok(log.some(c => c[0] === 'set:shadowBlur' && c[1] > 0), 'có bóng nhẹ cho vòng trắng');
});

test('thu nhỏ sơ đồ thì tay nắm tự to lên để trên màn hình luôn đủ lớn', () => {
  assert.equal(load(1).run('getSceneHandleSize(10)'), 10);
  assert.equal(load(2).run('getSceneHandleSize(10)'), 10, 'phóng to: không cần to thêm');
  assert.ok(load(0.5).run('getSceneHandleSize(10)') > 15);
  assert.ok(load(0.1).run('getSceneHandleSize(10)') <= 22, 'có trần');
});

test('khung chọn nét thẳng / đường cong / nhóm đều dùng tay nắm nổi', () => {
  const { log, run } = load();
  run(`drawShapeSelectionBox(ctx, { id: 'a', type: 'line', x1: 100, y1: 200, x2: 300, y2: 200, color: '#000', width: 2 })`);
  const lineHandles = log.filter(c => c[0] === 'set:shadowBlur' && c[1] > 0).length;
  assert.ok(lineHandles >= 2, 'nét thẳng: 2 tay nắm đầu nét');
  log.length = 0;
  run(`drawShapeSelectionBox(ctx, { id: 'c', type: 'curve', x1: 100, y1: 200, x2: 300, y2: 200, cx: 200, cy: 150, color: '#000', width: 2 })`);
  assert.ok(log.filter(c => c[0] === 'set:shadowBlur' && c[1] > 0).length >= 3, 'đường cong: 2 đầu + điểm uốn');
  log.length = 0;
  run(`sceneShapes = [{ id: 'g1', type: 'line', x1: 100, y1: 200, x2: 200, y2: 200, color: '#000', width: 2 }, { id: 'g2', type: 'line', x1: 100, y1: 240, x2: 200, y2: 240, color: '#000', width: 2 }];
       setSelectedShapes(['g1', 'g2']); drawMultiSelectionBox(ctx, getSelectedShapes());`);
  assert.ok(log.filter(c => c[0] === 'set:shadowBlur' && c[1] > 0).length >= 8, 'nhóm: 8 tay nắm');
});
