const SharedForms = (() => {
  const labels = {all:'Tất cả',word:'Word',pdf:'PDF',sheet:'Excel',image:'Hình ảnh',text:'Tài liệu'};
  const icons = {word:'W',pdf:'PDF',sheet:'X',image:'ẢNH',text:'TXT',folder:'▤'};
  let host = null, files = [], driveFiles = [], config = null, stack = [], unsubscribe = null, controller = null, generation = 0;
  let source = 'drive', query = '', filter = 'all', category = '', sort = 'newest', page = 1, loading = false, errorText = '', driveError = '', dialog = null;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const sizeText = size => !Number(size) ? '' : Number(size) < 1048576 ? Math.max(1,Math.round(Number(size)/1024)) + ' KB' : (Number(size)/1048576).toLocaleString('vi-VN',{maximumFractionDigits:1}) + ' MB';
  const available = () => source === 'drive' ? driveFiles : [...SharedFormsStore.builtins(),...files];
  const findFile = id => available().find(file => file.id === id);
  function closeDialog() {
    if (!dialog) return;
    dialog.close();
    dialog.remove();
    dialog = null;
  }
  function leave() {
    generation++;
    unsubscribe?.();
    unsubscribe = null;
    controller?.abort();
    controller = null;
    SharedFormsViewer.close();
    closeDialog();
    host = null;
  }
  function makeDialog(title, markup) {
    closeDialog();
    const node = document.createElement('dialog');
    node.className = 'sf-dialog';
    node.setAttribute('aria-labelledby','sfDialogTitle');
    node.innerHTML = '<form class="sf-dialog-form"><header><div><small>THƯ VIỆN BIỂU MẪU</small><h2 id="sfDialogTitle">' + escape(title) + '</h2></div><button type="button" class="sf-button" data-sf-cancel aria-label="Đóng">✕</button></header>' + markup + '<p class="sf-feedback" role="status" aria-live="polite"></p><footer><button type="button" class="sf-button" data-sf-cancel>Hủy</button><button type="submit" class="sf-button sf-primary">Lưu</button></footer></form>';
    document.body.appendChild(node);
    dialog = node;
    node.querySelectorAll('[data-sf-cancel]').forEach(button => button.onclick = closeDialog);
    node.addEventListener('cancel',event => { event.preventDefault(); if (!node.dataset.busy) closeDialog(); });
    node.showModal();
    return node;
  }
  function busy(node, value) {
    if (value) node.dataset.busy = 'true'; else delete node.dataset.busy;
    node.querySelectorAll('button,input,textarea').forEach(field => field.disabled = value);
  }
  function detailsMarkup() {
    return '<label>Tên hiển thị<input name="name" maxlength="200" placeholder="Dùng tên file nếu để trống"></label><label>Phân loại<input name="category" maxlength="100" list="sfCategorySuggestions" placeholder="Ví dụ: Nghiệp vụ bồi thường"><datalist id="sfCategorySuggestions"><option>Nghiệp vụ bồi thường</option><option>Giám định hiện trường</option><option>Kế toán</option><option>Khác</option></datalist></label><label>Ghi chú<textarea name="notes" maxlength="2000" rows="3" placeholder="Hướng dẫn sử dụng, phiên bản biểu mẫu…"></textarea></label>';
  }
  function uploadDialog() {
    if (!SharedFormsStore.user()) { triggerToast('Vui lòng đăng nhập để tải file lên.','warning'); return; }
    const node = makeDialog('Tải biểu mẫu lên','<label class="sf-file-pick">Chọn file hoặc kéo file vào đây<input name="files" type="file" multiple required accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp"><span>PDF, Word, Excel, CSV, TXT và ảnh · Tối đa 20 MB/file</span></label><p class="sf-note">Có thể chọn nhiều file. Tên hiển thị chỉ áp dụng khi tải một file; phân loại và ghi chú áp dụng cho tất cả.</p>' + detailsMarkup() + '<progress max="100" value="0" hidden aria-label="Tiến trình tải lên"></progress>');
    const form = node.querySelector('form');
    const status = node.querySelector('[role="status"]');
    const submit = node.querySelector('[type="submit"]');
    submit.textContent = 'Tải lên';
    let pending = [];
    form.elements.files.onchange = () => { pending = [...form.elements.files.files]; submit.textContent = 'Tải lên'; status.textContent = pending.length + ' file đã chọn'; };
    const dropArea = node.querySelector('.sf-file-pick');
    dropArea.ondragover = event => event.preventDefault();
    dropArea.ondrop = event => {
      event.preventDefault();
      if (node.dataset.busy || !event.dataTransfer?.files.length) return;
      form.elements.files.files = event.dataTransfer.files;
      form.elements.files.onchange();
    };
    form.onsubmit = async event => {
      event.preventDefault();
      if (!pending.length) { status.textContent = 'Vui lòng chọn file cần tải lên.'; return; }
      try { pending.forEach(SharedFormsStore.validateFile); } catch (error) { status.textContent = error.message; return; }
      const details = {name:pending.length === 1 ? form.elements.name.value : '',category:form.elements.category.value,notes:form.elements.notes.value};
      const progress = node.querySelector('progress');
      const failed = [];
      const total = pending.length;
      let completed = 0;
      busy(node,true);
      progress.hidden = false;
      for (const file of pending) {
        try {
          status.textContent = 'Đang tải ' + file.name + '…';
          await SharedFormsStore.upload(file,details,percent => { progress.value = percent; });
          completed++;
        } catch (error) { failed.push({file,message:error.message}); }
      }
      busy(node,false);
      if (!failed.length) {
        if (dialog === node) closeDialog();
        if (host) selectSource('app');
        triggerToast('Đã thêm ' + completed + ' biểu mẫu vào thư viện.');
      } else {
        pending = failed.map(item => item.file);
        submit.textContent = 'Thử lại file lỗi';
        status.textContent = 'Đã tải ' + completed + '/' + total + ' file. ' + failed.map(item => item.file.name + ': ' + item.message).join('\n');
        if (dialog !== node) triggerToast('Có ' + failed.length + ' file chưa thêm được vào thư viện. Vui lòng mở lại trang biểu mẫu để thử lại.','error');
      }
    };
  }
  function editDialog(file) {
    if (!SharedFormsStore.canManage(file)) return;
    const node = makeDialog('Thông tin biểu mẫu',detailsMarkup());
    const form = node.querySelector('form');
    form.elements.name.value = file.name;
    form.elements.name.required = true;
    form.elements.category.value = file.category;
    form.elements.notes.value = file.notes || '';
    form.onsubmit = async event => {
      event.preventDefault();
      const details = {name:form.elements.name.value,category:form.elements.category.value,notes:form.elements.notes.value};
      busy(node,true);
      try { await SharedFormsStore.update(file,details); if (dialog === node) closeDialog(); triggerToast('Đã cập nhật biểu mẫu.'); }
      catch (error) { node.querySelector('[role="status"]').textContent = error.message; }
      finally { busy(node,false); }
    };
  }
  async function removeFile(file) {
    if (!SharedFormsStore.canManage(file)) return;
    if (!await showConfirmModal('Xóa khỏi thư viện?', 'Biểu mẫu “' + file.name + '” sẽ được gỡ khỏi danh sách dùng chung. File gốc vẫn lưu trên Cloudinary và có thể quản lý tại đó.', 'Xóa biểu mẫu')) return;
    try { await SharedFormsStore.remove(file); triggerToast('Đã xóa biểu mẫu khỏi thư viện.'); }
    catch { triggerToast('Chưa xóa được. Kiểm tra kết nối và quyền Firebase.','error'); }
  }
  async function settingsDialog() {
    if (!SharedFormsStore.admin()) return;
    const node = makeDialog('Kết nối kho Google Drive','<p class="sf-note">Dán cùng thư mục và API key đã dùng ở mục “Biểu mẫu dùng chung” của dự án tra cứu phụ tùng để xem lại kho hiện có. Thư mục cần chia sẻ cho người có liên kết; Google Drive API cần được bật.</p><label>Tên kho<input name="folderName" maxlength="100" value="Biểu mẫu dùng chung"></label><label>Liên kết thư mục Google Drive<input name="folderId" required placeholder="https://drive.google.com/drive/folders/…"></label><label>Google Drive API key<input name="apiKey" type="password" required autocomplete="off"></label><p class="sf-note">File tải từ trang này được lưu vào thư viện của ứng dụng. Để thêm hoặc sửa file trong Google Drive, dùng nút “Mở thư mục Drive”.</p><button class="sf-button sf-danger" data-sf-unlink type="button" hidden>Gỡ kết nối kho Drive</button>');
    const form = node.querySelector('form');
    const feedback = node.querySelector('[role="status"]');
    const preset = config || SharedFormsStore.defaultDriveConfig();
    if (preset) { form.elements.folderId.value = preset.folderId; form.elements.folderName.value = preset.folderName; }
    try {
      const saved = await SharedFormsStore.loadDriveConfig();
      if (dialog !== node) return;
      if (saved) { form.elements.folderName.value = saved.folderName; form.elements.folderId.value = saved.folderId; form.elements.apiKey.value = saved.apiKey; node.querySelector('[data-sf-unlink]').hidden = false; }
    } catch { feedback.textContent = 'Chưa đọc được cấu hình. Kiểm tra quyền Firebase tại shared_forms/drive.'; }
    form.onsubmit = async event => {
      event.preventDefault();
      const details = {folderId:form.elements.folderId.value,apiKey:form.elements.apiKey.value,folderName:form.elements.folderName.value};
      busy(node,true);
      feedback.textContent = 'Đang kiểm tra thư mục…';
      try {
        config = await SharedFormsStore.saveDriveConfig(details);
        stack = [{id:config.folderId,name:config.folderName}];
        if (dialog === node) closeDialog();
        source = 'drive';
        query = ''; category = ''; filter = 'all'; page = 1;
        if (host) { host.querySelector('[data-sf-search]').value = ''; await loadFolder(); }
        triggerToast('Đã kết nối kho biểu mẫu Google Drive.');
      } catch (error) { feedback.textContent = error.message; }
      finally { busy(node,false); }
    };
    node.querySelector('[data-sf-unlink]').onclick = async () => {
      if (!window.confirm('Gỡ kết nối thư mục Google Drive khỏi ứng dụng? Các file trên Drive vẫn được giữ nguyên.')) return;
      busy(node,true);
      try { await SharedFormsStore.saveDriveConfig(null); config = null; stack = []; driveFiles = []; if (dialog === node) closeDialog(); paint(); }
      catch (error) { feedback.textContent = error.message; }
      finally { busy(node,false); }
    };
  }
  async function loadFolder() {
    controller?.abort();
    if (!host || !config || !stack.length || !config.apiKey) { loading = false; paint(); return; }
    const request = new AbortController();
    controller = request;
    loading = true; driveError = ''; driveFiles = []; page = 1;
    paint();
    const timer = setTimeout(() => request.abort(),30000);
    try { const result = await SharedFormsStore.listDrive(stack.at(-1).id,config,request.signal); if (controller === request) driveFiles = result; }
    catch (error) { if (controller === request) driveError = error.name === 'AbortError' ? 'Google Drive phản hồi quá lâu. Vui lòng thử lại.' : error.message; }
    finally { clearTimeout(timer); if (controller === request) { loading = false; paint(); } }
  }
  function selectSource(value) {
    source = value;
    query = ''; filter = 'all'; category = ''; page = 1;
    host.querySelector('[data-sf-search]').value = '';
    if (source === 'drive') loadFolder(); else { controller?.abort(); controller = null; paint(); }
  }
  function visible() {
    const text = SharedFormsStore.normalize(query.trim());
    return available().filter(file => {
      const kind = SharedFormsStore.kind(file);
      return (filter === 'all' || kind === filter || kind === 'folder') && (!category || file.category === category) && (!text || SharedFormsStore.normalize(file.name + ' ' + (file.notes || '') + ' ' + (file.category || '')).includes(text));
    }).sort((first,second) => {
      const folders = Number(SharedFormsStore.kind(second) === 'folder') - Number(SharedFormsStore.kind(first) === 'folder');
      if (folders) return folders;
      if (sort === 'name') return first.name.localeCompare(second.name,'vi',{numeric:true});
      return (new Date(second.updatedAt || 0).getTime() - new Date(first.updatedAt || 0).getTime()) || first.name.localeCompare(second.name,'vi');
    });
  }
  function card(file) {
    const kind = SharedFormsStore.kind(file);
    const folder = kind === 'folder';
    const meta = [file.category,sizeText(file.size),file.createdByName,file.updatedAt ? new Date(file.updatedAt).toLocaleDateString('vi-VN') : 'Mẫu có sẵn'].filter(Boolean).join(' · ');
    return '<article class="sf-card"><button class="sf-open" type="button" data-sf-open="' + escape(file.id) + '"><span class="sf-file-icon sf-kind-' + kind + '">' + icons[kind] + '</span><span class="sf-card-copy"><strong>' + escape(file.name) + '</strong><small>' + escape(meta) + '</small>' + (file.notes ? '<span class="sf-card-note">' + escape(file.notes) + '</span>' : '') + '</span><span class="sf-open-label">' + (folder ? 'Mở thư mục →' : 'Xem / In →') + '</span></button>' + (!folder ? '<div class="sf-card-actions"><a class="sf-button" href="' + escape(SharedFormsViewer.downloadUrl(file)) + '" target="_blank" rel="noopener noreferrer" download="' + escape(file.originalName || file.name) + '" aria-label="Tải về ' + escape(file.name) + '">Tải về</a>' + (SharedFormsStore.canManage(file) ? '<button class="sf-button" type="button" data-sf-edit="' + escape(file.id) + '">Sửa thông tin</button><button class="sf-button sf-danger" type="button" data-sf-delete="' + escape(file.id) + '">Xóa</button>' : '') + '</div>' : '') + '</article>';
  }
  function paint() {
    if (!host?.isConnected) return;
    host.querySelectorAll('[data-sf-source]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.sfSource === source)));
    host.querySelectorAll('[data-sf-filter]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.sfFilter === filter)));
    const categories = [...new Set(available().map(file => file.category).filter(Boolean))].sort((first,second) => first.localeCompare(second,'vi'));
    if (!categories.includes(category)) category = '';
    host.querySelector('[data-sf-category]').innerHTML = '<option value="">Mọi phân loại</option>' + categories.map(value => '<option' + (category === value ? ' selected' : '') + '>' + escape(value) + '</option>').join('');
    const crumbs = host.querySelector('[data-sf-crumbs]');
    crumbs.hidden = source !== 'drive' || !config;
    crumbs.innerHTML = stack.map((folder,index) => '<button class="sf-button" type="button" data-sf-crumb="' + index + '"' + (index === stack.length - 1 ? ' aria-current="page"' : '') + '>' + escape(folder.name) + '</button>').join('<span aria-hidden="true">/</span>');
    const driveLink = host.querySelector('[data-sf-drive-link]');
    driveLink.hidden = source !== 'drive' || !config;
    if (config) driveLink.href = 'https://drive.google.com/drive/folders/' + encodeURIComponent(stack.at(-1)?.id || config.folderId);
    const notice = host.querySelector('[data-sf-notice]');
    notice.textContent = source === 'drive' ? driveError : errorText;
    notice.hidden = !notice.textContent;
    const rows = visible();
    const pages = Math.max(1,Math.ceil(rows.length / 12));
    page = Math.min(page,pages);
    host.querySelector('[data-sf-count]').textContent = rows.length + ' mục' + (source === 'app' ? ' · Đồng bộ dùng chung' : config ? ' · ' + config.folderName : '');
    const embedded = source === 'drive' && config && !config.apiKey;
    host.querySelector('.sf-controls').hidden = !!embedded;
    host.querySelector('.sf-filters').hidden = !!embedded;
    if (embedded) host.querySelector('[data-sf-count]').textContent = 'Kho Drive đã gắn sẵn';
    const list = host.querySelector('[data-sf-list]');
    list.setAttribute('aria-busy',String(source === 'drive' && loading));
    if (embedded) {
      const folderUrl = 'https://drive.google.com/embeddedfolderview?id=' + encodeURIComponent(config.folderId) + '#list';
      if (list.dataset.embeddedFolder !== config.folderId) {
        list.innerHTML = '<div class="sf-drive-embedded"><p class="sf-note">Kho Google Drive của bạn được mở bên dưới. Nhấn file để xem bằng trình xem của Drive và dùng nút In của tài liệu.' + (SharedFormsStore.admin() ? ' Thêm API key trong <button class="sf-button" type="button" data-sf-settings>Kết nối Drive</button> để duyệt thư mục, lọc và xem/in bằng trình xem tích hợp.' : '') + '</p><iframe title="Kho biểu mẫu Google Drive" src="' + folderUrl + '" sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-downloads"></iframe><p class="sf-note">Nếu Google Drive không hiển thị, nhấn “Mở thư mục Drive” ở trên và kiểm tra quyền chia sẻ thư mục.</p></div>';
        list.dataset.embeddedFolder = config.folderId;
      }
    }
    else if (source === 'drive' && !config) list.innerHTML = '<div class="sf-empty"><span class="sf-file-icon">▤</span><h3>Kết nối kho biểu mẫu hiện có</h3><p>Thiết lập cùng thư mục Google Drive của dự án tra cứu phụ tùng để xem các biểu mẫu tại đây.</p>' + (SharedFormsStore.admin() ? '<button class="sf-button sf-primary" type="button" data-sf-settings>Kết nối Google Drive</button>' : '<p>Vui lòng liên hệ quản trị viên để kết nối thư mục.</p>') + '</div>';
    else if (source === 'drive' && loading) list.innerHTML = '<div class="sf-empty" role="status">Đang tải biểu mẫu từ Google Drive…</div>';
    else if (!rows.length) list.innerHTML = '<div class="sf-empty"><h3>' + (query || filter !== 'all' || category ? 'Không tìm thấy biểu mẫu' : 'Thư mục đang trống') + '</h3><p>' + (driveError ? 'Nhấn Làm mới để thử lại.' : 'Thử đổi từ khóa, bộ lọc hoặc tải file mới lên thư viện.') + '</p></div>';
    else list.innerHTML = rows.slice((page - 1) * 12,page * 12).map(card).join('');
    if (!embedded) delete list.dataset.embeddedFolder;
    host.querySelector('[data-sf-pagination]').hidden = rows.length <= 12;
    host.querySelector('[data-sf-page-status]').textContent = 'Trang ' + page + ' / ' + pages;
    host.querySelector('[data-sf-prev]').disabled = page === 1;
    host.querySelector('[data-sf-next]').disabled = page === pages;
  }
  async function reload() {
    const ownGeneration = generation;
    try {
      const saved = await SharedFormsStore.loadDriveConfig();
      if (ownGeneration !== generation) return;
      config = saved && SharedFormsStore.parseFolder(saved.folderId) ? saved : null;
      if (!config) { stack = []; driveFiles = []; }
      else if (!stack.length || stack[0].id !== config.folderId) stack = [{id:config.folderId,name:config.folderName}];
      driveError = '';
      if (source === 'drive') await loadFolder(); else paint();
    } catch { if (ownGeneration === generation) { config = SharedFormsStore.defaultDriveConfig(); stack = config ? [{id:config.folderId,name:config.folderName}] : []; driveError = 'Chưa đọc được cấu hình đã lưu. Đang dùng kho Drive được gắn sẵn; quản trị viên cần kiểm tra quyền Firebase tại shared_forms/drive.'; paint(); } }
  }
  function mount(container) {
    leave();
    if (!SharedFormsStore.user()) { container.textContent = 'Vui lòng đăng nhập để xem biểu mẫu dùng chung.'; return; }
    files = []; driveFiles = []; config = null; stack = []; loading = false; errorText = ''; driveError = '';
    host = document.createElement('section');
    host.className = 'sf-workspace';
    host.setAttribute('aria-label','Biểu mẫu dùng chung');
    host.innerHTML = '<header class="sf-hero"><div><div class="sf-eyebrow">TASCO DLK · THƯ VIỆN TÀI LIỆU</div><h1>Biểu mẫu dùng chung</h1><p>Một nơi để tìm biểu mẫu, quản lý tài liệu và xem in ngay khi cần.</p></div><div class="sf-toolbar"><button type="button" class="sf-button" data-sf-refresh>Làm mới</button>' + (SharedFormsStore.admin() ? '<button type="button" class="sf-button" data-sf-settings>Kết nối Drive</button>' : '') + '<button type="button" class="sf-button sf-primary" data-sf-upload>＋ Tải file lên</button></div></header><div class="sf-sources" role="group" aria-label="Nguồn biểu mẫu"><button class="sf-button" type="button" data-sf-source="app">Thư viện ứng dụng</button><button class="sf-button" type="button" data-sf-source="drive">Kho Google Drive</button><a class="sf-button" data-sf-drive-link target="_blank" rel="noopener noreferrer" hidden>Mở thư mục Drive ↗</a></div><div class="sf-controls"><label class="sf-search"><span class="sf-sr-only">Tìm biểu mẫu</span><input type="search" data-sf-search placeholder="Tìm tên biểu mẫu, ghi chú…" autocomplete="off"></label><label><span class="sf-sr-only">Phân loại</span><select data-sf-category><option value="">Mọi phân loại</option></select></label><label><span class="sf-sr-only">Sắp xếp</span><select data-sf-sort><option value="newest">Mới cập nhật</option><option value="name">Tên A → Z</option></select></label></div><div class="sf-filters" role="group" aria-label="Loại file">' + Object.entries(labels).map(([kind,label]) => '<button class="sf-button" type="button" data-sf-filter="' + kind + '">' + label + '</button>').join('') + '</div><nav class="sf-crumbs" data-sf-crumbs aria-label="Đường dẫn thư mục" hidden></nav><div class="sf-list-heading"><h2>Danh sách biểu mẫu</h2><span data-sf-count role="status" aria-live="polite"></span></div><p class="sf-notice" data-sf-notice role="alert" hidden></p><div class="sf-list" data-sf-list></div><nav class="sf-pagination" data-sf-pagination aria-label="Phân trang biểu mẫu" hidden><button class="sf-button" type="button" data-sf-prev>← Trang trước</button><span data-sf-page-status></span><button class="sf-button" type="button" data-sf-next>Trang sau →</button></nav><p class="sf-note">Nhấn tên biểu mẫu để xem và in. Bạn có thể sửa hoặc xóa file do mình tải lên; quản trị viên quản lý toàn bộ thư viện. Mẫu hệ thống luôn có sẵn.</p>';
    container.replaceChildren(host);
    host.querySelector('[data-sf-search]').value = query;
    host.querySelector('[data-sf-sort]').value = sort;
    host.addEventListener('input',event => { if (event.target.matches('[data-sf-search]')) { query = event.target.value; page = 1; paint(); } });
    host.addEventListener('change',event => { if (event.target.matches('[data-sf-category]')) category = event.target.value; else if (event.target.matches('[data-sf-sort]')) sort = event.target.value; else return; page = 1; paint(); });
    host.addEventListener('click',event => {
      const control = event.target.closest('button');
      if (!control) return;
      if (control.hasAttribute('data-sf-upload')) uploadDialog();
      else if (control.hasAttribute('data-sf-settings')) settingsDialog();
      else if (control.hasAttribute('data-sf-refresh')) { delete host.querySelector('[data-sf-list]').dataset.embeddedFolder; unsubscribe?.(); connect(); reload(); }
      else if (control.dataset.sfSource) selectSource(control.dataset.sfSource);
      else if (control.dataset.sfFilter) { filter = control.dataset.sfFilter; page = 1; paint(); }
      else if (control.hasAttribute('data-sf-crumb')) { stack = stack.slice(0,Number(control.dataset.sfCrumb) + 1); query = ''; host.querySelector('[data-sf-search]').value = ''; loadFolder(); }
      else if (control.dataset.sfOpen) {
        const file = findFile(control.dataset.sfOpen);
        if (!file) return;
        if (SharedFormsStore.kind(file) === 'folder') { stack.push({id:file.id,name:file.name}); query = ''; host.querySelector('[data-sf-search]').value = ''; loadFolder(); }
        else SharedFormsViewer.open(file,config);
      }
      else if (control.dataset.sfEdit) editDialog(findFile(control.dataset.sfEdit));
      else if (control.dataset.sfDelete) removeFile(findFile(control.dataset.sfDelete));
      else if (control.hasAttribute('data-sf-prev')) { page--; paint(); }
      else if (control.hasAttribute('data-sf-next')) { page++; paint(); }
    });
    connect();
    paint();
    reload();
  }
  function connect() {
    const ownGeneration = generation;
    errorText = '';
    try {
      unsubscribe = SharedFormsStore.subscribe(items => { if (ownGeneration === generation) { files = items; errorText = ''; paint(); } },() => { if (ownGeneration === generation) { files = []; errorText = 'Chưa tải được thư viện dùng chung. Kiểm tra kết nối và quyền Firebase tại shared_forms/files, rồi nhấn Làm mới.'; paint(); } });
    } catch (error) { errorText = error.message; }
  }
  return {mount,leave};
})();
