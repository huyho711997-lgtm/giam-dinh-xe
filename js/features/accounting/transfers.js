

    // Helper to safely get input element value
    function getAccInputValue(id) {
      const el = document.getElementById(id);
      return el ? el.value.trim() : '';
    }


    // Helper to extract Owner / Driver name cleanly
    function extractClaimOwnerName(c) {
      if (!c) return 'N/A';
      const name = c.khachHang || c.tenChuXe || c.chuXe || c.tenKhachHang || c.hoTenChuXe || c.laiXe || c.tenLaiXe || c.hoTenLaiXe || c.nguoiYeuCauBT || c.nguoiLienHe || '';
      if (!name || name === '—' || name.trim() === '' || name.trim() === 'N/A') return 'N/A';
      return name.trim();
    }


    // Helper to get name initials for user avatar badge
    function getAccUserInitials(nameStr) {
      if (!nameStr) return 'GDV';
      const parts = nameStr.trim().split(/\s+/);
      if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }


    // Helper to AUTO-DETECT user role from logged-in account profile
    function getLoggedInUserAccountingRole() {
      if (!activeUserProfile) return 'gdv';
      const roleStr = String(activeUserProfile.role || '').toLowerCase().trim();
      const emailStr = String(activeUserProfile.email || firebase.auth().currentUser?.email || '').toLowerCase().trim();
      
      if (roleStr.includes('kế toán') || roleStr.includes('ke toan') || roleStr.includes('ketoan') || roleStr.includes('accounting') || roleStr.includes('admin') || emailStr.includes('ketoan')) {
        return 'ketoan';
      }
      return 'gdv';
    }


    function setAccClaimsPage(page) {
      accClaimsCurrentPage = page;
      renderAccountingClaimsPage();
    }


    function setAccClaimsPerPage(perPage) {
      accClaimsPerPage = perPage;
      accClaimsCurrentPage = 1;
      renderAccountingClaimsPage();
    }


    function toggleAccCustomPerPageDropdown(evt) {
      if (evt) evt.stopPropagation();
      const menu = document.getElementById('menuAccCustomPerPageDropdown');
      if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }


    function getAccountingClaimInputId(transferId, claimIndex) {
      return 'accountingClaimNote_' + encodeURIComponent(transferId || '') + '_' + claimIndex;
    }


        /* CUSTOM ACCOUNTING CLAIM STATUS FILTER DROPDOWN CONTROLLER */
    function toggleAccClaimStatusFilterDropdown(evt) {
      if (evt) evt.stopPropagation();
      const menu = document.getElementById('accClaimStatusFilterMenu');
      const arrow = document.getElementById('accClaimFilterChevron');
      if (!menu) return;
      
      const isVis = menu.style.display === 'block';
      menu.style.display = isVis ? 'none' : 'block';
      if (arrow) arrow.style.transform = isVis ? 'rotate(0deg)' : 'rotate(180deg)';
    }


    function selectAccClaimStatusFilterOption(statusVal) {
      activeAccountingClaimStatus = statusVal;
      const menu = document.getElementById('accClaimStatusFilterMenu');
      const arrow = document.getElementById('accClaimFilterChevron');
      if (menu) menu.style.display = 'none';
      if (arrow) arrow.style.transform = 'rotate(0deg)';
      renderAccountingClaimsPage();
    }


    function toggleAccClaimsStatusFilterDropdown(e) {
      if (e) e.stopPropagation();
      activeOpenDropdownId = activeOpenDropdownId === 'ddAccClaimsStatusFilter' ? null : 'ddAccClaimsStatusFilter';
      renderAccountingClaimsPage();
    }


    function changeAccountingClaimFilter(status) {
      activeAccountingClaimStatus = status;
      activeOpenDropdownId = null;
      accClaimsCurrentPage = 1;
      renderAccountingClaimsPage();
    }


    function changeAccountingClaimSearch(text) {
      activeAccountingClaimSearchRaw=text;
      clearTimeout(accountingSearchTimeout);
      accountingSearchTimeout=setTimeout(()=>{
        const oldInput=document.getElementById('accountingSearchInput');
        const restoreFocus=document.activeElement===oldInput;
        const start=oldInput?.selectionStart,end=oldInput?.selectionEnd;
        activeAccountingClaimSearch=(text||'').toLowerCase().trim();
        accClaimsCurrentPage=1;
        if(activeDashboardTab!=='accounting_claims') return;
        renderAccountingClaimsPage();
        if(restoreFocus){
          const input=document.getElementById('accountingSearchInput');
          input?.focus({preventScroll:true});
          if(input && start!==null && end!==null) input.setSelectionRange(start,end);
        }
      },500);
    }


    function changeAccountingStatusFilter(status) {
      activeAccountingStatusFilter = status;
      const menu = document.getElementById('menuAccTransfersStatusFilterDropdown');
      const wrapper = document.getElementById('btnAccTransfersStatusFilterDropdown');
      if (menu) menu.style.display = 'none';
      if (wrapper) {
          const arrow = wrapper.querySelector('svg');
          if (arrow) arrow.style.transform = 'rotate(0deg)';
      }
      accTransfersCurrentPage = 1;
      renderAccountingTransferPage();
    }


    function toggleAccTransfersStatusFilterDropdown(e) {
      if (e) e.stopPropagation();
      const menu = document.getElementById('menuAccTransfersStatusFilterDropdown');
      const wrapper = document.getElementById('btnAccTransfersStatusFilterDropdown');
      if (!menu) return;
      const isVisible = menu.style.display === 'block';
      
      if (typeof closeAllCustomDropdowns === 'function') closeAllCustomDropdowns();
      
      const menuClaim = document.getElementById('menuAccCustomPerPageDropdown');
      if (menuClaim) menuClaim.style.display = 'none';
      const menuT = document.getElementById('menuAccTransfersCustomPerPageDropdown');
      if (menuT) menuT.style.display = 'none';
      
      if (!isVisible) {
        menu.style.display = 'block';
        if (wrapper) {
            const arrow = wrapper.querySelector('svg');
            if (arrow) arrow.style.transform = 'rotate(180deg)';
        }
      } else {
        menu.style.display = 'none';
        if (wrapper) {
            const arrow = wrapper.querySelector('svg');
            if (arrow) arrow.style.transform = 'rotate(0deg)';
        }
      }
    }


    function changeAccountingSearch(text) {
      activeAccountingSearchRaw = text;
      clearTimeout(accountingTransferSearchTimeout);
      accountingTransferSearchTimeout = setTimeout(() => {
        const previousInput = document.getElementById('accountingTransferSearchInput');
        const restoreFocus = document.activeElement === previousInput;
        const start = previousInput?.selectionStart;
        const end = previousInput?.selectionEnd;
        activeAccountingSearch = (text || '').toLowerCase().trim();
        accTransfersCurrentPage = 1;
        if (activeDashboardTab !== 'accounting_transfer') return;
        renderAccountingTransferPage();
        if (restoreFocus) {
          const input = document.getElementById('accountingTransferSearchInput');
          input?.focus({preventScroll:true});
          if (input && start !== null && end !== null) input.setSelectionRange(start,end);
        }
      },500);
    }


    function setAccTransfersPage(page) {
      accTransfersCurrentPage = page;
      renderAccountingTransferPage();
    }


    function setAccTransfersPerPage(num) {
      accTransfersPerPage = num;
      accTransfersCurrentPage = 1;
      renderAccountingTransferPage();
    }


    function toggleAccTransfersCustomPerPageDropdown(e) {
      if (e) e.stopPropagation();
      const menu = document.getElementById('menuAccTransfersCustomPerPageDropdown');
      const wrapper = document.getElementById('btnAccTransfersCustomPerPageDropdown');
      if (!menu) return;
      const isVisible = menu.style.display === 'block';
      
      // Attempt to close other dropdowns safely
      if (typeof closeAllCustomDropdowns === 'function') {
        closeAllCustomDropdowns();
      }
      const menuClaim = document.getElementById('menuAccCustomPerPageDropdown');
      if (menuClaim) menuClaim.style.display = 'none';
      
      if (!isVisible) {
        menu.style.display = 'block';
        if (wrapper) {
            const arrow = wrapper.querySelector('svg');
            if (arrow) arrow.style.transform = 'rotate(180deg)';
        }
      } else {
        menu.style.display = 'none';
        if (wrapper) {
            const arrow = wrapper.querySelector('svg');
            if (arrow) arrow.style.transform = 'rotate(0deg)';
        }
      }
    }


    
    /* REAL-TIME NOTIFICATIONS & DEEP LINKING HELPER */
    async function sendAppNotification(targetRole, targetUserIdentifier, title, message, transferId, claimIndex, soHoSoBoiThuong, bienSo, notifType) {
      try {
        const notifObj = {
          id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          targetRole: targetRole || '',
          targetUserIdentifier: targetUserIdentifier || '',
          title: title || 'Thông báo mới',
          message: message || '',
          transferId: transferId || '',
          claimIndex: Number(claimIndex || 0),
          soHoSoBoiThuong: soHoSoBoiThuong || '',
          bienSo: bienSo || '',
          notifType: notifType || 'general',
          read: false,
          timestamp: Date.now()
        };
        await dbNodeInstance.ref('system_notifications/' + notifObj.id).set(notifObj);
      } catch (e) {
        console.error('Failed to send realtime notification:', e);
      }
    }


    function initRealtimeNotificationsListener() {
      if (!dbNodeInstance) return;
      dbNodeInstance.ref('system_notifications').on('value', (snapshot) => {
        const data = snapshot.val() || {};
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) return;

        const myRole = getLoggedInUserAccountingRole();
        const myName = String(activeUserProfile?.fullName || activeUserProfile?.displayName || currentUser.displayName || '').trim().toLowerCase();
        const myEmail = String(currentUser.email || '').trim().toLowerCase();

        const unreadList = Object.values(data).filter(n => {
          if (n.read) return false;
          const targetRole = String(n.targetRole || '').toLowerCase();
          const targetUser = String(n.targetUserIdentifier || '').toLowerCase();
          
          if (targetRole && targetRole === myRole) return true;
          if (targetUser && (myName.includes(targetUser) || targetUser.includes(myName) || targetUser === myEmail)) return true;
          return false;
        }).sort((a,b) => b.timestamp - a.timestamp);

        const activeBanner = document.getElementById('appNotificationBanner');
        if (unreadList.length > 0) {
          const latest = unreadList[0];
          if (!activeBanner) {
            triggerToast('🔔 ' + latest.title + ': ' + latest.message, 'warning');
          }
        }
      });
    }


        function getAccountingClaimsFlatList() {
      const items = [];
      Object.values(cachedAccountingTransfersPayload || {}).forEach(t => {
        // Show claims if transfer has been confirmed/submitted (da_xac_nhan, da_nhan_du_ho_so, da_trinh_dntt, can_bo_sung, cho_xac_nhan)
        let claims = t.danhSachHoSo || [];
        if (!claims.length && (t.soHoSoBoiThuong || t.bienSo)) claims = [t];
        claims.forEach((claim, claimIndex) => {
          const note = (t.ghiChuTheoHoSo || []).find(item => Number(item.chiSo) === claimIndex) ||
            (t.hoSoYeuCauBoSung || []).find(item => Number(item.chiSo) === claimIndex) || {};
          items.push({ transfer: t, claim, claimIndex, note });
        });
      });
      const getEffectivePriority = (item) => {
        if (!item.claim.isUuTien) return false;
        const liveClaim = Object.values(cachedPendingClaimsPayload || {}).find(c => c.id === item.claim.id || (item.claim.soHoSoBoiThuong && c.soHoSoBoiThuong === item.claim.soHoSoBoiThuong)) || item.claim;
        if (liveClaim.trangThai === 'da_thanh_toan') return false;
        
        const suppList = item.transfer.hoSoYeuCauBoSung || [];
        const isClaimBoSung = suppList.some(s => Number(s.chiSo) === Number(item.claimIndex) || (s.soHoSoBoiThuong && s.soHoSoBoiThuong === item.claim.soHoSoBoiThuong) || (s.bienSo && s.bienSo === item.claim.bienSo)) || item.claim.trangThaiBoSung === 'yeu_cau_bo_sung';
        if (isClaimBoSung) return false;
        
        return true;
      };

      return items.sort((a, b) => {
        // Priority claims first!
        const aPriority = getEffectivePriority(a);
        const bPriority = getEffectivePriority(b);
        if (aPriority && !bPriority) return -1;
        if (!aPriority && bPriority) return 1;
        return (b.transfer.ngayBanGiao || 0) - (a.transfer.ngayBanGiao || 0);
      });
    }


    function renderAccountingClaimsPage(targetContainer) {
      const container = targetContainer || document.getElementById('tabContentContainer');
      if (!container) return;
      
      const activeAccountingRoleMode = getLoggedInUserAccountingRole();
      const isKeToanOrAdmin = activeAccountingRoleMode === 'ketoan' || (activeUserProfile && String(activeUserProfile.role || '').trim().toLowerCase() === 'admin');

      const allItems = getAccountingClaimsFlatList();
      // Show claims from confirmed or active transfers
      const confirmedTransfers = ['da_xac_nhan', 'da_nhan_du_ho_so', 'da_trinh_dntt', 'can_bo_sung'];
      const activeItems = allItems.filter(item => confirmedTransfers.includes(item.transfer.trangThai));

      // Calculate statistics
      const statTotal = activeItems.length;
      const statDaXacNhan = activeItems.filter(item => {
        const suppList = item.transfer.hoSoYeuCauBoSung || [];
        const isClaimBoSung = suppList.some(s => Number(s.chiSo) === Number(item.claimIndex) || (s.soHoSoBoiThuong && s.soHoSoBoiThuong === item.claim.soHoSoBoiThuong) || (s.bienSo && s.bienSo === item.claim.bienSo)) || item.claim.trangThaiBoSung === 'yeu_cau_bo_sung';
        return !isClaimBoSung && (item.transfer.trangThai === 'da_xac_nhan' || item.transfer.trangThai === 'da_nhan_du_ho_so');
      }).length;

      const statCanBoSung = activeItems.filter(item => {
        const suppList = item.transfer.hoSoYeuCauBoSung || [];
        const isClaimBoSung = suppList.some(s => Number(s.chiSo) === Number(item.claimIndex) || (s.soHoSoBoiThuong && s.soHoSoBoiThuong === item.claim.soHoSoBoiThuong) || (s.bienSo && s.bienSo === item.claim.bienSo)) || item.claim.trangThaiBoSung === 'yeu_cau_bo_sung';
        return isClaimBoSung || item.transfer.trangThai === 'can_bo_sung';
      }).length;

      const statTrinhDntt = activeItems.filter(item => item.transfer.trangThai === 'da_trinh_dntt').length;

      let items = activeItems.filter(item => {
        if (activeAccountingClaimStatus === 'all') return true;
        if (activeAccountingClaimStatus === 'da_xac_nhan') return item.transfer.trangThai === 'da_xac_nhan' || item.transfer.trangThai === 'da_nhan_du_ho_so';
        if (activeAccountingClaimStatus === 'can_bo_sung') {
          const suppList = item.transfer.hoSoYeuCauBoSung || [];
          return suppList.some(s => Number(s.chiSo) === Number(item.claimIndex) || (s.soHoSoBoiThuong && s.soHoSoBoiThuong === item.claim.soHoSoBoiThuong) || (s.bienSo && s.bienSo === item.claim.bienSo)) || item.claim.trangThaiBoSung === 'yeu_cau_bo_sung' || item.transfer.trangThai === 'can_bo_sung';
        }
        return item.transfer.trangThai === activeAccountingClaimStatus;
      });

      if (activeAccountingClaimSearch) {
        const hasSeparator = /[,\n\t;]/.test(activeAccountingClaimSearch);
        const spaceTerms = activeAccountingClaimSearch.split(/\s+/).filter(Boolean);
        const isSpaceBatch = spaceTerms.length > 1 && spaceTerms.every(t => /\d/.test(t));
        
        let searchTerms = [activeAccountingClaimSearch];
        if (hasSeparator) {
          searchTerms = activeAccountingClaimSearch.split(/[,\n\t;]+/).map(t => t.trim()).filter(Boolean);
        } else if (isSpaceBatch) {
          searchTerms = spaceTerms.map(t => t.trim());
        }
        
        if (searchTerms.length > 0) {
          items = items.filter(item => {
            return searchTerms.some(term => {
              return [
                item.transfer.transferId, item.transfer.gdvName, item.claim.bienSo, item.claim.soHoSoBoiThuong,
                item.claim.tenGara, extractClaimOwnerName(item.claim), item.note.ghiChu
              ].some(value => String(value || '').toLowerCase().includes(term));
            });
          });
        }
      }

      const totalFilteredCount = items.length;
      const totalPages = Math.ceil(totalFilteredCount / accClaimsPerPage) || 1;
      if (accClaimsCurrentPage > totalPages) accClaimsCurrentPage = totalPages;

      const startIndex = (accClaimsCurrentPage - 1) * accClaimsPerPage;
      const paginatedItems = items.slice(startIndex, startIndex + accClaimsPerPage);
      
      const displayStart = totalFilteredCount === 0 ? 0 : startIndex + 1;
      const displayEnd = Math.min(startIndex + accClaimsPerPage, totalFilteredCount);

      container.innerHTML = `


        <div class="accounting-claims-page" style="padding: 24px 28px; max-width: 100%; margin: 0 auto;">
          
          <!-- HERO BANNER HEADER -->
          <div class="transfer-page-hero" style="background: linear-gradient(145deg, rgba(216,180,109,0.04) 0%, rgba(216,180,109,0.1) 100%), var(--surface); border: 1px solid rgba(216,180,109,0.25); border-radius: 20px; padding: 24px 32px; margin-bottom: 24px; box-shadow: 0 8px 30px -8px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.08); position: relative; overflow: hidden; backdrop-filter: blur(20px);">
            <!-- Decorative Orbs -->
            <div style="position: absolute; right: -50px; top: -50px; width: 300px; height: 300px; background: radial-gradient(circle, rgba(216,180,109,0.2) 0%, rgba(0,0,0,0) 70%); border-radius: 50%; pointer-events: none; filter: blur(24px);"></div>
            <div style="position: absolute; left: 5%; bottom: -60px; width: 250px; height: 250px; background: radial-gradient(circle, rgba(16,185,129,0.1) 0%, rgba(0,0,0,0) 70%); border-radius: 50%; pointer-events: none; filter: blur(20px);"></div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; position: relative; z-index: 2;">
              <div class="transfer-page-hero-copy" style="flex: 1; min-width: 320px;">
                <div style="display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px; background: rgba(216,180,109,0.12); border: 1px solid rgba(216,180,109,0.3); border-radius: 16px; font-size: 11px; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px;">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                  Hồ sơ Kế toán
                </div>
                <h1 style="font-size: 28px; font-weight: 900; background: linear-gradient(135deg, var(--text-main) 0%, #9ca3af 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0 0 10px 0; letter-spacing: -0.02em; line-height: 1.2;">
                  Quản lý hồ sơ đã nhận
                </h1>
                <p style="font-size: 13px; color: var(--text-soft); margin: 0; max-width: 800px; line-height: 1.5;">
                  Quản lý toàn bộ hồ sơ đã bàn giao từ Giám định viên, theo dõi tiến độ xét duyệt & gửi yêu cầu bổ sung.
                </p>
              </div>
              <!-- Export Action Area -->
              <div style="display: flex; align-items: center; gap: 12px;">
                ${hasUserPermission('accounting', 'export') ? `
                  <button type="button" onclick="exportAccountingClaimsToExcel()" style="padding: 0 20px; height: 44px; font-size: 13.5px; border-radius: 12px; font-weight: 850; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; border: none; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; box-shadow: 0 6px 16px rgba(16,185,129,0.3), inset 0 2px 0 rgba(255,255,255,0.2); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); transform-origin: center;" onmouseover="this.style.transform='translateY(-2px) scale(1.02)'; this.style.boxShadow='0 10px 20px rgba(16,185,129,0.4), inset 0 2px 0 rgba(255,255,255,0.3)'" onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 6px 16px rgba(16,185,129,0.3), inset 0 2px 0 rgba(255,255,255,0.2)'">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    <span>Xuất dữ liệu</span>
                  </button>
                ` : ''}
              </div>
            </div>
          </div>

          ${renderAccountingClaimsMetrics({total:statTotal,confirmed:statDaXacNhan,supplement:statCanBoSung,submitted:statTrinhDntt})}

          ${renderClaimsRegister({rows:paginatedItems,summary:{total:statTotal,confirmed:statDaXacNhan,supplement:statCanBoSung,submitted:statTrinhDntt},startIndex,displayStart,displayEnd,totalCount:totalFilteredCount,page:accClaimsCurrentPage,totalPages})}

        </div>`;
      syncAdminSelects(container);
    }


        function openAccountingClaimDetailModal(transferId, claimIndex) {
      const transfer = cachedAccountingTransfersPayload[transferId];
      if (!transfer) return;

      let claims = transfer.danhSachHoSo || [];
      if (!claims.length && (transfer.soHoSoBoiThuong || transfer.bienSo)) claims = [transfer];
      const claim = claims[claimIndex];
      if (!claim) return;

      const suppList = transfer.hoSoYeuCauBoSung || [];
      const suppItem = suppList.find(s => Number(s.chiSo) === Number(claimIndex) || (s.soHoSoBoiThuong && s.soHoSoBoiThuong === claim.soHoSoBoiThuong) || (s.bienSo && s.bienSo === claim.bienSo));
      
      const isKeToanRole = getLoggedInUserAccountingRole() === 'ketoan' || (activeUserProfile && String(activeUserProfile.role || '').trim().toLowerCase() === 'admin');
      const currentUser = firebase.auth().currentUser;
      const userName = String(activeUserProfile?.fullName || activeUserProfile?.displayName || currentUser?.displayName || currentUser?.email || 'Thành viên').trim();

      const currentNoiDungBS = claim.noiDungBoSung || (suppItem ? suppItem.ghiChu : '');
      const isClaimBoSung = Boolean(currentNoiDungBS) && claim.trangThaiBoSung !== 'da_duyet';
      const isClaimBoSungDone = claim.trangThaiBoSung === 'da_bo_sung';
      const isPriority = Boolean(claim.isUuTien);

      const historyList = claim.lichSuTuongTac || [];

      closeAccountingClaimDetailModal();
      const modalOverlay = document.createElement('div');
      modalOverlay.id = 'accountingClaimDetailModalOverlay';
      modalOverlay.className='transfer-review-overlay accounting-claim-overlay';
      modalOverlay.innerHTML=renderAccountingClaimDetailView({transfer,claim,transferId,claimIndex,currentNote:currentNoiDungBS,isKeToanRole,isClaimBoSung,isClaimBoSungDone,isPriority,history:historyList});

      document.body.appendChild(modalOverlay);
      activateAccountingClaimDialog(modalOverlay);
    }


    function closeAccountingClaimDetailModal() {
      const el = document.getElementById('accountingClaimDetailModalOverlay');
      if(el){
        document.body.style.overflow=el.claimDetailPreviousOverflow ?? '';
        const previousFocus=el.claimDetailPreviousFocus;
        el.remove();
        if(previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
      }
    }


    /* CLAIM SUPPLEMENT INTERACTION ACTIONS */
    async function submitClaimSupplementRequest(transferId, claimIndex) {
      const noteVal = (document.getElementById('modalAccountingClaimNoteInput')?.value || '').trim();
      if (!noteVal) {
        triggerToast('Vui lòng nhập nội dung cần bổ sung!', 'warning');
        return;
      }
      const transfer = cachedAccountingTransfersPayload[transferId];
      if (!transfer) return;
      let claims = transfer.danhSachHoSo || [];
      if (!claims.length && (transfer.soHoSoBoiThuong || transfer.bienSo)) claims = [transfer];
      const claim = claims[claimIndex];
      if (!claim) return;

      const currentUser = firebase.auth().currentUser;
      const userName = String(activeUserProfile?.fullName || activeUserProfile?.displayName || currentUser?.displayName || 'Kế toán').trim();

      const newLog = {
        time: Date.now(),
        user: userName,
        action: 'Yêu cầu bổ sung',
        detail: noteVal
      };

      const history = claim.lichSuTuongTac || [];
      history.unshift(newLog);

      try {
        await dbNodeInstance.ref('accounting_transfers/' + transferId + '/danhSachHoSo/' + claimIndex + '/noiDungBoSung').set(noteVal);
        await dbNodeInstance.ref('accounting_transfers/' + transferId + '/danhSachHoSo/' + claimIndex + '/trangThaiBoSung').set('yeu_cau_bo_sung');
        await dbNodeInstance.ref('accounting_transfers/' + transferId + '/danhSachHoSo/' + claimIndex + '/lichSuTuongTac').set(history);

        // Dispatch instant notification to managing GĐV!
        await sendAppNotification('gdv', transfer.gdvName, 'Cần bổ sung hồ sơ ' + (claim.bienSo || ''), 'Kế toán yêu cầu: ' + noteVal, transferId, claimIndex, claim.soHoSoBoiThuong, claim.bienSo, 'supplement_request');

        triggerToast('Đã gửi Yêu cầu bổ sung & phát thông báo thời gian thực đến GĐV!', 'success');
        closeAccountingClaimDetailModal();
        renderAccountingClaimsPage();
      } catch (err) {
        console.error(err);
        triggerToast('Lỗi gửi yêu cầu bổ sung: ' + err.message, 'error');
      }
    }


    async function deleteClaimSupplementRequest(transferId, claimIndex) {
      const transfer = cachedAccountingTransfersPayload[transferId];
      if (!transfer) return;
      let claims = transfer.danhSachHoSo || [];
      if (!claims.length && (transfer.soHoSoBoiThuong || transfer.bienSo)) claims = [transfer];
      const claim = claims[claimIndex];
      if (!claim) return;

      const currentUser = firebase.auth().currentUser;
      const userName = String(activeUserProfile?.fullName || activeUserProfile?.displayName || currentUser?.displayName || 'Kế toán').trim();

      const newLog = {
        time: Date.now(),
        user: userName,
        action: 'Xóa yêu cầu bổ sung',
        detail: 'Đã hủy bỏ yêu cầu bổ sung cho hồ sơ này'
      };

      const history = claim.lichSuTuongTac || [];
      history.unshift(newLog);

      try {
        await dbNodeInstance.ref('accounting_transfers/' + transferId + '/danhSachHoSo/' + claimIndex + '/noiDungBoSung').set('');
        await dbNodeInstance.ref('accounting_transfers/' + transferId + '/danhSachHoSo/' + claimIndex + '/trangThaiBoSung').set('binh_thuong');
        await dbNodeInstance.ref('accounting_transfers/' + transferId + '/danhSachHoSo/' + claimIndex + '/lichSuTuongTac').set(history);

        triggerToast('Đã xóa Yêu cầu bổ sung!', 'success');
        closeAccountingClaimDetailModal();
        renderAccountingClaimsPage();
      } catch (err) {
        console.error(err);
        triggerToast('Lỗi xóa yêu cầu bổ sung: ' + err.message, 'error');
      }
    }


    async function approveClaimSupplementRequest(transferId, claimIndex) {
      const transfer = cachedAccountingTransfersPayload[transferId];
      if (!transfer) return;
      let claims = transfer.danhSachHoSo || [];
      if (!claims.length && (transfer.soHoSoBoiThuong || transfer.bienSo)) claims = [transfer];
      const claim = claims[claimIndex];
      if (!claim) return;

      const currentUser = firebase.auth().currentUser;
      const userName = String(activeUserProfile?.fullName || activeUserProfile?.displayName || currentUser?.displayName || 'Kế toán').trim();

      const newLog = {
        time: Date.now(),
        user: userName,
        action: 'Duyệt yêu cầu BS',
        detail: 'Đã duyệt hồ sơ hoàn tất chứng từ bổ sung'
      };

      const history = claim.lichSuTuongTac || [];
      history.unshift(newLog);

      try {
        await dbNodeInstance.ref('accounting_transfers/' + transferId + '/danhSachHoSo/' + claimIndex + '/trangThaiBoSung').set('da_duyet');
        await dbNodeInstance.ref('accounting_transfers/' + transferId + '/danhSachHoSo/' + claimIndex + '/lichSuTuongTac').set(history);

        triggerToast('Đã duyệt yêu cầu bổ sung cho hồ sơ!', 'success');
        closeAccountingClaimDetailModal();
        renderAccountingClaimsPage();
      } catch (err) {
        console.error(err);
        triggerToast('Lỗi duyệt bổ sung: ' + err.message, 'error');
      }
    }


    async function confirmClaimSupplementFulfilledByGdv(transferId, claimIndex) {
      const transfer = cachedAccountingTransfersPayload[transferId];
      if (!transfer) return;
      let claims = transfer.danhSachHoSo || [];
      if (!claims.length && (transfer.soHoSoBoiThuong || transfer.bienSo)) claims = [transfer];
      const claim = claims[claimIndex];
      if (!claim) return;

      const currentUser = firebase.auth().currentUser;
      const userName = String(activeUserProfile?.fullName || activeUserProfile?.displayName || currentUser?.displayName || 'Giám định viên').trim();

      const newLog = {
        time: Date.now(),
        user: userName,
        action: 'Xác nhận đã bổ sung',
        detail: 'Đã bổ sung chứng từ theo yêu cầu Kế toán'
      };

      const history = claim.lichSuTuongTac || [];
      history.unshift(newLog);

      try {
        await dbNodeInstance.ref('accounting_transfers/' + transferId + '/danhSachHoSo/' + claimIndex + '/trangThaiBoSung').set('da_bo_sung');
        await dbNodeInstance.ref('accounting_transfers/' + transferId + '/danhSachHoSo/' + claimIndex + '/lichSuTuongTac').set(history);

        // Dispatch instant notification to Kế toán!
        await sendAppNotification('ketoan', '', 'GĐV đã bổ sung hồ sơ ' + (claim.soHoSoBoiThuong || claim.bienSo), 'Giám định viên ' + userName + ' đã bổ sung yêu cầu cho hồ sơ ' + (claim.bienSo || '') + ' (HSBT: ' + (claim.soHoSoBoiThuong || '') + ').', transferId, claimIndex, claim.soHoSoBoiThuong, claim.bienSo, 'supplement_fulfilled');

        triggerToast('Đã xác nhận hoàn tất bổ sung & thông báo ngay cho Kế toán!', 'success');
        closeAccountingClaimDetailModal();
        renderAccountingClaimsPage();
      } catch (err) {
        console.error(err);
        triggerToast('Lỗi xác nhận đã bổ sung: ' + err.message, 'error');
      }
    }


    /* RENDER MAIN OVERVIEW PAGE - AUTO ROLE IDENTIFICATION (MANUAL ROLE TOGGLE REMOVED) */
        
    /* DELETE ACCOUNTING TRANSFER BATCH FUNCTION */
    async function deleteAccountingTransferBatch(transferId) {
      const isAdmin = activeUserProfile && (
        String(activeUserProfile.role || '').trim().toLowerCase() === 'admin' ||
        activeUserProfile.isAdmin === true
      );

      if (!isAdmin && !hasUserPermission('accounting', 'create')) {
        triggerToast('Bạn không có quyền xóa phiếu bàn giao.', 'error');
        return;
      }
      if (!transferId) return;
      
      const t = cachedAccountingTransfersPayload[transferId];
      if (!isAdmin) {
        if (t && t.gdvUid && t.gdvUid !== firebase.auth().currentUser?.uid) {
          triggerToast('Chỉ có người tạo phiếu mới được quyền xóa phiếu này!', 'warning');
          return;
        }
        if (t && (t.trangThai === 'da_xac_nhan' || t.trangThai === 'da_nhan_du_ho_so' || t.trangThai === 'da_trinh_dntt')) {
          triggerToast('Không thể xóa Phiếu bàn giao đã được xác nhận!', 'warning');
          return;
        }
      }
      const statusLabel = (t && ACCOUNTING_STATUS_MAP[t.trangThai]?.label) || t?.trangThai || '';
      const batchLabel = t ? (t.transferId + ' (' + ((t.danhSachHoSo && t.danhSachHoSo.length) || 1) + ' hồ sơ' + (statusLabel ? ' - ' + statusLabel : '') + ')') : transferId;

      const isConfirmed = await showConfirmModal(
        'Xác nhận xóa phiếu bàn giao',
        `Bạn có chắc chắn muốn xóa Phiếu bàn giao ${batchLabel} không? Hành động này không thể hoàn tác!`,
        'Đồng ý xóa',
        'Hủy bỏ'
      );
      if (!isConfirmed) return;

      try {
        await dbNodeInstance.ref('accounting_transfers/' + transferId).remove();
        if (cachedAccountingTransfersPayload && cachedAccountingTransfersPayload[transferId]) {
          delete cachedAccountingTransfersPayload[transferId];
        }
        triggerToast('Đã xóa thành công Phiếu bàn giao ' + transferId + '!', 'success');
        closeAccountingTransferModal();
        closeKeToanReviewModal();
        if (activeDashboardTab === 'accounting_claims') {
          renderAccountingClaimsPage();
        } else {
          renderAccountingTransferPage();
        }
      } catch (err) {
        console.error(err);
        triggerToast('Lỗi xóa phiếu bàn giao: ' + err.message, 'error');
      }
    }


    function renderAccountingTransferPage(targetContainer) {
      const container = targetContainer || document.getElementById('tabContentContainer');
      if (!container) return;

      const isAdmin = activeUserProfile && (
        String(activeUserProfile.role || '').trim().toLowerCase() === 'admin' ||
        activeUserProfile.isAdmin === true
      );
      const activeAccountingRoleMode = getLoggedInUserAccountingRole();
      const isKeToanOrAdmin = activeAccountingRoleMode === 'ketoan' || isAdmin;
      const currentLoggedInGdvName = String(activeUserProfile?.fullName || activeUserProfile?.displayName || activeUserProfile?.name || firebase.auth().currentUser?.displayName || '').trim().toLowerCase();

      let transfersList = Object.values(cachedAccountingTransfersPayload || {});

      // For regular Giám định viên, show transfer batches created by/assigned to themselves
      if (!isKeToanOrAdmin && currentLoggedInGdvName) {
        transfersList = transfersList.filter(t => {
          const tGdv = String(t.gdvName || '').trim().toLowerCase();
          return tGdv.includes(currentLoggedInGdvName) || currentLoggedInGdvName.includes(tGdv);
        });
      }

      // Stat counters
      const statTotal = transfersList.length;
      const statMoi = transfersList.filter(t => t.trangThai === 'moi').length;
      const statChoXacNhan = transfersList.filter(t => t.trangThai === 'cho_xac_nhan').length;
      const statDaXacNhan = transfersList.filter(t => t.trangThai === 'da_xac_nhan' || t.trangThai === 'da_nhan_du_ho_so').length;
      // Helper to check if transfer batch contains claims needing supplement
      const isTransferNeedingSupplement = t => {
        if (t.trangThai === 'can_bo_sung') return true;
        const suppList = t.hoSoYeuCauBoSung || [];
        if (suppList.length > 0) return true;
        const claims = t.danhSachHoSo || [];
        return claims.some(c => c.trangThaiBoSung === 'yeu_cau_bo_sung');
      };

      const statCanBoSung = transfersList.filter(isTransferNeedingSupplement).length;
      const statTrinhDntt = transfersList.filter(t => t.trangThai === 'da_trinh_dntt').length;
      const totalMoneyTrinhDntt = transfersList.filter(t => t.trangThai === 'da_trinh_dntt').reduce((sum, t) => sum + (parseInt(t.soTienDeNghi, 10) || 0), 0);

      // Filter list
      let filteredTransfers = transfersList;
      if (activeAccountingStatusFilter !== 'all') {
        filteredTransfers = filteredTransfers.filter(t => {
          if (activeAccountingStatusFilter === 'da_xac_nhan') return t.trangThai === 'da_xac_nhan' || t.trangThai === 'da_nhan_du_ho_so';
          if (activeAccountingStatusFilter === 'can_bo_sung') return isTransferNeedingSupplement(t);
          return t.trangThai === activeAccountingStatusFilter;
        });
      }
      if (activeAccountingSearch) {
        filteredTransfers = filteredTransfers.filter(t => {
          const kw = activeAccountingSearch;
          const matchBatchId = (t.transferId || '').toLowerCase().includes(kw);
          const matchGdv = (t.gdvName || '').toLowerCase().includes(kw);
          const matchClaims = (t.danhSachHoSo || []).some(c => 
            (c.soHoSoBoiThuong || '').toLowerCase().includes(kw) ||
            (c.bienSo || '').toLowerCase().includes(kw) ||
            (c.tenGara || '').toLowerCase().includes(kw) ||
            (extractClaimOwnerName(c)).toLowerCase().includes(kw)
          );
          const matchLegacy = (t.soHoSoBoiThuong || '').toLowerCase().includes(kw) || (t.bienSo || '').toLowerCase().includes(kw);
          return matchBatchId || matchGdv || matchClaims || matchLegacy;
        });
      }

      // Sort by date newest first
      filteredTransfers.sort((a, b) => (b.ngayBanGiao || 0) - (a.ngayBanGiao || 0));

      const totalFilteredCount = filteredTransfers.length;
      const totalPages = Math.ceil(totalFilteredCount / accTransfersPerPage) || 1;
      if (accTransfersCurrentPage > totalPages) accTransfersCurrentPage = totalPages;
      if (accTransfersCurrentPage < 1) accTransfersCurrentPage = 1;

      const startIndex = (accTransfersCurrentPage - 1) * accTransfersPerPage;
      const paginatedTransfers = filteredTransfers.slice(startIndex, startIndex + accTransfersPerPage);
      const displayStart = totalFilteredCount === 0 ? 0 : startIndex + 1;
      const displayEnd = Math.min(startIndex + accTransfersPerPage, totalFilteredCount);

      container.innerHTML = `
        <div class="accounting-transfer-page" style="padding: 24px 28px; max-width: 100%; margin: 0 auto;">
          
          <!-- HERO BANNER HEADER -->
          <div class="transfer-page-hero" style="background: linear-gradient(145deg, rgba(216,180,109,0.04) 0%, rgba(216,180,109,0.1) 100%), var(--surface); border: 1px solid rgba(216,180,109,0.25); border-radius: 20px; padding: 24px 32px; margin-bottom: 24px; box-shadow: 0 8px 30px -8px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.08); position: relative; overflow: hidden; backdrop-filter: blur(20px);">
            <!-- Decorative Orbs -->
            <div style="position: absolute; right: -50px; top: -50px; width: 300px; height: 300px; background: radial-gradient(circle, rgba(216,180,109,0.2) 0%, rgba(0,0,0,0) 70%); border-radius: 50%; pointer-events: none; filter: blur(24px);"></div>
            <div style="position: absolute; left: 5%; bottom: -60px; width: 250px; height: 250px; background: radial-gradient(circle, rgba(16,185,129,0.1) 0%, rgba(0,0,0,0) 70%); border-radius: 50%; pointer-events: none; filter: blur(20px);"></div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; position: relative; z-index: 2;">
              <div class="transfer-page-hero-copy" style="flex: 1; min-width: 320px;">
                <div style="display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px; background: rgba(216,180,109,0.12); border: 1px solid rgba(216,180,109,0.3); border-radius: 16px; font-size: 11px; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px;">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  Hệ thống Bàn giao Kế toán
                </div>
                <h1 style="font-size: 28px; font-weight: 900; background: linear-gradient(135deg, var(--text-main) 0%, #9ca3af 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0 0 10px 0; letter-spacing: -0.02em; line-height: 1.2;">
                  Quản lý Bàn giao Hồ sơ Kế toán
                </h1>
                <p style="font-size: 13px; color: var(--text-soft); margin: 0; max-width: 800px; line-height: 1.5;">
                  Bàn giao gộp nhiều hồ sơ bồi thường từ Giám định viên cho Kế toán theo quy trình: <br/>
                  <strong style="color: var(--text-main); font-weight: 700;">Mới (Nháp) <span style="color:var(--text-muted); margin:0 6px;">→</span> Chờ xác nhận <span style="color:var(--text-muted); margin:0 6px;">→</span> Đã xác nhận / Yêu cầu bổ sung <span style="color:var(--text-muted); margin:0 6px;">→</span> Đã trình ĐNTT.</strong>
                </p>
              </div>
              
              ${hasUserPermission('accounting', 'create') ? `
              <button type="button" onclick="openAddAccountingTransferModal()" style="padding: 0 20px; height: 44px; font-size: 13px; border-radius: 12px; font-weight: 850; background: linear-gradient(135deg, #d8b46d 0%, #b89243 100%); color: #000; border: none; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; box-shadow: 0 6px 16px rgba(216,180,109,0.3), inset 0 2px 0 rgba(255,255,255,0.2); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); transform-origin: center;" onmouseover="this.style.transform='translateY(-2px) scale(1.02)'; this.style.boxShadow='0 10px 20px rgba(216,180,109,0.4), inset 0 2px 0 rgba(255,255,255,0.3)'" onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 6px 16px rgba(216,180,109,0.3), inset 0 2px 0 rgba(255,255,255,0.2)'">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                <span>Tạo Phiếu Bàn giao Mới</span>
              </button>
              ` : ''}
            </div>
          </div>

          ${renderAccountingTransferMetrics({total:statTotal,pending:statChoXacNhan,confirmed:statDaXacNhan,supplement:statCanBoSung,submitted:statTrinhDntt,submittedAmount:totalMoneyTrinhDntt})}

          ${renderAccountingTransferRegister({rows:paginatedTransfers,summary:{total:statTotal,draft:statMoi,pending:statChoXacNhan,confirmed:statDaXacNhan,supplement:statCanBoSung,submitted:statTrinhDntt},startIndex,displayStart,displayEnd,totalCount:totalFilteredCount,page:accTransfersCurrentPage,totalPages,isAdmin})}

        </div>
      `;
      syncAdminSelects(container);
    }


    /* MODAL 1: GĐV TẠO / SỬA / BỔ SUNG PHIẾU BÀN GIAO */
    function openAddAccountingTransferModal(transferId) {
      const editingTransferId = transferId || '';
      let existing = null;
      if (transferId && cachedAccountingTransfersPayload[transferId]) {
        existing = cachedAccountingTransfersPayload[transferId];
      }

      // Initialize selected claims state for this batch session
      if (existing) {
        if (existing.danhSachHoSo && existing.danhSachHoSo.length > 0) {
          currentBatchSelectedClaims = JSON.parse(JSON.stringify(existing.danhSachHoSo));
          const suppList = existing.hoSoYeuCauBoSung || [];
          currentBatchSelectedClaims.forEach((item, idx) => {
            item.tenChuXe = extractClaimOwnerName(item);
            const suppItem = suppList.find(s => Number(s.chiSo) === idx || (s.soHoSoBoiThuong && s.soHoSoBoiThuong === item.soHoSoBoiThuong) || (s.bienSo && s.bienSo === item.bienSo));
            item.canBoSung = Boolean(suppItem || item.canBoSung);
            item.ghiChuBoSung = suppItem ? (suppItem.ghiChu || suppItem.ghiChuBoSung || '') : (item.ghiChuBoSung || '');
          });
        } else if (existing.soHoSoBoiThuong || existing.bienSo) {
          currentBatchSelectedClaims = [{
            claimId: existing.claimId || '',
            soHoSoBoiThuong: existing.soHoSoBoiThuong || '',
            bienSo: existing.bienSo || '',
            tenChuXe: extractClaimOwnerName(existing),
            tenGara: existing.tenGara || '',
            soTienDeNghi: existing.soTienDeNghi || 0
          }];
        }
      } else {
        currentBatchSelectedClaims = [];
      }

      // User List Generation for GĐV Bàn Giao Custom Dropdown
      const rawUserEntries = Object.values(cachedUsersPayload || {});
      let userOptionsList = rawUserEntries.map(u => u.profile?.displayName || u.displayName || u.email || '').filter(Boolean);
      userOptionsList = Array.from(new Set(userOptionsList));
      if (userOptionsList.length === 0) {
        userOptionsList = ['Huỳnh Văn Phúc', 'Hồ Quang Huy', 'Nguyễn Quang Huy_DL'];
      }

      // Active logged in user default
      const currentLoggedInName = activeUserProfile?.displayName || firebase.auth().currentUser?.displayName || firebase.auth().currentUser?.email || 'Huỳnh Văn Phúc';
      const defaultGdvVal = existing?.gdvName || currentLoggedInName;

      const currentUserId = firebase.auth().currentUser?.uid;
      const isAdmin = activeUserProfile && (
        String(activeUserProfile.role || '').trim().toLowerCase() === 'admin' ||
        activeUserProfile.isAdmin === true
      );
      const isCreator = !existing || !existing.gdvUid || existing.gdvUid === currentUserId;
      const canDeleteInModal = isAdmin || (isCreator && !['da_xac_nhan', 'da_nhan_du_ho_so', 'da_trinh_dntt'].includes(existing?.trangThai));
      const canRevertToDraft = isAdmin || isCreator;

      if (!userOptionsList.includes(defaultGdvVal)) {
        userOptionsList.unshift(defaultGdvVal);
      }

      const modalOverlay = document.createElement('div');
      modalOverlay.id = 'accountingTransferModalOverlay';
      modalOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(11, 15, 25, 0.78); backdrop-filter: blur(16px); z-index: 99999; display: grid; place-items: center; padding: 12px;';

      modalOverlay.innerHTML = `
        <div style="background: var(--surface); border: 1px solid var(--border-strong); border-radius: 24px; width: min(1560px, 98vw); height: 95vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 28px 70px rgba(0,0,0,0.55); position: relative;">
          
          <!-- FIXED HEADER WITH ACTION BUTTONS TOP RIGHT -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 18px 30px; border-bottom: 1px solid var(--border); flex-shrink: 0; background: var(--surface); z-index: 10; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, rgba(216,180,109,0.2) 0%, rgba(216,180,109,0.05) 100%); border: 1px solid rgba(216,180,109,0.4); color: var(--primary); display: grid; place-items: center; flex-shrink: 0;">
                ${ACC_SVGS.LIST}
              </div>
              <div>
                <h3 style="font-size: 20px; font-weight: 850; color: var(--text-main); margin: 0; letter-spacing: -0.01em;">
                  ${existing ? (existing.trangThai === 'can_bo_sung' ? 'Yêu cầu Bổ sung Phiếu Bàn giao Kế toán' : 'Chỉnh sửa Phiếu Bàn giao Kế toán') : '+ Tạo Phiếu Bàn giao Kế toán Mới (Gom nhiều Hồ sơ)'}
                </h3>
                <p style="font-size: 12.5px; color: var(--text-soft); margin-top: 3px; margin-bottom: 0;">
                  Không gian thao tác mở rộng · Chọn các hồ sơ ở trạng thái Đã duyệt HSBT để gộp vào 1 Phiếu bàn giao Kế toán.
                </p>
              </div>
            </div>

            <!-- ACTION BUTTONS MOVED TO HEADER TOP RIGHT -->
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              ${(editingTransferId && cachedAccountingTransfersPayload[editingTransferId]?.trangThai === 'cho_xac_nhan') ? `
                <button type="button" onclick="${canRevertToDraft ? `revertTransferToDraft('${editingTransferId}')` : `triggerToast('Chỉ có người tạo phiếu hoặc Admin mới được quyền trả lại nháp!', 'warning')`}" style="padding: 8px 16px; border-radius: 10px; font-size: 12.5px; font-weight: 850; background: ${canRevertToDraft ? 'rgba(245,158,11,0.14)' : 'var(--bg-soft)'}; color: ${canRevertToDraft ? '#f59e0b' : 'var(--text-muted)'}; border: 1px solid ${canRevertToDraft ? 'rgba(245,158,11,0.35)' : 'var(--border)'}; cursor: ${canRevertToDraft ? 'pointer' : 'not-allowed'}; display: inline-flex; align-items: center; gap: 6px; ${canRevertToDraft ? '' : 'opacity: 0.65;'}">
                  ${ACC_SVGS.REFRESH} Trả lại (Hủy gửi bàn giao)
                </button>
              ` : ''}

              ${(isCreator || isAdmin) ? `
                <button type="button" onclick="saveAccountingTransferBatchFromModal(event, '${editingTransferId || ''}', 'cho_xac_nhan')" style="padding: 8px 18px; border-radius: 10px; font-size: 12.5px; font-weight: 850; background: linear-gradient(135deg, var(--primary) 0%, #b89243 100%); color: #111111; border: none; cursor: pointer; box-shadow: 0 4px 16px rgba(216,180,109,0.35); display: inline-flex; align-items: center; gap: 6px;">
                  ${ACC_SVGS.CHECK_CIRCLE}
                  <span>Bàn giao hồ sơ cho Kế toán</span>
                </button>
              ` : `
                <button type="button" onclick="triggerToast('Chỉ có người tạo phiếu hoặc Admin mới được quyền bàn giao hồ sơ!', 'warning')" style="padding: 8px 18px; border-radius: 10px; font-size: 12.5px; font-weight: 850; background: var(--bg-soft); color: var(--text-muted); border: 1px solid var(--border); cursor: not-allowed; display: inline-flex; align-items: center; gap: 6px; opacity: 0.65;">
                  ${ACC_SVGS.CHECK_CIRCLE}
                  <span>Bàn giao hồ sơ cho Kế toán</span>
                </button>
              `}

              ${editingTransferId ? (canDeleteInModal ? `
                <button type="button" onclick="deleteAccountingTransferBatch('${editingTransferId}')" style="padding: 8px 14px; border-radius: 10px; font-size: 12px; font-weight: 850; background: rgba(239,68,68,0.12); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); cursor: pointer; display: inline-flex; align-items: center; gap: 5px;" title="Xóa phiếu bàn giao này">
                  ${ACC_SVGS.TRASH} Xóa phiếu
                </button>
              ` : `
                <button type="button" onclick="triggerToast('Chỉ có Admin hoặc người tạo phiếu mới được quyền xóa phiếu!', 'warning')" style="padding: 8px 14px; border-radius: 10px; font-size: 12px; font-weight: 850; background: var(--bg-soft); color: var(--text-muted); border: 1px solid var(--border); cursor: not-allowed; display: inline-flex; align-items: center; gap: 5px; opacity: 0.65;" title="Xóa phiếu bàn giao này">
                  ${ACC_SVGS.TRASH} Xóa phiếu
                </button>
              `) : ''}

              <button type="button" onclick="closeAccountingTransferModal()" style="background: var(--bg-soft); border: 1px solid var(--border); font-size: 18px; color: var(--text-soft); cursor: pointer; width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; transition: all 0.2s ease;">✕</button>
            </div>
          </div>

          <!-- SCROLLABLE FORM BODY -->
          <form id="frmAccountingTransferBatch" onsubmit="saveAccountingTransferBatchFromModal(event, '${transferId || ''}')" style="display: flex; flex-direction: column; flex: 1; min-height: 0; margin: 0;">
            
            <div style="flex: 1; overflow-y: auto; padding: 22px 30px;">
              
              <!-- GENERAL KE TOAN NOTE IF PRESENT -->
              ${existing && existing.trangThai === 'can_bo_sung' && existing.ghiChuKeToan ? `
                <div style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); border-radius: 14px; padding: 12px 16px; margin-bottom: 20px; color: #ef4444; display: flex; align-items: center; gap: 10px;">
                  <span>${ACC_SVGS.WARNING}</span>
                  <div style="font-size: 12.5px; line-height: 1.4;">
                    <strong style="font-weight: 850;">Ghi chú chung của Kế toán:</strong> ${escapeHtmlOutput(existing.ghiChuKeToan)}
                  </div>
                </div>
              ` : ''}

              <!-- 1. TOP META BAR: MÃ PHIẾU & GĐV BÀN GIAO -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 22px; background: var(--bg-soft); border: 1px solid var(--border-strong); border-radius: 16px; padding: 16px 20px;">
                <div>
                  <label style="display: block; font-size: 12px; font-weight: 850; color: var(--text-main); margin-bottom: 6px;">Mã Phiếu Bàn giao (*):</label>
                  <input id="accBatchTransferId" type="text" class="input-premium" value="${escapeAttributeData(existing?.transferId || ('PBG_' + Date.now()))}" readonly style="height: 44px; border-radius: 12px;  font-weight: 850; background: var(--surface); color: var(--primary);" />
                </div>
                
                <div>
                  <label style="display: block; font-size: 12px; font-weight: 850; color: var(--text-main); margin-bottom: 6px;">GĐV Bàn giao (*):</label>
                  
                  <!-- CUSTOM LUXURY USER DROPDOWN COMPONENT -->
                  <div style="position: relative;" id="accGdvDropdownWrapper">
                    <input type="hidden" id="accBatchGdvName" value="${escapeAttributeData(defaultGdvVal)}" />
                    
                    <div id="accGdvTriggerBtn" onclick="${isCreator ? 'toggleAccGdvCustomDropdown(event)' : `triggerToast('Không thể thay đổi người bàn giao của phiếu này!', 'warning')`}" style="height: 44px; border-radius: 12px; background: var(--surface); border: 1px solid var(--border); padding: 0 14px; cursor: ${isCreator ? 'pointer' : 'not-allowed'}; display: flex; align-items: center; justify-content: space-between; box-shadow: var(--shadow-sm); transition: all 0.2s ease; ${isCreator ? '' : 'opacity: 0.75;' }">
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <div id="accSelectedUserAvatar" style="width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, rgba(216,180,109,0.3) 0%, rgba(216,180,109,0.1) 100%); border: 1px solid rgba(216,180,109,0.5); color: var(--primary); display: grid; place-items: center; font-size: 11px; font-weight: 850; flex-shrink: 0; ">
                          ${getAccUserInitials(defaultGdvVal)}
                        </div>
                        <strong id="lblAccSelectedGdvName" style="font-size: 13.5px; color: var(--text-main); font-weight: 850;">${escapeHtmlOutput(defaultGdvVal)}</strong>
                      </div>
                      <svg id="accGdvChevronArrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--text-soft); transition: transform 0.2s ease;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>

                    <!-- FLOATING GLASSMORPHIC MENU -->
                    <div id="accGdvDropdownMenu" style="display: none; position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 1000; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 14px; box-shadow: 0 18px 45px rgba(0,0,0,0.45); backdrop-filter: blur(20px); padding: 6px; max-height: 250px; overflow-y: auto;">
                      ${userOptionsList.map(uName => {
                        const isSel = uName === defaultGdvVal;
                        return `
                          <div class="acc-gdv-user-item" data-value="${escapeAttributeData(uName)}" onclick="selectAccGdvUserOption('${escapeAttributeData(uName)}')" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 10px; cursor: pointer; transition: all 0.15s ease; ${isSel ? 'background: rgba(216,180,109,0.15); color: var(--primary);' : 'color: var(--text-main);'}">
                            <div style="display: flex; align-items: center; gap: 10px;">
                              <div style="width: 26px; height: 26px; border-radius: 50%; background: ${isSel ? 'var(--primary)' : 'var(--bg-soft)'}; color: ${isSel ? '#111111' : 'var(--text-soft)'}; display: grid; place-items: center; font-size: 10.5px; font-weight: 850; ">
                                ${getAccUserInitials(uName)}
                              </div>
                              <strong style="font-size: 13px; font-weight: 850;">${escapeHtmlOutput(uName)}</strong>
                            </div>
                            ${isSel ? `<span style="color: var(--primary);">${ACC_SVGS.CHECK_CIRCLE}</span>` : ''}
                          </div>
                        `;
                      }).join('')}
                    </div>

                  </div>
                </div>
              </div>

              <!-- 2. EXPANDED SIDE-BY-SIDE SEARCH & SELECTION ZONE -->
              <div class="acc-modal-grid">
                
                <!-- LEFT SISTER CARD -->
                <div class="acc-sister-card">
                  <div style="display: flex; justify-content: space-between; align-items: center; height: 36px; margin-bottom: 10px; flex-shrink: 0;">
                    <label style="font-size: 13.5px; font-weight: 850; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
                      <span style="color: var(--primary);">${ACC_SVGS.SEARCH}</span>
                      <span>Tìm & Tích chọn Hồ sơ bồi thường:</span>
                    </label>
                    <span id="lblAccClaimSearchCounter" style="font-size: 11.5px; color: var(--primary); font-weight: 850; background: rgba(216,180,109,0.15); padding: 4px 12px; border-radius: 99px; border: 1px solid rgba(216,180,109,0.3);">
                      Đang tải...
                    </span>
                  </div>
                  
                  <div style="position: relative; margin-bottom: 12px; flex-shrink: 0;">
                    <input type="text" id="accClaimSearchBox" class="input-premium" placeholder="Gõ biển số (VD: 47A-85640), số HSBT, tên chủ xe..." oninput="debouncedRenderAccClaimSearchResults(this.value)" style="width: 100%; height: 42px; border-radius: 12px; font-size: 13.5px; padding-left: 16px; padding-right: 36px;" />
                    <button type="button" onclick="document.getElementById('accClaimSearchBox').value=''; renderAccClaimSearchResults('');" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: transparent; border: none; font-size: 14px; color: var(--text-muted); cursor: pointer;" title="Xóa từ khóa">✕</button>
                  </div>

                  <div id="accClaimSearchResultsHolder" style="height: 480px; max-height: 52vh; overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; gap: 8px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); padding: 10px; will-change: scroll-position; transform: translateZ(0); -webkit-overflow-scrolling: touch; contain: content;">
                    <!-- Dynamic JS insertion -->
                  </div>
                </div>

                <!-- RIGHT SISTER CARD -->
                <div class="acc-sister-card">
                  <div style="display: flex; justify-content: space-between; align-items: center; height: 36px; margin-bottom: 10px; flex-shrink: 0;">
                    <label style="font-size: 13.5px; font-weight: 850; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
                      <span style="color: #3b82f6;">${ACC_SVGS.CHECK_CIRCLE}</span>
                      <span>Danh sách Hồ sơ trong Phiếu bàn giao (<strong id="lblAccBatchCount" style="color: var(--primary);  font-size: 14px;">${currentBatchSelectedClaims.length}</strong> hồ sơ):</span>
                    </label>
                  </div>

                  <div style="border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: var(--surface); box-shadow: var(--shadow-sm); flex: 1; min-height: 0; display: flex; flex-direction: column;">
                    <div style="overflow: auto; flex: 1; min-height: 0;">
                      <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
                        <thead style="position: sticky; top: 0; z-index: 5; background: var(--bg-soft);">
                          <tr style="border-bottom: 1px solid var(--border-strong);">
                            <th style="padding: 12px 14px; text-align: center; width: 50px; font-size: 11px; font-weight: 850; color: var(--text-muted); text-transform: uppercase;">STT</th>
                            <th style="padding: 12px 14px; text-align: left; font-size: 11px; font-weight: 850; color: var(--text-muted); text-transform: uppercase;">Biển số & HSBT</th>
                            <th style="padding: 12px 14px; text-align: left; font-size: 11px; font-weight: 850; color: var(--text-muted); text-transform: uppercase;">Chủ xe / Khách hàng</th>
                            <th style="padding: 12px 14px; text-align: left; font-size: 11px; font-weight: 850; color: var(--text-muted); text-transform: uppercase;">Gara</th>
                            <th style="padding: 12px 14px; text-align: right; width: 170px; font-size: 11px; font-weight: 850; color: var(--text-muted); text-transform: uppercase;">Tiền Đề nghị</th>
                            <th style="padding: 12px 14px; text-align: center; width: 50px; font-size: 11px; font-weight: 850; color: var(--text-muted); text-transform: uppercase;">Xóa</th>
                          </tr>
                        </thead>
                        <tbody id="tblAccBatchSelectedBody">
                          <!-- Dynamic JS insertion -->
                        </tbody>
                      </table>
                    </div>

                    <!-- TOTAL MONEY BANNER AT BOTTOM OF TABLE -->
                    <div style="background: linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.03) 100%); border-top: 2px solid rgba(16,185,129,0.35); padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                      <span style="font-weight: 850; color: var(--text-main); font-size: 13.5px;">TỔNG TIỀN ĐỀ NGHỊ CHI TOÀN PHIẾU BÀN GIAO:</span>
                      <strong id="lblAccBatchTotalMoney" style="font-size: 20px; color: #10b981;  font-weight: 850;">0 đ</strong>
                    </div>
                  </div>
                </div>

              </div>

              <!-- 3. GHI CHÚ BÀN GIAO TOÀN PHIẾU -->
              <div style="margin-bottom: 10px;">
                <label style="display: block; font-size: 12px; font-weight: 850; color: var(--text-main); margin-bottom: 6px;">Ghi chú bàn giao toàn phiếu từ GĐV:</label>
                <textarea id="accBatchGhiChuGdv" class="textarea-premium" placeholder="Nhập ghi chú chung cho phiếu bàn giao này..." style="width: 100%; height: 85px; border-radius: 12px; font-size: 13px;">${escapeHtmlOutput(existing?.ghiChuGdv || '')}</textarea>
              </div>

            </div>

            <!-- FIXED STICKY FOOTER: HỦY BỎ & LƯU NHÁP AT BOTTOM RIGHT -->
            <div style="position: sticky; bottom: 0; padding: 16px 30px; border-top: 1px solid var(--border); background: var(--surface); backdrop-filter: blur(14px); z-index: 10; flex-shrink: 0; display: flex; justify-content: flex-end; align-items: center; gap: 12px;">
              <button type="button" onclick="closeAccountingTransferModal()" style="padding: 11px 22px; border-radius: 12px; font-size: 13.5px; font-weight: 850; background: var(--bg-soft); color: var(--text-soft); border: 1px solid var(--border); cursor: pointer; transition: all 0.2s ease;">Hủy bỏ</button>
              ${isCreator ? `
                <button type="button" onclick="saveAccountingTransferBatchFromModal(event, '${editingTransferId || ''}', 'moi')" style="padding: 11px 24px; border-radius: 12px; font-size: 13.5px; font-weight: 850; background: var(--surface); color: var(--text-main); border: 1px solid var(--border-strong); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: var(--shadow-sm); transition: all 0.2s ease;">
                  ${ACC_SVGS.BRIEFCASE}
                  <span>Lưu nháp</span>
                </button>
              ` : `
                <button type="button" onclick="triggerToast('Chỉ có người tạo phiếu mới được quyền chỉnh sửa hoặc lưu nháp!', 'warning')" style="padding: 11px 24px; border-radius: 12px; font-size: 13.5px; font-weight: 850; background: var(--bg-soft); color: var(--text-muted); border: 1px solid var(--border); cursor: not-allowed; display: inline-flex; align-items: center; gap: 6px; opacity: 0.65;">
                  ${ACC_SVGS.BRIEFCASE}
                  <span>Lưu nháp</span>
                </button>
              `}
            </div>

          </form>
        </div>
      `;

      document.body.appendChild(modalOverlay);

      // Render search results & selected batch table initially
      renderAccClaimSearchResults('');
      renderAccBatchSelectedTable();
    }


    function closeAccountingTransferModal() {
      const el = document.getElementById('accountingTransferModalOverlay');
      if (el) el.remove();
    }


    /* HELPER TO GET SET OF CLAIMS ALREADY ADDED TO ANY ACCOUNTING TRANSFER BATCH */
    function getAlreadyTransferredClaimIdsSet(editingTransferId) {
      const transferredSet = new Set();
      const transfers = Object.values(cachedAccountingTransfersPayload || {});

      transfers.forEach(t => {
        // Exclude claims of current batch being edited so they stay selectable
        if (editingTransferId && String(t.transferId) === String(editingTransferId)) return;

        const list = t.danhSachHoSo || [];
        list.forEach(c => {
          if (c.claimId) transferredSet.add(String(c.claimId));
          if (c.id) transferredSet.add(String(c.id));
          if (c.soHoSoBoiThuong) transferredSet.add(String(c.soHoSoBoiThuong).toLowerCase().trim());
        });

        if (list.length === 0 && (t.soHoSoBoiThuong || t.bienSo)) {
          if (t.claimId) transferredSet.add(String(t.claimId));
          if (t.soHoSoBoiThuong) transferredSet.add(String(t.soHoSoBoiThuong).toLowerCase().trim());
        }
      });

      return transferredSet;
    }
