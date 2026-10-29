// Soạn biểu mẫu Word (.docx) bằng AI: chọn hồ sơ + gõ lệnh → Gemini đề xuất sửa từng đoạn → người dùng duyệt → tải .docx.
// Phần lõi (đọc đoạn, áp dụng sửa, dựng prompt, đọc phản hồi) là hàm thuần để kiểm thử; phần giao diện ở cuối file.
const SharedFormsAI = (() => {
  const MAX_PARAGRAPHS = 400, MAX_TEXT = 400, MAX_EDIT = 2000, MAX_FIELDS = 80;
  const SKIP_FIELD = /anh|image|photo|url|base64|signature|chu_?ky|token|password|matkhau/i;
  const decode = text => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const encode = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));

  // Tìm các đoạn <w:p> ở mức ngoài cùng (đoạn lồng trong hộp văn bản bị bỏ qua). Trả về vị trí + các nút <w:t>.
  function scanParagraphs(xml) {
    const tokens = /<w:p(?=[\s>\/])[^>]*?(\/?)>|<\/w:p>/g;
    const result = [];
    let depth = 0, start = -1, match;
    while ((match = tokens.exec(xml))) {
      if (match[0].startsWith('</')) {
        depth = Math.max(0, depth - 1);
        if (depth === 0 && start >= 0) { result.push({start, end: tokens.lastIndex}); start = -1; }
      } else if (!match[1]) {
        if (depth === 0) start = match.index;
        depth++;
      }
    }
    return result.map((range, id) => {
      const body = xml.slice(range.start, range.end);
      const nodes = [];
      // Đoạn chứa hộp văn bản (có <w:p> lồng bên trong) không sửa được an toàn → bỏ qua.
      if (/<w:p(?=[\s>\/])/.test(body.slice(4))) return {id, ...range, nodes, text: ''};
      const textTag = /<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
      let tag, offset = 0;
      while ((tag = textTag.exec(body))) {
        const text = decode(tag[2]);
        nodes.push({from: range.start + tag.index, to: range.start + tag.index + tag[0].length, attrs: tag[1] || '', text, offset});
        offset += text.length;
      }
      return {id, ...range, nodes, text: nodes.map(node => node.text).join('')};
    });
  }

  function readParagraphs(xml) {
    return scanParagraphs(xml).filter(item => item.text.trim()).slice(0, MAX_PARAGRAPHS)
      .map(item => ({id: item.id, text: item.text.length > MAX_TEXT ? item.text.slice(0, MAX_TEXT) + '…' : item.text, truncated: item.text.length > MAX_TEXT}));
  }

  // Thay đổi tối thiểu: chỉ phần khác nhau (sau khi bỏ tiền tố/hậu tố chung) được ghi lại,
  // nên các run khác định dạng (đậm/nghiêng…) không chứa chỗ sửa vẫn giữ nguyên.
  function replaceInParagraph(paragraph, newText) {
    const oldText = paragraph.text;
    if (oldText === newText || !paragraph.nodes.length) return [];
    let prefix = 0;
    const limit = Math.min(oldText.length, newText.length);
    while (prefix < limit && oldText[prefix] === newText[prefix]) prefix++;
    let suffix = 0;
    while (suffix < limit - prefix && oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]) suffix++;
    const removeFrom = prefix, removeTo = oldText.length - suffix, insert = newText.slice(prefix, newText.length - suffix);
    // Thay thế chữ cũ → đặt chữ mới vào run chứa chữ bị thay (giữ định dạng của chỗ trống);
    // chỉ chèn thêm → nối vào run đứng ngay trước vị trí chèn.
    const inside = paragraph.nodes.findIndex(node => node.offset <= removeFrom && removeFrom < node.offset + node.text.length);
    const before = paragraph.nodes.findIndex(node => node.offset < removeFrom && removeFrom <= node.offset + node.text.length);
    let target = removeTo > removeFrom ? inside : before;
    if (target < 0) target = inside >= 0 ? inside : before;
    if (target < 0) target = paragraph.nodes.length - 1;
    return paragraph.nodes.map((node, index) => {
      const nodeFrom = Math.max(removeFrom, node.offset) - node.offset, nodeTo = Math.min(removeTo, node.offset + node.text.length) - node.offset;
      let text = node.text;
      if (nodeTo > nodeFrom) text = text.slice(0, nodeFrom) + text.slice(nodeTo);
      if (index === target) {
        const cut = Math.max(0, Math.min(text.length, removeFrom - node.offset));
        text = text.slice(0, cut) + insert + text.slice(cut);
      }
      if (text === node.text) return null;
      const attrs = /xml:space=/.test(node.attrs) ? node.attrs : node.attrs + ' xml:space="preserve"';
      return {from: node.from, to: node.to, xml: '<w:t' + attrs + '>' + encode(text) + '</w:t>'};
    }).filter(Boolean);
  }

  function applyEdits(xml, edits) {
    const paragraphs = new Map(scanParagraphs(xml).map(item => [item.id, item]));
    const patches = [];
    for (const edit of edits) {
      const paragraph = paragraphs.get(edit.id);
      if (paragraph && typeof edit.text === 'string') patches.push(...replaceInParagraph(paragraph, edit.text));
    }
    patches.sort((first, second) => second.from - first.from);
    return patches.reduce((out, patch) => out.slice(0, patch.from) + patch.xml + out.slice(patch.to), xml);
  }

  // Làm phẳng 1 hồ sơ thành các cặp tên → giá trị đơn giản; bỏ ảnh/đường dẫn/chuỗi dài để gửi gọn và an toàn.
  function describeRecord(record) {
    const fields = {};
    const add = (key, value) => {
      if (Object.keys(fields).length >= MAX_FIELDS || SKIP_FIELD.test(key)) return;
      if (typeof value === 'string' && value.trim() && value.length <= 300) fields[key] = value.trim();
      else if (typeof value === 'number' && Number.isFinite(value)) fields[key] = value;
      else if (typeof value === 'boolean') fields[key] = value;
    };
    for (const [key, value] of Object.entries(record || {})) {
      if (value && typeof value === 'object' && !Array.isArray(value)) Object.entries(value).forEach(([sub, inner]) => add(key + '.' + sub, inner));
      else add(key, value);
    }
    return fields;
  }

  const SYSTEM_PROMPT = 'Bạn là trợ lý soạn biểu mẫu bồi thường bảo hiểm xe cơ giới bằng tiếng Việt. '
    + 'Bạn nhận: (1) danh sách đoạn văn của một biểu mẫu Word (id, text), (2) dữ liệu một hồ sơ, (3) yêu cầu của người dùng. '
    + 'Nhiệm vụ: đề xuất sửa các đoạn cần thiết để biểu mẫu phù hợp hồ sơ và yêu cầu. Quy tắc: '
    + 'chỉ trả về đoạn thực sự thay đổi; "text" là TOÀN BỘ nội dung mới của đoạn, giữ nguyên phần không cần sửa; '
    + 'điền vào chỗ trống như {{...}}, ……, ...., [   ] bằng dữ liệu hồ sơ; '
    + 'TUYỆT ĐỐI không bịa số liệu: nếu hồ sơ không có thông tin thì giữ nguyên chỗ trống và ghi tên thông tin còn thiếu vào "missing"; '
    + 'không đổi id, không thêm hoặc xoá đoạn. '
    + 'Chỉ trả về JSON: {"edits":[{"id":number,"text":string}],"missing":[string],"note":string}.';

  function buildRequest(paragraphs, fields, command) {
    return {
      system_instruction: {parts: [{text: SYSTEM_PROMPT}]},
      contents: [{role: 'user', parts: [{text: 'ĐOẠN VĂN BIỂU MẪU:\n' + JSON.stringify(paragraphs.map(({id, text}) => ({id, text})))
        + '\n\nDỮ LIỆU HỒ SƠ:\n' + JSON.stringify(fields) + '\n\nYÊU CẦU CỦA NGƯỜI DÙNG:\n' + command}]}],
      generationConfig: {responseMimeType: 'application/json', temperature: 0.2}
    };
  }

  // Đọc phản hồi của model: chấp nhận JSON bọc trong ```; loại id lạ, kiểu sai, đoạn không đổi.
  function parseResponse(raw, paragraphs) {
    const byId = new Map(paragraphs.map(item => [item.id, item]));
    let text = String(raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    let data;
    try { data = JSON.parse(text); } catch (_) {
      const first = text.indexOf('{'), last = text.lastIndexOf('}');
      if (first < 0 || last <= first) throw new Error('AI trả về dữ liệu không đọc được. Hãy thử lại hoặc diễn đạt lệnh rõ hơn.');
      try { data = JSON.parse(text.slice(first, last + 1)); } catch (_) { throw new Error('AI trả về dữ liệu không đọc được. Hãy thử lại hoặc diễn đạt lệnh rõ hơn.'); }
    }
    const seen = new Set();
    const edits = (Array.isArray(data?.edits) ? data.edits : []).filter(edit => {
      const original = byId.get(edit?.id);
      if (!original || original.truncated || typeof edit.text !== 'string' || edit.text.length > MAX_EDIT || edit.text === original.text || seen.has(edit.id)) return false;
      seen.add(edit.id);
      return true;
    }).map(edit => ({id: edit.id, before: byId.get(edit.id).text, text: edit.text}));
    const missing = (Array.isArray(data?.missing) ? data.missing : []).filter(item => typeof item === 'string' && item.trim()).slice(0, 20);
    return {edits, missing, note: typeof data?.note === 'string' ? data.note.slice(0, 500) : ''};
  }

  async function callGemini(request, apiKey, model, signal) {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
      method: 'POST', signal, headers: {'Content-Type': 'application/json', 'x-goog-api-key': apiKey}, body: JSON.stringify(request)
    });
    let data = null;
    try { data = await response.json(); } catch (_) { /* thân phản hồi không phải JSON */ }
    if (!response.ok || data?.error) {
      const status = response.status;
      if (status === 429) throw new Error('Gemini báo hết hạn mức miễn phí tạm thời. Đợi 1–2 phút rồi thử lại.');
      if (status === 400 || status === 403) throw new Error('Khoá Gemini API không hợp lệ hoặc không có quyền dùng model này. Kiểm tra lại khoá.');
      throw new Error('Gemini lỗi: ' + (data?.error?.message || 'HTTP ' + status));
    }
    const part = data?.candidates?.[0]?.content?.parts?.map(item => item.text || '').join('');
    if (!part) throw new Error('AI không trả về nội dung (có thể bị chặn bộ lọc an toàn). Hãy đổi lệnh và thử lại.');
    return part;
  }

  async function loadDocx(file, loadBytes) {
    if (typeof JSZip === 'undefined') throw new Error('Chưa tải được thư viện xử lý Word. Kiểm tra mạng rồi thử lại.');
    const zip = await JSZip.loadAsync(await loadBytes());
    const entry = zip.file('word/document.xml');
    if (!entry) throw new Error('File không phải Word (.docx) hợp lệ.');
    return {zip, xml: await entry.async('string')};
  }

  // ---- Giao diện ----
  function listRecords() {
    const rows = [];
    const pending = typeof cachedPendingClaimsPayload !== 'undefined' ? cachedPendingClaimsPayload : null;
    const cases = typeof cachedCasesPayload !== 'undefined' ? cachedCasesPayload : null;
    const label = (record, id) => [record.bienSo, record.chuXe || record.khachHang || record.tenChuXe, record.soHSBT || record.soHoSo || id].filter(Boolean).join(' · ');
    Object.entries(pending || {}).forEach(([id, record]) => record && rows.push({key: 'pending:' + id, group: 'Hồ sơ tồn', label: label(record, id), record}));
    Object.entries(cases || {}).forEach(([id, record]) => record && rows.push({key: 'case:' + id, group: 'Hồ sơ giám định', label: label(record, id), record}));
    return rows;
  }

  function open(file, options) {
    document.getElementById('sfAiDialog')?.remove();
    const records = listRecords();
    const hasKey = (() => { try { return !!localStorage.getItem('gemini_api_key'); } catch (_) { return false; } })();
    const node = document.createElement('dialog');
    node.id = 'sfAiDialog';
    node.className = 'sf-dialog sf-dialog-v2 sf-ai-dialog';
    node.setAttribute('aria-labelledby', 'sfAiTitle');
    const groups = ['Hồ sơ giám định', 'Hồ sơ tồn'].map(group => {
      const items = records.filter(row => row.group === group);
      return items.length ? '<optgroup label="' + group + '">' + items.map(row => '<option value="' + escapeHtml(row.key) + '">' + escapeHtml(row.label) + '</option>').join('') + '</optgroup>' : '';
    }).join('');
    node.innerHTML = '<form class="sf-dialog-form"><header class="sf-dialog-head"><span class="sf-dialog-emblem" aria-hidden="true">' + SharedFormsControls.icon('file') + '</span>'
      + '<div><small>THƯ VIỆN BIỂU MẪU</small><h2 id="sfAiTitle">Soạn bằng AI</h2><p>' + escapeHtml(file.name) + '</p></div>'
      + '<button type="button" class="sf-icon-button sf-dialog-close" data-ai-close aria-label="Đóng" title="Đóng (Esc)">' + SharedFormsControls.icon('close') + '</button></header>'
      + '<div class="sf-dialog-body">'
      + '<label class="sf-field"><span class="sf-field-label">Hồ sơ áp dụng</span><select name="record"><option value="">— Không chọn hồ sơ —</option>' + groups + '</select></label>'
      + '<label class="sf-field"><span class="sf-field-label">Lệnh cho AI</span><textarea name="command" rows="4" maxlength="1500" placeholder="VD: Điền thông tin chủ xe, biển số, số hồ sơ và ngày tổn thất vào biểu mẫu; kính gửi Bảo hiểm Bảo Việt."></textarea></label>'
      + (hasKey ? '' : '<label class="sf-field"><span class="sf-field-label">Khoá Gemini API (lưu trên trình duyệt này)</span><input name="apiKey" type="password" autocomplete="off" placeholder="Lấy miễn phí tại aistudio.google.com"></label>')
      + '<p class="sf-ai-privacy">Dữ liệu văn bản của hồ sơ đã chọn (không gồm ảnh) và nội dung biểu mẫu sẽ được gửi tới Google Gemini để xử lý.</p>'
      + '<div class="sf-ai-result" data-ai-result hidden></div><p class="sf-feedback" role="status" aria-live="polite" data-ai-feedback></p></div>'
      + '<footer class="sf-dialog-foot"><button type="button" class="sf-button" data-ai-close>Đóng</button>'
      + '<button type="button" class="sf-button" data-ai-download hidden>' + SharedFormsControls.icon('download') + ' Tải .docx</button>'
      + '<button type="submit" class="sf-button sf-primary"><span data-ai-label>Phân tích</span></button></footer></form>';
    document.body.appendChild(node);
    const form = node.querySelector('form'), feedback = node.querySelector('[data-ai-feedback]'), resultBox = node.querySelector('[data-ai-result]');
    const submit = node.querySelector('[type=submit]'), downloadButton = node.querySelector('[data-ai-download]');
    let controller = null, loaded = null, proposal = null;
    const close = () => { controller?.abort(); SharedFormsControls.close(); node.close(); node.remove(); };
    node.querySelectorAll('[data-ai-close]').forEach(button => button.onclick = close);
    node.addEventListener('cancel', event => { event.preventDefault(); close(); });
    const say = (text, bad) => { feedback.textContent = text; feedback.classList.toggle('is-error', !!bad); };
    const chosen = () => [...resultBox.querySelectorAll('input[data-edit]:checked')].map(box => Number(box.dataset.edit));

    function paintProposal() {
      const rows = proposal.edits.map(edit => '<label class="sf-ai-edit"><input type="checkbox" data-edit="' + edit.id + '" checked>'
        + '<span><del>' + escapeHtml(edit.before) + '</del><ins>' + escapeHtml(edit.text) + '</ins></span></label>').join('');
      resultBox.innerHTML = (proposal.edits.length ? '<p class="sf-ai-count">' + proposal.edits.length + ' chỗ AI đề xuất sửa — bỏ chọn chỗ không muốn áp dụng:</p>' + rows : '<p class="sf-ai-count">AI không thấy chỗ nào cần sửa theo lệnh này.</p>')
        + (proposal.missing.length ? '<p class="sf-ai-warn">Hồ sơ chưa có: ' + proposal.missing.map(escapeHtml).join(', ') + '. Các chỗ này được giữ trống để bạn tự điền.</p>' : '')
        + (proposal.note ? '<p class="sf-ai-note">' + escapeHtml(proposal.note) + '</p>' : '');
      resultBox.hidden = false;
      downloadButton.hidden = !proposal.edits.length;
    }

    form.onsubmit = async event => {
      event.preventDefault();
      const command = form.command.value.trim();
      if (!command) { say('Hãy nhập lệnh cho AI.', true); form.command.focus(); return; }
      let apiKey = '';
      try { apiKey = localStorage.getItem('gemini_api_key') || ''; } catch (_) { /* bỏ qua */ }
      if (!apiKey && form.apiKey) apiKey = form.apiKey.value.trim();
      if (!apiKey) { say('Cần khoá Gemini API (miễn phí tại aistudio.google.com).', true); form.apiKey?.focus(); return; }
      const row = records.find(item => item.key === form.record.value);
      controller?.abort();
      controller = new AbortController();
      submit.disabled = true; downloadButton.hidden = true; resultBox.hidden = true;
      say('Đang đọc biểu mẫu và hỏi AI…');
      try {
        loaded = loaded || await loadDocx(file, options.loadBytes);
        const paragraphs = readParagraphs(loaded.xml);
        if (!paragraphs.length) throw new Error('Biểu mẫu không có đoạn văn bản nào để sửa (có thể là bản scan).');
        let model = 'gemini-2.5-flash';
        try { model = localStorage.getItem('gemini_form_model') || model; } catch (_) { /* bỏ qua */ }
        const raw = await callGemini(buildRequest(paragraphs, describeRecord(row?.record), command), apiKey, model, controller.signal);
        if (form.apiKey?.value.trim()) { try { localStorage.setItem('gemini_api_key', apiKey); } catch (_) { /* bỏ qua */ } }
        proposal = parseResponse(raw, paragraphs);
        say('');
        paintProposal();
      } catch (error) {
        if (error.name !== 'AbortError') say(error.message || 'Không thể soạn bằng AI.', true);
      } finally { submit.disabled = false; }
    };

    downloadButton.onclick = async () => {
      const ids = new Set(chosen());
      const edits = proposal.edits.filter(edit => ids.has(edit.id));
      if (!edits.length) { say('Hãy chọn ít nhất một chỗ sửa.', true); return; }
      try {
        loaded.zip.file('word/document.xml', applyEdits(loaded.xml, edits));
        const blob = await loaded.zip.generateAsync({type: 'blob', mimeType: file.mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
        const row = records.find(item => item.key === form.record.value);
        const base = String(file.originalName || file.name).replace(/\.docx$/i, '');
        const suffix = row?.record?.bienSo ? ' - ' + String(row.record.bienSo).replace(/[^\w.-]+/g, '') : '';
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = url; link.download = base + suffix + ' (AI).docx';
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        say('Đã tạo bản sửa. Biểu mẫu gốc trong kho không bị thay đổi.');
      } catch (error) { say(error.message || 'Không tạo được file.', true); }
    };

    node.showModal();
    SharedFormsControls.enhance(node);
    form.command.focus();
  }

  return {open, readParagraphs, applyEdits, describeRecord, buildRequest, parseResponse};
})();
