// Căn cứ pháp lý cho Công văn AI — lấy từ Thư viện tài liệu (doc_library, cùng kho TASCO AI dùng), KHÔNG để AI tự nhớ.
//  1. buildQueries: truy vấn theo loại công văn + tình huống hồ sơ (báo trễ, giảm trừ, từ chối, ngoài thời hạn…) + gợi ý của AI.
//  2. retrieve: tìm BM25 (TascoLibSearch) trong thư viện, gộp/xếp hạng, chỉ lấy văn bản đang hiệu lực → nguồn [C1], [C2]…
//  3. promptBlock: đưa nguyên văn đoạn trích vào prompt soạn; AI chỉ được dẫn các nguồn này.
//  4. verify: quét bản thảo (kể cả sau khi người dùng sửa tay), mỗi "Điều N…", "Luật…", "Nghị định số …" phải khớp
//     một nguồn đã cấp; không khớp → cảnh báo "chưa kiểm chứng".
// Phần thuần (không DOM, không mạng) có unit test: tests/official-letter-legal.test.mjs.
const OfficialLetterLegal = (() => {
  const MAX_SOURCES = 8, MAX_QUERIES = 12, PER_QUERY = 4, SNIPPET = 1800;
  const fold = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  const key = value => fold(value).replace(/[^a-z0-9]+/g, '');
  const words = value => fold(value).replace(/[^a-z0-9]+/g, ' ').trim();
  const clip = (value, max) => { const text = String(value ?? '').replace(/\s+/g, ' ').trim(); return text.length > max ? text.slice(0, max - 1) + '…' : text; };

  // Chủ đề căn cứ thường cần theo loại công văn (mã mẫu trong official-letter-templates.js).
  const TOPICS = {
    de_nghi_cung_cap_ho_so: ['quyền yêu cầu cơ quan có thẩm quyền cung cấp tài liệu liên quan vụ tai nạn', 'giám định tổn thất xác định nguyên nhân', 'hồ sơ bồi thường biên bản tai nạn của cơ quan công an'],
    thong_bao_bo_sung_ho_so: ['hồ sơ yêu cầu bồi thường gồm các tài liệu', 'thời hạn bổ sung hồ sơ bồi thường', 'thời hạn giải quyết bồi thường kể từ ngày nhận đủ hồ sơ', 'nghĩa vụ cung cấp tài liệu của bên mua bảo hiểm'],
    de_nghi_gara_cung_cap: ['giám định tổn thất phương án sửa chữa thay thế', 'chi phí sửa chữa hợp lý báo giá', 'hồ sơ sửa chữa hoá đơn chứng từ'],
    thong_bao_ket_qua_giam_dinh: ['thời hạn giải quyết bồi thường', 'số tiền bồi thường mức khấu trừ', 'giảm trừ số tiền bồi thường', 'loại trừ trách nhiệm bảo hiểm', 'từ chối bồi thường thông báo bằng văn bản nêu rõ lý do'],
    giai_trinh_tra_loi: ['trách nhiệm bồi thường của doanh nghiệp bảo hiểm', 'loại trừ trách nhiệm bảo hiểm', 'giảm trừ số tiền bồi thường', 'thời hạn giải quyết bồi thường'],
    tu_do: []
  };

  // Truy vấn từ tình huống hồ sơ — dựa trên nhận định tính sẵn của OfficialLetterDossier (chữ, không phụ thuộc cấu trúc).
  const CASE_RULES = [
    [/thông báo tổn thất sau \d+ ngày.*quá/i, ['thời hạn thông báo tổn thất cho doanh nghiệp bảo hiểm', 'giảm trừ bồi thường do không thông báo tổn thất kịp thời']],
    [/NẰM NGOÀI thời hạn bảo hiểm/i, ['thời hạn bảo hiểm hiệu lực của giấy chứng nhận', 'sự kiện bảo hiểm ngoài thời hạn bảo hiểm']],
    [/thanh toán phí .*SAU ngày tổn thất/i, ['thời điểm phát sinh trách nhiệm bảo hiểm thanh toán phí', 'hợp đồng bảo hiểm chưa đóng phí']],
    [/sau ngày hiệu lực — cần lưu ý/i, ['thời điểm bắt đầu hiệu lực bảo hiểm', 'kiểm tra xác minh tổn thất trước thời điểm bảo hiểm']],
    [/tổn thất toàn bộ/i, ['tổn thất toàn bộ xe', 'bồi thường tổn thất toàn bộ giá trị thực tế']],
    [/giảm trừ/i, ['giảm trừ số tiền bồi thường', 'vi phạm nghĩa vụ của bên mua bảo hiểm']],
    [/từ chối/i, ['từ chối bồi thường', 'các trường hợp loại trừ bảo hiểm']],
    [/đồng bảo hiểm/i, ['đồng bảo hiểm phân chia trách nhiệm']],
    [/Chưa ghi nhận ngày nhận đủ hồ sơ/i, ['hồ sơ yêu cầu bồi thường đầy đủ']]
  ];

  // template: mẫu; dossier: kết quả OfficialLetterDossier.build (hoặc null); extra: [chuỗi] — gợi ý của AI / người dùng.
  function buildQueries(template, dossier, extra) {
    const out = [];
    const push = text => { const clean = clip(text, 160); if (clean && !out.some(item => key(item) === key(clean))) out.push(clean); };
    (extra || []).forEach(push);
    if (dossier) {
      const facts = (dossier.facts || []).map(fact => fact.text).join('\n');
      CASE_RULES.forEach(([pattern, queries]) => { if (pattern.test(facts)) queries.forEach(push); });
      // Tên vi phạm giảm trừ cụ thể (VD "Không bảo lưu hiện trường") là truy vấn rất trúng.
      const reduction = (dossier.sections || []).find(section => /Giảm trừ/.test(section.title));
      if (reduction) reduction.rows.filter(row => /^Vi phạm/.test(row[0])).forEach(row => push(row[1].replace(/\(\d+(?:[.,]\d+)?%\)/, '')));
    }
    (TOPICS[template && template.id] || []).forEach(push);
    return out.slice(0, MAX_QUERIES);
  }

  // Gộp kết quả nhiều truy vấn: điểm = điểm cao nhất + 15% mỗi lần trúng thêm; bỏ trùng; giữ tối đa MAX_SOURCES.
  // searchFn(query) → [{docId, index, doc:{meta}, chunk:{t,x}, score}] (định dạng của TascoLibSearch.search).
  function rank(searchFn, queries, limit) {
    const pool = new Map();
    for (const query of queries || []) {
      for (const row of searchFn(query) || []) {
        if (!row || !row.chunk || !row.doc) continue;
        const id = row.docId + ':' + row.index, seen = pool.get(id);
        if (seen) { seen.score = Math.max(seen.score, row.score); seen.hits++; if (!seen.queries.includes(query)) seen.queries.push(query); }
        else pool.set(id, {row, score: row.score, hits: 1, queries: [query]});
      }
    }
    return [...pool.values()].map(item => ({...item, total: item.score * (1 + 0.15 * (item.hits - 1))}))
      .sort((a, b) => b.total - a.total).slice(0, limit || MAX_SOURCES)
      .map((item, i) => toSource(item.row, i + 1, item.queries));
  }

  function toSource(row, n, queries) {
    const meta = (row.doc && row.doc.meta) || {};
    return {
      code: 'C' + n, id: row.docId + ':' + row.index, doc: clip(meta.ten || 'Tài liệu', 160), soHieu: clip(meta.soHieu, 80), title: clip(row.chunk.t, 200),
      text: String(row.chunk.x || '').slice(0, 6000), from: meta.hieuLucTu || '', link: meta.nguon || '', status: meta.trangThai || 'dang_hieu_luc',
      queries: (queries || []).slice(0, 3), on: true
    };
  }
  // Đánh lại mã C1..Cn theo thứ tự hiện có (sau khi thêm/bớt nguồn).
  const renumber = sources => (sources || []).map((source, i) => ({...source, code: 'C' + (i + 1)}));

  // Tìm trong thư viện thật. Trả {sources, total, error}.
  async function retrieve(queries, options = {}) {
    if (typeof TascoLibStore === 'undefined' || typeof TascoLibSearch === 'undefined') return {sources: [], total: 0, error: 'Thư viện tài liệu chưa sẵn sàng trên trang này.'};
    try {
      const docs = await TascoLibStore.list(!!options.force);
      if (!docs.length) return {sources: [], total: 0, error: 'Thư viện tài liệu đang trống — cần nạp Luật KDBH, Nghị định 67/2023, quy tắc bảo hiểm xe… trước.'};
      const index = await TascoLibStore.index();
      return {sources: rank(query => TascoLibSearch.search(index, query, {limit: PER_QUERY}), queries, options.limit), total: docs.length, error: ''};
    } catch (error) {
      return {sources: [], total: 0, error: 'Không đọc được thư viện tài liệu: ' + (error && error.message || 'lỗi không rõ')};
    }
  }

  const sourceLabel = source => source.doc + (source.soHieu && !key(source.doc).includes(key(source.soHieu)) ? ' (số ' + source.soHieu + ')' : '') + ' – ' + source.title;

  function promptBlock(sources) {
    const list = (sources || []).filter(source => source.on !== false);
    if (!list.length) return '';
    return list.map(source => '[' + source.code + '] ' + sourceLabel(source) + (source.from ? ' (hiệu lực từ ' + source.from + ')' : '') + '\n' + String(source.text).replace(/\s+\n/g, '\n').slice(0, SNIPPET)).join('\n\n');
  }

  // ---- Kiểm chứng căn cứ trong bản thảo ----
  const NUMBER = /\b\d{1,4}\/\d{4}\/[A-ZĐ][A-ZĐa-z0-9\-]*\d*\b/g;            // 08/2022/QH15, 67/2023/NĐ-CP, 04/2021/TT-BTC
  const DOC_TYPE = /(Bộ luật|Luật|Nghị định|Thông tư|Quyết định|Quy tắc|Nghị quyết)\s+((?:số\s+)?[^,;:.()\n]{2,90})/g;
  const ARTICLE = /(?:(điểm\s+[a-zđ])\s+)?(?:(khoản\s+\d+)\s+)?Điều\s+(\d+[a-z]?)\b/gi;
  const SKIP_NAME = /^(này|nói trên|trên|nêu trên|liên quan|hiện hành|có liên quan|bảo hiểm)$/i;

  // Văn bản nguồn: tên + số hiệu + tiêu đề mục + nội dung, dạng không dấu để so khớp.
  const haystack = source => ({name: key(source.doc), number: key(source.soHieu), title: words(source.title), body: words(source.title + ' ' + source.text)});
  const hasArticle = (text, n) => new RegExp('(^| )dieu ' + n + '( |$)').test(text);
  function refMatches(ref, source, hay) {
    if (!ref) return true;
    const numbers = ref.match(NUMBER);
    if (numbers) return numbers.some(number => hay.number && (hay.number === key(number) || hay.name.includes(key(number))));
    const name = key(ref.replace(/^(số|năm)\s+/i, ''));
    return !!name && (hay.name.includes(name) || name.includes(hay.name));
  }
  // Phần chỉ văn bản ngay sau "Điều N": tới dấu ; hoặc hết câu hoặc "Điều" kế tiếp.
  function refAfter(text, from) {
    const tail = text.slice(from, from + 170).split(/;|\.\s|\n|(?:^|\s)(?:điểm\s+\S+\s+)?(?:khoản\s+\d+\s+)?Điều\s+\d/i)[0]   // \b không dùng được trước chữ có dấu như "Đ";
    const number = tail.match(NUMBER);
    if (number) return number[0];
    const named = tail.match(/(Bộ luật|Luật|Nghị định|Thông tư|Quyết định|Quy tắc|Nghị quyết)\s+[^,;:()\n]{2,90}/);
    return named ? named[0].replace(/\s+(của|về|ban hành|ngày|quy định|thì|đối với|và)(?=\s|$).*$/i, '').trim() : '';
  }

  // text: toàn bộ chữ của bản thảo; sources: nguồn đã cấp cho AI. Trả [{mention, ok, codes}].
  function verify(text, sources) {
    const body = String(text || ''), list = (sources || []).filter(Boolean).map(source => ({source, hay: haystack(source)}));
    const found = [], seen = new Set();
    const add = (mention, codes) => { const id = key(mention); if (!id || seen.has(id)) return; seen.add(id); found.push({mention: clip(mention, 160), ok: codes.length > 0, codes}); };
    const coveredRanges = [];
    let match;
    ARTICLE.lastIndex = 0;
    while ((match = ARTICLE.exec(body))) {
      const n = fold(match[3]);
      const ref = refAfter(body, match.index + match[0].length);
      const codes = list.filter(({source, hay}) => (hasArticle(hay.title, n) || hasArticle(hay.body, n)) && refMatches(ref, source, hay)).map(({source}) => source.code);
      const refAt = ref ? body.indexOf(ref, match.index + match[0].length) : -1;
      const end = refAt >= 0 ? refAt + ref.length : match.index + match[0].length;
      add(body.slice(match.index, end), codes);   // giữ nguyên cách viết trong bản thảo, VD "khoản 1 Điều 22 Luật … số 08/2022/QH15"
      coveredRanges.push([match.index, end]);
    }
    // Văn bản được nêu tên/số hiệu mà không kèm Điều (VD "Căn cứ Nghị định số 67/2023/NĐ-CP").
    DOC_TYPE.lastIndex = 0;
    while ((match = DOC_TYPE.exec(body))) {
      if (coveredRanges.some(([start, end]) => match.index >= start && match.index < end)) continue;
      const name = match[2].replace(/\s+(của|về việc|ban hành|ngày|đã|được|và|quy định|nêu trên|nói trên)(?=\s|$).*$/i, '').trim();
      const number = match[0].match(NUMBER);
      if (!number && (SKIP_NAME.test(name) || name.split(/\s+/).length < 2)) continue;
      const ref = number ? number[0] : match[1] + ' ' + name;
      const codes = list.filter(({source, hay}) => refMatches(ref, source, hay) || (number && hay.body.includes(words(number[0])))).map(({source}) => source.code);
      add(number ? match[0].slice(0, match[0].indexOf(number[0]) + number[0].length) : match[1] + ' ' + name, codes);
    }
    return found;
  }

  const letterText = letter => letter ? [letter.subject, ...(letter.paragraphs || []).map(p => p.text)].join('\n') : '';

  return {TOPICS, buildQueries, rank, toSource, renumber, retrieve, promptBlock, sourceLabel, verify, letterText, MAX_SOURCES};
})();
