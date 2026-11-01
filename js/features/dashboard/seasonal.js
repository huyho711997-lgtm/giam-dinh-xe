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
  let cfg = readLocal(), listening = false, raf = 0, active = null;

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
    const snowBtn = cfg.snow ? `<button type="button" class="hp-season-toggle" onclick="HomeSeasonal.toggleMute()" aria-pressed="${!isMuted()}" title="${isMuted() ? 'Bật' : 'Tắt'} tuyết rơi">${isMuted() ? 'Bật tuyết' : 'Tắt tuyết'}</button>` : '';
    return `<span class="hp-season">${FLAKE}<span>${String(cfg.message).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]))}</span>${snowBtn}</span>`;
  }

  function stop() { cancelAnimationFrame(raf); raf = 0; active = null; }
  function mount(root) {
    listen();
    stop();
    const page = (root || document).querySelector?.('.hp-page');
    if (!page || !isActive() || !cfg.snow || isMuted() || reduced()) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'hp-snow'; canvas.setAttribute('aria-hidden', 'true');
    page.prepend(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) { canvas.remove(); return; }
    const dark = !document.body.classList.contains('light-mode');
    let w = 0, h = 0, flakes = [], last = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = () => {
      const r = page.getBoundingClientRect(); w = Math.max(1, r.width); h = Math.max(1, Math.min(r.height, 1400));
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const spawn = (initial) => ({x: Math.random() * w, y: initial ? Math.random() * h : -8, r: 1 + Math.random() * 2.6, v: 18 + Math.random() * 34, s: Math.random() * Math.PI * 2, a: 0.35 + Math.random() * 0.5});
    size();
    flakes = Array.from({length: Math.round(COUNT[cfg.density] * Math.min(1, w / 1200 + 0.35))}, () => spawn(true));
    active = canvas;
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(size) : null; ro?.observe(page);
    const tick = (time) => {
      if (active !== canvas || !canvas.isConnected) { ro?.disconnect(); return; }
      raf = requestAnimationFrame(tick);
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
    raf = requestAnimationFrame(tick);
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
  function renderAdmin(container) {
    listen();
    const c = cfg, on = isActive();
    const md = v => { const [m, d] = v.split('-'); return d + '/' + m; };
    const seg = (name, items) => `<div class="seasonal-seg" role="radiogroup">${items.map(([val, label]) => `<label><input type="radio" name="sn_${name}" value="${val}" ${String(c[name]) === val ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div>`;
    container.innerHTML = `
      <section class="seasonal-admin">
        <header class="seasonal-admin__head">
          <span class="seasonal-admin__icon">${FLAKE}</span>
          <div><h3>Hiệu ứng mùa lễ · Giáng sinh</h3><p>Tuyết rơi nhẹ và lời chúc ở banner <strong>Trang chủ</strong>. Không xuất hiện ở các trang làm việc, báo cáo hay file xuất.</p></div>
          <span class="seasonal-admin__state ${on ? 'is-on' : ''}" id="snState">${on ? 'Đang hiển thị' : 'Đang tắt'}</span>
        </header>
        <div class="seasonal-admin__grid">
          <div class="seasonal-field"><label>Chế độ</label>${seg('mode', [['auto', 'Tự động theo ngày'], ['on', 'Luôn bật'], ['off', 'Tắt']])}
            <small>Tự động: chỉ chạy trong khoảng ngày bên dưới, hết mùa tự tắt, năm sau tự bật lại.</small></div>
          <div class="seasonal-field"><label>Khoảng ngày (hằng năm)</label>
            <div class="seasonal-dates"><input type="text" id="snFrom" class="input-premium" value="${md(c.from)}" maxlength="5" placeholder="01/12" aria-label="Từ ngày dd/mm"><span>→</span><input type="text" id="snTo" class="input-premium" value="${md(c.to)}" maxlength="5" placeholder="05/01" aria-label="Đến ngày dd/mm"></div>
            <small>Định dạng ngày/tháng. Có thể vắt qua năm mới (vd 01/12 → 05/01).</small></div>
          <div class="seasonal-field"><label>Mật độ tuyết</label>${seg('density', [['light', 'Nhẹ'], ['normal', 'Vừa'], ['heavy', 'Dày']])}</div>
          <div class="seasonal-field"><label>Thành phần</label>
            <label class="seasonal-check"><input type="checkbox" id="snSnow" ${c.snow ? 'checked' : ''}><span>Tuyết rơi</span></label>
            <label class="seasonal-check"><input type="checkbox" id="snGreet" ${c.greeting ? 'checked' : ''}><span>Lời chúc ở banner</span></label></div>
          <div class="seasonal-field seasonal-field--wide"><label for="snMsg">Nội dung lời chúc</label><input type="text" id="snMsg" class="input-premium" maxlength="80" value="${String(c.message).replace(/"/g, '&quot;')}"></div>
        </div>
        <div class="seasonal-admin__actions">
          <button type="button" class="btn-premium" onclick="HomeSeasonal.save()" style="width:auto!important;padding:0 20px;height:42px;font-size:13px"><span>Lưu cấu hình</span></button>
          <button type="button" class="btn-premium btn-secondary" onclick="switchWorkspaceTab('home')" style="width:auto!important;padding:0 20px;height:42px;font-size:13px"><span>Xem thử ở Trang chủ</span></button>
        </div>
      </section>`;
  }
  function parseDM(text) {
    const m = String(text || '').trim().match(/^(\d{1,2})[\/-](\d{1,2})$/); if (!m) return null;
    const d = Number(m[1]), mo = Number(m[2]); if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }
  async function save() {
    const get = n => document.querySelector(`input[name="sn_${n}"]:checked`)?.value;
    const from = parseDM(document.getElementById('snFrom')?.value), to = parseDM(document.getElementById('snTo')?.value);
    if (!from || !to) { triggerToast('Ngày không hợp lệ. Nhập dạng ngày/tháng, ví dụ 01/12.', 'warning'); return; }
    const next = sanitize({mode: get('mode'), density: get('density'), from, to, snow: !!document.getElementById('snSnow')?.checked, greeting: !!document.getElementById('snGreet')?.checked, message: document.getElementById('snMsg')?.value.trim()});
    try {
      if (!dbNodeInstance) throw new Error('offline');
      await dbNodeInstance.ref('settings/seasonal').set({...next, updatedAt: Date.now(), updatedBy: (typeof activeUserProfile !== 'undefined' && activeUserProfile?.email) || ''});
    } catch (_) { triggerToast('Không lưu được lên hệ thống. Kiểm tra mạng hoặc quyền ghi.', 'error'); return; }
    cfg = next; try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (_) { /* bỏ qua */ }
    if (typeof logUserActivity === 'function') logUserActivity('SYSTEM_SETTING', 'Cập nhật hiệu ứng mùa lễ (' + next.mode + ', ' + next.from + ' → ' + next.to + ')');
    triggerToast('Đã lưu cấu hình hiệu ứng mùa lễ.', 'success');
    const state = document.getElementById('snState'); if (state) { const on = isActive(); state.textContent = on ? 'Đang hiển thị' : 'Đang tắt'; state.classList.toggle('is-on', on); }
  }

  return {mount, badge, isActive, renderAdmin, save, toggleMute, stop, sanitize, inSeason, parseDM, get config() { return cfg; }};
})();
window.HomeSeasonal = HomeSeasonal;
