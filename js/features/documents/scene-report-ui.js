// Giao diện tab "Biên bản hiện trường" trong modal Chỉnh sửa hồ sơ.
// Toàn bộ tính toán dữ liệu và HTML bản in nằm ở scene-report-model.js; file này quản lý render & tương tác DOM.

const SCENE_REPORT_TEXT_AREAS = new Set(['scene', 'traces', 'samples', 'damageEval', 'parts', 'injuries', 'notes', 'proposals']);
const SCENE_REPORT_SYNC_FIELD_KEYS = ['accidentDate', 'accidentTime', 'accidentLocation', 'plate', 'driver', 'withParty'];
const SCENE_REPORT_SEC1_PROGRESS_KEYS = ['reportDate', 'reportTime', 'reportPlace', 'accidentDate', 'accidentTime', 'accidentLocation', 'plate', 'driver', 'withParty'];
const SCENE_REPORT_FIELD_MANUAL_MAP = {
  accidentDate: 'accidentDate',
  accidentTime: 'accidentTime',
  accidentLocation: 'accidentLocation',
  plate: 'plate',
  driver: 'driver',
  withParty: 'withParty',
  'participants.0.name': 'assessorName',
  'participants.0.phone': 'assessorPhone',
  'participants.1.name': 'driver',
  'participants.1.phone': 'driverPhone'
};

let sceneReportPreviewLastFocus = null;

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
  const manualKey = SCENE_REPORT_FIELD_MANUAL_MAP[path];
  if (manualKey) data.manual[manualKey] = true;
}

function sceneReportNowTime() {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(new Date());
    const h = parts.find(p => p.type === 'hour')?.value;
    const m = parts.find(p => p.type === 'minute')?.value;
    if (h && m) return `${h === '24' ? '00' : h}:${m}`;
  } catch (_) {}
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function sceneReportSnippet(template, plate) {
  return String(template || '').replace(/\{plate\}/g, String(plate || '').trim() || '………').trim();
}

function sceneReportFieldId(path) {
  return 'srField_' + String(path || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function sceneReportIcon(name) {
  switch (name) {
    case 'emblem':
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l2 2 4-4"/></svg>';
    case 'preview':
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
    case 'print':
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';
    case 'close':
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    case 'draw':
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>';
    case 'reset':
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>';
    default:
      return '';
  }
}

function sceneReportDamageIcon(spotKey) {
  const hl = spotKey === 'front' ? '<path d="M6 4h12v5H6z" fill="currentColor" opacity="0.28"/>'
    : spotKey === 'rear' ? '<path d="M6 15h12v5H6z" fill="currentColor" opacity="0.28"/>'
      : spotKey === 'body' ? '<path d="M5 8h3v8H5zM16 8h3v8h-3z" fill="currentColor" opacity="0.28"/>'
        : '<path d="M7 9h10v6H7z" fill="currentColor" opacity="0.28"/>';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${hl}<rect x="5" y="3" width="14" height="18" rx="4"/><path d="M7 8h10M7 16h10"/></svg>`;
}

function sceneReportActionBtn(label, act, opts) {
  const cfg = opts || {};
  const cls = ['sr-btn'];
  if (cfg.primary) cls.push('sr-btn--primary');
  if (cfg.compact) cls.push('sr-btn--compact');
  if (cfg.extraClass) cls.push(cfg.extraClass);
  const iconHtml = cfg.icon ? `<span class="sr-btn-icon">${sceneReportIcon(cfg.icon)}</span>` : '';
  return `<button type="button" class="${cls.join(' ')}" data-sr-act="${sceneReportEsc(act)}">${iconHtml}<span>${sceneReportEsc(label)}</span></button>`;
}

function sceneReportInput(path, value, attrs, cls) {
  const E = sceneReportEsc;
  return `<input id="${E(sceneReportFieldId(path))}" class="sr-input ${cls || ''}" data-sr="${E(path)}" value="${E(value)}" ${attrs || ''}>`;
}

function sceneReportField(path, label, inner, opts) {
  const cfg = opts || {};
  const E = sceneReportEsc;
  const cls = cfg.cls ? ` ${cfg.cls}` : '';
  const right = cfg.syncKey
    ? `<span class="sr-sync-tag" data-sr-sync-badge="${E(cfg.syncKey)}">Từ hồ sơ</span>`
    : (cfg.rightHtml || '');
  return `<div class="sr-field${cls}"><div class="sr-field-head"><label class="sr-field-label" for="${E(sceneReportFieldId(path))}">${E(label)}</label>${right}</div>${inner}</div>`;
}

function sceneReportSegmented(data, group, ariaLabel) {
  const E = sceneReportEsc;
  const keys = SCENE_REPORT_CHOICES[group] || [];
  return `<div class="sr-seg" role="group" aria-label="${E(ariaLabel)}">${keys.map(k =>
    `<button type="button" class="sr-seg-btn${data[group] === k ? ' on' : ''}" data-sr-choice="${E(group)}" data-value="${E(k)}" aria-pressed="${data[group] === k}">${E(SCENE_REPORT_CHOICE_LABELS[group][k])}</button>`
  ).join('')}</div>`;
}

function sceneReportChoiceTile(data, group, tag, title, opts) {
  const cfg = opts || {};
  const E = sceneReportEsc;
  const wide = cfg.wide ? ' is-wide' : '';
  return `<div class="sr-choice-tile${wide}" data-sr-item-tile="${E(cfg.item || '')}">` +
    `<div class="sr-tile-head"><span class="sr-item-tag" data-sr-item-badge="${E(cfg.item || '')}">${E(tag)}</span><strong>${E(title)}</strong></div>` +
    `${sceneReportSegmented(data, group, `${tag} ${title}`)}</div>`;
}

function sceneReportChips(key, data) {
  const E = sceneReportEsc;
  const list = SCENE_REPORT_SUGGESTIONS[key] || [];
  if (!list.length) return '';
  const cur = String(data[key] || '');
  const buttons = list.map((s, i) => {
    const used = cur.indexOf(sceneReportSnippet(s[1], data.plate)) !== -1;
    return `<button type="button" class="sr-chip${used ? ' is-used' : ''}" data-sr-suggest="${E(key)}" data-index="${i}" title="${E(s[1])}" aria-pressed="${used}">${used ? '✓' : '+'} ${E(s[0])}</button>`;
  }).join('');
  return `<div class="sr-chips-wrap"><span class="sr-chips-label">Gợi ý nhanh</span><div class="sr-chips" aria-label="Gợi ý nhanh">${buttons}</div></div>`;
}

function sceneReportText(data, key, tag, title, rows, hint, itemId) {
  const E = sceneReportEsc;
  const fid = sceneReportFieldId(key);
  const blockTag = tag ? `<span class="sr-item-tag"${itemId ? ` data-sr-item-badge="${E(itemId)}"` : ''}>${E(tag)}</span>` : '';
  return `<div class="sr-narrative-block" data-sr-text-block="${E(key)}"${itemId ? ` data-sr-item-tile="${E(itemId)}"` : ''}>` +
    `<div class="sr-block-head"><label class="sr-block-title" for="${E(fid)}">${blockTag}<span>${E(title)}</span>${hint ? `<em>${E(hint)}</em>` : ''}</label>` +
    `<span class="sr-done-pill">Đã nhập</span></div>` +
    `<textarea id="${E(fid)}" class="sr-input sr-area" data-sr="${E(key)}" rows="${rows || 3}" maxlength="${SCENE_REPORT_TEXT_FIELDS[key]}">${E(data[key])}</textarea>` +
    `${sceneReportChips(key, data)}</div>`;
}

function sceneReportSection(id, num, title, subtitle, rightHtml, bodyHtml) {
  return `<section class="sr-card" id="${sceneReportEsc(id)}">` +
    `<div class="sr-card-head"><div class="sr-card-title"><span class="sr-num">${sceneReportEsc(num)}</span><div><h4>${sceneReportEsc(title)}</h4><p>${sceneReportEsc(subtitle)}</p></div></div>${rightHtml || ''}</div>` +
    `<div class="sr-card-body">${bodyHtml}</div></section>`;
}

function sceneReportRenderForm(data) {
  const E = sceneReportEsc;

  const peopleRows = data.participants.map((p, i) => {
    const syncClass = i < 2 ? ' is-synced' : '';
    const syncAttr = i < 2 ? ` data-sr-prow="${i}"` : '';
    return `<div class="sr-prow${syncClass}"${syncAttr}><span class="sr-pidx">${i + 1}</span>` +
      sceneReportInput(`participants.${i}.name`, p.name, 'placeholder="Họ và tên"') +
      sceneReportInput(`participants.${i}.role`, p.role, 'placeholder="Vai trò"') +
      sceneReportInput(`participants.${i}.phone`, p.phone, 'placeholder="Số điện thoại" inputmode="tel"') +
      '</div>';
  }).join('');

  const sec1Right = '<button type="button" class="sr-reset-btn" data-sr-reset-auto>' +
    `${sceneReportIcon('reset')}<span data-sr-reset-label>Đồng bộ theo hồ sơ</span></button>`;

  const generalBody =
    `<div class="sr-grid g4">` +
      sceneReportField('reportDate', 'Ngày lập biên bản', sceneReportInput('reportDate', data.reportDate, 'type="date"')) +
      sceneReportField('reportTime', 'Giờ lập', sceneReportInput('reportTime', data.reportTime, 'type="time"'), {
        rightHtml: '<button type="button" class="sr-inline-act" data-sr-now="reportTime" title="Điền giờ hiện tại">Hiện tại</button>'
      }) +
      sceneReportField('reportPlace', 'Địa điểm lập biên bản', sceneReportInput('reportPlace', data.reportPlace, 'placeholder="Địa chỉ hoặc vị trí lập biên bản…"'), {
        cls: 'span2',
        rightHtml: '<button type="button" class="sr-inline-act" data-sr-copy-place title="Sao chép từ địa điểm tai nạn">Như địa điểm tai nạn</button>'
      }) +
    `</div>` +
    `<div class="sr-people-card">` +
      `<div class="sr-people-head"><span class="sr-people-title">Thành phần tham gia</span><span class="sr-people-note">Dòng 1–2 đồng bộ GĐV &amp; lái xe từ hồ sơ; dòng 3–4 nhập bổ sung nếu có</span></div>` +
      `<div class="sr-people-cols"><span>#</span><span>Họ và tên</span><span>Vai trò / chức danh</span><span>Số điện thoại</span></div>` +
      peopleRows +
    `</div>` +
    `<div class="sr-claim-inset">` +
      `<div class="sr-claim-inset-head"><span class="sr-claim-inset-title">Thông tin vụ tai nạn &amp; phương tiện</span><span class="sr-claim-inset-note">Tự lấy từ hồ sơ; sửa tay sẽ giữ giá trị riêng</span></div>` +
      `<div class="sr-grid g4">` +
        sceneReportField('accidentDate', 'Ngày xảy ra tai nạn', sceneReportInput('accidentDate', data.accidentDate, 'type="date"'), { syncKey: 'accidentDate' }) +
        sceneReportField('accidentTime', 'Giờ xảy ra', sceneReportInput('accidentTime', data.accidentTime, 'type="time"'), { syncKey: 'accidentTime' }) +
        sceneReportField('plate', 'Biển số xe', sceneReportInput('plate', data.plate), { syncKey: 'plate', cls: 'sr-field-plate' }) +
        sceneReportField('driver', 'Lái xe điều khiển', sceneReportInput('driver', data.driver), { syncKey: 'driver' }) +
      `</div>` +
      `<div class="sr-grid g2">` +
        sceneReportField('accidentLocation', 'Địa điểm xảy ra tai nạn (cây số, đường, xã, huyện, tỉnh…)', sceneReportInput('accidentLocation', data.accidentLocation), { syncKey: 'accidentLocation' }) +
        sceneReportField('withParty', 'Va chạm / xảy ra với', sceneReportInput('withParty', data.withParty), { syncKey: 'withParty' }) +
      `</div>` +
    `</div>`;

  const sec1 = sceneReportSection(
    'srSection1', 'I',
    'Thời gian, địa điểm & thành phần tham gia',
    'Thông tin hành chính của biên bản, thành phần chứng kiến và dữ liệu vụ tổn thất đồng bộ từ hồ sơ',
    sec1Right,
    generalBody
  );

  const weatherSplitTile =
    `<div class="sr-choice-tile is-wide" data-sr-item-tile="5">` +
      `<div class="sr-tile-head"><span class="sr-item-tag" data-sr-item-badge="5">[5]</span><strong>Thời tiết &amp; ánh sáng tại hiện trường</strong></div>` +
      `<div class="sr-weather-split">` +
        `<div class="sr-weather-sub"><span class="sr-sub-kicker">Thời tiết</span>${sceneReportSegmented(data, 'weather', '[5] Thời tiết')}</div>` +
        `<div class="sr-weather-sub"><span class="sr-sub-kicker">Ánh sáng</span>${sceneReportSegmented(data, 'light', '[5] Ánh sáng')}</div>` +
      `</div>` +
    `</div>`;

  const terrainTile =
    `<div class="sr-choice-tile is-wide sr-terrain-tile" data-sr-item-tile="3" data-sr-text-block="terrain">` +
      `<div class="sr-tile-head"><span class="sr-item-tag" data-sr-item-badge="3">[3]</span><label class="sr-tile-label" for="${E(sceneReportFieldId('terrain'))}">Địa hình, vật liệu nền hiện trường</label><span class="sr-done-pill">Đã nhập</span></div>` +
      sceneReportInput('terrain', data.terrain, 'placeholder="Mặt đường nhựa/bê tông, độ dốc, khúc cua, tầm nhìn…"') +
      sceneReportChips('terrain', data) +
    `</div>`;

  const driverCard =
    `<div class="sr-driver-card" data-sr-item-tile="6-7">` +
      `<div class="sr-driver-head">` +
        `<div class="sr-tile-head"><span class="sr-item-tag" data-sr-item-badge="6-7">[6–7]</span><strong>Người điều khiển phương tiện tại hiện trường</strong></div>` +
        sceneReportSegmented(data, 'driverPresence', '[6–7] Người điều khiển phương tiện') +
      `</div>` +
      `<div class="sr-driver-body is-split" data-sr-driver-body>` +
        `<div class="sr-branch" data-sr-branch="absent">` +
          `<div class="sr-branch-title"><span class="sr-item-tag" data-sr-item-badge="6">[6]</span><span>Trường hợp vắng mặt tại hiện trường</span></div>` +
          `<div class="sr-grid g2">` +
            sceneReportField('absentReason', 'Lý do vắng mặt', sceneReportInput('absentReason', data.absentReason, 'placeholder="Đi cấp cứu, làm việc với CSGT…"')) +
            sceneReportField('absentDestination', 'Địa điểm đến', sceneReportInput('absentDestination', data.absentDestination, 'placeholder="Bệnh viện, trụ sở công an…"')) +
          `</div>` +
        `</div>` +
        `<div class="sr-branch" data-sr-branch="present">` +
          `<div class="sr-branch-title"><span class="sr-item-tag" data-sr-item-badge="7">[7]</span><span>Tình trạng khi có mặt (sắc mặt &amp; hơi thở)</span></div>` +
          `<div class="sr-driver-status-fields">` +
            `<div class="sr-driver-status-col"><span class="sr-sub-kicker">Sắc mặt</span>${sceneReportSegmented(data, 'face', '[7] Sắc mặt')}</div>` +
            `<div class="sr-driver-status-col"><span class="sr-sub-kicker">Hơi thở</span>${sceneReportSegmented(data, 'breath', '[7] Hơi thở')}</div>` +
          `</div>` +
        `</div>` +
      `</div>` +
    `</div>`;

  const docsCard =
    `<div class="sr-subcard" data-sr-item-tile="8">` +
      `<div class="sr-subcard-head">` +
        `<div class="sr-tile-head"><span class="sr-item-tag" data-sr-item-badge="8">[8]</span><strong>Giấy tờ cung cấp tại hiện trường</strong></div>` +
        `<div class="sr-subcard-actions"><span class="sr-count-pill" data-sr-docs-count>0/${SCENE_REPORT_DOCS.length} đã chọn</span>` +
        `<button type="button" class="sr-inline-act" data-sr-docs-toggle>Chọn tất cả</button></div>` +
      `</div>` +
      `<div class="sr-check-grid">${SCENE_REPORT_DOCS.map(([k, l]) =>
        `<label class="sr-check-card"><input type="checkbox" data-sr-check="docs.${E(k)}" ${data.docs[k] ? 'checked' : ''}><span class="sr-check-box" aria-hidden="true"></span><span>${E(l)}</span></label>`
      ).join('')}</div>` +
      `<div class="sr-subcard-note">${sceneReportField('docNote', 'Ghi chú giấy tờ (lý do chưa có, thời gian bổ sung)', sceneReportInput('docNote', data.docNote, 'placeholder="VD: Hẹn bổ sung GPLX bản gốc khi làm việc tại văn phòng…"'))}</div>` +
    `</div>`;

  const sceneBody =
    `<div class="sr-choice-grid">` +
      sceneReportChoiceTile(data, 'sceneIntact', '[1]', 'Tình trạng hiện trường', { item: '1' }) +
      sceneReportChoiceTile(data, 'engineTemp', '[2]', 'Nhiệt độ động cơ', { item: '2' }) +
      terrainTile +
      sceneReportChoiceTile(data, 'ground', '[4]', 'Tính chất nền', { wide: true, item: '4' }) +
      weatherSplitTile +
    `</div>` +
    driverCard +
    docsCard +
    sceneReportText(data, 'scene', '[9]', 'Mô tả hiện trường, vị trí phương tiện', 4, 'Đánh số theo vị trí trên sơ đồ', '9') +
    sceneReportText(data, 'traces', '[10]', 'Dấu vết tại hiện trường', 4, 'Vị trí, khoảng cách, chiều hướng; điểm đâm va', '10') +
    sceneReportText(data, 'samples', '[11]', 'Mẫu vật thu được', 2, 'Không thu mẫu vật hoặc mô tả cụ thể chi tiết', '11');

  const sec2 = sceneReportSection(
    'srSection2', 'II',
    'Hiện trường vụ tai nạn',
    'Ghi nhận tình trạng hiện trường, điều kiện địa hình/thời tiết, lái xe, giấy tờ và dấu vết [1–11]',
    '<span class="sr-sec-badge" data-sr-card-count="2">0/11 mục</span>',
    sceneBody
  );

  const damageCard =
    `<div class="sr-subcard" data-sr-item-tile="12">` +
      `<div class="sr-subcard-head">` +
        `<div class="sr-tile-head"><span class="sr-item-tag" data-sr-item-badge="12">[12]</span><strong>Vị trí tổn thất trên phương tiện</strong></div>` +
        `<div class="sr-subcard-actions"><span class="sr-count-pill" data-sr-damage-count>0/${SCENE_REPORT_DAMAGE_SPOTS.length} vùng</span></div>` +
      `</div>` +
      `<div class="sr-damage">${SCENE_REPORT_DAMAGE_SPOTS.map(([k, l]) =>
        `<div class="sr-dspot${data.damage[k].on ? ' is-checked' : ''}" data-sr-dspot="${E(k)}">` +
          `<label class="sr-dspot-toggle"><input type="checkbox" data-sr-check="damage.${E(k)}.on" ${data.damage[k].on ? 'checked' : ''}><span class="sr-check-box" aria-hidden="true"></span><span>${E(l)}</span><span class="sr-dspot-icon">${sceneReportDamageIcon(k)}</span></label>` +
          sceneReportInput(`damage.${k}.text`, data.damage[k].text, 'placeholder="Trái / phải / chi tiết vị trí…"') +
        `</div>`
      ).join('')}</div>` +
    `</div>`;

  const propertyCard =
    `<div class="sr-subcard" data-sr-item-tile="14">` +
      `<div class="sr-subcard-head">` +
        `<div class="sr-tile-head"><span class="sr-item-tag" data-sr-item-badge="14">[14]</span><strong>Thiệt hại về tài sản &amp; mức ước tính</strong></div>` +
        `<div class="sr-subcard-actions"><span class="sr-count-pill" data-sr-prop-count>Chưa chọn</span></div>` +
      `</div>` +
      `<div class="sr-check-grid">${SCENE_REPORT_PROPERTY.map(([k, l]) =>
        `<label class="sr-check-card"><input type="checkbox" data-sr-check="property.${E(k)}" ${data.property[k] ? 'checked' : ''}><span class="sr-check-box" aria-hidden="true"></span><span>${E(l)}</span></label>`
      ).join('')}</div>` +
      `<div class="sr-subcard-range"><span class="sr-sub-kicker">Mức ước tính thiệt hại</span>${sceneReportSegmented(data, 'propertyRange', '[14] Mức ước tính')}</div>` +
      `<div class="sr-other-wrap" id="srPropertyOtherWrap">${sceneReportField('propertyOther', 'Khác (mô tả mức ước tính hoặc đối tượng tài sản khác)', sceneReportInput('propertyOther', data.propertyOther, 'placeholder="VD: Khoảng trên 50 triệu đồng / hư hỏng hàng rào hộ lan…"'))}</div>` +
      `<div class="sr-subcard-parts">${sceneReportText(data, 'parts', '', 'Liệt kê sơ bộ vật tư, phụ tùng thiệt hại', 2, 'Chọn nhanh nhóm phụ tùng thường gặp hoặc nhập tay')}</div>` +
    `</div>`;

  const closingStrip =
    `<div class="sr-closing-strip">` +
      `<div class="sr-closing-copy"><strong>Thời điểm kết thúc lập biên bản</strong><span>Ghi nhận tại mục kết thúc biểu mẫu ${E(SCENE_REPORT_FORM_CODE)} trước khi các bên ký xác nhận.</span></div>` +
      `<div class="sr-closing-control">` +
        `<label class="sr-field-label" for="${E(sceneReportFieldId('endTime'))}">Giờ kết thúc</label>` +
        sceneReportInput('endTime', data.endTime, 'type="time"') +
        `<button type="button" class="sr-inline-act" data-sr-now="endTime" title="Điền giờ hiện tại">Hiện tại</button>` +
      `</div>` +
    `</div>`;

  const damageBody =
    damageCard +
    sceneReportText(data, 'damageEval', '[13]', 'Đánh giá thiệt hại, ước thiệt hại', 3, 'Mức độ hư hỏng và hướng xử lý dự kiến', '13') +
    propertyCard +
    sceneReportText(data, 'injuries', '[15]', 'Thiệt hại về người', 2, 'Ghi rõ không có hoặc số lượng, tình trạng cấp cứu', '15') +
    sceneReportText(data, 'notes', '[16]', 'Ghi chú (lời khai lái xe, nhân chứng)', 4, 'Ghi chép lời khai, biên bản CSGT/cơ quan chức năng', '16') +
    sceneReportText(data, 'proposals', '', 'Đề xuất khác', 2, 'Đề nghị bổ sung hồ sơ hoặc giám định tháo rã') +
    closingStrip;

  const sec3 = sceneReportSection(
    'srSection3', 'III',
    'Thiệt hại sơ bộ & kết luận',
    'Khoanh vùng hư hỏng, ước thiệt hại, ghi nhận lời khai và giờ kết thúc biên bản [12–16]',
    '<span class="sr-sec-badge" data-sr-card-count="3">0/5 mục</span>',
    damageBody
  );

  const header =
    `<div class="sr-head">` +
      `<div class="sr-heading">` +
        `<div class="sr-emblem">${sceneReportIcon('emblem')}</div>` +
        `<div class="sr-heading-copy">` +
          `<span class="sr-eyebrow">Biểu mẫu ${E(SCENE_REPORT_FORM_CODE)} • Khổ in A4 chuẩn</span>` +
          `<h3>Biên bản giám định hiện trường</h3>` +
          `<p>Thông tin xe, lái xe, địa điểm lấy tự động từ hồ sơ; mọi ô đã sửa tay sẽ giữ nguyên giá trị riêng.</p>` +
        `</div>` +
      `</div>` +
      `<div class="sr-head-right">` +
        `<span id="sceneReportAutoStatus" class="sr-status"></span>` +
        `<div class="sr-actions">` +
          sceneReportActionBtn('Xem trước', 'preview', { compact: true, icon: 'preview' }) +
          sceneReportActionBtn('In / Lưu PDF', 'print', { primary: true, compact: true, icon: 'print' }) +
        `</div>` +
      `</div>` +
    `</div>`;

  const overview =
    `<div class="sr-overview">` +
      `<div class="sr-progress-box">` +
        `<div class="sr-progress-top">` +
          `<span class="sr-progress-label">Tiến độ hoàn thiện 16 mục biên bản</span>` +
          `<span id="sceneReportProgress" class="sr-progress">0/16 mục đã nhập</span>` +
        `</div>` +
        `<div class="sr-progress-track" aria-hidden="true"><div class="sr-progress-fill" data-sr-progress-bar style="width:0%"></div></div>` +
      `</div>` +
      `<nav class="sr-nav-pills" aria-label="Điều hướng nhanh các phần">` +
        `<button type="button" class="sr-nav-pill" data-sr-jump="srSection1"><span>I. Hành chính</span><em data-sr-sec-count="1">0/9</em></button>` +
        `<button type="button" class="sr-nav-pill" data-sr-jump="srSection2"><span>II. Hiện trường [1–11]</span><em data-sr-sec-count="2">0/11</em></button>` +
        `<button type="button" class="sr-nav-pill" data-sr-jump="srSection3"><span>III. Thiệt hại [12–16]</span><em data-sr-sec-count="3">0/5</em></button>` +
      `</nav>` +
    `</div>`;

  const footer =
    `<div class="sr-footer">` +
      `<div class="sr-diagram-box">` +
        `<label class="sr-check-inline"><input type="checkbox" data-sr-check="includeDiagram" ${data.includeDiagram ? 'checked' : ''}><span class="sr-check-box" aria-hidden="true"></span><span>Kèm trang sơ đồ hiện trường (trang 3 khi in)</span></label>` +
        `<span class="sr-diagram-pill" data-sr-diagram-badge>Chưa vẽ sơ đồ</span>` +
        `<button type="button" class="sr-draw-link" data-sr-act="draw-diagram">${sceneReportIcon('draw')}<span>Mở bảng vẽ sơ đồ</span></button>` +
      `</div>` +
      `<div class="sr-actions">` +
        sceneReportActionBtn('Xem trước', 'preview', { icon: 'preview' }) +
        sceneReportActionBtn('In / Lưu PDF', 'print', { primary: true, icon: 'print' }) +
      `</div>` +
    `</div>`;

  return header + overview + sec1 + sec2 + sec3 + footer;
}

function sceneReportUpdateUiState(root, data) {
  if (!root || !data) return;

  const p = sceneReportProgress(data);
  const pct = p.total ? Math.round((p.filled / p.total) * 100) : 0;
  const complete = p.total > 0 && p.filled >= p.total;
  const progEl = root.querySelector('#sceneReportProgress');
  if (progEl) {
    progEl.textContent = `${p.filled}/${p.total} mục đã nhập`;
    progEl.classList.toggle('is-complete', complete);
  }
  const barEl = root.querySelector('[data-sr-progress-bar]');
  if (barEl) {
    barEl.style.width = `${pct}%`;
    barEl.classList.toggle('is-complete', complete);
  }

  const itemStates = SCENE_REPORT_ITEM_CHECKS.map(fn => !!fn(data));
  const sec1Done = SCENE_REPORT_SEC1_PROGRESS_KEYS.filter(k => !!String(data[k] || '').trim()).length;
  const sec2Done = itemStates.slice(0, 11).filter(Boolean).length;
  const sec3Done = itemStates.slice(11).filter(Boolean).length;

  const setCountText = (sel, text) => {
    const el = root.querySelector(sel);
    if (el) el.textContent = text;
  };
  setCountText('[data-sr-sec-count="1"]', `${sec1Done}/${SCENE_REPORT_SEC1_PROGRESS_KEYS.length}`);
  setCountText('[data-sr-sec-count="2"]', `${sec2Done}/11`);
  setCountText('[data-sr-sec-count="3"]', `${sec3Done}/5`);
  setCountText('[data-sr-card-count="2"]', `${sec2Done}/11 mục`);
  setCountText('[data-sr-card-count="3"]', `${sec3Done}/5 mục`);

  root.querySelectorAll('[data-sr-item-tile]').forEach(tile => {
    const id = tile.dataset.srItemTile;
    let filled = false;
    if (id === '6-7') filled = !!(itemStates[5] || itemStates[6]);
    else {
      const idx = Number(id) - 1;
      if (idx >= 0 && idx < itemStates.length) filled = itemStates[idx];
    }
    tile.classList.toggle('is-filled', filled);
  });

  SCENE_REPORT_SYNC_FIELD_KEYS.forEach(k => {
    const badge = root.querySelector(`[data-sr-sync-badge="${k}"]`);
    if (!badge) return;
    const isManual = !!data.manual?.[k];
    badge.classList.toggle('is-manual', isManual);
    badge.textContent = isManual ? 'Sửa tay' : 'Từ hồ sơ';
  });

  const row0 = root.querySelector('[data-sr-prow="0"]');
  if (row0) row0.classList.toggle('is-synced', !data.manual?.assessorName && !data.manual?.assessorPhone);
  const row1 = root.querySelector('[data-sr-prow="1"]');
  if (row1) row1.classList.toggle('is-synced', !data.manual?.driver && !data.manual?.driverPhone);

  const manualCount = SCENE_REPORT_AUTO_FIELDS.filter(k => !!data.manual?.[k]).length;
  const resetBtn = root.querySelector('[data-sr-reset-auto]');
  if (resetBtn) {
    resetBtn.classList.toggle('is-dirty', manualCount > 0);
    const lbl = resetBtn.querySelector('[data-sr-reset-label]');
    if (lbl) lbl.textContent = manualCount > 0 ? `Đồng bộ lại ${manualCount} ô từ hồ sơ` : 'Đang đồng bộ theo hồ sơ';
  }

  const hasAbsentData = !!(data.absentReason.trim() || data.absentDestination.trim());
  const hasPresentData = !!(data.face || data.breath);
  const showAbsent = data.driverPresence === '' || data.driverPresence === 'absent' || hasAbsentData;
  const showPresent = data.driverPresence === '' || data.driverPresence === 'present' || hasPresentData;
  const absentBranch = root.querySelector('[data-sr-branch="absent"]');
  const presentBranch = root.querySelector('[data-sr-branch="present"]');
  const driverBody = root.querySelector('[data-sr-driver-body]');
  if (absentBranch) absentBranch.hidden = !showAbsent;
  if (presentBranch) presentBranch.hidden = !showPresent;
  if (driverBody) driverBody.classList.toggle('is-split', showAbsent && showPresent);

  const docsDone = SCENE_REPORT_DOCS.filter(([k]) => !!data.docs[k]).length;
  setCountText('[data-sr-docs-count]', `${docsDone}/${SCENE_REPORT_DOCS.length} đã chọn`);
  const docsToggleBtn = root.querySelector('[data-sr-docs-toggle]');
  if (docsToggleBtn) docsToggleBtn.textContent = docsDone === SCENE_REPORT_DOCS.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả';

  const dmgDone = SCENE_REPORT_DAMAGE_SPOTS.filter(([k]) => !!data.damage[k]?.on).length;
  setCountText('[data-sr-damage-count]', `${dmgDone}/${SCENE_REPORT_DAMAGE_SPOTS.length} vùng`);
  SCENE_REPORT_DAMAGE_SPOTS.forEach(([k]) => {
    const spot = root.querySelector(`[data-sr-dspot="${k}"]`);
    if (spot) spot.classList.toggle('is-checked', !!data.damage[k]?.on);
  });

  const propChecked = SCENE_REPORT_PROPERTY.filter(([k]) => !!data.property[k]).length;
  const propParts = [];
  if (propChecked) propParts.push(`${propChecked} đối tượng`);
  if (data.propertyRange) propParts.push('Đã chọn mức');
  setCountText('[data-sr-prop-count]', propParts.length ? propParts.join(' • ') : 'Chưa chọn');

  const otherWrap = root.querySelector('#srPropertyOtherWrap');
  if (otherWrap) otherWrap.hidden = !(data.propertyRange === 'other' || !!data.propertyOther.trim());

  SCENE_REPORT_TEXT_AREAS.forEach(key => {
    const block = root.querySelector(`[data-sr-text-block="${key}"]`);
    if (block) block.classList.toggle('is-filled', !!String(data[key] || '').trim());
  });
  const terrainBlock = root.querySelector('[data-sr-text-block="terrain"]');
  if (terrainBlock) terrainBlock.classList.toggle('is-filled', !!String(data.terrain || '').trim());

  root.querySelectorAll('[data-sr-suggest]').forEach(chip => {
    const key = chip.dataset.srSuggest;
    const list = SCENE_REPORT_SUGGESTIONS[key] || [];
    const s = list[Number(chip.dataset.index)];
    if (!s) return;
    const used = String(data[key] || '').indexOf(sceneReportSnippet(s[1], data.plate)) !== -1;
    chip.classList.toggle('is-used', used);
    chip.setAttribute('aria-pressed', String(used));
    const labelText = ` ${s[0]}`;
    chip.textContent = (used ? '✓' : '+') + labelText;
  });

  const diagBadge = root.querySelector('[data-sr-diagram-badge]');
  if (diagBadge) {
    const ready = !!sceneReportDiagramUrl();
    diagBadge.classList.toggle('is-ready', ready);
    diagBadge.classList.toggle('is-empty', !ready);
    diagBadge.textContent = ready ? 'Đã có sơ đồ hiện trường' : 'Chưa vẽ sơ đồ';
  }
}

function sceneReportUpdateProgress() {
  const root = document.getElementById('sceneReportRoot');
  if (!root || !collectionGuideDraft?.sceneReport) return;
  sceneReportUpdateUiState(root, collectionGuideDraft.sceneReport);
}

function sceneReportRefresh() {
  const pane = document.getElementById('tabPane_SceneReport');
  if (!pane || !collectionGuideDraft) return;
  const data = sceneReportState();
  pane.innerHTML = `<div class="sr-root" id="sceneReportRoot">${sceneReportRenderForm(data)}</div>`;
  sceneReportUpdateUiState(document.getElementById('sceneReportRoot'), data);
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

function closeSceneReportPreview() {
  const existing = document.getElementById('sceneReportPreview');
  if (!existing) return;
  existing.remove();
  if (sceneReportPreviewLastFocus && typeof sceneReportPreviewLastFocus.focus === 'function') {
    try { sceneReportPreviewLastFocus.focus({ preventScroll: true }); } catch (_) {}
  }
  sceneReportPreviewLastFocus = null;
}

function previewSceneReport() {
  sceneReportPreviewLastFocus = document.activeElement;
  document.getElementById('sceneReportPreview')?.remove();

  const html = sceneReportBuildHtml();
  const plate = String(collectionGuideValue('modalPendingBienSo') || '').trim();
  const claimId = String(collectionGuideValue('modalPendingSoHoSo') || '').trim();
  const E = sceneReportEsc;
  const caseSummary = [plate ? `BKS ${plate}` : '', claimId ? `HSBT ${claimId}` : ''].filter(Boolean).join(' • ') || 'Hồ sơ giám định hiện trường';

  const overlay = document.createElement('div');
  overlay.id = 'sceneReportPreview';
  overlay.className = 'sr-preview';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'srPreviewTitle');
  overlay.setAttribute('aria-describedby', 'srPreviewDesc');

  overlay.innerHTML =
    `<div class="sr-preview-panel">` +
      `<div class="sr-preview-bar">` +
        `<div class="sr-preview-heading">` +
          `<div class="sr-preview-icon">${sceneReportIcon('emblem')}</div>` +
          `<div>` +
            `<span class="sr-preview-eyebrow">Biểu mẫu chuẩn Tasco • Xem trước bản in</span>` +
            `<h3 id="srPreviewTitle">Biên bản giám định hiện trường${plate ? ` — ${E(plate)}` : ''}</h3>` +
            `<p id="srPreviewDesc">Trong hộp thoại in, chọn "Lưu dưới dạng PDF"; tắt "Đầu trang và chân trang" nếu trình duyệt hiển thị.</p>` +
          `</div>` +
        `</div>` +
        `<div class="sr-preview-actions">` +
          sceneReportActionBtn('In / Lưu PDF', 'print', { primary: true, icon: 'print' }) +
          `<span class="sr-preview-divider" aria-hidden="true"></span>` +
          sceneReportActionBtn('Đóng', 'close', { extraClass: 'sr-preview-close', icon: 'close' }) +
        `</div>` +
      `</div>` +
      `<div class="sr-preview-context">` +
        `<span class="sr-preview-format">Biểu mẫu ${E(SCENE_REPORT_FORM_CODE)} • Khổ A4 dọc</span>` +
        `<span class="sr-preview-case">${E(caseSummary)}</span>` +
      `</div>` +
      `<iframe title="Xem trước biên bản" class="sr-preview-frame"></iframe>` +
    `</div>`;

  document.body.append(overlay);

  const iframe = overlay.querySelector('iframe');
  iframe.addEventListener('load', () => {
    try {
      iframe.contentWindow?.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeSceneReportPreview();
        }
      });
    } catch (_) {}
  });
  iframe.srcdoc = html;

  const closeBtn = overlay.querySelector('.sr-preview-close');
  if (closeBtn) closeBtn.focus();
}

function printSceneReport() {
  const html = sceneReportBuildHtml();
  return printCollectionDocumentHtml(html, 'Biên bản giám định hiện trường');
}

function sceneReportSyncChoiceGroup(root, group, value) {
  root.querySelectorAll(`[data-sr-choice="${group}"]`).forEach(btn => {
    const on = btn.dataset.value === value;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
  });
}

document.addEventListener('input', event => {
  const target = event.target;
  const path = target.dataset?.sr;
  const root = target.closest?.('#sceneReportRoot');
  if (!path || !root) return;

  const data = sceneReportState();
  const limit = SCENE_REPORT_TEXT_FIELDS[path] || 120;
  const val = String(target.value).slice(0, limit);
  sceneReportSetPath(data, path, val);
  sceneReportMarkManual(data, path);

  // Tự liên kết [6] khi gõ vào lý do / nơi đến lúc chưa chọn vắng mặt hay có mặt
  if ((path === 'absentReason' || path === 'absentDestination') && val.trim() && data.driverPresence === '') {
    data.driverPresence = 'absent';
    sceneReportSyncChoiceGroup(root, 'driverPresence', 'absent');
  }

  // Tự tích [12] khi nhập mô tả tổn thất cho vùng tương ứng
  const dmgMatch = path.match(/^damage\.(\w+)\.text$/);
  if (dmgMatch && val.trim()) {
    const spotKey = dmgMatch[1];
    if (data.damage[spotKey] && !data.damage[spotKey].on) {
      data.damage[spotKey].on = true;
      const cb = root.querySelector(`[data-sr-check="damage.${spotKey}.on"]`);
      if (cb) cb.checked = true;
    }
  }

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
  if (t.id === 'sceneReportPreview') {
    closeSceneReportPreview();
    return;
  }

  const act = t.closest?.('[data-sr-act]');
  if (act) {
    const name = act.dataset.srAct;
    if (name === 'preview') previewSceneReport();
    else if (name === 'close') closeSceneReportPreview();
    else if (name === 'print') printSceneReport();
    else if (name === 'draw-diagram') {
      if (typeof openSceneDrawingModal === 'function') openSceneDrawingModal();
      else if (typeof triggerToast === 'function') triggerToast('Vui lòng dùng nút "Vẽ sơ đồ hiện trường" trên thanh đầu hồ sơ.', 'info');
    }
    return;
  }

  const root = t.closest?.('#sceneReportRoot');
  if (!root) return;

  const jump = t.closest('[data-sr-jump]');
  if (jump) {
    const section = document.getElementById(jump.dataset.srJump);
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const nowBtn = t.closest('[data-sr-now]');
  if (nowBtn) {
    const fieldKey = nowBtn.dataset.srNow;
    const data = sceneReportState();
    const hhmm = sceneReportNowTime();
    sceneReportSetPath(data, fieldKey, hhmm);
    const input = root.querySelector(`[data-sr="${fieldKey}"]`);
    if (input) { input.value = hhmm; input.focus(); }
    sceneReportCommit();
    return;
  }

  const copyPlaceBtn = t.closest('[data-sr-copy-place]');
  if (copyPlaceBtn) {
    const data = sceneReportState();
    const loc = String(data.accidentLocation || '').trim();
    if (loc) {
      data.reportPlace = loc.slice(0, SCENE_REPORT_TEXT_FIELDS.reportPlace || 300);
      const input = root.querySelector('[data-sr="reportPlace"]');
      if (input) { input.value = data.reportPlace; input.focus(); }
      sceneReportCommit();
    } else if (typeof triggerToast === 'function') {
      triggerToast('Chưa có địa điểm xảy ra tai nạn để sao chép.', 'info');
    }
    return;
  }

  const docsToggleBtn = t.closest('[data-sr-docs-toggle]');
  if (docsToggleBtn) {
    const data = sceneReportState();
    const allChecked = SCENE_REPORT_DOCS.every(([k]) => !!data.docs[k]);
    const nextVal = !allChecked;
    SCENE_REPORT_DOCS.forEach(([k]) => {
      data.docs[k] = nextVal;
      const cb = root.querySelector(`[data-sr-check="docs.${k}"]`);
      if (cb) cb.checked = nextVal;
    });
    sceneReportCommit();
    return;
  }

  const choice = t.closest('[data-sr-choice]');
  if (choice) {
    const data = sceneReportState(), group = choice.dataset.srChoice, value = choice.dataset.value;
    data[group] = data[group] === value ? '' : value; // bấm lại để bỏ chọn
    sceneReportSyncChoiceGroup(root, group, data[group]);

    // Chọn sắc mặt / hơi thở khi chưa chọn trạng thái lái xe → tự chọn "Có mặt tại hiện trường"
    if ((group === 'face' || group === 'breath') && data[group] && data.driverPresence === '') {
      data.driverPresence = 'present';
      sceneReportSyncChoiceGroup(root, 'driverPresence', 'present');
    }

    if (group === 'propertyRange' && data.propertyRange === 'other') {
      const otherWrap = root.querySelector('#srPropertyOtherWrap');
      if (otherWrap) otherWrap.hidden = false;
      const otherInput = root.querySelector('[data-sr="propertyOther"]');
      if (otherInput) otherInput.focus();
    }

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

document.addEventListener('keydown', event => {
  const preview = document.getElementById('sceneReportPreview');
  if (!preview) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeSceneReportPreview();
    return;
  }
  if (event.key === 'Tab') {
    const focusables = Array.from(preview.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}, true);

// Làm mới huy hiệu trạng thái sơ đồ khi người dùng quay lại tab sau lúc vẽ sơ đồ
document.addEventListener('focusin', event => {
  if (event.target.closest?.('#tabPane_SceneReport')) sceneReportUpdateProgress();
});
