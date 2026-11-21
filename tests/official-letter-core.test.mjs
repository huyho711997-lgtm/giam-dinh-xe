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
  assert.ok(xml.includes('w:w="11906" w:h="16838"') && xml.includes('w:left="1701"') && xml.includes('w:top="1134"'));
  assert.ok(xml.includes('đề nghị cung cấp hồ sơ &amp; tài liệu &lt;tai nạn&gt;'));
  assert.ok(xml.includes('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM') && xml.includes('Nơi nhận:') && xml.includes('Số: ……/……'));
  for (const f of files) {
    const open = (f.text.match(/<w:(p|tbl|tr|tc|r|t)[ >]/g) || []).length, close = (f.text.match(/<\/w:(p|tbl|tr|tc|r|t)>/g) || []).length;
    assert.equal(open, close, f.path + ' lệch thẻ');
    assert.ok(!/<w:[a-zA-Z]+\s*>[^<]*<(?!\/|w:|cp:|dc:|dcterms:)/.test(f.text));
  }
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
