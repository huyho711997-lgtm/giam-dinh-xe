import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
function fnSource(src, name) {
  const m = new RegExp('\\n[ \\t]*function ' + name + '\\(').exec(src);
  assert.ok(m, 'không thấy hàm ' + name);
  const open = src.indexOf('{', src.indexOf(')', m.index));
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(m.index + 1, i + 1);
  }
  throw new Error('hàm không đóng: ' + name);
}
const filters = read('js/features/reports/filters-settings.js'), weekly = read('js/features/reports/weekly-annual.js'), excel = read('js/features/claims/excel-import.js');
const statusMap = /const PENDING_STATUS_MAP = \{[\s\S]*?\n    \};/.exec(read('js/core/runtime.js'))[0];

// ---- webapp (bản gốc) trong một sandbox: dùng chính mã nguồn của webapp
const app = vm.createContext({});
vm.runInContext(['var window = globalThis;', statusMap, 'let cachedReportRules, cachedPendingClaimsPayload, cachedUsersPayload, cachedAccountingTransfersPayload, activeSelectedGdvNames = [];',
  ...['parseDateParts', 'getClaimToTrinhDuyetDate'].map(n => fnSource(excel, n)),
  ...['getRuleArray', 'isPhatSinh', 'isChuyenDntt', 'isTndsClaim', 'isUnpaidClaim', 'isDuyetHsbtApproved', 'isOnlyDaDuyetHsbt', 'isHsDuPhongOver50M'].map(n => fnSource(filters, n)),
  ...['getClaimDateMs', 'getClaimTimestamp', 'getWeeklyZoneReportData', 'getAllAvailableGdvNames', 'getAnnualGdvClaimsData'].map(n => fnSource(weekly, n)), fnSource(excel, 'getClaimGdvName')].join('\n'), app);

// ---- engine
const eng = vm.createContext({});
const WeeklyReportEngine = vm.runInContext(read('js/features/reports/weekly-engine.js') + '\n;WeeklyReportEngine', eng);
const plain = v => JSON.parse(JSON.stringify(v));

// ---- dữ liệu ngẫu nhiên có seed (lặp lại được)
let seed = 20261119; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = a => a[Math.floor(rnd() * a.length)];
const STATUS = ['moi', 'cho_giam_dinh_ht', 'da_giam_dinh_ht', 'cho_gdct', 'da_gdct', 'cho_duyet_pasc', 'da_duyet_hsbt', 'cho_duyet_dntt', 'cho_kt_duyet', 'kt_duyet', 'da_thanh_toan', 'tu_choi', 'Đã duyệt HSBT', 'Chờ KT duyệt', ''];
const GDV = ['Huỳnh Văn Phúc', 'Hồ Quang Huy', 'Nguyễn Quang Huy_DL', '', 'Người lạ'];
function rndDate() {
  const y = 2026, m = 1 + Math.floor(rnd() * 12), d = 1 + Math.floor(rnd() * 28);
  switch (Math.floor(rnd() * 6)) {
    case 0: return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    case 1: return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    case 2: return new Date(y, m - 1, d).getTime();
    case 3: return 45000 + Math.floor(rnd() * 900);   // số ngày Excel
    case 4: return '—';
    default: return undefined;
  }
}
function rndClaim() {
  const c = { trangThai: pick(STATUS), gdvTiepNhan: pick(GDV), ngayMoHs: rndDate(), ngayNhanDuHoSo: rndDate(), toTrinhNgayDuyet: rndDate(),
    ttbtTongSoTienBoiThuong: pick(['0', '3.500.000', '9.999.999', '12000000', '85,000,000', '']), duPhongBoiThuong: pick(['0', '60.000.000', '10.000.000', undefined]),
    tenGaraVietTat: pick(['Carpla Buôn Ma Thuột', 'Gara An Phát', '', 'CARPLA 2']), loaiHoSo: pick(['TNDS', 'Vật chất', 'trách nhiệm dân sự', '']), ngayThanhToan: pick([undefined, '10/11/2026']) };
  if (rnd() < .15) c['Tờ trình – Ngày duyệt'] = rndDate();
  return c;
}

test('engine khớp webapp trên 2.000 hồ sơ ngẫu nhiên, nhiều bộ quy tắc và nhiều kỳ', () => {
  const claims = Object.fromEntries(Array.from({length: 2000}, (_, i) => ['-N' + i, rndClaim()]));
  const users = {u1: {profile: {displayName: 'Huỳnh Văn Phúc'}}, u2: {displayName: 'Không có hồ sơ nào'}, u3: {name: ' Hồ Quang Huy '}, u4: {}};
  const ruleSets = [{}, {hsTonDays: '7', approvedStatuses: 'kt_duyet', chuyenDnttStatuses: 'cho_duyet_dntt', phatSinhDateField: 'toTrinhNgayDuyet', tndsTonDateField: 'ngayMoHs', hsDpbtDateField: 'ngayMoHs', carplaExcludedClaims: {'-N3': true, '-N10': true}}];
  const periods = [[new Date(2026, 10, 7), new Date(2026, 10, 13, 23, 59, 59, 999)], [new Date(2026, 9, 1), new Date(2026, 9, 31, 23, 59, 59, 999)], [new Date(2026, 0, 1), new Date(2026, 11, 31, 23, 59, 59, 999)]];
  const NOW = new Date(2026, 10, 19, 10).getTime();   // webapp đọc Date.now() cho "tồn quá hạn": cố định trong sandbox
  {
    for (const raw of ruleSets) for (const [startDate, endDate] of periods) {
      const rules = WeeklyReportEngine.mergeRules(raw);
      app.__claims = claims; app.__users = users; app.__rules = rules; app.__p = {startDate, endDate}; app.__now = NOW;
      const expected = plain(vm.runInContext(`(() => { cachedReportRules = __rules; cachedPendingClaimsPayload = JSON.parse(JSON.stringify(__claims)); cachedUsersPayload = __users;
        const RD = Date; Date = class extends RD { static now() { return __now; } }; try { return getWeeklyZoneReportData({period: __p, all: true}).list; } finally { Date = RD; } })()`, app));
      const got = plain(WeeklyReportEngine.compute({claims, users, rules: raw, period: {startDate, endDate}, nowMs: NOW}).list);
      assert.deepEqual(got, expected);
      assert.ok(got.reduce((s, g) => s + g.phatSinh, 0) > 0 || endDate.getMonth() === 9);
    }
  }
});

test('kỳ & tóm tắt: tuần Thứ Bảy→Thứ Sáu, kỳ sai bị từ chối, bình quân chung đúng', () => {
  const E = WeeklyReportEngine;
  const sat = E.presets(new Date(2026, 10, 14)).find(p => p.id === 'week0').period;   // 14/11/2026 là Thứ Bảy
  assert.equal(sat.startStr, '14/11/2026'); assert.equal(sat.endStr, '20/11/2026');
  const fri = E.presets(new Date(2026, 10, 20)).find(p => p.id === 'week0').period;    // Thứ Sáu vẫn thuộc tuần bắt đầu 14/11
  assert.equal(fri.startStr, '14/11/2026');
  assert.equal(E.makePeriod('2026-11-13', '2026-11-07'), null); assert.equal(E.makePeriod('x', '2026-11-07'), null); assert.equal(E.makePeriod('2026-02-30', '2026-03-05').startStr, '02/03/2026');
  const s = plain(E.summarize([{gdvName: 'A', phatSinh: 12, daDuyetHsb: 5, chuaDuyetPasc: 0, sumAmtUnder10M: 9000000, countUnder10M: 3}, {gdvName: 'B', phatSinh: 4, daDuyetHsb: 4, sumAmtUnder10M: 3000000, countUnder10M: 1}]));
  assert.equal(s.rows[0].cd, 7); assert.equal(s.totals.ps, 16); assert.equal(s.totals.avg, 3000000);
});

test('báo cáo năm theo GĐV: engine khớp webapp (getAnnualGdvClaimsData) trên 2.000 hồ sơ, có/không lọc GĐV', () => {
  const claims = Object.fromEntries(Array.from({length: 2000}, (_, i) => ['-A' + i, rndClaim()]));
  const users = {u1: {profile: {displayName: 'Huỳnh Văn Phúc'}}, u2: {displayName: 'Không có hồ sơ nào'}, u3: {name: ' Hồ Quang Huy '}, u4: {}};
  for (const raw of [{}, {phatSinhDateField: 'toTrinhNgayDuyet', tndsKeywords: 'tnds,dân sự'}, {phatSinhExcludes: 'moi,tu_choi'}])
    for (const names of [[], ['Huỳnh Văn Phúc', 'Người lạ'], ['hồ quang huy']]) for (const year of [2026, 2025]) {
      const rules = WeeklyReportEngine.mergeRules(raw);
      app.__claims = claims; app.__users = users; app.__rules = rules; app.__names = names; app.__y = year;
      const expected = plain(vm.runInContext(`(() => { cachedReportRules = __rules; cachedPendingClaimsPayload = JSON.parse(JSON.stringify(__claims)); cachedUsersPayload = __users;
        activeAnnualClaimsYear = __y; activeSelectedGdvNames = __names; return getAnnualGdvClaimsData(); })()`, app));
      const got = plain(WeeklyReportEngine.annual({claims, users, rules: raw, year, gdvNames: names}));
      assert.deepEqual(got, expected);
      if (year === 2026 && !names.length) assert.ok(got.total > 0);
    }
});
