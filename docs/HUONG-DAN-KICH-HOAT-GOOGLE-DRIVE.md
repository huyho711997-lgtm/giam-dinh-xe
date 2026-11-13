# Hướng dẫn kích hoạt trang "Google Drive" của app giám định xe Tasco DLK

> **Dành cho trợ lý AI (GPT) thực hiện thay chủ dự án.** Đọc hết tài liệu trước khi bắt đầu. Làm đúng thứ tự từ Bước 1 đến Bước 8. Gặp tình huống không có trong tài liệu, hoặc cần quyết định không thể hoàn tác: **dừng lại và hỏi chủ dự án**, không tự đoán.

---

## 0. Bối cảnh

- Webapp: repo GitHub `huyho711997-lgtm/giam-dinh-xe` (nhánh `main`). Chạy trên GitHub Pages và Vercel (`giam-dinh-xe-rose.vercel.app`).
- Webapp có trang mới **Hệ thống → Google Drive** (đường dẫn `#/google-drive`) để quản lý toàn bộ Google Drive của chủ tài khoản. Phần giao diện đã nằm trong repo, **không cần sửa code webapp**.
- Trang lấy dữ liệu qua một **Google Apps Script Web App** có sẵn. URL của Web App nằm ở `js/config.js`, khóa `CONFIG.CLAIM_DOCUMENTS_ENDPOINT`:
  `https://script.google.com/macros/s/AKfycbxz7fuzBFf5GAJh5d2m-PlS8Y1bTiUCf9EfpEc9AIA05b5d4M-nF5fxZSYWBLf9zQff/exec`
- **Triệu chứng hiện tại:** trang Google Drive báo *"Cần hoàn tất cấu hình dịch vụ Google Drive – Dịch vụ Apps Script chưa có tính năng quản lý Google Drive…"*. Nguyên nhân: Web App đang chạy bản Apps Script cũ, chưa có file `DriveManager.gs`, chưa bật Drive API v3 và chưa có Script Property `DRIVE_MANAGER_UIDS`.

**Mục tiêu:** cập nhật đúng dự án Apps Script đó, rồi Deploy **phiên bản mới trên cùng deployment** để giữ nguyên URL `/exec`.

## 1. Yêu cầu trước khi làm

| Cần có | Ghi chú |
|---|---|
| Đăng nhập https://script.google.com bằng **tài khoản Google sở hữu Drive** (tài khoản đã tạo Web App) | Tài khoản khác sẽ không thấy dự án, hoặc Deploy sai chủ sở hữu. |
| Quyền xem Firebase Console, project `doi-chieu-gara` | Để lấy UID người dùng. |
| Đọc được repo GitHub ở trên | Để lấy mã mới nhất. Phụ lục A có sẵn bản sao của `DriveManager.gs`. |

## 2. Những điều KHÔNG được làm

1. **Không** tạo *New deployment*. Chỉ *Edit* deployment Web App hiện có → *New version*. Tạo deployment mới sẽ đổi URL `/exec` và làm hỏng webapp.
2. **Không** xóa hay sửa các Script Property đang có: `FIREBASE_API_KEY`, `FIREBASE_DATABASE_URL`, `ALLOWED_UIDS`, `ROOT_FOLDER_ID`, `FORMS_ROOT_FOLDER_ID`, … Chỉ **thêm** `DRIVE_MANAGER_UIDS`.
3. **Không** đổi cấu hình Deploy: giữ **Execute as: Me** và **Who has access: Anyone**.
4. **Không** chạy lại hàm `setupClaimDocuments`. Không đổi `ROOT_FOLDER_ID`.
5. **Không** đăng giá trị Script Properties, API key hay UID lên chat công khai, issue hoặc commit.
6. **Không** sửa `js/config.js` hay code webapp.

## 3. Các bước thực hiện

### Bước 1 – Mở đúng dự án Apps Script
1. Vào https://script.google.com → **My Projects**.
2. Mở dự án có file `Code.gs` chứa các hàm `setupClaimDocuments`, `doPost`, `formsUpload_`. Tên dự án thường liên quan tới "tài liệu hồ sơ / claim documents".
3. Xác nhận: **Deploy → Manage deployments**. Phải có một deployment loại **Web app** với URL kết thúc bằng `AKfycbxz7fuzBFf5GAJh5d2m-PlS8Y1bTiUCf9EfpEc9AIA05b5d4M-nF5fxZSYWBLf9zQff/exec`. Nếu không khớp, mở dự án khác. **Không tìm thấy thì dừng lại và hỏi chủ dự án.**

### Bước 2 – Cập nhật `Code.gs`
Cách ưu tiên: thay toàn bộ nội dung bằng bản trong repo.
1. Mở `https://github.com/huyho711997-lgtm/giam-dinh-xe/blob/main/google-apps-script/claim-documents/Code.gs` → bấm **Raw** → chép toàn bộ.
2. Trong editor, mở `Code.gs`, chọn hết (Ctrl+A), dán đè, rồi lưu (Ctrl+S).

Cách dự phòng, khi không lấy được file từ GitHub: trong hàm `doPost(e)` của `Code.gs`, tìm dòng
```js
    if (request.action === 'forms_upload') return jsonResponse_(formsUpload_(request, PropertiesService.getScriptProperties()));
```
rồi chèn **ngay phía trên** nó hai dòng sau:
```js
    // Trang "Google Drive" (DriveManager.gs): quản lý toàn bộ Drive, quyền riêng DRIVE_MANAGER_UIDS.
    if (typeof request.action === 'string' && request.action.indexOf('drive_') === 0 && typeof driveManager_ === 'function') return jsonResponse_(driveManager_(request, PropertiesService.getScriptProperties()));
```
Sau đó lưu (Ctrl+S).

### Bước 3 – Thêm file `DriveManager.gs`
1. Ở cột **Files** bên trái, bấm **+** → **Script**, đặt tên `DriveManager`. Editor tự thêm đuôi `.gs`.
2. Xóa nội dung mẫu (`function myFunction() {}`).
3. Dán toàn bộ nội dung từ `https://github.com/huyho711997-lgtm/giam-dinh-xe/blob/main/google-apps-script/claim-documents/DriveManager.gs` (bấm **Raw**), hoặc dán bản sao ở **Phụ lục A** cuối tài liệu này.
4. Lưu (Ctrl+S). Editor không được báo lỗi cú pháp.

### Bước 4 – Bật dịch vụ nâng cao Drive API v3
1. Ở cột trái, bấm **+** cạnh mục **Services**.
2. Chọn **Drive API** → **Version: v3** → **Identifier: `Drive`** (giữ đúng tên này, chữ D viết hoa) → **Add**.
3. Kiểm tra: mục Services phải hiện `Drive`.

Cách khác: **Project Settings** (biểu tượng bánh răng) → bật *Show "appsscript.json" manifest file in editor*, rồi thay nội dung `appsscript.json` bằng bản ở **Phụ lục B**.

### Bước 5 – Lấy UID của người được quản lý Drive
1. Vào https://console.firebase.google.com → project **doi-chieu-gara** → **Authentication** → **Users**.
2. Tìm dòng có email tài khoản Admin mà chủ dự án dùng để đăng nhập webapp (tài khoản *Hồ Quang Huy*, vai trò ADMIN).
3. Chép giá trị cột **User UID** (chuỗi khoảng 28 ký tự, ví dụ `aB3dE…`). **Không chắc là email nào thì hỏi chủ dự án.**

### Bước 6 – Thêm Script Property `DRIVE_MANAGER_UIDS`
1. Trong Apps Script: **Project Settings** (bánh răng) → kéo xuống **Script Properties** → **Edit script properties**.
2. **Add script property**:
   - Property: `DRIVE_MANAGER_UIDS`
   - Value: UID vừa chép ở Bước 5. Nhiều người thì ngăn cách bằng dấu phẩy, không có khoảng trắng thừa.
3. **Save script properties.** Kiểm tra các property cũ vẫn còn nguyên.

### Bước 7 – Deploy phiên bản mới (giữ nguyên URL)
1. **Deploy → Manage deployments**.
2. Chọn deployment **Web app** hiện có (URL khớp ở Bước 1) → bấm biểu tượng **bút chì (Edit)**.
3. **Version** → chọn **New version**. Mô tả có thể ghi: `Google Drive manager`.
4. Giữ nguyên *Execute as: Me* và *Who has access: Anyone* → **Deploy**.
5. Nếu Google yêu cầu cấp quyền (**Authorize access**): chọn đúng tài khoản chủ Drive → *Advanced* → *Go to … (unsafe)* nếu có → **Allow**.
6. Xác nhận URL Web App sau khi Deploy **không đổi**.

### Bước 8 – Kiểm tra trên webapp
1. Mở webapp, đăng nhập bằng tài khoản có UID ở Bước 5, vào **Hệ thống → Google Drive**, bấm **Thử lại** hoặc F5.
2. Kết quả đúng:
   - Thanh **Bộ nhớ** hiện dung lượng đã dùng / tổng.
   - Góc dưới cột trái hiện tên và email tài khoản Drive.
   - "Drive của tôi" liệt kê thư mục và tệp. Các thư mục hệ thống của app có biểu tượng khiên.
3. Thử nhẹ, không phá dữ liệu: tạo một thư mục tên `_test_gpt`, đổi tên nó, chuyển vào thùng rác, rồi vào **Thùng rác** → **Xóa vĩnh viễn** đúng mục đó.
4. Báo lại cho chủ dự án: các bước đã làm, URL Web App (xác nhận không đổi), kết quả kiểm tra.

## 4. Xử lý lỗi thường gặp

| Thông báo trên trang | Nguyên nhân | Cách xử lý |
|---|---|---|
| *Dịch vụ Apps Script chưa có tính năng quản lý Google Drive…* | Chưa Deploy phiên bản mới, sửa nhầm dự án, hoặc Bước 2 chưa có dòng `drive_` | Kiểm tra lại Bước 1–3 rồi làm lại Bước 7 (*New version*). |
| *Chưa bật dịch vụ nâng cao Drive API (v3)…* | Thiếu Bước 4, hoặc Identifier không phải `Drive` | Làm lại Bước 4, rồi Bước 7. |
| *Quản trị viên chưa bật quyền quản lý Google Drive (Script Property DRIVE_MANAGER_UIDS)* | Thiếu property, hoặc giá trị rỗng | Làm lại Bước 6. Không cần Deploy lại. |
| *Tài khoản chưa được cấp quyền quản lý Google Drive.* | UID sai, hoặc đang đăng nhập webapp bằng tài khoản khác | Đối chiếu UID với tài khoản đang đăng nhập (Bước 5–6). Có hiệu lực sau tối đa 5 phút. |
| *Không có quyền truy cập hoặc phiên đăng nhập đã hết hạn.* | `FIREBASE_API_KEY` sai hoặc bị hạn chế | Không tự sửa. Báo chủ dự án. |
| *Không kết nối được dịch vụ Google Drive…* | Mạng, hoặc deployment không cho *Anyone* | Kiểm tra mạng và cấu hình *Who has access: Anyone*. |
| Editor báo lỗi `ReferenceError: Drive is not defined` khi chạy | Thiếu Bước 4 | Làm lại Bước 4. |

## 5. Cách hệ thống hoạt động (để tham khảo)

- `doPost` nhận mọi action bắt đầu bằng `drive_` và chuyển sang `driveManager_` trong `DriveManager.gs`.
- Mỗi request phải có Firebase ID token hợp lệ, và UID phải nằm trong `DRIVE_MANAGER_UIDS`. Danh sách này tách riêng với `ALLOWED_UIDS` của kho hồ sơ.
- Các action có sẵn: `drive_about`, `drive_list`, `drive_folders`, `drive_create_folder`, `drive_rename`, `drive_move`, `drive_copy`, `drive_star`, `drive_trash`, `drive_restore`, `drive_delete`, `drive_empty_trash`, `drive_upload`, `drive_download`, `drive_thumbnails`.
- Thư mục `ROOT_FOLDER_ID`, `FORMS_ROOT_FOLDER_ID` và gốc Drive không thể đổi tên, di chuyển hay xóa. Xóa vĩnh viễn chỉ áp dụng cho mục đã ở thùng rác. Không có thao tác đổi quyền chia sẻ.
- Giới hạn: tải lên tối đa 10 MB/tệp, tải về hoặc xem trước tối đa 20 MB.

---

## Phụ lục A – Nội dung `DriveManager.gs`

```js
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
const DRIVE_ACTIONS = ['drive_about','drive_list','drive_folders','drive_create_folder','drive_rename','drive_move','drive_copy','drive_star','drive_trash','drive_restore','drive_delete','drive_empty_trash','drive_upload','drive_download','drive_thumbnails'];

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

function driveDownload_(request) {
  const id = driveId_(request.fileId, false);
  const preview = request.mode === 'preview';
  const meta = driveService_().Files.get(id, {fields:'id,name,mimeType,size,trashed', supportsAllDrives:true});
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
    if (Number(meta.size || 0) > DRIVE_DOWNLOAD_MAX) throw new Error('Tệp lớn hơn 20 MB, hãy mở trên Google Drive để tải.');
    blob = DriveApp.getFileById(id).getBlob();
  }
  const bytes = blob.getBytes();
  if (bytes.length > DRIVE_DOWNLOAD_MAX) throw new Error('Tệp lớn hơn 20 MB, hãy mở trên Google Drive để tải.');
  return {ok:true, name, mimeType, size:bytes.length, data:Utilities.base64Encode(bytes)};
}

function driveThumbnails_(request) {
  const ids = Array.isArray(request.fileIds) ? request.fileIds.slice(0, DRIVE_THUMB_LIMIT) : [];
  if (!ids.length || !ids.every(id => typeof id === 'string' && DRIVE_ID_PATTERN.test(id))) throw new Error('Tệp không hợp lệ.');
  return {ok:true, items:ids.map(id => {
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
    case 'drive_download': return driveDownload_(request);
    case 'drive_thumbnails': return driveThumbnails_(request);
  }
  throw new Error('Thao tác không hợp lệ.');
}
```

## Phụ lục B – Nội dung `appsscript.json`

```json
{
  "timeZone": "Asia/Ho_Chi_Minh",
  "runtimeVersion": "V8",
  "dependencies": {
    "enabledAdvancedServices": [
      {"userSymbol": "Drive", "serviceId": "drive", "version": "v3"}
    ]
  },
  "oauthScopes": ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/script.external_request"]
}
```
