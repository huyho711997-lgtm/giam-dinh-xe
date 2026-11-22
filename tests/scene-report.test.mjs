import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
function load() {
  const ctx = vm.createContext({ String, Number, Object, Array, JSON, Math, Date, Uint8Array });
  vm.runInContext(read('js/features/documents/scene-report-model.js') + '\n' + read('js/features/documents/scene-report-docx.js') + `
    this.api = { sceneReportParseDateTime, sceneReportDefaults, sceneReportNormalize, sceneReportProgress, sceneReportStepProgress, SCENE_REPORT_STEPS, sceneReportInsertSuggestion, buildSceneReportHtml, SCENE_REPORT_SUGGESTIONS,
      sceneReportDocxDocument, sceneReportDocxFiles, sceneReportDocxFooter, sceneReportImageInfo };`, ctx);
  return ctx.api;
}
const claim = { plate: '47a-123.45', driver: 'Nguyễn Văn A', driverPhone: '0905', lossRaw: '05/11/2026 14:30', location: 'QL14, Đắk Lắk', cause: 'Va chạm xe tải', assessor: 'Hồ Gia Huy', assessorPhone: '0911', today: '2026-11-13' };

test('parse ngày giờ tổn thất', () => {
  const { sceneReportParseDateTime: p } = load();
  assert.deepEqual({ ...p('05/11/2026 14:30') }, { date: '2026-11-05', time: '14:30' });
  assert.deepEqual({ ...p('2026-11-05T09:05') }, { date: '2026-11-05', time: '09:05' });
  assert.equal(p('31/02/2026').date, '2026-02-31');
  assert.deepEqual({ ...p('') }, { date: '', time: '' });
  assert.equal(p('05/11/2026 25:99').time, '');
});

test('mặc định lấy từ hồ sơ và dòng thành phần tham gia', () => {
  const a = load();
  const d = a.sceneReportNormalize(null, a.sceneReportDefaults(claim));
  assert.equal(d.plate, '47A-123.45');
  assert.equal(d.accidentDate, '2026-11-05');
  assert.equal(d.accidentTime, '14:30');
  assert.equal(d.participants.length, 4);
  assert.equal(d.participants[0].name, 'Hồ Gia Huy');
  assert.equal(d.participants[0].role, 'GĐV Bảo hiểm Tasco');
  assert.equal(d.participants[1].name, 'Nguyễn Văn A');
  assert.equal(d.participants[1].phone, '0905');
});

test('trường tự động theo hồ sơ cho tới khi sửa tay', () => {
  const a = load();
  const saved = { plate: 'CŨ', manual: {} };
  assert.equal(a.sceneReportNormalize(saved, a.sceneReportDefaults(claim)).plate, '47A-123.45');
  const edited = a.sceneReportNormalize({ plate: 'TAY', manual: { plate: true } }, a.sceneReportDefaults(claim));
  assert.equal(edited.plate, 'TAY');
});

test('chuẩn hóa dữ liệu hỏng/độc hại', () => {
  const a = load();
  const d = a.sceneReportNormalize({ weather: 'hack', ground: 'soft', docs: { policy: 'yes', license: true }, scene: 'x'.repeat(9999), participants: 'bad', damage: { front: { on: true, text: 5 } } }, {});
  assert.equal(d.weather, '');
  assert.equal(d.ground, 'soft');
  assert.equal(d.docs.policy, false);
  assert.equal(d.docs.license, true);
  assert.equal(d.scene.length, 3000);
  assert.equal(d.participants.length, 4);
  assert.equal(d.damage.front.on, true);
  assert.equal(d.damage.rear.on, false);
});

test('tiến độ và câu gợi ý không chèn trùng', () => {
  const a = load();
  const d = a.sceneReportNormalize({ sceneIntact: 'intact', scene: 'mô tả' }, {});
  assert.equal(a.sceneReportProgress(d).filled, 2);
  assert.equal(a.sceneReportProgress(d).total, 16);
  const once = a.sceneReportInsertSuggestion('', 'Xe BKS {plate} dừng.', '47A-1', 3000);
  assert.equal(once, 'Xe BKS 47A-1 dừng.');
  assert.equal(a.sceneReportInsertSuggestion(once, 'Xe BKS {plate} dừng.', '47A-1', 3000), once);
  assert.equal(a.sceneReportInsertSuggestion(once, 'Câu hai.', '', 3000), once + '\nCâu hai.');
});

test('HTML bản in: thoát ký tự, logo, ô tích, trang sơ đồ', () => {
  const a = load();
  const d = a.sceneReportNormalize({ weather: 'rain', scene: '<img src=x onerror=alert(1)>', manual: { driver: true }, driver: 'A & B' }, a.sceneReportDefaults(claim));
  const html = a.buildSceneReportHtml(d, { logoUrl: 'assets/images/tasco-logo-clean.png', diagramUrl: 'data:image/png;base64,AAAA' });
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img src=x'));
  assert.ok(html.includes('A &amp; B'));
  assert.ok(html.includes('tasco-logo-clean.png'));
  assert.ok(html.includes('BM.TASCO.XCG.01.04'));
  assert.ok(html.includes('class="diagram"'));
  assert.ok(html.includes('Mưa') || html.includes('Mưa'.toLowerCase()) || html.includes('Nắng'));
  const without = a.buildSceneReportHtml(a.sceneReportNormalize({ includeDiagram: false }, {}), { diagramUrl: 'data:x' });
  assert.ok(!without.includes('class="diagram"><img'));
  assert.ok(without.includes('class="dots"'));
});

test('logo bản in không bị cắt: không dịch âm, không overflow hidden', () => {
  const html = load().buildSceneReportHtml(load().sceneReportNormalize(null, {}), { logoUrl: 'x.png' });
  const css = html.match(/\.hd\s*\{[^}]*\}\s*\.hd img\s*\{[^}]*\}/);
  assert.ok(css, 'phải có CSS .hd / .hd img');
  assert.ok(!/overflow\s*:\s*hidden/.test(css[0]));
  assert.ok(!/margin[^;}]*-\d/.test(css[0]), 'không dùng margin âm (máy in cắt phần lấn ra lề)');
  assert.ok(fs.existsSync(new URL('../assets/images/tasco-logo-clean.png', import.meta.url)));
});

// Kiểm tra XML đúng cú pháp ở mức thẻ đóng/mở (đủ để bắt lỗi thoát ký tự hoặc thiếu thẻ).
function assertBalanced(xml) {
  const stack = [];
  for (const m of xml.replace(/<\?xml[^>]*\?>/, '').matchAll(/<(\/?)([A-Za-z0-9:]+)([^>]*?)(\/?)>/g)) {
    if (m[4]) continue;
    if (m[1]) assert.equal(stack.pop(), m[2], 'thẻ đóng không khớp: ' + m[2]);
    else stack.push(m[2]);
  }
  assert.deepEqual(stack, []);
}

test('Word: tài liệu hợp lệ, thoát ký tự, ô tích, dữ liệu điền đúng chỗ', () => {
  const a = load();
  const d = a.sceneReportNormalize({
    weather: 'rain', light: 'night', scene: 'Dòng 1 <b>&</b>\nDòng 2', manual: { driver: true, plate: true }, driver: 'A & "B"', plate: '47A-1',
    docs: { policy: true }, damage: { front: { on: true, text: 'cản' } }, driverPresence: 'present'
  }, a.sceneReportDefaults(claim));
  const xml = a.sceneReportDocxDocument(d, { logo: { width: 962, height: 259 }, diagram: { width: 1200, height: 800 } });
  assertBalanced(xml);
  assert.ok(xml.includes('A &amp; &quot;B&quot;'));
  assert.ok(xml.includes('Dòng 1 &lt;b&gt;&amp;&lt;/b&gt;'));
  assert.ok(!xml.includes('<b>&</b>'));
  assert.ok(xml.includes('47A-1'));
  assert.ok(xml.includes('BM.TASCO.XCG.01.04') === false, 'mã biểu mẫu nằm ở chân trang, không ở thân');
  assert.ok((xml.match(/\u2612/g) || []).length >= 5);                 // đã tích: Mưa, Tối, GCN, Đầu, có mặt
  assert.ok((xml.match(/\u2610/g) || []).length > 10);                 // ô trống
  assert.ok(xml.includes('w:orient="landscape"'));                      // phần sơ đồ A4 ngang
  assert.equal((xml.match(/<w:sectPr>/g) || []).length, 2);
  assert.equal((xml.match(/<w:drawing>/g) || []).length, 2);            // logo + sơ đồ
  assert.ok(xml.includes('Đại diện giám định BH Tasco'));
  assert.ok(/<w:tbl>.*<w:tbl>/s.test(xml));                              // bảng thành phần + bảng chữ ký
});

test('Word: bỏ trang sơ đồ khi tắt "kèm sơ đồ" hoặc không có ảnh; thiếu logo vẫn có chữ thay thế', () => {
  const a = load();
  const off = a.sceneReportDocxDocument(a.sceneReportNormalize({ includeDiagram: false }, {}), { logo: null, diagram: { width: 10, height: 10 } });
  assertBalanced(off);
  assert.ok(!off.includes('orient="landscape"'));
  assert.equal((off.match(/<w:sectPr>/g) || []).length, 1);
  assert.ok(!off.includes('<w:drawing>'));
  assert.ok(off.includes('TASCO INSURANCE'));
  const none = a.sceneReportDocxDocument(a.sceneReportNormalize(null, {}), {});
  assert.ok(!none.includes('orient="landscape"'));
});

test('Word: ảnh sơ đồ vừa khung A4 ngang, giữ tỉ lệ', () => {
  const a = load();
  const xml = a.sceneReportDocxDocument(a.sceneReportNormalize(null, {}), { diagram: { width: 2000, height: 500 } });
  const ext = [...xml.matchAll(/<wp:extent cx="(\d+)" cy="(\d+)"\/>/g)].map(m => [Number(m[1]), Number(m[2])]).pop();
  assert.ok(ext[0] <= 281 * 36000 + 1 && ext[1] <= 186 * 36000 + 1);
  assert.ok(Math.abs(ext[0] / ext[1] - 4) < 0.01);
});

test('Word: gói .docx đủ phần, quan hệ khớp ảnh, chân trang có số trang', () => {
  const a = load();
  const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 3, 0xC2, 0, 0, 1, 4, 8, 6]);
  const info = a.sceneReportImageInfo(png);
  assert.equal(info.ext, 'png'); assert.equal(info.width, 962); assert.equal(info.height, 260);
  const files = a.sceneReportDocxFiles(a.sceneReportNormalize(null, {}), { logo: { ...info, bytes: png }, diagram: { ...info, bytes: png } }, 'Biên <bản>');
  const byPath = Object.fromEntries(files.map(f => [f.path, f]));
  ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/_rels/document.xml.rels', 'word/styles.xml', 'word/settings.xml', 'word/footer1.xml', 'word/footer2.xml', 'word/media/logo.png', 'word/media/diagram.png']
    .forEach(p => assert.ok(byPath[p], 'thiếu ' + p));
  files.filter(f => f.text).forEach(f => assertBalanced(f.text));
  const rels = byPath['word/_rels/document.xml.rels'].text;
  assert.ok(rels.includes('Target="media/logo.png"') && rels.includes('Target="media/diagram.png"'));
  assert.ok(byPath['[Content_Types].xml'].text.includes('Extension="png"'));
  assert.ok(byPath['docProps/core.xml'].text.includes('Biên &lt;bản&gt;'));
  const footer = byPath['word/footer1.xml'].text;
  assert.ok(footer.includes('PAGE') && footer.includes('NUMPAGES') && footer.includes('BM.TASCO.XCG.01.04'));
  // mọi rId dùng trong document.xml đều có trong .rels
  for (const m of byPath['word/document.xml'].text.matchAll(/r:(?:embed|id)="(rId\d+)"/g)) assert.ok(rels.includes(`Id="${m[1]}"`), 'thiếu quan hệ ' + m[1]);
  assert.equal(a.sceneReportImageInfo(new Uint8Array(40)), null);
});

test('Word: nút tải và script đã nối vào giao diện', () => {
  const html = read('index.html');
  assert.match(html, /scene-report-docx\.js\?v=/);
  assert.ok(html.indexOf('scene-report-docx.js') < html.indexOf('scene-report-ui.js'));
  const ui = read('js/features/documents/scene-report-ui.js');
  assert.match(ui, /data-sr-act|'word'/);
  assert.ok((ui.match(/sceneReportActionBtn\('Tải Word'/g) || []).length >= 3);
  assert.match(ui, /name === 'word'/);
});

test('đã nối tab vào modal hồ sơ', () => {
  const html = read('index.html');
  assert.match(html, /id="tabBtn_SceneReport"/);
  assert.match(html, /id="tabPane_SceneReport"/);
  assert.match(html, /scene-report-model\.js\?v=/);
  assert.match(html, /scene-report-ui\.js\?v=/);
  assert.match(html, /scene-report\.css\?v=/);
  assert.match(read('js/features/claims/pending-editor.js'), /'SceneReport'\]/);
  assert.match(read('js/features/claims/pending-editor.js'), /sceneReportRefresh\(\)/);
  assert.match(read('js/features/documents/collection-guide.js'), /sceneReport:valid/);
  assert.match(read('js/features/documents/editor.js'), /delete normalized\.state\.sceneReport/);
  assert.match(read('js/features/documents/autosave.js'), /sceneReportAutoStatus/);
});

test('khối lái xe [6]/[7] là hai nhánh loại trừ nhưng vẫn đạt đủ 16/16 khi nhập đủ', () => {
  const a = load();
  const full = { sceneIntact: 'intact', engineTemp: 'warm', terrain: 'a', ground: 'hard', weather: 'sunny', driverPresence: 'present', face: 'normal', docs: { registration: true },
    scene: 'a', traces: 'a', samples: 'a', damage: { front: { on: true, text: '' } }, damageEval: 'a', parts: 'a', injuries: 'a', notes: 'a' };
  assert.equal(a.sceneReportProgress(a.sceneReportNormalize(full, {})).filled, 16);
  const absent = a.sceneReportNormalize({ ...full, driverPresence: 'absent', face: '', absentReason: 'Đi cấp cứu' }, {});
  assert.equal(a.sceneReportProgress(absent).filled, 16);
  // chọn nhánh nhưng chưa nhập gì thì [6–7] vẫn thiếu
  const empty = a.sceneReportNormalize({ ...full, driverPresence: 'present', face: '', breath: '' }, {});
  assert.equal(a.sceneReportProgress(empty).filled, 14);
});

test('stepper: 4 bước, đếm mục từng bước và liệt kê mục thiếu kèm ô cần nhảy tới', () => {
  const a = load();
  assert.deepEqual(Array.from(a.SCENE_REPORT_STEPS, step => step.id), [1, 2, 3, 4]);
  const d = a.sceneReportNormalize({ sceneIntact: 'intact', scene: 'mô tả', injuries: 'Không có' }, { plate: '47A-1', driver: 'A', today: '2026-11-13', lossRaw: '05/11/2026 14:30', location: 'QL14' });
  const steps = a.sceneReportStepProgress(d);
  assert.equal(steps.length, 4);
  assert.equal(steps[1].total, 0, 'bước ảnh & AI là tùy chọn, không có chỉ tiêu');
  assert.equal(steps[2].total, 10);
  assert.equal(steps[3].total, 5);
  assert.equal(steps[2].done, 2);
  assert.equal(steps[3].done, 1);
  const miss3 = steps[2].missing.map(m => m.label);
  assert.ok(miss3.includes('[6–7] Lái xe có mặt hay vắng mặt') && !miss3.some(label => label.startsWith('[1]')));
  assert.ok(steps[2].missing.every(m => m.step === 3 && m.focus.startsWith('[data-sr-item-tile=')));
  assert.ok(steps[3].missing.every(m => m.step === 4));
  // "Va chạm với" không bắt buộc ở bước 1
  assert.ok(!steps[0].missing.some(m => m.focus.includes('withParty')));
  assert.equal(steps[0].total, 8);
});
