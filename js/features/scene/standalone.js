// Trang "Vẽ sơ đồ hiện trường" ĐỘC LẬP (so-do-hien-truong.html): dùng lại nguyên bộ module vẽ của trình vẽ trong hồ sơ,
// nhưng KHÔNG cần mở hồ sơ, không cần đăng nhập/Firebase. Dữ liệu ở lại trên máy người dùng:
//  • tự lưu nháp vào localStorage (mở lại trang là còn nguyên sơ đồ đang vẽ);
//  • "Lưu" (Ctrl+S) đưa sơ đồ lên Cloudinary (js/features/scene-cloud/scene-cloud.js, không cần đăng nhập) và cho liên kết ?cloud=… để mở lại/gửi người khác;
//    nếu không lưu được lên đám mây thì tự tải file .json về máy để không mất dữ liệu. "Mở sơ đồ" mở từ danh sách đã lưu, liên kết hoặc file .json;
//  • "Xuất ảnh" PNG; in A4 và in lên giấy ký sẵn dùng các chức năng sẵn có.
// Nạp SAU cùng (sau scene-editor-ui.js): ghi đè những hàm gắn với hồ sơ (saveSceneDrawing, closeSceneDrawingModal) và
// bổ sung toast mà trang chính cung cấp.
const SceneStandalone = (() => {
  const DRAFT_KEY = 'sceneStandalone.v1', FILE_FORMAT = 'tasco-scene-diagram', FILE_VERSION = 1;
  const MAX_FILE_BYTES = 8 * 1024 * 1024, MAX_SHAPES = 5000, POLL_MS = 1500;
  const CLOUD_REF_KEY = 'sceneStandalone.cloudRef.v1';
  let lastSaved = '', timer = 0, started = false, cloudRef = '', saving = false;

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
    const out = {shapes: sanitizeShapes(data.shapes), templateMeta: data.templateMeta && typeof data.templateMeta === 'object' ? data.templateMeta : null};
    if (typeof data.name === 'string' && data.name.trim()) out.name = data.name.trim().slice(0, 120);
    return out;
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
  function saveFile(quiet) {
    try {
      writeDraft(true);
      const snap = snapshot();
      const payload = JSON.stringify({format: FILE_FORMAT, version: FILE_VERSION, savedAt: new Date().toISOString(), shapes: snap.shapes, templateMeta: snap.templateMeta});
      download(new Blob([payload], {type: 'application/json'}), 'so-do-hien-truong-' + nowStamp() + '.json');
      if (!quiet) toast('Đã lưu file sơ đồ (' + snap.shapes.length + ' đối tượng).');
      return true;
    } catch (error) { if (!quiet) toast('Chưa lưu được file: ' + error.message, 'error'); return false; }
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
  // ---------- Lưu / mở trên đám mây (Cloudinary) ----------
  const hasCloud = () => typeof SceneCloud !== 'undefined';
  const defaultName = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `Sơ đồ ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; };
  const fmtTime = ms => ms ? new Date(ms).toLocaleString('vi-VN', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'}) : '';
  const pageBase = () => { try { return location.href; } catch (_) { return ''; } };
  function bindRef(ref) {
    cloudRef = ref || '';
    try { if (ref) localStorage.setItem(CLOUD_REF_KEY, ref); else localStorage.removeItem(CLOUD_REF_KEY); } catch (_) { /* không bắt buộc */ }
    try { history.replaceState(null, '', ref && hasCloud() ? SceneCloud.shareLink(pageBase(), ref) : pageBase().split(/[?#]/)[0]); } catch (_) { /* file:// hoặc trình duyệt chặn */ }
  }
  async function copyText(text) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; } } catch (_) { /* thử cách khác */ }
    return false;
  }
  function setSaving(on) {
    saving = on;
    const button = document.getElementById('btnSaveSceneDrawing'), label = button && button.querySelector('span');
    if (button) button.disabled = on;
    if (label) label.textContent = on ? 'Đang lưu…' : 'Lưu';
  }
  // "Lưu": đưa lên đám mây; lỗi (mất mạng, preset sai…) → tự tải file .json về máy thay thế để không mất dữ liệu.
  async function saveCloud() {
    if (saving) return false;
    if (!hasCloud() || !SceneCloud.configured()) { toast('Chưa cấu hình đám mây — lưu file .json về máy.', 'info'); return saveFile(); }
    setSaving(true);
    try {
      writeDraft(true);
      const snap = snapshot(), name = defaultName();
      const text = JSON.stringify({format: FILE_FORMAT, version: FILE_VERSION, savedAt: new Date().toISOString(), name, shapes: snap.shapes, templateMeta: snap.templateMeta});
      const result = await SceneCloud.upload(text, 'so-do-hien-truong-' + nowStamp());
      SceneCloud.remember({ref: result.ref, name, savedAt: Date.now(), shapes: snap.shapes.length, bytes: result.bytes}, cloudRef);
      bindRef(result.ref);
      const copied = await copyText(SceneCloud.shareLink(pageBase(), result.ref));
      setStatus('Đã lưu lên đám mây lúc ' + clock());
      toast('Đã lưu lên đám mây (' + snap.shapes.length + ' đối tượng).' + (copied ? ' Đã chép liên kết chia sẻ.' : ' Mở "Mở sơ đồ" để lấy liên kết.'));
      return true;
    } catch (error) {
      const backedUp = saveFile(true);
      toast('Chưa lưu được lên đám mây: ' + error.message + (backedUp ? ' — đã tải file .json về máy thay thế.' : ''), 'error');
      return false;
    } finally { setSaving(false); }
  }
  async function openCloud(ref, options = {}) {
    if (!hasCloud() || !SceneCloud.isValidRef(ref)) return toast('Liên kết sơ đồ không hợp lệ.', 'error'), false;
    if (hasContent() && options.ask !== false && !window.confirm('Thay sơ đồ đang vẽ bằng sơ đồ trên đám mây?\n(Sơ đồ hiện tại sẽ mất nếu chưa lưu.)')) return false;
    try {
      toast('Đang mở sơ đồ từ đám mây…', 'info');
      const data = parseFile(await SceneCloud.download(ref));
      apply(data); bindRef(ref); writeDraft(true);
      const known = SceneCloud.readIndex().some(item => item.ref === ref);
      if (!known) SceneCloud.remember({ref, name: data.name || defaultName(), savedAt: Date.now(), shapes: data.shapes.length, bytes: 0}, '');
      toast('Đã mở sơ đồ từ đám mây (' + data.shapes.length + ' đối tượng).');
      return true;
    } catch (error) { toast(error.message, 'error'); return false; }
  }

  // ---------- Hộp thoại "Mở sơ đồ" ----------
  function el(tag, props, ...kids) {
    const node = document.createElement(tag);
    Object.entries(props || {}).forEach(([key, value]) => { if (key === 'class') node.className = value; else if (key === 'text') node.textContent = value; else if (key.startsWith('on')) node.addEventListener(key.slice(2), value); else node.setAttribute(key, value); });
    kids.flat().forEach(kid => { if (kid) node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid); });
    return node;
  }
  function closeDialog() { const box = document.getElementById('sceneCloudDialog'); if (box) box.remove(); document.removeEventListener('keydown', dialogKey, true); }
  function dialogKey(event) { if (event.key === 'Escape') { event.stopPropagation(); closeDialog(); } }
  function openDialog() {
    closeDialog();
    const cloudOn = hasCloud() && SceneCloud.configured();
    const list = el('div', {class: 'sc-list'});
    const fileInput = document.getElementById('sceneStandaloneFile');
    function renderList() {
      list.textContent = '';
      const items = cloudOn ? SceneCloud.readIndex() : [];
      if (!items.length) { list.appendChild(el('div', {class: 'sc-empty', text: cloudOn ? 'Chưa có sơ đồ nào trên máy này. Bấm "Lưu" để đưa sơ đồ lên đám mây.' : 'Chưa cấu hình đám mây — dùng file .json bên dưới.'})); return; }
      items.forEach(item => {
        const act = (label, handler) => el('button', {type: 'button', class: 'sc-btn', text: label, onclick: handler});
        list.appendChild(el('div', {class: 'sc-row' + (item.ref === cloudRef ? ' is-current' : '')},
          el('div', {}, el('div', {class: 'sc-name', text: item.name, title: item.name}), el('div', {class: 'sc-meta', text: [fmtTime(item.savedAt), item.shapes ? item.shapes + ' đối tượng' : ''].filter(Boolean).join(' · ') + (item.ref === cloudRef ? ' · đang mở' : '')})),
          el('div', {class: 'sc-acts'},
            act('Mở', async () => { if (await openCloud(item.ref)) closeDialog(); }),
            act('Chép liên kết', async event => { const ok = await copyText(SceneCloud.shareLink(pageBase(), item.ref)); toast(ok ? 'Đã chép liên kết.' : 'Không chép được — hãy chép từ thanh địa chỉ sau khi mở.', ok ? 'success' : 'error'); }),
            act('Đổi tên', () => { const name = window.prompt('Tên sơ đồ:', item.name); if (name && name.trim()) { SceneCloud.rename(item.ref, name); renderList(); } }),
            act('Gỡ', () => { if (window.confirm('Gỡ khỏi danh sách trên máy này? (File trên đám mây vẫn còn, ai có liên kết vẫn mở được.)')) { SceneCloud.forget(item.ref); renderList(); } }))));
      });
    }
    renderList();
    const link = el('input', {class: 'sc-input', type: 'text', placeholder: 'Dán liên kết sơ đồ (…?cloud=…)', 'aria-label': 'Liên kết sơ đồ'});
    const openLink = async () => {
      const ref = hasCloud() ? SceneCloud.refFromInput(link.value) : '';
      if (!ref) return toast('Liên kết không hợp lệ hoặc không thuộc đám mây của ứng dụng.', 'error');
      if (await openCloud(ref)) closeDialog();
    };
    link.addEventListener('keydown', event => { if (event.key === 'Enter') openLink(); });
    const dialog = el('div', {class: 'sc-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Mở sơ đồ'},
      el('div', {class: 'sc-head'}, el('h3', {text: 'Mở sơ đồ'}), el('button', {type: 'button', class: 'sc-x', 'aria-label': 'Đóng', text: '×', onclick: closeDialog})),
      el('div', {class: 'sc-body'},
        el('div', {class: 'sc-sec'}, el('h4', {text: 'Đã lưu trên đám mây'}), list),
        el('div', {class: 'sc-sec'}, el('h4', {text: 'Từ liên kết'}), el('div', {class: 'sc-line'}, link, el('button', {type: 'button', class: 'sc-btn is-primary', text: 'Mở', onclick: openLink}))),
        el('div', {class: 'sc-sec'}, el('h4', {text: 'Từ máy tính'}), el('div', {class: 'sc-line'},
          el('button', {type: 'button', class: 'sc-btn', text: 'Mở file .json…', onclick: () => { closeDialog(); if (fileInput) fileInput.click(); }}),
          el('button', {type: 'button', class: 'sc-btn', text: 'Tải sơ đồ này về máy (.json)', onclick: () => saveFile()}))),
        el('p', {class: 'sc-note', text: 'Ai có liên kết đều xem được sơ đồ (bản sao, không sửa được bản gốc). Danh sách này chỉ nằm trên máy/trình duyệt đang dùng; hãy chép liên kết để mở trên máy khác.'})));
    const overlay = el('div', {class: 'sc-overlay', id: 'sceneCloudDialog', onmousedown: event => { if (event.target === overlay) closeDialog(); }}, dialog);
    document.body.appendChild(overlay);
    document.addEventListener('keydown', dialogKey, true);
  }

  function newDiagram() {
    if (hasContent() && !window.confirm('Xoá sơ đồ đang vẽ và bắt đầu sơ đồ mới?\n(Hãy bấm "Lưu" trước nếu muốn giữ lại.)')) return;
    sceneTemplateMeta = null; apply(null); bindRef(''); writeDraft(true); toast('Đã tạo sơ đồ mới.', 'info');
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
     headButton('btnSceneOpenFile', 'Mở sơ đồ', 'Mở sơ đồ đã lưu trên đám mây, từ liên kết hoặc từ file .json', ICONS.open, () => (hasCloud() ? openDialog() : input.click())),
     headButton('btnSceneExportPng', 'Xuất ảnh', 'Tải sơ đồ thành ảnh PNG', ICONS.image, exportPng)
    ].forEach(button => actions.insertBefore(button, anchor));
    const save = document.getElementById('btnSaveSceneDrawing');
    if (save) { save.title = 'Lưu sơ đồ lên đám mây (Ctrl+S) — nhận liên kết để mở lại hoặc gửi người khác'; const label = save.querySelector('span'); if (label) label.textContent = 'Lưu'; }
    const close = document.querySelector('#sceneDrawingModalOverlay .scene-head-close');
    if (close) { close.title = 'Về ứng dụng chính (sơ đồ đã được tự lưu nháp)'; close.setAttribute('aria-label', 'Về ứng dụng chính'); }
  }

  // Liên kết ?cloud=<đường dẫn>: mở đúng sơ đồ đó. Nếu nháp trên máy chính là bản của liên kết này (vừa Lưu rồi tải lại trang) thì giữ nháp, không hỏi.
  function openFromLink(draft) {
    if (!hasCloud()) return;
    let wanted = '', bound = '';
    try { wanted = SceneCloud.refFromInput('?cloud=' + (new URLSearchParams(location.search).get('cloud') || '')); } catch (_) { /* không có liên kết */ }
    try { bound = localStorage.getItem(CLOUD_REF_KEY) || ''; } catch (_) { /* bỏ qua */ }
    const hasDraft = !!(draft && draft.shapes.length);
    if (wanted && wanted === bound && hasDraft) { cloudRef = wanted; return; }
    if (wanted) { openCloud(wanted, {ask: hasContent()}); return; }
    if (bound && hasDraft) cloudRef = bound;
  }

  function start() {
    try { if (localStorage.getItem('claimvision-theme') === 'light') document.body.classList.add('light-mode'); } catch (_) { /* giữ giao diện tối mặc định */ }
    // Ghi đè các hàm gắn với hồ sơ (gọi qua binding toàn cục nên onclick trong markup cũng dùng bản mới).
    window.saveSceneDrawing = async () => saveCloud();
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
      openFromLink(draft);
    }, 400);
    window.addEventListener('beforeunload', () => writeDraft(false));
    document.addEventListener('visibilitychange', () => { if (document.hidden) writeDraft(false); });
    document.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && String(event.key).toLowerCase() === 's') { event.preventDefault(); saveCloud(); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  return {saveFile, saveCloud, openCloud, openDialog, exportPng, openFile, newDiagram, parseFile, sanitizeShapes, writeDraft, DRAFT_KEY, FILE_FORMAT, FILE_VERSION, stop: () => clearInterval(timer)};
})();
