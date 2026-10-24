// ==========================================================================
// TRANG CHỦ (activeDashboardTab === 'home') – css/home-page.css
// Bố cục: lời chào + tác vụ nhanh → dải số liệu (bấm để mở trang) → thẻ phân hệ chia nhóm
// giống hệt sidebar. Một tông màu (vàng) cho mọi phân hệ, không còn mỗi thẻ một màu.
// Quyền hiển thị nhận từ workspace.js (giữ nguyên logic phân quyền cũ).
// ==========================================================================
(function () {
  const ICON = {
    list:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    create:'<path d="M12 5v14M5 12h14"/>',
    pending:'<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>',
    tracker:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    cancel:'<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6m0-6 6 6"/>',
    report:'<path d="M4 20h16"/><path d="M7 16v-5M12 16V6M17 16v-8"/>',
    payment:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
    transfer:'<path d="M4 7h13l-3-3M20 17H7l3 3"/>',
    field:'<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    forms:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    system:'<path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6Z"/><path d="m9 12 2 2 4-4"/>',
    arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>'
  };
  const svg = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ''}</svg>`;
  const esc = value => (typeof escapeHtmlOutput === 'function' ? escapeHtmlOutput(value) : String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const fmt = n => Number(n || 0).toLocaleString('vi-VN');

  function greeting(now) {
    const h = now.getHours();
    return h < 11 ? 'Chào buổi sáng' : h < 14 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  }

  function todayLabel(now) {
    const days = ['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
    return `${days[now.getDay()]}, ${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
  }

  function moduleCard(m) {
    return `<button type="button" class="hp-module" onclick="switchWorkspaceTab('${m.tab}')">
      <span class="hp-module-top">
        <span class="hp-module-icon">${svg(m.icon)}</span>
        ${m.badge ? `<span class="hp-module-badge">${m.badge}</span>` : ''}
      </span>
      <span class="hp-module-title">${m.title}</span>
      <span class="hp-module-desc">${m.desc}</span>
      <span class="hp-module-foot">
        <span class="hp-module-meta">${m.meta}</span>
        <span class="hp-module-go">${m.cta || 'Mở'} ${svg('arrow')}</span>
      </span>
    </button>`;
  }

  function groupMarkup(g) {
    return `<section class="hp-group" aria-label="${g.label}" style="--hp-group-cols:${g.items.length}">
      <h2 class="hp-group-title">${g.label}<span>${g.items.length} phân hệ</span></h2>
      <div class="hp-grid">${g.items.map(moduleCard).join('')}</div>
    </section>`;
  }

  window.renderHomeDashboardPage = function (o) {
    const now = new Date();
    const name = (typeof activeUserProfile !== 'undefined' && activeUserProfile && (activeUserProfile.displayName || activeUserProfile.email)) || 'bạn';

    const kpis = [
      o.showList && { tab:'list', icon:'list', label:'Hồ sơ giám định', value:o.totalCases, hint:'Ca xe trực tuyến' },
      o.showPending && { tab:'pending', icon:'pending', label:'Hồ sơ bồi thường tồn', value:o.totalPendingClaims, hint:'Đang theo dõi' },
      o.showAccountingView && { tab:'accounting_transfer', icon:'transfer', label:'Đợt bàn giao', value:o.totalTransfers, hint:'Chuyển kế toán' },
      o.showFieldReimb && { tab:'field_reimbursements', icon:'field', label:'Phiếu hoàn ứng', value:o.totalReimbs, hint:'Chi phí hiện trường' }
    ].filter(Boolean);

    const groups = [
      { label:'Quản lý hồ sơ', items:[
        o.showList && { tab:'list', icon:'list', title:'Hồ sơ giám định', desc:'Danh sách ca xe trực tuyến, cấp link chụp ảnh hiện trạng cho Garage và đối chiếu phụ tùng.', meta:`${fmt(o.totalCases)} hồ sơ`, cta:'Mở danh sách' },
        o.showCreate && { tab:'create', icon:'create', title:'Khởi tạo ca giám định', desc:'Nhập thông tin xe, chỉ định Garage, lập danh mục cần chụp và cấp link nhanh.', meta:'Cấp link trong 30 giây', cta:'Tạo mới' },
        o.showPending && { tab:'pending', icon:'pending', title:'Hồ sơ bồi thường', desc:'Quản lý hồ sơ tồn, phân công GĐV, phạm vi VCX / TNDS và cập nhật dữ liệu từ Excel.', meta:`${fmt(o.totalPendingClaims)} hồ sơ tồn`, cta:'Mở danh sách' },
        o.showPending && { tab:'pending_notes_tracker', icon:'tracker', title:'Tiến độ hồ sơ tồn', desc:'Theo dõi tiến độ xử lý và ghi chú độc lập cho từng hồ sơ tồn.', meta:'Ghi chú & nhắc việc', cta:'Theo dõi' },
        o.showCancellation && { tab:'claim_cancellation', icon:'cancel', title:'Đề xuất hủy hồ sơ', desc:'Lập phiếu đề xuất hủy, quản lý lý do không bồi thường và phê duyệt.', meta:'Kiểm soát & phê duyệt', cta:'Mở', badge:'Mới' },
        o.showReport && { tab:'gdv_report', icon:'report', title:'Báo cáo & thống kê GĐV', desc:'Sản lượng GĐV theo tuần/tháng, tồn quá hạn, doanh số và xuất báo cáo Excel.', meta:'Tuần · Tháng · KPI', cta:'Xem báo cáo' }
      ]},
      { label:'Kế toán', items:[
        o.showAccountingReview && { tab:'accounting_claims', icon:'payment', title:'Hồ sơ thanh toán', desc:'Tra cứu, đối soát hồ sơ bồi thường đã nhận và phê duyệt tờ trình PASC.', meta:'Xét duyệt & đối soát', cta:'Mở' },
        o.showAccountingView && { tab:'accounting_transfer', icon:'transfer', title:'Chuyển hồ sơ kế toán', desc:'Lập đợt bàn giao chứng từ gốc, đối chiếu danh mục và xuất biên bản giao nhận.', meta:`${fmt(o.totalTransfers)} đợt bàn giao`, cta:'Mở' }
      ]},
      { label:'Nghiệp vụ', items:[
        o.showFieldReimb && { tab:'field_reimbursements', icon:'field', title:'Chi phí hiện trường', desc:'Đề xuất hoàn ứng công tác phí, xăng xe, vé cầu đường, lưu trú và theo dõi xét duyệt.', meta:`${fmt(o.totalReimbs)} phiếu hoàn ứng`, cta:'Mở' },
        { tab:'shared_forms', icon:'forms', title:'Biểu mẫu dùng chung', desc:'Xem, tải lên và in các biểu mẫu, tài liệu dùng chung từ Google Drive.', meta:'Thư viện tài liệu', cta:'Mở thư viện' }
      ]},
      { label:'Hệ thống', items:[
        o.showAdmin && { tab:'users', icon:'system', title:'Quản trị hệ thống', desc:'Tài khoản, phân quyền, cấu hình Gemini, Cloudinary, hệ số KPI và nhật ký hoạt động.', meta:'Cấu hình & bảo mật', cta:'Cấu hình' }
      ]}
    ].map(g => ({ ...g, items: g.items.filter(Boolean) })).filter(g => g.items.length);

    return `
      <section class="hp-page" aria-label="Trang chủ">
        <header class="hp-head">
          <div class="hp-hello">
            <span class="hp-eyebrow">${todayLabel(now)} · Tasco DLK – Xe cơ giới</span>
            <h1>${greeting(now)}, <span>${esc(name)}</span></h1>
            <p>Hệ sinh thái giám định – bồi thường số: kết nối thời gian thực giữa Giám định viên, Garage và Kế toán.</p>
          </div>
          <div class="hp-actions">
            <button type="button" class="hp-btn" onclick="switchWorkspaceTab('shared_forms')">${svg('forms')}<span>Biểu mẫu dùng chung</span></button>
            ${o.showCreate ? `<button type="button" class="hp-btn hp-btn--primary" onclick="switchWorkspaceTab('create')">${svg('create')}<span>Tạo ca giám định</span></button>` : ''}
          </div>
        </header>

        ${kpis.length ? `
        <div class="hp-kpis" style="--hp-kpi-cols:${kpis.length}">
          ${kpis.map(k => `<button type="button" class="hp-kpi" onclick="switchWorkspaceTab('${k.tab}')">
            <span class="hp-kpi-label">${svg(k.icon)}${k.label}</span>
            <strong>${fmt(k.value)}</strong>
            <span class="hp-kpi-hint">${k.hint} ${svg('arrow')}</span>
          </button>`).join('')}
        </div>` : ''}

        ${groups.slice(0, 1).map(groupMarkup).join('')}
        ${groups.length > 1 ? `
        <!-- Các nhóm ít phân hệ (Kế toán / Nghiệp vụ / Hệ thống) nằm chung một hàng, độ rộng theo số thẻ -->
        <div class="hp-groups-row" style="--hp-row-cols:${groups.slice(1).map(g => g.items.length + 'fr').join(' ')}">
          ${groups.slice(1).map(groupMarkup).join('')}
        </div>` : ''}
      </section>`;
  };
})();
