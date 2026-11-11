// Địa hình trên sơ đồ hiện trường: "Bãi đá" (rock_field) và "Đồi núi" (hill).
// Cùng cơ chế với đồng lúa / rừng cây: vùng chữ nhật, viền tự nhiên hoặc ranh giới tự vẽ
// (shape.areaShape / shape.areaOutline, xem getSceneryAreaOutline) nên kéo giãn, xoay, in đều giữ đúng hình.
// Mọi "ngẫu nhiên" dùng hạt giống theo id vật thể → hình ổn định, không nhấp nháy khi vẽ lại.

const SCENE_TERRAIN_TYPES = ['rock_field', 'hill'];

function isSceneTerrainType(type) {
  return SCENE_TERRAIN_TYPES.indexOf(type) !== -1;
}


function makeSceneTerrainRandom(seedText) {
  let seed = 0;
  String(seedText == null ? 'terrain' : seedText).split('').forEach(ch => { seed = (seed * 31 + ch.charCodeAt(0)) >>> 0; });
  const base = seed % 9973;
  return (a, b) => {
    const v = Math.sin(base * 12.9898 + (a || 0) * 127.1 + (b || 0) * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
}


// Đa giác biên của vùng: viền tự nhiên/tự vẽ nếu có, ngược lại là 4 góc khung chữ nhật.
function getSceneTerrainPolygon(shapeData, left, top, w, h) {
  const outline = typeof getSceneryAreaOutline === 'function' ? getSceneryAreaOutline(shapeData, left, top, w, h) : null;
  if (outline && outline.length >= 3) return { poly: outline, custom: true };
  return { poly: [{ x: left, y: top }, { x: left + w, y: top }, { x: left + w, y: top + h }, { x: left, y: top + h }], custom: false };
}


function traceSceneTerrainArea(ctx, area, left, top, w, h) {
  ctx.beginPath();
  if (area.custom) {
    area.poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  } else {
    drawRoundRectCompat(ctx, left, top, w, h, Math.max(4, Math.min(13, h * 0.1)));
  }
}


// Hình đá góc cạnh (5–8 đỉnh, hơi dẹt) kèm nét tách mặt để nhìn ra khối đá.
function drawSceneRock(ctx, cx, cy, radius, rand, tone, color, lineWidth) {
  const count = 5 + Math.floor(rand(1, 2) * 4);
  const phase = rand(3, 4) * Math.PI * 2;
  const squash = 0.82 + rand(5, 6) * 0.2;
  const pts = [];
  for (let i = 0; i < count; i++) {
    const t = phase + (i / count) * Math.PI * 2;
    const rho = radius * (0.7 + rand(i + 7, 9) * 0.3);
    pts.push({ x: cx + Math.cos(t) * rho, y: cy + Math.sin(t) * rho * squash });
  }
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = tone;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  // Nét tách mặt: từ một đỉnh vào gần tâm.
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(0.5, lineWidth * 0.7);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(cx + (pts[Math.floor(count / 2)].x - cx) * 0.15, cy + (pts[Math.floor(count / 2)].y - cy) * 0.15);
  ctx.lineTo(pts[Math.max(1, Math.floor(count / 3))].x, pts[Math.max(1, Math.floor(count / 3))].y);
  ctx.stroke();
  ctx.restore();
}


function drawSceneRockField(ctx, x, y, color, width, w, h, shapeData) {
  const left = x - w / 2, top = y - h / 2;
  const area = getSceneTerrainPolygon(shapeData, left, top, w, h);
  const rand = makeSceneTerrainRandom(shapeData && shapeData.id);
  const outerLine = Math.max(1.15, width * 0.9);

  traceSceneTerrainArea(ctx, area, left, top, w, h);
  ctx.fillStyle = 'rgba(241,243,246,.95)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = outerLine;
  ctx.stroke();

  const labelAt = area.custom && typeof getSceneryAreaLabelAnchor === 'function' ? getSceneryAreaLabelAnchor(area.poly, left, top, w, h) : { x, y };
  const label = getSceneryAreaLabelLayout(ctx, (shapeData && shapeData.areaLabel) || 'BÃI ĐÁ', labelAt.x, labelAt.y, w, h);

  // Khung được kẹp: đá luôn nằm trong vùng, kéo rộng thì thêm đá thay vì phóng to đá.
  const step = Math.max(10, Math.min(19, h * 0.17));
  const margin = step * 0.7;
  const rows = Math.max(1, Math.floor((h - margin * 2) / (step * 0.86)) + 1);
  const cols = Math.max(1, Math.floor((w - margin * 2) / step) + 1);
  const offX = (w - margin * 2 - (cols - 1) * step) / 2;
  const offY = (h - margin * 2 - (rows - 1) * step * 0.86) / 2;
  const lineWidth = Math.max(0.7, width * 0.55);
  const tones = ['rgba(148,163,184,.5)', 'rgba(203,213,225,.75)', 'rgba(120,134,156,.42)'];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const stagger = row % 2 ? step * 0.5 : 0;
      let cx = left + margin + offX + col * step + stagger + (rand(row, col) - 0.5) * step * 0.42;
      const cy = top + margin + offY + row * step * 0.86 + (rand(col + 5, row + 3) - 0.5) * step * 0.36;
      const r = step * (0.34 + rand(row + 11, col + 4) * 0.16);
      if (cx + r > left + w - margin * 0.5) continue;
      if (cx - r < left + margin * 0.3) cx = left + margin * 0.3 + r;
      if (label && cx + r > label.left - 3 && cx - r < label.right + 3 && cy + r > label.top - 2 && cy - r < label.bottom + 2) continue;
      if (area.custom && (!scenePointInPolygon(cx, cy, area.poly) || scenePolygonEdgeDistance(cx, cy, area.poly) < r * 0.9)) continue;
      drawSceneRock(ctx, cx, cy, r, (a, b) => rand(a + row * 3, b + col * 5), tones[(row * 2 + col) % tones.length], color, lineWidth);
    }
  }
  drawSceneryAreaLabel(ctx, label, color, width, shapeData);
}


// Đồi núi: đường đồng mức lồng nhau quanh đỉnh (lệch tâm cho giống địa hình thật),
// đường cái đậm mỗi 3 nấc, ký hiệu đỉnh và nét gạch chỉ hướng dốc ở sườn ngoài.
function drawSceneHill(ctx, x, y, color, width, w, h, shapeData) {
  const left = x - w / 2, top = y - h / 2;
  const area = getSceneTerrainPolygon(shapeData, left, top, w, h);
  const rand = makeSceneTerrainRandom(shapeData && shapeData.id);
  const outerLine = Math.max(1.15, width * 0.9);
  const contour = 'rgba(110,100,92,.8)';

  traceSceneTerrainArea(ctx, area, left, top, w, h);
  ctx.fillStyle = 'rgba(245,244,241,.95)';
  ctx.fill();

  const centroid = area.poly.reduce((a, p) => ({ x: a.x + p.x / area.poly.length, y: a.y + p.y / area.poly.length }), { x: 0, y: 0 });
  // Đỉnh lệch khỏi tâm một chút (cố định theo id).
  const peak = { x: centroid.x + (rand(1, 1) - 0.5) * w * 0.14 - w * 0.04, y: centroid.y + (rand(2, 2) - 0.5) * h * 0.12 - h * 0.03 };
  const levels = Math.max(2, Math.min(6, Math.round(Math.min(w, h) / 15)));

  ctx.save();
  ctx.lineJoin = 'round';
  for (let k = 0; k < levels; k++) {
    const s = 1 - (k + 1) / (levels + 1);
    // Độ lệch bán kính theo GÓC quanh đỉnh (tần số thấp) → mỗi nấc hơi khác nhau nhưng vẫn mượt, không răng cưa.
    // Khung chữ nhật giữ các nấc đồng dạng (không lệch); chỉ viền tự nhiên/tự vẽ mới có độ lệch.
    const amp = area.custom ? 1 : 0;
    const a2 = (rand(k + 1, 31) - 0.5) * 0.09 * amp, a3 = (rand(k + 1, 37) - 0.5) * 0.06 * amp;
    const p2 = rand(k + 1, 41) * Math.PI * 2, p3 = rand(k + 1, 43) * Math.PI * 2;
    const ring = area.poly.map(p => {
      const theta = Math.atan2(p.y - peak.y, p.x - peak.x);
      const wobble = 1 + a2 * Math.sin(2 * theta + p2) + a3 * Math.sin(3 * theta + p3);
      return { x: peak.x + (p.x - peak.x) * s * wobble, y: peak.y + (p.y - peak.y) * s * wobble };
    });
    // Khung chữ nhật chỉ có 4 góc: làm mượt sẽ tràn ra ngoài viền nên giữ nguyên đa giác.
    const smooth = area.custom && typeof sampleSceneClosedSpline === 'function' ? sampleSceneClosedSpline(ring, 4) : ring;
    ctx.beginPath();
    smooth.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.strokeStyle = contour;
    ctx.lineWidth = Math.max(0.55, width * (k % 3 === 2 ? 0.7 : 0.42));
    ctx.stroke();
  }
  ctx.restore();

  // Gạch chỉ dốc: nét ngắn từ viền ngoài hướng về đỉnh, cách đều theo chu vi.
  const perimeter = area.poly.reduce((sum, p, i) => { const q = area.poly[(i + 1) % area.poly.length]; return sum + Math.hypot(q.x - p.x, q.y - p.y); }, 0);
  const tick = Math.max(3, Math.min(7, Math.min(w, h) * 0.07));
  const spacing = Math.max(9, Math.min(16, perimeter / 28));
  ctx.save();
  ctx.strokeStyle = contour;
  ctx.lineWidth = Math.max(0.55, width * 0.45);
  let carry = spacing / 2;
  for (let i = 0; i < area.poly.length; i++) {
    const a = area.poly[i], b = area.poly[(i + 1) % area.poly.length];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    for (let d = carry; d < segLen; d += spacing) {
      const t = d / segLen;
      const px = a.x + (b.x - a.x) * t, py = a.y + (b.y - a.y) * t;
      const vx = peak.x - px, vy = peak.y - py, vl = Math.hypot(vx, vy) || 1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + (vx / vl) * tick, py + (vy / vl) * tick);
      ctx.stroke();
      carry = spacing - (segLen - d);
    }
    if (segLen < carry) carry -= segLen;
  }
  ctx.restore();

  // Viền ngoài vẽ sau cùng để các nét gạch không đè lên mép.
  traceSceneTerrainArea(ctx, area, left, top, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = outerLine;
  ctx.stroke();

  // Ký hiệu đỉnh: tam giác nhỏ đặc.
  const tri = Math.max(3.5, Math.min(8, Math.min(w, h) * 0.07));
  ctx.beginPath();
  ctx.moveTo(peak.x, peak.y - tri);
  ctx.lineTo(peak.x + tri * 0.9, peak.y + tri * 0.7);
  ctx.lineTo(peak.x - tri * 0.9, peak.y + tri * 0.7);
  ctx.closePath();
  ctx.fillStyle = contour;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.6, width * 0.5);
  ctx.stroke();

  // Nhãn đặt ngay dưới đỉnh để không đè ký hiệu đỉnh; nếu điểm đó sát/ngoài mép vùng thì dùng chỗ rộng nhất.
  let labelPos = { x: peak.x, y: peak.y + Math.max(tri + 9, h * 0.2) };
  const fits = pt => pt.y < top + h - 8 && scenePointInPolygon(pt.x, pt.y, area.poly) && scenePolygonEdgeDistance(pt.x, pt.y, area.poly) > 9;
  if (!fits(labelPos)) {
    labelPos = typeof getSceneryAreaLabelAnchor === 'function' ? getSceneryAreaLabelAnchor(area.poly, left, top, w, h) : { x, y };
  }
  const label = getSceneryAreaLabelLayout(ctx, (shapeData && shapeData.areaLabel) || 'ĐỒI NÚI', labelPos.x, labelPos.y, w, h);
  drawSceneryAreaLabel(ctx, label, color, width, shapeData);
}


function drawSceneryTerrain(ctx, type, x, y, color, width, w, h, shapeData) {
  if (type === 'rock_field') drawSceneRockField(ctx, x, y, color, width, w, h, shapeData);
  else if (type === 'hill') drawSceneHill(ctx, x, y, color, width, w, h, shapeData);
}
