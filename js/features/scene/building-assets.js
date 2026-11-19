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
  const ax = x + ridge.a.x, ay = y + ridge.a.y, bx = x + ridge.b.x, by = y + ridge.b.y;
  // Nhà nằm ngang: 2 góc trái → đầu nóc trái, 2 góc phải → đầu nóc phải. Nhà đứng: 2 góc trên / 2 góc dưới.
  const horizontal = w >= h;
  const TL = [left, top], TR = [left + w, top], BL = [left, top + h], BR = [left + w, top + h];
  const A = [ax, ay], B = [bx, by];
  // Mái là KHỐI đặc: nền trắng che hết vật nằm dưới, rồi tô 4 mái phẳng với sắc độ nhạt khác nhau (nhìn ra khối, in đen trắng vẫn rõ).
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(left, top, w, h);
  const facets = horizontal
    ? [[[TL, BL, A], '#ebebeb'], [[TR, BR, B], '#ebebeb'], [[TL, TR, B, A], '#f6f6f6'], [[BL, BR, B, A], '#dfdfdf']]
    : [[[TL, TR, A], '#ebebeb'], [[BL, BR, B], '#ebebeb'], [[TL, BL, B, A], '#f6f6f6'], [[TR, BR, B, A], '#dfdfdf']];
  facets.forEach(([points, fill]) => {
    ctx.beginPath();
    points.forEach((pt, i) => (i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  if (shapeData && shapeData.dashed) ctx.setLineDash([7, 4]); // nhà đã bị phá dỡ / dự kiến
  ctx.strokeRect(left, top, w, h);
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(TL[0], TL[1]); ctx.lineTo(ax, ay);
  ctx.moveTo(horizontal ? BL[0] : TR[0], horizontal ? BL[1] : TR[1]); ctx.lineTo(ax, ay);
  ctx.moveTo(horizontal ? TR[0] : BL[0], horizontal ? TR[1] : BL[1]); ctx.lineTo(bx, by);
  ctx.moveTo(BR[0], BR[1]); ctx.lineTo(bx, by);
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


// Thứ tự vẽ: mái nhà là khối che phủ nên nằm TRÊN xe / hàng hoá / nét, nhưng DƯỚI chữ, mũi tên "Hướng về",
// dấu X và số ghi chú (để các nhãn luôn đọc được). Sắp xếp ổn định: các vật cùng lớp giữ nguyên thứ tự cũ.
function getSceneShapeRenderRank(shape) {
  const type = shape && shape.type;
  if (type === SCENE_HOUSE_TYPE) return 1;
  if (type === 'text' || type === 'direction_label' || type === 'xmark' || type === 'number_note') return 2;
  return 0;
}

function getSceneShapesInRenderOrder(shapes) {
  const list = Array.isArray(shapes) ? shapes : [];
  if (!list.some(shape => getSceneShapeRenderRank(shape) > 0)) return list;
  return list.map((shape, index) => ({ shape, index, rank: getSceneShapeRenderRank(shape) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(item => item.shape);
}
