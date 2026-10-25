// Danh sách gara cứu hộ DÙNG CHUNG với trang Tasco DLK (mobile): cùng bảng Supabase `tasco_rescue_garages`.
//   cột: id, name, address, phone, lat, lon, active, note, updated_at (updated_at dùng làm phiên bản chống ghi đè).
// Webapp này đăng nhập Firebase, còn bảng nằm ở Supabase nên tab Gara có thêm bước đăng nhập tài khoản Supabase
// (cùng tài khoản đang dùng ở trang kia). Quyền xem / sửa do chính sách RLS của Supabase quyết định.
// Khoá anon là khoá công khai theo thiết kế của Supabase (không phải bí mật); mọi quyền được kiểm soát bằng RLS.
const RescueGarages = (() => {
  const SUPABASE_URL = 'https://yxwmcpoklxpzlikxojez.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d21jcG9rbHhwemxpa3hvamV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1Njk0MDEsImV4cCI6MjA5NjE0NTQwMX0.dmyjtDDo_KTlUFyxQgoCGqEt5Bsq2krEEYg2BCyXeFc';
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  const TABLE = 'tasco_rescue_garages';
  const TIMEOUT_MS = 12000;
  let items = [], status = 'idle', message = '', subscribers = [], client = null, sdkPromise = null, session = null, loading = null, epoch = 0, lastSync = 0;

  const emit = () => subscribers.slice().forEach(callback => { try { callback(); } catch (error) { console.error(error); } });
  const byName = (a, b) => a.name.localeCompare(b.name,'vi');
  const canManage = () => status === 'ready' && !!session;  // quyền ghi thật sự do RLS của Supabase kiểm soát; lỗi 42501 được báo rõ khi lưu

  function loadSdk() {
    if (window.supabase?.createClient) return Promise.resolve(window.supabase);
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = SDK_URL;
      script.onload = () => window.supabase?.createClient ? resolve(window.supabase) : reject(new Error('sdk'));
      script.onerror = () => reject(new Error('sdk-load'));
      document.head.appendChild(script);
    });
    sdkPromise.catch(() => { sdkPromise = null; });
    return sdkPromise;
  }
  async function getClient() {
    if (client) return client;
    const sdk = await loadSdk();
    client = sdk.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'tasco_dlk_supabase_auth'}});
    client.auth.onAuthStateChange((event, next) => {
      const was = session?.user?.id; session = next || null;
      if (was !== session?.user?.id) { epoch++; items = []; lastSync = 0; loading = null; if (session) load(); else { status = 'signedout'; message = ''; emit(); } }
    });
    return client;
  }
  function describe(error) {
    const code = error?.code || '', raw = error?.message || '';
    if (['42P01','PGRST205','PGRST202','42703'].includes(code)) return 'Chưa kết nối được danh sách gara trên Supabase. Liên hệ quản trị viên.';
    if (code === '42501' || /row.level security/i.test(raw)) return 'Tài khoản chưa có quyền quản lý gara. Kiểm tra trạng thái tài khoản và chính sách truy cập.';
    if (code === '23505') return 'Gara này đã tồn tại trong hệ thống. Tải lại danh sách trước khi sửa.';
    if (code === 'CONFLICT') return 'Gara đã được người khác sửa hoặc xóa. Tải lại danh sách rồi thử lại.';
    if (error?.name === 'AbortError') return 'Kết nối quá thời gian. Kiểm tra mạng rồi thử lại.';
    return error?.userMessage || 'Chưa kết nối được hệ thống gara. Kiểm tra mạng rồi thử lại; thay đổi chưa được lưu.';
  }
  async function timed(query) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(),TIMEOUT_MS);
    try { const result = await query.abortSignal(controller.signal); if (result.error) throw result.error; return result.data; } finally { clearTimeout(timer); }
  }
  const fromRow = row => { const garage = RescueGeo.sanitizeGarage({...row,updatedAt:Date.parse(row.updated_at) || 0},row.id); if (garage) garage.version = row.updated_at; return garage; };
  const toRow = garage => ({id:garage.id,name:garage.name,address:garage.address,phone:garage.phone,lat:garage.lat,lon:garage.lon,active:garage.active,note:garage.note});

  async function load() {
    if (loading) return loading;
    const rev = epoch;
    status = 'loading'; message = ''; emit();
    loading = (async () => {
      try {
        const api = await getClient(), rows = [];
        for (let start = 0;; start += 500) {
          const page = await timed(api.from(TABLE).select('*').order('id').range(start,start + 499));
          rows.push(...(page || [])); if (!page || page.length < 500) break;
        }
        if (rev !== epoch) return false;
        items = rows.map(fromRow).filter(Boolean).sort(byName); lastSync = Date.now(); status = 'ready'; message = ''; return true;
      } catch (error) { if (rev === epoch) { status = 'error'; message = describe(error); } return false; }
      finally { if (rev === epoch) { loading = null; emit(); } }
    })();
    return loading;
  }
  // Bắt đầu: đọc phiên Supabase đã lưu; chưa đăng nhập → trạng thái 'signedout'.
  async function start() {
    if (status !== 'idle' && status !== 'error') return;
    status = 'loading'; message = ''; emit();
    try {
      const api = await getClient(), {data} = await api.auth.getSession();
      session = data?.session || null;
      if (session) load(); else { status = 'signedout'; emit(); }
    } catch (error) { status = 'error'; message = 'Không tải được thư viện kết nối Supabase. Kiểm tra mạng rồi thử lại.'; emit(); }
  }
  function stop() { subscribers = []; }
  function subscribe(callback) { subscribers.push(callback); start(); return () => { subscribers = subscribers.filter(item => item !== callback); }; }
  async function signIn(email, password) {
    const api = await getClient();
    const {error} = await api.auth.signInWithPassword({email:String(email).trim(),password:String(password)});
    if (error) throw new Error(/invalid/i.test(error.message || '') ? 'Email hoặc mật khẩu không đúng.' : /rate|too many/i.test(error.message || '') ? 'Thử quá nhiều lần. Vui lòng đợi một lát.' : 'Không đăng nhập được: ' + (error.message || 'lỗi không xác định'));
  }
  async function signOut() { const api = await getClient(); await api.auth.signOut(); }
  const find = id => items.find(item => item.id === id) || null;
  const active = () => items.filter(item => item.active);
  const userEmail = () => session?.user?.email || '';

  const newId = () => (window.crypto?.randomUUID?.() || 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2,8));
  async function mutate(operation) {
    if (!session) throw new Error('Đăng nhập tài khoản Supabase để lưu gara.');
    if (!lastSync) throw new Error(message || 'Cần tải được danh sách gara trước khi lưu.');
    const rev = epoch;
    try { await operation(await getClient()); if (rev !== epoch) throw new Error('Tài khoản đã thay đổi. Đăng nhập lại để kiểm tra dữ liệu.'); }
    catch (error) { throw error instanceof Error && !error.code ? error : new Error(describe(error)); }
    await load();
  }
  async function save(raw, id) {
    const garage = RescueGeo.sanitizeGarage(raw,id || newId());
    if (!garage) throw new Error('Nhập tên gara và toạ độ hợp lệ (vĩ độ −90…90, kinh độ −180…180).');
    const existing = find(garage.id), duplicate = items.find(item => item.id !== garage.id && RescueGeo.normalize(item.name) === RescueGeo.normalize(garage.name));
    if (duplicate) throw new Error(describe({code:'23505'}));
    await mutate(async api => {
      if (existing) {
        const row = await timed(api.from(TABLE).update(toRow(garage)).eq('id',garage.id).eq('updated_at',existing.version).select('*').maybeSingle());
        if (!row) throw {code:'CONFLICT'};
      } else await timed(api.from(TABLE).insert(toRow(garage)).select('*').single());
    });
    return garage.id;
  }
  async function remove(id) {
    const current = find(id); if (!current) return;
    await mutate(async api => {
      const rows = await timed(api.from(TABLE).delete().eq('id',id).eq('updated_at',current.version).select('id'));
      if (!rows?.length) throw {code:'CONFLICT'};
    });
  }

  // ===== Giao diện =====
  const esc = text => String(text ?? '').replace(/[&<>"']/g,char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const icon = name => SharedFormsControls.icon(name);
  let geo = null, search = '', managerHost = null, unsubscribe = null, dialog = null;

  function closeDialog() { if (dialog) { dialog.close(); dialog.remove(); dialog = null; } }
  function field(label, name, attrs = '', hint = '') { return '<label class="sf-field"><span class="sf-field-label">' + label + '</span><input name="' + name + '" ' + attrs + '>' + (hint ? '<small class="sf-field-hint">' + hint + '</small>' : '') + '</label>'; }

  // Hộp thoại thêm / sửa gara; trả về khi đóng.
  function openEditor(garage = null) {
    closeDialog();
    const node = document.createElement('dialog'); node.className = 'sf-dialog sf-dialog-v2 rc-garage-dialog'; node.setAttribute('aria-labelledby','rcGarageTitle');
    node.innerHTML = '<form class="sf-dialog-form"><header class="sf-dialog-head"><span class="sf-dialog-emblem" aria-hidden="true">' + icon('pin') + '</span><div><small>CỨU HỘ · DANH SÁCH GARA</small><h2 id="rcGarageTitle">' + (garage ? 'Sửa gara' : 'Thêm gara') + '</h2><p>Gara dùng chung cho mọi người dùng khi chọn điểm đến cứu hộ.</p></div><button type="button" class="sf-icon-button sf-dialog-close" data-cancel aria-label="Đóng" title="Đóng (Esc)">' + icon('close') + '</button></header>' +
      '<div class="sf-dialog-body">' + field('Tên gara','name','maxlength="80" required placeholder="VD: Gara Ô tô Tây Nguyên"') + field('Địa chỉ','address','maxlength="200" placeholder="Số nhà, đường, phường/xã, tỉnh"') +
      '<div class="rc-garage-geo"><div class="rc-garage-coords">' + field('Vĩ độ','lat','inputmode="decimal" placeholder="12.6667"') + field('Kinh độ','lon','inputmode="decimal" placeholder="108.0383"') + '</div><div class="rc-garage-geo-actions"><button type="button" class="sf-button" data-find>' + icon('search') + 'Tìm toạ độ từ địa chỉ</button><button type="button" class="sf-button" data-here>' + icon('pin') + 'Dùng vị trí hiện tại</button></div><small class="sf-field-hint" data-geo-hint>Gõ địa chỉ rồi bấm tìm, hoặc dán toạ độ (vĩ độ, kinh độ) vào ô vĩ độ.</small></div>' +
      field('Số điện thoại','phone','maxlength="20" inputmode="tel" placeholder="0905 xxx xxx"') + '<label class="sf-field"><span class="sf-field-label">Ghi chú <em>Không bắt buộc</em></span><textarea name="note" maxlength="300" rows="2" placeholder="Giờ làm việc, loại xe nhận cứu hộ…"></textarea></label>' +
      '<label class="rc-check rc-garage-active"><input type="checkbox" name="active" checked><span class="rc-box" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg></span><span class="rc-check-copy"><strong>Đang hoạt động</strong><small>Bỏ chọn để tạm ngưng: gara không xuất hiện khi chọn điểm đến và tìm gần nhất.</small></span></label>' +
      '<p class="sf-feedback" role="status" aria-live="polite"></p></div><footer class="sf-dialog-foot"><button type="button" class="sf-button" data-cancel>Hủy</button><button type="submit" class="sf-button sf-primary">' + icon('check') + '<span>Lưu gara</span></button></footer></form>';
    document.body.appendChild(node); dialog = node;
    const form = node.querySelector('form'), say = text => { node.querySelector('[role="status"]').textContent = text || ''; }, hint = node.querySelector('[data-geo-hint]');
    if (garage) { for (const key of ['name','address','phone','note']) form.elements[key].value = garage[key] || ''; form.elements.lat.value = garage.lat; form.elements.lon.value = garage.lon; form.elements.active.checked = garage.active; }
    node.querySelectorAll('[data-cancel]').forEach(button => button.onclick = closeDialog);
    node.addEventListener('cancel',event => { event.preventDefault(); if (!node.dataset.busy) closeDialog(); });
    const setPoint = (point, label) => { form.elements.lat.value = point.lat.toFixed(6); form.elements.lon.value = point.lon.toFixed(6); hint.textContent = label || 'Đã điền toạ độ.'; };
    form.elements.lat.addEventListener('change',() => {  // dán "lat, lon" vào ô vĩ độ → tự tách
      const point = RescueGeo.parseCoord(form.elements.lat.value); if (point) setPoint(point,'Đã tách toạ độ.');
    });
    node.querySelector('[data-find]').onclick = async event => {
      const button = event.currentTarget, query = form.elements.address.value.trim() || form.elements.name.value.trim();
      button.disabled = true; hint.textContent = 'Đang tìm…';
      const result = await geo.geocode(query);
      button.disabled = false;
      if (result.items?.length) setPoint(result.items[0],'Đã lấy toạ độ của kết quả đầu tiên: ' + result.items[0].label + '. Kiểm tra lại trước khi lưu.');
      else if (result.point) setPoint(result.point);
      else hint.textContent = result.note || 'Không tìm thấy.';
    };
    node.querySelector('[data-here]').onclick = () => {
      if (!navigator.geolocation || window.isSecureContext === false) { hint.textContent = 'Không dùng được định vị trên thiết bị / kết nối này.'; return; }
      hint.textContent = 'Đang lấy vị trí…';
      navigator.geolocation.getCurrentPosition(position => setPoint({lat:position.coords.latitude,lon:position.coords.longitude},'Đã lấy vị trí hiện tại.'),() => { hint.textContent = 'Không lấy được vị trí. Hãy cấp quyền hoặc nhập toạ độ.'; },{enableHighAccuracy:true,timeout:15000});
    };
    form.onsubmit = async event => {
      event.preventDefault(); say('');
      const data = Object.fromEntries(new FormData(form)); data.active = form.elements.active.checked;
      node.dataset.busy = 'true'; node.querySelectorAll('button').forEach(button => button.disabled = true);
      try { await save(data,garage?.id); closeDialog(); triggerToast(garage ? 'Đã cập nhật gara.' : 'Đã thêm gara vào danh sách.','success'); }
      catch (error) { say(error.message); delete node.dataset.busy; node.querySelectorAll('button').forEach(button => button.disabled = false); }
    };
    node.showModal(); form.elements.name.focus({preventScroll:true});
  }

  async function toggle(garage) {
    try { await save({...garage,active:!garage.active},garage.id); triggerToast(garage.active ? 'Đã tạm ngưng gara.' : 'Đã kích hoạt lại gara.','success'); }
    catch (error) { triggerToast(error.message,'error'); }
  }
  async function erase(garage) {
    if (!await showConfirmModal('Xóa gara?','Gara “' + garage.name + '” sẽ bị xóa khỏi danh sách dùng chung. Không thể hoàn tác.','Xóa gara')) return;
    try { await remove(garage.id); triggerToast('Đã xóa gara.','success'); } catch (error) { triggerToast(error.message,'error'); }
  }

  function loginHtml() {
    return '<form class="rc-garage-login" data-garage-login><div><strong>Đăng nhập để dùng chung danh sách gara</strong><p>Danh sách gara lưu trên hệ thống Tasco DLK (Supabase), cùng dữ liệu với trang Tasco DLK trên điện thoại. Dùng tài khoản bạn đang đăng nhập ở trang đó.</p></div>' +
      '<label class="sf-field"><span class="sf-field-label">Email</span><input type="email" name="email" autocomplete="username" required></label><label class="sf-field"><span class="sf-field-label">Mật khẩu</span><input type="password" name="password" autocomplete="current-password" required></label>' +
      '<p class="sf-feedback" role="status" aria-live="polite" data-garage-feedback></p><button type="submit" class="sf-button sf-primary">' + icon('check') + '<span>Đăng nhập</span></button></form>';
  }
  function paintManager() {
    if (!managerHost?.isConnected) return;
    const bar = managerHost.querySelector('[data-garage-tools]'), list = managerHost.querySelector('[data-garage-body]'), manage = canManage(), query = RescueGeo.normalize(search);
    const rows = items.filter(item => !query || RescueGeo.normalize(item.name + ' ' + item.address + ' ' + item.phone).includes(query));
    managerHost.querySelector('[data-garage-count]').textContent = status === 'ready' ? (query ? rows.length + '/' : '') + items.length + ' gara · ' + active().length + ' đang hoạt động' : '';
    const signed = !!session && (status === 'ready' || status === 'loading' || status === 'error');
    bar.innerHTML = (signed ? '<span class="rc-garage-user">' + esc(userEmail()) + '</span><button type="button" class="sf-button" data-garage-reload>' + icon('reset') + 'Tải lại</button><button type="button" class="sf-button" data-garage-signout>Đăng xuất</button>' : '') + (manage ? '<button type="button" class="sf-button sf-primary" data-garage-add>' + icon('upload') + 'Thêm gara</button>' : '');
    if (status === 'signedout') { if (!list.querySelector('[data-garage-login]')) list.innerHTML = loginHtml(); return; }
    if (status === 'loading' || status === 'idle') { list.innerHTML = '<div class="rc-garage-empty">Đang tải danh sách gara…</div>'; return; }
    if (status === 'error') { list.innerHTML = '<div class="rc-garage-empty is-error">' + esc(message) + '</div>'; return; }
    if (!rows.length) { list.innerHTML = '<div class="rc-garage-empty">' + (items.length ? 'Không có gara phù hợp với từ khóa.' : 'Chưa có gara nào. Bấm “Thêm gara” để tạo gara đầu tiên.') + '</div>'; return; }
    list.innerHTML = '<div class="rc-table-wrap"><table class="rc-table rc-garage-table"><thead><tr><th>Gara</th><th>Địa chỉ</th><th>Điện thoại</th><th>Trạng thái</th><th></th></tr></thead><tbody>' + rows.map(item => '<tr data-id="' + esc(item.id) + '"><td><strong>' + esc(item.name) + '</strong><small>' + item.lat.toFixed(5) + ', ' + item.lon.toFixed(5) + '</small></td><td>' + esc(item.address || '—') + (item.note ? '<small>' + esc(item.note) + '</small>' : '') + '</td><td>' + (item.phone ? '<a href="tel:' + esc(item.phone.replace(/[^\d+]/g,'')) + '">' + esc(item.phone) + '</a>' : '—') + '</td><td><span class="rc-badge' + (item.active ? ' is-on' : '') + '">' + (item.active ? 'Hoạt động' : 'Tạm ngưng') + '</span></td>' +
      '<td class="rc-garage-actions"><button type="button" class="sf-icon-button" data-act="edit" aria-label="Sửa ' + esc(item.name) + '" title="Sửa">' + icon('file') + '</button><button type="button" class="sf-icon-button" data-act="toggle" aria-label="' + (item.active ? 'Tạm ngưng ' : 'Kích hoạt ') + esc(item.name) + '" title="' + (item.active ? 'Tạm ngưng' : 'Kích hoạt lại') + '">' + icon(item.active ? 'eye' : 'check') + '</button><button type="button" class="sf-icon-button sf-danger" data-act="delete" aria-label="Xóa ' + esc(item.name) + '" title="Xóa">' + icon('close') + '</button></td></tr>').join('') + '</tbody></table></div>';
  }

  // Tab "Gara": đăng nhập Supabase → danh sách + tìm kiếm + thêm / sửa / tạm ngưng / xóa.
  function mountManager(container, client) {
    unmountManager(); geo = client; search = ''; managerHost = container;
    container.innerHTML = '<div class="rc-garage"><div class="rc-garage-bar"><label class="sf-search">' + icon('search') + '<span class="sf-sr-only">Tìm gara</span><input type="search" data-garage-search placeholder="Tìm tên gara, địa chỉ, số điện thoại…" autocomplete="off"></label><span class="sf-count" data-garage-count></span><span class="rc-garage-tools" data-garage-tools></span></div><div data-garage-body></div></div>';
    container.querySelector('[data-garage-search]').addEventListener('input',event => { search = event.target.value; paintManager(); });
    container.addEventListener('click',event => {
      const target = event.target.closest('[data-act],[data-garage-add],[data-garage-reload],[data-garage-signout]'); if (!target) return;
      if (target.hasAttribute('data-garage-add')) return openEditor();
      if (target.hasAttribute('data-garage-reload')) return void load();
      if (target.hasAttribute('data-garage-signout')) return void signOut().catch(error => triggerToast(describe(error),'error'));
      const garage = find(target.closest('tr')?.dataset.id); if (!garage) return;
      if (target.dataset.act === 'edit') openEditor(garage); else if (target.dataset.act === 'toggle') toggle(garage); else erase(garage);
    });
    container.addEventListener('submit',async event => {
      const form = event.target.closest('[data-garage-login]'); if (!form) return;
      event.preventDefault();
      const say = text => { form.querySelector('[data-garage-feedback]').textContent = text || ''; }, button = form.querySelector('button[type=submit]');
      say(''); button.disabled = true;
      try { await signIn(form.elements.email.value,form.elements.password.value); }
      catch (error) { say(error.message); button.disabled = false; }
    });
    unsubscribe = subscribe(paintManager); paintManager();
    if (status === 'ready' && Date.now() - lastSync > 15000) load();  // mở lại tab → làm mới nếu dữ liệu đã cũ
  }
  function unmountManager() { unsubscribe?.(); unsubscribe = null; managerHost = null; closeDialog(); }

  return {subscribe,start,stop,find,list:() => items,active,canManage,save,remove,signIn,signOut,userEmail,reload:load,mountManager,unmountManager,get status() { return status; },get message() { return message; }};
})();
