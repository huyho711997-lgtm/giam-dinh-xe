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


  // ==========================================================================
  // ĐỊNH DẠNG: đổi font, cỡ chữ, đậm/nghiêng/gạch chân/gạch ngang, màu chữ cho từng đoạn ký tự và căn lề từng đoạn.
  // Chỉ chạm vào run/pPr của đúng vùng bị đổi; tách run tại ranh giới ký tự và giữ nguyên mọi thuộc tính khác của run.
  // ==========================================================================
  const RPR_ORDER = ['rStyle','rFonts','b','bCs','i','iCs','caps','smallCaps','strike','dstrike','outline','shadow','emboss','imprint','noProof','snapToGrid','vanish','webHidden','color','spacing','w','kern','position','sz','szCs','highlight','u','effect','bdr','shd','fitText','vertAlign','rtl','cs','em','lang','eastAsianLayout','specVanish','oMath'];
  const PPR_ORDER = ['pStyle','keepNext','keepLines','pageBreakBefore','framePr','widowControl','numPr','suppressLineNumbers','pBdr','shd','tabs','suppressAutoHyphens','kinsoku','wordWrap','overflowPunct','topLinePunct','autoSpaceDE','autoSpaceDN','bidi','adjustRightInd','snapToGrid','spacing','ind','contextualSpacing','mirrorIndents','suppressOverlap','jc','textDirection','textAlignment','textboxTightWrap','outlineLvl','divId','cnfStyle','rPr','sectPr','pPrChange'];
  const ALIGN_VALUES = new Set(['left', 'center', 'right', 'both']);
  const attr = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  // Tách phần bên trong <w:rPr>/<w:pPr> thành các phần tử con cấp một. Trả về null nếu cấu trúc lạ (khi đó không dám sửa).
  function splitChildren(inner) {
    const out = [];
    let i = 0;
    while (i < inner.length) {
      if (/\s/.test(inner[i])) { i++; continue; }
      const head = /^<([A-Za-z0-9]+):([A-Za-z0-9]+)((?:\s[^>]*?)?)(\/?)>/.exec(inner.slice(i, i + 4000));
      if (!head) return null;
      const name = head[2];
      let end = i + head[0].length;
      if (!head[4]) {
        const close = '</' + head[1] + ':' + name + '>';
        const at = inner.indexOf(close, end);
        if (at < 0) return null;
        end = at + close.length;
      }
      out.push({name, xml:inner.slice(i, end)});
      i = end;
    }
    return out;
  }
  function setChild(children, name, xml, order) {
    const rank = key => { const at = order.indexOf(key); return at < 0 ? 1000 : at; };
    const at = children.findIndex(child => child.name === name);
    if (at >= 0) { if (xml === null) children.splice(at, 1); else children[at] = {name, xml}; return; }
    if (xml === null) return;
    const next = children.findIndex(child => rank(child.name) > rank(name));
    children.splice(next < 0 ? children.length : next, 0, {name, xml});
  }
  const toggleXml = (tag, on) => on ? '<w:' + tag + '/>' : '<w:' + tag + ' w:val="0"/>';
  // props: {b,i,strike,u: boolean; sz: nửa điểm; font: tên; color: 'RRGGBB'}
  function mergeRPr(rPr, props) {
    let attrs = '', inner = '';
    if (rPr) {
      const match = /^<w:rPr((?:\s[^>]*?)?)(?:\/>|>([\s\S]*)<\/w:rPr>)$/.exec(rPr);
      if (!match) return rPr;
      attrs = match[1] || ''; inner = match[2] || '';
    }
    const children = splitChildren(inner);
    if (!children) return rPr;
    for (const key of ['b', 'i', 'strike']) if (typeof props[key] === 'boolean') setChild(children, key, toggleXml(key, props[key]), RPR_ORDER);
    if (typeof props.u === 'boolean') setChild(children, 'u', '<w:u w:val="' + (props.u ? 'single' : 'none') + '"/>', RPR_ORDER);
    if (Number.isFinite(props.sz) && props.sz >= 2 && props.sz <= 1638) {
      const value = Math.round(props.sz);
      setChild(children, 'sz', '<w:sz w:val="' + value + '"/>', RPR_ORDER);
      if (children.some(child => child.name === 'szCs')) setChild(children, 'szCs', '<w:szCs w:val="' + value + '"/>', RPR_ORDER);
    }
    if (typeof props.font === 'string' && props.font.trim()) {
      const font = attr(props.font.trim().slice(0, 80));
      setChild(children, 'rFonts', '<w:rFonts w:ascii="' + font + '" w:hAnsi="' + font + '" w:eastAsia="' + font + '" w:cs="' + font + '"/>', RPR_ORDER);
    }
    if (typeof props.color === 'string' && /^[0-9a-f]{6}$/i.test(props.color)) setChild(children, 'color', '<w:color w:val="' + props.color.toUpperCase() + '"/>', RPR_ORDER);
    if (!children.length) return rPr || '';
    return '<w:rPr' + attrs + '>' + children.map(child => child.xml).join('') + '</w:rPr>';
  }

  // Thứ tự ký tự của từng token trong đoạn: tab/br = 1 ký tự, <w:t> = độ dài chữ (đơn vị UTF-16).
  function formatRuns(pXml, ranges) {
    const para = scanParagraphs(pXml)[0];
    if (!para) return pXml;
    const info = analyze(pXml, para, 0);
    if (info.locked) throw new Error('Đoạn chứa trường tự động hoặc nội dung đặc biệt, không thể đổi định dạng.');
    const starts = [];
    let total = 0;
    for (const token of info.tokens) { starts.push(total); total += token.text.length; }
    const clean = ranges.filter(range => range && range.end > range.start && range.start >= 0 && range.end <= total && range.props);
    if (!clean.length) return pXml;
    const propsAt = position => {
      const merged = {};
      for (const range of clean) if (position >= range.start && position < range.end) Object.assign(merged, range.props);
      return Object.keys(merged).length ? merged : null;
    };
    const cuts = new Set();
    for (const range of clean) { cuts.add(range.start); cuts.add(range.end); }
    const replacements = [];
    const runRe = /<w:r(?=[\s>])[^>]*>[\s\S]*?<\/w:r>/g;
    let run;
    while ((run = runRe.exec(pXml))) {
      const runStart = run.index, runEnd = run.index + run[0].length;
      const open = /^<w:r(?:\s[^>]*)?>/.exec(run[0])[0];
      const afterOpen = runStart + open.length, closeAt = runEnd - '</w:r>'.length;
      const rPrMatch = /^<w:rPr(?:\s[^>]*)?(?:\/>|>[\s\S]*?<\/w:rPr>)/.exec(pXml.slice(afterOpen, closeAt));
      const rPr = rPrMatch ? rPrMatch[0] : '';
      const contentStart = afterOpen + rPr.length;
      const tokens = [];
      info.tokens.forEach((token, index) => { if (token.start >= contentStart && token.end <= closeAt) tokens.push({token, from:starts[index], to:starts[index] + token.text.length}); });
      if (!tokens.length) continue;
      const rs = tokens[0].from, re = tokens[tokens.length - 1].to;
      if (re <= rs) continue;
      const inside = [...cuts].filter(point => point > rs && point < re);
      const bounds = [rs, ...inside.sort((a, b) => a - b), re];
      const segments = [];
      let any = false;
      for (let k = 0; k + 1 < bounds.length; k++) {
        const props = propsAt(bounds[k]);
        if (props) any = true;
        segments.push({a:bounds[k], b:bounds[k + 1], props});
      }
      if (!any) continue;
      // Phần tử ngoài token (ảnh, dấu ngắt trang hiển thị…) đi kèm token đứng sau nó; phần cuối đi theo đoạn cuối.
      const groups = [];
      let cursor = contentStart;
      for (const item of tokens) { groups.push({filler:pXml.slice(cursor, item.token.start), item}); cursor = item.token.end; }
      const trailing = pXml.slice(cursor, closeAt);
      const pieces = segments.map((segment, segIndex) => {
        let content = '';
        for (const group of groups) {
          const { item } = group;
          const lo = Math.max(segment.a, item.from), hi = Math.min(segment.b, item.to);
          if (lo >= hi) continue;
          content += group.filler;
          if (item.token.kind === 't' && (lo > item.from || hi < item.to)) content += '<w:t xml:space="preserve">' + encode(item.token.text.slice(lo - item.from, hi - item.from)) + '</w:t>';
          else content += pXml.slice(item.token.start, item.token.end);
        }
        if (segIndex === segments.length - 1) content += trailing;
        return open + (segment.props ? mergeRPr(rPr, segment.props) : rPr) + content + '</w:r>';
      });
      replacements.push({start:runStart, end:runEnd, xml:pieces.join('')});
    }
    let out = pXml;
    for (const item of replacements.reverse()) out = out.slice(0, item.start) + item.xml + out.slice(item.end);
    return out;
  }

  function setAlignment(pXml, align) {
    if (!ALIGN_VALUES.has(align)) return pXml;
    const para = scanParagraphs(pXml)[0];
    if (!para) return pXml;
    const range = pPrRange(pXml, para);
    const jc = '<w:jc w:val="' + align + '"/>';
    if (!range) {
      if (para.selfClosing) return pXml.replace(/\s*\/>$/, '><w:pPr>' + jc + '</w:pPr></w:p>');
      return pXml.slice(0, para.openEnd) + '<w:pPr>' + jc + '</w:pPr>' + pXml.slice(para.openEnd);
    }
    const pPr = pXml.slice(range[0], range[1]);
    const match = /^<w:pPr((?:\s[^>]*?)?)(?:\/>|>([\s\S]*)<\/w:pPr>)$/.exec(pPr);
    if (!match) return pXml;
    const children = splitChildren(match[2] || '');
    if (!children) return pXml;
    setChild(children, 'jc', jc, PPR_ORDER);
    return pXml.slice(0, range[0]) + '<w:pPr' + (match[1] || '') + '>' + children.map(child => child.xml).join('') + '</w:pPr>' + pXml.slice(range[1]);
  }
  const applyFormat = (pXml, format) => {
    let out = pXml;
    if (format && format.ranges && format.ranges.length) out = formatRuns(out, format.ranges);
    if (format && format.align) out = setAlignment(out, format.align);
    return out;
  };

  // Ký tự mới gõ/thay thế được XML thừa hưởng định dạng từ ký tự nào của bản gốc (cùng quy tắc với patchParagraph).
  function sourceMap(a, b) {
    const out = new Array(b.length).fill(-1);
    let ai = 0, bi = 0;
    for (const op of diff(a, b)) {
      while (ai < op.at) out[bi++] = ai++;
      const source = !a.length ? -1 : op.del ? op.at : op.at > 0 ? op.at - 1 : 0;
      for (let k = 0; k < op.ins.length; k++) out[bi++] = source;
      ai = op.at + op.del;
    }
    while (ai < a.length) out[bi++] = ai++;
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
    const formats = plan.formats || {};
    for (const key of Object.keys(formats)) {
      const para = list[Number(key)];
      if (!para || removed.has(para.idx)) continue;
      if (para.locked) throw new Error('Đoạn chứa trường tự động hoặc nội dung đặc biệt, không thể đổi định dạng.');
      replace.set(para.idx, applyFormat(replace.has(para.idx) ? replace.get(para.idx) : xml.slice(para.start, para.end), formats[key]));
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
      additions.get(anchor.idx).push(applyFormat(newParagraph(xml, source, norm(item.text || '')), item));
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

  return {listParagraphs, diff, patchParagraph, build, align, emit, norm, decode, encode, mergeRPr, applyFormat, sourceMap};
})();
