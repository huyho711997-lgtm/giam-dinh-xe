// Công văn AI — nhiều nhà cung cấp/mô hình AI. Mọi nhà cung cấp đều dùng API tương thích OpenAI (POST <base>/chat/completions):
// DeepSeek, Gemini (gói miễn phí), Groq (gói miễn phí) và một mục "Tuỳ chỉnh" cho dịch vụ khác (OpenRouter, Cerebras, Ollama…).
// Cấu hình (không chứa khoá) lưu ở localStorage; khoá lưu theo tài khoản qua DeepSeekKeyStore / GeminiKeyStore / ProviderKeyStore.
// Tên mô hình đổi rất nhanh nên người dùng tự sửa được, và có nút lấy danh sách mô hình thật từ nhà cung cấp.
const OfficialLetterModels = (() => {
  const KEY = 'officialLetter.aiConfig.v1';
  const ORDER = ['deepseek', 'gemini', 'groq', 'custom'];
  const PROVIDERS = {
    antigravity: {id: 'antigravity', label: 'Antigravity trên máy này', base: 'http://127.0.0.1:18318/v1', models: ['gemini-3.8-flash-tiered', 'gemini-3-flash'], keyUrl: '', free: false},
    deepseek: {id: 'deepseek', label: 'DeepSeek', base: 'https://api.deepseek.com', models: ['deepseek-flash'], keyUrl: 'https://platform.deepseek.com/api_keys', keyHint: 'sk-••••••••••••••••', free: false,
      note: 'Trả phí theo token (rẻ). Có chế độ suy luận sâu, đọc tốt tiếng Việt.'},
    gemini: {id: 'gemini', label: 'Google Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', models: ['gemini-3.8-flash'], keyUrl: 'https://aistudio.google.com/apikey', keyHint: 'AIza••••••••••••', free: true,
      note: 'Có gói miễn phí (giới hạn lượt/ngày), đọc được ảnh, ngữ cảnh lớn. Dùng chung khoá với Thư viện tài liệu. Gói miễn phí có thể được Google dùng để cải thiện sản phẩm — đừng gửi dữ liệu nhạy cảm.'},
    groq: {id: 'groq', label: 'Groq', base: 'https://api.groq.com/openai/v1', models: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile'], keyUrl: 'https://console.groq.com/keys', keyHint: 'gsk_••••••••••••', free: true,
      note: 'Miễn phí, rất nhanh nhưng giới hạn khoảng 8.000 token/phút: hợp để hỏi nghiệp vụ ngắn, không hợp soạn công văn dài hay đọc ảnh.'},
    custom: {id: 'custom', label: 'Tuỳ chỉnh (OpenAI)', base: '', models: [], keyUrl: '', keyHint: 'Khoá API của dịch vụ', free: false,
      note: 'Dịch vụ bất kỳ tương thích OpenAI: OpenRouter (có model miễn phí), Cerebras, Together, Ollama cục bộ… Nhập địa chỉ gốc, ví dụ https://openrouter.ai/api/v1.'}
  };
  const MODEL_RE = /^[\w./:@+\-]{1,100}$/;

  const clean = value => String(value == null ? '' : value).trim();
  function normalizeBase(value) {
    let url = clean(value).replace(/\/+$/, '');
    url = url.replace(/\/chat\/completions$/i, '');
    if (!/^https:\/\/[^\s/]+/i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url)) return '';
    return url.slice(0, 300);
  }
  const uniq = list => Array.from(new Set(list));
  const parseModels = value => uniq((Array.isArray(value) ? value : String(value || '').split(/[,\n;]+/)).map(clean).filter(name => MODEL_RE.test(name))).slice(0, 12);

  // DeepSeek: tôn trọng khoá cài đặt cũ 'deepseek_letter_model' nếu có.
  function defModels(id) {
    if (id === 'deepseek') { try { const legacy = clean(localStorage.getItem('deepseek_letter_model')); if (MODEL_RE.test(legacy)) return [legacy]; } catch (_) { /* bỏ qua */ } }
    return PROVIDERS[id].models.slice();
  }
  function defaults() { return normalize(null); }
  function normalize(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const providers = {};
    for (const id of ORDER) {
      const saved = source.providers && source.providers[id] || {};
      const def = PROVIDERS[id];
      const models = parseModels(saved.models);
      providers[id] = {models: models.length ? models : (saved.models === undefined || id !== 'custom' ? defModels(id) : [])};
      if (id === 'custom') { providers[id].base = normalizeBase(saved.base); providers[id].label = clean(saved.label).slice(0, 40); }
    }
    const cfg = {selected: '', providers};
    const ids = entries(cfg).map(entry => entry.id);
    cfg.selected = ids.includes(source.selected) ? source.selected : (ids[0] || '');
    return cfg;
  }
  function load() {
    try { return normalize(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (_) { return defaults(); }
  }
  function save(cfg) {
    const next = normalize(cfg);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (_) { /* hết chỗ lưu: giữ trong phiên */ }
    return next;
  }

  const shortModel = model => String(model).split('/').pop();
  const providerLabel = (id, cfg) => id === 'custom' ? ((cfg && cfg.providers.custom.label) || PROVIDERS.custom.label) : PROVIDERS[id].label;
  function entries(cfg) {
    const out = [];
    for (const id of ORDER) for (const model of cfg.providers[id].models) out.push({id: id + ':' + model, provider: id, model, label: providerLabel(id, cfg) + ' · ' + shortModel(model)});
    for (const model of PROVIDERS.antigravity.models) out.push({id: 'antigravity:' + model, provider: 'antigravity', model, label: 'Antigravity trên máy này · ' + model});
    return out;
  }
  function baseOf(id, cfg) { return id === 'custom' ? cfg.providers.custom.base : PROVIDERS[id].base; }
  const endpointOf = (id, cfg) => { const base = baseOf(id, cfg); return base ? base + '/chat/completions' : ''; };

  // Khả năng của từng mô hình: kiểu suy luận ('deepseek' = tham số thinking; 'effort' = reasoning_effort; 'none' = không có), đọc ảnh, giới hạn đầu ra và số nguồn tra cứu.
  function profile(providerId, model) {
    if (providerId === 'deepseek') return {reasoning: 'deepseek', vision: true, maxOut: 0, maxSources: 0};
    if (providerId === 'gemini') return {reasoning: 'effort', effortOn: 'high', effortOff: 'low', vision: true, maxOut: 0, maxSources: 0};
    // Antigravity (qua CLIProxyAPI): reasoning_effort được dịch sang thinkingLevel của Gemini 3 — "high" suy luận sâu hơn "low" nhiều lần.
    if (providerId === 'antigravity') return {reasoning: 'effort', effortOn: 'high', effortOff: 'low', vision: true, maxOut: 0, maxSources: 0};
    if (providerId === 'groq') return {reasoning: /gpt-oss/i.test(model) ? 'effort' : 'none', effortOn: 'medium', effortOff: 'low', vision: /llama-4|scout|maverick|vision/i.test(model), maxOut: 4000, maxSources: 5};
    return {reasoning: 'none', vision: true, maxOut: 0, maxSources: 0};
  }
  // Hạn chờ một lượt gọi (mili giây; 0 = không đặt thêm). Antigravity đi qua cầu nối cục bộ (tối đa 180 giây): lượt thường cắt sớm để báo lỗi kết nối,
  // lượt suy luận sâu cần lâu hơn nhưng vẫn ngắn hơn hạn của cầu nối để người dùng nhận được thông báo rõ ràng.
  const timeoutMs = (providerId, thinking) => providerId !== 'antigravity' ? 0 : thinking ? 170000 : 45000;
  // Trả về mô hình đang chọn (hoặc theo id) cùng mọi thứ cần để gọi API.
  function resolve(cfg, id) {
    const all = entries(cfg);
    const entry = all.find(item => item.id === (id || cfg.selected)) || all[0];
    if (!entry) return null;
    return Object.assign({}, entry, {providerLabel: providerLabel(entry.provider, cfg), endpoint: endpointOf(entry.provider, cfg), profile: profile(entry.provider, entry.model), free: PROVIDERS[entry.provider].free});
  }

  // Kho khoá của từng nhà cung cấp (nạp lười để module chạy được cả khi thiếu một kho).
  function store(providerId) {
    if (providerId === 'deepseek') return typeof DeepSeekKeyStore !== 'undefined' ? DeepSeekKeyStore : null;
    if (providerId === 'gemini') return typeof GeminiKeyStore !== 'undefined' ? GeminiKeyStore : null;
    if (typeof ProviderKeyStore !== 'undefined') return ProviderKeyStore[providerId] || null;
    return null;
  }
  async function getKey(providerId) {
    try {
      if (providerId === 'antigravity') {
        const user = typeof firebase !== 'undefined' ? firebase.auth().currentUser : null;
        if (!user) return '';
        let timer;
        try { return await Promise.race([user.getIdToken(), new Promise(resolve => { timer = setTimeout(() => resolve(''), 10000); })]); }
        finally { clearTimeout(timer); }
      }
      const s = store(providerId); return s ? clean(await s.get()) : '';
    } catch (_) { return ''; }
  }
  async function keyStatus() {
    const out = {};
    await Promise.all([...ORDER, 'antigravity'].map(async id => { out[id] = !!(await getKey(id)); }));
    return out;
  }
  function noKeyMessage(providerId, cfg) {
    if (providerId === 'antigravity') return 'Không xác minh được tài khoản website. Kiểm tra kết nối mạng và đăng nhập lại rồi thử Antigravity.';
    const p = PROVIDERS[providerId];
    return 'Chưa có khoá ' + providerLabel(providerId, cfg) + '. Bấm biểu tượng ⚙ ở góc phải để nhập khoá' + (p.keyUrl ? ' (lấy tại ' + p.keyUrl.replace(/^https:\/\//, '') + ')' : '') + ', hoặc chọn mô hình khác ở nút Mô hình.';
  }

  // Lấy danh sách mô hình thật mà khoá này dùng được (GET <base>/models).
  async function listModels(providerId, cfg, options = {}) {
    const base = baseOf(providerId, cfg);
    if (!base) throw new Error('Nhập địa chỉ gốc API (https://…) trước.');
    const apiKey = options.apiKey || await getKey(providerId);
    if (!apiKey) throw new Error('Nhập khoá API trước khi lấy danh sách mô hình.');
    const doFetch = options.fetchImpl || fetch;
    let response;
    try { response = await doFetch(base + '/models', {headers: {Authorization: 'Bearer ' + apiKey}}); }
    catch (_) { throw new Error('Không kết nối được tới ' + providerLabel(providerId, cfg) + ' để lấy danh sách mô hình.'); }
    let data = null;
    try { data = await response.json(); } catch (_) { /* không phải JSON */ }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error('Khoá ' + providerLabel(providerId, cfg) + ' không đúng hoặc chưa có quyền.');
      throw new Error(providerLabel(providerId, cfg) + ' lỗi HTTP ' + response.status + ' khi lấy danh sách mô hình.');
    }
    const list = Array.isArray(data) ? data : Array.isArray(data && data.data) ? data.data : Array.isArray(data && data.models) ? data.models : [];
    let ids = list.map(item => clean(item && (item.id || item.name)).replace(/^models\//, '')).filter(Boolean);
    if (providerId === 'gemini') ids = ids.filter(id => /^(gemini|gemma)/i.test(id) && !/embed|image|tts|aqa|veo|imagen|live|audio/i.test(id));
    if (providerId === 'groq') ids = ids.filter(id => !/whisper|tts|guard|embed|orpheus|playai|distil/i.test(id));
    return uniq(ids).filter(id => MODEL_RE.test(id)).sort();
  }

  return {KEY, ORDER, PROVIDERS, defaults, normalize, load, save, entries, resolve, profile, endpointOf, baseOf, timeoutMs, providerLabel, shortModel, parseModels, normalizeBase, getKey, keyStatus, noKeyMessage, listModels};
})();
