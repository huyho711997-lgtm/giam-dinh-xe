

    function openCarplaDataSourceModal() {
      let m = document.getElementById('carplaSourceModal');
      if (m) m.remove();
      m = document.createElement('div');
      m.id = 'carplaSourceModal';
      m.style.cssText = 'position:fixed; inset:0; width:100vw; height:100vh; background:rgba(7,11,20,0.76); backdrop-filter:blur(18px) saturate(112%); -webkit-backdrop-filter:blur(18px) saturate(112%); z-index:999999; display:flex; align-items:center; justify-content:center; padding:22px; box-sizing:border-box; animation:fadeIn 0.22s ease-out;';
      
      const claims = window._currentCarplaClaimsData || [];
      const excluded = (cachedReportRules && cachedReportRules.carplaExcludedClaims) ? cachedReportRules.carplaExcludedClaims : {};
      
      const totalClaimsCount = claims.length;
      let selectedCount = 0;
      let totalSelectedAmt = 0;

      claims.forEach(c => {
        const isExcluded = excluded[c._id] === true;
        const amtStr = String(c.ttbtTongSoTienBoiThuong || '0').replace(/[^0-9]/g, '');
        const amtVal = parseInt(amtStr, 10) || 0;
        if (!isExcluded) {
          selectedCount++;
          totalSelectedAmt += amtVal;
        }
      });

      function renderCarplaTableRows(filterText = '') {
        const normFilter = filterText.trim().toLowerCase();
        let rowsHtml = '';
        let visibleCount = 0;

        claims.forEach((c, idx) => {
          const isExcluded = excluded[c._id] === true;
          const amtStr = String(c.ttbtTongSoTienBoiThuong || '0').replace(/[^0-9]/g, '');
          const amtVal = parseInt(amtStr, 10) || 0;
          const gdvName = (c.gdvTiepNhan || c.canBoXuLy || c.gdvHo || 'Chưa phân công').trim();
          const garaName = (c.tenGaraVietTat || '—').trim();
          const bienSo = (c.bienSo || '—').trim();
          const ownerName = typeof extractClaimOwnerName === 'function' ? extractClaimOwnerName(c) : (c.khachHang || c.tenChuXe || 'N/A');

          // Ngày mở hồ sơ
          const rawNgayMo = c.ngayMoHs || c['Ngày mở hồ sơ'] || c.ngayTonThat || '';
          let ngayMoHsDisplay = formatDateDisplay(rawNgayMo);
          if (ngayMoHsDisplay && ngayMoHsDisplay !== '—') {
            ngayMoHsDisplay = ngayMoHsDisplay.split(' ')[0].trim();
          } else if (rawNgayMo && rawNgayMo !== '—' && rawNgayMo !== 'null') {
            ngayMoHsDisplay = String(rawNgayMo).split(' ')[0].trim();
          }

          // Tờ trình BT - Ngày duyệt cuối (Ngày duyệt HSBT)
          const rawDuyetDate = c.toTrinhNgayDuyet || c['Tờ trình BT - Ngày duyệt cuối (Ngày duyệt HSBT)'] || '';
          let duyetDateDisplay = formatDateDisplay(rawDuyetDate);
          if (duyetDateDisplay && duyetDateDisplay !== '—') {
            duyetDateDisplay = duyetDateDisplay.split(' ')[0].trim();
          }

          if (normFilter) {
            const matchBs = bienSo.toLowerCase().includes(normFilter);
            const matchOwner = ownerName.toLowerCase().includes(normFilter);
            const matchGdv = gdvName.toLowerCase().includes(normFilter);
            const matchGara = garaName.toLowerCase().includes(normFilter);
            const matchNgayMo = (ngayMoHsDisplay || '').toLowerCase().includes(normFilter);
            const matchDate = (duyetDateDisplay || '').toLowerCase().includes(normFilter);
            if (!matchBs && !matchOwner && !matchGdv && !matchGara && !matchNgayMo && !matchDate) return;
          }

          visibleCount++;

          const dateCellHtml = (duyetDateDisplay && duyetDateDisplay !== '—') 
            ? `<span style="display:inline-flex; align-items:center; gap:5px; padding:3px 8px; border-radius:6px; background:rgba(16,185,129,0.09); border:1px solid rgba(16,185,129,0.22); color:#10b981; font-size:12px; font-weight:750; white-space:nowrap;">
                 <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                 <span>${escapeHtmlOutput(duyetDateDisplay)}</span>
               </span>`
            : `<span style="color:var(--text-muted); font-size:12px; font-weight:600;">—</span>`;

          const ngayMoCellHtml = (ngayMoHsDisplay && ngayMoHsDisplay !== '—')
            ? `<span style="display:inline-flex; align-items:center; gap:5px; padding:3px 8px; border-radius:6px; background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.2); color:#3b82f6; font-size:12px; font-weight:750; white-space:nowrap;">
                 <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                 <span>${escapeHtmlOutput(ngayMoHsDisplay)}</span>
               </span>`
            : `<span style="color:var(--text-muted); font-size:12px; font-weight:600;">—</span>`;

          rowsHtml += `
            <tr id="carplaRow_${c._id}" class="carpla-data-row ${!isExcluded ? 'is-selected' : ''}" style="border-bottom:1px solid var(--border); transition:all 0.15s ease; cursor:pointer;" onclick="toggleCarplaCheckboxRow(event, '${c._id}')">
              <td style="padding:12px 8px; font-weight:750; color:var(--text-muted); text-align:center; font-size:12px;">
                <span style="display:inline-block; width:26px; height:26px; line-height:26px; border-radius:8px; background:var(--bg-soft); border:1px solid var(--border); font-size:11px;">${idx + 1}</span>
              </td>
              <td style="padding:12px 16px;">
                <div style="font-size:13.5px; font-weight:800; color:var(--primary); letter-spacing:0.3px; display:inline-flex; align-items:center; gap:6px; white-space:nowrap;">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" style="opacity:0.75;"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
                  <span>${escapeHtmlOutput(bienSo)}</span>
                </div>
              </td>
              <td style="padding:12px 16px;">
                <div style="font-size:12.5px; font-weight:750; color:var(--text-main); display:inline-flex; align-items:center; gap:6px; white-space:nowrap;" title="${escapeAttributeData(ownerName)}">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" style="color:var(--primary); opacity:0.85; flex-shrink:0;"><circle cx="12" cy="7" r="4"></circle><path d="M5.5 21a8.38 8.38 0 0 1 13 0"></path></svg>
                  <span>${escapeHtmlOutput(ownerName)}</span>
                </div>
              </td>
              <td style="padding:12px 16px;">
                <div style="font-size:12.5px; font-weight:700; color:var(--text-main); display:inline-flex; align-items:center; gap:6px; white-space:nowrap;">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" style="color:var(--text-muted);"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  <span>${escapeHtmlOutput(gdvName)}</span>
                </div>
              </td>
              <td style="padding:12px 16px;">
                <div style="font-size:12.5px; font-weight:650; color:var(--text-soft); line-height:1.35;" title="${escapeAttributeData(garaName)}">
                  ${escapeHtmlOutput(garaName)}
                </div>
              </td>
              <td style="padding:12px 16px; text-align:center;">
                ${ngayMoCellHtml}
              </td>
              <td style="padding:12px 16px; text-align:center;">
                ${dateCellHtml}
              </td>
              <td style="padding:12px 16px; text-align:right;">
                <div style="font-size:13.5px; font-weight:850; color:#ca8a04; letter-spacing:-0.01em; white-space:nowrap;">
                  ${formatCurrencyInputNumber(amtVal)} <span style="font-size:11px; font-weight:700; color:var(--text-muted);">đ</span>
                </div>
              </td>
              <td style="padding:12px 16px; text-align:center;" onclick="event.stopPropagation()">
                <label style="display:inline-flex; align-items:center; justify-content:center; cursor:pointer; width:28px; height:28px; border-radius:8px; transition:all 0.15s ease;" onmouseover="this.style.background='var(--surface-soft)'" onmouseout="this.style.background='transparent'">
                  <input type="checkbox" class="carpla-include-cb carpla-row-checkbox" data-id="${c._id}" data-amount="${amtVal}" ${!isExcluded ? 'checked' : ''} onchange="onCarplaCheckboxChange()" style="width:18px; height:18px; accent-color:var(--primary); cursor:pointer;">
                </label>
              </td>
            </tr>
          `;
        });

        if (visibleCount === 0) {
          rowsHtml = `<tr><td colspan="9" style="padding:36px 20px; text-align:center; color:var(--text-muted); font-weight:650; font-size:13px;">
            <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8" style="opacity:0.4;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <span>${claims.length === 0 ? 'Không có hồ sơ nào thuộc nhóm Carpla trong kỳ này.' : 'Không tìm thấy hồ sơ phù hợp với từ khóa.'}</span>
            </div>
          </td></tr>`;
        }

        return rowsHtml;
      }

      window.onCarplaCheckboxChange = function() {
        const cbs = document.querySelectorAll('.carpla-include-cb');
        let selCount = 0;
        let selAmt = 0;
        let allChecked = cbs.length > 0;
        cbs.forEach(cb => {
          const row = document.getElementById(`carplaRow_${cb.dataset.id}`);
          if (row) row.classList.toggle('is-selected', cb.checked);
          if (cb.checked) {
            selCount++;
            selAmt += parseInt(cb.dataset.amount || '0', 10) || 0;
          } else {
            allChecked = false;
          }
        });
        const countTxt = document.getElementById('carplaSelectedCountTxt');
        if (countTxt) countTxt.textContent = selCount;
        const amtTxt = document.getElementById('carplaTotalAmountTxt');
        if (amtTxt) amtTxt.textContent = formatCurrencyInputNumber(selAmt) + ' đ';
        const allCb = document.getElementById('carplaSelectAllCb');
        if (allCb) allCb.checked = allChecked;
      };

      window.toggleCarplaCheckboxRow = function(event, claimId) {
        if (event && event.target && event.target.tagName === 'INPUT') return;
        const cb = document.querySelector(`.carpla-include-cb[data-id="${claimId}"]`);
        if (cb) {
          cb.checked = !cb.checked;
          window.onCarplaCheckboxChange();
        }
      };

      window.setAllCarplaCheckboxes = function(checkedState) {
        document.querySelectorAll('.carpla-include-cb').forEach(cb => {
          cb.checked = !!checkedState;
        });
        window.onCarplaCheckboxChange();
      };

      window.filterCarplaModalList = function(text) {
        const tbody = document.getElementById('carplaModalTableBody');
        if (tbody) tbody.innerHTML = renderCarplaTableRows(text);
        window.onCarplaCheckboxChange();
      };

      m.innerHTML = `
        <style>
          #carplaSourceModal .carpla-premium-modal {
            position: relative;
            width: min(1580px, 96vw) !important;
            max-width: 1580px !important;
            max-height: 90vh !important;
            border: 1px solid rgba(201,154,67,.38) !important;
            border-radius: 28px !important;
            background: var(--surface-strong) !important;
            box-shadow: 0 38px 100px rgba(0,0,0,.52), 0 0 0 1px rgba(255,255,255,.035), inset 0 1px 0 rgba(255,255,255,.08) !important;
          }
          #carplaSourceModal .carpla-premium-modal::after {
            content: '';
            position: absolute;
            left: 38px;
            right: 38px;
            bottom: -1px;
            height: 2px;
            border-radius: 99px;
            background: linear-gradient(90deg, transparent, rgba(201,154,67,.70), transparent);
            pointer-events: none;
          }
          #carplaSourceModal .carpla-modal-hero {
            position: relative;
            overflow: hidden;
            padding: 24px 28px !important;
            color: #f8fafc;
            border-bottom: 1px solid rgba(241,206,130,.18) !important;
            background: radial-gradient(circle at 8% 0%, rgba(238,199,119,.18), transparent 34%), radial-gradient(circle at 92% 12%, rgba(59,130,246,.17), transparent 31%), linear-gradient(122deg, #0b1220, #172033 54%, #101827) !important;
          }
          #carplaSourceModal .carpla-modal-hero::after {
            content: '';
            position: absolute;
            left: 28px;
            right: 28px;
            bottom: 0;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(241,206,130,.62), transparent);
          }
          #carplaSourceModal .carpla-modal-hero__icon {
            width: 50px !important;
            height: 50px !important;
            color: #f1ce82 !important;
            border-color: rgba(241,206,130,.32) !important;
            border-radius: 15px !important;
            background: rgba(241,206,130,.10) !important;
            box-shadow: inset 0 1px 0 rgba(255,255,255,.10), 0 10px 28px rgba(0,0,0,.16) !important;
          }
          #carplaSourceModal .carpla-modal-hero h3 { color: #f8fafc !important; font-size: 21px !important; letter-spacing: -.025em !important; }
          #carplaSourceModal .carpla-modal-hero p { color: #aeb9cb !important; max-width: 940px; }
          #carplaSourceModal .carpla-modal-badge { color: #f1ce82 !important; border-color: rgba(241,206,130,.30) !important; border-radius: 999px !important; background: rgba(241,206,130,.09) !important; }
          #carplaSourceModal .carpla-modal-close {
            width: 40px !important;
            height: 40px !important;
            color: #c9d3e2 !important;
            border-color: rgba(255,255,255,.14) !important;
            background: rgba(255,255,255,.07) !important;
            box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
          }
          #carplaSourceModal .carpla-modal-close:hover { color: #fff !important; border-color: rgba(239,68,68,.48) !important; background: rgba(239,68,68,.18) !important; transform: rotate(4deg); }
          #carplaSourceModal .carpla-modal-commandbar {
            padding: 14px 24px !important;
            border-bottom: 1px solid var(--border) !important;
            background: linear-gradient(180deg, var(--surface-strong), var(--surface)) !important;
            box-shadow: 0 8px 24px rgba(15,23,42,.045);
          }
          #carplaSourceModal .carpla-modal-stats { gap: 9px !important; }
          #carplaSourceModal .carpla-stat-card {
            min-height: 42px;
            padding: 0 13px !important;
            border-radius: 11px !important;
            box-shadow: inset 0 1px 0 rgba(255,255,255,.72);
          }
          #carplaSourceModal .carpla-stat-card svg { width: 15px; height: 15px; }
          #carplaSourceModal .carpla-stat-card--total { background: var(--surface-soft) !important; border-color: var(--border-strong) !important; }
          #carplaSourceModal .carpla-stat-card--selected { background: rgba(16,185,129,.09) !important; border-color: rgba(16,185,129,.27) !important; }
          #carplaSourceModal .carpla-stat-card--amount { color: #92651d !important; background: linear-gradient(135deg, rgba(201,154,67,.15), rgba(201,154,67,.07)) !important; border-color: rgba(201,154,67,.31) !important; }
          #carplaSourceModal .carpla-modal-search { min-width: 330px !important; max-width: 470px !important; }
          #carplaSourceModal .carpla-modal-search input {
            height: 42px !important;
            padding-left: 40px !important;
            border-color: var(--border-strong) !important;
            border-radius: 12px !important;
            background: var(--surface-strong) !important;
            box-shadow: 0 5px 15px rgba(15,23,42,.045), inset 0 1px 0 rgba(255,255,255,.70);
          }
          #carplaSourceModal .carpla-modal-search input:focus { border-color: rgba(201,154,67,.58) !important; box-shadow: 0 0 0 3px rgba(201,154,67,.09), 0 8px 20px rgba(15,23,42,.07); }
          #carplaSourceModal .carpla-modal-table-shell {
            padding: 18px 20px !important;
            background: radial-gradient(circle at 10% 0%, rgba(201,154,67,.055), transparent 26%), var(--bg-main) !important;
          }
          #carplaSourceModal .carpla-modal-table {
            border-color: rgba(201,154,67,.25) !important;
            border-radius: 18px !important;
            box-shadow: 0 14px 34px rgba(15,23,42,.07), inset 0 1px 0 rgba(255,255,255,.68) !important;
          }
          #carplaSourceModal .carpla-modal-table thead { background: linear-gradient(180deg, var(--surface-strong), var(--surface-soft)) !important; }
          #carplaSourceModal .carpla-modal-table th { padding-top: 15px !important; padding-bottom: 15px !important; color: var(--text-muted) !important; border-bottom-color: rgba(201,154,67,.22) !important; }
          #carplaSourceModal .carpla-data-row { background: var(--surface-strong); border-bottom: 1px solid var(--border) !important; }
          #carplaSourceModal .carpla-data-row:nth-child(even) { background: var(--surface-soft); }
          #carplaSourceModal .carpla-data-row:hover { background: rgba(201,154,67,.075) !important; }
          #carplaSourceModal .carpla-data-row.is-selected { box-shadow: inset 3px 0 0 #c99a43; }
          #carplaSourceModal .carpla-data-row td { padding-top: 14px !important; padding-bottom: 14px !important; }
          #carplaSourceModal .carpla-row-checkbox { width: 19px !important; height: 19px !important; accent-color: #b7832d !important; }
          #carplaSourceModal .carpla-modal-footer {
            padding: 15px 24px !important;
            border-top: 1px solid rgba(201,154,67,.22) !important;
            background: linear-gradient(180deg, var(--surface), var(--surface-strong)) !important;
            box-shadow: 0 -10px 28px rgba(15,23,42,.045);
          }
          #carplaSourceModal .carpla-footer-action { min-height: 38px; padding: 0 14px !important; border-radius: 10px !important; }
          #carplaSourceModal .carpla-save-button { min-height: 42px; padding: 0 24px !important; color: #fff !important; background: linear-gradient(135deg, #c99a43, #9a6b21) !important; box-shadow: 0 8px 20px rgba(154,107,33,.30) !important; }
          #carplaSourceModal .carpla-save-button:hover { box-shadow: 0 11px 26px rgba(154,107,33,.40) !important; }
          @media (max-width: 860px) {
            #carplaSourceModal { padding: 8px !important; }
            #carplaSourceModal .carpla-premium-modal { width: 100% !important; max-height: 96vh !important; border-radius: 20px !important; }
            #carplaSourceModal .carpla-modal-hero { padding: 18px !important; }
            #carplaSourceModal .carpla-modal-commandbar { align-items: stretch !important; }
            #carplaSourceModal .carpla-modal-search { width: 100%; min-width: 0 !important; max-width: none !important; }
            #carplaSourceModal .carpla-modal-table-shell { padding: 10px !important; }
            #carplaSourceModal .carpla-modal-footer { padding: 12px !important; }
          }
        </style>
        <div class="carpla-premium-modal" style="background:var(--surface); border-radius:24px; width:96vw; max-width:1550px; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 25px 70px -10px rgba(0,0,0,0.5), 0 0 0 1px var(--border-strong); border:1px solid rgba(216,180,109,0.3); overflow:hidden; animation:zoomIn 0.2s cubic-bezier(0.16,1,0.3,1);">
          <!-- Header -->
          <div class="carpla-modal-hero" style="padding:20px 24px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:flex-start; gap:16px; background:linear-gradient(135deg, var(--surface) 0%, var(--surface-strong) 100%);">
            <div style="display:flex; align-items:flex-start; gap:14px;">
              <div class="carpla-modal-hero__icon" style="width:44px; height:44px; border-radius:14px; background:linear-gradient(135deg, rgba(216,180,109,0.2) 0%, rgba(202,138,4,0.1) 100%); border:1px solid rgba(216,180,109,0.4); display:flex; align-items:center; justify-content:center; color:var(--primary); flex-shrink:0; box-shadow:0 4px 14px rgba(216,180,109,0.15);">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                </svg>
              </div>
              <div>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <h3 style="margin:0; font-size:18px; font-weight:850; color:var(--text-main); letter-spacing:-0.01em;">
                    Nguồn Dữ Liệu: Doanh Số Carpla
                  </h3>
                  <span class="carpla-modal-badge" style="font-size:10.5px; font-weight:800; padding:2px 8px; border-radius:6px; background:rgba(202,138,4,0.12); color:#ca8a04; border:1px solid rgba(202,138,4,0.25); text-transform:uppercase; letter-spacing:0.04em;">Cấu hình lũy kế</span>
                </div>
                <p style="margin:4px 0 0 0; font-size:12.5px; color:var(--text-soft); font-weight:550; line-height:1.4;">
                  Danh sách các hồ sơ được hệ thống nhận diện thuộc Carpla trong kỳ. Tích chọn để đưa vào tổng doanh số Carpla.
                </p>
              </div>
            </div>
            
            <button type="button" class="carpla-modal-close" onclick="document.getElementById('carplaSourceModal').remove()" style="background:var(--surface-soft); border:1px solid var(--border); color:var(--text-muted); cursor:pointer; width:36px; height:36px; border-radius:12px; display:flex; align-items:center; justify-content:center; transition:all 0.2s;" title="Đóng modal">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <!-- Stat Chips & Quick Filter Bar -->
          <div class="carpla-modal-commandbar" style="padding:12px 24px; background:var(--surface); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
            <div class="carpla-modal-stats" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <div class="carpla-stat-card carpla-stat-card--total" style="display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:750; padding:5px 12px; border-radius:8px; background:var(--surface-soft); border:1px solid var(--border); color:var(--text-main);">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                <span>Tổng số: <strong style="color:var(--text-main);">${totalClaimsCount}</strong> hồ sơ</span>
              </div>
              <div class="carpla-stat-card carpla-stat-card--selected" style="display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:750; padding:5px 12px; border-radius:8px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.22); color:#10b981;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Đã chọn: <strong id="carplaSelectedCountTxt">${selectedCount}</strong>/${totalClaimsCount}</span>
              </div>
              <div class="carpla-stat-card carpla-stat-card--amount" style="display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:800; padding:5px 12px; border-radius:8px; background:linear-gradient(135deg, rgba(216,180,109,0.15) 0%, rgba(202,138,4,0.08) 100%); border:1px solid rgba(216,180,109,0.3); color:var(--primary);">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                <span>Doanh số chọn: <strong id="carplaTotalAmountTxt">${formatCurrencyInputNumber(totalSelectedAmt)} đ</strong></span>
              </div>
            </div>

            <!-- Live Search Box -->
            <div class="carpla-modal-search" style="position:relative; min-width:280px; flex:1; max-width:420px;">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted); pointer-events:none;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="search" placeholder="Tìm biển số, chủ xe, GĐV, Gara, ngày..." oninput="filterCarplaModalList(this.value)" autocomplete="off" style="width:100%; height:34px; border-radius:10px; border:1px solid var(--border); background:var(--bg-soft); color:var(--text-main); font-size:12px; font-weight:600; padding:0 12px 0 34px; outline:none; transition:border-color 0.2s;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'" />
            </div>
          </div>

          <!-- Table Body -->
          <div class="custom-scroll carpla-modal-table-shell" style="flex-grow:1; overflow-y:auto; padding:16px 20px; background:var(--bg-main);">
            <table class="carpla-modal-table" style="width:100%; border-collapse:separate; border-spacing:0; background:var(--surface); border-radius:14px; overflow:hidden; border:1px solid var(--border-strong); box-shadow:var(--shadow-xs);">
              <thead style="background:var(--surface-strong); position:sticky; top:0; z-index:2; border-bottom:1px solid var(--border-strong);">
                <tr>
                  <th style="padding:14px 10px; font-size:11.5px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; font-weight:800; text-align:center; width:50px; border-bottom:1px solid var(--border);">STT</th>
                  <th style="padding:14px 16px; font-size:11.5px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; font-weight:800; text-align:left; width:135px; border-bottom:1px solid var(--border);">Biển số</th>
                  <th style="padding:14px 16px; font-size:11.5px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; font-weight:800; text-align:left; width:170px; border-bottom:1px solid var(--border);">Tên chủ xe</th>
                  <th style="padding:14px 16px; font-size:11.5px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; font-weight:800; text-align:left; width:180px; border-bottom:1px solid var(--border);">GĐV Xử lý</th>
                  <th style="padding:14px 16px; font-size:11.5px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; font-weight:800; text-align:left; min-width:220px; border-bottom:1px solid var(--border);">Gara</th>
                  <th style="padding:14px 16px; font-size:11.5px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; font-weight:800; text-align:center; width:145px; border-bottom:1px solid var(--border);">Ngày mở hồ sơ</th>
                  <th style="padding:14px 16px; font-size:11.5px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; font-weight:800; text-align:center; width:145px; border-bottom:1px solid var(--border);">Ngày duyệt HSBT</th>
                  <th style="padding:14px 16px; font-size:11.5px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; font-weight:800; text-align:right; width:170px; border-bottom:1px solid var(--border);">Số tiền Bồi thường</th>
                  <th style="padding:14px 16px; font-size:11.5px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; font-weight:800; text-align:center; width:130px; border-bottom:1px solid var(--border);">
                    <div style="display:inline-flex; align-items:center; gap:5px; cursor:pointer;" onclick="const cb = document.getElementById('carplaSelectAllCb'); if (cb) { cb.checked = !cb.checked; setAllCarplaCheckboxes(cb.checked); }">
                      <input type="checkbox" id="carplaSelectAllCb" class="carpla-row-checkbox" ${selectedCount === totalClaimsCount && totalClaimsCount > 0 ? 'checked' : ''} onclick="event.stopPropagation()" onchange="setAllCarplaCheckboxes(this.checked)" style="width:16px; height:16px; accent-color:var(--primary); cursor:pointer;">
                      <span>Đưa vào BC</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody id="carplaModalTableBody">
                ${renderCarplaTableRows()}
              </tbody>
            </table>
          </div>

          <!-- Footer -->
          <div class="carpla-modal-footer" style="padding:16px 24px; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; gap:16px; background:var(--surface-strong); flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:8px;">
              <button type="button" class="carpla-footer-action" onclick="setAllCarplaCheckboxes(true)" style="padding:7px 14px; border-radius:10px; border:1px solid var(--border); background:var(--surface); font-weight:750; font-size:12px; color:var(--text-main); cursor:pointer; display:inline-flex; align-items:center; gap:5px; transition:all 0.15s ease;" onmouseover="this.style.background='var(--surface-soft)'; this.style.borderColor='var(--border-strong)'" onmouseout="this.style.background='var(--surface)'; this.style.borderColor='var(--border)'">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Chọn tất cả</span>
              </button>
              <button type="button" class="carpla-footer-action" onclick="setAllCarplaCheckboxes(false)" style="padding:7px 14px; border-radius:10px; border:1px solid var(--border); background:var(--surface); font-weight:750; font-size:12px; color:var(--text-soft); cursor:pointer; display:inline-flex; align-items:center; gap:5px; transition:all 0.15s ease;" onmouseover="this.style.background='var(--surface-soft)'; this.style.borderColor='var(--border-strong)'" onmouseout="this.style.background='var(--surface)'; this.style.borderColor='var(--border)'">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                <span>Bỏ chọn tất cả</span>
              </button>
            </div>

            <div style="display:flex; align-items:center; gap:10px;">
              <button type="button" class="carpla-footer-action" onclick="document.getElementById('carplaSourceModal').remove()" style="padding:9px 20px; border-radius:12px; border:1px solid var(--border); background:var(--surface); font-weight:750; font-size:13px; color:var(--text-main); cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='var(--surface-soft)'" onmouseout="this.style.background='var(--surface)'">Hủy bỏ</button>
              <button type="button" class="carpla-save-button" onclick="saveCarplaSourceExclusions()" id="btnSaveCarplaExclusions" style="padding:9px 28px; border-radius:12px; border:none; background:linear-gradient(135deg, var(--primary) 0%, #d8b46d 100%); color:#080b11; font-weight:850; font-size:13.5px; cursor:pointer; box-shadow:0 6px 18px rgba(216,180,109,0.35); transition:all 0.2s cubic-bezier(0.16,1,0.3,1); display:inline-flex; align-items:center; gap:6px;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='none'">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Lưu Lựa Chọn</span>
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(m);
    }

async function saveCarplaSourceExclusions() {
      const btn = document.getElementById('btnSaveCarplaExclusions');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 0.8s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
          <span>Đang lưu...</span>
        `;
      }
      
      const cbs = document.querySelectorAll('.carpla-include-cb');
      const excluded = (cachedReportRules && cachedReportRules.carplaExcludedClaims) ? { ...cachedReportRules.carplaExcludedClaims } : {};
      
      cbs.forEach(cb => {
        if (!cb.checked) {
          excluded[cb.dataset.id] = true;
        } else {
          delete excluded[cb.dataset.id];
        }
      });
      
      try {
        if (!cachedReportRules) cachedReportRules = {};
        cachedReportRules.carplaExcludedClaims = excluded;

        await dbNodeInstance.ref('settings/reportRules/carplaExcludedClaims').set(excluded);
        triggerToast('Đã lưu cấu hình Nguồn dữ liệu Carpla!', 'success');
        
        const modal = document.getElementById('carplaSourceModal');
        if (modal) modal.remove();

        const weeklyReportTab = document.getElementById('weekly-report');
        if (weeklyReportTab && weeklyReportTab.classList.contains('active')) {
          renderGdvMonthlyReportPage(weeklyReportTab);
        }
      } catch (err) {
        console.error(err);
        triggerToast('Lỗi lưu dữ liệu: ' + err.message, 'error');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>Lưu Lựa Chọn</span>
          `;
        }
      }
    }
