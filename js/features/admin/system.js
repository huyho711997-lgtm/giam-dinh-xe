

    /****************************************************
     * CLOUDINARY & GEMINI SYSTEM SETTINGS CORE
     ****************************************************/
    function getCloudinaryConfig() {
      const cloudName = localStorage.getItem('claimvision-cloudinary-cloud') || CONFIG.CLOUDINARY_CLOUD_NAME || 'ug4spdjp';
      const preset = localStorage.getItem('claimvision-cloudinary-preset') || CONFIG.CLOUDINARY_UPLOAD_PRESET || 'giam_dinh_xe_unsigned';
      const folder = localStorage.getItem('claimvision-cloudinary-folder') || CONFIG.CLOUDINARY_FOLDER || 'giam_dinh_xe';
      return { cloudName, preset, folder };
    }


    function saveCloudinarySettingsUI() {
      const cloudName = String(document.getElementById('txtCloudinaryCloudName')?.value || '').trim();
      const preset = String(document.getElementById('txtCloudinaryUploadPreset')?.value || '').trim();
      const folder = String(document.getElementById('txtCloudinaryFolder')?.value || '').trim();

      if (!cloudName || !preset) {
        triggerToast('Vui lòng nhập Cloud Name và Upload Preset!', 'warning');
        return;
      }

      localStorage.setItem('claimvision-cloudinary-cloud', cloudName);
      localStorage.setItem('claimvision-cloudinary-preset', preset);
      localStorage.setItem('claimvision-cloudinary-folder', folder);

      CONFIG.CLOUDINARY_CLOUD_NAME = cloudName;
      CONFIG.CLOUDINARY_UPLOAD_PRESET = preset;
      CONFIG.CLOUDINARY_FOLDER = folder;

      if (dbNodeInstance) {
        dbNodeInstance.ref('settings/cloudinary').set({
          cloudName,
          preset,
          folder,
          updatedAt: Date.now()
        }).catch(() => {});
      }

      logUserActivity('SYSTEM_SETTING', `Cập nhật cấu hình Cloudinary Media (Cloud Name: ${cloudName})`);
      triggerToast('Đã lưu cấu hình tài khoản Cloudinary thành công!', 'success');
      renderCloudinaryMetricsUI();
    }


    async function testCloudinaryConnectionUI() {
      const cloudName = String(document.getElementById('txtCloudinaryCloudName')?.value || getCloudinaryConfig().cloudName).trim();
      const preset = String(document.getElementById('txtCloudinaryUploadPreset')?.value || getCloudinaryConfig().preset).trim();

      if (!cloudName || !preset) {
        triggerToast('Vui lòng nhập Cloud Name và Upload Preset để thử nghiệm!', 'warning');
        return;
      }

      const statusEl = document.getElementById('cloudinaryConnStatus');
      if (statusEl) {
        statusEl.innerHTML = `<span style="color:var(--primary); font-weight:800; display:inline-flex; align-items:center; gap:4px;">${SVGS.REFRESH} Đang thử nghiệm kết nối tới Cloudinary (${cloudName})...</span>`;
      }

      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1; canvas.height = 1;
        const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.5));
        
        const formData = new FormData();
        formData.append('file', blob);
        formData.append('upload_preset', preset);

        const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
          method: 'POST',
          body: formData
        });
        
        const json = await res.json();
        if (res.ok && json.secure_url) {
          if (statusEl) {
            statusEl.innerHTML = `<span style="color:#10b981; font-weight:800; display:inline-flex; align-items:center; gap:4px;">${SVGS.DOT_GREEN} KẾT NỐI CLOUDINARY THÀNH CÔNG! Cloud: <strong>${cloudName}</strong>, Preset: <strong>${preset}</strong></span>`;
          }
          triggerToast('Kết nối tài khoản Cloudinary hoạt động hoàn hảo!', 'success');
        } else {
          throw new Error(json?.error?.message || 'Upload Preset không khả dụng');
        }
      } catch (err) {
        if (statusEl) {
          statusEl.innerHTML = `<span style="color:#ef4444; font-weight:800; display:inline-flex; align-items:center; gap:4px;">${SVGS.DOT_RED} LỖI KẾT NỐI CLOUDINARY: ${escapeHtmlOutput(err.message)}</span>`;
        }
        triggerToast('Lỗi kết nối Cloudinary: ' + err.message, 'error');
      }
    }


    function calculateCloudinaryMediaMetrics() {
      const allCases = Object.values(cachedCasesPayload || {});
      let totalImages = 0;

      allCases.forEach(caseNode => {
        if (caseNode.hinhAnh && Array.isArray(caseNode.hinhAnh)) {
          totalImages += caseNode.hinhAnh.length;
        } else if (caseNode.hinhAnh && typeof caseNode.hinhAnh === 'object') {
          totalImages += Object.keys(caseNode.hinhAnh).length;
        }

        const reqList = caseNode.hangMucYeuCauAnh ? (Array.isArray(caseNode.hangMucYeuCauAnh) ? caseNode.hangMucYeuCauAnh : Object.values(caseNode.hangMucYeuCauAnh)) : [];
        reqList.forEach(item => {
          const urls = normalizeEvidenceImageUrls(item);
          totalImages += urls.length;
        });
      });

      const avgSizeBytes = 1.25 * 1024 * 1024;
      const totalSizeBytes = totalImages * avgSizeBytes;
      const sizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(1);
      const sizeGB = (totalSizeBytes / (1024 * 1024 * 1024)).toFixed(2);
      const freeTierQuotaGB = 25.0;
      const percentUsed = Math.min(100, ((parseFloat(sizeGB) / freeTierQuotaGB) * 100)).toFixed(1);

      return {
        totalImages,
        sizeMB,
        sizeGB,
        freeTierQuotaGB,
        percentUsed
      };
    }


    function renderCloudinaryMetricsUI() {
      const metrics = calculateCloudinaryMediaMetrics();
      const filesLbl = document.getElementById('lblCloudinaryTotalFiles');
      const sizeLbl = document.getElementById('lblCloudinaryUsedSize');
      const fractionLbl = document.getElementById('lblCloudinaryQuotaFraction');
      const percentLbl = document.getElementById('lblCloudinaryQuotaPercent');
      const fillBar = document.getElementById('cloudinaryQuotaProgressFill');

      if (filesLbl) filesLbl.textContent = metrics.totalImages;
      if (sizeLbl) sizeLbl.textContent = `${metrics.sizeMB} MB`;
      if (fractionLbl) fractionLbl.textContent = `${metrics.sizeGB} / ${metrics.freeTierQuotaGB}.00 GB`;
      if (percentLbl) percentLbl.textContent = `${metrics.percentUsed}%`;
      if (fillBar) fillBar.style.width = `${metrics.percentUsed}%`;

      const cConfig = getCloudinaryConfig();
      const cCloudInput = document.getElementById('txtCloudinaryCloudName');
      const cPresetInput = document.getElementById('txtCloudinaryUploadPreset');
      const cFolderInput = document.getElementById('txtCloudinaryFolder');

      if (cCloudInput) cCloudInput.value = cConfig.cloudName;
      if (cPresetInput) cPresetInput.value = cConfig.preset;
      if (cFolderInput) cFolderInput.value = cConfig.folder;
    }


    function saveSystemGeminiApiKeyUI() {
      const val = String(document.getElementById('txtSystemGeminiApiKey')?.value || '').trim();
      if (val) {
        localStorage.setItem('claimvision-gemini-key', val);
        if (dbNodeInstance) dbNodeInstance.ref('settings/geminiApiKey').set(val).catch(() => {});
        logUserActivity('SYSTEM_SETTING', 'Cập nhật Google Gemini API Key');
        triggerToast('Đã lưu cấu hình Gemini API Key hệ thống thành công!', 'success');
      } else {
        localStorage.removeItem('claimvision-gemini-key');
        if (dbNodeInstance) dbNodeInstance.ref('settings/geminiApiKey').remove().catch(() => {});
        triggerToast('Đã xóa Gemini API Key riêng, dùng Key mặc định.', 'info');
      }
    }


    async function testGeminiApiKeyConnectionUI() {
      const val = String(document.getElementById('txtSystemGeminiApiKey')?.value || localStorage.getItem('claimvision-gemini-key') || CONFIG.FIREBASE.apiKey).trim();
      const statusEl = document.getElementById('geminiConnStatus');

      if (!val) {
        triggerToast('Chưa nhập Gemini API Key!', 'warning');
        return;
      }

      if (statusEl) {
        statusEl.innerHTML = `<span style="color:var(--primary); font-weight:800; display:inline-flex; align-items:center; gap:4px;">${SVGS.REFRESH} Đang kiểm tra kết nối tới Google Gemini API...</span>`;
      }

      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${val}`);
        const data = await res.json();

        if (res.ok && data.models) {
          if (statusEl) {
            statusEl.innerHTML = `<span style="color:#10b981; font-weight:800; display:inline-flex; align-items:center; gap:4px;">${SVGS.DOT_GREEN} GEMINI API KEY KẾT NỐI THÀNH CÔNG! Nhận diện ${data.models.length} AI Models khả dụng.</span>`;
          }
          triggerToast('Kết nối Gemini API Key hoạt động tốt!', 'success');
        } else {
          throw new Error(data?.error?.message || 'API Key không hợp lệ');
        }
      } catch (err) {
        if (statusEl) {
          statusEl.innerHTML = `<span style="color:#ef4444; font-weight:800; display:inline-flex; align-items:center; gap:4px;">${SVGS.DOT_RED} GEMINI API KEY LỖI: ${escapeHtmlOutput(err.message)}</span>`;
        }
        triggerToast('Lỗi kết nối Gemini API Key: ' + err.message, 'error');
      }
    }


    function resetSystemGeminiApiKeyUI() {
      localStorage.removeItem('claimvision-gemini-key');
      const input = document.getElementById('txtSystemGeminiApiKey');
      if (input) input.value = '';
      const statusEl = document.getElementById('geminiConnStatus');
      if (statusEl) statusEl.innerHTML = `<span style="color:var(--text-muted);">Đã đặt lại sử dụng Gemini API Key mặc định của hệ thống.</span>`;
      triggerToast('Đã đặt lại Key mặc định hệ thống.', 'info');
    }


    function toggleShowGeminiKeyVisibility() {
      const input = document.getElementById('txtSystemGeminiApiKey');
      if (!input) return;
      input.type = (input.type === 'password') ? 'text' : 'password';
    }


    function switchSystemAdminSubTab(subTabName) {
      if (['api-keys', 'cloudinary', 'kpi-config'].includes(subTabName) && !hasUserPermission('users', 'admin')) {
        subTabName = 'users';
      }
      activeSystemAdminSubTab = subTabName;
      if (typeof renderHeaderNavigationLinks === 'function') renderHeaderNavigationLinks(); // cập nhật đường dẫn trên thanh trên
      
      // Update visual active state of subtab pills dynamically
      document.querySelectorAll('button[onclick^="switchSystemAdminSubTab"]').forEach(btn => {
        const onclickAttr = btn.getAttribute('onclick') || '';
        const isCurrent = onclickAttr.includes(subTabName);
        btn.classList.toggle('active', isCurrent);
        btn.setAttribute('aria-pressed', String(isCurrent));
      });

      renderSystemAdminTabContent();
    }


    function renderSystemAdminTabContent() {
      const container = document.getElementById('systemAdminSubTabContainer');
      if (!container) return;

      if (activeSystemAdminSubTab === 'users') {
        container.innerHTML = `
          <div class="admin-stat-grid" aria-label="Tổng quan thành viên">
            <article class="claims-metric-card claims-metric-card--gold" aria-label="Tổng thành viên">
            <div class="claims-metric-head"><span class="claims-metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg></span><span class="claims-metric-label">Tổng thành viên</span></div>
            <div class="claims-metric-value-row"><strong class="claims-metric-value" id="userStatTotal">—</strong><span class="claims-metric-unit">thành viên</span></div>
            <div class="claims-metric-foot"><span>Toàn bộ hệ thống</span><strong id="userStatShareTotal">—</strong></div>
            <div class="claims-metric-track" aria-hidden="true"><i id="userStatProgressTotal" style="--metric-progress:0%"></i></div>
          </article>
<article class="claims-metric-card claims-metric-card--gold" aria-label="Quản trị viên">
            <div class="claims-metric-head"><span class="claims-metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-5"/></svg></span><span class="claims-metric-label">Quản trị viên</span></div>
            <div class="claims-metric-value-row"><strong class="claims-metric-value" id="userStatAdmins">—</strong><span class="claims-metric-unit">thành viên</span></div>
            <div class="claims-metric-foot"><span>Trong tổng thành viên</span><strong id="userStatShareAdmins">—</strong></div>
            <div class="claims-metric-track" aria-hidden="true"><i id="userStatProgressAdmins" style="--metric-progress:0%"></i></div>
          </article>
<article class="claims-metric-card claims-metric-card--blue" aria-label="Giám định viên">
            <div class="claims-metric-head"><span class="claims-metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6m-14-11 2 2 4-4"/></svg></span><span class="claims-metric-label">Giám định viên</span></div>
            <div class="claims-metric-value-row"><strong class="claims-metric-value" id="userStatInspectors">—</strong><span class="claims-metric-unit">thành viên</span></div>
            <div class="claims-metric-foot"><span>Trong tổng thành viên</span><strong id="userStatShareInspectors">—</strong></div>
            <div class="claims-metric-track" aria-hidden="true"><i id="userStatProgressInspectors" style="--metric-progress:0%"></i></div>
          </article>
<article class="claims-metric-card claims-metric-card--gold" aria-label="Kế toán">
            <div class="claims-metric-head"><span class="claims-metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="3"/><path d="M8 6h8M8 10h2m4 0h2m-8 4h2m4 0h2m-8 4h2m4 0h2"/></svg></span><span class="claims-metric-label">Kế toán</span></div>
            <div class="claims-metric-value-row"><strong class="claims-metric-value" id="userStatAccountants">—</strong><span class="claims-metric-unit">thành viên</span></div>
            <div class="claims-metric-foot"><span>Trong tổng thành viên</span><strong id="userStatShareAccountants">—</strong></div>
            <div class="claims-metric-track" aria-hidden="true"><i id="userStatProgressAccountants" style="--metric-progress:0%"></i></div>
          </article>
<article class="claims-metric-card claims-metric-card--green" aria-label="Garage">
            <div class="claims-metric-head"><span class="claims-metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7v11H3zM7 21v-7h10v7M7 17h10"/></svg></span><span class="claims-metric-label">Garage</span></div>
            <div class="claims-metric-value-row"><strong class="claims-metric-value" id="userStatGarages">—</strong><span class="claims-metric-unit">thành viên</span></div>
            <div class="claims-metric-foot"><span>Trong tổng thành viên</span><strong id="userStatShareGarages">—</strong></div>
            <div class="claims-metric-track" aria-hidden="true"><i id="userStatProgressGarages" style="--metric-progress:0%"></i></div>
          </article>
          </div>
          <div class="admin-user-toolbar">
            <div class="search-wrap">${SVGS.SEARCH}<input id="userSearchInput" class="input-premium" type="search" aria-label="Tìm thành viên" placeholder="Tìm tên, email, số điện thoại, mã nhân viên…" autocomplete="off" /></div>
            <select id="adminUserRoleFilter" class="input-premium" aria-label="Lọc theo vai trò" onchange="setUserFilter(this.value)">
              <option value="all">Tất cả vai trò</option><option value="Admin">Quản trị viên</option><option value="Giám định viên">Giám định viên</option><option value="Kế toán">Kế toán</option><option value="Garage">Garage</option>
            </select>
            ${hasUserPermission('users', 'admin') ? `<button type="button" class="admin-button" onclick="openCreateUserModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Thêm thành viên</span></button>` : ''}
          </div>
          <div class="admin-table-shell">
            <table class="p-table users-table">
              <colgroup><col style="width:25%"><col style="width:27%"><col style="width:18%"><col style="width:15%"><col style="width:15%"></colgroup>
              <thead><tr><th scope="col">Thành viên</th><th scope="col">Thông tin liên hệ</th><th scope="col">Bộ phận / Phòng ban</th><th scope="col">Vai trò hệ thống</th><th scope="col" style="text-align:right">Thao tác</th></tr></thead>
              <tbody id="tblUsersBodyContainer"><tr><td colspan="5" class="empty-state-text">Đang đồng bộ danh sách thành viên…</td></tr></tbody>
            </table>
          </div>
          <div class="admin-table-foot"><span id="adminUsersResultCount" role="status" aria-live="polite">Đang tải danh sách…</span><span>Thông tin liên hệ & phân quyền thành viên</span></div>
        `;
        document.getElementById('adminUserRoleFilter').value = activeUserFilter;
        document.getElementById('userSearchInput')?.addEventListener('input', debouncedRenderUsersTableList);
        syncAdminSelects(container);
        fetchAndBindUsersListRealtime();
      } else if (activeSystemAdminSubTab === 'api-keys') {
        container.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 20px;">
            <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px; box-shadow: var(--shadow-sm);">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <div style="width: 42px; height: 42px; border-radius: 12px; background: rgba(216,180,109,0.12); color: var(--primary); display: grid; place-items: center; border: 1px solid rgba(216,180,109,0.3); font-weight: 800; font-size: 18px;">${SVGS.KEY}</div>
                <div>
                  <h3 style="font-size: 17px; font-weight: 850; color: var(--text-main); margin: 0;">Quản lý Google Gemini AI API Key</h3>
                  <p style="font-size: 12.5px; color: var(--text-muted); margin-top: 3px; margin-bottom: 0;">Cấu hình khóa API Gemini phục vụ tính năng tự động trích xuất văn bản báo giá qua AI OCR, phân tích tổn thất va chạm và hỗ trợ nghiệp vụ.</p>
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 16px;">
                <label style="font-size: 11px; font-weight: 800; color: var(--text-soft);">Gemini API Key (System Global / Key Cá Nhân)</label>
                <div style="position: relative; display: flex; align-items: center; gap: 8px;">
                  <input id="txtSystemGeminiApiKey" type="password" class="input-premium" placeholder="Nhập API Key: AIzaSy..." style=" font-size: 13px; letter-spacing: 0.05em; padding-right: 45px;" />
                  <button type="button" onclick="toggleShowGeminiKeyVisibility()" style="position: absolute; right: 12px; background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px;" title="Hiện/Ẩn Key">
                    ${SVGS.EYE}
                  </button>
                </div>
              </div>

              <div id="geminiConnStatus" style="margin-bottom: 18px; padding: 12px 14px; border-radius: 10px; background: var(--bg-soft); border: 1px solid var(--border); font-size: 12px;">
                <span style="color: var(--text-muted);">Nhấn nút <strong>"Kiểm tra kết nối"</strong> bên dưới để xác thực trực tiếp với máy chủ Google Gemini API.</span>
              </div>

              <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button type="button" class="btn-premium" onclick="saveSystemGeminiApiKeyUI()" style="width: auto !important; padding: 0 20px; height: 42px; font-size: 12.5px; border-radius: 10px; display: inline-flex; align-items: center; gap: 6px;">
                  ${SVGS.SAVE} <span>Lưu cấu hình API Key</span>
                </button>
                <button type="button" class="btn-premium btn-secondary" onclick="testGeminiApiKeyConnectionUI()" style="width: auto !important; padding: 0 20px; height: 42px; font-size: 12.5px; border-radius: 10px; display: inline-flex; align-items: center; gap: 6px;">
                  ${SVGS.TEST_TUBE} <span>Kiểm tra kết nối Gemini API</span>
                </button>
                <button type="button" class="btn-premium btn-secondary danger" onclick="resetSystemGeminiApiKeyUI()" style="width: auto !important; padding: 0 16px; height: 42px; font-size: 12px; border-radius: 10px; border-color: var(--btn-danger-border); color: var(--btn-danger-text); display: inline-flex; align-items: center; gap: 6px;">
                  ${SVGS.REFRESH} <span>Đặt lại Key mặc định</span>
                </button>
              </div>
            </div>
          </div>
        `;
        const keyInput = document.getElementById('txtSystemGeminiApiKey');
        if (keyInput) keyInput.value = localStorage.getItem('claimvision-gemini-key') || '';
      } else if (activeSystemAdminSubTab === 'cloudinary') {
        container.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 20px;">
            <!-- Analytics Cards Row -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
              <div class="stat-box" style="padding: 20px; border-radius: 16px; background: var(--surface);">
                <div class="stat-info">
                  <div class="stat-lbl">TỔNG TỆP MEDIA TRÊN CLOUD</div>
                  <div class="stat-val" id="lblCloudinaryTotalFiles" style="color: var(--primary);  font-size: 30px; font-weight: 850;">0</div>
                  <div class="stat-note">Tệp ảnh hiện trạng & ảnh minh chứng Gara</div>
                </div>
                <div class="stat-icon-wrap" style="color:var(--primary); font-size: 22px;">${SVGS.CAMERA}</div>
              </div>

              <div class="stat-box" style="padding: 20px; border-radius: 16px; background: var(--surface);">
                <div class="stat-info">
                  <div class="stat-lbl">DUNG LƯỢNG LƯU TRỮ ƯỚC TÍNH</div>
                  <div class="stat-val" id="lblCloudinaryUsedSize" style="color: #10b981;  font-size: 30px; font-weight: 850;">0.0 MB</div>
                  <div class="stat-note">Trung bình ~1.25 MB / ảnh độ phân giải cao</div>
                </div>
                <div class="stat-icon-wrap" style="color:#10b981; font-size: 22px;">${SVGS.SAVE}</div>
              </div>

              <div class="stat-box" style="padding: 20px; border-radius: 16px; background: var(--surface);">
                <div class="stat-info" style="width: 100%;">
                  <div class="stat-lbl">HẠN MỨC TÀI KHOẢN (FREE TIER 25GB)</div>
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px;">
                    <div class="stat-val" id="lblCloudinaryQuotaPercent" style="color: var(--text-main);  font-size: 24px; font-weight: 850;">0%</div>
                    <span id="lblCloudinaryQuotaFraction" style="font-size: 11px;  color: var(--text-muted);">0.00 / 25.00 GB</span>
                  </div>
                  <div style="margin-top: 10px; height: 7px; border-radius: 99px; background: var(--bg-soft); overflow: hidden; border: 1px solid var(--border);">
                    <div id="cloudinaryQuotaProgressFill" style="height: 100%; width: 0%; border-radius: inherit; background: linear-gradient(90deg, #10b981 0%, #d8b46d 70%, #ef4444 100%); transition: width 0.5s ease;"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Settings Input Box -->
            <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px; box-shadow: var(--shadow-sm);">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                <div style="width: 42px; height: 42px; border-radius: 12px; background: rgba(59,130,246,0.12); color: #3b82f6; display: grid; place-items: center; border: 1px solid rgba(59,130,246,0.3); font-weight: 800; font-size: 18px;">${SVGS.CLOUD}</div>
                <div>
                  <h3 style="font-size: 17px; font-weight: 850; color: var(--text-main); margin: 0;">Quản lý Cấu hình Tài khoản Cloudinary Media Engine</h3>
                  <p style="font-size: 12.5px; color: var(--text-muted); margin-top: 3px; margin-bottom: 0;">Thiết lập thông tin tài khoản Cloudinary để lưu trữ ảnh chụp hiện trạng va chạm và ảnh minh chứng từ Garage.</p>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 16px;">
                <div class="form-group" style="margin: 0;">
                  <label style="font-size: 11px; font-weight: 800; color: var(--text-soft);">Cloud Name *</label>
                  <input id="txtCloudinaryCloudName" type="text" class="input-premium" placeholder="Ví dụ: ug4spdjp" style="" />
                </div>

                <div class="form-group" style="margin: 0;">
                  <label style="font-size: 11px; font-weight: 800; color: var(--text-soft);">Upload Preset (Unsigned) *</label>
                  <input id="txtCloudinaryUploadPreset" type="text" class="input-premium" placeholder="Ví dụ: giam_dinh_xe_unsigned" style="" />
                </div>

                <div class="form-group" style="margin: 0;">
                  <label style="font-size: 11px; font-weight: 800; color: var(--text-soft);">Thư mục lưu trữ (Folder)</label>
                  <input id="txtCloudinaryFolder" type="text" class="input-premium" placeholder="Ví dụ: giam_dinh_xe" style="" />
                </div>
              </div>

              <div id="cloudinaryConnStatus" style="margin-bottom: 18px; padding: 12px 14px; border-radius: 10px; background: var(--bg-soft); border: 1px solid var(--border); font-size: 12px;">
                <span style="color: var(--text-muted);">Nhấn nút <strong>"Kiểm tra kết nối"</strong> để thử nghiệm tải tệp mẫu lên Cloudinary API.</span>
              </div>

              <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button type="button" class="btn-premium" onclick="saveCloudinarySettingsUI()" style="width: auto !important; padding: 0 20px; height: 42px; font-size: 12.5px; border-radius: 10px; display: inline-flex; align-items: center; gap: 6px;">
                  ${SVGS.SAVE} <span>Lưu cấu hình Cloudinary</span>
                </button>
                <button type="button" class="btn-premium btn-secondary" onclick="testCloudinaryConnectionUI()" style="width: auto !important; padding: 0 20px; height: 42px; font-size: 12.5px; border-radius: 10px; display: inline-flex; align-items: center; gap: 6px;">
                  ${SVGS.TEST_TUBE} <span>Kiểm tra kết nối Cloudinary</span>
                </button>
              </div>
            </div>
          </div>
        `;
        renderCloudinaryMetricsUI();
      } else if (activeSystemAdminSubTab === 'audit-logs') {
        container.innerHTML = `
          <section class="admin-audit-panel" aria-labelledby="adminAuditTitle">
            <div class="admin-audit-header">
              <div class="admin-audit-heading">
                <div class="admin-audit-heading-icon">${auditLogIcon('clock')}</div>
                <div><h3 id="adminAuditTitle">Nhật ký hoạt động</h3>
                  <p>Theo dõi lịch sử đăng nhập, cập nhật hồ sơ, tài khoản và cấu hình hệ thống.</p>
                </div>
              </div>
              <button id="auditLogRefreshButton" type="button" class="admin-button admin-button--secondary admin-audit-refresh" onclick="fetchAndBindAuditLogsRealtime()">${auditLogIcon('refresh')}<span>Tải lại nhật ký</span></button>
            </div>
            <div class="admin-audit-toolbar">
              <div class="search-wrap">${auditLogIcon('search')}<input id="auditLogSearchInput" class="input-premium" type="search" aria-label="Tìm nhật ký hoạt động" placeholder="Tìm tên, email, hành động hoặc biển số xe…" autocomplete="off" oninput="auditLogsCurrentPage = 1; debouncedRenderAuditLogsTableList()" /></div>
              <div class="filter-pills admin-audit-filters" id="auditLogActionPills" role="group" aria-label="Lọc nhật ký theo loại hoạt động"><button type="button" class="filter-pill ${activeAuditLogsFilter === 'all' ? 'active' : ''}" data-audit-filter="all" aria-pressed="${activeAuditLogsFilter === 'all'}" onclick="setAuditLogsFilter('all')">${auditLogIcon('grid')}<span>Tất cả</span></button>
<button type="button" class="filter-pill ${activeAuditLogsFilter === 'LOGIN' ? 'active' : ''}" data-audit-filter="LOGIN" aria-pressed="${activeAuditLogsFilter === 'LOGIN'}" onclick="setAuditLogsFilter('LOGIN')">${auditLogIcon('key')}<span>Đăng nhập</span></button>
<button type="button" class="filter-pill ${activeAuditLogsFilter === 'CREATE_CASE' ? 'active' : ''}" data-audit-filter="CREATE_CASE" aria-pressed="${activeAuditLogsFilter === 'CREATE_CASE'}" onclick="setAuditLogsFilter('CREATE_CASE')">${auditLogIcon('folder')}<span>Hồ sơ</span></button>
<button type="button" class="filter-pill ${activeAuditLogsFilter === 'GARAGE' ? 'active' : ''}" data-audit-filter="GARAGE" aria-pressed="${activeAuditLogsFilter === 'GARAGE'}" onclick="setAuditLogsFilter('GARAGE')">${auditLogIcon('garage')}<span>Garage</span></button>
<button type="button" class="filter-pill ${activeAuditLogsFilter === 'USER_MANAGE' ? 'active' : ''}" data-audit-filter="USER_MANAGE" aria-pressed="${activeAuditLogsFilter === 'USER_MANAGE'}" onclick="setAuditLogsFilter('USER_MANAGE')">${auditLogIcon('user')}<span>Tài khoản</span></button>
<button type="button" class="filter-pill ${activeAuditLogsFilter === 'SYSTEM_SETTING' ? 'active' : ''}" data-audit-filter="SYSTEM_SETTING" aria-pressed="${activeAuditLogsFilter === 'SYSTEM_SETTING'}" onclick="setAuditLogsFilter('SYSTEM_SETTING')">${auditLogIcon('shield')}<span>Hệ thống</span></button></div>
            </div>
            <div class="admin-audit-table-shell">
              <table class="p-table audit-logs-table admin-audit-table" aria-label="Lịch sử hoạt động hệ thống">
                <colgroup><col style="width:14%"><col style="width:26%"><col style="width:18%"><col style="width:42%"></colgroup>
                <thead><tr><th scope="col">Thời gian</th><th scope="col">Người thực hiện</th><th scope="col">Hoạt động</th><th scope="col">Nội dung chi tiết</th></tr></thead>
                <tbody id="tblAuditLogsBodyContainer"><tr><td colspan="4"><div class="admin-audit-empty" role="status"><div class="admin-audit-empty-icon">${auditLogIcon('clock')}</div><strong>Đang tải nhật ký hoạt động…</strong><p>Dữ liệu sẽ hiển thị sau khi đồng bộ.</p></div></td></tr></tbody>
              </table>
            </div>
            <div id="auditLogsPagination" class="admin-audit-footer"></div>
          </section>
        `;
        fetchAndBindAuditLogsRealtime();
      } else if (activeSystemAdminSubTab === 'kpi-config') {
        renderKpiConfigSubTabUI(container);
      }
    }


    function fetchAndBindUsersListRealtime() {
      const container = document.getElementById('tblUsersBodyContainer');
      if (!container) return;
      
      dbNodeInstance.ref('users').off();
      dbNodeInstance.ref('users').on('value', (snapshot) => {
        cachedUsersPayload = snapshot.val() || {};
        updateUsersStats(cachedUsersPayload);
        renderUsersTableList();
      }, (error) => {
        console.error('Failed to listen to users node:', error);
        if (container) {
          container.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger);padding:24px;font-weight:700;">Không có quyền đọc danh sách tài khoản (Permission Denied).</td></tr>`;
        }
      });
    }


function getAdminRoleKind(role) {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'admin') return 'admin';
  if (value === 'garage') return 'garage';
  if (/(kế toán|ke toan|ketoan|accounting)/.test(value)) return 'accountant';
  return 'inspector';
}

function updateUsersStats(usersVal) {
  const counts = { Total:0, Admins:0, Inspectors:0, Accountants:0, Garages:0 };
  const keys = { admin:'Admins', inspector:'Inspectors', accountant:'Accountants', garage:'Garages' };
  Object.values(usersVal || {}).forEach(data => {
    counts.Total++;
    counts[keys[getAdminRoleKind(data.profile?.role)]]++;
  });
  Object.entries(counts).forEach(([key, value]) => {
    const node = document.getElementById('userStat' + key);
    if (!node) return;
    node.textContent = value;
    const share = counts.Total ? Math.round(value / counts.Total * 100) : 0;
    const card = node.closest('.claims-metric-card');
    const shareLabel = document.getElementById('userStatShare' + key);
    const progress = document.getElementById('userStatProgress' + key);
    if (shareLabel) shareLabel.textContent = share + '%';
    if (progress) progress.style.setProperty('--metric-progress', share + '%');
    if (card) card.setAttribute('aria-label', card.querySelector('.claims-metric-label').textContent + ': ' + value + ' thành viên');
  });
}

function setUserFilter(filterValue) {
  activeUserFilter = filterValue;
  const select = document.getElementById('adminUserRoleFilter');
  if (select) { select.value = filterValue; syncAdminSelects(); }
  renderUsersTableList();
}

function renderUsersTableList() {
  const tbody = document.getElementById('tblUsersBodyContainer');
  if (!tbody) return;
  const search = removeVietnameseTones(String(document.getElementById('userSearchInput')?.value || '').trim()).toLowerCase();
  const digitsSearch = search.replace(/[\s().-]/g, '');
  const roleKinds = { Admin:'admin', 'Kế toán':'accountant', 'Giám định viên':'inspector', Garage:'garage' };
  const entries = Object.entries(cachedUsersPayload || {});
  const filtered = entries.filter(([uid, data]) => {
    const p = data.profile || {};
    const phone = String(p.phone ?? p.phoneNumber ?? '');
    const text = removeVietnameseTones([p.displayName, p.email, p.role, p.department, p.employeeId, phone].join(' ')).toLowerCase();
    const matchesSearch = !search || text.includes(search) || (digitsSearch && phone.replace(/[\s().-]/g, '').includes(digitsSearch));
    return matchesSearch && (activeUserFilter === 'all' || getAdminRoleKind(p.role) === roleKinds[activeUserFilter]);
  });
  const count = document.getElementById('adminUsersResultCount');
  if (count) count.textContent = 'Hiển thị ' + filtered.length + ' / ' + entries.length + ' thành viên';
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state-premium"><div class="empty-icon">${SVGS.SEARCH}</div><strong>Không tìm thấy thành viên</strong><p>Thử tìm theo tên, email, số điện thoại hoặc đổi bộ lọc vai trò.</p></div></td></tr>`;
    return;
  }
  const mailIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/></svg>';
  const phoneIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.72c.12.96.35 1.91.69 2.81a2 2 0 0 1-.45 2.11L8.1 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.69A2 2 0 0 1 22 16.9z"/></svg>';
  const roleLabels = { admin:'Admin', inspector:'Giám định viên', accountant:'Kế toán', garage:'Garage' };
  const canManage = hasUserPermission('users', 'admin');
  tbody.innerHTML = filtered.map(([uid, data]) => {
    const p = data.profile || {};
    const name = p.displayName || 'Người dùng mới';
    const email = String(p.email || '').trim();
    const phone = String(p.phone ?? p.phoneNumber ?? '').trim();
    const kind = getAdminRoleKind(p.role);
    const phoneLink = phone.replace(/[^\d+]/g, '');
    const safeArg = value => escapeHtmlOutput(JSON.stringify(String(value)));
    return `<tr>
      <td data-label="Thành viên"><div class="admin-member">
        <div class="admin-avatar ${kind === 'admin' ? 'admin-avatar--admin' : ''}">${escapeHtmlOutput(deriveInitials(name))}</div>
        <div class="admin-member-info"><div class="admin-member-name">${escapeHtmlOutput(name)}</div>
          <div class="admin-member-id">${p.employeeId ? 'Mã NV · ' + escapeHtmlOutput(p.employeeId) : 'Thành viên TASCO DLK'}</div>
        </div></div></td>
      <td data-label="Liên hệ"><div class="admin-contact">
        ${email ? `<a href="mailto:${escapeHtmlOutput(email)}">${mailIcon}<span>${escapeHtmlOutput(email)}</span></a>` : `<span class="admin-contact-missing">${mailIcon}Chưa cập nhật email</span>`}
        ${phone && /^\+?\d{8,15}$/.test(phoneLink) ? `<a href="tel:${escapeHtmlOutput(phoneLink)}">${phoneIcon}<span>${escapeHtmlOutput(phone)}</span></a>` : `<span class="admin-contact-missing">${phoneIcon}${phone ? escapeHtmlOutput(phone) : 'Chưa cập nhật SĐT'}</span>`}
      </div></td>
      <td data-label="Bộ phận / Phòng ban"><span class="admin-department">${escapeHtmlOutput(p.department || 'Chưa cập nhật')}</span></td>
      <td data-label="Vai trò"><span class="admin-role-badge admin-role-badge--${kind}">${roleLabels[kind]}</span></td>
      <td data-label="Thao tác"><div class="admin-row-actions">${canManage ? `
        <button type="button" class="admin-button admin-button--secondary" onclick="openEditUserModal(${safeArg(uid)})" aria-label="Sửa thông tin ${escapeHtmlOutput(name)}">${SVGS.EDIT}<span>Sửa</span></button>
        <button type="button" class="admin-button admin-button--danger btn-danger-p" onclick="triggerDeleteUserAccount(${safeArg(uid)}, ${safeArg(name)})" aria-label="Xóa quyền truy cập của ${escapeHtmlOutput(name)}">${SVGS.TRASH}<span>Xóa</span></button>` : '<span class="admin-contact-missing">Chỉ xem</span>'}
      </div></td></tr>`;
  }).join('');
}



    async function saveUserAdministrationChange(uid, btnElement) {
      const selectedRole = document.getElementById(`userRole_${uid}`)?.value;
      const typedDept = document.getElementById(`userDept_${uid}`)?.value || '';
      
      const currentProfile = (cachedUsersPayload[uid] && cachedUsersPayload[uid].profile) || {};
      const updatedProfile = {
        ...currentProfile,
        role: selectedRole,
        department: typedDept,
        updatedAt: Date.now()
      };
      
      toggleButtonUIPendingState(btnElement, true, '...');
      
      try {
        await dbNodeInstance.ref(`users/${uid}/profile`).set(updatedProfile);
        triggerToast('Đã cập nhật phân quyền người dùng thành công!', 'success');
        
        const currentUserId = firebase.auth().currentUser?.uid;
        if (uid === currentUserId) {
          activeUserProfile = updatedProfile;
          try { localStorage.setItem(getProfileStorageKey(uid), JSON.stringify(updatedProfile)); } catch(_) {}
          renderHeaderNavigationLinks();
          
          const heroMeta = document.getElementById('heroUserMeta');
          if (heroMeta) {
            heroMeta.textContent = `${selectedRole} · ${typedDept}`;
          }
        }
      } catch (error) {
        console.error('Failed to update user profile node:', error);
        triggerToast('Lỗi cập nhật phân quyền: ' + (error.message || error), 'error');
      } finally {
        toggleButtonUIPendingState(btnElement, false, 'Lưu');
      }
    }
