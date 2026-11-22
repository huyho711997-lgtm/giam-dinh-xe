// Công văn AI — chế độ "Hỏi nghiệp vụ": hỏi đáp dựa trên Thư viện tài liệu (Luật, Nghị định, quy tắc bảo hiểm…).
// Ba bước (một câu hỏi = 2 lần gọi DeepSeek):
//  1. LẬP KẾ HOẠCH TRA CỨU (buildPlanRequest/parsePlan): AI đổi câu hỏi khẩu ngữ ("vỏ pin có thuộc phạm vi không") thành vấn đề cần xác định + 5–8 cụm
//     từ tra theo ngôn ngữ của quy tắc (phạm vi, loại trừ, ngoại lệ, điều khoản bổ sung, khấu hao…); thêm bộ từ điển nghiệp vụ cố định (glossaryQueries)
//     làm dự phòng khi AI lỗi. Tìm BM25 theo mọi cụm rồi mở rộng sang phần liền kề + điều được dẫn chiếu (OfficialLetterLegal.expandSources).
//  2. buildRequest: đưa NGUYÊN VĂN các đoạn trích [C1]… + (tuỳ chọn) hồ sơ đang chọn + vài lượt hội thoại gần nhất. AI (chế độ suy luận sâu) phải đi
//     qua các lớp: định nghĩa → phạm vi → loại trừ → ngoại lệ → điều khoản bổ sung → khấu hao; kết luận có dẫn mã [C#], thiếu căn cứ thì nói rõ.
//  3. answerHtml: đổi câu trả lời (chữ thuần) thành HTML an toàn; mã [C#] thành nút xem nguyên văn, mã không có trong nguồn bị đánh dấu.
// Phần thuần (không DOM, không mạng) có unit test: tests/official-letter-qa.test.mjs.
const OfficialLetterQA = (() => {
  const MAX_TURNS = 6;            // số lượt hỏi-đáp gần nhất gửi kèm làm ngữ cảnh
  const TURN_CHARS = 1600;        // cắt mỗi tin nhắn cũ
  const QUESTION_MAX = 1500;
  const DOSSIER_MAX = 9000;
  const SOURCE_LIMIT = 8;         // số đoạn xếp hạng cao nhất; sau đó mở rộng thêm phần liền kề / điều được dẫn chiếu tới MAX_SOURCES
  const MAX_SOURCES = 12;
  const MAX_QUERIES = 10;
  const QA_COVERAGE = 0.34;       // câu hỏi tự nhiên dài hơn truy vấn ngắn → ngưỡng phủ từ thấp hơn so với soạn công văn
  const STORE_MAX = 24;           // số tin nhắn lưu lại trên máy
  const SOURCE_STORE_CHARS = 1400;

  const clip = (value, max) => { const text = String(value ?? '').replace(/[ \t]+\n/g, '\n').trim(); return text.length > max ? text.slice(0, max - 1) + '…' : text; };
  const oneLine = (value, max) => clip(String(value ?? '').replace(/\s+/g, ' '), max);
  const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const SYSTEM = [
    'Bạn là chuyên viên nghiệp vụ giám định và bồi thường bảo hiểm xe cơ giới cấp cao của Tasco DLK, trả lời đồng nghiệp trong công ty.',
    'Hãy đọc quy tắc như người làm nghề lâu năm: không chỉ tìm câu trùng từ khoá mà phải kết hợp nhiều điều khoản để ra kết luận.',
    'NGUỒN ĐƯỢC PHÉP DÙNG: (1) TRÍCH ĐOẠN THƯ VIỆN nguyên văn, mỗi đoạn có mã [C1], [C2]… (một số là phần liền kề của đoạn khớp hoặc Điều được dẫn chiếu); (2) HỒ SƠ ĐANG CHỌN (nếu có).',
    'CÁCH SUY LUẬN (làm lần lượt):',
    '1. Xác định chính xác vấn đề: đối tượng (bộ phận / loại xe), sự kiện (tai nạn, ngập nước, hao mòn…), điều cần biết (có thuộc phạm vi / có bị loại trừ / mức bồi thường / khấu hao / thủ tục).',
    '2. Duyệt các lớp quy định theo thứ tự: định nghĩa → phạm vi bảo hiểm → điểm loại trừ chung → loại trừ riêng của chương → NGOẠI LỆ nằm trong chính điểm loại trừ ("trừ trường hợp…", "không áp dụng…") → điều khoản bảo hiểm bổ sung (BS…) có gỡ loại trừ không → khấu hao / khấu trừ / giới hạn → hồ sơ, thủ tục.',
    '3. Đọc hết từng mục trước khi kết luận: điều khoản loại trừ thường có ngoại lệ ở cuối câu; chú ý các từ "riêng", "chỉ", "trừ", "đồng thời".',
    '4. Áp dụng vào tình huống người hỏi. Nếu quy tắc nói theo nhóm bộ phận hoặc nói gián tiếp thì VẪN suy luận ra kết luận từ các điều khoản đó và ghi rõ đó là suy luận.',
    'QUY TẮC TRÌNH BÀY VÀ TRÍCH DẪN (bắt buộc):',
    '- Cấu trúc: **Kết luận** (1–2 câu: Có / Không / Có điều kiện + lý do chính) → **Căn cứ** (gạch đầu dòng, mỗi ý nêu rõ Điều/mục và kèm [C#]) → **Điều kiện, ngoại lệ cần kiểm tra** (nếu có) → **Cần xác nhận thêm** (chỉ khi thật sự thiếu dữ kiện hoặc thiếu đoạn).',
    '- Mọi khẳng định về quy định, thời hạn, tỷ lệ, mức khấu trừ/khấu hao phải có mã nguồn ngay sau câu, ví dụ [C2]; chỉ dùng mã được cấp. Không nêu số Điều/mục/tỷ lệ/thời hạn nào không có trong trích đoạn; không trả lời điều khoản bằng trí nhớ.',
    '- Phần suy luận của bạn ghi rõ "Suy luận:" và vẫn dẫn các đoạn làm cơ sở.',
    '- Chỉ nói "Thư viện chưa có điều khoản trả lời trực tiếp" khi đã duyệt hết mà KHÔNG đoạn nào liên quan, kể cả gián tiếp, rồi nêu cần nạp văn bản nào. Không dùng câu này để né khi đã có điều khoản loại trừ / ngoại lệ / bổ sung liên quan — hãy phân tích chúng.',
    '- Nếu một đoạn bị cắt giữa chừng hoặc mục liền kề không có trong trích đoạn, nói rõ phần nào chưa đọc được.',
    '- Hai đoạn mâu thuẫn hoặc khác phạm vi áp dụng (luật chung với quy tắc bảo hiểm): nêu cả hai và chỉ ra điểm khác.',
    '- Có HỒ SƠ: áp dụng đúng hồ sơ đó, nêu dữ kiện hồ sơ đã dùng; thiếu dữ kiện nào thì nói rõ thiếu gì thay vì giả định.',
    '- Văn bản trích có thể lỗi chính tả do quét (OCR): hiểu theo ngữ cảnh, không coi lỗi chính tả là nội dung khác.',
    '- Văn phong ngắn gọn, thực dụng, tiếng Việt. Chỉ dùng **chữ đậm** và danh sách bắt đầu "- " hoặc "1. "; luôn in đậm chính từ quyết định ở Kết luận và Điều kiện (**Có**, **Không**, **Không được bồi thường**, **Thuộc phạm vi**, **Bị loại trừ**, **Có điều kiện**) để giao diện tô xanh/đỏ; không dùng bảng, không dùng tiêu đề #.',
    '- Chào hỏi hoặc câu không thuộc nghiệp vụ: trả lời ngắn, không cần dẫn nguồn.'
  ].join('\n');

  // ---- Bước 1: lập kế hoạch tra cứu ----
  const PLAN_SYSTEM = [
    'Bạn là chuyên viên nghiệp vụ bảo hiểm xe cơ giới. Việc của bạn: chuẩn bị tra cứu trong Quy tắc bảo hiểm / Luật / Nghị định cho câu hỏi của đồng nghiệp.',
    'Chỉ trả về MỘT đối tượng JSON: {"kind": "lookup", "issue": "...", "queries": ["...", "..."]}',
    '- kind: "chat" CHỈ khi câu hỏi hoàn toàn không cần tra quy định (chào hỏi, cảm ơn, hỏi bạn là ai / làm được gì / dùng thế nào, trò chuyện thường). Mọi câu hỏi về điều khoản, loại trừ, bồi thường, khấu hao, hồ sơ, thủ tục, thời hạn… đều là "lookup". Khi kind = "chat" thì issue = "" và queries = [].',
    '- issue: vấn đề cần xác định, 1–2 câu (đối tượng, sự kiện, điều cần biết).',
    '- queries: 5–8 cụm từ tra cứu NGẮN (3–9 từ), viết theo ngôn ngữ của văn bản quy tắc bảo hiểm chứ không theo khẩu ngữ. Mỗi cụm một khía cạnh: phạm vi bảo hiểm; điểm loại trừ (chung và riêng); ngoại lệ "trừ trường hợp…"; điều khoản bảo hiểm bổ sung / mở rộng liên quan; định nghĩa thuật ngữ; khấu hao / khấu trừ nếu liên quan; từ đồng nghĩa (VD "vỏ pin" → "pin điện động cơ", "bộ phận", "tổn thất riêng").',
    '- Không bịa số Điều/số hiệu.'
  ].join('\n');
  function buildPlanRequest(question, history) {
    const prev = (history || []).filter(item => item && item.role === 'user' && item.text).slice(-2).map(item => '- ' + oneLine(item.text, 200));
    const text = (prev.length ? 'CÂU HỎI TRƯỚC TRONG HỘI THOẠI:\n' + prev.join('\n') + '\n\n' : '') + 'CÂU HỎI CẦN TRA:\n' + clip(question, 600);
    return {system_instruction: {parts: [{text: PLAN_SYSTEM}]}, contents: [{role: 'user', parts: [{text}]}], generationConfig: {responseMimeType: 'application/json', temperature: 0.1}};
  }
  function parsePlan(raw) {
    const empty = {issue: '', queries: []};
    let data = null;
    const text = String(raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { data = JSON.parse(text); }
    catch (_) { const found = text.match(/\{[\s\S]*\}/); if (found) { try { data = JSON.parse(found[0]); } catch (__) { /* bỏ qua */ } } }
    if (!data || typeof data !== 'object') return empty;
    const seen = new Set(), queries = [];
    for (const item of Array.isArray(data.queries) ? data.queries : []) {
      const query = oneLine(item, 120), id = foldKey(query);
      if (query && wordCount(query) >= 2 && !seen.has(id)) { seen.add(id); queries.push(query); }
    }
    const plan = {issue: oneLine(data.issue, 300), queries: queries.slice(0, 8)};
    if (String(data.kind || '').toLowerCase() === 'chat' && !plan.queries.length) plan.chat = true;   // chỉ coi là trò chuyện khi planner không đề xuất cụm tra nào
    return plan;
  }

  // ---- Câu không cần tra quy định: chào hỏi, cảm ơn, hỏi về trợ lý → trò chuyện tự nhiên, không tra Thư viện, không dẫn nguồn ----
  const CHAT_SYSTEM = [
    'Bạn là trợ lý nghiệp vụ giám định và bồi thường bảo hiểm xe cơ giới của Tasco DLK, đang trò chuyện với đồng nghiệp trong công ty.',
    'Câu này là trò chuyện thường (chào hỏi, cảm ơn, hỏi bạn làm được gì…), không cần tra quy định. Hãy đáp như một đồng nghiệp thân thiện, tự nhiên, ngắn gọn (1–4 câu), tiếng Việt, xưng "mình", gọi người hỏi là "bạn".',
    'Nếu được hỏi bạn làm được gì, kể ngắn gọn bằng lời thường những việc có thật: tra cứu và đối chiếu Quy tắc bảo hiểm, Luật, Nghị định trong Thư viện tài liệu để trả lời có dẫn nguồn (phạm vi bảo hiểm, loại trừ, ngoại lệ, khấu hao, thời hạn, hồ sơ); dùng thông tin hồ sơ đang chọn nếu có; chuyển kết luận sang Soạn công văn. Gợi ý một hai ví dụ câu hỏi cụ thể để họ thử.',
    'Quy tắc: không mở đầu bằng tự giới thiệu dài dòng; không dùng tiêu đề, không dùng cấu trúc Kết luận/Căn cứ, không gắn mã nguồn [C#], không liệt kê dài; chỉ dùng "- " khi thật cần liệt kê. Tuyệt đối không nêu số Điều, tỷ lệ, thời hạn hay nội dung quy định bằng trí nhớ; nếu họ thực ra đang hỏi về quy định, mời họ nêu rõ tình huống để mình tra Thư viện.'
  ].join('\n');
  // Nhận diện cục bộ, chặt: chỉ câu ngắn khớp mẫu chào hỏi / cảm ơn / hỏi về trợ lý. Câu nghiệp vụ không bao giờ lọt vào đây.
  const CHAT_GREET = /^(xin chao|chao|hello|hi|hey|alo|cam on|thanks|thank you|ok|oke|okay|tam biet|bye)(\s|$)/;
  const CHAT_META = /(ban|em|ong|ai|bot|tro ly)\s+(la\s+ai|ten\s+(?:gi|la)|lam\s+duoc\s+gi|giup\s+(?:duoc\s+)?gi|co\s+the\s+(?:lam|giup)\s+(?:gi|duoc\s+gi)|biet\s+lam\s+gi|khoe\s+khong)|(?:cach|huong\s+dan)\s+(?:su\s+dung|dung)\s+(?:cai\s+nay|tinh\s+nang\s+nay|chuc\s+nang\s+nay)|ai\s+tao\s+ra\s+ban/;
  function isSmallTalk(question) {
    const key = foldKey(question), words = key ? key.split(' ').length : 0;
    if (!key || words > 12) return false;
    if (CHAT_META.test(key)) return true;
    return words <= 5 && CHAT_GREET.test(key);
  }
  function buildChatRequest(input) {
    const contents = recentTurns(input.history).map(item => ({role: item.role === 'assistant' ? 'model' : 'user', parts: [{text: clip(item.text, TURN_CHARS)}]}));
    contents.push({role: 'user', parts: [{text: clip(input.question, QUESTION_MAX)}]});
    return {system_instruction: {parts: [{text: CHAT_SYSTEM}]}, contents, generationConfig: {temperature: 0.6}};
  }

  // Từ điển nghiệp vụ cố định — dự phòng khi bước lập kế hoạch lỗi, và bổ sung các cụm hay bị bỏ sót (khẩu ngữ → ngôn ngữ quy tắc).
  const GLOSSARY = [
    [/\bpin\b|ac quy|xe dien|dien dong co|sac dien/, ['pin điện động cơ xe ô tô điện', 'tổn thất riêng pin loại trừ bảo hiểm', 'khấu hao bộ pin điện động cơ']],
    [/ngap|thuy kich|ngam nuoc/, ['tổn thất hệ thống điện động cơ khi xe hoạt động trong khu vực ngập nước', 'bảo hiểm bổ sung thủy kích ngập nước']],
    [/pham vi|thuoc|loai tru|co duoc (?:boi thuong|bao hiem)|co boi thuong/, ['phạm vi bảo hiểm vật chất xe tổn thất bất ngờ ngoài ý muốn', 'các điểm loại trừ chung áp dụng cho các chương', 'loại trừ bảo hiểm vật chất xe không chịu trách nhiệm']],
    [/ton that rieng|rieng phan|bo phan|\bvo\b/, ['tổn thất riêng bộ phận trừ trường hợp cùng một nguyên nhân đồng thời']],
    [/khau hao|khau tru|mien thuong/, ['quy định về khấu hao phụ tùng thay mới', 'mức khấu trừ số tiền bồi thường']],
    [/lop|sam|la zang|lazang|mam xe/, ['tổn thất riêng săm lốp loại trừ', 'khấu hao săm lốp ắc quy']],
    [/kinh/, ['bảo hiểm kính chắn gió']],
    [/trom|cuop|mat cap/, ['mất bộ phận của xe do bị trộm cướp']],
    [/thong bao|cham|qua han/, ['thời hạn thông báo tổn thất cho doanh nghiệp bảo hiểm', 'giảm trừ bồi thường vi phạm nghĩa vụ của chủ xe']],
    [/ho so|chung tu|giay to/, ['hồ sơ yêu cầu bồi thường gồm các tài liệu']],
    [/toan bo|mat toan bo/, ['tổn thất toàn bộ xe nguyên tắc bồi thường']],
    [/duoi gia tri|ty le boi thuong|dong bao hiem/, ['bảo hiểm dưới giá trị tỷ lệ bồi thường']]
  ];
  const foldKey = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function glossaryQueries(question) {
    const text = foldKey(question), out = [];
    for (const [pattern, queries] of GLOSSARY) if (pattern.test(text)) queries.forEach(query => { if (!out.includes(query)) out.push(query); });
    return out.slice(0, 6);
  }

  // Câu hỏi hỏi tiếp ("còn trường hợp xe chưa đóng phí thì sao?") quá ngắn để tìm đúng → ghép thêm câu hỏi trước đó.
  const wordCount = text => String(text || '').trim().split(/\s+/).filter(Boolean).length;
  // plan: kết quả parsePlan (tuỳ chọn). Thứ tự: câu hỏi gốc → cụm AI lập → từ điển nghiệp vụ; bỏ trùng, tối đa MAX_QUERIES.
  function buildQueries(question, history, plan) {
    const q = oneLine(question, 300);
    if (!q) return [];
    const out = [], seen = new Set();
    const push = text => { const clean = oneLine(text, 300), id = foldKey(clean); if (clean && !seen.has(id)) { seen.add(id); out.push(clean); } };
    push(q);
    const prev = [...(history || [])].reverse().find(item => item && item.role === 'user' && item.text);
    if (prev && wordCount(q) < 8) push(prev.text + ' ' + q);
    ((plan && plan.queries) || []).forEach(push);
    glossaryQueries(q + ' ' + ((plan && plan.issue) || '')).forEach(push);
    return out.slice(0, MAX_QUERIES);
  }

  const sourceBlock = sources => (sources || []).filter(source => source && source.on !== false).map(source => {
    const head = '[' + source.code + '] ' + source.doc + (source.soHieu ? ' (số ' + source.soHieu + ')' : '') + ' – ' + source.title + (source.from ? ' (hiệu lực từ ' + source.from + ')' : '') + (source.via ? ' [đoạn bổ sung: ' + source.via + ']' : '');
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
      + (input.issue ? '\n\nVẤN ĐỀ CẦN XÁC ĐỊNH (do bước phân tích câu hỏi đề xuất, tham khảo):\n' + clip(input.issue, 300) : '')
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

  // Tô màu kết luận: xanh = có/được/thuộc phạm vi, đỏ = không/không được/loại trừ. Chỉ áp dụng cho chữ **đậm** mang nghĩa kết luận
  // và một số cụm kết luận cố định (không tô từng chữ "không" lẻ để khỏi nhiễu).
  const foldVi = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
  const NEG_START = /^(khong|chua|bi loai tru|loai tru|bi tu choi|tu choi|bi tru|khong duoc|khong thuoc)(\s|$|[,.;:)])/;
  const POS_START = /^(co|duoc|thuoc|dat|du dieu kien|chap nhan|duoc boi thuong|duoc bao hiem)(\s|$|[,.;:)])/;
  function verdict(text) {
    const key = foldVi(text);
    if (!key || key.length > 60) return '';
    if (NEG_START.test(key)) return 'no';
    if (POS_START.test(key)) return 'yes';
    return '';
  }
  const PHRASES = /(không thuộc phạm vi(?: bảo hiểm)?|không được bồi thường|không được bảo hiểm|không bồi thường|bị loại trừ|không được miễn(?: khấu hao)?|thuộc phạm vi(?: bảo hiểm)?|được bồi thường|được bảo hiểm|được miễn(?: khấu hao)?)/gi;
  function colorPhrases(html) {
    // Chỉ xử lý chữ nằm ngoài thẻ HTML và ngoài các đoạn <b> đã xử lý.
    const parts = html.split(/(<b[^>]*>[\s\S]*?<\/b>|<[^>]+>)/);
    return parts.map((part, i) => {
      if (i % 2) return part;
      // "**không** được miễn…": cụm khẳng định đứng ngay sau chữ đậm phủ định thì cũng là phủ định.
      const afterNo = /class="ola-no">[^<]*<\/b>$/.test(parts[i - 1] || '');
      return part.replace(PHRASES, (match, _g, offset) => '<span class="ola-' + ((afterNo && offset === part.search(/\S/)) ? 'no' : (verdict(match) || 'no')) + '">' + match + '</span>');
    }).join('');
  }
  // Đề mục của câu trả lời (Kết luận, Căn cứ, Điều kiện…): in đậm đứng riêng một dòng, hoặc nhãn đầu mục quen thuộc → gạch chân.
  const SECTION = /^(ket luan|can cu|dieu kien|ngoai le|can xac nhan|luu y|ket qua)(\s|$|[,.;:)])/;
  function inline(line, known) {
    const solo = /^\*\*[^*\n]+\*\*\s*:?$/.test(line.trim());
    let html = esc(line).replace(/\*\*([^*\n][^*\n]*?)\*\*/g, (_, inner) => {
      const kind = verdict(inner);
      if (kind) return '<b class="ola-' + kind + '">' + inner + '</b>';
      const key = foldVi(inner);
      return (solo || (key.length <= 60 && SECTION.test(key))) ? '<b class="ola-h">' + inner + '</b>' : '<b>' + inner + '</b>';
    });
    html = colorPhrases(html);
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
    return {code: source.code, id: String(source.id || ''), doc: oneLine(source.doc, 160), soHieu: oneLine(source.soHieu, 80), title: oneLine(source.title, 200), text: String(source.text || '').slice(0, SOURCE_STORE_CHARS), from: String(source.from || ''), link: String(source.link || ''), via: oneLine(source.via, 120), on: true};
  }
  function normalizeMessage(item) {
    if (!item || typeof item !== 'object' || !['user', 'assistant'].includes(item.role)) return null;
    const text = String(item.text || '').slice(0, 12000);
    if (!text.trim()) return null;
    const message = {id: String(item.id || newId()), role: item.role, text};
    if (item.role === 'assistant') {
      message.sources = (Array.isArray(item.sources) ? item.sources : []).map(normalizeSource).filter(Boolean).slice(0, MAX_SOURCES);
      if (item.question) message.question = oneLine(item.question, 300);
      if (Array.isArray(item.queries)) message.queries = item.queries.map(query => oneLine(query, 120)).filter(Boolean).slice(0, MAX_QUERIES);
      if (item.issue) message.issue = oneLine(item.issue, 300);
      if (item.error) message.error = true;
      if (item.empty) message.empty = true;
      if (item.chat) message.chat = true;
    }
    return message;
  }
  const normalizeStore = raw => (Array.isArray(raw && raw.messages) ? raw.messages : []).map(normalizeMessage).filter(Boolean).slice(-STORE_MAX);

  return {SYSTEM, PLAN_SYSTEM, CHAT_SYSTEM, SUGGESTIONS, SOURCE_LIMIT, MAX_SOURCES, QA_COVERAGE, MAX_TURNS, buildPlanRequest, parsePlan, isSmallTalk, buildChatRequest, glossaryQueries, buildQueries, buildRequest, sourceBlock, recentTurns, citedCodes, unknownCodes, answerHtml, plainText, normalizeStore, normalizeMessage, newId};
})();
