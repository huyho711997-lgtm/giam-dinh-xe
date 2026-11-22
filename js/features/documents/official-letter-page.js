// Trang "Công văn AI" — kiểu AI agent dạng trang (không phải khung chat, không phải phiếu điền):
//   mở đầu: một ô yêu cầu lớn ở giữa trang, trong ô có nút Đính kèm · Hồ sơ · Loại công văn + gợi ý mẫu;
//   sau khi gửi: tóm tắt yêu cầu, tờ công văn lớn sửa trực tiếp, tiến trình AI trong ô chỉnh sửa ghim ở đáy,
//   cột ghi chú hẹp (giả định, chọn nhanh, chỗ cần kiểm tra), ô chỉnh sửa cuối trang; chi tiết nằm trong ngăn trượt.
// Gõ số HSBT/biển số trong yêu cầu là tự nhận hồ sơ. Một lần gửi = đọc (DeepSeek) → tìm căn cứ trong Thư viện (nếu cần) → soạn (DeepSeek).
// Phụ thuộc: OfficialLetterCore, OfficialLetterDossier, OfficialLetterLegal, SharedFormsAI, OfficialLetterAI, DeepSeekKeyStore, JSZip.
const OfficialLetterPage = (() => {
  const ISSUER_KEY = 'officialLetter.issuer.v1';
  const MAX_FILES = 4, MAX_EDGE = 1600, MAX_PDF = 6 * 1024 * 1024, MAX_RESULTS = 30;
  const DEFAULT_TEMPLATE = 'tu_do';
  const Core = () => OfficialLetterCore;
  const Revisions = () => OfficialLetterRevisions;
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
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5Z"/><path d="M4 21.5V5.5M8.5 7.5H16M8.5 11H14"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>'
  };

  let host = null, controller = null, generation = 0, records = [], index = [];
  const st = {
    templateId: '', recordKey: '', recQuery: '', recOpen: false, recActive: 0, brief: '', files: [], refineFiles: [], legalPin: [], libDocs: null,
    values: null, filledByAI: [], questions: [], extras: [], outline: [], outlineEdited: false, understanding: '', notes: '',
    insights: [], keyFacts: [], legalQueries: [], assumptions: [], sources: [], legalError: '', legalLoaded: false,
    letter: null, analyzedKey: '', busy: '', status: '', notice: null, open: {},
    pop: '', drawer: '', editing: false, steps: null, agentOpen: false, agentTask: 'draft',
    historyId: '', savedRecordLabel: '', history: [], histQuery: '', histOpen: true, histScope: 'browser',
    versions: [], selection: [], pending: null, versionId: '', usage: null
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
  async function prepareFile(file) {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      if (file.size > MAX_PDF) throw new Error('"' + file.name + '" quá lớn (tối đa 6 MB cho PDF).');
      return OfficialLetterAI.pdfToAttachments(file.name, await file.arrayBuffer());   // DeepSeek không nhận PDF: đọc chữ (hoặc chụp trang nếu là bản scan)
    }
    if (!/^image\//.test(file.type)) throw new Error('"' + file.name + '" không phải ảnh hoặc PDF.');
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Không đọc được ảnh "' + file.name + '".')); img.src = url; });
      const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      return [{name: file.name, mimeType: 'image/jpeg', data: canvas.toDataURL('image/jpeg', 0.85).split(',')[1]}];
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

  // ---- Gọi DeepSeek ----
  const RETRY_WAITS = [8, 20];   // giây chờ trước mỗi lần thử lại khi DeepSeek báo 429/quá tải
  const NO_KEY = 'Chưa có khoá DeepSeek API. Bấm biểu tượng ⚙ ở góc phải để nhập khoá (lấy tại platform.deepseek.com).';
  // Token đã dùng trong phiên soạn hiện tại (công văn đang mở): cộng dồn từ mọi lần gọi AI, đặt lại khi bắt đầu công văn mới / mở lại từ lịch sử.
  function usageText() {
    const u = st.usage; if (!u || !u.calls) return '';
    return OfficialLetterAI.formatTokens(u.total) + ' token';
  }
  function usageTitle() {
    const u = st.usage; if (!u || !u.calls) return '';
    const n = value => value.toLocaleString('vi-VN');
    return 'Phiên này: ' + u.calls + ' lượt gọi DeepSeek · tổng ' + n(u.total) + ' token\nGửi đi: ' + n(u.prompt) + (u.hit ? ' (đã lưu đệm ' + n(u.hit) + ')' : '') + ' · Nhận về: ' + n(u.completion);
  }
  function paintUsage() {
    const node = $('[data-ol-usage]');
    if (node) { node.textContent = usageText(); node.title = usageTitle(); node.hidden = !usageText(); }
  }
  async function callAI(request) {
    if (typeof DeepSeekKeyStore === 'undefined' || typeof OfficialLetterAI === 'undefined') throw new Error('Chưa tải được mô-đun AI. Hãy tải lại trang.');
    const apiKey = await DeepSeekKeyStore.get();
    if (!apiKey) throw new Error(NO_KEY);
    let model = OfficialLetterAI.DEFAULT_MODEL;
    try { model = localStorage.getItem('deepseek_letter_model') || model; } catch (_) { /* bỏ qua */ }
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    const taskStatus = st.status;
    // Một công văn gọi AI 2–3 lần: khi bị giới hạn lưu lượng/quá tải thì tự chờ rồi thử lại, có đếm ngược cho người dùng thấy.
    for (let attempt = 0; ; attempt++) {
      try { return await OfficialLetterAI.call(request, {apiKey, model, signal, onUsage: usage => { st.usage = OfficialLetterAI.addUsage(st.usage, usage); paintUsage(); }}); }
      catch (error) {
        if (!(error && error.retryable) || attempt >= RETRY_WAITS.length) throw error;
        for (let left = RETRY_WAITS[attempt]; left > 0; left--) {
          setStatus('DeepSeek đang bận — tự thử lại sau ' + left + ' giây…');
          await new Promise((resolve, reject) => { const timer = setTimeout(resolve, 1000); signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Đã huỷ', 'AbortError')); }, {once: true}); });
        }
        setStatus(taskStatus);
      }
    }
  }

  function startValues() {
    const base = Core().prefillValues(template(), currentRecord(), loadIssuer());
    if (st.values) for (const [key, value] of Object.entries(st.values)) if (Core().single(value, 1)) base[key] = value; // giữ phần người dùng đã nhập
    return base;
  }

  // ---- Căn cứ pháp lý từ Thư viện tài liệu ----
  const Legal = () => (typeof OfficialLetterLegal !== 'undefined' ? OfficialLetterLegal : null);
  const activeSources = () => st.sources.filter(source => source.on !== false);
  const docOf = source => String(source.id || '').slice(0, String(source.id || '').lastIndexOf(':'));
  const pinNames = () => { const names = (st.libDocs || []).filter(doc => st.legalPin.includes(doc.id)).map(doc => doc.name); return names.length ? names.join(', ') : 'văn bản đã chọn'; };
  // hint: yêu cầu chỉnh sửa mới nhất (nếu có) — được tính là ý nhắc tới căn cứ; st.legalPin: văn bản người dùng đã chọn/nhắc tên → chỉ tìm trong đó.
  async function findLegal(extraQueries, hint) {
    const L = Legal(), tpl = template();
    if (!L || !tpl) return;
    const queries = L.buildQueries(tpl, dossierFor(), (extraQueries || []).concat(hint ? [hint] : []), st.brief + (hint ? ' ' + hint : ''));
    if (!queries.length) { st.legalLoaded = true; st.legalError = ''; st.sources = st.sources.filter(source => source.manual); return; }
    const pinned = st.legalPin.length > 0;
    const result = await L.retrieve(queries, pinned ? {docIds: st.legalPin} : {});
    st.legalLoaded = true; st.legalError = result.error;
    if (pinned && !result.error && !result.sources.length) {
      // Văn bản được chọn không có đoạn khớp: giữ nguyên căn cứ cũ, báo rõ thay vì xoá mất.
      const names = pinNames(); st.legalPin = [];
      notice('Thư viện không có đoạn nào khớp trong "' + names + '" — giữ nguyên căn cứ cũ. Hãy kiểm tra văn bản đã được nạp đủ chưa (Mở Thư viện tài liệu).', 'warn');
      return;
    }
    const offBefore = new Set(st.sources.filter(source => source.on === false).map(source => source.id));
    const found = result.sources.map(source => ({...source, on: pinned || !offBefore.has(source.id)}));   // đã chọn văn bản → luôn bật (các đoạn bị tắt trước đó là do đổi văn bản)
    const manual = st.sources.filter(source => source.manual && !found.some(item => item.id === source.id));   // đoạn người dùng tự tìm thì giữ
    // Đã chọn văn bản: các đoạn của văn bản khác tắt đi (vẫn giữ để người dùng bật lại nếu muốn).
    const others = pinned ? st.sources.filter(source => !source.manual && !found.some(item => item.id === source.id) && !st.legalPin.includes(docOf(source))).map(source => ({...source, on: false})) : [];
    st.sources = L.renumber(found.concat(manual, others));
  }
  async function loadLibDocs(force) {
    const L = Legal();
    if (!L || (st.libDocs && !force)) return;
    st.libDocs = await L.listDocs();
  }
  // "Nhờ AI sửa" có nhắc căn cứ / tên văn bản → tra lại Thư viện (trước đây chỉ dùng lại căn cứ cũ nên AI không đổi được).
  async function refineLegal(instruction) {
    const L = Legal();
    if (!L || !instruction) return;
    await loadLibDocs();
    const docs = typeof TascoLibStore !== 'undefined' ? await TascoLibStore.list().catch(() => []) : [];
    const ids = L.matchDocs(docs, instruction);
    if (!ids.length && !L.LEGAL_WORDS.test(instruction)) return;
    if (ids.length) st.legalPin = ids;
    setStatus('Đang tìm căn cứ…');
    await findLegal(st.legalQueries, instruction);
  }
  // Chọn văn bản làm căn cứ: tra lại chỉ trong văn bản đó rồi để người dùng bấm "Soạn lại theo chi tiết này".
  async function pickLegalDoc(id) {
    if (st.busy) return;
    collectAll();
    st.legalPin = id ? [id] : [];
    const my = generation;
    startAgent('legal', 'Giữ dữ liệu hồ sơ hiện tại');
    step('read', 'skip', 'Giữ dữ liệu hồ sơ hiện tại'); step('legal', 'run', 'Đang tìm trong thư viện');
    setBusy('Đang tìm căn cứ…');
    try {
      await findLegal(st.legalQueries);
      if (my !== generation) return;
      step('legal', st.legalError ? 'err' : 'done', st.legalError || activeSources().length + ' đoạn căn cứ');
      if (!st.notice || st.notice.kind !== 'warn') toast(id ? 'Đã chọn căn cứ từ "' + pinNames() + '". Bấm "Soạn lại theo chi tiết này" để áp dụng.' : 'Đã bỏ chọn — căn cứ tự động theo vấn đề.', 'success');
    } catch (error) { if (my !== generation || error.name === 'AbortError') return; step('legal', 'err', 'Chưa tìm được căn cứ'); notice(error.message || 'Không tìm được căn cứ.', 'error'); }
    finally { if (my === generation) { st.busy = ''; st.status = ''; renderAll(); } }
  }
  async function searchMoreLegal() {
    const input = $('[data-ol-legal-q]');
    const query = input ? input.value.trim() : '';
    const L = Legal();
    if (!query || st.busy || !L) { if (input) input.focus(); return; }
    collectAll();
    const my = generation;
    startAgent('legal', 'Giữ dữ liệu hồ sơ hiện tại');
    step('read', 'skip', 'Giữ dữ liệu hồ sơ hiện tại'); step('legal', 'run', 'Đang tìm trong thư viện');
    setBusy('Đang tìm căn cứ…');
    try {
      const result = await L.retrieve([query], {limit: 4, docIds: st.legalPin});
      if (my !== generation) return;
      step('legal', result.error ? 'err' : 'done', result.error || result.sources.length + ' đoạn phù hợp');
      const known = new Set(st.sources.map(source => source.id));
      const added = result.sources.filter(source => !known.has(source.id)).map(source => ({...source, manual: true}));
      st.sources = L.renumber(st.sources.concat(added).slice(0, 12));
      st.legalLoaded = true; if (result.error) st.legalError = result.error;
      st.open.legal = true;
      toast(result.error || (added.length ? 'Đã thêm ' + added.length + ' đoạn căn cứ.' : 'Không tìm thấy đoạn mới cho "' + query + '".'), result.error ? 'warning' : added.length ? 'success' : 'info');
    } catch (error) {
      if (my !== generation || error.name === 'AbortError') return;
      step('legal', 'err', 'Chưa tìm được căn cứ'); notice(error.message || 'Không tìm được căn cứ.', 'error');
    } finally { if (my === generation) { st.busy = ''; st.status = ''; renderAll(); } }
  }
  const legalPrompt = () => { const L = Legal(); return L ? L.promptBlock(activeSources()) : ''; };
  const citationChecks = () => { const L = Legal(); return L && st.letter ? L.verify(L.letterText(st.letter), activeSources()) : []; };

  const answeredList = () => st.questions.filter(item => item.answer).map(item => ({question: item.question, answer: item.answer}));
  const openQuestions = () => st.questions.filter(item => !item.answer).map(item => item.question + (item.options.length ? ' (phương án: ' + item.options.join(' / ') + ')' : ''));
  const defaultOutline = () => (template() ? template().outline : []).map(text => ({text, on: true}));

  // ---- Luồng chính ----
  function setBusy(status) { st.busy = 'run'; st.status = status; renderAll(); }
  function startAgent(task, text) {
    st.agentTask = task; st.agentOpen = false;
    if (st.notice?.kind === 'error') notice('');
    st.steps = {read: {state:'run', text:text || 'Đang đọc yêu cầu'}, legal: {state:'idle', text:''}, write: {state:task === 'legal' ? 'skip' : 'idle', text:task === 'legal' ? 'Giữ nguyên bản thảo' : ''}};
  }
  // Trạng thái 3 bước hiển thị kiểu agent: idle | run | done | skip | err, kèm mô tả ngắn.
  function step(name, state, text) { if (!st.steps) st.steps = {}; st.steps[name] = {state, text: text || ''}; updateSteps(); }
  function setStatus(status) {
    st.status = status;
    host?.querySelectorAll('[data-ol-status]').forEach(node => { node.textContent = status; });
    $('[data-ol-steps]')?.classList.toggle('is-waiting', !!st.busy && /tự thử lại/.test(status));
  }
  // Đổi hồ sơ hoặc loại công văn → bỏ kết quả phân tích cũ (giữ bản thảo đang có cho tới khi soạn xong bản mới).
  function resetAnalysis() {
    st.values = null; st.filledByAI = []; st.questions = []; st.extras = []; st.outline = []; st.outlineEdited = false; st.understanding = ''; st.notes = '';
    st.insights = []; st.keyFacts = []; st.legalQueries = []; st.assumptions = []; st.sources = st.sources.filter(source => source.manual); st.legalError = ''; st.legalLoaded = false;
  }

  // Bấm "Soạn công văn": đọc hồ sơ + yêu cầu → tìm căn cứ → soạn. Không dừng hỏi; AI tự giả định và ghi lại.
  async function run() {
    if (st.busy || st.pending) return;
    collectAll();
    const before = st.letter ? Revisions().clone(st.letter) : null;
    if (before) checkpoint('Trước khi soạn lại');
    const saved = before ? saveHistory() : Promise.resolve();
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
    startAgent('draft', found ? recordLabel(found.info) : 'Đọc yêu cầu và tài liệu đính kèm');
    const my = generation, tpl = template();
    setBusy('Đang đọc hồ sơ và yêu cầu…');
    try {
      await saved;
      if (my !== generation) return;
      try {
        const current = startValues();
        const files = [];
        for (const item of st.files) files.push(...await prepareFile(item.file));
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
      const letter = await composeCore('');
      if (my !== generation) return;
      if (before) {
        const changes = Revisions().changes(before, letter);
        st.pending = changes.length ? {before, changes, instruction:'Soạn lại theo yêu cầu mới', scoped:false} : null;
      } else { st.letter = letter; checkpoint('Bản soạn của AI'); }
      st.selection = [];
      step('write', 'done', 'Xong');
      await saveHistory();
    } catch (error) {
      if (my !== generation || error.name === 'AbortError') return;
      notice(error.message || 'Không soạn được công văn.', 'error');
      if (st.steps) for (const name of ['read', 'legal', 'write']) if (st.steps[name] && st.steps[name].state === 'run') st.steps[name] = {state: 'err', text: 'Lỗi'};
    } finally {
      if (my === generation) {
        st.busy = ''; st.status = ''; st.agentOpen = false; renderAll();
        if (st.pending) $('.ola-review')?.scrollIntoView({block:'nearest', behavior:'auto'});
      }
    }
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
    const candidate = Core().assembleLetter(tpl, st.values, issuer, parsed, date);
    if (number) candidate.number = number;
    // Khi chỉnh bản có sẵn, giữ phần thể thức người dùng đã sửa tay.
    return instruction && st.letter ? {...st.letter, subject:candidate.subject, paragraphs:candidate.paragraphs, warnings:candidate.warnings} : candidate;
  }

  // Soạn lại (sau khi sửa chi tiết) hoặc chỉnh theo yêu cầu — không đọc lại hồ sơ.
  async function compose(instruction) {
    if (st.busy || st.pending) return;
    if (!st.values) { run(); return; }
    collectAll(); syncLetter();
    notice('');
    const my = generation, before = st.letter ? Revisions().clone(st.letter) : null;
    const targets = instruction && st.selection.length ? st.selection.map(item => ({...item})) : [];
    checkpoint(instruction ? 'Trước khi AI chỉnh sửa' : 'Trước khi soạn lại');
    startAgent(instruction ? 'refine' : 'draft', targets.length ? 'Đọc phần được chọn và yêu cầu chỉnh sửa' : 'Đọc yêu cầu và tài liệu đính kèm');
    setBusy(instruction ? 'Đang chỉnh theo yêu cầu…' : 'Đang soạn lại…');
    const sent = instruction ? st.refineFiles.slice() : [];
    try {
      await saveHistory();
      const attachments = [];
      for (const item of sent) attachments.push(...await prepareFile(item.file));
      if (my !== generation) return;
      step('read', 'done', targets.length ? targets.length + ' phần được chọn' : sent.length ? 'Đã đọc yêu cầu và ' + sent.length + ' tệp đính kèm' : 'Đã đọc yêu cầu, giữ dữ liệu hồ sơ');
      step('legal', 'run', 'Đang kiểm tra căn cứ hiện tại');
      if (instruction) await refineLegal(instruction);
      if (my !== generation) return;
      step('legal', st.legalError ? 'err' : activeSources().length ? 'done' : 'skip', st.legalError || (activeSources().length ? activeSources().length + ' đoạn căn cứ' : 'Không có căn cứ cần viện dẫn'));
      setStatus(instruction ? 'Đang chỉnh công văn theo yêu cầu…' : 'Đang soạn lại công văn…');
      step('write', 'run', targets.length ? 'Chỉ chỉnh phần được chọn' : 'Đang viết nội dung');
      let candidate;
      if (targets.length) {
        const base = Core().buildComposeRequest(template(), st.values, loadIssuer(), st.brief, '', {dossier:dossierText(), legal:legalPrompt(), files:attachments});
        const raw = await callAI(Revisions().buildRequest(base, before, targets, instruction));
        if (my !== generation) return;
        candidate = Revisions().parsePatch(raw, before, targets);
      } else candidate = await composeCore(instruction || '', attachments);
      if (my !== generation) return;
      if (sent.length) { st.refineFiles = st.refineFiles.filter(item => !sent.includes(item)); releaseFiles(sent); }
      if (before) {
        const changes = Revisions().changes(before, candidate);
        st.pending = changes.length ? {before, changes, instruction:instruction || 'Soạn lại theo chi tiết', scoped:!!targets.length} : null;
        if (!changes.length) toast('AI giữ nguyên nội dung đã chọn.', 'info');
      } else { st.letter = candidate; checkpoint('Bản soạn của AI'); saveHistory(); }
      step('write', 'done', st.pending ? st.pending.changes.length + ' thay đổi chờ duyệt' : 'Đã xử lý xong');
    } catch (error) {
      if (my !== generation || error.name === 'AbortError') return;
      notice(error.message || 'Không soạn được công văn.', 'error');
      for (const name of STEP_NAMES) if (st.steps?.[name]?.state === 'run') st.steps[name] = {state:'err', text:'Chưa hoàn tất'};
    } finally {
      if (my === generation) {
        st.busy = ''; st.status = ''; st.agentOpen = false; renderAll();
        if (st.pending) $('.ola-review')?.scrollIntoView({block:'nearest', behavior:'auto'});
      }
    }
  }

  function checkpoint(title) { st.versions = Revisions().checkpoint(st.versions, st.letter, title); }
  function acceptChanges() {
    if (!st.pending || st.busy) return;
    try {
      syncLetter();
      const selected = st.pending.changes.filter(item => item.on).length;
      if (!selected) { toast('Chọn ít nhất một thay đổi để áp dụng.', 'info'); return; }
      st.letter = Revisions().applyChanges(st.letter, st.pending);
      checkpoint(st.pending.scoped ? 'AI sửa đoạn được chọn' : 'AI chỉnh công văn');
      st.pending = null; st.selection = []; notice('');
      renderAll(); saveHistory(); toast('Đã áp dụng ' + selected + ' thay đổi.', 'success');
    } catch (error) { toast(error.message, 'warning'); }
  }
  function discardChanges() { st.pending = null; renderAll(); toast('Đã bỏ đề xuất; bản thảo được giữ nguyên.', 'info'); }
  function restoreVersion(id) {
    if (st.busy || st.pending) return;
    const version = st.versions.find(item => item.id === id);
    if (!version) return;
    syncLetter(); checkpoint('Trước khi khôi phục phiên bản');
    st.letter = Revisions().clone(version.letter);
    checkpoint('Khôi phục: ' + version.title);
    st.selection = []; st.versionId = ''; st.drawer = '';
    renderAll(); saveHistory(); toast('Đã khôi phục phiên bản công văn.', 'success');
  }

  // Ghi lại phạm vi trước khi ô nhập/nút làm mất vùng bôi đen. Không lưu tham chiếu DOM.
  function captureSelection() {
    if (!host || !st.letter || st.busy || st.pending) return;
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0), paper = $('.ola-doc .ol-paper');
    if (!paper || !paper.contains(range.startContainer) || !paper.contains(range.endContainer)) return;
    if (range.collapsed) { if (st.selection.length) { st.selection = []; updateSelectionScope(); } return; }
    const blocks = [...paper.querySelectorAll('[data-lt]')].filter(node => range.intersectsNode(node));
    const picked = [];
    for (const node of blocks) {
      const full = node.innerText, selectedRange = range.cloneRange();
      selectedRange.selectNodeContents(node);
      if (node.contains(range.startContainer)) selectedRange.setStart(range.startContainer, range.startOffset);
      if (node.contains(range.endContainer)) selectedRange.setEnd(range.endContainer, range.endOffset);
      const prefix = document.createRange(); prefix.selectNodeContents(node); prefix.setEnd(selectedRange.startContainer, selectedRange.startOffset);
      const start = prefix.toString().length, end = start + selectedRange.toString().length;
      if (end > start) picked.push({path:node.dataset.lt, start, end, before:full});
    }
    try { st.selection = Revisions().validateTargets(st.letter = readLetter(), picked); } catch (_) { st.selection = []; }
    updateSelectionScope();
  }
  function selectionScopeHtml() {
    return st.selection.length ? '<span>Chỉ sửa phần đã chọn: “' + esc(st.selection.map(item => item.text).join(' ').slice(0, 140)) + '”</span><button type="button" class="ol-link" data-ol-act="clear-selection">Bỏ chọn đoạn</button>' : '<span>Bôi đen nội dung trên công văn để AI chỉ sửa phần đó; hoặc nhập yêu cầu cho toàn công văn.</span>';
  }
  function updateSelectionScope() { const node = $('[data-ol-selection]'); if (node) { node.innerHTML = selectionScopeHtml(); node.classList.toggle('is-scoped', !!st.selection.length); } }

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
    return Core().sanitizeLetter({...st.letter, parent: one('parent'), unit: one('unit'), number: one('number'), place: one('place'), subject: one('subject'), title: paper.querySelector('[data-lt="title"]') ? one('title') : (st.letter.title || ''),
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
      Core().docxFiles(st.letter, st.letter.title || st.letter.subject).forEach(file => zip.file(file.path, file.bytes || file.text, {createFolders: false}));
      const blob = await zip.generateAsync({type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
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
    win.document.write('<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Công văn</title><style>' + Core().PRINT_CSS + '</style></head><body>' + markup + '</body></html>');
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
    const result = Revisions().fitSnapshot({
      v: 2, versions:st.versions, brief: st.brief, recordKey: st.recordKey, recordLabel: found ? recordLabel(found.info) : st.savedRecordLabel, templateId: st.templateId,
      fileNames: st.files.map(item => item.file.name), letter: st.letter, values: st.values, filledByAI: st.filledByAI, questions: st.questions, extras: st.extras,
      outline: st.outline, outlineEdited: st.outlineEdited, understanding: st.understanding, notes: st.notes, insights: st.insights, keyFacts: st.keyFacts,
      legalQueries: st.legalQueries, assumptions: st.assumptions, legalError: st.legalError, legalLoaded: st.legalLoaded, analyzedKey: st.analyzedKey,
      sources: st.sources.slice(0, 12).map(source => ({...source, text: String(source.text || '').slice(0, 2000)})), steps: st.steps, agentTask: st.agentTask
    });
    st.versions = result.versions;
    return result;
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
      steps: data.steps && typeof data.steps === 'object' ? data.steps : null,
      agentTask: ['draft', 'refine', 'legal'].includes(data.agentTask) ? data.agentTask : 'draft'
    });
    if (st.letter && data.letter && data.letter.warnings) st.letter.warnings = list(data.letter.warnings);
    st.versions = Revisions().restoreVersions(data.versions, Core().sanitizeLetter);
    if (!st.versions.length && st.letter) checkpoint('Bản lưu trước đây');
  }
  let saveTimer = 0, session = 0, saveQueue = Promise.resolve();   // tuần tự hóa các bản lưu để phản hồi chậm không ghi đè phiên bản mới
  // Lưu phiên hiện tại vào lịch sử (tự động sau khi soạn/chỉnh, và khi sửa trên tờ — có hoãn).
  function saveHistory() {
    clearTimeout(saveTimer);
    const H = History();
    if (!H || !st.letter) return;
    const mine = session, data = Revisions().clone(snapshot()), tpl = template();
    if (!st.historyId) st.historyId = H.newId ? H.newId() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const id = st.historyId;
    const entry = {title:(st.letter.subject ? 'V/v ' + st.letter.subject : st.brief) || 'Công văn', sub:[data.recordLabel, tpl.id === DEFAULT_TEMPLATE ? '' : tpl.name].filter(Boolean).join(' · '), data};
    saveQueue = saveQueue.catch(() => {}).then(async () => {
      try {
        const result = await H.save(id, entry);
        if (mine !== session) return;
        st.historyId = result.id; st.histScope = result.scope; st.history = H.list(); updateHistory();
      } catch (error) { toast('Chưa lưu được vào lịch sử: ' + (error.message || error), 'warning'); }
    });
    return saveQueue;
  }
  const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveHistory, 1500); };
  async function openHistory(id) {
    const H = History();
    if (!H || st.busy || st.pending || id === st.historyId) return;
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
    if (st.pop === 'rules') {
      const docs = st.libDocs, pinned = st.legalPin[0] || '';
      const auto = '<button type="button" role="menuitemradio" aria-checked="' + (!pinned) + '" data-ol-rule=""><b>Tự động</b><small>AI tự tìm căn cứ trong toàn bộ Thư viện tài liệu theo vấn đề</small></button>';
      const items = docs === null ? '<p class="ol-rec-empty">Đang tải Thư viện tài liệu…</p>'
        : !docs.length ? '<p class="ol-rec-empty">Thư viện chưa có văn bản nào — mở Thư viện tài liệu để nạp Luật, Nghị định, quy tắc bảo hiểm…</p>'
        : docs.map(doc => '<button type="button" role="menuitemradio" aria-checked="' + (pinned === doc.id) + '" data-ol-rule="' + esc(doc.id) + '"' + (doc.active ? '' : ' disabled') + '><b>' + esc(doc.name) + '</b><small>' + esc((doc.soHieu && !fold(doc.name).includes(fold(doc.soHieu)) ? doc.soHieu + ' · ' : '') + (doc.active ? 'Chỉ lấy căn cứ trong văn bản này' : 'Hết hiệu lực — không chọn được')) + '</small></button>').join('');
      return '<div class="ola-pop ola-pop--menu" role="menu" aria-label="Quy tắc / căn cứ">' + auto + items + '</div>';
    }
    return '';
  }
  function composerHtml(big) {
    const found = chosenRecord(), tpl = template();
    const recordChip = found
      ? '<span class="ola-chip is-set"><button type="button" data-ol-pop="record" title="Đổi hồ sơ">' + svg(ICON.folder) + esc(found.info.plate || found.info.code || 'Hồ sơ') + '</button><button type="button" class="ola-chip-x" data-ol-rec-clear aria-label="Bỏ hồ sơ">×</button></span>'
      : '<button type="button" class="ola-chip" data-ol-pop="record">' + svg(ICON.folder) + 'Hồ sơ</button>';
    const typeChip = '<button type="button" class="ola-chip' + (tpl.id !== DEFAULT_TEMPLATE ? ' is-set' : '') + '" data-ol-pop="type" title="' + esc(tpl.name) + '">' + svg(ICON.letter) + '<span class="ola-chip-t ola-chip-type">' + esc(tpl.id === DEFAULT_TEMPLATE ? 'Loại: Tự do' : tpl.name) + '</span>' + svg(ICON.chevron) + '</button>';
    const pinnedDoc = (st.libDocs || []).find(doc => doc.id === st.legalPin[0]);
    const ruleLabel = st.legalPin.length ? (pinnedDoc ? pinnedDoc.name : 'Đã chọn quy tắc') : 'Quy tắc: Tự động';
    const rulesChip = '<button type="button" class="ola-chip' + (st.legalPin.length ? ' is-set' : '') + '" data-ol-pop="rules" title="Chọn văn bản/quy tắc làm căn cứ cho AI">' + svg(ICON.book) + '<span class="ola-chip-t">' + esc(ruleLabel) + '</span>' + svg(ICON.chevron) + '</button>';
    return '<div class="ola-composer' + (big ? ' is-big' : '') + '">'
      + '<textarea data-ol-brief rows="' + (big ? 3 : 2) + '" maxlength="3000" placeholder="Mô tả công văn cần soạn… (gõ số HSBT hoặc biển số để AI tự lấy hồ sơ)" aria-label="Yêu cầu soạn công văn">' + esc(st.brief) + '</textarea>'
      + '<div class="tasco-ai-attachments ola-files" data-ol-file-list' + (st.files.length ? '' : ' hidden') + '>' + filesHtml() + '</div>'
      + '<div class="ola-bar"><label class="ola-icon-btn" title="Đính kèm ảnh/PDF"><input type="file" data-ol-files accept="image/*,application/pdf" multiple hidden>' + svg(ICON.attach) + '</label>'
      + recordChip + typeChip + rulesChip + '<span class="ola-spacer"></span>'
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
      + (st.steps ? '<div class="ola-task-result">' + stepsHtml() + '</div>' : '')
      + '<div class="ola-ideas">' + ideas.map(item => '<button type="button" class="tasco-ai-choice" data-ol-idea="' + esc(item.id) + '"><strong>' + esc(item.name) + '</strong><small>' + esc(item.group) + '</small></button>').join('') + '</div></section>';
  }

  // ---- Màn làm việc ----
  // Tiến trình nằm trong khung nhập; chỉ chuyển bước khi tác vụ tương ứng đã trả kết quả.
  const STEP_NAMES = ['read', 'legal', 'write'];
  const STEP_LABEL = {read: 'Đọc hồ sơ & yêu cầu', legal: 'Căn cứ pháp lý', write: 'Soạn công văn'};
  function stepState() {
    const steps = st.steps || {read: {state: 'done', text: ''}, legal: {state: 'done', text: ''}, write: {state: 'done', text: ''}};
    const list = STEP_NAMES.map(name => {
      const item = steps[name] || {};
      return {name, state:['idle', 'run', 'done', 'skip', 'err'].includes(item.state) ? item.state : 'idle', text:String(item.text || '')};
    });
    const current = list.findIndex(item => item.state === 'run');
    const running = !!st.busy;
    const interrupted = !running && list.some(item => item.state === 'run');
    const failed = !running && (st.notice?.kind === 'error' || list.some(item => item.state === 'err') && steps.write?.state !== 'done');
    const warning = list.some(item => item.state === 'err');
    const title = running ? st.status || 'Đang xử lý yêu cầu…' : failed ? 'Chưa hoàn tất yêu cầu' : interrupted ? 'Phiên xử lý trước đã dừng' : st.pending ? 'Đề xuất chỉnh sửa đã sẵn sàng' : st.agentTask === 'legal' ? 'Đã kiểm tra căn cứ' : warning ? 'Đã soạn xong · có lưu ý' : 'Công văn đã sẵn sàng';
    const detail = running ? (current < 0 ? 'Đang hoàn tất tác vụ' : 'Bước ' + (current + 1) + '/3 · ' + (list[current].text || STEP_LABEL[list[current].name])) : failed ? 'Kiểm tra thông báo lỗi rồi gửi lại yêu cầu.' : interrupted ? 'Bạn có thể gửi lại yêu cầu để tiếp tục.' : st.pending ? st.pending.changes.length + ' thay đổi đang chờ bạn duyệt.' : st.agentTask === 'legal' ? 'Bản thảo được giữ nguyên.' : 'Bạn có thể bôi đen một đoạn hoặc gửi yêu cầu mới.';
    return {list, running, failed, interrupted, title, detail};
  }
  function stepsInner(list) {
    const stateText = {idle:'Chưa bắt đầu', run:st.busy ? 'Đang xử lý' : 'Đã dừng', done:'Hoàn tất', skip:'Bỏ qua', err:'Cần kiểm tra'};
    const mark = state => state === 'run' && st.busy ? '<span class="olp-spinner"></span>' : state === 'done' ? '✓' : state === 'err' ? '!' : '·';
    return list.map(item => '<li class="is-' + (item.state === 'run' && !st.busy ? 'idle' : item.state) + '"' + (item.state === 'run' && st.busy ? ' aria-current="step"' : '') + '><span class="ola-step-mark" aria-hidden="true">' + mark(item.state) + '</span><div><b>' + (item.name === 'write' && st.agentTask === 'refine' ? 'Chỉnh sửa công văn' : STEP_LABEL[item.name]) + '</b><small>' + esc(item.text || stateText[item.state] || '') + '</small></div><span class="ola-step-state">' + stateText[item.state] + '</span></li>').join('');
  }
  function stepsHtml() {
    const {list, running, failed, interrupted, title, detail} = stepState();
    return '<section class="ola-agent' + (running ? ' is-running' : failed ? ' is-error' : interrupted ? ' is-paused' : st.pending ? ' is-review' : ' is-ready') + (running && /tự thử lại/.test(st.status) ? ' is-waiting' : '') + '" data-ol-steps aria-label="Tiến trình trợ lý công văn">'
      + '<div class="ola-agent-head"><span class="ola-agent-orb" aria-hidden="true"><span class="ola-agent-orbit"></span>' + (running || st.pending ? svg(ICON.spark) : failed || interrupted ? '<b>!</b>' : '<b>✓</b>') + '</span>'
      + '<div class="ola-agent-copy"><div class="ola-agent-eyebrow">Trợ lý công văn<span class="ola-agent-wave" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div><p role="status" aria-live="polite" aria-atomic="true"' + (running ? ' data-ol-status' : '') + '>' + esc(title) + '</p><small>' + esc(detail) + '</small></div>'
      + '<button type="button" class="ola-agent-toggle" data-ol-act="agent-toggle" aria-label="' + (st.agentOpen ? 'Thu gọn tiến trình' : 'Xem tiến trình') + '" aria-expanded="' + !!st.agentOpen + '" aria-controls="ol-agent-details"><span>' + (st.agentOpen ? 'Thu gọn' : 'Tiến trình') + '</span>' + svg(ICON.chevron) + '</button></div>'
      + '<div class="ola-agent-details" id="ol-agent-details"' + (st.agentOpen ? '' : ' hidden') + '><ol>' + stepsInner(list) + '</ol></div></section>';
  }
  // Chỉ thay thẻ tiến trình; giữ ô nhập, bản thảo và vị trí cuộn khi chuyển bước.
  function updateSteps() {
    const node = $('[data-ol-steps]');
    if (!node) return;
    node.outerHTML = stepsHtml();
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
    return '<div class="ola-note-block"><h3>Căn cứ trong công văn <button type="button" class="ol-link" data-ol-drawer="legal">Đổi căn cứ</button></h3><ul class="ola-cites">' + checks.map(item => item.ok
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
    if (!st.letter) return '<div class="ola-doc is-pending" aria-label="Bản thảo đang được chuẩn bị"><div class="olp-skeleton" aria-hidden="true">' + '<i></i>'.repeat(10) + '</div></div>';
    const locked = !!(st.busy || st.pending);
    const paper = Core().letterToHtml(st.letter);
    return '<div class="ola-doc' + (st.busy ? ' is-busy' : '') + '"><div class="ola-doc-bar"><label class="ol-datepick">Ngày <input type="date" data-ol-date value="' + esc(st.letter.date) + '"' + (locked ? ' disabled' : '') + '></label>'
      + '<span class="olp-usage" data-ol-usage title="' + esc(usageTitle()) + '"' + (usageText() ? '' : ' hidden') + '>' + esc(usageText()) + '</span>'
      + '<button type="button" class="olp-tool" data-ol-drawer="versions"' + (locked ? ' disabled' : '') + '>' + svg(ICON.history) + 'Phiên bản (' + st.versions.length + ')</button>'
      + '<button type="button" class="olp-tool is-primary" data-ol-act="docx">' + svg(ICON.word) + 'Tải Word</button><button type="button" class="olp-tool" data-ol-act="print" title="In">' + svg(ICON.print) + '</button><button type="button" class="olp-tool" data-ol-act="copy" title="Sao chép nội dung">' + svg(ICON.copy) + '</button></div>'
      + '<div class="ol-paper-wrap">' + (locked ? paper.replace(/contenteditable="true"/g, 'contenteditable="false"') : paper) + '</div></div>';
  }
  function reviewHtml() {
    if (!st.pending) return '';
    const diffHtml = item => Revisions().diff(item.before, item.after).map(part => part.kind === 'same' ? esc(part.text) : '<' + part.kind + '>' + esc(part.text) + '</' + part.kind + '>').join('');
    return '<section class="ola-review" aria-label="So sánh chỉnh sửa của AI"><header><div><h2>Đề xuất chỉnh sửa</h2><p>' + esc(st.pending.scoped ? 'Chỉ phần đã bôi đen được thay đổi.' : st.pending.instruction) + '</p></div><span><del>Bỏ</del> <ins>Thêm</ins></span></header>'
      + '<div class="ola-review-list">' + st.pending.changes.map((item, i) => '<article><label><input type="checkbox" data-ol-change="' + i + '"' + (item.on ? ' checked' : '') + '>Dùng thay đổi: ' + esc(item.label) + '</label><p>' + diffHtml(item) + '</p></article>').join('') + '</div>'
      + '<footer><span>Bản thảo bên dưới đang giữ nội dung hiện tại.</span><button type="button" class="olp-tool" data-ol-act="reject-changes">Bỏ đề xuất</button><button type="button" class="olp-tool is-primary" data-ol-act="accept-changes">Áp dụng thay đổi</button></footer></section>';
  }
  const REFINES = ['Viết ngắn gọn hơn', 'Giọng trang trọng hơn', 'Thêm hạn phản hồi 07 ngày làm việc'];
  function refineHtml() {
    const agent = stepsHtml();
    if (!st.letter) return '<div class="ola-refine is-processing">' + agent + '</div>';
    if (st.pending) return '<div class="ola-refine">' + agent + '<div class="ola-review-hint"><span>Chọn những thay đổi bạn muốn áp dụng vào bản thảo.</span><button type="button" class="olp-tool" data-ol-act="review">Xem đề xuất</button></div></div>';
    return '<div class="ola-refine' + (st.busy ? ' is-processing' : '') + '">' + agent + '<div class="ola-selection' + (st.selection.length ? ' is-scoped' : '') + '" data-ol-selection role="status">' + selectionScopeHtml() + '</div><div class="tasco-ai-attachments ola-files" data-ol-file-list="refine"' + (st.refineFiles.length ? '' : ' hidden') + '>' + filesHtml('refineFiles') + '</div><div class="tasco-ai-suggest">' + REFINES.map(text => '<button type="button" class="tasco-ai-suggest__chip" data-ol-refine="' + esc(text) + '"' + (st.busy ? ' disabled' : '') + '>' + esc(text) + '</button>').join('') + '</div>'
      + '<div class="tasco-ai-composer ola-refine-box"><label class="ola-icon-btn' + (st.busy ? ' is-disabled' : '') + '" title="Đính kèm ảnh/PDF để AI đọc khi sửa"><input type="file" data-ol-files="refine" accept="image/*,application/pdf" multiple hidden' + (st.busy ? ' disabled' : '') + '>' + svg(ICON.attach) + '</label><input class="tasco-ai-input" data-ol-refine-input maxlength="600" placeholder="Nhờ AI sửa: “gửi Phòng CSGT tỉnh”, “nêu thêm ngày tổn thất”… (có thể đính kèm tài liệu)" aria-label="Yêu cầu chỉnh sửa"' + (st.busy ? ' disabled' : '') + '>'
      + '<button type="button" class="tasco-ai-send" data-ol-act="refine" aria-label="Gửi yêu cầu chỉnh sửa"' + (st.busy ? ' disabled' : '') + '>' + svg(ICON.send) + '</button></div></div>';
  }
  function workHtml() {
    // Vùng nội dung cuộn riêng; ô "Nhờ AI sửa" ghim cố định ở đáy, không trôi theo và không đè tờ công văn.
    return '<div class="ola-work"><div class="ola-scroll" data-ol-scroll><div class="ola-scroll-inner">' + requestHtml() + noticeHtml()
      + reviewHtml() + '<div class="ola-stage">' + documentHtml() + notesRail() + '</div></div></div>' + refineHtml() + '</div>';
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
    const docs = st.libDocs || [];
    const picker = docs.length ? '<label class="ol-legal-doc"><span>Chọn căn cứ từ văn bản</span><select data-ol-legal-doc aria-label="Chọn văn bản làm căn cứ"><option value="">Tự động — tất cả văn bản</option>'
      + docs.map(doc => '<option value="' + esc(doc.id) + '"' + (st.legalPin[0] === doc.id ? ' selected' : '') + (doc.active ? '' : ' disabled') + '>' + esc(doc.name + (doc.soHieu && !fold(doc.name).includes(fold(doc.soHieu)) ? ' (' + doc.soHieu + ')' : '') + (doc.active ? '' : ' — hết hiệu lực')) + '</option>').join('')
      + '</select></label>' : '';
    return picker + status + (rows ? '<div class="ol-srcs">' + rows + '</div>' : '')
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
    if (!st.drawer || (!st.values && st.drawer !== 'versions')) return '';
    const tabs = [['fields', 'Thông tin'], ['outline', 'Dàn ý'], ['legal', 'Căn cứ'], ['dossier', 'Hồ sơ'], ['versions', 'Phiên bản']].filter(([name]) => name !== 'legal' || Legal());
    const body = {fields: fieldsBody, outline: outlineBody, legal: legalBody, dossier: dossierBody, versions:versionsBody}[st.drawer] || fieldsBody;
    return '<div class="ola-drawer-backdrop" data-ol-drawer-close></div><aside class="ola-drawer" role="dialog" aria-label="Chi tiết công văn"><header><div class="ola-tabs" role="tablist">'
      + tabs.map(([name, label]) => '<button type="button" role="tab" aria-selected="' + (st.drawer === name) + '" data-ol-drawer="' + name + '">' + label + '</button>').join('')
      + '</div><button type="button" class="ol-x" data-ol-drawer-close aria-label="Đóng">' + svg(ICON.close) + '</button></header><div class="ola-drawer-body">' + body() + '</div>'
      + (['dossier', 'versions'].includes(st.drawer) ? '' : '<footer><button type="button" class="olp-tool is-primary" data-ol-act="compose"' + (st.busy ? ' disabled' : '') + '>Soạn lại theo chi tiết này</button></footer>') + '</aside>';
  }
  function versionsBody() {
    const picked = st.versions.find(item => item.id === st.versionId);
    const time = at => new Date(at).toLocaleString('vi-VN');
    return '<p class="ola-version-intro">Giữ tối đa ' + Revisions().MAX_VERSIONS + ' phiên bản gần nhất trong dung lượng lịch sử của công văn. Khôi phục sẽ giữ lại bản hiện tại để bạn có thể quay lại.</p>'
      + '<div class="ola-versions">' + st.versions.slice().reverse().map(item => '<button type="button" class="ola-version' + (item.id === st.versionId ? ' is-active' : '') + '" data-ol-version="' + esc(item.id) + '"><strong>' + esc(item.title) + '</strong><small>' + esc(time(item.at)) + '</small></button>').join('') + '</div>'
      + (picked ? '<section class="ola-version-preview"><h3>' + esc(picked.letter.subject) + '</h3>' + picked.letter.paragraphs.map(p => '<p>' + esc(p.text) + '</p>').join('') + '<button type="button" class="olp-tool is-primary" data-ol-restore="' + esc(picked.id) + '">Khôi phục phiên bản này</button></section>' : '<p>Chọn một phiên bản để xem nội dung trước khi khôi phục.</p>');
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
      + '<button type="button" class="ola-gear" data-ol-act="settings" title="Cài đặt: đơn vị ban hành &amp; khoá DeepSeek" aria-label="Cài đặt: đơn vị ban hành và khoá DeepSeek">' + svg(ICON.gear) + '</button></div>' + drawerHtml();
    const nextHist = $('[data-ol-hist-list]'); if (nextHist) nextHist.scrollTop = histTop;
    root.classList.toggle('is-working', working);
    root.classList.toggle('has-history', st.histOpen);
    fitHeight();
    const nextScroll = $('[data-ol-scroll]'); if (nextScroll) nextScroll.scrollTop = scrollTop;
    const brief = $('[data-ol-brief]'); if (brief) autoGrow(brief);
    if (st.pop === 'record') { updateRecList(); $('[data-ol-rec-q]')?.focus(); }
    else if (focusSel) $(focusSel)?.focus();
    if (st.busy || st.pending) {
      host.querySelectorAll('[data-ol-act="new"], [data-ol-act="edit"], [data-ol-hist-open], [data-ol-hist-del], [data-ol-drawer], [data-ol-act="compose"]').forEach(node => { node.disabled = true; });
    }
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
    dialog.setAttribute('aria-labelledby', 'olSetTitle');
    // [khoá, nhãn, chiếm cả hàng?, gợi ý trong ô]
    const rows = [['parent', 'Tên công ty', true, 'CÔNG TY TNHH BẢO HIỂM …'], ['unit', 'Chi nhánh / đơn vị', true, 'CHI NHÁNH …'], ['shortName', 'Tên gọi tắt', false, 'Bảo hiểm Tasco'], ['place', 'Địa danh ghi ở ngày tháng', false, 'Đắk Lắk'], ['signerTitle', 'Chức danh người ký', false, 'GIÁM ĐỐC'], ['signerName', 'Họ tên người ký', false, 'Tuỳ chọn — để trống nếu ký tay'], ['contactPerson', 'Cán bộ liên hệ mặc định', false, 'Tuỳ chọn'], ['phone', 'Số điện thoại liên hệ', false, 'Tuỳ chọn'], ['address', 'Địa chỉ nhận hồ sơ', true, 'Tuỳ chọn']];
    const icon = path => '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
    const field = ([key, label, wide, hint]) => '<label class="ol-set-field' + (wide ? ' is-wide' : '') + '"><span>' + esc(label) + '</span><input name="' + key + '" maxlength="300" value="' + esc(issuer[key]) + '" placeholder="' + esc(hint) + '" autocomplete="off"></label>';
    dialog.innerHTML = '<form method="dialog" class="ol-set">'
      + '<header class="ol-set-head"><span class="ol-set-ico">' + icon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h0A1.7 1.7 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h0a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v0a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/>') + '</span>'
      + '<div><h2 id="olSetTitle">Cài đặt Công văn AI</h2><p>Thông tin đơn vị ban hành và kết nối AI</p></div>'
      + '<button type="button" class="ol-set-x" data-cancel aria-label="Đóng">' + icon('<path d="M18 6 6 18M6 6l12 12"/>') + '</button></header>'
      + '<div class="ol-set-body">'
      + '<section class="ol-set-card ol-set-key"><div class="ol-set-card-head"><h3>Kết nối DeepSeek</h3><span class="ol-set-pill is-wait" data-ds-state>Đang kiểm tra…</span></div>'
      + '<p class="ol-set-note">Khoá API giúp Công văn AI đọc hồ sơ và soạn nội dung. Khoá chỉ lưu cho tài khoản của bạn và không hiển thị lại.</p>'
      + '<label class="ol-set-field"><span>Khoá API mới <em>(để trống nếu giữ nguyên)</em></span><div class="ol-set-secret"><input name="deepseekKey" type="password" autofocus autocomplete="off" spellcheck="false" maxlength="200" placeholder="sk-••••••••••••••••">'
      + '<button type="button" class="ol-set-eye" data-ds-eye aria-label="Hiện / ẩn khoá" title="Hiện / ẩn khoá">' + icon('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>') + '</button></div></label>'
      + '<div class="ol-set-links"><a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer">Lấy khoá tại platform.deepseek.com ↗</a><button type="button" class="ol-set-danger" data-ds-clear hidden>Xoá khoá</button></div></section>'
      + '<section class="ol-set-card"><div class="ol-set-card-head"><h3>Đơn vị ban hành</h3><small>Lưu trên máy này, dùng cho mọi công văn</small></div><div class="ol-set-grid">' + rows.map(field).join('') + '</div></section>'
      + '</div>'
      + '<footer class="ol-set-foot"><button type="button" class="tasco-ai-btn-ghost" data-cancel>Hủy</button><button type="submit" class="tasco-ai-btn-primary">Lưu cài đặt</button></footer></form>';
    document.body.appendChild(dialog);
    const close = () => { dialog.close(); dialog.remove(); };
    dialog.querySelectorAll('[data-cancel]').forEach(button => { button.onclick = close; });
    const stateNode = dialog.querySelector('[data-ds-state]'), clearBtn = dialog.querySelector('[data-ds-clear]'), keyInput = dialog.querySelector('[name="deepseekKey"]');
    const setState = (kind, text) => { stateNode.className = 'ol-set-pill is-' + kind; stateNode.textContent = text; };
    dialog.querySelector('[data-ds-eye]').onclick = () => { keyInput.type = keyInput.type === 'password' ? 'text' : 'password'; keyInput.focus(); };
    if (typeof DeepSeekKeyStore === 'undefined') setState('off', 'Chưa tải được mô-đun');
    else DeepSeekKeyStore.get().then(key => {
      if (key) { setState('ok', 'Đã kết nối · …' + key.slice(-4)); keyInput.placeholder = 'Nhập khoá mới để thay thế'; }
      else setState('off', 'Chưa có khoá');
      clearBtn.hidden = !key;
    });
    clearBtn.onclick = async () => { await DeepSeekKeyStore.clear(); setState('off', 'Chưa có khoá'); keyInput.placeholder = 'sk-••••••••••••••••'; clearBtn.hidden = true; toast('Đã xoá khoá DeepSeek.', 'info'); };
    dialog.querySelector('form').onsubmit = async event => {
      event.preventDefault();
      const next = {}; rows.forEach(([key]) => { next[key] = dialog.querySelector('[name="' + key + '"]').value; });
      const keyValue = keyInput.value.trim();
      if (keyValue) {
        try {
          const saved = await DeepSeekKeyStore.set(keyValue);
          toast(saved.scope === 'account' ? 'Đã lưu khoá DeepSeek vào tài khoản.' : 'Đã lưu khoá DeepSeek trên trình duyệt này (tài khoản chưa cho phép lưu).', 'success');
        } catch (error) { toast(error.message, 'warning'); return; }
      }
      saveIssuer(Core().normalizeIssuer(next)); close(); toast('Đã lưu thông tin đơn vị.', 'success');
    };
    dialog.addEventListener('cancel', close);
    dialog.addEventListener('click', event => { if (event.target === dialog) close(); });   // bấm ra vùng tối để đóng
    dialog.showModal();
  }

  function reset() {
    session++;
    generation++; controller?.abort(); controller = null;
    resetAnalysis();
    releaseFiles(st.files); releaseFiles(st.refineFiles);
    Object.assign(st, {templateId: '', recordKey: '', recQuery: '', recOpen: false, recActive: 0, brief: '', files: [], refineFiles: [], legalPin: [], libDocs: null, sources: [], letter: null, analyzedKey: '', busy: '', status: '', notice: null, open: {}, pop: '', drawer: '', editing: false, steps: null, agentOpen:false, agentTask:'draft', historyId: '', savedRecordLabel: '', versions:[], selection:[], pending:null, versionId:'', usage: null});
  }
  const confirmDiscard = () => !(st.values || st.letter) || window.confirm('Bỏ công văn đang soạn để bắt đầu công văn mới?');

  // ---- Sự kiện ----
  function closePop() { if (!st.pop) return; collectAll(); st.pop = ''; st.recQuery = ''; renderAll(); }
  function onClick(event) {
    const target = event.target;
    const version = target.closest('[data-ol-version]');
    if (version && !st.busy && !st.pending) { collectAll(); st.versionId = version.dataset.olVersion; renderAll(); return; }
    const restore = target.closest('[data-ol-restore]');
    if (restore) { restoreVersion(restore.dataset.olRestore); return; }
    const histDel = target.closest('[data-ol-hist-del]');
    if (histDel) { event.stopPropagation(); deleteHistory(histDel.dataset.olHistDel); return; }
    const histOpen = target.closest('[data-ol-hist-open]');
    if (histOpen) { openHistory(histOpen.dataset.olHistOpen); return; }
    if (target.closest('[data-ol-hist-backdrop]')) { st.histOpen = false; renderAll(); return; }
    const popButton = target.closest('[data-ol-pop]');
    if (popButton) { collectAll(); const name = popButton.dataset.olPop; st.pop = st.pop === name ? '' : name; st.recQuery = ''; st.recActive = 0; if (st.pop === 'record' && !index.length) loadRecords(); if (st.pop === 'rules' && st.libDocs === null) loadLibDocs().then(() => { if (st.pop === 'rules') renderAll(); }); renderAll(); return; }
    const pick = target.closest('[data-ol-pick]');
    if (pick) { collectAll(); st.recordKey = pick.dataset.olPick; st.pop = ''; st.recQuery = ''; renderAll(); $('[data-ol-brief]')?.focus(); return; }
    const rule = target.closest('[data-ol-rule]');
    if (rule) { collectAll(); st.legalPin = rule.dataset.olRule ? [rule.dataset.olRule] : []; st.pop = ''; renderAll(); $('[data-ol-brief]')?.focus(); return; }
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
    if (drawerTab) { collectAll(); st.drawer = drawerTab.dataset.olDrawer; renderAll(); if (st.drawer === 'legal' && !st.libDocs) loadLibDocs().then(() => { if (st.drawer === 'legal') renderAll(); }); return; }
    if (target.closest('[data-ol-drawer-close]')) { collectAll(); st.drawer = ''; renderAll(); return; }
    const act = target.closest('[data-ol-act]');
    if (!act) return;
    switch (act.dataset.olAct) {
      case 'agent-toggle': st.agentOpen = !st.agentOpen; updateSteps(); $('[data-ol-act="agent-toggle"]')?.focus(); break;
      case 'review': $('.ola-review')?.scrollIntoView({block:'start', behavior:'auto'}); break;
      case 'run': run(); break;
      case 'compose': st.drawer = ''; compose(''); break;
      case 'refine': sendRefine(); break;
      case 'accept-changes': acceptChanges(); break;
      case 'reject-changes': discardChanges(); break;
      case 'clear-selection': st.selection = []; window.getSelection()?.removeAllRanges(); updateSelectionScope(); break;
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
    else if (target.closest && target.closest('.ol-paper')) { st.selection = []; updateSelectionScope(); refreshCitations(); saveSoon(); }
  }
  function onChange(event) {
    const target = event.target;
    if (target.matches('[data-ol-change]') && st.pending) { const change = st.pending.changes[Number(target.dataset.olChange)]; if (change) change.on = target.checked; return; }
    if (target.matches('[data-ol-legal-doc]')) { pickLegalDoc(target.value); return; }
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
    document.addEventListener('selectionchange', captureSelection);
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
    document.removeEventListener('selectionchange', captureSelection);
    st.selection = [];
    window.removeEventListener('resize', fitHeight);
    host = null;
  }

  return {mount, leave};
})();
