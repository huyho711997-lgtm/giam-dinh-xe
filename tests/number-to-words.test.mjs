import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/reimbursements/export.js', import.meta.url), 'utf8');
const body = source.match(/function numberToWordsVN[\s\S]*?\n    \}\n/)[0];
const ctx = vm.createContext({});
vm.runInContext(body + '\nthis.fn = numberToWordsVN;', ctx);
const words = value => ctx.fn(value);

test('nhóm đầu có hàng trăm bằng 0 không đọc "không trăm"', () => {
  assert.equal(words(7652000), 'Bảy triệu sáu trăm năm mươi hai nghìn đồng');
  assert.equal(words(5000), 'Năm nghìn đồng');
  assert.equal(words(12000000), 'Mười hai triệu đồng');
  assert.equal(words(1000000000), 'Một tỷ đồng');
});

test('nhóm giữa vẫn đọc "không trăm" và "lẻ"', () => {
  assert.equal(words(1005000), 'Một triệu không trăm lẻ năm nghìn đồng');
  assert.equal(words(1050000), 'Một triệu không trăm năm mươi nghìn đồng');
  assert.equal(words(2000007), 'Hai triệu không trăm lẻ bảy đồng');
  assert.equal(words(1000000), 'Một triệu đồng');
});

test('các cách đọc đặc biệt và số 0', () => {
  assert.equal(words(21), 'Hai mươi mốt đồng');
  assert.equal(words(15), 'Mười lăm đồng');
  assert.equal(words(105), 'Một trăm lẻ năm đồng');
  assert.equal(words(304000), 'Ba trăm lẻ bốn nghìn đồng');
  assert.equal(words(0), 'không đồng');
});
