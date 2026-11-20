import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/scene/toolbar-ui.js', import.meta.url), 'utf8');

function load(storage = {}) {
  const local = {
    getItem: k => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); }
  };
  const ctx = vm.createContext({ localStorage: local, console });
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.runInContext(source, ctx);
  return { api: ctx.SceneToolbarUI, storage };
}

// vm tạo mảng ở realm khác: đưa về dữ liệu thuần trước khi so sánh sâu.
const plain = v => JSON.parse(JSON.stringify(v));
const kindOf = n => n.k;
const labelOf = n => n.t;

test('buildSections: mục bắt đầu ở nhãn, dừng ở vạch ngăn hoặc nhãn kế; nút ngoài mục bị bỏ qua', () => {
  const { api } = load();
  const nodes = [
    { k: 'item', id: 'header' },
    { k: 'label', t: ' Thao tác ' }, { k: 'item', id: 'select' }, { k: 'separator' },
    { k: 'label', t: 'Vẽ  nét' }, { k: 'item', id: 'pen' }, { k: 'item', id: 'line' },
    { k: 'label', t: 'Ghi chú' }, { k: 'item', id: 'text' }, { k: 'separator' },
    { k: 'item', id: 'orphan' }
  ];
  const sections = api.buildSections(nodes, kindOf, labelOf);
  assert.deepEqual(plain(sections.map(s => [s.label, s.items.map(i => i.id)])), [
    ['Thao tác', ['select']], ['Vẽ nét', ['pen', 'line']], ['Ghi chú', ['text']]
  ]);
});

test('parseCollapsed chịu được dữ liệu hỏng và chỉ nhận mảng chuỗi', () => {
  const { api } = load();
  assert.deepEqual(plain(api.parseCollapsed(null)), []);
  assert.deepEqual(plain(api.parseCollapsed('{oops')), []);
  assert.deepEqual(plain(api.parseCollapsed('{"a":1}')), []);
  assert.deepEqual(plain(api.parseCollapsed('["Vẽ nét", 3, "", null, "Ghi chú"]')), ['Vẽ nét', 'Ghi chú']);
});

test('không có document (môi trường test) thì nạp module không lỗi', () => {
  const { api } = load();
  assert.equal(typeof api.init, 'function');
  api.init();
});
