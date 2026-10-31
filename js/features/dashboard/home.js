// ==========================================================================
// TRANG CHỦ (activeDashboardTab === 'home') – css/home-page.css – tối ưu cho desktop.
// 1) Băng hero tối: lời chào + tác vụ nhanh + số liệu chính (bấm để mở trang).
// 2) Hai cột: trái = lối vào phân hệ (nhóm như sidebar); phải = dữ liệu thật:
//    phân bổ hồ sơ tồn theo trạng thái (bấm để lọc).
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
    rescue:'<path d="M3 16V8h11v8M14 11h4l3 3v2h-7M3 16h18"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>',
    forms:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    system:'<path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6Z"/><path d="m9 12 2 2 4-4"/>',
    arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
    chevron:'<path d="m9 6 6 6-6 6"/>'
  };
  const svg = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ''}</svg>`;
  const esc = value => (typeof escapeHtmlOutput === 'function' ? escapeHtmlOutput(value) : String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const fmt = n => Number(n || 0).toLocaleString('vi-VN');
  const jsArg = value => JSON.stringify(String(value)).replace(/"/g, '&quot;');

  function greeting(now) {
    const h = now.getHours();
    return h < 11 ? 'Chào buổi sáng' : h < 14 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  }
  function todayLabel(now) {
    const days = ['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
    return `${days[now.getDay()]} · ${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
  }

  // ---- Dữ liệu cho cột phải ----
  function pendingStats() {
    const claims = Object.entries((typeof cachedPendingClaimsPayload !== 'undefined' && cachedPendingClaimsPayload) || {});
    const map = (typeof PENDING_STATUS_MAP !== 'undefined' && PENDING_STATUS_MAP) || {};
    const counts = {};
    for (const [, c] of claims) { const k = map[c.trangThai] ? c.trangThai : 'moi'; counts[k] = (counts[k] || 0) + 1; }
    const total = claims.length;
    const rows = Object.keys(map).filter(k => counts[k]).map(k => ({ key: k, label: map[k].label, color: map[k].color, count: counts[k] }))
      .sort((a, b) => b.count - a.count);
    return { total, rows, map };
  }

  function statusPanel(st) {
    if (!st.total) return `<section class="hp-panel"><header class="hp-panel-head"><div><span class="hp-kicker">Hồ sơ bồi thường</span><h3>Phân bổ theo trạng thái</h3></div></header><p class="hp-empty">Chưa có dữ liệu hồ sơ tồn.</p></section>`;
    const top = st.rows.slice(0, 7), rest = st.rows.slice(7).reduce((s, r) => s + r.count, 0);
    const bar = st.rows.map(r => `<i style="flex:${r.count};background:${r.color}" title="${esc(r.label)}: ${fmt(r.count)}"></i>`).join('');
    return `<section class="hp-panel">
      <header class="hp-panel-head">
        <div><span class="hp-kicker">Hồ sơ bồi thường</span><h3>Phân bổ theo trạng thái</h3></div>
        <button type="button" class="hp-link" onclick="switchWorkspaceTab('pending')">Xem tất cả ${svg('chevron')}</button>
      </header>
      <div class="hp-total"><strong>${fmt(st.total)}</strong><span>hồ sơ đang theo dõi</span></div>
      <div class="hp-stack" role="img" aria-label="Tỷ lệ hồ sơ theo trạng thái">${bar}</div>
      <ul class="hp-status-list">
        ${top.map(r => {
          const pct = Math.round(r.count * 1000 / st.total) / 10;
          return `<li><button type="button" onclick="openHomeStatusFilter(${jsArg(r.key)})" title="Lọc hồ sơ: ${esc(r.label)}">
            <span class="hp-dot" style="background:${r.color}"></span>
            <span class="hp-status-name">${esc(r.label)}</span>
            <span class="hp-status-meter"><i style="width:${Math.max(pct, 2)}%;background:${r.color}"></i></span>
            <span class="hp-status-count">${fmt(r.count)}</span>
            <span class="hp-status-pct">${pct.toLocaleString('vi-VN')}%</span>
          </button></li>`;
        }).join('')}
        ${rest ? `<li class="hp-status-rest"><span>Trạng thái khác</span><span>${fmt(rest)}</span></li>` : ''}
      </ul>
    </section>`;
  }

  // Bấm một trạng thái → mở trang Hồ sơ bồi thường đã lọc sẵn trạng thái đó.
  window.openHomeStatusFilter = function (key) {
    try { activePendingStatusFilter = [key]; pendingClaimsCurrentPage = 1; } catch (_) {}
    switchWorkspaceTab('pending');
  };


  function moduleTile(m) {
    return `<button type="button" class="hp-tile" onclick="switchWorkspaceTab('${m.tab}')">
      <span class="hp-tile-icon">${svg(m.icon)}</span>
      <span class="hp-tile-copy">
        <span class="hp-tile-title">${m.title}${m.badge ? `<em>${m.badge}</em>` : ''}</span>
        <span class="hp-tile-desc">${m.desc}</span>
      </span>
      <span class="hp-tile-go">${svg('arrow')}</span>
    </button>`;
  }


  // ---- Số liệu KPI cho băng hero: Admin xem KPI cả Zone; GĐV xem số liệu & KPI của riêng mình ----
  // Dùng đúng KpiZoneCalc của trang "Báo cáo KPI bồi thường Zone" nên hai nơi luôn cùng một con số.
  function openKpiZonePage() {
    try { activeGdvReportView = 'kpi_zone'; } catch (_) {}
    switchWorkspaceTab('gdv_report');
  }
  window.openHomeKpiZone = openKpiZonePage;

  function heroKpiData(isAdmin) {
    try {
      if (typeof KpiZoneCalc === 'undefined' || typeof cachedPendingClaimsPayload === 'undefined') return null;
      const K = KpiZoneCalc;
      const prep = K.fromClaims(cachedPendingClaimsPayload || {}, (typeof PENDING_STATUS_MAP !== 'undefined' && PENDING_STATUS_MAP) || {});
      if (!prep.records.length || !prep.asOf) return null;
      const p = K.partsOf(prep.asOf), period = 'T' + p.m + '.' + p.y;
      const base = {year: p.y, month: p.m, asOf: prep.asOf};
      if (isAdmin) {
        let zoneMap = {};
        try { zoneMap = JSON.parse(localStorage.getItem('kpiZoneBtMap:v1') || '{}') || {}; } catch (_) { zoneMap = {}; }
        const c = K.computeMonth(prep.records, {...base, gdvs: K.DEFAULT_GDVS, zoneMap});
        const row = key => c.kpis.rows.find(r => r.key === key) || {};
        const state = r => (r.pass === null || r.pass === undefined ? '' : r.pass ? 'ok' : 'miss');
        return {mode: 'zone', period, tiles: [
          {label: 'KPI Zone ' + period, text: K.fmtPct(c.kpis.uncapped, 2), sub: 'Điểm ' + K.fmtScore(c.kpis.uncapped) + ' · có giới hạn ' + K.fmtPct(c.kpis.capped, 1)},
          {label: 'Tỷ lệ hoàn thành', text: K.fmtPct(row('completion').result, 2), sub: 'Mục tiêu ≥ 90% · ' + K.fmtInt(c.totals.approved) + '/' + K.fmtInt(c.totals.issued) + ' hồ sơ', state: state(row('completion'))},
          {label: 'CP bình quân', text: K.fmtInt(row('cost').result), sub: 'Mục tiêu ≤ 3.500.000 đ', state: state(row('cost'))},
          {label: 'Tỉ lệ tồn', text: K.fmtPct(row('backlog').result, 2), sub: 'Mục tiêu ≤ 10% · tồn ' + K.fmtInt(c.totals.ton) + ' hồ sơ', state: state(row('backlog'))}
        ]};
      }
      const profile = (typeof activeUserProfile !== 'undefined' && activeUserProfile) || {};
      const me = K.listGdvs(prep.records).find(g => [profile.displayName, profile.email].some(v => v && K.nameKey(v) === K.nameKey(g.name)));
      if (!me) return null;
      const c = K.computeMonth(prep.records, {...base, gdvs: [me.name], zoneMap: {}});
      const done = c.kpis.rows.find(r => r.key === 'completion') || {};
      return {mode: 'gdv', period, tiles: [
        {label: 'Hồ sơ phát sinh ' + period, text: K.fmtInt(c.totals.issued), sub: 'Mở trong tháng'},
        {label: 'Đã duyệt', text: K.fmtInt(c.totals.approved), sub: 'Tỷ lệ hoàn thành ' + K.fmtPct(done.result, 1)},
        {label: 'Chưa duyệt', text: K.fmtInt(c.unapproved.length), sub: 'Mở trong tháng, chờ duyệt', state: c.unapproved.length ? 'miss' : 'ok'},
        {label: 'KPI của bạn', text: K.fmtPct(c.kpis.uncapped, 2), sub: 'Điểm ' + K.fmtScore(c.kpis.uncapped) + ' · ' + esc(me.name)}
      ]};
    } catch (error) {
      console.warn('Không tính được KPI trang chủ:', error);
      return null;
    }
  }

  window.renderHomeDashboardPage = function (o) {
    const now = new Date();
    const name = (typeof activeUserProfile !== 'undefined' && activeUserProfile && (activeUserProfile.displayName || activeUserProfile.email)) || 'bạn';
    const st = o.showPending ? pendingStats() : null;

    const isAdminUser = typeof activeUserProfile !== 'undefined' && activeUserProfile && String(activeUserProfile.role || '').trim().toLowerCase() === 'admin';
    const kpiData = o.showPending || isAdminUser ? heroKpiData(isAdminUser) : null;
    const kpis = kpiData ? [] : [
      o.showPending && { tab:'pending', label:'Hồ sơ bồi thường tồn', value:o.totalPendingClaims },
      o.showList && { tab:'list', label:'Ca giám định trực tuyến', value:o.totalCases },
      o.showAccountingView && { tab:'accounting_transfer', label:'Đợt bàn giao kế toán', value:o.totalTransfers },
      o.showFieldReimb && { tab:'field_reimbursements', label:'Phiếu hoàn ứng hiện trường', value:o.totalReimbs }
    ].filter(Boolean);

    const groups = [
      { label:'Quản lý hồ sơ', items:[
        o.showList && { tab:'list', icon:'list', title:'Hồ sơ giám định', desc:`${fmt(o.totalCases)} ca · link chụp ảnh cho Garage` },
        o.showPending && { tab:'pending', icon:'pending', title:'Hồ sơ bồi thường', desc:`${fmt(o.totalPendingClaims)} hồ sơ tồn · nhập Excel` },
        o.showPending && { tab:'pending_notes_tracker', icon:'tracker', title:'Tiến độ hồ sơ tồn', desc:'Ghi chú & nhắc việc theo hồ sơ' },
        o.showCancellation && { tab:'claim_cancellation', icon:'cancel', title:'Đề xuất hủy hồ sơ', desc:'Lập phiếu & phê duyệt hủy', badge:'Mới' },
        o.showReport && { tab:'gdv_report', icon:'report', title:'Báo cáo & thống kê GĐV', desc:'Tuần · tháng · KPI bồi thường · Excel' },
        o.showCreate && { tab:'create', icon:'create', title:'Khởi tạo ca giám định', desc:'Cấp link cho Garage trong 30 giây' }
      ]},
      { label:'Kế toán & nghiệp vụ', items:[
        o.showAccountingReview && { tab:'accounting_claims', icon:'payment', title:'Hồ sơ thanh toán', desc:'Đối soát & duyệt tờ trình PASC' },
        o.showAccountingView && { tab:'accounting_transfer', icon:'transfer', title:'Chuyển hồ sơ kế toán', desc:`${fmt(o.totalTransfers)} đợt bàn giao chứng từ` },
        o.showFieldReimb && { tab:'field_reimbursements', icon:'field', title:'Chi phí hiện trường', desc:`${fmt(o.totalReimbs)} phiếu hoàn ứng` },
        { tab:'rescue_cost', icon:'rescue', title:'Chi phí cứu hộ', desc:'Tính kéo xe, cẩu xe & cấp phê duyệt', badge:'Mới' },
        { tab:'shared_forms', icon:'forms', title:'Biểu mẫu dùng chung', desc:'Thư viện tài liệu Google Drive' },
        o.showAdmin && { tab:'users', icon:'system', title:'Quản trị hệ thống', desc:'Tài khoản, phân quyền, cấu hình' }
      ]}
    ].map(g => ({ ...g, items: g.items.filter(Boolean) })).filter(g => g.items.length);

    return `
      <section class="hp-page${st ? '' : ' hp-page--single'}" aria-label="Trang chủ">
        <header class="hp-hero">
          <div class="hp-hero-copy">
            <span class="hp-hero-date">${todayLabel(now)}</span>
            <h1>${greeting(now)},<br><span>${esc(name)}</span></h1>
            <p>Trung tâm điều hành giám định – bồi thường xe cơ giới Tasco DLK.</p>
            <div class="hp-hero-actions">
              ${o.showCreate ? `<button type="button" class="hp-btn hp-btn--gold" onclick="switchWorkspaceTab('create')">${svg('create')}<span>Tạo ca giám định</span></button>` : ''}
              ${o.showPending ? `<button type="button" class="hp-btn hp-btn--glass" onclick="switchWorkspaceTab('pending')">${svg('pending')}<span>Hồ sơ bồi thường</span></button>` : ''}
              <button type="button" class="hp-btn hp-btn--glass" onclick="switchWorkspaceTab('shared_forms')">${svg('forms')}<span>Biểu mẫu</span></button>
            </div>
          </div>
          ${kpiData ? `<div class="hp-hero-kpis hp-hero-kpis--score" style="--hp-kpis:${kpiData.tiles.length}" aria-label="${kpiData.mode === 'zone' ? 'KPI Zone' : 'KPI của bạn'}">
            ${kpiData.tiles.map((k, i) => `<button type="button" class="hp-hero-kpi${i === 0 ? ' is-lead' : ''}${k.state ? ' is-' + k.state : ''}" onclick="openHomeKpiZone()" title="Mở Báo cáo KPI bồi thường Zone">
              <span>${esc(k.label)}</span>
              <strong>${esc(k.text)}</strong>
              <em>${k.sub}</em>
            </button>`).join('')}
          </div>` : kpis.length ? `<div class="hp-hero-kpis" style="--hp-kpis:${kpis.length}">
            ${kpis.map((k, i) => `<button type="button" class="hp-hero-kpi${i === 0 ? ' is-lead' : ''}" onclick="switchWorkspaceTab('${k.tab}')">
              <span>${k.label}</span>
              <strong>${fmt(k.value)}</strong>
              <em>Mở trang ${svg('arrow')}</em>
            </button>`).join('')}
          </div>` : ''}
        </header>

        <div class="hp-main">
          <section class="hp-panel hp-panel--modules" aria-label="Phân hệ">
            <header class="hp-panel-head"><div><span class="hp-kicker">Không gian làm việc</span><h3>Phân hệ chức năng</h3></div><span class="hp-count">${groups.reduce((n, g) => n + g.items.length, 0)}</span></header>
            ${groups.map(g => `<div class="hp-subgroup">
              <div class="hp-subgroup-label">${g.label}</div>
              <div class="hp-tiles">${g.items.map(moduleTile).join('')}</div>
            </div>`).join('')}
          </section>
          ${st ? statusPanel(st) : ''}
        </div>
      </section>`;
  };

  // Vẽ lại trang chủ khi dữ liệu Firebase về sau (gom nhịp 200ms để tránh vẽ liên tục).
  let refreshTimer = 0;
  window.refreshHomeDashboard = function () {
    if (typeof activeDashboardTab === 'undefined' || activeDashboardTab !== 'home') return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => { if (activeDashboardTab === 'home' && typeof renderActiveTabContent === 'function') renderActiveTabContent(); }, 200);
  };
})();
