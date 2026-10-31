// Tìm đoạn tài liệu liên quan bằng BM25 chạy ngay trong trình duyệt (không gọi API, không tốn quota).
// Không phân biệt dấu/hoa thường; thêm cặp từ liền kề để cụm "bồi thường" hay "đăng kiểm" khớp đúng hơn từng từ lẻ.
const TascoLibSearch = (() => {
  const K1 = 1.5, B = 0.75;
  const norm = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const STOP = new Set(['va', 'cua', 'la', 'co', 'duoc', 'cho', 'cac', 'nhung', 'mot', 'trong', 'khi', 'thi', 'de', 'voi', 'the', 'nao', 'gi', 'bao', 'nhieu', 'ma', 'hay', 'nhu', 'tai', 'ra', 'vao', 'se', 'da', 'bi', 'o']);

  function tokens(text) {
    const words = norm(text).split(' ').filter(word => word && !STOP.has(word) && (word.length > 1 || /\d/.test(word)));
    const out = words.slice();
    for (let i = 0; i + 1 < words.length; i++) out.push(words[i] + '_' + words[i + 1]);
    return out;
  }

  // docs: [{id, meta, chunks:[{t,x}]}]. Tiêu đề mục được tính 3 lần để mục đúng chủ đề xếp trước.
  function build(docs) {
    const items = [], df = new Map();
    let totalLength = 0;
    for (const doc of docs || []) (doc.chunks || []).forEach((chunk, index) => {
      const list = tokens((chunk.t + ' ').repeat(3) + chunk.x);
      const tf = new Map();
      for (const token of list) tf.set(token, (tf.get(token) || 0) + 1);
      for (const token of tf.keys()) df.set(token, (df.get(token) || 0) + 1);
      items.push({doc, index, chunk, tf, length: list.length || 1});
      totalLength += list.length || 1;
    });
    return {items, df, avg: items.length ? totalLength / items.length : 1};
  }

  // options: {keywords: [cụm từ khoá], limit, includeInactive}
  function search(index, query, options = {}) {
    const limit = Math.min(Math.max(Number(options.limit) || 6, 1), 10);
    const wanted = [...new Set(tokens([query, ...(options.keywords || [])].join(' ')))];
    if (!wanted.length || !index.items.length) return [];
    const total = index.items.length;
    const scored = [];
    for (const item of index.items) {
      if (!options.includeInactive && (item.doc.meta?.trangThai || 'dang_hieu_luc') !== 'dang_hieu_luc') continue;
      let score = 0;
      for (const token of wanted) {
        const freq = item.tf.get(token);
        if (!freq) continue;
        const n = index.df.get(token) || 0;
        const idf = Math.log(1 + (total - n + 0.5) / (n + 0.5));
        score += idf * (freq * (K1 + 1)) / (freq + K1 * (1 - B + B * item.length / index.avg)) * (token.includes('_') ? 1.4 : 1);
      }
      if (score > 0) scored.push({score, item});
    }
    scored.sort((first, second) => second.score - first.score);
    return scored.slice(0, limit).map(({score, item}) => ({docId: item.doc.id, doc: item.doc, index: item.index, chunk: item.chunk, score: Math.round(score * 100) / 100}));
  }

  return {tokens, build, search, norm};
})();
