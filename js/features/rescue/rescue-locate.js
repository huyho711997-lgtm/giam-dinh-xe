// Chế độ "Định vị tính km" của trang Chi phí cứu hộ: chọn vị trí hiện trường (A) bằng GPS / địa chỉ / bản đồ, chọn gara (B) hoặc
// tìm gara gần nhất, tính lộ trình đường bộ (OSRM, dự phòng chim bay × 1,3) rồi điền số km vào ô quãng đường.
// Logic khoảng cách / gần nhất nằm ở rescue-geo.js; danh sách gara ở rescue-garages.js. Bản đồ Leaflet tải lười từ cdnjs.
const RescueLocate = (() => {
  const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
  const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
  const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const DEFAULT_CENTER = [12.6667,108.0383];  // Buôn Ma Thuột
  const esc = text => String(text ?? '').replace(/[&<>"']/g,char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const icon = name => SharedFormsControls.icon(name);
  const OTHER = 'other';

  let leafletPromise = null;
  function loadLeaflet() {
    if (window.L?.map) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = LEAFLET_CSS; document.head.appendChild(css);
      const script = document.createElement('script'); script.src = LEAFLET_JS;
      script.onload = () => window.L ? resolve(window.L) : reject(new Error('leaflet'));
      script.onerror = () => reject(new Error('leaflet-load'));
      document.head.appendChild(script);
    });
    leafletPromise.catch(() => { leafletPromise = null; });
    return leafletPromise;
  }

  function geoGuard() {
    if (!navigator.geolocation) return 'Thiết bị không hỗ trợ định vị. Hãy nhập địa chỉ hoặc chạm bản đồ.';
    if (window.isSecureContext === false) return 'Định vị chỉ hoạt động khi mở trang bằng HTTPS. Hãy nhập địa chỉ hoặc chạm bản đồ.';
    return '';
  }
  const geoError = error => error?.code === 1 ? 'Bạn đã từ chối quyền vị trí. Hãy cấp quyền trong cài đặt trình duyệt hoặc nhập địa chỉ.'
    : error?.code === 3 ? 'Lấy vị trí quá lâu (GPS yếu). Thử ra nơi thoáng hoặc chạm bản đồ.' : 'Không xác định được vị trí. Hãy nhập địa chỉ hoặc chạm bản đồ.';

  const searchCard = (key, title, letter) => '<section class="rl-card" data-rl-card="' + key + '"><header class="rl-head"><i class="rl-dot rl-dot--' + letter + '">' + letter.toUpperCase() + '</i><strong>' + title + '</strong></header>';
  const searchBox = (key, label, placeholder) => '<label class="rc-field"><span class="rc-label">' + label + '</span><span class="rl-search"><input type="search" data-rl-q="' + key + '" enterkeyhint="search" autocomplete="off" placeholder="' + placeholder + '"><button type="button" class="sf-icon-button sf-bordered" data-rl-search="' + key + '" aria-label="Tìm địa chỉ" title="Tìm địa chỉ">' + icon('search') + '</button></span></label>' +
    '<ul class="rl-list" data-rl-list="' + key + '" hidden></ul>';
  const feedback = key => '<p class="rl-msg" data-rl-msg="' + key + '" role="alert" hidden></p><div class="rl-info" data-rl-info="' + key + '"></div>';

  // root: phần tử chứa giao diện; options: {kmInput, geo, garages, onKm(km|null), onManage()}
  function create(root, options) {
    const {kmInput, geo, garages, onKm, onManage} = options;
    const state = {scene:null,garage:null,garageSel:'',target:'scene',route:null,reqId:0,loading:false,manual:false,visible:false};
    let map = null, L = null, routeLine = null, routeTimer = 0, mapFailed = false, destroyed = false, unsubscribe = null, programmatic = false;
    const markers = {scene:null,garage:null}, searchToken = {scene:0,garage:0};

    root.innerHTML = '<div class="rl-points">' +
      searchCard('scene','Vị trí hiện trường','a') + '<button type="button" class="sf-button rl-wide" data-rl-gps>' + icon('pin') + 'Dùng vị trí hiện tại</button>' + searchBox('scene','Hoặc tìm theo địa chỉ','Địa chỉ hoặc toạ độ') + feedback('scene') + '</section>' +
      searchCard('garage','Gara (điểm đến)','b') +
      '<label class="rc-field"><span class="rc-label">Chọn gara</span><select data-rl-garage data-sf-select data-sf-label="Gara" data-sf-description="Chọn gara trong danh sách dùng chung" data-sf-icon="pin"></select></label>' +
      '<p class="rc-hint" data-rl-gnote hidden></p><div class="rl-row"><button type="button" class="sf-button" data-rl-nearest>' + icon('arrow') + 'Chọn gara gần nhất</button><button type="button" class="rl-link" data-rl-manage>Quản lý danh sách gara →</button></div>' +
      '<div class="rl-other" data-rl-other hidden>' + searchBox('garage','Địa chỉ gara khác','Địa chỉ gara / toạ độ (vĩ độ, kinh độ)') + '</div>' + feedback('garage') + '</section></div>' +
      '<span class="rc-label">Chạm bản đồ để đặt điểm</span>' +
      '<div class="rc-seg" role="group" aria-label="Điểm đang đặt"><button type="button" class="sf-source-tab" data-rl-target="scene" aria-pressed="true">' + icon('pin') + 'A · Hiện trường</button><button type="button" class="sf-source-tab" data-rl-target="garage" aria-pressed="false">' + icon('truck') + 'B · Gara</button></div>' +
      '<div class="rl-map" data-rl-map role="application" aria-label="Bản đồ lộ trình"></div>' +
      '<p class="rc-hint">Kéo ghim A/B để chỉnh vị trí. Trên điện thoại dùng 2 ngón để di chuyển bản đồ.</p>' +
      '<div class="rl-summary" data-rl-summary aria-live="polite" hidden></div>';
    const q = selector => root.querySelector(selector), qa = selector => root.querySelectorAll(selector);
    const part = key => ({q:q('[data-rl-q="' + key + '"]'),btn:q('[data-rl-search="' + key + '"]'),list:q('[data-rl-list="' + key + '"]'),msg:q('[data-rl-msg="' + key + '"]'),info:q('[data-rl-info="' + key + '"]')});
    const ui = {gps:q('[data-rl-gps]'),select:q('[data-rl-garage]'),nearest:q('[data-rl-nearest]'),gnote:q('[data-rl-gnote]'),other:q('[data-rl-other]'),mapEl:q('[data-rl-map]'),summary:q('[data-rl-summary]')};
    SharedFormsControls.enhance(root);

    const setMsg = (key, text) => { const node = part(key).msg; node.hidden = !text; node.textContent = text || ''; };
    function renderInfo(key) {
      const point = state[key], node = part(key).info;
      if (!point) { node.dataset.has = '0'; node.textContent = key === 'scene' ? 'Chưa chọn vị trí hiện trường.' : 'Chưa chọn gara.'; return; }
      node.dataset.has = '1';
      node.innerHTML = '<b>' + esc(point.label || 'Đang xác định địa chỉ…') + '</b><small>' + point.lat.toFixed(5) + ', ' + point.lon.toFixed(5) + (point.acc ? ' · sai số GPS ±' + Math.round(point.acc) + ' m' : '') + '</small>' +
        (point.acc > 200 ? '<small class="rl-warn">GPS kém chính xác: hãy kéo ghim A về đúng vị trí xe.</small>' : '');
    }

    // ----- Bản đồ -----
    function pinIcon(letter, cls) { return L.divIcon({className:'rl-pin rl-pin--' + cls,html:'<span><b>' + letter + '</b></span>',iconSize:[30,30],iconAnchor:[15,15]}); }
    function updateMarker(key) {
      if (!map) return;
      const point = state[key];
      if (!point) { if (markers[key]) { map.removeLayer(markers[key]); markers[key] = null; } return; }
      if (markers[key]) { markers[key].setLatLng([point.lat,point.lon]); return; }
      const isScene = key === 'scene';
      const marker = L.marker([point.lat,point.lon],{draggable:true,keyboard:false,title:isScene ? 'Hiện trường (kéo để chỉnh)' : 'Gara (kéo để chỉnh)',icon:pinIcon(isScene ? 'A' : 'B',isScene ? 'a' : 'b')}).addTo(map);
      marker.on('dragend',() => { const at = marker.getLatLng(); setPoint(key,{lat:at.lat,lon:at.lng,source:'drag'}); });
      markers[key] = marker;
    }
    function drawRoute(route) {
      if (!map) return;
      if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
      if (!route) return;
      routeLine = L.polyline(route.coords,{color:'#8a6a32',weight:5,opacity:.85,dashArray:route.estimated ? '8 8' : null}).addTo(map);
      map.fitBounds(routeLine.getBounds(),{padding:[30,30]});
    }
    function fitMap() {
      if (!map) return;
      const {scene, garage} = state;
      if (scene && garage) map.fitBounds([[scene.lat,scene.lon],[garage.lat,garage.lon]],{padding:[40,40]});
      else if (scene || garage) { const point = scene || garage; map.setView([point.lat,point.lon],15); }
    }
    async function ensureMap() {
      if (map || mapFailed || destroyed) return;
      try {
        L = await loadLeaflet();
        if (destroyed || map) return;
        map = L.map(ui.mapEl,{dragging:!L.Browser.mobile,scrollWheelZoom:false}).setView(DEFAULT_CENTER,11);
        L.tileLayer(TILES,{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
        map.on('click',event => { const at = event.latlng.wrap(); setPoint(state.target,{lat:at.lat,lon:at.lng,source:'map'}); });
        updateMarker('scene'); updateMarker('garage');
        if (state.route) drawRoute(state.route); else fitMap();
      } catch (_) {
        mapFailed = true;
        ui.mapEl.innerHTML = '<div class="rl-map-fail">Không tải được bản đồ. Bạn vẫn có thể dùng GPS, tìm địa chỉ và chọn gara để tính km.</div>';
      }
    }

    // ----- Đặt điểm -----
    function setPoint(key, point) {
      if (!point || !RescueGeo.validCoord(point.lat,point.lon)) return false;
      state[key] = point; setMsg(key,'');
      if (key === 'garage' && point.source !== 'list') { state.garageSel = OTHER; syncGarageSelect(); }
      renderInfo(key); updateMarker(key);
      if (!point.label) reverse(key,point);
      if (['gps','search','list'].includes(point.source) && map && !(state.scene && state.garage)) map.setView([point.lat,point.lon],Math.max(map.getZoom(),15));
      if (key === 'scene') { renderGarageOptions(); if (!state.garage) setTarget('garage'); }
      if (!point.keepRoute) { state.route = null; scheduleRoute(); }
      return true;
    }
    async function reverse(key, point) {
      const label = await geo.reverse(point.lat,point.lon) || 'Vị trí đã ghim trên bản đồ';
      if (destroyed || state[key] !== point) return;
      point.label = label; renderInfo(key);
    }
    function setTarget(key) { state.target = key; qa('[data-rl-target]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.rlTarget === key))); }

    // ----- Gara -----
    function renderGarageOptions() {
      const list = garages.active(), scene = state.scene;
      const rows = list.map(garage => ({garage,estimate:scene ? RescueGeo.haversine(scene,garage) * RescueGeo.STRAIGHT_FACTOR : null}));
      rows.sort((a, b) => scene ? a.estimate - b.estimate : a.garage.name.localeCompare(b.garage.name,'vi'));
      const keep = state.garageSel;
      ui.select.innerHTML = '<option value="">Chọn gara…</option>' + rows.map(row => '<option value="' + esc(row.garage.id) + '">' + esc(row.garage.name + (row.estimate != null ? ' · ≈ ' + RescueGeo.fmtKm(row.estimate) + ' km' : '')) + '</option>').join('') + '<option value="' + OTHER + '">Gara khác · tìm địa chỉ / chạm bản đồ</option>';
      ui.select.value = keep === OTHER || rows.some(row => row.garage.id === keep) ? keep : '';
      ui.nearest.hidden = !list.length; refreshSelect();
      const ready = garages.status === 'ready';
      ui.gnote.hidden = ready && list.length > 0;
      ui.gnote.textContent = garages.status === 'signedout' ? 'Đăng nhập tài khoản Supabase ở tab Gara để dùng danh sách gara dùng chung.' : garages.status === 'error' ? garages.message : garages.status === 'ready' ? 'Danh sách gara đang trống. Thêm gara ở tab Gara hoặc chọn “Gara khác”.' : 'Đang tải danh sách gara…';
    }
    let syncing = false;
    function refreshSelect() { syncing = true; ui.select.dispatchEvent(new Event('change',{bubbles:true})); syncing = false; }  // cập nhật nhãn dropdown dùng chung, không kích hoạt lại logic chọn
    function syncGarageSelect() { ui.select.value = state.garageSel || ''; ui.other.hidden = state.garageSel !== OTHER; refreshSelect(); }
    function selectGarage(id) {
      const garage = garages.find(id);
      if (!garage || !garage.active) return false;
      state.garageSel = id;
      const ok = setPoint('garage',{lat:garage.lat,lon:garage.lon,label:garage.name + (garage.address ? ' · ' + garage.address : ''),source:'list',garageId:id});
      syncGarageSelect(); return ok;
    }
    ui.select.addEventListener('change',event => {
      if (syncing) return;
      const value = ui.select.value;
      if (value === OTHER) { state.garageSel = OTHER; ui.other.hidden = false; setTarget('garage'); }
      else if (value) selectGarage(value);
      else { state.garageSel = ''; ui.other.hidden = true; state.garage = null; renderInfo('garage'); updateMarker('garage'); state.route = null; scheduleRoute(); }
    });
    ui.nearest.addEventListener('click',async () => {
      if (!state.scene) return setMsg('garage','Hãy chọn vị trí hiện trường trước.');
      setMsg('garage',''); ui.nearest.disabled = true;
      const token = ++state.reqId, scene = state.scene;
      setLoading(true,'Đang tìm gara gần nhất theo đường bộ…');
      const result = await geo.nearest(scene,garages.active());
      ui.nearest.disabled = false;
      if (destroyed || token !== state.reqId || state.scene !== scene) return;
      setLoading(false);
      if (!result) return setMsg('garage','Chưa có gara đang hoạt động trong danh sách.');
      state.garageSel = result.garage.id;
      state.route = result.route; state.nearestChecked = result.checked;
      setPoint('garage',{lat:result.garage.lat,lon:result.garage.lon,label:result.garage.name + (result.garage.address ? ' · ' + result.garage.address : ''),source:'list',garageId:result.garage.id,keepRoute:true});
      syncGarageSelect(); applyRoute(result.route);
    });
    q('[data-rl-manage]').addEventListener('click',() => onManage?.());

    // ----- Tìm địa chỉ / GPS -----
    function showList(key, items, note, onPick) {
      const list = part(key).list; list._items = items || []; list._onPick = onPick;
      if (!(items?.length) && !note) { list.hidden = true; list.innerHTML = ''; return; }
      list.hidden = false;
      list.innerHTML = (items || []).map((item, index) => '<li><button type="button" data-i="' + index + '">' + esc(item.label) + '</button></li>').join('') + (note ? '<li class="rl-empty">' + esc(note) + '</li>' : '');
    }
    async function runSearch(key) {
      const p = part(key); setMsg(key,'');
      const token = ++searchToken[key]; p.btn.disabled = true;
      const pick = item => { showList(key,[]); setPoint(key,{lat:item.lat,lon:item.lon,label:item.label,source:'search'}); };
      if (p.q.value.trim().length >= 3 && !RescueGeo.COORD_RE.test(p.q.value)) showList(key,[],'Đang tìm…',pick);
      const result = await geo.geocode(p.q.value);
      if (destroyed || token !== searchToken[key]) return;
      p.btn.disabled = false;
      if (result.point) { showList(key,[]); setPoint(key,{...result.point,source:'search'}); }
      else showList(key,result.items || [],result.note,pick);
    }
    for (const key of ['scene','garage']) {
      const p = part(key);
      p.list.addEventListener('click',event => { const button = event.target.closest('[data-i]'); const item = button && p.list._items?.[Number(button.dataset.i)]; if (item) p.list._onPick?.(item); });
      p.btn.addEventListener('click',() => runSearch(key));
      p.q.addEventListener('keydown',event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); runSearch(key); } });
    }
    ui.gps.addEventListener('click',() => {
      const blocked = geoGuard(); if (blocked) return setMsg('scene',blocked);
      setMsg('scene',''); ui.gps.disabled = true;
      const label = ui.gps.innerHTML; ui.gps.textContent = 'Đang lấy vị trí…';
      const done = () => { ui.gps.disabled = false; ui.gps.innerHTML = label; };
      navigator.geolocation.getCurrentPosition(position => { done(); setPoint('scene',{lat:position.coords.latitude,lon:position.coords.longitude,acc:position.coords.accuracy,source:'gps'}); },error => { done(); setMsg('scene',geoError(error)); },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
    });
    qa('[data-rl-target]').forEach(button => button.addEventListener('click',() => setTarget(button.dataset.rlTarget)));

    // ----- Lộ trình + điền km -----
    function setLoading(value, text) {
      state.loading = value;
      if (value) { ui.summary.hidden = false; ui.summary.dataset.state = 'loading'; ui.summary.textContent = text || 'Đang tính lộ trình…'; }
    }
    function fillKm(km) {
      const text = String(Math.round(km * 100) / 100);
      if (kmInput.value === text) return;  // tránh vòng lặp input → cập nhật trang → show() → fillKm
      programmatic = true; kmInput.value = text; kmInput.dispatchEvent(new Event('input',{bubbles:true})); programmatic = false;
    }
    function renderSummary() {
      const route = state.route;
      if (!route) { if (!state.loading) ui.summary.hidden = true; return; }
      ui.summary.hidden = false; ui.summary.dataset.state = route.estimated ? 'estimate' : 'ok';
      ui.summary.innerHTML = '<div class="rl-summary-main"><span class="rl-summary-icon">' + icon('truck') + '</span><div><strong>' + RescueGeo.fmtKm(route.km) + ' km</strong><small>' + (route.estimated ? 'Ước tính đường chim bay × ' + RescueGeo.STRAIGHT_FACTOR + ' · ' : 'Theo đường bộ · ') + '≈ ' + RescueGeo.fmtDuration(route.min) + '</small></div></div>' +
        (route.estimated ? '<p class="rl-summary-note">Không gọi được dịch vụ chỉ đường nên đây chỉ là ước tính. Hãy kiểm tra lại km thực tế.</p>' : '') +
        (state.nearestChecked ? '<p class="rl-summary-note">Đã so sánh ' + state.nearestChecked + ' gara gần nhất theo đường bộ.</p>' : '') +
        (state.manual ? '<button type="button" class="rl-link" data-rl-usekm>Dùng km theo lộ trình (' + RescueGeo.fmtKm(route.km) + ' km)</button>' : '<p class="rl-summary-note">Số km đã được điền vào ô “Quãng đường kéo”, vẫn có thể chỉnh tay.</p>');
    }
    function applyRoute(route) {
      state.route = route; drawRoute(route);
      if (!state.manual) fillKm(route.km);
      renderSummary(); onKm?.(route.km);
    }
    function scheduleRoute() {
      clearTimeout(routeTimer); state.nearestChecked = 0;
      if (!state.scene || !state.garage) { ++state.reqId; state.loading = false; drawRoute(null); renderSummary(); return; }
      if (state.route) { applyRoute(state.route); return; }
      const token = ++state.reqId; setLoading(true);
      routeTimer = setTimeout(async () => {
        const scene = state.scene, garage = state.garage;
        const route = await geo.route(scene,garage);
        if (destroyed || token !== state.reqId || state.scene !== scene || state.garage !== garage) return;
        state.loading = false; applyRoute(route);
      },250);
    }
    ui.summary.addEventListener('click',event => { if (event.target.closest('[data-rl-usekm]') && state.route) { state.manual = false; fillKm(state.route.km); renderSummary(); } });
    kmInput.addEventListener('input',() => { if (!programmatic && state.visible && state.route) { state.manual = true; renderSummary(); } });

    unsubscribe = garages.subscribe(() => { if (!destroyed) renderGarageOptions(); });
    renderGarageOptions(); renderInfo('scene'); renderInfo('garage');

    return {
      show() { if (state.visible) return; state.visible = true; ensureMap().then(() => { if (map) { map.invalidateSize({pan:false}); if (state.route) drawRoute(state.route); } }); if (state.route && !state.manual) fillKm(state.route.km); },
      hide() { if (!state.visible) return; state.visible = false; clearTimeout(routeTimer); ++state.reqId; state.loading = false; },
      reset() {
        clearTimeout(routeTimer); ++state.reqId;
        Object.assign(state,{scene:null,garage:null,garageSel:'',route:null,loading:false,manual:false,nearestChecked:0});
        for (const key of ['scene','garage']) { const p = part(key); p.q.value = ''; showList(key,[]); setMsg(key,''); renderInfo(key); updateMarker(key); }
        drawRoute(null); ui.other.hidden = true; setTarget('scene'); renderGarageOptions(); ui.summary.hidden = true;
      },
      // Mô tả nguồn của số km để đưa vào bản sao chép kết quả.
      describe() {
        if (!state.route || !state.scene || !state.garage || state.manual) return '';
        return 'Quãng đường: ' + RescueGeo.fmtKm(state.route.km) + ' km ' + (state.route.estimated ? '(ước tính đường chim bay × ' + RescueGeo.STRAIGHT_FACTOR + ')' : '(theo đường bộ)') + ' từ ' + (state.scene.label || 'hiện trường') + ' đến ' + (state.garage.label || 'gara');
      },
      destroy() { destroyed = true; clearTimeout(routeTimer); unsubscribe?.(); if (map) { map.remove(); map = null; } }
    };
  }

  return {create};
})();
