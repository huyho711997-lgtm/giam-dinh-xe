import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/ai/library-store.js', import.meta.url), 'utf8');
function setup() {
  const saved = [];
  const db = { ref: () => ({ push: () => ({ key: 'k' + saved.length, set: async value => { saved.push(JSON.parse(JSON.stringify(value))); } }) }) };
  const ctx = vm.createContext({ console, String, Number, Date, Math, Promise, Array, Object, JSON, Error, URL, dbNodeInstance: db, firebase: { auth: () => ({ currentUser: { email: 'a@b.c' } }) } });
  vm.runInContext(source + '\n;this.S = TascoLibStore;', ctx);
  return { S: ctx.S, saved };
}
const mk = n => Array.from({ length: n }, (_, i) => ({ t: 'Điều ' + i, x: 'nội dung ' + i }));

test('tài liệu ≤ 600 đoạn: lưu một tài liệu, giữ nguyên tên', async () => {
  const { S, saved } = setup();
  const ids = await S.saveParts({ meta: { ten: 'Luật A' }, chunks: mk(600) });
  assert.equal(ids.length, 1); assert.equal(saved[0].meta.ten, 'Luật A'); assert.equal(saved[0].chunks.length, 600);
});
test('tài liệu 1300 đoạn: tách 3 phần đều nhau, đủ đoạn, tên (phần i/n)', async () => {
  const { S, saved } = setup();
  const ids = await S.saveParts({ meta: { ten: 'Bộ luật Dân sự 2015', soHieu: '91/2015/QH13' }, chunks: mk(1300) });
  assert.equal(ids.length, 3);
  assert.deepEqual(saved.map(item => item.meta.ten), ['Bộ luật Dân sự 2015 (phần 1/3)', 'Bộ luật Dân sự 2015 (phần 2/3)', 'Bộ luật Dân sự 2015 (phần 3/3)']);
  assert.equal(saved.reduce((sum, item) => sum + item.chunks.length, 0), 1300);
  assert.ok(saved.every(item => item.chunks.length <= 600 && item.meta.soHieu === '91/2015/QH13'));
  assert.equal(saved[1].chunks[0].t, 'Điều ' + saved[0].chunks.length);
});
