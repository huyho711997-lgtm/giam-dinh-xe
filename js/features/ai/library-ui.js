// Giao diện Thư viện tài liệu: danh sách (mọi người xem), nạp/xoá/đổi trạng thái (chỉ quản trị viên), xem đoạn được trích dẫn.
const TascoLibrary = (() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
  const STATUS = {dang_hieu_luc: 'Đang hiệu lực', het_hieu_luc: 'Hết hiệu lực', da_thay_the: 'Đã thay thế'};
  const isAdmin = () => { const p = typeof activeUserProfile !== 'undefined' ? activeUserProfile : null; return !!p && (String(p.role || '').trim().toLowerCase() === 'admin' || p.isAdmin === true || p.permissions?.users?.admin === true); };
  const toast = (message, type) => { if (typeof triggerToast === 'function') triggerToast(message, type === 'error' ? 'warning' : type); };
  let overlay = null, draft = null;

  function shell(title, kicker, small) {
    close();
    overlay = document.createElement('div');
    overlay.className = 'dlib-overlay';
    overlay.innerHTML = '<div class="dlib-panel' + (small ? ' dlib-panel--small' : '') + '" role="dialog" aria-modal="true"><div class="dlib-head"><div><small>' + esc(kicker) + '</small><h3>' + esc(title) + '</h3></div><button type="button" class="dlib-x" data-dl="close" aria-label="Đóng">×</button></div><div class="dlib-body"></div><div class="dlib-foot"></div></div>';
    overlay.addEventListener('mousedown', event => { if (event.target === overlay) close(); });
    overlay.addEventListener('click', event => { if (event.target.closest('[data-dl="close"]')) close(); });
    document.body.appendChild(overlay);
    return {body: overlay.querySelector('.dlib-body'), foot: overlay.querySelector('.dlib-foot')};
  }
  function close() { overlay?.remove(); overlay = null; }
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && overlay) close(); });

  // ---- Danh sách ----
  async function open() {
    const {body, foot} = shell('Thư viện tài liệu nghiệp vụ', 'Trợ lý AI tra cứu từ đây');
    body.innerHTML = '<p class="dlib-note">Đang tải…</p>';
    foot.innerHTML = (isAdmin() ? '<button type="button" class="dlib-btn dlib-btn--primary" data-dl="add">+ Nạp tài liệu</button>' : '') + '<button type="button" class="dlib-btn" data-dl="close">Đóng</button>';
    foot.querySelector('[data-dl="add"]')?.addEventListener('click', openUpload);
    try { renderList(body, await TascoLibStore.list(true)); } catch (error) { body.innerHTML = '<p class="dlib-note dlib-note--bad">' + esc(error.message || 'Không tải được thư viện.') + '</p>'; }
  }
  function renderList(body, docs) {
    if (!docs.length) { body.innerHTML = '<p class="dlib-note">Thư viện đang trống.' + (isAdmin() ? ' Bấm "Nạp tài liệu" để thêm quy trình, điều khoản, bảng giá…' : ' Liên hệ quản trị viên để nạp tài liệu.') + '</p>'; return; }
    const admin = isAdmin();
    body.innerHTML = '<p class="dlib-note dlib-note--ok">' + docs.length + ' tài liệu · ' + docs.reduce((sum, doc) => sum + doc.chunks.length, 0) + ' đoạn tra cứu. Chat AI chỉ tra các tài liệu đang hiệu lực.</p><div class="dlib-list">' + docs.map(doc => {
      const m = doc.meta, link = TascoLibStore.safeUrl(m.nguon);
      return '<div class="dlib-doc" data-id="' + esc(doc.id) + '"><div><strong>' + esc(m.ten) + '</strong><small>' + [m.soHieu, m.hieuLucTu ? 'hiệu lực từ ' + m.hieuLucTu.split('-').reverse().join('/') : '', doc.chunks.length + ' đoạn'].filter(Boolean).map(esc).join(' · ') + (link ? ' · <a class="dlib-link" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">bản gốc</a>' : '') + '</small></div>'
        + (admin ? '<select data-dl-status aria-label="Trạng thái">' + Object.keys(STATUS).map(key => '<option value="' + key + '"' + (m.trangThai === key ? ' selected' : '') + '>' + STATUS[key] + '</option>').join('') + '</select><button type="button" class="dlib-btn dlib-btn--danger" data-dl-del>Xoá</button>'
          : '<span class="dlib-badge' + (m.trangThai === 'dang_hieu_luc' ? '' : ' dlib-badge--off') + '">' + STATUS[m.trangThai] + '</span>') + '</div>';
    }).join('') + '</div>';
    body.querySelectorAll('.dlib-doc').forEach(row => {
      const id = row.dataset.id;
      row.querySelector('[data-dl-status]')?.addEventListener('change', async event => { try { await TascoLibStore.setStatus(id, event.target.value); toast('Đã cập nhật trạng thái', 'success'); } catch (error) { toast(error.message || 'Không cập nhật được (cần quyền quản trị).', 'error'); } });
      row.querySelector('[data-dl-del]')?.addEventListener('click', async () => {
        if (!confirm('Xoá tài liệu "' + row.querySelector('strong').textContent + '" khỏi thư viện?')) return;
        try { await TascoLibStore.remove(id); toast('Đã xoá tài liệu', 'success'); open(); } catch (error) { toast(error.message || 'Không xoá được (cần quyền quản trị).', 'error'); }
      });
    });
  }

  // ---- Nạp tài liệu (quản trị viên) ----
  function openUpload() {
    if (!isAdmin()) { toast('Chỉ quản trị viên được nạp tài liệu.', 'error'); return; }
    draft = null;
    const {body, foot} = shell('Nạp tài liệu', 'Thư viện tài liệu');
    body.innerHTML = '<label class="dlib-drop" data-dl-drop><strong>Chọn hoặc kéo thả file vào đây</strong><span>.md · .txt · .docx · .pdf · .xlsx · .csv · ảnh scan (.png .jpg)</span><input type="file" data-dl-file accept=".md,.markdown,.txt,.docx,.pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp" hidden></label>'
      + '<p style="margin:0;text-align:center;color:var(--dl-muted);font-size:12px">hoặc dán văn bản trực tiếp</p><textarea class="dlib-paste" data-dl-paste placeholder="Dán nội dung (có thể mở đầu bằng khối --- ten: … so_hieu: … ---)"></textarea><div data-dl-msg></div>';
    foot.innerHTML = '<button type="button" class="dlib-btn" data-dl-back>← Danh sách</button><button type="button" class="dlib-btn dlib-btn--primary" data-dl-readpaste>Đọc văn bản dán</button>';
    const msg = body.querySelector('[data-dl-msg]');
    const run = async task => {
      msg.innerHTML = '<p class="dlib-note">Đang đọc và cắt đoạn…</p>';
      try { const result = await task(); if (!result.chunks.length) throw new Error('Không tìm thấy nội dung trong file.'); draft = result; renderPreview(); } catch (error) { msg.innerHTML = '<p class="dlib-note dlib-note--bad">' + esc(error.message || 'Không đọc được file.') + '</p>'; }
    };
    const fromFile = file => file && run(async () => TascoLibParse.fromFile(file, {apiKey: await GeminiKeyStore.get().catch(() => ''), model: (() => { try { return localStorage.getItem('gemini_model_name') || 'gemini-2.5-flash'; } catch (_) { return 'gemini-2.5-flash'; } })()}));
    const drop = body.querySelector('[data-dl-drop]'), input = body.querySelector('[data-dl-file]');
    input.addEventListener('change', () => fromFile(input.files[0]));
    ['dragenter', 'dragover'].forEach(name => drop.addEventListener(name, event => { event.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach(name => drop.addEventListener(name, event => { event.preventDefault(); drop.classList.remove('is-over'); }));
    drop.addEventListener('drop', event => fromFile(event.dataTransfer.files[0]));
    foot.querySelector('[data-dl-back]').addEventListener('click', open);
    foot.querySelector('[data-dl-readpaste]').addEventListener('click', () => { const text = body.querySelector('[data-dl-paste]').value; if (text.trim()) run(async () => TascoLibParse.fromText(text, 'Văn bản dán')); });
  }

  // Xem trước các đoạn đã cắt: sửa thông tin, bỏ đoạn không cần, sửa chữ trước khi lưu.
  function renderPreview() {
    const {body, foot} = shell('Xem trước tài liệu', 'Kiểm tra trước khi lưu');
    const m = draft.meta;
    body.innerHTML = (draft.note ? '<p class="dlib-note">' + esc(draft.note) + ' Hãy đọc lại, chữ nhận dạng có thể sai.</p>' : '')
      + (draft.truncated ? '<p class="dlib-note dlib-note--bad">Tài liệu quá dài, chỉ giữ ' + draft.chunks.length + ' đoạn đầu. Hãy tách thành nhiều tài liệu.</p>' : '')
      + '<div class="dlib-grid"><label class="wide">Tên tài liệu<input autocomplete="off" data-f="ten" value="' + esc(m.ten) + '" maxlength="160"></label><label>Số hiệu<input autocomplete="off" data-f="soHieu" value="' + esc(m.soHieu || '') + '" maxlength="80"></label><label>Hiệu lực từ<input type="date" data-f="hieuLucTu" value="' + esc(m.hieuLucTu || '') + '"></label>'
      + '<label>Trạng thái<select data-f="trangThai">' + Object.keys(STATUS).map(key => '<option value="' + key + '"' + (m.trangThai === key ? ' selected' : '') + '>' + STATUS[key] + '</option>').join('') + '</select></label><label>Thay thế tài liệu số<input autocomplete="off" data-f="thayThe" value="' + esc(m.thayThe || '') + '" maxlength="80"></label>'
      + '<label class="wide">Đường dẫn bản gốc (Drive/SharePoint, tuỳ chọn)<input autocomplete="off" data-f="nguon" value="' + esc(m.nguon || '') + '" placeholder="https://…"></label></div>'
      + '<div data-dl-err></div><p class="dlib-note dlib-note--ok">' + draft.chunks.length + ' đoạn tra cứu. Mở từng đoạn để sửa; bỏ tích những đoạn không cần (mục lục, trang bìa).</p><div class="dlib-chunks">'
      + draft.chunks.map((chunk, index) => '<details class="dlib-chunk"><summary><input type="checkbox" data-keep="' + index + '" checked><span>' + esc(chunk.t) + '</span><small>' + chunk.x.length + ' ký tự</small></summary><textarea data-text="' + index + '">' + esc(chunk.x) + '</textarea></details>').join('') + '</div>';
    foot.innerHTML = '<button type="button" class="dlib-btn" data-dl-back>← Chọn lại</button><button type="button" class="dlib-btn dlib-btn--primary" data-dl-save>Lưu vào thư viện</button>';
    foot.querySelector('[data-dl-back]').addEventListener('click', openUpload);
    body.querySelectorAll('summary input').forEach(box => box.addEventListener('click', event => event.stopPropagation()));
    foot.querySelector('[data-dl-save]').addEventListener('click', async event => {
      const button = event.currentTarget;
      const meta = {...m};
      body.querySelectorAll('[data-f]').forEach(field => { meta[field.dataset.f] = field.value.trim(); });
      // Lỗi hiện ngay trong hộp thoại (thông báo nổi có thể bị che bởi hộp thoại này).
      const fail = text => { const box = body.querySelector('[data-dl-err]'); box.innerHTML = '<p class="dlib-note dlib-note--bad">' + esc(text) + '</p>'; box.scrollIntoView({block: 'nearest'}); };
      body.querySelector('[data-dl-err]').innerHTML = '';
      if (meta.nguon && !TascoLibStore.safeUrl(meta.nguon)) { fail('Đường dẫn bản gốc phải là liên kết bắt đầu bằng http:// hoặc https:// (ví dụ link Google Drive). Để trống nếu không có.'); body.querySelector('[data-f="nguon"]').focus(); return; }
      const chunks = draft.chunks.map((chunk, index) => ({t: chunk.t, x: body.querySelector('[data-text="' + index + '"]').value})).filter((chunk, index) => body.querySelector('[data-keep="' + index + '"]').checked && chunk.x.trim());
      if (!chunks.length) { fail('Chưa chọn đoạn nào để lưu.'); return; }
      button.disabled = true; button.textContent = 'Đang lưu…';
      try { await TascoLibStore.save({meta, chunks}); toast('Đã lưu tài liệu vào thư viện', 'success'); draft = null; open(); } catch (error) { button.disabled = false; button.textContent = 'Lưu vào thư viện'; fail('Không lưu được: ' + (error?.message || 'lỗi không rõ') + (/permission|PERMISSION/.test(String(error?.code || error?.message)) ? ' — tài khoản chưa có quyền ghi thư viện (cần quản trị viên, hoặc rules Firebase chưa cập nhật).' : '')); }
    });
  }

  // ---- Xem đoạn gốc khi bấm trích dẫn ----
  async function showCitation(code) {
    const [docId, index] = String(code).split(':');
    const {body, foot} = shell('Đoạn được trích dẫn', 'Nguồn tài liệu', true);
    foot.innerHTML = '<button type="button" class="dlib-btn" data-dl="close">Đóng</button>';
    try {
      const doc = await TascoLibStore.find(docId), chunk = doc?.chunks[Number(index)];
      if (!chunk) { body.innerHTML = '<p class="dlib-note dlib-note--bad">Đoạn này không còn trong thư viện (tài liệu đã bị xoá hoặc cập nhật).</p>'; return; }
      const m = doc.meta, link = TascoLibStore.safeUrl(m.nguon);
      body.innerHTML = '<div><strong>' + esc(m.ten) + '</strong><div class="dlib-meta">' + [m.soHieu, chunk.t, STATUS[m.trangThai], m.hieuLucTu ? 'từ ' + m.hieuLucTu.split('-').reverse().join('/') : ''].filter(Boolean).map(esc).map(text => '<span>' + text + '</span>').join('') + '</div></div><blockquote class="dlib-quote">' + esc(chunk.x) + '</blockquote>'
        + (link ? '<a class="dlib-link" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">Mở bản gốc</a>' : '') + '<p class="dlib-note">AI có thể diễn giải chưa chính xác. Hãy đối chiếu đoạn này (và bản gốc) trước khi áp dụng.</p>';
    } catch (error) { body.innerHTML = '<p class="dlib-note dlib-note--bad">' + esc(error.message || 'Không mở được đoạn trích.') + '</p>'; }
  }

  document.addEventListener('click', event => { const cite = event.target.closest?.('[data-lib-cite]'); if (cite) showCitation(cite.dataset.libCite); });
  return {open, openUpload, showCitation, close};
})();
