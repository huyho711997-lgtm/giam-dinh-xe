

    /****************************************************
     * 1. PREMIUM MANAGEMENT DASHBOARD WORKSPACE
     ****************************************************/
    function filterCasesByUserPrivileges(casesPayload, currentUserInstance) {
      if (!currentUserInstance) return {};
      
      const isAdmin = activeUserProfile && String(activeUserProfile.role || '').trim().toLowerCase() === 'admin';
      if (isAdmin) {
        return casesPayload; // Admins can see everything
      }
      
      const userProfile = activeUserProfile || {};
      const userDisplayName = String(userProfile.displayName || '').trim().toLowerCase();
      const userEmail = String(userProfile.email || currentUserInstance.email || '').trim().toLowerCase();
      
      const filtered = {};
      Object.entries(casesPayload || {}).forEach(([key, val]) => {
        const creatorUid = val.nguoiTao?.uid || '';
        const gdvName = String(val.gdvTiepNhan || '').trim().toLowerCase();
        const cbxlName = String(val.canBoXuLy || '').trim().toLowerCase();
        
        const isCreator = (creatorUid === currentUserInstance.uid);
        const isAssignedGdv = gdvName && (gdvName === userDisplayName || gdvName === userEmail);
        const isAssignedCbxl = cbxlName && (cbxlName === userDisplayName || cbxlName === userEmail);
        
        if (isCreator || isAssignedGdv || isAssignedCbxl || !val.nguoiTao) {
          filtered[key] = val;
        }
      });
      return filtered;
    }


    function filterPendingClaimsByUserPrivileges(claimsPayload, currentUserInstance) {
      if (!currentUserInstance) return {};
      
      const isAdmin = activeUserProfile && String(activeUserProfile.role || '').trim().toLowerCase() === 'admin';
      if (isAdmin) {
        return claimsPayload; // Admins can see everything
      }
      
      const userProfile = activeUserProfile || {};
      const userDisplayName = String(userProfile.displayName || '').trim().toLowerCase();
      const userEmail = String(userProfile.email || currentUserInstance.email || '').trim().toLowerCase();
      
      const filtered = {};
      Object.entries(claimsPayload || {}).forEach(([key, val]) => {
        const creatorUid = val.createdByUid || val.nguoiTao?.uid || '';
        const gdvName = String(val.gdvTiepNhan || '').trim().toLowerCase();
        const cbxlName = String(val.canBoXuLy || '').trim().toLowerCase();
        
        const isCreator = (creatorUid === currentUserInstance.uid);
        const isAssignedGdv = gdvName && (gdvName === userDisplayName || gdvName === userEmail);
        const isAssignedCbxl = cbxlName && (cbxlName === userDisplayName || cbxlName === userEmail);
        
        // Also support backward compatibility for items with no creator info
        const hasNoCreator = !val.createdByUid && !val.nguoiTao;
        
        if (isCreator || isAssignedGdv || isAssignedCbxl || hasNoCreator) {
          filtered[key] = val;
        }
      });
      return filtered;
    }


    function renderManagerDashboardWorkspace() {
      rootContainer.innerHTML = `
        <div id="tabContentContainer"></div>
        <section id="panelOutputResultAnchor" class="p-card success-panel" style="display:none;"></section>
      `;

      renderActiveTabContent();

      // Update header tabs active states
      renderHeaderNavigationLinks();

      dbNodeInstance.ref('cases').off();
      dbNodeInstance.ref('cases').on('value', (dataSnapshot) => {
        const val = dataSnapshot.val() || {};
        const currentUser = firebase.auth().currentUser;
        const filteredVal = filterCasesByUserPrivileges(val, currentUser);
        
        cachedCasesPayload = filteredVal;
        
        updateStatsCounters(filteredVal);

        if (activeDashboardTab === 'list') {
          executeUIRenderCasesTable(filteredVal);
        }
      });

      
      dbNodeInstance.ref('settings/reportRules').off();
      dbNodeInstance.ref('settings/reportRules').on('value', snap => {
        const defaultRules = {
          phatSinhExcludes: 'tu_choi',
          tndsKeywords: 'tnds,trách nhiệm dân sự',
          unpaidStatuses: 'da_thanh_toan,da thanh toán,da_hoan_thanh,da hoàn thành,tu_choi',
          approvedStatuses: 'da_duyet_hsbt,cho_duyet_dntt,cho_kt_duyet,kt_duyet,da_thanh_toan',
          chuyenDnttStatuses: '',
          hsDpbtStatuses: 'moi,cho_giam_dinh_ht,da_giam_dinh_ht,cho_gdct,da_gdct,cho_duyet_pasc',
          onlyApprovedStatuses: 'da_duyet_hsbt,cho_kt_duyet',
          hsTonDays: 30,
          hsDpbtAmount: 50000000,
          avgAmount: 10000000,
          carplaKeywords: 'carpla',
          phatSinhDateField: 'ngayMoHs',
          daDuyetDateField: 'ngayMoHs',
          chuyenDnttDateField: 'ngayNhanDuHoSo',
          carplaDateField: 'toTrinhNgayDuyet',
          tndsTonDateField: 'none',
          hsTonDateField: 'ngayMoHs',
          hsDpbtDateField: 'none',
          avgAmountDateField: 'toTrinhNgayDuyet'
        };
        
        if (snap.exists()) {
          const rules = snap.val();
          cachedReportRules = { ...defaultRules, ...rules };
        } else {
          cachedReportRules = { ...defaultRules };
        }
        
        if (activeDashboardTab === 'gdv_report') {
          renderGdvMonthlyReportPage();
        }
      });

      dbNodeInstance.ref('pending_claims').off();
      dbNodeInstance.ref('pending_claims').on('value', (snapshot) => {
        const val = snapshot.val() || {};
        rawPendingClaimsPayload = val;
        const currentUser = firebase.auth().currentUser;
        cachedPendingClaimsPayload = filterPendingClaimsByUserPrivileges(val, currentUser);
        if (activeDashboardTab === 'pending') {
          executeUIRenderPendingClaims();
        }
        if (activeDashboardTab === 'claim_cancellation') {
          renderClaimCancellationPage();
        }
      });

      dbNodeInstance.ref('pending_notes').on('value', (snapshot) => {
        cachedPendingNotesPayload = snapshot.val() || {};
        if (typeof ClaimEditorWorkspace !== 'undefined') ClaimEditorWorkspace.refreshNotes();
        if (activeDashboardTab === 'pending_notes_tracker') {
          renderPendingNotesTrackerPage();
        }
      });

      dbNodeInstance.ref('claim_cancellations').off();
      dbNodeInstance.ref('claim_cancellations').on('value', (snapshot) => {
        cachedClaimCancellationsPayload = snapshot.val() || {};
        if (activeDashboardTab === 'claim_cancellation' && typeof renderClaimCancellationPage === 'function') {
          renderClaimCancellationPage();
        }
        if (activeDashboardTab === 'pending' && typeof renderPendingClaimsTable === 'function') {
          renderPendingClaimsTable();
        }
      });

      dbNodeInstance.ref('accounting_transfers').off();
      dbNodeInstance.ref('accounting_transfers').on('value', (snapshot) => {
        cachedAccountingTransfersPayload = snapshot.val() || {};
        if (activeDashboardTab === 'accounting_transfer') renderAccountingTransferPage();
        if (activeDashboardTab === 'accounting_claims') renderAccountingClaimsPage();
        
        // Cập nhật số đếm chuông thông báo
        renderNotificationCenterItems();
      });

      dbNodeInstance.ref('field_reimbursements').off();
      dbNodeInstance.ref('field_reimbursements').on('value', (snapshot) => {
        cachedFieldReimbursementsPayload = snapshot.val() || {};
        if (activeDashboardTab === 'field_reimbursements') {
          if (typeof renderFieldReimbursementsPage === 'function') renderFieldReimbursementsPage();
        }
      });
    }


    function switchWorkspaceTab(tabName) {
      if (tabName === 'list' && !hasUserPermission('list', 'view')) {
        triggerToast('Bạn không có quyền truy cập danh sách hồ sơ giám định.', 'warning');
        if (activeDashboardTab === 'list') activeDashboardTab = 'home';
        return;
      }
      if (tabName === 'pending' && !hasUserPermission('pending', 'view')) {
        triggerToast('Bạn không có quyền truy cập hồ sơ bồi thường tồn.', 'warning');
        if (activeDashboardTab === 'pending') activeDashboardTab = 'home';
        return;
      }
      if (tabName === 'pending_notes_tracker' && !hasUserPermission('pending', 'view')) {
        triggerToast('Bạn không có quyền truy cập theo dõi tiến độ hồ sơ.', 'warning');
        if (activeDashboardTab === 'pending_notes_tracker') activeDashboardTab = 'home';
        return;
      }
      if (tabName === 'claim_cancellation' && !hasUserPermission('pending', 'view') && !hasUserPermission('list', 'view')) {
        triggerToast('Bạn không có quyền truy cập trang đề xuất hủy hồ sơ.', 'warning');
        if (activeDashboardTab === 'claim_cancellation') activeDashboardTab = 'home';
        return;
      }
      if (tabName === 'gdv_report' && !hasUserPermission('report', 'view')) {
        triggerToast('Bạn không có quyền truy cập báo cáo & thống kê GĐV.', 'warning');
        if (activeDashboardTab === 'gdv_report') activeDashboardTab = 'home';
        return;
      }
      if (tabName === 'create' && !hasUserPermission('list', 'add')) {
        triggerToast('Bạn không có quyền tạo mới hồ sơ giám định.', 'warning');
        if (activeDashboardTab === 'create') activeDashboardTab = 'home';
        return;
      }
      if (tabName === 'accounting_claims' && !hasUserPermission('accounting', 'review')) {
        triggerToast('Trang "Hồ sơ Kế toán" dành riêng cho bộ phận Kế toán & Admin có quyền xét duyệt.', 'warning');
        if (activeDashboardTab === 'accounting_claims') activeDashboardTab = 'home';
        return;
      }
      if (tabName === 'accounting_transfer' && !hasUserPermission('accounting', 'view')) {
        triggerToast('Bạn không có quyền truy cập trang chuyển giao kế toán.', 'warning');
        if (activeDashboardTab === 'accounting_transfer') activeDashboardTab = 'home';
        return;
      }
      if (tabName === 'users' && !hasUserPermission('users', 'view')) {
        triggerToast('Bạn không có quyền truy cập trang quản lý người dùng.', 'warning');
        if (activeDashboardTab === 'users') activeDashboardTab = 'home';
        return;
      }
      if (tabName === 'field_reimbursements' && !hasUserPermission('field_reimb', 'view')) {
        triggerToast('Bạn không có quyền truy cập trang thanh toán hiện trường.', 'warning');
        if (activeDashboardTab === 'field_reimbursements') activeDashboardTab = 'home';
        return;
      }

      if (tabName === 'gdv_report') {
        activeGdvReportView = 'weekly_zone';
      }

      if (activeDashboardTab === tabName) {
        if (tabName === 'gdv_report') {
          renderActiveTabContent();
        }
        return;
      }
      activeDashboardTab = tabName;
      
      // Keep Firebase realtime listeners active for instant updates on lists and home counts

      if (tabName === 'create') {
        if (!editingCaseId) {
          activeCreateFlowMode = 'select';
        }
      }
      
      renderHeaderNavigationLinks();

      const outputCardBox = document.getElementById('panelOutputResultAnchor');
      if (outputCardBox) outputCardBox.style.display = 'none';

      renderActiveTabContent();
    }


    function renderActiveTabContent() {
      const container = document.getElementById('tabContentContainer');
      if (!container) return;
      SharedForms.leave();

      if (activeDashboardTab === 'shared_forms') {
        SharedForms.mount(container);
        return;
      }

      const isAdmin = activeUserProfile && (
        String(activeUserProfile.role || '').trim().toLowerCase() === 'admin' ||
        String(activeUserProfile.role || '').trim().toLowerCase() === 'truong_nhom' ||
        activeUserProfile.isAdmin === true
      );

      if (activeDashboardTab === 'claim_cancellation') {
        renderClaimCancellationPage(container);
        return;
      }

      if (activeDashboardTab === 'gdv_report') {
        renderGdvMonthlyReportPage(container);
        return;
      }

      if (activeDashboardTab === 'accounting_transfer') {
        renderAccountingTransferPage(container);
        return;
      }

      if (activeDashboardTab === 'field_reimbursements') {
        if (typeof renderFieldReimbursementsPage === 'function') renderFieldReimbursementsPage(container);
        return;
      }

      if (activeDashboardTab === 'accounting_claims') {
        renderAccountingClaimsPage(container);
        return;
      }

      if (activeDashboardTab === 'pending_notes_tracker') {
        renderPendingNotesTrackerPage(container);
        return;
      }


      if (activeDashboardTab === 'home') {
        const showList = hasUserPermission('list', 'view');
        const showCreate = hasUserPermission('list', 'add');
        const showPending = hasUserPermission('pending', 'view');
        const showReport = hasUserPermission('report', 'view');
        const showAccountingReview = hasUserPermission('accounting', 'review');
        const showAccountingView = hasUserPermission('accounting', 'view');
        const showFieldReimb = hasUserPermission('field_reimb', 'view');
        const showCancellation = showPending || showList;
        const showAdmin = isAdmin || hasUserPermission('users', 'admin') || hasUserPermission('users', 'view');

        const totalCases = Object.keys(cachedCasesPayload || {}).length;
        const totalPendingClaims = Object.keys(cachedPendingClaimsPayload || {}).length;
        const totalTransfers = Object.keys(cachedAccountingTransfersPayload || {}).length;
        const totalReimbs = Object.keys(cachedFieldReimbursementsPayload || {}).length;

        container.innerHTML = renderHomeDashboardPage({
          showList, showCreate, showPending, showReport, showAccountingReview, showAccountingView, showFieldReimb, showCancellation, showAdmin,
          totalCases, totalPendingClaims, totalTransfers, totalReimbs
        });
      } else if (activeDashboardTab === 'list') {
        container.innerHTML=renderInspectionRegisterPage();
        syncAdminSelects(container);
        updateStatsCounters(cachedCasesPayload);
        executeUIRenderCasesTable(cachedCasesPayload);
      } else if (activeDashboardTab === 'users') {
        const activeSubTab = activeSystemAdminSubTab || 'users';
        container.innerHTML = `
          <div class="workspace-grid single-col">
            <section class="p-card cases-panel system-admin-panel">
              <div class="admin-hero">
                <div class="admin-hero-icon"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary);"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg></div>
                <div><div class="admin-eyebrow">TASCO DLK · CẤU HÌNH & VẬN HÀNH</div>
                  <h2>Quản trị hệ thống</h2>
                  <p>Quản lý thành viên, phân quyền truy cập và cấu hình dịch vụ trên một không gian thống nhất.</p>
                </div>
              </div>
              <nav class="admin-nav" aria-label="Các mục quản trị hệ thống"><button type="button" class="filter-pill ${activeSubTab === 'users' ? 'active' : ''}" onclick="switchSystemAdminSubTab('users')" aria-pressed="${activeSubTab === 'users'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg><span>Tài khoản</span></button>
${hasUserPermission('users', 'admin') ? `<button type="button" class="filter-pill ${activeSubTab === 'api-keys' ? 'active' : ''}" onclick="switchSystemAdminSubTab('api-keys')" aria-pressed="${activeSubTab === 'api-keys'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7" cy="16" r="5"/><path d="m11 12 10-10m-5 5 3 3 3-3-3-3"/></svg><span>Gemini API</span></button>` : ''}
${hasUserPermission('users', 'admin') ? `<button type="button" class="filter-pill ${activeSubTab === 'cloudinary' ? 'active' : ''}" onclick="switchSystemAdminSubTab('cloudinary')" aria-pressed="${activeSubTab === 'cloudinary'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg><span>Cloudinary</span></button>` : ''}
<button type="button" class="filter-pill ${activeSubTab === 'audit-logs' ? 'active' : ''}" onclick="switchSystemAdminSubTab('audit-logs')" aria-pressed="${activeSubTab === 'audit-logs'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span>Nhật ký hoạt động</span></button>
${hasUserPermission('users', 'admin') ? `<button type="button" class="filter-pill ${activeSubTab === 'kpi-config' ? 'active' : ''}" onclick="switchSystemAdminSubTab('kpi-config')" aria-pressed="${activeSubTab === 'kpi-config'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 20V10M12 20v-6M18 20V4"/></svg><span>Hệ số KPI & lương</span></button>` : ''}</nav>
              <div id="systemAdminSubTabContainer"></div>
            </section>
          </div>
        `;
        renderSystemAdminTabContent();
      } else if (activeDashboardTab === 'pending') {
        container.innerHTML = `
          <div class="workspace-grid single-col">
            <section class="pending-workspace pending-workspace--v2" aria-label="Quản lý hồ sơ tồn">
              <!-- Đầu trang không khung (cùng bố cục trang Biểu mẫu dùng chung). Bỏ dashboard 4 thẻ số liệu:
                   tổng/kết quả lọc đã hiển thị ngay trên thanh danh sách. -->
              <header class="pw-page-head">
                <div class="pw-page-title">
                  <div class="pw-page-emblem" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path><path d="M14 3v5h5M9 13h6M9 17h4"></path></svg>
                  </div>
                  <div>
                    <span class="pw-eyebrow">Trung tâm điều hành tổn thất</span>
                    <h1>Hồ sơ bồi thường</h1>
                    <p>Quản lý hồ sơ tồn, phân công giám định viên và theo dõi tiến độ xử lý theo từng kỳ.</p>
                  </div>
                </div>
                <div class="pending-action-group" role="group" aria-label="Thao tác dữ liệu hồ sơ">
                  ${hasUserPermission('pending', 'delete') ? `
                    <button type="button" class="pending-action-btn pending-action-btn--danger" onclick="clearAllPendingClaimsDataByAdmin()" title="Chỉ Admin mới có quyền xóa toàn bộ hồ sơ tồn">
                      <span class="pending-action-btn__icon"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></span>
                      <span>Xóa toàn bộ hồ sơ tồn</span>
                    </button>
                  ` : ''}

                  ${(typeof ClaimImportVersions !== 'undefined' && ClaimImportVersions.isAdmin()) ? `
                  <button type="button" class="pending-action-btn" onclick="openClaimImportHistory()" title="Xem lịch sử cập nhật, so sánh và khôi phục dữ liệu hồ sơ">
                    <span class="pending-action-btn__icon"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg></span>
                    <span>Lịch sử cập nhật</span>
                  </button>
                  ` : ''}
                  ${(typeof ClaimImportVersions !== 'undefined' ? ClaimImportVersions.isAdmin() : (activeUserProfile && String(activeUserProfile.role || '').trim().toLowerCase() === 'admin')) ? `
                  <button type="button" class="pending-action-btn pending-action-btn--import" onclick="openImportExcelModal()" title="Nhập mới hoặc cập nhật hồ sơ từ tệp Excel">
                    <span class="pending-action-btn__icon"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h8"></path><path d="M8 17h8"></path><path d="M10 9h4"></path></svg></span>
                    <span>Cập nhật dữ liệu từ Excel</span>
                  </button>
                  ` : ''}
                </div>
              </header>

              <div class="pending-register-panel">
                <div class="pending-register-topbar">
                  <div class="pending-register-header">
                    <h3>Danh sách hồ sơ</h3>
                    <div id="pendingFilterSummary" class="pending-filter-summary" aria-live="polite"></div>
                  </div>
                  <div id="pendingClaimsPaginationContainer" class="pending-pagination"></div>
                </div>

              <!-- Bộ lọc nằm trong thẻ danh sách -->
              <div class="pending-filter-toolbar">
                <div class="pending-filter-search">
                  <span class="pending-filter-search__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg></span>
                  <input id="pendingSearchInput" class="pending-filter-search__input" type="search" placeholder="Biển số, số HSBT, mã VTT hoặc GĐV…" autocomplete="off" aria-label="Tìm kiếm hồ sơ theo biển số, số HSBT, mã vụ tổn thất hoặc giám định viên" />
                </div>

                <div class="pending-filter-controls">
                  <div class="custom-dropdown-container pending-filter-select pending-filter-select--status">
                    <button id="btnCustomStatusDropdown" class="pending-filter-trigger" type="button" onclick="toggleCustomStatusDropdown(event)" aria-haspopup="listbox" aria-expanded="false">
                      <span class="pending-filter-trigger__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16M7 12h10M10 19h4"></path></svg></span>
                      <span class="pending-filter-trigger__copy"><span class="pending-filter-trigger__caption">Trạng thái</span><span id="lblCustomStatusDropdownSelected" class="pending-filter-trigger__value">Tất cả · 0</span></span>
                      <svg class="pending-filter-trigger__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m7 10 5 5 5-5"></path></svg>
                    </button>
                    <div id="menuCustomStatusDropdown" class="custom-dropdown-menu pending-filter-menu" role="listbox" aria-label="Trạng thái hồ sơ" aria-multiselectable="true" style="display:none;"></div>
                  </div>

                  <div class="custom-dropdown-container pending-filter-select pending-filter-select--coverage">
                    <button id="btnCustomCoverageDropdown" class="pending-filter-trigger pending-filter-trigger--purple" type="button" onclick="toggleCustomCoverageDropdown(event)" aria-haspopup="listbox" aria-controls="menuCustomCoverageDropdown" aria-expanded="false" title="Phạm vi Bảo hiểm VCX & TNDS">
                      <span class="pending-filter-trigger__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"></path><path d="m9 12 2 2 4-5"></path></svg></span>
                      <span class="pending-filter-trigger__copy"><span class="pending-filter-trigger__caption">Phạm vi BH</span><span id="lblCustomCoverageDropdownSelected" class="pending-filter-trigger__value">Tất cả phạm vi</span></span>
                      <svg class="pending-filter-trigger__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m7 10 5 5 5-5"></path></svg>
                    </button>
                    <div id="menuCustomCoverageDropdown" class="custom-dropdown-menu pending-filter-menu pending-filter-menu--coverage" role="listbox" aria-label="Phạm vi Bảo hiểm VCX & TNDS" style="display:none;"></div>
                  </div>

                  <div class="custom-dropdown-container pending-filter-select">
                    <button id="btnCustomGdvDropdown" class="pending-filter-trigger pending-filter-trigger--blue" type="button" onclick="toggleCustomGdvDropdown(event)" aria-haspopup="listbox" aria-expanded="false">
                      <span class="pending-filter-trigger__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="3.5"></circle><path d="M5 20a7 7 0 0 1 14 0"></path></svg></span>
                      <span class="pending-filter-trigger__copy"><span class="pending-filter-trigger__caption">Giám định viên</span><span id="lblCustomGdvDropdownSelected" class="pending-filter-trigger__value">Tất cả GĐV</span></span>
                      <svg class="pending-filter-trigger__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m7 10 5 5 5-5"></path></svg>
                    </button>
                    <div id="menuCustomGdvDropdown" class="custom-dropdown-menu pending-filter-menu" role="listbox" aria-label="Giám định viên" aria-multiselectable="true" style="display:none;"></div>
                  </div>

                  <div class="custom-dropdown-container pending-filter-select pending-filter-select--period">
                    <button id="btnCustomPeriodDropdown" class="pending-filter-trigger pending-filter-trigger--green" type="button" onclick="toggleCustomPeriodDropdown(event)" aria-haspopup="listbox" aria-expanded="false">
                      <span class="pending-filter-trigger__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M8 3v4M16 3v4M3 10h18"></path></svg></span>
                      <span class="pending-filter-trigger__copy"><span class="pending-filter-trigger__caption">Thời gian</span><span id="lblCustomPeriodDropdownSelected" class="pending-filter-trigger__value">Tất cả</span></span>
                      <svg class="pending-filter-trigger__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m7 10 5 5 5-5"></path></svg>
                    </button>
                    <div id="menuCustomPeriodDropdown" class="custom-dropdown-menu pending-filter-menu pending-filter-menu--right" role="listbox" style="display:none;"></div>
                  </div>

                </div>
                  <button type="button" class="pending-filter-reset" onclick="resetAllPendingClaimFilters()" title="Đặt lại toàn bộ bộ lọc" aria-label="Đặt lại bộ lọc">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7v5h-5"></path><path d="M19 12a7 7 0 1 0-2 4.9"></path></svg>
                  </button>

              </div>

              <!-- Table Container -->
              <div class="table-container pending-register-table" style="border: 1px solid var(--border); border-radius: 14px; background: var(--bg-soft); overflow: hidden;">
                <table class="p-table" style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                  <thead>
                    <tr>
                      <th style="width: 44px; text-align: center;">#</th>
                      <th class="pending-col-status" style="width: 130px; text-align: left;">Trạng thái hồ sơ</th>
                      <th style="width: 220px;">Biển số xe</th>
                      <th style="width: 180px;">Tên chủ xe</th>
                      <th style="width: 190px;">Hãng xe & Đơn vị cấp</th>
                      <th style="width: 260px; min-width: 200px;">Nội dung tổn thất & Địa điểm</th>
                      <th style="width: 155px; text-align: right; padding-right: 15px;">
                        Số tiền BT<br>
                        <span style="font-size: 9px; opacity: 0.7; text-transform: uppercase; font-weight: 750;">&amp; Dự phòng</span>
                      </th>
                      <th style="width: 145px;">Giám định viên</th>
                      <th style="width: 70px; text-align: center;">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody id="tblPendingClaimsBodyContainer">
                    <tr><td colspan="10" class="empty-state-text">Đang đồng bộ danh sách hồ sơ tồn...</td></tr>
                  </tbody>
                </table>
              </div>


              </div>
            </section>
          </div>
        `;

        const searchInput = document.getElementById('pendingSearchInput');
        if (searchInput) searchInput.addEventListener('input', debouncedExecuteUIRenderPendingClaims);

        executeUIRenderPendingClaims();
      } else {
        if (activeCreateFlowMode === 'select') {
          container.innerHTML = `
            <div class="workspace-grid single-col">
              <section class="p-card" style="padding: 32px; position: relative;">
                <button onclick="navigateHeaderTab('list')" style="position: absolute; left: 32px; top: 32px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: transparent; border: 1px solid var(--border-strong); border-radius: 10px; padding: 8px 16px; font-size: 13.5px; font-weight: 700; color: var(--text-main); cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.02);" onmouseover="this.style.background='var(--surface)'; this.style.borderColor='var(--primary)'; this.style.color='var(--primary)';" onmouseout="this.style.background='transparent'; this.style.borderColor='var(--border-strong)'; this.style.color='var(--text-main)';">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                  Quay lại
                </button>
                <div class="p-card-head" style="margin-bottom: 32px; text-align: center; display: block;">
                  <h2 style="font-size: 20px; font-weight: 800; color: var(--text-main);">Chọn phương thức khởi tạo hồ sơ</h2>
                  <p style="margin-top: 8px; font-size: 13px; color: var(--text-soft);">Vui lòng chọn kiểu tác nghiệp phù hợp nhất cho xe cơ giới hiện tại.</p>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;">
                  <div class="creation-option-card" onclick="applyTemplateToDraft('giam-dinh-xe')">
                    <div class="creation-card-watermark">01</div>
                    <div class="creation-card-icon-wrap" style="background: rgba(216,180,109,0.12); color: var(--primary);">
                      ${SVGS.CAR}
                    </div>
                    <h3 style="font-size: 16px; font-weight: 800; color: var(--text-main); margin-bottom: 12px; line-height: 1.4;">1. Hồ sơ Giám định Tiêu chuẩn</h3>
                    <p style="font-size: 12.5px; color: var(--text-muted); line-height: 1.6; margin-bottom: 28px; min-height: 60px; max-width: 280px;">
                      Yêu cầu Gara chụp Giấy tờ (Cà vẹt, GPLX, CCCD 2 mặt, Đăng kiểm), Ảnh 4 góc xe, Tem, Số khung & Gara tự tạo thêm hạng mục tại xưởng.
                    </p>
                    <button type="button" class="btn-premium" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px;"><span>Tạo mẫu Giám định chuẩn</span> ${SVGS.ARROW_RIGHT}</button>
                  </div>

                  <div class="creation-option-card" onclick="switchCreateFlow('excel')">
                    <div class="creation-card-watermark">02</div>
                    <div class="creation-card-icon-wrap" style="background: rgba(216,180,109,0.08); color: var(--primary);">
                      </div>
                    <h3 style="font-size: 16px; font-weight: 800; color: var(--text-main); margin-bottom: 12px; line-height: 1.4;">2. Bổ sung hình ảnh theo hạng mục chỉ định</h3>
                    <p style="font-size: 12.5px; color: var(--text-muted); line-height: 1.6; margin-bottom: 28px; min-height: 60px; max-width: 280px;">
                      Phù hợp khi đã có báo giá hoặc danh sách hạng mục cần đối chiếu. Nhập tay hoặc dán cột hàng loạt từ Microsoft Excel.
                    </p>
                    <button type="button" class="btn-premium" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px;"><span>Tạo bằng danh sách</span> ${SVGS.ARROW_RIGHT}</button>
                  </div>
                  
                  <div class="creation-option-card" onclick="switchCreateFlow('image')">
                    <div class="creation-card-watermark">03</div>
                    <div class="creation-card-icon-wrap" style="background: rgba(40,167,69,0.08); color: var(--success);">
                      ${SVGS.IMAGE}
                    </div>
                    <h3 style="font-size: 16px; font-weight: 800; color: var(--text-main); margin-bottom: 12px; line-height: 1.4;">3. Chỉ tải ảnh hiện trường</h3>
                    <p style="font-size: 12.5px; color: var(--text-muted); line-height: 1.6; margin-bottom: 28px; min-height: 60px; max-width: 280px;">
                      Phù hợp khi mới tiếp nhận xe tại hiện trường. Chỉ tải ảnh tổn thất, Garage sẽ tự nhận định bộ phận hư hỏng sau.
                    </p>
                    <button type="button" class="btn-premium" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px;"><span>Tạo bằng hình ảnh</span> ${SVGS.ARROW_RIGHT}</button>
                  </div>
                  
                  <div class="creation-option-card" onclick="switchCreateFlow('template')">
                    <div class="creation-card-watermark">04</div>
                    <div class="creation-card-icon-wrap" style="background: rgba(23,162,184,0.08); color: #17a2b8;">
                      ${SVGS.SPARKLES}
                    </div>
                    <h3 style="font-size: 16px; font-weight: 800; color: var(--text-main); margin-bottom: 12px; line-height: 1.4;">4. Dùng mẫu va chạm khác</h3>
                    <p style="font-size: 12.5px; color: var(--text-muted); line-height: 1.6; margin-bottom: 28px; min-height: 60px; max-width: 280px;">
                      Khởi tạo nhanh bằng các mẫu va chạm tiêu chuẩn của hãng (Đâm đầu xe, va chạm đuôi xe, ngập nước...) để tự động điền bảng.
                    </p>
                    <button type="button" class="btn-premium" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px;"><span>Xem các mẫu chuẩn</span> ${SVGS.ARROW_RIGHT}</button>
                  </div>

                  <div class="creation-option-card" onclick="switchCreateFlow('combined')">
                    <div class="creation-card-watermark">05</div>
                    <div class="creation-card-icon-wrap" style="background: rgba(216,180,109,0.12); color: var(--primary);">
                      ${SVGS.SPARKLES}
                    </div>
                    <h3 style="font-size: 16px; font-weight: 800; color: var(--text-main); margin-bottom: 12px; line-height: 1.4;">5. Bổ sung hình ảnh theo hạng mục báo giá</h3>
                    <p style="font-size: 12.5px; color: var(--text-muted); line-height: 1.6; margin-bottom: 28px; min-height: 60px; max-width: 280px;">
                      Nhập danh sách hạng mục cần đối chiếu từ báo giá để Gara tiến hành chụp và bổ sung ảnh.
                    </p>
                    <button type="button" class="btn-premium" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px;"><span>Tạo kết hợp</span> ${SVGS.ARROW_RIGHT}</button>
                  </div>
                </div>
              </section>
            </div>
          `;
        } else if (activeCreateFlowMode === 'template') {
          container.innerHTML = `
            <div class="workspace-grid single-col">
              <section class="p-card create-panel" style="padding: 24px;">
                <button type="button" class="btn-premium btn-secondary" onclick="switchCreateFlow('select')" style="max-width: 140px; min-height: 36px !important; font-size: 11px; margin-bottom: 20px;">${SVGS.ARROW_LEFT} Quay lại</button>
                <div class="p-card-head" style="margin-bottom: 24px;">
                  <div>
                    <h2>Khởi tạo từ Mẫu danh mục chuẩn</h2>
                    <p>Chọn mẫu va chạm để tự động điền danh sách phụ tùng tương ứng.</p>
                  </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
                  <div class="p-card" style="padding: 24px; cursor: pointer; transition: all var(--transition); border: 1.5px solid var(--primary);" onclick="applyTemplateToDraft('giam-dinh-xe')">
                    <div style="width: 42px; height: 42px; display: grid; place-items: center; border-radius: 10px; background: rgba(216,180,109,0.15); color: var(--primary); margin-bottom: 16px;">${SVGS.CAR}</div>
                    <h4 style="font-size: 15px; font-weight: 800; margin-bottom: 8px; color: var(--primary); display: inline-flex; align-items: center; gap: 6px;">${SVGS.SPARKLES} <span>Mẫu Giám định Xe đầy đủ</span></h4>
                    <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-bottom: 16px;">Bộ 13 mục chuẩn: Giấy tờ (Cà vẹt, GPLX, CCCD 2 mặt, Sổ đăng kiểm), 4 góc chéo, Tem đăng kiểm, Số khung (VIN) & Gara chụp linh hoạt.</p>
                    <button type="button" class="btn-premium" style="min-height: 36px !important; font-size: 11px;">Áp dụng mẫu này</button>
                  </div>
                  <div class="p-card" style="padding: 24px; cursor: pointer; transition: all var(--transition);" onclick="applyTemplateToDraft('dau-xe')">
                    <div style="width: 42px; height: 42px; display: grid; place-items: center; border-radius: 10px; background: rgba(216,180,109,0.08); color: var(--primary); margin-bottom: 16px;">${SVGS.CAR}</div>
                    <h4 style="font-size: 15px; font-weight: 800; margin-bottom: 8px; color: var(--text-main);">Mẫu đâm va đầu xe</h4>
                    <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-bottom: 16px;">Tự động tạo danh mục: Cản trước, Đèn pha trái/phải, Mặt ca lăng, Nắp ca pô, Kính chắn gió trước...</p>
                    <button type="button" class="btn-premium btn-secondary" style="min-height: 36px !important; font-size: 11px;">Áp dụng mẫu này</button>
                  </div>
                  <div class="p-card" style="padding: 24px; cursor: pointer; transition: all var(--transition);" onclick="applyTemplateToDraft('duoi-xe')">
                    <div style="width: 42px; height: 42px; display: grid; place-items: center; border-radius: 10px; background: rgba(40,167,69,0.08); color: var(--success); margin-bottom: 16px;">${SVGS.CHECK_CIRCLE}</div>
                    <h4 style="font-size: 15px; font-weight: 800; margin-bottom: 8px; color: var(--text-main);">Mẫu va chạm đuôi xe</h4>
                    <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-bottom: 16px;">Tự động tạo danh mục: Cản sau, Cốp sau, Đèn hậu trái/phải, Kính sau, Lốp/Mâm sau...</p>
                    <button type="button" class="btn-premium btn-secondary" style="min-height: 36px !important; font-size: 11px;">Áp dụng mẫu này</button>
                  </div>
                  <div class="p-card" style="padding: 24px; cursor: pointer; transition: all var(--transition);" onclick="applyTemplateToDraft('than-xe')">
                    <div style="width: 42px; height: 42px; display: grid; place-items: center; border-radius: 10px; background: rgba(23,162,184,0.08); color: #17a2b8; margin-bottom: 16px;">${SVGS.USER}</div>
                    <h4 style="font-size: 15px; font-weight: 800; margin-bottom: 8px; color: var(--text-main);">Mẫu va chạm thân bên</h4>
                    <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-bottom: 16px;">Tự động tạo danh mục: Gương trái/phải, Cửa trước/sau trái/phải, Tai xe hông...</p>
                    <button type="button" class="btn-premium btn-secondary" style="min-height: 36px !important; font-size: 11px;">Áp dụng mẫu này</button>
                  </div>
                </div>
              </section>
            </div>
          `;
        } else if (activeCreateFlowMode === 'image') {
          container.innerHTML = `
            <div class="workspace-grid single-col">
              <section class="p-card create-panel">
                <button type="button" class="btn-premium btn-secondary" onclick="switchCreateFlow('select')" style="max-width: 140px; min-height: 36px !important; font-size: 11px; margin-bottom: 20px;">${SVGS.ARROW_LEFT} Quay lại</button>
                <div class="p-card-head"><div><h2>Khởi tạo nhanh bằng Ảnh chụp hiện trường</h2><p>Chỉ tải lên hình ảnh hiện trạng, Garage sẽ đề xuất và làm rõ hạng mục tổn thất sau.</p></div><div class="section-number">02</div></div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 24px;">
                  <div class="form-group" style="margin:0;">
                    <label>Biển kiểm soát xe</label>
                    <div class="input-shell"><span class="field-prefix">${SVGS.CAR}</span><input id="txtPlateNumber" class="input-premium" type="text" placeholder="Ví dụ: 30H-123.45" autocomplete="off" /></div>
                  </div>
                  <div class="form-group" style="margin:0;">
                    <label>Garage sửa chữa phụ trách</label>
                    <div class="input-shell"><span class="field-prefix"></span><input id="txtGaragePartner" class="input-premium" type="text" placeholder="Tên đơn vị sửa chữa" autocomplete="off" /></div>
                  </div>
                </div>

                <div class="workflow-divider">Ảnh chụp hiện trạng tổn thất (Bắt buộc)</div>
                <div class="form-group">
                  <label>Ảnh chụp hiện trạng tổn thất thực tế</label>
                  <div class="dropzone" id="imageDropzone" onclick="document.getElementById('fileImageUploader').click()">
                    <div><div class="dropzone-icon">${SVGS.IMAGE}</div><strong>Chọn hoặc kéo thả ảnh hiện trường vào đây</strong><p>Garage sẽ tương tác trực tiếp, nhập tên bộ phận/phương án cho từng ảnh này</p></div>
                    <input id="fileImageUploader" type="file" accept="image/*" multiple hidden />
                  </div>
                  <div id="lblDropzoneSummary" class="file-summary">Chưa có ảnh nào được chọn.</div>
                  <div id="boxPreviewsHolder" class="preview-grid-premium"></div>
                </div>

                <div style="margin-top: 32px; max-width: 320px; margin-left: auto;">
                  <button id="btnCreateCaseSubmit" class="btn-premium" style="min-height: 52px; font-size: 13px;">${SVGS.SPARKLES} Khởi tạo hồ sơ trực tuyến</button>
                </div>
              </section>
            </div>
          `;
        } else if (activeCreateFlowMode === 'excel' || activeCreateFlowMode === 'standard' || activeCreateFlowMode === 'combined') {
          const isExcelMode = (activeCreateFlowMode === 'excel');
          const isCombinedMode = (activeCreateFlowMode === 'combined');
          const pageTitle = isCombinedMode ? 'Bổ sung hình ảnh theo hạng mục báo giá' : (isExcelMode ? 'Bổ sung hình ảnh theo hạng mục chỉ định' : 'Hồ sơ Giám định Tiêu chuẩn');
          const pageSubtitle = isCombinedMode ? 'Nhập danh sách hạng mục cần đối chiếu từ báo giá để Gara bổ sung ảnh.' : (isExcelMode ? 'Lập danh sách bằng bảng Excel thông minh hoặc trích xuất báo giá AI OCR.' : 'Mẫu khởi tạo tiêu chuẩn: Giấy tờ xe, Ảnh 4 góc chéo, Tem đăng kiểm và Số khung (VIN).');
          const sectionNum = isCombinedMode ? '05' : (isExcelMode ? '02' : '01');

          const ocrBlockMarkup = (isExcelMode || isCombinedMode) ? `
                <div class="form-group" style="margin-bottom: 24px;">
                  <div style="border-left: 4px solid var(--primary); padding-left: 12px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; box-sizing: border-box;">
                    <span style="display: inline-flex; align-items: center; gap: 8px;">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary);"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
                      <span style="font-size: 13.5px; font-weight: 850; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-main);">Định danh & Trích xuất dữ liệu Báo giá sửa chữa bằng AI OCR</span>
                    </span>
                  </div>

                  <!-- OCR Composer Card Container -->
                  <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px; box-shadow: var(--shadow-sm);">
                    
                    <!-- OCR Tabs: Image Scan vs Raw Text -->
                    <div style="display: flex; gap: 10px; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 12px; flex-wrap: wrap; align-items: center; justify-content: space-between;">
                      <div style="display: flex; gap: 8px;">
                        <button type="button" id="tabOcrImageBtn" onclick="switchOcrTab('image')" style="padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 800; border: 1px solid var(--primary); background: var(--primary-gradient); color: #080b11; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                          <span>Quét ảnh/PDF báo giá / Đơn hàng (AI OCR)</span>
                        </button>
                        <button type="button" id="tabOcrTextBtn" onclick="switchOcrTab('text')" style="padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 750; border: 1px solid var(--border); background: var(--surface); color: var(--text-soft); cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                          <span>Dán văn bản báo giá (PDF / Text)</span>
                        </button>
                      </div>
                      <span id="lblOcrKeyStatus" style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Gemini AI Engine</span>
                    </div>

                    <!-- Content Panel: Image Upload Scan -->
                    <div id="panelOcrImage" style="display: block;">
                      <div id="ocrDropzone" onclick="document.getElementById('fileOcrInput').click()" style="border: 2px dashed var(--border); border-radius: 12px; padding: 24px; text-align: center; cursor: pointer; background: var(--bg-soft); transition: all 0.2s ease;">
                        <input id="fileOcrInput" type="file" accept="image/*,application/pdf" onchange="handleOcrImageUpload(event)" hidden />
                        <div style="width: 44px; height: 44px; border-radius: 50%; background: rgba(216,180,109,0.12); color: var(--primary); display: grid; place-items: center; margin: 0 auto 12px auto;">
                          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        </div>
                        <strong style="font-size: 13.5px; color: var(--text-main); font-weight: 700;">Tải lên ảnh chụp hoặc file PDF báo giá của Gara</strong>
                        <p style="font-size: 12px; color: var(--text-muted); margin-top: 6px; max-width: 380px; line-height: 1.6; margin-left: auto; margin-right: auto;">Hệ thống AI sẽ tự động phân tích và trích xuất danh sách các hạng mục phụ tùng xe cơ giới.</p>
                      </div>

                      <!-- Scanning Preview & Animation -->
                      <div id="ocrScanningView" style="display: none; position: relative; border-radius: 10px; overflow: hidden; background: var(--surface); border: 1px solid var(--border); padding: 20px; text-align: center;">
                        <div style="position: relative; max-width: 260px; margin: 0 auto; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
                          <img id="ocrPreviewImg" style="width: 100%; height: auto; display: block; filter: brightness(0.65);" />
                          <!-- Laser sweep bar -->
                          <div id="ocrLaserSweep" style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--primary); box-shadow: 0 0 10px var(--primary), 0 0 20px var(--primary); animation: laserSweepAnim 2.2s infinite ease-in-out;"></div>
                        </div>
                        <div style="margin-top: 18px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                          <div class="spinner-premium" style="width:28px; height:28px; margin-bottom: 10px;"></div>
                          <strong style="font-size: 13.5px; color: var(--primary); display: block; font-weight: 750;">Đang quét dữ liệu báo giá bằng AI...</strong>
                          <span style="font-size: 12px; color: var(--text-muted); margin-top: 4px; display: block;">Áp dụng bộ lọc khử nhiễu & trích xuất hạng mục tiếng Việt...</span>
                        </div>
                      </div>
                    </div>

                    <!-- Content Panel: Text Copy-Paste -->
                    <div id="panelOcrText" style="display: none;">
                      <textarea id="txtOcrRawText" class="textarea-premium" placeholder="Ví dụ dán văn bản báo giá từ PDF/Excel:&#10;1. Thay mới cụm đèn pha bên trái: 4.500.000đ&#10;2. Sơn nắp ca pô hoàn chỉnh: 1.500.000đ&#10;3. Gò nắn phục hồi cản trước: 800.000đ" style="min-height: 120px; font-size: 12.5px; line-height: 1.6; padding: 12px; margin-bottom: 12px; font-family: inherit; width: 100%; box-sizing: border-box;"></textarea>
                      <button type="button" class="btn-premium" onclick="processTextToExtractItems()" style="width: auto !important; height: 38px; min-height: unset; padding: 0 20px; font-size: 12px; border-radius: 8px; background: var(--surface-soft); border: 1px solid var(--border); color: var(--text-main); font-weight: 750; cursor: pointer;">Trích xuất hạng mục</button>
                    </div>

                    <!-- Extracted Items Selection Area -->
                    <div id="ocrExtractedItemsContainer" style="display: none; margin-top: 20px; border-top: 1px dashed var(--border); padding-top: 18px;">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                        <strong style="font-size: 13px; color: var(--text-main); font-weight: 750;">Hạng mục trích xuất được (Chọn để yêu cầu ảnh):</strong>
                        <div style="display: flex; gap: 12px; align-items: center;">
                          <button type="button" onclick="selectAllOcrItems(true)" style="background:none; border:none; color:var(--text-soft); font-size:11.5px; font-weight:800; cursor:pointer; padding:0; display:inline-flex; align-items:center; gap:4px;">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                            <span>Chọn tất cả</span>
                          </button>
                          <span style="color: var(--border);">|</span>
                          <button type="button" onclick="selectAllOcrItems(false)" style="background:none; border:none; color:var(--text-soft); font-size:11.5px; font-weight:800; cursor:pointer; padding:0; display:inline-flex; align-items:center; gap:4px;">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                            <span>Bỏ chọn</span>
                          </button>
                          <span style="color: var(--border);">|</span>
                          <button type="button" onclick="toggleOcrPanelHeight()" style="background:none; border:none; color:var(--text-soft); font-size:11.5px; font-weight:800; cursor:pointer; padding:0; display:inline-flex; align-items:center; gap:4px;">
                            <svg id="btnOcrExpandIcon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path></svg>
                            <span id="btnOcrExpandText">Mở rộng</span>
                          </button>
                        </div>
                      </div>
                      <div id="ocrItemsChipsFlow" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; max-height: 300px; overflow-y: auto; padding: 6px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-soft);">
                        <!-- Chips will be generated here -->
                      </div>
                      <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; justify-content: flex-end;">
                        <button type="button" class="btn-premium btn-secondary" onclick="resetOcrScanPanel()" style="width: auto !important; height: 40px; min-height: unset; padding: 0 18px; font-size: 12.5px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-weight: 750;">
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-soft);"><path d="M23 4v6h-6M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                          <span>Hủy / Quét lại</span>
                        </button>
                        <button type="button" class="btn-premium" onclick="applySelectedOcrItemsToComposer()" style="width: auto !important; height: 40px; min-height: unset; padding: 0 24px; font-size: 12.5px; border-radius: 8px; background: var(--primary-gradient); color: #080b11; border: none; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          <span>Thêm vào danh sách yêu cầu ảnh</span>
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
          ` : '';

          container.innerHTML = `
            <div class="workspace-grid single-col">
              <section class="p-card create-panel">
                <button type="button" class="btn-premium btn-secondary" onclick="switchCreateFlow('select')" style="max-width: 140px; min-height: 36px !important; font-size: 11px; margin-bottom: 20px;">${SVGS.ARROW_LEFT} Quay lại</button>
                <div class="p-card-head"><div><h2>${pageTitle}</h2><p>${pageSubtitle}</p></div><div class="section-number">${sectionNum}</div></div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 24px;">
                  <div class="form-group" style="margin:0;">
                    <label>Biển kiểm soát xe</label>
                    <div class="input-shell"><span class="field-prefix">${SVGS.CAR}</span><input id="txtPlateNumber" class="input-premium" type="text" placeholder="Ví dụ: 30H-123.45" autocomplete="off" /></div>
                  </div>
                  <div class="form-group" style="margin:0;">
                    <label>Garage sửa chữa phụ trách</label>
                    <div class="input-shell"><span class="field-prefix"></span><input id="txtGaragePartner" class="input-premium" type="text" placeholder="Tên đơn vị sửa chữa" autocomplete="off" /></div>
                  </div>
                </div>

                ${ocrBlockMarkup}

                <div class="form-group">
                  <div style="border-left: 4px solid var(--primary); padding-left: 12px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; box-sizing: border-box;">
                    <span style="display: inline-flex; align-items: center; gap: 8px;">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary);"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                      <span style="font-size: 13.5px; font-weight: 850; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-main);">Hạng mục yêu cầu Garage chụp ảnh làm bằng chứng</span>
                    </span>
                  </div>
                  <div class="request-composer" style="padding: 14px;">
                    <div class="request-composer-help" style="margin-top: 0;">
                      <span>Nhập trực tiếp vào bảng. Có thể copy-paste nhiều dòng từ Excel.</span>
                      <strong id="lblRequestedItemsCount">00 hạng mục</strong>
                    </div>
                    <div id="requestedItemsBuilderList" class="requested-items-builder"></div>
                  </div>
                </div>



                <div style="margin-top: 32px; max-width: 320px; margin-left: auto;">
                  <button id="btnCreateCaseSubmit" class="btn-premium" style="min-height: 52px; font-size: 13px;">${SVGS.SPARKLES} Khởi tạo hồ sơ trực tuyến</button>
                </div>
              </section>
            </div>
          `;
          renderRequestedItemsBuilder();
        }

        const fileInput = document.getElementById('fileImageUploader');
        const dropzone = document.getElementById('imageDropzone');
        const submitBtn = document.getElementById('btnCreateCaseSubmit');

        if (fileInput) fileInput.addEventListener('change', executeImageFilesPreviewBinding);
        if (submitBtn) submitBtn.addEventListener('click', pipelineTriggerCaseCreationFlow);

        if (dropzone && fileInput) {
          ['dragenter','dragover'].forEach(eventName => dropzone.addEventListener(eventName, (event) => { event.preventDefault(); event.stopPropagation(); dropzone.classList.add('is-dragging'); }));
          ['dragleave','drop'].forEach(eventName => dropzone.addEventListener(eventName, (event) => { event.preventDefault(); event.stopPropagation(); dropzone.classList.remove('is-dragging'); }));
          dropzone.addEventListener('drop', (event) => {
            const imageFiles = Array.from(event.dataTransfer.files || []).filter(file => file.type.startsWith('image/'));
            if (!imageFiles.length) return triggerToast('Vui lòng thả đúng định dạng hình ảnh.', 'error');
            const transfer = new DataTransfer();
            imageFiles.forEach(file => transfer.items.add(file));
            fileInput.files = transfer.files;
            executeImageFilesPreviewBinding();
          });
        }
      }
    }
