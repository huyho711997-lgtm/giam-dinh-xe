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
    selectedShapeIds: [], currentSceneZoom: 1, genShapeId: () => 'v1'
  });
  for (const f of ['geometry', 'objects', 'traffic-signs', 'rendering', 'interaction-export', 'symbol-legend', 'terrain-assets', 'goods-assets', 'building-assets', 'bridge-assets', 'vehicle-assets']) vm.runInContext(read(f + '.js'), context);
  const log = [];
  context.ctx = new Proxy({ measureText: t => ({ width: String(t).length * 6 }) }, {
    get(t, p) { return p in t ? t[p] : (...a) => { log.push([p, ...a]); }; },
    set(t, p, v) { t[p] = v; return true; }
  });
  return { log, run: code => vm.runInContext(code, context) };
}

const TYPES = ['bus', 'pickup', 'ambulance', 'tow_truck', 'bicycle'];
const NAMES = { bus: 'Xe khách / buýt', pickup: 'Xe bán tải', ambulance: 'Xe cứu thương', tow_truck: 'Xe cứu hộ', bicycle: 'Xe đạp' };
const draw = (type, w, h, extra = '') => `drawSceneryAsset(ctx, '${type}', 0, 0, '#000', 1.5, ${w}, ${h}, { id: 'v1', type: '${type}'${extra} })`;

test('xe mới là vật cảnh quan: có tên, tỉ lệ, cỡ tối thiểu khi vẽ và khi thu nhỏ hợp lý', () => {
  const { run } = load();
  for (const type of TYPES) {
    assert.equal(run(`isSceneryAssetType('${type}')`), true, type);
    assert.equal(run(`isVehicleShape({ type: '${type}' })`), true, type + ' dùng chung chọn/xoay/co giãn của xe');
    assert.equal(run(`getShapeDisplayName({ type: '${type}' })`), NAMES[type]);
    const spec = run(`getSceneVehicleSpec('${type}')`);
    assert.equal(run(`getSceneryAspectRatio('${type}')`), spec.aspect);
    assert.equal(run(`getSceneryMinimumLength('${type}')`), spec.minLength);
    assert.equal(run(`getSceneryResizeMinLength('${type}')`), spec.resizeMin);
    assert.ok(spec.resizeMin <= spec.minLength, type);
    assert.ok(spec.aspect > 0.2 && spec.aspect < 0.6, type);
    const d = run(`getVehicleDimensions({ type: '${type}' })`);
    assert.equal(d.w, spec.minLength);
    assert.ok(Math.abs(d.h - d.w * spec.aspect) < 1e-9);
  }
  assert.equal(run("isSceneVehicleType('truck')"), false, 'xe tải giữ cách vẽ riêng');
  assert.equal(run("getSceneVehicleSpec('bridge')"), null);
});

test('xe khách dài hơn ô tô con và xe đạp nhỏ hơn xe máy (kích thước tương quan hiện trường)', () => {
  const { run } = load();
  assert.ok(run("getSceneryMinimumLength('bus')") > run("getVehicleDimensions({ type: 'car' }).w") * 2);
  assert.ok(run("getSceneryMinimumLength('bicycle')") >= run("getVehicleDimensions({ type: 'bike' }).w") - 1);
  assert.ok(run("getSceneryMinimumLength('pickup')") > run("getVehicleDimensions({ type: 'car' }).w"));
});

test('vẽ từng loại xe: cân bằng save/restore, có nét vẽ, nằm trong khung w × h quanh tâm', () => {
  for (const type of TYPES) {
    const { log, run } = load();
    const w = run(`getSceneryMinimumLength('${type}')`) * 1.5;
    const h = w * run(`getSceneryAspectRatio('${type}')`);
    run(draw(type, w, h));
    const count = n => log.filter(c => c[0] === n).length;
    assert.equal(count('save'), count('restore'), type + ': save/restore lệch');
    assert.ok(count('stroke') + count('strokeRect') >= 2, type + ': không có nét vẽ');
    for (const c of log.filter(c => ['moveTo', 'lineTo', 'strokeRect', 'rect'].includes(c[0]))) {
      const [x, y] = [c[1], c[2]];
      // Bánh xe cố ý nhô ra ngoài thân một chút (như ô tô con) nên cho dung sai bằng bề dày bánh.
      assert.ok(Math.abs(x) <= w / 2 + 8 && Math.abs(y) <= h / 2 + 8, `${type}: điểm (${x}, ${y}) vượt khung`);
    }
  }
});

test('xe có bánh thì vẽ bánh; xe cứu thương có dấu thập; xe đạp có ghi-đông', () => {
  for (const type of ['bus', 'pickup', 'ambulance', 'tow_truck']) {
    const { log, run } = load();
    const w = run(`getSceneryMinimumLength('${type}')`) * 1.5;
    run(draw(type, w, w * run(`getSceneryAspectRatio('${type}')`)));
    assert.ok(log.some(c => c[0] === 'fill') || log.some(c => c[0] === 'quadraticCurveTo' || c[0] === 'arcTo' || c[0] === 'arc'), type + ': thiếu bánh xe');
  }
  const amb = load();
  amb.run(draw('ambulance', 69, 29));
  const crossLines = amb.log.filter(c => c[0] === 'moveTo').length;
  assert.ok(crossLines >= 4, 'xe cứu thương cần dấu thập (≥ 2 đoạn) ngoài khung và mũi xe');
  const bike = load();
  bike.run(draw('bicycle', 36, 11.5));
  assert.ok(bike.log.filter(c => c[0] === 'moveTo').length >= 2, 'xe đạp: khung + ghi-đông');
});

test('nét đứt: xe đặt dashed thì dùng setLineDash có phần tử, xe nét liền thì không', () => {
  for (const type of TYPES) {
    const solid = load();
    solid.run(draw(type, 100, 40));
    assert.ok(!solid.log.some(c => c[0] === 'setLineDash' && Array.isArray(c[1]) && c[1].length > 0), type + ': nét liền không được có nét đứt');
    const dashed = load();
    dashed.run(draw(type, 100, 40, ', dashed: true'));
    assert.ok(dashed.log.some(c => c[0] === 'setLineDash' && Array.isArray(c[1]) && c[1].length > 0), type + ': không có nét đứt');
  }
  const { run } = load();
  for (const t of ['truck', 'bus', 'pickup', 'ambulance', 'tow_truck', 'bicycle']) assert.equal(run(`isSceneDashableVehicleType('${t}')`), true, t);
  assert.equal(run("isSceneDashableVehicleType('bridge')"), false);
});

test('vehicle-assets.js được nạp ở cả hai trang, sau interaction-export (nơi gọi drawSceneVehicle)', () => {
  for (const page of ['index.html', 'so-do-hien-truong.html']) {
    const html = fs.readFileSync(new URL('../' + page, import.meta.url), 'utf8');
    const order = [...html.matchAll(/scene\/([a-z-]+)\.js\?v=/g)].map(m => m[1]);
    assert.ok(order.includes('vehicle-assets'), page);
    assert.ok(order.indexOf('vehicle-assets') > order.indexOf('interaction-export'), page);
  }
});
