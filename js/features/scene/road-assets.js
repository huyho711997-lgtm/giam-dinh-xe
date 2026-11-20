// Ký hiệu đường bộ nhìn từ trên xuống: mũi tên mặt đường, đảo giao thông, vòng xuyến, đường sắt, thanh chắn tàu,
// vỉa hè, mương thoát nước, cống ngang. Là "vật cảnh quan": kéo để đặt (độ dài + hướng), dùng chung chọn/xoay/co giãn.
// Hệ toạ độ cục bộ: (x, y) là TÂM, w = chiều dài theo hướng kéo, h = bề ngang; đầu mũi tên = +x.

const SCENE_ROAD_ASSET_SPECS = {
  road_arrow_straight: { name: 'Mũi tên mặt đường — đi thẳng', aspect: 0.3,  minLength: 36,  resizeMin: 18 },
  road_arrow_left:     { name: 'Mũi tên mặt đường — rẽ trái',  aspect: 0.62, minLength: 34,  resizeMin: 18 },
  road_arrow_right:    { name: 'Mũi tên mặt đường — rẽ phải',  aspect: 0.62, minLength: 34,  resizeMin: 18 },
  road_arrow_uturn:    { name: 'Mũi tên mặt đường — quay đầu', aspect: 0.62, minLength: 34,  resizeMin: 18 },
  traffic_island:      { name: 'Đảo giao thông',               aspect: 0.4,  minLength: 56,  resizeMin: 28 },
  roundabout:          { name: 'Vòng xuyến',                   aspect: 1,    minLength: 110, resizeMin: 60 },
  railway:             { name: 'Đường sắt',                    aspect: 0.1,  minLength: 120, resizeMin: 50 },
  rail_barrier:        { name: 'Thanh chắn tàu',               aspect: 0.14, minLength: 70,  resizeMin: 36 },
  sidewalk:            { name: 'Vỉa hè',                       aspect: 0.14, minLength: 100, resizeMin: 40 },
  ditch:               { name: 'Mương thoát nước',             aspect: 0.12, minLength: 100, resizeMin: 40 },
  culvert:             { name: 'Cống ngang đường',             aspect: 0.22, minLength: 60,  resizeMin: 30 }
};

function isSceneRoadAssetType(type) {
  return Object.prototype.hasOwnProperty.call(SCENE_ROAD_ASSET_SPECS, type);
}

function getSceneRoadAssetSpec(type) {
  return isSceneRoadAssetType(type) ? SCENE_ROAD_ASSET_SPECS[type] : null;
}

// Mũi tên đặc (đầu tam giác) hướng theo vector (dx, dy) đơn vị, đỉnh tại (tx, ty).
function drawSceneRoadArrowHead(ctx, tx, ty, dx, dy, length, halfWidth) {
  const bx = tx - dx * length, by = ty - dy * length;
  const nx = -dy, ny = dx;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(bx + nx * halfWidth, by + ny * halfWidth);
  ctx.lineTo(bx - nx * halfWidth, by - ny * halfWidth);
  ctx.closePath();
  ctx.fill();
}

function drawSceneRoadArrow(ctx, type, x, y, w, h) {
  const left = x - w / 2, right = x + w / 2, top = y - h / 2, bottom = y + h / 2;
  const t = Math.max(2, Math.min(h * 0.22, w * 0.16));         // bề dày thân mũi tên
  const turning = type !== 'road_arrow_straight';
  const head = Math.max(5, turning ? Math.min(w * 0.3, h * 0.42 + 2) : Math.min(w * 0.4, h * 0.55 + 4));   // chiều dài đầu mũi tên
  const headHalf = Math.max(t * 1.1, Math.min(turning ? h * 0.36 : h * 0.5, head * 0.75));
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.lineWidth = t;
  ctx.setLineDash([]);

  if (type === 'road_arrow_straight') {
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right - head + 1, y);
    ctx.stroke();
    drawSceneRoadArrowHead(ctx, right, y, 1, 0, head, headHalf);
  } else if (type === 'road_arrow_left' || type === 'road_arrow_right') {
    const sgn = type === 'road_arrow_left' ? -1 : 1;           // trái = lên (−y), phải = xuống (+y) khi đầu xe hướng +x
    const stemY = y - sgn * (h / 2 - t / 2);
    const bx = left + w * 0.5;
    const endY = y + sgn * (h / 2 - head);
    ctx.beginPath();
    ctx.moveTo(left, stemY);
    ctx.lineTo(bx + t / 2, stemY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx, stemY - sgn * t / 2);
    ctx.lineTo(bx, endY + sgn * 1);
    ctx.stroke();
    drawSceneRoadArrowHead(ctx, bx, y + sgn * h / 2, 0, sgn, head, headHalf);
  } else if (type === 'road_arrow_uturn') {
    const lower = bottom - t / 2, upper = top + headHalf;   // đầu mũi tên rộng hơn thân: chừa chỗ phía trên để không tràn khung
    const radius = (lower - upper) / 2;
    const cx = right - radius;
    ctx.beginPath();
    ctx.moveTo(left, lower);
    ctx.lineTo(cx, lower);
    ctx.arc(cx, y, radius, Math.PI / 2, -Math.PI / 2, true);
    ctx.lineTo(left + head - 1, upper);
    ctx.stroke();
    drawSceneRoadArrowHead(ctx, left, upper, -1, 0, head, headHalf);
  }
}

function drawSceneRoadAsset(ctx, type, x, y, color, width, w, h, shapeData) {
  const left = x - w / 2, right = x + w / 2, top = y - h / 2, bottom = y + h / 2;
  const lineW = Math.max(1, width);
  const thin = Math.max(0.7, lineW * 0.55);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineW;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);

  const hatch = (x0, y0, x1, y1, step) => {
    ctx.save();
    ctx.lineWidth = thin;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    const rise = y1 - y0;
    for (let hx = x0 - rise; hx < x1; hx += step) {
      // Cắt đoạn gạch chéo theo khung bao (hình thật vẫn được clip tiếp bằng đường viền của đảo).
      const startX = Math.max(hx, x0), endX = Math.min(hx + rise, x1);
      if (endX <= startX) continue;
      ctx.moveTo(startX, y1 - (startX - hx));
      ctx.lineTo(endX, y1 - (endX - hx));
    }
    ctx.stroke();
    ctx.restore();
  };

  if (type.indexOf('road_arrow_') === 0) {
    drawSceneRoadArrow(ctx, type, x, y, w, h);
  } else if (type === 'traffic_island') {
    // Đảo giao thông: viên thuốc có bó vỉa và gạch chéo.
    const r = h / 2 * 0.92;
    ctx.beginPath();
    drawRoundRectCompat(ctx, left, top, w, h, r);
    ctx.fillStyle = 'rgba(255,255,255,.96)';
    ctx.fill();
    ctx.lineWidth = lineW * 1.2;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    drawRoundRectCompat(ctx, left, top, w, h, r);
    ctx.clip();
    hatch(left, top, right, bottom, Math.max(5, h * 0.22));
    ctx.restore();
  } else if (type === 'roundabout') {
    // Vòng xuyến: mép ngoài, đảo trung tâm gạch chéo, vạch tim dạng nét đứt và mũi tên ngược chiều kim đồng hồ.
    const R = Math.min(w, h) / 2;
    const rIsland = R * 0.4;
    const rMid = R * 0.7;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.lineWidth = lineW * 1.3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, rIsland, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.96)';
    ctx.fill();
    ctx.lineWidth = lineW * 1.2;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, rIsland, 0, Math.PI * 2);
    ctx.clip();
    hatch(x - rIsland, y - rIsland, x + rIsland, y + rIsland, Math.max(5, R * 0.1));
    ctx.restore();
    ctx.save();
    ctx.lineWidth = thin;
    ctx.setLineDash([Math.max(4, R * 0.09), Math.max(3, R * 0.07)]);
    ctx.beginPath();
    ctx.arc(x, y, rMid, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    const head = Math.max(5, R * 0.14);
    ctx.fillStyle = color;   // đảo trung tâm vừa tô trắng: trả lại màu nét cho các đầu mũi tên
    [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4].forEach(a => {
      const px = x + Math.cos(a) * rMid, py = y + Math.sin(a) * rMid;
      drawSceneRoadArrowHead(ctx, px, py, Math.sin(a), -Math.cos(a), head, head * 0.6);   // tiếp tuyến ngược chiều kim đồng hồ
    });
  } else if (type === 'railway') {
    // Hai ray song song + tà vẹt ngang đều nhau.
    const rail = h * 0.2;
    const tie = Math.max(5, Math.min(11, h * 0.6));
    ctx.save();
    ctx.lineWidth = thin;
    ctx.beginPath();
    for (let tx = left + tie / 2, n = 0; tx <= right && n < 400; tx += tie, n++) {
      ctx.moveTo(tx, top);
      ctx.lineTo(tx, bottom);
    }
    ctx.stroke();
    ctx.restore();
    ctx.lineWidth = lineW * 1.25;
    ctx.beginPath();
    ctx.moveTo(left, y - rail); ctx.lineTo(right, y - rail);
    ctx.moveTo(left, y + rail); ctx.lineTo(right, y + rail);
    ctx.stroke();
  } else if (type === 'rail_barrier') {
    // Thanh chắn tàu: hộp đế ở đầu trái, cần chắn sọc đen/trắng dài tới +x.
    const baseS = Math.min(h * 1.05, w * 0.3);
    const armH = Math.max(2.5, h * 0.38);
    ctx.beginPath();
    ctx.rect(left, y - baseS / 2, baseS, baseS);
    ctx.fillStyle = 'rgba(255,255,255,.96)';
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(left + baseS / 2, y, Math.max(1.4, baseS * 0.18), 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    const armL = left + baseS, armW = right - armL;
    ctx.strokeRect(armL, y - armH / 2, armW, armH);
    const stripe = Math.max(4, armW / 9);
    for (let sx = armL, i = 0; sx < right - 0.5; sx += stripe, i++) {
      if (i % 2 === 0) ctx.fillRect(sx, y - armH / 2, Math.min(stripe, right - sx), armH);
    }
  } else if (type === 'sidewalk') {
    // Vỉa hè: hai bó vỉa chạy dọc và các mạch gạch lát ngang.
    const tile = Math.max(7, Math.min(16, h * 1.1));
    ctx.save();
    ctx.lineWidth = thin;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    for (let tx = left + tile, n = 0; tx < right && n < 400; tx += tile, n++) {
      ctx.moveTo(tx, top);
      ctx.lineTo(tx, bottom);
    }
    ctx.moveTo(left, y); ctx.lineTo(right, y);
    ctx.stroke();
    ctx.restore();
    ctx.lineWidth = lineW * 1.2;
    ctx.beginPath();
    ctx.moveTo(left, top); ctx.lineTo(right, top);
    ctx.moveTo(left, bottom); ctx.lineTo(right, bottom);
    ctx.stroke();
  } else if (type === 'ditch') {
    // Mương thoát nước: hai bờ mương + đường nước lượn sóng ở giữa.
    ctx.beginPath();
    ctx.moveTo(left, top); ctx.lineTo(right, top);
    ctx.moveTo(left, bottom); ctx.lineTo(right, bottom);
    ctx.stroke();
    const amp = h * 0.18, wave = Math.max(10, h * 2);
    ctx.save();
    ctx.lineWidth = thin;
    ctx.beginPath();
    const steps = Math.max(8, Math.round(w / 3));
    for (let i = 0; i <= steps; i++) {
      const px = left + (w * i) / steps;
      const py = y + Math.sin(((px - left) / wave) * Math.PI * 2) * amp;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  } else if (type === 'culvert') {
    // Cống ngang: ống nét đứt chạy dưới mặt đường, hai đầu có tường đầu cống.
    ctx.save();
    ctx.setLineDash([Math.max(4, w * 0.06), Math.max(3, w * 0.04)]);
    ctx.lineWidth = thin * 1.3;
    ctx.beginPath();
    ctx.moveTo(left, top + h * 0.12); ctx.lineTo(right, top + h * 0.12);
    ctx.moveTo(left, bottom - h * 0.12); ctx.lineTo(right, bottom - h * 0.12);
    ctx.stroke();
    ctx.restore();
    ctx.lineWidth = lineW * 1.4;
    ctx.beginPath();
    ctx.moveTo(left, top); ctx.lineTo(left, bottom);
    ctx.moveTo(right, top); ctx.lineTo(right, bottom);
    ctx.stroke();
    ctx.save();
    ctx.lineWidth = thin;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.12, y); ctx.lineTo(x + w * 0.12, y);
    ctx.moveTo(x + w * 0.12 - 4, y - 3); ctx.lineTo(x + w * 0.12, y); ctx.lineTo(x + w * 0.12 - 4, y + 3);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
