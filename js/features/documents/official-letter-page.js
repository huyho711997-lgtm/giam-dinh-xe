// Trang "Công văn AI": chọn mẫu → đưa thông tin (hồ sơ / ảnh-PDF / ý chính) → AI phân tích, hỏi lại chỗ thiếu →
// AI soạn công văn → sửa trực tiếp trên bản xem trước → tải Word / in / sao chép.
// Phụ thuộc: OfficialLetterCore, SharedFormsAI (callGemini, listRecords, saveBlob), GeminiKeyStore, JSZip.
const OfficialLetterPage = (() => {
  const ISSUER_KEY = 'officialLetter.issuer.v1';
  const MAX_FILES = 4, MAX_EDGE = 1600, MAX_PDF = 6 * 1024 * 1024;
  const Core = () => OfficialLetterCore;
  const esc = value => Core().escapeHtml(value);
  let host = null, controller = null, generation = 0, records = [];
  const st = {templateId: '', recordKey: '', brief: '', files: [], values: null, filledByAI: [], questions: [], notes: '', answers: '', letter: null, busy: '', error: ''};

  // ---- Đơn vị ban hành (nhớ trên máy) ----
  const loadIssuer = () => { try { return Core().normalizeIssuer(JSON.parse(localStorage.getItem(ISSUER_KEY) || '{}')); } catch (_) { return Core().normalizeIssuer({}); } };
  const saveIssuer = issuer => { try { localStorage.setItem(ISSUER_KEY, JSON.stringify(issuer)); } catch (_) { /* bỏ qua */ } };

  const toast = (message, type) => { if (typeof triggerToast === 'function') triggerToast(message, type || 'info'); };
  const template = () => Core().findTemplate(st.templateId);
  const $ = selector => host && host.querySelector(selector);

  // ---- Tệp đính kèm: thu nhỏ ảnh, đọc PDF thành base64 ----
  const toBase64 = buffer => { let out = ''; const bytes = new Uint8Array(buffer); for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(out); };
  async function prepareFile(file) {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      if (file.size > MAX_PDF) throw new Error('"' + file.name + '" quá lớn (tối đa 6 MB cho PDF).');
      return {name: file.name, mimeType: 'application/pdf', data: toBase64(await file.arrayBuffer())};
    }
    if (!/^image\//.test(file.type)) throw new Error('"' + file.name + '" không phải ảnh hoặc PDF.');
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Không đọc được ảnh "' + file.name + '".')); img.src = url; });
      const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      return {name: file.name, mimeType: 'image/jpeg', data: canvas.toDataURL('image/jpeg', 0.85).split(',')[1]};
    } finally { URL.revokeObjectURL(url); }
  }

  // ---- Gọi Gemini ----
  async function callAI(request) {
    if (typeof GeminiKeyStore === 'undefined' || typeof SharedFormsAI === 'undefined') throw new Error('Chưa tải được mô-đun AI. Hãy tải lại trang.');
    const apiKey = await GeminiKeyStore.get();
    if (!apiKey) throw new Error('Chưa có khoá Gemini API. Vào Quản trị hệ thống → Gemini API để thêm khoá.');
    let model = 'gemini-2.5-flash';
    try { model = localStorage.getItem('gemini_form_model') || model; } catch (_) { /* bỏ qua */ }
    controller?.abort();
    controller = new AbortController();
    return SharedFormsAI.callGemini(request, apiKey, model, controller.signal);
  }

  // ---- Thao tác ----
  const currentRecord = () => (records.find(row => row.key === st.recordKey) || {}).record || null;

  function startValues() {
    const tpl = template();
    const base = Core().prefillValues(tpl, currentRecord(), loadIssuer());
    const merged = {...base};
    if (st.values) for (const [key, value] of Object.entries(st.values)) if (Core().single(value, 1)) merged[key] = value; // giữ phần người dùng đã nhập
    return merged;
  }

  async function analyze() {
    const tpl = template();
    if (!tpl || st.busy) return;
    const my = generation;
    st.error = ''; st.busy = 'analyze'; renderAll();
    try {
      const current = startValues();
      const files = [];
      for (const file of st.files) files.push(await prepareFile(file));
      const brief = [st.brief, st.answers && 'Trả lời bổ sung của người dùng: ' + st.answers].filter(Boolean).join('\n');
      const raw = await callAI(Core().buildAnalyzeRequest(tpl, {record: currentRecord() ? SharedFormsAI.describeRecord(currentRecord()) : {}, current, brief, files}));
      if (my !== generation) return;
      const analysis = Core().parseAnalysis(raw, tpl);
      const merged = Core().mergeAnalysis(tpl, current, analysis);
      st.values = merged.values; st.filledByAI = Array.from(new Set(st.filledByAI.concat(merged.filledByAI)));
      st.questions = analysis.questions; st.notes = analysis.notes; st.answers = '';
    } catch (error) {
      if (my !== generation || error.name === 'AbortError') return;
      st.error = error.message || 'Không phân tích được.';
      if (!st.values) st.values = startValues(); // vẫn cho nhập tay
    } finally { if (my === generation) { st.busy = ''; renderAll(); } }
  }

  function manual() {
    if (!template()) return;
    st.values = startValues(); st.questions = []; st.notes = ''; st.error = '';
    renderAll();
  }

  async function compose() {
    const tpl = template();
    if (!tpl || st.busy || !st.values) return;
    collectValues();
    const my = generation;
    st.error = ''; st.busy = 'compose'; renderAll();
    try {
      const issuer = loadIssuer();
      const raw = await callAI(Core().buildComposeRequest(tpl, st.values, issuer, st.brief));
      if (my !== generation) return;
      const parsed = Core().parseLetter(raw);
      st.letter = Core().assembleLetter(tpl, st.values, issuer, parsed, st.letter && st.letter.date);
    } catch (error) {
      if (my !== generation || error.name === 'AbortError') return;
      st.error = error.message || 'Không soạn được công văn.';
    } finally { if (my === generation) { st.busy = ''; renderAll(); } }
  }

  function collectValues() {
    if (!host || !st.values) return;
    host.querySelectorAll('[data-ol-field]').forEach(input => { st.values[input.dataset.olField] = input.value; });
  }

  // Đọc lại bản thảo người dùng đã sửa trực tiếp trên khung xem trước.
  function readLetter() {
    const paper = $('.ol-paper');
    if (!paper || !st.letter) return st.letter;
    const all = prefix => [...paper.querySelectorAll('[data-lt^="' + prefix + ':"]')].map(node => node.innerText);
    const one = path => { const node = paper.querySelector('[data-lt="' + path + '"]'); return node ? node.innerText : ''; };
    const paragraphs = [...paper.querySelectorAll('[data-lt^="para:"]')].map(node => ({type: node.dataset.type || 'p', text: node.innerText}));
    return Core().sanitizeLetter({...st.letter, parent: one('parent'), unit: one('unit'), number: one('number'), place: one('place'), subject: one('subject'),
      recipients: all('recipient'), paragraphs, noiNhan: all('noiNhan'), signerTitle: one('signerTitle'), signerName: one('signerName')});
  }

  async function downloadDocx() {
    if (!st.letter) return;
    if (typeof JSZip === 'undefined') { toast('Chưa tải được thư viện tạo Word. Kiểm tra mạng rồi thử lại.', 'warning'); return; }
    try {
      st.letter = readLetter();
      const zip = new JSZip();
      Core().docxFiles(st.letter, st.letter.subject).forEach(file => zip.file(file.path, file.text));
      const blob = await zip.generateAsync({type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
      SharedFormsAI.saveBlob(blob, Core().fileBaseName(st.letter, st.values) + '.docx');
      const gaps = Core().countGaps(st.letter);
      toast(gaps ? 'Đã tải Word. Còn ' + gaps + ' chỗ "……" cần điền tay.' : 'Đã tải file Word.', gaps ? 'warning' : 'success');
    } catch (error) { toast('Không tạo được file Word: ' + (error.message || error), 'error'); }
  }

  function printLetter() {
    if (!st.letter) return;
    st.letter = readLetter();
    const win = window.open('', '_blank');
    if (!win) { toast('Trình duyệt chặn cửa sổ in. Hãy cho phép cửa sổ bật lên rồi thử lại.', 'warning'); return; }
    const markup = Core().letterToHtml(st.letter).replace(/ contenteditable="true"/g, '').replace(/ spellcheck="true"/g, '');
    win.document.open();
    win.document.write('<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Công văn</title><style>@page{size:A4;margin:20mm 15mm 20mm 30mm}body{margin:0;font:13pt/1.3 "Times New Roman",serif;color:#000}.ol-head{display:flex}.ol-head-left{width:42%;text-align:center}.ol-head-right{width:58%;text-align:center}.ol-rule{width:40%;border:0;border-top:1px solid #000;margin:2px auto}.ol-subject{margin:8px 0;font-size:12pt}.ol-to{text-align:center;margin:12px 0}.ol-p{text-align:justify;text-indent:1.27cm;margin:0 0 6pt}.ol-p-li{text-indent:0;padding-left:1.5cm}.ol-foot{display:flex;margin-top:12px}.ol-noinhan{width:55%;font-size:11pt}.ol-sign{width:45%;text-align:center}.ol-sign-space{height:70px}mark{background:none}</style></head><body>' + markup + '</body></html>');
    win.document.close();
    win.focus();
    setTimeout(() => { try { win.print(); } catch (_) { /* người dùng tự in */ } }, 300);
  }

  async function copyText() {
    if (!st.letter) return;
    st.letter = readLetter();
    try { await navigator.clipboard.writeText(Core().letterToText(st.letter)); toast('Đã sao chép nội dung công văn.', 'success'); }
    catch (_) { toast('Không sao chép được. Hãy bôi đen nội dung rồi nhấn Ctrl+C.', 'warning'); }
  }

  // ---- Hiển thị ----
  function renderTemplates() {
    const groups = [];
    Core().templates().forEach(tpl => { let group = groups.find(item => item.name === tpl.group); if (!group) groups.push(group = {name: tpl.group, items: []}); group.items.push(tpl); });
    $('#olTemplates').innerHTML = '<h2><span class="ol-step">1</span>Chọn mẫu công văn</h2>' + groups.map(group => '<div class="ol-group"><h3>' + esc(group.name) + '</h3><div class="ol-tpl-grid">'
      + group.items.map(tpl => '<button type="button" class="ol-tpl' + (tpl.id === st.templateId ? ' is-active' : '') + '" data-ol-template="' + esc(tpl.id) + '" aria-pressed="' + (tpl.id === st.templateId) + '"><strong>' + esc(tpl.name) + '</strong><span>' + esc(tpl.summary) + '</span>' + (tpl.starter ? '<em>Mẫu khởi đầu</em>' : '') + '</button>').join('') + '</div></div>').join('');
  }

  function recordOptions() {
    return ['Hồ sơ giám định', 'Hồ sơ tồn'].map(group => {
      const items = records.filter(row => row.group === group);
      return items.length ? '<optgroup label="' + group + '">' + items.map(row => '<option value="' + esc(row.key) + '"' + (row.key === st.recordKey ? ' selected' : '') + '>' + esc(row.label) + '</option>').join('') + '</optgroup>' : '';
    }).join('');
  }

  function renderInput() {
    const box = $('#olInput'), tpl = template();
    if (!tpl) { box.hidden = true; return; }
    box.hidden = false;
    const busy = st.busy === 'analyze';
    box.innerHTML = '<h2><span class="ol-step">2</span>Đưa thông tin đầu vào</h2>'
      + '<p class="ol-hint">' + esc(tpl.audience ? 'Người nhận thường gặp: ' + tpl.audience + '.' : '') + ' Có thể dùng một, hai hoặc cả ba nguồn dưới đây.</p>'
      + '<label class="ol-field"><span>Hồ sơ liên quan</span><select data-ol-record><option value="">— Không chọn hồ sơ —</option>' + recordOptions() + '</select></label>'
      + '<label class="ol-field"><span>Ý chính cần viết</span><textarea data-ol-brief rows="4" maxlength="3000" placeholder="VD: Gửi Công an huyện Krông Pắc xin sao lục biên bản tai nạn xe 47A-123.45 xảy ra ngày 12/11…">' + esc(st.brief) + '</textarea></label>'
      + '<div class="ol-field"><span>Ảnh / PDF đính kèm <em>(tối đa ' + MAX_FILES + ' tệp: biên bản, giấy tờ, công văn nhận được…)</em></span>'
      + '<label class="ol-upload"><input type="file" data-ol-files accept="image/*,application/pdf" multiple hidden>Chọn ảnh hoặc PDF</label>'
      + (st.files.length ? '<ul class="ol-files">' + st.files.map((file, i) => '<li><span>' + esc(file.name) + '</span><button type="button" data-ol-remove-file="' + i + '" aria-label="Bỏ tệp ' + esc(file.name) + '">×</button></li>').join('') + '</ul>' : '') + '</div>'
      + '<p class="ol-privacy">Nội dung hồ sơ, ý chính và tệp đính kèm được gửi tới Google Gemini để phân tích. Không đưa vào những thông tin không cần thiết.</p>'
      + '<div class="ol-actions"><button type="button" class="ol-btn ol-btn-primary" data-ol-act="analyze"' + (st.busy ? ' disabled' : '') + '>' + (busy ? 'Đang phân tích…' : 'Phân tích bằng AI') + '</button>'
      + '<button type="button" class="ol-btn" data-ol-act="manual"' + (st.busy ? ' disabled' : '') + '>Nhập tay, không dùng AI phân tích</button></div>';
  }

  function fieldInput(field, value) {
    const common = ' data-ol-field="' + esc(field.key) + '" maxlength="' + (field.max || 500) + '"';
    return field.type === 'textarea' ? '<textarea' + common + ' rows="3">' + esc(value) + '</textarea>' : '<input' + common + ' value="' + esc(value) + '"' + (field.type === 'date' ? ' placeholder="dd/mm/yyyy"' : '') + '>';
  }

  function renderFields() {
    const box = $('#olFields'), tpl = template();
    if (!tpl || !st.values) { box.hidden = true; return; }
    box.hidden = false;
    const missing = Core().missingFields(tpl, st.values);
    const busyCompose = st.busy === 'compose';
    box.innerHTML = '<h2><span class="ol-step">3</span>Kiểm tra thông tin</h2>'
      + (st.error ? '<p class="ol-error" role="alert">' + esc(st.error) + '</p>' : '')
      + (st.notes ? '<p class="ol-note">' + esc(st.notes) + '</p>' : '')
      + (st.questions.length ? '<div class="ol-questions"><strong>AI cần hỏi thêm</strong><ul>' + st.questions.map(item => '<li>' + esc(item.question) + '</li>').join('') + '</ul>'
        + '<label class="ol-field"><span>Trả lời / bổ sung</span><textarea data-ol-answers rows="2" maxlength="1500" placeholder="Gõ câu trả lời rồi bấm Cập nhật bằng AI, hoặc điền thẳng vào các ô bên dưới">' + esc(st.answers) + '</textarea></label>'
        + '<button type="button" class="ol-btn" data-ol-act="analyze"' + (st.busy ? ' disabled' : '') + '>Cập nhật bằng AI</button></div>' : '')
      + '<div class="ol-form">' + tpl.fields.map(field => {
        const empty = !Core().single(st.values[field.key], 1);
        const flag = field.required && empty;
        return '<label class="ol-field' + (flag ? ' is-missing' : '') + '" data-ol-wrap="' + esc(field.key) + '"><span>' + esc(field.label) + (field.required ? ' <b title="Bắt buộc">*</b>' : '')
          + (st.filledByAI.includes(field.key) ? ' <em class="ol-ai-tag">AI điền</em>' : '') + (flag ? ' <em class="ol-miss-tag">Thiếu</em>' : '') + '</span>'
          + fieldInput(field, st.values[field.key]) + (field.hint ? '<small>' + esc(field.hint) + '</small>' : '') + '</label>';
      }).join('') + '</div>'
      + (missing.length ? '<p class="ol-warn" data-ol-missing>Còn thiếu ' + missing.length + ' mục bắt buộc: ' + esc(missing.map(item => item.label).join(', ')) + '. Vẫn có thể soạn, chỗ thiếu sẽ để “……”.</p>' : '<p class="ol-ok" data-ol-missing>Đã đủ thông tin bắt buộc.</p>')
      + '<div class="ol-actions"><button type="button" class="ol-btn ol-btn-primary" data-ol-act="compose"' + (st.busy ? ' disabled' : '') + '>' + (busyCompose ? 'Đang soạn công văn…' : (st.letter ? 'Soạn lại công văn' : 'Soạn công văn')) + '</button></div>';
  }

  function renderPreview() {
    const box = $('#olPreview');
    if (!st.letter) {
      box.innerHTML = '<h2><span class="ol-step">4</span>Công văn</h2><div class="ol-empty">' + (st.busy === 'compose' ? 'AI đang soạn công văn…' : 'Bản công văn sẽ hiện ở đây. Bạn có thể sửa trực tiếp trước khi tải Word.') + '</div>';
      return;
    }
    const gaps = Core().countGaps(st.letter);
    box.innerHTML = '<h2><span class="ol-step">4</span>Công văn</h2>'
      + '<div class="ol-toolbar"><label class="ol-datepick">Ngày ban hành <input type="date" data-ol-date value="' + esc(st.letter.date) + '"></label>'
      + '<button type="button" class="ol-btn ol-btn-primary" data-ol-act="docx">Tải Word (.docx)</button><button type="button" class="ol-btn" data-ol-act="print">In</button><button type="button" class="ol-btn" data-ol-act="copy">Sao chép</button></div>'
      + (st.letter.warnings.length ? '<div class="ol-warn"><strong>AI lưu ý cần kiểm tra</strong><ul>' + st.letter.warnings.map(item => '<li>' + esc(item) + '</li>').join('') + '</ul></div>' : '')
      + (gaps ? '<p class="ol-warn">Còn ' + gaps + ' chỗ “……” cần điền trước khi gửi.</p>' : '')
      + '<p class="ol-hint">Nhấp vào chữ để sửa trực tiếp. Số công văn để trống nếu chưa vào sổ.</p>'
      + '<div class="ol-paper-wrap">' + Core().letterToHtml(st.letter) + '</div>';
  }

  function renderAll() {
    if (!host) return;
    const focus = document.activeElement && document.activeElement.dataset ? {key: document.activeElement.dataset.olField, start: document.activeElement.selectionStart} : null;
    renderTemplates(); renderInput(); renderFields(); renderPreview();
    if (focus && focus.key) { const node = host.querySelector('[data-ol-field="' + focus.key + '"]'); if (node) { node.focus(); try { node.setSelectionRange(focus.start, focus.start); } catch (_) { /* bỏ qua */ } } }
  }

  function updateMissingLive() {
    const tpl = template();
    if (!tpl || !st.values) return;
    collectValues();
    const missing = Core().missingFields(tpl, st.values);
    tpl.fields.forEach(field => {
      const wrap = host.querySelector('[data-ol-wrap="' + field.key + '"]');
      if (wrap) wrap.classList.toggle('is-missing', !!field.required && !Core().single(st.values[field.key], 1));
    });
    const line = $('[data-ol-missing]');
    if (line) { line.className = missing.length ? 'ol-warn' : 'ol-ok'; line.textContent = missing.length ? 'Còn thiếu ' + missing.length + ' mục bắt buộc: ' + missing.map(item => item.label).join(', ') + '. Vẫn có thể soạn, chỗ thiếu sẽ để “……”.' : 'Đã đủ thông tin bắt buộc.'; }
  }

  // ---- Cài đặt đơn vị ban hành ----
  function openSettings() {
    const issuer = loadIssuer();
    const dialog = document.createElement('dialog');
    dialog.className = 'ol-dialog';
    const rows = [['parent', 'Tên công ty'], ['unit', 'Chi nhánh / đơn vị'], ['shortName', 'Tên gọi tắt'], ['place', 'Địa danh ghi ở ngày tháng'], ['signerTitle', 'Chức danh người ký'], ['signerName', 'Họ tên người ký (có thể để trống)'], ['contactPerson', 'Cán bộ liên hệ mặc định'], ['phone', 'Số điện thoại liên hệ'], ['address', 'Địa chỉ nhận hồ sơ']];
    dialog.innerHTML = '<form method="dialog"><h2>Thông tin đơn vị ban hành</h2><p class="ol-hint">Lưu trên máy này, dùng cho mọi công văn.</p>'
      + rows.map(([key, label]) => '<label class="ol-field"><span>' + esc(label) + '</span><input name="' + key + '" maxlength="300" value="' + esc(issuer[key]) + '"></label>').join('')
      + '<div class="ol-actions"><button type="button" class="ol-btn" data-cancel>Hủy</button><button type="submit" class="ol-btn ol-btn-primary">Lưu</button></div></form>';
    document.body.appendChild(dialog);
    const close = () => { dialog.close(); dialog.remove(); };
    dialog.querySelector('[data-cancel]').onclick = close;
    dialog.querySelector('form').onsubmit = event => {
      event.preventDefault();
      const next = {}; rows.forEach(([key]) => { next[key] = dialog.querySelector('[name="' + key + '"]').value; });
      saveIssuer(Core().normalizeIssuer(next)); close(); toast('Đã lưu thông tin đơn vị.', 'success');
    };
    dialog.addEventListener('cancel', close);
    dialog.showModal();
  }

  // ---- Sự kiện ----
  function onClick(event) {
    const tplButton = event.target.closest('[data-ol-template]');
    if (tplButton) {
      if (st.templateId !== tplButton.dataset.olTemplate) { st.templateId = tplButton.dataset.olTemplate; st.values = null; st.filledByAI = []; st.questions = []; st.notes = ''; st.letter = null; st.error = ''; }
      renderAll(); return;
    }
    const removeFile = event.target.closest('[data-ol-remove-file]');
    if (removeFile) { st.files.splice(Number(removeFile.dataset.olRemoveFile), 1); renderInput(); return; }
    const act = event.target.closest('[data-ol-act]');
    if (act) {
      const name = act.dataset.olAct;
      if (name === 'analyze') analyze(); else if (name === 'manual') manual(); else if (name === 'compose') compose();
      else if (name === 'docx') downloadDocx(); else if (name === 'print') printLetter(); else if (name === 'copy') copyText();
      return;
    }
    if (event.target.closest('[data-ol-settings]')) openSettings();
  }
  function onInput(event) {
    const target = event.target;
    if (target.matches('[data-ol-brief]')) st.brief = target.value;
    else if (target.matches('[data-ol-answers]')) st.answers = target.value;
    else if (target.matches('[data-ol-field]')) updateMissingLive();
  }
  function onChange(event) {
    const target = event.target;
    if (target.matches('[data-ol-record]')) { st.recordKey = target.value; st.values = null; st.filledByAI = []; st.questions = []; renderAll(); }
    else if (target.matches('[data-ol-files]')) {
      const picked = [...target.files];
      st.files = st.files.concat(picked).slice(0, MAX_FILES);
      if (st.files.length === MAX_FILES && picked.length) toast('Chỉ nhận tối đa ' + MAX_FILES + ' tệp.', 'info');
      target.value = ''; renderInput();
    } else if (target.matches('[data-ol-date]')) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(target.value)) { st.letter = readLetter(); st.letter.date = target.value; renderPreview(); }
    }
  }
  function onKeydown(event) { // mỗi khối là một dòng/đoạn: Enter không tách khối
    if (event.key === 'Enter' && event.target.matches && event.target.matches('.ol-edit')) event.preventDefault();
  }
  function onPaste(event) { // dán chữ thuần để không kéo theo định dạng
    if (!event.target.matches || !event.target.matches('.ol-edit')) return;
    event.preventDefault();
    const text = (event.clipboardData || window.clipboardData).getData('text').replace(/\s+/g, ' ');
    document.execCommand('insertText', false, text);
  }

  function mount(container) {
    leave();
    host = container;
    records = (typeof SharedFormsAI !== 'undefined' && SharedFormsAI.listRecords) ? SharedFormsAI.listRecords() : [];
    host.innerHTML = '<div class="ol-page"><header class="ol-top"><div><small>NGHIỆP VỤ</small><h1>Công văn AI</h1><p>Chọn mẫu, đưa thông tin đầu vào — AI phân tích, hỏi lại chỗ thiếu và soạn công văn cho bạn chỉnh sửa, tải Word.</p></div>'
      + '<button type="button" class="ol-btn" data-ol-settings>Đơn vị ban hành</button></header>'
      + '<div class="ol-layout"><div class="ol-col"><section class="ol-card" id="olTemplates"></section><section class="ol-card" id="olInput" hidden></section><section class="ol-card" id="olFields" hidden></section></div>'
      + '<div class="ol-col ol-col-preview"><section class="ol-card" id="olPreview"></section></div></div></div>';
    host.addEventListener('click', onClick); host.addEventListener('input', onInput); host.addEventListener('change', onChange);
    host.addEventListener('keydown', onKeydown); host.addEventListener('paste', onPaste);
    renderAll();
  }

  function leave() {
    generation++;
    controller?.abort(); controller = null;
    st.busy = '';
    if (host) { host.removeEventListener('click', onClick); host.removeEventListener('input', onInput); host.removeEventListener('change', onChange); host.removeEventListener('keydown', onKeydown); host.removeEventListener('paste', onPaste); }
    host = null;
  }

  return {mount, leave};
})();
