import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const context = vm.createContext({ Math, Number, Array, JSON, console });
for (const file of ['js/features/scene/traffic-signs.js', 'js/features/scene/interaction-export.js', 'js/features/scene/rendering.js']) {
  vm.runInContext(read(file), context, { filename: file });
}
const run = code => vm.runInContext(code, context);

// Ngữ cảnh vẽ ghi lại các lệnh để kiểm tra hình chữ nhật được vẽ đúng khung.
function recordingCtx() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (_, name) => name === 'calls' ? calls : (...args) => { calls.push([String(name), ...args]); },
    set: (_, name, value) => { calls.push(['set:' + String(name), value]); return true; }
  });
  return ctx;
}

test('geo_rect thuộc nhóm hình cảnh quan nên dùng chung chọn/kéo/xoay/co giãn', () => {
  assert.equal(run("isSceneryAssetType('geo_rect')"), true);
  assert.equal(run("isSceneryAssetShape({type:'geo_rect'})"), true);
  assert.equal(run("isVehicleShape({type:'geo_rect'})"), true);
  assert.equal(run("isSizeAdjustableShape({type:'geo_rect'})"), true);
});

test('Kích thước mặc định, tối thiểu và chiều rộng/dài độc lập', () => {
  assert.equal(run("getSceneryAspectRatio('geo_rect')"), 0.6);
  assert.equal(run("getSceneryMinimumLength('geo_rect')"), 30);
  const d = JSON.parse(JSON.stringify(run("getVehicleDimensions({type:'geo_rect',objectW:100,objectH:60})")));
  assert.deepEqual(d, { w: 100, h: 60 });
  const tall = JSON.parse(JSON.stringify(run("getVehicleDimensions({type:'geo_rect',objectW:40,objectH:200})")));
  assert.deepEqual(tall, { w: 40, h: 200 });
  assert.equal(run("getShapeDisplayName({type:'geo_rect'})"), 'Hình chữ nhật');
});

test('Có trong bảng công cụ nhóm Hình học & Biển báo, ngay sau hình tròn', () => {
  const source = read('js/features/scene/runtime.js');
  const group = source.slice(source.indexOf('shape_symbols: {'), source.indexOf('scene_object: {'));
  const order = [...group.matchAll(/id: '(geo_\w+)'/g)].map(m => m[1]);
  assert.deepEqual(order.slice(0, 3), ['geo_circle', 'geo_rect', 'geo_triangle']);
  assert.match(source, /geo_rect: '<svg/);
});

test('Vẽ đúng khung w × h quanh tâm, góc vuông, có nền và viền', () => {
  const ctx = recordingCtx();
  context.__ctx = ctx;
  run("drawSceneryAsset(__ctx, 'geo_rect', 100, 50, '#111', 2, 80, 48)");
  const rect = ctx.calls.find(c => c[0] === 'rect');
  assert.deepEqual(rect, ['rect', 60, 26, 80, 48]); // left = 100 - 40, top = 50 - 24
  assert(ctx.calls.some(c => c[0] === 'set:lineJoin' && c[1] === 'miter'));
  assert(ctx.calls.some(c => c[0] === 'fill'));
  assert(ctx.calls.some(c => c[0] === 'stroke'));
});
