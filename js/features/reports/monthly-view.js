

    function renderGdvMonthlyReportPage(targetContainer) {

      const container = targetContainer || document.getElementById('tabContentContainer');
      if (!container) return;

      const currentUser = firebase.auth().currentUser;
      if (currentUser && dbNodeInstance) {
        const uid = currentUser.uid;
        if (activeFavoriteFiltersUid !== uid) {
          if (activeFavoriteFiltersUid) {
            dbNodeInstance.ref(`users/${activeFavoriteFiltersUid}/favorite_filters`).off();
          }
          activeFavoriteFiltersUid = uid;
          hasAppliedDefaultFilter = false;
          
          dbNodeInstance.ref(`users/${uid}/favorite_filters`).on('value', (snapshot) => {
            userFavoriteFilters = [];
            const val = snapshot.val();
            if (val) {
              Object.keys(val).forEach(key => {
                userFavoriteFilters.push({
                  id: key,
                  ...val[key]
                });
              });
            }
            
            // Sort by createdAt descending
            userFavoriteFilters.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            
            // Đồng bộ cấu hình cột báo cáo đã lưu của tài khoản
            dbNodeInstance.ref(`users/${uid}/settings/weeklyReportCols`).once('value', (cSnap) => {
              if (cSnap.exists()) {
                const savedCols = cSnap.val();
                if (Array.isArray(savedCols) && savedCols.length > 0) {
                  const currentStr = JSON.stringify(activeWeeklyReportCols);
                  const newStr = JSON.stringify(savedCols);
                  if (currentStr !== newStr) {
                    activeWeeklyReportCols = savedCols;
                    try { localStorage.setItem('claimvision-weekly-report-cols', newStr); } catch(e){}
                    if (activeDashboardTab === 'gdv_report') renderGdvMonthlyReportPage(container);
                  }
                }
              }
            });
            
            if (!hasAppliedDefaultFilter) {
              const def = userFavoriteFilters.find(f => f.isDefault && f.filters && f.filters.activeGdvReportView === 'weekly_zone');
              if (def) {
                const f = def.filters;
                activeGdvReportView = 'weekly_zone';
                if (f.activeSelectedGdvNames) activeSelectedGdvNames = f.activeSelectedGdvNames;
                if (f.activeGdvReportStartDate) activeGdvReportStartDate = f.activeGdvReportStartDate;
                if (f.activeGdvReportEndDate) activeGdvReportEndDate = f.activeGdvReportEndDate;
                if (f.activeGdvReportBranch) activeGdvReportBranch = f.activeGdvReportBranch;
                if (f.activeReportClaimType) activeReportClaimType = f.activeReportClaimType;
                hasAppliedDefaultFilter = true;
                if (activeDashboardTab === 'gdv_report') renderGdvMonthlyReportPage(container);
                return;
              }
              hasAppliedDefaultFilter = true;
            }
            
            renderFavFiltersDropdownContent();
          });
        }
      }

      const claimsList = Object.values(cachedPendingClaimsPayload || {});

      // SINGLE PASS O(N) PRE-PROCESSING
      const yearSet = new Set();
      const branchSet = new Set(['all']);
      const parsedClaims = [];

      for (let i = 0; i < claimsList.length; i++) {
        const c = claimsList[i];
        let yr = null;
        let mo = null;
        let t = 0;

        const openDateStr = (c.ngayMoHs || c['Ngày mở hồ sơ'] || c['Ngày mở HS'] || c.ngayTonThat || c.date || '').trim();
        if (openDateStr && openDateStr !== '—' && openDateStr !== '-') {
          const dp = parseDateParts(openDateStr);
          if (dp && dp.year && dp.month) {
            yr = dp.year;
            mo = dp.month;
            t = new Date(dp.year, dp.month - 1, dp.day || 15, 12, 0, 0).getTime();
          }
        }
        if (yr) yearSet.add(yr);

        // Parse approval date for KPI calculation: 'Tờ trình BT - Ngày duyệt cuối (Ngày duyệt HSBT)'
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
        if (duyetYr) yearSet.add(duyetYr);

        const branch = c.donViCapDon || c.chiNhanh || c.chiNhanhXuly;
        if (branch && branch !== '—') branchSet.add(branch);

        parsedClaims.push({
          raw: c,
          year: yr,
          month: mo,
          duyetYear: duyetYr,
          duyetMonth: duyetMo,
          timestamp: t
        });
      }

      const yearList = Array.from(yearSet).filter(Boolean).sort((a, b) => b - a);
      const branchList = Array.from(branchSet);

      const period = getWeeklyZoneReportPeriod();
      const startTime = period.startDate.getTime();
      const endTime = period.endDate.getTime();

      const selectedGdvList = (activeSelectedGdvNames && activeSelectedGdvNames.length > 0)
        ? activeSelectedGdvNames
        : getAllAvailableGdvNames();

      const gdvMap = {};
      selectedGdvList.forEach(name => {
        gdvMap[name] = {
          gdvName: name,
          branch: 'Đắk Lắk',
          totalOpenedCount: 0,
          duyetHsbtCount: 0,
          weightedKpiCount: 0,
          pendingHsbtCount: 0,
          totalApprovedAmount: 0,
          statusMap: {}
        };
      });

      function resolveTargetGdv(rawName) {
        if (!rawName) return null;
        const clean = String(rawName).trim().toLowerCase();
        return selectedGdvList.find(s => s.trim().toLowerCase() === clean || clean.includes(s.trim().toLowerCase())) || null;
      }

      for (let i = 0; i < parsedClaims.length; i++) {
        const item = parsedClaims[i];
        const c = item.raw;

        // 1. Filter by Claim Type
        if (activeReportClaimType !== 'all') {
          const spText = String(c.tnds || c.vcx || c.maSpNghiepVu || c.loaiHinhBaoHiem || c.loaiHs || c.nghiepVu || '').toUpperCase();
          const loaiType = (c.tnds || spText.includes('TNDS')) ? 'TNDS' : 'VCX';
          if (activeReportClaimType !== loaiType) continue;
        }

        // 2. Filter by Branch
        if (activeGdvReportBranch !== 'all') {
          const b = c.donViCapDon || c.chiNhanh || c.chiNhanhXuly || '';
          if (b !== activeGdvReportBranch) continue;
        }

        const rawGdvName = getClaimGdvName(c);
        const targetName = resolveTargetGdv(rawGdvName);

        // Exclude claims that do not belong to the selected GĐVs
        if (!targetName || !gdvMap[targetName]) continue;

        if (activeGdvReportView === 'chart') {
          // Báo cáo KPI & Hiệu suất Giám định:
          // 1. Số HS làm / tiếp nhận: đếm hồ sơ có ngày mở trong kỳ được chọn
          const matchesOpenedYear = activeGdvReportYear === 'all' || item.year === parseInt(activeGdvReportYear, 10);
          const matchesOpenedMonth = activeGdvReportMonth === 'all' || item.month === parseInt(activeGdvReportMonth, 10);
          const isOpenedInPeriod = Boolean(item.year && matchesOpenedYear && matchesOpenedMonth);

          // 2. ĐÃ DUYỆT HSBT: Đếm hồ sơ của từng GĐV theo "Tờ trình BT - Ngày duyệt cuối (Ngày duyệt HSBT)" có ngày nằm trong tháng được chọn
          const matchesDuyetYear = activeGdvReportYear === 'all' || item.duyetYear === parseInt(activeGdvReportYear, 10);
          const matchesDuyetMonth = activeGdvReportMonth === 'all' || item.duyetMonth === parseInt(activeGdvReportMonth, 10);
          const isExcludedStatus = ['tu_choi', 'huy', 'da_huy'].includes(String(c.trangThai || '').toLowerCase().trim());
          const isDuyetHsbtInPeriod = Boolean(item.duyetYear && matchesDuyetYear && matchesDuyetMonth && !isExcludedStatus);

          // Bỏ qua nếu hồ sơ không phát sinh trong kỳ VÀ cũng không được duyệt HSBT trong kỳ
          if (!isOpenedInPeriod && !isDuyetHsbtInPeriod) continue;

          if (isOpenedInPeriod) {
            gdvMap[targetName].totalOpenedCount++;
            const stKey = PENDING_STATUS_MAP[c.trangThai] ? c.trangThai : 'moi';
            gdvMap[targetName].statusMap[stKey] = (gdvMap[targetName].statusMap[stKey] || 0) + 1;
          }

          if (isDuyetHsbtInPeriod) {
            const amtStr = String(c.ttbtTongSoTienBoiThuong || c.tongBoiThuongSauThue || c.soTienDuyetBT || c.pascSoTienDuyet || c.ttbtSoTienBoiThuong || c.amount || c.uocThietHai || '0').replace(/[^0-9]/g, '');
            const amtVal = parseInt(amtStr, 10) || 0;
            gdvMap[targetName].totalApprovedAmount += amtVal;

            // Calculate KPI Coefficient k based on Claim Type & Amount Bracket
            const kpiRules = typeof getStoredKpiCoefConfig === 'function' ? getStoredKpiCoefConfig() : [];
            const spText = String(c.tnds || c.vcx || c.maSpNghiepVu || c.loaiHinhBaoHiem || c.loaiHs || c.nghiepVu || '').toUpperCase();
            const loaiType = (c.tnds || spText.includes('TNDS')) ? 'TNDS' : 'VCX';
            const matchRule = kpiRules.find(r => r.type === loaiType && amtVal >= r.fromAmt && amtVal <= r.toAmt);
            const kCoef = matchRule ? matchRule.coef : 1.0;

            gdvMap[targetName].duyetHsbtCount++;
            gdvMap[targetName].weightedKpiCount += kCoef;
          } else if (isOpenedInPeriod) {
            gdvMap[targetName].pendingHsbtCount++;
          }
        } else {
          // Chỉ tính toán theo số hồ sơ phát sinh trong tháng và số hồ sơ phát sinh đã được duyệt cho các báo cáo khác
          const matchesOpenedYear = activeGdvReportYear === 'all' || item.year === parseInt(activeGdvReportYear, 10);
          const matchesOpenedMonth = activeGdvReportMonth === 'all' || item.month === parseInt(activeGdvReportMonth, 10);
          const isOpenedInPeriod = Boolean(item.year && matchesOpenedYear && matchesOpenedMonth);

          // Bỏ qua nếu không phát sinh trong kỳ được chọn
          if (!isOpenedInPeriod) continue;

          gdvMap[targetName].totalOpenedCount++;
          const stKey = PENDING_STATUS_MAP[c.trangThai] ? c.trangThai : 'moi';
          gdvMap[targetName].statusMap[stKey] = (gdvMap[targetName].statusMap[stKey] || 0) + 1;

          if (isDuyetHsbtApproved(c)) {
            const amtStr = String(c.ttbtTongSoTienBoiThuong || c.pascSoTienDuyet || c.soTienDuyetBT || '0').replace(/[^0-9]/g, '');
            const amtVal = parseInt(amtStr, 10) || 0;
            gdvMap[targetName].totalApprovedAmount += amtVal;

            // Calculate KPI Coefficient k based on Claim Type & Amount Bracket
            const kpiRules = typeof getStoredKpiCoefConfig === 'function' ? getStoredKpiCoefConfig() : [];
            const spText = String(c.tnds || c.vcx || c.maSpNghiepVu || c.loaiHinhBaoHiem || c.loaiHs || c.nghiepVu || '').toUpperCase();
            const loaiType = (c.tnds || spText.includes('TNDS')) ? 'TNDS' : 'VCX';
            const matchRule = kpiRules.find(r => r.type === loaiType && amtVal >= r.fromAmt && amtVal <= r.toAmt);
            const kCoef = matchRule ? matchRule.coef : 1.0;

            gdvMap[targetName].duyetHsbtCount++;
            gdvMap[targetName].weightedKpiCount += kCoef;
          } else {
            gdvMap[targetName].pendingHsbtCount++;
          }
        }
      }

      let gdvRows = Object.values(gdvMap);

      // Filter by search text if user searches
      if (activeGdvReportSearch) {
        gdvRows = gdvRows.filter(r => r.gdvName.toLowerCase().includes(activeGdvReportSearch) || r.branch.toLowerCase().includes(activeGdvReportSearch));
      }

      // Sort GĐVs by KPI Performance (weightedKpiCount -> duyetHsbtCount -> totalOpenedCount) for Leaderboard & Master Table
      const gdvRowsSorted = [...gdvRows].sort((a, b) => {
        const kpiA = Math.round((a.weightedKpiCount || a.duyetHsbtCount) * 10) / 10;
        const kpiB = Math.round((b.weightedKpiCount || b.duyetHsbtCount) * 10) / 10;
        if (kpiB !== kpiA) return kpiB - kpiA;
        if (b.duyetHsbtCount !== a.duyetHsbtCount) return b.duyetHsbtCount - a.duyetHsbtCount;
        return b.totalOpenedCount - a.totalOpenedCount;
      });

      const totalFilteredClaims = gdvRows.reduce((sum, r) => sum + r.totalOpenedCount, 0);
      const totalDuyetHsbtCount = gdvRows.reduce((sum, r) => sum + r.duyetHsbtCount, 0);
      const overallHsbtRate = totalFilteredClaims > 0 ? Math.round((totalDuyetHsbtCount / totalFilteredClaims) * 100) : 0;
      const passKpiCount = gdvRows.filter(r => (r.weightedKpiCount || r.duyetHsbtCount) >= 70).length;
      const kpiMetrics = getGdvKpiProgressMetrics();
      const passProgressCount = gdvRows.filter(r => (r.weightedKpiCount || r.duyetHsbtCount) >= kpiMetrics.progressTarget).length;
      const topGdvObj = gdvRowsSorted[0];
      const topGdvName = topGdvObj ? topGdvObj.gdvName : 'Chưa có';

      const timeLabelText = period.label;

      const top3Performers = gdvRowsSorted.slice(0, 3);

                  // GARAGE CLAIM AGGREGATION (NEW LOGIC)
      const garageMap = {};
      for (let i = 0; i < parsedClaims.length; i++) {
        const item = parsedClaims[i];
        const c = item.raw;

        // 1. Filter by Claim Type
        if (activeReportClaimType !== 'all') {
          const spText = String(c.tnds || c.vcx || c.maSpNghiepVu || c.loaiHinhBaoHiem || c.loaiHs || c.nghiepVu || '').toUpperCase();
          const loaiType = (c.tnds || spText.includes('TNDS')) ? 'TNDS' : 'VCX';
          if (activeReportClaimType !== loaiType) continue;
        }

        // 2. Filter by Branch
        if (activeGdvReportBranch !== 'all') {
          const b = c.donViCapDon || c.chiNhanh || c.chiNhanhXuly || '';
          if (b !== activeGdvReportBranch) continue;
        }

        // 3. Filter by GDV
        const rawGdvName = (c.gdvTiepNhan || c.canBoXuLy || c.gdvHo || '').trim();
        const targetGdvName = resolveTargetGdv(rawGdvName);
        if (!targetGdvName) continue;

        // 4. Condition A (Amount): MUST be approved & Approval Date falls within selected Month & Year
        let isApprovedInPeriod = false;
        if (isDuyetHsbtApproved(c)) {
          const duyetDateStr = c.toTrinhNgayDuyet || c.ngayDuyetHsbt;
          if (duyetDateStr && typeof duyetDateStr === 'string' && duyetDateStr !== '-' && duyetDateStr.trim() !== '') {
            const dp = parseDateParts(duyetDateStr);
            if (dp && dp.year && dp.month) {
              const matchesYear = activeGdvReportYear === 'all' || dp.year === parseInt(activeGdvReportYear, 10);
              const matchesMonth = activeGdvReportMonth === 'all' || dp.month === parseInt(activeGdvReportMonth, 10);
              if (matchesYear && matchesMonth) {
                isApprovedInPeriod = true;
              }
            }
          }
        }

        // 5. Condition B (Count): ALL statuses, 'Ngay mo HS' falls within selected Month & Year
        const matchesOpenedYear = activeGdvReportYear === 'all' || item.year === parseInt(activeGdvReportYear, 10);
        const matchesOpenedMonth = activeGdvReportMonth === 'all' || item.month === parseInt(activeGdvReportMonth, 10);
        const isOpenedInPeriod = matchesOpenedYear && matchesOpenedMonth;

        // If neither condition is met, skip this claim for this garage
        if (!isApprovedInPeriod && !isOpenedInPeriod) continue;

        const rawGaraCode = (c.maGara || c.garageUniqCode || '').trim();
        const rawGaraName = (c.tenGaraVietTat || '').trim();
        if (!rawGaraName) continue;
        const garageKey = rawGaraName || 'Gara chua x�c d?nh';

        const amtStr = String(c.ttbtTongSoTienBoiThuong || '0').replace(/[^0-9]/g, '');
        const amtVal = parseInt(amtStr, 10) || 0;

        if (!garageMap[garageKey]) {
          garageMap[garageKey] = {
            key: garageKey,
            code: rawGaraCode || 'N/A',
            name: rawGaraName || 'Gara chua x�c d?nh',
            totalApprovedAmount: 0,
            totalClaimsCount: 0,
            gdvBreakdown: {}
          };
        }

        if (!garageMap[garageKey].gdvBreakdown[targetGdvName]) {
          garageMap[garageKey].gdvBreakdown[targetGdvName] = { opened: 0, approved: 0, amount: 0 };
        }

        if (isOpenedInPeriod) {
          garageMap[garageKey].totalClaimsCount++;
          garageMap[garageKey].gdvBreakdown[targetGdvName].opened++;
        }

        if (isApprovedInPeriod) {
          garageMap[garageKey].totalApprovedAmount += amtVal;
          garageMap[garageKey].gdvBreakdown[targetGdvName].approved++;
          garageMap[garageKey].gdvBreakdown[targetGdvName].amount += amtVal;
        }
      }

      let garageRows = Object.values(garageMap).sort((a, b) => b.totalApprovedAmount - a.totalApprovedAmount);

      if (activeGdvReportSearch) {
        garageRows = garageRows.filter(g => g.name.toLowerCase().includes(activeGdvReportSearch) || g.code.toLowerCase().includes(activeGdvReportSearch));
      }

      const totalGaragePayout = garageRows.reduce((sum, g) => sum + g.totalApprovedAmount, 0);
      const activeGarageCount = garageRows.length;
      const topGarageObj = garageRows[0] || null;

      cachedCurrentGarageRows = garageRows;
      cachedCurrentGdvKpiRows = gdvRows;

      // GARAGE COMBO BAR + LINE CHART CALCULATIONS (EXPANDED HEIGHT & BOT PADDING FOR ROTATED LABELS)
      const gChartWidth = 980;
      const gChartHeight = 410;
      const gPaddingLeft = 85;
      const gPaddingRight = 65;
      const gPaddingTop = 45;
      const gPaddingBottom = 115;
      const gPlotWidth = gChartWidth - gPaddingLeft - gPaddingRight;
      const gPlotHeight = gChartHeight - gPaddingTop - gPaddingBottom;

      const topGaragesChart = garageRows.slice(0, 20);
      const maxGAmount = Math.max(1, ...topGaragesChart.map(g => g.totalApprovedAmount));
      const maxGClaims = Math.max(1, ...topGaragesChart.map(g => g.totalClaimsCount));

      const stepGX = topGaragesChart.length > 0 ? gPlotWidth / topGaragesChart.length : gPlotWidth;
      const barW = Math.min(32, Math.max(12, stepGX * 0.36));

      const gPoints = topGaragesChart.map((g, idx) => {
        const cx = gPaddingLeft + (idx + 0.5) * stepGX;
        const bHeight = (g.totalApprovedAmount / maxGAmount) * gPlotHeight;
        const bY = gPaddingTop + gPlotHeight - bHeight;
        const lY = gPaddingTop + gPlotHeight - (g.totalClaimsCount / maxGClaims) * gPlotHeight;

        // Default layout: centered
        let amountX = cx;
        let amountY = bY - 6;
        let amountAnchor = 'middle';
        
        let claimsX = cx;
        let claimsY = lY - 8;
        let claimsAnchor = 'middle';

        // Detect vertical proximity (collision)
        // If the top of the bar (bY) and the line dot (lY) are closer than 22 pixels
        if (Math.abs(bY - lY) < 22) {
          amountX = cx - 7;
          amountY = bY - 5;
          amountAnchor = 'end';

          claimsX = cx + 7;
          claimsY = lY - 5;
          claimsAnchor = 'start';
        }

        return {
          ...g,
          cx,
          bY,
          bHeight,
          lY,
          amountX,
          amountY,
          amountAnchor,
          claimsX,
          claimsY,
          claimsAnchor
        };
      });

      const gLinePathStr = gPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.cx.toFixed(1)} ${p.lY.toFixed(1)}`).join(' ');

      const GDV_REPORT_VIEWS_LIST = [
        {
          id: 'weekly_zone',
          title: 'Báo cáo tuần/tháng',
          badge: 'Vùng & GĐV',
          desc: 'Phân bổ theo Vùng & Giám định viên',
          icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`
        },
        {
          id: 'annual_claims_gdv',
          title: 'Phát sinh theo năm',
          badge: 'Năm & GĐV',
          desc: 'Số hồ sơ phát sinh từng tháng theo giám định viên',
          icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="17" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18M8 14h2M14 14h2M8 17h2M14 17h2"></path></svg>`
        },
        {
          id: 'tnds_ton',
          title: 'BC TNDS Tồn',
          badge: 'MỚI',
          desc: 'Hồ sơ TNDS tồn lũy kế & ghi chú',
          icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`
        },
        {
          id: 'table',
          title: 'Báo cáo HS bồi thường',
          badge: 'Chi tiết',
          desc: 'Bảng dữ liệu tổng hợp chi tiết hồ sơ',
          icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`
        },
        {
          id: 'chart',
          title: 'Báo cáo KPI',
          badge: 'Biểu đồ',
          desc: 'Biểu đồ chỉ số hiệu suất & năng suất',
          icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`
        },
        {
          id: 'garage',
          title: 'Báo cáo doanh thu DV gara',
          badge: 'Gara',
          desc: 'Doanh thu & xưởng dịch vụ đối tác',
          icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 21h18"></path><path d="M19 21v-4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v4"></path><path d="M5 15V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8"></path></svg>`
        },
        {
          id: 'daklak_reserve',
          title: `BC Đắk Lắk ${activeDakLakMinReserve === 50000000 ? '> 50tr' : '> 100tr'}`,
          badge: 'Dự phòng cao',
          desc: 'Hồ sơ có mức dự phòng tổn thất lớn',
          icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`
        },
        {
          id: 'ton_chua_hoa_don',
          title: 'BC Tồn chưa HĐ',
          badge: 'Chưa HĐ',
          desc: 'Đã duyệt bồi thường chưa có hóa đơn',
          icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`
        },
        {
          id: 'car_brand_loss',
          title: 'Tổn thất theo hãng xe',
          badge: 'Hãng xe',
          desc: 'Chi phí tổn thất phân bổ theo dòng xe',
          icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>`
        }
      ];

      const currentActiveReportObj = GDV_REPORT_VIEWS_LIST.find(r => r.id === activeGdvReportView) || GDV_REPORT_VIEWS_LIST[0];

      let heroReportTitle = "Báo cáo hồ sơ bồi thường";
      let heroReportSubtitle = `Thống kê tổng hợp tình hình giải quyết hồ sơ bồi thường trong kỳ (<strong style="color: var(--primary);">${timeLabelText}</strong>), phân bổ lượng hồ sơ theo từng trạng thái và đối chiếu KPI.`;

      if (activeGdvReportView === 'weekly_zone') {
        heroReportTitle = "Báo cáo tiến độ tuần/tháng";
        heroReportSubtitle = `Thống kê phân bổ hồ sơ bồi thường theo Vùng và Giám định viên trong kỳ (<strong style="color: var(--primary);">${timeLabelText}</strong>).`;
      } else if (activeGdvReportView === 'annual_claims_gdv') {
        heroReportTitle = "Hồ sơ bồi thường phát sinh theo năm";
        heroReportSubtitle = `Thống kê số hồ sơ phát sinh theo từng tháng, phân bổ theo giám định viên trong năm ${escapeHtmlOutput(activeAnnualClaimsYear)}.`;
      } else if (activeGdvReportView === 'tnds_ton') {
        heroReportTitle = "Báo cáo Quản lý Hồ sơ TNDS Tồn";
        heroReportSubtitle = "Toàn bộ hồ sơ Trách nhiệm Dân sự đang tồn đọng lũy kế • Theo dõi tiến độ ghi chú và lịch sử cập nhật.";
      } else if (activeGdvReportView === 'chart') {
        heroReportTitle = "Báo cáo KPI & Hiệu suất Giám định";
        heroReportSubtitle = `Biểu đồ và chỉ số hiệu suất giải quyết hồ sơ trong kỳ (<strong style="color: var(--primary);">${timeLabelText}</strong>).`;
      } else if (activeGdvReportView === 'garage') {
        heroReportTitle = "Báo cáo Doanh thu Dịch vụ Gara";
        heroReportSubtitle = `Thống kê chi phí sửa chữa và doanh thu các xưởng dịch vụ liên kết trong kỳ (<strong style="color: var(--primary);">${timeLabelText}</strong>).`;
      } else if (activeGdvReportView === 'daklak_reserve') {
        heroReportTitle = `Báo cáo Hồ sơ Đắk Lắk (Dự phòng ${activeDakLakMinReserve === 50000000 ? '> 50 triệu' : '> 100 triệu'})`;
        heroReportSubtitle = "Danh sách hồ sơ bồi thường có mức dự phòng tổn thất lớn tại khu vực Đắk Lắk.";
      } else if (activeGdvReportView === 'ton_chua_hoa_don') {
        heroReportTitle = "Báo cáo Hồ sơ Tồn chưa có Hóa đơn";
        heroReportSubtitle = "Danh sách hồ sơ đã được phê duyệt phương án bồi thường nhưng chưa có hóa đơn.";
      } else if (activeGdvReportView === 'car_brand_loss') {
        heroReportTitle = "Báo cáo Tổn thất theo Hãng xe";
        heroReportSubtitle = "Phân tích số lượng và chi phí tổn thất phân bổ theo các hãng xe.";
      }
      container.innerHTML = `
        <style>
          .gara-premium-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 16px;
          }
          .gara-premium-card {
            background: var(--surface) !important;
            border: 1px solid var(--border) !important;
            border-radius: 16px !important;
            padding: 18px 20px !important;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
            box-shadow: var(--shadow-xs) !important;
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .gara-premium-card:hover {
            transform: translateY(-2.5px) !important;
            border-color: rgba(216,180,109,0.5) !important;
            box-shadow: 0 12px 24px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(216,180,109,0.05) !important;
          }
          .gdv-micro-card {
            background: var(--bg-soft) !important;
            border: 1px solid var(--border) !important;
            border-radius: 12px !important;
            padding: 10px 12px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 10px !important;
            transition: all 0.2s ease !important;
          }
          .gdv-micro-card:hover {
            background: var(--surface) !important;
            border-color: var(--border-strong) !important;
            transform: translateY(-1px) !important;
            box-shadow: var(--shadow-xs) !important;
          }
          .custom-select-menu {
            background: var(--bg-soft) !important;
            opacity: 1 !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }

          /* Report page selector - premium, consistent with the report filter menus */
          #accReportViewSelectorWrapper { flex: 0 0 auto; }

          .report-picker__trigger {
            height: 42px !important;
            min-width: 214px !important;
            max-width: 276px;
            padding: 0 11px 0 9px !important;
            display: inline-flex;
            align-items: center;
            justify-content: space-between;
            gap: 9px;
            appearance: none;
            border: 1px solid var(--border-strong) !important;
            border-radius: 12px !important;
            background: var(--surface-strong) !important;
            color: var(--text-main) !important;
            box-shadow: 0 4px 14px rgba(15, 23, 42, .045), inset 0 1px 0 rgba(255, 255, 255, .72) !important;
            cursor: pointer;
            font-family: inherit;
            transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
          }
          .report-picker__trigger:hover,
          .report-picker__trigger:focus-visible,
          .report-picker__trigger.is-open {
            border-color: rgba(201, 154, 67, .58) !important;
            box-shadow: 0 8px 22px rgba(15, 23, 42, .08), 0 0 0 3px rgba(201, 154, 67, .08) !important;
            transform: translateY(-1px);
            outline: none;
          }
          .report-picker__trigger.is-open { transform: none; }
          body:not(.light-mode) .report-picker__trigger:not(:hover):not(:focus-visible):not(.is-open) {
            border-color: rgba(216, 180, 109, .22) !important;
            box-shadow: 0 4px 14px rgba(0, 0, 0, .28), inset 0 1px 0 rgba(255, 255, 255, .06) !important;
          }
          body:not(.light-mode) .report-picker__trigger-icon,
          body:not(.light-mode) .report-picker__item-icon { color: var(--primary); }
          body:not(.light-mode) .report-picker__item-badge {
            color: #e7c684;
            border-color: rgba(216, 180, 109, .22);
            background: rgba(216, 180, 109, .12);
          }
          body:not(.light-mode) .report-picker__item-badge.is-new { color: #4a3409; }
          .report-picker__trigger-main { display: flex; align-items: center; gap: 9px; min-width: 0; }
          .report-picker__trigger-icon {
            width: 30px;
            height: 30px;
            flex: 0 0 30px;
            display: grid;
            place-items: center;
            color: #a97928;
            border: 1px solid rgba(201, 154, 67, .22);
            border-radius: 9px;
            background: rgba(201, 154, 67, .10);
          }
          .report-picker__trigger-label {
            min-width: 0;
            overflow: hidden;
            color: var(--text-main);
            font-size: 12.5px;
            font-weight: 850;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .report-picker__trigger-badge {
            flex: 0 0 auto;
            padding: 2px 6px;
            color: #6f4a0c;
            border: 1px solid rgba(179, 140, 67, .28);
            border-radius: 999px;
            background: linear-gradient(135deg, #f7dfa8, #e8bf72);
            font-size: 9px;
            font-weight: 900;
            letter-spacing: .04em;
          }
          .report-picker__chevron {
            width: 15px;
            height: 15px;
            flex: 0 0 15px;
            color: var(--text-soft);
            transition: transform .18s ease;
          }
          .report-picker__trigger.is-open .report-picker__chevron { transform: rotate(180deg); }

          .report-picker__menu {
            position: absolute;
            top: calc(100% + 10px);
            right: 0;
            z-index: 10000;
            width: min(392px, calc(100vw - 24px));
            overflow: hidden;
            padding: 0;
            border: 1px solid rgba(201, 154, 67, .30);
            border-radius: 18px;
            background: var(--surface-strong) !important;
            box-shadow: 0 18px 44px rgba(15, 23, 42, .16), 0 2px 8px rgba(15, 23, 42, .05), inset 0 1px 0 rgba(255, 255, 255, .74);
            transform-origin: top right;
            animation: reportPickerIn .17s cubic-bezier(.2, .8, .2, 1);
          }
          body:not(.light-mode) .report-picker__menu {
            border-color: rgba(216, 180, 109, .28);
            box-shadow: 0 28px 70px rgba(0, 0, 0, .55), 0 3px 10px rgba(0, 0, 0, .28), inset 0 1px 0 rgba(255, 255, 255, .05);
          }
          @keyframes reportPickerIn {
            from { opacity: 0; transform: translateY(-6px) scale(.985); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes reportPickerInMobile {
            from { opacity: 0; transform: translate(-50%, -6px) scale(.985); }
            to { opacity: 1; transform: translate(-50%, 0) scale(1); }
          }
          @media (prefers-reduced-motion: reduce) {
            .report-picker__menu { animation: none; }
          }

          .report-picker__head { padding: 13px 14px !important; }
          body:not(.light-mode) .report-picker__head {
            background: linear-gradient(135deg, rgba(216, 180, 109, .14), rgba(216, 180, 109, .02));
          }
          .report-picker__head .report-filter-menu-head__title { font-size: 10.5px; letter-spacing: .075em; }
          .report-picker__head .report-filter-menu-head__meta { font-size: 10px; }
          .report-picker__head-copy { min-width: 0; }
          .report-picker__count {
            flex: 0 0 auto;
            margin-left: auto;
            padding: 4px 8px;
            color: #92651d;
            border: 1px solid rgba(201, 154, 67, .18);
            border-radius: 999px;
            background: rgba(201, 154, 67, .12);
            font-size: 9.5px;
            font-weight: 900;
            letter-spacing: .06em;
            text-transform: uppercase;
            white-space: nowrap;
          }
          body:not(.light-mode) .report-picker__count { color: #e7c684; }

          .report-picker__body {
            max-height: 378px;
            max-height: min(378px, calc(100dvh - 250px));
            overflow-y: auto;
            overscroll-behavior: contain;
            padding: 7px;
            scrollbar-width: thin;
            scrollbar-color: rgba(201, 154, 67, .42) transparent;
          }
          .report-picker__body::-webkit-scrollbar { width: 6px; }
          .report-picker__body::-webkit-scrollbar-track { background: transparent; }
          .report-picker__body::-webkit-scrollbar-thumb { background: rgba(201, 154, 67, .38); border-radius: 99px; }
          .report-picker__body::-webkit-scrollbar-thumb:hover { background: rgba(201, 154, 67, .60); }

          .report-picker__item {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 22px;
            align-items: center;
            gap: 10px;
            min-height: 58px;
            padding: 8px 9px;
            border: 1px solid transparent;
            border-radius: 11px;
            cursor: pointer;
            text-align: left;
            transition: background .16s ease, border-color .16s ease, transform .16s ease, box-shadow .16s ease;
          }
          .report-picker__item + .report-picker__item { margin-top: 3px; }
          .report-picker__item:hover,
          .report-picker__item:focus-visible {
            border-color: var(--border);
            background: var(--surface-hover);
            transform: translateX(2px);
            outline: none;
          }
          .report-picker__item.is-active {
            border-color: rgba(201, 154, 67, .38);
            background: linear-gradient(105deg, rgba(201, 154, 67, .18), rgba(201, 154, 67, .05));
            box-shadow: inset 3px 0 0 var(--primary);
          }
          .report-picker__item.is-active:hover { transform: none; }

          .report-picker__item-main { display: flex; align-items: flex-start; gap: 10px; min-width: 0; }
          .report-picker__item-icon {
            width: 34px;
            height: 34px;
            flex: 0 0 34px;
            display: grid;
            place-items: center;
            color: #a97928;
            border: 1px solid rgba(201, 154, 67, .18);
            border-radius: 9px;
            background: rgba(201, 154, 67, .08);
          }
          .report-picker__item.is-active .report-picker__item-icon {
            color: #171209;
            border-color: transparent;
            background: var(--primary-gradient);
            box-shadow: 0 5px 12px rgba(201, 154, 67, .22);
          }
          .report-picker__item-copy { min-width: 0; padding-top: 1px; }
          .report-picker__item-title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 6px; }
          .report-picker__item-title { color: var(--text-main); font-size: 12.5px; font-weight: 800; line-height: 1.35; }
          .report-picker__item.is-active .report-picker__item-title { color: #8a5f18; }
          body:not(.light-mode) .report-picker__item.is-active .report-picker__item-title { color: #e7c684; }
          .report-picker__item-badge {
            flex: 0 0 auto;
            padding: 1px 6px;
            color: #92651d;
            border: 1px solid rgba(201, 154, 67, .16);
            border-radius: 999px;
            background: rgba(201, 154, 67, .12);
            font-size: 9px;
            font-weight: 900;
            line-height: 1.5;
          }
          .report-picker__item-badge.is-new {
            color: #4a3409;
            border-color: rgba(179, 140, 67, .38);
            background: linear-gradient(135deg, #f6d98d, #e8b955);
          }
          .report-picker__item-desc {
            margin-top: 2px;
            overflow: hidden;
            color: var(--text-soft);
            font-size: 11px;
            line-height: 1.4;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .report-picker__item-chevron { width: 14px; height: 14px; color: var(--text-soft); opacity: .45; justify-self: center; }
          .report-picker__item.is-active .report-picker__item-chevron { opacity: 0; }
          .report-picker__item-check {
            width: 22px;
            height: 22px;
            display: grid;
            place-items: center;
            justify-self: center;
            color: #171209;
            border-radius: 50%;
            background: var(--primary);
            box-shadow: 0 3px 9px rgba(201, 154, 67, .25);
          }
          @media (max-width: 600px) {
            #accReportViewSelectorWrapper { flex: 1 1 100%; width: 100%; }
            .report-picker__trigger { width: 100%; max-width: none; min-width: 0 !important; }
            .report-picker__menu {
              position: fixed;
              left: 50%;
              right: auto;
              top: var(--report-picker-top, 96px);
              width: min(392px, calc(100vw - 24px));
              max-height: calc(100vh - var(--report-picker-top, 96px) - 12px);
              max-height: calc(100dvh - var(--report-picker-top, 96px) - 12px);
              transform: translateX(-50%);
              transform-origin: top center;
              animation-name: reportPickerInMobile;
            }
            .report-picker__body {
              max-height: min(378px, calc(100vh - var(--report-picker-top, 96px) - 70px));
              max-height: min(378px, calc(100dvh - var(--report-picker-top, 96px) - 70px));
            }
            .report-picker__item { min-height: 56px; }
          }
          @media (max-width: 720px) {
            .gdv-report-hero-actions .btn-premium { min-width: 0 !important; }
            .report-picker__trigger { width: 100%; max-width: none; min-width: 0 !important; }
          }

          /* Premium executive report system */
          .gdv-report-premium-shell {
            --report-gold: #c99a43;
            --report-gold-soft: rgba(201,154,67,.13);
            --report-navy: #111827;
            position: relative;
          }
          .gdv-report-premium-shell::before {
            content: none;
          }
          .gdv-report-premium-shell > * { position: relative; }

          .gdv-report-command-center {
            position: relative;
            margin-bottom: 24px;
            border: 1px solid rgba(184,137,53,.40);
            border-radius: 26px;
            background: var(--surface-strong);
            box-shadow: 0 7px 20px rgba(92,66,25,.045), inset 0 1px 0 rgba(255,255,255,.76);
          }
          .gdv-report-command-center::after {
            content: '';
            position: absolute;
            left: 34px;
            right: 34px;
            bottom: -1px;
            height: 2px;
            border-radius: 99px;
            background: linear-gradient(90deg, transparent, rgba(201,154,67,.58), transparent);
            pointer-events: none;
          }

          .gdv-report-hero-premium {
            overflow: visible !important;
            padding: 28px 30px !important;
            margin-bottom: 0 !important;
            border: 0 !important;
            border-radius: 25px 25px 0 0 !important;
            background:
              radial-gradient(circle at 7% -10%, rgba(201,154,67,.18), transparent 35%),
              radial-gradient(circle at 82% 0%, rgba(216,180,109,.14), transparent 28%),
              linear-gradient(125deg, #fffdf8 0%, #fbf7ef 52%, #f5eee1 100%) !important;
            box-shadow: inset 0 1px 0 rgba(255,255,255,.92), inset 0 -1px 0 rgba(201,154,67,.10) !important;
          }
          .gdv-report-hero-premium::after {
            content: '';
            position: absolute;
            left: 30px;
            right: 30px;
            bottom: 0;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(184,137,53,.62), transparent);
            pointer-events: none;
          }
          .gdv-report-hero-premium h1 { color: #20242c !important; font-size: 30px !important; letter-spacing: -.035em !important; }
          .gdv-report-hero-premium p { color: #677084 !important; }
          .gdv-report-hero-premium p strong { color: #a97928 !important; }
          .gdv-report-hero-premium > div > div:first-child > div:first-child {
            color: #a97928 !important;
            border-color: rgba(184,137,53,.30) !important;
            background: rgba(201,154,67,.095) !important;
            box-shadow: inset 0 1px 0 rgba(255,255,255,.72);
          }
          .gdv-report-hero-premium .btn-premium:not([style*="#10b981"]) {
            color: #303640 !important;
            border-color: rgba(184,137,53,.26) !important;
            background: rgba(255,255,255,.72) !important;
            box-shadow: 0 5px 16px rgba(92,66,25,.065), inset 0 1px 0 rgba(255,255,255,.90) !important;
          }
          .gdv-report-hero-premium .btn-premium:not([style*="#10b981"]):hover {
            border-color: rgba(169,121,40,.52) !important;
            background: rgba(201,154,67,.12) !important;
            box-shadow: 0 8px 20px rgba(92,66,25,.10), 0 0 0 3px rgba(201,154,67,.07) !important;
            transform: translateY(-1px);
          }
          .gdv-report-hero-premium .btn-premium span { color: inherit !important; }
          [data-theme="dark"] .gdv-report-hero-premium {
            background:
              radial-gradient(circle at 8% -10%, rgba(216,180,109,.17), transparent 35%),
              radial-gradient(circle at 84% 0%, rgba(201,154,67,.12), transparent 28%),
              linear-gradient(125deg, #241f17 0%, #1d1c19 54%, #17191d 100%) !important;
          }
          [data-theme="dark"] .gdv-report-hero-premium h1 { color: #f8fafc !important; }
          [data-theme="dark"] .gdv-report-hero-premium p { color: #aeb6c5 !important; }
          [data-theme="dark"] .gdv-report-hero-premium p strong { color: #e4bd6d !important; }
          [data-theme="dark"] .gdv-report-hero-premium .btn-premium:not([style*="#10b981"]) {
            color: #f1f5f9 !important;
            border-color: rgba(216,180,109,.24) !important;
            background: rgba(255,255,255,.055) !important;
            box-shadow: inset 0 1px 0 rgba(255,255,255,.07) !important;
          }

          .gdv-report-hero-actions {
            display: flex !important;
            flex-direction: row !important;
            flex-wrap: wrap;
            align-items: center !important;
            justify-content: flex-end;
            gap: 10px !important;
            max-width: 650px;
          }
          .gdv-report-hero-actions > div {
            display: flex !important;
            align-items: center !important;
            justify-content: flex-end !important;
            gap: 10px !important;
          }
          .gdv-report-hero-actions > div:last-child { order: -1; }

          .gdv-report-filter-hub {
            position: relative;
            display: flex !important;
            flex-wrap: nowrap !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 10px !important;
            margin-bottom: 0 !important;
            padding: 17px 18px !important;
            border: 0 !important;
            border-top: 1px solid rgba(201,154,67,.22) !important;
            border-radius: 0 0 25px 25px !important;
            background: linear-gradient(180deg, var(--surface-strong), var(--surface)) !important;
            box-shadow: inset 0 1px 0 rgba(255,255,255,.62) !important;
          }
          .gdv-report-filter-controls {
            flex: 1 1 auto;
            min-width: 0;
            flex-wrap: nowrap !important;
            gap: 8px !important;
          }
          .gdv-report-time-label { padding-left: 12px !important; padding-right: 12px !important; white-space: nowrap; }
          .gdv-report-filter-hub #accGdvReportFilterWrapper .custom-select-trigger { min-width: 170px !important; padding-left: 12px !important; padding-right: 12px !important; }
          .gdv-report-filter-hub #accReportClaimTypeFilterWrapper .custom-select-trigger { min-width: 150px !important; padding-left: 12px !important; padding-right: 12px !important; }
          .gdv-report-filter-hub button[onclick*="ddReportBranchMenu"] { min-width: 200px !important; padding-left: 12px !important; padding-right: 12px !important; }
          .gdv-report-date-actions { flex-wrap: nowrap !important; gap: 8px !important; }
          .gdv-report-date-field { gap: 6px !important; padding-left: 10px !important; padding-right: 10px !important; white-space: nowrap; }
          .gdv-report-date-picker-shell { position: relative; display: flex; align-items: center; gap: 8px; }
          .report-date-trigger {
            min-width: 218px;
            height: 44px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 0 11px;
            color: var(--text-main);
            border: 1px solid rgba(201,154,67,.28);
            border-radius: 12px;
            background: linear-gradient(180deg, var(--surface-strong), var(--surface));
            box-shadow: 0 5px 16px rgba(15,23,42,.05), inset 0 1px 0 rgba(255,255,255,.72);
            cursor: pointer;
            transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
          }
          .report-date-trigger:hover,
          .report-date-trigger.is-open {
            border-color: rgba(201,154,67,.60);
            box-shadow: 0 8px 22px rgba(15,23,42,.09), 0 0 0 3px rgba(201,154,67,.075);
            transform: translateY(-1px);
          }
          .report-date-trigger__icon {
            width: 28px;
            height: 28px;
            display: grid;
            place-items: center;
            flex: 0 0 28px;
            color: #a97928;
            border: 1px solid rgba(201,154,67,.22);
            border-radius: 8px;
            background: rgba(201,154,67,.09);
          }
          .report-date-trigger__content { min-width: 0; flex: 1; text-align: left; }
          .report-date-trigger__label { display: block; color: var(--text-muted); font-size: 9px; font-weight: 850; letter-spacing: .055em; text-transform: uppercase; }
          .report-date-trigger__value { display: block; margin-top: 1px; color: var(--text-main); font-size: 12.5px; font-weight: 850; }
          .report-date-picker-panel {
            position: absolute;
            top: calc(100% + 10px);
            right: 0;
            z-index: 10020;
            width: 390px;
            overflow: hidden;
            border: 1px solid rgba(201,154,67,.32);
            border-radius: 20px;
            background: var(--surface-strong);
            box-shadow: 0 28px 70px rgba(15,23,42,.25), inset 0 1px 0 rgba(255,255,255,.76);
          }
          .report-date-picker__hero {
            padding: 15px 16px 13px;
            color: #f8fafc;
            background: radial-gradient(circle at 92% 0%, rgba(59,130,246,.20), transparent 35%), linear-gradient(125deg, #101827, #1b263b);
          }
          .report-date-picker__title { display: flex; align-items: center; gap: 10px; font-size: 12px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; }
          .report-date-picker__title-icon { width: 31px; height: 31px; display: grid; place-items: center; color: #f1ce82; border: 1px solid rgba(241,206,130,.28); border-radius: 9px; background: rgba(241,206,130,.09); }
          .report-date-picker__summary { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; margin-top: 13px; }
          .report-date-summary {
            min-width: 0;
            padding: 8px 10px;
            text-align: left;
            color: #e6edf7;
            border: 1px solid rgba(255,255,255,.12);
            border-radius: 10px;
            background: rgba(255,255,255,.065);
            cursor: pointer;
          }
          .report-date-summary.is-active { color: #f1ce82; border-color: rgba(241,206,130,.42); background: rgba(241,206,130,.11); }
          .report-date-summary small { display: block; color: #9ba8ba; font-size: 8.5px; font-weight: 850; letter-spacing: .06em; text-transform: uppercase; }
          .report-date-summary strong { display: block; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
          .report-date-picker__arrow { color: #738198; }
          .report-date-picker__body { padding: 14px 16px 12px; }
          .report-date-picker__nav { display: grid; grid-template-columns: 36px 1fr 36px; align-items: center; gap: 8px; }
          .report-date-picker__nav-btn { width: 36px; height: 34px; display: grid; place-items: center; color: var(--text-main); border: 1px solid var(--border); border-radius: 9px; background: var(--surface-soft); cursor: pointer; }
          .report-date-picker__nav-btn:hover { color: #a97928; border-color: rgba(201,154,67,.42); background: rgba(201,154,67,.09); }
          .report-date-picker__month { text-align: center; color: var(--text-main); font-size: 13px; font-weight: 900; text-transform: capitalize; }
          .report-date-picker__weekdays,
          .report-date-picker__days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
          .report-date-picker__weekdays { margin-top: 13px; }
          .report-date-picker__weekday { padding: 4px 0; text-align: center; color: var(--text-muted); font-size: 9px; font-weight: 900; text-transform: uppercase; }
          .report-date-day {
            position: relative;
            height: 37px;
            display: grid;
            place-items: center;
            color: var(--text-main);
            border: 1px solid transparent;
            border-radius: 10px;
            background: transparent;
            font-size: 11.5px;
            font-weight: 750;
            cursor: pointer;
          }
          .report-date-day:hover { color: #92651d; border-color: rgba(201,154,67,.30); background: rgba(201,154,67,.09); }
          .report-date-day.is-outside { color: var(--text-muted); opacity: .48; }
          .report-date-day.is-today::after { content: ''; position: absolute; bottom: 4px; width: 4px; height: 4px; border-radius: 50%; background: #3b82f6; }
          .report-date-day.is-in-range { color: #8b641f; border-radius: 7px; background: rgba(201,154,67,.09); }
          .report-date-day.is-selected { color: #fff; border-color: #a97928; background: linear-gradient(135deg, #d2a653, #a97928); box-shadow: 0 5px 13px rgba(169,121,40,.28); }
          .report-date-picker__presets { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; margin-top: 12px; padding-top: 11px; border-top: 1px solid var(--border); }
          .report-date-preset { min-height: 31px; color: var(--text-soft); border: 1px solid var(--border); border-radius: 9px; background: var(--surface-soft); font-size: 10.5px; font-weight: 800; cursor: pointer; }
          .report-date-preset:hover { color: #92651d; border-color: rgba(201,154,67,.38); background: rgba(201,154,67,.08); }
          .report-date-picker__footer { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 11px 16px 14px; border-top: 1px solid var(--border); background: var(--surface-soft); }
          .report-date-picker__cancel,
          .report-date-picker__apply { min-height: 34px; padding: 0 14px; border-radius: 9px; font-size: 11.5px; font-weight: 850; cursor: pointer; }
          .report-date-picker__cancel { color: var(--text-soft); border: 1px solid var(--border); background: var(--surface-strong); }
          .report-date-picker__apply { color: #fff; border: 0; background: linear-gradient(135deg, #3b82f6, #1d4ed8); box-shadow: 0 5px 14px rgba(59,130,246,.28); }
          .gdv-report-date-actions > button { padding-left: 16px !important; padding-right: 16px !important; white-space: nowrap; }
          .report-filter-select-trigger {
            min-height: 44px !important;
            color: var(--text-main) !important;
            border: 1px solid rgba(201,154,67,.30) !important;
            border-radius: 12px !important;
            background: linear-gradient(180deg, var(--surface-strong), var(--surface)) !important;
            box-shadow: 0 5px 16px rgba(15,23,42,.055), inset 0 1px 0 rgba(255,255,255,.74) !important;
            transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease !important;
          }
          .report-filter-select-trigger:hover,
          .report-filter-select-trigger.is-open {
            border-color: rgba(201,154,67,.60) !important;
            box-shadow: 0 8px 22px rgba(15,23,42,.09), 0 0 0 3px rgba(201,154,67,.075) !important;
            transform: translateY(-1px);
          }
          .report-filter-select-trigger > span:first-child { min-width: 0; }
          .report-filter-select-trigger > span:first-child > svg {
            width: 27px !important;
            height: 27px !important;
            flex: 0 0 27px;
            padding: 6px;
            color: #a97928 !important;
            border: 1px solid rgba(201,154,67,.22);
            border-radius: 8px;
            background: rgba(201,154,67,.09);
          }
          .report-filter-select-trigger > svg:last-child { transition: transform .18s ease; }
          .report-filter-select-trigger.is-open > svg:last-child { transform: rotate(180deg); }
          .report-filter-select-menu {
            overflow: hidden;
            padding: 0 !important;
            border: 1px solid rgba(201,154,67,.30) !important;
            border-radius: 17px !important;
            background: var(--surface-strong) !important;
            box-shadow: 0 24px 60px rgba(15,23,42,.22), inset 0 1px 0 rgba(255,255,255,.74) !important;
            -webkit-backdrop-filter: blur(22px);
            backdrop-filter: blur(22px);
          }
          .report-filter-menu-head {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 13px 14px;
            border-bottom: 1px solid var(--border);
            background: linear-gradient(135deg, rgba(201,154,67,.12), rgba(59,130,246,.04));
          }
          .report-filter-menu-head__icon {
            width: 32px;
            height: 32px;
            display: grid;
            place-items: center;
            flex: 0 0 32px;
            color: #a97928;
            border: 1px solid rgba(201,154,67,.24);
            border-radius: 9px;
            background: rgba(201,154,67,.10);
          }
          .report-filter-menu-head__title { color: var(--text-main); font-size: 11.5px; font-weight: 900; letter-spacing: .055em; text-transform: uppercase; }
          .report-filter-menu-head__meta { margin-top: 2px; color: var(--text-muted); font-size: 10px; font-weight: 700; }
          .report-filter-menu-body { max-height: 310px; overflow-y: auto; padding: 7px; scrollbar-width: thin; scrollbar-color: rgba(201,154,67,.42) transparent; }
          .report-filter-select-item {
            min-height: 42px;
            margin: 2px 0;
            padding: 8px 10px !important;
            color: var(--text-main) !important;
            border: 1px solid transparent;
            border-radius: 10px !important;
            background: transparent !important;
            font-size: 12.5px !important;
            font-weight: 760 !important;
            transition: transform .15s ease, border-color .15s ease, background .15s ease;
          }
          .report-filter-select-item:hover { transform: translateX(2px); border-color: var(--border); background: var(--surface-soft) !important; }
          .report-filter-select-item.active {
            color: #92651d !important;
            border-color: rgba(201,154,67,.22) !important;
            background: rgba(201,154,67,.10) !important;
            font-weight: 850 !important;
          }
          .report-filter-select-item.active svg { stroke: #a97928 !important; }
          .report-filter-gdv-menu { width: 320px; min-width: 320px !important; max-height: none !important; overflow: hidden !important; }
          .report-filter-claim-menu { width: 270px; min-width: 270px !important; }
          .report-filter-branch-menu { width: 310px; min-width: 310px !important; max-height: none !important; overflow: hidden !important; }
          .report-filter-gdv-toolbar {
            display: grid !important;
            grid-template-columns: 1fr auto auto;
            gap: 6px !important;
            margin: 0 !important;
            padding: 9px 10px !important;
            border-bottom: 1px solid var(--border) !important;
            background: var(--surface-soft);
          }
          .report-filter-gdv-toolbar > div { display: contents !important; }
          .report-filter-mini-action {
            min-height: 30px;
            padding: 0 9px !important;
            border-radius: 8px !important;
            font-size: 10.5px !important;
            font-weight: 850 !important;
            white-space: nowrap;
          }
          .report-filter-check-list { gap: 3px !important; max-height: 265px; overflow-y: auto; padding: 7px; scrollbar-width: thin; scrollbar-color: rgba(201,154,67,.42) transparent; }
          .report-filter-check-item {
            min-height: 42px;
            padding: 7px 9px !important;
            color: var(--text-main) !important;
            border: 1px solid transparent;
            border-radius: 10px !important;
            background: transparent !important;
            transition: transform .15s ease, background .15s ease, border-color .15s ease !important;
          }
          .report-filter-check-item:hover { transform: translateX(2px); border-color: var(--border); background: var(--surface-soft) !important; }
          .report-filter-check-item.is-selected { color: #92651d !important; border-color: rgba(201,154,67,.22); background: rgba(201,154,67,.10) !important; }
          .report-filter-check-item input { width: 17px !important; height: 17px !important; accent-color: #b7832d !important; }
          .report-filter-default-badge { padding: 2px 6px !important; color: #92651d !important; border: 1px solid rgba(201,154,67,.20); border-radius: 999px !important; background: rgba(201,154,67,.10) !important; }
          .report-filter-utility-slot {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            min-width: 155px;
          }
          .report-filter-utility-slot #accReportFavFiltersWrapper > button {
            min-width: 155px;
            height: 44px !important;
            color: var(--text-main) !important;
            border-color: rgba(201,154,67,.34) !important;
            background: rgba(201,154,67,.08) !important;
            box-shadow: 0 4px 14px rgba(15,23,42,.045), inset 0 1px 0 rgba(255,255,255,.72) !important;
          }
          .report-filter-utility-slot #accReportFavFiltersWrapper > button:hover {
            border-color: rgba(201,154,67,.60) !important;
            background: rgba(201,154,67,.14) !important;
          }
          .gdv-report-filter-hub::before {
            content: '';
            position: absolute;
            left: 32px;
            right: 32px;
            top: -1px;
            height: 1px;
            border-radius: 99px;
            background: linear-gradient(90deg, transparent, rgba(241,206,130,.58), transparent);
          }
          .gdv-report-filter-hub .custom-select-trigger,
          .gdv-report-filter-hub input[type="date"] {
            min-height: 44px !important;
            border-radius: 13px !important;
            border-color: color-mix(in srgb, var(--border-strong) 86%, var(--report-gold)) !important;
            background: var(--surface-strong) !important;
            box-shadow: 0 4px 14px rgba(15,23,42,.045), inset 0 1px 0 rgba(255,255,255,.72) !important;
          }
          .gdv-report-filter-hub .custom-select-trigger:hover,
          .gdv-report-filter-hub input[type="date"]:hover {
            border-color: rgba(201,154,67,.52) !important;
            box-shadow: 0 7px 18px rgba(15,23,42,.07), 0 0 0 3px rgba(201,154,67,.07) !important;
          }

          .weekly-report-kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 12px;
            margin: 0 0 14px;
          }
          .weekly-report-kpi {
            position: relative;
            overflow: hidden;
            min-height: 96px;
            padding: 13px 15px;
            border: 1px solid var(--border);
            border-radius: 16px;
            background: linear-gradient(145deg, var(--surface-strong), color-mix(in srgb, var(--surface-strong) 94%, var(--kpi-color) 6%));
            box-shadow: 0 8px 24px rgba(15,23,42,.06), inset 0 1px 0 rgba(255,255,255,.72);
          }
          .weekly-report-kpi::after {
            content: '';
            position: absolute;
            width: 74px;
            height: 74px;
            right: -30px;
            bottom: -37px;
            border-radius: 50%;
            background: var(--kpi-color);
            opacity: .11;
          }
          .weekly-report-kpi__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
          .weekly-report-kpi__label { color: var(--text-muted); font-size: 10px; font-weight: 850; letter-spacing: .07em; text-transform: uppercase; }
          .weekly-report-kpi__icon { width: 28px; height: 28px; display: grid; place-items: center; color: var(--kpi-color); border: 1px solid color-mix(in srgb, var(--kpi-color) 30%, transparent); border-radius: 9px; background: color-mix(in srgb, var(--kpi-color) 11%, transparent); }
          .weekly-report-kpi__icon svg { width: 14px; height: 14px; }
          .weekly-report-kpi__value { position: relative; z-index: 1; margin-top: 6px; color: var(--text-main); font-size: 24px; font-weight: 900; line-height: 1; letter-spacing: -.04em; }
          .weekly-report-kpi__meta { position: relative; z-index: 1; margin-top: 5px; color: var(--text-muted); font-size: 10px; font-weight: 700; }
          .weekly-report-kpi__meta strong { color: var(--kpi-color); font-weight: 850; }

          .weekly-report-kpi-grid--compact { gap: 10px; margin-bottom: 12px; }
          .weekly-report-kpi-grid--compact .weekly-report-kpi {
            min-height: 78px;
            padding: 10px 12px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(15,23,42,.04), inset 0 1px 0 rgba(255,255,255,.55);
          }
          .weekly-report-kpi-grid--compact .weekly-report-kpi__head { min-height: 14px; padding-right: 32px; }
          .weekly-report-kpi-grid--compact .weekly-report-kpi__label { line-height: 1.4; letter-spacing: .045em; }
          .weekly-report-kpi-grid--compact .weekly-report-kpi__icon {
            position: absolute;
            top: 10px;
            right: 12px;
            width: 24px;
            height: 24px;
            border-radius: 7px;
          }
          .weekly-report-kpi-grid--compact .weekly-report-kpi__icon svg { width: 12px; height: 12px; }
          .weekly-report-kpi-grid--compact .weekly-report-kpi__value { margin-top: 4px; font-size: 22px; }
          .weekly-report-kpi-grid--compact .weekly-report-kpi__meta { margin-top: 3px; line-height: 1.4; }
          .weekly-report-kpi-grid--compact .weekly-report-kpi::after { width: 52px; height: 52px; right: -24px; bottom: -26px; }

          #weeklyZoneReportCardContainer {
            padding: 24px !important;
            isolation: isolate;
            border-color: rgba(201,154,67,.28) !important;
            border-radius: 24px !important;
            background:
              radial-gradient(ellipse 48% 54% at 0% 0%, rgba(201,154,67,.13), transparent 100%),
              radial-gradient(ellipse 40% 50% at 100% 100%, rgba(216,180,109,.09), transparent 100%),
              linear-gradient(145deg, var(--surface-strong) 0%, var(--bg-soft) 55%, var(--surface-strong) 100%) !important;
            box-shadow: 0 20px 48px rgba(37,31,20,.075), 0 3px 12px rgba(37,31,20,.025), inset 0 1px 0 rgba(255,255,255,.68), inset 0 0 0 1px rgba(255,255,255,.18) !important;
          }
          #weeklyZoneReportCardContainer::before {
            content: '';
            position: absolute;
            inset: 0;
            z-index: 0;
            pointer-events: none;
            border-radius: inherit;
            background: radial-gradient(ellipse 42% 65% at 0% 0%, rgba(201,154,67,.055), transparent 100%);
          }
          #weeklyZoneReportCardContainer::after {
            content: '';
            position: absolute;
            right: 12%;
            bottom: 0;
            left: 12%;
            z-index: 0;
            height: 1px;
            pointer-events: none;
            background: linear-gradient(90deg, transparent, rgba(201,154,67,.3), transparent);
          }
          #weeklyZoneReportCardContainer > * { position: relative; z-index: 1; }
          #weeklyZoneReportCardContainer .weekly-report-title-block {
            margin: 0 174px 12px !important;
            padding: 0 0 12px !important;
            border-bottom: 1px solid var(--border) !important;
          }
          .weekly-report-eyebrow { margin-bottom: 7px; color: var(--report-gold); font-size: 9.5px; font-weight: 900; letter-spacing: .17em; text-transform: uppercase; }
          #weeklyZoneReportCardContainer .weekly-report-title-block h2 { color: var(--text-main) !important; font-size: 20px !important; letter-spacing: -.025em !important; }
          .weekly-report-period { display: inline-flex; align-items: center; gap: 7px; margin-top: 6px !important; padding: 4px 10px; color: var(--text-soft) !important; border: 1px solid var(--border); border-radius: 999px; background: var(--surface-soft); font-size: 11.5px !important; }
          .weekly-report-period::before { content: none; }

          .weekly-cols-trigger {
            min-height: 42px;
            padding: 0 14px !important;
            border: 1px solid rgba(201,154,67,.34) !important;
            border-radius: 12px !important;
            background: linear-gradient(180deg, var(--surface-strong), var(--surface)) !important;
            box-shadow: 0 6px 18px rgba(15,23,42,.08), inset 0 1px 0 rgba(255,255,255,.72) !important;
            transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease !important;
          }
          .weekly-cols-trigger:hover {
            border-color: rgba(201,154,67,.62) !important;
            box-shadow: 0 9px 24px rgba(15,23,42,.11), 0 0 0 3px rgba(201,154,67,.08) !important;
            transform: translateY(-1px);
          }
          .weekly-cols-trigger__icon {
            width: 27px;
            height: 27px;
            display: grid;
            place-items: center;
            color: #a97928;
            border: 1px solid rgba(201,154,67,.24);
            border-radius: 8px;
            background: rgba(201,154,67,.10);
          }
          .weekly-cols-trigger__count {
            min-width: 25px;
            height: 21px;
            display: inline-grid;
            place-items: center;
            padding: 0 6px;
            color: #8b641f;
            border-radius: 999px;
            background: rgba(201,154,67,.12);
            font-size: 10.5px;
            font-weight: 900;
          }
          .weekly-cols-menu {
            width: 326px;
            min-width: 326px !important;
            overflow: hidden;
            padding: 0 !important;
            border: 1px solid rgba(201,154,67,.30) !important;
            border-radius: 18px !important;
            background: var(--surface-strong) !important;
            box-shadow: 0 24px 64px rgba(15,23,42,.22), inset 0 1px 0 rgba(255,255,255,.72) !important;
          }
          .weekly-cols-menu__header {
            padding: 15px 16px 13px;
            border-bottom: 1px solid var(--border);
            background: linear-gradient(135deg, rgba(201,154,67,.12), rgba(59,130,246,.045));
          }
          .weekly-cols-menu__heading { display: flex; align-items: center; gap: 10px; }
          .weekly-cols-menu__heading-icon {
            width: 34px;
            height: 34px;
            display: grid;
            place-items: center;
            color: #a97928;
            border: 1px solid rgba(201,154,67,.25);
            border-radius: 10px;
            background: rgba(201,154,67,.12);
          }
          .weekly-cols-menu__title { color: var(--text-main); font-size: 12px; font-weight: 900; letter-spacing: .055em; text-transform: uppercase; }
          .weekly-cols-menu__subtitle { margin-top: 2px; color: var(--text-muted); font-size: 10.5px; font-weight: 700; }
          .weekly-cols-menu__actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
          .weekly-cols-action {
            min-height: 32px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 0 10px;
            border-radius: 9px;
            font-size: 11px;
            font-weight: 850;
            cursor: pointer;
            transition: transform .16s ease, background .16s ease, border-color .16s ease;
          }
          .weekly-cols-action:hover { transform: translateY(-1px); }
          .weekly-cols-action--show { color: #059669; border: 1px solid rgba(16,185,129,.26); background: rgba(16,185,129,.09); }
          .weekly-cols-action--show:hover { border-color: rgba(16,185,129,.46); background: rgba(16,185,129,.15); }
          .weekly-cols-action--hide { color: #dc2626; border: 1px solid rgba(239,68,68,.22); background: rgba(239,68,68,.075); }
          .weekly-cols-action--hide:hover { border-color: rgba(239,68,68,.42); background: rgba(239,68,68,.13); }
          .weekly-cols-list {
            max-height: 362px;
            overflow-y: auto;
            padding: 8px;
            scrollbar-width: thin;
            scrollbar-color: rgba(201,154,67,.42) transparent;
          }
          .weekly-cols-option {
            position: relative;
            display: flex;
            align-items: center;
            gap: 11px;
            min-height: 43px;
            padding: 7px 10px;
            border: 1px solid transparent;
            border-radius: 11px;
            cursor: pointer;
            transition: background .16s ease, border-color .16s ease, transform .16s ease;
          }
          .weekly-cols-option:hover { background: var(--surface-soft); border-color: var(--border); transform: translateX(2px); }
          .weekly-cols-option.is-active { background: rgba(201,154,67,.075); border-color: rgba(201,154,67,.18); }
          .weekly-cols-checkbox { position: absolute; opacity: 0; pointer-events: none; }
          .weekly-cols-checkmark {
            width: 20px;
            height: 20px;
            flex: 0 0 20px;
            display: grid;
            place-items: center;
            color: transparent;
            border: 1.5px solid var(--border-strong);
            border-radius: 6px;
            background: var(--surface-strong);
            box-shadow: inset 0 1px 0 rgba(255,255,255,.55);
            transition: all .16s ease;
          }
          .weekly-cols-checkbox:checked + .weekly-cols-checkmark {
            color: #fff;
            border-color: #b7832d;
            background: linear-gradient(135deg, #d6aa57, #a97928);
            box-shadow: 0 4px 10px rgba(169,121,40,.25);
          }
          .weekly-cols-checkmark svg { width: 12px; height: 12px; }
          .weekly-cols-option__content { min-width: 0; flex: 1; }
          .weekly-cols-option__label { display: block; color: var(--text-main); font-size: 12.5px; font-weight: 780; line-height: 1.25; }
          .weekly-cols-option__state { display: block; margin-top: 2px; color: var(--text-muted); font-size: 10px; font-weight: 700; }
          .weekly-cols-option.is-active .weekly-cols-option__state { color: #9a6f25; }

          #weeklyZoneReportCardContainer > div[style*="overflow-x"] {
            overflow: auto !important;
            border: 1px solid var(--border);
            border-radius: 18px;
            background: var(--surface-strong);
            box-shadow: inset 0 1px 0 rgba(255,255,255,.62);
          }
          #weeklyZoneReportCardContainer table { border-collapse: separate !important; border-spacing: 0 !important; }
          #weeklyZoneReportCardContainer th {
            padding: 12px 10px !important;
            color: var(--text-soft) !important;
            border: 0 !important;
            border-right: 1px solid var(--border) !important;
            border-bottom: 1px solid var(--border-strong) !important;
            background: var(--surface-soft) !important;
            font-size: 10.5px !important;
            line-height: 1.45 !important;
            letter-spacing: .035em;
          }
          #weeklyZoneReportCardContainer th:last-child {
            color: var(--text-main) !important;
            background: rgba(201,154,67,.13) !important;
            border-right: 0 !important;
          }
          #weeklyZoneReportCardContainer td {
            padding: 16px 12px !important;
            border: 0 !important;
            border-right: 1px solid var(--border) !important;
            border-bottom: 1px solid var(--border) !important;
            background: transparent !important;
          }
          #weeklyZoneReportCardContainer td:last-child { border-right: 0 !important; background: rgba(201,154,67,.07) !important; }
          #weeklyZoneReportCardContainer tbody tr { background: var(--surface-strong) !important; transition: background .18s ease, transform .18s ease; }
          #weeklyZoneReportCardContainer tbody tr:nth-child(even) { background: var(--surface-soft) !important; }
          #weeklyZoneReportCardContainer tbody tr:hover { background: rgba(201,154,67,.09) !important; }
          #weeklyZoneReportCardContainer tfoot tr { background: linear-gradient(90deg, rgba(59,130,246,.10), rgba(201,154,67,.10)) !important; }
          #weeklyZoneReportCardContainer tfoot td { border-bottom: 0 !important; font-size: 14px !important; }
          #weeklyZoneReportCardContainer .weekly-report-image-export {
            background: var(--bg-soft) !important;
            border: 1px solid var(--border-strong) !important;
            color: var(--text-main) !important;
            box-shadow: var(--shadow-sm) !important;
          }
          #weeklyZoneReportCardContainer .weekly-report-image-export svg { color: var(--primary); }
          #weeklyZoneReportCardContainer .weekly-report-image-export:hover {
            background: var(--surface-hover) !important;
            border-color: var(--primary) !important;
          }
          #weeklyZoneReportCardContainer th:last-child button {
            padding: 4px 8px !important;
            border: 1px solid rgba(201,154,67,.3) !important;
            border-radius: 7px !important;
            background: var(--bg-soft) !important;
            color: var(--text-main) !important;
            box-shadow: none !important;
          }

          .annual-claims-report-card { background: var(--surface); border: 1px solid var(--border-strong); border-radius: 20px; padding: 26px; box-shadow: var(--shadow-sm); }
          .annual-claims-report-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; padding: 2px 2px 20px; border-bottom: 1px solid var(--border); margin-bottom: 18px; }
          .annual-claims-report-heading h2 { margin: 0; color: var(--text-main); font-size: 21px; letter-spacing: -.025em; }
          .annual-claims-report-heading p { margin: 6px 0 0; color: var(--text-soft); font-size: 12.5px; }
          .annual-claims-year-badge { display: inline-flex; align-items: center; gap: 7px; border: 1px solid rgba(201,154,67,.3); background: rgba(201,154,67,.10); color: #9a6a1d; padding: 7px 11px; border-radius: 999px; font-size: 11.5px; font-weight: 850; white-space: nowrap; }
          .annual-claims-report-actions { display: inline-flex; align-items: center; justify-content: flex-end; gap: 9px; flex: 0 0 auto; }
          .annual-claims-download-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 36px; padding: 0 13px; border: 1px solid rgba(184,137,53,.26); border-radius: 11px; background: linear-gradient(135deg, #fffdf8, #f7f1e4); color: #876323; font: inherit; font-size: 11.5px; font-weight: 850; cursor: pointer; box-shadow: 0 3px 10px rgba(92,66,25,.045); transition: all .18s ease; }
          .annual-claims-download-btn:hover { border-color: rgba(184,137,53,.45); background: linear-gradient(135deg, #fffaf0, #f3e8ce); transform: translateY(-1px); box-shadow: 0 6px 14px rgba(92,66,25,.09); }
          .annual-claims-table-wrap { overflow-x: auto; border: 1px solid var(--border-strong); border-radius: 14px; }
          .annual-claims-table { width: 100%; min-width: 1280px; border-collapse: separate; border-spacing: 0; font-size: 12.5px; }
          .annual-claims-table th, .annual-claims-table td { padding: 13px 11px; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); text-align: center; white-space: nowrap; }
          .annual-claims-table th { background: var(--bg-soft); color: var(--text-soft); font-size: 10.5px; font-weight: 900; letter-spacing: .035em; text-transform: uppercase; }
          .annual-claims-table th:first-child, .annual-claims-table td:first-child { position: sticky; left: 0; z-index: 1; text-align: left; min-width: 220px; }
          .annual-claims-table th:first-child { z-index: 2; background: var(--bg-soft); }
          .annual-claims-table td:first-child { background: var(--surface); font-weight: 800; color: var(--text-main); }
          .annual-claims-table tbody tr:nth-child(even) td { background: var(--surface-soft); }
          .annual-claims-table tbody tr:nth-child(even) td:first-child { background: var(--surface-soft); }
          .annual-claims-table tbody tr:hover td { background: rgba(201,154,67,.08); }
          .annual-claims-table tbody td { color: var(--text-main); font-weight: 750; }
          .annual-claims-table .annual-total-col { color: #9a6a1d; background: rgba(201,154,67,.10) !important; font-weight: 900; }
          .annual-claims-table tfoot td { background: linear-gradient(90deg, rgba(59,130,246,.10), rgba(201,154,67,.12)); color: var(--text-main); font-weight: 900; border-bottom: 0; }
          .annual-claims-table tfoot td:first-child { color: #2563eb; }
          .annual-claims-empty { padding: 34px 16px; color: var(--text-soft); text-align: center; }
          .annual-claims-chart-panel { border: 1px solid var(--border-strong); border-radius: 16px; padding: 18px 20px 14px; background: linear-gradient(145deg, var(--surface) 0%, var(--bg-soft) 100%); }
          .annual-claims-chart-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 10px; }
          .annual-claims-chart-toolbar__title { color: var(--text-main); font-size: 13px; font-weight: 850; }
          .annual-claims-chart-toggle { display: inline-flex; gap: 4px; padding: 4px; border: 1px solid var(--border); border-radius: 11px; background: var(--surface); }
          .annual-claims-chart-toggle button { border: 0; border-radius: 8px; padding: 7px 12px; background: transparent; color: var(--text-soft); font: inherit; font-size: 11.5px; font-weight: 850; cursor: pointer; }
          .annual-claims-chart-toggle button.is-active { color: #fff; background: #b88935; box-shadow: 0 3px 9px rgba(184,137,53,.22); }
          .annual-claims-chart-canvas-wrap { position: relative; height: 390px; width: 100%; }
          .annual-claims-average { margin-top: 18px; border: 1px solid var(--border-strong); border-radius: 16px; overflow: hidden; background: var(--surface); }
          .annual-claims-average__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; padding: 17px 20px; border-bottom: 1px solid var(--border); background: linear-gradient(110deg, rgba(201,154,67,.045), var(--surface) 42%); }
          .annual-claims-average__head h3 { margin: 0; color: var(--text-main); font-size: 15px; font-weight: 900; }
          .annual-claims-average__head p { margin: 5px 0 0; color: var(--text-soft); font-size: 11.5px; line-height: 1.5; }
          .annual-claims-average__formula { flex: 0 0 auto; padding: 6px 10px; border: 1px solid rgba(201,154,67,.18); border-radius: 999px; background: rgba(201,154,67,.045); color: #94723a; font-size: 10.5px; font-weight: 850; }
          .annual-claims-average__scroll { overflow-x: auto; }
          .annual-claims-average__table { width: 100%; min-width: 1915px; table-layout: fixed; border-collapse: separate; border-spacing: 0; font-size: 11.5px; }
          .annual-claims-average__table th, .annual-claims-average__table td { box-sizing: border-box; padding: 10px 6px; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); text-align: center; white-space: nowrap; }
          .annual-claims-average__table thead tr:first-child th { background: var(--bg-soft); color: var(--text-soft); font-size: 10px; font-weight: 900; letter-spacing: .04em; text-transform: uppercase; }
          .annual-claims-average__table thead tr:nth-child(2) th { background: var(--surface-soft); color: var(--text-muted); font-size: 10px; font-weight: 850; }
          .annual-claims-average__table thead tr:first-child > th:first-child, .annual-claims-average__table tbody tr > td:first-child:not([colspan]), .annual-claims-average__table tfoot tr > td:first-child { position: sticky; left: 0; z-index: 5; width: 205px; min-width: 205px; text-align: left; }
          .annual-claims-average__table thead tr:first-child > th:first-child { z-index: 12; width: 205px; min-width: 205px; background: var(--bg-soft) !important; box-shadow: 5px 0 9px rgba(15,23,42,.06); }
          .annual-claims-average__table tbody tr > td:first-child:not([colspan]) { z-index: 8; background: var(--surface-strong) !important; color: var(--text-main); font-weight: 850; box-shadow: 5px 0 9px rgba(15,23,42,.045); }
          .annual-claims-average__table tbody tr:nth-child(even) td { background: var(--surface-soft); }
          .annual-claims-average__table tbody tr:nth-child(even) > td:first-child:not([colspan]) { background: var(--bg-soft) !important; }
          .annual-claims-average__table tbody td { color: var(--text-soft); font-weight: 750; }
          .annual-claims-average__table .vcx-col { color: #9a762f; }
          .annual-claims-average__table .tnds-col { color: #27856a; }
          .annual-claims-average__table .average-value { color: var(--text-main); font-size: 13px; font-weight: 900; }
          .annual-claims-average__table .monthly-count { color: var(--text-main); font-variant-numeric: tabular-nums; }
          .annual-claims-average__table .monthly-vcx { color: #9a762f; }
          .annual-claims-average__table .monthly-tnds { color: #27856a; }
          .annual-claims-average__table .annual-summary-col { background: rgba(201,154,67,.045); }
          .annual-claims-average__table thead .month-group { color: var(--text-main) !important; background: rgba(201,154,67,.075) !important; }
          .annual-claims-average__table thead .monthly-vcx-head { color: #9a762f; }
          .annual-claims-average__table thead .monthly-tnds-head { color: #27856a; }
          .annual-claims-average__table thead tr:nth-child(2) th:nth-last-child(-n+4) { white-space: normal; line-height: 1.25; padding-left: 5px; padding-right: 5px; }
          .annual-claims-average__table tfoot tr > td:first-child { position: sticky; left: 0; z-index: 8; min-width: 205px; background: var(--surface-strong) !important; box-shadow: 5px 0 9px rgba(15,23,42,.045); }
          .annual-claims-average__table tfoot td { background: linear-gradient(90deg, rgba(201,154,67,.07), rgba(16,185,129,.055)); color: var(--text-main); font-weight: 900; border-bottom: 0; }
          @media (max-width: 720px) { .annual-claims-report-card { padding: 16px; } .annual-claims-report-heading { flex-direction: column; } }

          @media (max-width: 1450px) {
            .gdv-report-filter-hub {
              display: grid !important;
              grid-template-columns: 1fr auto;
              align-items: center !important;
            }
            .gdv-report-filter-controls { flex-wrap: wrap !important; }
          }
          @media (max-width: 1180px) {
            .gdv-report-hero-actions {
              width: 100%;
              max-width: none;
              justify-content: flex-start;
            }
            .gdv-report-filter-hub { display: grid !important; grid-template-columns: 1fr !important; }
            .report-filter-utility-slot { justify-content: flex-start; }
            .weekly-report-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            #weeklyZoneReportCardContainer .weekly-report-title-block { margin-left: 0 !important; margin-right: 0 !important; padding-top: 54px !important; }
          }
          @media (max-width: 720px) {
            .gdv-report-command-center { border-radius: 22px; }
            .gdv-report-hero-premium { padding: 22px 18px !important; }
            .gdv-report-hero-premium h1 { font-size: 24px !important; }
            .gdv-report-filter-hub { padding: 14px !important; border-radius: 0 0 21px 21px !important; }
            .gdv-report-hero-actions,
            .gdv-report-hero-actions > div,
            .report-filter-utility-slot,
            .report-filter-utility-slot #accReportFavFiltersWrapper { width: 100%; }
            .gdv-report-hero-actions > div { justify-content: stretch !important; }
            .gdv-report-hero-actions .btn-premium,
            .gdv-report-hero-actions .custom-select-wrapper,
            .report-filter-utility-slot button { width: 100% !important; }
            .gdv-report-date-actions,
            .gdv-report-date-picker-shell { width: 100%; flex-wrap: wrap !important; }
            .report-date-trigger { min-width: 0; width: 100%; flex: 1 1 100%; }
            .report-date-picker-panel { position: fixed; left: 12px; right: 12px; top: 82px; width: auto; max-height: calc(100vh - 96px); overflow-y: auto; }
            .weekly-report-kpi-grid { grid-template-columns: 1fr; }
            #weeklyZoneReportCardContainer { padding: 18px !important; }
          }

          /* Softer champagne accents for the report header and filter bar */
          .gdv-report-command-center { border-color: rgba(184,137,53,.26) !important; box-shadow: 0 6px 18px rgba(92,66,25,.035), inset 0 1px 0 rgba(255,255,255,.76) !important; }
          .gdv-report-command-center::after { opacity: .68; }
          .gdv-report-hero-premium {
            background:
              radial-gradient(circle at 7% -10%, rgba(201,154,67,.09), transparent 35%),
              radial-gradient(circle at 82% 0%, rgba(216,180,109,.065), transparent 28%),
              linear-gradient(125deg, #fffefc 0%, #fdfbf8 52%, #f9f7f2 100%) !important;
            box-shadow: inset 0 1px 0 rgba(255,255,255,.94), inset 0 -1px 0 rgba(201,154,67,.045) !important;
          }
          .gdv-report-hero-premium::after { opacity: .68; }
          .gdv-report-hero-premium > div > div:first-child > div:first-child { background: rgba(201,154,67,.055) !important; border-color: rgba(184,137,53,.20) !important; box-shadow: none !important; }
          .gdv-report-hero-premium .btn-premium:not([style*="#10b981"]) { border-color: rgba(184,137,53,.17) !important; box-shadow: 0 4px 12px rgba(92,66,25,.04), inset 0 1px 0 rgba(255,255,255,.90) !important; }
          .gdv-report-filter-hub { border-top-color: rgba(201,154,67,.12) !important; box-shadow: inset 0 1px 0 rgba(255,255,255,.72) !important; }
          .gdv-report-filter-hub::before { opacity: .62; }
          .gdv-report-filter-hub .custom-select-trigger,
          .gdv-report-filter-hub input[type="date"] { border-color: color-mix(in srgb, var(--border-strong) 95%, var(--report-gold)) !important; box-shadow: 0 3px 10px rgba(15,23,42,.03), inset 0 1px 0 rgba(255,255,255,.75) !important; }
          .gdv-report-filter-hub .custom-select-trigger:hover,
          .gdv-report-filter-hub input[type="date"]:hover { border-color: rgba(201,154,67,.34) !important; box-shadow: 0 5px 13px rgba(15,23,42,.045), 0 0 0 3px rgba(201,154,67,.04) !important; }
          .gdv-report-filter-hub .gdv-report-time-label { background: rgba(216,180,109,.045) !important; border-color: rgba(216,180,109,.13) !important; }
          .report-date-trigger { border-color: rgba(201,154,67,.16) !important; box-shadow: 0 3px 10px rgba(15,23,42,.03), inset 0 1px 0 rgba(255,255,255,.75) !important; }
          .report-date-trigger__icon { border-color: rgba(201,154,67,.13) !important; background: rgba(201,154,67,.045) !important; }
          .report-filter-utility-slot #accReportFavFiltersWrapper > button { border-color: rgba(201,154,67,.20) !important; background: rgba(201,154,67,.04) !important; box-shadow: 0 3px 10px rgba(15,23,42,.03), inset 0 1px 0 rgba(255,255,255,.72) !important; }
          .report-filter-utility-slot #accReportFavFiltersWrapper > button:hover { border-color: rgba(201,154,67,.36) !important; background: rgba(201,154,67,.075) !important; }
        
</style>
        <div class="gdv-report-premium-shell" style="padding: 16px 0 32px 0; width: 100%; max-width: 100%; margin: 0 auto;">

          <section class="gdv-report-command-center" aria-label="Trung tâm điều khiển báo cáo">
          
          <!-- ADAPTIVE HERO BANNER HEADER -->
          <div id="gdvReportHeroBanner" class="gdv-report-hero-premium" style="background: var(--surface); border: 1px solid var(--border-strong); border-radius: 20px; padding: 24px 28px; margin-bottom: 20px; box-shadow: var(--shadow-sm); position: relative; z-index: 100;">
            <div style="position: absolute; inset: 0; border-radius: 20px; overflow: hidden; pointer-events: none; z-index: 1;">
              <div style="position: absolute; right: -40px; top: -40px; width: 220px; height: 220px; background: radial-gradient(circle, rgba(216,180,109,0.12) 0%, rgba(0,0,0,0) 70%); border-radius: 50%;"></div>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; position: relative; z-index: 2;">
              <div>
                <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(216,180,109,0.12); border: 1px solid rgba(216,180,109,0.3); color: var(--primary); padding: 5px 14px; border-radius: 99px; font-size: 11.5px; font-weight: 850; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 10px;">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                  <span>BÁO CÁO GIÁM ĐỊNH - BỒI THƯỜNG</span>
                </div>
                <h1 style="font-size: 27px; font-weight: 900; color: var(--text-main); margin: 0; letter-spacing: -0.02em; line-height: 1.25;">${heroReportTitle}</h1>
                <p style="margin-top: 6px; font-size: 13.5px; color: var(--text-soft); max-width: 950px; margin-bottom: 0;">
                  ${heroReportSubtitle}
                </p>
              </div>

              <!-- Action Area: Settings, Export, Favorite Filters & Report Selector -->
              <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 10px;" class="hide-on-screenshot gdv-report-hero-actions">
                <!-- Top Row: Cài đặt BC + Tải báo cáo (.xlsx) -->
                <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 10px;">
                  <button type="button" class="btn-premium" onclick="openReportSettingsModal()" style="width: auto; padding: 0 16px; height: 42px; font-size: 12.5px; border-radius: 12px; font-weight: 850; background: var(--surface); color: var(--text-main); border: 1px solid var(--border-strong); display: inline-flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s;">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    <span>Cài đặt BC</span>
                  </button>

                  ${hasUserPermission('report', 'export') ? `
                  <div class="custom-select-wrapper" style="position: relative;" id="accExportMenuWrapper">
                    <button type="button" class="btn-premium" onclick="toggleCustomDropdownMenu('ddExportOptions', event)" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; border: none; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; box-shadow: 0 4px 14px rgba(16,185,129,0.3); transition: all 0.2s ease; padding: 0 18px; height: 42px; font-size: 12.5px; border-radius: 12px; font-weight: 850; min-width: 190px; justify-content: space-between;">
                      <span style="display: flex; align-items: center; gap: 8px;">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        <span>Tải báo cáo (.xlsx)</span>
                      </span>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: rgba(255,255,255,0.7);"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>

                    <div id="ddExportOptions" class="custom-select-menu" style="display: ${activeOpenDropdownId === 'ddExportOptions' ? 'block' : 'none'}; position: absolute; top: calc(100% + 6px); right: 0; min-width: 240px; background: var(--bg-soft) !important; border: 1px solid var(--border-strong); border-radius: 14px; box-shadow: 0 16px 36px rgba(0,0,0,0.3); z-index: 10000; padding: 6px;">
                      <div class="custom-select-item" onclick="triggerGdvMonthlyReportExcelExport(event)" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.15s ease;">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#10b981" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                        <span>Báo cáo Tháng (.xlsx)</span>
                      </div>

                      <div class="custom-select-item" onclick="triggerWeeklyZoneReportExcelExport(event)" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.15s ease;">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#3b82f6" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                        <span>Báo cáo Tuần (.xlsx)</span>
                      </div>
                      ${activeGdvReportView === 'annual_claims_gdv' ? `<div class="custom-select-item" onclick="exportAnnualGdvClaimsReportExcel(); closeAllCustomDropdowns();" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 800; color: var(--text-main); cursor: pointer; border-top: 1px dashed var(--border);">Báo cáo phát sinh năm (.xlsx)</div>` : ''}
                      <div class="custom-select-item" onclick="exportCarBrandLossReportExcel(); closeAllCustomDropdowns();" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.15s ease;">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#d8b46d" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        <span>Báo cáo Hãng xe (.xlsx)</span>
                      </div>

                      ${activeGdvReportView === 'daklak_reserve' ? `
                      <div class="custom-select-item" onclick="triggerDakLakReserveReportExcelExport(event)" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; gap: 8px; border-top: 1px dashed var(--border); transition: background 0.15s ease;">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#10b981" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                        <span style="color: var(--primary); font-weight: 850;">Báo cáo Đắk Lắk (.xlsx)</span>
                      </div>
                      ` : ''}

                      ${activeGdvReportView === 'ton_chua_hoa_don' ? `
                      <div class="custom-select-item" onclick="triggerTonChuaHoaDonReportExcelExport(event)" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; gap: 8px; border-top: 1px dashed var(--border); transition: background 0.15s ease;">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ef4444" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                        <span style="color: #ef4444; font-weight: 850;">Tồn chưa Hóa đơn (.xlsx)</span>
                      </div>
                      ` : ''}

                      <div class="custom-select-item" onclick="triggerTndsTonReportExcelExport(event)" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; gap: 8px; border-top: 1px dashed var(--border); transition: background 0.15s ease;">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#eab308" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        <span style="color: #eab308; font-weight: 850;">Báo cáo TNDS Tồn (.xlsx)</span>
                      </div>
                    </div>
                  </div>
                  ` : ''}
                </div>

                <!-- Bottom Row: Favorite Filters + COMPACT REPORT SELECTOR -->
                <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 10px;">
                  <!-- Custom Favorite Filters Dropdown Widget -->
                  <div class="custom-select-wrapper" style="position: relative;" id="accReportFavFiltersWrapper">
                    <button type="button" class="btn-premium" onclick="toggleCustomDropdownMenu('ddReportFavFiltersMenu', event)" style="padding: 0 16px; height: 42px; border-radius: 12px; background: var(--surface); border: 1px solid var(--border-strong); font-size: 12.5px; font-weight: 850; color: var(--text-main); display: inline-flex; align-items: center; gap: 8px; cursor: pointer; min-width: 155px; justify-content: space-between; box-shadow: var(--shadow-xs); transition: all 0.2s ease;" onmouseover="this.style.borderColor='var(--primary)';" onmouseout="this.style.borderColor='var(--border-strong)';">
                      <span style="display: flex; align-items: center; gap: 6px;">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="var(--primary)" stroke-width="2.5" style="color: var(--primary);"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                        <span>Bộ lọc ưa thích</span>
                      </span>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--text-soft);"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>

                    <div id="ddReportFavFiltersMenu" class="custom-select-menu" style="display: none; position: absolute; top: calc(100% + 6px); right: 0; min-width: 320px; background: var(--bg-soft) !important; border: 1px solid var(--border-strong); border-radius: 14px; box-shadow: 0 16px 36px rgba(0,0,0,0.3); z-index: 10000; padding: 12px;">
                      <!-- Dropdown content rendered dynamically -->
                    </div>
                  </div>

                  <!-- Compact Report View Selector -->
                  <div class="custom-select-wrapper report-picker" style="position: relative; z-index: 110;" id="accReportViewSelectorWrapper">
                    <button type="button" class="report-picker__trigger ${activeOpenDropdownId === 'ddReportViewSelectorMenu' ? 'is-open' : ''}" onclick="toggleCustomDropdownMenu('ddReportViewSelectorMenu', event)" aria-haspopup="listbox" aria-expanded="${activeOpenDropdownId === 'ddReportViewSelectorMenu' ? 'true' : 'false'}" aria-controls="ddReportViewSelectorMenu">
                      <span class="report-picker__trigger-main">
                        <span class="report-picker__trigger-icon">${currentActiveReportObj.icon}</span>
                        <span class="report-picker__trigger-label">${currentActiveReportObj.title}</span>
                        ${currentActiveReportObj.id === 'tnds_ton' ? '<span class="report-picker__trigger-badge">MỚI</span>' : ''}
                      </span>
                      <svg class="report-picker__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>

                    <div id="ddReportViewSelectorMenu" class="custom-select-menu report-picker__menu" role="listbox" aria-label="Chọn trang báo cáo" style="display: ${activeOpenDropdownId === 'ddReportViewSelectorMenu' ? 'block' : 'none'};">
                      <div class="report-filter-menu-head report-picker__head">
                        <span class="report-filter-menu-head__icon">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                        </span>
                        <div class="report-picker__head-copy">
                          <div class="report-filter-menu-head__title">Chọn trang báo cáo</div>
                          <div class="report-filter-menu-head__meta">Chuyển nhanh giữa các góc nhìn báo cáo</div>
                        </div>
                        <span class="report-picker__count">${GDV_REPORT_VIEWS_LIST.length} trang</span>
                      </div>
                      <div class="report-picker__body">
                        ${GDV_REPORT_VIEWS_LIST.map(item => {
                          const isSelected = item.id === activeGdvReportView;
                          return `
                            <div class="report-picker__item ${isSelected ? 'is-active' : ''}" role="option" aria-selected="${isSelected ? 'true' : 'false'}" tabindex="0" title="${item.desc}" onclick="switchGdvReportView('${item.id}')" onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); switchGdvReportView('${item.id}'); }">
                              <div class="report-picker__item-main">
                                <div class="report-picker__item-icon">${item.icon}</div>
                                <div class="report-picker__item-copy">
                                  <div class="report-picker__item-title-row">
                                    <span class="report-picker__item-title">${item.title}</span>
                                    ${item.badge ? `<span class="report-picker__item-badge ${item.badge === 'MỚI' ? 'is-new' : ''}">${item.badge}</span>` : ''}
                                  </div>
                                  <div class="report-picker__item-desc">${item.desc}</div>
                                </div>
                              </div>
                              ${isSelected ? `
                                <div class="report-picker__item-check">
                                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </div>
                              ` : `
                                <svg class="report-picker__item-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                              `}
                            </div>
                          `;
                        }).join('')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- CONTROL HUB FILTER BAR WITH CUSTOM GLASSMORPHIC DROPDOWNS -->
          <div class="gdv-report-filter-hub" style="background: var(--surface); border: 1px solid var(--border-strong); border-radius: 18px; padding: 16px 22px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; box-shadow: var(--shadow-sm);">
            
            <!-- Left Controls: Custom Dropdowns -->
            <div class="gdv-report-filter-controls" style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
              ${activeGdvReportView === 'weekly_zone' ? `
                <div class="gdv-report-time-label" style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 800; color: var(--primary); background: rgba(216,180,109,0.08); padding: 8px 14px; border-radius: 10px; border: 1px solid rgba(216,180,109,0.2);">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  <span>Mốc thời gian:</span>
                </div>
              ` : ''}

              <!-- Custom GDV Multi-Select Dropdown -->
              <div class="custom-select-wrapper" style="position: relative;" id="accGdvReportFilterWrapper">
                <button type="button" class="custom-select-trigger report-filter-select-trigger ${activeOpenDropdownId === 'ddReportGdvMenu' ? 'is-open' : ''}" onclick="toggleCustomDropdownMenu('ddReportGdvMenu', event)" style="padding: 9px 16px; border-radius: 12px; background: var(--bg-soft); border: 1px solid var(--border-strong); font-size: 13px; font-weight: 800; color: var(--text-main); display: inline-flex; align-items: center; gap: 10px; cursor: pointer; min-width: 210px; justify-content: space-between; box-shadow: var(--shadow-xs); transition: all 0.2s ease;">
                  <span style="display: flex; align-items: center; gap: 6px;">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary);"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    <span>GĐV (${activeSelectedGdvNames.length} đã chọn)</span>
                  </span>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--text-soft);"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>

                <div id="ddReportGdvMenu" class="custom-select-menu report-filter-select-menu report-filter-gdv-menu" style="display: ${activeOpenDropdownId === 'ddReportGdvMenu' ? 'block' : 'none'}; position: absolute; top: calc(100% + 8px); left: 0; z-index: 999;">
                  <div class="report-filter-menu-head">
                    <span class="report-filter-menu-head__icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></span>
                    <div><div class="report-filter-menu-head__title">Giám định viên</div><div class="report-filter-menu-head__meta">Đã chọn ${activeSelectedGdvNames.length} người</div></div>
                  </div>
                  
                  <!-- Action Toolbar -->
                  <div class="report-filter-gdv-toolbar" style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid var(--border); gap: 6px; flex-wrap: wrap;">
                    <button type="button" class="report-filter-mini-action" onclick="resetGdvSelectionToDefault(event)" style="background: rgba(216,180,109,0.15); border: 1px solid rgba(216,180,109,0.3); color: var(--primary); font-size: 11px; font-weight: 850; padding: 4px 8px; border-radius: 6px; cursor:pointer;" title="Đặt lại 3 GĐV mặc định">↺ 3 Mặc định</button>
                    <div style="display: flex; gap: 4px;">
                      <button type="button" class="report-filter-mini-action" onclick="selectAllGdvOptions(event)" style="background: rgba(59,130,246,.08); border: 1px solid rgba(59,130,246,.20); color: #2563eb; cursor:pointer;">Tất cả</button>
                      <button type="button" class="report-filter-mini-action" onclick="clearAllGdvOptions(event)" style="background: rgba(239,68,68,.07); border: 1px solid rgba(239,68,68,.18); color: #dc2626; cursor:pointer;">Xóa</button>
                    </div>
                  </div>

                  <!-- GDV Checkbox List -->
                  <div class="report-filter-check-list" style="display: flex; flex-direction: column; gap: 4px;">
                    ${getAllAvailableGdvNames().map(gName => {
                      const isSel = activeSelectedGdvNames.some(s => s.trim().toLowerCase() === gName.trim().toLowerCase());
                      const isDefault3 = ['Hồ Quang Huy', 'Huỳnh Văn Phúc', 'Nguyễn Quang Huy_DL'].includes(gName);

                      return `
                        <label class="report-filter-check-item ${isSel ? 'is-selected' : ''}" onclick="toggleGdvSelectionOption('${escapeAttributeData(gName)}', event)" style="display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; border-radius: 8px; cursor: pointer; transition: background 0.15s ease; ${isSel ? 'background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850;' : 'color: var(--text-main); font-weight: 750;'}">
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" ${isSel ? 'checked' : ''} style="width: 15px; height: 15px; accent-color: #d8b46d; cursor: pointer;" />
                            <span style="font-size: 12.5px;">${escapeHtmlOutput(gName)}</span>
                          </div>
                          ${isDefault3 ? `<span class="report-filter-default-badge" style="font-size: 10px; background: rgba(216,180,109,0.2); color: var(--primary); padding: 1px 5px; border-radius: 4px; font-weight: 850;">Mặc định</span>` : ''}
                        </label>
                      `;
                    }).join('')}
                  </div>
                </div>
              </div>

              <!-- Custom Gara Selection Dropdown for Outstanding No Invoice Report -->
              ${activeGdvReportView === 'ton_chua_hoa_don' ? `
              <div class="custom-select-wrapper" style="position: relative;" id="accReportGaraFilterWrapper">
                <button type="button" class="custom-select-trigger" onclick="toggleCustomDropdownMenu('ddReportGaraMenu', event)" style="padding: 9px 16px; border-radius: 12px; background: var(--bg-soft); border: 1px solid var(--border-strong); font-size: 13px; font-weight: 800; color: var(--text-main); display: inline-flex; align-items: center; gap: 10px; cursor: pointer; min-width: 200px; justify-content: space-between; box-shadow: var(--shadow-xs); transition: all 0.2s ease;">
                  <span style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px;">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary);"><path d="M3 21h18"></path><path d="M19 21v-4a2 2 0 0 0-2 2v4"></path><path d="M5 15V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8"></path></svg>
                    <span>${activeGdvReportGara === 'all' ? 'Tất cả Gara' : activeGdvReportGara}</span>
                  </span>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--text-soft);"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>

                <div id="ddReportGaraMenu" class="custom-select-menu" style="display: ${activeOpenDropdownId === 'ddReportGaraMenu' ? 'block' : 'none'}; position: absolute; top: calc(100% + 6px); left: 0; min-width: 240px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 14px; box-shadow: 0 16px 36px rgba(0,0,0,0.3); z-index: 999; padding: 6px; backdrop-filter: blur(16px); max-height: 280px; overflow-y: auto;">
                  <div class="custom-select-item ${activeGdvReportGara === 'all' ? 'active' : ''}" onclick="selectGdvReportGara('all')" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; ${activeGdvReportGara === 'all' ? 'background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850;' : ''}">
                    <span>Tất cả Gara</span>
                    ${activeGdvReportGara === 'all' ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--primary)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                  </div>
                  ${getAvailableGaraNamesForOutstandingReport().map(g => `
                    <div class="custom-select-item ${g === activeGdvReportGara ? 'active' : ''}" onclick="selectGdvReportGara('${escapeAttributeData(g)}')" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; ${g === activeGdvReportGara ? 'background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850;' : ''}">
                      <span>${escapeHtmlOutput(g)}</span>
                      ${g === activeGdvReportGara ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--primary)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- Custom Days Range Selection Dropdown for Outstanding No Invoice Report -->
              <div class="custom-select-wrapper" style="position: relative;" id="accReportDaysRangeFilterWrapper">
                <button type="button" class="custom-select-trigger" onclick="toggleCustomDropdownMenu('ddReportDaysRangeMenu', event)" style="padding: 9px 16px; border-radius: 12px; background: var(--bg-soft); border: 1px solid var(--border-strong); font-size: 13px; font-weight: 800; color: var(--text-main); display: inline-flex; align-items: center; gap: 10px; cursor: pointer; min-width: 170px; justify-content: space-between; box-shadow: var(--shadow-xs); transition: all 0.2s ease;">
                  <span style="display: flex; align-items: center; gap: 6px;">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary);"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <span>${activeGdvReportDaysRange === 'all' ? 'Tất cả số ngày' : activeGdvReportDaysRange === 'over_30' ? 'Trên 30 ngày' : 'Dưới 30 ngày'}</span>
                  </span>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--text-soft);"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>

                <div id="ddReportDaysRangeMenu" class="custom-select-menu" style="display: ${activeOpenDropdownId === 'ddReportDaysRangeMenu' ? 'block' : 'none'}; position: absolute; top: calc(100% + 6px); left: 0; min-width: 170px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 14px; box-shadow: 0 16px 36px rgba(0,0,0,0.3); z-index: 999; padding: 6px; backdrop-filter: blur(16px);">
                  <div class="custom-select-item ${activeGdvReportDaysRange === 'all' ? 'active' : ''}" onclick="selectGdvReportDaysRange('all')" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; ${activeGdvReportDaysRange === 'all' ? 'background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850;' : ''}">
                    <span>Tất cả</span>
                    ${activeGdvReportDaysRange === 'all' ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--primary)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                  </div>
                  <div class="custom-select-item ${activeGdvReportDaysRange === 'over_30' ? 'active' : ''}" onclick="selectGdvReportDaysRange('over_30')" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; ${activeGdvReportDaysRange === 'over_30' ? 'background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850;' : ''}">
                    <span>Trên 30 ngày</span>
                    ${activeGdvReportDaysRange === 'over_30' ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--primary)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                  </div>
                  <div class="custom-select-item ${activeGdvReportDaysRange === 'under_30' ? 'active' : ''}" onclick="selectGdvReportDaysRange('under_30')" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; ${activeGdvReportDaysRange === 'under_30' ? 'background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850;' : ''}">
                    <span>Dưới 30 ngày</span>
                    ${activeGdvReportDaysRange === 'under_30' ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--primary)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                  </div>
                </div>
              </div>
              ` : ''}

              
              <!-- Claim Type (Nghiệp vụ) Selection Dropdown -->
              ${activeGdvReportView !== 'tnds_ton' && activeGdvReportView !== 'annual_claims_gdv' ? `
              <div class="custom-select-wrapper" style="position: relative;" id="accReportClaimTypeFilterWrapper">
                <button type="button" class="custom-select-trigger report-filter-select-trigger ${activeOpenDropdownId === 'ddReportClaimTypeMenu' ? 'is-open' : ''}" onclick="toggleCustomDropdownMenu('ddReportClaimTypeMenu', event)" style="padding: 9px 16px; border-radius: 12px; background: var(--bg-soft); border: 1px solid var(--border-strong); font-size: 13px; font-weight: 800; color: var(--text-main); display: inline-flex; align-items: center; gap: 10px; cursor: pointer; min-width: 160px; justify-content: space-between; box-shadow: var(--shadow-xs); transition: all 0.2s ease;">
                  <span style="display: flex; align-items: center; gap: 6px;">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                    <span>Loại HS: ${activeReportClaimType === 'all' ? 'Tất cả' : activeReportClaimType}</span>
                  </span>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--text-soft);"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>

                <div id="ddReportClaimTypeMenu" class="custom-select-menu report-filter-select-menu report-filter-claim-menu" style="display: ${activeOpenDropdownId === 'ddReportClaimTypeMenu' ? 'block' : 'none'}; position: absolute; top: calc(100% + 8px); left: 0; z-index: 999;">
                  <div class="report-filter-menu-head"><span class="report-filter-menu-head__icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg></span><div><div class="report-filter-menu-head__title">Loại hồ sơ</div><div class="report-filter-menu-head__meta">Chọn nghiệp vụ báo cáo</div></div></div>
                  <div class="report-filter-menu-body">
                  <div class="custom-select-item report-filter-select-item ${activeReportClaimType === 'all' ? 'active' : ''}" onclick="selectReportClaimType('all')" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; ${activeReportClaimType === 'all' ? 'background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850;' : ''}">
                    <span>Cả 2 (VCX & TNDS)</span>
                    ${activeReportClaimType === 'all' ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--primary)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                  </div>
                  <div class="custom-select-item report-filter-select-item ${activeReportClaimType === 'VCX' ? 'active' : ''}" onclick="selectReportClaimType('VCX')" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; ${activeReportClaimType === 'VCX' ? 'background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850;' : ''}">
                    <span>Vật chất xe (VCX)</span>
                    ${activeReportClaimType === 'VCX' ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--primary)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                  </div>
                  <div class="custom-select-item report-filter-select-item ${activeReportClaimType === 'TNDS' ? 'active' : ''}" onclick="selectReportClaimType('TNDS')" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; ${activeReportClaimType === 'TNDS' ? 'background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850;' : ''}">
                    <span>Trách nhiệm DS (TNDS)</span>
                    ${activeReportClaimType === 'TNDS' ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--primary)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                  </div>
                  </div>
                </div>
              </div>
              ` : ''}
<!-- Custom Reserve Threshold & Status Dropdowns for Dak Lak Report -->
              ${activeGdvReportView === 'daklak_reserve' ? `
              <!-- Reserve Threshold Selection Dropdown (>50M vs >100M) -->
              <div class="custom-select-wrapper" style="position: relative;" id="accDakLakReserveThresholdFilterWrapper">
                <button type="button" class="custom-select-trigger" onclick="toggleCustomDropdownMenu('ddReportDakLakReserveThresholdMenu', event)" style="padding: 9px 16px; border-radius: 12px; background: var(--bg-soft); border: 1px solid var(--border-strong); font-size: 13px; font-weight: 800; color: var(--text-main); display: inline-flex; align-items: center; gap: 10px; cursor: pointer; min-width: 160px; justify-content: space-between; box-shadow: var(--shadow-xs); transition: all 0.2s ease;">
                  <span style="display: flex; align-items: center; gap: 6px;">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary);"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                    <span>Mức DP: > ${activeDakLakMinReserve === 50000000 ? '50 triệu' : activeDakLakMinReserve === 100000000 ? '100 triệu' : formatCurrencyInputNumber(activeDakLakMinReserve) + ' VNĐ'}</span>
                  </span>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--text-soft);"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>

                <div id="ddReportDakLakReserveThresholdMenu" class="custom-select-menu" style="display: ${activeOpenDropdownId === 'ddReportDakLakReserveThresholdMenu' ? 'block' : 'none'}; position: absolute; top: calc(100% + 6px); left: 0; min-width: 220px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 14px; box-shadow: 0 16px 36px rgba(0,0,0,0.3); z-index: 999; padding: 6px; backdrop-filter: blur(16px);">
                  <div class="custom-select-item ${activeDakLakMinReserve === 50000000 ? 'active' : ''}" onclick="selectDakLakMinReserve(50000000)" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; ${activeDakLakMinReserve === 50000000 ? 'background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850;' : ''}">
                    <span>Trên 50 triệu</span>
                    ${activeDakLakMinReserve === 50000000 ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--primary)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                  </div>
                  <div class="custom-select-item ${activeDakLakMinReserve === 100000000 ? 'active' : ''}" onclick="selectDakLakMinReserve(100000000)" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; ${activeDakLakMinReserve === 100000000 ? 'background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850;' : ''}">
                    <span>Trên 100 triệu</span>
                    ${activeDakLakMinReserve === 100000000 ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--primary)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                  </div>
                  <div style="padding: 10px 12px 6px 12px; border-top: 1px dashed var(--border-strong); margin-top: 4px;">
                    <div style="font-size: 11px; font-weight: 800; color: var(--text-soft); margin-bottom: 8px;">HOẶC NHẬP SỐ KHÁC</div>
                    <div style="display: flex; gap: 6px; flex-wrap: nowrap; align-items: center;">
                      <input type="text" id="customDakLakMinReserveInput" placeholder="Ví dụ: 80.000.000" class="input-premium" style="flex: 1; height: 32px; padding: 0 10px; border-radius: 8px; font-size: 13px; font-weight: 600; width: 100%; min-width: 0; text-align: left;" oninput="formatCurrencyInputEvent(this)" onclick="event.stopPropagation()" onkeydown="if(event.key==='Enter') applyCustomDakLakMinReserve()" value="${activeDakLakMinReserve !== 50000000 && activeDakLakMinReserve !== 100000000 ? formatCurrencyInputNumber(activeDakLakMinReserve) : ''}">
                      <button type="button" style="height: 32px; padding: 0 12px; border-radius: 8px; font-size: 12px; font-weight: 800; flex-shrink: 0; background: rgba(216,180,109,0.15); color: var(--primary); border: 1px solid rgba(216,180,109,0.3); cursor: pointer; white-space: nowrap; transition: all 0.2s;" onmouseover="this.style.background='rgba(216,180,109,0.25)'" onmouseout="this.style.background='rgba(216,180,109,0.15)'" onclick="applyCustomDakLakMinReserve(); event.stopPropagation()">Áp dụng</button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Custom Status Multi-Select Dropdown for Dak Lak Report -->
              <div class="custom-select-wrapper" style="position: relative;" id="accDakLakStatusFilterWrapper">
                <button type="button" class="custom-select-trigger" onclick="toggleCustomDropdownMenu('ddReportDakLakStatusMenu', event)" style="padding: 9px 16px; border-radius: 12px; background: var(--bg-soft); border: 1px solid var(--border-strong); font-size: 13px; font-weight: 800; color: var(--text-main); display: inline-flex; align-items: center; gap: 10px; cursor: pointer; min-width: 220px; justify-content: space-between; box-shadow: var(--shadow-xs); transition: all 0.2s ease;">
                  <span style="display: flex; align-items: center; gap: 6px;">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary);"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <span>Trạng thái (${activeSelectedDakLakStatuses.length} đã chọn)</span>
                  </span>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--text-soft);"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>

                <div id="ddReportDakLakStatusMenu" class="custom-select-menu" style="display: ${activeOpenDropdownId === 'ddReportDakLakStatusMenu' ? 'block' : 'none'}; position: absolute; top: calc(100% + 6px); left: 0; min-width: 270px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 14px; box-shadow: 0 16px 36px rgba(0,0,0,0.3); z-index: 999; padding: 10px; backdrop-filter: blur(16px); max-height: 320px; overflow-y: auto;">
                  
                  <!-- Action Toolbar -->
                  <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid var(--border); gap: 6px; flex-wrap: wrap;">
                    <button type="button" onclick="selectAllDakLakStatusOptions(event)" style="background: var(--bg-soft); border: 1px solid var(--border); color: #3b82f6; font-size: 11px; font-weight: 800; padding: 4px 8px; border-radius: 6px; cursor: pointer;">Tất cả</button>
                    <button type="button" onclick="clearAllDakLakStatusOptions(event)" style="background: var(--bg-soft); border: 1px solid var(--border); color: #ef4444; font-size: 11px; font-weight: 800; padding: 4px 8px; border-radius: 6px; cursor: pointer;">Xóa</button>
                  </div>

                  <!-- Status Checkbox List -->
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    ${Object.entries(PENDING_STATUS_MAP).map(([sKey, sVal]) => {
                      const isSel = activeSelectedDakLakStatuses.includes(sKey);
                      return `
                        <label onclick="toggleDakLakStatusOption('${sKey}', event)" style="display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; border-radius: 8px; cursor: pointer; transition: background 0.15s ease; ${isSel ? 'background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850;' : 'color: var(--text-main); font-weight: 750;'}">
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" ${isSel ? 'checked' : ''} style="width: 15px; height: 15px; accent-color: #d8b46d; cursor: pointer;" />
                            <span style="font-size: 12.5px;">${escapeHtmlOutput(sVal.label)}</span>
                          </div>
                          <span style="width: 8px; height: 8px; border-radius: 50%; background: ${sVal.color};"></span>
                        </label>
                      `;
                    }).join('')}
                  </div>
                </div>
              </div>
              ` : ''}

              ${activeGdvReportView === 'weekly_zone' ? `
                <!-- Custom Branch Dropdown -->
                <div class="custom-select-wrapper" style="position: relative;">
                  <button type="button" class="custom-select-trigger report-filter-select-trigger ${activeOpenDropdownId === 'ddReportBranchMenu' ? 'is-open' : ''}" onclick="toggleCustomDropdownMenu('ddReportBranchMenu', event)" style="padding: 9px 16px; border-radius: 12px; background: var(--bg-soft); border: 1px solid var(--border-strong); font-size: 13px; font-weight: 800; color: var(--text-main); display: inline-flex; align-items: center; gap: 10px; cursor: pointer; min-width: 220px; justify-content: space-between; box-shadow: var(--shadow-xs);">
                    <span style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px;">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary); flex-shrink: 0;"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path><path d="M6 12H4a2 2 0 0 0-2 2v8h4"></path><path d="M18 9h2a2 2 0 0 1 2 2v11h-4"></path></svg>
                      <span>${activeGdvReportBranch === 'all' ? 'Tất cả chi nhánh cấp đơn' : activeGdvReportBranch}</span>
                    </span>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--text-soft); flex-shrink: 0;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </button>

                  <div id="ddReportBranchMenu" class="custom-select-menu report-filter-select-menu report-filter-branch-menu" style="display: ${activeOpenDropdownId === 'ddReportBranchMenu' ? 'block' : 'none'}; position: absolute; top: calc(100% + 8px); left: 0; z-index: 999;">
                    <div class="report-filter-menu-head"><span class="report-filter-menu-head__icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path><path d="M6 12H4a2 2 0 0 0-2 2v8h4M18 9h2a2 2 0 0 1 2 2v11h-4"></path></svg></span><div><div class="report-filter-menu-head__title">Chi nhánh cấp đơn</div><div class="report-filter-menu-head__meta">Chọn phạm vi dữ liệu</div></div></div>
                    <div class="report-filter-menu-body">
                    <div class="custom-select-item report-filter-select-item ${activeGdvReportBranch === 'all' ? 'active' : ''}" onclick="selectGdvReportBranch('all')" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; ${activeGdvReportBranch === 'all' ? 'background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850;' : ''}">
                      <span>Tất cả chi nhánh cấp đơn</span>
                      ${activeGdvReportBranch === 'all' ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--primary)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                    </div>
                    ${branchList.filter(b => b !== 'all').map(b => `
                      <div class="custom-select-item report-filter-select-item ${b === activeGdvReportBranch ? 'active' : ''}" onclick="selectGdvReportBranch('${escapeAttributeData(b)}')" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; ${b === activeGdvReportBranch ? 'background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850;' : ''}">
                        <span>${escapeHtmlOutput(b)}</span>
                        ${b === activeGdvReportBranch ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--primary)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                      </div>
                    `).join('')}
                    </div>
                  </div>
                </div>

                <!-- Start Date & End Date Pickers + Áp dụng Button -->
                <div class="gdv-report-date-actions" style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                  <div class="custom-select-wrapper gdv-report-date-picker-shell">
                    <button id="reportStartDateTrigger" type="button" class="report-date-trigger" onclick="openReportDatePicker('start', event)" aria-haspopup="dialog" aria-controls="customReportDatePickerPanel">
                      <span class="report-date-trigger__icon"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="3" y="4" width="18" height="17" rx="2"></rect><path d="M8 2v4M16 2v4M3 10h18"></path></svg></span>
                      <span class="report-date-trigger__content"><span class="report-date-trigger__label">Từ ngày</span><span id="reportStartDateValue" class="report-date-trigger__value">${formatReportDateDisplay(pendingGdvReportStartDate || activeGdvReportStartDate || getGdvReportDefaultDates().startYmd)}</span></span>
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" style="color: var(--text-muted);"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>

                    <button id="reportEndDateTrigger" type="button" class="report-date-trigger" onclick="openReportDatePicker('end', event)" aria-haspopup="dialog" aria-controls="customReportDatePickerPanel">
                      <span class="report-date-trigger__icon"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="3" y="4" width="18" height="17" rx="2"></rect><path d="M8 2v4M16 2v4M3 10h18"></path></svg></span>
                      <span class="report-date-trigger__content"><span class="report-date-trigger__label">Đến ngày</span><span id="reportEndDateValue" class="report-date-trigger__value">${formatReportDateDisplay(pendingGdvReportEndDate || activeGdvReportEndDate || getGdvReportDefaultDates().endYmd)}</span></span>
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" style="color: var(--text-muted);"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>

                    <div id="customReportDatePickerPanel" class="custom-select-menu report-date-picker-panel" role="dialog" aria-label="Chọn khoảng ngày báo cáo" style="display: none;">
                      ${buildReportDatePickerPanelHtml()}
                    </div>
                  </div>

                  <button type="button" onclick="applyGdvReportFilter()" style="padding: 0 20px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #ffffff; border: none; font-size: 13px; font-weight: 850; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 14px rgba(59,130,246,0.35); transition: all 0.2s ease;">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <span>Áp dụng</span>
                  </button>
                </div>
              ` : activeGdvReportView === 'annual_claims_gdv' ? `
                <div class="custom-select-wrapper" style="position: relative;" id="annualClaimsYearFilterWrapper">
                  <button type="button" class="custom-select-trigger report-filter-select-trigger ${activeOpenDropdownId === 'ddAnnualClaimsYearMenu' ? 'is-open' : ''}" onclick="toggleCustomDropdownMenu('ddAnnualClaimsYearMenu', event)" style="padding: 9px 15px; border-radius: 12px; background: var(--bg-soft); border: 1px solid var(--border-strong); font-size: 13px; font-weight: 850; color: var(--text-main); display: inline-flex; align-items: center; gap: 10px; cursor: pointer; min-width: 150px; justify-content: space-between; box-shadow: var(--shadow-xs);">
                    <span style="display: inline-flex; align-items: center; gap: 8px;"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="var(--primary)" stroke-width="2.3"><rect x="3" y="4" width="18" height="17" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path></svg>Năm ${escapeHtmlOutput(activeAnnualClaimsYear)}</span>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="var(--text-soft)" stroke-width="2.3"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </button>
                  <div id="ddAnnualClaimsYearMenu" class="custom-select-menu report-filter-select-menu" style="display: ${activeOpenDropdownId === 'ddAnnualClaimsYearMenu' ? 'block' : 'none'}; position: absolute; top: calc(100% + 8px); left: 0; z-index: 999; min-width: 170px; max-height: 300px; overflow-y: auto;">
                    <div class="report-filter-menu-head"><span class="report-filter-menu-head__icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="3" y="4" width="18" height="17" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path></svg></span><div><div class="report-filter-menu-head__title">Năm báo cáo</div><div class="report-filter-menu-head__meta">Chọn năm cần thống kê</div></div></div>
                    ${getAnnualClaimsAvailableYears().map(year => `<div class="custom-select-item ${String(year) === String(activeAnnualClaimsYear) ? 'active' : ''}" onclick="selectAnnualClaimsYear('${year}')" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 800; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; ${String(year) === String(activeAnnualClaimsYear) ? 'background: rgba(216,180,109,0.15); color: var(--primary);' : ''}"><span>${year}</span></div>`).join('')}
                  </div>
                </div>
              ` : activeGdvReportView === 'tnds_ton' ? `
                <!-- Custom Branch Dropdown for TNDS Tồn -->
                <div class="custom-select-wrapper" style="position: relative;">
                  <button type="button" class="custom-select-trigger" onclick="toggleCustomDropdownMenu('ddReportBranchMenu', event)" style="padding: 9px 16px; border-radius: 12px; background: var(--bg-soft); border: 1px solid var(--border-strong); font-size: 13px; font-weight: 800; color: var(--text-main); display: inline-flex; align-items: center; gap: 10px; cursor: pointer; min-width: 220px; justify-content: space-between; box-shadow: var(--shadow-xs);">
                    <span style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px;">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary); flex-shrink: 0;"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path><path d="M6 12H4a2 2 0 0 0-2 2v8h4"></path><path d="M18 9h2a2 2 0 0 1 2 2v11h-4"></path></svg>
                      <span>${activeGdvReportBranch === 'all' ? 'Tất cả chi nhánh cấp đơn' : activeGdvReportBranch}</span>
                    </span>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--text-soft); flex-shrink: 0;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </button>

                  <div id="ddReportBranchMenu" class="custom-select-menu" style="display: none; position: absolute; top: calc(100% + 6px); left: 0; min-width: 250px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 14px; box-shadow: 0 16px 36px rgba(0,0,0,0.3); z-index: 999; padding: 6px; backdrop-filter: blur(16px); max-height: 280px; overflow-y: auto;">
                    <div class="custom-select-item ${activeGdvReportBranch === 'all' ? 'active' : ''}" onclick="selectGdvReportBranch('all')" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; ${activeGdvReportBranch === 'all' ? 'background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850;' : ''}">
                      <span>Tất cả chi nhánh cấp đơn</span>
                      ${activeGdvReportBranch === 'all' ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--primary)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                    </div>
                    ${branchList.filter(b => b !== 'all').map(b => `
                      <div class="custom-select-item ${b === activeGdvReportBranch ? 'active' : ''}" onclick="selectGdvReportBranch('${escapeAttributeData(b)}')" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; ${b === activeGdvReportBranch ? 'background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850;' : ''}">
                        <span>${escapeHtmlOutput(b)}</span>
                        ${b === activeGdvReportBranch ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--primary)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : activeGdvReportView === 'car_brand_loss' ? `
                <!-- Car Brand Multi-Select Month Dropdown -->
                <div class="custom-select-wrapper" style="position: relative;">
                  <button type="button" class="custom-select-trigger" onclick="toggleCustomDropdownMenu('ddReportCarBrandMonthMenu', event)" style="padding: 9px 16px; border-radius: 12px; background: var(--bg-soft); border: 1px solid var(--border-strong); font-size: 13px; font-weight: 800; color: var(--text-main); display: inline-flex; align-items: center; gap: 10px; cursor: pointer; min-width: 140px; justify-content: space-between; box-shadow: var(--shadow-xs); transition: all 0.2s ease;">
                    <span style="display: flex; align-items: center; gap: 6px;">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary);"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                      <span>Tháng (${activeCarBrandReportMonths.length})</span>
                    </span>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--text-soft);"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </button>

                  <div id="ddReportCarBrandMonthMenu" class="custom-select-menu" style="display: ${activeOpenDropdownId === 'ddReportCarBrandMonthMenu' ? 'block' : 'none'}; position: absolute; top: calc(100% + 6px); left: 0; min-width: 180px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 14px; box-shadow: 0 16px 36px rgba(0,0,0,0.3); z-index: 999; padding: 6px; backdrop-filter: blur(16px); max-height: 280px; overflow-y: auto;">
                    <div class="custom-select-item ${activeCarBrandReportMonths.includes('all') ? 'active' : ''}" onclick="toggleCarBrandMonth('all', event)" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; ${activeCarBrandReportMonths.includes('all') ? 'background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850;' : ''}">
                      <span>Tất cả các tháng</span>
                      ${activeCarBrandReportMonths.includes('all') ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--primary)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                    </div>
                    ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => {
                      const isSel = activeCarBrandReportMonths.includes(String(m));
                      return `
                      <div class="custom-select-item ${isSel ? 'active' : ''}" onclick="toggleCarBrandMonth('${m}', event)" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; ${isSel ? 'background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850;' : ''}">
                        <span>Tháng ${m}</span>
                        <div style="width: 16px; height: 16px; border-radius: 4px; border: 2px solid ${isSel ? 'var(--primary)' : 'var(--border-strong)'}; background: ${isSel ? 'var(--primary)' : 'transparent'}; display: flex; align-items: center; justify-content: center;">
                          ${isSel ? '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#111" stroke-width="4"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                        </div>
                      </div>
                    `;
                    }).join('')}
                  </div>
                </div>

                <!-- Car Brand Multi-Select Year Dropdown -->
                <div class="custom-select-wrapper" style="position: relative;">
                  <button type="button" class="custom-select-trigger" onclick="toggleCustomDropdownMenu('ddReportCarBrandYearMenu', event)" style="padding: 9px 16px; border-radius: 12px; background: var(--bg-soft); border: 1px solid var(--border-strong); font-size: 13px; font-weight: 800; color: var(--text-main); display: inline-flex; align-items: center; gap: 10px; cursor: pointer; min-width: 120px; justify-content: space-between; box-shadow: var(--shadow-xs); transition: all 0.2s ease;">
                    <span style="display: flex; align-items: center; gap: 6px;">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary);"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                      <span>Năm (${activeCarBrandReportYears.length})</span>
                    </span>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--text-soft);"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </button>

                  <div id="ddReportCarBrandYearMenu" class="custom-select-menu" style="display: ${activeOpenDropdownId === 'ddReportCarBrandYearMenu' ? 'block' : 'none'}; position: absolute; top: calc(100% + 6px); left: 0; min-width: 140px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 14px; box-shadow: 0 16px 36px rgba(0,0,0,0.3); z-index: 999; padding: 6px; backdrop-filter: blur(16px); max-height: 280px; overflow-y: auto;">
                    <div class="custom-select-item ${activeCarBrandReportYears.includes('all') ? 'active' : ''}" onclick="toggleCarBrandYear('all', event)" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; ${activeCarBrandReportYears.includes('all') ? 'background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850;' : ''}">
                      <span>Tất cả các năm</span>
                      ${activeCarBrandReportYears.includes('all') ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--primary)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                    </div>
                    ${yearList.map(y => {
                      const isSel = activeCarBrandReportYears.includes(String(y));
                      return `
                      <div class="custom-select-item ${isSel ? 'active' : ''}" onclick="toggleCarBrandYear('${y}', event)" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; ${isSel ? 'background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850;' : ''}">
                        <span>Năm ${y}</span>
                        <div style="width: 16px; height: 16px; border-radius: 4px; border: 2px solid ${isSel ? 'var(--primary)' : 'var(--border-strong)'}; background: ${isSel ? 'var(--primary)' : 'transparent'}; display: flex; align-items: center; justify-content: center;">
                          ${isSel ? '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#111" stroke-width="4"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                        </div>
                      </div>
                    `;
                    }).join('')}
                  </div>
                </div>
              ` : `
                <!-- Month Selection Dropdown -->
                <div class="custom-select-wrapper" style="position: relative;">
                  <button type="button" class="custom-select-trigger" onclick="toggleCustomDropdownMenu('ddReportMonthMenu', event)" style="padding: 9px 16px; border-radius: 12px; background: var(--bg-soft); border: 1px solid var(--border-strong); font-size: 13px; font-weight: 800; color: var(--text-main); display: inline-flex; align-items: center; gap: 10px; cursor: pointer; min-width: 140px; justify-content: space-between; box-shadow: var(--shadow-xs); transition: all 0.2s ease;">
                    <span style="display: flex; align-items: center; gap: 6px;">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary);"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                      <span>${activeGdvReportMonth === 'all' ? 'Toàn bộ tháng' : 'Tháng ' + activeGdvReportMonth}</span>
                    </span>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--text-soft);"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </button>

                  <div id="ddReportMonthMenu" class="custom-select-menu" style="display: none; position: absolute; top: calc(100% + 6px); left: 0; min-width: 160px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 14px; box-shadow: 0 16px 36px rgba(0,0,0,0.3); z-index: 999; padding: 6px; backdrop-filter: blur(16px); max-height: 280px; overflow-y: auto;">
                    <div class="custom-select-item ${activeGdvReportMonth === 'all' ? 'active' : ''}" onclick="selectGdvReportMonth('all')" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; ${activeGdvReportMonth === 'all' ? 'background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850;' : ''}">
                      <span>Toàn bộ tháng</span>
                      ${activeGdvReportMonth === 'all' ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--primary)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                    </div>
                    ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `
                      <div class="custom-select-item ${String(m) === String(activeGdvReportMonth) ? 'active' : ''}" onclick="selectGdvReportMonth('${m}')" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; ${String(m) === String(activeGdvReportMonth) ? 'background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850;' : ''}">
                        <span>Tháng ${m}</span>
                        ${String(m) === String(activeGdvReportMonth) ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--primary)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                      </div>
                    `).join('')}
                  </div>
                </div>

                <!-- Year Selection Dropdown -->
                <div class="custom-select-wrapper" style="position: relative;">
                  <button type="button" class="custom-select-trigger" onclick="toggleCustomDropdownMenu('ddReportYearMenu', event)" style="padding: 9px 16px; border-radius: 12px; background: var(--bg-soft); border: 1px solid var(--border-strong); font-size: 13px; font-weight: 800; color: var(--text-main); display: inline-flex; align-items: center; gap: 10px; cursor: pointer; min-width: 120px; justify-content: space-between; box-shadow: var(--shadow-xs); transition: all 0.2s ease;">
                    <span style="display: flex; align-items: center; gap: 6px;">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary);"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                      <span>${activeGdvReportYear === 'all' ? 'Tất cả các năm' : 'Năm ' + activeGdvReportYear}</span>
                    </span>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--text-soft);"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </button>

                  <div id="ddReportYearMenu" class="custom-select-menu" style="display: none; position: absolute; top: calc(100% + 6px); left: 0; min-width: 140px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 14px; box-shadow: 0 16px 36px rgba(0,0,0,0.3); z-index: 999; padding: 6px; backdrop-filter: blur(16px); max-height: 280px; overflow-y: auto;">
                    <div class="custom-select-item ${activeGdvReportYear === 'all' ? 'active' : ''}" onclick="selectGdvReportYear('all')" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; ${activeGdvReportYear === 'all' ? 'background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850;' : ''}">
                      <span>Tất cả các năm</span>
                      ${activeGdvReportYear === 'all' ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--primary)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                    </div>
                    ${yearList.map(y => `
                      <div class="custom-select-item ${String(y) === String(activeGdvReportYear) ? 'active' : ''}" onclick="selectGdvReportYear('${y}')" style="padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 750; color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: space-between; ${String(y) === String(activeGdvReportYear) ? 'background: rgba(216,180,109,0.15); color: var(--primary); font-weight: 850;' : ''}">
                        <span>Năm ${y}</span>
                        ${String(y) === String(activeGdvReportYear) ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--primary)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                      </div>
                    `).join('')}
                  </div>
                </div>
              `}
            </div>

            <div id="reportFilterUtilitySlot" class="report-filter-utility-slot" aria-label="Tiện ích bộ lọc"></div>

            </div>

          </section>

          ${(activeGdvReportView !== 'garage' && activeGdvReportView !== 'weekly_zone' && activeGdvReportView !== 'annual_claims_gdv' && activeGdvReportView !== 'daklak_reserve' && activeGdvReportView !== 'ton_chua_hoa_don' && activeGdvReportView !== 'car_brand_loss' && activeGdvReportView !== 'tnds_ton') ? `
          <!-- EXECUTIVE KPI METRIC CARDS (4 CARDS) -->
          <div class="${activeGdvReportView === 'chart' ? 'kpi-summary-strip' : ''}" aria-label="Tổng quan hiệu suất" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; margin-bottom: 24px;">
            <div class="p-card stat-widget" style="padding: 20px; border-radius: 18px; border: 1px solid rgba(216,180,109,0.35); background: var(--surface); box-shadow: var(--shadow-sm);">
              <span style="font-size: 11.5px; color: var(--text-soft); font-weight: 850; text-transform: uppercase;">HỒ SƠ MỞ TRONG THÁNG</span>
              <strong style="display: block; font-size: 30px; color: var(--primary);  margin-top: 10px; font-weight: 850;">
                ${totalFilteredClaims} <span style="font-size: 14px; color: var(--text-soft);">ca</span>
              </strong>
            </div>

            <div class="p-card stat-widget" style="padding: 20px; border-radius: 18px; border: 1px solid rgba(16,185,129,0.35); background: var(--surface); box-shadow: var(--shadow-sm);">
              <span style="font-size: 11.5px; color: var(--text-soft); font-weight: 850; text-transform: uppercase;">ĐÃ DUYỆT HSBT</span>
              <strong style="display: block; font-size: 30px; color: #10b981;  margin-top: 10px; font-weight: 850;">
                ${totalDuyetHsbtCount} <span style="font-size: 14px; color: var(--text-soft);">ca</span>
              </strong>
            </div>

            <div class="p-card stat-widget" style="padding: 20px; border-radius: 18px; border: 1px solid rgba(59,130,246,0.35); background: var(--surface); box-shadow: var(--shadow-sm);">
              <span style="font-size: 11.5px; color: var(--text-soft); font-weight: 850; text-transform: uppercase;">TỶ LỆ DUYỆT TOÀN TEAM</span>
              <strong style="display: block; font-size: 30px; color: #3b82f6;  margin-top: 10px; font-weight: 850;">
                ${overallHsbtRate}%
              </strong>
            </div>

            <div class="p-card stat-widget" style="padding: 20px; border-radius: 18px; border: 1px solid rgba(168,85,247,0.35); background: var(--surface); box-shadow: var(--shadow-sm);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11.5px; color: var(--text-soft); font-weight: 850; text-transform: uppercase;">ĐẠT TIẾN ĐỘ / KPI THÁNG</span>
                <span style="font-size: 10px; font-weight: 850; background: rgba(59,130,246,0.12); color: #3b82f6; padding: 2px 7px; border-radius: 6px; border: 1px solid rgba(59,130,246,0.25);">Ngày ${kpiMetrics.daysPassed}/${kpiMetrics.totalDaysInMonth}</span>
              </div>
              <strong style="display: block; font-size: 26px; color: #a855f7; margin-top: 8px; font-weight: 850; line-height: 1.2;">
                ${passProgressCount} <span style="font-size: 13px; color: var(--text-soft); font-weight: 750;">/ ${gdvRows.length} đạt tiến độ (${kpiMetrics.progressTarget} ca)</span>
              </strong>
              <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 6px; font-weight: 750;">
                Đạt KPI tháng (70 ca): <strong style="color: #10b981;">${passKpiCount}/${gdvRows.length}</strong> GĐV
              </div>
            </div>
          </div>
          ` : ''}

          <!-- CONDITIONAL RENDERING BASED ON activeGdvReportView -->
          ${activeGdvReportView === 'weekly_zone' ? renderWeeklyZoneReportTableHtml() : activeGdvReportView === 'annual_claims_gdv' ? renderAnnualGdvClaimsReportHtml() : activeGdvReportView === 'tnds_ton' ? renderTndsTonReportTableHtml() : activeGdvReportView === 'car_brand_loss' ? renderCarBrandLossReportTableHtml() : activeGdvReportView === 'daklak_reserve' ? renderDakLakReserveReportTableHtml() : activeGdvReportView === 'ton_chua_hoa_don' ? renderTonChuaHoaDonReportTableHtml() : activeGdvReportView === 'garage' ? `
            
            <!-- EXECUTIVE GARAGE REPORT DASHBOARD -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 24px;">
              <div class="p-card stat-widget" style="padding: 20px; border-radius: 18px; border: 1px solid rgba(216,180,109,0.35); background: var(--surface); box-shadow: var(--shadow-sm);">
                <span style="font-size: 11.5px; color: var(--text-soft); font-weight: 850; text-transform: uppercase;">TỔNG TIỀN BỒI THƯỜNG GARA</span>
                <strong style="display: block; font-size: 26px; color: var(--primary);  margin-top: 10px; font-weight: 850;">
                  ${formatCurrencyInputNumber(totalGaragePayout)} <span style="font-size: 14px; color: var(--text-soft);">đ</span>
                </strong>
              </div>

              <div class="p-card stat-widget" style="padding: 20px; border-radius: 18px; border: 1px solid rgba(16,185,129,0.35); background: var(--surface); box-shadow: var(--shadow-sm);">
                <span style="font-size: 11.5px; color: var(--text-soft); font-weight: 850; text-transform: uppercase;">TỔNG SỐ GARA PHÁT SINH</span>
                <strong style="display: block; font-size: 26px; color: #10b981;  margin-top: 10px; font-weight: 850;">
                  ${activeGarageCount} <span style="font-size: 14px; color: var(--text-soft);">đơn vị</span>
                </strong>
              </div>

              <div class="p-card stat-widget" style="padding: 20px; border-radius: 18px; border: 1px solid rgba(59,130,246,0.35); background: var(--surface); box-shadow: var(--shadow-sm);">
                <span style="font-size: 11.5px; color: var(--text-soft); font-weight: 850; text-transform: uppercase;">GARA BỒI THƯỜNG LỚN NHẤT</span>
                <strong style="display: block; font-size: 16px; color: #3b82f6; margin-top: 10px; font-weight: 850; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                  ${topGarageObj ? escapeHtmlOutput(topGarageObj.name) : 'Chưa có'}
                </strong>
                <span style="font-size: 12px; color: var(--text-muted); ">
                  ${topGarageObj ? formatCurrencyInputNumber(topGarageObj.totalApprovedAmount) + ' đ' : '0 đ'}
                </span>
              </div>
            </div>

            
            <!-- COMBO BAR + LINE VECTOR CHART SECTION FOR GARAGES -->
            <div id="garageChartCardContainer" style="background: var(--surface); border: 1px solid var(--border-strong); border-radius: 20px; padding: 22px 26px; margin-bottom: 24px; box-shadow: var(--shadow-sm);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
                <div style="font-size: 13px; font-weight: 850; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 8px;">
                  BIỂU ĐỒ & BẢNG KÊ GARA
                  <select onchange="activeGarageChartTopN=Number(this.value); renderGdvMonthlyReportPage();" style="background: var(--surface); color: var(--text-main); border: 1px solid var(--border-strong); padding: 5px 10px; border-radius: 8px; font-weight: 750; font-size: 12px; outline: none; cursor: pointer; box-shadow: var(--shadow-xs);">
                    <option value="5" ${activeGarageChartTopN === 5 ? 'selected' : ''}>Top 5</option>
                    <option value="10" ${activeGarageChartTopN === 10 ? 'selected' : ''}>Top 10</option>
                    <option value="15" ${activeGarageChartTopN === 15 ? 'selected' : ''}>Top 15</option>
                    <option value="20" ${activeGarageChartTopN === 20 ? 'selected' : ''}>Top 20</option>
                    <option value="999" ${activeGarageChartTopN === 999 ? 'selected' : ''}>Tất cả</option>
                  </select>
                </div>
                <div class="hide-on-screenshot" style="display: flex; gap: 8px;">
                  <button type="button" onclick="downloadGarageLossChartImage()" title="Tải ảnh Biểu đồ Ultra HD (4K / 300 DPI)" style="padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border-strong); font-size: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s ease; background: var(--surface); color: var(--text-main); display: flex; align-items: center; gap: 6px;">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Tải ảnh
                  </button>
                  <button type="button" onclick="activeGarageChartType='bar'; renderGdvMonthlyReportPage();" style="padding: 6px 12px; border-radius: 8px; border: none; font-size: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s ease; ${activeGarageChartType === 'bar' ? 'background: var(--primary); color: #111;' : 'background: rgba(216,180,109,0.15); color: var(--primary);'}">Biểu đồ Cột</button>
                  <button type="button" onclick="activeGarageChartType='pie'; renderGdvMonthlyReportPage();" style="padding: 6px 12px; border-radius: 8px; border: none; font-size: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s ease; ${activeGarageChartType === 'pie' ? 'background: var(--primary); color: #111;' : 'background: rgba(216,180,109,0.15); color: var(--primary);'}">Biểu đồ Tròn</button>
                </div>
              </div>
              <div id="garageLossCanvasWrap" style="position: relative; height: 400px; width: 100%; transition: height 0.3s ease;">
                <canvas id="garageLossCanvas"></canvas>
                <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" onload="if(window.initGarageLossChart) setTimeout(window.initGarageLossChart, 50); this.remove();" style="display:none;" />
              </div>
            </div>

            <!-- DETAILED BREAKDOWN LIST BELOW (RETAINED AS CURRENTLY ARE) -->
            <!-- DETAILED BREAKDOWN LIST BELOW (RETAINED AS CURRENTLY ARE) -->
            <div style="background: var(--surface); border: 1px solid var(--border-strong); border-radius: 20px; padding: 22px 26px; margin-bottom: 24px; box-shadow: var(--shadow-sm);">
              <div style="font-size: 13px; font-weight: 850; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--primary)" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                  <span>Chi tiết Phân bổ Bồi thường & Hồ sơ GĐV theo từng Gara</span>
                </div>
                <span style="font-size: 11px; background: var(--bg-soft); border: 1px solid var(--border); color: var(--text-soft); padding: 3px 10px; border-radius: 99px;  font-weight: 850;">Top ${garageRows.length} Gara</span>
              </div>
              
              <div class="gara-premium-grid">
                ${garageRows.length === 0 ? `
                  <div style="padding: 40px; text-align: center; color: var(--text-muted); font-size: 14px; grid-column: 1 / -1;">Chưa có dữ liệu hồ sơ bồi thường gara nào trong mốc thời gian này.</div>
                ` : garageRows.map((g, gIdx) => {
                  const maxAmt = garageRows[0] ? garageRows[0].totalApprovedAmount || 1 : 1;
                  const pct = Math.min(100, Math.max(5, Math.round((g.totalApprovedAmount / maxAmt) * 100)));
                  const colors = [
                    { color: '#3b82f6', bg: 'rgba(59,130,246,0.04)', border: 'rgba(59,130,246,0.2)' },
                    { color: 'var(--primary)', bg: 'rgba(216,180,109,0.04)', border: 'rgba(216,180,109,0.2)' },
                    { color: '#10b981', bg: 'rgba(16,185,129,0.04)', border: 'rgba(16,185,129,0.2)' }
                  ];
                  const gdvList = selectedGdvList.map((gName, idx) => {
                    const data = g.gdvBreakdown[gName] || { opened: 0, amount: 0, approved: 0 };
                    const style = colors[idx % colors.length];
                    return {
                      name: gName,
                      opened: data.opened,
                      amount: data.amount,
                      approved: data.approved,
                      ...style
                    };
                  });

                  // Sort descending by claims count
                  gdvList.sort((a, b) => (b.opened || 0) - (a.opened || 0));

                  const gdvBreakdownHtml = gdvList.map(item => {
                    const amountStr = formatCurrencyInputNumber(item.amount);
                    const initials = getGdvInitials(item.name);
                    return `
                      <div class="gdv-micro-card">
                        <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                          <div style="width: 24px; height: 24px; border-radius: 50%; background: ${item.bg}; color: ${item.color}; border: 1px solid ${item.border}; display: grid; place-items: center; flex-shrink: 0; font-size: 9px; font-weight: 900;">
                            ${initials}
                          </div>
                          <div style="overflow: hidden;">
                            <span style="display: block; font-size: 11.5px; font-weight: 800; color: var(--text-main); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${escapeHtmlOutput(item.name)}</span>
                            <span style="font-size: 10px; color: var(--text-soft);  font-weight: 750;">${amountStr}đ</span>
                          </div>
                        </div>
                        <span style="font-size: 10px; font-weight: 850; color: ${item.color};  background: ${item.bg}; padding: 2px 7px; border-radius: 6px; border: 1px solid ${item.border}; flex-shrink: 0;">${item.approved} hồ sơ</span>
                      </div>
                    `;
                  }).join('');

                  const rankBg = gIdx === 0 ? 'linear-gradient(135deg, #ffd700 0%, #ffa500 100%)' :
                                 gIdx === 1 ? 'linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%)' :
                                 gIdx === 2 ? 'linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)' :
                                 'var(--bg-soft)';
                  const rankBorder = gIdx === 0 ? 'rgba(255,215,0,0.5)' :
                                     gIdx === 1 ? 'rgba(203,213,225,0.7)' :
                                     gIdx === 2 ? 'rgba(254,215,170,0.7)' :
                                     'var(--border)';
                  const rankColor = gIdx === 0 ? '#78350f' :
                                    gIdx === 1 ? '#334155' :
                                    gIdx === 2 ? '#7c2d12' :
                                    'var(--text-soft)';
                  const rankShadow = gIdx < 3 ? '0 4px 10px rgba(0,0,0,0.06)' : 'none';

                  return `
                    <div class="gara-premium-card">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                          <span style="font-size: 10px; font-weight: 900; background: ${rankBg}; border: 1px solid ${rankBorder}; color: ${rankColor}; width: 24px; height: 24px; border-radius: 6px; display: grid; place-items: center; flex-shrink: 0; box-shadow: ${rankShadow}; ">#${gIdx + 1}</span>
                          <div style="overflow: hidden;">
                            <strong style="font-size: 13.5px; color: var(--text-main); font-weight: 850; letter-spacing: -0.01em; display: block; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${escapeHtmlOutput(g.name)}">${escapeHtmlOutput(g.name)}</strong>
                            ${g.code !== 'N/A' && g.code !== g.name ? `<span style="font-size: 9.5px; color: var(--text-soft);  background: var(--bg-soft); border: 1px solid var(--border); padding: 1px 5px; border-radius: 4px; display: inline-block; margin-top: 2px;">${escapeHtmlOutput(g.code)}</span>` : ''}
                          </div>
                        </div>

                        <div style="text-align: right; flex-shrink: 0;">
                          <strong style="font-size: 14.5px; color: #10b981;  font-weight: 850; display: block; line-height: 1.2;">
                            ${formatCurrencyInputNumber(g.totalApprovedAmount)}<span style="font-size: 10px; font-weight: 700; color: var(--text-soft); margin-left: 1px;">đ</span>
                          </strong>
                          <span style="font-size: 10.5px; color: var(--text-soft); font-weight: 750; display: block; margin-top: 2px;">
                            ${g.totalClaimsCount} hồ sơ
                          </span>
                        </div>
                      </div>

                      <!-- Progress Bar -->
                      <div style="height: 5px; width: 100%; background: var(--border); border-radius: 99px; overflow: hidden; margin-top: 4px;">
                        <div style="height: 100%; width: ${pct}%; background: linear-gradient(90deg, #10b981 0%, #3b82f6 100%); border-radius: 99px; transition: width 0.4s ease;"></div>
                      </div>

                      <!-- GĐV Breakdown Grid -->
                      <div style="display: flex; flex-direction: column; gap: 8px; border-top: 1px dashed var(--border); padding-top: 10px; margin-top: 4px;">
                        ${gdvBreakdownHtml}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : activeGdvReportView === 'chart' ? `
            
            <!-- GĐV KPI CARDS GRID -->
            <div class="kpi-team-grid" aria-label="Hiệu suất từng giám định viên" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px;">
              ${gdvRows.map(r => {
                const kpiVal = Math.round((r.weightedKpiCount || r.duyetHsbtCount) * 10) / 10;
                const kpiAchievementRate = Math.round((kpiVal / 70) * 100);
                const progressRate = kpiMetrics.progressTarget > 0 ? Math.round((kpiVal / kpiMetrics.progressTarget) * 100) : 0;
                const progressDiff = Math.round((kpiVal - kpiMetrics.progressTarget) * 10) / 10;

                let kpiBadgeBg = 'rgba(239,68,68,0.12)';
                let kpiBadgeBorder = 'rgba(239,68,68,0.3)';
                let kpiBadgeColor = '#ef4444';
                let kpiStatusLabel = `CHẬM TIẾN ĐỘ (${progressRate}%)`;

                if (kpiVal >= 70) {
                  kpiBadgeBg = 'rgba(16,185,129,0.15)';
                  kpiBadgeBorder = 'rgba(16,185,129,0.35)';
                  kpiBadgeColor = '#10b981';
                  kpiStatusLabel = 'ĐẠT KPI TÍNH LƯƠNG';
                } else if (kpiVal >= kpiMetrics.progressTarget) {
                  kpiBadgeBg = 'rgba(59,130,246,0.15)';
                  kpiBadgeBorder = 'rgba(59,130,246,0.35)';
                  kpiBadgeColor = '#3b82f6';
                  kpiStatusLabel = `VƯỢT TIẾN ĐỘ (${progressRate}%)`;
                } else if (progressRate >= 80) {
                  kpiBadgeBg = 'rgba(234,179,8,0.15)';
                  kpiBadgeBorder = 'rgba(234,179,8,0.35)';
                  kpiBadgeColor = '#eab308';
                  kpiStatusLabel = `TIỆM CẬN TIẾN ĐỘ (${progressRate}%)`;
                }

                const initials = getGdvInitials(r.gdvName);

                return `
                  <article class="kpi-person-card" style="background: var(--surface); border: 1px solid var(--border-strong); border-radius: 16px; padding: 18px; box-shadow: var(--shadow-sm);">
                    <div class="kpi-person-head" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                      <div class="kpi-person-identity" style="display: flex; align-items: center; gap: 10px;">
                        <div class="kpi-person-avatar" style="width: 36px; height: 36px; border-radius: 10px; background: rgba(216,180,109,0.15); border: 1px solid rgba(216,180,109,0.3); color: var(--primary); font-weight: 850; font-size: 12px; display: grid; place-items: center;">
                          ${initials}
                        </div>
                        <div>
                          <strong style="display: block; font-size: 12px; color: var(--text-main); font-weight: 850;">${escapeHtmlOutput(r.gdvName)}</strong>
                          <span style="font-size: 11px; color: var(--text-soft);">${escapeHtmlOutput(r.branch)}</span>
                        </div>
                      </div>
                      <span class="kpi-person-status" data-state="${kpiVal >= 70 ? 'complete' : kpiVal >= kpiMetrics.progressTarget ? 'ahead' : progressRate >= 80 ? 'near' : 'behind'}" style="font-size: 10px; font-weight: 850; padding: 3px 8px; border-radius: 99px; background: ${kpiBadgeBg}; border: 1px solid ${kpiBadgeBorder}; color: ${kpiBadgeColor}; ">
                        ${kpiStatusLabel}
                      </span>
                    </div>

                    <div class="kpi-person-metrics" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; border-top: 1px dashed var(--border); padding-top: 10px; margin-top: 4px;">
                      <div>
                        <span style="font-size: 9.5px; color: var(--text-muted); text-transform: uppercase; font-weight: 750;">Số HS làm</span>
                        <strong style="display: block; font-size: 15px; color: var(--primary);  font-weight: 850;">${r.totalOpenedCount} ca</strong>
                      </div>
                      <div>
                        <span style="font-size: 9.5px; color: var(--text-muted); text-transform: uppercase; font-weight: 750;">Duyệt KPI quy đổi</span>
                        <strong style="display: block; font-size: 15px; color: #10b981;  font-weight: 850;">${kpiVal} ca <span style="font-size: 10px; color: var(--text-soft);">(${r.duyetHsbtCount} gốc)</span></strong>
                      </div>
                      <div>
                        <span style="font-size: 9.5px; color: var(--text-muted); text-transform: uppercase; font-weight: 750;">KPI tháng (70 ca)</span>
                        <strong style="display: block; font-size: 15px; color: ${kpiVal >= 70 ? '#10b981' : 'var(--text-main)'};  font-weight: 850;">${kpiAchievementRate}%</strong>
                      </div>
                    </div>

                    <div class="kpi-person-progress" data-state="${kpiVal >= kpiMetrics.progressTarget ? 'ahead' : 'behind'}" style="margin-top: 10px; padding: 7px 10px; border-radius: 8px; font-size: 11px; font-weight: 750; display: flex; justify-content: space-between; align-items: center; ${kpiVal >= kpiMetrics.progressTarget ? 'background: rgba(59,130,246,0.08); color: #2563eb; border: 1px solid rgba(59,130,246,0.2);' : 'background: rgba(239,68,68,0.08); color: #dc2626; border: 1px solid rgba(239,68,68,0.2);'}">
                      <span>Tiến độ ngày ${kpiMetrics.daysPassed}/${kpiMetrics.totalDaysInMonth} (${kpiMetrics.progressTarget} ca):</span>
                      <strong style="font-weight: 850;">${progressDiff >= 0 ? `+${progressDiff} ca ✓` : `${progressDiff} ca`}</strong>
                    </div>
                  </article>
                `;
              }).join('')}
            </div>

            <!-- EXECUTIVE GDV KPI CHART SECTION (HARMONIZED WITH GARAGE CHART STYLE) -->
            <div id="kpiChartCardContainer" class="kpi-chart-card" style="background: var(--surface); border: 1px solid var(--border-strong); border-radius: 20px; padding: 22px 26px; margin-bottom: 24px; box-shadow: var(--shadow-sm);">
              
              <!-- Chart Title Bar -->
              <div class="kpi-chart-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
                <div>
                  <span class="kpi-eyebrow">HIỆU SUẤT GIÁM ĐỊNH</span><div class="kpi-chart-title" style="font-size: 13px; font-weight: 850; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 8px;">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#3b82f6" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                    <span>Xu hướng KPI & lương giám định viên</span>
                  </div>
                  <p style="font-size: 12px; color: var(--text-soft); margin-top: 4px; margin-bottom: 0;">
                    So sánh số hồ sơ tiếp nhận với hồ sơ duyệt HSBT, vạch tiến độ kỳ vọng <strong>${kpiMetrics.progressTarget} ca</strong> (ngày ${kpiMetrics.daysPassed}/${kpiMetrics.totalDaysInMonth}) và vạch chuẩn KPI tính lương <strong>70 ca/tháng</strong>.
                  </p>
                </div>

                <!-- Export & Type Toggle Actions -->
                <div class="hide-on-screenshot kpi-chart-actions" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                  <button type="button" class="kpi-chart-download" onclick="downloadGdvKpiChartImage()" title="Tải ảnh Biểu đồ Ultra HD (4K / 300 DPI)" style="padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border-strong); font-size: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s ease; background: var(--surface); color: var(--text-main); display: flex; align-items: center; gap: 6px;">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Tải ảnh
                  </button>
                  <div class="kpi-chart-toggle" role="group" aria-label="Kiểu biểu đồ KPI">
                  <button type="button" class="kpi-chart-type" aria-pressed="${activeGdvKpiChartType === 'line'}" onclick="activeGdvKpiChartType='line'; renderGdvMonthlyReportPage();" style="padding: 6px 14px; border-radius: 8px; border: none; font-size: 12px; font-weight: 850; cursor: pointer; transition: all 0.2s ease; ${activeGdvKpiChartType === 'line' ? 'background: var(--primary); color: #111;' : 'background: rgba(216,180,109,0.15); color: var(--primary);'}">Biểu đồ Đường</button>
                  <button type="button" class="kpi-chart-type" aria-pressed="${activeGdvKpiChartType === 'bar'}" onclick="activeGdvKpiChartType='bar'; renderGdvMonthlyReportPage();" style="padding: 6px 14px; border-radius: 8px; border: none; font-size: 12px; font-weight: 850; cursor: pointer; transition: all 0.2s ease; ${activeGdvKpiChartType === 'bar' ? 'background: var(--primary); color: #111;' : 'background: rgba(216,180,109,0.15); color: var(--primary);'}">Biểu đồ Cột</button>
                  <button type="button" class="kpi-chart-type" aria-pressed="${activeGdvKpiChartType === 'pie'}" onclick="activeGdvKpiChartType='pie'; renderGdvMonthlyReportPage();" style="padding: 6px 14px; border-radius: 8px; border: none; font-size: 12px; font-weight: 850; cursor: pointer; transition: all 0.2s ease; ${activeGdvKpiChartType === 'pie' ? 'background: var(--primary); color: #111;' : 'background: rgba(216,180,109,0.15); color: var(--primary);'}">Biểu đồ Tròn</button>
                  </div>
                </div>
              </div>

              <!-- CHART.JS CANVAS WRAPPER -->
              <div id="gdvKpiCanvasWrap" style="position: relative; height: 420px; width: 100%; transition: height 0.3s ease;">
                <canvas id="gdvKpiCanvas" role="img" aria-label="Biểu đồ hiệu suất và tiến độ KPI theo giám định viên"></canvas>
                <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" onload="if(window.initGdvKpiChart) setTimeout(window.initGdvKpiChart, 50); this.remove();" style="display:none;" />
              </div>
            </div>

          ` : `
            
            <!-- TOP 3 PODIUM SHOWCASE (LEADERBOARD) -->
            ${top3Performers.length > 0 ? `
              <div style="margin-bottom: 24px;">
                <div style="font-size: 12.5px; font-weight: 850; color: var(--primary); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"></path></svg>
                  <span>Vinh danh Top 3 GĐV Phụ trách Khối lượng lớn nhất</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
                  ${top3Performers.map((p, pIdx) => {
                    const medals = ['🥇 Top 1', '🥈 Top 2', '🥉 Top 3'];
                    const borders = ['rgba(216,180,109,0.5)', 'rgba(148,163,184,0.5)', 'rgba(217,119,6,0.5)'];
                    const badgeBgs = ['rgba(216,180,109,0.15)', 'rgba(148,163,184,0.15)', 'rgba(217,119,6,0.15)'];
                    const initials = getGdvInitials(p.gdvName);
                    const rateHsbt = p.totalOpenedCount > 0 ? Math.round((p.duyetHsbtCount / p.totalOpenedCount) * 100) : 0;

                    return `
                      <div style="background: var(--surface); border: 1px solid ${borders[pIdx]}; border-radius: 16px; padding: 18px; box-shadow: var(--shadow-sm); position: relative;">
                        <div style="position: absolute; right: 14px; top: 14px; font-size: 11px; font-weight: 850; padding: 3px 10px; border-radius: 99px; background: ${badgeBgs[pIdx]}; border: 1px solid ${borders[pIdx]}; color: var(--text-main);">
                          ${medals[pIdx]}
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                          <div style="width: 44px; height: 44px; border-radius: 10px; background: linear-gradient(135deg, rgba(216,180,109,0.2) 0%, rgba(216,180,109,0.05) 100%); border: 1.5px solid rgba(216,180,109,0.4); color: var(--primary); font-weight: 900; font-size: 15px; display: grid; place-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                            ${initials}
                          </div>
                          <div>
                            <strong style="display: block; font-size: 14.5px; color: var(--text-main); font-weight: 850;">${escapeHtmlOutput(p.gdvName)}</strong>
                            <span style="font-size: 11.5px; color: var(--text-soft);">${escapeHtmlOutput(p.branch)}</span>
                          </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; border-top: 1px dashed var(--border); padding-top: 10px; margin-top: 4px;">
                          <div>
                            <span style="font-size: 10.5px; color: var(--text-muted); text-transform: uppercase; font-weight: 750;">Số HS tiếp nhận</span>
                            <strong style="display: block; font-size: 16px; color: var(--primary);  font-weight: 850;">${p.totalOpenedCount} ca</strong>
                          </div>
                          <div>
                            <span style="font-size: 10.5px; color: var(--text-muted); text-transform: uppercase; font-weight: 750;">Đã duyệt HSBT</span>
                            <strong style="display: block; font-size: 16px; color: #10b981;  font-weight: 850;">${p.duyetHsbtCount} ca (${rateHsbt}%)</strong>
                          </div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}

            <!-- ULTRA-PREMIUM MASTER DATA TABLE CONTAINER -->
            <div class="table-container" style="border: 1px solid var(--border-strong); border-radius: 20px; background: var(--surface); overflow: hidden; box-shadow: var(--shadow-md);">
              <div style="padding: 18px 24px; background: linear-gradient(180deg, var(--bg-soft) 0%, rgba(0,0,0,0.02) 100%); border-bottom: 1px solid var(--border-strong); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <span style="font-size: 13px; font-weight: 850; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.06em; display: flex; align-items: center; gap: 10px;">
                  <div style="width: 28px; height: 28px; border-radius: 8px; background: rgba(216,180,109,0.15); border: 1px solid rgba(216,180,109,0.3); color: var(--primary); display: grid; place-items: center;">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                  </div>
                  <span>Báo cáo hồ sơ bồi thường</span>
                </span>

                <span style="font-size: 11.5px; font-weight: 800; color: var(--primary); background: rgba(216,180,109,0.1); border: 1px solid rgba(216,180,109,0.25); padding: 5px 12px; border-radius: 99px;">
                  ${gdvRows.length} Cán bộ Giám định viên
                </span>
              </div>

              <table class="p-table" style="width: 100%; border-collapse: separate; border-spacing: 0;">
                <thead>
                  <tr style="background: var(--bg-soft); border-bottom: 2px solid var(--border-strong);">
                    <th style="width: 55px; text-align: center; padding: 14px 12px; font-size: 11.5px; font-weight: 850; color: var(--text-soft); letter-spacing: 0.05em; text-transform: uppercase;">STT</th>
                    <th style="width: 230px; padding: 14px 14px; font-size: 11.5px; font-weight: 850; color: var(--text-soft); letter-spacing: 0.05em; text-transform: uppercase;">Giám định viên</th>
                    <th style="width: 160px; text-align: center; padding: 14px 12px; font-size: 11.5px; font-weight: 850; color: var(--text-soft); letter-spacing: 0.05em; text-transform: uppercase;">Số HS tiếp nhận</th>
                    <th style="width: 175px; text-align: center; padding: 14px 12px; font-size: 11.5px; font-weight: 850; color: var(--text-soft); letter-spacing: 0.05em; text-transform: uppercase;">Duyệt HSBT (Gốc / KPI)</th>
                    <th style="width: 160px; text-align: center; padding: 14px 12px; font-size: 11.5px; font-weight: 850; color: var(--text-soft); letter-spacing: 0.05em; text-transform: uppercase;">Tỷ lệ duyệt HSBT</th>
                    <th style="padding: 14px 16px; font-size: 11.5px; font-weight: 850; color: var(--text-soft); letter-spacing: 0.05em; text-transform: uppercase;">Phân bổ Trạng thái Nghiệp vụ</th>
                    <th style="width: 170px; text-align: right; padding: 14px 24px 14px 12px; font-size: 11.5px; font-weight: 850; color: var(--text-soft); letter-spacing: 0.05em; text-transform: uppercase;">Tổng tiền duyệt BT (VNĐ)</th>
                  </tr>
                </thead>
                <tbody>
                  ${gdvRowsSorted.length === 0 ? `
                    <tr><td colspan="7" class="empty-state-text" style="padding: 45px; text-align: center; color: var(--text-muted); font-size: 14px;">Không tìm thấy dữ liệu hồ sơ nào trong mốc thời gian đã chọn (${timeLabelText}).</td></tr>
                  ` : gdvRowsSorted.map((r, idx) => {
                    const percentTotal = totalFilteredClaims > 0 ? Math.round((r.totalOpenedCount / totalFilteredClaims) * 100) : 0;
                    const rateHsbt = r.totalOpenedCount > 0 ? Math.round((r.duyetHsbtCount / r.totalOpenedCount) * 100) : 0;
                    const initials = getGdvInitials(r.gdvName);

                    let rankBadge = '';
                    if (idx === 0) rankBadge = '<span style="font-size: 14px;">🥇</span>';
                    else if (idx === 1) rankBadge = '<span style="font-size: 14px;">🥈</span>';
                    else if (idx === 2) rankBadge = '<span style="font-size: 14px;">🥉</span>';

                    const activeStatuses = Object.entries(r.statusMap).filter(([, cnt]) => cnt > 0);

                    let rateColor = '#3b82f6';
                    let gradColor = 'linear-gradient(90deg, #3b82f6, #60a5fa)';
                    if (rateHsbt >= 70) {
                      rateColor = '#10b981';
                      gradColor = 'linear-gradient(90deg, #10b981, #34d399)';
                    } else if (rateHsbt < 50 && rateHsbt > 0) {
                      rateColor = '#f97316';
                      gradColor = 'linear-gradient(90deg, #f97316, #fb923c)';
                    }

                    return `
                      <tr style="transition: background 0.15s ease; border-bottom: 1px solid var(--border);">
                        <td style="text-align: center; font-weight: 850; color: var(--text-muted); font-size: 12.5px; padding: 14px 12px; ">${String(idx + 1).padStart(2, '0')}</td>
                        <td style="padding: 14px 14px;">
                          <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, rgba(216,180,109,0.2) 0%, rgba(216,180,109,0.05) 100%); border: 1.5px solid rgba(216,180,109,0.4); color: var(--primary); font-weight: 900; font-size: 12px; display: grid; place-items: center; flex-shrink: 0;">
                              ${initials}
                            </div>
                            <div>
                              <div style="display: flex; align-items: center; gap: 6px;">
                                ${rankBadge}
                                <strong style="color: var(--text-main); font-size: 13.5px; font-weight: 850;">${escapeHtmlOutput(r.gdvName)}</strong>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style="text-align: center; padding: 14px 12px;">
                          <strong style="font-size: 16px; color: var(--primary);  font-weight: 850;">${r.totalOpenedCount} <span style="font-size: 12px; font-weight: 600;">ca</span></strong>
                          <div style="font-size: 10.5px; font-weight: 800; color: var(--text-soft); background: rgba(0,0,0,0.04); padding: 1px 7px; border-radius: 99px; display: inline-block; margin-top: 3px;">${percentTotal}% tổng kỳ</div>
                        </td>
                        <td style="text-align: center; padding: 14px 12px;">
                          <strong style="font-size: 16px; color: #10b981;  font-weight: 850;">${Math.round((r.weightedKpiCount || r.duyetHsbtCount) * 10) / 10} <span style="font-size: 12px; font-weight: 600;">ca KPI</span></strong>
                          <div style="font-size: 10.5px; font-weight: 750; color: var(--text-muted); margin-top: 3px;">Gốc: ${r.duyetHsbtCount} ca | Chờ: ${r.pendingHsbtCount} ca</div>
                        </td>
                        <td style="text-align: center; padding: 14px 12px;">
                          <strong style="font-size: 14px; color: ${rateColor};  font-weight: 850;">${rateHsbt}%</strong>
                          <div style="width: 100%; height: 6px; background: rgba(0,0,0,0.06); border-radius: 99px; margin-top: 5px; overflow: hidden; padding: 1px; border: 1px solid rgba(0,0,0,0.08);">
                            <div style="width: ${rateHsbt}%; height: 100%; background: ${gradColor}; border-radius: 99px;"></div>
                          </div>
                        </td>
                        <td style="padding: 14px 16px;">
                          <div style="display: flex; gap: 5px; flex-wrap: wrap; align-items: center;">
                            ${activeStatuses.map(([stKey, stCount]) => {
                              const cfg = PENDING_STATUS_MAP[stKey] || PENDING_STATUS_MAP['moi'];
                              return `<span style="background: ${cfg.bg}; color: ${cfg.color}; border: 1px solid ${cfg.border}; font-size: 10.5px; font-weight: 800; padding: 3px 8px; border-radius: 8px; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;"><span>${cfg.label}:</span> <strong style=" font-size: 11px;">${stCount}</strong></span>`;
                            }).join('')}
                          </div>
                        </td>
                        <td style="text-align: right; padding: 14px 24px 14px 12px;  font-weight: 850; color: var(--primary); font-size: 14px;">
                          ${r.totalApprovedAmount > 0 ? formatCurrencyInputNumber(r.totalApprovedAmount) + ' đ' : '—'}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      `;
      const favoriteFilterWrapper = document.getElementById('accReportFavFiltersWrapper');
      const favoriteFilterSlot = document.getElementById('reportFilterUtilitySlot');
      if (favoriteFilterWrapper && favoriteFilterSlot) {
        favoriteFilterSlot.appendChild(favoriteFilterWrapper);
      }
      renderFavFiltersDropdownContent();
    }
