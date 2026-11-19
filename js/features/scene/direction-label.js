// Ký hiệu "Hướng về …" trên sơ đồ hiện trường: mũi tên + dòng "Hướng về" phía trên + tên nơi đến phía dưới.
// Kéo chuột theo hướng đi (điểm cuối = đầu mũi tên) → nhập tên nơi đến. Bấm đúp để sửa.
// Là đối tượng tuyến tính (x1,y1 → x2,y2) nên dùng chung tay nắm kéo dài, xoay, di chuyển với mũi tên thường.
// Chữ luôn đứng thẳng để đọc: mũi tên chỉ sang trái thì chữ vẫn không bị lộn ngược.

const SCENE_DIRECTION_TYPE = 'direction_label';
const SCENE_DIRECTION_DEFAULT_PREFIX = 'Hướng về';
const SCENE_DIRECTION_FONT_MIN = 10;
const SCENE_DIRECTION_FONT_MAX = 30;

function isSceneDirectionLabel(shape) {
  return !!shape && shape.type === SCENE_DIRECTION_TYPE;
}

function getSceneDirectionFontSize(shape) {
  const size = Number(shape && shape.fontSize);
  return Number.isFinite(size) ? Math.max(SCENE_DIRECTION_FONT_MIN, Math.min(SCENE_DIRECTION_FONT_MAX, size)) : 16;
}

// Nửa bề rộng dải chọn: phủ cả hai dòng chữ để bấm vào chữ cũng chọn được.
function getSceneDirectionHalfBand(shape) {
  const fontSize = getSceneDirectionFontSize(shape);
  return Math.round(fontSize * 1.65 + 4);
}

// Góc đọc được: chữ không bao giờ lộn ngược (giữ trong khoảng -90°..90°).
function getSceneDirectionReadableAngle(x1, y1, x2, y2) {
  let angle = Math.atan2(y2 - y1, x2 - x1);
  if (angle > Math.PI / 2 + 1e-6) angle -= Math.PI;
  else if (angle < -Math.PI / 2 - 1e-6) angle += Math.PI;
  return angle;
}

function drawSceneDirectionLabelRaw(ctx, x1, y1, x2, y2, color, width, prefix, destination, fontSize, dashed) {
  const size = Math.max(SCENE_DIRECTION_FONT_MIN, Math.min(SCENE_DIRECTION_FONT_MAX, fontSize || 16));
  const lineWidth = Math.max(1.2, width || 1.5);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = Math.max(10, size * 0.7);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(dashed ? [6, 5] : []);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x2 - head * Math.cos(angle - Math.PI / 7), y2 - head * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 7), y2 - head * Math.sin(angle + Math.PI / 7));
  ctx.stroke();

  const top = String(prefix == null ? SCENE_DIRECTION_DEFAULT_PREFIX : prefix).trim();
  const bottom = String(destination || '').trim();
  if (top || bottom) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const offset = size * 0.62 + lineWidth / 2 + 3;
    ctx.translate(mx, my);
    ctx.rotate(getSceneDirectionReadableAngle(x1, y1, x2, y2));
    ctx.font = `bold ${size}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (top) ctx.fillText(top, 0, -offset);
    if (bottom) ctx.fillText(bottom, 0, offset);
    else {
      // Chưa nhập nơi đến: chừa chỗ chấm để viết tay khi in.
      ctx.fillText('……………', 0, offset);
    }
  }
  ctx.restore();
}

function drawSceneDirectionLabel(ctx, shape, color, width) {
  drawSceneDirectionLabelRaw(ctx, shape.x1, shape.y1, shape.x2, shape.y2, color || shape.color, width || shape.width,
    shape.prefix, shape.text, getSceneDirectionFontSize(shape), !!shape.dashed);
}

function createSceneDirectionLabel(x1, y1, x2, y2, color, width) {
  return {
    id: genShapeId(),
    type: SCENE_DIRECTION_TYPE,
    x1, y1, x2, y2,
    color, width,
    prefix: SCENE_DIRECTION_DEFAULT_PREFIX,
    text: '',
    fontSize: 16
  };
}


// ---- Hộp nhập hướng ----------------------------------------------------------------------------------------------

let sceneDirectionEditor = null; // { shapeId, isNew, snapshot }

function getSceneDirectionSuggestions(currentId) {
  const names = new Set();
  (sceneShapes || []).forEach(shape => {
    if (isSceneDirectionLabel(shape) && shape.id !== currentId && String(shape.text || '').trim()) names.add(String(shape.text).trim());
  });
  return Array.from(names).slice(0, 6);
}

function escapeSceneDirectionHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function ensureSceneDirectionModal() {
  let overlay = document.getElementById('sceneDirectionModal');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'sceneDirectionModal';
  overlay.className = 'scene-direction-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'sceneDirectionTitle');
  overlay.innerHTML = `
    <div class="sdm-card">
      <div class="sdm-head"><h3 id="sceneDirectionTitle">Hướng đi</h3><button type="button" class="sdm-x" data-sdm="cancel" aria-label="Đóng">×</button></div>
      <canvas class="sdm-preview" width="440" height="110" aria-hidden="true"></canvas>
      <label class="sdm-field"><span>Dòng trên</span><input id="sceneDirectionPrefix" maxlength="40" autocomplete="off"></label>
      <div class="sdm-chips" data-sdm-chips="prefix"></div>
      <label class="sdm-field"><span>Nơi đến (dòng dưới)</span><input id="sceneDirectionText" maxlength="60" autocomplete="off" placeholder="VD: Buôn Hồ, TP. Buôn Ma Thuột, Xã Ea Hleo"></label>
      <div class="sdm-chips" data-sdm-chips="text"></div>
      <div class="sdm-row">
        <label class="sdm-field sdm-size"><span>Cỡ chữ <b id="sceneDirectionSizeValue">16</b> px</span><input id="sceneDirectionSize" type="range" min="${SCENE_DIRECTION_FONT_MIN}" max="${SCENE_DIRECTION_FONT_MAX}" step="1"></label>
        <label class="sdm-check"><input id="sceneDirectionDashed" type="checkbox"> Nét đứt</label>
        <button type="button" class="sdm-btn sdm-ghost" data-sdm="flip" title="Đảo đầu mũi tên sang phía bên kia">⇄ Đảo chiều</button>
      </div>
      <div class="sdm-foot"><button type="button" class="sdm-btn sdm-ghost" data-sdm="cancel">Hủy</button><button type="button" class="sdm-btn sdm-primary" data-sdm="apply">Áp dụng</button></div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', event => {
    const action = event.target.closest('[data-sdm]');
    const chip = event.target.closest('[data-sdm-chip]');
    if (chip) {
      const input = document.getElementById(chip.dataset.sdmChip === 'prefix' ? 'sceneDirectionPrefix' : 'sceneDirectionText');
      input.value = chip.dataset.value;
      previewSceneDirectionEditor();
      input.focus();
      return;
    }
    if (!action) return; // KHÔNG đóng khi bấm ra ngoài: tránh mất dữ liệu đang nhập
    if (action.dataset.sdm === 'apply') applySceneDirectionEditor();
    else if (action.dataset.sdm === 'cancel') closeSceneDirectionEditor(true);
    else if (action.dataset.sdm === 'flip') flipSceneDirectionEditorShape();
  });
  overlay.addEventListener('input', previewSceneDirectionEditor);
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.tagName === 'INPUT' && event.target.type !== 'checkbox') { event.preventDefault(); applySceneDirectionEditor(); }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeSceneDirectionEditor(true); }
  });
  return overlay;
}

function getSceneDirectionEditorShape() {
  return sceneDirectionEditor ? (sceneShapes || []).find(shape => shape.id === sceneDirectionEditor.shapeId) : null;
}

function readSceneDirectionEditor() {
  return {
    prefix: document.getElementById('sceneDirectionPrefix').value.trim(),
    text: document.getElementById('sceneDirectionText').value.trim(),
    fontSize: Number(document.getElementById('sceneDirectionSize').value) || 16,
    dashed: document.getElementById('sceneDirectionDashed').checked
  };
}

function previewSceneDirectionEditor() {
  const overlay = document.getElementById('sceneDirectionModal');
  const shape = getSceneDirectionEditorShape();
  if (!overlay || !shape) return;
  const values = readSceneDirectionEditor();
  document.getElementById('sceneDirectionSizeValue').textContent = String(values.fontSize);
  const canvas = overlay.querySelector('.sdm-preview');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Xem trước luôn nằm ngang theo chiều mũi tên hiện tại (trái/phải).
  const toRight = shape.x2 >= shape.x1;
  const x1 = toRight ? 90 : 350, x2 = toRight ? 350 : 90;
  drawSceneDirectionLabelRaw(ctx, x1, 55, x2, 55, shape.color || '#000', Math.max(1.5, shape.width || 1.5), values.prefix, values.text, values.fontSize * 1.2, values.dashed);
  // Áp lên sơ đồ ngay để thấy vị trí thật.
  Object.assign(shape, values);
  if (typeof redrawSceneCanvas === 'function') redrawSceneCanvas(true);
}

function renderSceneDirectionChips(shape) {
  const overlay = document.getElementById('sceneDirectionModal');
  const chip = (field, value) => `<button type="button" class="sdm-chip" data-sdm-chip="${field}" data-value="${escapeSceneDirectionHtml(value)}">${escapeSceneDirectionHtml(value)}</button>`;
  overlay.querySelector('[data-sdm-chips="prefix"]').innerHTML = ['Hướng về', 'Hướng đi', 'Đi', 'Về phía'].map(v => chip('prefix', v)).join('');
  const names = getSceneDirectionSuggestions(shape.id);
  const box = overlay.querySelector('[data-sdm-chips="text"]');
  box.innerHTML = names.map(v => chip('text', v)).join('');
  box.hidden = !names.length;
}

function openSceneDirectionEditor(shape, isNew) {
  if (!shape) return;
  const overlay = ensureSceneDirectionModal();
  sceneDirectionEditor = { shapeId: shape.id, isNew: !!isNew, snapshot: JSON.parse(JSON.stringify(shape)) };
  document.getElementById('sceneDirectionTitle').textContent = isNew ? 'Thêm hướng đi' : 'Sửa hướng đi';
  document.getElementById('sceneDirectionPrefix').value = shape.prefix == null ? SCENE_DIRECTION_DEFAULT_PREFIX : shape.prefix;
  document.getElementById('sceneDirectionText').value = shape.text || '';
  document.getElementById('sceneDirectionSize').value = String(getSceneDirectionFontSize(shape));
  document.getElementById('sceneDirectionDashed').checked = !!shape.dashed;
  renderSceneDirectionChips(shape);
  overlay.classList.add('open');
  previewSceneDirectionEditor();
  setTimeout(() => document.getElementById('sceneDirectionText')?.focus(), 30);
}

function flipSceneDirectionEditorShape() {
  const shape = getSceneDirectionEditorShape();
  if (!shape) return;
  [shape.x1, shape.x2] = [shape.x2, shape.x1];
  [shape.y1, shape.y2] = [shape.y2, shape.y1];
  previewSceneDirectionEditor();
}

function applySceneDirectionEditor() {
  const shape = getSceneDirectionEditorShape();
  if (shape) Object.assign(shape, readSceneDirectionEditor());
  closeSceneDirectionEditor(false);
  if (shape && typeof saveDrawingState === 'function') saveDrawingState();
}

// cancel=true: trả lại trạng thái trước khi mở; với hướng mới tạo thì xóa luôn.
function closeSceneDirectionEditor(cancel) {
  const overlay = document.getElementById('sceneDirectionModal');
  if (overlay) overlay.classList.remove('open');
  const state = sceneDirectionEditor;
  sceneDirectionEditor = null;
  if (cancel && state) {
    const index = (sceneShapes || []).findIndex(shape => shape.id === state.shapeId);
    if (index >= 0) {
      if (state.isNew) {
        sceneShapes.splice(index, 1);
        if (typeof clearSelection === 'function') clearSelection();
        if (typeof saveDrawingState === 'function') saveDrawingState();
      } else {
        sceneShapes[index] = Object.assign(sceneShapes[index], state.snapshot);
      }
    }
  }
  if (typeof updateSelectionBadge === 'function') updateSelectionBadge();
  if (typeof redrawSceneCanvas === 'function') redrawSceneCanvas(true);
}
