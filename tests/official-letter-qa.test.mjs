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

test('nhận yêu cầu thêm quy tắc và giữ nguyên nội dung văn bản', () => {
  const {Q} = load();
  const text = 'Điều 4. Phạm vi\nBảo hiểm chi trả theo quy định.';
  assert.deepEqual(plain(Q.importRequest('Thêm quy tắc này vào cơ sở dữ liệu:\n' + text)), {intent:true, content:text});
  assert.deepEqual(plain(Q.importRequest(text + '\nLưu quy tắc vào thư viện')), {intent:true, content:text});
  assert.deepEqual(plain(Q.importRequest('Nạp tài liệu vào thư viện')), {intent:true, content:''});
  assert.deepEqual(plain(Q.importRequest('Điều 4 của quy tắc này quy định thế nào?')), {intent:false, content:''});
});

test('buildQueries: câu hỏi gốc đứng đầu, kế đến cụm AI lập, rồi từ điển nghiệp vụ; bỏ trùng; câu hỏi tiếp ngắn được ghép câu trước', () => {
  const { Q } = load();
  const long = 'Thông báo tổn thất chậm quá hạn thì bị giảm trừ thế nào theo quy định?';
  const base = plain(Q.buildQueries(long, []));
  assert.equal(base[0], long);
  assert.ok(base.includes('thời hạn thông báo tổn thất cho doanh nghiệp bảo hiểm'));        // từ điển: thông báo/chậm
  const withPlan = plain(Q.buildQueries(long, [], { issue: 'giảm trừ', queries: ['giảm trừ bồi thường vi phạm nghĩa vụ của chủ xe', 'Điều khoản mới tra'] }));
  assert.equal(withPlan[1], 'giảm trừ bồi thường vi phạm nghĩa vụ của chủ xe');
  assert.equal(withPlan.filter(item => item === 'giảm trừ bồi thường vi phạm nghĩa vụ của chủ xe').length, 1);
  assert.ok(withPlan.length <= 10);
  const q = plain(Q.buildQueries('còn xe chưa đóng phí?', [{ role: 'user', text: 'Giảm trừ khi thông báo chậm?' }, { role: 'assistant', text: 'x' }]));
  assert.equal(q[1], 'Giảm trừ khi thông báo chậm? còn xe chưa đóng phí?');
  assert.deepEqual(plain(Q.buildQueries('   ', [])), []);
});

test('glossaryQueries: khẩu ngữ → cụm theo ngôn ngữ quy tắc (vỏ pin → pin điện động cơ, tổn thất riêng, khấu hao)', () => {
  const { Q } = load();
  const g = plain(Q.glossaryQueries('tổn thất riêng phần vỏ pin có thuộc phạm vi không'));
  assert.ok(g.includes('pin điện động cơ xe ô tô điện') && g.includes('tổn thất riêng pin loại trừ bảo hiểm'));
  assert.ok(g.includes('các điểm loại trừ chung áp dụng cho các chương'));
  assert.ok(g.length <= 6);
  assert.deepEqual(plain(Q.glossaryQueries('xin chào')), []);
});

test('buildPlanRequest/parsePlan: JSON mode, nhận cả JSON bọc ```; lọc cụm ngắn/trùng, tối đa 8; lỗi → rỗng', () => {
  const { Q } = load();
  const req = plain(Q.buildPlanRequest('vỏ pin có được bồi thường không?', [{ role: 'user', text: 'câu trước' }]));
  assert.equal(req.generationConfig.responseMimeType, 'application/json');
  assert.match(req.contents[0].parts[0].text, /CÂU HỎI TRƯỚC[\s\S]*câu trước[\s\S]*CÂU HỎI CẦN TRA:\nvỏ pin/);
  const raw = '```json\n' + JSON.stringify({ issue: 'Vỏ pin có bị loại trừ?', queries: ['loại trừ pin', 'Loại trừ  pin', 'x', 'điều khoản bổ sung pin ngập nước', 1, ...Array.from({ length: 12 }, (_, i) => 'cụm tìm kiếm số ' + i)] }) + '\n```';
  const plan = plain(Q.parsePlan(raw));
  assert.equal(plan.issue, 'Vỏ pin có bị loại trừ?');
  assert.deepEqual(plan.queries.slice(0, 2), ['loại trừ pin', 'điều khoản bổ sung pin ngập nước']);
  assert.equal(plan.queries.length, 8);
  assert.deepEqual(plain(Q.parsePlan('không phải json')), { issue: '', queries: [] });
  assert.deepEqual(plain(Q.parsePlan('Kết quả: {"issue":"a","queries":["hai từ"]} xong')), { issue: 'a', queries: ['hai từ'] });
});

test('buildRequest: nguyên văn đoạn trích [C#], hồ sơ, lịch sử gần nhất; không có đoạn thì nói rõ', () => {
  const { Q } = load();
  const history = [];
  for (let i = 0; i < 20; i++) history.push({ role: i % 2 ? 'assistant' : 'user', text: 'tin ' + i }, { role: 'assistant', text: 'lỗi', error: true });
  const viaSources = [SOURCES[0], { ...SOURCES[1], via: 'Được dẫn chiếu: Điều 11' }];
  const req = plain(Q.buildRequest({ question: 'Hạn thông báo?', sources: viaSources, dossier: 'Biển số 47A-123', history, issue: 'Xác định hạn thông báo' }));
  const last = req.contents[req.contents.length - 1];
  assert.equal(last.role, 'user');
  assert.match(last.parts[0].text, /\[C1\] Luật Kinh doanh bảo hiểm \(số 08\/2022\/QH15\) – Điều 22\. Thông báo tổn thất \(hiệu lực từ 2023-01-01\)\nBên mua bảo hiểm thông báo tổn thất trong 05 ngày\./);
  assert.match(last.parts[0].text, /\[C2\] Quy tắc bảo hiểm xe – Mục 4\.1 \[đoạn bổ sung: Được dẫn chiếu: Điều 11\]/);
  assert.match(last.parts[0].text, /VẤN ĐỀ CẦN XÁC ĐỊNH[^\n]*\nXác định hạn thông báo/);
  assert.match(req.system_instruction.parts[0].text, /NGOẠI LỆ[\s\S]*điều khoản bảo hiểm bổ sung/);
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
  assert.match(html, /<b class="ola-h">Kết luận:<\/b>/);
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
  const kept = plain(Q.normalizeStore({ messages: [{ role: 'assistant', text: 'a', queries: ['q1', '', 'q2'], issue: 'i', sources: [{ ...SOURCES[0], via: 'Phần liền kề' }] }] }))[0];
  assert.deepEqual(kept.queries, ['q1', 'q2']);
  assert.equal(kept.sources[0].via, 'Phần liền kề');
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

test('expandSources: thêm phần liền kề của đoạn xếp hạng đầu + Điều được dẫn chiếu; không trùng; giới hạn tổng; đánh lại mã', () => {
  const { L } = load();
  const docs = [{ id: 'qt', meta: { ten: 'Quy tắc' }, chunks: [
    { t: 'CHƯƠNG II › Điều 11. Phạm vi bảo hiểm', x: 'Bảo hiểm tổn thất vật chất xe do tai nạn.' },
    { t: 'CHƯƠNG II › Điều 13. Loại trừ (phần 1)', x: '1. Không thuộc phạm vi theo quy định tại Điều 11 quy tắc này. 6. Tổn thất pin khi ngập nước.' },
    { t: 'CHƯƠNG II › Điều 13. Loại trừ (phần 2)', x: '7. Tổn thất riêng pin xe điện trừ trường hợp cùng một nguyên nhân với bộ phận khác.' },
    { t: 'CHƯƠNG II › Điều 14. Khấu hao', x: 'Khấu hao pin.' }] }];
  const base = L.rank(() => [{ docId: 'qt', index: 1, doc: docs[0], chunk: docs[0].chunks[1], score: 5 }], ['pin'], 5, { minCoverage: 0 });
  const out = plain(L.expandSources(docs, base, { max: 12 }));
  assert.deepEqual(out.map(source => source.id), ['qt:1', 'qt:2', 'qt:0']);
  assert.deepEqual(out.map(source => source.code), ['C1', 'C2', 'C3']);
  assert.match(out[1].via, /Phần liền kề/);
  assert.equal(out[2].via, 'Được dẫn chiếu: Điều 11');
  assert.match(out[1].text, /Tổn thất riêng pin xe điện trừ trường hợp/);
  assert.equal(plain(L.expandSources(docs, base, { max: 1 })).length, 1);          // không vượt giới hạn; đoạn gốc luôn được giữ
  assert.equal(plain(L.expandSources(docs, base, { maxRefs: 0 })).length, 2);
  assert.deepEqual(plain(L.expandSources(docs, [], {})), []);
});

test('retrieve {expand, perArticle}: một Điều dài không chiếm hết chỗ; có kèm phần liền kề', async () => {
  const { L, S } = load();
  const bs = Array.from({ length: 6 }, (_, i) => ({ t: 'CHƯƠNG VI › Điều 31. Bổ sung (phần ' + (i + 1) + ')', x: 'Điều khoản bảo hiểm bổ sung pin loại trừ mục ' + i + ' bảo hiểm tổn thất' }));
  const docs = [{ id: 'qt', meta: { ten: 'Quy tắc', trangThai: 'dang_hieu_luc' }, chunks: [{ t: 'CHƯƠNG II › Điều 13. Loại trừ (phần 1)', x: 'Loại trừ tổn thất riêng pin xe điện bảo hiểm' }, { t: 'CHƯƠNG II › Điều 13. Loại trừ (phần 2)', x: 'trừ trường hợp cùng một nguyên nhân' }, ...bs] }];
  const context = vm.createContext({ TascoLibStore: { list: async () => docs, index: async () => S.build(docs) }, TascoLibSearch: S, Promise, Object, Array, String, Math, Set, Map, JSON, RegExp, Number });
  vm.runInContext(read('js/features/documents/official-letter-legal.js') + '\nthis.L = OfficialLetterLegal;', context);
  const query = 'pin loại trừ bảo hiểm tổn thất';
  const plainRun = plain(await context.L.retrieve([query], { limit: 4, minCoverage: 0.3 }));
  const capped = plain(await context.L.retrieve([query], { limit: 4, minCoverage: 0.3, perArticle: 2 }));
  const art31 = result => result.sources.filter(source => /Điều 31/.test(source.title)).length;
  assert.ok(art31(plainRun) > 2 && art31(capped) <= 2);
  const expanded = plain(await context.L.retrieve([query], { limit: 4, minCoverage: 0.3, perArticle: 2, expand: true, maxSources: 12 }));
  assert.ok(expanded.sources.some(source => /Điều 13/.test(source.title) && /phần 2/.test(source.title)));
  assert.ok(expanded.sources.length <= 12 && expanded.sources.every((source, i) => source.code === 'C' + (i + 1)));
});

test('index.html nạp official-letter-qa.js sau ai, trước page', () => {
  const html = read('index.html');
  const at = name => html.indexOf('js/features/documents/official-letter-' + name + '.js');
  assert.ok(at('ai') > 0 && at('ai') < at('qa') && at('qa') < at('page'));
});

test('answerHtml: KHÔNG tô màu kết luận — chữ đậm giữ nguyên, cụm "được bồi thường/bị loại trừ" là chữ thường', () => {
  const { Q } = load();
  const html = Q.answerHtml('**Kết luận:** lốp **không** được miễn khấu hao; xe **Có** điều kiện.\n\n- **Không được bồi thường** phần vỏ pin [C1].\n- Tổn thất **thuộc phạm vi** bảo hiểm.\n- Phần này bị loại trừ theo Điều 13, nhưng được bồi thường nếu đồng thời hư hỏng.\n- Thông tin không liên quan đến **Điều 13**; không gian nhà xe.', SOURCES);
  assert.ok(!/ola-(yes|no)/.test(html), 'không còn class tô màu xanh/đỏ');
  assert.match(html, /<b>không<\/b> được miễn khấu hao/);
  assert.match(html, /<b>Có<\/b> điều kiện/);
  assert.match(html, /<b>Không được bồi thường<\/b>/);
  assert.match(html, /<b>thuộc phạm vi<\/b>/);
  assert.ok(!/<span class="ola-/.test(html.replace(/<span class="ola-cite[^>]*>[^<]*<\/span>/g, '')), 'cụm kết luận không bị bọc span');
  assert.match(html, /<b class="ola-h">Kết luận:<\/b>/);
  assert.match(html, /<b>Điều 13<\/b>/);
  assert.match(html, /data-ol-qa-cite="C1"/);
});

test('answerHtml: gạch chân đề mục (đậm đứng riêng một dòng hoặc nhãn Kết luận/Căn cứ/Điều kiện…), chữ đậm thường thì không', () => {
  const { Q } = load();
  const html = Q.answerHtml('**Kết luận**\n- Khi khách hàng **không tham gia BS07** thì **thay đổi thông số lốp** bị loại trừ.\n\n**Căn cứ**\n- C1 – **BS07**: có hiệu lực.\n\n**Điều kiện, ngoại lệ cần kiểm tra**\n1. **Có BS07 hay không** trong hợp đồng.\n\n**Cần xác nhận thêm:** số khung.', SOURCES);
  assert.match(html, /<p><b class="ola-h">Kết luận<\/b><\/p>/);
  assert.match(html, /<p><b class="ola-h">Căn cứ<\/b><\/p>/);
  assert.match(html, /<p><b class="ola-h">Điều kiện, ngoại lệ cần kiểm tra<\/b><\/p>/);
  assert.match(html, /<b class="ola-h">Cần xác nhận thêm:<\/b> số khung/);
  assert.match(html, /<b>BS07<\/b>/);                 // chữ đậm trong danh sách không bị gạch chân
  assert.match(html, /<b>thay đổi thông số lốp<\/b>/);
  assert.match(html, /<b>Có BS07 hay không<\/b>/);   // chữ kết luận chỉ in đậm, không tô màu, không gạch chân
});

test('isSmallTalk: chào hỏi / hỏi về trợ lý → trò chuyện; câu nghiệp vụ không bao giờ lọt vào', () => {
  const { Q } = load();
  for (const text of ['bạn làm được gì', 'Bạn làm được gì?', 'bạn là ai', 'bạn có thể giúp gì cho tôi', 'xin chào', 'Chào bạn', 'hello', 'cảm ơn', 'ok', 'bạn tên gì', 'hướng dẫn sử dụng tính năng này']) assert.equal(Q.isSmallTalk(text), true, text);
  for (const text of ['xe thay đổi thông số lốp có được bồi thường không', 'chào bạn, xe ngập nước có được bồi thường không', 'thông báo tổn thất chậm thì sao', 'ok còn trường hợp xe chưa đóng phí thì sao', 'hi', '']) assert.equal(Q.isSmallTalk(text), text === 'hi', text);
});

test('parsePlan: kind "chat" chỉ có hiệu lực khi không có cụm tra; buildChatRequest không kèm thư viện/nguồn', () => {
  const { Q } = load();
  assert.equal(Q.parsePlan('{"kind":"chat","issue":"","queries":[]}').chat, true);
  assert.equal(Q.parsePlan('{"kind":"chat","issue":"x","queries":["phạm vi bảo hiểm"]}').chat, undefined);
  assert.equal(Q.parsePlan('{"kind":"lookup","issue":"x","queries":[]}').chat, undefined);
  assert.match(Q.buildPlanRequest('chào', []).system_instruction.parts[0].text, /"kind"/);
  const req = Q.buildChatRequest({question: 'bạn làm được gì', history: [{role: 'user', text: 'a'}, {role: 'assistant', text: 'b'}]});
  assert.equal(req.system_instruction.parts[0].text, Q.CHAT_SYSTEM);
  assert.equal(req.contents.length, 3);
  assert.equal(req.contents.at(-1).parts[0].text, 'bạn làm được gì');
  assert.doesNotMatch(JSON.stringify(req.contents), /TRÍCH ĐOẠN THƯ VIỆN/);
  assert.match(Q.CHAT_SYSTEM, /không gắn mã nguồn/);
  assert.equal(Q.normalizeMessage({role: 'assistant', text: 'chào', chat: true}).chat, true);
});

test('qaComposerHtml: hiển thị animation loading trong khung nhập chat khi đang suy luận / xử lý', () => {
  const host = { querySelector: () => null, querySelectorAll: () => [], removeEventListener() {} };
  const ctx = vm.createContext({
    console, setTimeout, clearTimeout, Date, Math, Array, Object, Set, JSON, Promise, String, Number, Error,
    window: { removeEventListener() {}, innerWidth: 1280 },
    document: { removeEventListener() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    OfficialLetterQA: { newId: () => 'qa_1', normalizeStore: () => [], SUGGESTIONS: [] },
    testHost: host
  });
  const expose = `host=testHost; renderAll=() => {}; updateHistory=() => {};
    return { qaComposerHtml, setQa: v => Object.assign(qa, v) };`;
  vm.runInContext(
    read('js/data/official-letter-templates.js')
    + read('js/features/documents/official-letter-core.js')
    + read('js/features/documents/official-letter-revisions.js')
    + read('js/features/documents/official-letter-page.js').replace('return {mount, leave};', expose)
    + '\nthis.page = OfficialLetterPage;',
    ctx
  );

  ctx.page.setQa({ busy: false, status: '', importFile: null });
  const idleHtml = ctx.page.qaComposerHtml(false);
  assert.doesNotMatch(idleHtml, /ola-qa-loading|is-busy|aria-busy="true"/);
  assert.match(idleHtml, /data-ol-act="qa-send"/);

  ctx.page.setQa({ busy: true, status: 'Đang suy luận sâu (có thể mất 30–90 giây)…', importFile: { name: 'Nghị định 67.pdf' } });
  const busyHtml = ctx.page.qaComposerHtml(false);
  assert.match(busyHtml, /ola-qa-composer is-up is-busy/);
  assert.match(busyHtml, /aria-busy="true"/);
  assert.match(busyHtml, /class="ola-qa-loading"/);
  assert.match(busyHtml, /class="ola-qa-loading-orbit"/);
  assert.match(busyHtml, /class="ola-qa-loading-wave"/);
  assert.match(busyHtml, /data-ol-qa-status>Đang suy luận sâu/);
  assert.match(busyHtml, /data-ol-act="qa-stop"/);
  assert.match(busyHtml, /data-ol-act="qa-remove-file"[^>]*disabled/);
});

test('carrySources: mang đoạn đã dẫn ở câu trả lời trước sang lượt sau, không trùng, đánh lại mã C1…Cn', () => {
  const { Q } = load();
  const old = [
    { code: 'C1', id: 'qt:13', doc: 'Quy tắc', title: 'Điều 13 mục 7', text: 'Loại trừ tổn thất riêng lót gầm xe…' },
    { code: 'C2', id: 'qt:9', doc: 'Quy tắc', title: 'Điều 9', text: 'Phạm vi' },
    { code: 'C3', id: 'qt:20', doc: 'Quy tắc', title: 'Điều 20', text: 'Không được dẫn' }
  ];
  const history = [
    { role: 'user', text: 'chắn gầm có được bồi thường không' },
    { role: 'assistant', text: '**Không** nếu chỉ riêng chắn gầm [C1]. Phạm vi chung [C2].', sources: old },
    { role: 'user', text: 'còn lót gầm?' },
    { role: 'assistant', text: 'Chào bạn', chat: true, sources: [] }
  ];
  const fresh = [{ code: 'C1', id: 'qt:9', doc: 'Quy tắc', title: 'Điều 9', text: 'Phạm vi' }, { code: 'C2', id: 'qt:30', doc: 'Quy tắc', title: 'Điều 30', text: 'Khác' }];
  const merged = plain(Q.carrySources(history, fresh));
  assert.deepEqual(merged.map(s => s.id), ['qt:9', 'qt:30', 'qt:13'], 'đoạn mới đứng trước, đoạn cũ đã dẫn thêm sau, bỏ trùng và bỏ đoạn không được dẫn');
  assert.deepEqual(merged.map(s => s.code), ['C1', 'C2', 'C3']);
  assert.equal(merged[2].carried, true);
  assert.equal(merged[0].carried, undefined);
  assert.equal(plain(Q.carrySources([], fresh)).length, 2);
  // giới hạn số đoạn mang sang
  const many = Array.from({ length: 9 }, (_, i) => ({ code: 'C' + (i + 1), id: 'x:' + i, doc: 'D', title: 'T' + i, text: 't' }));
  const big = plain(Q.carrySources([{ role: 'assistant', text: many.map(s => '[' + s.code + ']').join(' '), sources: many }], []));
  assert.equal(big.length, Q.CARRY_MAX);
});

test('buildRequest: bỏ mã [C#] cũ trong lịch sử, gắn nhãn đoạn đã dẫn ở câu trước, có quy tắc đối chiếu và rà loại trừ trước', () => {
  const { Q } = load();
  const sources = [{ ...SOURCES[0] }, { ...SOURCES[1], carried: true }];
  const history = [{ role: 'user', text: 'câu 1' }, { role: 'assistant', text: 'Có [C4] và [C12].' }];
  const req = plain(Q.buildRequest({ question: 'vậy sao câu trước trả lời có', sources, history }));
  const assistant = req.contents.find(c => c.role === 'model');
  assert.equal(assistant.parts[0].text, 'Có và.');
  assert.match(req.contents[req.contents.length - 1].parts[0].text, /\[C2\] Quy tắc bảo hiểm xe – Mục 4\.1 \[đã dẫn ở câu trả lời trước\]/);
  const system = req.system_instruction.parts[0].text;
  assert.match(system, /LOẠI TRỪ TRƯỚC KHI KẾT LUẬN "CÓ"/);
  assert.match(system, /Đối chiếu với câu trước/);
  assert.match(system, /Cùng một tình huống phải cho cùng một kết luận/);
});

test('buildQueries: câu phản biện / hỏi lại bám chủ đề câu hỏi trước; glossary chắn gầm kéo điểm loại trừ liệt kê bộ phận', () => {
  const { Q } = load();
  const history = [{ role: 'user', text: 'tổn thất riêng phần chắn gầm thì có được bồi thường không' }, { role: 'assistant', text: 'Có', sources: [] }, { role: 'user', text: 'riêng mỗi chắn gầm vẫn được bồi thường à' }, { role: 'assistant', text: 'Không', sources: [] }];
  const queries = Q.buildQueries('vậy sao câu hỏi trước lại trả lời là có', history, { queries: [], issue: '' });
  assert.ok(queries.some(q => q === 'riêng mỗi chắn gầm vẫn được bồi thường à'), 'chủ đề câu trước');
  assert.ok(queries.some(q => q === 'tổn thất riêng phần chắn gầm thì có được bồi thường không'), 'chủ đề trước nữa');
  const gloss = Q.glossaryQueries('chắn gầm có được bồi thường không');
  assert.ok(gloss.some(q => /lót gầm xe/.test(q) && /chắn bùn/.test(q)));
});

test('buildPlanRequest: kèm tóm tắt câu trả lời trước (đã bỏ mã nguồn) để bước tra cứu hiểu câu phản biện', () => {
  const { Q } = load();
  const req = plain(Q.buildPlanRequest('sao câu trước lại là có', [{ role: 'user', text: 'chắn gầm được bồi thường không' }, { role: 'assistant', text: '**Có** theo phạm vi [C4].' }]));
  const text = req.contents[0].parts[0].text;
  assert.match(text, /CÂU TRẢ LỜI TRƯỚC[^\n]*\n\*\*Có\*\* theo phạm vi\./);
  assert.ok(!/\[C4\]/.test(text));
});
