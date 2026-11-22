import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function setup() {
  const store = new Map();
  const ctx = vm.createContext({
    window:{matchMedia:() => ({matches:true})},
    document:{addEventListener(){}, body:{classList:{contains:() => false}}},
    localStorage:{getItem:key => store.get(key) || null, setItem:(key,value) => store.set(key,value)},
    hasUserPermission:() => true, activeDashboardTab:'gdv_report',
    setTimeout, clearTimeout
  });
  vm.runInContext(fs.readFileSync(new URL('../js/core/navigation.js', import.meta.url), 'utf8'), ctx);
  return {ctx, store};
}

test('sidebar thu gọn nhóm và nhớ lựa chọn, nhóm trang hiện tại tự mở', () => {
  const {ctx, store} = setup();
  let closed = false, expanded = '';
  const group = {dataset:{group:'claims'}, classList:{toggle() { closed = !closed; return closed; }}};
  ctx.toggleAppSidebarGroup({closest:() => group, setAttribute:(name, value) => { if (name === 'aria-expanded') expanded = value; }});
  assert.equal(expanded, 'false');
  assert.deepEqual(JSON.parse(store.get('app-sidebar-closed-groups-v1')), ['claims']);
  let html = ctx.renderAppSidebarMarkup(ctx.getAppSidebarGroups());
  assert.match(html, /data-group="claims" role="group"/);
  assert.match(html, /aria-controls="app-sidebar-group-claims"/);
  ctx.activeDashboardTab = 'home';
  html = ctx.renderAppSidebarMarkup(ctx.getAppSidebarGroups());
  assert.match(html, /class="app-sidebar-group is-closed" data-group="claims"/);
  assert.match(html, /aria-expanded="false" aria-controls="app-sidebar-group-claims"/);
  assert.match(html, /data-tab="gdv_report"/);
});

test('sidebar bỏ qua dữ liệu lưu hỏng và giữ quyền hiển thị các mục', () => {
  const {ctx, store} = setup();
  store.set('app-sidebar-closed-groups-v1', '{broken');
  ctx.hasUserPermission = () => false;
  const html = ctx.renderAppSidebarMarkup(ctx.getAppSidebarGroups());
  assert.match(html, /data-tab="home"/);
  assert.doesNotMatch(html, /data-tab="users"|data-tab="gdv_report"/);
});
