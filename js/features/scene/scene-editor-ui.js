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
