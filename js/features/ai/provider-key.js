// Khoá API của các nhà cung cấp AI phụ (Groq, dịch vụ tương thích OpenAI tuỳ chỉnh…), theo từng tài khoản:
// user_secrets/{uid}/<field> (rules chỉ cho chính chủ đọc/ghi). Chưa publish rules hoặc mất mạng thì dùng localStorage làm dự phòng.
// DeepSeek và Gemini vẫn dùng DeepSeekKeyStore / GeminiKeyStore sẵn có (khoá Gemini dùng chung với Thư viện tài liệu, trợ lý AI).
const ProviderKeyStore = (() => {
  function make({field, local, label}) {
    let cache = {uid: '', key: ''};
    const readLocal = () => { try { return (localStorage.getItem(local) || '').trim(); } catch (_) { return ''; } };
    const writeLocal = key => { try { key ? localStorage.setItem(local, key) : localStorage.removeItem(local); } catch (_) { /* bỏ qua */ } };
    const user = () => { try { return typeof firebase !== 'undefined' ? firebase.auth().currentUser : null; } catch (_) { return null; } };
    const online = () => typeof dbNodeInstance !== 'undefined' && !!dbNodeInstance;
    const node = uid => dbNodeInstance.ref('user_secrets/' + uid + '/' + field);

    async function get() {
      const current = user();
      if (!current || !online()) return readLocal();
      if (cache.uid === current.uid && cache.key) return cache.key;
      try {
        let key = String((await node(current.uid).once('value')).val() || '').trim();
        const stored = readLocal();
        if (!key && stored) {   // chuyển khoá đang lưu trên trình duyệt sang tài khoản; chỉ xoá bản local khi ghi thành công
          await node(current.uid).set(stored);
          writeLocal('');
          key = stored;
        }
        cache = {uid: current.uid, key};
        return key;
      } catch (_) { return readLocal(); }
    }
    async function set(value) {
      const key = String(value || '').trim();
      if (!key) throw new Error('Nhập khoá ' + label + ' API.');
      if (key.length > 200 || /\s/.test(key)) throw new Error('Khoá ' + label + ' API không hợp lệ.');
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
  }
  return {make, groq: make({field: 'groqApiKey', local: 'groq_api_key', label: 'Groq'}), custom: make({field: 'customAiApiKey', local: 'custom_ai_api_key', label: 'AI tuỳ chỉnh'})};
})();
