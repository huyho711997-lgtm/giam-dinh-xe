// Công văn AI — lớp gọi DeepSeek (API tương thích OpenAI: POST https://api.deepseek.com/chat/completions).
// Các hàm dựng yêu cầu của Công văn AI (core/revisions) vẫn trả về dạng {system_instruction, contents, generationConfig};
// lớp này đổi sang "messages" của DeepSeek, gọi API và trả về chuỗi nội dung — nên phần soạn thảo không phải sửa.
// DeepSeek không nhận PDF trực tiếp: PDF được đọc chữ bằng pdf.js (bản scan thì chụp từng trang thành ảnh) trước khi gửi.
const OfficialLetterAI = (() => {
  const ENDPOINT = 'https://api.deepseek.com/chat/completions';
  const DEFAULT_MODEL = 'deepseek-flash';
  const MAX_TOKENS = 8192;
  const PDF_TEXT_CHARS = 24000, PDF_SCAN_PAGES = 3, PDF_EDGE = 1600;
  const PDF_JS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDF_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  // ---- Base64 <-> chữ UTF-8 ----
  function utf8ToBase64(text) {
    const bytes = new TextEncoder().encode(String(text ?? ''));
    let out = '';
    for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(out);
  }
  function base64ToUtf8(data) {
    const binary = atob(String(data || ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  // ---- Đổi yêu cầu dạng Gemini → DeepSeek chat/completions ----
  // Tệp đính kèm: ảnh → image_url (data URL); "text/plain" (nội dung PDF đã đọc chữ) → đoạn văn bản.
  function partsToContent(parts) {
    const content = [];
    const push = part => {
      const last = content[content.length - 1];
      if (part.type === 'text' && last && last.type === 'text') last.text += '\n\n' + part.text;
      else content.push(part);
    };
    for (const part of parts || []) {
      if (!part || typeof part !== 'object') continue;
      if (typeof part.text === 'string') { if (part.text) push({type: 'text', text: part.text}); continue; }
      const inline = part.inlineData;
      if (!inline) continue;
      const mime = String(inline.mimeType || '');
      if (/^image\/(jpeg|png|gif|webp)$/i.test(mime)) push({type: 'image_url', image_url: {url: 'data:' + mime + ';base64,' + inline.data}});
      else if (mime === 'text/plain') push({type: 'text', text: base64ToUtf8(inline.data)});
      else throw new Error('DeepSeek không đọc được tệp loại "' + mime + '". Chỉ dùng ảnh hoặc PDF.');
    }
    return content.every(item => item.type === 'text') ? content.map(item => item.text).join('\n\n') : content;
  }

  function toChatRequest(request, options = {}) {
    const system = ((request && request.system_instruction && request.system_instruction.parts) || []).map(part => part && part.text || '').filter(Boolean).join('\n\n');
    const config = (request && request.generationConfig) || {};
    const json = config.responseMimeType === 'application/json';
    const messages = [];
    // JSON mode của DeepSeek yêu cầu trong prompt có chữ "json".
    const sys = json && !/json/i.test(system) ? (system ? system + '\n\n' : '') + 'Chỉ trả về một đối tượng JSON hợp lệ.' : system;
    if (sys) messages.push({role: 'system', content: sys});
    for (const item of (request && request.contents) || []) {
      const content = partsToContent(item && item.parts);
      if (content.length === 0) continue;
      messages.push({role: item.role === 'model' ? 'assistant' : 'user', content});
    }
    if (!messages.some(message => message.role === 'user')) throw new Error('Yêu cầu gửi AI trống.');
    const body = {model: options.model || DEFAULT_MODEL, messages, max_tokens: options.maxTokens || MAX_TOKENS, stream: false};
    if (json) body.response_format = {type: 'json_object'};
    if (options.thinking) { body.thinking = {type: 'enabled'}; body.reasoning_effort = options.effort || 'high'; }   // suy luận sâu: DeepSeek bỏ qua temperature, tính cả token suy luận vào max_tokens
    else { body.thinking = {type: 'disabled'}; if (typeof config.temperature === 'number') body.temperature = config.temperature; }   // chế độ suy luận bỏ qua temperature
    return body;
  }

  // ---- Số token đã dùng (DeepSeek trả kèm trong mỗi phản hồi) ----
  const count = value => { const n = Number(value); return Number.isFinite(n) && n > 0 ? Math.round(n) : 0; };
  function parseUsage(data) {
    const u = data && data.usage;
    if (!u || typeof u !== 'object') return null;
    const prompt = count(u.prompt_tokens), completion = count(u.completion_tokens);
    return {prompt, completion, hit: count(u.prompt_cache_hit_tokens), miss: count(u.prompt_cache_miss_tokens), total: count(u.total_tokens) || prompt + completion};
  }
  const emptyUsage = () => ({calls: 0, prompt: 0, completion: 0, hit: 0, miss: 0, total: 0});
  function addUsage(sum, usage) {
    const base = sum || emptyUsage();
    if (!usage) return base;
    return {calls: base.calls + 1, prompt: base.prompt + usage.prompt, completion: base.completion + usage.completion, hit: base.hit + usage.hit, miss: base.miss + usage.miss, total: base.total + usage.total};
  }
  const formatTokens = n => n < 1000 ? String(n) : (n / 1000).toLocaleString('vi-VN', {maximumFractionDigits: 1}) + 'k';

  // ---- Đọc phản hồi ----
  function aiError(message, extra) { return Object.assign(new Error(message), extra || {}); }
  function parseChatResponse(data) {
    const choice = data && data.choices && data.choices[0];
    const text = choice && choice.message && typeof choice.message.content === 'string' ? choice.message.content : '';
    if (choice && choice.finish_reason === 'length') throw aiError('AI trả lời quá dài nên bị cắt giữa chừng. Hãy rút gọn yêu cầu hoặc bớt tệp đính kèm rồi thử lại.');
    if (choice && choice.finish_reason === 'content_filter') throw aiError('AI từ chối trả lời do bộ lọc nội dung. Hãy đổi yêu cầu và thử lại.');
    if (!text.trim()) throw aiError('AI không trả về nội dung. Hãy thử lại.', {empty: true});
    return text;
  }

  function httpError(status, data) {
    const detail = data && data.error && (data.error.message || data.error);
    if (status === 401) return aiError('Khoá DeepSeek API không đúng hoặc đã bị thu hồi. Kiểm tra lại khoá ở biểu tượng ⚙.');
    if (status === 402) return aiError('Tài khoản DeepSeek đã hết số dư. Nạp thêm tại platform.deepseek.com rồi thử lại.');
    if (status === 400 || status === 422) return aiError('DeepSeek từ chối yêu cầu' + (detail ? ': ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 200) : '.'));
    if (status === 429) return aiError('DeepSeek đang giới hạn lưu lượng (429).', {retryable: true});
    if (status === 500 || status === 503) return aiError('Máy chủ DeepSeek đang quá tải (' + status + ').', {retryable: true});
    return aiError('DeepSeek lỗi HTTP ' + status + (detail ? ': ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 200) : '.'));
  }

  // Gọi API. Nội dung trả về rỗng (JSON mode đôi khi trả khoảng trắng) được tự thử lại một lần.
  async function call(request, options = {}) {
    if (!options.apiKey) throw aiError('Chưa có khoá DeepSeek API.');
    const doFetch = options.fetchImpl || (typeof fetch === 'function' ? fetch : null);
    if (!doFetch) throw aiError('Trình duyệt không hỗ trợ gọi mạng.');
    const body = JSON.stringify(toChatRequest(request, options));
    for (let attempt = 0; ; attempt++) {
      let response;
      try {
        response = await doFetch(ENDPOINT, {method: 'POST', signal: options.signal, headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + options.apiKey}, body});
      } catch (error) {
        if (error && error.name === 'AbortError') throw error;
        throw aiError('Không kết nối được tới DeepSeek. Kiểm tra mạng (hoặc trình duyệt/tiện ích đang chặn api.deepseek.com).', {retryable: true});
      }
      let data = null;
      try { data = await response.json(); } catch (_) { /* thân phản hồi không phải JSON */ }
      if (!response.ok) throw httpError(response.status, data);
      if (options.onUsage) { const usage = parseUsage(data); if (usage) options.onUsage(usage); }   // lần gọi nào cũng bị tính tiền, kể cả khi phải thử lại vì nội dung rỗng
      try { return parseChatResponse(data); }
      catch (error) { if (!error.empty || attempt >= 1) throw error; }
    }
  }

  // ---- PDF → văn bản (hoặc ảnh các trang đầu nếu là bản scan) ----
  let pdfLoader = null;
  function loadPdfJs() {
    if (typeof pdfjsLib !== 'undefined') return Promise.resolve();
    return pdfLoader || (pdfLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = PDF_JS; script.onload = resolve;
      script.onerror = () => { pdfLoader = null; reject(new Error('Không tải được thư viện đọc PDF. Kiểm tra kết nối mạng.')); };
      document.head.appendChild(script);
    }));
  }
  function pageText(content) {
    let line = '', lastY = null;
    const lines = [];
    for (const item of content.items) {
      const y = item.transform ? Math.round(item.transform[5]) : 0;
      if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(line.trim()); line = ''; }
      line += item.str + (item.hasEOL ? '\n' : '');
      lastY = y;
    }
    lines.push(line.trim());
    return lines.filter(Boolean).join('\n');
  }
  // Trả về {text, pages, scanned, images}: scanned=true khi PDF gần như không có lớp chữ → images là ảnh JPEG (base64) của vài trang đầu.
  async function readPdf(buffer) {
    await loadPdfJs();
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER;
    const pdf = await pdfjsLib.getDocument({data: new Uint8Array(buffer)}).promise;
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number++) pages.push(pageText(await (await pdf.getPage(number)).getTextContent()));
    const joined = pages.join('\n\n');
    if (joined.replace(/\s/g, '').length >= 40 * pdf.numPages) return {text: joined.slice(0, PDF_TEXT_CHARS), pages: pdf.numPages, scanned: false, images: [], truncated: joined.length > PDF_TEXT_CHARS};
    const images = [];
    for (let number = 1; number <= Math.min(pdf.numPages, PDF_SCAN_PAGES); number++) {
      const page = await pdf.getPage(number);
      const base = page.getViewport({scale: 1});
      const viewport = page.getViewport({scale: Math.min(2, PDF_EDGE / Math.max(base.width, base.height))});
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
      await page.render({canvasContext: canvas.getContext('2d'), viewport}).promise;
      images.push(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
    }
    return {text: '', pages: pdf.numPages, scanned: true, images, truncated: pdf.numPages > PDF_SCAN_PAGES};
  }
  // Đổi một PDF thành danh sách "tệp" gửi AI: một tệp text/plain (có chữ) hoặc các ảnh trang (bản scan).
  async function pdfToAttachments(name, buffer) {
    const result = await readPdf(buffer);
    if (!result.scanned) {
      if (!result.text.trim()) throw new Error('"' + name + '" không có nội dung đọc được.');
      return [{name, mimeType: 'text/plain', data: utf8ToBase64('[Nội dung PDF "' + name + '"' + (result.truncated ? ', đã cắt bớt phần cuối' : '') + ']\n' + result.text)}];
    }
    return result.images.map((data, index) => ({name: name + ' (trang ' + (index + 1) + ')', mimeType: 'image/jpeg', data}));
  }

  return {ENDPOINT, DEFAULT_MODEL, toChatRequest, parseChatResponse, parseUsage, emptyUsage, addUsage, formatTokens, httpError, call, readPdf, pdfToAttachments, utf8ToBase64, base64ToUtf8};
})();
