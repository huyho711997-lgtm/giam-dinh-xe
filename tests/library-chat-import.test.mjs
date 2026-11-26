import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function setup(admin = true, failSave = false) {
  const writes = [], events = {};
  const field = value => ({value, checked:true, addEventListener(name, fn) { this[name] = fn; }});
  const save = field('');
  const nodes = {'[data-dl-back]':field(''), '[data-dl-save]':save, '[data-dl-addchunk]':field(''), '[data-dl-err]':{innerHTML:'',scrollIntoView(){}}, '[data-title="0"]':field('Điều 1'), '[data-text="0"]':field('Nội dung nguyên văn'), '[data-keep="0"]':field('')};
  const body = {innerHTML:'', querySelector:selector => nodes[selector], querySelectorAll:selector => selector === '[data-f]' ? [{dataset:{f:'ten'}, value:'Quy tắc thử'}] : []};
  const foot = {innerHTML:'', querySelector:selector => nodes[selector]};
  const overlay = {className:'', innerHTML:'', addEventListener(){}, remove(){}, querySelector:selector => selector === '.dlib-body' ? body : selector === '.dlib-foot' ? foot : null};
  const document = {createElement:() => overlay, addEventListener(){}, body:{appendChild(){}}};
  const ctx = vm.createContext({document, activeUserProfile:{role:admin ? 'admin' : 'user'}, TascoLibParse:{MAX_CHUNKS:600,fromText:(text) => ({meta:{ten:'Quy tắc thử'},chunks:[{t:'Điều 1',x:text}]}), fromFile:async file => ({meta:{ten:file.name},chunks:[{t:'Điều 1',x:'Nội dung nguyên văn'}]})}, TascoLibStore:{saveParts:async data => {if(failSave) throw Error('permission denied'); writes.push(data); return ['new-id'];}}, localStorage:{getItem:() => null}, triggerToast() {}, console});
  vm.runInContext(fs.readFileSync(new URL('../js/features/ai/library-ui.js',import.meta.url),'utf8') + '\nthis.api=TascoLibrary;',ctx);
  return {api:ctx.api,writes,save,events};
}

test('nhập từ chat chỉ ghi sau khi bấm lưu và báo thành công sau khi ghi', async () => {
  const env=setup(); let saved;
  await env.api.importFromChat({text:'Nội dung nguyên văn',onSaved:value => {saved=value;}});
  assert.equal(env.writes.length,0);
  await env.save.click({currentTarget:env.save});
  assert.equal(env.writes.length,1);
  assert.equal(env.writes[0].chunks[0].x,'Nội dung nguyên văn');
  assert.equal(saved.id,'new-id');
});

test('tài khoản không có quyền quản trị không thể bắt đầu nhập', async () => {
  const env=setup(false);
  await assert.rejects(env.api.importFromChat({text:'Nội dung'}),/quản trị viên/);
  assert.equal(env.writes.length,0);
});

test('lỗi ghi cơ sở dữ liệu không báo lưu thành công', async () => {
  const env=setup(true,true); let saved=false;
  await env.api.importFromChat({text:'Nội dung',onSaved:() => {saved=true;}});
  await env.save.click({currentTarget:env.save});
  assert.equal(saved,false);
  assert.equal(env.writes.length,0);
  assert.equal(env.save.disabled,false);
});
