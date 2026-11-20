import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../js/features/scene/', import.meta.url);
const read = f => fs.readFileSync(new URL(f, root), 'utf8');

test('nút "Sửa" trên thanh thuộc tính mở hộp sửa cho hướng đi đã vẽ', () => {
  const opened = [];
  const context = vm.createContext({
    selectedShapeId: 'd1', sceneShapes: [{ id: 'd1', type: 'direction_label' }],
    openSceneDirectionEditor: (shape, isNew) => opened.push([shape.id, isNew]),
    openSceneTextModal: () => opened.push('text'), openSceneNumberNoteModal: () => opened.push('note')
  });
  vm.runInContext(read('text-editor.js'), context);
  // text-editor.js khai báo lại các hàm mở hộp; đặt lại sau khi nạp để ghi nhận lời gọi.
  vm.runInContext(`openSceneDirectionEditor = (s, n) => __opened.push([s.id, n]);`, Object.assign(context, { __opened: opened }));
  vm.runInContext('editSelectedTextShape()', context);
  assert.equal(JSON.stringify(opened), JSON.stringify([['d1', false]]));
});

test('thanh thuộc tính hiện nút sửa với nhãn "Sửa hướng đi" khi chọn hướng đi', () => {
  const src = read('rendering.js');
  assert.match(src, /shape\.type === 'direction_label';\s*\n\s*btnEdit\.style\.display/);
  assert.match(src, /'Sửa hướng đi'/);
});
