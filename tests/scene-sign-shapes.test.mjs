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
    selectedShapeIds: [], currentSceneZoom: 1, genShapeId: () => 's1'
  });
  for (const f of ['geometry', 'objects', 'traffic-signs', 'rendering', 'interaction-export', 'symbol-legend', 'terrain-assets', 'goods-assets', 'building-assets', 'bridge-assets', 'vehicle-assets']) vm.runInContext(read(f + '.js'), context);
  const log = [];
  context.ctx = new Proxy({ measureText: t => ({ width: String(t).length * 6 }) }, {
    get(t, p) { return p in t ? t[p] : (...a) => { log.push([p, ...a]); }; },
    set(t, p, v) { t[p] = v; return true; }
  });
  return { log, run: code => vm.runInContext(code, context) };
}
const NEW_TYPES = ['sign_square_post', 'sign_rect_post', 'sign_octagon_post'];
const ALL = ['sign_circle_post', 'sign_triangle_post', ...NEW_TYPES];
const draw = (type, extra = '') => `drawSceneryAsset(ctx, '${type}', 0, 0, '#000', 1.5, 60, 37, { id: 's1', type: '${type}'${extra} })`;
const texts = log => log.filter(c => c[0] === 'fillText').map(c => c[1]);

test('biển mới là biển có trụ: dùng chung vẽ/chọn/sửa nội dung, có tên và cỡ như biển cũ', () => {
  const { run } = load();
  for (const type of ALL) {
    assert.equal(run(`isTrafficSignPostType('${type}')`), true, type);
    assert.equal(run(`isSceneryAssetType('${type}')`), true, type);
    assert.equal(run(`getSceneryMinimumLength('${type}')`), 42, type);
    assert.ok(run(`getSceneryAspectRatio('${type}')`) >= 0.6, type);
  }
  assert.equal(run("getShapeDisplayName({ type: 'sign_square_post' })"), 'Biển báo vuông có trụ');
  assert.equal(run("getShapeDisplayName({ type: 'sign_rect_post' })"), 'Biển báo chữ nhật có trụ');
  assert.equal(run("getShapeDisplayName({ type: 'sign_octagon_post' })"), 'Biển STOP bát giác có trụ');
  assert.equal(run("isTrafficSignPostType('truck')"), false);
});

test('nội dung mặc định: tròn = tốc độ, tam giác = giao nhau, bát giác = STOP, vuông = "P", chữ nhật = "QL14"', () => {
  const { run } = load();
  assert.equal(run("getTrafficSignDefaultKind('sign_circle_post')"), 'speed_limit');
  assert.equal(run("getTrafficSignDefaultKind('sign_triangle_post')"), 'intersection_non_priority');
  assert.equal(run("getTrafficSignDefaultKind('sign_octagon_post')"), 'stop');
  assert.equal(run("getTrafficSignDefaultKind('sign_square_post')"), 'custom');
  assert.equal(run("getTrafficSignDefaultKind('sign_rect_post')"), 'custom');
  assert.equal(run("getTrafficSignDefaultLabel('sign_square_post')"), 'P');
  assert.equal(run("getTrafficSignDefaultLabel('sign_rect_post')"), 'QL14');
  assert.equal(run("getTrafficSignDefaultLabel('sign_circle_post')"), '');
});

test('vẽ biển: bát giác ghi STOP một lần, vuông/chữ nhật ghi nhãn mặc định hoặc nhãn người dùng đặt', () => {
  const octa = load();
  octa.run(draw('sign_octagon_post'));
  assert.deepEqual(texts(octa.log), ['STOP']);
  const sq = load();
  sq.run(draw('sign_square_post'));
  assert.deepEqual(texts(sq.log), ['P']);
  const rect = load();
  rect.run(draw('sign_rect_post'));
  assert.deepEqual(texts(rect.log), ['QL14']);
  const custom = load();
  custom.run(draw('sign_rect_post', ", signKind: 'custom', customLabel: 'KM12'"));
  assert.deepEqual(texts(custom.log), ['KM12']);
  // Đổi nội dung sang loại khác vẫn vẽ được trên mặt biển mới.
  const noParking = load();
  noParking.run(draw('sign_square_post', ", signKind: 'no_parking'"));
  assert.deepEqual(texts(noParking.log), ['P']);
});

test('mặt biển đúng hình: tròn dùng cung tròn, bát giác 8 đỉnh, vuông/chữ nhật dùng khung bo góc; save/restore cân bằng', () => {
  for (const type of ALL) {
    const { log, run } = load();
    run(draw(type));
    const count = n => log.filter(c => c[0] === n).length;
    assert.equal(count('save'), count('restore'), type);
    assert.ok(count('fill') >= 2, type + ': trụ + mặt biển phải được tô trắng');
    if (type === 'sign_circle_post') assert.ok(count('arc') >= 2, 'mặt tròn + viền trong');
    if (type === 'sign_octagon_post') {
      // 8 đỉnh cho mặt ngoài + 8 cho viền trong (moveTo + 7 lineTo mỗi vòng) ngoài trụ.
      assert.ok(count('closePath') >= 3, 'bát giác ngoài + trong + trụ');
      assert.ok(count('moveTo') >= 2 && count('lineTo') >= 14, 'đủ cạnh bát giác');
    }
  }
});

test('mọi dạng biển cũ vẫn vẽ như trước: tròn không đổi, tam giác bo góc', () => {
  const circle = load();
  circle.run(draw('sign_circle_post'));
  assert.deepEqual(texts(circle.log), ['50'], 'biển tốc độ mặc định');
  const tri = load();
  tri.run(draw('sign_triangle_post'));
  assert.ok(tri.log.some(c => c[0] === 'quadraticCurveTo' || c[0] === 'arcTo'), 'tam giác bo góc');
});
