import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));
function load() {
  const context = vm.createContext({ Math, Number, String, Object, Array, JSON, Date, Set });
  vm.runInContext(read('js/features/documents/official-letter-dossier.js') + '\nthis.D = OfficialLetterDossier;', context);
  vm.runInContext(read('js/data/official-letter-templates.js') + '\n' + read('js/features/documents/official-letter-core.js') + '\nthis.C = OfficialLetterCore;', context);
  return context;
}
const RECORD = {
  soHoSoBoiThuong: 'HSBT-25-0001', bienSo: '47A-123.45', chuXe: 'Nguyễn Văn A', trangThai: 'cho_duyet_pasc',
  ngayHieuLuc: '2025-03-01', ngayHetHan: '01/03/2026', ngayTonThat: '05/03/2025', ngayThongBao: '15/03/2025', ngayMoHs: '2025-03-16',
  diaDiemTonThat: 'QL14, Buôn Ma Thuột', dienBienTonThat: 'Xe va chạm với xe tải khi vượt. '.repeat(30),
  uocThietHai: '100.000.000', pascSoTienDuyet: 85000000, soTienBh: 400000000, soCccd: '012345678901', anhHienTruong: 'https://x/y.jpg',
  tenGara: 'Gara Toyota Đắk Lắk', hangMucTonThat: [{ tenHangMuc: 'Cản trước', thanhTien: 3500000 }, 'Đèn pha trái'],
  thongBaoGiamTru: { stage: 'Dự kiến áp dụng', rule: { items: [{ title: 'Báo tổn thất chậm' }], custom: { on: true, title: 'Không bảo lưu hiện trường', rate: 10 } }, notes: 'Lái xe tự di chuyển xe.' },
  nguoiTao: { uid: 'u1', tenHienThi: 'Hồ Quang Huy' }
};

test('dossier: nhóm có nhãn tiếng Việt, định dạng ngày/tiền, giữ văn bản dài, bỏ CCCD/ảnh', () => {
  const { D } = load();
  const dossier = plain(D.build(RECORD, { group: 'Hồ sơ tồn', today: '2025-04-20' }));
  const text = D.toText(dossier);
  assert.match(text, /\[Định danh hồ sơ\]\n- Số HSBT: HSBT-25-0001/);
  assert.match(text, /Trạng thái: Chờ duyệt PASC/);
  assert.match(text, /Ngày hiệu lực: 01\/03\/2025/);
  assert.match(text, /Ước thiệt hại: 100\.000\.000 đ/);
  assert.match(text, /Số tiền duyệt PASC: 85\.000\.000 đ/);
  assert.ok(text.includes('Xe va chạm với xe tải khi vượt. Xe va chạm'), 'diễn biến dài không bị cắt ở 300 ký tự');
  assert.doesNotMatch(text, /012345678901|https:\/\/x/);
  assert.match(text, /\[Hạng mục tổn thất\]\n- 1: Cản trước – 3\.500\.000 đ\n- 2: Đèn pha trái/);
  assert.match(text, /Vi phạm 2: Không bảo lưu hiện trường \(10%\)/);
  assert.match(text, /Người tạo hồ sơ: Hồ Quang Huy/);
});

test('dossier: nhận định tính sẵn — thời hạn BH, sát ngày hiệu lực, báo trễ, ngày tồn, chênh lệch tiền, giảm trừ', () => {
  const { D } = load();
  const facts = plain(D.build(RECORD, { today: '2025-04-20' }).facts);
  const find = re => facts.find(f => re.test(f.text));
  assert.ok(find(/Giai đoạn hiện tại: Chờ duyệt PASC/));
  assert.equal(find(/nằm trong thời hạn bảo hiểm/).level, 'info');
  assert.equal(find(/4 ngày sau ngày hiệu lực/).level, 'warn');
  assert.equal(find(/Thông báo tổn thất sau 10 ngày/).level, 'warn');
  assert.ok(find(/Hồ sơ đã mở 35 ngày/));
  assert.ok(find(/Chưa ghi nhận ngày nhận đủ hồ sơ/));
  assert.ok(find(/PASC duyệt 85\.000\.000 đ so với ước thiệt hại 100\.000\.000 đ \(thấp hơn 15\.000\.000 đ\)/));
  assert.equal(find(/giảm trừ/).level, 'warn');
});

test('dossier: ngoài thời hạn BH, phí đóng sau tổn thất, tổn thất toàn bộ, thanh toán còn thiếu', () => {
  const { D } = load();
  const facts = plain(D.build({ ngayHieuLuc: '01/01/2025', ngayHetHan: '31/12/2025', ngayTonThat: '2026-01-05', ngayThanhToanPhi: '10/01/2026',
    soTienBh: 300000000, soTienDuyetBT: '250.000.000', soTienDaThanhToan: 200000000, trangThai: 'da_thanh_toan' }, { today: '2026-02-01' }).facts);
  const texts = facts.map(f => f.text).join('\n');
  assert.match(texts, /NẰM NGOÀI thời hạn bảo hiểm/);
  assert.match(texts, /thanh toán phí .* SAU ngày tổn thất/);
  assert.match(texts, /tổn thất toàn bộ/);
  assert.match(texts, /Đã thanh toán 200\.000\.000 đ \/ duyệt 250\.000\.000 đ — còn 50\.000\.000 đ/);
  assert.doesNotMatch(texts, /Hồ sơ đã mở/, 'đã đóng thì không tính ngày tồn');
});

test('dossier: ghi chú tiến độ mới nhất trước, hồ sơ cùng biển số, mục trống quan trọng', () => {
  const { D } = load();
  const dossier = plain(D.build({ bienSo: '47A-1', trangThai: 'moi' }, {
    notes: [{ author: 'Huy', timestamp: Date.UTC(2025, 0, 2), content: 'Cũ' }, { author: 'Phúc', timestamp: Date.UTC(2025, 0, 9), content: 'Chờ khách bổ sung' }, { content: '' }],
    related: [{ soHoSoBoiThuong: 'HS-OLD', ngayTonThat: '01/06/2024', trangThai: 'da_thanh_toan', nguyenNhan: 'Va quẹt' }]
  }));
  const notes = dossier.sections.find(s => /Ghi chú tiến độ/.test(s.title));
  assert.equal(notes.rows[0][1], 'Chờ khách bổ sung');
  assert.equal(notes.rows.length, 2);
  const related = dossier.sections.find(s => s.title === 'Hồ sơ khác cùng biển số');
  assert.deepEqual(related.rows[0], ['01/06/2024', 'HS-OLD · Đã thanh toán · Va quẹt']);
  assert.ok(dossier.gaps.includes('Số HSBT') && dossier.gaps.includes('Ngày tổn thất'));
  assert.ok(!dossier.gaps.includes('Biển số'));
  assert.equal(D.notesKey({ bienSo: '47a-123.45' }, 'x'), '47A-12345', 'giống khóa của trang Tiến độ hồ sơ tồn');
});

test('dossier: hồ sơ rỗng/không hợp lệ không lỗi', () => {
  const { D } = load();
  for (const bad of [null, undefined, 'x', {}]) assert.doesNotThrow(() => D.toText(D.build(bad)));
});

test('prompt: phân tích dùng HỒ SƠ có cấu trúc và yêu cầu insights/keyFacts; soạn nhận hồ sơ + dữ kiện', () => {
  const { D, C } = load();
  const tpl = C.findTemplate('de_nghi_cung_cap_ho_so') || C.findTemplate('tu_do');
  const dossier = D.toText(D.build(RECORD, { today: '2025-04-20' }));
  const analyze = C.buildAnalyzeRequest(tpl, { record: { a: 1 }, dossier, current: {}, brief: 'x' });
  const text = analyze.contents[0].parts[0].text;
  assert.match(text, /HỒ SƠ:\n\[Định danh hồ sơ\]/);
  assert.doesNotMatch(text, /DỮ LIỆU HỒ SƠ/);
  assert.match(analyze.system_instruction.parts[0].text, /"insights"/);
  assert.match(analyze.system_instruction.parts[0].text, /"keyFacts"/);
  const parsed = plain(C.parseAnalysis(JSON.stringify({ understanding: 'u', insights: [{ level: 'warn', text: '**Báo trễ** 10 ngày' }, 'Chuỗi trần', { level: 'x', text: '' }], keyFacts: ['Ngày tổn thất 05/03/2025', 'Ngày tổn thất 05/03/2025', 7] }), tpl));
  assert.deepEqual(parsed.insights, [{ level: 'warn', text: 'Báo trễ 10 ngày' }, { level: 'info', text: 'Chuỗi trần' }]);
  assert.deepEqual(parsed.keyFacts, ['Ngày tổn thất 05/03/2025']);
  const compose = C.buildComposeRequest(tpl, {}, {}, '', '', { keyFacts: ['Biển số 47A-123.45'], insights: [{ level: 'warn', text: 'Báo trễ' }], dossier });
  const ctext = compose.contents[0].parts[0].text;
  assert.match(ctext, /DỮ KIỆN CẦN NÊU[^\n]*\n- Biển số 47A-123\.45/);
  assert.match(ctext, /NHẬN ĐỊNH NGHIỆP VỤ[^\n]*\n- Báo trễ/);
  assert.match(ctext, /HỒ SƠ \(tra cứu khi cần[^\n]*\n\[Định danh hồ sơ\]/);
  assert.match(compose.system_instruction.parts[0].text, /viết CỤ THỂ theo hồ sơ/);
  // Không có hồ sơ → vẫn dùng JSON cũ
  assert.match(C.buildAnalyzeRequest(tpl, { record: { bienSo: '1' } }).contents[0].parts[0].text, /DỮ LIỆU HỒ SƠ:\n\{"bienSo":"1"\}/);
});

test('index.html nạp official-letter-dossier.js giữa core và page', () => {
  const html = read('index.html');
  const at = name => html.indexOf('js/features/documents/official-letter-' + name + '.js');
  assert.ok(at('core') > 0 && at('core') < at('dossier') && at('dossier') < at('page'));
});
