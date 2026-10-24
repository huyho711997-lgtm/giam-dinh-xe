/* Deploy as the Drive owner. Never publish this script's properties to the client. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const DOCUMENT_TYPES = {pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',txt:'text/plain'};

function setupClaimDocuments() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('ROOT_FOLDER_ID')) return;
  const folder = DriveApp.createFolder('TASCO DLK - Tai lieu ho so');
  folder.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  props.setProperty('ROOT_FOLDER_ID', folder.getId());
}

function jsonResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function fetchJson_(url, options) {
  let response;
  try { response = UrlFetchApp.fetch(url, Object.assign({muteHttpExceptions:true}, options || {})); }
  catch (_) { throw new Error('Không kết nối được dịch vụ xác thực. Vui lòng thử lại.'); }
  if (response.getResponseCode() !== 200) throw new Error('Không có quyền truy cập hoặc phiên đăng nhập đã hết hạn.');
  return JSON.parse(response.getContentText());
}

function authorize_(request, props) {
  const key = props.getProperty('FIREBASE_API_KEY');
  const database = props.getProperty('FIREBASE_DATABASE_URL');
  const allowed = (props.getProperty('ALLOWED_UIDS') || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!key || !/^https:\/\/[\w.-]+\.(firebaseio\.com|firebasedatabase\.app)\/?$/.test(database || '') || !allowed.length) throw new Error('Quản trị viên chưa cấu hình kho tài liệu.');
  if (typeof request.token !== 'string' || request.token.length > 10000 || !/^[\w-]{1,200}$/.test(request.claimId || '')) throw new Error('Yêu cầu không hợp lệ.');
  // Cache theo băm(token + mã hồ sơ): chỉ chính token đó, với chính hồ sơ đó, mới dùng lại kết quả đã kiểm tra.
  const authKey = 'auth:' + digest_(request.token + '|' + request.claimId);
  const cached = cacheGet_(authKey);
  if (cached) { try { const hit = JSON.parse(cached); if (hit && hit.user && allowed.includes(hit.user.localId)) return hit; } catch (_) {} }
  const result = fetchJson_('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(key), {method:'post',contentType:'application/json',payload:JSON.stringify({idToken:request.token})});
  const user = result.users && result.users[0];
  if (!user || user.disabled || !allowed.includes(user.localId)) throw new Error('Tài khoản chưa được cấp quyền sử dụng kho tài liệu.');
  // Read using the caller's token so Realtime Database rules still apply.
  const claim = fetchJson_(database.replace(/\/$/,'') + '/pending_claims/' + encodeURIComponent(request.claimId) + '.json?auth=' + encodeURIComponent(request.token));
  if (!claim || typeof claim !== 'object') throw new Error('Hồ sơ chưa được lưu hoặc bạn không có quyền xem hồ sơ.');
  // Chỉ giữ các trường cần dùng sau này, không lưu toàn bộ hồ sơ vào cache.
  const slim = {user:{localId:user.localId}, claim:{bienSo:claim.bienSo || '', soHoSoBoiThuong:claim.soHoSoBoiThuong || '', maVuTonThat:claim.maVuTonThat || ''}};
  cachePut_(authKey, JSON.stringify(slim), AUTH_CACHE_SECONDS);
  return slim;
}

// ---- Bộ nhớ đệm phía máy chủ (CacheService) ---------------------------------------------
// Mỗi request trước đây luôn: gọi Identity Toolkit + đọc hồ sơ Firebase + tìm thư mục Drive (searchFolders
// ~1s). Với N ảnh thu nhỏ là N lần lặp lại. Cache dưới đây cắt các bước đó cho request lặp lại trong vài phút.
const AUTH_CACHE_SECONDS = 300;      // Token Firebase sống ~1h; thu hồi quyền có hiệu lực tối đa sau 5 phút.
const FOLDER_CACHE_SECONDS = 21600;  // ID thư mục không đổi; luôn kiểm tra lại khi đọc (getFolderById + isTrashed).
const THUMBNAIL_BATCH_LIMIT = 12;
function cache_() { try { return typeof CacheService === 'undefined' ? null : CacheService.getScriptCache(); } catch (_) { return null; } }
function cacheGet_(key) { const c = cache_(); try { return c ? c.get(key) : null; } catch (_) { return null; } }
function cachePut_(key, value, seconds) { const c = cache_(); try { if (c) c.put(key, value, seconds); } catch (_) {} }
function cacheRemove_(key) { const c = cache_(); try { if (c) c.remove(key); } catch (_) {} }
// Thư mục theo ID trong cache; trả null nếu đã xóa/không còn hợp lệ để gọi lại đường tìm kiếm chậm.
function cachedFolder_(key) {
  const id = cacheGet_(key); if (!id) return null;
  try { const folder = DriveApp.getFolderById(id); if (!folder.isTrashed()) return folder; } catch (_) {}
  cacheRemove_(key); return null;
}

function digest_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text).map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}
function safeName_(text) { return String(text || '').replace(/[\x00-\x1f<>:"/\\|?*]/g,'_').trim().slice(0,180) || 'Tai lieu'; }
function folder_(parent, name, create) {
  const existing = parent.getFoldersByName(name);
  return existing.hasNext() ? existing.next() : create ? parent.createFolder(name) : null;
}
function record_(file, source) {
  let meta = {}; try { meta = JSON.parse(file.getDescription() || '{}'); } catch (_) {}
  return {id:file.getId(),name:file.getName(),size:file.getSize(),mimeType:file.getMimeType(),createdAt:file.getDateCreated().toISOString(),source,uploadedBy:meta.uploadedBy || ''};
}
function doPost(e) {
  try {
    if (!e.postData || e.postData.contents.length > MAX_FILE_BYTES * 1.4 + 20000) throw new Error('Mỗi file tối đa 10 MB.');
    const request = JSON.parse(e.postData.contents);
    if (!['list','upload','download','thumbnail','thumbnails','remove'].includes(request.action)) throw new Error('Thao tác không hợp lệ.');
    const props = PropertiesService.getScriptProperties(), auth = authorize_(request, props);
    const rootId = props.getProperty('ROOT_FOLDER_ID');
    if (!rootId) throw new Error('Chưa tạo thư mục gốc.');
    // Kiểm tra chế độ Riêng tư của thư mục gốc tối đa 10 phút/lần thay vì mỗi request.
    let root = null;
    const rootFolder = () => root || (root = DriveApp.getFolderById(rootId));
    if (!cacheGet_('root-private:' + rootId)) {
      if (rootFolder().getSharingAccess() !== DriveApp.Access.PRIVATE) throw new Error('Thư mục hồ sơ phải ở chế độ Riêng tư.');
      cachePut_('root-private:' + rootId, '1', 600);
    }
    const name = 'HS_' + digest_(request.claimId);
    const lock = LockService.getScriptLock();
    let locked = false;
    try {
      if (request.action === 'upload') { if (!lock.tryLock(30000)) throw new Error('Kho đang bận. Vui lòng thử lại.'); locked=true; }
      // searchFolders là bước chậm nhất (~1s); ưu tiên ID thư mục đã lưu trong cache.
      const folderKey = 'folder:' + name;
      let claimFolder = cachedFolder_(folderKey);
      if (!claimFolder) {
        const matches = rootFolder().searchFolders("title contains '" + name + "' and trashed = false");
        claimFolder = matches.hasNext() ? matches.next() : request.action === 'upload' ? rootFolder().createFolder(safeName_(auth.claim.bienSo) + ' - ' + safeName_(auth.claim.soHoSoBoiThuong || auth.claim.maVuTonThat) + ' [' + name + ']') : null;
        if (claimFolder && cache_()) cachePut_(folderKey, claimFolder.getId(), FOLDER_CACHE_SECONDS);
      }
      if (!claimFolder) { if (request.action === 'list' || request.action === 'thumbnails') return jsonResponse_({ok:true,files:[],items:[]}); throw new Error('Chưa có tài liệu.'); }
      // Stable folder identity is based on the database key, not the editable plate/claim number.
      const groups = {upload:'Tai lieu tai len',word:'Word da xuat'};
      const groupFolder = (source, create) => {
        const key = 'group:' + name + ':' + source, hit = cachedFolder_(key);
        if (hit) return hit;
        const folder = folder_(claimFolder, groups[source], create);
        if (folder && cache_()) cachePut_(key, folder.getId(), FOLDER_CACHE_SECONDS);
        return folder;
      };
      if (request.action === 'list') {
        const files = [];
        for (const source of Object.keys(groups)) {
          const group = groupFolder(source,false); if (!group) continue;
          const iterator = group.getFiles();
          while (iterator.hasNext()) { const file=iterator.next(); if (!file.isTrashed()) files.push(record_(file,source)); }
        }
        return jsonResponse_({ok:true,files});
      }
      // Lấy nhiều ảnh thu nhỏ trong MỘT request: xác thực + tìm thư mục một lần cho cả lô.
      if (request.action === 'thumbnails') {
        const fileIds = Array.isArray(request.fileIds) ? request.fileIds.slice(0, THUMBNAIL_BATCH_LIMIT) : [];
        if (!fileIds.length || !fileIds.every(id => typeof id === 'string' && /^[\w-]+$/.test(id))) throw new Error('Tệp không hợp lệ.');
        const ids = Object.keys(groups).map(source => groupFolder(source,false)).filter(Boolean).map(f => f.getId());
        const items = fileIds.map(fileId => {
          try {
            const file = DriveApp.getFileById(fileId), parents = file.getParents(); let belongs = false;
            while (parents.hasNext()) if (ids.includes(parents.next().getId())) belongs = true;
            if (!belongs || file.isTrashed() || !/^image\//.test(file.getMimeType())) return {id:fileId,ok:false};
            const thumbnail = file.getThumbnail();
            if (!thumbnail) return {id:fileId,ok:false};
            return {id:fileId,ok:true,mimeType:thumbnail.getContentType(),data:Utilities.base64Encode(thumbnail.getBytes())};
          } catch (_) { return {id:fileId,ok:false}; }
        });
        return jsonResponse_({ok:true,items});
      }
      if (['download','thumbnail','remove'].includes(request.action)) {
        if (!/^[\w-]+$/.test(request.fileId || '')) throw new Error('Tệp không hợp lệ.');
        const file = DriveApp.getFileById(request.fileId), parents = file.getParents(); let belongs = false;
        const ids = Object.keys(groups).map(source => groupFolder(source,false)).filter(Boolean).map(f => f.getId());
        while (parents.hasNext()) if (ids.includes(parents.next().getId())) belongs=true;
        if (!belongs || file.isTrashed() || file.getSize()>MAX_FILE_BYTES) throw new Error('Không có quyền tải tệp này.');
        if (request.action === 'remove') {
          let meta={}; try { meta=JSON.parse(file.getDescription() || '{}'); } catch (_) {}
          if (meta.uploadedBy !== auth.user.localId) {
            const profile=fetchJson_(props.getProperty('FIREBASE_DATABASE_URL').replace(/\/$/,'')+'/users/'+encodeURIComponent(auth.user.localId)+'/profile.json?auth='+encodeURIComponent(request.token));
            if (String(profile && profile.role || '').trim().toLowerCase() !== 'admin') throw new Error('Chỉ người tải lên hoặc quản trị viên được xóa tệp.');
          }
          file.setTrashed(true);
          return jsonResponse_({ok:true,id:request.fileId});
        }
        if (request.action === 'thumbnail') {
          if (!/^image\//.test(file.getMimeType())) throw new Error('Tệp này không phải hình ảnh.');
          const thumbnail=file.getThumbnail();
          if (thumbnail) return jsonResponse_({ok:true,mimeType:thumbnail.getContentType(),data:Utilities.base64Encode(thumbnail.getBytes())});
        }
        return jsonResponse_({ok:true,name:file.getName(),mimeType:file.getMimeType(),data:Utilities.base64Encode(file.getBlob().getBytes())});
      }
      const source = request.source === 'word' ? 'word' : 'upload';
      const fileName = safeName_(request.name), ext = fileName.split('.').pop().toLowerCase(), mime = DOCUMENT_TYPES[ext];
      if (!mime || (source === 'word' && ext !== 'docx') || !/^[\w-]{16,80}$/.test(request.requestId || '')) throw new Error('Định dạng tệp không được hỗ trợ.');
      if (typeof request.data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(request.data)) throw new Error('Dữ liệu tệp không hợp lệ.');
      const bytes = Utilities.base64Decode(request.data);
      if (!bytes.length || bytes.length > MAX_FILE_BYTES) throw new Error('Tệp phải có nội dung và không vượt quá 10 MB.');
      const group = groupFolder(source,true), existing = group.getFilesByName(fileName);
      while (existing.hasNext()) {
        const file = existing.next(); let meta={}; try {meta=JSON.parse(file.getDescription());} catch (_) {}
        if (meta.requestId === request.requestId && meta.uploadedBy === auth.user.localId) return jsonResponse_({ok:true,file:record_(file,source)});
      }
      const file = group.createFile(Utilities.newBlob(bytes,mime,fileName));
      file.setDescription(JSON.stringify({claimId:request.claimId,requestId:request.requestId,uploadedBy:auth.user.localId,source}));
      return jsonResponse_({ok:true,file:{id:file.getId(),name:fileName,size:bytes.length,mimeType:mime,createdAt:new Date().toISOString(),source,uploadedBy:auth.user.localId}});
    } finally { if (locked) lock.releaseLock(); }
  } catch (error) { return jsonResponse_({ok:false,error:String(error.message || 'Không thể xử lý tài liệu.').slice(0,300)}); }
}
