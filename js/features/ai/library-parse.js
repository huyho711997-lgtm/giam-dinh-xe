// Thư viện tài liệu nghiệp vụ: đọc file (Markdown, Word, PDF, Excel/CSV, ảnh scan) → các đoạn tra cứu {t: tiêu đề mục, x: nội dung}.
// Phần thuần (parseFrontMatter, chunkMarkdown, textToMarkdown, rowsToChunks) chạy được ở Node để kiểm thử; phần đọc file cần trình duyệt.
const TascoLibParse = (() => {
  const MAX_CHARS = 1800, MAX_TITLE = 200, MAX_CHUNKS = 600, MAX_TOTAL = 1500000;
  const norm = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const STATUS = {dang_hieu_luc: 'dang_hieu_luc', het_hieu_luc: 'het_hieu_luc', da_thay_the: 'da_thay_the'};

  function normalizeStatus(value) {
    const key = norm(value).replace(/ /g, '_');
    if (STATUS[key]) return STATUS[key];
    if (/het|huy|bai bo/.test(norm(value))) return 'het_hieu_luc';
    if (/thay the/.test(norm(value))) return 'da_thay_the';
    return 'dang_hieu_luc';
  }
  function normalizeDate(value) {
    const text = String(value ?? '').trim();
    let found = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (found) return found[1] + '-' + found[2].padStart(2, '0') + '-' + found[3].padStart(2, '0');
    found = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    return found ? found[3] + '-' + found[2].padStart(2, '0') + '-' + found[1].padStart(2, '0') : '';
  }

  // Khối thông tin đầu file: nằm giữa hai dòng "---", dạng "khoa: giá trị".
  function parseFrontMatter(text) {
    const source = String(text ?? '').replace(/^﻿/, '');
    const found = source.match(/^\s*---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
    if (!found) return {meta: {}, body: source};
    const raw = {};
    for (const line of found[1].split(/\r?\n/)) {
      const pair = line.match(/^\s*([A-Za-z_]+)\s*:\s*(.*?)\s*$/);
      if (pair) raw[pair[1].toLowerCase()] = pair[2].replace(/^["']|["']$/g, '');
    }
    const meta = {};
    if (raw.ten) meta.ten = raw.ten;
    if (raw.so_hieu) meta.soHieu = raw.so_hieu;
    if (raw.hieu_luc_tu) meta.hieuLucTu = normalizeDate(raw.hieu_luc_tu);
    if (raw.trang_thai) meta.trangThai = normalizeStatus(raw.trang_thai);
    if (raw.thay_the) meta.thayThe = raw.thay_the;
    if (raw.nguon) meta.nguon = raw.nguon;
    return {meta, body: source.slice(found[0].length)};
  }

  function splitLongBlock(block, max) {
    if (block.length <= max) return [block];
    const parts = [];
    let current = '';
    const push = piece => { if (current && (current + '\n' + piece).length > max) { parts.push(current); current = ''; } current = current ? current + '\n' + piece : piece; };
    for (let line of block.split('\n')) {
      while (line.length > max) { push(line.slice(0, max)); line = line.slice(max); }
      push(line);
    }
    if (current) parts.push(current);
    return parts;
  }
  // Cắt thân mục thành các phần ≤ max ký tự, ưu tiên ngắt ở đoạn trống.
  function splitBody(body, max) {
    const parts = [];
    let current = '';
    for (const paragraph of body.split(/\n{2,}/)) {
      for (const piece of splitLongBlock(paragraph.trim(), max)) {
        if (!piece) continue;
        if (current && (current + '\n\n' + piece).length > max) { parts.push(current); current = ''; }
        current = current ? current + '\n\n' + piece : piece;
      }
    }
    if (current) parts.push(current);
    return parts;
  }

  // Markdown → các đoạn theo tiêu đề (# … ######); tiêu đề lồng nhau ghép thành "Chương I › Điều 2".
  function chunkMarkdown(markdown, options = {}) {
    const max = options.maxChars || MAX_CHARS, docKey = norm(options.docTitle);
    const chunks = [];
    let path = [], lines = [], title = '';
    const flush = () => {
      const body = lines.join('\n').trim();
      lines = [];
      if (!body) return;
      const parts = splitBody(body, max);
      parts.forEach((part, index) => chunks.push({t: ((title || options.docTitle || 'Nội dung') + (parts.length > 1 ? ' (phần ' + (index + 1) + ')' : '')).slice(0, MAX_TITLE), x: part}));
    };
    let inFence = false;
    for (const line of String(markdown ?? '').replace(/\r/g, '').split('\n')) {
      if (/^\s*```/.test(line)) inFence = !inFence;
      const heading = !inFence && line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (heading) {
        flush();
        const level = heading[1].length, text = heading[2].trim();
        path = path.slice(0, level - 1);
        while (path.length < level - 1) path.push('');
        path[level - 1] = level === 1 && docKey && norm(text) === docKey ? '' : text;
        title = path.filter(Boolean).join(' › ');
      } else lines.push(line);
    }
    flush();
    return chunks;
  }

  // Văn bản thường (PDF, Word, txt): nhận diện Phần/Chương/Mục/Điều để dựng tiêu đề Markdown.
  function textToMarkdown(raw) {
    const text = String(raw ?? '').replace(/\r/g, '');
    if (/^#{1,6}\s+\S/m.test(text)) return text;
    const level = line => {
      const word = line.match(/^\s*(PHẦN|Phần|CHƯƠNG|Chương|MỤC|Mục|ĐIỀU|Điều)\s+([0-9]+|[IVXLC]+)\b/);
      if (!word) return 0;
      const key = word[1].toLowerCase();
      return key === 'phần' || key === 'chương' ? 1 : key === 'mục' ? 2 : 3;
    };
    return text.split('\n').map(line => { const depth = line.length <= 220 ? level(line) : 0; return depth ? '#'.repeat(depth) + ' ' + line.trim() : line; }).join('\n');
  }

  // Bảng tính: mỗi nhóm dòng thành một đoạn "Cột: giá trị; …" để tra cứu được theo tên cột.
  function rowsToChunks(rows, sheetName, groupSize = 20) {
    const table = (rows || []).map(row => (row || []).map(cell => String(cell ?? '').trim())).filter(row => row.some(Boolean));
    if (table.length < 2) return table.length ? [{t: String(sheetName || 'Bảng').slice(0, MAX_TITLE), x: table[0].join(' | ')}] : [];
    const head = table[0], chunks = [];
    for (let start = 1; start < table.length; start += groupSize) {
      const slice = table.slice(start, start + groupSize);
      const text = slice.map(row => row.map((cell, index) => cell ? (head[index] || 'Cột ' + (index + 1)) + ': ' + cell : '').filter(Boolean).join('; ')).filter(Boolean).join('\n');
      for (const part of splitLongBlock(text, MAX_CHARS)) chunks.push({t: (String(sheetName || 'Bảng') + ' (dòng ' + (start + 1) + '–' + (start + slice.length) + ')').slice(0, MAX_TITLE), x: part});
    }
    return chunks;
  }

  const limitChunks = chunks => {
    const out = [];
    let total = 0;
    for (const chunk of chunks) { total += chunk.x.length + chunk.t.length; if (out.length >= MAX_CHUNKS || total > MAX_TOTAL) break; out.push(chunk); }
    return {chunks: out, truncated: out.length < chunks.length};
  };

  // ---- Phần cần trình duyệt: đọc từng loại file ----
  const loaded = {};
  function loadScript(url) {
    return loaded[url] || (loaded[url] = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url; script.onload = resolve; script.onerror = () => { delete loaded[url]; reject(new Error('Không tải được thư viện đọc file. Kiểm tra kết nối mạng.')); };
      document.head.appendChild(script);
    }));
  }
  const readBuffer = file => file.arrayBuffer();
  const toBase64 = buffer => { let out = ''; const bytes = new Uint8Array(buffer); for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(out); };

  async function readDocx(file) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
    return (await mammoth.extractRawText({arrayBuffer: await readBuffer(file)})).value;
  }
  async function readPdf(file) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({data: new Uint8Array(await readBuffer(file))}).promise;
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const content = await (await pdf.getPage(number)).getTextContent();
      let lastY = null, line = '';
      const lines = [];
      for (const item of content.items) {
        const y = item.transform ? Math.round(item.transform[5]) : 0;
        if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(line.trim()); line = ''; }
        line += item.str + (item.hasEOL ? '\n' : '');
        lastY = y;
      }
      lines.push(line.trim());
      pages.push(lines.filter(Boolean).join('\n'));
    }
    return {text: pages.join('\n\n'), pages: pdf.numPages, scanned: pages.join('').replace(/\s/g, '').length < 40 * pdf.numPages};
  }
  async function readSheets(file) {
    if (typeof XLSX === 'undefined') throw new Error('Chưa tải được thư viện đọc Excel. Tải lại trang rồi thử lại.');
    const book = XLSX.read(await readBuffer(file), {type: 'array'});
    return book.SheetNames.flatMap(name => rowsToChunks(XLSX.utils.sheet_to_json(book.Sheets[name], {header: 1, raw: false, defval: ''}), name));
  }
  // Bản scan/ảnh: nhờ Gemini chép lại thành Markdown (chỉ dùng khi file không có lớp chữ).
  async function ocrWithGemini(file, apiKey, model, signal) {
    if (!apiKey) throw new Error('File là bản scan, cần khoá Gemini API để đọc chữ. Thiết lập khoá trong Trợ lý AI.');
    if (file.size > 15 * 1024 * 1024) throw new Error('File scan lớn hơn 15 MB, hãy tách nhỏ.');
    const mime = file.type || (/\.pdf$/i.test(file.name) ? 'application/pdf' : 'image/jpeg');
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model || 'gemini-2.5-flash') + ':generateContent', {
      method: 'POST', signal, headers: {'Content-Type': 'application/json', 'x-goog-api-key': apiKey},
      body: JSON.stringify({contents: [{role: 'user', parts: [{inlineData: {mimeType: mime, data: toBase64(await readBuffer(file))}}, {text: 'Chép lại ĐẦY ĐỦ và CHÍNH XÁC toàn bộ chữ trong tài liệu này thành Markdown tiếng Việt. Không tóm tắt, không thêm ý, không giải thích. Dùng "## " cho mỗi Chương/Mục/Điều (ghi đúng như bản gốc), bảng chuyển thành bảng Markdown. Chỗ không đọc được ghi [không rõ].'}]}]})
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error('Gemini không đọc được file scan (' + (data?.error?.message || 'HTTP ' + response.status) + ').');
    return (data?.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('').trim();
  }

  const stem = name => String(name || 'Tài liệu').replace(/\.[^.]+$/, '');
  // Trả về {meta, chunks, truncated, note}; meta lấy từ khối "---" nếu có.
  async function fromFile(file, options = {}) {
    const ext = (String(file.name).match(/\.([^.]+)$/)?.[1] || '').toLowerCase();
    let text = '', chunks = null, note = '';
    if (['md', 'markdown', 'txt'].includes(ext)) text = await file.text();
    else if (ext === 'docx') text = await readDocx(file);
    else if (ext === 'pdf') {
      const result = await readPdf(file);
      if (result.scanned) { note = 'PDF không có lớp chữ nên đã dùng Gemini đọc.'; text = await ocrWithGemini(file, options.apiKey, options.model, options.signal); } else text = result.text;
    } else if (['xlsx', 'xls', 'csv'].includes(ext)) chunks = await readSheets(file);
    else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) { note = 'Ảnh được Gemini đọc chữ.'; text = await ocrWithGemini(file, options.apiKey, options.model, options.signal); }
    else throw new Error('Định dạng .' + ext + ' chưa được hỗ trợ (dùng .md, .txt, .docx, .pdf, .xlsx, .csv hoặc ảnh).');
    let meta = {};
    if (!chunks) {
      const parsed = parseFrontMatter(text);
      meta = parsed.meta;
      const title = meta.ten || stem(file.name);
      chunks = chunkMarkdown(textToMarkdown(parsed.body), {docTitle: title});
    }
    meta = {ten: stem(file.name), trangThai: 'dang_hieu_luc', ...meta};
    return {meta, ...limitChunks(chunks), note};
  }
  // Văn bản dán trực tiếp.
  function fromText(text, name) {
    const parsed = parseFrontMatter(text);
    const meta = {ten: name || 'Văn bản dán', trangThai: 'dang_hieu_luc', ...parsed.meta};
    return {meta, ...limitChunks(chunkMarkdown(textToMarkdown(parsed.body), {docTitle: meta.ten})), note: ''};
  }

  return {parseFrontMatter, chunkMarkdown, textToMarkdown, rowsToChunks, normalizeStatus, normalizeDate, limitChunks, fromFile, fromText, MAX_CHUNKS, MAX_CHARS};
})();
