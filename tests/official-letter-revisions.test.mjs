import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL('../js/' + name, import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(read('data/official-letter-templates.js') + read('features/documents/official-letter-core.js') + read('features/documents/official-letter-revisions.js') + '\nthis.R=OfficialLetterRevisions;this.C=OfficialLetterCore;', context);
const {R, C} = context;
const plain = value => JSON.parse(JSON.stringify(value));
const letter = () => C.assembleLetter(C.findTemplate('tu_do'), {recipient:'Khách hàng A'}, {signerName:'Người ký'}, {subject:'xử lý hồ sơ', paragraphs:[{type:'p', text:'Giữ đầu. Đề nghị cung cấp hồ sơ. Giữ cuối.'}, {type:'p', text:'Đoạn người dùng đã sửa tay.'}], warnings:[]});
const target = doc => ({path:'para:0', start:9, end:30, before:doc.paragraphs[0].text});

test('sửa vùng bôi đen giữ nguyên tiền tố, hậu tố, các đoạn khác và phần thể thức', () => {
  const before = letter(), scope = target(before);
  const after = R.parsePatch(JSON.stringify({replacements:[{path:'para:0', text:'Xin bổ sung tài liệu.'}]}), before, [scope]);
  assert.equal(after.paragraphs[0].text, scope.before.slice(0,9) + 'Xin bổ sung tài liệu.' + scope.before.slice(30));
  assert.equal(after.paragraphs[1].text, before.paragraphs[1].text);
  assert.deepEqual(plain({...after, paragraphs:before.paragraphs}), plain(before));
  assert.notEqual(after, before);
});

test('chỉnh nhiều đoạn theo path, không phụ thuộc thứ tự AI trả về', () => {
  const before = letter();
  const targets = [target(before), {path:'para:1', before:before.paragraphs[1].text, start:0, end:4}];
  const after = R.parsePatch({replacements:[{path:'para:1', text:'Nội dung'}, {path:'para:0', text:'Xin hỗ trợ.'}]}, before, targets);
  assert.match(after.paragraphs[1].text, /^Nội dung người dùng/);
});

test('từ chối vị trí ngoài phạm vi, path trùng, thiếu đoạn, quá dài và nội dung trống', () => {
  const doc = letter(), scopes = [target(doc)];
  for (const replacements of [[], [{path:'para:1', text:'lạc phạm vi'}], [{path:'para:0', text:'a'}, {path:'para:0', text:'b'}], [{path:'para:0', text:'x'.repeat(2501)}]]) assert.throws(() => R.parsePatch({replacements}, doc, scopes));
  assert.throws(() => R.parsePatch({replacements:[{path:'para:1', text:''}]}, doc, [{path:'para:1', start:0, end:doc.paragraphs[1].text.length, before:doc.paragraphs[1].text}]), /trống/);
  assert.throws(() => R.parsePatch('không phải JSON', doc, scopes), /không đọc được/);
});

test('phạm vi lỗi hoặc đã cũ bị chặn trước khi tạo yêu cầu AI', () => {
  const doc = letter();
  for (const item of [{...target(doc), before:'cũ'}, {...target(doc), start:-1}, {...target(doc), end:999}, {...target(doc), start:1.5}, {...target(doc), end:9}, {...target(doc), path:'__proto__'}]) assert.throws(() => R.validateTargets(doc, [item]));
  const request = R.buildRequest({contents:[{parts:[{text:'Ngữ cảnh hồ sơ'}]}]}, doc, [target(doc)], 'Ngắn hơn');
  assert.equal(request.generationConfig.responseMimeType, 'application/json');
  assert.equal(JSON.parse(request.contents[0].parts[0].text).targets[0].text, doc.paragraphs[0].text.slice(9,30));
});

test('so sánh và áp dụng từng thay đổi; bản hiện tại phải khớp bản trước khi AI sửa', () => {
  const before = letter(), after = plain(before);
  after.subject = 'trích yếu mới'; after.paragraphs[0].text = 'Đoạn mới';
  const changes = R.changes(before, after);
  changes.find(item => item.path === 'subject').on = false;
  const next = R.applyChanges(before, {before, changes});
  assert.equal(next.subject, before.subject);
  assert.equal(next.paragraphs[0].text, 'Đoạn mới');
  assert.throws(() => R.applyChanges({...before, number:'sửa tay'}, {before, changes}), /đã thay đổi/);
  const structural = plain(after); structural.paragraphs.push({type:'li', text:'Thêm ý'});
  assert.ok(R.changes(before, structural).some(change => change.path === 'paragraphs'));
});

test('diff tái tạo chính xác chữ cũ/mới, kể cả Unicode, HTML và đoạn dài', () => {
  for (const [a,b] of [['Đề nghị cung cấp hồ sơ.', 'Kính đề nghị bổ sung hồ sơ.'], ['<img onerror=x>', '<script>x</script>'], ['','Thêm'], ['Xóa',''], ['dài '.repeat(700),'mới '.repeat(700)]]) {
    const parts = R.diff(a,b);
    assert.equal(parts.filter(p => p.kind !== 'ins').map(p => p.text).join(''), a);
    assert.equal(parts.filter(p => p.kind !== 'del').map(p => p.text).join(''), b);
  }
});

test('phiên bản chụp độc lập, bỏ trùng liên tiếp và giữ tối đa 12 bản mới nhất', () => {
  const doc = letter(); let versions = R.checkpoint([], doc, 'Đầu', 1700000000000);
  doc.subject = 'Sửa tay'; assert.notEqual(versions[0].letter.subject, doc.subject);
  versions = R.checkpoint(versions, doc, 'Sửa', 1700000000001);
  assert.equal(R.checkpoint(versions, doc, 'Không đổi').length, 2);
  for (let i=0;i<20;i++) { doc.subject = 'Sửa ' + i; versions = R.checkpoint(versions, doc, 'Bản ' + i); }
  assert.equal(versions.length, 12); assert.equal(versions.at(-1).letter.subject, 'Sửa 19');
  assert.equal(R.restoreVersions(versions, C.sanitizeLetter).length, 12);
  assert.equal(R.restoreVersions(undefined, C.sanitizeLetter).length, 0);
});

test('giới hạn dung lượng lịch sử chỉ bỏ bản cũ, giữ nguyên nội dung hiện tại', () => {
  const doc = letter(); doc.paragraphs[0].text = 'v'.repeat(2400);
  let versions = [];
  for(let i=0;i<12;i++) { doc.subject = 'Bản ' + i; versions = R.checkpoint(versions, doc, 'Lưu'); }
  const result = R.fitSnapshot({letter:doc, brief:'b'.repeat(120000), versions});
  assert.ok(JSON.stringify(result).length <= 145000);
  assert.ok(result.versions.length < 12);
  assert.deepEqual(plain(result.letter), plain(doc));
  assert.equal(result.versions.at(-1).letter.subject, 'Bản 11');
});

function setupPage(reply) {
  const saves = [], messages = [];
  const host = {querySelector:() => null, querySelectorAll:() => [], removeEventListener() {}};
  const ctx = vm.createContext({setTimeout, clearTimeout, AbortController, btoa:text => Buffer.from(text, 'binary').toString('base64'),
    document:{removeEventListener() {}}, window:{removeEventListener() {}}, localStorage:{getItem:() => null},
    triggerToast:(...args) => messages.push(args),
    OfficialLetterHistory:{save:async (id, entry) => { saves.push(plain(entry.data)); return {id:id || 'history123', scope:'browser'}; }, list:() => []},
    testReply:reply, testHost:host
  });
  vm.runInContext(read('data/official-letter-templates.js') + read('features/documents/official-letter-core.js') + read('features/documents/official-letter-revisions.js') + read('features/documents/official-letter-page.js').replace('return {mount, leave};', `
    host=testHost; renderAll=() => {}; updateHistory=() => {}; callAI=testReply;
    return {run, compose, acceptChanges, discardChanges, restoreVersion, restore, snapshot, saveHistory, reviewHtml, leave,
      state:() => st, set:values => Object.assign(st, values)};`) + '\nthis.page=OfficialLetterPage;', ctx);
  ctx.page.set({letter:plain(letter()), values:{recipient:'Khách hàng A'}, brief:'Yêu cầu', templateId:'tu_do'});
  return {page:ctx.page, state:() => ctx.page.state(), saves, messages, history:ctx.OfficialLetterHistory};
}

test('luồng sửa đoạn: lưu trước khi gọi AI, chưa áp dụng thì chưa đổi; bỏ đề xuất giữ bản gốc', async () => {
  let h; h = setupPage(async () => { assert.equal(h.saves.length, 1); return JSON.stringify({replacements:[{path:'para:0', text:'Xin hỗ trợ.'}]}); });
  const before = plain(h.state().letter); h.page.set({selection:[target(before)]});
  await h.page.compose('Ngắn hơn');
  assert.ok(h.state().pending); assert.deepEqual(plain(h.state().letter), before);
  h.page.discardChanges(); assert.equal(h.state().pending, null); assert.deepEqual(plain(h.state().letter), before);
});

test('áp dụng, lưu mở lại và khôi phục giữ được cả bản trước lẫn bản sau', async () => {
  const h = setupPage(async () => JSON.stringify({replacements:[{path:'para:0', text:'Xin hỗ trợ.'}]}));
  const before = plain(h.state().letter); h.page.set({selection:[target(before)]});
  await h.page.compose('Ngắn hơn'); h.page.acceptChanges();
  const after = plain(h.state().letter), data = plain(h.page.snapshot());
  assert.notDeepEqual(after, before); assert.equal(data.versions.length, 2);
  h.page.restore(data); assert.equal(h.state().versions.length, 2);
  h.page.restoreVersion(h.state().versions[0].id);
  assert.deepEqual(plain(h.state().letter), before);
  assert.ok(h.state().versions.some(item => R.same(item.letter, after)));
  h.page.restore({letter:before, values:{recipient:'A'}}); assert.equal(h.state().versions.length, 1, 'bản cũ chưa có versions vẫn mở được');
});

test('lỗi hoặc phản hồi muộn sau khi rời trang không thay thế bản thảo', async () => {
  const h = setupPage(async () => { throw Error('Mất mạng'); });
  const before = plain(h.state().letter); h.page.set({selection:[target(before)]});
  await h.page.compose('Sửa'); assert.deepEqual(plain(h.state().letter), before); assert.equal(h.state().pending, null);
  let resolve; const late = setupPage(() => new Promise(done => {resolve=done;})); late.page.set({selection:[target(before)]});
  const running = late.page.compose('Sửa'); await new Promise(done => setTimeout(done,0)); late.page.leave();
  resolve(JSON.stringify({replacements:[{path:'para:0', text:'Mới'}]})); await running;
  assert.deepEqual(plain(late.state().letter), before); assert.equal(late.state().pending, null);
});

test('lệnh lưu chạy tuần tự và giữ bản chụp tại thời điểm gọi', async () => {
  const h = setupPage(async () => ''), writes = []; let release;
  h.history.save = async (id, entry) => {
    writes.push({id, data:plain(entry.data)});
    if (writes.length === 1) await new Promise(done => {release=done;});
    return {id, scope:'browser'};
  };
  const first = h.page.saveHistory();
  h.state().letter.subject = 'Bản mới hơn'; const second = h.page.saveHistory();
  await new Promise(done => setTimeout(done,0));
  assert.equal(writes.length, 1); assert.notEqual(writes[0].data.letter.subject, 'Bản mới hơn');
  release(); await first; await second;
  assert.equal(writes[1].data.letter.subject, 'Bản mới hơn');
  assert.equal(writes[0].id, writes[1].id);
});

test('chữ đề xuất được escape khi hiển thị và Word chỉ xuất nội dung đã áp dụng', async () => {
  const h = setupPage(async () => JSON.stringify({replacements:[{path:'para:0', text:'<img onerror="x">Nội dung mới'}]}));
  const before = plain(h.state().letter); h.page.set({selection:[target(before)]});
  await h.page.compose('Sửa');
  assert.doesNotMatch(h.page.reviewHtml(), /<img/); assert.match(h.page.reviewHtml(), /&lt;img/);
  const xmlBefore = C.docxFiles(h.state().letter, '').find(file => file.path === 'word/document.xml').text;
  assert.doesNotMatch(xmlBefore, /Nội dung mới/);
  h.page.acceptChanges();
  const xmlAfter = C.docxFiles(h.state().letter, '').find(file => file.path === 'word/document.xml').text;
  assert.match(xmlAfter, /Nội dung mới/); assert.match(xmlAfter, /Đoạn người dùng đã sửa tay/);
  assert.doesNotMatch(xmlAfter, /Đề xuất chỉnh sửa|Dùng thay đổi/);
});

test('soạn lại theo yêu cầu mới cũng cần duyệt trước khi thay thế bản cũ', async () => {
  let calls = 0;
  const h = setupPage(async () => ++calls === 1 ? '{"fields":{"recipient":"A"},"outline":["Nội dung"]}' : '{"subject":"bản mới","paragraphs":[{"type":"p","text":"Công văn mới."}]}');
  const before = plain(h.state().letter);
  await h.page.run();
  assert.equal(calls, 2); assert.ok(h.state().pending);
  assert.deepEqual(plain(h.state().letter), before);
  h.page.discardChanges(); assert.deepEqual(plain(h.state().letter), before);
});

test('sửa vùng bôi đen vẫn gửi tệp đính kèm và không gọi AI hai lần sau khi ghép remote', async () => {
  let calls = 0;
  const h = setupPage(async request => {
    calls++;
    const files = request.contents[0].parts.filter(part => part.inlineData);
    assert.equal(files.length, 1); assert.equal(files[0].inlineData.mimeType, 'application/pdf');
    return '{"replacements":[{"path":"para:0","text":"Nội dung theo tài liệu."}]}';
  });
  const before = plain(h.state().letter);
  h.page.set({selection:[target(before)], refineFiles:[{url:'', file:{name:'ho-so.pdf', type:'application/pdf', size:3, arrayBuffer:async () => new Uint8Array([1,2,3]).buffer}}]});
  await h.page.compose('Sửa theo tệp đính kèm');
  assert.equal(calls, 1); assert.ok(h.state().pending); assert.equal(h.state().refineFiles.length, 0);
  assert.deepEqual(plain(h.state().letter), before);
});
