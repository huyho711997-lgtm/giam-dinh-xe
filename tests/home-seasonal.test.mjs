import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../js/features/dashboard/seasonal.js', import.meta.url), 'utf8');
const ctx = vm.createContext({window: {}, localStorage: {getItem: () => null, setItem() {}}, document: {}});
const S = vm.runInContext(src + '\n;HomeSeasonal', ctx);
const cfg = o => S.sanitize(o);
const day = (m, d) => new Date(2026, m - 1, d);

test('mùa mặc định 01/12 → 05/01 vắt qua năm mới', () => {
  const c = cfg({mode: 'auto'});
  assert.equal(S.isActive(day(11, 30), c), false);
  assert.equal(S.isActive(day(12, 1), c), true);
  assert.equal(S.isActive(day(12, 25), c), true);
  assert.equal(S.isActive(day(1, 5), c), true);
  assert.equal(S.isActive(day(1, 6), c), false);
  assert.equal(S.isActive(day(7, 15), c), false);
});
test('chế độ on/off bỏ qua ngày', () => {
  assert.equal(S.isActive(day(7, 1), cfg({mode: 'on'})), true);
  assert.equal(S.isActive(day(12, 25), cfg({mode: 'off'})), false);
});
test('khoảng ngày trong cùng năm', () => {
  const c = cfg({from: '12-20', to: '12-26'});
  assert.equal(S.inSeason(day(12, 24), c), true);
  assert.equal(S.inSeason(day(12, 27), c), false);
});
test('sanitize loại giá trị sai', () => {
  const c = cfg({mode: 'x', density: 'huge', from: '13-40', to: 'abc', message: 'a'.repeat(200)});
  assert.equal(c.mode, 'auto'); assert.equal(c.density, 'light'); assert.equal(c.from, '12-01'); assert.equal(c.to, '01-05'); assert.equal(c.message.length, 80);
});
test('parseDM nhận dd/mm', () => {
  assert.equal(S.parseDM('1/12'), '12-01'); assert.equal(S.parseDM('05/01'), '01-05');
  assert.equal(S.parseDM('32/01'), null); assert.equal(S.parseDM('10/13'), null); assert.equal(S.parseDM(''), null);
});
