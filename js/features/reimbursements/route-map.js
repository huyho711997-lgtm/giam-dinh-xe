// Lộ trình đi hiện trường: chọn điểm xuất phát (A) và vị trí tai nạn (B) bằng GPS / địa chỉ / chạm bản đồ, vẽ đường đi (OSRM),
// chụp thành ảnh (route-image.js), lưu lên Cloudinary cùng vụ giám định và in A4 kèm hồ sơ.
// Dùng lại RescueGeo (chỉ đường, tìm địa chỉ) và Leaflet tải lười như trang Chi phí cứu hộ.
const FieldRoutePicker = (() => {
  const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
  const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
  const TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';   // nền đường phố kiểu Google (Esri, không cần key)
  const TILES_FALLBACK = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const DEFAULT_START = {lat:12.686955587559002,lon:108.0544871267908,label:'Văn phòng (mặc định)'};   // điểm xuất phát mặc định
  const DEFAULT_CENTER = [DEFAULT_START.lat,DEFAULT_START.lon];
  const START_KEY = 'fieldRouteStartPoint';     // điểm xuất phát dùng lần trước (thường là văn phòng) → lần sau tự điền
  const esc = text => typeof escapeHtmlOutput === 'function' ? escapeHtmlOutput(text ?? '') : String(text ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = name => (typeof SharedFormsControls !== 'undefined' && SharedFormsControls.icon) ? SharedFormsControls.icon(name) : '';
  const toast = (text, kind) => typeof triggerToast === 'function' && triggerToast(text,kind);
  const fmtKm = value => Number(value).toLocaleString('vi-VN',{minimumFractionDigits:1,maximumFractionDigits:1});
  const fmtMin = minutes => minutes < 1 ? '<1 phút' : minutes < 60 ? Math.round(minutes) + ' phút' : Math.floor(minutes / 60) + ' giờ ' + String(Math.round(minutes % 60)).padStart(2,'0') + ' phút';

  let leafletPromise = null;
  function loadLeaflet() {
    if (window.L?.map) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      if (!document.querySelector('link[href="' + LEAFLET_CSS + '"]')) { const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = LEAFLET_CSS; document.head.appendChild(css); }
      const script = document.createElement('script'); script.src = LEAFLET_JS;
      script.onload = () => window.L ? resolve(window.L) : reject(new Error('leaflet'));
      script.onerror = () => reject(new Error('leaflet-load'));
      document.head.appendChild(script);
    });
    leafletPromise.catch(() => { leafletPromise = null; });
    return leafletPromise;
  }
  const readStart = () => { try { const v = JSON.parse(localStorage.getItem(START_KEY) || 'null'); return RescueGeo.validCoord(v?.lat,v?.lon) ? v : null; } catch (_) { return null; } };
  const saveStart = point => { try { localStorage.setItem(START_KEY,JSON.stringify({lat:point.lat,lon:point.lon,label:point.label || ''})); } catch (_) {} };

  // options: {plate, hsbt, sceneText, saved(routeMap|null), allowKm, onApply({routeMap, km|null})}
  function open(options = {}) {
    if (typeof RescueGeo === 'undefined' || typeof FieldRouteImage === 'undefined') return toast('Chưa sẵn sàng tính lộ trình. Hãy tải lại trang.','error');
    close();
    const geo = RescueGeo.createClient({fetch:(...args) => fetch(...args)});
    const saved = options.saved || null;
    const state = {a:saved?.from ? {...saved.from} : (readStart() || {...DEFAULT_START}),b:saved?.to ? {...saved.to} : null,target:'a',route:null,reqId:0,captured:null,busy:false};
    let map = null, L = null, routeLine = null, routeTimer = 0, destroyed = false, mapFailed = false;
    const markers = {a:null,b:null};

    const card = (key, letter, title, hint) => '<section class="frp-card"><header><i class="frp-dot frp-dot--' + key + '">' + letter + '</i><strong>' + title + '</strong></header>' +
      '<div class="frp-search"><input type="search" class="fr-input" data-q="' + key + '" enterkeyhint="search" autocomplete="off" placeholder="' + hint + '"><button type="button" class="sf-button" data-search="' + key + '">' + icon('search') + '<span>Tìm</span></button></div>' +
      (key === 'a' ? '<button type="button" class="sf-button frp-wide" data-gps>' + icon('pin') + '<span>Dùng vị trí hiện tại</span></button>' : '') +
      '<ul class="frp-list" data-list="' + key + '" hidden></ul><p class="frp-msg" data-msg="' + key + '" role="alert" hidden></p><div class="frp-info" data-info="' + key + '"></div></section>';

    const modal = document.createElement('div');
    modal.id = 'fieldRoutePickerModal'; modal.className = 'fr-modal frp-modal';
    modal.innerHTML = '<section class="fr-panel frp-panel" role="dialog" aria-modal="true" aria-label="Lộ trình đi hiện trường">' +
      '<header class="fr-head"><div class="sf-page-title"><span class="sf-page-emblem">' + icon('pin') + '</span><div><div class="sf-eyebrow">Thanh toán &amp; Chi phí · Hiện trường</div><h2>Lộ trình đi hiện trường</h2>' +
      '<div class="fr-meta">' + (options.plate ? '<span class="fr-code">' + esc(options.plate) + '</span>' : '') + (options.hsbt ? '<span>' + esc(options.hsbt) + '</span>' : '') + '<span>Chọn điểm A, B để vẽ đường đi, rồi chụp ảnh in kèm hồ sơ.</span></div></div></div>' +
      '<button type="button" class="sf-icon-button sf-bordered" data-close aria-label="Đóng">' + icon('close') + '</button></header>' +
      '<div class="frp-body"><div class="frp-side">' +
        card('a','A','Điểm xuất phát','Địa chỉ nơi đi (hoặc toạ độ: vĩ độ, kinh độ)') +
        card('b','B','Vị trí tai nạn / hiện trường','Địa chỉ nơi xảy ra tai nạn') +
        '<div class="frp-seg" role="group" aria-label="Điểm đang đặt khi chạm bản đồ"><span>Chạm bản đồ để đặt:</span><button type="button" data-target="a" aria-pressed="true">A · Xuất phát</button><button type="button" data-target="b" aria-pressed="false">B · Hiện trường</button></div>' +
        '<p class="frp-hint">Kéo ghim A/B để chỉnh đúng vị trí. Đường đi tính theo đường bộ.</p></div>' +
      '<div class="frp-stage"><div class="frp-map" data-map role="application" aria-label="Bản đồ lộ trình"></div><div class="frp-preview" data-preview hidden></div></div></div>' +
      '<footer class="fr-foot"><div class="frp-summary" data-summary aria-live="polite">Chọn điểm A và B để tính lộ trình.</div>' +
      '<div class="fr-foot-actions"><button type="button" class="sf-button" data-close>Đóng</button>' +
      '<button type="button" class="sf-button" data-back hidden>Chọn lại điểm</button><button type="button" class="sf-button" data-download hidden>' + icon('download') + '<span>Tải ảnh</span></button>' +
      (options.allowKm === false ? '' : '<button type="button" class="sf-button" data-km disabled>Dùng km này</button>') +
      '<button type="button" class="sf-button sf-primary" data-capture disabled>' + icon('camera') + '<span>Chụp lộ trình</span></button>' +
      '<button type="button" class="sf-button sf-primary" data-save hidden>' + icon('arrow') + '<span>Lưu vào vụ</span></button></div></footer></section>';
    document.body.appendChild(modal);
    const q = selector => modal.querySelector(selector), qa = selector => modal.querySelectorAll(selector);
    const ui = {mapEl:q('[data-map]'),preview:q('[data-preview]'),summary:q('[data-summary]'),km:q('[data-km]'),capture:q('[data-capture]'),save:q('[data-save]'),back:q('[data-back]'),download:q('[data-download]')};
    const part = key => ({q:q('[data-q="' + key + '"]'),list:q('[data-list="' + key + '"]'),msg:q('[data-msg="' + key + '"]'),info:q('[data-info="' + key + '"]')});
    if (options.sceneText) part('b').q.value = options.sceneText;

    const setMsg = (key, text) => { const node = part(key).msg; node.hidden = !text; node.textContent = text || ''; };
    function renderInfo(key) {
      const point = state[key], node = part(key).info;
      node.innerHTML = point ? '<b>' + esc(point.label || 'Đang xác định địa chỉ…') + '</b><small>' + point.lat.toFixed(5) + ', ' + point.lon.toFixed(5) + '</small>' : '<small>Chưa chọn điểm.</small>';
    }
    function refreshButtons() {
      const ready = !!(state.a && state.b && state.route);
      ui.capture.disabled = !ready || state.busy; if (ui.km) ui.km.disabled = !ready;
    }
    function renderSummary() {
      const r = state.route;
      if (!state.a || !state.b) ui.summary.textContent = 'Chọn điểm A và B để tính lộ trình.';
      else if (!r) ui.summary.textContent = 'Đang tính lộ trình…';
      else ui.summary.innerHTML = '<strong>' + fmtKm(r.km) + ' km</strong> · khoảng ' + fmtMin(r.min) + ' (1 chiều)' + (r.estimated ? ' <em class="frp-warn">Ước tính theo đường chim bay ×1,3 vì không gọi được dịch vụ chỉ đường.</em>' : '');
      refreshButtons();
    }

    // ----- Bản đồ -----
    const pinIcon = (letter, cls) => cls === 'a'
      ? L.divIcon({className:'frp-pin frp-pin--a',html:'<span></span>',iconSize:[22,22],iconAnchor:[11,11]})
      : L.divIcon({className:'frp-pin frp-pin--b',html:'<span><i></i></span>',iconSize:[30,42],iconAnchor:[15,40]});
    function updateMarker(key) {
      if (!map) return;
      const point = state[key];
      if (!point) { if (markers[key]) { map.removeLayer(markers[key]); markers[key] = null; } return; }
      if (markers[key]) { markers[key].setLatLng([point.lat,point.lon]); return; }
      const marker = L.marker([point.lat,point.lon],{draggable:true,keyboard:false,title:key === 'a' ? 'Điểm xuất phát (kéo để chỉnh)' : 'Hiện trường (kéo để chỉnh)',icon:pinIcon(key.toUpperCase(),key)}).addTo(map);
      marker.on('dragend',() => { const at = marker.getLatLng(); setPoint(key,{lat:at.lat,lon:at.lng}); });
      markers[key] = marker;
    }
    function fitMap() {
      if (!map) return;
      if (state.a && state.b) map.fitBounds([[state.a.lat,state.a.lon],[state.b.lat,state.b.lon]],{padding:[50,50]});
      else if (state.a || state.b) { const p = state.a || state.b; map.setView([p.lat,p.lon],15); }
    }
    function drawRoute() {
      if (!map) return;
      if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
      if (!state.route) return;
      routeLine = L.layerGroup([L.polyline(state.route.coords,{color:'#1a56b8',weight:10,opacity:1,lineJoin:'round'}),L.polyline(state.route.coords,{color:'#4285f4',weight:6.5,opacity:1,lineJoin:'round',dashArray:state.route.estimated ? '8 8' : null})]).addTo(map);
      map.fitBounds(L.latLngBounds(state.route.coords),{padding:[50,50]});
    }
    async function ensureMap() {
      try {
        L = await loadLeaflet();
        if (destroyed || map) return;
        map = L.map(ui.mapEl,{scrollWheelZoom:true}).setView(DEFAULT_CENTER,11);
        const base = L.tileLayer(TILES,{maxZoom:19,crossOrigin:'anonymous',attribution:'&copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors'}).addTo(map);
        let tileErrors = 0;
        base.on('tileerror',() => {   // nền chính lỗi/bị chặn → chuyển sang OpenStreetMap
          if (++tileErrors < 3 || !map) return;
          map.removeLayer(base);
          L.tileLayer(TILES_FALLBACK,{maxZoom:19,crossOrigin:'anonymous',attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
        });
        map.on('click',event => { const at = event.latlng.wrap(); setPoint(state.target,{lat:at.lat,lon:at.lng}); });
        updateMarker('a'); updateMarker('b'); state.route ? drawRoute() : fitMap();
      } catch (_) {
        mapFailed = true;
        ui.mapEl.innerHTML = '<div class="frp-map-fail">Không tải được bản đồ. Kiểm tra mạng rồi mở lại cửa sổ này.</div>';
      }
    }

    // ----- Điểm & lộ trình -----
    function scheduleRoute() {
      clearTimeout(routeTimer);
      state.route = null; renderSummary();
      if (!state.a || !state.b) { drawRoute(); return; }
      const id = ++state.reqId;
      routeTimer = setTimeout(async () => {
        const result = await geo.route(state.a,state.b);
        if (destroyed || id !== state.reqId) return;
        state.route = result; renderSummary(); drawRoute();
      },350);
    }
    async function setPoint(key, point) {
      const previous = state[key];
      state[key] = {lat:point.lat,lon:point.lon,label:point.label || ''};
      renderInfo(key); updateMarker(key); scheduleRoute();
      if (!point.label) {
        const token = state[key];
        const label = await geo.reverse(point.lat,point.lon);
        if (!destroyed && state[key] === token && label) { token.label = label; renderInfo(key); }
      }
      if (!point.label && !previous) fitMap();
    }
    async function search(key) {
      const box = part(key); setMsg(key,''); box.list.hidden = true; box.list.innerHTML = '';
      const result = await geo.geocode(box.q.value);
      if (destroyed) return;
      if (result.point) { setPoint(key,result.point); return; }
      if (result.note) setMsg(key,result.note);
      if (result.items?.length) {
        box.list.hidden = false;
        box.list.innerHTML = result.items.map((item, i) => '<li><button type="button" data-pick="' + key + ':' + i + '">' + esc(item.label) + '</button></li>').join('');
        box.list._items = result.items;
      }
    }
    function useGps() {
      if (!navigator.geolocation) return setMsg('a','Thiết bị không hỗ trợ định vị.');
      if (window.isSecureContext === false) return setMsg('a','Định vị chỉ hoạt động khi mở trang bằng HTTPS.');
      setMsg('a','Đang lấy vị trí…');
      navigator.geolocation.getCurrentPosition(position => { setMsg('a',''); setPoint('a',{lat:position.coords.latitude,lon:position.coords.longitude}); },
        error => setMsg('a',error?.code === 1 ? 'Bạn đã từ chối quyền vị trí. Hãy cấp quyền hoặc nhập địa chỉ.' : 'Không xác định được vị trí. Hãy nhập địa chỉ hoặc chạm bản đồ.'),{enableHighAccuracy:true,timeout:15000,maximumAge:30000});
    }

    // ----- Chụp / lưu -----
    function showPreview(on) {
      ui.preview.hidden = !on; ui.mapEl.hidden = on;
      ui.capture.hidden = on; ui.save.hidden = !on; ui.back.hidden = !on; ui.download.hidden = !on;
      if (ui.km) ui.km.hidden = on;
      qa('.frp-side input, .frp-side button').forEach(node => { node.disabled = on; });
      if (!on && map) setTimeout(() => map.invalidateSize(),0);
    }
    async function capture() {
      if (!state.route || state.busy) return;
      state.busy = true; ui.capture.disabled = true; ui.summary.textContent = 'Đang chụp bản đồ…';
      try {
        const canvas = await FieldRouteImage.render({coords:state.route.coords,from:state.a,to:state.b,estimated:state.route.estimated,km:state.route.km,min:state.route.min});
        const blob = await FieldRouteImage.toBlob(canvas);
        state.captured = {blob,url:URL.createObjectURL(blob)};
        ui.preview.innerHTML = '<img alt="Ảnh lộ trình" src="' + state.captured.url + '">';
        showPreview(true); renderSummary();
      } catch (error) {
        toast('Không chụp được lộ trình: ' + (error.message || 'lỗi không xác định'),'error'); renderSummary();
      } finally { state.busy = false; refreshButtons(); }
    }
    function routeRecord(url) {
      const r = state.route;
      return {url,from:{lat:state.a.lat,lon:state.a.lon,label:state.a.label || ''},to:{lat:state.b.lat,lon:state.b.lon,label:state.b.label || ''},
        km:Math.round(r.km * 10) / 10,minutes:Math.round(r.min),estimated:!!r.estimated,capturedAt:Date.now()};
    }
    async function saveToCase() {
      if (!state.captured || state.busy) return;
      if (typeof uploadSingleImageToCloudinaryEngine !== 'function') return toast('Chưa cấu hình lưu ảnh (Cloudinary). Hãy dùng “Tải ảnh” để lưu về máy.','error');
      state.busy = true; ui.save.disabled = true; const label = ui.save.querySelector('span'); label.textContent = 'Đang lưu…';
      try {
        const file = new File([state.captured.blob],'lo-trinh-' + Date.now() + '.jpg',{type:'image/jpeg'});
        const url = await uploadSingleImageToCloudinaryEngine(file);
        saveStart(state.a);
        options.onApply?.({routeMap:routeRecord(url),km:options.allowKm === false ? null : Math.round(state.route.km)});
        toast('Đã lưu lộ trình vào vụ này.','success'); close();
      } catch (error) {
        toast('Không lưu được ảnh: ' + (error.message || 'lỗi mạng') + '. Bạn vẫn có thể bấm “Tải ảnh”.','error');
        state.busy = false; ui.save.disabled = false; label.textContent = 'Lưu vào vụ';
      }
    }
    function download() {
      if (!state.captured) return;
      const link = document.createElement('a'); link.href = state.captured.url; link.download = 'lo-trinh-' + String(options.hsbt || options.plate || 'hien-truong').replace(/[^A-Za-z0-9._-]+/g,'-') + '.jpg';
      document.body.appendChild(link); link.click(); link.remove();
    }
    function close() { closeCurrent(); }

    // ----- Sự kiện -----
    modal.addEventListener('click',event => {
      const target = event.target;
      if (target === modal || target.closest('[data-close]')) return close();
      const pick = target.closest('[data-pick]');
      if (pick) { const [key, index] = pick.dataset.pick.split(':'), box = part(key), item = box.list._items?.[Number(index)]; if (item) { box.list.hidden = true; setPoint(key,item); } return; }
      const search_ = target.closest('[data-search]'); if (search_) return search(search_.dataset.search);
      if (target.closest('[data-gps]')) return useGps();
      const seg = target.closest('[data-target]');
      if (seg) { state.target = seg.dataset.target; qa('[data-target]').forEach(btn => btn.setAttribute('aria-pressed',String(btn === seg))); return; }
      if (target.closest('[data-capture]')) return capture();
      if (target.closest('[data-save]')) return saveToCase();
      if (target.closest('[data-download]')) return download();
      if (target.closest('[data-back]')) { showPreview(false); renderSummary(); return; }
      if (target.closest('[data-km]') && state.route) { options.onApply?.({routeMap:null,km:Math.round(state.route.km)}); toast('Đã điền ' + Math.round(state.route.km) + ' km vào vụ.','success'); close(); }
    });
    modal.addEventListener('keydown',event => {
      if (event.key === 'Escape') return close();
      if (event.key === 'Enter' && event.target.matches('[data-q]')) { event.preventDefault(); search(event.target.dataset.q); }
    });

    current = {destroy() {
      destroyed = true; clearTimeout(routeTimer);
      if (state.captured) URL.revokeObjectURL(state.captured.url);
      if (map) { map.remove(); map = null; }
      modal.remove();
    }};
    renderInfo('a'); renderInfo('b'); renderSummary(); ensureMap();
    if (state.a && state.b) scheduleRoute();
    if (options.sceneText && !state.b) search('b');   // tự tìm địa chỉ tai nạn đã có trong vụ (người dùng chọn kết quả đúng)
    part('b').q.focus();
  }

  let current = null;
  function closeCurrent() { if (current) { current.destroy(); current = null; } }

  // Xem ảnh lộ trình đã lưu (phóng to).
  function preview(routeMap) {
    if (!routeMap?.url) return;
    closeCurrent();
    const modal = document.createElement('div'); modal.id = 'fieldRoutePickerModal'; modal.className = 'fr-modal frp-modal';
    modal.innerHTML = '<section class="fr-panel frp-panel frp-view" role="dialog" aria-modal="true" aria-label="Ảnh lộ trình"><header class="fr-head"><div class="sf-page-title"><span class="sf-page-emblem">' + icon('pin') + '</span><div><div class="sf-eyebrow">Lộ trình đã lưu</div><h2>' + fmtKm(routeMap.km) + ' km · ' + fmtMin(routeMap.minutes || 0) + '</h2>' +
      '<div class="fr-meta"><span>A: ' + esc(routeMap.from?.label || '—') + '</span><span>B: ' + esc(routeMap.to?.label || '—') + '</span></div></div></div><button type="button" class="sf-icon-button sf-bordered" data-close aria-label="Đóng">' + icon('close') + '</button></header>' +
      '<div class="frp-view-body"><img alt="Ảnh lộ trình" src="' + esc(routeMap.url) + '"></div></section>';
    modal.addEventListener('click',event => { if (event.target === modal || event.target.closest('[data-close]')) closeCurrent(); });
    document.body.appendChild(modal);
    current = {destroy() { modal.remove(); }};
  }

  return {open,preview,close:closeCurrent};
})();

// ---------- In A4: mỗi vụ có ảnh lộ trình = 1 trang, để kẹp vào hồ sơ ----------
function printFieldRouteMaps(batchId) {
  const payload = cachedFieldReimbursementsPayload?.[batchId];
  const items = (payload?.items || []).filter(item => item.routeMap?.url);
  if (!items.length) return typeof triggerToast === 'function' && triggerToast('Phiếu này chưa có lộ trình nào được lưu.','error');
  const esc = text => escapeHtmlOutput(text ?? '');
  const when = item => [item.startDatetime, item.datetime].filter(Boolean).map(v => formatDateDisplay(v)).join(' → ');
  const pages = items.map((item, index) => {
    const r = item.routeMap;
    const km = Number(r.km) || 0, min = Number(r.minutes) || 0;
    return '<div class="print-page rm-page">' +
      '<h1>Bản đồ lộ trình đi hiện trường</h1><p class="rm-sub">Phụ lục kèm giấy đề nghị thanh toán ' + esc(payload.id) + ' · Vụ ' + (index + 1) + '/' + items.length + '</p>' +
      '<table class="rm-info"><tbody>' +
      '<tr><th>Số HSBT</th><td>' + esc(item.soHSBT || '—') + '</td><th>Biển số xe</th><td>' + esc(item.bienSo || '—') + '</td></tr>' +
      '<tr><th>Thời gian giám định</th><td>' + esc(when(item) || '—') + '</td><th>Phương tiện</th><td>' + esc(item.vehicle || '—') + '</td></tr>' +
      '<tr><th>Điểm xuất phát (A)</th><td colspan="3">' + esc(r.from?.label || (r.from ? r.from.lat + ', ' + r.from.lon : '—')) + '</td></tr>' +
      '<tr><th>Vị trí tai nạn (B)</th><td colspan="3">' + esc(r.to?.label || (r.to ? r.to.lat + ', ' + r.to.lon : '—')) + '</td></tr>' +
      '<tr><th>Quãng đường 1 chiều</th><td>' + km.toLocaleString('vi-VN',{minimumFractionDigits:1,maximumFractionDigits:1}) + ' km' + (r.estimated ? ' (ước tính)' : '') + '</td><th>Thời gian di chuyển</th><td>' + (min ? (min >= 60 ? Math.floor(min / 60) + ' giờ ' + (min % 60) + ' phút' : min + ' phút') : '—') + '</td></tr>' +
      '</tbody></table>' +
      '<img class="rm-img" alt="Bản đồ lộ trình" src="' + esc(r.url) + '">' +
      '<p class="rm-note">Lộ trình tính theo đường bộ, mang tính tham khảo. Nguồn dữ liệu: © Esri, HERE, Garmin, © OpenStreetMap contributors; chỉ đường: OSRM.</p>' +
      '<div class="rm-sign"><div>Người lập<br><i>(Ký, ghi rõ họ tên)</i></div><div>Xác nhận của quản lý<br><i>(Ký, ghi rõ họ tên)</i></div></div></div>';
  }).join('');
  document.getElementById('printRouteOverlayModal')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'printRouteOverlayModal'; overlay.className = 'fr-modal fr-print-overlay';
  const ic = name => (typeof fieldReimbIcon === 'function' ? fieldReimbIcon(name) : '');
  overlay.innerHTML = '<style>' +
    '#printRouteOverlayModal * { box-sizing:border-box; }' +
    '#printRouteOverlayModal .rm-page { background:#fff; color:#000; width:210mm; min-height:297mm; padding:15mm; margin:0 auto 32px; border-radius:8px; box-shadow:0 30px 80px rgba(0,0,0,.5); font-family:"Times New Roman",serif; }' +
    '#printRouteOverlayModal .rm-page h1 { margin:0; text-align:center; font-size:18px; text-transform:uppercase; }' +
    '#printRouteOverlayModal .rm-sub { margin:4px 0 14px; text-align:center; font-size:13px; font-style:italic; }' +
    '#printRouteOverlayModal .rm-info { width:100%; border-collapse:collapse; margin-bottom:12px; }' +
    '#printRouteOverlayModal .rm-info th, #printRouteOverlayModal .rm-info td { border:1px solid #000; padding:5px 7px; font-size:12.5px; text-align:left; vertical-align:top; }' +
    '#printRouteOverlayModal .rm-info th { width:21%; background:#f3f3f3; font-weight:700; }' +
    '#printRouteOverlayModal .rm-img { display:block; width:100%; height:auto; border:1px solid #000; }' +
    '#printRouteOverlayModal .rm-note { margin:8px 0 0; font-size:11px; font-style:italic; color:#333; }' +
    '#printRouteOverlayModal .rm-sign { display:flex; justify-content:space-around; margin-top:26px; text-align:center; font-size:13px; font-weight:700; } #printRouteOverlayModal .rm-sign i { font-weight:400; font-size:11px; }' +
    '#printRouteOverlayModal .rm-sign div { min-height:70px; }' +
    '@media print { @page { size:A4 portrait; margin:12mm; } body > *:not(#printRouteOverlayModal) { display:none !important; }' +
    '#printRouteOverlayModal { position:static !important; background:#fff !important; padding:0 !important; margin:0 !important; width:100% !important; height:auto !important; display:block !important; overflow:visible !important; }' +
    '#printRouteOverlayModal .print-action-bar { display:none !important; } #printRouteOverlayModal .rm-page { margin:0 !important; padding:0 !important; box-shadow:none !important; border-radius:0 !important; width:100% !important; min-height:0 !important; page-break-after:always; break-after:page; }' +
    '#printRouteOverlayModal .rm-page:last-child { page-break-after:auto; break-after:auto; } }' +
    '</style>' +
    '<div class="print-action-bar fr-print-bar"><button type="button" class="sf-button" onclick="document.getElementById(\'printRouteOverlayModal\').remove()">' + ic('arrow').replace('<svg','<svg style="transform:scaleX(-1)"') + '<span>Quay lại</span></button>' +
    '<div class="fr-print-title"><span class="sf-eyebrow">Xem trước bản in</span><strong>Lộ trình đi hiện trường · ' + esc(payload.id) + ' · ' + items.length + ' trang</strong></div>' +
    '<button type="button" class="sf-button sf-primary" onclick="window.print()">' + ic('print') + '<span>In lộ trình</span></button></div>' + pages;
  document.body.appendChild(overlay);
}
