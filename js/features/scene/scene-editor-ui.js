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

// ---- Nhập nhanh số lớp: nhấp "Lớp: x/N" rồi gõ số, Enter để chuyển, Esc để huỷ ----
// Chỉ áp dụng khi chọn đúng một hình; phần tính vị trí nằm ở layer-order.js (có test).
(function () {
  const LABEL_ID = 'selectedShapeLayerText';
  let editing = null; // { id, input }

  function singleSelectedShape() {
    if (typeof sceneShapes === 'undefined' || !selectedShapeId || currentDrawTool !== 'select') return null;
    const ids = Array.isArray(selectedShapeIds) ? selectedShapeIds : [];
    if (ids.length > 1) return null;
    return sceneShapes.find(s => s.id === selectedShapeId) || null;
  }
  const toast = (message, type) => { if (typeof showToast === 'function') showToast(message, type); };

  // Trả về true nếu đã chuyển hoặc hình đã ở đúng lớp; false nếu số gõ vào không hợp lệ.
  function applyLayer(id, text) {
    const layer = sceneParseLayerNumber(text, sceneShapes.length);
    if (layer === null) {
      toast('Nhập số lớp từ 1 đến ' + sceneShapes.length + ' (1 = dưới cùng).', 'warning');
      return false;
    }
    const result = sceneMoveShapeToLayer(sceneShapes, id, layer);
    if (!result.ok || !result.changed) return true;
    sceneShapes = result.shapes;
    redrawSceneCanvas(true);
    updateSelectionBadge();
    if (typeof saveDrawingState === 'function') saveDrawingState(); // ghi vào lịch sử → Hoàn tác được
    toast('Đã chuyển hình từ lớp ' + result.from + ' sang lớp ' + result.to, 'info');
    return true;
  }

  function finish(commit) {
    if (!editing) return;
    const { id, input } = editing;
    editing = null; // đặt trước khi đổi DOM để blur do gỡ ô nhập không chạy lại
    if (commit) applyLayer(id, input.value);
    const label = document.getElementById(LABEL_ID);
    if (label) {
      const index = sceneShapes.findIndex(s => s.id === id);
      label.textContent = index >= 0 ? (index + 1) + '/' + sceneShapes.length : '';
    }
    updateSelectionBadge();
  }

  function startEdit() {
    const label = document.getElementById(LABEL_ID);
    if (!label || editing) return;
    const shape = singleSelectedShape();
    if (!shape) { toast('Chọn một hình để nhập số lớp.', 'info'); return; }
    const total = sceneShapes.length;
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.maxLength = 4;
    input.className = 'scene-layer-input';
    input.value = String(sceneShapes.indexOf(shape) + 1);
    input.setAttribute('aria-label', 'Số lớp, từ 1 đến ' + total);
    input.title = 'Gõ số lớp (1 = dưới cùng, ' + total + ' = trên cùng), Enter để chuyển, Esc để huỷ';
    label.textContent = '';
    label.append(input, document.createTextNode('/' + total));
    editing = { id: shape.id, input };
    input.addEventListener('keydown', event => {
      event.stopPropagation(); // không để phím tắt của trình vẽ (Esc bỏ chọn, Delete…) xử lý
      if (event.key === 'Enter') {
        event.preventDefault();
        if (sceneParseLayerNumber(input.value, sceneShapes.length) === null) {
          applyLayer(editing.id, input.value); // chỉ để báo lỗi; giữ ô nhập để sửa lại
          input.select();
        } else finish(true);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      }
    });
    input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, ''); });
    input.addEventListener('blur', () => finish(sceneParseLayerNumber(input.value, sceneShapes.length) !== null));
    input.focus();
    input.select();
  }

  document.addEventListener('click', event => {
    const label = event.target.closest && event.target.closest('#' + LABEL_ID);
    if (label && !event.target.closest('.scene-layer-input')) startEdit();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target && event.target.id === LABEL_ID) { event.preventDefault(); startEdit(); }
  });
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

// ---- Rừng cây / đồi cây / đồng lúa: chọn hình dạng vùng và vẽ ranh giới tự do ----
// Khung chữ nhật không khớp khi đường cong cắt qua sườn đồi → cho phép viền tự nhiên hoặc tự vẽ ranh giới.
// Ranh giới lưu dạng toạ độ chuẩn hoá trong khung (areaOutline) nên kéo giãn / xoay / in vẫn đúng hình.
const SCENE_AREA_SHAPE_TYPES = ['forest', 'rice_field', 'rock_field', 'hill'];
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

// ---- Ranh giới tự vẽ ----
// Hai cách vẽ trong cùng một chế độ:
//  • Nhấp từng điểm dọc mép vùng (khuyên dùng): đường cong mượt đi qua các điểm; nhấp đúp / Enter / nhấp lại điểm đầu để xong.
//  • Giữ chuột rê liền một nét: nét tay được làm mượt và rải lại điểm đều nên không còn răng cưa, méo.
// Sau khi vẽ, chọn vùng sẽ hiện các điểm neo: kéo để nắn, nhấp đúp điểm để xoá, nhấp đúp lên viền để thêm điểm.
let sceneOutlineDraw = null;
const sceneAreaZoom = () => (typeof currentSceneZoom === 'number' && currentSceneZoom > 0 ? currentSceneZoom : 1);
function sceneAreaToWorld(shape, u, v) {
  const d = getVehicleDimensions(shape), a = shape.angle || 0, lx = u * d.w, ly = (v - 0.5) * d.h;
  return { x: shape.startX + lx * Math.cos(a) - ly * Math.sin(a), y: shape.startY + lx * Math.sin(a) + ly * Math.cos(a) };
}
function sceneAreaAnchors(shape) {
  return (shape.areaOutline || []).map(p => sceneAreaToWorld(shape, Number(p[0]), Number(p[1])));
}
// Gán các điểm neo (toạ độ sơ đồ) cho vùng: tính lại khung bao theo hướng xoay hiện tại rồi chuẩn hoá về 0..1.
function applySceneAreaAnchors(shape, worldPoints, resetAngle) {
  if (resetAngle) shape.angle = 0;
  const a = shape.angle || 0, cos = Math.cos(a), sin = Math.sin(a);
  const local = worldPoints.map(p => { const dx = p.x - shape.startX, dy = p.y - shape.startY; return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos }; });
  const minX = Math.min(...local.map(p => p.x)), maxX = Math.max(...local.map(p => p.x));
  const minY = Math.min(...local.map(p => p.y)), maxY = Math.max(...local.map(p => p.y));
  const W = Math.max(1, maxX - minX), H = Math.max(1, maxY - minY), midY = (minY + maxY) / 2;
  shape.startX += minX * cos - midY * sin;
  shape.startY += minX * sin + midY * cos;
  shape.objectW = W; shape.objectH = H;
  shape.areaShape = 'custom';
  shape.areaOutline = local.map(p => [Number(((p.x - minX) / W).toFixed(4)), Number(((p.y - minY) / H).toFixed(4))]);
}
// Làm mượt nét rê tay: trung bình trượt để khử rung, rồi rải lại điểm cách đều theo chiều dài nét.
function smoothSceneFreehand(raw) {
  const n = raw.length, win = 4, avg = [];
  for (let i = 0; i < n; i++) {
    let sx = 0, sy = 0, c = 0;
    for (let k = -win; k <= win; k++) { const p = raw[(((i + k) % n) + n) % n]; sx += p.x; sy += p.y; c++; }
    avg.push({ x: sx / c, y: sy / c });
  }
  let total = 0; const seg = [];
  for (let i = 0; i < n; i++) { const a = avg[i], b = avg[(i + 1) % n], d = Math.hypot(b.x - a.x, b.y - a.y); seg.push(d); total += d; }
  const count = Math.max(8, Math.min(36, Math.round(total / 42))), step = total / count, out = [];
  let i = 0, walked = 0;
  for (let k = 0; k < count; k++) {
    const target = k * step;
    while (i < n - 1 && walked + seg[i] < target) { walked += seg[i]; i++; }
    const a = avg[i], b = avg[(i + 1) % n], t = seg[i] ? (target - walked) / seg[i] : 0;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}
function strokeSceneAreaPreview(points, closed) {
  if (!sceneCtx || !points.length) return;
  const z = sceneAreaZoom(), curve = points.length >= 3 ? sampleSceneClosedSpline(points, 10) : points;
  sceneCtx.save();
  sceneCtx.beginPath();
  curve.forEach((p, i) => (i ? sceneCtx.lineTo(p.x, p.y) : sceneCtx.moveTo(p.x, p.y)));
  if (points.length >= 3) { sceneCtx.closePath(); sceneCtx.fillStyle = 'rgba(113,181,104,.16)'; sceneCtx.fill(); }
  sceneCtx.setLineDash(closed ? [] : [6 / z, 4 / z]);
  sceneCtx.strokeStyle = '#2f7a3b'; sceneCtx.lineWidth = 1.6 / z; sceneCtx.stroke();
  sceneCtx.restore();
}
function drawSceneAreaHandles(points, activeIndex) {
  if (!sceneCtx) return;
  const z = sceneAreaZoom();
  sceneCtx.save();
  points.forEach((p, i) => {
    sceneCtx.beginPath(); sceneCtx.arc(p.x, p.y, (i === activeIndex ? 5.5 : 4.5) / z, 0, Math.PI * 2);
    sceneCtx.fillStyle = i === activeIndex ? '#2f7a3b' : '#fff'; sceneCtx.fill();
    sceneCtx.strokeStyle = '#2f7a3b'; sceneCtx.lineWidth = 1.6 / z; sceneCtx.stroke();
  });
  sceneCtx.restore();
}
function stopSceneryOutlineDraw(silent) {
  if (!sceneOutlineDraw) return;
  ['mousedown', 'mousemove', 'mouseup', 'dblclick', 'keydown'].forEach(type => window.removeEventListener(type, sceneOutlineDraw[type], true));
  document.getElementById('sceneCanvasViewport')?.classList.remove('is-outline-drawing');
  sceneOutlineDraw = null;
  redrawSceneCanvas(true);
  updateSelectionBadge();
  if (!silent && typeof showToast === 'function') showToast('Đã thoát chế độ vẽ ranh giới.', 'info');
}
function startSceneryOutlineDraw() {
  const shape = getSelectedAreaShapeTarget();
  if (!shape) return;
  if (sceneOutlineDraw) return stopSceneryOutlineDraw();
  const targetId = shape.id;
  const points = [];           // các điểm neo đã nhấp
  let press = null, stroke = null, cursor = null;
  const onCanvas = e => typeof sceneCanvas !== 'undefined' && e.target === sceneCanvas;
  const eat = e => { e.preventDefault(); e.stopImmediatePropagation(); };
  const paint = () => {
    redrawSceneCanvas(false);
    if (stroke) return strokeSceneAreaPreview(stroke.length >= 3 ? smoothSceneFreehand(stroke) : stroke, false);
    const live = cursor && points.length ? points.concat([cursor]) : points;
    strokeSceneAreaPreview(live, false);
    drawSceneAreaHandles(points, points.length >= 3 && cursor && Math.hypot(cursor.x - points[0].x, cursor.y - points[0].y) < 9 / sceneAreaZoom() ? 0 : -1);
  };
  const finish = anchors => {
    const target = sceneShapes.find(s => s.id === targetId);
    const xs = anchors.map(p => p.x), ys = anchors.map(p => p.y);
    if (!target || anchors.length < 3 || Math.max(...xs) - Math.min(...xs) < 30 || Math.max(...ys) - Math.min(...ys) < 20) {
      if (typeof showToast === 'function') showToast('Ranh giới cần ít nhất 3 điểm và đủ rộng. Hãy nhấp thêm điểm dọc mép vùng.', 'warning');
      return paint();
    }
    applySceneAreaAnchors(target, anchors, true);
    if (typeof saveDrawingState === 'function') saveDrawingState();
    stopSceneryOutlineDraw(true);
    if (typeof showToast === 'function') showToast('Đã vẽ ranh giới. Kéo các điểm tròn để nắn lại; nhấp đúp điểm để xoá, nhấp đúp lên viền để thêm điểm.', 'success');
  };
  const state = {
    mousedown(e) { if (!onCanvas(e) || e.button > 0) return; eat(e); press = getMousePos(sceneCanvas, e); stroke = null; },
    mousemove(e) {
      if (!press && !onCanvas(e)) return;
      const p = getMousePos(sceneCanvas, e);
      if (press) {
        eat(e);
        if (!stroke && Math.hypot(p.x - press.x, p.y - press.y) > 7 / sceneAreaZoom() && !points.length) stroke = [press];
        if (stroke) { const last = stroke[stroke.length - 1]; if (Math.hypot(p.x - last.x, p.y - last.y) >= 2) stroke.push(p); }
      } else { e.stopImmediatePropagation(); }
      cursor = p; paint();
    },
    mouseup(e) {
      if (!press) return;
      eat(e);
      const at = press, drawn = stroke; press = null; stroke = null;
      if (drawn && drawn.length >= 12) return finish(smoothSceneFreehand(drawn));
      if (points.length >= 3 && Math.hypot(at.x - points[0].x, at.y - points[0].y) < 9 / sceneAreaZoom()) return finish(points.slice());
      const last = points[points.length - 1];
      if (!last || Math.hypot(at.x - last.x, at.y - last.y) > 4 / sceneAreaZoom()) points.push(at);
      paint();
    },
    dblclick(e) { if (!onCanvas(e)) return; eat(e); finish(points.slice()); },
    keydown(e) {
      if (e.key === 'Escape') { eat(e); stopSceneryOutlineDraw(); }
      else if (e.key === 'Enter') { eat(e); finish(points.slice()); }
      else if (e.key === 'Backspace' || e.key === 'Delete') { eat(e); points.pop(); paint(); }
    }
  };
  sceneOutlineDraw = state;
  ['mousedown', 'mousemove', 'mouseup', 'dblclick', 'keydown'].forEach(type => window.addEventListener(type, state[type], true));
  document.getElementById('sceneCanvasViewport')?.classList.add('is-outline-drawing');
  updateSelectionBadge();
  if (typeof showToast === 'function') showToast('Nhấp từng điểm dọc mép vùng (Enter hoặc nhấp đúp để xong, Backspace bỏ điểm cuối, Esc huỷ). Cũng có thể giữ chuột rê một vòng.', 'info');
}

// ---- Nắn ranh giới đã vẽ: điểm neo hiện khi chọn vùng "custom" ----
function getSceneAreaEditTarget() {
  if (sceneOutlineDraw || typeof currentDrawTool === 'undefined' || currentDrawTool !== 'select') return null;
  const shape = getSelectedAreaShapeTarget();
  return shape && shape.areaShape === 'custom' && Array.isArray(shape.areaOutline) && shape.areaOutline.length >= 3 ? shape : null;
}
(function () {
  const original = window.redrawSceneCanvas;
  if (typeof original !== 'function' || original.__areaHandles) return;
  const wrapped = function (includeSelectionUI = true) {
    const result = original.call(this, includeSelectionUI);
    if (includeSelectionUI) { const shape = getSceneAreaEditTarget(); if (shape) drawSceneAreaHandles(sceneAreaAnchors(shape), sceneAreaDrag ? sceneAreaDrag.index : -1); }
    return result;
  };
  wrapped.__areaHandles = true;
  window.redrawSceneCanvas = wrapped;
})();
let sceneAreaDrag = null;
function findSceneAreaAnchor(shape, pos) {
  const anchors = sceneAreaAnchors(shape), reach = 8 / sceneAreaZoom();
  let best = -1, bestD = reach;
  anchors.forEach((p, i) => { const d = Math.hypot(p.x - pos.x, p.y - pos.y); if (d <= bestD) { bestD = d; best = i; } });
  return { anchors, index: best };
}
window.addEventListener('mousedown', e => {
  const shape = getSceneAreaEditTarget();
  if (!shape || e.button > 0 || typeof sceneCanvas === 'undefined' || e.target !== sceneCanvas) return;
  const hit = findSceneAreaAnchor(shape, getMousePos(sceneCanvas, e));
  if (hit.index < 0) return;
  e.preventDefault(); e.stopImmediatePropagation();
  sceneAreaDrag = { id: shape.id, index: hit.index, anchors: hit.anchors, moved: false };
}, true);
window.addEventListener('mousemove', e => {
  if (!sceneAreaDrag) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const shape = sceneShapes.find(s => s.id === sceneAreaDrag.id);
  if (!shape) { sceneAreaDrag = null; return; }
  sceneAreaDrag.anchors[sceneAreaDrag.index] = getMousePos(sceneCanvas, e);
  sceneAreaDrag.moved = true;
  applySceneAreaAnchors(shape, sceneAreaDrag.anchors, false);
  redrawSceneCanvas(true);
}, true);
window.addEventListener('mouseup', e => {
  if (!sceneAreaDrag) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const moved = sceneAreaDrag.moved; sceneAreaDrag = null;
  redrawSceneCanvas(true);
  if (moved && typeof saveDrawingState === 'function') saveDrawingState();
}, true);
// Nhấp đúp điểm neo: xoá điểm (giữ tối thiểu 3). Nhấp đúp lên viền: chèn điểm mới tại đó.
window.addEventListener('dblclick', e => {
  const shape = getSceneAreaEditTarget();
  if (!shape || typeof sceneCanvas === 'undefined' || e.target !== sceneCanvas) return;
  const pos = getMousePos(sceneCanvas, e), hit = findSceneAreaAnchor(shape, pos), anchors = hit.anchors;
  if (hit.index >= 0) {
    if (anchors.length <= 3) return;
    anchors.splice(hit.index, 1);
  } else {
    // tìm đoạn viền (giữa hai điểm neo liên tiếp) gần vị trí nhấp nhất
    const curve = sampleSceneClosedSpline(anchors, 10);
    let best = -1, bestD = 7 / sceneAreaZoom();
    curve.forEach((p, i) => { const d = Math.hypot(p.x - pos.x, p.y - pos.y); if (d < bestD) { bestD = d; best = i; } });
    if (best < 0) return;
    anchors.splice(Math.floor(best / 10) + 1, 0, pos);
  }
  e.preventDefault(); e.stopImmediatePropagation();
  applySceneAreaAnchors(shape, anchors, false);
  redrawSceneCanvas(true);
  if (typeof saveDrawingState === 'function') saveDrawingState();
}, true);

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
