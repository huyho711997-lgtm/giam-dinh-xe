import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/scene/layer-order.js', import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(source, context);
const { sceneParseLayerNumber: parse, sceneMoveShapeToLayer: move } = context;
const ids = shapes => shapes.map(s => s.id);
const make = n => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

test('Parse: chỉ nhận số nguyên dương, đưa về khoảng 1..tổng', () => {
  assert.equal(parse('7', 35), 7);
  assert.equal(parse(' 12 ', 35), 12);
  assert.equal(parse('99', 35), 35);
  assert.equal(parse('0', 35), 1);
  for (const bad of ['', '  ', 'abc', '-3', '2.5', '1e2', '١٢', null, undefined]) assert.equal(parse(bad, 35), null, String(bad));
  assert.equal(parse('3', 0), null);
});

test('Chuyển hình tới lớp trên cùng, dưới cùng và ở giữa', () => {
  const base = make(5);
  assert.deepEqual(ids(move(base, 1, 5).shapes), [2, 3, 4, 5, 1]);
  assert.deepEqual(ids(move(base, 5, 1).shapes), [5, 1, 2, 3, 4]);
  assert.deepEqual(ids(move(base, 2, 4).shapes), [1, 3, 4, 2, 5]);
  assert.deepEqual(ids(move(base, 4, 2).shapes), [1, 4, 2, 3, 5]);
});

test('Báo đúng lớp trước/sau và changed', () => {
  const result = move(make(35), 1, 35);
  assert.deepEqual([result.ok, result.changed, result.from, result.to], [true, true, 1, 35]);
  const same = move(make(5), 3, 3);
  assert.deepEqual([same.ok, same.changed, same.from, same.to], [true, false, 3, 3]);
});

test('Không sửa mảng gốc và giữ nguyên tham chiếu từng hình', () => {
  const base = make(4);
  const snapshot = ids(base);
  const result = move(base, 1, 3);
  assert.deepEqual(ids(base), snapshot);
  assert.notEqual(result.shapes, base);
  assert.equal(result.shapes.find(s => s.id === 1), base[0]);
  assert.equal(result.shapes.length, base.length);
});

test('Số lớp ngoài khoảng được đưa về hai đầu; id lạ hoặc danh sách rỗng không đổi gì', () => {
  assert.deepEqual(ids(move(make(3), 1, 99).shapes), [2, 3, 1]);
  assert.deepEqual(ids(move(make(3), 3, 0).shapes), [3, 1, 2]);
  const unknown = move(make(3), 'nope', 2);
  assert.deepEqual([unknown.ok, unknown.changed], [false, false]);
  const empty = move([], 1, 1);
  assert.deepEqual([empty.ok, empty.changed, empty.shapes.length], [false, false, 0]);
  assert.equal(move(null, 1, 1).ok, false);
  assert.equal(move(make(3), 1, 'x').ok, false);
});
