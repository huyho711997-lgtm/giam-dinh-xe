// Các loại xe bổ sung nhìn từ trên xuống: xe khách/buýt, xe bán tải, xe cứu thương, xe cứu hộ (chở xe), xe đạp.
// Cùng ngôn ngữ ký hiệu với ô tô con/xe tải: thân chữ nhật, mũi tam giác chỉ hướng (đầu xe = +x), bánh xe tối.
// Là "vật cảnh quan" nên dùng chung vẽ / chọn / xoay / kéo cạnh / nét đứt / chú giải (objectW, objectH, angle, dashed).

const SCENE_VEHICLE_SPECS = {
  bus:       { name: 'Xe khách / buýt', aspect: 0.3,  minLength: 80, resizeMin: 60 },
  pickup:    { name: 'Xe bán tải',      aspect: 0.45, minLength: 40, resizeMin: 30 },
  ambulance: { name: 'Xe cứu thương',   aspect: 0.42, minLength: 46, resizeMin: 34 },
  tow_truck: { name: 'Xe cứu hộ',       aspect: 0.4,  minLength: 70, resizeMin: 52 },
  bicycle:   { name: 'Xe đạp',          aspect: 0.32, minLength: 24, resizeMin: 18 }
};

// Xe có chuyển đổi nét liền / nét đứt (xe tải cũng đã đọc shape.dashed nên nằm trong nhóm này).
const SCENE_DASHABLE_VEHICLE_TYPES = ['truck', 'bus', 'pickup', 'ambulance', 'tow_truck', 'bicycle'];

function isSceneVehicleType(type) {
  return Object.prototype.hasOwnProperty.call(SCENE_VEHICLE_SPECS, type);
}

function getSceneVehicleSpec(type) {
  return isSceneVehicleType(type) ? SCENE_VEHICLE_SPECS[type] : null;
}

function isSceneDashableVehicleType(type) {
  return SCENE_DASHABLE_VEHICLE_TYPES.indexOf(type) !== -1;
}

// Mũi tam giác chỉ hướng + vạch ngăn khoang đầu xe, giống ô tô con (sepX: vạch ngăn, right: mũi xe).
function drawSceneVehicleNose(ctx, sepX, right, top, bottom, y) {
  ctx.beginPath();
  ctx.moveTo(sepX, top);
  ctx.lineTo(sepX, bottom);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sepX, top);
  ctx.lineTo(right, y);
  ctx.lineTo(sepX, bottom);
  ctx.stroke();
}

function drawSceneVehicleWheels(ctx, fractions, left, top, bottom, w, h, color, dashed) {
  if (typeof drawVehicleWheelPairs !== 'function') return;
  ctx.setLineDash([]);
  drawVehicleWheelPairs(ctx, fractions.map(f => left + w * f), top, bottom, w, h, color, dashed);
}

// (x, y) là TÂM xe trong hệ toạ độ cục bộ đã xoay; w = chiều dài, h = chiều ngang.
function drawSceneVehicle(ctx, type, x, y, color, width, w, h, shapeData) {
  const dashed = !!(shapeData && shapeData.dashed);
  const left = x - w / 2, right = x + w / 2, top = y - h / 2, bottom = y + h / 2;
  const thin = Math.max(0.8, width * 0.6);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, width);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const dash = () => ctx.setLineDash(dashed ? [Math.max(5, w * 0.05), Math.max(3, w * 0.03)] : []);
  dash();

  if (type === 'bus') {
    ctx.strokeRect(left, top, w, h);
    const frontLen = Math.min(w * 0.12, h * 0.8);
    drawSceneVehicleNose(ctx, right - frontLen, right, top, bottom, y);
    // Dãy cửa sổ: các gân ngang mảnh chia khoang khách + đường tim mui xe.
    ctx.save();
    ctx.lineWidth = thin;
    ctx.globalAlpha = 0.6;
    const bodyEnd = right - frontLen;
    const bays = Math.max(3, Math.min(10, Math.round((bodyEnd - left) / 14)));
    ctx.beginPath();
    for (let i = 1; i < bays; i++) {
      const bx = left + (bodyEnd - left) * (i / bays);
      ctx.moveTo(bx, top + h * 0.14);
      ctx.lineTo(bx, bottom - h * 0.14);
    }
    ctx.moveTo(left + w * 0.04, y);
    ctx.lineTo(bodyEnd - w * 0.02, y);
    ctx.stroke();
    ctx.restore();
    drawSceneVehicleWheels(ctx, w >= 110 ? [0.1, 0.27, 0.78] : [0.12, 0.78], left, top, bottom, w, h, color, dashed);
  } else if (type === 'pickup') {
    // Cabin (đầu xe) + thùng hở phía sau.
    const cabW = w * 0.46;
    const bedW = w - cabW;
    const sepX = left + bedW;
    ctx.strokeRect(left, top, w, h);
    ctx.beginPath();
    ctx.moveTo(sepX, top);
    ctx.lineTo(sepX, bottom);
    ctx.stroke();
    const noseLen = Math.min(cabW * 0.5, h * 0.75);
    drawSceneVehicleNose(ctx, right - noseLen, right, top, bottom, y);
    // Thùng hở: khung trong mảnh.
    ctx.save();
    ctx.lineWidth = thin;
    ctx.globalAlpha = 0.65;
    const inset = Math.max(2, h * 0.13);
    ctx.strokeRect(left + inset, top + inset, bedW - inset * 2, h - inset * 2);
    ctx.restore();
    drawSceneVehicleWheels(ctx, [0.12, 0.74], left, top, bottom, w, h, color, dashed);
  } else if (type === 'ambulance') {
    // Xe van: khoang cứu thương phía sau có dấu thập, cabin phía trước.
    ctx.strokeRect(left, top, w, h);
    const frontLen = Math.min(w * 0.26, h * 0.75);
    drawSceneVehicleNose(ctx, right - frontLen, right, top, bottom, y);
    const cx = left + (w - frontLen) * 0.5;
    const arm = Math.max(3, Math.min(h * 0.3, (w - frontLen) * 0.22));
    ctx.save();
    ctx.setLineDash([]);
    ctx.lineWidth = Math.max(1.6, width * 1.5);
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(cx - arm, y); ctx.lineTo(cx + arm, y);
    ctx.moveTo(cx, y - arm); ctx.lineTo(cx, y + arm);
    ctx.stroke();
    ctx.restore();
    drawSceneVehicleWheels(ctx, [0.14, 0.76], left, top, bottom, w, h, color, dashed);
  } else if (type === 'tow_truck') {
    // Xe cứu hộ chở xe: cabin phía trước, sàn nâng phía sau có hai ray dọc và mặt dốc kéo xe lên.
    const cabW = w * 0.27;
    const gap = Math.max(2, w * 0.03);
    const bedW = w - cabW - gap;
    const cabX = left + bedW + gap;
    const cabInset = h * 0.07;
    ctx.strokeRect(left, top, bedW, h);
    ctx.strokeRect(cabX, top + cabInset, cabW, h - cabInset * 2);
    const noseLen = Math.min(cabW * 0.6, (h - cabInset * 2) * 0.75);
    drawSceneVehicleNose(ctx, right - noseLen, right, top + cabInset, bottom - cabInset, y);
    ctx.save();
    ctx.lineWidth = thin;
    ctx.globalAlpha = 0.7;
    const rail = h * 0.26;
    ctx.beginPath();
    ctx.moveTo(left + w * 0.05, y - rail); ctx.lineTo(left + bedW - w * 0.03, y - rail);
    ctx.moveTo(left + w * 0.05, y + rail); ctx.lineTo(left + bedW - w * 0.03, y + rail);
    ctx.stroke();
    // Mặt dốc phía đuôi xe: hình thang gạch chéo.
    const rampW = Math.min(bedW * 0.22, 16);
    ctx.beginPath();
    ctx.moveTo(left, top + h * 0.1); ctx.lineTo(left + rampW, y - rail);
    ctx.moveTo(left, bottom - h * 0.1); ctx.lineTo(left + rampW, y + rail);
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(left + bedW, y - h * 0.15); ctx.lineTo(cabX, y - h * 0.15);
    ctx.moveTo(left + bedW, y + h * 0.15); ctx.lineTo(cabX, y + h * 0.15);
    ctx.stroke();
    drawSceneVehicleWheels(ctx, [0.1, 0.28, 0.8], left, top, bottom, w, h, color, dashed);
  } else if (type === 'bicycle') {
    // Nhìn từ trên: khung dọc, hai bánh dẹt, ghi-đông ngang ở phía trước, đầu xe = +x.
    const wheelLen = Math.max(5, w * 0.3);
    const wheelThick = Math.max(2.4, h * 0.3);
    const frameL = left + w * 0.08, frameR = right - w * 0.08;
    ctx.beginPath();
    ctx.moveTo(frameL, y); ctx.lineTo(frameR, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#151a22';
    ctx.lineWidth = Math.max(0.8, width * 0.6);
    [left + w * 0.04, right - w * 0.04 - wheelLen].forEach(wx => {
      ctx.beginPath();
      if (typeof drawRoundRectCompat === 'function') drawRoundRectCompat(ctx, wx, y - wheelThick / 2, wheelLen, wheelThick, wheelThick / 2);
      else ctx.rect(wx, y - wheelThick / 2, wheelLen, wheelThick);
      ctx.fill();
      ctx.stroke();
    });
    dash();
    const barX = right - w * 0.24;
    ctx.beginPath();
    ctx.moveTo(barX, y - h * 0.48); ctx.lineTo(barX, y + h * 0.48);
    ctx.stroke();
    // Yên xe.
    ctx.beginPath();
    ctx.arc(left + w * 0.34, y, Math.max(1.2, h * 0.14), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
