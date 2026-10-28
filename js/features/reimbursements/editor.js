

    // ---- Trang "Hiện trường": dùng bộ giao diện sf-* dùng chung (shared-forms) ----
    // Trạng thái lọc/tìm kiếm được giữ ở module để realtime re-render không làm mất.
    const fieldReimbView = { status: 'all', query: '' };

    function fieldReimbStatusKey(r) {
      const s = String((r && r.status) || '');
      if (s === 'approved' || s === 'paid') return 'paid';
      if (s === 'rejected') return 'rejected';
      return 'new';
    }

    function fieldReimbIcon(name) {
      const icons = (typeof SharedFormsControls !== 'undefined' && SharedFormsControls.icon) ? SharedFormsControls.icon : null;
      return icons ? icons(name) : '';
    }

    function setFieldReimbStatus(status) {
      fieldReimbView.status = status;
      renderFieldReimbursementsPage();
    }

    function setFieldReimbQuery(value) {
      fieldReimbView.query = String(value || '');
      paintFieldReimbList();
    }

    function getFieldReimbRows() {
      const myUid = firebase.auth().currentUser?.uid;
      let all = Object.values(cachedFieldReimbursementsPayload || {});
      if (!hasUserPermission('field_reimb', 'review')) all = all.filter(r => r.gdvUid === myUid);
      return all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    function paintFieldReimbList() {
      const host = document.getElementById('fieldReimbList');
      if (!host) return;
      const myUid = firebase.auth().currentUser?.uid;
      const isAdmin = activeUserProfile && (
        String(activeUserProfile.role || '').trim().toLowerCase() === 'admin' ||
        activeUserProfile.isAdmin === true
      );
      const all = getFieldReimbRows();
      const norm = s => removeVietnameseTones(String(s || '').toLowerCase());
      const q = norm(fieldReimbView.query.trim());
      const rows = all.filter(r => {
        if (fieldReimbView.status !== 'all' && fieldReimbStatusKey(r) !== fieldReimbView.status) return false;
        return !q || norm(r.id).includes(q) || norm(r.gdvName).includes(q);
      });

      const total = rows.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);
      const countEl = document.getElementById('fieldReimbCount');
      if (countEl) countEl.textContent = rows.length + ' phiếu · ' + total.toLocaleString('vi-VN') + ' đ';

      if (!rows.length) {
        const filtered = q || fieldReimbView.status !== 'all';
        host.innerHTML = `<div class="sf-empty"><span class="fr-empty-icon">${fieldReimbIcon('file')}</span><h3>${filtered ? 'Không tìm thấy phiếu phù hợp' : 'Chưa có phiếu thanh toán nào'}</h3><p>${filtered ? 'Thử đổi từ khóa hoặc bộ lọc trạng thái.' : 'Bạn có thể tạo phiếu mới để bắt đầu.'}</p></div>`;
        return;
      }

      const badge = key => key === 'paid'
        ? '<span class="fr-badge fr-paid">Đã chi trả</span>'
        : key === 'rejected' ? '<span class="fr-badge fr-rejected">Từ chối</span>'
        : '<span class="fr-badge fr-new">Mới tạo</span>';

      host.innerHTML = `<div class="sf-table-scroll"><table class="sf-table fr-table">
        <caption class="sf-sr-only">Danh sách phiếu thanh toán đi hiện trường</caption>
        <thead><tr>
          <th>Mã phiếu</th><th class="sf-col-date">Ngày tạo</th><th>Người tạo</th>
          <th class="fr-num">Số vụ</th><th class="fr-money">Tổng thanh toán</th>
          <th class="fr-center">Trạng thái</th><th class="sf-col-actions">Thao tác</th>
        </tr></thead>
        <tbody>${rows.map(r => {
          const canDelete = isAdmin || (r.gdvUid === myUid && fieldReimbStatusKey(r) !== 'paid');
          const id = escapeHtmlOutput(r.id);
          return `<tr class="sf-row fr-row" tabindex="0" onclick="viewFieldReimbursementDetail('${id}')" onkeydown="if(event.key==='Enter'){viewFieldReimbursementDetail('${id}')}">
            <td class="fr-code" data-label="Mã phiếu">${id}</td>
            <td class="sf-col-date" data-label="Ngày tạo">${formatDateDisplay(r.createdAt)}</td>
            <td class="fr-person" data-label="Người tạo">${escapeHtmlOutput(r.gdvName)}</td>
            <td class="fr-num" data-label="Số vụ">${(r.items || []).length}</td>
            <td class="fr-money" data-label="Tổng thanh toán">${(Number(r.totalAmount) || 0).toLocaleString('vi-VN')} đ</td>
            <td class="fr-center" data-label="Trạng thái">${badge(fieldReimbStatusKey(r))}</td>
            <td class="sf-col-actions"><div class="fr-actions">
              <button class="sf-icon-button" type="button" title="Xem chi tiết" aria-label="Xem chi tiết ${id}" onclick="event.stopPropagation(); viewFieldReimbursementDetail('${id}')">${fieldReimbIcon('eye')}</button>
              ${canDelete ? `<button class="sf-icon-button sf-danger" type="button" title="Xoá phiếu này" aria-label="Xoá phiếu ${id}" onclick="event.stopPropagation(); deleteFieldReimbursement('${id}')">${fieldReimbIcon('trash')}</button>` : ''}
            </div></td>
          </tr>`;
        }).join('')}</tbody></table></div>`;
    }

    function renderFieldReimbursementsPage(containerDOM) {
      const container = containerDOM || document.getElementById('tabContentContainer');
      if (!container) return;

      const canCreate = hasUserPermission('field_reimb', 'create');
      const all = getFieldReimbRows();
      const counts = { all: all.length, new: 0, paid: 0, rejected: 0 };
      all.forEach(r => { counts[fieldReimbStatusKey(r)]++; });
      const tabs = [['all', 'Tất cả'], ['new', 'Mới tạo'], ['paid', 'Đã chi trả'], ['rejected', 'Từ chối']];

      // Giữ focus + vị trí con trỏ của ô tìm kiếm khi realtime re-render
      const prev = document.getElementById('fieldReimbSearch');
      const hadFocus = prev && document.activeElement === prev;
      const caret = hadFocus ? prev.selectionStart : null;

      container.innerHTML = `
        <section class="sf-workspace fr-workspace">
          <header class="sf-page-head">
            <div class="sf-page-title">
              <span class="sf-page-emblem">${fieldReimbIcon('truck')}</span>
              <div>
                <div class="sf-eyebrow">Thanh toán &amp; Chi phí · Tasco DLK</div>
                <h1>Phiếu thanh toán đi hiện trường</h1>
                <p>Quản lý các đề nghị thanh toán chi phí di chuyển khi giám định hiện trường.</p>
              </div>
            </div>
            <div class="sf-toolbar">
              <button class="sf-button" type="button" onclick="renderFieldReimbursementsPage()" title="Làm mới danh sách">${fieldReimbIcon('refresh')} Làm mới</button>
              ${canCreate ? `<button class="sf-button sf-primary" type="button" onclick="openCreateFieldReimbursementModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg> Tạo phiếu mới</button>` : ''}
            </div>
          </header>

          <section class="sf-library">
            <div class="sf-library-bar">
              <div class="sf-sources" role="group" aria-label="Lọc theo trạng thái">
                ${tabs.map(([key, label]) => `<button class="sf-source-tab" type="button" aria-pressed="${fieldReimbView.status === key}" onclick="setFieldReimbStatus('${key}')">${label} <span class="fr-tab-count">${counts[key]}</span></button>`).join('')}
              </div>
              <span class="sf-count" id="fieldReimbCount"></span>
            </div>
            <div class="sf-library-filters">
              <div class="sf-controls">
                <label class="sf-search">${fieldReimbIcon('search')}<span class="sf-sr-only">Tìm phiếu</span><input id="fieldReimbSearch" type="search" placeholder="Tìm theo mã phiếu hoặc người tạo…" autocomplete="off" value="${escapeHtmlOutput(fieldReimbView.query)}" oninput="setFieldReimbQuery(this.value)"></label>
              </div>
            </div>
            <div id="fieldReimbList"></div>
          </section>
        </section>`;

      paintFieldReimbList();
      if (hadFocus) {
        const input = document.getElementById('fieldReimbSearch');
        if (input) { input.focus(); try { input.setSelectionRange(caret, caret); } catch (e) {} }
      }
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
        updateQuickReimbPreview();
        return;
      }

      if (km <= 30 && !specialCase) {
        costInput.value = 0;
        updateQuickReimbPreview();
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


    function closeFieldReimbForm() {
      document.getElementById('createFieldReimbModal')?.remove();
    }

    function openCreateFieldReimbursementModal(editBatchId = null) {
      const editing = editBatchId && cachedFieldReimbursementsPayload[editBatchId] ? cachedFieldReimbursementsPayload[editBatchId] : null;
      localFieldReimbursementDraft = editing ? JSON.parse(JSON.stringify(editing.items || [])) : [];
      closeFieldReimbForm();

      const ic = fieldReimbIcon;
      const val = v => escapeHtmlOutput(v || '');
      const bankBeneficiary = editing?.bankBeneficiary || localStorage.getItem('savedBankBeneficiary') || activeUserProfile?.displayName || firebase.auth().currentUser?.email || '';
      const bankAccount = editing?.bankAccount || localStorage.getItem('savedBankAccount') || '';
      const bankName = editing?.bankName || localStorage.getItem('savedBankName') || '';
      const req = '<span class="fr-req" aria-hidden="true">*</span>';
      const plus = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

      const m = document.createElement('div');
      m.id = 'createFieldReimbModal';
      m.className = 'fr-modal';
      m.innerHTML = `
        <section class="fr-panel fr-form-panel" role="dialog" aria-modal="true" aria-label="${editing ? 'Cập nhật' : 'Tạo'} phiếu thanh toán đi hiện trường">
          <header class="fr-head">
            <div class="sf-page-title">
              <span class="sf-page-emblem">${ic('truck')}</span>
              <div>
                <div class="sf-eyebrow">Thanh toán &amp; Chi phí · Hiện trường</div>
                <h2>${editing ? 'Cập nhật' : 'Tạo'} phiếu thanh toán đi hiện trường</h2>
                <div class="fr-meta">
                  ${editing ? `<span class="fr-code">${val(editing.id)}</span>` : ''}
                  <span>Thêm các vụ giám định đã hoàn tất để đề nghị thanh toán chi phí di chuyển.</span>
                </div>
              </div>
            </div>
            <button type="button" class="sf-icon-button sf-bordered fr-close" aria-label="Đóng" onclick="closeFieldReimbForm()">${ic('close')}</button>
          </header>

          <div class="fr-body fr-form-body">
            <section class="fr-card">
              <div class="fr-card-head"><span class="fr-step">1</span><div><h3>Khai báo thông tin vụ giám định</h3><p>Nhập từng vụ rồi bấm “Thêm vụ này”; chi phí được tính tự động theo quy định.</p></div></div>

              <div class="fr-group">
                <div class="fr-group-title">Vụ việc</div>
                <div class="fr-grid">
                  <div class="fr-field fr-col-4 fr-rel">
                    <label for="reimbInputBS">Biển số xe KH ${req}</label>
                    <input type="text" id="reimbInputBS" class="fr-input" placeholder="VD: 47A-123.45" oninput="lookupCaseInfoByBS(this.value)" autocomplete="off">
                    <div id="reimbBSDropdown" class="fr-dropdown" style="display:none;"></div>
                  </div>
                  <div class="fr-field fr-col-4">
                    <label for="reimbInputHSBT">Số HSBT</label>
                    <input type="text" id="reimbInputHSBT" class="fr-input" placeholder="VD: HSBT/XCG/...">
                  </div>
                  <div class="fr-field fr-col-4" id="reimbInputLocationContainer" style="display:none;">
                    <label for="reimbInputLocation">Địa bàn giám định ${req}</label>
                    <input type="text" id="reimbInputLocation" class="fr-input" placeholder="Nhập địa bàn">
                  </div>
                </div>
              </div>

              <div class="fr-group">
                <div class="fr-group-title">Thời gian giám định</div>
                <div class="fr-grid">
                  <div class="fr-field fr-col-4">
                    <label for="reimbInputStartDate">Giờ bắt đầu GĐ</label>
                    <input type="datetime-local" id="reimbInputStartDate" class="fr-input" onchange="checkSunday(); updateQuickReimbPreview()">
                  </div>
                  <div class="fr-field fr-col-4">
                    <label for="reimbInputDate">Giờ kết thúc GĐ ${req}</label>
                    <input type="datetime-local" id="reimbInputDate" class="fr-input" onchange="checkSunday(); updateQuickReimbPreview()" oninput="updateQuickReimbPreview()">
                  </div>
                  <div class="fr-field fr-col-4">
                    <label>Điều kiện áp dụng</label>
                    <div class="fr-checks">
                      <label class="fr-check"><input type="checkbox" id="reimbInputHoliday" onchange="updateQuickReimbPreview()"><span>Ngày Lễ / Cuối tuần</span></label>
                      <label class="fr-check" title="Áp dụng cho Cao tốc cấm xe máy hoặc Đặc thù (Có phê duyệt)"><input type="checkbox" id="reimbInputSpecialCase" onchange="autoCalculateTravelCost()"><span>Đặc thù / Cao tốc</span></label>
                    </div>
                  </div>
                </div>
              </div>

              <div class="fr-group">
                <div class="fr-group-title">Di chuyển &amp; chi phí</div>
                <div class="fr-grid">
                  <div class="fr-field fr-col-4">
                    <label for="reimbInputVehicle">Phương tiện di chuyển</label>
                    <select id="reimbInputVehicle" class="fr-input" onchange="autoCalculateTravelCost()">
                      <option value="Phương tiện cá nhân">Phương tiện cá nhân</option>
                      <option value="Ô tô cơ quan">Ô tô cơ quan</option>
                      <option value="Xe khách">Xe khách</option>
                      <option value="Taxi">Taxi</option>
                      <option value="Tàu hỏa">Tàu hỏa</option>
                      <option value="Máy bay">Máy bay</option>
                    </select>
                  </div>
                  <div class="fr-field fr-col-4">
                    <label for="reimbInputKm">Khoảng cách 1 chiều (km) ${req}</label>
                    <div class="fr-affix"><input type="number" id="reimbInputKm" class="fr-input" min="0" step="1" placeholder="VD: 35" oninput="autoCalculateTravelCost()"><span>km</span></div>
                  </div>
                  <div class="fr-field fr-col-4">
                    <label for="reimbInputTravelCost">Chi phí đi lại</label>
                    <div class="fr-affix"><input type="number" id="reimbInputTravelCost" class="fr-input" min="0" step="1000" placeholder="0" oninput="updateQuickReimbPreview()"><span>đ</span></div>
                  </div>
                  <div class="fr-field fr-col-6">
                    <label for="reimbInputPerDiem">Công tác phí</label>
                    <div class="fr-affix"><input type="number" id="reimbInputPerDiem" class="fr-input" min="0" step="1000" placeholder="0" oninput="updateQuickReimbPreview()"><span>đ</span></div>
                  </div>
                  <div class="fr-field fr-col-6">
                    <label for="reimbInputHotelCost">Lưu trú</label>
                    <div class="fr-affix"><input type="number" id="reimbInputHotelCost" class="fr-input" min="0" step="1000" placeholder="0" oninput="updateQuickReimbPreview()"><span>đ</span></div>
                  </div>
                </div>
              </div>

              <div class="fr-preview">
                <div class="fr-preview-total">
                  <span class="fr-preview-icon">${ic('file')}</span>
                  <div><span>Tạm tính vụ này</span><strong id="quickReimbPreviewAmount">0 đ</strong></div>
                </div>
                <button type="button" class="sf-button sf-primary" onclick="addReimbursementItemFromForm()">${plus}<span>Thêm vụ này</span></button>
              </div>
            </section>

            <section class="fr-card">
              <div class="fr-card-head"><span class="fr-step">2</span><div><h3>Thông tin chuyển khoản</h3><p>Sẽ được lưu làm mặc định cho các lần sau.</p></div></div>
              <div class="fr-grid">
                <div class="fr-field fr-col-4"><label for="reimbBeneficiaryName">Người thụ hưởng</label><input type="text" id="reimbBeneficiaryName" value="${val(bankBeneficiary)}" class="fr-input" placeholder="Ví dụ: NGUYEN VAN A"></div>
                <div class="fr-field fr-col-4"><label for="reimbBankAccount">Số tài khoản</label><input type="text" id="reimbBankAccount" value="${val(bankAccount)}" class="fr-input" placeholder="Số tài khoản" inputmode="numeric"></div>
                <div class="fr-field fr-col-4"><label for="reimbBankName">Tại ngân hàng</label><input type="text" id="reimbBankName" value="${val(bankName)}" class="fr-input" placeholder="Ví dụ: Vietcombank CN Hà Nội"></div>
              </div>
            </section>

            <section class="fr-card fr-card-flush">
              <div class="fr-card-head fr-card-head-pad"><span class="fr-step">3</span><div><h3>Danh sách chi tiết trong phiếu</h3><p>Kiểm tra lại các vụ đã thêm; bấm biểu tượng sửa (hoặc nhấp đúp dòng) để chỉnh từng vụ.</p></div></div>
              <div id="reimbDraftItemsContainer"></div>
            </section>
          </div>

          <footer class="fr-foot">
            <div class="fr-total"><span>Tổng cộng</span><strong id="reimbDraftTotalAmount">0 đ</strong></div>
            <div class="fr-foot-actions">
              <button type="button" class="sf-button" onclick="closeFieldReimbForm()">Đóng</button>
              <button type="button" class="sf-button sf-primary" id="btnSubmitReimb" onclick="submitFieldReimbursementBatch('${editBatchId || ''}')">${ic('arrow')}<span>${editing ? 'Cập nhật phiếu' : 'Tạo phiếu'}</span></button>
            </div>
          </footer>
        </section>`;
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


    // ---- Sửa một vụ trong phiếu: hộp thoại riêng thay cho sửa trực tiếp trên dòng ----
    function closeReimbItemEditor() {
      document.getElementById('reimbItemEditModal')?.remove();
    }

    function openReimbItemEditor(idx) {
      const item = localFieldReimbursementDraft[idx];
      if (!item) return;
      closeReimbItemEditor();
      const ic = fieldReimbIcon;
      const val = v => escapeHtmlOutput(v == null ? '' : v);
      const req = '<span class="fr-req" aria-hidden="true">*</span>';
      const vehicles = ['Phương tiện cá nhân', 'Ô tô cơ quan', 'Xe khách', 'Taxi', 'Tàu hỏa', 'Máy bay'];
      const vehicleOptions = (vehicles.includes(item.vehicle) || !item.vehicle ? vehicles : [item.vehicle, ...vehicles])
        .map(v => `<option value="${val(v)}" ${v === (item.vehicle || 'Phương tiện cá nhân') ? 'selected' : ''}>${val(v)}</option>`).join('');
      const affix = (id, v, unit, extra = '') => `<div class="fr-affix"><input type="number" id="${id}" class="fr-input" min="0" step="${unit === 'km' ? 1 : 1000}" value="${v || v === 0 && unit === 'km' ? val(v) : ''}" placeholder="0" ${extra}><span>${unit}</span></div>`;

      const m = document.createElement('div');
      m.id = 'reimbItemEditModal';
      m.className = 'fr-modal fr-item-modal';
      m.dataset.idx = String(idx);
      m.dataset.prevKm = String(item.distanceKm ?? '');
      m.dataset.prevVehicle = item.vehicle || '';
      m.dataset.prevTravel = String(item.travelCost || 0);
      m.innerHTML = `
        <section class="fr-panel fr-item-panel" role="dialog" aria-modal="true" aria-label="Sửa vụ giám định số ${idx + 1}">
          <header class="fr-head">
            <div class="sf-page-title">
              <span class="sf-page-emblem">${ic('file')}</span>
              <div>
                <div class="sf-eyebrow">Vụ giám định số ${idx + 1}</div>
                <h2>Sửa vụ giám định</h2>
                <div class="fr-meta"><span>Chi phí tự tính lại khi bạn đổi km, thời gian hoặc phương tiện.</span></div>
              </div>
            </div>
            <button type="button" class="sf-icon-button sf-bordered fr-close" aria-label="Đóng" onclick="closeReimbItemEditor()">${ic('close')}</button>
          </header>

          <div class="fr-body fr-form-body">
            <section class="fr-card">
              <div class="fr-group">
                <div class="fr-group-title">Vụ việc</div>
                <div class="fr-grid">
                  <div class="fr-field fr-col-6"><label for="editItemBS">Biển số xe KH ${req}</label><input type="text" id="editItemBS" class="fr-input" value="${val(item.bienSo)}" autocomplete="off"></div>
                  <div class="fr-field fr-col-6"><label for="editItemHSBT">Số HSBT</label><input type="text" id="editItemHSBT" class="fr-input" value="${val(item.soHSBT)}" autocomplete="off"></div>
                </div>
              </div>
              <div class="fr-group">
                <div class="fr-group-title">Thời gian giám định</div>
                <div class="fr-grid">
                  <div class="fr-field fr-col-6"><label for="editItemStart">Giờ bắt đầu GĐ</label><input type="datetime-local" id="editItemStart" class="fr-input" value="${val(item.startDatetime)}" onchange="reimbItemEditorPreview()"></div>
                  <div class="fr-field fr-col-6"><label for="editItemEnd">Giờ kết thúc GĐ ${req}</label><input type="datetime-local" id="editItemEnd" class="fr-input" value="${val(item.datetime)}" onchange="reimbItemEditorPreview()" oninput="reimbItemEditorPreview()"></div>
                  <div class="fr-field fr-col-12">
                    <div class="fr-checks">
                      <label class="fr-check"><input type="checkbox" id="editItemHoliday" ${item.isHolidayChecked ? 'checked' : ''} onchange="reimbItemEditorPreview()"><span>Ngày Lễ / Cuối tuần</span></label>
                      <label class="fr-check" title="Áp dụng cho Cao tốc cấm xe máy hoặc Đặc thù (Có phê duyệt)"><input type="checkbox" id="editItemSpecial" ${item.isSpecialCase ? 'checked' : ''} onchange="reimbItemEditorTravel()"><span>Đặc thù / Cao tốc</span></label>
                    </div>
                  </div>
                </div>
              </div>
              <div class="fr-group">
                <div class="fr-group-title">Di chuyển &amp; chi phí</div>
                <div class="fr-grid">
                  <div class="fr-field fr-col-4"><label for="editItemVehicle">Phương tiện di chuyển</label><select id="editItemVehicle" class="fr-input" onchange="reimbItemEditorTravel()">${vehicleOptions}</select></div>
                  <div class="fr-field fr-col-4"><label for="editItemKm">Khoảng cách 1 chiều ${req}</label>${affix('editItemKm', item.distanceKm, 'km', 'oninput="reimbItemEditorTravel()"')}</div>
                  <div class="fr-field fr-col-4"><label for="editItemTravel">Chi phí đi lại</label>${affix('editItemTravel', item.travelCost, 'đ', 'oninput="this.dataset.manual=\'1\'; reimbItemEditorPreview()"')}</div>
                  <div class="fr-field fr-col-4"><label for="editItemPerDiem">Công tác phí</label>${affix('editItemPerDiem', item.perDiem, 'đ', 'oninput="reimbItemEditorPreview()"')}</div>
                  <div class="fr-field fr-col-4"><label for="editItemHotel">Lưu trú</label>${affix('editItemHotel', item.hotelCost, 'đ', 'oninput="reimbItemEditorPreview()"')}</div>
                  <div class="fr-field fr-col-4" id="editItemLocationBox"><label for="editItemLocation">Địa bàn giám định <span class="fr-req" id="editItemLocReq" aria-hidden="true">*</span></label><input type="text" id="editItemLocation" class="fr-input" value="${val(item.location)}" placeholder="Nhập địa bàn"></div>
                </div>
              </div>
            </section>
            <div class="fr-breakdown" id="editItemBreakdown"></div>
          </div>

          <footer class="fr-foot">
            <div class="fr-total"><span>Thành tiền vụ này</span><strong id="editItemTotal">0 đ</strong></div>
            <div class="fr-foot-actions">
              <button type="button" class="sf-button" onclick="closeReimbItemEditor()">Hủy</button>
              <button type="button" class="sf-button sf-primary" onclick="saveReimbItemEdit(${idx})">${ic('check')}<span>Lưu thay đổi</span></button>
            </div>
          </footer>
        </section>`;
      document.body.appendChild(m);
      reimbItemEditorPreview();
      document.getElementById('editItemBS')?.focus();
    }

    // Đổi km / phương tiện / đặc thù → tính lại chi phí đi lại, trừ khi người dùng đã tự gõ số khác
    function reimbItemEditorTravel() {
      const modal = document.getElementById('reimbItemEditModal');
      const input = document.getElementById('editItemTravel');
      if (!modal || !input) return;
      const km = parseFloat(document.getElementById('editItemKm').value) || 0;
      const vehicle = document.getElementById('editItemVehicle').value;
      const special = document.getElementById('editItemSpecial').checked;
      input.dataset.manual = '';
      if (vehicle === 'Ô tô cơ quan' || (km <= 30 && !special)) input.value = 0;
      else if (vehicle === 'Phương tiện cá nhân') input.value = calculatePersonalTravelCost(km);
      reimbItemEditorPreview();
    }

    function reimbItemEditorPreview() {
      const num = id => parseFloat(document.getElementById(id)?.value) || 0;
      const km = num('editItemKm');
      const calc = calculateFieldCost(km, document.getElementById('editItemEnd')?.value, !!document.getElementById('editItemHoliday')?.checked);
      const travel = num('editItemTravel'), perDiem = num('editItemPerDiem'), hotel = num('editItemHotel');
      const total = calc.finalCost + travel + perDiem + hotel;
      const money = n => n.toLocaleString('vi-VN') + ' đ';
      const need = hotel > 0;
      const locReq = document.getElementById('editItemLocReq');
      if (locReq) locReq.style.display = need ? '' : 'none';
      const note = calc.isWeekendOrHoliday ? ' · Lễ/Cuối tuần' : calc.isAfterHours ? ' · Ngoài giờ' : '';
      const box = document.getElementById('editItemBreakdown');
      if (box) box.innerHTML = [
        ['Thù lao giám định' + note, calc.finalCost], ['Chi phí đi lại', travel], ['Công tác phí', perDiem], ['Lưu trú', hotel]
      ].map(([l, v]) => `<div class="fr-stat"><span>${l}</span><strong>${money(v)}</strong></div>`).join('');
      const t = document.getElementById('editItemTotal');
      if (t) t.textContent = money(total);
    }

    function saveReimbItemEdit(idx) {
      const previous = localFieldReimbursementDraft[idx];
      if (!previous) return closeReimbItemEditor();
      const get = id => document.getElementById(id);
      const bs = get('editItemBS').value.trim();
      const date = get('editItemEnd').value;
      const km = parseFloat(get('editItemKm').value);
      const hotelCost = parseFloat(get('editItemHotel').value) || 0;
      const location = get('editItemLocation').value.trim();
      if (!bs) return triggerToast('Vui lòng nhập Biển số xe', 'error');
      if (!date) return triggerToast('Vui lòng chọn thời gian kết thúc', 'error');
      if (isNaN(km) || km < 0) return triggerToast('Vui lòng nhập số km hợp lệ', 'error');
      if (hotelCost > 0 && !location) return triggerToast('Vui lòng nhập Địa bàn giám định (bắt buộc khi có lưu trú)', 'error');

      const isHoliday = get('editItemHoliday').checked;
      localFieldReimbursementDraft[idx] = {
        ...previous,
        bienSo: bs,
        soHSBT: get('editItemHSBT').value.trim(),
        startDatetime: get('editItemStart').value,
        datetime: date,
        distanceKm: km,
        isHolidayChecked: isHoliday,
        isSpecialCase: get('editItemSpecial').checked,
        vehicle: get('editItemVehicle').value,
        travelCost: parseFloat(get('editItemTravel').value) || 0,
        perDiem: parseFloat(get('editItemPerDiem').value) || 0,
        hotelCost,
        location,
        calcResult: calculateFieldCost(km, date, isHoliday)
      };
      closeReimbItemEditor();
      renderReimbursementDraftItems();
      triggerToast('Đã cập nhật vụ số ' + (idx + 1), 'success');
    }


    function renderReimbursementDraftItems() {
      const container = document.getElementById('reimbDraftItemsContainer');
      const totalLbl = document.getElementById('reimbDraftTotalAmount');
      if (!container || !totalLbl) return;

      if (localFieldReimbursementDraft.length === 0) {
        container.innerHTML = `<div class="sf-empty fr-draft-empty"><span class="fr-empty-icon">${fieldReimbIcon('file')}</span><h3>Chưa thêm vụ nào</h3><p>Điền thông tin ở bước 1 rồi bấm “Thêm vụ này”.</p></div>`;
        totalLbl.textContent = '0 đ';
        return;
      }

      const money = n => (Number(n) || 0).toLocaleString('vi-VN') + ' đ';
      const moneyOrDash = n => (Number(n) || 0) > 0 ? money(n) : '<span class="fr-dash">–</span>';
      let total = 0;
      let html = `
        <div class="sf-table-scroll">
          <table class="sf-table fr-detail-table">
            <thead><tr>
              <th class="fr-num">STT</th><th>Bắt đầu</th><th>Kết thúc</th><th>Biển số xe KH</th><th>Số HSBT</th>
              <th class="fr-right">Khoảng cách</th><th class="fr-right">Thù lao GĐ</th><th>Phương tiện</th>
              <th class="fr-right">Chi phí đi lại</th><th class="fr-right">Công tác phí</th><th class="fr-right">Lưu trú</th>
              <th>Địa bàn</th><th class="fr-right">Thành tiền</th><th class="fr-center">Thao tác</th>
            </tr></thead>
            <tbody>`;

      html += localFieldReimbursementDraft.map((item, idx) => {
        const subtotal = (item.calcResult.finalCost || 0) + (item.travelCost || 0) + (item.perDiem || 0) + (item.hotelCost || 0);
        total += subtotal;

        const noteStr = [];
        if (item.calcResult.isWeekendOrHoliday) noteStr.push('Lễ/Cuối tuần');
        else if (item.calcResult.isAfterHours) noteStr.push('Ngoài giờ');
        if (item.isSpecialCase) noteStr.push('Đặc thù/Cao tốc');

        return `
          <tr class="sf-row fr-editable" ondblclick="openReimbItemEditor(${idx})" title="Nhấp đúp để sửa">
            <td class="fr-num fr-idx">${idx + 1}</td>
            <td class="sf-col-date">${item.startDatetime ? formatDateDisplay(item.startDatetime).replace('—', '<br>') : '<span class="fr-dash">–</span>'}</td>
            <td class="sf-col-date">${formatDateDisplay(item.datetime).replace('—', '<br>')}${noteStr.length ? `<br><span class="fr-note">${noteStr.join(', ')}</span>` : ''}</td>
            <td class="fr-plate">${escapeHtmlOutput(item.bienSo)}</td>
            <td class="fr-hsbt">${escapeHtmlOutput(item.soHSBT || '')}</td>
            <td class="fr-right">${item.distanceKm} km</td>
            <td class="fr-right">${money(item.calcResult.finalCost)}</td>
            <td>${escapeHtmlOutput(item.vehicle || '')}</td>
            <td class="fr-right">${moneyOrDash(item.travelCost)}</td>
            <td class="fr-right">${moneyOrDash(item.perDiem)}</td>
            <td class="fr-right">${moneyOrDash(item.hotelCost)}</td>
            <td>${escapeHtmlOutput(item.location || '')}</td>
            <td class="fr-money">${money(subtotal)}</td>
            <td class="fr-center"><div class="fr-row-actions">
              <button type="button" class="sf-icon-button" onclick="openReimbItemEditor(${idx})" title="Sửa vụ này" aria-label="Sửa vụ ${idx + 1}">${fieldReimbIcon('file')}</button>
              <button type="button" class="sf-icon-button sf-danger" onclick="removeReimbursementItem(${idx})" title="Xóa vụ này" aria-label="Xóa vụ ${idx + 1}">${fieldReimbIcon('trash')}</button>
            </div></td>
          </tr>`;
      }).join('');

      html += `</tbody></table></div>`;
      container.innerHTML = html;
      totalLbl.textContent = money(total);
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


    // Tính lại chi phí đi lại của cả phiếu theo quy tắc hiện hành (km 1 chiều ×2, <100 km 4.000đ/km, ≥100 km 3.000đ/km).
    function planReimbursementTravelRecalc(items) {
      let changed = 0;
      const nextItems = (items || []).map(item => {
        if (!item || item.vehicle !== 'Phương tiện cá nhân') return item;
        const km = Number(item.distanceKm) || 0;
        if (km <= 30 && !item.isSpecialCase) return item;
        const nextCost = calculatePersonalTravelCost(km);
        if (nextCost === (Number(item.travelCost) || 0)) return item;
        changed++;
        return {...item, travelCost: nextCost};
      });
      const totalAmount = nextItems.reduce((acc, it) => acc + ((it.calcResult && it.calcResult.finalCost) || 0) + (Number(it.travelCost) || 0) + (Number(it.perDiem) || 0) + (Number(it.hotelCost) || 0), 0);
      return {nextItems, changed, totalAmount};
    }


    async function recalculateReimbursementTravelCost(batchId) {
      const payload = cachedFieldReimbursementsPayload && cachedFieldReimbursementsPayload[batchId];
      if (!payload) return;
      const plan = planReimbursementTravelRecalc(payload.items);
      if (!plan.changed) return triggerToast('Chi phí đi lại của phiếu đã đúng quy tắc, không cần tính lại.', 'success');
      const oldTotal = Number(payload.totalAmount) || 0;
      const ok = await showConfirmModal('Tính lại chi phí đi lại?', `${plan.changed} vụ sẽ được tính lại theo quãng đường 2 chiều (dưới 100 km: 4.000đ/km, từ 100 km: 3.000đ/km). Tổng phiếu: ${oldTotal.toLocaleString('vi-VN')}đ → ${plan.totalAmount.toLocaleString('vi-VN')}đ.`, 'Tính lại');
      if (!ok) return;
      try {
        await dbNodeInstance.ref(`field_reimbursements/${batchId}`).update({items: plan.nextItems, totalAmount: plan.totalAmount});
        logUserActivity('RECALC_FIELD_REIMB', `Tính lại chi phí đi lại phiếu ${batchId} (${oldTotal.toLocaleString('vi-VN')}đ → ${plan.totalAmount.toLocaleString('vi-VN')}đ)`);
        triggerToast(`Đã tính lại ${plan.changed} vụ. Tổng phiếu: ${plan.totalAmount.toLocaleString('vi-VN')}đ`, 'success');
        document.getElementById('viewFieldReimbModal')?.remove();
        setTimeout(() => viewFieldReimbursementDetail(batchId), 500);
      } catch (error) {
        console.error(error);
        triggerToast('Không cập nhật được phiếu. Kiểm tra quyền và kết nối.', 'error');
      }
    }


    function closeFieldReimbDetail() {
      document.getElementById('viewFieldReimbModal')?.remove();
    }

    function viewFieldReimbursementDetail(batchId) {
      const payload = cachedFieldReimbursementsPayload[batchId];
      if (!payload) return;
      closeFieldReimbDetail();

      const ic = fieldReimbIcon;
      const money = n => (Number(n) || 0).toLocaleString('vi-VN') + ' đ';
      const moneyOrDash = n => (Number(n) || 0) > 0 ? money(n) : '<span class="fr-dash">–</span>';
      const id = escapeHtmlOutput(payload.id);

      const key = fieldReimbStatusKey(payload);
      const statusHtml = key === 'paid' ? '<span class="fr-badge fr-paid">Đã chi trả</span>'
        : key === 'rejected' ? '<span class="fr-badge fr-rejected">Từ chối</span>'
        : '<span class="fr-badge fr-new">Mới tạo</span>';

      const isAdmin = activeUserProfile && (
        String(activeUserProfile.role || '').trim().toLowerCase() === 'admin' ||
        activeUserProfile.isAdmin === true
      );
      const isCreator = payload.gdvUid === firebase.auth().currentUser?.uid;
      const isNew = payload.status === 'pending' || payload.status === 'new' || payload.status === 'rejected';
      const isPaid = payload.status === 'approved' || payload.status === 'paid';

      const btn = (cls, iconName, label, onclick, title) =>
        `<button type="button" class="sf-button ${cls}"${title ? ` title="${title}"` : ''} onclick="${onclick}">${ic(iconName)}<span>${label}</span></button>`;

      // Nhóm hành động: giữ nguyên toàn bộ quyền như bản cũ
      let primary = '';
      let secondary = '';
      let danger = '';
      if ((isCreator && isNew) || isAdmin) {
        secondary += btn('', 'file', 'Sửa phiếu', `closeFieldReimbDetail(); openCreateFieldReimbursementModal('${id}')`);
        if (!isPaid) {
          secondary += btn('', 'refresh', 'Tính lại đi lại', `recalculateReimbursementTravelCost('${id}')`, 'Tính lại chi phí đi lại theo quãng đường 2 chiều');
          primary += btn('sf-primary', 'check', 'Đánh dấu đã chi trả', `actionFieldReimbursement('${id}', 'paid')`);
        }
      }
      if (isPaid && (isCreator || isAdmin)) {
        secondary += btn('', 'refresh', 'Chuyển về mới tạo', `actionFieldReimbursement('${id}', 'new')`);
      }
      if (isAdmin || (isCreator && isNew)) {
        danger += btn('sf-danger', 'trash', 'Xoá phiếu', `closeFieldReimbDetail(); deleteFieldReimbursement('${id}')`);
      }
      secondary += btn('', 'download', 'Xuất bảng kê', `exportFieldReimbursementToExcel('${id}')`);
      secondary += btn('', 'print', 'In phiếu', `printFieldReimbursementTemplate('${id}')`);

      const items = payload.items || [];
      const sum = { gd: 0, travel: 0, perDiem: 0, hotel: 0 };
      const rows = items.map((it, idx) => {
        const tlGD = it.calcResult?.finalCost || 0;
        const cpDL = it.travelCost || 0;
        const ctp = it.perDiem || 0;
        const lt = it.hotelCost || 0;
        sum.gd += tlGD; sum.travel += cpDL; sum.perDiem += ctp; sum.hotel += lt;
        const when = v => v ? formatDateDisplay(v).replace('—', '<br>') : '<span class="fr-dash">–</span>';
        return `<tr class="sf-row">
          <td class="fr-num fr-idx">${idx + 1}</td>
          <td class="sf-col-date">${when(it.startDatetime)}</td>
          <td class="sf-col-date">${when(it.datetime)}</td>
          <td class="fr-plate">${escapeHtmlOutput(it.bienSo)}</td>
          <td class="fr-hsbt">${escapeHtmlOutput(it.soHSBT || '-')}</td>
          <td class="fr-right">${escapeHtmlOutput(it.distanceKm)} km</td>
          <td class="fr-right">${moneyOrDash(tlGD)}</td>
          <td>${escapeHtmlOutput(it.vehicle || '-')}</td>
          <td class="fr-right">${moneyOrDash(cpDL)}</td>
          <td class="fr-right">${moneyOrDash(ctp)}</td>
          <td class="fr-right">${moneyOrDash(lt)}</td>
          <td>${escapeHtmlOutput(it.location || '-')}</td>
          <td class="fr-money">${money(tlGD + cpDL + ctp + lt)}</td>
        </tr>`;
      }).join('');

      const stat = (label, value, cls) => `<div class="fr-stat ${cls || ''}"><span>${label}</span><strong>${value}</strong></div>`;
      const m = document.createElement('div');
      m.id = 'viewFieldReimbModal';
      m.className = 'fr-modal';
      m.innerHTML = `
        <section class="fr-panel" role="dialog" aria-modal="true" aria-label="Chi tiết đề nghị thanh toán ${id}">
          <header class="fr-head">
            <div class="sf-page-title">
              <span class="sf-page-emblem">${ic('file')}</span>
              <div>
                <div class="sf-eyebrow">Đề nghị thanh toán · Hiện trường</div>
                <h2>Chi tiết đề nghị thanh toán</h2>
                <div class="fr-meta">
                  <span class="fr-code">${id}</span>
                  ${statusHtml}
                  <span class="fr-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4.5"/><path d="M20 21a8 8 0 1 0-16 0"/></svg><strong>${escapeHtmlOutput(payload.gdvName)}</strong></span>
                  <span class="fr-meta-item">${ic('clock')}${new Date(payload.createdAt).toLocaleString('vi-VN')}</span>
                </div>
              </div>
            </div>
            <button type="button" class="sf-icon-button sf-bordered fr-close" aria-label="Đóng" onclick="closeFieldReimbDetail()">${ic('close')}</button>
          </header>

          <div class="fr-actions-bar">
            <div class="fr-actions-group">${secondary}</div>
            <div class="fr-actions-group fr-actions-end">${danger}${primary}</div>
          </div>

          <div class="fr-body">
            <div class="fr-stats">
              ${stat('Số vụ giám định', items.length)}
              ${stat('Thù lao giám định', money(sum.gd))}
              ${stat('Chi phí đi lại', money(sum.travel))}
              ${stat('Công tác phí & lưu trú', money(sum.perDiem + sum.hotel))}
            </div>
            <h3 class="fr-section">Danh sách vụ giám định <span class="sf-count">${items.length} vụ</span></h3>
            <div class="fr-table-card">
              <div class="sf-table-scroll">
                <table class="sf-table fr-detail-table">
                  <caption class="sf-sr-only">Danh sách vụ giám định trong phiếu ${id}</caption>
                  <thead><tr>
                    <th class="fr-num">STT</th><th>Bắt đầu</th><th>Kết thúc</th><th>Biển số xe KH</th><th>Số HSBT</th>
                    <th class="fr-right">Khoảng cách</th><th class="fr-right">Thù lao GĐ</th><th>Phương tiện</th>
                    <th class="fr-right">Chi phí đi lại</th><th class="fr-right">Công tác phí</th><th class="fr-right">Lưu trú</th>
                    <th>Địa bàn</th><th class="fr-right">Thành tiền</th>
                  </tr></thead>
                  <tbody>${rows || '<tr><td colspan="13"><div class="sf-empty"><p>Phiếu chưa có vụ giám định nào.</p></div></td></tr>'}</tbody>
                </table>
              </div>
            </div>
          </div>

          <footer class="fr-foot">
            <div class="fr-total"><span>Tổng tiền thanh toán</span><strong>${money(payload.totalAmount)}</strong></div>
            <button type="button" class="sf-button" onclick="closeFieldReimbDetail()">Đóng chi tiết</button>
          </footer>
        </section>`;
      document.body.appendChild(m);
    }
