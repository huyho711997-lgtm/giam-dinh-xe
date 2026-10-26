const SharedForms = (() => {
  const labels = {all:'Tất cả',word:'Word',pdf:'PDF',sheet:'Excel',image:'Hình ảnh',text:'Tài liệu'};
  const icons = {word:'W',pdf:'PDF',sheet:'X',image:'ẢNH',text:'TXT',folder:'▤'};
  let host = null, files = [], driveFiles = [], config = null, stack = [], unsubscribe = null, controller = null, generation = 0;
  let source = 'drive', query = '', filter = 'all', category = '', sort = 'newest', page = 1, pageSize = 12, selectedFileId = '', loading = false, errorText = '', driveError = '', dialog = null;
  // Kiểu xem do người dùng chọn (Danh sách / Thẻ), nhớ trên máy này.
  let layout = 'list';
  const readLayout = () => { try { return localStorage.getItem('shared-forms-layout') === 'cards' ? 'cards' : 'list'; } catch (_) { return 'list'; } };
  const icon = name => SharedFormsControls.icon(name);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const sizeText = size => !Number(size) ? '' : Number(size) < 1048576 ? Math.max(1,Math.round(Number(size)/1024)) + ' KB' : (Number(size)/1048576).toLocaleString('vi-VN',{maximumFractionDigits:1}) + ' MB';
  const available = () => source === 'drive' ? driveFiles : [...SharedFormsStore.builtins(),...files];
  const findFile = id => available().find(file => file.id === id);
  function closeDialog() {
    if (!dialog) return;
    SharedFormsControls.close();
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
    SharedFormsControls.close();
    selectedFileId = '';
    closeDialog();
    host = null;
  }
  // Khung hộp thoại chung: đầu (chip icon + tiêu đề + mô tả + nút đóng) · thân cuộn · chân cố định.
  function makeDialog(title, markup, options = {}) {
    closeDialog();
    const node = document.createElement('dialog');
    node.className = 'sf-dialog sf-dialog-v2';
    node.setAttribute('aria-labelledby','sfDialogTitle');
    node.innerHTML = '<form class="sf-dialog-form"><header class="sf-dialog-head"><span class="sf-dialog-emblem" aria-hidden="true">' + icon(options.icon || 'file') + '</span><div><small>THƯ VIỆN BIỂU MẪU</small><h2 id="sfDialogTitle">' + escape(title) + '</h2>' + (options.description ? '<p>' + escape(options.description) + '</p>' : '') + '</div><button type="button" class="sf-icon-button sf-dialog-close" data-sf-cancel aria-label="Đóng" title="Đóng (Esc)">' + icon('close') + '</button></header><div class="sf-dialog-body">' + markup + '<p class="sf-feedback" role="status" aria-live="polite"></p></div><footer class="sf-dialog-foot"><button type="button" class="sf-button" data-sf-cancel>Hủy</button><button type="submit" class="sf-button sf-primary">' + icon(options.submitIcon || 'check') + '<span data-sf-submit-label>' + escape(options.submit || 'Lưu') + '</span></button></footer></form>';
    document.body.appendChild(node);
    dialog = node;
    node.querySelectorAll('[data-sf-cancel]').forEach(button => button.onclick = closeDialog);
    node.addEventListener('cancel',event => { event.preventDefault(); if (!node.dataset.busy) closeDialog(); });
    node.showModal();
    SharedFormsControls.enhance(node);
    return node;
  }
  function busy(node, value) {
    if (value) node.dataset.busy = 'true'; else delete node.dataset.busy;
    node.querySelectorAll('button,input,textarea,select').forEach(field => field.disabled = value);
    SharedFormsControls.enhance(node);
  }
  function detailsMarkup() {
    const categories = [...new Set(['Chưa phân loại','Nghiệp vụ bồi thường','Giám định hiện trường','Kế toán','Khác',...files.map(file => file.category).filter(Boolean)])];
    return '<label class="sf-field" data-sf-name-field><span class="sf-field-label">Tên hiển thị</span><input name="name" maxlength="200" placeholder="Dùng tên file nếu để trống"></label><label class="sf-field"><span class="sf-field-label">Phân loại</span><select name="category" data-sf-select data-allow-custom="true" data-sf-label="Phân loại biểu mẫu" data-sf-description="Chọn hoặc tìm để thêm phân loại mới" data-sf-icon="tag">' + categories.map(value => '<option>' + escape(value) + '</option>').join('') + '</select></label><label class="sf-field"><span class="sf-field-label">Ghi chú <em>Không bắt buộc</em></span><textarea name="notes" maxlength="2000" rows="3" placeholder="Hướng dẫn sử dụng, phiên bản biểu mẫu…"></textarea></label>';
  }
  function uploadDialog() {
    if (!SharedFormsStore.user()) { triggerToast('Vui lòng đăng nhập để tải file lên.','warning'); return; }
    // Đang ở Kho Google Drive → đẩy file vào đúng thư mục đang mở; tab Thư viện ứng dụng → Cloudinary như trước.
    const toDrive = source === 'drive' && !!config;
    if (toDrive && !SharedFormsStore.driveEndpoint()) { triggerToast('Chưa cấu hình dịch vụ đẩy file lên Google Drive. Liên hệ quản trị viên.','warning'); return; }
    const target = toDrive ? {folderId:stack.at(-1)?.id || config.folderId,rootFolderId:config.folderId,folderName:stack.at(-1)?.name || config.folderName || 'Thư mục gốc',path:stack.map(item => item.name).join(' › ')} : null;
    const fileLimitText = toDrive ? '10 MB' : '20 MB';
    const node = makeDialog(toDrive ? 'Tải lên Google Drive' : 'Tải biểu mẫu lên','<label class="sf-drop"><input name="files" type="file" multiple required accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp"><span class="sf-drop-icon" aria-hidden="true">' + icon('upload') + '</span><span class="sf-drop-copy"><strong>Kéo thả file vào đây hoặc <u>chọn từ máy</u></strong><small>PDF, Word, Excel, CSV, TXT và ảnh · tối đa ' + fileLimitText + '/file · chọn được nhiều file</small></span></label><ul class="sf-picked" data-sf-picked hidden></ul><p class="sf-field-hint" data-sf-multi-hint hidden>Tải nhiều file: dùng tên file gốc; phân loại và ghi chú áp dụng cho tất cả.</p>' + detailsMarkup() + '<div class="sf-upload-progress" hidden><progress max="100" value="0" aria-label="Tiến trình tải lên"></progress><span data-sf-progress-text></span></div>',{icon:'upload',description:toDrive ? 'File sẽ được đẩy vào thư mục Google Drive: ' + target.path : 'Thêm biểu mẫu vào thư viện dùng chung của ứng dụng.',submit:'Tải lên',submitIcon:'upload'});
    const form = node.querySelector('form');
    const status = node.querySelector('[role="status"]');
    const submit = node.querySelector('[type="submit"]'), submitLabel = node.querySelector('[data-sf-submit-label]');
    const picked = node.querySelector('[data-sf-picked]'), nameField = node.querySelector('[data-sf-name-field]'), multiHint = node.querySelector('[data-sf-multi-hint]');
    let pending = [];
    if (toDrive) node.querySelectorAll('select[name="category"],textarea[name="notes"],input[name="notes"]').forEach(field => { const wrapper = field.closest('.sf-field') || field; wrapper.hidden = true; });
    const driveLimit = file => { if (toDrive && file.size > 10 * 1024 * 1024) throw new Error('Tải lên Google Drive tối đa 10 MB mỗi file.'); };
    // Danh sách file đã chọn: icon theo loại + tên + dung lượng + lỗi kiểm tra ngay khi chọn.
    const showPicked = () => {
      picked.hidden = !pending.length;
      picked.innerHTML = pending.map((file,index) => {
        let error = ''; try { SharedFormsStore.validateFile(file); driveLimit(file); } catch (problem) { error = problem.message; }
        const kind = error ? 'invalid' : SharedFormsStore.kind({name:file.name,mimeType:file.type});
        const badge = error ? (SharedFormsStore.extension(file.name).toUpperCase().slice(0,4) || 'FILE') : (icons[kind] || 'FILE');
        return '<li class="' + (error ? 'is-invalid' : '') + '"><span class="sf-file-icon sf-kind-' + kind + '">' + escape(badge) + '</span><span class="sf-picked-copy"><strong>' + escape(file.name) + '</strong><small>' + escape(error || sizeText(file.size)) + '</small></span><button type="button" class="sf-icon-button sf-picked-remove" data-sf-unpick="' + index + '" aria-label="Bỏ chọn ' + escape(file.name) + '" title="Bỏ chọn">' + icon('close') + '</button></li>';
      }).join('');
      nameField.hidden = pending.length > 1; multiHint.hidden = pending.length <= 1;
      status.textContent = '';
      const invalid = picked.querySelectorAll('.is-invalid').length;
      submitLabel.textContent = pending.length > 1 ? 'Tải lên ' + pending.length + ' file' : 'Tải lên';
      if (invalid) status.textContent = invalid + ' file không đúng định dạng hoặc quá ' + fileLimitText + ' – bấm × để bỏ chọn.';
      submit.disabled = !pending.length || invalid > 0;
    };
    form.elements.files.onchange = () => { pending = [...form.elements.files.files]; showPicked(); };
    // "pending" là nguồn dữ liệu khi tải lên, nên bỏ chọn chỉ cần xóa khỏi mảng.
    picked.addEventListener('click',event => {
      const remove = event.target.closest('[data-sf-unpick]'); if (!remove || node.dataset.busy) return;
      pending.splice(Number(remove.dataset.sfUnpick),1); if (!pending.length) form.elements.files.value = '';
      showPicked(); (picked.querySelector('[data-sf-unpick]') || dropArea.querySelector('input'))?.focus();
    });
    const dropArea = node.querySelector('.sf-drop');
    dropArea.ondragover = event => { event.preventDefault(); dropArea.classList.add('is-dragging'); };
    dropArea.ondragleave = () => dropArea.classList.remove('is-dragging');
    dropArea.ondrop = event => {
      event.preventDefault(); dropArea.classList.remove('is-dragging');
      if (node.dataset.busy || !event.dataTransfer?.files.length) return;
      form.elements.files.files = event.dataTransfer.files;
      form.elements.files.onchange();
    };
    form.onsubmit = async event => {
      event.preventDefault();
      if (!pending.length) { status.textContent = 'Vui lòng chọn file cần tải lên.'; return; }
      try { pending.forEach(file => { SharedFormsStore.validateFile(file); driveLimit(file); }); } catch (error) { status.textContent = error.message; return; }
      const details = {name:pending.length === 1 ? form.elements.name.value : '',category:form.elements.category.value,notes:form.elements.notes.value};
      const progress = node.querySelector('.sf-upload-progress progress'), progressBox = node.querySelector('.sf-upload-progress'), progressText = node.querySelector('[data-sf-progress-text]');
      const failed = [];
      const total = pending.length;
      let completed = 0;
      busy(node,true);
      progressBox.hidden = false;
      for (const file of pending) {
        try {
          progressText.textContent = 'Đang tải ' + (completed + failed.length + 1) + '/' + total + ': ' + file.name;
          if (toDrive) { progress.value = 30; await SharedFormsStore.uploadToDrive(file,{...target,name:details.name,requestId:file.sfRequestId || (file.sfRequestId = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2) + '0123456789abcdef'))}); progress.value = 100; }
          else await SharedFormsStore.upload(file,details,percent => { progress.value = percent; });
          completed++;
        } catch (error) { failed.push({file,message:error.message}); }
      }
      busy(node,false);
      if (!failed.length) {
        if (dialog === node) closeDialog();
        if (toDrive) {
          triggerToast('Đã tải ' + completed + ' file lên thư mục “' + target.folderName + '” trên Google Drive.' + (config.apiKey ? '' : ' Danh sách sẽ hiện sau khi đồng bộ danh mục Drive.'));
          if (host && source === 'drive' && stack.at(-1)?.id === target.folderId) loadFolder();
        } else {
          if (host) selectSource('app');
          triggerToast('Đã thêm ' + completed + ' biểu mẫu vào thư viện.');
        }
      } else {
        pending = failed.map(item => item.file);
        submitLabel.textContent = 'Thử lại file lỗi'; showPicked(); progressBox.hidden = true;
        status.textContent = 'Đã tải ' + completed + '/' + total + ' file. ' + failed.map(item => item.file.name + ': ' + item.message).join('\n');
        if (dialog !== node) triggerToast('Có ' + failed.length + ' file chưa thêm được vào thư viện. Vui lòng mở lại trang biểu mẫu để thử lại.','error');
      }
    };
  }
  function editDialog(file) {
    if (!SharedFormsStore.canManage(file)) return;
    const node = makeDialog('Thông tin biểu mẫu',detailsMarkup(),{icon:'tag',description:'Sửa tên hiển thị, phân loại và ghi chú của biểu mẫu.',submit:'Lưu thay đổi'});
    const form = node.querySelector('form');
    form.elements.name.value = file.name;
    form.elements.name.required = true;
    form.elements.category.value = file.category;
    form.elements.notes.value = file.notes || '';
    SharedFormsControls.enhance(node);
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
    const node = makeDialog('Kết nối kho Google Drive','<p class="sf-field-hint sf-callout">Dán cùng thư mục và API key đã dùng ở mục “Biểu mẫu dùng chung” của dự án tra cứu phụ tùng để xem lại kho hiện có. Thư mục cần chia sẻ cho người có liên kết; Google Drive API cần được bật.</p><label class="sf-field"><span class="sf-field-label">Tên kho</span><input name="folderName" maxlength="100" value="Biểu mẫu dùng chung"></label><label class="sf-field"><span class="sf-field-label">Liên kết thư mục Google Drive</span><input name="folderId" required placeholder="https://drive.google.com/drive/folders/…"></label><label class="sf-field"><span class="sf-field-label">Google Drive API key</span><input name="apiKey" type="password" required autocomplete="off"></label><p class="sf-note">File tải từ trang này được lưu vào thư viện của ứng dụng. Để thêm hoặc sửa file trong Google Drive, dùng nút “Mở thư mục Drive”.</p><button class="sf-button sf-danger" data-sf-unlink type="button" hidden>Gỡ kết nối kho Drive</button>',{icon:'folder',description:'Đồng bộ danh mục biểu mẫu từ thư mục Google Drive dùng chung.',submit:'Lưu kết nối'});
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
    if (!host || !config || !stack.length) { loading = false; paint(); return; }
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
    SharedFormsViewer.close();
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
  function actions(file,folder) {
    return '<div class="sf-card-actions"><button class="sf-icon-button" type="button" data-sf-open="' + escape(file.id) + '" aria-label="' + (folder ? 'Mở thư mục ' : 'Xem ') + escape(file.name) + '" title="' + (folder ? 'Mở thư mục' : 'Xem trong trang') + '">' + icon(folder ? 'arrow' : 'eye') + '</button>' + (!folder ? '<button class="sf-icon-button" type="button" data-sf-download="' + escape(file.id) + '" aria-label="Tải về ' + escape(file.name) + '" title="Tải về">' + icon('download') + '</button>' : '') + (SharedFormsStore.canManage(file) ? '<button class="sf-icon-button" type="button" data-sf-edit="' + escape(file.id) + '" aria-label="Sửa thông tin ' + escape(file.name) + '" title="Sửa thông tin">' + icon('tag') + '</button><button class="sf-icon-button sf-danger" type="button" data-sf-delete="' + escape(file.id) + '" aria-label="Xóa ' + escape(file.name) + '" title="Xóa">' + icon('close') + '</button>' : '') + '</div>';
  }
  // Dạng thẻ: khối màu theo loại tệp + tên + định dạng/ngày + thao tác.
  function tile(file) {
    const kind = SharedFormsStore.kind(file), folder = kind === 'folder';
    const suffix = folder ? 'Thư mục' : SharedFormsStore.extension(file.originalName || file.name).toUpperCase();
    const date = file.updatedAt ? new Date(file.updatedAt).toLocaleDateString('vi-VN') : '';
    const meta = folder ? 'Mở để xem biểu mẫu bên trong' : [date, sizeText(file.size)].filter(Boolean).join(' · ');
    return '<article class="sf-tile sf-kind-' + kind + (selectedFileId === file.id ? ' is-selected' : '') + '"><button class="sf-tile-open" type="button" data-sf-open="' + escape(file.id) + '"' + (selectedFileId === file.id ? ' aria-current="true"' : '') + ' title="' + escape(file.name) + '">'
      + '<span class="sf-tile-visual"><span class="sf-tile-glyph">' + (folder ? icon('folder') : icon('file')) + (folder ? '' : '<b>' + escape(icons[kind] || suffix) + '</b>') + '</span><span class="sf-format sf-kind-' + kind + '">' + escape(suffix) + '</span></span>'
      + '<span class="sf-tile-copy"><strong>' + escape(file.name) + '</strong><small>' + escape(file.notes || meta) + '</small></span></button>'
      + '<footer class="sf-tile-footer"><span>' + escape(file.category || 'Chưa phân loại') + '</span>' + actions(file,folder) + '</footer></article>';
  }
  function card(file,index) {
    const kind = SharedFormsStore.kind(file);
    const folder = kind === 'folder';
    const suffix = folder ? 'Thư mục' : SharedFormsStore.extension(file.originalName || file.name).toUpperCase();
    const meta = [sizeText(file.size),file.createdByName].filter(Boolean).join(' · ');
    return '<tr class="sf-row' + (selectedFileId === file.id ? ' is-selected' : '') + '"><td class="sf-col-number">' + index + '</td><td class="sf-col-name"><button class="sf-open" type="button" data-sf-open="' + escape(file.id) + '"' + (selectedFileId === file.id ? ' aria-current="true"' : '') + '><span class="sf-file-icon sf-kind-' + kind + '">' + (folder ? icon('folder') : icons[kind]) + '</span><span class="sf-card-copy"><strong>' + escape(file.name) + '</strong><small>' + escape(file.notes || meta || (folder ? 'Mở để xem biểu mẫu bên trong' : 'Nhấn để xem và in tài liệu')) + '</small></span></button></td><td class="sf-col-format"><span class="sf-format sf-kind-' + kind + '">' + escape(suffix) + '</span></td><td class="sf-col-category">' + escape(file.category || 'Chưa phân loại') + '</td><td class="sf-col-date">' + (file.updatedAt ? new Date(file.updatedAt).toLocaleDateString('vi-VN') : '—') + '</td><td class="sf-col-actions">' + actions(file,folder) + '</td></tr>';
  }
  function paint() {
    if (!host?.isConnected) return;
    host.querySelectorAll('[data-sf-source]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.sfSource === source)));
    const categories = [...new Set(available().map(file => file.category).filter(Boolean))].sort((first,second) => first.localeCompare(second,'vi'));
    if (!categories.includes(category)) category = '';
    const categoryOptions = '<option value="">Mọi phân loại</option>' + categories.map(value => '<option' + (category === value ? ' selected' : '') + '>' + escape(value) + '</option>').join('');
    const categorySelect = host.querySelector('[data-sf-category]');
    if (categorySelect.innerHTML !== categoryOptions) categorySelect.innerHTML = categoryOptions;
    categorySelect.value = category;
    const crumbs = host.querySelector('[data-sf-crumbs]');
    crumbs.hidden = source !== 'drive' || !config;
    crumbs.innerHTML = '<span class="sf-crumb-icon" aria-hidden="true">' + icon('folder') + '</span>' + stack.map((folder,index) => '<button class="sf-crumb" type="button" data-sf-crumb="' + index + '"' + (index === stack.length - 1 ? ' aria-current="page"' : '') + '>' + escape(folder.name) + '</button>').join('<span class="sf-crumb-sep" aria-hidden="true">›</span>');
    const driveLink = host.querySelector('[data-sf-drive-link]');
    driveLink.hidden = source !== 'drive' || !config;
    if (config) driveLink.href = 'https://drive.google.com/drive/folders/' + encodeURIComponent(stack.at(-1)?.id || config.folderId);
    const notice = host.querySelector('[data-sf-notice]');
    notice.textContent = source === 'drive' ? driveError : errorText;
    notice.hidden = !notice.textContent;
    const rows = visible();
    const pages = Math.max(1,Math.ceil(rows.length / pageSize));
    page = Math.min(page,pages);
    const folderCount = rows.filter(file => SharedFormsStore.kind(file) === 'folder').length;
    host.querySelector('[data-sf-count]').textContent = (source === 'drive' && loading) ? 'Đang tải…' : (rows.length - folderCount) + ' biểu mẫu' + (folderCount ? ' · ' + folderCount + ' thư mục' : '');
    const catalogNote = host.querySelector('[data-sf-catalog-note]');
    const catalogAt = driveFiles.find(file => file.catalogAt)?.catalogAt;
    catalogNote.hidden = source !== 'drive' || !!config?.apiKey || !catalogAt;
    catalogNote.textContent = catalogAt ? 'Danh mục kho Drive cập nhật ' + new Date(catalogAt).toLocaleDateString('vi-VN') + '. Kết nối Drive bằng API key để đồng bộ trực tiếp khi thư mục thay đổi.' : '';
    const list = host.querySelector('[data-sf-list]');
    list.setAttribute('aria-busy',String(source === 'drive' && loading));
    if (source === 'drive' && !config) list.innerHTML = '<div class="sf-empty"><span class="sf-file-icon">' + icon('folder') + '</span><h3>Kết nối kho biểu mẫu hiện có</h3><p>Thiết lập cùng thư mục Google Drive của dự án tra cứu phụ tùng để xem các biểu mẫu tại đây.</p>' + (SharedFormsStore.admin() ? '<button class="sf-button sf-primary" type="button" data-sf-settings>Kết nối Google Drive</button>' : '<p>Vui lòng liên hệ quản trị viên để kết nối thư mục.</p>') + '</div>';
    else if (source === 'drive' && loading) list.innerHTML = '<div class="sf-empty" role="status">Đang tải biểu mẫu từ Google Drive…</div>';
    else if (!rows.length) list.innerHTML = '<div class="sf-empty"><h3>' + (query || filter !== 'all' || category ? 'Không tìm thấy biểu mẫu' : 'Thư mục đang trống') + '</h3><p>' + (driveError ? 'Nhấn Làm mới để thử lại.' : 'Thử đổi từ khóa, bộ lọc hoặc tải file mới lên thư viện.') + '</p></div>';
    else if (layout === 'cards') list.innerHTML = '<div class="sf-tiles">' + rows.slice((page - 1) * pageSize,page * pageSize).map(tile).join('') + '</div>';
    else list.innerHTML = '<div class="sf-table-scroll"><table class="sf-table"><caption class="sf-sr-only">Danh sách biểu mẫu dùng chung</caption><thead><tr><th class="sf-col-number">STT</th><th class="sf-col-name">Tên biểu mẫu</th><th class="sf-col-format">Định dạng</th><th class="sf-col-category">Phân loại</th><th class="sf-col-date">Cập nhật</th><th class="sf-col-actions">Thao tác</th></tr></thead><tbody>' + rows.slice((page - 1) * pageSize,page * pageSize).map((file,index) => card(file,(page - 1) * pageSize + index + 1)).join('') + '</tbody></table></div>';
    host.querySelector('[data-sf-pagination]').hidden = !rows.length;
    host.querySelector('[data-sf-page-status]').textContent = 'Trang ' + page + ' / ' + pages + ' · ' + rows.length + ' mục';
    host.querySelector('[data-sf-prev]').disabled = page === 1;
    host.querySelector('[data-sf-next]').disabled = page === pages;
    host.querySelectorAll('[data-sf-layout]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.sfLayout === layout)));
    host.querySelector('[data-sf-type]').value = filter;
    host.querySelector('[data-sf-size]').value = String(pageSize);
    SharedFormsControls.enhance(host);
  }
  function openFile(file) {
    SharedFormsViewer.close();
    selectedFileId = file.id;
    paint();
    SharedFormsViewer.open(file,config,{onClose:() => {
      if (!host) return;
      selectedFileId = ''; paint();
      host.querySelector('[data-sf-open="' + CSS.escape(file.id) + '"]')?.focus({preventScroll:true});
    }});
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
    layout = readLayout();
    host = document.createElement('section');
    host.className = 'sf-workspace';
    host.setAttribute('aria-label','Biểu mẫu dùng chung');
    // Bố cục: đầu trang (tiêu đề + thao tác) → một thẻ thư viện duy nhất (nguồn, lọc, đường dẫn, bảng, phân trang).
    // Bỏ khối thống kê 4 thẻ; số lượng hiển thị gọn trong thanh nguồn (data-sf-count).
    host.innerHTML = `
      <header class="sf-page-head">
        <div class="sf-page-title"><span class="sf-page-emblem" aria-hidden="true">${icon('file')}</span><div><div class="sf-eyebrow">THƯ VIỆN NGHIỆP VỤ · TASCO DLK</div><h1>Biểu mẫu dùng chung</h1><p>Tra cứu, xem và in biểu mẫu nghiệp vụ trong cùng một nơi.</p></div></div>
        <div class="sf-toolbar"><button type="button" class="sf-icon-button sf-bordered" data-sf-refresh aria-label="Làm mới" title="Làm mới danh sách">${icon('refresh')}</button>${SharedFormsStore.admin() ? '<button type="button" class="sf-button" data-sf-settings>' + icon('folder') + ' Kết nối Drive</button>' : ''}<button type="button" class="sf-button sf-primary" data-sf-upload>${icon('upload')} Tải biểu mẫu lên</button></div>
      </header>
      <section class="sf-library">
        <div class="sf-library-bar">
          <div class="sf-sources" role="group" aria-label="Nguồn biểu mẫu"><button class="sf-source-tab" type="button" data-sf-source="drive">${icon('folder')} Kho Google Drive</button><button class="sf-source-tab" type="button" data-sf-source="app">${icon('grid')} Thư viện ứng dụng</button><span class="sf-count" data-sf-count role="status" aria-live="polite"></span><a class="sf-drive-link" data-sf-drive-link target="_blank" rel="noopener noreferrer" hidden>Quản lý kho gốc ↗</a></div>
        </div>
        <div class="sf-library-filters">
          <div class="sf-view-toggle" role="group" aria-label="Kiểu hiển thị"><button type="button" class="sf-view-option" data-sf-layout="list" aria-label="Xem dạng danh sách" title="Danh sách">${icon('sort')}</button><button type="button" class="sf-view-option" data-sf-layout="cards" aria-label="Xem dạng thẻ" title="Thẻ">${icon('grid')}</button></div>
          <div class="sf-controls">
            <label class="sf-search">${icon('search')}<span class="sf-sr-only">Tìm biểu mẫu</span><input type="search" data-sf-search placeholder="Tìm tên biểu mẫu, ghi chú…" autocomplete="off"></label>
            <label class="sf-filter-field"><span class="sf-sr-only">Loại tài liệu</span><select data-sf-type data-sf-select data-sf-label="Loại tài liệu" data-sf-description="Lọc theo định dạng biểu mẫu" data-sf-icon="file">${Object.entries(labels).map(([kind,label]) => '<option value="' + kind + '">' + label + '</option>').join('')}</select></label>
            <label class="sf-filter-field"><span class="sf-sr-only">Phân loại</span><select data-sf-category data-sf-select data-sf-label="Phân loại" data-sf-description="Chọn nhóm biểu mẫu cần sử dụng" data-sf-icon="tag"><option value="">Mọi phân loại</option></select></label>
            <label class="sf-filter-field"><span class="sf-sr-only">Sắp xếp</span><select data-sf-sort data-sf-select data-sf-label="Sắp xếp" data-sf-description="Chọn thứ tự hiển thị tài liệu" data-sf-icon="sort"><option value="newest">Mới cập nhật</option><option value="name">Tên A → Z</option></select></label>
          </div>
        </div>
        <div class="sf-list-panel">
          <nav class="sf-crumbs" data-sf-crumbs aria-label="Đường dẫn thư mục" hidden></nav>
          <p class="sf-notice" data-sf-notice role="alert" hidden></p>
          <div class="sf-list" data-sf-list></div>
          <nav class="sf-pagination" data-sf-pagination aria-label="Phân trang biểu mẫu" hidden>
              <label><span class="sf-sr-only">Số dòng mỗi trang</span><select data-sf-size data-sf-select data-sf-label="Số dòng mỗi trang" data-sf-description="Điều chỉnh số biểu mẫu trong danh sách" data-sf-icon="grid"><option value="12">12 mục / trang</option><option value="24">24 mục / trang</option><option value="48">48 mục / trang</option></select></label>
              <span data-sf-page-status></span><div><button class="sf-icon-button" type="button" data-sf-prev aria-label="Trang trước">←</button><button class="sf-icon-button" type="button" data-sf-next aria-label="Trang sau">→</button></div>
            </nav>
        </div>
        <footer class="sf-library-footer"><p class="sf-note">${icon('shield')} Bạn có thể sửa hoặc xóa file do mình tải lên. Quản trị viên quản lý toàn bộ thư viện.</p><p class="sf-catalog-note" data-sf-catalog-note hidden></p></footer>
      </section>`;
    container.replaceChildren(host);
    host.querySelector('[data-sf-search]').value = query;
    host.querySelector('[data-sf-sort]').value = sort;
    host.addEventListener('input',event => { if (event.target.matches('[data-sf-search]')) { query = event.target.value; page = 1; paint(); } });
    host.addEventListener('change',event => {
      if (event.target.matches('[data-sf-category]')) category = event.target.value;
      else if (event.target.matches('[data-sf-sort]')) sort = event.target.value;
      else if (event.target.matches('[data-sf-type]')) filter = event.target.value;
      else if (event.target.matches('[data-sf-size]')) pageSize = Number(event.target.value);
      else return;
      page = 1; paint();
    });
    host.addEventListener('click',event => {
      const control = event.target.closest('button');
      if (!control) return;
      if (control.hasAttribute('data-sf-upload')) uploadDialog();
      else if (control.hasAttribute('data-sf-settings')) settingsDialog();
      else if (control.hasAttribute('data-sf-refresh')) { unsubscribe?.(); connect(); reload(); }
      else if (control.dataset.sfSource) selectSource(control.dataset.sfSource);
      else if (control.dataset.sfLayout) { layout = control.dataset.sfLayout; try { localStorage.setItem('shared-forms-layout',layout); } catch (_) {} paint(); }
      else if (control.dataset.sfFilter) { filter = control.dataset.sfFilter; page = 1; paint(); }
      else if (control.hasAttribute('data-sf-crumb')) { SharedFormsViewer.close(); stack = stack.slice(0,Number(control.dataset.sfCrumb) + 1); query = ''; host.querySelector('[data-sf-search]').value = ''; loadFolder(); }
      else if (control.dataset.sfOpen) {
        const file = findFile(control.dataset.sfOpen);
        if (!file) return;
        if (SharedFormsStore.kind(file) === 'folder') { SharedFormsViewer.close(); stack.push({id:file.id,name:file.name}); query = ''; host.querySelector('[data-sf-search]').value = ''; loadFolder(); }
        else openFile(file);
      }
      else if (control.dataset.sfDownload) { const file = findFile(control.dataset.sfDownload); if (file) SharedFormsViewer.download(file); }
      else if (control.dataset.sfEdit) editDialog(findFile(control.dataset.sfEdit));
      else if (control.dataset.sfDelete) removeFile(findFile(control.dataset.sfDelete));
      else if (control.matches('[data-sf-prev],[data-sf-next]')) {
        page += control.hasAttribute('data-sf-next') ? 1 : -1;
        paint();
        window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
      }
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
