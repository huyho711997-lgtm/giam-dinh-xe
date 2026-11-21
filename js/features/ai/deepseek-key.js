// Khoá DeepSeek API theo từng tài khoản: lưu tại user_secrets/{uid}/deepseekApiKey (rules chỉ cho chính chủ đọc/ghi).
// Nếu chưa publish rules hoặc mất mạng thì dùng localStorage của trình duyệt làm phương án dự phòng.
const DeepSeekKeyStore = (() => {
  const LOCAL = 'deepseek_api_key';
  let cache = {uid: '', key: ''};
  const readLocal = () => { try { return (localStorage.getItem(LOCAL) || '').trim(); } catch (_) { return ''; } };
  const writeLocal = key => { try { key ? localStorage.setItem(LOCAL, key) : localStorage.removeItem(LOCAL); } catch (_) { /* bỏ qua */ } };
  const user = () => { try { return typeof firebase !== 'undefined' ? firebase.auth().currentUser : null; } catch (_) { return null; } };
  const node = uid => dbNodeInstance.ref('user_secrets/' + uid + '/deepseekApiKey');
  const online = () => typeof dbNodeInstance !== 'undefined' && !!dbNodeInstance;

  async function get() {
    const current = user();
    if (!current || !online()) return readLocal();
    if (cache.uid === current.uid && cache.key) return cache.key;
    try {
      let key = String((await node(current.uid).once('value')).val() || '').trim();
      const local = readLocal();
      if (!key && local) {
        // Di chuyển khoá đang lưu trên trình duyệt này sang tài khoản; chỉ xoá bản local khi ghi thành công.
        await node(current.uid).set(local);
        writeLocal('');
        key = local;
      }
      cache = {uid: current.uid, key};
      return key;
    } catch (_) { return readLocal(); }
  }

  async function set(value) {
    const key = String(value || '').trim();
    if (!key) throw new Error('Nhập khoá DeepSeek API.');
    if (key.length > 200 || /\s/.test(key)) throw new Error('Khoá DeepSeek API không hợp lệ.');
    const current = user();
    if (current && online()) {
      try { await node(current.uid).set(key); cache = {uid: current.uid, key}; writeLocal(''); return {scope: 'account'}; }
      catch (_) { /* rules chưa cho phép → lưu tạm trên trình duyệt */ }
    }
    writeLocal(key);
    cache = {uid: '', key: ''};
    return {scope: 'browser'};
  }

  async function clear() {
    const current = user();
    writeLocal('');
    cache = {uid: '', key: ''};
    if (current && online()) { try { await node(current.uid).remove(); } catch (_) { /* bỏ qua */ } }
  }

  return {get, set, clear};
})();
