// ==========================================================================
// HIỆU ỨNG MÙA LỄ (Giáng sinh) – CHỈ hiển thị ở Trang chủ.
// Cấu hình do Admin đặt trong Quản trị › Hiệu ứng mùa lễ, lưu ở Firebase settings/seasonal
// (mọi người dùng nhận realtime), có bản sao localStorage để vẽ ngay khi mở trang.
//   mode: 'auto' (chỉ chạy trong khoảng from → to hằng năm) | 'on' (luôn bật) | 'off' (tắt)
//   snow / greeting: bật tuyết rơi / lời chúc ở banner; density: 'light' | 'normal' | 'heavy'
// Tôn trọng "giảm chuyển động" của hệ điều hành; mỗi người có thể tự tắt bằng nút trên banner.
// ==========================================================================
const HomeSeasonal = (() => {
  const KEY = 'claimvision-seasonal-cfg', MUTE = 'claimvision-seasonal-mute';
  const DEFAULTS = {mode: 'auto', snow: true, greeting: true, density: 'light', from: '12-01', to: '01-05', message: 'Giáng sinh an lành & Năm mới thịnh vượng'};
  const COUNT = {light: 38, normal: 70, heavy: 120};
  let cfg = readLocal(), listening = false, active = null, previewEngine = null;

  function readLocal() { try { return {...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || 'null') || {})}; } catch (_) { return {...DEFAULTS}; } }
  function sanitize(data) {
    const md = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
    const out = {...DEFAULTS, ...(data || {})};
    if (!['auto', 'on', 'off'].includes(out.mode)) out.mode = DEFAULTS.mode;
    if (!COUNT[out.density]) out.density = DEFAULTS.density;
    if (!md.test(out.from)) out.from = DEFAULTS.from;
    if (!md.test(out.to)) out.to = DEFAULTS.to;
    out.snow = out.snow !== false; out.greeting = out.greeting !== false;
    out.message = String(out.message || DEFAULTS.message).slice(0, 80);
    return out;
  }
  function isMuted() { try { return localStorage.getItem(MUTE) === '1'; } catch (_) { return false; } }
  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } }

  // Khoảng ngày hằng năm, cho phép vắt qua năm mới (12-01 → 01-05).
  function inSeason(now, c) {
    const v = (now.getMonth() + 1) * 100 + now.getDate(), f = Number(c.from.replace('-', '')), t = Number(c.to.replace('-', ''));
    return f <= t ? v >= f && v <= t : v >= f || v <= t;
  }
  function isActive(now = new Date(), c = cfg) { return c.mode === 'on' || (c.mode === 'auto' && inSeason(now, c)); }

  const FLAKE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 2v20M4.2 7l15.6 10M19.8 7 4.2 17M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5"/></svg>';
  function badge() {
    if (!isActive() || !cfg.greeting) return '';
    return `<span class="hp-season">${FLAKE}<span>${String(cfg.message).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]))}</span></span>`;
  }

  // Nút bật/tắt tuyết nằm cạnh nút Sáng/Tối trên thanh trên; chỉ hiện ở Trang chủ khi hiệu ứng đang hoạt động.
  function syncButton() {
    const btn = document.getElementById('btnSeasonSnow');
    if (!btn) return;
    const show = typeof activeDashboardTab !== 'undefined' && activeDashboardTab === 'home' && isActive() && cfg.snow && !reduced();
    btn.hidden = !show;
    if (!show) return;
    const off = isMuted();
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v20M4.2 7l15.6 10M19.8 7 4.2 17M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5"/>' + (off ? '<path d="M3 3l18 18" stroke-width="2.2"/>' : '') + '</svg>';
    btn.title = btn.ariaLabel = off ? 'Bật hiệu ứng tuyết rơi' : 'Tắt hiệu ứng tuyết rơi';
    btn.setAttribute('aria-pressed', String(!off));
    btn.classList.toggle('is-off', off);
  }

  // Bộ vẽ tuyết dùng chung cho Trang chủ và khung xem trước của Admin. alive() = false thì tự dừng.
  function snowEngine(canvas, host, density, dark, alive) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return {stop() {}, setDensity() {}};
    let w = 0, h = 0, flakes = [], last = 0, id = 0, dens = density, stopped = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const spawn = initial => ({x: Math.random() * w, y: initial ? Math.random() * h : -8, r: 1 + Math.random() * 2.6, v: 18 + Math.random() * 34, s: Math.random() * Math.PI * 2, a: 0.35 + Math.random() * 0.5});
    const fill = () => { const n = Math.round(COUNT[dens] * Math.min(1, w / 1200 + 0.35)); while (flakes.length < n) flakes.push(spawn(true)); flakes.length = Math.min(flakes.length, n); };
    const size = () => {
      const r = host.getBoundingClientRect(); w = Math.max(1, r.width); h = Math.max(1, Math.min(r.height, 1400));
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); fill();
    };
    size();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(size) : null; ro?.observe(host);
    const halt = () => { stopped = true; cancelAnimationFrame(id); ro?.disconnect(); };
    const tick = time => {
      if (stopped || !canvas.isConnected || !alive()) { halt(); return; }
      id = requestAnimationFrame(tick);
      if (document.hidden) { last = 0; return; }
      const dt = Math.min((time - (last || time)) / 1000, 0.05); last = time;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = dark ? '#ffffff' : '#7e93a8';
      for (const f of flakes) {
        f.y += f.v * dt; f.s += dt * 0.9; f.x += Math.sin(f.s) * 14 * dt;
        if (f.y > h + 8) Object.assign(f, spawn(false), {x: Math.random() * w});
        ctx.globalAlpha = f.a * (dark ? 0.8 : 0.55);
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    id = requestAnimationFrame(tick);
    return {stop: halt, setDensity(value) { if (COUNT[value]) { dens = value; fill(); } }};
  }

  function stop() { active?.stop(); active = null; }
  function mount(root) {
    listen();
    stop();
    syncButton();
    const page = (root || document).querySelector?.('.hp-page');
    if (!page || !isActive() || !cfg.snow || isMuted() || reduced()) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'hp-snow'; canvas.setAttribute('aria-hidden', 'true');
    page.prepend(canvas);
    const me = snowEngine(canvas, page, cfg.density, !document.body.classList.contains('light-mode'), () => active === me);
    active = me;
  }

  function toggleMute() {
    try { localStorage.setItem(MUTE, isMuted() ? '0' : '1'); } catch (_) { /* bỏ qua */ }
    refresh();
  }
  // Vẽ lại trang chủ nếu đang mở (khi Admin đổi cấu hình hoặc người dùng tắt/bật tuyết).
  function refresh() {
    if (typeof activeDashboardTab !== 'undefined' && activeDashboardTab === 'home' && typeof renderActiveTabContent === 'function') { try { renderActiveTabContent(); } catch (_) { /* bỏ qua */ } }
    else stop();
  }
  function listen() {
    if (listening || typeof dbNodeInstance === 'undefined' || !dbNodeInstance) return;
    listening = true;
    dbNodeInstance.ref('settings/seasonal').on('value', snap => {
      const next = sanitize(snap.val());
      if (JSON.stringify(next) === JSON.stringify(cfg)) return;
      cfg = next;
      try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (_) { /* bỏ qua */ }
      refresh();
    }, () => { listening = false; });
  }

  // ----- Trang cấu hình của Admin (Quản trị › Hiệu ứng mùa lễ) -----
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const I = {
    auto: '<path d="M8 2v4M16 2v4M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="m9 16 2 2 4-4"/>',
    on: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    off: '<path d="M18.4 6.6a9 9 0 1 1-12.8 0M12 2v10"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'
  };
  const ico = (name, size = 18) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name]}</svg>`;
  const MONTHS = Array.from({length: 12}, (_, i) => `Tháng ${i + 1}`);
  const MODES = [['auto', 'Tự động theo ngày', 'Chỉ chạy trong mùa lễ, hết mùa tự tắt và năm sau tự bật lại.'], ['on', 'Luôn bật', 'Hiển thị liên tục, bất kể ngày nào trong năm.'], ['off', 'Tắt', 'Không hiển thị hiệu ứng nào ở Trang chủ.']];
  const DENS = [['light', 'Nhẹ', 'Tinh tế'], ['normal', 'Vừa', 'Cân bằng'], ['heavy', 'Dày', 'Rõ rệt']];
  const dateSelect = (id, value) => {
    const [m, d] = value.split('-').map(Number);
    return `<div class="sn-date"><select id="${id}M" aria-label="Tháng">${MONTHS.map((t, i) => `<option value="${i + 1}" ${i + 1 === m ? 'selected' : ''}>${t}</option>`).join('')}</select><select id="${id}D" aria-label="Ngày">${Array.from({length: 31}, (_, i) => `<option value="${i + 1}" ${i + 1 === d ? 'selected' : ''}>Ngày ${i + 1}</option>`).join('')}</select></div>`;
  };
  const toggle = (id, title, desc, on) => `<label class="sn-switch"><span class="sn-switch__copy"><strong>${title}</strong><small>${desc}</small></span><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><i aria-hidden="true"></i></label>`;
  const readForm = () => {
    const val = n => document.querySelector(`input[name="sn_${n}"]:checked`)?.value;
    const pair = id => String(document.getElementById(id + 'M')?.value).padStart(2, '0') + '-' + String(document.getElementById(id + 'D')?.value).padStart(2, '0');
    return sanitize({mode: val('mode'), density: val('density'), from: pair('snFrom'), to: pair('snTo'), snow: !!document.getElementById('snSnow')?.checked, greeting: !!document.getElementById('snGreet')?.checked, message: document.getElementById('snMsg')?.value.trim()});
  };
  const dm = v => v.split('-').reverse().join('/');
  function seasonNote(c, now = new Date()) {
    if (c.mode === 'off') return 'Hiệu ứng đang tắt.';
    if (c.mode === 'on') return 'Hiển thị liên tục.';
    if (inSeason(now, c)) return `Đang trong mùa lễ (${dm(c.from)} → ${dm(c.to)}).`;
    const [fm, fd] = c.from.split('-').map(Number); let start = new Date(now.getFullYear(), fm - 1, fd); if (start < now) start = new Date(now.getFullYear() + 1, fm - 1, fd);
    return `Sẽ tự bật sau ${Math.ceil((start - now) / 86400000)} ngày nữa (${dm(c.from)}).`;
  }
  function updatePreview() {
    const c = readForm(), box = document.getElementById('snPreview'); if (!box) return;
    box.querySelector('[data-sn-msg]').textContent = c.message;
    box.querySelector('.sn-pv__badge').hidden = !c.greeting;
    box.querySelector('canvas').hidden = !c.snow;
    previewEngine?.setDensity(c.density);
    const on = isActive(new Date(), c);
    const state = document.getElementById('snState'); if (state) { state.textContent = on ? 'Đang hiển thị' : 'Đang tắt'; state.classList.toggle('is-on', on); }
    const note = document.getElementById('snNote'); if (note) note.textContent = seasonNote(c);
    document.getElementById('snCount').textContent = String(document.getElementById('snMsg').value.length);
    const dates = document.getElementById('snDates'); if (dates) dates.classList.toggle('is-disabled', c.mode !== 'auto');
    const dirty = JSON.stringify({...c}) !== JSON.stringify({...cfg});
    const bar = document.getElementById('snBar'); if (bar) { bar.classList.toggle('is-dirty', dirty); bar.querySelector('[data-sn-dirty]').textContent = dirty ? 'Có thay đổi chưa lưu' : 'Đã đồng bộ với hệ thống'; }
  }
  function renderAdmin(container) {
    listen();
    const c = cfg;
    container.innerHTML = `
      <section class="sn-admin">
        <header class="sn-head">
          <span class="sn-head__icon">${FLAKE.replace('width="14" height="14"', 'width="22" height="22"')}</span>
          <div class="sn-head__copy"><span class="sn-eyebrow">Giao diện · Mùa lễ</span><h3>Hiệu ứng Giáng sinh</h3>
            <p>Tuyết rơi và lời chúc ở banner <strong>Trang chủ</strong>. Không xuất hiện ở trang làm việc, báo cáo hay file xuất.</p></div>
          <span class="sn-state ${isActive() ? 'is-on' : ''}" id="snState"><i></i>${isActive() ? 'Đang hiển thị' : 'Đang tắt'}</span>
        </header>
        <div class="sn-layout">
          <div class="sn-main">
            <section class="sn-card">
              <div class="sn-card__title"><h4>Chế độ vận hành</h4></div>
              <div class="sn-modes" role="radiogroup" aria-label="Chế độ vận hành">
                ${MODES.map(([v, t, d]) => `<label class="sn-mode"><input type="radio" name="sn_mode" value="${v}" ${c.mode === v ? 'checked' : ''}><span class="sn-mode__body"><span class="sn-mode__ico">${ico(v)}</span><strong>${t}</strong><small>${d}</small></span></label>`).join('')}
              </div>
              <div class="sn-dates" id="snDates">
                <div class="sn-dates__label">${ico('cal', 16)}<span>Mùa lễ hằng năm</span></div>
                <div class="sn-dates__row"><div><small>Bắt đầu</small>${dateSelect('snFrom', c.from)}</div><span class="sn-dates__arrow" aria-hidden="true">→</span><div><small>Kết thúc</small>${dateSelect('snTo', c.to)}</div></div>
                <p class="sn-note" id="snNote">${seasonNote(c)}</p>
              </div>
            </section>
            <section class="sn-card">
              <div class="sn-card__title"><h4>Hiển thị</h4></div>
              ${toggle('snSnow', 'Tuyết rơi', 'Hạt tuyết nhẹ phủ trên Trang chủ; người dùng có thể tự tắt bằng nút trên thanh trên.', c.snow)}
              ${toggle('snGreet', 'Lời chúc ở banner', 'Huy hiệu lời chúc dưới ngày tháng ở đầu Trang chủ.', c.greeting)}
              <div class="sn-row"><div class="sn-row__copy"><strong>Mật độ tuyết</strong><small>Số lượng hạt tuyết trên màn hình.</small></div>
                <div class="sn-seg" role="radiogroup" aria-label="Mật độ tuyết">${DENS.map(([v, t]) => `<label><input type="radio" name="sn_density" value="${v}" ${c.density === v ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div></div>
              <div class="sn-field"><label for="snMsg">Nội dung lời chúc <em><span id="snCount">${c.message.length}</span>/80</em></label><input type="text" id="snMsg" class="input-premium" maxlength="80" value="${esc(c.message)}"></div>
            </section>
          </div>
          <aside class="sn-side">
            <div class="sn-card sn-card--preview">
              <div class="sn-card__title"><h4>Xem trước</h4><small>Banner Trang chủ</small></div>
              <div class="sn-pv" id="snPreview"><canvas aria-hidden="true"></canvas>
                <span class="sn-pv__date">Thứ hai · 25/12/2026</span>
                <span class="sn-pv__badge">${FLAKE}<span data-sn-msg>${esc(c.message)}</span></span>
                <strong class="sn-pv__hello">Chào buổi sáng,<br><em>Quản trị viên</em></strong>
                <span class="sn-pv__bar"><i></i><i></i><i></i></span></div>
              <p class="sn-hint">Hiển thị đúng như người dùng sẽ thấy sau khi lưu.</p>
            </div>
          </aside>
        </div>
        <footer class="sn-bar" id="snBar"><span class="sn-bar__status"><i></i><span data-sn-dirty>Đã đồng bộ với hệ thống</span></span>
          <span class="sn-bar__actions"><button type="button" class="btn-premium btn-secondary" onclick="switchWorkspaceTab('home')"><span>Xem ở Trang chủ</span></button>
          <button type="button" class="btn-premium" onclick="HomeSeasonal.save()"><span>Lưu cấu hình</span></button></span></footer>
      </section>`;
    const root = container.querySelector('.sn-admin');
    root.addEventListener('input', updatePreview); root.addEventListener('change', updatePreview);
    previewEngine?.stop(); previewEngine = null;
    const canvas = container.querySelector('#snPreview canvas');
    if (canvas && !reduced()) { const me = snowEngine(canvas, canvas.parentElement, c.density, true, () => previewEngine === me); previewEngine = me; }
    updatePreview();
  }
  function parseDM(text) {
    const m = String(text || '').trim().match(/^(\d{1,2})[\/-](\d{1,2})$/); if (!m) return null;
    const d = Number(m[1]), mo = Number(m[2]); if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }
  async function save() {
    const next = readForm();
    try {
      if (!dbNodeInstance) throw new Error('offline');
      await dbNodeInstance.ref('settings/seasonal').set({...next, updatedAt: Date.now(), updatedBy: (typeof activeUserProfile !== 'undefined' && activeUserProfile?.email) || ''});
    } catch (_) { triggerToast('Không lưu được lên hệ thống. Kiểm tra mạng hoặc quyền ghi.', 'error'); return; }
    cfg = next; try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (_) { /* bỏ qua */ }
    if (typeof logUserActivity === 'function') logUserActivity('SYSTEM_SETTING', 'Cập nhật hiệu ứng mùa lễ (' + next.mode + ', ' + next.from + ' → ' + next.to + ')');
    triggerToast('Đã lưu cấu hình hiệu ứng mùa lễ.', 'success');
    updatePreview();
  }

  return {mount, badge, syncButton, isActive, renderAdmin, save, toggleMute, stop, sanitize, inSeason, parseDM, get config() { return cfg; }};
})();
window.HomeSeasonal = HomeSeasonal;
