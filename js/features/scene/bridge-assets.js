// Cầu nhìn từ trên xuống: hai lan can song song chạy dọc cầu (mỗi bên một nét ngoài + một nét trong nối nhau bằng các cột
// lan can), hai mố cầu (đường ngang đậm + gạch chéo phía ngoài) ở hai đầu và các trụ cầu nét đứt nằm dưới mặt cầu.
// Chỉ là các đường nét (không tô nền) nên không che xe, vệt bánh hay vạch kẻ đường nằm bên trên.
// Vẽ như vật cảnh quan khác: kéo dọc theo chiều cầu (độ dài + hướng), bề rộng tự tính, chỉnh sau bằng tay nắm / xoay.
// Có tên cầu (areaLabel, mặc định "CẦU") — chọn cầu rồi gõ tên ở thanh thuộc tính, ví dụ "CẦU 14".

const SCENE_BRIDGE_TYPE = 'bridge';
const SCENE_BRIDGE_DEFAULT_LABEL = 'CẦU';
const SCENE_BRIDGE_ASPECT = 0.22;          // bề rộng / chiều dài mặc định
const SCENE_BRIDGE_MIN_LENGTH = 140;       // cỡ khi bấm / kéo ngắn
const SCENE_BRIDGE_RESIZE_MIN_LENGTH = 50; // thu nhỏ tay được tới cỡ này (cầu nhỏ, cống hộp)

function isSceneBridgeType(type) {
  return type === SCENE_BRIDGE_TYPE;
}

// Số trụ cầu dưới mặt cầu theo chiều dài (cầu ngắn không có trụ giữa).
function getSceneBridgePierCount(w) {
  return Math.max(0, Math.min(5, Math.floor(w / 90) - 1));
}

// (x, y) là TÂM cầu trong hệ toạ độ cục bộ đã xoay; w = chiều dài (dọc cầu), h = bề rộng mặt cầu.
function drawSceneBridge(ctx, x, y, color, width, w, h, shapeData) {
  const left = x - w / 2, right = x + w / 2, top = y - h / 2, bottom = y + h / 2;
  const railW = Math.max(1.3, (width || 1.5) * 1.25);
  const thin = Math.max(0.8, railW * 0.55);
  const inset = Math.max(2.4, Math.min(6, h * 0.11));      // khoảng cách giữa nét lan can ngoài và nét trong
  const postStep = Math.max(7, Math.min(18, w / 14));
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; ctx.setLineDash([]);

  // Trụ cầu (nét đứt, mờ hơn) nằm dưới mặt cầu: vẽ trước để lan can đè lên.
  const piers = getSceneBridgePierCount(w);
  if (piers > 0) {
    ctx.save();
    ctx.lineWidth = thin; ctx.globalAlpha = 0.75; ctx.setLineDash([3, 2.5]);
    const pw = Math.max(5, Math.min(12, w * 0.03)), ph = h * 0.5;
    for (let i = 1; i <= piers; i++) {
      const px = left + (w * i) / (piers + 1);
      ctx.strokeRect(px - pw / 2, y - ph / 2, pw, ph);
    }
    ctx.restore();
  }

  // Lan can: nét ngoài đậm, nét trong mảnh, cột lan can nối hai nét.
  ctx.lineWidth = railW;
  ctx.beginPath();
  ctx.moveTo(left, top); ctx.lineTo(right, top);
  ctx.moveTo(left, bottom); ctx.lineTo(right, bottom);
  ctx.stroke();
  ctx.lineWidth = thin;
  ctx.beginPath();
  ctx.moveTo(left, top + inset); ctx.lineTo(right, top + inset);
  ctx.moveTo(left, bottom - inset); ctx.lineTo(right, bottom - inset);
  const posts = Math.max(1, Math.floor((w - 2) / postStep));
  for (let i = 0; i <= posts; i++) {
    const px = left + (w * i) / posts;
    ctx.moveTo(px, top); ctx.lineTo(px, top + inset);
    ctx.moveTo(px, bottom); ctx.lineTo(px, bottom - inset);
  }
  ctx.stroke();

  // Mố cầu: đường ngang đậm đóng hai đầu, nhô ra khỏi lan can một chút; gạch chéo phía ngoài chỉ phần đường đầu cầu.
  const ext = Math.max(2, Math.min(5, h * 0.09));
  ctx.lineWidth = railW * 1.3;
  ctx.beginPath();
  ctx.moveTo(left, top - ext); ctx.lineTo(left, bottom + ext);
  ctx.moveTo(right, top - ext); ctx.lineTo(right, bottom + ext);
  ctx.stroke();
  if (h >= 24) {
    const band = Math.max(4, Math.min(8, w * 0.04)), tick = Math.max(5, Math.min(9, h * 0.2));
    ctx.lineWidth = thin;
    ctx.beginPath();
    const hatches = Math.max(2, Math.min(5, Math.floor(h / 9)));
    for (let i = 0; i < hatches; i++) {
      const hy = top + ((i + 0.5) * h) / hatches;
      ctx.moveTo(left, hy); ctx.lineTo(left - band, hy + tick * 0.5);
      ctx.moveTo(right, hy); ctx.lineTo(right + band, hy + tick * 0.5);
    }
    ctx.stroke();
  }

  // Tên cầu ở giữa mặt cầu (người dùng đặt được; để trống thì dùng "CẦU").
  const custom = shapeData && String(shapeData.areaLabel || '').trim();
  if (typeof getSceneryAreaLabelLayout === 'function') {
    const label = getSceneryAreaLabelLayout(ctx, custom || SCENE_BRIDGE_DEFAULT_LABEL, x, y, w * 0.6, h);
    if (label) drawSceneryAreaLabel(ctx, label, color, width, shapeData);
  }
  ctx.restore();
}
