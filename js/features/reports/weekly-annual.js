

    
    /****************************************************
     * BÁO CÁO TUẦN TRƯỞNG ZONE - EXCEL & WEB TABLE CONTROLLER
     ****************************************************/
    
    function renderWeeklyZoneReportTableHtml() {
      const { period, list } = getWeeklyZoneReportData();
      let sumPhatSinh = 0, sumDaDuyet = 0, sumChuaDuyet = 0, sumTonHoaDon = 0, sumChuyenDntt = 0, sumCarpla = 0, sumTndsTon = 0;
      let sumHsTonOver30 = 0, sumHsDuPhongOver50M = 0, totalSumAmtUnder10M = 0, totalCountUnder10M = 0, sumCarplaCumulativeRev = 0;

      const currentMonth = (period.startDate ? period.startDate.getMonth() + 1 : (new Date().getMonth() + 1));

      list.forEach(r => {
        const chuaDuyetVal = r.chuaDuyetPasc || Math.max(0, r.phatSinh - r.daDuyetHsb);
        sumPhatSinh += r.phatSinh;
        sumDaDuyet += r.daDuyetHsb;
        sumChuaDuyet += chuaDuyetVal;
        sumTonHoaDon += r.tonHoaDon;
        sumChuyenDntt += r.chuyenDntt;
        sumCarpla += r.carplaCount;
        sumTndsTon += r.tndsTonLuyKe;

        sumHsTonOver30 += r.hsTonOver30Days || 0;
        sumHsDuPhongOver50M += r.hsDuPhongOver50M || 0;
        totalSumAmtUnder10M += r.sumAmtUnder10M || 0;
        totalCountUnder10M += r.countUnder10M || 0;
        sumCarplaCumulativeRev += r.carplaCumulativeRevenue || 0;
      });

      const overallAvgUnder10M = totalCountUnder10M > 0 ? Math.round(totalSumAmtUnder10M / totalCountUnder10M) : 0;
      const weeklyApprovalRate = sumPhatSinh > 0 ? Math.round((sumDaDuyet / sumPhatSinh) * 100) : 0;

      return `
        <div class="weekly-report-kpi-grid weekly-report-kpi-grid--compact" aria-label="Tổng quan báo cáo trong kỳ">
          <div class="weekly-report-kpi" style="--kpi-color:#3b82f6;">
            <div class="weekly-report-kpi__head">
              <span class="weekly-report-kpi__label">Hồ sơ phát sinh</span>
              <span class="weekly-report-kpi__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M12 18v-6M9 15h6"></path></svg></span>
            </div>
            <div class="weekly-report-kpi__value">${sumPhatSinh}</div>
            <div class="weekly-report-kpi__meta">Tổng hồ sơ ghi nhận trong kỳ</div>
          </div>
          <div class="weekly-report-kpi" style="--kpi-color:#10b981;">
            <div class="weekly-report-kpi__head">
              <span class="weekly-report-kpi__label">Đã duyệt HSBT</span>
              <span class="weekly-report-kpi__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"></circle><polyline points="8 12 11 15 16 9"></polyline></svg></span>
            </div>
            <div class="weekly-report-kpi__value">${sumDaDuyet}</div>
            <div class="weekly-report-kpi__meta">Tỷ lệ hoàn thành <strong>${weeklyApprovalRate}%</strong></div>
          </div>
          <div class="weekly-report-kpi" style="--kpi-color:#f59e0b;">
            <div class="weekly-report-kpi__head">
              <span class="weekly-report-kpi__label">Chờ duyệt PASC</span>
              <span class="weekly-report-kpi__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg></span>
            </div>
            <div class="weekly-report-kpi__value">${sumChuaDuyet}</div>
            <div class="weekly-report-kpi__meta">Hồ sơ cần tiếp tục xử lý</div>
          </div>
          <div class="weekly-report-kpi" style="--kpi-color:#ef4444;">
            <div class="weekly-report-kpi__head">
              <span class="weekly-report-kpi__label">Tồn quá hạn</span>
              <span class="weekly-report-kpi__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 3 2.8 20h18.4L12 3Z"></path><path d="M12 9v5M12 17h.01"></path></svg></span>
            </div>
            <div class="weekly-report-kpi__value">${sumHsTonOver30}</div>
            <div class="weekly-report-kpi__meta">Hồ sơ tồn trên ${cachedReportRules.hsTonDays} ngày</div>
          </div>
        </div>

        <div id="weeklyZoneReportCardContainer" style="background: var(--surface); border: 1px solid var(--border-strong); border-radius: 20px; padding: 28px 32px; margin-bottom: 24px; box-shadow: var(--shadow-sm); position: relative; z-index: 1; min-height: 420px; display: flex; flex-direction: column;">
          
          <div class="weekly-report-header">
          <div class="hide-on-screenshot weekly-report-columns-action" style="position: absolute; left: 26px; top: 22px; z-index: 10;">
            <div class="custom-select-wrapper" style="position: relative;">
              <button type="button" class="btn-premium btn-secondary weekly-cols-trigger" onclick="toggleCustomDropdownMenu('ddWeeklyColsMenu', event)" style="color: var(--text-main); font-size: 12.5px; font-weight: 850; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;">
                <span class="weekly-cols-trigger__icon"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M9 4v16M15 4v16"></path></svg></span>
                <span>Cột hiển thị</span>
                <span class="weekly-cols-trigger__count">${activeWeeklyReportCols.length}</span>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" style="color: var(--text-muted);"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
              <div id="ddWeeklyColsMenu" class="custom-select-menu weekly-cols-menu" style="display: ${activeOpenDropdownId === 'ddWeeklyColsMenu' ? 'block' : 'none'}; position: absolute; top: calc(100% + 8px); left: 0; z-index: 999; text-align: left;">
                <div class="weekly-cols-menu__header">
                  <div class="weekly-cols-menu__heading">
                    <span class="weekly-cols-menu__heading-icon"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M9 4v16M15 4v16"></path></svg></span>
                    <div>
                      <div class="weekly-cols-menu__title">Hiển thị cột báo cáo</div>
                      <div class="weekly-cols-menu__subtitle">Đang hiển thị ${activeWeeklyReportCols.length}/10 cột dữ liệu</div>
                    </div>
                  </div>
                  <div class="weekly-cols-menu__actions">
                    <button type="button" class="weekly-cols-action weekly-cols-action--show" onclick="setAllWeeklyReportCols(true)">
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      Hiện tất cả
                    </button>
                    <button type="button" class="weekly-cols-action weekly-cols-action--hide" onclick="setAllWeeklyReportCols(false)">
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      Ẩn tất cả
                    </button>
                  </div>
                </div>
                <div class="weekly-cols-list">
                  ${[
                  { id: 'PHAT_SINH', label: 'Phát sinh' },
                  { id: 'DA_DUYET', label: 'Đã duyệt HSBT' },
                  { id: 'CHUA_DUYET', label: 'Chưa duyệt PASC' },
                  { id: 'CHUYEN_DNTT', label: 'Chuyển ĐNTT' },
                  { id: 'LGN_CARPLA', label: 'Lượng xe Carpla' },
                  { id: 'TNDS_TON', label: 'Hồ sơ TNDS tồn lũy kế' },
                  { id: 'HS_TON_30', label: `HS Tồn > ${cachedReportRules.hsTonDays} ngày` },
                  { id: 'HS_DPBT_50', label: `HS DPBT > ${cachedReportRules.hsDpbtAmount/1000000}TR` },
                  { id: 'AVG_10', label: `Số tiền bình quân < ${cachedReportRules.avgAmount/1000000}TR` },
                  { id: 'REV_CARPLA', label: 'Doanh số Carpla lũy kế tháng' }
                  ].map(col => {
                    const isVisible = activeWeeklyReportCols.includes(col.id);
                    return `
                  <label class="weekly-cols-option ${isVisible ? 'is-active' : ''}">
                    <input class="weekly-cols-checkbox" type="checkbox" ${isVisible ? 'checked' : ''} onclick="toggleWeeklyReportCol('${col.id}', event)">
                    <span class="weekly-cols-checkmark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg></span>
                    <span class="weekly-cols-option__content">
                      <span class="weekly-cols-option__label">${col.label}</span>
                      <span class="weekly-cols-option__state">${isVisible ? 'Đang hiển thị' : 'Đang ẩn'}</span>
                    </span>
                  </label>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
          </div>

          <div class="hide-on-screenshot weekly-report-export-action" style="position: absolute; right: 26px; top: 22px; z-index: 10;">
            <button type="button" class="weekly-report-image-export" onclick="downloadWeeklyZoneReportImage('png')" style="padding: 8px 16px; border-radius: 11px; background: var(--bg-soft); border: 1px solid var(--border-strong); color: var(--text-main); font-size: 12.5px; font-weight: 850; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: var(--shadow-xs); transition: all 0.2s ease;" title="Tải ảnh báo cáo tuần (PNG/JPG)">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
              <span>Xuất ảnh</span>
            </button>
          </div>
          
          <div class="weekly-report-title-block" style="text-align: center; margin-bottom: 22px; padding-bottom: 16px; border-bottom: 1px dashed var(--border);">
            <span class="weekly-report-eyebrow">TIẾN ĐỘ NGHIỆP VỤ</span>
            <h2 style="color: #ef4444; font-size: 22px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 0.05em; line-height: 1.3;">
              ${(function() {
                if (period && period.startDate && period.endDate) {
                  const sD = period.startDate.getDate();
                  const sM = period.startDate.getMonth();
                  const sY = period.startDate.getFullYear();
                  const eD = period.endDate.getDate();
                  const eM = period.endDate.getMonth();
                  const eY = period.endDate.getFullYear();
                  const lastDay = new Date(sY, sM + 1, 0).getDate();
                  if (sM === eM && sY === eY && sD === 1 && eD === lastDay) {
                    return 'BÁO CÁO THÁNG';
                  }
                }
                return 'BÁO CÁO TUẦN / THÁNG';
              })()}
            </h2>
            <div class="weekly-report-period" style="color: #ef4444; font-size: 13.5px; font-weight: 850; margin-top: 6px; ">
              ${period.label}
            </div>
          </div>
          </div>

          <div style="overflow-x: auto; flex: 1;">
            <table style="--weekly-column-count: ${activeWeeklyReportCols.length}; width: 100%; border-collapse: collapse; font-size: 13.5px; text-align: center;">
              <thead>
                <tr style="background: var(--bg-soft); border: 1px solid var(--border-strong);">
                  <th style="padding: 14px 12px; border: 1px solid var(--border-strong); font-size: 13px; font-weight: 850; color: var(--text-main); width: 50px;">STT</th>
                  <th style="padding: 14px 14px; border: 1px solid var(--border-strong); font-size: 13px; font-weight: 850; color: var(--text-main); text-align: left; min-width: 170px;">GDV</th>
                  <th style="display: ${activeWeeklyReportCols.includes('PHAT_SINH') ? 'table-cell' : 'none'}; padding: 14px 12px; border: 1px solid var(--border-strong); font-size: 13px; font-weight: 850; color: #3b82f6;">PHÁT SINH</th>
                  <th style="display: ${activeWeeklyReportCols.includes('DA_DUYET') ? 'table-cell' : 'none'}; padding: 14px 12px; border: 1px solid var(--border-strong); font-size: 13px; font-weight: 850; color: #10b981;">ĐÃ DUYỆT HSBT</th>
                  <th style="display: ${activeWeeklyReportCols.includes('CHUA_DUYET') ? 'table-cell' : 'none'}; padding: 14px 12px; border: 1px solid var(--border-strong); font-size: 13px; font-weight: 850; color: #f59e0b;">CHƯA DUYỆT PASC</th>
                  <th style="display: ${activeWeeklyReportCols.includes('CHUYEN_DNTT') ? 'table-cell' : 'none'}; padding: 14px 12px; border: 1px solid var(--border-strong); font-size: 13px; font-weight: 850; color: #ec4899;">CHUYỂN ĐNTT</th>
                  <th style="display: ${activeWeeklyReportCols.includes('LGN_CARPLA') ? 'table-cell' : 'none'}; padding: 14px 12px; border: 1px solid var(--border-strong); font-size: 13px; font-weight: 850; color: #06b6d4;">LƯỢNG XE CARPLA</th>
                  <th style="display: ${activeWeeklyReportCols.includes('TNDS_TON') ? 'table-cell' : 'none'}; padding: 14px 12px; border: 1px solid var(--border-strong); font-size: 13px; font-weight: 850; color: #6366f1;">HỒ SƠ TNDS TỔN LŨY KẾ</th>
                  <th style="display: ${activeWeeklyReportCols.includes('HS_TON_30') ? 'table-cell' : 'none'}; padding: 14px 12px; border: 1px solid var(--border-strong); font-size: 13px; font-weight: 850; color: #dc2626;">HS TỒN &gt; 30 NGÀY</th>
                  <th style="display: ${activeWeeklyReportCols.includes('HS_DPBT_50') ? 'table-cell' : 'none'}; padding: 14px 12px; border: 1px solid var(--border-strong); font-size: 13px; font-weight: 850; color: #e11d48;">HS DPBT &gt; 50TR</th>
                  <th style="display: ${activeWeeklyReportCols.includes('AVG_10') ? 'table-cell' : 'none'}; padding: 14px 12px; border: 1px solid var(--border-strong); font-size: 13px; font-weight: 850; color: #2563eb;">SỐ TIỀN BÌNH QUÂN DƯỚI 10TR</th>
                  <th style="display: ${activeWeeklyReportCols.includes('REV_CARPLA') ? 'table-cell' : 'none'}; padding: 8px; border: 1px solid var(--border-strong); font-size: 11.5px; font-weight: 850; color: #854d0e; background: #fef08a; position: relative;">
                  <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
                    <span>DOANH SỐ CARPLA LŨY KẾ THÁNG ${currentMonth}</span>
                    <button type="button" onclick="openCarplaDataSourceModal()" class="hide-on-screenshot" style="padding:4px 10px; font-size:10.5px; font-weight:800; background:linear-gradient(135deg, #d97706 0%, #b45309 100%); color:#fff; border:1px solid rgba(255,255,255,0.25); border-radius:6px; cursor:pointer; box-shadow:0 2px 6px rgba(180,83,9,0.3); transition:all 0.2s; display:inline-flex; align-items:center; gap:4px;" onmouseover="this.style.background='#a16207'; this.style.transform='translateY(-1px)'" onmouseout="this.style.background='linear-gradient(135deg, #d97706 0%, #b45309 100%)'; this.style.transform='none'">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
                      <span>Nguồn dữ liệu</span>
                    </button>
                  </div>
                </th>
                </tr>
              </thead>
              <tbody>
                ${list.map((r, idx) => {
                  const chuaDuyetVal = r.chuaDuyetPasc || Math.max(0, r.phatSinh - r.daDuyetHsb);
                  const avgUnder10M = r.countUnder10M > 0 ? Math.round(r.sumAmtUnder10M / r.countUnder10M) : 0;
                  return `
                    <tr style="border: 1px solid var(--border); ${idx % 2 === 0 ? 'background: var(--surface);' : 'background: var(--bg-soft);'}">
                      <td style="padding: 16px 12px; border: 1px solid var(--border); font-weight: 850; color: var(--primary); font-size: 14.5px;">${idx + 1}</td>
                      <td style="padding: 16px 14px; border: 1px solid var(--border); text-align: left; font-weight: 850; color: var(--text-main); font-size: 14.5px;">${escapeHtmlOutput(r.gdvName)}</td>
                      <td style="display: ${activeWeeklyReportCols.includes('PHAT_SINH') ? 'table-cell' : 'none'}; padding: 16px 12px; border: 1px solid var(--border); font-weight: 850; font-size: 14.5px; color: #3b82f6; ">${r.phatSinh}</td>
                      <td style="display: ${activeWeeklyReportCols.includes('DA_DUYET') ? 'table-cell' : 'none'}; padding: 16px 12px; border: 1px solid var(--border); font-weight: 850; font-size: 14.5px; color: #10b981; ">${r.daDuyetHsb}</td>
                      <td style="display: ${activeWeeklyReportCols.includes('CHUA_DUYET') ? 'table-cell' : 'none'}; padding: 16px 12px; border: 1px solid var(--border); font-weight: 850; font-size: 14.5px; color: #f59e0b; ">${chuaDuyetVal}</td>
                      <td style="display: ${activeWeeklyReportCols.includes('CHUYEN_DNTT') ? 'table-cell' : 'none'}; padding: 16px 12px; border: 1px solid var(--border); font-weight: 800; font-size: 14.5px; color: #ec4899; ">${r.chuyenDntt || 0}</td>
                      <td style="display: ${activeWeeklyReportCols.includes('LGN_CARPLA') ? 'table-cell' : 'none'}; padding: 16px 12px; border: 1px solid var(--border); font-weight: 800; font-size: 14.5px; color: #06b6d4; ">${r.carplaCount || 0}</td>
                      <td style="display: ${activeWeeklyReportCols.includes('TNDS_TON') ? 'table-cell' : 'none'}; padding: 16px 12px; border: 1px solid var(--border); font-weight: 850; font-size: 14.5px; color: #6366f1; ">${r.tndsTonLuyKe}</td>
                      <td style="display: ${activeWeeklyReportCols.includes('HS_TON_30') ? 'table-cell' : 'none'}; padding: 16px 12px; border: 1px solid var(--border); font-weight: 850; font-size: 14.5px; color: #dc2626; ">${r.hsTonOver30Days || 0}</td>
                      <td style="display: ${activeWeeklyReportCols.includes('HS_DPBT_50') ? 'table-cell' : 'none'}; padding: 16px 12px; border: 1px solid var(--border); font-weight: 850; font-size: 14.5px; color: #e11d48; ">${r.hsDuPhongOver50M || 0}</td>
                      <td style="display: ${activeWeeklyReportCols.includes('AVG_10') ? 'table-cell' : 'none'}; padding: 16px 12px; border: 1px solid var(--border); font-weight: 850; font-size: 14.5px; color: #2563eb; ">${avgUnder10M ? formatCurrencyInputNumber(avgUnder10M) + ' đ' : '0 đ'}</td>
                      <td style="display: ${activeWeeklyReportCols.includes('REV_CARPLA') ? 'table-cell' : 'none'}; padding: 16px 12px; border: 1px solid var(--border); font-weight: 850; font-size: 14.5px; color: #854d0e; background: #fef9c3; ">${r.carplaCumulativeRevenue ? formatCurrencyInputNumber(r.carplaCumulativeRevenue) + ' đ' : '0 đ'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
              <tfoot>
                <tr style="background: rgba(59,130,246,0.08); border: 2px solid var(--border-strong); font-weight: 850;">
                  <td style="padding: 16px 12px; border: 1px solid var(--border); color: #3b82f6;"></td>
                  <td style="padding: 18px 14px; border: 1px solid var(--border); text-align: left; color: #3b82f6; font-size: 15.5px; font-weight: 900;">Tổng Cộng</td>
                  <td style="display: ${activeWeeklyReportCols.includes('PHAT_SINH') ? 'table-cell' : 'none'}; padding: 18px 12px; border: 1px solid var(--border); font-size: 15.5px; font-weight: 900; color: #3b82f6;">${sumPhatSinh}</td>
                  <td style="display: ${activeWeeklyReportCols.includes('DA_DUYET') ? 'table-cell' : 'none'}; padding: 18px 12px; border: 1px solid var(--border); font-size: 15.5px; font-weight: 900; color: #10b981;">${sumDaDuyet}</td>
                  <td style="display: ${activeWeeklyReportCols.includes('CHUA_DUYET') ? 'table-cell' : 'none'}; padding: 18px 12px; border: 1px solid var(--border); font-size: 15.5px; font-weight: 900; color: #f59e0b;">${sumChuaDuyet}</td>
                  <td style="display: ${activeWeeklyReportCols.includes('CHUYEN_DNTT') ? 'table-cell' : 'none'}; padding: 18px 12px; border: 1px solid var(--border); font-size: 15.5px; font-weight: 900; color: #ec4899;">${sumChuyenDntt}</td>
                  <td style="display: ${activeWeeklyReportCols.includes('LGN_CARPLA') ? 'table-cell' : 'none'}; padding: 18px 12px; border: 1px solid var(--border); font-size: 15.5px; font-weight: 900; color: #06b6d4;">${sumCarpla}</td>
                  <td style="display: ${activeWeeklyReportCols.includes('TNDS_TON') ? 'table-cell' : 'none'}; padding: 18px 12px; border: 1px solid var(--border); font-size: 15.5px; font-weight: 900; color: #6366f1;">${sumTndsTon}</td>
                  <td style="display: ${activeWeeklyReportCols.includes('HS_TON_30') ? 'table-cell' : 'none'}; padding: 18px 12px; border: 1px solid var(--border); font-size: 15.5px; font-weight: 900; color: #dc2626;">${sumHsTonOver30}</td>
                  <td style="display: ${activeWeeklyReportCols.includes('HS_DPBT_50') ? 'table-cell' : 'none'}; padding: 18px 12px; border: 1px solid var(--border); font-size: 15.5px; font-weight: 900; color: #e11d48;">${sumHsDuPhongOver50M}</td>
                  <td style="display: ${activeWeeklyReportCols.includes('AVG_10') ? 'table-cell' : 'none'}; padding: 18px 12px; border: 1px solid var(--border); font-size: 15.5px; font-weight: 900; color: #2563eb;">${overallAvgUnder10M ? formatCurrencyInputNumber(overallAvgUnder10M) + ' đ' : '0 đ'}</td>
                  <td style="display: ${activeWeeklyReportCols.includes('REV_CARPLA') ? 'table-cell' : 'none'}; padding: 18px 12px; border: 1px solid var(--border); font-size: 15.5px; font-weight: 900; color: #854d0e; background: #fef08a;">${sumCarplaCumulativeRev ? formatCurrencyInputNumber(sumCarplaCumulativeRev) + ' đ' : '0 đ'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      `;
    }


    function getAnnualGdvClaimsData() {
      const year = Number(activeAnnualClaimsYear) || new Date().getFullYear();
      const dateField = cachedReportRules.phatSinhDateField || 'ngayMoHs';
      const selectedNames = new Set((activeSelectedGdvNames || []).map(name => String(name).trim().toLocaleLowerCase('vi')));
      const rowsByName = new Map();
      const ensureRow = name => {
        const normalizedName = String(name || 'Chưa phân công').trim() || 'Chưa phân công';
        const key = normalizedName.toLocaleLowerCase('vi');
        if (!rowsByName.has(key)) rowsByName.set(key, { name: normalizedName, months: Array(12).fill(0), total: 0, types: { VCX: { months: Array(12).fill(0), total: 0, activeMonths: 0 }, TNDS: { months: Array(12).fill(0), total: 0, activeMonths: 0 } } });
        return rowsByName.get(key);
      };

      getAllAvailableGdvNames().forEach(name => {
        if (!selectedNames.size || selectedNames.has(String(name).trim().toLocaleLowerCase('vi'))) ensureRow(name);
      });

      Object.values(cachedPendingClaimsPayload || {}).forEach(claim => {
        if (!isPhatSinh(claim)) return;
        const dateMs = getClaimDateMs(claim, dateField);
        if (!(dateMs > 0)) return;
        const date = new Date(dateMs);
        if (date.getFullYear() !== year) return;

        const gdvName = (claim.gdvTiepNhan || claim.canBoXuLy || claim.gdvHo || claim.canBoBoiThuong || claim.gdvName || claim.createdByName || 'Chưa phân công').trim();
        const key = gdvName.toLocaleLowerCase('vi');
        if (selectedNames.size && !selectedNames.has(key)) return;
        const row = ensureRow(gdvName);
        const monthIndex = date.getMonth();
        const typeKey = isTndsClaim(claim) ? 'TNDS' : 'VCX';
        row.months[monthIndex]++;
        row.total++;
        row.types[typeKey].months[monthIndex]++;
        row.types[typeKey].total++;
      });

      const rows = Array.from(rowsByName.values()).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'vi'));
      const totals = Array(12).fill(0);
      rows.forEach(row => row.months.forEach((count, index) => totals[index] += count));
      rows.forEach(row => ['VCX', 'TNDS'].forEach(type => {
        row.types[type].activeMonths = row.types[type].months.filter(count => count > 0).length;
        row.types[type].average = row.types[type].activeMonths ? row.types[type].total / row.types[type].activeMonths : 0;
      }));
      const typeTotals = { VCX: { total: 0, activeMonths: 0 }, TNDS: { total: 0, activeMonths: 0 } };
      rows.forEach(row => ['VCX', 'TNDS'].forEach(type => {
        typeTotals[type].total += row.types[type].total;
        typeTotals[type].activeMonths += row.types[type].activeMonths;
      }));
      ['VCX', 'TNDS'].forEach(type => typeTotals[type].average = typeTotals[type].activeMonths ? typeTotals[type].total / typeTotals[type].activeMonths : 0);
      return { year, rows, totals, total: totals.reduce((sum, count) => sum + count, 0), typeTotals };
    }


    function renderAnnualGdvClaimsReportHtml() {
      const { year, rows, totals, total, typeTotals } = getAnnualGdvClaimsData();
      const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
      const activeMonth = totals.reduce((best, count, index) => count > totals[best] ? index : best, 0);
      const activeGdvCount = rows.filter(row => row.total > 0).length;

      return `
        <section id="annualClaimsReportCard" class="annual-claims-report-card" aria-label="Báo cáo hồ sơ phát sinh năm ${year}">
          <div class="weekly-report-kpi-grid" aria-label="Tổng quan phát sinh năm ${year}">
            <div class="weekly-report-kpi" style="--kpi-color:#c99a43;"><div class="weekly-report-kpi__head"><span class="weekly-report-kpi__label">Tổng hồ sơ phát sinh</span></div><div class="weekly-report-kpi__value">${total.toLocaleString('vi-VN')}</div><div class="weekly-report-kpi__meta">Trong năm ${year}</div></div>
            <div class="weekly-report-kpi" style="--kpi-color:#10b981;"><div class="weekly-report-kpi__head"><span class="weekly-report-kpi__label">Giám định viên có hồ sơ</span></div><div class="weekly-report-kpi__value">${activeGdvCount}</div><div class="weekly-report-kpi__meta">Trên ${rows.length} giám định viên đang hiển thị</div></div>
            <div class="weekly-report-kpi" style="--kpi-color:#3b82f6;"><div class="weekly-report-kpi__head"><span class="weekly-report-kpi__label">Tháng phát sinh cao nhất</span></div><div class="weekly-report-kpi__value">${total ? monthNames[activeMonth] : '—'}</div><div class="weekly-report-kpi__meta">${totals[activeMonth].toLocaleString('vi-VN')} hồ sơ</div></div>
            <div class="weekly-report-kpi" style="--kpi-color:#8b5cf6;"><div class="weekly-report-kpi__head"><span class="weekly-report-kpi__label">Bình quân / 12 tháng</span></div><div class="weekly-report-kpi__value">${(total / 12).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</div><div class="weekly-report-kpi__meta">Tính đủ 12 tháng</div></div>
          </div>
          <section class="annual-claims-chart-card" aria-label="Diễn biến hồ sơ phát sinh">
          <header class="annual-claims-report-heading">
            <div><span class="annual-claims-eyebrow">DIỄN BIẾN HỒ SƠ</span><h2>Hồ sơ phát sinh theo giám định viên</h2><p>Số lượng hồ sơ mở mới theo tháng, tính theo trường ngày phát sinh đã cấu hình.</p></div>
            <div class="annual-claims-report-actions">
              <button type="button" class="annual-claims-download-btn" onclick="downloadAnnualGdvClaimsReportImage()" title="Tải ảnh PNG toàn bộ báo cáo phát sinh và bình quân VCX/TNDS"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="3"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="m3 17 5-5 4 4 3-3 6 6"></path></svg><span>Tải ảnh báo cáo</span></button>
              <span class="annual-claims-year-badge"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="3" y="4" width="18" height="17" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path></svg>Năm ${year}</span>
            </div>
          </header>
          <div class="annual-claims-chart-panel">
            <div class="annual-claims-chart-toolbar">
              <span class="annual-claims-chart-toolbar__title">Diễn biến hồ sơ phát sinh theo tháng · ${year}</span>
              <div class="annual-claims-chart-toggle" role="group" aria-label="Kiểu biểu đồ">
                <button type="button" class="${activeAnnualClaimsChartType === 'bar' ? 'is-active' : ''}" onclick="activeAnnualClaimsChartType='bar'; renderGdvMonthlyReportPage();">Biểu đồ cột</button>
                <button type="button" class="${activeAnnualClaimsChartType === 'line' ? 'is-active' : ''}" onclick="activeAnnualClaimsChartType='line'; renderGdvMonthlyReportPage();">Biểu đồ đường</button>
              </div>
            </div>
            ${rows.length ? `<div class="annual-claims-chart-canvas-wrap"><canvas id="annualClaimsMonthlyChart" aria-label="Biểu đồ số hồ sơ phát sinh theo giám định viên từng tháng"></canvas></div><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" onload="if(window.initAnnualClaimsChart) setTimeout(window.initAnnualClaimsChart, 40); this.remove();" style="display:none;" />` : `<div class="annual-claims-empty">Không có hồ sơ phát sinh trong năm ${year} theo bộ lọc hiện tại.</div>`}
          </div>
          </section>
          <section class="annual-claims-average" aria-label="Bình quân hồ sơ theo loại hình">
            <header class="annual-claims-average__head">
              <div><span class="annual-claims-eyebrow">CHI TIẾT THEO NGHIỆP VỤ</span><h3>Bình quân hồ sơ theo giám định viên</h3><p>Tính riêng VCX và TNDS. Chỉ chia cho số tháng từng người có phát sinh loại hồ sơ tương ứng; tháng không phát sinh được loại khỏi mẫu số.</p></div>
              <span class="annual-claims-average__formula">Tổng hồ sơ ÷ tháng có phát sinh</span>
            </header>
            <div class="annual-claims-average__scroll">
              <table class="annual-claims-average__table">
                <colgroup><col style="width:205px;">${monthNames.map(() => '<col style="width:52px;"><col style="width:52px;">').join('')}<col style="width:98px;"><col style="width:130px;"><col style="width:100px;"><col style="width:135px;"></colgroup>
                <thead>
                  <tr><th rowspan="2" style="width:205px;">Giám định viên</th>${monthNames.map(month => `<th colspan="2" class="month-group">${month}</th>`).join('')}<th colspan="4" class="month-group">Tổng năm & bình quân</th></tr>
                  <tr>${monthNames.map(() => '<th class="monthly-vcx-head">VCX</th><th class="monthly-tnds-head">TNDS</th>').join('')}<th class="monthly-vcx-head">Tổng VCX</th><th class="monthly-vcx-head">BQ VCX/tháng</th><th class="monthly-tnds-head">Tổng TNDS</th><th class="monthly-tnds-head">BQ TNDS/tháng</th></tr>
                </thead>
                <tbody>${rows.length ? rows.map(row => `<tr><td>${escapeHtmlOutput(row.name)}</td>${monthNames.map((_, monthIndex) => `<td class="monthly-count monthly-vcx">${row.types.VCX.months[monthIndex].toLocaleString('vi-VN')}</td><td class="monthly-count monthly-tnds">${row.types.TNDS.months[monthIndex].toLocaleString('vi-VN')}</td>`).join('')}<td class="annual-summary-col monthly-vcx">${row.types.VCX.total.toLocaleString('vi-VN')}</td><td class="annual-summary-col average-value vcx-col">${row.types.VCX.average.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td><td class="annual-summary-col monthly-tnds">${row.types.TNDS.total.toLocaleString('vi-VN')}</td><td class="annual-summary-col average-value tnds-col">${row.types.TNDS.average.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td></tr>`).join('') : `<tr><td colspan="29" class="annual-claims-empty">Chưa có dữ liệu theo bộ lọc hiện tại.</td></tr>`}</tbody>
                ${rows.length ? `<tfoot><tr><td>Tổng cộng</td>${monthNames.map((_, monthIndex) => `<td class="monthly-count monthly-vcx">${rows.reduce((sum, row) => sum + row.types.VCX.months[monthIndex], 0).toLocaleString('vi-VN')}</td><td class="monthly-count monthly-tnds">${rows.reduce((sum, row) => sum + row.types.TNDS.months[monthIndex], 0).toLocaleString('vi-VN')}</td>`).join('')}<td class="annual-summary-col monthly-vcx">${typeTotals.VCX.total.toLocaleString('vi-VN')}</td><td class="annual-summary-col">${typeTotals.VCX.average.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td><td class="annual-summary-col monthly-tnds">${typeTotals.TNDS.total.toLocaleString('vi-VN')}</td><td class="annual-summary-col">${typeTotals.TNDS.average.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td></tr></tfoot>` : ''}
              </table>
            </div>
          </section>
        </section>
      `;
    }


    function initAnnualClaimsChart() {
      const averageTableScroll = document.querySelector('.annual-claims-average__scroll');
      if (averageTableScroll) averageTableScroll.scrollLeft = 0;
      const canvas = document.getElementById('annualClaimsMonthlyChart');
      if (!canvas || typeof Chart === 'undefined') return;
      const { rows } = getAnnualGdvClaimsData();
      if (annualClaimsChartInstance) {
        annualClaimsChartInstance.destroy();
        annualClaimsChartInstance = null;
      }
      const monthLabels = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
      const palette = ['#b88935', '#10b981', '#3b82f6', '#a855f7', '#ef4444', '#06b6d4', '#f97316', '#64748b', '#ec4899', '#84cc16'];
      const chartStyle = getComputedStyle(canvas.closest('.gdv-report-premium-shell') || canvas);
      const chartMuted = chartStyle.getPropertyValue('--ton-muted').trim() || '#76817e';
      const chartLine = chartStyle.getPropertyValue('--ton-line').trim() || '#e5e8e0';
      const chartInk = chartStyle.getPropertyValue('--ton-ink').trim() || '#283b36';
      const chartPaper = chartStyle.getPropertyValue('--ton-paper').trim() || '#fffefb';
      const isLine = activeAnnualClaimsChartType === 'line';
      annualClaimsChartInstance = new Chart(canvas.getContext('2d'), {
        type: isLine ? 'line' : 'bar',
        data: {
          labels: monthLabels,
          datasets: rows.map((row, index) => ({
            label: row.name,
            data: row.months,
            borderColor: palette[index % palette.length],
            backgroundColor: isLine ? palette[index % palette.length] : `${palette[index % palette.length]}cc`,
            borderWidth: isLine ? 2.5 : 1,
            borderRadius: isLine ? 0 : 6,
            pointRadius: isLine ? 3.5 : 0,
            pointHoverRadius: 5,
            tension: .34,
            fill: false,
            maxBarThickness: 38
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: isLine ? 'circle' : 'rectRounded', boxWidth: 8, boxHeight: 8, padding: 20, color: chartInk, font: { family: chartStyle.fontFamily, size: 11, weight: '600' } } },
            tooltip: { backgroundColor: chartInk, titleColor: chartPaper, bodyColor: chartPaper, padding: 12, cornerRadius: 10, displayColors: true }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: chartMuted, font: { family: chartStyle.fontFamily, size: 10, weight: '600' } }, border: { display: false } },
            y: { beginAtZero: true, ticks: { precision: 0, color: chartMuted, font: { family: chartStyle.fontFamily, size: 10 } }, grid: { color: chartLine, drawBorder: false }, border: { display: false }, title: { display: true, text: 'Số hồ sơ', color: chartMuted, font: { family: chartStyle.fontFamily, size: 11, weight: '600' } } }
          }
        }
      });
    }


    async function downloadAnnualGdvClaimsReportImage() {
      if (!hasUserPermission('report', 'export')) {
        triggerToast('Bạn không có quyền tải ảnh báo cáo.', 'warning');
        return;
      }
      const cardEl = document.getElementById('annualClaimsReportCard');
      if (!cardEl) {
        triggerToast('Không tìm thấy báo cáo để tạo ảnh.', 'error');
        return;
      }
      if (typeof html2canvas === 'undefined') {
        triggerToast('Thư viện tạo ảnh chưa sẵn sàng. Vui lòng thử lại.', 'warning');
        return;
      }

      const tableEl = cardEl.querySelector('.annual-claims-average__table');
      const exportWidth = Math.max(cardEl.offsetWidth, (tableEl ? tableEl.scrollWidth : 0) + 54);
      const exportScale = Math.max(1, Math.min(2, 4096 / exportWidth));
      const { year } = getAnnualGdvClaimsData();
      triggerToast('Đang tạo ảnh báo cáo...', 'info');
      try {
        const canvas = await html2canvas(cardEl, {
          scale: exportScale,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          logging: false,
          scrollX: 0,
          scrollY: 0,
          windowWidth: Math.max(document.documentElement.clientWidth, exportWidth + 64),
          onclone: function(clonedDoc) {
            const target = clonedDoc.getElementById('annualClaimsReportCard');
            if (!target) return;
            target.classList.add('annual-claims-report--export');
            target.style.width = `${exportWidth}px`;
            target.style.maxWidth = 'none';
            target.style.boxShadow = 'none';
            target.style.transform = 'none';
            target.style.background = '#ffffff';
            const tableScroll = target.querySelector('.annual-claims-average__scroll');
            if (tableScroll) {
              tableScroll.style.overflow = 'visible';
              tableScroll.style.width = '100%';
            }
            const chartWrap = target.querySelector('.annual-claims-chart-canvas-wrap');
            if (chartWrap) {
              chartWrap.style.maxWidth = `${Math.max(cardEl.offsetWidth - 94, 600)}px`;
              chartWrap.style.marginInline = 'auto';
            }
            const downloadButton = target.querySelector('.annual-claims-download-btn');
            if (downloadButton) downloadButton.style.display = 'none';
          }
        });
        const link = document.createElement('a');
        link.download = `Bao_Cao_Phat_Sinh_Theo_GDV_${year}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        link.remove();
        triggerToast('Đã tải ảnh báo cáo thành công!', 'success');
      } catch (error) {
        console.error('Lỗi tải ảnh báo cáo phát sinh năm:', error);
        triggerToast('Không thể tạo ảnh báo cáo. Vui lòng thử lại.', 'error');
      }
    }


    function exportAnnualGdvClaimsReportExcel() {
      if (!hasUserPermission('report', 'export')) {
        triggerToast('Bạn không có quyền xuất dữ liệu báo cáo.', 'warning');
        return;
      }
      const { year, rows, totals, total, typeTotals } = getAnnualGdvClaimsData();
      const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
      const data = [['Giám định viên', ...monthNames, 'Tổng năm'], ...rows.map(row => [row.name, ...row.months, row.total]), ['Tổng cộng', ...totals, total]];
      const sheet = XLSX.utils.aoa_to_sheet(data);
      sheet['!cols'] = [{ wch: 30 }, ...monthNames.map(() => ({ wch: 13 })), { wch: 15 }];
      const monthlyDetailHeaders = monthNames.flatMap(month => [`${month} - VCX`, `${month} - TNDS`]);
      const monthlyDetailTotals = monthNames.flatMap((_, monthIndex) => [
        rows.reduce((sum, row) => sum + row.types.VCX.months[monthIndex], 0),
        rows.reduce((sum, row) => sum + row.types.TNDS.months[monthIndex], 0)
      ]);
      const averageData = [
        ['Giám định viên', ...monthlyDetailHeaders, 'Tổng VCX', 'Bình quân VCX/tháng', 'Tổng TNDS', 'Bình quân TNDS/tháng'],
        ...rows.map(row => [row.name, ...monthNames.flatMap((_, monthIndex) => [row.types.VCX.months[monthIndex], row.types.TNDS.months[monthIndex]]), row.types.VCX.total, Number(row.types.VCX.average.toFixed(1)), row.types.TNDS.total, Number(row.types.TNDS.average.toFixed(1))]),
        ['Tổng cộng', ...monthlyDetailTotals, typeTotals.VCX.total, Number(typeTotals.VCX.average.toFixed(1)), typeTotals.TNDS.total, Number(typeTotals.TNDS.average.toFixed(1))]
      ];
      const averageSheet = XLSX.utils.aoa_to_sheet(averageData);
      averageSheet['!cols'] = [{ wch: 30 }, ...monthlyDetailHeaders.map(() => ({ wch: 13 })), { wch: 15 }, { wch: 21 }, { wch: 15 }, { wch: 22 }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, `Phat sinh ${year}`);
      XLSX.utils.book_append_sheet(workbook, averageSheet, 'Binh quan VCX-TNDS');
      XLSX.writeFile(workbook, `Bao_Cao_Phat_Sinh_Theo_GDV_${year}.xlsx`);
      triggerToast(`Đã tải báo cáo phát sinh năm ${year} thành công!`, 'success');
    }


    
    function getAllAvailableGdvNames() {
      const setObj = new Set(['Hồ Quang Huy', 'Huỳnh Văn Phúc', 'Nguyễn Quang Huy_DL']);
      Object.values(cachedUsersPayload || {}).forEach(u => {
        const name = (u.profile?.displayName || u.displayName || u.name || '').trim();
        if (name) setObj.add(name);
      });
      Object.values(cachedPendingClaimsPayload || {}).forEach(c => {
        const name = getClaimGdvName(c);
        if (name && name !== 'Chưa phân công' && name !== 'Hệ thống Excel') setObj.add(name);
      });
      return Array.from(setObj).sort();
    }


    function toggleGdvSelectionOption(gdvName, evt) {
      if (evt) evt.stopPropagation();
      const index = activeSelectedGdvNames.indexOf(gdvName);
      if (index > -1) {
        activeSelectedGdvNames.splice(index, 1);
      } else {
        activeSelectedGdvNames.push(gdvName);
      }
      renderGdvReportPage();
    }


    function selectAllGdvOptions(evt) {
      if (evt) evt.stopPropagation();
      activeSelectedGdvNames = getAllAvailableGdvNames();
      renderGdvReportPage();
    }


    function clearAllGdvOptions(evt) {
      if (evt) evt.stopPropagation();
      activeSelectedGdvNames = [];
      renderGdvReportPage();
    }


    function resetGdvSelectionToDefault(evt) {
      if (evt) evt.stopPropagation();
      activeSelectedGdvNames = ['Hồ Quang Huy', 'Huỳnh Văn Phúc', 'Nguyễn Quang Huy_DL'];
      renderGdvReportPage();
    }


    function selectGdvReportWeek(weekVal) {
      activeGdvReportWeek = weekVal;
      const menu = document.getElementById('ddReportWeekMenu');
      if (menu) menu.style.display = 'none';
      renderGdvReportPage();
    }



    function getGdvReportDefaultDates() {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diffToSat = (dayOfWeek === 6) ? 0 : (dayOfWeek + 1);
      const start = new Date(now);
      start.setDate(now.getDate() - diffToSat);
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      const startYmd = start.getFullYear() + '-' + String(start.getMonth() + 1).padStart(2, '0') + '-' + String(start.getDate()).padStart(2, '0');
      const endYmd = end.getFullYear() + '-' + String(end.getMonth() + 1).padStart(2, '0') + '-' + String(end.getDate()).padStart(2, '0');

      return { startYmd, endYmd, start, end };
    }


    function reportDateToYmd(dateValue) {
      if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) return '';
      return dateValue.getFullYear() + '-' + String(dateValue.getMonth() + 1).padStart(2, '0') + '-' + String(dateValue.getDate()).padStart(2, '0');
    }


    function formatReportDateDisplay(ymdValue) {
      if (!ymdValue || typeof ymdValue !== 'string') return 'Chưa chọn';
      const parts = ymdValue.split('-');
      if (parts.length !== 3) return ymdValue;
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }


    function getReportDatePickerEffectiveRange() {
      const defaults = getGdvReportDefaultDates();
      return {
        start: pendingGdvReportStartDate || activeGdvReportStartDate || defaults.startYmd,
        end: pendingGdvReportEndDate || activeGdvReportEndDate || defaults.endYmd
      };
    }


    function buildReportDatePickerPanelHtml() {
      const effective = getReportDatePickerEffectiveRange();
      const draftStart = reportDatePickerDraftStart || effective.start;
      const draftEnd = reportDatePickerDraftEnd || effective.end;
      const focusedYmd = reportDatePickerFocus === 'end' ? draftEnd : draftStart;
      const focusParts = String(focusedYmd || '').split('-').map(Number);
      const fallbackDate = new Date();
      const viewDate = reportDatePickerViewMonth instanceof Date && !Number.isNaN(reportDatePickerViewMonth.getTime())
        ? reportDatePickerViewMonth
        : (focusParts.length === 3 && focusParts[0] ? new Date(focusParts[0], focusParts[1] - 1, 1) : new Date(fallbackDate.getFullYear(), fallbackDate.getMonth(), 1));
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();
      const monthNames = ['tháng Một', 'tháng Hai', 'tháng Ba', 'tháng Tư', 'tháng Năm', 'tháng Sáu', 'tháng Bảy', 'tháng Tám', 'tháng Chín', 'tháng Mười', 'tháng Mười Một', 'tháng Mười Hai'];
      const firstWeekOffset = (new Date(year, month, 1).getDay() + 6) % 7;
      const todayYmd = reportDateToYmd(new Date());
      let dayButtons = '';

      for (let index = 0; index < 42; index++) {
        const dayDate = new Date(year, month, 1 - firstWeekOffset + index);
        const dayYmd = reportDateToYmd(dayDate);
        const classes = ['report-date-day'];
        if (dayDate.getMonth() !== month) classes.push('is-outside');
        if (dayYmd === todayYmd) classes.push('is-today');
        if (dayYmd > draftStart && dayYmd < draftEnd) classes.push('is-in-range');
        if (dayYmd === draftStart || dayYmd === draftEnd) classes.push('is-selected');
        dayButtons += `<button type="button" class="${classes.join(' ')}" onclick="selectReportDatePickerDay('${dayYmd}', event)" aria-label="${formatReportDateDisplay(dayYmd)}">${dayDate.getDate()}</button>`;
      }

      return `
        <div class="report-date-picker__hero">
          <div class="report-date-picker__title"><span class="report-date-picker__title-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="17" rx="2"></rect><path d="M8 2v4M16 2v4M3 10h18"></path></svg></span><span>Chọn khoảng ngày báo cáo</span></div>
          <div class="report-date-picker__summary">
            <button type="button" class="report-date-summary ${reportDatePickerFocus === 'start' ? 'is-active' : ''}" onclick="setReportDatePickerFocus('start', event)"><small>Từ ngày</small><strong>${formatReportDateDisplay(draftStart)}</strong></button>
            <svg class="report-date-picker__arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>
            <button type="button" class="report-date-summary ${reportDatePickerFocus === 'end' ? 'is-active' : ''}" onclick="setReportDatePickerFocus('end', event)"><small>Đến ngày</small><strong>${formatReportDateDisplay(draftEnd)}</strong></button>
          </div>
        </div>
        <div class="report-date-picker__body">
          <div class="report-date-picker__nav">
            <button type="button" class="report-date-picker__nav-btn" onclick="navigateReportDatePicker(-1, event)" aria-label="Tháng trước"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
            <div class="report-date-picker__month">${monthNames[month]} ${year}</div>
            <button type="button" class="report-date-picker__nav-btn" onclick="navigateReportDatePicker(1, event)" aria-label="Tháng sau"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="9 18 15 12 9 6"></polyline></svg></button>
          </div>
          <div class="report-date-picker__weekdays">${['T2','T3','T4','T5','T6','T7','CN'].map(day => `<div class="report-date-picker__weekday">${day}</div>`).join('')}</div>
          <div class="report-date-picker__days">${dayButtons}</div>
          <div class="report-date-picker__presets">
            <button type="button" class="report-date-preset" onclick="selectReportDatePreset('week', event)">Tuần hiện tại</button>
            <button type="button" class="report-date-preset" onclick="selectReportDatePreset('today', event)">Hôm nay</button>
            <button type="button" class="report-date-preset" onclick="selectReportDatePreset('month', event)">Tháng này</button>
          </div>
        </div>
        <div class="report-date-picker__footer">
          <button type="button" class="report-date-picker__cancel" onclick="closeReportDatePicker(event)">Hủy</button>
          <button type="button" class="report-date-picker__apply" onclick="confirmReportDatePicker(event)">Xác nhận khoảng ngày</button>
        </div>
      `;
    }


    function renderReportDatePickerPanel() {
      const panel = document.getElementById('customReportDatePickerPanel');
      if (panel) {
        panel.innerHTML = buildReportDatePickerPanelHtml();
        syncWeeklyReportDatePickerState();
        positionWeeklyReportDatePicker();
      }
    }

    function syncWeeklyReportDatePickerState() {
      if (!document.getElementById('weeklyZoneReportCardContainer')) return;
      const panel = document.getElementById('customReportDatePickerPanel');
      const open = panel?.style.display === 'block';
      const triggerId = reportDatePickerFocus === 'end' ? 'reportEndDateTrigger' : 'reportStartDateTrigger';
      document.querySelectorAll('.report-date-trigger').forEach(trigger => {
        const active = open && trigger.id === triggerId;
        trigger.classList.toggle('is-open', active);
        trigger.setAttribute('aria-expanded', String(active));
      });
      panel?.parentElement.classList.toggle('ton-dropdown-host--open', open);
    }

    function positionWeeklyReportDatePicker() {
      if (!document.getElementById('weeklyZoneReportCardContainer')) return;
      const panel = document.getElementById('customReportDatePickerPanel');
      if (!panel || panel.style.display !== 'block') return;
      const trigger = document.getElementById(reportDatePickerFocus === 'end' ? 'reportEndDateTrigger' : 'reportStartDateTrigger');
      if (!trigger) return;
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = window.visualViewport ? Math.min(window.innerHeight, window.visualViewport.height) : window.innerHeight;
      const width = Math.min(380, viewportWidth - 24);
      const parentRect = panel.parentElement.getBoundingClientRect();
      const rect = trigger.getBoundingClientRect();
      const left = Math.max(12, Math.min(rect.right - width, viewportWidth - width - 12));
      const below = Math.max(0, viewportHeight - rect.bottom - 20);
      const above = Math.max(0, rect.top - 20);
      const showAbove = above > below;
      panel.style.width = width + 'px';
      panel.style.left = left - parentRect.left + 'px';
      panel.style.right = 'auto';
      panel.style.maxHeight = Math.max(80, Math.min(620, viewportHeight - 24)) + 'px';
      const preferredTop = showAbove ? rect.top - panel.offsetHeight - 8 : rect.bottom + 8;
      const top = Math.max(12, Math.min(preferredTop, viewportHeight - panel.offsetHeight - 12));
      panel.style.top = top - parentRect.top + 'px';
      panel.style.bottom = 'auto';
    }


    function openReportDatePicker(focusField, event) {
      if (event) event.stopPropagation();
      const panel = document.getElementById('customReportDatePickerPanel');
      if (!panel) return;
      const wasOpen = panel.style.display === 'block';
      const previousFocus = reportDatePickerFocus;
      document.querySelectorAll('.custom-select-menu').forEach(menu => menu.style.display = 'none');
      if (wasOpen && previousFocus === focusField) {
        activeOpenDropdownId = null;
        if (typeof syncTonReportDropdownState === 'function') syncTonReportDropdownState();
        return;
      }

      const effective = getReportDatePickerEffectiveRange();
      if (!wasOpen) {
        reportDatePickerDraftStart = effective.start;
        reportDatePickerDraftEnd = effective.end;
      }
      reportDatePickerFocus = focusField === 'end' ? 'end' : 'start';
      const selectedYmd = reportDatePickerFocus === 'end' ? reportDatePickerDraftEnd : reportDatePickerDraftStart;
      const parts = String(selectedYmd || '').split('-').map(Number);
      reportDatePickerViewMonth = parts.length === 3 && parts[0] ? new Date(parts[0], parts[1] - 1, 1) : new Date();
      renderReportDatePickerPanel();
      panel.style.display = 'block';
      activeOpenDropdownId = 'customReportDatePickerPanel';
      if (typeof syncTonReportDropdownState === 'function') syncTonReportDropdownState();
      positionWeeklyReportDatePicker();
    }


    function setReportDatePickerFocus(focusField, event) {
      if (event) event.stopPropagation();
      reportDatePickerFocus = focusField === 'end' ? 'end' : 'start';
      const selectedYmd = reportDatePickerFocus === 'end' ? reportDatePickerDraftEnd : reportDatePickerDraftStart;
      const parts = String(selectedYmd || '').split('-').map(Number);
      if (parts.length === 3 && parts[0]) reportDatePickerViewMonth = new Date(parts[0], parts[1] - 1, 1);
      renderReportDatePickerPanel();
    }


    function navigateReportDatePicker(monthOffset, event) {
      if (event) event.stopPropagation();
      const base = reportDatePickerViewMonth instanceof Date ? reportDatePickerViewMonth : new Date();
      reportDatePickerViewMonth = new Date(base.getFullYear(), base.getMonth() + Number(monthOffset || 0), 1);
      renderReportDatePickerPanel();
    }


    function selectReportDatePickerDay(ymdValue, event) {
      if (event) event.stopPropagation();
      if (reportDatePickerFocus === 'start') {
        reportDatePickerDraftStart = ymdValue;
        if (!reportDatePickerDraftEnd || reportDatePickerDraftEnd < ymdValue) reportDatePickerDraftEnd = ymdValue;
        reportDatePickerFocus = 'end';
      } else {
        reportDatePickerDraftEnd = ymdValue;
        if (!reportDatePickerDraftStart || reportDatePickerDraftStart > ymdValue) reportDatePickerDraftStart = ymdValue;
      }
      renderReportDatePickerPanel();
    }


    function selectReportDatePreset(presetType, event) {
      if (event) event.stopPropagation();
      const now = new Date();
      if (presetType === 'today') {
        reportDatePickerDraftStart = reportDateToYmd(now);
        reportDatePickerDraftEnd = reportDatePickerDraftStart;
      } else if (presetType === 'month') {
        reportDatePickerDraftStart = reportDateToYmd(new Date(now.getFullYear(), now.getMonth(), 1));
        reportDatePickerDraftEnd = reportDateToYmd(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      } else {
        const defaults = getGdvReportDefaultDates();
        reportDatePickerDraftStart = defaults.startYmd;
        reportDatePickerDraftEnd = defaults.endYmd;
      }
      const parts = reportDatePickerDraftStart.split('-').map(Number);
      reportDatePickerViewMonth = new Date(parts[0], parts[1] - 1, 1);
      reportDatePickerFocus = 'start';
      renderReportDatePickerPanel();
    }


    function closeReportDatePicker(event) {
      if (event) event.stopPropagation();
      const panel = document.getElementById('customReportDatePickerPanel');
      if (panel) panel.style.display = 'none';
      activeOpenDropdownId = null;
      if (typeof syncTonReportDropdownState === 'function') syncTonReportDropdownState();
    }


    function confirmReportDatePicker(event) {
      if (event) event.stopPropagation();
      pendingGdvReportStartDate = reportDatePickerDraftStart;
      pendingGdvReportEndDate = reportDatePickerDraftEnd;
      const startValue = document.getElementById('reportStartDateValue');
      const endValue = document.getElementById('reportEndDateValue');
      if (startValue) startValue.textContent = formatReportDateDisplay(pendingGdvReportStartDate);
      if (endValue) endValue.textContent = formatReportDateDisplay(pendingGdvReportEndDate);
      closeReportDatePicker(event);
    }


    function changeGdvReportStartDate(val) {
      pendingGdvReportStartDate = val;
    }


    function changeGdvReportEndDate(val) {
      pendingGdvReportEndDate = val;
    }


    function applyGdvReportFilter() {
      if (pendingGdvReportStartDate) activeGdvReportStartDate = pendingGdvReportStartDate;
      if (pendingGdvReportEndDate) activeGdvReportEndDate = pendingGdvReportEndDate;
      triggerToast('Đã tải lại dữ liệu báo cáo!', 'success');
      renderGdvReportPage();
    }


    function setGdvReportPresetDateRange(presetType) {
      const defaults = getGdvReportDefaultDates();
      const now = new Date();

      if (presetType === 'week_sat_fri') {
        activeGdvReportStartDate = defaults.startYmd;
        activeGdvReportEndDate = defaults.endYmd;
      } else if (presetType === 'today') {
        const todayYmd = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        activeGdvReportStartDate = todayYmd;
        activeGdvReportEndDate = todayYmd;
      } else if (presetType === 'this_month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        activeGdvReportStartDate = startOfMonth.getFullYear() + '-' + String(startOfMonth.getMonth() + 1).padStart(2, '0') + '-01';
        activeGdvReportEndDate = endOfMonth.getFullYear() + '-' + String(endOfMonth.getMonth() + 1).padStart(2, '0') + '-' + String(endOfMonth.getDate()).padStart(2, '0');
      }
      renderGdvReportPage();
    }


    function parseYmdToLocalDate(ymdStr, isEnd) {
      if (!ymdStr || typeof ymdStr !== 'string') return null;
      const parts = ymdStr.split('-').map(Number);
      if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return null;
      const y = parts[0], m = parts[1] - 1, d = parts[2];
      if (isEnd) {
        return new Date(y, m, d, 23, 59, 59, 999);
      }
      return new Date(y, m, d, 0, 0, 0, 0);
    }


    function getWeeklyZoneReportPeriod() {
      const defaults = getGdvReportDefaultDates();
      const startYmd = activeGdvReportStartDate || defaults.startYmd;
      const endYmd = activeGdvReportEndDate || defaults.endYmd;

      const startDate = parseYmdToLocalDate(startYmd, false) || defaults.start;
      const endDate = parseYmdToLocalDate(endYmd, true) || defaults.end;

      const sDay = String(startDate.getDate()).padStart(2, '0');
      const sMo = String(startDate.getMonth() + 1).padStart(2, '0');
      const sYr = startDate.getFullYear();

      const eDay = String(endDate.getDate()).padStart(2, '0');
      const eMo = String(endDate.getMonth() + 1).padStart(2, '0');
      const eYr = endDate.getFullYear();

      const startStr = `${sDay}/${sMo}/${sYr}`;
      const endStr = `${eDay}/${eMo}/${eYr}`;

      return {
        startStr,
        endStr,
        startDate,
        endDate,
        label: `Từ ngày ${startStr} đến ${endStr}`
      };
    }


        function getClaimDateMs(c, fieldName) {
      if (!c || !fieldName || fieldName === 'none') return -1;
      let dateStr = c[fieldName];
      
      if (fieldName === 'toTrinhNgayDuyet' && !dateStr) {
        dateStr = getClaimToTrinhDuyetDate(c);
      }
      if (fieldName === 'ngayMoHs' && !dateStr) {
        dateStr = c.ngayMoHs || c['Ngày mở hồ sơ'] || c['Ngày mở HS'] || c.ngayTonThat || c.date;
      }
      if (fieldName === 'ngayNhanDuHoSo' && !dateStr) {
        dateStr = c.ngayNhanDuHoSo || c['Ngày nhận đủ hồ sơ'] || c['Ngày nhận đủ HS'];
      }
      if (fieldName === 'ngayThanhToan' && !dateStr) {
        dateStr = c.ngayThanhToan || c['Ngày thanh toán'] || c['Ngày thanh toán bồi thường'] || c.ngayKtXacNhan;
      }
      if (fieldName === 'ngayVTT' && !dateStr) {
        dateStr = c.ngayTonThat || c.date || c.ngayVTT;
      }
      
      if (typeof dateStr === 'number' && dateStr > 0) return dateStr;
      if (dateStr instanceof Date) return dateStr.getTime();
      
      if (dateStr && typeof dateStr === 'string' && dateStr !== '—' && dateStr !== '-' && dateStr !== 'null' && dateStr !== 'undefined') {
        const dp = parseDateParts(dateStr);
        if (dp && dp.year > 1970 && dp.month && dp.day) {
          return new Date(dp.year, dp.month - 1, dp.day, 12, 0, 0).getTime();
        }
      }
      return 0;
    }

    function getClaimTimestamp(c) {
      const dateStr = c.ngayMoHs;
      if (dateStr && typeof dateStr === 'string' && dateStr !== '—') {
        const dp = parseDateParts(dateStr);
        if (dp && dp.year && dp.month && dp.day) {
          return new Date(dp.year, dp.month - 1, dp.day, 12, 0, 0).getTime();
        }
      }
      return 0;
    }


    function getWeeklyZoneReportData() {
      const period = getWeeklyZoneReportPeriod();
      window._currentCarplaClaimsData = [];
      const claimsList = Object.entries(cachedPendingClaimsPayload || {}).map(([k,v]) => { v._id = k; return v; });
      const transfersList = Object.values(cachedAccountingTransfersPayload || {});

      const startTime = period.startDate.getTime();
      const endTime = period.endDate.getTime();
      const monthStartMs = new Date(period.endDate.getFullYear(), period.endDate.getMonth(), 1).getTime();
      const monthEndMs = new Date(period.endDate.getFullYear(), period.endDate.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

      const gdvMap = {};

      const rawUserEntries = Object.values(cachedUsersPayload || {});
      rawUserEntries.forEach(u => {
        const name = (u.profile?.displayName || u.displayName || u.name || '').trim();
        if (name && !gdvMap[name]) {
          gdvMap[name] = { gdvName: name, phatSinh: 0, daDuyetHsb: 0, chuaDuyetPasc: 0, tonHoaDon: 0, chuyenDntt: 0, carplaCount: 0, tndsTonLuyKe: 0, hsTonOver30Days: 0, hsDuPhongOver50M: 0, sumAmtUnder10M: 0, countUnder10M: 0, carplaCumulativeRevenue: 0 };
        }
      });

      claimsList.forEach(c => {
        const gdvName = (c.gdvTiepNhan || c.canBoXuLy || c.gdvHo || c.canBoBoiThuong || c.gdvName || c.createdByName || 'Chưa phân công').trim();
        if (!gdvMap[gdvName]) {
          gdvMap[gdvName] = { gdvName, phatSinh: 0, daDuyetHsb: 0, chuaDuyetPasc: 0, tonHoaDon: 0, chuyenDntt: 0, carplaCount: 0, tndsTonLuyKe: 0, hsTonOver30Days: 0, hsDuPhongOver50M: 0, sumAmtUnder10M: 0, countUnder10M: 0, carplaCumulativeRevenue: 0 };
        }

        const item = gdvMap[gdvName];
        
        const r = cachedReportRules;
        const phatSinhMs = getClaimDateMs(c, r.phatSinhDateField || 'ngayMoHs');
        const daDuyetMs = getClaimDateMs(c, r.daDuyetDateField || 'ngayMoHs');
        const chuyenDnttMs = getClaimDateMs(c, r.chuyenDnttDateField || 'ngayNhanDuHoSo');
        const carplaMs = getClaimDateMs(c, r.carplaDateField || 'toTrinhNgayDuyet');
        const tndsTonMs = getClaimDateMs(c, r.tndsTonDateField || 'none');
        const hsTonMs = getClaimDateMs(c, r.hsTonDateField || 'ngayMoHs');
        const hsDpbtMs = getClaimDateMs(c, r.hsDpbtDateField || 'none');
        const avgAmountMs = getClaimDateMs(c, r.avgAmountDateField || 'toTrinhNgayDuyet');

        const isPhatSinhPeriod = (phatSinhMs === -1) || (phatSinhMs >= startTime && phatSinhMs <= endTime);
        const isDaDuyetPeriod = (daDuyetMs === -1) || (daDuyetMs >= startTime && daDuyetMs <= endTime);
        const isChuyenDnttPeriod = (chuyenDnttMs === -1) || (chuyenDnttMs >= startTime && chuyenDnttMs <= endTime);
        const isCarplaPeriod = (carplaMs === -1) || (carplaMs >= startTime && carplaMs <= endTime);
        const isTndsTonPeriod = (tndsTonMs === -1) || (tndsTonMs >= startTime && tndsTonMs <= endTime);
        const isHsTonPeriod = (hsTonMs === -1) || (hsTonMs >= startTime && hsTonMs <= endTime);
        const isHsDpbtPeriod = (hsDpbtMs === -1) || (hsDpbtMs >= startTime && hsDpbtMs <= endTime);
        const isAvgAmountPeriod = (avgAmountMs === -1) || (avgAmountMs >= startTime && avgAmountMs <= endTime);
        const isCarplaMonthPeriod = (carplaMs === -1) || (carplaMs >= monthStartMs && carplaMs <= monthEndMs);

        const isApproved = isDuyetHsbtApproved(c);
        const amtStr = String(c.ttbtTongSoTienBoiThuong || '0').replace(/[^0-9]/g, '');
        const amtVal = parseInt(amtStr, 10) || 0;
        const garaName = String(c.tenGaraVietTat || '').toLowerCase();

        // 1. TNDS TỒN
        if (isTndsTonPeriod && isTndsClaim(c) && isUnpaidClaim(c)) {
          item.tndsTonLuyKe++;
        }

        // 2. HS TỒN > X NGÀY (KHÔNG LỌC THEO KỲ BÁO CÁO, CHỈ TÍNH TUỔI HỒ SƠ)
        const nowMs = Date.now();
        if (isOnlyDaDuyetHsbt(c) && hsTonMs > 0 && (nowMs - hsTonMs > r.hsTonDays * 86400 * 1000)) {
          item.hsTonOver30Days++;
        }

        // 2.5 HS DPBT > X TR
        if (isHsDpbtPeriod && isHsDuPhongOver50M(c)) {
          item.hsDuPhongOver50M++;
        }

        // 3. CHUYỂN ĐNTT
        if (isChuyenDnttPeriod && isChuyenDntt(c)) {
          item.chuyenDntt++;
        }

        // 4. CARPLA
        if (isCarplaPeriod && garaName.includes('carpla')) {
          item.carplaCount++;
        }
        
        // 4.5 CARPLA REVENUE
        if (isCarplaMonthPeriod && garaName.includes('carpla') && isApproved) {
          window._currentCarplaClaimsData.push(c);
          const excluded = r.carplaExcludedClaims && r.carplaExcludedClaims[c._id];
          if (!excluded) {
            item.carplaCumulativeRevenue += amtVal;
          }
        }

        // 5. PHÁT SINH
        if (isPhatSinhPeriod && isPhatSinh(c)) {
          item.phatSinh++;
        }

        // 6. ĐÃ DUYỆT HSBT
        if (isDaDuyetPeriod && isApproved) {
          item.daDuyetHsb++;
        }
        
        // 7. SỐ TIỀN BQ < X TR
        if (isAvgAmountPeriod && isApproved && amtVal > 0 && amtVal < r.avgAmount) {
          item.sumAmtUnder10M += amtVal;
          item.countUnder10M++;
        }
        
        // CHƯA DUYỆT PASC
        const claimTimeForPasc = getClaimTimestamp(c);
        if (claimTimeForPasc >= startTime && claimTimeForPasc <= endTime) {
          const stKeyCheck = String(c.trangThai || '').toLowerCase().trim();
          const chuaDuyetPascKeys = ['moi', 'cho_giam_dinh_ht', 'da_giam_dinh_ht', 'cho_gdct', 'da_gdct', 'cho_duyet_pasc'];
          const isChuaDuyetPascStatus = chuaDuyetPascKeys.includes(stKeyCheck) || 
            stKeyCheck === 'mới' || 
            stKeyCheck.includes('chờ giám định ht') || stKeyCheck.includes('cho giam dinh ht') ||
            stKeyCheck.includes('đã giám định ht') || stKeyCheck.includes('da giam dinh ht') ||
            stKeyCheck.includes('chờ gđct') || stKeyCheck.includes('cho gdct') ||
            stKeyCheck.includes('đã gđct') || stKeyCheck.includes('da gdct') ||
            stKeyCheck.includes('chờ duyệt pasc') || stKeyCheck.includes('cho duyet pasc');

          if (isChuaDuyetPascStatus) {
            item.chuaDuyetPasc++;
          }

          const st = String(c.trangThai || '').toLowerCase();
          if (st.includes('hoa_don') || st.includes('hóa đơn') || st.includes('invoice')) {
            item.tonHoaDon++;
          }
        }
      });

      let list = Object.values(gdvMap);
      if (activeSelectedGdvNames && activeSelectedGdvNames.length > 0) {
        list = list.filter(g => activeSelectedGdvNames.some(sel => sel.trim().toLowerCase() === g.gdvName.trim().toLowerCase()));
      }
      list = list.sort((a, b) => b.phatSinh - a.phatSinh);

      return { period, list };
    }


    async function downloadWeeklyZoneReportImage(format) {
      const cardEl = document.getElementById('weeklyZoneReportCardContainer');
      if (!cardEl) {
        triggerToast('Không tìm thấy khung báo cáo!', 'error');
        return;
      }
      if (typeof html2canvas === 'undefined') {
        triggerToast('Thư viện tạo ảnh đang tải, vui lòng thử lại sau 2 giây...', 'warning');
        return;
      }

      const imgFormat = format === 'jpg' || format === 'jpeg' ? 'jpeg' : 'png';
      const ext = imgFormat === 'jpeg' ? 'jpg' : 'png';

      triggerToast(`Đang xuất ảnh Báo cáo chất lượng cao Ultra HD (4K)...`, 'info');

      // Ẩn menu dropdown cột nếu đang mở trước khi chụp
      const ddMenu = document.getElementById('ddWeeklyColsMenu');
      if (ddMenu) ddMenu.style.display = 'none';

      const targetWidth = Math.max(cardEl.scrollWidth || 0, cardEl.offsetWidth || 0, 1);
      const preferredScale = Math.max(1.5, Math.min(2.8, 4096 / targetWidth));

      const createReportCanvas = (scaleValue) => html2canvas(cardEl, {
        scale: scaleValue,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        imageTimeout: 15000,
        removeContainer: true,
        windowWidth: Math.max(document.documentElement.clientWidth, targetWidth + 64),
        onclone: function(clonedDoc) {
          const target = clonedDoc.getElementById('weeklyZoneReportCardContainer');
          if (!target) return;

          target.style.boxShadow = 'none';
          target.style.transform = 'none';
          target.style.borderRadius = '18px';
          target.style.webkitFontSmoothing = 'antialiased';
          target.style.mozOsxFontSmoothing = 'grayscale';
          target.style.textRendering = 'geometricPrecision';
          target.style.background = '#ffffff';
          target.style.color = '#111827';

          // html2canvas 1.4.1 không hỗ trợ một số hàm màu CSS mới như color-mix().
          // Dùng bảng màu RGB an toàn trong bản clone dành riêng cho xuất ảnh.

          // Bố cục riêng cho ảnh: thang chữ và nhịp hàng đồng nhất, màu xuất ảnh an toàn cho html2canvas.
          const exportStyle = clonedDoc.createElement('style');
          exportStyle.textContent = `
            #weeklyZoneReportCardContainer,
            #weeklyZoneReportCardContainer * {
              animation: none !important;
              transition: none !important;
              backdrop-filter: none !important;
              -webkit-backdrop-filter: none !important;
            }
            #weeklyZoneReportCardContainer {
              min-height: 0 !important;
              display: block !important;
              padding: 24px 26px 26px !important;
              border: 1px solid #dfd3be !important;
              border-radius: 18px !important;
              background: linear-gradient(180deg, #faf8f3 0%, #ffffff 42%) !important;
              box-shadow: none !important;
              color: #27303a !important;
              font-family: 'Plus Jakarta Sans', 'Segoe UI', sans-serif !important;
            }
            #weeklyZoneReportCardContainer::before,
            #weeklyZoneReportCardContainer::after {
              content: none !important;
              display: none !important;
            }
            #weeklyZoneReportCardContainer .weekly-report-title-block {
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              justify-content: center !important;
              gap: 8px !important;
              margin: 0 0 16px !important;
              padding: 3px 0 17px !important;
              border-bottom: 1px solid #ddcfb5 !important;
              text-align: center !important;
            }
            #weeklyZoneReportCardContainer .weekly-report-header {
              display: block !important;
              padding: 0 !important;
              border: 0 !important;
            }
            #weeklyZoneReportCardContainer .weekly-report-title-block h2 {
              margin: 0 !important;
              padding: 0 !important;
              border: 0 !important;
              color: #202936 !important;
              font-size: 21px !important;
              font-weight: 800 !important;
              letter-spacing: -.025em !important;
              line-height: 1.25 !important;
            }
            #weeklyZoneReportCardContainer .weekly-report-period {
              align-self: center !important;
              margin: 0 !important;
              padding: 6px 13px !important;
              color: #775d35 !important;
              background: #f7f2e9 !important;
              border: 1px solid #e8dbc4 !important;
              border-radius: 999px !important;
              font-size: 11.5px !important;
              font-weight: 700 !important;
              line-height: 1.3 !important;
              white-space: nowrap !important;
            }
            #weeklyZoneReportCardContainer .weekly-report-period::before { display: none !important; }
            #weeklyZoneReportCardContainer > div[style*="overflow-x"] {
              overflow: visible !important;
              background: #ffffff !important;
              border: 1px solid #e2dfd9 !important;
              border-radius: 12px !important;
              box-shadow: none !important;
            }
            #weeklyZoneReportCardContainer table {
              width: 100% !important;
              border-collapse: separate !important;
              border-spacing: 0 !important;
              font-family: 'Plus Jakarta Sans', 'Segoe UI', sans-serif !important;
            }
            #weeklyZoneReportCardContainer thead tr { border: 0 !important; }
            #weeklyZoneReportCardContainer th {
              padding: 12px 10px !important;
              background: #f5f3ef !important;
              border: 0 !important;
              border-right: 1px solid #e9e6e0 !important;
              border-bottom: 1px solid #dedad2 !important;
              color: #5e6875 !important;
              font-size: 11.5px !important;
              font-weight: 800 !important;
              letter-spacing: .015em !important;
              line-height: 1.35 !important;
              vertical-align: middle !important;
            }
            #weeklyZoneReportCardContainer th:first-child { width: 48px !important; }
            #weeklyZoneReportCardContainer th:nth-child(2) { min-width: 190px !important; }
            #weeklyZoneReportCardContainer th:nth-child(3) { color: #1f6fd0 !important; border-bottom: 2px solid #6e9fd8 !important; }
            #weeklyZoneReportCardContainer th:nth-child(4) { color: #008f6d !important; border-bottom: 2px solid #5bbd98 !important; }
            #weeklyZoneReportCardContainer th:nth-child(5) { color: #b77a0b !important; border-bottom: 2px solid #cfa857 !important; }
            #weeklyZoneReportCardContainer th:nth-child(6) { color: #c3467c !important; border-bottom: 2px solid #ce83a7 !important; }
            #weeklyZoneReportCardContainer th:nth-child(7) { color: #008eaa !important; border-bottom: 2px solid #68bfce !important; }
            #weeklyZoneReportCardContainer th:nth-child(8) { color: #545bc1 !important; border-bottom: 2px solid #8d92d8 !important; }
            #weeklyZoneReportCardContainer th:nth-child(9) { color: #ce433b !important; border-bottom: 2px solid #d9857d !important; }
            #weeklyZoneReportCardContainer th:nth-child(10) { color: #c3467c !important; border-bottom: 2px solid #ce83a7 !important; }
            #weeklyZoneReportCardContainer th:nth-child(11) { color: #1f6fd0 !important; border-bottom: 2px solid #6e9fd8 !important; }
            #weeklyZoneReportCardContainer th:last-child {
              background: #f4ecdd !important;
              border-right: 0 !important;
              color: #8d5c14 !important;
            }
            #weeklyZoneReportCardContainer tbody tr,
            #weeklyZoneReportCardContainer tbody tr:nth-child(even) { background: #ffffff !important; border: 0 !important; }
            #weeklyZoneReportCardContainer tbody tr:nth-child(even) { background: #faf9f6 !important; }
            #weeklyZoneReportCardContainer td {
              padding: 12px 10px !important;
              border: 0 !important;
              border-right: 1px solid #eeece8 !important;
              border-bottom: 1px solid #eae7e1 !important;
              font-size: 13px !important;
              font-weight: 700 !important;
              line-height: 1.4 !important;
              vertical-align: middle !important;
            }
            #weeklyZoneReportCardContainer td:first-child { color: #a57b38 !important; }
            #weeklyZoneReportCardContainer td:nth-child(2) { color: #29313b !important; font-weight: 800 !important; }
            #weeklyZoneReportCardContainer tbody td:nth-child(3),
            #weeklyZoneReportCardContainer tfoot td:nth-child(3) { color: #1f6fd0 !important; }
            #weeklyZoneReportCardContainer tbody td:nth-child(4),
            #weeklyZoneReportCardContainer tfoot td:nth-child(4) { color: #008f6d !important; }
            #weeklyZoneReportCardContainer tbody td:nth-child(5),
            #weeklyZoneReportCardContainer tfoot td:nth-child(5) { color: #b77a0b !important; }
            #weeklyZoneReportCardContainer tbody td:nth-child(6),
            #weeklyZoneReportCardContainer tfoot td:nth-child(6) { color: #c3467c !important; }
            #weeklyZoneReportCardContainer tbody td:nth-child(7),
            #weeklyZoneReportCardContainer tfoot td:nth-child(7) { color: #008eaa !important; }
            #weeklyZoneReportCardContainer tbody td:nth-child(8),
            #weeklyZoneReportCardContainer tfoot td:nth-child(8) { color: #545bc1 !important; }
            #weeklyZoneReportCardContainer tbody td:nth-child(9),
            #weeklyZoneReportCardContainer tfoot td:nth-child(9) { color: #ce433b !important; }
            #weeklyZoneReportCardContainer tbody td:nth-child(10),
            #weeklyZoneReportCardContainer tfoot td:nth-child(10) { color: #c3467c !important; }
            #weeklyZoneReportCardContainer tbody td:nth-child(11),
            #weeklyZoneReportCardContainer tfoot td:nth-child(11) { color: #1f6fd0 !important; }
            #weeklyZoneReportCardContainer td:last-child {
              background: #f8f3e9 !important;
              border-right: 0 !important;
              color: #925c0b !important;
              font-weight: 800 !important;
            }
            #weeklyZoneReportCardContainer tfoot tr {
              background: #f0eee9 !important;
              border: 0 !important;
            }
            #weeklyZoneReportCardContainer tfoot td {
              padding-top: 13px !important;
              padding-bottom: 13px !important;
              background: #f3f1ec !important;
              border-top: 2px solid #c9a464 !important;
              border-bottom: 0 !important;
              font-size: 13px !important;
              font-weight: 800 !important;
            }
            #weeklyZoneReportCardContainer tfoot td:nth-child(2) { color: #29313b !important; }
            #weeklyZoneReportCardContainer tfoot td:last-child { background: #eee2ca !important; }
          `;
          // Match the page-level stylesheet specificity so image layout stays independent.
          exportStyle.textContent = exportStyle.textContent.replaceAll('#weeklyZoneReportCardContainer', '.gdv-report-premium-shell #weeklyZoneReportCardContainer');
          clonedDoc.head.appendChild(exportStyle);
        },
        ignoreElements: function(element) {
          return Boolean(element.classList && element.classList.contains('hide-on-screenshot'));
        }
      });

      const saveCanvas = (canvas) => new Promise((resolve, reject) => {
        if (!canvas || !canvas.width || !canvas.height) {
          reject(new Error('Canvas xuất ảnh không hợp lệ.'));
          return;
        }

        const fileName = `Bao_Cao_Tuan_Truong_Zone_${Date.now()}.${ext}`;
        const mimeType = `image/${imgFormat}`;

        const downloadUrl = (url, shouldRevoke) => {
          const link = document.createElement('a');
          link.download = fileName;
          link.href = url;
          document.body.appendChild(link);
          link.click();
          link.remove();
          if (shouldRevoke) setTimeout(() => URL.revokeObjectURL(url), 1200);
          resolve();
        };

        if (canvas.toBlob) {
          canvas.toBlob((blob) => {
            try {
              if (blob) {
                downloadUrl(URL.createObjectURL(blob), true);
              } else {
                downloadUrl(canvas.toDataURL(mimeType, 1.0), false);
              }
            } catch (error) {
              reject(error);
            }
          }, mimeType, 1.0);
        } else {
          try {
            downloadUrl(canvas.toDataURL(mimeType, 1.0), false);
          } catch (error) {
            reject(error);
          }
        }
      });

      try {
        let canvas;
        try {
          canvas = await createReportCanvas(preferredScale);
        } catch (highResolutionError) {
          console.warn('Xuất ảnh độ phân giải cao thất bại, đang thử chế độ tương thích:', highResolutionError);
          triggerToast('Đang chuyển sang chế độ xuất ảnh tương thích...', 'info');
          canvas = await createReportCanvas(1.5);
        }

        await saveCanvas(canvas);
        triggerToast('Đã tải ảnh báo cáo sắc nét thành công!', 'success');
      } catch (error) {
        console.error('Weekly report image export failed:', error);
        const errorMessage = String(error && error.message ? error.message : error || 'Không xác định').slice(0, 140);
        triggerToast(`Không thể xuất ảnh báo cáo: ${errorMessage}`, 'error');
      }
    }


    function downloadKpiChartImage(format) {
      const cardEl = document.getElementById('kpiChartCardContainer');
      if (!cardEl) {
        triggerToast('Không tìm thấy khung biểu đồ!', 'error');
        return;
      }
      if (typeof html2canvas === 'undefined') {
        triggerToast('Thư viện tạo ảnh đang tải, vui lòng thử lại sau 2 giây...', 'warning');
        return;
      }

      const imgFormat = format === 'jpg' || format === 'jpeg' ? 'jpeg' : 'png';
      const ext = imgFormat === 'jpeg' ? 'jpg' : 'png';

      triggerToast(`Đang xuất ảnh Biểu đồ KPI Ultra HD (4K)...`, 'info');

      html2canvas(cardEl, {
        scale: 3.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        onclone: function(clonedDoc) {
          const target = clonedDoc.getElementById('kpiChartCardContainer');
          if (target) {
            target.style.boxShadow = 'none';
            target.style.transform = 'none';
            target.style.backgroundColor = '#ffffff';
          }
        },
        ignoreElements: function(element) {
          return element.classList && element.classList.contains('hide-on-screenshot');
        }
      }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Bieu_Do_KPI_Luong_GDV_${Date.now()}.${ext}`;
        link.href = canvas.toDataURL(`image/${imgFormat}`, 1.0);
        link.click();
        triggerToast(`Đã tải ảnh biểu đồ sắc nét thành công!`, 'success');
      }).catch(err => {
        console.error(err);
        triggerToast('Có lỗi xảy ra khi xuất ảnh biểu đồ!', 'error');
      });
    }


    function downloadGarageChartImage(format) {
      const cardEl = document.getElementById('garageChartCardContainer');
      if (!cardEl) {
        triggerToast('Không tìm thấy khung biểu đồ bồi thường theo Gara!', 'error');
        return;
      }
      if (typeof html2canvas === 'undefined') {
        triggerToast('Thư viện tạo ảnh đang tải, vui lòng thử lại sau 2 giây...', 'warning');
        return;
      }

      const imgFormat = format === 'jpg' || format === 'jpeg' ? 'jpeg' : 'png';
      const ext = imgFormat === 'jpeg' ? 'jpg' : 'png';

      triggerToast(`Đang xuất ảnh Biểu đồ Gara Ultra HD (4K)...`, 'info');

      html2canvas(cardEl, {
        scale: 3.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        onclone: function(clonedDoc) {
          const target = clonedDoc.getElementById('garageChartCardContainer');
          if (target) {
            target.style.boxShadow = 'none';
            target.style.transform = 'none';
            target.style.backgroundColor = '#ffffff';
          }
        },
        ignoreElements: function(element) {
          return element.classList && element.classList.contains('hide-on-screenshot');
        }
      }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Bieu_Do_Boi_Thuong_Gara_${Date.now()}.${ext}`;
        link.href = canvas.toDataURL(`image/${imgFormat}`, 1.0);
        link.click();
        triggerToast(`Đã tải ảnh biểu đồ sắc nét thành công!`, 'success');
      }).catch(err => {
        console.error(err);
        triggerToast('Có lỗi xảy ra khi xuất ảnh biểu đồ!', 'error');
      });
    }


    function exportWeeklyZoneReportExcel() {
      if (!hasUserPermission('report', 'export')) {
        triggerToast('Bạn không có quyền xuất dữ liệu báo cáo.', 'warning');
        return;
      }
      if (!window.XLSX) {
        triggerToast('Thư viện XLSX chưa tải xong, vui lòng thử lại.', 'error');
        return;
      }

      const { period, list } = getWeeklyZoneReportData();
      const currentMonth = (period.startDate ? period.startDate.getMonth() + 1 : (new Date().getMonth() + 1));

      const aoa = [
        ['', '', '', '', (function() {
          if (period && period.startDate && period.endDate) {
            const sD = period.startDate.getDate();
            const sM = period.startDate.getMonth();
            const sY = period.startDate.getFullYear();
            const eD = period.endDate.getDate();
            const eM = period.endDate.getMonth();
            const eY = period.endDate.getFullYear();
            const lastDay = new Date(sY, sM + 1, 0).getDate();
            if (sM === eM && sY === eY && sD === 1 && eD === lastDay) {
              return 'BÁO CÁO THÁNG';
            }
          }
          return 'BÁO CÁO TUẦN / THÁNG';
        })(), '', '', '', '', '', '', ''],
        ['', '', '', period.label, '', '', '', '', '', '', '', ''],
        ['STT', 'GDV', 'PHÁT SINH', 'ĐÃ DUYỆT HSBT', 'CHƯA DUYỆT PASC', 'CHUYỂN ĐNTT', 'LƯỢNG XE CARPLA', 'HỒ SƠ TNDS TỒN LŨY KẾ', `HS TỒN > ${cachedReportRules.hsTonDays} NGÀY`, `HS DPBT > ${cachedReportRules.hsDpbtAmount/1000000}TR`, `SỐ TIỀN BÌNH QUÂN DƯỚI ${cachedReportRules.avgAmount/1000000}TR`, `DOANH SỐ CARPLA LŨY KẾ THÁNG ${currentMonth}`]
      ];

      let sumPhatSinh = 0, sumDaDuyet = 0, sumChuaDuyet = 0, sumTonHoaDon = 0, sumChuyenDntt = 0, sumCarpla = 0, sumTndsTon = 0;
      let sumHsTonOver30 = 0, sumHsDuPhongOver50M = 0, totalSumAmtUnder10M = 0, totalCountUnder10M = 0, sumCarplaCumulativeRev = 0;

      list.forEach((r, idx) => {
        const chuaDuyetVal = r.chuaDuyetPasc || Math.max(0, r.phatSinh - r.daDuyetHsb);
        const avgUnder10M = r.countUnder10M > 0 ? Math.round(r.sumAmtUnder10M / r.countUnder10M) : 0;

        sumPhatSinh += r.phatSinh;
        sumDaDuyet += r.daDuyetHsb;
        sumChuaDuyet += chuaDuyetVal;
        sumTonHoaDon += r.tonHoaDon;
        sumChuyenDntt += r.chuyenDntt;
        sumCarpla += r.carplaCount;
        sumTndsTon += r.tndsTonLuyKe;

        sumHsTonOver30 += r.hsTonOver30Days || 0;
        sumHsDuPhongOver50M += r.hsDuPhongOver50M || 0;
        totalSumAmtUnder10M += r.sumAmtUnder10M || 0;
        totalCountUnder10M += r.countUnder10M || 0;
        sumCarplaCumulativeRev += r.carplaCumulativeRevenue || 0;

        aoa.push([
          idx + 1,
          r.gdvName,
          r.phatSinh,
          r.daDuyetHsb,
          chuaDuyetVal,
          r.chuyenDntt || 0,
          r.carplaCount || 0,
          r.tndsTonLuyKe,
          r.hsTonOver30Days || 0,
          r.hsDuPhongOver50M || 0,
          avgUnder10M ? formatCurrencyInputNumber(avgUnder10M) + ' đ' : '0 đ',
          r.carplaCumulativeRevenue ? formatCurrencyInputNumber(r.carplaCumulativeRevenue) + ' đ' : '0 đ'
        ]);
      });

      const overallAvgUnder10M = totalCountUnder10M > 0 ? Math.round(totalSumAmtUnder10M / totalCountUnder10M) : 0;

      aoa.push([
        '',
        'Tổng Cộng',
        sumPhatSinh,
        sumDaDuyet,
        sumChuaDuyet,
        sumChuyenDntt,
        sumCarpla,
        sumTndsTon,
        sumHsTonOver30,
        sumHsDuPhongOver50M,
        overallAvgUnder10M ? formatCurrencyInputNumber(overallAvgUnder10M) + ' đ' : '0 đ',
        sumCarplaCumulativeRev ? formatCurrencyInputNumber(sumCarplaCumulativeRev) + ' đ' : '0 đ'
      ]);

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      ws['!cols'] = [
        { wch: 6 },
        { wch: 22 },
        { wch: 14 },
        { wch: 16 },
        { wch: 18 },
        { wch: 16 },
        { wch: 16 },
        { wch: 18 },
        { wch: 24 },
        { wch: 18 },
        { wch: 28 },
        { wch: 32 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'BaoCao_Tuan_Truong_Zone');
      const startClean = period.startStr.replace(/[^0-9]/g, '');
      const endClean = period.endStr.replace(/[^0-9]/g, '');
      const isFullM = (function() {
        if (period && period.startDate && period.endDate) {
          const sD = period.startDate.getDate();
          const sM = period.startDate.getMonth();
          const sY = period.startDate.getFullYear();
          const eD = period.endDate.getDate();
          const eM = period.endDate.getMonth();
          const eY = period.endDate.getFullYear();
          const lastDay = new Date(sY, sM + 1, 0).getDate();
          return sM === eM && sY === eY && sD === 1 && eD === lastDay;
        }
        return false;
      })();
      const filePrefix = isFullM ? 'Bao_Cao_Thang' : 'Bao_Cao_Tuan_Thang';
      XLSX.writeFile(wb, `${filePrefix}_${startClean}_${endClean}.xlsx`);
      triggerToast('Đã tải Báo cáo Tuần / Tháng (.xlsx) thành công!', 'success');
    }


    function exportGdvMonthlyReportExcel() {
      if (!hasUserPermission('report', 'export')) {
        triggerToast('Bạn không có quyền xuất dữ liệu báo cáo.', 'warning');
        return;
      }
      const claimsList = Object.values(cachedPendingClaimsPayload || {});
      const parsedClaims = [];

      for (let i = 0; i < claimsList.length; i++) {
        const c = claimsList[i];
        const dateStr = (c.ngayMoHs || c['Ngày mở hồ sơ'] || c['Ngày mở HS'] || c.ngayTonThat || c.date || '').trim();
        let yr = null;
        let mo = null;

        if (dateStr && dateStr !== '—' && dateStr !== '-') {
          const dp = parseDateParts(dateStr);
          if (dp && dp.year && dp.month) {
            yr = dp.year;
            mo = dp.month;
          }
        }
        if (!yr && c.createdAt) {
          const d = new Date(c.createdAt);
          if (!isNaN(d.getTime()) && d.getFullYear() > 1970) {
            yr = d.getFullYear();
            mo = d.getMonth() + 1;
          }
        }

        const duyetDateStr = getClaimToTrinhDuyetDate(c);
        let duyetYr = null;
        let duyetMo = null;
        if (duyetDateStr && duyetDateStr !== '—' && duyetDateStr !== '-') {
          const dpDuyet = parseDateParts(duyetDateStr);
          if (dpDuyet && dpDuyet.year && dpDuyet.month) {
            duyetYr = dpDuyet.year;
            duyetMo = dpDuyet.month;
          }
        }

        parsedClaims.push({ raw: c, year: yr, month: mo, duyetYear: duyetYr, duyetMonth: duyetMo });
      }

      const gdvMap = {};
      parsedClaims.forEach(item => {
        const c = item.raw;
        if (activeReportClaimType !== 'all') {
          const spText = String(c.tnds || c.vcx || c.maSpNghiepVu || c.loaiHinhBaoHiem || c.loaiHs || c.nghiepVu || '').toUpperCase();
          const loaiType = (c.tnds || spText.includes('TNDS')) ? 'TNDS' : 'VCX';
          if (activeReportClaimType !== loaiType) return;
        }

        if (activeGdvReportBranch !== 'all') {
          const b = c.donViCapDon || c.chiNhanh || c.chiNhanhXuly || '';
          if (b !== activeGdvReportBranch) return;
        }

        const gdvName = getClaimGdvName(c) || 'Chưa phân công';
        if (!gdvMap[gdvName]) {
          gdvMap[gdvName] = { gdvName, branch: c.donViCapDon || c.chiNhanh || '—', totalOpenedCount: 0, duyetHsbtCount: 0, pendingHsbtCount: 0, totalApprovedAmount: 0 };
        }

        const matchesOpenedYear = activeGdvReportYear === 'all' || item.year === parseInt(activeGdvReportYear, 10);
        const matchesOpenedMonth = activeGdvReportMonth === 'all' || item.month === parseInt(activeGdvReportMonth, 10);
        const isOpenedInPeriod = Boolean(item.year && matchesOpenedYear && matchesOpenedMonth);

        if (!isOpenedInPeriod) return;

        gdvMap[gdvName].totalOpenedCount++;

        if (isDuyetHsbtApproved(c)) {
          gdvMap[gdvName].duyetHsbtCount++;
          const amtStr = String(c.ttbtTongSoTienBoiThuong || c.tongBoiThuongSauThue || c.soTienDuyetBT || c.pascSoTienDuyet || c.ttbtSoTienBoiThuong || c.amount || '0').replace(/[^0-9]/g, '');
          gdvMap[gdvName].totalApprovedAmount += (parseInt(amtStr, 10) || 0);
        } else {
          gdvMap[gdvName].pendingHsbtCount++;
        }
      });

      const rows = Object.values(gdvMap).sort((a, b) => b.totalOpenedCount - a.totalOpenedCount);
      if (rows.length === 0) {
        triggerToast('Không có dữ liệu để xuất file Excel cho mốc thời gian này.', 'warning');
        return;
      }

      const excelData = rows.map((r, idx) => ({
        'STT': idx + 1,
        'Giám định viên / Cán bộ xử lý': r.gdvName,
        'Chi nhánh / Đơn vị': r.branch,
        'Số lượng HS tiếp nhận trong kỳ': r.totalOpenedCount,
        'Số lượng HS đã duyệt HSBT': r.duyetHsbtCount,
        'Số lượng HS chưa duyệt HSBT': r.pendingHsbtCount,
        'Tỷ lệ duyệt HSBT (%)': r.totalOpenedCount > 0 ? Math.round((r.duyetHsbtCount / r.totalOpenedCount) * 100) + '%' : '0%',
        'Tổng số tiền đã duyệt BT (VNĐ)': r.totalApprovedAmount
      }));

      if (window.XLSX) {
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'BaoCao_Duyet_HSBT_Theo_GDV');
        XLSX.writeFile(wb, `Bao_Cao_Duyet_HSBT_Theo_GDV_${activeGdvReportMonth === 'all' ? 'ToanBoThang' : activeGdvReportMonth}_${activeGdvReportYear}.xlsx`);
        triggerToast('Đã xuất file Excel thành công!', 'success');
      } else {
        triggerToast('Thư viện XLSX chưa tải xong, vui lòng thử lại.', 'error');
      }
    }
