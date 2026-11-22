import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = file => fs.readFileSync(new URL('../js/' + file, import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(read('data/official-letter-templates.js') + '\n' + read('features/documents/official-letter-core.js') + '\n;this.Core = OfficialLetterCore; this.Templates = OFFICIAL_LETTER_TEMPLATES;', context);
const {Core, Templates} = context;
const tpl = id => Core.findTemplate(id);

test('mẫu công văn: id duy nhất, trường/dàn ý hợp lệ, closing chỉ dùng khoá có thật', () => {
  const ids = new Set();
  for (const t of Templates) {
    assert.ok(!ids.has(t.id), 'trùng id ' + t.id); ids.add(t.id);
    assert.ok(t.name && t.group && t.purpose && t.outline.length, t.id);
    const keys = new Set(t.fields.map(f => f.key));
    assert.equal(keys.size, t.fields.length, 'trùng key trong ' + t.id);
    for (const f of t.fields) assert.ok(['text', 'textarea', 'date'].includes(f.type), f.key);
    for (const line of t.closing || []) for (const m of line.matchAll(/\{(\w+)\}/g)) assert.ok(keys.has(m[1]), t.id + ' closing dùng khoá lạ ' + m[1]);
  }
});

test('prefill: lấy từ hồ sơ + cài đặt đơn vị, bỏ giá trị rỗng/—', () => {
  const t = tpl('de_nghi_cung_cap_ho_so');
  const issuer = {contactPerson: 'Nguyễn A', phone: '0900000000'};
  const v = Core.prefillValues(t, {bienSo: '47A-123.45', chuXe: '—', khachHang: 'Công ty X', ngayVTT: '12/11/2026'}, issuer);
  assert.equal(v.plate, '47A-123.45'); assert.equal(v.insured, 'Công ty X'); assert.equal(v.lossDate, '12/11/2026');
  assert.equal(v.contactPerson, 'Nguyễn A'); assert.equal(v.phone, '0900000000'); assert.equal(v.location, '');
});

test('mergeAnalysis không ghi đè giá trị có sẵn; missingFields tính đúng', () => {
  const t = tpl('de_nghi_cung_cap_ho_so');
  const current = Core.prefillValues(t, {bienSo: '47A-1'}, {});
  const analysis = Core.parseAnalysis('```json\n{"fields":{"plate":"SAI","location":"QL14, Krông Pắc","khong_co":"x","insured":{"a":1}},"questions":[{"key":"insured","question":"Chủ xe là ai?"},{"key":"","question":""}],"notes":"ok"}\n```', t);
  assert.deepEqual(Object.keys(analysis.fields).sort(), ['location', 'plate']);
  assert.equal(analysis.questions.length, 1);
  const merged = Core.mergeAnalysis(t, current, analysis);
  assert.equal(merged.values.plate, '47A-1'); assert.equal(merged.values.location, 'QL14, Krông Pắc');
  assert.deepEqual(Array.from(merged.filledByAI), ['location']);
  const missing = Core.missingFields(t, merged.values).map(m => m.key);
  assert.ok(missing.includes('insured') && !missing.includes('plate') && !missing.includes('location'));
});

test('parseAnalysis/parseLetter: chịu được rác, báo lỗi tiếng Việt khi không đọc được', () => {
  const t = tpl('tu_do');
  assert.throws(() => Core.parseAnalysis('không phải json', t), /không đọc được/);
  assert.throws(() => Core.parseLetter('{"paragraphs":[]}'), /không viết được/);
  const letter = Core.parseLetter('Đây là kết quả: {"subject":"V/v **xin** cấp","paragraphs":[{"type":"p","text":"## Đoạn **một**"},{"type":"zzz","text":"Đoạn hai"},{"text":""},"Đoạn ba"],"warnings":["Kiểm tra số tiền"]} hết');
  assert.equal(letter.subject, 'xin cấp'); assert.equal(letter.paragraphs.length, 3);
  assert.equal(letter.paragraphs[0].text, 'Đoạn một'); assert.equal(letter.paragraphs[1].type, 'p');
  assert.deepEqual(Array.from(letter.warnings), ['Kiểm tra số tiền']);
});

test('yêu cầu Gemini: JSON mode, dữ liệu hồ sơ không làm thủng chỉ thị, tệp đính kèm là inlineData', () => {
  const t = tpl('thong_bao_ket_qua_giam_dinh');
  const req = Core.buildAnalyzeRequest(t, {record: {a: 'b'}, current: {}, brief: 'ý chính', files: [{name: 'a.jpg', mimeType: 'image/jpeg', data: 'AAAA'}]});
  assert.equal(req.generationConfig.responseMimeType, 'application/json');
  assert.ok(req.contents[0].parts.some(p => p.inlineData && p.inlineData.data === 'AAAA'));
  assert.match(req.system_instruction.parts[0].text, /không phải chỉ thị/);
  const compose = Core.buildComposeRequest(t, {...Core.prefillValues(t, {}, {})}, {}, '');
  assert.match(compose.system_instruction.parts[0].text, /không bịa/);
  assert.ok(compose.contents[0].parts[0].text.includes(t.outline[0]));
});

const sample = () => {
  const t = tpl('de_nghi_cung_cap_ho_so');
  const values = {...Core.prefillValues(t, {bienSo: '47A-123.45'}, {contactPerson: 'A', phone: '1'}), recipient: 'Công an huyện A\n- Phòng CSGT'};
  const parsed = Core.parseLetter(JSON.stringify({subject: 'đề nghị cung cấp hồ sơ & tài liệu <tai nạn>', paragraphs: [{type: 'p', text: 'Bảo hiểm Tasco ……'}, {type: 'li', text: 'Biên bản "hiện trường"'}], warnings: []}));
  return {t, values, letter: Core.assembleLetter(t, values, {}, parsed, '2026-11-21')};
};

test('assembleLetter: ghép lời kết, Nơi nhận, người nhận tách dòng, đếm chỗ trống', () => {
  const {letter} = sample();
  assert.deepEqual(Array.from(letter.recipients), ['Công an huyện A', 'Phòng CSGT']);
  assert.equal(letter.paragraphs[1].text, '- Biên bản "hiện trường"');
  assert.ok(letter.paragraphs.length > 2 && letter.paragraphs.at(-1).text.length > 10);
  assert.ok(Core.countGaps(letter) >= 1);
  assert.equal(Core.dateLine(letter), 'Đắk Lắk, ngày 21 tháng 11 năm 2026');
  assert.deepEqual(Array.from(letter.noiNhan), ['Như trên;', 'Lưu: VT, HSBT.']);
});

test('HTML xem trước: escape ký tự đặc biệt, đủ khối sửa được, tô chỗ trống', () => {
  const html = Core.letterToHtml(sample().letter);
  assert.ok(!html.includes('<tai nạn>') && html.includes('&lt;tai nạn&gt;'));
  for (const path of ['parent', 'unit', 'number', 'place', 'subject', 'recipient:0', 'recipient:1', 'para:0', 'noiNhan:0', 'signerTitle', 'signerName']) assert.ok(html.includes('data-lt="' + path + '"'), path);
  assert.ok(html.includes('class="ol-gap"'));
  assert.ok(!html.includes('undefined') && !html.includes('null'));
});

test('docx: XML cân thẻ, A4 + lề chuẩn, không "undefined", thoát ký tự, đủ phần', () => {
  const {letter} = sample();
  const files = Core.docxFiles(letter, 'Tiêu đề');
  assert.deepEqual(Array.from(files.map(f => f.path)), ['[Content_Types].xml', '_rels/.rels', 'word/_rels/document.xml.rels', 'word/document.xml', 'word/styles.xml', 'docProps/core.xml']);
  const xml = files.find(f => f.path === 'word/document.xml').text;
  assert.ok(!xml.includes('undefined') && !xml.includes('null'));
  assert.ok(xml.includes('w:w="11906" w:h="16838"') && xml.includes('w:left="1418"') && xml.includes('w:top="1135"') && xml.includes('w:right="851"') && xml.includes('w:bottom="851"'));
  assert.ok(xml.includes('đề nghị cung cấp hồ sơ &amp; tài liệu &lt;tai nạn&gt;'));
  assert.ok(xml.includes('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM') && xml.includes('Nơi nhận:') && xml.includes('Số: ……/……') && xml.includes('-----***-----'));
  assert.ok(xml.includes('V/v ') && !xml.includes('<w:drawing>'), 'không logo → không có drawing');
  for (const f of files) {
    const open = (f.text.match(/<w:(p|tbl|tr|tc|r|t)[ >]/g) || []).length, close = (f.text.match(/<\/w:(p|tbl|tr|tc|r|t)>/g) || []).length;
    assert.equal(open, close, f.path + ' lệch thẻ');
    assert.ok(!/<w:[a-zA-Z]+\s*>[^<]*<(?!\/|w:|cp:|dc:|dcterms:)/.test(f.text));
  }
});

test('docx: nhúng logo, tiêu đề in hoa, bỏ V/v khi loại công văn có tiêu đề', () => {
  const {letter} = sample();
  const logoBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 1, 2, 3]);
  const withTitle = {...letter, title: 'Thông báo kết quả giải quyết bồi thường'};
  const files = Core.docxFiles(withTitle, 'x', {logo: {bytes: logoBytes, ext: 'png', width: 962, height: 259}});
  const paths = Array.from(files.map(f => f.path));
  assert.ok(paths.includes('word/media/logo.png'));
  const byPath = path => files.find(f => f.path === path);
  assert.ok(byPath('[Content_Types].xml').text.includes('Extension="png"'));
  assert.ok(byPath('word/_rels/document.xml.rels').text.includes('Target="media/logo.png"'));
  const xml = byPath('word/document.xml').text;
  assert.ok(xml.includes('r:embed="rId2"') && xml.includes('<wp:inline'));
  assert.ok(xml.includes('THÔNG BÁO KẾT QUẢ GIẢI QUYẾT BỒI THƯỜNG') && xml.includes('w:val="28"'));
  assert.ok(!xml.includes('V/v '), 'có tiêu đề thì không in V/v dưới Số');
  assert.equal((xml.match(/<w:drawing>/g) || []).length, 1);
  for (const f of files.filter(item => item.text)) assert.equal((f.text.match(/<w:p[ >]/g) || []).length, (f.text.match(/<\/w:p>/g) || []).length, f.path);
});

test('bodyKinds: nhận diện tiêu đề, gạch đầu dòng, đoạn trích in nghiêng, câu kết', () => {
  const kinds = Array.from(Core.bodyKinds([
    {type: 'h', text: 'Căn cứ'}, {type: 'li', text: '- Điều 1'}, {type: 'p', text: 'Trích'}, {type: 'p', text: 'Nội dung điều khoản'},
    {type: 'li', text: '- ý trong trích'}, {type: 'p', text: 'Kết thúc trích'}, {type: 'p', text: 'Nội dung thường'}, {type: 'p', text: 'Trân trọng kính chào!'}
  ]));
  assert.equal(kinds[0], 'h'); assert.equal(kinds[1], 'li'); assert.equal(kinds[3], 'q'); assert.equal(kinds[4], 'liq');
  assert.equal(kinds[6], 'p'); assert.equal(kinds[7], 'end');
});

test('sanitizeLetter + letterToText + fileBaseName', () => {
  const {letter, values} = sample();
  const edited = Core.sanitizeLetter({...letter, subject: 'V/v   sửa  lại ', paragraphs: [{type: 'p', text: '  A   B '}, {type: 'p', text: ''}], recipients: ['', 'X']});
  assert.equal(edited.subject, 'sửa lại'); assert.equal(edited.paragraphs.length, 1); assert.equal(edited.paragraphs[0].text, 'A B'); assert.deepEqual(Array.from(edited.recipients), ['X']);
  const text = Core.letterToText(letter);
  assert.ok(text.includes('Nơi nhận:') && text.includes('Kính gửi:'));
  assert.match(Core.fileBaseName(letter, values), /^Cong-van-[A-Za-z0-9-]+$/);
});

test('phân tích thông minh: hiểu yêu cầu, thông tin bổ sung, dàn ý riêng, câu hỏi có phương án', () => {
  const t = tpl('de_nghi_cung_cap_ho_so');
  const a = Core.parseAnalysis(JSON.stringify({
    understanding: 'Xin sao lục biên bản vụ tai nạn ngày 12/11.',
    fields: {plate: '47A-1'},
    extras: [{label: 'Thời hạn phản hồi', value: '07 ngày'}, {label: '', value: 'x'}, {label: 'Rỗng', value: ''}],
    outline: ['1. Mở đầu **cảm ơn**', 'Nêu sự việc', '', 'Đề nghị cấp biên bản'],
    questions: [{key: 'recipient', question: 'Gửi cơ quan nào?', options: ['Công an cấp huyện', 'Công an cấp huyện', 'Phòng CSGT', 5, 'a', 'b']}, {key: 'khong_co', question: 'Câu 2?'}, {question: ''}]
  }), t);
  assert.equal(a.understanding, 'Xin sao lục biên bản vụ tai nạn ngày 12/11.');
  assert.deepEqual(JSON.parse(JSON.stringify(a.extras)), [{label: 'Thời hạn phản hồi', value: '07 ngày'}]);
  assert.deepEqual(Array.from(a.outline), ['Mở đầu cảm ơn', 'Nêu sự việc', 'Đề nghị cấp biên bản']);
  assert.deepEqual(Array.from(a.questions[0].options), ['Công an cấp huyện', 'Phòng CSGT', 'a', 'b']);
  assert.equal(a.questions[0].key, 'recipient'); assert.equal(a.questions[1].key, ''); assert.equal(a.questions.length, 2);
  const req = Core.buildAnalyzeRequest(t, {record: {}, current: {}, brief: 'x', files: [], answered: [{question: 'Gửi ai?', answer: 'CSGT'}], extras: [{label: 'A', value: 'B'}], outline: ['Ý đã duyệt']});
  const text = req.contents[0].parts[0].text;
  assert.ok(text.includes('ĐÃ LÀM RÕ') && text.includes('CSGT') && text.includes('Ý đã duyệt') && text.includes('DÀN Ý MẶC ĐỊNH'));
  assert.match(req.system_instruction.parts[0].text, /không hỏi điều đã có/);
});

test('soạn theo dàn ý người dùng duyệt + thông tin làm rõ, không dùng dàn ý mặc định', () => {
  const t = tpl('de_nghi_cung_cap_ho_so');
  const req = Core.buildComposeRequest(t, {plate: '47A-1'}, {}, 'ý chính', '', {outline: ['Chỉ viết đoạn riêng này'], extras: [{label: 'Thời hạn', value: '07 ngày'}], answers: [{question: 'Gửi ai?', answer: 'CSGT'}], understanding: 'Hiểu thế này'});
  const text = req.contents[0].parts[0].text;
  assert.ok(text.includes('Chỉ viết đoạn riêng này') && !text.includes(t.outline[0]));
  assert.ok(text.includes('Thời hạn') && text.includes('07 ngày') && text.includes('NGƯỜI DÙNG ĐÃ LÀM RÕ') && text.includes('CSGT') && text.includes('Hiểu thế này'));
  assert.ok(text.includes('đã duyệt'));
  const fallback = Core.buildComposeRequest(t, {}, {}, '', '', {outline: []}).contents[0].parts[0].text;
  assert.ok(fallback.includes(t.outline[0]));
});

test('mẫu "từ chối – thông số lốp": có trong danh sách, trường then chốt, prefill từ hồ sơ, số công văn = số hồ sơ', () => {
  const t = tpl('tu_choi_thong_so_lop');
  assert.ok(t, 'thiếu mẫu từ chối thông số lốp');
  assert.equal(Templates.at(-1).id, 'tu_do', 'mẫu tự do luôn đứng cuối');
  const required = t.fields.filter(f => f.required).map(f => f.key);
  for (const key of ['recipient', 'claimNo', 'plate', 'lossTime', 'standardTyre', 'fittedTyre']) assert.ok(required.includes(key), key + ' phải bắt buộc');
  const v = Core.prefillValues(t, {bienSo: '47A-570.85', soHoSoBoiThuong: 'HSBT/XCG/2026/0105661', khachHang: 'NGUYỄN NGỌC DŨNG', soGcn: 'VCX2603/473789', ngayVTT: '10/11/2026'}, {phone: '19001562', address: 'Hà Nội'});
  assert.equal(v.claimNo, 'HSBT/XCG/2026/0105661'); assert.equal(v.plate, '47A-570.85'); assert.equal(v.certificate, 'VCX2603/473789'); assert.equal(v.phone, '19001562');
  assert.equal(v.fittedTyre, '', 'thông số lốp đang lắp không được tự đoán');
  const parsed = Core.parseLetter(JSON.stringify({subject: 'thông báo kết quả giải quyết bồi thường', paragraphs: [{type: 'p', text: 'Lời đầu tiên…'}]}));
  const letter = Core.assembleLetter(t, v, {}, parsed, '2026-11-13');
  assert.equal(letter.number, 'HSBT/XCG/2026/0105661');
  assert.equal(Core.numberLine(letter), 'Số: HSBT/XCG/2026/0105661');
  const tail = letter.paragraphs.map(p => p.text);
  assert.ok(tail.includes('Công ty TNHH Bảo Hiểm Tasco – Điện thoại: 19001562') && tail.includes('Địa chỉ: Hà Nội') && tail.at(-1) === 'Trân trọng kính chào!');
  // mẫu khác không có numberKey → số để trống như cũ
  const other = tpl('de_nghi_cung_cap_ho_so');
  assert.equal(Core.assembleLetter(other, Core.prefillValues(other, {}, {}), {}, parsed, '2026-11-13').number, '');
});

test('công văn mẫu tham khảo: đưa vào yêu cầu soạn kèm cấm chép dữ kiện; mẫu không có sample thì không thêm', () => {
  const t = tpl('tu_choi_thong_so_lop');
  const text = Core.buildComposeRequest(t, Core.prefillValues(t, {bienSo: '47A-1'}, {}), {}, '').contents[0].parts[0].text;
  assert.match(text, /CÔNG VĂN MẪU THAM KHẢO/);
  assert.match(text, /không chép dữ kiện/);
  assert.ok(text.includes('| Trích') && text.includes('| Kết thúc trích'));
  assert.ok(!/47A-570\.85|NGUYỄN NGỌC|VA-1769601|0105661/.test(JSON.stringify(t.sample)), 'mẫu tham khảo phải ẩn thông tin cá nhân');
  const plain = tpl('de_nghi_cung_cap_ho_so');
  assert.ok(!/CÔNG VĂN MẪU THAM KHẢO/.test(Core.buildComposeRequest(plain, Core.prefillValues(plain, {}, {}), {}, '').contents[0].parts[0].text));
});

test('sửa công văn: tệp đính kèm đi kèm yêu cầu chỉnh dưới dạng inlineData, không có tệp thì chỉ văn bản', () => {
  const t = tpl('tu_choi_thong_so_lop');
  const none = Core.buildComposeRequest(t, {}, {}, 'sửa', 'bản nháp', {});
  assert.equal(none.contents[0].parts.length, 1);
  assert.ok(!/TỆP ĐÍNH KÈM CỦA NGƯỜI DÙNG/.test(none.contents[0].parts[0].text));
  const req = Core.buildComposeRequest(t, {}, {}, 'sửa', 'bản nháp', {files: [{name: 'giay-to.pdf', mimeType: 'application/pdf', data: 'QUJD'}, {name: 'anh.jpg', mimeType: 'image/jpeg', data: 'REVG'}, {name: 'hong', mimeType: '', data: ''}]});
  const parts = req.contents[0].parts;
  assert.equal(parts.length, 5); // văn bản + 2×(nhãn + dữ liệu); tệp rỗng bị bỏ
  assert.ok(/TỆP ĐÍNH KÈM CỦA NGƯỜI DÙNG \(2 tệp/.test(parts[0].text));
  assert.equal(parts[2].inlineData.mimeType, 'application/pdf'); assert.equal(parts[2].inlineData.data, 'QUJD');
  assert.ok(/giay-to\.pdf/.test(parts[1].text) && /anh\.jpg/.test(parts[3].text));
  assert.equal(parts[4].inlineData.mimeType, 'image/jpeg'); assert.equal(parts[4].inlineData.data, 'REVG');
});

test('prompt: có căn cứ thư viện thì phân tích không được hỏi/giả định "thiếu nguyên văn"; văn bản người dùng chọn thì bắt buộc trích', () => {
  const t = tpl('tu_choi_thong_so_lop');
  const analyze = req => req.contents[0].parts[0].text;
  const withLegal = analyze(Core.buildAnalyzeRequest(t, {brief: 'x', legal: '[C1] Quy tắc – Điều 10\nNguyên văn điều khoản', legalPinned: 'Quy tắc Tasco', mode: 'fast'}));
  assert.ok(withLegal.includes('Nguyên văn điều khoản') && withLegal.includes('ĐÃ CHỦ ĐỘNG CHỌN') && withLegal.includes('KHÔNG hỏi người dùng'));
  const pinnedOnly = analyze(Core.buildAnalyzeRequest(t, {brief: 'x', legalPinned: 'Quy tắc Tasco'}));
  assert.ok(pinnedOnly.includes('legalQueries') && !pinnedOnly.includes('CĂN CỨ TỪ THƯ VIỆN ĐÃ TRA SẴN'));
  assert.ok(!analyze(Core.buildAnalyzeRequest(t, {brief: 'x'})).includes('ĐÃ CHỦ ĐỘNG CHỌN'));
  const values = Core.prefillValues(t, {}, {});
  const compose = extra => Core.buildComposeRequest(t, values, {}, 'x', '', extra).contents[0].parts[0].text;
  const pin = compose({legal: '[C1] đoạn', legalPinned: 'Quy tắc Tasco', assumptions: ['a'], openQuestions: []});
  assert.ok(pin.includes('BẮT BUỘC viện dẫn') && pin.includes('ĐÃ ĐƯỢC GIẢI QUYẾT'));
  const auto = compose({legal: '[C1] đoạn'});
  assert.ok(!auto.includes('BẮT BUỘC viện dẫn') && auto.includes('không bắt buộc dùng'));
});

test('tài liệu cần có theo loại công văn: định nghĩa hợp lệ, tính thiếu/đủ, đưa vào prompt phân tích', () => {
  for (const t of Core.templates()) {
    const docs = Core.templateDocs(t);
    assert.equal(new Set(docs.map(d => d.key)).size, docs.length, t.id + ': khoá mục trùng');
    const fieldKeys = new Set(t.fields.map(f => f.key));
    for (const d of docs) { assert.ok(d.label && d.short && d.read && d.hint, t.id + '/' + d.key + ' thiếu mô tả'); assert.ok(d.fills.every(k => fieldKeys.has(k)), t.id + '/' + d.key + ': fills ngoài trường'); assert.ok(d.max >= 1 && d.max <= 6); }
  }
  assert.equal(Core.templateDocs(tpl('tu_do')).length, 0);
  const tyre = tpl('tu_choi_thong_so_lop');
  assert.deepEqual(Array.from(Core.templateDocs(tyre).filter(d => d.required).map(d => d.key)), ['dang_kiem', 'anh_lop', 'tem_cua']);
  const status = JSON.parse(JSON.stringify(Core.docsStatus(tyre, {dang_kiem: 1, anh_lop: 2})));
  assert.equal(status.haveRequired, 2); assert.equal(status.totalRequired, 3); assert.deepEqual(status.missingRequired.map(d => d.key), ['tem_cua']);
  const text = Core.buildAnalyzeRequest(tyre, {brief: 'x', docCounts: {dang_kiem: 1, anh_lop: 2}}).contents[0].parts[0].text;
  assert.ok(text.includes('TÀI LIỆU CẦN CÓ') && text.includes('[Đăng kiểm] (BẮT BUỘC) ĐÃ ĐÍNH KÈM 1 tệp') && text.includes('[Tem trên cửa] (BẮT BUỘC) CHƯA CÓ'));
  assert.ok(text.includes('inspectionNo, standardTyre') && text.includes('fittedTyre') && text.includes('ĐÚNG NGUYÊN VĂN'));
  assert.ok(!Core.buildAnalyzeRequest(tpl('tu_do'), {brief: 'x'}).contents[0].parts[0].text.includes('TÀI LIỆU CẦN CÓ'));
});

test('suy luận nghiệp vụ: buildReasonRequest chỉ gửi dữ kiện + căn cứ, parseReasoning chuẩn hoá và loại mã lạ', () => {
  const t = tpl('tu_choi_thong_so_lop');
  const req = Core.buildReasonRequest(t, {plate: '48H02598'}, {}, 'từ chối vì lốp', {keyFacts: ['Lốp lắp 275/65R18'], legal: '[C1] Điều 10 – điểm loại trừ', insights: [{level: 'warn', text: 'Thông số lệch'}], dossier: 'HS 0107621'});
  const text = req.contents[0].parts[0].text;
  assert.equal(req.system_instruction.parts[0].text, Core.REASON_SYSTEM);
  assert.equal(req.generationConfig.responseMimeType, 'application/json');
  assert.match(text, /Lốp lắp 275\/65R18/); assert.match(text, /\[C1\] Điều 10/); assert.match(text, /HS 0107621/); assert.match(text, /Thông số lệch/);
  assert.match(Core.REASON_SYSTEM, /không bịa/i);
  const plan = Core.parseReasoning('```json\n' + JSON.stringify({position: ' Từ chối bồi thường **vì** lốp khác thông số ', reasoning: [
    {point: 'Xe lắp lốp khác thông số kiểm định', facts: ['275/65R18 so với 255/65R18'], basis: '[C1]'}, {point: 'Không có BS07', facts: ['x'], basis: 'Điều 10'}, {point: ''}],
    checks: ['Đã xét ngoại lệ BS07'], objections: [{likely: 'Lốp cùng hãng', reply: 'Vẫn khác thông số'}, {likely: ''}], tone: 'nghiêm túc', opening: 'Nêu ngay kết quả', nextSteps: ['Gửi phản hồi trong 07 ngày'], risks: ['Kiểm tra lại BS07']}) + '\n```');
  assert.equal(plan.position, 'Từ chối bồi thường vì lốp khác thông số');
  assert.equal(plan.reasoning.length, 2);
  assert.equal(plan.reasoning[0].basis, 'C1'); assert.equal(plan.reasoning[1].basis, '');   // mã không đúng dạng C# bị bỏ
  assert.equal(plan.objections.length, 1);
  assert.throws(() => Core.parseReasoning('{"tone":"x"}'), /chưa lập được/);
  assert.throws(() => Core.parseReasoning('không phải json'), /không đọc được/);
  const block = Core.reasoningBlock(plan);
  assert.match(block, /KẾ HOẠCH LẬP LUẬN/); assert.match(block, /căn cứ \[C1\]/); assert.match(block, /Người nhận có thể thắc mắc: Lốp cùng hãng → Vẫn khác thông số/);
  assert.equal(Core.reasoningBlock(null), '');
});

test('soạn công văn: kế hoạch lập luận được đưa vào yêu cầu soạn; quy tắc văn phong cấm câu chào sáo và "Theo Căn cứ"; mẫu chỉ là khung', () => {
  const t = tpl('tu_choi_thong_so_lop');
  const plan = Core.parseReasoning(JSON.stringify({position: 'Từ chối vì lốp', reasoning: [{point: 'Lốp khác thông số', facts: ['275/65R18'], basis: 'C1'}], nextSteps: ['Phản hồi trong 07 ngày']}));
  const withPlan = Core.buildComposeRequest(t, {}, {}, '', '', {reasoning: plan}).contents[0].parts[0].text;
  assert.match(withPlan, /KẾ HOẠCH LẬP LUẬN/); assert.match(withPlan, /Lốp khác thông số/);
  assert.doesNotMatch(Core.buildComposeRequest(t, {}, {}, '', '', {}).contents[0].parts[0].text, /KẾ HOẠCH LẬP LUẬN/);
  assert.match(Core.COMPOSE_SYSTEM, /Lời đầu tiên/); assert.match(Core.COMPOSE_SYSTEM, /Theo Căn cứ/); assert.match(Core.COMPOSE_SYSTEM, /VÌ SAO/);
  const sample = Core.buildComposeRequest(t, {}, {}, '').contents[0].parts[0].text;
  assert.match(sample, /KHÔNG dùng lại câu mở, câu nối, câu kết của mẫu/);
  assert.match(sample, /KHÔNG phải câu chữ/);
  assert.doesNotMatch(t.outline.join(' '), /lời chào trân trọng/);
});
