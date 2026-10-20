

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


    function toggleHeaderSubmenu(evt, submenuId) {
      if (evt) evt.stopPropagation();
      const sub = document.getElementById(submenuId);
      const allSub = document.querySelectorAll('.header-nav-submenu');
      allSub.forEach(s => {
        if (s.id !== submenuId) s.classList.remove('open');
      });

      if (sub) {
        sub.classList.toggle('open');
      }
    }


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

      const isGroup1Active = ['list', 'pending', 'pending_notes_tracker', 'claim_cancellation', 'document_library', 'gdv_report', 'create'].includes(activeDashboardTab);
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

          <!-- 2. QUẢN LÝ HỒ SƠ DROPDOWN GROUP (NƠI CHỨA BÁO CÁO GĐV & CÁC CHỨC NĂNG HỒ SƠ) -->
          ${showGroup1 ? `
          <div class="header-nav-dropdown-wrapper">
            <button type="button" class="header-nav-btn ${isGroup1Active ? 'active' : ''}" onclick="toggleHeaderSubmenu(event, 'submenuClaimMgmt')">
              <span class="nav-btn-text">Quản lý Hồ sơ</span>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="none" style="margin-left: -4px; margin-top: 2px;"><polygon points="5 9 19 9 12 16"></polygon></svg>
            </button>
            <div id="submenuClaimMgmt" class="header-nav-submenu">
              ${showList ? `
              <div class="header-nav-submenu-item ${activeDashboardTab === 'list' ? 'active' : ''}" onclick="navigateHeaderTab('list')">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" style="color: #3b82f6;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                <div>
                  <div style="line-height: 1.2;">Hồ sơ giám định</div>
                  <span style="font-size: 10.5px; color: var(--text-soft); font-weight: 500;">Danh sách ca xe, PASC & duyệt HSBT</span>
                </div>
              </div>` : ''}
              ${showPending ? `
              <div class="header-nav-submenu-item ${activeDashboardTab === 'pending' ? 'active' : ''}" onclick="navigateHeaderTab('pending')">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary);"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                <div>
                  <div style="line-height: 1.2;">Hồ sơ bồi thường</div>
                  <span style="font-size: 10.5px; color: var(--text-soft); font-weight: 500;">Theo dõi tồn đọng & nhập Excel</span>
                </div>
              </div>` : ''}
              ${showPending ? `
              <div class="header-nav-submenu-item ${activeDashboardTab === 'pending_notes_tracker' ? 'active' : ''}" onclick="navigateHeaderTab('pending_notes_tracker')">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" style="color: #10b981;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                <div>
                  <div style="line-height: 1.2;">Tiến độ Hồ sơ Tồn</div>
                  <span style="font-size: 10.5px; color: var(--text-soft); font-weight: 500;">Theo dõi & ghi chú độc lập</span>
                </div>
              </div>` : ''}
              ${(showPending || showList) ? `
              <div class="header-nav-submenu-item ${activeDashboardTab === 'claim_cancellation' ? 'active' : ''}" onclick="navigateHeaderTab('claim_cancellation')">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" style="color: #ef4444;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                <div>
                  <div style="line-height: 1.2; display: flex; align-items: center; gap: 6px;">
                    <span>Đề xuất hủy hồ sơ</span>
                    <span class="header-nav-new-badge">MỚI</span>
                  </div>
                  <span style="font-size: 10.5px; color: var(--text-soft); font-weight: 500;">Tổng hợp hồ sơ GĐV cần hủy</span>
                </div>
              </div>` : ''}
              ${showPending ? `<button type="button" class="header-nav-submenu-item ${activeDashboardTab === 'document_library' ? 'active' : ''}" onclick="navigateHeaderTab('document_library')"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h18v14H3zM1 3h22v4H1zM9 12h6"/></svg><div><div>Kho sơ đồ & hướng dẫn</div><span style="font-size:10.5px;color:var(--text-soft);font-weight:500;">Lưu riêng · Giữ lại khi xoá hồ sơ</span></div></button>` : ''}
              ${showReport ? `
              <div class="header-nav-submenu-item ${activeDashboardTab === 'gdv_report' ? 'active' : ''}" onclick="navigateHeaderTab('gdv_report')">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" style="color: #a855f7;"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                <div>
                  <div style="line-height: 1.2;">Báo cáo & Thống kê GĐV</div>
                  <span style="font-size: 10.5px; color: var(--text-soft); font-weight: 500;">Xem biểu đồ KPI & trích xuất báo cáo</span>
                </div>
              </div>` : ''}
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
      document.querySelectorAll('.header-nav-submenu').forEach(s => s.classList.remove('open'));

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
