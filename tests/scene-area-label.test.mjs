import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Chỉ nạp đoạn "Tên nhà / vùng" của scene-editor-ui.js (phần còn lại phụ thuộc DOM).
const src = fs.readFileSync(new URL('../js/features/scene/scene-editor-ui.js', import.meta.url), 'utf8');
const start = src.indexOf('// ---- Tên nhà / vùng (areaLabel) ----');
const end = src.indexOf('// ---- Ranh giới tự vẽ ----');
assert.ok(start > 0 && end > start);
function load(shapes, selected) {
  let saves = 0, redraws = 0;
  const ctx = vm.createContext({
    Object, String, sceneShapes: shapes, selectedShapeId: selected, selectedShapeIds: [selected],
    redrawSceneCanvas: () => { redraws++; }, saveDrawingState: () => { saves++; }
  });
  vm.runInContext(src.slice(start, end), ctx);
  return { run: code => vm.runInContext(code, ctx), counts: () => ({ saves, redraws }) };
}

test('đặt tên nhà: rút gọn khoảng trắng, giới hạn 30 ký tự, chỉ lưu lịch sử khi commit', () => {
  const { run, counts } = load([{ id: 'h', type: 'house' }], 'h');
  run(`setSelectedShapeAreaLabel('  Nhà   ông Ba ', false)`);
  assert.equal(run('sceneShapes[0].areaLabel'), 'Nhà ông Ba');
  assert.equal(counts().saves, 0);
  run(`setSelectedShapeAreaLabel('x'.repeat(50), true)`);
  assert.equal(run('sceneShapes[0].areaLabel.length'), 30);
  assert.equal(counts().saves, 1);
});

test('xoá trống = bỏ areaLabel (về nhãn mặc định); loại không hỗ trợ thì bỏ qua', () => {
  const { run } = load([{ id: 'f', type: 'forest', areaLabel: 'Rừng A' }, { id: 'r', type: 'rect' }], 'f');
  run(`setSelectedShapeAreaLabel('', true)`);
  assert.equal(run(`'areaLabel' in sceneShapes[0]`), false);
  const other = load([{ id: 'r', type: 'rect' }], 'r');
  other.run(`setSelectedShapeAreaLabel('abc', true)`);
  assert.equal(other.run(`'areaLabel' in sceneShapes[0]`), false);
});
