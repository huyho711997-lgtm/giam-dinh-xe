/* ==========================================================================
   QUẢN LÝ GOOGLE DRIVE (trang "Google Drive" trong ứng dụng)
   - Chạy dưới tài khoản sở hữu Drive (Deploy: Execute as Me) → thao tác trên TOÀN BỘ Drive của chủ tài khoản.
   - Chỉ UID trong Script Property DRIVE_MANAGER_UIDS được gọi (tách khỏi ALLOWED_UIDS của kho hồ sơ).
   - Client KHÔNG được gửi câu truy vấn Drive thô: mọi điều kiện q / orderBy / fields do máy chủ dựng từ danh sách trắng.
   - Thư mục hệ thống của ứng dụng (ROOT_FOLDER_ID, FORMS_ROOT_FOLDER_ID, Drive gốc) không thể đổi tên/di chuyển/xóa.
   - Cần bật Advanced Service "Drive API" v3 (userSymbol Drive) – xem appsscript.json.
   ========================================================================== */
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const DRIVE_UPLOAD_MAX = 10 * 1024 * 1024;     // giới hạn mỗi tệp tải lên (payload Apps Script)
const DRIVE_DOWNLOAD_MAX = 20 * 1024 * 1024;   // giới hạn tải về / xem trước qua dịch vụ
const DRIVE_BULK_LIMIT = 100;
const DRIVE_THUMB_LIMIT = 24;
const DRIVE_DISPLAY_EDGE = 2048;               // cạnh dài của ảnh xem nhanh (ảnh gốc vẫn tải được ở chế độ 'preview')
const DRIVE_DISPLAY_MIN_BYTES = 600 * 1024;    // ảnh nhỏ hơn mức này gửi nguyên bản, không cần thu nhỏ
const DRIVE_THUMB_EDGE = 320;
const DRIVE_ID_PATTERN = /^[\w-]{10,120}$/;
const DRIVE_FILE_FIELDS = 'id,name,mimeType,size,quotaBytesUsed,modifiedTime,createdTime,viewedByMeTime,starred,trashed,parents,webViewLink,hasThumbnail,shared,ownedByMe,description,owners(displayName,emailAddress),lastModifyingUser(displayName),capabilities(canEdit,canRename,canTrash,canDelete,canAddChildren,canDownload,canMoveItemWithinDrive,canUntrash)';
// Định dạng xuất khi TẢI VỀ tệp Google gốc (Docs/Sheets/Slides/Drawings). Xem trước luôn xuất PDF.
const DRIVE_EXPORTS = {
  'application/vnd.google-apps.document': {mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext:'docx'},
  'application/vnd.google-apps.spreadsheet': {mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext:'xlsx'},
  'application/vnd.google-apps.presentation': {mime:'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext:'pptx'},
  'application/vnd.google-apps.drawing': {mime:'application/pdf', ext:'pdf'}
};
// Bộ lọc loại tệp → điều kiện mimeType (máy chủ tự dựng, client chỉ gửi khóa).
const DRIVE_TYPE_FILTERS = {
  folder: ["mimeType = '" + DRIVE_FOLDER_MIME + "'"],
  document: ["mimeType = 'application/vnd.google-apps.document'", "mimeType = 'application/msword'", "mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'", "mimeType = 'text/plain'", "mimeType = 'application/rtf'"],
  sheet: ["mimeType = 'application/vnd.google-apps.spreadsheet'", "mimeType = 'application/vnd.ms-excel'", "mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'", "mimeType = 'text/csv'"],
  slide: ["mimeType = 'application/vnd.google-apps.presentation'", "mimeType = 'application/vnd.ms-powerpoint'", "mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'"],
  pdf: ["mimeType = 'application/pdf'"],
  image: ["mimeType contains 'image/'"],
  video: ["mimeType contains 'video/'"],
  audio: ["mimeType contains 'audio/'"],
  archive: ["mimeType = 'application/zip'", "mimeType = 'application/x-zip-compressed'", "mimeType = 'application/x-rar-compressed'", "mimeType = 'application/vnd.rar'", "mimeType = 'application/x-7z-compressed'"]
};
const DRIVE_SORTS = {
  name_asc: 'folder,name', name_desc: 'folder,name desc',
  modified_desc: 'folder,modifiedTime desc', modified_asc: 'folder,modifiedTime',
  size_desc: 'quotaBytesUsed desc'
};
const DRIVE_ACTIONS = ['drive_about','drive_list','drive_folders','drive_create_folder','drive_rename','drive_move','drive_copy','drive_star','drive_trash','drive_restore','drive_delete','drive_empty_trash','drive_upload','drive_update_content','drive_download','drive_thumbnails'];

// ---- Xác thực: Firebase ID token + UID nằm trong DRIVE_MANAGER_UIDS -----------------------------
function authorizeDriveManager_(request, props) {
  const key = props.getProperty('FIREBASE_API_KEY');
  const managers = (props.getProperty('DRIVE_MANAGER_UIDS') || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!key || !managers.length) throw new Error('Quản trị viên chưa bật quyền quản lý Google Drive (Script Property DRIVE_MANAGER_UIDS).');
  if (typeof request.token !== 'string' || !request.token || request.token.length > 10000) throw new Error('Yêu cầu không hợp lệ.');
  // Cache theo băm(token): token thu hồi/hết hạn vẫn bị chặn sau tối đa 5 phút; gỡ UID khỏi danh sách có hiệu lực ngay.
  const authKey = 'drive-auth:' + digest_(request.token);
  const cached = cacheGet_(authKey);
  if (cached && managers.includes(cached)) return {localId:cached};
  const result = fetchJson_('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(key), {method:'post',contentType:'application/json',payload:JSON.stringify({idToken:request.token})});
  const user = result.users && result.users[0];
  if (!user || user.disabled || !managers.includes(user.localId)) throw new Error('Tài khoản chưa được cấp quyền quản lý Google Drive.');
  cachePut_(authKey, user.localId, AUTH_CACHE_SECONDS);
  return {localId:user.localId};
}

// ---- Tiện ích ---------------------------------------------------------------------------------
function driveService_() {
  if (typeof Drive === 'undefined' || !Drive.Files) throw new Error('Chưa bật dịch vụ nâng cao Drive API (v3) trong Apps Script. Xem README để bật.');
  return Drive;
}
function driveId_(value, allowRoot) {
  const id = String(value || '').trim();
  if (allowRoot && id === 'root') return id;
  if (!DRIVE_ID_PATTERN.test(id)) throw new Error('Mã tệp/thư mục không hợp lệ.');
  return id;
}
function driveIds_(list) {
  if (!Array.isArray(list) || !list.length) throw new Error('Chưa chọn tệp nào.');
  if (list.length > DRIVE_BULK_LIMIT) throw new Error('Mỗi lần chỉ xử lý tối đa ' + DRIVE_BULK_LIMIT + ' mục.');
  return Array.from(new Set(list.map(id => driveId_(id, false))));
}
// Tên tệp: bỏ ký tự điều khiển, giới hạn độ dài. Drive cho phép "/" trong tên nhưng dễ gây nhầm → thay bằng "_".
function driveName_(value) {
  const name = String(value || '').replace(/[\x00-\x1f\x7f]/g, '').replace(/[\/\\]/g, '_').trim().slice(0, 240);
  if (!name || name === '.' || name === '..') throw new Error('Tên không hợp lệ.');
  return name;
}
// Thoát chuỗi trong câu truy vấn Drive: \ trước rồi tới '.
function driveQuote_(value) { return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }
function driveRootId_() {
  const hit = cacheGet_('drive-root-id');
  if (hit) return hit;
  const id = driveService_().Files.get('root', {fields:'id'}).id;
  cachePut_('drive-root-id', id, FOLDER_CACHE_SECONDS);
  return id;
}
// Thư mục hệ thống của ứng dụng: không cho đổi tên / di chuyển / xóa từ trang quản lý.
function driveProtectedIds_(props) {
  const ids = ['root', props.getProperty('ROOT_FOLDER_ID'), props.getProperty('FORMS_ROOT_FOLDER_ID')].filter(Boolean);
  try { ids.push(driveRootId_()); } catch (_) {}
  return ids;
}
function driveAssertMutable_(id, props) {
  if (driveProtectedIds_(props).includes(id)) throw new Error('Đây là thư mục hệ thống của ứng dụng, không thể đổi tên, di chuyển hoặc xóa.');
}
function driveRecord_(file, protectedIds) {
  const cap = file.capabilities || {};
  const owner = file.owners && file.owners[0];
  return {
    id:file.id, name:file.name, mimeType:file.mimeType,
    size:Number(file.size || file.quotaBytesUsed || 0),
    modifiedTime:file.modifiedTime || '', createdTime:file.createdTime || '', viewedTime:file.viewedByMeTime || '',
    starred:!!file.starred, trashed:!!file.trashed, shared:!!file.shared, ownedByMe:file.ownedByMe !== false,
    parents:file.parents || [], webViewLink:file.webViewLink || '', hasThumbnail:!!file.hasThumbnail,
    description:String(file.description || '').slice(0, 500),
    owner:owner ? (owner.displayName || owner.emailAddress || '') : '',
    lastModifiedBy:file.lastModifyingUser ? file.lastModifyingUser.displayName || '' : '',
    system:protectedIds.includes(file.id),
    can:{edit:cap.canEdit !== false, rename:cap.canRename !== false, trash:cap.canTrash !== false, untrash:cap.canUntrash !== false, remove:cap.canDelete !== false, addChildren:!!cap.canAddChildren, download:cap.canDownload !== false, move:cap.canMoveItemWithinDrive !== false}
  };
}
// Đường dẫn thư mục (từ Drive của tôi xuống thư mục hiện tại), tối đa 15 cấp.
function drivePath_(folderId) {
  const rootId = driveRootId_();
  const path = [];
  let current = folderId === 'root' ? rootId : folderId;
  for (let depth = 0; current && depth < 15; depth++) {
    if (current === rootId) { path.unshift({id:'root', name:'Drive của tôi'}); return path; }
    const item = driveService_().Files.get(current, {fields:'id,name,parents', supportsAllDrives:true});
    path.unshift({id:item.id, name:item.name});
    current = item.parents && item.parents[0];
  }
  return path; // thư mục được chia sẻ (không thuộc Drive của tôi) → đường dẫn bắt đầu từ thư mục cao nhất đọc được
}
// Bulk: xử lý từng mục, gom kết quả thành công/thất bại (một mục lỗi không làm hỏng cả lô).
function driveBulk_(ids, worker) {
  const done = [], failed = [];
  ids.forEach(id => {
    try { worker(id); done.push(id); }
    catch (error) { failed.push({id, error:String(error && error.message || 'Lỗi không xác định').slice(0, 200)}); }
  });
  return {ok:true, done, failed};
}

// ---- Các thao tác -----------------------------------------------------------------------------
function driveAbout_() {
  const about = driveService_().About.get({fields:'user(displayName,emailAddress,photoLink),storageQuota(limit,usage,usageInDrive,usageInDriveTrash)'});
  const quota = about.storageQuota || {};
  return {ok:true,
    user:{name:about.user && about.user.displayName || '', email:about.user && about.user.emailAddress || ''},
    quota:{limit:Number(quota.limit || 0), usage:Number(quota.usage || 0), drive:Number(quota.usageInDrive || 0), trash:Number(quota.usageInDriveTrash || 0)}};
}

function driveListQuery_(request) {
  const view = ['folder','recent','starred','shared','trash'].includes(request.view) ? request.view : 'folder';
  const parts = [];
  const search = String(request.query || '').trim().slice(0, 120);
  if (view === 'trash') parts.push("trashed = true and 'me' in owners");
  else parts.push('trashed = false');
  if (view === 'folder' && !search) parts.push(driveQuote_(driveId_(request.folderId || 'root', true)) + ' in parents');
  if (view === 'starred') parts.push('starred = true');
  if (view === 'shared') parts.push('sharedWithMe = true');
  if (view === 'recent') parts.push("mimeType != '" + DRIVE_FOLDER_MIME + "'");
  if (search) parts.push('name contains ' + driveQuote_(search));
  if (request.type && DRIVE_TYPE_FILTERS[request.type]) parts.push('(' + DRIVE_TYPE_FILTERS[request.type].join(' or ') + ')');
  const orderBy = view === 'recent' && !request.sort ? 'recency desc' : (DRIVE_SORTS[request.sort] || DRIVE_SORTS.name_asc);
  return {view, search, q:parts.join(' and '), orderBy};
}

function driveList_(request, props) {
  const plan = driveListQuery_(request);
  const pageSize = Math.min(Math.max(Number(request.pageSize) || 60, 10), 200);
  const args = {q:plan.q, orderBy:plan.orderBy, pageSize, fields:'nextPageToken,files(' + DRIVE_FILE_FIELDS + ')', supportsAllDrives:true, includeItemsFromAllDrives:plan.view === 'shared'};
  if (request.pageToken) {
    if (typeof request.pageToken !== 'string' || request.pageToken.length > 2000) throw new Error('Trang dữ liệu không hợp lệ.');
    args.pageToken = request.pageToken;
  }
  const result = driveService_().Files.list(args);
  const protectedIds = driveProtectedIds_(props);
  const response = {ok:true, files:(result.files || []).map(file => driveRecord_(file, protectedIds)), nextPageToken:result.nextPageToken || ''};
  // Đường dẫn chỉ cần ở trang đầu của chế độ thư mục.
  if (plan.view === 'folder' && !plan.search && !request.pageToken) {
    const folderId = driveId_(request.folderId || 'root', true);
    response.path = drivePath_(folderId);
    if (folderId !== 'root') {
      const folder = driveService_().Files.get(folderId, {fields:DRIVE_FILE_FIELDS, supportsAllDrives:true});
      if (folder.mimeType !== DRIVE_FOLDER_MIME) throw new Error('Mục đang mở không phải thư mục.');
      response.folder = driveRecord_(folder, protectedIds);
    }
  }
  return response;
}

// Danh sách THƯ MỤC con (cho hộp thoại "Di chuyển tới…").
function driveFolders_(request, props) {
  const parentId = driveId_(request.folderId || 'root', true);
  const result = driveService_().Files.list({q:driveQuote_(parentId) + " in parents and trashed = false and mimeType = '" + DRIVE_FOLDER_MIME + "'", orderBy:'name', pageSize:200, fields:'files(id,name,mimeType,capabilities(canAddChildren))', supportsAllDrives:true});
  const protectedIds = driveProtectedIds_(props);
  return {ok:true, path:drivePath_(parentId), folders:(result.files || []).map(item => ({id:item.id, name:item.name, system:protectedIds.includes(item.id), canAddChildren:!item.capabilities || item.capabilities.canAddChildren !== false}))};
}

function driveCreateFolder_(request, props) {
  const parentId = driveId_(request.parentId || 'root', true);
  const created = driveService_().Files.create({name:driveName_(request.name), mimeType:DRIVE_FOLDER_MIME, parents:[parentId]}, null, {fields:DRIVE_FILE_FIELDS, supportsAllDrives:true});
  return {ok:true, file:driveRecord_(created, driveProtectedIds_(props))};
}

function driveRename_(request, props) {
  const id = driveId_(request.fileId, false);
  driveAssertMutable_(id, props);
  const updated = driveService_().Files.update({name:driveName_(request.name)}, id, null, {fields:DRIVE_FILE_FIELDS, supportsAllDrives:true});
  return {ok:true, file:driveRecord_(updated, driveProtectedIds_(props))};
}

// Không cho chuyển thư mục vào chính nó hoặc vào thư mục con của nó.
function driveAssertNotDescendant_(id, targetId) {
  const rootId = driveRootId_();
  let current = targetId === 'root' ? rootId : targetId;
  for (let depth = 0; current && depth < 25; depth++) {
    if (current === id) throw new Error('Không thể chuyển thư mục vào chính nó hoặc thư mục con của nó.');
    if (current === rootId) return;
    const item = driveService_().Files.get(current, {fields:'id,parents', supportsAllDrives:true});
    current = item.parents && item.parents[0];
  }
}

function driveMove_(request, props) {
  const ids = driveIds_(request.fileIds);
  const targetId = driveId_(request.targetId || 'root', true);
  const target = driveService_().Files.get(targetId, {fields:'id,mimeType,trashed', supportsAllDrives:true});
  if (target.mimeType !== DRIVE_FOLDER_MIME || target.trashed) throw new Error('Thư mục đích không hợp lệ.');
  return driveBulk_(ids, id => {
    driveAssertMutable_(id, props);
    const file = driveService_().Files.get(id, {fields:'id,mimeType,parents', supportsAllDrives:true});
    if (file.mimeType === DRIVE_FOLDER_MIME) driveAssertNotDescendant_(id, target.id);
    const parents = (file.parents || []).filter(parent => parent !== target.id);
    if (!parents.length && (file.parents || []).includes(target.id)) return; // đã ở sẵn thư mục đích
    driveService_().Files.update({}, id, null, {addParents:target.id, removeParents:parents.join(','), supportsAllDrives:true, fields:'id'});
  });
}

function driveCopy_(request, props) {
  const id = driveId_(request.fileId, false);
  const source = driveService_().Files.get(id, {fields:'id,name,mimeType,parents', supportsAllDrives:true});
  if (source.mimeType === DRIVE_FOLDER_MIME) throw new Error('Google Drive không hỗ trợ tạo bản sao cho thư mục.');
  const copy = driveService_().Files.copy({name:'Bản sao của ' + source.name, parents:source.parents && source.parents.length ? [source.parents[0]] : undefined}, id, {fields:DRIVE_FILE_FIELDS, supportsAllDrives:true});
  return {ok:true, file:driveRecord_(copy, driveProtectedIds_(props))};
}

function driveStar_(request) {
  const starred = request.starred !== false;
  return driveBulk_(driveIds_(request.fileIds), id => driveService_().Files.update({starred}, id, null, {supportsAllDrives:true, fields:'id'}));
}

function driveTrash_(request, props, trashed) {
  return driveBulk_(driveIds_(request.fileIds), id => {
    if (trashed) driveAssertMutable_(id, props);
    driveService_().Files.update({trashed}, id, null, {supportsAllDrives:true, fields:'id'});
  });
}

// Xóa vĩnh viễn: CHỈ áp dụng cho mục đang nằm trong thùng rác (bắt buộc bỏ vào thùng rác trước).
function driveDelete_(request, props) {
  return driveBulk_(driveIds_(request.fileIds), id => {
    driveAssertMutable_(id, props);
    const file = driveService_().Files.get(id, {fields:'id,trashed', supportsAllDrives:true});
    if (!file.trashed) throw new Error('Chỉ xóa vĩnh viễn được mục đang ở thùng rác.');
    driveService_().Files.remove(id, {supportsAllDrives:true});
  });
}

function driveEmptyTrash_(request) {
  if (request.confirm !== 'EMPTY_TRASH') throw new Error('Thiếu xác nhận dọn sạch thùng rác.');
  driveService_().Files.emptyTrash();
  return {ok:true};
}

function driveUpload_(request, props, auth) {
  const parentId = driveId_(request.parentId || 'root', true);
  if (!/^[\w-]{16,80}$/.test(request.requestId || '')) throw new Error('Yêu cầu tải lên không hợp lệ.');
  if (typeof request.data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(request.data)) throw new Error('Dữ liệu tệp không hợp lệ.');
  const bytes = Utilities.base64Decode(request.data);
  if (!bytes.length) throw new Error('Tệp đang trống.');
  if (bytes.length > DRIVE_UPLOAD_MAX) throw new Error('Mỗi tệp tải lên tối đa 10 MB.');
  const mime = /^[\w.+-]{1,80}\/[\w.+-]{1,120}$/.test(request.mimeType || '') && !/^application\/vnd\.google-apps\./.test(request.mimeType) ? request.mimeType : 'application/octet-stream';
  const name = driveName_(request.name);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Drive đang bận. Vui lòng thử lại.');
  try {
    const protectedIds = driveProtectedIds_(props);
    // Gửi lại cùng requestId (mất phản hồi) → trả về bản đã tạo, không tạo trùng.
    const again = driveService_().Files.list({q:driveQuote_(parentId) + " in parents and trashed = false and appProperties has { key='tascoRequestId' and value=" + driveQuote_(request.requestId) + ' }', fields:'files(' + DRIVE_FILE_FIELDS + ')', pageSize:1, supportsAllDrives:true});
    if (again.files && again.files.length) return {ok:true, file:driveRecord_(again.files[0], protectedIds)};
    // Trùng tên trong cùng thư mục → thêm số thứ tự, không ghi đè.
    let finalName = name, count = 1;
    const dot = name.lastIndexOf('.'), stem = dot > 0 ? name.slice(0, dot) : name, tail = dot > 0 ? name.slice(dot) : '';
    while (count < 50) {
      const same = driveService_().Files.list({q:driveQuote_(parentId) + ' in parents and trashed = false and name = ' + driveQuote_(finalName), fields:'files(id)', pageSize:1, supportsAllDrives:true});
      if (!same.files || !same.files.length) break;
      finalName = stem + ' (' + (++count) + ')' + tail;
    }
    const created = driveService_().Files.create({name:finalName, parents:[parentId], appProperties:{tascoRequestId:request.requestId, tascoUploadedBy:auth.localId}}, Utilities.newBlob(bytes, mime, finalName), {fields:DRIVE_FILE_FIELDS, supportsAllDrives:true});
    return {ok:true, file:driveRecord_(created, protectedIds)};
  } finally { lock.releaseLock(); }
}

// Ghi đè nội dung một tệp Word (.docx) đã có (trình chỉnh sửa Word). Chỉ nhận .docx hợp lệ, tối đa 10 MB;
// so sánh expectedModifiedTime để không đè lên bản người khác vừa sửa. Drive tự giữ phiên bản cũ.
const DRIVE_DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
function driveUpdateContent_(request, props, auth) {
  const id = driveId_(request.fileId, false);
  driveAssertMutable_(id, props);
  if (typeof request.data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(request.data)) throw new Error('Dữ liệu tệp không hợp lệ.');
  const bytes = Utilities.base64Decode(request.data);
  if (!bytes.length) throw new Error('Tệp đang trống.');
  if (bytes.length > DRIVE_UPLOAD_MAX) throw new Error('Tệp sau khi sửa lớn hơn 10 MB nên không ghi đè được.');
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('Nội dung gửi lên không phải tệp Word (.docx) hợp lệ.');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Drive đang bận. Vui lòng thử lại.');
  try {
    const meta = driveService_().Files.get(id, {fields:'id,name,mimeType,modifiedTime,trashed,capabilities(canEdit)', supportsAllDrives:true});
    if (meta.trashed) throw new Error('Tệp đang nằm trong thùng rác.');
    if (meta.capabilities && meta.capabilities.canEdit === false) throw new Error('Bạn không có quyền sửa tệp này.');
    if (meta.mimeType !== DRIVE_DOCX_MIME && !/\.docx$/i.test(meta.name || '')) throw new Error('Chỉ ghi đè được tệp Word (.docx).');
    if (request.expectedModifiedTime && meta.modifiedTime && String(request.expectedModifiedTime) !== String(meta.modifiedTime)) {
      throw new Error('Tệp đã được thay đổi trên Drive sau khi bạn mở (' + meta.modifiedTime + '). Hãy lưu thành bản sao hoặc tải về máy để không mất thay đổi, rồi mở lại tệp.');
    }
    const updated = driveService_().Files.update({}, id, Utilities.newBlob(bytes, DRIVE_DOCX_MIME, meta.name), {fields:DRIVE_FILE_FIELDS, supportsAllDrives:true});
    return {ok:true, file:driveRecord_(updated, driveProtectedIds_(props))};
  } finally { lock.releaseLock(); }
}

// Đổi cạnh dài của thumbnailLink (dạng ...=s220) sang kích thước mong muốn.
function driveSizedLink_(link, edge) {
  const text = String(link || '');
  return /=[sw]\d+[^\/]*$/i.test(text) ? text.replace(/=[sw]\d+[^\/]*$/i, '=s' + edge) : '';
}

function driveAuthHeaders_() { return {Authorization:'Bearer ' + ScriptApp.getOAuthToken()}; }

// Bản thu nhỏ do Google dựng sẵn: nhẹ hơn ảnh gốc nhiều lần nên tải nhanh. Lỗi → null để quay về ảnh gốc.
function driveDisplayBlob_(meta) {
  try {
    const url = driveSizedLink_(meta.thumbnailLink, DRIVE_DISPLAY_EDGE);
    if (!url) return null;
    const response = UrlFetchApp.fetch(url, {headers:driveAuthHeaders_(), muteHttpExceptions:true});
    if (response.getResponseCode() !== 200) return null;
    const blob = response.getBlob();
    return /^image\//i.test(String(blob.getContentType())) ? blob : null;
  } catch (_) { return null; }
}

// Tệp Office đời cũ (.doc, .ppt, .pptx) trình duyệt không dựng được → xem trước bằng PDF: Drive chuyển một bản sao tạm sang
// định dạng Google, xuất PDF rồi xóa ngay bản tạm (không để lại gì trong Drive).
// Dấu phiên bản để trình duyệt biết Apps Script đang chạy đã được Deploy bản mới chưa.
const DRIVE_SERVER_VERSION = '2026-11-14-convert-1';
const DRIVE_PREVIEW_CONVERT = {
  'application/msword':'application/vnd.google-apps.document',
  'application/vnd.ms-powerpoint':'application/vnd.google-apps.presentation',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':'application/vnd.google-apps.presentation'
};
function driveConvertTarget_(meta) {
  if (DRIVE_PREVIEW_CONVERT[meta.mimeType]) return DRIVE_PREVIEW_CONVERT[meta.mimeType];
  if (/\.doc$/i.test(meta.name || '') && /^application\/(octet-stream|x-msword)$/i.test(meta.mimeType || '')) return 'application/vnd.google-apps.document';
  if (/\.pptx?$/i.test(meta.name || '') && meta.mimeType === 'application/octet-stream') return 'application/vnd.google-apps.presentation';
  return '';
}
// Tạo bản sao tạm định dạng Google, chạy read(tempId) để lấy dữ liệu, rồi luôn xóa bản tạm.
function driveWithTemp_(id, target, read) {
  let tempId = '';
  try {
    const copy = driveService_().Files.copy({name:'~xem-truoc-' + id.slice(0, 8), mimeType:target}, id, {fields:'id', supportsAllDrives:true});
    tempId = copy.id;
    return read(tempId);
  } catch (error) {
    throw new Error('Chưa chuyển được tệp này (tệp có thể bị hỏng hoặc quá phức tạp). Hãy tải về hoặc mở trên Google Drive.');
  } finally {
    if (tempId) { try { driveService_().Files.remove(tempId, {supportsAllDrives:true}); } catch (_) {} }
  }
}
function drivePreviewPdf_(id, meta, target) {
  return driveWithTemp_(id, target, tempId => DriveApp.getFileById(tempId).getAs('application/pdf'));
}
// .doc → .docx (qua Google Docs) để chỉnh sửa trong ứng dụng; bố cục có thể lệch nhẹ so với bản gốc.
function driveDocxFromDoc_(id) {
  return driveWithTemp_(id, 'application/vnd.google-apps.document', tempId => {
    const response = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(tempId) + '/export?mimeType=' + encodeURIComponent(DRIVE_DOCX_MIME), {headers:driveAuthHeaders_(), muteHttpExceptions:true});
    if (response.getResponseCode() !== 200) throw new Error('export failed');
    return response.getBlob();
  });
}

function driveDownload_(request) {
  const id = driveId_(request.fileId, false);
  const preview = request.mode === 'preview' || request.mode === 'display';
  const meta = driveService_().Files.get(id, {fields:'id,name,mimeType,size,trashed,thumbnailLink', supportsAllDrives:true});
  if (meta.mimeType === DRIVE_FOLDER_MIME) throw new Error('Không thể tải trực tiếp một thư mục.');
  const native = String(meta.mimeType).indexOf('application/vnd.google-apps.') === 0;
  let blob, name = meta.name, mimeType = meta.mimeType;
  if (native) {
    const target = preview ? {mime:'application/pdf', ext:'pdf'} : DRIVE_EXPORTS[meta.mimeType];
    if (!target) throw new Error('Loại tệp Google này chưa hỗ trợ tải về. Hãy mở trên Google Drive.');
    if (target.mime === 'application/pdf') blob = DriveApp.getFileById(id).getAs('application/pdf');
    else {
      const response = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '/export?mimeType=' + encodeURIComponent(target.mime), {headers:{Authorization:'Bearer ' + ScriptApp.getOAuthToken()}, muteHttpExceptions:true});
      if (response.getResponseCode() !== 200) throw new Error('Google chưa xuất được tệp này (tệp quá lớn để xuất). Hãy mở trên Google Drive.');
      blob = response.getBlob();
    }
    mimeType = target.mime;
    if (!new RegExp('\\.' + target.ext + '$', 'i').test(name)) name += '.' + target.ext;
  } else {
    const original = Number(meta.size || 0);
    // Chế độ xem nhanh cho ảnh: ảnh nặng (hoặc định dạng trình duyệt không hiển thị như HEIC) → bản thu nhỏ.
    const plain = /^image\/(jpeg|png|webp|gif)$/i.test(String(meta.mimeType));
    if (request.mode === 'display' && /^image\//i.test(String(meta.mimeType)) && (original > DRIVE_DISPLAY_MIN_BYTES || !plain)) {
      const small = driveDisplayBlob_(meta);
      if (small) {
        const smallBytes = small.getBytes();
        if (smallBytes.length < original || !plain) return {ok:true, name, mimeType:small.getContentType(), size:smallBytes.length, originalSize:original, resized:true, data:Utilities.base64Encode(smallBytes)};
      }
    }
    if (original > DRIVE_DOWNLOAD_MAX) throw new Error('Tệp lớn hơn 20 MB, hãy mở trên Google Drive để tải.');
    const convert = request.mode === 'preview' || request.mode === 'docx' ? driveConvertTarget_(meta) : '';
    if (request.mode === 'docx') {
      if (convert !== 'application/vnd.google-apps.document') throw new Error('Chỉ chuyển được tệp Word đời cũ (.doc) sang .docx.');
      blob = driveDocxFromDoc_(id);
      mimeType = DRIVE_DOCX_MIME;
      name = String(name).replace(/\.[^.]*$/, '') + '.docx';
    } else if (convert) {
      blob = drivePreviewPdf_(id, meta, convert);
      mimeType = 'application/pdf';
      name = String(name).replace(/\.[^.]*$/, '') + '.pdf';
    } else blob = DriveApp.getFileById(id).getBlob();
  }
  const bytes = blob.getBytes();
  if (bytes.length > DRIVE_DOWNLOAD_MAX) throw new Error('Tệp lớn hơn 20 MB, hãy mở trên Google Drive để tải.');
  return {ok:true, name, mimeType, originalMimeType:meta.mimeType, serverVersion:DRIVE_SERVER_VERSION, size:bytes.length, data:Utilities.base64Encode(bytes)};
}

// Ảnh nhỏ: hỏi thumbnailLink và tải ảnh SONG SONG (fetchAll) thay vì từng tệp một; tệp nào lỗi thì quay về getThumbnail.
function driveThumbnails_(request) {
  const ids = Array.isArray(request.fileIds) ? request.fileIds.slice(0, DRIVE_THUMB_LIMIT) : [];
  if (!ids.length || !ids.every(id => typeof id === 'string' && DRIVE_ID_PATTERN.test(id))) throw new Error('Tệp không hợp lệ.');
  const headers = driveAuthHeaders_(), found = {};
  try {
    const metas = UrlFetchApp.fetchAll(ids.map(id => ({url:'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?supportsAllDrives=true&fields=thumbnailLink', headers, muteHttpExceptions:true})));
    const wanted = [];
    metas.forEach((response, index) => {
      try {
        const url = response.getResponseCode() === 200 ? driveSizedLink_(JSON.parse(response.getContentText()).thumbnailLink, DRIVE_THUMB_EDGE) : '';
        if (url) wanted.push({id:ids[index], url});
      } catch (_) {}
    });
    if (wanted.length) UrlFetchApp.fetchAll(wanted.map(item => ({url:item.url, headers, muteHttpExceptions:true}))).forEach((response, index) => {
      try {
        if (response.getResponseCode() !== 200) return;
        const blob = response.getBlob();
        if (/^image\//i.test(String(blob.getContentType()))) found[wanted[index].id] = {id:wanted[index].id, ok:true, mimeType:blob.getContentType(), data:Utilities.base64Encode(blob.getBytes())};
      } catch (_) {}
    });
  } catch (_) { /* chuyển sang cách cũ bên dưới */ }
  return {ok:true, items:ids.map(id => {
    if (found[id]) return found[id];
    try {
      const thumbnail = DriveApp.getFileById(id).getThumbnail();
      if (!thumbnail) return {id, ok:false};
      return {id, ok:true, mimeType:thumbnail.getContentType(), data:Utilities.base64Encode(thumbnail.getBytes())};
    } catch (_) { return {id, ok:false}; }
  })};
}

// Điểm vào: doPost chuyển mọi action bắt đầu bằng "drive_" về đây.
function driveManager_(request, props) {
  if (!DRIVE_ACTIONS.includes(request.action)) throw new Error('Thao tác không hợp lệ.');
  const auth = authorizeDriveManager_(request, props);
  switch (request.action) {
    case 'drive_about': return driveAbout_();
    case 'drive_list': return driveList_(request, props);
    case 'drive_folders': return driveFolders_(request, props);
    case 'drive_create_folder': return driveCreateFolder_(request, props);
    case 'drive_rename': return driveRename_(request, props);
    case 'drive_move': return driveMove_(request, props);
    case 'drive_copy': return driveCopy_(request, props);
    case 'drive_star': return driveStar_(request);
    case 'drive_trash': return driveTrash_(request, props, true);
    case 'drive_restore': return driveTrash_(request, props, false);
    case 'drive_delete': return driveDelete_(request, props);
    case 'drive_empty_trash': return driveEmptyTrash_(request);
    case 'drive_upload': return driveUpload_(request, props, auth);
    case 'drive_update_content': return driveUpdateContent_(request, props, auth);
    case 'drive_download': return driveDownload_(request);
    case 'drive_thumbnails': return driveThumbnails_(request);
  }
  throw new Error('Thao tác không hợp lệ.');
}
