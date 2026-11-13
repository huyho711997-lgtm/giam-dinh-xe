// Tab "Biên bản hiện trường" trong cửa sổ chỉnh sửa hồ sơ. Logic thuần ở scene-report-model.js.
// Dữ liệu lưu tại collectionGuideDraft.sceneReport → tự lưu cùng "Hướng dẫn thu thập hồ sơ".

const SCENE_REPORT_TEXT_AREAS = new Set(['scene', 'traces', 'samples', 'damageEval', 'parts', 'injuries', 'notes', 'proposals']);

function sceneReportClaimDefaults() {
  const assessor = collectionGuideValue('modalPendingCanBoXuLy') || collectionGuideValue('modalPendingGdvTiepNhan');
  return sceneReportDefaults({
    plate: collectionGuideValue('modalPendingBienSo'),
    driver: collectionGuideValue('modalPendingLaiXe'),
    driverPhone: collectionGuideValue('modalPendingDienThoaiLaiXe'),
    lossRaw: collectionGuideValue('modalPendingNgayVTT'),
    location: collectionGuideValue('modalPendingDiaDiemVTT'),
    cause: collectionGuideValue('modalPendingNguyenNhan'),
    assessor,
    assessorPhone: collectionGuideFindAssessorPhone(assessor).phone,
    today: collectionGuideToday()
  });
}

// Chuẩn hóa + ghi ngược vào bản nháp (trường tự động luôn theo hồ sơ nếu chưa sửa tay).
function sceneReportState() {
  ensureCollectionGuide();
  const next = sceneReportNormalize(collectionGuideDraft.sceneReport, sceneReportClaimDefaults());
  collectionGuideDraft.sceneReport = next;
  return next;
}

function sceneReportSetPath(data, path, value) {
  const keys = path.split('.');
  let node = data;
  for (let i = 0; i < keys.length - 1; i++) node = node[keys[i]];
  node[keys[keys.length - 1]] = value;
}

// Sửa tay các ô lấy từ hồ sơ → ngừng tự cập nhật theo hồ sơ.
function sceneReportMarkManual(data, path) {
  const map = { accidentDate: 'accidentDate', accidentTime: 'accidentTime', accidentLocation: 'accidentLocation', plate: 'plate', driver: 'driver', withParty: 'withParty',
    'participants.0.name': 'assessorName', 'participants.0.phone': 'assessorPhone', 'participants.1.name': 'driver', 'participants.1.phone': 'driverPhone' };
  if (map[path]) data.manual[map[path]] = true;
}

function sceneReportInput(path, value, attrs, cls) {
  const E = sceneReportEsc;
  return `<input class="sr-input ${cls || ''}" data-sr="${path}" value="${E(value)}" ${attrs || ''}>`;
}

function sceneReportField(label, inner, cls) {
  return `<label class="sr-field ${cls || ''}"><span>${sceneReportEsc(label)}</span>${inner}</label>`;
}

function sceneReportChoice(data, group, label) {
  const keys = SCENE_REPORT_CHOICES[group];
  return `<div class="sr-choice-row"><span class="sr-choice-label">${sceneReportEsc(label)}</span><div class="sr-seg" role="group" aria-label="${sceneReportEsc(label)}">` +
    keys.map(k => `<button type="button" class="sr-seg-btn${data[group] === k ? ' on' : ''}" data-sr-choice="${group}" data-value="${k}" aria-pressed="${data[group] === k}">${sceneReportEsc(SCENE_REPORT_CHOICE_LABELS[group][k])}</button>`).join('') + '</div></div>';
}

function sceneReportText(data, key, label, rows, hint) {
  const sug = (SCENE_REPORT_SUGGESTIONS[key] || []).map((s, i) => `<button type="button" class="sr-chip" data-sr-suggest="${key}" data-index="${i}" title="${sceneReportEsc(s[1])}">+ ${sceneReportEsc(s[0])}</button>`).join('');
  return `<div class="sr-block"><div class="sr-block-head"><span>${sceneReportEsc(label)}</span>${hint ? `<em>${sceneReportEsc(hint)}</em>` : ''}</div>` +
    `<textarea class="sr-input sr-area" data-sr="${key}" rows="${rows || 3}" maxlength="${SCENE_REPORT_TEXT_FIELDS[key]}">${sceneReportEsc(data[key])}</textarea>` +
    (sug ? `<div class="sr-chips" aria-label="Gợi ý nhanh">${sug}</div>` : '') + '</div>';
}

function sceneReportSection(num, title, body) {
  return `<section class="sr-card"><h4><span class="sr-num">${num}</span>${sceneReportEsc(title)}</h4>${body}</section>`;
}

function sceneReportRenderForm(data) {
  const E = sceneReportEsc;
  const people = data.participants.map((p, i) => `<div class="sr-prow"><span class="sr-pidx">${i + 1}</span>` +
    sceneReportInput(`participants.${i}.name`, p.name, 'placeholder="Họ và tên"') +
    sceneReportInput(`participants.${i}.role`, p.role, 'placeholder="Vai trò"') +
    sceneReportInput(`participants.${i}.phone`, p.phone, 'placeholder="Số điện thoại" inputmode="tel"') + '</div>').join('');

  const general = sceneReportSection('I', 'Thời gian, địa điểm & thành phần tham gia',
    `<div class="sr-grid g4">${sceneReportField('Ngày lập biên bản', sceneReportInput('reportDate', data.reportDate, 'type="date"'))}${sceneReportField('Giờ lập', sceneReportInput('reportTime', data.reportTime, 'type="time"'))}${sceneReportField('Địa điểm lập biên bản', sceneReportInput('reportPlace', data.reportPlace), 'span2')}</div>` +
    `<div class="sr-sub">Thành phần tham gia</div><div class="sr-people">${people}</div>` +
    `<div class="sr-grid g4">${sceneReportField('Ngày xảy ra tai nạn', sceneReportInput('accidentDate', data.accidentDate, 'type="date"'))}${sceneReportField('Giờ xảy ra', sceneReportInput('accidentTime', data.accidentTime, 'type="time"'))}${sceneReportField('Biển số xe', sceneReportInput('plate', data.plate), '')}${sceneReportField('Lái xe điều khiển', sceneReportInput('driver', data.driver), '')}</div>` +
    `<div class="sr-grid g2">${sceneReportField('Địa điểm xảy ra tai nạn (cây số, đường, xã, huyện, tỉnh…)', sceneReportInput('accidentLocation', data.accidentLocation))}${sceneReportField('Va chạm / xảy ra với', sceneReportInput('withParty', data.withParty))}</div>` +
    '<button type="button" class="sr-link" data-sr-reset-auto>Đặt lại các ô tự lấy từ hồ sơ</button>');

  const scene = sceneReportSection('II', 'Hiện trường vụ tai nạn',
    sceneReportChoice(data, 'sceneIntact', '[1] Tình trạng hiện trường') +
    sceneReportChoice(data, 'engineTemp', '[2] Nhiệt độ động cơ') +
    `<div class="sr-grid g1">${sceneReportField('[3] Địa hình, vật liệu nền hiện trường', sceneReportInput('terrain', data.terrain))}</div>` +
    `<div class="sr-chips sr-chips-inline">${(SCENE_REPORT_SUGGESTIONS.terrain).map((s, i) => `<button type="button" class="sr-chip" data-sr-suggest="terrain" data-index="${i}">+ ${E(s[0])}</button>`).join('')}</div>` +
    sceneReportChoice(data, 'ground', '[4] Tính chất nền') +
    sceneReportChoice(data, 'weather', '[5] Thời tiết') + sceneReportChoice(data, 'light', '      Ánh sáng') +
    sceneReportChoice(data, 'driverPresence', '[6–7] Người điều khiển phương tiện') +
    `<div class="sr-grid g2">${sceneReportField('[6] Lý do vắng mặt', sceneReportInput('absentReason', data.absentReason))}${sceneReportField('[6] Địa điểm đến', sceneReportInput('absentDestination', data.absentDestination))}</div>` +
    sceneReportChoice(data, 'face', '[7] Sắc mặt') + sceneReportChoice(data, 'breath', '[7] Hơi thở') +
    `<div class="sr-sub">[8] Giấy tờ cung cấp tại hiện trường</div><div class="sr-checks">${SCENE_REPORT_DOCS.map(([k, l]) => `<label class="sr-check"><input type="checkbox" data-sr-check="docs.${k}" ${data.docs[k] ? 'checked' : ''}><span>${E(l)}</span></label>`).join('')}</div>` +
    `<div class="sr-grid g1">${sceneReportField('Ghi chú giấy tờ (lý do chưa có, thời gian bổ sung)', sceneReportInput('docNote', data.docNote))}</div>` +
    sceneReportText(data, 'scene', '[9] Mô tả hiện trường, vị trí phương tiện', 4, 'Đánh số theo vị trí trên sơ đồ') +
    sceneReportText(data, 'traces', '[10] Dấu vết tại hiện trường', 4, 'Vị trí, khoảng cách, chiều hướng; điểm đâm va') +
    sceneReportText(data, 'samples', '[11] Mẫu vật thu được', 2));

  const damage = sceneReportSection('III', 'Thiệt hại sơ bộ',
    `<div class="sr-sub">[12] Vị trí tổn thất</div><div class="sr-damage">${SCENE_REPORT_DAMAGE_SPOTS.map(([k, l]) => `<div class="sr-dspot"><label class="sr-check"><input type="checkbox" data-sr-check="damage.${k}.on" ${data.damage[k].on ? 'checked' : ''}><span>${E(l)}</span></label>${sceneReportInput(`damage.${k}.text`, data.damage[k].text, 'placeholder="Trái / phải…"')}</div>`).join('')}</div>` +
    sceneReportText(data, 'damageEval', '[13] Đánh giá thiệt hại, ước thiệt hại', 3) +
    `<div class="sr-sub">[14] Thiệt hại về tài sản</div><div class="sr-checks">${SCENE_REPORT_PROPERTY.map(([k, l]) => `<label class="sr-check"><input type="checkbox" data-sr-check="property.${k}" ${data.property[k] ? 'checked' : ''}><span>${E(l)}</span></label>`).join('')}</div>` +
    sceneReportChoice(data, 'propertyRange', 'Mức ước tính') +
    `<div class="sr-grid g1">${sceneReportField('Khác (mô tả)', sceneReportInput('propertyOther', data.propertyOther))}</div>` +
    sceneReportText(data, 'parts', 'Liệt kê sơ bộ vật tư, phụ tùng thiệt hại', 2) +
    sceneReportText(data, 'injuries', '[15] Thiệt hại về người', 2) +
    sceneReportText(data, 'notes', '[16] Ghi chú (lời khai lái xe, nhân chứng)', 4) +
    sceneReportText(data, 'proposals', 'Đề xuất khác', 2) +
    `<div class="sr-grid g4">${sceneReportField('Giờ kết thúc biên bản', sceneReportInput('endTime', data.endTime, 'type="time"'))}</div>`);

  return `<div class="sr-head"><div><h3>Biên bản giám định hiện trường</h3><p>Biểu mẫu ${SCENE_REPORT_FORM_CODE}. Thông tin xe, lái xe, địa điểm lấy từ hồ sơ; sửa tay thì không tự thay đổi nữa.</p></div>` +
    `<div class="sr-head-actions"><span id="sceneReportProgress" class="sr-progress"></span><span id="sceneReportAutoStatus" class="sr-status"></span></div></div>` +
    general + scene + damage +
    `<div class="sr-footer"><label class="sr-check"><input type="checkbox" data-sr-check="includeDiagram" ${data.includeDiagram ? 'checked' : ''}><span>Kèm trang sơ đồ hiện trường (lấy từ tab Sơ đồ đã vẽ)</span></label>` +
    `<div class="sr-actions"><button type="button" class="btn-premium btn-secondary" data-sr-act="preview">Xem trước</button><button type="button" class="btn-premium" data-sr-act="print">In / Lưu PDF</button></div></div>`;
}

function sceneReportUpdateProgress() {
  const el = document.getElementById('sceneReportProgress');
  if (!el || !collectionGuideDraft?.sceneReport) return;
  const p = sceneReportProgress(collectionGuideDraft.sceneReport);
  el.textContent = `${p.filled}/${p.total} mục đã nhập`;
}

function sceneReportRefresh() {
  const pane = document.getElementById('tabPane_SceneReport');
  if (!pane || !collectionGuideDraft) return;
  const data = sceneReportState();
  pane.innerHTML = `<div class="sr-root" id="sceneReportRoot">${sceneReportRenderForm(data)}</div>`;
  sceneReportUpdateProgress();
  if (typeof updateClaimDocumentAutoStatus === 'function') updateClaimDocumentAutoStatus();
}

function sceneReportCommit() {
  sceneReportUpdateProgress();
  if (typeof scheduleCollectionGuideAutoSave === 'function') scheduleCollectionGuideAutoSave();
}

function sceneReportDiagramUrl() {
  try {
    if (typeof sceneDiagramDataUrl === 'string' && sceneDiagramDataUrl) return sceneDiagramDataUrl;
    if (typeof sceneShapes !== 'undefined' && sceneShapes.length && typeof createSceneDrawingExportDataUrl === 'function') return createSceneDrawingExportDataUrl();
  } catch (error) { console.warn('Không lấy được sơ đồ hiện trường', error); }
  return '';
}

function sceneReportBuildHtml() {
  const data = sceneReportState();
  const plate = collectionGuideValue('modalPendingBienSo');
  return buildSceneReportHtml(data, {
    diagramUrl: sceneReportDiagramUrl(),
    logoUrl: typeof TascoAssets !== 'undefined' ? TascoAssets.url('assets/images/tasco-letterhead.png') : 'assets/images/tasco-letterhead.png',
    title: 'Biên bản giám định hiện trường' + (plate ? ' - ' + plate : '')
  });
}

function closeSceneReportPreview() { document.getElementById('sceneReportPreview')?.remove(); }

function previewSceneReport() {
  closeSceneReportPreview();
  const html = sceneReportBuildHtml();
  const overlay = document.createElement('div');
  overlay.id = 'sceneReportPreview';
  overlay.className = 'sr-preview';
  overlay.innerHTML = '<div class="sr-preview-bar"><strong>Xem trước biên bản hiện trường</strong><span>Trong hộp thoại in, chọn "Lưu dưới dạng PDF"; tắt "Đầu trang và chân trang" nếu trình duyệt hiển thị.</span><div><button type="button" class="btn-premium btn-secondary" data-sr-act="close">Đóng</button><button type="button" class="btn-premium" data-sr-act="print">In / Lưu PDF</button></div></div><iframe title="Xem trước biên bản" class="sr-preview-frame"></iframe>';
  document.body.append(overlay);
  overlay.querySelector('iframe').srcdoc = html;
}

function printSceneReport() {
  const html = sceneReportBuildHtml();
  return printCollectionDocumentHtml(html, 'Biên bản giám định hiện trường');
}

document.addEventListener('input', event => {
  const target = event.target;
  const path = target.dataset?.sr;
  if (!path || !target.closest('#sceneReportRoot')) return;
  const data = sceneReportState();
  const limit = SCENE_REPORT_TEXT_FIELDS[path] || 120;
  sceneReportSetPath(data, path, String(target.value).slice(0, limit));
  sceneReportMarkManual(data, path);
  sceneReportCommit();
});

document.addEventListener('change', event => {
  const target = event.target;
  const path = target.dataset?.srCheck;
  if (!path || !target.closest('#sceneReportRoot')) return;
  sceneReportSetPath(sceneReportState(), path, target.checked);
  sceneReportCommit();
});

document.addEventListener('click', event => {
  const t = event.target;
  const act = t.closest?.('[data-sr-act]');
  if (act) {
    const name = act.dataset.srAct;
    if (name === 'preview') previewSceneReport();
    else if (name === 'close') closeSceneReportPreview();
    else if (name === 'print') printSceneReport();
    return;
  }
  const root = t.closest?.('#sceneReportRoot');
  if (!root) return;
  const choice = t.closest('[data-sr-choice]');
  if (choice) {
    const data = sceneReportState(), group = choice.dataset.srChoice, value = choice.dataset.value;
    data[group] = data[group] === value ? '' : value; // bấm lại để bỏ chọn
    root.querySelectorAll(`[data-sr-choice="${group}"]`).forEach(btn => { const on = btn.dataset.value === data[group]; btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', String(on)); });
    sceneReportCommit();
    return;
  }
  const chip = t.closest('[data-sr-suggest]');
  if (chip) {
    const data = sceneReportState(), key = chip.dataset.srSuggest, sug = SCENE_REPORT_SUGGESTIONS[key][Number(chip.dataset.index)];
    if (!sug) return;
    data[key] = sceneReportInsertSuggestion(data[key], sug[1], data.plate, SCENE_REPORT_TEXT_FIELDS[key]);
    const field = root.querySelector(`[data-sr="${key}"]`);
    if (field) { field.value = data[key]; field.focus(); }
    sceneReportCommit();
    return;
  }
  if (t.closest('[data-sr-reset-auto]')) {
    const data = sceneReportState();
    SCENE_REPORT_AUTO_FIELDS.forEach(k => { data.manual[k] = false; });
    sceneReportRefresh();
    sceneReportCommit();
  }
});

document.addEventListener('keydown', event => { if (event.key === 'Escape' && document.getElementById('sceneReportPreview')) { event.stopPropagation(); closeSceneReportPreview(); } }, true);
