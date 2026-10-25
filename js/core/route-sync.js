// ==========================================================================
// ĐỒNG BỘ TRANG ĐANG XEM ↔ ĐƯỜNG DẪN (hash routing)
// Ví dụ: …/giam-dinh-xe/#/ho-so-boi-thuong, #/quan-tri/nhat-ky
// - Tải lại trang / mở link chia sẻ → mở đúng trang (kiểm tra quyền, không có quyền → Trang chủ).
// - Mỗi lần chuyển trang → ghi vào lịch sử trình duyệt, nút Back/Forward hoạt động.
// - Không đụng đường dẫn ca xe ?idCa=… (Garage / kết quả giám định).
// Cơ chế: bọc các hàm sẵn có (evaluateViewRoutingState, switchWorkspaceTab,
// renderManagerDashboardWorkspace, switchSystemAdminSubTab) – không sửa logic bên trong.
// File này phải nạp SAU các file định nghĩa những hàm đó.
// ==========================================================================
(function () {
  const TAB_SLUGS = {
    home: 'trang-chu',
    list: 'ho-so-giam-dinh',
    create: 'tao-ca-giam-dinh',
    pending: 'ho-so-boi-thuong',
    pending_notes_tracker: 'tien-do-ho-so-ton',
    claim_cancellation: 'de-xuat-huy-ho-so',
    gdv_report: 'bao-cao-gdv',
    accounting_claims: 'ho-so-thanh-toan',
    accounting_transfer: 'chuyen-ho-so',
    field_reimbursements: 'hien-truong',
    shared_forms: 'bieu-mau',
    users: 'quan-tri'
  };
  const ADMIN_SUB_SLUGS = { users: 'tai-khoan', 'api-keys': 'gemini-api', cloudinary: 'cloudinary', 'audit-logs': 'nhat-ky', 'kpi-config': 'he-so-kpi' };
  const ADMIN_ONLY_SUBS = ['api-keys', 'cloudinary', 'kpi-config'];
  const SLUG_TABS = Object.fromEntries(Object.entries(TAB_SLUGS).map(([tab, slug]) => [slug, tab]));
  const SLUG_SUBS = Object.fromEntries(Object.entries(ADMIN_SUB_SLUGS).map(([sub, slug]) => [slug, sub]));

  // Quyền xem từng trang – giống các điều kiện trong switchWorkspaceTab.
  function canAccessTab(tab) {
    const can = (m, a) => typeof hasUserPermission === 'function' && hasUserPermission(m, a);
    switch (tab) {
      case 'home': case 'shared_forms': return true;
      case 'list': return can('list', 'view');
      case 'create': return can('list', 'add');
      case 'pending': case 'pending_notes_tracker': return can('pending', 'view');
      case 'claim_cancellation': return can('pending', 'view') || can('list', 'view');
      case 'gdv_report': return can('report', 'view');
      case 'accounting_claims': return can('accounting', 'review');
      case 'accounting_transfer': return can('accounting', 'view');
      case 'field_reimbursements': return can('field_reimb', 'view');
      case 'users': return can('users', 'view');
      default: return false;
    }
  }

  const isCaseUrl = () => new URLSearchParams(location.search).has('idCa');

  // Đọc trang từ hash; null nếu đường dẫn không mang thông tin trang.
  function readRoute() {
    const match = String(location.hash || '').match(/^#\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?\/?$/i);
    if (!match) return null;
    const tab = SLUG_TABS[match[1].toLowerCase()];
    if (!tab) return { tab: 'home', sub: null, unknown: true };
    const sub = tab === 'users' && match[2] ? (SLUG_SUBS[match[2].toLowerCase()] || null) : null;
    return { tab, sub };
  }

  function currentHash() {
    const tab = typeof activeDashboardTab !== 'undefined' ? activeDashboardTab : 'home';
    // 'system' là trang con cũ của Quản trị → cùng đường dẫn.
    const normalized = tab === 'system' ? 'users' : tab;
    const slug = TAB_SLUGS[normalized];
    if (!slug) return null;
    if (normalized === 'users' && typeof activeSystemAdminSubTab !== 'undefined') {
      const sub = ADMIN_SUB_SLUGS[activeSystemAdminSubTab || 'users'];
      if (sub) return `#/${slug}/${sub}`;
    }
    return `#/${slug}`;
  }

  // Ghi trang hiện tại lên đường dẫn. mode: 'push' (tạo mục lịch sử) | 'replace'.
  function writeRoute(mode) {
    if (isCaseUrl()) return;
    const hash = currentHash();
    if (!hash || location.hash === hash) return;
    const url = getCleanOriginBaseUrl() + hash;
    try { window.history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', url); } catch (_) { /* file:// … */ }
  }

  // Áp trang từ đường dẫn vào trạng thái ứng dụng (trước khi vẽ).
  function applyRoute(route) {
    let tab = route.tab;
    if (!canAccessTab(tab)) tab = 'home';
    activeDashboardTab = tab;
    if (tab === 'gdv_report') activeGdvReportView = 'weekly_zone';
    if (tab === 'create' && typeof editingCaseId !== 'undefined' && !editingCaseId) activeCreateFlowMode = 'select';
    if (tab === 'users' && typeof activeSystemAdminSubTab !== 'undefined') {
      let sub = route.sub || 'users';
      if (ADMIN_ONLY_SUBS.includes(sub) && !(typeof hasUserPermission === 'function' && hasUserPermission('users', 'admin'))) sub = 'users';
      activeSystemAdminSubTab = sub;
    }
  }

  function wrap(name, make) {
    const original = window[name];
    if (typeof original !== 'function' || original.__routeSync) return;
    const wrapped = make(original);
    wrapped.__routeSync = true;
    window[name] = wrapped;
  }

  // 1) Mỗi lần ứng dụng quyết định hiển thị gì (tải trang, đăng nhập, Back/Forward):
  //    nếu đường dẫn có trang (#/…) và đã đăng nhập → mở đúng trang đó.
  wrap('evaluateViewRoutingState', original => function (userInstance, ...rest) {
    if (userInstance && !isCaseUrl()) {
      const route = readRoute();
      if (route) applyRoute(route);
    }
    return original.call(this, userInstance, ...rest);
  });

  // 2) Vẽ bảng điều khiển xong → chuẩn hoá đường dẫn (không tạo mục lịch sử mới),
  //    vd. lần đầu vào chưa có #, hoặc bị chuyển về Trang chủ vì không có quyền.
  wrap('renderManagerDashboardWorkspace', original => function (...args) {
    const result = original.apply(this, args);
    writeRoute('replace');
    return result;
  });

  // 3) Người dùng chuyển trang → thêm mục lịch sử để Back/Forward quay lại được.
  wrap('switchWorkspaceTab', original => function (...args) {
    const before = activeDashboardTab;
    const result = original.apply(this, args);
    writeRoute(activeDashboardTab !== before ? 'push' : 'replace');
    return result;
  });

  // 4) Tab con của Quản trị hệ thống.
  wrap('switchSystemAdminSubTab', original => function (...args) {
    const result = original.apply(this, args);
    writeRoute('push');
    return result;
  });

  // Cho phần khác dùng (vd. sao chép đường dẫn trang hiện tại).
  window.AppRoute = { read: readRoute, hashFor: currentHash, slugs: { ...TAB_SLUGS } };
})();
