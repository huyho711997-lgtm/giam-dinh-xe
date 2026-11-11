// Bảng "Ký hiệu" tự động trong cột Chú thích của sơ đồ hiện trường.
// Quét các vật thể đã vẽ, mỗi loại một dòng: hình mẫu (vẽ lại bằng chính mã
// vẽ của sơ đồ nên đúng màu/kiểu người dùng đã chọn) + tên gọi.

// Các loại không phải "ký hiệu": chữ, số chú thích, nét tự do, vết xóa.
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
function buildSceneSymbolLegendEntries(shapes, labelOf) {
  if (!Array.isArray(shapes) || typeof labelOf !== 'function') return [];
  const byLabel = new Map();
  shapes.forEach(shape => {
    if (!shape || typeof shape !== 'object') return;
    if (SCENE_SYMBOL_LEGEND_SKIP_TYPES.indexOf(shape.type) !== -1) return;
    const label = String(labelOf(shape) || '').trim();
    if (!label) return;
    const found = byLabel.get(label);
    if (found) found.count += 1;
    else byLabel.set(label, { label, sample: shape, count: 1 });
  });
  return Array.from(byLabel.values());
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
function drawSceneLegendColumn(ctx, legendX, gridY, legendWidth, gridHeight) {
  let layout = null;
  try {
    if (isSceneSymbolLegendEnabled() && typeof sceneShapes !== 'undefined') {
      const entries = buildSceneSymbolLegendEntries(sceneShapes, getShapeDisplayName);
      const noteCount = typeof getSortedSceneNumberNotes === 'function' ? getSortedSceneNumberNotes().length : 0;
      const ratio = getSceneSymbolLegendRatio(gridHeight, noteCount);
      layout = layoutSceneSymbolLegend(ctx, entries, legendWidth, gridHeight * ratio);
    }
  } catch (_) { layout = null; /* lỗi bảng ký hiệu không được chặn chú thích số */ }

  const bottomY = gridY + gridHeight;
  drawSceneNumberLegend(ctx, legendX, gridY, legendWidth, gridHeight, layout ? layout.height + 6 : 0);
  if (layout) drawSceneSymbolLegend(ctx, legendX, legendWidth, bottomY, layout);
}
