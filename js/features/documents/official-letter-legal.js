// Căn cứ pháp lý cho Công văn AI — lấy từ Thư viện tài liệu (doc_library, cùng kho TASCO AI dùng), KHÔNG để AI tự nhớ.
//  1. buildQueries: truy vấn theo loại công văn + tình huống hồ sơ (báo trễ, giảm trừ, từ chối, ngoài thời hạn…) + gợi ý của AI.
//  2. retrieve: tìm BM25 (TascoLibSearch) trong thư viện, gộp/xếp hạng, chỉ lấy văn bản đang hiệu lực → nguồn [C1], [C2]…
//  3. promptBlock: đưa nguyên văn đoạn trích vào prompt soạn; AI chỉ được dẫn các nguồn này.
//  4. verify: quét bản thảo (kể cả sau khi người dùng sửa tay), mỗi "Điều N…", "Luật…", "Nghị định số …" phải khớp
//     một nguồn đã cấp; không khớp → cảnh báo "chưa kiểm chứng".
// Phần thuần (không DOM, không mạng) có unit test: tests/official-letter-legal.test.mjs.
const OfficialLetterLegal = (() => {
  const MAX_SOURCES = 5, MAX_QUERIES = 10, PER_QUERY = 4, SNIPPET = 1800;
  // Lọc độ liên quan: đoạn phải chứa ≥60% từ có nghĩa của truy vấn và đạt ≥40% điểm của đoạn tốt nhất.
  const MIN_COVERAGE = 0.6, MIN_RELATIVE = 0.4, RELAXED_COVERAGE = 0.3;
  const fold = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  const key = value => fold(value).replace(/[^a-z0-9]+/g, '');
  const words = value => fold(value).replace(/[^a-z0-9]+/g, ' ').trim();
  const clip = (value, max) => { const text = String(value ?? '').replace(/\s+/g, ' ').trim(); return text.length > max ? text.slice(0, max - 1) + '…' : text; };

  // Chỉ các loại công văn mang tính kết luận/giải quyết mới TỰ tìm căn cứ; công văn đề nghị, thông báo bổ sung, gửi gara
  // thông thường không cần viện dẫn điều luật (dẫn vào chỉ gượng ép). Loại khác chỉ tìm khi người dùng nhắc tới căn cứ/luật.
  const NEEDS_BASIS = new Set(['thong_bao_ket_qua_giam_dinh', 'giai_trinh_tra_loi', 'tu_choi_thong_so_lop']);
  const LEGAL_WORDS = /căn cứ|điều luật|\bluật\b|nghị định|thông tư|quy tắc|điều khoản|giảm trừ|chế tài|từ chối|loại trừ|khiếu nại|pháp lý/i;
  const needsBasis = (template, brief) => !!template && (NEEDS_BASIS.has(template.id) || LEGAL_WORDS.test(String(brief || '')));
  // Chủ đề căn cứ thường cần theo loại công văn (mã mẫu trong official-letter-templates.js).
  const TOPICS = {
    de_nghi_cung_cap_ho_so: ['quyền yêu cầu cơ quan có thẩm quyền cung cấp tài liệu liên quan vụ tai nạn', 'giám định tổn thất xác định nguyên nhân', 'hồ sơ bồi thường biên bản tai nạn của cơ quan công an'],
    thong_bao_bo_sung_ho_so: ['hồ sơ yêu cầu bồi thường gồm các tài liệu', 'thời hạn bổ sung hồ sơ bồi thường', 'thời hạn giải quyết bồi thường kể từ ngày nhận đủ hồ sơ', 'nghĩa vụ cung cấp tài liệu của bên mua bảo hiểm'],
    de_nghi_gara_cung_cap: ['giám định tổn thất phương án sửa chữa thay thế', 'chi phí sửa chữa hợp lý báo giá', 'hồ sơ sửa chữa hoá đơn chứng từ'],
    thong_bao_ket_qua_giam_dinh: ['thời hạn giải quyết bồi thường', 'số tiền bồi thường mức khấu trừ', 'giảm trừ số tiền bồi thường', 'loại trừ trách nhiệm bảo hiểm', 'từ chối bồi thường thông báo bằng văn bản nêu rõ lý do'],
    giai_trinh_tra_loi: ['trách nhiệm bồi thường của doanh nghiệp bảo hiểm', 'loại trừ trách nhiệm bảo hiểm', 'giảm trừ số tiền bồi thường', 'thời hạn giải quyết bồi thường'],
    tu_choi_thong_so_lop: ['điểm loại trừ chung thay đổi thông số lốp la-zăng thông số kỹ thuật khuyến cáo nhà sản xuất', 'xe không có giấy chứng nhận kiểm định an toàn kỹ thuật hợp lệ loại trừ', 'từ chối bồi thường các trường hợp loại trừ trách nhiệm bảo hiểm'],
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

  // template: mẫu; dossier: kết quả OfficialLetterDossier.build (hoặc null); extra: [chuỗi] — gợi ý của AI;
  // brief: ý chính người dùng. Công văn không cần căn cứ → [] (không tìm, AI không viện dẫn).
  function buildQueries(template, dossier, extra, brief) {
    const out = [];
    if (!needsBasis(template, brief)) return out;
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
  // Tỷ lệ từ có nghĩa của truy vấn xuất hiện trong đoạn (tiêu đề + nội dung), không dấu.
  const STOP = new Set(['va', 'cua', 'la', 'co', 'duoc', 'cho', 'cac', 'nhung', 'mot', 'trong', 'khi', 'thi', 'de', 'voi', 'theo', 'tai', 've', 'do', 'nay', 'ke', 'tu', 'gom', 'ra', 'vao', 'se', 'da', 'bi']);
  const terms = text => [...new Set(words(text).split(' ').filter(word => word.length > 1 && !STOP.has(word)))];
  function coverage(query, chunk) {
    const wanted = terms(query);
    if (!wanted.length) return 0;
    const have = new Set(words(chunk.t + ' ' + chunk.x).split(' '));
    return wanted.filter(word => have.has(word)).length / wanted.length;
  }
  function rank(searchFn, queries, limit, options) {
    const minCoverage = options && typeof options.minCoverage === 'number' ? options.minCoverage : MIN_COVERAGE;
    const pool = new Map();
    for (const query of queries || []) {
      const rows = (searchFn(query) || []).filter(row => row && row.chunk && row.doc);
      const top = rows.reduce((max, row) => Math.max(max, row.score || 0), 0);
      for (const row of rows) {
        if ((row.score || 0) < top * MIN_RELATIVE || coverage(query, row.chunk) < minCoverage) continue;   // trùng vài từ chung chung → bỏ
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

  // Văn bản người dùng nhắc tên trong yêu cầu ("dùng Quy tắc Tasco", "theo Nghị định 67") → id các văn bản trong thư viện.
  // Chỉ xét từ ĐẶC TRƯNG của tên/số hiệu (chỉ xuất hiện ở dưới nửa số văn bản) nên "quy tắc", "bảo hiểm" không chọn nhầm cả kho.
  function matchDocs(docs, hint) {
    const list = (docs || []).filter(doc => doc && doc.id), total = list.length, wanted0 = words(hint);
    if (!total || !wanted0) return [];
    const names = list.map(doc => new Set(words(((doc.meta && doc.meta.ten) || '') + ' ' + ((doc.meta && doc.meta.soHieu) || '')).split(' ').filter(Boolean)));
    const df = new Map();
    names.forEach(set => set.forEach(word => df.set(word, (df.get(word) || 0) + 1)));
    const wanted = [...new Set(wanted0.split(' '))].filter(word => !/^\d{4}$/.test(word) && (word.length > 1 || /\d/.test(word)) && df.has(word) && df.get(word) <= Math.max(1, Math.floor((total - 1) / 2)));
    if (!wanted.length) return [];
    const scored = list.map((doc, i) => ({id: doc.id, score: wanted.reduce((sum, word) => sum + (names[i].has(word) ? Math.log(1 + total / df.get(word)) : 0), 0)})).filter(item => item.score > 0);
    const best = scored.reduce((max, item) => Math.max(max, item.score), 0);
    return scored.filter(item => item.score >= best - 1e-9).map(item => item.id);
  }
  // Danh sách văn bản đang có trong thư viện (cho ô chọn căn cứ).
  async function listDocs() {
    if (typeof TascoLibStore === 'undefined') return [];
    try { return (await TascoLibStore.list()).map(doc => ({id: doc.id, name: clip((doc.meta && doc.meta.ten) || 'Tài liệu', 120), soHieu: clip(doc.meta && doc.meta.soHieu, 60), active: ((doc.meta && doc.meta.trangThai) || 'dang_hieu_luc') === 'dang_hieu_luc'})); }
    catch (_) { return []; }
  }

  // Giữ thứ tự xếp hạng nhưng tối đa `per` đoạn cho mỗi Điều (cùng tài liệu, cùng tiêu đề bỏ "(phần n)").
  function diversify(sources, per, limit) {
    const count = new Map(), out = [];
    for (const source of sources || []) {
      const key = splitId(source.id)[0] + '|' + String(source.title || '').replace(/\s*\(phần\s*\d+\)\s*$/i, '');
      if ((count.get(key) || 0) >= per) continue;
      count.set(key, (count.get(key) || 0) + 1);
      out.push(source);
      if (out.length >= limit) break;
    }
    return renumber(out);
  }

  // ---- Mở rộng đoạn tìm được (chế độ Hỏi nghiệp vụ) ----
  // Thư viện cắt mỗi Điều thành các đoạn ≤1800 ký tự ("… (phần 1)", "(phần 2)"), nên điều khoản then chốt (VD một mục loại trừ có "trừ trường hợp…")
  // rất hay nằm ở đoạn LIỀN KỀ đoạn khớp từ khoá. Vì vậy: (1) lấy thêm phần liền kề cùng Điều; (2) lần theo dẫn chiếu "theo quy định tại Điều N"
  // trong chính văn bản đó. Đoạn thêm vào có trường via cho người đọc biết vì sao nó xuất hiện.
  const PART = /\s*\(phần\s*\d+\)\s*$/i;
  const baseTitle = title => String(title || '').replace(PART, '');
  const articleOf = title => { const all = [...String(title || '').matchAll(/Điều\s*(\d{1,3})\b/gi)]; return all.length ? Number(all[all.length - 1][1]) : 0; };
  const splitId = id => { const text = String(id || ''), at = text.lastIndexOf(':'); return [text.slice(0, at), Number(text.slice(at + 1))]; };
  function expandSources(docs, sources, options = {}) {
    const max = options.max || 12, maxRefs = options.maxRefs === undefined ? 3 : options.maxRefs;
    const byId = new Map((docs || []).map(doc => [doc.id, doc]));
    const have = new Set((sources || []).map(source => source.id));
    const entries = (sources || []).map((source, i) => ({source, order: [i, 1], extra: false}));
    const extras = [];
    // Mỗi Điều tối đa maxPerArticle đoạn (kể cả đoạn gốc) — Điều dài kiểu "điều khoản bổ sung" không được lấn hết chỗ.
    const cap = options.maxPerArticle || 3, perArticle = new Map();
    const articleKey = (docId, title) => docId + '|' + baseTitle(title);
    (sources || []).forEach(source => { const key = splitId(source.id)[0] + '|' + baseTitle(source.title); perArticle.set(key, (perArticle.get(key) || 0) + 1); });
    const add = (docId, index, order, via, rank) => {
      const doc = byId.get(docId), chunk = doc && doc.chunks && doc.chunks[index];
      const id = docId + ':' + index;
      if (!chunk || have.has(id)) return false;
      const key = articleKey(docId, chunk.t);
      if (/^Phần liền kề/.test(via) && (perArticle.get(key) || 0) >= cap) return false;
      perArticle.set(key, (perArticle.get(key) || 0) + 1);
      have.add(id);
      extras.push({source: {...toSource({docId, index, doc, chunk}, 0, []), via, on: true}, order, extra: true, rank});
      return true;
    };
    // (1) phần liền kề: phần sau trước (điều khoản thường kéo dài xuống dưới), rồi phần trước
    (sources || []).forEach((source, i) => {
      if (i >= (options.siblingTop || 4)) return;   // chỉ các đoạn xếp hạng đầu mới đáng mở rộng; còn lại dễ là nhiễu
      const [docId, index] = splitId(source.id), doc = byId.get(docId), chunk = doc && doc.chunks && doc.chunks[index];
      if (!chunk || !PART.test(chunk.t)) return;
      const base = baseTitle(chunk.t);
      for (let step = 1; step <= 2; step++) { const next = doc.chunks[index + step]; if (!next || baseTitle(next.t) !== base) break; add(docId, index + step, [i, 1 + step], 'Phần liền kề (cùng ' + (base.split('›').pop().trim().slice(0, 60)) + ')', i); }
      const prev = doc.chunks[index - 1];
      if (prev && baseTitle(prev.t) === base) add(docId, index - 1, [i, 0], 'Phần liền kề (cùng ' + (base.split('›').pop().trim().slice(0, 60)) + ')', 20 + i);
    });
    // (2) dẫn chiếu "Điều N" trong văn bản của đoạn tìm được → đoạn đầu tiên của Điều N trong cùng tài liệu
    let refs = 0;
    for (let i = 0; i < (sources || []).length && refs < maxRefs; i++) {
      const source = sources[i], [docId] = splitId(source.id), doc = byId.get(docId);
      if (!doc || !doc.chunks) continue;
      const own = articleOf(source.title), wanted = [];
      String(source.text || '').replace(/[Đđ]iều\s*(\d{1,3})\b/g, (_, n) => { n = Number(n); if (n && n !== own && !wanted.includes(n)) wanted.push(n); return _; });
      for (const n of wanted) {
        if (refs >= maxRefs) break;
        const at = doc.chunks.findIndex(chunk => articleOf(chunk.t) === n);
        if (at >= 0 && add(docId, at, [i, 3], 'Được dẫn chiếu: Điều ' + n, 3.5 + refs)) refs++;
      }
    }
    extras.sort((a, b) => a.rank - b.rank);
    const keep = extras.slice(0, Math.max(0, max - entries.length));
    return renumber(entries.concat(keep).sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1]).map(entry => entry.source));
  }

  // Tìm trong thư viện thật. Trả {sources, total, error}. options: {limit, force, minCoverage, expand (kèm phần liền kề + điều được dẫn chiếu), maxSources, docIds: chỉ tìm trong các văn bản này}.
  async function retrieve(queries, options = {}) {
    if (typeof TascoLibStore === 'undefined' || typeof TascoLibSearch === 'undefined') return {sources: [], total: 0, error: 'Thư viện tài liệu chưa sẵn sàng trên trang này.'};
    try {
      const docs = await TascoLibStore.list(!!options.force);
      if (!docs.length) return {sources: [], total: 0, error: 'Thư viện tài liệu đang trống — cần nạp Luật KDBH, Nghị định 67/2023, quy tắc bảo hiểm xe… trước.'};
      const only = Array.isArray(options.docIds) && options.docIds.length ? new Set(options.docIds) : null;
      const index = only ? TascoLibSearch.build(docs.filter(doc => only.has(doc.id))) : await TascoLibStore.index();
      const search = query => TascoLibSearch.search(index, query, {limit: options.perArticle ? PER_QUERY * 3 : PER_QUERY});   // có giới hạn theo Điều thì cần nhiều ứng viên hơn để Điều khác lọt vào
      // options.minCoverage: câu hỏi tự nhiên (chế độ Hỏi nghiệp vụ) dài hơn truy vấn soạn công văn nên cần ngưỡng phủ từ thấp hơn.
      const rankOptions = typeof options.minCoverage === 'number' ? {minCoverage: options.minCoverage} : undefined;
      // perArticle: một Điều dài (VD điều khoản bổ sung gồm hàng chục mục) không được chiếm hết chỗ → tối đa N đoạn mỗi Điều.
      let sources = options.perArticle ? diversify(rank(search, queries, (options.limit || MAX_SOURCES) * 3, rankOptions), options.perArticle, options.limit || MAX_SOURCES) : rank(search, queries, options.limit, rankOptions);
      // Người dùng đã CHỌN văn bản làm căn cứ mà bộ lọc chặt không ra đoạn nào (điều khoản dùng từ ngữ khác truy vấn) → nới ngưỡng, lấy vài đoạn sát nhất trong chính văn bản đó.
      if (only && !sources.length) sources = rank(search, queries, Math.min(options.limit || MAX_SOURCES, 3), {minCoverage: RELAXED_COVERAGE});
      if (options.expand && sources.length) sources = expandSources(only ? docs.filter(doc => only.has(doc.id)) : docs, sources, {max: options.maxSources});
      return {sources, total: docs.length, error: ''};
    } catch (error) {
      return {sources: [], total: 0, error: 'Không đọc được thư viện tài liệu: ' + (error && error.message || 'lỗi không rõ')};
    }
  }

  // ---- Đọc TOÀN VĂN (Hỏi nghiệp vụ) ----
  // Tra theo đoạn (BM25) bỏ lọt điều khoản dùng từ ngữ khác câu hỏi và không cho AI thấy mối quan hệ giữa các điều (loại trừ ↔ ngoại lệ ↔ định nghĩa ↔ bảng).
  // Văn bản trong thư viện thường chỉ vài chục nghìn ký tự nên cấp NGUYÊN văn bản cho AI; BM25 chỉ còn để xếp thứ tự văn bản khi tổng chữ vượt ngân sách.
  const FULL_BUDGET = 160000;
  const docChars = doc => (doc.chunks || []).reduce((sum, chunk) => sum + String(chunk.t || '').length + Math.min(String(chunk.x || '').length, 6000), 0);
  async function readFull(queries, options = {}) {
    if (typeof TascoLibStore === 'undefined') return {sources: [], included: [], skipped: [], total: 0, error: 'Thư viện tài liệu chưa sẵn sàng trên trang này.'};
    try {
      const all = (await TascoLibStore.list(!!options.force)).filter(doc => doc && doc.id && Array.isArray(doc.chunks) && doc.chunks.length);
      if (!all.length) return {sources: [], included: [], skipped: [], total: 0, error: 'Thư viện tài liệu đang trống — cần nạp Luật KDBH, Nghị định 67/2023, quy tắc bảo hiểm xe… trước.'};
      const only = Array.isArray(options.docIds) && options.docIds.length ? new Set(options.docIds) : null;
      // Người dùng chọn văn bản nào thì đọc đúng văn bản đó (kể cả đã hết hiệu lực); mặc định chỉ văn bản đang hiệu lực.
      let docs = all.filter(doc => only ? only.has(doc.id) : ((doc.meta && doc.meta.trangThai) || 'dang_hieu_luc') === 'dang_hieu_luc');
      const budget = options.budget > 0 ? options.budget : FULL_BUDGET;
      const sizes = new Map(docs.map(doc => [doc.id, docChars(doc)]));
      let skipped = [];
      if (docs.reduce((sum, doc) => sum + sizes.get(doc.id), 0) > budget) {
        // Quá ngân sách: văn bản có nhiều đoạn khớp câu hỏi nhất được đọc trước, văn bản không vừa thì để phần tra đoạn lo.
        const score = new Map();
        try {
          const index = await TascoLibStore.index();
          for (const query of queries || []) for (const row of TascoLibSearch.search(index, query, {limit: 10}) || []) score.set(row.docId, (score.get(row.docId) || 0) + (row.score || 0));
        } catch (_) { /* không xếp hạng được thì giữ thứ tự thư viện */ }
        const ordered = docs.map((doc, i) => ({doc, i, score: score.get(doc.id) || 0})).sort((a, b) => b.score - a.score || a.i - b.i).map(item => item.doc);
        let left = budget; const keep = [];
        for (const doc of ordered) { if (sizes.get(doc.id) <= left) { keep.push(doc); left -= sizes.get(doc.id); } else skipped.push(doc); }
        docs = keep;
      }
      const sources = [], included = [];
      for (const doc of docs) {
        const meta = doc.meta || {};
        doc.chunks.forEach((chunk, index) => { const source = toSource({docId: doc.id, index, chunk, doc}, sources.length + 1, []); source.full = true; sources.push(source); });
        included.push({id: doc.id, name: clip(meta.ten || 'Tài liệu', 120), soHieu: clip(meta.soHieu, 60), chunks: doc.chunks.length, chars: sizes.get(doc.id)});
      }
      return {sources, included, skipped: skipped.map(doc => ({id: doc.id, name: clip((doc.meta && doc.meta.ten) || 'Tài liệu', 120), chars: sizes.get(doc.id)})), total: all.length, error: docs.length ? '' : 'Không có văn bản nào đang hiệu lực để đọc.'};
    } catch (error) {
      return {sources: [], included: [], skipped: [], total: 0, error: 'Không đọc được thư viện tài liệu: ' + (error && error.message || 'lỗi không rõ')};
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

  return {TOPICS, NEEDS_BASIS, needsBasis, coverage, LEGAL_WORDS, matchDocs, listDocs, buildQueries, rank, toSource, renumber, expandSources, retrieve, readFull, FULL_BUDGET, promptBlock, sourceLabel, verify, letterText, MAX_SOURCES};
})();
