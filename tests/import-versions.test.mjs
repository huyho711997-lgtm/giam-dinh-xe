import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({TextEncoder, TextDecoder, Blob, Response, CompressionStream, DecompressionStream, btoa, atob, Uint8Array, JSON, Date, Math, Promise});
vm.runInContext(fs.readFileSync(new URL('../js/features/claims/import-versions.js', import.meta.url), 'utf8') + '\nthis.V=ClaimImportVersions;', context);
const {V} = context;
const plain = value => JSON.parse(JSON.stringify(value));

// Dòng giống parsedExcelBatchRows của excel-import.js
const row = (hsbt, extra = {}, top = {}) => ({rawBsx:extra.bienSo || '49A80132', rawSoHsbt:hsbt, rawVtt:'', rawDate:'22/10/2026', rawGara:extra.gara || '', rawAmount:'', targetStatus:extra.status || 'moi', rawStatusStr:'noStatus' in extra ? '' : (extra.status || 'Mới'), fullRowMeta:{khachHang:'KHÁCH ' + hsbt, gdvHo:'Huỳnh Văn Phúc', duPhongBoiThuong:'1000', ghiChu:'', ...extra.meta}, ...top});

test('keys: HSBT first, then VTT, then plate + date; punctuation and case ignored', () => {
  assert.equal(V.keyOf({soHoSoBoiThuong:'hsbt/xcg/2026/0098804'}), 'HSBT:HSBTXCG20260098804');
  assert.equal(V.keyOf({maVuTonThat:'VTT-1'}), 'VTT:VTT1');
  assert.equal(V.keyOf({bienSo:'49A-801.32', ngayVTT:'22/10/2026'}), 'BSX:49A80132@22102026');
  assert.equal(V.keyOf({}), '');
});

test('file rows: duplicates counted (last wins), rows without any key skipped, all-empty columns not "present"', () => {
  const file = V.rowsFromFile([row('A1'), row('A1', {status:'cho_gdct'}), {...row(''), rawBsx:''}]);
  assert.equal(Object.keys(file.rows).length, 1);
  assert.equal(file.duplicates, 1); assert.equal(file.skipped, 1);
  assert.equal(file.rows['HSBT:A1'].trangThai, 'cho_gdct');
  assert(!file.present.includes('ghiChu'), 'empty column must not be able to wipe data');
});

test('plan: add new, update changed fields only, remove HSBT claims missing from the file, keep manual claims', () => {
  const claims = {
    c1:{id:'c1', soHoSoBoiThuong:'A1', bienSo:'49A80132', trangThai:'moi', khachHang:'KHÁCH A1', duPhongBoiThuong:'1000', thongBaoGiamTru:{reason:'x'}},
    c2:{id:'c2', soHoSoBoiThuong:'A2', bienSo:'51K11111', trangThai:'moi'},
    manual:{id:'manual', bienSo:'30A99999', maVuTonThat:'', khachHang:'Tạo tay'}
  };
  const file = V.rowsFromFile([row('A1', {status:'da_gdct'}), row('A3')]);
  const p = V.plan(claims, file, null);
  assert.deepEqual(plain(p.summary), {added:1, changed:1, removed:1, unchanged:0, kept:1, duplicates:0, total:2});
  assert.equal(p.removed[0].id, 'c2');
  assert.equal(p.kept[0].id, 'manual');
  const fields = p.changed[0].changes.map(change => change.field);
  assert(fields.includes('trangThai'));
  assert(!fields.includes('thongBaoGiamTru'), 'app-only fields are never touched');
});

test('blank cells clear a value only if the previous file had written it (in-app edits survive)', () => {
  const claims = {c1:{id:'c1', importKey:'HSBT:A1', soHoSoBoiThuong:'A1', bienSo:'49A80132', gdvTiepNhan:'Sửa tay trong app', garaSuaChua:'Gara cũ', tenGara:'Gara cũ'}};
  const previous = {'HSBT:A1':{gdvTiepNhan:'Huỳnh Văn Phúc', garaSuaChua:'Gara cũ'}};
  const file = V.rowsFromFile([row('A1', {gara:''}), row('B9', {gara:'Gara mới'})]); // gara column present (B9) but blank for A1
  const changes = V.plan(claims, file, previous).changed[0].changes;
  const gara = changes.find(change => change.field === 'garaSuaChua');
  assert.equal(gara.to, '', 'value written by the previous file is cleared');
  assert(!changes.some(change => change.field === 'gdvTiepNhan' && change.to === ''), 'in-app edit is not cleared');
});

test('updates: only changed paths, removed claims nulled, new claims get importKey and no empty fields', () => {
  const claims = {c1:{id:'c1', soHoSoBoiThuong:'A1', bienSo:'49A80132', trangThai:'moi', khachHang:'KHÁCH A1', duPhongBoiThuong:'1000', gdvHo:'Huỳnh Văn Phúc'}, c2:{id:'c2', soHoSoBoiThuong:'A2'}};
  const p = V.plan(claims, V.rowsFromFile([row('A1', {status:'da_gdct'}), row('A3')]), null);
  const out = V.updates(p, {now:1, versionId:'v1', newId:() => 'n1'});
  assert.equal(out['pending_claims/c1/trangThai'], 'da_gdct');
  assert.equal(out['pending_claims/c1/importKey'], 'HSBT:A1');
  assert.equal(out['pending_claims/c1/khachHang'], undefined, 'unchanged field not rewritten');
  assert.equal(out['pending_claims/c2'], null);
  assert.equal(out['pending_claims/n1'].importKey, 'HSBT:A3');
  assert(!Object.values(out['pending_claims/n1']).includes(''));
});

test('re-importing the same file is a no-op apart from stamping the import key once', () => {
  const file = V.rowsFromFile([row('A1')]);
  const first = V.updates(V.plan({}, file), {now:1, versionId:'v1', newId:() => 'n1'});
  const claims = {n1:first['pending_claims/n1']};
  const again = V.plan(claims, file, file.rows);
  assert.deepEqual(plain(again.summary), {added:0, changed:0, removed:0, unchanged:1, kept:0, duplicates:0, total:1});
  assert.deepEqual(Object.keys(V.updates(again)), []);
});

test('diff between two files: added / removed / changed with labelled fields, key fields first', () => {
  const a = V.rowsFromFile([row('A1'), row('A2')]).rows;
  const b = V.rowsFromFile([row('A1', {status:'da_gdct', meta:{duPhongBoiThuong:'5000', khachHang:'KHÁCH MỚI'}}), row('A3')]).rows;
  const d = V.diffRows(a, b);
  assert.equal(d.added.length, 1); assert.equal(d.removed.length, 1); assert.equal(d.changed.length, 1);
  const fields = d.changed[0].fields;
  assert.equal(fields[0].field, 'trangThai', 'key fields sorted first');
  assert.equal(fields.find(item => item.field === 'duPhongBoiThuong').label, 'Dự phòng bồi thường');
  assert.equal(d.fieldCounts.duPhongBoiThuong, 1);
  assert.equal(V.diffRows(null, b).added.length, 2);
});

test('pack / unpack round-trips large data through gzip + base64 chunks', async () => {
  const data = {};
  for (let i = 0; i < 3000; i++) data['c' + i] = {id:'c' + i, khachHang:'Nguyễn Văn ' + i, ghiChu:'Ghi chú tiếng Việt có dấu ' + i};
  const chunks = await V.pack(data);
  assert(Array.isArray(chunks) && chunks.length >= 1);
  assert(chunks.join('').length < JSON.stringify(data).length / 3, 'compressed');
  assert.deepEqual(plain(await V.unpack(chunks)), data);
  assert.deepEqual(plain(await V.unpack({0:chunks[0], ...Object.fromEntries(chunks.slice(1).map((c, i) => [i + 1, c]))})), data);
  assert.equal(await V.unpack(await V.pack(null)), null);
});

test('a file without a status column never resets existing statuses; new claims still default to "moi"', () => {
  const claims = {c1:{id:'c1', importKey:'HSBT:A1', soHoSoBoiThuong:'A1', bienSo:'49A80132', trangThai:'da_thanh_toan'}};
  const file = V.rowsFromFile([row('A1', {noStatus:true}), row('A2', {noStatus:true})]);
  assert(!file.present.includes('trangThai'));
  const p = V.plan(claims, file, null);
  assert(!(p.changed[0]?.changes || []).some(change => change.field === 'trangThai'));
  const out = V.updates(p, {now:1, versionId:'v1', newId:() => 'n1'});
  assert.equal(out['pending_claims/n1'].trangThai, 'moi');
});

// ---- Tích hợp: nhập → nhập lại → so sánh → khôi phục, trên Firebase giả ----
function fakeDb(seed = {}) {
  const data = structuredClone(seed);
  const get = path => path.split('/').filter(Boolean).reduce((value, key) => value?.[key], data);
  const put = (path, value) => {
    const parts = path.split('/').filter(Boolean); if (!parts.length) { for (const key of Object.keys(data)) delete data[key]; Object.assign(data, structuredClone(value || {})); return; }
    let target = data; for (const key of parts.slice(0, -1)) target = target[key] ??= {};
    if (value === null || (typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length)) delete target[parts.at(-1)]; else target[parts.at(-1)] = structuredClone(value);
  };
  const ref = (path = '') => ({
    once:async () => { const value = get(path); return {val:() => value === undefined ? null : structuredClone(value), exists:() => value !== undefined && value !== null}; },
    set:async value => put(path, value),
    update:async values => { for (const [key, value] of Object.entries(values)) put([path, key].filter(Boolean).join('/'), value); }
  });
  return {data, ref};
}
function adminContext(db) {
  const ctx = vm.createContext({TextEncoder, TextDecoder, Blob, Response, CompressionStream, DecompressionStream, btoa, atob, Uint8Array, JSON, Date, Math, Promise, structuredClone,
    dbNodeInstance:db, activeUserProfile:{role:'Admin', displayName:'QTV'}, firebase:{auth:() => ({currentUser:{uid:'admin'}})}});
  vm.runInContext(fs.readFileSync(new URL('../js/features/claims/import-versions.js', import.meta.url), 'utf8') + '\nthis.V=ClaimImportVersions;', ctx);
  return ctx;
}

test('apply → apply → restore: versions are saved before writing, restore returns the exact previous data and is itself undoable', async () => {
  const db = fakeDb({pending_claims:{manual:{id:'manual', bienSo:'30A99999', khachHang:'Tạo tay'}, old:{id:'old', soHoSoBoiThuong:'Z9', bienSo:'51K1'}}});
  const {V: api} = adminContext(db);
  const before = structuredClone(db.data.pending_claims);

  const first = await api.apply(api.rowsFromFile([row('A1'), row('A2')]), {fileName:'thang9.xlsx'});
  assert.equal(first.planned.summary.added, 2); assert.equal(first.planned.summary.removed, 1);
  assert(db.data.pending_claims.manual, 'manual claim kept'); assert(!db.data.pending_claims.old, 'claim missing from the file is removed');
  assert.deepEqual(plain(await api.blob(first.entry.id, 'before')), before, 'backup taken before writing');

  const afterFirst = structuredClone(db.data.pending_claims);
  const second = await api.apply(api.rowsFromFile([row('A1', {status:'cho_gdct'}), row('A3')]), {fileName:'thang10.xlsx'});
  assert.equal(second.entry.prevVersionId, first.entry.id);
  assert.deepEqual(plain(second.planned.summary), {added:1, changed:1, removed:1, unchanged:0, kept:1, duplicates:0, total:2});

  const history = await api.list();
  assert.deepEqual(plain(history.map(item => item.fileName)), ['thang10.xlsx', 'thang9.xlsx'], 'newest first');
  const d = api.diffRows(await api.blob(first.entry.id, 'rows'), await api.blob(second.entry.id, 'rows'));
  assert.deepEqual(plain([d.added.length, d.removed.length, d.changed.length]), [1, 1, 1]);

  const restored = await api.restore(second.entry.id);
  assert.deepEqual(plain(db.data.pending_claims), plain(afterFirst), 'data is exactly as before the second import');
  assert.equal(restored.kind, 'restore');
  assert.equal((await api.list())[0].id, restored.id);
  // Hoàn tác khôi phục: khôi phục về trước bản "restore" → quay lại dữ liệu sau lần nhập thứ hai.
  const afterSecondRows = Object.values(await api.blob(restored.id, 'before')).map(claim => claim.soHoSoBoiThuong).sort();
  assert.deepEqual(plain(afterSecondRows.filter(Boolean)), ['A1', 'A3']);
});

test('non-admins cannot read history, apply or restore', async () => {
  const db = fakeDb({pending_claims:{}});
  const ctx = adminContext(db); ctx.activeUserProfile = {role:'GĐV'};
  await assert.rejects(ctx.V.list(), /quản trị viên/);
  await assert.rejects(ctx.V.apply(ctx.V.rowsFromFile([row('A1')])), /quản trị viên/);
  await assert.rejects(ctx.V.restore('x'), /quản trị viên/);
  assert.deepEqual(plain(db.data.pending_claims || {}), {}, 'nothing written');
});
