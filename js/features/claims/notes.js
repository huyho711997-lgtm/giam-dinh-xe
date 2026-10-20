

    
function renderPendingNotesTrackerPage(targetContainer) {
  const container = targetContainer || document.getElementById('tabContentContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="workspace-grid single-col">
      <section class="p-card cases-panel" style="padding: 28px;">
        
        <!-- Header Title & Action Buttons -->
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; border-bottom: 1px solid var(--border); padding-bottom: 18px;">
          <div>
            <h2 style="font-size: 22px; font-weight: 850; color: var(--text-main); display: flex; align-items: center; gap: 10px; margin: 0;">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <span>Quản lý tiến độ Hồ sơ tồn</span>
            </h2>
            <p style="margin-top: 6px; font-size: 13px; color: var(--text-soft);">Bảng theo dõi và ghi chú tình trạng xử lý độc lập cho các hồ sơ tồn đọng.</p>
          </div>
        </div>

        <!-- Stats Container -->
        <div id="pendingNotesStatsContainer" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px; margin-bottom: 24px;">
          <!-- Rendered dynamically -->
        </div>

        <!-- Filter Toolbar Row Premium Luxury System -->
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; background: var(--surface); padding: 14px 20px; border-radius: 16px; border: 1px solid var(--border-strong); box-shadow: var(--shadow-sm);">
          
          <!-- Left Side: Search Input -->
          <div class="search-wrap" style="margin: 0; min-width: 240px; max-width: 320px; flex: 1; position: relative;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="svg-icon" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--primary); pointer-events: none;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" id="pendingNotesSearchInput" class="input-premium" placeholder="Tìm kiếm BSX, Mã VTT, GĐV..." autocomplete="off" style="width: 100%; height: 42px; font-size: 13px; border-radius: 12px; font-weight: 600; padding-left: 42px; border: 1px solid var(--input-border, var(--border)); background: var(--bg-soft); color: var(--text-main); box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);" oninput="setPendingNotesPage(1)" />
          </div>

          <!-- Middle Side: Unified Dropdown Filter Control Group -->
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: nowrap; flex: 2; min-width: 300px;">
            <!-- Filter 1: Status -->
            <div class="custom-dropdown-container" style="position: relative; flex: 1; min-width: 160px; max-width: 220px;">
              <button id="btnPendingNotesStatusDropdown" type="button" onclick="togglePendingNotesStatusDropdown(event)" style="width: 100%; height: 42px; padding: 0 28px 0 34px; border-radius: 12px; font-size: 12.5px; font-weight: 750; background: var(--bg-soft); border: 1px solid var(--border); color: var(--text-main); display: flex; align-items: center; justify-content: space-between; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.03); position: relative; transition: all 0.2s ease;">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--primary); pointer-events: none;"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                <span id="lblPendingNotesStatusDropdownSelected" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; font-weight: 750;">Tất cả trạng thái (0)</span>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none;"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
              <div id="menuPendingNotesStatusDropdown" class="custom-dropdown-menu" style="display: none; position: absolute; top: calc(100% + 5px); left: 0; width: 100%; min-width: 210px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 12px; box-shadow: 0 12px 30px -4px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.06); padding: 4px; z-index: 1000; backdrop-filter: blur(12px);">
                <!-- Rendered dynamically -->
              </div>
            </div>

            <!-- Filter 2: GDV Team -->
            <div class="custom-dropdown-container" style="position: relative; flex: 1; min-width: 140px; max-width: 200px;">
              <button id="btnPendingNotesGdvDropdown" type="button" onclick="togglePendingNotesGdvDropdown(event)" style="width: 100%; height: 42px; padding: 0 28px 0 34px; border-radius: 12px; font-size: 12.5px; font-weight: 750; background: var(--bg-soft); border: 1px solid var(--border); color: var(--text-main); display: flex; align-items: center; justify-content: space-between; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.03); position: relative; transition: all 0.2s ease;">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #3b82f6; pointer-events: none;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                <span id="lblPendingNotesGdvDropdownSelected" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; font-weight: 750;">Tất cả GĐV team</span>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none;"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
              <div id="menuPendingNotesGdvDropdown" class="custom-dropdown-menu" style="display: none; position: absolute; top: calc(100% + 5px); left: 0; width: 100%; min-width: 190px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 12px; box-shadow: 0 12px 30px -4px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.06); padding: 4px; z-index: 1000; backdrop-filter: blur(12px);">
                <!-- Rendered dynamically -->
              </div>
            </div>

            <!-- Quick Reset Filters Button -->
            <button type="button" class="btn-premium btn-secondary" onclick="resetAllPendingNotesFilters()" title="Đặt lại bộ lọc" style="width: 42px; height: 42px; min-width: 42px; min-height: 42px; padding: 0; border-radius: 12px; display: grid; place-items: center; cursor: pointer;" aria-label="Đặt lại bộ lọc">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
            </button>
          </div>

          <!-- Right Side: Luxury Pagination -->
          <div id="pendingNotesPaginationContainer" style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: nowrap; flex: 1;">
            <!-- Rendered by JS -->
          </div>
        </div>

        <!-- Table Container -->
        <div class="table-container" style="border: 1px solid var(--border); border-radius: 14px; background: var(--bg-soft); overflow: hidden;">
          <table class="p-table" id="pendingNotesTable" style="width: 100%; border-collapse: collapse; min-width: 1300px; table-layout: fixed;">
            <thead>
              <tr style="background: var(--bg-soft); border-bottom: 2px solid var(--border-strong);">
                <th style="width: 50px; text-align: center;">STT</th>
                <th style="width: 120px;">Trạng thái</th>
                <th style="width: 150px;">Biển số / Mã VTT</th>
                <th style="width: 180px;">Tên chủ xe</th>
                <th style="width: 190px;">Hãng xe & Đơn vị cấp</th>
                <th style="width: 300px;">Nội dung tổn thất</th>
                <th style="width: 150px;">GĐV Xử lý</th>
                <th style="width: 350px;">Ghi chú tiến độ (Độc lập)</th>
              </tr>
            </thead>
            <tbody id="tblPendingNotesBody">
              <!-- Rendered by JS -->
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- Note Modal -->
    <div id="pendingNoteModalOverlay" class="p-modal-overlay" aria-hidden="true" style="display: none; z-index: 9999;">
      <div class="p-modal" style="width: 100%; max-width: 550px; padding: 28px; text-align: left;">
        <h3 style="margin: 0 0 16px 0; color: var(--text-main); font-size: 20px; font-weight: 850; display: flex; align-items: center; gap: 8px;">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#10b981" stroke-width="3"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          Lịch sử Ghi chú Tiến độ
        </h3>
        <div style="font-size: 13.5px; color: var(--text-muted); margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border-subtle);">
          Cập nhật tiến độ cho hồ sơ: <strong id="lblPendingNoteTitle" style="color: var(--text-main); font-weight: 800;"></strong>
        </div>

        <div id="pendingNoteHistoryContainer" style="max-height: 300px; overflow-y: auto; margin-bottom: 20px; display: flex; flex-direction: column; gap: 12px; padding-right: 8px;">
          <!-- History rendered here -->
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display: block; font-size: 12px; font-weight: 800; color: var(--text-soft); margin-bottom: 8px;">NHẬP GHI CHÚ MỚI</label>
          <textarea id="txtPendingNoteInput" class="input-premium" placeholder="VD: Đã liên hệ KH yêu cầu bổ sung đăng kiểm..." style="width: 100%; min-height: 90px; resize: vertical; padding: 14px; font-size: 13.5px;"></textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 12px;">
          <button class="btn-premium btn-secondary" onclick="closePendingNoteModal()" style="padding: 0 20px; height: 42px;">Hủy bỏ</button>
          <button id="btnSavePendingNote" class="btn-premium btn-primary" onclick="savePendingNote()" style="padding: 0 24px; height: 42px; display: flex; align-items: center; gap: 8px; font-weight: 800;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            Lưu Ghi Chú
          </button>
        </div>
      </div>
    </div>
  `;

  executeUIRenderPendingNotesTable();
}


function togglePendingNotesStatusDropdown(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById('menuPendingNotesStatusDropdown');
  if (!menu) return;
  const isHidden = menu.style.display === 'none' || !menu.style.display;
  closeAllCustomDropdowns();
  if (isHidden) menu.style.display = 'block';
}


function selectPendingNotesStatusFilter(event, statusKey) {
  if (event) event.stopPropagation();
  let arr = Array.isArray(activePendingNotesStatusFilter) ? activePendingNotesStatusFilter : [activePendingNotesStatusFilter || 'all'];

  if (statusKey === 'all') {
    arr = ['all'];
  } else {
    if (arr.includes('all')) {
      arr = [statusKey];
    } else {
      if (arr.includes(statusKey)) {
        arr = arr.filter(k => k !== statusKey);
        if (arr.length === 0) arr = ['all'];
      } else {
        arr.push(statusKey);
      }
    }
  }
  activePendingNotesStatusFilter = arr;
  setPendingNotesPage(1);
}


function togglePendingNotesGdvDropdown(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById('menuPendingNotesGdvDropdown');
  if (!menu) return;
  const isHidden = menu.style.display === 'none' || !menu.style.display;
  closeAllCustomDropdowns();
  if (isHidden) menu.style.display = 'block';
}


function selectPendingNotesGdvFilter(val) {
  activePendingNotesGdvFilter = val;
  setPendingNotesPage(1);
}


function resetAllPendingNotesFilters() {
  activePendingNotesStatusFilter = ['all'];
  activePendingNotesGdvFilter = 'all';
  const searchInput = document.getElementById('pendingNotesSearchInput');
  if (searchInput) searchInput.value = '';
  setPendingNotesPage(1);
}


function setPendingNotesPerPage(val) {
  pendingNotesPerPage = parseInt(val, 10) || 20;
  pendingNotesCurrentPage = 1;
  executeUIRenderPendingNotesTable();
}


function setPendingNotesPage(page) {
  pendingNotesCurrentPage = page;
  executeUIRenderPendingNotesTable();
}


function executeUIRenderPendingNotesTable() {
  const tbody = document.getElementById('tblPendingNotesBody');
  if (!tbody) return;

  const searchVal = (document.getElementById('pendingNotesSearchInput')?.value || '').toLowerCase().trim();
  const claimsList = Object.values(cachedPendingClaimsPayload || {});

  
  
  const allowedStatuses = [
    'moi', 'cho_giam_dinh_ht', 'da_giam_dinh_ht', 'cho_gdct',
    'da_gdct', 'cho_duyet_pasc', 'da_duyet_pasc', 'cho_duyet_hsbt'
  ];
  let baseFiltered = claimsList.filter(c => allowedStatuses.includes(String(c.trangThai || 'moi').toLowerCase()));

  // Determine available GDVs
  const gdvMap = {};
  baseFiltered.forEach(c => {
    let gdv = (c.gdvHo || c.canBoXuLy || '').trim();
    if (!gdv) gdv = 'Chưa rõ';
    gdvMap[gdv] = (gdvMap[gdv] || 0) + 1;
  });
  const gdvOptions = Object.keys(gdvMap).sort();

  // Apply Status filter
  let filtered = baseFiltered;
  if (!activePendingNotesStatusFilter.includes('all')) {
    filtered = filtered.filter(c => activePendingNotesStatusFilter.includes(String(c.trangThai || 'moi').toLowerCase()));
  }

  // Apply GDV filter
  if (activePendingNotesGdvFilter !== 'all') {
    filtered = filtered.filter(c => {
      let gdv = (c.gdvHo || c.canBoXuLy || '').trim() || 'Chưa rõ';
      return gdv === activePendingNotesGdvFilter;
    });
  }



  if (searchVal) {
    filtered = filtered.filter(c => {
      const bsx = (c.bienSo || '').toLowerCase();
      const hsbt = (c.soHoSoBoiThuong || '').toLowerCase();
      const gdv = (c.gdvHo || c.canBoXuLy || '').toLowerCase();
      return bsx.includes(searchVal) || hsbt.includes(searchVal) || gdv.includes(searchVal);
    });
  }

  filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const totalFilteredCount = filtered.length;

  // Calculate Stats
  let countWithNotes = 0;
  let countWithoutNotes = 0;
  let countOver3Days = 0;
  const nowMs = Date.now();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

  filtered.forEach(c => {
    const identifier = (c.bienSo || c.soHoSoBoiThuong || c.id || '').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
    const noteData = cachedPendingNotesPayload[identifier] || {};
    const history = noteData.history || [];
    if (history.length > 0) {
      countWithNotes++;
    } else {
      countWithoutNotes++;
    }

    // Check if created > 3 days ago and no notes OR last note was > 3 days ago
    
    const dateStr = c.ngayMoHs || c.ngayTonThat || c.ngayVTT;
    let createdAtMs = c.createdAt || nowMs;
    if (dateStr && dateStr !== '—') {
      const parts = dateStr.split(/[\s/:-]/);
      // Usually DD/MM/YYYY or similar, very basic fallback parsing
      if (parts.length >= 3) {
        let d = parseInt(parts[0], 10);
        let m = parseInt(parts[1], 10);
        let y = parseInt(parts[2], 10);
        if (y < 100) y += 2000;
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
          createdAtMs = new Date(y, m - 1, d).getTime();
        }
      }
    }

    const lastNoteMs = history.length > 0 ? history[history.length - 1].timestamp : 0;
    
    if (history.length === 0) {
      if (nowMs - createdAtMs > threeDaysMs) countOver3Days++;
    } else {
      if (nowMs - lastNoteMs > threeDaysMs) countOver3Days++;
    }
  });

  const rateNotes = totalFilteredCount > 0 ? Math.round((countWithNotes / totalFilteredCount) * 100) : 0;

  
  const statsEl = document.getElementById('pendingNotesStatsContainer');
  if (statsEl) {
    statsEl.innerHTML = `
      <!-- Box 1: Tổng số hồ sơ (Gold) -->
      <div style="background: linear-gradient(180deg, rgba(216,180,109,0.03) 0%, rgba(216,180,109,0.06) 100%), var(--surface); border: 1px solid rgba(216,180,109,0.25); border-radius: 16px; padding: 16px 20px; box-shadow: 0 2px 10px rgba(216,180,109,0.04); position: relative; overflow: hidden; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(216,180,109,0.12)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 10px rgba(216,180,109,0.04)'">
        <div style="position: absolute; right: 10px; bottom: 10px; opacity: 0.05; color: var(--primary); transform: scale(4) rotate(-15deg); pointer-events: none; z-index: 0;">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
        </div>
        <div style="position: relative; z-index: 2;">
          <span style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 850; color: var(--primary); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px;">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            TỔNG SỐ HỒ SƠ TỒN
          </span>
          <div style="font-size: 28px; font-weight: 900; color: var(--primary); display: flex; align-items: baseline; gap: 6px;">
            ${totalFilteredCount} <span style="font-size: 13px; font-weight: 700; color: var(--text-soft);">ca</span>
          </div>
        </div>
      </div>

      <!-- Box 2: Đã cập nhật (Green) -->
      <div style="background: linear-gradient(180deg, rgba(16,185,129,0.03) 0%, rgba(16,185,129,0.06) 100%), var(--surface); border: 1px solid rgba(16,185,129,0.25); border-radius: 16px; padding: 16px 20px; box-shadow: 0 2px 10px rgba(16,185,129,0.04); position: relative; overflow: hidden; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(16,185,129,0.12)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 10px rgba(16,185,129,0.04)'">
        <div style="position: absolute; right: 10px; bottom: 10px; opacity: 0.05; color: #10b981; transform: scale(4) rotate(-15deg); pointer-events: none; z-index: 0;">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        </div>
        <div style="position: relative; z-index: 2;">
          <span style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 850; color: #10b981; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px;">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            ĐÃ CẬP NHẬT GHI CHÚ
          </span>
          <div style="font-size: 28px; font-weight: 900; color: #10b981; display: flex; align-items: baseline; gap: 6px;">
            ${countWithNotes} <span style="font-size: 13px; font-weight: 700; color: var(--text-soft);">ca</span>
          </div>
        </div>
      </div>

      <!-- Box 3: Cảnh báo (Red) -->
      <div style="background: linear-gradient(180deg, rgba(239,68,68,0.03) 0%, rgba(239,68,68,0.06) 100%), var(--surface); border: 1px solid rgba(239,68,68,0.25); border-radius: 16px; padding: 16px 20px; box-shadow: 0 2px 10px rgba(239,68,68,0.04); position: relative; overflow: hidden; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(239,68,68,0.12)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 10px rgba(239,68,68,0.04)'">
        <div style="position: absolute; right: 10px; bottom: 10px; opacity: 0.05; color: #ef4444; transform: scale(4) rotate(-15deg); pointer-events: none; z-index: 0;">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        </div>
        <div style="position: relative; z-index: 2;">
          <span style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 850; color: #ef4444; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px;">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            CẢNH BÁO > 3 NGÀY
          </span>
          <div style="font-size: 28px; font-weight: 900; color: #ef4444; display: flex; align-items: baseline; gap: 6px;">
            ${countOver3Days} <span style="font-size: 13px; font-weight: 700; color: var(--text-soft);">ca</span>
          </div>
        </div>
      </div>

      <!-- Box 4: Tỷ lệ tương tác (Blue) -->
      <div style="background: linear-gradient(180deg, rgba(59,130,246,0.03) 0%, rgba(59,130,246,0.06) 100%), var(--surface); border: 1px solid rgba(59,130,246,0.25); border-radius: 16px; padding: 16px 20px; box-shadow: 0 2px 10px rgba(59,130,246,0.04); position: relative; overflow: hidden; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(59,130,246,0.12)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 10px rgba(59,130,246,0.04)'">
        <div style="position: absolute; right: 10px; bottom: 10px; opacity: 0.05; color: #3b82f6; transform: scale(4) rotate(-15deg); pointer-events: none; z-index: 0;">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
        </div>
        <div style="position: relative; z-index: 2;">
          <span style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 850; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px;">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            TỶ LỆ TƯƠNG TÁC
          </span>
          <div style="font-size: 28px; font-weight: 900; color: #3b82f6; display: flex; align-items: baseline; gap: 6px;">
            ${rateNotes}%
          </div>
        </div>
      </div>
    `;
  }


  const totalPages = Math.ceil(totalFilteredCount / pendingNotesPerPage) || 1;
  if (pendingNotesCurrentPage > totalPages) pendingNotesCurrentPage = totalPages;
  if (pendingNotesCurrentPage < 1) pendingNotesCurrentPage = 1;

  const startIndex = (pendingNotesCurrentPage - 1) * pendingNotesPerPage;
  const paginatedItems = filtered.slice(startIndex, startIndex + pendingNotesPerPage);

  const paginationContainer = document.getElementById('pendingNotesPaginationContainer');
  if (totalFilteredCount === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state-text">Không tìm thấy hồ sơ phù hợp.</td></tr>`;
    if (paginationContainer) paginationContainer.innerHTML = '';
    return;
  }

  if (paginationContainer) {
    
    // Render Dropdown States
    const lblStatus = document.getElementById('lblPendingNotesStatusDropdownSelected');
    const menuStatus = document.getElementById('menuPendingNotesStatusDropdown');
    if (lblStatus && menuStatus) {
      const isAll = activePendingNotesStatusFilter.includes('all');
      lblStatus.innerHTML = isAll ? `Tất cả trạng thái (${baseFiltered.length})` : `${activePendingNotesStatusFilter.length} trạng thái (${filtered.length})`;
      
      let html = `<div class="custom-dropdown-item ${isAll ? 'selected' : ''}" onclick="selectPendingNotesStatusFilter(event, 'all')" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 8px; cursor: pointer; transition: all 0.15s ease; margin-bottom: 2px; ${isAll ? 'background: rgba(216,180,109,0.12); color: var(--primary); font-weight: 800;' : 'color: var(--text-main); font-weight: 600;'}"><span style="font-size: 12.5px;">Tất cả trạng thái</span>${isAll ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}</div>`;
      
      allowedStatuses.forEach(k => {
        const isSel = activePendingNotesStatusFilter.includes(k);
        const config = PENDING_STATUS_MAP[k] || { label: k };
        html += `<div class="custom-dropdown-item ${isSel ? 'selected' : ''}" onclick="selectPendingNotesStatusFilter(event, '${k}')" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 8px; cursor: pointer; transition: all 0.15s ease; margin-bottom: 2px; ${isSel ? 'background: rgba(216,180,109,0.12); color: var(--primary); font-weight: 800;' : 'color: var(--text-main); font-weight: 600;'}"><span style="font-size: 12.5px; display: flex; align-items: center; gap: 8px;"><span style="width: 8px; height: 8px; border-radius: 50%; background: ${config.color || '#94a3b8'};"></span>${config.label}</span>${isSel ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}</div>`;
      });
      menuStatus.innerHTML = html;
    }

    const lblGdv = document.getElementById('lblPendingNotesGdvDropdownSelected');
    const menuGdv = document.getElementById('menuPendingNotesGdvDropdown');
    if (lblGdv && menuGdv) {
      lblGdv.innerHTML = activePendingNotesGdvFilter === 'all' ? 'Tất cả GĐV team' : activePendingNotesGdvFilter;
      
      let html = `<div class="custom-dropdown-item ${activePendingNotesGdvFilter === 'all' ? 'selected' : ''}" onclick="selectPendingNotesGdvFilter('all')" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 8px; cursor: pointer; transition: all 0.15s ease; margin-bottom: 2px; ${activePendingNotesGdvFilter === 'all' ? 'background: rgba(59,130,246,0.12); color: #3b82f6; font-weight: 800;' : 'color: var(--text-main); font-weight: 600;'}"><span style="font-size: 12.5px;">Tất cả GĐV team</span>${activePendingNotesGdvFilter === 'all' ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}</div>`;
      
      gdvOptions.forEach(g => {
        const isSel = activePendingNotesGdvFilter === g;
        html += `<div class="custom-dropdown-item ${isSel ? 'selected' : ''}" onclick="selectPendingNotesGdvFilter('${g}')" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 8px; cursor: pointer; transition: all 0.15s ease; margin-bottom: 2px; ${isSel ? 'background: rgba(59,130,246,0.12); color: #3b82f6; font-weight: 800;' : 'color: var(--text-main); font-weight: 600;'}"><span style="font-size: 12.5px;">${g}</span>${isSel ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}</div>`;
      });
      menuGdv.innerHTML = html;
    }

    const displayStart = totalFilteredCount > 0 ? startIndex + 1 : 0;
    const displayEnd = Math.min(startIndex + pendingNotesPerPage, totalFilteredCount);
    
    let pageBtnsHtml = '';
    const maxVisiblePages = 5;
    let startPage = Math.max(1, pendingNotesCurrentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
      pageBtnsHtml += `<button type="button" onclick="setPendingNotesPage(1)" style="min-width: 34px; height: 42px; padding: 0 6px; border-radius: 12px; font-size: 12.5px; font-weight: 700; background: var(--bg-soft); border: 1px solid var(--border); color: var(--text-main); cursor: pointer;">1</button>`;
      if (startPage > 2) pageBtnsHtml += `<span style="color: var(--text-muted); font-size: 14px; font-weight: 700; padding: 0 4px;">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
      if (i === pendingNotesCurrentPage) {
        pageBtnsHtml += `<button type="button" style="min-width: 34px; height: 42px; padding: 0 6px; border-radius: 12px; font-size: 12.5px; font-weight: 850; background: var(--primary); border: 1px solid var(--primary); color: #111; box-shadow: 0 4px 10px rgba(216,180,109,0.35); cursor: default;">${i}</button>`;
      } else {
        pageBtnsHtml += `<button type="button" onclick="setPendingNotesPage(${i})" style="min-width: 34px; height: 42px; padding: 0 6px; border-radius: 12px; font-size: 12.5px; font-weight: 700; background: var(--bg-soft); border: 1px solid var(--border); color: var(--text-main); cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='var(--bg-soft)'">${i}</button>`;
      }
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) pageBtnsHtml += `<span style="color: var(--text-muted); font-size: 14px; font-weight: 700; padding: 0 4px;">...</span>`;
      pageBtnsHtml += `<button type="button" onclick="setPendingNotesPage(${totalPages})" style="min-width: 34px; height: 42px; padding: 0 6px; border-radius: 12px; font-size: 12.5px; font-weight: 700; background: var(--bg-soft); border: 1px solid var(--border); color: var(--text-main); cursor: pointer;">${totalPages}</button>`;
    }

    paginationContainer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; flex-wrap: nowrap; margin-left: auto; white-space: nowrap;">
        <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-soft); font-weight: 600;">
          <div class="custom-dropdown-container" style="position: relative; display: inline-block;">
            <select onchange="setPendingNotesPerPage(this.value)" style="height: 42px; background: var(--bg-soft); border: 1px solid var(--border); color: var(--text-main); font-size: 12.5px; font-weight: 750; padding: 0 28px 0 12px; border-radius: 12px; cursor: pointer; outline: none; -webkit-appearance: none; appearance: none;">
              <option value="10" ${pendingNotesPerPage === 10 ? 'selected' : ''}>10 / trang</option>
              <option value="20" ${pendingNotesPerPage === 20 ? 'selected' : ''}>20 / trang</option>
              <option value="50" ${pendingNotesPerPage === 50 ? 'selected' : ''}>50 / trang</option>
              <option value="100" ${pendingNotesPerPage === 100 ? 'selected' : ''}>100 / trang</option>
            </select>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--text-muted); position: absolute; right: 12px; top: 15px; pointer-events: none;"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
        </div>

        <div style="font-size: 12.5px; color: var(--text-soft); font-weight: 700;">
          <strong style="color: var(--primary);">${displayStart}-${displayEnd}</strong> / <strong style="color: var(--text-main);">${totalFilteredCount}</strong>
        </div>

        <div style="display: flex; align-items: center; gap: 2px;">
          <button type="button" onclick="setPendingNotesPage(${pendingNotesCurrentPage - 1})" ${pendingNotesCurrentPage <= 1 ? 'disabled' : ''} style="width: 34px; height: 42px; border-radius: 12px; font-size: 12.5px; font-weight: 700; background: var(--bg-soft); border: 1px solid var(--border); color: var(--text-main); display: grid; place-items: center; cursor: pointer; opacity: ${pendingNotesCurrentPage <= 1 ? '0.4' : '1'}; pointer-events: ${pendingNotesCurrentPage <= 1 ? 'none' : 'auto'};" title="Trang trước">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          
          ${pageBtnsHtml}

          <button type="button" onclick="setPendingNotesPage(${pendingNotesCurrentPage + 1})" ${pendingNotesCurrentPage >= totalPages ? 'disabled' : ''} style="width: 34px; height: 42px; border-radius: 12px; font-size: 12.5px; font-weight: 700; background: var(--bg-soft); border: 1px solid var(--border); color: var(--text-main); display: grid; place-items: center; cursor: pointer; opacity: ${pendingNotesCurrentPage >= totalPages ? '0.4' : '1'}; pointer-events: ${pendingNotesCurrentPage >= totalPages ? 'none' : 'auto'};" title="Trang sau">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
      </div>
    `;
  }


  tbody.innerHTML = paginatedItems.map((c, idx) => {
    const index = startIndex + idx;
    const identifier = (c.bienSo || c.soHoSoBoiThuong || c.id || '').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
    const noteData = cachedPendingNotesPayload[identifier] || {};
    const history = noteData.history || [];
    const latestNote = history.length > 0 ? history[history.length - 1] : null;

    const rawStatus = String(c.trangThai || 'moi').toLowerCase();
    const sttObj = PENDING_STATUS_MAP[rawStatus] || { label: c.trangThai || 'Mới', bg: 'rgba(148,163,184,0.14)', color: '#64748b', border: 'rgba(148,163,184,0.35)' };

    return `
      <tr class="table-row">
        <td style="text-align: center; font-weight: 700; color: var(--text-soft); font-size: 12px;">
          ${(index + 1).toString().padStart(2, '0')}
        </td>
        <td>
          <span style="display: inline-flex; align-items: center; justify-content: center; font-size: 10.5px; padding: 4px 10px; border-radius: 20px; font-weight: 800; background: ${sttObj.bg}; color: ${sttObj.color}; border: 1px solid ${sttObj.border}; white-space: nowrap;">
            ${sttObj.label}
          </span>
        </td>
        <td>
          <div style="font-size: 13.5px; font-weight: 850; color: var(--text-main); letter-spacing: 0.02em;">${escapeHtmlOutput(c.bienSo || '—')}</div>
          <div style="font-size: 11px; color: var(--primary); font-family: monospace; font-weight: 600; margin-top: 4px; display: inline-flex; align-items: center; gap: 4px; background: rgba(59,130,246,0.06); padding: 2px 6px; border-radius: 4px;">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>
            ${escapeHtmlOutput(c.soHoSoBoiThuong || '—')}
          </div>
        </td>
        
        <td style="width: 180px; vertical-align: middle;">
          <strong style="color: var(--text-main); font-size: 13px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeAttributeData(extractClaimOwnerName(c))}">${escapeHtmlOutput(extractClaimOwnerName(c))}</strong>
        </td>
        <td style="width: 190px;">
          <strong style="color: var(--text-main); font-size: 13px; display: block; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeAttributeData((c.hangXe || '') + ' ' + (c.hieuXe || ''))}">${escapeHtmlOutput(c.hangXe || '—')} ${escapeHtmlOutput(c.hieuXe || '')}</strong>
          <span style="font-size: 11.5px; color: var(--text-soft); display: block; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeAttributeData(c.donViCapDon || '')}">${escapeHtmlOutput(c.donViCapDon || '—')}</span>
          <div style="margin-top: 4px; display: flex; gap: 4px; flex-wrap: wrap;">
            ${c.vcx ? `<span style="font-size: 10px; background: rgba(59,130,246,0.1); color: #3b82f6; border: 1px solid rgba(59,130,246,0.25); padding: 1px 5px; border-radius: 4px; font-weight: 750;">VCX</span>` : ''}
            ${c.tnds ? `<span style="font-size: 10px; background: rgba(168,85,247,0.1); color: #a855f7; border: 1px solid rgba(168,85,247,0.25); padding: 1px 5px; border-radius: 4px; font-weight: 750;">TNDS</span>` : ''}
            ${(function(){
              if (!c.tnds || !c.loaiTonThat) return '';
              const text = c.loaiTonThat.toLowerCase();
              let tags = [];
              if (text.includes('con nguoi') || text.includes('con người') || text.includes('nguoi')) {
                tags.push(`<span style="font-size: 10px; background: rgba(244,63,94,0.1); color: #f43f5e; border: 1px solid rgba(244,63,94,0.25); padding: 1px 5px; border-radius: 4px; font-weight: 750;">Con người</span>`);
              }
              if (text.includes('tai san') || text.includes('tài sản') || text.includes('xe') || text.includes('hang hoa')) {
                tags.push(`<span style="font-size: 10px; background: rgba(16,185,129,0.1); color: #10b981; border: 1px solid rgba(16,185,129,0.25); padding: 1px 5px; border-radius: 4px; font-weight: 750;">Tài sản</span>`);
              }
              return tags.join('');
            })()}
          </div>
        </td>
        <td>
          <div style="font-size: 12.5px; color: var(--text-main); font-weight: 600; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; max-width: 280px;">
            ${escapeHtmlOutput(c.moTaTonThat || c.nguyenNhan || '—')}
          </div>
        </td>
        <td style="font-size: 12.5px; font-weight: 750; color: var(--text-main);">
          ${escapeHtmlOutput(c.gdvHo || c.canBoXuLy || '—')}
        </td>
        <td>
          <div style="display: flex; gap: 12px; align-items: center; justify-content: space-between; background: var(--bg-soft); padding: 10px 14px; border-radius: 12px; border: 1px solid var(--border-subtle);">
            <div style="flex-grow: 1; min-width: 0;">
              ${latestNote ? `
                <div style="font-size: 12px; color: var(--text-main); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 4px; font-weight: 500;">
                  ${escapeHtmlOutput(latestNote.content)}
                </div>
                <div style="font-size: 10px; color: var(--text-muted); font-weight: 700; display: flex; align-items: center; gap: 6px;">
                  <span style="color: var(--primary);">${escapeHtmlOutput(latestNote.author)}</span>
                  <span style="display: inline-block; width: 3px; height: 3px; border-radius: 50%; background: var(--text-muted);"></span>
                  <span>${new Date(latestNote.timestamp).toLocaleString('vi-VN')}</span>
                </div>
              ` : `<div style="font-size: 12px; color: var(--text-muted); font-style: italic; white-space: nowrap;">Chưa có ghi chú...</div>`}
            </div>
            <div style="flex-shrink: 0;"><button class="btn-premium btn-secondary" onclick="openPendingNoteModal('${c.id}', '${identifier}')" style="padding: 0 14px; height: 32px; font-size: 11px; border-radius: 8px; font-weight: 750; width: auto !important;">
              ${latestNote ? 'Cập nhật' : 'Thêm ghi chú'}
            </button></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}


function openPendingNoteModal(claimId, identifier) {
  activeNoteClaimId = claimId;
  activeNotePlateOrCode = identifier;
  const c = cachedPendingClaimsPayload[claimId] || {};

  document.getElementById('lblPendingNoteTitle').textContent = `${c.bienSo || '—'} (${c.soHoSoBoiThuong || '—'})`;
  document.getElementById('txtPendingNoteInput').value = '';
  document.getElementById('btnSavePendingNote').disabled = false;

  const historyContainer = document.getElementById('pendingNoteHistoryContainer');
  const noteData = cachedPendingNotesPayload[identifier] || {};
  const history = noteData.history || [];

  if (history.length === 0) {
    historyContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-style: italic; padding: 10px 0; font-size: 12.5px;">Chưa có lịch sử ghi chú.</div>`;
  } else {
    historyContainer.innerHTML = history.slice().reverse().map(item => `
      <div style="background: var(--bg-soft); border: 1px solid var(--border-subtle); padding: 10px 14px; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 11px; color: var(--text-muted);">
          <strong style="color: var(--text-main);">${escapeHtmlOutput(item.author)}</strong>
          <span>${new Date(item.timestamp).toLocaleString('vi-VN')}</span>
        </div>
        <div style="font-size: 13px; color: var(--text-main); white-space: pre-wrap; line-height: 1.4;">${escapeHtmlOutput(item.content)}</div>
      </div>
    `).join('');
  }

  const modal = document.getElementById('pendingNoteModalOverlay');
  if (modal) {
    modal.style.display = 'grid';
    modal.setAttribute('aria-hidden', 'false');
  }
}


function closePendingNoteModal() {
  activeNoteClaimId = null;
  activeNotePlateOrCode = null;
  const modal = document.getElementById('pendingNoteModalOverlay');
  if (modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  }
}


async function savePendingNote() {
  if (!activeNotePlateOrCode) return;
  const content = document.getElementById('txtPendingNoteInput').value.trim();
  if (!content) {
    triggerToast('Vui lòng nhập nội dung ghi chú', 'warning');
    return;
  }

  const btn = document.getElementById('btnSavePendingNote');
  btn.disabled = true;

  try {
    const author = (activeUserProfile && activeUserProfile.displayName) ? activeUserProfile.displayName : (firebase.auth().currentUser?.email || 'Unknown');
    const newNote = {
      content: content,
      author: author,
      timestamp: Date.now()
    };

    const nodeRef = dbNodeInstance.ref(`pending_notes/${activeNotePlateOrCode}`);
    const snapshot = await nodeRef.once('value');
    let data = snapshot.val() || { history: [] };
    if (!data.history) data.history = [];
    data.history.push(newNote);

    await nodeRef.set(data);
    triggerToast('Đã lưu ghi chú thành công', 'success');
    closePendingNoteModal();
    // executeUIRenderPendingNotesTable will be called automatically by on('value') listener
  } catch (err) {
    console.error(err);
    triggerToast('Lỗi lưu ghi chú: ' + err.message, 'error');
    btn.disabled = false;
  }
}
