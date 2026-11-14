// ==========================================================================
// DOCX – vá văn bản trực tiếp trong word/document.xml, GIỮ NGUYÊN mọi thứ không bị sửa.
// Thuần chuỗi (không DOM, không mạng) nên kiểm thử được bằng Node.
//   - Chỉ động vào các đoạn có thay đổi; đoạn khác, ảnh, bảng, style, đầu/chân trang giữ nguyên từng byte.
//   - Sửa theo từng ký tự (diff) nên định dạng của các run xung quanh được giữ.
//   - Đoạn có trường tự động, theo dõi thay đổi, công thức, hộp văn bản… bị KHÓA (không cho sửa) để không làm hỏng file.
//   - build() tự đọc lại kết quả và đối chiếu; sai khác thì từ chối ghi.
// ==========================================================================
const DocxPatch = (() => {
  const NBSP = /\u00a0/g;
  // Chuẩn hóa để so sánh: nbsp (do trình duyệt tự chèn khi gõ dấu cách) coi như dấu cách, bỏ ký tự điều khiển XML không hợp lệ.
  // eslint-disable-next-line no-control-regex
  const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g;
  const norm = text => String(text).replace(NBSP, ' ').replace(CONTROL, '');
  const decode = value => value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity) => {
    const key = entity.toLowerCase();
    if (key === 'amp') return '&';
    if (key === 'lt') return '<';
    if (key === 'gt') return '>';
    if (key === 'quot') return '"';
    if (key === 'apos') return "'";
    const code = key[1] === 'x' ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
  });
  const encode = value => value.replace(CONTROL, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Phần tử bên trong đoạn mà ta không dám sửa chữ quanh nó.
  const LOCKED = /<(?:w:fldChar|w:fldSimple|w:instrText|w:ins|w:del|w:moveFrom|w:moveTo|w:sym|w:ptab|w:footnoteReference|w:endnoteReference|w:sdt|w:softHyphen|w:noBreakHyphen|w:object|w:pict|m:oMath|m:oMathPara|mc:AlternateContent)[\s>/]|<w:br\s[^>]*w:type="(?:page|column)"|<w:cr\s*\/>/;
  // Đoạn chứa các thứ này thì không được xóa cả đoạn.
  const KEEP = /<(?:w:drawing|w:pict|w:object|w:hyperlink|w:bookmarkStart|w:bookmarkEnd|w:sectPr|w:fldChar|w:fldSimple|w:sdt|mc:AlternateContent|w:commentRangeStart)[\s>/]/;
  const TOKEN = /<w:t(?:\s[^>]*)?(?:\/>|>([\s\S]*?)<\/w:t>)|<w:tab\s*\/>|<w:br(?:\s[^>]*)?\/>/g;

  // ---- Tìm các đoạn văn "lá" trong thân tài liệu (bỏ đoạn lồng trong hộp văn bản) -------------
  function scanParagraphs(xml) {
    const re = /<(\/?)w:p(?=[\s>/])[^>]*>/g;
    const found = [], stack = [];
    let match;
    while ((match = re.exec(xml))) {
      if (match[1]) {
        const open = stack.pop();
        if (open) { open.end = match.index + match[0].length; found.push(open); }
      } else if (match[0].endsWith('/>')) {
        if (stack.length) stack[stack.length - 1].nested = true;
        found.push({start:match.index, end:match.index + match[0].length, openEnd:match.index + match[0].length, selfClosing:true, nested:false});
      } else {
        if (stack.length) stack[stack.length - 1].nested = true;
        stack.push({start:match.index, openEnd:match.index + match[0].length, selfClosing:false, nested:false});
      }
    }
    found.sort((a, b) => a.start - b.start);
    const boxes = [], boxRe = /<w:txbxContent[\s>]|<\/w:txbxContent>/g;
    let depth = 0, from = 0;
    while ((match = boxRe.exec(xml))) {
      if (match[0][1] === '/') { if (depth && --depth === 0) boxes.push([from, match.index]); }
      else if (depth++ === 0) from = match.index;
    }
    const inBox = start => boxes.some(([a, b]) => start > a && start < b);
    return found.filter(item => !item.nested && !inBox(item.start));
  }

  function pPrRange(xml, para) {
    if (para.selfClosing || !xml.startsWith('<w:pPr', para.openEnd) || !/[\s>/]/.test(xml[para.openEnd + 6] || '')) return null;
    const head = /^<w:pPr[^>]*>/.exec(xml.slice(para.openEnd, para.openEnd + 4000));
    if (!head) return null;
    if (head[0].endsWith('/>')) return [para.openEnd, para.openEnd + head[0].length];
    const re = /<w:pPr(?=[\s>/])[^>]*>|<\/w:pPr>/g;
    re.lastIndex = para.openEnd;
    let depth = 0, match;
    while ((match = re.exec(xml))) {
      if (match[0][1] === '/') { if (--depth === 0) return [para.openEnd, match.index + match[0].length]; }
      else if (!match[0].endsWith('/>')) depth++;
      if (match.index > para.end) break;
    }
    return null;
  }

  function analyze(xml, para, index) {
    const range = pPrRange(xml, para);
    const bodyStart = range ? range[1] : para.openEnd;
    const bodyEnd = para.selfClosing ? para.end : para.end - '</w:p>'.length;
    const body = xml.slice(bodyStart, bodyEnd);
    const tokens = [];
    TOKEN.lastIndex = 0;
    let match;
    while ((match = TOKEN.exec(body))) {
      const start = bodyStart + match.index, end = start + match[0].length;
      if (match[0].startsWith('<w:tab')) tokens.push({kind:'tab', start, end, text:'\t'});
      else if (match[0].startsWith('<w:br')) tokens.push({kind:'br', start, end, text:'\n'});
      else tokens.push({kind:'t', start, end, text:decode(match[1] || '')});
    }
    const whole = xml.slice(para.start, para.end);
    return {
      idx:index, start:para.start, end:para.end, openEnd:para.openEnd, selfClosing:para.selfClosing, bodyStart, bodyEnd,
      pPr:range ? xml.slice(range[0], range[1]) : '',
      tokens, text:tokens.map(token => token.text).join(''),
      locked:LOCKED.test(body),
      removable:!KEEP.test(whole) && !LOCKED.test(body)
    };
  }

  function listParagraphs(xml) {
    return scanParagraphs(xml).map((para, index) => analyze(xml, para, index));
  }

  // ---- So sánh hai chuỗi theo ký tự → danh sách thao tác {at, del, ins} (toạ độ của chuỗi cũ) ----
  function diff(a, b) {
    if (a === b) return [];
    const limit = Math.min(a.length, b.length);
    let head = 0;
    while (head < limit && a[head] === b[head]) head++;
    let tail = 0;
    while (tail < limit - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
    const A = a.slice(head, a.length - tail), B = b.slice(head, b.length - tail);
    const m = A.length, n = B.length;
    if (!m || !n || m * n > 2000000) return [{at:head, del:m, ins:B}];
    const width = n + 1, table = new Uint16Array((m + 1) * width);
    for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) {
      table[i * width + j] = A[i] === B[j] ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
    const ops = [];
    let i = 0, j = 0, cur = null;
    const flush = () => { if (cur) { ops.push(cur); cur = null; } };
    while (i < m || j < n) {
      if (i < m && j < n && A[i] === B[j]) { flush(); i++; j++; continue; }
      if (!cur) cur = {at:head + i, del:0, ins:''};
      if (j >= n || (i < m && table[(i + 1) * width + j] >= table[i * width + j + 1])) { cur.del++; i++; }
      else { cur.ins += B[j]; j++; }
    }
    flush();
    // Gộp các thao tác chỉ cách nhau 1–2 ký tự trùng để khỏi vụn (kết quả vẫn đúng, chỉ gọn hơn).
    const merged = [];
    for (const op of ops) {
      const last = merged[merged.length - 1];
      if (last && op.at - (last.at + last.del) <= 2) {
        last.ins += a.slice(last.at + last.del, op.at) + op.ins;
        last.del = op.at + op.del - last.at;
      } else merged.push({...op});
    }
    return merged;
  }

  // ---- Dựng các phần tử XML cho một đoạn chữ (tab → <w:tab/>, xuống dòng → <w:br/>) ------------
  function emit(text) {
    if (!text) return '';
    return text.split(/([\t\n])/).map(part => part === '\t' ? '<w:tab/>' : part === '\n' ? '<w:br/>' : part ? '<w:t xml:space="preserve">' + encode(part) + '</w:t>' : '').join('');
  }
  const markRun = (pPr, source) => {
    const own = /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(pPr);
    const rPr = own && !/<w:(?:ins|del)[\s>/]/.test(own[0]) ? own[0] : '';
    if (rPr) return rPr;
    const runs = [...source.matchAll(/<w:r(?:\s[^>]*)?>(<w:rPr>[\s\S]*?<\/w:rPr>)?(?:(?!<\/w:r>)[\s\S])*?<w:t[\s>/]/g)].filter(item => item[1]);
    const last = runs[runs.length - 1];
    return last && !/<w:(?:ins|del)[\s>/]/.test(last[1]) ? last[1] : '';
  };

  // ---- Áp danh sách thao tác lên MỘT đoạn, trả về XML mới của đoạn đó --------------------------
  function patchParagraph(xml, para, ops) {
    const atoms = [];
    const states = para.tokens.map(token => {
      const chars = token.kind === 't' ? [...token.text.split('')] : [token.text];
      const state = {token, chars, gone:chars.map(() => false), before:chars.map(() => ''), after:''};
      chars.forEach((_, offset) => atoms.push({state, offset}));
      return state;
    });
    let paragraphInsert = '';
    for (const op of ops) {
      if (op.del) for (let i = op.at; i < op.at + op.del; i++) atoms[i].state.gone[atoms[i].offset] = true;
      if (!op.ins) continue;
      if (op.del) { const atom = atoms[op.at]; atom.state.before[atom.offset] += op.ins; }
      else if (!atoms.length) paragraphInsert += op.ins;
      else if (op.at > 0) {
        const atom = atoms[op.at - 1];
        if (atom.state.token.kind === 't') {
          // Gõ tiếp ngay sau ký tự trước → thừa hưởng định dạng của ký tự đó.
          if (atom.offset + 1 < atom.state.chars.length) atom.state.before[atom.offset + 1] = op.ins + atom.state.before[atom.offset + 1];
          else atom.state.after += op.ins;
        } else atom.state.after += op.ins;
      } else { const atom = atoms[0]; atom.state.before[atom.offset] += op.ins; }
    }
    let out = '', cursor = para.start;
    const src = xml;
    for (const state of states) {
      const { token } = state;
      out += src.slice(cursor, token.start);
      cursor = token.end;
      const touched = state.gone.some(Boolean) || state.before.some(Boolean) || state.after;
      if (!touched) { out += src.slice(token.start, token.end); continue; }
      if (token.kind === 't') {
        const text = state.chars.map((char, index) => state.before[index] + (state.gone[index] ? '' : char)).join('') + state.after;
        out += emit(text);
      } else out += emit(state.before[0]) + (state.gone[0] ? '' : src.slice(token.start, token.end)) + emit(state.after);
    }
    out += src.slice(cursor, para.end);
    if (paragraphInsert) {
      const run = '<w:r>' + markRun(para.pPr, src.slice(para.start, para.end)) + emit(paragraphInsert) + '</w:r>';
      if (para.selfClosing) out = out.replace(/\s*\/>$/, '>') + run + '</w:p>';
      else out = out.slice(0, out.length - '</w:p>'.length) + run + '</w:p>';
    }
    return out;
  }

  const newParagraph = (xml, source, text) => {
    const pPr = source.pPr.replace(/<w:sectPr[\s\S]*?<\/w:sectPr>/g, '').replace(/<w:pPrChange[\s\S]*?<\/w:pPrChange>/g, '');
    const cleanPPr = /^<w:pPr[^>]*\/>$/.test(pPr) ? pPr : pPr;
    const rPr = markRun(source.pPr, xml.slice(source.start, source.end));
    return '<w:p>' + cleanPPr + (text ? '<w:r>' + rPr + emit(text) + '</w:r>' : '') + '</w:p>';
  };

  // ---- Dựng document.xml mới từ kế hoạch ---------------------------------------------------------
  // plan = {edits:{[idx]: textMoi}, removed:[idx], created:[{anchor, cloneOf, text}]}
  function build(xml, plan) {
    const list = listParagraphs(xml);
    const edits = plan.edits || {}, removed = new Set(plan.removed || []), created = plan.created || [];
    const replace = new Map();
    for (const key of Object.keys(edits)) {
      const para = list[Number(key)];
      if (!para) throw new Error('Đoạn cần sửa không còn trong tài liệu.');
      if (para.locked) throw new Error('Đoạn chứa trường tự động hoặc nội dung đặc biệt, không thể sửa.');
      const target = norm(edits[key]);
      const ops = diff(norm(para.text), target);
      if (ops.length) replace.set(para.idx, patchParagraph(xml, para, ops));
    }
    for (const idx of removed) {
      const para = list[idx];
      if (!para || !para.removable) throw new Error('Đoạn này không xóa được vì chứa ảnh, liên kết hoặc trường đặc biệt.');
      replace.set(idx, '');
    }
    const additions = new Map();
    for (const item of created) {
      const source = list[item.cloneOf], anchor = list[item.anchor];
      if (!source || !anchor) throw new Error('Không xác định được đoạn gốc để tạo đoạn mới.');
      if (!additions.has(anchor.idx)) additions.set(anchor.idx, []);
      additions.get(anchor.idx).push(newParagraph(xml, source, norm(item.text || '')));
    }
    let out = '', cursor = 0;
    for (const para of list) {
      if (!replace.has(para.idx) && !additions.has(para.idx)) continue;
      out += xml.slice(cursor, para.start);
      out += replace.has(para.idx) ? replace.get(para.idx) : xml.slice(para.start, para.end);
      out += (additions.get(para.idx) || []).join('');
      cursor = para.end;
    }
    out += xml.slice(cursor);
    // Đọc lại và đối chiếu: không khớp thì không ghi.
    const expected = [];
    for (const para of list) {
      if (!removed.has(para.idx)) expected.push(para.idx in edits || String(para.idx) in edits ? norm(edits[para.idx]) : norm(para.text));
      for (const item of created) if (item.anchor === para.idx) expected.push(norm(item.text || ''));
    }
    const after = listParagraphs(out).map(para => norm(para.text));
    if (after.length !== expected.length || after.some((text, index) => text !== expected[index])) throw new Error('Kết quả sau khi sửa không khớp với nội dung đã nhập, nên chưa ghi để tránh làm hỏng tài liệu.');
    return out;
  }

  // ---- Ghép các đoạn trên màn hình với các đoạn trong XML (theo nội dung) -------------------------
  // Trả về mảng cùng độ dài domTexts: chỉ số đoạn XML, hoặc -1 nếu không ghép được. null = quá lớn.
  function align(domTexts, xmlTexts) {
    const a = domTexts.map(norm), b = xmlTexts.map(norm);
    const result = a.map(() => -1);
    let head = 0;
    while (head < a.length && head < b.length && a[head] === b[head]) { result[head] = head; head++; }
    let tail = 0;
    while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) { result[a.length - 1 - tail] = b.length - 1 - tail; tail++; }
    const m = a.length - head - tail, n = b.length - head - tail;
    if (m <= 0 || n <= 0) return result;
    if (m * n > 9000000) return null;
    const width = n + 1, table = new Uint16Array((m + 1) * width);
    for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) {
      table[i * width + j] = a[head + i] === b[head + j] ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
    let i = 0, j = 0;
    while (i < m && j < n) {
      if (a[head + i] === b[head + j]) { result[head + i] = head + j; i++; j++; }
      else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) i++;
      else j++;
    }
    return result;
  }

  return {listParagraphs, diff, patchParagraph, build, align, emit, norm, decode, encode};
})();
