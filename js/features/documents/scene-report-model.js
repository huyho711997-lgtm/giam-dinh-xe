// Biên bản giám định hiện trường / xác minh hiện trường tổn thất xe cơ giới — biểu mẫu BM.TASCO.XCG.01.04 (trang 1–2).
// File này CHỈ chứa logic thuần (không đụng DOM): cấu trúc dữ liệu 16 mục, chuẩn hóa dữ liệu đã lưu,
// giá trị mặc định lấy từ hồ sơ, câu gợi ý nhanh và dựng HTML bản in (A4 dọc, có logo; trang 3 là sơ đồ hiện trường).
// Phần giao diện nằm ở scene-report-ui.js. Dữ liệu lưu trong collectionGuideDraft.sceneReport nên dùng chung
// đường tự lưu theo số HSBT của "Hướng dẫn thu thập hồ sơ" (không cần thêm nút Firebase mới).

const SCENE_REPORT_FORM_CODE = 'BM.TASCO.XCG.01.04';
const SCENE_REPORT_PARTICIPANT_ROWS = 4;
const SCENE_REPORT_SHORT = 300;
const SCENE_REPORT_LONG = 3000;

// Các nhóm lựa chọn một (bấm lại để bỏ chọn): khóa → danh sách giá trị hợp lệ.
const SCENE_REPORT_CHOICES = {
  sceneIntact: ['intact', 'not_intact'],
  engineTemp: ['warm', 'cold'],
  ground: ['hard', 'soft', 'flooded'],
  weather: ['sunny', 'rain', 'cloudy'],
  light: ['day', 'night'],
  driverPresence: ['absent', 'present'],
  face: ['normal', 'abnormal'],
  breath: ['clean', 'odor'],
  propertyRange: ['r10_20', 'r20_50', 'other']
};

const SCENE_REPORT_CHOICE_LABELS = {
  sceneIntact: { intact: 'Nguyên vẹn', not_intact: 'Không nguyên vẹn' },
  engineTemp: { warm: 'Nóng ấm', cold: 'Lạnh' },
  ground: { hard: 'Cứng, không lún/sụt', soft: 'Mềm lún/Sụt', flooded: 'Ngập nước' },
  weather: { sunny: 'Nắng', rain: 'Mưa', cloudy: 'Râm mát' },
  light: { day: 'Sáng', night: 'Tối' },
  driverPresence: { absent: 'Không có mặt tại hiện trường', present: 'Có mặt tại hiện trường' },
  face: { normal: 'Sắc mặt bình thường', abnormal: 'Sắc mặt đỏ, tái..' },
  breath: { clean: 'Hơi thở không mùi', odor: 'Hơi thở có mùi lạ' },
  propertyRange: { r10_20: 'Khoảng từ 10 đến 20 triệu đồng', r20_50: 'Khoảng trên 20 đến 50 triệu đồng', other: 'Khác' }
};

const SCENE_REPORT_DOCS = [
  ['registration', 'Đăng ký xe'],
  ['inspection', 'Đăng kiểm (ATKT&BVMT)'],
  ['policy', 'GCN/Hợp đồng Bảo hiểm'],
  ['goods', 'Chứng từ hàng hóa'],
  ['license', 'Giấy phép lái xe hợp lệ']
];
const SCENE_REPORT_PROPERTY = [['insured', 'Xe tham gia bảo hiểm vật chất Tasco'], ['thirdParty', 'Tài sản bên thứ ba']];
const SCENE_REPORT_DAMAGE_SPOTS = [['front', 'Đầu'], ['body', 'Thân'], ['rear', 'Đuôi'], ['under', 'Gầm/Nóc']];

const SCENE_REPORT_TEXT_FIELDS = {
  reportDate: 10, reportTime: 5, reportPlace: SCENE_REPORT_SHORT,
  accidentDate: 10, accidentTime: 5, accidentLocation: 500, plate: 40, driver: 120, withParty: 600,
  terrain: SCENE_REPORT_SHORT, absentReason: SCENE_REPORT_SHORT, absentDestination: SCENE_REPORT_SHORT, docNote: 400,
  scene: SCENE_REPORT_LONG, traces: SCENE_REPORT_LONG, samples: 2000,
  damageEval: 2000, propertyOther: SCENE_REPORT_SHORT, parts: 2000, injuries: 2000, notes: SCENE_REPORT_LONG,
  proposals: 1000, endTime: 5
};

// Trường tự theo hồ sơ cho đến khi người dùng sửa tay (giống tab Trưng cầu hồ sơ).
const SCENE_REPORT_AUTO_FIELDS = ['accidentDate', 'accidentTime', 'accidentLocation', 'plate', 'driver', 'withParty', 'assessorName', 'assessorPhone', 'driverPhone'];

// Các mục đánh số trong biểu mẫu → dùng để đếm tiến độ "x/16 mục đã nhập".
const SCENE_REPORT_ITEM_CHECKS = [
  d => !!d.sceneIntact,                                             // [1]
  d => !!d.engineTemp,                                              // [2]
  d => !!d.terrain.trim(),                                          // [3]
  d => !!d.ground,                                                  // [4]
  d => !!d.weather || !!d.light,                                    // [5]
  d => d.driverPresence === 'absent' && !!(d.absentReason.trim() || d.absentDestination.trim()), // [6]
  d => d.driverPresence === 'present' && !!(d.face || d.breath),    // [7]
  d => SCENE_REPORT_DOCS.some(([k]) => d.docs[k]) || !!d.docNote.trim(), // [8]
  d => !!d.scene.trim(),                                            // [9]
  d => !!d.traces.trim(),                                           // [10]
  d => !!d.samples.trim(),                                          // [11]
  d => SCENE_REPORT_DAMAGE_SPOTS.some(([k]) => d.damage[k].on),     // [12]
  d => !!d.damageEval.trim(),                                       // [13]
  d => !!d.propertyRange || SCENE_REPORT_PROPERTY.some(([k]) => d.property[k]) || !!d.parts.trim(), // [14]
  d => !!d.injuries.trim(),                                         // [15]
  d => !!d.notes.trim()                                             // [16]
];

// Câu gợi ý nhanh (bấm để chèn). {plate} được thay bằng biển số xe; chỗ "…" để giám định viên điền tiếp.
const SCENE_REPORT_SUGGESTIONS = {
  terrain: [
    ['Đường nhựa, bằng phẳng', 'Mặt đường nhựa, bằng phẳng.'],
    ['Bê tông xi măng', 'Mặt đường bê tông xi măng.'],
    ['Đèo dốc, có taluy', 'Đoạn đường đèo dốc, một bên là taluy dương, một bên là vực/taluy âm.'],
    ['Đường cong', 'Đoạn đường cong, tầm nhìn bị hạn chế.'],
    ['Đường đất / cấp phối', 'Mặt đường đất, cấp phối.']
  ],
  scene: [
    ['Xe nằm trong phần đường', 'Xe ô tô BKS {plate} dừng/nằm trong phần đường, đầu xe hướng về …, cách mép đường … m.'],
    ['Xe ra ngoài phần đường', 'Xe ô tô BKS {plate} nằm ngoài phần đường, cách mép đường … m, đầu xe hướng về ….'],
    ['Xe bị lật / nghiêng', 'Xe ô tô BKS {plate} bị lật/nghiêng sang bên …, nằm tại vị trí số ① trên sơ đồ.'],
    ['Hiện trường chưa bị thay đổi', 'Tại thời điểm giám định, vị trí xe và các dấu vết còn nguyên, chưa bị di dời.'],
    ['Xe đã được di dời', 'Phương tiện đã được di dời khỏi vị trí tai nạn ban đầu; vị trí ban đầu xác định theo lời khai và dấu vết còn lại.'],
    ['Mặt đường khô / ướt', 'Mặt đường khô ráo, vạch kẻ đường còn rõ.']
  ],
  traces: [
    ['Vệt phanh', 'Vệt phanh dài … m, hướng …, bắt đầu cách điểm đâm va … m.'],
    ['Vết cày xước mặt đường', 'Vết cày xước trên mặt đường dài … m, bắt đầu từ …, kết thúc tại ….'],
    ['Mảnh vỡ', 'Mảnh vỡ (kính, nhựa, đèn) rơi vãi trên diện … m, tập trung tại ….'],
    ['Vết va chạm với vật cản', 'Vết va chạm trên … (cột, biển báo, hộ lan, taluy) cách mặt đường … m.'],
    ['Điểm đâm va', 'Điểm đâm va xác định tại … (vị trí số ② trên sơ đồ), cách mép đường … m.'],
    ['Dầu / chất lỏng rò rỉ', 'Dầu nhớt/nước làm mát rò rỉ trên mặt đường, tập trung tại ….']
  ],
  samples: [
    ['Không thu mẫu vật', 'Không thu mẫu vật tại hiện trường.'],
    ['Mảnh vỡ phương tiện', 'Mảnh vỡ của phương tiện (…); đã chụp ảnh, ghi nhận và bảo quản.'],
    ['Phụ tùng bị rơi', 'Phụ tùng bị bung/rơi tại hiện trường: …; đã ghi nhận và thu giữ.']
  ],
  damageEval: [
    ['Thiệt hại phần đầu xe', 'Phần đầu xe: … bị móp, biến dạng, bung vỡ; cần tháo kiểm tra thêm khung xương, két nước, hệ thống treo.'],
    ['Hư hỏng nhẹ, sơn / nắn gò', 'Thiệt hại ở mức xước sơn, móp nhẹ, có thể khắc phục bằng nắn gò – sơn.'],
    ['Chưa xác định hết hư hỏng', 'Chưa xác định hết hư hỏng bên trong; sẽ kiểm tra chi tiết và lập bảng báo giá khi tháo kiểm tra tại gara.'],
    ['Xe bị lật – hư hỏng nhiều', 'Xe bị lật, hư hỏng nhiều vị trí thân vỏ, kính, nóc, hệ thống điện; ước thiệt hại lớn, cần giám định chi tiết.'],
    ['Có nguy cơ tổn thất toàn bộ', 'Mức độ hư hỏng nghiêm trọng, có nguy cơ tổn thất toàn bộ; cần đối chiếu giá trị xe tại thời điểm tổn thất.']
  ],
  parts: [
    ['Cản trước / đèn / capo', 'Cản trước, đèn pha, capo, lưới tản nhiệt, ốp trang trí.'],
    ['Cánh cửa / gương', 'Cánh cửa, gương chiếu hậu, ốp hông, tay mở cửa.'],
    ['Kính', 'Kính chắn gió, kính cửa.'],
    ['Cản sau / đèn hậu', 'Cản sau, đèn hậu, cốp sau.'],
    ['Hệ thống gầm / treo', 'Hệ thống gầm, treo, lái; các chi tiết dưới gầm cần tháo kiểm tra.']
  ],
  injuries: [
    ['Không có thiệt hại về người', 'Không có người bị thương, tử vong.'],
    ['Có người bị thương', 'Có … người bị thương: …, đã được đưa đến … cấp cứu.'],
    ['Chưa xác định', 'Chưa xác định được thiệt hại về người tại thời điểm giám định.']
  ],
  notes: [
    ['Lời khai lái xe', 'Lái xe khai: …'],
    ['Lời khai nhân chứng', 'Nhân chứng … (SĐT …) khai: …'],
    ['Cơ quan chức năng đã làm việc', 'Cơ quan Công an/CSGT đã đến hiện trường và lập biên bản (số …).'],
    ['Chưa có cơ quan chức năng', 'Tại thời điểm giám định, chưa có cơ quan chức năng làm việc.'],
    ['Đã chụp ảnh, đo đạc', 'Đã chụp ảnh, ghi hình, đo đạc và vẽ sơ đồ hiện trường kèm theo biên bản.']
  ],
  proposals: [
    ['Bổ sung giấy tờ', 'Đề nghị khách hàng bổ sung: …'],
    ['Giám định lại khi tháo kiểm tra', 'Đề nghị giám định bổ sung khi tháo kiểm tra tại gara sửa chữa.'],
    ['Trưng cầu kết quả điều tra', 'Đề xuất trưng cầu biên bản/kết luận của cơ quan chức năng.']
  ]
};


function sceneReportStr(value, limit) {
  return String(value == null ? '' : value).slice(0, limit);
}


function sceneReportPickChoice(group, value) {
  return SCENE_REPORT_CHOICES[group].indexOf(value) !== -1 ? value : '';
}


// "DD/MM/YYYY HH:mm", "DD/MM/YYYY", "YYYY-MM-DDTHH:mm" … → { date: 'YYYY-MM-DD', time: 'HH:mm' } (thiếu thì chuỗi rỗng).
function sceneReportParseDateTime(raw) {
  const text = String(raw == null ? '' : raw).trim();
  let date = '', time = '';
  let m = text.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (m) date = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  else if ((m = text.match(/(\d{4})-(\d{2})-(\d{2})/))) date = `${m[1]}-${m[2]}-${m[3]}`;
  const t = text.match(/(?:^|[T\s])(\d{1,2}):(\d{2})/);
  if (t) time = `${t[1].padStart(2, '0')}:${t[2]}`;
  const valid = /^(\d{4})-(\d{2})-(\d{2})$/.test(date) && Number(date.slice(5, 7)) >= 1 && Number(date.slice(5, 7)) <= 12 && Number(date.slice(8, 10)) >= 1 && Number(date.slice(8, 10)) <= 31;
  return { date: valid ? date : '', time: /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : '' };
}


// claim = { plate, driver, driverPhone, lossRaw, location, cause, assessor, assessorPhone, today }
function sceneReportDefaults(claim) {
  const c = claim || {};
  const loss = sceneReportParseDateTime(c.lossRaw);
  return {
    reportDate: String(c.today || ''),
    accidentDate: loss.date, accidentTime: loss.time,
    accidentLocation: sceneReportStr(c.location, 500),
    plate: sceneReportStr(c.plate, 40).toLocaleUpperCase('vi'),
    driver: sceneReportStr(c.driver, 120),
    driverPhone: sceneReportStr(c.driverPhone, 40),
    withParty: sceneReportStr(c.cause, 600),
    assessorName: sceneReportStr(c.assessor, 120),
    assessorPhone: sceneReportStr(c.assessorPhone, 40)
  };
}


// Chuẩn hóa dữ liệu đã lưu (có thể cũ/hỏng/thiếu) + mặc định từ hồ sơ → cấu trúc đầy đủ, an toàn để hiển thị và in.
function sceneReportNormalize(saved, defaults) {
  const s = saved && typeof saved === 'object' ? saved : {};
  const d = defaults || {};
  const manual = {};
  SCENE_REPORT_AUTO_FIELDS.forEach(key => { manual[key] = !!(s.manual && s.manual[key] === true); });
  const out = { version: 1, manual };

  Object.keys(SCENE_REPORT_TEXT_FIELDS).forEach(key => {
    const limit = SCENE_REPORT_TEXT_FIELDS[key];
    const auto = SCENE_REPORT_AUTO_FIELDS.indexOf(key) !== -1;
    const useSaved = typeof s[key] === 'string' && (!auto || manual[key]);
    const fallback = key in d ? d[key] : '';
    out[key] = sceneReportStr(useSaved ? s[key] : fallback, limit);
  });
  Object.keys(SCENE_REPORT_CHOICES).forEach(group => { out[group] = sceneReportPickChoice(group, s[group]); });

  out.docs = {}; SCENE_REPORT_DOCS.forEach(([k]) => { out.docs[k] = !!(s.docs && s.docs[k] === true); });
  out.property = {}; SCENE_REPORT_PROPERTY.forEach(([k]) => { out.property[k] = !!(s.property && s.property[k] === true); });
  out.damage = {};
  SCENE_REPORT_DAMAGE_SPOTS.forEach(([k]) => {
    const item = s.damage && s.damage[k] && typeof s.damage[k] === 'object' ? s.damage[k] : {};
    out.damage[k] = { on: item.on === true, text: sceneReportStr(item.text, 120) };
  });

  // Thành phần tham gia: dòng 1 = giám định viên, dòng 2 = lái xe (tự theo hồ sơ); dòng 3–4 nhập tay.
  const rows = Array.isArray(s.participants) ? s.participants : [];
  out.participants = [];
  for (let i = 0; i < SCENE_REPORT_PARTICIPANT_ROWS; i++) {
    const r = rows[i] && typeof rows[i] === 'object' ? rows[i] : {};
    const row = {
      name: sceneReportStr(r.name, 120), role: sceneReportStr(r.role, 120), phone: sceneReportStr(r.phone, 40)
    };
    if (i === 0) {
      if (!manual.assessorName) row.name = sceneReportStr(d.assessorName, 120);
      if (!manual.assessorPhone) row.phone = sceneReportStr(d.assessorPhone, 40);
      if (!row.role) row.role = 'GĐV Bảo hiểm Tasco';
    }
    if (i === 1) {
      if (!manual.driver) row.name = sceneReportStr(d.driver, 120);
      if (!manual.driverPhone) row.phone = sceneReportStr(d.driverPhone, 40);
      if (!row.role && (row.name || row.phone)) row.role = 'Lái xe';
    }
    out.participants.push(row);
  }
  out.includeDiagram = s.includeDiagram !== false;
  return out;
}


function sceneReportProgress(data) {
  const filled = SCENE_REPORT_ITEM_CHECKS.reduce((n, check) => n + (check(data) ? 1 : 0), 0);
  return { filled, total: SCENE_REPORT_ITEM_CHECKS.length };
}


// Chèn câu gợi ý vào nội dung hiện có: thay {plate}, ngăn cách bằng xuống dòng, không chèn trùng; cắt theo giới hạn.
function sceneReportInsertSuggestion(current, template, plate, limit) {
  const snippet = String(template || '').replace(/\{plate\}/g, String(plate || '').trim() || '………').trim();
  const text = String(current == null ? '' : current);
  if (!snippet) return text;
  if (text.indexOf(snippet) !== -1) return text;
  const joined = text.trim() ? text.replace(/\s+$/, '') + '\n' + snippet : snippet;
  return joined.slice(0, limit || SCENE_REPORT_LONG);
}


// ---- Dựng HTML bản in -------------------------------------------------------------------------------------------

function sceneReportEsc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function sceneReportDateParts(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? { y: m[1], m: String(Number(m[2])), d: String(Number(m[3])) } : { y: '', m: '', d: '' };
}

function sceneReportTimeParts(hhmm) {
  const m = String(hhmm || '').match(/^(\d{2}):(\d{2})$/);
  return m ? { h: String(Number(m[1])), min: m[2] } : { h: '', min: '' };
}

// Ô tích: SVG nên luôn in được (không phụ thuộc "in màu nền" hay font ký hiệu).
function sceneReportBox(on) {
  return `<svg class="cb" viewBox="0 0 10 10" aria-hidden="true"><rect x=".5" y=".5" width="9" height="9" fill="none" stroke="#000" stroke-width=".9"/>${on ? '<path d="M2.2 2.2L7.8 7.8M7.8 2.2L2.2 7.8" stroke="#000" stroke-width="1.2" stroke-linecap="round"/>' : ''}</svg>`;
}

// Giá trị điền vào chỗ chấm: có dữ liệu → chữ đậm nhẹ gạch chân chấm; trống → để chỗ chấm cho viết tay.
function sceneReportFill(value, emptyWidth) {
  const v = String(value == null ? '' : value).trim();
  return v ? `<span class="fv">${sceneReportEsc(v)}</span>` : `<span class="dots" style="min-width:${emptyWidth || 22}mm"></span>`;
}

function sceneReportLines(value, minLines) {
  const v = String(value == null ? '' : value).trim();
  if (v) return `<div class="blk">${sceneReportEsc(v).replace(/\n/g, '<br>')}</div>`;
  return '<div class="dl"></div>'.repeat(minLines || 2);
}

function sceneReportChoiceRow(data, group, keys) {
  return keys.map(key => `<span class="opt">${sceneReportBox(data[group] === key)} ${sceneReportEsc(SCENE_REPORT_CHOICE_LABELS[group][key])}</span>`).join('');
}


// opts: { diagramUrl, logoUrl, title }
function buildSceneReportHtml(data, opts) {
  const d = data || sceneReportNormalize(null, {});
  const o = opts || {};
  const E = sceneReportEsc;
  const rep = sceneReportDateParts(d.reportDate), repT = sceneReportTimeParts(d.reportTime);
  const acc = sceneReportDateParts(d.accidentDate), accT = sceneReportTimeParts(d.accidentTime);
  const endT = sceneReportTimeParts(d.endTime);
  const F = sceneReportFill;

  const participantRows = d.participants.map((p, i) => `<tr><td class="c">${i + 1}</td><td>${p.name ? `<i>${E(p.name)}</i>` : ''}</td><td>là: ${p.role ? `<i>${E(p.role)}</i>` : ''}</td><td>Số ĐT: ${E(p.phone)}</td></tr>`).join('');

  const docs = SCENE_REPORT_DOCS.map(([k, label]) => `<span class="opt">${sceneReportBox(d.docs[k])} ${E(label)}</span>`);
  const damage = SCENE_REPORT_DAMAGE_SPOTS.map(([k, label]) => `<span class="opt">${sceneReportBox(d.damage[k].on)} ${E(label)}${d.damage[k].text ? ': <span class="fv">' + E(d.damage[k].text) + '</span>' : '…..'}</span>`).join('');
  const property = SCENE_REPORT_PROPERTY.map(([k, label]) => `<span class="opt">${sceneReportBox(d.property[k])} ${E(label)}</span>`).join('');

  const diagram = d.includeDiagram && o.diagramUrl ? `<section class="diagram"><img src="${E(o.diagramUrl)}" alt="Sơ đồ hiện trường vụ tai nạn"></section>` : '';

  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${E(o.title || 'Biên bản giám định hiện trường')}</title>
<style>
@page { size: A4 portrait; margin: 16mm 16mm 20mm 20mm;
  @bottom-left { content: "Quy trình giám định bảo hiểm xe cơ giới – ${SCENE_REPORT_FORM_CODE}"; font: italic 9pt "Times New Roman", serif; color:#000; }
  @bottom-right { content: counter(page) "/" counter(pages); font: italic 9pt "Times New Roman", serif; } }
@page diagramPage { size: A4 landscape; margin: 8mm; @bottom-left { content: none; } @bottom-right { content: none; } }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
body { font: 12pt/1.38 "Times New Roman", Times, serif; }
.hd { height: 17mm; margin: 0 0 3mm -4mm; overflow: hidden; }
.hd img { height: 26mm; margin-top: -4.5mm; display: block; }
h1 { margin: 0 0 4mm; text-align: center; font-size: 14pt; line-height: 1.3; font-weight: 700; text-transform: uppercase; }
p { margin: 0 0 1.2mm; text-align: justify; }
h2 { margin: 3mm 0 1.2mm; font-size: 12pt; font-weight: 700; padding-left: 6mm; break-after: avoid; }
.fv { font-weight: 600; border-bottom: .2mm dotted #000; padding: 0 .6mm; }
.dots { display: inline-block; border-bottom: .2mm dotted #000; height: 1em; vertical-align: baseline; }
.dl { border-bottom: .2mm dotted #000; height: 6.4mm; }
.blk { white-space: normal; text-align: justify; border-bottom: .2mm dotted #000; padding-bottom: .5mm; }
.cb { width: 3.3mm; height: 3.3mm; vertical-align: -.55mm; }
.opt { display: inline-block; margin-right: 6mm; white-space: nowrap; }
.row { margin: 0 0 1.2mm; }
.ind { padding-left: 4mm; }
table.pt { width: 100%; border-collapse: collapse; margin: 1mm 0 2mm; }
table.pt td { border: .25mm solid #000; padding: .6mm 2mm; font-size: 12pt; }
table.pt td.c { width: 10mm; text-align: center; }
table.pt td:nth-child(2) { width: 38%; } table.pt td:nth-child(3) { width: 30%; }
.sign { display: grid; grid-template-columns: 1fr 1fr 1fr; text-align: center; font-weight: 700; margin-top: 3mm; break-inside: avoid; }
.sign div { min-height: 30mm; }
.keep { break-inside: avoid; }
.diagram { page: diagramPage; break-before: page; display: flex; align-items: center; justify-content: center; height: 194mm; }
.diagram img { max-width: 100%; max-height: 194mm; object-fit: contain; }
@media screen { body { padding: 6mm 12mm; max-width: 210mm; margin: 0 auto; } }
</style></head><body>
<div class="hd">${o.logoUrl ? `<img src="${E(o.logoUrl)}" alt="TASCO INSURANCE">` : '<b>TASCO INSURANCE</b>'}</div>
<h1>Biên bản giám định hiện trường/xác minh hiện trường<br>tổn thất xe cơ giới</h1>
<p>Hôm nay, vào hồi ${F(repT.h, 9)} giờ ${F(repT.min, 9)} ngày ${F(rep.d, 9)} tháng ${F(rep.m, 9)} năm ${rep.y ? `<span class="fv">${E(rep.y)}</span>` : '20….'}</p>
<p>Tại địa điểm: ${F(d.reportPlace, 120)}</p>
<h2>I.&nbsp;&nbsp;&nbsp;Thành phần tham gia:</h2>
<table class="pt">${participantRows}</table>
<p>Cùng tiến hành lập biên bản giám định xác minh tại hiện trường vụ tai nạn xảy ra lúc ${F(accT.h, 9)} giờ ${F(accT.min, 9)} phút, ngày ${F(acc.d, 9)} tháng ${F(acc.m, 9)} năm ${acc.y ? `<span class="fv">${E(acc.y)}</span>` : '20…..'}, tại <i>(cây số, đường, thôn, xã, huyện tỉnh hoặc trước cửa nhà, đường, phường, quận, thành phố)</i>: ${F(d.accidentLocation, 70)}</p>
<p>giữa: xe ôtô BKS ${F(d.plate, 38)} do: ${F(d.driver, 50)} điều khiển, với: ${F(d.withParty, 60)}</p>

<h2>II.&nbsp;&nbsp;&nbsp;Hiện trường vụ tai nạn</h2>
<div class="row">[1] Tình trạng hiện trường khi giám định: ${sceneReportChoiceRow(d, 'sceneIntact', ['intact', 'not_intact'])}</div>
<div class="row">[2] Nhiệt độ động cơ: ${sceneReportChoiceRow(d, 'engineTemp', ['warm', 'cold'])}</div>
<div class="row">[3] Địa hình hiện trường, vật liệu nền hiện trường: ${F(d.terrain, 60)}</div>
<div class="row">[4] Tính chất nền: ${sceneReportChoiceRow(d, 'ground', ['hard', 'soft', 'flooded'])}</div>
<div class="row">[5] Điều kiện thời tiết hiện trường: ${sceneReportChoiceRow(d, 'weather', ['sunny', 'rain', 'cloudy'])}${sceneReportChoiceRow(d, 'light', ['day', 'night'])}</div>
<div class="row keep">[6] Người điều khiển phương tiện tại hiện trường:<br>
<span class="opt">${sceneReportBox(d.driverPresence === 'absent')} Không có mặt tại hiện trường. Lý do: ${F(d.absentReason, 70)}</span><br>
Địa điểm đến: ${F(d.absentDestination, 90)}</div>
<div class="row keep">[7] Người điều khiển có mặt tại hiện trường. ${sceneReportBox(d.driverPresence === 'present')}<br>
Dấu hiệu tình trạng lái xe: ${sceneReportChoiceRow(d, 'face', ['normal', 'abnormal'])}${sceneReportChoiceRow(d, 'breath', ['clean', 'odor'])}</div>
<div class="row keep">[8] Giấy tờ cung cấp tại hiện trường:<br>${docs.join('')}<br><i>(Trường hợp không có ghi rõ nguyên nhân không có, thời gian có thể cung cấp)</i> ${F(d.docNote, 60)}</div>
<div class="row"><b>[9] Mô tả hiện trường tai nạn, vị trí phương tiện</b> <i>(Ghi nhận và đánh số thứ tự theo số tự nhiên vị trí phương tiện, nạn nhân, dấu vết tại sơ đồ hiện trường)</i>:${sceneReportLines(d.scene, 4)}</div>
<div class="row"><b>[10] Dấu vết tại hiện trường</b> <i>(Ghi nhận vị trí, khoảng cách, chiều hướng từng dấu vết, vật chứng trong mối liên quan với đồ vật cũng như những dấu vết, vật chứng khác ở hiện trường. Xác định điểm đâm va của tai nạn)</i>:${sceneReportLines(d.traces, 5)}</div>
<div class="row">[11] Mẫu vật thu được tại hiện trường:${sceneReportLines(d.samples, 3)}</div>
<p>Những mẫu vật nói trên được thu lượm bảo quản đưa về BH Tasco để xem xét xử lý. Trong quá trình giám định chúng tôi đã vẽ sơ đồ hiện trường, đo đạc, chụp ảnh, ghi hình.</p>

<h2>III.&nbsp;&nbsp;&nbsp;Thiệt hại sơ bộ:</h2>
<div class="row keep">[12] Vị trí tổn thất <i>(Trái/phải…)</i>: ${damage}</div>
<div class="row">[13] Đánh giá thiệt hại, ước thiệt hại:${sceneReportLines(d.damageEval, 2)}</div>
<div class="row keep">[14] Thiệt hại về tài sản: ${property}<br>
${sceneReportChoiceRow(d, 'propertyRange', ['r10_20', 'r20_50'])}<br>
<span class="opt">${sceneReportBox(d.propertyRange === 'other')} Khác: ${F(d.propertyOther, 90)}</span><br>
Liệt kê sơ bộ vật tư, phụ tùng thiệt hại:${sceneReportLines(d.parts, 2)}</div>
<div class="row">[15] Thiệt hại về người:${sceneReportLines(d.injuries, 3)}</div>
<div class="row">[16] Ghi chú <i>(Ghi lại lời khai lái xe, nhân chứng)</i>:${sceneReportLines(d.notes, 6)}</div>
<div class="row">Đề xuất khác: ${d.proposals.trim() ? sceneReportLines(d.proposals, 1) : '<div class="dl"></div><div class="dl"></div>'}</div>
<p class="keep">Biên bản được lập xong vào hồi ${F(endT.h, 12)} giờ ${F(endT.min, 12)} cùng ngày, thông qua các bên liên quan và thống nhất cùng ký tên dưới đây.</p>
<div class="sign"><div>Đại diện lái/chủ xe</div><div>Đại diện bên liên quan</div><div>Đại diện giám định BH Tasco</div></div>
${diagram}
</body></html>`;
}
