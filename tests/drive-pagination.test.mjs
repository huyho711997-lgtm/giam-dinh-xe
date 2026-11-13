import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/drive/drive-manager-page.js', import.meta.url), 'utf8');
const items = (start, count) => Array.from({length:count}, (_, i) => ({id:'file-' + (start + i), name:'Ảnh ' + (start + i) + '.jpg'}));
const deferred = () => { let resolve; const promise = new Promise(done => {resolve = done;}); return {promise, resolve}; };

function setup(list, storedSize = '20') {
  const calls = [], toasts = [], preferences = new Map([['drive-manager-page-size', storedSize]]);
  const pagers = [{hidden:true, innerHTML:''}, {hidden:true, innerHTML:''}];
  const main = {scrollIntoView() {}};
  const context = vm.createContext({
    AbortController, DOMException, Set, Map, console, clearTimeout,
    localStorage:{getItem:key => preferences.get(key), setItem:(key, value) => preferences.set(key, value)},
    document:{removeEventListener() {}},
    triggerToast:(...args) => toasts.push(args),
    DriveManagerApi:{list:async (options, signal) => {
      calls.push({options:structuredClone(options), signal});
      return list(options, signal);
    }}
  });
  // Thay phần dựng DOM bằng hai vùng phân trang; toàn bộ luồng tải/chuyển trang dùng mã thật.
  const instrumented = source.replace('return {mount, leave};', `
    host = {querySelectorAll:() => testPagers, querySelector:() => testMain, remove() {}};
    paint = () => paintPagination(); closeMenu = () => {}; closeDialog = () => {};
    return {load, goToPage, setPageSize, leave, newFolderDialog,
      criteria: values => { if ('query' in values) query=values.query; if ('type' in values) type=values.type; if ('sort' in values) sort=values.sort; if ('view' in values) view=values.view; if ('folderId' in values) folderId=values.folderId; },
      select: id => {selected.add(id); detailsId=id;},
      state: () => ({files, nextPageToken, pageIndex, pageSize, pageLoading, loading, errorText, pageCount:pages.length, path, folder, selected:[...selected], detailsId, range:pageRange()})};`);
  context.testPagers = pagers; context.testMain = main;
  vm.runInContext(instrumented + '\nthis.manager = DriveManager;', context);
  const manager = context.manager;
  return {manager, calls, pagers, toasts, preferences, context, state:() => JSON.parse(JSON.stringify(manager.state()))};
}

test('starts with 20 items and both pagers show the current page and a next page', async () => {
  const h = setup(() => ({files:items(1,20), nextPageToken:'server-token-2'}));
  await h.manager.load();
  assert.equal(h.calls[0].options.pageSize, 20);
  assert.equal(h.calls[0].options.pageToken, undefined);
  assert.equal(h.state().files.length, 20);
  assert.equal(h.state().range, '1–20 mục');
  for (const pager of h.pagers) {
    assert.equal(pager.hidden, false);
    assert.match(pager.innerHTML, /aria-current="page"/);
    assert.match(pager.innerHTML, /aria-label="Trang trước" disabled/);
    assert.match(pager.innerHTML, /aria-label="Trang tiếp">/);
    assert.doesNotMatch(pager.innerHTML, /server-token|Tải thêm/);
  }
});

test('next replaces the visible items; back and revisiting a loaded page use the cache', async () => {
  const h = setup(options => options.pageToken ? {files:items(21,20), nextPageToken:'third'} : {files:items(1,20), nextPageToken:'second'});
  await h.manager.load();
  h.manager.select('file-1');
  await h.manager.goToPage(1);
  assert.equal(h.calls[1].options.pageToken, 'second');
  assert.equal(h.state().files.length, 20);
  assert.equal(h.state().files[0].id, 'file-21');
  assert.equal(h.state().range, '21–40 mục');
  assert.deepEqual(h.state().selected, []);
  assert.equal(h.state().detailsId, null);
  await h.manager.goToPage(0);
  assert.equal(h.state().files[0].id, 'file-1');
  await h.manager.goToPage(1);
  assert.equal(h.calls.length, 2);
});

test('last and partial pages use actual record counts and disable next', async () => {
  const h = setup(options => options.pageToken ? {files:items(4,2)} : {files:items(1,3), nextPageToken:'last'});
  await h.manager.load(); await h.manager.goToPage(1);
  assert.equal(h.state().range, '4–5 mục');
  assert.match(h.pagers[0].innerHTML, /aria-label="Trang tiếp" disabled/);
  await h.manager.goToPage(2); await h.manager.goToPage(-1); await h.manager.goToPage(0.5);
  assert.equal(h.calls.length, 2);
});

test('size changes persist, clear cached pages and selections, and restart from the first token', async () => {
  const h = setup(options => ({files:items(1,options.pageSize), nextPageToken:'next'}));
  await h.manager.load(); await h.manager.goToPage(1); h.manager.select('file-1');
  await h.manager.setPageSize('50');
  assert.equal(h.state().pageIndex, 0);
  assert.equal(h.state().pageCount, 1);
  assert.equal(h.state().files.length, 50);
  assert.deepEqual(h.state().selected, []);
  assert.equal(h.calls.at(-1).options.pageToken, undefined);
  assert.equal(h.preferences.get('drive-manager-page-size'), '50');
  await h.manager.setPageSize('100');
  assert.equal(h.state().files.length, 100);
  const count = h.calls.length;
  await h.manager.setPageSize('999'); await h.manager.setPageSize('invalid');
  assert.equal(h.calls.length, count);
  assert.equal(setup(() => ({}), '999').state().pageSize, 20);
});

test('search, type, sort, folder and view changes discard old tokens', async () => {
  const h = setup(() => ({files:items(1,20), nextPageToken:'next'}));
  for (const criteria of [{query:'ảnh'}, {query:'', type:'image'}, {sort:'modified_desc'}, {folderId:'folder-2'}, {view:'trash'}]) {
    await h.manager.load(); await h.manager.goToPage(1);
    h.manager.criteria(criteria); await h.manager.load();
    assert.equal(h.state().pageIndex, 0);
    assert.equal(h.calls.at(-1).options.pageToken, undefined);
    for (const [key,value] of Object.entries(criteria)) assert.equal(h.calls.at(-1).options[key], value);
  }
});

test('empty Drive pages are skipped on initial load and next, preserving first-page metadata', async () => {
  const h = setup(options => {
    if (!options.pageToken) return {files:[], nextPageToken:'empty', path:[{id:'root',name:'Root'}], folder:{id:'folder-1'}};
    if (options.pageToken === 'empty') return {files:items(1,3), nextPageToken:'empty-next'};
    if (options.pageToken === 'empty-next') return {files:[], nextPageToken:'last'};
    return {files:items(4,2)};
  });
  await h.manager.load();
  assert.equal(h.state().folder.id, 'folder-1');
  assert.equal(h.state().path[0].name, 'Root');
  await h.manager.goToPage(1);
  assert.equal(h.state().range, '4–5 mục');
  assert.equal(h.calls.length, 4);
});

test('bounded empty-page traversal keeps next available instead of claiming the folder is empty', async () => {
  const h = setup(() => ({files:[], nextPageToken:'still-more'}));
  await h.manager.load();
  assert.equal(h.calls.length, 6);
  assert.equal(h.pagers[0].hidden, false);
  assert.match(h.pagers[0].innerHTML, /aria-label="Trang tiếp">/);
});

test('a failed next request preserves the current page and can be retried', async () => {
  let fail = true;
  const h = setup(options => {
    if (!options.pageToken) return {files:items(1,20), nextPageToken:'next'};
    if (fail) throw Error('Test network failure');
    return {files:items(21,4)};
  });
  await h.manager.load(); await h.manager.goToPage(1);
  assert.equal(h.state().pageIndex, 0);
  assert.equal(h.state().files[0].id, 'file-1');
  assert.equal(h.state().pageLoading, false);
  assert.equal(h.toasts.at(-1)[1], 'error');
  fail = false; await h.manager.goToPage(1);
  assert.equal(h.state().range, '21–24 mục');
});

test('repeated next clicks make one request and stale responses cannot replace a new search', async () => {
  const pending = deferred();
  const h = setup(options => options.query ? {files:items(90,1)} : options.pageToken ? pending.promise : {files:items(1,20), nextPageToken:'next'});
  await h.manager.load();
  const next = h.manager.goToPage(1);
  await h.manager.goToPage(1);
  assert.equal(h.calls.length, 2);
  assert.match(h.pagers[0].innerHTML, /Đang tải…/);
  h.manager.criteria({query:'new search'}); await h.manager.load();
  assert.equal(h.calls[1].signal.aborted, true);
  pending.resolve({files:items(21,20)}); await next;
  assert.equal(h.state().files[0].id, 'file-90');
  assert.equal(h.state().pageIndex, 0);
  assert.equal(h.state().pageLoading, false);
});

test('leaving aborts a pending page request without rendering a late result', async () => {
  const pending = deferred();
  const h = setup(options => options.pageToken ? pending.promise : {files:items(1,20), nextPageToken:'next'});
  await h.manager.load(); const next = h.manager.goToPage(1);
  const markup = h.pagers[0].innerHTML;
  h.manager.leave();
  pending.resolve({files:items(21,20)}); await next;
  assert.equal(h.calls[1].signal.aborted, true);
  assert.equal(h.pagers[0].innerHTML, markup);
});
