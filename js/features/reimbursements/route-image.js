// Ảnh lộ trình đi hiện trường: ghép các ô bản đồ OpenStreetMap + vẽ đường đi, ghim A (xuất phát) / B (hiện trường) lên canvas để lưu và in.
// Phần thuần (project / fit / tiles / toPixel) không dùng DOM nên kiểm thử được (tests/route-image.test.mjs); render() cần trình duyệt.
// Không chụp màn hình bản đồ Leaflet (dễ lệch lớp SVG/ transform) mà tự vẽ lại từ cùng toạ độ → ảnh ổn định, cùng kích thước mọi máy.
const FieldRouteImage = (() => {
  const TILE = 256;
  // Nền đường phố kiểu Google (Esri World Street Map, không cần API key); lỗi thì tự chuyển sang OpenStreetMap.
  const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
  const FALLBACK_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const MAX_LAT = 85.0511287798;
  const valid = point => point && Number.isFinite(point.lat) && Number.isFinite(point.lon) && Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180;
  const clampLat = lat => Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));

  // Toạ độ → điểm ảnh trên "bản đồ thế giới" ở mức zoom z (Web Mercator, ô 256 px).
  function project(lat, lon, zoom) {
    const scale = TILE * 2 ** zoom, sin = Math.sin(clampLat(lat) * Math.PI / 180);
    return {x:(lon + 180) / 360 * scale, y:(0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale};
  }

  // Chọn mức zoom lớn nhất mà toàn bộ các điểm còn nằm gọn trong khung width×height (chừa lề pad).
  function fit(points, width, height, {pad = 90, maxZoom = 17} = {}) {
    const list = (points || []).filter(valid);
    if (!list.length) return null;
    const lats = list.map(p => p.lat), lons = list.map(p => p.lon);
    const box = {minLat:Math.min(...lats),maxLat:Math.max(...lats),minLon:Math.min(...lons),maxLon:Math.max(...lons)};
    let zoom = 0;
    for (let z = maxZoom; z >= 0; z--) {
      const nw = project(box.maxLat,box.minLon,z), se = project(box.minLat,box.maxLon,z);
      if (se.x - nw.x <= width - 2 * pad && se.y - nw.y <= height - 2 * pad) { zoom = z; break; }
    }
    const nw = project(box.maxLat,box.minLon,zoom), se = project(box.minLat,box.maxLon,zoom);
    return {zoom,width,height,originX:(nw.x + se.x) / 2 - width / 2,originY:(nw.y + se.y) / 2 - height / 2};
  }
  const toPixel = (view, lat, lon) => { const p = project(lat,lon,view.zoom); return {x:p.x - view.originX,y:p.y - view.originY}; };

  // Các ô bản đồ phủ kín khung nhìn, kèm vị trí vẽ (dx, dy) trên canvas.
  const fill = (template, z, x, y) => template.replace('{z}',z).replace('{x}',x).replace('{y}',y);
  function tiles(view) {
    const n = 2 ** view.zoom, list = [];
    const x0 = Math.floor(view.originX / TILE), x1 = Math.floor((view.originX + view.width - 1) / TILE);
    const y0 = Math.floor(view.originY / TILE), y1 = Math.floor((view.originY + view.height - 1) / TILE);
    for (let y = y0; y <= y1; y++) {
      if (y < 0 || y >= n) continue;
      for (let x = x0; x <= x1; x++) {
        const wrapped = ((x % n) + n) % n;
        list.push({z:view.zoom,x:wrapped,y,dx:x * TILE - view.originX,dy:y * TILE - view.originY,url:fill(TILE_URL,view.zoom,wrapped,y),url2:fill(FALLBACK_TILE_URL,view.zoom,wrapped,y)});
      }
    }
    return list;
  }

  // ---------- Phần cần trình duyệt ----------
  function loadTile(tile, timeoutMs) {
    return loadOne(tile.url,timeoutMs).then(image => image || (tile.url2 ? loadOne(tile.url2,timeoutMs) : null));
  }
  function loadOne(url, timeoutMs) {
    return new Promise(resolve => {
      const image = new Image(), timer = setTimeout(() => { image.src = ''; resolve(null); }, timeoutMs);
      image.crossOrigin = 'anonymous';   // OSM trả CORS: * → canvas không bị "tainted", còn xuất được ảnh
      image.onload = () => { clearTimeout(timer); resolve(image); };
      image.onerror = () => { clearTimeout(timer); resolve(null); };
      image.src = url;
    });
  }
  const trim = (text, max) => { const value = String(text ?? '').replace(/\s+/g,' ').trim(); return value.length > max ? value.slice(0,max - 1) + '…' : value; };
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r,y); ctx.arcTo(x + w,y,x + w,y + h,r); ctx.arcTo(x + w,y + h,x,y + h,r); ctx.arcTo(x,y + h,x,y,r); ctx.arcTo(x,y,x + w,y,r); ctx.closePath();
  }

  const fmtKm = value => Number(value).toLocaleString('vi-VN',{minimumFractionDigits:1,maximumFractionDigits:1});
  const fmtMin = minutes => minutes < 60 ? Math.max(1,Math.round(minutes)) + ' phút' : Math.floor(minutes / 60) + ' giờ ' + String(Math.round(minutes % 60)).padStart(2,'0') + ' phút';
  // Điểm nằm ở nửa chiều dài đường (để đặt nhãn "48 phút · 35,2 km" như Google Maps).
  function midpoint(points) {
    if (points.length < 2) return points[0] || {x:0,y:0};
    let total = 0; const seg = [];
    for (let i = 1; i < points.length; i++) { const d = Math.hypot(points[i].x - points[i - 1].x,points[i].y - points[i - 1].y); seg.push(d); total += d; }
    let rest = total / 2;
    for (let i = 0; i < seg.length; i++) {
      if (rest <= seg[i] || i === seg.length - 1) { const t = seg[i] ? Math.min(1,rest / seg[i]) : 0; return {x:points[i].x + (points[i + 1].x - points[i].x) * t,y:points[i].y + (points[i + 1].y - points[i].y) * t}; }
      rest -= seg[i];
    }
    return points[0];
  }

  // route: {coords:[[lat,lon],…], estimated}; from/to: {lat,lon,label}; km/min: hiện trên nhãn giữa đường. Trả về canvas (kích thước width*scale).
  async function render({coords = [], from, to, estimated = false, km = null, min = null, width = 1200, height = 760, scale = 2, tileTimeout = 9000} = {}) {
    if (!valid(from) || !valid(to)) throw new Error('Thiếu điểm xuất phát hoặc hiện trường.');
    const line = (coords.length ? coords : [[from.lat,from.lon],[to.lat,to.lon]]).map(point => ({lat:point[0],lon:point[1]}));
    const view = fit([...line,from,to],width,height,{pad:110});
    const canvas = document.createElement('canvas'); canvas.width = width * scale; canvas.height = height * scale;
    const ctx = canvas.getContext('2d'); ctx.scale(scale,scale);
    ctx.fillStyle = '#e8eaed'; ctx.fillRect(0,0,width,height);

    const list = tiles(view), images = await Promise.all(list.map(tile => loadTile(tile,tileTimeout)));
    let loaded = 0;
    images.forEach((image, index) => { if (image) { ctx.drawImage(image,list[index].dx,list[index].dy,TILE,TILE); loaded++; } });
    if (!loaded) throw new Error('Không tải được ô bản đồ (mạng bị chặn?).');

    // Đường đi kiểu Google: nét xanh #4285F4 có viền xanh đậm; ước tính (không có chỉ đường) vẽ nét đứt.
    const pixels = line.map(p => toPixel(view,p.lat,p.lon));
    const path = () => { ctx.beginPath(); pixels.forEach((at, i) => i ? ctx.lineTo(at.x,at.y) : ctx.moveTo(at.x,at.y)); };
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.setLineDash([]);
    path(); ctx.strokeStyle = '#1a56b8'; ctx.lineWidth = 10; ctx.stroke();
    ctx.setLineDash(estimated ? [14,10] : []); path(); ctx.strokeStyle = '#4285f4'; ctx.lineWidth = 6.5; ctx.stroke(); ctx.setLineDash([]);

    const card = (x, y, text, {border = '#dadce0',color = '#202124',font = '600 15px Arial, sans-serif'} = {}) => {
      ctx.font = font; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const w = Math.ceil(ctx.measureText(text).width) + 22, h = 30;
      x = Math.max(8,Math.min(width - w - 8,x)); y = Math.max(8,Math.min(height - h - 8,y));
      ctx.save(); ctx.shadowColor = 'rgba(60,64,67,.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
      roundRect(ctx,x,y,w,h,8); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
      roundRect(ctx,x,y,w,h,8); ctx.lineWidth = 1.5; ctx.strokeStyle = border; ctx.stroke();
      ctx.fillStyle = color; ctx.fillText(text,x + 11,y + h / 2 + 1);
    };

    // Nhãn thời gian · km giữa đường.
    if (Number.isFinite(km)) {
      const mid = midpoint(pixels), text = (Number.isFinite(min) ? fmtMin(min) + ' · ' : '') + fmtKm(km) + ' km';
      card(mid.x - 52,mid.y - 15,text,{border:'#4285f4',color:'#1a56b8',font:'700 15px Arial, sans-serif'});
    }
    // A: chấm tròn xuất phát (trắng viền xanh); B: ghim đỏ đích đến.
    const a = toPixel(view,from.lat,from.lon), b = toPixel(view,to.lat,to.lon);
    ctx.beginPath(); ctx.arc(a.x,a.y,11,0,Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#4285f4'; ctx.stroke();
    const r = 15, h = 38;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.bezierCurveTo(b.x - r * .45,b.y - h * .42,b.x - r,b.y - h * .6,b.x - r,b.y - h + r);
    ctx.arc(b.x,b.y - h + r,r,Math.PI,0); ctx.bezierCurveTo(b.x + r,b.y - h * .6,b.x + r * .45,b.y - h * .42,b.x,b.y); ctx.closePath();
    ctx.fillStyle = '#ea4335'; ctx.fill(); ctx.restore(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#b31412'; ctx.stroke();
    ctx.beginPath(); ctx.arc(b.x,b.y - h + r,5.5,0,Math.PI * 2); ctx.fillStyle = '#7f0f0d'; ctx.fill();
    const east = to.lon >= from.lon, cap = (prefix, label) => trim(prefix + (label || ''),44);
    ctx.font = '600 15px Arial, sans-serif';
    const ta = cap('A · Xuất phát: ',from.label), tb = cap('B · Hiện trường: ',to.label);
    const wa = Math.ceil(ctx.measureText(ta).width) + 22, wb = Math.ceil(ctx.measureText(tb).width) + 22;
    card(east ? a.x - 20 - wa : a.x + 20,a.y + 10,ta,{border:'#4285f4'});
    card(east ? b.x + 22 : b.x - 22 - wb,b.y - h - 6,tb,{border:'#ea4335'});

    // Ghi nguồn theo điều khoản OpenStreetMap / CARTO.
    const credit = '© Esri, HERE, Garmin, © OpenStreetMap contributors';
    ctx.font = '11px Arial, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const cw = Math.ceil(ctx.measureText(credit).width) + 14;
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(width - cw,height - 20,cw,20);
    ctx.fillStyle = '#5f6368'; ctx.fillText(credit,width - cw + 7,height - 9);
    return canvas;
  }
  const toBlob = (canvas, type = 'image/jpeg', quality = 0.88) => new Promise((resolve, reject) => {
    try { canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Không xuất được ảnh.')),type,quality); }
    catch (error) { reject(error); }
  });

  return {TILE,TILE_URL,FALLBACK_TILE_URL,project,fit,toPixel,tiles,midpoint,render,toBlob};
})();
