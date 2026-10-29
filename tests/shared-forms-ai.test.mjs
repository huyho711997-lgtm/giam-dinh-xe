import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/documents/shared-forms-ai.js', import.meta.url), 'utf8');
const context = vm.createContext({ console, JSON, Map, Set, Array, Object, Number, String, Math });
vm.runInContext(`${source}\n;this.api = SharedFormsAI;`, context);
const api = context.api;

const run = (text, bold) => `<w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`;
const para = (...runs) => `<w:p><w:pPr/>${runs.join('')}</w:p>`;
const doc = body => `<w:document><w:body>${body}</w:body></w:document>`;

test('đọc đoạn: bỏ đoạn trống, ghép các run, giải mã thực thể XML', () => {
  const xml = doc(para(run('Kính gửi: ', true), run('Công ty &amp; Co')) + para() + para(run('Biển số: ……')));
  const found = api.readParagraphs(xml);
  assert.deepEqual(JSON.parse(JSON.stringify(found.map(p => [p.id, p.text]))), [[0, 'Kính gửi: Công ty & Co'], [2, 'Biển số: ……']]);
});

test('áp dụng sửa: giữ nguyên định dạng của run không đụng tới', () => {
  const xml = doc(para(run('Biển số: ', true), run('……')));
  const out = api.applyEdits(xml, [{ id: 0, text: 'Biển số: 51H-123.45' }]);
  assert.match(out, /<w:b\/><\/w:rPr><w:t xml:space="preserve">Biển số: <\/w:t><\/w:r>/);
  assert.match(out, /<w:r><w:t xml:space="preserve">51H-123\.45<\/w:t><\/w:r>/);
  assert.equal((out.match(/<w:t /g) || []).length, 2);
});

test('áp dụng sửa: sửa chỗ nằm giữa nhiều run và mã hoá ký tự đặc biệt', () => {
  const xml = doc(para(run('Chủ xe: '), run('…… ', true), run('(CMND)')));
  const out = api.applyEdits(xml, [{ id: 0, text: 'Chủ xe: A & B <x> (CMND)' }]);
  const text = api.readParagraphs(out)[0].text;
  assert.equal(text, 'Chủ xe: A & B <x> (CMND)');
  assert.ok(out.includes('A &amp; B &lt;x&gt;'));
});

test('áp dụng sửa: xoá bớt chữ trải qua nhiều run', () => {
  const xml = doc(para(run('Ngày '), run('01/01/2020', true), run(' (cũ)')));
  const out = api.applyEdits(xml, [{ id: 0, text: 'Ngày 25/10/2026' }]);
  assert.equal(api.readParagraphs(out)[0].text, 'Ngày 25/10/2026');
});

test('áp dụng sửa: bỏ qua id không tồn tại, không đổi đoạn khác', () => {
  const xml = doc(para(run('A')) + para(run('B')));
  const out = api.applyEdits(xml, [{ id: 9, text: 'X' }, { id: 1, text: 'B2' }]);
  assert.deepEqual(JSON.parse(JSON.stringify(api.readParagraphs(out).map(p => p.text))), ['A', 'B2']);
});

test('đoạn lồng trong hộp văn bản không bị coi là đoạn ngoài cùng', () => {
  const nested = '<w:p><w:r><w:txbxContent><w:p><w:r><w:t>trong hộp</w:t></w:r></w:p></w:txbxContent></w:r></w:p>';
  const found = api.readParagraphs(doc(nested + para(run('Ngoài'))));
  assert.equal(found.length, 1);
  assert.equal(found[0].text, 'Ngoài');
});

test('mô tả hồ sơ: bỏ ảnh/đường dẫn/chuỗi dài, làm phẳng đối tượng 1 cấp', () => {
  const fields = api.describeRecord({ bienSo: '51H-1', hinhAnh: ['x'], anhDaiDien: 'data', url: 'http://x', ghiChu: 'a'.repeat(400), nguoiTao: { tenHienThi: 'An' }, soTien: 5000, rong: '  ' });
  assert.deepEqual(JSON.parse(JSON.stringify(fields)), { bienSo: '51H-1', 'nguoiTao.tenHienThi': 'An', soTien: 5000 });
});

test('đọc phản hồi AI: chấp nhận ```json, loại id lạ/không đổi/trùng', () => {
  const paras = [{ id: 0, text: 'Biển số: ……' }, { id: 2, text: 'Chủ xe: ……' }];
  const raw = '```json\n' + JSON.stringify({ edits: [{ id: 0, text: 'Biển số: 51H' }, { id: 7, text: 'x' }, { id: 2, text: 'Chủ xe: ……' }, { id: 0, text: 'khác' }, { id: 2, text: 5 }], missing: ['Chủ xe', ''], note: 'ok' }) + '\n```';
  const result = api.parseResponse(raw, paras);
  assert.deepEqual(JSON.parse(JSON.stringify(result.edits)), [{ id: 0, before: 'Biển số: ……', text: 'Biển số: 51H' }]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.missing)), ['Chủ xe']);
});

test('đọc phản hồi AI: JSON hỏng báo lỗi tiếng Việt, có rác quanh JSON vẫn đọc được', () => {
  assert.throws(() => api.parseResponse('xin chào', []), /không đọc được/);
  assert.equal(api.parseResponse('Đây: {"edits":[]} hết', []).edits.length, 0);
});

test('dựng yêu cầu: bắt JSON, không đưa khoá/ảnh vào nội dung', () => {
  const req = api.buildRequest([{ id: 0, text: 'A' }], { bienSo: '51H' }, 'điền biển số');
  assert.equal(req.generationConfig.responseMimeType, 'application/json');
  assert.match(req.contents[0].parts[0].text, /51H/);
  assert.match(req.contents[0].parts[0].text, /điền biển số/);
});
