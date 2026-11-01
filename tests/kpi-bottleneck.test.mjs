import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL('../js/features/reports/' + name, import.meta.url), 'utf8');
const ctx = vm.createContext({});
const K = vm.runInContext(read('kpi-zone-calc.js') + '\n;KpiZoneCalc', ctx);
const B = vm.runInContext(read('kpi-zone-bottleneck.js') + '\n;KpiBottleneck', ctx);
const G = ['Huỳnh Văn Phúc', 'Hồ Quang Huy', 'Nguyễn Quang Huy_DL'];
const S = (y, m, d) => K.serialFromParts(y, m, d, 9, 0, 0);

// Tháng 10/2026: GĐV A 30 HS (27 duyệt), B 20 HS (8 duyệt, tồn nhiều, chờ PASC), C 20 HS (16 duyệt). Dữ liệu tới 30/10.
function fixture() {
  const out = []; let n = 0;
  const add = (gdv, openDay, approveDay, status, amount) => out.push({id: 'HS' + (++n), gdv, zone: 'Đắk Lắk', open: S(2026, 10, openDay), approve: approveDay ? S(2026, 10, approveDay) : null, status, amount, damage: 5e6});
  for (let i = 0; i < 30; i++) add(G[0], 1 + (i % 20), i < 27 ? 25 : 0, i < 27 ? 'Đã duyệt PASC' : 'Chờ duyệt PASC', i % 5 === 0 ? 8e6 : 3e6);
  for (let i = 0; i < 20; i++) add(G[1], 1 + (i % 15), i < 8 ? 28 : 0, i < 8 ? 'Đã duyệt PASC' : 'Chờ duyệt PASC', i % 4 === 0 ? 9e6 : 3.5e6);
  for (let i = 0; i < 20; i++) add(G[2], 2 + (i % 20), i < 16 ? 29 : 0, i < 16 ? 'Đã duyệt PASC' : 'Chờ giám định HT', 3.2e6);
  add(G[2], 3, 0, 'Chờ duyệt PASC', 15e6); // hồ sơ ≥ 10 triệu: bị loại khỏi mẫu
  const asOf = S(2026, 10, 30);
  return K.computeReport(out, {year: 2026, month: 10, gdvs: G, asOf});
}

test('phát hiện đủ điểm nghẽn hoàn thành / chi phí / tồn bằng số liệu thật của báo cáo', () => {
  const report = fixture(), rows = B.detect(report, K), ids = rows.map(r => r.id);
  assert.ok(ids.includes('completion') && ids.includes('cost'), ids.join());
  const done = rows.find(r => r.id === 'completion'), t = report.current.totals;
  assert.ok(done.figures.includes(K.fmtInt(t.approved) + '/' + K.fmtInt(t.issued)));
  assert.ok(done.figures.includes('thiếu ' + K.fmtInt(report.current.needMore)));
  assert.ok(done.cause.includes('Chờ duyệt PASC'), done.cause);
  assert.ok(!done.owner.includes('Hồ Quang Huy'), 'Trưởng Zone không bị giao việc như GĐV');
  assert.ok(!JSON.stringify(rows).includes('Hồ Quang Huy'), 'Trưởng Zone không xuất hiện trong bảng điểm nghẽn');
  assert.match(done.deadline, /^\d{2}\/\d{2}\/2026$/);
  assert.match(done.actions, /^1\. /);
  for (const r of rows) for (const f of ['title', 'figures', 'cause', 'evidence', 'actions', 'owner', 'deadline', 'expected']) assert.ok(typeof r[f] === 'string' && r[f].length, r.id + '.' + f);
});

test('không có điểm nghẽn khi tháng chưa có hồ sơ', () => {
  const report = K.computeReport([], {year: 2026, month: 10, gdvs: G, asOf: S(2026, 10, 30)});
  assert.equal(B.detect(report, K).length, 0);
});

test('bucket chi phí có tổng tiền (để tính tỷ trọng đóng góp)', () => {
  const buckets = fixture().current.analysis.cost.buckets;
  assert.ok(buckets.every(b => typeof b.sum === 'number'));
  assert.equal(buckets.reduce((x, b) => x + b.count, 0), 71);
});

test('yêu cầu gửi AI chỉ chứa số liệu tổng hợp, không có mã hồ sơ', () => {
  const report = fixture(), rows = B.detect(report, K), req = B.aiRequest(rows, report, K);
  const body = JSON.stringify(req);
  assert.equal(req.generationConfig.responseMimeType, 'application/json');
  assert.ok(!/HS\d+/.test(body.replace(/HS đã|HS tồn|HS mở|HS >/g, '')) || !/"HS\d+"/.test(body));
  assert.ok(body.includes('completion'));
});

test('ghép kết quả AI: bỏ id lạ, đánh dấu số không có trong dữ liệu', () => {
  const report = fixture(), rows = B.detect(report, K);
  const ai = B.parseAi('```json\n' + JSON.stringify({summary: 'Tháng này đạt khoảng 99,99% KPI.', rows: [
    {id: 'completion', cause: 'Hồ sơ dồn ở khâu duyệt PASC; cần xác minh thêm.', actions: ['1) GĐV rà soát 12345 hồ sơ', 'Trưởng Zone đôn đốc PASC']},
    {id: 'khong-ton-tai', cause: 'x', actions: ['y']}]}) + '\n```');
  const merged = B.mergeAi(rows, ai, '');
  assert.equal(JSON.stringify(Object.keys(merged.map)), '["completion"]');
  assert.match(merged.map.completion.actions, /^1\. GĐV rà soát/);
  assert.equal(JSON.stringify(merged.map.completion.warn), '["12345"]');
  assert.equal(JSON.stringify(merged.summaryWarn), '["99,99"]');
  assert.throws(() => B.parseAi('không phải json'), /định dạng/);
  assert.throws(() => B.parseAi('{"summary":"a"}'), /thiếu/);
});

test('số trong dữ liệu không bị cảnh báo', () => {
  const rows = B.detect(fixture(), K), done = rows.find(r => r.id === 'completion');
  const allowed = B.allowedNumbers(rows, '');
  assert.equal(B.unverifiedNumbers(done.figures + ' ' + done.expected, allowed).length, 0);
});
