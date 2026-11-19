// ------------------------------------------
// CHỌN NHIỀU: kéo khung trên vùng trống + Ctrl+A
// ------------------------------------------
// Trước đây chỉ chọn nhiều bằng Ctrl+bấm từng đối tượng, nên chọn cả cụm (nhà + hàng hoá + xe…) rất chậm.
// Kéo khung kiểu CAD:
//  - kéo từ TRÁI sang PHẢI (khung nét liền, xanh dương): chỉ chọn vật nằm TRỌN trong khung;
//  - kéo từ PHẢI sang TRÁI (khung nét đứt, xanh lá): chọn mọi vật CHẠM khung (tiện chọn nét dài, đường).
//  - giữ Ctrl / Shift: cộng thêm vào vùng đang chọn.
// Đối tượng thuộc một nhóm (Ctrl+G) được chọn cả nhóm.

let sceneMarqueeState = null;
const SCENE_MARQUEE_MIN_DRAG = 4;

function getSceneMarqueeRect(state) {
  if (!state) return null;
  const x1 = Math.min(state.x0, state.x1), x2 = Math.max(state.x0, state.x1);
  const y1 = Math.min(state.y0, state.y1), y2 = Math.max(state.y0, state.y1);
  return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1, crossing: state.x1 < state.x0 };
}


// Trả về mảng id các đối tượng được khung chọn (đã mở rộng theo nhóm).
function getSceneShapeIdsInMarquee(rect, shapes) {
  if (!rect) return [];
  const list = Array.isArray(shapes) ? shapes : [];
  const hit = new Set();
  list.forEach(shape => {
    const box = getShapeBoundingBox(shape);
    if (!box) return;
    const inside = box.minX >= rect.x1 && box.maxX <= rect.x2 && box.minY >= rect.y1 && box.maxY <= rect.y2;
    const touches = box.maxX >= rect.x1 && box.minX <= rect.x2 && box.maxY >= rect.y1 && box.minY <= rect.y2;
    if (rect.crossing ? touches : inside) hit.add(shape.id);
  });
  // Chọn một thành viên của nhóm thì chọn cả nhóm.
  const groups = new Set();
  list.forEach(shape => { if (hit.has(shape.id) && shape.groupId) groups.add(shape.groupId); });
  list.forEach(shape => { if (shape.groupId && groups.has(shape.groupId)) hit.add(shape.id); });
  return list.filter(shape => hit.has(shape.id)).map(shape => shape.id);
}


function beginSceneMarquee(pos, additive) {
  sceneMarqueeState = {
    x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y,
    additive: !!additive,
    base: additive && Array.isArray(selectedShapeIds) ? selectedShapeIds.slice() : [],
    moved: false
  };
}


function applySceneMarqueeSelection() {
  const state = sceneMarqueeState;
  if (!state) return;
  const ids = getSceneShapeIdsInMarquee(getSceneMarqueeRect(state), sceneShapes);
  const merged = state.additive ? Array.from(new Set([...state.base, ...ids])) : ids;
  setSelectedShapes(merged);
}


function updateSceneMarquee(pos) {
  const state = sceneMarqueeState;
  if (!state) return false;
  const bounds = getSceneDrawingAreaBounds();
  state.x1 = Math.max(bounds.x, Math.min(bounds.x + bounds.width, pos.x));
  state.y1 = Math.max(bounds.y, Math.min(bounds.y + bounds.height, pos.y));
  if (!state.moved && Math.hypot(state.x1 - state.x0, state.y1 - state.y0) >= SCENE_MARQUEE_MIN_DRAG) state.moved = true;
  if (state.moved) applySceneMarqueeSelection(); // chọn trực tiếp khi kéo để thấy ngay kết quả
  return state.moved;
}


function finishSceneMarquee(pos) {
  const state = sceneMarqueeState;
  if (!state) return;
  if (pos) updateSceneMarquee(pos);
  sceneMarqueeState = null;
}


// Esc: bỏ khung, trả lại vùng chọn như trước khi kéo.
function cancelSceneMarquee() {
  const state = sceneMarqueeState;
  if (!state) return false;
  sceneMarqueeState = null;
  setSelectedShapes(state.base);
  return true;
}


function drawSceneMarquee(ctx) {
  const state = sceneMarqueeState;
  if (!state || !state.moved) return;
  const rect = getSceneMarqueeRect(state);
  const color = rect.crossing ? '22, 163, 74' : '37, 99, 235';
  ctx.save();
  ctx.fillStyle = `rgba(${color}, .08)`;
  ctx.fillRect(rect.x1, rect.y1, rect.w, rect.h);
  ctx.strokeStyle = `rgba(${color}, .9)`;
  ctx.lineWidth = 1.2;
  ctx.setLineDash(rect.crossing ? [5, 4] : []);
  ctx.strokeRect(rect.x1, rect.y1, rect.w, rect.h);
  ctx.restore();
}


// Ctrl+A: chọn mọi đối tượng đang nằm trong ô vẽ.
function selectAllSceneShapes() {
  if (!Array.isArray(sceneShapes) || sceneShapes.length === 0) return 0;
  if (typeof setActiveDrawTool === 'function' && currentDrawTool !== 'select') setActiveDrawTool('select');
  setSelectedShapes(sceneShapes.map(shape => shape.id));
  updateSelectionBadge();
  redrawSceneCanvas(true);
  return sceneShapes.length;
}
