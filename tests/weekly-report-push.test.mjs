import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../js/features/reports/weekly-report-push.js', import.meta.url), 'utf8');
const ctx = vm.createContext({AbortController, setTimeout, clearTimeout});
const {WeeklyReportPush} = vm.runInContext(src + '\n;({WeeklyReportPush})', ctx);
const plain = value => JSON.parse(JSON.stringify(value));
const period = {startDate: new Date(2026, 10, 7), endDate: new Date(2026, 10, 13, 23, 59), startStr: '07/11/2026', endStr: '13/11/2026', label: 'Từ ngày 07/11/2026 đến 13/11/2026'};
const rules = {hsTonDays: 30, hsDpbtAmount: 50000000, avgAmount: 10000000};
const list = [
  {gdvName: ' Huỳnh Văn Phúc ', phatSinh: 12, daDuyetHsb: 5, chuaDuyetPasc: 0, chuyenDntt: 2, carplaCount: 1, tndsTonLuyKe: 3, hsTonOver30Days: 4, hsDuPhongOver50M: 1, sumAmtUnder10M: 9000000, countUnder10M: 3, carplaCumulativeRevenue: 25000000},
  {gdvName: 'Nguyễn Quang Huy_DL', phatSinh: 4, daDuyetHsb: 4, chuaDuyetPasc: 2, chuyenDntt: 0, carplaCount: 0, tndsTonLuyKe: 0, hsTonOver30Days: 0, hsDuPhongOver50M: 0, sumAmtUnder10M: 3000000, countUnder10M: 1, carplaCumulativeRevenue: 0}
];

test('bản chụp: id theo kỳ, cột "chưa duyệt" dự phòng = phát sinh - đã duyệt, tổng đúng', () => {
  const s = plain(WeeklyReportPush.buildSnapshot(period, list, rules, ' Admin '));
  assert.equal(s.id, '2026-11-07_2026-11-13'); assert.equal(s.start_date, '2026-11-07'); assert.equal(s.end_date, '2026-11-13');
  assert.equal(s.payload.rows[0].gdv, 'Huỳnh Văn Phúc'); assert.equal(s.payload.rows[0].cd, 7);   // 12 - 5
  assert.equal(s.payload.rows[1].cd, 2);                                                           // có giá trị thật thì dùng
  assert.equal(s.payload.rows[0].avg, 3000000);
  assert.equal(s.payload.totals.ps, 16); assert.equal(s.payload.totals.dd, 9); assert.equal(s.payload.totals.rev, 25000000);
  assert.equal(s.payload.totals.avg, 3000000);          // (9M + 3M) / (3 + 1 hồ sơ), không phải trung bình 2 dòng
  assert.equal(s.payload.month, 11); assert.equal(s.payload.rules.avgAmount, 10000000); assert.equal(s.pushed_by, 'Admin');
});

test('bản chụp: số lạ/âm/NaN về 0, kỳ sai bị từ chối, danh sách rỗng vẫn hợp lệ', () => {
  const s = plain(WeeklyReportPush.buildSnapshot(period, [{gdvName: '', phatSinh: -3, daDuyetHsb: 'x', countUnder10M: 0, sumAmtUnder10M: 5}], rules, ''));
  assert.equal(s.payload.rows[0].gdv, 'Chưa phân công'); assert.equal(s.payload.rows[0].ps, 0); assert.equal(s.payload.rows[0].dd, 0); assert.equal(s.payload.rows[0].avg, 0);
  assert.equal(plain(WeeklyReportPush.buildSnapshot(period, [], rules, '')).payload.rows.length, 0);
  assert.throws(() => WeeklyReportPush.buildSnapshot({startDate: period.endDate, endDate: period.startDate}, list, rules, ''), /không hợp lệ/);
  assert.throws(() => WeeklyReportPush.buildSnapshot({}, list, rules, ''));
});

test('đẩy: chưa đăng nhập / chưa nạp module / bị từ chối quyền đều trả lý do rõ ràng', async () => {
  const snap = WeeklyReportPush.buildSnapshot(period, list, rules, '');
  assert.equal((await WeeklyReportPush.push(snap)).reason, 'nomodule');
  const mk = (session, upsertResult) => vm.runInContext(`(RescueGarages = {getClient: async () => ({auth: {getSession: async () => ({data: {session: ${session}}})}, from: () => ({upsert: () => ({abortSignal: async () => (${upsertResult})})})})}, WeeklyReportPush)`, ctx);
  vm.runInContext('var RescueGarages;', ctx);
  assert.equal((await mk('null', '{}').push(snap)).reason, 'signedout');
  assert.equal((await mk('{}', '{error: {code: "42501"}}').push(snap)).reason, 'denied');
  assert.equal((await mk('{}', '{error: {code: "PGRST205"}}').push(snap)).reason, 'missing');
  const ok = await mk('{}', '{error: null}').push(snap); assert.equal(ok.ok, true); assert.equal(ok.id, '2026-11-07_2026-11-13');
});
