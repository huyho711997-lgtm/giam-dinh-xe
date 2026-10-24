

    function getAllCancellationClaimsList() {
      // Nguồn dữ liệu chuyên biệt: Bảng claim_cancellations độc lập trên Firebase
      const cancelList = Object.entries(cachedClaimCancellationsPayload || {}).map(([k, v]) => ({
        ...v,
        id: v.id || v.claimId || k,
        _claimKey: k
      }));
      return cancelList.filter(c => c && c.cancelStatus !== 'da_hoan_tac' && c.cancelStatus !== 'da_xoa_de_xuat');
    }


    function getFilteredCancellationClaims() {
      const cancelClaims = getAllCancellationClaimsList();

      return cancelClaims.filter(c => {
        // 1. Search filter
        if (activeCancelSearch && activeCancelSearch.trim()) {
          const q = activeCancelSearch.trim().toLowerCase();
          const bsx = String(c.bienSo || '').toLowerCase();
          const hsbt = String(c.soHoSoBoiThuong || c.soHsbt || '').toLowerCase();
          const owner = String(c.chuXe || c.khachHang || c.tenLaiXe || c.hoTen || '').toLowerCase();
          const gdv = String(c.gdvTiepNhan || c.canBoXuLy || c.gdvHienTruong || c.gdvHo || c.cancelProposedBy || '').toLowerCase();
          const reason = String(c.lyDoHuy || c.cancelReasonCode || c.lyDoChoViecHuy || '').toLowerCase();
          const note = String(c.cancelNotes || c.ghiChu || c.ghiChuHoSo || '').toLowerCase();
          const branch = String(c.donViCapDon || c.chiNhanh || '').toLowerCase();

          const match = bsx.includes(q) || hsbt.includes(q) || owner.includes(q) || gdv.includes(q) || reason.includes(q) || note.includes(q) || branch.includes(q);
          if (!match) return false;
        }

        // 2. GĐV filter
        if (activeCancelGdvFilter !== 'all') {
          const gdv = String(c.gdvTiepNhan || c.canBoXuLy || c.gdvHienTruong || c.gdvHo || c.cancelProposedBy || 'Chưa phân công').trim().toLowerCase();
          if (gdv !== activeCancelGdvFilter.trim().toLowerCase()) return false;
        }

        // 3. Branch filter
        if (activeCancelBranchFilter !== 'all') {
          const b = String(c.donViCapDon || c.chiNhanh || '').trim().toLowerCase();
          if (!b.includes(activeCancelBranchFilter.toLowerCase())) return false;
        }

        // 4. Reason code filter
        if (activeCancelReasonCodeFilter !== 'all') {
          const rCode = String(c.cancelReasonCode || '').toLowerCase();
          const rText = String(c.lyDoHuy || c.lyDoChoViecHuy || '').toLowerCase();
          const target = activeCancelReasonCodeFilter.toLowerCase();
          const matchCode = rCode === target || rText.includes(target.replace('_', ' ')) || rText.includes(target);
          if (!matchCode) return false;
        }

        // 5. Status filter
        if (activeCancelStatusFilter !== 'all') {
          const isApproved = (c.trangThai === 'tu_choi' || c.cancelStatus === 'da_duyet');
          if (activeCancelStatusFilter === 'da_duyet' && !isApproved) return false;
          if (activeCancelStatusFilter === 'cho_duyet' && isApproved) return false;
        }

        return true;
      });
    }


    function renderClaimCancellationPage(targetContainer) {
      const container = targetContainer || document.getElementById('tabContentContainer');
      if (!container) return;

      const isAdmin = activeUserProfile && String(activeUserProfile.role || '').trim().toLowerCase() === 'admin';

      const allCancelClaims = getAllCancellationClaimsList();
      const filtered = getFilteredCancellationClaims();

      // Stats
      const totalCount = allCancelClaims.length;
      let totalDuPhong = 0;
      let choDuyetCount = 0;
      let daDuyetCount = 0;

      allCancelClaims.forEach(c => {
        const dp = parseInt(String(c.duPhongBoiThuong || '0').replace(/\D/g, ''), 10) || 0;
        totalDuPhong += dp;
        const isAppr = (c.trangThai === 'tu_choi' || c.cancelStatus === 'da_duyet');
        if (isAppr) daDuyetCount++;
        else choDuyetCount++;
      });

      // Extract unique GĐVs
      const gdvSet = new Set();
      allCancelClaims.forEach(c => {
        const gdv = (c.gdvTiepNhan || c.canBoXuLy || c.gdvHienTruong || c.gdvHo || c.cancelProposedBy || '').trim();
        if (gdv) gdvSet.add(gdv);
      });
      const uniqueGdvs = Array.from(gdvSet).sort();

      // Extract unique Branches
      const branchSet = new Set();
      allCancelClaims.forEach(c => {
        const b = (c.donViCapDon || c.chiNhanh || '').trim();
        if (b) branchSet.add(b);
      });
      const uniqueBranches = Array.from(branchSet).sort();

      // Display labels & options for custom dropdown menus
      const activeGdvLabel = activeCancelGdvFilter === 'all' ? `Tất cả GĐV (${uniqueGdvs.length})` : activeCancelGdvFilter;
      const activeBranchLabel = activeCancelBranchFilter === 'all' ? 'Tất cả Chi nhánh' : activeCancelBranchFilter;

      const cancelReasonOptions = [
        { code: 'all', short: 'Tất cả lý do', full: 'Tất cả lý do' },
        { code: 'HUY_10', short: 'Huỷ 10: Ngoài phạm vi', full: 'Huỷ 10: Ngoài phạm vi bảo hiểm (hao mòn, bảo hành, cố ý...)' },
        { code: 'HUY_01', short: 'Huỷ 01: Trùng vụ', full: 'Huỷ 01: Trùng vụ tổn thất (đã xử lý trong vụ khác)' },
        { code: 'HUY_02', short: 'Huỷ 02: Treo quá lâu', full: 'Huỷ 02: Treo quá lâu / Mất liên lạc khách hàng' },
        { code: 'HUY_03', short: 'Huỷ 03: Khách rút YC', full: 'Huỷ 03: Khách hàng chủ động rút yêu cầu bồi thường' },
        { code: 'HUY_05', short: 'Huỷ 05: Khách tự làm', full: 'Huỷ 05: Khách hàng tự làm và không yêu cầu bồi thường' },
        { code: 'HUY_NGOAI_THO', short: 'Ngoài lãnh thổ VN', full: 'Ngoài lãnh thổ: Tổn thất ngoài lãnh thổ Việt Nam' },
        { code: 'HUY_KHAC', short: 'Lý do khác', full: 'Lý do khác (có giải trình cụ thể)' }
      ];
      const activeReasonObj = cancelReasonOptions.find(o => o.code === activeCancelReasonCodeFilter) || cancelReasonOptions[0];
      const activeReasonLabel = activeReasonObj.short;

      const rowsHtml = filtered.map((c, idx) => {
        const bsx = c.bienSo || '—';
        const hsbt = c.soHoSoBoiThuong || c.soHsbt || '—';
        const chuXe = c.chuXe || c.khachHang || c.tenLaiXe || c.hoTen || '—';
        const gdv = c.gdvTiepNhan || c.canBoXuLy || c.gdvHo || 'Chưa phân công';
        const gdht = c.gdvHienTruong || '';
        const donVi = c.donViCapDon || c.chiNhanh || '—';
        const ngayTonThat = formatDateDisplay(c.ngayVTT || c.ngayTonThat || c.ngayMoHs);
        const duPhong = formatCurrencyInputNumber(c.duPhongBoiThuong) || '0';
        
        const isApproved = (c.trangThai === 'tu_choi' || c.cancelStatus === 'da_duyet');
        const reasonCode = c.cancelReasonCode || c.lyDoChoViecHuy || 'Huỷ';
        const reasonText = c.lyDoHuy || c.lyDoChoViecHuy || 'Đề xuất hủy hồ sơ';
        const notes = c.cancelNotes || c.ghiChu || c.ghiChuHoSo || '—';

        return `
          <tr style="border-bottom: 1px solid var(--border); font-size: 13px; transition: background 0.15s ease;" onmouseover="this.style.background='var(--bg-soft)'" onmouseout="this.style.background='transparent'">
            <td style="padding: 12px 10px; text-align: center; font-weight: 700; color: var(--text-muted); width: 45px;">${idx + 1}</td>
            <td style="padding: 12px 10px; text-align: center; width: 130px;">
              ${isApproved ? `
                <span style="display: inline-block; padding: 4px 10px; border-radius: 99px; font-size: 11px; font-weight: 850; background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.35); white-space: nowrap;">
                  Đã duyệt hủy
                </span>
              ` : `
                <span style="display: inline-block; padding: 4px 10px; border-radius: 99px; font-size: 11px; font-weight: 850; background: rgba(245, 158, 11, 0.12); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.35); white-space: nowrap;">
                  Chờ duyệt hủy
                </span>
              `}
            </td>
            <td style="padding: 12px 10px; min-width: 140px;">
              <div style="font-weight: 850; color: var(--primary); font-size: 13.5px; display: flex; align-items: center; gap: 6px;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                <span>${escapeHtmlOutput(bsx)}</span>
              </div>
              <div style="font-size: 11.5px; color: var(--text-soft); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 170px;" title="${escapeAttributeData(chuXe)}">${escapeHtmlOutput(chuXe)}</div>
            </td>
            <td style="padding: 12px 10px; font-weight: 750; color: var(--text-main); font-size: 12.5px; min-width: 140px; white-space: nowrap;">
              <div style="display: inline-flex; align-items: center; gap: 6px;">
                <span>${escapeHtmlOutput(hsbt)}</span>
                ${(c.soHoSoBoiThuong || c.soHsbt) ? `
                  <button type="button" onclick="copyHsbtToClipboard(this, '${escapeAttributeData(c.soHoSoBoiThuong || c.soHsbt)}', event)" title="Sao chép nhanh số HSBT" style="border: none; background: rgba(59,130,246,0.1); color: #3b82f6; padding: 0; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; height: 20px; width: 20px; flex-shrink: 0; transition: all 0.15s ease;" onmouseover="this.style.background='rgba(59,130,246,0.2)'; this.style.transform='scale(1.1)'" onmouseout="this.style.background='rgba(59,130,246,0.1)'; this.style.transform='scale(1)'">
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  </button>
                ` : ''}
              </div>
            </td>
            <td style="padding: 12px 10px; text-align: left; min-width: 130px;">
              <div style="font-weight: 800; color: var(--text-main); font-size: 12.5px;">${escapeHtmlOutput(gdv)}</div>
              ${gdht && gdht !== gdv ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">GĐHT: ${escapeHtmlOutput(gdht)}</div>` : ''}
            </td>
            <td style="padding: 12px 10px; text-align: left; max-width: 130px; font-size: 12.5px; color: var(--text-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${escapeHtmlOutput(donVi)}
            </td>
            <td style="padding: 12px 10px; text-align: center; width: 100px; font-size: 12px; font-weight: 700; color: var(--text-main);">
              ${escapeHtmlOutput(ngayTonThat)}
            </td>
            <td style="padding: 12px 10px; text-align: right; width: 125px; font-weight: 850; color: #10b981; font-size: 13px;">
              ${duPhong} đ
            </td>
            <td style="padding: 12px 10px; min-width: 160px; max-width: 220px;">
              <div style="display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span style="display: inline-block; padding: 2px 7px; border-radius: 6px; font-size: 10.5px; font-weight: 800; background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.25);">
                  ${escapeHtmlOutput(reasonCode)}
                </span>
                <span style="font-size: 12px; font-weight: 700; color: var(--text-main); line-height: 1.3;">
                  ${escapeHtmlOutput(reasonText)}
                </span>
              </div>
            </td>
            <td style="padding: 12px 10px; min-width: 200px; max-width: 280px; font-size: 12px; color: var(--text-soft); line-height: 1.4;">
              <div style="max-height: 60px; overflow-y: auto;">${escapeHtmlOutput(notes)}</div>
            </td>
            ${isAdmin ? `
              <td style="padding: 12px 10px; text-align: center; width: 90px; white-space: nowrap;">
                ${isApproved ? `
                  <span title="Hồ sơ đã duyệt hủy không thể xóa" style="font-size: 11px; color: var(--text-muted); display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; background: rgba(0,0,0,0.04); cursor: not-allowed;">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    <span>Đã duyệt</span>
                  </span>
                ` : `
                  <button type="button" onclick="deleteClaimCancellationProposalByAdmin('${c.id}', event)" title="Xóa đề xuất hủy (chuyển hồ sơ trở lại hồ sơ tồn)" style="border: 1px solid rgba(239, 68, 68, 0.35); background: rgba(239, 68, 68, 0.08); color: #ef4444; padding: 5px 12px; border-radius: 8px; font-size: 11.5px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s ease;" onmouseover="this.style.background='rgba(239, 68, 68, 0.18)'; this.style.transform='scale(1.04)'" onmouseout="this.style.background='rgba(239, 68, 68, 0.08)'; this.style.transform='scale(1)'">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    <span>Xóa</span>
                  </button>
                `}
              </td>
            ` : ''}
          </tr>
        `;
      }).join('');

      container.innerHTML = `
        <div style="padding: 16px 0 32px 0; width: 100%; max-width: 100%; margin: 0 auto;">
          
          <!-- HERO HEADER BANNER -->
          <div style="background: linear-gradient(145deg, rgba(239, 68, 68, 0.04) 0%, rgba(239, 68, 68, 0.1) 100%), var(--surface); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 20px; padding: 24px 28px; margin-bottom: 20px; box-shadow: 0 8px 30px -8px rgba(0,0,0,0.12); position: relative; overflow: hidden;">
            <div style="position: absolute; right: -50px; top: -50px; width: 280px; height: 280px; background: radial-gradient(circle, rgba(239, 68, 68, 0.18) 0%, rgba(0,0,0,0) 70%); border-radius: 50%; pointer-events: none; filter: blur(24px);"></div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; position: relative; z-index: 2;">
              <div style="flex: 1; min-width: 320px;">
                <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; padding: 5px 14px; border-radius: 99px; font-size: 11.5px; font-weight: 850; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 10px;">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                  <span>Quản lý Nghiệp vụ Hủy hồ sơ</span>
                </div>
                <h1 style="font-size: 27px; font-weight: 900; color: var(--text-main); margin: 0 0 8px 0; letter-spacing: -0.02em; line-height: 1.25;">
                  Đề xuất Hủy Hồ sơ Bồi thường
                </h1>
                <p style="margin: 0; font-size: 13.5px; color: var(--text-soft); max-width: 950px; line-height: 1.5;">
                  Tổng hợp toàn bộ hồ sơ do Giám định viên đề xuất hủy hoặc từ chối bồi thường • Theo dõi lý do, căn cứ giải trình và hỗ trợ nhập/xuất Excel trình ký.
                </p>
              </div>

              <!-- Action Buttons -->
              <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <button type="button" onclick="openImportApprovedCancellationExcelModal()" style="padding: 0 16px; height: 42px; font-size: 13px; border-radius: 12px; font-weight: 850; background: var(--surface); color: var(--text-main); border: 1px solid var(--border-strong); display: inline-flex; align-items: center; gap: 8px; cursor: pointer; box-shadow: var(--shadow-xs); transition: all 0.2s ease;">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10b981" stroke-width="2.3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><polyline points="9 15 11 17 15 13"></polyline></svg>
                  <span>Nhập Excel đã duyệt hủy</span>
                </button>
                <button type="button" onclick="exportCancellationClaimsToExcel()" style="padding: 0 16px; height: 42px; font-size: 13px; border-radius: 12px; font-weight: 850; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; border: none; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; box-shadow: 0 4px 12px rgba(16,185,129,0.3); transition: all 0.2s ease;">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  <span>Xuất Excel (.xlsx)</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 4 SUMMARY KPI METRIC CARDS -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 20px;">
            <!-- Card 1: Tổng hồ sơ đề xuất hủy -->
            <div onclick="setCancelStatusFilter('all')" style="background: var(--surface); border: 1px solid ${activeCancelStatusFilter === 'all' ? '#ef4444' : 'var(--border-strong)'}; border-radius: 16px; padding: 18px 22px; box-shadow: var(--shadow-sm); position: relative; overflow: hidden; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                <span style="font-size: 12px; font-weight: 850; color: var(--text-soft); text-transform: uppercase; letter-spacing: 0.05em;">Tổng hồ sơ cần hủy</span>
                <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(239, 68, 68, 0.12); color: #ef4444; display: grid; place-items: center;">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                </div>
              </div>
              <div style="font-size: 30px; font-weight: 900; color: #ef4444; line-height: 1.1;">${totalCount}</div>
              <div style="font-size: 11.5px; color: var(--text-soft); margin-top: 6px; font-weight: 700;">Hồ sơ GĐV đề xuất hủy lũy kế</div>
            </div>

            <!-- Card 2: Chờ duyệt hủy -->
            <div onclick="setCancelStatusFilter('cho_duyet')" style="background: var(--surface); border: 1px solid ${activeCancelStatusFilter === 'cho_duyet' ? '#d97706' : 'var(--border-strong)'}; border-radius: 16px; padding: 18px 22px; box-shadow: var(--shadow-sm); position: relative; overflow: hidden; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                <span style="font-size: 12px; font-weight: 850; color: var(--text-soft); text-transform: uppercase; letter-spacing: 0.05em;">Chờ duyệt hủy</span>
                <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(245, 158, 11, 0.12); color: #d97706; display: grid; place-items: center;">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                </div>
              </div>
              <div style="font-size: 30px; font-weight: 900; color: #d97706; line-height: 1.1;">${choDuyetCount}</div>
              <div style="font-size: 11.5px; color: var(--text-soft); margin-top: 6px; font-weight: 700;">Đang chờ lãnh đạo duyệt hủy</div>
            </div>

            <!-- Card 3: Đã duyệt hủy / Từ chối -->
            <div onclick="setCancelStatusFilter('da_duyet')" style="background: var(--surface); border: 1px solid ${activeCancelStatusFilter === 'da_duyet' ? '#3b82f6' : 'var(--border-strong)'}; border-radius: 16px; padding: 18px 22px; box-shadow: var(--shadow-sm); position: relative; overflow: hidden; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                <span style="font-size: 12px; font-weight: 850; color: var(--text-soft); text-transform: uppercase; letter-spacing: 0.05em;">Đã duyệt hủy</span>
                <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(59, 130, 246, 0.12); color: #3b82f6; display: grid; place-items: center;">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
              </div>
              <div style="font-size: 30px; font-weight: 900; color: #3b82f6; line-height: 1.1;">${daDuyetCount}</div>
              <div style="font-size: 11.5px; color: var(--text-soft); margin-top: 6px; font-weight: 700;">Đã hoàn tất thủ tục từ chối/hủy</div>
            </div>

            <!-- Card 4: Tổng dự phòng giải phóng -->
            <div style="background: var(--surface); border: 1px solid var(--border-strong); border-radius: 16px; padding: 18px 22px; box-shadow: var(--shadow-sm); position: relative; overflow: hidden;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                <span style="font-size: 12px; font-weight: 850; color: var(--text-soft); text-transform: uppercase; letter-spacing: 0.05em;">Dự phòng giải phóng</span>
                <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(16, 185, 129, 0.12); color: #10b981; display: grid; place-items: center;">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                </div>
              </div>
              <div style="font-size: 26px; font-weight: 900; color: #10b981; line-height: 1.1;">
                ${formatCurrencyInputNumber(totalDuPhong)} <span style="font-size: 15px; font-weight: 700;">đ</span>
              </div>
              <div style="font-size: 11.5px; color: var(--text-soft); margin-top: 6px; font-weight: 700;">Số tiền DPBT sẽ được giải phóng</div>
            </div>
          </div>

          <!-- FILTER TOOLBAR ROW (STANDALONE CARD matching software design system) -->
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; background: var(--surface); padding: 14px 20px; border-radius: 16px; border: 1px solid var(--border-strong); box-shadow: var(--shadow-sm);">
            
            <!-- Left Side: Search Input -->
            <div class="search-wrap" style="margin: 0; min-width: 240px; max-width: 320px; flex: 1;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="svg-icon" style="color: var(--primary);"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input
                id="txtCancellationFilterSearch"
                class="input-premium"
                type="search"
                placeholder="Tìm BSX, số HSBT, GĐV, lý do..."
                autocomplete="off"
                value="${escapeAttributeData(activeCancelSearch)}"
                oninput="setCancelSearch(this.value)"
                style="height: 42px; font-size: 13px; border-radius: 12px; font-weight: 600; padding-left: 42px; width: 100%;"
              />
              ${activeCancelSearch ? `
                <button type="button" onclick="setCancelSearch('')" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 22px; height: 22px; border-radius: 50%; background: var(--bg-soft); color: var(--text-muted); display: grid; place-items: center; cursor: pointer; border: none; transition: all 0.2s ease;" title="Xóa tìm kiếm">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              ` : ''}
            </div>

            <!-- Right Side: Filter Pills + Styled Dropdowns + Reset Button -->
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: flex-end;">
              
              <!-- Filter Status Pills (Tất cả (x), Chờ duyệt (x), Đã duyệt (x)) -->
              <div style="display: inline-flex; align-items: center; gap: 4px; background: var(--bg-soft); padding: 4px; border-radius: 12px; border: 1px solid var(--border);">
                <button type="button" onclick="setCancelStatusFilter('all')" style="height: 34px; padding: 0 13px; border-radius: 8px; border: none; font-size: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s ease; ${activeCancelStatusFilter === 'all' ? 'background: #ef4444; color: #ffffff; box-shadow: 0 2px 8px rgba(239,68,68,0.35);' : 'background: transparent; color: var(--text-soft);'}">
                  Tất cả (${allCancelClaims.length})
                </button>
                <button type="button" onclick="setCancelStatusFilter('cho_duyet')" style="height: 34px; padding: 0 13px; border-radius: 8px; border: none; font-size: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s ease; ${activeCancelStatusFilter === 'cho_duyet' ? 'background: #d97706; color: #ffffff; box-shadow: 0 2px 8px rgba(245,158,11,0.35);' : 'background: transparent; color: var(--text-soft);'}">
                  Chờ duyệt (${choDuyetCount})
                </button>
                <button type="button" onclick="setCancelStatusFilter('da_duyet')" style="height: 34px; padding: 0 13px; border-radius: 8px; border: none; font-size: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s ease; ${activeCancelStatusFilter === 'da_duyet' ? 'background: #3b82f6; color: #ffffff; box-shadow: 0 2px 8px rgba(59,130,246,0.35);' : 'background: transparent; color: var(--text-soft);'}">
                  Đã duyệt (${daDuyetCount})
                </button>
              </div>

              <!-- Filter GĐV (Custom Dropdown) -->
              <div class="custom-select-wrapper" style="position: relative;">
                <button type="button" id="btnCancelGdvTrigger" class="custom-select-trigger" onclick="toggleCustomDropdownMenu('ddCancelGdvMenu', event)" style="height: 42px; padding: 0 14px; border-radius: 12px; background: var(--bg-soft); border: 1px solid var(--border); font-size: 12px; font-weight: 750; color: var(--text-main); display: inline-flex; align-items: center; gap: 8px; cursor: pointer; min-width: 140px; max-width: 185px; justify-content: space-between; box-shadow: var(--shadow-xs); transition: all 0.2s ease;">
                  <span style="display: flex; align-items: center; gap: 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#3b82f6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtmlOutput(activeGdvLabel)}</span>
                  </span>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted); flex-shrink: 0;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>

                <div id="ddCancelGdvMenu" class="custom-select-menu" style="display: ${activeOpenDropdownId === 'ddCancelGdvMenu' ? 'block' : 'none'}; position: absolute; top: calc(100% + 6px); right: 0; min-width: 220px; max-width: 280px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 14px; box-shadow: 0 16px 36px rgba(0,0,0,0.25); z-index: 999; padding: 6px; backdrop-filter: blur(16px); max-height: 300px; overflow-y: auto;">
                  <div class="custom-select-item ${activeCancelGdvFilter === 'all' ? 'active' : ''}" data-gdv-option="all" onclick="setCancelGdvFilter('all')" style="padding: 8px 12px; border-radius: 9px; font-size: 12.5px; font-weight: 700; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 2px; transition: all 0.15s ease; ${activeCancelGdvFilter === 'all' ? 'background: rgba(59,130,246,0.12); color: #3b82f6; font-weight: 850;' : ''}">
                    <span style="display: flex; align-items: center; gap: 7px;">
                      <span style="width: 7px; height: 7px; border-radius: 50%; background: #3b82f6; flex-shrink: 0;"></span>
                      <span>Tất cả GĐV (${uniqueGdvs.length})</span>
                    </span>
                    ${activeCancelGdvFilter === 'all' ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                  </div>
                  ${uniqueGdvs.map(g => `
                    <div class="custom-select-item ${g === activeCancelGdvFilter ? 'active' : ''}" data-gdv-option="${escapeAttributeData(g)}" onclick="setCancelGdvFilter('${escapeAttributeData(g)}')" style="padding: 8px 12px; border-radius: 9px; font-size: 12.5px; font-weight: 700; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 2px; transition: all 0.15s ease; ${g === activeCancelGdvFilter ? 'background: rgba(59,130,246,0.12); color: #3b82f6; font-weight: 850;' : ''}">
                      <span style="display: flex; align-items: center; gap: 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981; flex-shrink: 0;"></span>
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtmlOutput(g)}</span>
                      </span>
                      ${g === activeCancelGdvFilter ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- Filter Chi nhánh (Custom Dropdown) -->
              <div class="custom-select-wrapper" style="position: relative;">
                <button type="button" id="btnCancelBranchTrigger" class="custom-select-trigger" onclick="toggleCustomDropdownMenu('ddCancelBranchMenu', event)" style="height: 42px; padding: 0 14px; border-radius: 12px; background: var(--bg-soft); border: 1px solid var(--border); font-size: 12px; font-weight: 750; color: var(--text-main); display: inline-flex; align-items: center; gap: 8px; cursor: pointer; min-width: 140px; max-width: 185px; justify-content: space-between; box-shadow: var(--shadow-xs); transition: all 0.2s ease;">
                  <span style="display: flex; align-items: center; gap: 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22.01"></line><line x1="15" y1="22" x2="15" y2="22.01"></line><line x1="9" y1="18" x2="9" y2="18.01"></line><line x1="15" y1="18" x2="15" y2="18.01"></line><line x1="9" y1="14" x2="9" y2="14.01"></line><line x1="15" y1="14" x2="15" y2="14.01"></line><line x1="9" y1="10" x2="9" y2="10.01"></line><line x1="15" y1="10" x2="15" y2="10.01"></line><line x1="9" y1="6" x2="9" y2="6.01"></line><line x1="15" y1="6" x2="15" y2="6.01"></line></svg>
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtmlOutput(activeBranchLabel)}</span>
                  </span>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted); flex-shrink: 0;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>

                <div id="ddCancelBranchMenu" class="custom-select-menu" style="display: ${activeOpenDropdownId === 'ddCancelBranchMenu' ? 'block' : 'none'}; position: absolute; top: calc(100% + 6px); right: 0; min-width: 220px; max-width: 280px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 14px; box-shadow: 0 16px 36px rgba(0,0,0,0.25); z-index: 999; padding: 6px; backdrop-filter: blur(16px); max-height: 300px; overflow-y: auto;">
                  <div class="custom-select-item ${activeCancelBranchFilter === 'all' ? 'active' : ''}" data-branch-option="all" onclick="setCancelBranchFilter('all')" style="padding: 8px 12px; border-radius: 9px; font-size: 12.5px; font-weight: 700; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 2px; transition: all 0.15s ease; ${activeCancelBranchFilter === 'all' ? 'background: rgba(16,185,129,0.12); color: #10b981; font-weight: 850;' : ''}">
                    <span style="display: flex; align-items: center; gap: 7px;">
                      <span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981; flex-shrink: 0;"></span>
                      <span>Tất cả Chi nhánh</span>
                    </span>
                    ${activeCancelBranchFilter === 'all' ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                  </div>
                  ${uniqueBranches.map(b => `
                    <div class="custom-select-item ${b === activeCancelBranchFilter ? 'active' : ''}" data-branch-option="${escapeAttributeData(b)}" onclick="setCancelBranchFilter('${escapeAttributeData(b)}')" style="padding: 8px 12px; border-radius: 9px; font-size: 12.5px; font-weight: 700; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 2px; transition: all 0.15s ease; ${b === activeCancelBranchFilter ? 'background: rgba(16,185,129,0.12); color: #10b981; font-weight: 850;' : ''}">
                      <span style="display: flex; align-items: center; gap: 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981; flex-shrink: 0;"></span>
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtmlOutput(b)}</span>
                      </span>
                      ${b === activeCancelBranchFilter ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- Filter Nhóm lý do (Custom Dropdown) -->
              <div class="custom-select-wrapper" style="position: relative;">
                <button type="button" id="btnCancelReasonTrigger" class="custom-select-trigger" onclick="toggleCustomDropdownMenu('ddCancelReasonMenu', event)" style="height: 42px; padding: 0 14px; border-radius: 12px; background: var(--bg-soft); border: 1px solid var(--border); font-size: 12px; font-weight: 750; color: var(--text-main); display: inline-flex; align-items: center; gap: 8px; cursor: pointer; min-width: 150px; max-width: 195px; justify-content: space-between; box-shadow: var(--shadow-xs); transition: all 0.2s ease;">
                  <span style="display: flex; align-items: center; gap: 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtmlOutput(activeReasonLabel)}</span>
                  </span>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted); flex-shrink: 0;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>

                <div id="ddCancelReasonMenu" class="custom-select-menu" style="display: ${activeOpenDropdownId === 'ddCancelReasonMenu' ? 'block' : 'none'}; position: absolute; top: calc(100% + 6px); right: 0; min-width: 250px; max-width: 320px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 14px; box-shadow: 0 16px 36px rgba(0,0,0,0.25); z-index: 999; padding: 6px; backdrop-filter: blur(16px); max-height: 320px; overflow-y: auto;">
                  ${cancelReasonOptions.map(opt => `
                    <div class="custom-select-item ${opt.code === activeCancelReasonCodeFilter ? 'active' : ''}" data-reason-option="${opt.code}" onclick="setCancelReasonFilter('${opt.code}')" style="padding: 8px 12px; border-radius: 9px; font-size: 12px; font-weight: 700; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 2px; transition: all 0.15s ease; ${opt.code === activeCancelReasonCodeFilter ? 'background: rgba(239,68,68,0.12); color: #ef4444; font-weight: 850;' : ''}">
                      <span style="display: flex; align-items: center; gap: 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <span style="width: 7px; height: 7px; border-radius: 50%; background: ${opt.code === 'all' ? '#6b7280' : '#ef4444'}; flex-shrink: 0;"></span>
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeAttributeData(opt.full)}">${escapeHtmlOutput(opt.short)}</span>
                      </span>
                      ${opt.code === activeCancelReasonCodeFilter ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- Quick Reset Filters Button -->
              <button type="button" class="btn-premium btn-secondary" onclick="resetAllCancellationFilters()" title="Đặt lại bộ lọc" style="width: 42px; height: 42px; min-width: 42px; min-height: 42px; padding: 0; border-radius: 12px; display: grid; place-items: center; cursor: pointer;" aria-label="Đặt lại bộ lọc">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
              </button>
            </div>

          </div>

          <!-- TABLE CONTAINER (STANDALONE CARD matching software table-container class) -->
          <div class="table-container" style="border: 1px solid var(--border); border-radius: 16px; background: var(--surface); overflow: hidden; box-shadow: var(--shadow-sm);">
            <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
              <table class="p-table" style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
                <thead>
                  <tr style="background: var(--bg-soft); border-bottom: 2px solid var(--border-strong); color: var(--text-soft); font-weight: 850; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px;">
                    <th style="padding: 12px 10px; text-align: center; width: 45px;">STT</th>
                    <th style="padding: 12px 10px; text-align: center; width: 130px;">Trạng thái</th>
                    <th style="padding: 12px 10px; min-width: 140px;">Biển số xe / Chủ xe</th>
                    <th style="padding: 12px 10px; min-width: 140px;">Số HSBT</th>
                    <th style="padding: 12px 10px; min-width: 130px;">Giám định viên</th>
                    <th style="padding: 12px 10px; max-width: 140px;">Đơn vị cấp đơn</th>
                    <th style="padding: 12px 10px; text-align: center; width: 100px;">Ngày tổn thất</th>
                    <th style="padding: 12px 10px; text-align: right; width: 125px;">Dự phòng BT</th>
                    <th style="padding: 12px 10px; min-width: 180px; color: #ef4444;">Mã & Lý do hủy</th>
                    <th style="padding: 12px 10px; min-width: 220px; color: var(--primary);">Ghi chú giải trình</th>
                    ${isAdmin ? `<th style="padding: 12px 10px; text-align: center; width: 90px; color: #ef4444;">Thao tác</th>` : ''}
                  </tr>
                </thead>
                <tbody>
                  ${filtered.length === 0 ? `
                    <tr>
                      <td colspan="${isAdmin ? 11 : 10}" style="text-align: center; padding: 48px 20px; color: var(--text-soft);">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.5; color: #ef4444;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                          <span style="font-weight: 750; font-size: 14px;">${allCancelClaims.length === 0 ? 'Chưa có hồ sơ nào được đề xuất hủy.' : 'Không tìm thấy hồ sơ đề xuất hủy nào thỏa mãn điều kiện lọc.'}</span>
                          ${allCancelClaims.length === 0 ? '<span style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">Để thêm hồ sơ vào bảng này, vào <b>Quản lý Hồ sơ tồn & Báo cáo tổn thất</b>, mở chi tiết hồ sơ cần hủy và bấm nút <b>[ ✕ Hủy hồ sơ ]</b> trên thanh tiêu đề.</span>' : ''}
                        </div>
                      </td>
                    </tr>
                  ` : rowsHtml}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      `;
    }


    function setCancelSearch(val) {
      activeCancelSearch = val || '';
      renderClaimCancellationPage();
    }


    function setCancelGdvFilter(val) {
      activeCancelGdvFilter = val;
      activeOpenDropdownId = null;
      document.querySelectorAll('.custom-select-menu').forEach(m => m.style.display = 'none');
      renderClaimCancellationPage();
    }


    function setCancelBranchFilter(val) {
      activeCancelBranchFilter = val;
      activeOpenDropdownId = null;
      document.querySelectorAll('.custom-select-menu').forEach(m => m.style.display = 'none');
      renderClaimCancellationPage();
    }


    function setCancelReasonFilter(val) {
      activeCancelReasonCodeFilter = val;
      activeOpenDropdownId = null;
      document.querySelectorAll('.custom-select-menu').forEach(m => m.style.display = 'none');
      renderClaimCancellationPage();
    }


    async function deleteClaimCancellationProposalByAdmin(claimId, event) {
      if (event) event.stopPropagation();
      const isAdmin = activeUserProfile && String(activeUserProfile.role || '').trim().toLowerCase() === 'admin';
      if (!isAdmin) {
        triggerToast('Chỉ tài khoản Quản trị viên (Admin) mới có quyền xóa đề xuất hủy!', 'warning');
        return;
      }
      if (!claimId) return;
      const cancelRecord = (cachedClaimCancellationsPayload || {})[claimId] || {};
      const claim = (cachedPendingClaimsPayload || {})[claimId] || {};
      const isApproved = (cancelRecord.cancelStatus === 'da_duyet' || claim.cancelStatus === 'da_duyet' || claim.trangThai === 'tu_choi');
      if (isApproved) {
        triggerToast('Hồ sơ này đã được duyệt hủy nên không thể xóa!', 'warning');
        return;
      }
      const bsx = cancelRecord.bienSo || claim.bienSo || cancelRecord.soHoSoBoiThuong || claim.soHoSoBoiThuong || 'hồ sơ';

      const isConfirmed = await showConfirmModal(
        'Xóa đề xuất hủy hồ sơ',
        `Bạn có chắc chắn muốn XÓA đề xuất hủy của hồ sơ xe ${bsx} không?\n\n(Hồ sơ sẽ được khôi phục trở lại danh sách hồ sơ tồn bình thường)`,
        'Xác nhận xóa',
        'Hủy bỏ'
      );
      if (!isConfirmed) return;

      try {
        if (dbNodeInstance) {
          // 1. Xóa hoàn toàn khỏi bảng claim_cancellations
          await dbNodeInstance.ref(`claim_cancellations/${claimId}`).remove();
          // 2. Gỡ cờ trong pending_claims (nếu có)
          await dbNodeInstance.ref(`pending_claims/${claimId}`).update({
            deXuatHuy: false,
            cancelStatus: 'da_xoa_de_xuat',
            cancelReasonCode: null,
            lyDoHuy: null,
            cancelNotes: null,
            cancelProposedBy: null,
            cancelProposedAt: null,
            updatedAt: Date.now()
          }).catch(() => {});
        }

        if (cachedClaimCancellationsPayload) {
          delete cachedClaimCancellationsPayload[claimId];
        }
        if (cachedPendingClaimsPayload && cachedPendingClaimsPayload[claimId]) {
          cachedPendingClaimsPayload[claimId].deXuatHuy = false;
          cachedPendingClaimsPayload[claimId].cancelStatus = 'da_xoa_de_xuat';
        }

        triggerToast(`Đã xóa đề xuất hủy cho hồ sơ ${bsx} thành công!`, 'success');
        if (typeof editingPendingClaimId !== 'undefined' && editingPendingClaimId === claimId) {
          updateHeaderCancelClaimProposalButton(cachedPendingClaimsPayload?.[claimId]);
        }
        if (activeDashboardTab === 'claim_cancellation' && typeof renderClaimCancellationPage === 'function') {
          renderClaimCancellationPage();
        }
        if (typeof executeUIRenderPendingClaims === 'function') {
          executeUIRenderPendingClaims();
        }
        if (typeof renderPendingClaimsTable === 'function') {
          renderPendingClaimsTable();
        }
      } catch (err) {
        console.error("Lỗi xóa đề xuất hủy:", err);
        triggerToast('Lỗi khi xóa đề xuất: ' + err.message, 'error');
      }
    }


    function resetAllCancellationFilters() {
      activeCancelSearch = '';
      activeCancelStatusFilter = 'cho_duyet';
      activeCancelGdvFilter = 'all';
      activeCancelBranchFilter = 'all';
      activeCancelReasonCodeFilter = 'all';
      renderClaimCancellationPage();
      triggerToast('Đã đặt lại bộ lọc dữ liệu!', 'info');
    }


    function setCancelStatusFilter(val) {
      activeCancelStatusFilter = val;
      renderClaimCancellationPage();
    }


    // Dựng nội dung nút tác vụ ở header theo cùng cấu trúc với markup tĩnh trong index.html
    // (chip icon + nhãn) để nút trạng thái hủy không bị "rơi" khỏi hệ thiết kế khi JS đổi trạng thái.
    const HEADER_CLAIM_ACTION_ICONS = {
      cancel: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6m0-6 6 6"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
    };
    function headerClaimActionMarkup(iconKey, label) {
      const paths = HEADER_CLAIM_ACTION_ICONS[iconKey] || HEADER_CLAIM_ACTION_ICONS.cancel;
      const safeLabel = String(label).replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
      return `<span class="ce-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg></span><span class="ce-action-label">${safeLabel}</span>`;
    }


    function updateHeaderCancelClaimProposalButton(item) {
      const cancelBtn = document.getElementById('btnHeaderCancelClaimProposal');
      const revertBtn = document.getElementById('btnHeaderRevertCancelProposal');
      if (!cancelBtn) return;
      if (!item) {
        cancelBtn.style.display = 'none';
        if (revertBtn) revertBtn.style.display = 'none';
        return;
      }
      cancelBtn.style.display = 'inline-flex';
      const cancelRecord = (cachedClaimCancellationsPayload || {})[item.id || item._id];
      const isProposed = (item.deXuatHuy === true || item.deXuatHuy === 'co' || item.isCancelProposal === true || (cancelRecord && cancelRecord.cancelStatus !== 'da_hoan_tac' && cancelRecord.cancelStatus !== 'da_xoa_de_xuat'));
      const isDeclined = isProposed && ((cancelRecord && cancelRecord.cancelStatus === 'da_duyet') || item.cancelStatus === 'da_duyet' || item.trangThai === 'tu_choi');

      if (isDeclined) {
        cancelBtn.className = 'btn-header-claim-action btn-header-cancel-declined';
        cancelBtn.innerHTML = headerClaimActionMarkup('lock', 'Đã duyệt hủy');
        cancelBtn.title = 'Hồ sơ đã được phê duyệt Từ chối/Hủy. Nhấp để xem chi tiết lý do';
        if (revertBtn) revertBtn.style.display = 'none';
      } else if (isProposed) {
        cancelBtn.className = 'btn-header-claim-action btn-header-cancel-proposed';
        cancelBtn.innerHTML = headerClaimActionMarkup('clock', 'Đã đề xuất hủy');
        cancelBtn.title = 'Hồ sơ đang ở trạng thái Chờ duyệt hủy. Nhấp để điều chỉnh lý do đề xuất';
        if (revertBtn) {
          revertBtn.className = 'btn-header-claim-action btn-header-revert-cancel';
          revertBtn.style.display = 'inline-flex';
        }
      } else {
        cancelBtn.className = 'btn-header-claim-action btn-header-cancel-normal';
        cancelBtn.innerHTML = headerClaimActionMarkup('cancel', 'Hủy hồ sơ');
        cancelBtn.title = 'Nhấp để chuyển hồ sơ sang trạng thái Đề xuất hủy';
        if (revertBtn) revertBtn.style.display = 'none';
      }
    }


    async function triggerHeaderRevertCancelAction() {
      if (!editingPendingClaimId) return;
      await revertClaimCancellationProposal(editingPendingClaimId);
      const updatedItem = (cachedPendingClaimsPayload || {})[editingPendingClaimId];
      updateHeaderCancelClaimProposalButton(updatedItem);
    }


    function triggerHeaderClaimCancelAction() {
      if (!editingPendingClaimId) return;
      openCreateCancellationProposalModal(editingPendingClaimId);
    }


    async function revertCancellationFromModal() {
      if (!activeCancelProposalClaimId) return;
      await revertClaimCancellationProposal(activeCancelProposalClaimId);
      closeCreateCancellationProposalModal();
      if (typeof editingPendingClaimId !== 'undefined' && editingPendingClaimId === activeCancelProposalClaimId) {
        updateHeaderCancelClaimProposalButton(cachedPendingClaimsPayload?.[activeCancelProposalClaimId]);
      }
    }


    function openCreateCancellationProposalModal(claimId) {
      activeCancelProposalClaimId = claimId || null;
      const modal = document.getElementById('createCancellationProposalModalOverlay');
      if (!modal) return;

      const pickerGroup = document.getElementById('cancelClaimPickerGroup');
      const selectedCard = document.getElementById('cancelSelectedClaimCard');
      const searchInput = document.getElementById('txtCancelClaimSearchInput');
      const searchResults = document.getElementById('cancelClaimSearchResults');
      const reasonSelect = document.getElementById('selCancelReasonCode');
      const notesTextarea = document.getElementById('txtCancelNotes');


      if (searchResults) searchResults.classList.remove('open');

      if (claimId) {
        const claim = (cachedPendingClaimsPayload || {})[claimId] || {};
        const cancelRecord = (cachedClaimCancellationsPayload || {})[claimId] || {};
        if (pickerGroup) pickerGroup.style.display = 'none';
        if (selectedCard) {
          selectedCard.style.display = 'block';
          document.getElementById('cancelCardBsx').textContent = cancelRecord.bienSo || claim.bienSo || '—';
          document.getElementById('cancelCardHsbt').textContent = 'HSBT: ' + (cancelRecord.soHoSoBoiThuong || claim.soHoSoBoiThuong || claim.soHsbt || 'Chưa gán');
          document.getElementById('cancelCardOwner').textContent = cancelRecord.chuXe || claim.chuXe || claim.khachHang || '—';
          document.getElementById('cancelCardGdv').textContent = cancelRecord.gdvTiepNhan || claim.gdvTiepNhan || claim.canBoXuLy || '—';
          document.getElementById('cancelCardDuPhong').textContent = (formatCurrencyInputNumber(cancelRecord.duPhongBoiThuong || claim.duPhongBoiThuong) || '0') + ' đ';
        }

        if (reasonSelect) {
          reasonSelect.value = cancelRecord.cancelReasonCode || claim.cancelReasonCode || 'HUY_10';
        }
        if (notesTextarea) {
          notesTextarea.value = cancelRecord.cancelNotes || claim.cancelNotes || claim.ghiChu || claim.ghiChuHoSo || '';
          if (!notesTextarea.value.trim()) {
            const rObj = CANCELLATION_REASONS.find(r => r.code === (reasonSelect?.value || 'HUY_10'));
            notesTextarea.value = rObj ? rObj.label : 'Đề xuất hủy hồ sơ bồi thường';
          }
        }

        const isApproved = (cancelRecord && cancelRecord.cancelStatus === 'da_duyet') || claim.cancelStatus === 'da_duyet' || claim.trangThai === 'tu_choi';
        const isCancelExisting = (cancelRecord && cancelRecord.cancelStatus !== 'da_hoan_tac' && cancelRecord.cancelStatus !== 'da_xoa_de_xuat') || (claim.deXuatHuy === true || claim.deXuatHuy === 'co' || claim.isCancelProposal === true);
        document.getElementById('cancelModalTitle').textContent = isApproved ? 'Hồ sơ đã Duyệt Hủy' : (isCancelExisting ? 'Đề xuất Hủy Hồ sơ' : 'Chuyển Đề xuất Hủy Hồ sơ');
      } else {
        if (pickerGroup) pickerGroup.style.display = 'block';
        if (selectedCard) selectedCard.style.display = 'none';
        if (searchInput) searchInput.value = '';
        if (reasonSelect) reasonSelect.value = 'HUY_10';
        if (notesTextarea) notesTextarea.value = '';

        document.getElementById('cancelModalTitle').textContent = 'Lập Đề xuất Hủy Hồ sơ';
      }

      modal.style.display = 'grid';
      modal.setAttribute('aria-hidden', 'false');
    }


    function closeCreateCancellationProposalModal() {
      const modal = document.getElementById('createCancellationProposalModalOverlay');
      if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
      }
      activeCancelProposalClaimId = null;
    }


    function searchClaimsForCancellation(query) {
      const resultsContainer = document.getElementById('cancelClaimSearchResults');
      if (!resultsContainer) return;

      const q = (query || '').trim().toLowerCase();
      if (!q) {
        resultsContainer.style.display = 'none';
        return;
      }

      const allClaims = Object.entries(cachedPendingClaimsPayload || {}).map(([k, v]) => ({
        ...v,
        id: k
      }));

      const matches = allClaims.filter(c => {
        const bsx = String(c.bienSo || '').toLowerCase();
        const hsbt = String(c.soHoSoBoiThuong || c.soHsbt || '').toLowerCase();
        const owner = String(c.chuXe || c.khachHang || '').toLowerCase();
        return bsx.includes(q) || hsbt.includes(q) || owner.includes(q);
      }).slice(0, 8);

      if (matches.length === 0) {
        resultsContainer.innerHTML = '<div style="padding: 12px; font-size: 12px; color: var(--text-soft); text-align: center;">Không tìm thấy hồ sơ nào khớp.</div>';
      } else {
        resultsContainer.innerHTML = matches.map(m => `
          <div onclick="selectClaimForCancellation('${m.id}')" style="padding: 10px 14px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background='var(--bg-soft)'" onmouseout="this.style.background='transparent'">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong style="color: var(--primary); font-size: 13px;">${escapeHtmlOutput(m.bienSo || '—')}</strong>
              <span style="font-size: 11px; color: var(--text-soft); font-weight: 700;">${escapeHtmlOutput(m.soHoSoBoiThuong || m.soHsbt || '')}</span>
            </div>
            <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
              ${escapeHtmlOutput(m.chuXe || m.khachHang || 'Khách hàng')} • GĐV: ${escapeHtmlOutput(m.gdvTiepNhan || m.canBoXuLy || 'Chưa phân công')}
            </div>
          </div>
        `).join('');
      }

      resultsContainer.style.display = 'block';
    }


    function selectClaimForCancellation(claimId) {
      activeCancelProposalClaimId = claimId;
      const claim = (cachedPendingClaimsPayload || {})[claimId] || {};
      const resultsContainer = document.getElementById('cancelClaimSearchResults');
      if (resultsContainer) resultsContainer.style.display = 'none';

      const selectedCard = document.getElementById('cancelSelectedClaimCard');
      if (selectedCard) {
        selectedCard.style.display = 'block';
        document.getElementById('cancelCardBsx').textContent = claim.bienSo || '—';
        document.getElementById('cancelCardHsbt').textContent = 'HSBT: ' + (claim.soHoSoBoiThuong || claim.soHsbt || 'Chưa gán');
        document.getElementById('cancelCardOwner').textContent = claim.chuXe || claim.khachHang || '—';
        document.getElementById('cancelCardGdv').textContent = claim.gdvTiepNhan || claim.canBoXuLy || '—';
        document.getElementById('cancelCardDuPhong').textContent = (formatCurrencyInputNumber(claim.duPhongBoiThuong) || '0') + ' đ';
      }
    }


    function handleCancelReasonChange(reasonCode) {
      const reasonObj = CANCELLATION_REASONS.find(r => r.code === reasonCode);
      const notesArea = document.getElementById('txtCancelNotes');
      if (notesArea && !notesArea.value.trim() && reasonObj) {
        notesArea.value = reasonObj.label;
      }
    }


    async function saveCancellationProposalFromModal() {
      if (!activeCancelProposalClaimId) {
        triggerToast('Vui lòng chọn hồ sơ cần lập đề xuất hủy.', 'warning');
        return;
      }

      const reasonCode = document.getElementById('selCancelReasonCode')?.value || 'HUY_10';
      const notes = (document.getElementById('txtCancelNotes')?.value || '').trim();
      const reasonObj = CANCELLATION_REASONS.find(r => r.code === reasonCode);
      const reasonLabel = reasonObj ? reasonObj.label : reasonCode;

      if (!notes) {
        triggerToast('Vui lòng nhập ghi chú giải trình chi tiết lý do hủy.', 'warning');
        return;
      }

      const btnSave = document.getElementById('btnSaveCancelProposal');
      if (btnSave) btnSave.disabled = true;

      try {
        const targetClaimId = activeCancelProposalClaimId;
        const currentUser = (activeUserProfile?.displayName || activeUserProfile?.fullName || 'Hệ thống');
        const claimObj = (cachedPendingClaimsPayload || {})[targetClaimId] || {};

        const proposalRecord = {
          id: targetClaimId,
          claimId: targetClaimId,
          bienSo: claimObj.bienSo || claimObj.bienSoXe || '',
          soHoSoBoiThuong: claimObj.soHoSoBoiThuong || claimObj.soHsbt || '',
          chuXe: claimObj.chuXe || claimObj.khachHang || claimObj.tenLaiXe || claimObj.hoTen || '',
          khachHang: claimObj.khachHang || claimObj.chuXe || '',
          gdvTiepNhan: claimObj.gdvTiepNhan || claimObj.canBoXuLy || claimObj.gdvHo || currentUser,
          canBoXuLy: claimObj.canBoXuLy || claimObj.gdvTiepNhan || '',
          gdvHienTruong: claimObj.gdvHienTruong || '',
          gdvHo: claimObj.gdvHo || '',
          donViCapDon: claimObj.donViCapDon || claimObj.chiNhanh || '',
          chiNhanh: claimObj.chiNhanh || claimObj.donViCapDon || '',
          ngayVTT: claimObj.ngayVTT || claimObj.ngayTonThat || '',
          ngayTonThat: claimObj.ngayTonThat || claimObj.ngayVTT || '',
          ngayMoHs: claimObj.ngayMoHs || '',
          duPhongBoiThuong: claimObj.duPhongBoiThuong || '0',
          cancelReasonCode: reasonCode,
          lyDoHuy: reasonLabel,
          cancelNotes: notes,
          cancelProposedBy: currentUser,
          cancelProposedAt: Date.now(),
          cancelStatus: 'cho_duyet',
          trangThai: 'cho_duyet',
          hangXe: claimObj.hangXe || '',
          hieuXe: claimObj.hieuXe || '',
          createdAt: claimObj.createdAt || Date.now(),
          updatedAt: Date.now()
        };

        if (dbNodeInstance) {
          // 1. Lưu bản ghi độc lập vào bảng claim_cancellations
          await dbNodeInstance.ref(`claim_cancellations/${targetClaimId}`).set(proposalRecord);
          // 2. Gán cờ phụ vào pending_claims (nếu có)
          await dbNodeInstance.ref(`pending_claims/${targetClaimId}`).update({
            deXuatHuy: true,
            cancelReasonCode: reasonCode,
            lyDoHuy: reasonLabel,
            cancelNotes: notes,
            cancelProposedBy: currentUser,
            cancelProposedAt: Date.now(),
            cancelStatus: 'cho_duyet',
            updatedAt: Date.now()
          }).catch(() => {});
        }

        if (cachedClaimCancellationsPayload) {
          cachedClaimCancellationsPayload[targetClaimId] = proposalRecord;
        }
        if (cachedPendingClaimsPayload && cachedPendingClaimsPayload[targetClaimId]) {
          cachedPendingClaimsPayload[targetClaimId] = {
            ...cachedPendingClaimsPayload[targetClaimId],
            deXuatHuy: true,
            cancelStatus: 'cho_duyet'
          };
        }

        triggerToast('Đã chuyển hồ sơ sang trạng thái Đề xuất hủy thành công!', 'success');
        closeCreateCancellationProposalModal();
        if (typeof editingPendingClaimId !== 'undefined' && editingPendingClaimId === targetClaimId) {
          updateHeaderCancelClaimProposalButton(cachedPendingClaimsPayload[targetClaimId]);
        }
        if (activeDashboardTab === 'claim_cancellation' && typeof renderClaimCancellationPage === 'function') {
          renderClaimCancellationPage();
        }
        if (typeof executeUIRenderPendingClaims === 'function') {
          executeUIRenderPendingClaims();
        }
        if (typeof renderPendingClaimsTable === 'function') {
          renderPendingClaimsTable();
        }
      } catch (err) {
        console.error("Lỗi lưu đề xuất hủy:", err);
        triggerToast('Lỗi khi lưu đề xuất: ' + err.message, 'error');
      } finally {
        if (btnSave) btnSave.disabled = false;
      }
    }


    async function approveClaimCancellation(claimId) {
      if (!claimId) return;
      const claim = (cachedPendingClaimsPayload || {})[claimId] || {};
      const bsx = claim.bienSo || claim.soHoSoBoiThuong || 'hồ sơ';

      const isConfirmed = await showConfirmModal(
        'Phê duyệt hủy hồ sơ',
        `Bạn có chắc chắn muốn PHÊ DUYỆT HỦY cho hồ sơ xe ${bsx}?\n\n(Hồ sơ sẽ được chuyển trạng thái sang "Từ chối bồi thường")`,
        'Phê duyệt hủy',
        'Hủy bỏ'
      );
      if (!isConfirmed) return;

      try {
        const currentUser = (activeUserProfile?.displayName || activeUserProfile?.fullName || 'Hệ thống');
        const cancelUpdates = {
          cancelStatus: 'da_duyet',
          cancelApprovedBy: currentUser,
          cancelApprovedAt: Date.now(),
          updatedAt: Date.now()
        };

        if (dbNodeInstance) {
          // 1. Cập nhật bảng claim_cancellations
          await dbNodeInstance.ref(`claim_cancellations/${claimId}`).update(cancelUpdates);
          // 2. Cập nhật bảng pending_claims (nếu có)
          await dbNodeInstance.ref(`pending_claims/${claimId}`).update({
            trangThai: 'tu_choi',
            cancelStatus: 'da_duyet',
            cancelApprovedBy: currentUser,
            cancelApprovedAt: Date.now(),
            updatedAt: Date.now()
          }).catch(() => {});
        }

        if (cachedClaimCancellationsPayload && cachedClaimCancellationsPayload[claimId]) {
          cachedClaimCancellationsPayload[claimId] = {
            ...cachedClaimCancellationsPayload[claimId],
            ...cancelUpdates
          };
        }
        if (cachedPendingClaimsPayload && cachedPendingClaimsPayload[claimId]) {
          cachedPendingClaimsPayload[claimId] = {
            ...cachedPendingClaimsPayload[claimId],
            trangThai: 'tu_choi',
            cancelStatus: 'da_duyet'
          };
        }

        triggerToast(`Đã phê duyệt hủy hồ sơ ${bsx} thành công!`, 'success');
        if (activeDashboardTab === 'claim_cancellation' && typeof renderClaimCancellationPage === 'function') {
          renderClaimCancellationPage();
        }
        if (typeof executeUIRenderPendingClaims === 'function') {
          executeUIRenderPendingClaims();
        }
        if (typeof renderPendingClaimsTable === 'function') {
          renderPendingClaimsTable();
        }
      } catch (err) {
        console.error("Lỗi duyệt hủy:", err);
        triggerToast('Lỗi duyệt hủy: ' + err.message, 'error');
      }
    }


    async function revertClaimCancellationProposal(claimId) {
      if (!claimId) return;
      const cancelRecord = (cachedClaimCancellationsPayload || {})[claimId] || {};
      const claim = (cachedPendingClaimsPayload || {})[claimId] || {};
      const isApproved = (cancelRecord.cancelStatus === 'da_duyet' || claim.cancelStatus === 'da_duyet' || claim.trangThai === 'tu_choi');
      if (isApproved) {
        triggerToast('Hồ sơ này đã được duyệt hủy nên không thể xóa hoặc hoàn tác!', 'warning');
        return;
      }
      const bsx = cancelRecord.bienSo || claim.bienSo || cancelRecord.soHoSoBoiThuong || claim.soHoSoBoiThuong || 'hồ sơ';

      const isConfirmed = await showConfirmModal(
        'Hủy bỏ đề xuất hủy',
        `Bạn có chắc muốn HỦY BỎ đề xuất hủy cho hồ sơ xe ${bsx}?\n\n(Hồ sơ sẽ được gỡ khỏi danh sách đề xuất hủy và quay về trạng thái bình thường)`,
        'Xác nhận hủy bỏ',
        'Đóng'
      );
      if (!isConfirmed) return;

      try {
        if (dbNodeInstance) {
          // 1. Xóa khỏi bảng claim_cancellations
          await dbNodeInstance.ref(`claim_cancellations/${claimId}`).remove();
          // 2. Khôi phục trạng thái trong pending_claims (nếu có)
          const updates = {
            deXuatHuy: false,
            cancelStatus: 'da_hoan_tac',
            updatedAt: Date.now()
          };
          if (claim.trangThai === 'tu_choi') {
            updates.trangThai = 'moi';
          }
          await dbNodeInstance.ref(`pending_claims/${claimId}`).update(updates).catch(() => {});
        }

        if (cachedClaimCancellationsPayload) {
          delete cachedClaimCancellationsPayload[claimId];
        }
        if (cachedPendingClaimsPayload && cachedPendingClaimsPayload[claimId]) {
          cachedPendingClaimsPayload[claimId].deXuatHuy = false;
          cachedPendingClaimsPayload[claimId].cancelStatus = 'da_hoan_tac';
          if (cachedPendingClaimsPayload[claimId].trangThai === 'tu_choi') {
            cachedPendingClaimsPayload[claimId].trangThai = 'moi';
          }
        }

        triggerToast(`Đã hoàn tác đề xuất hủy cho ${bsx}!`, 'info');
        if (typeof editingPendingClaimId !== 'undefined' && editingPendingClaimId === claimId) {
          updateHeaderCancelClaimProposalButton(cachedPendingClaimsPayload?.[claimId]);
        }
        if (activeDashboardTab === 'claim_cancellation' && typeof renderClaimCancellationPage === 'function') {
          renderClaimCancellationPage();
        }
        if (typeof executeUIRenderPendingClaims === 'function') {
          executeUIRenderPendingClaims();
        }
        if (typeof renderPendingClaimsTable === 'function') {
          renderPendingClaimsTable();
        }
      } catch (err) {
        console.error("Lỗi hoàn tác:", err);
        triggerToast('Lỗi hoàn tác: ' + err.message, 'error');
      }
    }


    function openImportApprovedCancellationExcelModal() {
      const modal = document.getElementById('importApprovedCancellationExcelModalOverlay');
      if (!modal) return;
      parsedApprovedCancelExcelBatchRows = [];
      const previewCont = document.getElementById('approvedCancelExcelPreviewContainer');
      const btnSubmit = document.getElementById('btnSubmitApprovedCancelExcel');
      const fileInput = document.getElementById('fileApprovedCancelExcelInput');
      const label = document.getElementById('lblApprovedCancelExcelFileName');

      if (previewCont) previewCont.style.display = 'none';
      if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.style.opacity = '0.5'; }
      if (fileInput) fileInput.value = '';
      if (label) label.textContent = 'Kéo thả tệp Excel hồ sơ đã hủy vào đây hoặc bấm để chọn tệp';

      modal.style.display = 'grid';
      modal.setAttribute('aria-hidden', 'false');
    }


    function closeImportApprovedCancellationExcelModal() {
      const modal = document.getElementById('importApprovedCancellationExcelModalOverlay');
      if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
      }
      parsedApprovedCancelExcelBatchRows = [];
    }


    function handleApprovedCancelExcelFileSelected(event) {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!window.XLSX) {
        triggerToast('Thư viện XLSX đang tải, vui lòng thử lại sau...', 'warning');
        return;
      }

      document.getElementById('lblApprovedCancelExcelFileName').textContent = 'Đang đọc tệp: ' + file.name;

      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

          if (!jsonRows || jsonRows.length < 2) {
            triggerToast('Tệp Excel không chứa dữ liệu hợp lệ.', 'error');
            return;
          }

          // Identify column headers
          let headerIdx = -1;
          let colMap = { status: -1, hsbt: -1, bsx: -1, ngayDuyet: -1, nguoiTrinh: -1, trinhDuyetDen: -1, duPhong: -1 };

          for (let i = 0; i < Math.min(15, jsonRows.length); i++) {
            const row = jsonRows[i];
            if (!Array.isArray(row)) continue;
            row.forEach((cell, idx) => {
              const text = String(cell || '').trim().toLowerCase();
              if (text === 'tên' || text === 'ten' || text.includes('số hsbt') || text.includes('so hsbt') || text.includes('số hồ sơ') || text.includes('so ho so') || text === 'hsbt') {
                colMap.hsbt = idx;
              } else if (text.includes('biển kiểm soát') || text.includes('bien kiem soat') || text.includes('biển số') || text.includes('bien so') || text.includes('biển xe') || text === 'bks' || text === 'bsx') {
                colMap.bsx = idx;
              } else if ((text.includes('ngày duyệt') || text.includes('ngay duyet')) && !text.includes('pasc')) {
                colMap.ngayDuyet = idx;
              } else if (text.includes('người trình') || text.includes('nguoi trinh')) {
                colMap.nguoiTrinh = idx;
              } else if (text.includes('trình duyệt đến') || text.includes('trinh duyet den') || text.includes('người duyệt') || text.includes('nguoi duyet')) {
                colMap.trinhDuyetDen = idx;
              } else if (text === 'status' || text.includes('trạng thái') || text.includes('trang thai')) {
                colMap.status = idx;
              } else if (text.includes('dự phòng') || text.includes('du phong')) {
                colMap.duPhong = idx;
              }
            });
            if (colMap.hsbt !== -1 || colMap.bsx !== -1) {
              headerIdx = i;
              break;
            }
          }

          if (headerIdx === -1 || (colMap.hsbt === -1 && colMap.bsx === -1)) {
            triggerToast('Không tìm thấy cột Số HSBT ("Tên") hoặc Biển số xe trong file Excel.', 'error');
            return;
          }

          const cancellations = Object.values(cachedClaimCancellationsPayload || {});
          parsedApprovedCancelExcelBatchRows = [];
          let readyCount = 0;
          let alreadyCount = 0;
          let ignoredCount = 0;

          for (let i = headerIdx + 1; i < jsonRows.length; i++) {
            const r = jsonRows[i];
            if (!Array.isArray(r) || r.every(c => !String(c).trim())) continue;

            const rawHsbt = (colMap.hsbt !== -1 ? String(r[colMap.hsbt] || '') : '').trim();
            const rawBsx = (colMap.bsx !== -1 ? String(r[colMap.bsx] || '') : '').trim();
            const rawNgayDuyet = colMap.ngayDuyet !== -1 ? r[colMap.ngayDuyet] : '';
            const rawNguoiTrinh = (colMap.nguoiTrinh !== -1 ? String(r[colMap.nguoiTrinh] || '') : '').trim();
            const rawTrinhDuyetDen = (colMap.trinhDuyetDen !== -1 ? String(r[colMap.trinhDuyetDen] || '') : '').trim();

            // Skip summary rows like "cancel (386)" or empty HSBT
            if (!rawHsbt) continue;
            if (rawHsbt.toLowerCase().startsWith('cancel (') || rawHsbt.toLowerCase() === 'cancel') continue;

            const cleanHsbt = rawHsbt.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            if (!cleanHsbt || cleanHsbt.length < 4) continue;

            // Parse approval date
            let duyetDateStr = '';
            let duyetDateTs = 0;
            if (rawNgayDuyet instanceof Date && !isNaN(rawNgayDuyet.getTime())) {
              duyetDateTs = rawNgayDuyet.getTime();
              const y = rawNgayDuyet.getFullYear();
              const m = String(rawNgayDuyet.getMonth() + 1).padStart(2, '0');
              const d = String(rawNgayDuyet.getDate()).padStart(2, '0');
              const hh = String(rawNgayDuyet.getHours()).padStart(2, '0');
              const mm = String(rawNgayDuyet.getMinutes()).padStart(2, '0');
              const ss = String(rawNgayDuyet.getSeconds()).padStart(2, '0');
              duyetDateStr = `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
            } else if (typeof rawNgayDuyet === 'number' && rawNgayDuyet > 30000) {
              const dObj = new Date(Math.round((rawNgayDuyet - 25569) * 86400 * 1000));
              if (!isNaN(dObj.getTime())) {
                duyetDateTs = dObj.getTime();
                const y = dObj.getFullYear();
                const m = String(dObj.getMonth() + 1).padStart(2, '0');
                const d = String(dObj.getDate()).padStart(2, '0');
                const hh = String(dObj.getHours()).padStart(2, '0');
                const mm = String(dObj.getMinutes()).padStart(2, '0');
                const ss = String(dObj.getSeconds()).padStart(2, '0');
                duyetDateStr = `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
              }
            } else if (typeof rawNgayDuyet === 'string' && rawNgayDuyet.trim()) {
              duyetDateStr = rawNgayDuyet.trim();
              const dObj = new Date(duyetDateStr.replace(' ', 'T'));
              if (!isNaN(dObj.getTime())) {
                duyetDateTs = dObj.getTime();
              }
            }

            const nguoiDuyet = rawTrinhDuyetDen || rawNguoiTrinh || (activeUserProfile?.displayName || activeUserProfile?.fullName || 'Lãnh đạo phê duyệt');

            // Primary Match Key: Số HSBT
            const matchedCancellation = cancellations.find(c => {
              const cHsbt = (c.soHoSoBoiThuong || c.soHsbt || c.id || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
              return cHsbt && cHsbt === cleanHsbt;
            });

            let matchType = 'NOT_IN_CANCEL_LIST';
            if (matchedCancellation) {
              if (matchedCancellation.cancelStatus === 'da_duyet') {
                matchType = 'ALREADY_APPROVED';
                alreadyCount++;
              } else {
                matchType = 'READY';
                readyCount++;
              }
            } else {
              matchType = 'NOT_IN_CANCEL_LIST';
              ignoredCount++;
            }

            parsedApprovedCancelExcelBatchRows.push({
              rawHsbt,
              cleanHsbt,
              rawBsx: rawBsx || matchedCancellation?.bienSo || '',
              duyetDateStr,
              duyetDateTs: duyetDateTs || Date.now(),
              nguoiDuyet,
              rawNguoiTrinh,
              rawTrinhDuyetDen,
              matchedCancellation,
              matchType
            });
          }

          if (parsedApprovedCancelExcelBatchRows.length === 0) {
            triggerToast('Không tìm thấy dòng hồ sơ nào hợp lệ trong tệp Excel.', 'warning');
            return;
          }

          // Render preview table
          const tbody = document.getElementById('tblApprovedCancelExcelPreviewBody');
          const previewLimit = 150;
          const displayRows = parsedApprovedCancelExcelBatchRows.slice(0, previewLimit);

          tbody.innerHTML = displayRows.map((r, idx) => {
            let statusBadge = '';
            let rowBg = '';

            if (r.matchType === 'READY') {
              rowBg = 'background: rgba(16, 185, 129, 0.04);';
              statusBadge = `
                <span style="padding: 3px 9px; border-radius: 6px; font-size: 11.5px; font-weight: 850; background: rgba(16,185,129,0.12); color: #10b981; border: 1px solid rgba(16,185,129,0.25); display: inline-flex; align-items: center; gap: 4px;">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  Khớp - Duyệt hủy
                </span>
              `;
            } else if (r.matchType === 'ALREADY_APPROVED') {
              rowBg = 'opacity: 0.8;';
              statusBadge = `
                <span style="padding: 3px 9px; border-radius: 6px; font-size: 11.5px; font-weight: 800; background: rgba(59,130,246,0.12); color: #3b82f6; border: 1px solid rgba(59,130,246,0.25);">
                  Đã duyệt trước đó
                </span>
              `;
            } else {
              rowBg = 'background: rgba(0,0,0,0.015);';
              statusBadge = `
                <span style="padding: 3px 9px; border-radius: 6px; font-size: 11px; font-weight: 700; background: rgba(107,114,128,0.1); color: #6b7280; border: 1px solid rgba(107,114,128,0.2);">
                  Bỏ qua (Không ở DS cần hủy)
                </span>
              `;
            }

            return `
              <tr style="${rowBg}">
                <td style="text-align: center; font-weight: 700; color: var(--text-soft);">${idx + 1}</td>
                <td><strong style="color: ${r.matchType === 'READY' ? '#10b981' : 'var(--text-main)'}; font-family: monospace;">${escapeHtmlOutput(r.rawHsbt)}</strong></td>
                <td><strong style="color: var(--primary);">${escapeHtmlOutput(r.rawBsx || '—')}</strong></td>
                <td><span style="color: var(--text-soft); font-size: 12px;">${escapeHtmlOutput(r.duyetDateStr || '—')}</span></td>
                <td><span style="font-size: 12px; color: var(--text-main); font-weight: 600;">${escapeHtmlOutput(r.nguoiDuyet || '—')}</span></td>
                <td style="text-align: center;">${statusBadge}</td>
              </tr>
            `;
          }).join('');

          document.getElementById('lblApprovedCancelMatchedCount').textContent = readyCount;
          document.getElementById('lblApprovedCancelAlreadyCount').textContent = alreadyCount;
          document.getElementById('lblApprovedCancelIgnoredCount').textContent = ignoredCount;
          document.getElementById('lblApprovedCancelTotalCount').textContent = parsedApprovedCancelExcelBatchRows.length;
          document.getElementById('lblSubmitApprovedCancelCount').textContent = readyCount;
          document.getElementById('approvedCancelExcelPreviewContainer').style.display = 'block';

          const btnSubmit = document.getElementById('btnSubmitApprovedCancelExcel');
          if (btnSubmit) {
            btnSubmit.disabled = readyCount === 0;
            btnSubmit.style.opacity = readyCount > 0 ? '1' : '0.5';
          }
        } catch (err) {
          console.error("Lỗi đọc Excel danh sách đã hủy:", err);
          triggerToast('Lỗi đọc tệp Excel: ' + err.message, 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    }


    async function applyApprovedCancellationExcelBatch() {
      const readyItems = (parsedApprovedCancelExcelBatchRows || []).filter(r => r.matchType === 'READY' && r.matchedCancellation);
      if (readyItems.length === 0) {
        triggerToast('Không có hồ sơ nào cần chuyển trạng thái.', 'warning');
        return;
      }

      const btnSubmit = document.getElementById('btnSubmitApprovedCancelExcel');
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span>Đang xử lý chuyển trạng thái...</span>';
      }

      try {
        let successCount = 0;
        const now = Date.now();

        for (const item of readyItems) {
          const claimId = item.matchedCancellation.id || item.matchedCancellation.claimId || item.matchedCancellation._claimKey;
          if (!claimId) continue;

          const updates = {
            cancelStatus: 'da_duyet',
            cancelApprovedAt: item.duyetDateTs || now,
            cancelApprovedBy: item.nguoiDuyet || 'Lãnh đạo phê duyệt',
            cancelApprovedDateStr: item.duyetDateStr || new Date(item.duyetDateTs || now).toISOString(),
            trangThai: 'tu_choi',
            updatedAt: now
          };

          // 1. Cập nhật bảng chuyên biệt claim_cancellations trên Firebase RTDB
          if (dbNodeInstance) {
            await dbNodeInstance.ref(`claim_cancellations/${claimId}`).update(updates);
          }

          // 2. Cập nhật bộ nhớ đệm cachedClaimCancellationsPayload
          if (cachedClaimCancellationsPayload && cachedClaimCancellationsPayload[claimId]) {
            Object.assign(cachedClaimCancellationsPayload[claimId], updates);
          }

          // 3. Nếu hồ sơ có trong pending_claims, đồng bộ sang tu_choi & da_duyet
          if (dbNodeInstance) {
            await dbNodeInstance.ref(`pending_claims/${claimId}`).update({
              trangThai: 'tu_choi',
              cancelStatus: 'da_duyet',
              cancelApprovedAt: item.duyetDateTs || now,
              cancelApprovedBy: item.nguoiDuyet || 'Lãnh đạo phê duyệt',
              cancelApprovedDateStr: item.duyetDateStr || '',
              updatedAt: now
            }).catch(() => {});
          }

          if (cachedPendingClaimsPayload && cachedPendingClaimsPayload[claimId]) {
            cachedPendingClaimsPayload[claimId].trangThai = 'tu_choi';
            cachedPendingClaimsPayload[claimId].cancelStatus = 'da_duyet';
          }

          successCount++;
        }

        triggerToast(`Đã chuyển thành công ${successCount} hồ sơ sang trạng thái Đã duyệt hủy!`, 'success');
        closeImportApprovedCancellationExcelModal();

        if (activeDashboardTab === 'claim_cancellation' && typeof renderClaimCancellationPage === 'function') {
          renderClaimCancellationPage();
        }
        if (typeof executeUIRenderPendingClaims === 'function') {
          executeUIRenderPendingClaims();
        }
        if (typeof renderPendingClaimsTable === 'function') {
          renderPendingClaimsTable();
        }
      } catch (err) {
        console.error("Lỗi cập nhật hồ sơ đã hủy:", err);
        triggerToast('Lỗi khi cập nhật dữ liệu: ' + err.message, 'error');
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>Xác nhận chuyển Đã duyệt hủy (<span id="lblSubmitApprovedCancelCount">0</span>)</span>
          `;
        }
      }
    }


    function exportCancellationClaimsToExcel() {
      if (!hasUserPermission('report', 'export')) {
        triggerToast('Bạn không có quyền xuất dữ liệu báo cáo.', 'warning');
        return;
      }

      const filtered = getFilteredCancellationClaims();
      if (filtered.length === 0) {
        triggerToast('Không có hồ sơ đề xuất hủy nào để xuất Excel.', 'warning');
        return;
      }

      const aoaData = [
        ['STT', 'Trạng thái', 'Biển số xe', 'Số HSBT', 'Chủ xe / Lái xe', 'Giám định viên', 'Đơn vị cấp đơn', 'Ngày tổn thất', 'Dự phòng BT (VNĐ)', 'Ghi chú giải trình']
      ];

      filtered.forEach((c, idx) => {
        const isApproved = (c.trangThai === 'tu_choi' || c.cancelStatus === 'da_duyet');
        aoaData.push([
          idx + 1,
          isApproved ? 'Đã duyệt hủy' : 'Chờ duyệt hủy',
          c.bienSo || '',
          c.soHoSoBoiThuong || c.soHsbt || '',
          c.chuXe || c.khachHang || c.tenLaiXe || '',
          c.gdvTiepNhan || c.canBoXuLy || c.gdvHo || '',
          c.donViCapDon || c.chiNhanh || '',
          formatDateDisplay(c.ngayVTT || c.ngayTonThat || c.ngayMoHs),
          parseInt(String(c.duPhongBoiThuong || '0').replace(/\D/g, ''), 10) || 0,
          c.cancelNotes || c.ghiChu || c.ghiChuHoSo || ''
        ]);
      });

      if (window.XLSX) {
        const ws = XLSX.utils.aoa_to_sheet(aoaData);
        
        // Auto-adjust column widths
        ws['!cols'] = [
          {wch: 6},  // STT
          {wch: 18}, // Trang thai
          {wch: 15}, // Bien so
          {wch: 26}, // So HSBT
          {wch: 28}, // Chu xe
          {wch: 22}, // GDV
          {wch: 25}, // Don vi
          {wch: 18}, // Ngay TT
          {wch: 20}, // Du phong
          {wch: 45}  // Ghi chu
        ];

        // Format cells (Times New Roman, Borders)
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
            let cellRef = XLSX.utils.encode_cell({c: C, r: R});
            if (!ws[cellRef]) continue;
            
            if (!ws[cellRef].s) ws[cellRef].s = {};
            
            ws[cellRef].s.font = { name: "Times New Roman", sz: 12 };
            ws[cellRef].s.border = {
               top: { style: "thin", color: { auto: 1 } },
               bottom: { style: "thin", color: { auto: 1 } },
               left: { style: "thin", color: { auto: 1 } },
               right: { style: "thin", color: { auto: 1 } }
            };
            
            if (R === 0) {
              // Header styling
              ws[cellRef].s.font.bold = true;
              ws[cellRef].s.alignment = { vertical: "center", horizontal: "center", wrapText: true };
            } else {
              // Data styling
              ws[cellRef].s.alignment = { vertical: "center", wrapText: true };
              if (C === 8) {
                // Du phong (VND) - format as currency/number
                ws[cellRef].z = '#,##0';
              }
            }
          }
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'De_Xuat_Huy_Ho_So');
        const dateTag = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-');
        XLSX.writeFile(wb, `De_Xuat_Huy_Ho_So_${dateTag}.xlsx`);
        triggerToast('Đã xuất file Excel Đề xuất Hủy Hồ sơ thành công!', 'success');
      } else {
        triggerToast('Thư viện XLSX chưa tải xong, vui lòng thử lại sau...', 'error');
      }
    }
