// Mẫu công văn của người dùng — để AI "lấy mẫu đó làm theo" khi soạn.
// Lưu theo tài khoản: Firebase user_letter_samples/{uid}/{id} = {name, templateId, text, updatedAt} (rules: chỉ chính chủ đọc/ghi),
// dự phòng localStorage khi chưa đăng nhập, chưa publish rules hoặc mất mạng (giống OfficialLetterHistory).
// Phần chọn mẫu (pick) và làm sạch (clean) không đụng DOM/Firebase → có unit test.
const OfficialLetterSamples = (() => {
  const MAX_SAMPLES = 40, MAX_TEXT = 12000, MAX_NAME = 120;
  const LOCAL_PREFIX = 'officialLetter.samples.v1:';
  let state = {uid: '', items: {}, scope: 'browser', loaded: false};

  const user = () => { try { return typeof firebase !== 'undefined' ? firebase.auth().currentUser : null; } catch (_) { return null; } };
  const hasDb = () => typeof dbNodeInstance !== 'undefined' && !!dbNodeInstance;
  const localKey = uid => LOCAL_PREFIX + (uid || 'anon');
  const readLocal = uid => { try { const value = JSON.parse(localStorage.getItem(localKey(uid)) || 'null'); return value && typeof value === 'object' ? value : {}; } catch (_) { return {}; } };
  const writeLocal = (uid, value) => { try { localStorage.setItem(localKey(uid), JSON.stringify(value)); return true; } catch (_) { return false; } };
  const validId = id => typeof id === 'string' && /^[a-z0-9]{6,32}$/.test(id);
  const newId = () => (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).slice(0, 20);
  const oneLine = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const body = value => String(value ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_TEXT);

  // Một mẫu hợp lệ hoặc null.
  function clean(id, raw) {
    if (!validId(id) || !raw || typeof raw !== 'object') return null;
    const text = body(raw.text), name = oneLine(raw.name, MAX_NAME);
    if (!text) return null;
    return {id, name: name || 'Mẫu chưa đặt tên', templateId: oneLine(raw.templateId, 60), text, updatedAt: Number(raw.updatedAt) || 0};
  }
  function cleanMap(raw) {
    const out = {};
    Object.entries(raw && typeof raw === 'object' ? raw : {}).forEach(([id, item]) => { const sample = clean(id, item); if (sample) out[id] = sample; });
    return out;
  }
  const list = () => Object.values(state.items).sort((a, b) => b.updatedAt - a.updatedAt);
  const get = id => state.items[id] || null;

  async function load(force) {
    const uid = (user() && user().uid) || '';
    if (state.loaded && state.uid === uid && !force) return list();
    let remote = null, scope = 'browser';
    if (uid && hasDb()) {
      try { remote = (await dbNodeInstance.ref('user_letter_samples/' + uid).once('value')).val() || {}; scope = 'account'; } catch (_) { remote = null; }
    }
    // Bản lưu tạm trên trình duyệt (khi lỗi mạng/rules) vẫn hiện cùng danh sách tài khoản.
    state = {uid, items: {...cleanMap(readLocal(uid)), ...cleanMap(remote)}, scope, loaded: true};
    return list();
  }
  const scope = () => state.scope;

  async function save(input) {
    await load();
    const uid = state.uid;
    const id = validId(input && input.id) ? input.id : newId();
    const sample = clean(id, {name: input && input.name, templateId: input && input.templateId, text: input && input.text, updatedAt: Date.now()});
    if (!sample) throw new Error('Nội dung mẫu đang trống.');
    if (!state.items[id] && list().length >= MAX_SAMPLES) throw new Error('Tối đa ' + MAX_SAMPLES + ' mẫu — hãy xoá bớt mẫu cũ.');
    state.items[id] = sample;
    let saved = false;
    if (uid && hasDb()) {
      try { await dbNodeInstance.ref('user_letter_samples/' + uid + '/' + id).set({name: sample.name, templateId: sample.templateId, text: sample.text, updatedAt: sample.updatedAt}); saved = true; state.scope = 'account'; } catch (_) { saved = false; }
    }
    if (!saved) { state.scope = 'browser'; writeLocal(uid, state.items); }
    else { const local = readLocal(uid); if (local[id]) { delete local[id]; writeLocal(uid, local); } }
    return sample;
  }

  async function remove(id) {
    await load();
    const uid = state.uid;
    delete state.items[id];
    if (uid && hasDb()) { try { await dbNodeInstance.ref('user_letter_samples/' + uid + '/' + id).remove(); } catch (_) { /* bỏ qua: xoá cả bản tạm trên trình duyệt bên dưới */ } }
    const local = readLocal(uid); if (local[id]) { delete local[id]; writeLocal(uid, local); }
  }

  // Chọn mẫu cho một lần soạn. choice: 'auto' (mặc định) | 'none' | id mẫu.
  //   auto → mẫu mới nhất của người dùng cùng loại công văn; không có thì null (dùng mẫu hệ thống như cũ).
  function pick(samples, choice, templateId) {
    const all = Array.isArray(samples) ? samples : [];
    if (choice === 'none') return null;
    if (choice && choice !== 'auto') return all.find(item => item.id === choice) || null;
    return all.filter(item => item.templateId && item.templateId === templateId).sort((a, b) => b.updatedAt - a.updatedAt)[0] || null;
  }

  return {MAX_SAMPLES, MAX_TEXT, MAX_NAME, clean, load, list, get, save, remove, pick, scope};
})();
