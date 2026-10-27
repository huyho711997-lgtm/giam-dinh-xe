

    function renderFieldReimbursementsPage(containerDOM) {
      const container = containerDOM || document.getElementById('tabContentContainer');
      if (!container) return;

      const currentUser = firebase.auth().currentUser;
      const myUid = currentUser?.uid;
      const isAdmin = activeUserProfile && (
        String(activeUserProfile.role || '').trim().toLowerCase() === 'admin' ||
        activeUserProfile.isAdmin === true
      );

      let allReimb = Object.values(cachedFieldReimbursementsPayload || {});
      const canReview = hasUserPermission('field_reimb', 'review');
      if (!canReview) {
        allReimb = allReimb.filter(r => r.gdvUid === myUid);
      }

      allReimb.sort((a,b) => b.createdAt - a.createdAt);

      const canCreate = hasUserPermission('field_reimb', 'create');

      container.innerHTML = `
        <!-- ADAPTIVE HERO BANNER HEADER -->
        <div style="background: var(--surface); border: 1px solid var(--border-strong); border-radius: 20px; padding: 24px 28px; margin-bottom: 22px; box-shadow: var(--shadow-sm); position: relative; overflow: hidden;">
          <!-- Decorative Orbs -->
          <div style="position: absolute; right: -50px; top: -50px; width: 300px; height: 300px; background: radial-gradient(circle, rgba(216,180,109,0.2) 0%, rgba(0,0,0,0) 70%); border-radius: 50%; pointer-events: none; filter: blur(24px);"></div>
          <div style="position: absolute; left: 5%; bottom: -60px; width: 250px; height: 250px; background: radial-gradient(circle, rgba(16,185,129,0.1) 0%, rgba(0,0,0,0) 70%); border-radius: 50%; pointer-events: none; filter: blur(20px);"></div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; position: relative; z-index: 2;">
            <div style="flex: 1; min-width: 320px;">
              <div style="display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px; background: rgba(216,180,109,0.12); border: 1px solid rgba(216,180,109,0.3); border-radius: 16px; font-size: 11px; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px;">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                Thanh toán & Chi phí
              </div>
              <h1 style="font-size: 28px; font-weight: 900; background: linear-gradient(135deg, var(--text-main) 0%, #9ca3af 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0 0 10px 0; letter-spacing: -0.02em; line-height: 1.2;">
                Phiếu thanh toán đi hiện trường
              </h1>
              <p style="color: var(--text-soft); font-size: 13.5px; line-height: 1.5; margin: 0; max-width: 500px;">
                Quản lý các đề nghị thanh toán chi phí di chuyển khi giám định hiện trường
              </p>
            </div>
            
            <div style="display: flex; gap: 12px; align-items: center;">
              ${canCreate ? `
                <button class="btn-premium" onclick="openCreateFieldReimbursementModal()" style="padding: 10px 20px; border-radius: 12px; box-shadow: 0 8px 24px rgba(216,180,109,0.25); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);" onmouseover="this.style.transform='translateY(-2px) scale(1.02)'; this.style.boxShadow='0 12px 28px rgba(216,180,109,0.35)'" onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 8px 24px rgba(216,180,109,0.25)'">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> TẠO PHIẾU MỚI
                </button>
              ` : ''}
            </div>
          </div>
        </div>

        <div class="p-card" style="padding: 0; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.03); border: 1px solid var(--border-strong);">
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
              <thead style="background: var(--bg-soft); border-bottom: 1px solid var(--border);">
                <tr>
                  <th style="padding: 14px 24px; font-weight: 700; color: var(--text-soft);">Mã Phiếu</th>
                  <th style="padding: 14px 24px; font-weight: 700; color: var(--text-soft);">Ngày tạo</th>
                  <th style="padding: 14px 24px; font-weight: 700; color: var(--text-soft);">Người tạo</th>
                  <th style="padding: 14px 24px; text-align: center; font-weight: 700; color: var(--text-soft);">Số lượng vụ</th>
                  <th style="padding: 14px 24px; text-align: right; font-weight: 700; color: var(--text-soft);">Tổng thanh toán</th>
                  <th style="padding: 14px 24px; text-align: center; font-weight: 700; color: var(--text-soft);">Trạng thái</th>
                  <th style="padding: 14px 24px; text-align: center; font-weight: 700; color: var(--text-soft);">Thao tác</th>
                </tr>
              </thead>
              <tbody style="color: var(--text-main);">
                ${allReimb.length === 0 ? `
                  <tr><td colspan="7"><div class="empty-state-premium" style="padding: 60px 20px; text-align: center; color: var(--text-soft);"><div class="empty-icon" style="margin-bottom: 16px;">${SVGS.SEARCH}</div><strong>Chưa có phiếu thanh toán nào</strong><p style="font-size: 13px; margin-top: 4px;">Bạn có thể tạo phiếu mới để bắt đầu.</p></div></td></tr>
                ` : allReimb.map(r => {
                  let statusHtml = '';
                    if (r.status === 'pending' || r.status === 'new') statusHtml = '<span style="background: rgba(59,130,246,0.15); color: #3b82f6; padding: 4px 10px; border-radius: 99px; font-weight: 750;">Mới tạo</span>';
                    else if (r.status === 'approved' || r.status === 'paid') statusHtml = '<span style="background: rgba(16,185,129,0.15); color: #10b981; padding: 4px 10px; border-radius: 99px; font-weight: 750;">Đã chi trả</span>';
                    else if (r.status === 'rejected') statusHtml = '<span style="background: rgba(239,68,68,0.15); color: #ef4444; padding: 4px 10px; border-radius: 99px; font-weight: 750;">Từ chối</span>';

                    return `
                      <tr onclick="viewFieldReimbursementDetail('${r.id}')" style="border-bottom: 1px solid var(--border); transition: background 0.2s; cursor: pointer;" onmouseover="this.style.background='var(--surface-hover)'" onmouseout="this.style.background='transparent'">
                        <td style="padding: 18px 24px; font-weight: 750; color: var(--primary);">${escapeHtmlOutput(r.id)}</td>
                        <td style="padding: 18px 24px; color: var(--text-soft);">${formatDateDisplay(r.createdAt)}</td>
                        <td style="padding: 18px 24px;"><strong>${escapeHtmlOutput(r.gdvName)}</strong></td>
                        <td style="padding: 18px 24px; text-align: center;"><strong>${(r.items || []).length}</strong></td>
                        <td style="padding: 18px 24px; text-align: right; font-weight: 850; color: #10b981;">${r.totalAmount ? r.totalAmount.toLocaleString('vi-VN') : '0'} đ</td>
                        <td style="padding: 18px 24px; text-align: center;">${statusHtml}</td>
                        <td style="padding: 18px 24px; text-align: center;">
                          <div style="display: flex; justify-content: center;">
                            ${( isAdmin || ( r.gdvUid === myUid && r.status !== 'approved' && r.status !== 'paid' ) ) ? `
                              <button style="background: rgba(239,68,68,0.08); color: #ef4444; border: 1px solid rgba(239,68,68,0.25); padding: 8px; border-radius: 8px; cursor: pointer; display: inline-flex; justify-content: center; align-items: center; transition: all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.15)'" onmouseout="this.style.background='rgba(239,68,68,0.08)'" onclick="if(typeof event !== 'undefined') event.stopPropagation(); deleteFieldReimbursement('${r.id}')" title="Xoá phiếu này">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2"></path></svg>
                              </button>
                            ` : '-'}
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }


    function lookupCaseInfoByBS(bs) {
      const dropdown = document.getElementById('reimbBSDropdown');
      if (!dropdown) return;
      
      if (!bs || bs.trim().length < 4) {
        dropdown.style.display = 'none';
        return;
      }
      
      const normalizedQuery = removeVietnameseTones(bs.trim().toUpperCase().replace(/[-.\s]/g, ''));
      const allCases = cachedPendingClaimsPayload || {};
      let matchedCases = [];
      
      for (const key in allCases) {
        const c = allCases[key];
        if (c.bienSo) {
          const normalizedBs = removeVietnameseTones(c.bienSo.toUpperCase().replace(/[-.\s]/g, ''));
          if (normalizedBs.includes(normalizedQuery) || normalizedQuery.includes(normalizedBs)) {
            matchedCases.push({...c, _id: key});
          }
        }
      }
      
      if (matchedCases.length === 0) {
        dropdown.style.display = 'none';
        return;
      }
      
      matchedCases.sort((a, b) => b.createdAt - a.createdAt);
      
      let html = '';
      matchedCases.forEach(c => {
        const hsbt = c.soHoSoBoiThuong || 'Chưa có số HSBT';
        const ngay = c.ngayThongBao || 'Chưa có thông tin giờ TN';
        const rawObj = encodeURIComponent(JSON.stringify({soHsbt: c.soHoSoBoiThuong, ngayThongBao: c.ngayThongBao, bienSo: c.bienSo}));
        
        html += `
          <div style="padding: 12px 16px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s;" 
               onmouseover="this.style.background='var(--bg-soft)'" 
               onmouseout="this.style.background='transparent'"
               onclick="selectReimbCaseFromDropdown('${rawObj}')">
            <div style="font-weight: 700; color: var(--text-main); font-size: 14px; margin-bottom: 4px;">${c.bienSo}</div>
            <div style="font-size: 12px; color: var(--text-soft); display: flex; gap: 12px; align-items: center;">
              <span><span style="font-weight: 600;">HSBT:</span> ${hsbt}</span>
              <span style="display:flex; align-items:center; gap:4px;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> ${ngay}</span>
            </div>
          </div>
        `;
      });
      
      dropdown.innerHTML = html;
      dropdown.style.display = 'block';
    }


    function selectReimbCaseFromDropdown(encodedObj) {
      try {
        const data = JSON.parse(decodeURIComponent(encodedObj));
        const bsInput = document.getElementById('reimbInputBS');
        const hsbtInput = document.getElementById('reimbInputHSBT');
        const startInput = document.getElementById('reimbInputStartDate');
        const endInput = document.getElementById('reimbInputDate');
        const dropdown = document.getElementById('reimbBSDropdown');
        
        if (data.bienSo) bsInput.value = data.bienSo;
        if (data.soHsbt) hsbtInput.value = data.soHsbt;
        
        if (data.ngayThongBao) {
           const parts = data.ngayThongBao.split(/[\s/:]+/);
           if (parts.length >= 5) {
             const day = parts[0].padStart(2, '0');
             const month = parts[1].padStart(2, '0');
             const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
             const hour = parts[3].padStart(2, '0');
             const min = parts[4].padStart(2, '0');
             startInput.value = `${year}-${month}-${day}T${hour}:${min}`;
             if (endInput) endInput.value = `${year}-${month}-${day}T${hour}:${min}`;
           }
        }
        
        if (dropdown) dropdown.style.display = 'none';
      } catch (e) {
        console.error(e);
      }
    }


    
    function checkSunday() {
      const startDateStr = document.getElementById('reimbInputStartDate')?.value;
      const endDateStr = document.getElementById('reimbInputDate')?.value;
      const holidayCb = document.getElementById('reimbInputHoliday');
      if (!holidayCb) return;

      let isSunday = false;
      if (startDateStr && new Date(startDateStr).getDay() === 0) isSunday = true;
      if (endDateStr && new Date(endDateStr).getDay() === 0) isSunday = true;

      if (isSunday) {
        holidayCb.checked = true;
      } else {
        holidayCb.checked = false;
      }
      // Trigger preview update since checkbox changed
      if (typeof updateQuickReimbPreview === 'function') updateQuickReimbPreview();
    }


    function updateQuickReimbPreview() {
      const km = parseFloat(document.getElementById('reimbInputKm')?.value) || 0;
      const date = document.getElementById('reimbInputDate')?.value;
      const isHoliday = document.getElementById('reimbInputHoliday')?.checked;
      const travelCost = parseFloat(document.getElementById('reimbInputTravelCost')?.value) || 0;
      const perDiem = parseFloat(document.getElementById('reimbInputPerDiem')?.value) || 0;
      const hotelCost = parseFloat(document.getElementById('reimbInputHotelCost')?.value) || 0;

      const locationContainer = document.getElementById('reimbInputLocationContainer');
      const locationInput = document.getElementById('reimbInputLocation');
      if (locationContainer && locationInput) {
        if (hotelCost > 0) {
          locationContainer.style.display = 'block';
        } else {
          locationContainer.style.display = 'none';
          locationInput.value = '';
        }
      }

      const calc = calculateFieldCost(km, date, isHoliday);
      const total = calc.finalCost + travelCost + perDiem + hotelCost;

      const previewLbl = document.getElementById('quickReimbPreviewAmount');
      if (previewLbl) {
        previewLbl.textContent = total.toLocaleString('vi-VN') + ' đ';
      }
    }


    // Chi phí đi lại bằng phương tiện cá nhân: km nhập là 1 chiều → nhân 2 ra quãng đường 2 chiều.
    // Đơn giá theo tổng quãng đường 2 chiều: dưới 100 km = 4.000đ/km, từ 100 km trở lên = 3.000đ/km.
    function calculatePersonalTravelCost(oneWayKm) {
      const km = Number(oneWayKm);
      if (!Number.isFinite(km) || km <= 0) return 0;
      const roundTripKm = km * 2;
      const rate = roundTripKm < 100 ? 4000 : 3000;
      return Math.round(roundTripKm * rate);
    }


    function autoCalculateTravelCost() {
      const kmStr = document.getElementById('reimbInputKm')?.value;
      const vehicle = document.getElementById('reimbInputVehicle')?.value;
      const specialCase = document.getElementById('reimbInputSpecialCase')?.checked;
      const costInput = document.getElementById('reimbInputTravelCost');
      
      if (!costInput) return;

      const km = parseFloat(kmStr) || 0;

      if (vehicle === 'Ô tô cơ quan') {
        costInput.value = 0;
        return;
      }

      if (km <= 30 && !specialCase) {
        costInput.value = 0;
        return;
      }

      if (vehicle === 'Phương tiện cá nhân') {
        costInput.value = calculatePersonalTravelCost(km);
      }
      
      updateQuickReimbPreview();
    }


    function calculateFieldCost(distanceKm, dateStr, isHolidayChecked) {
      let baseFee = 0;
      if (distanceKm <= 30) baseFee = 100000;
      else if (distanceKm <= 100) baseFee = 200000;
      else baseFee = 400000;

      let isAfterHours = false;
      let isWeekend = false;

      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const hour = d.getHours();
          const day = d.getDay();
          if (hour < 8 || hour >= 18) isAfterHours = true;
          if (day === 0) isWeekend = true;
        }
      }

      let multiplier = 1;
      let maxCap = null;

      if (isHolidayChecked || isWeekend) {
        multiplier = 3;
        maxCap = 1000000;
      } else if (isAfterHours) {
        multiplier = 2;
        maxCap = 500000;
      }

      let finalCost = baseFee * multiplier;
      if (maxCap !== null && finalCost > maxCap) finalCost = maxCap;

      return {
        baseFee,
        multiplier,
        maxCap,
        finalCost,
        isAfterHours,
        isWeekendOrHoliday: isHolidayChecked || isWeekend
      };
    }


    function openCreateFieldReimbursementModal(editBatchId = null) {
      if (editBatchId && cachedFieldReimbursementsPayload[editBatchId]) {
        localFieldReimbursementDraft = JSON.parse(JSON.stringify(cachedFieldReimbursementsPayload[editBatchId].items || []));
      } else {
        localFieldReimbursementDraft = [];
      }
      const m = document.createElement('div');
      m.id = 'createFieldReimbModal';
      m.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.4); backdrop-filter:blur(8px); z-index:999999; display:flex; align-items:center; justify-content:center; padding:20px; box-sizing:border-box; animation: fadeIn 0.2s ease-out;';
      m.innerHTML = `
        <div style="background:var(--surface); border-radius:24px; width:98vw; max-width:98vw; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 24px 80px rgba(0,0,0,0.2); border:1px solid var(--border-strong); overflow:hidden; transform: translateY(0); animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
          
          <div style="padding:24px 32px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background: var(--surface); position: relative; overflow: hidden;">
            <div style="position: absolute; right: -20px; top: -50px; width: 150px; height: 150px; background: radial-gradient(circle, rgba(216,180,109,0.15) 0%, rgba(0,0,0,0) 70%); border-radius: 50%; pointer-events: none; filter: blur(20px);"></div>
            
            <div style="position: relative; z-index: 2;">
              <h3 style="margin:0 0 4px 0; font-size:22px; font-weight:900; color: #080b11; letter-spacing: -0.02em;">${editBatchId ? 'Cập Nhật' : 'Tạo'} Phiếu Thanh Toán Đi Hiện Trường</h3>
              <p style="margin:0; font-size:13px; color:var(--text-soft);">Thêm các vụ giám định đã hoàn tất để đề nghị thanh toán chi phí di chuyển.</p>
            </div>
            
            <button onclick="document.getElementById('createFieldReimbModal').remove()" style="background:var(--surface-strong); border:1px solid var(--border); color:var(--text-soft); cursor:pointer; width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:12px; transition:all 0.2s; position: relative; z-index: 2;" onmouseover="this.style.background='var(--border-strong)'; this.style.color='var(--text-main)'" onmouseout="this.style.background='var(--surface-strong)'; this.style.color='var(--text-soft)'">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          
          <div style="padding:32px; flex:1; overflow-y:auto; background: var(--bg-main);">
            <div style="margin-bottom: 32px; background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 28px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 24px;">
              <h4 style="margin: 0; color: var(--text-main); font-size: 16px; font-weight: 800; display:flex; align-items:center; gap:8px;">
                <span style="display:flex; align-items:center; justify-content:center; width:28px; height:28px; background:rgba(216,180,109,0.15); color:var(--primary); border-radius:10px;">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                </span>
                Khai báo thông tin vụ giám định
              </h4>

              <div style="display: flex; flex-direction: column; gap: 24px;">
                <!-- Row 1: Thông tin cơ bản -->
                <div style="display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 20px;">
                  <div style="position: relative;">
                    <label style="display: block; font-size: 13.5px; color: var(--text-soft); font-weight: 700; margin-bottom: 8px;">Biển số xe KH <span style="color:#ef4444">*</span></label>
                    <input type="text" id="reimbInputBS" class="p-input" placeholder="VD: 47A-123.45" style="width:100%; padding: 12px; border-radius: 10px;" oninput="lookupCaseInfoByBS(this.value)" autocomplete="off">
                    <div id="reimbBSDropdown" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: var(--surface); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid var(--border-strong); border-radius: 12px; box-shadow: 0 12px 32px rgba(0,0,0,0.12); z-index: 1000; max-height: 240px; overflow-y: auto; overflow-x: hidden;"></div>
                  </div>
                  <div>
                    <label style="display: block; font-size: 13.5px; color: var(--text-soft); font-weight: 700; margin-bottom: 8px;">Số HSBT</label>
                    <input type="text" id="reimbInputHSBT" class="p-input" placeholder="VD: HSBT/XCG/..." style="width:100%; padding: 12px; border-radius: 10px;">
                  </div>
                  <div id="reimbInputLocationContainer" style="display: none;">
                    <label style="display: block; font-size: 13.5px; color: var(--text-soft); font-weight: 700; margin-bottom: 8px;">Địa bàn giám định <span style="color:#ef4444">*</span></label>
                    <input type="text" id="reimbInputLocation" class="p-input" placeholder="Nhập địa bàn" style="width:100%; padding: 12px; border-radius: 10px;">
                  </div>
                </div>
                
                <!-- Row 2: Thời gian & Đặc thù -->
                <div style="display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 20px; align-items: end;">
                  <div>
                    <label style="display: block; font-size: 13.5px; color: var(--text-soft); font-weight: 700; margin-bottom: 8px;">Giờ bắt đầu GĐ</label>
                    <input type="datetime-local" id="reimbInputStartDate" class="p-input" style="width:100%; padding: 12px; border-radius: 10px;" onchange="checkSunday(); updateQuickReimbPreview()">
                  </div>
                  <div>
                    <label style="display: block; font-size: 13.5px; color: var(--text-soft); font-weight: 700; margin-bottom: 8px;">Giờ kết thúc GĐ <span style="color:#ef4444">*</span></label>
                    <input type="datetime-local" id="reimbInputDate" class="p-input" style="width:100%; padding: 12px; border-radius: 10px;" onchange="checkSunday(); updateQuickReimbPreview()" oninput="updateQuickReimbPreview()">
                  </div>
                  <div style="display: flex; gap: 20px; align-items: center; padding: 12px 16px; background: var(--bg-soft); border-radius: 10px; border: 1px dashed var(--border-strong); height: 46px; box-sizing: border-box;">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 700; color: var(--text-main); cursor: pointer; margin: 0;">
                      <input type="checkbox" id="reimbInputHoliday" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--primary);" onchange="updateQuickReimbPreview()">
                      Ngày Lễ / Cuối tuần
                    </label>
                    <div style="width: 1px; height: 16px; background: var(--border-strong);"></div>
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 700; color: var(--text-main); cursor: pointer; margin: 0;" title="Áp dụng cho Cao tốc cấm xe máy hoặc Đặc thù (Có phê duyệt)">
                      <input type="checkbox" id="reimbInputSpecialCase" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--primary);" onchange="autoCalculateTravelCost()">
                      Đặc thù / Cao tốc
                    </label>
                  </div>
                </div>
                
                <!-- Row 3: Di chuyển -->
                <div style="display: grid; grid-template-columns: 1.5fr 1fr 1.5fr; gap: 20px;">
                  <div>
                    <label style="display: block; font-size: 13.5px; color: var(--text-soft); font-weight: 700; margin-bottom: 8px;">Phương tiện di chuyển</label>
                    <select id="reimbInputVehicle" class="p-input" style="width:100%; padding: 12px; border-radius: 10px;" onchange="autoCalculateTravelCost()">
                      <option value="Phương tiện cá nhân">Phương tiện cá nhân</option>
                      <option value="Ô tô cơ quan">Ô tô cơ quan</option>
                      <option value="Xe khách">Xe khách</option>
                      <option value="Taxi">Taxi</option>
                      <option value="Tàu hỏa">Tàu hỏa</option>
                      <option value="Máy bay">Máy bay</option>
                    </select>
                  </div>
                  <div>
                    <label style="display: block; font-size: 13.5px; color: var(--text-soft); font-weight: 700; margin-bottom: 8px;">Khoảng cách (km) <span style="color:#ef4444">*</span></label>
                    <input type="number" id="reimbInputKm" class="p-input" min="0" step="1" placeholder="VD: 35" style="width:100%; padding: 12px; border-radius: 10px;" oninput="autoCalculateTravelCost()">
                  </div>
                  <div>
                    <label style="display: block; font-size: 13.5px; color: var(--text-soft); font-weight: 700; margin-bottom: 8px;">Chi phí đi lại (đ)</label>
                    <input type="number" id="reimbInputTravelCost" class="p-input" min="0" step="1000" placeholder="0" style="width:100%; padding: 12px; border-radius: 10px;" oninput="updateQuickReimbPreview()">
                  </div>
                </div>

                <!-- Row 4: Phụ phí -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                  <div>
                    <label style="display: block; font-size: 13.5px; color: var(--text-soft); font-weight: 700; margin-bottom: 8px;">Công tác phí (đ)</label>
                    <input type="number" id="reimbInputPerDiem" class="p-input" min="0" step="1000" placeholder="0" style="width:100%; padding: 12px; border-radius: 10px;" oninput="updateQuickReimbPreview()">
                  </div>
                  <div>
                    <label style="display: block; font-size: 13.5px; color: var(--text-soft); font-weight: 700; margin-bottom: 8px;">Lưu trú (đ)</label>
                    <input type="number" id="reimbInputHotelCost" class="p-input" min="0" step="1000" placeholder="0" style="width:100%; padding: 12px; border-radius: 10px;" oninput="updateQuickReimbPreview()">
                  </div>
                </div>
              </div>
            
              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 24px; border-top: 1px dashed var(--border-strong);">
                <div style="display: flex; align-items: center; gap: 16px;">
                  <div style="width: 40px; height: 40px; border-radius: 12px; background: rgba(16,185,129,0.15); color: #10b981; display: flex; align-items: center; justify-content: center;">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                  </div>
                  <div>
                    <div style="font-size: 11.5px; font-weight: 700; color: var(--text-soft); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Tạm tính vụ này</div>
                    <div id="quickReimbPreviewAmount" style="font-size: 20px; font-weight: 900; color: #10b981; line-height: 1;">0 đ</div>
                  </div>
                </div>
                
                <button type="button" class="btn-premium" style="width: auto; min-width: 150px; flex-shrink: 0; padding: 0 24px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #d8b46d, #b98c3e); box-shadow: 0 6px 16px rgba(216,180,109,0.3); color: #fff; border: none; font-size: 14px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; cursor: pointer;" onclick="addReimbursementItemFromForm()">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Thêm vụ này
                </button>
              </div>
            </div>

            <div style="margin-bottom: 32px; background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 28px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 20px;">
              <h4 style="margin: 0; color: var(--text-main); font-size: 16px; font-weight: 800; display:flex; align-items:center; gap:8px;">
                <span style="display:flex; align-items:center; justify-content:center; width:28px; height:28px; background:rgba(59,130,246,0.15); color:#3b82f6; border-radius:8px;">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="5" width="18" height="14" rx="2" ry="2"></rect><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                </span>
                Thông tin chuyển khoản (Sẽ lưu mặc định cho lần sau)
              </h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
                <div>
                  <label style="display:block; font-size:13px; font-weight:700; color:var(--text-soft); margin-bottom:6px;">Người thụ hưởng</label>
                  <input type="text" id="reimbBeneficiaryName" value="${(editBatchId && cachedFieldReimbursementsPayload[editBatchId]?.bankBeneficiary) ? escapeHtmlOutput(cachedFieldReimbursementsPayload[editBatchId].bankBeneficiary) : (localStorage.getItem('savedBankBeneficiary') || escapeHtmlOutput(activeUserProfile?.displayName || firebase.auth().currentUser?.email || ''))}" class="p-input" placeholder="Ví dụ: NGUYEN VAN A">
                </div>
                <div>
                  <label style="display:block; font-size:13px; font-weight:700; color:var(--text-soft); margin-bottom:6px;">Số tài khoản</label>
                  <input type="text" id="reimbBankAccount" value="${(editBatchId && cachedFieldReimbursementsPayload[editBatchId]?.bankAccount) ? escapeHtmlOutput(cachedFieldReimbursementsPayload[editBatchId].bankAccount) : (localStorage.getItem('savedBankAccount') || '')}" class="p-input" placeholder="Số tài khoản">
                </div>
                <div>
                  <label style="display:block; font-size:13px; font-weight:700; color:var(--text-soft); margin-bottom:6px;">Tại ngân hàng</label>
                  <input type="text" id="reimbBankName" value="${(editBatchId && cachedFieldReimbursementsPayload[editBatchId]?.bankName) ? escapeHtmlOutput(cachedFieldReimbursementsPayload[editBatchId].bankName) : (localStorage.getItem('savedBankName') || '')}" class="p-input" placeholder="Ví dụ: Vietcombank CN Hà Nội">
                </div>
              </div>
            </div>

            <h4 style="margin: 0 0 16px 0; color: var(--text-main); font-size: 15px; font-weight: 800; display:flex; align-items:center; gap:8px;">
               <span style="display:flex; align-items:center; justify-content:center; width:24px; height:24px; background:rgba(16,185,129,0.15); color:#10b981; border-radius:8px;">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                </span>
              Danh sách chi tiết trong phiếu
            </h4>
            <div id="reimbDraftItemsContainer"></div>
          </div>
          
          <div style="padding:20px 32px; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background:var(--surface-strong);">
            <div style="display:flex; flex-direction:column;">
              <span style="font-size:11.5px; color:var(--text-soft); font-weight:600; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:2px;">Tổng cộng</span>
              <span id="reimbDraftTotalAmount" style="color: #10b981; font-size: 20px; font-weight: 900; line-height:1;">0 đ</span>
            </div>
            <div style="display:flex; gap:12px;">
              <button class="btn-premium btn-secondary" style="width: auto !important; height: 44px; padding: 0 24px; border-radius:12px; font-weight:700; font-size: 14px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer;" onclick="document.getElementById('createFieldReimbModal').remove()">Đóng</button>
              <button class="btn-premium" style="width: auto !important; height: 44px; padding: 0 24px; border-radius:12px; font-weight:800; font-size: 14px; box-shadow: 0 6px 16px rgba(216,180,109,0.3); display: inline-flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; white-space: nowrap; min-width: 140px;" onclick="submitFieldReimbursementBatch('${editBatchId || ''}')" id="btnSubmitReimb">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                ${editBatchId ? 'Cập nhật phiếu' : 'Tạo phiếu'}
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(m);
      renderReimbursementDraftItems();
    }


    function addReimbursementItemFromForm() {
      const bs = document.getElementById('reimbInputBS').value.trim();
      const hsbt = document.getElementById('reimbInputHSBT').value.trim();
      const km = parseFloat(document.getElementById('reimbInputKm').value);
      
      const startDate = document.getElementById('reimbInputStartDate').value;
      const date = document.getElementById('reimbInputDate').value;
      const isHoliday = document.getElementById('reimbInputHoliday').checked;
      
      const vehicle = document.getElementById('reimbInputVehicle').value;
      const travelCost = parseFloat(document.getElementById('reimbInputTravelCost').value) || 0;
      const location = document.getElementById('reimbInputLocation').value.trim();
      const isSpecialCase = document.getElementById('reimbInputSpecialCase').checked;
      
      const perDiem = parseFloat(document.getElementById('reimbInputPerDiem').value) || 0;
      const hotelCost = parseFloat(document.getElementById('reimbInputHotelCost').value) || 0;

      if (!bs) return triggerToast('Vui lòng nhập Biển số xe', 'error');
      if (!date) return triggerToast('Vui lòng chọn thời gian kết thúc', 'error');
      if (isNaN(km) || km < 0) return triggerToast('Vui lòng nhập số km hợp lệ', 'error');
      if (hotelCost > 0 && !location) return triggerToast('Vui lòng nhập Địa bàn giám định (bắt buộc khi có lưu trú)', 'error');

      const calc = calculateFieldCost(km, date, isHoliday);

      localFieldReimbursementDraft.push({
        idCa: Date.now().toString(),
        bienSo: bs,
        soHSBT: hsbt,
        startDatetime: startDate,
        datetime: date,
        distanceKm: km,
        isHolidayChecked: isHoliday,
        isSpecialCase: isSpecialCase,
        vehicle: vehicle,
        travelCost: travelCost,
        location: location,
        perDiem: perDiem,
        hotelCost: hotelCost,
        calcResult: calc
      });

      document.getElementById('reimbInputBS').value = '';
      document.getElementById('reimbInputHSBT').value = '';
      document.getElementById('reimbInputKm').value = '';
      document.getElementById('reimbInputStartDate').value = '';
      document.getElementById('reimbInputDate').value = '';
      document.getElementById('reimbInputHoliday').checked = false;
      document.getElementById('reimbInputSpecialCase').checked = false;
      document.getElementById('reimbInputVehicle').selectedIndex = 0;
      document.getElementById('reimbInputTravelCost').value = '';
      document.getElementById('reimbInputLocation').value = '';
      document.getElementById('reimbInputPerDiem').value = '';
      document.getElementById('reimbInputHotelCost').value = '';
      
      updateQuickReimbPreview();

      renderReimbursementDraftItems();
    }


    function removeReimbursementItem(index) {
      localFieldReimbursementDraft.splice(index, 1);
      renderReimbursementDraftItems();
    }


    
    function loadReimbursementItemToForm(index) {
      const item = localFieldReimbursementDraft[index];
      document.getElementById('reimbInputBS').value = item.bienSo || '';
      document.getElementById('reimbInputHSBT').value = item.soHSBT || '';
      document.getElementById('reimbInputKm').value = item.distanceKm || '';
      document.getElementById('reimbInputStartDate').value = item.startDatetime || '';
      document.getElementById('reimbInputDate').value = item.datetime || '';
      document.getElementById('reimbInputHoliday').checked = item.isHolidayChecked || false;
      document.getElementById('reimbInputSpecialCase').checked = item.isSpecialCase || false;
      document.getElementById('reimbInputVehicle').value = item.vehicle || 'Phương tiện cá nhân';
      document.getElementById('reimbInputTravelCost').value = item.travelCost || '';
      document.getElementById('reimbInputLocation').value = item.location || '';
      document.getElementById('reimbInputPerDiem').value = item.perDiem || '';
      document.getElementById('reimbInputHotelCost').value = item.hotelCost || '';
      
      localFieldReimbursementDraft.splice(index, 1);
      
      if (typeof autoCalculateTravelCost === 'function') autoCalculateTravelCost();
      if (typeof updateQuickReimbPreview === 'function') updateQuickReimbPreview();
      
      renderReimbursementDraftItems();
      
      const modal = document.getElementById('createFieldReimbModal');
      if(modal) {
        modal.scrollTo({top: 0, behavior: 'smooth'});
      }
    }


    function enableInlineEdit(idx) {
      window.editingReimbIndex = idx;
      renderReimbursementDraftItems();
    }


    function cancelInlineEdit() {
      window.editingReimbIndex = -1;
      renderReimbursementDraftItems();
    }


    function saveInlineEdit(idx) {
      const km = parseFloat(document.getElementById('inlineKm_' + idx).value) || 0;
      const date = document.getElementById('inlineEnd_' + idx).value;
      const isHol = document.getElementById('inlineHol_' + idx).checked;
      const isSpec = document.getElementById('inlineSpec_' + idx).checked;
      
      const calc = calculateFieldCost(km, date, isHol);
      // Đổi km (hoặc phương tiện) mà không sửa tay chi phí đi lại → tính lại theo quy tắc 2 chiều.
      const previous = localFieldReimbursementDraft[idx] || {};
      const vehicleValue = document.getElementById('inlineVeh_' + idx).value;
      let travelValue = parseFloat(document.getElementById('inlineTrav_' + idx).value) || 0;
      if (travelValue === (previous.travelCost || 0) && (km !== previous.distanceKm || vehicleValue !== previous.vehicle)) {
        travelValue = vehicleValue === 'Phương tiện cá nhân' && (km > 30 || isSpec) ? calculatePersonalTravelCost(km) : 0;
      }
      
      localFieldReimbursementDraft[idx] = {
        ...localFieldReimbursementDraft[idx],
        startDatetime: document.getElementById('inlineStart_' + idx).value,
        datetime: date,
        isHolidayChecked: isHol,
        isSpecialCase: isSpec,
        bienSo: document.getElementById('inlineBS_' + idx).value,
        soHSBT: document.getElementById('inlineHSBT_' + idx).value,
        distanceKm: km,
        vehicle: document.getElementById('inlineVeh_' + idx).value,
        travelCost: travelValue,
        perDiem: parseFloat(document.getElementById('inlinePer_' + idx).value) || 0,
        hotelCost: parseFloat(document.getElementById('inlineHot_' + idx).value) || 0,
        location: document.getElementById('inlineLoc_' + idx).value,
        calcResult: calc
      };
      
      window.editingReimbIndex = -1;
      if (typeof updateQuickReimbPreview === 'function') updateQuickReimbPreview();
      renderReimbursementDraftItems();
    }


    function renderReimbursementDraftItems() {
      const container = document.getElementById('reimbDraftItemsContainer');
      const totalLbl = document.getElementById('reimbDraftTotalAmount');
      if (!container || !totalLbl) return;

      if (localFieldReimbursementDraft.length === 0) {
        container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-soft); font-style: italic; border: 1px dashed var(--border-strong); border-radius: 12px;">Chưa thêm vụ nào.</div>';
        totalLbl.textContent = '0 đ';
        return;
      }

      let total = 0;
      let html = `
        <div style="overflow-x: auto; border: 1px solid var(--border); border-radius: 12px; background: var(--surface);">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; white-space: nowrap;">
            <thead style="background: var(--surface-strong); border-bottom: 1px solid var(--border-strong);">
              <tr>
                <th style="padding: 10px; border-right: 1px solid var(--border);">STT</th>
                <th style="padding: 10px; border-right: 1px solid var(--border);">Bắt đầu</th>
                <th style="padding: 10px; border-right: 1px solid var(--border);">Kết thúc</th>
                <th style="padding: 10px; border-right: 1px solid var(--border);">Biển số xe KH</th>
                <th style="padding: 10px; border-right: 1px solid var(--border);">Số HSBT</th>
                <th style="padding: 10px; border-right: 1px solid var(--border); text-align: center;">Khoảng cách</th>
                <th style="padding: 10px; border-right: 1px solid var(--border); text-align: right;">Thù lao GĐ</th>
                <th style="padding: 10px; border-right: 1px solid var(--border);">Phương tiện</th>
                <th style="padding: 10px; border-right: 1px solid var(--border); text-align: right;">Chi phí đi lại</th>
                <th style="padding: 10px; border-right: 1px solid var(--border); text-align: right;">Công tác phí</th>
                <th style="padding: 10px; border-right: 1px solid var(--border); text-align: right;">Lưu trú</th>
                <th style="padding: 10px; border-right: 1px solid var(--border);">Địa bàn</th>
                <th style="padding: 10px; text-align: right;">Thành tiền</th>
                <th style="padding: 10px; text-align: center;">Thao tác</th>
              </tr>
            </thead>
            <tbody>
      `;

      html += localFieldReimbursementDraft.map((item, idx) => {
        let subtotal = (item.calcResult.finalCost || 0) + (item.travelCost || 0) + (item.perDiem || 0) + (item.hotelCost || 0);
        total += subtotal;
        
        let noteStr = [];
        if (item.calcResult.isWeekendOrHoliday) noteStr.push('Lễ/Cuối tuần');
        else if (item.calcResult.isAfterHours) noteStr.push('Ngoài giờ');
        if (item.isSpecialCase) noteStr.push('Đặc thù/Cao tốc');
        
        
        if (window.editingReimbIndex === idx) {
          return `
            <tr style="border-bottom: 1px solid var(--border); background: rgba(59,130,246,0.05);">
              <td style="padding: 4px; text-align: center;">${idx + 1}</td>
              <td style="padding: 2px;"><input type="datetime-local" id="inlineStart_${idx}" value="${item.startDatetime || ''}" class="p-input" style="padding:4px; font-size:11px; width:125px; border-radius:6px;"></td>
              <td style="padding: 2px;">
                <input type="datetime-local" id="inlineEnd_${idx}" value="${item.datetime || ''}" class="p-input" style="padding:4px; font-size:11px; width:125px; border-radius:6px; margin-bottom:4px;">
                <div style="display:flex; flex-direction:column; gap:2px;">
                  <label style="font-size:10px; display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" id="inlineHol_${idx}" ${item.isHolidayChecked ? 'checked' : ''} style="accent-color:var(--primary);"> Lễ/Cuối tuần</label>
                  <label style="font-size:10px; display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" id="inlineSpec_${idx}" ${item.isSpecialCase ? 'checked' : ''} style="accent-color:var(--primary);"> Đặc thù/Cao tốc</label>
                </div>
              </td>
              <td style="padding: 2px;"><input type="text" id="inlineBS_${idx}" value="${escapeHtmlOutput(item.bienSo)}" class="p-input" style="padding:4px; font-size:11px; width:80px; border-radius:6px;"></td>
              <td style="padding: 2px;"><input type="text" id="inlineHSBT_${idx}" value="${escapeHtmlOutput(item.soHSBT || '')}" class="p-input" style="padding:4px; font-size:11px; width:100px; border-radius:6px;"></td>
              <td style="padding: 2px;"><input type="number" id="inlineKm_${idx}" value="${item.distanceKm}" class="p-input" style="padding:4px; font-size:11px; width:50px; border-radius:6px;"></td>
              <td style="padding: 2px; font-size: 11px; color: var(--text-soft); text-align:center;">(Tự động)</td>
              <td style="padding: 2px;"><input type="text" id="inlineVeh_${idx}" value="${escapeHtmlOutput(item.vehicle || '')}" class="p-input" style="padding:4px; font-size:11px; width:80px; border-radius:6px;"></td>
              <td style="padding: 2px;"><input type="number" id="inlineTrav_${idx}" value="${item.travelCost || ''}" class="p-input" style="padding:4px; font-size:11px; width:70px; border-radius:6px;"></td>
              <td style="padding: 2px;"><input type="number" id="inlinePer_${idx}" value="${item.perDiem || ''}" class="p-input" style="padding:4px; font-size:11px; width:70px; border-radius:6px;"></td>
              <td style="padding: 2px;"><input type="number" id="inlineHot_${idx}" value="${item.hotelCost || ''}" class="p-input" style="padding:4px; font-size:11px; width:70px; border-radius:6px;"></td>
              <td style="padding: 2px;"><input type="text" id="inlineLoc_${idx}" value="${escapeHtmlOutput(item.location || '')}" class="p-input" style="padding:4px; font-size:11px; width:80px; border-radius:6px;"></td>
              <td style="padding: 2px; font-size: 11px; color: var(--text-soft); text-align:center;">(Tự động)</td>
              <td style="padding: 4px; text-align: center;">
                <div style="display:flex; gap:4px; flex-direction:column;">
                  <button onclick="saveInlineEdit(${idx})" style="background: #10b981; color: #fff; border: none; padding: 4px 8px; border-radius: 6px; font-size:11px; font-weight:bold; cursor: pointer; box-shadow: 0 2px 5px rgba(16,185,129,0.3);">Lưu</button>
                  <button onclick="cancelInlineEdit()" style="background: var(--surface-strong); color: var(--text-main); border: 1px solid var(--border); padding: 4px 8px; border-radius: 6px; font-size:11px; font-weight:bold; cursor: pointer;">Hủy</button>
                </div>
              </td>
            </tr>
          `;
        }

        return `
          <tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 8px 10px; text-align: center; border-right: 1px solid var(--border);">${idx + 1}</td>
            <td style="padding: 8px 10px; border-right: 1px solid var(--border);">${item.startDatetime ? formatDateDisplay(item.startDatetime).replace('—', '<br>') : '-'}</td>
            <td style="padding: 8px 10px; border-right: 1px solid var(--border);">${formatDateDisplay(item.datetime).replace('—', '<br>')}
              ${noteStr.length ? `<br><span style="color:#f59e0b; font-size:10px; font-weight:700;">${noteStr.join(',')}</span>` : ''}
            </td>
            <td style="padding: 8px 10px; font-weight: 700; border-right: 1px solid var(--border);">${escapeHtmlOutput(item.bienSo)}</td>
            <td style="padding: 8px 10px; border-right: 1px solid var(--border);">${escapeHtmlOutput(item.soHSBT || '')}</td>
            <td style="padding: 8px 10px; text-align: center; border-right: 1px solid var(--border);">${item.distanceKm} km</td>
            <td style="padding: 8px 10px; text-align: right; border-right: 1px solid var(--border);">${item.calcResult.finalCost.toLocaleString('vi-VN')} đ</td>
            <td style="padding: 8px 10px; border-right: 1px solid var(--border);">${escapeHtmlOutput(item.vehicle || '')}</td>
            <td style="padding: 8px 10px; text-align: right; border-right: 1px solid var(--border);">${item.travelCost ? item.travelCost.toLocaleString('vi-VN') + ' đ' : '-'}</td>
            <td style="padding: 8px 10px; text-align: right; border-right: 1px solid var(--border);">${item.perDiem ? item.perDiem.toLocaleString('vi-VN') + ' đ' : '-'}</td>
            <td style="padding: 8px 10px; text-align: right; border-right: 1px solid var(--border);">${item.hotelCost ? item.hotelCost.toLocaleString('vi-VN') + ' đ' : '-'}</td>
            <td style="padding: 8px 10px; border-right: 1px solid var(--border);">${escapeHtmlOutput(item.location || '')}</td>
            <td style="padding: 8px 10px; text-align: right; color: #10b981; font-weight: 800;">${subtotal.toLocaleString('vi-VN')} đ</td>
            <td style="padding: 8px 10px; text-align: center;">
              <div style="display: flex; justify-content: center; gap: 6px;">
                <button onclick="enableInlineEdit(${idx})" style="background: rgba(59,130,246,0.1); color: #3b82f6; border: none; padding: 6px; border-radius: 8px; cursor: pointer;" title="Sửa vụ này">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button onclick="removeReimbursementItem(${idx})" style="background: rgba(239,68,68,0.1); color: #ef4444; border: none; padding: 6px; border-radius: 8px; cursor: pointer;" title="Xóa vụ này">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
      
      html += `
            </tbody>
          </table>
        </div>
      `;
      container.innerHTML = html;
      totalLbl.textContent = total.toLocaleString('vi-VN') + ' đ';
    }


    async function submitFieldReimbursementBatch(existingId = '') {
      if (localFieldReimbursementDraft.length === 0) return triggerToast('Vui lòng thêm ít nhất một vụ giám định.', 'warning');
      const currentUser = firebase.auth().currentUser;
      if (!currentUser) return;

      const btn = document.getElementById('btnSubmitReimb');
      if (btn) { btn.disabled = true; btn.innerHTML = '<span style="display:inline-block; animation:spin 1s linear infinite;">↻</span> Đang gửi...'; }

      const totalAmount = localFieldReimbursementDraft.reduce((acc, curr) => {
        return acc + (curr.calcResult.finalCost || 0) + (curr.travelCost || 0) + (curr.perDiem || 0) + (curr.hotelCost || 0);
      }, 0);
      
      const batchId = existingId || ('HT_' + Date.now().toString(36).toUpperCase());

      const bName = document.getElementById('reimbBeneficiaryName')?.value.trim();
        const bAccount = document.getElementById('reimbBankAccount')?.value.trim();
        const bBank = document.getElementById('reimbBankName')?.value.trim();
        
        if (bName) localStorage.setItem('savedBankBeneficiary', bName);
        if (bAccount) localStorage.setItem('savedBankAccount', bAccount);
        if (bBank) localStorage.setItem('savedBankName', bBank);

        const payload = {
          id: batchId,
          gdvUid: currentUser.uid,
          gdvName: activeUserProfile?.displayName || currentUser.email,
          createdAt: firebase.database.ServerValue.TIMESTAMP,
          status: 'pending',
          totalAmount: totalAmount,
          items: localFieldReimbursementDraft,
          bankBeneficiary: bName || '',
          bankAccount: bAccount || '',
          bankName: bBank || ''
        };

      try {
        await dbNodeInstance.ref(`field_reimbursements/${batchId}`).set(payload);
        triggerToast('Tạo phiếu thanh toán hiện trường thành công!', 'success');
        document.getElementById('createFieldReimbModal').remove();
        logUserActivity('CREATE_FIELD_REIMB', `Tạo phiếu thanh toán hiện trường ${batchId} (Tổng: ${totalAmount.toLocaleString('vi-VN')}đ)`);
      } catch (err) {
        console.error(err);
        triggerToast('Lỗi khi lưu phiếu thanh toán.', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Tạo phiếu'; }
      }
    }


    function deleteFieldReimbursement(batchId) {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(11, 15, 25, 0.82); backdrop-filter: blur(16px); z-index: 999999; display: grid; place-items: center; padding: 16px; opacity: 0; transition: opacity 0.2s ease;';
      
      const modal = document.createElement('div');
      modal.style.cssText = 'background: var(--surface); border: 1px solid var(--border-strong); border-radius: 20px; padding: 24px; width: 100%; max-width: 360px; box-shadow: 0 24px 48px rgba(0,0,0,0.4); text-align: center; transform: scale(0.95); transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);';
      
      modal.innerHTML = `
        <div style="width: 56px; height: 56px; background: rgba(239, 68, 68, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 18px;">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </div>
        <h3 style="margin: 0 0 10px; font-size: 18px; color: var(--text-main); font-weight: 800;">Xoá phiếu thanh toán?</h3>
        <p style="margin: 0 0 24px; font-size: 14px; color: var(--text-soft); line-height: 1.5;">Bạn có chắc chắn muốn xoá phiếu đề nghị này không?<br>Thao tác này không thể hoàn tác.</p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <button id="btnCancelDelete" style="padding: 12px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface-soft); color: var(--text-main); font-size: 14px; font-weight: 750; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='var(--surface-hover)'" onmouseout="this.style.background='var(--surface-soft)'">Huỷ</button>
          <button id="btnConfirmDelete" style="padding: 12px; border-radius: 12px; border: none; background: #ef4444; color: #fff; font-size: 14px; font-weight: 750; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(239,68,68,0.3);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(239,68,68,0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(239,68,68,0.3)'">Xoá phiếu</button>
        </div>
      `;
      
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      
      requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        modal.style.transform = 'scale(1)';
      });
      
      const closeModal = () => {
        overlay.style.opacity = '0';
        modal.style.transform = 'scale(0.95)';
        setTimeout(() => overlay.remove(), 200);
      };
      
      document.getElementById('btnCancelDelete').onclick = closeModal;
      
      document.getElementById('btnConfirmDelete').onclick = () => {
        const btn = document.getElementById('btnConfirmDelete');
        btn.textContent = 'Đang xoá...';
        btn.disabled = true;
        btn.style.opacity = '0.7';
        btn.style.cursor = 'not-allowed';
        
        dbNodeInstance.ref('field_reimbursements/' + batchId).remove()
          .then(() => {
            triggerToast('Đã xoá phiếu thanh toán.', 'success');
            logUserActivity('DELETE_FIELD_REIMB', `Xoá phiếu thanh toán ${batchId}`);
            closeModal();
          })
          .catch(err => {
            console.error(err);
            triggerToast('Lỗi khi xoá phiếu.', 'error');
            closeModal();
          });
      };
    }


    function viewFieldReimbursementDetail(batchId) {
      const payload = cachedFieldReimbursementsPayload[batchId];
      if (!payload) return;

      const m = document.createElement('div');
      m.id = 'viewFieldReimbModal';
      m.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(11,15,25,0.82); backdrop-filter:blur(16px); z-index:999999; display:flex; justify-content:center; align-items:center; padding:24px; overflow:hidden;';
      
      let statusHtml = '';
      if (payload.status === 'pending' || payload.status === 'new') statusHtml = '<span style="background: rgba(59,130,246,0.15); color: #3b82f6; padding: 6px 14px; border-radius: 99px; font-weight: 800; font-size: 13px; display:inline-flex; align-items:center; gap:6px;"><span style="width:8px; height:8px; border-radius:50%; background:#3b82f6; display:inline-block;"></span>Mới tạo</span>';
      else if (payload.status === 'approved' || payload.status === 'paid') statusHtml = '<span style="background: rgba(16,185,129,0.15); color: #10b981; padding: 6px 14px; border-radius: 99px; font-weight: 800; font-size: 13px; display:inline-flex; align-items:center; gap:6px;"><span style="width:8px; height:8px; border-radius:50%; background:#10b981; display:inline-block;"></span>Đã chi trả</span>';
      else if (payload.status === 'rejected') statusHtml = '<span style="background: rgba(239,68,68,0.15); color: #ef4444; padding: 6px 14px; border-radius: 99px; font-weight: 800; font-size: 13px; display:inline-flex; align-items:center; gap:6px;"><span style="width:8px; height:8px; border-radius:50%; background:#ef4444; display:inline-block;"></span>Từ chối</span>';

      const isAdmin = activeUserProfile && (
        String(activeUserProfile.role || '').trim().toLowerCase() === 'admin' ||
        activeUserProfile.isAdmin === true
      );
      const isCreator = payload.gdvUid === firebase.auth().currentUser?.uid;
      const isNew = payload.status === 'pending' || payload.status === 'new' || payload.status === 'rejected';
      const isPaid = payload.status === 'approved' || payload.status === 'paid';

      let headerActions = '';
      if ((isCreator && isNew) || isAdmin) {
        headerActions += `
          <button class="btn-premium" style="width: auto !important; padding:10px 20px; border-radius:12px; font-weight:800; background: var(--surface); color: var(--text-main); border: 1px solid var(--border-strong); box-shadow: var(--shadow-sm); white-space:nowrap;" onclick="document.getElementById('viewFieldReimbModal').remove(); openCreateFieldReimbursementModal('${payload.id}')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 6px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            SỬA PHIẾU
          </button>
          ${!isPaid ? `
          <button class="btn-premium" style="width: auto !important; background: #10b981; color: #fff; box-shadow: 0 8px 20px rgba(16,185,129,0.25); padding:10px 20px; border-radius:12px; font-weight:800; white-space:nowrap;" onclick="actionFieldReimbursement('${payload.id}', 'paid')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
            ĐÁNH DẤU ĐÃ CHI TRẢ
          </button>
          ` : ''}
        `;
      }
      if ((isCreator && isPaid) || (isAdmin && isPaid)) {
        headerActions += `
          <button class="btn-premium" style="width: auto !important; background: var(--surface); color: var(--text-main); border: 1px solid var(--border-strong); box-shadow: var(--shadow-sm); padding:10px 20px; border-radius:12px; font-weight:800; white-space:nowrap;" onclick="actionFieldReimbursement('${payload.id}', 'new')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 6px;"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
            CHUYỂN VỀ MỚI TẠO
          </button>
        `;
      }
      if (isAdmin || (isCreator && isNew)) {
        headerActions += `
          <button class="btn-premium" style="width: auto !important; background: rgba(239,68,68,0.12); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); box-shadow: var(--shadow-sm); padding:10px 18px; border-radius:12px; font-weight:800; white-space:nowrap; cursor:pointer;" onclick="document.getElementById('viewFieldReimbModal')?.remove(); deleteFieldReimbursement('${payload.id}')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 6px;"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2"></path></svg>
            XOÁ PHIẾU
          </button>
        `;
      }
      
      headerActions += `
        <button class="btn-premium" style="width: auto !important; white-space: nowrap; padding:10px 20px; border-radius:12px; font-weight:800; background: #3b82f6; color: #fff; box-shadow: 0 8px 20px rgba(59,130,246,0.25); " onclick="exportFieldReimbursementToExcel('${payload.id}')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          XUẤT BẢNG KÊ
        </button>
        <button class="btn-premium" style="width: auto !important; white-space: nowrap; padding:10px 20px; border-radius:12px; font-weight:800; background: #eab308; color: #fff; box-shadow: 0 8px 20px rgba(234,179,8,0.25);" onclick="printFieldReimbursementTemplate('${payload.id}')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 6px;"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          IN PHIẾU
        </button>
      `;

      m.innerHTML = `
        <section class="profile-modal-panel" role="dialog" style="width: 96vw; height: 92vh; max-width: 98vw; min-width: 900px; max-height: 92vh; min-height: 600px; display: flex; flex-direction: column; overflow: hidden; padding: 0; border-radius: 16px; box-shadow: 0 25px 60px -15px rgba(0,0,0,0.5); background: var(--surface); animation: zoomIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
          
          <!-- Header -->
          <div style="padding: 20px 28px 14px; border-bottom: 1px solid var(--border); background: var(--surface-strong); flex-shrink: 0;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
              <div style="display: flex; gap: 16px;">
                <div style="width: 48px; height: 48px; border-radius: 12px; background: var(--primary-gradient); color: #080b11; display: grid; place-items: center; flex-shrink: 0; box-shadow: var(--shadow-sm);">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                </div>
                <div>
                  <h3 style="font-size: 20px; font-weight: 850; color: var(--text-main); margin: 0 0 8px 0; letter-spacing: -0.01em;">Chi tiết đề nghị thanh toán</h3>
                  <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <div style="font-size: 13px; font-weight: 700; color: var(--text-soft); text-transform: uppercase; letter-spacing: 0.05em;">
                      MÃ PHIẾU: <strong style="color: var(--text-main);">${escapeHtmlOutput(payload.id)}</strong>
                    </div>
                    ${statusHtml}
                    <div style="width: 1px; height: 14px; background: var(--border-strong);"></div>
                    <span style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-soft); font-weight: 600;">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="8" r="5"></circle><path d="M20 21a8 8 0 1 0-16 0"></path></svg>
                      <strong style="color: var(--primary);">${escapeHtmlOutput(payload.gdvName)}</strong>
                    </span>
                    <span style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-soft); font-weight: 600;">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                      ${new Date(payload.createdAt).toLocaleString('vi-VN')}
                    </span>
                  </div>
                </div>
              </div>
              <div style="display: flex; gap: 12px; align-items: flex-start;">
                ${headerActions}
                
                <button type="button" class="btn-premium btn-secondary" onclick="document.getElementById('viewFieldReimbModal').remove()" aria-label="Đóng" style="width: 38px; height: 38px; min-width: 38px; min-height: 38px; padding: 0; border-radius: 10px; font-size: 18px; display: grid; place-items: center; cursor: pointer; margin-left: 4px;">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Content -->
          <div style="flex-grow: 1; overflow-y: auto; background: var(--surface);">
            <div style="padding: 24px 28px;">
              <h4 style="font-size: 14.5px; font-weight: 800; color: var(--text-main); margin: 0 0 16px 0; letter-spacing: -0.01em;">Danh sách vụ giám định (${(payload.items || []).length})</h4>
              
              <div style="border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: var(--surface-strong);">
                <table class="p-table" style="margin: 0; white-space: nowrap;">
                  <thead style="position: sticky; top: 0; z-index: 10;">
                    <tr style="background: var(--bg-soft);">
                      <th style="padding:12px 16px; font-size:11px; font-weight:800; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border);">STT</th>
                      <th style="padding:12px 16px; font-size:11px; font-weight:800; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border);">Bắt đầu</th>
                      <th style="padding:12px 16px; font-size:11px; font-weight:800; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border);">Kết thúc</th>
                      <th style="padding:12px 16px; font-size:11px; font-weight:800; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border);">Biển số xe KH</th>
                      <th style="padding:12px 16px; font-size:11px; font-weight:800; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border);">Số HSBT</th>
                      <th style="padding:12px 16px; font-size:11px; font-weight:800; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border); text-align:right;">Khoảng cách</th>
                      <th style="padding:12px 16px; font-size:11px; font-weight:800; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border); text-align:right;">Thù lao GĐ</th>
                      <th style="padding:12px 16px; font-size:11px; font-weight:800; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border);">Phương tiện</th>
                      <th style="padding:12px 16px; font-size:11px; font-weight:800; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border); text-align:right;">Chi phí đi lại</th>
                      <th style="padding:12px 16px; font-size:11px; font-weight:800; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border); text-align:right;">Công tác phí</th>
                      <th style="padding:12px 16px; font-size:11px; font-weight:800; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border); text-align:right;">Lưu trú</th>
                      <th style="padding:12px 16px; font-size:11px; font-weight:800; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border);">Địa bàn</th>
                      <th style="padding:12px 16px; font-size:11px; font-weight:800; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border); text-align:right;">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody style="background: var(--surface);">
                    ${(payload.items || []).map((it, idx) => {
                      const tlGD = it.calcResult?.finalCost || 0;
                      const cpDL = it.travelCost || 0;
                      const ctp = it.perDiem || 0;
                      const lt = it.hotelCost || 0;
                      const rTotal = tlGD + cpDL + ctp + lt;
                      return `
                        <tr style="border-bottom:1px solid var(--border); background:${idx%2===0?'var(--surface)':'var(--bg-soft)'};">
                          <td style="padding:12px 16px; font-size:13px; color:var(--text-soft); text-align:center;">${idx + 1}</td>
                          <td style="padding:12px 16px; font-size:13px; color:var(--text-main);">${it.startDatetime ? formatDateDisplay(it.startDatetime).replace('—', '<br>') : '-'}</td>
                          <td style="padding:12px 16px; font-size:13px; color:var(--text-main);">${formatDateDisplay(it.datetime).replace('—', '<br>')}</td>
                          <td style="padding:12px 16px; font-size:13px; font-weight:700; color:var(--text-main);">${escapeHtmlOutput(it.bienSo)}</td>
                          <td style="padding:12px 16px; font-size:13px; color:var(--text-main);">${escapeHtmlOutput(it.soHSBT || '-')}</td>
                          <td style="padding:12px 16px; font-size:13px; color:var(--text-main); text-align:right;">${escapeHtmlOutput(it.distanceKm)} km</td>
                          <td style="padding:12px 16px; font-size:13px; color:var(--text-soft); text-align:right;">${tlGD > 0 ? tlGD.toLocaleString('vi-VN') + ' đ' : '-'}</td>
                          <td style="padding:12px 16px; font-size:13px; color:var(--text-main);">${escapeHtmlOutput(it.vehicle || '-')}</td>
                          <td style="padding:12px 16px; font-size:13px; color:var(--text-soft); text-align:right;">${cpDL > 0 ? cpDL.toLocaleString('vi-VN') + ' đ' : '-'}</td>
                          <td style="padding:12px 16px; font-size:13px; color:var(--text-soft); text-align:right;">${ctp > 0 ? ctp.toLocaleString('vi-VN') + ' đ' : '-'}</td>
                          <td style="padding:12px 16px; font-size:13px; color:var(--text-soft); text-align:right;">${lt > 0 ? lt.toLocaleString('vi-VN') + ' đ' : '-'}</td>
                          <td style="padding:12px 16px; font-size:13px; color:var(--text-main);">${escapeHtmlOutput(it.location || '-')}</td>
                          <td style="padding:12px 16px; font-size:14px; font-weight:800; color:#10b981; text-align:right;">${rTotal.toLocaleString('vi-VN')} đ</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div style="padding: 20px 28px; border-top: 1px solid var(--border); background: var(--surface-strong); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 11.5px; color: var(--text-soft); font-weight: 750; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Tổng tiền thanh toán</span>
              <span style="color: #10b981; font-size: 24px; font-weight: 900; line-height: 1.1; letter-spacing: -0.01em;">${payload.totalAmount ? payload.totalAmount.toLocaleString('vi-VN') : '0'} đ</span>
            </div>
            <div style="display: flex; gap: 12px;">
              <button type="button" class="btn-premium btn-secondary" onclick="document.getElementById('viewFieldReimbModal').remove()" style="width: auto !important; padding: 0 24px; height: 42px; cursor: pointer;">Đóng chi tiết</button>
            </div>
          </div>

        </section>`;
      document.body.appendChild(m);
    }
