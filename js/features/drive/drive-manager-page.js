// ==========================================================================
// TRANG "GOOGLE DRIVE" – quản lý toàn bộ tệp trong Google Drive của chủ tài khoản.
// Giao diện dùng chung token --sf-* (css/shared-forms.css) + css/drive-manager.css.
// Dữ liệu qua DriveManagerApi (Apps Script DriveManager.gs). Xem tệp: SharedFormsViewer.
// Mount/leave giống SharedForms / RescuePage (workspace.js gọi leave() mỗi lần đổi trang).
// ==========================================================================
const DriveManager = (() => {
  const Api = DriveManagerApi;
  const LAYOUT_KEY = 'drive-manager-layout';
  const SORT_KEY = 'drive-manager-sort';
  const PAGE_SIZE_KEY = 'drive-manager-page-size';
  const PAGE_SIZES = [20, 50, 100];
  const THUMB_BATCH = 6, EMPTY_PAGE_HOPS = 5, THUMB_CACHE_LIMIT = 400, UPLOAD_WORKERS = 2;
  const VIEWS = {
    folder: {label:'Drive của tôi', icon:'drive', empty:'Thư mục này chưa có tệp nào', hint:'Kéo thả tệp vào đây hoặc bấm “Mới” để tải lên.'},
    recent: {label:'Gần đây', icon:'clock', empty:'Chưa có tệp mở gần đây', hint:'Các tệp bạn vừa xem hoặc chỉnh sửa sẽ xuất hiện ở đây.'},
    starred: {label:'Có gắn dấu sao', icon:'star', empty:'Chưa có mục nào được gắn sao', hint:'Gắn dấu sao cho tệp quan trọng để tìm lại nhanh.'},
    shared: {label:'Được chia sẻ với tôi', icon:'users', empty:'Chưa có tệp được chia sẻ', hint:'Tệp người khác chia sẻ với tài khoản Drive sẽ hiện ở đây.'},
    trash: {label:'Thùng rác', icon:'trash', empty:'Thùng rác trống', hint:'Mục trong thùng rác tự xóa vĩnh viễn sau 30 ngày.'}
  };
  const TYPE_FILTERS = [['', 'Tất cả'], ['folder', 'Thư mục'], ['document', 'Tài liệu'], ['sheet', 'Bảng tính'], ['slide', 'Trình chiếu'], ['pdf', 'PDF'], ['image', 'Hình ảnh'], ['video', 'Video'], ['archive', 'Tệp nén']];
  const SORTS = [['name_asc', 'Tên A → Z'], ['name_desc', 'Tên Z → A'], ['modified_desc', 'Sửa đổi gần nhất'], ['modified_asc', 'Sửa đổi cũ nhất'], ['size_desc', 'Dung lượng lớn nhất']];

  const ICONS = {
    drive:'<path d="M8.5 3h7l6 10.5-3.5 6H6L2.5 13.5Z"/><path d="m8.5 3 6 10.5H21M15.5 3l-9.5 16.5M2.5 13.5h12"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    star:'<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    trash:'<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
    folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    folderPlus:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M12 10v6M9 13h6"/>',
    upload:'<path d="M12 16V4m0 0-4 4m4-4 4 4"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    download:'<path d="M12 4v12m0 0-4-4m4 4 4-4"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    minus:'<path d="M6 12h12"/>',
    refresh:'<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    more:'<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
    eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    move:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M10 13h6m-2-2 2 2-2 2"/>',
    copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    link:'<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    external:'<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    restore:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    check:'<path d="m5 12 5 5 9-10"/>',
    alert:'<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
    chevron:'<path d="m9 6 6 6-6 6"/>',
    chevronDown:'<path d="m6 9 6 6 6-6"/>',
    shield:'<path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6Z"/>',
    cloud:'<path d="M18 10h-1.3A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10Z"/>',
    file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/>',
    sheet:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M8 12h8M8 16h8M12 12v6"/>',
    word:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M8 13h8M8 17h5"/>',
    slide:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4M8 21h8"/>',
    image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    video:'<rect x="2" y="5" width="15" height="14" rx="2"/><path d="m17 10 5-3v10l-5-3"/>',
    audio:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    archive:'<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>',
    pdf:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M8.5 16.5c2-1 4-4.5 3.5-6.5-.4-1.5-2-.5-1.5 1 .8 2.6 3.4 4.8 5 5"/>',
    text:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M8 13h8M8 17h8M8 9h2"/>',
    shortcut:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M9 16v-2a3 3 0 0 1 3-3h3m-2-2 2 2-2 2"/>',
    lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'
  };
  const icon = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.file}</svg>`;
  const kindIcon = kind => ({folder:'folder', pdf:'pdf', word:'word', sheet:'sheet', slide:'slide', image:'image', video:'video', audio:'audio', archive:'archive', text:'text', shortcut:'shortcut'})[kind] || 'file';
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[ch]);
  const toast = (message, type) => { if (typeof triggerToast === 'function') triggerToast(message, type); };
  const audit = (detail, meta) => { try { if (typeof logUserActivity === 'function') logUserActivity('DRIVE_MANAGE', detail, meta || {}); } catch (_) {} };
  const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Trạng thái ------------------------------------------------------------------------
  let host = null, generation = 0, listController = null, observer = null, dialog = null, menu = null;
  let view = 'folder', folderId = 'root', path = [{id:'root', name:'Drive của tôi'}], folder = null;
  let query = '', type = '', sort = readPref(SORT_KEY, 'name_asc', SORTS.map(s => s[0])), layout = readPref(LAYOUT_KEY, 'list', ['list', 'grid']);
  let files = [], nextPageToken = '', loading = false, pageLoading = false, errorText = '', about = null, aboutError = '';
  let pages = [], pageIndex = 0, pageSize = Number(readPref(PAGE_SIZE_KEY, '20', PAGE_SIZES.map(String)));
  let selected = new Set(), anchorId = null, detailsId = null, searchTimer = 0, dragDepth = 0;
  const thumbs = new Map(), thumbPending = new Set(), thumbFailed = new Set(), thumbRetried = new Set();
  const uploads = [];
  let uploadWorkers = 0, trayCollapsed = false, sessionUid = '';

  function readPref(key, fallback, allowed) { try { const value = localStorage.getItem(key); return allowed.includes(value) ? value : fallback; } catch (_) { return fallback; } }
  function writePref(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
  const byId = id => files.find(file => file.id === id);
  const selectedFiles = () => files.filter(file => selected.has(file.id));
  const isFolder = file => file && file.mimeType === Api.FOLDER_MIME;
  const canUploadHere = () => view === 'folder' && !query && (!folder || folder.can.addChildren !== false);

  // ---- Vòng đời trang --------------------------------------------------------------------
  function leave() {
    generation++;
    listController?.abort();
    listController = null;
    observer?.disconnect();
    observer = null;
    clearTimeout(searchTimer);
    closeMenu();
    closeDialog();
    if (typeof DriveViewer !== 'undefined') { DriveViewer.close(); DriveViewer.clearCache(); }
    document.removeEventListener('keydown', onGlobalKey, true);
    if (host) host.remove();
    host = null;
  }

  function mount(container) {
    leave();
    const user = typeof firebase !== 'undefined' ? firebase.auth().currentUser : null;
    if (!user) { container.textContent = 'Vui lòng đăng nhập để quản lý Google Drive.'; return; }
    // Đổi tài khoản → bỏ ảnh thu nhỏ đã lưu của phiên trước.
    if (sessionUid !== user.uid) { thumbs.forEach(url => URL.revokeObjectURL(url)); thumbs.clear(); thumbFailed.clear(); thumbRetried.clear(); sessionUid = user.uid; about = null; }
    selected = new Set(); detailsId = null; errorText = '';
    host = document.createElement('section');
    host.className = 'sf-workspace drv-workspace';
    host.setAttribute('aria-label', 'Quản lý Google Drive');
    host.innerHTML = shellMarkup();
    container.replaceChildren(host);
    bind();
    document.addEventListener('keydown', onGlobalKey, true);
    paintRail();
    paint();
    paintTray();
    loadAbout();
    load();
  }

  function shellMarkup() {
    return `
      <header class="sf-page-head drv-head">
        <div class="sf-page-title"><span class="sf-page-emblem drv-emblem" aria-hidden="true">${icon('drive')}</span><div><div class="sf-eyebrow">KHO LƯU TRỮ ĐÁM MÂY · GOOGLE DRIVE</div><h1>Quản lý Google Drive</h1><p>Duyệt, tải lên, sắp xếp và dọn dẹp toàn bộ tệp trong Google Drive ngay trên ứng dụng.</p></div></div>
        <div class="sf-toolbar">
          <button type="button" class="sf-icon-button sf-bordered" data-drv-refresh aria-label="Làm mới" title="Làm mới (R)">${icon('refresh')}</button>
          <a class="sf-button" href="https://drive.google.com/drive/my-drive" target="_blank" rel="noopener noreferrer" data-drv-open-drive>${icon('external')} Mở Google Drive</a>
          <div class="drv-new-wrap"><button type="button" class="sf-button sf-primary drv-new" data-drv-new aria-haspopup="menu" aria-expanded="false">${icon('plus')} Mới ${icon('chevronDown', 'drv-caret')}</button></div>
        </div>
      </header>
      <div class="drv-shell">
        <aside class="drv-rail" aria-label="Khu vực Google Drive">
          <nav class="drv-nav" data-drv-nav></nav>
          <div class="drv-storage" data-drv-storage></div>
          <div class="drv-account" data-drv-account></div>
        </aside>
        <section class="drv-main" aria-label="Danh sách tệp">
          <div class="drv-toolbar">
            <label class="sf-search drv-search">${icon('search')}<span class="sf-sr-only">Tìm trong Drive</span><input type="search" data-drv-search placeholder="Tìm trong toàn bộ Drive…" autocomplete="off" spellcheck="false"><kbd class="drv-kbd" aria-hidden="true">/</kbd></label>
            <label class="drv-sort"><span class="sf-sr-only">Sắp xếp</span>${icon('list', 'drv-sort-icon')}<select data-drv-sort>${SORTS.map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select>${icon('chevronDown', 'drv-sort-caret')}</label>
            <div class="sf-view-toggle drv-layout" role="group" aria-label="Kiểu hiển thị"><button type="button" class="sf-view-option" data-drv-layout="list" aria-label="Danh sách" title="Danh sách">${icon('list')}</button><button type="button" class="sf-view-option" data-drv-layout="grid" aria-label="Lưới" title="Lưới">${icon('grid')}</button></div>
          </div>
          <div class="drv-chips" role="group" aria-label="Lọc theo loại" data-drv-chips></div>
          <div class="drv-context" data-drv-context></div>
          <nav class="drv-pagination" data-drv-pagination aria-label="Phân trang đầu danh sách" hidden></nav>
          <div class="drv-selbar" data-drv-selbar role="toolbar" aria-label="Thao tác với mục đã chọn" hidden></div>
          <p class="drv-notice" data-drv-notice role="alert" hidden></p>
          <div class="drv-content" data-drv-content tabindex="-1"></div>
          <nav class="drv-pagination drv-pagination-bottom" data-drv-pagination aria-label="Phân trang cuối danh sách" hidden></nav>
          <div class="drv-dropmask" data-drv-dropmask aria-hidden="true"><div>${icon('upload')}<strong>Thả để tải lên</strong><span data-drv-drop-target></span></div></div>
        </section>
        <aside class="drv-details" data-drv-details aria-label="Chi tiết tệp" hidden></aside>
      </div>
      <input type="file" multiple hidden data-drv-file-input>
      <div class="drv-tray" data-drv-tray role="region" aria-label="Tiến trình tải lên" hidden></div>`;
  }

  // ---- Gắn sự kiện -----------------------------------------------------------------------
  function bind() {
    const q = selector => host.querySelector(selector);
    q('[data-drv-search]').value = query;
    q('[data-drv-sort]').value = sort;
    q('[data-drv-search]').addEventListener('input', event => {
      clearTimeout(searchTimer);
      const value = event.target.value;
      searchTimer = setTimeout(() => { if (value.trim() === query) return; query = value.trim(); selected.clear(); load(); }, 380);
    });
    q('[data-drv-search]').addEventListener('keydown', event => { if (event.key === 'Escape' && event.target.value) { event.stopPropagation(); event.target.value = ''; query = ''; load(); } });
    q('[data-drv-sort]').addEventListener('change', event => { sort = event.target.value; writePref(SORT_KEY, sort); load(); });
    host.addEventListener('change', event => {
      if (event.target.matches('[data-drv-page-size]')) setPageSize(event.target.value);
    });
    q('[data-drv-file-input]').addEventListener('change', event => { queueUploads([...event.target.files]); event.target.value = ''; });

    host.addEventListener('click', onClick);
    host.addEventListener('dblclick', onDoubleClick);
    host.addEventListener('contextmenu', onContextMenu);
    host.addEventListener('keydown', onKey);

    // Kéo thả tệp từ máy tính → tải vào thư mục đang mở. Kéo mục nội bộ → di chuyển vào thư mục.
    const main = q('.drv-main');
    main.addEventListener('dragenter', event => { if (!hasExternalFiles(event)) return; event.preventDefault(); dragDepth++; setDropMask(true); });
    main.addEventListener('dragover', event => {
      if (hasExternalFiles(event)) { event.preventDefault(); event.dataTransfer.dropEffect = canUploadHere() ? 'copy' : 'none'; return; }
      const target = event.target.closest('[data-drv-drop]');
      if (target && dragTypes(event).includes('application/x-drv-items')) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; host.querySelectorAll('.is-drop-target').forEach(node => node !== target && node.classList.remove('is-drop-target')); target.classList.add('is-drop-target'); }
    });
    main.addEventListener('dragleave', event => {
      if (hasExternalFiles(event)) { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) setDropMask(false); }
      const target = event.target.closest('[data-drv-drop]');
      if (target && !target.contains(event.relatedTarget)) target.classList.remove('is-drop-target');
    });
    main.addEventListener('drop', event => {
      if (hasExternalFiles(event)) {
        event.preventDefault(); dragDepth = 0; setDropMask(false);
        if (!canUploadHere()) { toast(view === 'folder' ? 'Bạn không có quyền thêm tệp vào thư mục này.' : 'Mở một thư mục trong “Drive của tôi” để tải tệp lên.', 'warning'); return; }
        queueUploads([...event.dataTransfer.files]);
        return;
      }
      const target = event.target.closest('[data-drv-drop]');
      host.querySelectorAll('.is-drop-target').forEach(node => node.classList.remove('is-drop-target'));
      if (!target) return;
      event.preventDefault();
      let ids = [];
      try { ids = JSON.parse(event.dataTransfer.getData('application/x-drv-items') || '[]'); } catch (_) {}
      ids = ids.filter(id => id !== target.dataset.drvDrop);
      if (ids.length) moveItems(ids, target.dataset.drvDrop, target.dataset.drvDropName || 'thư mục');
    });
    host.addEventListener('dragstart', event => {
      const row = event.target.closest('[data-drv-item]');
      if (!row || view === 'trash') return;
      const id = row.dataset.drvItem;
      if (!selected.has(id)) { selected = new Set([id]); anchorId = id; paintSelection(); }
      const ids = [...selected].filter(itemId => { const file = byId(itemId); return file && !file.system; });
      if (!ids.length) { event.preventDefault(); return; }
      event.dataTransfer.setData('application/x-drv-items', JSON.stringify(ids));
      event.dataTransfer.effectAllowed = 'move';
      const ghost = document.createElement('div');
      ghost.className = 'drv-drag-ghost';
      ghost.textContent = ids.length === 1 ? (byId(ids[0])?.name || '1 mục') : ids.length + ' mục';
      document.body.appendChild(ghost);
      event.dataTransfer.setDragImage(ghost, 14, 14);
      setTimeout(() => ghost.remove(), 0);
    });
  }
  const dragTypes = event => [...((event.dataTransfer && event.dataTransfer.types) || [])];
  const hasExternalFiles = event => dragTypes(event).includes('Files') && !dragTypes(event).includes('application/x-drv-items');
  function setDropMask(on) {
    const mask = host?.querySelector('[data-drv-dropmask]');
    if (!mask) return;
    mask.classList.toggle('is-active', on);
    mask.classList.toggle('is-blocked', on && !canUploadHere());
    mask.querySelector('[data-drv-drop-target]').textContent = canUploadHere() ? 'vào “' + (path.at(-1)?.name || 'Drive của tôi') + '”' : 'Chỉ tải lên được khi đang mở một thư mục';
  }

  function onClick(event) {
    const control = event.target.closest('button,a,[data-drv-item]');
    if (!control || !host.contains(control)) return;
    const data = control.dataset;
    if (control.matches('a[data-drv-open-drive]')) return;
    if (data.drvRefresh !== undefined) { loadAbout(); load(); return; }
    if (data.drvNew !== undefined) { openNewMenu(control); return; }
    if (data.drvView) { switchView(data.drvView); return; }
    if (data.drvType !== undefined) { type = data.drvType; selected.clear(); load(); return; }
    if (data.drvLayout) { layout = data.drvLayout; writePref(LAYOUT_KEY, layout); paint(); return; }
    if (data.drvCrumb) { openFolder(data.drvCrumb); return; }
    if (data.drvPage !== undefined) { goToPage(Number(data.drvPage)); return; }
    if (data.drvRetry !== undefined) { load(); return; }
    if (data.drvClearSearch !== undefined) { host.querySelector('[data-drv-search]').value = ''; query = ''; load(); return; }
    if (data.drvUpload !== undefined) { pickFiles(); return; }
    if (data.drvNewFolder !== undefined) { newFolderDialog(); return; }
    if (data.drvEmptyTrash !== undefined) { emptyTrash(); return; }
    if (data.drvSelectAll !== undefined) { toggleSelectAll(); return; }
    if (data.drvBulk) { bulkAction(data.drvBulk); return; }
    if (data.drvDetailsClose !== undefined) { detailsId = null; paintDetails(); return; }
    if (data.drvDetailsAction === 'details-folder') { if (folder) runAction('details-folder', [folder]); return; }
    if (data.drvRestore) { event.stopPropagation(); const file = byId(data.drvRestore); if (file) runAction('restore', [file]); return; }
    if (data.drvDetailsAction) { const file = byId(detailsId) || (folder && folder.id === detailsId ? folder : null); if (file) runAction(data.drvDetailsAction, [file]); return; }
    if (data.drvStar) { event.stopPropagation(); const file = byId(data.drvStar); if (file) runAction(file.starred ? 'unstar' : 'star', [file]); return; }
    if (data.drvMenu) { event.stopPropagation(); const file = byId(data.drvMenu); if (file) { if (!selected.has(file.id)) { selected = new Set([file.id]); anchorId = file.id; paintSelection(); } openItemMenu(control, null); } return; }
    if (data.drvOpen) { event.stopPropagation(); const file = byId(data.drvOpen); if (file) openItem(file); return; }
    if (data.drvCheck) { event.stopPropagation(); toggleOne(data.drvCheck); return; }
    if (data.drvItem) { selectByClick(data.drvItem, event); return; }
  }
  function onDoubleClick(event) {
    const row = event.target.closest('[data-drv-item]');
    if (!row || event.target.closest('button,a,input')) return;
    const file = byId(row.dataset.drvItem);
    if (file) openItem(file);
  }
  function onContextMenu(event) {
    const row = event.target.closest('[data-drv-item]');
    if (!row) return;
    event.preventDefault();
    const id = row.dataset.drvItem;
    if (!selected.has(id)) { selected = new Set([id]); anchorId = id; paintSelection(); }
    openItemMenu(null, {x:event.clientX, y:event.clientY});
  }
  function onKey(event) {
    if (event.target.closest('input,textarea,select,dialog')) return;
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === 'a' && files.length) { event.preventDefault(); selected = new Set(files.map(file => file.id)); paintSelection(); return; }
    if (event.key === 'Escape' && (selected.size || detailsId)) { selected.clear(); detailsId = null; paintSelection(); paintDetails(); return; }
    const chosen = selectedFiles();
    if (!chosen.length) return;
    if (event.key === 'Delete') { event.preventDefault(); runAction(view === 'trash' ? 'remove' : 'trash', chosen); }
    else if (event.key === 'F2' && chosen.length === 1) { event.preventDefault(); runAction('rename', chosen); }
    else if (event.key === 'Enter' && chosen.length === 1 && event.target.closest('[data-drv-item]')) { event.preventDefault(); openItem(chosen[0]); }
  }
  // Phím tắt toàn trang: "/" focus ô tìm kiếm (khi không gõ trong ô nhập).
  function onGlobalKey(event) {
    if (!host || !host.isConnected || dialog) return;
    if (event.key === '/' && !event.target.closest('input,textarea,select,[contenteditable="true"]')) { event.preventDefault(); host.querySelector('[data-drv-search]')?.focus(); }
  }

  // ---- Điều hướng ------------------------------------------------------------------------
  function switchView(next) {
    if (!VIEWS[next]) return;
    view = next; folderId = 'root'; path = [{id:'root', name:'Drive của tôi'}]; folder = null;
    query = ''; const input = host.querySelector('[data-drv-search]'); if (input) input.value = '';
    selected.clear(); detailsId = null;
    paintRail(); load();
  }
  function openFolder(id, name) {
    view = 'folder'; folderId = id || 'root'; query = '';
    const input = host?.querySelector('[data-drv-search]'); if (input) input.value = '';
    // Hiện ngay đường dẫn dự kiến (máy chủ trả đường dẫn chuẩn sau).
    const index = path.findIndex(item => item.id === folderId);
    path = index >= 0 ? path.slice(0, index + 1) : name ? [...path, {id:folderId, name}] : path;
    selected.clear(); detailsId = null;
    paintRail(); load();
  }
  function openItem(file) {
    if (view === 'trash') { toast('Khôi phục mục này trước khi mở.', 'warning'); return; }
    if (isFolder(file)) { openFolder(file.id, file.name); return; }
    const viewer = Api.viewerKind(file);
    if (viewer && (viewer === 'document' ? typeof SharedFormsViewer !== 'undefined' : typeof DriveViewer !== 'undefined' || typeof SharedFormsViewer !== 'undefined')) { preview(file); return; }
    if (file.webViewLink) { window.open(file.webViewLink, '_blank', 'noopener,noreferrer'); return; }
    download([file]);
  }
  function preview(file) {
    // Ảnh, video, âm thanh, bảng tính, văn bản có bộ xem riêng; PDF/Word/tệp Google dùng trình xem tài liệu (dàn trang + in).
    if (Api.viewerKind(file) !== 'document' && typeof DriveViewer !== 'undefined') {
      const shown = Api.sortFiles(files, view === 'recent' && !query ? '' : sort);
      DriveViewer.open(file, {
        files:shown.filter(item => !isFolder(item) && Api.viewerKind(item) && Api.viewerKind(item) !== 'document'),
        kindOf:Api.viewerKind,
        load:async (item, signal) => { const result = await Api.download(item.id, 'preview', signal); return {bytes:result.bytes, mimeType:result.mimeType}; },
        thumb:item => thumbs.get(item.id),
        format:{size:item => Api.formatBytes(item.size), date:item => item.modifiedTime ? 'Sửa ' + Api.formatDateTime(item.modifiedTime) : ''},
        onDownload:item => download([item]),
        openDocument:item => { DriveViewer.close(); previewDocument(item); },
        toast
      });
      return;
    }
    previewDocument(file);
  }
  function previewDocument(file) {
    const native = Api.isNative(file);
    const viewerFile = {...file, source:'drive', originalName:native ? file.name.replace(/\.pdf$/i, '') + '.pdf' : file.name, mimeType:file.mimeType};
    SharedFormsViewer.open(viewerFile, null, {loadBytes:async signal => (await Api.download(file.id, 'preview', signal)).bytes.buffer});
  }

  // ---- Tải dữ liệu -----------------------------------------------------------------------
  // Dung lượng dùng bộ đếm riêng (không dùng generation của danh sách, vì load() chạy song song sẽ tăng generation).
  let aboutToken = 0;
  async function loadAbout() {
    const own = ++aboutToken;
    try { const result = await Api.about(); if (own === aboutToken) { about = result; aboutError = ''; } }
    catch (error) { if (own === aboutToken) aboutError = error.message; }
    if (own === aboutToken && host) paintRail();
  }
  function listOptions(pageToken) {
    return {view, folderId, query, type, sort, pageSize, pageToken:pageToken || undefined};
  }
  async function readPage(pageToken, signal) {
    let result = await Api.list(listOptions(pageToken), signal);
    const metadata = {path:result.path, folder:result.folder};
    // Drive có thể trả trang rỗng kèm token: tiếp tục tìm dữ liệu như trước đây.
    for (let hop = 0; !result.files?.length && result.nextPageToken && hop < EMPTY_PAGE_HOPS; hop++) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      result = await Api.list(listOptions(result.nextPageToken), signal);
    }
    return {...result, ...metadata, files:result.files || [], nextPageToken:result.nextPageToken || ''};
  }
  function setPageSize(value) {
    const size = Number(value);
    if (!PAGE_SIZES.includes(size) || size === pageSize) return;
    pageSize = size;
    writePref(PAGE_SIZE_KEY, String(size));
    return load();
  }
  async function load() {
    if (!host) return;
    listController?.abort();
    const controller = listController = new AbortController();
    const own = ++generation;
    loading = true; pageLoading = false; errorText = ''; nextPageToken = ''; files = [];
    pages = []; pageIndex = 0; selected.clear(); anchorId = null; detailsId = null;
    paint();
    try {
      const result = await readPage('', controller.signal);
      if (own !== generation || !host) return;
      files = result.files || [];
      nextPageToken = result.nextPageToken || '';
      pages = [{files, nextPageToken}];
      if (view === 'folder' && !query) {
        if (Array.isArray(result.path) && result.path.length) path = result.path;
        folder = result.folder || null;
      }
      selected = new Set([...selected].filter(id => files.some(file => file.id === id)));
    } catch (error) {
      if (own !== generation || error.name === 'AbortError') return;
      errorText = error.message || 'Chưa tải được danh sách tệp.';
    } finally {
      if (own === generation) { loading = false; if (host) paint(); }
    }
  }
  async function goToPage(index) {
    if (!host || loading || pageLoading || !Number.isInteger(index) || index < 0 || index === pageIndex) return;
    if (index > pages.length || (index === pages.length && !pages.at(-1)?.nextPageToken)) return;
    closeMenu();
    if (pages[index]) { showPage(index); return; }
    listController?.abort();
    const controller = listController = new AbortController();
    const own = ++generation;
    pageLoading = true; paintPagination();
    try {
      const result = await readPage(pages.at(-1).nextPageToken, controller.signal);
      if (own !== generation || !host) return;
      pages.push({files:result.files, nextPageToken:result.nextPageToken});
      showPage(index);
    } catch (error) { if (own === generation && error.name !== 'AbortError') toast(error.message, 'error'); }
    finally { if (own === generation) { pageLoading = false; if (host) paintPagination(); } }
  }
  function showPage(index) {
    pageIndex = index;
    ({files, nextPageToken} = pages[index]);
    selected.clear(); anchorId = null; detailsId = null;
    paint();
    host.querySelector('.drv-main')?.scrollIntoView({block:'start', behavior:'auto'});
  }
  function pageRange() {
    const before = pages.slice(0, pageIndex).reduce((total, page) => total + page.files.length, 0);
    return files.length ? `${before + 1}–${before + files.length} mục` : '0 mục';
  }

  // ---- Vẽ giao diện ----------------------------------------------------------------------
  function paintRail() {
    if (!host) return;
    host.querySelector('[data-drv-nav]').innerHTML = Object.entries(VIEWS).map(([key, item]) => `<button type="button" class="drv-nav-item${view === key ? ' is-active' : ''}" data-drv-view="${key}" ${view === key ? 'aria-current="page"' : ''}${key === 'folder' ? ' data-drv-drop="root" data-drv-drop-name="Drive của tôi"' : ''}>${icon(item.icon)}<span>${item.label}</span></button>`).join('');
    const storage = host.querySelector('[data-drv-storage]');
    if (about && about.quota) {
      const summary = Api.quotaSummary(about.quota);
      storage.innerHTML = `
        <div class="drv-storage-head">${icon('cloud')}<strong>Bộ nhớ</strong>${summary.unlimited ? '' : `<span class="drv-storage-pct is-${summary.level}">${String(summary.percent).replace('.', ',')}%</span>`}</div>
        <div class="drv-meter is-${summary.level}" role="meter" aria-label="Dung lượng đã dùng" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${summary.percent}"><span style="width:${summary.unlimited ? 8 : Math.max(summary.percent, 1.5)}%"></span></div>
        <p class="drv-storage-copy"><strong>${Api.formatBytes(summary.usage)}</strong> ${summary.unlimited ? 'đã dùng · không giới hạn' : 'trong tổng số ' + Api.formatBytes(summary.limit)}</p>
        <dl class="drv-storage-break"><div><dt><i class="drv-dot is-drive"></i>Drive</dt><dd>${Api.formatBytes(about.quota.drive)}</dd></div><div><dt><i class="drv-dot is-trash"></i>Thùng rác</dt><dd>${Api.formatBytes(about.quota.trash)}</dd></div><div><dt><i class="drv-dot is-other"></i>Gmail &amp; Ảnh</dt><dd>${Api.formatBytes(Math.max(0, about.quota.usage - about.quota.drive - about.quota.trash))}</dd></div></dl>`;
    } else {
      storage.innerHTML = aboutError
        ? `<div class="drv-storage-head">${icon('cloud')}<strong>Bộ nhớ</strong></div><p class="drv-storage-copy is-muted">Chưa đọc được dung lượng.</p>`
        : `<div class="drv-storage-head">${icon('cloud')}<strong>Bộ nhớ</strong></div><div class="drv-meter is-loading"><span></span></div><p class="drv-storage-copy is-muted">Đang đọc dung lượng…</p>`;
    }
    const account = host.querySelector('[data-drv-account]');
    const name = about?.user?.name || '', email = about?.user?.email || '';
    account.innerHTML = email ? `<span class="drv-avatar" aria-hidden="true">${esc((name || email).trim().charAt(0).toUpperCase())}</span><div><strong>${esc(name || 'Tài khoản Drive')}</strong><span title="${esc(email)}">${esc(email)}</span></div>` : `<span class="drv-avatar is-ghost" aria-hidden="true">${icon('lock')}</span><div><strong>Tài khoản Drive</strong><span>Kết nối qua dịch vụ bảo mật</span></div>`;
  }

  function paint() {
    if (!host) return;
    host.querySelector('[data-drv-chips]').innerHTML = TYPE_FILTERS.map(([key, label]) => `<button type="button" class="drv-chip" data-drv-type="${key}" aria-pressed="${type === key}">${key ? icon(kindIcon(key === 'document' ? 'word' : key)) : ''}${label}</button>`).join('');
    host.querySelectorAll('[data-drv-layout]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.drvLayout === layout)));
    host.querySelector('[data-drv-sort]').value = sort;
    const newButton = host.querySelector('[data-drv-new]');
    newButton.disabled = !canUploadHere();
    newButton.title = canUploadHere() ? 'Tạo thư mục hoặc tải tệp lên thư mục đang mở' : 'Mở một thư mục trong “Drive của tôi” để thêm mới';
    paintContext();
    const notice = host.querySelector('[data-drv-notice]');
    notice.hidden = true;
    paintContent();
    paintSelection();
    paintPagination();
    paintDetails();
  }

  function paintContext() {
    const node = host.querySelector('[data-drv-context]');
    const count = loading ? '' : `<span class="drv-count" role="status" aria-live="polite">${pageRange()} · Trang ${pageIndex + 1}</span>`;
    if (query) {
      node.innerHTML = `<div class="drv-context-title">${icon('search')}<span>Kết quả cho “<strong>${esc(query)}</strong>”${type ? ' · ' + esc(TYPE_FILTERS.find(item => item[0] === type)?.[1] || '') : ''}</span></div>${count}<button type="button" class="drv-link-button" data-drv-clear-search>Xóa tìm kiếm</button>`;
      return;
    }
    if (view !== 'folder') {
      node.innerHTML = `<div class="drv-context-title">${icon(VIEWS[view].icon)}<span>${VIEWS[view].label}</span></div>${count}${view === 'trash' && files.length ? `<button type="button" class="sf-button drv-danger-button" data-drv-empty-trash>${icon('trash')} Dọn sạch thùng rác</button>` : ''}`;
      return;
    }
    const sep = icon('chevron', 'drv-crumb-sep');
    const crumbs = path.map((item, index) => {
      const last = index === path.length - 1;
      return last
        ? `<strong class="drv-crumb is-current" aria-current="page">${index === 0 ? icon('drive') : ''}${esc(item.name)}</strong>`
        : `<button type="button" class="drv-crumb" data-drv-crumb="${esc(item.id)}" data-drv-drop="${esc(item.id)}" data-drv-drop-name="${esc(item.name)}">${index === 0 ? icon('drive') : ''}${esc(item.name)}</button>`;
    });
    // Đường dẫn dài: rút gọn phần giữa.
    const compact = crumbs.length > 4 ? [crumbs[0], '<span class="drv-crumb-ellipsis" title="' + esc(path.slice(1, -2).map(item => item.name).join(' › ')) + '">…</span>', ...crumbs.slice(-2)] : crumbs;
    node.innerHTML = `<nav class="drv-crumbs" aria-label="Đường dẫn thư mục">${compact.join(sep)}</nav>${folder?.system ? `<span class="drv-badge is-system" title="Thư mục hệ thống của ứng dụng">${icon('shield')} Hệ thống</span>` : ''}${count}${folder ? `<button type="button" class="sf-icon-button drv-ghost-icon" data-drv-details-action="details-folder" aria-label="Chi tiết thư mục" title="Chi tiết thư mục">${icon('info')}</button>` : ''}`;
  }

  function rowBadges(file) {
    return [
      file.starred ? `<span class="drv-mini is-star" title="Có gắn dấu sao">${icon('star')}</span>` : '',
      file.shared ? `<span class="drv-mini" title="Đã chia sẻ">${icon('users')}</span>` : '',
      file.system ? `<span class="drv-mini is-system" title="Thư mục hệ thống của ứng dụng">${icon('shield')}</span>` : ''
    ].join('');
  }
  function fileGlyph(file, size) {
    const kind = Api.kindOf(file);
    const thumb = thumbs.get(file.id);
    if (thumb && size !== 'folder') return `<span class="drv-glyph has-thumb drv-kind-${kind}"><img src="${thumb}" alt="" loading="lazy" decoding="async"></span>`;
    return `<span class="drv-glyph drv-kind-${kind}"${file.hasThumbnail && !thumbFailed.has(file.id) && kind !== 'folder' ? ` data-drv-thumb="${esc(file.id)}"` : ''}>${icon(kindIcon(kind))}</span>`;
  }

  function paintContent() {
    const content = host.querySelector('[data-drv-content]');
    content.classList.toggle('is-grid', layout === 'grid');
    observer?.disconnect();
    if (loading) { content.innerHTML = skeleton(); return; }
    if (errorText) { content.innerHTML = errorState(); return; }
    if (!files.length && nextPageToken) { content.innerHTML = '<div class="drv-empty"><strong>Trang này chưa có mục nào hiển thị</strong><p>Bấm “Trang tiếp” để xem tiếp.</p></div>'; return; }
    if (!files.length) { content.innerHTML = emptyState(); return; }
    const list = Api.sortFiles(files, view === 'recent' && !query ? '' : sort);
    content.innerHTML = layout === 'grid' ? gridMarkup(list) : listMarkup(list);
    observeThumbs(content);
  }

  function listMarkup(list) {
    const all = files.length && selected.size === files.length;
    const some = selected.size && !all;
    return `<div class="drv-table" role="grid" aria-multiselectable="true" aria-rowcount="${list.length + 1}">
      <div class="drv-tr drv-thead" role="row">
        <span class="drv-cell drv-col-check" role="columnheader"><button type="button" class="drv-check${all ? ' is-on' : some ? ' is-mixed' : ''}" data-drv-select-all aria-label="${all ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}">${icon(some ? 'minus' : 'check')}</button></span>
        <span class="drv-cell drv-col-name" role="columnheader">Tên</span>
        <span class="drv-cell drv-col-owner" role="columnheader">Chủ sở hữu</span>
        <span class="drv-cell drv-col-date" role="columnheader">${view === 'trash' ? 'Ngày xóa' : 'Sửa đổi lần cuối'}</span>
        <span class="drv-cell drv-col-size" role="columnheader">Kích thước</span>
        <span class="drv-cell drv-col-actions" role="columnheader"><span class="sf-sr-only">Thao tác</span></span>
      </div>
      ${list.map(file => {
        const on = selected.has(file.id), folderItem = isFolder(file);
        return `<div class="drv-tr drv-row${on ? ' is-selected' : ''}${file.trashed ? ' is-trashed' : ''}" role="row" aria-selected="${on}" tabindex="0" data-drv-item="${esc(file.id)}" draggable="${view !== 'trash' && !file.system}"${folderItem && view !== 'trash' ? ` data-drv-drop="${esc(file.id)}" data-drv-drop-name="${esc(file.name)}"` : ''}>
          <span class="drv-cell drv-col-check" role="gridcell"><button type="button" class="drv-check${on ? ' is-on' : ''}" data-drv-check="${esc(file.id)}" aria-label="${on ? 'Bỏ chọn' : 'Chọn'} ${esc(file.name)}" tabindex="-1">${icon('check')}</button></span>
          <span class="drv-cell drv-col-name" role="gridcell">${fileGlyph(file)}<span class="drv-name"><button type="button" class="drv-name-button" data-drv-open="${esc(file.id)}" title="${esc(file.name)}" tabindex="-1">${esc(file.name)}</button><small>${esc(Api.typeLabel(file))}</small></span><span class="drv-badges">${rowBadges(file)}</span></span>
          <span class="drv-cell drv-col-owner" role="gridcell">${file.ownedByMe ? '<span class="drv-owner is-me">Tôi</span>' : `<span class="drv-owner">${esc(file.owner || '—')}</span>`}</span>
          <span class="drv-cell drv-col-date" role="gridcell" title="${esc(Api.formatDateTime(file.modifiedTime))}">${esc(Api.formatDate(file.modifiedTime))}${file.lastModifiedBy && view !== 'trash' ? `<small>${esc(file.lastModifiedBy)}</small>` : ''}</span>
          <span class="drv-cell drv-col-size" role="gridcell">${folderItem ? '—' : esc(Api.formatBytes(file.size))}</span>
          <span class="drv-cell drv-col-actions" role="gridcell">${view === 'trash' ? `<button type="button" class="sf-icon-button drv-row-action" data-drv-restore="${esc(file.id)}" aria-label="Khôi phục ${esc(file.name)}" title="Khôi phục" tabindex="-1">${icon('restore')}</button>` : `<button type="button" class="sf-icon-button drv-row-action drv-star-toggle${file.starred ? ' is-on' : ''}" data-drv-star="${esc(file.id)}" aria-label="${file.starred ? 'Bỏ gắn sao' : 'Gắn dấu sao'}" title="${file.starred ? 'Bỏ gắn sao' : 'Gắn dấu sao'}" tabindex="-1">${icon('star')}</button>`}<button type="button" class="sf-icon-button drv-row-action" data-drv-menu="${esc(file.id)}" aria-label="Thao tác khác cho ${esc(file.name)}" aria-haspopup="menu" title="Thao tác khác" tabindex="-1">${icon('more')}</button></span>
        </div>`;
      }).join('')}
    </div>`;
  }

  function gridMarkup(list) {
    const folders = list.filter(isFolder), others = list.filter(file => !isFolder(file));
    const folderTiles = folders.map(file => {
      const on = selected.has(file.id);
      return `<div class="drv-folder-tile${on ? ' is-selected' : ''}" role="option" aria-selected="${on}" tabindex="0" data-drv-item="${esc(file.id)}" draggable="${view !== 'trash' && !file.system}"${view !== 'trash' ? ` data-drv-drop="${esc(file.id)}" data-drv-drop-name="${esc(file.name)}"` : ''}>
        ${fileGlyph(file, 'folder')}<button type="button" class="drv-name-button" data-drv-open="${esc(file.id)}" title="${esc(file.name)}" tabindex="-1">${esc(file.name)}</button><span class="drv-badges">${rowBadges(file)}</span>
        <button type="button" class="sf-icon-button drv-row-action" data-drv-menu="${esc(file.id)}" aria-label="Thao tác cho ${esc(file.name)}" aria-haspopup="menu" tabindex="-1">${icon('more')}</button>
      </div>`;
    }).join('');
    const fileTiles = others.map(file => {
      const on = selected.has(file.id), kind = Api.kindOf(file), thumb = thumbs.get(file.id);
      return `<article class="drv-tile drv-kind-${kind}${on ? ' is-selected' : ''}" role="option" aria-selected="${on}" tabindex="0" data-drv-item="${esc(file.id)}" draggable="${view !== 'trash'}">
        <div class="drv-tile-media"${!thumb && file.hasThumbnail && !thumbFailed.has(file.id) ? ` data-drv-thumb="${esc(file.id)}"` : ''}>${thumb ? `<img src="${thumb}" alt="" loading="lazy" decoding="async">` : `<span class="drv-tile-icon">${icon(kindIcon(kind))}</span>`}
          <button type="button" class="drv-check drv-tile-check${on ? ' is-on' : ''}" data-drv-check="${esc(file.id)}" aria-label="${on ? 'Bỏ chọn' : 'Chọn'} ${esc(file.name)}" tabindex="-1">${icon('check')}</button>
          ${file.starred ? `<span class="drv-tile-star">${icon('star')}</span>` : ''}
        </div>
        <div class="drv-tile-foot"><span class="drv-glyph drv-kind-${kind} is-small">${icon(kindIcon(kind))}</span><div class="drv-tile-copy"><button type="button" class="drv-name-button" data-drv-open="${esc(file.id)}" title="${esc(file.name)}" tabindex="-1">${esc(file.name)}</button><small>${esc(Api.formatDate(file.modifiedTime))} · ${esc(Api.formatBytes(file.size))}</small></div>
          <button type="button" class="sf-icon-button drv-row-action" data-drv-menu="${esc(file.id)}" aria-label="Thao tác cho ${esc(file.name)}" aria-haspopup="menu" tabindex="-1">${icon('more')}</button></div>
      </article>`;
    }).join('');
    return `${folders.length ? `<h3 class="drv-section-label">Thư mục <span>${folders.length}</span></h3><div class="drv-folder-grid" role="listbox" aria-label="Thư mục" aria-multiselectable="true">${folderTiles}</div>` : ''}${others.length ? `<h3 class="drv-section-label">Tệp <span>${others.length}</span></h3><div class="drv-tile-grid" role="listbox" aria-label="Tệp" aria-multiselectable="true">${fileTiles}</div>` : ''}`;
  }

  function skeleton() {
    if (layout === 'grid') return `<div class="drv-tile-grid is-skeleton" aria-busy="true" aria-label="Đang tải">${'<div class="drv-tile"><div class="drv-tile-media drv-shimmer"></div><div class="drv-tile-foot"><span class="drv-shimmer drv-sk-line"></span></div></div>'.repeat(8)}</div>`;
    return `<div class="drv-table is-skeleton" aria-busy="true" aria-label="Đang tải">${Array.from({length:8}, (_, i) => `<div class="drv-tr drv-row"><span class="drv-cell drv-col-check"></span><span class="drv-cell drv-col-name"><span class="drv-glyph drv-shimmer"></span><span class="drv-shimmer drv-sk-line" style="width:${38 + (i * 13) % 34}%"></span></span><span class="drv-cell drv-col-owner"><span class="drv-shimmer drv-sk-line" style="width:40%"></span></span><span class="drv-cell drv-col-date"><span class="drv-shimmer drv-sk-line" style="width:55%"></span></span><span class="drv-cell drv-col-size"><span class="drv-shimmer drv-sk-line" style="width:45%"></span></span><span class="drv-cell drv-col-actions"></span></div>`).join('')}</div>`;
  }
  function emptyState() {
    const info = query ? {label:'Không tìm thấy kết quả phù hợp', hint:'Thử từ khóa khác hoặc bỏ bộ lọc loại tệp.', icon:'search'} : type ? {label:'Không có mục thuộc loại này', hint:'Chọn “Tất cả” để xem toàn bộ.', icon:'grid'} : {label:VIEWS[view].empty, hint:VIEWS[view].hint, icon:VIEWS[view].icon};
    return `<div class="drv-empty"><span class="drv-empty-art" aria-hidden="true">${icon(info.icon)}</span><strong>${esc(info.label)}</strong><p>${esc(info.hint)}</p>${!query && !type && canUploadHere() ? `<div class="drv-empty-actions"><button type="button" class="sf-button sf-primary" data-drv-upload>${icon('upload')} Tải tệp lên</button><button type="button" class="sf-button" data-drv-new-folder>${icon('folderPlus')} Thư mục mới</button></div>` : ''}${query || type ? `<button type="button" class="sf-button" data-drv-clear-search>Xóa bộ lọc</button>` : ''}</div>`;
  }
  function errorState() {
    const setup = /DRIVE_MANAGER_UIDS|Apps Script|Drive API|CLAIM_DOCUMENTS_ENDPOINT/.test(errorText);
    return `<div class="drv-empty is-error"><span class="drv-empty-art" aria-hidden="true">${icon(setup ? 'shield' : 'alert')}</span><strong>${setup ? 'Cần hoàn tất cấu hình dịch vụ Google Drive' : 'Chưa tải được dữ liệu Google Drive'}</strong><p>${esc(errorText)}</p><button type="button" class="sf-button" data-drv-retry>${icon('refresh')} Thử lại</button></div>`;
  }
  function paintPagination() {
    if (!host) return;
    const maxPage = Math.max(0, pages.length - 1) + (pages.at(-1)?.nextPageToken ? 1 : 0);
    const busy = loading || pageLoading;
    const pageButton = index => `<button type="button" class="drv-page-button${index === pageIndex ? ' is-current' : ''}" data-drv-page="${index}" aria-label="Trang ${index + 1}"${index === pageIndex ? ' aria-current="page"' : ''}${busy ? ' disabled' : ''}>${index + 1}</button>`;
    const start = Math.max(0, pageIndex - 2), end = Math.min(maxPage, pageIndex + 2);
    let numbers = start > 0 ? pageButton(0) + (start > 1 ? '<span class="drv-page-ellipsis" aria-hidden="true">…</span>' : '') : '';
    for (let index = start; index <= end; index++) numbers += pageButton(index);
    host.querySelectorAll('[data-drv-pagination]').forEach(node => {
      node.hidden = loading || !!errorText || (!files.length && !nextPageToken && !pageIndex);
      node.innerHTML = `<span class="drv-page-result">${pageRange()} · Trang ${pageIndex + 1}${pageLoading ? ' · Đang tải…' : ''}</span>
        <label class="drv-page-size"><span>Số mục / trang</span><select data-drv-page-size aria-label="Số mục mỗi trang"${busy ? ' disabled' : ''}>${PAGE_SIZES.map(size => `<option value="${size}"${size === pageSize ? ' selected' : ''}>${size}</option>`).join('')}</select></label>
        <div class="drv-page-buttons"><button type="button" class="drv-page-button is-prev" data-drv-page="${pageIndex - 1}" aria-label="Trang trước"${busy || !pageIndex ? ' disabled' : ''}>${icon('chevron')}</button>${numbers}<button type="button" class="drv-page-button" data-drv-page="${pageIndex + 1}" aria-label="Trang tiếp"${busy || pageIndex >= maxPage ? ' disabled' : ''}>${icon('chevron')}</button></div>`;
    });
  }

  // ---- Chọn mục --------------------------------------------------------------------------
  function selectByClick(id, event) {
    const ordered = [...host.querySelectorAll('[data-drv-item]')].map(node => node.dataset.drvItem);
    if (event.shiftKey && anchorId && ordered.includes(anchorId)) {
      const [a, b] = [ordered.indexOf(anchorId), ordered.indexOf(id)].sort((x, y) => x - y);
      if (!(event.ctrlKey || event.metaKey)) selected.clear();
      ordered.slice(a, b + 1).forEach(itemId => selected.add(itemId));
    } else if (event.ctrlKey || event.metaKey) {
      selected.has(id) ? selected.delete(id) : selected.add(id); anchorId = id;
    } else {
      selected = new Set([id]); anchorId = id;
    }
    if (detailsId) detailsId = selected.size === 1 ? [...selected][0] : detailsId;
    paintSelection(); paintDetails();
  }
  function toggleOne(id) { selected.has(id) ? selected.delete(id) : selected.add(id); anchorId = id; paintSelection(); }
  function toggleSelectAll() { selected = selected.size === files.length ? new Set() : new Set(files.map(file => file.id)); paintSelection(); }
  function paintSelection() {
    if (!host) return;
    host.querySelectorAll('[data-drv-item]').forEach(node => {
      const on = selected.has(node.dataset.drvItem);
      node.classList.toggle('is-selected', on);
      node.setAttribute('aria-selected', String(on));
      const check = node.querySelector('[data-drv-check]');
      if (check) check.classList.toggle('is-on', on);
    });
    const all = host.querySelector('[data-drv-select-all]');
    if (all) {
      const full = files.length && selected.size === files.length, some = selected.size && !full;
      all.className = 'drv-check' + (full ? ' is-on' : some ? ' is-mixed' : '');
      all.innerHTML = icon(some ? 'minus' : 'check');
      all.setAttribute('aria-label', full ? 'Bỏ chọn tất cả' : 'Chọn tất cả');
    }
    const bar = host.querySelector('[data-drv-selbar]');
    const chosen = selectedFiles();
    bar.hidden = !chosen.length;
    if (!chosen.length) { bar.innerHTML = ''; return; }
    const anyFile = chosen.some(file => !isFolder(file)), anySystem = chosen.some(file => file.system);
    const allStarred = chosen.every(file => file.starred);
    const actions = view === 'trash'
      ? [['restore', 'restore', 'Khôi phục'], ['remove', 'trash', 'Xóa vĩnh viễn', 'is-danger']]
      : [
        anyFile ? ['download', 'download', 'Tải về'] : null,
        anySystem ? null : ['move', 'move', 'Di chuyển'],
        [allStarred ? 'unstar' : 'star', 'star', allStarred ? 'Bỏ gắn sao' : 'Gắn sao'],
        chosen.length === 1 ? ['details', 'info', 'Chi tiết'] : null,
        anySystem ? null : ['trash', 'trash', 'Xóa', 'is-danger']
      ].filter(Boolean);
    bar.innerHTML = `<button type="button" class="sf-icon-button drv-selbar-close" data-drv-bulk="clear" aria-label="Bỏ chọn" title="Bỏ chọn (Esc)">${icon('close')}</button><strong>${chosen.length} mục đã chọn</strong><span class="drv-selbar-sep" aria-hidden="true"></span>${actions.map(([key, ico, label, cls]) => `<button type="button" class="drv-selbar-btn ${cls || ''}" data-drv-bulk="${key}">${icon(ico)}<span>${label}</span></button>`).join('')}`;
  }
  function bulkAction(key) {
    if (key === 'clear') { selected.clear(); paintSelection(); return; }
    runAction(key, selectedFiles());
  }

  // ---- Bảng chi tiết ---------------------------------------------------------------------
  function paintDetails() {
    const panel = host?.querySelector('[data-drv-details]');
    if (!panel) return;
    const file = detailsId ? (byId(detailsId) || (folder && folder.id === detailsId ? folder : null)) : null;
    host.querySelector('.drv-shell').classList.toggle('has-details', !!file);
    panel.hidden = !file;
    if (!file) { panel.innerHTML = ''; return; }
    const kind = Api.kindOf(file), thumb = thumbs.get(file.id);
    const rows = [
      ['Loại', Api.typeLabel(file)],
      !isFolder(file) ? ['Kích thước', Api.formatBytes(file.size)] : null,
      ['Chủ sở hữu', file.ownedByMe ? 'Tôi' : file.owner || '—'],
      ['Sửa đổi', Api.formatDateTime(file.modifiedTime) + (file.lastModifiedBy ? ' · ' + file.lastModifiedBy : '')],
      ['Ngày tạo', Api.formatDateTime(file.createdTime)],
      file.viewedTime ? ['Bạn mở lần cuối', Api.formatDateTime(file.viewedTime)] : null,
      ['Chia sẻ', file.shared ? 'Đang chia sẻ với người khác' : 'Riêng tư'],
      view === 'folder' && !query ? ['Vị trí', path.map(item => item.name).join(' › ')] : null
    ].filter(Boolean);
    panel.innerHTML = `
      <header class="drv-details-head"><span class="sf-eyebrow">CHI TIẾT</span><button type="button" class="sf-icon-button" data-drv-details-close aria-label="Đóng chi tiết" title="Đóng">${icon('close')}</button></header>
      <div class="drv-details-media drv-kind-${kind}"${!thumb && file.hasThumbnail && !thumbFailed.has(file.id) ? ` data-drv-thumb="${esc(file.id)}"` : ''}>${thumb ? `<img src="${thumb}" alt="">` : `<span class="drv-tile-icon">${icon(kindIcon(kind))}</span>`}</div>
      <h3 class="drv-details-name">${esc(file.name)}</h3>
      <div class="drv-details-tags">${file.starred ? `<span class="drv-badge is-star">${icon('star')} Có gắn sao</span>` : ''}${file.system ? `<span class="drv-badge is-system">${icon('shield')} Thư mục hệ thống</span>` : ''}${file.shared ? `<span class="drv-badge">${icon('users')} Đã chia sẻ</span>` : `<span class="drv-badge">${icon('lock')} Riêng tư</span>`}</div>
      <dl class="drv-details-list">${rows.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
      ${file.description ? `<div class="drv-details-desc"><span>Mô tả</span><p>${esc(file.description)}</p></div>` : ''}
      <div class="drv-details-actions">${file.webViewLink ? `<a class="sf-button" href="${esc(file.webViewLink)}" target="_blank" rel="noopener noreferrer">${icon('external')} Mở trên Drive</a>` : ''}${!isFolder(file) && view !== 'trash' ? `<button type="button" class="sf-button sf-primary" data-drv-details-action="download">${icon('download')} Tải về</button>` : ''}</div>`;
    observeThumbs(panel);
  }

  // ---- Menu ngữ cảnh / menu "Mới" -------------------------------------------------------
  function closeMenu() {
    if (!menu) return;
    const { node, trigger } = menu;
    menu = null;
    node.remove();
    trigger?.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onMenuOutside, true);
    window.removeEventListener('resize', closeMenu);
    window.removeEventListener('scroll', closeMenu, true);
  }
  function onMenuOutside(event) { if (menu && !menu.node.contains(event.target) && event.target !== menu.trigger && !menu.trigger?.contains(event.target)) closeMenu(); }
  function showMenu(items, anchor, point) {
    closeMenu();
    const node = document.createElement('div');
    node.className = 'drv-menu';
    node.setAttribute('role', 'menu');
    node.innerHTML = items.map(item => item === '-' ? '<div class="drv-menu-sep" role="separator"></div>' : `<button type="button" role="menuitem" class="drv-menu-item${item.danger ? ' is-danger' : ''}" data-key="${item.key}" ${item.disabled ? 'disabled' : ''}>${icon(item.icon)}<span>${esc(item.label)}</span>${item.hint ? `<kbd>${esc(item.hint)}</kbd>` : ''}</button>`).join('');
    document.body.appendChild(node);
    const rect = anchor ? anchor.getBoundingClientRect() : {left:point.x, right:point.x, top:point.y, bottom:point.y};
    const width = node.offsetWidth, height = node.offsetHeight;
    let left = anchor ? rect.right - width : rect.left, top = rect.bottom + 6;
    if (left + width > innerWidth - 8) left = innerWidth - width - 8;
    if (left < 8) left = 8;
    if (top + height > innerHeight - 8) top = Math.max(8, rect.top - height - 6);
    node.style.left = left + 'px'; node.style.top = top + 'px';
    menu = {node, trigger:anchor, items};
    anchor?.setAttribute('aria-expanded', 'true');
    node.addEventListener('click', event => {
      const button = event.target.closest('[data-key]');
      if (!button || button.disabled) return;
      const item = items.find(entry => entry !== '-' && entry.key === button.dataset.key);
      closeMenu();
      item?.run();
    });
    node.addEventListener('keydown', event => {
      const buttons = [...node.querySelectorAll('button:not([disabled])')];
      const index = buttons.indexOf(document.activeElement);
      if (event.key === 'ArrowDown') { event.preventDefault(); buttons[(index + 1) % buttons.length]?.focus(); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); buttons[(index - 1 + buttons.length) % buttons.length]?.focus(); }
      else if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); const trigger = menu?.trigger; closeMenu(); trigger?.focus(); }
    });
    setTimeout(() => {
      document.addEventListener('pointerdown', onMenuOutside, true);
      window.addEventListener('resize', closeMenu);
      window.addEventListener('scroll', closeMenu, true);
    }, 0);
    node.querySelector('button:not([disabled])')?.focus({preventScroll:true});
  }
  function openNewMenu(anchor) {
    if (menu && menu.trigger === anchor) { closeMenu(); return; }
    showMenu([
      {key:'folder', icon:'folderPlus', label:'Thư mục mới', run:newFolderDialog},
      '-',
      {key:'upload', icon:'upload', label:'Tải tệp lên', hint:'≤ 10 MB', run:pickFiles}
    ], anchor);
  }
  function openItemMenu(anchor, point) {
    const chosen = selectedFiles();
    if (!chosen.length) return;
    const single = chosen.length === 1 ? chosen[0] : null;
    const anySystem = chosen.some(file => file.system), anyFile = chosen.some(file => !isFolder(file));
    const allStarred = chosen.every(file => file.starred);
    const items = view === 'trash' ? [
      {key:'restore', icon:'restore', label:'Khôi phục', run:() => runAction('restore', chosen)},
      '-',
      {key:'remove', icon:'trash', label:'Xóa vĩnh viễn', danger:true, hint:'Del', run:() => runAction('remove', chosen)}
    ] : [
      single ? {key:'open', icon:isFolder(single) ? 'folder' : 'eye', label:isFolder(single) ? 'Mở thư mục' : Api.canPreview(single) ? 'Xem trước' : 'Mở', hint:'Enter', run:() => openItem(single)} : null,
      single && single.webViewLink ? {key:'drive', icon:'external', label:'Mở trên Google Drive', run:() => window.open(single.webViewLink, '_blank', 'noopener,noreferrer')} : null,
      anyFile ? {key:'download', icon:'download', label:chosen.length > 1 ? 'Tải về các tệp' : 'Tải về', run:() => runAction('download', chosen)} : null,
      '-',
      single ? {key:'rename', icon:'edit', label:'Đổi tên', hint:'F2', disabled:single.system || single.can.rename === false, run:() => runAction('rename', chosen)} : null,
      {key:'move', icon:'move', label:'Di chuyển tới…', disabled:anySystem, run:() => runAction('move', chosen)},
      single && !isFolder(single) ? {key:'copy', icon:'copy', label:'Tạo bản sao', run:() => runAction('copy', chosen)} : null,
      {key:'star', icon:'star', label:allStarred ? 'Bỏ gắn dấu sao' : 'Gắn dấu sao', run:() => runAction(allStarred ? 'unstar' : 'star', chosen)},
      single && single.webViewLink ? {key:'link', icon:'link', label:'Sao chép liên kết', run:() => runAction('link', chosen)} : null,
      single ? {key:'details', icon:'info', label:'Xem chi tiết', run:() => runAction('details', chosen)} : null,
      '-',
      {key:'trash', icon:'trash', label:'Chuyển vào thùng rác', danger:true, hint:'Del', disabled:anySystem, run:() => runAction('trash', chosen)}
    ].filter(Boolean);
    // Bỏ dấu phân cách thừa ở đầu/cuối/liền nhau.
    const clean = items.filter((item, index, list) => item !== '-' || (index > 0 && index < list.length - 1 && list[index - 1] !== '-'));
    showMenu(clean, anchor, point);
  }

  // ---- Thao tác --------------------------------------------------------------------------
  async function runAction(key, chosen) {
    if (!chosen || !chosen.length) return;
    const ids = chosen.map(file => file.id);
    const label = chosen.length === 1 ? '“' + chosen[0].name + '”' : chosen.length + ' mục';
    switch (key) {
      case 'details': detailsId = chosen[0].id; paintDetails(); return;
      case 'details-folder': if (folder) { detailsId = folder.id; paintDetails(); } return;
      case 'download': return download(chosen);
      case 'rename': return renameDialog(chosen[0]);
      case 'move': return moveDialog(chosen);
      case 'link': {
        try { await navigator.clipboard.writeText(chosen[0].webViewLink); toast('Đã sao chép liên kết. Người nhận cần có quyền truy cập tệp trên Drive.'); }
        catch (_) { toast('Trình duyệt chưa cho phép sao chép. Hãy mở trên Google Drive để lấy liên kết.', 'warning'); }
        return;
      }
      case 'copy': {
        try {
          const result = await Api.copy(chosen[0].id);
          if (view === 'folder' && !query) await load();
          toast('Đã tạo “' + result.file.name + '”.');
          audit('Tạo bản sao tệp trên Google Drive: ' + chosen[0].name, {fileId:chosen[0].id});
        } catch (error) { toast(error.message, 'error'); }
        return;
      }
      case 'star': case 'unstar': {
        const starred = key === 'star';
        chosen.forEach(file => { file.starred = starred; }); // cập nhật lạc quan
        if (view === 'starred' && !starred) files = files.filter(file => !ids.includes(file.id));
        paint();
        try {
          const result = await Api.star(ids, starred);
          if (result.failed?.length) { result.failed.forEach(item => { const file = byId(item.id); if (file) file.starred = !starred; }); paint(); toast('Có ' + result.failed.length + ' mục chưa cập nhật được dấu sao.', 'warning'); }
          if (view === 'starred' && !starred) await load();
        } catch (error) { chosen.forEach(file => { file.starred = !starred; }); paint(); toast(error.message, 'error'); if (view === 'starred' && !starred) await load(); }
        return;
      }
      case 'trash': {
        const blocked = chosen.filter(file => file.system);
        if (blocked.length) { toast('Không thể xóa thư mục hệ thống của ứng dụng.', 'warning'); return; }
        if (!await confirmAction('Chuyển vào thùng rác?', label + ' sẽ được chuyển vào thùng rác Google Drive. Bạn có thể khôi phục trong 30 ngày.', 'Chuyển vào thùng rác')) return;
        return mutate(() => Api.trash(ids), ids, 'Đã chuyển ' + label + ' vào thùng rác.', 'Chuyển vào thùng rác: ' + label, true);
      }
      case 'restore':
        return mutate(() => Api.restore(ids), ids, 'Đã khôi phục ' + label + '.', 'Khôi phục từ thùng rác: ' + label, true);
      case 'remove': {
        if (!await confirmAction('Xóa vĩnh viễn?', label + ' sẽ bị xóa vĩnh viễn khỏi Google Drive và KHÔNG THỂ khôi phục.', 'Xóa vĩnh viễn')) return;
        return mutate(() => Api.remove(ids), ids, 'Đã xóa vĩnh viễn ' + label + '.', 'Xóa vĩnh viễn: ' + label, true);
      }
    }
  }
  // Thao tác hàng loạt: bỏ các mục đã xong khỏi danh sách hiện tại, báo mục thất bại.
  async function mutate(request, ids, success, auditText, removeFromList) {
    host?.querySelector('[data-drv-selbar]')?.classList.add('is-busy');
    try {
      const result = await request();
      const done = new Set(result.done || ids);
      if (removeFromList) files = files.filter(file => !done.has(file.id));
      selected = new Set([...selected].filter(id => !done.has(id)));
      if (detailsId && done.has(detailsId)) detailsId = null;
      if (removeFromList && done.size) await load(); else paint();
      if (result.failed?.length) toast((done.size ? 'Đã xử lý ' + done.size + ' mục. ' : '') + result.failed.length + ' mục lỗi: ' + result.failed[0].error, 'warning');
      else toast(success);
      if (done.size) { audit(auditText, {count:done.size}); loadAbout(); }
    } catch (error) { toast(error.message, 'error'); }
    finally { host?.querySelector('[data-drv-selbar]')?.classList.remove('is-busy'); }
  }
  async function confirmAction(title, message, confirmText) {
    if (typeof showConfirmModal === 'function') return showConfirmModal(title, message, confirmText);
    return window.confirm(message);
  }
  async function emptyTrash() {
    if (!await confirmAction('Dọn sạch thùng rác?', 'Toàn bộ mục trong thùng rác Google Drive sẽ bị xóa vĩnh viễn và KHÔNG THỂ khôi phục.', 'Xóa vĩnh viễn tất cả')) return;
    try {
      await Api.emptyTrash();
      files = []; pages = []; pageIndex = 0; nextPageToken = ''; selected.clear(); detailsId = null; paint();
      toast('Đã dọn sạch thùng rác.');
      audit('Dọn sạch thùng rác Google Drive');
      loadAbout();
    } catch (error) { toast(error.message, 'error'); }
  }
  async function download(chosen) {
    const targets = chosen.filter(file => !isFolder(file));
    if (!targets.length) { toast('Chọn tệp (không phải thư mục) để tải về.', 'warning'); return; }
    if (targets.length > 1) toast('Đang tải ' + targets.length + ' tệp…');
    for (const file of targets) {
      if (!Api.isNative(file) && Number(file.size) > 20 * 1024 * 1024) {
        toast('“' + file.name + '” lớn hơn 20 MB – mở Google Drive để tải.', 'warning');
        if (file.webViewLink) window.open(file.webViewLink, '_blank', 'noopener,noreferrer');
        continue;
      }
      try {
        const result = await Api.download(file.id, 'download');
        const url = URL.createObjectURL(new Blob([result.bytes], {type:result.mimeType || 'application/octet-stream'}));
        const link = document.createElement('a');
        link.href = url; link.download = result.name || file.name;
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (error) { toast('“' + file.name + '”: ' + error.message, 'error'); }
    }
  }
  async function moveItems(ids, targetId, targetName) {
    const blocked = ids.map(byId).filter(file => file && file.system);
    if (blocked.length) { toast('Không thể di chuyển thư mục hệ thống của ứng dụng.', 'warning'); return; }
    const label = ids.length === 1 ? '“' + (byId(ids[0])?.name || '1 mục') + '”' : ids.length + ' mục';
    await mutate(() => Api.move(ids, targetId), ids, 'Đã chuyển ' + label + ' vào “' + targetName + '”.', 'Di chuyển ' + label + ' tới ' + targetName, view === 'folder' && !query && targetId !== folderId);
  }

  // ---- Hộp thoại -------------------------------------------------------------------------
  function closeDialog() {
    if (!dialog) return;
    const node = dialog; dialog = null;
    if (node.open) node.close();
    node.remove();
  }
  function makeDialog(title, body, options = {}) {
    closeDialog();
    const node = document.createElement('dialog');
    node.className = 'sf-dialog sf-dialog-v2 drv-dialog' + (options.wide ? ' is-wide' : '');
    node.setAttribute('aria-labelledby', 'drvDialogTitle');
    node.innerHTML = `<form class="sf-dialog-form"><header class="sf-dialog-head"><span class="sf-dialog-emblem" aria-hidden="true">${icon(options.icon || 'folder')}</span><div><small>GOOGLE DRIVE</small><h2 id="drvDialogTitle">${esc(title)}</h2>${options.description ? `<p>${esc(options.description)}</p>` : ''}</div><button type="button" class="sf-icon-button sf-dialog-close" data-drv-cancel aria-label="Đóng" title="Đóng (Esc)">${icon('close')}</button></header><div class="sf-dialog-body">${body}<p class="sf-feedback" role="status" aria-live="polite"></p></div><footer class="sf-dialog-foot"><button type="button" class="sf-button" data-drv-cancel>Hủy</button><button type="submit" class="sf-button sf-primary">${icon(options.submitIcon || 'check')}<span data-drv-submit-label>${esc(options.submit || 'Lưu')}</span></button></footer></form>`;
    document.body.appendChild(node);
    dialog = node;
    node.querySelectorAll('[data-drv-cancel]').forEach(button => { button.onclick = () => { if (!node.dataset.busy) closeDialog(); }; });
    node.addEventListener('cancel', event => { event.preventDefault(); if (!node.dataset.busy) closeDialog(); });
    node.addEventListener('keydown', event => event.stopPropagation());
    node.showModal();
    return node;
  }
  function setBusy(node, busy) {
    if (busy) node.dataset.busy = 'true'; else delete node.dataset.busy;
    node.querySelectorAll('button,input').forEach(field => { field.disabled = busy; });
  }
  function nameDialog({title, description, value, submit, icon:ico, selectStem, onSubmit}) {
    const node = makeDialog(title, `<label class="sf-field"><span class="sf-field-label">Tên</span><input name="name" maxlength="240" required autocomplete="off" spellcheck="false"></label>`, {icon:ico, description, submit});
    const form = node.querySelector('form'), input = form.elements.name, status = node.querySelector('[role="status"]');
    input.value = value || '';
    input.focus();
    const dot = selectStem ? input.value.lastIndexOf('.') : -1;
    if (dot > 0) input.setSelectionRange(0, dot); else input.select();
    form.onsubmit = async event => {
      event.preventDefault();
      let name;
      try { name = Api.validateName(input.value); } catch (error) { status.textContent = error.message; input.focus(); return; }
      setBusy(node, true); status.textContent = 'Đang lưu…';
      try { await onSubmit(name); if (dialog === node) closeDialog(); }
      catch (error) { status.textContent = error.message; setBusy(node, false); input.focus(); }
    };
  }
  function newFolderDialog() {
    if (!canUploadHere()) { toast('Mở một thư mục trong “Drive của tôi” để tạo thư mục mới.', 'warning'); return; }
    const parentId = folderId, parentName = path.at(-1)?.name || 'Drive của tôi';
    nameDialog({title:'Thư mục mới', description:'Tạo trong: ' + parentName, value:'Thư mục không có tiêu đề', submit:'Tạo thư mục', icon:'folderPlus', onSubmit:async name => {
      const result = await Api.createFolder(parentId, name);
      if (view === 'folder' && folderId === parentId && !query) await load();
      toast('Đã tạo thư mục “' + result.file.name + '”.');
      audit('Tạo thư mục Google Drive: ' + result.file.name, {parentId});
    }});
  }
  function renameDialog(file) {
    if (!file || file.system) { toast('Không thể đổi tên thư mục hệ thống của ứng dụng.', 'warning'); return; }
    nameDialog({title:'Đổi tên', description:Api.typeLabel(file), value:file.name, submit:'Đổi tên', icon:'edit', selectStem:!isFolder(file) && !Api.isNative(file), onSubmit:async name => {
      if (name === file.name) return;
      const result = await Api.rename(file.id, name);
      const target = byId(file.id); if (target) Object.assign(target, result.file);
      if (folder && folder.id === file.id) { folder = result.file; path = path.map(item => item.id === file.id ? {...item, name:result.file.name} : item); }
      await load();
      toast('Đã đổi tên thành “' + result.file.name + '”.');
      audit('Đổi tên trên Google Drive: ' + file.name + ' → ' + result.file.name, {fileId:file.id});
    }});
  }
  function moveDialog(chosen) {
    if (chosen.some(file => file.system)) { toast('Không thể di chuyển thư mục hệ thống của ứng dụng.', 'warning'); return; }
    const moving = new Set(chosen.map(file => file.id));
    let browse = view === 'folder' && !query ? folderId : 'root', browsePath = [], target = null, token = 0;
    const label = chosen.length === 1 ? '“' + chosen[0].name + '”' : chosen.length + ' mục';
    const node = makeDialog('Di chuyển ' + label, `<div class="drv-picker"><nav class="drv-picker-crumbs" data-drv-picker-crumbs aria-label="Đường dẫn"></nav><div class="drv-picker-list" data-drv-picker-list role="listbox" aria-label="Chọn thư mục đích"></div></div>`, {icon:'move', wide:true, description:'Chọn thư mục đích rồi bấm “Chuyển vào đây”. Nhấp đúp để mở thư mục con.', submit:'Chuyển vào đây', submitIcon:'move'});
    const form = node.querySelector('form'), list = node.querySelector('[data-drv-picker-list]'), crumbs = node.querySelector('[data-drv-picker-crumbs]'), status = node.querySelector('[role="status"]'), submitLabel = node.querySelector('[data-drv-submit-label]');
    const destination = () => target || {id:browse, name:browsePath.at(-1)?.name || 'Drive của tôi'};
    const syncSubmit = () => {
      const dest = destination();
      const sameFolder = view === 'folder' && !query && dest.id === folderId && !target;
      form.querySelector('[type="submit"]').disabled = sameFolder || moving.has(dest.id);
      submitLabel.textContent = target ? 'Chuyển vào “' + target.name + '”' : 'Chuyển vào đây';
    };
    async function show(id) {
      const own = ++token;
      browse = id; target = null;
      list.innerHTML = '<div class="drv-picker-loading"><span class="drv-spinner" aria-hidden="true"></span> Đang tải thư mục…</div>';
      syncSubmit();
      try {
        const result = await Api.folders(id);
        if (own !== token || dialog !== node) return;
        browsePath = result.path || [{id:'root', name:'Drive của tôi'}];
        crumbs.innerHTML = browsePath.map((item, index) => index === browsePath.length - 1 ? `<strong>${esc(item.name)}</strong>` : `<button type="button" data-drv-go="${esc(item.id)}">${esc(item.name)}</button>`).join(icon('chevron', 'drv-crumb-sep'));
        const folders = (result.folders || []);
        list.innerHTML = folders.length ? folders.map(item => {
          const blocked = moving.has(item.id) || !item.canAddChildren;
          return `<div class="drv-picker-item${blocked ? ' is-disabled' : ''}" role="option" aria-selected="false" aria-disabled="${blocked}" tabindex="${blocked ? -1 : 0}" data-drv-pick="${esc(item.id)}" data-drv-pick-name="${esc(item.name)}">${icon('folder')}<span>${esc(item.name)}</span>${item.system ? `<span class="drv-mini is-system" title="Thư mục hệ thống">${icon('shield')}</span>` : ''}${blocked ? '' : `<button type="button" class="sf-icon-button" data-drv-go="${esc(item.id)}" aria-label="Mở ${esc(item.name)}" tabindex="-1">${icon('chevron')}</button>`}</div>`;
        }).join('') : `<div class="drv-picker-empty">${icon('folder')} Không có thư mục con. Có thể chuyển trực tiếp vào “${esc(browsePath.at(-1)?.name || '')}”.</div>`;
        syncSubmit();
      } catch (error) { if (own === token) list.innerHTML = `<div class="drv-picker-empty is-error">${icon('alert')} ${esc(error.message)}</div>`; }
    }
    node.addEventListener('click', event => {
      const go = event.target.closest('[data-drv-go]');
      if (go) { event.preventDefault(); show(go.dataset.drvGo); return; }
      const pick = event.target.closest('[data-drv-pick]');
      if (!pick || pick.classList.contains('is-disabled')) return;
      list.querySelectorAll('.is-picked').forEach(item => { item.classList.remove('is-picked'); item.setAttribute('aria-selected', 'false'); });
      pick.classList.add('is-picked'); pick.setAttribute('aria-selected', 'true');
      target = {id:pick.dataset.drvPick, name:pick.dataset.drvPickName};
      syncSubmit();
    });
    node.addEventListener('dblclick', event => { const pick = event.target.closest('[data-drv-pick]'); if (pick && !pick.classList.contains('is-disabled')) show(pick.dataset.drvPick); });
    list.addEventListener('keydown', event => { const pick = event.target.closest('[data-drv-pick]'); if (pick && event.key === 'Enter') { event.preventDefault(); show(pick.dataset.drvPick); } else if (pick && event.key === ' ') { event.preventDefault(); pick.click(); } });
    form.onsubmit = async event => {
      event.preventDefault();
      const dest = destination();
      setBusy(node, true); status.textContent = 'Đang di chuyển…';
      closeDialog();
      await moveItems([...moving], dest.id, dest.name);
    };
    show(browse);
  }

  // ---- Tải lên ---------------------------------------------------------------------------
  function pickFiles() {
    if (!canUploadHere()) { toast('Mở một thư mục trong “Drive của tôi” để tải tệp lên.', 'warning'); return; }
    host?.querySelector('[data-drv-file-input]')?.click();
  }
  function queueUploads(list) {
    if (!list.length || !host) return;
    const parentId = folderId, parentName = path.at(-1)?.name || 'Drive của tôi';
    list.forEach(file => {
      const item = {id:Api.requestId(), file, name:file.name, size:file.size, parentId, parentName, status:'queued', error:''};
      if (!file.size) { item.status = 'error'; item.error = 'Tệp trống'; }
      else if (file.size > Api.UPLOAD_MAX) { item.status = 'error'; item.error = 'Vượt 10 MB – tải trực tiếp trên Drive'; }
      uploads.push(item);
    });
    trayCollapsed = false;
    paintTray();
    pumpUploads();
  }
  function pumpUploads() {
    while (uploadWorkers < UPLOAD_WORKERS) {
      const item = uploads.find(entry => entry.status === 'queued');
      if (!item) break;
      uploadWorkers++;
      item.status = 'uploading';
      paintTray();
      Api.upload(item.file, item.parentId, item.id).then(result => {
        item.status = 'done'; item.result = result.file;
        // Tải lại đúng thư mục để giữ thứ tự và giới hạn số mục mỗi trang.
        if (host && view === 'folder' && !query && folderId === item.parentId) load();
        audit('Tải tệp lên Google Drive: ' + result.file.name, {parentId:item.parentId, size:item.size});
      }).catch(error => { item.status = 'error'; item.error = error.message; })
        .finally(() => {
          uploadWorkers--;
          paintTray();
          if (!uploads.some(entry => entry.status === 'queued' || entry.status === 'uploading')) {
            const done = uploads.filter(entry => entry.status === 'done').length, failed = uploads.filter(entry => entry.status === 'error').length;
            if (done) loadAbout();
            if (failed) toast('Đã tải lên ' + done + ' tệp, ' + failed + ' tệp lỗi.', 'warning');
          }
          pumpUploads();
        });
    }
  }
  function paintTray() {
    const tray = host?.querySelector('[data-drv-tray]');
    if (!tray) return;
    if (!uploads.length) { tray.hidden = true; tray.innerHTML = ''; return; }
    const active = uploads.filter(item => item.status === 'queued' || item.status === 'uploading').length;
    const done = uploads.filter(item => item.status === 'done').length;
    const failed = uploads.filter(item => item.status === 'error').length;
    const title = active ? 'Đang tải lên ' + (uploads.length - active) + '/' + uploads.length : 'Đã tải lên ' + done + ' tệp' + (failed ? ' · ' + failed + ' lỗi' : '');
    const percent = Math.round((uploads.length - active) / uploads.length * 100);
    tray.hidden = false;
    tray.classList.toggle('is-collapsed', trayCollapsed);
    tray.innerHTML = `<header class="drv-tray-head"><span class="drv-tray-ring" style="--p:${percent}" aria-hidden="true">${active ? '' : icon(failed ? 'alert' : 'check')}</span><strong>${esc(title)}</strong><button type="button" class="sf-icon-button" data-drv-tray="toggle" aria-label="${trayCollapsed ? 'Mở rộng' : 'Thu gọn'}" aria-expanded="${!trayCollapsed}">${icon('chevronDown')}</button>${active ? '' : `<button type="button" class="sf-icon-button" data-drv-tray="close" aria-label="Đóng">${icon('close')}</button>`}</header>
      <ul class="drv-tray-list">${uploads.slice(-40).reverse().map(item => `<li class="is-${item.status}"><span class="drv-glyph is-small drv-kind-${Api.kindOf({name:item.name, mimeType:item.file?.type || ''})}">${icon(kindIcon(Api.kindOf({name:item.name, mimeType:item.file?.type || ''})))}</span><div><strong title="${esc(item.name)}">${esc(item.name)}</strong><small>${item.status === 'error' ? esc(item.error) : item.status === 'done' ? 'Đã lưu vào “' + esc(item.parentName) + '”' : item.status === 'uploading' ? 'Đang tải lên · ' + esc(Api.formatBytes(item.size)) : 'Đang chờ · ' + esc(Api.formatBytes(item.size))}</small></div><span class="drv-tray-state">${item.status === 'uploading' ? '<span class="drv-spinner" aria-label="Đang tải"></span>' : item.status === 'done' ? icon('check') : item.status === 'error' ? (item.file && item.file.size && item.file.size <= Api.UPLOAD_MAX ? `<button type="button" class="drv-link-button" data-drv-tray="retry" data-drv-upload-id="${esc(item.id)}">Thử lại</button>` : icon('alert')) : ''}</span></li>`).join('')}</ul>`;
    tray.onclick = event => {
      const button = event.target.closest('[data-drv-tray]');
      if (!button) return;
      const action = button.dataset.drvTray;
      if (action === 'toggle') { trayCollapsed = !trayCollapsed; paintTray(); }
      else if (action === 'close') { uploads.length = 0; paintTray(); }
      else if (action === 'retry') { const item = uploads.find(entry => entry.id === button.dataset.drvUploadId); if (item) { item.status = 'queued'; item.error = ''; paintTray(); pumpUploads(); } }
    };
  }

  // ---- Ảnh thu nhỏ: chỉ xin khi phần tử sắp vào khung nhìn, gom lô tối đa 12 ảnh/request ----
  function observeThumbs(scope) {
    const nodes = [...scope.querySelectorAll('[data-drv-thumb]')].filter(node => !thumbs.has(node.dataset.drvThumb) && !thumbFailed.has(node.dataset.drvThumb));
    if (!nodes.length) return;
    if (!('IntersectionObserver' in window)) { requestThumbs(nodes.map(node => node.dataset.drvThumb)); return; }
    if (!observer) observer = new IntersectionObserver(entries => {
      const ids = entries.filter(entry => entry.isIntersecting).map(entry => { observer.unobserve(entry.target); return entry.target.dataset.drvThumb; });
      if (ids.length) requestThumbs(ids);
    }, {rootMargin:'240px'});
    nodes.forEach(node => observer.observe(node));
  }
  async function requestThumbs(ids) {
    const wanted = [...new Set(ids)].filter(id => !thumbs.has(id) && !thumbPending.has(id) && !thumbFailed.has(id));
    for (let i = 0; i < wanted.length; i += THUMB_BATCH) {
      const batch = wanted.slice(i, i + THUMB_BATCH);
      batch.forEach(id => thumbPending.add(id));
      const own = generation;
      try {
        const result = await Api.thumbnails(batch);
        (result.items || []).forEach(item => {
          if (!item.ok || !item.data) { thumbFailed.add(item.id); return; }
          const blob = new Blob([Uint8Array.from(atob(item.data), ch => ch.charCodeAt(0))], {type:item.mimeType || 'image/jpeg'});
          thumbs.set(item.id, URL.createObjectURL(blob));
          if (thumbs.size > THUMB_CACHE_LIMIT) { const [oldest, url] = thumbs.entries().next().value; URL.revokeObjectURL(url); thumbs.delete(oldest); }
        });
      } catch (_) {
        // Lỗi tạm thời (mạng / quá tải): cho thử lại MỘT lần sau ít giây, không đánh dấu hỏng vĩnh viễn ngay.
        const again = batch.filter(id => !thumbRetried.has(id));
        batch.forEach(id => { if (thumbRetried.has(id)) thumbFailed.add(id); else thumbRetried.add(id); });
        if (again.length && own === generation) setTimeout(() => { if (host && own === generation) requestThumbs(again); }, 2500);
      }
      finally { batch.forEach(id => thumbPending.delete(id)); }
      if (own === generation && host) applyThumbs(batch);
    }
  }
  // Chèn ảnh vào đúng phần tử (không vẽ lại cả danh sách để giữ vị trí cuộn / focus).
  function applyThumbs(ids) {
    ids.forEach(id => {
      const url = thumbs.get(id);
      host.querySelectorAll(`[data-drv-thumb="${CSS.escape(id)}"]`).forEach(node => {
        node.removeAttribute('data-drv-thumb');
        if (!url) return;
        const img = document.createElement('img');
        img.src = url; img.alt = ''; img.decoding = 'async';
        if (!reducedMotion()) img.className = 'drv-fade-in';
        if (node.classList.contains('drv-glyph')) { node.classList.add('has-thumb'); node.replaceChildren(img); }
        else { node.querySelector('.drv-tile-icon')?.replaceWith(img); }
      });
    });
  }

  return {mount, leave};
})();
