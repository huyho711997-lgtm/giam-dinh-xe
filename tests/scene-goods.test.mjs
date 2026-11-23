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
    sceneShapes: [], sceneTemplateMeta: null, SCENE_LOGICAL_WIDTH: 1000, SCENE_LOGICAL_HEIGHT: 700,
    genShapeId: (() => { let n = 0; return () => ++n; })()
  });
  for (const f of ['geometry', 'objects', 'traffic-signs', 'rendering', 'interaction-export', 'terrain-assets', 'goods-assets']) vm.runInContext(read(f + '.js'), context);
  const log = [];
  context.ctx = new Proxy({ measureText: t => ({ width: String(t).length * 6 }) }, {
    get(t, p) { return p in t ? t[p] : (...a) => { log.push([p, ...a]); }; },
    set(t, p, v) { t[p] = v; return true; }
  });
  return { log, run: code => vm.runInContext(code, context) };
}
const shape = (type, extra = {}) => JSON.stringify({ id: 'g1', type, startX: 10, startY: 10, angle: 0, objectW: 220, objectH: 100, color: '#000000', width: 1.5, sizeScale: 1, ...extra });

test('đăng ký công cụ hàng hóa', () => {
  const { run } = load();
  for (const t of ['goods_display', 'goods_damaged']) {
    assert.equal(run(`isSceneryAssetType('${t}')`), true);
    assert.equal(run(`isSceneGoodsType('${t}')`), true);
    assert.ok(run(`getSceneryMinimumLength('${t}')`) >= 50);
  }
  assert.equal(run("getShapeDisplayName({ type: 'goods_display' })"), 'Hàng hóa trưng bày');
  assert.equal(run("getShapeDisplayName({ type: 'goods_damaged' })"), 'Hàng hóa đổ vỡ');
  const runtime = read('runtime.js');
  assert.match(runtime, /id: 'goods_display', name: 'Hàng hóa trưng bày'/);
  assert.match(runtime, /\n  goods_damaged: '<svg/);
  assert.match(read('scene-editor-ui.js'), /'goods_display', 'goods_damaged'/);
  assert.match(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), /scene\/goods-assets\.js\?v=/);
});

test('vẽ được: trưng bày có nhiều món hàng, đổ vỡ có gạch chéo nét đứt; kéo rộng thì thêm hàng', () => {
  for (const t of ['goods_display', 'goods_damaged']) {
    const { log, run } = load();
    run(`drawSceneryAsset(ctx, ${shape(t)}.type, 120, 60, '#000', 1.5, 220, 100, ${shape(t)})`);
    const items = log.filter(c => c[0] === 'translate').length;
    assert.ok(items >= 8, `${t}: ${items}`);
    if (t === 'goods_damaged') { assert.ok(log.some(c => c[0] === 'setLineDash')); assert.ok(log.some(c => c[0] === 'clip')); }
    const big = load();
    big.run(`drawSceneryAsset(ctx, '${t}', 240, 100, '#000', 1.5, 440, 100, ${shape(t, { objectW: 440 })})`);
    assert.ok(big.log.filter(c => c[0] === 'translate').length > items);
  }
});

test('ranh giới tự vẽ: hàng nằm trong vùng, không ném lỗi', () => {
  const { run } = load();
  const outline = [[0.05, 0.5], [0.4, 0.05], [0.95, 0.3], [0.8, 0.95], [0.2, 0.9]].map(([x, y]) => ({ x, y }));
  run(`drawSceneryAsset(ctx, 'goods_damaged', 120, 60, '#000', 1.5, 220, 100, ${shape('goods_damaged', { areaShape: 'custom', areaOutline: outline })})`);
});

test('vùng nhỏ vẫn hiện chi tiết từng món (bước lưới thu theo cạnh ngắn, nhãn mặc định nhường chỗ)', () => {
  const { run } = load();
  const layout = (w, h, extra = '{}') => run(`(function () {
    var s = Object.assign({ id: 'g1', type: 'goods_damaged' }, ${extra});
    var left = -${w} / 2, top = -${h} / 2;
    var area = getSceneTerrainPolygon(s, left, top, ${w}, ${h});
    return resolveSceneGoodsLayout(ctx, area, left, top, ${w}, ${h}, Math.max(14, Math.min(24, ${h} * 0.22)), { x: 0, y: 0 }, s, 'HÀNG HÓA ĐỔ VỠ', 0.55);
  })()`);
  for (const [w, h] of [[130, 40], [110, 30], [90, 24], [70, 70], [60, 36]]) {
    const r = layout(w, h);
    assert.ok(r.slots.length >= 6, `${w}x${h} chỉ có ${r.slots.length} món`);
    assert.ok(r.step >= 9);
  }
  // Vùng rất nhỏ: nhãn mặc định bị bỏ để nhường chỗ cho hàng.
  assert.equal(layout(110, 30).label, null);
  // Vùng lớn: giữ nhãn và cỡ ô như cũ.
  const big = layout(220, 100);
  assert.ok(big.label);
  assert.ok(big.step >= 20);
  // Nhãn do người dùng đặt luôn được giữ.
  assert.ok(layout(130, 56, "{ areaLabel: 'KHO A' }").label);
});

test('vùng nhỏ vẽ ra có nhiều nét món hàng, không chỉ gạch chéo', () => {
  const { log, run } = load();
  run(`drawSceneryAsset(ctx, 'goods_damaged', 200, 100, '#000', 1.5, 110, 30, { id: 'g1', type: 'goods_damaged' })`);
  assert.ok(log.filter(c => c[0] === 'arc').length >= 6, 'phải có các món hình tròn');
});
