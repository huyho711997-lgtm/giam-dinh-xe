// Chạy bên trong khung Zalo được nhúng: xin quyền lưu trữ (IndexedDB/cookie) qua Storage Access API.
// Trình duyệt chỉ cấp khi người dùng tự bấm trong khung, nên hiện một nút nhỏ; cấp xong thì tải lại khung.
(() => {
  if (window.top === window || !document.requestStorageAccess || !document.hasStorageAccess) return;
  const ask = async () => {
    try { await document.requestStorageAccess(); return true; } catch (_) { return false; }
  };
  const show = () => {
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;display:flex;gap:8px;align-items:center;justify-content:space-between;padding:8px 10px;background:#fff7e6;border:1px solid #e0b455;border-radius:10px;font:13px system-ui,sans-serif;color:#5b4300;box-shadow:0 4px 14px rgba(0,0,0,.18)';
    const text = document.createElement('span');
    text.textContent = 'Zalo cần quyền lưu dữ liệu trong khung này.';
    const button = document.createElement('button');
    button.textContent = 'Cho phép';
    button.style.cssText = 'border:0;border-radius:8px;padding:6px 12px;background:#0068ff;color:#fff;font-weight:600;cursor:pointer';
    button.onclick = async () => { if (await ask()) location.reload(); else text.textContent = 'Trình duyệt từ chối. Bật cookie bên thứ ba cho zalo.me hoặc dùng cửa sổ nổi.'; };
    bar.append(text, button);
    document.documentElement.appendChild(bar);
  };
  document.hasStorageAccess().then(has => { if (!has) (document.body ? show() : addEventListener('DOMContentLoaded', show)); }).catch(() => {});
})();
