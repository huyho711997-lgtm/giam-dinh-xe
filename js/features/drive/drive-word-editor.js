// ==========================================================================
// GOOGLE DRIVE – chỉnh sửa trực tiếp tệp Word (.docx) trong trình duyệt.
// Dựng trang bằng docx-preview (giữ nguyên bố cục), cho gõ trực tiếp trên từng đoạn; khi lưu chỉ vá các đoạn
// đã đổi trong word/document.xml (DocxPatch) nên ảnh, bảng, kiểu chữ, đầu/chân trang không bị đụng tới.
// Mỗi lần lưu đều hỏi: ghi đè bản gốc / lưu bản sao / tải về máy.
// Module không gọi mạng trực tiếp: trang Drive truyền load() và save().
// ==========================================================================
const DriveWordEditor = (() => {
  const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const SAVE_MAX = 10 * 1024 * 1024;
  const DOCX_LIB = 'https://cdn.jsdelivr.net/npm/docx-preview@0.4.1/dist/docx-preview.min.js';
  const TAB_CHAR = ' '; // docx-preview vẽ <w:tab/> bằng một span chứa khoảng trắng em
  const libs = new Map();
  let current = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));
  const ICONS = {
    word:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="m9 11 1.2 5L12 12l1.8 4 1.2-5"/>',
    save:'<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
    undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    redo:'<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    close:'<path d="M6 6l12 12M18 6 6 18"/>',
    download:'<path d="M12 4v12m0 0-4-4m4 4 4-4"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    cloud:'<path d="M7 18a4 4 0 0 1-.6-7.96A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z"/><path d="m9 13 3-3 3 3M12 10v7"/>',
    up:'<path d="m6 15 6-6 6 6"/>',
    down:'<path d="m6 9 6 6 6-6"/>',
    alert:'<path d="M12 4 3 20h18z"/><path d="M12 10v4M12 17h.01"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  const norm = text => DocxPatch.norm(text);

  function loadScript(url, ready) {
    if (ready()) return Promise.resolve();
    if (!libs.has(url)) libs.set(url, new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = resolve;
      script.onerror = () => { libs.delete(url); script.remove(); reject(new Error('Không tải được thư viện dựng trang Word. Kiểm tra mạng rồi thử lại.')); };
      document.head.appendChild(script);
    }));
    return libs.get(url);
  }

  // ---- Đọc chữ của một đoạn trên màn hình theo đúng quy ước của XML (tab = \t, xuống dòng = \n) ----
  const isTab = el => el.tagName === 'SPAN' && el.childNodes.length === 1 && el.firstChild.nodeType === 3 && (el.firstChild.data === TAB_CHAR || el.firstChild.data === '\t');
  function domText(p) {
    let out = '';
    const walk = node => {
      for (const child of node.childNodes) {
        if (child.nodeType === 3) out += child.data;
        else if (child.nodeType === 1) {
          const tag = child.tagName;
          if (tag === 'BR') { if (!(child.parentNode === p && child === p.lastChild)) out += '\n'; }
          else if (isTab(child)) out += '\t';
          else if (tag === 'IMG' || tag === 'SVG' || tag === 'CANVAS') continue;
          else walk(child);
        }
      }
    };
    walk(p);
    return out;
  }
  // Bản đồ vị trí ký tự → nút văn bản (để chọn / thay thế khi tìm kiếm).
  function textMap(p) {
    const parts = [];
    let pos = 0;
    const walk = node => {
      for (const child of node.childNodes) {
        if (child.nodeType === 3) { parts.push({node:child, start:pos, end:pos + child.data.length}); pos += child.data.length; }
        else if (child.nodeType === 1) {
          const tag = child.tagName;
          if (tag === 'BR') { if (!(child.parentNode === p && child === p.lastChild)) pos += 1; }
          else if (isTab(child)) pos += 1;
          else if (tag === 'IMG' || tag === 'SVG' || tag === 'CANVAS') continue;
          else walk(child);
        }
      }
    };
    walk(p);
    return {parts, length:pos};
  }
  function locate(p, index, preferEnd) {
    const {parts} = textMap(p);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (index > part.start && index < part.end) return {node:part.node, offset:index - part.start};
      if (index === part.start && !(preferEnd && i > 0 && parts[i - 1].end === index)) return {node:part.node, offset:0};
      if (index === part.end && (preferEnd || !parts[i + 1] || parts[i + 1].start > index)) return {node:part.node, offset:part.node.data.length};
    }
    return null;
  }

  const frameCss = `html{background:#e9edf2}body{margin:0;padding:24px;color:#111827;font:14px Arial,sans-serif}
[contenteditable="true"]{outline:none;caret-color:#1d4ed8;border-radius:2px;transition:background .12s,box-shadow .12s}
[contenteditable="true"]:hover{background:rgba(37,99,235,.06);box-shadow:0 0 0 2px rgba(37,99,235,.10)}
[contenteditable="true"]:focus{background:rgba(37,99,235,.09);box-shadow:0 0 0 2px rgba(37,99,235,.38)}
.dwe-locked{cursor:not-allowed}.dwe-locked:hover{background:rgba(217,119,6,.10);box-shadow:0 0 0 2px rgba(217,119,6,.18)}
::selection{background:rgba(37,99,235,.28)}
::highlight(dwe-find){background:#fde68a;color:#111}::highlight(dwe-current){background:#fb923c;color:#111}`;

  function close(force) {
    const state = current;
    if (!state) return Promise.resolve(true);
    if (!force && state.dirty()) return askLeave(state).then(ok => { if (ok) return close(true); return false; });
    current = null;
    state.controller.abort();
    window.removeEventListener('beforeunload', state.beforeUnload);
    clearTimeout(state.timer);
    try { state.overlay.close(); } catch (_) {}
    state.overlay.remove();
    document.body.style.overflow = state.overflow;
    if (state.previousFocus?.isConnected) state.previousFocus.focus({preventScroll:true});
    state.options.onClose?.();
    return Promise.resolve(true);
  }

  // ---- Hộp thoại nhỏ trong khung chỉnh sửa -----------------------------------------------------
  function dialog(state, html) {
    const box = document.createElement('dialog');
    box.className = 'dwe-dialog';
    box.innerHTML = html;
    state.overlay.appendChild(box);
    box.addEventListener('cancel', event => { event.preventDefault(); box.close('cancel'); });
    box.addEventListener('keydown', event => event.stopPropagation());
    box.addEventListener('close', () => box.remove());
    box.showModal();
    return box;
  }
  function askLeave(state) {
    return new Promise(resolve => {
      const box = dialog(state, `<h2>Đóng và bỏ thay đổi?</h2><p>Bạn có thay đổi chưa lưu trong “${esc(state.file.name)}”. Nếu đóng bây giờ, các thay đổi này sẽ mất.</p>
        <div class="dwe-dialog-actions"><button type="button" class="sf-button" data-stay>Tiếp tục chỉnh sửa</button><button type="button" class="sf-button dwe-danger" data-leave>Đóng, bỏ thay đổi</button></div>`);
      box.querySelector('[data-stay]').onclick = () => box.close('stay');
      box.querySelector('[data-leave]').onclick = () => box.close('leave');
      box.addEventListener('close', () => resolve(box.returnValue === 'leave'));
      box.querySelector('[data-stay]').focus();
    });
  }

  // ---- Kế hoạch thay đổi lấy từ màn hình -----------------------------------------------------
  const paragraphs = state => [...state.doc.querySelectorAll('section.docx > article p')];
  function collectPlan(state) {
    const edits = {}, created = [], present = new Set();
    for (const el of paragraphs(state)) {
      const info = el._dwe;
      if (!info) continue;
      if (info.created) created.push({anchor:info.anchor, cloneOf:info.cloneOf, text:domText(el)});
      else if (info.editable) {
        present.add(info.idx);
        const text = domText(el);
        if (norm(text) !== info.snapshot) edits[info.idx] = text;
      }
    }
    const removed = state.editable.filter(idx => !present.has(idx));
    return {edits, created, removed};
  }
  const planSignature = plan => JSON.stringify([plan.edits, plan.created, plan.removed]);
  function refreshStatus(state) {
    if (!state.doc) return;
    const plan = collectPlan(state);
    state.signature = planSignature(plan);
    const changed = Object.keys(plan.edits).length, added = plan.created.length, removed = plan.removed.length;
    const parts = [];
    if (changed) parts.push(changed + ' đoạn đã sửa');
    if (added) parts.push(added + ' đoạn mới');
    if (removed) parts.push(removed + ' đoạn đã xóa');
    const dirty = state.dirty();
    state.status.textContent = dirty ? parts.join(' · ') + ' · chưa lưu' : (state.savedNote || 'Chưa có thay đổi');
    state.status.classList.toggle('is-dirty', dirty);
    state.saveButton.disabled = !dirty;
    state.undoButton.disabled = state.redoButton.disabled = false;
  }
  const scheduleStatus = state => { clearTimeout(state.timer); state.timer = setTimeout(() => { if (current === state) { refreshStatus(state); if (state.findOpen) runFind(state, false); } }, 140); };

  // ---- Dựng tài liệu và gắn chế độ sửa --------------------------------------------------------
  async function renderDocument(state, bytes) {
    state.bytes = bytes;
    const header = new Uint8Array(bytes.slice(0, 2));
    if (header[0] !== 0x50 || header[1] !== 0x4b) throw new Error('Tệp không phải định dạng Word (.docx). Tệp .doc cũ cần mở bằng Word rồi lưu lại thành .docx.');
    if (!window.JSZip) throw new Error('Chưa tải được thư viện đọc tệp Word. Vui lòng tải lại trang.');
    await loadScript(DOCX_LIB, () => !!window.docx);
    if (current !== state) return;
    state.zip = await JSZip.loadAsync(bytes);
    const entry = state.zip.file('word/document.xml');
    if (!entry) throw new Error('Tệp Word không hợp lệ (thiếu nội dung chính).');
    state.xml = await entry.async('string');
    if (current !== state) return;
    const scroll = state.doc ? state.doc.scrollingElement.scrollTop : 0;
    const doc = state.frame.contentDocument;
    doc.open();
    doc.write(`<!doctype html><html lang="vi"><head><meta charset="UTF-8"><style>${frameCss}</style></head><body></body></html>`);
    doc.close();
    state.doc = doc;
    state.status.textContent = 'Đang dựng trang…';
    await window.docx.renderAsync(bytes.slice(0), doc.body, doc.head, {inWrapper:true, breakPages:true, useBase64URL:true, renderAltChunks:false, ignoreLastRenderedPageBreak:false});
    if (current !== state) return;
    attach(state);
    if (scroll) doc.scrollingElement.scrollTop = scroll;
    state.frame.contentWindow.focus();
  }

  function attach(state) {
    const doc = state.doc;
    const list = DocxPatch.listParagraphs(state.xml);
    const els = paragraphs(state);
    const mapping = DocxPatch.align(els.map(domText), list.map(item => item.text));
    state.editable = [];
    state.locked = 0;
    state.readonly = 0;
    if (!mapping) { state.readonly = els.length; state.notice('Tài liệu quá lớn để bật chỉnh sửa trên màn hình.'); return; }
    els.forEach((el, index) => {
      const target = mapping[index] >= 0 ? list[mapping[index]] : null;
      if (!target) { if (domText(el).trim()) state.readonly++; return; }
      if (target.locked) { el.classList.add('dwe-locked'); el.title = 'Đoạn này chứa trường tự động, theo dõi thay đổi hoặc nội dung đặc biệt nên được khóa để không làm hỏng tài liệu.'; state.locked++; return; }
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'true');
      el.spellcheck = true;
      el._dwe = {idx:target.idx, editable:true, snapshot:norm(target.text), removable:target.removable};
      state.editable.push(target.idx);
    });
    state.savedSignature = null;
    state.savedNote = '';
    const bits = [];
    if (state.locked) bits.push(state.locked + ' đoạn bị khóa');
    if (state.readonly) bits.push(state.readonly + ' đoạn chỉ xem');
    state.limits.textContent = bits.length ? bits.join(' · ') + ' (trường tự động, hộp văn bản…)' : '';
    state.limits.hidden = !bits.length;
    state.savedSignature = planSignature({edits:{}, created:[], removed:[]});
    refreshStatus(state);
    wire(state);
  }

  // ---- Bắt sự kiện soạn thảo --------------------------------------------------------------------
  function paragraphOf(state, node) {
    let el = node && node.nodeType === 3 ? node.parentNode : node;
    while (el && el !== state.doc.body) { if (el.tagName === 'P' && el._dwe) return el; el = el.parentNode; }
    return null;
  }
  function caretOffset(state, p) {
    const sel = state.doc.getSelection();
    if (!sel.rangeCount || !p.contains(sel.anchorNode)) return -1;
    const range = state.doc.createRange();
    range.setStart(p, 0);
    range.setEnd(sel.anchorNode, sel.anchorOffset);
    const box = state.doc.createElement('p');
    box.appendChild(range.cloneContents());
    return domText(box).length;
  }
  function placeCaret(state, node, offset) {
    const sel = state.doc.getSelection();
    const range = state.doc.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  // Chrome gộp chữ gõ tiếp vào span tab vừa chèn ("\u2003X") → tách lại để mỗi tab vẫn là một span riêng và đọc ra đúng "\t".
  function normalizeTabs(state, p) {
    const bad = [...p.querySelectorAll('span[data-dwe-tab]')].filter(span => span.childNodes.length !== 1 || span.firstChild.nodeType !== 3 || span.firstChild.data !== TAB_CHAR);
    if (!bad.length) return;
    const offset = caretOffset(state, p);
    for (const span of bad) {
      const doc = span.ownerDocument, frag = doc.createDocumentFragment();
      const text = span.textContent;
      let buffer = '';
      const flush = () => { if (buffer) { frag.appendChild(doc.createTextNode(buffer)); buffer = ''; } };
      for (const ch of text) {
        if (ch === TAB_CHAR) { flush(); const tab = doc.createElement('span'); tab.setAttribute('data-dwe-tab', ''); tab.textContent = TAB_CHAR; frag.appendChild(tab); }
        else buffer += ch;
      }
      flush();
      span.replaceWith(frag);
    }
    p.normalize();
    if (offset >= 0) { const at = locate(p, offset, true); if (at) placeCaret(state, at.node, at.offset); }
  }
  function splitParagraph(state, p) {
    const doc = state.doc, sel = doc.getSelection();
    if (!sel.rangeCount) return;
    if (!sel.isCollapsed) doc.execCommand('delete');
    const range = sel.getRangeAt(0);
    const tailRange = doc.createRange();
    tailRange.setStart(range.startContainer, range.startOffset);
    tailRange.setEnd(p, p.childNodes.length);
    if (tailRange.cloneContents().querySelector('img,svg,canvas')) { state.toast('Đoạn này có ảnh sau con trỏ nên chưa tách được. Hãy nhấn Enter ở cuối đoạn.', 'warning'); return; }
    const tail = tailRange.extractContents();
    const info = p._dwe;
    const fresh = p.cloneNode(false);
    fresh.removeAttribute('title');
    fresh.classList.remove('dwe-locked');
    fresh.appendChild(tail);
    fresh._dwe = {created:true, anchor:info.created ? info.anchor : info.idx, cloneOf:info.created ? info.cloneOf : info.idx};
    p.after(fresh);
    for (const el of [p, fresh]) if (!domText(el) && !el.querySelector('br,img')) el.appendChild(doc.createElement('br'));
    const first = fresh.firstChild;
    placeCaret(state, first && first.nodeType === 3 ? first : fresh, 0);
    fresh.scrollIntoView({block:'nearest'});
    scheduleStatus(state);
  }
  function removeEmpty(state, p) {
    const info = p._dwe;
    if (domText(p)) return false;
    const siblings = p.parentElement ? [...p.parentElement.children].filter(child => child.tagName === 'P') : [];
    if (!info.created && !info.removable) { state.toast('Đoạn trống này chứa ảnh hoặc ký hiệu đặc biệt nên không xóa được.', 'warning'); return true; }
    if (!info.created && siblings.length < 2) { state.toast('Ô bảng phải còn ít nhất một đoạn.', 'warning'); return true; }
    const all = paragraphs(state).filter(el => el._dwe);
    const previous = all[all.indexOf(p) - 1] || all[all.indexOf(p) + 1];
    p.remove();
    if (previous) {
      previous.focus();
      const map = textMap(previous);
      const last = map.parts[map.parts.length - 1];
      placeCaret(state, last ? last.node : previous, last ? last.node.data.length : 0);
    }
    scheduleStatus(state);
    return true;
  }
  function wire(state) {
    const doc = state.doc;
    doc.addEventListener('beforeinput', event => {
      const p = paragraphOf(state, event.target);
      if (!p) return;
      const type = event.inputType;
      if (type === 'insertParagraph') { event.preventDefault(); splitParagraph(state, p); return; }
      if (type.startsWith('format')) { event.preventDefault(); state.toast('Chế độ này chỉ sửa chữ, chưa đổi định dạng (đậm, nghiêng…).', 'warning'); return; }
      if (type === 'insertFromDrop' || type === 'insertFromYank' || type === 'insertLink' || type.startsWith('insertOrdered') || type.startsWith('insertUnordered')) { event.preventDefault(); return; }
      if (type === 'deleteContentBackward' || type === 'deleteContentForward' || type === 'deleteWordBackward' || type === 'deleteWordForward') {
        const sel = doc.getSelection();
        if (!sel.isCollapsed) return;
        const offset = caretOffset(state, p), length = domText(p).length;
        const backward = type.endsWith('Backward');
        if ((backward && offset <= 0) || (!backward && offset >= length)) {
          event.preventDefault();
          if (!length) removeEmpty(state, p);
        }
      }
    }, true);
    doc.addEventListener('paste', event => {
      const p = paragraphOf(state, event.target);
      if (!p) return;
      event.preventDefault();
      const text = (event.clipboardData?.getData('text/plain') || '').replace(/\r/g, '');
      if (!text) return;
      const lines = text.split('\n');
      lines.forEach((line, index) => {
        if (index) { const current = paragraphOf(state, doc.getSelection().anchorNode); if (current) splitParagraph(state, current); }
        if (line) doc.execCommand('insertText', false, line.replace(/\t/g, ' '));
      });
      scheduleStatus(state);
    }, true);
    doc.addEventListener('input', event => { const p = paragraphOf(state, event.target); if (p) normalizeTabs(state, p); scheduleStatus(state); });
    doc.addEventListener('keydown', event => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === 's') { event.preventDefault(); openSave(state); return; }
      if ((event.ctrlKey || event.metaKey) && key === 'f') { event.preventDefault(); toggleFind(state, true); return; }
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key === 'Tab' && !event.ctrlKey && !event.altKey && paragraphOf(state, event.target)) {
        event.preventDefault();
        doc.execCommand('insertHTML', false, `<span data-dwe-tab="">${TAB_CHAR}</span>`);
        const p = paragraphOf(state, doc.getSelection().anchorNode);
        if (p) normalizeTabs(state, p);
        scheduleStatus(state);
      }
    });
    doc.addEventListener('click', event => {
      const locked = event.target.closest?.('.dwe-locked');
      if (locked) state.toast('Đoạn này bị khóa để bảo vệ tài liệu (trường tự động, theo dõi thay đổi…).', 'warning');
    });
  }

  // ---- Tìm và thay thế ------------------------------------------------------------------------
  function findMatches(state, query, matchCase) {
    const out = [];
    if (!query) return out;
    const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'gu' : 'giu');
    for (const p of paragraphs(state)) {
      if (!p._dwe) continue;
      const text = domText(p);
      re.lastIndex = 0;
      let match;
      while ((match = re.exec(text))) {
        if (!match[0].length) { re.lastIndex++; continue; }
        if (!/[\t\n]/.test(match[0])) out.push({p, start:match.index, end:match.index + match[0].length});
      }
    }
    return out;
  }
  function rangeOf(state, match) {
    const a = locate(match.p, match.start, false), b = locate(match.p, match.end, true);
    if (!a || !b) return null;
    const range = state.doc.createRange();
    range.setStart(a.node, a.offset);
    range.setEnd(b.node, b.offset);
    return range;
  }
  function runFind(state, jump) {
    const query = state.findInput.value, matchCase = state.caseBox.checked;
    state.matches = findMatches(state, query, matchCase);
    if (state.index >= state.matches.length) state.index = 0;
    const win = state.frame.contentWindow;
    const highlights = win.CSS && win.CSS.highlights;
    if (highlights && typeof win.Highlight === 'function') {
      highlights.delete('dwe-find');
      highlights.delete('dwe-current');
      if (state.matches.length) {
        const ranges = state.matches.map(match => rangeOf(state, match)).filter(Boolean);
        if (ranges.length) highlights.set('dwe-find', new win.Highlight(...ranges));
        const now = state.matches[state.index] && rangeOf(state, state.matches[state.index]);
        if (now) highlights.set('dwe-current', new win.Highlight(now));
      }
    }
    state.count.textContent = !query ? '' : state.matches.length ? (state.index + 1) + ' / ' + state.matches.length : 'Không thấy';
    if (jump && state.matches.length) {
      const range = rangeOf(state, state.matches[state.index]);
      if (range) { range.startContainer.parentElement?.scrollIntoView({block:'center', behavior:'smooth'}); const sel = state.doc.getSelection(); sel.removeAllRanges(); sel.addRange(range); }
    }
  }
  function step(state, delta) {
    runFind(state, false);
    if (!state.matches.length) return;
    state.index = (state.index + delta + state.matches.length) % state.matches.length;
    runFind(state, true);
  }
  function replaceAt(state, match, text) {
    const range = rangeOf(state, match);
    if (!range) return false;
    match.p.focus({preventScroll:true});
    const sel = state.doc.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    state.doc.execCommand('insertText', false, text);
    return true;
  }
  function replaceOne(state) {
    runFind(state, false);
    if (!state.matches.length) return;
    replaceAt(state, state.matches[state.index], state.replaceInput.value);
    scheduleStatus(state);
    setTimeout(() => runFind(state, true), 0);
  }
  function replaceAll(state) {
    runFind(state, false);
    const total = state.matches.length;
    if (!total) return;
    // Thay từ cuối lên đầu để vị trí các kết quả phía trước không bị lệch.
    [...state.matches].reverse().forEach(match => replaceAt(state, match, state.replaceInput.value));
    state.index = 0;
    refreshStatus(state);
    runFind(state, false);
    state.toast('Đã thay ' + total + ' vị trí.', 'success');
  }
  function toggleFind(state, open) {
    state.findOpen = open ?? !state.findOpen;
    state.findBar.hidden = !state.findOpen;
    state.overlay.querySelector('[data-dwe="find"]').classList.toggle('is-on', state.findOpen);
    if (state.findOpen) { state.findInput.focus(); state.findInput.select(); runFind(state, false); }
    else { const highlights = state.frame.contentWindow.CSS?.highlights; highlights?.delete('dwe-find'); highlights?.delete('dwe-current'); }
  }

  // ---- Lưu: hỏi mỗi lần -----------------------------------------------------------------------
  async function buildBytes(state) {
    const plan = collectPlan(state);
    const xml = DocxPatch.build(state.xml, plan);
    const zip = await JSZip.loadAsync(state.bytes);
    zip.file('word/document.xml', xml);
    const bytes = await zip.generateAsync({type:'arraybuffer', compression:'DEFLATE', compressionOptions:{level:6}});
    // Kiểm tra lại trước khi trao: gói mở được, XML hợp lệ.
    const check = await JSZip.loadAsync(bytes);
    const back = await check.file('word/document.xml').async('string');
    const parsed = new DOMParser().parseFromString(back, 'application/xml');
    if (parsed.getElementsByTagName('parsererror').length) throw new Error('Tài liệu sau khi sửa không hợp lệ nên chưa ghi.');
    return {bytes, xml, plan};
  }
  const copyName = name => name.replace(/\.(docx?|)$/i, '') + ' (đã sửa).docx';
  function openSave(state) {
    if (!state.dirty() || state.saving) return;
    const canOverwrite = state.options.canOverwrite !== false;
    const box = dialog(state, `<h2>Lưu thay đổi</h2><p>Bạn muốn lưu “${esc(state.file.name)}” thế nào?</p>
      <div class="dwe-choices">
        <button type="button" class="dwe-choice" data-mode="overwrite" ${canOverwrite ? '' : 'disabled'}><span class="dwe-choice-icon">${icon('cloud')}</span><span><strong>Ghi đè bản gốc trên Drive</strong><small>${canOverwrite ? 'Thay nội dung tệp hiện tại. Google Drive vẫn giữ các phiên bản trước nên có thể khôi phục.' : (state.options.notice ? 'Không áp dụng: bạn đang sửa bản .docx chuyển từ tệp .doc.' : 'Bạn không có quyền sửa tệp này.')}</small></span></button>
        <button type="button" class="dwe-choice" data-mode="copy"><span class="dwe-choice-icon">${icon('copy')}</span><span><strong>Lưu thành bản sao</strong><small>Giữ nguyên bản gốc, tạo tệp mới cùng thư mục.</small><input type="text" class="dwe-name" value="${esc(copyName(state.file.name))}" maxlength="200" aria-label="Tên bản sao"></span></button>
        <button type="button" class="dwe-choice" data-mode="download"><span class="dwe-choice-icon">${icon('download')}</span><span><strong>Tải về máy</strong><small>Không đụng tới Google Drive.</small></span></button>
      </div>
      <p class="dwe-dialog-error" role="alert" hidden></p>
      <div class="dwe-dialog-actions"><button type="button" class="sf-button" data-cancel>Hủy</button></div>`);
    const nameInput = box.querySelector('.dwe-name');
    nameInput.addEventListener('click', event => event.stopPropagation());
    nameInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); box.querySelector('[data-mode="copy"]').click(); } });
    box.querySelector('[data-cancel]').onclick = () => box.close('cancel');
    box.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => performSave(state, box, button.dataset.mode, nameInput.value));
    box.querySelector('[data-mode]:not([disabled])').focus();
  }
  async function performSave(state, box, mode, requestedName) {
    const errorBox = box.querySelector('.dwe-dialog-error');
    const buttons = [...box.querySelectorAll('button,input')];
    const fail = message => { errorBox.textContent = message; errorBox.hidden = false; buttons.forEach(el => { el.disabled = false; }); box.querySelector('[data-mode="overwrite"]').disabled = state.options.canOverwrite === false; };
    errorBox.hidden = true;
    buttons.forEach(el => { el.disabled = true; });
    state.saving = true;
    try {
      const built = await buildBytes(state);
      const name = String(requestedName || copyName(state.file.name)).trim().replace(/[\\/]/g, '-') || copyName(state.file.name);
      const finalName = /\.docx$/i.test(name) ? name : name + '.docx';
      if (mode !== 'download' && built.bytes.byteLength > SAVE_MAX) throw new Error('Tệp sau khi sửa lớn hơn 10 MB nên không lưu lên Drive được. Hãy chọn “Tải về máy”.');
      if (mode === 'download') {
        const url = URL.createObjectURL(new Blob([built.bytes], {type:DOCX_MIME}));
        const link = document.createElement('a');
        link.href = url; link.download = finalName;
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        state.savedSignature = state.signature;
        state.savedNote = 'Đã tải về máy';
      } else {
        const result = await state.options.save({mode, name:finalName, bytes:built.bytes, expectedModifiedTime:state.file.modifiedTime});
        if (mode === 'overwrite') {
          if (result?.file) state.file = {...state.file, ...result.file};
          state.savedNote = 'Đã lưu lên Drive';
          await renderDocument(state, built.bytes);
          state.options.onSaved?.(state.file, mode);
          state.toast('Đã ghi đè “' + state.file.name + '” trên Drive.', 'success');
        } else {
          state.savedSignature = state.signature;
          const savedName = result?.file?.name || finalName;
          state.savedNote = 'Đã lưu bản sao “' + savedName + '”';
          state.options.onSaved?.(result?.file || null, mode);
          state.toast('Đã lưu bản sao “' + savedName + '”.', 'success');
        }
      }
      box.close('saved');
      refreshStatus(state);
    } catch (error) {
      if (current !== state) return;
      fail(error.message || 'Chưa lưu được. Vui lòng thử lại.');
    } finally { state.saving = false; }
  }

  // ---- Mở trình sửa ---------------------------------------------------------------------------
  function open(file, options = {}) {
    close(true);
    const overlay = document.createElement('dialog');
    overlay.className = 'sf-viewer dwe-editor';
    overlay.setAttribute('aria-label', 'Chỉnh sửa tài liệu Word: ' + file.name);
    overlay.innerHTML = `
      <header class="dwe-head">
        <span class="dwe-badge">${icon('word')}</span>
        <div class="dwe-title"><span class="sf-eyebrow">CHỈNH SỬA WORD</span><strong data-dwe-name></strong><small data-dwe-status role="status" aria-live="polite">Đang tải…</small></div>
        <div class="dwe-tools">
          <button type="button" class="sf-icon-button" data-dwe="undo" title="Hoàn tác (Ctrl+Z)" aria-label="Hoàn tác">${icon('undo')}</button>
          <button type="button" class="sf-icon-button" data-dwe="redo" title="Làm lại (Ctrl+Y)" aria-label="Làm lại">${icon('redo')}</button>
          <button type="button" class="sf-icon-button" data-dwe="find" title="Tìm và thay thế (Ctrl+F)" aria-label="Tìm và thay thế">${icon('search')}</button>
          <select class="dwe-zoom" data-dwe-zoom aria-label="Thu phóng"><option value="0.75">75%</option><option value="1" selected>100%</option><option value="1.25">125%</option><option value="1.5">150%</option></select>
        </div>
        <div class="dwe-actions">
          <button type="button" class="sf-button sf-primary" data-dwe="save" disabled title="Lưu (Ctrl+S)">${icon('save')} Lưu…</button>
          <button type="button" class="sf-icon-button" data-dwe="close" title="Đóng (Esc)" aria-label="Đóng trình chỉnh sửa">${icon('close')}</button>
        </div>
      </header>
      <div class="dwe-findbar" data-dwe-findbar hidden>
        <input type="search" data-dwe-find placeholder="Tìm…" aria-label="Tìm" autocomplete="off">
        <input type="text" data-dwe-replace placeholder="Thay bằng…" aria-label="Thay bằng" autocomplete="off">
        <label class="dwe-check"><input type="checkbox" data-dwe-case> Hoa/thường</label>
        <span class="dwe-count" data-dwe-count></span>
        <button type="button" class="sf-icon-button" data-dwe="prev" title="Kết quả trước" aria-label="Kết quả trước">${icon('up')}</button>
        <button type="button" class="sf-icon-button" data-dwe="next" title="Kết quả sau" aria-label="Kết quả sau">${icon('down')}</button>
        <button type="button" class="sf-button" data-dwe="replace">Thay</button>
        <button type="button" class="sf-button" data-dwe="replaceAll">Thay tất cả</button>
      </div>
      <p class="dwe-hint">Bấm vào chữ để sửa trực tiếp. Enter tách đoạn · Backspace ở đầu đoạn trống để xóa đoạn · Tab chèn khoảng tab. Ảnh, bảng, kiểu chữ, đầu/chân trang giữ nguyên. <span data-dwe-limits hidden></span> <strong class="dwe-notice" data-dwe-notice hidden></strong></p>
      <div class="dwe-surface"><iframe class="dwe-frame" title="Nội dung Word" sandbox="allow-same-origin"></iframe><div class="dwe-loading" data-dwe-loading><span class="drv-spinner" aria-hidden="true"></span> Đang mở tài liệu…</div></div>`;
    overlay.querySelector('[data-dwe-name]').textContent = file.name;
    if (options.notice) { const note = overlay.querySelector('[data-dwe-notice]'); note.textContent = options.notice; note.hidden = false; }
    const q = selector => overlay.querySelector(selector);
    const controller = new AbortController();
    const state = current = {
      overlay, file, options, controller, bytes:null, doc:null, xml:'', zip:null, editable:[], locked:0, readonly:0,
      frame:q('.dwe-frame'), status:q('[data-dwe-status]'), saveButton:q('[data-dwe="save"]'), undoButton:q('[data-dwe="undo"]'), redoButton:q('[data-dwe="redo"]'),
      findBar:q('[data-dwe-findbar]'), findInput:q('[data-dwe-find]'), replaceInput:q('[data-dwe-replace]'), caseBox:q('[data-dwe-case]'), count:q('[data-dwe-count]'), limits:q('[data-dwe-limits]'),
      matches:[], index:0, findOpen:false, saving:false, signature:'', savedSignature:null, savedNote:'', timer:0,
      overflow:document.body.style.overflow, previousFocus:document.activeElement,
      toast:(message, type) => options.toast?.(message, type),
      notice:message => { state.status.textContent = message; }
    };
    state.dirty = () => state.savedSignature !== null && state.signature !== state.savedSignature;
    state.beforeUnload = event => { if (state.dirty()) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', state.beforeUnload);
    document.body.appendChild(overlay);
    overlay.showModal();
    document.body.style.overflow = 'hidden';

    q('[data-dwe="close"]').onclick = () => close();
    state.saveButton.onclick = () => openSave(state);
    const undoRedo = command => () => { state.frame.contentWindow.focus(); state.doc.execCommand(command); scheduleStatus(state); };
    state.undoButton.onclick = undoRedo('undo');
    state.redoButton.onclick = undoRedo('redo');
    q('[data-dwe="find"]').onclick = () => toggleFind(state);
    q('[data-dwe="prev"]').onclick = () => step(state, -1);
    q('[data-dwe="next"]').onclick = () => step(state, 1);
    q('[data-dwe="replace"]').onclick = () => replaceOne(state);
    q('[data-dwe="replaceAll"]').onclick = () => replaceAll(state);
    state.findInput.oninput = () => { state.index = 0; runFind(state, true); };
    state.caseBox.onchange = () => { state.index = 0; runFind(state, true); };
    state.findInput.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); step(state, event.shiftKey ? -1 : 1); } else if (event.key === 'Escape') { event.stopPropagation(); toggleFind(state, false); } };
    state.replaceInput.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); replaceOne(state); } else if (event.key === 'Escape') { event.stopPropagation(); toggleFind(state, false); } };
    q('[data-dwe-zoom]').onchange = event => { if (state.doc) state.doc.body.style.zoom = event.target.value; };
    overlay.addEventListener('cancel', event => { event.preventDefault(); close(); });
    overlay.addEventListener('keydown', event => {
      event.stopPropagation();
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === 's') { event.preventDefault(); openSave(state); }
      else if ((event.ctrlKey || event.metaKey) && key === 'f') { event.preventDefault(); toggleFind(state, true); }
      else if (event.key === 'Escape' && !state.overlay.querySelector('.dwe-dialog[open]')) { event.preventDefault(); close(); }
    });

    Promise.resolve().then(() => options.load(controller.signal)).then(async bytes => {
      if (current !== state) return;
      await renderDocument(state, bytes);
      if (current !== state) return;
      q('[data-dwe-loading]').hidden = true;
    }).catch(error => {
      if (current !== state || error.name === 'AbortError') return;
      const loading = q('[data-dwe-loading]');
      loading.hidden = false;
      loading.innerHTML = `<div class="dwe-error">${icon('alert')}<strong>Chưa mở được để chỉnh sửa</strong><p>${esc(error.message || 'Đã xảy ra lỗi.')}</p><button type="button" class="sf-button" data-dwe-fail-close>Đóng</button></div>`;
      loading.querySelector('[data-dwe-fail-close]').onclick = () => close(true);
      state.status.textContent = 'Không mở được';
    });
    return state;
  }

  return {open, close, isOpen:() => !!current, domText};
})();
