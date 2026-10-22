

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
        <div style="background: var(--surface); border-radius: 18px; border: 1px solid var(--border-strong); padding: 24px; margin-top: 24px; box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 16px;">
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
          <div id="carBrandChartCardContainer" style="margin-bottom: 24px; background: var(--surface); padding: 22px 26px; border-radius: 20px; border: 1px solid var(--border-strong); box-shadow: var(--shadow-sm);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
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
              <div class="hide-on-screenshot" style="display: flex; gap: 8px;">
                <button type="button" onclick="downloadCarBrandChartImage()" title="Tải ảnh Biểu đồ Ultra HD (4K / 300 DPI)" style="padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border-strong); font-size: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s ease; background: var(--surface); color: var(--text-main); display: flex; align-items: center; gap: 6px;">
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Tải ảnh
                </button>
                <button type="button" onclick="activeCarBrandChartType='bar'; renderGdvMonthlyReportPage();" style="padding: 6px 12px; border-radius: 8px; border: none; font-size: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s ease; ${activeCarBrandChartType === 'bar' ? 'background: var(--primary); color: #111;' : 'background: rgba(216,180,109,0.15); color: var(--primary);'}">Biểu đồ Cột</button>
                <button type="button" onclick="activeCarBrandChartType='pie'; renderGdvMonthlyReportPage();" style="padding: 6px 12px; border-radius: 8px; border: none; font-size: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s ease; ${activeCarBrandChartType === 'pie' ? 'background: var(--primary); color: #111;' : 'background: rgba(216,180,109,0.15); color: var(--primary);'}">Biểu đồ Tròn</button>
              </div>
            </div>
            <div id="carBrandLossCanvasWrap" style="position: relative; height: 400px; width: 100%; transition: height 0.3s ease;">
              <canvas id="carBrandLossCanvas"></canvas>
              <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" onload="if(window.initCarBrandChart) setTimeout(window.initCarBrandChart, 50); this.remove();" style="display:none;" />
            </div>
          </div>
          <div style="overflow-x: auto; border-radius: 12px; border: 1px solid var(--border-strong);">
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
        <div class="p-card" id="dakLakReserveReportCardContainer" style="padding: 28px 32px; border-radius: 20px; box-shadow: var(--shadow-sm); border: 1px solid var(--border-strong); background: var(--surface); min-height: 420px; display: flex; flex-direction: column;">
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
      html2canvas(cardEl, {
        scale: 3.5,
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
          <tr data-ton-gara-group="1" data-ton-gara="${escapeAttributeData(garaName)}" style="background: var(--bg-soft); font-weight: 850; border-bottom: 1px solid var(--border-strong);">
            <td colspan="${activeTonChuaHdReportCols.length + 1}" style="padding: 12px 14px; color: var(--primary); font-size: 13px; text-align: left; background: var(--bg-soft);">
              <span style="display: inline-flex; align-items: center; gap: 8px;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--primary)" stroke-width="2.5" style="flex-shrink: 0;"><path d="M3 21h18"></path><path d="M19 21v-4a2 2 0 0 0-2 2v4"></path><path d="M5 15V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8"></path></svg>
                <span>Gara: <strong style="font-size: 13.5px; color: var(--text-main);">${escapeHtmlOutput(garaName)}</strong> (${claims.length} hồ sơ tồn - Tổng tiền duyệt: <strong style="color: #10b981;">${formatCurrencyInputNumber(totalGaraAmt)} đ</strong>)</span>
              </span>
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
            <tr data-ton-gara="${escapeAttributeData(garaName)}" style="border-bottom: 1px solid var(--border); font-size: 13px;">
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
              <td style="display: ${activeTonChuaHdReportCols.includes('BIEN_SO') ? 'table-cell' : 'none'}; padding: 12px 10px; font-weight: 800;  color: var(--primary); font-size: 13px;">${escapeHtmlOutput(bsx)}</td>
              <td style="display: ${activeTonChuaHdReportCols.includes('CHU_XE') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: left; font-weight: 750;">${escapeHtmlOutput(chuXe)}</td>
              <td style="display: ${activeTonChuaHdReportCols.includes('HANG_XE') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: left;">${escapeHtmlOutput(carBrandModel)}</td>
              <td style="display: ${activeTonChuaHdReportCols.includes('CBXL') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: left;">${escapeHtmlOutput(gdv)}</td>
              <td style="display: ${activeTonChuaHdReportCols.includes('TIEN_DUYET') ? 'table-cell' : 'none'}; padding: 12px 10px; font-weight: 850;  color: #10b981; text-align: right; font-size: 13.5px;">${amtDisplay}</td>
              <td style="display: ${activeTonChuaHdReportCols.includes('NGAY_NHAN_DU') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: center;  font-weight: 750;">${escapeHtmlOutput(ngayNhanDuHoSoStr)}</td>
              <td style="display: ${activeTonChuaHdReportCols.includes('NGAY_CHUYEN_KT') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: center;  font-weight: 750; color: #8b5cf6;">${escapeHtmlOutput(ngayChuyenKtStr)}</td>
              <td style="display: ${activeTonChuaHdReportCols.includes('NGAY_DUYET') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: center;  font-weight: 750;">${escapeHtmlOutput(duyetDateStr)}</td>
              <td style="display: ${activeTonChuaHdReportCols.includes('SO_NGAY_DUYET') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: center;">
                <span class="acc-status-pill" style="padding: 3px 10px; border-radius: 8px; font-size: 11px; ${badgeStyle}">
                  ${typeof daysCount === 'number' ? daysCount + ' ngày' : daysCount}
                </span>
              </td>
            </tr>
          `;
        });
      });

      return `
        <div class="p-card" id="tonChuaHoaDonReportCardContainer" style="padding: 28px 32px; border-radius: 20px; box-shadow: var(--shadow-sm); border: 1px solid var(--border-strong); background: var(--surface); position: relative; min-height: 420px; display: flex; flex-direction: column;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px dashed var(--border);">
            <div style="flex: 1; margin-right: 20px;">
              <h2 style="font-size: 18px; font-weight: 850; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 8px;">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                Danh sách Hồ sơ tồn chưa có hóa đơn (Đã duyệt HSBT)
              </h2>
              
            </div>
            <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
              
              
              <div class="hide-on-screenshot" style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); color: #ef4444; padding: 6px 14px; border-radius: 10px; font-size: 12px; font-weight: 850; white-space: nowrap;">
                Tổng số tồn: ${filtered.length} hồ sơ (Được lọc theo bộ lọc)
              </div>

              <div class="custom-select-wrapper hide-on-screenshot" style="position: relative;">
                <button type="button" class="btn-premium btn-secondary" onclick="toggleCustomDropdownMenu('ddTonColsMenu', event)" style="padding: 0 14px; height: 32px; border-radius: 9px; background: var(--surface); border: 1px solid var(--border-strong); color: var(--text-main); font-size: 12px; font-weight: 850; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: var(--shadow-xs); white-space: nowrap;">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                  <span>Ẩn/Hiện cột</span>
                </button>
                <div id="ddTonColsMenu" class="custom-select-menu" style="display: ${activeOpenDropdownId === 'ddTonColsMenu' ? 'block' : 'none'}; position: absolute; top: calc(100% + 6px); right: 0; min-width: 200px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 14px; box-shadow: 0 16px 36px rgba(0,0,0,0.3); z-index: 999; padding: 10px; text-align: left; -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px);">
                  <div style="display:flex; justify-content:space-between; align-items:center; padding: 0 4px 8px 4px; border-bottom: 1px solid var(--border); margin-bottom: 8px;">
                  <span style="font-size: 11.5px; font-weight: 850; color: var(--text-soft);">TÙY CHỌN HIỂN THỊ CỘT</span>
                  <div style="display:flex; gap:6px;">
                    <button type="button" onclick="setAllWeeklyReportCols(true)" style="border:none; background:rgba(16,185,129,0.12); color:#10b981; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px; cursor:pointer;">Hiện tất cả</button>
                    <button type="button" onclick="setAllWeeklyReportCols(false)" style="border:none; background:rgba(239,68,68,0.12); color:#ef4444; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px; cursor:pointer;">Ẩn tất cả</button>
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
              <button type="button" class="btn-premium hide-on-screenshot" onclick="downloadAllTonChuaHoaDonReportImages()" style="padding: 0 14px; height: 32px; border-radius: 9px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: 1px solid #059669; color: #ffffff; font-size: 12px; font-weight: 850; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(16,185,129,0.22); transition: all 0.2s ease; white-space: nowrap;" title="Tải ảnh danh sách tất cả hồ sơ tồn đã duyệt HSBT của mọi gara, bỏ qua bộ lọc hiện tại.">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                <span>Tải ảnh toàn bộ gara (.zip)</span>
              </button>
              <button type="button" class="btn-premium hide-on-screenshot" onclick="downloadTonChuaHoaDonReportImage('png')" style="padding: 0 14px; height: 32px; border-radius: 9px; background: linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(245,158,11,0.12) 100%); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; font-size: 12px; font-weight: 850; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: var(--shadow-xs); transition: all 0.2s ease; white-space: nowrap;" title="${activeGdvReportGara === 'all' ? 'Xuất ảnh báo cáo cho từng gara, đóng gói ZIP' : 'Tải ảnh báo cáo (PNG/JPG)'}">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                <span>${activeGdvReportGara === 'all' ? 'Tải Ảnh Theo Gara' : 'Tải Ảnh Báo Cáo'}</span>
              </button>
            </div>
          </div>

          <div class="table-container" style="margin-top: 10px;">
            <table class="p-table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: var(--bg-soft); border-bottom: 1px solid var(--border);">
                  <th style="padding: 12px 10px; text-align: center; width: 50px;">STT</th>
                  <th style="display: ${activeTonChuaHdReportCols.includes('SO_HSBT') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: left; width: 220px;">Số HSBT</th>
                  <th style="display: ${activeTonChuaHdReportCols.includes('BIEN_SO') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: left; width: 130px;">Biển số xe</th>
                  <th style="display: ${activeTonChuaHdReportCols.includes('CHU_XE') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: left;">Chủ xe / Khách hàng</th>
                  <th style="display: ${activeTonChuaHdReportCols.includes('HANG_XE') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: left; width: 180px;">Hãng / Hiệu xe</th>
                  <th style="display: ${activeTonChuaHdReportCols.includes('CBXL') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: left; width: 180px;">Cán bộ xử lý (CBXL)</th>
                  <th style="display: ${activeTonChuaHdReportCols.includes('TIEN_DUYET') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: right; width: 160px;">Tiền duyệt HSBT</th>
                  <th style="display: ${activeTonChuaHdReportCols.includes('NGAY_NHAN_DU') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: center; width: 140px;">Ngày nhận đủ hồ sơ</th>
                  <th style="display: ${activeTonChuaHdReportCols.includes('NGAY_CHUYEN_KT') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: center; width: 140px;">Ngày chuyển HSKT</th>
                  
                  
                  <th style="display: ${activeTonChuaHdReportCols.includes('NGAY_DUYET') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: center; width: 140px;">Ngày duyệt HSBT</th>
                  <th style="display: ${activeTonChuaHdReportCols.includes('SO_NGAY_DUYET') ? 'table-cell' : 'none'}; padding: 12px 10px; text-align: center; width: 140px;">Số ngày đã duyệt</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || `<tr><td colspan="${activeTonChuaHdReportCols.length + 1}" style="padding: 42px; text-align: center; color: var(--text-soft);">Không có hồ sơ tồn chưa có hóa đơn nào phù hợp bộ lọc.</td></tr>`}
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


    function buildTonChuaHoaDonGaraImageOptions(garaName) {
      return {
        scale: 2.6,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        onclone: function(clonedDoc) {
          const target = clonedDoc.getElementById('tonChuaHoaDonReportCardContainer');
          if (!target) return;
          target.style.boxShadow = 'none';
          target.style.transform = 'none';
          target.style.backgroundColor = '#ffffff';
          target.querySelectorAll('[data-ton-gara]').forEach(row => {
            if (row.getAttribute('data-ton-gara') !== garaName) row.style.display = 'none';
          });
        },
        ignoreElements: function(element) {
          return element.classList && element.classList.contains('hide-on-screenshot');
        }
      };
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


    async function downloadTonChuaHoaDonReportImagesByGara(cardEl, imgFormat, ext) {
      if (typeof JSZip === 'undefined') {
        triggerToast('Thư viện ZIP chưa tải xong, vui lòng thử lại sau 2 giây...', 'warning');
        return;
      }

      const garaNames = getTonChuaHoaDonGaraNames(cardEl);
      if (!garaNames.length) {
        triggerToast('Không có gara nào để xuất ảnh.', 'warning');
        return;
      }

      const dateTag = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-');
      const zip = new JSZip();
      const folder = zip.folder(`Anh_Bao_Cao_Ton_Chua_HD_${dateTag}`) || zip;
      const failed = [];
      let exported = 0;

      if (typeof toggleUploadOverlay === 'function') {
        toggleUploadOverlay(true, 'Đang xuất ảnh theo gara', `Chuẩn bị ${garaNames.length} gara...`, 0);
      }

      for (let i = 0; i < garaNames.length; i++) {
        const garaName = garaNames[i];
        try {
          if (typeof toggleUploadOverlay === 'function') {
            toggleUploadOverlay(true, 'Đang xuất ảnh theo gara', `${garaName} (${i + 1}/${garaNames.length})`, Math.round((i / garaNames.length) * 100));
          }
          const canvas = await html2canvas(cardEl, buildTonChuaHoaDonGaraImageOptions(garaName));
          const blob = await canvasToBlob(canvas, imgFormat);
          folder.file(`${String(i + 1).padStart(2, '0')}_${sanitizeTonChuaHoaDonFileName(garaName)}.${ext}`, blob);
          exported++;
          canvas.width = 0;
          canvas.height = 0;
          await new Promise(resolve => setTimeout(resolve, 30));
        } catch (err) {
          console.error('Lỗi xuất ảnh gara:', garaName, err);
          failed.push(garaName);
        }
      }

      if (!exported) {
        if (typeof toggleUploadOverlay === 'function') toggleUploadOverlay(false);
        triggerToast('Không xuất được ảnh gara nào. Vui lòng thử lại.', 'error');
        return;
      }

      if (typeof toggleUploadOverlay === 'function') {
        toggleUploadOverlay(true, 'Đang đóng gói ZIP', `Đã xuất ${exported}/${garaNames.length} ảnh...`, 100);
      }

      try {
        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 3 } });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Anh_Bao_Cao_Ton_Chua_HD_Theo_Gara_${dateTag}.zip`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 15000);
        triggerToast(failed.length ? `Đã xuất ${exported} ảnh, ${failed.length} gara lỗi.` : `Đã xuất ${exported} ảnh báo cáo theo gara!`, failed.length ? 'warning' : 'success');
      } catch (err) {
        console.error(err);
        triggerToast('Lỗi khi đóng gói ZIP: ' + err.message, 'error');
      } finally {
        if (typeof toggleUploadOverlay === 'function') toggleUploadOverlay(false);
      }
    }


    async function downloadAllTonChuaHoaDonReportImages() {
      const visibleCard = document.getElementById('tonChuaHoaDonReportCardContainer');
      if (!visibleCard) {
        triggerToast('Không tìm thấy khung báo cáo!', 'error');
        return;
      }
      if (typeof html2canvas === 'undefined') {
        triggerToast('Thư viện tạo ảnh đang tải, vui lòng thử lại sau 2 giây...', 'warning');
        return;
      }
      if (typeof JSZip === 'undefined') {
        triggerToast('Thư viện ZIP chưa tải xong, vui lòng thử lại sau 2 giây...', 'warning');
        return;
      }

      const renderHost = document.createElement('div');
      renderHost.style.cssText = 'position:fixed;left:0;top:0;width:1600px;max-width:none;z-index:-1;pointer-events:none;background:#fff;';
      try {
        visibleCard.id = 'tonChuaHoaDonVisibleReportCardContainer';
        renderHost.innerHTML = renderTonChuaHoaDonReportTableHtml(true);
        document.body.appendChild(renderHost);
        const fullListCard = renderHost.querySelector('#tonChuaHoaDonReportCardContainer');
        if (!fullListCard) {
          triggerToast('Không dựng được danh sách đầy đủ để xuất ảnh.', 'error');
          return;
        }
        await downloadTonChuaHoaDonReportImagesByGara(fullListCard, 'png', 'png');
      } catch (err) {
        console.error('Lỗi chuẩn bị ảnh danh sách tồn theo gara:', err);
        triggerToast('Có lỗi khi chuẩn bị danh sách ảnh toàn bộ gara.', 'error');
      } finally {
        renderHost.remove();
        visibleCard.id = 'tonChuaHoaDonReportCardContainer';
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
          const target = clonedDoc.getElementById('tonChuaHoaDonReportCardContainer');
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
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; margin-bottom: 24px;">
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
        <div class="p-card" id="tndsTonReportCardContainer" style="padding: 28px 32px; border-radius: 20px; box-shadow: var(--shadow-sm); border: 1px solid var(--border-strong); background: var(--surface); min-height: 420px; display: flex; flex-direction: column;">
          
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
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; flex-wrap: wrap; gap: 12px; background: var(--bg-soft); padding: 12px 16px; border-radius: 14px; border: 1px solid var(--border);" class="hide-on-screenshot">
            
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
              <div style="display: flex; align-items: center; gap: 4px; background: var(--surface); padding: 3px; border-radius: 10px; border: 1px solid var(--border-strong);">
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
          <div style="overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 12px; border: 1px solid var(--border);">
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

      html2canvas(cardEl, {
        scale: 3.5,
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
