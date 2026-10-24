

function drawFallenBike(ctx, x, y, color, width, w, h, dashed=false) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);
  if (dashed) ctx.setLineDash([Math.max(4, w * 0.042), Math.max(2.5, w * 0.026)]);

  const left = x - w / 2;
  const lineW = Math.max(0.9, width);
  const wheelRadius = Math.max(5, h * 0.205);
  const wheelY = y + h * 0.13;
  const rearHub = { x: left + w * 0.17, y: wheelY };
  const frontHub = { x: left + w * 0.82, y: wheelY };
  const crank = { x: left + w * 0.49, y: y + h * 0.02 };
  const head = { x: left + w * 0.69, y: y - h * 0.14 };

  function drawTechnicalWheel(hub) {
    // Lốp, vành, sáu nan và moay-ơ: nét phẳng, không đổ bóng.
    ctx.beginPath();
    ctx.arc(hub.x, hub.y, wheelRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = Math.max(1.25, lineW * 1.18);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(hub.x, hub.y, wheelRadius * 0.72, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(71,85,105,.86)';
    ctx.lineWidth = Math.max(0.65, lineW * 0.54);
    ctx.stroke();

    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      ctx.beginPath();
      ctx.moveTo(hub.x, hub.y);
      ctx.lineTo(
        hub.x + Math.cos(angle) * wheelRadius * 0.69,
        hub.y + Math.sin(angle) * wheelRadius * 0.69
      );
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(hub.x, hub.y, Math.max(1.5, wheelRadius * 0.16), 0, Math.PI * 2);
    ctx.fillStyle = '#334155';
    ctx.fill();
  }

  drawTechnicalWheel(rearHub);
  drawTechnicalWheel(frontHub);

  // Chắn bùn trước và sau ôm đúng cung bánh.
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.95, lineW);
  ctx.beginPath();
  ctx.arc(rearHub.x, rearHub.y, wheelRadius * 1.11, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(frontHub.x, frontHub.y, wheelRadius * 1.1, Math.PI * 1.12, Math.PI * 1.88);
  ctx.stroke();

  // Gắp sau, khung sườn tam giác và ống khung trên.
  ctx.beginPath();
  ctx.moveTo(rearHub.x, rearHub.y);
  ctx.lineTo(crank.x, crank.y);
  ctx.lineTo(left + w * 0.37, y - h * 0.2);
  ctx.closePath();
  ctx.moveTo(left + w * 0.37, y - h * 0.2);
  ctx.lineTo(head.x, head.y);
  ctx.lineTo(crank.x, crank.y);
  ctx.stroke();

  // Phuộc kép thẳng từ cổ lái tới tâm bánh trước.
  const forkDx = w * 0.016;
  ctx.beginPath();
  ctx.moveTo(head.x - forkDx, head.y);
  ctx.lineTo(frontHub.x - wheelRadius * 0.17, frontHub.y);
  ctx.moveTo(head.x + forkDx, head.y);
  ctx.lineTo(frontHub.x + wheelRadius * 0.17, frontHub.y);
  ctx.stroke();

  // Khối động cơ và nắp máy dạng hình học 2D phẳng.
  ctx.beginPath();
  drawRoundRectCompat(ctx, crank.x - w * 0.075, crank.y - h * 0.13, w * 0.15, h * 0.26, Math.max(2, h * 0.045));
  ctx.fillStyle = '#dbe2ea';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineW;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(crank.x, crank.y, Math.max(2, h * 0.065), 0, Math.PI * 2);
  ctx.fillStyle = '#94a3b8';
  ctx.fill();
  ctx.stroke();

  // Yên dài, đuôi xe và đèn hậu.
  ctx.beginPath();
  drawRoundRectCompat(ctx, left + w * 0.29, y - h * 0.31, w * 0.28, h * 0.14, h * 0.06);
  ctx.fillStyle = '#273241';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(left + w * 0.3, y - h * 0.24);
  ctx.lineTo(left + w * 0.19, y - h * 0.17);
  ctx.lineTo(rearHub.x + wheelRadius * 0.23, rearHub.y - wheelRadius * 0.72);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(left + w * 0.205, y - h * 0.175, Math.max(1.1, h * 0.026), 0, Math.PI * 2);
  ctx.fillStyle = '#ef4444';
  ctx.fill();

  // Bình xăng, ốp hông và đường phân mảng rõ ràng.
  ctx.beginPath();
  ctx.ellipse(left + w * 0.61, y - h * 0.2, w * 0.08, h * 0.105, -0.08, 0, Math.PI * 2);
  ctx.fillStyle = '#e2e8f0';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(left + w * 0.54, y - h * 0.12);
  ctx.lineTo(left + w * 0.61, y + h * 0.02);
  ctx.lineTo(left + w * 0.67, y - h * 0.1);
  ctx.closePath();
  ctx.fillStyle = 'rgba(148,163,184,.28)';
  ctx.fill();
  ctx.stroke();

  // Tay lái bị xoay sang một bên và gương nằm sát mặt đường.
  ctx.beginPath();
  ctx.moveTo(head.x, head.y);
  ctx.lineTo(head.x + w * 0.055, head.y - h * 0.16);
  ctx.lineTo(head.x + w * 0.14, head.y - h * 0.19);
  ctx.moveTo(head.x, head.y);
  ctx.lineTo(head.x - w * 0.015, head.y + h * 0.22);
  ctx.stroke();
  ctx.beginPath();
  drawRoundRectCompat(ctx, head.x + w * 0.12, head.y - h * 0.225, w * 0.065, h * 0.06, h * 0.025);
  ctx.fillStyle = '#111827';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(head.x - w * 0.025, head.y + h * 0.285, Math.max(2, w * 0.026), Math.max(1.35, h * 0.038), -0.15, 0, Math.PI * 2);
  ctx.fillStyle = '#dbeafe';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.stroke();

  // Đèn trước và ghi-đông trung tâm.
  ctx.beginPath();
  ctx.arc(head.x + w * 0.035, head.y + h * 0.015, Math.max(1.5, h * 0.04), 0, Math.PI * 2);
  ctx.fillStyle = '#fde68a';
  ctx.fill();
  ctx.stroke();

  // Ống xả thấp và gác chân là hai điểm tiếp xúc đặc trưng khi xe nằm ngã.
  ctx.beginPath();
  ctx.moveTo(crank.x - w * 0.01, crank.y + h * 0.13);
  ctx.quadraticCurveTo(left + w * 0.39, y + h * 0.29, left + w * 0.25, y + h * 0.27);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = Math.max(1.1, lineW * 1.18);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(crank.x, crank.y + h * 0.08);
  ctx.lineTo(crank.x + w * 0.015, y + h * 0.34);
  ctx.lineTo(crank.x + w * 0.075, y + h * 0.36);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineW;
  ctx.stroke();

  // Đường tiếp xúc mảnh thay cho bóng 3D, giữ đúng ngôn ngữ sơ đồ kỹ thuật.
  ctx.beginPath();
  ctx.setLineDash([w * 0.025, w * 0.02]);
  ctx.moveTo(left + w * 0.11, y + h * 0.39);
  ctx.lineTo(left + w * 0.88, y + h * 0.39);
  ctx.strokeStyle = 'rgba(100,116,139,.5)';
  ctx.lineWidth = Math.max(0.55, lineW * 0.5);
  ctx.stroke();
  ctx.restore();
}


function drawRoundedTriangleAssetPath(ctx, cx, cy, w, h, radius) {
  const vertices = [
    { x: cx, y: cy - h / 2 },
    { x: cx + w / 2, y: cy + h / 2 },
    { x: cx - w / 2, y: cy + h / 2 }
  ];
  const cornerPoints = vertices.map((vertex, index) => {
    const prev = vertices[(index + vertices.length - 1) % vertices.length];
    const next = vertices[(index + 1) % vertices.length];
    const prevLength = Math.max(0.001, Math.hypot(prev.x - vertex.x, prev.y - vertex.y));
    const nextLength = Math.max(0.001, Math.hypot(next.x - vertex.x, next.y - vertex.y));
    const r = Math.min(radius, prevLength * 0.28, nextLength * 0.28);
    return {
      before: { x: vertex.x + (prev.x - vertex.x) * r / prevLength, y: vertex.y + (prev.y - vertex.y) * r / prevLength },
      vertex,
      after: { x: vertex.x + (next.x - vertex.x) * r / nextLength, y: vertex.y + (next.y - vertex.y) * r / nextLength }
    };
  });
  ctx.moveTo(cornerPoints[0].before.x, cornerPoints[0].before.y);
  cornerPoints.forEach(corner => {
    ctx.quadraticCurveTo(corner.vertex.x, corner.vertex.y, corner.after.x, corner.after.y);
    const nextCorner = cornerPoints[(cornerPoints.indexOf(corner) + 1) % cornerPoints.length];
    ctx.lineTo(nextCorner.before.x, nextCorner.before.y);
  });
  ctx.closePath();
}


function drawTrafficSignPostPath(ctx, x, top, width, height, bottomRadius) {
  const left = x - width / 2;
  const right = x + width / 2;
  const bottom = top + height;
  const radius = Math.max(0, Math.min(bottomRadius, width / 2, height / 2));
  ctx.moveTo(left, top);
  ctx.lineTo(right, top);
  ctx.lineTo(right, bottom - radius);
  ctx.quadraticCurveTo(right, bottom, right - radius, bottom);
  ctx.lineTo(left + radius, bottom);
  ctx.quadraticCurveTo(left, bottom, left, bottom - radius);
  ctx.lineTo(left, top);
  ctx.closePath();
}


function strokeTrafficSignPostWithoutTop(ctx, x, top, width, height, bottomRadius) {
  const left = x - width / 2;
  const right = x + width / 2;
  const bottom = top + height;
  const radius = Math.max(0, Math.min(bottomRadius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, bottom - radius);
  ctx.quadraticCurveTo(left, bottom, left + radius, bottom);
  ctx.lineTo(right - radius, bottom);
  ctx.quadraticCurveTo(right, bottom, right, bottom - radius);
  ctx.lineTo(right, top);
  ctx.stroke();
}


function drawTrafficSignDiamondPath(ctx, cx, cy, size) {
  const half = size / 2;
  ctx.moveTo(cx, cy - half);
  ctx.lineTo(cx + half, cy);
  ctx.lineTo(cx, cy + half);
  ctx.lineTo(cx - half, cy);
  ctx.closePath();
}


function drawTrafficSignMeaning(ctx, shape, cx, cy, size, color, lineWidth) {
  const kind = shape && shape.signKind
    ? shape.signKind
    : (shape && shape.type === 'sign_triangle_post' ? 'intersection_non_priority' : 'speed_limit');
  const r = Math.max(5, size / 2);
  const ink = color || '#111827';
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = Math.max(0.8, lineWidth * 0.85);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);
  const drawFilledArrowHead = (tipX, tipY, angle, arrowSize) => {
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const normalX = -dirY;
    const normalY = dirX;
    const baseX = tipX - dirX * arrowSize;
    const baseY = tipY - dirY * arrowSize;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(baseX + normalX * arrowSize * 0.48, baseY + normalY * arrowSize * 0.48);
    ctx.lineTo(baseX - normalX * arrowSize * 0.48, baseY - normalY * arrowSize * 0.48);
    ctx.closePath();
    ctx.fill();
  };

  if (kind === 'speed_limit') {
    const speed = Math.max(5, Math.min(200, parseInt(shape.speedLimit, 10) || 50));
    ctx.font = `900 ${Math.max(7, r * 0.92)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(speed), 0, r * 0.05);
  } else if (kind === 'priority_road' || kind === 'end_priority') {
    // Mặt hình thoi và vạch kết thúc được vẽ ở drawSceneryAsset để đúng hình dạng biển I.401/I.402.
  } else if (kind === 'warning_turn_left' || kind === 'warning_turn_right') {
    const direction = kind === 'warning_turn_left' ? -1 : 1;
    ctx.lineWidth = Math.max(1.8, r * 0.22);
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    ctx.moveTo(0, r * 0.72);
    ctx.lineTo(0, r * 0.12);
    ctx.lineTo(direction * r * 0.48, -r * 0.15);
    ctx.lineTo(direction * r * 0.48, -r * 0.68);
    ctx.stroke();
  } else if (kind === 'warning_winding') {
    ctx.lineWidth = Math.max(1.8, r * 0.21);
    ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(0, r * 0.74);
    ctx.bezierCurveTo(r * 0.56, r * 0.42, -r * 0.5, r * 0.12, 0, -r * 0.18);
    ctx.bezierCurveTo(r * 0.4, -r * 0.4, -r * 0.28, -r * 0.56, 0, -r * 0.73);
    ctx.stroke();
  } else if (kind === 'warning_narrow_both') {
    ctx.lineWidth = Math.max(1.5, r * 0.17);
    ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(-r * 0.58, r * 0.7);
    ctx.lineTo(-r * 0.58, r * 0.12);
    ctx.lineTo(-r * 0.28, -r * 0.16);
    ctx.lineTo(-r * 0.28, -r * 0.7);
    ctx.moveTo(r * 0.58, r * 0.7);
    ctx.lineTo(r * 0.58, r * 0.12);
    ctx.lineTo(r * 0.28, -r * 0.16);
    ctx.lineTo(r * 0.28, -r * 0.7);
    ctx.stroke();
  } else if (kind === 'warning_two_way') {
    ctx.lineWidth = Math.max(1.4, r * 0.14);
    ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(-r * 0.25, r * 0.62);
    ctx.lineTo(-r * 0.25, -r * 0.52);
    ctx.moveTo(r * 0.25, -r * 0.62);
    ctx.lineTo(r * 0.25, r * 0.52);
    ctx.stroke();
    drawFilledArrowHead(-r * 0.25, -r * 0.72, -Math.PI / 2, r * 0.3);
    drawFilledArrowHead(r * 0.25, r * 0.72, Math.PI / 2, r * 0.3);
  } else if (kind === 'warning_crossroads') {
    // W.205a: dấu cộng đen đặc, cân giữa mặt biển tam giác.
    const halfThickness = r * 0.14;
    const verticalReach = r * 0.68;
    const horizontalReach = r * 0.58;
    ctx.beginPath();
    ctx.moveTo(-halfThickness, -verticalReach);
    ctx.lineTo(halfThickness, -verticalReach);
    ctx.lineTo(halfThickness, -halfThickness);
    ctx.lineTo(horizontalReach, -halfThickness);
    ctx.lineTo(horizontalReach, halfThickness);
    ctx.lineTo(halfThickness, halfThickness);
    ctx.lineTo(halfThickness, verticalReach);
    ctx.lineTo(-halfThickness, verticalReach);
    ctx.lineTo(-halfThickness, halfThickness);
    ctx.lineTo(-horizontalReach, halfThickness);
    ctx.lineTo(-horizontalReach, -halfThickness);
    ctx.lineTo(-halfThickness, -halfThickness);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'warning_roundabout') {
    const circleRadius = r * 0.46;
    ctx.lineWidth = Math.max(1.4, r * 0.13);
    ctx.beginPath();
    ctx.arc(0, 0, circleRadius, -Math.PI * 0.36, Math.PI * 1.44);
    ctx.stroke();
    [-0.36, 0.3, 0.96].forEach(turn => {
      const arcAngle = Math.PI * turn;
      drawFilledArrowHead(
        Math.cos(arcAngle) * circleRadius,
        Math.sin(arcAngle) * circleRadius,
        arcAngle + Math.PI / 2,
        r * 0.24
      );
    });
  } else if (kind === 'warning_traffic_signal') {
    const housingW = r * 0.5;
    const housingH = r * 1.28;
    ctx.beginPath();
    drawRoundRectCompat(ctx, -housingW / 2, -housingH / 2, housingW, housingH, housingW * 0.18);
    ctx.stroke();
    [-0.36, 0, 0.36].forEach(offset => {
      ctx.beginPath();
      ctx.arc(0, r * offset, r * 0.13, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (kind === 'warning_railway') {
    ctx.lineWidth = Math.max(1.15, r * 0.105);
    ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(-r * 0.25, -r * 0.65);
    ctx.lineTo(-r * 0.25, r * 0.62);
    ctx.moveTo(r * 0.25, -r * 0.65);
    ctx.lineTo(r * 0.25, r * 0.62);
    ctx.stroke();
    for (let y = -0.54; y <= 0.55; y += 0.27) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.48, r * y);
      ctx.lineTo(r * 0.48, r * y);
      ctx.stroke();
    }
  } else if (kind === 'warning_slippery') {
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.beginPath();
    drawRoundRectCompat(ctx, -r * 0.46, -r * 0.48, r * 0.92, r * 0.4, r * 0.08);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-r * 0.29, -r * 0.05, r * 0.11, 0, Math.PI * 2);
    ctx.arc(r * 0.29, -r * 0.05, r * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.08);
    [-0.24, 0.24].forEach(offset => {
      ctx.beginPath();
      ctx.moveTo(r * offset, r * 0.12);
      ctx.bezierCurveTo(r * (offset - 0.34), r * 0.28, r * (offset + 0.28), r * 0.43, r * (offset - 0.16), r * 0.68);
      ctx.stroke();
    });
  } else if (kind === 'warning_pedestrian') {
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.beginPath();
    ctx.arc(0, -r * 0.5, r * 0.13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.36);
    ctx.lineTo(-r * 0.08, r * 0.08);
    ctx.lineTo(-r * 0.37, r * 0.55);
    ctx.moveTo(-r * 0.07, -r * 0.15);
    ctx.lineTo(-r * 0.4, r * 0.08);
    ctx.moveTo(-r * 0.08, r * 0.08);
    ctx.lineTo(r * 0.31, r * 0.57);
    ctx.stroke();
  } else if (kind === 'intersection_non_priority' ||
             kind === 'intersection_non_priority_right' ||
             kind === 'intersection_non_priority_left') {
    // W.207a/b/c: ký hiệu là một khối đen đặc, không phải các nét giao nhau rời rạc.
    // Phần đầu được vát, nhánh ngang ngắn và chân có rãnh chữ V như biển chuẩn.
    const hasLeftArm = kind !== 'intersection_non_priority_right';
    const hasRightArm = kind !== 'intersection_non_priority_left';
    const shaftHalf = r * 0.235;
    const armReach = r * 0.55;
    const armTop = -r * 0.095;
    const armBottom = r * 0.17;
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.79);
    ctx.lineTo(shaftHalf, -r * 0.57);
    ctx.lineTo(shaftHalf, armTop);
    if (hasRightArm) {
      ctx.lineTo(armReach, armTop);
      ctx.lineTo(armReach, armBottom);
    }
    ctx.lineTo(shaftHalf, armBottom);
    ctx.lineTo(shaftHalf, r * 0.67);
    ctx.lineTo(0, r * 0.48);
    ctx.lineTo(-shaftHalf, r * 0.67);
    ctx.lineTo(-shaftHalf, armBottom);
    if (hasLeftArm) {
      ctx.lineTo(-armReach, armBottom);
      ctx.lineTo(-armReach, armTop);
    }
    ctx.lineTo(-shaftHalf, armTop);
    ctx.lineTo(-shaftHalf, -r * 0.57);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'yield') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.65, -r * 0.42);
    ctx.lineTo(r * 0.65, -r * 0.42);
    ctx.lineTo(0, r * 0.7);
    ctx.closePath();
    ctx.stroke();
  } else if (kind === 'stop') {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + i * Math.PI / 4;
      const px = Math.cos(a) * r * 0.72;
      const py = Math.sin(a) * r * 0.72;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.font = `900 ${Math.max(5, r * 0.46)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STOP', 0, 0);
  } else if (kind === 'no_entry') {
    ctx.beginPath();
    drawRoundRectCompat(ctx, -r * 0.68, -r * 0.14, r * 1.36, r * 0.28, r * 0.12);
    ctx.fill();
  } else if (kind === 'no_parking') {
    ctx.font = `900 ${Math.max(7, r * 1.05)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P', 0, 0);
    ctx.beginPath();
    ctx.moveTo(-r * 0.62, r * 0.62);
    ctx.lineTo(r * 0.62, -r * 0.62);
    ctx.stroke();
  } else if (kind === 'no_overtaking') {
    ctx.strokeRect(-r * 0.65, -r * 0.12, r * 0.52, r * 0.55);
    ctx.strokeRect(r * 0.13, -r * 0.43, r * 0.52, r * 0.55);
    ctx.beginPath();
    ctx.moveTo(-r * 0.72, r * 0.68);
    ctx.lineTo(r * 0.72, -r * 0.68);
    ctx.stroke();
  } else if (kind === 'children') {
    [[-0.25, -0.18, 0.58], [0.28, 0.06, 0.45]].forEach(person => {
      const px = r * person[0], py = r * person[1], scale = person[2];
      ctx.beginPath(); ctx.arc(px, py - r * scale * 0.38, r * scale * 0.13, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px, py - r * scale * 0.23); ctx.lineTo(px, py + r * scale * 0.25);
      ctx.moveTo(px, py - r * scale * 0.05); ctx.lineTo(px - r * scale * 0.25, py + r * scale * 0.1);
      ctx.moveTo(px, py + r * scale * 0.25); ctx.lineTo(px - r * scale * 0.2, py + r * scale * 0.58);
      ctx.moveTo(px, py + r * scale * 0.25); ctx.lineTo(px + r * scale * 0.2, py + r * scale * 0.58);
      ctx.stroke();
    });
  } else if (kind === 'roadworks') {
    ctx.beginPath(); ctx.arc(-r * 0.18, -r * 0.42, r * 0.13, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.16, -r * 0.27); ctx.lineTo(r * 0.08, r * 0.2);
    ctx.moveTo(-r * 0.06, -r * 0.08); ctx.lineTo(-r * 0.5, r * 0.12);
    ctx.moveTo(r * 0.08, r * 0.2); ctx.lineTo(-r * 0.2, r * 0.62);
    ctx.moveTo(r * 0.08, r * 0.2); ctx.lineTo(r * 0.36, r * 0.57);
    ctx.moveTo(r * 0.26, -r * 0.42); ctx.lineTo(r * 0.45, r * 0.48);
    ctx.stroke();
  } else if (kind === 'custom') {
    const label = String(shape.customLabel || '?').slice(0, 6);
    ctx.font = `900 ${Math.max(6, r * 0.72)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0);
  } else {
    ctx.font = `900 ${Math.max(8, r * 1.15)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 0, 0);
  }
  ctx.restore();
}


function drawSceneryAsset(ctx, type, x, y, color, width, w, h, shapeData = null) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, width);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);
  const left = x - w / 2;
  const right = x + w / 2;
  const top = y - h / 2;

  // ---- XE TẢI: cùng ngôn ngữ ký hiệu với ô tô con (khung chữ nhật, mũi tam giác chỉ hướng,
  // bánh xe tối), thêm thùng hàng dài, cabin hẹp hơn và cầu sau đôi. Đầu xe hướng +x.
  if (type === 'truck') {
    const dashed = !!(shapeData && shapeData.dashed);
    if (dashed) ctx.setLineDash([Math.max(5, w * 0.045), Math.max(3, w * 0.027)]);
    const bottom = y + h / 2;
    const boxW = w * 0.66;
    const gapW = Math.max(2, w * 0.035);
    const cabX = left + boxW + gapW;
    const cabW = right - cabX;
    const cabInset = h * 0.07;
    const cabTop = top + cabInset;
    const cabH = h - cabInset * 2;

    // Thùng hàng + hai gân thùng mảnh.
    ctx.strokeRect(left, top, boxW, h);
    ctx.save();
    ctx.lineWidth = Math.max(0.8, width * 0.6);
    ctx.globalAlpha = 0.55;
    [1 / 3, 2 / 3].forEach(f => {
      ctx.beginPath();
      ctx.moveTo(left + boxW * f, top + h * 0.14);
      ctx.lineTo(left + boxW * f, bottom - h * 0.14);
      ctx.stroke();
    });
    ctx.restore();

    // Khớp nối ngắn giữa thùng và cabin.
    ctx.beginPath();
    ctx.moveTo(left + boxW, y - h * 0.16);
    ctx.lineTo(cabX, y - h * 0.16);
    ctx.moveTo(left + boxW, y + h * 0.16);
    ctx.lineTo(cabX, y + h * 0.16);
    ctx.stroke();

    // Cabin với vạch ngăn và mũi tam giác giống ô tô con.
    ctx.strokeRect(cabX, cabTop, cabW, cabH);
    const frontLen = Math.min(cabW * 0.62, cabH * 0.75);
    const sepX = right - frontLen;
    ctx.beginPath();
    ctx.moveTo(sepX, cabTop);
    ctx.lineTo(sepX, cabTop + cabH);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sepX, cabTop);
    ctx.lineTo(right, y);
    ctx.lineTo(sepX, cabTop + cabH);
    ctx.stroke();

    ctx.setLineDash([]);
    // Cầu sau đôi dưới thùng + cầu trước dưới cabin.
    drawVehicleWheelPairs(ctx, [left + boxW * 0.14, left + boxW * 0.32, cabX + cabW * 0.5], top, bottom, w, h, color, dashed);
    ctx.restore();
    return;
  }

  // ---- TRẠM THU PHÍ (nhìn từ trên xuống): mái che nét đứt, các làn xe chạy theo trục dọc,
  // đảo phân làn có buồng thu phí, barie chắn ở cửa ra và mũi tên hướng đi mỗi làn.
  if (type === 'toll_station') {
    const bottom = y + h / 2;
    const lanes = Math.max(2, Math.min(8, Math.round(w / 50))); // ~50px/làn: rõ ràng khi in A4
    const islandW = Math.max(5, Math.min(14, (w / lanes) * 0.24));
    const laneW = (w - islandW) / lanes;
    const canopyH = h * 0.44;
    const canopyTop = y - canopyH / 2;
    const islandH = h * 0.7;
    const islandTop = y - islandH / 2;
    const thin = Math.max(0.9, width * 0.75);

    // Mái che.
    ctx.save();
    ctx.setLineDash([Math.max(4, w * 0.02), Math.max(3, w * 0.013)]);
    ctx.lineWidth = thin;
    ctx.strokeRect(left, canopyTop, w, canopyH);
    ctx.restore();

    for (let i = 0; i <= lanes; i++) {
      const ix = left + i * laneW;
      // Đảo phân làn.
      ctx.beginPath();
      drawRoundRectCompat(ctx, ix, islandTop, islandW, islandH, Math.min(islandW / 2, 4));
      ctx.fillStyle = 'rgba(255,255,255,.96)';
      ctx.fill();
      ctx.lineWidth = thin;
      ctx.stroke();
      // Buồng thu phí trên đảo.
      const boothW = Math.min(islandW * 1.7, laneW * 0.42);
      const boothH = Math.min(canopyH * 0.36, boothW * 1.25);
      const bx = ix + islandW / 2 - boothW / 2;
      const by = y - boothH / 2;
      ctx.beginPath();
      drawRoundRectCompat(ctx, bx, by, boothW, boothH, Math.min(2.5, boothW * 0.2));
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.fill();
      ctx.lineWidth = Math.max(1, width);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx + boothW * 0.22, by + boothH * 0.32);
      ctx.lineTo(bx + boothW * 0.78, by + boothH * 0.32);
      ctx.lineWidth = thin;
      ctx.stroke();
    }

    // Barie chắn (cửa ra phía trên) và mũi tên hướng đi của từng làn.
    for (let i = 0; i < lanes; i++) {
      const laneLeft = left + islandW + i * laneW;
      const laneInner = laneW - islandW;
      const barY = canopyTop + canopyH * 0.14;
      ctx.save();
      ctx.lineWidth = Math.max(1.6, width * 1.4);
      ctx.setLineDash([Math.max(3, laneInner * 0.12), Math.max(2.4, laneInner * 0.09)]);
      ctx.beginPath();
      ctx.moveTo(laneLeft + 2, barY);
      ctx.lineTo(laneLeft + laneInner * 0.82, barY);
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(laneLeft + 2, barY, Math.max(1.6, width * 1.2), 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      const ax = laneLeft + laneInner / 2;
      const aTop = y + h * 0.24;
      const aBottom = Math.min(bottom - h * 0.04, y + h * 0.42);
      const head = Math.max(3, Math.min(7, laneInner * 0.2));
      ctx.lineWidth = thin;
      ctx.beginPath();
      ctx.moveTo(ax, aBottom);
      ctx.lineTo(ax, aTop);
      ctx.moveTo(ax - head, aTop + head);
      ctx.lineTo(ax, aTop);
      ctx.lineTo(ax + head, aTop + head);
      ctx.stroke();
    }

    // Nhãn khi đủ rộng.
    if (w >= 110 && h >= 60) {
      ctx.fillStyle = color;
      ctx.font = `700 ${Math.max(8, Math.min(12, h * 0.085))}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('TRẠM THU PHÍ', x, top + h * 0.02);
    }
    ctx.restore();
    return;
  }

  if (type === 'geo_circle') {
    const radius = Math.max(5, Math.min(w, h) * 0.43);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, width);
    ctx.stroke();
  } else if (type === 'geo_triangle' || type === 'geo_round_triangle') {
    const triangleW = w * 0.88;
    const triangleH = h * 0.88;
    ctx.beginPath();
    if (type === 'geo_round_triangle') {
      drawRoundedTriangleAssetPath(ctx, x, y, triangleW, triangleH, Math.min(triangleW, triangleH) * 0.12);
    } else {
      ctx.moveTo(x, y - triangleH / 2);
      ctx.lineTo(x + triangleW / 2, y + triangleH / 2);
      ctx.lineTo(x - triangleW / 2, y + triangleH / 2);
      ctx.closePath();
    }
    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, width);
    ctx.stroke();
  } else if (type === 'sign_circle_post' || type === 'sign_triangle_post') {
    const lineW = Math.max(1, width);
    const resolvedSignKind = shapeData && shapeData.signKind
      ? shapeData.signKind
      : (type === 'sign_triangle_post' ? 'intersection_non_priority' : 'speed_limit');
    const isPriorityDiamond = resolvedSignKind === 'priority_road' || resolvedSignKind === 'end_priority';
    const faceCenterY = top + h * 0.31;
    const faceSize = Math.min(w * 0.55, h * 0.58);
    const postTopY = faceCenterY + faceSize * 0.24;
    const postBottomY = y + h * 0.43;
    const postW = Math.max(2.5, w * 0.055);
    const postHeight = Math.max(1, postBottomY - postTopY);

    // Đầu trụ chạy chìm sau mặt biển và để hở nét trên, tránh tạo nắp bo cong ở mối nối.
    // Chỉ hai góc chân dưới được bo tròn.
    ctx.beginPath();
    drawTrafficSignPostPath(ctx, x, postTopY, postW, postHeight, postW / 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineW;
    strokeTrafficSignPostWithoutTop(ctx, x, postTopY, postW, postHeight, postW / 2);

    // Mặt biển trắng, viền đen rõ khi in.
    ctx.beginPath();
    if (isPriorityDiamond) {
      drawTrafficSignDiamondPath(ctx, x, faceCenterY, faceSize * 0.86);
    } else if (type === 'sign_circle_post') {
      ctx.arc(x, faceCenterY, faceSize * 0.46, 0, Math.PI * 2);
    } else {
      drawRoundedTriangleAssetPath(ctx, x, faceCenterY, faceSize, faceSize * 0.88, faceSize * 0.08);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.4, lineW * 1.2);
    ctx.stroke();

    // Viền trong kỹ thuật giúp phân biệt rõ với hình học thông thường.
    ctx.beginPath();
    if (isPriorityDiamond) {
      drawTrafficSignDiamondPath(ctx, x, faceCenterY, faceSize * 0.65);
    } else if (type === 'sign_circle_post') {
      ctx.arc(x, faceCenterY, faceSize * 0.35, 0, Math.PI * 2);
    } else {
      drawRoundedTriangleAssetPath(ctx, x, faceCenterY + faceSize * 0.015, faceSize * 0.76, faceSize * 0.66, faceSize * 0.055);
    }
    ctx.strokeStyle = 'rgba(71,85,105,.72)';
    ctx.lineWidth = Math.max(0.7, lineW * 0.58);
    ctx.stroke();

    if (isPriorityDiamond) {
      if (resolvedSignKind === 'end_priority') {
        ctx.beginPath();
        ctx.moveTo(x - faceSize * 0.28, faceCenterY + faceSize * 0.28);
        ctx.lineTo(x + faceSize * 0.28, faceCenterY - faceSize * 0.28);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.5, lineW * 1.45);
        ctx.lineCap = 'square';
        ctx.stroke();
      }
    } else {
      // Tâm thị giác của tam giác nằm thấp hơn tâm hộp bao; hạ ký hiệu xuống để
      // khoảng trống trên/dưới cân bằng như biển báo thực tế.
      const meaningCenterY = type === 'sign_triangle_post'
        ? faceCenterY + faceSize * 0.085
        : faceCenterY;
      const meaningSize = type === 'sign_triangle_post'
        ? faceSize * 0.54
        : faceSize * 0.72;
      drawTrafficSignMeaning(ctx, shapeData || { type }, x, meaningCenterY, meaningSize, color, lineW);
    }
  } else if (type === 'utility_pole') {
    const bottom = y + h / 2;
    const crossX = left + w * 0.23;
    const poleEndX = right - w * 0.13;
    const lineW = Math.max(0.9, width);

    // Ba vị trí sứ điện trên xà trụ.
    const wireRows = [top + h * 0.16, y, bottom - h * 0.16];

    // Thân trụ bê tông thuôn nhẹ, có lõi sáng và đường viền kỹ thuật.
    ctx.beginPath();
    ctx.moveTo(crossX - w * 0.012, y - h * 0.065);
    ctx.lineTo(poleEndX, y - h * 0.115);
    ctx.lineTo(poleEndX, y + h * 0.115);
    ctx.lineTo(crossX - w * 0.012, y + h * 0.065);
    ctx.closePath();
    ctx.fillStyle = 'rgba(203,213,225,.62)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineW;
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,.92)';
    ctx.lineWidth = Math.max(0.6, lineW * 0.55);
    ctx.moveTo(crossX + w * 0.04, y - h * 0.012);
    ctx.lineTo(poleEndX - w * 0.035, y - h * 0.025);
    ctx.stroke();

    // Xà kép bằng thép và hai thanh giằng tam giác.
    const beamThickness = Math.max(2.2, w * 0.026);
    ctx.beginPath();
    drawRoundRectCompat(ctx, crossX - beamThickness * 0.8, top + h * 0.055, beamThickness, h * 0.89, beamThickness * 0.45);
    ctx.fillStyle = '#364152';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineW;
    ctx.stroke();

    ctx.beginPath();
    drawRoundRectCompat(ctx, crossX + beamThickness * 0.55, top + h * 0.095, beamThickness * 0.72, h * 0.81, beamThickness * 0.32);
    ctx.fillStyle = 'rgba(100,116,139,.75)';
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(crossX + beamThickness, top + h * 0.13);
    ctx.lineTo(crossX + w * 0.1, y);
    ctx.lineTo(crossX + beamThickness, bottom - h * 0.13);
    ctx.stroke();

    // Ba chuỗi sứ có nhiều tầng đĩa, đầu nối và chụp sứ màu sáng.
    wireRows.forEach(insulatorY => {
      const chainStartX = crossX - w * 0.01;
      const chainEndX = crossX - w * 0.09;
      ctx.beginPath();
      ctx.moveTo(chainStartX, insulatorY);
      ctx.lineTo(chainEndX, insulatorY);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(0.7, lineW * 0.72);
      ctx.stroke();

      [0.025, 0.047, 0.069].forEach(offset => {
        const discX = crossX - w * offset;
        ctx.beginPath();
        ctx.moveTo(discX, insulatorY - h * 0.045);
        ctx.lineTo(discX, insulatorY + h * 0.045);
        ctx.stroke();
      });

      ctx.beginPath();
      ctx.arc(chainEndX, insulatorY, Math.max(1.45, h * 0.042), 0, Math.PI * 2);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
      ctx.stroke();
    });

    // Móng trụ bê tông bo góc, không còn hình tam giác giống mũi tên.
    ctx.beginPath();
    drawRoundRectCompat(ctx, poleEndX - w * 0.025, y - h * 0.19, w * 0.12, h * 0.38, Math.max(2, h * 0.07));
    ctx.fillStyle = 'rgba(148,163,184,.26)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineW;
    ctx.stroke();

    [y - h * 0.1, y + h * 0.1].forEach(boltY => {
      ctx.beginPath();
      ctx.arc(poleEndX + w * 0.033, boltY, Math.max(0.9, h * 0.025), 0, Math.PI * 2);
      ctx.fillStyle = '#475569';
      ctx.fill();
    });

  } else if (type === 'road_boundary_marker') {
    const lineW = Math.max(0.9, width);
    const tipX = left + w * 0.045;
    const shoulderX = left + w * 0.115;
    const baseX = right - w * 0.12;
    const bodyTop = y - h * 0.27;
    const bodyBottom = y + h * 0.27;
    const capEndX = left + w * 0.285;

    // Bóng tiếp xúc rất nhẹ giúp cọc nổi rõ mà vẫn giữ ngôn ngữ sơ đồ 2D.
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(baseX + w * 0.025, y + h * 0.1, w * 0.115, h * 0.31, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15,23,42,.11)';
    ctx.fill();
    ctx.restore();

    // Mặt chính bê tông trắng, thuôn nhẹ về phía chóp vát 10 độ.
    ctx.save();
    ctx.shadowColor = 'rgba(15,23,42,.16)';
    ctx.shadowBlur = Math.max(2, h * 0.12);
    ctx.shadowOffsetY = Math.max(1, h * 0.035);
    ctx.beginPath();
    ctx.moveTo(tipX, y);
    ctx.lineTo(shoulderX, bodyTop);
    ctx.lineTo(baseX, bodyTop + h * 0.025);
    ctx.lineTo(baseX, bodyBottom - h * 0.025);
    ctx.lineTo(shoulderX, bodyBottom);
    ctx.closePath();
    const concreteGradient = ctx.createLinearGradient(shoulderX, bodyTop, baseX, bodyBottom);
    concreteGradient.addColorStop(0, '#ffffff');
    concreteGradient.addColorStop(0.5, '#f4f6f8');
    concreteGradient.addColorStop(1, '#d8dee5');
    ctx.fillStyle = concreteGradient;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = lineW;
    ctx.stroke();
    ctx.restore();

    // Mặt cạnh xám mảnh tạo chiều sâu premium, không biến thành phối cảnh 3D nặng.
    ctx.beginPath();
    ctx.moveTo(shoulderX, bodyBottom);
    ctx.lineTo(baseX, bodyBottom - h * 0.025);
    ctx.lineTo(baseX + w * 0.045, bodyBottom - h * 0.095);
    ctx.lineTo(shoulderX + w * 0.025, bodyBottom - h * 0.07);
    ctx.closePath();
    ctx.fillStyle = 'rgba(148,163,184,.34)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(71,85,105,.72)';
    ctx.lineWidth = Math.max(0.55, lineW * 0.62);
    ctx.stroke();

    // Chóp đen chiếm khoảng 1/5 phần cọc nổi để giữ tỷ lệ 10/50 cm trên bản vẽ đơn sắc.
    ctx.beginPath();
    ctx.moveTo(tipX, y);
    ctx.lineTo(shoulderX, bodyTop);
    ctx.lineTo(capEndX, bodyTop + h * 0.006);
    ctx.lineTo(capEndX, bodyBottom - h * 0.006);
    ctx.lineTo(shoulderX, bodyBottom);
    ctx.closePath();
    const capGradient = ctx.createLinearGradient(tipX, bodyTop, capEndX, bodyBottom);
    capGradient.addColorStop(0, '#4b5563');
    capGradient.addColorStop(0.55, '#1f2937');
    capGradient.addColorStop(1, '#05070b');
    ctx.fillStyle = capGradient;
    ctx.fill();
    ctx.strokeStyle = '#05070b';
    ctx.lineWidth = Math.max(0.65, lineW * 0.7);
    ctx.stroke();

    // Vạch lõm và chữ đen nhận diện công năng mốc lộ giới.
    ctx.beginPath();
    ctx.moveTo(capEndX + w * 0.025, bodyTop + h * 0.07);
    ctx.lineTo(baseX - w * 0.035, bodyTop + h * 0.085);
    ctx.strokeStyle = 'rgba(255,255,255,.96)';
    ctx.lineWidth = Math.max(0.55, lineW * 0.55);
    ctx.stroke();

    const labelCenterX = capEndX + (baseX - capEndX) * 0.47;
    const labelMaxW = Math.max(12, (baseX - capEndX) * 0.84);
    let labelSize = Math.max(4.2, Math.min(8.2, h * 0.2));
    ctx.save();
    ctx.fillStyle = '#111827';
    ctx.font = `900 ${labelSize}px Arial, sans-serif`;
    while (ctx.measureText('MỐC LỘ GIỚI').width > labelMaxW && labelSize > 3.2) {
      labelSize -= 0.3;
      ctx.font = `900 ${labelSize}px Arial, sans-serif`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MỐC LỘ GIỚI', labelCenterX, y - h * 0.01);
    ctx.restore();

    // Chân chôn/đế bê tông được giản lược để dễ nhận biết trên sơ đồ hiện trường.
    ctx.beginPath();
    drawRoundRectCompat(ctx, baseX - w * 0.005, y - h * 0.34, w * 0.115, h * 0.68, Math.max(1.5, h * 0.06));
    ctx.fillStyle = 'rgba(203,213,225,.7)';
    ctx.fill();
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = lineW;
    ctx.stroke();
  } else if (type === 'pothole') {
    const lineW = Math.max(0.9, width);
    const toPoint = (nx, ny) => ({ x: x + nx * w, y: y + ny * h });
    const traceSmoothClosedPath = points => {
      if (!points || points.length < 3) return;
      const first = points[0];
      const last = points[points.length - 1];
      ctx.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
      for (let i = 0; i < points.length; i++) {
        const current = points[i];
        const next = points[(i + 1) % points.length];
        ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
      }
      ctx.closePath();
    };

    // Mép nhựa vỡ: bất quy tắc vừa phải, không tạo các múi tròn giống bông hoa.
    const outerRim = [
      toPoint(-0.42, -0.04), toPoint(-0.37, -0.25), toPoint(-0.20, -0.39),
      toPoint(0.03, -0.42), toPoint(0.24, -0.34), toPoint(0.40, -0.18),
      toPoint(0.43, 0.03), toPoint(0.34, 0.27), toPoint(0.14, 0.39),
      toPoint(-0.10, 0.41), toPoint(-0.31, 0.29), toPoint(-0.43, 0.12)
    ];
    ctx.beginPath();
    traceSmoothClosedPath(outerRim);
    ctx.fillStyle = 'rgba(226,232,240,.76)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineW;
    ctx.stroke();

    // Vành sụt bên trong tạo lớp chuyển tiếp từ mặt đường xuống lòng ổ.
    const innerRim = [
      toPoint(-0.31, -0.03), toPoint(-0.25, -0.20), toPoint(-0.07, -0.29),
      toPoint(0.14, -0.26), toPoint(0.29, -0.12), toPoint(0.31, 0.08),
      toPoint(0.20, 0.24), toPoint(0.00, 0.29), toPoint(-0.21, 0.23),
      toPoint(-0.33, 0.09)
    ];
    ctx.beginPath();
    traceSmoothClosedPath(innerRim);
    const depthFill = ctx.createLinearGradient(x, y - h * 0.3, x, y + h * 0.3);
    depthFill.addColorStop(0, 'rgba(148,163,184,.28)');
    depthFill.addColorStop(1, 'rgba(51,65,85,.42)');
    ctx.fillStyle = depthFill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(15,23,42,.88)';
    ctx.lineWidth = Math.max(0.75, lineW * 0.72);
    ctx.stroke();

    // Lòng sâu không dùng ellipse hoàn hảo để vẫn giữ cảm giác hư hỏng tự nhiên.
    const pitCore = [
      toPoint(-0.20, 0.00), toPoint(-0.14, -0.13), toPoint(0.01, -0.18),
      toPoint(0.17, -0.12), toPoint(0.21, 0.02), toPoint(0.13, 0.15),
      toPoint(-0.03, 0.19), toPoint(-0.18, 0.12)
    ];
    ctx.beginPath();
    traceSmoothClosedPath(pitCore);
    ctx.fillStyle = 'rgba(15,23,42,.38)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(15,23,42,.72)';
    ctx.lineWidth = Math.max(0.65, lineW * 0.58);
    ctx.stroke();

    // Nét địa hình ngắn mô tả độ dốc của thành hố, chỉ tập trung ở nửa dưới.
    ctx.strokeStyle = 'rgba(255,255,255,.82)';
    ctx.lineWidth = Math.max(0.6, lineW * 0.48);
    [
      [-0.19, 0.08, -0.12, 0.17],
      [-0.06, 0.11, -0.02, 0.20],
      [0.08, 0.10, 0.12, 0.17],
      [0.18, 0.04, 0.22, 0.12]
    ].forEach(mark => {
      ctx.beginPath();
      ctx.moveTo(x + mark[0] * w, y + mark[1] * h);
      ctx.lineTo(x + mark[2] * w, y + mark[3] * h);
      ctx.stroke();
    });

  } else if (type === 'tree') {
    const radius = Math.min(w, h) * 0.31;
    const canopy = [
      { x: x - radius * 0.48, y: y - radius * 0.3, r: radius * 0.86 },
      { x: x + radius * 0.48, y: y - radius * 0.22, r: radius * 0.82 },
      { x: x, y: y + radius * 0.42, r: radius * 0.92 },
      { x: x, y: y - radius * 0.56, r: radius * 0.76 }
    ];
    canopy.forEach((leaf, index) => {
      ctx.beginPath();
      ctx.arc(leaf.x, leaf.y, leaf.r, 0, Math.PI * 2);
      ctx.fillStyle = index % 2 ? 'rgba(83,155,92,.3)' : 'rgba(113,181,104,.38)';
      ctx.fill();
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2, radius * 0.22), 0, Math.PI * 2);
    ctx.fillStyle = '#8b6a45';
    ctx.fill();
    ctx.stroke();
  } else if (type === 'median_tree') {
    ctx.beginPath();
    drawRoundRectCompat(ctx, left, top + h * 0.17, w, h * 0.66, h * 0.28);
    ctx.fillStyle = 'rgba(148,163,184,.14)';
    ctx.fill();
    ctx.stroke();

    const count = Math.max(3, Math.min(7, Math.round(w / Math.max(20, h * 1.5))));
    for (let i = 0; i < count; i++) {
      const treeX = left + w * ((i + 0.5) / count);
      const crownR = Math.min(h * 0.3, w / count * 0.34);
      ctx.beginPath();
      ctx.arc(treeX, y, crownR, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? 'rgba(79,151,86,.4)' : 'rgba(105,177,96,.46)';
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(treeX, y, Math.max(1.2, crownR * 0.2), 0, Math.PI * 2);
      ctx.fillStyle = '#87663f';
      ctx.fill();
    }
  } else if (type === 'rice_field') {
    const borderRadius = Math.max(4, Math.min(13, h * 0.1));
    const outerLine = Math.max(1.15, width * 0.9);
    const inset = Math.max(3, Math.min(6, h * 0.055));

    // Nền trắng xám trung tính để bản in giữ đúng phong cách kỹ thuật, không ám vàng.
    ctx.beginPath();
    drawRoundRectCompat(ctx, left, top, w, h, borderRadius);
    ctx.fillStyle = 'rgba(248,250,252,.94)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = outerLine;
    ctx.stroke();

    // Viền trong mảnh tạo cảm giác một ký hiệu bản đồ hoàn chỉnh thay vì khung tô màu.
    if (w > inset * 5 && h > inset * 5) {
      ctx.beginPath();
      drawRoundRectCompat(ctx, left + inset, top + inset, w - inset * 2, h - inset * 2, Math.max(2, borderRadius - inset * 0.45));
      ctx.strokeStyle = 'rgba(15,23,42,.34)';
      ctx.lineWidth = Math.max(0.65, width * 0.48);
      ctx.stroke();
    }

    // Các luống ruộng có khoảng cách cố định tương đối; kéo ngang sẽ sinh thêm chi tiết
    // thay vì làm những nét cũ bị giãn dài thiếu tự nhiên.
    const innerLeft = left + Math.max(12, w * 0.035);
    const innerRight = right - Math.max(12, w * 0.035);
    const innerTop = top + Math.max(10, h * 0.13);
    const innerBottom = top + h - Math.max(10, h * 0.13);
    const usableHeight = Math.max(1, innerBottom - innerTop);
    const furrowCount = Math.max(3, Math.min(8, Math.round(usableHeight / 17) + 1));
    ctx.strokeStyle = 'rgba(15,23,42,.58)';
    ctx.lineWidth = Math.max(0.65, width * 0.5);
    for (let row = 0; row < furrowCount; row++) {
      const t = furrowCount === 1 ? 0.5 : row / (furrowCount - 1);
      const rowY = innerTop + usableHeight * t;
      const wave = Math.min(3.2, h * 0.022) * (row % 2 === 0 ? 1 : -1);
      ctx.beginPath();
      ctx.moveTo(innerLeft, rowY);
      ctx.bezierCurveTo(
        innerLeft + (innerRight - innerLeft) * 0.32, rowY - wave,
        innerLeft + (innerRight - innerLeft) * 0.68, rowY + wave,
        innerRight, rowY
      );
      ctx.stroke();
    }

    // Cụm lúa đơn sắc, lặp đều theo bề rộng và so le giữa các hàng.
    // Nhãn "ĐỒNG LÚA" nằm giữa khoảnh ruộng; các cụm lúa trùng vị trí nhãn được bỏ qua để chữ luôn dễ đọc.
    const riceLabel = getSceneryAreaLabelLayout(ctx, (shapeData && shapeData.areaLabel) || 'ĐỒNG LÚA', x, y, w, h);
    const plantRows = h >= 66 ? 2 : 1;
    const targetSpacing = Math.max(38, Math.min(54, h * 0.55));
    const plantColumns = Math.max(3, Math.min(20, Math.floor((innerRight - innerLeft) / targetSpacing)));
    const stemH = Math.max(8, Math.min(14, h * 0.16));
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.75, width * 0.62);
    for (let plantRow = 0; plantRow < plantRows; plantRow++) {
      const sy = plantRows === 1
        ? y
        : top + h * (plantRow === 0 ? 0.35 : 0.67);
      for (let column = 0; column < plantColumns; column++) {
        const laneWidth = (innerRight - innerLeft) / plantColumns;
        const stagger = plantRow % 2 ? laneWidth * 0.22 : 0;
        const sx = Math.min(innerRight - 4, innerLeft + laneWidth * (column + 0.5) + stagger);
        if (riceLabel &&
            sx + stemH * 0.5 > riceLabel.left - 3 && sx - stemH * 0.5 < riceLabel.right + 3 &&
            sy + stemH * 0.55 > riceLabel.top - 1 && sy - stemH * 0.55 < riceLabel.bottom + 1) {
          continue;
        }
        ctx.beginPath();
        ctx.moveTo(sx, sy + stemH * 0.52);
        ctx.lineTo(sx, sy - stemH * 0.52);
        ctx.moveTo(sx, sy - stemH * 0.04);
        ctx.quadraticCurveTo(sx - stemH * 0.2, sy - stemH * 0.25, sx - stemH * 0.43, sy - stemH * 0.32);
        ctx.moveTo(sx, sy + stemH * 0.1);
        ctx.quadraticCurveTo(sx + stemH * 0.2, sy - stemH * 0.1, sx + stemH * 0.44, sy - stemH * 0.18);
        ctx.stroke();
      }
    }
    drawSceneryAreaLabel(ctx, riceLabel, color, width, shapeData);
  } else if (type === 'forest') {
    const borderRadius = Math.max(4, Math.min(13, h * 0.1));
    const outerLine = Math.max(1.15, width * 0.9);
    const inset = Math.max(3, Math.min(6, h * 0.055));

    // Khung khu rừng: nền xanh rất nhạt để vẫn in rõ, viền liền bên ngoài.
    ctx.beginPath();
    drawRoundRectCompat(ctx, left, top, w, h, borderRadius);
    ctx.fillStyle = 'rgba(240,247,241,.94)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = outerLine;
    ctx.stroke();

    // Viền trong nét đứt thể hiện ranh giới bìa rừng theo quy ước bản đồ.
    if (w > inset * 5 && h > inset * 5) {
      ctx.save();
      ctx.beginPath();
      drawRoundRectCompat(ctx, left + inset, top + inset, w - inset * 2, h - inset * 2, Math.max(2, borderRadius - inset * 0.45));
      ctx.setLineDash([Math.max(3, h * 0.04), Math.max(2.5, h * 0.03)]);
      ctx.strokeStyle = 'rgba(15,23,42,.38)';
      ctx.lineWidth = Math.max(0.65, width * 0.48);
      ctx.stroke();
      ctx.restore();
    }

    const forestLabel = getSceneryAreaLabelLayout(ctx, (shapeData && shapeData.areaLabel) || 'RỪNG CÂY', x, y, w, h);

    // Tán cây nhìn từ trên xuống, xếp so le dày đặc. Kéo rộng khu rừng sẽ sinh thêm cây
    // thay vì kéo giãn tán cây; độ lệch ngẫu nhiên cố định giúp trông tự nhiên mà không nhấp nháy.
    const innerLeft = left + inset + 2;
    const innerRight = right - inset - 2;
    const innerTop = top + inset + 2;
    const innerBottom = top + h - inset - 2;
    const crownR = Math.max(5, Math.min(12, h * 0.15));
    const spacingX = crownR * 2.3;
    const spacingY = crownR * 1.9;
    const usableW = Math.max(0, innerRight - innerLeft - crownR * 2);
    const usableH = Math.max(0, innerBottom - innerTop - crownR * 2);
    const cols = Math.max(1, Math.floor(usableW / spacingX) + 1);
    const rows = Math.max(1, Math.floor(usableH / spacingY) + 1);
    const offsetX = (usableW - (cols - 1) * spacingX) / 2;
    const offsetY = (usableH - (rows - 1) * spacingY) / 2;
    const seeded = (a, b) => {
      const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
      return s - Math.floor(s);
    };
    const crownLine = Math.max(0.7, width * 0.55);

    for (let row = 0; row < rows; row++) {
      const stagger = row % 2 ? spacingX * 0.5 : 0;
      for (let col = 0; col < cols; col++) {
        let cx = innerLeft + crownR + offsetX + col * spacingX + stagger;
        if (cx > innerRight - crownR * 0.8) continue;
        cx += (seeded(row, col) - 0.5) * crownR * 0.35;
        const cy = innerTop + crownR + offsetY + row * spacingY + (seeded(col + 7, row + 3) - 0.5) * crownR * 0.3;
        const rr = crownR * (0.85 + seeded(row + 11, col + 5) * 0.22);
        if (forestLabel &&
            cx + rr > forestLabel.left - 3 && cx - rr < forestLabel.right + 3 &&
            cy + rr > forestLabel.top - 2 && cy - rr < forestLabel.bottom + 2) {
          continue;
        }

        // Tán cây dạng răng cưa mềm (6 thùy), tô xanh xen kẽ hai sắc độ.
        const phase = seeded(row + 3, col + 9) * Math.PI;
        const steps = 36;
        ctx.beginPath();
        for (let k = 0; k <= steps; k++) {
          const t = (k / steps) * Math.PI * 2;
          const rho = rr * (0.84 + 0.16 * Math.abs(Math.sin(3 * t + phase)));
          const px = cx + Math.cos(t) * rho;
          const py = cy + Math.sin(t) * rho;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = (row + col) % 2 ? 'rgba(79,151,86,.42)' : 'rgba(113,181,104,.48)';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = crownLine;
        ctx.stroke();

        // Gốc cây ở tâm tán.
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1, rr * 0.16), 0, Math.PI * 2);
        ctx.fillStyle = '#7c5a36';
        ctx.fill();
      }
    }
    drawSceneryAreaLabel(ctx, forestLabel, color, width, shapeData);
  }
  ctx.restore();
}


// Tính kích thước nhãn chữ đặt giữa các vùng cảnh quan (đồng lúa, rừng cây...).
// Trả về null nếu vùng quá nhỏ để hiển thị chữ rõ ràng.
function getSceneryAreaLabelLayout(ctx, text, x, y, w, h) {
  if (!text || w < 46 || h < 22) return null;
  let fontSize = Math.max(7, Math.min(11, h * 0.13));
  const maxTextW = w * 0.7;
  ctx.save();
  ctx.font = `800 ${fontSize}px Arial, sans-serif`;
  let textW = ctx.measureText(text).width;
  while (textW > maxTextW && fontSize > 6) {
    fontSize -= 0.5;
    ctx.font = `800 ${fontSize}px Arial, sans-serif`;
    textW = ctx.measureText(text).width;
  }
  ctx.restore();
  if (textW > maxTextW) return null;
  const padX = fontSize * 0.75;
  const padY = fontSize * 0.42;
  const boxW = textW + padX * 2;
  const boxH = fontSize + padY * 2;
  return {
    text, fontSize, x, y, boxW, boxH,
    left: x - boxW / 2, right: x + boxW / 2,
    top: y - boxH / 2, bottom: y + boxH / 2
  };
}


// Vẽ nhãn dạng viên thuốc nền trắng; tự lật 180° khi đối tượng bị xoay ngược để chữ không bị lộn đầu.
function drawSceneryAreaLabel(ctx, layout, color, width, shapeData) {
  if (!layout) return;
  const angle = shapeData && Number.isFinite(shapeData.angle) ? shapeData.angle : 0;
  ctx.save();
  ctx.translate(layout.x, layout.y);
  if (Math.cos(angle) < -0.0001) ctx.rotate(Math.PI);
  ctx.setLineDash([]);
  ctx.beginPath();
  drawRoundRectCompat(ctx, -layout.boxW / 2, -layout.boxH / 2, layout.boxW, layout.boxH, layout.boxH / 2);
  ctx.fillStyle = 'rgba(255,255,255,.97)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.8, width * 0.6);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = `800 ${layout.fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(layout.text, 0, layout.fontSize * 0.05);
  ctx.restore();
}


function drawTemplatePerson(ctx, x1, y1, x2, y2, color, width) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([]);
  const dist = Math.max(10, Math.hypot(y2 - y1, x2 - x1));
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.translate(x1, y1);
  ctx.rotate(angle);

  // Keep the whole symbol between the press point (x1/y1) and the pointer
  // (x2/y2). The old template used negative local X coordinates, so it was
  // rendered on the opposite side of the cursor and appeared to "jump".
  const headRadius = Math.max(2.5, dist * 0.1);
  const headCenterX = headRadius;
  const shoulderX = Math.max(headRadius * 2.3, dist * 0.25);
  const hipX = dist * 0.62;
  const limbOffset = dist * 0.22;

  ctx.beginPath();
  ctx.arc(headCenterX, 0, headRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(shoulderX, 0);
  ctx.lineTo(hipX, 0);
  ctx.moveTo(dist * 0.38, 0);
  ctx.lineTo(dist * 0.5, -limbOffset);
  ctx.moveTo(dist * 0.38, 0);
  ctx.lineTo(dist * 0.5, limbOffset);
  ctx.moveTo(hipX, 0);
  ctx.lineTo(dist, -limbOffset);
  ctx.moveTo(hipX, 0);
  ctx.lineTo(dist, limbOffset);
  ctx.stroke();
  ctx.restore();
}


function drawMeasureLine(ctx, x1, y1, x2, y2, color, width) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const tickLen = 8;
  ctx.save(); ctx.translate(x1, y1); ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(0, -tickLen); ctx.lineTo(0, tickLen); ctx.stroke();
  ctx.restore();
  
  ctx.save(); ctx.translate(x2, y2); ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(0, -tickLen); ctx.lineTo(0, tickLen); ctx.stroke();
  ctx.restore();
  ctx.restore();
}


function drawXMark(ctx, x, y, color, width, size=8) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x - size, y - size);
  ctx.lineTo(x + size, y + size);
  ctx.moveTo(x + size, y - size);
  ctx.lineTo(x - size, y + size);
  ctx.stroke();
  ctx.restore();
}


function drawNumberNoteMarker(ctx, shape) {
  const x = shape.x;
  const y = shape.y;
  const radius = shape.radius || 13;
  const outlineColor = shape.color || '#111827';

  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, .24)';
  ctx.shadowBlur = 7;
  ctx.shadowOffsetY = 2;
  const gradient = ctx.createRadialGradient(x - radius * 0.32, y - radius * 0.38, radius * 0.12, x, y, radius);
  gradient.addColorStop(0, '#fffdf6');
  gradient.addColorStop(0.58, '#f7e7bd');
  gradient.addColorStop(1, '#d8b46d');
  ctx.fillStyle = gradient;
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = Math.max(1.5, shape.width || 1.5);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.shadowColor = 'transparent';
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255,255,255,.86)';
  ctx.lineWidth = 1.2;
  ctx.arc(x, y, radius - 3, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#111827';
  ctx.font = `900 ${Math.max(10, radius * 1.02)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(shape.noteNumber || '?'), x, y + 0.6);
  ctx.restore();
}


function drawArrowLine(ctx, x1, y1, x2, y2, color, width, isDashed) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if(isDashed) ctx.setLineDash([5, 5]);
  else ctx.setLineDash([]);
  
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  
  ctx.setLineDash([]);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headlen = 10;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
  ctx.restore();
}


// ------------------------------------------
// UNDO, REDO & HISTORY (VECTOR SNAPSHOTS)
// ------------------------------------------
function saveDrawingState() {
  if (!sceneCanvas || !sceneCtx) return;
  if (historyIndex < drawingHistory.length - 1) {
    drawingHistory = drawingHistory.slice(0, historyIndex + 1);
  }
  if (drawingHistory.length >= 50) {
    drawingHistory.shift();
    historyIndex--;
  }
  drawingHistory.push({
    shapes: JSON.parse(JSON.stringify(sceneShapes)),
    templateMeta: cloneSceneTemplateMeta(ensureSceneTemplateMeta())
  });
  historyIndex = drawingHistory.length - 1;
  updateUndoRedoButtonsState();
  scheduleSceneDocumentAutoSave();
}


function undoSceneDrawing() {
  if (!sceneCanvas || !sceneCtx) return;
  if (historyIndex > 0) {
    historyIndex--;
    const state = drawingHistory[historyIndex];
    sceneShapes = (state && state.shapes) ? JSON.parse(JSON.stringify(state.shapes)) : [];
    if (state && state.templateMeta) sceneTemplateMeta = cloneSceneTemplateMeta(state.templateMeta);
    clearSelection();
    updateSelectionBadge();
    redrawSceneCanvas(currentDrawTool === 'select');
    updateUndoRedoButtonsState();
    scheduleSceneDocumentAutoSave();
  }
}


function redoSceneDrawing() {
  if (!sceneCanvas || !sceneCtx) return;
  if (historyIndex < drawingHistory.length - 1) {
    historyIndex++;
    const state = drawingHistory[historyIndex];
    sceneShapes = (state && state.shapes) ? JSON.parse(JSON.stringify(state.shapes)) : [];
    if (state && state.templateMeta) sceneTemplateMeta = cloneSceneTemplateMeta(state.templateMeta);
    clearSelection();
    updateSelectionBadge();
    redrawSceneCanvas(currentDrawTool === 'select');
    updateUndoRedoButtonsState();
    scheduleSceneDocumentAutoSave();
  }
}


function updateUndoRedoButtonsState() {
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex >= 0 && historyIndex < drawingHistory.length - 1;
  
  ['btnToolUndo', 'btnHeaderUndo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = !canUndo;
      el.style.opacity = canUndo ? '1' : '0.35';
      el.style.cursor = canUndo ? 'pointer' : 'not-allowed';
      if (canUndo) {
        el.setAttribute('title', 'Hoàn tác thao tác trước (Ctrl+Z)');
      } else {
        el.setAttribute('title', 'Không có thao tác để hoàn tác');
      }
    }
  });

  ['btnToolRedo', 'btnHeaderRedo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = !canRedo;
      el.style.opacity = canRedo ? '1' : '0.35';
      el.style.cursor = canRedo ? 'pointer' : 'not-allowed';
      if (canRedo) {
        el.setAttribute('title', 'Tiến tới thao tác vừa hủy (Ctrl+Y)');
      } else {
        el.setAttribute('title', 'Không có thao tác để tiến tới');
      }
    }
  });
}


async function clearDrawingCanvas() {
  if (await showPremiumConfirmModal({
    eyebrow:'SƠ ĐỒ HIỆN TRƯỜNG', title:'Xóa toàn bộ nét vẽ?',
    message:'Toàn bộ nét vẽ trên sơ đồ đang mở sẽ được xóa. Chọn Hủy bỏ để tiếp tục chỉnh sửa.',
    confirmText:'Xóa nét vẽ'
  })) {
    sceneShapes = [];
    selectedShapeId = null;
    updateSelectionBadge();
    redrawSceneCanvas(false);
    saveDrawingState();
  }
}


function cancelSceneCanvasInteraction() {
  const hadSelection = getSelectedShapes().length > 0;
  const hadActiveAction = currentDrawTool !== 'select' || isDrawing || isDraggingShape || isRotatingShape ||
    isDraggingCurveControl || isDraggingCurveStart || isDraggingCurveEnd ||
    isResizingLinearStart || isResizingLinearEnd || isResizingInfraBand ||
    isResizingNumberNote || isResizingVehicle || !!roadIntersectionResizeState || !!curvePendingStart || !!tireTrackPendingStart;

  if (roadIntersectionResizeState) {
    roadIntersectionResizeState.originals.forEach(({ shape, data }) => {
      Object.assign(shape, JSON.parse(JSON.stringify(data)));
      if (!Object.prototype.hasOwnProperty.call(data, 'presetScaleX')) delete shape.presetScaleX;
      if (!Object.prototype.hasOwnProperty.call(data, 'presetScaleY')) delete shape.presetScaleY;
    });
    roadIntersectionResizeState = null;
  }

  isDrawing = false;
  currentTempShape = null;
  curvePendingStart = null;
  tireTrackPendingStart = null;
  isDraggingShape = false;
  hasMovedDuringDrag = false;
  isRotatingShape = false;
  hasRotatedDuringDrag = false;
  isDraggingCurveControl = false;
  isDraggingCurveStart = false;
  isDraggingCurveEnd = false;
  isResizingLinearStart = false;
  isResizingLinearEnd = false;
  isResizingInfraBand = false;
  isResizingNumberNote = false;
  isResizingVehicle = false;
  hasResizedDuringDrag = false;
  isPanning = false;
  isSpacePressed = false;
  dragOriginals = [];
  rotationOriginals = [];
  rotationGroupCenter = null;
  resizeOriginalShapeData = null;
  vehicleResizeHandle = null;
  activeSnapGuides = [];
  clearSelection();

  isStrokePopoverOpen = false;
  const strokePopover = document.getElementById('strokeWidthPopover');
  if (strokePopover) strokePopover.style.display = 'none';
  closeAllToolSubmenus();
  setActiveDrawTool('select');
  updateSelectionBadge();
  redrawSceneCanvas(false);

  if ((hadSelection || hadActiveAction) && typeof showToast === 'function') {
    showToast('Đã thoát thao tác và bỏ chọn', 'info');
  }
}


function activateSceneToolShortcut(key) {
  const shortcut = SCENE_TOOL_SHORTCUTS[String(key || '').toLowerCase()];
  if (!shortcut) return false;
  let toolName = shortcut.tool;
  if (shortcut.group) {
    const groupConfig = TOOL_GROUPS_CONFIG[shortcut.group];
    toolName = groupActiveTools[shortcut.group] || (groupConfig && groupConfig.defaultTool);
  }
  if (!toolName) return false;
  closeAllToolSubmenus();
  setActiveDrawTool(toolName);
  return true;
}


function openSceneDrawingModal() {
  ensureSceneTemplateMeta(true);
  const modal = document.getElementById('sceneDrawingModalOverlay');
  if (modal) {
    modal.removeAttribute('aria-hidden');
    modal.style.display = 'flex';
  }
  document.body.style.overflow = 'hidden';
  initSceneRailPremiumScrollbar();
  // A saved diagram can be loaded before the drawing window is opened for the
  // first time. Always attach the canvas listeners here; otherwise the picture
  // is visible but cannot be selected, dragged or resized after reopening.
  setupDrawingToolListeners();
  if (typeof initSceneZoomAndPan === 'function') {
    initSceneZoomAndPan();
  }
  if (typeof resetSceneZoom === 'function') {
    resetSceneZoom();
  }
  if (historyIndex === -1) {
    setTimeout(function() {
      initSceneDrawing();
      if (typeof setStrokeWidthValue === 'function') {
        setStrokeWidthValue(1.5);
      }
      setActiveDrawTool('select');
    }, 100);
  } else {
    // Reopening an existing diagram always starts in Select mode so every
    // saved object is immediately editable instead of retaining the last tool.
    setActiveDrawTool('select');
    redrawSceneCanvas(true);
  }
}


function updateSceneRailPremiumScrollbar() {
  const rail = document.getElementById('sceneToolRail');
  const track = document.getElementById('sceneRailScrollbar');
  const thumb = document.getElementById('sceneRailScrollbarThumb');
  if (!rail || !track || !thumb) return;

  const trackHeight = track.clientHeight;
  const railHeight = rail.clientHeight;
  const scrollRange = Math.max(0, rail.scrollHeight - railHeight);
  if (!trackHeight || !railHeight || scrollRange <= 1) {
    track.style.display = 'none';
    return;
  }

  track.style.display = 'block';
  const visibleRatio = Math.min(1, railHeight / rail.scrollHeight);
  const thumbHeight = Math.max(48, Math.min(150, trackHeight * visibleRatio));
  const thumbTravel = Math.max(0, trackHeight - thumbHeight);
  const scrollProgress = Math.min(1, Math.max(0, rail.scrollTop / scrollRange));
  thumb.style.height = `${thumbHeight}px`;
  thumb.style.transform = `translateY(${thumbTravel * scrollProgress}px)`;
}


function initSceneRailPremiumScrollbar() {
  const rail = document.getElementById('sceneToolRail');
  const track = document.getElementById('sceneRailScrollbar');
  if (!rail || !track) return;

  if (rail.dataset.premiumScrollbarBound !== 'true') {
    rail.dataset.premiumScrollbarBound = 'true';
    rail.addEventListener('scroll', function() {
      updateSceneRailPremiumScrollbar();
      track.classList.add('is-active');
      window.clearTimeout(sceneRailScrollFadeTimer);
      sceneRailScrollFadeTimer = window.setTimeout(function() {
        track.classList.remove('is-active');
      }, 700);
    }, { passive: true });

    window.addEventListener('resize', updateSceneRailPremiumScrollbar, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      const railScrollbarObserver = new ResizeObserver(updateSceneRailPremiumScrollbar);
      railScrollbarObserver.observe(rail);
    }
  }

  window.requestAnimationFrame(updateSceneRailPremiumScrollbar);
}


function toggleToolRail(forceExpanded) {
  const rail = document.querySelector('.scene-tool-rail');
  if (!rail) return;
  const isExpanded = typeof forceExpanded === 'boolean'
    ? forceExpanded
    : !rail.classList.contains('expanded');
  rail.classList.toggle('expanded', isExpanded);

  if (typeof closeAllToolSubmenus === 'function') closeAllToolSubmenus();
  if (typeof closeStrokeWidthPopover === 'function') closeStrokeWidthPopover();

  const railHeader = document.getElementById('sceneToolRailHeader');
  const railBtn = document.getElementById('btnRailToggle');
  const railChevron = document.getElementById('railToggleChevron');
  const nextAction = isExpanded ? 'Thu gọn' : 'Mở rộng';

  rail.setAttribute('aria-label', `Thanh công cụ vẽ hiện trường — đang ${isExpanded ? 'mở rộng' : 'thu gọn'}`);
  rail.dataset.state = isExpanded ? 'expanded' : 'collapsed';
  if (railHeader) railHeader.title = `${nextAction} sidebar công cụ`;
  if (railBtn) {
    railBtn.setAttribute('aria-expanded', String(isExpanded));
    railBtn.setAttribute('aria-label', `${nextAction} sidebar công cụ`);
    railBtn.title = `${nextAction} sidebar công cụ`;
  }
  if (railChevron) {
    railChevron.setAttribute('points', isExpanded ? '16 9 13 12 16 15' : '13 9 16 12 13 15');
  }
  window.requestAnimationFrame(updateSceneRailPremiumScrollbar);
}


function closeSceneDrawingModal() {
  flushClaimDocumentAutoSave({guide:false}).catch(()=>{});
  closeSceneTemplateMetaEditor();
  closeSceneNumberNoteModal();
  closeSceneTextModal();
  closeTrafficSignEditor();
  const modal = document.getElementById('sceneDrawingModalOverlay');
  if (modal) {
    if (document.activeElement && modal.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    modal.style.display = 'none';
    modal.removeAttribute('aria-hidden');
  }
  document.body.style.overflow = '';
}


function cloneSceneDiagramShapes(shapes) {
  try {
    return JSON.parse(JSON.stringify(Array.isArray(shapes) ? shapes : []));
  } catch (error) {
    console.error('Không thể sao chép dữ liệu sơ đồ:', error);
    return [];
  }
}


function parseStoredSceneTemplateMeta(rawMeta) {
  if (!rawMeta) return null;
  try {
    const parsed = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return cloneSceneTemplateMeta(parsed);
    }
  } catch (error) {
    console.error('Dữ liệu thông tin mẫu sơ đồ không hợp lệ:', error);
  }
  return null;
}


function parseStoredSceneDiagramShapes(rawShapes) {
  if (!rawShapes) return [];
  try {
    const parsed = typeof rawShapes === 'string' ? JSON.parse(rawShapes) : rawShapes;
    if (Array.isArray(parsed)) return cloneSceneDiagramShapes(parsed);
    if (parsed && typeof parsed === 'object') {
      return cloneSceneDiagramShapes(Object.keys(parsed).sort((a, b) => Number(a) - Number(b)).map(key => parsed[key]));
    }
  } catch (error) {
    console.error('Dữ liệu vector sơ đồ không hợp lệ:', error);
  }
  return [];
}


function updateSceneDiagramPreview(dataUrl) {
  const preview = document.getElementById('sceneDiagramPreview');
  const container = document.getElementById('sceneDiagramPreviewContainer');
  if (preview) preview.src = dataUrl || '';
  if (container) container.style.display = dataUrl ? 'block' : 'none';
}


function hasEmbeddedSceneDiagramData(item) {
  if (!item || typeof item !== 'object') return false;
  return !!(
    item.soDoHienTruong ||
    item.soDoHienTruongData ||
    item.duLieuSoDoHienTruong ||
    item.soDoHienTruongMeta ||
    item.thongTinSoDoHienTruong
  );
}


function applySceneDiagramStoredData(rawRecord) {
  const item = rawRecord || {};
  sceneDiagramDataUrl = typeof item.imageDataUrl === 'string'
    ? item.imageDataUrl
    : (typeof item.soDoHienTruong === 'string' ? item.soDoHienTruong : '');
  sceneDiagramShapesSnapshot = parseStoredSceneDiagramShapes(
    item.shapes || item.soDoHienTruongData || item.duLieuSoDoHienTruong
  );
  sceneDiagramTemplateMetaSnapshot = parseStoredSceneTemplateMeta(
    item.templateMeta || item.soDoHienTruongMeta || item.thongTinSoDoHienTruong
  );
  sceneTemplateMeta = sceneDiagramTemplateMetaSnapshot
    ? cloneSceneTemplateMeta(sceneDiagramTemplateMetaSnapshot)
    : cloneSceneTemplateMeta(getDefaultSceneTemplateMeta());
  sceneDiagramCreatedAt = item.createdAt || item.soDoHienTruongUpdatedAt || null;
  sceneDiagramUpdatedAt = item.updatedAt || item.soDoHienTruongUpdatedAt || null;
  sceneShapes = cloneSceneDiagramShapes(sceneDiagramShapesSnapshot);
  selectedShapeId = null;
  selectedShapeIds = [];
  drawingHistory = sceneShapes.length || sceneDiagramDataUrl ? [{
    shapes: cloneSceneDiagramShapes(sceneShapes),
    templateMeta: cloneSceneTemplateMeta(sceneTemplateMeta)
  }] : [];
  historyIndex = drawingHistory.length ? 0 : -1;
  updateSceneDiagramPreview(sceneDiagramDataUrl);
  if (sceneCanvas && sceneCtx) redrawSceneCanvas(false);
  if (typeof updateUndoRedoButtonsState === 'function') updateUndoRedoButtonsState();
  if (typeof updateSelectionBadge === 'function') updateSelectionBadge();
}


function getSceneDiagramClaimReference(claimId, claimContext) {
  const item = claimContext || {};
  return claimDocumentReference(claimId,item);
}


function buildSceneDiagramStorageRecord(claimId, claimContext) {
  const now = sceneDiagramUpdatedAt || Date.now();
  const currentUser = firebase.auth().currentUser;
  const profile = activeUserProfile || {};
  if (!sceneDiagramCreatedAt) sceneDiagramCreatedAt = now;
  return {
    id: claimDocumentStorageKey(claimId,claimContext),
    claimId: String(claimId || ''),
    storageKey: claimDocumentStorageKey(claimId,claimContext),
    hsbtNormalized: normalizeClaimHsbt(claimContext?.soHoSoBoiThuong),
    imageDataUrl: sceneDiagramDataUrl || '',
    shapes: JSON.stringify(sceneDiagramShapesSnapshot || []),
    templateMeta: JSON.stringify(sceneDiagramTemplateMetaSnapshot || sceneTemplateMeta || {}),
    createdAt: sceneDiagramCreatedAt,
    updatedAt: now,
    savedByUid: String(currentUser?.uid || ''),
    savedByName: String(profile.displayName || currentUser?.displayName || currentUser?.email || ''),
    claimReference: getSceneDiagramClaimReference(claimId, claimContext)
  };
}


async function clearEmbeddedSceneDiagramFields(claimId) {
  if (!claimId || !dbNodeInstance) return;
  const cleanupPayload = {
    soDoHienTruong: null,
    soDoHienTruongData: null,
    duLieuSoDoHienTruong: null,
    soDoHienTruongMeta: null,
    thongTinSoDoHienTruong: null,
    soDoHienTruongUpdatedAt: null
  };
  await dbNodeInstance.ref(`pending_claims/${claimId}`).update(cleanupPayload);
  const cachedItem = cachedPendingClaimsPayload && cachedPendingClaimsPayload[claimId];
  if (cachedItem) Object.keys(cleanupPayload).forEach(key => delete cachedItem[key]);
}


async function loadSceneDiagramForClaim(claim,claimId) {
  const requestSequence=++sceneDiagramLoadSequence,item=claim||{},id=claimId||item.id||null;
  claimDocumentStore.sceneError=null;
  applySceneDiagramStoredData(hasEmbeddedSceneDiagramData(item)?item:null);
  if(!id || !dbNodeInstance)return;
  try {
    const embedded=hasEmbeddedSceneDiagramData(item)?buildEmbeddedSceneStorageRecord(id,item):null;
    const record=await resolveClaimDocument('scene_diagrams',id,item,embedded);
    if(requestSequence!==sceneDiagramLoadSequence || !claimDocumentFormNumberMatches(item))return;
    applySceneDiagramStoredData(record?.deleted?null:record);
  }catch(error){
    if(requestSequence===sceneDiagramLoadSequence){claimDocumentStore.sceneError=error;updateClaimDocumentAutoStatus();}
  }
}


function createSceneDrawingExportDataUrl() {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = 2000;
  exportCanvas.height = 1400;
  const expCtx = exportCanvas.getContext('2d');
  if (!expCtx) throw new Error('Trình duyệt không thể khởi tạo vùng xuất ảnh.');
  expCtx.scale(2, 2);
  expCtx.imageSmoothingEnabled = true;
  expCtx.imageSmoothingQuality = 'high';

  drawTemplate(expCtx, 1000, 700);
  expCtx.save();
  applySceneDrawingAreaClip(expCtx);
  for (let i = 0; i < sceneShapes.length; i++) renderShape(expCtx, sceneShapes[i]);
  expCtx.restore();

  const dataURL = exportCanvas.toDataURL('image/png');
  if (!dataURL || dataURL.length < 100) throw new Error('Ảnh sơ đồ xuất ra không hợp lệ.');
  return dataURL;
}


function printSceneDrawing() {
  const btnPrint = document.getElementById('btnPrintSceneDrawing');
  if (btnPrint) {
    btnPrint.disabled = true;
    btnPrint.style.opacity = '0.7';
  }

  try {
    // Export directly from vectors so selection handles and editor controls never appear.
    const dataURL = createSceneDrawingExportDataUrl();
    const printFrame = document.createElement('iframe');
    printFrame.setAttribute('aria-hidden', 'true');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '1px';
    printFrame.style.height = '1px';
    printFrame.style.border = '0';
    printFrame.style.opacity = '0';
    printFrame.style.pointerEvents = 'none';
    document.body.appendChild(printFrame);

    const printDoc = printFrame.contentDocument || printFrame.contentWindow.document;
    printDoc.open();
    printDoc.write(`<!doctype html><html><head><meta charset="utf-8"><title>In sơ đồ hiện trường</title><style>
      @page { size: A4 landscape; margin: 7mm; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #fff; }
      body { display: flex; align-items: center; justify-content: center; overflow: hidden; }
      img { display: block; width: 100%; height: auto; max-width: 100%; max-height: 100%; object-fit: contain; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    
</style></head><body><img id="scenePrintImage" alt="Sơ đồ hiện trường" src="${dataURL}"></body></html>`);
    printDoc.close();

    const cleanup = () => {
      if (printFrame && printFrame.parentNode) printFrame.parentNode.removeChild(printFrame);
    };
    const openPrintDialog = () => {
      try {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
      } catch (error) {
        cleanup();
        console.error('Không thể mở hộp thoại in:', error);
        const message = 'Không thể mở hộp thoại in: ' + (error && error.message ? error.message : 'Lỗi không xác định');
        if (typeof triggerToast === 'function') triggerToast(message, 'error');
        else alert(message);
      }
    };
    const printImage = printDoc.getElementById('scenePrintImage');
    printFrame.contentWindow.onafterprint = cleanup;
    if (printImage && printImage.complete) setTimeout(openPrintDialog, 80);
    else if (printImage) printImage.onload = () => setTimeout(openPrintDialog, 80);
    else throw new Error('Không thể chuẩn bị bản in.');

    // Fallback cleanup for browsers that do not emit afterprint.
    setTimeout(cleanup, 60000);
  } catch (error) {
    console.error('Lỗi in sơ đồ hiện trường:', error);
    const message = 'Không thể in sơ đồ: ' + (error && error.message ? error.message : 'Lỗi không xác định');
    if (typeof triggerToast === 'function') triggerToast(message, 'error');
    else alert(message);
  } finally {
    if (btnPrint) {
      btnPrint.disabled = false;
      btnPrint.style.opacity = '';
    }
  }
}


async function saveSceneDrawing() {
  if(!hasUserPermission('pending',editingPendingClaimId?'edit':'add'))return triggerToast('Bạn không có quyền lưu sơ đồ.','error');
  const button=document.getElementById('btnSaveSceneDrawing');if(button)button.disabled=true;
  try {
    await (claimDocumentStore.bindingPromise||Promise.resolve());
    await rebindClaimDocumentsByHsbt();
    if(claimDocumentStore.sceneError)throw claimDocumentStore.sceneError;
    claimDocumentStore.sceneDirty=true;
    if(canAutoSaveClaimDocuments())await flushClaimDocumentAutoSave({guide:false});
    else {
      sceneDiagramDataUrl=createSceneDrawingExportDataUrl();
      sceneDiagramShapesSnapshot=cloneSceneDiagramShapes(sceneShapes);
      sceneDiagramTemplateMetaSnapshot=cloneSceneTemplateMeta(ensureSceneTemplateMeta());
      sceneDiagramUpdatedAt=Date.now();updateSceneDiagramPreview(sceneDiagramDataUrl);
    }
    closeSceneDrawingModal();
    triggerToast(canAutoSaveClaimDocuments()?'Đã lưu sơ đồ theo số HSBT.':'Sơ đồ sẽ được lưu khi lưu hồ sơ hoặc nhập số HSBT.','success');
  }catch(error){triggerToast('Chưa lưu được sơ đồ: '+error.message,'error');}
  finally{if(button)button.disabled=false;}
}


async function removeSceneDiagram() {
  if(!hasUserPermission('pending','edit'))return triggerToast('Bạn không có quyền xoá sơ đồ.','error');
  const claimContext=editingPendingClaimId,bindingKey=claimDocumentStore.binding?.key,owner=firebase.auth().currentUser?.uid;
  if(!await showPremiumConfirmModal({
    eyebrow:'SƠ ĐỒ HIỆN TRƯỜNG', title:'Xóa sơ đồ đã lưu?',
    message:'Sơ đồ hiện trường đã lưu của hồ sơ này sẽ được xóa. Bạn cần vẽ và lưu lại nếu muốn sử dụng sơ đồ mới.',
    confirmText:'Xóa sơ đồ'
  }))return;
  const sameContext=()=>editingPendingClaimId===claimContext&&claimDocumentStore.binding?.key===bindingKey&&firebase.auth().currentUser?.uid===owner;
  if(!sameContext()||!hasUserPermission('pending','edit'))return;
  try {
    await flushClaimDocumentAutoSave({guide:false});
    if(!sameContext())return;
    const binding=claimDocumentStore.binding;
    if(binding && canAutoSaveClaimDocuments()) {
      const reference=currentClaimDocumentReference();
      await enqueueClaimDocumentWrite('scene',{deleted:true,storageKey:binding.key,hsbtNormalized:normalizeClaimHsbt(reference.soHoSoBoiThuong),claimReference:reference,updatedAt:Date.now()},binding);
    }
    claimDocumentStore.sceneDirty=false;
    applySceneDiagramStoredData(null);sceneShapes=[];drawingHistory=[];historyIndex=-1;
    triggerToast('Đã xoá sơ đồ hiện trường.','success');
  }catch(error){triggerToast('Chưa xoá được sơ đồ: '+error.message,'error');}
}


function getNextSceneNoteNumber() {
  normalizeSceneNoteNumbers();
  return getSortedSceneNumberNotes().length + 1;
}


function openSceneNumberNoteModal(existingShape = null, posX = 200, posY = 200) {
  const modal = document.getElementById('sceneNumberNoteModalOverlay');
  const input = document.getElementById('sceneNumberNoteInput');
  const badge = document.getElementById('sceneNumberNoteBadge');
  const title = document.getElementById('sceneNumberNoteTitle');
  const applyLabel = document.getElementById('sceneNumberNoteApplyLabel');
  if (!modal || !input) return;

  let noteNumber;
  if (existingShape && existingShape.type === 'number_note') {
    editingNumberNoteId = existingShape.id;
    noteNumber = existingShape.noteNumber || 1;
    input.value = existingShape.note || '';
    if (title) title.textContent = `Sửa chú thích số ${noteNumber}`;
    if (applyLabel) applyLabel.textContent = 'Cập nhật giải thích';
  } else {
    editingNumberNoteId = null;
    pendingNumberNotePos = { x: posX, y: posY };
    noteNumber = getNextSceneNoteNumber();
    input.value = '';
    if (title) title.textContent = `Thêm chú thích số ${noteNumber}`;
    if (applyLabel) applyLabel.textContent = 'Thêm chú thích';
  }

  if (badge) badge.textContent = String(noteNumber);
  modal.style.display = 'flex';
  modal.removeAttribute('aria-hidden');
  setTimeout(() => input.focus(), 40);
}


function closeSceneNumberNoteModal() {
  const modal = document.getElementById('sceneNumberNoteModalOverlay');
  if (modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  }
  editingNumberNoteId = null;
}


function applySceneNumberNoteModal() {
  const input = document.getElementById('sceneNumberNoteInput');
  const noteText = String(input ? input.value : '').trim();
  if (!noteText) {
    if (typeof showToast === 'function') showToast('Vui lòng nhập nội dung giải thích cho số này', 'warning');
    input?.focus();
    return;
  }

  if (editingNumberNoteId) {
    const shape = sceneShapes.find(item => item.id === editingNumberNoteId);
    if (shape && shape.type === 'number_note') shape.note = noteText;
  } else {
    const colorPicker = document.getElementById('drawColorPicker');
    const strokeInput = document.getElementById('drawStrokeWidth');
    const newShape = {
      id: genShapeId(),
      type: 'number_note',
      x: pendingNumberNotePos.x,
      y: pendingNumberNotePos.y,
      noteNumber: getNextSceneNoteNumber(),
      note: noteText,
      radius: 13,
      sizeScale: 1,
      color: colorPicker ? colorPicker.value : '#111827',
      width: strokeInput ? parseFloat(strokeInput.value) || 1.5 : 1.5
    };
    sceneShapes.push(newShape);
    setSelectedShapes([newShape.id]);
  }

  normalizeSceneNoteNumbers();
  closeSceneNumberNoteModal();
  setActiveDrawTool('select');
  updateSelectionBadge();
  redrawSceneCanvas(true);
  saveDrawingState();
  if (typeof showToast === 'function') showToast('Đã cập nhật số và nội dung trong cột Chú thích', 'success');
}
