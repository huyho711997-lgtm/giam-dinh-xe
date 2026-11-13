// ==========================================================================
// GOOGLE DRIVE – bộ xem riêng cho từng loại tệp (ảnh · video · âm thanh · bảng tính · văn bản).
// PDF / Word / tệp Google vẫn dùng trình xem tài liệu (SharedFormsViewer) vì cần dàn trang và in.
// Module không gọi mạng trực tiếp: trang Drive truyền hàm load(file, signal) → {bytes, mimeType}.
// ==========================================================================
const DriveViewer = (() => {
  const CACHE_LIMIT = 4, TEXT_MAX = 1.5 * 1024 * 1024, SHEET_ROWS = 5000, SHEET_COLS = 100, SHEET_CHUNK = 300;
  const ZOOM_MIN = 0.05, ZOOM_MAX = 8;
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
  function zoomAt(state, nextScale, px, py) {
    const scale = clamp(nextScale, ZOOM_MIN, ZOOM_MAX), ratio = scale / state.scale;
    return {scale, x:px - (px - state.x) * ratio, y:py - (py - state.y) * ratio};
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
  let current = null;
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
    releaseItem(state);
    state.resize?.disconnect();
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
      </div>
      <footer class="drv-v-foot" data-v-foot hidden></footer>`;
    const state = current = {overlay, options, files, index:files.findIndex(item => item.id === file.id), urls:[], overflow:document.body.style.overflow, previousFocus:document.activeElement,
      stage:overlay.querySelector('[data-v-stage]'), tools:overlay.querySelector('[data-v-tools]'), foot:overlay.querySelector('[data-v-foot]')};
    overlay.querySelector('[data-v-close]').onclick = close;
    overlay.querySelector('[data-v-prev]').onclick = () => step(state, -1);
    overlay.querySelector('[data-v-next]').onclick = () => step(state, 1);
    overlay.querySelector('[data-v-download]').onclick = () => options.onDownload?.(state.files[state.index]);
    overlay.addEventListener('cancel', event => { event.preventDefault(); close(); });
    overlay.addEventListener('close', () => { if (current === state) close(); });
    overlay.addEventListener('keydown', event => onKey(state, event));
    document.body.appendChild(overlay);
    overlay.showModal();
    document.body.style.overflow = 'hidden';
    overlay.querySelector('[data-v-close]').focus();
    show(state);
  }
  const kindOf = (options, file) => { const kind = options.kindOf ? options.kindOf(file) : ''; return LABELS[kind] ? kind : ''; };

  function onKey(state, event) {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.target.closest('input,textarea,select')) return;
    const media = event.target.closest('video,audio');
    if (!media && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (event.key === 'ArrowLeft') { event.preventDefault(); step(state, -1); return; }
      if (event.key === 'ArrowRight') { event.preventDefault(); step(state, 1); return; }
    }
    state.keys?.(event);
  }
  function step(state, delta) {
    const next = state.index + delta;
    if (current !== state || next < 0 || next >= state.files.length) return;
    state.index = next;
    show(state);
  }

  // ---- Hiển thị một tệp -------------------------------------------------------------------
  async function show(state) {
    releaseItem(state);
    const file = state.files[state.index], kind = kindOf(state.options, file) || 'text';
    const controller = state.controller = new AbortController();
    const overlay = state.overlay, format = state.options.format || {};
    overlay.dataset.kind = kind;
    overlay.setAttribute('aria-label', 'Xem tệp: ' + file.name);
    overlay.querySelector('[data-v-badge]').innerHTML = icon(kind);
    overlay.querySelector('[data-v-eyebrow]').textContent = LABELS[kind];
    overlay.querySelector('[data-v-name]').textContent = file.name;
    state.baseMeta = [format.size ? format.size(file) : '', format.date ? format.date(file) : '', state.files.length > 1 ? (state.index + 1) + ' / ' + state.files.length : ''].filter(Boolean);
    setMeta(state);
    const drive = overlay.querySelector('[data-v-drive]');
    drive.hidden = !file.webViewLink;
    if (file.webViewLink) drive.href = file.webViewLink;
    overlay.querySelector('[data-v-prev]').hidden = state.index <= 0;
    overlay.querySelector('[data-v-next]').hidden = state.index >= state.files.length - 1;
    state.tools.innerHTML = '';
    state.foot.hidden = true; state.foot.innerHTML = '';
    const thumb = kind === 'image' ? state.options.thumb?.(file) : '';
    state.stage.className = 'drv-v-stage';
    state.stage.innerHTML = `<div class="drv-v-loading">${thumb ? `<img class="drv-v-placeholder" src="${esc(thumb)}" alt="">` : ''}<span class="drv-v-loading-chip"><span class="drv-spinner" aria-hidden="true"></span> Đang tải “${esc(file.name)}”…</span></div>`;
    try {
      const data = await fetchBytes(state, file, controller.signal);
      if (current !== state || state.controller !== controller) return;
      await RENDER[kind](state, file, data);
      if (current !== state || state.controller !== controller) return;
      // Nạp sẵn ảnh kế tiếp để bấm → là có ngay.
      const next = state.files[state.index + 1];
      if (kind === 'image' && next && kindOf(state.options, next) === 'image') fetchBytes(state, next).catch(() => {});
    } catch (error) {
      if (current !== state || state.controller !== controller || error.name === 'AbortError') return;
      showError(state, file, error.message || 'Chưa mở được tệp này.');
    }
  }
  function setMeta(state, extra) {
    state.overlay.querySelector('[data-v-meta]').textContent = state.baseMeta.concat(extra || []).join(' · ');
  }
  function showError(state, file, message) {
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
    // ---- Ảnh: phóng to/thu nhỏ quanh con trỏ, kéo để di chuyển, xoay, vừa khung / 100% ----
    async image(state, file, data) {
      const img = new Image();
      img.alt = file.name; img.draggable = false; img.className = 'drv-v-image';
      img.src = blobUrl(state, data, file, 'image/jpeg');
      try { await img.decode(); } catch (_) { throw new Error('Trình duyệt không hiển thị được định dạng ảnh này. Hãy tải về hoặc mở trên Google Drive.'); }
      if (current !== state || state.files[state.index] !== file) return;
      const stage = state.stage;
      stage.className = 'drv-v-stage is-image';
      stage.replaceChildren(img);
      const view = {scale:1, x:0, y:0, rotation:0, fitted:true};
      const box = () => ({w:stage.clientWidth - 32, h:stage.clientHeight - 32});
      const fit = () => fitScale(img.naturalWidth, img.naturalHeight, box().w, box().h, view.rotation);
      const zoomLabel = document.createElement('span');
      zoomLabel.className = 'drv-v-zoom';
      const apply = () => {
        img.style.transform = `translate(-50%,-50%) translate(${view.x}px,${view.y}px) rotate(${view.rotation}deg) scale(${view.scale})`;
        zoomLabel.textContent = Math.round(view.scale * 100) + '%';
        stage.classList.toggle('can-pan', view.scale > fit() + 0.001);
      };
      const toFit = () => { Object.assign(view, {scale:fit(), x:0, y:0, fitted:true}); apply(); };
      const zoom = (factor, px = 0, py = 0) => { Object.assign(view, zoomAt(view, view.scale * factor, px, py), {fitted:false}); apply(); };
      const actual = () => { Object.assign(view, {scale:1, x:0, y:0, fitted:false}); apply(); };
      const rotate = () => { view.rotation = (view.rotation + 90) % 360; toFit(); };
      tool(state, 'zoomOut', 'Thu nhỏ', 'Thu nhỏ (−)', () => zoom(1 / 1.25));
      state.tools.appendChild(zoomLabel);
      tool(state, 'zoomIn', 'Phóng to', 'Phóng to (+)', () => zoom(1.25));
      tool(state, 'fit', 'Vừa khung', 'Vừa khung (0)', toFit);
      tool(state, 'rotate', 'Xoay 90°', 'Xoay 90° (R)', rotate);
      setMeta(state, [img.naturalWidth + ' × ' + img.naturalHeight + ' px']);
      const center = event => { const rect = stage.getBoundingClientRect(); return {x:event.clientX - rect.left - rect.width / 2, y:event.clientY - rect.top - rect.height / 2}; };
      stage.onwheel = event => { event.preventDefault(); const p = center(event); zoom(event.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y); };
      stage.ondblclick = event => { if (view.fitted) { const p = center(event); Object.assign(view, zoomAt(view, Math.max(1, view.scale * 2), p.x, p.y), {fitted:false}); apply(); } else toFit(); };
      let drag = null;
      stage.onpointerdown = event => { if (event.button !== 0) return; drag = {x:event.clientX - view.x, y:event.clientY - view.y}; stage.setPointerCapture(event.pointerId); stage.classList.add('is-dragging'); };
      stage.onpointermove = event => { if (!drag) return; view.x = event.clientX - drag.x; view.y = event.clientY - drag.y; view.fitted = false; apply(); };
      stage.onpointerup = stage.onpointercancel = () => { drag = null; stage.classList.remove('is-dragging'); };
      state.resize?.disconnect();
      state.resize = new ResizeObserver(() => { if (view.fitted) toFit(); });
      state.resize.observe(stage);
      state.keys = event => {
        if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.25); }
        else if (event.key === '-') { event.preventDefault(); zoom(1 / 1.25); }
        else if (event.key === '0') { event.preventDefault(); toFit(); }
        else if (event.key === '1') { event.preventDefault(); actual(); }
        else if (event.key.toLowerCase() === 'r') { event.preventDefault(); rotate(); }
      };
      state.cleanup = () => { stage.onwheel = stage.ondblclick = stage.onpointerdown = stage.onpointermove = stage.onpointerup = stage.onpointercancel = null; state.resize?.disconnect(); state.resize = null; };
      toFit();
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

  return {open, close, isOpen:() => !!current, clearCache:() => cache.clear(), fitScale, zoomAt, mergeMap, columnName, decodeText};
})();
