// ------------------------------------------
// KÉO GIÃN CẢ NHÓM / NHIỀU ĐỐI TƯỢNG ĐANG CHỌN
// ------------------------------------------
// Trước đây 8 tay nắm của khung nhóm chỉ hoạt động với nhóm "Ngã tư"; nhóm thường (nhà, hàng hoá, xe…)
// vẽ tay nắm ra nhưng bấm vào không làm gì. Module này co giãn mọi loại đối tượng quanh cạnh/góc đối diện:
//  - cạnh trái/phải: chỉ đổi chiều ngang cả nhóm; cạnh trên/dưới: chỉ đổi chiều dọc;
//  - bốn góc: giữ tỷ lệ (giữ Shift để kéo tự do).
// Mỗi đối tượng luôn được tính lại từ dữ liệu gốc lúc bắt đầu kéo (không cộng dồn sai số).

const SCENE_GROUP_MIN_EXTENT = 20;

function sceneGroupClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}


// Hệ số co giãn theo trục cục bộ của vật đã xoay một góc `angle` khi cả nhóm bị kéo theo (sx, sy) trên trục màn hình.
function getSceneGroupLocalFactors(angle, sx, sy) {
  const c = Math.cos(angle || 0), s = Math.sin(angle || 0);
  return {
    fx: Math.hypot(sx * c, sy * s),
    fy: Math.hypot(sx * s, sy * c)
  };
}


function scaleSceneShapeAbout(shape, orig, ax, ay, sx, sy) {
  if (!shape || !orig) return;
  const px = x => ax + (x - ax) * sx;
  const py = y => ay + (y - ay) * sy;
  const uni = Math.sqrt(Math.abs(sx * sy)) || 1;

  if (orig.type === 'curve' || orig.type === 'curve_dashed') {
    shape.x1 = px(orig.x1); shape.y1 = py(orig.y1);
    shape.x2 = px(orig.x2); shape.y2 = py(orig.y2);
    shape.cx = px(orig.cx); shape.cy = py(orig.cy);
    return;
  }

  if (isLinearResizableShape(orig)) {
    shape.x1 = px(orig.x1); shape.y1 = py(orig.y1);
    shape.x2 = px(orig.x2); shape.y2 = py(orig.y2);
    if (orig.type === 'crosswalk' || orig.type === 'traffic_light' || orig.type === 'median' ||
        orig.type === 'median_blocks' || orig.type === 'road_edge') {
      shape.sizeScale = sceneGroupClamp((orig.sizeScale || 1) * uni, 0.5, 3);
    } else if (orig.type === 'direction_label' && Number.isFinite(Number(orig.fontSize))) {
      const base = typeof getSceneDirectionFontSize === 'function' ? getSceneDirectionFontSize(orig) : Number(orig.fontSize);
      shape.fontSize = sceneGroupClamp(base * uni, 8, 48);
    }
    return;
  }

  if (orig.type === 'pen' || orig.type === 'eraser' || orig.type === 'tire_track') {
    if (Array.isArray(orig.points)) shape.points = orig.points.map(p => ({ ...p, x: px(p.x), y: py(p.y) }));
    if (orig.type === 'tire_track' && orig.curveSource) {
      const c = orig.curveSource;
      shape.curveSource = { ...c, x1: px(c.x1), y1: py(c.y1), cx: px(c.cx), cy: py(c.cy), x2: px(c.x2), y2: py(c.y2) };
    }
    return;
  }

  if (orig.type === 'rect') {
    const angle = orig.angle || 0;
    const { fx, fy } = getSceneGroupLocalFactors(angle, sx, sy);
    const cx = px(orig.x + orig.w / 2), cy = py(orig.y + orig.h / 2);
    shape.w = orig.w * fx;
    shape.h = orig.h * fy;
    shape.x = cx - shape.w / 2;
    shape.y = cy - shape.h / 2;
    return;
  }

  if (orig.type === 'xmark') {
    shape.x = px(orig.x); shape.y = py(orig.y);
    shape.size = sceneGroupClamp((orig.size || 8) * uni, 4, 60);
    return;
  }

  if (orig.type === 'number_note') {
    shape.x = px(orig.x); shape.y = py(orig.y);
    const radius = sceneGroupClamp((orig.radius || 13) * uni, 8, 38);
    shape.radius = radius;
    shape.sizeScale = radius / 13;
    return;
  }

  if (orig.type === 'text') {
    const c0 = getShapeCenter(orig);
    shape.fontSize = sceneGroupClamp((orig.fontSize || orig.size || 16) * uni, 6, 120);
    if (orig.size && !orig.fontSize) shape.size = shape.fontSize;
    shape.x = orig.x; shape.y = orig.y;
    const c1 = getShapeCenter(shape);
    // Giữ TÂM chữ đúng vị trí đã co giãn (điểm neo x,y của chữ không nằm ở tâm).
    shape.x += px(c0.x) - c1.x;
    shape.y += py(c0.y) - c1.y;
    return;
  }

  if (isVehicleShape(orig)) {
    const angle = orig.angle || 0;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const { w, h } = getVehicleDimensions(orig);
    const c0 = getShapeCenter(orig);
    const { fx, fy } = getSceneGroupLocalFactors(angle, sx, sy);
    const isScenery = isSceneryAssetShape(orig);
    const nextW = sceneGroupClamp(w * fx, getMinimumVehicleLength(orig), 900);
    const minH = isScenery
      ? getSceneryResizeMinHeight(orig.type)
      : Math.max(6, getMinimumVehicleLength(orig) * getDefaultVehicleAspect(orig) * 0.5);
    const nextH = sceneGroupClamp(h * fy, minH, 600);
    const cx = px(c0.x), cy = py(c0.y);
    shape.startX = cx - (nextW / 2) * cos;
    shape.startY = cy - (nextW / 2) * sin;
    if (isScenery) {
      shape.objectW = nextW;
      shape.objectH = nextH;
      shape.sizeScale = sceneGroupClamp(nextW / Math.max(0.001, getSceneryMinimumLength(orig.type)), 0.5, 3);
    } else {
      setVehicleLength(shape, nextW);
      shape.vehicleH = nextH;
      shape.sizeScale = sceneGroupClamp((orig.sizeScale || 1) * (nextW / Math.max(0.001, w)), 0.5, 3);
    }
  }
}


function getSceneGroupResizeCursor(handle) {
  if (handle === 'n' || handle === 's') return 'ns-resize';
  if (handle === 'e' || handle === 'w') return 'ew-resize';
  return handle === 'ne' || handle === 'sw' ? 'nesw-resize' : 'nwse-resize';
}


// Bấm trúng tay nắm nào của khung nhóm (không tính nhóm Ngã tư — nhóm đó có cơ chế riêng).
function hitTestSceneGroupResizeHandle(x, y) {
  if (!sceneCanvas || typeof getSceneMultiResizeHandles !== 'function') return null;
  const shapes = getSelectedShapes();
  if (shapes.length < 2) return null;
  const box = getCollectiveBoundingBox(shapes);
  if (!box) return null;
  const rect = sceneCanvas.getBoundingClientRect();
  const tx = Math.max(6, 9 * SCENE_LOGICAL_WIDTH / Math.max(1, rect.width));
  const ty = Math.max(6, 9 * SCENE_LOGICAL_HEIGHT / Math.max(1, rect.height));
  const hit = getSceneMultiResizeHandles(box)
    .find(h => Math.abs(x - h.x) <= tx && Math.abs(y - h.y) <= ty);
  return hit ? hit.handle : null;
}


function beginSceneGroupResize(handle, pos) {
  const shapes = getSelectedShapes();
  const box = getCollectiveBoundingBox(shapes);
  if (!box || !handle) return null;
  return {
    handle,
    pointer: { x: pos.x, y: pos.y },
    box,
    originals: shapes.map(shape => ({ shape, data: JSON.parse(JSON.stringify(shape)) }))
  };
}


// Tính hệ số co giãn (sx, sy), điểm neo (cạnh/góc đối diện) và giới hạn từ vị trí chuột.
function computeSceneGroupResize(state, x, y, freeCorner) {
  const { handle, box, pointer } = state;
  const oldW = Math.max(1, box.maxX - box.minX);
  const oldH = Math.max(1, box.maxY - box.minY);
  const adjustX = handle.includes('e') || handle.includes('w');
  const adjustY = handle.includes('n') || handle.includes('s');
  const fromLeft = handle.includes('w'), fromTop = handle.includes('n');
  const ax = fromLeft ? box.maxX : box.minX;
  const ay = fromTop ? box.maxY : box.minY;
  const bounds = getSceneDrawingAreaBounds();
  const roomX = fromLeft ? ax - bounds.x : bounds.x + bounds.width - ax;
  const roomY = fromTop ? ay - bounds.y : bounds.y + bounds.height - ay;
  const minScale = 0.1;
  const limX = [Math.max(minScale, SCENE_GROUP_MIN_EXTENT / oldW), Math.max(1, roomX / oldW)];
  const limY = [Math.max(minScale, SCENE_GROUP_MIN_EXTENT / oldH), Math.max(1, roomY / oldH)];

  let sx = 1, sy = 1;
  if (adjustX) sx = sceneGroupClamp((oldW + (fromLeft ? -1 : 1) * (x - pointer.x)) / oldW, limX[0], limX[1]);
  if (adjustY) sy = sceneGroupClamp((oldH + (fromTop ? -1 : 1) * (y - pointer.y)) / oldH, limY[0], limY[1]);
  const uniform = adjustX && adjustY && !freeCorner;
  let limU = null;
  if (uniform) {
    // Góc: giữ tỷ lệ theo trục bị kéo nhiều hơn.
    const desired = Math.abs(sx - 1) >= Math.abs(sy - 1) ? sx : sy;
    limU = [Math.max(minScale, SCENE_GROUP_MIN_EXTENT / Math.max(oldW, oldH)), Math.max(1, Math.min(roomX / oldW, roomY / oldH))];
    sx = sy = sceneGroupClamp(desired, limU[0], limU[1]);
  }
  return { sx, sy, ax, ay, adjustX, adjustY, fromLeft, fromTop, uniform, limX, limY, limU, oldW, oldH };
}


// Co giãn rồi giữ cố định cạnh/góc đối diện CỦA KHUNG CHỌN (khung có viền đệm không co theo nên nếu chỉ co
// quanh toạ độ hình học thì cạnh đối diện sẽ bị trôi vài px).
function applySceneGroupScale(state, c, sx, sy) {
  state.originals.forEach(({ shape, data }) => scaleSceneShapeAbout(shape, data, c.ax, c.ay, sx, sy));
  const shapes = state.originals.map(item => item.shape);
  const nb = getCollectiveBoundingBox(shapes);
  if (!nb) return null;
  const dx = c.adjustX ? c.ax - (c.fromLeft ? nb.maxX : nb.minX) : 0;
  const dy = c.adjustY ? c.ay - (c.fromTop ? nb.maxY : nb.minY) : 0;
  if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
    shapes.forEach(shape => moveShapeBy(shape, dx, dy));
    nb.minX += dx; nb.maxX += dx; nb.minY += dy; nb.maxY += dy;
  }
  return nb;
}


function resizeSceneGroupFromPointer(state, x, y, freeCorner) {
  if (!state) return false;
  const c = computeSceneGroupResize(state, x, y, freeCorner);
  let { sx, sy } = c;
  const targetW = c.oldW * sx, targetH = c.oldH * sy;
  let nb = applySceneGroupScale(state, c, sx, sy);
  if (nb && (Math.abs(sx - 1) > 0.002 || Math.abs(sy - 1) > 0.002)) {
    // Khung chọn = hình học co giãn + viền đệm cố định → hiệu chỉnh 1 bước (secant) để mép khung bám đúng con trỏ.
    const fix = (s, actual, old, target) => {
      const d = actual - old;
      return Math.abs(s - 1) > 0.001 && Math.abs(d) > 1e-6 ? 1 + (target - old) * (s - 1) / d : s;
    };
    let nsx = sx, nsy = sy;
    if (c.uniform) {
      const useX = Math.abs(sx - 1) >= Math.abs(sy - 1);
      const s = useX ? fix(sx, nb.maxX - nb.minX, c.oldW, targetW) : fix(sy, nb.maxY - nb.minY, c.oldH, targetH);
      nsx = nsy = sceneGroupClamp(s, c.limU[0], c.limU[1]);
    } else {
      if (c.adjustX) nsx = sceneGroupClamp(fix(sx, nb.maxX - nb.minX, c.oldW, targetW), c.limX[0], c.limX[1]);
      if (c.adjustY) nsy = sceneGroupClamp(fix(sy, nb.maxY - nb.minY, c.oldH, targetH), c.limY[0], c.limY[1]);
    }
    if (Math.abs(nsx - sx) > 0.0005 || Math.abs(nsy - sy) > 0.0005) {
      sx = nsx; sy = nsy;
      applySceneGroupScale(state, c, sx, sy);
    }
  }
  return Math.abs(sx - 1) > 0.002 || Math.abs(sy - 1) > 0.002;
}


function restoreSceneGroupResize(state) {
  if (!state) return;
  state.originals.forEach(({ shape, data }) => {
    Object.keys(shape).forEach(key => { if (!(key in data)) delete shape[key]; });
    Object.assign(shape, JSON.parse(JSON.stringify(data)));
  });
}
