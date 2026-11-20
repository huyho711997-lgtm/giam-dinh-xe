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
    selectedShapeIds: [], currentSceneZoom: 1, genShapeId: () => 'r1'
  });
  for (const f of ['geometry', 'objects', 'traffic-signs', 'rendering', 'interaction-export', 'symbol-legend', 'terrain-assets', 'goods-assets', 'building-assets', 'bridge-assets', 'vehicle-assets', 'road-assets']) vm.runInContext(read(f + '.js'), context);
  const log = [];
  context.ctx = new Proxy({ measureText: t => ({ width: String(t).length * 6 }) }, {
    get(t, p) { return p in t ? t[p] : (...a) => { log.push([p, ...a]); }; },
    set(t, p, v) { t[p] = v; return true; }
  });
  return { log, run: code => vm.runInContext(code, context) };
}

const TYPES = ['road_arrow_straight', 'road_arrow_left', 'road_arrow_right', 'road_arrow_uturn', 'traffic_island', 'roundabout', 'railway', 'rail_barrier', 'sidewalk', 'ditch', 'culvert'];
const draw = (type, w, h) => `drawSceneryAsset(ctx, '${type}', 0, 0, '#000', 1.5, ${w}, ${h}, { id: 'r1', type: '${type}' })`;

test('ký hiệu đường bộ là vật cảnh quan: có tên, tỉ lệ, cỡ tối thiểu/thu nhỏ hợp lý', () => {
  const { run } = load();
  for (const type of TYPES) {
    const spec = run(`getSceneRoadAssetSpec('${type}')`);
    assert.ok(spec && spec.name, type);
    assert.equal(run(`isSceneryAssetType('${type}')`), true, type);
    assert.equal(run(`isVehicleShape({ type: '${type}' })`), true, type + ' dùng chung chọn/xoay/co giãn');
    assert.equal(run(`getShapeDisplayName({ type: '${type}' })`), spec.name);
    assert.equal(run(`getSceneryAspectRatio('${type}')`), spec.aspect);
    assert.equal(run(`getSceneryMinimumLength('${type}')`), spec.minLength);
    assert.equal(run(`getSceneryResizeMinLength('${type}')`), spec.resizeMin);
    assert.ok(spec.resizeMin <= spec.minLength, type);
    const d = run(`getVehicleDimensions({ type: '${type}' })`);
    assert.equal(d.w, spec.minLength);
    assert.ok(Math.abs(d.h - d.w * spec.aspect) < 1e-9, type);
  }
  assert.equal(run("getSceneRoadAssetSpec('bus')"), null);
  assert.equal(run("getSceneExtraAssetSpec('bus').name"), 'Xe khách / buýt', 'tra cứu chung vẫn thấy xe');
  assert.equal(run("getSceneExtraAssetSpec('bridge')"), null);
  assert.equal(run("getShapeDisplayName({ type: 'khong_co' })"), 'Đối tượng');
});

test('tuyến dài (đường sắt, vỉa hè, mương) dài và hẹp; vòng xuyến tròn; mũi tên rẽ rộng hơn mũi tên thẳng', () => {
  const { run } = load();
  for (const t of ['railway', 'sidewalk', 'ditch']) assert.ok(run(`getSceneryAspectRatio('${t}')`) <= 0.15, t);
  assert.equal(run("getSceneryAspectRatio('roundabout')"), 1);
  assert.ok(run("getSceneryAspectRatio('road_arrow_left')") > run("getSceneryAspectRatio('road_arrow_straight')"));
});

test('vẽ từng ký hiệu: save/restore cân bằng, có nét vẽ, nằm trong khung (trừ dung sai nét)', () => {
  for (const type of TYPES) {
    const { log, run } = load();
    const w = run(`getSceneryMinimumLength('${type}')`) * 1.4;
    const h = w * run(`getSceneryAspectRatio('${type}')`);
    run(draw(type, w, h));
    const count = n => log.filter(c => c[0] === n).length;
    assert.equal(count('save'), count('restore'), type + ': save/restore lệch');
    assert.ok(count('stroke') + count('fill') + count('strokeRect') + count('fillRect') >= 2, type + ': không có nét vẽ');
    for (const c of log.filter(c => ['moveTo', 'lineTo', 'rect', 'strokeRect', 'fillRect'].includes(c[0]))) {
      const [x, y] = [c[1], c[2]];
      assert.ok(Math.abs(x) <= w / 2 + 6 && Math.abs(y) <= h / 2 + 6, `${type}: điểm (${x.toFixed(1)}, ${y.toFixed(1)}) vượt khung ${w.toFixed(0)}×${h.toFixed(0)}`);
    }
  }
});

test('mũi tên rẽ: đầu mũi tên nằm đúng phía (trái = lên, phải = xuống) khi đầu xe hướng +x', () => {
  const tipY = type => {
    const { log, run } = load();
    run(draw(type, 48, 30));
    // Đầu mũi tên là tam giác đặc vẽ sau cùng: moveTo cuối cùng chính là đỉnh.
    return log.filter(c => c[0] === 'moveTo').at(-1)[2];
  };
  assert.ok(tipY('road_arrow_left') < 0, 'rẽ trái hướng lên');
  assert.ok(tipY('road_arrow_right') > 0, 'rẽ phải hướng xuống');
});

test('đường sắt có số tà vẹt tăng theo chiều dài; vòng xuyến có 4 mũi tên; thanh chắn tàu có sọc', () => {
  const ties = w => { const { log, run } = load(); run(draw('railway', w, w * 0.1)); return log.filter(c => c[0] === 'moveTo').length; };
  assert.ok(ties(400) > ties(150) + 10);
  const ra = load();
  ra.run(draw('roundabout', 150, 150));
  assert.ok(ra.log.filter(c => c[0] === 'closePath').length >= 4, '4 đầu mũi tên tam giác');
  assert.ok(ra.log.some(c => c[0] === 'arc'), 'vòng tròn');
  const rb = load();
  rb.run(draw('rail_barrier', 90, 12));
  assert.ok(rb.log.filter(c => c[0] === 'fillRect').length >= 3, 'cần chắn có sọc');
});

test('road-assets.js được nạp ở cả hai trang, sau interaction-export (nơi gọi drawSceneRoadAsset)', () => {
  for (const page of ['index.html', 'so-do-hien-truong.html']) {
    const html = fs.readFileSync(new URL('../' + page, import.meta.url), 'utf8');
    const order = [...html.matchAll(/scene\/([a-z-]+)\.js\?v=/g)].map(m => m[1]);
    assert.ok(order.includes('road-assets'), page);
    assert.ok(order.indexOf('road-assets') > order.indexOf('interaction-export'), page);
  }
});
