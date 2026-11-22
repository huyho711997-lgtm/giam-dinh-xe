import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));
function load(extra = {}) {
  const context = vm.createContext({ Math, Number, String, Object, Array, JSON, Date, Set, Map, RegExp, Promise, Error, ...extra });
  for (const f of ['js/features/ai/library-search.js', 'js/features/documents/official-letter-dossier.js', 'js/features/documents/official-letter-legal.js'])
    vm.runInContext(read(f), context);
  vm.runInContext('this.L = OfficialLetterLegal; this.S = TascoLibSearch; this.D = OfficialLetterDossier;', context);
  return context;
}
const LUAT = { id: 'luat', meta: { ten: 'Luật Kinh doanh bảo hiểm', soHieu: '08/2022/QH15', trangThai: 'dang_hieu_luc', hieuLucTu: '2023-01-01', nguon: 'https://vbpl.vn/x' }, chunks: [
  { t: 'Chương IV › Điều 22. Thông báo tổn thất', x: 'Bên mua bảo hiểm có trách nhiệm thông báo tổn thất cho doanh nghiệp bảo hiểm trong thời hạn 05 ngày.' },
  { t: 'Chương IV › Điều 30. Giảm trừ số tiền bồi thường', x: 'Doanh nghiệp bảo hiểm có quyền giảm trừ số tiền bồi thường khi bên mua bảo hiểm vi phạm nghĩa vụ thông báo tổn thất.' },
  { t: 'Điều 1. Phạm vi điều chỉnh', x: 'Luật này quy định về kinh doanh bảo hiểm.' }] };
const ND = { id: 'nd', meta: { ten: 'Nghị định 67/2023/NĐ-CP về bảo hiểm bắt buộc TNDS', soHieu: '67/2023/NĐ-CP' }, chunks: [
  { t: 'Điều 15. Hồ sơ bồi thường', x: 'Hồ sơ bồi thường gồm: biên bản tai nạn của cơ quan công an, giấy chứng nhận bảo hiểm, giấy phép lái xe. Căn cứ Thông tư 04/2021/TT-BTC.' }] };
const CU = { id: 'cu', meta: { ten: 'Quy tắc cũ', trangThai: 'het_hieu_luc' }, chunks: [{ t: 'Điều 22. Thông báo tổn thất', x: 'Thông báo tổn thất trong 10 ngày.' }] };

test('buildQueries: theo tình huống hồ sơ (báo trễ, giảm trừ kèm tên vi phạm) + chủ đề mẫu + gợi ý AI, bỏ trùng', () => {
  const { L, D } = load();
  const dossier = D.build({ ngayTonThat: '05/03/2025', ngayThongBao: '15/03/2025', trangThai: 'cho_duyet_pasc',
    thongBaoGiamTru: { stage: 'Dự kiến áp dụng', rule: { custom: { on: true, title: 'Không bảo lưu hiện trường', rate: 10 } } } }, { today: '2025-04-01' });
  const q = plain(L.buildQueries({ id: 'thong_bao_ket_qua_giam_dinh' }, dossier, ['Giảm trừ số tiền bồi thường', 'giam tru so tien boi thuong']));
  assert.equal(q[0], 'Giảm trừ số tiền bồi thường');
  assert.ok(q.includes('thời hạn thông báo tổn thất cho doanh nghiệp bảo hiểm'));
  assert.ok(q.includes('Không bảo lưu hiện trường'));
  assert.ok(q.includes('loại trừ trách nhiệm bảo hiểm'));
  assert.equal(q.filter(x => /^gi[aả]m tr[uừ] s/i.test(x)).length, 1, 'bỏ trùng không phân biệt dấu');
  assert.ok(q.length <= 12);
  assert.deepEqual(plain(L.buildQueries({ id: 'tu_do' }, null, [])), []);
});

test('rank + thư viện thật (BM25): tìm đúng Điều, gộp truy vấn, bỏ văn bản hết hiệu lực, đánh mã C1..', () => {
  const { L, S } = load();
  const index = S.build([LUAT, ND, CU]);
  const sources = plain(L.rank(q => S.search(index, q, { limit: 4 }), ['thời hạn thông báo tổn thất', 'giảm trừ số tiền bồi thường', 'thông báo tổn thất']));
  assert.ok(sources.length >= 2);
  assert.deepEqual(sources.map(s => s.code), sources.map((_, i) => 'C' + (i + 1)));
  assert.ok(sources.some(s => /Điều 22/.test(s.title) && s.doc === 'Luật Kinh doanh bảo hiểm' && s.soHieu === '08/2022/QH15'));
  assert.ok(!sources.some(s => s.doc === 'Quy tắc cũ'), 'văn bản hết hiệu lực không được dùng');
  assert.equal(new Set(sources.map(s => s.id)).size, sources.length);
  const renum = plain(L.renumber(sources.slice(1)));
  assert.equal(renum[0].code, 'C1');
});

test('retrieve: thư viện trống / chưa nạp / lỗi đọc → báo rõ, không ném lỗi', async () => {
  assert.match((await load().L.retrieve(['x'])).error, /chưa sẵn sàng/);
  const empty = load({ TascoLibStore: { list: async () => [], index: async () => ({}) } });
  assert.match((await empty.L.retrieve(['x'])).error, /đang trống/);
  const broken = load({ TascoLibStore: { list: async () => { throw new Error('PERMISSION_DENIED'); } } });
  assert.match((await broken.L.retrieve(['x'])).error, /PERMISSION_DENIED/);
  const ok = load();
  ok.TascoLibStore = { list: async () => [LUAT, ND], index: async () => ok.S.build([LUAT, ND]) };
  vm.runInContext('globalThis.TascoLibStore = this.TascoLibStore;', ok);
  const res = plain(await ok.L.retrieve(['hồ sơ bồi thường biên bản tai nạn']));
  assert.equal(res.error, '');
  assert.equal(res.sources[0].soHieu, '67/2023/NĐ-CP');
});

test('promptBlock: mã nguồn, tên + số hiệu, mục, nguyên văn; bỏ nguồn đã tắt', () => {
  const { L, S } = load();
  const sources = plain(L.rank(q => S.search(S.build([LUAT, ND]), q, { limit: 4 }), ['thông báo tổn thất', 'hồ sơ bồi thường']));
  sources[1].on = false;
  const block = L.promptBlock(sources);
  assert.match(block, /^\[C1\] /);
  assert.ok(!block.includes('[' + sources[1].code + ']'));
  const luat = plain(L.rank(q => S.search(S.build([LUAT]), q, { limit: 1 }), ['thông báo tổn thất']));
  assert.match(L.promptBlock(luat), /\[C1\] Luật Kinh doanh bảo hiểm \(số 08\/2022\/QH15\) – Chương IV › Điều 22\. Thông báo tổn thất \(hiệu lực từ 2023-01-01\)\nBên mua bảo hiểm/);
  assert.equal(L.promptBlock([]), '');
});

test('verify: căn cứ có trong nguồn → ok kèm mã; điều/văn bản tự nhớ → chưa kiểm chứng', () => {
  const { L, S } = load();
  const sources = plain(L.rank(q => S.search(S.build([LUAT, ND]), q, { limit: 4 }), ['thông báo tổn thất', 'giảm trừ số tiền bồi thường', 'hồ sơ bồi thường']));
  const code = re => sources.find(s => re.test(s.title)).code;
  const text = 'Căn cứ khoản 1 Điều 22 Luật Kinh doanh bảo hiểm số 08/2022/QH15; Điều 30 Luật Kinh doanh bảo hiểm;\n'
    + 'Căn cứ Nghị định số 67/2023/NĐ-CP của Chính phủ; Điều 15 Nghị định 67/2023/NĐ-CP.\n'
    + 'Căn cứ Điều 99 Luật Kinh doanh bảo hiểm (bịa). Căn cứ Điều 22 Nghị định số 03/2021/NĐ-CP.\n'
    + 'Căn cứ Thông tư 04/2021/TT-BTC; Bộ luật Dân sự năm 2015. Theo quy định của Luật này và Quy tắc nêu trên.';
  const out = plain(L.verify(text, sources));
  const get = re => out.find(item => re.test(item.mention));
  assert.deepEqual(get(/^khoản 1 Điều 22/).codes, [code(/Điều 22/)]);
  assert.equal(get(/^Điều 30/).ok, true);
  assert.equal(get(/Nghị định số 67\/2023/).ok, true);
  assert.equal(get(/^Điều 15/).ok, true);
  assert.equal(get(/^Điều 99/).ok, false, 'điều không có trong nguồn');
  assert.equal(get(/^Điều 22 Nghị định số 03\/2021/).ok, false, 'đúng số điều nhưng sai văn bản');
  assert.equal(get(/Thông tư 04\/2021/).ok, true, 'được nêu trong nguyên văn nguồn');
  assert.equal(get(/Bộ luật Dân sự/).ok, false);
  assert.ok(!out.some(item => /Luật này|Quy tắc nêu trên/.test(item.mention)), 'không bắt cụm chung chung');
  assert.deepEqual(plain(L.verify('Đề nghị Quý cơ quan cung cấp biên bản.', sources)), []);
  // Hai điều của hai văn bản trong cùng một câu, nối bằng "và" / "khoản … Điều …"
  const pair = plain(L.verify('Căn cứ Điều 30 Luật Kinh doanh bảo hiểm và khoản 2 Điều 15 Nghị định 67/2023/NĐ-CP.', sources));
  assert.deepEqual(pair.map(item => [item.mention, item.ok]), [['Điều 30 Luật Kinh doanh bảo hiểm', true], ['khoản 2 Điều 15 Nghị định 67/2023/NĐ-CP', true]]);
});

test('verify: không có nguồn nào → mọi căn cứ đều chưa kiểm chứng', () => {
  const { L } = load();
  const out = plain(L.verify('Căn cứ Điều 22 Luật Kinh doanh bảo hiểm.', []));
  assert.equal(out.length, 1);
  assert.equal(out[0].ok, false);
});

test('prompt: phân tích xin legalQueries; soạn kèm CĂN CỨ TỪ THƯ VIỆN hoặc cấm viện dẫn khi không có; basis lọc mã lạ', () => {
  const context = vm.createContext({ Math, Number, String, Object, Array, JSON, Date, Set, Map });
  vm.runInContext(read('js/data/official-letter-templates.js') + '\n' + read('js/features/documents/official-letter-core.js') + '\nthis.C = OfficialLetterCore;', context);
  const { C } = context;
  const tpl = C.findTemplate('thong_bao_ket_qua_giam_dinh');
  assert.match(C.buildAnalyzeRequest(tpl, {}).system_instruction.parts[0].text, /"legalQueries"/);
  const parsed = plain(C.parseAnalysis(JSON.stringify({ legalQueries: ['thời hạn thông báo tổn thất', 7, '**giảm trừ**'] }), tpl));
  assert.deepEqual(parsed.legalQueries, ['thời hạn thông báo tổn thất', 'giảm trừ']);
  const withLegal = C.buildComposeRequest(tpl, {}, {}, '', '', { legal: '[C1] Luật KDBH – Điều 22\nNội dung' });
  assert.match(withLegal.contents[0].parts[0].text, /CĂN CỨ TỪ THƯ VIỆN \(nguyên văn[^\n]*\n\[C1\] Luật KDBH – Điều 22/);
  assert.match(withLegal.system_instruction.parts[0].text, /có đoạn trong "CĂN CỨ TỪ THƯ VIỆN" quy định ĐÚNG vấn đề đó/);
  assert.match(withLegal.system_instruction.parts[0].text, /tuyệt đối không dẫn văn bản\/điều nào khác theo trí nhớ/);
  assert.match(C.buildComposeRequest(tpl, {}, {}, '', '', {}).contents[0].parts[0].text, /CĂN CỨ TỪ THƯ VIỆN: \(không có — không viện dẫn điều luật cụ thể\)/);
  const letter = plain(C.parseLetter(JSON.stringify({ subject: 's', paragraphs: ['a'], basis: [{ code: 'c1', cite: 'Điều 22' }, { code: 'X9', cite: 'bịa' }, { code: 'C2' }] })));
  assert.deepEqual(letter.basis, [{ code: 'C1', cite: 'Điều 22' }, { code: 'C2', cite: '' }]);
  assert.doesNotMatch(read('js/data/official-letter-templates.js'), /Không viết điều luật cụ thể nếu không được cung cấp/);
});

test('index.html nạp official-letter-legal.js sau dossier, trước page', () => {
  const html = read('index.html');
  const at = name => html.indexOf('js/features/documents/official-letter-' + name + '.js');
  assert.ok(at('dossier') < at('legal') && at('legal') < at('page') && at('dossier') > 0);
});

test('chế độ soạn ngay: prompt phân tích hạn chế hỏi + xin giả định; soạn nhận giả định và điểm chưa rõ', () => {
  const context = vm.createContext({ Math, Number, String, Object, Array, JSON, Date, Set, Map });
  vm.runInContext(read('js/data/official-letter-templates.js') + '\n' + read('js/features/documents/official-letter-core.js') + '\nthis.C = OfficialLetterCore;', context);
  const { C } = context;
  const tpl = C.findTemplate('de_nghi_cung_cap_ho_so');
  const fastText = C.buildAnalyzeRequest(tpl, { mode: 'fast' }).contents[0].parts[0].text;
  assert.match(fastText, /CHẾ ĐỘ SOẠN NGAY/);
  assert.match(fastText, /tối đa 2 điểm/);
  assert.doesNotMatch(C.buildAnalyzeRequest(tpl, { mode: 'ask' }).contents[0].parts[0].text, /CHẾ ĐỘ SOẠN NGAY/);
  assert.deepEqual(plain(C.parseAnalysis(JSON.stringify({ assumptions: ['Gửi Công an huyện Krông Pắc', 3, '', '**Hạn 07 ngày**'] }), tpl).assumptions), ['Gửi Công an huyện Krông Pắc', 'Hạn 07 ngày']);
  const text = C.buildComposeRequest(tpl, {}, {}, '', '', { assumptions: ['Gửi Công an huyện Krông Pắc'], openQuestions: ['Có cần nhắc vụ việc đang điều tra?'] }).contents[0].parts[0].text;
  assert.match(text, /GIẢ ĐỊNH ĐÃ DÙNG[^\n]*\n- Gửi Công an huyện Krông Pắc/);
  assert.match(text, /ĐIỂM CHƯA RÕ[^\n]*\n- Có cần nhắc vụ việc đang điều tra\?/);
});

test('chỉ tìm căn cứ khi công văn cần: đề nghị/bổ sung/gara thì không, trừ khi người dùng nhắc căn cứ/giảm trừ/từ chối', () => {
  const { L, D } = load();
  const dossier = D.build({ ngayTonThat: '05/03/2025', ngayThongBao: '15/03/2025', trangThai: 'cho_duyet_pasc' }, { today: '2025-04-01' });
  for (const id of ['de_nghi_cung_cap_ho_so', 'thong_bao_bo_sung_ho_so', 'de_nghi_gara_cung_cap', 'tu_do'])
    assert.deepEqual(plain(L.buildQueries({ id }, dossier, ['quyền yêu cầu cung cấp tài liệu'], 'Xin Công an sao lục biên bản')), [], id);
  assert.ok(L.buildQueries({ id: 'thong_bao_bo_sung_ho_so' }, dossier, [], 'Nêu căn cứ thời hạn bổ sung hồ sơ').length > 0);
  assert.ok(L.buildQueries({ id: 'tu_do' }, dossier, [], 'Thông báo giảm trừ 10% do báo trễ').length > 0);
  assert.ok(L.buildQueries({ id: 'giai_trinh_tra_loi' }, dossier, [], '').length > 0);
});

test('lọc độ liên quan: đoạn chỉ trùng vài từ chung chung bị loại; tối đa 5 đoạn', () => {
  const { L, S } = load();
  const index = S.build([LUAT, ND]);
  assert.deepEqual(plain(L.rank(q => S.search(index, q, { limit: 4 }), ['bảo hiểm sức khoẻ người lao động nước ngoài'])), []);
  const hit = plain(L.rank(q => S.search(index, q, { limit: 4 }), ['thời hạn thông báo tổn thất']));
  assert.deepEqual(hit.map(s => s.title), ['Chương IV › Điều 22. Thông báo tổn thất']);
  assert.ok(L.coverage('thông báo tổn thất', { t: 'Điều 22', x: 'thông báo tổn thất' }) === 1);
  assert.ok(L.coverage('thông báo tổn thất', { t: 'Điều 1', x: 'thông tin chung' }) < 0.6);
});

test('prompt soạn: mặc định không viện dẫn, không mở đầu "Căn cứ…", tối đa 2 căn cứ đúng vấn đề', () => {
  const context = vm.createContext({ Math, Number, String, Object, Array, JSON, Date, Set, Map });
  vm.runInContext(read('js/data/official-letter-templates.js') + '\n' + read('js/features/documents/official-letter-core.js') + '\nthis.C = OfficialLetterCore;', context);
  const sys = context.C.buildComposeRequest(context.C.findTemplate('de_nghi_cung_cap_ho_so'), {}, {}, '', '', {}).system_instruction.parts[0].text;
  assert.match(sys, /mặc định KHÔNG viện dẫn điều luật/);
  assert.match(sys, /không mở đầu bằng "Căn cứ…"/);
  assert.match(sys, /tối đa 2 căn cứ/);
  assert.match(context.C.buildAnalyzeRequest(context.C.findTemplate('tu_do'), {}).system_instruction.parts[0].text, /ngược lại để \[\]/);
});

test('mẫu từ chối thông số lốp: tự tìm căn cứ trong Thư viện (loại trừ lốp/kiểm định)', () => {
  const { L } = load();
  assert.ok(L.needsBasis({ id: 'tu_choi_thong_so_lop' }, ''));
  const q = plain(L.buildQueries({ id: 'tu_choi_thong_so_lop' }, null, []));
  assert.ok(q.some(x => /thông số lốp/.test(x)) && q.some(x => /kiểm định/.test(x)));
});

const TASCO = { id: 'tasco', meta: { ten: 'Quy tắc bảo hiểm xe cơ giới Tasco', trangThai: 'dang_hieu_luc' }, chunks: [
  { t: 'Điều 10. Loại trừ bảo hiểm', x: 'Không bảo hiểm khi xe thay đổi thông số lốp la-zăng khác khuyến cáo của nhà sản xuất.' }] };
const OCAR = { id: 'ocar', meta: { ten: 'Quy tắc bảo hiểm xe cơ giới Ocar 360', trangThai: 'dang_hieu_luc' }, chunks: [
  { t: 'Điều 12. Loại trừ bảo hiểm', x: 'Không bảo hiểm khi xe thay đổi thông số lốp la-zăng khác khuyến cáo của nhà sản xuất.' }] };

test('matchDocs: khớp theo từ đặc trưng của tên/số hiệu, không chọn nhầm cả kho vì "quy tắc", "bảo hiểm"', () => {
  const { L } = load();
  const docs = [LUAT, ND, TASCO, OCAR];
  assert.deepEqual(plain(L.matchDocs(docs, 'đổi sang dùng Quy tắc bảo hiểm Tasco')), ['tasco']);
  assert.deepEqual(plain(L.matchDocs(docs, 'dẫn theo quy tắc Ocar 360')), ['ocar']);
  assert.deepEqual(plain(L.matchDocs(docs, 'căn cứ Nghị định 67/2023')), ['nd']);
  assert.deepEqual(plain(L.matchDocs(docs, 'viết ngắn gọn hơn, trang trọng hơn')), []);
  assert.deepEqual(plain(L.matchDocs(docs, 'dùng quy tắc bảo hiểm')), [], 'chỉ có từ chung chung → không chọn');
  assert.deepEqual(plain(L.matchDocs([], 'Tasco')), []);
  assert.ok(L.LEGAL_WORDS.test('thêm căn cứ về thời hạn'));
});

test('retrieve({docIds}): chỉ tìm trong văn bản được chọn (Tasco, không lẫn Ocar 360)', async () => {
  const ok = load();
  ok.TascoLibStore = { list: async () => [TASCO, OCAR], index: async () => ok.S.build([TASCO, OCAR]) };
  vm.runInContext('globalThis.TascoLibStore = this.TascoLibStore;', ok);
  const q = ['thay đổi thông số lốp la-zăng khuyến cáo nhà sản xuất'];
  const all = plain(await ok.L.retrieve(q));
  assert.ok(all.sources.some(s => s.doc.includes('Ocar')) && all.sources.some(s => s.doc.includes('Tasco')));
  const only = plain(await ok.L.retrieve(q, { docIds: ['tasco'] }));
  assert.ok(only.sources.length && only.sources.every(s => s.doc.includes('Tasco')));
  const docs = plain(await ok.L.listDocs());
  assert.deepEqual(docs.map(d => d.id), ['tasco', 'ocar']);
});

test('retrieve: văn bản được CHỌN mà truy vấn dài không đủ 60% từ → nới ngưỡng, vẫn lấy đoạn sát nhất trong văn bản đó', async () => {
  const QT = { id: 'qt', meta: { ten: 'Quy tắc bảo hiểm xe cơ giới Tasco', trangThai: 'dang_hieu_luc' }, chunks: [
    { t: 'Điều 10. Các điểm loại trừ chung (phần 2)', x: '4.1 Thay đổi thông số lốp và/hoặc đường kính la-zăng của xe với điều kiện phù hợp với hồ sơ của nhà sản xuất.' },
    { t: 'Điều 11. Giải quyết bồi thường', x: 'Thời hạn giải quyết bồi thường là 15 ngày.' }] };
  const query = 'điểm loại trừ chung thay đổi thông số lốp la-zăng thông số kỹ thuật khuyến cáo nhà sản xuất hồ sơ đăng kiểm xe ô tô bảo hiểm vật chất thời hạn hiệu lực giấy chứng nhận';
  const ctx = load();
  ctx.TascoLibStore = { list: async () => [QT, LUAT], index: async () => ctx.S.build([QT, LUAT]) };
  vm.runInContext('globalThis.TascoLibStore = this.TascoLibStore;', ctx);
  const strict = plain(await ctx.L.retrieve([query]));                      // không chọn văn bản: giữ bộ lọc chặt
  assert.equal(strict.sources.length, 0);
  const pinned = plain(await ctx.L.retrieve([query], { docIds: ['qt'] }));  // đã chọn: nới ngưỡng
  assert.equal(pinned.error, '');
  assert.ok(pinned.sources.length >= 1 && pinned.sources[0].id === 'qt:0' && pinned.sources.length <= 3);
});

// ---- Đọc toàn văn (Hỏi nghiệp vụ) ----
async function loadFull(docs) {
  const context = load();
  context.TascoLibStore = { list: async () => docs, index: async () => context.S.build(docs) };
  return context;
}

test('readFull: cấp nguyên mọi đoạn của văn bản đang hiệu lực, đánh mã C1…Cn theo thứ tự, bỏ văn bản hết hiệu lực', async () => {
  const { L } = await loadFull([LUAT, ND, CU]);
  const out = plain(await L.readFull(['giảm trừ']));
  assert.equal(out.error, '');
  assert.equal(out.sources.length, LUAT.chunks.length + ND.chunks.length, 'đủ mọi đoạn, kể cả đoạn không chứa từ khoá');
  assert.deepEqual(out.sources.map(source => source.code), out.sources.map((_, i) => 'C' + (i + 1)));
  assert.ok(out.sources.every(source => source.full === true));
  assert.ok(out.sources.some(source => /Phạm vi điều chỉnh/.test(source.title)), 'đoạn không liên quan từ khoá vẫn được cấp');
  assert.ok(!out.sources.some(source => /Quy tắc cũ/.test(source.doc)), 'văn bản hết hiệu lực bị bỏ');
  assert.deepEqual(out.included.map(doc => doc.chunks), [3, 1]);
  assert.deepEqual(out.skipped, []);
});

test('readFull: người dùng chọn văn bản thì chỉ đọc văn bản đó (kể cả đã hết hiệu lực)', async () => {
  const { L } = await loadFull([LUAT, ND, CU]);
  const out = plain(await L.readFull(['x'], { docIds: ['cu'] }));
  assert.equal(out.sources.length, 1);
  assert.equal(out.included[0].name, 'Quy tắc cũ');
});

test('readFull: vượt ngân sách thì đọc văn bản khớp câu hỏi nhất trước, văn bản không vừa vào danh sách skipped', async () => {
  const big = { id: 'big', meta: { ten: 'Văn bản dài', trangThai: 'dang_hieu_luc' }, chunks: [{ t: 'Điều 1', x: 'bồi thường tổn thất khấu hao '.repeat(60) }] };
  const small = { id: 'small', meta: { ten: 'Văn bản ngắn', trangThai: 'dang_hieu_luc' }, chunks: [{ t: 'Điều 9. Thương tật', x: 'Tỷ lệ thương tật gãy xương đòn là 8 phần trăm.' }] };
  const { L } = await loadFull([big, small]);
  const out = plain(await L.readFull(['tỷ lệ thương tật gãy xương đòn'], { budget: 400 }));
  assert.deepEqual(out.included.map(doc => doc.name), ['Văn bản ngắn']);
  assert.deepEqual(out.skipped.map(doc => doc.name), ['Văn bản dài']);
  assert.equal(out.sources.length, 1);
});

test('readFull: thư viện trống hoặc chưa nạp → báo lỗi, không ném ngoại lệ', async () => {
  const empty = await loadFull([]);
  assert.match((await empty.L.readFull(['x'])).error, /đang trống/);
  const none = load();
  assert.match((await none.L.readFull(['x'])).error, /chưa sẵn sàng/);
});
