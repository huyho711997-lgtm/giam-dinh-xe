import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/documents/official-letter-history.js', import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
// Firebase giả: lưu theo đường dẫn phẳng, hỗ trợ once / update (đa đường dẫn, null = xoá).
function setup({ uid = 'u1', failWrite = false, failRead = false, local = {} } = {}) {
  const tree = {}, ls = { ...local };
  const get = path => path.split('/').filter(Boolean).reduce((node, key) => node && node[key], tree);
  const put = (path, value) => {
    const keys = path.split('/').filter(Boolean); let node = tree;
    keys.slice(0, -1).forEach(key => { node[key] = node[key] || {}; node = node[key]; });
    if (value === null) delete node[keys.at(-1)]; else node[keys.at(-1)] = JSON.parse(JSON.stringify(value));
  };
  const db = { ref: path => ({
    once: async () => { if (failRead) throw new Error('denied'); return { val: () => get(path) ?? null }; },
    update: async updates => { if (failWrite) throw new Error('denied'); Object.entries(updates).forEach(([key, value]) => put(path + '/' + key, value)); }
  }) };
  const ctx = vm.createContext({ console, String, Number, Date, Math, Promise, Array, Object, JSON, Error,
    localStorage: { getItem: k => ls[k] ?? null, setItem: (k, v) => { ls[k] = v; }, removeItem: k => { delete ls[k]; } },
    firebase: { auth: () => ({ currentUser: uid ? { uid } : null }) }, dbNodeInstance: db });
  vm.runInContext(source + '\n;this.api = OfficialLetterHistory;', ctx);
  return { api: ctx.api, tree, ls };
}

test('lưu theo tài khoản: chỉ mục nhẹ tách khỏi nội dung, mở lại đúng dữ liệu, ghi đè cùng id', async () => {
  const { api, tree } = setup();
  await api.load();
  const first = await api.save('', { title: 'V/v đề nghị cung cấp hồ sơ', sub: '47A-123.45', data: { brief: 'xin biên bản', letter: { subject: 's' } } });
  assert.equal(first.scope, 'account');
  assert.match(first.id, /^[a-z0-9]{6,32}$/);
  assert.deepEqual(Object.keys(tree.user_letters.u1.index[first.id]).sort(), ['sub', 'title', 'updatedAt']);
  assert.equal(typeof tree.user_letters.u1.items[first.id].data, 'string');
  assert.deepEqual(plain(await api.get(first.id)), { brief: 'xin biên bản', letter: { subject: 's' } });
  const again = await api.save(first.id, { title: 'V/v mới', data: { brief: 'sửa' } });
  assert.equal(again.id, first.id);
  assert.equal(api.list().length, 1);
  assert.equal(api.list()[0].title, 'V/v mới');
  const fresh = setup(); Object.assign(fresh.tree, JSON.parse(JSON.stringify(tree)));
  assert.equal((await fresh.api.load()).length, 1, 'máy khác đăng nhập cùng tài khoản thấy lịch sử');
});

test('mất mạng/chưa có quyền → lưu trên trình duyệt; mới nhất trước; xoá được', async () => {
  const { api, ls } = setup({ failWrite: true });
  await api.load();
  const a = await api.save('', { title: 'A', data: { n: 1 } });
  const b = await api.save('', { title: 'B', data: { n: 2 } });
  assert.equal(a.scope, 'browser');
  assert.equal(api.scope(), 'browser');
  assert.ok(ls['officialLetter.history.v1:u1']);
  assert.deepEqual(plain(api.list().map(item => item.title)).sort(), ['A', 'B']);
  assert.deepEqual(plain(await api.get(b.id)), { n: 2 });
  await api.remove(a.id);
  assert.deepEqual(plain(api.list().map(item => item.title)), ['B']);
  assert.equal(JSON.parse(ls['officialLetter.history.v1:u1']).index[a.id], undefined);
});

test('chưa đăng nhập vẫn dùng được (trình duyệt); id lạ/hỏng bị bỏ qua; dữ liệu quá lớn bị từ chối', async () => {
  const { api } = setup({ uid: '', local: { 'officialLetter.history.v1:anon': JSON.stringify({ index: { 'BAD!': { title: 'x' }, abcdef12: { title: 'Hợp lệ', updatedAt: 5 } }, items: { abcdef12: '{"ok":1}' } }) } });
  const list = plain(await api.load());
  assert.deepEqual(list.map(item => item.id), ['abcdef12']);
  assert.deepEqual(plain(await api.get('abcdef12')), { ok: 1 });
  assert.equal(await api.get('../../x'), null);
  await assert.rejects(api.save('', { title: 'to', data: { x: 'a'.repeat(160000) } }), /quá dài/);
});

test('nhóm theo thời gian: Hôm nay / Hôm qua / 7 ngày / 30 ngày / Cũ hơn', () => {
  const { api } = setup();
  const now = new Date(2026, 10, 21, 15, 0).getTime(), day = 86400000;
  const groups = plain(api.groups([{ id: 'a', updatedAt: now - 3600000 }, { id: 'b', updatedAt: now - day }, { id: 'c', updatedAt: now - 3 * day }, { id: 'd', updatedAt: now - 20 * day }, { id: 'e', updatedAt: now - 90 * day }], now));
  assert.deepEqual(groups.map(group => group.label), ['Hôm nay', 'Hôm qua', '7 ngày qua', '30 ngày qua', 'Cũ hơn']);
});

test('removeMany xoá nhiều mục trong một lượt cập nhật (Firebase + localStorage) và bỏ qua id không hợp lệ', async () => {
  const { api, tree } = setup();
  await api.load();
  const a = await api.save('', { title: 'Công văn A', data: { n: 1 } });
  const b = await api.save('', { title: 'Công văn B', data: { n: 2 } });
  const c = await api.save('', { title: 'Công văn C', data: { n: 3 } });
  const removed = await api.removeMany([a.id, b.id, a.id, 'BAD!']);
  assert.equal(removed, 2);
  assert.deepEqual(plain(api.list().map(item => item.id)), [c.id]);
  assert.equal(tree.user_letters.u1.index[a.id], undefined);
  assert.equal(tree.user_letters.u1.items[b.id], undefined);
  assert.ok(tree.user_letters.u1.index[c.id]);
});

test('OfficialLetterPage: chọn nhiều đoạn chat (Hỏi nghiệp vụ) và công văn để xoá một lần', async () => {
  const read = name => fs.readFileSync(new URL('../js/' + name, import.meta.url), 'utf8');
  const ls = {};
  let confirmAnswer = true;
  const confirmCalls = [];
  const removedCalls = [];
  let histRows = [
    { id: 'letter01', title: 'V/v đề nghị cung cấp hồ sơ', sub: '47A-111.11', updatedAt: Date.now() - 1000 },
    { id: 'letter02', title: 'V/v thông báo kết quả giám định', sub: '47A-222.22', updatedAt: Date.now() - 2000 },
    { id: 'letter03', title: 'V/v từ chối bồi thường', sub: '47A-333.33', updatedAt: Date.now() - 3000 }
  ];
  const mockHistory = {
    list: () => histRows.slice(),
    remove: async id => { removedCalls.push([id]); histRows = histRows.filter(item => item.id !== id); },
    removeMany: async ids => { removedCalls.push(ids.slice()); const drop = new Set(ids); histRows = histRows.filter(item => !drop.has(item.id)); return ids.length; },
    groups: items => items.length ? [{ label: 'Hôm nay', items }] : [],
    scope: () => 'account'
  };
  const host = { querySelector: () => null, querySelectorAll: () => [], removeEventListener() {} };
  const ctx = vm.createContext({
    console, setTimeout, clearTimeout, Date, Math, Array, Object, Set, JSON, Promise, String, Number, Error,
    window: { removeEventListener() {}, innerWidth: 1280 },
    document: { removeEventListener() {} },
    localStorage: { getItem: k => ls[k] ?? null, setItem: (k, v) => { ls[k] = v; }, removeItem: k => { delete ls[k]; } },
    showPremiumConfirmModal: async opts => { confirmCalls.push(opts); return confirmAnswer; },
    triggerToast: () => {},
    OfficialLetterHistory: mockHistory,
    OfficialLetterQA: { newId: () => 'qa_' + Math.random().toString(36).slice(2, 8), normalizeStore: x => (x && x.messages) || [] },
    testHost: host
  });
  const expose = `host=testHost; renderAll=() => {}; updateHistory=() => {};
    return { toggleHistSelect, toggleHistPick, toggleHistSelectAll, deleteSelectedHistory, historyHtml, histBulkHtml, setMode,
      set: v => Object.assign(st, v), state: () => st, setQa: v => Object.assign(qa, v), qa: () => qa };`;
  vm.runInContext(
    read('data/official-letter-templates.js')
    + read('features/documents/official-letter-core.js')
    + read('features/documents/official-letter-revisions.js')
    + read('features/documents/official-letter-page.js').replace('return {mount, leave};', expose)
    + '\nthis.page = OfficialLetterPage;',
    ctx
  );

  const page = ctx.page;
  // 1) Chế độ Hỏi nghiệp vụ: chọn 2/3 đoạn chat (gồm cả đoạn đang mở) rồi xoá một lần
  page.set({ mode: 'ask', histOpen: true });
  page.setQa({
    activeId: 'c1',
    messages: [{ id: 'm1', role: 'user', text: 'Câu hỏi thuỷ kích' }],
    chats: [
      { id: 'c1', title: 'Câu hỏi thuỷ kích', at: Date.now() - 1000, messages: [{ id: 'm1', role: 'user', text: 'Câu hỏi thuỷ kích' }] },
      { id: 'c2', title: 'Câu hỏi miễn thường', at: Date.now() - 2000, messages: [{ id: 'm2', role: 'user', text: 'Câu hỏi miễn thường' }] },
      { id: 'c3', title: 'Thủ tục thuỷ kích động cơ', at: Date.now() - 3000, messages: [{ id: 'm3', role: 'user', text: 'Thủ tục thuỷ kích động cơ' }] }
    ]
  });

  page.toggleHistSelect(true);
  assert.equal(page.state().histSelect, true);
  assert.match(page.historyHtml(), /data-ol-hist-bulk/);
  assert.match(page.historyHtml(), /data-ol-hist-toggle="c1"/);

  // Lọc theo từ khoá "thuỷ kích" → "Chọn tất cả" chỉ chọn c1 và c3
  page.set({ histQuery: 'thuỷ kích' });
  page.toggleHistSelectAll();
  assert.deepEqual(plain(page.state().histPicked).sort(), ['c1', 'c3']);
  assert.match(page.histBulkHtml(), /Xoá 2 cuộc trò chuyện/);

  // Huỷ xác nhận → không xoá
  confirmAnswer = false;
  await page.deleteSelectedHistory();
  assert.equal(page.qa().chats.length, 3);
  assert.equal(page.state().histSelect, true);

  // Xác nhận xoá → xoá c1, c3, reset đoạn đang mở c1, giữ lại c2 và thoát chế độ chọn nhiều
  confirmAnswer = true;
  await page.deleteSelectedHistory();
  assert.deepEqual(plain(page.qa().chats.map(c => c.id)), ['c2']);
  assert.equal(page.qa().activeId, '');
  assert.equal(page.qa().messages.length, 0);
  assert.equal(page.state().histSelect, false);
  assert.equal(page.state().histPicked.length, 0);
  assert.match(confirmCalls.at(-1).title, /Xoá 2 cuộc trò chuyện/);

  // 2) Chế độ Soạn công văn: chọn 2 công văn rồi xoá một lần qua removeMany
  page.setMode('compose');
  page.set({ history: mockHistory.list(), historyId: 'letter01', histQuery: '' });
  page.toggleHistSelect(true);
  page.toggleHistPick('letter01');
  page.toggleHistPick('letter03');
  assert.match(page.histBulkHtml(), /Xoá 2 công văn/);
  await page.deleteSelectedHistory();
  assert.deepEqual(plain(removedCalls), [['letter01', 'letter03']]);
  assert.deepEqual(plain(page.state().history.map(h => h.id)), ['letter02']);
  assert.equal(page.state().historyId, '');
  assert.equal(page.state().histSelect, false);
});

test('index.html nạp official-letter-history.js trước trang Công văn AI', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const at = name => html.indexOf('js/features/documents/official-letter-' + name + '.js');
  assert.ok(at('history') > 0 && at('history') < at('page'));
});
