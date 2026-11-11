// Giao diện trình vẽ sơ đồ (css/scene-editor.css): dòng phụ dưới tiêu đề hiện hồ sơ đang vẽ
// (biển số · số HSBT · khách hàng) thay cho dòng phím tắt dày đặc trước đây.
(function () {
  function updateSceneHeaderMeta() {
    const meta = document.getElementById('sceneHeaderMeta');
    if (!meta) return;
    const read = id => String(document.getElementById(id)?.value || '').trim();
    const parts = [read('modalPendingBienSo'), read('modalPendingSoHoSoBoiThuong'), read('modalPendingKhachHang')].filter(Boolean);
    meta.textContent = parts.length ? parts.join(' · ') : 'Vẽ và in sơ đồ hiện trường vụ tai nạn';
    meta.title = meta.textContent;
  }
  const original = window.openSceneDrawingModal;
  if (typeof original === 'function' && !original.__sceneUi) {
    const wrapped = function (...args) {
      const result = original.apply(this, args);
      try { updateSceneHeaderMeta(); } catch (_) { /* chỉ là phần hiển thị phụ */ }
      return result;
    };
    wrapped.__sceneUi = true;
    window.openSceneDrawingModal = wrapped;
  }
})();

// ---- Panel "Thuộc tính đối tượng": thu gọn / mở rộng (nhớ trong localStorage) ----
// rendering.js chỉ bật/tắt style.display của #sceneSelectedBadge; việc thu gọn dùng class riêng
// nên không ảnh hưởng logic hiển thị theo lựa chọn.
(function () {
  const KEY = 'scene-inspector-collapsed';
  const read = () => { try { return localStorage.getItem(KEY) === '1'; } catch (_) { return false; } };
  const write = value => { try { localStorage.setItem(KEY, value ? '1' : '0'); } catch (_) {} };
  const chevron = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';

  function apply(panel, collapsed) {
    panel.classList.toggle('is-collapsed', collapsed);
    const button = panel.querySelector('.scene-inspector-toggle');
    if (button) {
      button.setAttribute('aria-expanded', String(!collapsed));
      button.title = collapsed ? 'Mở rộng thuộc tính đối tượng' : 'Thu gọn thuộc tính đối tượng';
      button.setAttribute('aria-label', button.title);
    }
  }

  function setup() {
    const panel = document.getElementById('sceneSelectedBadge');
    if (!panel || panel.querySelector('.scene-inspector-head')) return;
    const head = document.createElement('div');
    head.className = 'scene-inspector-head';
    head.innerHTML = `<span class="scene-inspector-label">Thuộc tính đối tượng</span>
      <button type="button" class="scene-inspector-toggle" aria-controls="sceneSelectedBadge">${chevron}</button>`;
    panel.prepend(head);
    head.querySelector('.scene-inspector-toggle').addEventListener('click', event => {
      event.stopPropagation();
      const collapsed = !panel.classList.contains('is-collapsed');
      apply(panel, collapsed); write(collapsed);
    });
    // Khi đang thu gọn, bấm vào tên đối tượng cũng mở lại panel.
    panel.querySelector('.scene-selection-title')?.addEventListener('click', () => {
      if (!panel.classList.contains('is-collapsed')) return;
      apply(panel, false); write(false);
    });
    apply(panel, read());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();

// ---- Trạm thu phí: chọn số làn xe trong panel thuộc tính ----
// delta = ±1: thêm/bớt làn (cố định số làn); delta = 0: quay về tự tính theo bề rộng.
function changeSelectedTollLanes(delta) {
  if (typeof sceneShapes === 'undefined' || !selectedShapeId) return;
  const shape = sceneShapes.find(s => s.id === selectedShapeId);
  if (!shape || shape.type !== 'toll_station') return;
  const width = getVehicleDimensions(shape).w;
  if (delta === 0) {
    if (shape.tollLanes === undefined) return;
    delete shape.tollLanes;
  } else {
    const current = getTollStationLaneCount(shape, width);
    const next = Math.max(TOLL_LANES_MIN, Math.min(TOLL_LANES_MAX, current + delta));
    if (next === current && Number.isInteger(shape.tollLanes)) return;
    shape.tollLanes = next;
  }
  redrawSceneCanvas(true);
  updateSelectionBadge();
  if (typeof saveDrawingState === 'function') saveDrawingState(); // ghi vào lịch sử → Hoàn tác được
}

(function () {
  const original = window.updateSelectionBadge;
  if (typeof original !== 'function' || original.__tollLanes) return;
  const wrapped = function (...args) {
    const result = original.apply(this, args);
    const group = document.getElementById('sceneTollLanesGroup') || document.getElementById('selectedTollLanesGroup');
    if (!group) return result;
    const ids = (typeof selectedShapeIds !== 'undefined' && Array.isArray(selectedShapeIds)) ? selectedShapeIds : [];
    const shape = (typeof sceneShapes !== 'undefined' && selectedShapeId && ids.length <= 1) ? sceneShapes.find(s => s.id === selectedShapeId) : null;
    const isToll = !!shape && shape.type === 'toll_station' && currentDrawTool === 'select';
    group.style.display = isToll ? 'flex' : 'none';
    if (isToll) {
      const lanes = getTollStationLaneCount(shape, getVehicleDimensions(shape).w);
      const manual = Number.isInteger(shape.tollLanes);
      document.getElementById('selectedTollLanesText').textContent = lanes;
      document.getElementById('btnTollLanesMinus').disabled = lanes <= TOLL_LANES_MIN;
      document.getElementById('btnTollLanesPlus').disabled = lanes >= TOLL_LANES_MAX;
      const auto = document.getElementById('btnTollLanesAuto');
      auto.setAttribute('aria-pressed', String(!manual));
      auto.title = manual ? 'Quay về tự tính số làn theo bề rộng trạm' : 'Đang tự tính số làn theo bề rộng trạm';
    }
    return result;
  };
  wrapped.__tollLanes = true;
  window.updateSelectionBadge = wrapped;
})();

// ---- Bàn tay: nắm chuột kéo để di chuyển vùng nhìn ----
function toggleSceneHandMode(force) {
  sceneHandMode = typeof force === 'boolean' ? force : !sceneHandMode;
  const button = document.getElementById('sceneHandToggle');
  if (button) button.setAttribute('aria-pressed', String(sceneHandMode));
  document.getElementById('sceneCanvasViewport')?.classList.toggle('is-hand-mode', sceneHandMode);
}
// Esc thoát chế độ Bàn tay; đóng trình vẽ cũng tắt.
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && typeof sceneHandMode !== 'undefined' && sceneHandMode) toggleSceneHandMode(false);
});
(function () {
  const original = window.closeSceneDrawingModal;
  if (typeof original !== 'function' || original.__hand) return;
  const wrapped = function (...args) { if (typeof sceneHandMode !== 'undefined' && sceneHandMode) toggleSceneHandMode(false); return original.apply(this, args); };
  wrapped.__hand = true;
  window.closeSceneDrawingModal = wrapped;
})();

// ---- Rừng cây / đồi cây: chọn hình dạng vùng và vẽ ranh giới tự do ----
// Khung chữ nhật không khớp khi đường cong cắt qua sườn đồi → cho phép viền tự nhiên hoặc tự vẽ ranh giới.
// Ranh giới lưu dạng toạ độ chuẩn hoá trong khung (areaOutline) nên kéo giãn / xoay / in vẫn đúng hình.
const SCENE_AREA_SHAPE_TYPES = ['forest'];
function getSelectedAreaShapeTarget() {
  if (typeof sceneShapes === 'undefined' || !selectedShapeId) return null;
  const ids = (typeof selectedShapeIds !== 'undefined' && Array.isArray(selectedShapeIds)) ? selectedShapeIds : [];
  if (ids.length > 1) return null;
  const shape = sceneShapes.find(s => s.id === selectedShapeId);
  return shape && SCENE_AREA_SHAPE_TYPES.includes(shape.type) ? shape : null;
}
function setSelectedSceneryAreaShape(kind) {
  const shape = getSelectedAreaShapeTarget();
  if (!shape) return;
  if (kind === 'rect') { delete shape.areaShape; delete shape.areaOutline; }
  else if (kind === 'natural') { shape.areaShape = 'natural'; delete shape.areaOutline; }
  else return;
  redrawSceneCanvas(true);
  updateSelectionBadge();
  if (typeof saveDrawingState === 'function') saveDrawingState();
}

// Chế độ vẽ ranh giới: chặn sự kiện chuột của trình vẽ (pha capture trên window) trong lúc vẽ.
let sceneOutlineDraw = null;
function stopSceneryOutlineDraw(silent) {
  if (!sceneOutlineDraw) return;
  window.removeEventListener('mousedown', sceneOutlineDraw.down, true);
  window.removeEventListener('mousemove', sceneOutlineDraw.move, true);
  window.removeEventListener('mouseup', sceneOutlineDraw.up, true);
  window.removeEventListener('keydown', sceneOutlineDraw.key, true);
  document.getElementById('sceneCanvasViewport')?.classList.remove('is-outline-drawing');
  sceneOutlineDraw = null;
  redrawSceneCanvas(true);
  updateSelectionBadge();
  if (!silent && typeof showToast === 'function') showToast('Đã thoát chế độ vẽ ranh giới.', 'info');
}
function simplifySceneOutline(points, tolerance) {
  // Ramer–Douglas–Peucker: bỏ điểm thừa của nét tay, giữ dáng ranh giới.
  if (points.length < 3) return points.slice();
  const dist = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1; return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len; };
  let maxD = 0, index = 0;
  for (let i = 1; i < points.length - 1; i++) { const d = dist(points[i], points[0], points[points.length - 1]); if (d > maxD) { maxD = d; index = i; } }
  if (maxD <= tolerance) return [points[0], points[points.length - 1]];
  const left = simplifySceneOutline(points.slice(0, index + 1), tolerance);
  return left.slice(0, -1).concat(simplifySceneOutline(points.slice(index), tolerance));
}
function drawSceneOutlinePreview(points) {
  redrawSceneCanvas(true);
  if (!points.length || !sceneCtx) return;
  sceneCtx.save();
  sceneCtx.beginPath();
  points.forEach((p, i) => (i ? sceneCtx.lineTo(p.x, p.y) : sceneCtx.moveTo(p.x, p.y)));
  if (points.length > 2) sceneCtx.closePath();
  sceneCtx.fillStyle = 'rgba(113,181,104,.18)';
  sceneCtx.fill();
  sceneCtx.setLineDash([6, 4]);
  sceneCtx.strokeStyle = '#2f7a3b';
  sceneCtx.lineWidth = 1.6;
  sceneCtx.stroke();
  sceneCtx.restore();
}
function startSceneryOutlineDraw() {
  const shape = getSelectedAreaShapeTarget();
  if (!shape) return;
  if (sceneOutlineDraw) return stopSceneryOutlineDraw();
  const targetId = shape.id;
  let points = null;
  const onCanvas = e => typeof sceneCanvas !== 'undefined' && e.target === sceneCanvas;
  const state = {
    down(e) {
      if (!onCanvas(e) || e.button > 0) return;
      e.preventDefault(); e.stopImmediatePropagation();
      points = [getMousePos(sceneCanvas, e)];
    },
    move(e) {
      if (!points) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const p = getMousePos(sceneCanvas, e), last = points[points.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) >= 2.5) { points.push(p); drawSceneOutlinePreview(points); }
    },
    up(e) {
      if (!points) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const raw = points; points = null;
      const target = sceneShapes.find(s => s.id === targetId);
      const xs = raw.map(p => p.x), ys = raw.map(p => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      if (!target || raw.length < 6 || maxX - minX < 30 || maxY - minY < 20) {
        redrawSceneCanvas(true);
        if (typeof showToast === 'function') showToast('Ranh giới quá nhỏ. Hãy giữ chuột và rê một vòng quanh khu vực cần vẽ.', 'warning');
        return;
      }
      const simple = simplifySceneOutline(raw, 1.8).slice(0, 120);
      const W = maxX - minX, H = maxY - minY;
      target.angle = 0;
      target.startX = minX;
      target.startY = (minY + maxY) / 2;
      target.objectW = W;
      target.objectH = H;
      target.areaShape = 'custom';
      target.areaOutline = simple.map(p => [Number(((p.x - minX) / W).toFixed(4)), Number(((p.y - minY) / H).toFixed(4))]);
      if (typeof saveDrawingState === 'function') saveDrawingState();
      stopSceneryOutlineDraw(true);
      if (typeof showToast === 'function') showToast('Đã cập nhật ranh giới khu rừng. Kéo các cạnh để chỉnh thêm nếu cần.', 'success');
    },
    key(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); stopSceneryOutlineDraw(); } }
  };
  sceneOutlineDraw = state;
  window.addEventListener('mousedown', state.down, true);
  window.addEventListener('mousemove', state.move, true);
  window.addEventListener('mouseup', state.up, true);
  window.addEventListener('keydown', state.key, true);
  document.getElementById('sceneCanvasViewport')?.classList.add('is-outline-drawing');
  updateSelectionBadge();
  if (typeof showToast === 'function') showToast('Giữ chuột và rê theo mép khu rừng/đồi cây, thả ra để hoàn tất (Esc để huỷ).', 'info');
}

(function () {
  const original = window.updateSelectionBadge;
  if (typeof original !== 'function' || original.__areaShape) return;
  const wrapped = function (...args) {
    const result = original.apply(this, args);
    const group = document.getElementById('selectedAreaShapeGroup');
    if (!group) return result;
    const shape = getSelectedAreaShapeTarget();
    const show = !!shape && currentDrawTool === 'select';
    group.style.display = show ? 'flex' : 'none';
    if (show) {
      const kind = sceneOutlineDraw ? 'custom' : (shape.areaShape === 'custom' || shape.areaShape === 'natural' ? shape.areaShape : 'rect');
      group.querySelectorAll('[data-area-shape]').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.areaShape === kind)));
      const drawBtn = group.querySelector('[data-area-shape="custom"]');
      if (drawBtn) drawBtn.textContent = sceneOutlineDraw ? 'Đang vẽ… (Esc)' : (shape.areaShape === 'custom' ? 'Vẽ lại' : 'Vẽ ranh giới');
    }
    return result;
  };
  wrapped.__areaShape = true;
  window.updateSelectionBadge = wrapped;
})();
(function () {
  const original = window.closeSceneDrawingModal;
  if (typeof original !== 'function' || original.__areaShape) return;
  const wrapped = function (...args) { stopSceneryOutlineDraw(true); return original.apply(this, args); };
  wrapped.__areaShape = true;
  window.closeSceneDrawingModal = wrapped;
})();
