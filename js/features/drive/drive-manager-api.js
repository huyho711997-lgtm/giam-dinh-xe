// ==========================================================================
// GOOGLE DRIVE – lớp gọi dịch vụ Apps Script (DriveManager.gs) + các hàm thuần dùng chung.
// Mọi request gửi Firebase ID token; máy chủ kiểm tra UID trong DRIVE_MANAGER_UIDS.
// Content-Type text/plain để tránh preflight CORS với Apps Script.
// ==========================================================================
const DriveManagerApi = (() => {
  const FOLDER_MIME = 'application/vnd.google-apps.folder';
  const UPLOAD_MAX = 10 * 1024 * 1024;
  const TIMEOUTS = {drive_about:30000, drive_list:45000, drive_folders:45000, drive_upload:180000, drive_update_content:180000, drive_download:180000, drive_thumbnails:60000, drive_move:120000, drive_trash:120000, drive_restore:120000, drive_delete:120000, drive_empty_trash:120000};
  const OUTDATED = 'Thao tác không hợp lệ.';
  // Thao tác CHỈ ĐỌC tự thử lại khi gặp lỗi tạm thời (Apps Script khởi động nguội, quá tải, mạng chập).
  // Thao tác ghi (tải lên, di chuyển, xóa…) KHÔNG thử lại để tránh làm trùng hoặc thao tác hai lần.
  const RETRY_ATTEMPTS = {drive_about:3, drive_list:3, drive_folders:3, drive_thumbnails:2, drive_download:2};
  const RETRY_DELAYS = [700, 1800];
  const TRANSIENT_MESSAGE = /rate limit|backend error|too many times|service invoked|internal error|timed out|timeout|try again|temporarily|unavailable|quá tải|tạm thời/i;
  const transient = error => Object.assign(error, {transient:true});
  const abortError = () => Object.assign(new Error('Aborted'), {name:'AbortError'});
  function wait(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal && signal.aborted) { reject(abortError()); return; }
      const onAbort = () => { clearTimeout(timer); reject(abortError()); };
      const timer = setTimeout(() => { if (signal) signal.removeEventListener('abort', onAbort); resolve(); }, ms);
      if (signal) signal.addEventListener('abort', onAbort, {once:true});
    });
  }

  const endpoint = () => typeof CONFIG === 'undefined' ? '' : String(CONFIG.CLAIM_DOCUMENTS_ENDPOINT || '').trim();
  const currentUser = () => typeof firebase !== 'undefined' ? firebase.auth().currentUser : null;

  // ---- Bộ nhớ ảnh lâu dài (Cache Storage): mở lại ảnh / thư mục là có ngay, không gọi Apps Script ----------
  const STORE_NAME = 'tasco-drive-media-v1', STORE_LIMIT = {img:80, thumb:600}, STORE_TTL = 7 * 24 * 3600 * 1000, STORE_MAX_BYTES = 12 * 1024 * 1024;
  let storeWrites = 0;
  const storeKey = (kind, file, variant) => 'https://drive-cache.invalid/' + kind + '/' + encodeURIComponent(file.id) + '/' + encodeURIComponent(file.modifiedTime || '') + (variant ? '/' + variant : '');
  async function storeOpen() { try { return typeof caches !== 'undefined' && caches.open ? await caches.open(STORE_NAME) : null; } catch (_) { return null; } }
  async function storeGet(key) {
    const store = await storeOpen();
    if (!store) return null;
    try {
      const hit = await store.match(key);
      if (!hit) return null;
      if (Date.now() - Number(hit.headers.get('X-Stored-At') || 0) > STORE_TTL) { store.delete(key); return null; }
      return {bytes:new Uint8Array(await hit.arrayBuffer()), mimeType:hit.headers.get('Content-Type') || '', resized:hit.headers.get('X-Resized') === '1', originalSize:Number(hit.headers.get('X-Original-Size') || 0)};
    } catch (_) { return null; }
  }
  // Ghi nền: lỗi hoặc hết dung lượng thì bỏ qua, không ảnh hưởng việc xem ảnh.
  async function storePut(key, data, kind) {
    try {
      const store = await storeOpen();
      if (!store || !data || !data.bytes || !data.bytes.byteLength || data.bytes.byteLength > STORE_MAX_BYTES) return;
      await store.put(key, new Response(data.bytes, {headers:{'Content-Type':data.mimeType || 'image/jpeg', 'X-Stored-At':String(Date.now()), 'X-Resized':data.resized ? '1' : '0', 'X-Original-Size':String(data.originalSize || 0)}}));
      if (++storeWrites % 8 === 0) {
        const marker = '//drive-cache.invalid/' + kind + '/', keys = (await store.keys()).filter(request => request.url.includes(marker));
        for (const request of keys.slice(0, Math.max(0, keys.length - STORE_LIMIT[kind]))) await store.delete(request);
      }
    } catch (_) {}
  }
  async function clearStore() { try { if (typeof caches !== 'undefined') await caches.delete(STORE_NAME); } catch (_) {} }

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
    if (Number(file.size || 0) > 20 * 1024 * 1024) return false;
    // .doc / .ppt / .pptx được máy chủ đổi sang PDF để xem; chỉ nhận đúng các đuôi này cho nhóm trình chiếu (.odp… chưa hỗ trợ).
    if (kindOf(file) === 'slide') return /\.(ppt|pptx)$/i.test(file.name || '') || /ms-powerpoint|presentationml/.test(mime);
    return ['pdf', 'word', 'sheet', 'image', 'text', 'video', 'audio'].includes(kindOf(file));
  }
  // Tệp cần máy chủ đổi sang PDF mới xem được trong ứng dụng.
  function needsConversion(file) {
    return !isNative(file) && (/\.(doc|ppt|pptx)$/i.test(file && file.name || '') || /^application\/(msword|vnd\.ms-powerpoint|vnd\.openxmlformats-officedocument\.presentationml\.presentation)$/.test(String(file && file.mimeType || '')));
  }
  // Bộ xem dành cho từng loại tệp: 'image' | 'video' | 'audio' | 'sheet' | 'text' → DriveViewer;
  // 'document' (PDF, Word, tệp Google xuất PDF) → trình xem tài liệu có dàn trang và in; '' = không xem được trong ứng dụng.
  function viewerKind(file) {
    if (!canPreview(file)) return '';
    if (isNative(file)) return 'document';
    const kind = kindOf(file);
    return ['image', 'video', 'audio', 'sheet', 'text'].includes(kind) ? kind : 'document';
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
  async function callOnce(action, payload = {}, signal) {
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
      if (error && error.name === 'TimeoutError') throw transient(new Error('Google Drive phản hồi quá lâu. Vui lòng thử lại.'));
      throw transient(new Error('Không kết nối được dịch vụ Google Drive. Kiểm tra mạng rồi thử lại.'));
    }
    let result;
    // Google trả trang HTML lỗi (quá tải / hạn mức) thay vì JSON → coi là lỗi tạm thời.
    try { result = await response.json(); } catch (_) { throw transient(new Error('Dịch vụ Google Drive trả về dữ liệu không hợp lệ.')); }
    if (result && result.error === OUTDATED) throw new Error('Dịch vụ Apps Script chưa có tính năng quản lý Google Drive. Quản trị viên cần thêm DriveManager.gs, bật Drive API và Deploy phiên bản mới (xem google-apps-script/claim-documents/README.md).');
    if (!response.ok || !result || !result.ok) {
      const failure = new Error((result && result.error) || 'Google Drive chưa xử lý được yêu cầu.');
      if (response.status === 429 || response.status >= 500 || TRANSIENT_MESSAGE.test(failure.message)) transient(failure);
      throw failure;
    }
    if (currentUser() && currentUser().uid !== user.uid) throw new Error('Phiên đăng nhập đã thay đổi.');
    return result;
  }
  async function call(action, payload = {}, signal) {
    const attempts = RETRY_ATTEMPTS[action] || 1;
    for (let attempt = 1; ; attempt++) {
      try { return await callOnce(action, payload, signal); }
      catch (error) {
        if (attempt >= attempts || !error || !error.transient || (signal && signal.aborted)) throw error;
        await wait(RETRY_DELAYS[attempt - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1], signal);
      }
    }
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
    // Ghi đè nội dung tệp .docx đã có. Không tự thử lại (ghi nhiều lần có thể trùng/đè); expectedModifiedTime để máy chủ phát hiện xung đột.
    async updateContent(fileId, bytes, expectedModifiedTime, signal) {
      const size = bytes && (bytes.byteLength ?? bytes.size) || 0;
      if (!size) throw new Error('Tệp đang trống.');
      if (size > UPLOAD_MAX) throw new Error('Tệp sau khi sửa lớn hơn 10 MB nên không ghi đè được.');
      const data = await base64(bytes instanceof Blob ? bytes : new File([bytes], 'edited.docx'));
      return call('drive_update_content', {fileId, expectedModifiedTime:expectedModifiedTime || '', data}, signal);
    },
    // Trả về {name, mimeType, bytes:Uint8Array}
    // mode: 'docx' (.doc → .docx để chỉnh sửa) | 'download' (ảnh gốc) | 'preview' (gốc / PDF cho tài liệu) | 'display' (ảnh nặng → bản thu nhỏ để mở nhanh)
    async download(fileId, mode, signal) {
      const result = await call('drive_download', {fileId, mode:mode === 'preview' || mode === 'display' || mode === 'docx' ? mode : 'download'}, signal);
      return {name:result.name, mimeType:result.mimeType, originalMimeType:result.originalMimeType || '', serverVersion:result.serverVersion || '', bytes:decode(result.data), resized:!!result.resized, originalSize:Number(result.originalSize || 0)};
    },
    // Ảnh xem nhanh: ưu tiên bộ nhớ trình duyệt (còn nguyên sau khi tải lại trang), chưa có mới hỏi máy chủ.
    async previewImage(file, options = {}) {
      const full = !!options.full, key = storeKey('img', file, full ? 'full' : 'fit');
      const hit = await storeGet(key);
      if (hit) return hit;
      const result = await api.download(file.id, full ? 'preview' : 'display', options.signal);
      storePut(key, result, 'img');
      return result;
    },
    async cachedThumbnail(file) {
      const hit = await storeGet(storeKey('thumb', file, ''));
      return hit && hit.bytes.byteLength ? hit : null;
    },
    storeThumbnail: (file, data) => storePut(storeKey('thumb', file, ''), data, 'thumb'),
    clearStore
  };

  return {...api, call, endpoint, storeKey, RETRY_ATTEMPTS, formatBytes, formatDate, formatDateTime, kindOf, typeLabel, canPreview, needsConversion, viewerKind, isNative, validateName, quotaSummary, sortFiles, requestId, FOLDER_MIME, UPLOAD_MAX, KIND_LABELS};
})();
