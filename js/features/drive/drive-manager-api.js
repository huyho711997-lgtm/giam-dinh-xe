// ==========================================================================
// GOOGLE DRIVE – lớp gọi dịch vụ Apps Script (DriveManager.gs) + các hàm thuần dùng chung.
// Mọi request gửi Firebase ID token; máy chủ kiểm tra UID trong DRIVE_MANAGER_UIDS.
// Content-Type text/plain để tránh preflight CORS với Apps Script.
// ==========================================================================
const DriveManagerApi = (() => {
  const FOLDER_MIME = 'application/vnd.google-apps.folder';
  const UPLOAD_MAX = 10 * 1024 * 1024;
  const TIMEOUTS = {drive_upload:180000, drive_download:180000, drive_thumbnails:60000, drive_move:120000, drive_trash:120000, drive_restore:120000, drive_delete:120000, drive_empty_trash:120000};
  const OUTDATED = 'Thao tác không hợp lệ.';

  const endpoint = () => typeof CONFIG === 'undefined' ? '' : String(CONFIG.CLAIM_DOCUMENTS_ENDPOINT || '').trim();
  const currentUser = () => typeof firebase !== 'undefined' ? firebase.auth().currentUser : null;

  // ---- Hàm thuần (không phụ thuộc DOM / mạng) ---------------------------------------------
  function formatBytes(value) {
    const size = Number(value) || 0;
    if (size <= 0) return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(units.length - 1, Math.floor(Math.log(size) / Math.log(1024)));
    const amount = size / Math.pow(1024, index);
    return (index === 0 ? String(amount) : amount.toFixed(amount >= 100 ? 0 : amount >= 10 ? 1 : 2).replace(/\.?0+$/, '')).replace('.', ',') + ' ' + units[index];
  }
  // Nhóm loại tệp để chọn biểu tượng / màu.
  function kindOf(file) {
    const mime = String(file && file.mimeType || '');
    const ext = String(file && file.name || '').split('.').pop().toLowerCase();
    if (mime === FOLDER_MIME) return 'folder';
    if (mime === 'application/vnd.google-apps.shortcut') return 'shortcut';
    if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
    if (mime === 'application/vnd.google-apps.document' || /wordprocessingml|msword|rtf/.test(mime) || ['doc', 'docx', 'rtf', 'odt'].includes(ext)) return 'word';
    if (mime === 'application/vnd.google-apps.spreadsheet' || /spreadsheetml|ms-excel|text\/csv/.test(mime) || ['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'sheet';
    if (mime === 'application/vnd.google-apps.presentation' || /presentationml|ms-powerpoint/.test(mime) || ['ppt', 'pptx', 'odp'].includes(ext)) return 'slide';
    if (/^image\//.test(mime) || mime === 'application/vnd.google-apps.drawing') return 'image';
    if (/^video\//.test(mime)) return 'video';
    if (/^audio\//.test(mime)) return 'audio';
    if (/zip|rar|7z|tar|gzip/.test(mime) || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
    if (/^text\//.test(mime) || ['txt', 'md', 'json'].includes(ext)) return 'text';
    return 'other';
  }
  const KIND_LABELS = {folder:'Thư mục', shortcut:'Lối tắt', pdf:'PDF', word:'Tài liệu', sheet:'Bảng tính', slide:'Trình chiếu', image:'Hình ảnh', video:'Video', audio:'Âm thanh', archive:'Tệp nén', text:'Văn bản', other:'Tệp'};
  function typeLabel(file) {
    const mime = String(file && file.mimeType || '');
    if (mime.indexOf('application/vnd.google-apps.') === 0 && mime !== FOLDER_MIME) {
      const native = {document:'Google Tài liệu', spreadsheet:'Google Trang tính', presentation:'Google Trang trình bày', drawing:'Google Bản vẽ', form:'Google Biểu mẫu', shortcut:'Lối tắt', site:'Google Sites', map:'Google My Maps'};
      return native[mime.split('.').pop()] || 'Tệp Google';
    }
    const ext = String(file && file.name || '').includes('.') ? String(file.name).split('.').pop().toUpperCase() : '';
    const label = KIND_LABELS[kindOf(file)];
    return ext && kindOf(file) !== 'folder' && ext.length <= 5 && ext !== label.toUpperCase() ? label + ' · ' + ext : label;
  }
  // Có xem được trong ứng dụng không (trình xem chung SharedFormsViewer).
  function canPreview(file) {
    const mime = String(file && file.mimeType || '');
    if (['application/vnd.google-apps.document', 'application/vnd.google-apps.spreadsheet', 'application/vnd.google-apps.presentation', 'application/vnd.google-apps.drawing'].includes(mime)) return true;
    return ['pdf', 'word', 'sheet', 'image', 'text'].includes(kindOf(file)) && Number(file.size || 0) <= 20 * 1024 * 1024 && !/\.(doc|ppt|pptx)$/i.test(file.name || '');
  }
  const isNative = file => String(file && file.mimeType || '').indexOf('application/vnd.google-apps.') === 0;
  // Ngày giờ ngắn kiểu Drive: hôm nay → giờ; năm nay → ngày tháng; khác → dd/mm/yyyy.
  function formatDate(value, now = new Date()) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const pad = n => String(n).padStart(2, '0');
    if (date.toDateString() === now.toDateString()) return pad(date.getHours()) + ':' + pad(date.getMinutes());
    if (date.getFullYear() === now.getFullYear()) return pad(date.getDate()) + ' thg ' + (date.getMonth() + 1);
    return pad(date.getDate()) + '/' + pad(date.getMonth() + 1) + '/' + date.getFullYear();
  }
  function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const pad = n => String(n).padStart(2, '0');
    return pad(date.getHours()) + ':' + pad(date.getMinutes()) + ' · ' + pad(date.getDate()) + '/' + pad(date.getMonth() + 1) + '/' + date.getFullYear();
  }
  // Kiểm tra tên trước khi gửi (máy chủ vẫn kiểm tra lại).
  function validateName(value) {
    const name = String(value || '').replace(/[\x00-\x1f\x7f]/g, '').trim();
    if (!name) throw new Error('Vui lòng nhập tên.');
    if (name === '.' || name === '..') throw new Error('Tên không hợp lệ.');
    if (name.length > 240) throw new Error('Tên tối đa 240 ký tự.');
    return name;
  }
  function quotaSummary(quota) {
    const limit = Number(quota && quota.limit) || 0, usage = Number(quota && quota.usage) || 0;
    const percent = limit ? Math.min(100, Math.round(usage / limit * 1000) / 10) : 0;
    return {limit, usage, percent, unlimited:!limit, level:percent >= 90 ? 'critical' : percent >= 75 ? 'warning' : 'ok'};
  }
  // Sắp xếp phía client cho danh sách đã tải (giữ thư mục lên đầu như Drive).
  function sortFiles(files, sort) {
    const collator = new Intl.Collator('vi', {numeric:true, sensitivity:'base'});
    const folderFirst = (a, b) => (b.mimeType === FOLDER_MIME) - (a.mimeType === FOLDER_MIME);
    const time = item => new Date(item.modifiedTime || 0).getTime() || 0;
    const compare = {
      name_asc: (a, b) => folderFirst(a, b) || collator.compare(a.name, b.name),
      name_desc: (a, b) => folderFirst(a, b) || collator.compare(b.name, a.name),
      modified_desc: (a, b) => folderFirst(a, b) || time(b) - time(a),
      modified_asc: (a, b) => folderFirst(a, b) || time(a) - time(b),
      size_desc: (a, b) => (Number(b.size) || 0) - (Number(a.size) || 0)
    }[sort];
    return compare ? files.slice().sort(compare) : files.slice();
  }
  function requestId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + '-' + Math.random().toString(36).slice(2);
  }

  // ---- Gọi dịch vụ ---------------------------------------------------------------------
  async function call(action, payload = {}, signal) {
    if (!endpoint()) throw new Error('Chưa cấu hình dịch vụ Google Drive (CLAIM_DOCUMENTS_ENDPOINT).');
    const user = currentUser();
    if (!user) throw new Error('Vui lòng đăng nhập để quản lý Google Drive.');
    const token = await user.getIdToken();
    const timeout = AbortSignal.timeout(TIMEOUTS[action] || 60000);
    const combined = signal && AbortSignal.any ? AbortSignal.any([signal, timeout]) : (signal || timeout);
    let response;
    try {
      response = await fetch(endpoint(), {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({...payload, action, token}), credentials:'omit', redirect:'follow', signal:combined});
    } catch (error) {
      if (signal && signal.aborted) throw error;
      if (error && error.name === 'TimeoutError') throw new Error('Google Drive phản hồi quá lâu. Vui lòng thử lại.');
      throw new Error('Không kết nối được dịch vụ Google Drive. Kiểm tra mạng rồi thử lại.');
    }
    let result;
    try { result = await response.json(); } catch (_) { throw new Error('Dịch vụ Google Drive trả về dữ liệu không hợp lệ.'); }
    if (result && result.error === OUTDATED) throw new Error('Dịch vụ Apps Script chưa có tính năng quản lý Google Drive. Quản trị viên cần thêm DriveManager.gs, bật Drive API và Deploy phiên bản mới (xem google-apps-script/claim-documents/README.md).');
    if (!response.ok || !result || !result.ok) throw new Error((result && result.error) || 'Google Drive chưa xử lý được yêu cầu.');
    if (currentUser() && currentUser().uid !== user.uid) throw new Error('Phiên đăng nhập đã thay đổi.');
    return result;
  }
  function base64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error('Không đọc được tệp "' + file.name + '".'));
      reader.readAsDataURL(file);
    });
  }
  function decode(data) {
    const binary = atob(data || '');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  const api = {
    about: signal => call('drive_about', {}, signal),
    list: (options, signal) => call('drive_list', options, signal),
    folders: (folderId, signal) => call('drive_folders', {folderId}, signal),
    createFolder: (parentId, name) => call('drive_create_folder', {parentId, name:validateName(name)}),
    rename: (fileId, name) => call('drive_rename', {fileId, name:validateName(name)}),
    move: (fileIds, targetId) => call('drive_move', {fileIds, targetId}),
    copy: fileId => call('drive_copy', {fileId}),
    star: (fileIds, starred) => call('drive_star', {fileIds, starred}),
    trash: fileIds => call('drive_trash', {fileIds}),
    restore: fileIds => call('drive_restore', {fileIds}),
    remove: fileIds => call('drive_delete', {fileIds}),
    emptyTrash: () => call('drive_empty_trash', {confirm:'EMPTY_TRASH'}),
    thumbnails: (fileIds, signal) => call('drive_thumbnails', {fileIds}, signal),
    async upload(file, parentId, id, signal) {
      if (!file || !file.size) throw new Error('Tệp "' + (file && file.name || '') + '" đang trống.');
      if (file.size > UPLOAD_MAX) throw new Error('"' + file.name + '" vượt 10 MB. Hãy tải trực tiếp lên Google Drive.');
      const data = await base64(file);
      return call('drive_upload', {parentId, name:file.name, mimeType:file.type || 'application/octet-stream', requestId:id || requestId(), data}, signal);
    },
    // Trả về {name, mimeType, bytes:Uint8Array}
    async download(fileId, mode, signal) {
      const result = await call('drive_download', {fileId, mode:mode === 'preview' ? 'preview' : 'download'}, signal);
      return {name:result.name, mimeType:result.mimeType, bytes:decode(result.data)};
    }
  };

  return {...api, call, endpoint, formatBytes, formatDate, formatDateTime, kindOf, typeLabel, canPreview, isNative, validateName, quotaSummary, sortFiles, requestId, FOLDER_MIME, UPLOAD_MAX, KIND_LABELS};
})();
