// Mảnh vỡ phụ tùng rơi vãi tại hiện trường (nhìn từ trên xuống): "Mảnh vỡ phụ tùng" (parts_debris).
// Là vùng khung chữ nhật (hoặc viền tự nhiên / tự vẽ ranh giới như Bãi đá, Hàng hóa đổ vỡ): kéo rộng thì rải thêm mảnh,
// không phóng to từng mảnh. Vị trí/hình dạng mảnh sinh ngẫu nhiên nhưng CỐ ĐỊNH theo id (không nhảy khi vẽ lại, in, xuất ảnh).
// Gồm 5 loại mảnh thường gặp sau va chạm: mảnh nhựa (cản, ốp), mảnh kính, mảnh lớn (ốp cản/chắn bùn có lỗ bắt vít),
// mảnh vỡ đèn và vụn nhỏ. Hàm dùng chung (vùng, lưới ô) nằm ở terrain-assets.js và goods-assets.js.

const SCENE_DEBRIS_TYPES = ['parts_debris'];

function isSceneDebrisType(type) {
  return SCENE_DEBRIS_TYPES.indexOf(type) !== -1;
}


// Đa giác góc cạnh quanh tâm (0,0): n đỉnh, bán kính dao động, một hướng dài ra cho giống mảnh vỡ thật.
function getSceneDebrisShardPoints(rand, seedA, seedB, s, sides, stretch) {
  const pts = [];
  const base = rand(seedA + 5, seedB + 3) * Math.PI * 2;
  for (let i = 0; i < sides; i++) {
    const a = base + (i / sides) * Math.PI * 2 + (rand(seedA + i, seedB + 11) - 0.5) * 0.7;
    const r = s * (0.5 + rand(seedB + i, seedA + 17) * 0.5);
    pts.push([Math.cos(a) * r * stretch, Math.sin(a) * r]);
  }
  return pts;
}


// Một mảnh. kind: 0 nhựa, 1 kính, 2 mảnh lớn (ốp cản), 3 vỡ đèn, 4 vụn nhỏ.
function drawSceneDebrisPiece(ctx, kind, cx, cy, size, angle, color, lineWidth, rand, seedA, seedB) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle || 0);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  const s = size / 2;
  const poly = pts => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
  };
  if (kind === 0) {
    poly(getSceneDebrisShardPoints(rand, seedA, seedB, s, 5 + Math.floor(rand(seedA, seedB + 29) * 2), 1.25));
    ctx.fillStyle = 'rgba(226,232,240,.95)';
    ctx.fill();
    ctx.stroke();
  } else if (kind === 1) {
    // Mảnh kính: tam giác thon nhọn + một vết nứt.
    const lean = (rand(seedA + 2, seedB + 4) - 0.5) * s * 0.6;
    poly([[-s * 1.05, lean * 0.3], [s * 0.55, -s * 0.5 + lean], [s * 0.95, s * 0.3]]);
    ctx.fillStyle = 'rgba(186,230,253,.55)';
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.45, lean * 0.2);
    ctx.lineTo(s * 0.35, -s * 0.05);
    ctx.globalAlpha = 0.55;
    ctx.stroke();
  } else if (kind === 2) {
    // Mảnh lớn: thanh cong (ốp cản / chắn bùn) có hai lỗ bắt vít.
    const len = s * 1.55, th = s * 0.5, bow = s * 0.35;
    ctx.beginPath();
    ctx.moveTo(-len, -th * 0.2);
    ctx.quadraticCurveTo(0, -th - bow, len, -th * 0.4);
    ctx.lineTo(len * 0.92, th * 0.55);
    ctx.quadraticCurveTo(0, th - bow, -len * 0.95, th * 0.7);
    ctx.closePath();
    ctx.fillStyle = 'rgba(203,213,225,.85)';
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 0.7;
    [-0.45, 0.45].forEach(k => {
      ctx.beginPath();
      ctx.arc(len * k, -bow * (1 - Math.abs(k)) * 0.4, Math.max(0.8, s * 0.1), 0, Math.PI * 2);
      ctx.stroke();
    });
  } else if (kind === 3) {
    // Mảnh vỡ đèn: hình thang lệch, có đường gờ nhựa đỏ nhạt.
    poly([[-s * 0.9, -s * 0.5], [s * 0.7, -s * 0.7], [s * 1.0, s * 0.45], [-s * 0.6, s * 0.7]]);
    ctx.fillStyle = 'rgba(254,202,202,.85)';
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, -s * 0.5);
    ctx.lineTo(s * 0.15, s * 0.55);
    ctx.globalAlpha = 0.6;
    ctx.stroke();
  } else {
    // Vụn nhỏ: vài hạt li ti.
    ctx.fillStyle = color;
    for (let k = 0; k < 4; k++) {
      const px = (rand(seedA + k, seedB + 41) - 0.5) * s * 1.8, py = (rand(seedB + k, seedA + 43) - 0.5) * s * 1.8;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.7, lineWidth * (0.55 + rand(k, seedA + seedB) * 0.5)), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}


// Chọn loại mảnh theo số ngẫu nhiên: nhựa 38%, kính 24%, vỡ đèn 12%, mảnh lớn 12%, vụn 14%.
function pickSceneDebrisKind(r) {
  if (r < 0.38) return 0;
  if (r < 0.62) return 1;
  if (r < 0.74) return 3;
  if (r < 0.86) return 2;
  return 4;
}


function drawSceneDebris(ctx, x, y, color, width, w, h, shapeData) {
  const left = x - w / 2, top = y - h / 2;
  const area = getSceneTerrainPolygon(shapeData, left, top, w, h);
  const rand = makeSceneTerrainRandom(shapeData && shapeData.id);
  const lineWidth = Math.max(0.65, width * 0.5);

  // Ranh giới khu vực rơi vãi: nét đứt mảnh, nền trong suốt để thấy mặt đường bên dưới.
  traceSceneTerrainArea(ctx, area, left, top, w, h);
  ctx.save();
  ctx.setLineDash([2, 4]);
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.7, width * 0.55);
  ctx.stroke();
  ctx.restore();

  const minSide = Math.min(w, h);
  const step = Math.max(13, Math.min(26, minSide * 0.34));
  const customText = shapeData && String(shapeData.areaLabel || '').trim();
  const labelAt = area.custom && typeof getSceneryAreaLabelAnchor === 'function' ? getSceneryAreaLabelAnchor(area.poly, left, top, w, h) : { x, y };
  // Mặc định không có nhãn giữa vùng (tên đã có trong bảng ký hiệu); nhãn người dùng đặt thì giữ và tránh đè lên mảnh.
  const label = customText ? getSceneryAreaLabelLayout(ctx, customText, labelAt.x, labelAt.y, w, h) : null;
  const slots = getSceneGoodsSlots(area, left, top, w, h, step, label, step * 0.4);
  slots.forEach(({ cx, cy, row, col }) => {
    if (rand(row + 51, col + 7) < 0.28) return;                      // chừa chỗ trống cho tự nhiên
    const jx = (rand(row + 4, col + 9) - 0.5) * step * 0.7, jy = (rand(col + 6, row + 1) - 0.5) * step * 0.7;
    const kind = pickSceneDebrisKind(rand(row + 31, col + 17));
    const size = step * (0.5 + rand(row + 9, col + 33) * 0.4);
    const angle = rand(col + 41, row + 23) * Math.PI * 2;
    drawSceneDebrisPiece(ctx, kind, cx + jx, cy + jy, size, angle, color, lineWidth, rand, row * 7 + 1, col * 5 + 2);
  });
  drawSceneryAreaLabel(ctx, label, color, width, shapeData);
}
