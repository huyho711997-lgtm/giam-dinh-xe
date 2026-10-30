// Cửa sổ nổi Zalo Web: Zalo không cho nhúng vào trang khác (khung nhúng hiển thị trắng), nên mở chat.zalo.me
// trong một cửa sổ riêng kích thước nhỏ ở góc màn hình. Nhấn lại nút khi cửa sổ đang mở thì đưa nó lên trước.
// Đăng nhập Zalo thực hiện ngay trong cửa sổ đó (app không nhận hay lưu bất kỳ thông tin đăng nhập nào).
const ZaloWindow = (() => {
  const URL = 'https://chat.zalo.me/', NAME = 'tasco_zalo_web', WIDTH = 440, HEIGHT = 720, MARGIN = 16, MIN_WIDTH = 320, MIN_HEIGHT = 420;
  let popup = null, timer = null;

  // Tính vị trí cửa sổ nổi: góc phải-dưới của vùng làm việc (trừ thanh tác vụ), không vượt quá màn hình nhỏ.
  function features(screenInfo = {}, width = WIDTH, height = HEIGHT) {
    const availWidth = Number(screenInfo.availWidth) || 1280, availHeight = Number(screenInfo.availHeight) || 800;
    const left0 = Number(screenInfo.availLeft) || 0, top0 = Number(screenInfo.availTop) || 0;
    const w = Math.max(MIN_WIDTH, Math.min(width, availWidth - MARGIN * 2));
    const h = Math.max(MIN_HEIGHT, Math.min(height, availHeight - MARGIN * 2));
    const left = Math.max(left0, left0 + availWidth - w - MARGIN), top = Math.max(top0, top0 + availHeight - h - MARGIN);
    return 'popup=yes,width=' + w + ',height=' + h + ',left=' + left + ',top=' + top + ',resizable=yes,scrollbars=yes';
  }

  const isOpen = () => !!popup && !popup.closed;
  function syncButton() {
    const button = document.getElementById('tasco-zalo-btn');
    if (button) { button.classList.toggle('is-active', isOpen()); button.setAttribute('aria-pressed', String(isOpen())); }
    if (!isOpen()) { clearInterval(timer); timer = null; popup = null; }
  }

  function open() {
    if (isOpen()) { try { popup.focus(); } catch (_) { /* bỏ qua */ } syncButton(); return popup; }
    // Mở trang trắng rồi ngắt liên kết opener trước khi chuyển tới Zalo: Zalo không thể điều khiển lại app này.
    const win = window.open('about:blank', NAME, features(window.screen));
    if (!win) {
      if (typeof triggerToast === 'function') triggerToast('Trình duyệt đã chặn cửa sổ Zalo. Hãy cho phép cửa sổ bật lên (pop-up) cho trang này rồi thử lại.', 'warning');
      return null;
    }
    try { win.opener = null; } catch (_) { /* bỏ qua */ }
    win.location.href = URL;
    popup = win;
    clearInterval(timer);
    timer = setInterval(syncButton, 1500);
    syncButton();
    return win;
  }

  return {open, isOpen, features, URL};
})();
