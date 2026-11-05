/* Danh bạ nội bộ — tra cứu liên hệ nhân sự (Firebase: contact_directory/{Mã NV}).
 * Mọi tài khoản có hồ sơ được xem/tra cứu/sao chép/gọi/gửi mail; chỉ Admin được nhập Excel, thêm, sửa, xoá (cũng được ép bằng Firebase rules).
 * Giao diện dùng đúng khuôn trang Hồ sơ bồi thường (.pending-workspace--v2) và menu dropdown premium dùng chung (pending-controls.js);
 * css/contact-directory.css chỉ bổ sung phần riêng. Logic dữ liệu thuần nằm ở contact-calc.js. */
const ContactDirectoryPage = (() => {
  const C = () => window.ContactCalc;
  const PER_PAGE = [12, 24, 48, 100];
  const SORTS = [{key: 'name', label: 'Tên A → Z'}, {key: 'unit', label: 'Phòng ban'}, {key: 'code', label: 'Mã nhân viên'}, {key: 'title', label: 'Chức danh'}];
  const XLSX_SRC = 'js/vendor/xlsx-js-style-1.2.0.bundle.js?v=20261031-kpi-4';
  const state = {q: '', nhom: 'all', phong: 'all', chucDanh: 'all', noiLamViec: 'all', donVi: 'all', quick: 'all', sort: 'name', view: window.innerWidth < 900 ? 'cards' : 'table', page: 1, per: 24};
  let host = null, records = [], loaded = false, loadError = '', listening = false, modal = null, searchTimer = 0, xlsxPromise = null, importState = null, confirmResolve = null;

  const I = {
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><circle cx="13" cy="9" r="2.4"/><path d="M8.6 15.2c.6-1.6 2.2-2.5 4.4-2.5s3.8.9 4.4 2.5"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
    sort: '<path d="M3 6h13M3 12h9M3 18h5M17 10v10m0 0-3-3m3 3 3-3"/>', rows: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>', xls: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 13l4 5M13 13l-4 5"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>', download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14M10 11v5M14 11v5"/>', check: '<path d="m5 12 5 5 9-10"/>', close: '<path d="M18 6 6 18M6 6l12 12"/>',
    left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>', grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4m0 4h.01"/>', id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6.5 16c.5-1.3 1.5-2 2.5-2s2 .7 2.5 2M14 10h4M14 14h3"/>'
  };
  const svg = (name, size = 16) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name] || ''}</svg>`;
  const esc = v => (typeof escapeHtmlOutput === 'function' ? escapeHtmlOutput(v) : String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch])));
  const attr = esc;
  const toast = (message, kind) => { if (typeof triggerToast === 'function') triggerToast(message, kind || 'success'); };
  // Quyền của trang (Quản trị hệ thống → Tài khoản → Danh bạ nội bộ): view / add / edit / delete.
  const can = action => typeof hasUserPermission === 'function' && hasUserPermission('contacts', action);
  // Người có quyền quản lý (thêm/sửa/xóa) mới thấy dữ liệu cá nhân (năm sinh, giới tính) và lịch sử cập nhật.
  const canManage = () => can('add') || can('edit') || can('delete');
  const me = () => (typeof activeUserProfile !== 'undefined' && activeUserProfile && (activeUserProfile.displayName || activeUserProfile.email)) || (window.firebase && firebase.auth().currentUser && firebase.auth().currentUser.email) || '';
  const hue = text => { let h = 0; for (const ch of String(text)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
  const avatar = (r, cls = '') => `<span class="ct-avatar ${cls}" style="--h:${hue(r.hoTen)}" aria-hidden="true">${esc(C().initials(r.hoTen))}</span>`;
  const sortName = r => { const w = C().clean(r.hoTen).split(' '); return C().plain(w[w.length - 1] + ' ' + r.hoTen); };

  // ----- Dữ liệu (realtime) -----
  function ensureListener() {
    if (listening || typeof dbNodeInstance === 'undefined' || !dbNodeInstance) return;
    listening = true;
    dbNodeInstance.ref('contact_directory').on('value', snap => {
      const value = snap.val() || {};
      records = Object.entries(value).filter(([, r]) => r && typeof r === 'object' && r.hoTen).map(([key, r]) => { const rec = {key, ...r}; rec._s = C().searchText(rec); return rec; });
      loaded = true; loadError = '';
      if (host && host.isConnected) paint();
    }, error => { listening = false; loaded = true; loadError = (error && error.message) || 'Không đọc được danh bạ'; if (host && host.isConnected) paint(); });
  }
  const missing = r => !r.sdt || !r.email;
  const quickTest = {all: () => true, missing};
  function view() {
    const scoped = records.filter(r => (state.nhom === 'all' || r.nhom === state.nhom) && (state.phong === 'all' || r.phong === state.phong) && (state.chucDanh === 'all' || r.chucDanh === state.chucDanh) &&
      (state.noiLamViec === 'all' || r.noiLamViec === state.noiLamViec) && (state.donVi === 'all' || r.donVi === state.donVi) && C().matches(r, state.q));
    const by = {
      name: (a, b) => sortName(a).localeCompare(sortName(b), 'vi'),
      unit: (a, b) => (a.phong || '').localeCompare(b.phong || '', 'vi') || sortName(a).localeCompare(sortName(b), 'vi'),
      code: (a, b) => (a.maNv || '').localeCompare(b.maNv || '', 'vi', {numeric: true}),
      title: (a, b) => (a.chucDanh || '').localeCompare(b.chucDanh || '', 'vi') || sortName(a).localeCompare(sortName(b), 'vi')
    };
    const sorter = by[state.sort] || by.name, filtered = scoped.filter(quickTest[state.quick] || quickTest.all);
    // Đang tìm kiếm: ưu tiên độ liên quan (khớp tên lên đầu), cùng mức thì giữ thứ tự sắp xếp người dùng chọn.
    if (state.q.trim()) {
      const score = new Map(filtered.map(r => [r, C().rank(r, state.q)]));
      return {scoped, list: filtered.sort((a, b) => score.get(a) - score.get(b) || sorter(a, b))};
    }
    return {scoped, list: filtered.sort(sorter)};
  }
  const distinct = (list, f) => [...new Set(list.map(r => r[f]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));

  // ----- Dropdown (khuôn .pending-filter-* + menu premium dùng chung) -----
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 4 4L19 6"></path></svg>';
  const menuId = name => 'menuCt' + name.charAt(0).toUpperCase() + name.slice(1);
  function dd(name, icon, caption, value, options, opts) {
    opts = opts || {};
    const current = options.find(o => String(o.value) === String(value)) || options[0], isAll = String(value) === String(opts.base === undefined ? 'all' : opts.base), id = menuId(name), btn = 'btnCt' + name.charAt(0).toUpperCase() + name.slice(1);
    const menu = `<div id="${id}" class="custom-dropdown-menu pending-filter-menu${opts.right ? ' pending-filter-menu--right' : ''}" style="display:none;">` + options.map(o => { const sel = String(o.value) === String(value); return `<button type="button" class="custom-dropdown-item pending-filter-option${sel ? ' selected' : ''}" role="option" aria-selected="${sel}" data-ct-opt="${attr(o.value)}"><span class="pending-filter-option__main"><span class="pending-filter-option__label">${esc(o.label)}</span></span>${o.count !== undefined ? `<span class="pending-filter-option__count">${o.count}</span>` : ''}<span class="pending-filter-option__check">${sel ? CHECK : ''}</span></button>`; }).join('') + '</div>';
    const chev = '<svg class="pending-filter-trigger__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m7 10 5 5 5-5"></path></svg>';
    if (opts.compact) return `<div class="custom-dropdown-container pending-per-page" data-ct-dd="${name}"><button type="button" id="${btn}" class="pending-filter-trigger" aria-haspopup="listbox" aria-expanded="false"><span class="pending-filter-trigger__icon" aria-hidden="true">${svg(icon, 15)}</span><span class="pending-filter-trigger__value">${esc(current.label)}</span>${chev}</button>${menu}</div>`;
    return `<div class="custom-dropdown-container pending-filter-select${isAll ? '' : ' is-filtered'}" data-ct-dd="${name}"><button type="button" id="${btn}" class="pending-filter-trigger" aria-haspopup="listbox" aria-expanded="false"><span class="pending-filter-trigger__icon" aria-hidden="true">${svg(icon, 15)}</span><span class="pending-filter-trigger__copy"><span class="pending-filter-trigger__caption">${esc(caption)}</span><span class="pending-filter-trigger__value">${esc(current.label)}</span></span>${chev}</button>${menu}</div>`;
  }
  const openDdName = () => { const el = host && host.querySelector('.custom-dropdown-container.is-open'); return el ? el.dataset.ctDd : null; };
  function closeDd() {
    if (typeof closeAllCustomDropdowns === 'function') closeAllCustomDropdowns();
    else if (host) host.querySelectorAll('.custom-dropdown-container.is-open').forEach(el => { el.classList.remove('is-open'); const m = el.querySelector('.custom-dropdown-menu'); if (m) m.style.display = 'none'; });
  }
  function registerMenus() {
    if (typeof PENDING_DROPDOWN_UI === 'undefined') return;
    Object.assign(PENDING_DROPDOWN_UI, {
      menuCtNhom: {title: 'Khối / Nhóm', subtitle: 'Khối công tác trong danh sách', search: 'Tìm khối…'},
      menuCtPhong: {title: 'Phòng ban / Chi nhánh', subtitle: 'Đơn vị công tác', search: 'Tìm phòng ban, chi nhánh…', width: 360},
      menuCtChucDanh: {title: 'Chức danh', subtitle: 'Vị trí công việc', search: 'Tìm chức danh…', width: 340},
      menuCtNoiLamViec: {title: 'Nơi làm việc', subtitle: 'Tỉnh / thành phố', search: 'Tìm nơi làm việc…'},
      menuCtSort: {title: 'Sắp xếp danh sách', subtitle: 'Thứ tự hiển thị', width: 280},
      menuCtPer: {title: 'Số liên hệ hiển thị', subtitle: 'Mỗi trang', width: 260}
    });
  }
  function openDd(name, event) { if (typeof togglePendingRegisterDropdown === 'function') togglePendingRegisterDropdown(menuId(name), event); }

  // ----- Thành phần hiển thị -----
  function metricCard(quick, tone, icon, label, value, unit, foot, footValue, progress) {
    const active = quick && state.quick === quick && quick !== 'all';
    return `<article class="claims-metric-card claims-metric-card--${tone}${active ? ' is-active' : ''}"${quick ? ` role="button" tabindex="0" data-ct-quick="${quick}" aria-pressed="${!!active}"` : ''} aria-label="${attr(label + ': ' + value)}"><div class="claims-metric-head"><span class="claims-metric-icon" aria-hidden="true">${svg(icon, 14)}</span><span class="claims-metric-label">${esc(label)}</span></div><div class="claims-metric-value-row"><strong class="claims-metric-value">${value}</strong><span class="claims-metric-unit">${unit}</span></div><div class="claims-metric-foot"><span>${foot}</span><strong>${footValue}</strong></div><div class="claims-metric-track"><i style="--metric-progress:${Math.max(0, Math.min(100, progress))}%"></i></div></article>`;
  }
  function renderSummary() {
    const total = records.length, withMail = records.filter(r => r.email).length, withPhone = records.filter(r => r.sdt).length, miss = records.filter(missing).length;
    const pct = (n, d) => d ? Math.round(n / d * 100) : 0;
    return metricCard('all', 'gold', 'users', 'Tổng liên hệ', total.toLocaleString('vi-VN'), 'người', 'Khối / nhóm', distinct(records, 'nhom').length || '—', 100) +
      metricCard('', 'blue', 'building', 'Phòng ban & chi nhánh', distinct(records, 'phong').length, 'đơn vị', 'Nơi làm việc', distinct(records, 'noiLamViec').length || '—', 100) +
      metricCard('', 'green', 'mail', 'Có email công ty', withMail.toLocaleString('vi-VN'), 'người', 'Có số điện thoại ' + withPhone.toLocaleString('vi-VN'), pct(withMail, total) + '%', pct(withMail, total)) +
      metricCard('missing', 'red', 'alert', 'Thiếu thông tin liên hệ', miss.toLocaleString('vi-VN'), 'người', 'Chưa có SĐT hoặc email', pct(miss, total) + '%', pct(miss, total));
  }
  function renderChips(scoped) {
    const units = distinct(records, 'donVi');
    const chip = (key, label, count, isActive, attrs) => `<button type="button" class="pn-chip${isActive ? ' is-active' : ''}" ${attrs}>${esc(label)}<small>${count}</small></button>`;
    return chip('all', 'Tất cả', scoped.length, state.donVi === 'all' && state.quick === 'all', 'data-ct-unit="all"') +
      units.map(u => chip(u, u, scoped.filter(r => r.donVi === u).length, state.donVi === u, `data-ct-unit="${attr(u)}"`)).join('') +
      (records.some(missing) ? chip('missing', 'Thiếu thông tin', scoped.filter(missing).length, state.quick === 'missing', 'data-ct-quick="missing"') : '');
  }
  const contactLine = (kind, r, compact) => {
    const value = kind === 'phone' ? r.sdt : r.email;
    if (!value) return `<span class="ct-none">${kind === 'phone' ? 'Chưa có SĐT' : 'Chưa có email'}</span>`;
    const href = kind === 'phone' ? 'tel:' + value : 'mailto:' + value, shown = kind === 'phone' ? C().fmtPhone(value) : value;
    return `<span class="ct-contact"><a href="${attr(href)}" class="ct-link" title="${kind === 'phone' ? 'Gọi' : 'Gửi email'} ${attr(shown)}" data-ct-stop>${svg(kind === 'phone' ? 'phone' : 'mail', 13)}<span>${esc(shown)}</span></a><button type="button" class="ct-copy" data-ct-copy="${attr(value)}" data-ct-label="${kind === 'phone' ? 'số điện thoại' : 'email'}" title="Sao chép" aria-label="Sao chép ${kind === 'phone' ? 'số điện thoại' : 'email'}">${svg('copy', 13)}</button></span>`;
  };
  function renderRow(r, index) {
    return `<tr class="ct-row" data-ct-open="${attr(r.key)}" tabindex="0"><td class="pn-c-stt">${String(index + 1).padStart(2, '0')}</td>
      <td><div class="ct-person">${avatar(r)}<div><div class="ct-name">${esc(r.hoTen)}</div><div class="pn-code">${esc(r.maNv || '—')}</div></div></div></td>
      <td><div class="ct-title">${esc(r.chucDanh || '—')}</div>${r.to ? `<div class="pn-sub" title="${attr(r.to)}">${esc(r.to)}</div>` : ''}</td>
      <td><div class="ct-org" title="${attr(r.phong)}">${esc(r.phong || '—')}</div><div class="ct-tags">${r.donVi ? `<span class="pn-tag pn-tag--blue">${esc(r.donVi)}</span>` : ''}${r.nhom ? `<span class="ct-group" title="${attr(r.nhom)}">${esc(r.nhom)}</span>` : ''}</div></td>
      <td><span class="ct-place">${r.noiLamViec ? svg('pin', 13) + esc(r.noiLamViec) : '—'}</span></td>
      <td>${contactLine('phone', r)}</td><td>${contactLine('mail', r)}</td></tr>`;
  }
  function renderCard(r) {
    return `<article class="ct-card" data-ct-open="${attr(r.key)}" tabindex="0"><div class="ct-card__top">${avatar(r, 'ct-avatar--lg')}<div class="ct-card__who"><h4>${esc(r.hoTen)}</h4><p>${esc(r.chucDanh || '—')}</p><span class="pn-code">${esc(r.maNv || '—')}</span></div></div>
      <div class="ct-card__org"><span>${svg('building', 13)}${esc(r.phong || r.donVi || '—')}</span>${r.to ? `<span>${svg('users', 13)}${esc(r.to)}</span>` : ''}<span>${svg('pin', 13)}${esc(r.noiLamViec || '—')}</span></div>
      <div class="ct-card__contact">${contactLine('phone', r)}${contactLine('mail', r)}</div></article>`;
  }
  function pageButtons(page, pages) {
    const out = [], push = n => out.push(`<button type="button" class="pending-page-btn${n === page ? ' is-active' : ''}" data-ct-page="${n}"${n === page ? ' aria-current="page"' : ''}>${n}</button>`);
    const set = new Set([1, pages, page - 1, page, page + 1].filter(n => n >= 1 && n <= pages));
    let prev = 0;
    for (const n of [...set].sort((x, y) => x - y)) { if (n - prev > 1) out.push('<span class="pn-gap">…</span>'); push(n); prev = n; }
    return out.join('');
  }

  function paint() {
    if (!host) return;
    const {scoped, list} = view();
    const total = list.length, pages = Math.max(1, Math.ceil(total / state.per));
    state.page = Math.min(Math.max(1, state.page), pages);
    const start = (state.page - 1) * state.per, pageRows = list.slice(start, start + state.per);
    const set = (id, html) => { const el = host.querySelector(id); if (el) el.innerHTML = html; };
    set('#ctSummary', renderSummary());
    set('#ctChips', renderChips(scoped));
    for (const [key, f] of [['nhom', 'nhom'], ['phong', 'phong'], ['chucDanh', 'chucDanh'], ['noiLamViec', 'noiLamViec'], ['donVi', 'donVi']]) if (state[key] !== 'all' && !records.some(r => r[f] === state[key])) state[key] = 'all';
    const opts = (f, allLabel) => [{value: 'all', label: allLabel, count: records.length}, ...distinct(records, f).map(v => ({value: v, label: v, count: records.filter(r => r[f] === v).length}))];
    const keepOpen = openDdName(); closeDd();
    set('#ctFilters', dd('nhom', 'users', 'Khối / Nhóm', state.nhom, opts('nhom', 'Tất cả khối')) + dd('phong', 'building', 'Phòng ban', state.phong, opts('phong', 'Tất cả phòng ban')) + dd('chucDanh', 'id', 'Chức danh', state.chucDanh, opts('chucDanh', 'Tất cả chức danh')) +
      dd('noiLamViec', 'pin', 'Nơi làm việc', state.noiLamViec, opts('noiLamViec', 'Tất cả nơi')) + dd('sort', 'sort', 'Sắp xếp', state.sort, SORTS.map(s => ({value: s.key, label: s.label})), {right: true, base: 'name'}));
    const filtered = state.q || ['nhom', 'phong', 'chucDanh', 'noiLamViec', 'donVi'].some(k => state[k] !== 'all') || state.quick !== 'all';
    host.querySelector('[data-ct-reset]').disabled = !filtered;
    host.querySelector('#ctCount').innerHTML = `<strong>${total.toLocaleString('vi-VN')}</strong> / ${records.length.toLocaleString('vi-VN')} liên hệ`;
    host.querySelectorAll('[data-ct-view]').forEach(b => { const on = b.dataset.ctView === state.view; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
    const empty = !loaded ? `<div class="pn-empty"><b>Đang tải danh bạ…</b></div>` : loadError ? `<div class="pn-empty">${svg('alert', 28)}<b>Không đọc được danh bạ</b><span>${esc(loadError)}</span></div>`
      : `<div class="pn-empty">${svg('search', 28)}<b>${records.length ? 'Không có liên hệ phù hợp' : 'Danh bạ chưa có dữ liệu'}</b><span>${records.length ? 'Thử bỏ bớt bộ lọc hoặc đổi từ khóa tìm kiếm.' : canManage() ? 'Bấm “Nhập Excel” để nạp danh sách nhân sự từ file Excel.' : 'Quản trị viên chưa nạp danh bạ.'}</span>${records.length && filtered ? '<button type="button" class="pending-action-btn" data-ct-reset><span>Xóa bộ lọc</span></button>' : ''}${!records.length && loaded && !loadError && canManage() ? '<button type="button" class="pending-action-btn pending-action-btn--import" data-ct-import><span>Nhập Excel</span></button>' : ''}</div>`;
    const body = host.querySelector('#ctBody');
    if (!pageRows.length) body.innerHTML = empty;
    else if (state.view === 'cards') body.innerHTML = `<div class="ct-cards">${pageRows.map(renderCard).join('')}</div>`;
    else body.innerHTML = `<div class="table-container pending-register-table"><table class="p-table ct-table"><thead><tr><th class="pn-c-stt">#</th><th>Nhân sự</th><th>Chức danh</th><th>Phòng ban / Đơn vị</th><th>Nơi làm việc</th><th>Số điện thoại</th><th>Email công ty</th></tr></thead><tbody>${pageRows.map((r, i) => renderRow(r, start + i)).join('')}</tbody></table></div>`;
    host.querySelector('#ctPager').innerHTML = total ? `<div class="pending-pagination__inner">${dd('per', 'rows', 'Mỗi trang', state.per, PER_PAGE.map(n => ({value: n, label: n + ' / trang'})), {compact: true, right: true})}<div class="pending-pagination__summary"><strong>${start + 1}–${Math.min(start + state.per, total)}</strong> / ${total}</div><div class="pending-page-controls"><button type="button" class="pending-page-btn" data-ct-page="${state.page - 1}" ${state.page <= 1 ? 'disabled' : ''} title="Trang trước" aria-label="Trang trước">${svg('left', 14)}</button>${pageButtons(state.page, pages)}<button type="button" class="pending-page-btn" data-ct-page="${state.page + 1}" ${state.page >= pages ? 'disabled' : ''} title="Trang sau" aria-label="Trang sau">${svg('right', 14)}</button></div></div>` : '';
    registerMenus();
    if (typeof enhancePendingRegisterDropdowns === 'function') enhancePendingRegisterDropdowns();
    if (keepOpen && host.querySelector(`[data-ct-dd="${keepOpen}"]`)) openDd(keepOpen);
  }

  // ----- Sao chép / vCard / Excel -----
  async function copyText(text, label) {
    try { await navigator.clipboard.writeText(text); }
    catch (_) { const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (__) { /* bỏ qua */ } ta.remove(); }
    toast('Đã sao chép ' + (label || 'nội dung') + ': ' + text, 'success');
  }
  function downloadBlob(name, type, content) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], {type})); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    xlsxPromise = xlsxPromise || new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = XLSX_SRC;
      script.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error('Không nạp được thư viện Excel.')));
      script.onerror = () => { xlsxPromise = null; reject(new Error('Không nạp được thư viện Excel.')); };
      document.head.appendChild(script);
    });
    return xlsxPromise;
  }
  const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  async function exportExcel(button) {
    const {list} = view();
    if (!list.length) { toast('Không có liên hệ để xuất', 'warning'); return; }
    button.disabled = true;
    try {
      const XLSX = await loadXlsx(), admin = canManage();
      const head = ['STT', 'Mã NV', 'Họ và tên', 'Đơn vị', 'Phòng/ban/Chi nhánh', 'Tổ/nhóm', 'Chức danh', 'Nơi làm việc', ...(admin ? ['Năm sinh', 'Giới tính'] : []), 'Số điện thoại', 'Email Công ty', 'Khối/Nhóm'];
      const body = list.map((r, i) => [i + 1, r.maNv || '', r.hoTen, r.donVi || '', r.phong || '', r.to || '', r.chucDanh || '', r.noiLamViec || '', ...(admin ? [r.namSinh || '', r.gioiTinh || ''] : []), r.sdt || '', r.email || '', r.nhom || '']);
      const ws = XLSX.utils.aoa_to_sheet([head, ...body]);
      const border = {top: {style: 'thin', color: {rgb: 'E7E3D9'}}, bottom: {style: 'thin', color: {rgb: 'E7E3D9'}}, left: {style: 'thin', color: {rgb: 'E7E3D9'}}, right: {style: 'thin', color: {rgb: 'E7E3D9'}}};
      const phoneCol = head.indexOf('Số điện thoại');
      for (let c = 0; c < head.length; c++) {
        ws[XLSX.utils.encode_cell({r: 0, c})].s = {font: {bold: true, color: {rgb: 'FFFFFF'}}, fill: {fgColor: {rgb: '8A6A32'}}, alignment: {horizontal: 'center', vertical: 'center', wrapText: true}, border};
        for (let r = 1; r <= body.length; r++) { const cell = ws[XLSX.utils.encode_cell({r, c})]; if (!cell) continue; if (c === phoneCol) { cell.t = 's'; cell.v = String(cell.v); } cell.s = {alignment: {vertical: 'center', horizontal: c === 0 ? 'center' : 'left'}, border}; }
      }
      ws['!cols'] = [6, 11, 26, 11, 30, 26, 26, 14, ...(admin ? [10, 10] : []), 14, 32, 28].map(wch => ({wch}));
      ws['!rows'] = [{hpt: 30}];
      ws['!autofilter'] = {ref: XLSX.utils.encode_range({s: {r: 0, c: 0}, e: {r: body.length, c: head.length - 1}})};
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Danh bạ');
      XLSX.writeFile(wb, 'danh-ba-noi-bo-' + isoDate(new Date()) + '.xlsx');
      toast('Đã xuất ' + list.length + ' liên hệ ra Excel', 'success');
    } catch (error) { toast('Không xuất được Excel: ' + (error && error.message || 'lỗi không xác định'), 'error'); }
    finally { button.disabled = false; }
  }

  // ----- Hộp thoại (xem / sửa / nhập) và xác nhận -----
  const dialogEl = () => host.querySelector('#ctDialog');
  function showModal(html, wide) {
    const box = dialogEl(); box.innerHTML = html; box.classList.toggle('ct-dialog--wide', !!wide);
    host.querySelector('#ctModal').hidden = false; document.body.classList.add('pn-modal-open');
  }
  function closeModal() { modal = null; importState = null; const el = host && host.querySelector('#ctModal'); if (el) el.hidden = true; document.body.classList.remove('pn-modal-open'); }
  const btn = (attrs, icon, text, cls) => `<button type="button" class="pending-action-btn${cls ? ' ' + cls : ''}" ${attrs}><span class="pending-action-btn__icon" aria-hidden="true">${svg(icon, 15)}</span><span>${text}</span></button>`;
  const fieldRow = (label, value) => value ? `<div class="ct-kv"><span>${esc(label)}</span><b>${esc(value)}</b></div>` : '';

  function openDetail(key) {
    const r = records.find(x => x.key === key); if (!r) return;
    modal = {mode: 'detail', key};
    const admin = canManage();
    showModal(`<header><div class="ct-dhead">${avatar(r, 'ct-avatar--xl')}<div><span class="pw-eyebrow">${esc(r.nhom || 'Danh bạ nội bộ')}</span><h3>${esc(r.hoTen)}</h3><div class="pn-modal-meta">${[r.chucDanh, r.maNv].filter(Boolean).map(t => `<span>${esc(t)}</span>`).join('')}</div></div></div><button type="button" class="pn-x" data-ct-close aria-label="Đóng">${svg('close', 18)}</button></header>
      <div class="pn-dialog-body"><div class="ct-quick">${r.sdt ? `<a class="pending-action-btn pending-action-btn--import" href="tel:${attr(r.sdt)}"><span class="pending-action-btn__icon">${svg('phone', 15)}</span><span>Gọi ${esc(C().fmtPhone(r.sdt))}</span></a>` : ''}${r.email ? `<a class="pending-action-btn" href="mailto:${attr(r.email)}"><span class="pending-action-btn__icon">${svg('mail', 15)}</span><span>Gửi email</span></a>` : ''}
      ${r.sdt ? `<button type="button" class="pending-action-btn" data-ct-copy="${attr(r.sdt)}" data-ct-label="số điện thoại"><span class="pending-action-btn__icon">${svg('copy', 15)}</span><span>Sao chép SĐT</span></button>` : ''}${r.email ? `<button type="button" class="pending-action-btn" data-ct-copy="${attr(r.email)}" data-ct-label="email"><span class="pending-action-btn__icon">${svg('copy', 15)}</span><span>Sao chép email</span></button>` : ''}
      <button type="button" class="pending-action-btn" data-ct-vcf="${attr(r.key)}"><span class="pending-action-btn__icon">${svg('download', 15)}</span><span>Lưu danh bạ (.vcf)</span></button></div>
      <div class="ct-kvs">${fieldRow('Số điện thoại', C().fmtPhone(r.sdt))}${fieldRow('Email công ty', r.email)}${fieldRow('Đơn vị', r.donVi)}${fieldRow('Phòng/ban/Chi nhánh', r.phong)}${fieldRow('Tổ/nhóm', r.to)}${fieldRow('Chức danh', r.chucDanh)}${fieldRow('Nơi làm việc', r.noiLamViec)}${fieldRow('Mã nhân viên', r.maNv)}${admin ? fieldRow('Năm sinh', r.namSinh) + fieldRow('Giới tính', r.gioiTinh) : ''}${admin && r.updatedAt ? fieldRow('Cập nhật', new Date(Number(r.updatedAt)).toLocaleString('vi-VN') + (r.updatedBy ? ' · ' + r.updatedBy : '')) : ''}</div></div>
      <footer>${can('delete') ? `<span class="ct-foot-left">${btn(`data-ct-del="${attr(r.key)}"`, 'trash', 'Xóa', 'ct-danger')}</span>` : ''}${can('edit') ? btn(`data-ct-edit="${attr(r.key)}"`, 'edit', 'Chỉnh sửa', 'pending-action-btn--import') : ''}${btn('data-ct-close', 'close', 'Đóng')}</footer>`);
  }
  const FORM_FIELDS = [['hoTen', 'Họ và tên', true], ['maNv', 'Mã nhân viên', true], ['donVi', 'Đơn vị'], ['phong', 'Phòng/ban/Chi nhánh'], ['to', 'Tổ/nhóm'], ['chucDanh', 'Chức danh'], ['noiLamViec', 'Nơi làm việc'], ['nhom', 'Khối/Nhóm'], ['sdt', 'Số điện thoại'], ['email', 'Email công ty'], ['namSinh', 'Năm sinh']];
  function openEdit(key) {
    if (key ? !can('edit') : !can('add')) return void toast('Bạn không có quyền ' + (key ? 'sửa' : 'thêm') + ' liên hệ trong Danh bạ nội bộ.', 'warning');
    const r = key ? records.find(x => x.key === key) : null;
    modal = {mode: 'edit', key: key || null};
    const lists = {donVi: 'donVi', phong: 'phong', to: 'to', chucDanh: 'chucDanh', noiLamViec: 'noiLamViec', nhom: 'nhom'};
    const dl = Object.entries(lists).map(([f]) => `<datalist id="ctDl_${f}">${distinct(records, f).map(v => `<option value="${attr(v)}"></option>`).join('')}</datalist>`).join('');
    const input = ([f, label, req]) => `<label class="ct-field${['hoTen', 'phong', 'chucDanh', 'email'].includes(f) ? ' ct-field--wide' : ''}"><span class="pn-label">${esc(label)}${req ? ' <em>*</em>' : ''}</span><input type="${f === 'namSinh' ? 'number' : f === 'email' ? 'email' : 'text'}" name="${f}" value="${attr(r && r[f] != null ? r[f] : '')}" ${lists[f] ? `list="ctDl_${f}"` : ''} ${f === 'sdt' ? 'inputmode="tel"' : ''} ${f === 'namSinh' ? 'min="1900" max="' + new Date().getFullYear() + '"' : ''} autocomplete="off" ${req ? 'required' : ''}></label>`;
    const g = r ? r.gioiTinh : '';
    showModal(`<header><div><span class="pw-eyebrow">Danh bạ nội bộ</span><h3>${r ? 'Chỉnh sửa liên hệ' : 'Thêm liên hệ mới'}</h3></div><button type="button" class="pn-x" data-ct-close aria-label="Đóng">${svg('close', 18)}</button></header>
      <form class="pn-dialog-body ct-form" id="ctForm" novalidate>${dl}<div class="ct-grid">${FORM_FIELDS.map(input).join('')}
      <div class="ct-field"><span class="pn-label">Giới tính</span><div class="ct-seg" role="radiogroup">${[['', 'Chưa rõ'], ['Nam', 'Nam'], ['Nữ', 'Nữ']].map(([v, t]) => `<label><input type="radio" name="gioiTinh" value="${v}" ${g === v || (!g && v === '') ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div></div></div>
      <p class="ct-err" id="ctErr" role="alert" hidden></p></form>
      <footer><span class="pn-kbd">Ctrl + Enter để lưu</span>${btn('data-ct-close', 'close', 'Hủy')}${btn('data-ct-save', 'check', r ? 'Lưu thay đổi' : 'Thêm liên hệ', 'pending-action-btn--import')}</footer>`, true);
    setTimeout(() => dialogEl().querySelector('input[name="hoTen"]')?.focus(), 30);
  }
  async function saveContact() {
    const form = host.querySelector('#ctForm'), err = host.querySelector('#ctErr'), fail = msg => { err.textContent = msg; err.hidden = false; };
    const val = n => C().clean(form.elements[n] ? form.elements[n].value : '');
    const rec = {hoTen: val('hoTen'), maNv: val('maNv').toUpperCase(), donVi: val('donVi'), phong: val('phong'), to: val('to'), chucDanh: val('chucDanh'), noiLamViec: val('noiLamViec'), nhom: val('nhom'), gioiTinh: (form.querySelector('input[name="gioiTinh"]:checked') || {}).value || ''};
    if (!rec.hoTen) return fail('Vui lòng nhập họ và tên.');
    if (!rec.maNv) return fail('Vui lòng nhập mã nhân viên (dùng làm khoá, không trùng).');
    const phone = C().normPhone(val('sdt')), mail = C().normEmail(val('email')), year = C().normYear(val('namSinh'));
    if (!phone.valid) return fail('Số điện thoại không hợp lệ (cần 10–11 chữ số, bắt đầu bằng 0).');
    if (!mail.valid) return fail('Email không đúng định dạng.');
    if (!year.valid) return fail('Năm sinh không hợp lệ.');
    Object.assign(rec, {sdt: phone.value, email: mail.value, namSinh: year.value});
    const key = C().makeKey(rec), oldKey = modal && modal.key;
    if (oldKey ? !can('edit') : !can('add')) return fail('Bạn không có quyền ' + (oldKey ? 'sửa' : 'thêm') + ' liên hệ.');
    // Đổi Mã NV = tạo bản ghi mới + xóa bản ghi cũ nên cần cả quyền Thêm và Xóa.
    if (oldKey && key !== oldKey && !(can('add') && can('delete'))) return fail('Đổi Mã nhân viên cần cả quyền Thêm và Xóa. Hãy giữ nguyên Mã NV hoặc nhờ Admin.');
    if (key !== oldKey && records.some(r => r.key === key)) return fail('Mã nhân viên "' + rec.maNv + '" đã tồn tại trong danh bạ.');
    const save = host.querySelector('[data-ct-save]'); save.disabled = true; err.hidden = true;
    try {
      const out = {...rec, updatedAt: Date.now(), updatedBy: me().slice(0, 120)};
      if (out.namSinh === null) delete out.namSinh;
      const updates = {['contact_directory/' + key]: out};
      if (oldKey && oldKey !== key) updates['contact_directory/' + oldKey] = null;
      await dbNodeInstance.ref().update(updates);
      if (typeof logUserActivity === 'function') logUserActivity('SYSTEM_SETTING', (oldKey ? 'Sửa' : 'Thêm') + ' liên hệ danh bạ: ' + rec.hoTen + ' (' + rec.maNv + ')');
      toast(oldKey ? 'Đã cập nhật liên hệ' : 'Đã thêm liên hệ', 'success'); closeModal();
    } catch (error) { fail('Không lưu được: ' + (error && error.message || 'lỗi không xác định')); save.disabled = false; }
  }
  function askConfirm(title, text, okLabel, danger) {
    const el = host.querySelector('#ctConfirm');
    el.querySelector('h3').textContent = title; el.querySelector('p').innerHTML = text;
    const ok = el.querySelector('[data-ct-yes]'); ok.querySelector('span:last-child').textContent = okLabel; ok.classList.toggle('ct-danger', !!danger);
    el.hidden = false;
    return new Promise(resolve => { confirmResolve = resolve; setTimeout(() => ok.focus(), 30); });
  }
  function answerConfirm(value) { const el = host.querySelector('#ctConfirm'); if (el) el.hidden = true; if (confirmResolve) { const f = confirmResolve; confirmResolve = null; f(value); } }
  async function deleteContact(key) {
    const r = records.find(x => x.key === key); if (!r) return;
    if (!can('delete')) return void toast('Bạn không có quyền xóa liên hệ trong Danh bạ nội bộ.', 'warning');
    if (!await askConfirm('Xóa liên hệ?', `<b>${esc(r.hoTen)}</b> (${esc(r.maNv || '—')}) sẽ bị xóa khỏi danh bạ cho mọi người dùng. Không thể hoàn tác.`, 'Xóa liên hệ', true)) return;
    try {
      await dbNodeInstance.ref('contact_directory/' + key).remove();
      if (typeof logUserActivity === 'function') logUserActivity('SYSTEM_SETTING', 'Xóa liên hệ danh bạ: ' + r.hoTen + ' (' + r.maNv + ')');
      toast('Đã xóa liên hệ', 'success'); closeModal();
    } catch (error) { toast('Không xóa được: ' + (error && error.message || 'lỗi không xác định'), 'error'); }
  }

  // ----- Nhập Excel (cần quyền Thêm và/hoặc Sửa; chế độ Thay thế còn cần quyền Xóa) -----
  function openImport() {
    if (!can('add') && !can('edit')) return void toast('Bạn không có quyền nhập danh bạ từ Excel.', 'warning');
    modal = {mode: 'import'}; importState = null;
    showModal(importHtml(), true);
  }
  function importHtml() {
    const s = importState;
    const head = `<header><div><span class="pw-eyebrow">Danh bạ nội bộ</span><h3>Nhập danh bạ từ Excel</h3></div><button type="button" class="pn-x" data-ct-close aria-label="Đóng">${svg('close', 18)}</button></header>`;
    if (!s) return head + `<div class="pn-dialog-body"><label class="ct-drop" id="ctDrop" tabindex="0"><input type="file" id="ctFile" accept=".xlsx,.xls,.csv" hidden><span class="ct-drop__ico">${svg('upload', 26)}</span><b>Chọn file Excel hoặc kéo thả vào đây</b><span>Hỗ trợ .xlsx, .xls, .csv — tự nhận cột “Mã NV, Họ và tên, Đơn vị, Phòng/ban/Chi nhánh, Tổ/nhóm, Chức danh, Nơi làm việc, Năm sinh, Giới tính, Số điện thoại, Email Công ty” và các dòng tiêu đề nhóm (vd “CHI NHÁNH THANH HÓA”).</span></label><p class="ct-note">Mã NV là khoá: nhập lại file sẽ <b>cập nhật</b> người đã có và <b>thêm</b> người mới, không tạo bản sao.</p></div><footer>${btn('data-ct-close', 'close', 'Đóng')}</footer>`;
    if (s.error) return head + `<div class="pn-dialog-body"><div class="ct-err" role="alert">${esc(s.error)}</div></div><footer>${btn('data-ct-import-again', 'upload', 'Chọn file khác')}${btn('data-ct-close', 'close', 'Đóng')}</footer>`;
    const d = s.diff, total = s.parsed.records.length, labels = C().LABELS;
    const stat = (n, label, tone) => `<div class="ct-stat ct-stat--${tone}"><b>${n.toLocaleString('vi-VN')}</b><span>${label}</span></div>`;
    const issues = [...s.parsed.skipped.map(x => `Dòng ${x.line}: ${x.reason}`), ...s.parsed.warnings.map(x => `Dòng ${x.line} (${x.name}): ${x.reason}`)];
    const writes = d.added.length + d.updated.length + d.removed.length;
    return head + `<div class="pn-dialog-body"><div class="ct-file">${svg('xls', 16)}<b>${esc(s.fileName)}</b><span>· sheet “${esc(s.sheet)}”</span></div>
      <div class="ct-stats">${stat(total, 'liên hệ hợp lệ', 'gold')}${stat(d.added.length, 'thêm mới', 'green')}${stat(d.updated.length, 'cập nhật', 'blue')}${stat(d.unchanged.length, 'không đổi', 'mute')}${stat(s.parsed.skipped.length, 'bị bỏ qua', s.parsed.skipped.length ? 'red' : 'mute')}</div>
      <div class="ct-cols"><span class="pn-label">Cột đã nhận diện</span><div>${s.parsed.mapped.map(f => `<i class="ct-colchip">${svg('check', 11)}${esc(labels[f])}</i>`).join('')}${s.parsed.missing.map(f => `<i class="ct-colchip is-miss">${esc(labels[f])} — không có</i>`).join('')}</div></div>
      <div class="ct-mode" role="radiogroup" aria-label="Cách nhập"><label><input type="radio" name="ctMode" value="merge" ${s.mode === 'merge' ? 'checked' : ''}><span><b>Gộp theo Mã NV</b><small>Thêm người mới, cập nhật người đã có, giữ nguyên người không có trong file.</small></span></label>
      <label><input type="radio" name="ctMode" value="replace" ${s.mode === 'replace' ? 'checked' : ''}><span><b>Thay thế toàn bộ</b><small>Danh bạ khớp đúng file${s.mode === 'replace' ? ' — sẽ xóa ' + d.removed.length + ' người không có trong file' : ''}.</small></span></label></div>
      ${issues.length ? `<details class="ct-issues"><summary>${issues.length} lưu ý khi đọc file</summary><ul>${issues.slice(0, 60).map(t => `<li>${esc(t)}</li>`).join('')}${issues.length > 60 ? `<li>… và ${issues.length - 60} lưu ý khác</li>` : ''}</ul></details>` : ''}</div>
      <footer>${btn('data-ct-import-again', 'upload', 'Chọn file khác')}${btn('data-ct-close', 'close', 'Hủy')}${btn('data-ct-import-go' + (writes ? '' : ' disabled'), 'check', writes ? `Nhập ${writes.toLocaleString('vi-VN')} thay đổi` : 'Không có gì để nhập', 'pending-action-btn--import')}</footer>`;
  }
  async function readFile(file) {
    if (!file) return;
    const box = dialogEl(); box.querySelector('.pn-dialog-body').innerHTML = '<div class="pn-empty"><b>Đang đọc file…</b></div>';
    try {
      const XLSX = await loadXlsx();
      const wb = XLSX.read(await file.arrayBuffer(), {type: 'array'});
      let parsed = null, sheet = '';
      for (const name of wb.SheetNames) { const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], {header: 1, raw: false, defval: ''}); const p = C().parseRows(rows); if (p.ok) { parsed = p; sheet = name; break; } if (!parsed) parsed = p; }
      if (!parsed.ok) importState = {error: parsed.error};
      else if (!parsed.records.length) importState = {error: 'File không có dòng nhân sự hợp lệ nào.'};
      else { const existing = Object.fromEntries(records.map(r => [r.key, r])); importState = {fileName: file.name, sheet, parsed, mode: 'merge', existing};importState.diff = C().diff(existing, parsed.records, 'merge'); }
    } catch (error) { importState = {error: 'Không đọc được file: ' + (error && error.message || 'định dạng không hỗ trợ')}; }
    dialogEl().innerHTML = importHtml();
  }
  async function runImport() {
    const s = importState; if (!s || !s.diff) return;
    const d = s.diff, go = host.querySelector('[data-ct-import-go]');
    const lacking = (d.added.length && !can('add') && 'Thêm') || (d.updated.length && !can('edit') && 'Sửa') || (d.removed.length && !can('delete') && 'Xóa');
    if (lacking) return void toast('Bạn chưa có quyền ' + lacking + ' cho các thay đổi này. Hãy bỏ chế độ Thay thế hoặc nhờ Admin cấp quyền.', 'warning');
    if (s.mode === 'replace' && d.removed.length && !await askConfirm('Thay thế toàn bộ danh bạ?', `Sẽ <b>xóa ${d.removed.length}</b> liên hệ không có trong file, thêm ${d.added.length} và cập nhật ${d.updated.length}. Không thể hoàn tác.`, 'Đồng ý thay thế', true)) return;
    go.disabled = true; go.querySelector('span:last-child').textContent = 'Đang ghi…';
    try {
      const now = Date.now(), by = me().slice(0, 120), updates = {};
      for (const r of [...d.added, ...d.updated]) { const {key, _s, ...rest} = r; const out = {...rest, updatedAt: now, updatedBy: by}; if (out.namSinh === null) delete out.namSinh; updates['contact_directory/' + key] = out; }
      for (const key of d.removed) updates['contact_directory/' + key] = null;
      const keys = Object.keys(updates);
      for (let i = 0; i < keys.length; i += 300) { await dbNodeInstance.ref().update(Object.fromEntries(keys.slice(i, i + 300).map(k => [k, updates[k]]))); go.querySelector('span:last-child').textContent = `Đang ghi… ${Math.min(i + 300, keys.length)}/${keys.length}`; }
      if (typeof logUserActivity === 'function') logUserActivity('SYSTEM_SETTING', `Nhập danh bạ nội bộ từ Excel: +${d.added.length}, cập nhật ${d.updated.length}, xóa ${d.removed.length} (${s.fileName})`);
      toast(`Đã nhập danh bạ: thêm ${d.added.length}, cập nhật ${d.updated.length}${d.removed.length ? ', xóa ' + d.removed.length : ''}`, 'success'); closeModal();
    } catch (error) { toast('Không nhập được: ' + (error && error.message || 'lỗi không xác định') + '. Kiểm tra quyền ghi trong Firebase rules.', 'error'); go.disabled = false; go.querySelector('span:last-child').textContent = 'Thử lại'; }
  }

  // ----- Khung trang & sự kiện -----
  function skeleton() {
    const admin = canManage(), top = (attrs, icon, text, cls) => `<button type="button" class="pending-action-btn${cls ? ' ' + cls : ''}" ${attrs}><span class="pending-action-btn__icon" aria-hidden="true">${svg(icon, 15)}</span><span>${text}</span></button>`;
    return `<div class="workspace-grid single-col"><section class="pending-workspace pending-workspace--v2 pn-workspace ct-workspace" id="ctRoot" aria-label="Danh bạ nội bộ">
      <header class="pw-page-head"><div class="pw-page-title"><div class="pw-page-emblem" aria-hidden="true">${svg('book', 22)}</div><div><span class="pw-eyebrow">Danh bạ nội bộ</span><h1>Tra cứu liên hệ</h1><p>Tìm nhanh nhân sự theo tên, mã nhân viên, số điện thoại, email, chức danh hoặc phòng ban — gọi, gửi email hay sao chép chỉ một chạm.</p></div></div>
      <div class="pending-action-group" role="group" aria-label="Thao tác">${top('data-ct-export', 'xls', 'Xuất Excel', admin ? '' : 'pending-action-btn--import')}${can('add') ? top('data-ct-add', 'plus', 'Thêm liên hệ') : ''}${can('add') || can('edit') ? top('data-ct-import', 'upload', 'Nhập Excel', 'pending-action-btn--import') : ''}</div></header>
      <div class="claims-metrics-grid pn-metrics ct-metrics" id="ctSummary" aria-label="Tổng quan danh bạ"></div>
      <div class="pending-register-panel pn-list"><div class="pending-register-topbar"><div class="pending-register-header"><h3>Danh bạ nhân sự</h3><div class="pending-filter-summary" aria-live="polite"><span class="pending-filter-result-count" id="ctCount"></span></div></div>
      <div class="ct-topright"><div class="ct-viewtoggle" role="group" aria-label="Kiểu hiển thị"><button type="button" data-ct-view="table" title="Dạng bảng" aria-label="Dạng bảng">${svg('list', 15)}</button><button type="button" data-ct-view="cards" title="Dạng thẻ" aria-label="Dạng thẻ">${svg('grid', 15)}</button></div><div class="pending-pagination" id="ctPager"></div></div></div>
      <div class="pending-filter-toolbar"><div class="pending-filter-search"><span class="pending-filter-search__icon" aria-hidden="true">${svg('search', 16)}</span><input type="search" id="ctSearch" class="pending-filter-search__input" placeholder="Tìm tên, mã NV, SĐT, email…" autocomplete="off" aria-label="Tìm liên hệ"></div>
      <div class="pending-filter-controls" id="ctFilters"></div><button type="button" class="pending-filter-reset" data-ct-reset title="Đặt lại toàn bộ bộ lọc" aria-label="Đặt lại bộ lọc">${svg('reset', 16)}</button></div>
      <div class="pn-chips" id="ctChips" role="group" aria-label="Lọc nhanh theo đơn vị"></div><div id="ctBody"></div></div>
      <div class="pn-modal" id="ctModal" hidden role="dialog" aria-modal="true"><div class="pn-dialog" id="ctDialog"></div></div>
      <div class="pn-modal ct-confirm" id="ctConfirm" hidden role="alertdialog" aria-modal="true"><div class="pn-dialog"><div class="pn-dialog-body"><h3></h3><p></p></div><footer>${top('data-ct-no', 'close', 'Hủy')}${top('data-ct-yes', 'check', 'Đồng ý', 'pending-action-btn--import')}</footer></div></div></section></div>`;
  }
  function setUnit(value) { state.donVi = value; state.quick = 'all'; state.page = 1; paint(); }
  function onClick(event) {
    const t = event.target;
    if (t.closest('[data-ct-stop]')) return;                       // liên kết gọi/mail: để trình duyệt xử lý
    const copy = t.closest('[data-ct-copy]'); if (copy) { event.stopPropagation(); return void copyText(copy.dataset.ctCopy, copy.dataset.ctLabel); }
    const opt = t.closest('[data-ct-opt]');
    if (opt) {
      event.stopPropagation();
      const name = opt.closest('[data-ct-dd]').dataset.ctDd, value = opt.dataset.ctOpt;
      closeDd();
      if (name === 'per') state.per = Number(value) || 24; else state[name] = value;
      state.page = 1; paint(); return;
    }
    const trigger = t.closest('.pending-filter-trigger');
    if (trigger) { event.stopPropagation(); return void openDd(trigger.closest('[data-ct-dd]').dataset.ctDd, event); }
    if (!t.closest('.custom-dropdown-container')) closeDd();
    if (t.closest('[data-ct-yes]')) return void answerConfirm(true);
    if (t.closest('[data-ct-no]') || t.id === 'ctConfirm') return void answerConfirm(false);
    const unit = t.closest('[data-ct-unit]'); if (unit) return void setUnit(unit.dataset.ctUnit);
    const q = t.closest('[data-ct-quick]'); if (q) { state.quick = state.quick === q.dataset.ctQuick && q.dataset.ctQuick !== 'all' ? 'all' : q.dataset.ctQuick; if (q.dataset.ctQuick === 'all') state.donVi = 'all'; state.page = 1; return void paint(); }
    const page = t.closest('[data-ct-page]'); if (page && !page.disabled) { state.page = Number(page.dataset.ctPage); paint(); return void host.querySelector('.pn-list').scrollIntoView({behavior: 'smooth', block: 'start'}); }
    const vw = t.closest('[data-ct-view]'); if (vw) { state.view = vw.dataset.ctView; return void paint(); }
    if (t.closest('[data-ct-reset]')) { Object.assign(state, {q: '', nhom: 'all', phong: 'all', chucDanh: 'all', noiLamViec: 'all', donVi: 'all', quick: 'all', page: 1}); host.querySelector('#ctSearch').value = ''; return void paint(); }
    if (t.closest('[data-ct-export]')) return void exportExcel(t.closest('[data-ct-export]'));
    if (t.closest('[data-ct-add]')) return void openEdit(null);
    if (t.closest('[data-ct-import]') || t.closest('[data-ct-import-again]')) { if (t.closest('[data-ct-import-again]')) { importState = null; dialogEl().innerHTML = importHtml(); } else openImport(); return; }
    if (t.closest('[data-ct-import-go]')) return void runImport();
    const drop = t.closest('#ctDrop'); if (drop && !t.closest('input')) return void drop.querySelector('input').click();
    if (t.closest('[data-ct-close]') || t.id === 'ctModal') return void closeModal();
    if (t.closest('[data-ct-save]')) return void saveContact();
    const edit = t.closest('[data-ct-edit]'); if (edit) return void openEdit(edit.dataset.ctEdit);
    const del = t.closest('[data-ct-del]'); if (del) return void deleteContact(del.dataset.ctDel);
    const vcf = t.closest('[data-ct-vcf]'); if (vcf) { const r = records.find(x => x.key === vcf.dataset.ctVcf); if (r) downloadBlob(C().plain(r.hoTen).replace(/\s+/g, '-') + '.vcf', 'text/vcard;charset=utf-8', C().vcard(r)); return; }
    const open = t.closest('[data-ct-open]'); if (open) openDetail(open.dataset.ctOpen);
  }
  function onKey(event) {
    if (event.key === 'Escape') {
      if (!host.querySelector('#ctConfirm').hidden) return void answerConfirm(false);
      const name = openDdName(); if (name) { closeDd(); host.querySelector(`[data-ct-dd="${name}"] .pending-filter-trigger`)?.focus(); } else if (modal) closeModal(); return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches && event.target.matches('.claims-metric-card[data-ct-quick]')) { event.preventDefault(); return void event.target.click(); }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && modal && modal.mode === 'edit') { event.preventDefault(); return void saveContact(); }
    if (event.key === 'Enter' && event.target.matches && event.target.matches('[data-ct-open]')) return void openDetail(event.target.dataset.ctOpen);
    if (event.key === 'Enter' && event.target.closest && event.target.closest('#ctForm') && event.target.tagName === 'INPUT') { event.preventDefault(); }
  }
  function onInput(event) {
    if (event.target.id !== 'ctSearch') return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.q = event.target.value; state.page = 1; paint(); }, 140);
  }
  function onChange(event) {
    const t = event.target;
    if (t.id === 'ctFile') return void readFile(t.files && t.files[0]);
    if (t.name === 'ctMode' && importState) { importState.mode = t.value; importState.diff = C().diff(importState.existing, importState.parsed.records, t.value); dialogEl().innerHTML = importHtml(); }
  }

  function render(container) {
    const target = container || document.getElementById('tabContentContainer');
    if (!target) return;
    ensureListener();
    if (!target.querySelector('#ctRoot')) {
      closeModal();
      target.innerHTML = skeleton();
      host = target.querySelector('#ctRoot');
      host.addEventListener('click', onClick); host.addEventListener('keydown', onKey); host.addEventListener('input', onInput); host.addEventListener('change', onChange);
      const drop = host.querySelector('#ctModal');
      drop.addEventListener('dragover', e => { if (e.target.closest('#ctDrop')) { e.preventDefault(); e.target.closest('#ctDrop').classList.add('is-over'); } });
      drop.addEventListener('dragleave', e => e.target.closest('#ctDrop')?.classList.remove('is-over'));
      drop.addEventListener('drop', e => { if (e.target.closest('#ctDrop')) { e.preventDefault(); readFile(e.dataTransfer.files && e.dataTransfer.files[0]); } });
      host.querySelector('#ctSearch').value = state.q;
    } else host = target.querySelector('#ctRoot');
    paint();
  }
  return {render};
})();

function renderContactDirectoryPage(targetContainer) { ContactDirectoryPage.render(targetContainer); }
