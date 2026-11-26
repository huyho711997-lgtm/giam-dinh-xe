// Trang "Công văn AI" — kiểu AI agent dạng trang (không phải khung chat, không phải phiếu điền):
//   mở đầu: một ô yêu cầu lớn ở giữa trang, trong ô có nút Đính kèm · Hồ sơ · Loại công văn + gợi ý mẫu;
//   sau khi gửi: tóm tắt yêu cầu, tờ công văn lớn sửa trực tiếp, tiến trình AI trong ô chỉnh sửa ghim ở đáy,
//   cột ghi chú hẹp (giả định, chọn nhanh, chỗ cần kiểm tra), ô chỉnh sửa cuối trang; chi tiết nằm trong ngăn trượt.
// Gõ số HSBT/biển số trong yêu cầu là tự nhận hồ sơ. Một lần gửi = đọc (DeepSeek) → tìm căn cứ trong Thư viện (nếu cần) → soạn (DeepSeek).
// Có nút chuyển chế độ: "Soạn công văn" (như trên) ⇄ "Hỏi nghiệp vụ" (hỏi đáp trên Thư viện tài liệu, trả lời có dẫn nguồn — OfficialLetterQA).
// Phụ thuộc: OfficialLetterCore, OfficialLetterDossier, OfficialLetterLegal, OfficialLetterQA, SharedFormsAI, OfficialLetterAI, DeepSeekKeyStore, JSZip.
const OfficialLetterPage = (() => {
  const ISSUER_KEY = 'officialLetter.issuer.v1';
  const MAX_FILES = 12, MAX_EDGE = 1600, MAX_PDF = 6 * 1024 * 1024, MAX_RESULTS = 30;
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
    chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
    word: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13l1.5 5 1.5-4 1.5 4 1.5-5"/>',
    print: '<path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><rect x="6" y="14" width="12" height="7"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5Z"/><path d="M4 21.5V5.5M8.5 7.5H16M8.5 11H14"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.5-4.7A8 8 0 1 1 21 12Z"/><path d="M9 10h6M9 13.5h4"/>',
    download: '<path d="M12 4v10M8 10.5l4 4 4-4M5 19h14"/>',
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    checklist: '<path d="M10 6h11M10 12h11M10 18h11"/><path d="m3 6 1.8 1.8L7.5 5M3 12l1.8 1.8L7.5 11M3 18l1.8 1.8L7.5 17"/>',
    check: '<path d="m5 12 4.5 4.5L19 7"/>'
  };

  let host = null, controller = null, generation = 0, records = [], index = [];
  const st = {
    savingRecord: false,
    templateId: '', recordKey: '', recQuery: '', recOpen: false, recActive: 0, brief: '', files: [], refineFiles: [], legalPin: [], libDocs: null,
    values: null, filledByAI: [], questions: [], extras: [], outline: [], outlineEdited: false, understanding: '', notes: '',
    insights: [], keyFacts: [], legalQueries: [], assumptions: [], reasoning: null, sources: [], legalError: '', legalLoaded: false,
    letter: null, analyzedKey: '', busy: '', status: '', notice: null, open: {},
    pop: '', drawer: '', editing: false, steps: null, agentOpen: false, agentTask: 'draft',
    historyId: '', savedRecordLabel: '', history: [], histQuery: '', histOpen: true, histScope: 'browser', histSelect: false, histPicked: [], histRename: null, customTitle: '',
    versions: [], selection: [], pending: null, reviewView: 'inline', versionId: '', usage: null, questionDrafts: Object.create(null),
    mode: 'compose'   // 'compose' = soạn công văn · 'ask' = hỏi nghiệp vụ (xem khối "Hỏi nghiệp vụ")
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
  // slot (tuỳ chọn): khoá mục "Tài liệu cần có" của loại công văn đang chọn — AI biết tệp này là giấy tờ gì.
  function addFiles(list, which, slot) {
    const bucket = which === 'refineFiles' ? 'refineFiles' : 'files';
    const picked = [...list].filter(file => /^image\//.test(file.type) || file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
    if (!picked.length) return;
    const doc = bucket === 'files' && slot ? docList().find(item => item.key === slot) : null;
    for (const file of picked) {
      if (st[bucket].length >= (bucket === 'files' ? MAX_FILES : 4)) { toast('Chỉ nhận tối đa ' + (bucket === 'files' ? MAX_FILES : 4) + ' tệp.', 'info'); break; }
      if (doc && slotFiles(doc.key).length >= doc.max) { toast('Mục "' + doc.short + '" tối đa ' + doc.max + ' tệp.', 'info'); break; }
      st[bucket].push({file, url: /^image\//.test(file.type) ? URL.createObjectURL(file) : '', slot: doc ? doc.key : ''});
    }
    updateFiles();
  }
  // ---- Tài liệu cần có theo loại công văn ----
  const docList = () => Core().templateDocs(template());
  const slotOf = item => (item.slot && docList().some(doc => doc.key === item.slot)) ? item.slot : '';   // đổi loại công văn → tệp của mục không còn thì thành tệp chung
  const slotFiles = key => st.files.filter(item => slotOf(item) === key);
  const docCounts = () => Object.fromEntries(docList().map(doc => [doc.key, slotFiles(doc.key).length]));
  const docLabel = item => { const doc = docList().find(entry => entry.key === slotOf(item)); return doc ? doc.short : ''; };
  // Khối "Tài liệu để AI lấy thông tin": mục bắt buộc (hoặc đã có tệp) hiện thành ô vuông gọn, bấm cả ô để đính kèm;
  // mục "nếu có" chưa có tệp chỉ là chip một dòng. Tiêu đề thu gọn được để nhường chỗ cho ô soạn.
  function docsHtml() {
    const docs = docList();
    if (!docs.length) return '';
    const status = Core().docsStatus(template(), docCounts());
    const locked = doc => st.busy || doc.count >= doc.max;
    const pick = doc => '<input type="file" data-ol-slot="' + esc(doc.key) + '" accept="image/*,application/pdf" multiple hidden' + (locked(doc) ? ' disabled' : '') + '>';
    const thumbsOf = doc => st.files.map((item, i) => slotOf(item) === doc.key
      ? '<span class="tasco-ai-attach" title="' + esc(item.file.name) + '">' + (item.url ? '<img alt="" src="' + esc(item.url) + '">' : '<em>PDF</em>') + '<button type="button" data-ol-remove-file="' + i + '" aria-label="Bỏ tệp ' + esc(item.file.name) + '">×</button></span>' : '').join('');
    const tiles = status.docs.filter(doc => doc.required || doc.count).map(doc => {
      const thumbs = thumbsOf(doc);
      return '<div class="ola-doc-slot' + (doc.count ? ' is-done' : doc.required ? ' is-missing' : '') + '">'
        + '<label class="ola-doc-pick' + (locked(doc) ? ' is-disabled' : '') + '" title="' + esc(doc.hint || doc.label) + '">' + pick(doc)
        + '<span class="ola-doc-state" aria-hidden="true">' + (doc.count ? '✓' : '') + '</span>'
        + '<span class="ola-doc-main"><b>' + esc(doc.label) + '</b><small>' + esc(doc.hint) + '</small></span>'
        + '<span class="ola-doc-add">' + svg(ICON.attach) + '<span>' + (doc.count ? 'Thêm' : 'Đính kèm') + '</span></span></label>'
        + (thumbs ? '<div class="tasco-ai-attachments ola-doc-files">' + thumbs + '</div>' : '') + '</div>';
    }).join('');
    const chips = status.docs.filter(doc => !doc.required && !doc.count).map(doc =>
      '<label class="ola-doc-chip' + (locked(doc) ? ' is-disabled' : '') + '" title="' + esc((doc.label ? doc.label + ' — ' : '') + (doc.hint || '')) + '">' + pick(doc) + svg(ICON.attach) + '<span>' + esc(doc.short) + '</span></label>').join('');
    const summary = status.totalRequired ? status.haveRequired + '/' + status.totalRequired + ' bắt buộc' : 'Tuỳ chọn';
    const pct = status.totalRequired ? Math.round(status.haveRequired / status.totalRequired * 100) : 0;
    const open = !st.docsFold;
    return '<div class="ola-docs-head"><b>Tài liệu để AI lấy thông tin</b>'
      + '<span class="ola-docs-count ' + (status.missingRequired.length ? 'is-warn' : 'is-ok') + '"' + (status.totalRequired ? ' style="--p:' + pct + '%"' : '') + '>' + summary + '</span>'
      + '<button type="button" class="ola-docs-fold" data-ol-act="docs-toggle" aria-expanded="' + open + '" aria-label="' + (open ? 'Thu gọn danh sách tài liệu' : 'Mở danh sách tài liệu') + '">' + svg(ICON.chevron) + '</button></div>'
      + (open ? '<div class="ola-docs-body">' + (tiles ? '<div class="ola-doc-grid">' + tiles + '</div>' : '')
        + (chips ? '<div class="ola-doc-opt">' + (tiles ? '<span class="ola-doc-opt-label">Nếu có</span>' : '') + chips + '</div>' : '') + '</div>' : '');
  }
  const releaseFiles = list => list.forEach(item => { if (item.url) { try { URL.revokeObjectURL(item.url); } catch (_) { /* bỏ qua */ } } });

  // ---- Gọi DeepSeek ----
  const RETRY_WAITS = [8, 20];   // giây chờ trước mỗi lần thử lại khi DeepSeek báo 429/quá tải
  // ---- Mô hình AI (DeepSeek, Gemini, Groq, tuỳ chỉnh) ----
  const Models = () => (typeof OfficialLetterModels !== 'undefined' ? OfficialLetterModels : null);
  let aiCfg = null;
  const aiConfig = () => aiCfg || (aiCfg = Models().load());
  const activeModel = () => (Models() ? Models().resolve(aiConfig()) : null);
  const aiKeys = {};   // nhà cung cấp → đã có khoá chưa (nạp bất đồng bộ)
  // Danh sách mô hình Antigravity: tự tải từ cầu nối khi mở bảng chọn mô hình (tối đa 1 lần / 5 phút, hoặc khi bấm Thử lại) và lưu vào cấu hình,
  // không bắt người dùng vào Cài đặt bấm tay. Lỗi hiện ngay trong bảng kèm lý do.
  const agyLoad = {at: 0, busy: false, error: ''};
  function renderModelPop() {   // vẽ lại nhưng giữ vị trí cuộn của bảng chọn (bảng dài, nhóm Antigravity nằm cuối)
    if (!host || st.pop !== 'model') return;
    const top = (host.querySelector('.ola-pop--models') || {}).scrollTop || 0;
    renderAll();
    const box = host.querySelector('.ola-pop--models'); if (box) box.scrollTop = top;
  }
  async function refreshAgyModels(force) {
    const M = Models();
    if (!M || agyLoad.busy || (!force && agyLoad.at && Date.now() - agyLoad.at < 300000)) return;
    agyLoad.busy = true; agyLoad.error = '';
    renderModelPop();
    try {
      const cfg = aiConfig();
      const names = M.parseAgyModels(await M.listModels('antigravity', cfg));
      if (!names.length) throw new Error('Cầu nối chưa liệt kê mô hình nào — hãy đăng nhập tài khoản Antigravity trong CLIProxyAPI.');
      cfg.providers.antigravity.models = names;
      aiCfg = M.save(cfg);
      agyLoad.at = Date.now();
    } catch (error) { agyLoad.error = String(error && error.message || error).slice(0, 220); }
    agyLoad.busy = false;
    renderModelPop();
  }
  function refreshKeys() { if (Models()) Models().keyStatus().then(map => { Object.assign(aiKeys, map); if (host && st.pop === 'model') renderAll(); }).catch(() => { /* bỏ qua */ }); }
  const NO_KEY = 'Chưa có khoá DeepSeek API. Bấm biểu tượng ⚙ ở góc phải để nhập khoá (lấy tại platform.deepseek.com).';
  // Token đã dùng trong phiên soạn hiện tại (công văn đang mở): cộng dồn từ mọi lần gọi AI, đặt lại khi bắt đầu công văn mới / mở lại từ lịch sử.
  function usageText(u = st.usage) {
    if (!u || !u.calls) return '';
    return OfficialLetterAI.formatTokens(u.total) + ' token';
  }
  function usageTitle(u = st.usage) {
    if (!u || !u.calls) return '';
    const n = value => value.toLocaleString('vi-VN');
    return 'Phiên này: ' + u.calls + ' lượt gọi AI · tổng ' + n(u.total) + ' token\nGửi đi: ' + n(u.prompt) + (u.hit ? ' (đã lưu đệm ' + n(u.hit) + ')' : '') + ' · Nhận về: ' + n(u.completion);
  }
  function paintUsage() {
    const node = $('[data-ol-usage]');
    if (node) { node.textContent = usageText(); node.title = usageTitle(); node.hidden = !usageText(); }
  }
  // extra (tuỳ chọn): {onUsage, onWait, resumeText, thinking, effort} — chế độ Hỏi nghiệp vụ dùng để đếm token/hiện trạng thái riêng, không đụng tới phiên soạn công văn.
  const failedAt = Object.create(null);   // mô hình Antigravity nào vừa thất bại hẳn → 10 phút tới dùng thẳng mô hình dự phòng
  let qaDeepOnce = false;   // qaDeepOnce: lượt hỏi lại do người dùng bấm "Suy luận sâu lại" thì luôn suy luận sâu
  async function callAI(request, extra = {}) {
    if (typeof OfficialLetterAI === 'undefined') throw new Error('Chưa tải được mô-đun AI. Hãy tải lại trang.');
    const active = activeModel();
    let apiKey, model = OfficialLetterAI.DEFAULT_MODEL;
    if (active) {
      apiKey = await Models().getKey(active.provider);
      if (!apiKey) throw new Error(Models().noKeyMessage(active.provider, aiConfig()));
      model = active.model;
    } else {
      if (typeof DeepSeekKeyStore === 'undefined') throw new Error('Chưa tải được mô-đun AI. Hãy tải lại trang.');
      apiKey = await DeepSeekKeyStore.get();
      if (!apiKey) throw new Error(NO_KEY);
      try { model = localStorage.getItem('deepseek_letter_model') || model; } catch (_) { /* bỏ qua */ }
    }
    const label = active ? active.providerLabel : 'DeepSeek';
    const thinking = !!extra.thinking && (!active || active.profile.reasoning !== 'none');
    controller?.abort();
    controller = new AbortController();
    const limit = active ? Models().timeoutMs(active.provider, thinking, active.model) : 0;   // Antigravity: lượt suy luận sâu được chờ lâu hơn lượt thường
    // Hạn chờ tính RIÊNG cho từng lần gọi (không gộp thời gian đếm ngược tự thử lại), nếu không lần thử lại chỉ còn vài giây rồi bị báo "không phản hồi".
    const canTimeout = limit && typeof AbortSignal.timeout === 'function' && typeof AbortSignal.any === 'function';
    const attemptSignal = () => (canTimeout ? AbortSignal.any([controller.signal, AbortSignal.timeout(limit)]) : controller.signal);
    const taskStatus = extra.onWait ? (extra.resumeText || '') : st.status, wait = extra.onWait || setStatus;
    const countUsage = extra.onUsage || (usage => { st.usage = OfficialLetterAI.addUsage(st.usage, usage); paintUsage(); });
    // Một công văn gọi AI 2–3 lần: khi bị giới hạn lưu lượng/quá tải thì tự chờ rồi thử lại, có đếm ngược cho người dùng thấy.
    // Vừa phải chuyển mô hình trong 10 phút qua thì các lượt gọi sau dùng thẳng mô hình dự phòng, khỏi chờ lại cả vòng thử lại.
    let fellBack = false;
    if (active && Date.now() - (failedAt[model] || 0) < 600000 && Models().fallbackModel(active.provider, model)) { model = Models().fallbackModel(active.provider, model); fellBack = true; }
    for (let attempt = 0; ; attempt++) {
      const signal = attemptSignal();
      try { return await OfficialLetterAI.call(request, {apiKey, model, signal, onUsage: countUsage, thinking, effort: extra.effort, maxTokens: thinking ? 16000 : undefined, endpoint: active ? active.endpoint : undefined, label, profile: active ? active.profile : undefined}); }
      catch (error) {
        const timedOut = !!active && active.provider === 'antigravity' && signal.aborted && !controller.signal.aborted;
        if (controller.signal.aborted) throw error;
        // 3.8 Flash thất bại hẳn (hết hạn chờ, hoặc quá tải sau mọi lần thử lại) → tự chuyển sang Gemini 3 Flash một lần, báo rõ cho người dùng.
        const fallback = active && !fellBack && (timedOut || (error && error.retryable && attempt >= RETRY_WAITS.length)) ? Models().fallbackModel(active.provider, model) : '';
        if (fallback) {
          failedAt[model] = Date.now(); fellBack = true; const was = model; model = fallback; attempt = -1;
          wait('Mô hình ' + was + ' đang chậm/bận — tự chuyển sang ' + fallback + '…');
          continue;
        }
        if (timedOut) {
          const seconds = Math.round(limit / 1000);
          throw new Error(thinking ? 'Antigravity chưa trả kết quả suy luận sâu sau ' + seconds + ' giây. Hãy thử lại, tắt Suy luận sâu hoặc chọn mô hình khác.' : 'Antigravity chưa trả lời sau ' + seconds + ' giây — mô hình đang chậm hoặc bận (công cụ trung gian vẫn chạy). Hãy thử lại hoặc chọn mô hình khác (như Gemini 3 Flash).');
        }
        if (!(error && error.retryable) || attempt >= RETRY_WAITS.length) throw error;
        for (let left = RETRY_WAITS[attempt]; left > 0; left--) {
          wait(label + ' đang bận — tự thử lại sau ' + left + ' giây…');
          await new Promise((resolve, reject) => { const timer = setTimeout(resolve, 1000); controller.signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Đã huỷ', 'AbortError')); }, {once: true}); });
        }
        wait(taskStatus);
      }
    }
  }

  // Suy luận sâu dùng chung cho Soạn công văn và Hỏi nghiệp vụ (một công tắc, nhớ trên máy).
  const modelCap = name => { const active = activeModel(); return active && active.profile[name] ? active.profile[name] : 0; };
  const deepSupported = () => { const active = activeModel(); return !active || active.profile.reasoning !== 'none'; };
  const deepOn = () => qa.deep && deepSupported();
  const deepOpts = () => (deepOn() ? {thinking: true, effort: 'high'} : {});
  const deepNote = text => (deepOn() ? text + ' (suy luận sâu, có thể mất 30–90 giây)' : text);

  function startValues() {
    const base = Core().prefillValues(template(), currentRecord(), loadIssuer());
    if (st.values) for (const [key, value] of Object.entries(st.values)) if (Core().single(value, 1)) base[key] = value; // giữ phần người dùng đã nhập
    return base;
  }

  // ---- Căn cứ pháp lý từ Thư viện tài liệu ----
  const Legal = () => (typeof OfficialLetterLegal !== 'undefined' ? OfficialLetterLegal : null);
  const QA = () => (typeof OfficialLetterQA !== 'undefined' ? OfficialLetterQA : null);
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
  // Chọn một hoặc nhiều văn bản làm căn cứ: tra lại trong phạm vi đã chọn.
  async function pickLegalDoc(id, toggle, checked) {
    if (st.busy) return;
    collectAll();
    if (toggle && id) st.legalPin = checked ? [...new Set(st.legalPin.concat(id))] : st.legalPin.filter(item => item !== id);
    else st.legalPin = id ? [id] : [];
    const my = generation;
    startAgent('legal', 'Giữ dữ liệu hồ sơ hiện tại');
    step('read', 'skip', 'Giữ dữ liệu hồ sơ hiện tại'); step('legal', 'run', 'Đang tìm trong thư viện');
    setBusy('Đang tìm căn cứ…');
    try {
      await findLegal(st.legalQueries);
      if (my !== generation) return;
      dropStaleLegalNotes();
      step('legal', st.legalError ? 'err' : 'done', st.legalError || activeSources().length + ' đoạn căn cứ');
      if (!st.notice || st.notice.kind !== 'warn') toast(st.legalPin.length ? 'Đã chọn căn cứ: ' + pinNames() + '. Bấm "Soạn lại theo chi tiết này" để áp dụng.' : 'Đã bỏ chọn — căn cứ tự động theo vấn đề.', 'success');
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
  const pinnedLabel = () => (st.legalPin.length && activeSources().length ? pinNames() : '');
  // Giả định / câu hỏi do AI nêu TRƯỚC khi có căn cứ ("chưa có nguyên văn điều khoản…") không còn đúng khi thư viện đã tra được nguyên văn → bỏ đi để không kéo bản soạn về lối viện dẫn chung chung.
  const MISSING_TEXT = /nguyên văn|chưa (?:có|được cung cấp)[^.;]{0,60}(?:điều khoản|quy tắc|căn cứ)|(?:điều khoản|quy tắc)[^.;]{0,40}chưa (?:có|được cung cấp)|viện dẫn chung|trích dẫn[^.;]{0,30}(?:điều khoản|quy tắc)/i;
  function dropStaleLegalNotes() {
    if (!activeSources().length) return;
    st.assumptions = st.assumptions.filter(text => !MISSING_TEXT.test(text));
    st.questions = st.questions.filter(item => item.answer || !MISSING_TEXT.test(item.question));
  }
  const citationChecks = () => { const L = Legal(); return L && st.letter ? L.verify(L.letterText(st.letter), activeSources()) : []; };

  const answeredList = () => st.questions.filter(item => item.answer).map(item => ({question: item.question, answer: item.answer}));
  const openQuestions = () => st.questions.filter(item => !item.answer).map(item => item.question + (item.options.length ? ' (phương án: ' + item.options.join(' / ') + ')' : ''));
  const defaultOutline = () => (template() ? template().outline : []).map(text => ({text, on: true}));

  // ---- Luồng chính ----
  function setBusy(status) { st.busy = 'run'; st.status = status; renderAll(); }
  function startAgent(task, text) {
    st.agentTask = task; st.agentOpen = false;
    if (st.notice?.kind === 'error') notice('');
    st.steps = {read: {state:'run', text:text || 'Đang đọc yêu cầu'}, legal: {state:'idle', text:''}, reason: {state:'skip', text:task === 'legal' ? '' : 'Không chạy lại ở bước này'}, write: {state:task === 'legal' ? 'skip' : 'idle', text:task === 'legal' ? 'Giữ nguyên bản thảo' : ''}};
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
    st.insights = []; st.keyFacts = []; st.legalQueries = []; st.assumptions = []; st.reasoning = null; st.sources = st.sources.filter(source => source.manual); st.legalError = ''; st.legalLoaded = false;
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
    if (!st.brief && !st.recordKey && !st.files.length) { notice('Hãy chọn hồ sơ hoặc ghi cần viết gì trước khi soạn.', 'warn'); renderAll(); focusMain(); return; }
    const missingRecord = !st.recordKey && looksLikeRecordRef(st.brief);
    const key = st.recordKey + '|' + templateId();
    if (key !== st.analyzedKey) resetAnalysis();
    st.analyzedKey = key;
    const lackDocs = Core().docsStatus(template(), docCounts()).missingRequired.map(doc => doc.short);
    notice([missingRecord ? 'Không tìm thấy hồ sơ khớp số trong yêu cầu trên máy này — AI chỉ dựa vào nội dung bạn gõ. Bấm nút Hồ sơ để chọn.' : '',
      lackDocs.length ? 'Chưa đính kèm: ' + lackDocs.join(', ') + ' — chỗ cần các tài liệu này AI sẽ để "……". Bạn có thể đính kèm thêm rồi bấm soạn lại.' : ''].filter(Boolean).join(' '), 'warn');
    const found = chosenRecord();
    st.editing = false; st.pop = '';
    startAgent('draft', found ? recordLabel(found.info) : 'Đọc yêu cầu và tài liệu đính kèm');
    st.steps.reason = {state:'idle', text:''};   // chỉ lần soạn đầy đủ mới có bước suy luận nghiệp vụ
    const my = generation, tpl = template();
    setBusy('Đang đọc hồ sơ và yêu cầu…');
    try {
      await saved;
      if (my !== generation) return;
      try {
        const current = startValues();
        const files = [];
        for (const item of st.files) {
          const label = docLabel(item), prepared = await prepareFile(item.file);
          files.push(...(label ? prepared.map(att => ({...att, name: '[' + label + '] ' + att.name})) : prepared));   // tên tệp mang nhãn mục để AI biết đây là giấy tờ gì
        }
        // Khi đã chọn văn bản: tra căn cứ TRƯỚC khi phân tích (BM25 cục bộ, miễn phí) để AI phân tích biết đã có nguyên văn quy tắc nên không hỏi/giả định "chưa có điều khoản".
        if (st.legalPin.length) {   // chỉ khi người dùng đã chọn văn bản: bước phân tích cần biết nguyên văn đó
          await loadLibDocs();
          try { await findLegal([]); } catch (_) { /* tra lại sau bước phân tích */ }
          if (my !== generation) return;
        }
        const raw = await callAI(Core().buildAnalyzeRequest(tpl, {
          legal: legalPrompt(), legalPinned: pinnedLabel(), docCounts: docCounts(),
          record: currentRecord() ? SharedFormsAI.describeRecord(currentRecord()) : {}, dossier: dossierText(), current, brief: st.brief, files,
          answered: answeredList(), mode: 'fast', extras: st.extras, outline: st.outlineEdited ? st.outline.filter(item => item.on).map(item => item.text) : undefined
        }), deepOpts());
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
      dropStaleLegalNotes();
      step('legal', st.legalError ? 'err' : activeSources().length ? 'done' : 'skip', st.legalError ? 'Không đọc được thư viện' : activeSources().length ? activeSources().length + ' đoạn liên quan' : 'Không cần viện dẫn');
      // Suy luận nghiệp vụ (chỉ khi bật "Suy luận sâu"): dựng chuỗi lập luận từ hồ sơ + căn cứ trước khi viết. Lỗi ở bước này không chặn việc soạn.
      st.reasoning = null;
      if (deepOn()) {
        setStatus(deepNote('Đang suy luận nghiệp vụ…')); step('reason', 'run', 'Dựng chuỗi lập luận từ hồ sơ và căn cứ');
        try {
          st.reasoning = Core().parseReasoning(await callAI(Core().buildReasonRequest(tpl, st.values, loadIssuer(), st.brief, composeCtx([])), deepOpts()));
          if (my !== generation) return;
          step('reason', 'done', st.reasoning.reasoning.length + ' ý lập luận' + (st.reasoning.objections.length ? ', ' + st.reasoning.objections.length + ' phản biện đã lường trước' : ''));
        } catch (error) {
          if (my !== generation || error.name === 'AbortError') throw error;
          step('reason', 'err', 'Không lập được kế hoạch — vẫn soạn từ hồ sơ');
        }
      } else step('reason', 'skip', 'Đang tắt Suy luận sâu');
      setStatus(deepNote('Đang soạn công văn…')); step('write', 'run', deepOn() ? 'Đang suy luận & viết' : 'Đang viết');
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
      if (st.steps) for (const name of STEP_NAMES) if (st.steps[name] && st.steps[name].state === 'run') st.steps[name] = {state: 'err', text: 'Lỗi'};
    } finally {
      if (my === generation) {
        st.busy = ''; st.status = ''; st.agentOpen = false; renderAll();
        if (st.pending) $('.ola-review')?.scrollIntoView({block:'nearest', behavior:'auto'});
      }
    }
  }

  // Ngữ cảnh dùng chung cho bước suy luận và bước soạn.
  function composeCtx(attachments) {
    return {outline: st.outline.filter(item => item.on).map(item => item.text).filter(text => Core().single(text, 1)), extras: st.extras, answers: answeredList(), understanding: st.understanding,
      keyFacts: st.keyFacts, insights: st.insights, dossier: dossierText(), legal: legalPrompt(), legalPinned: pinnedLabel(), assumptions: st.assumptions, openQuestions: openQuestions(), files: attachments || [], reasoning: st.reasoning};
  }
  async function composeCore(instruction, attachments) {
    const tpl = template();
    const issuer = loadIssuer();
    const previous = instruction && st.letter ? st.letter.paragraphs.map(p => p.text).join('\n') : '';
    const brief = st.brief + (instruction ? '\nYÊU CẦU CHỈNH SỬA MỚI NHẤT: ' + instruction : '');
    const ctx = composeCtx(attachments);
    if (instruction) ctx.reasoning = null;   // chỉnh theo yêu cầu mới: kế hoạch lập luận ban đầu có thể đã lỗi thời, yêu cầu mới có hiệu lực cao nhất
    const raw = await callAI(Core().buildComposeRequest(tpl, st.values, issuer, brief, previous, ctx), deepOpts());
    const parsed = Core().parseLetter(raw);
    const date = st.letter && st.letter.date, number = st.letter && st.letter.number;
    const candidate = Core().assembleLetter(tpl, st.values, issuer, parsed, date);
    if (number) candidate.number = number;
    // Khi chỉnh bản có sẵn, giữ phần thể thức người dùng đã sửa tay.
    return instruction && st.letter ? {...st.letter, subject:candidate.subject, paragraphs:candidate.paragraphs, warnings:candidate.warnings} : candidate;
  }

  // Soạn lại (sau khi sửa chi tiết) hoặc chỉnh theo yêu cầu — không đọc lại hồ sơ.
  async function compose(instruction, questionAnswer) {
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
      setStatus(deepNote(instruction ? 'Đang chỉnh công văn theo yêu cầu…' : 'Đang soạn lại công văn…'));
      step('write', 'run', targets.length ? 'Chỉ chỉnh phần được chọn' : 'Đang viết nội dung');
      let candidate;
      if (targets.length) {
        const base = Core().buildComposeRequest(template(), st.values, loadIssuer(), st.brief, '', {dossier:dossierText(), legal:legalPrompt(), legalPinned:pinnedLabel(), files:attachments});
        const raw = await callAI(Revisions().buildRequest(base, before, targets, instruction), deepOpts());
        if (my !== generation) return;
        candidate = Revisions().parsePatch(raw, before, targets);
      } else candidate = await composeCore(instruction || '', attachments);
      if (my !== generation) return;
      if (sent.length) { st.refineFiles = st.refineFiles.filter(item => !sent.includes(item)); releaseFiles(sent); }
      if (before) {
        const changes = Revisions().changes(before, candidate);
        st.pending = changes.length ? {before, changes, instruction:instruction || 'Soạn lại theo chi tiết', scoped:!!targets.length, questionAnswer: questionAnswer || null} : null;
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
      const response = st.pending.questionAnswer, question = response && st.questions[response.index];
      if (question && question.question === response.question) {
        question.answer = response.answer; delete st.questionDrafts[response.question];
        if (question.key && st.values) st.values[question.key] = response.answer;
      }
      checkpoint(st.pending.scoped ? 'AI sửa đoạn được chọn' : 'AI chỉnh công văn');
      st.pending = null; st.selection = []; notice('');
      renderAll(); saveHistory(); toast('Đã áp dụng ' + selected + ' thay đổi.', 'success');
    } catch (error) { toast(error.message, 'warning'); }
  }
  function discardChanges() { st.pending = null; renderAll(); toast('Đã bỏ đề xuất; bản thảo được giữ nguyên.', 'info'); }
  function answerQuestion(index, answer) {
    const item = st.questions[index], text = String(answer || '').trim();
    if (!item || item.answer || !text || st.busy || st.pending) return;
    st.selection = [];
    return compose(item.question + ' → ' + text, {index, question:item.question, answer:text});
  }
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
    return st.selection.length ? '<span>Đang sửa đoạn đã chọn: “' + esc(st.selection.map(item => item.text).join(' ').slice(0, 140)) + '”</span><button type="button" class="ol-link" data-ol-act="clear-selection">Bỏ chọn</button>' : '';
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
  // Tạo file Word từ bản thảo hiện tại (dùng chung cho "Tải Word" và "Lưu vào hồ sơ").
  async function buildDocx() {
    if (typeof JSZip === 'undefined') { toast('Chưa tải được thư viện tạo Word. Kiểm tra mạng rồi thử lại.', 'warning'); return null; }
    syncLetter();
    const unverified = citationChecks().filter(item => !item.ok).length;
    if (unverified) toast('Lưu ý: còn ' + unverified + ' căn cứ chưa kiểm chứng với thư viện — kiểm tra trước khi ký.', 'warning');
    const zip = new JSZip();
    Core().docxFiles(st.letter, st.letter.title || st.letter.subject).forEach(file => zip.file(file.path, file.bytes || file.text, {createFolders: false}));
    const blob = await zip.generateAsync({type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
    return {blob, name: Core().fileBaseName(st.letter, st.values) + '.docx', gaps: Core().countGaps(st.letter)};
  }
  async function downloadDocx() {
    if (!st.letter) return;
    try {
      const docx = await buildDocx();
      if (!docx) return;
      SharedFormsAI.saveBlob(docx.blob, docx.name);
      toast(docx.gaps ? 'Đã tải Word. Còn ' + docx.gaps + ' chỗ "……" cần điền tay.' : 'Đã tải file Word.', docx.gaps ? 'warning' : 'success');
      saveHistory();
    } catch (error) { toast('Không tạo được file Word: ' + (error.message || error), 'error'); }
  }
  // Lưu bản Word vào kho Drive của hồ sơ đang chọn. Kho này chỉ có cho "Hồ sơ tồn" (pending_claims).
  async function saveToRecord() {
    if (!st.letter || st.savingRecord) return;
    const found = chosenRecord();
    if (!found) { toast('Chưa chọn hồ sơ. Bấm chip "Hồ sơ" ở thanh soạn để chọn hồ sơ cần lưu công văn vào.', 'warning'); return; }
    const Docs = typeof ClaimDocuments !== 'undefined' ? ClaimDocuments : null;
    const claimId = Docs ? Docs.claimIdFromKey(found.row.key) : '';
    if (!claimId) { toast('Hồ sơ giám định chưa có kho tài liệu — chỉ lưu được vào "Hồ sơ tồn". Hãy tải Word về máy.', 'warning'); return; }
    if (!Docs.hasStorage()) { toast('Kho Drive hồ sơ chưa được kích hoạt. Hãy tải Word về máy.', 'warning'); return; }
    const owner = typeof firebase !== 'undefined' && firebase.auth().currentUser ? firebase.auth().currentUser.uid : '';
    if (!owner) { toast('Cần đăng nhập để lưu vào hồ sơ.', 'warning'); return; }
    syncLetter();   // chốt các chỉnh sửa tay trước khi vẽ lại giao diện
    st.savingRecord = true; renderAll();
    try {
      const docx = await buildDocx();
      if (!docx) return;
      const label = recordLabel(found.info);
      const result = await Docs.saveWord(docx.blob, docx.name, {id: claimId, owner}, {notify: false});
      if (result.ok) {
        toast('Đã lưu "' + docx.name + '" vào hồ sơ ' + label + (docx.gaps ? '. Còn ' + docx.gaps + ' chỗ "……" cần điền tay.' : '.'), docx.gaps ? 'warning' : 'success');
        saveHistory();
      } else if (result.reason === 'error') toast('Chưa lưu được vào hồ sơ: ' + (result.error || 'lỗi kho Drive') + ' Mở hồ sơ → Tài liệu hồ sơ để thử lại, hoặc tải Word về máy.', 'error');
      else toast('Không lưu được vào hồ sơ (phiên đăng nhập hoặc kho Drive không sẵn sàng). Hãy tải Word về máy.', 'warning');
    } catch (error) { toast('Không tạo được file Word: ' + (error.message || error), 'error'); }
    finally { st.savingRecord = false; if (host) renderAll(); }
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

  // ================= HỎI NGHIỆP VỤ =================
  // Hỏi đáp trên Thư viện tài liệu: tìm đoạn khớp (BM25) → DeepSeek trả lời CHỈ dựa trên các đoạn đó, dẫn mã [C#]; bấm mã để xem nguyên văn.
  // Hội thoại lưu trên máy (localStorage), tách hẳn khỏi phiên soạn công văn; dùng chung khoá DeepSeek, hồ sơ đang chọn và ô "Quy tắc".
  const QA_KEY = 'officialLetter.qa.v1', QA_CHATS_KEY = 'officialLetter.qaChats.v1', QA_MAX_CHATS = 30, MODE_KEY = 'officialLetter.mode.v1';
  const qa = {messages: [], draft: '', importFile: null, since: 0, status: '', usage: null, open: Object.create(null), loaded: false, deep: true, chats: [], activeId: '', free: false, lib: false, attach: [], attaching: false};
  // Bộ đếm giây của lượt trả lời: mốc bắt đầu được ghi mỗi khi qa.busy chuyển false → true (mọi luồng hỏi đáp đều đi qua đây).
  let qaBusyFlag = false, qaTicker = 0;
  Object.defineProperty(qa, 'busy', {enumerable: true, get: () => qaBusyFlag, set: value => { value = !!value; if (value && !qaBusyFlag) qa.since = Date.now(); qaBusyFlag = value; }});
  const qaElapsed = () => Math.max(0, Math.round((Date.now() - (qa.since || Date.now())) / 1000));
  const fmtSecs = n => n < 60 ? n + ' giây' : Math.floor(n / 60) + ' phút ' + String(n % 60).padStart(2, '0') + ' giây';
  const QA_SLOW_SECS = 30;   // quá mốc này thì đồng hồ đổi sang màu cảnh báo nhẹ: mô hình đang chậm hơn thường lệ
  function paintQaTimer() {
    if (!host || !qa.busy) return;
    const secs = qaElapsed();
    host.querySelectorAll('[data-ol-qa-timer]').forEach(node => { node.textContent = fmtSecs(secs); node.classList.toggle('is-slow', secs >= QA_SLOW_SECS); node.title = secs >= QA_SLOW_SECS ? 'Mô hình đang trả lời chậm hơn thường lệ — có thể bấm Dừng rồi thử lại hoặc chọn mô hình khác' : 'Thời gian AI đã làm việc'; });
  }
  const DEEP_KEY = 'officialLetter.qaDeep.v1', LIB_KEY = 'officialLetter.freeLib.v1';
  // Nhiều cuộc trò chuyện: qa.messages/qa.usage là cuộc đang mở; qa.chats là toàn bộ danh sách lưu trên máy (v2), tự chuyển từ bản v1 một cuộc.
  // Quy tắc (văn bản căn cứ) đã chọn thuộc về TỪNG cuộc trò chuyện: lưu cùng cuộc, mở lại cuộc nào thì chip Quy tắc về đúng lựa chọn của cuộc đó; cuộc mới bắt đầu ở "Tự động".
  const pinList = value => (Array.isArray(value) ? value : []).map(String).filter(Boolean).slice(0, 20);
  function qaApplyPin() {
    const chat = qa.chats.find(item => item.id === qa.activeId);
    st.legalPin = chat ? pinList(chat.pin) : [];
    if (!st.legalPin.length) return;
    // Tên văn bản chưa nạp (vừa mở trang) → nạp rồi chỉ vẽ lại chip, không vẽ lại cả trang để khỏi mất chữ đang gõ; bỏ id của văn bản đã bị xoá khỏi thư viện.
    const mine = qa.activeId;
    loadLibDocs().then(() => {
      if (!host || st.mode !== 'ask' || mine !== qa.activeId || !st.libDocs) return;
      if (st.libDocs.length) st.legalPin = st.legalPin.filter(id => st.libDocs.some(doc => doc.id === id));
      const chip = $('[data-ol-pop="rules"]');
      if (chip) { chip.classList.toggle('is-set', st.legalPin.length > 0); const text = chip.querySelector('.ola-chip-t'); if (text) text.textContent = ruleLabelText(); }
    }).catch(() => {});
  }
  function loadQa() {
    if (qa.loaded) return;
    qa.loaded = true;
    const Q = QA();
    try {
      if (Q) {
        const raw = JSON.parse(localStorage.getItem(QA_CHATS_KEY) || 'null');
        if (raw && Array.isArray(raw.chats)) {
          qa.chats = raw.chats.map(chat => ({id: String(chat.id || Q.newId()), title: String(chat.title || '').slice(0, 90), at: Number(chat.at) || 0, usage: chat.usage || null, free: !!chat.free, named: !!chat.named, pin: pinList(chat.pin), messages: Q.normalizeStore({messages: chat.messages})})).filter(chat => chat.messages.length).slice(0, QA_MAX_CHATS);
          const active = qa.chats.find(chat => chat.id === raw.active);
          if (active) { qa.activeId = active.id; qa.messages = active.messages; qa.usage = active.usage; qa.free = !!active.free; }
        } else {
          const old = Q.normalizeStore(JSON.parse(localStorage.getItem(QA_KEY) || 'null'));
          if (old.length) { qa.messages = old; qa.activeId = Q.newId(); qaSyncActive(); }
        }
      }
    } catch (_) { /* bỏ qua */ }
    try { const mode = localStorage.getItem(MODE_KEY); if ((mode === 'ask' || mode === 'chat') && QA()) { st.mode = 'ask'; if ((mode === 'chat') !== qa.free) qaSwitchKind(mode === 'chat', true); } qa.deep = localStorage.getItem(DEEP_KEY) !== '0'; qa.lib = localStorage.getItem(LIB_KEY) === '1'; if (st.mode === 'ask') qaApplyPin(); } catch (_) { /* bỏ qua */ }
  }
  function qaTitleOf(messages) {
    const first = messages.find(item => item.role === 'user');
    const text = String(first ? first.text : 'Cuộc trò chuyện').replace(/\s+/g, ' ').trim();
    return text.length > 70 ? text.slice(0, 69) + '…' : text;
  }
  // Ghi cuộc đang mở vào danh sách (cuộc mới được tạo khi có tin nhắn đầu tiên).
  function qaSyncActive() {
    if (!qa.messages.length) return;
    if (!qa.activeId) qa.activeId = QA().newId();
    let chat = qa.chats.find(item => item.id === qa.activeId);
    if (!chat) { chat = {id: qa.activeId, title: '', at: 0, usage: null, free: qa.free, messages: []}; qa.chats.unshift(chat); }
    chat.messages = qa.messages; chat.usage = qa.usage; if (!chat.named) chat.title = qaTitleOf(qa.messages);   // tên người dùng đặt thì không bị ghi đè bằng câu hỏi đầu
    chat.at = Date.now();
    if (st.mode === 'ask') chat.pin = pinList(st.legalPin);   // ở Soạn công văn st.legalPin là của công văn, không ghi vào cuộc trò chuyện
    qa.chats.sort((a, b) => b.at - a.at);
    if (qa.chats.length > QA_MAX_CHATS) qa.chats.length = QA_MAX_CHATS;
  }
  function saveQa() {
    qaSyncActive();
    const pack = (keepSources) => JSON.stringify({active: qa.activeId, chats: qa.chats.map(chat => ({id: chat.id, title: chat.title, at: chat.at, usage: chat.usage, free: !!chat.free, named: !!chat.named, pin: pinList(chat.pin), messages: chat.messages.slice(-24).map(item => (keepSources || chat.id === qa.activeId) ? item : {...item, sources: []})}))});
    // Hết chỗ lưu thì bỏ nguồn của các cuộc cũ, rồi bỏ bớt cuộc cũ nhất; cuộc đang mở luôn được giữ.
    try { localStorage.setItem(QA_CHATS_KEY, pack(true)); }
    catch (_) {
      try { localStorage.setItem(QA_CHATS_KEY, pack(false)); }
      catch (__) {
        try { while (qa.chats.length > 1) { qa.chats.pop(); try { localStorage.setItem(QA_CHATS_KEY, pack(false)); break; } catch (___) { /* thử tiếp */ } } } catch (____) { /* giữ trong phiên */ }
      }
    }
    if (host && st.histOpen && st.mode === 'ask') updateHistory(true);
  }
  function resetQaView() { qa.messages = []; qa.usage = null; qa.open = Object.create(null); qa.draft = ''; qa.importFile = null; qa.attach = []; qa.status = ''; }
  // Hai loại cuộc trò chuyện dùng chung kho lưu: Hỏi nghiệp vụ (free=false) và Trò chuyện AI (free=true). Đổi loại → mở cuộc gần nhất của loại đó.
  const qaKindChats = free => qa.chats.filter(chat => !!chat.free === !!free);
  function qaSwitchKind(free, quiet) {
    if (!quiet) saveQa();
    qa.free = !!free;
    const pick = qaKindChats(free).find(chat => chat.id === qa.activeId) || qaKindChats(free)[0];
    if (pick) { qa.activeId = pick.id; qa.messages = pick.messages; qa.usage = pick.usage; qa.open = Object.create(null); qa.draft = ''; qa.importFile = null; qa.attach = []; }
    else { qa.activeId = ''; resetQaView(); }
    qaApplyPin();
  }
  function newQaChat() {
    if (qa.busy) return;
    exitHistSelect();
    if (!qa.messages.length) { renderAll(); focusMain(); return; }
    saveQa();
    qa.activeId = ''; resetQaView(); st.legalPin = [];
    renderAll(); focusMain();
  }
  function openQaChat(id) {
    if (qa.busy || id === qa.activeId) return;
    const chat = qa.chats.find(item => item.id === id);
    if (!chat) return;
    saveQa();
    qa.activeId = chat.id; qa.messages = chat.messages; qa.usage = chat.usage; qa.free = !!chat.free; qa.open = Object.create(null); qa.draft = ''; qa.importFile = null; qa.attach = []; qaApplyPin();
    saveQa();
    renderAll(); scrollQa(); focusMain();
  }
  async function deleteQaChat(id) {
    if (qa.busy) return;
    const chat = qa.chats.find(item => item.id === id);
    if (!chat && id !== qa.activeId) return;
    if (!await askConfirm({eyebrow: qa.free ? 'TRÒ CHUYỆN AI' : 'HỎI NGHIỆP VỤ', title: 'Xoá cuộc trò chuyện?', message: '"' + (chat ? chat.title : 'Cuộc trò chuyện này') + '" sẽ bị xoá khỏi máy này và không khôi phục được.', confirmText: 'Xoá'})) return;
    qa.chats = qa.chats.filter(item => item.id !== id);
    if (id === qa.activeId) { qa.activeId = ''; resetQaView(); }
    saveQa();
    if (!qa.chats.length) try { localStorage.removeItem(QA_CHATS_KEY); } catch (_) { /* bỏ qua */ }
    renderAll(); focusMain();
  }
  const qaLocked = () => !!(st.busy || st.pending || qa.busy);
  // Ba chế độ: compose (Soạn công văn) · ask (Hỏi nghiệp vụ, tra Thư viện) · chat (Trò chuyện AI, hỏi mọi thứ). ask và chat cùng st.mode = 'ask', khác qa.free.
  const modeId = () => st.mode === 'ask' ? (qa.free ? 'chat' : 'ask') : 'compose';
  function setMode(mode) {
    if (mode === modeId() || ((mode === 'ask' || mode === 'chat') && !QA()) || qaLocked()) return;
    collectAll();
    exitHistSelect();
    if (st.mode === 'compose' && mode !== 'compose') st.composePin = st.legalPin.slice();   // quy tắc của Soạn công văn không bị lẫn với quy tắc của cuộc trò chuyện
    if (mode !== 'compose') qaSwitchKind(mode === 'chat');
    else if (st.mode !== 'compose') st.legalPin = pinList(st.composePin);
    st.mode = mode === 'compose' ? 'compose' : 'ask'; st.pop = ''; st.recQuery = ''; st.histQuery = '';
    try { localStorage.setItem(MODE_KEY, mode); } catch (_) { /* bỏ qua */ }
    renderAll();
    focusMain();
    if (mode !== 'compose') scrollQa();
  }
  const focusMain = (preventScroll = false) => ($('[data-ol-qa-input]') || $('[data-ol-brief]'))?.focus({preventScroll});
  function scrollQa() { const box = $('[data-ol-qa-scroll]'); if (box) box.scrollTop = box.scrollHeight; }
  function paintQaStatus(text) { if (text !== undefined) qa.status = text; host?.querySelectorAll('[data-ol-qa-status]').forEach(node => { node.textContent = qa.status; }); }
  function paintQaUsage() {
    const node = $('[data-ol-qa-usage]');
    if (node) { node.textContent = usageText(qa.usage); node.title = usageTitle(qa.usage); node.hidden = !usageText(qa.usage); }
  }
  const NO_MATCH = 'Thư viện tài liệu chưa có đoạn nào khớp câu hỏi này. Hãy thử nêu bằng thuật ngữ trong văn bản (VD "giảm trừ", "loại trừ", "thời hạn"), chọn đúng văn bản ở nút Quy tắc, hoặc nạp thêm văn bản vào Thư viện tài liệu.';
  async function importQaRule(question, content, file) {
    if (typeof TascoLibrary === 'undefined' || !TascoLibrary.importFromChat) { toast('Chưa tải được thư viện tài liệu. Hãy tải lại trang.', 'warning'); return; }
    if (!file && !content) { toast('Hãy dán nội dung quy tắc sau yêu cầu hoặc đính kèm tệp.', 'warning'); return; }
    const chatId = qa.activeId;
    qa.busy = true; qa.status = 'Đang đọc tài liệu để thêm vào thư viện…'; renderAll();
    try {
      await TascoLibrary.importFromChat({text:content, file, onSaved: ({meta}) => {
        st.libDocs = null;
        if (chatId !== qa.activeId) return;
        const Q = QA();
        qa.messages.push({id:Q.newId(), role:'user', text: file ? (question || 'Thêm quy tắc vào thư viện') + '\nTệp: ' + file.name : 'Thêm quy tắc vào thư viện: ' + (meta.ten || 'Quy tắc')});
        qa.messages.push({id:Q.newId(), role:'assistant', text:'Đã lưu “' + (meta.ten || 'Quy tắc') + '” vào Thư viện tài liệu. Bạn có thể hỏi nghiệp vụ hoặc chọn tài liệu này khi soạn công văn.', chat:true, sources:[]});
        qa.importFile = null; qa.attach = []; qa.draft = ''; saveQa();
        if (host && st.mode === 'ask') { renderAll(); scrollQa(); }
      }});
    } catch (error) { toast(error.message || 'Không đọc được tài liệu.', 'warning'); }
    finally { qa.busy = false; qa.status = ''; if (host && st.mode === 'ask') renderAll(); }
  }
  // ---- Trò chuyện AI: đính kèm ảnh/tệp, tra Thư viện (tuỳ chọn) ----
  const ATTACH_MAX = 5, IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;
  async function addQaFiles(list) {
    const files = [...(list || [])].filter(Boolean);
    if (!files.length) return;
    if (qa.busy || qa.attaching) return;
    const room = ATTACH_MAX - qa.attach.length;
    if (room <= 0) { toast('Mỗi câu hỏi đính kèm tối đa ' + ATTACH_MAX + ' tệp.', 'warning'); return; }
    if (files.length > room) toast('Chỉ nhận thêm ' + room + ' tệp (tối đa ' + ATTACH_MAX + ').', 'warning');
    qa.attaching = true; renderAll();
    const chatId = qa.activeId, errors = [];
    for (const file of files.slice(0, room)) {
      try {
        const isImage = /^image\//i.test(file.type || '') || IMAGE_EXT.test(file.name);
        if (isImage) {
          if (typeof SceneReportAI === 'undefined' || !SceneReportAI.prepare) throw new Error('Chưa tải được mô-đun đọc ảnh. Hãy tải lại trang.');
          const photo = await SceneReportAI.prepare(file.type ? file : new File([file], file.name, {type: 'image/jpeg'}));
          qa.attach.push({file, kind: 'image', name: photo.name, mimeType: photo.mimeType, data: photo.data, preview: photo.preview});
        } else {
          if (typeof TascoLibParse === 'undefined' || !TascoLibParse.readText) throw new Error('Chưa tải được mô-đun đọc tệp. Hãy tải lại trang.');
          let apiKey = '';
          if (/\.pdf$/i.test(file.name)) { try { apiKey = await Models().getKey('gemini') || ''; } catch (_) { /* PDF có chữ vẫn đọc được */ } }
          const read = await TascoLibParse.readText(file, {apiKey, signal: controller ? controller.signal : undefined});
          if (!read.text) throw new Error('"' + file.name + '" không có chữ để đọc (tệp trống hoặc là ảnh quét).');
          const Q = QA(), max = Q.FILE_CHARS;
          qa.attach.push({file, kind: 'text', name: file.name, text: read.text.slice(0, max), truncated: read.text.length > max, note: read.note || ''});
        }
      } catch (error) { errors.push(error && error.message ? error.message : 'Không đọc được "' + file.name + '".'); }
    }
    qa.attaching = false;
    if (errors.length) toast(errors[0] + (errors.length > 1 ? ' (+' + (errors.length - 1) + ' tệp lỗi khác)' : ''), 'warning');
    if (host && st.mode === 'ask' && chatId === qa.activeId) renderAll();
  }
  async function askFree(question) {
    const Q = QA(), L = Legal();
    const input = $('[data-ol-qa-input]');
    const attach = qa.attach.slice();
    if (!question && !attach.length) { input?.focus(); return; }
    const text = question || 'Hãy đọc và tóm tắt nội dung tệp/ảnh đính kèm.';
    const history = qa.messages.slice();
    const files = attach.filter(item => item.kind === 'text').map(item => ({name: item.name, text: item.text, truncated: item.truncated, note: item.note}));
    const images = attach.filter(item => item.kind === 'image');
    qa.messages.push({id: Q.newId(), role: 'user', text, files: attach.map(item => ({name: item.name, kind: item.kind, text: item.kind === 'text' ? item.text : '', truncated: item.truncated}))});
    qa.draft = ''; qa.attach = []; qa.busy = true; qa.status = 'Đang soạn câu trả lời…'; st.pop = '';
    const mine = generation, forceDeep = qaDeepOnce; qaDeepOnce = false;
    renderAll(); scrollQa();
    const reply = message => { if (mine !== generation || !host) return; qa.messages.push(Object.assign({id: Q.newId(), role: 'assistant', sources: [], question: text, free: true, secs: qaElapsed()}, message)); };
    const usage = {onUsage: u => { qa.usage = OfficialLetterAI.addUsage(qa.usage, u); paintQaUsage(); }, onWait: t => paintQaStatus(t), resumeText: qa.status};
    try {
      let sources = [], queries = [];
      let read = null;
      if (qa.lib && L) {
        paintQaStatus('Đang đọc Thư viện tài liệu…');
        queries = Q.buildQueries(text, history, {issue: '', queries: []});
        const found = await gatherSources(queries, history);
        if (mine !== generation || !host) return;
        sources = found.sources; read = found.read;
        if (found.error && !sources.length) toast(found.error, 'warning');
      }
      if (images.length && activeModel() && !activeModel().profile.vision) toast('Mô hình đang chọn có thể không đọc được ảnh — hãy chọn mô hình có hỗ trợ ảnh (Gemini, GPT-4o…) nếu AI không thấy ảnh.', 'warning');
      const quick = deepOn() && !forceDeep && Q.isQuickQuestion(text, {attach: attach.length, dossier: !!dossierText()});
      const thinking = deepOn() && !quick;
      paintQaStatus(thinking ? 'Đang suy luận sâu (có thể mất 30–90 giây)…' : quick ? 'Câu hỏi ngắn — đang trả lời nhanh…' : 'Đang soạn câu trả lời…');
      usage.resumeText = qa.status;
      const answer = await callAI(Q.buildFreeRequest({question: text, history, dossier: dossierText(), files, images, sources, read}), Object.assign({thinking, effort: 'high'}, usage));
      const answerText = String(answer).trim(), cited = Q.citedCodes(answerText);
      reply({quick: quick || undefined, text: answerText, sources: read ? sources.filter(source => cited.includes(source.code)) : sources, queries, read: read || undefined});
    } catch (error) {
      if (error && error.name === 'AbortError') {
        qa.busy = false; qa.status = '';
        if (mine === generation && host) { reply({text: 'Đã dừng theo yêu cầu của bạn.', empty: true}); saveQa(); if (st.mode === 'ask') { renderAll(); scrollQa(); } }
        return;
      }
      reply({text: (error && error.message) || 'Không gọi được AI. Hãy thử lại.', error: true});
    }
    if (mine !== generation || !host) { qa.busy = false; return; }
    qa.busy = false; qa.status = '';
    saveQa();
    if (st.mode === 'ask') { renderAll(); scrollQa(); }
  }
  function exportChat() {
    const Q = QA();
    if (!Q || !qa.messages.length) return;
    const md = Q.exportMarkdown({title: qaTitleOf(qa.messages), messages: qa.messages});
    const url = URL.createObjectURL(new Blob([md], {type: 'text/markdown;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url; link.download = 'tro-chuyen-ai-' + new Date().toISOString().slice(0, 10) + '.md';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  // Gom căn cứ cho một lượt hỏi. Ưu tiên cấp TOÀN VĂN văn bản (AI tự rà loại trừ/ngoại lệ/bảng như người đọc quy tắc); văn bản quá dài so với ngân sách của mô hình
  // thì phần đó tra theo đoạn. Không đọc được toàn văn → quay về tra đoạn + mang nguồn của câu trả lời trước.
  async function gatherSources(queries, history) {
    const Q = QA(), L = Legal();
    if (!L) return {sources: [], fresh: 0, error: 'Chưa tải được mô-đun thư viện. Hãy tải lại trang.', read: null};
    const small = modelCap('maxSources');
    const options = ids => Object.assign({limit: Math.min(Q.SOURCE_LIMIT, small || Q.SOURCE_LIMIT), minCoverage: Q.QA_COVERAGE, expand: true, maxSources: Math.min(Q.MAX_SOURCES, small || Q.MAX_SOURCES), perArticle: 2}, ids && ids.length ? {docIds: ids} : {});
    const read = L.readFull ? await L.readFull(queries, {docIds: st.legalPin, budget: small ? 24000 : undefined}) : null;
    if (read && read.sources.length) {
      let sources = read.sources;
      if (read.skipped.length) {
        const extra = await L.retrieve(queries, options(read.skipped.map(doc => doc.id)));
        sources = L.renumber(sources.concat(extra.sources.map(source => ({...source, via: source.via || 'trích đoạn từ văn bản quá dài để đọc toàn văn'}))));
      }
      return {sources, fresh: sources.length, error: '', read: {included: read.included, skipped: read.skipped}};
    }
    const found = await L.retrieve(queries, options(st.legalPin));
    return {sources: Q.carrySources(history, found.sources), fresh: found.sources.length, error: found.error || (read && read.error) || '', read: null};
  }
  async function askQuestion(text) {
    const Q = QA(), L = Legal();
    if (!Q || qa.busy) return;
    const input = $('[data-ol-qa-input]');
    const question = String(text !== undefined ? text : (input ? input.value : qa.draft)).trim();
    if (qa.free) { await askFree(question); return; }
    const request = Q.importRequest(question);
    // Có tệp đính kèm: chỉ nạp vào Thư viện khi người dùng nói rõ ("thêm vào thư viện…") hoặc không hỏi gì; còn lại tệp/ảnh là tư liệu của câu hỏi.
    if (request.intent || (!question && qa.attach.length)) { await importQaRule(question, request.content, qa.attach.length ? qa.attach[0].file : null); return; }
    if (!question) { input?.focus(); return; }
    const history = qa.messages.slice();
    const attach = qa.attach.slice();
    const askFiles = attach.filter(item => item.kind === 'text').map(item => ({name: item.name, text: item.text, truncated: item.truncated, note: item.note}));
    const askImages = attach.filter(item => item.kind === 'image');
    qa.messages.push({id: Q.newId(), role: 'user', text: question, files: attach.map(item => ({name: item.name, kind: item.kind, text: item.kind === 'text' ? item.text : '', truncated: item.truncated}))});
    qa.draft = ''; qa.attach = []; qa.busy = true; qa.status = 'Đang tra Thư viện tài liệu…'; st.pop = '';
    const mine = generation, forceDeep = qaDeepOnce; qaDeepOnce = false;
    renderAll(); scrollQa();
    const reply = message => { if (mine !== generation || !host) return; qa.messages.push(Object.assign({id: Q.newId(), role: 'assistant', sources: [], question, secs: qaElapsed()}, message)); };
    const usage = {onUsage: u => { qa.usage = OfficialLetterAI.addUsage(qa.usage, u); paintQaUsage(); }, onWait: text => paintQaStatus(text), resumeText: qa.status};
    try {
      const dossier = dossierText();
      // Bước 1 — AI đổi câu hỏi khẩu ngữ thành vấn đề + các cụm tra theo ngôn ngữ của quy tắc. Lỗi ở bước này không chặn việc trả lời (còn từ điển nghiệp vụ cố định).
      let plan = {issue: '', queries: []};
      // Chào hỏi / hỏi về trợ lý: trả lời tự nhiên, không tra Thư viện và không dẫn nguồn.
      let chat = Q.isSmallTalk(question);
      if (!chat && L) {
        paintQaStatus('Đang phân tích câu hỏi…');
        try { plan = Q.parsePlan(await callAI(Q.buildPlanRequest(question, history), usage)); }
        catch (error) { if (error && (error.name === 'AbortError' || error.message === NO_KEY)) throw error; }
        if (mine !== generation || !host) return;
        chat = !!plan.chat;
      }
      if (chat) {
        paintQaStatus('Đang soạn câu trả lời…');
        const answer = await callAI(Q.buildChatRequest({question, history}), usage);
        reply({text: String(answer).trim(), chat: true});
        qa.busy = false; qa.status = '';
        if (mine !== generation || !host) return;
        saveQa();
        if (st.mode === 'ask') { renderAll(); scrollQa(); }
        return;
      }
      // Bước 2 — đọc TOÀN VĂN các văn bản trong Thư viện (BM25 chỉ còn xếp thứ tự khi quá dài); không vừa/không đọc được thì tra đoạn như cũ.
      const queries = Q.buildQueries(question, history, plan);
      paintQaStatus('Đang đọc Thư viện tài liệu…');
      const found = await gatherSources(queries, history);
      if (mine !== generation || !host) return;
      const sources = found.sources;
      if (!sources.length && (found.error || (!history.some(item => item.role === 'assistant' && !item.chat && !item.empty && !item.error) && !dossier))) {
        // Không có căn cứ nào để trả lời → không gọi AI (tránh tốn token và tránh AI trả lời bằng trí nhớ).
        reply({text: found.error || NO_MATCH, empty: true, queries});
      } else {
        // Bước 3 — suy luận trên văn bản đã cấp. Câu hỏi tra cứu ngắn chạy chế độ nhanh (không suy luận sâu); người dùng vẫn bấm "Suy luận sâu lại" được.
        const quick = deepOn() && !forceDeep && Q.isQuickQuestion(question, {attach: askFiles.length + askImages.length, dossier: !!dossier});
        const thinking = deepOn() && !quick;
        paintQaStatus((found.read ? 'Đã đọc toàn văn ' + found.read.included.map(doc => doc.name).join(', ') + ' (' + found.read.included.reduce((sum, doc) => sum + doc.chunks, 0) + ' đoạn) — ' : sources.length ? 'Tìm thấy ' + found.fresh + ' đoạn liên quan' + (sources.length > found.fresh ? ' (+' + (sources.length - found.fresh) + ' đoạn đã dẫn ở câu trước)' : '') + ' — ' : 'Đang trả lời theo hội thoại — ') + (thinking ? 'đang suy luận sâu (có thể mất 30–90 giây)…' : quick ? 'câu hỏi ngắn nên trả lời nhanh…' : 'đang soạn câu trả lời…'));
        usage.resumeText = qa.status;
        const answer = await callAI(Q.buildRequest({question, history, sources, libraryError: found.error, dossier, issue: plan.issue, files: askFiles, images: askImages, read: found.read}), Object.assign({thinking, effort: 'high'}, usage));
        const text = String(answer).trim();
        // Đọc toàn văn có hàng trăm đoạn: chỉ lưu và hiển thị các đoạn AI thực sự dẫn.
        const cited = Q.citedCodes(text);
        reply({quick: quick || undefined, text, sources: found.read ? sources.filter(source => cited.includes(source.code)) : sources, queries, issue: plan.issue, read: found.read || undefined});
      }
    } catch (error) {
      if (error && error.name === 'AbortError') {
        qa.busy = false; qa.status = '';
        if (mine === generation && host) { reply({text: 'Đã dừng theo yêu cầu của bạn.', empty: true}); saveQa(); if (st.mode === 'ask') { renderAll(); scrollQa(); } }
        return;
      }
      reply({text: (error && error.message) || 'Không gọi được AI. Hãy thử lại.', error: true});
    }
    if (mine !== generation || !host) { qa.busy = false; return; }
    qa.busy = false; qa.status = '';
    saveQa();
    if (st.mode === 'ask') { renderAll(); scrollQa(); }
  }
  async function composeFromAnswer(id) {
    const Q = QA(), msg = qa.messages.find(item => item.id === id);
    if (!Q || !msg || qaLocked()) return;
    if (st.letter) { clearTimeout(saveTimer); if (st.historyId) saveHistory(); }
    else if (st.values && !(await confirmDiscard())) return;
    const recordKey = st.recordKey;
    if (st.letter || st.values) reset();
    st.recordKey = recordKey;
    const sources = msg.sources || [];
    const docs = [...new Set(Q.citedCodes(msg.text).map(code => sources.find(source => source.code === code)).filter(Boolean).map(docOf))];
    if (docs.length === 1) { st.legalPin = docs; loadLibDocs().then(() => { if (host && st.mode === 'compose' && !st.letter) renderAll(); }); }
    const body = Q.plainText(msg.text).replace(/\s*\[C\d{1,3}\]/g, '').slice(0, 1500);
    st.brief = 'Soạn công văn dựa trên kết luận nghiệp vụ sau (đã tra trong Thư viện tài liệu):\n' + body + '\n\nYêu cầu soạn: ';
    st.mode = 'compose';
    try { localStorage.setItem(MODE_KEY, 'compose'); } catch (_) { /* bỏ qua */ }
    renderAll();
    const area = $('[data-ol-brief]'); if (area) { area.focus(); area.setSelectionRange(area.value.length, area.value.length); }
  }
  async function copyAnswer(id) {
    const msg = qa.messages.find(item => item.id === id);
    if (!msg) return;
    try { await navigator.clipboard.writeText(QA().plainText(msg.text)); toast('Đã sao chép câu trả lời.', 'success'); }
    catch (_) { toast('Không sao chép được. Hãy bôi đen nội dung rồi nhấn Ctrl+C.', 'warning'); }
  }
  function retryAnswer(id, deep) {
    const at = qa.messages.findIndex(item => item.id === id);
    if (at < 1 || qa.busy) return;
    if (deep) qaDeepOnce = true;
    const question = qa.messages[at - 1].text;
    qa.messages.splice(at - 1, 2);
    askQuestion(question);
  }
  const clearQa = () => deleteQaChat(qa.activeId);
  function openCite(msgId, code) {
    const key = msgId + ':' + code;
    qa.open[key] = true;
    setSourcesOpen(msgId, true);
    const box = [...host.querySelectorAll('[data-ol-qa-srcbox]')].find(node => node.dataset.olQaSrcbox === key);
    if (!box) return;
    box.classList.add('is-open');
    box.querySelector('.ola-qa-src-head')?.setAttribute('aria-expanded', 'true');
    const body = box.querySelector('.ola-qa-src-body'); if (body) body.hidden = false;
    box.scrollIntoView({block: 'nearest', behavior: 'smooth'});
  }
  // Cả nhóm "Nguồn đã tra" mặc định thu gọn; người dùng bấm tiêu đề để mở.
  function setSourcesOpen(msgId, open) {
    qa.open[msgId + ':*'] = open;
    const group = [...host.querySelectorAll('[data-ol-qa-srcs]')].find(node => node.dataset.olQaSrcs === msgId);
    if (!group) return;
    group.classList.toggle('is-open', open);
    group.querySelector('.ola-qa-srcs-head')?.setAttribute('aria-expanded', String(open));
    const body = group.querySelector('.ola-qa-srcs-body'); if (body) body.hidden = !open;
  }
  function toggleSource(key) {
    qa.open[key] = !qa.open[key];
    const box = [...host.querySelectorAll('[data-ol-qa-srcbox]')].find(node => node.dataset.olQaSrcbox === key);
    if (!box) return;
    box.classList.toggle('is-open', !!qa.open[key]);
    box.querySelector('.ola-qa-src-head')?.setAttribute('aria-expanded', String(!!qa.open[key]));
    const body = box.querySelector('.ola-qa-src-body'); if (body) body.hidden = !qa.open[key];
  }

  // ---- Giao diện hỏi nghiệp vụ ----
  function qaSourceHtml(msg, source, cited) {
    const key = msg.id + ':' + source.code, open = !!qa.open[key];
    return '<div class="ola-qa-src' + (open ? ' is-open' : '') + (cited ? ' is-cited' : '') + '" data-ol-qa-srcbox="' + esc(key) + '">'
      + '<button type="button" class="ola-qa-src-head" data-ol-qa-src="' + esc(key) + '" aria-expanded="' + open + '"><b>' + esc(source.code) + '</b><span>' + esc(source.doc + (source.title ? ' – ' + source.title : '')) + '</span>' + (cited ? '<em>được dẫn</em>' : '') + (source.via ? '<i class="ola-qa-via">' + (/dẫn chiếu/i.test(source.via) ? 'dẫn chiếu' : 'liền kề') + '</i>' : '') + svg(ICON.chevron) + '</button>'
      + '<div class="ola-qa-src-body"' + (open ? '' : ' hidden') + '><p>' + esc(source.text) + '</p>'
      + '<small>' + esc([source.via && 'Vì sao có đoạn này: ' + source.via, source.soHieu && 'Số hiệu ' + source.soHieu, source.from && 'Hiệu lực từ ' + source.from].filter(Boolean).join(' · ')) + '</small></div></div>';
  }
  function qaMessageHtml(msg) {
    const Q = QA();
    if (msg.role === 'user') return '<div class="ola-qa-msg is-user"><p>' + esc(msg.text) + '</p>'
      + (msg.files && msg.files.length ? '<div class="ola-qa-files">' + msg.files.map(file => '<span class="ola-qa-file">' + svg(ICON.attach) + esc(file.name) + '</span>').join('') + '</div>' : '') + '</div>';
    const sources = msg.sources || [], cited = Q.citedCodes(msg.text);
    const bad = Q.unknownCodes(msg.text, sources);
    const warn = msg.error || msg.empty || (msg.free && !sources.length) ? '' : bad.length ? '<p class="ola-qa-warn">AI dẫn mã nguồn không có trong các đoạn đã tra (' + esc(bad.join(', ')) + ') — đừng dùng phần đó khi chưa kiểm tra lại.</p>'
      : (sources.length && !cited.length && !msg.free) ? '<p class="ola-qa-warn">Câu trả lời không dẫn nguồn nào — hãy đối chiếu với các đoạn bên dưới trước khi dùng.</p>' : '';
    const body = msg.error ? '<div class="olp-notice olp-notice--error"><span>' + esc(msg.text) + '</span></div>'
      : msg.empty ? '<div class="olp-notice olp-notice--warn"><span>' + esc(msg.text) + '</span></div>'
      : msg.free ? '<div class="ola-qa-text ola-md">' + (sources.length ? Q.chatHtml(msg.text).replace(/\[C(\d{1,3})\]/g, '<b class="ola-qa-cite">[C$1]</b>') : Q.chatHtml(msg.text)) + '</div>'
      : '<div class="ola-qa-text">' + Q.answerHtml(msg.text, sources) + '</div>';
    const groupOpen = !!qa.open[msg.id + ':*'];
    const readNote = msg.read && msg.read.included && msg.read.included.length ? '<p class="ola-qa-queries" title="AI được cấp nguyên văn các văn bản này, không phải chỉ vài đoạn trích">Đã đọc toàn văn: ' + msg.read.included.map(doc => esc(doc.name) + ' (' + doc.chunks + ' đoạn)').join(' · ') + (msg.read.skipped && msg.read.skipped.length ? ' — chỉ trích đoạn: ' + msg.read.skipped.map(doc => esc(doc.name)).join(' · ') : '') + '</p>' : '';
    const srcs = (sources.length || readNote) ? '<div class="ola-qa-srcs' + (groupOpen ? ' is-open' : '') + '" data-ol-qa-srcs="' + esc(msg.id) + '">'
      + '<button type="button" class="ola-qa-srcs-head" data-ol-qa-srcs-toggle="' + esc(msg.id) + '" aria-expanded="' + groupOpen + '"><span>' + (msg.read ? 'Đã đọc toàn văn Thư viện — đoạn được dẫn (' : 'Nguồn đã tra trong Thư viện (') + sources.length + ')</span>'
      + (cited.length ? '<em>Đã dẫn: ' + esc(cited.filter(code => sources.some(src => src.code === code)).join(', ')) + '</em>' : '') + svg(ICON.chevron) + '</button>'
      + '<div class="ola-qa-srcs-body"' + (groupOpen ? '' : ' hidden') + '>' + readNote + (msg.queries && msg.queries.length ? '<p class="ola-qa-queries" title="Các cụm từ đã dùng để tìm trong Thư viện">Đã tra: ' + msg.queries.map(esc).join(' · ') + '</p>' : '') + sources.map(source => qaSourceHtml(msg, source, cited.includes(source.code))).join('') + '</div></div>' : '';
    // Antigravity chạy qua công cụ trung gian cục bộ: máy mới chưa cài/chạy thì thử lại vô ích → mời đổi mô hình ngay.
    const bridgeDown = msg.error && /Antigravity/i.test(msg.text || '');
    const acts = msg.error ? '<button type="button" class="ola-qa-act" data-ol-qa-retry="' + esc(msg.id) + '"' + (qa.busy ? ' disabled' : '') + '>Thử lại</button>'
      + (bridgeDown ? '<button type="button" class="ola-qa-act is-main" data-ol-pop="model" title="Chọn Gemini, DeepSeek… không cần công cụ trên máy">Chọn mô hình khác</button>' : '')
      : msg.empty ? '' : '<button type="button" class="ola-qa-act" data-ol-qa-copy="' + esc(msg.id) + '">' + svg(ICON.copy) + 'Sao chép</button>'
        + (msg.quick && deepSupported() ? '<button type="button" class="ola-qa-act" data-ol-qa-deeper="' + esc(msg.id) + '"' + (qaLocked() ? ' disabled' : '') + ' title="Hỏi lại câu này với chế độ suy luận sâu (chậm hơn, tốn token hơn, kỹ hơn)">' + svg(ICON.spark) + 'Suy luận sâu lại</button>' : '')
        + (msg.chat || msg.free ? '' : '<button type="button" class="ola-qa-act is-main" data-ol-qa-compose="' + esc(msg.id) + '"' + (qaLocked() ? ' disabled' : '') + ' title="Chuyển sang Soạn công văn, điền sẵn kết luận này vào yêu cầu">' + svg(ICON.letter) + 'Soạn công văn từ câu trả lời</button>');
    return '<div class="ola-qa-msg is-ai" data-ol-qa-msg="' + esc(msg.id) + '"><span class="ola-qa-av" aria-hidden="true">' + svg(ICON.book) + '</span><div class="ola-qa-body">' + body + warn + srcs + (acts ? '<div class="ola-qa-acts">' + acts + (!msg.error && !msg.empty && msg.secs ? '<span class="ola-qa-took" title="Thời gian AI trả lời câu hỏi này">' + fmtSecs(msg.secs) + '</span>' : '') + '</div>' : '') + '</div></div>';
  }
  function libChipHtml() {
    return '<button type="button" class="ola-chip' + (qa.lib ? ' is-set' : '') + '" data-ol-act="qa-lib" aria-pressed="' + !!qa.lib + '" title="' + (qa.lib ? 'Đang tra Thư viện tài liệu: AI dùng các đoạn tìm được và dẫn mã [C#]. Bấm để tắt.' : 'Bật để AI tra Thư viện tài liệu (Luật, Nghị định, quy tắc bảo hiểm) trước khi trả lời.') + '">' + svg(ICON.book) + 'Tra Thư viện: ' + (qa.lib ? 'Bật' : 'Tắt') + '</button>';
  }
  function qaComposerHtml(big) {
    const busy = !!qa.busy;
    return '<div class="ola-composer ola-qa-composer' + (big ? ' is-big' : ' is-up') + (busy ? ' is-busy' : '') + '"' + (busy ? ' aria-busy="true"' : '') + '>'
      + '<textarea data-ol-qa-input rows="' + (big ? 3 : 2) + '" maxlength="200000" placeholder="' + (qa.free ? 'Hỏi bất cứ điều gì — có thể đính kèm ảnh, PDF, Word, Excel…' : 'Hỏi nghiệp vụ (có thể đính kèm ảnh/tệp của vụ việc), hoặc dán quy tắc và ghi “thêm vào thư viện”…') + '" aria-label="' + (qa.free ? 'Tin nhắn cho trợ lý AI' : 'Câu hỏi nghiệp vụ') + '">' + esc(qa.draft) + '</textarea>'
      + ((qa.attach.length || qa.attaching) ? '<div class="ola-qa-attach">' + qa.attach.map((item, at) => '<span class="ola-qa-file' + (item.kind === 'image' ? ' is-image' : '') + '">'
        + (item.kind === 'image' && item.preview ? '<img src="' + esc(item.preview) + '" alt="">' : svg(ICON.attach)) + '<em title="' + esc(item.name + (item.truncated ? ' (đã cắt bớt vì quá dài)' : '')) + '">' + esc(item.name) + (item.truncated ? ' ✂' : '') + '</em>'
        + '<button type="button" data-ol-act="qa-attach-remove" data-ol-idx="' + at + '" aria-label="Bỏ ' + esc(item.name) + '"' + (busy ? ' disabled' : '') + '>×</button></span>').join('')
        + (qa.attaching ? '<span class="ola-qa-file is-loading"><i></i><i></i><i></i> Đang đọc tệp…</span>' : '') + '</div>' : '')
      + '<div class="ola-bar"><label class="ola-icon-btn' + (busy ? ' is-disabled' : '') + '" title="' + (qa.free ? 'Đính kèm ảnh / PDF / Word / Excel (tối đa ' + ATTACH_MAX + ' tệp)' : 'Đính kèm ảnh/tệp của vụ việc để hỏi (tối đa ' + ATTACH_MAX + ' tệp). Muốn nạp quy tắc vào Thư viện: đính kèm rồi ghi “thêm vào thư viện”.') + '"><input type="file" data-ol-qa-file accept=".md,.markdown,.txt,.docx,.pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp,.heic,.heif"' + ' multiple' + ' hidden' + (busy ? ' disabled' : '') + '>' + svg(ICON.attach) + '</label>' + recordChipHtml() + (qa.free ? libChipHtml() + (qa.lib ? rulesChipHtml('Chỉ tra trong văn bản này (mặc định: toàn bộ Thư viện tài liệu)') : '') : rulesChipHtml('Chỉ tra trong văn bản này (mặc định: toàn bộ Thư viện tài liệu)'))
      + modelChipHtml() + deepChipHtml() + '<span class="ola-spacer"></span>'
      + (busy ? '<button type="button" class="tasco-ai-send is-stop" data-ol-act="qa-stop" title="Dừng" aria-label="Dừng">' + svg(ICON.close) + '</button>'
        : '<button type="button" class="tasco-ai-send" data-ol-act="qa-send" title="Gửi câu hỏi (Enter)" aria-label="Gửi câu hỏi">' + svg(ICON.send) + '</button>') + '</div>'
      + popoverHtml() + '</div>';
  }
  function qaHtml() {
    const Q = QA();
    if (!qa.messages.length && !qa.busy && qa.free) {
      return '<section class="ola-hero ola-qa-hero ola-free-hero"><span class="ola-avatar" aria-hidden="true">' + svg(ICON.chat) + '</span><h1>Hôm nay bạn cần giúp gì?</h1>'
        + '<p class="ola-qa-lead">Hỏi mọi thứ: viết lại câu chữ, tính toán, Excel, dịch, giải thích kiến thức… Đính kèm ảnh, PDF, Word, Excel để AI đọc cùng. Cần đúng điều khoản bảo hiểm thì bật “Tra Thư viện” hoặc dùng tab Hỏi nghiệp vụ.</p>'
        + qaComposerHtml(true)
        + '<div class="ola-ideas">' + Q.FREE_SUGGESTIONS.map(text => '<button type="button" class="tasco-ai-choice" data-ol-qa-idea="' + esc(text) + '"><strong>' + esc(text) + '</strong></button>').join('') + '</div></section>';
    }
    if (!qa.messages.length && !qa.busy) {
      return '<section class="ola-hero ola-qa-hero"><span class="ola-avatar" aria-hidden="true">' + svg(ICON.book) + '</span><h1>Cần tra cứu nghiệp vụ gì?</h1>'
        + '<p class="ola-qa-lead">Hỏi về Luật, Nghị định, quy tắc bảo hiểm… đã nạp trong Thư viện tài liệu. Câu trả lời chỉ dựa trên văn bản trong thư viện và luôn dẫn nguồn nguyên văn để bạn đối chiếu.</p>'
        + qaComposerHtml(true)
        + '<div class="ola-ideas">' + Q.SUGGESTIONS.map(text => '<button type="button" class="tasco-ai-choice" data-ol-qa-idea="' + esc(text) + '"><strong>' + esc(text) + '</strong></button>').join('') + '</div></section>';
    }
    const typing = qa.busy ? '<div class="ola-qa-msg is-ai is-typing"><span class="ola-qa-av" aria-hidden="true">' + svg(ICON.book) + '</span><div class="ola-qa-body"><p class="ola-qa-status" role="status" aria-live="polite"><i></i><i></i><i></i><span data-ol-qa-status>' + esc(qa.status) + '</span><span class="ola-qa-timer' + (qaElapsed() >= QA_SLOW_SECS ? ' is-slow' : '') + '" data-ol-qa-timer aria-hidden="true">' + fmtSecs(qaElapsed()) + '</span></p></div></div>' : '';
    return '<div class="ola-qa"><div class="ola-qa-scroll" data-ol-qa-scroll><div class="ola-qa-inner">' + qa.messages.map(qaMessageHtml).join('') + typing + '</div></div>'
      + '<div class="ola-qa-dock">' + qaComposerHtml(false) + '<p class="ola-qa-foot">' + (qa.free ? 'AI có thể sai — hãy kiểm tra lại số liệu và nội dung quan trọng. Với điều khoản bảo hiểm, bật “Tra Thư viện” để có nguồn đối chiếu.' : 'AI có thể sai — luôn đối chiếu nguyên văn ở phần "Nguồn đã tra" trước khi dùng trong công văn hoặc trả lời khách hàng.') + '</p></div></div>';
  }
  function topbarHtml() {
    const histBtn = st.histOpen ? '<span></span>' : '<button type="button" class="ola-hist-open" data-ol-act="hist-toggle" title="Mở lịch sử" aria-label="Mở lịch sử">' + svg(ICON.history) + '<span>Lịch sử</span></button>';
    const locked = qaLocked();
    const mode = QA() ? '<div class="ola-mode" role="tablist" aria-label="Chế độ làm việc">' + [['compose', 'Soạn công văn', ICON.letter], ['ask', 'Hỏi nghiệp vụ', ICON.book], ['chat', 'Trò chuyện AI', ICON.chat]].map(([id, label, icon]) =>
      '<button type="button" role="tab" aria-selected="' + (modeId() === id) + '" class="ola-mode-btn' + (modeId() === id ? ' is-on' : '') + '" data-ol-mode="' + id + '"' + (locked && modeId() !== id ? ' disabled' : '') + '>' + svg(icon) + '<span>' + label + '</span></button>').join('') + '</div>' : '<span></span>';
    const right = '<span class="ola-top-acts">' + (st.mode === 'ask'
      ? '<span class="olp-usage" data-ol-qa-usage' + (usageText(qa.usage) ? '' : ' hidden') + ' title="' + esc(usageTitle(qa.usage)) + '">' + esc(usageText(qa.usage)) + '</span>'
        + (qa.free && qa.messages.length ? '<button type="button" class="ola-hist-btn" data-ol-act="qa-export" title="Xuất cuộc trò chuyện (.md)" aria-label="Xuất cuộc trò chuyện">' + svg(ICON.download) + '</button>' : '')
        + (qa.messages.length ? '<button type="button" class="ola-hist-btn ola-hist-new" data-ol-act="qa-new" title="Cuộc trò chuyện mới" aria-label="Cuộc trò chuyện mới"' + (qa.busy ? ' disabled' : '') + '>' + svg(ICON.plus) + '</button>' : '')
        + (qa.messages.length ? '<button type="button" class="ola-hist-btn" data-ol-act="qa-clear" title="Xoá cuộc trò chuyện này" aria-label="Xoá cuộc trò chuyện này"' + (qa.busy ? ' disabled' : '') + '>' + svg(ICON.trash) + '</button>' : '')
      : '') + '<button type="button" class="ola-hist-btn" data-ol-act="open-library" title="Quản lý dữ liệu quy tắc" aria-label="Quản lý dữ liệu quy tắc">' + svg(ICON.book) + '</button>'
      + '<button type="button" class="ola-hist-btn" data-ol-act="settings" title="Cài đặt AI" aria-label="Cài đặt AI">' + svg(ICON.gear) + '</button></span>';
    return '<div class="ola-top">' + histBtn + mode + right + '</div>';
  }

  // ---- Lịch sử (OfficialLetterHistory: Firebase user_letters/{uid}, dự phòng trình duyệt) ----
  const History = () => (typeof OfficialLetterHistory !== 'undefined' ? OfficialLetterHistory : null);
  const HIST_PANEL_KEY = 'officialLetter.historyPanel.v1';
  function snapshot() {
    syncLetter();
    const found = chosenRecord();
    const result = Revisions().fitSnapshot({
      v: 2, versions:st.versions, customTitle: st.customTitle, brief: st.brief, recordKey: st.recordKey, recordLabel: found ? recordLabel(found.info) : st.savedRecordLabel, templateId: st.templateId,
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
    st.customTitle = String(data.customTitle || '').slice(0, 300);
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
    const entry = {title: st.customTitle || (st.letter.subject ? 'V/v ' + st.letter.subject : st.brief) || 'Công văn', sub:[data.recordLabel, tpl.id === DEFAULT_TEMPLATE ? '' : tpl.name].filter(Boolean).join(' · '), data};
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
    st.mode = 'compose';
    st.historyId = id;
    if (window.innerWidth < 1000) st.histOpen = false;
    renderAll();
  }
  async function deleteHistory(id) {
    const H = History();
    if (!H) return;
    const item = st.history.find(entry => entry.id === id);
    if (!await askConfirm({eyebrow: 'LỊCH SỬ CÔNG VĂN', title: 'Xoá công văn khỏi lịch sử?', message: '"' + (item ? item.title : 'Công văn này') + '" sẽ bị xoá khỏi lịch sử và không khôi phục được.', confirmText: 'Xoá công văn'})) return;
    await H.remove(id);
    st.history = H.list();
    if (id === st.historyId) st.historyId = '';
    updateHistory();
  }
  // ---- Đổi tên đoạn chat / công văn trong lịch sử ----
  function startRename(kind, id) {
    if (histLocked() || st.histSelect || !id) return;
    st.histRename = {kind, id};
    updateHistory(true);
    const input = $('[data-ol-hist-rename-input]');
    if (input) { input.focus(); input.select(); }
  }
  function cancelRename() { if (!st.histRename) return; st.histRename = null; updateHistory(true); }
  async function commitRename() {
    const target = st.histRename;
    if (!target) return;
    const input = $('[data-ol-hist-rename-input]');
    const name = input ? input.value.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
    st.histRename = null;   // xoá trước để focusout sau khi vẽ lại không lưu lần hai
    if (name) {
      try {
        if (target.kind === 'qa') {
          const chat = qa.chats.find(item => item.id === target.id);
          if (chat && chat.title !== name) { chat.title = name; chat.named = true; saveQa(); }
        } else {
          const H = History();
          const entry = H && st.history.find(item => item.id === target.id);
          if (entry && entry.title !== name) {
            if (target.id === st.historyId && st.letter) { st.customTitle = name; clearTimeout(saveTimer); saveHistory(); await saveQueue; }
            else await H.rename(target.id, name);
            st.history = H.list();
          }
        }
      } catch (error) { toast((error && error.message) || 'Không đổi được tên.', 'warning'); }
    }
    updateHistory(true);
  }
  const histLocked = () => askSide() ? !!qa.busy : !!(st.busy || st.pending);
  const histAllIds = () => askSide() ? qaKindChats(qa.free).map(chat => chat.id) : st.history.map(item => item.id);
  function qaVisibleItems() {
    const query = fold(st.histQuery).trim();
    return qaKindChats(qa.free).map(chat => ({id: chat.id, title: chat.title, sub: Math.ceil(chat.messages.length / 2) + (qa.free ? ' lượt' : ' câu hỏi'), updatedAt: chat.at})).filter(item => !query || fold(item.title).includes(query));
  }
  function historyVisibleItems() {
    const query = fold(st.histQuery).trim();
    return st.history.filter(item => !query || fold(item.title + ' ' + item.sub).includes(query));
  }
  const histVisibleIds = () => (askSide() ? qaVisibleItems() : historyVisibleItems()).map(item => item.id);
  const histPickedValid = () => { const valid = new Set(histAllIds()); return st.histPicked.filter(id => valid.has(id)); };
  function exitHistSelect() { st.histSelect = false; st.histPicked = []; }
  function toggleHistSelect(force) {
    if (histLocked()) return;
    const next = typeof force === 'boolean' ? force : !st.histSelect;
    if (next && !histAllIds().length) return;
    st.histSelect = next;
    st.histPicked = [];
    renderAll();
  }
  function toggleHistPick(id) {
    if (!st.histSelect || histLocked() || !id) return;
    const i = st.histPicked.indexOf(id);
    if (i >= 0) st.histPicked.splice(i, 1); else st.histPicked.push(id);
    updateHistory(true);
  }
  function toggleHistSelectAll() {
    if (!st.histSelect || histLocked()) return;
    const vis = histVisibleIds();
    if (!vis.length) return;
    const picked = new Set(histPickedValid());
    const allOn = vis.every(id => picked.has(id));
    if (allOn) vis.forEach(id => picked.delete(id));
    else vis.forEach(id => picked.add(id));
    st.histPicked = [...picked];
    updateHistory(true);
  }
  async function deleteSelectedHistory() {
    if (!st.histSelect || histLocked()) return;
    const ids = histPickedValid();
    if (!ids.length) return;
    const ask = askSide(), count = ids.length;
    if (ask) {
      if (!await askConfirm({
        eyebrow: qa.free ? 'TRÒ CHUYỆN AI' : 'HỎI NGHIỆP VỤ',
        title: 'Xoá ' + count + ' cuộc trò chuyện?',
        message: count + ' cuộc trò chuyện đã chọn sẽ bị xoá khỏi máy này và không khôi phục được.',
        confirmText: 'Xoá ' + count + ' cuộc trò chuyện'
      })) return;
      const drop = new Set(ids);
      qa.chats = qa.chats.filter(item => !drop.has(item.id));
      if (qa.activeId && drop.has(qa.activeId)) { qa.activeId = ''; resetQaView(); }
      exitHistSelect();
      saveQa();
      if (!qa.chats.length) try { localStorage.removeItem(QA_CHATS_KEY); } catch (_) { /* bỏ qua */ }
      toast('Đã xoá ' + count + ' cuộc trò chuyện.', 'success');
      renderAll(); focusMain();
      return;
    }
    const H = History();
    if (!H) return;
    if (!await askConfirm({
      eyebrow: 'LỊCH SỬ CÔNG VĂN',
      title: 'Xoá ' + count + ' công văn khỏi lịch sử?',
      message: count + ' công văn đã chọn sẽ bị xoá khỏi lịch sử và không khôi phục được.',
      confirmText: 'Xoá ' + count + ' công văn'
    })) return;
    if (typeof H.removeMany === 'function') await H.removeMany(ids);
    else { for (const id of ids) await H.remove(id); }
    st.history = H.list();
    if (st.historyId && ids.includes(st.historyId)) st.historyId = '';
    exitHistSelect();
    toast('Đã xoá ' + count + ' công văn khỏi lịch sử.', 'success');
    renderAll();
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
    if (st.pop === 'model') return modelPopHtml();
    if (st.pop === 'rules') {
      const docs = st.libDocs, pinned = st.legalPin;
      const auto = '<button type="button" role="menuitemradio" aria-checked="' + (!pinned.length) + '" data-ol-rule=""><b>Tự động</b><small>AI tự tìm căn cứ trong toàn bộ Thư viện tài liệu theo vấn đề</small></button>';
      const items = docs === null ? '<p class="ol-rec-empty">Đang tải Thư viện tài liệu…</p>'
        : !docs.length ? '<p class="ol-rec-empty">Thư viện chưa có văn bản nào — mở Thư viện tài liệu để nạp Luật, Nghị định, quy tắc bảo hiểm…</p>'
        : docs.map(doc => '<button type="button" role="menuitemcheckbox" aria-checked="' + pinned.includes(doc.id) + '" data-ol-rule="' + esc(doc.id) + '"' + (doc.active ? '' : ' disabled') + '><b>' + esc(doc.name) + '</b><small>' + esc((doc.soHieu && !fold(doc.name).includes(fold(doc.soHieu)) ? doc.soHieu + ' · ' : '') + (doc.active ? 'Chọn để thêm căn cứ' : 'Hết hiệu lực — không chọn được')) + '</small><span class="ola-rule-check" aria-hidden="true">✓</span></button>').join('');
      return '<div class="ola-pop ola-pop--menu" role="menu" aria-label="Quy tắc / căn cứ"><p class="ola-rule-hint">Có thể chọn nhiều quy tắc cùng lúc</p>' + auto + items + '</div>';
    }
    return '';
  }
  function recordChipHtml() {
    const found = chosenRecord();
    return found
      ? '<span class="ola-chip is-set"><button type="button" data-ol-pop="record" title="Đổi hồ sơ">' + svg(ICON.folder) + '<span class="ola-chip-record">' + esc(found.info.plate || found.info.code || 'Hồ sơ') + '</span></button><button type="button" class="ola-chip-x" data-ol-rec-clear aria-label="Bỏ hồ sơ">×</button></span>'
      : '<button type="button" class="ola-chip" data-ol-pop="record">' + svg(ICON.folder) + 'Hồ sơ</button>';
  }
  function ruleLabelText() {
    const pinnedDocs = (st.libDocs || []).filter(doc => st.legalPin.includes(doc.id));
    return st.legalPin.length > 1 ? st.legalPin.length + ' quy tắc đã chọn' : st.legalPin.length ? (pinnedDocs[0]?.name || 'Đã chọn quy tắc') : 'Quy tắc: Tự động';
  }
  function rulesChipHtml(title) {
    const pinnedDocs = (st.libDocs || []).filter(doc => st.legalPin.includes(doc.id));
    const ruleLabel = ruleLabelText();
    const ruleTitle = title || (pinnedDocs.length ? 'Căn cứ đã chọn: ' + pinnedDocs.map(doc => doc.name).join(', ') : 'Chọn một hoặc nhiều văn bản/quy tắc làm căn cứ cho AI');
    return '<button type="button" class="ola-chip' + (st.legalPin.length ? ' is-set' : '') + '" data-ol-pop="rules" title="' + esc(ruleTitle) + '">' + svg(ICON.book) + '<span class="ola-chip-t">' + esc(ruleLabel) + '</span>' + svg(ICON.chevron) + '</button>';
  }
  function deepChipHtml(compact) {
    const on = deepOn(), able = deepSupported();
    const title = !able ? 'Mô hình đang chọn không có chế độ suy luận riêng — AI vẫn trả lời theo từng bước nhưng không chạy thêm bước suy luận.' : qa.deep ? 'Đang bật: AI suy luận kỹ hơn (chậm hơn, tốn token hơn); câu hỏi tra cứu ngắn tự trả lời nhanh và có nút "Suy luận sâu lại". Bấm để tắt.' : 'Đang tắt: trả lời nhanh, ít tốn token. Bấm để bật suy luận sâu.';
    const disabled = (qa.busy || st.busy) ? ' disabled' : '';
    if (compact) return '<button type="button" class="ola-icon-btn ola-deep-btn' + (on ? ' is-set' : '') + (able ? '' : ' is-na') + '" data-ol-act="qa-deep" aria-pressed="' + on + '" title="Suy luận sâu — ' + esc(title) + '" aria-label="Suy luận sâu"' + disabled + '>' + svg(ICON.spark) + '</button>';
    return '<button type="button" class="ola-chip' + (on ? ' is-set' : '') + (able ? '' : ' is-na') + '" data-ol-act="qa-deep" aria-pressed="' + on + '" title="' + esc(title) + '"' + disabled + '>' + svg(ICON.spark) + '<span class="ola-chip-t">Suy luận sâu</span></button>';
  }
  // Nút chọn mô hình AI (DeepSeek / Gemini / Groq / tuỳ chỉnh) — cạnh ô soạn và ô hỏi.
  function modelChipHtml() {
    const active = activeModel();
    if (!active) return '';
    const missing = aiKeys[active.provider] === false;
    return '<button type="button" class="ola-chip' + (active.free ? ' is-free' : '') + (missing ? ' is-warn' : '') + '" data-ol-pop="model" title="Chọn mô hình AI' + (missing ? ' — chưa có khoá cho mô hình này' : '') + '"' + ((qa.busy || st.busy) ? ' disabled' : '') + '>' + svg(ICON.chip) + '<span class="ola-chip-t">' + esc(active.label) + '</span>' + svg(ICON.chevron) + '</button>';
  }
  function modelPopHtml() {
    const M = Models(), cfg = aiConfig(), active = activeModel();
    if (!M || !active) return '';
    const groups = [...M.ORDER, 'antigravity'].map(id => {
      const items = M.entries(cfg).filter(entry => entry.provider === id);
      if (!items.length) return '';
      const p = M.PROVIDERS[id], has = aiKeys[id] !== false;   // chưa nạp xong khoá thì coi như có, tránh nhấp nháy
      const agyNote = id !== 'antigravity' ? '' : agyLoad.busy ? '<div class="ola-pop-note" role="status">Đang tải danh sách mô hình từ Antigravity…</div>'
        : agyLoad.error ? '<div class="ola-pop-note is-warn" role="alert"><span>Chưa tải được danh sách mô hình: ' + esc(agyLoad.error) + '</span><button type="button" data-ol-agy-refresh>Thử lại</button></div>' : '';
      return '<h6>' + esc(M.providerLabel(id, cfg)) + (p.free ? ' <i>miễn phí</i>' : '') + (has ? '' : ' <em>chưa có khoá</em>') + '</h6>' + agyNote
        + items.map(entry => has
          ? '<button type="button" role="menuitemradio" aria-checked="' + (entry.id === active.id) + '" data-ol-model="' + esc(entry.id) + '"><b>' + esc(entry.model) + '</b><small>' + esc(modelHint(entry)) + '</small></button>'
          : '<button type="button" data-ol-act="settings" title="Thêm khoá ' + esc(M.providerLabel(id, cfg)) + '"><b>' + esc(entry.model) + '</b><small>Chưa có khoá — bấm để thêm trong Cài đặt</small></button>').join('');
    }).join('');
    return '<div class="ola-pop ola-pop--menu ola-pop--models" role="menu" aria-label="Mô hình AI">' + groups
      + '<button type="button" class="ola-pop-foot" data-ol-act="settings"><b>Thêm khoá / mô hình…</b><small>Gemini, Groq miễn phí; OpenRouter và dịch vụ tương thích OpenAI</small></button></div>';
  }
  function modelHint(entry) {
    const p = entry.provider, prof = Models().profile(p, entry.model), bits = [];
    bits.push(prof.reasoning === 'none' ? 'không có suy luận sâu' : 'có suy luận sâu');
    if (!prof.vision) bits.push('không đọc ảnh');
    if (prof.maxSources) bits.push('hạn mức nhỏ: ít nguồn, trả lời ngắn');
    return bits.join(' · ');
  }
  function composerHtml(big) {
    const tpl = template();
    const recordChip = recordChipHtml();
    const typeChip = '<button type="button" class="ola-chip' + (tpl.id !== DEFAULT_TEMPLATE ? ' is-set' : '') + '" data-ol-pop="type" title="' + esc(tpl.name) + '">' + svg(ICON.letter) + '<span class="ola-chip-t ola-chip-type">' + esc(tpl.id === DEFAULT_TEMPLATE ? 'Loại: Tự do' : tpl.name) + '</span>' + svg(ICON.chevron) + '</button>';
    const rulesChip = rulesChipHtml();
    return '<div class="ola-composer' + (big ? ' is-big' : '') + '">'
      + '<textarea data-ol-brief rows="' + (big ? 3 : 2) + '" maxlength="3000" placeholder="Mô tả công văn cần soạn… (gõ số HSBT hoặc biển số để AI tự lấy hồ sơ)" aria-label="Yêu cầu soạn công văn">' + esc(st.brief) + '</textarea>'
      + '<div class="tasco-ai-attachments ola-files" data-ol-file-list' + (filesHtml() ? '' : ' hidden') + '>' + filesHtml() + '</div>'
      + '<div class="ola-docs" data-ol-docs' + (docList().length ? '' : ' hidden') + '>' + docsHtml() + '</div>'
      + '<div class="ola-bar"><label class="ola-icon-btn" title="Đính kèm ảnh/PDF"><input type="file" data-ol-files accept="image/*,application/pdf" multiple hidden>' + svg(ICON.attach) + '</label>'
      + recordChip + typeChip + rulesChip + modelChipHtml() + deepChipHtml() + '<span class="ola-spacer"></span>'
      + '<button type="button" class="tasco-ai-send" data-ol-act="run" title="Soạn công văn (Enter)" aria-label="Soạn công văn"' + (st.busy ? ' disabled' : '') + '>' + svg(ICON.send) + '</button></div>'
      + popoverHtml() + '</div>';
  }
  function filesHtml(which) {
    const bucket = which === 'refineFiles' ? 'refineFiles' : 'files';
    return st[bucket].map((item, i) => (bucket === 'files' && slotOf(item)) ? '' : '<span class="tasco-ai-attach" title="' + esc(item.file.name) + '">' + (item.url ? '<img alt="" src="' + esc(item.url) + '">' : '<em>PDF</em>') + '<button type="button" data-ol-remove-file="' + i + '"' + (bucket === 'refineFiles' ? ' data-ol-bucket="refineFiles"' : '') + ' aria-label="Bỏ tệp ' + esc(item.file.name) + '">×</button></span>').join('');
  }
  function updateFiles() {
    if (!host) return;
    host.querySelectorAll('[data-ol-file-list]').forEach(box => {
      const bucket = box.dataset.olFileList === 'refine' ? 'refineFiles' : 'files';
      const html = filesHtml(bucket); box.innerHTML = html; box.hidden = !html;
    });
    host.querySelectorAll('[data-ol-docs]').forEach(box => { box.innerHTML = docsHtml(); box.hidden = !docList().length; });
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
  const STEP_NAMES = ['read', 'legal', 'reason', 'write'];
  const STEP_LABEL = {read: 'Đọc hồ sơ & yêu cầu', legal: 'Căn cứ pháp lý', reason: 'Suy luận nghiệp vụ', write: 'Soạn công văn'};
  function stepState() {
    const steps = st.steps || {read: {state: 'done', text: ''}, legal: {state: 'done', text: ''}, reason: {state: 'skip', text: ''}, write: {state: 'done', text: ''}};
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
    const detail = running ? (current < 0 ? 'Đang hoàn tất tác vụ' : 'Bước ' + (current + 1) + '/' + STEP_NAMES.length + ' · ' + (list[current].text || STEP_LABEL[list[current].name])) : failed ? 'Kiểm tra thông báo lỗi rồi gửi lại yêu cầu.' : interrupted ? 'Bạn có thể gửi lại yêu cầu để tiếp tục.' : st.pending ? st.pending.changes.length + ' thay đổi đang chờ bạn duyệt.' : st.agentTask === 'legal' ? 'Bản thảo được giữ nguyên.' : 'Bạn có thể bôi đen một đoạn hoặc gửi yêu cầu mới.';
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
      + (found ? '<span>' + svg(ICON.folder) + esc(recordLabel(found.info)) + '</span>' : '') + '<span>' + svg(ICON.letter) + esc(tpl.id === DEFAULT_TEMPLATE ? 'Tự do' : tpl.name) + '</span>' + (st.legalPin.length ? '<span title="Văn bản bạn đã chọn làm căn cứ cho AI">' + svg(ICON.book) + esc(pinNames()) + ' · ' + activeSources().length + ' đoạn</span>' : '') + (st.files.length ? '<span>' + svg(ICON.attach) + st.files.length + ' tệp</span>' : '') + '</div></div>'
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
    const open = st.questions.map((item, i) => ({item, i})).filter(({item}) => !item.answer && item.question);
    const locked = !!(st.busy || st.pending);
    return '<aside class="ola-rail" aria-label="Ghi chú của AI">'
      + '<div data-ol-gaps>' + gapsHtml() + '</div><div data-ol-citations>' + citationsHtml() + '</div>'
      + (open.length ? '<section class="ola-rail-card ola-questions"><div class="ola-rail-heading"><div><span class="ola-rail-eyebrow">TRỢ LÝ CÔNG VĂN</span><h3>Cần bạn xác nhận</h3></div><span class="ola-rail-count">' + open.length + '</span></div><p class="ola-rail-intro">Chọn hoặc nhập câu trả lời để AI đề xuất sửa bản thảo.</p>' + open.map(({item, i}, position) => '<details class="ola-question"' + (position === 0 ? ' open' : '') + '><summary><span class="ola-question-number">' + String(position + 1).padStart(2, '0') + '</span><span>' + esc(item.question) + '</span>' + svg(ICON.chevron) + '</summary><div class="ola-question-body"><div class="ola-options">' + (Array.isArray(item.options) ? item.options : []).map((option, j) => '<button type="button" data-ol-option="' + i + '|' + j + '"' + (locked ? ' disabled' : '') + '>' + esc(option) + '</button>').join('') + '</div><label for="ol-answer-' + i + '">Câu trả lời của bạn</label><textarea id="ol-answer-' + i + '" data-ol-quick-answer="' + i + '" rows="2" maxlength="1000" placeholder="Nhập hoặc chọn câu trả lời…"' + (locked ? ' disabled' : '') + '>' + esc(st.questionDrafts[item.question] || '') + '</textarea><button type="button" class="ola-answer-submit" data-ol-answer-submit="' + i + '"' + (locked ? ' disabled' : '') + '>' + svg(ICON.spark) + 'Tạo đề xuất chỉnh sửa</button></div></details>').join('') + '</section>' : '')
      + (st.assumptions.length ? '<details class="ola-rail-card ola-assumptions"><summary><span><span class="ola-rail-eyebrow">CẦN ĐỐI CHIẾU</span><strong>Giả định của AI</strong></span><span class="ola-rail-count">' + st.assumptions.length + '</span>' + svg(ICON.chevron) + '</summary><p class="ola-rail-intro">Kiểm tra với hồ sơ trước khi sử dụng.</p><ul>' + st.assumptions.map((text, i) => '<li><span>' + esc(text) + '</span><button type="button" data-ol-assumption="' + i + '"' + (locked ? ' disabled' : '') + '>Yêu cầu chỉnh</button></li>').join('') + '</ul></details>' : '')
      + (st.letter.warnings.length ? '<div class="ola-note-block"><h3>Nên kiểm tra</h3><ul>' + st.letter.warnings.map(text => '<li>' + esc(text) + '</li>').join('') + '</ul></div>' : '')
      + (warns.length ? '<div class="ola-note-block is-warn"><h3>Lưu ý từ hồ sơ</h3><ul>' + warns.map(fact => '<li>' + esc(fact.text) + '</li>').join('') + '</ul></div>' : '')
      + '<button type="button" class="ola-more" data-ol-drawer="fields">Xem chi tiết: thông tin, dàn ý, căn cứ, hồ sơ →</button></aside>';
  }
  function saveRecordTitle() {
    const found = chosenRecord();
    if (!found) return 'Chọn hồ sơ (chip Hồ sơ) để lưu công văn Word vào kho tài liệu của hồ sơ';
    if (!(typeof ClaimDocuments !== 'undefined' && ClaimDocuments.claimIdFromKey(found.row.key))) return 'Hồ sơ giám định chưa có kho tài liệu — chỉ lưu được vào Hồ sơ tồn';
    return 'Lưu bản Word vào Tài liệu hồ sơ: ' + recordLabel(found.info);
  }
  function documentHtml() {
    if (!st.letter) return '<div class="ola-doc is-pending" aria-label="Bản thảo đang được chuẩn bị"><div class="olp-skeleton" aria-hidden="true">' + '<i></i>'.repeat(10) + '</div></div>';
    const locked = !!(st.busy || st.pending);
    const paper = Core().letterToHtml(st.letter);
    return '<div class="ola-doc' + (st.busy ? ' is-busy' : '') + '"><div class="ola-doc-bar"><label class="ol-datepick">Ngày <input type="date" data-ol-date value="' + esc(st.letter.date) + '"' + (locked ? ' disabled' : '') + '></label>'
      + '<span class="olp-usage" data-ol-usage title="' + esc(usageTitle()) + '"' + (usageText() ? '' : ' hidden') + '>' + esc(usageText()) + '</span>'
      + '<button type="button" class="olp-tool" data-ol-drawer="versions"' + (locked ? ' disabled' : '') + '>' + svg(ICON.history) + 'Phiên bản (' + st.versions.length + ')</button>'
      + '<button type="button" class="olp-tool" data-ol-act="save-record" title="' + esc(saveRecordTitle()) + '"' + (st.savingRecord || locked ? ' disabled' : '') + '>' + svg(ICON.folder) + (st.savingRecord ? 'Đang lưu…' : 'Lưu vào hồ sơ') + '</button>'
      + '<button type="button" class="olp-tool is-primary" data-ol-act="docx">' + svg(ICON.word) + 'Tải Word</button><button type="button" class="olp-tool" data-ol-act="print" title="In">' + svg(ICON.print) + '</button><button type="button" class="olp-tool" data-ol-act="copy" title="Sao chép nội dung">' + svg(ICON.copy) + '</button></div>'
      + '<div class="ol-paper-wrap">' + (locked ? paper.replace(/contenteditable="true"/g, 'contenteditable="false"') : paper) + '</div></div>';
  }
  // ---- Duyệt đề xuất chỉnh sửa của AI ----
  const wordsOf = text => (String(text || '').match(/\S+/g) || []).length;
  // So sánh theo từ; đoạn bị viết lại gần hết thì không xen kẽ gạch xanh/đỏ (khó đọc) mà hiện hai khối Trước / Sau.
  function reviewDiff(item) {
    const parts = Revisions().diff(item.before, item.after);
    let add = 0, del = 0, same = 0;
    parts.forEach(part => { const n = wordsOf(part.text); if (part.kind === 'ins') add += n; else if (part.kind === 'del') del += n; else same += n; });
    const rewrite = del >= 6 && same / (same + del) < 0.35;
    const mark = (kinds, joiner) => parts.filter(part => kinds.includes(part.kind)).map(part => part.kind === 'same' ? esc(part.text) : '<' + part.kind + '>' + esc(part.text) + '</' + part.kind + '>').join(joiner || '');
    const plain = kinds => esc(parts.filter(part => kinds.includes(part.kind)).map(part => part.text).join(''));
    return {add, del, rewrite, inline: mark(['same', 'ins', 'del']), oldHtml: mark(['same', 'del']), newHtml: mark(['same', 'ins']), oldPlain: plain(['same', 'del']), newPlain: plain(['same', 'ins'])};
  }
  const reviewText = html => html && html.trim() ? html : '<em class="ola-rv-empty">Chưa có nội dung</em>';
  function reviewCardHtml(item, i, view) {
    const d = reviewDiff(item);
    const delta = d.rewrite ? '<em class="is-rewrite">Viết lại</em>' : (d.add ? '<em class="is-add">+' + d.add + ' từ</em>' : '') + (d.del ? '<em class="is-del">−' + d.del + ' từ</em>' : '');
    let body;
    if (view === 'split') body = '<div class="ola-rv-split"><div class="ola-rv-col is-old"><h4>Hiện tại</h4><p>' + reviewText(d.rewrite ? d.oldPlain : d.oldHtml) + '</p></div><div class="ola-rv-col is-new"><h4>Đề xuất</h4><p>' + reviewText(d.rewrite ? d.newPlain : d.newHtml) + '</p></div></div>';
    else if (d.rewrite) body = '<div class="ola-rv-block is-old"><span>Hiện tại</span><p>' + reviewText(d.oldPlain) + '</p></div><div class="ola-rv-block is-new"><span>Đề xuất</span><p>' + reviewText(d.newPlain) + '</p></div>';
    else body = '<p class="ola-rv-text">' + reviewText(d.inline) + '</p>';
    return '<article class="ola-rv-card' + (d.rewrite ? ' is-rewrite' : '') + '"><label class="ola-rv-card-head"><span class="ola-rv-num">' + (i + 1) + '</span><span class="ola-rv-label">' + esc(item.label) + '</span><span class="ola-rv-delta">' + delta + '</span>'
      + '<span class="ola-rv-switch"><input type="checkbox" data-ol-change="' + i + '"' + (item.on ? ' checked' : '') + ' aria-label="Áp dụng thay đổi ' + esc(item.label) + '"><i aria-hidden="true"></i><span class="t-on">Áp dụng</span><span class="t-off">Bỏ qua</span></span></label>'
      + '<div class="ola-rv-body">' + body + '</div></article>';
  }
  function reviewHtml() {
    if (!st.pending) return '';
    const view = st.reviewView === 'split' ? 'split' : 'inline', list = st.pending.changes;
    const totals = list.reduce((sum, item) => { const d = reviewDiff(item); return {add: sum.add + d.add, del: sum.del + d.del}; }, {add: 0, del: 0});
    const on = list.filter(item => item.on).length;
    const ask = st.pending.scoped ? 'Chỉ phần đã bôi đen được thay đổi.' : st.pending.instruction;
    return '<section class="ola-review" aria-label="So sánh chỉnh sửa của AI">'
      + '<header class="ola-rv-head"><span class="ola-rv-orb" aria-hidden="true">' + svg(ICON.spark) + '</span><div class="ola-rv-title"><h2>Đề xuất chỉnh sửa</h2><p class="ola-rv-ask"><b>Yêu cầu</b>' + esc(ask) + '</p></div>'
      + '<div class="ola-rv-view" role="group" aria-label="Kiểu hiển thị"><button type="button" data-ol-act="review-view" data-ol-view="inline" aria-pressed="' + (view === 'inline') + '">Gộp</button><button type="button" data-ol-act="review-view" data-ol-view="split" aria-pressed="' + (view === 'split') + '">Trước / Sau</button></div></header>'
      + '<div class="ola-rv-bar"><label class="ola-rv-all"><input type="checkbox" data-ol-change-all' + (on === list.length ? ' checked' : '') + '><span data-ol-rv-count>' + reviewCountText(on, list.length) + '</span></label>'
      + '<span class="ola-rv-stats"><em class="is-add">+' + totals.add + ' từ</em><em class="is-del">−' + totals.del + ' từ</em></span></div>'
      + '<div class="ola-rv-list">' + list.map((item, i) => reviewCardHtml(item, i, view)).join('') + '</div>'
      + '<footer class="ola-rv-foot"><span class="ola-rv-note">Bản thảo giữ nguyên cho tới khi bạn áp dụng.</span><button type="button" class="olp-tool" data-ol-act="reject-changes">Bỏ đề xuất</button><button type="button" class="olp-tool is-primary" data-ol-act="accept-changes"' + (on ? '' : ' disabled') + '>' + reviewApplyText(on) + '</button></footer></section>';
  }
  const reviewCountText = (on, total) => on === total ? 'Đã chọn tất cả ' + total + ' thay đổi' : 'Đã chọn ' + on + '/' + total + ' thay đổi';
  const reviewApplyText = on => on ? 'Áp dụng ' + on + ' thay đổi' : 'Chọn thay đổi để áp dụng';
  // Cập nhật bộ đếm / ô "chọn tất cả" / nút Áp dụng tại chỗ, không dựng lại cả danh sách.
  function updateReviewState() {
    const root = $('.ola-review');
    if (!root || !st.pending) return;
    const total = st.pending.changes.length, on = st.pending.changes.filter(item => item.on).length;
    const count = root.querySelector('[data-ol-rv-count]'), all = root.querySelector('[data-ol-change-all]'), apply = root.querySelector('[data-ol-act="accept-changes"]');
    if (count) count.textContent = reviewCountText(on, total);
    if (all) { all.checked = on === total; all.indeterminate = on > 0 && on < total; }
    if (apply) { apply.textContent = reviewApplyText(on); apply.disabled = !on; }
  }
  function repaintReview() {
    const node = $('.ola-review');
    if (!node || !st.pending) return;
    const box = $('[data-ol-scroll]'), top = box ? box.scrollTop : 0;
    node.outerHTML = reviewHtml().replace('class="ola-review"', 'class="ola-review is-static"');   // không chạy lại hiệu ứng xuất hiện khi chỉ đổi kiểu xem
    if (box) box.scrollTop = top;
  }
  const REFINES = ['Viết ngắn gọn hơn', 'Giọng trang trọng hơn', 'Thêm hạn phản hồi 07 ngày làm việc'];
  function refineHtml() {
    const agent = stepsHtml();
    if (!st.letter) return '<div class="ola-refine is-processing">' + agent + '</div>';
    if (st.pending) return '<div class="ola-refine">' + agent + '<div class="ola-review-hint"><span>Chọn những thay đổi bạn muốn áp dụng vào bản thảo.</span><button type="button" class="olp-tool" data-ol-act="review">Xem đề xuất</button></div></div>';
    return '<div class="ola-refine' + (st.busy ? ' is-processing' : '') + '">' + agent + '<div class="ola-selection' + (st.selection.length ? ' is-scoped' : '') + '" data-ol-selection role="status">' + selectionScopeHtml() + '</div><div class="tasco-ai-attachments ola-files" data-ol-file-list="refine"' + (st.refineFiles.length ? '' : ' hidden') + '>' + filesHtml('refineFiles') + '</div>'
      + '<div class="tasco-ai-composer ola-refine-box"><label class="ola-icon-btn' + (st.busy ? ' is-disabled' : '') + '" title="Đính kèm ảnh/PDF để AI đọc khi sửa"><input type="file" data-ol-files="refine" accept="image/*,application/pdf" multiple hidden' + (st.busy ? ' disabled' : '') + '>' + svg(ICON.attach) + '</label>' + deepChipHtml(true) + '<input class="tasco-ai-input" data-ol-refine-input maxlength="600" placeholder="Nhờ AI chỉnh sửa công văn hoặc đoạn đã chọn…" title="Bôi đen một đoạn trong công văn để chỉ sửa đoạn đó" aria-label="Yêu cầu chỉnh sửa"' + (st.busy ? ' disabled' : '') + '>'
      + '<button type="button" class="tasco-ai-send" data-ol-act="refine" aria-label="Gửi yêu cầu chỉnh sửa"' + (st.busy ? ' disabled' : '') + '>' + svg(ICON.send) + '</button></div><div class="ola-suggest-line"><span>Gợi ý</span><div class="tasco-ai-suggest">' + REFINES.map(text => '<button type="button" class="tasco-ai-suggest__chip" data-ol-refine="' + esc(text) + '"' + (st.busy ? ' disabled' : '') + '>' + esc(text) + '</button>').join('') + '</div></div></div>';
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
    const compact = new Set(['plate', 'driver', 'noticeDate', 'lossTime', 'standardTyre', 'fittedTyre']);
    return '<div data-ol-block="fields"><div class="ola-fields-intro"><div><h3>Thông tin công văn</h3><p>Kiểm tra và chỉnh sửa thông tin trước khi soạn lại.</p></div><span>' + tpl.fields.length + ' mục</span></div>'
      + '<p class="' + (missing.length ? 'ol-warn' : 'ol-ok') + ' ola-fields-status" data-ol-missing>' + esc(missingText(missing)) + '</p><div class="ol-form">' + tpl.fields.map(field => {
        const flag = field.required && !Core().single(st.values[field.key], 1);
        return '<label class="ol-field' + (compact.has(field.key) && field.type !== 'textarea' ? '' : ' is-wide') + (flag ? ' is-missing' : '') + '" data-ol-wrap="' + esc(field.key) + '"><span>' + esc(field.label) + (field.required ? ' <b title="Bắt buộc">*</b>' : '')
          + (st.filledByAI.includes(field.key) ? ' <em class="ol-ai-tag">AI điền</em>' : '') + '</span>' + fieldInput(field, st.values[field.key]) + '</label>';
      }).join('') + '</div>'
      + '<div class="ol-extras"><b>Thông tin bổ sung</b>' + st.extras.map(item => extraRowHtml(item)).join('') + '<button type="button" class="ol-add" data-ol-act="add-extra">+ Thêm</button></div></div>';
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
    const picker = docs.length ? '<fieldset class="ol-legal-doc"><legend>Chọn nhiều căn cứ từ Thư viện</legend><small>Các đoạn trích sẽ chỉ lấy từ những văn bản đã tích.</small>'
      + '<label class="ol-legal-auto"><input type="radio" name="ol-legal-pin" data-ol-legal-doc value=""' + (!st.legalPin.length ? ' checked' : '') + (st.busy ? ' disabled' : '') + '>Tự động — tìm trong tất cả văn bản</label>'
      + '<div class="ol-legal-doc-list">' + docs.map(doc => '<label><input type="checkbox" name="ol-legal-pin" data-ol-legal-doc value="' + esc(doc.id) + '"' + (st.legalPin.includes(doc.id) ? ' checked' : '') + (doc.active && !st.busy ? '' : ' disabled') + '><span>' + esc(doc.name + (doc.soHieu && !fold(doc.name).includes(fold(doc.soHieu)) ? ' (' + doc.soHieu + ')' : '') + (doc.active ? '' : ' — hết hiệu lực')) + '</span></label>').join('') + '</div></fieldset>' : '';
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
    return '<div class="ola-drawer-backdrop" data-ol-drawer-close></div><aside class="ola-drawer" role="dialog" aria-label="Chi tiết công văn"><header><div class="ola-drawer-heading"><div><small>KHÔNG GIAN SOẠN THẢO</small><h2>Chi tiết công văn</h2><p>Quản lý nội dung và căn cứ soạn thảo</p></div><button type="button" class="ol-x" data-ol-drawer-close aria-label="Đóng">' + svg(ICON.close) + '</button></div><div class="ola-tabs" role="tablist" aria-label="Các phần chi tiết công văn">'
      + tabs.map(([name, label]) => '<button type="button" role="tab" aria-selected="' + (st.drawer === name) + '" data-ol-drawer="' + name + '">' + label + '</button>').join('')
      + '</div></header><div class="ola-drawer-body">' + body() + '</div>'
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
  const askSide = () => st.mode === 'ask' && !!QA();
  function histRowHtml(item, activeId, openAttr, delAttr, delLabel, subText, picked) {
    const isActive = item.id === activeId;
    if (st.histSelect) {
      const checked = picked.has(item.id);
      return '<div class="ola-hist-item is-selecting' + (isActive ? ' is-active' : '') + (checked ? ' is-checked' : '') + '">'
        + '<button type="button" class="ola-hist-pick" role="checkbox" aria-checked="' + (checked ? 'true' : 'false') + '" data-ol-hist-toggle="' + esc(item.id) + '" title="' + esc(item.title) + '"' + (histLocked() ? ' disabled' : '') + '>'
        + '<span class="ola-hist-check" aria-hidden="true">' + (checked ? svg(ICON.check) : '') + '</span>'
        + '<span class="ola-hist-meta"><b>' + esc(item.title) + '</b><small>' + esc(subText) + '</small></span>'
        + '</button></div>';
    }
    const kind = openAttr === 'data-ol-qa-open' ? 'qa' : 'letter';
    if (st.histRename && st.histRename.kind === kind && st.histRename.id === item.id) {
      return '<div class="ola-hist-item is-renaming' + (isActive ? ' is-active' : '') + '"><input type="text" class="ola-hist-rename" data-ol-hist-rename-input maxlength="120" value="' + esc(item.title) + '" aria-label="Tên mới" placeholder="Nhập tên rồi Enter"></div>';
    }
    return '<div class="ola-hist-item' + (isActive ? ' is-active' : '') + '"><button type="button" ' + openAttr + '="' + esc(item.id) + '" title="' + esc(item.title) + ' (bấm đúp để đổi tên)"><b>' + esc(item.title) + '</b><small>' + esc(subText) + '</small></button>'
      + '<button type="button" class="ola-hist-edit" data-ol-hist-rename="' + kind + ':' + esc(item.id) + '" aria-label="Đổi tên" title="Đổi tên"' + (histLocked() ? ' disabled' : '') + '>' + svg(ICON.pencil) + '</button>'
      + '<button type="button" class="ola-hist-del" ' + delAttr + '="' + esc(item.id) + '" aria-label="' + delLabel + '" title="Xoá">' + svg(ICON.trash) + '</button></div>';
  }
  function qaChatsHtml() {
    const H = History();
    const query = fold(st.histQuery).trim();
    const items = qaVisibleItems();
    if (!items.length) return '<p class="ola-hist-empty">' + (query ? 'Không có cuộc trò chuyện khớp “' + esc(st.histQuery) + '”.' : 'Chưa có cuộc trò chuyện nào. Câu hỏi đầu tiên sẽ tự được lưu ở đây.') + '</p>';
    const time = ms => { const d = new Date(ms), now = new Date(); const p = n => String(n).padStart(2, '0'); return d.toDateString() === now.toDateString() ? p(d.getHours()) + ':' + p(d.getMinutes()) : p(d.getDate()) + '/' + p(d.getMonth() + 1); };
    const picked = new Set(st.histPicked);
    return H.groups(items).map(group => '<div class="ola-hist-group"><h4>' + esc(group.label) + '</h4>'
      + group.items.map(item => histRowHtml(item, qa.activeId, 'data-ol-qa-open', 'data-ol-qa-del', 'Xoá cuộc trò chuyện', [item.sub, time(item.updatedAt)].join(' · '), picked)).join('') + '</div>').join('');
  }
  function historyItemsHtml() {
    const H = History();
    if (!H) return '';
    if (askSide()) return qaChatsHtml();
    const query = fold(st.histQuery).trim();
    const items = historyVisibleItems();
    if (!items.length) return '<p class="ola-hist-empty">' + (query ? 'Không có công văn khớp “' + esc(st.histQuery) + '”.' : 'Chưa có công văn nào. Công văn soạn xong sẽ tự lưu ở đây.') + '</p>';
    const time = ms => { const d = new Date(ms), now = new Date(); const p = n => String(n).padStart(2, '0'); return d.toDateString() === now.toDateString() ? p(d.getHours()) + ':' + p(d.getMinutes()) : p(d.getDate()) + '/' + p(d.getMonth() + 1); };
    const picked = new Set(st.histPicked);
    return H.groups(items).map(group => '<div class="ola-hist-group"><h4>' + esc(group.label) + '</h4>'
      + group.items.map(item => histRowHtml(item, st.historyId, 'data-ol-hist-open', 'data-ol-hist-del', 'Xoá khỏi lịch sử', [item.sub, time(item.updatedAt)].filter(Boolean).join(' · '), picked)).join('') + '</div>').join('');
  }
  function histBulkHtml() {
    if (!st.histSelect) return '';
    const vis = histVisibleIds();
    const picked = new Set(histPickedValid());
    const count = picked.size;
    const allOn = vis.length > 0 && vis.every(id => picked.has(id));
    const locked = histLocked();
    const noun = askSide() ? 'cuộc trò chuyện' : 'công văn';
    return '<div class="ola-hist-bulk-row">'
      + '<button type="button" class="ola-hist-bulk-all' + (allOn ? ' is-on' : '') + '" data-ol-act="hist-select-all"' + (locked || !vis.length ? ' disabled' : '') + '>'
      + '<span class="ola-hist-check" aria-hidden="true">' + (allOn ? svg(ICON.check) : '') + '</span>'
      + '<span>' + (allOn ? 'Bỏ chọn tất cả' : 'Chọn tất cả') + '</span></button>'
      + '<button type="button" class="ola-hist-bulk-cancel" data-ol-act="hist-select-cancel">Huỷ</button>'
      + '</div>'
      + '<button type="button" class="ola-hist-bulk-del" data-ol-act="hist-del-selected"' + (locked || !count ? ' disabled' : '') + '>'
      + svg(ICON.trash) + '<span>' + (count ? 'Xoá ' + count + ' ' + noun : 'Chọn mục để xoá') + '</span></button>';
  }
  function historyHtml() {
    if (!History() || !st.histOpen) return '';
    const ask = askSide();
    const hasItems = histAllIds().length > 0;
    const locked = histLocked();
    return '<div class="ola-hist-backdrop" data-ol-hist-backdrop></div><aside class="ola-hist' + (st.histSelect ? ' is-selecting' : '') + '" aria-label="' + (ask ? 'Lịch sử hỏi nghiệp vụ' : 'Lịch sử công văn') + '"><header><b>' + svg(ICON.history) + 'Lịch sử</b><span>'
      + '<button type="button" class="ola-hist-btn' + (st.histSelect ? ' is-active' : '') + '" data-ol-act="hist-select" title="' + (st.histSelect ? 'Thoát chế độ chọn nhiều' : 'Chọn nhiều để xoá') + '" aria-label="' + (st.histSelect ? 'Thoát chế độ chọn nhiều' : 'Chọn nhiều để xoá') + '" aria-pressed="' + (st.histSelect ? 'true' : 'false') + '"' + (locked || (!hasItems && !st.histSelect) ? ' disabled' : '') + '>' + svg(ICON.checklist) + '</button>'
      + (ask ? '<button type="button" class="ola-hist-btn" data-ol-act="qa-new" title="Cuộc trò chuyện mới" aria-label="Cuộc trò chuyện mới"' + (qa.busy ? ' disabled' : '') + '>' + svg(ICON.plus) + '</button>'
        : '<button type="button" class="ola-hist-btn" data-ol-act="new" title="Công văn mới" aria-label="Công văn mới"' + (st.busy ? ' disabled' : '') + '>' + svg(ICON.plus) + '</button>')
      + '<button type="button" class="ola-hist-btn" data-ol-act="hist-toggle" title="Thu gọn" aria-label="Thu gọn lịch sử">' + svg(ICON.panel) + '</button></span></header>'
      + '<label class="ola-hist-search">' + svg(ICON.search) + '<input type="search" data-ol-hist-q placeholder="' + (ask ? 'Tìm cuộc trò chuyện…' : 'Tìm công văn…') + '" value="' + esc(st.histQuery) + '" aria-label="Tìm trong lịch sử"></label>'
      + (st.histSelect ? '<div class="ola-hist-bulk" data-ol-hist-bulk>' + histBulkHtml() + '</div>' : '')
      + '<div class="ola-hist-list" data-ol-hist-list>' + historyItemsHtml() + '</div>'
      + '<footer>' + (!ask && st.histScope === 'account' ? 'Lưu theo tài khoản' : 'Lưu trên trình duyệt này') + '</footer></aside>';
  }
  function updateHistory(listOnly) {
    const box = $('[data-ol-hist-list]');
    if (!box) return;
    if (st.histSelect && !histAllIds().length) { exitHistSelect(); renderAll(); return; }
    box.innerHTML = historyItemsHtml();
    const bulk = $('[data-ol-hist-bulk]');
    if (bulk) bulk.innerHTML = histBulkHtml();
    const selBtn = $('[data-ol-act="hist-select"]');
    if (selBtn) selBtn.disabled = histLocked() || (!histAllIds().length && !st.histSelect);
    if (!listOnly) { const foot = $('.ola-hist footer'); if (foot) foot.textContent = !askSide() && st.histScope === 'account' ? 'Lưu theo tài khoản' : 'Lưu trên trình duyệt này'; }
  }

  function renderAll() {
    if (!host) return;
    const root = $('[data-ol-root]');
    const active = document.activeElement, focusSel = active && host.contains(active) ? (active.matches('[data-ol-rec-q]') ? '[data-ol-rec-q]' : active.matches('[data-ol-brief]') ? '[data-ol-brief]' : active.matches('[data-ol-qa-input]') ? '[data-ol-qa-input]' : '') : '';
    const focusRule = active && host.contains(active) && active.matches('[data-ol-rule]') ? active.dataset.olRule : null;
    const asking = st.mode === 'ask' && !!QA();
    const working = asking ? !!(qa.messages.length || qa.busy) : !!(st.letter || (st.busy && st.steps));
    const qaBox = $('[data-ol-qa-scroll]'), qaTop = qaBox ? qaBox.scrollTop : 0;
    const scrollBox = $('[data-ol-scroll]'), scrollTop = scrollBox ? scrollBox.scrollTop : 0;
    const mainBox = $('.ola-main'), mainTop = mainBox ? mainBox.scrollTop : 0;
    const histScroll = $('[data-ol-hist-list]'), histTop = histScroll ? histScroll.scrollTop : 0;
    root.innerHTML = historyHtml() + '<div class="ola-main' + (working ? ' is-working' : '') + (asking ? ' is-ask' : '') + '">' + topbarHtml()
      + (asking ? qaHtml() : working ? workHtml() : heroHtml()) + '</div>' + drawerHtml();
    const nextHist = $('[data-ol-hist-list]'); if (nextHist) nextHist.scrollTop = histTop;
    root.classList.toggle('is-working', working);
    root.classList.toggle('has-history', st.histOpen);
    fitHeight();
    const nextScroll = $('[data-ol-scroll]'); if (nextScroll) nextScroll.scrollTop = scrollTop;
    const nextQa = $('[data-ol-qa-scroll]'); if (nextQa) nextQa.scrollTop = qaTop;
    const brief = $('[data-ol-brief]'); if (brief) autoGrow(brief);
    const qaInput = $('[data-ol-qa-input]'); if (qaInput) autoGrow(qaInput);
    if (st.pop === 'record') { updateRecList(); $('[data-ol-rec-q]')?.focus({preventScroll:true}); }
    else if (st.pop === 'rules' && focusRule !== null) [...host.querySelectorAll('[data-ol-rule]')].find(node => node.dataset.olRule === focusRule)?.focus({preventScroll:true});
    else if (focusSel) $(focusSel)?.focus({preventScroll:true});
    const nextMain = $('.ola-main'); if (nextMain) nextMain.scrollTop = mainTop;
    if (st.busy || st.pending) {
      host.querySelectorAll('[data-ol-act="new"], [data-ol-act="edit"], [data-ol-hist-open], [data-ol-hist-del], [data-ol-hist-toggle], [data-ol-act="hist-select"], [data-ol-act="hist-select-all"], [data-ol-act="hist-del-selected"], [data-ol-drawer], [data-ol-act="compose"]').forEach(node => { node.disabled = true; });
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
    if (line) { line.className = (missing.length ? 'ol-warn' : 'ol-ok') + ' ola-fields-status'; line.textContent = missingText(missing); }
  }

  // ---- Cài đặt đơn vị ban hành ----
  // Thẻ cài đặt cho từng nhà cung cấp AI: khoá, danh sách mô hình, (tuỳ chỉnh) địa chỉ gốc, và cầu nối Antigravity.
  function antigravityCard(M, cfg, field) {
    const base = (cfg.providers.antigravity && cfg.providers.antigravity.base) || '';
    const host = base ? base.replace(/^https:\/\//i, '').replace(/\/.*$/, '') : '';
    const display = base ? base.replace(/\/v1$/i, '') : '';
    return '<section class="ol-set-card ol-set-key" data-prov="antigravity"><div class="ol-set-card-head"><h3>Antigravity (máy trung gian riêng)</h3><span class="ol-set-pill is-ok" data-ag-st>' + esc(host ? 'Tailscale · ' + host : 'Mặc định · localhost') + '</span></div>'
      + '<p class="ol-set-note">Xác thực bằng tài khoản đăng nhập website (Firebase), không lưu khoá relay trên trình duyệt. Để trống để dùng mặc định trên chính máy này (<code>http://127.0.0.1:18318/v1</code>), hoặc nhập địa chỉ HTTPS Tailscale (<code>.ts.net</code>) lưu riêng trên trình duyệt này.</p>'
      + field('Địa chỉ máy trung gian Tailscale <em>(tuỳ chọn · chỉ HTTPS .ts.net)</em>', '<input data-ag-base type="url" maxlength="300" value="' + esc(display) + '" placeholder="https://ten-may.tailxxxx.ts.net (để trống = localhost)" autocomplete="off" spellcheck="false">', true)
      + '<div class="ol-set-links"><span data-ag-count>' + esc(agyCountText(cfg)) + '</span><span class="ol-set-actions"><button type="button" class="ol-set-link" data-ag-fetch>Lấy danh sách mô hình từ Antigravity</button><button type="button" class="ol-set-link" data-ag-reset' + (base ? '' : ' hidden') + '>Dùng mặc định (localhost)</button></span></div>'
      + '<div class="ol-set-models" data-ag-list>' + agyChips(cfg) + '</div></section>';
  }
  const agyAll = cfg => Models().entries(cfg).filter(entry => entry.provider === 'antigravity').map(entry => entry.model);
  const agyCountText = cfg => 'Đang dùng ' + agyAll(cfg).length + ' mô hình Antigravity' + ((cfg.providers.antigravity.models || []).length ? ' (đã lấy từ máy trung gian)' : ' (mặc định — bấm "Lấy danh sách" để dùng toàn bộ mô hình của tài khoản)') + '.';
  const agyChips = cfg => agyAll(cfg).map(name => '<span class="ol-set-chip is-on">' + esc(name) + '</span>').join('');
  function providerCards() {
    const M = Models();
    if (!M) return '';
    const cfg = aiConfig(), field = (label, inner, wide) => '<label class="ol-set-field' + (wide ? ' is-wide' : '') + '"><span>' + label + '</span>' + inner + '</label>';
    return M.ORDER.map(id => {
      const p = M.PROVIDERS[id], c = cfg.providers[id];
      return '<section class="ol-set-card ol-set-key" data-prov="' + id + '"><div class="ol-set-card-head"><h3>' + esc(id === 'custom' ? 'AI tuỳ chỉnh (tương thích OpenAI)' : p.label) + (p.free ? ' <span class="ol-set-free">miễn phí</span>' : '') + '</h3><span class="ol-set-pill is-wait" data-st>Đang kiểm tra…</span></div>'
        + '<p class="ol-set-note">' + esc(p.note) + '</p>'
        + (id === 'custom' ? '<div class="ol-set-grid">' + field('Tên hiển thị <em>(tuỳ chọn)</em>', '<input data-label maxlength="40" value="' + esc(c.label) + '" placeholder="OpenRouter" autocomplete="off">') + field('Địa chỉ gốc API', '<input data-base maxlength="300" value="' + esc(c.base) + '" placeholder="https://openrouter.ai/api/v1" autocomplete="off" spellcheck="false">') + '</div>' : '')
        + field('Khoá API mới <em>(để trống nếu giữ nguyên)</em>', '<div class="ol-set-secret"><input data-key type="password" autocomplete="off" spellcheck="false" maxlength="200" placeholder="' + esc(p.keyHint) + '"><button type="button" class="ol-set-eye" data-eye aria-label="Hiện / ẩn khoá" title="Hiện / ẩn khoá"><span data-eye-icon></span></button></div>')
        + field('Mô hình <em>(cách nhau dấu phẩy; mô hình đầu là mặc định)</em>', '<input data-models maxlength="400" value="' + esc(c.models.join(', ')) + '" placeholder="' + esc(id === 'custom' ? 'meta-llama/llama-3.3-70b-instruct:free' : p.models.join(', ')) + '" autocomplete="off" spellcheck="false">')
        + '<div class="ol-set-models" data-list></div>'
        + '<div class="ol-set-links">' + (p.keyUrl ? '<a href="' + esc(p.keyUrl) + '" target="_blank" rel="noopener noreferrer">Lấy khoá ↗</a>' : '<span></span>') + '<span class="ol-set-actions"><button type="button" class="ol-set-link" data-fetch>Lấy danh sách mô hình</button><button type="button" class="ol-set-danger" data-clear hidden>Xoá khoá</button></span></div></section>';
    }).join('') + antigravityCard(M, cfg, field);
  }
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
      + '<div><h2 id="olSetTitle">Cài đặt AI nghiệp vụ</h2><p>Thông tin đơn vị ban hành và kết nối AI</p></div>'
      + '<button type="button" class="ol-set-x" data-cancel aria-label="Đóng">' + icon('<path d="M18 6 6 18M6 6l12 12"/>') + '</button></header>'
      + '<div class="ol-set-body">'
      + providerCards()
      + '<section class="ol-set-card"><div class="ol-set-card-head"><h3>Đơn vị ban hành</h3><small>Lưu trên máy này, dùng cho mọi công văn</small></div><div class="ol-set-grid">' + rows.map(field).join('') + '</div></section>'
      + '</div>'
      + '<footer class="ol-set-foot"><button type="button" class="tasco-ai-btn-ghost" data-cancel>Hủy</button><button type="submit" class="tasco-ai-btn-primary">Lưu cài đặt</button></footer></form>';
    document.body.appendChild(dialog);
    const close = () => { dialog.close(); dialog.remove(); };
    dialog.querySelectorAll('[data-cancel]').forEach(button => { button.onclick = close; });
    const eyeIcon = icon('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>');
    const cards = {};
    if (Models()) Models().ORDER.forEach(id => {
      const card = dialog.querySelector('[data-prov="' + id + '"]');
      if (!card) return;
      const ui = cards[id] = {card, state: card.querySelector('[data-st]'), key: card.querySelector('[data-key]'), clear: card.querySelector('[data-clear]'), models: card.querySelector('[data-models]'), list: card.querySelector('[data-list]'), fetch: card.querySelector('[data-fetch]'), base: card.querySelector('[data-base]'), label: card.querySelector('[data-label]'), stored: ''};
      const setState = (kind, text) => { ui.state.className = 'ol-set-pill is-' + kind; ui.state.textContent = text; };
      card.querySelector('[data-eye]').onclick = () => { ui.key.type = ui.key.type === 'password' ? 'text' : 'password'; ui.key.focus(); };
      Models().getKey(id).then(key => {
        ui.stored = key;
        if (key) { setState('ok', 'Đã kết nối · …' + key.slice(-4)); ui.key.placeholder = 'Nhập khoá mới để thay thế'; } else setState('off', 'Chưa có khoá');
        ui.clear.hidden = !key;
      });
      ui.clear.onclick = async () => {
        const s = Models().PROVIDERS[id] && (id === 'deepseek' ? DeepSeekKeyStore : id === 'gemini' ? GeminiKeyStore : ProviderKeyStore[id]);
        if (s) await s.clear();
        ui.stored = ''; setState('off', 'Chưa có khoá'); ui.clear.hidden = true; ui.key.placeholder = Models().PROVIDERS[id].keyHint; aiKeys[id] = false;
        toast('Đã xoá khoá ' + Models().PROVIDERS[id].label + '.', 'info');
      };
      const chipsFor = names => {
        const chosen = Models().parseModels(ui.models.value);
        ui.list.innerHTML = names.length ? names.map(name => '<button type="button" class="ol-set-chip' + (chosen.includes(name) ? ' is-on' : '') + '" data-pick="' + esc(name) + '">' + esc(name) + '</button>').join('') : '<small>Không có mô hình nào khả dụng.</small>';
      };
      ui.fetch.onclick = async () => {
        const tmp = Models().normalize({providers: {[id]: {models: ['x'], base: ui.base ? ui.base.value : ''}}});
        ui.fetch.disabled = true; const old = ui.fetch.textContent; ui.fetch.textContent = 'Đang lấy…';
        try {
          const names = await Models().listModels(id, tmp, {apiKey: ui.key.value.trim() || ui.stored});
          chipsFor(names); toast('Có ' + names.length + ' mô hình — bấm để chọn.', 'success');
        } catch (error) { ui.list.innerHTML = ''; toast(error.message, 'warning'); }
        ui.fetch.disabled = false; ui.fetch.textContent = old;
      };
      ui.list.onclick = event => {
        const pick = event.target.closest('[data-pick]');
        if (!pick) return;
        const name = pick.dataset.pick, chosen = Models().parseModels(ui.models.value);
        ui.models.value = (chosen.includes(name) ? chosen.filter(item => item !== name) : chosen.concat(name)).join(', ');
        pick.classList.toggle('is-on');
      };
    });
    const agBaseInput = dialog.querySelector('[data-ag-base]');
    const agResetBtn = dialog.querySelector('[data-ag-reset]');
    const agStatePill = dialog.querySelector('[data-ag-st]');
    const agFetchBtn = dialog.querySelector('[data-ag-fetch]');
    let agModels = (aiConfig().providers.antigravity.models || []).slice();   // danh sách lấy từ máy trung gian, lưu khi bấm Lưu
    if (agFetchBtn && agBaseInput) {
      agFetchBtn.onclick = async () => {
        const raw = agBaseInput.value.trim(), base = raw ? Models().normalizeAntigravityBase(raw) : '';
        if (raw && !base) { toast('Địa chỉ Antigravity phải là HTTPS Tailscale (.ts.net).', 'warning'); agBaseInput.focus(); return; }
        const tmp = Models().normalize({providers: {antigravity: {base}}});
        agFetchBtn.disabled = true; const old = agFetchBtn.textContent; agFetchBtn.textContent = 'Đang lấy…';
        try {
          const names = await Models().listModels('antigravity', tmp);
          if (!names.length) throw new Error('Máy trung gian chưa liệt kê mô hình nào — hãy đăng nhập tài khoản Antigravity trong CLIProxyAPI.');
          agModels = Models().parseAgyModels(names);
          tmp.providers.antigravity.models = agModels;
          dialog.querySelector('[data-ag-count]').textContent = agyCountText(tmp);
          dialog.querySelector('[data-ag-list]').innerHTML = agyChips(tmp);
          toast('Có ' + agyAll(tmp).length + ' mô hình Antigravity — bấm Lưu để dùng.', 'success');
        } catch (error) { toast(error.message, 'warning'); }
        agFetchBtn.disabled = false; agFetchBtn.textContent = old;
      };
    }
    if (agResetBtn && agBaseInput) {
      agResetBtn.onclick = () => {
        agBaseInput.value = '';
        agResetBtn.hidden = true;
        if (agStatePill) agStatePill.textContent = 'Mặc định · localhost';
        agBaseInput.focus();
      };
    }
    dialog.querySelectorAll('[data-eye-icon]').forEach(node => { node.innerHTML = eyeIcon; });
    dialog.querySelector('form').onsubmit = async event => {
      event.preventDefault();
      const next = {}; rows.forEach(([key]) => { next[key] = dialog.querySelector('[name="' + key + '"]').value; });
      if (Models()) {
        const M = Models(), providers = {};
        if (agBaseInput) {
          const agRaw = agBaseInput.value.trim();
          const agBase = agRaw ? M.normalizeAntigravityBase(agRaw) : '';
          if (agRaw && !agBase) {
            toast('Địa chỉ Antigravity phải là HTTPS Tailscale (.ts.net), không chứa tài khoản/mật khẩu hoặc tham số truy vấn (?…).', 'warning');
            agBaseInput.focus();
            return;
          }
          providers.antigravity = {base: agBase, models: agModels};
        }
        for (const id of M.ORDER) {
          const ui = cards[id];
          if (!ui) continue;
          providers[id] = {models: M.parseModels(ui.models.value)};
          if (id === 'custom') { providers[id].base = M.normalizeBase(ui.base.value); providers[id].label = ui.label.value; if (providers[id].models.length && !providers[id].base) { toast('Nhập địa chỉ gốc API hợp lệ (https://…) cho mục Tuỳ chỉnh.', 'warning'); return; } }
          const keyValue = ui.key.value.trim();
          if (keyValue) {
            try {
              const store = id === 'deepseek' ? DeepSeekKeyStore : id === 'gemini' ? GeminiKeyStore : ProviderKeyStore[id];
              const saved = await store.set(keyValue);
              toast(saved.scope === 'account' ? 'Đã lưu khoá ' + M.PROVIDERS[id].label + ' vào tài khoản.' : 'Đã lưu khoá ' + M.PROVIDERS[id].label + ' trên trình duyệt này (tài khoản chưa cho phép lưu).', 'success');
            } catch (error) { toast(error.message, 'warning'); return; }
          }
        }
        aiCfg = M.save({selected: aiConfig().selected, providers});
        refreshKeys();
      }
      saveIssuer(Core().normalizeIssuer(next)); close(); toast('Đã lưu cài đặt.', 'success'); renderAll();
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
    Object.assign(st, {templateId: '', recordKey: '', recQuery: '', recOpen: false, recActive: 0, brief: '', files: [], refineFiles: [], legalPin: [], libDocs: null, customTitle: '', histRename: null, sources: [], letter: null, analyzedKey: '', busy: '', status: '', notice: null, open: {}, pop: '', drawer: '', editing: false, steps: null, agentOpen:false, agentTask:'draft', historyId: '', savedRecordLabel: '', versions:[], selection:[], pending:null, reasoning:null, reviewView:'inline', versionId:'', usage: null, questionDrafts: Object.create(null)});
  }
  // Hộp xác nhận dùng chung của app (showPremiumConfirmModal) — không dùng hộp thoại hệ thống của trình duyệt.
  function askConfirm(options) {
    if (typeof showPremiumConfirmModal === 'function') return showPremiumConfirmModal(options);
    return Promise.resolve(window.confirm(options.title + '\n' + (options.message || '')));
  }
  const confirmDiscard = () => (st.values || st.letter) ? askConfirm({eyebrow: 'AI NGHIỆP VỤ', title: 'Bỏ bản đang soạn?', message: 'Nội dung đang nhập sẽ bị bỏ để bắt đầu công văn mới.', confirmText: 'Bỏ và soạn mới'}) : Promise.resolve(true);

  // ---- Sự kiện ----
  function closePop() { if (!st.pop) return; collectAll(); st.pop = ''; st.recQuery = ''; renderAll(); }
  function onClick(event) {
    const target = event.target;
    const modeBtn = target.closest('[data-ol-mode]');
    if (modeBtn) { setMode(modeBtn.dataset.olMode); return; }
    const cite = target.closest('[data-ol-qa-cite]');
    if (cite) { const holder = cite.closest('[data-ol-qa-msg]'); if (holder) openCite(holder.dataset.olQaMsg, cite.dataset.olQaCite); return; }
    const srcsToggle = target.closest('[data-ol-qa-srcs-toggle]');
    if (srcsToggle) { const id = srcsToggle.dataset.olQaSrcsToggle; setSourcesOpen(id, !qa.open[id + ':*']); return; }
    const srcHead = target.closest('[data-ol-qa-src]');
    if (srcHead) { toggleSource(srcHead.dataset.olQaSrc); return; }
    const qaIdea = target.closest('[data-ol-qa-idea]');
    if (qaIdea) { askQuestion(qaIdea.dataset.olQaIdea); return; }
    const qaCopy = target.closest('[data-ol-qa-copy]');
    if (qaCopy) { copyAnswer(qaCopy.dataset.olQaCopy); return; }
    const qaCompose = target.closest('[data-ol-qa-compose]');
    if (qaCompose) { composeFromAnswer(qaCompose.dataset.olQaCompose); return; }
    const qaRetry = target.closest('[data-ol-qa-retry]');
    if (qaRetry) { retryAnswer(qaRetry.dataset.olQaRetry); return; }
    const qaDeeper = target.closest('[data-ol-qa-deeper]');
    if (qaDeeper) { retryAnswer(qaDeeper.dataset.olQaDeeper, true); return; }
    const version = target.closest('[data-ol-version]');
    if (version && !st.busy && !st.pending) { collectAll(); st.versionId = version.dataset.olVersion; renderAll(); return; }
    const restore = target.closest('[data-ol-restore]');
    if (restore) { restoreVersion(restore.dataset.olRestore); return; }
    const histToggle = target.closest('[data-ol-hist-toggle]');
    if (histToggle) { toggleHistPick(histToggle.dataset.olHistToggle); return; }
    const renameBtn = target.closest('[data-ol-hist-rename]');
    if (renameBtn) { event.stopPropagation(); const [kind, ...rest] = renameBtn.dataset.olHistRename.split(':'); startRename(kind, rest.join(':')); return; }
    if (target.closest('[data-ol-hist-rename-input]')) return;
    const qaDel = target.closest('[data-ol-qa-del]');
    if (qaDel) { event.stopPropagation(); deleteQaChat(qaDel.dataset.olQaDel); return; }
    const qaOpen = target.closest('[data-ol-qa-open]');
    if (qaOpen) { openQaChat(qaOpen.dataset.olQaOpen); return; }
    const histDel = target.closest('[data-ol-hist-del]');
    if (histDel) { event.stopPropagation(); deleteHistory(histDel.dataset.olHistDel); return; }
    const histOpen = target.closest('[data-ol-hist-open]');
    if (histOpen) { openHistory(histOpen.dataset.olHistOpen); return; }
    if (target.closest('[data-ol-hist-backdrop]')) { st.histOpen = false; exitHistSelect(); renderAll(); return; }
    if (target.closest('[data-ol-agy-refresh]')) { refreshAgyModels(true); return; }
    const popButton = target.closest('[data-ol-pop]');
    if (popButton) { collectAll(); const name = popButton.dataset.olPop; st.pop = st.pop === name ? '' : name; if (st.pop === 'model') refreshAgyModels(false); st.recQuery = ''; st.recActive = 0; if (st.pop === 'record' && !index.length) loadRecords(); if (st.pop === 'rules' && st.libDocs === null) loadLibDocs().then(() => { if (st.pop === 'rules') renderAll(); }); renderAll(); return; }
    const pick = target.closest('[data-ol-pick]');
    if (pick) { collectAll(); st.recordKey = pick.dataset.olPick; st.pop = ''; st.recQuery = ''; renderAll(); focusMain(); return; }
    const modelBtn = target.closest('[data-ol-model]');
    if (modelBtn) { collectAll(); const cfg = aiConfig(); cfg.selected = modelBtn.dataset.olModel; aiCfg = Models().save(cfg); st.pop = ''; renderAll(); focusMain(); return; }
    const rule = target.closest('[data-ol-rule]');
    if (rule) {
      collectAll();
      const id = rule.dataset.olRule;
      if (!id) { st.legalPin = []; st.pop = ''; }
      else {
        st.legalPin = st.legalPin.includes(id) ? st.legalPin.filter(item => item !== id) : st.legalPin.concat(id);
        st.pop = 'rules';
      }
      if (st.mode === 'ask') saveQa();
      renderAll();
      if (!id) focusMain(true);
      return;
    }
    const type = target.closest('[data-ol-type]');
    if (type) { collectAll(); st.templateId = type.dataset.olType; st.pop = ''; renderAll(); focusMain(); return; }
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
    const option = target.closest('[data-ol-option]');
    if (option && !st.busy && !st.pending) {
      const [i, j] = option.dataset.olOption.split('|').map(Number), item = st.questions[i], input = host.querySelector('[data-ol-quick-answer="' + i + '"]');
      if (item && item.options && item.options[j] && input) { input.value = item.options[j]; st.questionDrafts[item.question] = input.value; input.focus(); }
      return;
    }
    const answer = target.closest('[data-ol-answer-submit]');
    if (answer && !st.busy && !st.pending) {
      const i = Number(answer.dataset.olAnswerSubmit), input = host.querySelector('[data-ol-quick-answer="' + i + '"]');
      if (input && input.value.trim()) answerQuestion(i, input.value);
      else if (input) { input.focus(); toast('Hãy chọn hoặc nhập câu trả lời.', 'info'); }
      return;
    }
    const assumption = target.closest('[data-ol-assumption]');
    if (assumption && !st.busy && !st.pending) {
      const text = st.assumptions[Number(assumption.dataset.olAssumption)], input = $('[data-ol-refine-input]');
      if (text && input) { st.selection = []; updateSelectionScope(); input.value = 'Điều chỉnh giả định sau: ' + text + '. Yêu cầu: '; input.focus(); }
      return;
    }
    const drawerTab = target.closest('[data-ol-drawer]');
    if (drawerTab) { collectAll(); st.drawer = drawerTab.dataset.olDrawer; renderAll(); if (st.drawer === 'legal' && !st.libDocs) loadLibDocs().then(() => { if (st.drawer === 'legal') renderAll(); }); return; }
    if (target.closest('[data-ol-drawer-close]')) { collectAll(); st.drawer = ''; renderAll(); return; }
    const act = target.closest('[data-ol-act]');
    if (!act) return;
    switch (act.dataset.olAct) {
      case 'docs-toggle': st.docsFold = !st.docsFold; updateFiles(); break;
      case 'agent-toggle': st.agentOpen = !st.agentOpen; updateSteps(); $('[data-ol-act="agent-toggle"]')?.focus(); break;
      case 'review': $('.ola-review')?.scrollIntoView({block:'start', behavior:'auto'}); break;
      case 'review-view': if (st.pending) { st.reviewView = act.dataset.olView === 'split' ? 'split' : 'inline'; repaintReview(); } break;
      case 'run': run(); break;
      case 'qa-send': askQuestion(); break;
      case 'qa-attach-remove': if (!qa.busy) { collectAll(); qa.attach.splice(Number(act.dataset.olIdx), 1); renderAll(); focusMain(true); } break;
      case 'qa-lib': if (qa.busy) break; collectAll(); qa.lib = !qa.lib; try { localStorage.setItem(LIB_KEY, qa.lib ? '1' : '0'); } catch (_) { /* bỏ qua */ } renderAll(); focusMain(true); break;
      case 'qa-export': exportChat(); break;
      case 'qa-new': newQaChat(); break;
      case 'qa-stop': controller?.abort(); break;
      case 'qa-deep': if (qa.busy || st.busy) break; collectAll(); qa.deep = !qa.deep; try { localStorage.setItem(DEEP_KEY, qa.deep ? '1' : '0'); } catch (_) { /* bỏ qua */ } renderAll(); focusMain(); break;
      case 'qa-clear': clearQa(); break;
      case 'compose': st.drawer = ''; compose(''); break;
      case 'refine': sendRefine(); break;
      case 'accept-changes': acceptChanges(); break;
      case 'reject-changes': discardChanges(); break;
      case 'clear-selection': st.selection = []; window.getSelection()?.removeAllRanges(); updateSelectionScope(); break;
      case 'edit': st.editing = true; renderAll(); $('[data-ol-brief]')?.focus(); break;
      case 'cancel-edit': collectAll(); st.editing = false; st.pop = ''; renderAll(); break;
      case 'docx': downloadDocx(); break;
      case 'save-record': saveToRecord(); break;
      case 'print': printLetter(); break;
      case 'copy': copyText(); break;
      case 'settings': st.pop = ''; openSettings(); break;
      case 'legal-search': searchMoreLegal(); break;
      case 'open-library':
        if (typeof TascoLibrary === 'undefined' || !TascoLibrary.open) { toast('Chưa tải được thư viện tài liệu. Hãy tải lại trang.', 'warning'); break; }
        st.libDocs = null; TascoLibrary.open(); break;
      case 'new': exitHistSelect(); st.mode = 'compose'; if (st.letter) { clearTimeout(saveTimer); if (st.historyId) saveHistory(); reset(); renderAll(); $('[data-ol-brief]')?.focus(); } else confirmDiscard().then(ok => { if (ok) { reset(); renderAll(); $('[data-ol-brief]')?.focus(); } }); break;
      case 'hist-toggle': st.histOpen = !st.histOpen; if (!st.histOpen) exitHistSelect(); try { localStorage.setItem(HIST_PANEL_KEY, st.histOpen ? '1' : '0'); } catch (_) { /* bỏ qua */ } renderAll(); break;
      case 'hist-select': toggleHistSelect(); break;
      case 'hist-select-cancel': toggleHistSelect(false); break;
      case 'hist-select-all': toggleHistSelectAll(); break;
      case 'hist-del-selected': deleteSelectedHistory(); break;
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
    else if (target.matches('[data-ol-qa-input]')) { qa.draft = target.value; autoGrow(target); }
    else if (target.matches('[data-ol-quick-answer]')) { const item = st.questions[Number(target.dataset.olQuickAnswer)]; if (item) st.questionDrafts[item.question] = target.value; }
    else if (target.matches('[data-ol-field]')) updateMissingLive();
    else if (target.matches('[data-ol-outline-text]')) st.outlineEdited = true;
    else if (target.closest && target.closest('.ol-paper')) { st.selection = []; updateSelectionScope(); refreshCitations(); saveSoon(); }
  }
  function onChange(event) {
    const target = event.target;
    if (target.matches('[data-ol-change]') && st.pending) { const change = st.pending.changes[Number(target.dataset.olChange)]; if (change) change.on = target.checked; updateReviewState(); return; }
    if (target.matches('[data-ol-change-all]') && st.pending) { st.pending.changes.forEach(item => { item.on = target.checked; }); host.querySelectorAll('[data-ol-change]').forEach(box => { box.checked = target.checked; }); updateReviewState(); return; }
    if (target.matches('[data-ol-legal-doc]')) { pickLegalDoc(target.value, target.type === 'checkbox', target.checked); return; }
    if (target.matches('[data-ol-slot]')) { addFiles(target.files, 'files', target.dataset.olSlot); target.value = ''; return; }
    if (target.matches('[data-ol-qa-file]')) { collectAll(); const picked = [...target.files]; target.value = ''; addQaFiles(picked); return; }
    if (target.matches('[data-ol-files]')) { addFiles(target.files, target.dataset.olFiles === 'refine' ? 'refineFiles' : 'files'); target.value = ''; }
    else if (target.matches('[data-ol-outline-on]')) st.outlineEdited = true;
    else if (target.matches('[data-ol-src-on]')) { const source = st.sources[Number(target.dataset.olSrcOn)]; if (source) { source.on = target.checked; target.closest('.ol-src').classList.toggle('is-off', !target.checked); } }
    else if (target.matches('[data-ol-date]') && /^\d{4}-\d{2}-\d{2}$/.test(target.value)) { syncLetter(); st.letter.date = target.value; renderAll(); saveSoon(); }
  }
  function onKeydown(event) {
    const target = event.target;
    if (!target.matches) return;
    if (target.matches('[data-ol-hist-rename-input]')) {
      if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); commitRename(); }
      else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelRename(); }
      return;
    }
    if (event.key === 'Escape') { if (st.pop) { event.preventDefault(); closePop(); return; } if (st.drawer) { collectAll(); st.drawer = ''; renderAll(); return; } if (st.histSelect) { event.preventDefault(); toggleHistSelect(false); return; } }
    if (target.matches('.ol-edit') && event.key === 'Enter') { event.preventDefault(); return; } // mỗi khối là một dòng/đoạn
    if (target.matches('[data-ol-brief]') && event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); run(); return; }
    if (target.matches('[data-ol-qa-input]') && event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); askQuestion(); return; }
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
    } else if (target.matches('[data-ol-qa-input]') && event.clipboardData && event.clipboardData.files.length) { event.preventDefault(); collectAll(); addQaFiles([...event.clipboardData.files]); }
    else if (target.matches('[data-ol-brief]') && event.clipboardData && event.clipboardData.files.length) { event.preventDefault(); addFiles(event.clipboardData.files); }
    else if (target.matches('[data-ol-refine-input]') && event.clipboardData && event.clipboardData.files.length) { event.preventDefault(); addFiles(event.clipboardData.files, 'refineFiles'); }
  }
  function onDragOver(event) { if (event.dataTransfer && [...event.dataTransfer.types].includes('Files') && event.target.closest && event.target.closest('.ola-composer, .ola-refine')) event.preventDefault(); }
  function onDrop(event) { if (event.dataTransfer && event.dataTransfer.files.length && event.target.closest && event.target.closest('.ola-composer, .ola-refine')) { event.preventDefault(); if (event.target.closest('.ola-qa-composer')) { collectAll(); addQaFiles([...event.dataTransfer.files]); } else addFiles(event.dataTransfer.files, event.target.closest('.ola-refine') ? 'refineFiles' : 'files'); } }
  // Bấm ra ngoài ô chọn (hồ sơ / loại) thì đóng.
  function onOutside(event) { if (st.pop && host && !(event.target.closest && (event.target.closest('.ola-pop') || event.target.closest('[data-ol-pop]')))) closePop(); }

    function onDblClick(event) {
    const row = event.target.closest && event.target.closest('[data-ol-qa-open], [data-ol-hist-open]');
    if (!row) return;
    event.preventDefault();
    if (row.dataset.olQaOpen) startRename('qa', row.dataset.olQaOpen); else startRename('letter', row.dataset.olHistOpen);
  }
  const onFocusOut = event => { if (event.target.matches && event.target.matches('[data-ol-hist-rename-input]')) commitRename(); };
  const HANDLERS = [['dblclick', onDblClick], ['focusout', onFocusOut], ['click', onClick], ['input', onInput], ['change', onChange], ['keydown', onKeydown], ['paste', onPaste], ['dragover', onDragOver], ['drop', onDrop]];

  function mount(container) {
    leave();
    host = container;
    loadRecords();
    loadQa();
    refreshKeys();
    host.innerHTML = '<div class="ola" data-ol-root></div>';
    HANDLERS.forEach(([name, fn]) => host.addEventListener(name, fn));
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('selectionchange', captureSelection);
    window.addEventListener('resize', fitHeight);
    try { const saved = localStorage.getItem(HIST_PANEL_KEY); st.histOpen = saved === null ? window.innerWidth >= 1000 : saved === '1'; } catch (_) { /* bỏ qua */ }
    qaTicker = setInterval(paintQaTimer, 1000);
    renderAll();
    const H = History();
    if (H) H.load().then(list => { st.history = list; st.histScope = H.scope(); if (host) updateHistory(); }).catch(() => { /* lịch sử là phụ */ });
  }

  function leave() {
    if (saveTimer && st.letter) { clearTimeout(saveTimer); saveHistory(); }
    generation++;
    controller?.abort(); controller = null;
    clearInterval(qaTicker); qaTicker = 0;
    st.busy = ''; st.status = ''; st.pop = '';
    exitHistSelect();
    if (host) HANDLERS.forEach(([name, fn]) => host.removeEventListener(name, fn));
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('selectionchange', captureSelection);
    st.selection = [];
    window.removeEventListener('resize', fitHeight);
    host = null;
  }

  return {mount, leave};
})();
