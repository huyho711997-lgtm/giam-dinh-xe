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
  const TAILSCALE_HOST_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.){2,}ts\.net$/i;

  const clean = value => String(value == null ? '' : value).trim();
  function normalizeBase(value) {
    let url = clean(value).replace(/\/+$/, '');
    url = url.replace(/\/chat\/completions$/i, '');
    if (!/^https:\/\/[^\s/]+/i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url)) return '';
    return url.slice(0, 300);
  }
  // Địa chỉ máy trung gian Antigravity tuỳ chọn: CHỈ chấp nhận HTTPS Tailscale (*.ts.net), không user/pass, không query/hash.
  // Trả về chuỗi chuẩn hoá "<origin>/v1" hoặc '' nếu rỗng / không hợp lệ.
  function normalizeAntigravityBase(value) {
    const raw = clean(value);
    if (!raw || raw.length > 300 || /[\s?#\\@]/.test(raw)) return '';
    const match = /^https:\/\/([^/:]+)(?::(\d{1,5}))?(\/.*)?$/i.exec(raw);
    if (!match) return '';
    const host = match[1].toLowerCase(), portRaw = match[2] || '', pathRaw = (match[3] || '').replace(/\/+$/, '');
    if (!TAILSCALE_HOST_RE.test(host)) return '';
    let portPart = '';
    if (portRaw) {
      const port = Number(portRaw);
      if (!Number.isInteger(port) || port < 1 || port > 65535) return '';
      if (port !== 443) portPart = ':' + port;
    }
    if (pathRaw && !/^\/v1(?:\/chat\/completions)?$/i.test(pathRaw)) return '';
    return ('https://' + host + portPart + '/v1').slice(0, 300);
  }
  const uniq = list => Array.from(new Set(list));
  // Mô hình Antigravity do máy trung gian liệt kê (gemini-3-pro-high, claude-…-thinking, gpt-oss-…): bỏ loại không dùng để trò chuyện.
  const AGY_SKIP = /embed|image|imagen|tts|veo|audio|live|aqa|rerank|moderation/i;
  const parseAgyModels = value => uniq((Array.isArray(value) ? value : []).map(clean).filter(name => MODEL_RE.test(name) && !AGY_SKIP.test(name))).slice(0, 40);
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
    const savedAgy = source.providers && source.providers.antigravity || {};
    providers.antigravity = {base: normalizeAntigravityBase(savedAgy.base), models: parseAgyModels(savedAgy.models)};
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
  const antigravityCustomBase = cfg => (cfg && cfg.providers && cfg.providers.antigravity && normalizeAntigravityBase(cfg.providers.antigravity.base)) || '';
  const providerLabel = (id, cfg) => {
    if (id === 'custom') return (cfg && cfg.providers.custom.label) || PROVIDERS.custom.label;
    if (id === 'antigravity') return antigravityCustomBase(cfg) ? 'Antigravity (Tailscale)' : PROVIDERS.antigravity.label;
    return PROVIDERS[id].label;
  };
  function entries(cfg) {
    const out = [];
    for (const id of ORDER) for (const model of cfg.providers[id].models) out.push({id: id + ':' + model, provider: id, model, label: providerLabel(id, cfg) + ' · ' + shortModel(model)});
    const agyModels = uniq(PROVIDERS.antigravity.models.concat(cfg && cfg.providers && cfg.providers.antigravity && cfg.providers.antigravity.models || []));
    for (const model of agyModels) out.push({id: 'antigravity:' + model, provider: 'antigravity', model, label: providerLabel('antigravity', cfg) + ' · ' + model});
    return out;
  }
  function baseOf(id, cfg) {
    if (id === 'custom') return cfg.providers.custom.base;
    if (id === 'antigravity') return antigravityCustomBase(cfg) || PROVIDERS.antigravity.base;
    return PROVIDERS[id].base;
  }
  const endpointOf = (id, cfg) => { const base = baseOf(id, cfg); return base ? base + '/chat/completions' : ''; };

  // Khả năng của từng mô hình: kiểu suy luận ('deepseek' = tham số thinking; 'effort' = reasoning_effort; 'none' = không có), đọc ảnh, giới hạn đầu ra và số nguồn tra cứu.
  function profile(providerId, model) {
    if (providerId === 'deepseek') return {reasoning: 'deepseek', vision: true, maxOut: 0, maxSources: 0};
    if (providerId === 'gemini') return {reasoning: 'effort', effortOn: 'high', effortOff: 'low', vision: true, maxOut: 0, maxSources: 0};
    // Antigravity (qua CLIProxyAPI): reasoning_effort được dịch sang thinkingLevel của Gemini 3 — "high" suy luận sâu hơn "low" nhiều lần.
    // Chỉ họ Gemini nhận reasoning_effort; Claude "-thinking" và GPT-OSS tự suy luận theo tên mô hình (gửi reasoning_effort có thể bị từ chối 400). GPT-OSS không đọc ảnh.
    if (providerId === 'antigravity') return {reasoning: /gemini/i.test(model || '') ? 'effort' : 'none', effortOn: 'high', effortOff: 'low', vision: !/gpt-oss/i.test(model || ''), maxOut: 0, maxSources: 0};
    if (providerId === 'groq') return {reasoning: /gpt-oss/i.test(model) ? 'effort' : 'none', effortOn: 'medium', effortOff: 'low', vision: /llama-4|scout|maverick|vision/i.test(model), maxOut: 4000, maxSources: 5};
    return {reasoning: 'none', vision: true, maxOut: 0, maxSources: 0};
  }
  // Hạn chờ một lượt gọi (mili giây; 0 = không đặt thêm). Antigravity đi qua cầu nối cục bộ (tối đa 180 giây): lượt thường chờ 90 giây (mô hình tầng nhanh 3.8 có lúc xếp hàng/chậm; 45 giây là quá ngắn),
  // lượt suy luận sâu cần lâu hơn nhưng vẫn ngắn hơn hạn của cầu nối để người dùng nhận được thông báo rõ ràng.
  // Mô hình luôn suy luận (tên có "thinking", hoặc bản "-high" của Pro) cũng cần hạn dài như lượt suy luận sâu.
  const timeoutMs = (providerId, thinking, model) => providerId !== 'antigravity' ? 0 : (thinking || /thinking|-high$|opus/i.test(model || '')) ? 170000 : 90000;
  // Mô hình tầng nhanh 3.8 của Antigravity hay xếp hàng/quá tải: khi nó thất bại hẳn (hết hạn chờ hoặc hết lượt thử lại) thì tự chuyển sang Gemini 3 Flash, mô hình ổn định hơn trên cùng công cụ trung gian.
  // Mọi mô hình Antigravity khác (Pro, Claude, GPT-OSS…) cũng dùng Gemini 3 Flash làm dự phòng khi hết hạn chờ hoặc quá tải; giao diện luôn báo rõ khi đã chuyển.
  const FALLBACK_MODEL = 'gemini-3-flash';
  const fallbackModel = (providerId, model) => providerId === 'antigravity' && model && model !== FALLBACK_MODEL ? FALLBACK_MODEL : '';
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
    catch (_) { throw new Error('Không kết nối được tới ' + providerLabel(providerId, cfg) + ' để lấy danh sách mô hình.' + (providerId === 'antigravity' ? ' Kiểm tra cầu nối đang chạy trên máy tính (chạy "node scripts/antigravity-local-bridge.mjs --check").' : '')); }
    let data = null;
    try { data = await response.json(); } catch (_) { /* không phải JSON */ }
    if (!response.ok) {
      // Cầu nối bản cũ (trước khi có GET /v1/models) trả 404: kết nối, Origin và Host đều đã đúng, chỉ cần cập nhật cầu nối trên máy tính.
      if (providerId === 'antigravity' && (response.status === 404 || response.status === 405)) throw new Error('Cầu nối Antigravity trên máy tính còn là bản cũ (chưa có danh sách mô hình). Trên máy tính: git pull, rồi tắt và chạy lại "node scripts/antigravity-local-bridge.mjs".');
      if (providerId === 'antigravity' && data && data.error && data.error.message) throw new Error(String(data.error.message).slice(0, 200));
      if (response.status === 401 || response.status === 403) throw new Error('Khoá ' + providerLabel(providerId, cfg) + ' không đúng hoặc chưa có quyền.');
      throw new Error(providerLabel(providerId, cfg) + ' lỗi HTTP ' + response.status + ' khi lấy danh sách mô hình.');
    }
    const list = Array.isArray(data) ? data : Array.isArray(data && data.data) ? data.data : Array.isArray(data && data.models) ? data.models : [];
    let ids = list.map(item => clean(item && (item.id || item.name)).replace(/^models\//, '')).filter(Boolean);
    if (providerId === 'gemini') ids = ids.filter(id => /^(gemini|gemma)/i.test(id) && !/embed|image|tts|aqa|veo|imagen|live|audio/i.test(id));
    if (providerId === 'groq') ids = ids.filter(id => !/whisper|tts|guard|embed|orpheus|playai|distil/i.test(id));
    if (providerId === 'antigravity') ids = ids.filter(id => !AGY_SKIP.test(id));
    return uniq(ids).filter(id => MODEL_RE.test(id)).sort();
  }

  return {KEY, ORDER, PROVIDERS, defaults, normalize, load, save, entries, resolve, profile, endpointOf, baseOf, timeoutMs, fallbackModel, providerLabel, shortModel, parseModels, parseAgyModels, normalizeBase, normalizeAntigravityBase, getKey, keyStatus, noKeyMessage, listModels};
})();
