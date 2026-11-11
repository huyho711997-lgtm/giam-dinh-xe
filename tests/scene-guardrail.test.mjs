import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const context = vm.createContext({ Math, Number, Array, JSON, console, genShapeId: (() => { let n = 0; return () => ++n; })() });
for (const file of ['js/features/scene/geometry.js', 'js/features/scene/objects.js', 'js/features/scene/rendering.js']) {
  vm.runInContext(read(file), context, { filename: file });
}
const run = code => vm.runInContext(code, context);
const plain = value => JSON.parse(JSON.stringify(value));

function recordingCtx() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (_, name) => name === 'calls' ? calls : (...args) => { calls.push([String(name), ...args]); },
    set: (_, name, value) => { calls.push(['set:' + String(name), value]); return true; }
  });
  return ctx;
}

test('Công cụ hộ lan dùng chung cơ chế nhấp đầu–nhấp cuối với vệt bánh xe', () => {
  assert.equal(run("isTireTrackTool('guardrail')"), true);
  assert.equal(run("isTireTrackTool('tire_track')"), true);
  for (const other of ['pen', 'curve', 'rect', 'select', 'road_edge']) assert.equal(run(`isTireTrackTool('${other}')`), false, other);
});

test('Hộ lan mới vẽ: thẳng, có đủ dữ liệu uốn cong và đánh dấu railStyle', () => {
  const shape = plain(run("makeCurvedTireTrackShape(100, 100, 300, 100, '#111', 2, 'guardrail')"));
  assert.equal(shape.type, 'tire_track');
  assert.equal(shape.railStyle, 'guardrail');
  assert.deepEqual([shape.curveSource.cx, shape.curveSource.cy], [200, 100]); // điểm điều khiển nằm giữa → thẳng
  assert(shape.points.every(p => Math.abs(p.y - 100) < 1e-9));
  assert.equal(run('isCurvedTireTrack(' + JSON.stringify(shape) + ')'), true); // dùng chung tay nắm uốn cong
});

test('Vệt bánh xe vẫn như cũ: cong mặc định và không có railStyle', () => {
  const shape = plain(run("makeCurvedTireTrackShape(100, 100, 300, 100, '#111', 2)"));
  assert.equal(shape.railStyle, undefined);
  assert.notEqual(shape.curveSource.cy, 100);
});

test('Trụ cách đều theo chiều dài, có trụ ở hai đầu, hướng đúng tiếp tuyến', () => {
  const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
  const posts = plain(run('getSceneGuardrailPosts(' + JSON.stringify(points) + ', 20)'));
  assert.equal(posts.length, 6); // 100 / 20 = 5 khoảng → 6 trụ
  assert.deepEqual([posts[0].x, posts.at(-1).x], [0, 100]);
  posts.slice(1).forEach((p, i) => assert.ok(Math.abs(p.x - posts[i].x - 20) < 1e-9));
  assert(posts.every(p => p.angle === 0));
  const diagonal = plain(run('getSceneGuardrailPosts([{x:0,y:0},{x:50,y:50}], 20)'));
  assert(diagonal.every(p => Math.abs(p.angle - Math.PI / 4) < 1e-9));
});

test('Trụ: dữ liệu rỗng/đoạn suy biến không gây lỗi', () => {
  assert.deepEqual(plain(run('getSceneGuardrailPosts([], 20)')), []);
  assert.deepEqual(plain(run('getSceneGuardrailPosts([{x:1,y:1}], 20)')), []);
  assert.deepEqual(plain(run('getSceneGuardrailPosts([{x:1,y:1},{x:1,y:1}], 20)')), []);
  assert.equal(plain(run('getSceneGuardrailPosts([{x:0,y:0},{x:3,y:0}], 20)')).length, 2); // đoạn ngắn: chỉ hai trụ đầu cuối
});

test('Vẽ hộ lan: có nền, hai mép, nắp đầu cuối và trụ; vẽ nhánh riêng không lẫn với vệt bánh xe', () => {
  const shape = run("makeCurvedTireTrackShape(100, 100, 300, 100, '#111', 2, 'guardrail')");
  const ctx = recordingCtx();
  context.__ctx = ctx; context.__shape = shape;
  run('drawTireTrackShape(__ctx, __shape)');
  const names = ctx.calls.map(c => c[0]);
  assert(names.includes('fill'));
  assert(names.includes('closePath'));
  assert(names.filter(n => n === 'fillRect').length >= 2);
  assert(!ctx.calls.some(c => c[0] === 'set:shadowBlur')); // vệt bánh xe mới đặt bóng đổ
  const track = run("makeCurvedTireTrackShape(100, 100, 300, 100, '#111', 2)");
  const ctx2 = recordingCtx(); context.__ctx2 = ctx2; context.__track = track;
  run('drawTireTrackShape(__ctx2, __track)');
  assert(ctx2.calls.some(c => c[0] === 'set:shadowBlur'));
  assert(!ctx2.calls.some(c => c[0] === 'fillRect'));
});

test('Có trong nhóm Hạ tầng & cảnh quan và hiển thị đúng tên', () => {
  const source = read('js/features/scene/runtime.js');
  assert.match(source, /guardrail: '<svg/);
  assert.match(source, /id: 'guardrail', name: 'Hộ lan tôn sóng'/);
  assert.equal(run("getShapeDisplayName({type:'tire_track',railStyle:'guardrail'})"), 'Hộ lan tôn sóng');
  assert.equal(run("getShapeDisplayName({type:'tire_track'})"), 'Vệt bánh xe');
});

test('"Cong +" tạo độ uốn ban đầu cho hộ lan đang thẳng, và không làm gì khi thu nhỏ', () => {
  const shape = run("makeCurvedTireTrackShape(100, 100, 300, 100, '#111', 2, 'guardrail')");
  context.sceneShapes = [shape]; context.selectedShapeId = shape.id;
  context.redrawSceneCanvas = () => {}; context.saveDrawingState = () => {};
  run('adjustSelectedCurveBend(0.8)');
  assert.equal(shape.curveSource.cy, 100);
  run('adjustSelectedCurveBend(1.2)');
  assert.notEqual(shape.curveSource.cy, 100);
  assert.ok(shape.points.some(p => Math.abs(p.y - 100) > 1)); // điểm mẫu đã cong theo
});
