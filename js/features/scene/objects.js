

// ------------------------------------------
// MOUSE & DRAW EVENT HANDLERS
// ------------------------------------------
function completeCurveCreation(endX, endY, endShape) {
  if (!curvePendingStart) return;

  let finalCx, finalCy;
  if (curvePendingStart.shape && endShape && curvePendingStart.shape !== endShape) {
    const inter = findIntersectionOfShapes(curvePendingStart.shape, endShape);
    if (inter && Math.hypot(inter.x - curvePendingStart.x, inter.y - curvePendingStart.y) < 500 && Math.hypot(inter.x - endX, inter.y - endY) < 500) {
      finalCx = inter.x;
      finalCy = inter.y;
    }
  }
  if (finalCx === undefined) {
    const mx = (curvePendingStart.x + endX) / 2;
    const my = (curvePendingStart.y + endY) / 2;
    const dist = Math.hypot(endX - curvePendingStart.x, endY - curvePendingStart.y);
    const nx = -(endY - curvePendingStart.y) / (dist || 1);
    const ny = (endX - curvePendingStart.x) / (dist || 1);
    finalCx = mx + nx * (dist * 0.28);
    finalCy = my + ny * (dist * 0.28);
  }

  const color = document.getElementById('drawColorPicker').value;
  const width = parseFloat(document.getElementById('drawStrokeWidth').value);

  const newShape = {
    id: genShapeId(),
    type: currentDrawTool,
    x1: curvePendingStart.x,
    y1: curvePendingStart.y,
    x2: endX,
    y2: endY,
    cx: finalCx,
    cy: finalCy,
    color: color,
    width: width,
    hasArrow: false
  };

  sceneShapes.push(newShape);
  selectedShapeId = newShape.id;
  curvePendingStart = null;
  saveDrawingState();
  setActiveDrawTool('select');
  updateSelectionBadge();
  redrawSceneCanvas(true);
  if (typeof showToast === 'function') {
    showToast('Đã tạo đường cong! Kéo điểm tròn vàng ở giữa để chỉnh độ cong', 'success');
  }
}


function getTireTrackCurveControl(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const nx = -dy / distance;
  const ny = dx / distance;
  const bend = Math.max(18, Math.min(105, distance * 0.24));
  return { x: mx + nx * bend, y: my + ny * bend };
}


function sampleTireTrackCurvePoints(x1, y1, cx, cy, x2, y2) {
  const approximateLength = Math.hypot(cx - x1, cy - y1) + Math.hypot(x2 - cx, y2 - cy);
  const segments = Math.max(18, Math.min(90, Math.ceil(approximateLength / 7)));
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    points.push({
      x: mt * mt * x1 + 2 * mt * t * cx + t * t * x2,
      y: mt * mt * y1 + 2 * mt * t * cy + t * t * y2
    });
  }
  return points;
}


function isCurvedTireTrack(shape) {
  const source = shape && shape.curveSource;
  return !!(shape && shape.type === 'tire_track' && source &&
    Number.isFinite(source.x1) && Number.isFinite(source.y1) &&
    Number.isFinite(source.cx) && Number.isFinite(source.cy) &&
    Number.isFinite(source.x2) && Number.isFinite(source.y2));
}


function syncCurvedTireTrackPoints(shape) {
  if (!isCurvedTireTrack(shape)) return;
  const source = shape.curveSource;
  shape.points = sampleTireTrackCurvePoints(
    source.x1,
    source.y1,
    source.cx,
    source.cy,
    source.x2,
    source.y2
  );
}


function makeCurvedTireTrackShape(x1, y1, x2, y2, color, width) {
  const control = getTireTrackCurveControl(x1, y1, x2, y2);
  return {
    id: genShapeId(),
    type: 'tire_track',
    points: sampleTireTrackCurvePoints(x1, y1, control.x, control.y, x2, y2),
    color: color,
    width: width,
    trackSpacing: Math.max(10, width * 5),
    curveSource: {
      x1: x1,
      y1: y1,
      cx: control.x,
      cy: control.y,
      x2: x2,
      y2: y2
    }
  };
}


function completeTireTrackCurveCreation(endX, endY) {
  if (!tireTrackPendingStart) return;
  const color = document.getElementById('drawColorPicker').value;
  const width = parseFloat(document.getElementById('drawStrokeWidth').value);
  const newShape = makeCurvedTireTrackShape(
    tireTrackPendingStart.x,
    tireTrackPendingStart.y,
    endX,
    endY,
    color,
    width
  );
  sceneShapes.push(newShape);
  setSelectedShapes([newShape.id]);
  tireTrackPendingStart = null;
  saveDrawingState();
  setActiveDrawTool('select');
  updateSelectionBadge();
  redrawSceneCanvas(true);
  if (typeof showToast === 'function') {
    showToast('Đã tạo vệt bánh xe cong từ điểm đầu đến điểm cuối', 'success');
  }
}


function getEraserBoxSize() {
  const widthInput = document.getElementById('drawStrokeWidth');
  const strokeWidth = widthInput ? parseFloat(widthInput.value) : 2;
  return Math.max(20, Math.min(56, 18 + (Number.isFinite(strokeWidth) ? strokeWidth : 2) * 3.5));
}


function findEraserTargetAt(px, py) {
  const half = getEraserBoxSize() / 2;
  const reach = half * 0.72;
  const samples = [
    { x: px, y: py },
    { x: px - reach, y: py }, { x: px + reach, y: py },
    { x: px, y: py - reach }, { x: px, y: py + reach },
    { x: px - reach, y: py - reach }, { x: px + reach, y: py - reach },
    { x: px - reach, y: py + reach }, { x: px + reach, y: py + reach }
  ];
  const candidates = new Map();

  for (let i = sceneShapes.length - 1; i >= 0; i--) {
    const shape = sceneShapes[i];
    for (let j = 0; j < samples.length; j++) {
      const sample = samples[j];
      const info = hitTestShapeDetails(shape, sample.x, sample.y);
      if (!info) continue;
      const distance = Math.hypot(sample.x - px, sample.y - py);
      const previous = candidates.get(shape.id);
      if (!previous || distance < previous.distance) {
        candidates.set(shape.id, { shape, index: i, distance, priority: info.priority, area: info.area });
      }
    }
  }

  if (candidates.size === 0) return null;
  return Array.from(candidates.values()).sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (a.distance !== b.distance) return a.distance - b.distance;
    if (Math.abs(a.area - b.area) > 20) return a.area - b.area;
    return b.index - a.index;
  })[0].shape;
}


function drawEraserPreview(ctx) {
  if (!ctx || currentDrawTool !== 'eraser' || !eraserHoverPos) return;
  const size = getEraserBoxSize();
  const half = size / 2;
  const target = eraserTargetShapeId ? sceneShapes.find(shape => shape.id === eraserTargetShapeId) : null;

  if (target) {
    const targetBounds = getShapeBoundingBox(target);
    ctx.save();
    ctx.globalAlpha = 0.72;
    const highlightShape = { ...target, color: '#ef4444', width: Math.max(2.5, (target.width || 2) + 1.8) };
    renderShape(ctx, highlightShape);
    if (targetBounds) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(
        targetBounds.minX - 3,
        targetBounds.minY - 3,
        targetBounds.maxX - targetBounds.minX + 6,
        targetBounds.maxY - targetBounds.minY + 6
      );
    }
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = target ? 'rgba(239, 68, 68, 0.13)' : 'rgba(15, 23, 42, 0.07)';
  ctx.strokeStyle = target ? '#ef4444' : '#64748b';
  ctx.lineWidth = 1.8;
  ctx.setLineDash([]);
  ctx.fillRect(eraserHoverPos.x - half, eraserHoverPos.y - half, size, size);
  ctx.strokeRect(eraserHoverPos.x - half, eraserHoverPos.y - half, size, size);
  ctx.beginPath();
  ctx.moveTo(eraserHoverPos.x - 4, eraserHoverPos.y);
  ctx.lineTo(eraserHoverPos.x + 4, eraserHoverPos.y);
  ctx.moveTo(eraserHoverPos.x, eraserHoverPos.y - 4);
  ctx.lineTo(eraserHoverPos.x, eraserHoverPos.y + 4);
  ctx.stroke();
  ctx.restore();
}


function eraseShapeAtPointer(px, py) {
  const target = findEraserTargetAt(px, py);
  if (!target) {
    eraserTargetShapeId = null;
    redrawSceneCanvas(false);
    return false;
  }

  const erasedName = getShapeDisplayName(target);
  sceneShapes = sceneShapes.filter(shape => shape.id !== target.id);
  if (selectedShapeIds.includes(target.id)) clearSelection();
  normalizeSceneNoteNumbers();
  eraserTargetShapeId = null;
  saveDrawingState();
  redrawSceneCanvas(false);
  if (typeof showToast === 'function') {
    showToast(`Đã tẩy: ${erasedName}`, 'info');
  }
  return true;
}


function onCanvasMouseDown(e) {
  if (typeof closeAllToolSubmenus === 'function') closeAllToolSubmenus();
  if (typeof isStrokePopoverOpen !== 'undefined' && isStrokePopoverOpen) closeStrokeWidthPopover();

  if (isSpacePressed || e.button === 1) {
    isPanning = true;
    panStartX = e.clientX - scenePanX;
    panStartY = e.clientY - scenePanY;
    const vp = document.getElementById('sceneCanvasViewport');
    if (vp) vp.style.cursor = 'grabbing';
    e.preventDefault();
    return;
  }

  // Only the primary pointer draws/selects. A right click previously entered the
  // drawing flow and could leave a preview anchored at an unexpected position.
  if (typeof e.button === 'number' && e.button !== 0) return;

  activeSnapGuides = [];
  const pos = getMousePos(sceneCanvas, e);
  startX = pos.x;
  startY = pos.y;
  currentX = pos.x;
  currentY = pos.y;
  lastSceneClickPos = { x: pos.x, y: pos.y };
  priorMouseDownSelectedId = selectedShapeId;

  // Không khởi tạo nét/đối tượng trong vùng tiêu đề, chú thích hoặc chữ ký.
  if (currentDrawTool !== 'select' && !isPointInsideSceneDrawingArea(pos.x, pos.y)) {
    e.preventDefault();
    return;
  }

  if (currentDrawTool === 'road_intersection') {
    placeSceneRoadIntersection(pos.x, pos.y);
    e.preventDefault();
    return;
  }

  if (currentDrawTool === 'eraser') {
    eraserHoverPos = { x: pos.x, y: pos.y };
    eraserTargetShapeId = findEraserTargetAt(pos.x, pos.y)?.id || null;
    eraseShapeAtPointer(pos.x, pos.y);
    sceneCanvas.style.cursor = 'none';
    e.preventDefault();
    return;
  }

  if (currentDrawTool === 'select') {
    // 1. Kiểm tra trước các tay nắm xoay / điều chỉnh kích thước của đối tượng đang chọn
    // (kể cả khi tay nắm nằm chớm ra ngoài mép ô sơ đồ để người dùng vẫn bấm/kéo được bình thường).
    if (selectedShapeIds && selectedShapeIds.length > 0) {
      const selShapes = getSelectedShapes();
      if (selShapes.length > 1) {
        const cBox = getCollectiveBoundingBox(selShapes);
        if (cBox && Math.hypot(pos.x - cBox.cx, pos.y - (cBox.y1 - 8 - 26)) <= 16) {
          isRotatingShape = true;
          hasRotatedDuringDrag = false;
          rotationGroupCenter = { x: cBox.cx, y: cBox.cy };
          initialGroupRotationAngle = Math.atan2(pos.y - cBox.cy, pos.x - cBox.cx);
          rotationOriginals = selShapes.map(s => ({ shape: s, data: JSON.parse(JSON.stringify(s)) }));
          sceneCanvas.style.cursor = ROTATE_CURSOR;
          e.preventDefault();
          return;
        }
        const resizeHandle = hitTestSceneRoadIntersectionResizeHandle(pos.x, pos.y);
        if (resizeHandle) {
          const coordinates = selShapes.flatMap(shape => [
            { x: shape.x1, y: shape.y1 }, { x: shape.x2, y: shape.y2 }
          ]);
          roadIntersectionResizeState = {
            handle: resizeHandle, pointer: { x: pos.x, y: pos.y },
            minX: Math.min(...coordinates.map(point => point.x)),
            maxX: Math.max(...coordinates.map(point => point.x)),
            minY: Math.min(...coordinates.map(point => point.y)),
            maxY: Math.max(...coordinates.map(point => point.y)),
            originals: selShapes.map(shape => ({ shape, data: JSON.parse(JSON.stringify(shape)) }))
          };
          hasResizedDuringDrag = false;
          sceneCanvas.style.cursor = getSceneRoadIntersectionResizeCursor(resizeHandle);
          e.preventDefault();
          return;
        }
      } else if (selShapes.length === 1) {
        const activeShape = selShapes[0];
        if (activeShape && hitTestRotationHandle(activeShape, pos.x, pos.y)) {
          isRotatingShape = true;
          hasRotatedDuringDrag = false;
          rotationCenter = getShapeCenter(activeShape);
          initialRotationAngle = Math.atan2(pos.y - rotationCenter.y, pos.x - rotationCenter.x);
          initialShapeAngle = (isLinearResizableShape(activeShape) || activeShape.type === 'curve' || activeShape.type === 'curve_dashed') 
            ? Math.atan2(activeShape.y2 - activeShape.y1, activeShape.x2 - activeShape.x1) 
            : (activeShape.angle || 0);
          originalShapeData = JSON.parse(JSON.stringify(activeShape));
          rotationOriginals = [{ shape: activeShape, data: originalShapeData }];
          rotationGroupCenter = rotationCenter;
          initialGroupRotationAngle = initialRotationAngle;
          sceneCanvas.style.cursor = ROTATE_CURSOR;
          return;
        }
      }
    }

    // Resize straight objects from either endpoint while preserving their angle
    if (selectedShapeIds && selectedShapeIds.length === 1) {
      const activeShape = sceneShapes.find(s => s.id === selectedShapeIds[0]);
      if (hitTestNumberNoteResizeHandle(activeShape, pos.x, pos.y)) {
        isResizingNumberNote = true;
        hasResizedDuringDrag = false;
        resizeOriginalShapeData = JSON.parse(JSON.stringify(activeShape));
        sceneCanvas.style.cursor = 'nwse-resize';
        e.preventDefault();
        return;
      }
      const vehicleHandle = hitTestVehicleResizeHandle(activeShape, pos.x, pos.y);
      if (vehicleHandle) {
        isResizingVehicle = true;
        vehicleResizeHandle = vehicleHandle;
        hasResizedDuringDrag = false;
        resizeOriginalShapeData = JSON.parse(JSON.stringify(activeShape));
        sceneCanvas.style.cursor = getVehicleResizeCursor(vehicleHandle, activeShape);
        e.preventDefault();
        return;
      }
      const resizeHandle = hitTestLinearResizeHandle(activeShape, pos.x, pos.y);
      if (resizeHandle) {
        isResizingLinearStart = resizeHandle === 'start';
        isResizingLinearEnd = resizeHandle === 'end';
        hasResizedDuringDrag = false;
        resizeOriginalShapeData = JSON.parse(JSON.stringify(activeShape));
        sceneCanvas.style.cursor = getLinearResizeCursor(activeShape);
        e.preventDefault();
        return;
      }
      const bandHandle = hitTestInfraBandResizeHandle(activeShape, pos.x, pos.y);
      if (bandHandle) {
        isResizingInfraBand = true;
        infraResizeSide = bandHandle;
        hasResizedDuringDrag = false;
        resizeOriginalShapeData = JSON.parse(JSON.stringify(activeShape));
        sceneCanvas.style.cursor = getInfraBandResizeCursor(activeShape);
        e.preventDefault();
        return;
      }
    }

    // Check Curve handles (Curvature control point and endpoints) for single selected curve
    if (selectedShapeIds && selectedShapeIds.length === 1) {
      const activeShape = sceneShapes.find(s => s.id === selectedShapeIds[0]);
      const curveHandleSource = isCurvedTireTrack(activeShape) ? activeShape.curveSource : activeShape;
      const hasCurveHandles = activeShape && (activeShape.type === 'curve' || activeShape.type === 'curve_dashed' || isCurvedTireTrack(activeShape));
      if (hasCurveHandles && curveHandleSource) {
        if (Math.hypot(pos.x - curveHandleSource.cx, pos.y - curveHandleSource.cy) <= 15) {
          isDraggingCurveControl = true;
          return;
        }
        if (Math.hypot(pos.x - curveHandleSource.x1, pos.y - curveHandleSource.y1) <= 14) {
          isDraggingCurveStart = true;
          return;
        }
        if (Math.hypot(pos.x - curveHandleSource.x2, pos.y - curveHandleSource.y2) <= 14) {
          isDraggingCurveEnd = true;
          return;
        }
      }
    }

    const templateHotspot = getSceneTemplateHotspot(pos.x, pos.y);
    if (templateHotspot) {
      openSceneTemplateMetaEditor(templateHotspot);
      e.preventDefault();
      return;
    }

    // Phần ngoài ô sơ đồ chỉ dành cho biểu mẫu; không chọn các đoạn đối tượng đã bị ẩn.
    if (!isPointInsideSceneDrawingArea(pos.x, pos.y)) {
      clearSelection();
      updateSelectionBadge();
      redrawSceneCanvas(false);
      e.preventDefault();
      return;
    }

    // 2. Collect ALL hit candidates at this click point
    const candidates = [];
    for (let i = sceneShapes.length - 1; i >= 0; i--) {
      const shape = sceneShapes[i];
      const info = hitTestShapeDetails(shape, pos.x, pos.y);
      if (info) {
        candidates.push({ shape, index: i, ...info });
      }
    }
    lastHitCandidates = candidates;

    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        if (Math.abs(a.area - b.area) > 20) return a.area - b.area;
        return b.index - a.index;
      });

      let chosenCandidate = candidates[0];
      const isMultiKey = e.ctrlKey || e.metaKey;

      if (isMultiKey) {
        // Multi-select toggle: hold Ctrl to select/unselect
        const hitShape = chosenCandidate.shape;
        if (hitShape.groupId) {
          // Toggle entire group
          const grpShapes = sceneShapes.filter(s => s.groupId === hitShape.groupId);
          const grpIds = grpShapes.map(s => s.id);
          const allSelected = grpIds.every(id => selectedShapeIds.includes(id));
          if (allSelected) {
            setSelectedShapes(selectedShapeIds.filter(id => !grpIds.includes(id)));
          } else {
            const next = new Set([...selectedShapeIds, ...grpIds]);
            setSelectedShapes(Array.from(next));
          }
        } else {
          // Toggle individual shape
          if (selectedShapeIds.includes(hitShape.id)) {
            setSelectedShapes(selectedShapeIds.filter(id => id !== hitShape.id));
          } else {
            setSelectedShapes([...selectedShapeIds, hitShape.id]);
          }
        }
      } else {
        // Normal click
        const hitShape = chosenCandidate.shape;
        if (selectedShapeIds.includes(hitShape.id)) {
          // Clicked on an already-selected shape: keep selection to enable collective dragging!
        } else {
          if (hitShape.groupId) {
            // Shape belongs to a group: auto-select all shapes in that group
            const grpShapes = sceneShapes.filter(s => s.groupId === hitShape.groupId);
            setSelectedShapes(grpShapes.map(s => s.id));
          } else {
            setSelectedShapes([hitShape.id]);
          }
        }
      }

      // Initialize dragging for all currently selected shapes
      const selShapes = getSelectedShapes();
      if (selShapes.length > 0) {
        isDraggingShape = true;
        hasMovedDuringDrag = false;
        dragStartX = pos.x;
        dragStartY = pos.y;
        dragOriginals = selShapes.map(s => ({ shape: s, data: JSON.parse(JSON.stringify(s)) }));
        if (selShapes.length === 1) {
          originalShapeData = JSON.parse(JSON.stringify(selShapes[0]));
          syncStrokeUI(selShapes[0].width, selShapes[0].color);
        }
        updateSelectionBadge();
        redrawSceneCanvas(true);
      }
    } else {
      // Clicked on empty canvas
      if (!e.ctrlKey && !e.metaKey) {
        clearSelection();
        isDraggingShape = false;
        dragOriginals = [];
        updateSelectionBadge();
        redrawSceneCanvas(false);
      }
    }
    return;
  }

  if (currentDrawTool === 'text') {
    openSceneTextModal(null, pos.x, pos.y);
    return;
  }

  if (currentDrawTool === 'number_note') {
    openSceneNumberNoteModal(null, pos.x, pos.y);
    return;
  }

  // Vệt bánh xe cong: nhấp lần 1 chọn điểm đầu, lần 2 chọn điểm cuối.
  if (currentDrawTool === 'tire_track') {
    const snap = findSnapPoint(pos);
    const point = { x: snap ? snap.x : pos.x, y: snap ? snap.y : pos.y };
    if (!tireTrackPendingStart) {
      tireTrackPendingStart = point;
      redrawSceneCanvas(false);
      if (typeof showToast === 'function') {
        showToast('Đã chọn điểm đầu vệt bánh xe. Hãy nhấp điểm cuối', 'info');
      }
    } else if (Math.hypot(point.x - tireTrackPendingStart.x, point.y - tireTrackPendingStart.y) > 8) {
      completeTireTrackCurveCreation(point.x, point.y);
    }
    e.preventDefault();
    return;
  }

  // Curve tool: 2-click gesture (Click 1: Start Point, Click 2: End Point)
  if (currentDrawTool === 'curve' || currentDrawTool === 'curve_dashed') {
    const snap = findSnapPoint(pos);
    if (!curvePendingStart) {
      curvePendingStart = {
        x: snap ? snap.x : pos.x,
        y: snap ? snap.y : pos.y,
        shape: snap ? snap.shape : null
      };
      if (typeof showToast === 'function') {
        showToast('Đã chọn điểm đầu. Hãy click vào điểm kết thúc (đầu đường 2)', 'info');
      }
      redrawSceneCanvas(false);
      return;
    } else {
      const endX = snap ? snap.x : pos.x;
      const endY = snap ? snap.y : pos.y;
      if (Math.hypot(endX - curvePendingStart.x, endY - curvePendingStart.y) > 5) {
        completeCurveCreation(endX, endY, snap ? snap.shape : null);
      }
      return;
    }
  }

  const color = currentDrawTool === 'eraser' ? '#ffffff' : document.getElementById('drawColorPicker').value;
  const width = parseFloat(document.getElementById('drawStrokeWidth').value);

  isDrawing = true;
  if (currentDrawTool === 'pen' || currentDrawTool === 'eraser' || currentDrawTool === 'tire_track') {
    currentTempShape = {
      id: genShapeId(),
      type: currentDrawTool,
      points: [{ x: pos.x, y: pos.y }],
      color: color,
      width: width,
      trackSpacing: currentDrawTool === 'tire_track' ? Math.max(10, width * 5) : undefined
    };
  } else {
    currentTempShape = null;
  }
}


function onCanvasMouseMove(e) {
  const pos = getMousePos(sceneCanvas, e);

  if (currentDrawTool === 'road_intersection') {
    roadIntersectionHoverPos = isPanning ? null : { x: pos.x, y: pos.y };
    const canPlace = !isPanning && makeSceneRoadIntersection(pos.x, pos.y).length > 0;
    sceneCanvas.style.cursor = isPanning ? 'grabbing' : (canPlace ? 'crosshair' : 'not-allowed');
    redrawSceneCanvas(false);
    return;
  }

  if (currentDrawTool === 'eraser') {
    eraserHoverPos = { x: pos.x, y: pos.y };
    eraserTargetShapeId = findEraserTargetAt(pos.x, pos.y)?.id || null;
    sceneCanvas.style.cursor = 'none';
    redrawSceneCanvas(false);
    return;
  }

  if (currentDrawTool === 'select') {
    if (roadIntersectionResizeState) {
      resizeSceneRoadIntersectionFromPointer(pos.x, pos.y, e.shiftKey);
      sceneCanvas.style.cursor = getSceneRoadIntersectionResizeCursor(roadIntersectionResizeState.handle);
      updateSelectionBadge();
      redrawSceneCanvas(true);
      return;
    }
    // A. Handle Active Rotation Drag
    if (isRotatingShape && selectedShapeIds && selectedShapeIds.length > 0) {
      if (rotationOriginals.length > 1 && rotationGroupCenter) {
        // Collective Group Rotation around group center
        const currentAngle = Math.atan2(pos.y - rotationGroupCenter.y, pos.x - rotationGroupCenter.x);
        let dTheta = currentAngle - initialGroupRotationAngle;
        if (e.shiftKey) {
          const step = Math.PI / 12; // 15 deg
          dTheta = Math.round(dTheta / step) * step;
        }
        for (let i = 0; i < rotationOriginals.length; i++) {
          applyShapeGroupRotation(rotationOriginals[i].shape, rotationOriginals[i].data, rotationGroupCenter.x, rotationGroupCenter.y, dTheta);
        }
        hasRotatedDuringDrag = true;
        sceneCanvas.style.cursor = ROTATE_CURSOR;
        updateSelectionBadge();
        redrawSceneCanvas(true);
        return;
      } else if (rotationOriginals.length === 1 && selectedShapeId) {
        const shape = sceneShapes.find(s => s.id === selectedShapeId);
        if (!shape) return;

        const currentMouseAngle = Math.atan2(pos.y - rotationCenter.y, pos.x - rotationCenter.x);
        let delta = currentMouseAngle - initialRotationAngle;
        let newAngle = initialShapeAngle + delta;

        if (e.shiftKey) {
          const snap = Math.PI / 12; // 15 deg
          newAngle = Math.round(newAngle / snap) * snap;
        } else {
          // Smart Angle Snap to cardinal angles (0, 45, 90, 135, 180, etc.)
          const cardinalAngles = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, -Math.PI, -3 * Math.PI / 4, -Math.PI / 2, -Math.PI / 4];
          let snappedAngle = false;
          for (let i = 0; i < cardinalAngles.length; i++) {
            const ca = cardinalAngles[i];
            if (Math.abs(normalizeAngle(newAngle - ca)) < 0.05) {
              newAngle = ca;
              snappedAngle = true;
              break;
            }
          }

          // Smart Parallel & Perpendicular Snap to other shapes in scene
          if (!snappedAngle && sceneShapes) {
            for (let i = 0; i < sceneShapes.length; i++) {
              const s = sceneShapes[i];
              if (s.id === selectedShapeId) continue;
              let otherAngle = 0;
              if (s.x1 !== undefined && s.y1 !== undefined && s.x2 !== undefined && s.y2 !== undefined) {
                otherAngle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
              } else if (s.angle !== undefined) {
                otherAngle = s.angle;
              } else {
                continue;
              }

              const targets = [otherAngle, otherAngle + Math.PI, otherAngle - Math.PI, otherAngle + Math.PI / 2, otherAngle - Math.PI / 2];
              for (let t = 0; t < targets.length; t++) {
                if (Math.abs(normalizeAngle(newAngle - targets[t])) < 0.05) {
                  newAngle = targets[t];
                  snappedAngle = true;
                  break;
                }
              }
              if (snappedAngle) break;
            }
          }
        }

        applyShapeAngle(shape, newAngle, rotationCenter);
        hasRotatedDuringDrag = true;
        sceneCanvas.style.cursor = ROTATE_CURSOR;
        updateSelectionBadge();
        redrawSceneCanvas(true);
        return;
      }
    }

    // Resize a straight object by dragging one endpoint. The opposite endpoint stays fixed.
    if (isResizingNumberNote && selectedShapeIds && selectedShapeIds.length === 1) {
      const activeShape = sceneShapes.find(s => s.id === selectedShapeIds[0]);
      if (activeShape && resizeOriginalShapeData) {
        const changed = resizeNumberNoteFromPointer(activeShape, resizeOriginalShapeData, pos.x, pos.y);
        hasResizedDuringDrag = hasResizedDuringDrag || changed;
        sceneCanvas.style.cursor = 'nwse-resize';
        updateSelectionBadge();
        redrawSceneCanvas(true);
      }
      return;
    }

    if (isResizingVehicle && selectedShapeIds && selectedShapeIds.length === 1) {
      const activeShape = sceneShapes.find(s => s.id === selectedShapeIds[0]);
      if (activeShape && resizeOriginalShapeData) {
        const changed = resizeVehicleFromPointer(activeShape, resizeOriginalShapeData, vehicleResizeHandle, pos.x, pos.y);
        hasResizedDuringDrag = hasResizedDuringDrag || changed;
        sceneCanvas.style.cursor = getVehicleResizeCursor(vehicleResizeHandle, activeShape);
        updateSelectionBadge();
        redrawSceneCanvas(true);
      }
      return;
    }

    // Resize a straight object by dragging one endpoint. The opposite endpoint stays fixed.
    if ((isResizingLinearStart || isResizingLinearEnd) && selectedShapeIds && selectedShapeIds.length === 1) {
      const activeShape = sceneShapes.find(s => s.id === selectedShapeIds[0]);
      if (activeShape && resizeOriginalShapeData) {
        const handle = isResizingLinearStart ? 'start' : 'end';
        const changed = resizeLinearShapeFromPointer(
          activeShape,
          resizeOriginalShapeData,
          handle,
          pos.x,
          pos.y,
          e.shiftKey
        );
        hasResizedDuringDrag = hasResizedDuringDrag || changed;
        sceneCanvas.style.cursor = getLinearResizeCursor(activeShape);
        updateSelectionBadge();
        redrawSceneCanvas(true);
      }
      return;
    }

    if (isResizingInfraBand && selectedShapeIds && selectedShapeIds.length === 1) {
      const activeShape = sceneShapes.find(s => s.id === selectedShapeIds[0]);
      if (activeShape && resizeOriginalShapeData) {
        const changed = resizeInfrastructureBandFromPointer(activeShape, resizeOriginalShapeData, pos.x, pos.y);
        hasResizedDuringDrag = hasResizedDuringDrag || changed;
        sceneCanvas.style.cursor = getInfraBandResizeCursor(activeShape);
        updateSelectionBadge();
        redrawSceneCanvas(true);
      }
      return;
    }

    // Handle curve handles dragging for single selected curve
    if (selectedShapeIds && selectedShapeIds.length === 1) {
      const activeShape = sceneShapes.find(s => s.id === selectedShapeIds[0]);
      const isTrackCurve = isCurvedTireTrack(activeShape);
      if (activeShape && (activeShape.type === 'curve' || activeShape.type === 'curve_dashed' || isTrackCurve)) {
        const curveTarget = isTrackCurve ? activeShape.curveSource : activeShape;
        if (isDraggingCurveControl) {
          curveTarget.cx = pos.x;
          curveTarget.cy = pos.y;
          if (isTrackCurve) syncCurvedTireTrackPoints(activeShape);
          redrawSceneCanvas(true);
          return;
        }
        if (isDraggingCurveStart) {
          const snap = findSnapPoint(pos, activeShape.id);
          curveTarget.x1 = snap ? snap.x : pos.x;
          curveTarget.y1 = snap ? snap.y : pos.y;
          if (isTrackCurve) syncCurvedTireTrackPoints(activeShape);
          redrawSceneCanvas(true);
          return;
        }
        if (isDraggingCurveEnd) {
          const snap = findSnapPoint(pos, activeShape.id);
          curveTarget.x2 = snap ? snap.x : pos.x;
          curveTarget.y2 = snap ? snap.y : pos.y;
          if (isTrackCurve) syncCurvedTireTrackPoints(activeShape);
          redrawSceneCanvas(true);
          return;
        }
      }
    }

    // B. Handle Active Position Drag with Smart Magnetic Snapping (Multi & Single)
    if (isDraggingShape && selectedShapeIds && selectedShapeIds.length > 0) {
      if (!dragOriginals || dragOriginals.length === 0) return;

      const rawDx = pos.x - dragStartX;
      const rawDy = pos.y - dragStartY;

      let snapDx = rawDx;
      let snapDy = rawDy;

      // Smart magnetic snapping based on primary dragged shape
      const primary = dragOriginals[0];
      if (primary && primary.shape && primary.data) {
        const snapResult = computeSmartSnapping(primary.shape, primary.data, rawDx, rawDy, e.shiftKey, e.altKey);
        activeSnapGuides = snapResult.guides || [];
        snapDx = snapResult.dx;
        snapDy = snapResult.dy;
      }

      for (let i = 0; i < dragOriginals.length; i++) {
        setShapePositionFromOriginal(dragOriginals[i].shape, dragOriginals[i].data, snapDx, snapDy);
      }
      hasMovedDuringDrag = true;
      redrawSceneCanvas(true);
      return;
    }

    // C. Hover check
    const templateHotspot = getSceneTemplateHotspot(pos.x, pos.y);
    if (templateHotspot) {
      sceneCanvas.style.cursor = 'pointer';
      return;
    }

    if (selectedShapeIds && selectedShapeIds.length > 1) {
      const selShapes = getSelectedShapes();
      const cBox = getCollectiveBoundingBox(selShapes);
      if (cBox && Math.hypot(pos.x - cBox.cx, pos.y - (cBox.y1 - 8 - 26)) <= 16) {
        sceneCanvas.style.cursor = ROTATE_CURSOR;
        return;
      }
      const resizeHandle = hitTestSceneRoadIntersectionResizeHandle(pos.x, pos.y);
      if (resizeHandle) {
        sceneCanvas.style.cursor = getSceneRoadIntersectionResizeCursor(resizeHandle);
        return;
      }
      for (let i = 0; i < selShapes.length; i++) {
        if (hitTestShape(selShapes[i], pos.x, pos.y)) {
          sceneCanvas.style.cursor = 'move';
          return;
        }
      }
    } else if (selectedShapeIds && selectedShapeIds.length === 1) {
      const activeShape = sceneShapes.find(s => s.id === selectedShapeIds[0]);
      if (activeShape) {
        if (hitTestNumberNoteResizeHandle(activeShape, pos.x, pos.y)) {
          sceneCanvas.style.cursor = 'nwse-resize';
          return;
        }
        const vehicleHandle = hitTestVehicleResizeHandle(activeShape, pos.x, pos.y);
        if (vehicleHandle) {
          sceneCanvas.style.cursor = getVehicleResizeCursor(vehicleHandle, activeShape);
          return;
        }
        if (hitTestLinearResizeHandle(activeShape, pos.x, pos.y)) {
          sceneCanvas.style.cursor = getLinearResizeCursor(activeShape);
          return;
        }
        if (hitTestInfraBandResizeHandle(activeShape, pos.x, pos.y)) {
          sceneCanvas.style.cursor = getInfraBandResizeCursor(activeShape);
          return;
        }
        if (hitTestRotationHandle(activeShape, pos.x, pos.y)) {
          sceneCanvas.style.cursor = ROTATE_CURSOR;
          return;
        }
        if (activeShape.type === 'curve' || activeShape.type === 'curve_dashed' || isCurvedTireTrack(activeShape)) {
          const curveHoverSource = isCurvedTireTrack(activeShape) ? activeShape.curveSource : activeShape;
          if (Math.hypot(pos.x - curveHoverSource.cx, pos.y - curveHoverSource.cy) <= 15) {
            sceneCanvas.style.cursor = 'pointer';
            return;
          }
          if (Math.hypot(pos.x - curveHoverSource.x1, pos.y - curveHoverSource.y1) <= 14 || Math.hypot(pos.x - curveHoverSource.x2, pos.y - curveHoverSource.y2) <= 14) {
            sceneCanvas.style.cursor = 'crosshair';
            return;
          }
        }
      }
    }

    let hovering = false;
    for (let i = sceneShapes.length - 1; i >= 0; i--) {
      if (hitTestShape(sceneShapes[i], pos.x, pos.y)) {
        hovering = true;
        break;
      }
    }
    sceneCanvas.style.cursor = hovering ? 'move' : 'default';
    return;
  }

  // Xem trước vệt bánh xe cong giữa điểm đầu và vị trí con trỏ.
  if (currentDrawTool === 'tire_track') {
    const snap = findSnapPoint(pos);
    const hoverX = snap ? snap.x : pos.x;
    const hoverY = snap ? snap.y : pos.y;
    redrawSceneCanvas(false);
    sceneCtx.save();
    applySceneDrawingAreaClip(sceneCtx);

    if (tireTrackPendingStart) {
      const distance = Math.hypot(hoverX - tireTrackPendingStart.x, hoverY - tireTrackPendingStart.y);
      if (distance > 2) {
        const color = document.getElementById('drawColorPicker').value;
        const width = parseFloat(document.getElementById('drawStrokeWidth').value);
        const previewShape = makeCurvedTireTrackShape(
          tireTrackPendingStart.x,
          tireTrackPendingStart.y,
          hoverX,
          hoverY,
          color,
          width
        );
        drawTireTrackShape(sceneCtx, previewShape);
      }

      sceneCtx.save();
      sceneCtx.setLineDash([]);
      sceneCtx.lineWidth = 2;
      sceneCtx.fillStyle = '#10b981';
      sceneCtx.strokeStyle = '#ffffff';
      sceneCtx.beginPath();
      sceneCtx.arc(tireTrackPendingStart.x, tireTrackPendingStart.y, 6, 0, Math.PI * 2);
      sceneCtx.fill();
      sceneCtx.stroke();
      sceneCtx.fillStyle = '#d8b46d';
      sceneCtx.beginPath();
      sceneCtx.arc(hoverX, hoverY, 5, 0, Math.PI * 2);
      sceneCtx.fill();
      sceneCtx.stroke();
      sceneCtx.restore();
    } else if (snap) {
      sceneCtx.save();
      sceneCtx.strokeStyle = '#06b6d4';
      sceneCtx.lineWidth = 2;
      sceneCtx.beginPath();
      sceneCtx.arc(hoverX, hoverY, 7, 0, Math.PI * 2);
      sceneCtx.stroke();
      sceneCtx.restore();
    }

    sceneCtx.restore();
    sceneCanvas.style.cursor = 'crosshair';
    return;
  }

  // Curve tool live preview
  if (currentDrawTool === 'curve' || currentDrawTool === 'curve_dashed') {
    const snap = findSnapPoint(pos);
    const hoverX = snap ? snap.x : pos.x;
    const hoverY = snap ? snap.y : pos.y;

    redrawSceneCanvas(false);
    sceneCtx.save();
    applySceneDrawingAreaClip(sceneCtx);

    if (curvePendingStart) {
      let previewCx, previewCy;
      const endShape = snap ? snap.shape : null;
      if (curvePendingStart.shape && endShape && curvePendingStart.shape !== endShape) {
        const inter = findIntersectionOfShapes(curvePendingStart.shape, endShape);
        if (inter && Math.hypot(inter.x - curvePendingStart.x, inter.y - curvePendingStart.y) < 500 && Math.hypot(inter.x - hoverX, inter.y - hoverY) < 500) {
          previewCx = inter.x;
          previewCy = inter.y;
        }
      }
      if (previewCx === undefined) {
        const mx = (curvePendingStart.x + hoverX) / 2;
        const my = (curvePendingStart.y + hoverY) / 2;
        const dist = Math.hypot(hoverX - curvePendingStart.x, hoverY - curvePendingStart.y);
        const nx = -(hoverY - curvePendingStart.y) / (dist || 1);
        const ny = (hoverX - curvePendingStart.x) / (dist || 1);
        previewCx = mx + nx * (dist * 0.28);
        previewCy = my + ny * (dist * 0.28);
      }

      const color = document.getElementById('drawColorPicker').value;
      const width = parseFloat(document.getElementById('drawStrokeWidth').value);
      drawCurveLine(sceneCtx, curvePendingStart.x, curvePendingStart.y, previewCx, previewCy, hoverX, hoverY, color, width, currentDrawTool === 'curve_dashed');

      // Start point indicator
      sceneCtx.save();
      sceneCtx.beginPath();
      sceneCtx.fillStyle = '#10b981';
      sceneCtx.arc(curvePendingStart.x, curvePendingStart.y, 6, 0, Math.PI * 2);
      sceneCtx.fill();
      sceneCtx.restore();
    }

    if (snap) {
      sceneCtx.save();
      sceneCtx.beginPath();
      sceneCtx.strokeStyle = '#06b6d4';
      sceneCtx.lineWidth = 2.5;
      sceneCtx.arc(snap.x, snap.y, 8, 0, Math.PI * 2);
      sceneCtx.stroke();
      sceneCtx.beginPath();
      sceneCtx.fillStyle = '#06b6d4';
      sceneCtx.arc(snap.x, snap.y, 3.5, 0, Math.PI * 2);
      sceneCtx.fill();
      sceneCtx.restore();
    }
    sceneCtx.restore();
    sceneCanvas.style.cursor = 'crosshair';
    return;
  }

  if (!isDrawing) return;

  const color = currentDrawTool === 'eraser' ? '#ffffff' : document.getElementById('drawColorPicker').value;
  const width = parseFloat(document.getElementById('drawStrokeWidth').value);

  if (currentDrawTool === 'pen' || currentDrawTool === 'eraser' || currentDrawTool === 'tire_track') {
    if (e.shiftKey && currentDrawTool !== 'eraser') {
      let tx = pos.x;
      let ty = pos.y;
      if (Math.abs(tx - startX) >= Math.abs(ty - startY)) {
        ty = startY;
      } else {
        tx = startX;
      }
      currentTempShape.points = [{ x: startX, y: startY }, { x: tx, y: ty }];
    } else {
      currentTempShape.points.push({ x: pos.x, y: pos.y });
    }
    redrawSceneCanvas(false);
    renderInsideSceneDrawingArea(sceneCtx, () => renderShape(sceneCtx, currentTempShape));
  } else {
    const constrainedPoint = constrainSceneDrawPoint(
      currentDrawTool,
      startX,
      startY,
      pos.x,
      pos.y,
      e.shiftKey
    );
    currentX = constrainedPoint.x;
    currentY = constrainedPoint.y;

    redrawSceneCanvas(false);
    sceneCtx.save();
    applySceneDrawingAreaClip(sceneCtx);

    if (currentDrawTool === 'road_line') {
      drawRoadLine(sceneCtx, startX, startY, currentX, currentY, color, width, false);
    } else if (currentDrawTool === 'road_dashed') {
      drawRoadLine(sceneCtx, startX, startY, currentX, currentY, color, width, true);
    } else if (currentDrawTool === 'road_edge') {
      drawRoadEdge(sceneCtx, startX, startY, currentX, currentY, color, width, 1);
    } else if (currentDrawTool === 'crosswalk') {
      drawCrosswalk(sceneCtx, startX, startY, currentX, currentY, color, width);
    } else if (currentDrawTool === 'traffic_light') {
      drawTrafficLight(sceneCtx, startX, startY, currentX, currentY, color, width);
    } else if (currentDrawTool === 'median') {
      drawMedianStrip(sceneCtx, startX, startY, currentX, currentY, color, width);
    } else if (currentDrawTool === 'median_blocks') {
      drawModularMedianStrip(sceneCtx, startX, startY, currentX, currentY, color, width);
    } else if (currentDrawTool === 'line') {
      drawArrowLine(sceneCtx, startX, startY, currentX, currentY, color, width, false);
    } else if (currentDrawTool === 'dashed_line') {
      drawArrowLine(sceneCtx, startX, startY, currentX, currentY, color, width, true);
    } else if (currentDrawTool === 'rect') {
      sceneCtx.save();
      sceneCtx.strokeStyle = color;
      sceneCtx.lineWidth = width;
      sceneCtx.setLineDash([]);
      sceneCtx.strokeRect(startX, startY, currentX - startX, currentY - startY);
      sceneCtx.restore();
    } else if (currentDrawTool === 'car') {
      const angle = Math.atan2(currentY - startY, currentX - startX);
      const dist = Math.hypot(currentY - startY, currentX - startX);
      const carW = Math.max(30, dist);
      sceneCtx.save();
      sceneCtx.translate(startX, startY);
      sceneCtx.rotate(angle);
      drawTemplateCar(sceneCtx, carW/2, 0, color, width, carW, carW*0.5);
      sceneCtx.restore();
    } else if (currentDrawTool === 'container') {
      const angle = Math.atan2(currentY - startY, currentX - startX);
      const dist = Math.hypot(currentY - startY, currentX - startX);
      const containerW = Math.max(70, dist);
      sceneCtx.save();
      sceneCtx.translate(startX, startY);
      sceneCtx.rotate(angle);
      drawTemplateContainer(sceneCtx, containerW/2, 0, color, width, containerW, containerW*0.3);
      sceneCtx.restore();
    } else if (currentDrawTool === 'bike') {
      const angle = Math.atan2(currentY - startY, currentX - startX);
      const dist = Math.hypot(currentY - startY, currentX - startX);
      const bikeW = Math.max(36, dist);
      sceneCtx.save();
      sceneCtx.translate(startX, startY);
      sceneCtx.rotate(angle);
      drawTemplateBike(sceneCtx, bikeW/2, 0, color, width, bikeW, bikeW*0.42);
      sceneCtx.restore();
    } else if (currentDrawTool === 'fallen_bike') {
      const angle = Math.atan2(currentY - startY, currentX - startX);
      const dist = Math.hypot(currentY - startY, currentX - startX);
      const fallenBikeW = Math.max(42, dist);
      sceneCtx.save();
      sceneCtx.translate(startX, startY);
      sceneCtx.rotate(angle);
      drawFallenBike(sceneCtx, fallenBikeW / 2, 0, color, width, fallenBikeW, fallenBikeW * 0.48);
      sceneCtx.restore();
    } else if (isSceneryAssetType(currentDrawTool)) {
      const angle = Math.atan2(currentY - startY, currentX - startX);
      const dist = Math.hypot(currentY - startY, currentX - startX);
      const objectW = Math.max(getSceneryMinimumLength(currentDrawTool), dist);
      const objectH = objectW * getSceneryAspectRatio(currentDrawTool);
      sceneCtx.save();
      if (isTrafficSignPostType(currentDrawTool)) {
        // Điểm nhấn đầu tiên là chân trụ; biển luôn dựng đứng khi tạo mới.
        sceneCtx.translate(startX - objectW / 2, startY - objectH * 0.43);
      } else {
        sceneCtx.translate(startX, startY);
        sceneCtx.rotate(angle);
      }
      drawSceneryAsset(sceneCtx, currentDrawTool, objectW / 2, 0, color, width, objectW, objectH);
      sceneCtx.restore();
    } else if (currentDrawTool === 'person') {
      drawTemplatePerson(sceneCtx, startX, startY, currentX, currentY, color, width);
    } else if (currentDrawTool === 'measure') {
      drawMeasureLine(sceneCtx, startX, startY, currentX, currentY, color, width);
    } else if (currentDrawTool === 'xmark') {
      const dist = Math.hypot(currentY - startY, currentX - startX);
      drawXMark(sceneCtx, startX, startY, color, width, Math.max(8, dist));
    }
    sceneCtx.restore();
  }
}


function onCanvasMouseUp(e) {
  activeSnapGuides = [];
  const pos = getMousePos(sceneCanvas, e);

  if (currentDrawTool === 'select') {
    if (roadIntersectionResizeState) {
      // Read the actual release position, including releases outside the canvas.
      resizeSceneRoadIntersectionFromPointer(pos.x, pos.y, e.shiftKey);
      roadIntersectionResizeState = null;
      if (hasResizedDuringDrag) saveDrawingState();
      hasResizedDuringDrag = false;
      sceneCanvas.style.cursor = 'default';
      updateSelectionBadge();
      redrawSceneCanvas(true);
      return;
    }
    if (isRotatingShape) {
      isRotatingShape = false;
      rotationOriginals = [];
      rotationGroupCenter = null;
      if (hasRotatedDuringDrag) {
        saveDrawingState();
      }
      sceneCanvas.style.cursor = 'default';
      updateSelectionBadge();
      redrawSceneCanvas(true);
      return;
    }

    if (isResizingLinearStart || isResizingLinearEnd || isResizingInfraBand || isResizingNumberNote || isResizingVehicle) {
      isResizingLinearStart = false;
      isResizingLinearEnd = false;
      isResizingInfraBand = false;
      isResizingNumberNote = false;
      isResizingVehicle = false;
      vehicleResizeHandle = null;
      infraResizeSide = 1;
      resizeOriginalShapeData = null;
      if (hasResizedDuringDrag) saveDrawingState();
      hasResizedDuringDrag = false;
      sceneCanvas.style.cursor = 'default';
      updateSelectionBadge();
      redrawSceneCanvas(true);
      return;
    }

    if (isDraggingCurveControl || isDraggingCurveStart || isDraggingCurveEnd) {
      isDraggingCurveControl = false;
      isDraggingCurveStart = false;
      isDraggingCurveEnd = false;
      saveDrawingState();
      updateSelectionBadge();
      redrawSceneCanvas(true);
      return;
    }

    if (isDraggingShape) {
      isDraggingShape = false;
      dragOriginals = [];
      if (hasMovedDuringDrag) {
        saveDrawingState();
      } else {
        if (!e.ctrlKey && !e.metaKey && lastHitCandidates && lastHitCandidates.length > 1 && priorMouseDownSelectedId === selectedShapeId) {
          const curIndex = lastHitCandidates.findIndex(c => c.shape.id === selectedShapeId);
          if (curIndex !== -1) {
            const nextCandidate = lastHitCandidates[(curIndex + 1) % lastHitCandidates.length];
            setSelectedShapes([nextCandidate.shape.id]);
            syncStrokeUI(nextCandidate.shape.width, nextCandidate.shape.color);
          }
        }
      }
      updateSelectionBadge();
      redrawSceneCanvas(true);
      return;
    }
    return;
  }

  // Curve drag completion support
  if (currentDrawTool === 'curve' || currentDrawTool === 'curve_dashed') {
    if (curvePendingStart) {
      const snap = findSnapPoint(pos);
      const endX = snap ? snap.x : pos.x;
      const endY = snap ? snap.y : pos.y;
      if (Math.hypot(endX - curvePendingStart.x, endY - curvePendingStart.y) > 15) {
        completeCurveCreation(endX, endY, snap ? snap.shape : null);
        return;
      }
      return;
    }
    return;
  }

  if (!isDrawing) return;

  // Commit at the actual release point so the saved shape exactly matches the preview/cursor.
  if (currentDrawTool !== 'pen' && currentDrawTool !== 'eraser' && currentDrawTool !== 'tire_track') {
    const constrainedPoint = constrainSceneDrawPoint(
      currentDrawTool,
      startX,
      startY,
      pos.x,
      pos.y,
      e.shiftKey
    );
    currentX = constrainedPoint.x;
    currentY = constrainedPoint.y;
  } else if (currentTempShape && currentTempShape.points) {
    let releaseX = pos.x;
    let releaseY = pos.y;
    if (e.shiftKey && currentDrawTool !== 'eraser') {
      const constrainedPoint = constrainSceneDrawPoint('line', startX, startY, releaseX, releaseY, true);
      releaseX = constrainedPoint.x;
      releaseY = constrainedPoint.y;
    }
    const lastPoint = currentTempShape.points[currentTempShape.points.length - 1];
    if (!lastPoint || Math.hypot(releaseX - lastPoint.x, releaseY - lastPoint.y) > 0.25) {
      currentTempShape.points.push({ x: releaseX, y: releaseY });
    }
  }

  isDrawing = false;

  const color = currentDrawTool === 'eraser' ? '#ffffff' : document.getElementById('drawColorPicker').value;
  const width = parseFloat(document.getElementById('drawStrokeWidth').value);
  let newShape = null;

  if (currentDrawTool === 'pen' || currentDrawTool === 'eraser' || currentDrawTool === 'tire_track') {
    if (currentTempShape && currentTempShape.points && currentTempShape.points.length > 0) {
      newShape = currentTempShape;
    }
  } else if (currentDrawTool === 'line' || currentDrawTool === 'dashed_line' || currentDrawTool === 'road_line' || currentDrawTool === 'road_dashed' || currentDrawTool === 'road_edge') {
    if (Math.hypot(currentX - startX, currentY - startY) > 3) {
      newShape = {
        id: genShapeId(),
        type: currentDrawTool,
        x1: startX,
        y1: startY,
        x2: currentX,
        y2: currentY,
        color: color,
        width: width
      };
      if (currentDrawTool === 'road_edge') newShape.sizeScale = 1;
    }
  } else if (currentDrawTool === 'crosswalk' || currentDrawTool === 'traffic_light' || currentDrawTool === 'median' || currentDrawTool === 'median_blocks') {
    const rawLength = Math.hypot(currentX - startX, currentY - startY);
    if (rawLength > 3) {
      const angle = Math.atan2(currentY - startY, currentX - startX);
      newShape = {
        id: genShapeId(),
        type: currentDrawTool,
        x1: startX,
        y1: startY,
        x2: startX + Math.cos(angle) * rawLength,
        y2: startY + Math.sin(angle) * rawLength,
        color: color,
        width: width,
        sizeScale: 1
      };
    }
  } else if (currentDrawTool === 'rect') {
    if (Math.abs(currentX - startX) > 3 || Math.abs(currentY - startY) > 3) {
      newShape = {
        id: genShapeId(),
        type: 'rect',
        x: Math.min(startX, currentX),
        y: Math.min(startY, currentY),
        w: Math.abs(currentX - startX),
        h: Math.abs(currentY - startY),
        color: color,
        width: width,
        angle: 0
      };
    }
  } else if (currentDrawTool === 'car') {
    const angle = Math.atan2(currentY - startY, currentX - startX);
    const dist = Math.hypot(currentY - startY, currentX - startX);
    const carW = Math.max(30, dist);
    newShape = {
      id: genShapeId(),
      type: 'car',
      startX: startX,
      startY: startY,
      angle: angle,
      carW: carW,
      color: color,
      width: width,
      sizeScale: 1
    };
  } else if (currentDrawTool === 'container') {
    const angle = Math.atan2(currentY - startY, currentX - startX);
    const dist = Math.hypot(currentY - startY, currentX - startX);
    const containerW = Math.max(70, dist);
    newShape = {
      id: genShapeId(),
      type: 'container',
      startX: startX,
      startY: startY,
      angle: angle,
      containerW: containerW,
      color: color,
      width: width,
      sizeScale: 1
    };
  } else if (currentDrawTool === 'bike') {
    const angle = Math.atan2(currentY - startY, currentX - startX);
    const dist = Math.hypot(currentY - startY, currentX - startX);
    const bikeW = Math.max(36, dist);
    newShape = {
      id: genShapeId(),
      type: 'bike',
      startX: startX,
      startY: startY,
      angle: angle,
      bikeW: bikeW,
      color: color,
      width: width,
      sizeScale: 1
    };
  } else if (currentDrawTool === 'fallen_bike') {
    const angle = Math.atan2(currentY - startY, currentX - startX);
    const dist = Math.hypot(currentY - startY, currentX - startX);
    const fallenBikeW = Math.max(42, dist);
    newShape = {
      id: genShapeId(),
      type: 'fallen_bike',
      startX: startX,
      startY: startY,
      angle: angle,
      fallenBikeW: fallenBikeW,
      color: color,
      width: width,
      sizeScale: 1
    };
  } else if (isSceneryAssetType(currentDrawTool)) {
    const angle = Math.atan2(currentY - startY, currentX - startX);
    const dist = Math.hypot(currentY - startY, currentX - startX);
    const objectW = Math.max(getSceneryMinimumLength(currentDrawTool), dist);
    const isUprightSign = isTrafficSignPostType(currentDrawTool);
    const objectH = objectW * getSceneryAspectRatio(currentDrawTool);
    newShape = {
      id: genShapeId(),
      type: currentDrawTool,
      startX: isUprightSign ? startX - objectW / 2 : startX,
      startY: isUprightSign ? startY - objectH * 0.43 : startY,
      angle: isUprightSign ? 0 : angle,
      objectW: objectW,
      objectH: objectH,
      signOrientationVersion: isUprightSign ? 1 : undefined,
      signKind: currentDrawTool === 'sign_circle_post' ? 'speed_limit' : (currentDrawTool === 'sign_triangle_post' ? 'intersection_non_priority' : undefined),
      speedLimit: currentDrawTool === 'sign_circle_post' ? 50 : undefined,
      color: color,
      width: width,
      sizeScale: 1
    };
  } else if (currentDrawTool === 'person') {
    if (Math.hypot(currentX - startX, currentY - startY) > 3) {
      newShape = {
        id: genShapeId(),
        type: 'person',
        x1: startX,
        y1: startY,
        x2: currentX,
        y2: currentY,
        color: color,
        width: width
      };
    }
  } else if (currentDrawTool === 'measure') {
    if (Math.hypot(currentX - startX, currentY - startY) > 3) {
      newShape = {
        id: genShapeId(),
        type: 'measure',
        x1: startX,
        y1: startY,
        x2: currentX,
        y2: currentY,
        color: color,
        width: width
      };
    }
  } else if (currentDrawTool === 'xmark') {
    const dist = Math.hypot(currentY - startY, currentX - startX);
    newShape = {
      id: genShapeId(),
      type: 'xmark',
      x: startX,
      y: startY,
      size: Math.max(8, dist),
      color: color,
      width: width
    };
  }

  if (newShape) {
    sceneShapes.push(newShape);
    setSelectedShapes([newShape.id]);
    saveDrawingState();
    if (isInfrastructureAssetShape(newShape) || isVehicleShape(newShape)) {
      setActiveDrawTool('select');
      updateSelectionBadge();
      redrawSceneCanvas(true);
      if (isTrafficSignPostType(newShape.type)) {
        setTimeout(function() { openTrafficSignEditor(newShape); }, 0);
      }
      return;
    }
  }

  redrawSceneCanvas(false);
}


// ------------------------------------------
// SHAPE GEOMETRY, ROTATION & HIT TESTING HELPERS
// ------------------------------------------

function getSelectedShapes() {
  if (!selectedShapeIds || selectedShapeIds.length === 0) return [];
  const set = new Set(selectedShapeIds);
  return sceneShapes.filter(s => set.has(s.id));
}


function setSelectedShapes(ids) {
  selectedShapeIds = Array.isArray(ids) ? [...ids] : [];
  selectedShapeId = selectedShapeIds.length > 0 ? selectedShapeIds[0] : null;
}


function clearSelection() {
  selectedShapeIds = [];
  selectedShapeId = null;
}


function isShapeSelected(id) {
  return selectedShapeIds && selectedShapeIds.includes(id);
}


function isSelectionGrouped() {
  const sel = getSelectedShapes();
  if (sel.length < 2) return false;
  const gId = sel[0].groupId;
  if (!gId) return false;
  return sel.every(s => s.groupId === gId);
}


function getCollectiveBoundingBox(shapes) {
  if (!shapes || shapes.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < shapes.length; i++) {
    const b = getShapeBoundingBox(shapes[i]);
    if (b) {
      if (b.minX < minX) minX = b.minX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.maxY > maxY) maxY = b.maxY;
    }
  }
  if (minX === Infinity) return null;
  return {
    minX, minY, maxX, maxY,
    x1: minX, y1: minY, x2: maxX, y2: maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY
  };
}


function getSceneMultiResizeHandles(box) {
  if (!box) return [];
  const left = box.x1 - 8, right = box.x2 + 8;
  const top = box.y1 - 8, bottom = box.y2 + 8;
  return [
    { handle: 'nw', x: left, y: top }, { handle: 'ne', x: right, y: top },
    { handle: 'sw', x: left, y: bottom }, { handle: 'se', x: right, y: bottom },
    { handle: 'n', x: box.cx, y: top }, { handle: 's', x: box.cx, y: bottom },
    { handle: 'w', x: left, y: box.cy }, { handle: 'e', x: right, y: box.cy }
  ];
}


function hitTestSceneRoadIntersectionResizeHandle(x, y) {
  const shapes = getSelectedRoadIntersectionShapes();
  if (!shapes.length || !sceneCanvas) return null;
  const rect = sceneCanvas.getBoundingClientRect();
  const toleranceX = Math.max(5, 8 * SCENE_LOGICAL_WIDTH / Math.max(1, rect.width));
  const toleranceY = Math.max(5, 8 * SCENE_LOGICAL_HEIGHT / Math.max(1, rect.height));
  const point = getSceneMultiResizeHandles(getCollectiveBoundingBox(shapes))
    .find(handle => Math.abs(x - handle.x) <= toleranceX && Math.abs(y - handle.y) <= toleranceY);
  return point ? point.handle : null;
}


function getSceneRoadIntersectionResizeCursor(handle) {
  if (handle === 'n' || handle === 's') return 'ns-resize';
  if (handle === 'e' || handle === 'w') return 'ew-resize';
  return handle === 'ne' || handle === 'sw' ? 'nesw-resize' : 'nwse-resize';
}


function resizeSceneRoadIntersectionFromPointer(x, y, preserveRatio = false) {
  const state = roadIntersectionResizeState;
  if (!state) return;
  const handle = state.handle;
  const adjustX = handle.includes('e') || handle.includes('w');
  const adjustY = handle.includes('n') || handle.includes('s');
  const fromLeft = handle.includes('w'), fromTop = handle.includes('n');
  const oldWidth = state.maxX - state.minX, oldHeight = state.maxY - state.minY;
  if (oldWidth <= 0 || oldHeight <= 0) return;
  const anchorX = fromLeft ? state.maxX : state.minX;
  const anchorY = fromTop ? state.maxY : state.minY;
  const bounds = getSceneDrawingAreaBounds();
  const inkPadding = Math.max(...state.originals.map(item => item.data.width || 1.5)) / 2 + 3;
  const roomX = fromLeft ? anchorX - bounds.x - inkPadding : bounds.x + bounds.width - inkPadding - anchorX;
  const roomY = fromTop ? anchorY - bounds.y - inkPadding : bounds.y + bounds.height - inkPadding - anchorY;
  const maxWidth = Math.max(80, roomX), maxHeight = Math.max(80, roomY);
  let width = adjustX ? Math.max(80, Math.min(maxWidth, oldWidth + (fromLeft ? -1 : 1) * (x - state.pointer.x))) : oldWidth;
  let height = adjustY ? Math.max(80, Math.min(maxHeight, oldHeight + (fromTop ? -1 : 1) * (y - state.pointer.y))) : oldHeight;
  if (preserveRatio && adjustX && adjustY) {
    const sx = width / oldWidth, sy = height / oldHeight;
    const desired = Math.abs(sx - 1) >= Math.abs(sy - 1) ? sx : sy;
    const scale = Math.max(Math.max(80 / oldWidth, 80 / oldHeight),
      Math.min(desired, maxWidth / oldWidth, maxHeight / oldHeight));
    width = oldWidth * scale;
    height = oldHeight * scale;
  }
  const scaleX = width / oldWidth, scaleY = height / oldHeight;
  state.originals.forEach(({ shape, data }) => {
    shape.x1 = adjustX ? anchorX + (data.x1 - anchorX) * scaleX : data.x1;
    shape.x2 = adjustX ? anchorX + (data.x2 - anchorX) * scaleX : data.x2;
    shape.y1 = adjustY ? anchorY + (data.y1 - anchorY) * scaleY : data.y1;
    shape.y2 = adjustY ? anchorY + (data.y2 - anchorY) * scaleY : data.y2;
    shape.presetScaleX = (data.presetScaleX || data.presetScale || 1) * scaleX;
    shape.presetScaleY = (data.presetScaleY || data.presetScale || 1) * scaleY;
    shape.presetScale = (data.presetScale || 1) * Math.sqrt(scaleX * scaleY);
  });
  hasResizedDuringDrag = Math.abs(width - oldWidth) > 0.01 || Math.abs(height - oldHeight) > 0.01;
}


function applyShapeGroupRotation(shape, origData, cx, cy, dTheta) {
  if (!shape || !origData) return;
  const cos = Math.cos(dTheta);
  const sin = Math.sin(dTheta);
  function rotPt(px, py) {
    const dx = px - cx;
    const dy = py - cy;
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos
    };
  }

  if (isLinearResizableShape(shape)) {
    const p1 = rotPt(origData.x1, origData.y1);
    const p2 = rotPt(origData.x2, origData.y2);
    shape.x1 = p1.x; shape.y1 = p1.y;
    shape.x2 = p2.x; shape.y2 = p2.y;
  } else if (shape.type === 'curve' || shape.type === 'curve_dashed') {
    const p1 = rotPt(origData.x1, origData.y1);
    const p2 = rotPt(origData.x2, origData.y2);
    const pc = rotPt(origData.cx, origData.cy);
    shape.x1 = p1.x; shape.y1 = p1.y;
    shape.x2 = p2.x; shape.y2 = p2.y;
    shape.cx = pc.x; shape.cy = pc.y;
  } else if (isVehicleShape(shape)) {
    const p = rotPt(origData.startX, origData.startY);
    shape.startX = p.x; shape.startY = p.y;
    shape.angle = normalizeAngle((origData.angle || 0) + dTheta);
  } else if (shape.type === 'rect') {
    const rcx = origData.x + origData.w / 2;
    const rcy = origData.y + origData.h / 2;
    const nrc = rotPt(rcx, rcy);
    shape.x = nrc.x - shape.w / 2;
    shape.y = nrc.y - shape.h / 2;
    shape.angle = normalizeAngle((origData.angle || 0) + dTheta);
  } else if (shape.type === 'text') {
    const p = rotPt(origData.x, origData.y);
    shape.x = p.x; shape.y = p.y;
    shape.angle = normalizeAngle((origData.angle || 0) + dTheta);
  } else if (shape.type === 'xmark' || shape.type === 'number_note') {
    const p = rotPt(origData.x, origData.y);
    shape.x = p.x; shape.y = p.y;
  } else if (shape.type === 'pen' || shape.type === 'eraser' || shape.type === 'tire_track') {
    if (origData.points) {
      shape.points = origData.points.map(pt => rotPt(pt.x, pt.y));
    }
    if (shape.type === 'tire_track' && origData.curveSource) {
      const p1 = rotPt(origData.curveSource.x1, origData.curveSource.y1);
      const pc = rotPt(origData.curveSource.cx, origData.curveSource.cy);
      const p2 = rotPt(origData.curveSource.x2, origData.curveSource.y2);
      shape.curveSource = { x1: p1.x, y1: p1.y, cx: pc.x, cy: pc.y, x2: p2.x, y2: p2.y };
    }
    shape.angle = normalizeAngle((origData.angle || 0) + dTheta);
  }
}

function findSnapPoint(pos, excludeShapeId = null, threshold = 18) {
  if (!sceneShapes) return null;
  let closest = null;
  let minDist = threshold;

  for (let i = 0; i < sceneShapes.length; i++) {
    const s = sceneShapes[i];
    if (s.id === excludeShapeId) continue;

    const pts = [];
    if (s.x1 !== undefined && s.y1 !== undefined) pts.push({ x: s.x1, y: s.y1, shape: s });
    if (s.x2 !== undefined && s.y2 !== undefined) pts.push({ x: s.x2, y: s.y2, shape: s });
    if (s.type === 'rect') {
      pts.push({ x: s.x, y: s.y, shape: s });
      pts.push({ x: s.x + s.w, y: s.y, shape: s });
      pts.push({ x: s.x, y: s.y + s.h, shape: s });
      pts.push({ x: s.x + s.w, y: s.y + s.h, shape: s });
    }

    for (let j = 0; j < pts.length; j++) {
      const pt = pts[j];
      const d = Math.hypot(pos.x - pt.x, pos.y - pt.y);
      if (d < minDist) {
        minDist = d;
        closest = { x: pt.x, y: pt.y, shape: pt.shape };
      }
    }
  }
  return closest;
}


function findIntersectionOfShapes(s1, s2) {
  if (!s1 || !s2) return null;
  if (s1.x1 === undefined || s1.y1 === undefined || s1.x2 === undefined || s1.y2 === undefined) return null;
  if (s2.x1 === undefined || s2.y1 === undefined || s2.x2 === undefined || s2.y2 === undefined) return null;

  const dx1 = s1.x2 - s1.x1;
  const dy1 = s1.y2 - s1.y1;
  const dx2 = s2.x2 - s2.x1;
  const dy2 = s2.y2 - s2.y1;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-4) return null;

  const t1 = ((s2.x1 - s1.x1) * dy2 - (s2.y1 - s1.y1) * dx2) / denom;
  return {
    x: s1.x1 + t1 * dx1,
    y: s1.y1 + t1 * dy1
  };
}


function drawCurveLine(ctx, x1, y1, cx, cy, x2, y2, color, width, isDashed, hasArrow = false) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  if (isDashed) {
    ctx.setLineDash([12, 8]);
  } else {
    ctx.setLineDash([]);
  }
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cx, cy, x2, y2);
  ctx.stroke();

  if (hasArrow) {
    ctx.setLineDash([]);
    const angle = Math.atan2(y2 - cy, x2 - cx);
    const headlen = Math.max(10, width * 3);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }
  ctx.restore();
}


function drawRoadLine(ctx, x1, y1, x2, y2, color, width, isDashed) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  if (isDashed) {
    ctx.setLineDash([14, 10]);
  } else {
    ctx.setLineDash([]);
  }
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}


function drawRoadEdge(ctx, x1, y1, x2, y2, color, width, sizeScale = 1) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (length < 1) return;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const heightScale = Math.max(0.5, Math.min(3, sizeScale || 1));
  const bandWidth = Math.max(10, Math.min(24, (width || 2) * 3.2 + 6)) * heightScale;
  const halfBand = bandWidth / 2;
  const jointSpacing = Math.max(18, Math.min(34, bandWidth * 2.15));

  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(angle);
  ctx.strokeStyle = color || '#000000';
  ctx.fillStyle = color || '#000000';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);

  // Hai mép song song giúp lề đường khác rõ với vạch kẻ đường thông thường.
  ctx.lineWidth = Math.max(1.2, (width || 2) * 1.05);
  ctx.beginPath();
  ctx.moveTo(0, -halfBand);
  ctx.lineTo(length, -halfBand);
  ctx.moveTo(0, halfBand);
  ctx.lineTo(length, halfBand);
  ctx.stroke();

  // Các mối nối xiên tạo ký hiệu bó vỉa/lề đường trên sơ đồ đen trắng.
  ctx.lineWidth = Math.max(0.8, (width || 2) * 0.58);
  ctx.globalAlpha = 0.82;
  for (let x = jointSpacing * 0.45; x < length; x += jointSpacing) {
    const endX = Math.min(length, x + bandWidth * 0.48);
    ctx.beginPath();
    ctx.moveTo(x, -halfBand);
    ctx.lineTo(endX, halfBand);
    ctx.stroke();
  }

  ctx.restore();
}


function drawCrosswalk(ctx, x1, y1, x2, y2, color, width, sizeScale = 1) {
  const length = Math.max(1, Math.hypot(x2 - x1, y2 - y1));
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const bandWidth = 48 * Math.max(0.5, Math.min(3, sizeScale));
  const stripeCount = Math.max(4, Math.min(14, Math.round(length / 22)));
  const cellWidth = length / stripeCount;
  const stripeWidth = cellWidth * 0.62;

  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, width * 0.75);
  ctx.globalAlpha = 0.94;

  for (let i = 0; i < stripeCount; i++) {
    const sx = i * cellWidth + (cellWidth - stripeWidth) / 2;
    ctx.fillRect(sx, -bandWidth / 2, stripeWidth, bandWidth);
  }

  ctx.globalAlpha = 0.28;
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(0, -bandWidth / 2, length, bandWidth);
  ctx.restore();
}


function drawTrafficLight(ctx, x1, y1, x2, y2, color, width, sizeScale = 1) {
  const length = Math.max(1, Math.hypot(x2 - x1, y2 - y1));
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const housingWidth = 24 * Math.max(0.5, Math.min(3, sizeScale));
  const radius = Math.max(3, Math.min(15, housingWidth * 0.25));

  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(angle);

  ctx.shadowColor = 'rgba(0, 0, 0, .22)';
  ctx.shadowBlur = 5;
  ctx.fillStyle = '#20242c';
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, width);
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(0, -housingWidth / 2, length, housingWidth, housingWidth * 0.22);
  else ctx.rect(0, -housingWidth / 2, length, housingWidth);
  ctx.fill();
  ctx.stroke();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  const lights = [
    { x: length * 0.22, color: '#ef4444' },
    { x: length * 0.50, color: '#f59e0b' },
    { x: length * 0.78, color: '#22c55e' }
  ];
  lights.forEach(light => {
    ctx.beginPath();
    ctx.fillStyle = light.color;
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.lineWidth = 1.2;
    ctx.arc(light.x, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = 'rgba(255,255,255,.42)';
    ctx.arc(light.x - radius * 0.28, -radius * 0.28, radius * 0.23, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}


function drawMedianStrip(ctx, x1, y1, x2, y2, color, width, sizeScale = 1) {
  const length = Math.max(1, Math.hypot(x2 - x1, y2 - y1));
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const bandWidth = 28 * Math.max(0.5, Math.min(3, sizeScale));
  const radius = bandWidth / 2;

  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(angle);

  ctx.fillStyle = 'rgba(148, 163, 184, .2)';
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, width);
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(0, -bandWidth / 2, length, bandWidth, radius);
  else ctx.rect(0, -bandWidth / 2, length, bandWidth);
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(1, -bandWidth / 2 + 1, Math.max(0, length - 2), Math.max(0, bandWidth - 2), Math.max(0, radius - 1));
  else ctx.rect(1, -bandWidth / 2 + 1, Math.max(0, length - 2), Math.max(0, bandWidth - 2));
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.42;
  ctx.lineWidth = Math.max(1, width * 0.7);
  const hatchStep = Math.max(16, bandWidth * 0.72);
  for (let x = -bandWidth; x < length + bandWidth; x += hatchStep) {
    ctx.beginPath();
    ctx.moveTo(x, bandWidth / 2);
    ctx.lineTo(x + bandWidth, -bandWidth / 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}


function drawModularMedianStrip(ctx, x1, y1, x2, y2, color, width, sizeScale = 1) {
  const length = Math.max(1, Math.hypot(x2 - x1, y2 - y1));
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const scale = Math.max(0.5, Math.min(3, sizeScale));
  const bandWidth = 28 * scale;
  const halfBand = bandWidth / 2;
  const preferredBlockLength = 42 * scale;
  const blockCount = Math.max(1, Math.round(length / preferredBlockLength));
  const blockLength = length / blockCount;
  const gap = Math.min(3.2 * scale, blockLength * 0.12);
  const bevel = Math.min(6 * scale, Math.max(1.5, (blockLength - gap) * 0.16));

  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(angle);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (let index = 0; index < blockCount; index++) {
    const start = index * blockLength + gap / 2;
    const end = (index + 1) * blockLength - gap / 2;
    if (end <= start) continue;

    ctx.beginPath();
    ctx.moveTo(start + bevel, -halfBand);
    ctx.lineTo(end - bevel, -halfBand);
    ctx.lineTo(end, -halfBand * 0.55);
    ctx.lineTo(end, halfBand * 0.55);
    ctx.lineTo(end - bevel, halfBand);
    ctx.lineTo(start + bevel, halfBand);
    ctx.lineTo(start, halfBand * 0.55);
    ctx.lineTo(start, -halfBand * 0.55);
    ctx.closePath();
    ctx.fillStyle = index % 2 === 0
      ? 'rgba(148, 163, 184, .24)'
      : 'rgba(100, 116, 139, .17)';
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.35, width);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(start + bevel * 0.65, 0);
    ctx.lineTo(end - bevel * 0.65, 0);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.38;
    ctx.lineWidth = Math.max(1, width * 0.62);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}


function drawRotationHandleIcon(ctx, x, y) {
  ctx.save();
  // 1. Subtle drop shadow for floating handle badge
  ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;

  // 2. Circular background badge
  const R = 11;
  ctx.beginPath();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#c59d45';
  ctx.lineWidth = 1.8;
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 3. Clear shadow before drawing rotation arrows
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const arcR = 5.6;
  const arrowColor = '#92691d';

  // Arc 1: Top Arc (200° to 340°)
  ctx.beginPath();
  ctx.strokeStyle = arrowColor;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.arc(x, y, arcR, (200 * Math.PI) / 180, (340 * Math.PI) / 180, false);
  ctx.stroke();

  // Arrowhead 1 (at 340°)
  const a1 = (340 * Math.PI) / 180;
  const tx1 = x + arcR * Math.cos(a1);
  const ty1 = y + arcR * Math.sin(a1);
  const v1x = -Math.sin(a1), v1y = Math.cos(a1);
  const n1x = -v1y, n1y = v1x;
  const hl = 3.8, hw = 2.6;
  ctx.beginPath();
  ctx.fillStyle = arrowColor;
  ctx.moveTo(tx1, ty1);
  ctx.lineTo(tx1 - hl * v1x + hw * n1x, ty1 - hl * v1y + hw * n1y);
  ctx.lineTo(tx1 - hl * v1x - hw * n1x, ty1 - hl * v1y - hw * n1y);
  ctx.closePath();
  ctx.fill();

  // Arc 2: Bottom Arc (20° to 160°)
  ctx.beginPath();
  ctx.strokeStyle = arrowColor;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.arc(x, y, arcR, (20 * Math.PI) / 180, (160 * Math.PI) / 180, false);
  ctx.stroke();

  // Arrowhead 2 (at 160°)
  const a2 = (160 * Math.PI) / 180;
  const tx2 = x + arcR * Math.cos(a2);
  const ty2 = y + arcR * Math.sin(a2);
  const v2x = -Math.sin(a2), v2y = Math.cos(a2);
  const n2x = -v2y, n2y = v2x;
  ctx.beginPath();
  ctx.fillStyle = arrowColor;
  ctx.moveTo(tx2, ty2);
  ctx.lineTo(tx2 - hl * v2x + hw * n2x, ty2 - hl * v2y + hw * n2y);
  ctx.lineTo(tx2 - hl * v2x - hw * n2x, ty2 - hl * v2y - hw * n2y);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
