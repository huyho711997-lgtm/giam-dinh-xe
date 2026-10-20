
    function debouncedExecuteUIRenderPendingClaims() {
      clearTimeout(debouncePendingTimeout);
      debouncePendingTimeout = setTimeout(() => {
        pendingClaimsCurrentPage = 1;
        executeUIRenderPendingClaims();
      }, 300);
    }

    function debouncedExecuteUIRenderCasesTable() {
      clearTimeout(debounceCaseTimeout);
      debounceCaseTimeout = setTimeout(() => {
        activeCasePage = 1;
        executeUIRenderCasesTable();
      }, 300);
    }

    function debouncedRenderAuditLogsTableList() {
      clearTimeout(debounceAuditTimeout);
      debounceAuditTimeout = setTimeout(() => {
        renderAuditLogsTableList();
      }, 300);
    }

    function debouncedRenderUsersTableList() {
      clearTimeout(debounceUserTimeout);
      debounceUserTimeout = setTimeout(() => {
        renderUsersTableList();
      }, 300);
    }


    function debouncedRenderAccClaimSearchResults(val) {
      clearTimeout(searchDebounceTimeout);
      searchDebounceTimeout = setTimeout(() => {
        renderAccClaimSearchResults(val);
      }, 200);
    }


    /* RENDER ALL SEARCH RESULTS FOR CLAIMS - FILTERS BY "ĐÃ DUYỆT HSBT", LOGGED-IN GĐV AND NOT ALREADY IN A BATCH */
    function renderAccClaimSearchResults(keyword) {
      if (!keyword && !window._accClaimSearchLimitReset) { window._accClaimSearchLimit = 50; }
      const holder = document.getElementById('accClaimSearchResultsHolder');
      const counterLbl = document.getElementById('lblAccClaimSearchCounter');
      if (!holder) return;

      const rawMap = (rawPendingClaimsPayload && Object.keys(rawPendingClaimsPayload).length > 0) ? rawPendingClaimsPayload : (cachedPendingClaimsPayload || {});
      const allClaims = Object.values(rawMap).filter(c => c && typeof c === 'object');

      const currentTransferId = getAccInputValue('accBatchTransferId') || '';
      const alreadyTransferredSet = getAlreadyTransferredClaimIdsSet(currentTransferId);

      const isKeToanOrAdmin = getLoggedInUserAccountingRole() === 'ketoan' || (activeUserProfile && String(activeUserProfile.role || '').trim().toLowerCase() === 'admin');
      const currentLoggedInGdvName = String(activeUserProfile?.fullName || activeUserProfile?.displayName || activeUserProfile?.name || firebase.auth().currentUser?.displayName || '').trim().toLowerCase();

      // STRICT FILTER: Only claims with status "Đã duyệt HSBT", belonging to current GĐV, AND NOT ALREADY IN ANOTHER BATCH
      let approvedClaims = allClaims.filter(c => {
        const st = String(c.trangThai || '').toLowerCase().trim();
        const isApproved = st === 'da_duyet_hsbt' || st.includes('đã duyệt hsbt') || st.includes('da_duyet_pasc') || st.includes('da_duyet');
        if (!isApproved) return false;

        const cId = String(c.id || '');
        const hsbt = String(c.soHoSoBoiThuong || c.maVuTonThat || '').toLowerCase().trim();

        const isAlreadyInBatch = (cId && alreadyTransferredSet.has(cId)) || 
                                 (hsbt && alreadyTransferredSet.has(hsbt));
        return !isAlreadyInBatch;
      });

      // If user is a regular GĐV, filter claims to ONLY include those assigned to them
      if (!isKeToanOrAdmin && currentLoggedInGdvName) {
        approvedClaims = approvedClaims.filter(c => {
          const claimGdv = String(c.gdvTiepNhan || c.canBoXuLy || c.gdvHo || c.canBoBoiThuong || c.canBoGiamDinh || c.gdvName || c.createdByName || '').trim().toLowerCase();
          if (!claimGdv) return true;
          return claimGdv.includes(currentLoggedInGdvName) || currentLoggedInGdvName.includes(claimGdv);
        });
      }

      const kw = (keyword || '').toLowerCase().trim();

      let matched = approvedClaims;
      if (kw) {
        matched = approvedClaims.filter(c => 
          (c.bienSo || '').toLowerCase().includes(kw) ||
          (c.soHoSoBoiThuong || '').toLowerCase().includes(kw) ||
          (c.maVuTonThat || '').toLowerCase().includes(kw) ||
          (extractClaimOwnerName(c)).toLowerCase().includes(kw) ||
          (c.tenGaraVietTat || c.garaSuaChua || c.gara || '').toLowerCase().includes(kw)
        );
      }

      if (counterLbl) {
        counterLbl.textContent = kw ? ('Khớp: ' + matched.length + ' / ' + approvedClaims.length + ' hồ sơ đã duyệt') : ('Đã duyệt HSBT: ' + approvedClaims.length + ' hồ sơ');
      }

      if (matched.length === 0) {
        holder.innerHTML = `<div style="padding: 24px 18px; text-align: center; color: var(--text-muted); font-size: 13px; line-height: 1.5;">${approvedClaims.length === 0 ? 'Hiện chưa có hồ sơ nào ở trạng thái <strong>Đã duyệt HSBT</strong> trên hệ thống.' : 'Không tìm thấy hồ sơ Đã duyệt HSBT nào phù hợp từ khóa "' + escapeHtmlOutput(kw) + '".'}</div>`;
        return;
      }

      const limit = window._accClaimSearchLimit || 50;
      const visibleMatched = matched.slice(0, limit);

      let cardsHTML = visibleMatched.map(c => {
        const isChecked = currentBatchSelectedClaims.some(item => item.claimId === c.id || item.soHoSoBoiThuong === (c.soHoSoBoiThuong || c.maVuTonThat));
        const bienSo = c.bienSo || 'N/A';
        const hsbt = c.soHoSoBoiThuong || c.maVuVuTonThat || c.maVuTonThat || 'Chưa có mã';
        const chuXe = extractClaimOwnerName(c);
        const gara = c.tenGaraVietTat || c.garaSuaChua || c.gara || 'Chưa Gara';
        const money = c.ttbtTongSoTienBoiThuong || 0;

        return `
          <label style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 15px; border-radius: 12px; background: ${isChecked ? 'rgba(59,130,246,0.08)' : 'var(--bg-soft)'}; border: 1px solid ${isChecked ? 'rgba(59,130,246,0.35)' : 'var(--border)'}; cursor: pointer; transition: background 0.1s ease;">
            <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
              <input type="checkbox" onchange="toggleAccClaimSelectInBatch('${c.id}')" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer; accent-color: #3b82f6; flex-shrink: 0;" />
              <div style="min-width: 0;">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <strong style="font-size: 13.5px; color: var(--text-main); font-weight: 850;">${escapeHtmlOutput(bienSo)}</strong>
                  <span style="font-size: 11.5px; color: var(--primary);  font-weight: 750;">${escapeHtmlOutput(hsbt)}</span>
                  <span style="background: rgba(20,184,166,0.14); color: #14b8a6; border: 1px solid rgba(20,184,166,0.3); font-size: 10px; font-weight: 850; padding: 1px 6px; border-radius: 99px;">Đã duyệt HSBT</span>
                </div>
                <div style="font-size: 11.5px; color: var(--text-soft); margin-top: 3px;">
                  Chủ xe/Khách hàng: <strong style="color: var(--text-main); font-weight: 750;">${escapeHtmlOutput(chuXe)}</strong> | Gara: ${escapeHtmlOutput(gara)}
                </div>
              </div>
            </div>
            <strong style="font-size: 13.5px; color: #10b981;  font-weight: 850; flex-shrink: 0;">${formatCurrencyInputNumber(money)} đ</strong>
          </label>
        `;
      }).join('');

      if (matched.length > limit) {
        cardsHTML += `
          <button type="button" onclick="window._accClaimSearchLimit = (window._accClaimSearchLimit || 50) + 50; renderAccClaimSearchResults(document.getElementById('accClaimSearchBox')?.value || '')" style="width: 100%; padding: 12px; margin-top: 6px; border-radius: 12px; background: rgba(59,130,246,0.12); color: #3b82f6; border: 1px solid rgba(59,130,246,0.3); font-size: 13px; font-weight: 850; cursor: pointer; text-align: center; transition: all 0.2s ease;">
            👇 Xem thêm 50 hồ sơ nữa (Còn ${matched.length - limit} hồ sơ)
          </button>
        `;
      }

      holder.innerHTML = cardsHTML;
    }
