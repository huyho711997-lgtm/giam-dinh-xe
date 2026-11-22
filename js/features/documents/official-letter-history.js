// Lịch sử Công văn AI theo từng tài khoản — Firebase user_letters/{uid} (rules: chỉ chính chủ đọc/ghi),
// dự phòng localStorage khi chưa đăng nhập, chưa publish rules hoặc mất mạng (giống TascoChatStore của Trợ lý AI).
//   user_letters/{uid}/index/{id} = {title, sub, updatedAt}   ← nhẹ, tải khi mở trang để hiện danh sách
//   user_letters/{uid}/items/{id} = {data, updatedAt}          ← toàn bộ phiên (chuỗi JSON), chỉ tải khi mở lại công văn đó
// Không lưu ảnh/PDF đính kèm (chỉ tên tệp) và không lưu khoá API.
const OfficialLetterHistory = (() => {
  const MAX_ITEMS = 60, MAX_LOCAL = 25, MAX_DATA = 150000, MAX_TITLE = 300, MAX_SUB = 300;
  const LOCAL_PREFIX = 'officialLetter.history.v1:';
  let state = {uid: '', index: {}, scope: 'browser', loaded: false};

  const user = () => { try { return typeof firebase !== 'undefined' ? firebase.auth().currentUser : null; } catch (_) { return null; } };
  const hasDb = () => typeof dbNodeInstance !== 'undefined' && !!dbNodeInstance;
  const ref = path => dbNodeInstance.ref('user_letters/' + state.uid + (path ? '/' + path : ''));
  const localKey = uid => LOCAL_PREFIX + (uid || 'anon');
  const readLocal = uid => { try { const value = JSON.parse(localStorage.getItem(localKey(uid)) || 'null'); return value && typeof value === 'object' ? value : {index: {}, items: {}}; } catch (_) { return {index: {}, items: {}}; } };
  const writeLocal = (uid, value) => { try { localStorage.setItem(localKey(uid), JSON.stringify(value)); return true; } catch (_) { return false; } };
  const clip = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const validId = id => typeof id === 'string' && /^[a-z0-9]{6,32}$/.test(id);
  const newId = () => (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).slice(0, 20);

  function cleanIndex(raw) {
    const out = {};
    Object.entries(raw && typeof raw === 'object' ? raw : {}).forEach(([id, item]) => {
      if (!validId(id) || !item || typeof item !== 'object') return;
      out[id] = {title: clip(item.title, MAX_TITLE) || 'Công văn chưa có trích yếu', sub: clip(item.sub, MAX_SUB), updatedAt: Number(item.updatedAt) || 0};
    });
    return out;
  }

  async function load(force) {
    const uid = (user() && user().uid) || '';
    if (state.loaded && state.uid === uid && !force) return list();
    let index = null, scope = 'browser';
    if (uid && hasDb()) {
      try { index = (await dbNodeInstance.ref('user_letters/' + uid + '/index').once('value')).val() || {}; scope = 'account'; } catch (_) { index = null; }
    }
    const local = readLocal(uid);
    // Bản lưu tạm trên trình duyệt (khi lỗi mạng/rules) vẫn hiện cùng danh sách tài khoản.
    state = {uid, index: {...cleanIndex(local.index), ...cleanIndex(index)}, scope, loaded: true};
    return list();
  }

  // Mới nhất trước.
  const list = () => Object.entries(state.index).map(([id, item]) => ({id, ...item})).sort((a, b) => b.updatedAt - a.updatedAt);

  async function get(id) {
    if (!validId(id)) return null;
    let text = '';
    if (state.uid && hasDb() && state.scope === 'account') {
      try { const item = (await ref('items/' + id).once('value')).val(); text = item && typeof item.data === 'string' ? item.data : ''; } catch (_) { text = ''; }
    }
    if (!text) { const local = readLocal(state.uid); text = local.items && typeof local.items[id] === 'string' ? local.items[id] : ''; }
    try { return text ? JSON.parse(text) : null; } catch (_) { return null; }
  }

  // entry: {title, sub, data(object)}; trả {id, scope}. Ghi đè nếu id đã có.
  async function save(id, entry) {
    if (!state.loaded) await load();
    const key = validId(id) ? id : newId();
    let data = JSON.stringify(entry.data || {});
    if (data.length > MAX_DATA) throw new Error('Công văn quá dài để lưu vào lịch sử.');
    const meta = {title: clip(entry.title, MAX_TITLE) || 'Công văn chưa có trích yếu', sub: clip(entry.sub, MAX_SUB), updatedAt: entry.keepTime && state.index[key] ? state.index[key].updatedAt : Date.now()};
    state.index[key] = meta;
    const stale = list().slice(MAX_ITEMS).map(item => item.id);   // giữ tối đa MAX_ITEMS bản mới nhất
    stale.forEach(old => { delete state.index[old]; });
    if (state.uid && hasDb()) {
      try {
        const updates = {['index/' + key]: meta, ['items/' + key]: {data, updatedAt: meta.updatedAt}};
        stale.forEach(old => { updates['index/' + old] = null; updates['items/' + old] = null; });
        await ref('').update(updates);
        state.scope = 'account';
        const local = readLocal(state.uid);   // đã lên tài khoản → bỏ bản tạm cùng id
        if (local.index && local.index[key]) { delete local.index[key]; delete local.items[key]; writeLocal(state.uid, local); }
        return {id: key, scope: 'account'};
      } catch (_) { /* rules chưa cho phép / mất mạng → lưu trên trình duyệt */ }
    }
    state.scope = 'browser';
    const local = readLocal(state.uid);
    local.index = cleanIndex(local.index); local.items = local.items && typeof local.items === 'object' ? local.items : {};
    local.index[key] = meta; local.items[key] = data;
    Object.keys(local.index).sort((a, b) => local.index[b].updatedAt - local.index[a].updatedAt).slice(MAX_LOCAL).forEach(old => { delete local.index[old]; delete local.items[old]; });
    if (!writeLocal(state.uid, local)) throw new Error('Bộ nhớ trình duyệt đã đầy, không lưu được lịch sử.');
    return {id: key, scope: 'browser'};
  }

  // Đổi tên một công văn trong lịch sử: tên tuỳ đặt nằm trong data.customTitle (index chỉ cho title/sub/updatedAt theo rules) và giữ nguyên thời gian cập nhật.
  async function rename(id, title) {
    const name = clip(title, MAX_TITLE);
    if (!validId(id) || !name) return false;
    if (!state.loaded) await load();
    const current = state.index[id];
    if (!current) return false;
    const data = await get(id);
    if (!data) return false;
    data.customTitle = name;
    await save(id, {title: name, sub: current.sub, data, keepTime: true});
    return true;
  }

  async function remove(id) {
    if (!validId(id)) return;
    delete state.index[id];
    if (state.uid && hasDb()) { try { await ref('').update({['index/' + id]: null, ['items/' + id]: null}); } catch (_) { /* bỏ qua */ } }
    const local = readLocal(state.uid);
    if (local.index && local.index[id]) { delete local.index[id]; if (local.items) delete local.items[id]; writeLocal(state.uid, local); }
  }

  async function removeMany(ids) {
    const valid = [...new Set((Array.isArray(ids) ? ids : []).filter(validId))];
    if (!valid.length) return 0;
    const updates = {};
    valid.forEach(id => {
      delete state.index[id];
      updates['index/' + id] = null;
      updates['items/' + id] = null;
    });
    if (state.uid && hasDb()) { try { await ref('').update(updates); } catch (_) { /* bỏ qua */ } }
    const local = readLocal(state.uid);
    let localChanged = false;
    valid.forEach(id => {
      if (local.index && local.index[id]) { delete local.index[id]; localChanged = true; }
      if (local.items && local.items[id] !== undefined) { delete local.items[id]; localChanged = true; }
    });
    if (localChanged) writeLocal(state.uid, local);
    return valid.length;
  }

  // Nhóm theo thời gian cho thanh lịch sử.
  function groups(items, now) {
    const start = new Date(now || Date.now()); start.setHours(0, 0, 0, 0);
    const today = start.getTime(), day = 86400000;
    const buckets = [['Hôm nay', item => item.updatedAt >= today], ['Hôm qua', item => item.updatedAt >= today - day], ['7 ngày qua', item => item.updatedAt >= today - 7 * day], ['30 ngày qua', item => item.updatedAt >= today - 30 * day], ['Cũ hơn', () => true]];
    const out = [];
    items.forEach(item => {
      const label = buckets.find(([, match]) => match(item))[0];
      let group = out.find(entry => entry.label === label);
      if (!group) out.push(group = {label, items: []});
      group.items.push(item);
    });
    return out;
  }

  return {load, list, get, save, rename, remove, removeMany, groups, newId, scope: () => state.scope, MAX_ITEMS};
})();
