

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}


function drawRoundRectCompat(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}


function drawSnapDiamond(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#e11d48';
  ctx.lineWidth = 1.6;
  const s = 4.5;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x - s, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}


function drawSnapBadge(ctx, x, y, text) {
  ctx.save();
  ctx.font = 'bold 11px sans-serif';
  const tw = ctx.measureText(text).width;
  const padX = 7;
  const h = 19;
  const w = tw + padX * 2;
  const bx = x - w / 2;
  const by = y - h / 2;

  ctx.fillStyle = 'rgba(225, 29, 72, 0.92)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;
  ctx.beginPath();
  drawRoundRectCompat(ctx, bx, by, w, h, 4);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}


function applySceneTransform(forceRedraw = false) {
  const wrapper = document.getElementById('sceneCanvasWrapper');
  const label = document.getElementById('sceneZoomLabel');
  if (wrapper) {
    wrapper.style.transform = `translate(${scenePanX}px, ${scenePanY}px) scale(${currentSceneZoom})`;
  }
  if (label) {
    label.textContent = `${Math.round(currentSceneZoom * 100)}%`;
  }
  if (forceRedraw || Math.abs(currentSceneZoom - lastRenderedZoom) > 0.001) {
    lastRenderedZoom = currentSceneZoom;
    if (typeof redrawSceneCanvas === 'function') {
      redrawSceneCanvas(false);
    }
  }
}


function zoomSceneCanvas(delta) {
  const viewport = document.getElementById('sceneCanvasViewport');
  let cx = window.innerWidth / 2;
  let cy = window.innerHeight / 2;
  if (viewport) {
    const r = viewport.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
  }
  zoomAtPoint(delta, cx, cy);
}


function zoomAtPoint(deltaZoom, clientX, clientY) {
  const oldZoom = currentSceneZoom;
  let newZoom = Math.min(3.5, Math.max(0.35, Math.round((currentSceneZoom + deltaZoom) * 100) / 100));
  if (Math.abs(newZoom - oldZoom) < 0.001) return;

  const viewport = document.getElementById('sceneCanvasViewport');
  if (viewport) {
    const r = viewport.getBoundingClientRect();
    const mx = clientX - (r.left + r.width / 2);
    const my = clientY - (r.top + r.height / 2);

    scenePanX -= (mx - scenePanX) * (newZoom / oldZoom - 1);
    scenePanY -= (my - scenePanY) * (newZoom / oldZoom - 1);
  }

  currentSceneZoom = newZoom;
  applySceneTransform();
}


function resetSceneZoom() {
  currentSceneZoom = 1.0;
  scenePanX = 0;
  scenePanY = 0;
  applySceneTransform();
}


function initSceneZoomAndPan() {
  const viewport = document.getElementById('sceneCanvasViewport');
  if (!viewport || viewport.dataset.zoomListenersAttached) return;
  viewport.dataset.zoomListenersAttached = 'true';

  // Wheel scroll: Only Zoom when holding Ctrl/Cmd; ignore completely when Ctrl is not pressed
  viewport.addEventListener('wheel', function(e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.12 : -0.12;
      zoomAtPoint(delta, e.clientX, e.clientY);
    } else {
      // Do nothing to the canvas (no panning/moving); prevent default page scroll
      e.preventDefault();
    }
  }, { passive: false });

  // Middle click (1) or Space+Left click (0) to pan
  viewport.addEventListener('mousedown', function(e) {
    if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
      isPanning = true;
      panStartX = e.clientX - scenePanX;
      panStartY = e.clientY - scenePanY;
      viewport.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });

  window.addEventListener('mousemove', function(e) {
    if (isPanning) {
      scenePanX = e.clientX - panStartX;
      scenePanY = e.clientY - panStartY;
      applySceneTransform();
      e.preventDefault();
    }
  });

  window.addEventListener('mouseup', function(e) {
    if (isPanning) {
      isPanning = false;
      const vp = document.getElementById('sceneCanvasViewport');
      if (vp) {
        vp.style.cursor = isSpacePressed ? 'grab' : '';
      }
    }
  });
}


function drawActiveSnapGuides(ctx) {
  if (!activeSnapGuides || activeSnapGuides.length === 0) return;

  ctx.save();
  for (let i = 0; i < activeSnapGuides.length; i++) {
    const g = activeSnapGuides[i];

    if (g.type === 'vertical') {
      ctx.beginPath();
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 4]);
      ctx.moveTo(g.x, g.y1);
      ctx.lineTo(g.x, g.y2);
      ctx.stroke();

      ctx.setLineDash([]);
      if (g.points) {
        for (let j = 0; j < g.points.length; j++) {
          drawSnapDiamond(ctx, g.points[j].x, g.points[j].y);
        }
      }

      if (g.label) {
        drawSnapBadge(ctx, g.x, (g.y1 + g.y2) / 2, g.label);
      }
    } else if (g.type === 'horizontal') {
      ctx.beginPath();
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 4]);
      ctx.moveTo(g.x1, g.y);
      ctx.lineTo(g.x2, g.y);
      ctx.stroke();

      ctx.setLineDash([]);
      if (g.points) {
        for (let j = 0; j < g.points.length; j++) {
          drawSnapDiamond(ctx, g.points[j].x, g.points[j].y);
        }
      }

      if (g.label) {
        drawSnapBadge(ctx, (g.x1 + g.x2) / 2, g.y, g.label);
      }
    } else if (g.type === 'junction') {
      ctx.save();
      ctx.strokeStyle = '#2563eb';
      ctx.fillStyle = 'rgba(37, 99, 235, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(g.x, g.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.arc(g.x, g.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (g.label) {
        drawSnapBadge(ctx, g.x, g.y - 16, g.label);
      }
    }
  }
  ctx.restore();
}


function getShapeCenterWithOffset(shape, dx, dy) {
  const c = getShapeCenter(shape);
  return { x: c.x + dx, y: c.y + dy };
}


function getShapeBoundingBoxWithOffset(shape, dx, dy) {
  const b = getShapeBoundingBox(shape);
  if (!b) return null;
  return {
    minX: b.minX + dx,
    maxX: b.maxX + dx,
    minY: b.minY + dy,
    maxY: b.maxY + dy
  };
}


function getSnapClosestPointOnSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 0.0001) return { x: start.x, y: start.y };
  const t = Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
  ));
  return { x: start.x + dx * t, y: start.y + dy * t };
}


function getShapeSnapAnchorsWithOffset(shape, dx, dy) {
  if (!shape) return [];
  const anchors = [];
  const center = getShapeCenterWithOffset(shape, dx, dy);
  if (center) anchors.push({ x: center.x, y: center.y, role: 'center' });

  if (isVehicleShape(shape)) {
    const dimensions = getVehicleDimensions(shape);
    const angle = shape.angle || 0;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const localAnchors = [
      { x: 0, y: -dimensions.h / 2 },
      { x: dimensions.w / 2, y: -dimensions.h / 2 },
      { x: dimensions.w, y: -dimensions.h / 2 },
      { x: dimensions.w, y: 0 },
      { x: dimensions.w, y: dimensions.h / 2 },
      { x: dimensions.w / 2, y: dimensions.h / 2 },
      { x: 0, y: dimensions.h / 2 },
      { x: 0, y: 0 }
    ];
    localAnchors.forEach(point => {
      anchors.push({
        x: shape.startX + dx + point.x * cos - point.y * sin,
        y: shape.startY + dy + point.x * sin + point.y * cos,
        role: 'edge'
      });
    });
  } else if (shape.type === 'number_note' || shape.type === 'xmark') {
    const radius = shape.type === 'number_note' ? (shape.radius || 13) : (shape.size || 8);
    anchors.push(
      { x: shape.x + dx - radius, y: shape.y + dy, role: 'edge' },
      { x: shape.x + dx + radius, y: shape.y + dy, role: 'edge' },
      { x: shape.x + dx, y: shape.y + dy - radius, role: 'edge' },
      { x: shape.x + dx, y: shape.y + dy + radius, role: 'edge' }
    );
  } else {
    const box = getShapeBoundingBoxWithOffset(shape, dx, dy);
    if (box) {
      anchors.push(
        { x: (box.minX + box.maxX) / 2, y: box.minY, role: 'edge' },
        { x: box.maxX, y: (box.minY + box.maxY) / 2, role: 'edge' },
        { x: (box.minX + box.maxX) / 2, y: box.maxY, role: 'edge' },
        { x: box.minX, y: (box.minY + box.maxY) / 2, role: 'edge' }
      );
    }
  }

  return anchors;
}


function getShapeSnapSegments(shape) {
  if (!shape) return [];
  const segments = [];

  if (isLinearResizableShape(shape) && shape.x1 !== undefined && shape.x2 !== undefined) {
    const lineDx = shape.x2 - shape.x1;
    const lineDy = shape.y2 - shape.y1;
    const lineLength = Math.hypot(lineDx, lineDy);
    if (lineLength < 0.001) return segments;
    const nx = -lineDy / lineLength;
    const ny = lineDx / lineLength;
    const offsets = [0];
    if (isInfrastructureAssetShape(shape)) {
      const halfBand = getLinearShapeHalfBand(shape);
      offsets.unshift(-halfBand);
      offsets.push(halfBand);
    }
    offsets.forEach(offset => {
      segments.push({
        start: { x: shape.x1 + nx * offset, y: shape.y1 + ny * offset },
        end: { x: shape.x2 + nx * offset, y: shape.y2 + ny * offset },
        isEdge: Math.abs(offset) > 0.001
      });
    });
    return segments;
  }

  if ((shape.type === 'curve' || shape.type === 'curve_dashed') && shape.x1 !== undefined) {
    let previous = { x: shape.x1, y: shape.y1 };
    for (let index = 1; index <= 24; index++) {
      const t = index / 24;
      const current = {
        x: (1 - t) ** 2 * shape.x1 + 2 * (1 - t) * t * shape.cx + t ** 2 * shape.x2,
        y: (1 - t) ** 2 * shape.y1 + 2 * (1 - t) * t * shape.cy + t ** 2 * shape.y2
      };
      segments.push({ start: previous, end: current, isEdge: false });
      previous = current;
    }
    return segments;
  }

  if ((shape.type === 'pen' || shape.type === 'tire_track') && Array.isArray(shape.points)) {
    for (let index = 0; index < shape.points.length - 1; index++) {
      segments.push({ start: shape.points[index], end: shape.points[index + 1], isEdge: false });
    }
  }

  return segments;
}


function computeSmartSnapping(shape, orig, rawDx, rawDy, isShiftPressed, disableSnap = false) {
  let dx = rawDx;
  let dy = rawDy;

  if (isShiftPressed) {
    if (Math.abs(dx) >= Math.abs(dy)) {
      dy = 0;
    } else {
      dx = 0;
    }
  }

  if (disableSnap || !sceneShapes || sceneShapes.length <= 1) {
    return { dx, dy, guides: [] };
  }

  const SNAP_DIST = 10;
  const JUNCTION_DIST = 12;
  const guides = [];
  // Every selected vector moves together. Snapping against another member of
  // that same group makes presets stick to themselves and drift from the mouse.
  const movingIds = new Set(selectedShapeIds && selectedShapeIds.includes(shape.id)
    ? selectedShapeIds : [shape.id]);

  const isLinear = isLinearResizableShape(shape);
  let curP1 = null, curP2 = null;
  let angle1 = 0;
  if (isLinear && orig.x1 !== undefined) {
    curP1 = { x: orig.x1 + dx, y: orig.y1 + dy };
    curP2 = { x: orig.x2 + dx, y: orig.y2 + dy };
    angle1 = Math.atan2(orig.y2 - orig.y1, orig.x2 - orig.x1);
  }

  const curCenter = getShapeCenterWithOffset(orig, dx, dy);
  const curBox = getShapeBoundingBoxWithOffset(orig, dx, dy);

  // 1. Direct Endpoint Junction Snapping
  if (isLinear && curP1 && curP2) {
    let bestJunction = null;
    let minJunctionDist = JUNCTION_DIST;

    for (let i = 0; i < sceneShapes.length; i++) {
      const other = sceneShapes[i];
      if (movingIds.has(other.id)) continue;
      const otherIsLinear = isLinearResizableShape(other);
      if (!otherIsLinear || other.x1 === undefined) continue;

      const pairs = [
        { cur: curP1, target: { x: other.x1, y: other.y1 } },
        { cur: curP1, target: { x: other.x2, y: other.y2 } },
        { cur: curP2, target: { x: other.x1, y: other.y1 } },
        { cur: curP2, target: { x: other.x2, y: other.y2 } }
      ];

      for (let j = 0; j < pairs.length; j++) {
        const p = pairs[j];
        const dist = Math.hypot(p.cur.x - p.target.x, p.cur.y - p.target.y);
        if (dist < minJunctionDist) {
          minJunctionDist = dist;
          bestJunction = {
            snapDx: p.target.x - p.cur.x,
            snapDy: p.target.y - p.cur.y,
            targetX: p.target.x,
            targetY: p.target.y
          };
        }
      }
    }

    if (bestJunction) {
      dx += bestJunction.snapDx;
      dy += bestJunction.snapDy;
      guides.push({
        type: 'junction',
        x: bestJunction.targetX,
        y: bestJunction.targetY,
        label: 'Nối điểm'
      });
      return { dx, dy, guides };
    }
  }

  // 2. Magnetic edge-to-stroke snapping. Unlike bounding-box alignment,
  // this attaches the actual visual edge/corner to the existing stroke.
  const strokeAnchors = getShapeSnapAnchorsWithOffset(orig, dx, dy);
  let bestStrokeSnap = null;
  let bestStrokeDistance = SNAP_DIST;
  for (let i = 0; i < sceneShapes.length; i++) {
    const other = sceneShapes[i];
    if (!other || movingIds.has(other.id)) continue;
    const targetSegments = getShapeSnapSegments(other);
    for (let anchorIndex = 0; anchorIndex < strokeAnchors.length; anchorIndex++) {
      const anchor = strokeAnchors[anchorIndex];
      for (let segmentIndex = 0; segmentIndex < targetSegments.length; segmentIndex++) {
        const segment = targetSegments[segmentIndex];
        const target = getSnapClosestPointOnSegment(anchor, segment.start, segment.end);
        const distance = Math.hypot(target.x - anchor.x, target.y - anchor.y);
        if (distance < bestStrokeDistance) {
          bestStrokeDistance = distance;
          bestStrokeSnap = {
            snapDx: target.x - anchor.x,
            snapDy: target.y - anchor.y,
            targetX: target.x,
            targetY: target.y,
            label: segment.isEdge ? 'Dính vào mép' : 'Dính vào nét'
          };
        }
      }
    }
  }

  if (bestStrokeSnap) {
    dx += bestStrokeSnap.snapDx;
    dy += bestStrokeSnap.snapDy;
    guides.push({
      type: 'junction',
      x: bestStrokeSnap.targetX,
      y: bestStrokeSnap.targetY,
      label: bestStrokeSnap.label
    });
    return { dx, dy, guides };
  }

  // 3. Multi-Candidate X-Axis & Y-Axis Alignment Snapping
  let bestCandidateX = null;
  let minDiffX = SNAP_DIST;

  let bestCandidateY = null;
  let minDiffY = SNAP_DIST;

  for (let i = 0; i < sceneShapes.length; i++) {
    const other = sceneShapes[i];
    if (movingIds.has(other.id)) continue;

    const otherCenter = getShapeCenter(other);
    const otherBox = getShapeBoundingBox(other);
    const otherIsLinear = isLinearResizableShape(other);

    // A. Check Parallel Relationship between 2 lines
    if (isLinear && otherIsLinear && other.x1 !== undefined) {
      const angle2 = Math.atan2(other.y2 - other.y1, other.x2 - other.x1);
      const isParallel = Math.abs(Math.sin(angle1 - angle2)) < 0.08;

      if (isParallel) {
        // Horizontal or near-horizontal parallel lines
        if (Math.abs(Math.sin(angle1)) < 0.4) {
          // Center-to-center horizontal alignment ("Giữa tâm song song")
          const diffCenterX = otherCenter.x - curCenter.x;
          if (Math.abs(diffCenterX) < minDiffX) {
            minDiffX = Math.abs(diffCenterX);
            bestCandidateX = {
              diff: diffCenterX,
              x: otherCenter.x,
              y1: Math.min(curCenter.y, otherCenter.y) - 15,
              y2: Math.max(curCenter.y, otherCenter.y) + 15,
              points: [{ x: otherCenter.x, y: otherCenter.y }, { x: otherCenter.x, y: curCenter.y }],
              label: 'Giữa tâm song song',
              priority: 10
            };
          }

          // Left endpoints align (x1 to other.x1)
          const diffLeft = other.x1 - curP1.x;
          if (Math.abs(diffLeft) < minDiffX) {
            minDiffX = Math.abs(diffLeft);
            bestCandidateX = {
              diff: diffLeft,
              x: other.x1,
              y1: Math.min(curP1.y, other.y1) - 15,
              y2: Math.max(curP1.y, other.y1) + 15,
              points: [{ x: other.x1, y: other.y1 }, { x: other.x1, y: curP1.y }],
              label: 'Căn đầu thẳng',
              priority: 8
            };
          }

          // Right endpoints align (x2 to other.x2)
          const diffRight = other.x2 - curP2.x;
          if (Math.abs(diffRight) < minDiffX) {
            minDiffX = Math.abs(diffRight);
            bestCandidateX = {
              diff: diffRight,
              x: other.x2,
              y1: Math.min(curP2.y, other.y2) - 15,
              y2: Math.max(curP2.y, other.y2) + 15,
              points: [{ x: other.x2, y: other.y2 }, { x: other.x2, y: curP2.y }],
              label: 'Căn cuối thẳng',
              priority: 8
            };
          }

          // Collinear Y (same horizontal row)
          const diffY = otherCenter.y - curCenter.y;
          if (Math.abs(diffY) < minDiffY) {
            minDiffY = Math.abs(diffY);
            bestCandidateY = {
              diff: diffY,
              y: otherCenter.y,
              x1: Math.min(curBox ? curBox.minX : curCenter.x, otherBox ? otherBox.minX : otherCenter.x) - 15,
              x2: Math.max(curBox ? curBox.maxX : curCenter.x, otherBox ? otherBox.maxX : otherCenter.x) + 15,
              points: [{ x: otherCenter.x, y: otherCenter.y }, { x: curCenter.x, y: otherCenter.y }],
              label: 'Cùng hàng ngang',
              priority: 9
            };
          }
        }
        // Vertical or near-vertical parallel lines
        else if (Math.abs(Math.cos(angle1)) < 0.4) {
          // Center-to-center vertical alignment ("Giữa tâm song song")
          const diffCenterY = otherCenter.y - curCenter.y;
          if (Math.abs(diffCenterY) < minDiffY) {
            minDiffY = Math.abs(diffCenterY);
            bestCandidateY = {
              diff: diffCenterY,
              y: otherCenter.y,
              x1: Math.min(curCenter.x, otherCenter.x) - 15,
              x2: Math.max(curCenter.x, otherCenter.x) + 15,
              points: [{ x: otherCenter.x, y: otherCenter.y }, { x: curCenter.x, y: otherCenter.y }],
              label: 'Giữa tâm song song',
              priority: 10
            };
          }

          // Top endpoints align
          const diffTop = other.y1 - curP1.y;
          if (Math.abs(diffTop) < minDiffY) {
            minDiffY = Math.abs(diffTop);
            bestCandidateY = {
              diff: diffTop,
              y: other.y1,
              x1: Math.min(curP1.x, other.x1) - 15,
              x2: Math.max(curP1.x, other.x1) + 15,
              points: [{ x: other.x1, y: other.y1 }, { x: curP1.x, y: other.y1 }],
              label: 'Căn đỉnh thẳng',
              priority: 8
            };
          }

          // Bottom endpoints align
          const diffBottom = other.y2 - curP2.y;
          if (Math.abs(diffBottom) < minDiffY) {
            minDiffY = Math.abs(diffBottom);
            bestCandidateY = {
              diff: diffBottom,
              y: other.y2,
              x1: Math.min(curP2.x, other.x2) - 15,
              x2: Math.max(curP2.x, other.x2) + 15,
              points: [{ x: other.x2, y: other.y2 }, { x: curP2.x, y: other.y2 }],
              label: 'Căn đáy thẳng',
              priority: 8
            };
          }

          // Collinear X (same vertical column)
          const diffX = otherCenter.x - curCenter.x;
          if (Math.abs(diffX) < minDiffX) {
            minDiffX = Math.abs(diffX);
            bestCandidateX = {
              diff: diffX,
              x: otherCenter.x,
              y1: Math.min(curBox ? curBox.minY : curCenter.y, otherBox ? otherBox.minY : otherCenter.y) - 15,
              y2: Math.max(curBox ? curBox.maxY : curCenter.y, otherBox ? otherBox.maxY : otherCenter.y) + 15,
              points: [{ x: otherCenter.x, y: otherCenter.y }, { x: otherCenter.x, y: curCenter.y }],
              label: 'Cùng hàng dọc',
              priority: 9
            };
          }
        }
      }
    }

    // B. General Center-to-Center Alignment (For all shapes)
    const diffCenterX = otherCenter.x - curCenter.x;
    if (Math.abs(diffCenterX) < minDiffX) {
      minDiffX = Math.abs(diffCenterX);
      bestCandidateX = {
        diff: diffCenterX,
        x: otherCenter.x,
        y1: Math.min(curCenter.y, otherCenter.y) - 15,
        y2: Math.max(curCenter.y, otherCenter.y) + 15,
        points: [{ x: otherCenter.x, y: otherCenter.y }, { x: otherCenter.x, y: curCenter.y }],
        label: 'Căn tâm dọc',
        priority: 7
      };
    }

    const diffCenterY = otherCenter.y - curCenter.y;
    if (Math.abs(diffCenterY) < minDiffY) {
      minDiffY = Math.abs(diffCenterY);
      bestCandidateY = {
        diff: diffCenterY,
        y: otherCenter.y,
        x1: Math.min(curCenter.x, otherCenter.x) - 15,
        x2: Math.max(curCenter.x, otherCenter.x) + 15,
        points: [{ x: otherCenter.x, y: otherCenter.y }, { x: curCenter.x, y: otherCenter.y }],
        label: 'Căn tâm ngang',
        priority: 7
      };
    }

    // C. Bounding Box Edges (Left, Right, Top, Bottom)
    if (curBox && otherBox) {
      // Left to Left
      const dL2L = otherBox.minX - curBox.minX;
      if (Math.abs(dL2L) < minDiffX) {
        minDiffX = Math.abs(dL2L);
        bestCandidateX = {
          diff: dL2L,
          x: otherBox.minX,
          y1: Math.min(curBox.minY, otherBox.minY) - 15,
          y2: Math.max(curBox.maxY, otherBox.maxY) + 15,
          points: [{ x: otherBox.minX, y: otherBox.minY }, { x: otherBox.minX, y: curBox.minY }],
          label: 'Căn lề trái',
          priority: 5
        };
      }
      // Right to Right
      const dR2R = otherBox.maxX - curBox.maxX;
      if (Math.abs(dR2R) < minDiffX) {
        minDiffX = Math.abs(dR2R);
        bestCandidateX = {
          diff: dR2R,
          x: otherBox.maxX,
          y1: Math.min(curBox.minY, otherBox.minY) - 15,
          y2: Math.max(curBox.maxY, otherBox.maxY) + 15,
          points: [{ x: otherBox.maxX, y: otherBox.maxY }, { x: otherBox.maxX, y: curBox.maxY }],
          label: 'Căn lề phải',
          priority: 5
        };
      }
      // Top to Top
      const dT2T = otherBox.minY - curBox.minY;
      if (Math.abs(dT2T) < minDiffY) {
        minDiffY = Math.abs(dT2T);
        bestCandidateY = {
          diff: dT2T,
          y: otherBox.minY,
          x1: Math.min(curBox.minX, otherBox.minX) - 15,
          x2: Math.max(curBox.maxX, otherBox.maxX) + 15,
          points: [{ x: otherBox.minX, y: otherBox.minY }, { x: curBox.minX, y: otherBox.minY }],
          label: 'Căn đỉnh trên',
          priority: 5
        };
      }
      // Bottom to Bottom
      const dB2B = otherBox.maxY - curBox.maxY;
      if (Math.abs(dB2B) < minDiffY) {
        minDiffY = Math.abs(dB2B);
        bestCandidateY = {
          diff: dB2B,
          y: otherBox.maxY,
          x1: Math.min(curBox.minX, otherBox.minX) - 15,
          x2: Math.max(curBox.maxX, otherBox.maxX) + 15,
          points: [{ x: otherBox.maxX, y: otherBox.maxY }, { x: curBox.maxX, y: otherBox.maxY }],
          label: 'Căn đáy dưới',
          priority: 5
        };
      }
    }
  }

  // Apply best candidates
  if (bestCandidateX) {
    dx += bestCandidateX.diff;
    guides.push({
      type: 'vertical',
      x: bestCandidateX.x,
      y1: bestCandidateX.y1,
      y2: bestCandidateX.y2,
      points: bestCandidateX.points,
      label: bestCandidateX.label
    });
  }

  if (bestCandidateY) {
    dy += bestCandidateY.diff;
    guides.push({
      type: 'horizontal',
      y: bestCandidateY.y,
      x1: bestCandidateY.x1,
      x2: bestCandidateY.x2,
      points: bestCandidateY.points,
      label: bestCandidateY.label
    });
  }

  return { dx, dy, guides };
}

function distToSegment(p, v, w) {
  const l2 = (v.x - w.x)**2 + (v.y - w.y)**2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}


function getTextDimensions(shape) {
  if (!shape) return { w: 40, h: 20 };
  const fontSize = shape.fontSize || shape.size || 16;
  const fontFamily = shape.fontFamily || 'Arial';
  const lines = (shape.text || '').split('\n');
  const lineHeight = fontSize * 1.25;

  let maxW = 0;
  if (typeof sceneCtx !== 'undefined' && sceneCtx) {
    let fontStyle = '';
    if (shape.isItalic) fontStyle += 'italic ';
    if (shape.isBold) fontStyle += 'bold ';
    sceneCtx.save();
    sceneCtx.font = `${fontStyle}${fontSize}px ${fontFamily}, sans-serif`;
    lines.forEach(l => {
      const w = sceneCtx.measureText(l).width;
      if (w > maxW) maxW = w;
    });
    sceneCtx.restore();
  }
  if (!maxW) {
    let maxLen = 0;
    lines.forEach(l => { if (l.length > maxLen) maxLen = l.length; });
    maxW = Math.max(30, maxLen * fontSize * 0.7);
  }
  const totalH = Math.max(fontSize * 1.2, lines.length * lineHeight);
  return { w: Math.max(30, maxW), h: totalH, lineHeight: lineHeight, fontSize: fontSize };
}


function getShapeCenter(shape) {
  if (!shape) return { x: 0, y: 0 };
  if (shape.type === 'curve' || shape.type === 'curve_dashed') {
    return {
      x: 0.25 * shape.x1 + 0.5 * shape.cx + 0.25 * shape.x2,
      y: 0.25 * shape.y1 + 0.5 * shape.cy + 0.25 * shape.y2
    };
  }
  if (isVehicleShape(shape)) {
    const w = getVehicleDimensions(shape).w;
    const cos = Math.cos(shape.angle);
    const sin = Math.sin(shape.angle);
    return {
      x: shape.startX + (w / 2) * cos,
      y: shape.startY + (w / 2) * sin
    };
  }
  if (isLinearResizableShape(shape)) {
    return {
      x: (shape.x1 + shape.x2) / 2,
      y: (shape.y1 + shape.y2) / 2
    };
  }
  if (shape.type === 'rect') {
    return {
      x: shape.x + shape.w / 2,
      y: shape.y + shape.h / 2
    };
  }
  if (shape.type === 'text') {
    const dim = getTextDimensions(shape);
    const angle = shape.angle || 0;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: shape.x + (dim.w / 2) * cos - (dim.h / 2) * sin,
      y: shape.y + (dim.w / 2) * sin + (dim.h / 2) * cos
    };
  }
  if (shape.type === 'xmark' || shape.type === 'number_note') {
    return { x: shape.x, y: shape.y };
  }
  if (shape.type === 'pen' || shape.type === 'eraser' || shape.type === 'tire_track') {
    const box = getShapeBoundingBox(shape);
    return box ? { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 } : { x: 0, y: 0 };
  }
  return { x: 0, y: 0 };
}


function getShapeRotationHandlePos(shape) {
  if (!shape) return null;
  const pad = 6;
  const stemLen = 26;

  if (shape.type === 'curve' || shape.type === 'curve_dashed') {
    const center = getShapeCenter(shape);
    const angle = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
    const normX = -Math.sin(angle);
    const normY = Math.cos(angle);
    return {
      x: center.x - normX * 32,
      y: center.y - normY * 32
    };
  }

  if (isVehicleShape(shape)) {
    const { w, h } = getVehicleDimensions(shape);
    const cos = Math.cos(shape.angle);
    const sin = Math.sin(shape.angle);
    const lx = w / 2;
    const ly = -h / 2 - pad - stemLen;
    return {
      x: shape.startX + (lx * cos - ly * sin),
      y: shape.startY + (lx * sin + ly * cos)
    };
  }

  if (shape.type === 'rect') {
    const angle = shape.angle || 0;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const center = getShapeCenter(shape);
    const ly = -shape.h / 2 - pad - stemLen;
    return {
      x: center.x - ly * sin,
      y: center.y + ly * cos
    };
  }

  if (shape.type === 'text') {
    const dim = getTextDimensions(shape);
    const center = getShapeCenter(shape);
    const angle = shape.angle || 0;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const tPad = 8;
    const tStemLen = 28;
    const ly = -dim.h / 2 - tPad - tStemLen;
    return {
      x: center.x - ly * sin,
      y: center.y + ly * cos
    };
  }

  if (isLinearResizableShape(shape)) {
    const angle = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
    const center = getShapeCenter(shape);
    const normX = -Math.sin(angle);
    const normY = Math.cos(angle);
    const offset = getLinearShapeHalfBand(shape) + 24;
    return {
      x: center.x - normX * offset,
      y: center.y - normY * offset
    };
  }

  const box = getShapeBoundingBox(shape);
  if (!box) return null;
  return {
    x: (box.minX + box.maxX) / 2,
    y: box.minY - stemLen
  };
}


function hitTestRotationHandle(shape, px, py) {
  const rotPos = getShapeRotationHandlePos(shape);
  if (!rotPos) return false;
  return Math.hypot(px - rotPos.x, py - rotPos.y) <= 15;
}


function isLinearResizableShape(shape) {
  if (!shape) return false;
  return shape.type === 'line' ||
    shape.type === 'dashed_line' ||
    shape.type === 'road_line' ||
    shape.type === 'road_dashed' ||
    shape.type === 'road_edge' ||
    shape.type === 'measure' ||
    shape.type === 'person' ||
    shape.type === 'crosswalk' ||
    shape.type === 'traffic_light' ||
    shape.type === 'median' ||
    shape.type === 'median_blocks';
}


function isInfrastructureAssetShape(shape) {
  return !!shape && (shape.type === 'crosswalk' || shape.type === 'traffic_light' || shape.type === 'median' || shape.type === 'median_blocks' || shape.type === 'road_edge');
}


function isSceneryAssetType(type) {
  return type === 'utility_pole' || type === 'road_boundary_marker' || type === 'pothole' ||
    type === 'geo_circle' || type === 'geo_triangle' || type === 'geo_round_triangle' ||
    type === 'sign_circle_post' || type === 'sign_triangle_post' ||
    type === 'tree' || type === 'median_tree' || type === 'rice_field' || type === 'forest' ||
    type === 'truck' || type === 'toll_station';
}


function isTrafficSignPostType(type) {
  return type === 'sign_circle_post' || type === 'sign_triangle_post';
}


function getTrafficSignKindOption(value) {
  return TRAFFIC_SIGN_KIND_OPTIONS.find(option => option.value === value) || TRAFFIC_SIGN_KIND_OPTIONS[0];
}


function ensureTrafficSignEditor() {
  let overlay = document.getElementById('sceneTrafficSignOverlay');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'sceneTrafficSignOverlay';
  overlay.className = 'p-modal-overlay';
  overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:100070;align-items:center;justify-content:center;background:rgba(15,23,42,.58);backdrop-filter:blur(9px);padding:16px;font-family:inherit;';
  overlay.onclick = function(event) {
    if (!event.target.closest || !event.target.closest('.scene-premium-select')) closeTrafficSignKindDropdown();
    if (event.target === overlay) closeTrafficSignEditor();
  };
  overlay.innerHTML = `
    <style>
      #sceneTrafficSignOverlay .scene-premium-select { position:relative; width:100%; }
      #sceneTrafficSignOverlay .scene-premium-select-trigger {
        width:100%; min-height:48px; display:grid; grid-template-columns:34px minmax(0,1fr) 18px;
        align-items:center; gap:10px; padding:6px 13px 6px 8px; color:var(--text-main);
        border:1px solid rgba(148,163,184,.34); border-radius:13px;
        background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(250,248,243,.96));
        box-shadow:0 5px 16px rgba(15,23,42,.06),inset 0 1px 0 rgba(255,255,255,.85);
        cursor:pointer; text-align:left; font:750 13px inherit; transition:border-color .18s,box-shadow .18s,transform .18s;
      }
      #sceneTrafficSignOverlay .scene-premium-select-trigger:hover,
      #sceneTrafficSignOverlay .scene-premium-select-trigger[aria-expanded="true"] {
        border-color:rgba(190,137,37,.72); box-shadow:0 8px 22px rgba(154,104,24,.13),0 0 0 3px rgba(216,180,109,.12);
      }
      #sceneTrafficSignOverlay .scene-premium-select-trigger:focus-visible { outline:none; border-color:#bd8827; box-shadow:0 0 0 4px rgba(216,180,109,.2); }
      #sceneTrafficSignOverlay .scene-sign-kind-badge {
        width:32px; height:32px; display:grid; place-items:center; box-sizing:border-box;
        color:#9a6818; border:1px solid rgba(190,137,37,.35); border-radius:10px;
        background:linear-gradient(145deg,#fffaf0,#f6ead0); font-size:10px; font-weight:900; letter-spacing:-.03em;
      }
      #sceneTrafficSignOverlay .scene-premium-select-chevron { width:16px; height:16px; color:#8a672d; transition:transform .2s; }
      #sceneTrafficSignOverlay .scene-premium-select-trigger[aria-expanded="true"] .scene-premium-select-chevron { transform:rotate(180deg); }
      #sceneTrafficSignOverlay .scene-premium-select-menu {
        position:absolute; z-index:20; top:calc(100% + 8px); left:0; right:0; display:none;
        max-height:min(330px,44vh); overflow-y:auto; overscroll-behavior:contain; padding:7px;
        border:1px solid rgba(190,137,37,.34); border-radius:15px;
        background:rgba(255,255,255,.985); box-shadow:0 24px 54px rgba(15,23,42,.22),0 3px 12px rgba(15,23,42,.08);
        backdrop-filter:blur(18px); scrollbar-width:thin; scrollbar-color:#c99a43 #f3eee4;
      }
      #sceneTrafficSignOverlay .scene-premium-select-menu.is-open { display:flex; flex-direction:column; gap:3px; animation:sceneSignMenuIn .16s ease-out; }
      #sceneTrafficSignOverlay .scene-premium-select-menu::-webkit-scrollbar { width:8px; }
      #sceneTrafficSignOverlay .scene-premium-select-menu::-webkit-scrollbar-track { margin:7px 0; border-radius:999px; background:#f3eee4; }
      #sceneTrafficSignOverlay .scene-premium-select-menu::-webkit-scrollbar-thumb { border:2px solid #f3eee4; border-radius:999px; background:linear-gradient(#d8b46d,#b47c1f); }
      #sceneTrafficSignOverlay .scene-premium-select-option {
        width:100%; min-height:43px; display:grid; grid-template-columns:31px minmax(0,1fr) 20px;
        align-items:center; gap:10px; padding:5px 9px; color:#273244; border:1px solid transparent;
        border-radius:11px; background:transparent; cursor:pointer; text-align:left; font:700 12.5px inherit;
        transition:background .15s,border-color .15s,color .15s,transform .15s;
      }
      #sceneTrafficSignOverlay .scene-premium-select-option:hover,
      #sceneTrafficSignOverlay .scene-premium-select-option:focus-visible { outline:none; color:#714a0b; border-color:rgba(216,180,109,.3); background:#fff8e9; transform:translateX(2px); }
      #sceneTrafficSignOverlay .scene-premium-select-option[aria-selected="true"] { color:#714a0b; border-color:rgba(190,137,37,.42); background:linear-gradient(135deg,#fff8e8,#f8ecd1); }
      #sceneTrafficSignOverlay .scene-premium-select-option[aria-selected="true"] .scene-sign-kind-badge { color:#fff; border-color:#b98022; background:linear-gradient(145deg,#d4a84e,#a86e16); box-shadow:0 4px 10px rgba(169,111,22,.22); }
      #sceneTrafficSignOverlay .scene-premium-option-check { opacity:0; color:#aa731c; font-size:16px; font-weight:900; text-align:center; }
      #sceneTrafficSignOverlay .scene-premium-select-option[aria-selected="true"] .scene-premium-option-check { opacity:1; }
      @keyframes sceneSignMenuIn { from { opacity:0; transform:translateY(-5px) scale(.985); } to { opacity:1; transform:translateY(0) scale(1); } }
    </style>
    <div role="dialog" aria-modal="true" aria-labelledby="sceneTrafficSignTitle" style="width:min(520px,96vw);overflow:visible;color:var(--text-main);border:1px solid rgba(216,180,109,.4);border-radius:20px;background:var(--surface-strong);box-shadow:0 28px 75px rgba(0,0,0,.4);font-family:inherit;">
      <div style="padding:18px 20px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);">
        <div><div id="sceneTrafficSignTitle" style="font-size:16px;font-weight:850;">Chọn nội dung biển báo</div><div style="font-size:11.5px;color:var(--text-muted);margin-top:3px;">Ký hiệu sẽ được hiển thị trực tiếp trên mặt biển</div></div>
        <button type="button" onclick="closeTrafficSignEditor()" aria-label="Đóng" style="width:34px;height:34px;border-radius:10px;border:1px solid var(--border);background:var(--surface-soft);color:var(--text-muted);cursor:pointer;font-family:inherit;">✕</button>
      </div>
      <div style="padding:20px;display:flex;flex-direction:column;gap:14px;">
        <div style="display:flex;flex-direction:column;gap:6px;">
          <label id="sceneTrafficSignKindLabel" style="font-size:12px;font-weight:800;">Biển báo đang báo hiệu</label>
          <input id="sceneTrafficSignKind" type="hidden" value="speed_limit" />
          <div class="scene-premium-select" id="sceneTrafficSignKindControl">
            <button type="button" id="sceneTrafficSignKindTrigger" class="scene-premium-select-trigger" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="sceneTrafficSignKindLabel sceneTrafficSignKindText" onclick="toggleTrafficSignKindDropdown(event)" onkeydown="handleTrafficSignKindKeydown(event)">
              <span class="scene-sign-kind-badge" id="sceneTrafficSignKindBadge">50</span>
              <span id="sceneTrafficSignKindText">Giới hạn tốc độ</span>
              <svg class="scene-premium-select-chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7.5l5 5 5-5"></path></svg>
            </button>
            <div id="sceneTrafficSignKindMenu" class="scene-premium-select-menu" role="listbox" aria-labelledby="sceneTrafficSignKindLabel">
              ${TRAFFIC_SIGN_KIND_OPTIONS.map(option => `
                <button type="button" class="scene-premium-select-option" role="option" aria-selected="false" data-value="${option.value}" onclick="selectTrafficSignKind('${option.value}', event)" onkeydown="handleTrafficSignKindKeydown(event)">
                  <span class="scene-sign-kind-badge">${option.badge}</span>
                  <span>${option.label}</span>
                  <span class="scene-premium-option-check">✓</span>
                </button>`).join('')}
            </div>
          </div>
        </div>
        <div id="sceneTrafficSignSpeedWrap" style="display:flex;flex-direction:column;gap:6px;">
          <label for="sceneTrafficSignSpeed" style="font-size:12px;font-weight:800;">Tốc độ tối đa (km/h)</label>
          <input id="sceneTrafficSignSpeed" type="number" min="5" max="200" step="5" value="50" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;background:var(--bg-soft,#fff);color:var(--text-main);font:800 13px inherit;outline:none;" />
        </div>
        <div id="sceneTrafficSignCustomWrap" style="display:none;flex-direction:column;gap:6px;">
          <label for="sceneTrafficSignCustom" style="font-size:12px;font-weight:800;">Chữ hoặc ký hiệu ngắn</label>
          <input id="sceneTrafficSignCustom" type="text" maxlength="6" placeholder="Ví dụ: 3.5T" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;background:var(--bg-soft,#fff);color:var(--text-main);font:800 13px inherit;outline:none;" />
        </div>
      </div>
      <div style="padding:14px 20px 18px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px;">
        <button type="button" class="btn-secondary" onclick="closeTrafficSignEditor()" style="padding:9px 18px;border-radius:10px;font:700 13px inherit;">Hủy</button>
        <button type="button" class="btn-premium" onclick="applyTrafficSignEditor()" style="padding:9px 20px;border-radius:10px;font:800 13px inherit;width:auto;min-height:unset;">Cập nhật biển</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  return overlay;
}


function syncTrafficSignKindControl() {
  const input = document.getElementById('sceneTrafficSignKind');
  const value = input?.value || 'speed_limit';
  const selected = getTrafficSignKindOption(value);
  const text = document.getElementById('sceneTrafficSignKindText');
  const badge = document.getElementById('sceneTrafficSignKindBadge');
  if (text) text.textContent = selected.label;
  if (badge) badge.textContent = selected.badge;
  document.querySelectorAll('#sceneTrafficSignKindMenu .scene-premium-select-option').forEach(option => {
    option.setAttribute('aria-selected', option.dataset.value === selected.value ? 'true' : 'false');
  });
}


function isTrafficSignKindDropdownOpen() {
  return document.getElementById('sceneTrafficSignKindMenu')?.classList.contains('is-open') || false;
}


function openTrafficSignKindDropdown(focusSelected = false) {
  const trigger = document.getElementById('sceneTrafficSignKindTrigger');
  const menu = document.getElementById('sceneTrafficSignKindMenu');
  if (!trigger || !menu) return;
  menu.classList.add('is-open');
  trigger.setAttribute('aria-expanded', 'true');
  if (focusSelected) {
    const selected = menu.querySelector('[aria-selected="true"]') || menu.querySelector('.scene-premium-select-option');
    if (selected) {
      selected.focus({ preventScroll: true });
      selected.scrollIntoView({ block: 'nearest' });
    }
  }
}


function closeTrafficSignKindDropdown(returnFocus = false) {
  const trigger = document.getElementById('sceneTrafficSignKindTrigger');
  const menu = document.getElementById('sceneTrafficSignKindMenu');
  if (menu) menu.classList.remove('is-open');
  if (trigger) {
    trigger.setAttribute('aria-expanded', 'false');
    if (returnFocus) trigger.focus({ preventScroll: true });
  }
}


function toggleTrafficSignKindDropdown(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  if (isTrafficSignKindDropdownOpen()) closeTrafficSignKindDropdown(false);
  else openTrafficSignKindDropdown(false);
}


function selectTrafficSignKind(value, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const input = document.getElementById('sceneTrafficSignKind');
  if (input) input.value = getTrafficSignKindOption(value).value;
  syncTrafficSignKindControl();
  updateTrafficSignEditorFields();
  closeTrafficSignKindDropdown(true);
}


function handleTrafficSignKindKeydown(event) {
  const menu = document.getElementById('sceneTrafficSignKindMenu');
  if (!menu) return;
  const options = Array.from(menu.querySelectorAll('.scene-premium-select-option'));
  const currentIndex = options.indexOf(document.activeElement);

  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeTrafficSignKindDropdown(true);
    return;
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    event.stopPropagation();
    if (!isTrafficSignKindDropdownOpen()) {
      openTrafficSignKindDropdown(true);
      return;
    }
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = currentIndex < 0
      ? (direction > 0 ? 0 : options.length - 1)
      : (currentIndex + direction + options.length) % options.length;
    options[nextIndex]?.focus({ preventScroll: true });
    options[nextIndex]?.scrollIntoView({ block: 'nearest' });
    return;
  }
  if ((event.key === 'Enter' || event.key === ' ') && document.activeElement?.classList.contains('scene-premium-select-option')) {
    event.preventDefault();
    selectTrafficSignKind(document.activeElement.dataset.value, event);
    return;
  }
  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    const target = event.key === 'Home' ? options[0] : options[options.length - 1];
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'nearest' });
  }
}


function updateTrafficSignEditorFields() {
  const kind = document.getElementById('sceneTrafficSignKind')?.value || 'speed_limit';
  const speedWrap = document.getElementById('sceneTrafficSignSpeedWrap');
  const customWrap = document.getElementById('sceneTrafficSignCustomWrap');
  if (speedWrap) speedWrap.style.display = kind === 'speed_limit' ? 'flex' : 'none';
  if (customWrap) customWrap.style.display = kind === 'custom' ? 'flex' : 'none';
}


function openTrafficSignEditor(shape) {
  if (!shape || !isTrafficSignPostType(shape.type)) return;
  const overlay = ensureTrafficSignEditor();
  editingTrafficSignId = shape.id;
  const kindSelect = document.getElementById('sceneTrafficSignKind');
  const speedInput = document.getElementById('sceneTrafficSignSpeed');
  const customInput = document.getElementById('sceneTrafficSignCustom');
  if (kindSelect) kindSelect.value = shape.signKind || (shape.type === 'sign_triangle_post' ? 'intersection_non_priority' : 'speed_limit');
  if (speedInput) speedInput.value = Math.max(5, Math.min(200, parseInt(shape.speedLimit, 10) || 50));
  if (customInput) customInput.value = shape.customLabel || '';
  syncTrafficSignKindControl();
  updateTrafficSignEditorFields();
  overlay.style.display = 'flex';
  setTimeout(function() { document.getElementById('sceneTrafficSignKindTrigger')?.focus(); }, 0);
}


function openSelectedTrafficSignEditor() {
  const shape = sceneShapes.find(item => item.id === selectedShapeId);
  openTrafficSignEditor(shape);
}


function closeTrafficSignEditor() {
  const overlay = document.getElementById('sceneTrafficSignOverlay');
  if (overlay) overlay.style.display = 'none';
  closeTrafficSignKindDropdown(false);
  editingTrafficSignId = null;
}


function applyTrafficSignEditor() {
  const shape = sceneShapes.find(item => item.id === editingTrafficSignId);
  if (!shape || !isTrafficSignPostType(shape.type)) {
    closeTrafficSignEditor();
    return;
  }
  const kind = document.getElementById('sceneTrafficSignKind')?.value || 'speed_limit';
  const speed = parseInt(document.getElementById('sceneTrafficSignSpeed')?.value, 10);
  const customLabel = String(document.getElementById('sceneTrafficSignCustom')?.value || '').trim();
  shape.signKind = kind;
  shape.speedLimit = Math.max(5, Math.min(200, Number.isFinite(speed) ? speed : 50));
  shape.customLabel = customLabel.slice(0, 6);
  saveDrawingState();
  updateSelectionBadge();
  redrawSceneCanvas(true);
  closeTrafficSignEditor();
  if (typeof showToast === 'function') showToast('Đã cập nhật nội dung biển báo', 'success');
}


function isSceneryAssetShape(shape) {
  return !!shape && isSceneryAssetType(shape.type);
}


function getSceneryAspectRatio(type) {
  if (type === 'utility_pole') return 0.48;
  if (type === 'road_boundary_marker') return 0.46;
  if (type === 'pothole') return 0.62;
  if (type === 'geo_circle') return 1;
  if (type === 'geo_triangle' || type === 'geo_round_triangle') return 0.9;
  if (type === 'sign_circle_post') return 0.62;
  if (type === 'sign_triangle_post') return 0.68;
  if (type === 'tree') return 1;
  if (type === 'median_tree') return 0.38;
  if (type === 'rice_field') return 0.58;
  if (type === 'forest') return 0.62;
  if (type === 'truck') return 0.4;
  if (type === 'toll_station') return 0.62;
  return 0.5;
}


function getSceneryMinimumLength(type) {
  if (type === 'tree') return 28;
  if (type === 'geo_circle') return 24;
  if (type === 'geo_triangle' || type === 'geo_round_triangle') return 28;
  if (type === 'sign_circle_post' || type === 'sign_triangle_post') return 42;
  if (type === 'utility_pole') return 32;
  if (type === 'road_boundary_marker') return 46;
  if (type === 'pothole') return 30;
  if (type === 'median_tree') return 55;
  if (type === 'rice_field') return 60;
  if (type === 'forest') return 60;
  if (type === 'truck') return 60;
  if (type === 'toll_station') return 90;
  return 24;
}


function isRoadVehicleShape(shape) {
  return !!shape && (shape.type === 'car' || shape.type === 'container' || shape.type === 'bike' || shape.type === 'fallen_bike');
}


function isVehicleShape(shape) {
  return !!shape && (isRoadVehicleShape(shape) || isSceneryAssetType(shape.type));
}


function getVehicleDimensions(shape) {
  if (!shape) return { w: 0, h: 0 };
  // vehicleH: chiều ngang riêng của xe khi người dùng kéo cạnh trên/dưới (sơ đồ cũ không có → giữ tỷ lệ mặc định).
  const vehicleHeight = (w, ratio) => (Number.isFinite(shape.vehicleH) && shape.vehicleH > 0 ? shape.vehicleH : w * ratio);
  if (shape.type === 'container') {
    const w = shape.containerW || 70;
    return { w, h: vehicleHeight(w, 0.3) };
  }
  if (shape.type === 'car') {
    const w = shape.carW || 30;
    return { w, h: vehicleHeight(w, 0.5) };
  }
  if (shape.type === 'fallen_bike') {
    const w = shape.fallenBikeW || 42;
    return { w, h: vehicleHeight(w, 0.48) };
  }
  if (isSceneryAssetShape(shape)) {
    const w = shape.objectW || getSceneryMinimumLength(shape.type);
    const proportionalHeight = w * getSceneryAspectRatio(shape.type);
    const h = Number.isFinite(shape.objectH)
      ? shape.objectH
      : proportionalHeight;
    return { w, h };
  }
  const w = shape.bikeW || 20;
  return { w, h: vehicleHeight(w, 0.42) };
}

// Tỷ lệ cao/dài mặc định của từng loại xe (dùng cho chiều cao tối thiểu khi co giãn).
function getDefaultVehicleAspect(shape) {
  if (!shape) return 0.5;
  if (shape.type === 'container') return 0.3;
  if (shape.type === 'car') return 0.5;
  if (shape.type === 'fallen_bike') return 0.48;
  if (shape.type === 'bike') return 0.42;
  return 0.5;
}


function setVehicleLength(shape, nextLength) {
  if (!shape) return;
  if (shape.type === 'container') shape.containerW = nextLength;
  else if (shape.type === 'car') shape.carW = nextLength;
  else if (shape.type === 'bike') shape.bikeW = nextLength;
  else if (shape.type === 'fallen_bike') shape.fallenBikeW = nextLength;
  else if (isSceneryAssetShape(shape)) shape.objectW = nextLength;
}


function getMinimumVehicleLength(shape) {
  if (!shape) return 20;
  if (shape.type === 'container') return 40;
  if (shape.type === 'car') return 15;
  if (shape.type === 'fallen_bike') return 34;
  if (isSceneryAssetShape(shape)) return getSceneryMinimumLength(shape.type);
  return 28;
}


function isSizeAdjustableShape(shape) {
  return isInfrastructureAssetShape(shape) || isVehicleShape(shape) || (shape && shape.type === 'number_note');
}


function getLinearShapeHalfBand(shape) {
  if (!shape) return 8;
  const sizeScale = Math.max(0.5, Math.min(3, shape.sizeScale || 1));
  if (shape.type === 'crosswalk') return 24 * sizeScale;
  if (shape.type === 'traffic_light') return 12 * sizeScale;
  if (shape.type === 'median' || shape.type === 'median_blocks') return 14 * sizeScale;
  if (shape.type === 'road_edge') {
    const baseBandWidth = Math.max(10, Math.min(24, (shape.width || 2) * 3.2 + 6));
    return (baseBandWidth / 2) * sizeScale;
  }
  if (shape.type === 'person') {
    const length = Math.hypot((shape.x2 || 0) - (shape.x1 || 0), (shape.y2 || 0) - (shape.y1 || 0));
    return Math.max(10, length * 0.24);
  }
  return Math.max(7, (shape.width || 2) + 5);
}


function getMinimumLinearLength(shape) {
  if (!shape) return 20;
  return 20;
}


function hitTestLinearResizeHandle(shape, px, py) {
  if (!isLinearResizableShape(shape)) return null;
  const hitRadius = 14;
  const endpoints = getVisibleLinearResizeEndpoints(shape);
  if (!endpoints) return null;
  if (Math.hypot(px - endpoints.start.x, py - endpoints.start.y) <= hitRadius) return 'start';
  if (Math.hypot(px - endpoints.end.x, py - endpoints.end.y) <= hitRadius) return 'end';
  return null;
}


function hitTestInfraBandResizeHandle(shape, px, py) {
  if (!isInfrastructureAssetShape(shape)) return 0;
  const center = getShapeCenter(shape);
  const angle = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);
  const halfBand = getLinearShapeHalfBand(shape);
  const positive = { x: center.x + nx * halfBand, y: center.y + ny * halfBand };
  const negative = { x: center.x - nx * halfBand, y: center.y - ny * halfBand };
  const radius = 14;
  if (Math.hypot(px - positive.x, py - positive.y) <= radius) return 1;
  if (Math.hypot(px - negative.x, py - negative.y) <= radius) return -1;
  return 0;
}


function hitTestNumberNoteResizeHandle(shape, px, py) {
  if (!shape || shape.type !== 'number_note') return false;
  const box = getShapeBoundingBox(shape);
  if (!box) return false;
  const points = [
    { x: box.minX, y: box.minY },
    { x: box.maxX, y: box.minY },
    { x: box.minX, y: box.maxY },
    { x: box.maxX, y: box.maxY },
    { x: (box.minX + box.maxX) / 2, y: box.minY },
    { x: (box.minX + box.maxX) / 2, y: box.maxY },
    { x: box.minX, y: (box.minY + box.maxY) / 2 },
    { x: box.maxX, y: (box.minY + box.maxY) / 2 }
  ];
  return points.some(point => Math.hypot(px - point.x, py - point.y) <= 11);
}


function resizeNumberNoteFromPointer(shape, original, px, py) {
  if (!shape || shape.type !== 'number_note' || !original) return false;
  const handlePadding = 7;
  const distanceFromCenter = Math.max(Math.abs(px - original.x), Math.abs(py - original.y));
  const nextRadius = Math.max(8, Math.min(38, distanceFromCenter - handlePadding));
  const oldRadius = shape.radius || 13;
  shape.radius = nextRadius;
  shape.sizeScale = nextRadius / 13;
  return Math.abs(nextRadius - oldRadius) > 0.15;
}


function getVehicleResizeHandlePoints(shape) {
  if (!isVehicleShape(shape)) return [];
  const { w, h } = getVehicleDimensions(shape);
  const pad = 6;
  const angle = shape.angle || 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const toGlobal = (id, lx, ly) => ({
    id,
    x: shape.startX + lx * cos - ly * sin,
    y: shape.startY + lx * sin + ly * cos
  });
  return [
    toGlobal('nw', -pad, -h / 2 - pad),
    toGlobal('ne', w + pad, -h / 2 - pad),
    toGlobal('se', w + pad, h / 2 + pad),
    toGlobal('sw', -pad, h / 2 + pad),
    toGlobal('n', w / 2, -h / 2 - pad),
    toGlobal('s', w / 2, h / 2 + pad),
    toGlobal('w', -pad, 0),
    toGlobal('e', w + pad, 0)
  ];
}


function hitTestVehicleResizeHandle(shape, px, py) {
  if (!isVehicleShape(shape)) return null;
  const points = getVehicleResizeHandlePoints(shape);
  const hitRadius = 11;
  for (let i = 0; i < points.length; i++) {
    if (Math.hypot(px - points[i].x, py - points[i].y) <= hitRadius) return points[i].id;
  }
  return null;
}


function getResizeCursorFromScreenAngle(angle) {
  const normalized = ((angle % Math.PI) + Math.PI) % Math.PI;
  if (normalized < Math.PI / 8 || normalized >= 7 * Math.PI / 8) return 'ew-resize';
  if (normalized < 3 * Math.PI / 8) return 'nwse-resize';
  if (normalized < 5 * Math.PI / 8) return 'ns-resize';
  return 'nesw-resize';
}


function getVehicleResizeCursor(handle, shape) {
  if (!shape || !isVehicleShape(shape)) {
    if (handle === 'n' || handle === 's') return 'ns-resize';
    if (handle === 'e' || handle === 'w') return 'ew-resize';
    if (handle === 'ne' || handle === 'sw') return 'nesw-resize';
    return 'nwse-resize';
  }

  const objectAngle = shape.angle || 0;
  if (handle === 'e' || handle === 'w') {
    return getResizeCursorFromScreenAngle(objectAngle);
  }
  if (handle === 'n' || handle === 's') {
    return getResizeCursorFromScreenAngle(objectAngle + Math.PI / 2);
  }

  // Tay nắm góc dùng đúng đường chéo của khung sau khi đối tượng đã xoay.
  const dimensions = getVehicleDimensions(shape);
  const halfW = dimensions.w / 2 + 6;
  const halfH = dimensions.h / 2 + 6;
  const localVectors = {
    nw: { x: -halfW, y: -halfH },
    ne: { x: halfW, y: -halfH },
    se: { x: halfW, y: halfH },
    sw: { x: -halfW, y: halfH }
  };
  const vector = localVectors[handle] || localVectors.se;
  return getResizeCursorFromScreenAngle(objectAngle + Math.atan2(vector.y, vector.x));
}


function resizeVehicleFromPointer(shape, original, handle, px, py) {
  if (!isVehicleShape(shape) || !isVehicleShape(original) || !handle) return false;
  const originalDimensions = getVehicleDimensions(original);
  const originalWidth = Math.max(0.001, originalDimensions.w);
  const originalHeight = Math.max(0.001, originalDimensions.h);
  const center = getShapeCenter(original);
  const angle = original.angle || 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = px - center.x;
  const dy = py - center.y;
  const localX = dx * cos + dy * sin;
  const localY = -dx * sin + dy * cos;
  const pad = 6;
  const baseHalfW = originalWidth / 2 + pad;
  const baseHalfH = originalHeight / 2 + pad;

  // Cơ chế resize hai chiều cho MỌI đối tượng dạng khung (xe & cảnh quan / hình học):
  // - cạnh trái/phải: chỉ đổi chiều dài;
  // - cạnh trên/dưới: chỉ đổi độ cao (chiều ngang của xe);
  // - bốn góc: phóng to/thu nhỏ đồng bộ theo tỷ lệ.
  // Trước đây xe (ô tô, xe máy, container…) chỉ có MỘT hệ số phóng từ tâm và khóa tỷ lệ,
  // nên kéo cạnh trái/phải không thể co riêng chiều ngang như hướng dẫn trên panel.
  {
    const isScenery = isSceneryAssetShape(shape);
    const pointerLocalX = localX + originalWidth / 2;
    const pointerLocalY = localY;
    const pullsEast = handle.includes('e');
    const pullsWest = handle.includes('w');
    const pullsNorth = handle.includes('n');
    const pullsSouth = handle.includes('s');
    let nextWidth = originalWidth;
    let nextHeight = originalHeight;

    if (handle === 'e' || handle === 'w') {
      nextWidth = pullsEast
        ? pointerLocalX - pad
        : originalWidth - pointerLocalX - pad;
    } else if (handle === 'n' || handle === 's') {
      nextHeight = pullsSouth
        ? pointerLocalY + originalHeight / 2 - pad
        : originalHeight / 2 - pointerLocalY - pad;
    } else {
      const widthCandidate = pullsEast
        ? pointerLocalX - pad
        : originalWidth - pointerLocalX - pad;
      const heightCandidate = pullsSouth
        ? pointerLocalY + originalHeight / 2 - pad
        : originalHeight / 2 - pointerLocalY - pad;
      const widthScale = widthCandidate / originalWidth;
      const heightScale = heightCandidate / originalHeight;
      const uniformScale = widthScale >= 1 || heightScale >= 1
        ? Math.max(widthScale, heightScale)
        : Math.min(widthScale, heightScale);
      nextWidth = originalWidth * uniformScale;
      nextHeight = originalHeight * uniformScale;
    }

    nextWidth = Math.max(getMinimumVehicleLength(original), Math.min(900, nextWidth));
    const minimumHeight = isScenery
      ? Math.max(12, getSceneryMinimumLength(original.type) * getSceneryAspectRatio(original.type) * 0.35)
      : Math.max(6, getMinimumVehicleLength(original) * getDefaultVehicleAspect(original) * 0.5);
    nextHeight = Math.max(minimumHeight, Math.min(600, nextHeight));
    const oldDimensions = getVehicleDimensions(shape);

    // Giữ cố định cạnh đối diện thay vì phóng từ tâm, tránh cảm giác kéo ngược.
    const alongShift = pullsWest ? originalWidth - nextWidth : 0;
    let normalShift = 0;
    if (pullsNorth) normalShift = -(nextHeight - originalHeight) / 2;
    else if (pullsSouth) normalShift = (nextHeight - originalHeight) / 2;

    shape.startX = original.startX + alongShift * cos - normalShift * sin;
    shape.startY = original.startY + alongShift * sin + normalShift * cos;
    if (isScenery) {
      shape.objectW = nextWidth;
      shape.objectH = nextHeight;
      shape.sizeScale = Math.max(0.5, Math.min(3, nextWidth / Math.max(0.001, getSceneryMinimumLength(shape.type))));
    } else {
      setVehicleLength(shape, nextWidth);
      shape.vehicleH = nextHeight;
      shape.sizeScale = Math.max(0.5, Math.min(3, (original.sizeScale || 1) * (nextWidth / originalWidth)));
    }
    return Math.abs(nextWidth - oldDimensions.w) > 0.15 || Math.abs(nextHeight - oldDimensions.h) > 0.15;
  }

}


function getInfraBandResizeCursor(shape) {
  if (!isInfrastructureAssetShape(shape)) return 'default';
  const angle = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1) + Math.PI / 2;
  const normalized = ((angle % Math.PI) + Math.PI) % Math.PI;
  if (normalized < Math.PI / 8 || normalized >= 7 * Math.PI / 8) return 'ew-resize';
  if (normalized < 3 * Math.PI / 8) return 'nwse-resize';
  if (normalized < 5 * Math.PI / 8) return 'ns-resize';
  return 'nesw-resize';
}


function resizeInfrastructureBandFromPointer(shape, original, px, py) {
  if (!isInfrastructureAssetShape(shape) || !original) return false;
  const center = getShapeCenter(original);
  const angle = Math.atan2(original.y2 - original.y1, original.x2 - original.x1);
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);
  const signedDistance = ((px - center.x) * nx + (py - center.y) * ny) * infraResizeSide;
  const baseShape = { ...original, sizeScale: 1 };
  const baseHalfBand = Math.max(1, getLinearShapeHalfBand(baseShape));
  const nextScale = Math.max(0.5, Math.min(3, signedDistance / baseHalfBand));
  const oldScale = shape.sizeScale || 1;
  shape.sizeScale = nextScale;
  return Math.abs(nextScale - oldScale) > 0.002;
}


function scaleSelectedInfrastructure(factor) {
  if (!selectedShapeId || !Number.isFinite(factor) || factor <= 0) return;
  const intersection = getSelectedRoadIntersectionShapes();
  if (intersection.length) {
    const box = getCollectiveBoundingBox(intersection);
    const currentScale = intersection[0].presetScale || 1;
    let appliedFactor = Math.max(0.3, Math.min(3, currentScale * factor)) / currentScale;
    if (appliedFactor > 1) {
      const bounds = getSceneDrawingAreaBounds();
      const padding = Math.max(...intersection.map(shape => shape.width || 1.5)) / 2 + 3;
      const halfW = Math.max(...intersection.flatMap(shape => [Math.abs(shape.x1 - box.cx), Math.abs(shape.x2 - box.cx)]));
      const halfH = Math.max(...intersection.flatMap(shape => [Math.abs(shape.y1 - box.cy), Math.abs(shape.y2 - box.cy)]));
      const roomX = Math.min(box.cx - bounds.x, bounds.x + bounds.width - box.cx) - padding;
      const roomY = Math.min(box.cy - bounds.y, bounds.y + bounds.height - box.cy) - padding;
      appliedFactor = Math.max(1, Math.min(appliedFactor, roomX / halfW, roomY / halfH));
    }
    if (Math.abs(appliedFactor - 1) < 0.00001) return;
    intersection.forEach(shape => {
      shape.x1 = box.cx + (shape.x1 - box.cx) * appliedFactor;
      shape.y1 = box.cy + (shape.y1 - box.cy) * appliedFactor;
      shape.x2 = box.cx + (shape.x2 - box.cx) * appliedFactor;
      shape.y2 = box.cy + (shape.y2 - box.cy) * appliedFactor;
      shape.presetScaleX = (shape.presetScaleX || shape.presetScale || 1) * appliedFactor;
      shape.presetScaleY = (shape.presetScaleY || shape.presetScale || 1) * appliedFactor;
      shape.presetScale = currentScale * appliedFactor;
    });
    updateSelectionBadge();
    redrawSceneCanvas(true);
    saveDrawingState();
    return;
  }
  const shape = sceneShapes.find(s => s.id === selectedShapeId);
  if (!isSizeAdjustableShape(shape)) return;

  // Với lề đường, nút +/- chỉ đổi độ cao dải lề; chiều dài hai đầu được giữ nguyên.
  if (shape.type === 'road_edge') {
    shape.sizeScale = Math.max(0.5, Math.min(3, (shape.sizeScale || 1) * factor));
    updateSelectionBadge();
    redrawSceneCanvas(true);
    saveDrawingState();
    return;
  }

  const center = getShapeCenter(shape);
  let appliedFactor = factor;
  if (isInfrastructureAssetShape(shape)) {
    const dx = shape.x2 - shape.x1;
    const dy = shape.y2 - shape.y1;
    const currentLength = Math.max(0.001, Math.hypot(dx, dy));
    const minLength = getMinimumLinearLength(shape);
    const nextLength = Math.max(minLength, Math.min(900, currentLength * factor));
    appliedFactor = nextLength / currentLength;
    const ux = dx / currentLength;
    const uy = dy / currentLength;

    shape.x1 = center.x - ux * nextLength / 2;
    shape.y1 = center.y - uy * nextLength / 2;
    shape.x2 = center.x + ux * nextLength / 2;
    shape.y2 = center.y + uy * nextLength / 2;
  } else if (isVehicleShape(shape)) {
    const dimensions = getVehicleDimensions(shape);
    const nextLength = Math.max(getMinimumVehicleLength(shape), Math.min(900, dimensions.w * factor));
    appliedFactor = nextLength / Math.max(0.001, dimensions.w);
    const angle = shape.angle || 0;
    shape.startX = center.x - Math.cos(angle) * nextLength / 2;
    shape.startY = center.y - Math.sin(angle) * nextLength / 2;
    setVehicleLength(shape, nextLength);
    if (isSceneryAssetShape(shape)) {
      shape.objectH = Math.max(12, Math.min(600, dimensions.h * appliedFactor));
    } else if (Number.isFinite(shape.vehicleH)) {
      shape.vehicleH = Math.max(6, Math.min(600, dimensions.h * appliedFactor)); // giữ tỷ lệ đã chỉnh
    }
  } else if (shape.type === 'number_note') {
    const currentRadius = shape.radius || 13;
    const nextRadius = Math.max(8, Math.min(38, currentRadius * factor));
    appliedFactor = nextRadius / currentRadius;
    shape.radius = nextRadius;
  }
  shape.sizeScale = Math.max(0.5, Math.min(3, (shape.sizeScale || 1) * appliedFactor));

  updateSelectionBadge();
  redrawSceneCanvas(true);
  saveDrawingState();
}


function getLinearResizeCursor(shape) {
  if (!isLinearResizableShape(shape)) return 'default';
  const angle = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
  const normalized = ((angle % Math.PI) + Math.PI) % Math.PI;
  if (normalized < Math.PI / 8 || normalized >= 7 * Math.PI / 8) return 'ew-resize';
  if (normalized < 3 * Math.PI / 8) return 'nwse-resize';
  if (normalized < 5 * Math.PI / 8) return 'ns-resize';
  return 'nesw-resize';
}


function resizeLinearShapeFromPointer(shape, original, handle, px, py, snapLength) {
  if (!isLinearResizableShape(shape) || !original) return false;

  const originalLength = Math.hypot(original.x2 - original.x1, original.y2 - original.y1);
  if (originalLength < 0.001) return false;

  let anchorX;
  let anchorY;
  let dirX;
  let dirY;

  if (handle === 'start') {
    anchorX = original.x2;
    anchorY = original.y2;
    dirX = (original.x1 - original.x2) / originalLength;
    dirY = (original.y1 - original.y2) / originalLength;
  } else {
    anchorX = original.x1;
    anchorY = original.y1;
    dirX = (original.x2 - original.x1) / originalLength;
    dirY = (original.y2 - original.y1) / originalLength;
  }

  let nextLength = (px - anchorX) * dirX + (py - anchorY) * dirY;
  const minLength = getMinimumLinearLength(shape);
  nextLength = Math.max(minLength, nextLength);
  if (snapLength) nextLength = Math.max(minLength, Math.round(nextLength / 10) * 10);
  const maxLength = getMaximumLinearResizeLengthInDrawingArea(anchorX, anchorY, dirX, dirY);
  if (Number.isFinite(maxLength) && maxLength >= minLength) {
    nextLength = Math.min(nextLength, maxLength);
  }

  const nextX = anchorX + dirX * nextLength;
  const nextY = anchorY + dirY * nextLength;

  if (handle === 'start') {
    shape.x1 = nextX;
    shape.y1 = nextY;
    shape.x2 = original.x2;
    shape.y2 = original.y2;
  } else {
    shape.x1 = original.x1;
    shape.y1 = original.y1;
    shape.x2 = nextX;
    shape.y2 = nextY;
  }

  return Math.abs(nextLength - originalLength) > 0.25;
}


function applyShapeAngle(shape, newAngle, center) {
  if (!shape) return;
  if (shape.type === 'curve' || shape.type === 'curve_dashed') {
    const curAngle = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
    const delta = newAngle - curAngle;
    const cos = Math.cos(delta);
    const sin = Math.sin(delta);
    const rot = (px, py) => ({
      x: center.x + ((px - center.x) * cos - (py - center.y) * sin),
      y: center.y + ((px - center.x) * sin + (py - center.y) * cos)
    });
    const p1 = rot(shape.x1, shape.y1);
    shape.x1 = p1.x; shape.y1 = p1.y;
    const p2 = rot(shape.x2, shape.y2);
    shape.x2 = p2.x; shape.y2 = p2.y;
    const pc = rot(shape.cx, shape.cy);
    shape.cx = pc.x; shape.cy = pc.y;
  } else if (isVehicleShape(shape)) {
    const w = getVehicleDimensions(shape).w;
    shape.startX = center.x - (w / 2) * Math.cos(newAngle);
    shape.startY = center.y - (w / 2) * Math.sin(newAngle);
    shape.angle = newAngle;
  } else if (isLinearResizableShape(shape)) {
    const dist = Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1) / 2;
    shape.x1 = center.x - dist * Math.cos(newAngle);
    shape.y1 = center.y - dist * Math.sin(newAngle);
    shape.x2 = center.x + dist * Math.cos(newAngle);
    shape.y2 = center.y + dist * Math.sin(newAngle);
  } else if (shape.type === 'text') {
    const dim = getTextDimensions(shape);
    const cos = Math.cos(newAngle);
    const sin = Math.sin(newAngle);
    shape.x = center.x - (dim.w / 2) * cos + (dim.h / 2) * sin;
    shape.y = center.y - (dim.w / 2) * sin - (dim.h / 2) * cos;
    shape.angle = newAngle;
  } else if (shape.type === 'pen' || shape.type === 'eraser' || shape.type === 'tire_track') {
    const currentAngle = shape.angle || 0;
    const delta = newAngle - currentAngle;
    const cos = Math.cos(delta);
    const sin = Math.sin(delta);
    if (Array.isArray(shape.points)) {
      shape.points = shape.points.map(point => ({
        x: center.x + (point.x - center.x) * cos - (point.y - center.y) * sin,
        y: center.y + (point.x - center.x) * sin + (point.y - center.y) * cos
      }));
    }
    if (shape.type === 'tire_track' && shape.curveSource) {
      const rotateCurvePoint = (px, py) => ({
        x: center.x + (px - center.x) * cos - (py - center.y) * sin,
        y: center.y + (px - center.x) * sin + (py - center.y) * cos
      });
      const p1 = rotateCurvePoint(shape.curveSource.x1, shape.curveSource.y1);
      const pc = rotateCurvePoint(shape.curveSource.cx, shape.curveSource.cy);
      const p2 = rotateCurvePoint(shape.curveSource.x2, shape.curveSource.y2);
      shape.curveSource = { x1: p1.x, y1: p1.y, cx: pc.x, cy: pc.y, x2: p2.x, y2: p2.y };
    }
    shape.angle = newAngle;
  } else if (shape.type === 'rect') {
    shape.angle = newAngle;
  }
}


function rotateSelectedShape(deltaDeg) {
  if (!selectedShapeId) return;
  const shape = sceneShapes.find(s => s.id === selectedShapeId);
  if (!shape) return;

  const deltaRad = (deltaDeg * Math.PI) / 180;
  const center = getShapeCenter(shape);

  let curAngle = 0;
  if (isVehicleShape(shape)) {
    curAngle = shape.angle || 0;
  } else if (isLinearResizableShape(shape) || shape.type === 'curve' || shape.type === 'curve_dashed') {
    curAngle = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
  } else if (shape.type === 'rect' || shape.type === 'text' || shape.type === 'pen' || shape.type === 'eraser' || shape.type === 'tire_track') {
    curAngle = shape.angle || 0;
  }

  const newAngle = curAngle + deltaRad;
  applyShapeAngle(shape, newAngle, center);

  updateSelectionBadge();
  redrawSceneCanvas(true);
  saveDrawingState();
}


function getShapeAngleDegrees(shape) {
  if (!shape) return 0;
  let rad = 0;
  if (isVehicleShape(shape)) {
    rad = shape.angle || 0;
  } else if (isLinearResizableShape(shape) || shape.type === 'curve' || shape.type === 'curve_dashed') {
    rad = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
  } else if (shape.type === 'rect' || shape.type === 'text') {
    rad = shape.angle || 0;
  }
  let deg = Math.round((rad * 180) / Math.PI) % 360;
  if (deg < 0) deg += 360;
  return deg;
}


function getShapeBoundingBox(shape) {
  if (!shape) return null;
  if (shape.type === 'curve' || shape.type === 'curve_dashed') {
    const ptsX = [shape.x1, shape.x2, shape.cx];
    const ptsY = [shape.y1, shape.y2, shape.cy];
    const pad = Math.max(16, (shape.width || 2) + 10);
    return {
      minX: Math.min(...ptsX) - pad,
      minY: Math.min(...ptsY) - pad,
      maxX: Math.max(...ptsX) + pad,
      maxY: Math.max(...ptsY) + pad
    };
  }
  if (shape.type === 'pen' || shape.type === 'eraser' || shape.type === 'tire_track') {
    if (!shape.points || shape.points.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    shape.points.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });
    const pad = shape.type === 'tire_track'
      ? Math.max(12, getTireTrackSpacing(shape) / 2 + (shape.width || 2) * 1.5 + 5)
      : Math.max(8, (shape.width || 2));
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  }
  if (isLinearResizableShape(shape)) {
    const pad = getLinearShapeHalfBand(shape) + 8;
    const minX = Math.min(shape.x1, shape.x2) - pad;
    const maxX = Math.max(shape.x1, shape.x2) + pad;
    const minY = Math.min(shape.y1, shape.y2) - pad;
    const maxY = Math.max(shape.y1, shape.y2) + pad;
    return { minX, minY, maxX, maxY };
  }
  if (shape.type === 'rect') {
    const minX = Math.min(shape.x, shape.x + shape.w) - 6;
    const maxX = Math.max(shape.x, shape.x + shape.w) + 6;
    const minY = Math.min(shape.y, shape.y + shape.h) - 6;
    const maxY = Math.max(shape.y, shape.y + shape.h) + 6;
    return { minX, minY, maxX, maxY };
  }
  if (isVehicleShape(shape)) {
    const { w, h } = getVehicleDimensions(shape);
    const cos = Math.cos(shape.angle);
    const sin = Math.sin(shape.angle);
    const corners = [
      { lx: 0, ly: -h/2 },
      { lx: w, ly: -h/2 },
      { lx: w, ly: h/2 },
      { lx: 0, ly: h/2 }
    ];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    corners.forEach(c => {
      const gx = shape.startX + (c.lx * cos - c.ly * sin);
      const gy = shape.startY + (c.lx * sin + c.ly * cos);
      if (gx < minX) minX = gx;
      if (gx > maxX) maxX = gx;
      if (gy < minY) minY = gy;
      if (gy > maxY) maxY = gy;
    });
    return { minX: minX - 8, minY: minY - 8, maxX: maxX + 8, maxY: maxY + 8 };
  }
  if (shape.type === 'xmark') {
    const s = shape.size || 8;
    return { minX: shape.x - s - 8, minY: shape.y - s - 8, maxX: shape.x + s + 8, maxY: shape.y + s + 8 };
  }
  if (shape.type === 'number_note') {
    const r = shape.radius || 13;
    return { minX: shape.x - r - 7, minY: shape.y - r - 7, maxX: shape.x + r + 7, maxY: shape.y + r + 7 };
  }
  if (shape.type === 'text') {
    const dim = getTextDimensions(shape);
    const center = getShapeCenter(shape);
    const angle = shape.angle || 0;
    const hw = dim.w / 2 + 8;
    const hh = dim.h / 2 + 8;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const corners = [
      { lx: -hw, ly: -hh },
      { lx: hw, ly: -hh },
      { lx: hw, ly: hh },
      { lx: -hw, ly: hh }
    ];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    corners.forEach(c => {
      const gx = center.x + (c.lx * cos - c.ly * sin);
      const gy = center.y + (c.lx * sin + c.ly * cos);
      if (gx < minX) minX = gx;
      if (gx > maxX) maxX = gx;
      if (gy < minY) minY = gy;
      if (gy > maxY) maxY = gy;
    });
    return { minX, minY, maxX, maxY };
  }
  return null;
}


function hitTestShapeDetails(shape, px, py) {
  if (!hitTestShape(shape, px, py)) return null;

  const box = getShapeBoundingBox(shape);
  const area = box ? Math.max(100, Math.abs((box.maxX - box.minX) * (box.maxY - box.minY))) : 10000;

  let isEdgeHit = false;
  let isHollowInterior = false;

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
    const hw = Math.abs(shape.w) / 2;
    const hh = Math.abs(shape.h) / 2;
    const edgeThreshold = Math.max(10, (shape.width || 2) + 6);

    const distEdgeX = Math.abs(Math.abs(lx) - hw);
    const distEdgeY = Math.abs(Math.abs(ly) - hh);

    if ((Math.abs(lx) <= hw + edgeThreshold && distEdgeY <= edgeThreshold) ||
        (Math.abs(ly) <= hh + edgeThreshold && distEdgeX <= edgeThreshold)) {
      isEdgeHit = true;
    } else {
      isHollowInterior = true;
    }
  }

  let priority = 6;
  if (isVehicleShape(shape) || shape.type === 'person' || shape.type === 'text' || shape.type === 'xmark' || shape.type === 'number_note' || shape.type === 'crosswalk' || shape.type === 'traffic_light' || shape.type === 'median' || shape.type === 'median_blocks') {
    priority = 10;
  } else if (shape.type === 'line' || shape.type === 'dashed_line' || shape.type === 'road_line' || shape.type === 'road_dashed' || shape.type === 'road_edge' || shape.type === 'curve' || shape.type === 'curve_dashed' || shape.type === 'measure') {
    priority = 7;
  } else if (shape.type === 'rect') {
    priority = isEdgeHit ? 5 : 1;
  }

  return {
    hit: true,
    shape: shape,
    area: area,
    isEdgeHit: isEdgeHit,
    isHollowInterior: isHollowInterior,
    priority: priority
  };
}
