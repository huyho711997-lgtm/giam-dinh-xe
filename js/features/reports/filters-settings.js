

    function toggleTonChuaHdReportCol(col, event) {
      if (event) event.stopPropagation();
      if (activeTonChuaHdReportCols.includes(col)) {
        activeTonChuaHdReportCols = activeTonChuaHdReportCols.filter(c => c !== col);
      } else {
        activeTonChuaHdReportCols.push(col);
      }
      try {
        localStorage.setItem('claimvision-ton-chua-hd-cols', JSON.stringify(activeTonChuaHdReportCols));
        const currentUser = firebase.auth().currentUser;
        if (currentUser && dbNodeInstance) {
          dbNodeInstance.ref(`users/${currentUser.uid}/settings/tonChuaHdCols`).set(activeTonChuaHdReportCols);
        }
      } catch (e) {}
      renderGdvReportPage();
    }


    function setAllTonChuaHdReportCols(selectAll) {
      if (selectAll) {
        activeTonChuaHdReportCols = [...DEFAULT_TON_CHUA_HD_COLS];
      } else {
        activeTonChuaHdReportCols = [];
      }
      try {
        localStorage.setItem('claimvision-ton-chua-hd-cols', JSON.stringify(activeTonChuaHdReportCols));
        const currentUser = firebase.auth().currentUser;
        if (currentUser && dbNodeInstance) {
          dbNodeInstance.ref(`users/${currentUser.uid}/settings/tonChuaHdCols`).set(activeTonChuaHdReportCols);
        }
      } catch (e) {}
      renderGdvReportPage();
    }


    function toggleWeeklyReportCol(col, event) {
      if (event) event.stopPropagation();
      if (activeWeeklyReportCols.includes(col)) {
        activeWeeklyReportCols = activeWeeklyReportCols.filter(c => c !== col);
      } else {
        activeWeeklyReportCols.push(col);
      }

      // Lưu ngay vào localStorage
      try {
        localStorage.setItem('claimvision-weekly-report-cols', JSON.stringify(activeWeeklyReportCols));
      } catch (e) {
        console.error('Lỗi lưu cấu hình cột báo cáo tuần vào localStorage:', e);
      }

      // Đồng bộ vào tài khoản người dùng trên Firebase
      try {
        const currentUser = firebase.auth().currentUser;
        if (currentUser && dbNodeInstance) {
          dbNodeInstance.ref(`users/${currentUser.uid}/settings/weeklyReportCols`).set(activeWeeklyReportCols);
        }
      } catch (e) {
        console.error('Lỗi đồng bộ cấu hình cột báo cáo tuần lên Firebase:', e);
      }

      renderGdvReportPage();
    }


    function setAllWeeklyReportCols(selectAll) {
      if (selectAll) {
        activeWeeklyReportCols = [...DEFAULT_WEEKLY_REPORT_COLS];
      } else {
        activeWeeklyReportCols = [];
      }
      try {
        localStorage.setItem('claimvision-weekly-report-cols', JSON.stringify(activeWeeklyReportCols));
        const currentUser = firebase.auth().currentUser;
        if (currentUser && dbNodeInstance) {
          dbNodeInstance.ref(`users/${currentUser.uid}/settings/weeklyReportCols`).set(activeWeeklyReportCols);
        }
      } catch (e) {}
      renderGdvReportPage();
    }


    function switchGdvReportView(viewMode) {
      if (activeGdvReportView) {
        tabFilterState[activeGdvReportView] = {
          gdvNames: [...activeSelectedGdvNames],
          dakLakStatuses: [...activeSelectedDakLakStatuses],
          startDate: activeGdvReportStartDate,
          endDate: activeGdvReportEndDate,
          week: activeGdvReportWeek,
          month: activeGdvReportMonth,
          year: activeGdvReportYear,
          carBrandMonths: [...activeCarBrandReportMonths],
          carBrandYears: [...activeCarBrandReportYears],
          tndsSearch: activeTndsReportSearch,
          tndsNoteFilter: activeTndsNoteFilter,
          tndsStatusFilter: activeTndsStatusFilter
        };
      }
      
      activeGdvReportView = viewMode;
      activeOpenDropdownId = null;

      if (tabFilterState[viewMode]) {
        const state = tabFilterState[viewMode];
        activeSelectedGdvNames = [...state.gdvNames];
        activeSelectedDakLakStatuses = [...state.dakLakStatuses];
        activeGdvReportStartDate = state.startDate;
        activeGdvReportEndDate = state.endDate;
        activeGdvReportWeek = state.week;
        activeGdvReportMonth = state.month;
        activeGdvReportYear = state.year;
        activeCarBrandReportMonths = state.carBrandMonths ? [...state.carBrandMonths] : ['all'];
        activeCarBrandReportYears = state.carBrandYears ? [...state.carBrandYears] : [String(new Date().getFullYear())];
        if (state.tndsSearch !== undefined) activeTndsReportSearch = state.tndsSearch;
        if (state.tndsNoteFilter !== undefined) activeTndsNoteFilter = state.tndsNoteFilter;
        if (state.tndsStatusFilter !== undefined) activeTndsStatusFilter = state.tndsStatusFilter;
      } else {
        activeSelectedGdvNames = ['Hồ Quang Huy', 'Huỳnh Văn Phúc', 'Nguyễn Quang Huy_DL'];
        activeSelectedDakLakStatuses = ['da_duyet_pasc', 'cho_duyet_hsbt'];
        activeGdvReportStartDate = "";
        activeGdvReportEndDate = "";
        activeGdvReportWeek = "current";
        activeGdvReportMonth = String(new Date().getMonth() + 1);
        activeGdvReportYear = String(new Date().getFullYear());
        activeCarBrandReportMonths = ['all'];
        activeCarBrandReportYears = [String(new Date().getFullYear())];
      }
      
      renderGdvReportPage();
    }


    function toggleCustomDropdownMenu(menuId, event) {
      if (event) event.stopPropagation();
      const menu = document.getElementById(menuId);
      if (!menu) return;
      const reportShell = menu.closest('.gdv-report-premium-shell');
      if (reportShell && typeof enhanceTonReportDropdowns === 'function') enhanceTonReportDropdowns(reportShell);
      const isVisible = menu.style.display === 'block';
      document.querySelectorAll('.custom-select-menu').forEach(m => {
        m.style.display = 'none';
        m.parentElement?.classList.remove('ton-dropdown-host--open');
        const openTrigger = m.parentElement ? m.parentElement.querySelector(':scope > button') : null;
        if (openTrigger) {
          openTrigger.classList.remove('is-open');
          openTrigger.setAttribute('aria-expanded', 'false');
        }
      });
      if (!isVisible) {
        menu.style.display = 'block';
        const trigger = menu.parentElement ? menu.parentElement.querySelector(':scope > button') : null;
        if (trigger) {
          trigger.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
        }
        activeOpenDropdownId = menuId;
        if (menu.classList.contains('ton-dropdown')) {
          openTonReportDropdown(menu, trigger, event);
          return;
        }
        if (trigger && menu.classList.contains('report-picker__menu') && window.matchMedia('(max-width: 600px)').matches) {
          const triggerRect = trigger.getBoundingClientRect();
          const top = Math.max(12, Math.min(triggerRect.bottom + 8, window.innerHeight - 220));
          menu.style.setProperty('--report-picker-top', top + 'px');
        }
        const activeItem = menu.querySelector('.report-picker__item.is-active');
        const scrollBody = menu.querySelector('.report-picker__body');
        if (activeItem && scrollBody) {
          const bodyRect = scrollBody.getBoundingClientRect();
          const itemRect = activeItem.getBoundingClientRect();
          if (itemRect.top < bodyRect.top || itemRect.bottom > bodyRect.bottom) {
            scrollBody.scrollTop += itemRect.top - bodyRect.top - 8;
          }
        }
      } else {
        activeOpenDropdownId = null;
        if (typeof syncTonReportDropdownState === 'function') syncTonReportDropdownState();
      }
    }


    function toggleCarBrandMonth(val, evt) {
      if (evt) evt.stopPropagation();
      if (val === 'all') {
        activeCarBrandReportMonths = ['all'];
      } else {
        activeCarBrandReportMonths = activeCarBrandReportMonths.filter(x => x !== 'all');
        const idx = activeCarBrandReportMonths.indexOf(String(val));
        if (idx > -1) activeCarBrandReportMonths.splice(idx, 1);
        else activeCarBrandReportMonths.push(String(val));
        if (activeCarBrandReportMonths.length === 0) activeCarBrandReportMonths = ['all'];
      }
      renderGdvReportPage();
    }


    function toggleCarBrandYear(val, evt) {
      if (evt) evt.stopPropagation();
      if (val === 'all') {
        activeCarBrandReportYears = ['all'];
      } else {
        activeCarBrandReportYears = activeCarBrandReportYears.filter(x => x !== 'all');
        const idx = activeCarBrandReportYears.indexOf(String(val));
        if (idx > -1) activeCarBrandReportYears.splice(idx, 1);
        else activeCarBrandReportYears.push(String(val));
        if (activeCarBrandReportYears.length === 0) activeCarBrandReportYears = ['all'];
      }
      renderGdvReportPage();
    }


    function selectGdvReportMonth(month) {
      activeGdvReportMonth = month;
      document.querySelectorAll('.custom-select-menu').forEach(m => m.style.display = 'none');
      activeOpenDropdownId = null;
      renderGdvMonthlyReportPage();
    }


    function selectGdvReportYear(year) {
      activeGdvReportYear = year;
      document.querySelectorAll('.custom-select-menu').forEach(m => m.style.display = 'none');
      activeOpenDropdownId = null;
      renderGdvMonthlyReportPage();
    }


    function selectAnnualClaimsYear(year) {
      activeAnnualClaimsYear = String(year);
      document.querySelectorAll('.custom-select-menu').forEach(m => m.style.display = 'none');
      activeOpenDropdownId = null;
      renderGdvMonthlyReportPage();
    }


    function getAnnualClaimsAvailableYears() {
      const years = new Set([String(new Date().getFullYear()), String(activeAnnualClaimsYear)]);
      const dateField = cachedReportRules.phatSinhDateField || 'ngayMoHs';
      Object.values(cachedPendingClaimsPayload || {}).forEach(claim => {
        const dateMs = getClaimDateMs(claim, dateField);
        if (dateMs > 0) years.add(String(new Date(dateMs).getFullYear()));
      });
      return Array.from(years).sort((a, b) => Number(b) - Number(a));
    }


    function selectGdvReportBranch(branch) {
      activeGdvReportBranch = branch;
      document.querySelectorAll('.custom-select-menu').forEach(m => m.style.display = 'none');
      activeOpenDropdownId = null;
      renderGdvMonthlyReportPage();
    }


    function selectGdvReportGara(gara) {
      activeGdvReportGara = gara;
      document.querySelectorAll('.custom-select-menu').forEach(m => m.style.display = 'none');
      activeOpenDropdownId = null;
      renderGdvMonthlyReportPage();
    }


    function selectGdvReportDaysRange(range) {
      activeGdvReportDaysRange = range;
      document.querySelectorAll('.custom-select-menu').forEach(m => m.style.display = 'none');
      activeOpenDropdownId = null;
      renderGdvMonthlyReportPage();
    }


    function openKpiConfigDirectly() {
      switchWorkspaceTab('users');
      activeSystemAdminSubTab = 'kpi-config';
      setTimeout(() => {
        switchSystemAdminSubTab('kpi-config');
      }, 50);
    }


    
    function getRuleArray(str) {
      return String(str || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    }


    function isPhatSinh(c) {
      if (!c) return false;
      const st = String(c.trangThai || '').toLowerCase();
      const ex = getRuleArray(cachedReportRules.phatSinhExcludes);
      if (ex.some(e => st.includes(e))) return false;
      return true;
    }


    function isChuyenDntt(c) {
      if (!c) return false;
      const st = String(c.trangThai || '').toLowerCase();
      const inc = getRuleArray(cachedReportRules.chuyenDnttStatuses);
      if (inc.length === 0) return true; // empty means all allowed
      return inc.some(e => st.includes(e));
    }


    function isTndsClaim(c) {
      if (!c) return false;
      const text = String(c.loaiHoSo || c.nhomBoiThuong || c.tnds || c.maSpNghiepVu || c.loaiHinhBaoHiem || c.nghiepVu || c.tenHoSo || '').toLowerCase();
      const kws = getRuleArray(cachedReportRules.tndsKeywords);
      return kws.some(kw => text.includes(kw));
    }


    function isUnpaidClaim(c) {
      if (!c) return false;
      const st = String(c.trangThai || '').toLowerCase();
      const unpaidExcludes = getRuleArray(cachedReportRules.unpaidStatuses);
      if (unpaidExcludes.some(ex => st.includes(ex))) {
        return false;
      }
      if (c.ngayThanhToan) return false;
      return true;
    }


    function isDuyetHsbtApproved(c) {
      if (!c) return false;
      const approvedHsbtStatuses = getRuleArray(cachedReportRules.approvedStatuses || 'da_duyet_hsbt,cho_duyet_dntt,cho_kt_duyet,kt_duyet,da_thanh_toan');
      if (approvedHsbtStatuses.length === 0) return false;
      const rawSt = String(c.trangThai || '').trim();
      const lowerSt = rawSt.toLowerCase();
      if (approvedHsbtStatuses.includes(lowerSt)) return true;
      for (const [k, v] of Object.entries(PENDING_STATUS_MAP)) {
        if (lowerSt === k || lowerSt === v.label.toLowerCase()) {
          if (approvedHsbtStatuses.includes(k) || approvedHsbtStatuses.includes(v.label.toLowerCase())) return true;
        }
      }
      return false;
    }


    function isOnlyDaDuyetHsbt(c) {
      if (!c) return false;
      const st = String(c.trangThai || '').toLowerCase().trim();
      const arr = getRuleArray(cachedReportRules.onlyApprovedStatuses);
      return arr.includes(st);
    }


    function isHsDuPhongOver50M(c) {
      if (!c) return false;
      const reserveStr = String(c.duPhongBoiThuong || c.soTienDuPhong || c.duPhong || '0').replace(/[^0-9]/g, '');
      const reserveVal = parseInt(reserveStr, 10) || 0;
      if (reserveVal <= cachedReportRules.hsDpbtAmount) return false;
      
      const st = String(c.trangThai || '').toLowerCase();
      const inc = getRuleArray(cachedReportRules.hsDpbtStatuses);
      if (inc.length === 0) return true;
      return inc.some(e => st.includes(e));
    }


    function changeGdvReportSearch(txt) {
      activeGdvReportSearch = (txt || '').toLowerCase().trim();
      renderGdvMonthlyReportPage();
    }


    function getGdvInitials(name) {
      if (!name || name === 'Chưa phân công') return '??';
      const clean = name.replace(/_DL|_HO|_GDV/gi, '').trim();
      const parts = clean.split(' ').filter(Boolean);
      if (parts.length >= 2) return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
      return clean.substring(0, 2).toUpperCase();
    }


    function openReportSettingsModal() {
      let m = document.getElementById('reportSettingsModal');
      if (m) m.remove();
      m = document.createElement('div');
      m.id = 'reportSettingsModal';
      m.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.6); backdrop-filter:blur(10px); z-index:999999; display:flex; align-items:center; justify-content:center; padding:20px; box-sizing:border-box; animation: fadeIn 0.2s ease-out;';
      
      const claimStatusCounts = {};
      Object.values(cachedPendingClaimsPayload || {}).forEach(c => {
        const st = c.trangThai || 'moi';
        claimStatusCounts[st] = (claimStatusCounts[st] || 0) + 1;
      });

      const buildCheckboxList = (id, currentStr) => {
        const currArr = getRuleArray(currentStr);
        let html = '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:10px; max-height:280px; overflow-y:auto; padding:10px; margin-top:8px; border:1px solid var(--border); border-radius:12px; background:var(--surface-strong);" class="custom-scroll">';
        Object.keys(PENDING_STATUS_MAP).forEach(k => {
          const checked = currArr.includes(k) ? 'checked' : '';
          const item = PENDING_STATUS_MAP[k] || { label: k, color: 'var(--primary)' };
          const countVal = claimStatusCounts[k] !== undefined ? claimStatusCounts[k] : 0;
          html += `<label style="display:flex; align-items:center; justify-content:space-between; gap:8px; cursor:pointer; font-size:13px; font-weight:700; padding:8px 12px; border-radius:8px; background:var(--surface); border:1px solid var(--border); transition:all 0.2s; box-shadow:var(--shadow-xs);">
            <div style="display:flex; align-items:center; gap:8px;">
              <input type="checkbox" value="${k}" class="${id}_chk" ${checked} style="width:16px; height:16px; accent-color:var(--primary); cursor:pointer;">
              <span style="width:7px; height:7px; border-radius:50%; background:${item.color}; box-shadow:0 0 5px ${item.color}; flex-shrink:0;"></span>
              <span style="color:var(--text-main); font-size:12.5px;">${item.label}</span>
            </div>
            <span style="font-size:11px; font-weight:800; padding:1px 7px; border-radius:99px; background:var(--bg-soft); color:var(--text-muted);">${countVal}</span>
          </label>`;
        });
        html += '</div>';
        return html;
      };

      const buildDateFieldSelect = (id, currentVal) => {
        const options = [
          { val: 'ngayMoHs', label: 'Ngày mở HS / Phân công' },
          { val: 'toTrinhNgayDuyet', label: 'Ngày duyệt Tờ trình / HSBT' },
          { val: 'ngayNhanDuHoSo', label: 'Ngày nhận đủ hồ sơ (Chuyển ĐNTT)' },
          { val: 'ngayThanhToan', label: 'Ngày Kế toán Thanh toán' },
          { val: 'ngayVTT', label: 'Ngày xảy ra tổn thất' },
          { val: 'none', label: 'Không lọc (Tính toàn thời gian)' }
        ];
        let html = '<select id="' + id + '" class="p-input" style="width:100%; max-width:400px; padding:12px 16px; border-radius:12px; font-size:14px; font-weight:700; background:var(--input-bg); color:var(--text-main); border:1px solid var(--input-border, var(--border)); outline:none; cursor:pointer;">';
        options.forEach(opt => {
          const selected = currentVal === opt.val ? 'selected' : '';
          html += '<option value="' + opt.val + '" ' + selected + '>' + opt.label + '</option>';
        });
        html += '</select>';
        return html;
      };
      m.innerHTML = `
        <div style="background:var(--surface); border-radius:24px; width:92vw; max-width:1400px; height:92vh; display:flex; flex-direction:column; box-shadow:0 30px 100px rgba(0,0,0,0.4); border:1px solid var(--border-strong); overflow:hidden;">
          <div style="padding:24px 32px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background: linear-gradient(135deg, var(--surface) 0%, var(--surface-strong) 100%);">
            <div>
              <h3 style="margin:0 0 6px 0; font-size:24px; font-weight:900; color: var(--text-main); display:flex; align-items:center; gap:10px;">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--primary)" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                Cài đặt logic Báo cáo chuyên sâu
              </h3>
              <p style="margin:0; font-size:14px; color:var(--text-soft); font-weight:600;">Tùy chỉnh toàn bộ điều kiện, trạng thái và ngưỡng đếm hồ sơ cho từng cột cụ thể.</p>
            </div>
            <button onclick="document.getElementById('reportSettingsModal').remove()" style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); color:#ef4444; cursor:pointer; width:44px; height:44px; border-radius:14px; display:flex; align-items:center; justify-content:center; transition:all 0.2s;" onmouseover="this.style.background='#ef4444'; this.style.color='#fff'">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          
          <div style="display:flex; flex-grow:1; overflow:hidden;">
            <!-- Tabs Menu -->
            <div style="width:280px; min-width:280px; border-right:1px solid var(--border); display:flex; flex-direction:column; overflow-y:auto; background:var(--surface-strong); padding:20px 16px; gap:8px;" class="custom-scroll">
              <div class="rs-tab active" onclick="switchRsTab(0)" style="padding:14px 16px; border-radius:14px; cursor:pointer; font-size:14px; font-weight:800; background:linear-gradient(135deg, var(--primary) 0%, #d8b46d 100%); color:#000; box-shadow:0 4px 12px rgba(216,180,109,0.3); transition:all 0.2s;">1. Cột Phát Sinh</div>
              <div class="rs-tab" onclick="switchRsTab(1)" style="padding:14px 16px; border-radius:14px; cursor:pointer; font-size:14px; font-weight:700; color:var(--text-main); transition:all 0.2s;">2. Đã duyệt HSBT</div>
              <div class="rs-tab" onclick="switchRsTab(2)" style="padding:14px 16px; border-radius:14px; cursor:pointer; font-size:14px; font-weight:700; color:var(--text-main); transition:all 0.2s;">3. Chuyển ĐNTT</div>
              <div class="rs-tab" onclick="switchRsTab(3)" style="padding:14px 16px; border-radius:14px; cursor:pointer; font-size:14px; font-weight:700; color:var(--text-main); transition:all 0.2s;">4. Lượng xe Carpla</div>
              <div class="rs-tab" onclick="switchRsTab(4)" style="padding:14px 16px; border-radius:14px; cursor:pointer; font-size:14px; font-weight:700; color:var(--text-main); transition:all 0.2s;">5. Tồn TNDS lũy kế</div>
              <div class="rs-tab" onclick="switchRsTab(5)" style="padding:14px 16px; border-radius:14px; cursor:pointer; font-size:14px; font-weight:700; color:var(--text-main); transition:all 0.2s;">6. HS Tồn > X Ngày</div>
              <div class="rs-tab" onclick="switchRsTab(6)" style="padding:14px 16px; border-radius:14px; cursor:pointer; font-size:14px; font-weight:700; color:var(--text-main); transition:all 0.2s;">7. HS DPBT > X TR</div>
              <div class="rs-tab" onclick="switchRsTab(7)" style="padding:14px 16px; border-radius:14px; cursor:pointer; font-size:14px; font-weight:700; color:var(--text-main); transition:all 0.2s;">8. Tiền BQ Dưới X TR</div>
            </div>
            
            <!-- Tab Contents -->
            <div style="flex-grow:1; overflow-y:auto; padding:32px 40px; background:var(--surface);" class="custom-scroll">
              
              <!-- 0: Phat Sinh -->
              <div class="rs-content" id="rs_tab_0">
                <h4 style="margin:0 0 16px 0; font-size:22px; color:var(--text-main); font-weight:900;">Cột: PHÁT SINH</h4>
                <div style="background:rgba(216,180,109,0.1); border:1px solid rgba(216,180,109,0.3); padding:16px; border-radius:12px; margin-bottom:24px;">
                  <p style="font-size:14px; color:var(--text-main); margin:0; line-height:1.6;"><strong>Logic mặc định:</strong> Đếm mọi hồ sơ có "Ngày mở HS" rơi vào khoảng thời gian lọc của báo cáo.</p>
                </div>
                <div style="margin-top:24px; margin-bottom:24px;">
                  <label style="display:block; font-size:15px; font-weight:850; color:var(--primary); margin-bottom:8px;">Trường Ngày xét (Date Field):</label>
                  <p style="font-size:13px; color:var(--text-soft); margin-bottom:12px;">Chọn trường ngày sẽ được dùng để xét xem hồ sơ có nằm trong khoảng thời gian lọc hay không.</p>
                  ${buildDateFieldSelect('rs_phatSinhDateField', cachedReportRules.phatSinhDateField)}
                </div>
                <label style="display:block; font-size:15px; font-weight:850; color:var(--text-main); margin-bottom:8px;">Loại trừ các trạng thái sau (Không tính vào Phát Sinh):</label>
                <p style="font-size:13px; color:var(--text-soft); margin-bottom:12px;">Tích chọn các trạng thái mà bạn KHÔNG MUỐN đếm vào cột này (Ví dụ: Từ chối bồi thường).</p>
                ${buildCheckboxList('rs_phatSinhExcludes', cachedReportRules.phatSinhExcludes)}
              </div>

              <!-- 1: Da Duyet HSBT -->
              <div class="rs-content" id="rs_tab_1" style="display:none;">
                <h4 style="margin:0 0 16px 0; font-size:22px; color:var(--text-main); font-weight:900;">Cột: ĐÃ DUYỆT HSBT</h4>
                <div style="background:rgba(216,180,109,0.1); border:1px solid rgba(216,180,109,0.3); padding:16px; border-radius:12px; margin-bottom:24px;">
                  <p style="font-size:14px; color:var(--text-main); margin:0; line-height:1.6;"><strong>Logic chuẩn:</strong> Các hồ sơ được tính toán phải có ngày <strong>"Ngày mở HS"</strong> trong khoảng thời gian được chọn và phải thỏa mãn điều kiện trạng thái thuộc nhóm Đã duyệt (Đã duyệt HSBT, Chờ duyệt ĐNTT, Chờ KT duyệt, KT duyệt, Đã Thanh toán).</p>
                </div>
                <div style="margin-top:24px; margin-bottom:24px;">
                  <label style="display:block; font-size:15px; font-weight:850; color:var(--primary); margin-bottom:8px;">Trường Ngày xét (Date Field):</label>
                  <p style="font-size:13px; color:var(--text-soft); margin-bottom:12px;">Mặc định xét theo <strong>"Ngày mở HS / Phân công"</strong> trong khoảng thời gian lọc của báo cáo.</p>
                  ${buildDateFieldSelect('rs_daDuyetDateField', cachedReportRules.daDuyetDateField || 'ngayMoHs')}
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <label style="font-size:15px; font-weight:850; color:var(--text-main); margin:0;">Các trạng thái được tính là ĐÃ DUYỆT:</label>
                  <div style="display:flex; gap:8px;">
                    <button type="button" onclick="selectStandardApprovedStatuses()" style="border:none; background:rgba(16,185,129,0.14); color:#10b981; font-size:11px; font-weight:850; padding:5px 12px; border-radius:8px; cursor:pointer; transition:all 0.15s ease;" onmouseover="this.style.background='rgba(16,185,129,0.25)'" onmouseout="this.style.background='rgba(16,185,129,0.14)'">✓ Chọn 5 trạng thái chuẩn</button>
                    <button type="button" onclick="toggleAllReportCheckboxes('rs_approvedStatuses_chk', true)" style="border:none; background:rgba(59,130,246,0.12); color:#3b82f6; font-size:11px; font-weight:850; padding:5px 10px; border-radius:8px; cursor:pointer; transition:all 0.15s ease;">Chọn tất cả</button>
                    <button type="button" onclick="toggleAllReportCheckboxes('rs_approvedStatuses_chk', false)" style="border:none; background:rgba(239,68,68,0.12); color:#ef4444; font-size:11px; font-weight:850; padding:5px 10px; border-radius:8px; cursor:pointer; transition:all 0.15s ease;">Bỏ chọn tất cả</button>
                  </div>
                </div>
                <p style="font-size:13px; color:var(--text-soft); margin-bottom:12px;">Chỉ những hồ sơ có trạng thái tích dưới đây mới được đếm vào cột này.</p>
                ${buildCheckboxList('rs_approvedStatuses', cachedReportRules.approvedStatuses || 'da_duyet_hsbt,cho_duyet_dntt,cho_kt_duyet,kt_duyet,da_thanh_toan')}
              </div>

              <!-- 2: Chuyen DNTT -->
              <div class="rs-content" id="rs_tab_2" style="display:none;">
                <h4 style="margin:0 0 16px 0; font-size:22px; color:var(--text-main); font-weight:900;">Cột: CHUYỂN ĐNTT</h4>
                <div style="background:rgba(216,180,109,0.1); border:1px solid rgba(216,180,109,0.3); padding:16px; border-radius:12px; margin-bottom:24px;">
                  <p style="font-size:14px; color:var(--text-main); margin:0; line-height:1.6;"><strong>Logic mặc định:</strong> Đếm mọi hồ sơ có "Ngày nhận đủ HS" nằm trong khoảng thời gian lọc.</p>
                </div>
                <div style="margin-top:24px; margin-bottom:24px;">
                  <label style="display:block; font-size:15px; font-weight:850; color:var(--primary); margin-bottom:8px;">Trường Ngày xét (Date Field):</label>
                  <p style="font-size:13px; color:var(--text-soft); margin-bottom:12px;">Chọn trường ngày sẽ được dùng để xét xem hồ sơ có nằm trong khoảng thời gian lọc hay không.</p>
                  ${buildDateFieldSelect('rs_chuyenDnttDateField', cachedReportRules.chuyenDnttDateField)}
                </div>
                <label style="display:block; font-size:15px; font-weight:850; color:var(--text-main); margin-bottom:8px;">Bộ lọc Trạng thái (Tùy chọn):</label>
                <p style="font-size:13px; color:var(--text-soft); margin-bottom:12px;">Nếu muốn CHỈ đếm những hồ sơ đã chuyển ĐNTT, hãy tích chọn bên dưới. <strong>Để trống = Không lọc theo trạng thái.</strong></p>
                ${buildCheckboxList('rs_chuyenDnttStatuses', cachedReportRules.chuyenDnttStatuses)}
              </div>

              <!-- 3: Carpla -->
              <div class="rs-content" id="rs_tab_3" style="display:none;">
                <h4 style="margin:0 0 16px 0; font-size:22px; color:var(--text-main); font-weight:900;">Cột: LƯỢNG XE / DOANH SỐ CARPLA</h4>
                <div style="background:rgba(216,180,109,0.1); border:1px solid rgba(216,180,109,0.3); padding:16px; border-radius:12px; margin-bottom:24px;">
                  <p style="font-size:14px; color:var(--text-main); margin:0; line-height:1.6;"><strong>Logic mặc định:</strong> Đếm các hồ sơ có Tên Gara Viết Tắt hoặc Ghi Chú chứa từ khóa bên dưới.</p>
                </div>
                <div style="margin-top:24px; margin-bottom:24px;">
                  <label style="display:block; font-size:15px; font-weight:850; color:var(--primary); margin-bottom:8px;">Trường Ngày xét (Date Field):</label>
                  <p style="font-size:13px; color:var(--text-soft); margin-bottom:12px;">Chọn trường ngày sẽ được dùng để xét xem hồ sơ có nằm trong khoảng thời gian lọc hay không.</p>
                  ${buildDateFieldSelect('rs_carplaDateField', cachedReportRules.carplaDateField)}
                </div>
                <label style="display:block; font-size:15px; font-weight:850; color:var(--text-main); margin-bottom:8px;">Từ khóa nhận diện Gara Carpla:</label>
                <p style="font-size:13px; color:var(--text-soft); margin-bottom:12px;">Các từ khóa cách nhau bởi dấu phẩy.</p>
                <textarea id="rs_carplaKeywords" class="p-input" style="width:100%; height:100px; padding:16px; border-radius:12px; font-size:15px; font-weight:600; font-family:var(--font-family);" placeholder="VD: carpla, car pla">${cachedReportRules.carplaKeywords}</textarea>
              </div>

              <!-- 4: Ton TNDS -->
              <div class="rs-content" id="rs_tab_4" style="display:none;">
                <h4 style="margin:0 0 16px 0; font-size:22px; color:var(--text-main); font-weight:900;">Cột: HỒ SƠ TNDS TỒN LŨY KẾ</h4>
                <div style="background:rgba(216,180,109,0.1); border:1px solid rgba(216,180,109,0.3); padding:16px; border-radius:12px; margin-bottom:24px;">
                  <p style="font-size:14px; color:var(--text-main); margin:0; line-height:1.6;"><strong>Logic mặc định:</strong> Đếm TOÀN THỜI GIAN các hồ sơ chứa từ khóa TNDS và KHÔNG nằm trong nhóm trạng thái loại trừ (Đã kết thúc).</p>
                </div>
                
                <div style="margin-top:24px; margin-bottom:24px;">
                  <label style="display:block; font-size:15px; font-weight:850; color:var(--primary); margin-bottom:8px;">Trường Ngày xét (Date Field):</label>
                  <p style="font-size:13px; color:var(--text-soft); margin-bottom:12px;">Chọn trường ngày sẽ được dùng để xét xem hồ sơ có nằm trong khoảng thời gian lọc hay không.</p>
                  ${buildDateFieldSelect('rs_tndsTonDateField', cachedReportRules.tndsTonDateField)}
                </div>
                <label style="display:block; font-size:15px; font-weight:850; color:var(--text-main); margin-bottom:8px;">1. Từ khóa nhận diện HS TNDS:</label>
                <p style="font-size:13px; color:var(--text-soft); margin-bottom:12px;">Hệ thống sẽ tìm từ khóa này trong Loại hồ sơ, Nhóm Bồi thường, Nghiệp vụ, v.v...</p>
                <textarea id="rs_tndsKeywords" class="p-input" style="width:100%; height:80px; padding:14px; border-radius:12px; font-size:15px; font-weight:600; font-family:var(--font-family);" placeholder="VD: tnds, trách nhiệm dân sự">${cachedReportRules.tndsKeywords}</textarea>
                
                <div style="margin-top: 24px;">
                  <label style="display:block; font-size:15px; font-weight:850; color:var(--text-main); margin-bottom:8px;">2. Các trạng thái KHÔNG ĐƯỢC tính là Tồn:</label>
                  <p style="font-size:13px; color:var(--text-soft); margin-bottom:12px;">Các hồ sơ đạt trạng thái này sẽ bị loại khỏi danh sách đếm Tồn lũy kế.</p>
                  ${buildCheckboxList('rs_unpaidStatuses', cachedReportRules.unpaidStatuses)}
                </div>
              </div>

              <!-- 5: Ton > X Ngay -->
              <div class="rs-content" id="rs_tab_5" style="display:none;">
                <h4 style="margin:0 0 16px 0; font-size:22px; color:var(--text-main); font-weight:900;">Cột: HS TỒN > X NGÀY</h4>
                <div style="background:rgba(216,180,109,0.1); border:1px solid rgba(216,180,109,0.3); padding:16px; border-radius:12px; margin-bottom:24px;">
                  <p style="font-size:14px; color:var(--text-main); margin:0; line-height:1.6;"><strong>Logic mặc định:</strong> Đếm các hồ sơ đang treo ở một trạng thái cụ thể quá số ngày quy định (tính từ Ngày mở HS).</p>
                </div>
                
                <div style="margin-top:24px; margin-bottom:24px;">
                  <label style="display:block; font-size:15px; font-weight:850; color:var(--primary); margin-bottom:8px;">Trường Ngày xét (Date Field):</label>
                  <p style="font-size:13px; color:var(--text-soft); margin-bottom:12px;">Chọn mốc ngày bắt đầu để tính toán tuổi hồ sơ (VD: lấy Hiện tại trừ đi Ngày mở HS). Cột này ĐẾM LŨY KẾ TOÀN THỜI GIAN, không bị giới hạn bởi kỳ báo cáo.</p>
                  ${buildDateFieldSelect('rs_hsTonDateField', cachedReportRules.hsTonDateField)}
                </div>
                <label style="display:block; font-size:15px; font-weight:850; color:var(--text-main); margin-bottom:8px;">1. Ngưỡng số ngày Tồn:</label>
                <input type="number" id="rs_hsTonDays" class="p-input" value="${cachedReportRules.hsTonDays}" style="width:150px; padding:12px 16px; border-radius:12px; font-size:16px; font-weight:800;">
                
                <div style="margin-top: 24px;">
                  <label style="display:block; font-size:15px; font-weight:850; color:var(--text-main); margin-bottom:8px;">2. Các trạng thái áp dụng xét Tồn:</label>
                  <p style="font-size:13px; color:var(--text-soft); margin-bottom:12px;">Chỉ các hồ sơ ĐANG nằm ở trạng thái này mới bị đếm là Tồn.</p>
                  ${buildCheckboxList('rs_onlyApprovedStatuses', cachedReportRules.onlyApprovedStatuses)}
                </div>
              </div>

              <!-- 6: DPBT > X TR -->
              <div class="rs-content" id="rs_tab_6" style="display:none;">
                <h4 style="margin:0 0 16px 0; font-size:22px; color:var(--text-main); font-weight:900;">Cột: HS DPBT > X TRIỆU</h4>
                <div style="background:rgba(216,180,109,0.1); border:1px solid rgba(216,180,109,0.3); padding:16px; border-radius:12px; margin-bottom:24px;">
                  <p style="font-size:14px; color:var(--text-main); margin:0; line-height:1.6;"><strong>Logic mặc định:</strong> Đếm các hồ sơ CHƯA HOÀN THÀNH có mức Dự phòng bồi thường vượt quá con số chỉ định.</p>
                </div>
                
                <div style="margin-top:24px; margin-bottom:24px;">
                  <label style="display:block; font-size:15px; font-weight:850; color:var(--primary); margin-bottom:8px;">Trường Ngày xét (Date Field):</label>
                  <p style="font-size:13px; color:var(--text-soft); margin-bottom:12px;">Chọn trường ngày sẽ được dùng để xét xem hồ sơ có nằm trong khoảng thời gian lọc hay không.</p>
                  ${buildDateFieldSelect('rs_hsDpbtDateField', cachedReportRules.hsDpbtDateField)}
                </div>
                <label style="display:block; font-size:15px; font-weight:850; color:var(--text-main); margin-bottom:8px;">1. Ngưỡng Tiền Dự Phòng (VNĐ):</label>
                <input type="text" id="rs_hsDpbtAmount" class="p-input" value="${formatCurrencyInputNumber(cachedReportRules.hsDpbtAmount)}" oninput="this.value = formatCurrencyInputNumber(this.value.replace(/[^0-9]/g, ''))" style="width:300px; padding:12px 16px; border-radius:12px; font-size:18px; font-weight:900; color:var(--primary);">
                
                <div style="margin-top: 24px;">
                  <label style="display:block; font-size:15px; font-weight:850; color:var(--text-main); margin-bottom:8px;">2. Trạng thái áp dụng (Các trạng thái chưa hoàn thành):</label>
                  <p style="font-size:13px; color:var(--text-soft); margin-bottom:12px;">Chỉ đếm Dự phòng cho các hồ sơ đang ở trạng thái này.</p>
                  ${buildCheckboxList('rs_hsDpbtStatuses', cachedReportRules.hsDpbtStatuses)}
                </div>
              </div>

              <!-- 7: Tien BQ -->
              <div class="rs-content" id="rs_tab_7" style="display:none;">
                <h4 style="margin:0 0 16px 0; font-size:22px; color:var(--text-main); font-weight:900;">Cột: SỐ TIỀN BÌNH QUÂN DƯỚI X TRIỆU</h4>
                <div style="background:rgba(216,180,109,0.1); border:1px solid rgba(216,180,109,0.3); padding:16px; border-radius:12px; margin-bottom:24px;">
                  <p style="font-size:14px; color:var(--text-main); margin:0; line-height:1.6;"><strong>Logic mặc định:</strong> Tính trung bình Số Tiền Bồi Thường của các hồ sơ ĐÃ DUYỆT có mức duyệt thấp hơn ngưỡng này.</p>
                </div>
                
                <div style="margin-top:24px; margin-bottom:24px;">
                  <label style="display:block; font-size:15px; font-weight:850; color:var(--primary); margin-bottom:8px;">Trường Ngày xét (Date Field):</label>
                  <p style="font-size:13px; color:var(--text-soft); margin-bottom:12px;">Chọn trường ngày sẽ được dùng để xét xem hồ sơ có nằm trong khoảng thời gian lọc hay không.</p>
                  ${buildDateFieldSelect('rs_avgAmountDateField', cachedReportRules.avgAmountDateField)}
                </div>
                <label style="display:block; font-size:15px; font-weight:850; color:var(--text-main); margin-bottom:8px;">Ngưỡng Số Tiền BQ tối đa (VNĐ):</label>
                <input type="text" id="rs_avgAmount" class="p-input" value="${formatCurrencyInputNumber(cachedReportRules.avgAmount)}" oninput="this.value = formatCurrencyInputNumber(this.value.replace(/[^0-9]/g, ''))" style="width:300px; padding:12px 16px; border-radius:12px; font-size:18px; font-weight:900; color:var(--primary);">
              </div>

            </div>
          </div>
          <div style="padding:24px 40px; border-top:1px solid var(--border); display:flex; justify-content:flex-end; gap:16px; background:var(--surface-strong);">
            <button onclick="document.getElementById('reportSettingsModal').remove()" style="padding:12px 28px; border-radius:14px; border:none; background:transparent; font-weight:800; font-size:15px; color:var(--text-main); cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='transparent'">Đóng</button>
            <button onclick="saveReportSettings()" class="btn-primary" style="padding:12px 36px; border-radius:14px; border:none; background:linear-gradient(135deg, var(--primary) 0%, #d8b46d 100%); color:#000; font-weight:900; font-size:15px; cursor:pointer; box-shadow:0 10px 24px rgba(216,180,109,0.4); transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 12px 28px rgba(216,180,109,0.5)'" onmouseout="this.style.transform='none'; this.style.boxShadow='0 10px 24px rgba(216,180,109,0.4)'">Lưu Tất Cả Cài Đặt</button>
          </div>
        </div>
      `;
      document.body.appendChild(m);

      window.selectStandardApprovedStatuses = function() {
        const standardKeys = ['da_duyet_hsbt', 'cho_duyet_dntt', 'cho_kt_duyet', 'kt_duyet', 'da_thanh_toan'];
        document.querySelectorAll('.rs_approvedStatuses_chk').forEach(chk => {
          chk.checked = standardKeys.includes(chk.value);
        });
        const dateSelect = document.getElementById('rs_daDuyetDateField');
        if (dateSelect) dateSelect.value = 'ngayMoHs';
      };

      window.toggleAllReportCheckboxes = function(chkClass, isChecked) {
        document.querySelectorAll('.' + chkClass).forEach(chk => {
          chk.checked = isChecked;
        });
      };

      window.switchRsTab = function(idx) {
        document.querySelectorAll('.rs-tab').forEach((el, i) => {
          if (i === idx) {
            el.style.background = 'linear-gradient(135deg, var(--primary) 0%, #d8b46d 100%)';
            el.style.color = '#000';
            el.style.boxShadow = '0 4px 12px rgba(216,180,109,0.3)';
          } else {
            el.style.background = 'transparent';
            el.style.color = 'var(--text-main)';
            el.style.boxShadow = 'none';
          }
        });
        document.querySelectorAll('.rs-content').forEach((el, i) => {
          el.style.display = i === idx ? 'block' : 'none';
        });
      };
    }


    async function saveReportSettings() {
      const getChecked = (cls) => Array.from(document.querySelectorAll('.' + cls)).filter(el => el.checked).map(el => el.value).join(',');
      const getSelectVal = (id, defaultVal) => {
        const el = document.getElementById(id);
        return el ? el.value : defaultVal;
      };

      const data = {
        // Cấu hình các trường ngày theo từng cột
        phatSinhDateField: getSelectVal('rs_phatSinhDateField', cachedReportRules.phatSinhDateField || 'ngayMoHs'),
        daDuyetDateField: getSelectVal('rs_daDuyetDateField', cachedReportRules.daDuyetDateField || 'ngayMoHs'),
        chuyenDnttDateField: getSelectVal('rs_chuyenDnttDateField', cachedReportRules.chuyenDnttDateField || 'ngayNhanDuHoSo'),
        carplaDateField: getSelectVal('rs_carplaDateField', cachedReportRules.carplaDateField || 'toTrinhNgayDuyet'),
        tndsTonDateField: getSelectVal('rs_tndsTonDateField', cachedReportRules.tndsTonDateField || 'none'),
        hsTonDateField: getSelectVal('rs_hsTonDateField', cachedReportRules.hsTonDateField || 'ngayMoHs'),
        hsDpbtDateField: getSelectVal('rs_hsDpbtDateField', cachedReportRules.hsDpbtDateField || 'none'),
        avgAmountDateField: getSelectVal('rs_avgAmountDateField', cachedReportRules.avgAmountDateField || 'toTrinhNgayDuyet'),

        // Cấu hình trạng thái và ngưỡng đếm
        phatSinhExcludes: getChecked('rs_phatSinhExcludes_chk'),
        approvedStatuses: getChecked('rs_approvedStatuses_chk'),
        chuyenDnttStatuses: getChecked('rs_chuyenDnttStatuses_chk'),
        carplaKeywords: (document.getElementById('rs_carplaKeywords')?.value || 'carpla').trim(),
        tndsKeywords: (document.getElementById('rs_tndsKeywords')?.value || 'tnds,trách nhiệm dân sự').trim(),
        unpaidStatuses: getChecked('rs_unpaidStatuses_chk'),
        hsTonDays: parseInt(String(document.getElementById('rs_hsTonDays')?.value || '30').replace(/[^0-9]/g, ''), 10) || 30,
        onlyApprovedStatuses: getChecked('rs_onlyApprovedStatuses_chk'),
        hsDpbtAmount: parseInt(String(document.getElementById('rs_hsDpbtAmount')?.value || '50000000').replace(/[^0-9]/g, ''), 10) || 50000000,
        hsDpbtStatuses: getChecked('rs_hsDpbtStatuses_chk'),
        avgAmount: parseInt(String(document.getElementById('rs_avgAmount')?.value || '10000000').replace(/[^0-9]/g, ''), 10) || 10000000
      };
      
      const btn = document.querySelector('#reportSettingsModal .btn-primary');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = 'Đang lưu cấu hình...';
      }
      
      try {
        // Cập nhật ngay bộ nhớ đệm tại client
        if (!cachedReportRules) cachedReportRules = {};
        cachedReportRules = { ...cachedReportRules, ...data };

        // Lưu cấu hình vào Firebase bằng .update để giữ lại carplaExcludedClaims
        await dbNodeInstance.ref('settings/reportRules').update(data);
        triggerToast('Lưu cấu hình logic báo cáo thành công!', 'success');
        
        const modal = document.getElementById('reportSettingsModal');
        if (modal) modal.remove();

        // Render lại trang báo cáo ngay lập tức
        if (activeDashboardTab === 'gdv_report') {
          renderGdvMonthlyReportPage();
        }
      } catch (err) {
        console.error(err);
        triggerToast('Lỗi khi lưu cấu hình: ' + err.message, 'error');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = 'Lưu Tất Cả Cài Đặt';
        }
      }
    }


    function getGdvKpiProgressMetrics() {
      const now = new Date();
      const repMonth = activeGdvReportMonth !== 'all' ? parseInt(activeGdvReportMonth, 10) : (now.getMonth() + 1);
      const repYear = parseInt(activeGdvReportYear, 10) || now.getFullYear();
      const totalDaysInMonth = new Date(repYear, repMonth, 0).getDate();

      const isCurrentMonth = (repYear === now.getFullYear() && repMonth === (now.getMonth() + 1));
      const isPastMonth = (repYear < now.getFullYear() || (repYear === now.getFullYear() && repMonth < (now.getMonth() + 1)));

      let daysPassed = totalDaysInMonth;
      if (isPastMonth) {
        daysPassed = totalDaysInMonth;
      } else if (isCurrentMonth) {
        daysPassed = Math.min(totalDaysInMonth, Math.max(1, now.getDate()));
        if (activeGdvReportEndDate) {
          const endD = parseYmdToLocalDate(activeGdvReportEndDate, true);
          if (endD && endD.getFullYear() === repYear && (endD.getMonth() + 1) === repMonth) {
            daysPassed = Math.min(totalDaysInMonth, Math.max(1, endD.getDate()));
          }
        }
      } else {
        daysPassed = 1;
      }

      const monthlyTarget = 70;
      const progressTarget = Math.round(((monthlyTarget / totalDaysInMonth) * daysPassed) * 10) / 10;
      const progressRatio = Math.round((daysPassed / totalDaysInMonth) * 100);

      return {
        monthlyTarget,
        totalDaysInMonth,
        daysPassed,
        progressTarget,
        progressRatio,
        isCurrentMonth,
        isPastMonth,
        repMonth,
        repYear
      };
    }
