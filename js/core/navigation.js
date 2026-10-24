

    function renderNavigationUserProfile(userInstance, targetNode) {
      if (!targetNode) return;
      const profile = getAuthenticatedUserPresentation(userInstance);
      const activeThemeIcon = currentTheme === 'light' ? SVGS.MOON : SVGS.SUN;
      targetNode.innerHTML = `
        <div class="nav-user-zone">
          <div style="width: 2px; height: 32px; background: linear-gradient(to bottom, transparent, rgba(216, 180, 109, 0.35), transparent); margin-right: 4px; margin-left: 8px;"></div>
          
          <!-- TOP NOTIFICATION BELL COMPONENT -->
          <div style="position: relative;" id="navNotificationWrapper">
            <button type="button" class="btn-premium btn-secondary nav-logout-icon" title="Thông báo hệ thống" onclick="toggleNotificationCenterDropdown(event)" style="position: relative; width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; cursor: pointer;">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              <span id="navNotificationBadge" style="display: none; position: absolute; top: -3px; right: -3px; background: #ef4444; color: #ffffff; font-size: 10px; font-weight: 850; padding: 2px 6px; border-radius: 99px;  border: 2px solid var(--surface); box-shadow: 0 2px 6px rgba(239,68,68,0.4);">0</span>
            </button>

            <!-- FLOATING NOTIFICATION CENTER DROPDOWN PANEL -->
            <div id="notificationCenterDropdownMenu" style="display: none; position: absolute; top: calc(100% + 10px); right: 0; width: 420px; z-index: 99999; background: var(--surface-strong); border: 1px solid var(--border-strong); border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.35); padding: 0; overflow: hidden;">
              <div style="padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: var(--surface);">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <strong style="font-size: 14px; color: var(--text-main); font-weight: 850; display: flex; align-items: center; gap: 8px; white-space: nowrap;">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary);"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                    <span>Thông báo</span>
                  </strong>
                  <span id="lblNotifUnreadCount" style="font-size: 11px; background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850; padding: 3px 10px; border-radius: 99px; display: none;">0 mới</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                  <button type="button" onclick="markAllNotificationsAsRead()" style="background: transparent; border: none; font-size: 12px; color: var(--primary); font-weight: 800; cursor: pointer; text-decoration: underline; padding: 0;" title="Đánh dấu đã đọc tất cả">Đã đọc tất cả</button>
                  <div style="width: 1px; height: 12px; background: var(--border-strong);"></div>
                  <button type="button" onclick="dismissAllNotifications()" style="background: transparent; border: none; font-size: 12px; color: var(--text-soft); font-weight: 800; cursor: pointer; text-decoration: underline; transition: color 0.2s; padding: 0;" onmouseover="this.style.color='var(--text-main)';" onmouseout="this.style.color='var(--text-soft)';" title="Xóa tất cả">Xóa tất cả</button>
                </div>
              </div>
              <div id="notificationItemsHolder" style="max-height: 360px; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px;">
                <!-- Dynamic notification items -->
              </div>
            </div>
          </div>

          <button class="btn-premium btn-secondary nav-logout-icon theme-btn theme-toggle-btn-node" title="Chuyển đổi giao diện Sáng/Tối" onclick="toggleTheme()">${activeThemeIcon}</button>
          <button type="button" class="nav-user-card" title="Mở hồ sơ người dùng" onclick="openUserProfileModal()">
            <div class="nav-user-avatar">${escapeHtmlOutput(profile.initials)}</div>
            <div class="nav-user-copy"><strong>${escapeHtmlOutput(profile.displayName)}</strong><em>${escapeHtmlOutput(profile.role)}</em></div>
          </button>
          <button class="btn-premium btn-secondary nav-logout-icon" title="Đăng xuất" aria-label="Đăng xuất" onclick="executeLogoutFlow()">${SVGS.LOGOUT}</button>
        </div>`;
    }


    // ==========================================================================
    // SIDEBAR ĐIỀU HƯỚNG (thay cho các tab trên header) – css/app-sidebar.css
    // Giữ tên hàm cũ (renderHeaderNavigationLinks / removeHeaderNavigationLinks / navigateHeaderTab)
    // vì application.js, workspace.js, users.js, system.js đang gọi trực tiếp.
    // ==========================================================================
    const APP_SIDEBAR_COLLAPSE_KEY = 'app-sidebar-collapsed';
    const APP_SIDEBAR_ICONS = {
      home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"/>',
      list:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
      pending:'<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>',
      tracker:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      cancel:'<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6m0-6 6 6"/>',
      report:'<path d="M4 20h16"/><path d="M7 16v-5M12 16V6M17 16v-8"/>',
      payment:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
      transfer:'<path d="M4 7h13l-3-3M20 17H7l3 3"/>',
      field:'<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
      forms:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
      system:'<path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6Z"/><path d="m9 12 2 2 4-4"/>',
      collapse:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16M15 10l-2 2 2 2"/>',
      menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
      close:'<path d="m6 6 12 12M18 6 6 18"/>'
    };
    const appSidebarIcon = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${APP_SIDEBAR_ICONS[name] || ''}</svg>`;

    // Cấu trúc menu theo nhóm; quyền hiển thị giữ đúng như các tab header trước đây.
    function getAppSidebarGroups() {
      const showList = hasUserPermission('list', 'view');
      const showPending = hasUserPermission('pending', 'view');
      const showReport = hasUserPermission('report', 'view');
      return [
        { label: 'Tổng quan', items: [
          { tab: 'home', title: 'Trang chủ', icon: 'home', show: true }
        ]},
        { label: 'Quản lý hồ sơ', items: [
          { tab: 'list', title: 'Hồ sơ giám định', icon: 'list', show: showList, also: ['create'] },
          { tab: 'pending', title: 'Hồ sơ bồi thường', icon: 'pending', show: showPending },
          { tab: 'pending_notes_tracker', title: 'Tiến độ hồ sơ tồn', icon: 'tracker', show: showPending },
          { tab: 'claim_cancellation', title: 'Đề xuất hủy hồ sơ', icon: 'cancel', show: showPending || showList, badge: 'Mới' },
          { tab: 'gdv_report', title: 'Báo cáo & thống kê GĐV', icon: 'report', show: showReport }
        ]},
        { label: 'Kế toán', items: [
          { tab: 'accounting_claims', title: 'Hồ sơ thanh toán', icon: 'payment', show: hasUserPermission('accounting', 'review') },
          { tab: 'accounting_transfer', title: 'Chuyển hồ sơ', icon: 'transfer', show: hasUserPermission('accounting', 'view') }
        ]},
        { label: 'Nghiệp vụ', items: [
          { tab: 'field_reimbursements', title: 'Hiện trường', icon: 'field', show: hasUserPermission('field_reimb', 'view') },
          { tab: 'shared_forms', title: 'Biểu mẫu dùng chung', icon: 'forms', show: true }
        ]},
        { label: 'Hệ thống', items: [
          { tab: 'users', title: 'Quản trị hệ thống', icon: 'system', show: hasUserPermission('users', 'view'), also: ['system'] }
        ]}
      ].map(group => ({ ...group, items: group.items.filter(item => item.show) })).filter(group => group.items.length);
    }

    function isAppSidebarItemActive(item) {
      return activeDashboardTab === item.tab || (item.also || []).includes(activeDashboardTab);
    }

    function readAppSidebarCollapsed() {
      try { return localStorage.getItem(APP_SIDEBAR_COLLAPSE_KEY) === '1'; } catch (_) { return false; }
    }

    function toggleAppSidebarCollapsed() {
      const collapsed = !document.body.classList.contains('app-sidebar-collapsed');
      document.body.classList.toggle('app-sidebar-collapsed', collapsed);
      try { localStorage.setItem(APP_SIDEBAR_COLLAPSE_KEY, collapsed ? '1' : '0'); } catch (_) {}
      const btn = document.getElementById('appSidebarCollapseBtn');
      if (btn) {
        btn.setAttribute('aria-pressed', String(collapsed));
        btn.title = collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên';
        btn.setAttribute('aria-label', btn.title);
      }
    }

    // Mobile: sidebar trượt ra trên lớp phủ.
    function setAppSidebarOpen(open) {
      document.body.classList.toggle('app-sidebar-open', !!open);
      document.getElementById('appSidebarMenuBtn')?.setAttribute('aria-expanded', String(!!open));
      if (open) document.querySelector('#appSidebar .app-sidebar-link.is-active, #appSidebar .app-sidebar-link')?.focus({ preventScroll: true });
    }

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && document.body.classList.contains('app-sidebar-open')) {
        setAppSidebarOpen(false);
        document.getElementById('appSidebarMenuBtn')?.focus();
      }
    });

    function renderAppSidebarMarkup(groups) {
      const collapsed = document.body.classList.contains('app-sidebar-collapsed');
      return `
        <div class="app-sidebar-brand">
          <button type="button" class="app-sidebar-logo" onclick="navigateHeaderTab('home')" title="Về trang chủ" aria-label="TASCO DLK – về trang chủ">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-5"/></svg>
          </button>
          <div class="app-sidebar-brand-copy"><strong>TASCO DLK</strong><span>Xe cơ giới</span></div>
          <button type="button" class="app-sidebar-close" onclick="setAppSidebarOpen(false)" aria-label="Đóng menu">${appSidebarIcon('close')}</button>
        </div>
        <nav class="app-sidebar-nav" aria-label="Điều hướng chính">
          ${groups.map(group => `
            <div class="app-sidebar-group" role="group" aria-label="${group.label}">
              <div class="app-sidebar-group-label" aria-hidden="true">${group.label}</div>
              ${group.items.map(item => {
                const active = isAppSidebarItemActive(item);
                return `<button type="button" class="app-sidebar-link${active ? ' is-active' : ''}" data-tab="${item.tab}" onclick="navigateHeaderTab('${item.tab}')" title="${item.title}" ${active ? 'aria-current="page"' : ''}>
                  ${appSidebarIcon(item.icon, 'app-sidebar-link-icon')}
                  <span class="app-sidebar-link-text">${item.title}</span>
                  ${item.badge ? `<span class="app-sidebar-badge">${item.badge}</span>` : ''}
                </button>`;
              }).join('')}
            </div>`).join('')}
        </nav>
        <div class="app-sidebar-foot">
          <button type="button" id="appSidebarCollapseBtn" class="app-sidebar-collapse" onclick="toggleAppSidebarCollapsed()" aria-pressed="${collapsed}" title="${collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}" aria-label="${collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}">
            ${appSidebarIcon('collapse')}<span class="app-sidebar-link-text">Thu gọn</span>
          </button>
        </div>`;
    }

    function renderHeaderNavigationLinks() {
      const navContainer = document.getElementById('mainNavigationBar');
      if (!navContainer) return;
      document.getElementById('headerNavTabsContainer')?.remove(); // bỏ tab header kiểu cũ (nếu còn)

      const groups = getAppSidebarGroups();
      if (!document.body.classList.contains('has-app-sidebar') && readAppSidebarCollapsed()) document.body.classList.add('app-sidebar-collapsed');
      document.body.classList.add('has-app-sidebar');

      let sidebar = document.getElementById('appSidebar');
      if (!sidebar) {
        sidebar = document.createElement('aside');
        sidebar.id = 'appSidebar';
        sidebar.className = 'app-sidebar';
        sidebar.setAttribute('aria-label', 'Thanh điều hướng');
        document.body.prepend(sidebar);
        const backdrop = document.createElement('div');
        backdrop.id = 'appSidebarBackdrop';
        backdrop.className = 'app-sidebar-backdrop';
        backdrop.addEventListener('click', () => setAppSidebarOpen(false));
        document.body.prepend(backdrop);
      }
      const navScroll = sidebar.querySelector('.app-sidebar-nav')?.scrollTop || 0;
      sidebar.innerHTML = renderAppSidebarMarkup(groups);
      sidebar.querySelector('.app-sidebar-nav').scrollTop = navScroll;

      // Thanh trên: nút menu (mobile) + tên trang hiện tại.
      let context = document.getElementById('appTopbarContext');
      if (!context) {
        context = document.createElement('div');
        context.id = 'appTopbarContext';
        context.className = 'app-topbar-context';
        navContainer.insertBefore(context, document.getElementById('navUserActionSpace'));
      }
      let current = null, currentGroup = null;
      for (const group of groups) for (const item of group.items) if (!current && isAppSidebarItemActive(item)) { current = item; currentGroup = group; }
      context.innerHTML = `
        <button type="button" id="appSidebarMenuBtn" class="app-topbar-menu" onclick="setAppSidebarOpen(true)" aria-controls="appSidebar" aria-expanded="${document.body.classList.contains('app-sidebar-open')}" aria-label="Mở menu điều hướng">${appSidebarIcon('menu')}</button>
        <div class="app-topbar-title">
          ${currentGroup && current && current.tab !== 'home' ? `<span>${currentGroup.label}</span>` : ''}
          <strong>${current ? current.title : 'Trang chủ'}</strong>
        </div>`;
    }


    function removeHeaderNavigationLinks() {
      document.getElementById('headerNavTabsContainer')?.remove();
      document.getElementById('appSidebar')?.remove();
      document.getElementById('appSidebarBackdrop')?.remove();
      document.getElementById('appTopbarContext')?.remove();
      document.body.classList.remove('has-app-sidebar', 'app-sidebar-open');
    }

    // Tương thích ngược: runtime.js vẫn gọi để đóng menu header khi bấm ra ngoài.
    function setHeaderSubmenuOpen(sub, open) { sub?.classList.toggle('open', !!open); }
    function toggleHeaderSubmenu() {}


    function navigateHeaderTab(tabName) {
      setAppSidebarOpen(false); // mobile: đóng sidebar sau khi chọn

      if (tabName === 'gdv_report') {
        activeGdvReportView = 'weekly_zone';
      }

      const URLQueryStrings = new URLSearchParams(window.location.search);
      const caseIdToken = URLQueryStrings.get('idCa');
      
      if (caseIdToken) {
        activeDashboardTab = tabName;
        window.history.pushState({}, '', getCleanOriginBaseUrl());
        evaluateViewRoutingState(firebase.auth().currentUser);
      } else {
        switchWorkspaceTab(tabName);
      }
    }
