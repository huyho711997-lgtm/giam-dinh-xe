// Bảng "Ký hiệu" tự động trong cột Chú thích của sơ đồ hiện trường.
// Quét các vật thể đã vẽ, mỗi loại một dòng: hình mẫu (vẽ lại bằng chính mã
// vẽ của sơ đồ nên đúng màu/kiểu người dùng đã chọn) + tên gọi.

// Các loại không phải "ký hiệu": chữ, số chú thích, nét tự do, vết xóa.
// Vùng bảng ký hiệu trên canvas lần vẽ gần nhất (null nếu đang ẩn/không có ký hiệu).
var sceneSymbolLegendHitRect = null;

const SCENE_SYMBOL_LEGEND_SKIP_TYPES = ['text', 'number_note', 'pen', 'eraser'];
const SCENE_SYMBOL_LEGEND_HEADER_HEIGHT = 26;
const SCENE_SYMBOL_LEGEND_ICON_W = 36;
const SCENE_SYMBOL_LEGEND_ICON_H = 18;
const SCENE_SYMBOL_LEGEND_NOTES_TOP = 85;       // phần đầu cột (tiêu đề + đường kẻ) trước khi tới chú thích số
const SCENE_SYMBOL_LEGEND_NOTE_ESTIMATE = 40;  // chiều cao ước lượng mỗi chú thích số
const SCENE_SYMBOL_LEGEND_MIN_RATIO = 0.35;
const SCENE_SYMBOL_LEGEND_MAX_RATIO = 0.86;


// Gom các vật thể đã vẽ thành danh sách ký hiệu (mỗi tên gọi một dòng,
// theo thứ tự xuất hiện từ lớp dưới lên). labelOf(shape) trả về tên gọi.
// config (tùy chọn, xem normalizeSceneSymbolLegendConfig): order = thứ tự ưu tiên,
// hidden = các ký hiệu người dùng bỏ chọn, labels = tên do người dùng sửa.
// Khóa (key) của mỗi ký hiệu là tên tự động gốc nên không đổi khi người dùng sửa tên.
// includeHidden = true dùng cho hộp thoại chỉnh sửa (cần thấy cả mục đã ẩn).
function buildSceneSymbolLegendEntries(shapes, labelOf, config, includeHidden) {
  if (!Array.isArray(shapes) || typeof labelOf !== 'function') return [];
  const cfg = normalizeSceneSymbolLegendConfig(config);
  const byKey = new Map();
  shapes.forEach(shape => {
    if (!shape || typeof shape !== 'object') return;
    if (SCENE_SYMBOL_LEGEND_SKIP_TYPES.indexOf(shape.type) !== -1) return;
    const key = String(labelOf(shape) || '').trim();
    if (!key) return;
    const found = byKey.get(key);
    if (found) found.count += 1;
    else byKey.set(key, { key, autoLabel: key, label: cfg.labels[key] || key, sample: shape, count: 1, hidden: cfg.hidden.indexOf(key) !== -1 });
  });
  let entries = Array.from(byKey.values());
  if (!includeHidden) entries = entries.filter(entry => !entry.hidden);
  // Sắp xếp: mục có trong order theo order, còn lại giữ thứ tự xuất hiện (sort ổn định).
  const rank = key => { const i = cfg.order.indexOf(key); return i === -1 ? Infinity : i; };
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const ra = rank(a.entry.key), rb = rank(b.entry.key);
      if (ra !== rb) return ra === Infinity ? 1 : rb === Infinity ? -1 : ra - rb;
      return a.index - b.index;
    })
    .map(item => item.entry);
}


// Làm sạch cấu hình lưu trong templateMeta (dữ liệu có thể đến từ bản lưu cũ/hỏng).
function normalizeSceneSymbolLegendConfig(config) {
  const source = config && typeof config === 'object' ? config : {};
  const cleanList = list => Array.isArray(list)
    ? Array.from(new Set(list.map(v => String(v == null ? '' : v).trim().slice(0, 80)).filter(Boolean))).slice(0, 100)
    : [];
  const labels = {};
  if (source.labels && typeof source.labels === 'object' && !Array.isArray(source.labels)) {
    Object.keys(source.labels).slice(0, 100).forEach(key => {
      const k = String(key).trim().slice(0, 80);
      const v = String(source.labels[key] == null ? '' : source.labels[key]).trim().slice(0, 60);
      if (k && v) labels[k] = v;
    });
  }
  return { hidden: cleanList(source.hidden), order: cleanList(source.order), labels };
}


function getSceneSymbolLegendConfig() {
  try {
    if (typeof ensureSceneTemplateMeta === 'function') {
      return normalizeSceneSymbolLegendConfig(ensureSceneTemplateMeta(false).symbolLegend);
    }
  } catch (_) { /* dùng cấu hình mặc định */ }
  return normalizeSceneSymbolLegendConfig(null);
}


// ---- Hộp thoại chỉnh sửa: chọn ký hiệu cần giải thích, sửa tên, đổi thứ tự, xem trước trực tiếp ----
function sceneLegendEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}


function renderSceneSymbolLegendEditor(container, meta) {
  if (!container) return;
  const cfg = normalizeSceneSymbolLegendConfig(meta && meta.symbolLegend);
  const entries = buildSceneSymbolLegendEntries(sceneShapes, getShapeDisplayName, cfg, true);
  const root = container.closest('#sceneMetaLegendFields') || container.parentElement;
  const master = document.getElementById('sceneMetaShowSymbolLegend');
  const countEl = document.getElementById('sceneMetaLegendCount');
  container.textContent = '';
  container.dataset.cfg = JSON.stringify(cfg);

  const rows = () => Array.from(container.querySelectorAll('.scene-symbol-row'));
  const refresh = () => {
    const all = rows();
    all.forEach((row, index) => {
      const on = row.querySelector('.scene-symbol-check').checked;
      row.classList.toggle('is-off', !on);
      const buttons = row.querySelectorAll('.sl-move button');
      buttons[0].disabled = index === 0;
      buttons[1].disabled = index === all.length - 1;
    });
    const active = all.filter(row => row.querySelector('.scene-symbol-check').checked).length;
    if (countEl) countEl.textContent = all.length ? `${active}/${all.length} ký hiệu được hiển thị` : 'Chưa có ký hiệu nào';
    drawSceneSymbolLegendPreview(document.getElementById('sceneMetaLegendPreview'), readSceneSymbolLegendEditor(container), !master || master.checked);
  };
  container._refresh = refresh;

  if (entries.length === 0) {
    container.appendChild(sceneLegendEl('div', 'sl-empty', 'Chưa có ký hiệu nào trên sơ đồ. Hãy vẽ vật thể rồi quay lại chỉnh sửa.'));
    refresh();
    return;
  }

  entries.forEach(entry => {
    const row = sceneLegendEl('div', 'scene-symbol-row');
    row.dataset.key = entry.key;

    const sw = sceneLegendEl('label', 'sl-switch');
    sw.title = 'Đưa ký hiệu này vào bảng';
    const check = sceneLegendEl('input', 'scene-symbol-check');
    check.type = 'checkbox';
    check.checked = !entry.hidden;
    sw.append(check, sceneLegendEl('i'));

    const tile = sceneLegendEl('canvas', 'sl-tile');
    tile.width = 128; tile.height = 72;
    try {
      const tctx = tile.getContext('2d');
      tctx.scale(2, 2);
      drawSceneSymbolSample(tctx, entry.sample, 4, 4, 56, 28);
    } catch (_) { /* không vẽ được hình mẫu thì để trống */ }

    const input = sceneLegendEl('input', 'scene-symbol-label');
    input.type = 'text';
    input.maxLength = 60;
    input.placeholder = entry.autoLabel;
    input.value = entry.label === entry.autoLabel ? '' : entry.label;
    input.title = 'Để trống để dùng tên mặc định: ' + entry.autoLabel;
    input.setAttribute('aria-label', 'Tên hiển thị của ' + entry.autoLabel);
    const top = sceneLegendEl('div', 'sl-field-top');
    top.append(input, sceneLegendEl('span', 'sl-count', '×' + entry.count));
    const field = sceneLegendEl('div', 'sl-field');
    field.append(top, sceneLegendEl('div', 'sl-hint', 'Mặc định: ' + entry.autoLabel));

    const move = sceneLegendEl('div', 'sl-move');
    const up = sceneLegendEl('button', '', '▲');
    up.type = 'button'; up.title = 'Đưa lên'; up.setAttribute('aria-label', 'Đưa lên');
    up.onclick = () => { if (row.previousElementSibling) { container.insertBefore(row, row.previousElementSibling); refresh(); } };
    const down = sceneLegendEl('button', '', '▼');
    down.type = 'button'; down.title = 'Đưa xuống'; down.setAttribute('aria-label', 'Đưa xuống');
    down.onclick = () => { if (row.nextElementSibling) { container.insertBefore(row.nextElementSibling, row); refresh(); } };
    move.append(up, down);

    row.append(sw, tile, field, move);
    container.appendChild(row);
  });

  container.oninput = refresh;
  container.onchange = refresh;
  if (master) master.onchange = refresh;
  const setAll = on => { rows().forEach(row => { row.querySelector('.scene-symbol-check').checked = on; }); refresh(); };
  const bind = (id, fn) => { const btn = document.getElementById(id); if (btn) btn.onclick = fn; };
  bind('btnSceneLegendAll', () => setAll(true));
  bind('btnSceneLegendNone', () => setAll(false));
  bind('btnSceneLegendResetNames', () => { rows().forEach(row => { row.querySelector('.scene-symbol-label').value = ''; }); refresh(); });
  refresh();
}


// Đọc lại cấu hình từ hộp thoại; giữ nguyên cấu hình của các ký hiệu hiện không còn trên sơ đồ.
function readSceneSymbolLegendEditor(container) {
  let previous = normalizeSceneSymbolLegendConfig(null);
  try { previous = normalizeSceneSymbolLegendConfig(JSON.parse(container.dataset.cfg || '{}')); } catch (_) { /* bỏ qua */ }
  const rows = Array.from(container.querySelectorAll('.scene-symbol-row'));
  const present = rows.map(row => row.dataset.key);
  const next = { hidden: [], order: [], labels: {} };
  rows.forEach(row => {
    const key = row.dataset.key;
    next.order.push(key);
    if (!row.querySelector('.scene-symbol-check').checked) next.hidden.push(key);
    const text = String(row.querySelector('.scene-symbol-label').value || '').trim();
    if (text && text !== key) next.labels[key] = text;
  });
  previous.order.forEach(key => { if (present.indexOf(key) === -1) next.order.push(key); });
  previous.hidden.forEach(key => { if (present.indexOf(key) === -1) next.hidden.push(key); });
  Object.keys(previous.labels).forEach(key => { if (present.indexOf(key) === -1) next.labels[key] = previous.labels[key]; });
  return normalizeSceneSymbolLegendConfig(next);
}


// Xem trước cột Chú thích (khung + chú thích số + bảng ký hiệu) đúng như bản in.
function drawSceneSymbolLegendPreview(canvas, config, enabled) {
  if (!canvas || typeof canvas.getContext !== 'function') return;
  const COL = { x: 820, y: 85, w: 160, h: 475 };
  const scale = 3;
  if (canvas.width !== COL.w * scale) { canvas.width = COL.w * scale; canvas.height = COL.h * scale; }
  const pctx = canvas.getContext('2d');
  if (!pctx) return;
  pctx.setTransform(1, 0, 0, 1, 0, 0);
  pctx.clearRect(0, 0, canvas.width, canvas.height);
  pctx.setTransform(scale, 0, 0, scale, -COL.x * scale, -COL.y * scale);
  pctx.fillStyle = '#ffffff';
  pctx.fillRect(COL.x, COL.y, COL.w, COL.h);
  pctx.fillStyle = '#000000';
  pctx.strokeStyle = '#000000';
  pctx.lineWidth = 1.5;
  pctx.strokeRect(COL.x, COL.y, COL.w, COL.h);
  pctx.textAlign = 'center';
  pctx.textBaseline = 'alphabetic';
  pctx.font = 'bold 14px Arial';
  pctx.fillText('Chú thích', COL.x + 80, COL.y + 25);
  pctx.font = 'italic 12px Arial';
  pctx.fillText('(Số — nội dung giải thích)', COL.x + 80, COL.y + 45);
  pctx.beginPath();
  pctx.moveTo(COL.x, COL.y + 55);
  pctx.lineTo(COL.x + COL.w, COL.y + 55);
  pctx.stroke();
  drawSceneLegendColumn(pctx, COL.x, COL.y, COL.w, COL.h, { config, enabled, preview: true });
}


// Tỷ lệ chiều cao cột dành cho bảng ký hiệu: càng nhiều chú thích số thì càng ít.
function getSceneSymbolLegendRatio(gridHeight, noteCount) {
  const free = gridHeight - SCENE_SYMBOL_LEGEND_NOTES_TOP - Math.max(0, noteCount) * SCENE_SYMBOL_LEGEND_NOTE_ESTIMATE;
  return Math.min(SCENE_SYMBOL_LEGEND_MAX_RATIO, Math.max(SCENE_SYMBOL_LEGEND_MIN_RATIO, free / gridHeight));
}


function isSceneSymbolLegendEnabled() {
  try {
    if (typeof ensureSceneTemplateMeta === 'function') {
      return ensureSceneTemplateMeta(false).showSymbolLegend !== false;
    }
  } catch (_) { /* không đọc được cấu hình thì cứ hiện bảng */ }
  return true;
}


// Tính bố cục: rows (đã ngắt dòng), số dòng bị ẩn do hết chỗ, tổng chiều cao.
function layoutSceneSymbolLegend(ctx, entries, width, maxHeight) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const textWidth = Math.max(40, width - SCENE_SYMBOL_LEGEND_ICON_W - 24);
  const moreHeight = 16;
  const rows = [];
  let used = SCENE_SYMBOL_LEGEND_HEADER_HEIGHT;
  ctx.save();
  ctx.font = '10.5px Arial';
  for (let i = 0; i < entries.length; i++) {
    const lines = wrapSceneLegendText(ctx, entries[i].label, textWidth, 2);
    const h = Math.max(22, lines.length * 12 + 8);
    const remaining = entries.length - i - 1;
    // Chừa chỗ cho dòng "+ n ký hiệu khác" nếu sau dòng này vẫn còn mục.
    const needed = used + h + (remaining > 0 ? moreHeight : 0);
    if (needed > maxHeight) {
      if (rows.length === 0) { ctx.restore(); return null; }
      ctx.restore();
      return { rows, hidden: entries.length - i, height: used + moreHeight };
    }
    rows.push({ entry: entries[i], lines, h });
    used += h;
  }
  ctx.restore();
  return { rows, hidden: 0, height: used };
}


const SCENE_SYMBOL_LEGEND_STRAIGHT_TYPES = ['line', 'dashed_line', 'road_line', 'road_dashed', 'road_edge', 'curve', 'curve_dashed'];


// Vạch kẻ/mũi tên/hộ lan thường dài hàng trăm px; thu cả đoạn vào ô 36px sẽ thành
// sợi tóc. Thay bằng đoạn thẳng ngắn nằm ngang, giữ nguyên màu, nét và kiểu vẽ.
// Trả về null nếu loại này không cần chuẩn hóa.
function makeSceneSymbolStraightSample(shape, maxLength) {
  if (!shape) return null;
  const half = Math.max(4, maxLength) / 2;
  if (shape.type === 'tire_track' && Array.isArray(shape.points) && shape.points.length > 1) {
    const sample = Object.assign({}, shape);
    delete sample.curveSource;
    sample.points = [];
    const steps = 10;
    for (let i = 0; i <= steps; i++) sample.points.push({ x: -half + (2 * half * i) / steps, y: 0 });
    return sample;
  }
  if (SCENE_SYMBOL_LEGEND_STRAIGHT_TYPES.indexOf(shape.type) !== -1) {
    const sample = Object.assign({}, shape);
    sample.x1 = -half; sample.y1 = 0;
    sample.x2 = half; sample.y2 = 0;
    if ('cx' in sample || 'cy' in sample) { sample.cx = 0; sample.cy = 0; }
    return sample;
  }
  return null;
}


// Vẽ hình mẫu của một vật thể thu gọn vào khung (x, y, w, h).
function drawSceneSymbolSample(ctx, shape, x, y, w, h) {
  if (typeof getShapeBoundingBox !== 'function' || typeof renderShape !== 'function') return;
  const straight = makeSceneSymbolStraightSample(shape, w - 6);
  if (straight) {
    ctx.save();
    try {
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.translate(x + w / 2, y + h / 2);
      renderShape(ctx, straight);
    } catch (_) { /* một hình mẫu lỗi không được làm hỏng cả sơ đồ */ }
    ctx.restore();
    return;
  }
  const box = getShapeBoundingBox(shape);
  if (!box) return;
  const bw = box.maxX - box.minX;
  const bh = box.maxY - box.minY;
  if (!(bw > 0.5) || !(bh > 0.5)) return;
  // Vật thể đứng (dọc) xoay ngang để lấp đầy khung icon rộng hơn cao.
  const rotate = bh > bw * 1.5;
  const fitW = rotate ? bh : bw;
  const fitH = rotate ? bw : bh;
  const scale = Math.min(w / fitW, h / fitH, 1.5);
  if (!(scale > 0)) return;
  ctx.save();
  try {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.translate(x + w / 2, y + h / 2);
    if (rotate) ctx.rotate(-Math.PI / 2);
    ctx.scale(scale, scale);
    ctx.translate(-(box.minX + box.maxX) / 2, -(box.minY + box.maxY) / 2);
    renderShape(ctx, shape);
  } catch (_) { /* một hình mẫu lỗi không được làm hỏng cả sơ đồ */ }
  ctx.restore();
}


// Vẽ bảng, neo sát đáy cột Chú thích (bottomY là mép dưới được phép vẽ).
function drawSceneSymbolLegend(ctx, legendX, legendWidth, bottomY, layout) {
  if (!layout) return;
  const top = bottomY - layout.height;
  const left = legendX + 8;
  const right = legendX + legendWidth - 8;
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(legendX, top);
  ctx.lineTo(legendX + legendWidth, top);
  ctx.stroke();

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Ký hiệu', legendX + legendWidth / 2, top + SCENE_SYMBOL_LEGEND_HEADER_HEIGHT / 2 + 1);

  let cursorY = top + SCENE_SYMBOL_LEGEND_HEADER_HEIGHT;
  layout.rows.forEach((row, index) => {
    const iconY = cursorY + (row.h - SCENE_SYMBOL_LEGEND_ICON_H) / 2;
    drawSceneSymbolSample(ctx, row.entry.sample, left, iconY, SCENE_SYMBOL_LEGEND_ICON_W, SCENE_SYMBOL_LEGEND_ICON_H);

    ctx.fillStyle = '#111827';
    ctx.font = '10.5px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const textX = left + SCENE_SYMBOL_LEGEND_ICON_W + 8;
    const blockH = row.lines.length * 12;
    row.lines.forEach((line, i) => {
      ctx.fillText(line, textX, cursorY + (row.h - blockH) / 2 + i * 12 + 6);
    });

    if (index < layout.rows.length - 1 || layout.hidden > 0) {
      ctx.strokeStyle = 'rgba(17,24,39,.14)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(left, cursorY + row.h);
      ctx.lineTo(right, cursorY + row.h);
      ctx.stroke();
    }
    cursorY += row.h;
  });

  if (layout.hidden > 0) {
    ctx.fillStyle = '#6b7280';
    ctx.font = 'italic 10px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`+ ${layout.hidden} ký hiệu khác`, left, cursorY + 8);
  }
  ctx.restore();
}


// Điểm vào duy nhất cho cột Chú thích: chú thích số ở trên, bảng ký hiệu ở đáy.
// Dùng chung cho màn hình, xuất ảnh và in lên giấy ký sẵn.
function drawSceneLegendColumn(ctx, legendX, gridY, legendWidth, gridHeight, override) {
  // override (chỉ dùng cho xem trước): { config, enabled, preview } thay cho cấu hình đang lưu.
  const isPreview = !!(override && override.preview);
  let layout = null;
  try {
    const enabled = override && typeof override.enabled === 'boolean' ? override.enabled : isSceneSymbolLegendEnabled();
    if (enabled && typeof sceneShapes !== 'undefined') {
      const config = override && override.config ? override.config : getSceneSymbolLegendConfig();
      const entries = buildSceneSymbolLegendEntries(sceneShapes, getShapeDisplayName, config);
      const noteCount = typeof getSortedSceneNumberNotes === 'function' ? getSortedSceneNumberNotes().length : 0;
      const ratio = getSceneSymbolLegendRatio(gridHeight, noteCount);
      layout = layoutSceneSymbolLegend(ctx, entries, legendWidth, gridHeight * ratio);
    }
  } catch (_) { layout = null; /* lỗi bảng ký hiệu không được chặn chú thích số */ }

  const bottomY = gridY + gridHeight;
  // Vùng bảng để nhận cú bấm mở hộp thoại chỉnh sửa (xem getSceneTemplateHotspot).
  if (!isPreview) {
    sceneSymbolLegendHitRect = layout ? { x: legendX, y: bottomY - layout.height, w: legendWidth, h: layout.height } : null;
  }
  drawSceneNumberLegend(ctx, legendX, gridY, legendWidth, gridHeight, layout ? layout.height + 6 : 0);
  if (layout) drawSceneSymbolLegend(ctx, legendX, legendWidth, bottomY, layout);
}
