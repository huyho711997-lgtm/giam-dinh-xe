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
    selectedShapeIds: [], currentSceneZoom: 1, genShapeId: () => 'b1'
  });
  for (const f of ['geometry', 'objects', 'traffic-signs', 'rendering', 'interaction-export', 'symbol-legend', 'terrain-assets', 'goods-assets', 'building-assets', 'bridge-assets']) vm.runInContext(read(f + '.js'), context);
  const log = [];
  context.ctx = new Proxy({ measureText: t => ({ width: String(t).length * 6 }) }, {
    get(t, p) { return p in t ? t[p] : (...a) => { log.push([p, ...a]); }; },
    set(t, p, v) { t[p] = v; return true; }
  });
  return { log, run: code => vm.runInContext(code, context) };
}
const bridge = (w, h, extra = '') => `drawSceneryAsset(ctx, 'bridge', 0, 0, '#000', 1.5, ${w}, ${h}, { id: 'b1', type: 'bridge'${extra} })`;

test('cầu là vật cảnh quan: có tên "Cầu", tỉ lệ thon, cỡ tối thiểu riêng khi vẽ và khi thu nhỏ', () => {
  const { run } = load();
  assert.equal(run("isSceneryAssetType('bridge')"), true);
  assert.equal(run("getShapeDisplayName({ type: 'bridge' })"), 'Cầu');
  assert.equal(run("getSceneryAspectRatio('bridge')"), run('SCENE_BRIDGE_ASPECT'));
  assert.equal(run("getSceneryMinimumLength('bridge')"), run('SCENE_BRIDGE_MIN_LENGTH'));
  assert.equal(run("getSceneryResizeMinLength('bridge')"), run('SCENE_BRIDGE_RESIZE_MIN_LENGTH'));
  assert.ok(run('SCENE_BRIDGE_RESIZE_MIN_LENGTH') < run('SCENE_BRIDGE_MIN_LENGTH'), 'thu nhỏ tay được nhỏ hơn cỡ mặc định');
  assert.ok(run('SCENE_BRIDGE_ASPECT') < 0.3, 'cầu dài và hẹp, không vuông như hộp');
  // Chưa có kích thước riêng → lấy cỡ mặc định, bề rộng = dài × tỉ lệ.
  const d = run("getVehicleDimensions({ type: 'bridge' })");
  assert.equal(d.w, run('SCENE_BRIDGE_MIN_LENGTH'));
  assert.ok(Math.abs(d.h - d.w * run('SCENE_BRIDGE_ASPECT')) < 1e-9);
  // Có objectW/objectH do tay nắm đặt thì giữ đúng.
  assert.deepEqual({ ...run("getVehicleDimensions({ type: 'bridge', objectW: 300, objectH: 40 })") }, { w: 300, h: 40 });
});

test('số trụ cầu tăng theo chiều dài, tối đa 5', () => {
  const { run } = load();
  assert.deepEqual([60, 100, 180, 270, 360, 5000].map(w => run(`getSceneBridgePierCount(${w})`)), [0, 0, 1, 2, 3, 5]);
});

test('vẽ cầu: hai lan can, mố hai đầu, chỉ là nét (không tô nền che xe bên dưới)', () => {
  const { log, run } = load();
  run(bridge(300, 66, ", areaLabel: ''"));
  const lines = log.filter(c => c[0] === 'lineTo');
  // Lan can trên/dưới (nét ngoài) phải dài đúng bằng chiều dài cầu.
  assert.ok(lines.some(c => c[1] === 150 && c[2] === -33), 'lan can trên');
  assert.ok(lines.some(c => c[1] === 150 && c[2] === 33), 'lan can dưới');
  // Mố cầu: đường ngang ở x = ±150 chạy hết bề rộng + nhô ra.
  assert.ok(lines.some(c => c[1] === -150 && c[2] > 33), 'mố trái');
  assert.ok(lines.some(c => c[1] === 150 && c[2] > 33), 'mố phải');
  assert.ok(log.some(c => c[0] === 'strokeRect'), 'trụ cầu');
  assert.equal(log.filter(c => c[0] === 'fillRect').length, 0);
});

test('vẽ cầu nhỏ: không đủ chỗ cho tên nên bỏ tên, vẫn vẽ nét bình thường', () => {
  const { log, run } = load();
  run(bridge(60, 14));
  assert.equal(log.filter(c => c[0] === 'fillText').length, 0);
  assert.ok(log.some(c => c[0] === 'stroke'));
});

test('tên cầu: mặc định "CẦU", người dùng đặt tên thì dùng tên đó', () => {
  const a = load();
  a.run(bridge(300, 66));
  assert.ok(a.log.some(c => c[0] === 'fillText' && c[1] === 'CẦU'));
  const b = load();
  b.run(bridge(300, 66, ", areaLabel: 'CẦU 14'"));
  assert.ok(b.log.some(c => c[0] === 'fillText' && c[1] === 'CẦU 14'));
  assert.ok(!b.log.some(c => c[0] === 'fillText' && c[1] === 'CẦU'));
  assert.match(read('scene-editor-ui.js'), /SCENE_AREA_LABEL_DEFAULTS = \{[^}]*bridge: 'CẦU'/);
});

test('bảng Ký hiệu có dòng "Cầu" (gộp nhiều cầu thành một dòng)', () => {
  const { run } = load();
  const entries = run("buildSceneSymbolLegendEntries([{ type: 'bridge', id: 'a' }, { type: 'bridge', id: 'b' }, { type: 'house', id: 'c' }], getShapeDisplayName, null, false)");
  const bridgeEntry = entries.find(e => e.key === 'Cầu');
  assert.ok(bridgeEntry);
  assert.equal(bridgeEntry.count, 2);
});

test('công cụ "Cầu" nằm trong nhóm Hạ tầng đường bộ, có biểu tượng, và trang độc lập nạp bridge-assets.js', () => {
  const runtime = read('runtime.js');
  const group = runtime.slice(runtime.indexOf('road_assets: {'), runtime.indexOf('landscape: {'));
  assert.match(group, /\{ id: 'bridge', name: 'Cầu'/);
  assert.match(runtime, /^\s+bridge: '<svg/m);
  for (const page of ['index.html', 'so-do-hien-truong.html']) {
    const html = fs.readFileSync(new URL('../' + page, import.meta.url), 'utf8');
    const order = [...html.matchAll(/scene\/([a-z-]+)\.js\?v=/g)].map(m => m[1]);
    assert.ok(order.indexOf('bridge-assets') > order.indexOf('interaction-export'), page + ': nạp sau interaction-export (nơi gọi drawSceneBridge)');
    assert.ok(order.includes('bridge-assets'), page);
  }
});
