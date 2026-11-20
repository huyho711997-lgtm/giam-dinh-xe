// Sơ đồ mẫu: chèn nhanh nền đường (đường thẳng, ngã ba, ngã tư, đường cong, cầu) vào bản vẽ.
// Mẫu chỉ gồm các đối tượng sẵn có (vạch kẻ, đường cong, cầu) gộp thành một nhóm: kéo cả mẫu được,
// "Rã nhóm" để sửa từng nét. Mẫu luôn nằm DƯỚI các đối tượng đã vẽ và hoàn tác được bằng Ctrl+Z.
// Dùng chung cho index.html và so-do-hien-truong.html.
(function (root) {
  'use strict';

  const HALF_ROAD = 44;          // nửa bề rộng mặt đường (đồng bộ với preset ngã tư có sẵn)
  const CENTER_GAP = HALF_ROAD + 10;
  const BRIDGE_HALF = 33;        // nửa bề rộng mặt cầu = 0,22 × dài 300 / 2

  const SAMPLES = [
    { id: 'straight', name: 'Đường thẳng 2 chiều', desc: 'Hai mép đường, vạch giữa đứt',
      icon: '<path d="M2 8h20M2 16h20"></path><path d="M2 12h20" stroke-dasharray="3 3"></path>' },
    { id: 't_junction', name: 'Ngã ba', desc: 'Đường chính và một nhánh rẽ xuống',
      icon: '<path d="M2 7h20M2 15h7v7M15 22v-7h7"></path><path d="M2 11h20M12 15v7" stroke-dasharray="3 3"></path>' },
    { id: 'crossroad', name: 'Ngã tư', desc: 'Hai đường giao nhau, vạch giữa đứt',
      icon: '<path d="M2 8h6V2M16 2v6h6M22 16h-6v6M8 22v-6H2"></path><path d="M2 12h20M12 2v20" stroke-dasharray="3 3"></path>' },
    { id: 'curve', name: 'Đường cong (khúc cua)', desc: 'Đường rẽ gần 90°, kéo tay nắm chỉnh độ cong',
      icon: '<path d="M2 20c10 0 18-6 18-17M2 12c6 0 10-4 10-9" stroke-width="1.7"></path><path d="M2 16c8 0 14-5 14-13" stroke-dasharray="3 3"></path>' },
    { id: 'bridge', name: 'Cầu', desc: 'Đường đi qua cầu ở giữa (đặt tên cầu khi chọn)',
      icon: '<path d="M2 9h5M17 9h5M2 15h5M17 15h5"></path><rect x="7" y="7" width="10" height="10"></rect><path d="M9 7v10M15 7v10"></path>' }
  ];

  function plainBounds() {
    if (typeof getSceneDrawingAreaBounds === 'function') return getSceneDrawingAreaBounds();
    return { x: 21.6, y: 86.6, width: 796.8, height: 471.8 };
  }

  function newId() {
    return typeof genShapeId === 'function' ? genShapeId() : 's' + Math.random().toString(36).slice(2, 9);
  }

  // Trả về mảng shape (chưa thêm vào bản vẽ). style = { color, width }.
  function buildSample(sampleId, style, bounds) {
    const area = bounds || plainBounds();
    const color = (style && style.color) || '#000000';
    const width = Math.max(0.5, (style && Number(style.width)) || 1.5);
    const margin = 14;
    const left = area.x + margin, right = area.x + area.width - margin;
    const top = area.y + margin, bottom = area.y + area.height - margin;
    const cx = Math.round(area.x + area.width / 2), cy = Math.round(area.y + area.height / 2);
    const groupId = 'sample_' + sampleId + '_' + newId();
    const shapes = [];
    const line = (type, x1, y1, x2, y2) => shapes.push({ id: newId(), type, x1, y1, x2, y2, color, width, groupId, sampleType: sampleId });
    const edge = (x1, y1, x2, y2) => line('road_line', x1, y1, x2, y2);
    const center = (x1, y1, x2, y2) => line('road_dashed', x1, y1, x2, y2);
    const curve = (type, x1, y1, cxp, cyp, x2, y2) => shapes.push({ id: newId(), type, x1, y1, x2, y2, cx: cxp, cy: cyp, color, width, groupId, sampleType: sampleId, hasArrow: false });

    if (sampleId === 'straight') {
      edge(left, cy - HALF_ROAD, right, cy - HALF_ROAD);
      edge(left, cy + HALF_ROAD, right, cy + HALF_ROAD);
      center(left, cy, right, cy);
    } else if (sampleId === 'crossroad') {
      const armY = Math.min(cy - top, bottom - cy), armX = Math.min(cx - left, right - cx);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        edge(cx + sx * HALF_ROAD, cy + sy * HALF_ROAD, cx + sx * armX, cy + sy * HALF_ROAD);   // mép ngang
        edge(cx + sx * HALF_ROAD, cy + sy * HALF_ROAD, cx + sx * HALF_ROAD, cy + sy * armY);   // mép dọc
      }
      for (const s of [-1, 1]) {
        center(cx + s * CENTER_GAP, cy, cx + s * armX, cy);
        center(cx, cy + s * CENTER_GAP, cx, cy + s * armY);
      }
    } else if (sampleId === 't_junction') {
      const mainY = Math.round(area.y + area.height * 0.32);
      edge(left, mainY - HALF_ROAD, right, mainY - HALF_ROAD);                       // mép trên liền
      edge(left, mainY + HALF_ROAD, cx - HALF_ROAD, mainY + HALF_ROAD);              // mép dưới bên trái nhánh
      edge(cx + HALF_ROAD, mainY + HALF_ROAD, right, mainY + HALF_ROAD);             // mép dưới bên phải nhánh
      edge(cx - HALF_ROAD, mainY + HALF_ROAD, cx - HALF_ROAD, bottom);               // mép nhánh
      edge(cx + HALF_ROAD, mainY + HALF_ROAD, cx + HALF_ROAD, bottom);
      center(left, mainY, right, mainY);
      center(cx, mainY + CENTER_GAP, cx, bottom);
    } else if (sampleId === 'curve') {
      // Cua gần 90°: đường tim đi từ mép trái lên mép trên; hai mép là đường cong song song (lệch ± nửa bề rộng).
      const x0 = left, y0 = Math.round(bottom - 40);
      const x2 = Math.round(right - 160), y2 = top;
      curve('curve', x0, y0 - HALF_ROAD, x2 - HALF_ROAD, y0 - HALF_ROAD, x2 - HALF_ROAD, y2);
      curve('curve', x0, y0 + HALF_ROAD, x2 + HALF_ROAD, y0 + HALF_ROAD, x2 + HALF_ROAD, y2);
      curve('curve_dashed', x0, y0, x2, y0, x2, y2);
    } else if (sampleId === 'bridge') {
      const bridgeW = 300;
      const bx = Math.round(cx - bridgeW / 2);
      edge(left, cy - BRIDGE_HALF, bx, cy - BRIDGE_HALF);
      edge(left, cy + BRIDGE_HALF, bx, cy + BRIDGE_HALF);
      edge(bx + bridgeW, cy - BRIDGE_HALF, right, cy - BRIDGE_HALF);
      edge(bx + bridgeW, cy + BRIDGE_HALF, right, cy + BRIDGE_HALF);
      center(left, cy, bx, cy);
      center(bx + bridgeW, cy, right, cy);
      shapes.push({ id: newId(), type: 'bridge', startX: bx, startY: cy, angle: 0, objectW: bridgeW, objectH: bridgeW * 0.22,
        color, width, sizeScale: 1, groupId, sampleType: sampleId });
    } else {
      return [];
    }
    return shapes;
  }

  function getStyle() {
    const doc = root.document;
    const colorInput = doc && doc.getElementById('drawColorPicker');
    const widthInput = doc && doc.getElementById('drawStrokeWidth');
    return { color: (colorInput && colorInput.value) || '#000000', width: Number(widthInput && widthInput.value) || 1.5 };
  }

  function sampleById(id) { return SAMPLES.find(sample => sample.id === id) || null; }

  function insertSample(sampleId) {
    const sample = sampleById(sampleId);
    if (!sample || typeof sceneShapes === 'undefined') return false;
    const shapes = buildSample(sampleId, getStyle());
    if (!shapes.length) return false;
    // Nền đường nằm dưới xe/biển báo đã có (cùng quy ước với preset ngã tư).
    sceneShapes.unshift(...shapes);
    if (typeof setSelectedShapes === 'function') setSelectedShapes(shapes.map(shape => shape.id));
    if (typeof saveDrawingState === 'function') saveDrawingState();
    if (typeof setActiveDrawTool === 'function') setActiveDrawTool('select');
    if (typeof redrawSceneCanvas === 'function') redrawSceneCanvas(true);
    if (typeof showToast === 'function') showToast('Đã chèn mẫu "' + sample.name + '". Kéo để di chuyển, hoặc "Rã nhóm" để sửa từng nét.', 'success');
    return true;
  }

  // ---- Giao diện: bảng chọn mẫu (cùng kiểu với ô tìm công cụ) ----
  function escapeHtml(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function closePanel() {
    const panel = root.document && root.document.getElementById('sceneSamplesPanel');
    if (panel) panel.hidden = true;
  }

  function ensurePanel() {
    const doc = root.document;
    let panel = doc.getElementById('sceneSamplesPanel');
    if (panel) return panel;
    panel = doc.createElement('div');
    panel.id = 'sceneSamplesPanel';
    panel.className = 'scene-tool-search-panel scene-samples-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Sơ đồ mẫu');
    panel.innerHTML = '<div class="scene-tool-search-hint scene-samples-title">Sơ đồ mẫu — chèn nền đường để vẽ tiếp</div>' +
      '<div class="scene-tool-search-list" role="menu">' + SAMPLES.map(sample =>
        '<button type="button" role="menuitem" class="scene-tool-search-item" data-sample="' + escapeHtml(sample.id) + '">' +
        '<span class="scene-tool-search-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + sample.icon + '</svg></span>' +
        '<span class="scene-tool-search-text"><b>' + escapeHtml(sample.name) + '</b><small>' + escapeHtml(sample.desc) + '</small></span></button>').join('') + '</div>' +
      '<div class="scene-tool-search-foot">Mẫu nằm dưới các đối tượng đã vẽ · <kbd>Ctrl</kbd>+<kbd>Z</kbd> hoàn tác · <kbd>Esc</kbd> đóng</div>';
    (doc.getElementById('sceneDrawingModalOverlay') || doc.body).appendChild(panel);
    panel.addEventListener('click', event => {
      const row = event.target.closest && event.target.closest('[data-sample]');
      if (!row) return;
      closePanel();
      insertSample(row.dataset.sample);
    });
    panel.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); closePanel(); }
    });
    doc.addEventListener('mousedown', event => {
      if (!panel.hidden && !panel.contains(event.target) && !(event.target.closest && event.target.closest('#toolBtnSamples'))) closePanel();
    });
    return panel;
  }

  function openPanel() {
    const doc = root.document;
    if (!doc) return false;
    if (typeof closeAllToolSubmenus === 'function') closeAllToolSubmenus();
    if (root.SceneToolbarUI && root.SceneToolbarUI.closeSearch) root.SceneToolbarUI.closeSearch();
    const panel = ensurePanel();
    const rail = doc.getElementById('sceneToolRail');
    const rect = rail ? rail.getBoundingClientRect() : { right: 70, top: 80 };
    panel.style.left = Math.round(rect.right + 10) + 'px';
    panel.style.top = Math.max(12, Math.round(rect.top + 8)) + 'px';
    panel.hidden = false;
    const first = panel.querySelector('.scene-tool-search-item');
    if (first) first.focus();
    return true;
  }

  function init() {
    const doc = root.document;
    if (!doc) return;
    const btn = doc.getElementById('toolBtnSamples');
    if (btn) btn.addEventListener('click', event => { event.stopPropagation(); openPanel(); });
  }

  root.SceneSamples = { SAMPLES, buildSample, insertSample, openPanel, closePanel, init };

  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
