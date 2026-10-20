

    function openUserProfileModal() {
      const user = firebase.auth().currentUser;
      if (!user) return;
      const profile = getAuthenticatedUserPresentation(user);
      document.getElementById('profileDisplayName').value = profile.isConfigured ? profile.displayName : '';
      document.getElementById('profileRole').value = profile.role;
      document.getElementById('profileDepartment').value = profile.department;
      document.getElementById('profilePhone').value = profile.phone;
      document.getElementById('profileEmailLocked').innerHTML = `${SVGS.LOCK}<span>${escapeHtmlOutput(profile.email)}</span>`;
      document.getElementById('profileModalAvatar').textContent = profile.initials;
      const overlay = document.getElementById('profileModalOverlay');
      overlay.style.display = 'grid';
      overlay.setAttribute('aria-hidden', 'false');
      setTimeout(() => document.getElementById('profileDisplayName')?.focus(), 40);
    }


    function closeUserProfileModal() {
      closeAdminSelect();
      const overlay = document.getElementById('profileModalOverlay');
      if (!overlay) return;
      overlay.style.display = 'none';
      overlay.setAttribute('aria-hidden', 'true');
    }


    async function saveUserProfile() {
      const user = firebase.auth().currentUser;
      if (!user) return triggerToast('Phiên đăng nhập không còn hợp lệ.', 'error');
      const displayName = String(document.getElementById('profileDisplayName')?.value || '').trim();
      const role = String(document.getElementById('profileRole')?.value || '').trim() || 'Giám định viên';
      const department = String(document.getElementById('profileDepartment')?.value || '').trim() || 'Bộ phận Giám định';
      const employeeId = activeUserProfile?.employeeId || '';
      const phone = readUserPhone('profilePhone');
      if (phone === null) return;
      if (displayName.length < 2) return triggerToast('Vui lòng nhập họ tên hiển thị hợp lệ.', 'error');
      const button = document.getElementById('btnSaveUserProfile');
      toggleButtonUIPendingState(button, true, 'Đang lưu...');
      const payload = { ...activeUserProfile, displayName, role, department, phone,
          employeeId, email: user.email || '', updatedAt: Date.now() };
      try {
        await user.updateProfile({ displayName });
        activeUserProfile = payload;
        try { localStorage.setItem(getProfileStorageKey(user.uid), JSON.stringify(payload)); } catch (storageError) { console.info('Local profile storage is unavailable.', storageError?.message || storageError); }
        try { await dbNodeInstance.ref(`users/${user.uid}/profile`).set(payload); } catch (cloudError) { console.info('Profile saved locally; cloud profile path is unavailable.', cloudError?.code || cloudError?.message || cloudError); }
        renderNavigationUserProfile(user, document.getElementById('navUserActionSpace'));
        renderHeaderNavigationLinks(); // Dynamically show/hide Admin user management tab
        const heroName = document.getElementById('heroUserName');
        const heroMeta = document.getElementById('heroUserMeta');
        const heroAvatar = document.getElementById('heroUserAvatar');
        if (heroName) heroName.textContent = displayName;
        if (heroMeta) heroMeta.textContent = `${role} · ${department}`;
        if (heroAvatar) heroAvatar.textContent = deriveInitials(displayName);
        closeUserProfileModal();
        triggerToast('Thông tin người dùng đã được cập nhật.');
      } catch (error) {
        console.error(error);
        triggerToast('Không thể cập nhật hồ sơ người dùng: ' + (error.message || 'Lỗi không xác định'), 'error');
      } finally {
        toggleButtonUIPendingState(button, false, 'Lưu hồ sơ');
      }
    }


    function openCreateUserModal() {
      const overlay = document.getElementById('createUserModalOverlay');
      if (!overlay) return;
      
      document.getElementById('newAdminDisplayName').value = '';
      document.getElementById('newAdminEmail').value = '';
      document.getElementById('newAdminPassword').value = '';
      document.getElementById('newAdminRole').value = 'Giám định viên';
      document.getElementById('newAdminDepartment').value = '';
      document.getElementById('newAdminPhone').value = '';
      document.getElementById('newAdminEmployeeId').value = '';
      setFormUserPermissions('new', null, 'Giám định viên');
      closeAdminSelect();
      syncAdminSelects(overlay);
      
      overlay.style.display = 'grid';
      overlay.setAttribute('aria-hidden', 'false');
      overlay.querySelector('.admin-member-body').scrollTop = 0;
      document.getElementById('newAdminDisplayName')?.focus({ preventScroll:true });
    }


    function closeCreateUserModal() {
      closeAdminSelect();
      const overlay = document.getElementById('createUserModalOverlay');
      if (!overlay) return;
      overlay.style.display = 'none';
      overlay.setAttribute('aria-hidden', 'true');
    }


    
    /* GRANULAR PERMISSIONS HELPER FUNCTIONS */
    function getFormUserPermissions(prefix) {
      return {
        list: {
          view: document.getElementById(prefix + 'Perm_list_view')?.checked || false,
          add: document.getElementById(prefix + 'Perm_list_add')?.checked || false,
          edit: document.getElementById(prefix + 'Perm_list_edit')?.checked || false,
          delete: document.getElementById(prefix + 'Perm_list_delete')?.checked || false
        },
        pending: {
          view: document.getElementById(prefix + 'Perm_pending_view')?.checked || false,
          add: document.getElementById(prefix + 'Perm_pending_add')?.checked || false,
          edit: document.getElementById(prefix + 'Perm_pending_edit')?.checked || false,
          delete: document.getElementById(prefix + 'Perm_pending_delete')?.checked || false
        },
        report: {
          view: document.getElementById(prefix + 'Perm_report_view')?.checked || false,
          export: document.getElementById(prefix + 'Perm_report_export')?.checked || false
        },
        accounting: {
          view: document.getElementById(prefix + 'Perm_accounting_view')?.checked || false,
          create: document.getElementById(prefix + 'Perm_accounting_create')?.checked || false,
          review: document.getElementById(prefix + 'Perm_accounting_review')?.checked || false,
          export: document.getElementById(prefix + 'Perm_accounting_export')?.checked || false
        },
        users: {
          view: document.getElementById(prefix + 'Perm_users_view')?.checked || false,
          admin: document.getElementById(prefix + 'Perm_users_admin')?.checked || false
        },
        field_reimb: {
          view: document.getElementById(prefix + 'Perm_field_reimb_view')?.checked || false,
          create: document.getElementById(prefix + 'Perm_field_reimb_create')?.checked || false,
          review: document.getElementById(prefix + 'Perm_field_reimb_review')?.checked || false
        }
      };
    }


    function setFormUserPermissions(prefix, permObj, roleVal) {
      const p = permObj || {};
      const r = (roleVal || '').toLowerCase();
      
      const isRoleAdmin = r === 'admin';
      const isRoleKeToan = r.includes('kế toán') || r.includes('ke toan') || r.includes('ketoan');

      const setCheck = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.checked = Boolean(val);
      };

      setCheck(prefix + 'Perm_list_view', p.list?.view ?? true);
      setCheck(prefix + 'Perm_list_add', p.list?.add ?? !isRoleKeToan);
      setCheck(prefix + 'Perm_list_edit', p.list?.edit ?? true);
      setCheck(prefix + 'Perm_list_delete', p.list?.delete ?? isRoleAdmin);

      setCheck(prefix + 'Perm_pending_view', p.pending?.view ?? true);
      setCheck(prefix + 'Perm_pending_add', p.pending?.add ?? !isRoleKeToan);
      setCheck(prefix + 'Perm_pending_edit', p.pending?.edit ?? true);
      setCheck(prefix + 'Perm_pending_delete', p.pending?.delete ?? isRoleAdmin);

      setCheck(prefix + 'Perm_report_view', p.report?.view ?? true);
      setCheck(prefix + 'Perm_report_export', p.report?.export ?? true);

      setCheck(prefix + 'Perm_accounting_view', p.accounting?.view ?? true);
      setCheck(prefix + 'Perm_accounting_create', p.accounting?.create ?? !isRoleKeToan);
      setCheck(prefix + 'Perm_accounting_review', p.accounting?.review ?? (isRoleKeToan || isRoleAdmin));
      setCheck(prefix + 'Perm_accounting_export', p.accounting?.export ?? (isRoleKeToan || isRoleAdmin));

      setCheck(prefix + 'Perm_users_view', p.users?.view ?? isRoleAdmin);
      setCheck(prefix + 'Perm_users_admin', p.users?.admin ?? isRoleAdmin);

      setCheck(prefix + 'Perm_field_reimb_view', p.field_reimb?.view ?? true);
      setCheck(prefix + 'Perm_field_reimb_create', p.field_reimb?.create ?? !isRoleKeToan);
      setCheck(prefix + 'Perm_field_reimb_review', p.field_reimb?.review ?? (isRoleKeToan || isRoleAdmin));
      refreshPermissionSummary(prefix);
    }


    function hasUserPermission(moduleKey, actionKey) {
      if (activeUserProfile && String(activeUserProfile.role || '').trim().toLowerCase() === 'admin') {
        return true;
      }
      if (!activeUserProfile || !activeUserProfile.permissions) {
        const role = String((activeUserProfile && activeUserProfile.role) || '').trim().toLowerCase();
        const isKeToan = role.includes('kế toán') || role.includes('ke toan') || role.includes('ketoan');
        
        if (moduleKey === 'users') return false;
        if (moduleKey === 'accounting' && actionKey === 'review') return isKeToan;
        if (moduleKey === 'accounting' && actionKey === 'export') return isKeToan;
        
        if (moduleKey === 'field_reimb') {
          if (actionKey === 'create') return !isKeToan;
          if (actionKey === 'review') return isKeToan;
        }
        return true;
      }
      
      const permObj = activeUserProfile.permissions;
      if (permObj[moduleKey] && permObj[moduleKey][actionKey] !== undefined) {
        return Boolean(permObj[moduleKey][actionKey]);
      }
      return false;
    }


    async function submitCreateUserAccount() {
      if (!hasUserPermission('users', 'admin')) {
        triggerToast('Bạn không có quyền tạo tài khoản thành viên.', 'error');
        return;
      }
      const displayName = String(document.getElementById('newAdminDisplayName')?.value || '').trim();
      const email = String(document.getElementById('newAdminEmail')?.value || '').trim();
      const password = String(document.getElementById('newAdminPassword')?.value || '').trim();
      const role = String(document.getElementById('newAdminRole')?.value || '').trim();
      const department = String(document.getElementById('newAdminDepartment')?.value || '').trim() || 'Bộ phận Giám định';
      const employeeId = String(document.getElementById('newAdminEmployeeId')?.value || '').trim();
      const phone = readUserPhone('newAdminPhone');
      if (phone === null) return;
      
      if (!displayName) return triggerToast('Vui lòng nhập họ và tên hiển thị.', 'warning');
      if (!email) return triggerToast('Vui lòng nhập email đăng nhập.', 'warning');
      if (password.length < 6) return triggerToast('Mật khẩu phải tối thiểu 6 ký tự.', 'warning');
      
      const button = document.getElementById('btnSubmitCreateUser');
      toggleButtonUIPendingState(button, true, 'Đang tạo...');
      
      let tempApp = null;
      try {
        const tempAppName = 'TempUserCreator_' + Date.now();
        tempApp = firebase.initializeApp(CONFIG.FIREBASE, tempAppName);
        
        const userCredential = await tempApp.auth().createUserWithEmailAndPassword(email, password);
        const newUid = userCredential.user.uid;
        
        await userCredential.user.updateProfile({ displayName });
        
        const permissions = getFormUserPermissions('new');
        const payload = {
          displayName,
          email,
          role,
          department,
          employeeId,
          phone,
          permissions,
          createdAt: Date.now()
        };
        
        await dbNodeInstance.ref(`users/${newUid}/profile`).set(payload);
        logUserActivity('USER_MANAGE', `Tạo tài khoản mới thành công: ${displayName} (${role} - ${department})`, { email, role });
        
        await tempApp.auth().signOut();
        
        triggerToast(`Đã tạo thành công tài khoản cho ${displayName}!`, 'success');
        closeCreateUserModal();
      } catch (error) {
        console.error('Error creating user:', error);
        triggerToast('Tạo tài khoản thất bại: ' + (error.message || error), 'error');
      } finally {
        toggleButtonUIPendingState(button, false, 'Tạo tài khoản');
        if (tempApp) {
          try {
            await tempApp.delete();
          } catch (deleteError) {
            console.error('Failed to delete temp app:', deleteError);
          }
        }
      }
    }


    function openEditUserModal(uid) {
      if (!hasUserPermission('users', 'admin')) {
        triggerToast('Bạn không có quyền chỉnh sửa thông tin thành viên.', 'warning');
        return;
      }
      const data = cachedUsersPayload[uid] || {};
      const profile = data.profile || {};
      
      document.getElementById('editAdminUid').value = uid;
      document.getElementById('editAdminDisplayName').value = profile.displayName || '';
      document.getElementById('editAdminEmail').value = profile.email || 'Chưa có email';
      document.getElementById('editAdminRole').value = profile.role || 'Giám định viên';
      document.getElementById('editAdminDepartment').value = profile.department || '';
      document.getElementById('editAdminEmployeeId').value = profile.employeeId || '';
      document.getElementById('editAdminPhone').value = profile.phone ?? profile.phoneNumber ?? '';
      setFormUserPermissions('edit', profile.permissions, profile.role);
      
      const overlay = document.getElementById('editUserModalOverlay');
      if (!overlay) return;
      closeAdminSelect();
      syncAdminSelects(overlay);
      overlay.style.display = 'grid';
      overlay.setAttribute('aria-hidden', 'false');
      overlay.querySelector('.admin-member-body').scrollTop = 0;
    }

    
    function closeEditUserModal() {
      closeAdminSelect();
      const overlay = document.getElementById('editUserModalOverlay');
      if (!overlay) return;
      overlay.style.display = 'none';
      overlay.setAttribute('aria-hidden', 'true');
    }


    async function submitEditUserAccount() {
      if (!hasUserPermission('users', 'admin')) {
        triggerToast('Bạn không có quyền chỉnh sửa thông tin thành viên.', 'error');
        return;
      }
      const uid = document.getElementById('editAdminUid').value;
      if (!uid) return;
      
      const displayName = String(document.getElementById('editAdminDisplayName')?.value || '').trim();
      const role = String(document.getElementById('editAdminRole')?.value || '').trim();
      const department = String(document.getElementById('editAdminDepartment')?.value || '').trim() || 'Bộ phận Giám định';
      const employeeId = String(document.getElementById('editAdminEmployeeId')?.value || '').trim();
      const phone = readUserPhone('editAdminPhone');
      if (phone === null) return;
      
      if (!displayName) return triggerToast('Vui lòng nhập họ và tên hiển thị.', 'warning');
      
      const button = document.getElementById('btnSubmitEditUser');
      toggleButtonUIPendingState(button, true, 'Đang lưu...');
      
      try {
        const currentProfile = (cachedUsersPayload[uid] && cachedUsersPayload[uid].profile) || {};
        const permissions = getFormUserPermissions('edit');
        const updatedProfile = {
          ...currentProfile,
          displayName,
          role,
          department,
          employeeId,
          phone,
          permissions,
          updatedAt: Date.now()
        };
        
        await dbNodeInstance.ref(`users/${uid}/profile`).set(updatedProfile);
        logUserActivity('USER_MANAGE', `Cập nhật thông tin tài khoản: ${displayName} (${role} - ${department})`, { uid, role });
        triggerToast('Đã lưu thay đổi thông tin người dùng thành công!', 'success');
        
        const currentUserId = firebase.auth().currentUser?.uid;
        if (uid === currentUserId) {
          activeUserProfile = updatedProfile;
          try { localStorage.setItem(getProfileStorageKey(uid), JSON.stringify(updatedProfile)); } catch(_) {}
          renderNavigationUserProfile(firebase.auth().currentUser, document.getElementById('navUserActionSpace'));
          renderHeaderNavigationLinks();
          
          const heroName = document.getElementById('heroUserName');
          const heroMeta = document.getElementById('heroUserMeta');
          const heroAvatar = document.getElementById('heroUserAvatar');
          if (heroName) heroName.textContent = displayName;
          if (heroMeta) heroMeta.textContent = `${role} · ${department}`;
          if (heroAvatar) heroAvatar.textContent = deriveInitials(displayName);
        }
        closeEditUserModal();
      } catch (error) {
        console.error('Failed to update user profile node:', error);
        triggerToast('Lỗi cập nhật thông tin: ' + (error.message || error), 'error');
      } finally {
        toggleButtonUIPendingState(button, false, 'Lưu thay đổi');
      }
    }


    async function triggerDeleteUserAccount(uid, displayName) {
      if (!hasUserPermission('users', 'admin')) {
        triggerToast('Bạn không có quyền xóa tài khoản thành viên.', 'error');
        return;
      }

      const confirmed = await showConfirmModal(
        'Xóa quyền truy cập', 
        `Bạn có chắc chắn muốn xóa quyền truy cập của người dùng "${displayName}" khỏi hệ thống không?`, 
        'Xóa tài khoản', 
        'Hủy'
      );
      if (confirmed) {
        try {
          await dbNodeInstance.ref(`users/${uid}`).remove();
          logUserActivity('USER_MANAGE', `Xóa quyền truy cập tài khoản: ${displayName}`, { uid });
          triggerToast(`Đã xóa thành viên ${displayName} khỏi cơ sở dữ liệu!`, 'success');
        } catch (e) {
          console.error(e);
          triggerToast('Không thể xóa người dùng: ' + e.message, 'error');
        }
      }
    }
