import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/core/route-sync.js', import.meta.url), 'utf8');

// Môi trường tối thiểu: location + history có ngăn xếp, các hàm của ứng dụng mà route-sync bọc lại.
function setup({ claims = { '-Nabc_Def': { id: '-Nabc_Def', soHoSoBoiThuong: 'HSBT/1' } }, hash = '' } = {}) {
  const base = 'https://example.test/giam-dinh-xe/';
  const stack = [{ hash, state: null }];
  let index = 0;
  const location = { search: '', get hash() { return stack[index].hash; }, get href() { return base + stack[index].hash; } };
  const history = {
    get state() { return stack[index].state; },
    pushState(state, _t, url) { stack.splice(index + 1); stack.push({ hash: new URL(url).hash, state }); index++; },
    replaceState(state, _t, url) { stack[index] = { hash: new URL(url).hash, state }; },
    back() { if (index > 0) index--; }
  };
  const toasts = [];
  const sandbox = {
    URL, URLSearchParams, Promise, console, location, history, toasts,
    activeDashboardTab: 'home', activeSystemAdminSubTab: 'users', activeGdvReportView: '', activeCreateFlowMode: '', editingCaseId: null,
    editingPendingClaimId: null, cachedPendingClaimsPayload: structuredClone(claims),
    getCleanOriginBaseUrl: () => base,
    hasUserPermission: () => true,
    triggerToast: (message, type) => toasts.push({ message, type }),
    evaluateViewRoutingState() {},
    renderManagerDashboardWorkspace() {},
    switchWorkspaceTab(tab) { sandbox.activeDashboardTab = tab; },
    switchSystemAdminSubTab() {},
    switchGdvReportView(view) { sandbox.activeGdvReportView = view; },
    applyFavoriteFilterSettings(fav) { if (fav?.filters?.activeGdvReportView) sandbox.activeGdvReportView = fav.filters.activeGdvReportView; },
    async openEditPendingClaimModal(claimId) { await Promise.resolve(); sandbox.editingPendingClaimId = claimId; },
    closeAddPendingClaimModal() { sandbox.editingPendingClaimId = null; }
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  // `let`/function toàn cục của ứng dụng được tham chiếu trần → chạy trong cùng context như <script> thật.
  vm.runInContext(`${source}\n;globalThis.__expose = { evaluateViewRoutingState, switchWorkspaceTab };`, context);
  const popstate = () => sandbox.evaluateViewRoutingState({ uid: 'u' });
  return { sandbox, stack, history, popstate, toasts, tick: () => new Promise(resolve => setTimeout(resolve, 0)), get hash() { return stack[index].hash; }, back() { history.back(); popstate(); }, forward() { if (index < stack.length - 1) { index++; popstate(); } } };
}

test('readRoute giữ nguyên chữ hoa/thường và ký tự đặc biệt của mã hồ sơ', () => {
  const env = setup({ hash: '#/ho-so-boi-thuong/-Nabc_Def' });
  assert.deepEqual({ ...env.sandbox.AppRoute.read() }, { tab: 'pending', sub: null, claimId: '-Nabc_Def' });
  const encoded = setup({ hash: '#/ho-so-boi-thuong/HSBT%2FXCG%2F1' });
  assert.equal(encoded.sandbox.AppRoute.read().claimId, 'HSBT/XCG/1');
  assert.equal(setup({ hash: '#/quan-tri/nhat-ky' }).sandbox.AppRoute.read().sub, 'audit-logs');
  assert.equal(setup({ hash: '#/ho-so-giam-dinh/abc' }).sandbox.AppRoute.read().claimId, null);
});

test('mở hồ sơ → URL mang mã hồ sơ; đóng hồ sơ → quay về danh sách (Back sạch)', async () => {
  const env = setup({ hash: '#/ho-so-boi-thuong' });
  env.sandbox.activeDashboardTab = 'pending';
  await env.sandbox.openEditPendingClaimModal('-Nabc_Def');
  assert.equal(env.hash, '#/ho-so-boi-thuong/-Nabc_Def');
  assert.equal(env.stack.length, 2, 'mở hồ sơ tạo một mục lịch sử');
  env.sandbox.closeAddPendingClaimModal();
  assert.equal(env.hash, '#/ho-so-boi-thuong');
  assert.equal(env.sandbox.editingPendingClaimId, null);
});

test('F5 trên URL hồ sơ: giữ mã trên URL khi dữ liệu chưa về, rồi tự mở đúng hồ sơ', async () => {
  const env = setup({ hash: '#/ho-so-boi-thuong/-Nabc_Def' });
  env.sandbox.evaluateViewRoutingState({ uid: 'u' });            // đăng nhập xong, Firebase chưa trả dữ liệu
  env.sandbox.renderManagerDashboardWorkspace();                 // lần vẽ đầu chuẩn hoá URL
  assert.equal(env.hash, '#/ho-so-boi-thuong/-Nabc_Def', 'không bị ghi đè về danh sách');
  assert.equal(env.sandbox.editingPendingClaimId, null);
  env.sandbox.AppRoute.onPendingClaimsLoaded();                  // dữ liệu về
  await env.tick(); await env.tick();
  assert.equal(env.sandbox.editingPendingClaimId, '-Nabc_Def');
  assert.equal(env.hash, '#/ho-so-boi-thuong/-Nabc_Def');
  assert.equal(env.stack.length, 1, 'F5 không thêm mục lịch sử');
});

test('mã hồ sơ không tồn tại: báo lỗi và đưa URL về danh sách', async () => {
  const env = setup({ hash: '#/ho-so-boi-thuong/khong-co' });
  env.sandbox.evaluateViewRoutingState({ uid: 'u' });
  env.sandbox.AppRoute.onPendingClaimsLoaded();
  await env.tick();
  assert.equal(env.sandbox.editingPendingClaimId, null);
  assert.equal(env.hash, '#/ho-so-boi-thuong');
  assert.equal(env.toasts.length, 1);
});

test('Back đóng hồ sơ, Forward mở lại hồ sơ', async () => {
  const env = setup({ hash: '#/ho-so-boi-thuong' });
  env.sandbox.activeDashboardTab = 'pending';
  await env.sandbox.openEditPendingClaimModal('-Nabc_Def');
  env.back();
  assert.equal(env.sandbox.editingPendingClaimId, null, 'Back đóng form');
  assert.equal(env.hash, '#/ho-so-boi-thuong');
  env.sandbox.AppRoute.onPendingClaimsLoaded();
  env.forward();
  await env.tick(); await env.tick();
  assert.equal(env.sandbox.editingPendingClaimId, '-Nabc_Def', 'Forward mở lại đúng hồ sơ');
  assert.equal(env.hash, '#/ho-so-boi-thuong/-Nabc_Def');
});

test('hồ sơ mới vừa tạo chuyển sang chế độ sửa: thay thế mục lịch sử thay vì chồng thêm', async () => {
  const env = setup({ hash: '#/ho-so-boi-thuong', claims: { a1: { id: 'a1' }, b2: { id: 'b2' } } });
  env.sandbox.activeDashboardTab = 'pending';
  await env.sandbox.openEditPendingClaimModal('a1');
  const length = env.stack.length;
  await env.sandbox.openEditPendingClaimModal('b2');
  assert.equal(env.hash, '#/ho-so-boi-thuong/b2');
  assert.equal(env.stack.length, length);
});

test('đóng form không đụng tới URL của trang khác', async () => {
  const env = setup({ hash: '#/ho-so-boi-thuong' });
  env.sandbox.activeDashboardTab = 'pending';
  await env.sandbox.openEditPendingClaimModal('-Nabc_Def');
  env.sandbox.switchWorkspaceTab('home');
  assert.equal(env.hash, '#/trang-chu');
});

test('tải lại hoặc mở liên kết báo cáo giữ đúng loại báo cáo', () => {
  for (const view of ['weekly_zone', 'kpi_zone', 'backlog_watch', 'monthly_opened_claims', 'annual_claims_gdv', 'tnds_ton', 'table', 'chart', 'garage', 'daklak_reserve', 'ton_chua_hoa_don', 'car_brand_loss']) {
    const env = setup({hash:'#/bao-cao-gdv?bao-cao=' + view});
    env.sandbox.evaluateViewRoutingState({uid:'u'});
    env.sandbox.renderManagerDashboardWorkspace();
    assert.equal(env.sandbox.activeDashboardTab, 'gdv_report');
    assert.equal(env.sandbox.activeGdvReportView, view);
    assert.equal(env.hash, '#/bao-cao-gdv?bao-cao=' + view);
    assert.equal(env.stack.length, 1);
  }
});

test('chọn báo cáo hoặc bộ lọc yêu thích cập nhật URL và Back/Forward khôi phục', () => {
  const env = setup({hash:'#/bao-cao-gdv?bao-cao=weekly_zone'});
  env.popstate();
  env.sandbox.switchGdvReportView('monthly_opened_claims');
  assert.equal(env.hash, '#/bao-cao-gdv?bao-cao=monthly_opened_claims');
  env.sandbox.applyFavoriteFilterSettings({filters:{activeGdvReportView:'kpi_zone'}});
  assert.equal(env.hash, '#/bao-cao-gdv?bao-cao=kpi_zone');
  env.back(); assert.equal(env.sandbox.activeGdvReportView, 'monthly_opened_claims');
  env.back(); assert.equal(env.sandbox.activeGdvReportView, 'weekly_zone');
  env.forward(); assert.equal(env.sandbox.activeGdvReportView, 'monthly_opened_claims');
});

test('đường dẫn báo cáo cũ, tham số lạ và quyền truy cập được xử lý an toàn', () => {
  for (const hash of ['#/bao-cao-gdv', '#/bao-cao-gdv?bao-cao=khong-hop-le', '#/bao-cao-gdv?bao-cao=%3Cscript%3E']) {
    const env = setup({hash}); env.popstate(); env.sandbox.renderManagerDashboardWorkspace();
    assert.equal(env.sandbox.activeGdvReportView, 'weekly_zone');
    assert.equal(env.hash, '#/bao-cao-gdv?bao-cao=weekly_zone');
  }
  const restricted = setup({hash:'#/bao-cao-gdv?bao-cao=monthly_opened_claims'});
  restricted.sandbox.hasUserPermission = () => false;
  restricted.popstate(); restricted.sandbox.renderManagerDashboardWorkspace();
  assert.equal(restricted.sandbox.activeDashboardTab, 'home');
  assert.equal(restricted.hash, '#/trang-chu');
});
