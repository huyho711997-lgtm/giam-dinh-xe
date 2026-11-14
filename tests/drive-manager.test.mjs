import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

// ---------------- Máy chủ: Code.gs + DriveManager.gs với Drive v3 giả lập ----------------
const source = ['Code.gs', 'DriveManager.gs'].map(name => fs.readFileSync(new URL('../google-apps-script/claim-documents/' + name, import.meta.url), 'utf8')).join('\n');
const FOLDER = 'application/vnd.google-apps.folder';

function service({uid = 'manager', managers = 'manager', items = {}} = {}) {
  const calls = {list:[], update:[], create:[], remove:[], get:0, emptyTrash:0, auth:0, fetched:[], fetchAll:[]};
  const web = {handler:null}, thumbs = {};
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
      update:(resource, id, blob, args) => { calls.update.push({resource, id, args, blob}); return {...db[id], ...resource}; },
      copy:(resource, id) => ({...db[id], id:'copy000000000001', name:resource.name}),
      remove:id => { calls.remove.push(id); },
      emptyTrash:() => { calls.emptyTrash++; }
    }
  };
  const context = vm.createContext({
    Drive,
    PropertiesService:{getScriptProperties:() => ({getProperty:key => props[key]})},
    ScriptApp:{getOAuthToken:() => 'oauth-token'},
    UrlFetchApp:{
      fetch:(url, options) => {
        if (!String(url).includes('accounts:lookup') && web.handler) { calls.fetched.push({url, options}); return web.handler(url, options); }
        calls.auth++;
        return {getResponseCode:() => 200, getContentText:() => JSON.stringify(String(url).includes('accounts:lookup') ? {users:[{localId:uid}]} : {})};
      },
      fetchAll:requests => { calls.fetchAll.push(requests.map(request => request.url)); return requests.map(request => { calls.fetched.push(request); return web.handler(request.url, request); }); }
    },
    DriveApp:{getFileById:id => ({getThumbnail:() => (thumbs[id] ? {getContentType:() => 'image/jpeg', getBytes:() => thumbs[id]} : null), getBlob:() => ({getBytes:() => [1, 2, 3]}), getAs:() => ({getBytes:() => [9]})})},
    LockService:{getScriptLock:() => ({tryLock:() => true, releaseLock:() => {}})},
    Utilities:{DigestAlgorithm:{SHA_256:'sha256'}, computeDigest:(_, value) => [...crypto.createHash('sha256').update(value).digest()], base64Decode:value => [...Buffer.from(value, 'base64')], base64Encode:value => Buffer.from(value).toString('base64'), newBlob:(bytes, mime, name) => ({bytes, mime, name})},
    ContentService:{MimeType:{JSON:'json'}, createTextOutput:body => ({setMimeType:() => body})}
  });
  vm.runInContext(source, context);
  return {
    call:request => JSON.parse(context.doPost({postData:{contents:JSON.stringify({token:'tok', ...request})}})),
    calls, db, setList:fn => { listResult = fn; }, setWeb:fn => { web.handler = fn; }, thumbs
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

// ---------------- Trình duyệt: tự thử lại thao tác chỉ đọc khi lỗi tạm thời ----------------
function retryApi(responses) {
  const calls = [];
  const sandbox = vm.createContext({
    Intl, console, setTimeout, clearTimeout, AbortSignal, Error, JSON,
    CONFIG:{CLAIM_DOCUMENTS_ENDPOINT:'https://script.example/exec'},
    firebase:{auth:() => ({currentUser:{uid:'u1', getIdToken:async () => 'tok'}})},
    fetch:async (url, options) => {
      calls.push(JSON.parse(options.body).action);
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return next;
    }
  });
  vm.runInContext(fs.readFileSync(new URL('../js/features/drive/drive-manager-api.js', import.meta.url), 'utf8') + '\nthis.api = DriveManagerApi;', sandbox);
  return {api:sandbox.api, calls};
}
const jsonResponse = (body, status = 200) => ({ok:status < 400, status, json:async () => body});
const htmlResponse = () => ({ok:true, status:200, json:async () => { throw new SyntaxError('Unexpected token <'); }});

test('danh sách tự thử lại khi Google trả trang lỗi rồi thành công', async () => {
  const {api, calls} = retryApi([htmlResponse(), jsonResponse({ok:true, files:[{id:'a'}]})]);
  const result = await api.list({view:'folder'});
  assert.equal(result.files[0].id, 'a');
  assert.deepEqual(calls, ['drive_list', 'drive_list']);
});

test('thao tác ghi không bao giờ tự thử lại', async () => {
  const {api, calls} = retryApi([htmlResponse(), jsonResponse({ok:true})]);
  await assert.rejects(() => api.trash(['aaaaaaaaaaaaaaaaaaaa']), /không hợp lệ/);
  assert.deepEqual(calls, ['drive_trash']);
});

test('lỗi nghiệp vụ từ máy chủ không bị thử lại', async () => {
  const {api, calls} = retryApi([jsonResponse({ok:false, error:'Tài khoản chưa được cấp quyền quản lý Google Drive.'}), jsonResponse({ok:true, files:[]})]);
  await assert.rejects(() => api.list({}), /chưa được cấp quyền/);
  assert.deepEqual(calls, ['drive_list']);
});

test('dừng thử lại sau số lần tối đa và báo lỗi cuối', async () => {
  const {api, calls} = retryApi([htmlResponse(), htmlResponse(), htmlResponse(), jsonResponse({ok:true, files:[]})]);
  await assert.rejects(() => api.list({}), /dữ liệu không hợp lệ/);
  assert.equal(calls.length, api.RETRY_ATTEMPTS.drive_list);
});

test('hủy yêu cầu thì không thử lại', async () => {
  const controller = new AbortController();
  const {api, calls} = retryApi([Object.assign(new Error('x'), {name:'AbortError'}), jsonResponse({ok:true, files:[]})]);
  controller.abort();
  await assert.rejects(() => api.list({}, controller.signal));
  assert.equal(calls.length, 1);
});

// ---------------- Bộ xem theo loại tệp ----------------
test('chọn bộ xem theo loại tệp', () => {
  assert.equal(Api.viewerKind({mimeType:'image/jpeg', name:'a.jpg', size:100}), 'image');
  assert.equal(Api.viewerKind({mimeType:'video/mp4', name:'a.mp4', size:100}), 'video');
  assert.equal(Api.viewerKind({mimeType:'audio/mpeg', name:'a.mp3', size:100}), 'audio');
  assert.equal(Api.viewerKind({mimeType:'text/csv', name:'a.csv', size:100}), 'sheet');
  assert.equal(Api.viewerKind({mimeType:'application/json', name:'a.json', size:100}), 'text');
  assert.equal(Api.viewerKind({mimeType:'application/pdf', name:'a.pdf', size:100}), 'document');
  assert.equal(Api.viewerKind({mimeType:'application/vnd.google-apps.spreadsheet', name:'Bảng'}), 'document');
  assert.equal(Api.viewerKind({mimeType:'video/mp4', name:'to.mp4', size:21 * 1024 * 1024}), '');
  assert.equal(Api.viewerKind({mimeType:'application/zip', name:'a.zip', size:100}), '');
});

const viewerCtx = vm.createContext({console, TextDecoder, JSON, Map, Set, Math});
vm.runInContext(fs.readFileSync(new URL('../js/features/drive/drive-viewer.js', import.meta.url), 'utf8') + '\nthis.viewer = DriveViewer;', viewerCtx);
const Viewer = viewerCtx.viewer;

test('ảnh vừa khung không phóng quá kích thước thật và đổi chiều khi xoay', () => {
  assert.equal(Viewer.fitScale(4000, 2000, 1000, 1000, 0), 0.25);
  assert.equal(Viewer.fitScale(4000, 2000, 1000, 1000, 90), 0.25);
  assert.equal(Viewer.fitScale(4000, 1000, 2000, 1000, 90), 0.25);
  assert.equal(Viewer.fitScale(100, 100, 1000, 1000, 0), 1);
  assert.equal(Viewer.fitScale(0, 0, 1000, 1000, 0), 1);
});

test('phóng to quanh con trỏ giữ nguyên điểm dưới con trỏ và có giới hạn', () => {
  const next = Viewer.zoomAt({scale:1, x:0, y:0}, 2, 100, 50);
  assert.deepEqual({...next}, {scale:2, x:-100, y:-50});
  assert.equal(Viewer.zoomAt({scale:1, x:0, y:0}, 999, 0, 0).scale, 8);
  assert.equal(Viewer.zoomAt({scale:1, x:0, y:0}, 0, 0, 0).scale, 0.05);
});

test('ô gộp của bảng tính: ô gốc có span, ô bị che bỏ qua, cắt theo vùng hiển thị', () => {
  const {spans, covered} = Viewer.mergeMap([{s:{r:0, c:0}, e:{r:1, c:2}}, {s:{r:5, c:0}, e:{r:99, c:0}}, {s:{r:50, c:0}, e:{r:51, c:0}}], 9, 1);
  assert.deepEqual({...spans.get('0:0')}, {rowSpan:2, colSpan:2});
  assert.equal(covered.has('1:1'), true);
  assert.equal(covered.has('0:2'), false);
  assert.deepEqual({...spans.get('5:0')}, {rowSpan:5, colSpan:1});
  assert.equal(spans.has('50:0'), false);
  assert.deepEqual([0, 25, 26, 701, 702].map(Viewer.columnName), ['A', 'Z', 'AA', 'ZZ', 'AAA']);
});

test('văn bản: bỏ BOM, dàn lại JSON, đếm dòng', () => {
  const encode = value => new TextEncoder().encode(value);
  const plain = Viewer.decodeText(encode('﻿dòng 1\ndòng 2'), 'a.txt');
  assert.equal(plain.text, 'dòng 1\ndòng 2');
  assert.equal(plain.lines, 2);
  const json = Viewer.decodeText(encode('{"a":1}'), 'a.json');
  assert.equal(json.pretty, true);
  assert.equal(json.text, '{\n  "a": 1\n}');
  assert.equal(Viewer.decodeText(encode('{hỏng'), 'a.json').pretty, false);
});

test('biên kéo ảnh: ảnh vừa khung đứng yên, ảnh phóng to kéo được tới mép; xoay đổi chiều', () => {
  assert.deepEqual({...Viewer.panBounds(1000, 500, 0.5, 0, 800, 600)}, {bx:0, by:0});
  assert.deepEqual({...Viewer.panBounds(1000, 500, 2, 0, 800, 600)}, {bx:600, by:200});
  assert.deepEqual({...Viewer.panBounds(1000, 500, 2, 90, 800, 600)}, {bx:100, by:700});
});

test('kéo vượt biên bị níu lại (đàn hồi), trong biên giữ nguyên', () => {
  assert.equal(Viewer.rubber(50, -100, 100), 50);
  assert.equal(Viewer.rubber(200, -100, 100), 135);
  assert.equal(Viewer.rubber(-300, -100, 100), -170);
  assert.equal(Viewer.rubber(200, -100, 100, 0), 100);
});


// ---------------- Tốc độ xem ảnh: bản thu nhỏ + ảnh nhỏ song song ----------------
const reply = (body, type = 'application/json', code = 200) => ({getResponseCode:() => code, getContentText:() => typeof body === 'string' ? body : JSON.stringify(body), getBlob:() => ({getContentType:() => type, getBytes:() => [...Buffer.from(typeof body === 'string' ? body : 'x')]})});
const BIG = 'photoBIGBIGBIG01', TINY = 'photoTINYTINY01', HEIC = 'photoHEICHEIC01';
const photos = {
  [BIG]:{id:BIG, name:'big.jpg', mimeType:'image/jpeg', size:String(5 * 1024 * 1024), thumbnailLink:'https://lh3.googleusercontent.com/drive-storage/abc=s220', parents:[]},
  [TINY]:{id:TINY, name:'tiny.jpg', mimeType:'image/jpeg', size:'20000', thumbnailLink:'https://lh3.googleusercontent.com/drive-storage/def=s220', parents:[]},
  [HEIC]:{id:HEIC, name:'a.heic', mimeType:'image/heic', size:'900', thumbnailLink:'https://lh3.googleusercontent.com/drive-storage/ghi=s220', parents:[]}
};

test('xem nhanh ảnh nặng: lấy bản thu nhỏ 2048px qua thumbnailLink, kèm token và cờ resized', () => {
  const s = service({items:photos});
  s.setWeb(() => reply('SMALLJPEG', 'image/jpeg'));
  const result = s.call({action:'drive_download', fileId:BIG, mode:'display'});
  assert.equal(result.ok, true);
  assert.equal(result.resized, true);
  assert.equal(result.mimeType, 'image/jpeg');
  assert.equal(Buffer.from(result.data, 'base64').toString(), 'SMALLJPEG');
  assert.equal(result.originalSize, 5 * 1024 * 1024);
  assert.equal(s.calls.fetched[0].url, 'https://lh3.googleusercontent.com/drive-storage/abc=s2048');
  assert.equal(s.calls.fetched[0].options.headers.Authorization, 'Bearer oauth-token');
});

test('xem nhanh: ảnh nhỏ gửi nguyên bản; chế độ preview/download luôn là ảnh gốc', () => {
  const s = service({items:photos});
  s.setWeb(() => reply('SMALLJPEG', 'image/jpeg'));
  const tiny = s.call({action:'drive_download', fileId:TINY, mode:'display'});
  assert.equal(tiny.ok, true);
  assert.equal(tiny.resized, undefined);
  assert.deepEqual([...Buffer.from(tiny.data, 'base64')], [1, 2, 3]);
  const full = s.call({action:'drive_download', fileId:BIG, mode:'preview'});
  assert.equal(full.resized, undefined);
  assert.deepEqual([...Buffer.from(full.data, 'base64')], [1, 2, 3]);
  assert.equal(s.calls.fetched.length, 0);
});

test('xem nhanh: thumbnailLink lỗi hoặc trả không phải ảnh → quay về ảnh gốc', () => {
  const s = service({items:photos});
  s.setWeb(() => reply('nope', 'text/html', 403));
  assert.deepEqual([...Buffer.from(s.call({action:'drive_download', fileId:BIG, mode:'display'}).data, 'base64')], [1, 2, 3]);
  s.setWeb(() => reply('<html>', 'text/html'));
  const again = s.call({action:'drive_download', fileId:BIG, mode:'display'});
  assert.equal(again.resized, undefined);
  s.setWeb(() => { throw new Error('boom'); });
  assert.equal(s.call({action:'drive_download', fileId:BIG, mode:'display'}).ok, true);
});

test('xem nhanh: ảnh HEIC (trình duyệt không hiển thị) luôn đi qua bản thu nhỏ JPEG', () => {
  const s = service({items:photos});
  s.setWeb(() => reply('JPEGFROMHEIC', 'image/jpeg'));
  const result = s.call({action:'drive_download', fileId:HEIC, mode:'display'});
  assert.equal(result.resized, true);
  assert.equal(Buffer.from(result.data, 'base64').toString(), 'JPEGFROMHEIC');
});

test('ảnh nhỏ: tải song song bằng fetchAll (2 lượt), tệp lỗi quay về getThumbnail', () => {
  const s = service({items:photos});
  s.thumbs[TINY] = [7, 7];
  s.setWeb((url) => url.includes('/drive/v3/files/') ? reply({thumbnailLink:url.includes(BIG) ? 'https://lh3.googleusercontent.com/x/big=s220' : ''}) : reply('THUMB', 'image/jpeg'));
  const result = s.call({action:'drive_thumbnails', fileIds:[BIG, TINY]});
  assert.equal(result.ok, true);
  assert.equal(s.calls.fetchAll.length, 2);
  assert.equal(s.calls.fetchAll[1].length, 1);
  assert.match(s.calls.fetchAll[1][0], /big=s320$/);
  assert.equal(Buffer.from(result.items[0].data, 'base64').toString(), 'THUMB');
  assert.deepEqual([...Buffer.from(result.items[1].data, 'base64')], [7, 7]);
});

test('ảnh nhỏ: fetchAll hỏng hẳn vẫn trả kết quả bằng cách cũ', () => {
  const s = service({items:photos});
  s.thumbs[BIG] = [5];
  s.setWeb(() => { throw new Error('quota'); });
  const result = s.call({action:'drive_thumbnails', fileIds:[BIG, 'notFoundFile0001']});
  assert.equal(result.ok, true);
  assert.deepEqual([...Buffer.from(result.items[0].data, 'base64')], [5]);
  assert.equal(result.items[1].ok, false);
});

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const docxData = (head = [0x50, 0x4b, 3, 4]) => Buffer.from([...head, 1, 2, 3, 4]).toString('base64');
function withDocx(extra = {}) {
  const s = service();
  s.db.docxFile0000001 = {id:'docxFile0000001', name:'bao-cao.docx', mimeType:DOCX, parents:['folderAAAAAAAAAA'], size:'900', modifiedTime:'2026-11-01T00:00:00.000Z', capabilities:{canEdit:true}, ...extra};
  return s;
}

test('ghi đè nội dung .docx: kiểm tra xung đột thời gian sửa, gửi đúng mime, trả về bản ghi mới', () => {
  const s = withDocx();
  const result = s.call({action:'drive_update_content', fileId:'docxFile0000001', expectedModifiedTime:'2026-11-01T00:00:00.000Z', data:docxData()});
  assert.equal(result.ok, true);
  assert.equal(result.file.id, 'docxFile0000001');
  assert.equal(s.calls.update.length, 1);
  assert.equal(s.calls.update[0].id, 'docxFile0000001');
  assert.equal(s.calls.update[0].blob.mime, DOCX);
  assert.deepEqual(s.calls.update[0].blob.bytes.slice(0, 2), [0x50, 0x4b]);
});

test('ghi đè .docx: từ chối khi tệp đã bị người khác sửa trên Drive', () => {
  const s = withDocx({modifiedTime:'2026-11-02T00:00:00.000Z'});
  const result = s.call({action:'drive_update_content', fileId:'docxFile0000001', expectedModifiedTime:'2026-11-01T00:00:00.000Z', data:docxData()});
  assert.equal(result.ok, false);
  assert.match(result.error, /đã được thay đổi/);
  assert.equal(s.calls.update.length, 0);
});

test('ghi đè .docx: chặn dữ liệu sai, tệp không phải Word, tệp không có quyền sửa, thùng rác, thư mục hệ thống', () => {
  const base = {action:'drive_update_content', fileId:'docxFile0000001', data:docxData()};
  assert.match(withDocx().call({...base, data:docxData([0x25, 0x50, 0x44, 0x46])}).error, /không phải tệp Word/);
  assert.match(withDocx().call({...base, data:'***'}).error, /Dữ liệu tệp không hợp lệ/);
  assert.match(withDocx().call({...base, data:''}).error, /đang trống/);
  assert.match(withDocx({mimeType:'application/pdf', name:'a.pdf'}).call(base).error, /Chỉ ghi đè được tệp Word/);
  assert.match(withDocx({capabilities:{canEdit:false}}).call(base).error, /không có quyền sửa/);
  assert.match(withDocx({trashed:true}).call(base).error, /thùng rác/);
  assert.equal(withDocx().call({...base, fileId:'formsRootFolder001'}).ok, false);
  const big = withDocx();
  assert.match(big.call({...base, data:Buffer.alloc(10 * 1024 * 1024 + 1, 1).toString('base64')}).error, /10 MB/);
  assert.equal(big.calls.update.length, 0);
});
