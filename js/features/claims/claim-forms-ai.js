// Tab "Biểu mẫu AI" trong cửa sổ hồ sơ bồi thường: tự dùng hồ sơ đang mở, chọn biểu mẫu Word rồi ra lệnh cho AI.
const ClaimFormsAI = (() => {
  let composer = null, host = null, library = null, drive = null;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
  const isDocx = file => SharedFormsStore.extension(file.originalName || file.name) === 'docx' && !String(file.mimeType).startsWith('application/vnd.google-apps.');

  function openRecord() {
    const id = typeof editingPendingClaimId !== 'undefined' ? editingPendingClaimId : null;
    const record = id && typeof cachedPendingClaimsPayload !== 'undefined' ? cachedPendingClaimsPayload?.[id] : null;
    if (!record) return null;
    return {key: 'pending:' + id, label: [record.bienSo, record.khachHang, record.soHoSoBoiThuong].filter(Boolean).join(' · ') || id, record};
  }

  async function loadLibrary() {
    const items = SharedFormsStore.builtins();
    try {
      const uploaded = Object.entries((await dbNodeInstance.ref('shared_forms/files').once('value')).val() || {}).map(([id, file]) => ({...file, id, source: 'upload'}));
      items.push(...uploaded);
    } catch (_) { /* chưa đọc được file người dùng tải lên: vẫn dùng biểu mẫu hệ thống */ }
    return items.filter(isDocx);
  }

  function mount() {
    const pane = document.getElementById('tabPane_FormsAI');
    if (!pane || host) return;
    host = pane;
    pane.innerHTML = '<div class="cem-intro"><h3>Soạn biểu mẫu bằng AI</h3><p>Chọn biểu mẫu Word, ra lệnh bằng tiếng Việt — AI điền hoặc chỉnh biểu mẫu theo hồ sơ đang mở. Bạn duyệt từng thay đổi rồi mới tải về.</p></div>'
      + '<div class="sf-ai-claim"><div class="sf-ai-picker"><label class="sf-field"><span class="sf-field-label">Nguồn biểu mẫu</span><select data-fai-source><option value="library">Thư viện ứng dụng</option><option value="drive">Kho Google Drive</option></select></label>'
      + '<label class="sf-field"><span class="sf-field-label">Biểu mẫu (.docx)</span><select data-fai-file></select></label></div><p class="sf-feedback" data-fai-note></p><div data-fai-composer></div></div>';
    composer = SharedFormsAI.createComposer({});
    pane.querySelector('[data-fai-composer]').appendChild(composer.element);
    pane.querySelector('[data-fai-source]').onchange = event => { event.target.value === 'drive' ? showDrive() : showLibrary(); };
    pane.querySelector('[data-fai-file]').onchange = onPick;
  }

  const fileSelect = () => host.querySelector('[data-fai-file]');
  const note = (text, bad) => { const box = host.querySelector('[data-fai-note]'); box.textContent = text || ''; box.classList.toggle('is-error', !!bad); };
  const fill = (options, placeholder) => { fileSelect().innerHTML = '<option value="">' + placeholder + '</option>' + options; };
  const choose = (file, loadBytes) => composer.setFile(file, loadBytes);

  async function showLibrary() {
    note(''); choose(null, null); fill('', 'Đang tải…');
    try {
      library = await loadLibrary();
      fill(library.map(file => '<option value="lib:' + escapeHtml(file.id) + '">' + escapeHtml(file.name) + '</option>').join(''), library.length ? '— Chọn biểu mẫu —' : 'Chưa có biểu mẫu Word');
    } catch (error) { fill('', 'Không tải được'); note(error.message, true); }
  }

  // Kho Drive: duyệt thư mục bằng chính danh sách chọn (thư mục bắt đầu bằng 📁, "↰" để quay lại).
  async function showDrive(folder) {
    note(''); choose(null, null); fill('', 'Đang tải…');
    try {
      drive = drive || {config: await SharedFormsStore.loadDriveConfig(), stack: []};
      if (!drive.config) { fill('', 'Chưa kết nối kho Drive'); note('Kho Google Drive chưa được thiết lập. Hãy dùng Thư viện ứng dụng hoặc nhờ quản trị viên kết nối Drive.', true); return; }
      if (folder) drive.stack.push(folder); else if (!drive.stack.length) drive.stack = [{id: drive.config.folderId, name: drive.config.folderName}];
      drive.files = await SharedFormsStore.listDrive(drive.stack.at(-1).id, drive.config);
      const folders = drive.files.filter(file => SharedFormsStore.kind(file) === 'folder'), docs = drive.files.filter(isDocx);
      fill((drive.stack.length > 1 ? '<option value="up">↰ Quay lại</option>' : '')
        + folders.map(file => '<option value="dir:' + escapeHtml(file.id) + '">📁 ' + escapeHtml(file.name) + '</option>').join('')
        + docs.map(file => '<option value="drv:' + escapeHtml(file.id) + '">' + escapeHtml(file.name) + '</option>').join(''),
        '— ' + drive.stack.map(item => item.name).join(' / ') + ' —');
      if (!folders.length && !docs.length) note('Thư mục này không có file Word (.docx).');
    } catch (error) { fill('', 'Không tải được'); note(error.message || 'Không đọc được kho Drive.', true); }
  }

  function onPick(event) {
    const value = event.target.value;
    if (value === 'up') { drive.stack.pop(); const parent = drive.stack.pop(); showDrive(parent); return; }
    if (value.startsWith('dir:')) { showDrive(drive.files.find(file => 'dir:' + file.id === value) && {id: value.slice(4), name: drive.files.find(file => file.id === value.slice(4)).name}); return; }
    if (value.startsWith('lib:')) {
      const file = library.find(item => 'lib:' + item.id === value);
      choose(file, async () => { const response = await fetch(SharedFormsStore.safeUrl(file.url)); if (!response.ok) throw new Error('Không tải được biểu mẫu.'); return response.arrayBuffer(); });
    } else if (value.startsWith('drv:')) {
      const file = drive.files.find(item => 'drv:' + item.id === value);
      choose(file, () => SharedFormsViewer.bytes(file, drive.config));
    } else choose(null, null);
  }

  // Gọi mỗi lần mở tab: cập nhật hồ sơ đang mở; lần đầu mới nạp thư viện.
  function render() {
    mount();
    if (!host) return;
    composer.setRecord(openRecord());
    if (!library && host.querySelector('[data-fai-source]').value === 'library') showLibrary();
  }

  return {render};
})();
