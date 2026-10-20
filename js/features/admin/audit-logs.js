

    /****************************************************
     * SYSTEM AUDIT LOGGING & DEEP SETTINGS ENGINE
     ****************************************************/
    function logUserActivity(actionType, actionDetails, metadata = {}) {
      try {
        if (!dbNodeInstance) return;
        const currentUser = firebase.auth().currentUser;
        const uid = currentUser?.uid || 'guest';
        const email = currentUser?.email || activeUserProfile?.email || 'N/A';
        const name = activeUserProfile?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : 'Người dùng');
        const role = activeUserProfile?.role || 'Khách';

        const logId = 'LOG_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5).toUpperCase();
        const logEntry = {
          id: logId,
          timestamp: Date.now(),
          uid: uid,
          userEmail: email,
          userName: name,
          userRole: role,
          actionType: actionType,
          actionDetails: String(actionDetails || ''),
          metadata: metadata || {}
        };

        dbNodeInstance.ref(`auditLogs/${logId}`).set(logEntry).catch(() => {});
      } catch (e) {
        console.warn("Audit log writing failed:", e);
      }
    }


    function auditLogIcon(name) {
      const paths = {
        grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
        key: '<circle cx="7" cy="16" r="5"/><path d="m11 12 10-10m-5 5 3 3 3-3-3-3"/>',
        folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v6m-3-3h6"/>',
        garage: '<path d="m3 10 9-7 9 7v11H3zM7 21v-7h10v7M7 17h10"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
        shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        refresh: '<path d="M21 3v6h-6M3 21v-6h6"/><path d="M5.5 7a8 8 0 0 1 13.2-2L21 9M3 15l2.3 4A8 8 0 0 0 18.5 17"/>',
        search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
        edit: '<path d="m16 3 5 5-12 12-6 1 1-6zM14 5l5 5"/>',
        save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2z"/><path d="M7 3v6h10V3M7 21v-8h10v8"/>',
        check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
        activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
        left: '<path d="m15 18-6-6 6-6"/>',
        right: '<path d="m9 18 6-6-6-6"/>'
      };
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.activity}</svg>`;
    }


    function getAuditActionMeta(type) {
      const actions = {
        LOGIN: { label:'Đăng nhập', icon:'key', tone:'blue' },
        CREATE_CASE: { label:'Tạo hồ sơ', icon:'folder', tone:'green' },
        EDIT_CASE: { label:'Sửa hồ sơ', icon:'edit', tone:'gold' },
        GARAGE_SAVE_DRAFT: { label:'Garage lưu nháp', icon:'save', tone:'gold' },
        GARAGE_SUBMIT: { label:'Garage gửi kết quả', icon:'check', tone:'green' },
        USER_MANAGE: { label:'Quản lý tài khoản', icon:'user', tone:'gold' },
        SYSTEM_SETTING: { label:'Cấu hình hệ thống', icon:'shield', tone:'gold' }
      };
      return Object.prototype.hasOwnProperty.call(actions, type) ? actions[type] : { label:String(type || 'Hoạt động khác'), icon:'activity', tone:'neutral' };
    }


    function setAuditLogsLoading(loading) {
      const button = document.getElementById('auditLogRefreshButton');
      if (!button) return;
      button.disabled = loading;
      button.classList.toggle('is-loading', loading);
      button.setAttribute('aria-busy', String(loading));
      button.querySelector('span').textContent = loading ? 'Đang tải nhật ký…' : 'Tải lại nhật ký';
    }


    function fetchAndBindAuditLogsRealtime() {
      const tbody = document.getElementById('tblAuditLogsBodyContainer');
      if (!tbody || !dbNodeInstance) return;
      setAuditLogsLoading(true);
      dbNodeInstance.ref('auditLogs').off();
      dbNodeInstance.ref('auditLogs').limitToLast(150).on('value', snapshot => {
        cachedAuditLogsPayload = snapshot.val() || {};
        renderAuditLogsTableList();
        setAuditLogsLoading(false);
      }, error => {
        console.error('Audit Logs Sync Error:', error);
        setAuditLogsLoading(false);
        const currentBody = document.getElementById('tblAuditLogsBodyContainer');
        if (currentBody) currentBody.innerHTML = `<tr><td colspan="4"><div class="admin-audit-empty" role="alert"><div class="admin-audit-empty-icon">${auditLogIcon('refresh')}</div><strong>Không thể tải nhật ký hoạt động</strong><p>Vui lòng thử lại bằng nút Tải lại nhật ký.</p></div></td></tr>`;
        const footer = document.getElementById('auditLogsPagination');
        if (footer) footer.innerHTML = '';
      });
    }


    function setAuditLogsFilter(filterValue) {
      activeAuditLogsFilter = filterValue;
      auditLogsCurrentPage = 1;
      document.querySelectorAll('#auditLogActionPills .filter-pill').forEach(button => {
        const active = button.dataset.auditFilter === filterValue;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      renderAuditLogsTableList();
    }


    function renderAuditLogsTableList() {
      const tbody = document.getElementById('tblAuditLogsBodyContainer');
      if (!tbody) return;
      const searchQuery = removeVietnameseTones(String(document.getElementById('auditLogSearchInput')?.value || '').trim()).toLowerCase();
      const filterActions = {
        LOGIN:['LOGIN'], CREATE_CASE:['CREATE_CASE','EDIT_CASE'],
        GARAGE:['GARAGE_SAVE_DRAFT','GARAGE_SUBMIT'], USER_MANAGE:['USER_MANAGE'], SYSTEM_SETTING:['SYSTEM_SETTING']
      };
      const entries = Object.entries(cachedAuditLogsPayload || {}).filter(([, log]) => log && typeof log === 'object')
        .sort((a,b) => Number(b[1].timestamp || 0) - Number(a[1].timestamp || 0));
      const filteredEntries = entries.filter(([, log]) => {
        const meta = getAuditActionMeta(log.actionType);
        const text = removeVietnameseTones([log.userName,log.userEmail,log.userRole,log.actionType,meta.label,log.actionDetails].join(' ')).toLowerCase();
        return (!searchQuery || text.includes(searchQuery)) && (!filterActions[activeAuditLogsFilter] || filterActions[activeAuditLogsFilter].includes(log.actionType));
      });
      const footer = document.getElementById('auditLogsPagination');
      if (!filteredEntries.length) {
        auditLogsCurrentPage = 1;
        const filtered = searchQuery || activeAuditLogsFilter !== 'all';
        tbody.innerHTML = `<tr><td colspan="4"><div class="admin-audit-empty" role="status"><div class="admin-audit-empty-icon">${auditLogIcon(filtered ? 'search' : 'clock')}</div><strong>${filtered ? 'Không tìm thấy hoạt động phù hợp' : 'Chưa có nhật ký hoạt động'}</strong><p>${filtered ? 'Thử đổi từ khóa hoặc chọn một loại hoạt động khác.' : 'Các hoạt động mới sẽ hiển thị tại đây khi được ghi nhận.'}</p></div></td></tr>`;
        if (footer) footer.innerHTML = '<span class="admin-audit-result" role="status">Hiển thị 0 hoạt động</span>';
        return;
      }
      const totalPages = Math.ceil(filteredEntries.length / auditLogsPerPage);
      auditLogsCurrentPage = Math.min(totalPages, Math.max(1, auditLogsCurrentPage));
      const startIndex = (auditLogsCurrentPage - 1) * auditLogsPerPage;
      const pagedEntries = filteredEntries.slice(startIndex, startIndex + auditLogsPerPage);
      tbody.innerHTML = pagedEntries.map(([, log]) => {
        const validDate = log.timestamp && Number.isFinite(new Date(log.timestamp).getTime());
        const [date, time] = validDate ? formatAuditLogDate(log.timestamp).split(' ') : ['—',''];
        const name = String(log.userName || 'Người dùng').trim();
        const role = String(log.userRole || '').trim();
        const admin = role.toLowerCase() === 'admin';
        const meta = getAuditActionMeta(log.actionType);
        return `<tr>
          <td data-label="Thời gian"><div class="admin-audit-date"><strong>${escapeHtmlOutput(date)}</strong>${time ? `<span>${auditLogIcon('clock')}${escapeHtmlOutput(time)}</span>` : '<span>Chưa có thời gian</span>'}</div></td>
          <td data-label="Người thực hiện"><div class="admin-member admin-audit-member"><div class="admin-avatar ${admin ? 'admin-avatar--admin' : ''}">${escapeHtmlOutput(deriveInitials(name))}</div><div class="admin-member-info"><div class="admin-member-name">${escapeHtmlOutput(name)}</div>${log.userEmail ? `<div class="admin-audit-email">${escapeHtmlOutput(log.userEmail)}</div>` : ''}${role ? `<div class="admin-audit-role">${escapeHtmlOutput(role === 'Admin' ? 'Quản trị viên' : role)}</div>` : ''}</div></div></td>
          <td data-label="Hoạt động"><span class="admin-audit-badge admin-audit-badge--${meta.tone}">${auditLogIcon(meta.icon)}<span>${escapeHtmlOutput(meta.label)}</span></span></td>
          <td data-label="Nội dung"><div class="admin-audit-detail">${escapeHtmlOutput(log.actionDetails || 'Không có nội dung chi tiết.')}</div></td>
        </tr>`;
      }).join('');
      if (!footer) return;
      const endPage = Math.min(totalPages, Math.max(5, auditLogsCurrentPage + 2));
      const startPage = Math.max(1, endPage - 4);
      let pageButtons = '';
      for (let page = startPage; page <= endPage; page++) {
        const active = page === auditLogsCurrentPage;
        pageButtons += `<button type="button" class="admin-audit-page" ${active ? 'aria-current="page"' : ''} aria-label="Trang ${page}" onclick="setAuditLogsPage(${page})">${page}</button>`;
      }
      footer.innerHTML = `<span class="admin-audit-result" role="status" aria-live="polite">Hiển thị <strong>${startIndex + 1}–${Math.min(startIndex + auditLogsPerPage, filteredEntries.length)}</strong> / ${filteredEntries.length} hoạt động</span>
        <nav class="admin-audit-pagination" aria-label="Phân trang nhật ký"><button type="button" class="admin-audit-page" aria-label="Trang trước" onclick="setAuditLogsPage(${auditLogsCurrentPage - 1})" ${auditLogsCurrentPage === 1 ? 'disabled' : ''}>${auditLogIcon('left')}</button>${pageButtons}<button type="button" class="admin-audit-page" aria-label="Trang sau" onclick="setAuditLogsPage(${auditLogsCurrentPage + 1})" ${auditLogsCurrentPage === totalPages ? 'disabled' : ''}>${auditLogIcon('right')}</button></nav>`;
    }


    function formatAuditLogDate(timestamp) {
      try {
        const d = new Date(timestamp);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        const secs = String(d.getSeconds()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
      } catch (e) {
        return 'N/A';
      }
    }
