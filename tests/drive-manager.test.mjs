import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

// ---------------- Máy chủ: Code.gs + DriveManager.gs với Drive v3 giả lập ----------------
const source = ['Code.gs', 'DriveManager.gs'].map(name => fs.readFileSync(new URL('../google-apps-script/claim-documents/' + name, import.meta.url), 'utf8')).join('\n');
const FOLDER = 'application/vnd.google-apps.folder';

function service({uid = 'manager', managers = 'manager', items = {}} = {}) {
  const calls = {list:[], update:[], create:[], remove:[], get:0, emptyTrash:0, auth:0};
  const props = {FIREBASE_API_KEY:'k', FIREBASE_DATABASE_URL:'https://t.firebaseio.com', ALLOWED_UIDS:'someone', DRIVE_MANAGER_UIDS:managers, ROOT_FOLDER_ID:'claimsRootFolder01', FORMS_ROOT_FOLDER_ID:'formsRootFolder001'};
  const db = {
    myDriveRootId001:{id:'myDriveRootId001', name:'My Drive', mimeType:FOLDER, parents:[]},
    folderAAAAAAAAAA:{id:'folderAAAAAAAAAA', name:'A', mimeType:FOLDER, parents:['myDriveRootId001']},
    folderBBBBBBBBBB:{id:'folderBBBBBBBBBB', name:'B', mimeType:FOLDER, parents:['folderAAAAAAAAAA']},
    fileCCCCCCCCCCCC:{id:'fileCCCCCCCCCCCC', name:'c.pdf', mimeType:'application/pdf', parents:['folderAAAAAAAAAA'], size:'10'},
    claimsRootFolder01:{id:'claimsRootFolder01', name:'TASCO', mimeType:FOLDER, parents:['myDriveRootId001']},
    ...items
  };
  let listResult = () => ({files:[]});
  const Drive = {
    About:{get:() => ({user:{displayName:'Chủ Drive', emailAddress:'owner@example.com'}, storageQuota:{limit:'100', usage:'40', usageInDrive:'30', usageInDriveTrash:'5'}})},
    Files:{
      get:(id) => { calls.get++; const key = id === 'root' ? 'myDriveRootId001' : id; if (!db[key]) throw Error('not found'); return db[key]; },
      list:args => { calls.list.push(args); return listResult(args); },
      create:(resource, blob, args) => { calls.create.push({resource, blob, args}); return {id:'newFile000000001', name:resource.name, mimeType:resource.mimeType || 'text/plain', parents:resource.parents}; },
      update:(resource, id, blob, args) => { calls.update.push({resource, id, args}); return {...db[id], ...resource}; },
      copy:(resource, id) => ({...db[id], id:'copy000000000001', name:resource.name}),
      remove:id => { calls.remove.push(id); },
      emptyTrash:() => { calls.emptyTrash++; }
    }
  };
  const context = vm.createContext({
    Drive,
    PropertiesService:{getScriptProperties:() => ({getProperty:key => props[key]})},
    UrlFetchApp:{fetch:url => { calls.auth++; return {getResponseCode:() => 200, getContentText:() => JSON.stringify(url.includes('accounts:lookup') ? {users:[{localId:uid}]} : {})}; }},
    DriveApp:{getFileById:() => ({getThumbnail:() => null, getBlob:() => ({getBytes:() => [1, 2, 3]}), getAs:() => ({getBytes:() => [9]})})},
    LockService:{getScriptLock:() => ({tryLock:() => true, releaseLock:() => {}})},
    Utilities:{DigestAlgorithm:{SHA_256:'sha256'}, computeDigest:(_, value) => [...crypto.createHash('sha256').update(value).digest()], base64Decode:value => [...Buffer.from(value, 'base64')], base64Encode:value => Buffer.from(value).toString('base64'), newBlob:(bytes, mime, name) => ({bytes, mime, name})},
    ContentService:{MimeType:{JSON:'json'}, createTextOutput:body => ({setMimeType:() => body})}
  });
  vm.runInContext(source, context);
  return {
    call:request => JSON.parse(context.doPost({postData:{contents:JSON.stringify({token:'tok', ...request})}})),
    calls, db, setList:fn => { listResult = fn; }
  };
}

test('UID không nằm trong DRIVE_MANAGER_UIDS bị chặn trước khi chạm Drive', () => {
  const s = service({uid:'intruder'});
  const result = s.call({action:'drive_list'});
  assert.equal(result.ok, false);
  assert.match(result.error, /chưa được cấp quyền quản lý Google Drive/);
  assert.equal(s.calls.list.length, 0);
});

test('chưa cấu hình DRIVE_MANAGER_UIDS → từ chối, kể cả UID của kho hồ sơ', () => {
  const s = service({uid:'someone', managers:''});
  const result = s.call({action:'drive_about'});
  assert.equal(result.ok, false);
  assert.match(result.error, /DRIVE_MANAGER_UIDS/);
});

test('thao tác drive_* lạ bị từ chối', () => {
  const result = service().call({action:'drive_share_public'});
  assert.equal(result.ok, false);
  assert.equal(result.error, 'Thao tác không hợp lệ.');
});

test('tìm kiếm được thoát ký tự, không chèn được điều kiện truy vấn', () => {
  const s = service();
  s.call({action:'drive_list', query:"x' or trashed = true or name contains '"});
  const q = s.calls.list[0].q;
  assert.match(q, /^trashed = false and name contains 'x\\' or trashed = true or name contains \\''$/);
});

test('folderId có ký tự lạ bị từ chối; client không gửi được orderBy thô', () => {
  const s = service();
  assert.equal(s.call({action:'drive_list', folderId:"root' in parents or '1"}).ok, false);
  s.call({action:'drive_list', folderId:'folderAAAAAAAAAA', sort:'name; drop', type:'pdf'});
  const args = s.calls.list.at(-1);
  assert.equal(args.orderBy, 'folder,name');
  assert.match(args.q, /'folderAAAAAAAAAA' in parents/);
  assert.match(args.q, /\(mimeType = 'application\/pdf'\)/);
});

test('danh sách thư mục trả đường dẫn và đánh dấu thư mục hệ thống', () => {
  const s = service();
  s.setList(() => ({files:[s.db.claimsRootFolder01, s.db.fileCCCCCCCCCCCC], nextPageToken:'next'}));
  const result = s.call({action:'drive_list', folderId:'folderBBBBBBBBBB'});
  assert.equal(result.ok, true);
  assert.deepEqual(result.path.map(item => item.name), ['Drive của tôi', 'A', 'B']);
  assert.equal(result.files.find(file => file.id === 'claimsRootFolder01').system, true);
  assert.equal(result.files.find(file => file.id === 'fileCCCCCCCCCCCC').system, false);
  assert.equal(result.nextPageToken, 'next');
});

test('thùng rác: thư mục hệ thống không bị xóa, các mục khác vẫn xử lý', () => {
  const s = service();
  const result = s.call({action:'drive_trash', fileIds:['claimsRootFolder01', 'fileCCCCCCCCCCCC']});
  assert.equal(result.ok, true);
  assert.deepEqual(result.done, ['fileCCCCCCCCCCCC']);
  assert.equal(result.failed[0].id, 'claimsRootFolder01');
  assert.deepEqual(s.calls.update.map(call => call.id), ['fileCCCCCCCCCCCC']);
});

test('xóa vĩnh viễn chỉ áp dụng cho mục đã ở thùng rác', () => {
  const s = service({items:{trashedFile00001:{id:'trashedFile00001', name:'t', mimeType:'text/plain', trashed:true, parents:[]}}});
  const result = s.call({action:'drive_delete', fileIds:['fileCCCCCCCCCCCC', 'trashedFile00001']});
  assert.deepEqual(result.done, ['trashedFile00001']);
  assert.match(result.failed[0].error, /thùng rác/);
  assert.deepEqual(s.calls.remove, ['trashedFile00001']);
});

test('dọn thùng rác bắt buộc có xác nhận', () => {
  const s = service();
  assert.equal(s.call({action:'drive_empty_trash'}).ok, false);
  assert.equal(s.calls.emptyTrash, 0);
  assert.equal(s.call({action:'drive_empty_trash', confirm:'EMPTY_TRASH'}).ok, true);
  assert.equal(s.calls.emptyTrash, 1);
});

test('không thể chuyển thư mục vào thư mục con của chính nó', () => {
  const s = service();
  const result = s.call({action:'drive_move', fileIds:['folderAAAAAAAAAA'], targetId:'folderBBBBBBBBBB'});
  assert.equal(result.done.length, 0);
  assert.match(result.failed[0].error, /thư mục con/);
  assert.equal(s.calls.update.length, 0);
});

test('di chuyển tệp: thêm thư mục đích, bỏ thư mục cũ', () => {
  const s = service();
  const result = s.call({action:'drive_move', fileIds:['fileCCCCCCCCCCCC'], targetId:'folderBBBBBBBBBB'});
  assert.deepEqual(result.done, ['fileCCCCCCCCCCCC']);
  assert.equal(s.calls.update[0].args.addParents, 'folderBBBBBBBBBB');
  assert.equal(s.calls.update[0].args.removeParents, 'folderAAAAAAAAAA');
});

test('tải lên lặp lại cùng requestId không tạo bản trùng', () => {
  const s = service();
  s.setList(args => args.q.includes('tascoRequestId') ? {files:[{id:'existing00000001', name:'a.txt', mimeType:'text/plain'}]} : {files:[]});
  const result = s.call({action:'drive_upload', parentId:'folderAAAAAAAAAA', name:'a.txt', mimeType:'text/plain', requestId:'request-1234567890ab', data:Buffer.from('hi').toString('base64')});
  assert.equal(result.ok, true);
  assert.equal(result.file.id, 'existing00000001');
  assert.equal(s.calls.create.length, 0);
});

test('tải lên trùng tên → thêm số thứ tự, không ghi đè; mime Google bị chặn', () => {
  const s = service();
  s.setList(args => / and name = 'a\.txt'$/.test(args.q) ? {files:[{id:'x'}]} : {files:[]});
  const result = s.call({action:'drive_upload', parentId:'root', name:'a.txt', mimeType:'application/vnd.google-apps.script', requestId:'request-1234567890cd', data:Buffer.from('hi').toString('base64')});
  assert.equal(result.ok, true);
  assert.equal(s.calls.create[0].resource.name, 'a (2).txt');
  assert.equal(s.calls.create[0].blob.mime, 'application/octet-stream');
});

test('đổi tên: bỏ ký tự điều khiển, cấm đổi tên thư mục hệ thống', () => {
  const s = service();
  assert.equal(s.call({action:'drive_rename', fileId:'formsRootFolder001', name:'x'}).ok, false);
  const result = s.call({action:'drive_rename', fileId:'fileCCCCCCCCCCCC', name:'  báo cáo\u0000/2026.pdf '});
  assert.equal(result.ok, true);
  assert.equal(s.calls.update[0].resource.name, 'báo cáo_2026.pdf');
});

test('dung lượng Drive', () => {
  const result = service().call({action:'drive_about'});
  assert.deepEqual({...result.quota}, {limit:100, usage:40, drive:30, trash:5});
  assert.equal(result.user.email, 'owner@example.com');
});

// ---------------- Trình duyệt: các hàm thuần trong DriveManagerApi ----------------
const ctx = vm.createContext({Intl, console});
vm.runInContext(fs.readFileSync(new URL('../js/features/drive/drive-manager-api.js', import.meta.url), 'utf8') + '\nthis.api = DriveManagerApi;', ctx);
const Api = ctx.api;

test('định dạng dung lượng kiểu Việt Nam', () => {
  assert.equal(Api.formatBytes(0), '—');
  assert.equal(Api.formatBytes(512), '512 B');
  assert.equal(Api.formatBytes(1536), '1,5 KB');
  assert.equal(Api.formatBytes(10 * 1024 * 1024), '10 MB');
  assert.equal(Api.formatBytes(15.25 * 1024 ** 3), '15,3 GB');
});

test('nhận diện loại tệp', () => {
  assert.equal(Api.kindOf({mimeType:'application/vnd.google-apps.folder', name:'x'}), 'folder');
  assert.equal(Api.kindOf({mimeType:'application/vnd.google-apps.spreadsheet', name:'Bảng'}), 'sheet');
  assert.equal(Api.kindOf({mimeType:'application/octet-stream', name:'HS.DOCX'}), 'word');
  assert.equal(Api.kindOf({mimeType:'image/jpeg', name:'a.jpg'}), 'image');
  assert.equal(Api.typeLabel({mimeType:'application/vnd.google-apps.document', name:'x'}), 'Google Tài liệu');
  assert.equal(Api.canPreview({mimeType:'application/pdf', name:'a.pdf', size:100}), true);
  assert.equal(Api.canPreview({mimeType:'application/vnd.ms-powerpoint', name:'a.ppt', size:100}), false);
});

test('sắp xếp giữ thư mục lên đầu, tên theo kiểu tự nhiên', () => {
  const list = [{name:'b10.pdf'}, {name:'Z', mimeType:Api.FOLDER_MIME}, {name:'b2.pdf'}];
  assert.deepEqual(Api.sortFiles(list, 'name_asc').map(item => item.name), ['Z', 'b2.pdf', 'b10.pdf']);
  assert.deepEqual(Api.sortFiles(list, 'name_desc').map(item => item.name), ['Z', 'b10.pdf', 'b2.pdf']);
});

test('kiểm tra tên và tóm tắt dung lượng', () => {
  assert.throws(() => Api.validateName('   '), /nhập tên/);
  assert.throws(() => Api.validateName('..'), /không hợp lệ/);
  assert.equal(Api.validateName('  Hồ sơ  '), 'Hồ sơ');
  assert.equal(Api.quotaSummary({limit:100, usage:92}).level, 'critical');
  assert.equal(Api.quotaSummary({limit:0, usage:5}).unlimited, true);
});
