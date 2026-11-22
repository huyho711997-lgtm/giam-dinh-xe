// Giao diện khối "AI phân tích ảnh hiện trường" trong tab Biên bản hiện trường (đặt đầu phần II).
// Ảnh chỉ giữ trong bộ nhớ trang (không lưu vào hồ sơ); kết quả AI là bản nháp, chỉ ghi vào mục [9][10][11] khi bấm "Áp dụng".
// Phụ thuộc (gọi lúc chạy): SceneReportAI, sceneReportState/sceneReportCommit/sceneReportEsc/sceneReportIcon (scene-report-ui.js), GeminiKeyStore.
const sceneReportAi = {claim: '', photos: [], note: '', busy: false, preparing: false, controller: null, stopped: false, result: null, error: '', applied: '', pick: {}, mode: {}, draft: {}, extra: null, pickX: {}, deep: null, model: ''};
const SCENE_REPORT_AI_FIELDS = [['scene', '[9]', 'Mô tả hiện trường, vị trí phương tiện'], ['traces', '[10]', 'Dấu vết tại hiện trường'], ['samples', '[11]', 'Mẫu vật thu được']];

// Các mục còn lại AI có thể điền từ ảnh: [3][4][5][12][13][14]. Không đoán [1][2][6][7][8][15][16] vì ảnh không chứng minh được.
const SCENE_REPORT_AI_EXTRA = [
  {key: 'terrain', tag: '[3]', title: 'Địa hình, vật liệu nền', kind: 'line'},
  {key: 'ground', tag: '[4]', title: 'Tính chất nền', kind: 'choice'},
  {key: 'weather', tag: '[5]', title: 'Thời tiết', kind: 'choice'},
  {key: 'light', tag: '[5]', title: 'Ánh sáng', kind: 'choice'},
  {key: 'damage', tag: '[12]', title: 'Vị trí tổn thất trên xe', kind: 'damage'},
  {key: 'damageEval', tag: '[13]', title: 'Đánh giá thiệt hại sơ bộ', kind: 'area'},
  {key: 'parts', tag: '[14]', title: 'Vật tư, phụ tùng thiệt hại', kind: 'line'},
  {key: 'property', tag: '[14]', title: 'Tài sản bị thiệt hại', kind: 'prop'}
];
const SCENE_REPORT_AI_PROP_LABELS = {insured: 'Xe bảo hiểm vật chất Tasco', thirdParty: 'Tài sản bên thứ ba'};

function sceneReportAiExtraHas(key, extra) {
  if (!extra) return false;
  if (key === 'damage') return SceneReportAI.SPOTS.some(spot => String(extra.damage?.[spot] || '').trim());
  if (key === 'property') return !!(extra.property?.insured || extra.property?.thirdParty);
  return !!String(extra[key] || '').trim();
}
// Giá trị đang có trong biên bản (để so sánh, và để mặc định KHÔNG ghi đè mục đã nhập).
function sceneReportAiExtraCurrent(key, data) {
  if (key === 'damage') return SceneReportAI.SPOTS.filter(spot => data.damage?.[spot]?.on || String(data.damage?.[spot]?.text || '').trim()).length ? 'đã nhập' : '';
  if (key === 'property') return data.property?.insured || data.property?.thirdParty ? 'đã chọn' : '';
  return String(data[key] || '').trim();
}
function sceneReportAiExtraPicked() {
  const st = sceneReportAi;
  return SCENE_REPORT_AI_EXTRA.filter(row => st.pickX[row.key] && sceneReportAiExtraHas(row.key, st.extra)).length;
}
function sceneReportAiPickedCount() {
  const st = sceneReportAi;
  return SCENE_REPORT_AI_FIELDS.filter(([key]) => st.pick[key] && String(st.draft[key] || '').trim()).length + sceneReportAiExtraPicked();
}
function sceneReportAiExtraHtml() {
  const E = sceneReportEsc, st = sceneReportAi, data = sceneReportState(), extra = st.extra;
  if (!extra || !SCENE_REPORT_AI_EXTRA.some(row => sceneReportAiExtraHas(row.key, extra))) return '';
  const labels = SCENE_REPORT_CHOICE_LABELS;
  const rows = SCENE_REPORT_AI_EXTRA.filter(row => sceneReportAiExtraHas(row.key, extra)).map(row => {
    const key = row.key, current = sceneReportAiExtraCurrent(key, data);
    let control = '';
    if (row.kind === 'line') control = '<input class="sr-input sr-ai-x-input" type="text" data-sr-ai-x="' + key + '" maxlength="' + SceneReportAI.LIMITS[key] + '" value="' + E(extra[key]) + '" aria-label="Đề xuất cho ' + E(row.tag) + '">';
    else if (row.kind === 'area') control = '<textarea class="sr-input sr-area sr-ai-text" data-sr-ai-x="' + key + '" rows="3" maxlength="' + SceneReportAI.LIMITS[key] + '" aria-label="Đề xuất cho ' + E(row.tag) + '">' + E(extra[key]) + '</textarea>';
    else if (row.kind === 'choice') control = '<select class="sr-ai-mode sr-ai-x-select" data-sr-ai-x="' + key + '" aria-label="Đề xuất cho ' + E(row.title) + '">'
      + Object.keys(labels[key]).map(value => '<option value="' + value + '"' + (extra[key] === value ? ' selected' : '') + '>' + E(labels[key][value]) + '</option>').join('') + '</select>';
    else if (row.kind === 'damage') control = '<div class="sr-ai-x-damage">' + SCENE_REPORT_DAMAGE_SPOTS.map(([spot, label]) =>
      '<label class="sr-ai-x-spot"><span>' + E(label) + '</span><input class="sr-input" type="text" data-sr-ai-x-damage="' + spot + '" maxlength="' + SceneReportAI.LIMITS.damageText + '" value="' + E(extra.damage[spot]) + '" placeholder="Không thấy hư hại"></label>').join('') + '</div>';
    else control = '<div class="sr-ai-x-prop">' + Object.keys(SCENE_REPORT_AI_PROP_LABELS).map(prop =>
      '<label class="sr-ai-x-propitem"><input type="checkbox" data-sr-ai-x-prop="' + prop + '"' + (extra.property[prop] ? ' checked' : '') + '><span>' + E(SCENE_REPORT_AI_PROP_LABELS[prop]) + '</span></label>').join('') + '</div>';
    const now = current && row.kind === 'choice' ? labels[key][current] : current;
    return '<div class="sr-ai-xrow' + (st.pickX[key] ? ' is-on' : '') + '">'
      + '<label class="sr-ai-pick"><input type="checkbox" data-sr-ai-x-pick="' + key + '"' + (st.pickX[key] ? ' checked' : '') + '><span class="sr-check-box" aria-hidden="true"></span><span class="sr-item-tag">' + E(row.tag) + '</span><strong>' + E(row.title) + '</strong></label>'
      + (now ? '<span class="sr-ai-x-now" title="Biên bản đang có nội dung ở mục này; tick chọn sẽ ghi đè">Đang có: ' + E(String(now).slice(0, 60)) + '</span>' : '')
      + control + '</div>';
  }).join('');
  return '<div class="sr-ai-card sr-ai-extra"><div class="sr-ai-card-head"><strong>Các mục khác đọc được từ ảnh</strong><span class="sr-ai-x-hint">Mục đã có nội dung mặc định không tick, tránh ghi đè</span></div>' + rows + '</div>';
}

// ---- Chọn mô hình (dùng chung danh sách mô hình/khoá với Công văn AI) ----
const SCENE_REPORT_AI_MODEL_KEY = 'sceneReport.aiModel.v1', SCENE_REPORT_AI_DEEP_KEY = 'sceneReport.aiDeep.v1';
const sceneReportAiLs = {
  get(key) { try { return localStorage.getItem(key) || ''; } catch (_) { return ''; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch (_) { /* hết chỗ lưu: giữ trong phiên */ } }
};
const sceneReportAiModels = () => (typeof OfficialLetterModels !== 'undefined' && typeof OfficialLetterAI !== 'undefined' ? OfficialLetterModels : null);
// Trả về {M, cfg, options, id, current} hoặc null nếu chưa có bộ chọn mô hình (khi đó dùng Gemini trực tiếp như trước).
function sceneReportAiModelState() {
  const M = sceneReportAiModels();
  if (!M) return null;
  const cfg = M.load(), options = SceneReportAI.modelOptions(M, cfg);
  if (!options.length) return null;
  const id = SceneReportAI.pickModel(options, sceneReportAi.model || sceneReportAiLs.get(SCENE_REPORT_AI_MODEL_KEY), cfg.selected);   // lựa chọn trong phiên giữ cả khi trình duyệt không cho lưu localStorage
  return {M, cfg, options, id, current: options.find(option => option.id === id) || options[0]};
}
function sceneReportAiDeepOn(model) {
  if (!model || !model.current.reasoning) return false;
  if (sceneReportAi.deep === null) sceneReportAi.deep = sceneReportAiLs.get(SCENE_REPORT_AI_DEEP_KEY) !== '0';
  return sceneReportAi.deep;
}
function sceneReportAiModelHtml(locked) {
  const E = sceneReportEsc, model = sceneReportAiModelState();
  if (!model) return '';
  const text = option => (option.local ? 'Antigravity · ' + option.model : option.label) + (option.free ? ' · miễn phí' : '');
  const select = '<div class="sr-ai-model"><span class="sr-ai-model-label">Mô hình AI</span><details class="sr-ai-model-menu">'
    + '<summary aria-label="Chọn mô hình AI đọc ảnh"' + (locked ? ' aria-disabled="true"' : '') + '><span class="sr-ai-model-icon">' + sceneReportIcon('sparkles') + '</span><span class="sr-ai-model-current">' + E(text(model.current)) + '</span><span class="sr-ai-chevron" aria-hidden="true">⌄</span></summary>'
    + '<div class="sr-ai-model-options" aria-label="Chọn mô hình AI">' + model.options.map(option => '<button type="button" data-sr-ai-model-option="' + E(option.id) + '" aria-pressed="' + (option.id === model.id) + '"' + (locked ? ' disabled' : '') + '><span>' + E(text(option)) + '</span>' + (option.id === model.id ? '<span aria-hidden="true">✓</span>' : '') + '</button>').join('') + '</div></details></div>';
  const deep = model.current.reasoning
    ? '<label class="sr-ai-deep" title="AI suy nghĩ kỹ hơn trước khi viết; chậm hơn và tốn hạn mức hơn"><input type="checkbox" data-sr-ai-deep' + (sceneReportAiDeepOn(model) ? ' checked' : '') + (locked ? ' disabled' : '') + '><span class="sr-ai-deep-content">' + sceneReportIcon('sparkles') + '<span>Suy luận sâu</span><span class="sr-ai-switch" aria-hidden="true"></span></span></label>' : '';
  const note = model.current.local ? '<p class="sr-ai-local">Antigravity cần công cụ kết nối trên máy này. Suy luận sâu có thể mất 1–3 phút.</p>' : '';
  return select + deep + note;
}

function sceneReportAiClaimKey() {
  const id = typeof editingPendingClaimId !== 'undefined' && editingPendingClaimId ? editingPendingClaimId : '';
  return id + '|' + (typeof collectionGuideValue === 'function' ? collectionGuideValue('modalPendingBienSo') : '');
}
// Đổi sang hồ sơ khác thì bỏ ảnh/kết quả của hồ sơ cũ (tránh gửi nhầm ảnh vụ khác).
function sceneReportAiSync() {
  const key = sceneReportAiClaimKey();
  if (sceneReportAi.claim === key) return;
  if (sceneReportAi.controller) { try { sceneReportAi.controller.abort(); } catch (_) { /* bỏ qua */ } }
  Object.assign(sceneReportAi, {claim: key, photos: [], note: '', busy: false, preparing: false, controller: null, stopped: false, result: null, error: '', applied: '', pick: {}, mode: {}, draft: {}});
}

function sceneReportAiResultHtml() {
  const E = sceneReportEsc, st = sceneReportAi, result = st.result, data = sceneReportState();
  const cards = SCENE_REPORT_AI_FIELDS.map(([key, tag, title]) => {
    const text = st.draft[key] ?? '', has = !!String(result[key] || '').trim(), current = String(data[key] || '').trim();
    return '<div class="sr-ai-card' + (has ? '' : ' is-empty') + (st.pick[key] ? ' is-on' : '') + '">'
      + '<div class="sr-ai-card-head"><label class="sr-ai-pick"><input type="checkbox" data-sr-ai-pick="' + key + '"' + (st.pick[key] ? ' checked' : '') + (has ? '' : ' disabled') + '><span class="sr-check-box" aria-hidden="true"></span><span class="sr-item-tag">' + tag + '</span><strong>' + E(title) + '</strong></label>'
      + (has && current ? '<select class="sr-ai-mode" data-sr-ai-mode="' + key + '" aria-label="Cách ghi vào ' + tag + '"><option value="append"' + ((st.mode[key] || 'append') === 'append' ? ' selected' : '') + '>Thêm vào cuối</option><option value="replace"' + (st.mode[key] === 'replace' ? ' selected' : '') + '>Thay nội dung hiện có</option></select>' : '') + '</div>'
      + (has ? '<textarea class="sr-input sr-area sr-ai-text" data-sr-ai-text="' + key + '" rows="' + Math.min(9, Math.max(3, text.split('\n').length + 1)) + '" maxlength="' + SceneReportAI.LIMITS[key] + '" aria-label="Đề xuất cho ' + tag + '">' + E(text) + '</textarea>'
        : '<p class="sr-ai-none">AI không có đề xuất cho mục này' + (key === 'samples' ? ' (không thấy mẫu vật trong ảnh — nếu không thu mẫu, dùng gợi ý "Không thu mẫu vật").' : '.') + '</p>')
      + '</div>';
  }).join('');
  const evidence = result.evidence.length ? '<details class="sr-ai-more"><summary>Căn cứ AI nhìn thấy trong ảnh (' + result.evidence.length + ')</summary><ul>' + result.evidence.map(item => '<li>' + (item.photo ? '<b>Ảnh ' + item.photo + ':</b> ' : '') + E(item.saw) + (item.conclusion ? ' <em>→ ' + E(item.conclusion) + '</em>' : '') + '</li>').join('') + '</ul></details>' : '';
  const verify = result.verify.length ? '<div class="sr-ai-verify"><strong>' + sceneReportIcon('alert-triangle') + ' Cần xác minh/đo trực tiếp tại hiện trường</strong><ul>' + result.verify.map(item => '<li>' + E(item) + '</li>').join('') + '</ul></div>' : '';
  const unusable = result.unusable.length ? '<p class="sr-ai-warn">' + result.unusable.map(item => 'Ảnh ' + item.photo + (item.reason ? ' (' + E(item.reason) + ')' : '')).join(', ') + ' chưa dùng được — chụp lại nếu cần.</p>' : '';
  const picked = sceneReportAiPickedCount();
  return '<div class="sr-ai-result"><div class="sr-ai-result-head"><strong>' + sceneReportIcon('sparkles') + ' Đề xuất của AI</strong><span>Sửa trực tiếp trong ô nếu cần, rồi chọn mục muốn ghi vào biên bản. Các mục [1][2][6][7][8][15][16] ảnh không chứng minh được nên để bạn tự nhập</span></div>'
    + cards + sceneReportAiExtraHtml() + unusable + verify + evidence
    + '<div class="sr-ai-foot"><button type="button" class="sr-btn sr-btn--primary sr-btn--compact" data-sr-ai-apply' + (picked ? '' : ' disabled') + '><span class="sr-btn-icon">' + sceneReportIcon('check') + '</span><span>Áp dụng ' + picked + ' mục đã chọn</span></button><button type="button" class="sr-btn sr-btn--compact" data-sr-ai-dismiss><span>Bỏ đề xuất</span></button></div></div>';
}

function sceneReportAiHtml() {
  sceneReportAiSync();
  const E = sceneReportEsc, st = sceneReportAi, SA = SceneReportAI, full = st.photos.length >= SA.MAX_PHOTOS, locked = st.busy || st.preparing;
  const thumbs = st.photos.map((photo, index) => '<div class="sr-ai-photo is-' + SA.kindOf(photo.kind) + '" title="' + E(photo.name) + '">'
    + (photo.preview ? '<img alt="" src="' + E(photo.preview) + '">' : '<span class="sr-ai-noprev">' + sceneReportIcon('camera') + '</span>')
    + '<span class="sr-ai-num">' + (index + 1) + '</span>'
    + '<button type="button" class="sr-ai-del" data-sr-ai-del="' + index + '" aria-label="Bỏ ảnh ' + (index + 1) + '"' + (locked ? ' disabled' : '') + '>×</button>'
    + '<button type="button" class="sr-ai-kind" data-sr-ai-kind="' + index + '" title="Bấm để đổi loại ảnh" aria-label="Loại ảnh ' + (index + 1) + ': ' + E(SA.KINDS[SA.kindOf(photo.kind)]) + '. Bấm để đổi"' + (locked ? ' disabled' : '') + '>' + E(SA.KINDS[SA.kindOf(photo.kind)]) + '</button></div>').join('');
  const add = '<label class="sr-ai-add' + (full || locked ? ' is-disabled' : '') + '">' + sceneReportIcon('plus') + '<span>' + (st.photos.length ? 'Thêm ảnh' : 'Chọn ảnh hiện trường') + '</span>'
    + '<small>' + (st.photos.length ? st.photos.length + '/' + SA.MAX_PHOTOS : 'hoặc kéo thả vào đây · tối đa ' + SA.MAX_PHOTOS) + '</small>'
    + '<input type="file" data-sr-ai-file accept="image/*" multiple hidden' + (full || locked ? ' disabled' : '') + '></label>';
  const modelUi = sceneReportAiModelHtml(locked);
  const action = st.busy
    ? '<button type="button" class="sr-btn sr-btn--compact" data-sr-ai-stop><span>Dừng</span></button><span class="sr-ai-busy"><i aria-hidden="true"></i>AI đang đọc ' + st.photos.length + ' ảnh…</span>'
    : '<button type="button" class="sr-btn sr-btn--primary sr-btn--compact" data-sr-ai-run' + (!st.photos.length || st.preparing ? ' disabled' : '') + '><span class="sr-btn-icon">' + sceneReportIcon('sparkles') + '</span><span>' + (st.result ? 'Phân tích lại' : 'Phân tích ảnh') + '</span></button>'
      + (st.preparing ? '<span class="sr-ai-busy"><i aria-hidden="true"></i>Đang xử lý ảnh…</span>' : '');
  return '<div class="sr-ai-head"><span class="sr-ai-orb">' + sceneReportIcon('sparkles') + '</span><div><strong>AI phân tích ảnh hiện trường</strong>'
    + '<p>Gửi ảnh để AI nháp mục <b>[9] mô tả hiện trường</b>, <b>[10] dấu vết</b> và <b>[11] mẫu vật</b>. Bấm nhãn trên ảnh để chọn loại: Hiện trường, Dấu vết hoặc Mẫu vật.</p></div></div>'
    + '<div class="sr-ai-photos">' + thumbs + add + '</div>'
    + '<textarea class="sr-input sr-area sr-ai-note" data-sr-ai-note rows="2" maxlength="' + SA.MAX_NOTE + '" placeholder="Ghi chú cho AI (tuỳ chọn): VD xe còn lại BKS 48H02661; ảnh 3 là mảnh cản nhặt gần xe…"' + (locked ? ' disabled' : '') + '>' + E(st.note) + '</textarea>'
    + (modelUi ? '<div class="sr-ai-modelrow">' + modelUi + '</div>' : '')
    + '<div class="sr-ai-actions">' + action + '</div>'
    + (st.error ? '<p class="sr-ai-error" role="alert">' + E(st.error) + '</p>' : '')
    + (st.applied ? '<p class="sr-ai-ok">' + sceneReportIcon('check') + '<span>' + E(st.applied) + '</span><button type="button" class="sr-btn sr-btn--primary sr-btn--compact" data-sr-step-go="3"><span>Soát lại ở bước 3</span><span class="sr-btn-icon">' + sceneReportIcon('arrow-right') + '</span></button></p>' : '')
    + (st.result ? sceneReportAiResultHtml() : '')
    + '<p class="sr-ai-legal">AI chỉ đọc từ ảnh. Số đo, hướng, vị trí và mẫu vật phải được giám định viên kiểm tra và xác nhận tại hiện trường trước khi ký biên bản.</p>';
}

function sceneReportAiRepaint() {
  const box = document.querySelector('#sceneReportRoot [data-sr-ai]');
  if (!box) return;
  const scroller = box.closest('.sr-card-body, #sceneReportRoot');
  const top = scroller ? scroller.scrollTop : 0;
  box.innerHTML = sceneReportAiHtml();
  box.classList.toggle('is-busy', sceneReportAi.busy);
  if (scroller) scroller.scrollTop = top;
}

async function sceneReportAiAddFiles(list) {
  const st = sceneReportAi, SA = SceneReportAI;
  const files = [...list].filter(file => /^image\//i.test(file.type || '') || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || ''));
  if (!files.length || st.busy || st.preparing) return;
  st.preparing = true; st.error = ''; sceneReportAiRepaint();
  const errors = [], claim = st.claim;
  for (const file of files) {
    if (st.photos.length >= SA.MAX_PHOTOS) { errors.push('Chỉ gửi tối đa ' + SA.MAX_PHOTOS + ' ảnh mỗi lần.'); break; }
    try {
      const photo = await SA.prepare(file);
      if (st.claim !== claim) return;
      if (st.photos.reduce((sum, item) => sum + item.data.length, 0) + photo.data.length > SA.MAX_TOTAL_B64) { errors.push('Tổng dung lượng ảnh đã quá lớn để gửi một lần. Hãy bỏ bớt ảnh hoặc phân tích thành nhiều lượt.'); break; }
      st.photos.push({...photo, kind: 'scene'});
    } catch (error) { errors.push(error.message || 'Không xử lý được ảnh.'); }
  }
  st.preparing = false;
  if (errors.length) st.error = errors[0];
  st.result = null; st.applied = '';
  sceneReportAiRepaint();
}

function sceneReportAiContext() {
  const data = sceneReportState();
  return {plate: data.plate, location: data.accidentLocation, when: [data.accidentTime, data.accidentDate].filter(Boolean).join(' '), withParty: data.withParty, note: sceneReportAi.note,
    existing: {scene: data.scene, traces: data.traces, samples: data.samples, terrain: data.terrain, damageEval: data.damageEval, parts: data.parts}};
}

async function sceneReportAiRun() {
  const st = sceneReportAi;
  if (st.busy || st.preparing || !st.photos.length) return;
  const chosen = sceneReportAiModelState();
  let apiKey = '', active = null, model = 'gemini-2.5-flash', thinking = false;
  if (chosen) {
    active = chosen.M.resolve(chosen.cfg, chosen.id);
    apiKey = await chosen.M.getKey(active.provider);
    if (!apiKey) { st.error = chosen.M.noKeyMessage(active.provider, chosen.cfg); sceneReportAiRepaint(); return; }
    thinking = sceneReportAiDeepOn(chosen);
  } else {
    if (typeof GeminiKeyStore === 'undefined') { st.error = 'Chưa tải được bộ AI. Hãy tải lại trang.'; sceneReportAiRepaint(); return; }
    apiKey = await GeminiKeyStore.get().catch(() => '');
    if (!apiKey) { st.error = 'Chưa thiết lập khoá Gemini API. Mở Trợ lý AI → Thiết lập để nhập khoá rồi thử lại.'; sceneReportAiRepaint(); return; }
    try { model = localStorage.getItem('gemini_model_name') || model; } catch (_) { /* bỏ qua */ }
  }
  const limit = (chosen && chosen.M.timeoutMs(active.provider, thinking)) || (thinking ? 170000 : 150000);
  const claim = st.claim, controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, limit);
  Object.assign(st, {busy: true, stopped: false, controller, error: '', applied: '', result: null});
  sceneReportAiRepaint();
  try {
    const result = active
      ? await SceneReportAI.analyzeVia({photos: st.photos, context: sceneReportAiContext(), active, apiKey, signal: controller.signal, thinking})
      : await SceneReportAI.analyze({photos: st.photos, context: sceneReportAiContext(), apiKey, model, signal: controller.signal});
    if (st.claim !== claim) return;
    st.result = result; st.pick = {}; st.mode = {}; st.draft = {};
    SCENE_REPORT_AI_FIELDS.forEach(([key]) => { st.draft[key] = result[key]; st.pick[key] = !!result[key]; });
    // Các mục khác: bản nháp sửa được; chỉ tick sẵn khi biên bản chưa có nội dung ở mục đó.
    const dataNow = sceneReportState();
    st.extra = JSON.parse(JSON.stringify(result.extra || {}));
    st.pickX = {};
    SCENE_REPORT_AI_EXTRA.forEach(row => { st.pickX[row.key] = sceneReportAiExtraHas(row.key, st.extra) && !sceneReportAiExtraCurrent(row.key, dataNow); });
  } catch (error) {
    if (st.claim !== claim) return;
    if (error?.name === 'AbortError') {
      st.error = st.stopped && !timedOut ? '' : (active ? active.providerLabel : 'Gemini') + ' chưa trả kết quả sau ' + Math.round(limit / 1000) + ' giây. '
        + (active && active.provider === 'antigravity' ? 'Hãy kiểm tra công cụ Antigravity trên máy, tắt Suy luận sâu hoặc gửi ít ảnh hơn rồi thử lại.' : 'Hãy gửi ít ảnh hơn hoặc thử lại.');
    } else st.error = error?.message || 'Không phân tích được ảnh.';
  } finally {
    clearTimeout(timer);
    if (st.claim === claim) { st.busy = false; st.controller = null; sceneReportAiRepaint(); }
  }
}

function sceneReportAiApply() {
  const st = sceneReportAi, data = sceneReportState(), root = document.getElementById('sceneReportRoot');
  const done = [], cut = [];
  for (const [key, tag] of SCENE_REPORT_AI_FIELDS) {
    const text = String(st.draft[key] || '').trim();
    if (!st.pick[key] || !text) continue;
    const merged = SceneReportAI.mergeText(data[key], text, st.mode[key] || 'append', SCENE_REPORT_TEXT_FIELDS[key]);
    data[key] = merged.text;
    const area = root?.querySelector('[data-sr="' + key + '"]');
    if (area) area.value = merged.text;
    done.push(tag); if (merged.truncated) cut.push(tag);
  }
  // Các mục khác: ghi thẳng vào dữ liệu (đã được AI/giám định viên chỉnh), rồi vẽ lại biểu mẫu để ô, nút chọn, đếm mục cùng cập nhật.
  const extra = st.extra || {};
  let extraDone = 0;
  const mark = tag => { if (!done.includes(tag)) done.push(tag); extraDone++; };
  for (const row of SCENE_REPORT_AI_EXTRA) {
    if (!st.pickX[row.key] || !sceneReportAiExtraHas(row.key, extra)) continue;
    if (row.kind === 'line' || row.kind === 'area') {
      const text = String(extra[row.key]).trim().slice(0, SCENE_REPORT_TEXT_FIELDS[row.key] || SceneReportAI.LIMITS[row.key]);
      if (!text) continue;
      data[row.key] = text; mark(row.tag);
    } else if (row.kind === 'choice') {
      const value = String(extra[row.key] || '');
      if (!SceneReportAI.ENUMS[row.key].includes(value)) continue;
      data[row.key] = value; mark(row.tag);
    } else if (row.kind === 'damage') {
      let any = false;
      for (const spot of SceneReportAI.SPOTS) {
        const text = String(extra.damage?.[spot] || '').trim().slice(0, SceneReportAI.LIMITS.damageText);
        if (!text) continue;
        data.damage[spot] = {on: true, text}; any = true;
      }
      if (any) mark(row.tag);
    } else if (row.kind === 'prop') {
      if (extra.property?.insured) data.property.insured = true;
      if (extra.property?.thirdParty) data.property.thirdParty = true;
      mark(row.tag);
    }
  }
  if (!done.length) return;
  st.result = null; st.extra = null; st.pickX = {}; st.error = '';
  st.applied = 'Đã ghi vào ' + done.join(', ') + '. Hãy đọc lại, điền số đo còn "…" rồi kiểm tra tại hiện trường.' + (cut.length ? ' Một phần nội dung ' + cut.join(', ') + ' bị cắt vì quá dài.' : '');
  if (extraDone) sceneReportRefresh(); else sceneReportAiRepaint();
  sceneReportCommit();
  if (typeof triggerToast === 'function') triggerToast('Đã áp dụng đề xuất AI vào ' + done.join(', ') + '.', 'success');
}

// Cập nhật nút "Áp dụng N mục" mà không vẽ lại (giữ con trỏ khi đang gõ).
function sceneReportAiSyncApply(from) {
  const apply = from.closest('[data-sr-ai]')?.querySelector('[data-sr-ai-apply]');
  if (!apply) return;
  const n = sceneReportAiPickedCount();
  apply.disabled = !n;
  const label = apply.querySelector('span:last-child');
  if (label) label.textContent = 'Áp dụng ' + n + ' mục đã chọn';
  const row = from.closest('.sr-ai-xrow');
  if (row) row.classList.toggle('is-on', !!sceneReportAi.pickX[row.querySelector('[data-sr-ai-x-pick]')?.dataset.srAiXPick]);
}

document.addEventListener('change', event => {
  const target = event.target;
  if (!target.closest?.('#sceneReportRoot [data-sr-ai]')) return;
  if (target.matches('[data-sr-ai-file]')) { const files = [...target.files]; target.value = ''; sceneReportAiAddFiles(files); return; }
  if (target.matches('[data-sr-ai-deep]')) { sceneReportAi.deep = target.checked; sceneReportAiLs.set(SCENE_REPORT_AI_DEEP_KEY, target.checked ? '1' : '0'); return; }
  if (target.matches('[data-sr-ai-x-pick]')) { sceneReportAi.pickX[target.dataset.srAiXPick] = target.checked; sceneReportAiSyncApply(target); return; }
  if (target.matches('[data-sr-ai-x-prop]') && sceneReportAi.extra) { sceneReportAi.extra.property[target.dataset.srAiXProp] = target.checked; sceneReportAiSyncApply(target); return; }
  if (target.matches('select[data-sr-ai-x]') && sceneReportAi.extra) { sceneReportAi.extra[target.dataset.srAiX] = target.value; return; }
  if (target.matches('[data-sr-ai-pick]')) { sceneReportAi.pick[target.dataset.srAiPick] = target.checked; sceneReportAiRepaint(); return; }
  if (target.matches('[data-sr-ai-mode]')) sceneReportAi.mode[target.dataset.srAiMode] = target.value === 'replace' ? 'replace' : 'append';
});
document.addEventListener('input', event => {
  const target = event.target;
  if (!target.closest?.('#sceneReportRoot [data-sr-ai]')) return;
  if (target.matches('[data-sr-ai-note]')) sceneReportAi.note = String(target.value).slice(0, SceneReportAI.MAX_NOTE);
  else if (target.matches('[data-sr-ai-x-damage]') && sceneReportAi.extra) { sceneReportAi.extra.damage[target.dataset.srAiXDamage] = String(target.value); sceneReportAiSyncApply(target); }
  else if (target.matches('input[data-sr-ai-x], textarea[data-sr-ai-x]') && sceneReportAi.extra) { sceneReportAi.extra[target.dataset.srAiX] = String(target.value); sceneReportAiSyncApply(target); }
  else if (target.matches('[data-sr-ai-text]')) {
    sceneReportAi.draft[target.dataset.srAiText] = String(target.value);
    const empty = !String(target.value).trim();
    sceneReportAi.pick[target.dataset.srAiText] = !empty && sceneReportAi.pick[target.dataset.srAiText] !== false;
    const apply = target.closest('[data-sr-ai]')?.querySelector('[data-sr-ai-apply]');
    if (apply) { const n = sceneReportAiPickedCount(); apply.disabled = !n; const label = apply.querySelector('span'); if (label) label.textContent = 'Áp dụng ' + n + ' mục đã chọn'; }
  }
});
document.addEventListener('click', event => {
  const target = event.target;
  if (!target.closest?.('.sr-ai-model-menu')) document.querySelectorAll('#sceneReportRoot .sr-ai-model-menu[open]').forEach(menu => { menu.open = false; });
  if (!target.closest?.('#sceneReportRoot [data-sr-ai]')) return;
  const st = sceneReportAi;
  if (target.closest('.sr-ai-model-menu summary[aria-disabled="true"]')) { event.preventDefault(); return; }
  const modelOption = target.closest('[data-sr-ai-model-option]');
  if (modelOption && !st.busy && !st.preparing) { st.model = modelOption.dataset.srAiModelOption; sceneReportAiLs.set(SCENE_REPORT_AI_MODEL_KEY, st.model); st.error = ''; sceneReportAiRepaint(); return; }
  const kind = target.closest('[data-sr-ai-kind]'), del = target.closest('[data-sr-ai-del]');
  if (kind) { const photo = st.photos[Number(kind.dataset.srAiKind)]; if (photo && !st.busy) { photo.kind = SceneReportAI.nextKind(photo.kind); sceneReportAiRepaint(); } return; }
  if (del) { if (!st.busy) { st.photos.splice(Number(del.dataset.srAiDel), 1); st.result = null; st.applied = ''; sceneReportAiRepaint(); } return; }
  if (target.closest('[data-sr-ai-run]')) { sceneReportAiRun(); return; }
  if (target.closest('[data-sr-ai-stop]')) { st.stopped = true; try { st.controller?.abort(); } catch (_) { /* bỏ qua */ } return; }
  if (target.closest('[data-sr-ai-apply]')) { sceneReportAiApply(); return; }
  if (target.closest('[data-sr-ai-dismiss]')) { st.result = null; sceneReportAiRepaint(); }
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const menu = event.target.closest?.('#sceneReportRoot .sr-ai-model-menu[open]');
  if (menu) { menu.open = false; menu.querySelector('summary')?.focus(); event.stopPropagation(); }
});
// Kéo thả ảnh vào khối AI.
document.addEventListener('dragover', event => { const box = event.target.closest?.('#sceneReportRoot [data-sr-ai]'); if (box && event.dataTransfer?.types?.includes('Files')) { event.preventDefault(); box.classList.add('is-drop'); } });
document.addEventListener('dragleave', event => { const box = event.target.closest?.('#sceneReportRoot [data-sr-ai]'); if (box && !box.contains(event.relatedTarget)) box.classList.remove('is-drop'); });
document.addEventListener('drop', event => {
  const box = event.target.closest?.('#sceneReportRoot [data-sr-ai]');
  if (!box) return;
  event.preventDefault(); box.classList.remove('is-drop');
  if (event.dataTransfer?.files?.length) sceneReportAiAddFiles(event.dataTransfer.files);
});
