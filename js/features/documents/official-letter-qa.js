// Công văn AI — chế độ "Hỏi nghiệp vụ": hỏi đáp dựa trên Thư viện tài liệu (Luật, Nghị định, quy tắc bảo hiểm…).
//  1. buildQueries: câu hỏi (kèm câu hỏi trước nếu câu này ngắn/hỏi tiếp) → truy vấn BM25 vào thư viện.
//  2. buildRequest: đưa NGUYÊN VĂN các đoạn trích [C1]… + (tuỳ chọn) hồ sơ đang chọn + vài lượt hội thoại gần nhất cho DeepSeek.
//     AI chỉ được kết luận về quy định dựa trên các đoạn này và phải dẫn mã [C#]; thiếu căn cứ thì nói thẳng là thư viện chưa có.
//  3. answerHtml: đổi câu trả lời (chữ thuần) thành HTML an toàn; mã [C#] thành nút xem nguyên văn, mã không có trong nguồn bị đánh dấu.
// Phần thuần (không DOM, không mạng) có unit test: tests/official-letter-qa.test.mjs.
const OfficialLetterQA = (() => {
  const MAX_TURNS = 6;            // số lượt hỏi-đáp gần nhất gửi kèm làm ngữ cảnh
  const TURN_CHARS = 1600;        // cắt mỗi tin nhắn cũ
  const QUESTION_MAX = 1500;
  const DOSSIER_MAX = 9000;
  const SOURCE_LIMIT = 6;
  const QA_COVERAGE = 0.34;       // câu hỏi tự nhiên dài hơn truy vấn ngắn → ngưỡng phủ từ thấp hơn so với soạn công văn
  const STORE_MAX = 24;           // số tin nhắn lưu lại trên máy
  const SOURCE_STORE_CHARS = 1400;

  const clip = (value, max) => { const text = String(value ?? '').replace(/[ \t]+\n/g, '\n').trim(); return text.length > max ? text.slice(0, max - 1) + '…' : text; };
  const oneLine = (value, max) => clip(String(value ?? '').replace(/\s+/g, ' '), max);
  const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const SYSTEM = [
    'Bạn là chuyên viên nghiệp vụ giám định và bồi thường bảo hiểm xe cơ giới của Tasco DLK, trả lời đồng nghiệp trong công ty.',
    'Bạn chỉ được dựa vào: (1) TRÍCH ĐOẠN THƯ VIỆN do hệ thống cung cấp, mỗi đoạn có mã [C1], [C2]…; (2) HỒ SƠ ĐANG CHỌN (nếu có).',
    'QUY TẮC BẮT BUỘC:',
    '- Mọi khẳng định về quy định, điều khoản, thời hạn, tỷ lệ, mức giảm trừ phải kèm mã nguồn ngay sau câu, ví dụ [C2]. Không dùng mã nào ngoài danh sách được cấp.',
    '- Không tự nêu số Điều, số hiệu văn bản, tỷ lệ hay thời hạn nếu không có trong các đoạn trích. Không trả lời điều khoản bằng trí nhớ.',
    '- Nếu các đoạn trích không đủ hoặc không liên quan: nói rõ "Thư viện chưa có điều khoản trả lời trực tiếp câu này", nêu phần liên quan nếu có, và gợi ý loại văn bản cần nạp thêm hoặc cần hỏi pháp chế. Không đoán.',
    '- Nếu có HỒ SƠ: áp dụng vào đúng hồ sơ đó, nêu dữ kiện hồ sơ đã dùng; thiếu dữ kiện nào thì nói rõ thiếu gì thay vì giả định.',
    '- Nếu hai đoạn trích mâu thuẫn hoặc khác phạm vi áp dụng (luật chung với quy tắc bảo hiểm), nêu cả hai và chỉ ra điểm khác.',
    '- Văn phong ngắn gọn, thực dụng: kết luận trước, rồi căn cứ, rồi lưu ý. Liệt kê bằng dòng bắt đầu "- " hoặc "1. ". Chỉ được dùng **chữ đậm**; không dùng bảng, không dùng tiêu đề #.',
    '- Chào hỏi hoặc câu không thuộc nghiệp vụ: trả lời ngắn, không cần dẫn nguồn.',
    '- Viết tiếng Việt.'
  ].join('\n');

  // Câu hỏi hỏi tiếp ("còn trường hợp xe chưa đóng phí thì sao?") quá ngắn để tìm đúng → ghép thêm câu hỏi trước đó.
  const wordCount = text => String(text || '').trim().split(/\s+/).filter(Boolean).length;
  function buildQueries(question, history) {
    const q = oneLine(question, 300);
    if (!q) return [];
    const out = [q];
    const prev = [...(history || [])].reverse().find(item => item && item.role === 'user' && item.text);
    if (prev && wordCount(q) < 8) out.push(oneLine(prev.text + ' ' + q, 300));
    return out;
  }

  const sourceBlock = sources => (sources || []).filter(source => source && source.on !== false).map(source => {
    const head = '[' + source.code + '] ' + source.doc + (source.soHieu ? ' (số ' + source.soHieu + ')' : '') + ' – ' + source.title + (source.from ? ' (hiệu lực từ ' + source.from + ')' : '');
    return head + '\n' + String(source.text || '').replace(/\s+\n/g, '\n').slice(0, 1800);
  }).join('\n\n');

  function recentTurns(history) {
    const turns = (history || []).filter(item => item && (item.role === 'user' || item.role === 'assistant') && String(item.text || '').trim() && !item.error);
    return turns.slice(-MAX_TURNS * 2);
  }

  // history: các tin nhắn TRƯỚC câu hỏi hiện tại. Trả về yêu cầu dạng {system_instruction, contents, generationConfig} (OfficialLetterAI đổi sang DeepSeek).
  function buildRequest(input) {
    const question = clip(input.question, QUESTION_MAX);
    const sources = input.sources || [];
    const library = sourceBlock(sources);
    const text = (library ? 'TRÍCH ĐOẠN THƯ VIỆN (nguyên văn):\n' + library : 'TRÍCH ĐOẠN THƯ VIỆN: (không tìm thấy đoạn nào khớp câu hỏi' + (input.libraryError ? ' — ' + input.libraryError : '') + ')')
      + (input.dossier ? '\n\nHỒ SƠ ĐANG CHỌN:\n' + clip(input.dossier, DOSSIER_MAX) : '')
      + '\n\nCÂU HỎI:\n' + question;
    const contents = recentTurns(input.history).map(item => ({role: item.role === 'assistant' ? 'model' : 'user', parts: [{text: clip(item.text, TURN_CHARS)}]}));
    contents.push({role: 'user', parts: [{text}]});
    return {system_instruction: {parts: [{text: SYSTEM}]}, contents, generationConfig: {temperature: 0.2}};
  }

  const CITE = /\[(C\d{1,2})\]/g;
  // Các mã nguồn được dẫn trong câu trả lời, theo thứ tự xuất hiện, không trùng.
  function citedCodes(text) {
    const out = [];
    String(text || '').replace(CITE, (_, code) => { if (!out.includes(code)) out.push(code); return _; });
    return out;
  }
  // Mã được dẫn nhưng KHÔNG có trong nguồn đã cấp → AI bịa mã.
  const unknownCodes = (text, sources) => citedCodes(text).filter(code => !(sources || []).some(source => source.code === code));

  function inline(line, known) {
    let html = esc(line).replace(/\*\*([^*\n][^*\n]*?)\*\*/g, '<b>$1</b>');
    html = html.replace(/\[(C\d{1,2})\]/g, (_, code) => known.has(code)
      ? '<button type="button" class="ola-cite" data-ol-qa-cite="' + code + '" title="Xem nguyên văn nguồn ' + code + '">' + code + '</button>'
      : '<span class="ola-cite is-bad" title="Mã nguồn này không nằm trong các đoạn thư viện đã tra — cần kiểm tra lại">' + code + '?</span>');
    return html;
  }
  // Chữ thuần → HTML: đoạn <p>, danh sách <ul>/<ol>, **đậm**, mã nguồn thành nút. Mọi thứ khác bị escape.
  function answerHtml(text, sources) {
    const known = new Set((sources || []).map(source => source.code));
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    const out = [];
    let list = null, para = [];
    const flushPara = () => { if (para.length) { out.push('<p>' + para.map(line => inline(line, known)).join('<br>') + '</p>'); para = []; } };
    const flushList = () => { if (list) { out.push('<' + list.tag + '>' + list.items.map(item => '<li>' + inline(item, known) + '</li>').join('') + '</' + list.tag + '>'); list = null; } };
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) { flushPara(); flushList(); continue; }
      const bullet = line.match(/^(?:[-*•])\s+(.*)$/), number = line.match(/^\d{1,2}[.)]\s+(.*)$/);
      const item = bullet || number, tag = bullet ? 'ul' : 'ol';
      if (item) { flushPara(); if (!list || list.tag !== tag) { flushList(); list = {tag, items: []}; } list.items.push(item[1]); continue; }
      flushList();
      para.push(line.replace(/^#{1,6}\s+/, ''));
    }
    flushPara(); flushList();
    return out.join('');
  }
  // Bỏ ký hiệu định dạng để sao chép/dán vào nơi khác.
  const plainText = text => String(text || '').replace(/\*\*([^*\n]+)\*\*/g, '$1').trim();

  // Câu hỏi gợi ý hiển thị ở màn mở đầu.
  const SUGGESTIONS = [
    'Thông báo tổn thất chậm quá hạn thì bị giảm trừ thế nào?',
    'Những trường hợp loại trừ trách nhiệm bảo hiểm xe cơ giới?',
    'Thời hạn giải quyết bồi thường kể từ khi nhận đủ hồ sơ?',
    'Xe thay đổi thông số lốp so với khuyến cáo nhà sản xuất có được bồi thường không?'
  ];

  // ---- Lưu hội thoại trên máy ----
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function normalizeSource(source) {
    if (!source || typeof source !== 'object' || !/^C\d{1,2}$/.test(String(source.code || ''))) return null;
    return {code: source.code, id: String(source.id || ''), doc: oneLine(source.doc, 160), soHieu: oneLine(source.soHieu, 80), title: oneLine(source.title, 200), text: String(source.text || '').slice(0, SOURCE_STORE_CHARS), from: String(source.from || ''), link: String(source.link || ''), on: true};
  }
  function normalizeMessage(item) {
    if (!item || typeof item !== 'object' || !['user', 'assistant'].includes(item.role)) return null;
    const text = String(item.text || '').slice(0, 12000);
    if (!text.trim()) return null;
    const message = {id: String(item.id || newId()), role: item.role, text};
    if (item.role === 'assistant') {
      message.sources = (Array.isArray(item.sources) ? item.sources : []).map(normalizeSource).filter(Boolean).slice(0, SOURCE_LIMIT);
      if (item.question) message.question = oneLine(item.question, 300);
      if (item.error) message.error = true;
      if (item.empty) message.empty = true;
    }
    return message;
  }
  const normalizeStore = raw => (Array.isArray(raw && raw.messages) ? raw.messages : []).map(normalizeMessage).filter(Boolean).slice(-STORE_MAX);

  return {SYSTEM, SUGGESTIONS, SOURCE_LIMIT, QA_COVERAGE, MAX_TURNS, buildQueries, buildRequest, sourceBlock, recentTurns, citedCodes, unknownCodes, answerHtml, plainText, normalizeStore, normalizeMessage, newId};
})();
