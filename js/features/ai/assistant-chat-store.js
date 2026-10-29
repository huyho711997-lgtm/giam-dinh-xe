// Lịch sử trò chuyện của Trợ lý AI theo từng tài khoản: Firebase user_chats/{uid} (rules chỉ cho chính chủ),
// dự phòng localStorage khi chưa publish rules hoặc mất mạng. Chỉ lưu văn bản thuần (không lưu HTML, ảnh, bản nháp biểu mẫu).
const TascoChatStore = (() => {
  const MAX_MESSAGES = 40, MAX_TEXT = 4000, MAX_FREQ = 12, MAX_QUESTION = 120, SAVE_DELAY = 700;
  let state = {uid: '', messages: [], freq: [], scope: 'browser', loaded: false};
  let timer = null;

  const user = () => { try { return typeof firebase !== 'undefined' ? firebase.auth().currentUser : null; } catch (_) { return null; } };
  const hasDb = () => typeof dbNodeInstance !== 'undefined' && !!dbNodeInstance;
  const node = uid => dbNodeInstance.ref('user_chats/' + uid);
  const localKey = uid => 'tasco_ai_chat_v1:' + (uid || 'anon');
  const readLocal = uid => { try { return JSON.parse(localStorage.getItem(localKey(uid)) || 'null'); } catch (_) { return null; } };
  const writeLocal = (uid, value) => { try { value ? localStorage.setItem(localKey(uid), JSON.stringify(value)) : localStorage.removeItem(localKey(uid)); } catch (_) { /* bỏ qua */ } };
  const asList = value => !value ? [] : Array.isArray(value) ? value : Object.keys(value).sort((first, second) => Number(first) - Number(second)).map(key => value[key]);
  const normKey = text => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  function clean(data) {
    const messages = asList(data?.messages).filter(item => item && (item.r === 'u' || item.r === 'a') && typeof item.x === 'string' && item.x.trim())
      .map(item => ({r: item.r, x: item.x.slice(0, MAX_TEXT), t: Number(item.t) || 0})).slice(-MAX_MESSAGES);
    const freq = asList(data?.freq).filter(item => item && typeof item.k === 'string' && typeof item.x === 'string' && Number(item.n) > 0)
      .map(item => ({k: item.k.slice(0, MAX_QUESTION), x: item.x.slice(0, MAX_QUESTION), n: Math.floor(Number(item.n))})).slice(0, MAX_FREQ);
    return {messages, freq};
  }

  async function load() {
    const current = user();
    const uid = current?.uid || '';
    if (state.loaded && state.uid === uid) return state;
    let data = null, scope = 'browser';
    if (uid && hasDb()) {
      try { data = (await node(uid).once('value')).val(); scope = 'account'; } catch (_) { data = null; }
    }
    if (!data) data = readLocal(uid);
    state = {uid, ...clean(data), scope, loaded: true};
    return state;
  }

  async function persist() {
    timer = null;
    const {uid, messages, freq} = state;
    const payload = {updatedAt: Date.now(), messages, freq};
    if (uid && hasDb()) {
      try {
        if (!messages.length && !freq.length) await node(uid).remove(); else await node(uid).set(payload);
        writeLocal(uid, null);
        state.scope = 'account';
        return;
      } catch (_) { /* rules chưa cho phép → lưu trên trình duyệt */ }
    }
    state.scope = 'browser';
    writeLocal(uid, messages.length || freq.length ? payload : null);
  }
  const schedule = () => { clearTimeout(timer); timer = setTimeout(persist, SAVE_DELAY); };
  async function flush() { clearTimeout(timer); await persist(); }

  function add(role, text) {
    const value = String(text ?? '').trim();
    if (!value || !state.loaded) return;
    state.messages.push({r: role === 'user' ? 'u' : 'a', x: value.slice(0, MAX_TEXT), t: Date.now()});
    if (state.messages.length > MAX_MESSAGES) state.messages = state.messages.slice(-MAX_MESSAGES);
    schedule();
  }
  // Đếm câu hỏi ngắn lặp lại để gợi ý "hay hỏi" (không lưu câu dài hoặc có chứa dữ liệu nhập riêng).
  function countQuestion(text) {
    const value = String(text ?? '').trim();
    const key = normKey(value);
    if (!state.loaded || !key || value.length > MAX_QUESTION) return;
    const found = state.freq.find(item => item.k === key);
    if (found) { found.n++; found.x = value; } else state.freq.push({k: key, x: value, n: 1});
    state.freq.sort((first, second) => second.n - first.n);
    state.freq = state.freq.slice(0, MAX_FREQ);
    schedule();
  }
  const frequent = (limit = 3) => state.freq.filter(item => item.n >= 2).slice(0, limit).map(item => item.x);
  async function clear() { state.messages = []; await flush(); }

  return {load, add, countQuestion, frequent, clear, flush, get messages() { return state.messages; }, get scope() { return state.scope; }, get uid() { return state.uid; }, _normKey: normKey};
})();
