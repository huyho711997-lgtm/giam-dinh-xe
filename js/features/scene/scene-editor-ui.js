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
