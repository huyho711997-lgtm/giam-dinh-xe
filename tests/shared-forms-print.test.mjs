import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import test from 'node:test';

const source = fs.readFileSync(new URL('../js/features/documents/shared-forms-print.js',import.meta.url),'utf8');
function setup() {
  const entry = {source:'drive',sourceModifiedTime:'2023-12-07T00:00:00Z',sourceSha256:'a'.repeat(64),url:'assets/shared-form-previews/file_12345678.pdf',size:100};
  const manifest = {version:1,rootFolderId:'folder_12345678',catalogAt:'2026-10-22T00:00:00Z',files:{file_12345678:entry}};
  const context = {crypto:webcrypto,Uint8Array,fetch:async () => ({ok:true,json:async () => manifest})};
  vm.createContext(context);
  vm.runInContext(source + '\nglobalThis.printing = SharedFormsPrint;',context);
  const file = {id:'file_12345678',source:'drive',name:'Mẫu.doc',modifiedTime:entry.sourceModifiedTime,catalogAt:manifest.catalogAt};
  return {printing:context.printing,context,manifest,entry,file,config:{folderId:manifest.rootFolderId,apiKey:''}};
}
test('uses the Word PDF only for the exact bundled Drive snapshot and preserves the source record',async () => {
  const fixture = setup();
  const result = await fixture.printing.resolve(fixture.file,fixture.config);
  assert.equal(result.source,'print');
  assert.equal(result.url,fixture.entry.url + '?v=' + fixture.entry.sourceSha256);
  assert.equal(result.mimeType,'application/pdf');
  assert.equal(fixture.file.source,'drive');
});
test('rejects old snapshots, another folder, changed source and arbitrary preview URLs',async () => {
  for (const change of [
    fixture => { fixture.file.catalogAt = 'old'; },
    fixture => { fixture.config.folderId = 'another_folder'; },
    fixture => { fixture.file.modifiedTime = 'new'; },
    fixture => { fixture.entry.url = 'https://outside.test/file.pdf'; },
    fixture => { fixture.entry.source = 'builtin'; }
  ]) {
    const fixture = setup(); change(fixture);
    assert.equal(await fixture.printing.resolve(fixture.file,fixture.config),null);
  }
});
test('checks the actual original bytes before reusing a PDF for live Drive or built-in files',async () => {
  const data = new TextEncoder().encode('original word document');
  const digest = Buffer.from(await webcrypto.subtle.digest('SHA-256',data)).toString('hex');
  for (const sourceType of ['drive','builtin']) {
    const fixture = setup();
    fixture.file.source = fixture.entry.source = sourceType;
    fixture.file.url = fixture.entry.sourceUrl = 'assets/templates/source.docx';
    fixture.entry.sourceSha256 = digest;
    fixture.config.apiKey = 'live-key';
    assert.ok(await fixture.printing.resolve(fixture.file,fixture.config,null,async () => data));
    assert.equal(await fixture.printing.resolve(fixture.file,fixture.config,null,async () => new TextEncoder().encode('new version')),null);
  }
});
test('does not use cached previews for user uploads or hide an aborted load',async () => {
  const fixture = setup();
  assert.equal(await fixture.printing.resolve({...fixture.file,source:'app'},fixture.config),null);
  fixture.context.fetch = async () => { throw Object.assign(new Error('cancelled'),{name:'AbortError'}); };
  await assert.rejects(fixture.printing.resolve(fixture.file,fixture.config),{name:'AbortError'});
});
test('declares each PDF page at its original paper size without an additional print margin',() => {
  const {printing} = setup();
  assert.equal(printing.pageRule(1,595.3,841.9),'@page sfPage1{size:595.300pt 841.900pt;margin:0}');
  assert.equal(printing.pageRule(2,841.9,595.3),'@page sfPage2{size:841.900pt 595.300pt;margin:0}');
  for (const values of [[0,0,800],[1,Infinity,842],[-1,595,842],[0,595,NaN]]) assert.throws(() => printing.pageRule(...values));
});
test('waits for fonts and images and cancels stale print requests',async () => {
  const {printing} = setup();
  const calls = [];
  const doc = {fonts:{ready:Promise.resolve()},images:[{decode:async () => calls.push('image')}],defaultView:{requestAnimationFrame:callback => callback()}};
  const frame = {contentDocument:doc,contentWindow:{focus:() => calls.push('focus'),print:() => calls.push('print')}};
  await printing.print(frame,'Mẫu.doc',() => false);
  assert.deepEqual(calls,['image']);
  calls.length = 0;
  await printing.print(frame,'Mẫu.doc');
  assert.deepEqual(calls,['image','focus','print']);
  assert.equal(doc.title,'Mẫu.doc');
});
test('does not silently print a document with missing images',async () => {
  const {printing} = setup();
  const doc = {fonts:{ready:Promise.resolve()},images:[{decode:async () => { throw new Error('image unavailable'); }}]};
  await assert.rejects(printing.print({contentDocument:doc,contentWindow:{print:() => assert.fail('must not print incomplete content')}},'Mẫu.doc'),/image unavailable/);
});
test('every shipped preview is a real PDF for a root template or an existing built-in, not a nested claim',async () => {
  const catalog = JSON.parse(fs.readFileSync(new URL('../js/data/shared-forms-drive.json',import.meta.url),'utf8'));
  const manifest = JSON.parse(fs.readFileSync(new URL('../js/data/shared-forms-print.json',import.meta.url),'utf8'));
  assert.equal(manifest.engine,'Microsoft Word');
  assert.equal(manifest.catalogAt,catalog.syncedAt);
  const templates = catalog.folders[catalog.rootFolderId].files.filter(file => /\.docx?$/.test(file.name));
  assert.equal(Object.keys(manifest.files).length,templates.length + 3);
  const fixture = setup();
  fixture.context.fetch = async () => ({ok:true,json:async () => manifest});
  for (const [id,entry] of Object.entries(manifest.files)) {
    if (entry.source === 'drive') {
      const file = templates.find(file => file.id === id);
      assert.ok(file);
      const resolved = await fixture.printing.resolve({...file,source:'drive',catalogAt:catalog.syncedAt},{folderId:catalog.rootFolderId});
      assert.equal(resolved?.url,entry.url + '?v=' + entry.sourceSha256);
    }
    else assert.ok(['builtin_tnds','builtin_collection','builtin_scene_blank'].includes(id));
    const pdf = fs.readFileSync(new URL('../' + entry.url,import.meta.url));
    assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
    assert.equal(pdf.length,entry.size);
    assert.ok(entry.pages > 0);
    assert.match(entry.sourceSha256,/^[a-f0-9]{64}$/);
  }
});
