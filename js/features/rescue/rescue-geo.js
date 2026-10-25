// Tính quãng đường cứu hộ theo định vị: khoảng cách, gara gần nhất, lộ trình đường bộ (OSRM), tìm địa chỉ (Nominatim).
// Phần thuần (không DOM) để kiểm thử: các hàm nhận `fetch` qua createClient() nên test dùng fetch giả (tests/rescue-geo.test.mjs).
const RescueGeo = (() => {
  const ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving/';  // dịch vụ công cộng, chỉ phù hợp mức dùng nhẹ; production nên tự host
  const GEOCODE_URL = 'https://nominatim.openstreetmap.org/';
  const STRAIGHT_FACTOR = 1.3;        // dự phòng khi không gọi được OSRM: đường chim bay × 1,3
  const FALLBACK_SPEED_KMH = 40;
  const NOMINATIM_GAP_MS = 1100;      // Nominatim: tối đa 1 yêu cầu / giây
  const CANDIDATES = 3;               // số gara gần nhất (chim bay) được đo lại bằng đường bộ

  const COORD_RE = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;
  const validCoord = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  const normalize = text => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/gi,'d').toLowerCase().trim();
  const number = value => { const text = String(value ?? '').trim().replace(',','.'); return text === '' || !/^-?\d+(\.\d+)?$/.test(text) ? NaN : Number(text); };

  function parseCoord(text) {
    const match = String(text ?? '').match(COORD_RE);
    if (!match) return null;
    const lat = Number(match[1]), lon = Number(match[2]);
    return validCoord(lat,lon) ? {lat,lon} : null;
  }
  function haversine(a, b) {
    const rad = value => value * Math.PI / 180, dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.min(1,Math.sqrt(h)));
  }
  function estimate(a, b) {
    const km = haversine(a,b) * STRAIGHT_FACTOR;
    return {km,min:km / FALLBACK_SPEED_KMH * 60,coords:[[a.lat,a.lon],[b.lat,b.lon]],estimated:true};
  }
  const fmtKm = value => Number(value).toLocaleString('vi-VN',{minimumFractionDigits:1,maximumFractionDigits:2});
  const fmtDuration = minutes => minutes < 1 ? '<1 phút' : minutes < 60 ? Math.round(minutes) + ' phút' : Math.floor(minutes / 60) + ' giờ ' + String(Math.round(minutes % 60)).padStart(2,'0') + ' phút';

  // Chuẩn hóa một bản ghi gara (từ form hoặc Firebase). Sai tên / toạ độ → null.
  function sanitizeGarage(raw, id) {
    if (!raw || typeof raw !== 'object') return null;
    const name = String(raw.name ?? '').trim().slice(0,80), lat = number(raw.lat), lon = number(raw.lon);
    if (!name || !validCoord(lat,lon)) return null;
    return {
      id:String(id ?? raw.id ?? '').slice(0,60),name,address:String(raw.address ?? '').trim().slice(0,200),phone:String(raw.phone ?? '').trim().slice(0,20),
      lat,lon,active:raw.active !== false,note:String(raw.note ?? '').trim().slice(0,300),updatedAt:Number(raw.updatedAt) || 0,updatedBy:String(raw.updatedBy ?? '').slice(0,200)
    };
  }
  // Gara đang hoạt động, sắp theo khoảng cách ước tính từ điểm `from` (gần → xa).
  function rank(from, garages) {
    return (garages || []).filter(item => item && item.active !== false && validCoord(item.lat,item.lon))
      .map(garage => ({garage,straight:haversine(from,garage),estimate:haversine(from,garage) * STRAIGHT_FACTOR}))
      .sort((a, b) => a.straight - b.straight);
  }

  function createClient({fetch: request, now = () => Date.now(), sleep = ms => new Promise(resolve => setTimeout(resolve,ms)), timeoutMs = 9000} = {}) {
    let nominatimNext = 0;
    async function json(url) {
      const controller = typeof AbortController === 'function' ? new AbortController() : null, timer = controller ? setTimeout(() => controller.abort(),timeoutMs) : null;
      try {
        const response = await request(url,controller ? {signal:controller.signal} : undefined);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return await response.json();
      } finally { if (timer) clearTimeout(timer); }
    }
    async function nominatim(endpoint, params) {
      const slot = Math.max(now(),nominatimNext); nominatimNext = slot + NOMINATIM_GAP_MS;
      const wait = slot - now(); if (wait > 0) await sleep(wait);
      return json(GEOCODE_URL + endpoint + '?' + new URLSearchParams(params));
    }
    // Lộ trình đường bộ; lỗi mạng / không có đường → ước tính (estimated:true).
    async function route(a, b) {
      try {
        const data = await json(ROUTE_URL + a.lon.toFixed(6) + ',' + a.lat.toFixed(6) + ';' + b.lon.toFixed(6) + ',' + b.lat.toFixed(6) + '?overview=full&geometries=geojson&alternatives=false&steps=false');
        const first = data?.code === 'Ok' && data.routes?.[0];
        if (!first || !(first.distance >= 0)) throw new Error('no-route');
        return {km:first.distance / 1000,min:first.duration / 60,coords:(first.geometry?.coordinates || []).map(point => [point[1],point[0]]),estimated:false};
      } catch (_) { return estimate(a,b); }
    }
    // Tìm địa chỉ: toạ độ gõ trực tiếp → điểm; ngược lại gọi Nominatim (tối đa 5 kết quả ở Việt Nam).
    async function geocode(query) {
      const text = String(query ?? '').trim();
      if (text.length < 3) return {note:'Nhập ít nhất 3 ký tự.'};
      if (COORD_RE.test(text)) { const point = parseCoord(text); return point ? {point:{...point,label:'Toạ độ ' + point.lat + ', ' + point.lon}} : {note:'Toạ độ không hợp lệ (nhập: vĩ độ, kinh độ).'}; }
      try {
        const rows = await nominatim('search',{q:text,format:'jsonv2','accept-language':'vi',countrycodes:'vn',limit:'5'});
        const items = (Array.isArray(rows) ? rows : []).map(row => ({lat:parseFloat(row.lat),lon:parseFloat(row.lon),label:row.display_name})).filter(item => validCoord(item.lat,item.lon));
        return {items,note:items.length ? '' : 'Không tìm thấy. Thử ghi đầy đủ hơn (số nhà, đường, phường/xã) hoặc chạm bản đồ.'};
      } catch (_) { return {note:'Không tìm được địa chỉ (mạng/dịch vụ bận). Hãy thử lại hoặc chạm bản đồ.'}; }
    }
    async function reverse(lat, lon) {
      try { const data = await nominatim('reverse',{lat,lon,format:'jsonv2','accept-language':'vi',zoom:'17'}); return data?.display_name || ''; }
      catch (_) { return ''; }
    }
    // Gara gần nhất theo ĐƯỜNG BỘ: lấy vài gara gần nhất theo chim bay rồi đo lại bằng lộ trình, chọn km nhỏ nhất.
    async function nearest(from, garages, candidates = CANDIDATES) {
      const ranked = rank(from,garages);
      if (!ranked.length) return null;
      const top = ranked.slice(0,Math.max(1,candidates));
      const routes = await Promise.all(top.map(item => route(from,item.garage)));
      let best = 0;
      routes.forEach((item, index) => { if (item.km < routes[best].km) best = index; });
      return {garage:top[best].garage,route:routes[best],checked:top.length,ranked};
    }
    return {route,geocode,reverse,nearest};
  }

  return {STRAIGHT_FACTOR,COORD_RE,validCoord,parseCoord,haversine,estimate,fmtKm,fmtDuration,normalize,number,sanitizeGarage,rank,createClient};
})();
