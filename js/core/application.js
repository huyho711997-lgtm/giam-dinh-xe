
    
    function setAuditLogsPage(page) {
      auditLogsCurrentPage = page;
      renderAuditLogsTableList();
    }


    function setPendingClaimsPage(page) {
      pendingClaimsCurrentPage = page;
      executeUIRenderPendingClaims();
    }


    function setPendingClaimsPerPage(perPage) {
      pendingClaimsPerPage = parseInt(perPage, 10) || 10;
      pendingClaimsCurrentPage = 1;
      closeAllCustomDropdowns();
      executeUIRenderPendingClaims();
    }


    function initApplicationState() {
      // Áp dụng cấu hình giao diện ngay khi khởi chạy app
      if (currentTheme === 'light') {
        document.body.classList.add('light-mode');
      } else {
        document.body.classList.remove('light-mode');
      }

      if (typeof firebase === 'undefined' || !isSystemConfigHealthy()) {
        renderFatalConfigurationFailure();
        return;
      }

      try {
        if (!firebase.apps || !firebase.apps.length) {
          firebase.initializeApp(CONFIG.FIREBASE);
        }
        dbNodeInstance = firebase.database();
        if (dbNodeInstance) {
          dbNodeInstance.ref('system_config/kpi_config').on('value', (snapshot) => {
            let val = snapshot.val();
            const needsMigration = !val || 
              !Array.isArray(val) || 
              val.length !== 5 || 
              !val.find(r => r.id === 'vcx_4' && r.coef === 4.0) ||
              !val.find(r => r.id === 'tnds_1' && r.coef === 3.0);
              
            if (needsMigration) {
              dbNodeInstance.ref('system_config/kpi_config').set(defaultKpiCoefConfig);
              val = defaultKpiCoefConfig;
            }
            
            if (val) {
              localStorage.setItem('kpiCoefficientConfig', JSON.stringify(val));
              if (activeDashboardTab === 'users' && activeSystemAdminSubTab === 'kpi-config') {
                const subTabContainer = document.getElementById('systemAdminSubTabContainer');
                if (subTabContainer && typeof renderKpiConfigSubTabUI === 'function') {
                  renderKpiConfigSubTabUI(subTabContainer);
                }
              }
            }
          });
        }
      } catch (err) {
        console.error("Firebase init failed:", err);
      }

      if (!firebase.auth) {
        renderFatalConfigurationFailure();
        return;
      }

      firebase.auth().onAuthStateChanged(async (userInstance) => {
        try {
          if (userInstance) {
            activeUserProfile = await loadUserProfile(userInstance);
            
            // Auto-promote huyho71@gmail.com to permanent Admin role in database
            const isBootstrapAdmin = userInstance.email && String(userInstance.email).trim().toLowerCase() === 'huyho71@gmail.com';
            if (isBootstrapAdmin && activeUserProfile && activeUserProfile.role !== 'Admin' && dbNodeInstance) {
              activeUserProfile.role = 'Admin';
              activeUserProfile.department = 'Quản trị hệ thống';
              dbNodeInstance.ref(`users/${userInstance.uid}/profile`).update({
                role: 'Admin',
                department: 'Quản trị hệ thống',
                email: userInstance.email
              }).catch(() => {});
            }
            
            if (activeUserProfile && !activeUserProfile.email && userInstance.email && dbNodeInstance) {
              activeUserProfile.email = userInstance.email;
              dbNodeInstance.ref(`users/${userInstance.uid}/profile/email`).set(userInstance.email).catch(() => {});
            }
          } else {
            activeUserProfile = null;
          }
        } catch (e) {
          console.error("Auth state error:", e);
        }
        evaluateViewRoutingState(userInstance);
      });
    }


    // THAY ĐỔI THEME REALTIME: Thay đổi trực tiếp lớp CSS mà không reload / mất dữ liệu form
    function toggleTheme() {
      const isLight = document.body.classList.toggle('light-mode');
      currentTheme = isLight ? 'light' : 'dark';
      localStorage.setItem('claimvision-theme', currentTheme);
      
      // Đồng bộ hóa icon của mọi nút chuyển đổi đang hiển thị trên màn hình
      document.querySelectorAll('.theme-toggle-btn-node').forEach(btn => {
        btn.innerHTML = currentTheme === 'light' ? SVGS.MOON : SVGS.SUN;
      });
    }


    function evaluateViewRoutingState(userInstance) {
      const URLQueryStrings = new URLSearchParams(window.location.search);
      const caseIdToken = URLQueryStrings.get('idCa');
      const targetedViewArg = URLQueryStrings.get('view');
      const brandElement = document.getElementById('navBrandClick');
      const userActionSpace = document.getElementById('navUserActionSpace');
      const mainNavBarDOM = document.getElementById('mainNavigationBar');

      const isManagementRoute = !caseIdToken || targetedViewArg === 'result';
      const isUserAuthenticated = !!userInstance;

      if (dbNodeInstance) {
        dbNodeInstance.ref('cases').off();
        dbNodeInstance.ref('users').off();
        if (localActiveCaseNode && localActiveCaseNode.idCa) {
          dbNodeInstance.ref(`cases/${localActiveCaseNode.idCa}`).off();
        }
      }

      if (isManagementRoute && !isUserAuthenticated) {
        if (mainNavBarDOM) mainNavBarDOM.style.display = 'none';
        renderLoginView();
        return;
      }

      if (!isManagementRoute) {
        if (mainNavBarDOM) mainNavBarDOM.style.display = 'none';
      } else {
        if (mainNavBarDOM) mainNavBarDOM.style.display = 'flex';
      }

      if (isUserAuthenticated && isManagementRoute) {
        renderNavigationUserProfile(userInstance, userActionSpace);
        renderHeaderNavigationLinks();
      } else {
        if (userActionSpace) userActionSpace.innerHTML = '';
        removeHeaderNavigationLinks();
      }

      if (!caseIdToken) {
        if (brandElement) {
          brandElement.style.cursor = 'pointer';
          brandElement.onclick = goHome;
        }
        renderManagerDashboardWorkspace();
      } else {
        if (targetedViewArg !== 'result') {
          if (brandElement) {
            brandElement.style.cursor = 'default';
            brandElement.onclick = null;
          }
        } else {
          if (brandElement) {
            brandElement.style.cursor = 'pointer';
            brandElement.onclick = goHome;
          }
        }
        bindAndFetchCaseRealtimeSync(caseIdToken, targetedViewArg);
      }
    }


    function goHome() {
      activeDashboardTab = 'home';
      window.history.pushState({}, '', getCleanOriginBaseUrl());
      evaluateViewRoutingState(firebase.auth().currentUser);
    }


    function navigateToCase(caseIdToken, viewArg = null) {
      let url = `${getCleanOriginBaseUrl()}?idCa=${encodeURIComponent(caseIdToken)}`;
      if (viewArg) {
        url += `&view=${encodeURIComponent(viewArg)}`;
      }
      window.history.pushState({}, '', url);
      evaluateViewRoutingState(firebase.auth().currentUser);
    }
