

    function getProfileStorageKey(uid) {
      return `claimvision.userProfile.${uid || 'anonymous'}`;
    }


    function deriveInitials(displayName) {
      return String(displayName || 'Giám định viên').split(/\s+/).filter(Boolean).slice(0,2).map(part => part.charAt(0)).join('').toUpperCase() || 'GD';
    }


    async function loadUserProfile(userInstance) {
      const isBootstrapAdmin = userInstance?.email && String(userInstance.email).trim().toLowerCase() === 'huyho71@gmail.com';
      const fallback = {
        displayName: String(userInstance?.displayName || '').trim(),
        role: isBootstrapAdmin ? 'Admin' : 'Giám định viên',
        department: isBootstrapAdmin ? 'Quản trị hệ thống' : 'Bộ phận Giám định'
      };
      try {
        const localValue = JSON.parse(localStorage.getItem(getProfileStorageKey(userInstance?.uid)) || 'null');
        if (localValue && typeof localValue === 'object') Object.assign(fallback, localValue);
      } catch (_) {}
      try {
        const snapshot = await dbNodeInstance.ref(`users/${userInstance.uid}/profile`).once('value');
        const cloudValue = snapshot.val();
        if (cloudValue && typeof cloudValue === 'object') Object.assign(fallback, cloudValue);
      } catch (error) {
        console.info('User profile cloud storage is unavailable; local profile remains active.', error?.code || error?.message || error);
      }
      fallback.isConfigured = Boolean(String(fallback.displayName || '').trim());
      if (!fallback.displayName) fallback.displayName = 'Giám định viên';
      return fallback;
    }


    function getAuthenticatedUserPresentation(userInstance) {
      const email = String(userInstance?.email || '').trim() || 'Tài khoản Firebase';
      const profile = activeUserProfile || {};
      const displayName = String(profile.displayName || userInstance?.displayName || 'Giám định viên').trim();
      const role = String(profile.role || 'Giám định viên').trim();
      const department = String(profile.department || 'Bộ phận Giám định').trim();
      const employeeId = String(profile.employeeId || '').trim();
      const phone = String(profile.phone ?? profile.phoneNumber ?? '').trim();
      return { displayName, email, role, department, phone,
          employeeId, initials: deriveInitials(displayName), isConfigured: Boolean(profile.isConfigured || userInstance?.displayName || (profile.displayName && profile.displayName !== 'Giám định viên')) };
    }
