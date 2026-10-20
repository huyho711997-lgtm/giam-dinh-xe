

function hitTestShape(shape, px, py) {
  if (shape.type === 'text') {
    const dim = getTextDimensions(shape);
    const center = getShapeCenter(shape);
    const angle = shape.angle || 0;
    const dx = px - center.x;
    const dy = py - center.y;
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    const pad = 10;
    return Math.abs(lx) <= dim.w / 2 + pad && Math.abs(ly) <= dim.h / 2 + pad;
  }

  const box = getShapeBoundingBox(shape);
  if (!box) return false;
  const pad = 8;
  if (px < box.minX - pad || px > box.maxX + pad || py < box.minY - pad || py > box.maxY + pad) {
    return false;
  }

  if (shape.type === 'curve' || shape.type === 'curve_dashed') {
    const threshold = Math.max(16, (shape.width || 2) + 8);
    let prevX = shape.x1, prevY = shape.y1;
    for (let i = 1; i <= 24; i++) {
      const t = i / 24;
      const curX = (1 - t)**2 * shape.x1 + 2 * (1 - t) * t * shape.cx + t**2 * shape.x2;
      const curY = (1 - t)**2 * shape.y1 + 2 * (1 - t) * t * shape.cy + t**2 * shape.y2;
      if (distToSegment({ x: px, y: py }, { x: prevX, y: prevY }, { x: curX, y: curY }) <= threshold) {
        return true;
      }
      prevX = curX;
      prevY = curY;
    }
    return false;
  }

  if (shape.type === 'pen' || shape.type === 'eraser' || shape.type === 'tire_track') {
    const threshold = shape.type === 'tire_track'
      ? Math.max(14, getTireTrackSpacing(shape) / 2 + (shape.width || 2) * 1.5 + 5)
      : Math.max(12, (shape.width || 2) + 6);
    if (!shape.points || shape.points.length <= 1) {
      if (shape.points && shape.points[0]) {
        return Math.hypot(px - shape.points[0].x, py - shape.points[0].y) <= threshold;
      }
      return false;
    }
    for (let i = 0; i < shape.points.length - 1; i++) {
      if (distToSegment({ x: px, y: py }, shape.points[i], shape.points[i+1]) <= threshold) {
        return true;
      }
    }
    return false;
  }
  if (isLinearResizableShape(shape)) {
    const threshold = getLinearShapeHalfBand(shape) + 7;
    return distToSegment({ x: px, y: py }, { x: shape.x1, y: shape.y1 }, { x: shape.x2, y: shape.y2 }) <= threshold;
  }
  if (shape.type === 'rect') {
    const angle = shape.angle || 0;
    const cx = shape.x + shape.w / 2;
    const cy = shape.y + shape.h / 2;
    const dx = px - cx;
    const dy = py - cy;
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    return Math.abs(lx) <= Math.abs(shape.w) / 2 + 6 && Math.abs(ly) <= Math.abs(shape.h) / 2 + 6;
  }
  if (isVehicleShape(shape)) {
    const dx = px - shape.startX;
    const dy = py - shape.startY;
    const cos = Math.cos(-shape.angle);
    const sin = Math.sin(-shape.angle);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    const { w: targetW, h: targetH } = getVehicleDimensions(shape);
    return lx >= -10 && lx <= targetW + 10 && Math.abs(ly) <= targetH / 2 + 10;
  }
  if (shape.type === 'xmark') {
    const s = shape.size || 8;
    return Math.hypot(px - shape.x, py - shape.y) <= s + 10;
  }
  if (shape.type === 'number_note') {
    return Math.hypot(px - shape.x, py - shape.y) <= (shape.radius || 13) + 8;
  }
  return true;
}


function setShapePositionFromOriginal(shape, orig, dx, dy) {
  if (!shape || !orig) return;
  if (shape.type === 'curve' || shape.type === 'curve_dashed') {
    shape.x1 = orig.x1 + dx;
    shape.y1 = orig.y1 + dy;
    shape.x2 = orig.x2 + dx;
    shape.y2 = orig.y2 + dy;
    shape.cx = orig.cx + dx;
    shape.cy = orig.cy + dy;
  } else if (isLinearResizableShape(shape)) {
    shape.x1 = orig.x1 + dx;
    shape.y1 = orig.y1 + dy;
    shape.x2 = orig.x2 + dx;
    shape.y2 = orig.y2 + dy;
  } else if (shape.type === 'rect') {
    shape.x = orig.x + dx;
    shape.y = orig.y + dy;
  } else if (shape.type === 'text') {
    shape.x = orig.x + dx;
    shape.y = orig.y + dy;
  } else if (isVehicleShape(shape)) {
    shape.startX = orig.startX + dx;
    shape.startY = orig.startY + dy;
  } else if (shape.type === 'xmark' || shape.type === 'number_note') {
    shape.x = orig.x + dx;
    shape.y = orig.y + dy;
  } else if (shape.type === 'pen' || shape.type === 'eraser' || shape.type === 'tire_track') {
    if (orig.points) {
      shape.points = orig.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
    }
    if (shape.type === 'tire_track' && orig.curveSource) {
      shape.curveSource = {
        x1: orig.curveSource.x1 + dx,
        y1: orig.curveSource.y1 + dy,
        cx: orig.curveSource.cx + dx,
        cy: orig.curveSource.cy + dy,
        x2: orig.curveSource.x2 + dx,
        y2: orig.curveSource.y2 + dy
      };
    }
  }
}


function moveShapeBy(shape, dx, dy) {
  if (!shape) return;
  if (shape.type === 'curve' || shape.type === 'curve_dashed') {
    shape.x1 += dx; shape.y1 += dy;
    shape.x2 += dx; shape.y2 += dy;
    shape.cx += dx; shape.cy += dy;
  } else if (isLinearResizableShape(shape)) {
    shape.x1 += dx; shape.y1 += dy;
    shape.x2 += dx; shape.y2 += dy;
  } else if (shape.type === 'rect' || shape.type === 'text') {
    shape.x += dx; shape.y += dy;
  } else if (isVehicleShape(shape)) {
    shape.startX += dx; shape.startY += dy;
  } else if (shape.type === 'xmark' || shape.type === 'number_note') {
    shape.x += dx; shape.y += dy;
  } else if (shape.type === 'pen' || shape.type === 'eraser' || shape.type === 'tire_track') {
    if (shape.points) {
      shape.points.forEach(p => { p.x += dx; p.y += dy; });
    }
    if (shape.type === 'tire_track' && shape.curveSource) {
      shape.curveSource.x1 += dx; shape.curveSource.y1 += dy;
      shape.curveSource.cx += dx; shape.curveSource.cy += dy;
      shape.curveSource.x2 += dx; shape.curveSource.y2 += dy;
    }
  }
}


// ------------------------------------------
// SELECTION UI, ROTATION HANDLE & BADGE
// ------------------------------------------
function drawShapeSelectionBox(ctx, shape) {
  if (!shape) return;
  const pad = 6;
  const stemLen = 26;

  // Oriented Bounding Box for Rotated Vehicles
  if (isVehicleShape(shape)) {
    const { w, h } = getVehicleDimensions(shape);

    ctx.save();
    ctx.translate(shape.startX, shape.startY);
    ctx.rotate(shape.angle);

    // 1. Outer subtle gold glow
    ctx.strokeStyle = 'rgba(216, 180, 109, 0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(-pad - 1, -h/2 - pad - 1, w + pad*2 + 2, h + pad*2 + 2);

    // 2. Dashed bounding box
    ctx.strokeStyle = '#d8b46d';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(-pad, -h/2 - pad, w + pad*2, h + pad*2);

    // 3. Large functional handles (8 border handles)
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#92691d';
    ctx.lineWidth = 1.5;
    const hs = 9;
    const handles = [
      { x: -pad, y: -h/2 - pad },
      { x: w + pad, y: -h/2 - pad },
      { x: w + pad, y: h/2 + pad },
      { x: -pad, y: h/2 + pad },
      { x: w/2, y: -h/2 - pad },
      { x: w/2, y: h/2 + pad },
      { x: -pad, y: 0 },
      { x: w + pad, y: 0 }
    ];
    handles.forEach(pt => {
      ctx.fillRect(pt.x - hs/2, pt.y - hs/2, hs, hs);
      ctx.strokeRect(pt.x - hs/2, pt.y - hs/2, hs, hs);
    });

    // 4. Rotation Handle Stem
    const rotY = -h/2 - pad - stemLen;
    ctx.beginPath();
    ctx.strokeStyle = '#d8b46d';
    ctx.lineWidth = 1.6;
    ctx.moveTo(w/2, -h/2 - pad);
    ctx.lineTo(w/2, rotY);
    ctx.stroke();

    // 5. Rotation Handle Icon
    drawRotationHandleIcon(ctx, w/2, rotY);

    ctx.restore();
    return;
  }

  // Oriented Bounding Box for Text (Rotates with shape just like vehicles)
  if (shape.type === 'text') {
    const dim = getTextDimensions(shape);
    const w = dim.w;
    const h = dim.h;
    const center = getShapeCenter(shape);
    const angle = shape.angle || 0;

    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(angle);

    const pad = 8;
    const stemLen = 28;

    // 1. Outer subtle gold glow
    ctx.strokeStyle = 'rgba(216, 180, 109, 0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(-w/2 - pad - 1, -h/2 - pad - 1, w + pad*2 + 2, h + pad*2 + 2);

    // 2. Dashed bounding box
    ctx.strokeStyle = '#d8b46d';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(-w/2 - pad, -h/2 - pad, w + pad*2, h + pad*2);

    // 3. Handles (8 border handles)
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#92691d';
    ctx.lineWidth = 1.5;
    const hs = 6;
    const handles = [
      { x: -w/2 - pad, y: -h/2 - pad },
      { x: w/2 + pad, y: -h/2 - pad },
      { x: w/2 + pad, y: h/2 + pad },
      { x: -w/2 - pad, y: h/2 + pad },
      { x: 0, y: -h/2 - pad },
      { x: 0, y: h/2 + pad },
      { x: -w/2 - pad, y: 0 },
      { x: w/2 + pad, y: 0 }
    ];
    handles.forEach(pt => {
      ctx.fillRect(pt.x - hs/2, pt.y - hs/2, hs, hs);
      ctx.strokeRect(pt.x - hs/2, pt.y - hs/2, hs, hs);
    });

    // 4. Rotation Handle Stem
    const rotY = -h/2 - pad - stemLen;
    ctx.beginPath();
    ctx.strokeStyle = '#d8b46d';
    ctx.lineWidth = 1.6;
    ctx.moveTo(0, -h/2 - pad);
    ctx.lineTo(0, rotY);
    ctx.stroke();

    // 5. Rotation Handle Icon
    drawRotationHandleIcon(ctx, 0, rotY);

    ctx.restore();
    return;
  }

  // Vệt bánh xe cong: hiển thị trực tiếp hai điểm đầu/cuối và điểm điều khiển độ cong.
  if (isCurvedTireTrack(shape)) {
    const source = shape.curveSource;
    const rotPos = getShapeRotationHandlePos(shape);
    const center = getShapeCenter(shape);
    ctx.save();
    ctx.strokeStyle = 'rgba(216, 180, 109, 0.58)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(source.x1, source.y1);
    ctx.lineTo(source.cx, source.cy);
    ctx.lineTo(source.x2, source.y2);
    ctx.stroke();

    ctx.setLineDash([]);
    [
      { x: source.x1, y: source.y1 },
      { x: source.x2, y: source.y2 }
    ].forEach(point => {
      ctx.beginPath();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2.2;
      ctx.rect(point.x - 5.5, point.y - 5.5, 11, 11);
      ctx.fill();
      ctx.stroke();
    });

    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#d8b46d';
    ctx.lineWidth = 2.5;
    ctx.arc(source.cx, source.cy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = '#d8b46d';
    ctx.arc(source.cx, source.cy, 4, 0, Math.PI * 2);
    ctx.fill();

    if (rotPos) {
      ctx.beginPath();
      ctx.strokeStyle = '#d8b46d';
      ctx.lineWidth = 1.5;
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(rotPos.x, rotPos.y);
      ctx.stroke();
      drawRotationHandleIcon(ctx, rotPos.x, rotPos.y);
    }
    ctx.restore();
    return;
  }

  // Oriented Handles for Quadratic Curves (Curve / Curve Dashed)
  if (shape.type === 'curve' || shape.type === 'curve_dashed') {
    ctx.save();
    // 1. Dashed triangle guide connecting start -> control point -> end
    ctx.strokeStyle = 'rgba(216, 180, 109, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(shape.x1, shape.y1);
    ctx.lineTo(shape.cx, shape.cy);
    ctx.lineTo(shape.x2, shape.y2);
    ctx.stroke();

    // 2. Control Point handle (Curvature handle at cx, cy)
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#d8b46d';
    ctx.lineWidth = 2.2;
    ctx.arc(shape.cx, shape.cy, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = '#d8b46d';
    ctx.arc(shape.cx, shape.cy, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // 3. Start Point handle (x1, y1)
    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.arc(shape.x1, shape.y1, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 4. End Point handle (x2, y2)
    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.arc(shape.x2, shape.y2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 5. Rotation handle above center
    const rotPos = getShapeRotationHandlePos(shape);
    if (rotPos) {
      const center = getShapeCenter(shape);
      ctx.beginPath();
      ctx.strokeStyle = '#d8b46d';
      ctx.lineWidth = 1.6;
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(rotPos.x, rotPos.y);
      ctx.stroke();

      drawRotationHandleIcon(ctx, rotPos.x, rotPos.y);
    }

    ctx.restore();
    return;
  }

  // Oriented selection guide for straight objects with two functional resize handles
if (isLinearResizableShape(shape)) {
  const dx = shape.x2 - shape.x1;
  const dy = shape.y2 - shape.y1;
  const len = Math.max(0.001, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;
  const halfBand = getLinearShapeHalfBand(shape);
  const rotPos = getShapeRotationHandlePos(shape);
  const visibleEndpoints = getVisibleLinearResizeEndpoints(shape);
  const startPoint = visibleEndpoints?.start || { x: shape.x1, y: shape.y1 };
  const endPoint = visibleEndpoints?.end || { x: shape.x2, y: shape.y2 };

  const p1a = { x: startPoint.x + nx * halfBand, y: startPoint.y + ny * halfBand };
  const p2a = { x: endPoint.x + nx * halfBand, y: endPoint.y + ny * halfBand };
  const p2b = { x: endPoint.x - nx * halfBand, y: endPoint.y - ny * halfBand };
  const p1b = { x: startPoint.x - nx * halfBand, y: startPoint.y - ny * halfBand };

    ctx.save();

    ctx.beginPath();
    ctx.moveTo(p1a.x, p1a.y);
    ctx.lineTo(p2a.x, p2a.y);
    ctx.lineTo(p2b.x, p2b.y);
    ctx.lineTo(p1b.x, p1b.y);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(216, 180, 109, .32)';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.stroke();

    ctx.strokeStyle = '#d8b46d';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.stroke();

    // Clear endpoint handles: drag either square to shorten or extend the object.
    ctx.setLineDash([]);
    const handleSize = 9;
  [
    startPoint,
    endPoint
  ].forEach(point => {
      ctx.shadowColor = 'rgba(216, 180, 109, .28)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#a77822';
      ctx.lineWidth = 2;
      ctx.fillRect(point.x - handleSize / 2, point.y - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(point.x - handleSize / 2, point.y - handleSize / 2, handleSize, handleSize);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    });

    if (isInfrastructureAssetShape(shape)) {
      const center = getShapeCenter(shape);
      const bandHandles = [
        { x: center.x + nx * halfBand, y: center.y + ny * halfBand },
        { x: center.x - nx * halfBand, y: center.y - ny * halfBand }
      ];
      bandHandles.forEach(point => {
        ctx.beginPath();
        ctx.fillStyle = '#d8b46d';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.arc(point.x, point.y, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }

    if (rotPos) {
      const center = getShapeCenter(shape);
      const topX = center.x - nx * halfBand;
      const topY = center.y - ny * halfBand;
      ctx.beginPath();
      ctx.strokeStyle = '#d8b46d';
      ctx.lineWidth = 1.6;
      ctx.moveTo(topX, topY);
      ctx.lineTo(rotPos.x, rotPos.y);
      ctx.stroke();
      drawRotationHandleIcon(ctx, rotPos.x, rotPos.y);
    }

    ctx.restore();
    return;
  }

  // Standard Bounding Box for other shapes
  const box = getShapeBoundingBox(shape);
  if (!box) return;
  const rotPos = getShapeRotationHandlePos(shape);

  ctx.save();
  ctx.strokeStyle = 'rgba(216, 180, 109, 0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(box.minX - 1, box.minY - 1, box.maxX - box.minX + 2, box.maxY - box.minY + 2);

  ctx.strokeStyle = '#d8b46d';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY);

  ctx.setLineDash([]);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#92691d';
  ctx.lineWidth = 1.5;
  const hs = 6;
  const corners = [
    { x: box.minX, y: box.minY },
    { x: box.maxX, y: box.minY },
    { x: box.minX, y: box.maxY },
    { x: box.maxX, y: box.maxY },
    { x: (box.minX + box.maxX)/2, y: box.minY },
    { x: (box.minX + box.maxX)/2, y: box.maxY },
    { x: box.minX, y: (box.minY + box.maxY)/2 },
    { x: box.maxX, y: (box.minY + box.maxY)/2 }
  ];
  corners.forEach(c => {
    ctx.fillRect(c.x - hs/2, c.y - hs/2, hs, hs);
    ctx.strokeRect(c.x - hs/2, c.y - hs/2, hs, hs);
  });

  // Rotation Handle Stem & Icon
  if (rotPos) {
    const topCenterX = (box.minX + box.maxX) / 2;
    ctx.beginPath();
    ctx.strokeStyle = '#d8b46d';
    ctx.lineWidth = 1.6;
    ctx.moveTo(topCenterX, box.minY);
    ctx.lineTo(rotPos.x, rotPos.y);
    ctx.stroke();

    drawRotationHandleIcon(ctx, rotPos.x, rotPos.y);
  }

  ctx.restore();
}


function drawMultiSelectionBox(ctx, shapes) {
  if (!shapes || shapes.length === 0) return;
  const cBox = getCollectiveBoundingBox(shapes);
  if (!cBox) return;

  const isGroup = isSelectionGrouped();
  const themeColor = isGroup ? '#3b82f6' : '#d8b46d';
  const themeRgba = isGroup ? 'rgba(59, 130, 246, 0.25)' : 'rgba(216, 180, 109, 0.25)';
  const labelText = getSelectedRoadIntersectionShapes().length ? 'Ngã tư' : isGroup ? `Nhóm (${shapes.length})` : `Đã chọn (${shapes.length})`;

  ctx.save();

  // 1. Draw subtle dashed outline for each child shape
  shapes.forEach(shape => {
    const sBox = getShapeBoundingBox(shape);
    if (sBox) {
      ctx.strokeStyle = isGroup ? 'rgba(59, 130, 246, 0.45)' : 'rgba(216, 180, 109, 0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(sBox.minX - 3, sBox.minY - 3, sBox.maxX - sBox.minX + 6, sBox.maxY - sBox.minY + 6);
    }
  });

  // 2. Draw collective bounding box
  const pad = 8;
  const bx = cBox.x1 - pad;
  const by = cBox.y1 - pad;
  const bw = (cBox.x2 - cBox.x1) + pad * 2;
  const bh = (cBox.y2 - cBox.y1) + pad * 2;

  // Outer glow
  ctx.strokeStyle = themeRgba;
  ctx.lineWidth = 4;
  ctx.setLineDash([]);
  ctx.strokeRect(bx - 1, by - 1, bw + 2, bh + 2);

  // Main box
  ctx.strokeStyle = themeColor;
  ctx.lineWidth = 1.8;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(bx, by, bw, bh);

  // 8 handles
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = themeColor;
  ctx.lineWidth = 1.5;
  const hs = 7;
  const corners = getSceneMultiResizeHandles(cBox);
  corners.forEach(c => {
    ctx.fillRect(c.x - hs / 2, c.y - hs / 2, hs, hs);
    ctx.strokeRect(c.x - hs / 2, c.y - hs / 2, hs, hs);
  });

  // Label tag at top-left
  ctx.fillStyle = themeColor;
  const tagW = Math.max(68, labelText.length * 7 + 14);
  const tagH = 18;
  const tagY = by - tagH - 4;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(bx, tagY, tagW, tagH, 3);
  } else {
    ctx.rect(bx, tagY, tagW, tagH);
  }
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(labelText, bx + tagW / 2, tagY + tagH / 2);

  // Rotation Handle Stem & Icon on top center
  const stemLen = 26;
  const rotX = cBox.cx;
  const rotY = by - stemLen;

  ctx.beginPath();
  ctx.strokeStyle = themeColor;
  ctx.lineWidth = 1.6;
  ctx.moveTo(rotX, by);
  ctx.lineTo(rotX, rotY);
  ctx.stroke();

  drawRotationHandleIcon(ctx, rotX, rotY);

  ctx.restore();
}
function getShapeDisplayName(shape) {
  if (!shape) return 'Đối tượng';
  switch (shape.type) {
    case 'car': return 'Xe ô tô';
    case 'container': return 'Xe container';
    case 'bike': return 'Xe máy';
    case 'fallen_bike': return 'Xe máy nằm ngã';
    case 'curve': return 'Đường cong nét liền';
    case 'curve_dashed': return 'Đường cong nét đứt';
    case 'road_line': return 'Vạch kẻ đường nét liền';
    case 'road_dashed': return 'Vạch kẻ đường nét đứt';
    case 'road_edge': return 'Lề đường / Bó vỉa';
    case 'crosswalk': return 'Vạch sang đường người đi bộ';
    case 'traffic_light': return 'Đèn tín hiệu giao thông';
    case 'median': return 'Dải phân cách cứng';
    case 'median_blocks': return 'Dải phân cách ghép khối';
    case 'utility_pole': return 'Trụ điện';
    case 'road_boundary_marker': return 'Cột mốc lộ giới';
    case 'pothole': return 'Ổ gà';
    case 'geo_circle': return 'Hình tròn';
    case 'geo_triangle': return 'Hình tam giác';
    case 'geo_round_triangle': return 'Hình tam giác bo góc';
    case 'sign_circle_post': return 'Biển báo tròn có trụ';
    case 'sign_triangle_post': return 'Biển báo tam giác có trụ';
    case 'tree': return 'Cây xanh';
    case 'median_tree': return 'Cây trên dải phân cách';
    case 'rice_field': return 'Đồng lúa';
    case 'forest': return 'Rừng cây';
    case 'line': return 'Mũi tên di chuyển (nét liền)';
    case 'dashed_line': return 'Mũi tên di chuyển (nét đứt)';
    case 'rect': return 'Khối hộp / Hộ lan';
    case 'person': return 'Người / Nạn nhân';
    case 'measure': return 'Đo khoảng cách';
    case 'xmark': return 'Điểm va chạm (X)';
    case 'number_note': return `Chú thích số ${shape.noteNumber || '?'}`;
    case 'text': return `Chữ: "${(shape.text || '').substring(0, 15)}"`;
    case 'tire_track': return 'Vệt bánh xe';
    case 'pen': return 'Nét vẽ tự do';
    case 'eraser': return 'Vết xóa';
    default: return 'Đối tượng';
  }
}


function updateSelectionBadge() {
  const badge = document.getElementById('sceneSelectedBadge');
  const nameEl = document.getElementById('selectedShapeName');
  const angleTextEl = document.getElementById('selectedShapeAngleText');
  const strokeTextEl = document.getElementById('selectedStrokeText');
  if (!badge) return;
  if (!selectedShapeId || currentDrawTool !== 'select') {
    badge.style.display = 'none';
    return;
  }
  const shape = sceneShapes.find(s => s.id === selectedShapeId);
  if (!shape) {
    badge.style.display = 'none';
    return;
  }
  if (nameEl) nameEl.textContent = `Đã chọn: ${getShapeDisplayName(shape)}`;
  if (angleTextEl) {
    const deg = getShapeAngleDegrees(shape);
    angleTextEl.textContent = `${deg}°`;
  }
  if (strokeTextEl) {
    const sw = shape.width || 2.5;
    strokeTextEl.textContent = `${parseFloat(sw).toFixed(1)}px`;
  }
  const btnEdit = document.getElementById('btnEditTextShape');
  const btnEditTrafficSign = document.getElementById('btnEditTrafficSign');
  const btnAlignCenters = document.getElementById('btnAlignShapeCenters');
  const btnGroup = document.getElementById('btnGroupShapes');
  const btnUngroup = document.getElementById('btnUngroupShapes');
  const grpContainer = document.getElementById('selectedGroupToolsGroup');
  const curveToolsGroup = document.getElementById('selectedCurveToolsGroup');
  const lineToolsGroup = document.getElementById('selectedLineToolsGroup');
  const sizeToolsGroup = document.getElementById('selectedSizeToolsGroup');
  const sizeTextEl = document.getElementById('selectedSizeText');
  const sizeLabelEl = document.getElementById('selectedSizeLabel');
  const btnDecreaseSize = document.getElementById('btnDecreaseSelectedSize');
  const btnIncreaseSize = document.getElementById('btnIncreaseSelectedSize');
  const btnCycleOverlap = document.getElementById('btnCycleOverlap');
  const resizeHint = document.getElementById('sceneSelectionResizeHint');
  if (resizeHint) resizeHint.textContent = 'Cạnh trái/phải: kéo ngang • Cạnh trên/dưới: kéo dọc • Góc: giữ tỷ lệ';

  const selShapes = getSelectedShapes();
  if (selShapes.length > 1) {
    const isGroup = isSelectionGrouped();
    const isIntersection = getSelectedRoadIntersectionShapes().length > 0;
    if (nameEl) {
      nameEl.textContent = isIntersection ? 'Đã chọn: Ngã tư đường' : isGroup
        ? `Đã chọn nhóm: ${selShapes.length} đối tượng`
        : `Đã chọn: ${selShapes.length} đối tượng`;
    }
    if (angleTextEl) angleTextEl.textContent = '--°';
    if (strokeTextEl) {
      const sw = selShapes[0].width || 2;
      strokeTextEl.textContent = `${parseFloat(sw).toFixed(1)}px`;
    }
    if (grpContainer) grpContainer.style.display = 'inline-flex';
    if (btnAlignCenters) btnAlignCenters.style.display = isIntersection ? 'none' : 'inline-flex';
    const btnAlignHorizontalMulti = document.getElementById('btnAlignShapeHorizontal');
    if (btnAlignHorizontalMulti) btnAlignHorizontalMulti.style.display = isIntersection ? 'none' : 'inline-flex';
    if (btnGroup) btnGroup.style.display = isGroup ? 'none' : 'inline-flex';
    if (btnUngroup) btnUngroup.style.display = isGroup ? 'inline-flex' : 'none';

    if (curveToolsGroup) curveToolsGroup.style.display = 'none';
    if (lineToolsGroup) lineToolsGroup.style.display = 'none';
    if (sizeToolsGroup) sizeToolsGroup.style.display = isIntersection ? 'inline-flex' : 'none';
    if (isIntersection) {
      if (resizeHint) resizeHint.textContent = 'Kéo cạnh: đổi một chiều • Kéo góc: đổi hai chiều • Shift + góc: giữ tỷ lệ';
      if (sizeLabelEl) sizeLabelEl.textContent = 'Kích thước ngã tư';
      if (sizeTextEl) {
        const scaleX = selShapes[0].presetScaleX || selShapes[0].presetScale || 1;
        const scaleY = selShapes[0].presetScaleY || selShapes[0].presetScale || 1;
        sizeTextEl.textContent = Math.abs(scaleX - scaleY) < 0.0001
          ? `${Math.round(scaleX * 100)}%` : `${Math.round(scaleX * 100)}% × ${Math.round(scaleY * 100)}%`;
      }
      if (btnDecreaseSize) btnDecreaseSize.title = 'Thu nhỏ toàn bộ ngã tư 10%';
      if (btnIncreaseSize) btnIncreaseSize.title = 'Phóng to toàn bộ ngã tư 10%';
    }
    if (btnEdit) btnEdit.style.display = 'none';
    if (btnEditTrafficSign) btnEditTrafficSign.style.display = 'none';
    if (btnCycleOverlap) btnCycleOverlap.style.display = 'none';

    const layerTextEl = document.getElementById('selectedShapeLayerText');
    if (layerTextEl) {
      layerTextEl.textContent = `${selShapes.length} hình`;
    }

    badge.style.display = 'inline-flex';
    return;
  }

  // Single shape selected
  if (selShapes.length === 1 && shape) {
    if (nameEl) {
      nameEl.textContent = shape.groupId 
        ? `[Nhóm] ${getShapeDisplayName(shape)}` 
        : `Đã chọn: ${getShapeDisplayName(shape)}`;
    }
    if (grpContainer) grpContainer.style.display = shape.groupId ? 'inline-flex' : 'none';
    if (btnAlignCenters) btnAlignCenters.style.display = 'none';
    const btnAlignHorizontalSingle = document.getElementById('btnAlignShapeHorizontal');
    if (btnAlignHorizontalSingle) btnAlignHorizontalSingle.style.display = 'none';
    if (btnGroup) btnGroup.style.display = 'none';
    if (btnUngroup) btnUngroup.style.display = shape.groupId ? 'inline-flex' : 'none';
    if (btnCycleOverlap) btnCycleOverlap.style.display = 'inline-flex';
  }

  if (btnEdit) {
    const canEditContent = shape.type === 'text' || shape.type === 'number_note';
    btnEdit.style.display = canEditContent ? 'inline-flex' : 'none';
    btnEdit.title = shape.type === 'number_note' ? 'Sửa nội dung giải thích cho số này' : 'Sửa nội dung hoặc định dạng chữ';
    const editLabel = document.getElementById('btnEditShapeLabel');
    if (editLabel) editLabel.textContent = shape.type === 'number_note' ? 'Sửa giải thích' : 'Sửa chữ';
  }
  if (btnEditTrafficSign) {
    btnEditTrafficSign.style.display = isTrafficSignPostType(shape.type) ? 'inline-flex' : 'none';
  }
  if (sizeToolsGroup) {
    sizeToolsGroup.style.display = isSizeAdjustableShape(shape) ? 'inline-flex' : 'none';
  }
  if (sizeTextEl && isSizeAdjustableShape(shape)) {
    sizeTextEl.textContent = `${Math.round((shape.sizeScale || 1) * 100)}%`;
  }
  if (sizeLabelEl) {
    sizeLabelEl.textContent = shape.type === 'road_edge' ? 'Độ cao' : 'Kích thước';
  }
  if (btnDecreaseSize) {
    btnDecreaseSize.title = shape.type === 'road_edge' ? 'Giảm độ cao lề đường 10%' : 'Thu nhỏ 10%';
  }
  if (btnIncreaseSize) {
    btnIncreaseSize.title = shape.type === 'road_edge' ? 'Tăng độ cao lề đường 10%' : 'Phóng to 10%';
  }
  const layerTextEl = document.getElementById('selectedShapeLayerText');
  if (layerTextEl) {
    const idx = sceneShapes.findIndex(s => s.id === selectedShapeId);
    if (idx !== -1) {
      layerTextEl.textContent = `${idx + 1}/${sceneShapes.length}`;
    }
  }

  const isCurveType = shape.type === 'curve' || shape.type === 'curve_dashed';
  const hasCurveAdjustment = isCurveType || isCurvedTireTrack(shape);
  if (curveToolsGroup) {
    curveToolsGroup.style.display = hasCurveAdjustment ? 'inline-flex' : 'none';
  }

  const isLineType = isCurveType || shape.type === 'road_line' || shape.type === 'road_dashed' || shape.type === 'line' || shape.type === 'dashed_line';
  const isVehicleDashType = isRoadVehicleShape(shape);
  if (lineToolsGroup) {
    lineToolsGroup.style.display = (isLineType || isVehicleDashType) ? 'inline-flex' : 'none';
  }
  const btnToggleArrow = document.getElementById('btnToggleLineArrow');
  if (btnToggleArrow) {
    btnToggleArrow.style.display = isLineType ? 'inline-flex' : 'none';
    if (isLineType) {
      const hasArrow = isCurveType ? !!shape.hasArrow : (shape.type === 'line' || shape.type === 'dashed_line');
      btnToggleArrow.innerHTML = hasArrow 
        ? '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line></svg> Bỏ mũi tên'
        : '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="12 5 19 12 12 19"/></svg> Thêm mũi tên';
    }
  }
  const btnToggleDash = document.getElementById('btnToggleLineDash');
  if (btnToggleDash) {
    btnToggleDash.style.display = (isLineType || isVehicleDashType) ? 'inline-flex' : 'none';
    if (isLineType || isVehicleDashType) {
      const isDashed = isVehicleDashType
        ? !!shape.dashed
        : (shape.type === 'curve_dashed' || shape.type === 'road_dashed' || shape.type === 'dashed_line');
      btnToggleDash.innerHTML = isDashed ? 'Chuyển nét liền' : 'Chuyển nét đứt';
      btnToggleDash.style.background = isDashed ? 'rgba(216,180,109,.18)' : 'transparent';
      btnToggleDash.style.color = isDashed ? '#d8b46d' : '#e2e8f0';
      btnToggleDash.title = isVehicleDashType
        ? (isDashed ? 'Đổi xe về nét liền' : 'Vẽ xe bằng nét đứt')
        : 'Chuyển đổi giữa nét liền và nét đứt';
    }
  }

  badge.style.display = 'inline-flex';
}


function toggleStrokeWidthPopover(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const popover = document.getElementById('strokeWidthPopover');
  const btn = document.getElementById('btnStrokeWidthToggle');
  const strokeWrap = document.getElementById('strokeWidthWrap');
  const badgeBtn = document.getElementById('selectedStrokeBadge');
  if (!popover) return;

  isStrokePopoverOpen = !isStrokePopoverOpen;
  popover.style.display = isStrokePopoverOpen ? 'flex' : 'none';
  if (isStrokePopoverOpen && btn) {
    const host = popover.parentElement;
    const rail = document.getElementById('sceneToolRail');
    if (host) {
      const hostRect = host.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      const railRect = rail ? rail.getBoundingClientRect() : null;
      const nextLeft = railRect ? railRect.right - hostRect.left + 12 : 86;
      const desiredTop = btnRect.top - hostRect.top - Math.min(72, Math.max(22, popover.offsetHeight * 0.28));
      const maxTop = Math.max(12, hostRect.height - popover.offsetHeight - 12);
      popover.style.left = `${Math.max(12, nextLeft)}px`;
      popover.style.top = `${Math.max(12, Math.min(maxTop, desiredTop))}px`;
    }
  }
  if (badgeBtn) {
    badgeBtn.setAttribute('aria-expanded', isStrokePopoverOpen ? 'true' : 'false');
  }
  if (strokeWrap) {
    strokeWrap.setAttribute('aria-expanded', isStrokePopoverOpen ? 'true' : 'false');
  }
  if (btn) {
    btn.style.borderColor = isStrokePopoverOpen ? 'var(--primary)' : 'var(--border)';
    btn.style.background = isStrokePopoverOpen ? 'rgba(216,180,109,0.15)' : 'var(--surface)';
  }

  // Update live sample color
  const curColor = document.getElementById('drawColorPicker')?.value || '#000000';
  const liveSample = document.getElementById('popoverLiveSample');
  if (liveSample) liveSample.style.background = curColor;
}


function setStrokeWidthValue(val) {
  const num = parseFloat(val);
  const hiddenInput = document.getElementById('drawStrokeWidth');
  if (hiddenInput) hiddenInput.value = num;

  const slider = document.getElementById('popoverSlider');
  if (slider) slider.value = num;

  const valBadge = document.getElementById('popoverWidthValue');
  if (valBadge) valBadge.textContent = `${num.toFixed(1)} px`;

  const toolbarText = document.getElementById('toolbarStrokeText');
  if (toolbarText) toolbarText.textContent = `${num.toFixed(1)}`.replace('.0', '');

  const liveSample = document.getElementById('popoverLiveSample');
  if (liveSample) {
    liveSample.style.height = `${Math.max(1, Math.min(18, num))}px`;
    const curColor = document.getElementById('drawColorPicker')?.value || '#000000';
    liveSample.style.background = curColor;
  }

  const toolbarDot = document.getElementById('toolbarStrokePreviewDot');
  if (toolbarDot) {
    const dotSize = Math.max(4, Math.min(14, num * 1.8));
    toolbarDot.style.width = `${dotSize}px`;
    toolbarDot.style.height = `${dotSize}px`;
  }

  // Highlight active preset chip
  document.querySelectorAll('.stroke-preset-btn').forEach(btn => {
    const text = btn.querySelector('span:last-child')?.textContent;
    if (text && Math.abs(parseFloat(text) - num) < 0.2) {
      btn.style.borderColor = 'var(--primary)';
      btn.style.background = 'rgba(216, 180, 109, 0.2)';
      btn.style.color = '#d8b46d';
      btn.style.fontWeight = '800';
    } else {
      btn.style.borderColor = 'rgba(255,255,255,0.12)';
      btn.style.background = 'rgba(255,255,255,0.06)';
      btn.style.color = '#fff';
      btn.style.fontWeight = '700';
    }
  });

  // Ở chế độ tẩy, thanh độ lớn điều chỉnh kích thước khung vuông thay vì sửa nét cũ.
  if (currentDrawTool === 'eraser') {
    eraserTargetShapeId = eraserHoverPos ? (findEraserTargetAt(eraserHoverPos.x, eraserHoverPos.y)?.id || null) : null;
    redrawSceneCanvas(false);
  // If a shape is currently selected, UPDATE ITS STROKE WIDTH LIVE!
  } else if (selectedShapeId) {
    const shape = sceneShapes.find(s => s.id === selectedShapeId);
    if (shape) {
      const intersection = getSelectedRoadIntersectionShapes();
      (intersection.length ? intersection : [shape]).forEach(item => { item.width = num; });
      if (shape.type === 'text') {
        shape.size = num * 4 + 12;
      }
      updateSelectionBadge();
      redrawSceneCanvas(true);
      saveDrawingState();
    }
  }
}


function onStrokeSliderInput(val) {
  setStrokeWidthValue(val);
}


function setStrokeColor(hex) {
  const picker = document.getElementById('drawColorPicker');
  if (picker) picker.value = hex;
  onColorPickerChange(hex);
}


function onColorPickerChange(hex) {
  const swatch = document.getElementById('drawColorSwatch');
  if (swatch) swatch.style.background = hex;

  const liveSample = document.getElementById('popoverLiveSample');
  if (liveSample) liveSample.style.background = hex;

  const toolbarDot = document.getElementById('toolbarStrokePreviewDot');
  if (toolbarDot) toolbarDot.style.background = hex;

  // If a shape is selected, UPDATE ITS COLOR LIVE!
  if (selectedShapeId) {
    const shape = sceneShapes.find(s => s.id === selectedShapeId);
    if (shape) {
      const intersection = getSelectedRoadIntersectionShapes();
      (intersection.length ? intersection : [shape]).forEach(item => { item.color = hex; });
      redrawSceneCanvas(true);
      saveDrawingState();
    }
  }
}


function syncStrokeUI(width, color) {
  if (width !== undefined && width !== null) {
    const num = parseFloat(width);
    const hiddenInput = document.getElementById('drawStrokeWidth');
    if (hiddenInput) hiddenInput.value = num;

    const slider = document.getElementById('popoverSlider');
    if (slider) slider.value = num;

    const valBadge = document.getElementById('popoverWidthValue');
    if (valBadge) valBadge.textContent = `${num.toFixed(1)} px`;

    const toolbarText = document.getElementById('toolbarStrokeText');
    if (toolbarText) toolbarText.textContent = `${num.toFixed(1)}`.replace('.0', '');

    const toolbarDot = document.getElementById('toolbarStrokePreviewDot');
    if (toolbarDot) {
      const dotSize = Math.max(4, Math.min(14, num * 1.8));
      toolbarDot.style.width = `${dotSize}px`;
      toolbarDot.style.height = `${dotSize}px`;
      if (color) toolbarDot.style.background = color;
    }

    const liveSample = document.getElementById('popoverLiveSample');
    if (liveSample) {
      liveSample.style.height = `${Math.max(1, Math.min(18, num))}px`;
      if (color) liveSample.style.background = color;
    }

    document.querySelectorAll('.stroke-preset-btn').forEach(btn => {
      const text = btn.querySelector('span:last-child')?.textContent;
      if (text && Math.abs(parseFloat(text) - num) < 0.2) {
        btn.style.borderColor = 'var(--primary)';
        btn.style.background = 'rgba(216, 180, 109, 0.2)';
        btn.style.color = '#d8b46d';
        btn.style.fontWeight = '800';
      } else {
        btn.style.borderColor = 'rgba(255,255,255,0.12)';
        btn.style.background = 'rgba(255,255,255,0.06)';
        btn.style.color = '#fff';
        btn.style.fontWeight = '700';
      }
    });
  }

  if (color) {
    const swatch = document.getElementById('drawColorSwatch');
    if (swatch) swatch.style.background = color;
    const picker = document.getElementById('drawColorPicker');
    if (picker) picker.value = color;
  }
}


function alignSelectedShapeCenters() {
  const sel = getSelectedShapes();
  if (sel.length < 2) {
    if (typeof showToast === 'function') {
      showToast('Giữ Ctrl và chọn ít nhất 2 đối tượng để căn giữa', 'info');
    }
    return;
  }

  const selectionBounds = getCollectiveBoundingBox(sel);
  if (!selectionBounds) return;

  for (let i = 0; i < sel.length; i++) {
    const shapeBounds = getShapeBoundingBox(sel[i]);
    if (!shapeBounds) continue;
    const shapeCenterX = (shapeBounds.minX + shapeBounds.maxX) / 2;
    const shapeCenterY = (shapeBounds.minY + shapeBounds.maxY) / 2;
    moveShapeBy(sel[i], selectionBounds.cx - shapeCenterX, selectionBounds.cy - shapeCenterY);
  }

  updateSelectionBadge();
  redrawSceneCanvas(true);
  saveDrawingState();
  if (typeof showToast === 'function') {
    showToast(`Đã căn giữa ${sel.length} đối tượng theo cùng một tâm`, 'success');
  }
}


// Căn ngang: đưa tâm theo trục dọc (Y) của các đối tượng về cùng một hàng,
// giữ nguyên vị trí theo chiều ngang (X) để các đối tượng nằm thẳng hàng với nhau.
function alignSelectedShapesHorizontal() {
  const sel = getSelectedShapes();
  if (sel.length < 2) {
    if (typeof showToast === 'function') {
      showToast('Giữ Ctrl và chọn ít nhất 2 đối tượng để căn ngang', 'info');
    }
    return;
  }

  const selectionBounds = getCollectiveBoundingBox(sel);
  if (!selectionBounds) return;

  for (let i = 0; i < sel.length; i++) {
    const shapeBounds = getShapeBoundingBox(sel[i]);
    if (!shapeBounds) continue;
    const shapeCenterY = (shapeBounds.minY + shapeBounds.maxY) / 2;
    moveShapeBy(sel[i], 0, selectionBounds.cy - shapeCenterY);
  }

  updateSelectionBadge();
  redrawSceneCanvas(true);
  saveDrawingState();
  if (typeof showToast === 'function') {
    showToast(`Đã căn ngang ${sel.length} đối tượng trên cùng một hàng`, 'success');
  }
}


function groupSelectedShapes() {
  const sel = getSelectedShapes();
  if (sel.length < 2) {
    if (typeof showToast === 'function') {
      showToast('Vui lòng chọn từ 2 đối tượng trở lên (Giữ phím Ctrl + Click) để nhóm', 'info');
    }
    return;
  }
  const newGroupId = 'grp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  for (let i = 0; i < sel.length; i++) {
    sel[i].groupId = newGroupId;
  }
  updateSelectionBadge();
  redrawSceneCanvas(true);
  saveDrawingState();
  if (typeof showToast === 'function') {
    showToast(`Đã nhóm ${sel.length} đối tượng lại với nhau (Ctrl+G)`, 'success');
  }
}


function ungroupSelectedShapes() {
  const sel = getSelectedShapes();
  if (sel.length === 0) return;
  let count = 0;
  for (let i = 0; i < sel.length; i++) {
    if (sel[i].groupId) {
      sel[i].groupId = null;
      count++;
    }
  }
  updateSelectionBadge();
  redrawSceneCanvas(true);
  saveDrawingState();
  if (typeof showToast === 'function') {
    showToast('Đã rã nhóm thành các đối tượng riêng lẻ (Ctrl+Shift+G)', 'success');
  }
}


function deleteSelectedShape() {
  const sel = getSelectedShapes();
  if (sel.length === 0) return;
  const delIds = new Set(sel.map(s => s.id));
  sceneShapes = sceneShapes.filter(s => !delIds.has(s.id));
  normalizeSceneNoteNumbers();
  clearSelection();
  updateSelectionBadge();
  redrawSceneCanvas(false);
  saveDrawingState();
  if (typeof showToast === 'function') {
    showToast(`Đã xóa ${sel.length > 1 ? sel.length + ' đối tượng' : 'đối tượng'}`, 'info');
  }
}


function copySelectedShape() {
  const sel = getSelectedShapes();
  if (sel.length === 0) return;
  sceneClipboardShapes = JSON.parse(JSON.stringify(sel));
  sceneClipboard = sceneClipboardShapes[0];
  if (typeof showToast === 'function') {
    showToast(`Đã sao chép ${sel.length > 1 ? sel.length + ' đối tượng' : getShapeDisplayName(sel[0])} (Ctrl+C)`, 'info');
  }
}


function pasteCopiedShape() {
  if (!sceneClipboardShapes || sceneClipboardShapes.length === 0) {
    if (sceneClipboard) {
      sceneClipboardShapes = [sceneClipboard];
    } else {
      if (typeof showToast === 'function') {
        showToast('Chưa có nét vẽ nào trong bộ nhớ tạm để dán', 'warning');
      }
      return;
    }
  }

  const isGrp = sceneClipboardShapes.length > 1 && sceneClipboardShapes[0].groupId;
  const newGroupId = isGrp ? 'grp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6) : null;
  const newShapes = [];
  const offset = 22;

  for (let i = 0; i < sceneClipboardShapes.length; i++) {
    const orig = sceneClipboardShapes[i];
    const clone = JSON.parse(JSON.stringify(orig));
    clone.id = genShapeId();
    if (newGroupId) {
      clone.groupId = newGroupId;
    } else if (!orig.groupId) {
      clone.groupId = null;
    }
    if (clone.type === 'number_note') clone.noteNumber = getNextSceneNoteNumber();
    moveShapeBy(clone, offset, offset);
    sceneShapes.push(clone);
    newShapes.push(clone);
  }

  normalizeSceneNoteNumbers();

  sceneClipboardShapes = JSON.parse(JSON.stringify(newShapes));
  sceneClipboard = newShapes[0];

  setSelectedShapes(newShapes.map(s => s.id));
  setActiveDrawTool('select');
  updateSelectionBadge();
  redrawSceneCanvas(true);
  saveDrawingState();

  if (typeof showToast === 'function') {
    showToast(`Đã dán ${newShapes.length > 1 ? newShapes.length + ' đối tượng' : getShapeDisplayName(newShapes[0])} (Ctrl+V)`, 'success');
  }
}


function duplicateSelectedShape() {
  const sel = getSelectedShapes();
  if (sel.length === 0) return;
  copySelectedShape();
  pasteCopiedShape();
}


function bringShapeForward() {
  const sel = getSelectedShapes();
  if (sel.length === 0) return;
  if (sel.length === 1) {
    const idx = sceneShapes.findIndex(s => s.id === sel[0].id);
    if (idx !== -1 && idx < sceneShapes.length - 1) {
      const item = sceneShapes.splice(idx, 1)[0];
      sceneShapes.splice(idx + 1, 0, item);
      redrawSceneCanvas(true);
      updateSelectionBadge();
      saveDrawingState();
      if (typeof showToast === 'function') showToast('Đã chuyển hình lên 1 lớp', 'info');
    }
    return;
  }
  const indices = sel.map(s => sceneShapes.findIndex(x => x.id === s.id)).sort((a,b) => b - a);
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i];
    if (idx !== -1 && idx < sceneShapes.length - 1) {
      const item = sceneShapes.splice(idx, 1)[0];
      sceneShapes.splice(idx + 1, 0, item);
    }
  }
  redrawSceneCanvas(true);
  updateSelectionBadge();
  saveDrawingState();
  if (typeof showToast === 'function') showToast('Đã chuyển các hình lên 1 lớp', 'info');
}


function sendShapeBackward() {
  const sel = getSelectedShapes();
  if (sel.length === 0) return;
  if (sel.length === 1) {
    const idx = sceneShapes.findIndex(s => s.id === sel[0].id);
    if (idx > 0) {
      const item = sceneShapes.splice(idx, 1)[0];
      sceneShapes.splice(idx - 1, 0, item);
      redrawSceneCanvas(true);
      updateSelectionBadge();
      saveDrawingState();
      if (typeof showToast === 'function') showToast('Đã chuyển hình xuống 1 lớp', 'info');
    }
    return;
  }
  const indices = sel.map(s => sceneShapes.findIndex(x => x.id === s.id)).sort((a,b) => a - b);
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i];
    if (idx > 0) {
      const item = sceneShapes.splice(idx, 1)[0];
      sceneShapes.splice(idx - 1, 0, item);
    }
  }
  redrawSceneCanvas(true);
  updateSelectionBadge();
  saveDrawingState();
  if (typeof showToast === 'function') showToast('Đã chuyển các hình xuống 1 lớp', 'info');
}


function bringShapeToFront() {
  const sel = getSelectedShapes();
  if (sel.length === 0) return;
  const selIds = new Set(sel.map(s => s.id));
  const remaining = sceneShapes.filter(s => !selIds.has(s.id));
  sceneShapes = [...remaining, ...sel];
  redrawSceneCanvas(true);
  updateSelectionBadge();
  saveDrawingState();
  if (typeof showToast === 'function') showToast('Đã đưa lên trên cùng', 'info');
}


function sendShapeToBack() {
  const sel = getSelectedShapes();
  if (sel.length === 0) return;
  const selIds = new Set(sel.map(s => s.id));
  const remaining = sceneShapes.filter(s => !selIds.has(s.id));
  sceneShapes = [...sel, ...remaining];
  redrawSceneCanvas(true);
  updateSelectionBadge();
  saveDrawingState();
  if (typeof showToast === 'function') showToast('Đã đưa xuống dưới cùng', 'info');
}


function cycleOverlappingSelection() {
  if (!lastHitCandidates || lastHitCandidates.length <= 1) {
    if (typeof showToast === 'function') {
      showToast('Không có hình nào lồng nhau tại điểm click gần nhất', 'info');
    }
    return;
  }
  const curIndex = lastHitCandidates.findIndex(c => c.shape.id === selectedShapeId);
  const nextCandidate = lastHitCandidates[(curIndex + 1) % lastHitCandidates.length];
  setSelectedShapes([nextCandidate.shape.id]);
  syncStrokeUI(nextCandidate.shape.width, nextCandidate.shape.color);
  updateSelectionBadge();
  redrawSceneCanvas(true);
  if (typeof showToast === 'function') {
    showToast(`Đã chọn: ${getShapeDisplayName(nextCandidate.shape)}`, 'info');
  }
}


function adjustSelectedCurveBend(factor) {
  if (!selectedShapeId) return;
  const shape = sceneShapes.find(s => s.id === selectedShapeId);
  if (!shape || (shape.type !== 'curve' && shape.type !== 'curve_dashed' && !isCurvedTireTrack(shape))) return;

  const curveTarget = isCurvedTireTrack(shape) ? shape.curveSource : shape;

  const mx = (curveTarget.x1 + curveTarget.x2) / 2;
  const my = (curveTarget.y1 + curveTarget.y2) / 2;
  const vx = curveTarget.cx - mx;
  const vy = curveTarget.cy - my;

  curveTarget.cx = mx + vx * factor;
  curveTarget.cy = my + vy * factor;
  if (isCurvedTireTrack(shape)) syncCurvedTireTrackPoints(shape);

  redrawSceneCanvas(true);
  saveDrawingState();
}


function flipSelectedCurveBend() {
  if (!selectedShapeId) return;
  const shape = sceneShapes.find(s => s.id === selectedShapeId);
  if (!shape || (shape.type !== 'curve' && shape.type !== 'curve_dashed' && !isCurvedTireTrack(shape))) return;

  const curveTarget = isCurvedTireTrack(shape) ? shape.curveSource : shape;

  const mx = (curveTarget.x1 + curveTarget.x2) / 2;
  const my = (curveTarget.y1 + curveTarget.y2) / 2;
  curveTarget.cx = mx - (curveTarget.cx - mx);
  curveTarget.cy = my - (curveTarget.cy - my);
  if (isCurvedTireTrack(shape)) syncCurvedTireTrackPoints(shape);

  redrawSceneCanvas(true);
  saveDrawingState();
}


function toggleSelectedLineArrow() {
  if (!selectedShapeId) return;
  const shape = sceneShapes.find(s => s.id === selectedShapeId);
  if (!shape) return;

  if (shape.type === 'curve' || shape.type === 'curve_dashed') {
    shape.hasArrow = !shape.hasArrow;
  } else if (shape.type === 'line' || shape.type === 'dashed_line') {
    shape.type = shape.type === 'line' ? 'arrow' : 'dashed_line';
  } else if (shape.type === 'arrow') {
    shape.type = 'line';
  }

  updateSelectionBadge();
  redrawSceneCanvas(true);
  saveDrawingState();
}


function toggleSelectedLineDash() {
  if (!selectedShapeId) return;
  const shape = sceneShapes.find(s => s.id === selectedShapeId);
  if (!shape) return;

  if (shape.type === 'curve') {
    shape.type = 'curve_dashed';
  } else if (shape.type === 'curve_dashed') {
    shape.type = 'curve';
  } else if (shape.type === 'road_line') {
    shape.type = 'road_dashed';
  } else if (shape.type === 'road_dashed') {
    shape.type = 'road_line';
  } else if (shape.type === 'line') {
    shape.type = 'dashed_line';
  } else if (shape.type === 'dashed_line') {
    shape.type = 'line';
  } else if (isRoadVehicleShape(shape)) {
    shape.dashed = !shape.dashed;
  }

  updateSelectionBadge();
  redrawSceneCanvas(true);
  saveDrawingState();
}


// ------------------------------------------
// TEMPLATE & BASE GRAPHICS
// ------------------------------------------
function getSortedSceneNumberNotes() {
  if (typeof sceneShapes === 'undefined' || !Array.isArray(sceneShapes)) return [];
  return sceneShapes
    .filter(shape => shape && shape.type === 'number_note')
    .slice()
    .sort((a, b) => (a.noteNumber || 0) - (b.noteNumber || 0));
}


function normalizeSceneNoteNumbers() {
  getSortedSceneNumberNotes().forEach((shape, index) => {
    shape.noteNumber = index + 1;
  });
}


function wrapSceneLegendText(ctx, text, maxWidth, maxLines = 3) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return ['Chưa có nội dung'];
  const lines = [];
  let current = '';

  words.forEach(word => {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);

  if (lines.length > maxLines) {
    const clipped = lines.slice(0, maxLines);
    let last = clipped[maxLines - 1];
    while (last.length > 1 && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
    clipped[maxLines - 1] = last.replace(/[\s,.;:]+$/, '') + '…';
    return clipped;
  }
  return lines;
}


function drawSceneNumberLegend(ctx, legendX, gridY, legendWidth, gridHeight) {
  const notes = getSortedSceneNumberNotes();
  if (notes.length === 0) return;

  ctx.save();
  const left = legendX + 11;
  const textX = legendX + 34;
  const maxTextWidth = legendWidth - 45;
  const maxY = gridY + gridHeight - 12;
  let cursorY = gridY + 73;

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    ctx.font = '11px Arial';
    const lines = wrapSceneLegendText(ctx, note.note, maxTextWidth, 3);
    const itemHeight = Math.max(27, lines.length * 13 + 9);
    if (cursorY + itemHeight > maxY) {
      ctx.fillStyle = '#6b7280';
      ctx.font = 'italic 10px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`+ ${notes.length - i} chú thích khác`, left, Math.min(cursorY, maxY - 11));
      break;
    }

    const markerY = cursorY + 8;
    ctx.beginPath();
    ctx.fillStyle = '#f7e7bd';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1.25;
    ctx.arc(left + 8, markerY, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 9.5px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(note.noteNumber || i + 1), left + 8, markerY + 0.2);

    ctx.fillStyle = '#111827';
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((line, lineIndex) => ctx.fillText(line, textX, cursorY + lineIndex * 13));

    ctx.strokeStyle = 'rgba(17,24,39,.14)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(left, cursorY + itemHeight - 3);
    ctx.lineTo(legendX + legendWidth - 8, cursorY + itemHeight - 3);
    ctx.stroke();
    cursorY += itemHeight;
  }
  ctx.restore();
}


function drawTemplate(ctx, w, h) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  
  const gridX = 20;
  const gridY = 85;
  const gridW = w - 40;
  const gridH = h - 225;
  
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(gridX, gridY, gridW, gridH);
  
  const legendX = w - 180;
  ctx.beginPath();
  ctx.moveTo(legendX, gridY);
  ctx.lineTo(legendX, gridY + gridH);
  ctx.stroke();
  
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px Arial';
  ctx.fillText('SƠ ĐỒ HIỆN TRƯỜNG VỤ TAI NẠN', w/2, 35);
  
  ctx.font = '12px Arial';
  const templateMeta = ensureSceneTemplateMeta(false);
  const accidentParts = parseSceneDateParts(templateMeta.accidentDateTime, true);
  ctx.fillText(`Tai nạn xảy ra hồi: ${accidentParts.hh} giờ ${accidentParts.mm} ngày ${accidentParts.dd} tháng ${accidentParts.mo} năm ${accidentParts.yyyy}`, w/2, 55);
  ctx.fillText(`Tại: ${templateMeta.accidentLocation || '.........................................................................................................'}`, w/2, 70);
  
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px Arial';
  ctx.fillText('Chú thích', legendX + 80, gridY + 25);
  ctx.font = 'italic 12px Arial';
  ctx.fillText('(Số — nội dung giải thích)', legendX + 80, gridY + 45);
  
  ctx.beginPath();
  ctx.moveTo(legendX, gridY + 55);
  ctx.lineTo(w - 20, gridY + 55);
  ctx.stroke();

  drawSceneNumberLegend(ctx, legendX, gridY, w - 20 - legendX, gridH);
  
  const footerY = gridY + gridH + 45;
  // Khoảng cách 3 cột chữ ký cân đối đều nhau (mỗi cột 320px, cách lề đều 160px)
  const col1X = gridX + Math.round(gridW * 1 / 6); // 180 (Các bên liên quan)
  const col2X = gridX + Math.round(gridW * 3 / 6); // 500 (Người chứng kiến - chính giữa trang w/2)
  const col3X = gridX + Math.round(gridW * 5 / 6); // 820 (Người vẽ sơ đồ)
  
  ctx.textAlign = 'center';
  ctx.font = 'italic 12px Arial';
  const reportParts = parseSceneDateParts(templateMeta.reportDate || getTodaySceneDateString(), false);
  const reportPlace = templateMeta.reportPlace || '.........';
  ctx.fillText(`${reportPlace}, ngày ${reportParts.dd} tháng ${reportParts.mo} năm ${reportParts.yyyy}`, col3X, footerY - 22);
  
  ctx.font = 'bold 12px Arial';
  ctx.fillText('Các bên liên quan', col1X, footerY);
  ctx.fillText('Người chứng kiến (nếu có)', col2X, footerY);
  ctx.fillText('Người vẽ sơ đồ', col3X, footerY);
  
  ctx.font = 'italic 12px Arial';
  ctx.fillText('(Ký, ghi rõ họ tên)', col1X, footerY + 20);
  ctx.fillText('(Ký, ghi rõ họ tên)', col2X, footerY + 20);
  ctx.fillText('(Ký, ghi rõ họ tên)', col3X, footerY + 20);
  
  ctx.textAlign = 'right';
  ctx.font = '14px Arial';
  ctx.fillText('3/3', w - 20, h - 20);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}


function drawVehicleWheelPairs(ctx, axlePositions, top, bottom, vehicleLength, vehicleHeight, color, dashed=false) {
  if (!Array.isArray(axlePositions) || axlePositions.length === 0) return;
  const isLongVehicle = vehicleLength / Math.max(1, vehicleHeight) > 2.7;
  const wheelLength = Math.max(6, Math.min(20, vehicleHeight * (isLongVehicle ? 0.48 : 0.42)));
  const wheelThickness = Math.max(3.6, Math.min(8, vehicleHeight * 0.17));
  const radius = wheelThickness / 2;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  function drawPremiumTire(wheelX, wheelY) {
    // Khi xe dùng nét đứt, lốp chuyển sang viền đứt và nền sáng để
    // khoảng ngắt không bị che bởi khối cao su đen.
    ctx.save();
    ctx.shadowColor = dashed ? 'transparent' : 'rgba(15, 23, 42, 0.3)';
    ctx.shadowBlur = dashed ? 0 : Math.max(1.5, wheelThickness * 0.45);
    ctx.shadowOffsetY = wheelY < top ? -0.5 : 0.5;
    ctx.fillStyle = dashed ? 'rgba(255,255,255,.96)' : '#151a22';
    ctx.strokeStyle = dashed ? color : '#020617';
    ctx.lineWidth = dashed ? Math.max(1.1, wheelThickness * 0.24) : Math.max(0.8, wheelThickness * 0.16);
    ctx.setLineDash(dashed
      ? [Math.max(3.2, wheelLength * 0.23), Math.max(2.2, wheelLength * 0.15)]
      : []);
    ctx.beginPath();
    drawRoundRectCompat(ctx, wheelX, wheelY, wheelLength, wheelThickness, radius);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Sidewall inset and a restrained central tread highlight.
    ctx.save();
    ctx.setLineDash([]);
    ctx.strokeStyle = dashed ? 'rgba(71,85,105,.72)' : 'rgba(148, 163, 184, 0.72)';
    ctx.lineWidth = Math.max(0.65, wheelThickness * 0.11);
    ctx.beginPath();
    ctx.moveTo(wheelX + wheelLength * 0.2, wheelY + wheelThickness * 0.5);
    ctx.lineTo(wheelX + wheelLength * 0.8, wheelY + wheelThickness * 0.5);
    ctx.stroke();

    ctx.strokeStyle = dashed ? 'rgba(100,116,139,.48)' : 'rgba(255,255,255,0.28)';
    ctx.lineWidth = Math.max(0.45, wheelThickness * 0.075);
    [0.32, 0.5, 0.68].forEach(ratio => {
      const treadX = wheelX + wheelLength * ratio;
      ctx.beginPath();
      ctx.moveTo(treadX, wheelY + wheelThickness * 0.22);
      ctx.lineTo(treadX, wheelY + wheelThickness * 0.78);
      ctx.stroke();
    });
    ctx.restore();
  }

  axlePositions.forEach(axleX => {
    const wheelX = axleX - wheelLength / 2;
    const upperY = top - wheelThickness * 0.74;
    const lowerY = bottom - wheelThickness * 0.26;
    drawPremiumTire(wheelX, upperY);
    drawPremiumTire(wheelX, lowerY);
  });
  ctx.restore();
}


function drawTemplateCar(ctx, x, y, color, width, w=30, h=16, dashed=false) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([]);
  if (dashed) ctx.setLineDash([Math.max(5, w * 0.055), Math.max(3, w * 0.032)]);
  
  const left = x - w/2;
  const right = x + w/2;
  const top = y - h/2;
  const bottom = y + h/2;
  
  // 1. Thân xe hình chữ nhật bao quanh hoàn chỉnh (Full outer rectangle)
  ctx.strokeRect(left, top, w, h);
  
  // 2. Vạch ngăn khoang đầu xe (~26% chiều dài, Divider)
  const frontLen = Math.min(w * 0.26, h * 0.75);
  const sepX = right - frontLen;
  
  ctx.beginPath();
  ctx.moveTo(sepX, top);
  ctx.lineTo(sepX, bottom);
  ctx.stroke();
  
  // 3. Mũi tên chỉ hướng di chuyển đầu xe bên trong hình chữ nhật (Inscribed arrow)
  ctx.beginPath();
  ctx.moveTo(sepX, top);
  ctx.lineTo(right, y);
  ctx.lineTo(sepX, bottom);
  ctx.stroke();

  // Hai cụm bánh trước/sau nhìn từ trên xuống.
  drawVehicleWheelPairs(
    ctx,
    [left + w * 0.18, left + w * 0.84],
    top,
    bottom,
    w,
    h,
    color,
    dashed
  );
  
  ctx.restore();
}


function drawTemplateContainer(ctx, x, y, color, width, w=90, h=27, dashed=false) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash([]);
  if (dashed) ctx.setLineDash([Math.max(5, w * 0.045), Math.max(3, w * 0.027)]);

  const left = x - w / 2;
  const top = y - h / 2;
  const trailerW = w * 0.68;
  const couplingW = w * 0.07;
  const gapW = w * 0.03;
  const cabX = left + trailerW + couplingW + gapW;
  const cabW = w - trailerW - couplingW - gapW;

  // Thùng container dài.
  ctx.strokeRect(left, top, trailerW, h);

  // Khớp nối giữa sơ-mi rơ-moóc và đầu kéo.
  ctx.strokeRect(left + trailerW, y - h * 0.3, couplingW, h * 0.6);
  ctx.beginPath();
  ctx.arc(left + trailerW + couplingW * 0.5, y, Math.max(1.5, h * 0.07), 0, Math.PI * 2);
  ctx.fill();

  // Cabin đầu kéo và mũi xe thể hiện hướng di chuyển.
  ctx.strokeRect(cabX, top, cabW, h);
  const windshieldX = cabX + cabW * 0.24;
  ctx.beginPath();
  ctx.moveTo(windshieldX, top);
  ctx.lineTo(cabX + cabW, y);
  ctx.lineTo(windshieldX, top + h);
  ctx.closePath();
  ctx.stroke();

  // Hai trục bánh rơ-moóc, bánh cầu sau và bánh lái của đầu kéo.
  drawVehicleWheelPairs(
    ctx,
    [
      left + trailerW * 0.14,
      left + trailerW * 0.36,
      left + trailerW + couplingW * 0.55,
      cabX + cabW * 0.78
    ],
    top,
    top + h,
    w,
    h,
    color,
    dashed
  );

  ctx.restore();
}


function drawTemplateBike(ctx, x, y, color, width, w, h, dashed=false) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, width);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);
  if (dashed) ctx.setLineDash([Math.max(4, w * 0.045), Math.max(2.5, w * 0.027)]);
  const left = x - w / 2;
  const right = x + w / 2;
  const lineW = Math.max(0.9, width);
  const wheelLength = Math.max(7, w * 0.17);
  const wheelThickness = Math.max(4.5, h * 0.2);
  const rearWheelX = left + w * 0.025;
  const frontWheelX = right - w * 0.025 - wheelLength;

  function drawMotorcycleWheel(wheelX) {
    ctx.save();
    ctx.setLineDash(dashed
      ? [Math.max(3, wheelLength * 0.24), Math.max(2, wheelLength * 0.15)]
      : []);
    ctx.beginPath();
    drawRoundRectCompat(ctx, wheelX, y - wheelThickness / 2, wheelLength, wheelThickness, wheelThickness / 2);
    ctx.fillStyle = dashed ? 'rgba(255,255,255,.96)' : '#151b24';
    ctx.fill();
    ctx.strokeStyle = dashed ? color : '#020617';
    ctx.lineWidth = Math.max(0.8, lineW * 0.8);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.strokeStyle = dashed ? 'rgba(71,85,105,.66)' : 'rgba(203,213,225,.72)';
    ctx.lineWidth = Math.max(0.55, lineW * 0.48);
    ctx.moveTo(wheelX + wheelLength * 0.23, y);
    ctx.lineTo(wheelX + wheelLength * 0.77, y);
    ctx.stroke();
    ctx.restore();
  }

  // Hai bánh đặt đúng trục dọc thân xe; bánh trước/sau tách khỏi vỏ xe.
  drawMotorcycleWheel(rearWheelX);
  drawMotorcycleWheel(frontWheelX);

  // Gắp sau và phuộc trước giúp hình đọc đúng là xe máy nhìn từ trên xuống.
  ctx.strokeStyle = color;
  ctx.lineWidth = lineW;
  ctx.beginPath();
  ctx.moveTo(left + w * 0.15, y - h * 0.085);
  ctx.lineTo(left + w * 0.34, y - h * 0.15);
  ctx.moveTo(left + w * 0.15, y + h * 0.085);
  ctx.lineTo(left + w * 0.34, y + h * 0.15);
  ctx.moveTo(left + w * 0.72, y - h * 0.12);
  ctx.lineTo(right - w * 0.12, y - h * 0.075);
  ctx.moveTo(left + w * 0.72, y + h * 0.12);
  ctx.lineTo(right - w * 0.12, y + h * 0.075);
  ctx.stroke();

  // Cụm thân chia mảng rõ: đuôi, yên, bình xăng và đầu xe.
  ctx.strokeStyle = color;
  ctx.lineWidth = lineW;
  ctx.beginPath();
  ctx.moveTo(left + w * 0.18, y);
  ctx.quadraticCurveTo(left + w * 0.25, y - h * 0.16, left + w * 0.34, y - h * 0.19);
  ctx.lineTo(left + w * 0.57, y - h * 0.2);
  ctx.quadraticCurveTo(left + w * 0.67, y - h * 0.19, left + w * 0.75, y - h * 0.12);
  ctx.lineTo(left + w * 0.82, y - h * 0.075);
  ctx.lineTo(left + w * 0.82, y + h * 0.075);
  ctx.lineTo(left + w * 0.75, y + h * 0.12);
  ctx.quadraticCurveTo(left + w * 0.67, y + h * 0.19, left + w * 0.57, y + h * 0.2);
  ctx.lineTo(left + w * 0.34, y + h * 0.19);
  ctx.quadraticCurveTo(left + w * 0.25, y + h * 0.16, left + w * 0.18, y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(226,232,240,.92)';
  ctx.fill();
  ctx.stroke();

  // Yên xe tối màu, có đường may trung tâm.
  ctx.beginPath();
  drawRoundRectCompat(ctx, left + w * 0.3, y - h * 0.145, w * 0.29, h * 0.29, h * 0.11);
  ctx.fillStyle = '#273241';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(148,163,184,.78)';
  ctx.lineWidth = Math.max(0.55, lineW * 0.48);
  ctx.moveTo(left + w * 0.335, y);
  ctx.lineTo(left + w * 0.555, y);
  ctx.stroke();

  // Bình xăng / ốp thân phía trước tạo vai xe đặc trưng.
  ctx.beginPath();
  ctx.ellipse(left + w * 0.65, y, w * 0.085, h * 0.14, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(148,163,184,.3)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineW;
  ctx.stroke();

  // Gác chân hai bên để phân biệt rõ với xe đạp hoặc vật thể hình thoi.
  const footPegX = left + w * 0.5;
  ctx.beginPath();
  ctx.moveTo(footPegX, y - h * 0.15);
  ctx.lineTo(footPegX, y - h * 0.34);
  ctx.moveTo(footPegX, y + h * 0.15);
  ctx.lineTo(footPegX, y + h * 0.34);
  ctx.stroke();
  [y - h * 0.35, y + h * 0.35].forEach(pegY => {
    ctx.beginPath();
    drawRoundRectCompat(ctx, footPegX - w * 0.025, pegY - h * 0.025, w * 0.05, h * 0.05, h * 0.02);
    ctx.fillStyle = '#1f2937';
    ctx.fill();
  });

  // Cổ lái, tay lái cong, hai bao tay và cặp gương.
  const handleX = left + w * 0.735;
  ctx.beginPath();
  ctx.moveTo(handleX + w * 0.015, y - h * 0.08);
  ctx.quadraticCurveTo(handleX - w * 0.015, y - h * 0.27, handleX - w * 0.055, y - h * 0.38);
  ctx.moveTo(handleX + w * 0.015, y + h * 0.08);
  ctx.quadraticCurveTo(handleX - w * 0.015, y + h * 0.27, handleX - w * 0.055, y + h * 0.38);
  ctx.moveTo(handleX, y);
  ctx.lineTo(left + w * 0.82, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineW;
  ctx.stroke();

  [y - h * 0.39, y + h * 0.39].forEach(gripY => {
    ctx.beginPath();
    drawRoundRectCompat(ctx, handleX - w * 0.085, gripY - h * 0.025, w * 0.06, h * 0.05, h * 0.022);
    ctx.fillStyle = '#111827';
    ctx.fill();
  });

  [
    { y: y - h * 0.48, stemY: y - h * 0.34 },
    { y: y + h * 0.48, stemY: y + h * 0.34 }
  ].forEach(mirror => {
    ctx.beginPath();
    ctx.moveTo(handleX - w * 0.04, mirror.stemY);
    ctx.lineTo(handleX - w * 0.08, mirror.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(handleX - w * 0.09, mirror.y, Math.max(1.7, w * 0.025), Math.max(1.25, h * 0.045), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(191,219,254,.78)';
    ctx.fill();
    ctx.stroke();
  });

  // Đèn trước nhỏ, đèn hậu đỏ và đường tâm định hướng.
  ctx.beginPath();
  ctx.ellipse(left + w * 0.815, y, Math.max(1.5, w * 0.018), Math.max(1.15, h * 0.045), 0, 0, Math.PI * 2);
  ctx.fillStyle = '#fde68a';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(left + w * 0.205, y, Math.max(1.1, h * 0.035), 0, Math.PI * 2);
  ctx.fillStyle = '#ef4444';
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = 'rgba(100,116,139,.72)';
  ctx.lineWidth = Math.max(0.5, lineW * 0.42);
  ctx.moveTo(left + w * 0.6, y);
  ctx.lineTo(left + w * 0.79, y);
  ctx.stroke();
  ctx.restore();
}


function drawFallenBikeLegacy(ctx, x, y, color, width, w, h) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);
  const left = x - w / 2;
  const right = x + w / 2;
  const lineW = Math.max(0.9, width);
  const wheelR = Math.max(4.5, h * 0.22);
  const rearHub = { x: left + w * 0.16, y: y + h * 0.12 };
  const frontHub = { x: right - w * 0.16, y: y + h * 0.06 };
  const engine = { x: left + w * 0.48, y: y + h * 0.02 };
  const steering = { x: left + w * 0.7, y: y - h * 0.12 };

  // Bóng tiếp xúc dài và lệch về phía mặt đường cho cảm giác xe đang đổ.
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.28, w * 0.42, h * 0.1, -0.03, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(15,23,42,.11)';
  ctx.fill();

  function drawSideWheel(hub) {
    ctx.beginPath();
    ctx.arc(hub.x, hub.y, wheelR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.96)';
    ctx.fill();
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = Math.max(1.1, lineW * 1.2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(hub.x, hub.y, wheelR * 0.68, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(71,85,105,.82)';
    ctx.lineWidth = Math.max(0.55, lineW * 0.48);
    ctx.stroke();
    for (let spoke = 0; spoke < 6; spoke++) {
      const a = spoke * Math.PI / 3;
      ctx.beginPath();
      ctx.moveTo(hub.x, hub.y);
      ctx.lineTo(hub.x + Math.cos(a) * wheelR * 0.66, hub.y + Math.sin(a) * wheelR * 0.66);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(hub.x, hub.y, Math.max(1.4, wheelR * 0.16), 0, Math.PI * 2);
    ctx.fillStyle = '#475569';
    ctx.fill();
  }

  drawSideWheel(rearHub);
  drawSideWheel(frontHub);

  // Khung tam giác, gắp sau và phuộc trước nhìn ngang khi xe nằm xuống.
  ctx.strokeStyle = color;
  ctx.lineWidth = lineW;
  ctx.beginPath();
  ctx.moveTo(rearHub.x, rearHub.y);
  ctx.lineTo(engine.x, engine.y);
  ctx.lineTo(left + w * 0.38, y - h * 0.24);
  ctx.closePath();
  ctx.moveTo(left + w * 0.38, y - h * 0.24);
  ctx.lineTo(steering.x, steering.y);
  ctx.lineTo(engine.x, engine.y);
  ctx.moveTo(steering.x - w * 0.018, steering.y - h * 0.04);
  ctx.lineTo(frontHub.x - wheelR * 0.25, frontHub.y);
  ctx.moveTo(steering.x + w * 0.018, steering.y - h * 0.02);
  ctx.lineTo(frontHub.x + wheelR * 0.18, frontHub.y);
  ctx.stroke();

  // Động cơ nổi khối và nắp máy.
  ctx.beginPath();
  drawRoundRectCompat(ctx, engine.x - w * 0.075, engine.y - h * 0.13, w * 0.15, h * 0.26, Math.max(2, h * 0.05));
  ctx.fillStyle = 'rgba(148,163,184,.48)';
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(engine.x, engine.y, Math.max(2, h * 0.065), 0, Math.PI * 2);
  ctx.fillStyle = '#64748b';
  ctx.fill();
  ctx.stroke();

  // Yên xe nằm chéo, bình xăng và cụm đuôi sau.
  ctx.save();
  ctx.translate(left + w * 0.43, y - h * 0.27);
  ctx.rotate(-0.08);
  ctx.beginPath();
  drawRoundRectCompat(ctx, -w * 0.13, -h * 0.075, w * 0.26, h * 0.15, h * 0.065);
  ctx.fillStyle = '#25303e';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineW;
  ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.ellipse(left + w * 0.59, y - h * 0.2, w * 0.075, h * 0.105, -0.12, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(203,213,225,.86)';
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(left + w * 0.31, y - h * 0.25);
  ctx.lineTo(left + w * 0.2, y - h * 0.16);
  ctx.lineTo(rearHub.x + wheelR * 0.22, rearHub.y - wheelR * 0.75);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(left + w * 0.215, y - h * 0.17, Math.max(1.2, h * 0.028), 0, Math.PI * 2);
  ctx.fillStyle = '#ef4444';
  ctx.fill();

  // Tay lái đã xoay lệch khi xe ngã, bao tay và một gương chạm gần mặt đường.
  ctx.beginPath();
  ctx.moveTo(steering.x, steering.y);
  ctx.lineTo(steering.x + w * 0.07, steering.y - h * 0.24);
  ctx.lineTo(steering.x + w * 0.14, steering.y - h * 0.28);
  ctx.moveTo(steering.x, steering.y);
  ctx.lineTo(steering.x - w * 0.025, steering.y + h * 0.22);
  ctx.stroke();
  ctx.beginPath();
  drawRoundRectCompat(ctx, steering.x + w * 0.12, steering.y - h * 0.315, w * 0.065, h * 0.065, h * 0.03);
  ctx.fillStyle = '#111827';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(steering.x - w * 0.035, steering.y + h * 0.29, Math.max(2, w * 0.027), Math.max(1.4, h * 0.04), -0.18, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(191,219,254,.82)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.stroke();

  // Ống xả thấp và hai vệt cạ nhỏ nhấn mạnh trạng thái nằm trên đường.
  ctx.beginPath();
  ctx.moveTo(engine.x - w * 0.01, engine.y + h * 0.13);
  ctx.quadraticCurveTo(left + w * 0.38, y + h * 0.31, left + w * 0.24, y + h * 0.29);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = Math.max(1.2, lineW * 1.25);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(100,116,139,.56)';
  ctx.lineWidth = Math.max(0.6, lineW * 0.55);
  [0.47, 0.58].forEach(ratio => {
    ctx.beginPath();
    ctx.moveTo(left + w * ratio, y + h * 0.38);
    ctx.lineTo(left + w * (ratio + 0.08), y + h * 0.4);
    ctx.stroke();
  });
  ctx.restore();
}
