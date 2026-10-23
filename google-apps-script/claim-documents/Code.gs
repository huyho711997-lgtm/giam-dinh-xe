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
  const result = fetchJson_('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(key), {method:'post',contentType:'application/json',payload:JSON.stringify({idToken:request.token})});
  const user = result.users && result.users[0];
  if (!user || user.disabled || !allowed.includes(user.localId)) throw new Error('Tài khoản chưa được cấp quyền sử dụng kho tài liệu.');
  // Read using the caller's token so Realtime Database rules still apply.
  const claim = fetchJson_(database.replace(/\/$/,'') + '/pending_claims/' + encodeURIComponent(request.claimId) + '.json?auth=' + encodeURIComponent(request.token));
  if (!claim || typeof claim !== 'object') throw new Error('Hồ sơ chưa được lưu hoặc bạn không có quyền xem hồ sơ.');
  return {user,claim};
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
    if (!['list','upload','download','thumbnail','remove'].includes(request.action)) throw new Error('Thao tác không hợp lệ.');
    const props = PropertiesService.getScriptProperties(), auth = authorize_(request, props);
    const rootId = props.getProperty('ROOT_FOLDER_ID');
    if (!rootId) throw new Error('Chưa tạo thư mục gốc.');
    const root = DriveApp.getFolderById(rootId);
    if (root.getSharingAccess() !== DriveApp.Access.PRIVATE) throw new Error('Thư mục hồ sơ phải ở chế độ Riêng tư.');
    const name = 'HS_' + digest_(request.claimId);
    const lock = LockService.getScriptLock();
    let locked = false;
    try {
      if (request.action === 'upload') { if (!lock.tryLock(30000)) throw new Error('Kho đang bận. Vui lòng thử lại.'); locked=true; }
      const matches = root.searchFolders("title contains '" + name + "' and trashed = false");
      const claimFolder = matches.hasNext() ? matches.next() : request.action === 'upload' ? root.createFolder(safeName_(auth.claim.bienSo) + ' - ' + safeName_(auth.claim.soHoSoBoiThuong || auth.claim.maVuTonThat) + ' [' + name + ']') : null;
      if (!claimFolder) { if (request.action === 'list') return jsonResponse_({ok:true,files:[]}); throw new Error('Chưa có tài liệu.'); }
      // Stable folder identity is based on the database key, not the editable plate/claim number.
      const groups = {upload:'Tai lieu tai len',word:'Word da xuat'};
      if (request.action === 'list') {
        const files = [];
        for (const source of Object.keys(groups)) {
          const group = folder_(claimFolder,groups[source],false); if (!group) continue;
          const iterator = group.getFiles();
          while (iterator.hasNext()) { const file=iterator.next(); if (!file.isTrashed()) files.push(record_(file,source)); }
        }
        return jsonResponse_({ok:true,files});
      }
      if (['download','thumbnail','remove'].includes(request.action)) {
        if (!/^[\w-]+$/.test(request.fileId || '')) throw new Error('Tệp không hợp lệ.');
        const file = DriveApp.getFileById(request.fileId), parents = file.getParents(); let belongs = false;
        const ids = Object.values(groups).map(n => folder_(claimFolder,n,false)).filter(Boolean).map(f => f.getId());
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
      const group = folder_(claimFolder,groups[source],true), existing = group.getFilesByName(fileName);
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
