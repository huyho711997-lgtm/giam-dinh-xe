// Trang "Vẽ sơ đồ hiện trường" ĐỘC LẬP (so-do-hien-truong.html): dùng lại nguyên bộ module vẽ của trình vẽ trong hồ sơ,
// nhưng KHÔNG cần mở hồ sơ, không cần đăng nhập/Firebase. Dữ liệu ở lại trên máy người dùng:
//  • tự lưu nháp vào localStorage (mở lại trang là còn nguyên sơ đồ đang vẽ);
//  • "Lưu file" / "Mở file" (.json) để cất giữ, chuyển máy hoặc gửi cho người khác;
//  • "Xuất ảnh" PNG; in A4 và in lên giấy ký sẵn dùng các chức năng sẵn có.
// Nạp SAU cùng (sau scene-editor-ui.js): ghi đè những hàm gắn với hồ sơ (saveSceneDrawing, closeSceneDrawingModal) và
// bổ sung toast mà trang chính cung cấp.
const SceneStandalone = (() => {
  const DRAFT_KEY = 'sceneStandalone.v1', FILE_FORMAT = 'tasco-scene-diagram', FILE_VERSION = 1;
  const MAX_FILE_BYTES = 8 * 1024 * 1024, MAX_SHAPES = 5000, POLL_MS = 1500;
  let lastSaved = '', timer = 0, started = false;

  // ---------- Thông báo (trang chính có sẵn triggerToast/#toastContainer; trang này tự dựng bản gọn) ----------
  function toast(message, type = 'success') {
    let box = document.getElementById('toastContainer');
    if (!box) { box = document.createElement('div'); box.id = 'toastContainer'; box.className = 'toast-container'; document.body.appendChild(box); }
    const item = document.createElement('div');
    item.className = 'toast ' + type; item.setAttribute('role', 'status'); item.textContent = String(message || 'Đã hoàn tất thao tác.');
    box.appendChild(item);
    setTimeout(() => { item.style.opacity = '0'; item.style.transform = 'translateY(-10px)'; setTimeout(() => item.remove(), 260); }, type === 'info' ? 2200 : 3600);
  }

  // ---------- Dữ liệu sơ đồ <-> đối tượng lưu trữ ----------
  const nowStamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };
  function snapshot() {
    return {shapes: cloneSceneDiagramShapes(sceneShapes), templateMeta: cloneSceneTemplateMeta(ensureSceneTemplateMeta())};
  }
  const serialize = snap => JSON.stringify({s: snap.shapes, m: snap.templateMeta});
  // Chỉ nhận mảng đối tượng thuần có `type` chuỗi; bỏ phần tử rác để file hỏng/giả không làm treo trình vẽ.
  function sanitizeShapes(list) {
    if (!Array.isArray(list)) throw new Error('File không chứa dữ liệu sơ đồ hợp lệ.');
    if (list.length > MAX_SHAPES) throw new Error('Sơ đồ có quá nhiều đối tượng (tối đa ' + MAX_SHAPES + ').');
    return list.filter(item => item && typeof item === 'object' && !Array.isArray(item) && typeof item.type === 'string');
  }
  function parseFile(text) {
    let data;
    try { data = JSON.parse(text); } catch (_) { throw new Error('File không đúng định dạng JSON.'); }
    if (!data || typeof data !== 'object') throw new Error('File không phải sơ đồ hiện trường.');
    if (data.format !== FILE_FORMAT) throw new Error('File này không phải sơ đồ do trang vẽ hiện trường tạo ra.');
    if (!(data.version <= FILE_VERSION)) throw new Error('File được tạo bằng phiên bản mới hơn, vui lòng cập nhật ứng dụng.');
    return {shapes: sanitizeShapes(data.shapes), templateMeta: data.templateMeta && typeof data.templateMeta === 'object' ? data.templateMeta : null};
  }

  // ---------- Nháp tự lưu ----------
  function setStatus(text) { const el = document.getElementById('sceneDocumentAutoStatus'); if (el) el.textContent = text; }
  const clock = () => new Date().toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit', second: '2-digit'});
  function writeDraft(force) {
    if (!started) return false;
    let snap, key;
    try { snap = snapshot(); key = serialize(snap); } catch (error) { console.error(error); return false; }
    if (!force && key === lastSaved) return false;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({version: FILE_VERSION, updatedAt: Date.now(), shapes: snap.shapes, templateMeta: snap.templateMeta}));
      lastSaved = key; setStatus('Đã tự lưu nháp lúc ' + clock()); return true;
    } catch (error) {
      setStatus('Không tự lưu được nháp (bộ nhớ đầy) — hãy bấm "Lưu file"'); return false;
    }
  }
  function readDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY); if (!raw) return null;
      const data = JSON.parse(raw);
      return {shapes: sanitizeShapes(data.shapes), templateMeta: data.templateMeta && typeof data.templateMeta === 'object' ? data.templateMeta : null};
    } catch (_) { return null; }
  }

  // ---------- Áp dữ liệu vào trình vẽ ----------
  function apply(data) {
    if (data && data.shapes.length) {
      applySceneDiagramStoredData({shapes: JSON.stringify(data.shapes), templateMeta: data.templateMeta ? JSON.stringify(data.templateMeta) : null});
      setActiveDrawTool('select'); redrawSceneCanvas(true);
    } else {
      applySceneDiagramStoredData(null);
      if (data && data.templateMeta) sceneTemplateMeta = cloneSceneTemplateMeta(data.templateMeta);
      initSceneDrawing(); setActiveDrawTool('select');
    }
    if (typeof resetSceneZoom === 'function') resetSceneZoom();
    updateUndoRedoButtonsState();
  }
  const hasContent = () => sceneShapes.length > 0;

  // ---------- Các thao tác trên thanh đầu ----------
  function saveFile() {
    try {
      writeDraft(true);
      const snap = snapshot();
      const payload = JSON.stringify({format: FILE_FORMAT, version: FILE_VERSION, savedAt: new Date().toISOString(), shapes: snap.shapes, templateMeta: snap.templateMeta});
      download(new Blob([payload], {type: 'application/json'}), 'so-do-hien-truong-' + nowStamp() + '.json');
      toast('Đã lưu file sơ đồ (' + snap.shapes.length + ' đối tượng).');
    } catch (error) { toast('Chưa lưu được file: ' + error.message, 'error'); }
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function exportPng() {
    try {
      const url = createSceneDrawingExportDataUrl(), link = document.createElement('a');
      link.href = url; link.download = 'so-do-hien-truong-' + nowStamp() + '.png'; document.body.appendChild(link); link.click(); link.remove();
      toast('Đã tải ảnh sơ đồ (PNG).');
    } catch (error) { toast('Không xuất được ảnh: ' + error.message, 'error'); }
  }
  function openFile(file) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return toast('File quá lớn (tối đa 8 MB).', 'error');
    const reader = new FileReader();
    reader.onerror = () => toast('Không đọc được file.', 'error');
    reader.onload = () => {
      let data;
      try { data = parseFile(String(reader.result || '')); } catch (error) { return toast(error.message, 'error'); }
      if (hasContent() && !window.confirm('Thay sơ đồ đang vẽ bằng nội dung trong file "' + file.name + '"?\n(Sơ đồ hiện tại sẽ mất nếu chưa lưu file.)')) return;
      apply(data); writeDraft(true); toast('Đã mở file sơ đồ (' + data.shapes.length + ' đối tượng).');
    };
    reader.readAsText(file);
  }
  function newDiagram() {
    if (hasContent() && !window.confirm('Xoá sơ đồ đang vẽ và bắt đầu sơ đồ mới?\n(Hãy bấm "Lưu file" trước nếu muốn giữ lại.)')) return;
    sceneTemplateMeta = null; apply(null); writeDraft(true); toast('Đã tạo sơ đồ mới.', 'info');
  }
  function leave() { writeDraft(false); location.href = 'index.html'; }

  // ---------- Dựng thanh đầu & khởi động ----------
  const ICONS = {
    open: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/>',
    fresh: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 12v6M9 15h6"/>'
  };
  function headButton(id, label, title, icon, handler) {
    const button = document.createElement('button');
    button.type = 'button'; button.id = id; button.className = 'scene-head-btn'; button.title = title;
    button.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icon + '</svg><span>' + label + '</span>';
    button.addEventListener('click', handler); return button;
  }
  function decorateHeader() {
    const actions = document.querySelector('#sceneDrawingModalOverlay .scene-head-actions');
    const anchor = document.getElementById('btnPrintSceneDrawing');
    if (!actions || !anchor) return;
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json'; input.hidden = true; input.id = 'sceneStandaloneFile';
    input.addEventListener('change', () => { openFile(input.files && input.files[0]); input.value = ''; });
    document.body.appendChild(input);
    [headButton('btnSceneNew', 'Sơ đồ mới', 'Xoá sơ đồ đang vẽ và bắt đầu lại', ICONS.fresh, newDiagram),
     headButton('btnSceneOpenFile', 'Mở file', 'Mở sơ đồ đã lưu (.json)', ICONS.open, () => input.click()),
     headButton('btnSceneExportPng', 'Xuất ảnh', 'Tải sơ đồ thành ảnh PNG', ICONS.image, exportPng)
    ].forEach(button => actions.insertBefore(button, anchor));
    const save = document.getElementById('btnSaveSceneDrawing');
    if (save) { save.title = 'Lưu sơ đồ ra file .json (Ctrl+S) — để cất giữ hoặc mở lại trên máy khác'; const label = save.querySelector('span'); if (label) label.textContent = 'Lưu file'; }
    const close = document.querySelector('#sceneDrawingModalOverlay .scene-head-close');
    if (close) { close.title = 'Về ứng dụng chính (sơ đồ đã được tự lưu nháp)'; close.setAttribute('aria-label', 'Về ứng dụng chính'); }
  }

  function start() {
    try { if (localStorage.getItem('claimvision-theme') === 'light') document.body.classList.add('light-mode'); } catch (_) { /* giữ giao diện tối mặc định */ }
    // Ghi đè các hàm gắn với hồ sơ (gọi qua binding toàn cục nên onclick trong markup cũng dùng bản mới).
    window.saveSceneDrawing = async () => saveFile();
    window.closeSceneDrawingModal = () => leave();
    window.triggerToast = toast; window.showToast = toast;
    // Trình vẽ gọi hàm này sau MỖI thao tác (vẽ, hoàn tác, tiến tới) để tự lưu theo hồ sơ → ở đây chuyển thành lưu nháp trên máy (gộp 400 ms).
    let pending = 0;
    window.scheduleSceneDocumentAutoSave = () => { clearTimeout(pending); pending = setTimeout(() => writeDraft(false), 400); };
    decorateHeader();
    const draft = readDraft();
    if (draft && draft.shapes.length) applySceneDiagramStoredData({shapes: JSON.stringify(draft.shapes), templateMeta: draft.templateMeta ? JSON.stringify(draft.templateMeta) : null});
    else if (draft && draft.templateMeta) { sceneTemplateMeta = cloneSceneTemplateMeta(draft.templateMeta); }
    openSceneDrawingModal();
    // scene-editor-ui.js đặt lại dòng phụ theo hồ sơ khi mở → ghi dòng của trang độc lập SAU lệnh mở.
    const meta = document.getElementById('sceneHeaderMeta');
    if (meta) { meta.textContent = 'Trang vẽ độc lập — không cần mở hồ sơ, tự lưu nháp trên máy này'; meta.title = meta.textContent; }
    // openSceneDrawingModal khởi tạo canvas rỗng sau 100 ms khi chưa có lịch sử → chờ xong mới bắt đầu theo dõi để nháp cũ không bị ghi đè.
    setTimeout(() => {
      started = true; lastSaved = serialize(snapshot());
      if (draft && draft.shapes.length) setStatus('Đã khôi phục nháp lần trước (' + draft.shapes.length + ' đối tượng)');
      timer = setInterval(() => writeDraft(false), POLL_MS);
    }, 400);
    window.addEventListener('beforeunload', () => writeDraft(false));
    document.addEventListener('visibilitychange', () => { if (document.hidden) writeDraft(false); });
    document.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && String(event.key).toLowerCase() === 's') { event.preventDefault(); saveFile(); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  return {saveFile, exportPng, openFile, newDiagram, parseFile, sanitizeShapes, writeDraft, DRAFT_KEY, FILE_FORMAT, FILE_VERSION, stop: () => clearInterval(timer)};
})();
