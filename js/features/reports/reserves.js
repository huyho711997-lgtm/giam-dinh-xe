

    /* RENDER DAK LAK RESERVE REPORT TABLE HTML */
        /* HELPER FUNCTIONS FOR DAK LAK EXPECTED DATE FORMATS */
    function convertDmyToYmd(dmyStr) {
      if (!dmyStr) return '';
      const parts = dmyStr.split('/');
      if (parts.length === 3) {
        return parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
      }
      return dmyStr;
    }


    function formatYmdToDmy(ymdStr) {
      if (!ymdStr) return '';
      const parts = ymdStr.split('-');
      if (parts.length === 3) {
        return parts[2] + '/' + parts[1] + '/' + parts[0];
      }
      return ymdStr;
    }


    /* TOGGLE AND MANAGE DAK LAK STATUS SELECT DRD */
    function toggleDakLakStatusOption(statusKey, event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      const idx = activeSelectedDakLakStatuses.indexOf(statusKey);
      if (idx === -1) {
        activeSelectedDakLakStatuses.push(statusKey);
      } else {
        activeSelectedDakLakStatuses.splice(idx, 1);
      }
      renderGdvReportPage();
    }


    function selectAllDakLakStatusOptions(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      activeSelectedDakLakStatuses = Object.keys(PENDING_STATUS_MAP);
      renderGdvReportPage();
    }


    function clearAllDakLakStatusOptions(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      activeSelectedDakLakStatuses = [];
      renderGdvReportPage();
    }


    function selectReportClaimType(val) {
      activeReportClaimType = val;
      activeOpenDropdownId = null;
      renderGdvMonthlyReportPage();
    }


    function selectDakLakMinReserve(val) {
      activeDakLakMinReserve = parseInt(val, 10) || 100000000;
      document.querySelectorAll('.custom-select-menu').forEach(m => m.style.display = 'none');
      activeOpenDropdownId = null;
      renderGdvReportPage();
    }


    function applyCustomDakLakMinReserve() {
      const inputEl = document.getElementById('customDakLakMinReserveInput');
      if (inputEl) {
        const cleanVal = inputEl.value.replace(/\D/g, '');
        if (cleanVal) {
          activeDakLakMinReserve = parseInt(cleanVal, 10);
        } else {
          // Do nothing if empty
          return;
        }
      }
      document.querySelectorAll('.custom-select-menu').forEach(m => m.style.display = 'none');
      activeOpenDropdownId = null;
      renderGdvReportPage();
    }


    /* RENDER DAK LAK RESERVE REPORT TABLE HTML */
    function getCarBrandLossData() {
      const allClaims = Object.values(cachedPendingClaimsPayload || {});
      
      const brandMap = {};
      
      allClaims.forEach(c => {
        const stLower = String(c.trangThai || '').toLowerCase().trim();
        const validKeywords = [
          'da_duyet_pasc', 'đã duyệt pasc',
          'cho_duyet_hsbt', 'chờ duyệt hsbt',
          'da_duyet_hsbt', 'đã duyệt hsbt',
          'cho_duyet_dntt', 'chờ duyệt đntt',
          'cho_kt_duyet', 'chờ kt duyệt',
          'kt_duyet', 'kt duyệt',
          'da_thanh_toan', 'đã thanh toán'
        ];
        const isValid = validKeywords.some(kw => stLower.includes(kw));
        if (!isValid) return;

        let yr = null;
        let mo = null;
        const dateStr = c.toTrinhNgayDuyet || c.pascNgayDuyet || c.ngayDuyetHsbt || c.ngayMoHs;
        if (dateStr && dateStr !== '-') {
          const dp = parseDateParts(dateStr);
          if (dp) {
            yr = dp.year;
            mo = dp.month;
          }
        }

        if (activeCarBrandReportYears.length > 0 && !activeCarBrandReportYears.includes('all')) {
          if (yr === null || !activeCarBrandReportYears.includes(String(yr))) return;
        }
        
        if (activeCarBrandReportMonths.length > 0 && !activeCarBrandReportMonths.includes('all')) {
          if (mo === null || !activeCarBrandReportMonths.includes(String(mo))) return;
        }

        const rawHangXe = (c.hangXe || 'Chưa rõ').trim();
        const hangXe = rawHangXe === '-' ? 'Chưa rõ' : rawHangXe;
        
        const moneyRaw = c.ttbtTongSoTienBoiThuong || 0;
        const amtClean = parseInt(String(moneyRaw).replace(/[^0-9]/g, ''), 10) || 0;

        if (!brandMap[hangXe]) {
          brandMap[hangXe] = { count: 0, totalAmount: 0 };
        }
        brandMap[hangXe].count++;
        brandMap[hangXe].totalAmount += amtClean;
      });

      const list = Object.keys(brandMap).map(k => ({
        brand: k,
        count: brandMap[k].count,
        totalAmount: brandMap[k].totalAmount
      }));

      list.sort((a, b) => b.totalAmount - a.totalAmount);
      return list;
    }



    // ==========================================
    // GDV KPI CHART IMPLEMENTATION (CHART.JS)
    // Synchronized with 'BIỂU ĐỒ & BẢNG KÊ GARA'
    // ==========================================

    // =========================================================================
    // ULTRA HD 4K (300 DPI) CHART & CARD EXPORTER ENGINE
    // =========================================================================
    function exportUltraHDChartCard(cardId, canvasId, defaultTitle, defaultFileName) {
      const cardEl = document.getElementById(cardId);
      const canvas = document.getElementById(canvasId);

      if (!cardEl && !canvas) {
        if (typeof triggerToast === 'function') triggerToast('Không tìm thấy biểu đồ để tải!', 'error');
        return;
      }

      const isDark = document.body.classList.contains('dark-mode') || !document.body.classList.contains('light-mode');
      const bgColor = isDark ? '#0b0f19' : '#ffffff';

      if (typeof html2canvas !== 'undefined' && cardEl) {
        if (typeof triggerToast === 'function') triggerToast('Đang tạo ảnh Biểu đồ Ultra HD (4K / 300 DPI)...', 'info');
        
        html2canvas(cardEl, {
          scale: 3.5, // 3.5x scale renders crystal sharp 4K image (approx. 4000px width)
          useCORS: true,
          allowTaint: true,
          backgroundColor: bgColor,
          logging: false,
          scrollX: 0,
          scrollY: 0,
          onclone: function(clonedDoc) {
            const target = clonedDoc.getElementById(cardId);
            if (target) {
              target.style.boxShadow = 'none';
              target.style.transform = 'none';
              target.style.borderRadius = '0px';
              target.style.backgroundColor = bgColor;
            }
          },
          ignoreElements: function(el) {
            return el.classList && el.classList.contains('hide-on-screenshot');
          }
        }).then(highResCanvas => {
          const a = document.createElement('a');
          a.href = highResCanvas.toDataURL('image/png', 1.0);
          a.download = defaultFileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          if (typeof triggerToast === 'function') triggerToast('Đã tải ảnh biểu đồ Ultra HD sắc nét thành công!', 'success');
        }).catch(err => {
          console.warn('html2canvas error, using high-res canvas fallback:', err);
          fallbackDirectCanvasExport(canvas, defaultFileName, defaultTitle, bgColor);
        });
      } else if (canvas) {
        fallbackDirectCanvasExport(canvas, defaultFileName, defaultTitle, bgColor);
      }
    }


    function fallbackDirectCanvasExport(sourceCanvas, filename, titleText, bgColor) {
      if (!sourceCanvas) return;
      const scale = 3;
      const pad = 24 * scale;
      const headH = 52 * scale;

      const exp = document.createElement('canvas');
      exp.width = sourceCanvas.width * scale + pad * 2;
      exp.height = sourceCanvas.height * scale + headH + pad * 2;

      const ctx = exp.getContext('2d');
      ctx.fillStyle = bgColor || '#ffffff';
      ctx.fillRect(0, 0, exp.width, exp.height);

      ctx.fillStyle = bgColor === '#ffffff' ? '#0f172a' : '#f8fafc';
      ctx.font = 'bold ' + (15 * scale) + 'px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(titleText, pad, pad + 18 * scale);

      ctx.fillStyle = bgColor === '#ffffff' ? '#64748b' : '#94a3b8';
      ctx.font = (10.5 * scale) + 'px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Nền tảng Giám định số Tasco Insurtech · Xuất ngày: ' + new Date().toLocaleDateString('vi-VN'), pad, pad + 35 * scale);

      ctx.strokeStyle = bgColor === '#ffffff' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.moveTo(pad, pad + 44 * scale);
      ctx.lineTo(exp.width - pad, pad + 44 * scale);
      ctx.stroke();

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(sourceCanvas, pad, pad + headH, sourceCanvas.width * scale, sourceCanvas.height * scale);

      const a = document.createElement('a');
      a.href = exp.toDataURL('image/png', 1.0);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (typeof triggerToast === 'function') triggerToast('Đã tải ảnh biểu đồ sắc nét thành công!', 'success');
    }



    function renderCarBrandLossReportTableHtml() {
const fullList = getCarBrandLossData();
      let list = [];
      if (activeCarBrandChartTopN >= fullList.length) {
        list = fullList;
      } else {
        list = fullList.slice(0, activeCarBrandChartTopN);
        const rest = fullList.slice(activeCarBrandChartTopN);
        const restCount = rest.reduce((sum, item) => sum + item.count, 0);
        const restAmount = rest.reduce((sum, item) => sum + item.totalAmount, 0);
        if (restCount > 0) {
          list.push({ brand: 'Các hãng khác', count: restCount, totalAmount: restAmount, isOther: true });
        }
      }
      let grandTotalCount = 0;
      let grandTotalAmount = 0;

      const rowsHtml = list.map((item, idx) => {
        grandTotalCount += item.count;
        grandTotalAmount += item.totalAmount;
        return `
          <tr style="border-bottom: 1px solid var(--border); ${idx % 2 === 0 ? 'background: var(--surface);' : 'background: var(--bg-soft);'}">
            <td style="padding: 12px 14px; text-align: center; font-weight: 850; color: var(--text-soft);">${item.isOther ? '*' : idx + 1}</td>
            <td style="padding: 12px 14px; font-weight: 850; color: ${item.isOther ? 'var(--text-soft)' : 'var(--primary)'}; font-style: ${item.isOther ? 'italic' : 'normal'};">${escapeHtmlOutput(item.brand)}</td>
            <td style="padding: 12px 14px; text-align: right; font-weight: 800; color: var(--text-main);">${item.count}</td>
            <td style="padding: 12px 14px; text-align: right; font-weight: 850; color: #ef4444;">${formatCurrencyInputNumber(item.totalAmount)} đ</td>
          </tr>
        `;
      }).join('');

      return `
        <div class="rp-brand-report" style="background: var(--surface); border-radius: 18px; border: 1px solid var(--border-strong); padding: 24px; margin-top: 24px; box-shadow: var(--shadow-sm);">
          <div class="rp-brand-intro" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 16px;">
            <div>
              <h2 style="font-size: 18px; font-weight: 850; color: var(--primary); margin: 0; display: flex; align-items: center; gap: 10px; text-transform: uppercase; letter-spacing: 0.5px;">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
                TỔN THẤT THEO HÃNG XE
              </h2>
              <div style="color: var(--text-soft); font-size: 13.5px; margin-top: 6px;">
                Thống kê số lượng hồ sơ và tổng tiền bồi thường theo từng hãng xe
              </div>
            </div>

          </div>


          <!-- Chart controls and Canvas -->
          <div id="carBrandChartCardContainer" class="rp-chart-card" style="margin-bottom: 24px; background: var(--surface); padding: 22px 26px; border-radius: 20px; border: 1px solid var(--border-strong); box-shadow: var(--shadow-sm);">
            <div class="rp-chart-heading" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                <div style="font-size: 14px; font-weight: 800; color: var(--text-main); text-transform: uppercase;">Biểu đồ & Bảng kê Hãng xe</div>
                <select onchange="activeCarBrandChartTopN=Number(this.value); renderGdvMonthlyReportPage();" style="background: var(--surface); color: var(--text-main); border: 1px solid var(--border-strong); padding: 5px 10px; border-radius: 8px; font-weight: 750; font-size: 12px; outline: none; cursor: pointer; box-shadow: var(--shadow-xs);">
                  <option value="5" ${activeCarBrandChartTopN === 5 ? 'selected' : ''}>Top 5</option>
                  <option value="10" ${activeCarBrandChartTopN === 10 ? 'selected' : ''}>Top 10</option>
                  <option value="15" ${activeCarBrandChartTopN === 15 ? 'selected' : ''}>Top 15</option>
                  <option value="20" ${activeCarBrandChartTopN === 20 ? 'selected' : ''}>Top 20</option>
                  <option value="999" ${activeCarBrandChartTopN === 999 ? 'selected' : ''}>Tất cả</option>
                </select>
              </div>
              <div class="hide-on-screenshot rp-chart-actions" style="display: flex; gap: 8px;">
                <button type="button" onclick="downloadCarBrandChartImage()" title="Tải ảnh Biểu đồ Ultra HD (4K / 300 DPI)" style="padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border-strong); font-size: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s ease; background: var(--surface); color: var(--text-main); display: flex; align-items: center; gap: 6px;">
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Tải ảnh
                </button>
                <button type="button" onclick="activeCarBrandChartType='bar'; renderGdvMonthlyReportPage();" style="padding: 6px 12px; border-radius: 8px; border: none; font-size: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s ease; ${activeCarBrandChartType === 'bar' ? 'background: var(--primary); color: #111;' : 'background: rgba(216,180,109,0.15); color: var(--primary);'}">Biểu đồ Cột</button>
                <button type="button" onclick="activeCarBrandChartType='pie'; renderGdvMonthlyReportPage();" style="padding: 6px 12px; border-radius: 8px; border: none; font-size: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s ease; ${activeCarBrandChartType === 'pie' ? 'background: var(--primary); color: #111;' : 'background: rgba(216,180,109,0.15); color: var(--primary);'}">Biểu đồ Tròn</button>
              </div>
            </div>
            <div id="carBrandLossCanvasWrap" style="position: relative; height: 400px; width: 100%; transition: height 0.3s ease;">
              <canvas id="carBrandLossCanvas" role="img" aria-label="Biểu đồ tổn thất theo hãng xe"></canvas>
              <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" onload="if(window.initCarBrandChart) setTimeout(window.initCarBrandChart, 50); this.remove();" style="display:none;" />
            </div>
          </div>
          <div class="rp-table-scroll" style="overflow-x: auto; border-radius: 12px; border: 1px solid var(--border-strong);">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr style="background: var(--bg-soft); border-bottom: 2px solid var(--border-strong);">
                  <th style="padding: 14px; text-align: center; color: var(--text-soft); font-weight: 850; width: 60px;">STT</th>
                  <th style="padding: 14px; text-align: left; color: var(--text-main); font-weight: 850;">HÃNG XE</th>
                  <th style="padding: 14px; text-align: right; color: var(--text-main); font-weight: 850; width: 200px;">SỐ LƯỢNG HỒ SƠ</th>
                  <th style="padding: 14px; text-align: right; color: var(--text-main); font-weight: 850; width: 250px;">TỔNG TIỀN ĐÃ DUYỆT (VNĐ)</th>
                </tr>
              </thead>
              <tbody>
                ${list.length > 0 ? rowsHtml : `
                  <tr>
                    <td colspan="4" style="padding: 30px; text-align: center; color: var(--text-muted); font-size: 14px; font-weight: 750;">
                      Không có dữ liệu thống kê trong khoảng thời gian này
                    </td>
                  </tr>
                `}
              </tbody>
              ${list.length > 0 ? `
                <tfoot>
                  <tr style="background: rgba(239, 68, 68, 0.08); border-top: 2px solid var(--border-strong);">
                    <td colspan="2" style="padding: 16px 14px; text-align: right; font-weight: 850; color: #ef4444; font-size: 14px;">TỔNG CỘNG:</td>
                    <td style="padding: 16px 14px; text-align: right; font-weight: 850; color: #ef4444; font-size: 14px;">${grandTotalCount}</td>
                    <td style="padding: 16px 14px; text-align: right; font-weight: 850; color: #ef4444; font-size: 14px;">${formatCurrencyInputNumber(grandTotalAmount)} đ</td>
                  </tr>
                </tfoot>
              ` : ''}
            </table>
          </div>
        </div>
      `;
    }


    function exportCarBrandLossReportExcel() {
      if (!hasUserPermission('report', 'export')) {
        triggerToast('Bạn không có quyền xuất dữ liệu báo cáo.', 'warning');
        return;
      }
      try {
        const list = getCarBrandLossData();
        const aoa = [
          ['BÁO CÁO TỔN THẤT THEO HÃNG XE', '', '', ''],
          ['STT', 'HÃNG XE', 'SỐ LƯỢNG HỒ SƠ', 'TỔNG TIỀN ĐÃ DUYỆT (VNĐ)']
        ];
        
        let grandTotalCount = 0;
        let grandTotalAmount = 0;

        list.forEach((item, idx) => {
          grandTotalCount += item.count;
          grandTotalAmount += item.totalAmount;
          aoa.push([
            idx + 1,
            item.brand,
            item.count,
            item.totalAmount
          ]);
        });

        aoa.push([
          '',
          'TỔNG CỘNG',
          grandTotalCount,
          grandTotalAmount
        ]);

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        
        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } });

        ws['!cols'] = [
          { wch: 6 },
          { wch: 30 },
          { wch: 20 },
          { wch: 25 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Tổn thất Hãng Xe");
        
        const mStr = activeCarBrandReportMonths.includes('all') ? 'All' : activeCarBrandReportMonths.join('_');
        const yStr = activeCarBrandReportYears.includes('all') ? 'All' : activeCarBrandReportYears.join('_');
        XLSX.writeFile(wb, `Bao_Cao_Ton_That_Theo_Hang_Xe_T${mStr}_N${yStr}.xlsx`);
        
        triggerToast('Đã xuất file Excel thành công!', 'success');
      } catch (err) {
        console.error(err);
        triggerToast('Lỗi xuất file Excel: ' + err.message, 'error');
      }
    }


    function renderDakLakReserveReportTableHtml() {
      const claimsList = Object.values(cachedPendingClaimsPayload || {});
      const filtered = claimsList.filter(c => {
        const cleanReserveVal = parseInt(String(c.duPhongBoiThuong || '').replace(/\D/g, ''), 10) || 0;
        if (cleanReserveVal <= activeDakLakMinReserve) return false;

        const branch = String(c.donViCapDon || c.chiNhanh || c.chiNhanhXuly || '').trim().toLowerCase();
        const matchBranch = branch.includes('đắk lắk') || branch.includes('dak lak') || branch.includes('daklak');
        if (!matchBranch) return false;

        // Date monthly filter
        let yr = null;
        let mo = null;
        const dateStr = c.toTrinhNgayDuyet || c.pascNgayDuyet || c.ngayDuyetHsbt || c.ngayMoHs;
        if (dateStr && dateStr !== '—') {
          const dp = parseDateParts(dateStr);
          if (dp && dp.year && dp.month) {
            yr = dp.year;
            mo = dp.month;
          }
        }
        if (!yr) {
          const d = new Date(c.createdAt || Date.now());
          yr = d.getFullYear();
          mo = d.getMonth() + 1;
        }

        if (activeGdvReportYear !== 'all' && yr !== parseInt(activeGdvReportYear, 10)) return false;
        if (activeGdvReportMonth !== 'all' && mo !== parseInt(activeGdvReportMonth, 10)) return false;

        // GĐV filter
        const gdvName = (c.gdvTiepNhan || c.canBoXuLy || c.gdvHo || 'Chưa phân công').trim();
        const matchGdv = activeSelectedGdvNames.some(s => s.trim().toLowerCase() === gdvName.toLowerCase());
        if (!matchGdv) return false;

        // Status filter
        const claimStatus = c.trangThai || 'moi';
        const matchStatus = activeSelectedDakLakStatuses.includes(claimStatus);
        if (!matchStatus) return false;

        return true;
      });

      filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      const rowsHtml = filtered.map((c, idx) => {
        const bsx = c.bienSo || '—';
        const hsbt = c.soHoSoBoiThuong || '—';
        const gara = c.tenGaraVietTat || c.tenGara || c.garaSuaChua || '—';
        const gdv = c.gdvTiepNhan || c.canBoXuLy || c.gdvHo || '—';
        const reserve = formatCurrencyInputNumber(c.duPhongBoiThuong) || '—';
        const statusConfig = PENDING_STATUS_MAP[c.trangThai] || PENDING_STATUS_MAP['moi'];
        const statusLabel = statusConfig ? statusConfig.label : (c.trangThai || 'Mới');
        const statusColor = statusConfig ? statusConfig.color : '#3b82f6';
        
        const vuongMac = c.vuongMac || '';
        const ngayDuKien = c.ngayDuKien || '';

        return `
          <tr style="border-bottom: 1px solid var(--border); font-size: 13px;">
            <td style="padding: 12px 10px; text-align: center; font-weight: 700; color: var(--text-muted); width: 44px;">${idx + 1}</td>
            <td style="padding: 12px 10px; text-align: center;">
              <span style="display: inline-block; padding: 3px 8px; border-radius: 99px; font-size: 10px; font-weight: 850; background: rgba(59,130,246,0.06); color: ${statusColor}; border: 1px solid ${statusColor};">
                ${statusLabel}
              </span>
            </td>
            <td style="display: ${activeTonChuaHdReportCols.includes('BIEN_SO') ? 'table-cell' : 'none'}; padding: 12px 10px; font-weight: 800; color: var(--primary); font-size: 13px;">${escapeHtmlOutput(bsx)}</td>
            <td style="display: ${activeTonChuaHdReportCols.includes('SO_HSBT') ? 'table-cell' : 'none'}; padding: 12px 10px; font-weight: 700; color: var(--text-main); font-size: 12.5px; white-space: nowrap;">
              <div style="display: inline-flex; align-items: center; gap: 6px;">
                <span>${escapeHtmlOutput(hsbt)}</span>
                ${(c.soHoSoBoiThuong && c.soHoSoBoiThuong !== '—') ? `
                  <button type="button" onclick="copyHsbtToClipboard(this, '${escapeAttributeData(c.soHoSoBoiThuong)}', event)" title="Sao chép nhanh số HSBT" style="border: none; background: rgba(59,130,246,0.1); color: #3b82f6; padding: 0; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; height: 20px; width: 20px; flex-shrink: 0; transition: all 0.15s ease;" onmouseover="this.style.background='rgba(59,130,246,0.2)'; this.style.transform='scale(1.1)'" onmouseout="this.style.background='rgba(59,130,246,0.1)'; this.style.transform='scale(1)'">
                    <svg viewBox="0 0 24 24" width="10.5" height="10.5" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  </button>
                ` : ''}
              </div>
            </td>
            <td style="padding: 12px 10px; text-align: left; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeAttributeData(gara)}">${escapeHtmlOutput(gara)}</td>
            <td style="display: ${activeTonChuaHdReportCols.includes('CBXL') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: left;">${escapeHtmlOutput(gdv)}</td>
            <td style="padding: 12px 10px; font-weight: 850;  color: #10b981; text-align: right; font-size: 13.5px;">${reserve} đ</td>
            <td style="padding: 6px 8px; text-align: left; width: 250px;">
              <textarea 
                placeholder="Nhập vướng mắc..." 
                onchange="updateDakLakClaimField('${c.id}', 'vuongMac', this.value)"
                style="width: 100%; height: 38px; min-height: 38px; max-height: 100px; padding: 6px 8px; border-radius: 8px; background: var(--bg-soft); border: 1px solid var(--border-strong); color: var(--text-main); font-size: 12px; font-family: inherit; resize: vertical;"
              >${escapeHtmlOutput(vuongMac)}</textarea>
            </td>
            <td style="padding: 6px 8px; text-align: center; width: 150px;">
              <input 
                type="date" 
                value="${escapeAttributeData(convertDmyToYmd(ngayDuKien))}"
                onchange="updateDakLakClaimField('${c.id}', 'ngayDuKien', formatYmdToDmy(this.value))"
                style="width: 100%; height: 34px; padding: 4px 8px; border-radius: 8px; background: var(--bg-soft); border: 1px solid var(--border-strong); color: var(--text-main); font-size: 12px; text-align: center; font-family: inherit; cursor: pointer;"
              />
            </td>
          </tr>
        `;
      }).join('');

      const thresholdText = activeDakLakMinReserve === 50000000 ? '50.000.000' : activeDakLakMinReserve === 100000000 ? '100.000.000' : formatCurrencyInputNumber(activeDakLakMinReserve);
      const thresholdLabel = activeDakLakMinReserve === 50000000 ? '50 triệu' : activeDakLakMinReserve === 100000000 ? '100 triệu' : formatCurrencyInputNumber(activeDakLakMinReserve);

      return `
        <div class="p-card rp-data-card" id="dakLakReserveReportCardContainer" style="padding: 28px 32px; border-radius: 20px; box-shadow: var(--shadow-sm); border: 1px solid var(--border-strong); background: var(--surface); min-height: 420px; display: flex; flex-direction: column;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px dashed var(--border);">
            <div>
              <h2 style="font-size: 18px; font-weight: 850; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 8px;">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                Danh sách Hồ sơ Dự phòng bồi thường Đắk Lắk > ${thresholdText} VNĐ
              </h2>
              <p style="font-size: 12.5px; color: var(--text-soft); margin-top: 4px; margin-bottom: 0;">
                Tự động lọc HS Đắk Lắk có Dự phòng trên ${thresholdLabel} VNĐ. Nhập vướng mắc & ngày dự kiến trực tiếp vào bảng.
              </p>
            </div>
            <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
              <div class="hide-on-screenshot" style="background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); color: #10b981; padding: 6px 14px; border-radius: 10px; font-size: 12px; font-weight: 850; white-space: nowrap;">
                Tổng số: ${filtered.length} hồ sơ (Được lọc)
              </div>
              <button type="button" class="btn-premium hide-on-screenshot" onclick="downloadDakLakReserveReportImage()" style="padding: 0 14px; height: 32px; border-radius: 9px; background: linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(245,158,11,0.12) 100%); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; font-size: 12px; font-weight: 850; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: var(--shadow-xs); transition: all 0.2s ease; white-space: nowrap;" title="Tải ảnh báo cáo (PNG/JPG)">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                <span>Tải ảnh</span>
              </button>
              <button type="button" class="btn-premium hide-on-screenshot" onclick="exportDakLakReserveReportExcel()" style="padding: 0 14px; height: 32px; border-radius: 9px; background: linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(5,150,105,0.12) 100%); border: 1px solid rgba(16,185,129,0.3); color: #10b981; font-size: 12px; font-weight: 850; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: var(--shadow-xs); transition: all 0.2s ease;" title="Tải Excel báo cáo">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                <span>Tải Excel</span>
              </button>
            </div>
          </div>

          <div style="overflow-x: auto;">
            <table class="p-table" style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="background: var(--bg-soft); border-bottom: 1px solid var(--border-strong);">
                  <th style="padding: 12px 10px; width: 44px; text-align: center;">STT</th>
                  <th style="padding: 12px 10px; text-align: center; width: 110px;">Trạng thái</th>
                  <th style="padding: 12px 10px; width: 110px;">Biển số xe</th>
                  <th style="padding: 12px 10px; width: 140px;">Số HSBT</th>
                  <th style="padding: 12px 10px;">Gara sửa chữa (Viết tắt)</th>
                  <th style="padding: 12px 10px;">Giám định viên</th>
                  <th style="padding: 12px 10px; text-align: right; width: 150px;">Dự phòng BT</th>
                  <th style="padding: 12px 10px; width: 250px;">Vướng mắc / Khó khăn</th>
                  <th style="padding: 12px 10px; width: 150px; text-align: center;">Ngày dự kiến HT</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.length === 0 ? `
                  <tr><td colspan="10" class="empty-state-text" style="text-align: center; padding: 30px;">Không có hồ sơ nào thỏa mãn điều kiện lọc.</td></tr>
                ` : rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }


    async function updateDakLakClaimField(claimId, fieldKey, value) {
      if (!claimId) return;
      try {
        await dbNodeInstance.ref('pending_claims/' + claimId + '/' + fieldKey).set(value);
        if (cachedPendingClaimsPayload && cachedPendingClaimsPayload[claimId]) {
          cachedPendingClaimsPayload[claimId][fieldKey] = value;
        }
        triggerToast('Đã lưu dữ liệu tự động!', 'success');
      } catch (err) {
        console.error(err);
        triggerToast('Lỗi lưu dữ liệu: ' + err.message, 'error');
      }
    }


    function downloadDakLakReserveReportImage() {
      const cardEl = document.getElementById('dakLakReserveReportCardContainer');
      if (!cardEl) {
        triggerToast('Không tìm thấy khung báo cáo!', 'error');
        return;
      }
      if (typeof html2canvas === 'undefined') {
        triggerToast('Thư viện tạo ảnh đang tải, vui lòng thử lại sau 2 giây...', 'warning');
        return;
      }
      triggerToast(`Đang xuất ảnh Báo cáo Đắk Lắk Ultra HD (4K)...`, 'info');
      const exportWidth = Math.ceil(cardEl.offsetWidth);
      html2canvas(cardEl, {
        scale: Math.max(1, Math.min(3.5, 4096 / exportWidth)),
        width: exportWidth,
        windowWidth: Math.max(document.documentElement.clientWidth, exportWidth + 64),
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        onclone: function(clonedDoc) {
          const target = clonedDoc.getElementById('dakLakReserveReportCardContainer');
          if (target) {
            target.style.boxShadow = 'none';
            target.style.transform = 'none';
            target.style.backgroundColor = '#ffffff';
            if (typeof prepareRemainingReportImageClone === 'function') prepareRemainingReportImageClone(target, exportWidth);
          }
        },
        ignoreElements: function(element) {
          return element.classList && element.classList.contains('hide-on-screenshot');
        }
      }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Bao_Cao_Dak_Lak_Du_Phong_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
        triggerToast('Tải ảnh báo cáo sắc nét thành công!', 'success');
      }).catch(err => {
        console.error(err);
        triggerToast('Lỗi khi tạo ảnh!', 'error');
      });
    }


    function exportDakLakReserveReportExcel() {
      if (!hasUserPermission('report', 'export')) {
        triggerToast('Bạn không có quyền xuất dữ liệu báo cáo.', 'warning');
        return;
      }
      const claimsList = Object.values(cachedPendingClaimsPayload || {});
      const filtered = claimsList.filter(c => {
        const cleanReserveVal = parseInt(String(c.duPhongBoiThuong || '').replace(/\D/g, ''), 10) || 0;
        if (cleanReserveVal <= activeDakLakMinReserve) return false;

        const branch = String(c.donViCapDon || c.chiNhanh || c.chiNhanhXuly || '').trim().toLowerCase();
        const matchBranch = branch.includes('đắk lắk') || branch.includes('dak lak') || branch.includes('daklak');
        if (!matchBranch) return false;

        // Date monthly filter
        let yr = null;
        let mo = null;
        const dateStr = c.toTrinhNgayDuyet || c.pascNgayDuyet || c.ngayDuyetHsbt || c.ngayMoHs;
        if (dateStr && dateStr !== '—') {
          const dp = parseDateParts(dateStr);
          if (dp && dp.year && dp.month) {
            yr = dp.year;
            mo = dp.month;
          }
        }
        if (!yr) {
          const d = new Date(c.createdAt || Date.now());
          yr = d.getFullYear();
          mo = d.getMonth() + 1;
        }

        if (activeGdvReportYear !== 'all' && yr !== parseInt(activeGdvReportYear, 10)) return false;
        if (activeGdvReportMonth !== 'all' && mo !== parseInt(activeGdvReportMonth, 10)) return false;

        const gdvName = (c.gdvTiepNhan || c.canBoXuLy || c.gdvHo || 'Chưa phân công').trim();
        const matchGdv = activeSelectedGdvNames.some(s => s.trim().toLowerCase() === gdvName.toLowerCase());
        if (!matchGdv) return false;

        const claimStatus = c.trangThai || 'moi';
        const matchStatus = activeSelectedDakLakStatuses.includes(claimStatus);
        if (!matchStatus) return false;

        return true;
      });

      if (filtered.length === 0) {
        triggerToast('Không có hồ sơ nào để xuất Excel.', 'warning');
        return;
      }

      const excelData = filtered.map((c, idx) => {
        const statusConfig = PENDING_STATUS_MAP[c.trangThai] || PENDING_STATUS_MAP['moi'];
        return {
          'STT': idx + 1,
          'Biển số xe': c.bienSo || '',
          'Số HSBT': c.soHoSoBoiThuong || '',
          'Mã vụ tổn thất': c.maVuTonThat || '',
          'Đơn vị cấp đơn': c.donViCapDon || c.chiNhanh || '',
          'Gara sửa chữa': c.tenGaraVietTat || c.tenGara || c.garaSuaChua || '',
          'Giám định viên': c.gdvTiepNhan || c.canBoXuLy || c.gdvHo || '',
          'Dự phòng bồi thường (VNĐ)': parseInt(String(c.duPhongBoiThuong || '').replace(/\D/g, ''), 10) || 0,
          'Trạng thái': statusConfig ? statusConfig.label : (c.trangThai || 'Mới'),
          'Vướng mắc': c.vuongMac || '',
          'Ngày dự kiến hoàn thành': formatYmdToDmy(c.ngayDuKien) || c.ngayDuKien || ''
        };
      });

      if (window.XLSX) {
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        const millionTag = activeDakLakMinReserve === 50000000 ? '50M' : '100M';
        XLSX.utils.book_append_sheet(wb, ws, `BC_DakLak_Tren_${millionTag}`);
        XLSX.writeFile(wb, `Bao_Cao_Du_Phong_DakLak_Tren_${millionTag}_` + new Date().toLocaleDateString('vi-VN').replace(/\//g, '-') + '.xlsx');
        triggerToast('Đã xuất file Excel thành công!', 'success');
      } else {
        triggerToast('Thư viện XLSX chưa tải xong, vui lòng thử lại.', 'error');
      }
    }


    function triggerGdvMonthlyReportExcelExport(event) {
      if (event) event.stopPropagation();
      document.querySelectorAll('.custom-select-menu').forEach(m => m.style.display = 'none');
      activeOpenDropdownId = null;
      exportGdvMonthlyReportExcel();
    }


    function triggerWeeklyZoneReportExcelExport(event) {
      if (event) event.stopPropagation();
      document.querySelectorAll('.custom-select-menu').forEach(m => m.style.display = 'none');
      activeOpenDropdownId = null;
      exportWeeklyZoneReportExcel();
    }


    function triggerDakLakReserveReportExcelExport(event) {
      if (event) event.stopPropagation();
      document.querySelectorAll('.custom-select-menu').forEach(m => m.style.display = 'none');
      activeOpenDropdownId = null;
      exportDakLakReserveReportExcel();
    }


    function triggerTonChuaHoaDonReportExcelExport(event) {
      if (event) event.stopPropagation();
      document.querySelectorAll('.custom-select-menu').forEach(m => m.style.display = 'none');
      activeOpenDropdownId = null;
      exportTonChuaHoaDonReportExcel();
    }


    function getAvailableGaraNamesForOutstandingReport() {
      const claimsList = Object.values(cachedPendingClaimsPayload || {});
      const garas = new Set();
      claimsList.forEach(c => {
        if (c.trangThai === 'da_duyet_hsbt') {
          if (activeGdvReportDaysRange !== 'all') {
            const duyetDateStr = c.toTrinhNgayDuyet || c.pascNgayDuyet || c.ngayDuyetHsbt || '—';
            const daysCount = calculateDaysSinceApproved(duyetDateStr);
            if (typeof daysCount === 'number') {
              if (activeGdvReportDaysRange === 'over_30' && daysCount <= 30) return;
              if (activeGdvReportDaysRange === 'under_30' && daysCount > 30) return;
            } else {
              return;
            }
          }
          const gName = (c.tenGaraVietTat || c.garaSuaChua || c.gara || c.tenGara || 'Gara chưa xác định').trim();
          if (gName && gName !== '—') garas.add(gName);
        }
      });
      return Array.from(garas).sort();
    }


    function calculateDaysSinceApproved(approveDateStr) {
      if (!approveDateStr || approveDateStr === '—') return '—';
      const dp = parseDateParts(approveDateStr);
      if (!dp || !dp.year || !dp.month || !dp.day) return '—';
      const approveDate = new Date(dp.year, dp.month - 1, dp.day);
      const today = new Date();
      approveDate.setHours(0,0,0,0);
      today.setHours(0,0,0,0);
      const diffTime = today - approveDate;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 ? diffDays : 0;
    }


    function renderTonChuaHoaDonReportTableHtml(ignoreFilters = false) {
      const claimsList = Object.values(cachedPendingClaimsPayload || {});
      
      const filtered = claimsList.filter(c => {
        if (c.trangThai !== 'da_duyet_hsbt') return false;
        if (ignoreFilters) return true;

        let yr = null;
        let mo = null;
        const dateStr = c.toTrinhNgayDuyet || c.pascNgayDuyet || c.ngayDuyetHsbt || c.ngayMoHs;
        if (dateStr && dateStr !== '—') {
          const dp = parseDateParts(dateStr);
          if (dp && dp.year && dp.month) {
            yr = dp.year;
            mo = dp.month;
          }
        }
        if (!yr) {
          const d = new Date(c.createdAt || Date.now());
          yr = d.getFullYear();
          mo = d.getMonth() + 1;
        }

        if (activeGdvReportYear !== 'all' && yr !== parseInt(activeGdvReportYear, 10)) return false;
        if (activeGdvReportMonth !== 'all' && mo !== parseInt(activeGdvReportMonth, 10)) return false;

        const gdvName = (c.gdvTiepNhan || c.canBoXuLy || c.gdvHo || 'Chưa phân công').trim();
        const matchGdv = activeSelectedGdvNames.some(s => s.trim().toLowerCase() === gdvName.toLowerCase());
        if (!matchGdv) return false;

        if (activeGdvReportGara !== 'all') {
          const garaName = (c.tenGaraVietTat || c.garaSuaChua || c.gara || c.tenGara || 'Gara chưa xác định').trim();
          if (garaName !== activeGdvReportGara) return false;
        }

        if (activeGdvReportDaysRange !== 'all') {
          const duyetDateStr = c.toTrinhNgayDuyet || c.pascNgayDuyet || c.ngayDuyetHsbt || '—';
          const daysCount = calculateDaysSinceApproved(duyetDateStr);
          if (typeof daysCount === 'number') {
            if (activeGdvReportDaysRange === 'over_30' && daysCount <= 30) return false;
            if (activeGdvReportDaysRange === 'under_30' && daysCount > 30) return false;
          } else {
            return false;
          }
        }

        return true;
      });


        // Map Accounting Transfers
        const accTransfers = Object.values(cachedAccountingTransfersPayload || {});
        const hsbtToNgayXacNhanMap = {};
        accTransfers.forEach(t => {
          if (['da_xac_nhan', 'da_nhan_du_ho_so', 'da_trinh_dntt'].includes(t.trangThai)) {
            const confirmTime = t.ngayXetDuyet || t.ngayBanGiao; 
            const claimsList = t.danhSachHoSo || [];
            claimsList.forEach(cItem => {
               const hsbt = cItem.soHoSoBoiThuong || cItem.soHsbt;
               if (hsbt) {
                  if (!hsbtToNgayXacNhanMap[hsbt] || hsbtToNgayXacNhanMap[hsbt] < confirmTime) {
                     hsbtToNgayXacNhanMap[hsbt] = confirmTime;
                  }
               }
            });
          }
        });

      // Group claims by Gara
      const groups = {};
      filtered.forEach(c => {
        const garaName = (c.tenGaraVietTat || c.garaSuaChua || c.gara || c.tenGara || 'Gara chưa xác định').trim();
        if (!groups[garaName]) groups[garaName] = [];
        groups[garaName].push(c);
      });

      const totalApprovedAmount = filtered.reduce((total, claim) => {
        return total + (parseInt(String(claim.ttbtTongSoTienBoiThuong || '0').replace(/[^0-9]/g, ''), 10) || 0);
      }, 0);
      const overdueCount = filtered.filter(claim => {
        const days = calculateDaysSinceApproved(claim.toTrinhNgayDuyet || claim.pascNgayDuyet || claim.ngayDuyetHsbt || '');
        return typeof days === 'number' && days > 30;
      }).length;

      let globalIdx = 0;
      let rowsHtml = '';

      const sortedGaraNames = Object.keys(groups).sort();
      sortedGaraNames.forEach(garaName => {
        const claims = groups[garaName];
        
        // Calculate total amount for this Gara
        let totalGaraAmt = 0;
        claims.forEach(c => {
          const amtStr = String(c.ttbtTongSoTienBoiThuong || '0').replace(/[^0-9]/g, '');
          totalGaraAmt += parseInt(amtStr, 10) || 0;
        });

        // Sort claims within group by days since approved descending (oldest first)
        claims.sort((a, b) => {
          const dateAStr = a.toTrinhNgayDuyet || a.pascNgayDuyet || a.ngayDuyetHsbt || '';
          const dateBStr = b.toTrinhNgayDuyet || b.pascNgayDuyet || b.ngayDuyetHsbt || '';
          const daysA = calculateDaysSinceApproved(dateAStr);
          const daysB = calculateDaysSinceApproved(dateBStr);
          const valA = typeof daysA === 'number' ? daysA : 0;
          const valB = typeof daysB === 'number' ? daysB : 0;
          return valB - valA;
        });

        // Add Gara header row with SVG icon instead of emoji, and displaying total Gara amount
        rowsHtml += `
          <tr class="ton-gara-row" data-ton-gara-group="1" data-ton-gara="${escapeAttributeData(garaName)}" style="background: var(--bg-soft); font-weight: 850; border-bottom: 1px solid var(--border-strong);">
            <td colspan="${activeTonChuaHdReportCols.length + 1}" style="padding: 12px 14px; color: var(--primary); font-size: 13px; text-align: left; background: var(--bg-soft);">
              <div class="ton-gara-heading">
                <span class="ton-gara-icon"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m3 10 9-7 9 7v10H3z"/><path d="M7 20v-7h10v7M7 16h10"/></svg></span>
                <strong class="ton-gara-name">${escapeHtmlOutput(garaName)}</strong>
                <span class="ton-gara-count">${claims.length} hồ sơ</span>
                <span class="ton-gara-total">Tổng duyệt<strong>${formatCurrencyInputNumber(totalGaraAmt)} đ</strong></span>
              </div>
            </td>
          </tr>
        `;

        claims.forEach(c => {
          globalIdx++;
          const bsx = c.bienSo || '-';
          const hsbt = c.soHoSoBoiThuong || c.maVuTonThat || '-';
          const chuXe = extractClaimOwnerName(c) || '-';
          const hangXe = c.hangXe || '-';
          const hieuXe = c.hieuXe || '-';
          const carBrandModel = hieuXe !== '-' && hieuXe !== hangXe ? `${hangXe} / ${hieuXe}` : hangXe;
          const gdv = c.gdvTiepNhan || c.canBoXuLy || c.gdvHo || '-';
          
          const amtStr = String(c.ttbtTongSoTienBoiThuong || '0').replace(/[^0-9]/g, '');
          const amtVal = parseInt(amtStr, 10) || 0;
          const amtDisplay = amtVal > 0 ? formatCurrencyInputNumber(amtVal) + ' đ' : '-';
          
          const duyetDateStr = c.toTrinhNgayDuyet || c.pascNgayDuyet || c.ngayDuyetHsbt || '-';
          const daysCount = calculateDaysSinceApproved(duyetDateStr);
          
          let ngayChuyenKtStr = '-';
          if (hsbt !== '-' && hsbtToNgayXacNhanMap[hsbt]) {
             ngayChuyenKtStr = formatDateDisplay(hsbtToNgayXacNhanMap[hsbt]);
          }
          let ngayNhanDuHoSoStr = c.ngayNhanDuHoSo ? String(c.ngayNhanDuHoSo) : '-';

          let badgeStyle = 'background: rgba(16,185,129,0.1); color: #10b981; border: 1px solid rgba(16,185,129,0.25);';
          if (typeof daysCount === 'number') {
            if (daysCount > 30) {
              badgeStyle = 'background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.25); font-weight: 850; animation: pulseRed 2s infinite;';
            } else if (daysCount > 15) {
              badgeStyle = 'background: rgba(245,158,11,0.1); color: #f59e0b; border: 1px solid rgba(245,158,11,0.25); font-weight: 800;';
            }
          }

          rowsHtml += `
            <tr class="ton-claim-row" data-ton-gara="${escapeAttributeData(garaName)}" style="border-bottom: 1px solid var(--border); font-size: 13px;">
              <td style="padding: 12px 10px; text-align: center; font-weight: 700; color: var(--text-muted); width: 44px;">${globalIdx}</td>
              <td style="display: ${activeTonChuaHdReportCols.includes('SO_HSBT') ? 'table-cell' : 'none'}; padding: 12px 10px; font-weight: 700; color: var(--text-main); font-size: 12.5px; white-space: nowrap;">
                <div style="display: inline-flex; align-items: center; gap: 6px;">
                  <span>${escapeHtmlOutput(hsbt)}</span>
                  ${(c.soHoSoBoiThuong || c.soHsbt) ? `
                    <button type="button" onclick="copyHsbtToClipboard(this, '${escapeAttributeData(c.soHoSoBoiThuong || c.soHsbt)}', event)" title="Sao chép nhanh số HSBT" style="border: none; background: rgba(59,130,246,0.1); color: #3b82f6; padding: 0; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; height: 20px; width: 20px; flex-shrink: 0; transition: all 0.15s ease;" onmouseover="this.style.background='rgba(59,130,246,0.2)'; this.style.transform='scale(1.1)'" onmouseout="this.style.background='rgba(59,130,246,0.1)'; this.style.transform='scale(1)'">
                      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    </button>
                  ` : ''}
                </div>
              </td>
              <td class="ton-plate" style="display: ${activeTonChuaHdReportCols.includes('BIEN_SO') ? 'table-cell' : 'none'}; padding: 12px 10px; font-weight: 800;  color: var(--primary); font-size: 13px;">${escapeHtmlOutput(bsx)}</td>
              <td class="ton-owner" style="display: ${activeTonChuaHdReportCols.includes('CHU_XE') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: left; font-weight: 750;">${escapeHtmlOutput(chuXe)}</td>
              <td style="display: ${activeTonChuaHdReportCols.includes('HANG_XE') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: left;">${escapeHtmlOutput(carBrandModel)}</td>
              <td style="display: ${activeTonChuaHdReportCols.includes('CBXL') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: left;">${escapeHtmlOutput(gdv)}</td>
              <td class="ton-money" style="display: ${activeTonChuaHdReportCols.includes('TIEN_DUYET') ? 'table-cell' : 'none'}; padding: 12px 10px; font-weight: 850;  color: #10b981; text-align: right; font-size: 13.5px;">${amtDisplay}</td>
              <td style="display: ${activeTonChuaHdReportCols.includes('NGAY_NHAN_DU') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: center;  font-weight: 750;">${escapeHtmlOutput(ngayNhanDuHoSoStr)}</td>
              <td class="ton-accounting-date" style="display: ${activeTonChuaHdReportCols.includes('NGAY_CHUYEN_KT') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: center;  font-weight: 750; color: #8b5cf6;">${escapeHtmlOutput(ngayChuyenKtStr)}</td>
              <td class="ton-approval-date" style="display: ${activeTonChuaHdReportCols.includes('NGAY_DUYET') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: center;  font-weight: 750;">${escapeHtmlOutput(duyetDateStr)}</td>
              <td style="display: ${activeTonChuaHdReportCols.includes('SO_NGAY_DUYET') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: center;">
                <span class="acc-status-pill ton-age-pill ${typeof daysCount === 'number' && daysCount > 30 ? 'is-overdue' : typeof daysCount === 'number' && daysCount > 15 ? 'is-warning' : ''}" style="padding: 3px 10px; border-radius: 8px; font-size: 11px; ${badgeStyle}">
                  ${typeof daysCount === 'number' ? daysCount + ' ngày' : daysCount}
                </span>
              </td>
            </tr>
          `;
        });
      });

      return `
        <section class="ton-summary-strip hide-on-screenshot" aria-label="Tổng quan hồ sơ theo bộ lọc">
          <div class="ton-summary-stat">
            <span class="ton-summary-label">Hồ sơ chờ hóa đơn</span>
            <strong class="ton-summary-value">${filtered.length}<small>hồ sơ</small></strong>
            <span class="ton-summary-note">Đã phê duyệt phương án bồi thường</span>
          </div>
          <div class="ton-summary-stat ton-summary-stat--amount">
            <span class="ton-summary-label">Tổng giá trị đã duyệt</span>
            <strong class="ton-summary-value">${formatCurrencyInputNumber(totalApprovedAmount)}<small>₫</small></strong>
            <span class="ton-summary-note">Theo danh sách đang lọc</span>
          </div>
          <div class="ton-summary-stat">
            <span class="ton-summary-label">Gara liên quan</span>
            <strong class="ton-summary-value">${sortedGaraNames.length}<small>gara</small></strong>
            <span class="ton-summary-note">Có hồ sơ chờ bổ sung hóa đơn</span>
          </div>
          <div class="ton-summary-stat ton-summary-stat--overdue">
            <span class="ton-summary-label">Đã duyệt trên 30 ngày</span>
            <strong class="ton-summary-value">${overdueCount}<small>hồ sơ</small></strong>
            <span class="ton-summary-note">Cần ưu tiên theo dõi</span>
          </div>
        </section>
        <div class="p-card ton-report-card" id="tonChuaHoaDonReportCardContainer" style="padding: 28px 32px; border-radius: 20px; box-shadow: var(--shadow-sm); border: 1px solid var(--border-strong); background: var(--surface); position: relative; min-height: 420px; display: flex; flex-direction: column;">
          
          <div class="ton-report-header" style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px dashed var(--border);">
            <div class="ton-report-heading-row" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
              <div class="ton-report-title" style="flex: 1 1 520px; min-width: 260px;">
                <span class="ton-eyebrow">HỒ SƠ CHI TIẾT</span>
                <h2 style="font-size: 18px; font-weight: 850; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 8px;">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                  Hồ sơ chờ hóa đơn
                </h2>
                <p>Đã duyệt HSBT · Phân nhóm theo gara</p>
              </div>
            </div>

            <div class="ton-report-actions hide-on-screenshot" style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">

              <div class="custom-select-wrapper hide-on-screenshot" style="position: relative;">
                <button type="button" class="btn-premium btn-secondary" onclick="toggleCustomDropdownMenu('ddTonColsMenu', event)" style="padding: 0 14px; height: 38px; border-radius: 10px; background: var(--surface); border: 1px solid var(--border-strong); color: var(--text-main); font-size: 12px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; box-shadow: var(--shadow-xs); white-space: nowrap;">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                  <span>Cột hiển thị</span>
                </button>
                <div id="ddTonColsMenu" class="custom-select-menu" style="display: ${activeOpenDropdownId === 'ddTonColsMenu' ? 'block' : 'none'}; position: absolute; top: calc(100% + 6px); right: 0; min-width: 200px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 14px; box-shadow: 0 16px 36px rgba(0,0,0,0.3); z-index: 999; padding: 10px; text-align: left; -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px);">
                  <div style="display:flex; justify-content:space-between; align-items:center; padding: 0 4px 8px 4px; border-bottom: 1px solid var(--border); margin-bottom: 8px;">
                  <span style="font-size: 11.5px; font-weight: 850; color: var(--text-soft);">TÙY CHỌN HIỂN THỊ CỘT</span>
                  <div style="display:flex; gap:6px;">
                    <button type="button" onclick="setAllTonChuaHdReportCols(true)" style="border:none; background:rgba(16,185,129,0.12); color:#10b981; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px; cursor:pointer;">Hiện tất cả</button>
                    <button type="button" onclick="setAllTonChuaHdReportCols(false)" style="border:none; background:rgba(239,68,68,0.12); color:#ef4444; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px; cursor:pointer;">Ẩn tất cả</button>
                  </div>
                </div>
                  ${[
                    { id: 'SO_HSBT', label: 'Số HSBT' },
                    { id: 'BIEN_SO', label: 'Biển số xe' },
                    { id: 'CHU_XE', label: 'Chủ xe / Khách hàng' },
                    { id: 'HANG_XE', label: 'Hãng / Hiệu xe' },
                    { id: 'CBXL', label: 'Cán bộ xử lý (CBXL)' },
                    { id: 'TIEN_DUYET', label: 'Tiền duyệt HSBT' },
                    { id: 'NGAY_NHAN_DU', label: 'Ngày nhận đủ hồ sơ' },
                    { id: 'NGAY_CHUYEN_KT', label: 'Ngày chuyển HSKT' },
                    { id: 'NGAY_DUYET', label: 'Ngày duyệt HSBT' },
                    { id: 'SO_NGAY_DUYET', label: 'Số ngày đã duyệt' }
                  ].map(col => `
                    <label style="display: flex; align-items: center; gap: 8px; padding: 6px 4px; cursor: pointer;">
                      <input type="checkbox" ${activeTonChuaHdReportCols.includes(col.id) ? 'checked' : ''} onclick="toggleTonChuaHdReportCol('${col.id}', event)" style="accent-color: var(--primary); width: 14px; height: 14px;">
                      <span style="font-size: 13px; font-weight: 700; color: var(--text-main);">${col.label}</span>
                    </label>
                  `).join('')}
                </div>
              </div>
              <div class="custom-select-wrapper hide-on-screenshot" style="position: relative; margin-left: auto;">
                <button type="button" class="btn-premium" onclick="toggleCustomDropdownMenu('ddTonImageExportMenu', event)" aria-haspopup="menu" aria-expanded="${activeOpenDropdownId === 'ddTonImageExportMenu' ? 'true' : 'false'}" aria-controls="ddTonImageExportMenu" style="padding: 0 15px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: 1px solid #059669; color: #ffffff; font-size: 12px; font-weight: 850; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(16,185,129,0.2); white-space: nowrap;">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  <span>Xuất ảnh</span>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                <div id="ddTonImageExportMenu" class="custom-select-menu" role="menu" style="display: ${activeOpenDropdownId === 'ddTonImageExportMenu' ? 'block' : 'none'}; position: absolute; top: calc(100% + 7px); right: 0; min-width: 290px; padding: 7px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 13px; box-shadow: 0 14px 32px rgba(15,23,42,0.18); z-index: 1000;">
                  <button type="button" class="custom-select-item ton-export-option" role="menuitem" onclick="closeAllCustomDropdowns(); downloadTonChuaHoaDonReportImage('png')" style="padding: 10px 11px; border-radius: 9px; cursor: pointer; display: flex; align-items: flex-start; gap: 10px;">
                    <svg class="ton-export-icon" aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#ef4444" stroke-width="2" style="flex-shrink: 0; margin-top: 2px;"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    <span class="ton-export-copy">
                      <strong style="font-size: 12.5px; color: var(--text-main);">Ảnh theo bộ lọc hiện tại</strong>
                      <small style="font-size: 11px; color: var(--text-soft);">Xuất kết quả đang hiển thị</small>
                    </span>
                  </button>
                  <div style="height: 1px; margin: 4px 2px; background: var(--border);"></div>
                  <button type="button" class="custom-select-item ton-export-option" role="menuitem" onclick="closeAllCustomDropdowns(); downloadAllTonChuaHoaDonReportImages()" style="padding: 10px 11px; border-radius: 9px; cursor: pointer; display: flex; align-items: flex-start; gap: 10px;">
                    <svg class="ton-export-icon" aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#059669" stroke-width="2.2" style="flex-shrink: 0; margin-top: 2px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    <span class="ton-export-copy">
                      <strong style="font-size: 12.5px; color: var(--text-main);">Ảnh toàn bộ gara</strong>
                      <small style="font-size: 11px; color: var(--text-soft);">Bỏ qua bộ lọc · Tải ZIP ảnh PNG</small>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="table-container" style="margin-top: 10px;">
            <table class="p-table ton-report-table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: var(--bg-soft); border-bottom: 1px solid var(--border);">
                  <th scope="col" style="padding: 12px 10px; text-align: center; width: 50px;">STT</th>
                  <th scope="col" style="display: ${activeTonChuaHdReportCols.includes('SO_HSBT') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: left; width: 220px;">Số HSBT</th>
                  <th scope="col" style="display: ${activeTonChuaHdReportCols.includes('BIEN_SO') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: left; width: 130px;">Biển số xe</th>
                  <th scope="col" style="display: ${activeTonChuaHdReportCols.includes('CHU_XE') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: left;">Chủ xe / Khách hàng</th>
                  <th scope="col" style="display: ${activeTonChuaHdReportCols.includes('HANG_XE') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: left; width: 180px;">Hãng / Hiệu xe</th>
                  <th scope="col" style="display: ${activeTonChuaHdReportCols.includes('CBXL') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: left; width: 180px;">Cán bộ xử lý (CBXL)</th>
                  <th scope="col" style="display: ${activeTonChuaHdReportCols.includes('TIEN_DUYET') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: right; width: 160px;">Tiền duyệt HSBT</th>
                  <th scope="col" style="display: ${activeTonChuaHdReportCols.includes('NGAY_NHAN_DU') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: center; width: 140px;">Ngày nhận đủ hồ sơ</th>
                  <th scope="col" style="display: ${activeTonChuaHdReportCols.includes('NGAY_CHUYEN_KT') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: center; width: 140px;">Ngày chuyển HSKT</th>
                  
                  
                  <th scope="col" style="display: ${activeTonChuaHdReportCols.includes('NGAY_DUYET') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: center; width: 140px;">Ngày duyệt HSBT</th>
                  <th scope="col" style="display: ${activeTonChuaHdReportCols.includes('SO_NGAY_DUYET') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: center; width: 140px;">Số ngày đã duyệt</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || `<tr><td colspan="${activeTonChuaHdReportCols.length + 1}" style="padding: 42px; text-align: center; color: var(--text-soft);"><div class="ton-report-empty"><strong>Chưa có hồ sơ phù hợp</strong><span>Điều chỉnh bộ lọc để xem các hồ sơ chờ hóa đơn.</span></div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }


    function exportTonChuaHoaDonReportExcel() {
      if (!hasUserPermission('report', 'export')) {
        triggerToast('Bạn không có quyền xuất dữ liệu báo cáo.', 'warning');
        return;
      }
      const claimsList = Object.values(cachedPendingClaimsPayload || {});
      const filtered = claimsList.filter(c => {
        if (c.trangThai !== 'da_duyet_hsbt') return false;

        let yr = null;
        let mo = null;
        const dateStr = c.toTrinhNgayDuyet || c.pascNgayDuyet || c.ngayDuyetHsbt || c.ngayMoHs;
        if (dateStr && dateStr !== '—') {
          const dp = parseDateParts(dateStr);
          if (dp && dp.year && dp.month) {
            yr = dp.year;
            mo = dp.month;
          }
        }
        if (!yr) {
          const d = new Date(c.createdAt || Date.now());
          yr = d.getFullYear();
          mo = d.getMonth() + 1;
        }

        if (activeGdvReportYear !== 'all' && yr !== parseInt(activeGdvReportYear, 10)) return false;
        if (activeGdvReportMonth !== 'all' && mo !== parseInt(activeGdvReportMonth, 10)) return false;

        const gdvName = (c.gdvTiepNhan || c.canBoXuLy || c.gdvHo || 'Chưa phân công').trim();
        const matchGdv = activeSelectedGdvNames.some(s => s.trim().toLowerCase() === gdvName.toLowerCase());
        if (!matchGdv) return false;

        if (activeGdvReportGara !== 'all') {
          const garaName = (c.tenGaraVietTat || c.garaSuaChua || c.gara || c.tenGara || 'Gara chưa xác định').trim();
          if (garaName !== activeGdvReportGara) return false;
        }

        if (activeGdvReportDaysRange !== 'all') {
          const duyetDateStr = c.toTrinhNgayDuyet || c.pascNgayDuyet || c.ngayDuyetHsbt || '—';
          const daysCount = calculateDaysSinceApproved(duyetDateStr);
          if (typeof daysCount === 'number') {
            if (activeGdvReportDaysRange === 'over_30' && daysCount <= 30) return false;
            if (activeGdvReportDaysRange === 'under_30' && daysCount > 30) return false;
          } else {
            return false;
          }
        }

        return true;
      });

      if (filtered.length === 0) {
        triggerToast('Không có hồ sơ nào để xuất Excel.', 'warning');
        return;
      }

      // Group claims by Gara
      const groups = {};
      filtered.forEach(c => {
        const garaName = (c.tenGaraVietTat || c.garaSuaChua || c.gara || c.tenGara || 'Gara chưa xác định').trim();
        if (!groups[garaName]) groups[garaName] = [];
        groups[garaName].push(c);
      });

      // Construct AOA
      const aoa = [
        ['STT', 'Số HSBT', 'Biển số xe', 'Tên chủ xe / Khách hàng', 'Hãng xe', 'Hiệu xe', 'Cán bộ xử lý (CBXL)', 'Tiền duyệt HSBT (VNĐ)', 'Ngày duyệt HSBT', 'Số ngày đã duyệt']
      ];
      
      const merges = [];
      let globalIdx = 0;
      
      const sortedGaraNames = Object.keys(groups).sort();
      sortedGaraNames.forEach(garaName => {
        const claims = groups[garaName];
        
        // Calculate total amount for this Gara
        let totalGaraAmt = 0;
        claims.forEach(c => {
          const amtStr = String(c.ttbtTongSoTienBoiThuong || '0').replace(/[^0-9]/g, '');
          totalGaraAmt += parseInt(amtStr, 10) || 0;
        });

        // Sort claims within group by days since approved descending
        claims.sort((a, b) => {
          const dateAStr = a.toTrinhNgayDuyet || a.pascNgayDuyet || a.ngayDuyetHsbt || '';
          const dateBStr = b.toTrinhNgayDuyet || b.pascNgayDuyet || b.ngayDuyetHsbt || '';
          const daysA = calculateDaysSinceApproved(dateAStr);
          const daysB = calculateDaysSinceApproved(dateBStr);
          const valA = typeof daysA === 'number' ? daysA : 0;
          const valB = typeof daysB === 'number' ? daysB : 0;
          return valB - valA;
        });

        // Push Gara group header row with Gara total amount (no emoji in Excel)
        const groupRowIdx = aoa.length;
        aoa.push([`Gara: ${garaName} (${claims.length} hồ sơ tồn - Tổng tiền duyệt: ${formatCurrencyInputNumber(totalGaraAmt)} đ)`, '', '', '', '', '', '', '', '', '']);
        merges.push({ s: { r: groupRowIdx, c: 0 }, e: { r: groupRowIdx, c: 9 } });

        claims.forEach(c => {
          globalIdx++;
          const amtStr = String(c.ttbtTongSoTienBoiThuong || '0').replace(/[^0-9]/g, '');
          const amtVal = parseInt(amtStr, 10) || 0;
          const duyetDateStr = c.toTrinhNgayDuyet || c.pascNgayDuyet || c.ngayDuyetHsbt || '—';
          const daysCount = calculateDaysSinceApproved(duyetDateStr);
          const chuXe = extractClaimOwnerName(c) || '—';
          const hangXe = c.hangXe || '—';
          const hieuXe = c.hieuXe || '—';

          aoa.push([
            globalIdx,
            c.soHoSoBoiThuong || c.maVuTonThat || '',
            (c.bienSo || '').toUpperCase(),
            chuXe,
            hangXe,
            hieuXe,
            c.gdvTiepNhan || c.canBoXuLy || c.gdvHo || '',
            amtVal,
            duyetDateStr,
            typeof daysCount === 'number' ? daysCount : 0
          ]);
        });
      });

      if (window.XLSX) {
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!merges'] = merges;
        
        const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
        
        // Header Row Styling (Row 1)
        cols.forEach(col => {
          const cellKey = col + '1';
          if (ws[cellKey]) {
            ws[cellKey].s = {
              font: { name: 'Arial', sz: 11, bold: true },
              fill: { fgColor: { rgb: 'E2E8F0' } },
              alignment: { horizontal: 'center', vertical: 'center' },
              border: {
                top: { style: 'thin', color: { rgb: '475569' } },
                bottom: { style: 'thin', color: { rgb: '475569' } },
                left: { style: 'thin', color: { rgb: '475569' } },
                right: { style: 'thin', color: { rgb: '475569' } }
              }
            };
          }
        });

        // Style Data Rows (Row 2 onwards)
        for (let i = 0; i < aoa.length - 1; i++) {
          const rowNum = 2 + i;
          const isGroupRow = String(aoa[rowNum - 1][0]).startsWith('Gara:');
          
          cols.forEach(col => {
            const cellKey = col + rowNum;
            if (ws[cellKey]) {
              if (isGroupRow) {
                // Style group row - remove left/right borders for inner cells to render clean merge
                ws[cellKey].s = {
                  font: { name: 'Arial', sz: 10.5, bold: true, color: { rgb: '1E293B' } },
                  fill: { fgColor: { rgb: 'F1F5F9' } },
                  alignment: { horizontal: 'left', vertical: 'center' },
                  border: {
                    top: { style: 'thin', color: { rgb: 'CBD5E1' } },
                    bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
                    left: col === 'A' ? { style: 'thin', color: { rgb: 'CBD5E1' } } : undefined,
                    right: col === 'J' ? { style: 'thin', color: { rgb: 'CBD5E1' } } : undefined
                  }
                };
              } else {
                // Style normal claim row
                let align = { horizontal: 'left', vertical: 'center' };
                if (['A', 'C', 'G', 'I', 'J'].includes(col)) {
                  align.horizontal = 'center';
                } else if (col === 'H') {
                  align.horizontal = 'right';
                }

                let fontStyle = { name: 'Arial', sz: 10 };
                if (col === 'C') {
                  fontStyle.bold = true;
                }

                let fillStyle = null;
                const days = aoa[rowNum - 1][9];
                if (col === 'J' && typeof days === 'number') {
                  if (days > 30) {
                    fillStyle = { fgColor: { rgb: 'FEE2E2' } };
                    fontStyle.color = { rgb: 'EF4444' };
                    fontStyle.bold = true;
                  } else if (days > 15) {
                    fillStyle = { fgColor: { rgb: 'FEF3C7' } };
                    fontStyle.color = { rgb: 'F59E0B' };
                    fontStyle.bold = true;
                  }
                }

                ws[cellKey].s = {
                  font: fontStyle,
                  alignment: align,
                  border: {
                    top: { style: 'thin', color: { rgb: 'E2E8F0' } },
                    bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
                    left: { style: 'thin', color: { rgb: 'E2E8F0' } },
                    right: { style: 'thin', color: { rgb: 'E2E8F0' } }
                  }
                };
                if (fillStyle) {
                  ws[cellKey].s.fill = fillStyle;
                }
              }
            }
          });
        }

        ws['!rows'] = [{ hpt: 26 }];
        for (let i = 0; i < aoa.length - 1; i++) {
          const isGroupRow = String(aoa[i + 1][0]).startsWith('Gara:');
          ws['!rows'].push({ hpt: isGroupRow ? 24 : 20 });
        }

        ws['!cols'] = [
          { wch: 6 },
          { wch: 22 },
          { wch: 14 },
          { wch: 28 },
          { wch: 16 },
          { wch: 16 },
          { wch: 24 },
          { wch: 24 },
          { wch: 20 },
          { wch: 20 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'BC_Ton_Chua_Hoa_Don');
        XLSX.writeFile(wb, 'Bao_Cao_Ho_So_Ton_Chua_Hoa_Don_' + new Date().toLocaleDateString('vi-VN').replace(/\//g, '-') + '.xlsx');
        triggerToast('Đã xuất file Excel thành công!', 'success');
      } else {
        triggerToast('Thư viện XLSX chưa tải xong, vui lòng thử lại.', 'error');
      }
    }


    function triggerTonChuaHoaDonReportExcelExport(event) {
      if (event) event.stopPropagation();
      document.querySelectorAll('.custom-select-menu').forEach(m => m.style.display = 'none');
      activeOpenDropdownId = null;
      exportTonChuaHoaDonReportExcel();
    }


    function getTonChuaHoaDonGaraNames(cardEl) {
      if (!cardEl) return [];
      return Array.from(cardEl.querySelectorAll('tr[data-ton-gara-group="1"]'))
        .map(row => row.getAttribute('data-ton-gara') || '')
        .filter(Boolean);
    }


    function prepareTonChuaHoaDonImageCard(clonedDoc, target = clonedDoc.getElementById('tonChuaHoaDonReportCardContainer')) {
      if (!target) return null;
      target.classList.add('ton-report-export');
      target.style.boxShadow = 'none';
      target.style.transform = 'none';
      const table = target.querySelector('.ton-report-table');
      const tableContainer = target.querySelector('.table-container');
      if (table && tableContainer) {
        target.style.setProperty('width', Math.max(1400, table.scrollWidth) + 'px', 'important');
        tableContainer.style.setProperty('overflow', 'visible', 'important');
      }
      return target;
    }


    function sanitizeTonChuaHoaDonFileName(value) {
      return String(value || 'Gara')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80) || 'Gara';
    }


    function canvasToBlob(canvas, imgFormat) {
      return new Promise((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Không tạo được ảnh.')), `image/${imgFormat}`, 1.0);
      });
    }


    let tonChuaHoaDonImageExportInProgress = false;

    // Measure one export-only table, then capture bounded batches. Each PNG reuses
    // the report/table header and crops just its own garage, without re-rendering
    // the whole application for every file. Large garages continue on another PNG.
    async function createTonChuaHoaDonImageCapture(cardEl) {
      const host = document.createElement('div');
      const card = cardEl.cloneNode(true);
      const width = Math.ceil(Math.max(1400, cardEl.getBoundingClientRect().width || 1600, cardEl.querySelector('table')?.scrollWidth || 0));
      host.style.cssText = `position:fixed;left:0;top:0;width:${width}px;z-index:-1;pointer-events:none;background:#fff;`;
      host.setAttribute('aria-hidden', 'true');
      card.id = 'tonChuaHoaDonExportCapture';
      card.querySelectorAll('.hide-on-screenshot').forEach(element => element.remove());
      host.appendChild(card);
      document.body.appendChild(host);
      try {
        prepareTonChuaHoaDonImageCard(document, card);
        card.style.setProperty('width', width + 'px', 'important');
        if (document.fonts) await document.fonts.ready;
        const table = card.querySelector('.ton-report-table');
        const body = table.tBodies[0];
        // Keep column widths stable when a batch contains shorter names/values.
        const widths = Array.from(table.tHead.rows[0].cells, cell => cell.getBoundingClientRect().width);
        table.style.tableLayout = 'fixed';
        Array.from(table.tHead.rows[0].cells).forEach((cell, i) => {
          if (widths[i]) cell.style.setProperty('width', widths[i] + 'px', 'important');
        });
        const top = card.getBoundingClientRect().top;
        const headerHeight = table.tHead.getBoundingClientRect().bottom - top;
        const footerHeight = card.getBoundingClientRect().bottom - body.getBoundingClientRect().bottom;
        // At 2x, keep each working canvas below 16 MP and 16,384 px per edge.
        const maxHeight = Math.floor(Math.min(8192, 16000000 / (width * 4)));
        const rowBudget = Math.max(100, maxHeight - headerHeight - footerHeight - 8);
        const groups = [];
        let group;
        Array.from(body.rows).forEach(row => {
          if (row.getAttribute('data-ton-gara-group') === '1') {
            group = { name: row.getAttribute('data-ton-gara'), heading: row, rows: [] };
            groups.push(group);
          } else if (group) group.rows.push(row);
        });
        const pages = [];
        groups.forEach((gara, index) => {
          const headingHeight = gara.heading.getBoundingClientRect().height;
          const segments = [];
          let rows = [], height = headingHeight;
          gara.rows.forEach(row => {
            const rowHeight = row.getBoundingClientRect().height;
            if (rows.length && height + rowHeight > rowBudget) {
              segments.push({ rows, height });
              rows = []; height = headingHeight;
            }
            rows.push(row); height += rowHeight;
          });
          if (rows.length) segments.push({ rows, height });
          segments.forEach((segment, page) => pages.push({ ...segment, name: gara.name, index, page, pageCount: segments.length, heading: gara.heading.cloneNode(true) }));
        });
        body.replaceChildren();
        return { host, card, body, pages, rowBudget };
      } catch (err) {
        host.remove();
        throw err;
      }
    }

    async function downloadTonChuaHoaDonReportImagesByGara(cardEl, imgFormat, ext) {
      if (tonChuaHoaDonImageExportInProgress) return;
      if (typeof JSZip === 'undefined' || typeof html2canvas === 'undefined') {
        triggerToast('Thư viện tạo ảnh/ZIP chưa tải xong, vui lòng thử lại.', 'warning');
        return;
      }
      const garaNames = getTonChuaHoaDonGaraNames(cardEl);
      if (!garaNames.length) {
        triggerToast('Không có gara nào để xuất ảnh.', 'warning');
        return;
      }
      tonChuaHoaDonImageExportInProgress = true;
      const dateTag = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-');
      const zip = new JSZip();
      const folder = zip.folder(`Anh_Bao_Cao_Ton_Chua_HD_${dateTag}`) || zip;
      const failed = [];
      let exported = 0, capture;
      const progress = (title, detail, percent) => {
        if (typeof toggleUploadOverlay === 'function') toggleUploadOverlay(true, title, detail, percent);
      };
      try {
        progress('Đang chuẩn bị ảnh báo cáo', `${garaNames.length} gara...`, 0);
        capture = await createTonChuaHoaDonImageCapture(cardEl);
        const { host, card, body, pages, rowBudget } = capture;
        for (let offset = 0; offset < pages.length;) {
          const batch = [];
          let height = 0;
          while (offset < pages.length && (!batch.length || height + pages[offset].height <= rowBudget)) {
            const page = pages[offset++];
            batch.push(page); height += page.height;
          }
          const fragment = document.createDocumentFragment();
          batch.forEach(page => fragment.append(page.heading, ...page.rows));
          body.replaceChildren(fragment);
          const rect = card.getBoundingClientRect();
          const headerEnd = card.querySelector('thead').getBoundingClientRect().bottom - rect.top;
          const footerStart = body.getBoundingClientRect().bottom - rect.top;
          const slices = batch.map(page => ({ page, top: page.heading.getBoundingClientRect().top - rect.top, bottom: page.rows[page.rows.length - 1].getBoundingClientRect().bottom - rect.top }));
          progress('Đang dựng ảnh báo cáo', `Đang xử lý ${batch.length} phần ảnh · ${exported}/${pages.length} đã xong`, Math.round(exported / pages.length * 90));
          let canvas;
          try {
            const scale = Math.min(2, 16384 / Math.max(rect.width, rect.height), Math.sqrt(16000000 / (rect.width * rect.height)));
            canvas = await html2canvas(card, {
              scale, backgroundColor: '#ffffff', logging: false, useCORS: true, scrollX: 0, scrollY: 0,
              // Exclude the rest of the app from the cloned document, but keep its styles.
              ignoreElements: element => !document.head.contains(element) && !element.contains(host) && !host.contains(element)
            });
            const ratio = canvas.height / rect.height;
            const headerPixels = Math.round(headerEnd * ratio);
            const footerPixels = canvas.height - Math.round(footerStart * ratio);
            for (const slice of slices) {
              const image = document.createElement('canvas');
              try {
                const y = Math.round(slice.top * ratio), bottom = Math.round(slice.bottom * ratio);
                image.width = canvas.width;
                image.height = headerPixels + bottom - y + footerPixels;
                const ctx = image.getContext('2d');
                if (!ctx) throw new Error('Không tạo được khung ảnh.');
                ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, image.width, image.height);
                ctx.drawImage(canvas, 0, 0, canvas.width, headerPixels, 0, 0, image.width, headerPixels);
                ctx.drawImage(canvas, 0, y, canvas.width, bottom - y, 0, headerPixels, image.width, bottom - y);
                if (footerPixels > 0) ctx.drawImage(canvas, 0, canvas.height - footerPixels, canvas.width, footerPixels, 0, image.height - footerPixels, image.width, footerPixels);
                const page = slice.page;
                const suffix = page.pageCount > 1 ? `_Trang_${String(page.page + 1).padStart(2, '0')}` : '';
                folder.file(`${String(page.index + 1).padStart(2, '0')}_${sanitizeTonChuaHoaDonFileName(page.name)}${suffix}.${ext}`, await canvasToBlob(image, imgFormat));
                exported++;
                progress('Đang xuất ảnh theo gara', `${page.name} · ${exported}/${pages.length} ảnh`, Math.round(exported / pages.length * 90));
              } catch (err) {
                console.error('Lỗi tách ảnh gara:', slice.page.name, err);
                failed.push(slice.page.name);
              } finally {
                image.width = image.height = 0;
              }
            }
          } catch (err) {
            console.error('Lỗi dựng nhóm ảnh gara:', err);
            failed.push(...batch.map(page => page.name));
          } finally {
            if (canvas) canvas.width = canvas.height = 0;
            body.replaceChildren();
          }
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        if (!exported) throw new Error('Không xuất được ảnh gara nào. Vui lòng thử lại.');
        progress('Đang đóng gói ZIP', `Đã xuất ${exported} ảnh...`, 95);
        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Anh_Bao_Cao_Ton_Chua_HD_Theo_Gara_${dateTag}.zip`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 15000);
        triggerToast(failed.length ? `Đã xuất ${exported} ảnh, ${new Set(failed).size} gara có phần ảnh lỗi.` : `Đã xuất ${exported} ảnh báo cáo theo gara!`, failed.length ? 'warning' : 'success');
      } catch (err) {
        console.error('Lỗi xuất ảnh theo gara:', err);
        triggerToast(err.message || 'Có lỗi khi xuất ảnh toàn bộ gara.', 'error');
      } finally {
        capture?.host.remove();
        tonChuaHoaDonImageExportInProgress = false;
        if (typeof toggleUploadOverlay === 'function') toggleUploadOverlay(false);
      }
    }

    async function downloadAllTonChuaHoaDonReportImages() {
      if (tonChuaHoaDonImageExportInProgress) return;
      if (!document.getElementById('tonChuaHoaDonReportCardContainer')) {
        triggerToast('Không tìm thấy khung báo cáo!', 'error');
        return;
      }
      // Build the complete data set off-screen without changing the live card ID,
      // selected filters, or table rows while the export is running.
      try {
        const template = document.createElement('div');
        template.innerHTML = renderTonChuaHoaDonReportTableHtml(true);
        const fullListCard = template.querySelector('#tonChuaHoaDonReportCardContainer');
        if (fullListCard) await downloadTonChuaHoaDonReportImagesByGara(fullListCard, 'png', 'png');
        else triggerToast('Không dựng được danh sách đầy đủ để xuất ảnh.', 'error');
      } catch (err) {
        console.error('Lỗi chuẩn bị ảnh toàn bộ gara:', err);
        triggerToast('Có lỗi khi chuẩn bị danh sách ảnh toàn bộ gara.', 'error');
      }
    }


    function downloadTonChuaHoaDonReportImage(format) {
      const cardEl = document.getElementById('tonChuaHoaDonReportCardContainer');
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

      if (activeGdvReportGara === 'all') {
        downloadTonChuaHoaDonReportImagesByGara(cardEl, imgFormat, ext);
        return;
      }

      triggerToast(`Đang xuất ảnh Báo cáo Tồn Ultra HD (4K)...`, 'info');

      html2canvas(cardEl, {
        scale: 3.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        onclone: function(clonedDoc) {
          prepareTonChuaHoaDonImageCard(clonedDoc);
        },
        ignoreElements: function(element) {
          return element.classList && element.classList.contains('hide-on-screenshot');
        }
      }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Bao_Cao_Ho_So_Ton_Chua_Hoa_Don_${Date.now()}.${ext}`;
        link.href = canvas.toDataURL(`image/${imgFormat}`, 1.0);
        link.click();
        triggerToast('Đã tải ảnh báo cáo sắc nét thành công!', 'success');
      }).catch(err => {
        console.error(err);
        triggerToast('Có lỗi xảy ra khi xuất ảnh báo cáo!', 'error');
      });
    }


    /****************************************************
     * BÁO CÁO HỒ SƠ TNDS TỒN & QUẢN LÝ GHI CHÚ
     ****************************************************/
    function formatTndsTimestampDisplay(val) {
      if (!val) return '—';
      if (typeof val === 'number') {
        const d = new Date(val);
        if (isNaN(d.getTime())) return '—';
        const day = String(d.getDate()).padStart(2, '0');
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const yr = d.getFullYear();
        const hr = String(d.getHours()).padStart(2, '0');
        const mn = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${mo}/${yr} ${hr}:${mn}`;
      }
      return formatDateDisplay(val);
    }


    async function updateTndsClaimNote(claimId, noteValue) {
      if (!claimId) return;
      const cleanVal = (noteValue || '').trim();
      const existing = cachedPendingClaimsPayload && cachedPendingClaimsPayload[claimId];
      const oldVal = String(existing?.tndsGhiChu || '').trim();

      // If no change, do not update timestamp or fire database write
      if (cleanVal === oldVal) {
        return;
      }

      const now = Date.now();
      const currentUser = firebase.auth().currentUser;
      const userName = String(activeUserProfile?.fullName || activeUserProfile?.displayName || currentUser?.displayName || currentUser?.email || 'Người dùng');

      try {
        const updates = {};
        updates['pending_claims/' + claimId + '/tndsGhiChu'] = cleanVal;
        updates['pending_claims/' + claimId + '/tndsLastUpdated'] = now;
        updates['pending_claims/' + claimId + '/tndsUpdatedBy'] = userName;

        await dbNodeInstance.ref().update(updates);

        if (cachedPendingClaimsPayload && cachedPendingClaimsPayload[claimId]) {
          cachedPendingClaimsPayload[claimId].tndsGhiChu = cleanVal;
          cachedPendingClaimsPayload[claimId].tndsLastUpdated = now;
          cachedPendingClaimsPayload[claimId].tndsUpdatedBy = userName;
        }

        renderGdvReportPage();
        triggerToast('Đã lưu ghi chú TNDS thành công!', 'success');
      } catch (err) {
        console.error(err);
        triggerToast('Lỗi khi lưu ghi chú: ' + err.message, 'error');
      }
    }


    function changeTndsReportSearch(txt) {
      activeTndsReportSearch = (txt || '').trim();
      renderGdvReportPage();
    }


    function setTndsNoteFilter(filterVal) {
      activeTndsNoteFilter = filterVal;
      renderGdvReportPage();
    }


    function setTndsStatusFilter(statusVal) {
      activeTndsStatusFilter = statusVal;
      renderGdvReportPage();
    }


    function getFilteredTndsTonClaims() {
      const claimsList = Object.entries(cachedPendingClaimsPayload || {}).map(([k, v]) => {
        return { ...v, id: k, _claimKey: k };
      });

      return claimsList.filter(c => {
        // Must be TNDS and unpaid
        if (!isTndsClaim(c) || !isUnpaidClaim(c)) return false;

        // Chi nhánh filter
        if (activeGdvReportBranch !== 'all') {
          const b = String(c.donViCapDon || c.chiNhanh || c.chiNhanhXuly || '').toLowerCase();
          if (!b.includes(activeGdvReportBranch.toLowerCase())) return false;
        }

        // GĐV filter
        if (activeSelectedGdvNames && activeSelectedGdvNames.length > 0) {
          const gdv = String(c.gdvTiepNhan || c.canBoXuLy || c.gdvHo || 'Chưa phân công').trim().toLowerCase();
          const matchGdv = activeSelectedGdvNames.some(s => s.trim().toLowerCase() === gdv);
          if (!matchGdv) return false;
        }

        // Ghi chú filter (chỉ dùng tndsGhiChu của Báo cáo TNDS Tồn)
        const note = String(c.tndsGhiChu || '').trim();
        if (activeTndsNoteFilter === 'has_note' && !note) return false;
        if (activeTndsNoteFilter === 'no_note' && note) return false;

        // Trạng thái filter
        if (activeTndsStatusFilter !== 'all') {
          const st = String(c.trangThai || 'moi').trim();
          if (st !== activeTndsStatusFilter) return false;
        }

        // Search query
        if (activeTndsReportSearch && activeTndsReportSearch.trim()) {
          const q = activeTndsReportSearch.trim().toLowerCase();
          const bsx = String(c.bienSo || '').toLowerCase();
          const hsbt = String(c.soHoSoBoiThuong || c.soHsbt || '').toLowerCase();
          const owner = String(c.chuXe || c.hoTen || c.khachHang || '').toLowerCase();
          const gdv = String(c.gdvTiepNhan || c.canBoXuLy || c.gdvHo || '').toLowerCase();
          const branch = String(c.donViCapDon || c.chiNhanh || '').toLowerCase();
          const noteContent = String(c.tndsGhiChu || '').toLowerCase();

          const match = bsx.includes(q) || hsbt.includes(q) || owner.includes(q) || gdv.includes(q) || branch.includes(q) || noteContent.includes(q);
          if (!match) return false;
        }

        return true;
      });
    }


    function renderTndsTonReportTableHtml() {
      const filtered = getFilteredTndsTonClaims();

      // Sort: latest updated or createdAt descending
      filtered.sort((a, b) => {
        const timeA = a.tndsLastUpdated || a.createdAt || getClaimTimestamp(a) || 0;
        const timeB = b.tndsLastUpdated || b.createdAt || getClaimTimestamp(b) || 0;
        return timeB - timeA;
      });

      const totalClaims = filtered.length;
      let totalDuPhong = 0;
      let totalDuyetBt = 0;
      let hasNoteCount = 0;

      filtered.forEach(c => {
        const dp = parseInt(String(c.duPhongBoiThuong || '0').replace(/\D/g, ''), 10) || 0;
        totalDuPhong += dp;

        const bt = parseInt(String(c.ttbtTongSoTienBoiThuong || '0').replace(/\D/g, ''), 10) || 0;
        totalDuyetBt += bt;

        if ((c.tndsGhiChu || '').trim()) {
          hasNoteCount++;
        }
      });

      const notePercent = totalClaims > 0 ? Math.round((hasNoteCount / totalClaims) * 100) : 0;

      const rowsHtml = filtered.map((c, idx) => {
        const bsx = c.bienSo || '—';
        const hsbt = c.soHoSoBoiThuong || c.soHsbt || '—';
        const chuXe = c.chuXe || c.hoTen || c.khachHang || '—';
        const gdv = c.gdvTiepNhan || c.canBoXuLy || c.gdvHo || 'Chưa phân công';
        const donVi = c.donViCapDon || c.chiNhanh || '—';
        const ngayMoHs = formatDateDisplay(c.ngayMoHs);
        const duPhong = formatCurrencyInputNumber(c.duPhongBoiThuong) || '0';
        const duyetBt = formatCurrencyInputNumber(c.ttbtTongSoTienBoiThuong) || '0';

        const statusConfig = PENDING_STATUS_MAP[c.trangThai] || PENDING_STATUS_MAP['moi'];
        const statusLabel = statusConfig ? statusConfig.label : (c.trangThai || 'Mới');
        const statusBg = statusConfig ? statusConfig.bg : 'rgba(148, 163, 184, 0.14)';
        const statusColor = statusConfig ? statusConfig.color : '#64748b';
        const statusBorder = statusConfig ? statusConfig.border : 'rgba(148, 163, 184, 0.35)';

        const ghiChu = c.tndsGhiChu || '';
        const lastUpdated = c.tndsLastUpdated;
        const updatedBy = c.tndsUpdatedBy || '';

        return `
          <tr style="border-bottom: 1px solid var(--border); font-size: 13px; transition: background 0.15s ease;" onmouseover="this.style.background='var(--bg-soft)'" onmouseout="this.style.background='transparent'">
            <td style="padding: 12px 10px; text-align: center; font-weight: 700; color: var(--text-muted); width: 45px;">${idx + 1}</td>
            <td style="padding: 12px 10px; text-align: center; width: 130px;">
              <span style="display: inline-block; padding: 3px 8px; border-radius: 99px; font-size: 11px; font-weight: 850; background: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusBorder}; white-space: nowrap;">
                ${escapeHtmlOutput(statusLabel)}
              </span>
            </td>
            <td style="padding: 12px 10px; min-width: 140px; cursor: pointer;" onclick="openEditPendingClaimModal('${c.id}', 'Financial')" title="Xem & sửa chi tiết hồ sơ">
              <div style="font-weight: 850; color: var(--primary); font-size: 13.5px; display: flex; align-items: center; gap: 6px;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                <span>${escapeHtmlOutput(bsx)}</span>
              </div>
              <div style="font-size: 11.5px; color: var(--text-soft); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px;" title="${escapeAttributeData(chuXe)}">${escapeHtmlOutput(chuXe)}</div>
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
              <div style="font-weight: 800; color: var(--text-main);">${escapeHtmlOutput(gdv)}</div>
            </td>
            <td style="padding: 12px 10px; text-align: left; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeAttributeData(donVi)}">
              <span style="font-size: 12px; color: var(--text-soft); font-weight: 650;">${escapeHtmlOutput(donVi)}</span>
            </td>
            <td style="padding: 12px 10px; text-align: center; white-space: nowrap; font-size: 12px; font-weight: 700; color: var(--text-main); width: 100px;">
              ${ngayMoHs}
            </td>
            <td style="padding: 12px 10px; font-weight: 850; color: #10b981; text-align: right; font-size: 13px; width: 125px; white-space: nowrap;">
              ${duPhong !== '0' ? duPhong + ' đ' : '—'}
            </td>
            <td style="padding: 12px 10px; font-weight: 850; color: #3b82f6; text-align: right; font-size: 13px; width: 125px; white-space: nowrap;">
              ${duyetBt !== '0' ? duyetBt + ' đ' : '—'}
            </td>
            <!-- CỘT GHI CHÚ QUẢN LÝ (CHỈ HIỂN THỊ, CHỈNH SỬA TRONG CHI TIẾT HỒ SƠ) -->
            <td style="padding: 10px 10px; min-width: 220px; width: 280px;">
              <div onclick="openEditPendingClaimModal('${c.id}', 'Financial')" style="cursor: pointer; padding: 8px 12px; border-radius: 9px; background: var(--bg-soft); border: 1px solid ${ghiChu ? 'var(--border-strong)' : 'var(--border)'}; transition: all 0.2s ease;" title="Nhấp để xem & chỉnh sửa trong chi tiết hồ sơ" onmouseover="this.style.borderColor='var(--primary)'; this.style.background='var(--surface)';" onmouseout="this.style.borderColor='${ghiChu ? 'var(--border-strong)' : 'var(--border)'}'; this.style.background='var(--bg-soft)';">
                ${ghiChu ? `
                  <div style="font-size: 12.5px; color: var(--text-main); font-weight: 650; line-height: 1.45; word-break: break-word; white-space: pre-line; max-height: 75px; overflow-y: auto;">${escapeHtmlOutput(ghiChu)}</div>
                  <div style="display: flex; align-items: center; gap: 4px; margin-top: 5px; font-size: 11px; color: var(--primary); font-weight: 750;">
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    <span>Xem & sửa trong chi tiết hồ sơ</span>
                  </div>
                ` : `
                  <div style="display: flex; align-items: center; gap: 6px; color: var(--text-soft); font-size: 12px; padding: 2px 0;">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    <span style="font-style: italic;">Chưa có ghi chú (Nhấp để thêm)</span>
                  </div>
                `}
              </div>
            </td>
            <!-- CỘT LẦN GẦN NHẤT ĐƯỢC CẬP NHẬT -->
            <td id="tndsUpdatedCell_${c.id}" style="padding: 12px 10px; text-align: left; width: 155px; font-size: 12px;">
              ${lastUpdated ? `
                <div style="font-weight: 800; color: var(--text-main); font-size: 12px;">${formatTndsTimestampDisplay(lastUpdated)}</div>
                <div style="font-size: 11px; color: var(--text-soft); margin-top: 2px;">${escapeHtmlOutput(updatedBy || 'Hệ thống')}</div>
              ` : `
                <span style="color: var(--text-soft); font-style: italic; font-size: 11.5px;">Chưa cập nhật</span>
              `}
            </td>
          </tr>
        `;
      }).join('');

      return `
        <!-- 4 KPI SUMMARY CARDS FOR TNDS TỒN -->
        <div class="rp-summary-strip rp-summary-strip--tnds" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; margin-bottom: 24px;">
          <!-- Card 1: Tổng hồ sơ TNDS tồn -->
          <div class="p-card stat-widget" style="padding: 20px; border-radius: 18px; border: 1px solid rgba(234, 179, 8, 0.35); background: var(--surface); box-shadow: var(--shadow-sm); position: relative; overflow: hidden;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <span style="font-size: 13px; font-weight: 800; color: var(--text-soft); text-transform: uppercase; letter-spacing: 0.5px;">Tổng HS TNDS Tồn</span>
              <div style="width: 40px; height: 40px; border-radius: 12px; background: rgba(234, 179, 8, 0.12); display: flex; align-items: center; justify-content: center; color: #eab308;">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
              </div>
            </div>
            <div style="font-size: 32px; font-weight: 900; color: #eab308; line-height: 1.1;">${totalClaims.toLocaleString('vi-VN')}</div>
            <div style="font-size: 12px; color: var(--text-soft); margin-top: 8px; font-weight: 700;">Hồ sơ TNDS chưa thanh toán</div>
          </div>

          <!-- Card 2: Tổng dự phòng bồi thường -->
          <div class="p-card stat-widget" style="padding: 20px; border-radius: 18px; border: 1px solid rgba(16, 185, 129, 0.35); background: var(--surface); box-shadow: var(--shadow-sm); position: relative; overflow: hidden;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <span style="font-size: 13px; font-weight: 800; color: var(--text-soft); text-transform: uppercase; letter-spacing: 0.5px;">Tổng Dự phòng BT</span>
              <div style="width: 40px; height: 40px; border-radius: 12px; background: rgba(16, 185, 129, 0.12); display: flex; align-items: center; justify-content: center; color: #10b981;">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
              </div>
            </div>
            <div style="font-size: 28px; font-weight: 900; color: #10b981; line-height: 1.1;">${formatCurrencyInputNumber(totalDuPhong)} <span style="font-size: 16px; font-weight: 700;">đ</span></div>
            <div style="font-size: 12px; color: var(--text-soft); margin-top: 8px; font-weight: 700;">Ước tính tổn thất dự phòng</div>
          </div>

          <!-- Card 3: Tổng tiền duyệt bồi thường -->
          <div class="p-card stat-widget" style="padding: 20px; border-radius: 18px; border: 1px solid rgba(59, 130, 246, 0.35); background: var(--surface); box-shadow: var(--shadow-sm); position: relative; overflow: hidden;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <span style="font-size: 13px; font-weight: 800; color: var(--text-soft); text-transform: uppercase; letter-spacing: 0.5px;">Tiền đã duyệt BT</span>
              <div style="width: 40px; height: 40px; border-radius: 12px; background: rgba(59, 130, 246, 0.12); display: flex; align-items: center; justify-content: center; color: #3b82f6;">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
            </div>
            <div style="font-size: 28px; font-weight: 900; color: #3b82f6; line-height: 1.1;">${formatCurrencyInputNumber(totalDuyetBt)} <span style="font-size: 16px; font-weight: 700;">đ</span></div>
            <div style="font-size: 12px; color: var(--text-soft); margin-top: 8px; font-weight: 700;">Đã phê duyệt chờ chi trả</div>
          </div>

          <!-- Card 4: Tiến độ cập nhật ghi chú -->
          <div class="p-card stat-widget" style="padding: 20px; border-radius: 18px; border: 1px solid rgba(216, 180, 109, 0.35); background: var(--surface); box-shadow: var(--shadow-sm); position: relative; overflow: hidden;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <span style="font-size: 13px; font-weight: 800; color: var(--text-soft); text-transform: uppercase; letter-spacing: 0.5px;">Tiến độ Ghi chú</span>
              <div style="width: 40px; height: 40px; border-radius: 12px; background: rgba(216, 180, 109, 0.15); display: flex; align-items: center; justify-content: center; color: var(--primary);">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
              </div>
            </div>
            <div style="display: flex; align-items: baseline; gap: 8px;">
              <div style="font-size: 32px; font-weight: 900; color: var(--primary); line-height: 1.1;">${hasNoteCount}<span style="font-size: 18px; color: var(--text-soft); font-weight: 700;">/${totalClaims}</span></div>
              <span style="font-size: 12px; font-weight: 850; padding: 2px 8px; border-radius: 6px; background: rgba(216,180,109,0.2); color: var(--primary);">${notePercent}%</span>
            </div>
            <div style="font-size: 12px; color: var(--text-soft); margin-top: 8px; font-weight: 700;">Hồ sơ đã được quản lý ghi chú</div>
          </div>
        </div>

        <!-- MAIN REPORT CARD CONTAINER -->
        <div class="p-card rp-data-card" id="tndsTonReportCardContainer" style="padding: 28px 32px; border-radius: 20px; box-shadow: var(--shadow-sm); border: 1px solid var(--border-strong); background: var(--surface); min-height: 420px; display: flex; flex-direction: column;">
          
          <!-- HEADER & ACTIONS -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px dashed var(--border); flex-wrap: wrap; gap: 14px;">
            <div>
              <h2 style="font-size: 18px; font-weight: 850; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 8px;">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#eab308" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                Báo cáo Quản lý Hồ sơ TNDS Tồn
              </h2>
              <div style="font-size: 12.5px; color: var(--text-soft); margin-top: 4px; font-weight: 650;">
                Toàn bộ hồ sơ Trách nhiệm Dân sự đang tồn đọng lũy kế • Theo dõi tiến độ ghi chú và lịch sử cập nhật
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;" class="hide-on-screenshot">
              <!-- Excel Export -->
              <button type="button" onclick="exportTndsTonReportExcel()" style="padding: 0 16px; height: 38px; border-radius: 11px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; border: none; font-size: 12.5px; font-weight: 850; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(16,185,129,0.3); transition: all 0.2s ease;">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                <span>Xuất Excel (.xlsx)</span>
              </button>

              <!-- Ultra HD Image Export -->
              <button type="button" onclick="downloadTndsTonReportImage()" style="padding: 0 16px; height: 38px; border-radius: 11px; background: rgba(216,180,109,0.15); color: var(--primary); border: 1px solid rgba(216,180,109,0.3); font-size: 12.5px; font-weight: 850; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(216,180,109,0.25)'" onmouseout="this.style.background='rgba(216,180,109,0.15)'">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                <span>Tải ảnh Ultra HD</span>
              </button>
            </div>
          </div>

          <!-- IN-PAGE FILTER & SEARCH TOOLBAR -->
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; flex-wrap: wrap; gap: 12px; background: var(--bg-soft); padding: 12px 16px; border-radius: 14px; border: 1px solid var(--border);" class="hide-on-screenshot rp-inline-filters">
            
            <!-- Search Box -->
            <div style="position: relative; flex: 1; min-width: 260px; max-width: 380px;">
              <input
                type="text"
                placeholder="Tìm biển số, số HSBT, chủ xe, GĐV, ghi chú..."
                value="${escapeAttributeData(activeTndsReportSearch)}"
                oninput="changeTndsReportSearch(this.value)"
                class="input-premium"
                style="width: 100%; height: 38px; padding-left: 36px; padding-right: 12px; border-radius: 10px; font-size: 13px;"
              />
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" style="position: absolute; left: 11px; top: 11px; color: var(--text-soft); pointer-events: none;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              ${activeTndsReportSearch ? `
                <button type="button" onclick="changeTndsReportSearch('')" style="position: absolute; right: 8px; top: 10px; background: none; border: none; color: var(--text-soft); cursor: pointer; padding: 2px;">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              ` : ''}
            </div>

            <!-- Filter Controls Right -->
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <!-- Filter by Note Status -->
              <div class="rp-segmented" role="group" aria-label="Lọc trạng thái ghi chú" style="display: flex; align-items: center; gap: 4px; background: var(--surface); padding: 3px; border-radius: 10px; border: 1px solid var(--border-strong);">
                <button type="button" onclick="setTndsNoteFilter('all')" style="padding: 6px 12px; border-radius: 8px; border: none; font-size: 12px; font-weight: 800; cursor: pointer; transition: all 0.15s; ${activeTndsNoteFilter === 'all' ? 'background: var(--primary); color: #111;' : 'background: transparent; color: var(--text-soft);'}">
                  Tất cả (${totalClaims})
                </button>
                <button type="button" onclick="setTndsNoteFilter('has_note')" style="padding: 6px 12px; border-radius: 8px; border: none; font-size: 12px; font-weight: 800; cursor: pointer; transition: all 0.15s; ${activeTndsNoteFilter === 'has_note' ? 'background: var(--primary); color: #111;' : 'background: transparent; color: var(--text-soft);'}">
                  Có ghi chú (${hasNoteCount})
                </button>
                <button type="button" onclick="setTndsNoteFilter('no_note')" style="padding: 6px 12px; border-radius: 8px; border: none; font-size: 12px; font-weight: 800; cursor: pointer; transition: all 0.15s; ${activeTndsNoteFilter === 'no_note' ? 'background: var(--primary); color: #111;' : 'background: transparent; color: var(--text-soft);'}">
                  Chưa có ghi chú (${totalClaims - hasNoteCount})
                </button>
              </div>

              <!-- Status Dropdown Filter -->
              <div style="position: relative;">
                <select
                  onchange="setTndsStatusFilter(this.value)"
                  class="input-premium"
                  style="height: 38px; padding: 0 14px; border-radius: 10px; font-size: 12.5px; font-weight: 800; color: var(--text-main); cursor: pointer;"
                >
                  <option value="all" ${activeTndsStatusFilter === 'all' ? 'selected' : ''}>Tất cả trạng thái</option>
                  ${Object.entries(PENDING_STATUS_MAP).map(([sKey, sVal]) => `
                    <option value="${sKey}" ${activeTndsStatusFilter === sKey ? 'selected' : ''}>${sVal.label}</option>
                  `).join('')}
                </select>
              </div>
            </div>

          </div>

          <!-- MASTER DATA TABLE -->
          <div class="rp-table-scroll" style="overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 12px; border: 1px solid var(--border);">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
              <thead>
                <tr style="background: var(--bg-soft); border-bottom: 2px solid var(--border-strong); color: var(--text-soft); font-weight: 850; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px;">
                  <th style="padding: 12px 10px; text-align: center; width: 45px;">STT</th>
                  <th style="padding: 12px 10px; text-align: center; width: 130px;">Trạng thái</th>
                  <th style="padding: 12px 10px; min-width: 140px;">Biển số xe / Chủ xe</th>
                  <th style="padding: 12px 10px; min-width: 120px;">Số HSBT</th>
                  <th style="padding: 12px 10px; min-width: 130px;">Giám định viên</th>
                  <th style="padding: 12px 10px; max-width: 160px;">Đơn vị cấp đơn</th>
                  <th style="padding: 12px 10px; text-align: center; width: 100px;">Ngày mở HS</th>
                  <th style="padding: 12px 10px; text-align: right; width: 125px;">Dự phòng BT</th>
                  <th style="padding: 12px 10px; text-align: right; width: 125px;">Tiền duyệt BT</th>
                  <th style="padding: 12px 10px; min-width: 220px; width: 280px; color: var(--primary);">Ghi chú quản lý</th>
                  <th style="padding: 12px 10px; width: 155px; color: var(--primary);">Lần cập nhật cuối</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.length === 0 ? `
                  <tr>
                    <td colspan="11" style="text-align: center; padding: 48px 20px; color: var(--text-soft);">
                      <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.5;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        <span style="font-weight: 750; font-size: 14px;">Không tìm thấy hồ sơ TNDS tồn thỏa mãn điều kiện lọc.</span>
                      </div>
                    </td>
                  </tr>
                ` : rowsHtml}
              </tbody>
            </table>
          </div>

        </div>
      `;
    }


    function exportTndsTonReportExcel() {
      if (!hasUserPermission('report', 'export')) {
        triggerToast('Bạn không có quyền xuất dữ liệu báo cáo.', 'warning');
        return;
      }

      const filtered = getFilteredTndsTonClaims();
      if (filtered.length === 0) {
        triggerToast('Không có hồ sơ TNDS nào để xuất Excel.', 'warning');
        return;
      }

      const excelData = filtered.map((c, idx) => {
        const statusConfig = PENDING_STATUS_MAP[c.trangThai] || PENDING_STATUS_MAP['moi'];
        return {
          'STT': idx + 1,
          'Trạng thái': statusConfig ? statusConfig.label : (c.trangThai || 'Mới'),
          'Biển số xe': c.bienSo || '',
          'Số HSBT': c.soHoSoBoiThuong || c.soHsbt || '',
          'Chủ xe / Khách hàng': c.chuXe || c.hoTen || c.khachHang || '',
          'Giám định viên': c.gdvTiepNhan || c.canBoXuLy || c.gdvHo || '',
          'Đơn vị cấp đơn': c.donViCapDon || c.chiNhanh || '',
          'Ngày mở HS': formatDateDisplay(c.ngayMoHs),
          'Dự phòng bồi thường (VNĐ)': parseInt(String(c.duPhongBoiThuong || '0').replace(/\D/g, ''), 10) || 0,
          'Tiền duyệt bồi thường (VNĐ)': parseInt(String(c.ttbtTongSoTienBoiThuong || '0').replace(/\D/g, ''), 10) || 0,
          'Ghi chú quản lý': c.tndsGhiChu || '',
          'Lần gần nhất cập nhật': c.tndsLastUpdated ? formatTndsTimestampDisplay(c.tndsLastUpdated) : '',
          'Người cập nhật': c.tndsUpdatedBy || ''
        };
      });

      if (window.XLSX) {
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'BC_TNDS_Ton');
        const dateTag = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-');
        XLSX.writeFile(wb, `Bao_Cao_TNDS_Ton_${dateTag}.xlsx`);
        triggerToast('Đã xuất file Excel Báo cáo TNDS Tồn thành công!', 'success');
      } else {
        triggerToast('Thư viện XLSX chưa tải xong, vui lòng thử lại.', 'error');
      }
    }


    function triggerTndsTonReportExcelExport(event) {
      if (event) event.stopPropagation();
      document.querySelectorAll('.custom-select-menu').forEach(m => m.style.display = 'none');
      activeOpenDropdownId = null;
      exportTndsTonReportExcel();
    }


    function downloadTndsTonReportImage() {
      const cardEl = document.getElementById('tndsTonReportCardContainer');
      if (!cardEl) {
        triggerToast('Không tìm thấy khung báo cáo!', 'error');
        return;
      }
      if (typeof html2canvas === 'undefined') {
        triggerToast('Thư viện tạo ảnh đang tải, vui lòng thử lại sau 2 giây...', 'warning');
        return;
      }

      triggerToast('Đang xuất ảnh Báo cáo TNDS Tồn Ultra HD (4K)...', 'info');

      const exportWidth = Math.ceil(Math.max(cardEl.offsetWidth, cardEl.querySelector('table')?.scrollWidth || 0));
      html2canvas(cardEl, {
        scale: Math.max(1, Math.min(3.5, 4096 / exportWidth)),
        width: exportWidth,
        windowWidth: Math.max(document.documentElement.clientWidth, exportWidth + 64),
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        onclone: function(clonedDoc) {
          const target = clonedDoc.getElementById('tndsTonReportCardContainer');
          if (target) {
            target.style.boxShadow = 'none';
            target.style.transform = 'none';
            target.style.backgroundColor = '#ffffff';
            if (typeof prepareRemainingReportImageClone === 'function') prepareRemainingReportImageClone(target, exportWidth);
          }
        },
        ignoreElements: function(element) {
          return element.classList && element.classList.contains('hide-on-screenshot');
        }
      }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Bao_Cao_TNDS_Ton_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
        triggerToast('Đã tải ảnh báo cáo sắc nét thành công!', 'success');
      }).catch(err => {
        console.error(err);
        triggerToast('Có lỗi xảy ra khi xuất ảnh báo cáo!', 'error');
      });
    }


    /* =========================================================================
       BÁO CÁO SỐ LƯỢNG XE & TIỀN BỒI THƯỜNG DỰ PHÒNG CÓ NGÀY MỞ TRONG THÁNG
       ========================================================================= */

    function getClaimOpenDateInfo(c) {
      if (!c) return null;
      const rawDate = c.ngayMoHs || c['Ngày mở hồ sơ'] || c['Ngày mở HS'] || c.ngayMo || '';
      if (!rawDate || rawDate === '—' || rawDate === '-') return null;

      if (typeof parseDateParts === 'function') {
        const dp = parseDateParts(rawDate);
        if (dp && dp.month && dp.year) {
          const dt = new Date(dp.year, dp.month - 1, dp.day || 1, dp.hours || 0, dp.minutes || 0);
          return {
            day: dp.day || 1,
            month: dp.month,
            year: dp.year,
            timestamp: !isNaN(dt.getTime()) ? dt.getTime() : 0,
            display: `${String(dp.day || 1).padStart(2, '0')}/${String(dp.month).padStart(2, '0')}/${dp.year}`
          };
        }
      }

      const str = String(rawDate).trim();
      const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (dmy) {
        const d = parseInt(dmy[1], 10);
        const m = parseInt(dmy[2], 10);
        const y = parseInt(dmy[3], 10);
        const dt = new Date(y, m - 1, d);
        return {
          day: d,
          month: m,
          year: y,
          timestamp: !isNaN(dt.getTime()) ? dt.getTime() : 0,
          display: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
        };
      }

      const ymd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (ymd) {
        const y = parseInt(ymd[1], 10);
        const m = parseInt(ymd[2], 10);
        const d = parseInt(ymd[3], 10);
        const dt = new Date(y, m - 1, d);
        return {
          day: d,
          month: m,
          year: y,
          timestamp: !isNaN(dt.getTime()) ? dt.getTime() : 0,
          display: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
        };
      }

      return null;
    }

    function getClaimReserveAmountValue(c) {
      if (!c) return 0;
      const raw = c.duPhongBoiThuong || c.soTienDuPhong || c.duPhong || c.duPhongGiaTri || c['Dự phòng bồi thường'] || c['Số tiền dự phòng'] || '0';
      const clean = String(raw).replace(/\D/g, '');
      return parseInt(clean, 10) || 0;
    }

    function isTndsClaimMonthlyRecord(c) {
      if (!c) return false;
      if (typeof isTndsClaim === 'function') {
        const res = isTndsClaim(c);
        if (res) return true;
      }
      const text = String(c.loaiHoSo || c.nhomBoiThuong || c.tnds || c.maSpNghiepVu || c.loaiHinhBaoHiem || c.nghiepVu || c.tenHoSo || '').toLowerCase();
      return text.includes('tnds') || text.includes('trách nhiệm dân sự') || text.includes('bat buoc') || text.includes('bắt buộc');
    }

    function getMonthlyOpenedClaimsData() {
      const claimsList = Object.entries(cachedPendingClaimsPayload || {}).map(([k, v]) => ({
        ...v,
        id: v.id || k,
        _claimKey: k
      }));

      const selMonth = (typeof activeGdvReportMonth !== 'undefined') ? activeGdvReportMonth : String(new Date().getMonth() + 1);
      const selYear = (typeof activeGdvReportYear !== 'undefined') ? activeGdvReportYear : String(new Date().getFullYear());

      return claimsList.filter(c => {
        const dateInfo = getClaimOpenDateInfo(c);
        if (!dateInfo) return false;

        // Lọc theo Tháng & Năm của Ngày mở hồ sơ
        if (selYear !== 'all' && dateInfo.year !== parseInt(selYear, 10)) return false;
        if (selMonth !== 'all' && dateInfo.month !== parseInt(selMonth, 10)) return false;

        // Lọc theo Nghiệp vụ (VCX / TNDS)
        if (typeof activeReportClaimType !== 'undefined' && activeReportClaimType !== 'all') {
          const isTnds = isTndsClaimMonthlyRecord(c);
          if (activeReportClaimType === 'VCX' && isTnds) return false;
          if (activeReportClaimType === 'TNDS' && !isTnds) return false;
        }

        // Lọc theo Giám định viên
        if (typeof activeSelectedGdvNames !== 'undefined' && activeSelectedGdvNames && activeSelectedGdvNames.length > 0) {
          const gdv = String(c.gdvTiepNhan || c.canBoXuLy || c.gdvHo || 'Chưa phân công').trim().toLowerCase();
          const matchGdv = activeSelectedGdvNames.some(s => s.trim().toLowerCase() === gdv);
          if (!matchGdv) return false;
        }

        // Lọc theo Chi nhánh cấp đơn
        if (typeof activeGdvReportBranch !== 'undefined' && activeGdvReportBranch !== 'all') {
          const b = String(c.donViCapDon || c.chiNhanh || c.chiNhanhXuly || '').toLowerCase();
          if (!b.includes(activeGdvReportBranch.toLowerCase())) return false;
        }

        c._dateInfo = dateInfo;
        c._reserveVal = getClaimReserveAmountValue(c);
        return true;
      });
    }

    // Tên gara của hồ sơ — cùng thứ tự ưu tiên với các báo cáo gara khác (tên viết tắt trước); rỗng/"—" → chưa xác định.
    const MONTHLY_OPENED_NO_GARAGE = 'Chưa xác định gara';
    function getMonthlyOpenedGarageName(c) {
      const name = [c && c.tenGaraVietTat, c && c.tenGara, c && c.garaSuaChua, c && c.gara].map(v => String(v || '').trim()).find(v => v && v !== '—' && v !== '-');
      return name || MONTHLY_OPENED_NO_GARAGE;
    }

    // Danh sách hồ sơ của kỳ đang chọn, mới nhất trước (dùng cho xuất Excel — trang hiển thị bằng biểu đồ, không liệt kê).
    function getMonthlyOpenedClaimsSorted() {
      return getMonthlyOpenedClaimsData().sort((a, b) => (b._dateInfo?.timestamp || 0) - (a._dateInfo?.timestamp || 0));
    }

    // Tổng hợp cho biểu đồ: theo ngày (đã chọn tháng+năm) / theo tháng (cả năm) / theo tháng-năm (nhiều năm),
    // theo giám định viên và theo trạng thái hồ sơ. Mỗi nhóm có số hồ sơ (VCX/TNDS) và tiền dự phòng.
    function getMonthlyOpenedChartData() {
      const claims = getMonthlyOpenedClaimsData();
      const selMonth = (typeof activeGdvReportMonth !== 'undefined') ? activeGdvReportMonth : String(new Date().getMonth() + 1);
      const selYear = (typeof activeGdvReportYear !== 'undefined') ? activeGdvReportYear : String(new Date().getFullYear());
      const mode = selYear !== 'all' && selMonth !== 'all' ? 'day' : selYear !== 'all' ? 'month' : 'period';
      const blank = () => ({ count: 0, vcx: 0, tnds: 0, reserve: 0 });
      const add = (bucket, isTnds, reserve) => { bucket.count++; if (isTnds) bucket.tnds++; else bucket.vcx++; bucket.reserve += reserve; };

      const timeline = new Map();
      if (mode === 'day') {
        const days = new Date(parseInt(selYear, 10), parseInt(selMonth, 10), 0).getDate();
        for (let d = 1; d <= days; d++) timeline.set(d, { label: String(d).padStart(2, '0'), ...blank() });
      } else if (mode === 'month') {
        for (let m = 1; m <= 12; m++) timeline.set(m, { label: 'T' + m, ...blank() });
      }
      const gdvMap = new Map();
      const statusMap = new Map();
      const garaMap = new Map();

      claims.forEach(c => {
        const info = c._dateInfo || getClaimOpenDateInfo(c);
        if (!info) return;
        const reserve = c._reserveVal || getClaimReserveAmountValue(c);
        const isTnds = isTndsClaimMonthlyRecord(c);
        const key = mode === 'day' ? info.day : mode === 'month' ? info.month : info.year * 100 + info.month;
        if (!timeline.has(key)) timeline.set(key, { label: String(info.month).padStart(2, '0') + '/' + info.year, ...blank() });
        add(timeline.get(key), isTnds, reserve);

        const gdv = String(c.gdvTiepNhan || c.canBoXuLy || c.gdvHo || 'Chưa phân công').trim() || 'Chưa phân công';
        if (!gdvMap.has(gdv)) gdvMap.set(gdv, { label: gdv, ...blank() });
        add(gdvMap.get(gdv), isTnds, reserve);

        const gara = getMonthlyOpenedGarageName(c);
        if (!garaMap.has(gara)) garaMap.set(gara, { label: gara, ...blank() });
        add(garaMap.get(gara), isTnds, reserve);

        const st = String(c.trangThai || 'moi').trim() || 'moi';
        if (!statusMap.has(st)) statusMap.set(st, { key: st, label: (PENDING_STATUS_MAP[st] && PENDING_STATUS_MAP[st].label) || st, ...blank() });
        add(statusMap.get(st), isTnds, reserve);
      });

      const series = rows => ({
        labels: rows.map(r => r.label), count: rows.map(r => r.count), vcx: rows.map(r => r.vcx),
        tnds: rows.map(r => r.tnds), reserve: rows.map(r => r.reserve)
      });
      const orderedTimeline = [...timeline.entries()].sort((x, y) => x[0] - y[0]).map(entry => entry[1]);

      // GĐV: nhiều nhất trước; quá 10 người thì gộp phần còn lại thành "Khác".
      let gdvRows = [...gdvMap.values()].sort((x, y) => y.count - x.count || y.reserve - x.reserve);
      if (gdvRows.length > 10) {
        const rest = gdvRows.slice(10).reduce((acc, r) => { acc.count += r.count; acc.vcx += r.vcx; acc.tnds += r.tnds; acc.reserve += r.reserve; return acc; }, { label: 'Khác', ...blank() });
        gdvRows = gdvRows.slice(0, 10).concat(rest);
      }
      // Gara: nhiều hồ sơ nhất trước (bằng nhau thì dự phòng cao hơn); quá 15 gara gộp thành "Khác"; "Chưa xác định gara" luôn cuối.
      const sumRows = (rows, label) => rows.reduce((acc, r) => { acc.count += r.count; acc.vcx += r.vcx; acc.tnds += r.tnds; acc.reserve += r.reserve; return acc; }, { label, ...blank() });
      const unassigned = garaMap.get(MONTHLY_OPENED_NO_GARAGE);
      let garaRows = [...garaMap.values()].filter(r => r !== unassigned).sort((x, y) => y.count - x.count || y.reserve - x.reserve || x.label.localeCompare(y.label, 'vi'));
      const garaNamedCount = garaRows.length;
      if (garaRows.length > 15) garaRows = garaRows.slice(0, 15).concat(sumRows(garaRows.slice(15), 'Khác'));
      if (unassigned) garaRows.push(unassigned);
      // Trạng thái: theo thứ tự quy trình trong PENDING_STATUS_MAP, trạng thái lạ xếp cuối.
      const statusOrder = Object.keys(PENDING_STATUS_MAP);
      const statusRows = [...statusMap.values()].sort((x, y) => {
        const ix = statusOrder.indexOf(x.key), iy = statusOrder.indexOf(y.key);
        return (ix < 0 ? 999 : ix) - (iy < 0 ? 999 : iy);
      });

      return {
        mode, total: claims.length, timeline: series(orderedTimeline), gdv: series(gdvRows), gara: series(garaRows), garaNamedCount, status: series(statusRows),
        totalReserve: claims.reduce((sum, c) => sum + (c._reserveVal || 0), 0)
      };
    }

    function exportMonthlyOpenedClaimsReportExcel() {
      if (typeof XLSX === 'undefined') {
        triggerToast('Thư viện XLSX chưa tải xong, vui lòng thử lại sau giây lát.', 'error');
        return;
      }

      const claims = getMonthlyOpenedClaimsSorted();
      if (!claims || claims.length === 0) {
        triggerToast('Không có dữ liệu để xuất file Excel!', 'warning');
        return;
      }

      try {
        const selMonth = (typeof activeGdvReportMonth !== 'undefined') ? activeGdvReportMonth : String(new Date().getMonth() + 1);
        const selYear = (typeof activeGdvReportYear !== 'undefined') ? activeGdvReportYear : String(new Date().getFullYear());

        const rows = claims.map((c, idx) => {
          const statusConfig = PENDING_STATUS_MAP[c.trangThai] || PENDING_STATUS_MAP['moi'];
          const statusLabel = statusConfig ? statusConfig.label : (c.trangThai || 'Mới');
          const isTnds = isTndsClaimMonthlyRecord(c);
          const openDate = c._dateInfo?.display || formatDateDisplay(c.ngayMoHs);
          const reserve = c._reserveVal || getClaimReserveAmountValue(c);

          return {
            'STT': idx + 1,
            'Biển số xe': c.bienSo || '',
            'Số HSBT': c.soHoSoBoiThuong || c.soHsbt || '',
            'Tên chủ xe': c.chuXe || c.hoTen || c.khachHang || '',
            'Hãng xe': c.hangXe || '',
            'Hiệu xe': c.hieuXe || '',
            'Nghiệp vụ': isTnds ? 'TNDS' : 'VCX',
            'Ngày mở HS': openDate,
            'Giám định viên': c.gdvTiepNhan || c.canBoXuLy || c.gdvHo || 'Chưa phân công',
            'Đơn vị cấp đơn': c.donViCapDon || c.chiNhanh || '',
            'Dự phòng bồi thường (VNĐ)': reserve,
            'Trạng thái hồ sơ': statusLabel,
            'Gara sửa chữa': getMonthlyOpenedGarageName(c) === MONTHLY_OPENED_NO_GARAGE ? '' : getMonthlyOpenedGarageName(c)
          };
        });

        // Hàng tổng cộng
        const totalReserve = claims.reduce((sum, c) => sum + (c._reserveVal || getClaimReserveAmountValue(c)), 0);
        rows.push({
          'STT': 'Tổng cộng',
          'Biển số xe': `${claims.length} hồ sơ`,
          'Số HSBT': '',
          'Tên chủ xe': '',
          'Hãng xe': '',
          'Hiệu xe': '',
          'Nghiệp vụ': '',
          'Ngày mở HS': '',
          'Giám định viên': '',
          'Đơn vị cấp đơn': '',
          'Dự phòng bồi thường (VNĐ)': totalReserve,
          'Trạng thái hồ sơ': '',
          'Gara sửa chữa': ''
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'BC_Xe_Va_Du_Phong');

        // Sheet tổng hợp theo gara: số hồ sơ (VCX/TNDS), tiền dự phòng, bình quân — đầy đủ, không gộp "Khác".
        const garaTotals = new Map();
        claims.forEach(c => {
          const name = getMonthlyOpenedGarageName(c);
          const row = garaTotals.get(name) || { 'Gara': name, 'Số hồ sơ': 0, 'VCX': 0, 'TNDS': 0, 'Dự phòng bồi thường (VNĐ)': 0 };
          row['Số hồ sơ']++;
          row[isTndsClaimMonthlyRecord(c) ? 'TNDS' : 'VCX']++;
          row['Dự phòng bồi thường (VNĐ)'] += c._reserveVal || getClaimReserveAmountValue(c);
          garaTotals.set(name, row);
        });
        const garaRows = [...garaTotals.values()].sort((x, y) => y['Số hồ sơ'] - x['Số hồ sơ'] || y['Dự phòng bồi thường (VNĐ)'] - x['Dự phòng bồi thường (VNĐ)'])
          .map(row => ({ ...row, 'Dự phòng bình quân / hồ sơ (VNĐ)': row['Số hồ sơ'] ? Math.round(row['Dự phòng bồi thường (VNĐ)'] / row['Số hồ sơ']) : 0 }));
        garaRows.push({ 'Gara': 'Tổng cộng', 'Số hồ sơ': claims.length, 'VCX': garaRows.reduce((n, r) => n + r['VCX'], 0), 'TNDS': garaRows.reduce((n, r) => n + r['TNDS'], 0),
          'Dự phòng bồi thường (VNĐ)': totalReserve, 'Dự phòng bình quân / hồ sơ (VNĐ)': claims.length ? Math.round(totalReserve / claims.length) : 0 });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(garaRows), 'Theo_Gara');

        const mTag = selMonth === 'all' ? 'TatCaThang' : `T${selMonth}`;
        const yTag = selYear === 'all' ? 'TatCaNam' : `N${selYear}`;
        XLSX.writeFile(wb, `Bao_Cao_Xe_Va_Du_Phong_Boi_Thuong_${mTag}_${yTag}.xlsx`);
        triggerToast('Đã xuất file Excel Báo cáo xe & dự phòng thành công!', 'success');
      } catch (err) {
        console.error('Lỗi xuất Excel:', err);
        triggerToast('Có lỗi xảy ra khi xuất file Excel: ' + err.message, 'error');
      }
    }

    function downloadMonthlyOpenedClaimsReportImage() {
      const cardEl = document.getElementById('monthlyOpenedClaimsReportCardContainer');
      if (!cardEl) {
        triggerToast('Không tìm thấy khung báo cáo để xuất ảnh!', 'error');
        return;
      }
      if (typeof html2canvas === 'undefined') {
        triggerToast('Thư viện tạo ảnh đang tải, vui lòng thử lại sau...', 'warning');
        return;
      }

      triggerToast('Đang xuất ảnh Báo cáo xe & dự phòng Ultra HD (4K)...', 'info');
      const isDark = !document.body.classList.contains('light-mode');
      const shell = cardEl.closest('.gdv-report-premium-shell');
      const paperBg = (shell && getComputedStyle(shell).getPropertyValue('--ton-soft').trim()) || (isDark ? '#121e27' : '#f6f7f2');
      const exportWidth = Math.ceil(Math.max(cardEl.offsetWidth, 1200));

      html2canvas(cardEl, {
        scale: Math.max(1, Math.min(3.5, 4096 / exportWidth)),
        width: exportWidth,
        windowWidth: Math.max(document.documentElement.clientWidth, exportWidth + 64),
        useCORS: true,
        allowTaint: true,
        backgroundColor: paperBg,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        onclone: function(clonedDoc) {
          const target = clonedDoc.getElementById('monthlyOpenedClaimsReportCardContainer');
          if (target) {
            target.classList.add('mo-report-shell--export');
            target.style.boxShadow = 'none';
            target.style.transform = 'none';
            target.style.backgroundColor = paperBg;
            if (typeof prepareRemainingReportImageClone === 'function') prepareRemainingReportImageClone(target, exportWidth);
          }
        },
        ignoreElements: function(el) {
          return el.classList && el.classList.contains('hide-on-screenshot');
        }
      }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Bao_Cao_Xe_Va_Du_Phong_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
        triggerToast('Đã tải ảnh báo cáo sắc nét thành công!', 'success');
      }).catch(err => {
        console.error(err);
        triggerToast('Có lỗi xảy ra khi xuất ảnh báo cáo!', 'error');
      });
    }

    function renderMonthlyOpenedClaimsReportHtml() {
      const allMonthlyClaims = getMonthlyOpenedClaimsData();

      const selMonth = (typeof activeGdvReportMonth !== 'undefined') ? activeGdvReportMonth : String(new Date().getMonth() + 1);
      const selYear = (typeof activeGdvReportYear !== 'undefined') ? activeGdvReportYear : String(new Date().getFullYear());
      const monthLabel = selMonth === 'all' ? (selYear === 'all' ? 'Tất cả các kỳ' : `Năm ${selYear}`) : `Tháng ${selMonth}/${selYear}`;

      // Thống kê tổng quan trên allMonthlyClaims
      const totalClaims = allMonthlyClaims.length;

      const uniquePlatesSet = new Set();
      allMonthlyClaims.forEach(c => {
        const plate = String(c.bienSo || '').trim().toUpperCase();
        if (plate && plate !== '—' && plate !== '-') uniquePlatesSet.add(plate);
      });
      const totalUniqueVehicles = uniquePlatesSet.size;

      let totalReserve = 0;
      let claimsWithReserveCount = 0;
      let vcxCount = 0;
      let vcxReserve = 0;
      let tndsCount = 0;
      let tndsReserve = 0;

      allMonthlyClaims.forEach(c => {
        const r = c._reserveVal || getClaimReserveAmountValue(c);
        totalReserve += r;
        if (r > 0) claimsWithReserveCount++;

        const isTnds = isTndsClaimMonthlyRecord(c);   // cùng cách phân loại với biểu đồ bên dưới
        if (isTnds) {
          tndsCount++;
          tndsReserve += r;
        } else {
          vcxCount++;
          vcxReserve += r;
        }
      });

      const avgReservePerVehicle = totalClaims > 0 ? Math.round(totalReserve / totalClaims) : 0;
      const reserveCoveragePct = totalClaims > 0 ? Math.round((claimsWithReserveCount / totalClaims) * 100) : 0;

      const chartData = getMonthlyOpenedChartData();

      const sumOf = list => list.reduce((n, v) => n + (v || 0), 0);
      const moMoney = value => value >= 1e9 ? (value / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' Tỷ' : value >= 1e6 ? (value / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' Tr' : Math.round(value).toLocaleString('vi-VN') + ' đ';
      const moChip = (label, value, variant = '') => `<span class="mo-chip ${variant ? 'mo-chip--' + variant : ''}">${label} <strong>${value}</strong></span>`;
      const buildPanelHead = (title, series, note = '') => {
        const top = series.count.reduce((best, v, i) => (v > (series.count[best] || 0) || (v === series.count[best] && series.reserve[i] > series.reserve[best])) ? i : best, 0);
        const topReserve = series.reserve.reduce((best, v, i) => v > series.reserve[best] ? i : best, 0);
        return `
          <div class="mo-panel-head">
            <div>
              <div class="mo-panel-title">${escapeHtmlOutput(title)}</div>
              ${note ? `<div class="mo-panel-note">${escapeHtmlOutput(note)}</div>` : ''}
            </div>
            <div class="mo-panel-chips">
              ${moChip('Tổng', sumOf(series.count).toLocaleString('vi-VN') + ' hồ sơ')}
              ${moChip('Dự phòng', moMoney(sumOf(series.reserve)), 'gold')}
              ${series.labels.length > 1 ? moChip('Nhiều nhất', escapeHtmlOutput(series.labels[top]) + ' · ' + series.count[top], 'emerald') : ''}
              ${series.labels.length > 1 && topReserve !== top ? moChip('DP cao nhất', escapeHtmlOutput(series.labels[topReserve]) + ' · ' + moMoney(series.reserve[topReserve]), 'gold') : ''}
            </div>
          </div>`;
      };
      const moStandaloneCard = (title, series, canvasId, height, aria, note = '') => `
        <section class="mo-chart-card mo-chart-card--standalone" aria-label="${escapeAttributeData(title)}">
          ${buildPanelHead(title, series, note)}
          <div class="mo-canvas-wrap" style="height: ${height}px;">
            <canvas id="${canvasId}" role="img" aria-label="${escapeAttributeData(aria)}"></canvas>
          </div>
        </section>`;

      return `
        <!-- 4 EXECUTIVE KPI SUMMARY CARDS (đồng bộ chuẩn Paper / Forest / Champagne) -->
        <div class="rp-summary-strip rp-summary-strip--monthly-opened">
          <!-- Card 1: Số lượng xe / hồ sơ mở -->
          <div class="p-card stat-widget">
            <div class="mo-kpi-head">
              <span class="mo-kpi-label">Số lượng xe / Hồ sơ mở</span>
            </div>
            <div class="mo-kpi-value mo-kpi-value--gold">
              <span>${totalClaims.toLocaleString('vi-VN')}</span>
              <span class="mo-kpi-unit">hồ sơ (${totalUniqueVehicles} xe)</span>
            </div>
            <div class="mo-kpi-meta">Ngày mở hồ sơ trong ${escapeHtmlOutput(monthLabel)}</div>
          </div>

          <!-- Card 2: Tổng tiền dự phòng bồi thường -->
          <div class="p-card stat-widget">
            <div class="mo-kpi-head">
              <span class="mo-kpi-label">Tổng tiền dự phòng bồi thường</span>
            </div>
            <div class="mo-kpi-value mo-kpi-value--green">
              <span>${formatCurrencyInputNumber(totalReserve)}</span>
              <span class="mo-kpi-unit">đ</span>
            </div>
            <div class="mo-kpi-meta">Lấy theo số tiền dự phòng tổn thất</div>
          </div>

          <!-- Card 3: Dự phòng bình quân / xe -->
          <div class="p-card stat-widget">
            <div class="mo-kpi-head">
              <span class="mo-kpi-label">Dự phòng bình quân / xe</span>
            </div>
            <div class="mo-kpi-value mo-kpi-value--blue">
              <span>${formatCurrencyInputNumber(avgReservePerVehicle)}</span>
              <span class="mo-kpi-unit">đ/xe</span>
            </div>
            <div class="mo-kpi-meta">Ước tính tổn thất trung bình mỗi xe</div>
          </div>

          <!-- Card 4: Hồ sơ có dự phòng & Nghiệp vụ -->
          <div class="p-card stat-widget">
            <div class="mo-kpi-head">
              <span class="mo-kpi-label">Hồ sơ có dự phòng &amp; Nghiệp vụ</span>
              <span class="mo-kpi-badge">${reserveCoveragePct}%</span>
            </div>
            <div class="mo-kpi-value mo-kpi-value--violet">
              <span>${claimsWithReserveCount}</span>
              <span class="mo-kpi-unit">/${totalClaims} hồ sơ</span>
            </div>
            <div class="mo-kpi-meta">
              <span class="mo-kpi-split" title="Vật chất xe: ${formatCurrencyInputNumber(vcxReserve)} đ"><span class="mo-kpi-dot" style="background:#2563eb;"></span>VCX: <strong>${vcxCount}</strong> (${moMoney(vcxReserve)})</span>
              <span class="mo-kpi-split" title="Trách nhiệm dân sự: ${formatCurrencyInputNumber(tndsReserve)} đ"><span class="mo-kpi-dot" style="background:#7c3aed;"></span>TNDS: <strong>${tndsCount}</strong> (${moMoney(tndsReserve)})</span>
            </div>
          </div>
        </div>

        <!-- BIỂU ĐỒ BÁO CÁO (cấu trúc card tách thoáng đồng bộ với Phát sinh theo năm & KPI Zone) -->
        <div id="monthlyOpenedClaimsReportCardContainer" class="mo-report-shell">
          <section class="mo-chart-card" aria-label="Biểu đồ hồ sơ mở và dự phòng bồi thường">
            <div class="mo-chart-heading">
              <div class="mo-chart-heading__copy">
                <span class="mo-eyebrow">XE &amp; DỰ PHÒNG MỞ TRONG KỲ</span>
                <h2 class="mo-chart-title">Biểu đồ hồ sơ mở &amp; dự phòng bồi thường · ${escapeHtmlOutput(monthLabel)}</h2>
                <p class="mo-chart-subtitle">
                  <span>Tổng dự phòng: <strong>${formatCurrencyInputNumber(totalReserve)} đ</strong></span>
                  <span>Bình quân: <strong>${formatCurrencyInputNumber(avgReservePerVehicle)} đ/hồ sơ</strong></span>
                  <span>Phân tách VCX, TNDS và dự phòng tổn thất theo ngày mở hồ sơ</span>
                </p>
              </div>
              <div class="mo-chart-actions hide-on-screenshot">
                <div role="group" aria-label="Kiểu biểu đồ" class="mo-chart-toggle">
                  <button type="button" class="mo-chart-type" aria-pressed="${activeMonthlyOpenedChartType === 'bar'}" onclick="activeMonthlyOpenedChartType='bar'; renderGdvMonthlyReportPage();">Biểu đồ cột</button>
                  <button type="button" class="mo-chart-type" aria-pressed="${activeMonthlyOpenedChartType === 'line'}" onclick="activeMonthlyOpenedChartType='line'; renderGdvMonthlyReportPage();">Biểu đồ đường</button>
                </div>
                <button type="button" class="mo-chart-btn-secondary" onclick="exportMonthlyOpenedClaimsReportExcel()">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  <span>Tải Excel (.xlsx)</span>
                </button>
                <button type="button" class="mo-chart-download" onclick="downloadMonthlyOpenedClaimsReportImage()">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                  <span>Xuất ảnh (4K)</span>
                </button>
              </div>
            </div>

            ${totalClaims === 0 ? `
              <div role="status" class="mo-empty-state">Không có hồ sơ nào mở trong ${escapeHtmlOutput(monthLabel)} theo bộ lọc hiện tại.</div>
            ` : `
              ${buildPanelHead('Diễn biến theo ' + (chartData.mode === 'day' ? 'ngày' : 'tháng') + ' mở hồ sơ', chartData.timeline)}
              <div class="mo-canvas-wrap" style="height: 390px;">
                <canvas id="monthlyOpenedTimelineCanvas" role="img" aria-label="Số hồ sơ và tiền dự phòng theo thời gian"></canvas>
              </div>
            `}
          </section>

          ${totalClaims > 0 ? `
            ${moStandaloneCard('Theo gara — số hồ sơ & tiền dự phòng từng gara', chartData.gara, 'monthlyOpenedGaraCanvas', 410, 'Số hồ sơ và tiền dự phòng theo từng gara', `${chartData.garaNamedCount} gara${chartData.gara.labels.includes('Khác') ? ' · 15 gara nhiều hồ sơ nhất, còn lại gộp "Khác"' : ''} · đầy đủ từng gara trong Excel (sheet Theo_Gara)`)}
            <div class="mo-secondary-grid">
              ${moStandaloneCard('Theo giám định viên', chartData.gdv, 'monthlyOpenedGdvCanvas', 340, 'Số hồ sơ và tiền dự phòng theo giám định viên')}
              ${moStandaloneCard('Theo trạng thái hồ sơ', chartData.status, 'monthlyOpenedStatusCanvas', 340, 'Số hồ sơ và tiền dự phòng theo trạng thái')}
            </div>
            <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" onload="if(window.initMonthlyOpenedClaimsCharts) setTimeout(window.initMonthlyOpenedClaimsCharts, 50); this.remove();" style="display:none;" alt="" />
          ` : ''}
        </div>
      `;
    }

    // Vẽ 4 biểu đồ kết hợp (cột/đường = số hồ sơ VCX/TNDS, đường vàng trục phải = tiền dự phòng) có ghi nhãn số liệu
    // rõ ràng, lót nền paper chống đường kẻ cắt ngang chữ và thuật toán né va chạm theo hướng dốc điểm dữ liệu.
    let monthlyOpenedChartInstances = [];
    function formatMonthlyOpenedMoney(value) {
      const v = Number(value) || 0;
      if (v >= 1e9) return (v / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' Tỷ';
      if (v >= 1e7) return Math.round(v / 1e6).toLocaleString('vi-VN') + ' Tr';
      if (v >= 1e6) return (v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' Tr';
      if (v >= 1e3) return Math.round(v / 1e3).toLocaleString('vi-VN') + ' K';
      return String(Math.round(v));
    }

    function initMonthlyOpenedClaimsCharts() {
      if (typeof Chart === 'undefined') return;
      monthlyOpenedChartInstances.forEach(chart => { try { chart.destroy(); } catch (_) { /* đã huỷ */ } });
      monthlyOpenedChartInstances = [];
      const root = document.getElementById('monthlyOpenedClaimsReportCardContainer');
      if (!root) return;
      const data = getMonthlyOpenedChartData();
      const isDark = !document.body.classList.contains('light-mode');
      const style = getComputedStyle(root.closest('.gdv-report-premium-shell') || root);
      const ink = style.getPropertyValue('--ton-ink').trim() || (isDark ? '#f0f2eb' : '#283b36');
      const muted = style.getPropertyValue('--ton-muted').trim() || (isDark ? '#9ea8a4' : '#76817e');
      const grid = style.getPropertyValue('--ton-line').trim() || (isDark ? '#2a3840' : '#e5e8e0');
      const paper = style.getPropertyValue('--ton-paper').trim() || (isDark ? '#121e27' : '#ffffff');
      const FONT = "'Plus Jakarta Sans', sans-serif";
      const GOLD = isDark ? '#e6b85c' : '#a17c3b';
      const isLine = activeMonthlyOpenedChartType === 'line';
      const COLORS = isDark ? { vcx: '#538df8', tnds: '#a78bfa' } : { vcx: '#2563eb', tnds: '#7c3aed' };
      const fmtVnd = value => Math.round(value || 0).toLocaleString('vi-VN') + ' đ';

      const gradient = color => context => {
        const area = context.chart.chartArea;
        if (!area) return color;
        const fill = context.chart.ctx.createLinearGradient(0, area.bottom, 0, area.top);
        fill.addColorStop(0, color + 'a8');
        fill.addColorStop(1, color + 'f2');
        return fill;
      };

      const roundRect = (ctx, x, y, w, h, r) => {
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
        ctx.beginPath(); ctx.rect(x, y, w, h);
      };

      const labelsPlugin = {
        id: 'monthlyOpenedLabels',
        beforeDraw(chart) {
          const { ctx } = chart;
          ctx.save();
          ctx.globalCompositeOperation = 'destination-over';
          ctx.fillStyle = paper;
          ctx.fillRect(0, 0, chart.width, chart.height);
          ctx.restore();
        },
        afterDatasetsDraw(chart) {
          const { ctx, chartArea } = chart;
          const datasets = chart.data.datasets;
          const countSets = datasets.map((dataset, index) => ({ dataset, index })).filter(item => item.dataset.yAxisID === 'y');
          const reserveIndex = datasets.findIndex(dataset => dataset.yAxisID === 'y1');
          const taken = [];
          const overlaps = (a, b, pad = 3) => (a.x1 - pad) < b.x2 && (a.x2 + pad) > b.x1 && (a.y1 - 2) < b.y2 && (a.y2 + 2) > b.y1;
          const free = (rect, pad = 3) => rect.y1 >= chartArea.top - 8 && rect.x1 >= chartArea.left - 4 && rect.x2 <= chartArea.right + 4 && !taken.some(t => overlaps(rect, t, pad));

          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const countText = (text, x, y, color, size) => {
            ctx.font = `800 ${size}px ${FONT}`;
            const w = ctx.measureText(text).width;
            const rect = { x1: x - w / 2 - 2, x2: x + w / 2 + 2, y1: y - size / 2 - 1, y2: y + size / 2 + 1 };
            if (!free(rect, 1)) return false;
            ctx.fillStyle = color;
            ctx.fillText(text, x, y);
            taken.push(rect);
            return true;
          };

          // 1) Nhãn số lượng hồ sơ trên cột hoặc đường
          const n = chart.data.labels.length;
          for (let i = 0; i < n; i++) {
            if (!isLine) {
              let total = 0, top = null;
              countSets.forEach(({ dataset, index }) => {
                const value = dataset.data[i] || 0;
                const element = chart.getDatasetMeta(index).data[i];
                if (!value || !element) return;
                total += value;
                if (!top || element.y < top.y) top = element;
                if (Math.abs(element.base - element.y) >= 18 && (element.width || 0) >= 14) {
                  countText(String(value), element.x, (element.y + element.base) / 2, '#ffffff', 10.5);
                }
              });
              if (total && top) countText(String(total), top.x, top.y - 10, ink, 11.5);
            } else {
              countSets.forEach(({ dataset, index }) => {
                const value = dataset.data[i] || 0;
                const element = chart.getDatasetMeta(index).data[i];
                if (value && element) countText(String(value), element.x, element.y - 11, dataset.borderColor, 11);
              });
            }
          }

          // 2) Nhãn tiền dự phòng: lót nền đặc (paper) che nét đường bên dưới + né va chạm thông minh
          if (reserveIndex >= 0) {
            const meta = chart.getDatasetMeta(reserveIndex);
            const rawVals = datasets[reserveIndex].data;
            const nodeBoxes = meta.data.map((el, idx) => (rawVals[idx] && el && !el.skip) ? { x1: el.x - 6, x2: el.x + 6, y1: el.y - 6, y2: el.y + 6, idx } : null);

            meta.data.forEach((element, i) => {
              const value = rawVals[i];
              if (!value || !element || element.skip) return;
              const text = formatMonthlyOpenedMoney(value);
              ctx.font = `750 10px ${FONT}`;
              const w = ctx.measureText(text).width + 11, h = 17;

              // Đáy cục bộ đặt xuống dưới trước; đỉnh cục bộ / điểm thường đặt lên trên trước
              let prevV = null, nextV = null;
              for (let k = i - 1; k >= 0; k--) if (rawVals[k]) { prevV = rawVals[k]; break; }
              for (let k = i + 1; k < n; k++) if (rawVals[k]) { nextV = rawVals[k]; break; }
              const isValley = prevV !== null && nextV !== null && value < prevV && value < nextV;
              const dyList = isValley ? [20, 38, -20, -38] : [-20, 20, -38, 38];
              const dxList = [0, -10, 10];

              let placed = null;
              outer: for (const dy of dyList) {
                for (const dx of dxList) {
                  const cx = element.x + dx;
                  const cy = element.y + dy;
                  const rect = { x1: cx - w / 2, x2: cx + w / 2, y1: cy - h / 2, y2: cy + h / 2 };
                  if (rect.y2 > chartArea.bottom + 2 || !free(rect, 3)) continue;
                  const hitsNode = nodeBoxes.some(nb => nb && overlaps(rect, nb, 2));
                  if (hitsNode) continue;
                  placed = { cx, cy, rect };
                  break outer;
                }
              }

              if (placed) {
                const { cx, cy, rect } = placed;
                ctx.fillStyle = paper;
                roundRect(ctx, rect.x1, rect.y1, w, h, 8);
                ctx.fill();
                ctx.fillStyle = isDark ? 'rgba(230,184,92,0.16)' : 'rgba(161,124,59,0.12)';
                roundRect(ctx, rect.x1, rect.y1, w, h, 8);
                ctx.fill();
                ctx.strokeStyle = isDark ? 'rgba(230,184,92,0.48)' : 'rgba(161,124,59,0.38)';
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.fillStyle = GOLD;
                ctx.fillText(text, cx, cy + 0.5);
                taken.push(rect);
              }
            });
          }
          ctx.restore();
        }
      };

      const build = (canvasId, series, view = {}) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !series.labels.length) return;
        const compact = canvas.clientWidth < 560;
        // Tách hai vùng: cột/đường số hồ sơ nằm gọn nửa dưới (~42%), đường dự phòng nằm ở băng trên (~45%)
        const peakCount = Math.max(1, ...series.labels.map((_, i) => isLine ? Math.max(series.vcx[i], series.tnds[i]) : series.vcx[i] + series.tnds[i]));
        const peakReserve = Math.max(1, ...series.reserve.map((value, i) => series.count[i] ? value : 0));
        const countMax = Math.max(peakCount + 3, Math.ceil(peakCount * 2.25));
        const claimSet = (key, label) => ({
          type: isLine ? 'line' : 'bar',
          label,
          data: series[key],
          yAxisID: 'y',
          borderColor: COLORS[key],
          backgroundColor: isLine ? COLORS[key] : gradient(COLORS[key]),
          borderWidth: isLine ? 2.8 : 0,
          borderSkipped: false,
          borderRadius: isLine ? 0 : (ctx) => {
            const hasTndsAbove = key === 'vcx' && (series.tnds[ctx.dataIndex] || 0) > 0;
            return hasTndsAbove ? 0 : { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 };
          },
          maxBarThickness: 44,
          stack: isLine ? undefined : 'claims',
          pointRadius: isLine ? 4 : 0,
          pointHoverRadius: 6,
          pointBackgroundColor: paper,
          pointBorderColor: COLORS[key],
          pointBorderWidth: 2.2,
          tension: 0.32,
          fill: false
        });
        const chart = new Chart(canvas.getContext('2d'), {
          type: isLine ? 'line' : 'bar',
          data: {
            labels: series.labels,
            datasets: [
              claimSet('vcx', 'VCX (hồ sơ)'),
              claimSet('tnds', 'TNDS (hồ sơ)'),
              {
                type: 'line',
                label: 'Dự phòng (đ)',
                data: series.reserve.map((value, i) => series.count[i] ? value : null),
                spanGaps: true,
                yAxisID: 'y1',
                order: -1,
                borderColor: GOLD,
                backgroundColor: GOLD,
                borderWidth: 2.8,
                pointRadius: 4.2,
                pointHoverRadius: 6.5,
                pointBackgroundColor: paper,
                pointBorderColor: GOLD,
                pointBorderWidth: 2.5,
                tension: 0.32,
                fill: false
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            layout: { padding: { top: 6, right: 18, left: 4 } },
            animation: { duration: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 420, easing: 'easeOutQuart' },
            plugins: {
              legend: {
                position: 'top',
                align: 'end',
                labels: {
                  usePointStyle: true,
                  pointStyle: 'circle',
                  boxWidth: 8,
                  boxHeight: 8,
                  padding: 16,
                  color: ink,
                  font: { family: FONT, size: 11.5, weight: '750' }
                }
              },
              tooltip: {
                backgroundColor: isDark ? 'rgba(15,23,42,0.96)' : 'rgba(255,255,255,0.98)',
                titleColor: isDark ? '#ffffff' : '#1b2a22',
                bodyColor: isDark ? '#cbd5e1' : '#475569',
                borderColor: grid,
                borderWidth: 1,
                padding: 13,
                cornerRadius: 11,
                usePointStyle: true,
                boxPadding: 5,
                titleFont: { family: FONT, size: 12.5, weight: '800' },
                bodyFont: { family: FONT, size: 12.5, weight: '700' },
                callbacks: {
                  label: context => context.dataset.yAxisID === 'y1' ? context.dataset.label.replace(' (đ)', '') + ': ' + fmtVnd(context.parsed.y) : context.dataset.label.replace(' (hồ sơ)', '') + ': ' + context.parsed.y + ' hồ sơ',
                  footer: items => { const total = items.filter(item => item.dataset.yAxisID === 'y').reduce((sum, item) => sum + (item.parsed.y || 0), 0); return total ? 'Tổng: ' + total + ' hồ sơ' : ''; }
                }
              }
            },
            scales: {
              x: {
                stacked: !isLine,
                grid: { display: false },
                border: { display: false },
                ticks: {
                  color: muted,
                  padding: 8,
                  maxRotation: view.rotate || 0,
                  minRotation: view.rotate || 0,
                  autoSkip: !view.rotate,
                  font: { family: FONT, size: compact ? 10 : 11, weight: '750' },
                  callback: function(value) {
                    const lbl = this.getLabelForValue(value) || '';
                    return (view.truncate && lbl.length > view.truncate) ? lbl.slice(0, view.truncate - 1) + '…' : lbl;
                  }
                }
              },
              y: {
                stacked: !isLine,
                min: 0,
                max: countMax,
                grid: { color: grid, borderDash: [4, 4] },
                border: { display: false },
                ticks: {
                  precision: 0,
                  maxTicksLimit: 6,
                  color: muted,
                  padding: 8,
                  font: { family: FONT, size: 10.5, weight: '700' },
                  callback: v => v <= peakCount * 1.15 ? v + ' hs' : ''
                }
              },
              y1: {
                position: 'right',
                min: -peakReserve * 1.48,
                max: peakReserve * 1.24,
                grid: { drawOnChartArea: false },
                border: { display: false },
                ticks: { display: false }
              }
            }
          },
          plugins: [labelsPlugin]
        });
        monthlyOpenedChartInstances.push(chart);
      };
      build('monthlyOpenedTimelineCanvas', data.timeline);
      build('monthlyOpenedGaraCanvas', data.gara, { rotate: 28, truncate: 18 });
      build('monthlyOpenedGdvCanvas', data.gdv);
      build('monthlyOpenedStatusCanvas', data.status, { truncate: 16 });
    }
