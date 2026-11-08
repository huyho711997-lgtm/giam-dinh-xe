import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL('../js/features/reports/' + name, import.meta.url), 'utf8');
const ctx = vm.createContext({});
const K = vm.runInContext(read('kpi-zone-calc.js') + '\n;KpiZoneCalc', ctx);
const W = vm.runInContext(read('kpi-zone-worklist.js') + '\n;KpiWorklist', ctx);
const G = ['Huỳnh Văn Phúc', 'Hồ Quang Huy', 'Nguyễn Quang Huy_DL'];
const S = (y, m, d) => K.serialFromParts(y, m, d, 9, 0, 0);
const AS_OF = S(2026, 10, 30);

let n = 0;
const rec = (gdv, openDay, status, extra = {}) => ({id: 'HS' + (++n), gdv, zone: '', open: S(2026, 10, openDay), approve: null, status, amount: 3e6, damage: 5e6, ...extra});

test('mức cảnh báo theo tuổi: trong hạn / sắp quá hạn / quá hạn, ranh giới đúng', () => {
  assert.equal(W.levelOf(21, 30), 'ok');
  assert.equal(W.levelOf(22, 30), 'soon');
  assert.equal(W.levelOf(30, 30), 'soon'); // đúng hạn chưa quá hạn: khớp "tồn > 30 ngày" của KPI
  assert.equal(W.levelOf(31, 30), 'over');
  assert.equal(W.levelOf(0, 30), 'ok');
  assert.equal(W.levelOf(5, 7), 'soon');
  assert.equal(W.levelOf(8, 7), 'over');
});

test('giá trị hạn không hợp lệ rơi về mặc định 30 ngày', () => {
  for (const bad of [undefined, null, 'abc', 0, -5, NaN, 9999]) assert.equal(W.cleanLimit(bad), 30);
  assert.equal(W.cleanLimit('14'), 14);
  assert.equal(W.cleanLimit(14.9), 14);
});

test('danh sách chỉ gồm hồ sơ tồn và số lượng khớp báo cáo KPI', () => {
  const rows = [
    rec(G[0], 1, 'Chờ duyệt PASC'),            // 29 ngày → sắp quá hạn, chờ bên khác
    rec(G[0], 28, 'Mới'),                      // 2 ngày → trong hạn
    rec(G[0], 5, 'Đã duyệt HSBT'),             // không phải tồn
    rec(G[0], 2, 'Từ chối'),                   // không phải tồn
    rec(G[1], 3, 'Chờ GĐCT'),                  // 27 ngày
    rec(G[2], 10, 'Chờ giám định HT')          // 20 ngày
  ];
  // Hồ sơ mở từ tháng trước, còn tồn → quá hạn
  rows.push({id: 'OLD1', gdv: G[2], zone: '', open: S(2026, 8, 20), approve: null, status: 'Đã giám định HT', amount: 0, damage: 0});
  const w = W.build(rows, K, {gdvs: G, asOf: AS_OF});
  const month = K.computeMonth(rows, {year: 2026, month: 10, gdvs: G, asOf: AS_OF});
  assert.equal(w.items.length, 5);
  assert.equal(w.items.length, month.totals.ton, 'số hồ sơ trong danh sách = tồn lũy kế của báo cáo KPI');
  assert.equal(w.totals.ton, month.totals.ton);
  assert.equal(w.totals.headroom, month.analysis.backlogHeadroom);
  assert.ok(!w.items.some(i => ['Đã duyệt HSBT', 'Từ chối'].includes(i.status)));
  assert.equal(w.counts.over, 1);
  assert.equal(w.items[0].id, 'OLD1', 'quá hạn lên đầu, tuổi lớn trước');
  assert.equal(w.items[0].days, K.daysBetween(Math.floor(AS_OF), S(2026, 8, 20)));
  assert.deepEqual(w.items.map(i => i.level), ['over', 'soon', 'soon', 'ok', 'ok']);
  assert.ok(w.items.every(i => Number.isInteger(i.days) && i.days >= 0));
  const sorted = [...w.items].sort((a, b) => W.LEVELS[a.level].rank - W.LEVELS[b.level].rank || b.days - a.days);
  assert.deepEqual(w.items.map(i => i.id), sorted.map(i => i.id));
});

test('chia theo GĐV, đếm todo/chase và gợi ý việc cần làm', () => {
  const rows = [
    rec(G[0], 1, 'Chờ duyệt PASC'), rec(G[0], 2, 'Chờ GĐCT'), rec(G[0], 3, 'Mới'),
    rec(G[1], 29, 'Mới'),
    rec(G[2], 1, 'Đã giám định HT')
  ];
  const w = W.build(rows, K, {gdvs: G, asOf: AS_OF});
  const a = w.groups.find(g => g.gdv === G[0]), b = w.groups.find(g => g.gdv === G[1]), c = w.groups.find(g => g.gdv === G[2]);
  assert.equal(a.items.length, 3);
  assert.equal(a.counts.todo, 3); assert.equal(a.counts.chase, 2);
  assert.equal(b.counts.todo, 0); assert.equal(b.counts.ok, 1);
  assert.equal(c.counts.todo, 1); assert.equal(c.counts.chase, 0);
  assert.equal(w.counts.todo, 4);
  assert.match(a.items.find(i => i.status === 'Chờ duyệt PASC').action, /PASC/);
  assert.match(a.items.find(i => i.status === 'Chờ GĐCT').action, /GĐCT/);
  assert.match(c.items[0].action, /GĐV xử lý/);
  assert.equal(w.groups.reduce((s, g) => s + g.items.length, 0), w.items.length);
});

test('đổi hạn xử lý làm đổi mức cảnh báo', () => {
  const rows = [rec(G[0], 16, 'Mới')]; // 14 ngày
  assert.equal(W.build(rows, K, {gdvs: G, asOf: AS_OF, limit: 30}).items[0].level, 'ok');
  assert.equal(W.build(rows, K, {gdvs: G, asOf: AS_OF, limit: 14}).items[0].level, 'soon');
  assert.equal(W.build(rows, K, {gdvs: G, asOf: AS_OF, limit: 10}).items[0].level, 'over');
});

test('hồ sơ ngoài phạm vi zone/GĐV không bị đưa vào; Zone map được ưu tiên', () => {
  const rows = [rec('GĐV khác', 1, 'Mới'), rec('GĐV khác', 2, 'Mới', {zone: 'Đắk Lắk'}), rec(G[0], 3, 'Mới', {zone: 'Gia Lai'})];
  const none = W.build(rows, K, {gdvs: G, asOf: AS_OF});
  assert.equal(none.items.length, 1, 'chỉ hồ sơ của GĐV đã chọn');
  const map = W.build(rows, K, {gdvs: G, asOf: AS_OF, zoneMap: {[K.nameKey('Đắk Lắk')]: 'in', [K.nameKey('Gia Lai')]: 'out'}});
  assert.equal(map.items.length, 1);
  assert.equal(map.items[0].gdv, 'GĐV khác', 'hồ sơ thuộc zone map được tính dù GĐV nào xử lý');
  assert.ok(map.groups.some(g => g.gdv === 'GĐV khác'), 'GĐV ngoài danh sách nhưng được gán nhờ Zone map vẫn có nhóm riêng');
});

test('hồ sơ chưa phân công vào nhóm "Chưa phân công"', () => {
  const rows = [rec('', 1, 'Mới', {zone: 'Đắk Lắk'})];
  const w = W.build(rows, K, {gdvs: G, asOf: AS_OF, zoneMap: {[K.nameKey('Đắk Lắk')]: 'in'}});
  assert.equal(w.items[0].gdv, 'Chưa phân công');
});

test('không có dữ liệu: trả về kết quả rỗng an toàn, không ném lỗi', () => {
  for (const input of [[], null, undefined]) {
    const w = W.build(input, K, {gdvs: G});
    assert.equal(w.empty, true); assert.equal(w.items.length, 0); assert.equal(w.groups.length, 0);
  }
});

test('số hồ sơ cần giải quyết = phần tồn vượt mức 10% (0 khi còn dư địa)', () => {
  const rows = [];
  for (let i = 0; i < 10; i++) rows.push(rec(G[0], 1 + i, i < 3 ? 'Mới' : 'Đã duyệt HSBT', {approve: i < 3 ? null : S(2026, 10, 20)}));
  const w = W.build(rows, K, {gdvs: G, asOf: AS_OF});
  assert.equal(w.totals.ytd, 10);
  assert.equal(w.totals.ton, 3);
  assert.equal(w.totals.headroom, 1 - 3); // 10% × 10 = 1 hồ sơ cho phép
  assert.equal(w.totals.needResolve, 2);
  // 10 hồ sơ phát sinh, chỉ 1 tồn (= 10%) → còn đúng mức cho phép, không cần giải quyết thêm
  const few = rows.map((r, i) => i === 0 ? r : {...r, status: 'Đã duyệt HSBT', approve: S(2026, 10, 20)});
  const ok = W.build(few, K, {gdvs: G, asOf: AS_OF});
  assert.equal(ok.totals.ton, 1);
  assert.equal(ok.totals.headroom, 0);
  assert.equal(ok.totals.needResolve, 0);
});

test('cảnh báo dữ liệu cũ', () => {
  const asOf = S(2026, 10, 30);
  assert.equal(W.staleDays(asOf, S(2026, 10, 30)), 0);
  assert.equal(W.staleDays(asOf, S(2026, 11, 2)), 3);
  assert.equal(W.staleDays(asOf, S(2026, 10, 1)), 0, 'không âm');
  assert.equal(W.staleDays(null, asOf), 0);
  assert.equal(W.staleDays(asOf, NaN), 0);
});
