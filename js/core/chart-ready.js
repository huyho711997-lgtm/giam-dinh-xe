// Chart.js giờ được tải bằng `defer` (không chặn hiển thị trang). Các hàm vẽ biểu đồ có thể được gọi
// trước khi thư viện sẵn sàng → bọc lại: nếu chưa có Chart thì chờ sự kiện `load` rồi vẽ (một lần).
// Nếu CDN lỗi hẳn thì bỏ qua lặng lẽ thay vì ném "Chart is not defined" làm hỏng cả trang báo cáo.
(function () {
  const pending = new Map(); // tên hàm → đối số lần gọi cuối (chỉ vẽ lại lần mới nhất)
  let waiting = false;
  function flush() {
    if (typeof Chart === 'undefined') return;
    for (const [name, call] of pending) { try { call.fn.apply(call.self, call.args); } catch (error) { console.error(name, error); } }
    pending.clear();
  }
  function wrap(owner, name) {
    const original = owner[name];
    if (typeof original !== 'function' || original.__chartReady) return;
    const wrapped = function (...args) {
      if (typeof Chart !== 'undefined') return original.apply(this, args);
      pending.set(name, { fn: original, self: this, args });
      if (!waiting && document.readyState !== 'complete') { waiting = true; window.addEventListener('load', () => { waiting = false; flush(); }, { once: true }); }
    };
    wrapped.__chartReady = true;
    owner[name] = wrapped;
  }
  ['initCarBrandChart', 'initGdvKpiChart', 'initGarageLossChart', 'initAnnualClaimsChart'].forEach(name => wrap(window, name));
})();
