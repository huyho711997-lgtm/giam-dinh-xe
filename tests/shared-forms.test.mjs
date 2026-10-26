import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/documents/shared-forms-store.js',import.meta.url),'utf8');
function setup() {
  const records = {}, requests = [], listeners = new Map();
  let profile = {uid:'owner',email:'owner@example.test'}, uploadStatus = 200, failWrite = false, beforeUpload = () => {};
  const read = path => path.split('/').reduce((record,key) => record?.[key],records);
  const write = (path,value) => {
    if (failWrite) throw new Error('PERMISSION_DENIED');
    const parts = path.split('/');
    let parent = records;
    for (const part of parts.slice(0,-1)) parent = parent[part] ??= {};
    if (value === null) delete parent[parts.at(-1)]; else parent[parts.at(-1)] = structuredClone(value);
  };
  const ref = path => ({
    key:'uploaded-file',
    push:() => ref(path + '/uploaded-file'),
    set:async value => write(path,value),
    update:async values => write(path,{...read(path),...values}),
    remove:async () => write(path,null),
    once:async () => ({val:() => read(path) || null}),
    on:(_event,callback) => { listeners.set(path,callback); callback({val:() => read(path) || null}); },
    off:(_event,callback) => { if (listeners.get(path) === callback) listeners.delete(path); }
  });
  const context = vm.createContext({URL,AbortSignal,Date,Promise,structuredClone,console,
    window:{location:{href:'https://example.test/giam-dinh-xe/',origin:'https://example.test'}},
    firebase:{auth:() => ({currentUser:profile})},dbNodeInstance:{ref},activeUserProfile:{displayName:'Người tải'},
    hasUserPermission:() => context.isAdmin === true,
    getCloudinaryConfig:() => ({cloudName:'fixture-cloud',preset:'fixture-preset',folder:'fixture-folder'}),
    FormData:class { values = {}; append(name,value) { this.values[name] = value; } },
    XMLHttpRequest:class {
      upload = {};
      open(method,url) { this.method = method; this.url = url; }
      send(body) {
        requests.push({method:this.method,url:this.url,body:body.values});
        queueMicrotask(() => {
          beforeUpload();
          this.status = uploadStatus;
          this.responseText = JSON.stringify(uploadStatus === 200 ? {secure_url:'https://res.cloudinary.com/fixture-cloud/raw/upload/sample.docx',public_id:'sample.docx'} : {error:{message:'Preset rejects raw files'}});
          this.upload.onprogress?.({lengthComputable:true,loaded:1,total:2});
          this.onload();
        });
      }
    },
    fetch:async () => { throw new Error('Unexpected network request'); }
  });
  vm.runInContext(source,context);
  const store = vm.runInContext('SharedFormsStore',context);
  return {store,context,records,requests,listeners,read,write,setUser:value => { profile = value; },rejectUploads:() => { uploadStatus = 400; },rejectWrites:() => { failWrite = true; },beforeUpload:callback => { beforeUpload = callback; }};
}
const documentFile = {name:'Bieu mau.docx',size:1024,type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};

test('validates type, empty files and 20 MB boundary before any upload',() => {
  const {store} = setup();
  assert.equal(store.validateFile(documentFile),documentFile.type);
  assert.equal(store.validateFile({...documentFile,size:20*1024*1024}),documentFile.type);
  for (const file of [{...documentFile,name:'payload.html'},{...documentFile,size:0},{...documentFile,size:20*1024*1024+1}]) assert.throws(() => store.validateFile(file));
});
test('rejects executable URLs and accepts project-relative template links',() => {
  const {store} = setup();
  assert.equal(store.safeUrl('javascript:alert(1)'),'');
  assert.equal(store.safeUrl('data:text/html,<script></script>'),'');
  assert.equal(store.safeUrl('http://outside.test/file.pdf'),'');
  assert.equal(store.safeUrl('assets/templates/tnds-advance.docx'),'https://example.test/giam-dinh-xe/assets/templates/tnds-advance.docx');
});
test('recognizes types from original filename even after display name changes',() => {
  const {store} = setup();
  assert.equal(store.kind({name:'Tờ trình',originalName:'sample.DOCX'}),'word');
  assert.equal(store.kind({name:'Báo cáo',originalName:'report.xlsx'}),'sheet');
  assert.equal(store.kind({name:'Ảnh',originalName:'image.webp'}),'image');
  assert.equal(store.kind({name:'Thư mục',mimeType:'application/vnd.google-apps.folder'}),'folder');
  assert.equal(store.normalize('ĐỀ NGHỊ BỒI THƯỜNG'),'de nghi boi thuong');
});
test('uploads raw document then stores shared metadata with authenticated ownership',async () => {
  const fixture = setup();
  const progress = [];
  const file = await fixture.store.upload(documentFile,{name:'Tờ trình',category:'Bồi thường',notes:'Bản mới'},value => progress.push(value));
  assert.equal(fixture.requests[0].url,'https://api.cloudinary.com/v1_1/fixture-cloud/raw/upload');
  assert.equal(fixture.requests[0].body.folder,'fixture-folder/shared_forms');
  assert.equal(file.createdByUid,'owner');
  assert.equal(file.originalName,documentFile.name);
  assert.equal(file.name,'Tờ trình');
  assert.equal(fixture.read('shared_forms/files/uploaded-file').category,'Bồi thường');
  assert.ok(progress[0] > 0 && progress[0] < 100);
  assert.equal(progress.at(-1),100);
});
test('upload rejection does not create a shared record',async () => {
  const fixture = setup();
  fixture.rejectUploads();
  await assert.rejects(fixture.store.upload(documentFile,{}),/Preset rejects raw files/);
  assert.equal(fixture.read('shared_forms/files'),undefined);
});
test('reports metadata permission failure without claiming upload success',async () => {
  const fixture = setup();
  fixture.rejectWrites();
  await assert.rejects(fixture.store.upload(documentFile,{}),/chưa ghi được danh sách/);
});
test('does not attach an upload after authentication changes',async () => {
  const fixture = setup();
  fixture.beforeUpload(() => fixture.setUser({uid:'another-user'}));
  await assert.rejects(fixture.store.upload(documentFile,{}),/Phiên đăng nhập đã thay đổi/);
  assert.equal(fixture.read('shared_forms/files'),undefined);
});
test('restricts edit/delete to owner or admin, preserving template assets',async () => {
  const fixture = setup();
  const file = await fixture.store.upload(documentFile,{});
  await fixture.store.update(file,{name:'Tên mới',category:'Kế toán',notes:'Bản 2'});
  assert.equal(fixture.read('shared_forms/files/uploaded-file').name,'Tên mới');
  fixture.setUser({uid:'other'});
  await assert.rejects(fixture.store.update(file,{name:'Denied'}),/chỉ được sửa/);
  await assert.rejects(fixture.store.remove(file),/không có quyền/);
  fixture.context.isAdmin = true;
  assert.equal(fixture.store.canManage(fixture.store.builtins()[0]),false);
  await fixture.store.remove(file);
  assert.equal(fixture.read('shared_forms/files/uploaded-file'),undefined);
});
test('only admins may delete Google Drive forms, and never folders',async () => {
  const fixture = setup();
  const driveFile = {id:'1abcDEFghiJKLmnop',name:'Quy tac.pdf',source:'drive',mimeType:'application/pdf'};
  const folder = {...driveFile,id:'1folderFolderFolder',mimeType:'application/vnd.google-apps.folder'};
  assert.equal(fixture.store.canDeleteDrive(driveFile),false);
  await assert.rejects(fixture.store.removeFromDrive(driveFile,'1rootRootRootRoot'),/Chỉ quản trị viên/);
  fixture.context.isAdmin = true;
  assert.equal(fixture.store.canDeleteDrive(driveFile),true);
  assert.equal(fixture.store.canDeleteDrive(folder),false);
  assert.equal(fixture.store.canDeleteDrive({...driveFile,source:'upload'}),false);
});
test('requires authentication before listing and uploading',async () => {
  const fixture = setup();
  fixture.setUser(null);
  assert.throws(() => fixture.store.subscribe(() => {},() => {}),/đăng nhập/);
  await assert.rejects(fixture.store.upload(documentFile,{}),/đăng nhập/);
  assert.equal(fixture.requests.length,0);
});
test('realtime subscription returns a matching cleanup callback',() => {
  const fixture = setup();
  const events = [];
  const stop = fixture.store.subscribe(items => events.push(items),() => {});
  assert.equal(events.length,1);
  assert.equal(fixture.listeners.size,1);
  stop();
  assert.equal(fixture.listeners.size,0);
});
test('accepts only Google Drive folder URLs or valid IDs',() => {
  const {store} = setup();
  assert.equal(store.parseFolder('https://drive.google.com/drive/u/0/folders/valid_folder-123?usp=sharing'),'valid_folder-123');
  assert.equal(store.parseFolder('valid_folder-123'),'valid_folder-123');
  for (const value of ['https://evil.test/drive/folders/valid_folder-123','https://drive.google.com/file/d/valid_folder-123/view',"valid' or trashed=true",'short']) assert.equal(store.parseFolder(value),'');
});
test('reads every Drive result page, including empty pages with nextPageToken',async () => {
  const fixture = setup();
  const urls = [];
  fixture.context.fetch = async url => {
    urls.push(String(url));
    return {ok:true,json:async () => urls.length === 1 ? {files:[],nextPageToken:'next-token'} : {files:[{id:'file_12345678',name:'Template.pdf',mimeType:'application/pdf'}]}};
  };
  const files = await fixture.store.listDrive('folder_12345678',{apiKey:'fixture-key'});
  assert.equal(files.length,1);
  assert.equal(files[0].source,'drive');
  assert.equal(new URL(urls[1]).searchParams.get('pageToken'),'next-token');
});
test('validates Drive metadata before saving admin settings',async () => {
  const fixture = setup();
  await assert.rejects(fixture.store.saveDriveConfig({folderId:'folder_12345678',apiKey:'key'}),/quản trị viên/);
  fixture.context.isAdmin = true;
  fixture.context.fetch = async () => ({ok:true,json:async () => ({mimeType:'application/pdf'})});
  await assert.rejects(fixture.store.saveDriveConfig({folderId:'folder_12345678',apiKey:'key'}),/không phải liên kết một file/);
  assert.equal(fixture.read('shared_forms/drive'),undefined);
  fixture.context.fetch = async () => ({ok:true,json:async () => ({mimeType:'application/vnd.google-apps.folder'})});
  await fixture.store.saveDriveConfig({folderId:'folder_12345678',apiKey:'key',folderName:'Kho mẫu'});
  assert.equal((await fixture.store.loadDriveConfig()).folderName,'Kho mẫu');
});
test('uses the configured Drive folder without an API key and respects explicit disconnect',async () => {
  const fixture = setup();
  fixture.context.CONFIG = {SHARED_FORMS_DRIVE_FOLDER_ID:'1uPf8jI8nOnl8KW9j4JRpnXSkfTswIxD5',SHARED_FORMS_DRIVE_FOLDER_NAME:'Biểu mẫu bồi thường Tasco'};
  const preset = await fixture.store.loadDriveConfig();
  assert.equal(preset.folderId,'1uPf8jI8nOnl8KW9j4JRpnXSkfTswIxD5');
  assert.equal(preset.apiKey,'');
  fixture.context.isAdmin = true;
  await fixture.store.saveDriveConfig(null);
  assert.equal(await fixture.store.loadDriveConfig(),null);
});
test('reads bundled Drive catalog and nested folders without exposing a different configured repository',async () => {
  const fixture = setup();
  const requests = [];
  fixture.context.fetch = async (url,options) => {
    requests.push({url,options});
    return {ok:true,json:async () => ({rootFolderId:'root_folder_123',syncedAt:'2026-10-22T00:00:00Z',folders:{nested_folder_123:{files:[{id:'drive_file_123',name:'Biểu mẫu.doc',mimeType:'application/msword'}]}}})};
  };
  const files = await fixture.store.listDrive('nested_folder_123',{folderId:'root_folder_123',apiKey:''});
  assert.equal(files[0].name,'Biểu mẫu.doc');
  assert.equal(files[0].source,'drive');
  assert.equal(requests[0].url,'js/data/shared-forms-drive.json');
  assert.equal(requests[0].options.cache,'no-cache');
  await assert.rejects(fixture.store.listDrive('nested_folder_123',{folderId:'other_root_123',apiKey:''}),/API key/);
});
test('bundled catalog has every indexed subfolder and valid public Drive IDs',() => {
  const catalog = JSON.parse(fs.readFileSync(new URL('../js/data/shared-forms-drive.json',import.meta.url),'utf8'));
  assert.equal(catalog.rootFolderId,'1uPf8jI8nOnl8KW9j4JRpnXSkfTswIxD5');
  assert.ok(catalog.folders[catalog.rootFolderId].files.length > 0);
  for (const folder of Object.values(catalog.folders)) {
    for (const file of folder.files) {
      assert.match(file.id,/^[A-Za-z0-9_-]{8,}$/);
      assert.ok(file.name);
      if (file.mimeType === 'application/vnd.google-apps.folder') assert.ok(catalog.folders[file.id]);
    }
  }
});
