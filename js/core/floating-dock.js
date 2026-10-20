
  function syncTascoFloatingDock() {
    const btn = document.getElementById('scrollToTopBtn');
    const shouldShowScrollAction = window.scrollY > 300;
    if (btn) btn.classList.toggle('visible', shouldShowScrollAction);
    document.documentElement.classList.toggle('tasco-scroll-action-visible', shouldShowScrollAction);
  }
  window.addEventListener('scroll', syncTascoFloatingDock, { passive: true });
  window.addEventListener('load', syncTascoFloatingDock, { once: true });
