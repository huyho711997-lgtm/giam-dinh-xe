// ==========================================================================
// GOOGLE DRIVE – bộ xem riêng cho từng loại tệp (ảnh · video · âm thanh · bảng tính · văn bản).
// PDF / Word / tệp Google vẫn dùng trình xem tài liệu (SharedFormsViewer) vì cần dàn trang và in.
// Module không gọi mạng trực tiếp: trang Drive truyền hàm load(file, signal) → {bytes, mimeType}.
//
// Trình xem ảnh: chuyển động theo vòng lặp requestAnimationFrame (làm mượt theo thời gian, không giật khi
// cuộn/phóng), kéo có quán tính + kéo giãn ở mép, chụm hai ngón, nhấp đúp, vuốt để chuyển ảnh, hiện ngay
// ảnh nhỏ trong lúc tải ảnh gốc, dải ảnh nhỏ phía dưới, giao diện kính mờ tự ẩn khi không thao tác.
// ==========================================================================
const DriveViewer = (() => {
  const CACHE_LIMIT = 5, TEXT_MAX = 1.5 * 1024 * 1024, SHEET_ROWS = 5000, SHEET_COLS = 100, SHEET_CHUNK = 300;
  const ZOOM_MIN = 0.05, ZOOM_MAX = 8, IDLE_MS = 2800;
  const LABELS = {image:'XEM ẢNH', video:'XEM VIDEO', audio:'NGHE ÂM THANH', sheet:'XEM BẢNG TÍNH', text:'XEM VĂN BẢN'};
  const ICONS = {
    close:'<path d="M6 6l12 12M18 6 6 18"/>',
    download:'<path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14"/>',
    external:'<path d="M14 5h5v5M19 5l-8 8M11 6H6v12h12v-5"/>',
    prev:'<path d="m15 5-7 7 7 7"/>',
    next:'<path d="m9 5 7 7-7 7"/>',
    zoomIn:'<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2M11 8.5v5M8.5 11h5"/>',
    zoomOut:'<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2M8.5 11h5"/>',
    fit:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    rotate:'<path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/>',
    rotateLeft:'<path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5"/>',
    fullscreen:'<path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8v.01"/>',
    wrap:'<path d="M4 6h16M4 12h12a3 3 0 0 1 0 6h-3m0 0 2-2m-2 2 2 2M4 18h5"/>',
    copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    print:'<path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2M7 14h10v6H7Z"/>',
    refresh:'<path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/>',
    alert:'<path d="M12 4 2.5 20h19ZM12 10v4m0 3v.01"/>',
    image:'<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-4.5 3.5 3 3-2.5 4.5 4"/>',
    video:'<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10.5 5-3v9l-5-3Z"/>',
    audio:'<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    sheet:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16"/>',
    text:'<path d="M7 3h7l4 4v14H7ZM14 3v4h4M10 12h5M10 16h5"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[ch]);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  // ---- Hàm thuần (có kiểm thử) -------------------------------------------------------------
  // Tỷ lệ để ảnh nằm trọn trong khung (không phóng to quá kích thước thật); xoay 90°/270° thì đổi chiều.
  function fitScale(width, height, boxWidth, boxHeight, rotation) {
    const turned = Math.abs(rotation / 90) % 2 === 1;
    const w = turned ? height : width, h = turned ? width : height;
    if (!(w > 0 && h > 0 && boxWidth > 0 && boxHeight > 0)) return 1;
    return Math.min(1, boxWidth / w, boxHeight / h);
  }
  // Phóng to/thu nhỏ quanh điểm con trỏ (tọa độ tính từ tâm khung) để điểm đó đứng yên.
  function zoomAt(state, nextScale, px, py, min = ZOOM_MIN, max = ZOOM_MAX) {
    const scale = clamp(nextScale, min, max), ratio = scale / state.scale;
    return {scale, x:px - (px - state.x) * ratio, y:py - (py - state.y) * ratio};
  }
  // Biên kéo ảnh: ảnh nhỏ hơn khung thì đứng yên giữa khung; lớn hơn thì kéo được tới khi mép chạm mép khung.
  function panBounds(width, height, scale, rotation, boxWidth, boxHeight) {
    const turned = Math.abs(rotation / 90) % 2 === 1;
    const w = (turned ? height : width) * scale, h = (turned ? width : height) * scale;
    return {bx:Math.max(0, (w - boxWidth) / 2), by:Math.max(0, (h - boxHeight) / 2)};
  }
  // Kéo vượt biên thì bị "níu" lại (cảm giác đàn hồi như trình xem ảnh trên điện thoại).
  function rubber(value, min, max, resistance = 0.35) {
    if (value > max) return max + (value - max) * resistance;
    if (value < min) return min + (value - min) * resistance;
    return value;
  }
  // Bản đồ ô gộp: ô gốc → {rowSpan, colSpan}; ô bị che → true (đã cắt theo vùng hiển thị).
  function mergeMap(merges, maxRow, maxCol) {
    const spans = new Map(), covered = new Set();
    (merges || []).forEach(merge => {
      const r0 = merge.s.r, c0 = merge.s.c, r1 = Math.min(merge.e.r, maxRow), c1 = Math.min(merge.e.c, maxCol);
      if (r0 > maxRow || c0 > maxCol || (r1 === r0 && c1 === c0)) return;
      spans.set(r0 + ':' + c0, {rowSpan:r1 - r0 + 1, colSpan:c1 - c0 + 1});
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (r !== r0 || c !== c0) covered.add(r + ':' + c);
    });
    return {spans, covered};
  }
  function columnName(index) {
    let name = '';
    for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name;
    return name;
  }
  function decodeText(bytes, name) {
    const truncated = bytes.byteLength > TEXT_MAX;
    let text = new TextDecoder('utf-8').decode(truncated ? bytes.subarray(0, TEXT_MAX) : bytes).replace(/^﻿/, '');
    let pretty = false;
    if (!truncated && /\.json$/i.test(name || '')) { try { text = JSON.stringify(JSON.parse(text), null, 2); pretty = true; } catch (_) {} }
    return {text, truncated, pretty, lines:text ? text.split('\n').length : 0};
  }

  // ---- Trạng thái ------------------------------------------------------------------------
  let current = null, hintShown = false;
  const cache = new Map(); // id → Promise<{bytes, mimeType}>

  function fetchBytes(state, file, signal) {
    if (cache.has(file.id)) { const hit = cache.get(file.id); cache.delete(file.id); cache.set(file.id, hit); return hit; }
    const pending = Promise.resolve().then(() => state.options.load(file, signal)).catch(error => { cache.delete(file.id); throw error; });
    cache.set(file.id, pending);
    while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
    return pending;
  }

  function close() {
    if (!current) return;
    const state = current;
    current = null;
    clearTimeout(state.idleTimer);
    releaseItem(state);
    purgeWraps(state);
    state.resize?.disconnect();
    if (document.fullscreenElement === state.overlay) document.exitFullscreen?.().catch(() => {});
    state.overlay.remove();
    document.body.style.overflow = state.overflow;
    if (state.previousFocus?.isConnected) state.previousFocus.focus({preventScroll:true});
  }
  function releaseItem(state) {
    state.controller?.abort();
    state.urls.forEach(url => URL.revokeObjectURL(url));
    state.urls = [];
    state.cleanup?.();
    state.cleanup = null;
    state.keys = null;
    state.view = null;
  }

  // ---- Lớp ảnh trên sân khấu (giữ ảnh cũ mờ dần trong lúc ảnh mới hiện ra) -----------------
  function dropWrap(wrap, delay = 260) {
    if (wrap._dropping) return;
    wrap._dropping = true;
    wrap.classList.add('is-leaving');
    setTimeout(() => { if (wrap._url) URL.revokeObjectURL(wrap._url); wrap.remove(); }, delay);
  }
  const retireWraps = stage => stage.querySelectorAll('.drv-v-img-wrap').forEach(wrap => dropWrap(wrap, wrap.classList.contains('is-preview') ? 340 : 260));
  function purgeWraps(state) {
    state.stage.querySelectorAll('.drv-v-img-wrap').forEach(wrap => { wrap._dropping = true; if (wrap._url) URL.revokeObjectURL(wrap._url); wrap.remove(); });
  }
  // Khung hiển thị ảnh: chừa chỗ cho thanh tên phía trên và dải công cụ + ảnh nhỏ phía dưới.
  function metrics(state) {
    const W = state.stage.clientWidth, H = state.stage.clientHeight, top = 68, bottom = state.hasStrip ? 156 : 96, side = 32;
    return {W, H, w:Math.max(80, W - side * 2), h:Math.max(80, H - top - bottom), homeY:(top - bottom) / 2};
  }
  // Ảnh nhỏ (đã có sẵn từ danh sách) hiện ngay ở đúng chỗ; ảnh gốc sẽ hòa vào khi tải xong.
  function placePreview(state, file) {
    const stage = state.stage, thumb = state.options.thumb?.(file);
    if (!thumb) return;
    retireWraps(stage);
    const token = state.controller, wrap = document.createElement('div'), img = new Image();
    wrap.className = 'drv-v-img-wrap is-preview';
    img.className = 'drv-v-preview'; img.alt = ''; img.draggable = false;
    img.onload = () => {
      if (current !== state || state.controller !== token || !img.naturalWidth) return;
      const m = metrics(state), s = Math.min(m.w / img.naturalWidth, m.h / img.naturalHeight), w = img.naturalWidth * s, h = img.naturalHeight * s;
      img.style.cssText = `width:${w}px;height:${h}px;margin:${-h / 2}px 0 0 ${-w / 2}px;transform:translate3d(0,${m.homeY}px,0)`;
      wrap.classList.add('is-ready');
    };
    img.src = thumb;
    wrap.appendChild(img);
    stage.appendChild(wrap);
  }

  // ---- Dải ảnh nhỏ -----------------------------------------------------------------------
  function buildStrip(state) {
    const strip = state.strip, indexes = state.files.map((_, i) => i).filter(i => kindOf(state.options, state.files[i]) === 'image');
    strip.replaceChildren();
    state.hasStrip = indexes.length > 1;
    strip.hidden = !state.hasStrip;
    if (!state.hasStrip) return;
    indexes.forEach(i => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'drv-v-thumb'; button.dataset.vGo = String(i);
      button.title = state.files[i].name; button.setAttribute('aria-label', state.files[i].name);
      strip.appendChild(button);
    });
    strip.onclick = event => { const button = event.target.closest('[data-v-go]'); if (button) goTo(state, Number(button.dataset.vGo)); };
    strip.onwheel = event => { if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) { event.preventDefault(); strip.scrollLeft += event.deltaY; } };
  }
  function refreshStrip(state, center = true) {
    if (!state.hasStrip) return;
    const strip = state.strip;
    strip.querySelectorAll('.drv-v-thumb').forEach(button => {
      const index = Number(button.dataset.vGo);
      button.classList.toggle('is-current', index === state.index);
      if (!button.firstChild) {
        const url = state.options.thumb?.(state.files[index]);
        if (url) { const img = new Image(); img.src = url; img.alt = ''; img.draggable = false; button.appendChild(img); }
      }
    });
    const currentButton = strip.querySelector('.is-current');
    if (currentButton && center) strip.scrollTo({left:currentButton.offsetLeft - (strip.clientWidth - currentButton.offsetWidth) / 2, behavior:'smooth'});
  }
  // Xin ảnh nhỏ cho các ảnh quanh vị trí hiện tại (gần trước, xa sau).
  function wantThumbs(state) {
    if (!state.hasStrip || !state.options.fetchThumbs) return;
    const ids = [];
    for (let d = 0; d <= 12 && ids.length < 18; d++) for (const i of d ? [state.index + d, state.index - d] : [state.index]) {
      const file = state.files[i];
      if (file && kindOf(state.options, file) === 'image' && !state.options.thumb?.(file) && !ids.includes(file.id)) ids.push(file.id);
    }
    if (ids.length) Promise.resolve(state.options.fetchThumbs(ids)).then(() => { if (current === state) refreshStrip(state, false); }).catch(() => {});
  }

  // ---- Bảng thông tin ----------------------------------------------------------------------
  function renderInfo(state) {
    const file = state.files[state.index];
    const rows = (state.options.details?.(file) || []).concat(state.dims ? [['Kích thước ảnh', state.dims[0] + ' × ' + state.dims[1] + ' px']] : []).filter(row => row[1]);
    state.info.innerHTML = `<div class="drv-v-info-head"><strong>Thông tin ảnh</strong><button type="button" class="drv-v-info-close" data-v-info-close aria-label="Đóng thông tin">${icon('close')}</button></div><dl>${rows.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
    state.info.querySelector('[data-v-info-close]').onclick = () => toggleInfo(state, false);
  }
  function toggleInfo(state, force) {
    const open = force == null ? !state.info.classList.contains('is-open') : force;
    state.info.classList.toggle('is-open', open);
    const button = state.overlay.querySelector('[data-v-act="info"]');
    button.classList.toggle('is-on', open); button.setAttribute('aria-pressed', String(open));
    if (open) renderInfo(state);
  }
  function toggleFullscreen(state) {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else state.overlay.requestFullscreen?.().catch(() => {});
  }
  function showHint(state) {
    if (hintShown) return;
    hintShown = true;
    const parts = ['Cuộn để thu phóng', 'Nhấp đúp để phóng to', 'Kéo để di chuyển'].concat(state.hasStrip ? ['← → chuyển ảnh'] : []);
    state.hint.innerHTML = parts.map(text => `<span>${text}</span>`).join('<i></i>');
    state.hint.classList.add('is-show');
    setTimeout(() => state.hint.classList.remove('is-show'), 4200);
  }
  function setStatus(state, text) {
    state.status.hidden = !text;
    if (text) state.status.querySelector('[data-v-status-text]').textContent = text;
  }
  // Ẩn thanh công cụ khi không thao tác (chỉ với ảnh) – di chuột / bấm phím là hiện lại.
  function wake(state) {
    const overlay = state.overlay;
    overlay.classList.remove('is-idle');
    clearTimeout(state.idleTimer);
    if (overlay.dataset.kind !== 'image') return;
    state.idleTimer = setTimeout(() => {
      let hovering = false;
      try { hovering = overlay.matches(':has(.drv-v-head:hover,.drv-v-pill:hover,.drv-v-strip:hover,.drv-v-nav:hover,.drv-v-info:hover)'); } catch (_) {}
      if (current === state && !hovering) overlay.classList.add('is-idle');
    }, IDLE_MS);
  }

  function open(file, options = {}) {
    close();
    const list = (options.files || []).filter(item => kindOf(options, item));
    const files = list.some(item => item.id === file.id) ? list : [file];
    const overlay = document.createElement('dialog');
    overlay.className = 'sf-viewer drv-viewer';
    overlay.innerHTML = `
      <header class="drv-v-head">
        <span class="drv-v-badge" data-v-badge></span>
        <div class="drv-v-title"><span class="sf-eyebrow" data-v-eyebrow></span><strong data-v-name></strong><small data-v-meta></small></div>
        <div class="drv-v-tools" data-v-tools></div>
        <div class="drv-v-actions">
          <button type="button" class="sf-button" data-v-download>${icon('download')} Tải về</button>
          <a class="sf-button" data-v-drive target="_blank" rel="noopener noreferrer">${icon('external')} Mở trên Drive</a>
          <button type="button" class="sf-icon-button" data-v-close aria-label="Đóng trình xem" title="Đóng (Esc)">${icon('close')}</button>
        </div>
      </header>
      <div class="drv-v-body">
        <button type="button" class="drv-v-nav is-prev" data-v-prev aria-label="Tệp trước" title="Tệp trước (←)">${icon('prev')}</button>
        <div class="drv-v-stage" data-v-stage></div>
        <button type="button" class="drv-v-nav is-next" data-v-next aria-label="Tệp sau" title="Tệp sau (→)">${icon('next')}</button>
        <div class="drv-v-layer">
          <div class="drv-v-status" data-v-status hidden><span class="drv-spinner" aria-hidden="true"></span><span data-v-status-text></span></div>
          <aside class="drv-v-info" data-v-info aria-label="Thông tin ảnh"></aside>
          <div class="drv-v-hint" data-v-hint aria-hidden="true"></div>
          <div class="drv-v-dock"><div class="drv-v-pill" role="toolbar" aria-label="Công cụ ảnh">
            <button type="button" data-v-act="zoomOut" aria-label="Thu nhỏ" title="Thu nhỏ (−)">${icon('zoomOut')}</button>
            <button type="button" class="drv-v-pct" data-v-act="actual" aria-label="Đổi giữa vừa khung và kích thước thật" title="Vừa khung / 100% (1)">100%</button>
            <button type="button" data-v-act="zoomIn" aria-label="Phóng to" title="Phóng to (+)">${icon('zoomIn')}</button>
            <span class="drv-v-sep"></span>
            <button type="button" data-v-act="rotateLeft" aria-label="Xoay trái" title="Xoay trái (Shift+R)">${icon('rotateLeft')}</button>
            <button type="button" data-v-act="rotate" aria-label="Xoay phải" title="Xoay phải (R)">${icon('rotate')}</button>
            <button type="button" data-v-act="fit" aria-label="Vừa khung" title="Vừa khung (0)">${icon('fit')}</button>
            <span class="drv-v-sep"></span>
            <button type="button" data-v-act="info" aria-label="Thông tin" aria-pressed="false" title="Thông tin (I)">${icon('info')}</button>
            <button type="button" data-v-act="fullscreen" aria-label="Toàn màn hình" title="Toàn màn hình (F)">${icon('fullscreen')}</button>
          </div></div>
          <div class="drv-v-strip" data-v-strip hidden></div>
        </div>
      </div>
      <footer class="drv-v-foot" data-v-foot hidden></footer>`;
    const q = selector => overlay.querySelector(selector);
    const state = current = {overlay, options, files, index:files.findIndex(item => item.id === file.id), urls:[], dir:0, overflow:document.body.style.overflow, previousFocus:document.activeElement,
      stage:q('[data-v-stage]'), tools:q('[data-v-tools]'), foot:q('[data-v-foot]'), strip:q('[data-v-strip]'), info:q('[data-v-info]'), hint:q('[data-v-hint]'), status:q('[data-v-status]'), pct:q('.drv-v-pct')};
    q('[data-v-close]').onclick = close;
    q('[data-v-prev]').onclick = () => step(state, -1);
    q('[data-v-next]').onclick = () => step(state, 1);
    q('[data-v-download]').onclick = () => options.onDownload?.(state.files[state.index]);
    q('.drv-v-pill').onclick = event => {
      const button = event.target.closest('[data-v-act]');
      if (!button) return;
      const act = button.dataset.vAct;
      if (act === 'info') toggleInfo(state);
      else if (act === 'fullscreen') toggleFullscreen(state);
      else state.view?.[act]?.();
    };
    ['pointermove', 'pointerdown', 'keydown'].forEach(name => overlay.addEventListener(name, () => wake(state)));
    overlay.addEventListener('cancel', event => { event.preventDefault(); close(); });
    overlay.addEventListener('close', () => { if (current === state) close(); });
    overlay.addEventListener('keydown', event => onKey(state, event));
    buildStrip(state);
    document.body.appendChild(overlay);
    overlay.showModal();
    document.body.style.overflow = 'hidden';
    q('[data-v-close]').focus({preventScroll:true});
    show(state);
  }
  const kindOf = (options, file) => { const kind = options.kindOf ? options.kindOf(file) : ''; return LABELS[kind] ? kind : ''; };

  function onKey(state, event) {
    event.stopPropagation();
    if (event.key === 'Escape') { if (document.fullscreenElement) return; event.preventDefault(); close(); return; }
    if (event.target.closest('input,textarea,select')) return;
    const media = event.target.closest('video,audio');
    if (!media && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (event.key === 'ArrowLeft') { event.preventDefault(); step(state, -1); return; }
      if (event.key === 'ArrowRight') { event.preventDefault(); step(state, 1); return; }
      if (event.key === 'Home') { event.preventDefault(); goTo(state, 0); return; }
      if (event.key === 'End') { event.preventDefault(); goTo(state, state.files.length - 1); return; }
      if (state.overlay.dataset.kind === 'image') {
        if (event.key.toLowerCase() === 'f') { event.preventDefault(); toggleFullscreen(state); return; }
        if (event.key.toLowerCase() === 'i') { event.preventDefault(); toggleInfo(state); return; }
      }
    }
    state.keys?.(event);
  }
  function goTo(state, index) {
    if (current !== state || index < 0 || index >= state.files.length || index === state.index) return;
    state.dir = index > state.index ? 1 : -1;
    state.index = index;
    show(state);
  }
  const step = (state, delta) => goTo(state, state.index + delta);

  // ---- Hiển thị một tệp -------------------------------------------------------------------
  async function show(state) {
    releaseItem(state);
    const file = state.files[state.index], kind = kindOf(state.options, file) || 'text';
    const controller = state.controller = new AbortController();
    const overlay = state.overlay, format = state.options.format || {}, stage = state.stage;
    overlay.dataset.kind = kind;
    overlay.style.setProperty('--dir', String(state.dir || 0));
    overlay.setAttribute('aria-label', 'Xem tệp: ' + file.name);
    overlay.querySelector('[data-v-badge]').innerHTML = icon(kind);
    overlay.querySelector('[data-v-eyebrow]').textContent = LABELS[kind];
    overlay.querySelector('[data-v-name]').textContent = file.name;
    state.dims = null;
    state.baseMeta = [format.size ? format.size(file) : '', format.date ? format.date(file) : '', state.files.length > 1 ? (state.index + 1) + ' / ' + state.files.length : ''].filter(Boolean);
    setMeta(state);
    const drive = overlay.querySelector('[data-v-drive]');
    drive.hidden = !file.webViewLink;
    if (file.webViewLink) drive.href = file.webViewLink;
    overlay.querySelector('[data-v-prev]').hidden = state.index <= 0;
    overlay.querySelector('[data-v-next]').hidden = state.index >= state.files.length - 1;
    state.tools.innerHTML = '';
    state.foot.hidden = true; state.foot.innerHTML = '';
    if (kind === 'image') {
      stage.className = 'drv-v-stage is-image';
      if (!stage.querySelector('.drv-v-img-wrap')) stage.replaceChildren();
      placePreview(state, file);
      setStatus(state, 'Đang tải ảnh…');
      refreshStrip(state);
      if (state.info.classList.contains('is-open')) renderInfo(state);
    } else {
      purgeWraps(state);
      setStatus(state, '');
      stage.className = 'drv-v-stage';
      stage.innerHTML = `<div class="drv-v-loading"><span class="drv-v-loading-chip"><span class="drv-spinner" aria-hidden="true"></span> Đang tải “${esc(file.name)}”…</span></div>`;
    }
    wake(state);
    try {
      const data = await fetchBytes(state, file, controller.signal);
      if (current !== state || state.controller !== controller) return;
      await RENDER[kind](state, file, data);
      if (current !== state || state.controller !== controller) return;
      setStatus(state, '');
      if (kind === 'image') {
        showHint(state);
        wantThumbs(state);
        // Nạp sẵn ảnh kế tiếp và ảnh trước để bấm → là có ngay.
        [state.index + 1, state.index - 1].forEach(i => { const near = state.files[i]; if (near && kindOf(state.options, near) === 'image') fetchBytes(state, near).catch(() => {}); });
      }
    } catch (error) {
      if (current !== state || state.controller !== controller || error.name === 'AbortError') return;
      setStatus(state, '');
      showError(state, file, error.message || 'Chưa mở được tệp này.');
    }
  }
  function setMeta(state, extra) {
    state.overlay.querySelector('[data-v-meta]').textContent = state.baseMeta.concat(extra || []).join(' · ');
  }
  function showError(state, file, message) {
    purgeWraps(state);
    state.tools.innerHTML = '';
    state.stage.className = 'drv-v-stage';
    state.stage.innerHTML = `<div class="drv-v-message"><span class="drv-v-message-art">${icon('alert')}</span><strong>Chưa mở được tệp này</strong><p>${esc(message)}</p><div class="drv-v-message-actions"><button type="button" class="sf-button sf-primary" data-v-retry>${icon('refresh')} Thử lại</button>${file.webViewLink ? `<a class="sf-button" href="${esc(file.webViewLink)}" target="_blank" rel="noopener noreferrer">${icon('external')} Mở trên Google Drive</a>` : ''}</div></div>`;
    state.stage.querySelector('[data-v-retry]').onclick = () => { cache.delete(file.id); show(state); };
  }
  function tool(state, name, label, title, handler, text) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = text ? 'sf-button drv-v-tool' : 'sf-icon-button drv-v-tool';
    button.title = title || label;
    button.setAttribute('aria-label', label);
    button.innerHTML = icon(name) + (text ? ' ' + esc(text) : '');
    button.onclick = handler;
    state.tools.appendChild(button);
    return button;
  }
  const blobUrl = (state, data, file, fallback) => { const url = URL.createObjectURL(new Blob([data.bytes], {type:data.mimeType || file.mimeType || fallback})); state.urls.push(url); return url; };

  const RENDER = {
    // ---- Ảnh: vòng lặp chuyển động mượt (phóng/kéo/xoay), quán tính, đàn hồi ở mép, chụm 2 ngón, vuốt chuyển ảnh ----
    async image(state, file, data) {
      const token = state.controller, stage = state.stage;
      const url = URL.createObjectURL(new Blob([data.bytes], {type:data.mimeType || file.mimeType || 'image/jpeg'}));
      const img = new Image();
      img.alt = file.name; img.draggable = false; img.decoding = 'async'; img.className = 'drv-v-image';
      img.src = url;
      try { await img.decode(); } catch (_) { URL.revokeObjectURL(url); throw new Error('Trình duyệt không hiển thị được định dạng ảnh này. Hãy tải về hoặc mở trên Google Drive.'); }
      if (current !== state || state.controller !== token) { URL.revokeObjectURL(url); return; }
      const nw = img.naturalWidth, nh = img.naturalHeight;
      img.style.cssText = `width:${nw}px;height:${nh}px;margin:${-nh / 2}px 0 0 ${-nw / 2}px`;
      const hadPreview = !!stage.querySelector('.drv-v-img-wrap.is-preview:not(.is-leaving)');
      retireWraps(stage);
      const wrap = document.createElement('div');
      wrap.className = 'drv-v-img-wrap' + (hadPreview ? ' is-fade' : '');
      wrap._url = url;
      wrap.appendChild(img);
      stage.appendChild(wrap);
      state.dims = [nw, nh];
      setMeta(state, [nw + ' × ' + nh + ' px']);
      if (state.info.classList.contains('is-open')) renderInfo(state);

      const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      let box = metrics(state), homeY = box.homeY;
      const fit = rotation => fitScale(nw, nh, box.w, box.h, rotation);
      const cur = {s:fit(0), x:0, y:homeY, r:0}, tgt = {...cur};
      const maxScale = () => Math.max(4, fit(tgt.r) * 10);
      const bounds = () => { const b = panBounds(nw, nh, tgt.s, tgt.r, box.w, box.h); return {minX:-b.bx, maxX:b.bx, minY:homeY - b.by, maxY:homeY + b.by}; };
      const clampTarget = () => { const b = bounds(); tgt.x = clamp(tgt.x, b.minX, b.maxX); tgt.y = clamp(tgt.y, b.minY, b.maxY); };
      const isFitted = () => tgt.s <= fit(tgt.r) * 1.02;
      const center = event => { const r = stage.getBoundingClientRect(); return {x:event.clientX - r.left - r.width / 2, y:event.clientY - r.top - r.height / 2}; };

      let lastPct = -1;
      const paint = () => {
        img.style.transform = `translate3d(${cur.x.toFixed(2)}px,${cur.y.toFixed(2)}px,0) rotate(${cur.r.toFixed(2)}deg) scale(${cur.s.toFixed(5)})`;
        const pct = Math.round(cur.s * 100);
        if (pct !== lastPct) { lastPct = pct; state.pct.textContent = pct + '%'; }
        stage.classList.toggle('can-pan', !isFitted());
      };
      // Làm mượt theo thời gian (không phụ thuộc tốc độ khung hình): phóng theo logarit để cảm giác đều ở mọi mức.
      let raf = 0, last = 0;
      const frame = now => {
        raf = 0;
        const dt = last ? Math.min(48, now - last) : 16;
        last = now;
        const k = 1 - Math.exp(-dt / 70), kr = 1 - Math.exp(-dt / 95);
        cur.s = Math.exp(Math.log(cur.s) + (Math.log(tgt.s) - Math.log(cur.s)) * k);
        cur.x += (tgt.x - cur.x) * k; cur.y += (tgt.y - cur.y) * k; cur.r += (tgt.r - cur.r) * kr;
        const done = Math.abs(Math.log(tgt.s / cur.s)) < 0.0004 && Math.abs(tgt.x - cur.x) < 0.15 && Math.abs(tgt.y - cur.y) < 0.15 && Math.abs(tgt.r - cur.r) < 0.05;
        if (done) Object.assign(cur, tgt);
        paint();
        if (done) last = 0; else raf = requestAnimationFrame(frame);
      };
      const go = () => { if (reduce) { Object.assign(cur, tgt); paint(); } else if (!raf) raf = requestAnimationFrame(frame); };
      const snap = () => { Object.assign(cur, tgt); paint(); };

      const toFit = () => { tgt.s = fit(tgt.r); tgt.x = 0; tgt.y = homeY; go(); };
      const zoomTo = (scale, px = 0, py = homeY) => {
        const next = zoomAt({scale:tgt.s, x:tgt.x, y:tgt.y}, clamp(scale, fit(tgt.r), maxScale()), px, py, 0.01, 1000);
        tgt.s = next.scale; tgt.x = next.x; tgt.y = next.y;
        clampTarget(); go();
      };
      const rotate = direction => { tgt.r += direction * 90; tgt.s = fit(tgt.r); tgt.x = 0; tgt.y = homeY; go(); };
      const actual = () => {
        const f = fit(tgt.r);
        if (f < 1 && Math.abs(tgt.s - 1) > 0.02) zoomTo(1);
        else if (tgt.s > f * 1.02) toFit();
        else zoomTo(f * 2.5);
      };
      state.view = {zoomIn:() => zoomTo(tgt.s * 1.4), zoomOut:() => zoomTo(tgt.s / 1.4), fit:toFit, actual, rotate:() => rotate(1), rotateLeft:() => rotate(-1)};
      state.keys = event => {
        const key = event.key;
        if (key === '+' || key === '=') { event.preventDefault(); state.view.zoomIn(); }
        else if (key === '-' || key === '_') { event.preventDefault(); state.view.zoomOut(); }
        else if (key === '0') { event.preventDefault(); toFit(); }
        else if (key === '1') { event.preventDefault(); actual(); }
        else if (key.toLowerCase() === 'r') { event.preventDefault(); rotate(event.shiftKey ? -1 : 1); }
      };

      // Con lăn / bàn di chuột: tỷ lệ theo quãng cuộn → mượt cả với chuột bấm nấc lẫn trackpad; chụm trackpad (Ctrl) nhạy hơn.
      const onWheel = event => {
        event.preventDefault();
        const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * 100 : event.deltaY;
        const p = center(event);
        zoomTo(tgt.s * Math.exp(-delta * (event.ctrlKey ? 0.012 : 0.0016)), p.x, p.y);
      };
      stage.addEventListener('wheel', onWheel, {passive:false});

      const pts = new Map(), dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const mid = (a, b) => { const r = stage.getBoundingClientRect(); return {x:(a.x + b.x) / 2 - r.left - r.width / 2, y:(a.y + b.y) / 2 - r.top - r.height / 2}; };
      let pan = null, pinch = null, moved = 0, samples = [], lastTap = {t:0, x:0, y:0};
      stage.onpointerdown = event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        pts.set(event.pointerId, {x:event.clientX, y:event.clientY});
        try { stage.setPointerCapture(event.pointerId); } catch (_) {}
        if (pts.size === 1) {
          pan = {x:event.clientX, y:event.clientY, ox:tgt.x, oy:tgt.y};
          moved = 0; samples = [{t:event.timeStamp, x:event.clientX, y:event.clientY}];
          snap();
          stage.classList.add('is-dragging');
        } else if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          pinch = {d:dist(a, b), s:tgt.s, x:tgt.x, y:tgt.y, m:mid(a, b)};
          pan = null; snap();
        }
      };
      stage.onpointermove = event => {
        if (!pts.has(event.pointerId)) return;
        pts.set(event.pointerId, {x:event.clientX, y:event.clientY});
        if (pinch && pts.size >= 2) {
          const [a, b] = [...pts.values()], m = mid(a, b);
          const z = zoomAt({scale:pinch.s, x:pinch.x, y:pinch.y}, clamp(pinch.s * dist(a, b) / pinch.d, fit(tgt.r) * 0.85, maxScale()), pinch.m.x, pinch.m.y, 0.01, 1000);
          tgt.s = z.scale; tgt.x = z.x + (m.x - pinch.m.x); tgt.y = z.y + (m.y - pinch.m.y);
          snap();
          return;
        }
        if (!pan) return;
        const dx = event.clientX - pan.x, dy = event.clientY - pan.y, b = bounds();
        moved = Math.max(moved, Math.hypot(dx, dy));
        tgt.x = rubber(pan.ox + dx, b.minX, b.maxX); tgt.y = rubber(pan.oy + dy, b.minY, b.maxY);
        snap();
        samples.push({t:event.timeStamp, x:event.clientX, y:event.clientY});
        while (samples.length > 2 && event.timeStamp - samples[0].t > 120) samples.shift();
      };
      const onUp = event => {
        if (!pts.delete(event.pointerId)) return;
        if (pinch) {
          if (pts.size < 2) {
            pinch = null;
            tgt.s = Math.max(tgt.s, fit(tgt.r)); clampTarget(); go();
            if (pts.size === 1) { const [p] = [...pts.values()]; pan = {x:p.x, y:p.y, ox:tgt.x, oy:tgt.y}; moved = 99; samples = []; }
            else stage.classList.remove('is-dragging');
          }
          return;
        }
        if (!pan) return;
        const start = pan, dx = event.clientX - start.x, dy = event.clientY - start.y, fitted = isFitted();
        pan = null;
        stage.classList.remove('is-dragging');
        if (event.type !== 'pointercancel' && moved < 6) {
          // Chạm / bấm: ngoài ảnh → đóng; hai lần liên tiếp → phóng to / thu về.
          clampTarget(); go();
          const r = img.getBoundingClientRect(), inside = event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
          if (!inside) { close(); return; }
          if (event.timeStamp - lastTap.t < 320 && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 28) {
            lastTap.t = 0;
            const p = center(event);
            if (!isFitted()) toFit(); else zoomTo(Math.max(1, fit(tgt.r) * 2.6), p.x, p.y);
          } else lastTap = {t:event.timeStamp, x:event.clientX, y:event.clientY};
          return;
        }
        if (fitted) {
          const swipe = Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy) * 1.3 && state.files[state.index + (dx < 0 ? 1 : -1)];
          tgt.x = 0; tgt.y = homeY; go();
          if (swipe) step(state, dx < 0 ? 1 : -1);
          return;
        }
        if (samples.length > 1) {
          const a = samples[0], z = samples[samples.length - 1], dt = Math.max(16, z.t - a.t);
          tgt.x += (z.x - a.x) / dt * 260; tgt.y += (z.y - a.y) / dt * 260;
        }
        clampTarget(); go();
      };
      stage.onpointerup = stage.onpointercancel = onUp;

      state.resize?.disconnect();
      state.resize = new ResizeObserver(() => {
        const wasFitted = isFitted();
        box = metrics(state); homeY = box.homeY;
        if (wasFitted) { tgt.s = fit(tgt.r); tgt.x = 0; tgt.y = homeY; snap(); } else { clampTarget(); go(); }
      });
      state.resize.observe(stage);
      state.cleanup = () => {
        cancelAnimationFrame(raf); raf = 0;
        stage.removeEventListener('wheel', onWheel);
        stage.onpointerdown = stage.onpointermove = stage.onpointerup = stage.onpointercancel = null;
        stage.classList.remove('can-pan', 'is-dragging');
        state.resize?.disconnect(); state.resize = null;
      };
      paint();
    },

    // ---- Video / âm thanh: trình phát gốc của trình duyệt ----
    async video(state, file, data) { media(state, file, data, 'video'); },
    async audio(state, file, data) { media(state, file, data, 'audio'); },

    // ---- Bảng tính: thẻ trang tính, tiêu đề cột/dòng cố định, ô gộp, nạp dần khi cuộn ----
    async sheet(state, file, data) {
      if (!window.XLSX) throw new Error('Chưa tải được thư viện Excel. Vui lòng tải lại trang.');
      const book = XLSX.read(data.bytes, {type:'array', cellHTML:false, sheetRows:SHEET_ROWS});
      if (!book.SheetNames.length) throw new Error('Tệp không có trang tính nào.');
      const stage = state.stage;
      stage.className = 'drv-v-stage is-sheet';
      if (state.options.openDocument) tool(state, 'print', 'Bản in', 'Mở bản in của trang tính', () => state.options.openDocument(file), 'Bản in');
      state.foot.hidden = false;
      state.foot.innerHTML = `<div class="drv-v-tabs" role="tablist" aria-label="Trang tính">${book.SheetNames.map((name, i) => `<button type="button" role="tab" class="drv-v-tab" data-v-sheet="${i}">${esc(name)}</button>`).join('')}</div>`;
      const showSheet = index => {
        const name = book.SheetNames[index], sheet = book.Sheets[name];
        state.foot.querySelectorAll('[data-v-sheet]').forEach((tab, i) => { tab.classList.toggle('is-active', i === index); tab.setAttribute('aria-selected', String(i === index)); });
        const full = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref'] || 'A1');
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
        const maxRow = range.e.r, maxCol = Math.min(range.e.c, SHEET_COLS - 1);
        const rows = sheet['!ref'] ? XLSX.utils.sheet_to_json(sheet, {header:1, raw:false, defval:'', blankrows:true, range:{s:{r:0, c:0}, e:{r:maxRow, c:maxCol}}}) : [];
        const {spans, covered} = mergeMap(sheet['!merges'], maxRow, maxCol);
        const head = '<thead><tr><th class="drv-v-corner"></th>' + Array.from({length:maxCol + 1}, (_, c) => `<th>${columnName(c)}</th>`).join('') + '</tr></thead>';
        const rowHtml = r => {
          let html = `<tr><th>${r + 1}</th>`;
          const row = rows[r] || [];
          for (let c = 0; c <= maxCol; c++) {
            if (covered.has(r + ':' + c)) continue;
            const span = spans.get(r + ':' + c), cell = sheet[XLSX.utils.encode_cell({r, c})];
            html += `<td${span ? ` rowspan="${span.rowSpan}" colspan="${span.colSpan}"` : ''}${cell && cell.t === 'n' ? ' class="is-number"' : ''}>${esc(row[c])}</td>`;
          }
          return html + '</tr>';
        };
        stage.innerHTML = rows.length ? `<div class="drv-v-grid-scroll" tabindex="0"><table class="drv-v-grid">${head}<tbody></tbody></table></div>` : `<div class="drv-v-message"><span class="drv-v-message-art">${icon('sheet')}</span><strong>Trang tính trống</strong><p>“${esc(name)}” chưa có dữ liệu.</p></div>`;
        const scroller = stage.querySelector('.drv-v-grid-scroll'), body = stage.querySelector('tbody');
        let rendered = 0;
        const more = () => {
          if (!body || rendered >= rows.length) return;
          const end = Math.min(rows.length, rendered + SHEET_CHUNK);
          let html = '';
          for (let r = rendered; r < end; r++) html += rowHtml(r);
          body.insertAdjacentHTML('beforeend', html);
          rendered = end;
        };
        more();
        if (scroller) scroller.onscroll = () => { if (scroller.scrollTop + scroller.clientHeight > scroller.scrollHeight - 600) more(); };
        const cut = full.e.r > maxRow || range.e.c > maxCol;
        setMeta(state, [(full.e.r + 1).toLocaleString('vi-VN') + ' dòng × ' + (range.e.c + 1) + ' cột' + (cut ? ' (hiển thị tối đa ' + SHEET_ROWS.toLocaleString('vi-VN') + ' dòng, ' + SHEET_COLS + ' cột)' : '')]);
      };
      state.foot.onclick = event => { const tab = event.target.closest('[data-v-sheet]'); if (tab) showSheet(Number(tab.dataset.vSheet)); };
      state.cleanup = () => { state.foot.onclick = null; };
      showSheet(0);
    },

    // ---- Văn bản: số dòng, ngắt dòng, sao chép; JSON tự dàn lại ----
    async text(state, file, data) {
      const result = decodeText(data.bytes, file.name);
      const stage = state.stage;
      stage.className = 'drv-v-stage is-text';
      const numbers = Array.from({length:result.lines}, (_, i) => i + 1).join('\n');
      stage.innerHTML = `<div class="drv-v-code" tabindex="0"><pre class="drv-v-gutter" aria-hidden="true">${numbers}</pre><pre class="drv-v-text"></pre></div>`;
      stage.querySelector('.drv-v-text').textContent = result.text;
      const code = stage.querySelector('.drv-v-code');
      const wrap = tool(state, 'wrap', 'Ngắt dòng', 'Bật/tắt ngắt dòng', () => { const on = code.classList.toggle('is-wrap'); wrap.classList.toggle('is-on', on); wrap.setAttribute('aria-pressed', String(on)); }, 'Ngắt dòng');
      wrap.setAttribute('aria-pressed', 'false');
      tool(state, 'copy', 'Sao chép', 'Sao chép toàn bộ nội dung', async () => {
        try { await navigator.clipboard.writeText(result.text); state.options.toast?.('Đã sao chép nội dung.', 'success'); }
        catch (_) { state.options.toast?.('Trình duyệt chưa cho phép sao chép.', 'warning'); }
      }, 'Sao chép');
      setMeta(state, [result.lines.toLocaleString('vi-VN') + ' dòng' + (result.pretty ? ' · JSON đã dàn lại' : '') + (result.truncated ? ' · chỉ hiện 1,5 MB đầu' : '')]);
    }
  };
  function media(state, file, data, tag) {
    const stage = state.stage;
    stage.className = 'drv-v-stage is-' + tag;
    const player = document.createElement(tag);
    player.controls = true; player.preload = 'metadata';
    player.className = 'drv-v-' + tag;
    player.src = blobUrl(state, data, file, tag === 'video' ? 'video/mp4' : 'audio/mpeg');
    player.onerror = () => { if (current === state && state.files[state.index] === file) showError(state, file, 'Trình duyệt không phát được định dạng này. Hãy tải về hoặc mở trên Google Drive.'); };
    if (tag === 'audio') {
      const card = document.createElement('div');
      card.className = 'drv-v-audio-card';
      card.innerHTML = `<span class="drv-v-audio-art">${icon('audio')}</span><strong></strong>`;
      card.querySelector('strong').textContent = file.name;
      card.appendChild(player);
      stage.replaceChildren(card);
    } else stage.replaceChildren(player);
    state.cleanup = () => { player.onerror = null; player.pause(); player.removeAttribute('src'); player.load(); };
  }

  return {open, close, isOpen:() => !!current, clearCache:() => cache.clear(), fitScale, zoomAt, panBounds, rubber, mergeMap, columnName, decodeText};
})();
