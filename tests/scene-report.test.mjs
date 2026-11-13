import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
function load() {
  const ctx = vm.createContext({ String, Number, Object, Array, JSON, Math });
  vm.runInContext(read('js/features/documents/scene-report-model.js') + `
    this.api = { sceneReportParseDateTime, sceneReportDefaults, sceneReportNormalize, sceneReportProgress, sceneReportInsertSuggestion, buildSceneReportHtml, SCENE_REPORT_SUGGESTIONS };`, ctx);
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
  const html = a.buildSceneReportHtml(d, { logoUrl: 'assets/images/tasco-letterhead.png', diagramUrl: 'data:image/png;base64,AAAA' });
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img src=x'));
  assert.ok(html.includes('A &amp; B'));
  assert.ok(html.includes('tasco-letterhead.png'));
  assert.ok(html.includes('BM.TASCO.XCG.01.04'));
  assert.ok(html.includes('class="diagram"'));
  assert.ok(html.includes('Mưa') || html.includes('Mưa'.toLowerCase()) || html.includes('Nắng'));
  const without = a.buildSceneReportHtml(a.sceneReportNormalize({ includeDiagram: false }, {}), { diagramUrl: 'data:x' });
  assert.ok(!without.includes('class="diagram"><img'));
  assert.ok(without.includes('class="dots"'));
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
