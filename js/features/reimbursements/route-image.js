// Ảnh lộ trình đi hiện trường: ghép các ô bản đồ OpenStreetMap + vẽ đường đi, ghim A (xuất phát) / B (hiện trường) lên canvas để lưu và in.
// Phần thuần (project / fit / tiles / toPixel) không dùng DOM nên kiểm thử được (tests/route-image.test.mjs); render() cần trình duyệt.
// Không chụp màn hình bản đồ Leaflet (dễ lệch lớp SVG/ transform) mà tự vẽ lại từ cùng toạ độ → ảnh ổn định, cùng kích thước mọi máy.
const FieldRouteImage = (() => {
  const TILE = 256;
  const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
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
  function tiles(view) {
    const n = 2 ** view.zoom, list = [];
    const x0 = Math.floor(view.originX / TILE), x1 = Math.floor((view.originX + view.width - 1) / TILE);
    const y0 = Math.floor(view.originY / TILE), y1 = Math.floor((view.originY + view.height - 1) / TILE);
    for (let y = y0; y <= y1; y++) {
      if (y < 0 || y >= n) continue;
      for (let x = x0; x <= x1; x++) {
        const wrapped = ((x % n) + n) % n;
        list.push({z:view.zoom,x:wrapped,y,dx:x * TILE - view.originX,dy:y * TILE - view.originY,url:TILE_URL.replace('{z}',view.zoom).replace('{x}',wrapped).replace('{y}',y)});
      }
    }
    return list;
  }

  // ---------- Phần cần trình duyệt ----------
  function loadTile(tile, timeoutMs) {
    return new Promise(resolve => {
      const image = new Image(), timer = setTimeout(() => { image.src = ''; resolve(null); }, timeoutMs);
      image.crossOrigin = 'anonymous';   // OSM trả CORS: * → canvas không bị "tainted", còn xuất được ảnh
      image.onload = () => { clearTimeout(timer); resolve(image); };
      image.onerror = () => { clearTimeout(timer); resolve(null); };
      image.src = tile.url;
    });
  }
  const trim = (text, max) => { const value = String(text ?? '').replace(/\s+/g,' ').trim(); return value.length > max ? value.slice(0,max - 1) + '…' : value; };
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r,y); ctx.arcTo(x + w,y,x + w,y + h,r); ctx.arcTo(x + w,y + h,x,y + h,r); ctx.arcTo(x,y + h,x,y,r); ctx.arcTo(x,y,x + w,y,r); ctx.closePath();
  }

  // route: {coords:[[lat,lon],…], estimated}; from/to: {lat,lon,label}. Trả về canvas.
  async function render({coords = [], from, to, estimated = false, width = 1200, height = 760, tileTimeout = 9000} = {}) {
    if (!valid(from) || !valid(to)) throw new Error('Thiếu điểm xuất phát hoặc hiện trường.');
    const line = (coords.length ? coords : [[from.lat,from.lon],[to.lat,to.lon]]).map(point => ({lat:point[0],lon:point[1]}));
    const view = fit([...line,from,to],width,height);
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e8e4da'; ctx.fillRect(0,0,width,height);

    const list = tiles(view), images = await Promise.all(list.map(tile => loadTile(tile,tileTimeout)));
    let loaded = 0;
    images.forEach((image, index) => { if (image) { ctx.drawImage(image,list[index].dx,list[index].dy,TILE,TILE); loaded++; } });
    if (!loaded) throw new Error('Không tải được ô bản đồ (mạng bị chặn?).');

    // Đường đi: viền trắng dày + nét màu; ước tính (không có chỉ đường) vẽ nét đứt.
    const path = () => { ctx.beginPath(); line.forEach((p, i) => { const at = toPixel(view,p.lat,p.lon); i ? ctx.lineTo(at.x,at.y) : ctx.moveTo(at.x,at.y); }); };
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.setLineDash([]); path(); ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 11; ctx.stroke();
    ctx.setLineDash(estimated ? [16,12] : []); path(); ctx.strokeStyle = '#c2410c'; ctx.lineWidth = 6; ctx.stroke(); ctx.setLineDash([]);

    // Ghim + nhãn.
    const pin = (point, letter, color, caption, side) => {
      const at = toPixel(view,point.lat,point.lon);
      ctx.beginPath(); ctx.arc(at.x,at.y,17,0,Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '700 18px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(letter,at.x,at.y + 1);
      const text = trim(caption,46); if (!text) return;
      ctx.font = '600 15px Arial, sans-serif'; ctx.textAlign = 'left';
      const w = Math.ceil(ctx.measureText(text).width) + 20, h = 30;
      let x = side === 'right' ? at.x + 26 : at.x - 26 - w, y = at.y - h - 14;
      x = Math.max(8,Math.min(width - w - 8,x)); y = Math.max(8,Math.min(height - h - 8,y));
      roundRect(ctx,x,y,w,h,8); ctx.fillStyle = 'rgba(255,255,255,.96)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.stroke();
      ctx.fillStyle = '#1f2937'; ctx.fillText(text,x + 10,y + h / 2 + 1);
    };
    const eastward = to.lon >= from.lon;
    pin(from,'A','#15803d','Xuất phát: ' + (from.label || ''),eastward ? 'left' : 'right');
    pin(to,'B','#b91c1c','Hiện trường: ' + (to.label || ''),eastward ? 'right' : 'left');

    // Ghi nguồn theo điều khoản OpenStreetMap.
    const credit = '© OpenStreetMap contributors';
    ctx.font = '12px Arial, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const cw = Math.ceil(ctx.measureText(credit).width) + 14;
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(width - cw,height - 22,cw,22);
    ctx.fillStyle = '#374151'; ctx.fillText(credit,width - cw + 7,height - 10);
    return canvas;
  }
  const toBlob = (canvas, type = 'image/jpeg', quality = 0.88) => new Promise((resolve, reject) => {
    try { canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Không xuất được ảnh.')),type,quality); }
    catch (error) { reject(error); }
  });

  return {TILE,TILE_URL,project,fit,toPixel,tiles,render,toBlob};
})();
