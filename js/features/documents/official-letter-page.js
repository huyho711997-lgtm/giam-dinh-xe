// Trang "Công văn AI" — bố cục trang làm việc (không phải khung chat):
//   cột trái  = phiếu yêu cầu: hồ sơ (tìm hoặc tự nhận từ số HSBT/biển số gõ trong yêu cầu) · loại công văn · cần viết gì · đính kèm
//               → nút "Soạn công văn"; sau khi soạn: điểm AI đã giả định / cần xác nhận + các mục chi tiết thu gọn
//               (thông tin, dàn ý, căn cứ pháp lý, phân tích hồ sơ);
//   cột phải  = tờ công văn A4 sửa trực tiếp, thanh công cụ (ngày, Word, In, Sao chép), kiểm chứng căn cứ, ô yêu cầu chỉnh sửa.
// Một lần bấm "Soạn công văn" = đọc hồ sơ + yêu cầu (Gemini) → tìm căn cứ trong Thư viện (nếu cần) → soạn (Gemini).
// Phụ thuộc: OfficialLetterCore, OfficialLetterDossier, OfficialLetterLegal, SharedFormsAI, SharedFormsControls, GeminiKeyStore, JSZip.
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
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>'
  };

  let host = null, controller = null, generation = 0, records = [], index = [];
  const st = {
    templateId: '', recordKey: '', recQuery: '', recOpen: false, recActive: 0, brief: '', files: [],
    values: null, filledByAI: [], questions: [], extras: [], outline: [], outlineEdited: false, understanding: '', notes: '',
    insights: [], keyFacts: [], legalQueries: [], assumptions: [], sources: [], legalError: '', legalLoaded: false,
    letter: null, analyzedKey: '', busy: '', status: '', notice: null, open: {}
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
  function addFiles(list) {
    const picked = [...list].filter(file => /^image\//.test(file.type) || file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
    if (!picked.length) return;
    for (const file of picked) {
      if (st.files.length >= MAX_FILES) { toast('Chỉ nhận tối đa ' + MAX_FILES + ' tệp.', 'info'); break; }
      st.files.push({file, url: /^image\//.test(file.type) ? URL.createObjectURL(file) : ''});
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
    notice(missingRecord ? 'Không tìm thấy hồ sơ khớp với số trong yêu cầu trên máy này (dữ liệu hồ sơ chưa tải hoặc số chưa đúng) — AI chỉ dựa vào nội dung bạn gõ. Có thể tìm và chọn hồ sơ ở mục 1.' : '', 'warn');
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
      }
      setStatus('Đang tìm căn cứ trong thư viện…');
      await findLegal(st.legalQueries);
      if (my !== generation) return;
      setStatus('Đang soạn công văn…');
      await composeCore('');
    } catch (error) {
      if (my !== generation || error.name === 'AbortError') return;
      notice(error.message || 'Không soạn được công văn.', 'error');
    } finally { if (my === generation) { st.busy = ''; st.status = ''; renderAll(); } }
  }

  async function composeCore(instruction) {
    const tpl = template();
    const issuer = loadIssuer();
    const previous = instruction && st.letter ? st.letter.paragraphs.map(p => p.text).join('\n') : '';
    const brief = st.brief + (instruction ? '\nYÊU CẦU CHỈNH SỬA MỚI NHẤT: ' + instruction : '');
    const ctx = {outline: st.outline.filter(item => item.on).map(item => item.text).filter(text => Core().single(text, 1)), extras: st.extras, answers: answeredList(), understanding: st.understanding,
      keyFacts: st.keyFacts, insights: st.insights, dossier: dossierText(), legal: legalPrompt(), assumptions: st.assumptions, openQuestions: openQuestions()};
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
    try {
      await composeCore(instruction || '');
      if (my !== generation) return;
      toast(instruction ? 'Đã chỉnh công văn theo yêu cầu.' : 'Đã soạn lại công văn.', 'success');
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
    const text = input.value.trim();
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

  // ================= HIỂN THỊ =================
  // ---- Cột trái: phiếu yêu cầu ----
  function recordItemHtml(item, active) {
    const {info, row} = item;
    return '<button type="button" class="ol-rec-item' + (active ? ' is-active' : '') + '" role="option" data-ol-pick="' + esc(row.key) + '"><span class="ol-rec-plate">' + esc(info.plate || '—') + '</span>'
      + '<span class="ol-rec-main"><b>' + esc(info.owner || 'Chưa có tên chủ xe') + '</b><small>' + esc([info.code && 'HS ' + info.code, info.gcn && 'GCN ' + info.gcn].filter(Boolean).join(' · ') || 'Chưa có số hồ sơ') + '</small></span><em class="ol-rec-tag">' + esc(info.tag) + '</em></button>';
  }
  function updateRecList() {
    const list = $('[data-ol-rec-list]');
    if (!list) return;
    const show = st.recOpen || !!st.recQuery.trim();
    list.hidden = !show;
    if (!show) return;
    const found = searchRecords(st.recQuery);
    const shown = found.slice(0, MAX_RESULTS);
    st.recActive = Math.max(0, Math.min(st.recActive, shown.length - 1));
    list.innerHTML = (shown.length ? shown.map((item, i) => recordItemHtml(item, i === st.recActive)).join('')
      : '<p class="ol-rec-empty">' + (index.length ? 'Không tìm thấy hồ sơ nào khớp “' + esc(st.recQuery) + '”.' : 'Chưa có dữ liệu hồ sơ trên máy — mở trang Hồ sơ bồi thường một lần để tải.') + '</p>')
      + (st.recQuery.trim() && found.length > MAX_RESULTS ? '<p class="ol-rec-empty">' + found.length + ' kết quả, hiện ' + MAX_RESULTS + ' đầu — gõ cụ thể hơn.</p>' : '');
  }
  function recordSection() {
    const found = chosenRecord();
    if (found) return '<div class="ol-rec-chosen"><span class="ol-rec-plate">' + esc(found.info.plate || '—') + '</span><span class="ol-rec-main"><b>' + esc(found.info.owner || 'Chưa có tên chủ xe') + '</b><small>' + esc([found.info.code && 'HS ' + found.info.code, found.info.tag].filter(Boolean).join(' · ')) + '</small></span><button type="button" class="ol-x" data-ol-rec-clear aria-label="Bỏ chọn hồ sơ" title="Bỏ chọn hồ sơ">' + svg(ICON.close) + '</button></div>';
    return '<div class="ol-rec"><label class="ol-rec-search">' + svg(ICON.search) + '<input type="search" data-ol-rec-q autocomplete="off" spellcheck="false" placeholder="Biển số, số HSBT, tên chủ xe, số GCN…" value="' + esc(st.recQuery) + '" aria-label="Tìm hồ sơ"></label>'
      + '<div class="ol-rec-list" data-ol-rec-list role="listbox" aria-label="Kết quả tìm hồ sơ" hidden></div>'
      + '<small class="olp-hint">Không bắt buộc. Gõ số HSBT hoặc biển số trong ô “Cần viết gì” cũng được — hệ thống tự nhận hồ sơ.</small></div>';
  }
  function templateSelect() {
    const groups = [];
    Core().templates().forEach(item => { let group = groups.find(entry => entry.name === item.group); if (!group) groups.push(group = {name: item.group, items: []}); group.items.push(item); });
    return '<select data-ol-template data-sf-select data-sf-label="Loại công văn" data-sf-description="Chọn loại gần nhất; không chắc thì để Tự do" data-sf-icon="file" aria-label="Loại công văn">'
      + groups.map(group => group.items.map(item => '<option value="' + esc(item.id) + '"' + (item.id === templateId() ? ' selected' : '') + '>' + esc(item.id === DEFAULT_TEMPLATE ? 'Tự do — AI viết theo yêu cầu của bạn' : item.name) + '</option>').join('')).join('') + '</select>';
  }
  function filesHtml() {
    return st.files.map((item, i) => '<span class="tasco-ai-attach" title="' + esc(item.file.name) + '">' + (item.url ? '<img alt="" src="' + esc(item.url) + '">' : '<em>PDF</em>') + '<button type="button" data-ol-remove-file="' + i + '" aria-label="Bỏ tệp ' + esc(item.file.name) + '">×</button></span>').join('');
  }
  function updateFiles() { const box = $('[data-ol-file-list]'); if (box) { box.innerHTML = filesHtml(); box.hidden = !st.files.length; } }

  function requestCard() {
    const tpl = template();
    return '<section class="olp-card olp-request" aria-label="Yêu cầu soạn công văn">'
      + '<div class="olp-step"><h2><span>1</span>Hồ sơ</h2>' + recordSection() + '</div>'
      + '<div class="olp-step"><h2><span>2</span>Loại công văn</h2>' + templateSelect() + (tpl && tpl.id !== DEFAULT_TEMPLATE ? '<small class="olp-hint">' + esc(tpl.summary) + '</small>' : '') + '</div>'
      + '<div class="olp-step"><h2><span>3</span>Cần viết gì</h2><textarea class="olp-brief" data-ol-brief rows="4" maxlength="3000" placeholder="VD: Đề nghị Công an huyện Krông Pắc cung cấp biên bản tai nạn hồ sơ HSBT/XCG/2026/0031188, hạn trả lời 07 ngày.">' + esc(st.brief) + '</textarea>'
      + '<div class="olp-attach"><label class="olp-attach-btn" title="Ảnh biên bản, giấy tờ, công văn nhận được (tối đa ' + MAX_FILES + ' tệp)"><input type="file" data-ol-files accept="image/*,application/pdf" multiple hidden>' + svg(ICON.attach) + 'Đính kèm ảnh/PDF</label>'
      + '<div class="tasco-ai-attachments olp-files" data-ol-file-list' + (st.files.length ? '' : ' hidden') + '>' + filesHtml() + '</div></div></div>'
      + '<button type="button" class="olp-run" data-ol-act="run"' + (st.busy ? ' disabled' : '') + '>' + svg(ICON.spark) + (st.busy === 'run' && !st.letter ? 'Đang soạn…' : st.letter ? 'Soạn lại từ đầu' : 'Soạn công văn') + '</button>'
      + '<p class="olp-privacy">Nội dung hồ sơ, yêu cầu và tệp đính kèm được gửi tới Google Gemini để soạn.</p></section>';
  }

  // Sau khi soạn: AI đã giả định gì, chọn nhanh điểm chưa rõ, lưu ý quan trọng từ hồ sơ.
  function reviewCard() {
    if (!st.letter) return '';
    const dossier = dossierFor();
    const warns = (dossier ? dossier.facts : []).filter(fact => fact.level === 'warn').slice(0, 3);
    const open = st.questions.map((item, i) => ({item, i})).filter(({item}) => !item.answer && item.options.length);
    if (!st.assumptions.length && !warns.length && !open.length) return '';
    return '<section class="olp-card olp-review" aria-label="Điểm cần xem lại">'
      + (st.assumptions.length ? '<h3>AI đã tự giả định</h3><ul class="ol-keyfacts">' + st.assumptions.map(text => '<li>' + esc(text) + '</li>').join('') + '</ul>' : '')
      + (open.length ? '<h3>Chọn nhanh nếu cần (không bắt buộc)</h3>' + open.map(({item, i}) => '<div class="ol-q"><p class="ol-q-text">' + esc(item.question) + '</p><div class="tasco-ai-chiprow">' + item.options.map((option, j) => '<button type="button" class="tasco-ai-chip" data-ol-fix="' + i + '|' + j + '">' + esc(option) + '</button>').join('') + '</div></div>').join('') : '')
      + (warns.length ? '<h3>Lưu ý từ hồ sơ</h3><ul class="ol-facts">' + warns.map(fact => '<li class="ol-fact ol-fact--warn">' + esc(fact.text) + '</li>').join('') + '</ul>' : '')
      + '<p class="olp-hint">Giả định sai? Ghi yêu cầu ở ô “Chỉnh sửa” phía trên tờ công văn.</p></section>';
  }

  // ---- Các mục chi tiết (thu gọn) ----
  function fieldInput(field, value) {
    const common = ' data-ol-field="' + esc(field.key) + '" maxlength="' + (field.max || 500) + '"';
    return field.type === 'textarea' ? '<textarea' + common + ' rows="3">' + esc(value) + '</textarea>' : '<input' + common + ' value="' + esc(value) + '"' + (field.type === 'date' ? ' placeholder="dd/mm/yyyy"' : '') + '>';
  }
  const missingText = missing => missing.length ? 'Còn trống ' + missing.length + ' mục: ' + missing.map(item => item.label).join(', ') + ' — công văn sẽ để “……”.' : 'Đã đủ thông tin bắt buộc.';
  const extraRowHtml = item => '<div class="ol-extra-row" data-ol-extra-row><input data-ol-extra-label maxlength="80" placeholder="Tên thông tin" value="' + esc(item.label) + '" aria-label="Tên thông tin"><input data-ol-extra-value maxlength="400" placeholder="Nội dung" value="' + esc(item.value) + '" aria-label="Nội dung"><button type="button" class="ol-x" data-ol-act="remove-extra" aria-label="Xóa dòng" title="Xóa dòng">' + svg(ICON.close) + '</button></div>';
  function fieldsBody() {
    const tpl = template();
    const missing = Core().missingFields(tpl, st.values);
    return '<div data-ol-block="fields">' + (st.notes ? '<p class="ol-note">' + esc(st.notes) + '</p>' : '')
      + '<div class="ol-form">' + tpl.fields.map(field => {
        const flag = field.required && !Core().single(st.values[field.key], 1);
        return '<label class="ol-field' + (flag ? ' is-missing' : '') + ' is-wide" data-ol-wrap="' + esc(field.key) + '"><span>' + esc(field.label) + (field.required ? ' <b title="Bắt buộc">*</b>' : '')
          + (st.filledByAI.includes(field.key) ? ' <em class="ol-ai-tag">AI điền</em>' : '') + '</span>' + fieldInput(field, st.values[field.key]) + (field.hint ? '<small>' + esc(field.hint) + '</small>' : '') + '</label>';
      }).join('') + '</div>'
      + '<div class="ol-extras"><b>Thông tin bổ sung</b><small>Ý AI ghi nhận từ yêu cầu mà mẫu chưa có ô riêng (thời hạn, lý do, tình tiết…).</small>'
      + st.extras.map(item => extraRowHtml(item)).join('') + '<button type="button" class="ol-add" data-ol-act="add-extra">+ Thêm thông tin</button></div>'
      + '<p class="' + (missing.length ? 'ol-warn' : 'ol-ok') + '" data-ol-missing>' + esc(missingText(missing)) + '</p></div>';
  }
  function outlineBody() {
    return '<p class="olp-hint">Mỗi dòng là một ý AI sẽ viết. Bỏ tick ý không cần, sửa chữ để chỉ đạo AI.</p><div class="ol-outline">' + st.outline.map(item => '<div class="ol-outline-row" data-ol-outline-row><input type="checkbox" data-ol-outline-on' + (item.on ? ' checked' : '') + ' aria-label="Dùng ý này"><input class="ol-outline-text" data-ol-outline-text maxlength="300" value="' + esc(item.text) + '" aria-label="Nội dung ý"><button type="button" class="ol-x" data-ol-act="remove-outline" aria-label="Xóa ý" title="Xóa ý">' + svg(ICON.close) + '</button></div>').join('')
      + '</div><button type="button" class="ol-add" data-ol-act="add-outline">+ Thêm ý</button>';
  }
  function legalBody() {
    const L = Legal();
    const lib = typeof TascoLibrary !== 'undefined' && TascoLibrary.open ? ' <button type="button" class="ol-link" data-ol-act="open-library">Mở Thư viện tài liệu</button>' : '';
    const rows = st.sources.map((source, i) => '<div class="ol-src' + (source.on === false ? ' is-off' : '') + '"><label class="ol-src-head"><input type="checkbox" data-ol-src-on="' + i + '"' + (source.on === false ? '' : ' checked') + ' aria-label="Dùng căn cứ ' + esc(source.code) + '">'
      + '<span class="ol-src-code">' + esc(source.code) + '</span><span class="ol-src-main"><b>' + esc(source.doc) + (source.soHieu && !fold(source.doc).includes(fold(source.soHieu)) ? ' <small>(' + esc(source.soHieu) + ')</small>' : '') + '</b><small>' + esc(source.title) + '</small></span></label>'
      + '<details class="ol-src-text"><summary>Xem nguyên văn</summary><p>' + esc(String(source.text).slice(0, 1800)) + '</p>' + (source.link ? '<a href="' + esc(source.link) + '" target="_blank" rel="noopener noreferrer">Mở văn bản gốc</a>' : '') + '</details></div>').join('');
    const status = st.legalError ? '<p class="ol-warn">' + esc(st.legalError) + ' AI sẽ không viện dẫn điều luật cụ thể.' + lib + '</p>'
      : !st.sources.length ? (L.needsBasis(template(), st.brief) ? '<p class="olp-hint">Không có đoạn nào trong thư viện khớp đúng vấn đề — AI không viện dẫn điều luật cụ thể.' + lib + '</p>'
        : '<p class="olp-hint">Loại công văn này không cần viện dẫn điều luật nên AI không dẫn căn cứ. Muốn có, tìm đúng nội dung cần dẫn bên dưới.</p>') : '';
    return '<p class="olp-hint">AI chỉ viện dẫn đoạn đang tick khi đoạn đó quy định đúng vấn đề (tối đa 2), không tự nhớ điều luật.</p>' + status + (rows ? '<div class="ol-srcs">' + rows + '</div>' : '')
      + '<div class="ol-legal-search"><input data-ol-legal-q maxlength="160" placeholder="Tìm căn cứ, VD: thời hạn giải quyết bồi thường" aria-label="Tìm căn cứ"><button type="button" class="tasco-ai-btn-ghost" data-ol-act="legal-search">Tìm</button></div>';
  }
  function dossierBody(dossier) {
    const warnFirst = list => list.filter(item => item.level === 'warn').concat(list.filter(item => item.level !== 'warn'));
    const li = item => '<li class="ol-fact ol-fact--' + (item.level === 'warn' ? 'warn' : 'info') + '">' + esc(item.text) + '</li>';
    const rows = dossier ? dossier.sections.map(section => '<div class="ol-dos-sec"><h5>' + esc(section.title) + '</h5><dl>' + section.rows.map(([label, value]) => '<dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd>').join('') + '</dl></div>').join('') : '';
    return (st.understanding ? '<p class="ol-note"><b>AI hiểu yêu cầu:</b> ' + esc(st.understanding) + '</p>' : '')
      + (dossier && dossier.facts.length ? '<p class="ol-dos-h">Hệ thống tính từ dữ liệu</p><ul class="ol-facts">' + warnFirst(dossier.facts).map(li).join('') + '</ul>' : '')
      + (st.insights.length ? '<p class="ol-dos-h">AI nhận định cho công văn này</p><ul class="ol-facts">' + warnFirst(st.insights).map(li).join('') + '</ul>' : '')
      + (st.keyFacts.length ? '<p class="ol-dos-h">Dữ kiện nêu trong công văn</p><ul class="ol-keyfacts">' + st.keyFacts.map(text => '<li>' + esc(text) + '</li>').join('') + '</ul>' : '')
      + (dossier && dossier.gaps.length ? '<p class="olp-hint">Hồ sơ còn trống: ' + esc(dossier.gaps.join(', ')) + '.</p>' : '')
      + (rows ? '<details class="ol-dos-detail"><summary>Xem toàn bộ hồ sơ AI đã đọc</summary>' + rows + '</details>' : '')
      + (!dossier ? '<p class="olp-hint">Chưa chọn hồ sơ — AI chỉ dựa vào nội dung bạn gõ và tệp đính kèm.</p>' : '');
  }
  function detailCards() {
    if (!st.values) return '';
    const tpl = template(), dossier = dossierFor();
    const missing = Core().missingFields(tpl, st.values).length;
    const section = (name, title, meta, body) => '<details class="olp-card olp-detail" data-ol-section="' + name + '"' + (st.open[name] ? ' open' : '') + '><summary><span>' + esc(title) + '</span>' + (meta ? '<em>' + esc(meta) + '</em>' : '') + '</summary><div class="olp-detail-body">' + body + '</div></details>';
    return section('fields', 'Thông tin công văn', missing ? missing + ' mục còn trống' : 'đủ', fieldsBody())
      + section('outline', 'Dàn ý nội dung', st.outline.filter(item => item.on).length + ' ý', outlineBody())
      + (Legal() ? section('legal', 'Căn cứ pháp lý', st.sources.length ? activeSources().length + '/' + st.sources.length + ' đoạn' : 'không dùng', legalBody()) : '')
      + section('dossier', 'Phân tích hồ sơ', dossier ? dossier.facts.filter(fact => fact.level === 'warn').length + ' lưu ý' : 'chưa chọn hồ sơ', dossierBody(dossier))
      + '<button type="button" class="tasco-ai-btn-ghost olp-recompose" data-ol-act="compose"' + (st.busy ? ' disabled' : '') + '>Soạn lại theo thông tin đã sửa</button>';
  }

  // ---- Cột phải: tờ công văn ----
  function citationsHtml() {
    if (!st.letter || !Legal()) return '';
    const checks = citationChecks(), byCode = new Map(st.sources.map(source => [source.code, source]));
    if (!checks.length) return '';
    const bad = checks.filter(item => !item.ok).length;
    return '<div class="ol-cites' + (bad ? ' has-bad' : '') + '"><b>Căn cứ pháp lý trong công văn</b>' + (bad ? ' <span class="ol-cite-bad-count">' + bad + ' chưa kiểm chứng</span>' : ' <span class="ol-cite-ok-count">đã đối chiếu thư viện</span>') + '<ul>'
      + checks.map(item => item.ok
        ? '<li class="ol-cite is-ok"><span>✓ ' + esc(item.mention) + '</span><small>' + item.codes.map(code => byCode.get(code)).filter(Boolean).map(source => esc(source.code + ' · ' + source.doc + ' – ' + source.title)).join('; ') + '</small></li>'
        : '<li class="ol-cite is-bad"><span>⚠ ' + esc(item.mention) + '</span><small>Không có trong căn cứ đã chọn từ thư viện — kiểm tra lại, sửa hoặc xoá trước khi ký.</small></li>').join('') + '</ul></div>';
  }
  let citeTimer = 0;
  function refreshCitations() {
    clearTimeout(citeTimer);
    citeTimer = setTimeout(() => { const box = $('[data-ol-citations]'); if (!box || !st.letter) return; syncLetter(); box.innerHTML = citationsHtml(); }, 400);
  }
  const REFINES = ['Viết ngắn gọn hơn', 'Giọng trang trọng hơn', 'Thêm hạn phản hồi 07 ngày làm việc'];
  function previewPane() {
    const noticeHtml = st.notice ? '<div class="olp-notice olp-notice--' + esc(st.notice.kind) + '" role="' + (st.notice.kind === 'error' ? 'alert' : 'status') + '">' + esc(st.notice.text) + '</div>' : '';
    const busy = st.busy ? '<div class="olp-busy" role="status"><span class="olp-spinner" aria-hidden="true"></span><span data-ol-status>' + esc(st.status || 'Đang xử lý…') + '</span></div>' : '';
    if (!st.letter) {
      return noticeHtml + '<div class="olp-sheet olp-empty' + (st.busy ? ' is-busy' : '') + '">' + (busy || '<div class="olp-empty-inner">' + svg(ICON.letter) + '<h3>Công văn sẽ hiện ở đây</h3><ol><li>Chọn hồ sơ (hoặc gõ số HSBT/biển số trong yêu cầu)</li><li>Ghi ngắn gọn cần viết gì</li><li>Bấm <b>Soạn công văn</b> — sửa trực tiếp trên tờ, tải Word khi xong</li></ol></div>')
        + '<div class="olp-skeleton" aria-hidden="true">' + '<i></i>'.repeat(9) + '</div></div>';
    }
    const gaps = Core().countGaps(st.letter);
    return '<div class="olp-toolbar"><label class="ol-datepick">Ngày ban hành <input type="date" data-ol-date value="' + esc(st.letter.date) + '"></label>'
      + '<button type="button" class="olp-tool is-primary" data-ol-act="docx">' + svg(ICON.word) + 'Tải Word</button><button type="button" class="olp-tool" data-ol-act="print">' + svg(ICON.print) + 'In</button><button type="button" class="olp-tool" data-ol-act="copy">' + svg(ICON.copy) + 'Sao chép</button></div>'
      + '<div class="olp-refine"><input data-ol-refine-input maxlength="600" placeholder="Chỉnh sửa: VD “gửi Phòng CSGT tỉnh”, “nêu thêm ngày tổn thất”…" aria-label="Yêu cầu chỉnh sửa công văn"' + (st.busy ? ' disabled' : '') + '><button type="button" class="olp-tool is-primary" data-ol-act="refine"' + (st.busy ? ' disabled' : '') + '>' + svg(ICON.send) + 'Chỉnh</button>'
      + '<div class="tasco-ai-chiprow">' + REFINES.map(text => '<button type="button" class="tasco-ai-chip" data-ol-refine="' + esc(text) + '"' + (st.busy ? ' disabled' : '') + '>' + esc(text) + '</button>').join('') + '</div></div>'
      + noticeHtml
      + (st.letter.warnings.length ? '<div class="ol-warn"><b>AI lưu ý cần kiểm tra</b><ul>' + st.letter.warnings.map(item => '<li>' + esc(item) + '</li>').join('') + '</ul></div>' : '')
      + (gaps ? '<p class="ol-warn">Còn ' + gaps + ' chỗ “……” (tô vàng) cần điền trước khi gửi — nhấp vào tờ để điền.</p>' : '')
      + '<div data-ol-citations>' + citationsHtml() + '</div>'
      + '<div class="olp-sheet' + (st.busy ? ' is-busy' : '') + '">' + busy + '<div class="ol-paper-wrap">' + Core().letterToHtml(st.letter) + '</div></div>'
      + '<p class="olp-hint">Nhấp vào chữ trên tờ để sửa trực tiếp. Số công văn để trống nếu chưa vào sổ.</p>';
  }

  function renderAll() {
    if (!host) return;
    const side = $('[data-ol-side]'), main = $('[data-ol-main]');
    const sideScroll = side ? side.scrollTop : 0;
    side.innerHTML = requestCard() + reviewCard() + detailCards();
    main.innerHTML = previewPane();
    side.toggleAttribute('inert', !!st.busy);
    side.scrollTop = sideScroll;
    if (typeof SharedFormsControls !== 'undefined' && SharedFormsControls.enhance) SharedFormsControls.enhance(side);
    updateRecList();
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
    generation++; controller?.abort(); controller = null;
    resetAnalysis();
    releaseFiles(st.files);
    Object.assign(st, {templateId: '', recordKey: '', recQuery: '', recOpen: false, recActive: 0, brief: '', files: [], sources: [], letter: null, analyzedKey: '', busy: '', status: '', notice: null, open: {}});
  }
  const confirmDiscard = () => !(st.values || st.letter) || window.confirm('Bỏ công văn đang soạn để bắt đầu công văn mới?');

  // ---- Sự kiện ----
  function onClick(event) {
    const target = event.target;
    const pick = target.closest('[data-ol-pick]');
    if (pick) { collectAll(); st.recordKey = pick.dataset.olPick; st.recQuery = ''; st.recOpen = false; renderAll(); $('[data-ol-brief]')?.focus(); return; }
    if (target.closest('[data-ol-rec-clear]')) { collectAll(); st.recordKey = ''; renderAll(); $('[data-ol-rec-q]')?.focus(); return; }
    const removeFile = target.closest('[data-ol-remove-file]');
    if (removeFile) { const [gone] = st.files.splice(Number(removeFile.dataset.olRemoveFile), 1); if (gone) releaseFiles([gone]); updateFiles(); return; }
    const refine = target.closest('[data-ol-refine]');
    if (refine) { compose(refine.dataset.olRefine); return; }
    const fix = target.closest('[data-ol-fix]');
    if (fix && !st.busy) {
      const [i, j] = fix.dataset.olFix.split('|').map(Number), item = st.questions[i];
      if (item && item.options[j]) { item.answer = item.options[j]; if (item.key && st.values) st.values[item.key] = item.options[j]; compose(item.question + ' → ' + item.options[j]); }
      return;
    }
    const summary = target.closest('[data-ol-section] > summary');
    if (summary) { const box = summary.parentElement; st.open[box.dataset.olSection] = !box.open; return; }
    const act = target.closest('[data-ol-act]');
    if (!act) return;
    switch (act.dataset.olAct) {
      case 'run': run(); break;
      case 'compose': compose(''); break;
      case 'refine': sendRefine(); break;
      case 'docx': downloadDocx(); break;
      case 'print': printLetter(); break;
      case 'copy': copyText(); break;
      case 'settings': openSettings(); break;
      case 'legal-search': searchMoreLegal(); break;
      case 'open-library': TascoLibrary.open(); break;
      case 'new': if (confirmDiscard()) { reset(); renderAll(); } break;
      case 'add-extra': collectAll(); st.extras.push({label: '', value: ''}); st.open.fields = true; renderAll(); host.querySelector('[data-ol-extra-row]:last-of-type [data-ol-extra-label]')?.focus(); break;
      case 'remove-extra': { collectAll(); const rows = [...host.querySelectorAll('[data-ol-extra-row]')]; st.extras.splice(rows.indexOf(act.closest('[data-ol-extra-row]')), 1); renderAll(); break; }
      case 'add-outline': collectAll(); st.outline.push({text: '', on: true}); st.outlineEdited = true; st.open.outline = true; renderAll(); host.querySelector('[data-ol-outline-row]:last-of-type [data-ol-outline-text]')?.focus(); break;
      case 'remove-outline': { collectAll(); const rows = [...host.querySelectorAll('[data-ol-outline-row]')]; st.outline.splice(rows.indexOf(act.closest('[data-ol-outline-row]')), 1); st.outlineEdited = true; renderAll(); break; }
      default: break;
    }
  }
  function onInput(event) {
    const target = event.target;
    if (target.matches('[data-ol-rec-q]')) { st.recQuery = target.value; st.recActive = 0; updateRecList(); }
    else if (target.matches('[data-ol-brief]')) st.brief = target.value;
    else if (target.matches('[data-ol-field]')) updateMissingLive();
    else if (target.matches('[data-ol-outline-text]')) st.outlineEdited = true;
    else if (target.closest && target.closest('.ol-paper')) refreshCitations();
  }
  function onChange(event) {
    const target = event.target;
    if (target.matches('[data-ol-files]')) { addFiles(target.files); target.value = ''; }
    else if (target.matches('[data-ol-template]')) { collectAll(); st.templateId = target.value; renderAll(); }
    else if (target.matches('[data-ol-outline-on]')) st.outlineEdited = true;
    else if (target.matches('[data-ol-src-on]')) { const source = st.sources[Number(target.dataset.olSrcOn)]; if (source) { source.on = target.checked; target.closest('.ol-src').classList.toggle('is-off', !target.checked); } }
    else if (target.matches('[data-ol-date]') && /^\d{4}-\d{2}-\d{2}$/.test(target.value)) { syncLetter(); st.letter.date = target.value; renderAll(); }
  }
  function onFocusIn(event) {
    if (event.target.matches && event.target.matches('[data-ol-rec-q]')) { if (!index.length) loadRecords(); st.recOpen = true; updateRecList(); }
  }
  function onFocusOut(event) {
    if (!event.target.matches || !event.target.matches('[data-ol-rec-q]')) return;
    setTimeout(() => { if (!host || (document.activeElement && document.activeElement.closest && document.activeElement.closest('.ol-rec'))) return; st.recOpen = false; updateRecList(); }, 150);
  }
  function onKeydown(event) {
    const target = event.target;
    if (!target.matches) return;
    if (target.matches('.ol-edit') && event.key === 'Enter') { event.preventDefault(); return; } // mỗi khối là một dòng/đoạn
    if (target.matches('[data-ol-brief]') && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); run(); return; }
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
      else if (event.key === 'Escape') { st.recOpen = false; updateRecList(); }
    }
  }
  function onPaste(event) {
    const target = event.target;
    if (!target.matches) return;
    if (target.matches('.ol-edit')) { // dán chữ thuần để không kéo theo định dạng
      event.preventDefault();
      document.execCommand('insertText', false, (event.clipboardData || window.clipboardData).getData('text').replace(/\s+/g, ' '));
    } else if (target.matches('[data-ol-brief]') && event.clipboardData && event.clipboardData.files.length) { event.preventDefault(); addFiles(event.clipboardData.files); }
  }
  function onDragOver(event) { if (event.dataTransfer && [...event.dataTransfer.types].includes('Files') && event.target.closest && event.target.closest('.olp-request')) event.preventDefault(); }
  function onDrop(event) { if (event.dataTransfer && event.dataTransfer.files.length && event.target.closest && event.target.closest('.olp-request')) { event.preventDefault(); addFiles(event.dataTransfer.files); } }

  const HANDLERS = [['click', onClick], ['input', onInput], ['change', onChange], ['focusin', onFocusIn], ['focusout', onFocusOut], ['keydown', onKeydown], ['paste', onPaste], ['dragover', onDragOver], ['drop', onDrop]];

  function mount(container) {
    leave();
    host = container;
    loadRecords();
    host.innerHTML = '<div class="olp">'
      + '<header class="olp-head"><div class="olp-title"><span class="olp-emblem" aria-hidden="true">' + svg(ICON.letter) + '</span><div><span class="olp-eyebrow">Nghiệp vụ</span><h1>Công văn AI</h1>'
      + '<p>Chọn hồ sơ, ghi cần viết gì — AI đọc hồ sơ và soạn công văn đúng thể thức, sửa trực tiếp rồi tải Word.</p></div></div>'
      + '<div class="olp-actions"><button type="button" class="olp-tool" data-ol-act="new">' + svg(ICON.plus) + 'Công văn mới</button><button type="button" class="olp-tool" data-ol-act="settings">' + svg(ICON.gear) + 'Đơn vị ban hành</button></div></header>'
      + '<div class="olp-grid"><aside class="olp-side" data-ol-side></aside><main class="olp-main" data-ol-main></main></div></div>';
    HANDLERS.forEach(([name, fn]) => host.addEventListener(name, fn));
    renderAll();
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
