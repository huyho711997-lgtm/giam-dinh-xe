// Giao diện khối "AI phân tích ảnh hiện trường" trong tab Biên bản hiện trường (đặt đầu phần II).
// Ảnh chỉ giữ trong bộ nhớ trang (không lưu vào hồ sơ); kết quả AI là bản nháp, chỉ ghi vào mục [9][10][11] khi bấm "Áp dụng".
// Phụ thuộc (gọi lúc chạy): SceneReportAI, sceneReportState/sceneReportCommit/sceneReportEsc/sceneReportIcon (scene-report-ui.js), GeminiKeyStore.
const sceneReportAi = {claim: '', photos: [], note: '', busy: false, preparing: false, controller: null, stopped: false, result: null, error: '', applied: '', pick: {}, mode: {}, draft: {}, deep: null, model: ''};
const SCENE_REPORT_AI_FIELDS = [['scene', '[9]', 'Mô tả hiện trường, vị trí phương tiện'], ['traces', '[10]', 'Dấu vết tại hiện trường'], ['samples', '[11]', 'Mẫu vật thu được']];

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
  const select = '<label class="sr-ai-model"><span>Mô hình</span><select data-sr-ai-model aria-label="Mô hình AI đọc ảnh"' + (locked ? ' disabled' : '') + '>'
    + model.options.map(option => '<option value="' + E(option.id) + '"' + (option.id === model.id ? ' selected' : '') + '>' + E(text(option)) + '</option>').join('') + '</select></label>';
  const deep = model.current.reasoning
    ? '<label class="sr-ai-deep" title="AI suy nghĩ kỹ hơn trước khi viết; chậm hơn và tốn hạn mức hơn"><input type="checkbox" data-sr-ai-deep' + (sceneReportAiDeepOn(model) ? ' checked' : '') + (locked ? ' disabled' : '') + '><span class="sr-check-box" aria-hidden="true"></span><span>Suy luận sâu</span></label>' : '';
  const note = model.current.local ? '<p class="sr-ai-local">Antigravity chạy qua công cụ trung gian trên chính máy này (127.0.0.1) — cần bật công cụ đó và đăng nhập website. Suy luận sâu có thể mất 1–3 phút.</p>' : '';
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
  const picked = SCENE_REPORT_AI_FIELDS.filter(([key]) => st.pick[key] && String(st.draft[key] || '').trim()).length;
  return '<div class="sr-ai-result"><div class="sr-ai-result-head"><strong>' + sceneReportIcon('sparkles') + ' Đề xuất của AI</strong><span>Sửa trực tiếp trong ô nếu cần, rồi chọn mục muốn ghi vào biên bản</span></div>'
    + cards + unusable + verify + evidence
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
    + (st.applied ? '<p class="sr-ai-ok">' + sceneReportIcon('check') + E(st.applied) + '</p>' : '')
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
    existing: {scene: data.scene, traces: data.traces, samples: data.samples}};
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
  if (!done.length) return;
  sceneReportCommit();
  st.result = null; st.error = '';
  st.applied = 'Đã ghi vào ' + done.join(', ') + '. Hãy đọc lại, điền số đo còn "…" rồi kiểm tra tại hiện trường.' + (cut.length ? ' Một phần nội dung ' + cut.join(', ') + ' bị cắt vì quá dài.' : '');
  sceneReportAiRepaint();
  if (typeof triggerToast === 'function') triggerToast('Đã áp dụng đề xuất AI vào ' + done.join(', ') + '.', 'success');
}

document.addEventListener('change', event => {
  const target = event.target;
  if (!target.closest?.('#sceneReportRoot [data-sr-ai]')) return;
  if (target.matches('[data-sr-ai-file]')) { const files = [...target.files]; target.value = ''; sceneReportAiAddFiles(files); return; }
  if (target.matches('[data-sr-ai-model]')) { sceneReportAi.model = target.value; sceneReportAiLs.set(SCENE_REPORT_AI_MODEL_KEY, target.value); sceneReportAi.error = ''; sceneReportAiRepaint(); return; }
  if (target.matches('[data-sr-ai-deep]')) { sceneReportAi.deep = target.checked; sceneReportAiLs.set(SCENE_REPORT_AI_DEEP_KEY, target.checked ? '1' : '0'); return; }
  if (target.matches('[data-sr-ai-pick]')) { sceneReportAi.pick[target.dataset.srAiPick] = target.checked; sceneReportAiRepaint(); return; }
  if (target.matches('[data-sr-ai-mode]')) sceneReportAi.mode[target.dataset.srAiMode] = target.value === 'replace' ? 'replace' : 'append';
});
document.addEventListener('input', event => {
  const target = event.target;
  if (!target.closest?.('#sceneReportRoot [data-sr-ai]')) return;
  if (target.matches('[data-sr-ai-note]')) sceneReportAi.note = String(target.value).slice(0, SceneReportAI.MAX_NOTE);
  else if (target.matches('[data-sr-ai-text]')) {
    sceneReportAi.draft[target.dataset.srAiText] = String(target.value);
    const empty = !String(target.value).trim();
    sceneReportAi.pick[target.dataset.srAiText] = !empty && sceneReportAi.pick[target.dataset.srAiText] !== false;
    const apply = target.closest('[data-sr-ai]')?.querySelector('[data-sr-ai-apply]');
    if (apply) { const n = SCENE_REPORT_AI_FIELDS.filter(([key]) => sceneReportAi.pick[key] && String(sceneReportAi.draft[key] || '').trim()).length; apply.disabled = !n; const label = apply.querySelector('span'); if (label) label.textContent = 'Áp dụng ' + n + ' mục đã chọn'; }
  }
});
document.addEventListener('click', event => {
  const target = event.target;
  if (!target.closest?.('#sceneReportRoot [data-sr-ai]')) return;
  const st = sceneReportAi;
  const kind = target.closest('[data-sr-ai-kind]'), del = target.closest('[data-sr-ai-del]');
  if (kind) { const photo = st.photos[Number(kind.dataset.srAiKind)]; if (photo && !st.busy) { photo.kind = SceneReportAI.nextKind(photo.kind); sceneReportAiRepaint(); } return; }
  if (del) { if (!st.busy) { st.photos.splice(Number(del.dataset.srAiDel), 1); st.result = null; st.applied = ''; sceneReportAiRepaint(); } return; }
  if (target.closest('[data-sr-ai-run]')) { sceneReportAiRun(); return; }
  if (target.closest('[data-sr-ai-stop]')) { st.stopped = true; try { st.controller?.abort(); } catch (_) { /* bỏ qua */ } return; }
  if (target.closest('[data-sr-ai-apply]')) { sceneReportAiApply(); return; }
  if (target.closest('[data-sr-ai-dismiss]')) { st.result = null; sceneReportAiRepaint(); }
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
