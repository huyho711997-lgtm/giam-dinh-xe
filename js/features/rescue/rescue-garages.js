// Danh sách gara cứu hộ dùng chung (Firebase Realtime Database: rescue_garages) + tab quản lý gara của trang Chi phí cứu hộ.
//   rescue_garages/<id> = {name, address, phone, lat, lon, active, note, updatedAt, updatedBy}
// Quyền sửa: quản trị viên hoặc người có quyền chỉnh sửa hồ sơ bồi thường; mọi người dùng đăng nhập đều xem / chọn gara được.
// Rules mẫu: firebase/rescue-garages.rules.json.
const RescueGarages = (() => {
  const PATH = 'rescue_garages';
  let items = [], status = 'idle', message = '', listener = null, subscribers = [], owner = null;

  const db = () => typeof dbNodeInstance !== 'undefined' ? dbNodeInstance : null;
  const user = () => typeof firebase !== 'undefined' ? firebase.auth().currentUser : null;
  const canManage = () => !!user() && typeof hasUserPermission === 'function' && (hasUserPermission('users','admin') || hasUserPermission('pending','edit'));
  const emit = () => subscribers.slice().forEach(callback => { try { callback(); } catch (error) { console.error(error); } });
  const byName = (a, b) => a.name.localeCompare(b.name,'vi');

  function read(value) {
    items = Object.entries(value || {}).map(([id,raw]) => RescueGeo.sanitizeGarage(raw,id)).filter(Boolean).sort(byName);
    status = 'ready'; message = ''; emit();
  }
  function start() {
    // Đổi tài khoản → bỏ listener cũ (quyền đọc theo người dùng) rồi nghe lại.
    if (listener && owner !== user()?.uid) { const keep = subscribers; stop(); subscribers = keep; }
    owner = user()?.uid || null;
    if (listener || !db()) { if (!db()) { status = 'error'; message = 'Chưa kết nối cơ sở dữ liệu.'; emit(); } return; }
    status = 'loading'; emit();
    const reference = db().ref(PATH);
    listener = reference.on('value',snapshot => read(snapshot.val()),error => {
      status = 'error';
      message = error?.code === 'PERMISSION_DENIED' ? 'Chưa đọc được danh sách gara: cần gộp firebase/rescue-garages.rules.json vào Firebase Rules.' : 'Không tải được danh sách gara. Kiểm tra kết nối rồi thử lại.';
      emit();
    });
  }
  function stop() { if (listener && db()) db().ref(PATH).off('value',listener); listener = null; subscribers = []; items = []; status = 'idle'; }
  function subscribe(callback) { subscribers.push(callback); start(); return () => { subscribers = subscribers.filter(item => item !== callback); }; }
  const find = id => items.find(item => item.id === id) || null;
  const active = () => items.filter(item => item.active);

  const newId = () => 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  function writeError(error) {
    return new Error(error?.code === 'PERMISSION_DENIED'
      ? 'Chưa lưu được: cần gộp firebase/rescue-garages.rules.json vào Firebase Rules và có quyền chỉnh sửa.'
      : 'Chưa lưu được gara: ' + (error?.message || 'lỗi không xác định'));
  }
  async function save(raw, id) {
    if (!canManage()) throw new Error('Bạn không có quyền quản lý danh sách gara.');
    const garage = RescueGeo.sanitizeGarage(raw,id || newId());
    if (!garage) throw new Error('Nhập tên gara và toạ độ hợp lệ (vĩ độ −90…90, kinh độ −180…180).');
    const record = {name:garage.name,address:garage.address,phone:garage.phone,lat:garage.lat,lon:garage.lon,active:garage.active,note:garage.note,updatedAt:Date.now(),updatedBy:String(user()?.email || '').slice(0,200)};
    try { await db().ref(PATH + '/' + garage.id).set(record); } catch (error) { throw writeError(error); }
    return garage.id;
  }
  async function remove(id) {
    if (!canManage()) throw new Error('Bạn không có quyền quản lý danh sách gara.');
    try { await db().ref(PATH + '/' + id).remove(); } catch (error) { throw writeError(error); }
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

  function paintManager() {
    if (!managerHost?.isConnected) return;
    const list = managerHost.querySelector('[data-garage-body]'), manage = canManage(), query = RescueGeo.normalize(search);
    const rows = items.filter(item => !query || RescueGeo.normalize(item.name + ' ' + item.address + ' ' + item.phone).includes(query));
    managerHost.querySelector('[data-garage-count]').textContent = status === 'ready' ? (query ? rows.length + '/' : '') + items.length + ' gara · ' + active().length + ' đang hoạt động' : '';
    if (status === 'loading' || status === 'idle') { list.innerHTML = '<div class="rc-garage-empty">Đang tải danh sách gara…</div>'; return; }
    if (status === 'error') { list.innerHTML = '<div class="rc-garage-empty is-error">' + esc(message) + '</div>'; return; }
    if (!rows.length) { list.innerHTML = '<div class="rc-garage-empty">' + (items.length ? 'Không có gara phù hợp với từ khóa.' : 'Chưa có gara nào. ' + (manage ? 'Bấm “Thêm gara” để tạo gara đầu tiên.' : 'Quản trị viên sẽ thêm gara vào danh sách.')) + '</div>'; return; }
    list.innerHTML = '<div class="rc-table-wrap"><table class="rc-table rc-garage-table"><thead><tr><th>Gara</th><th>Địa chỉ</th><th>Điện thoại</th><th>Trạng thái</th>' + (manage ? '<th></th>' : '') + '</tr></thead><tbody>' + rows.map(item => '<tr data-id="' + esc(item.id) + '"><td><strong>' + esc(item.name) + '</strong><small>' + item.lat.toFixed(5) + ', ' + item.lon.toFixed(5) + '</small></td><td>' + esc(item.address || '—') + (item.note ? '<small>' + esc(item.note) + '</small>' : '') + '</td><td>' + (item.phone ? '<a href="tel:' + esc(item.phone.replace(/[^\d+]/g,'')) + '">' + esc(item.phone) + '</a>' : '—') + '</td><td><span class="rc-badge' + (item.active ? ' is-on' : '') + '">' + (item.active ? 'Hoạt động' : 'Tạm ngưng') + '</span></td>' +
      (manage ? '<td class="rc-garage-actions"><button type="button" class="sf-icon-button" data-act="edit" aria-label="Sửa ' + esc(item.name) + '" title="Sửa">' + icon('file') + '</button><button type="button" class="sf-icon-button" data-act="toggle" aria-label="' + (item.active ? 'Tạm ngưng ' : 'Kích hoạt ') + esc(item.name) + '" title="' + (item.active ? 'Tạm ngưng' : 'Kích hoạt lại') + '">' + icon(item.active ? 'eye' : 'check') + '</button><button type="button" class="sf-icon-button sf-danger" data-act="delete" aria-label="Xóa ' + esc(item.name) + '" title="Xóa">' + icon('close') + '</button></td>' : '') + '</tr>').join('') + '</tbody></table></div>';
  }

  // Tab "Gara": danh sách + tìm kiếm + thêm / sửa / tạm ngưng / xóa.
  function mountManager(container, client) {
    unmountManager(); geo = client; search = ''; managerHost = container;
    const manage = canManage();
    container.innerHTML = '<div class="rc-garage"><div class="rc-garage-bar"><label class="sf-search">' + icon('search') + '<span class="sf-sr-only">Tìm gara</span><input type="search" data-garage-search placeholder="Tìm tên gara, địa chỉ, số điện thoại…" autocomplete="off"></label><span class="sf-count" data-garage-count></span>' +
      (manage ? '<button type="button" class="sf-button sf-primary" data-garage-add>' + icon('upload') + 'Thêm gara</button>' : '') + '</div>' +
      (manage ? '' : '<p class="rc-garage-note">Bạn chỉ xem được danh sách. Quản trị viên hoặc người có quyền chỉnh sửa hồ sơ mới thêm / sửa được gara.</p>') + '<div data-garage-body></div></div>';
    container.querySelector('[data-garage-search]').addEventListener('input',event => { search = event.target.value; paintManager(); });
    container.querySelector('[data-garage-add]')?.addEventListener('click',() => openEditor());
    container.addEventListener('click',event => {
      const button = event.target.closest('[data-act]'); if (!button) return;
      const garage = find(button.closest('tr')?.dataset.id); if (!garage) return;
      if (button.dataset.act === 'edit') openEditor(garage); else if (button.dataset.act === 'toggle') toggle(garage); else erase(garage);
    });
    unsubscribe = subscribe(paintManager); paintManager();
  }
  function unmountManager() { unsubscribe?.(); unsubscribe = null; managerHost = null; closeDialog(); }

  return {subscribe,start,stop,find,list:() => items,active,canManage,save,remove,mountManager,unmountManager,get status() { return status; },get message() { return message; }};
})();
