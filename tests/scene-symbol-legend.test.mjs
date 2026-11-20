import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../js/features/scene/', import.meta.url);
function load() {
  const calls = { render: [], text: [] };
  const context = vm.createContext({
    Math, Number, Array, JSON, Map, String, Object, console, Date,
    document: { getElementById: () => null }, window: {},
    sceneShapes: [], sceneTemplateMeta: null,
    SCENE_LOGICAL_WIDTH: 1000, SCENE_LOGICAL_HEIGHT: 700,
    genShapeId: (() => { let n = 0; return () => ++n; })()
  });
  for (const f of ['geometry', 'objects', 'traffic-signs', 'rendering', 'interaction-export', 'symbol-legend']) {
    vm.runInContext(fs.readFileSync(new URL(f + '.js', root), 'utf8'), context);
  }
  // ctx giả: ghi lại lệnh vẽ, đo chữ ~5px/ký tự.
  const log = [];
  const ctx = new Proxy({ measureText: t => ({ width: String(t).length * 5 }) }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return (...args) => { log.push([prop, ...args]); };
    },
    set(target, prop, value) { target[prop] = value; return true; }
  });
  return { context, ctx, log, run: code => vm.runInContext(code, context) };
}

const mk = (o) => ({ id: Math.random(), color: '#000000', width: 1.5, sizeScale: 1, ...o });

test('gom ký hiệu: mỗi tên một dòng, bỏ chữ/số/nét tự do, giữ thứ tự và đếm', () => {
  const { context, run } = load();
  context.shapes = [
    mk({ type: 'car', startX: 1, startY: 1, angle: 0, carW: 60 }),
    mk({ type: 'text', text: 'abc' }),
    mk({ type: 'number_note', noteNumber: 1, note: 'x' }),
    mk({ type: 'pen', points: [{ x: 0, y: 0 }] }),
    mk({ type: 'eraser', points: [{ x: 0, y: 0 }] }),
    mk({ type: 'road_line', x1: 0, y1: 0, x2: 100, y2: 0 }),
    mk({ type: 'car', startX: 5, startY: 5, angle: 1, carW: 60 }),
    null
  ];
  const out = run("buildSceneSymbolLegendEntries(shapes, getShapeDisplayName).map(e => e.label + ':' + e.count).join('|')");
  assert.equal(out, 'Xe ô tô:2|Vạch kẻ đường nét liền:1');
});

test('hộ lan và vệt bánh xe là hai ký hiệu khác nhau; đầu vào sai không lỗi', () => {
  const { context, run } = load();
  context.shapes = [
    run("makeCurvedTireTrackShape(0,0,100,0,'#000000',1.5,'guardrail')"),
    run("makeCurvedTireTrackShape(0,20,100,20,'#000000',1.5)")
  ];
  assert.equal(run("buildSceneSymbolLegendEntries(shapes, getShapeDisplayName).length"), 2);
  assert.equal(run("buildSceneSymbolLegendEntries(null, getShapeDisplayName).length"), 0);
  assert.equal(run("buildSceneSymbolLegendEntries([], null).length"), 0);
});

test('bố cục: ngắt dòng, ẩn bớt khi hết chỗ, null khi không đủ cho 1 dòng', () => {
  const { ctx, context, run } = load();
  context.ctx = ctx;
  const entries = Array.from({ length: 12 }, (_, i) => ({ label: 'Ký hiệu số ' + i + ' khá dài để ngắt dòng', sample: {}, count: 1 }));
  context.entries = entries;
  const full = run('layoutSceneSymbolLegend(ctx, entries, 160, 5000)');
  assert.equal(full.rows.length, 12);
  assert.equal(full.hidden, 0);
  assert.ok(full.rows[0].lines.length >= 1 && full.rows[0].lines.length <= 2);
  const cut = run('layoutSceneSymbolLegend(ctx, entries, 160, 200)');
  assert.ok(cut.hidden > 0 && cut.rows.length + cut.hidden === 12);
  assert.ok(cut.height <= 200, 'không vượt hạn mức chiều cao');
  assert.equal(run('layoutSceneSymbolLegend(ctx, entries, 160, 30)'), null);
  assert.equal(run('layoutSceneSymbolLegend(ctx, [], 160, 500)'), null);
});

test('hình mẫu đường thẳng/vệt được chuẩn hóa ngắn, không thu thành sợi tóc', () => {
  const { context, run } = load();
  context.road = mk({ type: 'road_dashed', x1: 40, y1: 300, x2: 760, y2: 380, color: '#b91c1c' });
  const s = run('makeSceneSymbolStraightSample(road, 30)');
  assert.equal(s.x2 - s.x1, 30);
  assert.equal(s.y1, 0); assert.equal(s.y2, 0);
  assert.equal(s.color, '#b91c1c');
  assert.equal(context.road.x2, 760, 'không sửa vật thể gốc');
  context.rail = run("makeCurvedTireTrackShape(0,0,400,0,'#000000',1.5,'guardrail')");
  const r = run('makeSceneSymbolStraightSample(rail, 30)');
  assert.equal(r.railStyle, 'guardrail');
  assert.equal(r.curveSource, undefined);
  assert.ok(context.rail.curveSource, 'không sửa vật thể gốc');
  assert.equal(run("makeSceneSymbolStraightSample({ type: 'car' }, 30)"), null);
});

test('cấu hình: mặc định hiện, chỉ tắt khi false; hotspot tiêu đề cột Chú thích', () => {
  const { run } = load();
  assert.equal(run('cloneSceneTemplateMeta({}).showSymbolLegend'), true);
  assert.equal(run('cloneSceneTemplateMeta(null).showSymbolLegend'), true);
  assert.equal(run('cloneSceneTemplateMeta({ showSymbolLegend: false }).showSymbolLegend'), false);
  assert.equal(run('cloneSceneTemplateMeta(cloneSceneTemplateMeta({ showSymbolLegend: false })).showSymbolLegend'), false);
  assert.equal(run('getSceneTemplateHotspot(900, 100)'), 'legend');
  assert.equal(run('getSceneTemplateHotspot(900, 300)'), null);
  assert.equal(run('getSceneTemplateHotspot(500, 60)'), 'accident');
});

test('tỷ lệ chiều cao bảng: nhiều chú thích số thì nhỏ lại, có chặn trên/dưới', () => {
  const { run } = load();
  const none = run('getSceneSymbolLegendRatio(475, 0)');
  const some = run('getSceneSymbolLegendRatio(475, 4)');
  const many = run('getSceneSymbolLegendRatio(475, 99)');
  assert.ok(none > some && some > many);
  assert.ok(none <= 0.86 && many >= 0.35);
});

test('vẽ cột chú thích: tắt thì không vẽ bảng; bật thì có "Ký hiệu"; lỗi bảng không chặn chú thích số', () => {
  const { context, ctx, log, run } = load();
  context.ctx = ctx;
  context.sceneShapes = [mk({ type: 'road_line', x1: 0, y1: 0, x2: 100, y2: 0 }), mk({ type: 'number_note', noteNumber: 1, note: 'Ghi chú một' })];
  run('sceneTemplateMeta = cloneSceneTemplateMeta({ showSymbolLegend: true })');
  run('drawSceneLegendColumn(ctx, 820, 85, 160, 475)');
  const texts = log.filter(c => c[0] === 'fillText').map(c => c[1]);
  assert.ok(texts.includes('Ký hiệu'));
  assert.ok(texts.some(t => String(t).includes('Ghi chú một')));
  assert.ok(texts.some(t => String(t).startsWith('Vạch kẻ')), 'có tên ký hiệu (có thể ngắt dòng)');

  log.length = 0;
  run('sceneTemplateMeta = cloneSceneTemplateMeta({ showSymbolLegend: false })');
  run('drawSceneLegendColumn(ctx, 820, 85, 160, 475)');
  const off = log.filter(c => c[0] === 'fillText').map(c => c[1]);
  assert.ok(!off.includes('Ký hiệu'));
  assert.ok(off.some(t => String(t).includes('Ghi chú một')));

  // getShapeDisplayName hỏng → vẫn vẽ được chú thích số
  log.length = 0;
  run('sceneTemplateMeta = cloneSceneTemplateMeta({ showSymbolLegend: true })');
  run('getShapeDisplayName = function () { throw new Error("boom"); }');
  run('drawSceneLegendColumn(ctx, 820, 85, 160, 475)');
  assert.ok(log.filter(c => c[0] === 'fillText').some(c => String(c[1]).includes('Ghi chú một')));
});

test('đấu nối: index.html nạp module, hai nơi vẽ cột dùng drawSceneLegendColumn, hộp thoại có công tắc', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /scene\/symbol-legend\.js/);
  const rendering = fs.readFileSync(new URL('rendering.js', root), 'utf8');
  const signed = fs.readFileSync(new URL('signed-form-print.js', root), 'utf8');
  assert.match(rendering, /drawSceneLegendColumn\(ctx, legendX/);
  assert.match(signed, /drawSceneLegendColumn\(ctx,GRID\.legendX/);
  const geo = fs.readFileSync(new URL('geometry.js', root), 'utf8');
  assert.match(geo, /sceneMetaShowSymbolLegend/);
});

test('tùy chỉnh: ẩn, đổi tên, sắp xếp; khóa không đổi khi đổi tên', () => {
  const { context, run } = load();
  context.shapes = [
    mk({ type: 'car', startX: 1, startY: 1, angle: 0, carW: 60 }),
    mk({ type: 'road_line', x1: 0, y1: 0, x2: 100, y2: 0 }),
    mk({ type: 'tree', startX: 1, startY: 1, angle: 0, objectW: 30, objectH: 30 })
  ];
  context.cfg = { hidden: ['Cây xanh'], order: ['Vạch kẻ đường nét liền', 'Xe ô tô'], labels: { 'Xe ô tô': 'Xe BKS 47C-26837' } };
  const shown = run('buildSceneSymbolLegendEntries(shapes, getShapeDisplayName, cfg).map(e => e.key + "=>" + e.label).join("|")');
  assert.equal(shown, 'Vạch kẻ đường nét liền=>Vạch kẻ đường nét liền|Xe ô tô=>Xe BKS 47C-26837');
  const all = run('buildSceneSymbolLegendEntries(shapes, getShapeDisplayName, cfg, true).map(e => e.key + ":" + e.hidden).join("|")');
  assert.equal(all, 'Vạch kẻ đường nét liền:false|Xe ô tô:false|Cây xanh:true');
});

test('cấu hình hỏng/quá khổ được làm sạch', () => {
  const { context, run } = load();
  context.bad = { hidden: 'x', order: [1, null, 'a', 'a'], labels: { a: '  ', b: 'B'.repeat(200), c: 5 } };
  const out = JSON.parse(run('JSON.stringify(normalizeSceneSymbolLegendConfig(bad))'));
  assert.deepEqual(out.hidden, []);
  assert.deepEqual(out.order, ['1', 'a']);
  assert.equal(out.labels.a, undefined);
  assert.equal(out.labels.b.length, 60);
  assert.equal(out.labels.c, '5');
  assert.deepEqual(JSON.parse(run('JSON.stringify(normalizeSceneSymbolLegendConfig(null))')), { hidden: [], order: [], labels: {} });
});

test('templateMeta giữ và làm sạch cấu hình ký hiệu qua cloneSceneTemplateMeta', () => {
  const { context, run } = load();
  context.m = { symbolLegend: { hidden: ['A'], order: ['B', 'A'], labels: { B: 'Tên B' } } };
  const out = JSON.parse(run('JSON.stringify(cloneSceneTemplateMeta(cloneSceneTemplateMeta(m)).symbolLegend)'));
  assert.deepEqual(out, { hidden: ['A'], order: ['B', 'A'], labels: { B: 'Tên B' } });
  assert.deepEqual(JSON.parse(run('JSON.stringify(cloneSceneTemplateMeta({}).symbolLegend)')), { hidden: [], order: [], labels: {} });
});

test('vẽ cột chú thích dùng tên tùy chỉnh và bỏ ký hiệu đã ẩn', () => {
  const { context, ctx, log, run } = load();
  context.ctx = ctx;
  context.sceneShapes = [
    mk({ type: 'car', startX: 1, startY: 1, angle: 0, carW: 60 }),
    mk({ type: 'tree', startX: 1, startY: 1, angle: 0, objectW: 30, objectH: 30 })
  ];
  run('sceneTemplateMeta = cloneSceneTemplateMeta({ symbolLegend: { hidden: ["Cây xanh"], labels: { "Xe ô tô": "Xe tải lật" } } })');
  run('drawSceneLegendColumn(ctx, 820, 85, 160, 475)');
  const texts = log.filter(c => c[0] === 'fillText').map(c => String(c[1]));
  assert.ok(texts.includes('Xe tải lật'));
  assert.ok(!texts.some(t => t.includes('Cây')));
  // Ẩn hết → không còn bảng
  log.length = 0;
  run('sceneTemplateMeta = cloneSceneTemplateMeta({ symbolLegend: { hidden: ["Cây xanh", "Xe ô tô"] } })');
  run('drawSceneLegendColumn(ctx, 820, 85, 160, 475)');
  assert.ok(!log.filter(c => c[0] === 'fillText').some(c => c[1] === 'Ký hiệu'));
});

test('bấm trực tiếp vào bảng Ký hiệu mở trình chỉnh sửa; ẩn bảng thì vùng bấm biến mất', () => {
  const { context, ctx, run } = load();
  context.ctx = ctx;
  context.sceneShapes = [mk({ type: 'road_line', x1: 0, y1: 0, x2: 100, y2: 0 })];
  run('sceneTemplateMeta = cloneSceneTemplateMeta({})');
  run('drawSceneLegendColumn(ctx, 820, 85, 160, 475)');
  const rect = JSON.parse(run('JSON.stringify(sceneSymbolLegendHitRect)'));
  assert.equal(rect.x, 820);
  assert.equal(rect.y + rect.h, 560, 'bảng neo sát đáy cột');
  context.px = rect.x + 50; context.py = rect.y + rect.h / 2;
  assert.equal(run('getSceneTemplateHotspot(px, py)'), 'legend');
  assert.equal(run('getSceneTemplateHotspot(900, 250)'), null, 'vùng chú thích số không mở hộp thoại');
  assert.equal(run('getSceneTemplateHotspot(400, 300)'), null, 'vùng vẽ không bị chiếm');
  // Xem trước không được ghi đè vùng bấm của bản vẽ thật
  run('drawSceneLegendColumn(ctx, 0, 0, 160, 475, { config: { hidden: ["Vạch kẻ đường nét liền"] }, enabled: true, preview: true })');
  assert.equal(JSON.parse(run('JSON.stringify(sceneSymbolLegendHitRect)')).x, 820);
  // Tắt bảng → hết vùng bấm, nhưng tiêu đề cột Chú thích vẫn là lối vào để bật lại
  run('sceneTemplateMeta = cloneSceneTemplateMeta({ showSymbolLegend: false })');
  run('drawSceneLegendColumn(ctx, 820, 85, 160, 475)');
  assert.equal(run('sceneSymbolLegendHitRect'), null);
  assert.equal(run('getSceneTemplateHotspot(900, 100)'), 'legend');
});

test('icon ký hiệu luôn thẳng: không theo góc xoay của vật mẫu; cột mốc dựng đứng; vật trên sơ đồ không bị sửa', () => {
  const { context, run } = load();
  context.car = mk({ type: 'car', startX: 300, startY: 300, angle: 0.8, carW: 60 });
  context.marker = mk({ type: 'road_boundary_marker', startX: 200, startY: 300, angle: 0.9, objectW: 46, objectH: 21 });
  context.tree = mk({ type: 'tree', startX: 50, startY: 60, angle: 2.1, objectW: 40, objectH: 40 });
  context.line = mk({ type: 'road_line', x1: 0, y1: 0, x2: 100, y2: 40 });
  assert.equal(run('makeSceneSymbolUprightSample(car).shape.angle'), 0);
  assert.equal(run('makeSceneSymbolUprightSample(tree).shape.angle'), 0);
  assert.equal(run('makeSceneSymbolUprightSample(marker).shape.angle'), Math.PI / 2);
  assert.equal(run('makeSceneSymbolUprightSample(marker).upright'), true);
  assert.equal(run('makeSceneSymbolUprightSample(car).upright'), false);
  // vật gốc giữ nguyên góc; nét thẳng/đường không có góc thì trả nguyên bản.
  assert.equal(run('car.angle'), 0.8);
  assert.equal(run('marker.angle'), 0.9);
  assert.equal(run('makeSceneSymbolUprightSample(line).shape === line'), true);
  assert.equal(run('makeSceneSymbolUprightSample(null).shape'), null);
});

test('vẽ icon: xe nghiêng vẫn ra cùng lệnh vẽ như xe nằm ngang; cột mốc không bị xoay ngang lấp khung', () => {
  const { context, ctx, log, run } = load();
  const draw = shape => { log.length = 0; context.s = shape; context.c = ctx; run('drawSceneSymbolSample(c, s, 0, 0, 56, 18)'); return JSON.stringify(log); };
  const tilted = draw(mk({ id: 1, type: 'car', startX: 300, startY: 300, angle: 1.2, carW: 60 }));
  const flat = draw(mk({ id: 1, type: 'car', startX: 300, startY: 300, angle: 0, carW: 60 }));
  assert.equal(tilted, flat);
  const markerLog = draw(mk({ type: 'road_boundary_marker', startX: 200, startY: 300, angle: 0, objectW: 46, objectH: 21 }));
  // Cột mốc dựng đứng (cao > rộng) không bị rotate(-π/2) của quy tắc "xoay ngang cho vừa khung".
  assert.ok(!markerLog.includes(String(-Math.PI / 2)));
});
