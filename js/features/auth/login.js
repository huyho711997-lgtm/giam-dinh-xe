
    /****************************************************
     * 0. LUXURY LOGIN PORTAL VIEW (ULTRA CLEAN FOCUS)
     ****************************************************/
    function renderLoginView() {
      const activeThemeIcon = currentTheme === 'light' ? SVGS.MOON : SVGS.SUN;
      rootContainer.innerHTML = `
        <div class="login-wrapper">
          <section class="login-visual">
            <div class="login-brand">
              <div class="nav-logo" style="background: rgba(216,180,109,0.12); border: 1px solid rgba(216,180,109,0.3); border-radius: 12px; width: 42px; height: 42px; display: grid; place-items: center;">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" style="color: var(--primary);"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-5"/></svg>
              </div>
              <span>TASCO DLK</span>
            </div>
            <div class="login-copy">
              <div class="eyebrow">Hệ thống Giám định & Quản lý Bồi thường Xe Cơ Giới</div>
              <h1>Nhìn rõ tổn thất.<br><span>Chốt đúng hạng mục.</span></h1>
              <p>Một không gian tác nghiệp tập trung để Giám định viên và Garage đối chiếu ảnh hiện trạng, hạng mục sửa chữa và kết quả theo thời gian thực.</p>
            </div>
            <div class="login-footnote"><span>Firebase realtime</span><span>Cloudinary media</span><span>Secure access</span></div>
          </section>
          <section class="login-panel">
            <div style="position: absolute; top: 20px; right: 20px;">
              <button class="btn-premium btn-secondary nav-logout-icon theme-btn theme-toggle-btn-node" title="Chuyển đổi giao diện" onclick="toggleTheme()">${activeThemeIcon}</button>
            </div>
            <div class="login-card">
              <div class="login-icon-frame">${SVGS.LOCK}</div>
              <h2>Chào mừng trở lại</h2>
              <p>Đăng nhập tài khoản nghiệp vụ để truy cập trung tâm giám định.</p>
              <div class="form-group">
                <label>Email nghiệp vụ</label>
                <input id="txtEmailInput" class="input-premium" type="email" placeholder="name@company.com" autocomplete="username" />
              </div>
              <div class="form-group">
                <label>Mật khẩu xác thực</label>
                <input id="txtPasswordInput" class="input-premium" type="password" placeholder="••••••••" autocomplete="current-password" />
              </div>
              <button id="btnLoginSubmit" class="btn-premium">Đăng nhập an toàn</button>
              <div class="security-note">${SVGS.LOCK}<span>Phiên truy cập được xác thực trực tiếp qua Firebase Authentication.</span></div>
            </div>
          </section>
        </div>
      `;

      const emailField = document.getElementById('txtEmailInput');
      const passwordField = document.getElementById('txtPasswordInput');
      const submitBtn = document.getElementById('btnLoginSubmit');
      const executeFirebaseLoginAction = () => {
        const email = emailField.value.trim();
        const password = passwordField.value;
        if (!email || !password) {
          triggerToast('Vui lòng nhập đầy đủ email và mật khẩu.', 'error');
          return;
        }
        toggleButtonUIPendingState(submitBtn, true, 'Đang xác thực...');
        firebase.auth().signInWithEmailAndPassword(email, password)
          .then(() => {
            logUserActivity('LOGIN', `Đăng nhập hệ thống thành công (${email})`);
            triggerToast('Đăng nhập thành công.');
          })
          .catch((error) => {
            console.error(error);
            triggerToast('Email hoặc mật khẩu chưa chính xác.', 'error');
            toggleButtonUIPendingState(submitBtn, false, 'Đăng nhập an toàn');
            passwordField.value = '';
            passwordField.focus();
          });
      };
      submitBtn.addEventListener('click', executeFirebaseLoginAction);
      passwordField.addEventListener('keydown', (e) => { if (e.key === 'Enter') executeFirebaseLoginAction(); });
      emailField.focus();
    }


    function executeLogoutFlow() {
      firebase.auth().signOut().then(() => {
        triggerToast('Đã đóng phiên kết nối bảo mật.', 'warning');
      }).catch((err) => {
        triggerToast('Lỗi hệ thống: ' + err.message, 'error');
      });
    }
