// Khung Zalo Web trong app (cùng kiểu cửa sổ chat AI): nhúng chat.zalo.me bằng iframe, tải lười ở lần mở đầu và giữ nguyên
// khi đóng để không mất kết nối. Nếu Zalo từ chối hiển thị trong khung (khung trắng), dùng nút "Đăng nhập trong cửa sổ riêng"
// hoặc "Mở cửa sổ nổi" (ZaloWindow) ở chân khung. Không đọc hay lưu bất kỳ dữ liệu nào của Zalo.
const ZaloPanel = (() => {
  const URL = 'https://chat.zalo.me/';
  let loaded = false, watcher = null;
  const panel = () => document.getElementById('tasco-zalo-panel');
  const frame = () => document.getElementById('tasco-zalo-frame');
  const isOpen = () => !!panel()?.classList.contains('active');

  function sync() {
    const open = isOpen(), button = document.getElementById('tasco-zalo-btn');
    if (button) { button.classList.toggle('is-active', open); button.setAttribute('aria-pressed', String(open)); button.setAttribute('aria-expanded', String(open)); }
  }
  function load(force) {
    const element = frame();
    if (!element || (loaded && !force)) return;
    element.src = URL;
    loaded = true;
  }
  function open() {
    if (!panel()) return;
    // Trợ lý AI và Zalo dùng chung vị trí góc phải: mở cái này thì đóng cái kia.
    if (document.getElementById('tasco-ai-panel')?.classList.contains('active') && typeof toggleTascoAI === 'function') toggleTascoAI();
    panel().classList.add('active');
    load(false);
    sync();
  }
  function close() { panel()?.classList.remove('active'); sync(); }
  const toggle = () => (isOpen() ? close() : open());
  // Đặt lại địa chỉ để tải lại; chờ một nhịp để trình duyệt thật sự điều hướng lại khi trùng địa chỉ cũ.
  function reload() {
    const element = frame();
    if (!element) return;
    element.src = 'about:blank';
    loaded = true;
    setTimeout(() => { element.src = URL; }, 60);
  }
  // Mở trang đăng nhập/Zalo ở cửa sổ riêng (Zalo không hiển thị trang đăng nhập trong khung nhúng); đóng cửa sổ xong thì khung tự tải lại.
  function login() {
    const win = typeof ZaloWindow !== 'undefined' ? ZaloWindow.open() : null;
    if (!win) return;
    clearInterval(watcher);
    watcher = setInterval(() => { if (win.closed) { clearInterval(watcher); watcher = null; reload(); } }, 1000);
  }
  // Chuyển sang cửa sổ riêng: dừng khung nhúng để tránh hai kết nối Zalo cùng lúc.
  function detach() {
    const element = frame();
    if (element) element.src = 'about:blank';
    loaded = false;
    close();
    if (typeof ZaloWindow !== 'undefined') ZaloWindow.open();
  }

  document.addEventListener('click', event => {
    const target = event.target.closest?.('[data-zalo-action]');
    if (!target) return;
    const action = target.dataset.zaloAction;
    if (action === 'reload') reload(); else if (action === 'close') close(); else if (action === 'detach') detach(); else if (action === 'login') login();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && isOpen() && panel().contains(document.activeElement)) close(); });

  return {open, close, toggle, reload, login, detach, isOpen, URL};
})();
