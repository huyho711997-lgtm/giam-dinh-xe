

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


    // Mục menu: nút thật (bàn phím + trình đọc màn hình), icon cùng một kiểu; active theo tab hiện tại.
    function renderHeaderSubmenuItems(items) {
      return items.filter(item => item.show).map(item => {
        const active = activeDashboardTab === item.tab;
        return `<button type="button" role="menuitem" class="header-nav-submenu-item ${active ? 'active' : ''}" ${active ? 'aria-current="page"' : ''} onclick="navigateHeaderTab('${item.tab}')">
                <span class="header-nav-submenu-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${item.icon}</svg></span>
                <span class="header-nav-submenu-copy">
                  <span class="header-nav-submenu-title">${item.title}${item.badge ? `<span class="header-nav-new-badge">${item.badge}</span>` : ''}</span>
                  <span class="header-nav-submenu-desc">${item.desc}</span>
                </span>
              </button>`;
      }).join('');
    }

    function setHeaderSubmenuOpen(sub, open) {
      sub.classList.toggle('open', open);
      document.querySelector('[aria-controls="' + sub.id + '"]')?.setAttribute('aria-expanded', String(open));
    }

    function toggleHeaderSubmenu(evt, submenuId) {
      if (evt) evt.stopPropagation();
      const sub = document.getElementById(submenuId);
      document.querySelectorAll('.header-nav-submenu').forEach(s => { if (s.id !== submenuId) setHeaderSubmenuOpen(s, false); });
      if (!sub) return;
      const open = !sub.classList.contains('open');
      setHeaderSubmenuOpen(sub, open);
      // Mở bằng bàn phím (Enter/Space) thì đưa tiêu điểm vào mục đầu tiên.
      if (open && evt && evt.detail === 0) sub.querySelector('[role="menuitem"]')?.focus();
    }

    // Phím tắt trong menu: ↑/↓/Home/End di chuyển, Esc đóng và trả tiêu điểm về nút mở.
    document.addEventListener('keydown', event => {
      const sub = event.target.closest?.('.header-nav-submenu') || (event.target.matches?.('.header-nav-trigger') ? document.getElementById(event.target.getAttribute('aria-controls')) : null);
      if (!sub) return;
      const items = [...sub.querySelectorAll('[role="menuitem"]')], index = items.indexOf(document.activeElement);
      if (event.key === 'Escape' && sub.classList.contains('open')) {
        event.preventDefault(); setHeaderSubmenuOpen(sub, false);
        document.querySelector('[aria-controls="' + sub.id + '"]')?.focus();
      } else if (['ArrowDown','ArrowUp','Home','End'].includes(event.key) && items.length) {
        event.preventDefault();
        if (!sub.classList.contains('open')) setHeaderSubmenuOpen(sub, true);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
        items[next].focus();
      } else if (event.key === 'Tab' && sub.classList.contains('open') && index !== -1) {
        setHeaderSubmenuOpen(sub, false);
      }
    });


    function renderHeaderNavigationLinks() {
      const navContainer = document.getElementById('mainNavigationBar');
      if (!navContainer) return;
      
      let tabsContainer = document.getElementById('headerNavTabsContainer');
      if (!tabsContainer) {
        tabsContainer = document.createElement('div');
        tabsContainer.id = 'headerNavTabsContainer';
        tabsContainer.className = 'header-nav-tabs-container';
        const userSpace = document.getElementById('navUserActionSpace');
        navContainer.insertBefore(tabsContainer, userSpace);
      }

      const isGroup1Active = ['list', 'pending', 'pending_notes_tracker', 'claim_cancellation', 'gdv_report', 'create'].includes(activeDashboardTab);
      const isAccActive = ['accounting_transfer', 'accounting_claims'].includes(activeDashboardTab) ? 'active' : '';
      const isGroup3Active = ['users', 'system'].includes(activeDashboardTab);

      const homeActive = activeDashboardTab === 'home' ? 'active' : '';
      const showList = hasUserPermission('list', 'view');
      const showPending = hasUserPermission('pending', 'view');
      const showReport = hasUserPermission('report', 'view');
      const showCreate = hasUserPermission('list', 'add');
      const showGroup1 = showList || showPending || showReport || showCreate;

      tabsContainer.innerHTML = `
        <div class="header-nav-tabs">
          
          <!-- 1. TRANG CHỦ -->
          <button id="headerNavHomeBtn" class="header-nav-btn ${homeActive}" onclick="navigateHeaderTab('home')">
            <span class="nav-btn-text">Trang chủ</span>
          </button>

          <!-- 2. QUẢN LÝ HỒ SƠ – menu thả xuống (css/header-navigation.css) -->
          ${showGroup1 ? `
          <div class="header-nav-dropdown-wrapper">
            <button type="button" id="headerNavClaimMgmtBtn" class="header-nav-btn header-nav-trigger ${isGroup1Active ? 'active' : ''}" aria-haspopup="menu" aria-expanded="false" aria-controls="submenuClaimMgmt" onclick="toggleHeaderSubmenu(event, 'submenuClaimMgmt')">
              <span class="nav-btn-text">Quản lý Hồ sơ</span>
              <svg class="header-nav-caret" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 8 4 4 4-4"/></svg>
            </button>
            <div id="submenuClaimMgmt" class="header-nav-submenu" role="menu" aria-labelledby="headerNavClaimMgmtBtn">
              ${renderHeaderSubmenuItems([
                {tab:'list', show:showList, title:'Hồ sơ giám định', desc:'Danh sách ca xe, PASC & duyệt HSBT', icon:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>'},
                {tab:'pending', show:showPending, title:'Hồ sơ bồi thường', desc:'Theo dõi tồn đọng & nhập Excel', icon:'<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>'},
                {tab:'pending_notes_tracker', show:showPending, title:'Tiến độ hồ sơ tồn', desc:'Theo dõi & ghi chú độc lập', icon:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'},
                {tab:'claim_cancellation', show:showPending || showList, title:'Đề xuất hủy hồ sơ', desc:'Tổng hợp hồ sơ GĐV cần hủy', badge:'Mới', icon:'<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6m0-6 6 6"/>'},
                {tab:'gdv_report', show:showReport, title:'Báo cáo & thống kê GĐV', desc:'Biểu đồ KPI & trích xuất báo cáo', icon:'<path d="M4 20h16"/><path d="M7 16v-5M12 16V6M17 16v-8"/>'}
              ])}
            </div>
          </div>
          ` : ''}

          <!-- 3. KẾ TOÁN (DIRECT TAB BUTTONS - ROLE BASED) -->
          ${hasUserPermission('accounting', 'review') ? `
            <button id="headerNavAccountingClaimsBtn" class="header-nav-btn ${activeDashboardTab === 'accounting_claims' ? 'active' : ''}" onclick="navigateHeaderTab('accounting_claims')">
              <span class="nav-btn-text">Hồ sơ thanh toán</span>
            </button>
          ` : ''}
          ${hasUserPermission('accounting', 'view') ? `
          <button id="headerNavAccountingBtn" class="header-nav-btn ${activeDashboardTab === 'accounting_transfer' ? 'active' : ''}" onclick="navigateHeaderTab('accounting_transfer')">
            <span class="nav-btn-text">Chuyển hồ sơ</span>
          </button>
          ` : ''}
          ${hasUserPermission('field_reimb', 'view') ? `
          <button id="headerNavFieldReimbursementBtn" class="header-nav-btn ${activeDashboardTab === 'field_reimbursements' ? 'active' : ''}" onclick="navigateHeaderTab('field_reimbursements')">
            <span class="nav-btn-text">Hiện trường</span>
          </button>
          ` : ''}

          <button id="headerNavSharedFormsBtn" type="button" class="header-nav-btn ${activeDashboardTab === 'shared_forms' ? 'active' : ''}" onclick="navigateHeaderTab('shared_forms')" ${activeDashboardTab === 'shared_forms' ? 'aria-current="page"' : ''}>
            <span class="nav-btn-text">Biểu mẫu dùng chung</span>
          </button>

          <!-- 4. QUẢN TRỊ SYSTEM -->
          ${hasUserPermission('users', 'view') ? `
          <button id="headerNavSystemAdminBtn" type="button" class="header-nav-btn ${isGroup3Active ? 'active' : ''}" onclick="navigateHeaderTab('users')" ${isGroup3Active ? 'aria-current="page"' : ''}>
            <span class="nav-btn-text">Quản trị System</span>
          </button>
          ` : ''}

        </div>
      `;
    }


    function removeHeaderNavigationLinks() {
      const tabsContainer = document.getElementById('headerNavTabsContainer');
      if (tabsContainer) tabsContainer.remove();
    }


    function navigateHeaderTab(tabName) {
      // Auto-close open dropdown submenus on item select
      document.querySelectorAll('.header-nav-submenu').forEach(s => setHeaderSubmenuOpen(s, false));

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
