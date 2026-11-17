// Xuất Biên bản giám định hiện trường (BM.TASCO.XCG.01.04) ra tệp Word .docx thật (không phải HTML đổi đuôi).
// Phần dựng XML là hàm thuần (không đụng DOM) để kiểm thử bằng Node; phần cuối file mới dùng trình duyệt (fetch, JSZip).
// Bố cục bám sát bản in HTML trong scene-report-model.js: A4 dọc, logo, 16 mục, chân trang "x/y", trang sơ đồ A4 ngang.
// Phụ thuộc: scene-report-model.js (hằng số + sceneReportDateParts/TimeParts) đã nạp trước.

const SR_DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const SR_DOCX_TEXT_W = 9865;            // bề rộng vùng chữ (twip): 210mm - lề trái 20mm - lề phải 16mm
const SR_DOCX_EMU_MM = 36000;
const SR_DOCX_LOGO_H_MM = 13;
const SR_DOCX_DIAGRAM_MAX_MM = [281, 186];
const SR_DOCX_RID = { styles: 'rId1', settings: 'rId2', footer: 'rId20', footerEmpty: 'rId21', logo: 'rId30', diagram: 'rId31' };
const SR_DOCX_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
const SR_DOCX_GAP = '    ';

function srdX(value) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

// ---- Các viên gạch: run, đoạn, bảng ----------------------------------------------------------------------------

// o: { b, i, u:'dotted', sz (nửa điểm), font }
function srdRun(text, o) {
  const f = o || {};
  const font = f.font ? `<w:rFonts w:ascii="${f.font}" w:hAnsi="${f.font}" w:eastAsia="${f.font}" w:cs="${f.font}"/>` : '';
  const pr = font + (f.b ? '<w:b/><w:bCs/>' : '') + (f.i ? '<w:i/><w:iCs/>' : '') +
    (f.sz ? `<w:sz w:val="${f.sz}"/><w:szCs w:val="${f.sz}"/>` : '') + (f.u ? `<w:u w:val="${f.u}"/>` : '');
  const t = String(text == null ? '' : text);
  if (!t) return '';
  return `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t xml:space="preserve">${srdX(t)}</w:t></w:r>`;
}
const srdBr = () => '<w:r><w:br/></w:r>';
const srdTab = () => '<w:r><w:tab/></w:r>';

// Ô tích: ký tự ☒/☐ với phông MS Gothic (phông ô tích chuẩn của Word); không phụ thuộc phông của máy xem.
function srdBox(on) {
  return `<w:r><w:rPr><w:rFonts w:ascii="MS Gothic" w:hAnsi="MS Gothic" w:eastAsia="MS Gothic" w:cs="MS Gothic" w:hint="eastAsia"/></w:rPr><w:t>${on ? '☒' : '☐'}</w:t></w:r>`;
}

// Giá trị điền vào chỗ chấm: có dữ liệu → chữ đậm gạch chân chấm; trống → hàng dấu chấm để viết tay.
function srdFill(value, emptyMm) {
  const v = String(value == null ? '' : value).replace(/\s*[\r\n]+\s*/g, ' ').trim();
  if (v) return srdRun(v, { b: true, u: 'dotted' });
  return srdRun('.'.repeat(Math.max(3, Math.min(110, Math.round((emptyMm || 22) / 1.1)))));
}

// o: { jc, keepNext, keepLines, before, after, line, exact, left, border:'bottom'|'between', tabs, sect, markSz }
function srdPara(inner, o) {
  const f = o || {};
  let pr = '';
  if (f.keepNext) pr += '<w:keepNext/>';
  if (f.keepLines) pr += '<w:keepLines/>';
  if (f.border) {
    const line = k => `<w:${k} w:val="dotted" w:sz="4" w:space="1" w:color="000000"/>`;
    pr += `<w:pBdr>${line('bottom')}${f.border === 'between' ? line('between') : ''}</w:pBdr>`;
  }
  if (f.tabs) pr += `<w:tabs>${f.tabs}</w:tabs>`;
  const spacing = [];
  if (f.before != null) spacing.push(`w:before="${f.before}"`);
  if (f.after != null) spacing.push(`w:after="${f.after}"`);
  if (f.exact) spacing.push(`w:line="${f.exact}" w:lineRule="exact"`);
  else if (f.line) spacing.push(`w:line="${f.line}" w:lineRule="auto"`);
  if (spacing.length) pr += `<w:spacing ${spacing.join(' ')}/>`;
  if (f.left) pr += `<w:ind w:left="${f.left}"/>`;
  if (f.jc) pr += `<w:jc w:val="${f.jc}"/>`;
  if (f.markSz) pr += `<w:rPr><w:sz w:val="${f.markSz}"/><w:szCs w:val="${f.markSz}"/></w:rPr>`;
  if (f.sect) pr += f.sect;
  return `<w:p>${pr ? `<w:pPr>${pr}</w:pPr>` : ''}${inner || ''}</w:p>`;
}

// Mục có nhiều dòng (khối chấm chấm): có nội dung → đoạn gạch chấm dưới; trống → n dòng kẻ chấm để viết tay.
function srdLines(value, minLines) {
  const v = String(value == null ? '' : value).trim();
  if (v) return v.split(/\r?\n/).map(line => srdPara(srdRun(line), { border: 'bottom', after: 28, jc: 'both' })).join('');
  let out = '';
  for (let i = 0; i < (minLines || 2); i++) out += srdPara('', { border: 'between', exact: 362, after: 0 });
  return out;
}

function srdCell(width, paragraphsXml, vAlign) {
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:vAlign w:val="${vAlign || 'center'}"/></w:tcPr>${paragraphsXml}</w:tc>`;
}

function srdTable(widths, rowsXml, bordered) {
  const b = bordered ? ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(k => `<w:${k} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join('') : '';
  const total = widths.reduce((n, w) => n + w, 0);
  return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/>${b ? `<w:tblBorders>${b}</w:tblBorders>` : ''}<w:tblLayout w:type="fixed"/>` +
    `<w:tblCellMar><w:left w:w="113" w:type="dxa"/><w:right w:w="113" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
    `<w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rowsXml}</w:tbl>`;
}

// Ảnh nhúng (inline). rId: quan hệ trong document.xml.rels; cx/cy: EMU.
function srdDrawing(rId, id, name, descr, cx, cy) {
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:docPr id="${id}" name="${srdX(name)}" descr="${srdX(descr)}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>` +
    `<pic:nvPicPr><pic:cNvPr id="${id}" name="${srdX(name)}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

// ---- document.xml -----------------------------------------------------------------------------------------------

// media = { logo: {width,height}|null, diagram: {width,height}|null }
function sceneReportDocxDocument(data, media) {
  const d = data || sceneReportNormalize(null, {});
  const m = media || {};
  const rep = sceneReportDateParts(d.reportDate), repT = sceneReportTimeParts(d.reportTime);
  const acc = sceneReportDateParts(d.accidentDate), accT = sceneReportTimeParts(d.accidentTime);
  const endT = sceneReportTimeParts(d.endTime);
  const F = srdFill;
  const body = [];
  // Mặc định canh trái như các dòng .row của bản in; chỉ đoạn văn xuôi (<p> trong HTML) mới canh đều hai bên (J).
  const P = (inner, o) => body.push(srdPara(inner, o));
  const J = { jc: 'both' };
  const R = srdRun;

  const optRow = (group, keys) => keys.map(k => srdBox(d[group] === k) + R(' ' + SCENE_REPORT_CHOICE_LABELS[group][k] + SR_DOCX_GAP)).join('');
  const sectionHead = text => body.push(srdPara(R(text, { b: true }), { keepNext: true, before: 170, after: 68, left: 340 }));

  // Logo (ảnh đã cắt sát nội dung) hoặc chữ thay thế nếu không tải được.
  if (m.logo && m.logo.width && m.logo.height) {
    const cy = SR_DOCX_LOGO_H_MM * SR_DOCX_EMU_MM, cx = Math.round(cy * m.logo.width / m.logo.height);
    body.push(srdPara(srdDrawing(SR_DOCX_RID.logo, 1, 'Logo TASCO INSURANCE', 'TASCO INSURANCE', cx, cy), { after: 113, jc: 'left' }));
  } else {
    body.push(srdPara(R('TASCO INSURANCE', { b: true, sz: 32 }), { after: 113, jc: 'left' }));
  }

  body.push(srdPara(R('BIÊN BẢN GIÁM ĐỊNH HIỆN TRƯỜNG/XÁC MINH HIỆN TRƯỜNG', { b: true, sz: 28 }) + srdBr() + R('TỔN THẤT XE CƠ GIỚI', { b: true, sz: 28 }), { jc: 'center', after: 113 }));

  P(R('Hôm nay, vào hồi ') + F(repT.h, 9) + R(' giờ ') + F(repT.min, 9) + R(' ngày ') + F(rep.d, 9) + R(' tháng ') + F(rep.m, 9) + R(' năm ') + (rep.y ? srdRun(rep.y, { b: true, u: 'dotted' }) : R('20….')), J);
  P(R('Tại địa điểm: ') + F(d.reportPlace, 120), J);

  sectionHead('I.   Thành phần tham gia:');
  const widths = [567, Math.round(SR_DOCX_TEXT_W * 0.38), Math.round(SR_DOCX_TEXT_W * 0.30)];
  widths.push(SR_DOCX_TEXT_W - widths[0] - widths[1] - widths[2]);
  const cellP = (inner, jc) => srdPara(inner, { after: 0, before: 0, jc: jc || 'left' });
  const rows = d.participants.map((p, i) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>` +
    srdCell(widths[0], cellP(R(String(i + 1)), 'center')) +
    srdCell(widths[1], cellP(R(p.name, { i: true }))) +
    srdCell(widths[2], cellP(R('là: ') + R(p.role, { i: true }))) +
    srdCell(widths[3], cellP(R('Số ĐT: ' + p.phone))) + '</w:tr>').join('');
  body.push(srdTable(widths, rows, true));
  body.push(srdPara('', { after: 0, markSz: 8 }));

  P(R('Cùng tiến hành lập biên bản giám định xác minh tại hiện trường vụ tai nạn xảy ra lúc ') + F(accT.h, 9) + R(' giờ ') + F(accT.min, 9) + R(' phút, ngày ') + F(acc.d, 9) + R(' tháng ') + F(acc.m, 9) + R(' năm ') +
    (acc.y ? srdRun(acc.y, { b: true, u: 'dotted' }) : R('20…..')) + R(', tại ') + R('(cây số, đường, thôn, xã, huyện tỉnh hoặc trước cửa nhà, đường, phường, quận, thành phố)', { i: true }) + R(': ') + F(d.accidentLocation, 70), J);
  P(R('giữa: xe ôtô BKS ') + F(d.plate, 38) + R(' do: ') + F(d.driver, 50) + R(' điều khiển, với: ') + F(d.withParty, 60), J);

  sectionHead('II.   Hiện trường vụ tai nạn');
  P(R('[1] Tình trạng hiện trường khi giám định: ') + optRow('sceneIntact', ['intact', 'not_intact']));
  P(R('[2] Nhiệt độ động cơ: ') + optRow('engineTemp', ['warm', 'cold']));
  P(R('[3] Địa hình hiện trường, vật liệu nền hiện trường: ') + F(d.terrain, 60));
  P(R('[4] Tính chất nền: ') + optRow('ground', ['hard', 'soft', 'flooded']));
  P(R('[5] Điều kiện thời tiết hiện trường: ') + optRow('weather', ['sunny', 'rain', 'cloudy']) + optRow('light', ['day', 'night']));
  P(R('[6] Người điều khiển phương tiện tại hiện trường:') + srdBr() +
    srdBox(d.driverPresence === 'absent') + R(' Không có mặt tại hiện trường. Lý do: ') + F(d.absentReason, 70) + srdBr() +
    R('Địa điểm đến: ') + F(d.absentDestination, 90), { keepLines: true });
  P(R('[7] Người điều khiển có mặt tại hiện trường. ') + srdBox(d.driverPresence === 'present') + srdBr() +
    R('Dấu hiệu tình trạng lái xe: ') + optRow('face', ['normal', 'abnormal']) + optRow('breath', ['clean', 'odor']), { keepLines: true });
  P(R('[8] Giấy tờ cung cấp tại hiện trường:') + srdBr() +
    SCENE_REPORT_DOCS.map(([k, label]) => srdBox(d.docs[k]) + R(' ' + label + SR_DOCX_GAP)).join('') + srdBr() +
    R('(Trường hợp không có ghi rõ nguyên nhân không có, thời gian có thể cung cấp)', { i: true }) + R(' ') + F(d.docNote, 60), { keepLines: true });

  P(R('[9] Mô tả hiện trường tai nạn, vị trí phương tiện', { b: true }) + R(' ') + R('(Ghi nhận và đánh số thứ tự theo số tự nhiên vị trí phương tiện, nạn nhân, dấu vết tại sơ đồ hiện trường)', { i: true }) + R(':'), { keepNext: true });
  body.push(srdLines(d.scene, 4));
  P(R('[10] Dấu vết tại hiện trường', { b: true }) + R(' ') + R('(Ghi nhận vị trí, khoảng cách, chiều hướng từng dấu vết, vật chứng trong mối liên quan với đồ vật cũng như những dấu vết, vật chứng khác ở hiện trường. Xác định điểm đâm va của tai nạn)', { i: true }) + R(':'), { keepNext: true });
  body.push(srdLines(d.traces, 5));
  P(R('[11] Mẫu vật thu được tại hiện trường:'), { keepNext: true });
  body.push(srdLines(d.samples, 3));
  P(R('Những mẫu vật nói trên được thu lượm bảo quản đưa về BH Tasco để xem xét xử lý. Trong quá trình giám định chúng tôi đã vẽ sơ đồ hiện trường, đo đạc, chụp ảnh, ghi hình.'), J);

  sectionHead('III.   Thiệt hại sơ bộ:');
  P(R('[12] Vị trí tổn thất ') + R('(Trái/phải…)', { i: true }) + R(': ') +
    SCENE_REPORT_DAMAGE_SPOTS.map(([k, label]) => srdBox(d.damage[k].on) + R(' ' + label) + (d.damage[k].text ? R(': ') + srdRun(d.damage[k].text, { b: true, u: 'dotted' }) : R('…..')) + R(SR_DOCX_GAP)).join(''), { keepLines: true });
  P(R('[13] Đánh giá thiệt hại, ước thiệt hại:'), { keepNext: true });
  body.push(srdLines(d.damageEval, 2));
  P(R('[14] Thiệt hại về tài sản: ') + SCENE_REPORT_PROPERTY.map(([k, label]) => srdBox(d.property[k]) + R(' ' + label + SR_DOCX_GAP)).join('') + srdBr() +
    optRow('propertyRange', ['r10_20', 'r20_50']) + srdBr() +
    srdBox(d.propertyRange === 'other') + R(' Khác: ') + F(d.propertyOther, 90) + srdBr() +
    R('Liệt kê sơ bộ vật tư, phụ tùng thiệt hại:'), { keepNext: true, keepLines: true });
  body.push(srdLines(d.parts, 2));
  P(R('[15] Thiệt hại về người:'), { keepNext: true });
  body.push(srdLines(d.injuries, 3));
  P(R('[16] Ghi chú ') + R('(Ghi lại lời khai lái xe, nhân chứng)', { i: true }) + R(':'), { keepNext: true });
  body.push(srdLines(d.notes, 6));
  P(R('Đề xuất khác: '), { keepNext: true });
  body.push(d.proposals.trim() ? srdLines(d.proposals, 1) : srdLines('', 2));
  P(R('Biên bản được lập xong vào hồi ') + F(endT.h, 12) + R(' giờ ') + F(endT.min, 12) + R(' cùng ngày, thông qua các bên liên quan và thống nhất cùng ký tên dưới đây.'), { jc: 'both', keepNext: true, keepLines: true });

  const colW = [3288, 3288, SR_DOCX_TEXT_W - 6576];
  const signCell = (w, text) => srdCell(w, srdPara(R(text, { b: true }), { jc: 'center', after: 0 }), 'top');
  const signRow = `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="1700" w:hRule="atLeast"/></w:trPr>` +
    signCell(colW[0], 'Đại diện lái/chủ xe') + signCell(colW[1], 'Đại diện bên liên quan') + signCell(colW[2], 'Đại diện giám định BH Tasco') + '</w:tr>';
  body.push(srdTable(colW, signRow, false));

  const portrait = (footerRid) => `<w:sectPr><w:footerReference w:type="default" r:id="${footerRid}"/><w:pgSz w:w="11906" w:h="16838"/>` +
    `<w:pgMar w:top="907" w:right="907" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>`;
  const landscape = `<w:sectPr><w:footerReference w:type="default" r:id="${SR_DOCX_RID.footerEmpty}"/><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>` +
    `<w:pgMar w:top="454" w:right="454" w:bottom="454" w:left="454" w:header="283" w:footer="283" w:gutter="0"/></w:sectPr>`;

  let tail;
  if (d.includeDiagram && m.diagram && m.diagram.width && m.diagram.height) {
    const [maxW, maxH] = SR_DOCX_DIAGRAM_MAX_MM;
    const scale = Math.min(maxW / m.diagram.width, maxH / m.diagram.height);
    const cx = Math.round(m.diagram.width * scale * SR_DOCX_EMU_MM), cy = Math.round(m.diagram.height * scale * SR_DOCX_EMU_MM);
    // Đoạn kết thúc phần A4 dọc mang sectPr; phần cuối (A4 ngang, không số trang) chứa sơ đồ.
    body.push(srdPara('', { after: 0, markSz: 2, sect: portrait(SR_DOCX_RID.footer) }));
    body.push(srdPara(srdDrawing(SR_DOCX_RID.diagram, 2, 'Sơ đồ hiện trường', 'Sơ đồ hiện trường vụ tai nạn', cx, cy), { jc: 'center', after: 0 }));
    tail = landscape;
  } else {
    body.push(srdPara('', { after: 0, markSz: 2 }));
    tail = portrait(SR_DOCX_RID.footer);
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${SR_DOCX_NS}><w:body>${body.join('')}${tail}</w:body></w:document>`;
}

// ---- Các phần còn lại của gói .docx -----------------------------------------------------------------------------

function sceneReportDocxFooter(withText) {
  const head = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${SR_DOCX_NS}>`;
  if (!withText) return head + '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p></w:ftr>';
  const it = { i: true, sz: 18 };
  const fld = (instr, sample) => `<w:fldSimple w:instr=" ${instr} "><w:r><w:rPr><w:i/><w:iCs/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>${sample}</w:t></w:r></w:fldSimple>`;
  return head + srdPara(srdRun('Quy trình giám định bảo hiểm xe cơ giới – ' + SCENE_REPORT_FORM_CODE, it) + srdTab() + fld('PAGE', '1') + srdRun('/', it) + fld('NUMPAGES', '1'),
    { tabs: `<w:tab w:val="right" w:pos="${SR_DOCX_TEXT_W}"/>`, after: 0 }) + '</w:ftr>';
}

function sceneReportDocxStyles() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${SR_DOCX_NS}><w:docDefaults><w:rPrDefault><w:rPr>` +
    `<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>` +
    `<w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="vi-VN" w:eastAsia="vi-VN" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>` +
    `<w:pPrDefault><w:pPr><w:spacing w:after="68" w:line="331" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>` +
    `<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/>` +
    `<w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;
}

function sceneReportDocxSettings() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings ${SR_DOCX_NS}>` +
    `<w:defaultTabStop w:val="720"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;
}

// files: danh sách { path, text } hoặc { path, bytes }; media cùng dạng như sceneReportDocxDocument + bytes/ext.
function sceneReportDocxFiles(data, media, title) {
  const m = media || {};
  const exts = {};
  [m.logo, m.diagram].forEach(img => { if (img && img.ext) exts[img.ext] = true; });
  const ctype = (ext, type) => exts[ext] ? `<Default Extension="${ext}" ContentType="${type}"/>` : '';
  const rels = [
    `<Relationship Id="${SR_DOCX_RID.styles}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`,
    `<Relationship Id="${SR_DOCX_RID.settings}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>`,
    `<Relationship Id="${SR_DOCX_RID.footer}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>`,
    `<Relationship Id="${SR_DOCX_RID.footerEmpty}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer2.xml"/>`
  ];
  const files = [];
  if (m.logo && m.logo.bytes) {
    rels.push(`<Relationship Id="${SR_DOCX_RID.logo}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.${m.logo.ext}"/>`);
    files.push({ path: `word/media/logo.${m.logo.ext}`, bytes: m.logo.bytes });
  }
  const hasDiagram = !!(m.diagram && m.diagram.bytes && m.diagram.width);
  if (hasDiagram) {
    rels.push(`<Relationship Id="${SR_DOCX_RID.diagram}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/diagram.${m.diagram.ext}"/>`);
    files.push({ path: `word/media/diagram.${m.diagram.ext}`, bytes: m.diagram.bytes });
  }
  const docMedia = { logo: m.logo && m.logo.bytes ? m.logo : null, diagram: hasDiagram ? m.diagram : null };
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  return [
    { path: '[Content_Types].xml', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
      ctype('png', 'image/png') + ctype('jpeg', 'image/jpeg') +
      `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
      `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
      `<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>` +
      `<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>` +
      `<Override PartName="/word/footer2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>` +
      `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
      `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` },
    { path: '_rels/.rels', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
      `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
      `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` },
    { path: 'word/_rels/document.xml.rels', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>` },
    { path: 'word/document.xml', text: sceneReportDocxDocument(data, docMedia) },
    { path: 'word/styles.xml', text: sceneReportDocxStyles() },
    { path: 'word/settings.xml', text: sceneReportDocxSettings() },
    { path: 'word/footer1.xml', text: sceneReportDocxFooter(true) },
    { path: 'word/footer2.xml', text: sceneReportDocxFooter(false) },
    { path: 'docProps/core.xml', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
      `<dc:title>${srdX(title || 'Biên bản giám định hiện trường')}</dc:title><dc:creator>Tasco DLK</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>` },
    { path: 'docProps/app.xml', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Office Word</Application></Properties>` }
  ].concat(files);
}

// ---- Ảnh: đọc kích thước PNG/JPEG từ byte ---------------------------------------------------------------------

function sceneReportImageInfo(bytes) {
  const b = bytes;
  if (!b || b.length < 24) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) {
    const w = ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0;
    const h = ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0;
    return w && h ? { ext: 'png', width: w, height: h } : null;
  }
  if (b[0] === 0xFF && b[1] === 0xD8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xFF) { i++; continue; }
      const marker = b[i + 1];
      if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { i += 2; continue; }
      const len = (b[i + 2] << 8) | b[i + 3];
      if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
        const h = (b[i + 5] << 8) | b[i + 6], w = (b[i + 7] << 8) | b[i + 8];
        return w && h ? { ext: 'jpeg', width: w, height: h } : null;
      }
      i += 2 + len;
    }
  }
  return null;
}

// ---- Phần dùng trình duyệt: tải ảnh, đóng gói bằng JSZip --------------------------------------------------------

async function sceneReportDocxFetchBytes(url) {
  const text = String(url || '');
  const m = text.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (m) {
    if (m[2]) { const bin = atob(m[3]); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
    return new TextEncoder().encode(decodeURIComponent(m[3]));
  }
  const res = await fetch(text);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return new Uint8Array(await res.arrayBuffer());
}

// Trả về { bytes, ext, width, height }; định dạng khác PNG/JPEG (vd. SVG, WebP) được vẽ lại thành PNG.
async function sceneReportDocxLoadImage(url) {
  let bytes = await sceneReportDocxFetchBytes(url);
  let info = sceneReportImageInfo(bytes);
  if (!info) {
    const bitmap = await createImageBitmap(new Blob([bytes]));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    bytes = new Uint8Array(await blob.arrayBuffer());
    info = sceneReportImageInfo(bytes);
  }
  if (!info) throw new Error('Không đọc được ảnh');
  return Object.assign({ bytes }, info);
}

// opts: { logoUrl, diagramUrl, title } → Promise<Blob .docx>
async function buildSceneReportDocx(data, opts) {
  if (typeof JSZip === 'undefined') throw new Error('Thư viện JSZip chưa tải xong, vui lòng thử lại sau vài giây.');
  const o = opts || {};
  const media = { logo: null, diagram: null };
  if (o.logoUrl) { try { media.logo = await sceneReportDocxLoadImage(o.logoUrl); } catch (error) { console.warn('Không tải được logo cho file Word', error); } }
  if (o.diagramUrl && data && data.includeDiagram) { try { media.diagram = await sceneReportDocxLoadImage(o.diagramUrl); } catch (error) { console.warn('Không tải được sơ đồ cho file Word', error); } }
  const zip = new JSZip();
  sceneReportDocxFiles(data, media, o.title).forEach(f => zip.file(f.path, f.bytes || f.text, { createFolders: false }));
  return zip.generateAsync({ type: 'blob', mimeType: SR_DOCX_MIME, compression: 'DEFLATE' });
}
