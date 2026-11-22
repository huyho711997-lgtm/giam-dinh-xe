import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const ctx = vm.createContext({String, Number, Object, Array, JSON, Math, Date, Error});
vm.runInContext(read('js/features/documents/scene-report-ai.js') + '\nthis.AI = SceneReportAI;', ctx);
const AI = ctx.AI;
const plain = value => JSON.parse(JSON.stringify(value));

test('buildPrompt đưa loại ảnh, hồ sơ và nội dung đã có vào ngữ cảnh', () => {
  const photos = [{kind: 'scene'}, {kind: 'trace'}, {kind: 'sample'}, {kind: 'lạ'}];
  const prompt = AI.buildPrompt({plate: '47A-123.45', location: 'QL14', cause: 'va chạm xe tải', note: 'ảnh 3 là mảnh đèn', existing: {scene: '1. Xe nằm trong phần đường.', samples: ''}}, photos);
  assert.match(prompt, /Biển số xe được bảo hiểm: 47A-123\.45/);
  assert.match(prompt, /1=Hiện trường, 2=Dấu vết, 3=Mẫu vật, 4=Hiện trường/);
  assert.match(prompt, /Đã có sẵn ở mục \[9\]/);
  assert.doesNotMatch(prompt, /Đã có sẵn ở mục \[11\]/);
  assert.match(prompt, /KHÔNG xem là sự thật đã xác minh/);
  assert.match(prompt, /Không tự đưa ra số đo/);
});

test('parseResult đọc JSON (kể cả bọc ```), giới hạn độ dài và chuẩn hóa tham chiếu ảnh', () => {
  const raw = '```json\n' + JSON.stringify({scene: '1. Xe nằm ngoài phần đường.\r\n\r\n\r\n2. Mặt đường nhựa.', traces: '1. Vệt phanh dài … m.', samples: '',
    suy_luan: [{anh: 1, thay: 'xe nghiêng', ket_luan: 'xe bị nghiêng'}, {anh: 99, thay: 'x', ket_luan: 'y'}, {anh: 2}],
    can_xac_minh: ['Đo vệt phanh', '', 'Đo khoảng cách từ xe đến mép đường'], anh_khong_dung: [{anh: 3, ly_do: 'mờ'}, {anh: 50, ly_do: 'sai'}]}) + '\n```';
  const result = plain(AI.parseResult(raw, 4));
  assert.equal(result.scene, '1. Xe nằm ngoài phần đường.\n\n2. Mặt đường nhựa.');
  assert.equal(result.samples, '');
  assert.deepEqual(result.verify, ['Đo vệt phanh', 'Đo khoảng cách từ xe đến mép đường']);
  assert.deepEqual(result.unusable, [{photo: 3, reason: 'mờ'}]);
  assert.deepEqual(result.evidence.map(item => item.photo), [1, 0]);   // ảnh ngoài phạm vi → 0; dòng rỗng bị bỏ
  assert.equal(AI.parseResult(JSON.stringify({scene: 'a'.repeat(5000)})).scene.length, 3000);
});

test('parseResult báo lỗi dễ hiểu khi AI không rút ra được gì hoặc trả sai định dạng', () => {
  assert.throws(() => AI.parseResult('không phải json'), /định dạng không đọc được/);
  assert.throws(() => AI.parseResult(JSON.stringify({scene: '', traces: '', samples: '', anh_khong_dung: [{anh: 2, ly_do: 'quá tối'}]}), 3), /Ảnh 2 \(quá tối\) chưa dùng được/);
  assert.equal(AI.parseResult('Đây là kết quả: ' + JSON.stringify({traces: '1. Mảnh vỡ.'})).traces, '1. Mảnh vỡ.');
});

test('mergeText: ô trống thì điền, ô có chữ thì nối dòng mới hoặc thay, và cắt theo giới hạn', () => {
  assert.deepEqual(plain(AI.mergeText('', '1. A', 'append', 100)), {text: '1. A', truncated: false});
  assert.equal(AI.mergeText('Đã có.  \n', '1. A', 'append', 100).text, 'Đã có.\n1. A');
  assert.equal(AI.mergeText('Đã có.', '1. A', 'replace', 100).text, '1. A');
  const cut = AI.mergeText('x'.repeat(95), 'y'.repeat(20), 'append', 100);
  assert.equal(cut.text.length, 100); assert.equal(cut.truncated, true);
  assert.equal(AI.mergeText('Giữ nguyên', '   ', 'append', 100).text, 'Giữ nguyên');
});

test('nextKind xoay vòng Hiện trường → Dấu vết → Mẫu vật', () => {
  assert.equal(AI.nextKind('scene'), 'trace'); assert.equal(AI.nextKind('trace'), 'sample'); assert.equal(AI.nextKind('sample'), 'scene'); assert.equal(AI.nextKind('?'), 'trace');
});

test('analyze gửi ảnh kèm nhãn loại tới Gemini và trả kết quả đã chuẩn hóa', async () => {
  let call = null;
  const fetchImpl = async (url, init) => { call = {url, init, body: JSON.parse(init.body)}; return {ok: true, status: 200, json: async () => ({candidates: [{content: {parts: [{text: JSON.stringify({scene: '1. Xe dừng bên phải.', traces: '', samples: '1. Mảnh đèn.'})}]}}]})}; };
  const photos = [{name: 'a.jpg', kind: 'scene', mimeType: 'image/jpeg', data: 'AAA'}, {name: 'b.jpg', kind: 'sample', mimeType: 'image/jpeg', data: 'BBB'}];
  const result = plain(await AI.analyze({photos, context: {plate: '47A-1'}, apiKey: 'k', model: 'gemini-2.5-flash', fetchImpl}));
  assert.match(call.url, /models\/gemini-2\.5-flash:generateContent$/);
  assert.equal(call.init.headers['x-goog-api-key'], 'k');
  const parts = call.body.contents[0].parts;
  assert.deepEqual(parts.filter(part => part.inlineData).map(part => part.inlineData.data), ['AAA', 'BBB']);
  assert.ok(parts.some(part => /Ảnh 2 — loại: Mẫu vật/.test(part.text || '')));
  assert.equal(call.body.generationConfig.responseMimeType, 'application/json');
  assert.equal(result.samples, '1. Mảnh đèn.');
});

test('analyze báo lỗi rõ khi thiếu ảnh/khoá, hết hạn mức hoặc bị chặn', async () => {
  const bad = (status, body) => async () => ({ok: status < 400, status, json: async () => body});
  const photos = [{name: 'a.jpg', kind: 'scene', mimeType: 'image/jpeg', data: 'A'}];
  await assert.rejects(AI.analyze({photos: [], apiKey: 'k'}), /Chưa có ảnh/);
  await assert.rejects(AI.analyze({photos, apiKey: ''}), /khoá Gemini/);
  await assert.rejects(AI.analyze({photos, apiKey: 'k', fetchImpl: bad(429, {error: {message: 'x'}})}), /hết hạn mức/);
  await assert.rejects(AI.analyze({photos, apiKey: 'k', fetchImpl: bad(413, {})}), /quá nặng/);
  await assert.rejects(AI.analyze({photos, apiKey: 'k', fetchImpl: bad(200, {promptFeedback: {blockReason: 'SAFETY'}})}), /từ chối xử lý ảnh \(SAFETY\)/);
});

test('trang nạp module AI trước giao diện và form có khối AI ở đầu phần II', () => {
  const html = read('index.html');
  assert.ok(html.indexOf('scene-report-ai.js') < html.indexOf('scene-report-ui.js') && html.indexOf('scene-report-ui.js') < html.indexOf('scene-report-ai-ui.js'));
  const ui = read('js/features/documents/scene-report-ui.js');
  assert.ok(ui.indexOf('data-sr-ai') > 0 && ui.indexOf('data-sr-ai') < ui.indexOf('class="sr-choice-grid"'));
});
