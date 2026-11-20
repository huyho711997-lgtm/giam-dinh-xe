import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../js/features/scene/', import.meta.url);
function load() {
  const context = vm.createContext({
    Math, Number, Array, JSON, Map, String, Object, console, Date,
    document: { getElementById: () => null }, window: {},
    sceneShapes: [], sceneTemplateMeta: null, SCENE_LOGICAL_WIDTH: 1000, SCENE_LOGICAL_HEIGHT: 700,
    genShapeId: (() => { let n = 0; return () => ++n; })()
  });
  for (const f of ['geometry', 'objects', 'traffic-signs', 'rendering', 'interaction-export', 'symbol-legend']) {
    vm.runInContext(fs.readFileSync(new URL(f + '.js', root), 'utf8'), context);
  }
  const log = [];
  const ctx = new Proxy({ measureText: t => ({ width: String(t).length * 5 }) }, {
    get(target, prop) { if (prop in target) return target[prop]; return (...args) => { log.push([prop, ...args]); }; },
    set(target, prop, value) { target[prop] = value; return true; }
  });
  context.ctx = ctx;
  return { context, log, run: code => vm.runInContext(code, context) };
}
const note = (n, text) => ({ id: 'n' + n, type: 'number_note', x: 10, y: 10, noteNumber: n, note: text, radius: 13, sizeScale: 1, color: '#111827', width: 1.5 });
const ROW = 27, W = 150, ROWS = 13;
const draw = (t, entriesOn = false) => {
  t.log.length = 0;
  t.run(`drawSceneLegendColumn(ctx, 0, -73, ${W}, ${ROWS * ROW + 73}, { preview: true, separators: false, rowUnits: ${ROW}, enabled: ${entriesOn} })`);
  return t.log;
};
const texts = log => log.filter(c => c[0] === 'fillText').map(c => ({ text: c[1], y: c[3] }));

test('giấy kẻ ô li: 2 dòng chữ mỗi hàng, nằm giữa các vạch (không đè lên bội của 27)', () => {
  const t = load();
  t.context.sceneShapes = [note(1, 'Vị trí xe lúc xảy ra tai nạn gần cột mốc số 12 bên trái đường'), note(2, 'Ngắn')];
  const rows = texts(draw(t)).filter(x => x.text !== '1' && x.text !== '2');
  assert.ok(rows.length >= 3);
  for (const { y } of rows) {
    const within = y % ROW;
    assert.ok(within > 3 && within < ROW - 3, `chữ ở y=${y} sát vạch kẻ`);
  }
  // Chú thích ngắn (1 dòng) căn giữa hàng; chú thích 2 dòng dùng 2 vị trí 0,26/0,74 của hàng.
  const short = rows.find(x => x.text === 'Ngắn');
  assert.ok(Math.abs(short.y % ROW - ROW / 2) < 1e-9);
});

test('giấy kẻ ô li: chú thích dài không bị cắt cụt "…" và chiếm nhiều hàng', () => {
  const t = load();
  t.context.sceneShapes = [note(1, 'một hai ba bốn năm sáu bảy tám chín mười mười-một mười-hai mười-ba mười-bốn mười-lăm')];
  const out = texts(draw(t));
  assert.ok(!out.some(x => String(x.text).includes('…')));
  const body = out.filter(x => x.text !== '1');
  assert.equal(body.map(x => x.text).join(' '), 'một hai ba bốn năm sáu bảy tám chín mười mười-một mười-hai mười-ba mười-bốn mười-lăm');
  assert.ok(Math.max(...body.map(x => x.y)) > ROW, 'phải xuống hàng thứ hai trở đi');
});

test('giấy kẻ ô li: hết chỗ thì ghi "+ n chú thích khác", không tràn qua đáy cột', () => {
  const t = load();
  t.context.sceneShapes = Array.from({ length: 20 }, (_, i) => note(i + 1, 'Chú thích ' + (i + 1) + ' khá dài để chiếm hai dòng trong cột nhỏ'));
  const out = texts(draw(t));
  assert.ok(out.some(x => /^\+ \d+ chú thích khác$/.test(x.text)));
  assert.ok(Math.max(...out.map(x => x.y)) < ROWS * ROW);
});

test('giấy kẻ ô li: bảng Ký hiệu mỗi mục đúng một hàng, neo sát đáy cột, không kẻ vạch phụ', () => {
  const t = load();
  t.context.sceneShapes = [
    { id: 1, type: 'road_boundary_marker', startX: 100, startY: 100, angle: 1, objectW: 30, objectH: 14, color: '#000', width: 1.5, sizeScale: 1 },
    { id: 2, type: 'tree', startX: 200, startY: 100, angle: 0, objectW: 40, objectH: 40, color: '#000', width: 1.5, sizeScale: 1 },
    note(1, 'Ghi chú')
  ];
  const log = draw(t, true);
  const labels = texts(log).filter(x => x.text === 'Ký hiệu' || x.text === 'Cột mốc lộ giới' || x.text === 'Cây xanh');
  assert.equal(labels.length, 3);
  // Tiêu đề ở hàng 11 (13-3+... = hàng thứ 11), hai mục ở hàng 12 và 13: tâm mỗi dòng nằm trong đúng một hàng.
  const centers = labels.map(l => Math.floor(l.y / ROW));
  assert.deepEqual(centers, [ROWS - 3, ROWS - 2, ROWS - 1]);
  // Không có vạch mờ phân cách giữa các mục: chỉ còn đường kẻ đậm đầu bảng chạy hết bề rộng cột.
  const lines = log.filter(c => c[0] === 'lineTo' && c[1] === W);
  assert.equal(lines.length, 1);
  assert.equal(lines[0][2], ROWS * ROW - 3 * ROW);
});

test('chế độ thường (không rowUnits) giữ nguyên cách vẽ cũ: có vạch phân cách chú thích, tối đa 3 dòng', () => {
  const t = load();
  t.context.sceneShapes = [note(1, 'một hai ba bốn năm sáu bảy tám chín mười mười-một mười-hai mười-ba mười-bốn mười-lăm mười-sáu mười-bảy mười-tám')];
  t.log.length = 0;
  t.run(`drawSceneLegendColumn(ctx, 820, 85, 160, 475, { preview: true, enabled: false })`);
  const out = texts(t.log);
  assert.ok(out.some(x => String(x.text).includes('…')));
  assert.ok(t.log.some(c => c[0] === 'lineTo'));
});
