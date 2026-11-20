import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../js/features/scene/signed-form-print.js', import.meta.url), 'utf8');

function load(saved) {
  const calls = [];
  const ctx = new Proxy({}, { get: (_, name) => (...args) => { calls.push({ name, args }); }, set: () => true });
  const legendCalls = [];
  const context = vm.createContext({
    Math, Number, Object, JSON, Array, String, console, Error,
    localStorage: { getItem: () => (saved ? JSON.stringify(saved) : null), setItem: () => {} },
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) },
    sceneShapes: [{ id: 's' }], renderShape: () => {}, applySceneDrawingAreaClip: () => {},
    drawSceneLegendColumn: (...args) => legendCalls.push(args)
  });
  vm.runInContext(src + '\nthis.__api = SceneSignedForm;', context);
  return { api: context.__api, calls, legendCalls };
}

test('tờ ô li: vùng hình vẽ và cột chú thích nằm gọn trong khung đo từ bản quét', () => {
  const { api } = load();
  const { frame, legendX, legendRowPitch, legendRows, headEnd } = api.GRID_FORM, L = api.getGridLayout();
  assert.ok(legendX > frame.x && legendX < frame.x + frame.w);
  // Hình vẽ (800×475 đơn vị) co đều, nằm trọn bên trái vạch cột Chú thích, không chạm viền.
  assert.ok(L.x0 > frame.x && L.x0 + 800 * L.k < legendX);
  assert.ok(L.y0 > frame.y && L.y0 + 475 * L.k < frame.y + frame.h);
  // Chừa lề ≥ drawInset (~2 mm) sát viền trái và vạch cột Chú thích để lệch giấy vài px vẫn không đè lên vạch.
  const m = api.GRID_FORM.drawInset;
  assert.ok(m >= 8);
  assert.ok(L.x0 - frame.x >= m - 1e-9 && legendX - (L.x0 + 800 * L.k) >= m - 1e-9);
  assert.ok(L.y0 - frame.y >= m - 1e-9 && frame.y + frame.h - (L.y0 + 475 * L.k) >= m - 1e-9);
  // Một hàng chú thích (27 đơn vị) = đúng một hàng ô li; cột chú thích đúng 13 hàng, từ dưới đầu cột tới đáy khung.
  assert.ok(Math.abs(27 * L.legend.scale - legendRowPitch) < 1e-9);
  assert.equal(legendRows, 13);
  assert.ok(Math.abs(L.legend.top + legendRows * legendRowPitch - (frame.y + frame.h)) < 1e-6);
  assert.ok(L.legend.top > frame.y + legendRowPitch && L.legend.bottom <= frame.y + frame.h + 1e-6);
  assert.ok(L.legend.x > legendX && L.legend.x + L.legend.w < frame.x + frame.w);
});

test('tờ ô li: KHÔNG in khung/tiêu đề cột; chú thích không kẻ vạch phụ; không ghi đè vùng bấm bảng ký hiệu', () => {
  const { api, calls, legendCalls } = load();
  api.build({ template: 'grid', dx: 0, dy: 0, frame: true }, 1280);
  assert.equal(calls.filter(c => c.name === 'strokeRect').length, 0);
  assert.equal(calls.filter(c => c.name === 'fillText').length, 0);
  assert.equal(legendCalls.length, 1);
  const override = legendCalls[0][5];
  assert.equal(override.preview, true);
  assert.equal(override.separators, false);
  assert.equal(override.rowUnits, 27);   // chú thích xếp theo hàng ô li
});

test('tờ chưa có khung (mặc định cũ): vẫn in khung + tiêu đề "Chú thích" và cũng không ghi đè vùng bấm', () => {
  const { api, calls, legendCalls } = load();
  api.build({ template: 'blank', dx: 0, dy: 0, frame: true }, 1280);
  assert.ok(calls.some(c => c.name === 'strokeRect'));
  assert.ok(calls.some(c => c.name === 'fillText' && c.args[0] === 'Chú thích'));
  assert.equal(legendCalls[0][5].preview, true);
  const off = load();
  off.api.build({ template: 'blank', dx: 0, dy: 0, frame: false }, 1280);
  assert.equal(off.calls.filter(c => c.name === 'strokeRect').length, 0);
});

test('cài đặt: nhớ loại giấy đã chọn; giá trị lạ/thiếu quay về tờ chưa có khung; lề dịch theo mm', () => {
  assert.equal(load({ template: 'grid' }).api.settings().template, 'grid');
  assert.equal(load({ template: 'khac' }).api.settings().template, 'blank');
  assert.equal(load({ dx: 2 }).api.settings().template, 'blank');
  const { api, calls } = load();
  api.build({ template: 'grid', dx: 5, dy: -3 }, 1280);
  const t = calls.find(c => c.name === 'translate');
  assert.ok(Math.abs(t.args[0] - 5 * (1280 / 297)) < 1e-9);
  assert.ok(Math.abs(t.args[1] + 3 * (1280 / 297)) < 1e-9);
});
