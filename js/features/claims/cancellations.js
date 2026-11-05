

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

      // ---- Giao diện premium dùng chung khuôn .pending-workspace--v2 (cùng Danh bạ / Hồ sơ bồi thường) ----
      const ico = {
        x: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6m0-6 6 6"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        check: '<path d="m5 12 4 4L19 6"/>',
        coin: '<path d="M12 2v20"/><path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
        xls: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13l4 5m0-5-4 5"/>',
        upload: '<path d="M12 16V4m0 0-4 4m4-4 4 4"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        building: '<path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M14 9h5a1 1 0 0 1 1 1v11M3 21h18M8 8h2M8 12h2M8 16h2"/>',
        tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.4"/>',
        reset: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
        copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
        trash: '<path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
        lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
        truck: '<path d="M2 6h11v10H2zM13 10h4l3 3v3h-7"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/>'
      };
      const svgI = (k, s = 15) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ico[k] || ''}</svg>`;
      const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 4 4L19 6"></path></svg>';
      const CHEV_SVG = '<svg class="pending-filter-trigger__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m7 10 5 5 5-5"></path></svg>';
      const jsArg = v => escapeAttributeData(String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));

      // Dropdown theo khuôn .pending-filter-* (menu premium qua PENDING_DROPDOWN_UI)
      const cancelDd = (id, icon, caption, current, options, handler, isAll) => {
        const cur = options.find(o => String(o.value) === String(current)) || options[0];
        const items = options.map(o => {
          const sel = String(o.value) === String(current);
          return `<button type="button" class="custom-dropdown-item pending-filter-option${sel ? ' selected' : ''}" role="option" aria-selected="${sel}" title="${escapeAttributeData(o.title || o.label)}" onclick="${handler}('${jsArg(o.value)}')"><span class="pending-filter-option__main"><span class="pending-filter-option__label">${escapeHtmlOutput(o.label)}</span></span>${o.count !== undefined ? `<span class="pending-filter-option__count">${o.count}</span>` : ''}<span class="pending-filter-option__check">${sel ? CHECK_SVG : ''}</span></button>`;
        }).join('');
        return `<div class="custom-dropdown-container pending-filter-select${isAll ? '' : ' is-filtered'}"><button type="button" id="btn${id}" class="pending-filter-trigger" aria-haspopup="listbox" aria-expanded="false" onclick="togglePendingRegisterDropdown('menu${id}', event)"><span class="pending-filter-trigger__icon" aria-hidden="true">${svgI(icon)}</span><span class="pending-filter-trigger__copy"><span class="pending-filter-trigger__caption">${escapeHtmlOutput(caption)}</span><span class="pending-filter-trigger__value">${escapeHtmlOutput(cur.label)}</span></span>${CHEV_SVG}</button><div id="menu${id}" class="custom-dropdown-menu pending-filter-menu" style="display:none;">${items}</div></div>`;
      };
      if (typeof PENDING_DROPDOWN_UI !== 'undefined') {
        Object.assign(PENDING_DROPDOWN_UI, {
          menuCancelGdv: { title: 'Giám định viên', subtitle: 'Người đề xuất hủy hồ sơ', search: 'Tìm giám định viên…', width: 320 },
          menuCancelBranch: { title: 'Đơn vị cấp đơn', subtitle: 'Chi nhánh / phòng cấp đơn', search: 'Tìm chi nhánh…', width: 340 },
          menuCancelReason: { title: 'Nhóm lý do hủy', subtitle: 'Mã lý do GĐV đã chọn', width: 340 }
        });
      }

      const gdvOptions = [{ value: 'all', label: 'Tất cả GĐV', count: uniqueGdvs.length }].concat(uniqueGdvs.map(g => ({ value: g, label: g })));
      const branchOptions = [{ value: 'all', label: 'Tất cả đơn vị', count: uniqueBranches.length }].concat(uniqueBranches.map(b => ({ value: b, label: b })));
      const reasonOptions = cancelReasonOptions.map(o => ({ value: o.code, label: o.short, title: o.full }));

      const metric = (tone, icon, label, value, unit, foot, footValue, progress, quick) => `<article class="claims-metric-card claims-metric-card--${tone}${quick && activeCancelStatusFilter === quick ? ' is-active' : ''}"${quick ? ` role="button" tabindex="0" aria-pressed="${activeCancelStatusFilter === quick}" onclick="setCancelStatusFilter('${quick}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();setCancelStatusFilter('${quick}')}"` : ''} aria-label="${escapeAttributeData(label + ': ' + value)}"><div class="claims-metric-head"><span class="claims-metric-icon" aria-hidden="true">${svgI(icon, 14)}</span><span class="claims-metric-label">${escapeHtmlOutput(label)}</span></div><div class="claims-metric-value-row"><strong class="claims-metric-value">${value}</strong><span class="claims-metric-unit">${unit}</span></div><div class="claims-metric-foot"><span>${foot}</span><strong>${footValue}</strong></div><div class="claims-metric-track"><i style="--metric-progress:${Math.max(0, Math.min(100, progress))}%"></i></div></article>`;
      const pct = n => totalCount ? Math.round(n / totalCount * 100) : 0;

      const statusChip = (key, label, count) => `<button type="button" class="pn-chip${activeCancelStatusFilter === key ? ' is-active' : ''}" onclick="setCancelStatusFilter('${key}')">${label}<small>${count}</small></button>`;
      const actBtn = (attrs, icon, text, cls) => `<button type="button" class="pending-action-btn${cls ? ' ' + cls : ''}" ${attrs}><span class="pending-action-btn__icon" aria-hidden="true">${svgI(icon)}</span><span>${text}</span></button>`;

      const rowsHtml = filtered.map((c, idx) => {
        const bsx = c.bienSo || '—';
        const hsbt = c.soHoSoBoiThuong || c.soHsbt || '—';
        const hsbtRaw = c.soHoSoBoiThuong || c.soHsbt || '';
        const chuXe = c.chuXe || c.khachHang || c.tenLaiXe || c.hoTen || '—';
        const gdv = c.gdvTiepNhan || c.canBoXuLy || c.gdvHo || 'Chưa phân công';
        const gdht = c.gdvHienTruong || '';
        const donVi = c.donViCapDon || c.chiNhanh || '—';
        const ngayTonThat = formatDateDisplay(c.ngayVTT || c.ngayTonThat || c.ngayMoHs);
        const duPhong = formatCurrencyInputNumber(c.duPhongBoiThuong) || '0';
        const isApproved = (c.trangThai === 'tu_choi' || c.cancelStatus === 'da_duyet');
        const reasonCode = c.cancelReasonCode || c.lyDoChoViecHuy || 'Huỷ';
        const reasonText = c.lyDoHuy || c.lyDoChoViecHuy || 'Đề xuất hủy hồ sơ';
        const notes = c.cancelNotes || c.ghiChu || c.ghiChuHoSo || '';

        return `<tr class="cx-row">
          <td class="pn-c-stt">${String(idx + 1).padStart(2, '0')}</td>
          <td><span class="pn-tag cx-status cx-status--${isApproved ? 'done' : 'wait'}">${svgI(isApproved ? 'check' : 'clock', 12)}${isApproved ? 'Đã duyệt hủy' : 'Chờ duyệt hủy'}</span></td>
          <td><div class="cx-plate">${svgI('truck', 14)}<b>${escapeHtmlOutput(bsx)}</b></div><div class="pn-sub" title="${escapeAttributeData(chuXe)}">${escapeHtmlOutput(chuXe)}</div></td>
          <td><div class="cx-hsbt"><span class="pn-code cx-code" title="${escapeAttributeData(hsbt)}">${escapeHtmlOutput(hsbt)}</span>${hsbtRaw ? `<button type="button" class="cx-icon-btn" onclick="copyHsbtToClipboard(this, '${jsArg(hsbtRaw)}', event)" title="Sao chép số HSBT" aria-label="Sao chép số HSBT">${svgI('copy', 13)}</button>` : ''}</div></td>
          <td><div class="cx-name">${escapeHtmlOutput(gdv)}</div>${gdht && gdht !== gdv ? `<div class="pn-sub">GĐHT: ${escapeHtmlOutput(gdht)}</div>` : ''}</td>
          <td><div class="cx-org" title="${escapeAttributeData(donVi)}">${escapeHtmlOutput(donVi)}</div></td>
          <td class="cx-date">${escapeHtmlOutput(ngayTonThat)}</td>
          <td class="cx-money">${duPhong}<small>đ</small></td>
          <td><div class="cx-reason"><span class="pn-tag pn-tag--rose">${escapeHtmlOutput(reasonCode)}</span><span>${escapeHtmlOutput(reasonText)}</span></div></td>
          <td class="cx-notes">${notes ? `<div class="cx-notes__text" title="${escapeAttributeData(notes)}">${escapeHtmlOutput(notes)}</div>` : '<span class="ct-none">—</span>'}</td>
          ${isAdmin ? `<td class="cx-actions">${isApproved
            ? `<span class="cx-locked" title="Hồ sơ đã duyệt hủy không thể xóa">${svgI('lock', 12)}Đã khóa</span>`
            : `<button type="button" class="pending-action-btn ct-danger cx-del" onclick="deleteClaimCancellationProposalByAdmin('${jsArg(c.id)}', event)" title="Xóa đề xuất hủy (chuyển hồ sơ trở lại hồ sơ tồn)"><span class="pending-action-btn__icon" aria-hidden="true">${svgI('trash', 14)}</span><span>Xóa</span></button>`}</td>` : ''}
        </tr>`;
      }).join('');

      const emptyHtml = allCancelClaims.length === 0
        ? `<div class="pn-empty">${svgI('x', 28)}<b>Chưa có hồ sơ nào được đề xuất hủy</b><span>Để thêm hồ sơ vào bảng này, vào Quản lý Hồ sơ bồi thường và dùng nút “Đề xuất hủy hồ sơ”.</span></div>`
        : `<div class="pn-empty">${svgI('search', 28)}<b>Không có hồ sơ phù hợp</b><span>Thử bỏ bớt bộ lọc hoặc đổi từ khóa tìm kiếm.</span><button type="button" class="pending-action-btn" onclick="resetAllCancellationFilters()"><span class="pending-action-btn__icon" aria-hidden="true">${svgI('reset')}</span><span>Đặt lại bộ lọc</span></button></div>`;

      const hadSearchFocus = document.activeElement && document.activeElement.id === 'txtCancellationFilterSearch';
      const caret = hadSearchFocus ? document.activeElement.selectionStart : null;

      container.innerHTML = `<div class="workspace-grid single-col"><section class="pending-workspace pending-workspace--v2 pn-workspace cx-workspace" aria-label="Đề xuất hủy hồ sơ">
        <header class="pw-page-head"><div class="pw-page-title"><div class="pw-page-emblem" aria-hidden="true">${svgI('x', 22)}</div><div><span class="pw-eyebrow">Nghiệp vụ hủy hồ sơ</span><h1>Đề xuất hủy hồ sơ bồi thường</h1><p>Tổng hợp hồ sơ do Giám định viên đề xuất hủy hoặc từ chối bồi thường — theo dõi lý do, ghi chú giải trình, đối chiếu danh sách đã duyệt và xuất Excel trình ký.</p></div></div>
          <div class="pending-action-group" role="group" aria-label="Thao tác">${actBtn('onclick="openImportApprovedCancellationExcelModal()"', 'upload', 'Nhập Excel đã duyệt hủy', 'pending-action-btn--import')}${actBtn('onclick="exportCancellationClaimsToExcel()"', 'xls', 'Xuất Excel')}</div></header>
        <div class="claims-metrics-grid pn-metrics cx-metrics" aria-label="Tổng quan đề xuất hủy">
          ${metric('red', 'x', 'Tổng hồ sơ cần hủy', totalCount, 'hồ sơ', 'GĐV đề xuất lũy kế', '100%', totalCount ? 100 : 0, 'all')}
          ${metric('gold', 'clock', 'Chờ duyệt hủy', choDuyetCount, 'hồ sơ', 'Chờ lãnh đạo duyệt', pct(choDuyetCount) + '%', pct(choDuyetCount), 'cho_duyet')}
          ${metric('blue', 'check', 'Đã duyệt hủy', daDuyetCount, 'hồ sơ', 'Đã hoàn tất thủ tục', pct(daDuyetCount) + '%', pct(daDuyetCount), 'da_duyet')}
          ${metric('green', 'coin', 'Dự phòng giải phóng', formatCurrencyInputNumber(totalDuPhong) || '0', 'đ', 'Dự phòng BT sẽ được giải phóng', daDuyetCount + ' hồ sơ đã duyệt', pct(daDuyetCount))}
        </div>
        <div class="pending-register-panel pn-list">
          <div class="pending-register-topbar"><div class="pending-register-header"><h3>Danh sách đề xuất hủy</h3><div class="pending-filter-summary" aria-live="polite"><span class="pending-filter-result-count">${filtered.length.toLocaleString('vi-VN')} / ${totalCount.toLocaleString('vi-VN')} hồ sơ</span></div></div></div>
          <div class="pending-filter-toolbar">
            <div class="pending-filter-search"><span class="pending-filter-search__icon" aria-hidden="true">${svgI('search', 16)}</span><input type="search" id="txtCancellationFilterSearch" class="pending-filter-search__input" placeholder="Tìm BSX, số HSBT, GĐV, lý do…" autocomplete="off" aria-label="Tìm hồ sơ đề xuất hủy" value="${escapeAttributeData(activeCancelSearch)}" oninput="setCancelSearch(this.value)"></div>
            <div class="pending-filter-controls">
              ${cancelDd('CancelGdv', 'user', 'Giám định viên', activeCancelGdvFilter, gdvOptions, 'setCancelGdvFilter', activeCancelGdvFilter === 'all')}
              ${cancelDd('CancelBranch', 'building', 'Đơn vị cấp đơn', activeCancelBranchFilter, branchOptions, 'setCancelBranchFilter', activeCancelBranchFilter === 'all')}
              ${cancelDd('CancelReason', 'tag', 'Nhóm lý do', activeCancelReasonCodeFilter, reasonOptions, 'setCancelReasonFilter', activeCancelReasonCodeFilter === 'all')}
            </div>
            <button type="button" class="pending-filter-reset" onclick="resetAllCancellationFilters()" title="Đặt lại toàn bộ bộ lọc" aria-label="Đặt lại bộ lọc">${svgI('reset', 16)}</button>
          </div>
          <div class="pn-chips" role="group" aria-label="Lọc nhanh theo trạng thái">${statusChip('all', 'Tất cả', totalCount)}${statusChip('cho_duyet', 'Chờ duyệt', choDuyetCount)}${statusChip('da_duyet', 'Đã duyệt', daDuyetCount)}</div>
          ${filtered.length === 0 ? emptyHtml : `<div class="table-container pending-register-table"><table class="p-table cx-table"><thead><tr><th class="pn-c-stt">#</th><th>Trạng thái</th><th>Biển số / Chủ xe</th><th>Số HSBT</th><th>Giám định viên</th><th>Đơn vị cấp đơn</th><th>Ngày tổn thất</th><th class="cx-money">Dự phòng BT</th><th>Mã &amp; lý do hủy</th><th>Ghi chú giải trình</th>${isAdmin ? '<th class="cx-actions">Thao tác</th>' : ''}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`}
        </div>
      </section></div>`;

      if (hadSearchFocus) {
        const input = document.getElementById('txtCancellationFilterSearch');
        if (input) { input.focus({ preventScroll: true }); try { input.setSelectionRange(caret, caret); } catch (e) {} }
      }
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
