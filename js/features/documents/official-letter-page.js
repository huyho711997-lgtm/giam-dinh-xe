// Trang "Công văn AI" — giao diện hội thoại giống TASCO AI:
//   chọn mẫu → tìm & chọn hồ sơ / gõ ý chính / đính kèm ảnh-PDF → AI phân tích và hỏi lại chỗ thiếu →
//   kiểm tra các trường → AI soạn công văn → sửa trực tiếp, nhờ AI chỉnh lại → tải Word / in / sao chép.
// Phụ thuộc: OfficialLetterCore, SharedFormsAI (callGemini, listRecords, describeRecord, saveBlob), GeminiKeyStore, JSZip.
const OfficialLetterPage = (() => {
  const ISSUER_KEY = 'officialLetter.issuer.v1';
  const MAX_FILES = 4, MAX_EDGE = 1600, MAX_PDF = 6 * 1024 * 1024, MAX_RESULTS = 30;
  const Core = () => OfficialLetterCore;
  const esc = value => Core().escapeHtml(value);
  const svg = path => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  const ICON = {
    mark: '<path d="M12 3v3"/><circle cx="12" cy="2.5" r="1"/><rect x="4" y="6" width="16" height="13" rx="4"/><path d="M4 11H2v4h2M20 11h2v4h-2"/><circle cx="9" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.1" fill="currentColor" stroke="none"/><path d="M9 16h6"/>',
    attach: '<path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
    send: '<path d="m21 3-7.2 18-4.1-7.7L2 9.2 21 3Z"/><path d="m9.7 13.3 4.1-4.1"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09A1.65 1.65 0 0 0 20.91 10H21a2 2 0 0 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15Z"/>',
    newChat: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>', check: '<path d="m5 12 4 4L19 6"/>'
  };

  let host = null, controller = null, generation = 0, records = [], index = [];
  const st = {templateId: '', recordKey: '', recQuery: '', recActive: 0, brief: '', files: [], values: null, filledByAI: [], questions: [], extras: [], outline: [], outlineEdited: false, understanding: '', notes: '', letter: null, history: [], recordShown: '', busy: '', status: ''};

  // ---- Đơn vị ban hành (nhớ trên máy) ----
  const loadIssuer = () => { try { return Core().normalizeIssuer(JSON.parse(localStorage.getItem(ISSUER_KEY) || '{}')); } catch (_) { return Core().normalizeIssuer({}); } };
  const saveIssuer = issuer => { try { localStorage.setItem(ISSUER_KEY, JSON.stringify(issuer)); } catch (_) { /* bỏ qua */ } };
  const toast = (message, type) => { if (typeof triggerToast === 'function') triggerToast(message, type || 'info'); };
  const template = () => Core().findTemplate(st.templateId);
  const $ = selector => host && host.querySelector(selector);

  // ---- Tìm hồ sơ ----
  const fold = text => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
  const compact = text => fold(text).replace(/[^a-z0-9]/g, '');
  function recordInfo(row) {
    const r = row.record || {};
    return {
      plate: String(r.bienSo || '').trim(), owner: String(r.chuXe || r.khachHang || r.tenChuXe || '').trim(),
      code: String(r.soHoSoBoiThuong || r.soHSBT || r.soHoSo || '').trim(), gcn: String(r.soGcn || r.soGCN || '').trim(),
      tag: row.group === 'Hồ sơ tồn' ? 'Hồ sơ tồn' : 'Giám định'
    };
  }
  function buildIndex() {
    index = records.map(row => {
      const info = recordInfo(row), r = row.record || {};
      const text = [info.plate, info.owner, info.code, info.gcn, row.key.split(':')[1], r.soKhungSoMay, r.hangXe, r.hieuXe, r.garaSuaChua, r.diaDiemVTT, r.diaDiemTonThat].filter(Boolean).join(' ');
      return {row, info, hay: fold(text), hayCompact: compact(text), plateCompact: compact(info.plate), codeCompact: compact(info.code)};
    });
  }
  function searchRecords(query) {
    const tokens = fold(query).split(/\s+/).filter(Boolean);
    if (!tokens.length) return index.slice(0, 8);
    return index.filter(item => tokens.every(token => item.hay.includes(token) || (compact(token) && item.hayCompact.includes(compact(token)))))
      .map(item => ({item, rank: tokens.some(token => item.plateCompact.startsWith(compact(token)) || item.codeCompact.startsWith(compact(token))) ? 0 : 1}))
      .sort((a, b) => a.rank - b.rank).map(entry => entry.item);
  }
  const chosenRecord = () => index.find(item => item.row.key === st.recordKey) || null;
  const currentRecord = () => { const found = chosenRecord(); return found ? found.row.record : null; };
  const recordLabel = info => [info.plate, info.owner, info.code && 'HS ' + info.code].filter(Boolean).join(' · ') || 'Hồ sơ đã chọn';

  function recordItemHtml(item, active) {
    const {info, row} = item;
    return '<button type="button" class="ol-rec-item' + (active ? ' is-active' : '') + '" role="option" data-ol-pick="' + esc(row.key) + '"><span class="ol-rec-plate">' + esc(info.plate || '—') + '</span>'
      + '<span class="ol-rec-main"><b>' + esc(info.owner || 'Chưa có tên chủ xe') + '</b><small>' + esc([info.code && 'HS ' + info.code, info.gcn && 'GCN ' + info.gcn].filter(Boolean).join(' · ') || 'Chưa có số hồ sơ') + '</small></span><em class="ol-rec-tag">' + esc(info.tag) + '</em></button>';
  }
  function updateRecList() {
    const list = $('[data-ol-rec-list]');
    if (!list) return;
    const found = searchRecords(st.recQuery);
    const shown = found.slice(0, MAX_RESULTS);
    st.recActive = Math.max(0, Math.min(st.recActive, shown.length - 1));
    list.innerHTML = shown.length ? shown.map((item, i) => recordItemHtml(item, i === st.recActive)).join('')
      : '<p class="ol-rec-empty">Không tìm thấy hồ sơ nào khớp “' + esc(st.recQuery) + '”.</p>';
    const count = $('[data-ol-rec-count]');
    if (count) count.textContent = st.recQuery.trim() ? found.length + ' kết quả' + (found.length > MAX_RESULTS ? ' (hiện ' + MAX_RESULTS + ' đầu)' : '') : 'Gợi ý ' + shown.length + '/' + index.length + ' hồ sơ';
  }

  // ---- Tệp đính kèm ----
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
  function addFiles(list) {
    const picked = [...list].filter(file => /^image\//.test(file.type) || file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
    if (!picked.length) return;
    for (const file of picked) {
      if (st.files.length >= MAX_FILES) { toast('Chỉ nhận tối đa ' + MAX_FILES + ' tệp mỗi lần gửi.', 'info'); break; }
      st.files.push({file, url: /^image\//.test(file.type) ? URL.createObjectURL(file) : ''});
    }
    syncComposer();
  }
  const releaseFiles = list => list.forEach(item => { if (item.url) { try { URL.revokeObjectURL(item.url); } catch (_) { /* bỏ qua */ } } });

  // ---- Gọi Gemini ----
  async function callAI(request) {
    if (typeof GeminiKeyStore === 'undefined' || typeof SharedFormsAI === 'undefined') throw new Error('Chưa tải được mô-đun AI. Hãy tải lại trang.');
    const apiKey = await GeminiKeyStore.get();
    if (!apiKey) throw new Error('Chưa có khoá Gemini API. Vào Quản trị hệ thống → Gemini API (hoặc nút ⚙️ của TASCO AI) để thêm khoá.');
    let model = 'gemini-2.5-flash';
    try { model = localStorage.getItem('gemini_form_model') || model; } catch (_) { /* bỏ qua */ }
    controller?.abort();
    controller = new AbortController();
    return SharedFormsAI.callGemini(request, apiKey, model, controller.signal);
  }

  // ---- Luồng xử lý ----
  function startValues() {
    const base = Core().prefillValues(template(), currentRecord(), loadIssuer());
    if (st.values) for (const [key, value] of Object.entries(st.values)) if (Core().single(value, 1)) base[key] = value; // giữ phần người dùng đã nhập
    return base;
  }
  const say = (role, text, extra) => st.history.push({role, text, ...(extra || {})});

  const answeredList = () => st.questions.filter(item => item.answer).map(item => ({question: item.question, answer: item.answer}));
  const defaultOutline = () => (template() ? template().outline : []).map(text => ({text, on: true}));

  async function analyze(newFiles) {
    const tpl = template();
    if (!tpl) return;
    const my = generation;
    collectAll();
    st.busy = 'analyze'; st.status = 'Đang phân tích…'; renderAll('end');
    try {
      const current = startValues();
      const files = [];
      for (const item of newFiles) files.push(await prepareFile(item.file));
      const raw = await callAI(Core().buildAnalyzeRequest(tpl, {
        record: currentRecord() ? SharedFormsAI.describeRecord(currentRecord()) : {}, current, brief: st.brief, files,
        answered: answeredList(), extras: st.extras, outline: st.outlineEdited ? st.outline.filter(item => item.on).map(item => item.text) : undefined
      }));
      if (my !== generation) return;
      const analysis = Core().parseAnalysis(raw, tpl);
      const merged = Core().mergeAnalysis(tpl, current, analysis);
      st.values = merged.values; st.filledByAI = Array.from(new Set(st.filledByAI.concat(merged.filledByAI)));
      // Câu hỏi đã trả lời được giữ lại; câu mới của AI nối thêm (bỏ câu trùng).
      const kept = st.questions.filter(item => item.answer);
      const seen = new Set(kept.map(item => fold(item.question)));
      st.questions = kept.concat(analysis.questions.filter(item => !seen.has(fold(item.question))).map(item => ({...item, answer: ''})));
      const labels = new Set(st.extras.map(item => fold(item.label)));
      st.extras = st.extras.concat(analysis.extras.filter(item => !labels.has(fold(item.label))));
      if (!st.outlineEdited) st.outline = (analysis.outline.length ? analysis.outline.map(text => ({text, on: true})) : defaultOutline());
      st.understanding = analysis.understanding; st.notes = analysis.notes;
      const missing = Core().missingFields(tpl, st.values);
      const open = st.questions.filter(item => !item.answer).length;
      say('ai', (analysis.understanding ? 'Tôi hiểu yêu cầu của bạn như sau: ' + analysis.understanding : 'Đã đọc xong thông tin.')
        + (open ? ' Tôi cần bạn làm rõ ' + open + ' điểm bên dưới để công văn đúng ý.' : '')
        + (missing.length ? ' Còn thiếu ' + missing.length + ' mục bắt buộc (đánh dấu đỏ).' : (open ? '' : ' Thông tin đã đủ — bạn xem dàn ý rồi bấm Soạn công văn.')));
    } catch (error) {
      if (my !== generation || error.name === 'AbortError') return;
      say('ai', (error.message || 'Không phân tích được.') + ' Bạn vẫn có thể nhập thông tin vào các ô bên dưới.', {error: true});
      if (!st.values) { st.values = startValues(); if (!st.outline.length) st.outline = defaultOutline(); }
    } finally { if (my === generation) { st.busy = ''; st.status = ''; renderAll(st.questions.some(item => !item.answer) ? 'questions' : 'fields'); } }
  }

  function manual() {
    if (!template() || st.busy) return;
    st.values = startValues(); st.questions = []; st.notes = ''; if (!st.outline.length) st.outline = defaultOutline();
    say('ai', 'Được rồi, bạn nhập thông tin vào các ô bên dưới rồi bấm Soạn công văn.');
    renderAll('fields');
  }

  async function compose(instruction) {
    const tpl = template();
    if (!tpl || st.busy || !st.values) return;
    collectAll(); syncLetter();
    if (instruction) say('user', instruction, {stage: 'b'});
    const my = generation;
    st.busy = 'compose'; st.status = 'Đang soạn công văn…'; renderAll('end');
    try {
      const issuer = loadIssuer();
      const previous = instruction && st.letter ? st.letter.paragraphs.map(p => p.text).join('\n') : '';
      const brief = st.brief + (instruction ? '\nYÊU CẦU CHỈNH SỬA MỚI NHẤT: ' + instruction : '');
      const ctx = {outline: st.outline.filter(item => item.on).map(item => item.text).filter(text => Core().single(text, 1)), extras: st.extras, answers: answeredList(), understanding: st.understanding};
      const raw = await callAI(Core().buildComposeRequest(tpl, st.values, issuer, brief, previous, ctx));
      if (my !== generation) return;
      const parsed = Core().parseLetter(raw);
      const date = st.letter && st.letter.date, number = st.letter && st.letter.number;
      st.letter = Core().assembleLetter(tpl, st.values, issuer, parsed, date);
      if (number) st.letter.number = number;
      say('ai', instruction ? 'Đã chỉnh lại công văn theo yêu cầu.' : 'Đã soạn xong. Nhấp vào chữ để sửa trực tiếp, hoặc nhắn yêu cầu chỉnh sửa ở khung chat.', {stage: 'b'});
    } catch (error) {
      if (my !== generation || error.name === 'AbortError') return;
      say('ai', error.message || 'Không soạn được công văn.', {error: true, stage: 'b'});
    } finally { if (my === generation) { st.busy = ''; st.status = ''; renderAll(st.letter ? 'letter' : 'fields'); } }
  }

  function collectValues() {
    if (!host || !st.values) return;
    host.querySelectorAll('[data-ol-field]').forEach(input => { st.values[input.dataset.olField] = input.value; });
  }
  // Đọc lại mọi chỗ người dùng đã nhập trong khung (trường, thông tin bổ sung, dàn ý, câu trả lời) trước khi vẽ lại.
  function collectAll() {
    if (!host) return;
    collectValues();
    const rows = host.querySelectorAll('[data-ol-extra-row]');
    if (rows.length || host.querySelector('[data-ol-block="fields"]')) st.extras = [...rows].map(row => ({label: row.querySelector('[data-ol-extra-label]').value, value: row.querySelector('[data-ol-extra-value]').value}));
    const outlineRows = host.querySelectorAll('[data-ol-outline-row]');
    if (outlineRows.length) st.outline = [...outlineRows].map(row => ({text: row.querySelector('[data-ol-outline-text]').value, on: row.querySelector('[data-ol-outline-on]').checked}));
    host.querySelectorAll('[data-ol-q-answer]').forEach(input => { const item = st.questions[Number(input.dataset.olQAnswer)]; if (item) item.answer = input.value.trim(); });
    syncLetter();
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
  function syncLetter() { if (st.letter && $('.ol-paper')) st.letter = readLetter(); }

  function send() {
    const input = $('[data-ol-input]');
    if (!input || st.busy) return;
    const text = input.value.trim();
    if (st.letter) { if (!text) return; input.value = ''; compose(text); return; }
    const newFiles = st.files.slice();
    if (!text && !newFiles.length && !st.recordKey) {
      toast(st.values ? 'Gõ câu trả lời / bổ sung, hoặc bấm Soạn công văn.' : 'Hãy chọn hồ sơ, gõ ý chính hoặc đính kèm ảnh/PDF trước khi gửi.', 'info');
      return;
    }
    if (!template()) st.templateId = 'tu_do'; // chưa chọn mẫu → soạn công văn tự do theo ý chính
    const record = chosenRecord();
    say('user', text, {files: newFiles.map(item => ({name: item.file.name, url: item.url})), record: record && st.recordShown !== st.recordKey ? recordLabel(record.info) : '', stage: 'a'});
    st.recordShown = st.recordKey;
    if (text) st.brief = [st.brief, text].filter(Boolean).join('\n');
    input.value = ''; st.files = [];
    analyze(newFiles);
  }

  async function downloadDocx() {
    if (!st.letter) return;
    if (typeof JSZip === 'undefined') { toast('Chưa tải được thư viện tạo Word. Kiểm tra mạng rồi thử lại.', 'warning'); return; }
    try {
      syncLetter();
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
    syncLetter();
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
    syncLetter();
    try { await navigator.clipboard.writeText(Core().letterToText(st.letter)); toast('Đã sao chép nội dung công văn.', 'success'); }
    catch (_) { toast('Không sao chép được. Hãy bôi đen nội dung rồi nhấn Ctrl+C.', 'warning'); }
  }

  // ---- Hiển thị: các khối trong khung hội thoại ----
  function templateBlock() {
    const tpl = template();
    if (tpl) return '<div class="msg-bubble msg-user ol-pick-bubble"><span>Mẫu công văn: <b>' + esc(tpl.name) + '</b></span><button type="button" class="ol-link" data-ol-act="change-template">Đổi mẫu</button></div>';
    const groups = [];
    Core().templates().forEach(item => { let group = groups.find(entry => entry.name === item.group); if (!group) groups.push(group = {name: item.group, items: []}); group.items.push(item); });
    return '<div class="msg-bubble msg-ai ol-wide"><p>Xin chào! Bạn muốn soạn công văn nào? Chọn một mẫu bên dưới — hoặc gõ thẳng ý chính ở khung chat, tôi sẽ soạn công văn tự do cho bạn.</p>'
      + groups.map(group => '<div class="ol-group"><h4>' + esc(group.name) + '</h4><div class="tasco-ai-choices">'
        + group.items.map(item => '<button type="button" class="tasco-ai-choice" data-ol-template="' + esc(item.id) + '"><strong>' + esc(item.name) + '</strong><small>' + esc(item.summary) + '</small></button>').join('') + '</div></div>').join('') + '</div>';
  }

  function inputBlock() {
    if (!template() || st.values) return '';
    const found = chosenRecord();
    const picker = found
      ? '<div class="ol-rec-chosen"><span class="ol-rec-plate">' + esc(found.info.plate || '—') + '</span><span class="ol-rec-main"><b>' + esc(found.info.owner || 'Chưa có tên chủ xe') + '</b><small>' + esc(found.info.code ? 'HS ' + found.info.code : 'Chưa có số hồ sơ') + '</small></span><button type="button" class="ol-x" data-ol-rec-clear aria-label="Bỏ chọn hồ sơ" title="Bỏ chọn hồ sơ">' + svg(ICON.close) + '</button></div>'
      : (index.length ? '<div class="ol-rec"><label class="ol-rec-search">' + svg(ICON.search) + '<input type="search" data-ol-rec-q autocomplete="off" spellcheck="false" placeholder="Tìm hồ sơ: biển số, số hồ sơ, tên chủ xe, số GCN…" value="' + esc(st.recQuery) + '" aria-label="Tìm hồ sơ"></label>'
        + '<div class="ol-rec-list" data-ol-rec-list role="listbox" aria-label="Kết quả tìm hồ sơ"></div><small class="ol-rec-count" data-ol-rec-count></small></div>'
        : '<p class="ol-muted">Chưa có dữ liệu hồ sơ trên trang này — bạn vẫn có thể gõ ý chính hoặc đính kèm ảnh/PDF.</p>');
    return '<div class="msg-bubble msg-ai ol-wide"><p>Đưa cho tôi thông tin đầu vào — dùng một hoặc nhiều cách:</p><ol class="ol-ways"><li><b>Tìm và chọn hồ sơ</b> để lấy sẵn biển số, chủ xe, ngày và địa điểm tổn thất…</li><li><b>Gõ ý chính</b> cần viết ở khung chat bên dưới.</li><li><b>Đính kèm ảnh/PDF</b> (biên bản, giấy tờ, công văn nhận được) bằng nút ghim.</li></ol>'
      + picker + '<p class="ol-muted">Xong thì bấm Gửi. Nội dung hồ sơ, ý chính và tệp đính kèm được gửi tới Google Gemini để phân tích.</p></div>';
  }

  function messageHtml(message) {
    if (message.role === 'user') {
      const thumbs = (message.files || []).length ? '<div class="tasco-ai-thumbs">' + message.files.map(file => file.url ? '<img class="tasco-ai-thumb" alt="' + esc(file.name) + '" src="' + esc(file.url) + '">' : '<span class="tasco-ai-thumb tasco-ai-thumb--file" title="' + esc(file.name) + '">PDF</span>').join('') + '</div>' : '';
      const record = message.record ? '<div class="ol-sent-record">' + esc('Hồ sơ: ' + message.record) + '</div>' : '';
      return '<div class="msg-bubble msg-user">' + thumbs + record + (message.text ? esc(message.text) : (message.files && message.files.length ? '<i>Đã gửi ' + message.files.length + ' tệp</i>' : (message.record ? '<i>Dùng thông tin từ hồ sơ</i>' : ''))) + '</div>';
    }
    return '<div class="msg-bubble msg-ai' + (message.error ? ' ol-error' : '') + '" role="' + (message.error ? 'alert' : 'status') + '"><p>' + esc(message.text) + '</p></div>';
  }

  function fieldInput(field, value) {
    const common = ' data-ol-field="' + esc(field.key) + '" maxlength="' + (field.max || 500) + '"';
    return field.type === 'textarea' ? '<textarea' + common + ' rows="3">' + esc(value) + '</textarea>' : '<input' + common + ' value="' + esc(value) + '"' + (field.type === 'date' ? ' placeholder="dd/mm/yyyy"' : '') + '>';
  }

  function questionsBlock() {
    if (!template() || !st.values || !st.questions.length) return '';
    const open = st.questions.filter(item => !item.answer).length;
    return '<div class="msg-bubble msg-ai ol-wide" data-ol-block="questions"><p><b>Tôi cần bạn làm rõ</b> <span class="ol-q-count" data-ol-q-count>' + esc(open ? 'còn ' + open + '/' + st.questions.length + ' câu chưa trả lời' : 'đã trả lời đủ') + '</span></p>'
      + st.questions.map((item, i) => '<div class="ol-q" data-ol-q="' + i + '"><p class="ol-q-text">' + (i + 1) + '. ' + esc(item.question) + '</p>'
        + (item.options.length ? '<div class="tasco-ai-chiprow">' + item.options.map((option, j) => '<button type="button" class="tasco-ai-chip" data-ol-q-opt="' + i + '|' + j + '" aria-pressed="' + (item.answer === option) + '">' + esc(option) + '</button>').join('') + '</div>' : '')
        + '<input class="ol-q-input" data-ol-q-answer="' + i + '" maxlength="400" placeholder="' + (item.options.length ? 'Hoặc gõ câu trả lời khác…' : 'Gõ câu trả lời…') + '" value="' + esc(item.answer) + '" aria-label="Trả lời câu ' + (i + 1) + '"></div>').join('')
      + '<p class="ol-muted">Câu nào bỏ trống, AI sẽ viết chung hoặc để “……”. Có thể trả lời tự do ở khung chat bên dưới để AI hiểu lại.</p></div>';
  }

  function fieldsBlock() {
    const tpl = template();
    if (!tpl || !st.values) return '';
    const missing = Core().missingFields(tpl, st.values);
    return '<div class="msg-bubble msg-ai ol-wide ol-fields-bubble" data-ol-block="fields"><p><b>Thông tin công văn</b> — kiểm tra và sửa nếu cần.</p>'
      + (st.notes ? '<p class="ol-note">' + esc(st.notes) + '</p>' : '')
      + '<div class="ol-form">' + tpl.fields.map(field => {
        const flag = field.required && !Core().single(st.values[field.key], 1);
        return '<label class="ol-field' + (flag ? ' is-missing' : '') + (field.type === 'textarea' ? ' is-wide' : '') + '" data-ol-wrap="' + esc(field.key) + '"><span>' + esc(field.label) + (field.required ? ' <b title="Bắt buộc">*</b>' : '')
          + (st.filledByAI.includes(field.key) ? ' <em class="ol-ai-tag">AI điền</em>' : '') + (flag ? ' <em class="ol-miss-tag">Thiếu</em>' : '') + '</span>'
          + fieldInput(field, st.values[field.key]) + (field.hint ? '<small>' + esc(field.hint) + '</small>' : '') + '</label>';
      }).join('') + '</div>'
      + '<div class="ol-extras"><b>Thông tin bổ sung theo yêu cầu của bạn</b><small>Những ý AI ghi nhận được mà mẫu chưa có ô riêng (thời hạn, lý do, tình tiết…). Sửa, xóa hoặc thêm tùy ý.</small>'
      + st.extras.map(item => extraRowHtml(item)).join('') + '<button type="button" class="ol-add" data-ol-act="add-extra">+ Thêm thông tin</button></div>'
      + '<p class="' + (missing.length ? 'ol-warn' : 'ol-ok') + '" data-ol-missing>' + esc(missingText(missing)) + '</p></div>';
  }
  const extraRowHtml = item => '<div class="ol-extra-row" data-ol-extra-row><input data-ol-extra-label maxlength="80" placeholder="Tên thông tin" value="' + esc(item.label) + '" aria-label="Tên thông tin"><input data-ol-extra-value maxlength="400" placeholder="Nội dung" value="' + esc(item.value) + '" aria-label="Nội dung"><button type="button" class="ol-x" data-ol-act="remove-extra" aria-label="Xóa dòng" title="Xóa dòng">' + svg(ICON.close) + '</button></div>';

  function outlineBlock() {
    if (!template() || !st.values) return '';
    const open = st.questions.filter(item => !item.answer).length;
    return '<div class="msg-bubble msg-ai ol-wide ol-outline-bubble" data-ol-block="outline"><p><b>Dự kiến nội dung công văn</b> — mỗi dòng là một ý AI sẽ viết. Bỏ tick ý không cần, sửa chữ để chỉ đạo AI viết đúng ý bạn, thêm ý mới nếu muốn.</p>'
      + '<div class="ol-outline">' + st.outline.map(item => '<div class="ol-outline-row" data-ol-outline-row><input type="checkbox" data-ol-outline-on' + (item.on ? ' checked' : '') + ' aria-label="Dùng ý này"><input class="ol-outline-text" data-ol-outline-text maxlength="300" value="' + esc(item.text) + '" aria-label="Nội dung ý"><button type="button" class="ol-x" data-ol-act="remove-outline" aria-label="Xóa ý" title="Xóa ý">' + svg(ICON.close) + '</button></div>').join('')
      + '</div><button type="button" class="ol-add" data-ol-act="add-outline">+ Thêm ý</button>'
      + (open ? '<p class="ol-warn" data-ol-open-q>Còn ' + open + ' câu hỏi chưa trả lời — AI sẽ viết chung hoặc để “……”.</p>' : '')
      + '<div class="ol-actions"><button type="button" class="tasco-ai-btn-primary ol-primary" data-ol-act="compose"' + (st.busy ? ' disabled' : '') + '>' + (st.letter ? 'Soạn lại công văn' : 'Soạn công văn') + '</button></div></div>';
  }
  const missingText = missing => missing.length ? 'Còn thiếu ' + missing.length + ' mục bắt buộc: ' + missing.map(item => item.label).join(', ') + '. Vẫn có thể soạn, chỗ thiếu sẽ để “……”.' : 'Đã đủ thông tin bắt buộc.';

  function letterBlock() {
    if (!st.letter) return '';
    const gaps = Core().countGaps(st.letter);
    return '<div class="msg-bubble msg-ai ol-wide ol-letter-bubble" data-ol-block="letter"><div class="ol-toolbar"><label class="ol-datepick">Ngày ban hành <input type="date" data-ol-date value="' + esc(st.letter.date) + '"></label>'
      + '<button type="button" class="tasco-ai-btn-primary ol-primary" data-ol-act="docx">Tải Word (.docx)</button><button type="button" class="tasco-ai-btn-ghost" data-ol-act="print">In</button><button type="button" class="tasco-ai-btn-ghost" data-ol-act="copy">Sao chép</button></div>'
      + (st.letter.warnings.length ? '<div class="ol-warn"><b>AI lưu ý cần kiểm tra</b><ul>' + st.letter.warnings.map(item => '<li>' + esc(item) + '</li>').join('') + '</ul></div>' : '')
      + (gaps ? '<p class="ol-warn">Còn ' + gaps + ' chỗ “……” cần điền trước khi gửi.</p>' : '')
      + '<p class="ol-muted">Nhấp vào chữ để sửa trực tiếp. Số công văn để trống nếu chưa vào sổ.</p>'
      + '<div class="ol-paper-wrap">' + Core().letterToHtml(st.letter) + '</div></div>';
  }

  const typingHtml = () => st.busy ? '<div class="typing-indicator" role="status"><span></span><span></span><span></span><em class="tasco-ai-status-text">' + esc(st.status) + '</em></div>' : '';

  function bodyHtml() {
    const stage = name => st.history.filter(item => (item.stage || 'a') === name).map(messageHtml).join('');
    const lock = html => st.busy ? html.replace('<div class="msg-bubble', '<div inert class="msg-bubble') : html; // đang chạy AI: khóa chỉnh sửa để không bị ghi đè khi vẽ lại
    return templateBlock() + inputBlock() + stage('a') + lock(questionsBlock()) + lock(fieldsBlock()) + lock(outlineBlock()) + stage('b') + lock(letterBlock()) + typingHtml();
  }

  function renderHeader() {
    const chip = $('[data-ol-status]');
    if (chip) chip.textContent = st.status || 'Sẵn sàng';
  }

  function renderAll(target) {
    if (!host) return;
    const body = $('#olBody');
    const previous = body.scrollTop;
    body.innerHTML = bodyHtml();
    updateRecList();
    renderHeader();
    syncComposer();
    if (target === 'end') body.scrollTop = body.scrollHeight;
    else if (target === 'fields' || target === 'letter' || target === 'questions' || target === 'outline') { const block = body.querySelector('[data-ol-block="' + target + '"]'); body.scrollTop = block ? Math.max(0, block.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 14) : body.scrollHeight; }
    else body.scrollTop = previous;
  }

  const REFINES = ['Viết ngắn gọn hơn', 'Giọng trang trọng hơn', 'Nêu rõ đề nghị phản hồi trong 07 ngày'];
  function syncComposer() {
    if (!host) return;
    const input = $('[data-ol-input]'), sendButton = $('[data-ol-act="send"]');
    if (!input) return;
    input.disabled = !!st.busy; if (sendButton) sendButton.disabled = !!st.busy;
    input.placeholder = st.letter ? 'Nhắn yêu cầu chỉnh sửa, VD: viết ngắn gọn hơn…' : st.values ? 'Trả lời câu hỏi của AI hoặc bổ sung thông tin…' : template() ? 'Gõ ý chính cần viết rồi bấm Gửi…' : 'Gõ ý chính để soạn công văn tự do, hoặc chọn mẫu ở trên…';
    const chips = $('#olSuggest');
    chips.innerHTML = st.busy ? '' : st.letter ? REFINES.map(text => '<button type="button" class="tasco-ai-suggest__chip" data-ol-refine="' + esc(text) + '">' + esc(text) + '</button>').join('')
      : st.values ? '<button type="button" class="tasco-ai-suggest__chip" data-ol-act="compose">Soạn công văn ngay</button>'
      : template() ? '<button type="button" class="tasco-ai-suggest__chip" data-ol-act="manual">Nhập tay, không dùng AI phân tích</button>' : '';
    const tiles = $('#olAttachments');
    tiles.hidden = !st.files.length || !!st.letter;
    tiles.innerHTML = st.files.map((item, i) => '<span class="tasco-ai-attach" title="' + esc(item.file.name) + '">' + (item.url ? '<img alt="" src="' + esc(item.url) + '">' : '<em>PDF</em>') + '<button type="button" data-ol-remove-file="' + i + '" aria-label="Bỏ tệp ' + esc(item.file.name) + '">×</button></span>').join('');
    const attach = $('.tasco-ai-attach-btn');
    if (attach) attach.hidden = !!st.letter;
    const composer = $('.tasco-ai-composer');
    if (composer) composer.classList.toggle('ol-no-attach', !!st.letter);
  }

  function updateMissingLive() {
    const tpl = template();
    if (!tpl || !st.values) return;
    collectValues();
    const missing = Core().missingFields(tpl, st.values);
    tpl.fields.forEach(field => {
      const wrap = host.querySelector('[data-ol-wrap="' + field.key + '"]');
      if (wrap) { wrap.classList.toggle('is-missing', !!field.required && !Core().single(st.values[field.key], 1)); const tag = wrap.querySelector('.ol-miss-tag'); if (tag && !wrap.classList.contains('is-missing')) tag.remove(); }
    });
    const line = $('[data-ol-missing]');
    if (line) { line.className = missing.length ? 'ol-warn' : 'ol-ok'; line.textContent = missingText(missing); }
  }

  // ---- Cài đặt đơn vị ban hành ----
  function openSettings() {
    const issuer = loadIssuer();
    const dialog = document.createElement('dialog');
    dialog.className = 'ol-dialog';
    const rows = [['parent', 'Tên công ty'], ['unit', 'Chi nhánh / đơn vị'], ['shortName', 'Tên gọi tắt'], ['place', 'Địa danh ghi ở ngày tháng'], ['signerTitle', 'Chức danh người ký'], ['signerName', 'Họ tên người ký (có thể để trống)'], ['contactPerson', 'Cán bộ liên hệ mặc định'], ['phone', 'Số điện thoại liên hệ'], ['address', 'Địa chỉ nhận hồ sơ']];
    dialog.innerHTML = '<form method="dialog"><h2>Thông tin đơn vị ban hành</h2><p class="ol-muted">Lưu trên máy này, dùng cho mọi công văn.</p>'
      + rows.map(([key, label]) => '<label class="ol-field"><span>' + esc(label) + '</span><input name="' + key + '" maxlength="300" value="' + esc(issuer[key]) + '"></label>').join('')
      + '<div class="ol-actions"><button type="button" class="tasco-ai-btn-ghost" data-cancel>Hủy</button><button type="submit" class="tasco-ai-btn-primary">Lưu</button></div></form>';
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

  // ---- Đặt lại ----
  function reset(keepRecordAndFiles) {
    generation++; controller?.abort(); controller = null;
    st.templateId = ''; st.values = null; st.filledByAI = []; st.questions = []; st.extras = []; st.outline = []; st.outlineEdited = false; st.understanding = ''; st.notes = ''; st.letter = null; st.history = []; st.brief = ''; st.busy = ''; st.status = ''; st.recordShown = ''; st.recQuery = ''; st.recActive = 0;
    if (!keepRecordAndFiles) { st.recordKey = ''; releaseFiles(st.files); st.files = []; }
  }
  const confirmDiscard = () => !(st.values || st.letter) || window.confirm('Thao tác này sẽ bỏ nội dung đang soạn. Tiếp tục?');

  // ---- Câu hỏi làm rõ: chọn phương án / gõ trả lời → ghi vào câu hỏi và (nếu hỏi về một trường) điền thẳng vào trường ----
  function applyAnswer(i, answer) {
    const item = st.questions[i];
    if (!item) return;
    item.answer = answer;
    if (item.key && st.values && answer) {
      st.values[item.key] = answer;
      const input = host.querySelector('[data-ol-field="' + item.key + '"]');
      if (input) input.value = answer;
      updateMissingLive();
    }
    const open = st.questions.filter(q => !q.answer).length;
    const count = $('[data-ol-q-count]'); if (count) count.textContent = open ? 'còn ' + open + '/' + st.questions.length + ' câu chưa trả lời' : 'đã trả lời đủ';
    const line = $('[data-ol-open-q]'); if (line) { line.hidden = !open; line.textContent = 'Còn ' + open + ' câu hỏi chưa trả lời — AI sẽ viết chung hoặc để “……”.'; }
  }
  function chooseOption(button) {
    const [i, j] = button.dataset.olQOpt.split('|').map(Number);
    const item = st.questions[i];
    if (!item) return;
    const answer = item.answer === item.options[j] ? '' : item.options[j];
    applyAnswer(i, answer);
    const card = button.closest('.ol-q');
    card.querySelectorAll('[data-ol-q-opt]').forEach(chip => chip.setAttribute('aria-pressed', String(chip === button && !!answer)));
    card.querySelector('[data-ol-q-answer]').value = answer;
  }

  // ---- Sự kiện ----
  function onClick(event) {
    const target = event.target;
    const tplButton = target.closest('[data-ol-template]');
    if (tplButton) { st.templateId = tplButton.dataset.olTemplate; renderAll('end'); return; }
    const pick = target.closest('[data-ol-pick]');
    if (pick) { st.recordKey = pick.dataset.olPick; st.recQuery = ''; renderAll('end'); $('[data-ol-input]')?.focus(); return; }
    if (target.closest('[data-ol-rec-clear]')) { st.recordKey = ''; renderAll('end'); return; }
    const removeFile = target.closest('[data-ol-remove-file]');
    if (removeFile) { const [gone] = st.files.splice(Number(removeFile.dataset.olRemoveFile), 1); if (gone) releaseFiles([gone]); syncComposer(); return; }
    const opt = target.closest('[data-ol-q-opt]');
    if (opt) { chooseOption(opt); return; }
    const refine = target.closest('[data-ol-refine]');
    if (refine) { compose(refine.dataset.olRefine); return; }
    const act = target.closest('[data-ol-act]');
    if (!act) return;
    switch (act.dataset.olAct) {
      case 'send': send(); break;
      case 'manual': manual(); break;
      case 'compose': compose(''); break;
      case 'docx': downloadDocx(); break;
      case 'print': printLetter(); break;
      case 'copy': copyText(); break;
      case 'settings': openSettings(); break;
      case 'add-extra': collectAll(); st.extras.push({label: '', value: ''}); renderAll(); host.querySelector('[data-ol-extra-row]:last-of-type [data-ol-extra-label]')?.focus(); break;
      case 'remove-extra': { collectAll(); const rows = [...host.querySelectorAll('[data-ol-extra-row]')]; st.extras.splice(rows.indexOf(act.closest('[data-ol-extra-row]')), 1); renderAll(); break; }
      case 'add-outline': collectAll(); st.outline.push({text: '', on: true}); st.outlineEdited = true; renderAll(); host.querySelector('[data-ol-outline-row]:last-of-type [data-ol-outline-text]')?.focus(); break;
      case 'remove-outline': { collectAll(); const rows = [...host.querySelectorAll('[data-ol-outline-row]')]; st.outline.splice(rows.indexOf(act.closest('[data-ol-outline-row]')), 1); st.outlineEdited = true; renderAll(); break; }
      case 'new-chat': if (confirmDiscard()) { reset(false); renderAll('end'); } break;
      case 'change-template': if (confirmDiscard()) { reset(true); renderAll('end'); } break;
      default: break;
    }
  }
  function onInput(event) {
    const target = event.target;
    if (target.matches('[data-ol-rec-q]')) { st.recQuery = target.value; st.recActive = 0; updateRecList(); }
    else if (target.matches('[data-ol-field]')) updateMissingLive();
    else if (target.matches('[data-ol-q-answer]')) {
      const i = Number(target.dataset.olQAnswer);
      applyAnswer(i, target.value.trim());
      target.closest('.ol-q').querySelectorAll('[data-ol-q-opt]').forEach(chip => chip.setAttribute('aria-pressed', String(chip.textContent === target.value.trim())));
    } else if (target.matches('[data-ol-outline-text]')) st.outlineEdited = true;
  }
  function onChange(event) {
    const target = event.target;
    if (target.matches('[data-ol-files]')) { addFiles(target.files); target.value = ''; }
    else if (target.matches('[data-ol-outline-on]')) st.outlineEdited = true;
    else if (target.matches('[data-ol-date]') && /^\d{4}-\d{2}-\d{2}$/.test(target.value)) { syncLetter(); st.letter.date = target.value; renderAll(); }
  }
  function onKeydown(event) {
    const target = event.target;
    if (target.matches && target.matches('.ol-edit') && event.key === 'Enter') { event.preventDefault(); return; } // mỗi khối là một dòng/đoạn
    if (target.matches && target.matches('[data-ol-input]') && event.key === 'Enter' && !event.isComposing) { event.preventDefault(); send(); return; }
    if (target.matches && target.matches('[data-ol-rec-q]')) {
      const items = [...host.querySelectorAll('.ol-rec-item')];
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!items.length) return;
        st.recActive = (st.recActive + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach((node, i) => node.classList.toggle('is-active', i === st.recActive));
        items[st.recActive].scrollIntoView({block: 'nearest'});
      } else if (event.key === 'Enter') { event.preventDefault(); items[st.recActive]?.click(); }
    }
  }
  function onPaste(event) {
    const target = event.target;
    if (target.matches && target.matches('.ol-edit')) { // dán chữ thuần để không kéo theo định dạng
      event.preventDefault();
      document.execCommand('insertText', false, (event.clipboardData || window.clipboardData).getData('text').replace(/\s+/g, ' '));
    } else if (target.matches && target.matches('[data-ol-input]') && event.clipboardData && event.clipboardData.files.length && !st.letter) { event.preventDefault(); addFiles(event.clipboardData.files); }
  }
  function onDragOver(event) { if (event.dataTransfer && [...event.dataTransfer.types].includes('Files')) event.preventDefault(); }
  function onDrop(event) { if (event.dataTransfer && event.dataTransfer.files.length && !st.letter) { event.preventDefault(); addFiles(event.dataTransfer.files); } }

  const HANDLERS = [['click', onClick], ['input', onInput], ['change', onChange], ['keydown', onKeydown], ['paste', onPaste], ['dragover', onDragOver], ['drop', onDrop]];

  function mount(container) {
    leave();
    host = container;
    records = (typeof SharedFormsAI !== 'undefined' && SharedFormsAI.listRecords) ? SharedFormsAI.listRecords() : [];
    buildIndex();
    host.innerHTML = '<div class="ol-chat"><div class="tasco-ai-header"><div class="tasco-ai-brand"><span class="tasco-ai-brand__mark" aria-hidden="true">' + svg(ICON.mark) + '</span>'
      + '<div class="tasco-ai-brand__text"><div class="tasco-ai-brand__title">Công văn AI <span class="tasco-ai-status" data-ol-status>Sẵn sàng</span></div><div class="tasco-ai-brand__subtitle">Soạn công văn theo mẫu từ hồ sơ, ý chính và giấy tờ</div></div></div>'
      + '<div class="tasco-ai-header__actions"><button type="button" class="tasco-ai-header__btn" data-ol-act="new-chat" title="Công văn mới" aria-label="Soạn công văn mới">' + svg(ICON.newChat) + '</button>'
      + '<button type="button" class="tasco-ai-header__btn" data-ol-act="settings" title="Thông tin đơn vị ban hành" aria-label="Thông tin đơn vị ban hành">' + svg(ICON.gear) + '</button></div></div>'
      + '<div class="tasco-ai-body ol-body" id="olBody"></div>'
      + '<div class="tasco-ai-footer"><div class="tasco-ai-suggest" id="olSuggest"></div><div class="tasco-ai-attachments" id="olAttachments" hidden></div>'
      + '<div class="tasco-ai-composer"><label class="tasco-ai-attach-btn" title="Đính kèm ảnh/PDF (hoặc dán ảnh, kéo thả)" aria-label="Đính kèm ảnh hoặc PDF"><input type="file" data-ol-files accept="image/*,application/pdf" multiple hidden>' + svg(ICON.attach) + '</label>'
      + '<input type="text" class="tasco-ai-input" data-ol-input autocomplete="off" maxlength="3000" aria-label="Nội dung gửi cho Công văn AI">'
      + '<button type="button" class="tasco-ai-send" data-ol-act="send" title="Gửi" aria-label="Gửi">' + svg(ICON.send) + '</button></div>'
      + '<div class="tasco-ai-footer__note">Nội dung do AI soạn cần được kiểm tra lại trước khi ký và gửi.</div></div></div>';
    HANDLERS.forEach(([name, fn]) => host.addEventListener(name, fn));
    renderAll('end');
  }

  function leave() {
    generation++;
    controller?.abort(); controller = null;
    st.busy = ''; st.status = '';
    if (host) HANDLERS.forEach(([name, fn]) => host.removeEventListener(name, fn));
    host = null;
  }

  return {mount, leave};
})();
