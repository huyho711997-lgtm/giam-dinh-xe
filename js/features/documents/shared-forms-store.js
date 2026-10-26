const SharedFormsStore = (() => {
  const root = 'shared_forms';
  const maxBytes = 20 * 1024 * 1024;
  const types = {pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',doc:'application/msword',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',xls:'application/vnd.ms-excel',csv:'text/csv',txt:'text/plain',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'};
  const user = () => typeof firebase !== 'undefined' ? firebase.auth().currentUser : null;
  const admin = () => !!user() && hasUserPermission('users', 'admin');
  const canManage = file => !!user() && file?.source === 'upload' && (admin() || file.createdByUid === user().uid);
  const extension = name => String(name || '').split('.').pop().toLowerCase();
  const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  function kind(file) {
    if (file.mimeType === 'application/vnd.google-apps.folder') return 'folder';
    const suffix = extension(file.originalName || file.name);
    if (suffix === 'pdf' || file.mimeType === 'application/pdf') return 'pdf';
    if (['doc', 'docx'].includes(suffix) || file.mimeType === 'application/vnd.google-apps.document') return 'word';
    if (['xls', 'xlsx', 'csv'].includes(suffix) || file.mimeType === 'application/vnd.google-apps.spreadsheet') return 'sheet';
    if (['png', 'jpg', 'jpeg', 'webp'].includes(suffix)) return 'image';
    return 'text';
  }
  function validateFile(file) {
    if (!file || !types[extension(file.name)]) throw new Error('Chọn file PDF, Word (.docx, .doc), Excel, CSV, TXT hoặc ảnh JPG, PNG, WebP.');
    if (!file.size) throw new Error('File đang trống. Vui lòng chọn file có nội dung.');
    if (file.size > maxBytes) throw new Error('Mỗi file tối đa 20 MB.');
    return types[extension(file.name)];
  }
  function safeUrl(value) {
    try {
      const url = new URL(value, window.location.href);
      return url.protocol === 'https:' || (url.origin === window.location.origin && url.protocol === 'http:') ? url.href : '';
    } catch { return ''; }
  }
  function requireUser() {
    const current = user();
    if (!current || !dbNodeInstance) throw new Error('Vui lòng đăng nhập để sử dụng kho biểu mẫu.');
    return current;
  }
  function builtins() {
    return [
      {id:'builtin_tnds',name:'Đề nghị tạm ứng bồi thường TNDS',originalName:'tnds-advance.docx',url:'assets/templates/tnds-advance.docx'},
      {id:'builtin_scene_blank',name:'Sơ đồ hiện trường (mẫu để khách ký trước)',originalName:'scene-diagram-blank.docx',url:'assets/templates/scene-diagram-blank.docx'},
      {id:'builtin_collection',name:'Hướng dẫn thu thập hồ sơ',originalName:'collection-guide.docx',url:'assets/templates/collection-guide.docx'}
    ].map(file => ({...file,source:'builtin',category:'Biểu mẫu hệ thống',mimeType:types.docx}));
  }
  function subscribe(onChange, onError) {
    requireUser();
    const ref = dbNodeInstance.ref(root + '/files');
    const callback = snapshot => onChange(Object.entries(snapshot.val() || {}).map(([id, file]) => ({...file,id,source:'upload'})));
    ref.on('value', callback, onError);
    return () => ref.off('value', callback);
  }
  async function upload(file, details, onProgress = () => {}) {
    const owner = requireUser();
    const mimeType = validateFile(file);
    const settings = getCloudinaryConfig();
    if (!settings.cloudName || !settings.preset) throw new Error('Quản trị viên cần thiết lập Cloudinary trước khi tải file lên.');
    const body = new FormData();
    body.append('file', file);
    body.append('upload_preset', settings.preset);
    body.append('folder', settings.folder + '/shared_forms');
    const result = await new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', 'https://api.cloudinary.com/v1_1/' + encodeURIComponent(settings.cloudName) + '/raw/upload');
      request.timeout = 180000;
      request.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 95)); };
      request.onerror = () => reject(new Error('Mất kết nối khi tải file lên. Vui lòng thử lại.'));
      request.ontimeout = () => reject(new Error('Tải lên quá lâu. Vui lòng kiểm tra mạng rồi thử lại.'));
      request.onload = () => {
        let data;
        try { data = JSON.parse(request.responseText); } catch { reject(new Error('Dịch vụ lưu file trả về dữ liệu không hợp lệ.')); return; }
        if (request.status < 200 || request.status >= 300 || !safeUrl(data.secure_url)) {
          reject(new Error(data.error?.message || 'Không tải được file. Kiểm tra upload preset cho phép tài liệu raw.')); return;
        }
        resolve(data);
      };
      request.send(body);
    });
    if (user()?.uid !== owner.uid) throw new Error('Phiên đăng nhập đã thay đổi. File chưa được thêm vào thư viện.');
    const record = {
      name:(String(details.name || '').trim() || file.name).slice(0, 200),originalName:file.name.slice(0, 250),
      category:(String(details.category || '').trim() || 'Chưa phân loại').slice(0, 100),notes:String(details.notes || '').trim().slice(0, 2000),
      mimeType,size:file.size,url:result.secure_url,publicId:result.public_id || '',resourceType:'raw',
      createdByUid:owner.uid,createdByName:String(activeUserProfile?.displayName || owner.email || ''),createdAt:Date.now(),updatedAt:Date.now()
    };
    const ref = dbNodeInstance.ref(root + '/files').push();
    try { await ref.set(record); }
    catch { throw new Error('File đã tải lên nhưng chưa ghi được danh sách biểu mẫu. Quản trị viên cần kiểm tra quyền Firebase tại shared_forms/files.'); }
    onProgress(100);
    return {...record,id:ref.key,source:'upload'};
  }
  async function update(file, details) {
    requireUser();
    if (!canManage(file)) throw new Error('Bạn chỉ được sửa file do mình tải lên hoặc có quyền quản trị.');
    const name = String(details.name || '').trim().slice(0, 200);
    if (!name) throw new Error('Vui lòng nhập tên biểu mẫu.');
    await dbNodeInstance.ref(root + '/files/' + file.id).update({name,category:(String(details.category || '').trim() || 'Chưa phân loại').slice(0,100),notes:String(details.notes || '').trim().slice(0,2000),updatedAt:Date.now()});
  }
  async function remove(file) {
    requireUser();
    if (!canManage(file)) throw new Error('Bạn không có quyền xóa biểu mẫu này.');
    await dbNodeInstance.ref(root + '/files/' + file.id).remove();
  }
  function parseFolder(value) {
    const text = String(value || '').trim();
    if (/^[\w-]{8,}$/.test(text)) return text;
    try {
      const url = new URL(text);
      if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com') return '';
      const id = url.pathname.match(/\/folders\/([\w-]+)/)?.[1] || url.searchParams.get('id');
      return /^[\w-]{8,}$/.test(id || '') ? id : '';
    } catch { return ''; }
  }
  async function driveRequest(path, params, config, signal) {
    const url = new URL('https://www.googleapis.com/drive/v3/files' + path);
    Object.entries({...params,key:config.apiKey,supportsAllDrives:'true'}).forEach(([name,value]) => url.searchParams.set(name,value));
    const response = await fetch(url, {signal:signal || AbortSignal.timeout(20000)});
    if (!response.ok) {
      throw new Error(response.status === 404 ? 'Không tìm thấy thư mục hoặc file. Kiểm tra liên kết và quyền chia sẻ Google Drive.' : 'Không truy cập được Google Drive. Kiểm tra API key, bật Google Drive API và chia sẻ thư mục cho người có liên kết.');
    }
    return response;
  }
  async function listDrive(folderId, config, signal) {
    if (!parseFolder(folderId)) throw new Error('ID thư mục không hợp lệ.');
    if (!config.apiKey) {
      const response = await fetch('js/data/shared-forms-drive.json',{signal,cache:'no-cache'});
      if (!response.ok) throw new Error('Chưa tải được danh mục biểu mẫu. Vui lòng thử lại.');
      const catalog = await response.json();
      if (catalog.rootFolderId !== config.folderId || !catalog.folders?.[folderId]) throw new Error('Thêm Google Drive API key trong Kết nối Drive để đọc thư mục này.');
      return catalog.folders[folderId].files.map(file => ({...file,source:'drive',originalName:file.name,category:'Google Drive',updatedAt:file.modifiedTime || '',catalogAt:catalog.syncedAt}));
    }
    const files = [];
    let pageToken = '';
    do {
      const response = await driveRequest('', {q:"'" + folderId + "' in parents and trashed=false",fields:'nextPageToken,incompleteSearch,files(id,name,mimeType,size,modifiedTime)',orderBy:'folder,name_natural',pageSize:'200',includeItemsFromAllDrives:'true',...(pageToken ? {pageToken} : {})}, config, signal);
      const data = await response.json();
      if (data.incompleteSearch) throw new Error('Google Drive chưa trả đủ danh sách. Vui lòng làm mới để tải lại.');
      files.push(...(data.files || []).filter(file => /^[\w-]{8,}$/.test(file.id) && file.mimeType !== 'application/vnd.google-apps.shortcut').map(file => ({...file,source:'drive',originalName:file.name,category:'Google Drive',updatedAt:file.modifiedTime})));
      pageToken = data.nextPageToken || '';
    } while (pageToken);
    return files;
  }
  async function loadDriveConfig() {
    requireUser();
    const saved = (await dbNodeInstance.ref(root + '/drive').once('value')).val();
    return saved?.disabled ? null : saved || defaultDriveConfig();
  }
  function defaultDriveConfig() {
    const folderId = typeof CONFIG !== 'undefined' ? parseFolder(CONFIG.SHARED_FORMS_DRIVE_FOLDER_ID) : '';
    return folderId ? {folderId,folderName:CONFIG.SHARED_FORMS_DRIVE_FOLDER_NAME || 'Biểu mẫu dùng chung',apiKey:''} : null;
  }
  async function saveDriveConfig(details) {
    requireUser();
    if (!admin()) throw new Error('Chỉ quản trị viên được thiết lập Google Drive.');
    if (!details) { await dbNodeInstance.ref(root + '/drive').set({disabled:true,updatedAt:Date.now()}); return null; }
    const folderId = parseFolder(details.folderId);
    const apiKey = String(details.apiKey || '').trim();
    if (!folderId || !apiKey) throw new Error('Nhập liên kết thư mục Google Drive và API key.');
    const config = {folderId,apiKey,folderName:String(details.folderName || 'Biểu mẫu dùng chung').trim().slice(0,100),updatedAt:Date.now()};
    const metadata = await (await driveRequest('/' + folderId,{fields:'id,name,mimeType'},config)).json();
    if (metadata.mimeType !== 'application/vnd.google-apps.folder') throw new Error('Vui lòng chọn liên kết thư mục, không phải liên kết một file.');
    await dbNodeInstance.ref(root + '/drive').set(config);
    return config;
  }
  return {user,admin,canManage,extension,normalize,kind,validateFile,safeUrl,builtins,subscribe,upload,update,remove,parseFolder,listDrive,loadDriveConfig,defaultDriveConfig,saveDriveConfig,driveRequest,maxBytes,types};
})();
