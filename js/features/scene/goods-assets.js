// Hàng hóa trên sơ đồ hiện trường (nhìn từ trên xuống):
//  - "Hàng hóa trưng bày" (goods_display): bàn/kệ có các món hàng xếp hàng lối (thùng carton, nồi, ấm...).
//  - "Hàng hóa đổ vỡ"   (goods_damaged): vùng gạch chéo, hàng đổ nghiêng, mảnh vỡ rơi vãi.
// Dùng chung cơ chế vùng với Bãi đá / Rừng cây (khung chữ nhật, viền tự nhiên hoặc ranh giới tự vẽ),
// kéo rộng thì thêm hàng chứ không phóng to từng món. Hàm dùng chung nằm ở terrain-assets.js.

const SCENE_GOODS_TYPES = ['goods_display', 'goods_damaged'];

function isSceneGoodsType(type) {
  return SCENE_GOODS_TYPES.indexOf(type) !== -1;
}


// Một món hàng nhìn từ trên. kind: 0 thùng carton, 1 nồi (nắp tròn có núm), 2 ấm/bình (thân tròn có vòi + quai).
function drawSceneGoodsItem(ctx, kind, cx, cy, size, angle, color, lineWidth, fill) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle || 0);
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = color;
  ctx.fillStyle = fill;
  const s = size / 2;
  if (kind === 0) {
    ctx.beginPath();
    ctx.rect(-s, -s * 0.8, s * 2, s * 1.6);
    ctx.fill();
    ctx.stroke();
    // Nắp thùng: đường gấp giữa + băng keo.
    ctx.beginPath();
    ctx.moveTo(-s, 0); ctx.lineTo(s, 0);
    ctx.moveTo(-s * 0.18, -s * 0.8); ctx.lineTo(-s * 0.18, s * 0.8);
    ctx.moveTo(s * 0.18, -s * 0.8); ctx.lineTo(s * 0.18, s * 0.8);
    ctx.globalAlpha = 0.6;
    ctx.stroke();
  } else if (kind === 1) {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.92, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.62, 0, Math.PI * 2);
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1, s * 0.16), 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath(); // vòi
    ctx.moveTo(s * 0.68, -s * 0.12); ctx.lineTo(s * 1.02, -s * 0.36);
    ctx.moveTo(s * 0.68, s * 0.12); ctx.lineTo(s * 1.02, -s * 0.2);
    ctx.stroke();
    ctx.beginPath(); // quai
    ctx.arc(-s * 0.72, 0, s * 0.3, Math.PI * 0.5, Math.PI * 1.5);
    ctx.stroke();
  }
  ctx.restore();
}


// Lưới vị trí đặt hàng trong vùng: bỏ ô trùng nhãn, ô ngoài ranh giới tự vẽ; trả về danh sách {cx, cy, row, col}.
function getSceneGoodsSlots(area, left, top, w, h, step, label, minEdge) {
  // Vùng nhỏ: lề thu theo cạnh ngắn để vẫn còn chỗ đặt hàng (lề cố định 0.62×step làm vùng 45px không còn ô nào).
  const margin = Math.min(step * 0.62, Math.max(2, Math.min(w, h) * 0.2));
  const rows = Math.max(1, Math.floor((h - margin * 2) / step) + 1);
  const cols = Math.max(1, Math.floor((w - margin * 2) / step) + 1);
  const offX = (w - margin * 2 - (cols - 1) * step) / 2;
  const offY = (h - margin * 2 - (rows - 1) * step) / 2;
  const slots = [];
  const r = step * 0.42;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = left + margin + offX + col * step, cy = top + margin + offY + row * step;
      if (label && cx + r > label.left - 3 && cx - r < label.right + 3 && cy + r > label.top - 2 && cy - r < label.bottom + 2) continue;
      if (area.custom && (!scenePointInPolygon(cx, cy, area.poly) || scenePolygonEdgeDistance(cx, cy, area.poly) < (minEdge || r))) continue;
      slots.push({ cx, cy, row, col });
    }
  }
  return slots;
}


// Chọn cỡ ô, nhãn và danh sách ô đặt hàng theo kích thước vùng, để vùng nhỏ vẫn hiện chi tiết từng món:
//  - cạnh ngắn < 64px: thu bước lưới (tối thiểu 9px) để vẫn xếp được ≥ 2 hàng món hàng;
//  - nhãn MẶC ĐỊNH nằm giữa vùng, nếu chiếm quá 40% số ô thì bỏ nhãn (tên đã có trong bảng ký hiệu) nhường chỗ cho hàng.
//    Nhãn do người dùng tự đặt (areaLabel) luôn được giữ.
function resolveSceneGoodsLayout(ctx, area, left, top, w, h, baseStep, labelAt, shapeData, defaultText, minEdgeFactor) {
  const minSide = Math.min(w, h);
  let step = baseStep;
  if (minSide < 64) step = Math.max(9, Math.min(baseStep, minSide * 0.3));
  const minEdge = minEdgeFactor ? step * minEdgeFactor : undefined;
  const customText = shapeData && String(shapeData.areaLabel || '').trim();
  let label = getSceneryAreaLabelLayout(ctx, customText || defaultText, labelAt.x, labelAt.y, w, h);
  let slots = getSceneGoodsSlots(area, left, top, w, h, step, label, minEdge);
  if (label && !customText) {
    const full = getSceneGoodsSlots(area, left, top, w, h, step, null, minEdge);
    if (slots.length < Math.max(3, full.length * 0.6)) {
      label = null;
      slots = full;
    }
  }
  return { step, label, slots };
}


function drawSceneGoodsDisplay(ctx, x, y, color, width, w, h, shapeData) {
  const left = x - w / 2, top = y - h / 2;
  const area = getSceneTerrainPolygon(shapeData, left, top, w, h);
  const rand = makeSceneTerrainRandom(shapeData && shapeData.id);
  const outerLine = Math.max(1.15, width * 0.9);

  // Mặt bàn/kệ: viền ngoài + đường mép trong để đọc ra là bàn trưng bày.
  traceSceneTerrainArea(ctx, area, left, top, w, h);
  ctx.fillStyle = 'rgba(248,244,236,.96)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = outerLine;
  ctx.stroke();
  if (!area.custom) {
    const inset = Math.max(3, Math.min(6, Math.min(w, h) * 0.05));
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = Math.max(0.6, width * 0.5);
    ctx.strokeRect(left + inset, top + inset, w - inset * 2, h - inset * 2);
    ctx.restore();
  }

  const labelAt = area.custom && typeof getSceneryAreaLabelAnchor === 'function' ? getSceneryAreaLabelAnchor(area.poly, left, top, w, h) : { x, y };
  const layout = resolveSceneGoodsLayout(ctx, area, left, top, w, h, Math.max(13, Math.min(22, h * 0.2)), labelAt, shapeData, 'HÀNG HÓA');
  const { step, label } = layout;
  const lineWidth = Math.max(0.65, width * 0.5);
  const fills = ['rgba(214,190,150,.55)', 'rgba(226,232,240,.9)', 'rgba(203,213,225,.7)'];
  layout.slots.forEach(({ cx, cy, row, col }) => {
    const kind = Math.floor(rand(row + 3, col + 7) * 3) % 3;
    drawSceneGoodsItem(ctx, kind, cx, cy, step * 0.72, 0, color, lineWidth, fills[kind]);
  });
  drawSceneryAreaLabel(ctx, label, color, width, shapeData);
}


function drawSceneGoodsDamaged(ctx, x, y, color, width, w, h, shapeData) {
  const left = x - w / 2, top = y - h / 2;
  const area = getSceneTerrainPolygon(shapeData, left, top, w, h);
  const rand = makeSceneTerrainRandom(shapeData && shapeData.id);
  const outerLine = Math.max(1.1, width * 0.85);

  traceSceneTerrainArea(ctx, area, left, top, w, h);
  ctx.fillStyle = 'rgba(254,242,242,.92)';
  ctx.fill();

  // Gạch chéo nhạt = vùng tài sản thiệt hại (kẹp trong vùng).
  ctx.save();
  traceSceneTerrainArea(ctx, area, left, top, w, h);
  ctx.clip();
  ctx.strokeStyle = 'rgba(100,116,139,.32)';
  ctx.lineWidth = Math.max(0.5, width * 0.4);
  const gap = 9;
  ctx.beginPath();
  for (let d = -h; d < w + h; d += gap) {
    ctx.moveTo(left + d, top);
    ctx.lineTo(left + d - h, top + h);
  }
  ctx.stroke();
  ctx.restore();

  // Viền nét đứt: ranh giới khu vực hàng hóa bị đổ vỡ.
  traceSceneTerrainArea(ctx, area, left, top, w, h);
  ctx.save();
  ctx.setLineDash([7, 4]);
  ctx.strokeStyle = color;
  ctx.lineWidth = outerLine;
  ctx.stroke();
  ctx.restore();

  const labelAt = area.custom && typeof getSceneryAreaLabelAnchor === 'function' ? getSceneryAreaLabelAnchor(area.poly, left, top, w, h) : { x, y };
  const layout = resolveSceneGoodsLayout(ctx, area, left, top, w, h, Math.max(14, Math.min(24, h * 0.22)), labelAt, shapeData, 'HÀNG HÓA ĐỔ VỠ', 0.55);
  const { step, label } = layout;
  const lineWidth = Math.max(0.65, width * 0.5);
  const fills = ['rgba(214,190,150,.7)', 'rgba(241,245,249,.95)', 'rgba(226,232,240,.95)'];
  layout.slots.forEach(({ cx, cy, row, col }) => {
    const pick = rand(row + 13, col + 2);
    const jx = (rand(row + 4, col + 9) - 0.5) * step * 0.5, jy = (rand(col + 6, row + 1) - 0.5) * step * 0.5;
    if (pick < 0.22) {
      // Mảnh vỡ: vài nét gãy khúc nhỏ.
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = rand(row + k, col + 21) * Math.PI * 2, len = step * (0.14 + rand(col + k, row + 5) * 0.12);
        const px = cx + jx + (rand(k + 2, row + col) - 0.5) * step * 0.5, py = cy + jy + (rand(row + col, k + 8) - 0.5) * step * 0.5;
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
        ctx.lineTo(px + Math.cos(a + 1.9) * len * 0.7, py + Math.sin(a + 1.9) * len * 0.7);
      }
      ctx.stroke();
      ctx.restore();
      return;
    }
    const kind = Math.floor(rand(row + 31, col + 17) * 3) % 3;
    const tilt = (rand(col + 41, row + 23) - 0.5) * Math.PI * 0.9; // hàng đổ lệch, nghiêng
    drawSceneGoodsItem(ctx, kind, cx + jx, cy + jy, step * 0.66, tilt, color, lineWidth, fills[kind]);
  });
  drawSceneryAreaLabel(ctx, label, color, width, shapeData);
}


function drawSceneGoods(ctx, type, x, y, color, width, w, h, shapeData) {
  if (type === 'goods_display') drawSceneGoodsDisplay(ctx, x, y, color, width, w, h, shapeData);
  else if (type === 'goods_damaged') drawSceneGoodsDamaged(ctx, x, y, color, width, w, h, shapeData);
}
