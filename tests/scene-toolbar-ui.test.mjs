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

const GROUPS = {
  scene_object: { name: 'Ô tô & xe tải', tools: [
    { id: 'car', name: 'Ô tô con', desc: 'Xe 4 bánh nhìn từ trên xuống' },
    { id: 'truck', name: 'Xe tải', desc: 'Xe tải thùng' }
  ] },
  traffic_signs: { name: 'Biển báo & tín hiệu', tools: [
    { id: 'sign_circle_post', name: 'Biển báo tròn', desc: 'Biển cấm / hiệu lệnh trên cột' },
    { id: 'traffic_light', name: 'Đèn tín hiệu', desc: 'Đèn giao thông' }
  ] },
  roadside: { name: 'Lề đường & thoát nước', tools: [
    { id: 'culvert', name: 'Cống ngang đường', desc: 'Cống thoát nước dưới mặt đường' }
  ] }
};

test('normalizeSearch: bỏ dấu tiếng Việt, đ→d, hạ chữ thường, gọn khoảng trắng', () => {
  const { api } = load();
  assert.equal(api.normalizeSearch('  Xe   TẢI  '), 'xe tai');
  assert.equal(api.normalizeSearch('Đèn tín hiệu'), 'den tin hieu');
  assert.equal(api.normalizeSearch(null), '');
});

test('searchTools: gõ không dấu vẫn ra; mọi từ phải khớp; tên khớp đầu xếp trước khớp mô tả', () => {
  const { api } = load();
  assert.deepEqual(plain(api.searchTools('xe tai', GROUPS).map(r => r.id)), ['truck', 'car']);   // ô tô khớp qua tên nhóm, xếp sau
  assert.deepEqual(plain(api.searchTools('den', GROUPS).map(r => r.id))[0], 'traffic_light');
  assert.deepEqual(plain(api.searchTools('bien bao tron', GROUPS).map(r => r.id)), ['sign_circle_post']);
  // "thoat nuoc" chỉ có ở mô tả/nhóm của cống nhưng vẫn tìm được
  assert.deepEqual(plain(api.searchTools('thoat nuoc', GROUPS).map(r => r.id)), ['culvert']);
  assert.deepEqual(plain(api.searchTools('xe tai khong co', GROUPS)), []);
  assert.deepEqual(plain(api.searchTools('   ', GROUPS)), []);
  const hit = api.searchTools('truck', GROUPS)[0];   // khớp theo mã công cụ
  assert.equal(hit.id, 'truck');
  assert.equal(hit.groupId, 'scene_object');
  const byName = api.searchTools('xe', GROUPS).map(r => r.id);
  assert.equal(byName[0] === 'truck' || byName[0] === 'car', true);
});

test('pushRecent: thêm mới lên đầu, giữ vị trí nếu đã có, cắt còn tối đa', () => {
  const { api } = load();
  assert.deepEqual(plain(api.pushRecent([], 'a')), ['a']);
  assert.deepEqual(plain(api.pushRecent(['a', 'b'], 'c')), ['c', 'a', 'b']);
  assert.deepEqual(plain(api.pushRecent(['a', 'b', 'c'], 'b')), ['a', 'b', 'c']);
  assert.deepEqual(plain(api.pushRecent(['a', 'b', 'c', 'd', 'e'], 'f')), ['f', 'a', 'b', 'c', 'd']);
  assert.deepEqual(plain(api.pushRecent('lỗi', 'x')), ['x']);
});

test('parseRecent: bỏ trùng, kiểu lạ, id không còn tồn tại; JSON hỏng → rỗng', () => {
  const { api } = load();
  const valid = id => id !== 'old_tool';
  assert.deepEqual(plain(api.parseRecent('["a","a","old_tool",7,"b"]', valid)), ['a', 'b']);
  assert.deepEqual(plain(api.parseRecent('{bad', valid)), []);
  assert.deepEqual(plain(api.parseRecent('"x"', valid)), []);
  assert.equal(api.parseRecent(JSON.stringify(['1', '2', '3', '4', '5', '6', '7'])).length, 5);
});
