// Trang "Công văn AI" — kiểu AI agent dạng trang (không phải khung chat, không phải phiếu điền):
//   mở đầu: một ô yêu cầu lớn ở giữa trang, trong ô có nút Đính kèm · Hồ sơ · Loại công văn + gợi ý mẫu;
//   sau khi gửi: tóm tắt yêu cầu, 3 bước AI (đọc hồ sơ → căn cứ → soạn), tờ công văn lớn sửa trực tiếp,
//   cột ghi chú hẹp (giả định, chọn nhanh, chỗ cần kiểm tra), ô chỉnh sửa cuối trang; chi tiết nằm trong ngăn trượt.
// Gõ số HSBT/biển số trong yêu cầu là tự nhận hồ sơ. Một lần gửi = đọc (Gemini) → tìm căn cứ trong Thư viện (nếu cần) → soạn (Gemini).
// Phụ thuộc: OfficialLetterCore, OfficialLetterDossier, OfficialLetterLegal, SharedFormsAI, GeminiKeyStore, JSZip.
const OfficialLetterPage = (() => {
  const ISSUER_KEY = 'officialLetter.issuer.v1';
  const MAX_FILES = 4, MAX_EDGE = 1600, MAX_PDF = 6 * 1024 * 1024, MAX_RESULTS = 30;
  const DEFAULT_TEMPLATE = 'tu_do';
  const Core = () => OfficialLetterCore;
  const esc = value => Core().escapeHtml(value);
  const svg = path => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  const ICON = {
    letter: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    attach: '<path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
    send: '<path d="m21 3-7.2 18-4.1-7.7L2 9.2 21 3Z"/><path d="m9.7 13.3 4.1-4.1"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09A1.65 1.65 0 0 0 20.91 10H21a2 2 0 0 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
    word: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13l1.5 5 1.5-4 1.5 4 1.5-5"/>',
    print: '<path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><rect x="6" y="14" width="12" height="7"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>'
  };

  let host = null, controller = null, generation = 0, records = [], index = [];
  const st = {
    templateId: '', recordKey: '', recQuery: '', recOpen: false, recActive: 0, brief: '', files: [], refineFiles: [],
    values: null, filledByAI: [], questions: [], extras: [], outline: [], outlineEdited: false, understanding: '', notes: '',
    insights: [], keyFacts: [], legalQueries: [], assumptions: [], sources: [], legalError: '', legalLoaded: false,
    letter: null, analyzedKey: '', busy: '', status: '', notice: null, open: {},
    pop: '', drawer: '', editing: false, steps: null,
    historyId: '', savedRecordLabel: '', history: [], histQuery: '', histOpen: true, histScope: 'browser'
  };

  // ---- Tiện ích chung ----
  const loadIssuer = () => { try { return Core().normalizeIssuer(JSON.parse(localStorage.getItem(ISSUER_KEY) || '{}')); } catch (_) { return Core().normalizeIssuer({}); } };
  const saveIssuer = issuer => { try { localStorage.setItem(ISSUER_KEY, JSON.stringify(issuer)); } catch (_) { /* bỏ qua */ } };
  const toast = (message, type) => { if (typeof triggerToast === 'function') triggerToast(message, type || 'info'); };
  const templateId = () => st.templateId || DEFAULT_TEMPLATE;
  const template = () => Core().findTemplate(templateId());
  const $ = selector => host && host.querySelector(selector);
  const notice = (text, kind) => { st.notice = text ? {text, kind: kind || 'info'} : null; };

  // ---- Hồ sơ: tìm kiếm + tự nhận từ yêu cầu ----
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
  function loadRecords() {
    records = (typeof SharedFormsAI !== 'undefined' && SharedFormsAI.listRecords) ? SharedFormsAI.listRecords() : [];
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
  // Số HSBT (ưu tiên) hoặc biển số xuất hiện trong yêu cầu → hồ sơ tương ứng (chỉ khi xác định được duy nhất).
  function detectRecord(text) {
    const haystack = compact(text);
    if (!haystack) return null;
    const byCode = index.filter(item => item.codeCompact.length >= 6 && haystack.includes(item.codeCompact));
    if (byCode.length) return byCode.length === 1 ? byCode[0] : (byCode.find(item => item.row.group === 'Hồ sơ tồn') || byCode[0]);
    const byPlate = index.filter(item => item.plateCompact.length >= 5 && haystack.includes(item.plateCompact));
    const pending = byPlate.filter(item => item.row.group === 'Hồ sơ tồn');
    return byPlate.length === 1 ? byPlate[0] : pending.length === 1 ? pending[0] : null;
  }
  const looksLikeRecordRef = text => /hsbt|\b\d{2}[a-z]{1,2}[-. ]?\d{3}[.]?\d{2}\b|\b\d{6,}\b/i.test(String(text || ''));
  const chosenRecord = () => index.find(item => item.row.key === st.recordKey) || null;
  const currentRecord = () => { const found = chosenRecord(); return found ? found.row.record : null; };
  const recordLabel = info => [info.plate, info.owner, info.code && 'HS ' + info.code].filter(Boolean).join(' · ') || 'Hồ sơ đã chọn';

  // Hồ sơ đọc được cho AI: nhóm có nhãn + nhận định tính sẵn + ghi chú tiến độ + hồ sơ khác cùng biển số.
  function dossierFor() {
    const found = chosenRecord();
    if (!found || typeof OfficialLetterDossier === 'undefined') return null;
    const D = OfficialLetterDossier, record = found.row.record || {}, id = found.row.key.split(':').slice(1).join(':');
    const notesStore = typeof cachedPendingNotesPayload !== 'undefined' && cachedPendingNotesPayload ? cachedPendingNotesPayload : {};
    const notes = Object.values((notesStore[D.notesKey(record, id)] || {}).history || {}).filter(note => note && typeof note === 'object');
    const plate = D.plateKey(record.bienSo);
    const sameCase = other => ['soHoSoBoiThuong', 'maVuTonThat'].some(key => record[key] && other[key] && String(record[key]).trim() === String(other[key]).trim())
      || (D.dayNumber(record.ngayTonThat || record.ngayVTT) && D.dayNumber(record.ngayTonThat || record.ngayVTT) === D.dayNumber(other.ngayTonThat || other.ngayVTT));
    const related = plate ? records.filter(row => row.key !== found.row.key && row.group === 'Hồ sơ tồn' && D.plateKey(row.record && row.record.bienSo) === plate && !sameCase(row.record)).map(row => row.record) : [];
    return D.build(record, {group: found.row.group, notes, related});
  }
  const dossierText = () => { const dossier = dossierFor(); return dossier && typeof OfficialLetterDossier !== 'undefined' ? OfficialLetterDossier.toText(dossier) : ''; };

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
  // which: 'files' (ô soạn đầu trang — AI đọc ở bước phân tích) hoặc 'refineFiles' (ô "Nhờ AI sửa" — AI đọc khi chỉnh bản hiện tại).
  function addFiles(list, which) {
    const bucket = which === 'refineFiles' ? 'refineFiles' : 'files';
    const picked = [...list].filter(file => /^image\//.test(file.type) || file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
    if (!picked.length) return;
    for (const file of picked) {
      if (st[bucket].length >= MAX_FILES) { toast('Chỉ nhận tối đa ' + MAX_FILES + ' tệp.', 'info'); break; }
      st[bucket].push({file, url: /^image\//.test(file.type) ? URL.createObjectURL(file) : ''});
    }
    updateFiles();
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

  function startValues() {
    const base = Core().prefillValues(template(), currentRecord(), loadIssuer());
    if (st.values) for (const [key, value] of Object.entries(st.values)) if (Core().single(value, 1)) base[key] = value; // giữ phần người dùng đã nhập
    return base;
  }

  // ---- Căn cứ pháp lý từ Thư viện tài liệu ----
  const Legal = () => (typeof OfficialLetterLegal !== 'undefined' ? OfficialLetterLegal : null);
  const activeSources = () => st.sources.filter(source => source.on !== false);
  async function findLegal(extraQueries) {
    const L = Legal(), tpl = template();
    if (!L || !tpl) return;
    const queries = L.buildQueries(tpl, dossierFor(), extraQueries, st.brief);
    if (!queries.length) { st.legalLoaded = true; st.legalError = ''; st.sources = st.sources.filter(source => source.manual); return; }
    const result = await L.retrieve(queries);
    st.legalLoaded = true; st.legalError = result.error;
    const offBefore = new Set(st.sources.filter(source => source.on === false).map(source => source.id));
    const found = result.sources.map(source => ({...source, on: !offBefore.has(source.id)}));
    const manual = st.sources.filter(source => source.manual && !found.some(item => item.id === source.id));   // đoạn người dùng tự tìm thì giữ
    st.sources = L.renumber(found.concat(manual));
  }
  async function searchMoreLegal() {
    const input = $('[data-ol-legal-q]');
    const query = input ? input.value.trim() : '';
    const L = Legal();
    if (!query || st.busy || !L) { if (input) input.focus(); return; }
    collectAll();
    const my = generation;
    setBusy('Đang tìm căn cứ…');
    try {
      const result = await L.retrieve([query], {limit: 4});
      if (my !== generation) return;
      const known = new Set(st.sources.map(source => source.id));
      const added = result.sources.filter(source => !known.has(source.id)).map(source => ({...source, manual: true}));
      st.sources = L.renumber(st.sources.concat(added).slice(0, 12));
      st.legalLoaded = true; if (result.error) st.legalError = result.error;
      st.open.legal = true;
      toast(result.error || (added.length ? 'Đã thêm ' + added.length + ' đoạn căn cứ.' : 'Không tìm thấy đoạn mới cho "' + query + '".'), result.error ? 'warning' : added.length ? 'success' : 'info');
    } finally { if (my === generation) { st.busy = ''; st.status = ''; renderAll(); } }
  }
  const legalPrompt = () => { const L = Legal(); return L ? L.promptBlock(activeSources()) : ''; };
  const citationChecks = () => { const L = Legal(); return L && st.letter ? L.verify(L.letterText(st.letter), activeSources()) : []; };

  const answeredList = () => st.questions.filter(item => item.answer).map(item => ({question: item.question, answer: item.answer}));
  const openQuestions = () => st.questions.filter(item => !item.answer).map(item => item.question + (item.options.length ? ' (phương án: ' + item.options.join(' / ') + ')' : ''));
  const defaultOutline = () => (template() ? template().outline : []).map(text => ({text, on: true}));

  // ---- Luồng chính ----
  function setBusy(status) { st.busy = 'run'; st.status = status; renderAll(); }
  // Trạng thái 3 bước hiển thị kiểu agent: idle | run | done | skip | err, kèm mô tả ngắn.
  function step(name, state, text) { if (!st.steps) st.steps = {}; st.steps[name] = {state, text: text || ''}; updateSteps(); }
  function setStatus(status) { st.status = status; const node = $('[data-ol-status]'); if (node) node.textContent = status; }
  // Đổi hồ sơ hoặc loại công văn → bỏ kết quả phân tích cũ (giữ bản thảo đang có cho tới khi soạn xong bản mới).
  function resetAnalysis() {
    st.values = null; st.filledByAI = []; st.questions = []; st.extras = []; st.outline = []; st.outlineEdited = false; st.understanding = ''; st.notes = '';
    st.insights = []; st.keyFacts = []; st.legalQueries = []; st.assumptions = []; st.sources = st.sources.filter(source => source.manual); st.legalError = ''; st.legalLoaded = false;
  }

  // Bấm "Soạn công văn": đọc hồ sơ + yêu cầu → tìm căn cứ → soạn. Không dừng hỏi; AI tự giả định và ghi lại.
  async function run() {
    if (st.busy) return;
    collectAll();
    st.brief = ($('[data-ol-brief]') || {value: st.brief}).value.trim();
    loadRecords();
    if (!st.recordKey) {
      const found = detectRecord(st.brief);
      if (found) { st.recordKey = found.row.key; toast('Đã tự nhận hồ sơ ' + recordLabel(found.info) + ' từ yêu cầu.', 'success'); }
    }
    if (!st.brief && !st.recordKey && !st.files.length) { notice('Hãy chọn hồ sơ hoặc ghi cần viết gì trước khi soạn.', 'warn'); renderAll(); $('[data-ol-brief]')?.focus(); return; }
    const missingRecord = !st.recordKey && looksLikeRecordRef(st.brief);
    const key = st.recordKey + '|' + templateId();
    if (key !== st.analyzedKey) resetAnalysis();
    st.analyzedKey = key;
    notice(missingRecord ? 'Không tìm thấy hồ sơ khớp số trong yêu cầu trên máy này — AI chỉ dựa vào nội dung bạn gõ. Bấm nút Hồ sơ để chọn.' : '', 'warn');
    const found = chosenRecord();
    st.editing = false; st.pop = '';
    st.steps = {read: {state: 'run', text: found ? recordLabel(found.info) : 'Không có hồ sơ'}, legal: {state: 'idle', text: ''}, write: {state: 'idle', text: ''}};
    const my = generation, tpl = template();
    setBusy('Đang đọc hồ sơ và yêu cầu…');
    try {
      try {
        const current = startValues();
        const files = [];
        for (const item of st.files) files.push(await prepareFile(item.file));
        const raw = await callAI(Core().buildAnalyzeRequest(tpl, {
          record: currentRecord() ? SharedFormsAI.describeRecord(currentRecord()) : {}, dossier: dossierText(), current, brief: st.brief, files,
          answered: answeredList(), mode: 'fast', extras: st.extras, outline: st.outlineEdited ? st.outline.filter(item => item.on).map(item => item.text) : undefined
        }));
        if (my !== generation) return;
        const analysis = Core().parseAnalysis(raw, tpl);
        const merged = Core().mergeAnalysis(tpl, current, analysis);
        st.values = merged.values; st.filledByAI = Array.from(new Set(st.filledByAI.concat(merged.filledByAI)));
        const kept = st.questions.filter(item => item.answer);
        const seen = new Set(kept.map(item => fold(item.question)));
        st.questions = kept.concat(analysis.questions.filter(item => !seen.has(fold(item.question))).map(item => ({...item, answer: ''})));
        const labels = new Set(st.extras.map(item => fold(item.label)));
        st.extras = st.extras.concat(analysis.extras.filter(item => !labels.has(fold(item.label))));
        if (!st.outlineEdited) st.outline = analysis.outline.length ? analysis.outline.map(text => ({text, on: true})) : defaultOutline();
        st.understanding = analysis.understanding; st.notes = analysis.notes;
        st.insights = analysis.insights; st.keyFacts = analysis.keyFacts; st.legalQueries = analysis.legalQueries; st.assumptions = analysis.assumptions;
      } catch (error) {
        if (my !== generation || error.name === 'AbortError') return;
        // Đọc lỗi vẫn soạn được từ dữ liệu hồ sơ + yêu cầu (bước soạn có toàn bộ hồ sơ).
        if (!st.values) st.values = startValues();
        if (!st.outline.length) st.outline = defaultOutline();
        notice('Bước đọc yêu cầu gặp lỗi (' + (error.message || 'không rõ') + '), vẫn soạn từ dữ liệu hồ sơ.', 'warn');
        step('read', 'err', 'Lỗi đọc — dùng dữ liệu sẵn có');
      }
      if (st.steps.read.state === 'run') step('read', 'done', st.steps.read.text);
      setStatus('Đang tìm căn cứ…'); step('legal', 'run', 'Đang tìm trong thư viện');
      await findLegal(st.legalQueries);
      if (my !== generation) return;
      step('legal', st.legalError ? 'err' : activeSources().length ? 'done' : 'skip', st.legalError ? 'Không đọc được thư viện' : activeSources().length ? activeSources().length + ' đoạn liên quan' : 'Không cần viện dẫn');
      setStatus('Đang soạn công văn…'); step('write', 'run', 'Đang viết');
      await composeCore('');
      step('write', 'done', 'Xong');
      saveHistory();
    } catch (error) {
      if (my !== generation || error.name === 'AbortError') return;
      notice(error.message || 'Không soạn được công văn.', 'error');
      if (st.steps) for (const name of ['read', 'legal', 'write']) if (st.steps[name] && st.steps[name].state === 'run') st.steps[name] = {state: 'err', text: 'Lỗi'};
    } finally { if (my === generation) { st.busy = ''; st.status = ''; renderAll(); } }
  }

  async function composeCore(instruction, attachments) {
    const tpl = template();
    const issuer = loadIssuer();
    const previous = instruction && st.letter ? st.letter.paragraphs.map(p => p.text).join('\n') : '';
    const brief = st.brief + (instruction ? '\nYÊU CẦU CHỈNH SỬA MỚI NHẤT: ' + instruction : '');
    const ctx = {outline: st.outline.filter(item => item.on).map(item => item.text).filter(text => Core().single(text, 1)), extras: st.extras, answers: answeredList(), understanding: st.understanding,
      keyFacts: st.keyFacts, insights: st.insights, dossier: dossierText(), legal: legalPrompt(), assumptions: st.assumptions, openQuestions: openQuestions(), files: attachments || []};
    const raw = await callAI(Core().buildComposeRequest(tpl, st.values, issuer, brief, previous, ctx));
    const parsed = Core().parseLetter(raw);
    const date = st.letter && st.letter.date, number = st.letter && st.letter.number;
    st.letter = Core().assembleLetter(tpl, st.values, issuer, parsed, date);
    if (number) st.letter.number = number;
    if (!st.notice || st.notice.kind !== 'warn') notice('');
  }

  // Soạn lại (sau khi sửa chi tiết) hoặc chỉnh theo yêu cầu — không đọc lại hồ sơ.
  async function compose(instruction) {
    if (st.busy) return;
    if (!st.values) { run(); return; }
    collectAll(); syncLetter();
    const my = generation;
    setBusy(instruction ? 'Đang chỉnh theo yêu cầu…' : 'Đang soạn lại…');
    const sent = instruction ? st.refineFiles.slice() : [];
    try {
      // Tệp kèm theo yêu cầu sửa: đọc/nén trước khi gửi; chỉ dùng cho lần sửa này.
      const attachments = [];
      for (const item of sent) attachments.push(await prepareFile(item.file));
      await composeCore(instruction || '', attachments);
      if (sent.length) { st.refineFiles = st.refineFiles.filter(item => !sent.includes(item)); releaseFiles(sent); }
      if (my !== generation) return;
      toast(instruction ? 'Đã chỉnh công văn theo yêu cầu.' : 'Đã soạn lại công văn.', 'success');
      saveHistory();
    } catch (error) {
      if (my !== generation || error.name === 'AbortError') return;
      notice(error.message || 'Không soạn được công văn.', 'error');
    } finally { if (my === generation) { st.busy = ''; st.status = ''; renderAll(); } }
  }

  // ---- Đọc lại phần người dùng đã sửa trên trang ----
  function collectValues() {
    if (!host || !st.values) return;
    host.querySelectorAll('[data-ol-field]').forEach(input => { st.values[input.dataset.olField] = input.value; });
  }
  function collectAll() {
    if (!host) return;
    const brief = $('[data-ol-brief]'); if (brief) st.brief = brief.value;
    collectValues();
    const rows = host.querySelectorAll('[data-ol-extra-row]');
    if (rows.length || $('[data-ol-block="fields"]')) st.extras = [...rows].map(row => ({label: row.querySelector('[data-ol-extra-label]').value, value: row.querySelector('[data-ol-extra-value]').value}));
    const outlineRows = host.querySelectorAll('[data-ol-outline-row]');
    if (outlineRows.length) st.outline = [...outlineRows].map(row => ({text: row.querySelector('[data-ol-outline-text]').value, on: row.querySelector('[data-ol-outline-on]').checked}));
    host.querySelectorAll('[data-ol-src-on]').forEach(box => { const source = st.sources[Number(box.dataset.olSrcOn)]; if (source) source.on = box.checked; });
    host.querySelectorAll('[data-ol-q-answer]').forEach(input => { const item = st.questions[Number(input.dataset.olQAnswer)]; if (item && input.value.trim()) item.answer = input.value.trim(); });
    syncLetter();
  }
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

  function sendRefine() {
    const input = $('[data-ol-refine-input]');
    if (!input || st.busy) return;
    // Chỉ đính kèm mà chưa gõ gì: mặc định nhờ AI đọc tài liệu rồi chỉnh công văn cho khớp.
    const text = input.value.trim() || (st.refineFiles.length ? 'Đọc tài liệu đính kèm và chỉnh công văn cho đúng với nội dung tài liệu.' : '');
    if (!text) { input.focus(); return; }
    input.value = '';
    compose(text);
  }

  // ---- Xuất ----
  async function downloadDocx() {
    if (!st.letter) return;
    if (typeof JSZip === 'undefined') { toast('Chưa tải được thư viện tạo Word. Kiểm tra mạng rồi thử lại.', 'warning'); return; }
    try {
      syncLetter();
      const unverified = citationChecks().filter(item => !item.ok).length;
      if (unverified) toast('Lưu ý: còn ' + unverified + ' căn cứ chưa kiểm chứng với thư viện — kiểm tra trước khi ký.', 'warning');
      const zip = new JSZip();
      Core().docxFiles(st.letter, st.letter.subject).forEach(file => zip.file(file.path, file.text));
      const blob = await zip.generateAsync({type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
      SharedFormsAI.saveBlob(blob, Core().fileBaseName(st.letter, st.values) + '.docx');
      const gaps = Core().countGaps(st.letter);
      toast(gaps ? 'Đã tải Word. Còn ' + gaps + ' chỗ "……" cần điền tay.' : 'Đã tải file Word.', gaps ? 'warning' : 'success');
      saveHistory();
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

  // ---- Lịch sử (OfficialLetterHistory: Firebase user_letters/{uid}, dự phòng trình duyệt) ----
  const History = () => (typeof OfficialLetterHistory !== 'undefined' ? OfficialLetterHistory : null);
  const HIST_PANEL_KEY = 'officialLetter.historyPanel.v1';
  function snapshot() {
    syncLetter();
    const found = chosenRecord();
    return {
      v: 1, brief: st.brief, recordKey: st.recordKey, recordLabel: found ? recordLabel(found.info) : st.savedRecordLabel, templateId: st.templateId,
      fileNames: st.files.map(item => item.file.name), letter: st.letter, values: st.values, filledByAI: st.filledByAI, questions: st.questions, extras: st.extras,
      outline: st.outline, outlineEdited: st.outlineEdited, understanding: st.understanding, notes: st.notes, insights: st.insights, keyFacts: st.keyFacts,
      legalQueries: st.legalQueries, assumptions: st.assumptions, legalError: st.legalError, legalLoaded: st.legalLoaded, analyzedKey: st.analyzedKey,
      sources: st.sources.slice(0, 12).map(source => ({...source, text: String(source.text || '').slice(0, 2000)})), steps: st.steps
    };
  }
  function restore(data) {
    reset();
    const list = value => Array.isArray(value) ? value : [];
    Object.assign(st, {
      brief: String(data.brief || ''), recordKey: index.some(item => item.row.key === data.recordKey) ? data.recordKey : '', savedRecordLabel: String(data.recordLabel || ''),
      templateId: Core().findTemplate(data.templateId) ? data.templateId : '', letter: data.letter ? Core().sanitizeLetter(data.letter) : null,
      values: data.values && typeof data.values === 'object' ? data.values : null, filledByAI: list(data.filledByAI), questions: list(data.questions), extras: list(data.extras),
      outline: list(data.outline), outlineEdited: !!data.outlineEdited, understanding: String(data.understanding || ''), notes: String(data.notes || ''),
      insights: list(data.insights), keyFacts: list(data.keyFacts), legalQueries: list(data.legalQueries), assumptions: list(data.assumptions),
      legalError: String(data.legalError || ''), legalLoaded: !!data.legalLoaded, analyzedKey: String(data.analyzedKey || ''), sources: list(data.sources),
      steps: data.steps && typeof data.steps === 'object' ? data.steps : null
    });
    if (st.letter && data.letter && data.letter.warnings) st.letter.warnings = list(data.letter.warnings);
  }
  let saveTimer = 0, session = 0;   // session tăng mỗi khi đổi sang công văn khác → lệnh lưu chạy nền của bản cũ không gắn nhầm id vào bản mới
  // Lưu phiên hiện tại vào lịch sử (tự động sau khi soạn/chỉnh, và khi sửa trên tờ — có hoãn).
  async function saveHistory() {
    clearTimeout(saveTimer);
    const H = History();
    if (!H || !st.letter) return;
    const mine = session;
    try {
      const data = snapshot(), tpl = template();
      const result = await H.save(st.historyId, {title: (st.letter.subject ? 'V/v ' + st.letter.subject : st.brief) || 'Công văn', sub: [data.recordLabel, tpl.id === DEFAULT_TEMPLATE ? '' : tpl.name].filter(Boolean).join(' · '), data});
      if (mine === session) st.historyId = result.id;
      st.histScope = result.scope; st.history = H.list();
      updateHistory();
    } catch (error) { toast('Chưa lưu được vào lịch sử: ' + (error.message || error), 'warning'); }
  }
  const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveHistory, 1500); };
  async function openHistory(id) {
    const H = History();
    if (!H || st.busy || id === st.historyId) return;
    clearTimeout(saveTimer);
    if (st.letter && st.historyId) await saveHistory();   // giữ chỉnh sửa của công văn đang mở
    const data = await H.get(id);
    if (!data) { toast('Không mở được công văn này (có thể đã bị xoá).', 'warning'); return; }
    loadRecords();
    restore(data);
    st.historyId = id;
    if (window.innerWidth < 1000) st.histOpen = false;
    renderAll();
  }
  async function deleteHistory(id) {
    const H = History();
    if (!H) return;
    const item = st.history.find(entry => entry.id === id);
    if (!window.confirm('Xoá "' + (item ? item.title : 'công văn này') + '" khỏi lịch sử?')) return;
    await H.remove(id);
    st.history = H.list();
    if (id === st.historyId) st.historyId = '';
    updateHistory();
  }

  // ================= HIỂN THỊ =================
  const TEMPLATE_HINTS = {
    de_nghi_cung_cap_ho_so: 'Đề nghị Công an huyện cung cấp biên bản tai nạn cho hồ sơ ',
    thong_bao_bo_sung_ho_so: 'Nhắc khách hàng bổ sung giấy tờ còn thiếu cho hồ sơ ',
    de_nghi_gara_cung_cap: 'Đề nghị gara gửi báo giá sửa chữa cho xe ',
    thong_bao_ket_qua_giam_dinh: 'Thông báo kết quả giám định và hướng giải quyết cho hồ sơ ',
    tu_choi_thong_so_lop: 'Từ chối bồi thường vì lốp lắp khác thông số tiêu chuẩn cho hồ sơ '
  };

  // ---- Ô yêu cầu kiểu agent ----
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
      : '<p class="ol-rec-empty">' + (index.length ? 'Không có hồ sơ khớp “' + esc(st.recQuery) + '”.' : 'Chưa có dữ liệu hồ sơ trên máy — mở trang Hồ sơ bồi thường một lần để tải.') + '</p>';
  }
  function popoverHtml() {
    if (st.pop === 'record') return '<div class="ola-pop" role="dialog" aria-label="Chọn hồ sơ"><label class="ol-rec-search">' + svg(ICON.search) + '<input type="search" data-ol-rec-q autocomplete="off" spellcheck="false" placeholder="Biển số, số HSBT, chủ xe…" value="' + esc(st.recQuery) + '" aria-label="Tìm hồ sơ"></label><div class="ol-rec-list" data-ol-rec-list role="listbox" aria-label="Hồ sơ"></div></div>';
    if (st.pop === 'type') return '<div class="ola-pop ola-pop--menu" role="menu" aria-label="Loại công văn">' + Core().templates().map(item => '<button type="button" role="menuitemradio" aria-checked="' + (item.id === templateId()) + '" data-ol-type="' + esc(item.id) + '"><b>' + esc(item.id === DEFAULT_TEMPLATE ? 'Tự do' : item.name) + '</b><small>' + esc(item.id === DEFAULT_TEMPLATE ? 'AI tự viết theo yêu cầu của bạn' : item.group) + '</small></button>').join('') + '</div>';
    return '';
  }
  function composerHtml(big) {
    const found = chosenRecord(), tpl = template();
    const recordChip = found
      ? '<span class="ola-chip is-set"><button type="button" data-ol-pop="record" title="Đổi hồ sơ">' + svg(ICON.folder) + esc(found.info.plate || found.info.code || 'Hồ sơ') + '</button><button type="button" class="ola-chip-x" data-ol-rec-clear aria-label="Bỏ hồ sơ">×</button></span>'
      : '<button type="button" class="ola-chip" data-ol-pop="record">' + svg(ICON.folder) + 'Hồ sơ</button>';
    const typeChip = '<button type="button" class="ola-chip' + (tpl.id !== DEFAULT_TEMPLATE ? ' is-set' : '') + '" data-ol-pop="type">' + svg(ICON.letter) + esc(tpl.id === DEFAULT_TEMPLATE ? 'Loại: Tự do' : tpl.name) + svg(ICON.chevron) + '</button>';
    return '<div class="ola-composer' + (big ? ' is-big' : '') + '">'
      + '<textarea data-ol-brief rows="' + (big ? 3 : 2) + '" maxlength="3000" placeholder="Mô tả công văn cần soạn… (gõ số HSBT hoặc biển số để AI tự lấy hồ sơ)" aria-label="Yêu cầu soạn công văn">' + esc(st.brief) + '</textarea>'
      + '<div class="tasco-ai-attachments ola-files" data-ol-file-list' + (st.files.length ? '' : ' hidden') + '>' + filesHtml() + '</div>'
      + '<div class="ola-bar"><label class="ola-icon-btn" title="Đính kèm ảnh/PDF"><input type="file" data-ol-files accept="image/*,application/pdf" multiple hidden>' + svg(ICON.attach) + '</label>'
      + recordChip + typeChip + '<span class="ola-spacer"></span>'
      + '<button type="button" class="tasco-ai-send" data-ol-act="run" title="Soạn công văn (Enter)" aria-label="Soạn công văn"' + (st.busy ? ' disabled' : '') + '>' + svg(ICON.send) + '</button></div>'
      + popoverHtml() + '</div>';
  }
  function filesHtml(which) {
    const bucket = which === 'refineFiles' ? 'refineFiles' : 'files';
    return st[bucket].map((item, i) => '<span class="tasco-ai-attach" title="' + esc(item.file.name) + '">' + (item.url ? '<img alt="" src="' + esc(item.url) + '">' : '<em>PDF</em>') + '<button type="button" data-ol-remove-file="' + i + '"' + (bucket === 'refineFiles' ? ' data-ol-bucket="refineFiles"' : '') + ' aria-label="Bỏ tệp ' + esc(item.file.name) + '">×</button></span>').join('');
  }
  function updateFiles() {
    if (!host) return;
    host.querySelectorAll('[data-ol-file-list]').forEach(box => {
      const bucket = box.dataset.olFileList === 'refine' ? 'refineFiles' : 'files';
      box.innerHTML = filesHtml(bucket); box.hidden = !st[bucket].length;
    });
  }

  function heroHtml() {
    const ideas = Core().templates().filter(item => TEMPLATE_HINTS[item.id]);
    return '<section class="ola-hero">'
      + '<span class="ola-avatar" aria-hidden="true">' + svg(ICON.spark) + '</span><h1>Hôm nay cần soạn công văn gì?</h1>'
      + (st.notice ? noticeHtml() : '')
      + composerHtml(true)
      + '<div class="ola-ideas">' + ideas.map(item => '<button type="button" class="tasco-ai-choice" data-ol-idea="' + esc(item.id) + '"><strong>' + esc(item.name) + '</strong><small>' + esc(item.group) + '</small></button>').join('') + '</div></section>';
  }

  // ---- Màn làm việc ----
  // Thanh tiến độ: một đường thẳng, 3 nút bước nằm trên đường; phần đã xong tô màu, đoạn đang chạy có hiệu ứng.
  const STEP_NAMES = ['read', 'legal', 'write'];
  const STEP_LABEL = {read: 'Đọc hồ sơ & yêu cầu', legal: 'Căn cứ pháp lý', write: 'Soạn công văn'};
  function stepState() {
    const steps = st.steps || {read: {state: 'done', text: ''}, legal: {state: 'done', text: ''}, write: {state: 'done', text: ''}};
    const list = STEP_NAMES.map(name => ({name, ...(steps[name] || {state: 'idle', text: ''})}));
    const current = list.findIndex(item => item.state === 'run' || item.state === 'idle');
    // Tỷ lệ đường đã tô: tới nút đang chạy (giữa các nút = 0%, 50%, 100%); xong hết = 100%.
    const progress = current < 0 ? 100 : current * 50;
    return {list, progress, running: list.some(item => item.state === 'run')};
  }
  function stepsInner(list) {
    const mark = state => state === 'run' ? '<span class="olp-spinner"></span>' : state === 'done' ? '✓' : state === 'skip' ? '–' : state === 'err' ? '!' : '';
    return list.map(item => '<li class="is-' + item.state + '"><span class="ola-step-mark">' + mark(item.state) + '</span><b>' + STEP_LABEL[item.name] + '</b>' + (item.text ? '<small>' + esc(item.text) + '</small>' : '') + '</li>').join('');
  }
  function stepsHtml() {
    const {list, progress, running} = stepState();
    return '<div class="ola-progress' + (running ? ' is-running' : '') + '" data-ol-steps style="--p:' + progress + '%" role="group" aria-label="Tiến độ soạn công văn"><div class="ola-track" aria-hidden="true"><span class="ola-fill"></span></div><ol>' + stepsInner(list) + '</ol></div>';
  }
  // Cập nhật tại chỗ để đường tiến độ chạy mượt (không dựng lại phần tử).
  function updateSteps() {
    const node = $('[data-ol-steps]');
    if (!node) return;
    const {list, progress, running} = stepState();
    node.style.setProperty('--p', progress + '%');
    node.classList.toggle('is-running', running);
    node.querySelector('ol').innerHTML = stepsInner(list);
  }
  function noticeHtml() { return st.notice ? '<div class="olp-notice olp-notice--' + esc(st.notice.kind) + '" role="' + (st.notice.kind === 'error' ? 'alert' : 'status') + '">' + esc(st.notice.text) + '</div>' : ''; }
  function requestHtml() {
    const found = chosenRecord(), tpl = template();
    if (st.editing) return '<section class="ola-request is-editing">' + composerHtml(false) + '<button type="button" class="ol-link" data-ol-act="cancel-edit">Huỷ</button></section>';
    return '<section class="ola-request"><div class="ola-ask"><p>' + esc(st.brief || 'Soạn công văn từ hồ sơ') + '</p><div class="ola-tags">'
      + (found ? '<span>' + svg(ICON.folder) + esc(recordLabel(found.info)) + '</span>' : '') + '<span>' + svg(ICON.letter) + esc(tpl.id === DEFAULT_TEMPLATE ? 'Tự do' : tpl.name) + '</span>' + (st.files.length ? '<span>' + svg(ICON.attach) + st.files.length + ' tệp</span>' : '') + '</div></div>'
      + '<div class="ola-request-acts"><button type="button" class="olp-tool" data-ol-act="edit"' + (st.busy ? ' disabled' : '') + '>Sửa yêu cầu</button><button type="button" class="olp-tool" data-ol-act="new"' + (st.busy ? ' disabled' : '') + '>' + svg(ICON.plus) + 'Công văn mới</button></div></section>';
  }

  // Cột ghi chú: ngắn, chỉ những gì cần người dùng để ý.
  function citationsHtml() {
    if (!st.letter || !Legal()) return '';
    const checks = citationChecks(), byCode = new Map(st.sources.map(source => [source.code, source]));
    if (!checks.length) return '';
    return '<div class="ola-note-block"><h3>Căn cứ trong công văn</h3><ul class="ola-cites">' + checks.map(item => item.ok
      ? '<li class="is-ok" title="' + esc(item.codes.map(code => byCode.get(code)).filter(Boolean).map(source => source.doc + ' – ' + source.title).join('; ')) + '">✓ ' + esc(item.mention) + '</li>'
      : '<li class="is-bad" title="Không có trong căn cứ đã chọn từ thư viện">⚠ ' + esc(item.mention) + '<small>Không có trong thư viện — kiểm tra lại</small></li>').join('') + '</ul></div>';
  }
  let citeTimer = 0;
  function refreshCitations() {
    clearTimeout(citeTimer);
    citeTimer = setTimeout(() => { const box = $('[data-ol-citations]'); if (!box || !st.letter) return; syncLetter(); box.innerHTML = citationsHtml(); const gap = $('[data-ol-gaps]'); if (gap) gap.innerHTML = gapsHtml(); }, 400);
  }
  function gapsHtml() { const gaps = st.letter ? Core().countGaps(st.letter) : 0; return gaps ? '<div class="ola-note-block is-warn"><h3>Còn ' + gaps + ' chỗ “……”</h3><p>Phần tô vàng trên tờ — nhấp để điền.</p></div>' : ''; }
  function notesRail() {
    if (!st.letter) return '';
    const dossier = dossierFor();
    const warns = (dossier ? dossier.facts : []).filter(fact => fact.level === 'warn').slice(0, 3);
    const open = st.questions.map((item, i) => ({item, i})).filter(({item}) => !item.answer && item.options.length);
    return '<aside class="ola-rail" aria-label="Ghi chú của AI">'
      + '<div data-ol-gaps>' + gapsHtml() + '</div><div data-ol-citations>' + citationsHtml() + '</div>'
      + (open.length ? '<div class="ola-note-block"><h3>Chọn nhanh</h3>' + open.map(({item, i}) => '<p class="ola-q">' + esc(item.question) + '</p><div class="tasco-ai-chiprow">' + item.options.map((option, j) => '<button type="button" class="tasco-ai-chip" data-ol-fix="' + i + '|' + j + '"' + (st.busy ? ' disabled' : '') + '>' + esc(option) + '</button>').join('') + '</div>').join('') + '</div>' : '')
      + (st.assumptions.length ? '<div class="ola-note-block"><h3>AI đã giả định</h3><ul>' + st.assumptions.map(text => '<li>' + esc(text) + '</li>').join('') + '</ul></div>' : '')
      + (st.letter.warnings.length ? '<div class="ola-note-block"><h3>Nên kiểm tra</h3><ul>' + st.letter.warnings.map(text => '<li>' + esc(text) + '</li>').join('') + '</ul></div>' : '')
      + (warns.length ? '<div class="ola-note-block is-warn"><h3>Lưu ý từ hồ sơ</h3><ul>' + warns.map(fact => '<li>' + esc(fact.text) + '</li>').join('') + '</ul></div>' : '')
      + '<button type="button" class="ola-more" data-ol-drawer="fields">Xem chi tiết: thông tin, dàn ý, căn cứ, hồ sơ →</button></aside>';
  }
  function documentHtml() {
    if (!st.letter) return '<div class="ola-doc is-pending"><div class="olp-skeleton" aria-hidden="true">' + '<i></i>'.repeat(10) + '</div><div class="olp-busy" role="status"><span class="olp-spinner"></span><span data-ol-status>' + esc(st.status || 'Đang soạn…') + '</span></div></div>';
    return '<div class="ola-doc' + (st.busy ? ' is-busy' : '') + '"><div class="ola-doc-bar"><label class="ol-datepick">Ngày <input type="date" data-ol-date value="' + esc(st.letter.date) + '"></label>'
      + '<button type="button" class="olp-tool is-primary" data-ol-act="docx">' + svg(ICON.word) + 'Tải Word</button><button type="button" class="olp-tool" data-ol-act="print" title="In">' + svg(ICON.print) + '</button><button type="button" class="olp-tool" data-ol-act="copy" title="Sao chép nội dung">' + svg(ICON.copy) + '</button></div>'
      + (st.busy ? '<div class="olp-busy" role="status"><span class="olp-spinner"></span><span data-ol-status>' + esc(st.status) + '</span></div>' : '')
      + '<div class="ol-paper-wrap">' + Core().letterToHtml(st.letter) + '</div></div>';
  }
  const REFINES = ['Viết ngắn gọn hơn', 'Giọng trang trọng hơn', 'Thêm hạn phản hồi 07 ngày làm việc'];
  function refineHtml() {
    if (!st.letter) return '';
    return '<div class="ola-refine"><div class="tasco-ai-attachments ola-files" data-ol-file-list="refine"' + (st.refineFiles.length ? '' : ' hidden') + '>' + filesHtml('refineFiles') + '</div>'
      + '<div class="tasco-ai-suggest">' + REFINES.map(text => '<button type="button" class="tasco-ai-suggest__chip" data-ol-refine="' + esc(text) + '"' + (st.busy ? ' disabled' : '') + '>' + esc(text) + '</button>').join('') + '</div>'
      + '<div class="tasco-ai-composer ola-refine-box"><label class="ola-icon-btn' + (st.busy ? ' is-disabled' : '') + '" title="Đính kèm ảnh/PDF để AI đọc khi sửa"><input type="file" data-ol-files="refine" accept="image/*,application/pdf" multiple hidden' + (st.busy ? ' disabled' : '') + '>' + svg(ICON.attach) + '</label><input class="tasco-ai-input" data-ol-refine-input maxlength="600" placeholder="Nhờ AI sửa: “gửi Phòng CSGT tỉnh”, “nêu thêm ngày tổn thất”… (có thể đính kèm tài liệu)" aria-label="Yêu cầu chỉnh sửa"' + (st.busy ? ' disabled' : '') + '>'
      + '<button type="button" class="tasco-ai-send" data-ol-act="refine" aria-label="Gửi yêu cầu chỉnh sửa"' + (st.busy ? ' disabled' : '') + '>' + svg(ICON.send) + '</button></div></div>';
  }
  function workHtml() {
    // Vùng nội dung cuộn riêng; ô "Nhờ AI sửa" ghim cố định ở đáy, không trôi theo và không đè tờ công văn.
    return '<div class="ola-work"><div class="ola-scroll" data-ol-scroll><div class="ola-scroll-inner">' + requestHtml() + stepsHtml() + noticeHtml()
      + '<div class="ola-stage">' + documentHtml() + notesRail() + '</div></div></div>' + refineHtml() + '</div>';
  }

  // ---- Ngăn chi tiết ----
  function fieldInput(field, value) {
    const common = ' data-ol-field="' + esc(field.key) + '" maxlength="' + (field.max || 500) + '"';
    return field.type === 'textarea' ? '<textarea' + common + ' rows="3">' + esc(value) + '</textarea>' : '<input' + common + ' value="' + esc(value) + '"' + (field.type === 'date' ? ' placeholder="dd/mm/yyyy"' : '') + '>';
  }
  const missingText = missing => missing.length ? 'Còn trống: ' + missing.map(item => item.label).join(', ') + ' — công văn để “……”.' : 'Đã đủ thông tin bắt buộc.';
  const extraRowHtml = item => '<div class="ol-extra-row" data-ol-extra-row><input data-ol-extra-label maxlength="80" placeholder="Tên thông tin" value="' + esc(item.label) + '" aria-label="Tên thông tin"><input data-ol-extra-value maxlength="400" placeholder="Nội dung" value="' + esc(item.value) + '" aria-label="Nội dung"><button type="button" class="ol-x" data-ol-act="remove-extra" aria-label="Xóa dòng" title="Xóa dòng">' + svg(ICON.close) + '</button></div>';
  function fieldsBody() {
    const tpl = template();
    const missing = Core().missingFields(tpl, st.values);
    return '<div data-ol-block="fields"><div class="ol-form">' + tpl.fields.map(field => {
        const flag = field.required && !Core().single(st.values[field.key], 1);
        return '<label class="ol-field is-wide' + (flag ? ' is-missing' : '') + '" data-ol-wrap="' + esc(field.key) + '"><span>' + esc(field.label) + (field.required ? ' <b title="Bắt buộc">*</b>' : '')
          + (st.filledByAI.includes(field.key) ? ' <em class="ol-ai-tag">AI điền</em>' : '') + '</span>' + fieldInput(field, st.values[field.key]) + '</label>';
      }).join('') + '</div>'
      + '<div class="ol-extras"><b>Thông tin bổ sung</b>' + st.extras.map(item => extraRowHtml(item)).join('') + '<button type="button" class="ol-add" data-ol-act="add-extra">+ Thêm</button></div>'
      + '<p class="' + (missing.length ? 'ol-warn' : 'ol-ok') + '" data-ol-missing>' + esc(missingText(missing)) + '</p></div>';
  }
  function outlineBody() {
    return '<div class="ol-outline">' + st.outline.map(item => '<div class="ol-outline-row" data-ol-outline-row><input type="checkbox" data-ol-outline-on' + (item.on ? ' checked' : '') + ' aria-label="Dùng ý này"><input class="ol-outline-text" data-ol-outline-text maxlength="300" value="' + esc(item.text) + '" aria-label="Nội dung ý"><button type="button" class="ol-x" data-ol-act="remove-outline" aria-label="Xóa ý" title="Xóa ý">' + svg(ICON.close) + '</button></div>').join('')
      + '</div><button type="button" class="ol-add" data-ol-act="add-outline">+ Thêm ý</button>';
  }
  function legalBody() {
    const L = Legal();
    const lib = typeof TascoLibrary !== 'undefined' && TascoLibrary.open ? ' <button type="button" class="ol-link" data-ol-act="open-library">Mở Thư viện tài liệu</button>' : '';
    const rows = st.sources.map((source, i) => '<div class="ol-src' + (source.on === false ? ' is-off' : '') + '"><label class="ol-src-head"><input type="checkbox" data-ol-src-on="' + i + '"' + (source.on === false ? '' : ' checked') + ' aria-label="Dùng căn cứ ' + esc(source.code) + '">'
      + '<span class="ol-src-code">' + esc(source.code) + '</span><span class="ol-src-main"><b>' + esc(source.doc) + (source.soHieu && !fold(source.doc).includes(fold(source.soHieu)) ? ' <small>(' + esc(source.soHieu) + ')</small>' : '') + '</b><small>' + esc(source.title) + '</small></span></label>'
      + '<details class="ol-src-text"><summary>Nguyên văn</summary><p>' + esc(String(source.text).slice(0, 1800)) + '</p>' + (source.link ? '<a href="' + esc(source.link) + '" target="_blank" rel="noopener noreferrer">Mở văn bản gốc</a>' : '') + '</details></div>').join('');
    const status = st.legalError ? '<p class="ol-warn">' + esc(st.legalError) + lib + '</p>'
      : !st.sources.length ? '<p class="olp-hint">' + (L.needsBasis(template(), st.brief) ? 'Không có đoạn nào trong thư viện khớp đúng vấn đề.' : 'Loại công văn này không cần viện dẫn điều luật.') + lib + '</p>' : '';
    return status + (rows ? '<div class="ol-srcs">' + rows + '</div>' : '')
      + '<div class="ol-legal-search"><input data-ol-legal-q maxlength="160" placeholder="Tìm căn cứ, VD: thời hạn giải quyết bồi thường" aria-label="Tìm căn cứ"><button type="button" class="olp-tool" data-ol-act="legal-search">Tìm</button></div>';
  }
  function dossierBody() {
    const dossier = dossierFor();
    if (!dossier) return '<p class="olp-hint">Chưa có hồ sơ — AI chỉ dựa vào yêu cầu và tệp đính kèm.</p>';
    const warnFirst = list => list.filter(item => item.level === 'warn').concat(list.filter(item => item.level !== 'warn'));
    const li = item => '<li class="ol-fact ol-fact--' + (item.level === 'warn' ? 'warn' : 'info') + '">' + esc(item.text) + '</li>';
    return (st.understanding ? '<p class="ol-note">' + esc(st.understanding) + '</p>' : '')
      + (dossier.facts.length ? '<ul class="ol-facts">' + warnFirst(dossier.facts).map(li).join('') + '</ul>' : '')
      + (st.insights.length ? '<p class="ol-dos-h">AI nhận định</p><ul class="ol-facts">' + warnFirst(st.insights).map(li).join('') + '</ul>' : '')
      + dossier.sections.map(section => '<div class="ol-dos-sec"><h5>' + esc(section.title) + '</h5><dl>' + section.rows.map(([label, value]) => '<dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd>').join('') + '</dl></div>').join('');
  }
  function drawerHtml() {
    if (!st.drawer || !st.values) return '';
    const tabs = [['fields', 'Thông tin'], ['outline', 'Dàn ý'], ['legal', 'Căn cứ'], ['dossier', 'Hồ sơ']].filter(([name]) => name !== 'legal' || Legal());
    const body = {fields: fieldsBody, outline: outlineBody, legal: legalBody, dossier: dossierBody}[st.drawer] || fieldsBody;
    return '<div class="ola-drawer-backdrop" data-ol-drawer-close></div><aside class="ola-drawer" role="dialog" aria-label="Chi tiết công văn"><header><div class="ola-tabs" role="tablist">'
      + tabs.map(([name, label]) => '<button type="button" role="tab" aria-selected="' + (st.drawer === name) + '" data-ol-drawer="' + name + '">' + label + '</button>').join('')
      + '</div><button type="button" class="ol-x" data-ol-drawer-close aria-label="Đóng">' + svg(ICON.close) + '</button></header><div class="ola-drawer-body">' + body() + '</div>'
      + (st.drawer === 'dossier' ? '' : '<footer><button type="button" class="olp-tool is-primary" data-ol-act="compose"' + (st.busy ? ' disabled' : '') + '>Soạn lại theo chi tiết này</button></footer>') + '</aside>';
  }

  // ---- Thanh lịch sử bên trái ----
  function historyItemsHtml() {
    const H = History();
    if (!H) return '';
    const query = fold(st.histQuery).trim();
    const items = st.history.filter(item => !query || fold(item.title + ' ' + item.sub).includes(query));
    if (!items.length) return '<p class="ola-hist-empty">' + (query ? 'Không có công văn khớp “' + esc(st.histQuery) + '”.' : 'Chưa có công văn nào. Công văn soạn xong sẽ tự lưu ở đây.') + '</p>';
    const time = ms => { const d = new Date(ms), now = new Date(); const p = n => String(n).padStart(2, '0'); return d.toDateString() === now.toDateString() ? p(d.getHours()) + ':' + p(d.getMinutes()) : p(d.getDate()) + '/' + p(d.getMonth() + 1); };
    return H.groups(items).map(group => '<div class="ola-hist-group"><h4>' + esc(group.label) + '</h4>' + group.items.map(item => '<div class="ola-hist-item' + (item.id === st.historyId ? ' is-active' : '') + '"><button type="button" data-ol-hist-open="' + esc(item.id) + '" title="' + esc(item.title) + '"><b>' + esc(item.title) + '</b><small>' + esc([item.sub, time(item.updatedAt)].filter(Boolean).join(' · ')) + '</small></button>'
      + '<button type="button" class="ola-hist-del" data-ol-hist-del="' + esc(item.id) + '" aria-label="Xoá khỏi lịch sử" title="Xoá">' + svg(ICON.trash) + '</button></div>').join('') + '</div>').join('');
  }
  function historyHtml() {
    if (!History() || !st.histOpen) return '';
    return '<div class="ola-hist-backdrop" data-ol-hist-backdrop></div><aside class="ola-hist" aria-label="Lịch sử công văn"><header><b>' + svg(ICON.history) + 'Lịch sử</b><span>'
      + '<button type="button" class="ola-hist-btn" data-ol-act="new" title="Công văn mới" aria-label="Công văn mới"' + (st.busy ? ' disabled' : '') + '>' + svg(ICON.plus) + '</button>'
      + '<button type="button" class="ola-hist-btn" data-ol-act="hist-toggle" title="Thu gọn" aria-label="Thu gọn lịch sử">' + svg(ICON.panel) + '</button></span></header>'
      + '<label class="ola-hist-search">' + svg(ICON.search) + '<input type="search" data-ol-hist-q placeholder="Tìm công văn…" value="' + esc(st.histQuery) + '" aria-label="Tìm trong lịch sử"></label>'
      + '<div class="ola-hist-list" data-ol-hist-list>' + historyItemsHtml() + '</div>'
      + '<footer>' + (st.histScope === 'account' ? 'Lưu theo tài khoản' : 'Lưu trên trình duyệt này') + '</footer></aside>';
  }
  function updateHistory(listOnly) {
    const box = $('[data-ol-hist-list]');
    if (!box) return;
    box.innerHTML = historyItemsHtml();
    if (!listOnly) { const foot = $('.ola-hist footer'); if (foot) foot.textContent = st.histScope === 'account' ? 'Lưu theo tài khoản' : 'Lưu trên trình duyệt này'; }
  }

  function renderAll() {
    if (!host) return;
    const root = $('[data-ol-root]');
    const active = document.activeElement, focusSel = active && host.contains(active) ? (active.matches('[data-ol-rec-q]') ? '[data-ol-rec-q]' : active.matches('[data-ol-brief]') ? '[data-ol-brief]' : '') : '';
    const working = !!(st.letter || (st.busy && st.steps));
    const scrollBox = $('[data-ol-scroll]'), scrollTop = scrollBox ? scrollBox.scrollTop : 0;
    const histScroll = $('[data-ol-hist-list]'), histTop = histScroll ? histScroll.scrollTop : 0;
    root.innerHTML = historyHtml() + '<div class="ola-main' + (working ? ' is-working' : '') + '">' + (st.histOpen ? '' : '<button type="button" class="ola-hist-open" data-ol-act="hist-toggle" title="Mở lịch sử" aria-label="Mở lịch sử">' + svg(ICON.history) + '<span>Lịch sử</span></button>')
      + (working ? workHtml() : heroHtml())
      + '<button type="button" class="ola-gear" data-ol-act="settings" title="Thông tin đơn vị ban hành" aria-label="Thông tin đơn vị ban hành">' + svg(ICON.gear) + '</button></div>' + drawerHtml();
    const nextHist = $('[data-ol-hist-list]'); if (nextHist) nextHist.scrollTop = histTop;
    root.classList.toggle('is-working', working);
    root.classList.toggle('has-history', st.histOpen);
    fitHeight();
    const nextScroll = $('[data-ol-scroll]'); if (nextScroll) nextScroll.scrollTop = scrollTop;
    const brief = $('[data-ol-brief]'); if (brief) autoGrow(brief);
    if (st.pop === 'record') { updateRecList(); $('[data-ol-rec-q]')?.focus(); }
    else if (focusSel) $(focusSel)?.focus();
  }
  // Màn làm việc chiếm đúng phần còn lại của cửa sổ (từ mép trên trang tới đáy) để ô chỉnh sửa ghim ở đáy.
  function fitHeight() {
    const root = $('[data-ol-root]');
    if (!root) return;
    const top = root.getBoundingClientRect().top + (window.scrollY || 0);
    root.style.setProperty('--ola-top', Math.max(0, Math.round(top)) + 'px');
    root.style.setProperty('--ola-gap', '14px');
    // Khung app có phần đệm dưới → trừ thêm đúng phần làm trang bị cuộn, để chỉ vùng nội dung cuộn.
    const page = document.scrollingElement || document.documentElement;
    const extra = page.scrollHeight - window.innerHeight;
    if (extra > 0) root.style.setProperty('--ola-gap', (14 + extra) + 'px');
  }
  function autoGrow(area) { area.style.height = 'auto'; area.style.height = Math.min(area.scrollHeight, 260) + 'px'; }
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
    if (line) { line.className = missing.length ? 'ol-warn' : 'ol-ok'; line.textContent = missingText(missing); }
  }

  // ---- Cài đặt đơn vị ban hành ----
  function openSettings() {
    const issuer = loadIssuer();
    const dialog = document.createElement('dialog');
    dialog.className = 'ol-dialog';
    const rows = [['parent', 'Tên công ty'], ['unit', 'Chi nhánh / đơn vị'], ['shortName', 'Tên gọi tắt'], ['place', 'Địa danh ghi ở ngày tháng'], ['signerTitle', 'Chức danh người ký'], ['signerName', 'Họ tên người ký (có thể để trống)'], ['contactPerson', 'Cán bộ liên hệ mặc định'], ['phone', 'Số điện thoại liên hệ'], ['address', 'Địa chỉ nhận hồ sơ']];
    dialog.innerHTML = '<form method="dialog"><h2>Thông tin đơn vị ban hành</h2><p class="olp-hint">Lưu trên máy này, dùng cho mọi công văn.</p>'
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

  function reset() {
    session++;
    generation++; controller?.abort(); controller = null;
    resetAnalysis();
    releaseFiles(st.files); releaseFiles(st.refineFiles);
    Object.assign(st, {templateId: '', recordKey: '', recQuery: '', recOpen: false, recActive: 0, brief: '', files: [], refineFiles: [], sources: [], letter: null, analyzedKey: '', busy: '', status: '', notice: null, open: {}, pop: '', drawer: '', editing: false, steps: null, historyId: '', savedRecordLabel: ''});
  }
  const confirmDiscard = () => !(st.values || st.letter) || window.confirm('Bỏ công văn đang soạn để bắt đầu công văn mới?');

  // ---- Sự kiện ----
  function closePop() { if (!st.pop) return; collectAll(); st.pop = ''; st.recQuery = ''; renderAll(); }
  function onClick(event) {
    const target = event.target;
    const histDel = target.closest('[data-ol-hist-del]');
    if (histDel) { event.stopPropagation(); deleteHistory(histDel.dataset.olHistDel); return; }
    const histOpen = target.closest('[data-ol-hist-open]');
    if (histOpen) { openHistory(histOpen.dataset.olHistOpen); return; }
    if (target.closest('[data-ol-hist-backdrop]')) { st.histOpen = false; renderAll(); return; }
    const popButton = target.closest('[data-ol-pop]');
    if (popButton) { collectAll(); const name = popButton.dataset.olPop; st.pop = st.pop === name ? '' : name; st.recQuery = ''; st.recActive = 0; if (st.pop === 'record' && !index.length) loadRecords(); renderAll(); return; }
    const pick = target.closest('[data-ol-pick]');
    if (pick) { collectAll(); st.recordKey = pick.dataset.olPick; st.pop = ''; st.recQuery = ''; renderAll(); $('[data-ol-brief]')?.focus(); return; }
    const type = target.closest('[data-ol-type]');
    if (type) { collectAll(); st.templateId = type.dataset.olType; st.pop = ''; renderAll(); $('[data-ol-brief]')?.focus(); return; }
    if (target.closest('[data-ol-rec-clear]')) { collectAll(); st.recordKey = ''; renderAll(); return; }
    if (st.pop && !target.closest('.ola-pop')) { closePop(); }
    const idea = target.closest('[data-ol-idea]');
    if (idea) {
      collectAll(); st.templateId = idea.dataset.olIdea;
      const found = chosenRecord(), hint = TEMPLATE_HINTS[st.templateId] || '';
      if (!st.brief.trim()) st.brief = hint + (found ? (found.info.code || found.info.plate) : '');
      renderAll();
      const area = $('[data-ol-brief]'); if (area) { area.focus(); area.setSelectionRange(area.value.length, area.value.length); }
      return;
    }
    const removeFile = target.closest('[data-ol-remove-file]');
    if (removeFile) { const [gone] = st[removeFile.dataset.olBucket === 'refineFiles' ? 'refineFiles' : 'files'].splice(Number(removeFile.dataset.olRemoveFile), 1); if (gone) releaseFiles([gone]); updateFiles(); return; }
    const refine = target.closest('[data-ol-refine]');
    if (refine) { compose(refine.dataset.olRefine); return; }
    const fix = target.closest('[data-ol-fix]');
    if (fix && !st.busy) {
      const [i, j] = fix.dataset.olFix.split('|').map(Number), item = st.questions[i];
      if (item && item.options[j]) { item.answer = item.options[j]; if (item.key && st.values) st.values[item.key] = item.options[j]; compose(item.question + ' → ' + item.options[j]); }
      return;
    }
    const drawerTab = target.closest('[data-ol-drawer]');
    if (drawerTab) { collectAll(); st.drawer = drawerTab.dataset.olDrawer; renderAll(); return; }
    if (target.closest('[data-ol-drawer-close]')) { collectAll(); st.drawer = ''; renderAll(); return; }
    const act = target.closest('[data-ol-act]');
    if (!act) return;
    switch (act.dataset.olAct) {
      case 'run': run(); break;
      case 'compose': st.drawer = ''; compose(''); break;
      case 'refine': sendRefine(); break;
      case 'edit': st.editing = true; renderAll(); $('[data-ol-brief]')?.focus(); break;
      case 'cancel-edit': collectAll(); st.editing = false; st.pop = ''; renderAll(); break;
      case 'docx': downloadDocx(); break;
      case 'print': printLetter(); break;
      case 'copy': copyText(); break;
      case 'settings': openSettings(); break;
      case 'legal-search': searchMoreLegal(); break;
      case 'open-library': TascoLibrary.open(); break;
      case 'new': if (st.letter) { clearTimeout(saveTimer); if (st.historyId) saveHistory(); reset(); renderAll(); $('[data-ol-brief]')?.focus(); } else if (confirmDiscard()) { reset(); renderAll(); $('[data-ol-brief]')?.focus(); } break;
      case 'hist-toggle': st.histOpen = !st.histOpen; try { localStorage.setItem(HIST_PANEL_KEY, st.histOpen ? '1' : '0'); } catch (_) { /* bỏ qua */ } renderAll(); break;
      case 'add-extra': collectAll(); st.extras.push({label: '', value: ''}); renderAll(); host.querySelector('[data-ol-extra-row]:last-of-type [data-ol-extra-label]')?.focus(); break;
      case 'remove-extra': { collectAll(); const rows = [...host.querySelectorAll('[data-ol-extra-row]')]; st.extras.splice(rows.indexOf(act.closest('[data-ol-extra-row]')), 1); renderAll(); break; }
      case 'add-outline': collectAll(); st.outline.push({text: '', on: true}); st.outlineEdited = true; renderAll(); host.querySelector('[data-ol-outline-row]:last-of-type [data-ol-outline-text]')?.focus(); break;
      case 'remove-outline': { collectAll(); const rows = [...host.querySelectorAll('[data-ol-outline-row]')]; st.outline.splice(rows.indexOf(act.closest('[data-ol-outline-row]')), 1); st.outlineEdited = true; renderAll(); break; }
      default: break;
    }
  }
  function onInput(event) {
    const target = event.target;
    if (target.matches('[data-ol-rec-q]')) { st.recQuery = target.value; st.recActive = 0; updateRecList(); }
    else if (target.matches('[data-ol-hist-q]')) { st.histQuery = target.value; updateHistory(true); }
    else if (target.matches('[data-ol-brief]')) { st.brief = target.value; autoGrow(target); }
    else if (target.matches('[data-ol-field]')) updateMissingLive();
    else if (target.matches('[data-ol-outline-text]')) st.outlineEdited = true;
    else if (target.closest && target.closest('.ol-paper')) { refreshCitations(); saveSoon(); }
  }
  function onChange(event) {
    const target = event.target;
    if (target.matches('[data-ol-files]')) { addFiles(target.files, target.dataset.olFiles === 'refine' ? 'refineFiles' : 'files'); target.value = ''; }
    else if (target.matches('[data-ol-outline-on]')) st.outlineEdited = true;
    else if (target.matches('[data-ol-src-on]')) { const source = st.sources[Number(target.dataset.olSrcOn)]; if (source) { source.on = target.checked; target.closest('.ol-src').classList.toggle('is-off', !target.checked); } }
    else if (target.matches('[data-ol-date]') && /^\d{4}-\d{2}-\d{2}$/.test(target.value)) { syncLetter(); st.letter.date = target.value; renderAll(); saveSoon(); }
  }
  function onKeydown(event) {
    const target = event.target;
    if (!target.matches) return;
    if (event.key === 'Escape') { if (st.pop) { event.preventDefault(); closePop(); return; } if (st.drawer) { collectAll(); st.drawer = ''; renderAll(); return; } }
    if (target.matches('.ol-edit') && event.key === 'Enter') { event.preventDefault(); return; } // mỗi khối là một dòng/đoạn
    if (target.matches('[data-ol-brief]') && event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); run(); return; }
    if (target.matches('[data-ol-refine-input]') && event.key === 'Enter' && !event.isComposing) { event.preventDefault(); sendRefine(); return; }
    if (target.matches('[data-ol-legal-q]') && event.key === 'Enter' && !event.isComposing) { event.preventDefault(); searchMoreLegal(); return; }
    if (target.matches('[data-ol-rec-q]')) {
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
    if (!target.matches) return;
    if (target.matches('.ol-edit')) { // dán chữ thuần để không kéo theo định dạng
      event.preventDefault();
      document.execCommand('insertText', false, (event.clipboardData || window.clipboardData).getData('text').replace(/\s+/g, ' '));
    } else if (target.matches('[data-ol-brief]') && event.clipboardData && event.clipboardData.files.length) { event.preventDefault(); addFiles(event.clipboardData.files); }
    else if (target.matches('[data-ol-refine-input]') && event.clipboardData && event.clipboardData.files.length) { event.preventDefault(); addFiles(event.clipboardData.files, 'refineFiles'); }
  }
  function onDragOver(event) { if (event.dataTransfer && [...event.dataTransfer.types].includes('Files') && event.target.closest && event.target.closest('.ola-composer, .ola-refine')) event.preventDefault(); }
  function onDrop(event) { if (event.dataTransfer && event.dataTransfer.files.length && event.target.closest && event.target.closest('.ola-composer, .ola-refine')) { event.preventDefault(); addFiles(event.dataTransfer.files, event.target.closest('.ola-refine') ? 'refineFiles' : 'files'); } }
  // Bấm ra ngoài ô chọn (hồ sơ / loại) thì đóng.
  function onOutside(event) { if (st.pop && host && !(event.target.closest && (event.target.closest('.ola-pop') || event.target.closest('[data-ol-pop]')))) closePop(); }

  const HANDLERS = [['click', onClick], ['input', onInput], ['change', onChange], ['keydown', onKeydown], ['paste', onPaste], ['dragover', onDragOver], ['drop', onDrop]];

  function mount(container) {
    leave();
    host = container;
    loadRecords();
    host.innerHTML = '<div class="ola" data-ol-root></div>';
    HANDLERS.forEach(([name, fn]) => host.addEventListener(name, fn));
    document.addEventListener('mousedown', onOutside, true);
    window.addEventListener('resize', fitHeight);
    try { const saved = localStorage.getItem(HIST_PANEL_KEY); st.histOpen = saved === null ? window.innerWidth >= 1000 : saved === '1'; } catch (_) { /* bỏ qua */ }
    renderAll();
    const H = History();
    if (H) H.load().then(list => { st.history = list; st.histScope = H.scope(); if (host) updateHistory(); }).catch(() => { /* lịch sử là phụ */ });
  }

  function leave() {
    if (saveTimer && st.letter) { clearTimeout(saveTimer); saveHistory(); }
    generation++;
    controller?.abort(); controller = null;
    st.busy = ''; st.status = ''; st.pop = '';
    if (host) HANDLERS.forEach(([name, fn]) => host.removeEventListener(name, fn));
    document.removeEventListener('mousedown', onOutside, true);
    window.removeEventListener('resize', fitHeight);
    host = null;
  }

  return {mount, leave};
})();
