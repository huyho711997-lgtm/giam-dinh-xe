import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));
function load() {
  const context = vm.createContext({ Math, Number, String, Object, Array, JSON, Date, Set, Map, RegExp, Promise, Error });
  for (const f of ['js/features/ai/library-search.js', 'js/features/documents/official-letter-legal.js', 'js/features/documents/official-letter-qa.js']) vm.runInContext(read(f), context);
  vm.runInContext('this.Q = OfficialLetterQA; this.L = OfficialLetterLegal; this.S = TascoLibSearch;', context);
  return context;
}
const SOURCES = [
  { code: 'C1', id: 'luat:1', doc: 'Luật Kinh doanh bảo hiểm', soHieu: '08/2022/QH15', title: 'Điều 22. Thông báo tổn thất', text: 'Bên mua bảo hiểm thông báo tổn thất trong 05 ngày.', from: '2023-01-01', on: true },
  { code: 'C2', id: 'qt:4', doc: 'Quy tắc bảo hiểm xe', soHieu: '', title: 'Mục 4.1', text: 'Giảm trừ 10% nếu thông báo chậm.', from: '', on: true }
];

test('buildQueries: câu hỏi dài dùng nguyên văn; câu hỏi tiếp ngắn được ghép với câu hỏi trước', () => {
  const { Q } = load();
  assert.deepEqual(plain(Q.buildQueries('Thông báo tổn thất chậm quá hạn thì bị giảm trừ thế nào theo quy định?', [])), ['Thông báo tổn thất chậm quá hạn thì bị giảm trừ thế nào theo quy định?']);
  const q = plain(Q.buildQueries('còn xe chưa đóng phí?', [{ role: 'user', text: 'Giảm trừ khi thông báo chậm?' }, { role: 'assistant', text: 'x' }]));
  assert.equal(q.length, 2);
  assert.equal(q[1], 'Giảm trừ khi thông báo chậm? còn xe chưa đóng phí?');
  assert.deepEqual(plain(Q.buildQueries('   ', [])), []);
});

test('buildRequest: nguyên văn đoạn trích [C#], hồ sơ, lịch sử gần nhất; không có đoạn thì nói rõ', () => {
  const { Q } = load();
  const history = [];
  for (let i = 0; i < 20; i++) history.push({ role: i % 2 ? 'assistant' : 'user', text: 'tin ' + i }, { role: 'assistant', text: 'lỗi', error: true });
  const req = plain(Q.buildRequest({ question: 'Hạn thông báo?', sources: SOURCES, dossier: 'Biển số 47A-123', history }));
  const last = req.contents[req.contents.length - 1];
  assert.equal(last.role, 'user');
  assert.match(last.parts[0].text, /\[C1\] Luật Kinh doanh bảo hiểm \(số 08\/2022\/QH15\) – Điều 22\. Thông báo tổn thất \(hiệu lực từ 2023-01-01\)\nBên mua bảo hiểm thông báo tổn thất trong 05 ngày\./);
  assert.match(last.parts[0].text, /\[C2\] Quy tắc bảo hiểm xe – Mục 4\.1/);
  assert.match(last.parts[0].text, /HỒ SƠ ĐANG CHỌN:\nBiển số 47A-123/);
  assert.match(last.parts[0].text, /CÂU HỎI:\nHạn thông báo\?$/);
  assert.equal(req.contents.length, Q.MAX_TURNS * 2 + 1);                       // chỉ giữ các lượt gần nhất, bỏ tin lỗi
  assert.ok(req.contents.slice(0, -1).every(item => item.parts[0].text !== 'lỗi'));
  assert.match(req.system_instruction.parts[0].text, /mã nguồn/);
  assert.equal(req.generationConfig.responseMimeType, undefined);              // trả lời chữ thuần, không JSON mode
  const none = plain(Q.buildRequest({ question: 'x', sources: [], libraryError: 'Thư viện trống', history: [] }));
  assert.match(none.contents[0].parts[0].text, /không tìm thấy đoạn nào khớp câu hỏi — Thư viện trống/);
  assert.doesNotMatch(none.contents[0].parts[0].text, /HỒ SƠ ĐANG CHỌN/);
});

test('citedCodes / unknownCodes: mã được dẫn theo thứ tự, mã bịa bị phát hiện', () => {
  const { Q } = load();
  const text = 'Hạn là 5 ngày [C1]. Giảm 10% [C2][C1]. Ngoài ra [C9].';
  assert.deepEqual(plain(Q.citedCodes(text)), ['C1', 'C2', 'C9']);
  assert.deepEqual(plain(Q.unknownCodes(text, SOURCES)), ['C9']);
});

test('answerHtml: escape HTML, **đậm**, danh sách, mã nguồn thành nút, mã lạ bị đánh dấu', () => {
  const { Q } = load();
  const html = Q.answerHtml('**Kết luận:** <script>alert(1)</script> bị giảm trừ [C2].\n\n- Mục một [C1]\n- Mục hai [C7]\n\n1. Bước\n2) Bước hai\n# Tiêu đề', SOURCES);
  assert.doesNotMatch(html, /<script/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<b>Kết luận:<\/b>/);
  assert.match(html, /<button type="button" class="ola-cite" data-ol-qa-cite="C2"/);
  assert.match(html, /<ul><li>Mục một <button[^>]*data-ol-qa-cite="C1"[^>]*>C1<\/button><\/li><li>Mục hai <span class="ola-cite is-bad"[^>]*>C7\?<\/span><\/li><\/ul>/);
  assert.match(html, /<ol><li>Bước<\/li><li>Bước hai<\/li><\/ol>/);
  assert.match(html, /<p>Tiêu đề<\/p>/);
  assert.equal(Q.answerHtml('', SOURCES), '');
});

test('plainText bỏ ký hiệu đậm; normalizeStore lọc tin nhắn hỏng, cắt nguồn và số lượng', () => {
  const { Q } = load();
  assert.equal(Q.plainText('**Có** được [C1]'), 'Có được [C1]');
  const many = [];
  for (let i = 0; i < 40; i++) many.push({ role: i % 2 ? 'assistant' : 'user', text: 'n' + i, sources: i % 2 ? [{ ...SOURCES[0], text: 'x'.repeat(5000) }, { code: 'bad' }] : undefined });
  many.push(null, { role: 'system', text: 'x' }, { role: 'user', text: '   ' });
  const out = plain(Q.normalizeStore({ messages: many }));
  assert.equal(out.length, 24);
  assert.equal(out[out.length - 1].text, 'n39');
  const withSrc = out.find(item => item.role === 'assistant');
  assert.equal(withSrc.sources.length, 1);
  assert.equal(withSrc.sources[0].text.length, 1400);
  assert.deepEqual(plain(Q.normalizeStore(null)), []);
});

test('retrieve nhận minCoverage: câu hỏi tự nhiên dài vẫn ra đoạn khớp khi hạ ngưỡng', async () => {
  const { L, S, Q } = load();
  const docs = [{ id: 'luat', meta: { ten: 'Luật KDBH', trangThai: 'dang_hieu_luc' }, chunks: [{ t: 'Điều 22. Thông báo tổn thất', x: 'Bên mua bảo hiểm thông báo tổn thất cho doanh nghiệp bảo hiểm trong thời hạn 05 ngày.' }, { t: 'Điều 1. Phạm vi', x: 'Luật này quy định về kinh doanh bảo hiểm.' }] }];
  const context = vm.createContext({ TascoLibStore: { list: async () => docs, index: async () => S.build(docs) }, TascoLibSearch: S, Promise, Object, Array, String, Math, Set, Map, JSON, RegExp, Number });
  vm.runInContext(read('js/features/documents/official-letter-legal.js') + '\nthis.L = OfficialLetterLegal;', context);
  const question = 'Khách hàng thông báo tổn thất muộn so với thời hạn thì công ty xử lý ra sao hôm nay?';
  const strict = await context.L.retrieve([question], {});
  const loose = await context.L.retrieve([question], { minCoverage: Q.QA_COVERAGE, limit: Q.SOURCE_LIMIT });
  assert.equal(strict.sources.length, 0);
  assert.equal(loose.sources.length, 1);
  assert.equal(loose.sources[0].code, 'C1');
});

test('index.html nạp official-letter-qa.js sau ai, trước page', () => {
  const html = read('index.html');
  const at = name => html.indexOf('js/features/documents/official-letter-' + name + '.js');
  assert.ok(at('ai') > 0 && at('ai') < at('qa') && at('qa') < at('page'));
});
