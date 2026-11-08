// Bộ biểu tượng nét mảnh dành riêng cho nghiệp vụ cứu hộ.
const RescueIcons = (() => {
  const paths = {
    truck:'<path d="M3 17h2m14 0h2v-3l-2.1-3.5a1.5 1.5 0 0 0-1.3-.7H15V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v8"/><path d="M15 10v4h5M7.5 17h7"/><circle cx="6.5" cy="17" r="1.6"/><circle cx="17" cy="17" r="1.6"/><path d="M5.5 9h5m-5 2.5h3"/>',
    crane:'<path d="M3 17h2m3.5 0h5m4 0H21v-3l-2-3h-4V8H9v3H4v4"/><circle cx="6.7" cy="17" r="1.6"/><circle cx="15.5" cy="17" r="1.6"/><path d="m9 8 7-4 1 1-5 5m5-5h2v5m0 0v1a1.4 1.4 0 1 1-1.4 1.4"/>',
    both:'<path d="M2.5 17h2m3 0h4m4 0h2v-3l-2-3h-4V8H3v7"/><circle cx="6" cy="17" r="1.5"/><circle cx="13.5" cy="17" r="1.5"/><path d="m8 8 8-4 1 1-4 4m4-4h2v5m0 0v1a1.4 1.4 0 1 1-1.4 1.4M18 17h3"/>',
    calc:'<rect x="5" y="3" width="14" height="18" rx="2.5"/><rect x="8" y="6" width="8" height="3.5" rx=".7"/><path d="M8.5 13h.01m3.5 0h.01m3.5 0h.01M8.5 16.5h.01m3.5 0h.01m3.5 0h.01" stroke-width="2.4"/>',
    book:'<path d="M4.5 5.5A2.5 2.5 0 0 1 7 3h11.5v15H7a2.5 2.5 0 0 0-2.5 2.5z"/><path d="M4.5 18a2.5 2.5 0 0 0 2.5 2.5h12M8 7h7M8 10.5h6"/>',
    garage:'<path d="m3 10 9-6 9 6v9H3z"/><path d="M7 19v-7h10v7M9.5 15h5M9.5 17h5"/>',
    reset:'<path d="M19.5 8a8 8 0 1 0 .5 7M19.5 4.5V8H16"/><path d="M12 8v4l2.5 1.5"/>',
    clipboard:'<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2M9 12h6M9 15h6"/>',
    copy:'<rect x="8" y="8" width="11.5" height="12" rx="2"/><path d="M15.5 8V6a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2H8M11 12h5.5M11 15h5.5"/>',
    check:'<path d="m5 12 4.5 4.5L19 7"/>',
    shield:'<path d="m12 3 7.5 3v5.5c0 4.3-3.1 7.1-7.5 9.5-4.4-2.4-7.5-5.2-7.5-9.5V6z"/><path d="m8.5 12 2.4 2.4 4.7-5"/>',
    alert:'<path d="M10.4 4.8a1.85 1.85 0 0 1 3.2 0l7 12.1a1.85 1.85 0 0 1-1.6 2.8H5a1.85 1.85 0 0 1-1.6-2.8z"/><path d="M12 9v4.2m0 3.1h.01"/>',
    user:'<circle cx="12" cy="8" r="3.2"/><path d="M5.2 19c.5-3.2 3.2-5.2 6.8-5.2s6.3 2 6.8 5.2"/><path d="m16.5 8.5 1.4 1.4 2.7-2.8"/>',
    receipt:'<path d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8z"/><path d="M9 8h6M9 11h6M9 14h3"/>',
    image:'<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="9.5" r="1.5"/><path d="m4 16.5 4.5-4 3.5 3 3-3 5 4.5"/>',
    pin:'<path d="M12 21s6.5-5.4 6.5-11A6.5 6.5 0 0 0 5.5 10c0 5.6 6.5 11 6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
    globe:'<circle cx="12" cy="12" r="8.5"/><path d="M3.8 12h16.4M12 3.5c2.3 2.3 3.4 5.1 3.4 8.5s-1.1 6.2-3.4 8.5C9.7 18.2 8.6 15.4 8.6 12S9.7 5.8 12 3.5ZM5.7 7.5h12.6m-12.6 9h12.6"/>',
    ruler:'<path d="m4 15 11-11 5 5L9 20z"/><path d="m12 7 2 2m-4.5.5 2 2M7 12l2 2m-4.5.5 2 2"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.3"/><path d="m15.2 15.2 4.2 4.2"/>',
    arrow:'<path d="M4 12h15m-5-5 5 5-5 5"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    edit:'<path d="m5 15.8-.8 4 4-.8L19 8.2 15.8 5z"/><path d="m13.8 7 3.2 3.2M4.2 20h15.6"/>',
    upload:'<path d="M12 15.5V4m-4 4 4-4 4 4M4.5 15v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3"/>',
    file:'<path d="M6 3.5h8l4 4V20H6z"/><path d="M14 3.5V8h4M9 12h6M9 15h6"/>',
    eye:'<path d="M3 12s3.3-6 9-6 9 6 9 6-3.3 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2.6"/>',
    trash:'<path d="M4.5 6.5h15M9 6.5V4h6v2.5M7 6.5l.6 12a1.6 1.6 0 0 0 1.6 1.5h5.6a1.6 1.6 0 0 0 1.6-1.5l.6-12M10 10v6m4-6v6"/>'
  };
  const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || paths.file) + '</svg>';
  const register = controls => controls.registerIcons(Object.fromEntries(Object.entries(paths).map(([name,path]) => ['rescue-' + name,path])));
  return {icon,register};
})();
