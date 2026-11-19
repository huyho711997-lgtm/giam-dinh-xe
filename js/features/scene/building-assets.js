// Nhà nhìn từ trên xuống (mái 4 mái / mái hông): khung chữ nhật + nóc mái ở giữa theo chiều dài
// + 4 đường chéo từ góc tường lên hai đầu nóc. Nhà vuông thì nóc thu thành một điểm (mái chóp).
// Vẽ nhanh: kéo chéo từ góc này sang góc kia như vẽ hình chữ nhật; bấm một cái tạo nhà mặc định 120×70.

const SCENE_HOUSE_TYPE = 'house';
const SCENE_HOUSE_DEFAULT_W = 120;
const SCENE_HOUSE_DEFAULT_H = 70;
const SCENE_HOUSE_MIN = 24;

function isSceneHouseType(type) {
  return type === SCENE_HOUSE_TYPE;
}

// Các điểm nóc mái trong hệ toạ độ cục bộ (tâm nhà = 0,0).
function getSceneHouseRidge(w, h) {
  const half = Math.min(w, h) / 2;
  if (w >= h) return { a: { x: -w / 2 + half, y: 0 }, b: { x: w / 2 - half, y: 0 } };
  return { a: { x: 0, y: -h / 2 + half }, b: { x: 0, y: h / 2 - half } };
}

// (x, y) là TÂM nhà như các vật cảnh quan khác; w dài, h rộng.
function drawSceneHouse(ctx, x, y, color, width, w, h, shapeData) {
  const left = x - w / 2, top = y - h / 2;
  const lineWidth = Math.max(1.4, (width || 1.5) * 1.15);
  const ridge = getSceneHouseRidge(w, h);
  ctx.save();
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'round';
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(left, top, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  if (shapeData && shapeData.dashed) ctx.setLineDash([7, 4]); // nhà đã bị phá dỡ / dự kiến
  ctx.strokeRect(left, top, w, h);
  ctx.setLineDash([]);
  const ax = x + ridge.a.x, ay = y + ridge.a.y, bx = x + ridge.b.x, by = y + ridge.b.y;
  // Nhà nằm ngang: 2 góc trái → đầu nóc trái, 2 góc phải → đầu nóc phải. Nhà đứng: 2 góc trên / 2 góc dưới.
  const horizontal = w >= h;
  ctx.beginPath();
  ctx.moveTo(left, top); ctx.lineTo(ax, ay);
  ctx.moveTo(horizontal ? left : left + w, horizontal ? top + h : top); ctx.lineTo(ax, ay);
  ctx.moveTo(horizontal ? left + w : left, horizontal ? top : top + h); ctx.lineTo(bx, by);
  ctx.moveTo(left + w, top + h); ctx.lineTo(bx, by);
  ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
  ctx.stroke();

  // Tên nhà (nếu có): đặt trong mái phía trên nóc, không đè đường chéo.
  const name = shapeData && String(shapeData.areaLabel || '').trim();
  if (name && typeof getSceneryAreaLabelLayout === 'function') {
    const label = getSceneryAreaLabelLayout(ctx, name, x, w >= h ? y - h / 4 : y, w * 0.6, h * 0.6);
    if (label) drawSceneryAreaLabel(ctx, label, color, width, shapeData);
  }
  ctx.restore();
}

// Kéo chéo góc → góc: trả về thông số khung (nhà luôn đặt thẳng, xoay sau bằng tay nắm xoay).
function getSceneHouseRectFromDrag(x1, y1, x2, y2) {
  const dragged = Math.abs(x2 - x1) > 6 || Math.abs(y2 - y1) > 6;
  if (!dragged) {
    return { startX: x1 - SCENE_HOUSE_DEFAULT_W / 2, startY: y1, objectW: SCENE_HOUSE_DEFAULT_W, objectH: SCENE_HOUSE_DEFAULT_H };
  }
  const w = Math.max(SCENE_HOUSE_MIN, Math.abs(x2 - x1));
  const h = Math.max(SCENE_HOUSE_MIN, Math.abs(y2 - y1));
  const left = x2 >= x1 ? x1 : x1 - w;
  const top = y2 >= y1 ? y1 : y1 - h;
  return { startX: left, startY: top + h / 2, objectW: w, objectH: h };
}
