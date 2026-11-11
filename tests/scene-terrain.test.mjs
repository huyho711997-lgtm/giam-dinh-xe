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
  for (const f of ['geometry', 'objects', 'traffic-signs', 'rendering', 'interaction-export', 'terrain-assets']) {
    vm.runInContext(read(f + '.js'), context);
  }
  const log = [];
  const ctx = new Proxy({ measureText: t => ({ width: String(t).length * 6 }) }, {
    get(target, prop) { return prop in target ? target[prop] : (...args) => { log.push([prop, ...args]); }; },
    set(target, prop, value) { target[prop] = value; return true; }
  });
  context.ctx = ctx;
  return { context, log, run: code => vm.runInContext(code, context) };
}

const shape = (type, extra = {}) => ({ id: 's1', type, startX: 10, startY: 10, angle: 0, objectW: 200, objectH: 120, color: '#000000', width: 1.5, sizeScale: 1, ...extra });
const CUSTOM = [[0.02, 0.7], [0.2, 0.25], [0.5, 0.02], [0.85, 0.2], [0.98, 0.6], [0.8, 0.95], [0.4, 0.98], [0.1, 0.9]];

test('đăng ký loại mới: nhận diện scenery, tỷ lệ, cỡ tối thiểu, tên hiển thị', () => {
  const { run } = load();
  for (const type of ['rock_field', 'hill']) {
    assert.equal(run(`isSceneryAssetType('${type}')`), true, type);
    assert.equal(run(`isVehicleShape({ type: '${type}' })`), true, 'đi theo luồng chọn/di chuyển/xoay/kéo giãn của vật cảnh');
    assert.ok(run(`getSceneryMinimumLength('${type}')`) >= 60);
    assert.ok(run(`getSceneryAspectRatio('${type}')`) > 0.5);
    assert.equal(run(`isSceneTerrainType('${type}')`), true);
  }
  assert.equal(run("getShapeDisplayName({ type: 'rock_field' })"), 'Bãi đá');
  assert.equal(run("getShapeDisplayName({ type: 'hill' })"), 'Đồi núi');
  assert.equal(run("isSceneTerrainType('forest')"), false);
});

test('công cụ, icon và vùng có ranh giới được đấu nối', () => {
  const runtime = read('runtime.js');
  assert.match(runtime, /id: 'rock_field', name: 'Bãi đá'/);
  assert.match(runtime, /id: 'hill', name: 'Đồi núi'/);
  assert.match(runtime, /\n  rock_field: '<svg/);
  assert.match(runtime, /\n  hill: '<svg/);
  assert.match(read('scene-editor-ui.js'), /SCENE_AREA_SHAPE_TYPES = \[[^\]]*'rock_field'[^\]]*'hill'[^\]]*\]/);
  assert.match(read('objects.js'), /areaShape: currentDrawTool === 'hill' \? 'natural' : undefined/);
  assert.match(read('interaction-export.js'), /drawSceneryTerrain\(ctx, type, x, y, color, width, w, h, shapeData\)/);
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /scene\/terrain-assets\.js/);
});

test('vẽ qua drawSceneryAsset: bãi đá sinh đá, đồi núi sinh đường đồng mức; không ném lỗi', () => {
  const { context, log, run } = load();
  context.rock = shape('rock_field');
  run("drawSceneryAsset(ctx, 'rock_field', 110, 70, '#000000', 1.5, 200, 120, rock)");
  const rockPolys = log.filter(c => c[0] === 'closePath').length;
  assert.ok(rockPolys > 10, 'có nhiều khối đá: ' + rockPolys);
  log.length = 0;
  context.hill = shape('hill', { areaShape: 'natural' });
  run("drawSceneryAsset(ctx, 'hill', 110, 70, '#000000', 1.5, 200, 120, hill)");
  const closes = log.filter(c => c[0] === 'closePath').length;
  assert.ok(closes >= 4, 'có đường đồng mức lồng nhau: ' + closes);
  assert.ok(log.some(c => c[0] === 'fillText' && c[1] === 'ĐỒI NÚI'));
});

test('ổn định: cùng id thì cùng hình, khác id thì khác; kéo rộng thì thêm đá', () => {
  const { context, log, run } = load();
  const draw = (s, w, h) => { log.length = 0; context.s = s; run(`drawSceneryAsset(ctx, s.type, 110, 70, '#000000', 1.5, ${w}, ${h}, s)`); return JSON.stringify(log); };
  assert.equal(draw(shape('rock_field'), 200, 120), draw(shape('rock_field'), 200, 120));
  assert.notEqual(draw(shape('rock_field', { id: 'a' }), 200, 120), draw(shape('rock_field', { id: 'b' }), 200, 120));
  const small = (draw(shape('rock_field'), 90, 60).match(/closePath/g) || []).length;
  const large = (draw(shape('rock_field'), 320, 200).match(/closePath/g) || []).length;
  assert.ok(large > small * 2, `đá tăng theo diện tích: ${small} → ${large}`);
});

test('ranh giới tự vẽ: đá chỉ nằm trong vùng; nhãn tùy chỉnh được dùng', () => {
  const { context, log, run } = load();
  context.s = shape('rock_field', { areaShape: 'custom', areaOutline: CUSTOM, areaLabel: 'KHỐI ĐÁ LỚN' });
  run("drawSceneryAsset(ctx, 'rock_field', 110, 70, '#000000', 1.5, 200, 120, s)");
  assert.ok(log.some(c => c[0] === 'fillText' && c[1] === 'KHỐI ĐÁ LỚN'));
  const left = 10, top = 10;
  const poly = JSON.parse(run('JSON.stringify(getSceneryAreaOutline(s, 10, 10, 200, 120))'));
  assert.ok(poly.length >= 8);
  // Mọi điểm moveTo thuộc một khối đá (sau viền vùng) phải nằm trong vùng.
  const moves = log.filter(c => c[0] === 'moveTo').slice(1).map(c => ({ x: c[1], y: c[2] }));
  assert.ok(moves.length > 5);
  context.poly = poly;
  moves.forEach(p => { context.p = p; assert.equal(run('scenePointInPolygon(p.x, p.y, poly)'), true, JSON.stringify(p)); });
});

test('vùng quá nhỏ hoặc dữ liệu thiếu không gây lỗi', () => {
  const { context, run } = load();
  context.t1 = shape('hill', { objectW: 60, objectH: 30 });
  assert.doesNotThrow(() => run("drawSceneryAsset(ctx, 'hill', 40, 25, '#000000', 1.5, 8, 5, t1)"));
  assert.doesNotThrow(() => run("drawSceneryAsset(ctx, 'rock_field', 40, 25, '#000000', 1.5, 8, 5, null)"));
  assert.doesNotThrow(() => run("drawSceneryAsset(ctx, 'hill', 40, 25, '#000000', 1.5, 100, 60, { id: 'x', areaShape: 'custom', areaOutline: [[0,0]] })"));
});

test('bảng Ký hiệu nhận ra loại mới', () => {
  const { context, run } = load();
  vm.runInContext(read('symbol-legend.js'), context);
  context.shapes = [shape('rock_field'), shape('hill')];
  assert.equal(run('buildSceneSymbolLegendEntries(shapes, getShapeDisplayName).map(e => e.label).join("|")'), 'Bãi đá|Đồi núi');
});
