const SharedFormsViewer = (() => {
  const libraries = new Map();
  let current = null;
  function loadScript(url, available) {
    if (available()) return Promise.resolve();
    if (!libraries.has(url)) libraries.set(url, new Promise((resolve,reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = resolve;
      script.onerror = () => { libraries.delete(url); script.remove(); reject(new Error('Không tải được thư viện xem file. Kiểm tra mạng rồi thử lại.')); };
      document.head.appendChild(script);
    }));
    return libraries.get(url);
  }
  function downloadUrl(file) {
    if (file.source !== 'drive') return SharedFormsStore.safeUrl(file.url);
    const id = encodeURIComponent(file.id);
    if (file.mimeType === 'application/vnd.google-apps.document') return 'https://docs.google.com/document/d/' + id + '/export?format=docx';
    if (file.mimeType === 'application/vnd.google-apps.spreadsheet') return 'https://docs.google.com/spreadsheets/d/' + id + '/export?format=xlsx';
    return 'https://drive.google.com/uc?export=download&id=' + id;
  }
  function previewUrl(file) {
    return file.source === 'drive' ? 'https://drive.google.com/file/d/' + encodeURIComponent(file.id) + '/preview' : 'https://view.officeapps.live.com/op/embed.aspx?src=' + encodeURIComponent(downloadUrl(file));
  }
  function close() {
    if (!current) return;
    const state = current;
    current = null;
    state.controller.abort();
    state.pdf?.destroy();
    SharedFormsControls.close();
    state.urls.forEach(url => URL.revokeObjectURL(url));
    state.overlay.remove();
    document.body.style.overflow = state.overflow;
    if (state.previousFocus?.isConnected) state.previousFocus.focus({preventScroll:true});
    state.onClose?.();
  }
  async function bytes(file, config, signal) {
    if (Number(file.size) > SharedFormsStore.maxBytes) throw new Error('File vượt 20 MB. Hãy tải về hoặc dùng trình xem Google Drive.');
    let response;
    if (file.source === 'drive') {
      const native = String(file.mimeType).startsWith('application/vnd.google-apps.');
      response = await SharedFormsStore.driveRequest('/' + encodeURIComponent(file.id) + (native ? '/export' : ''),native ? {mimeType:'application/pdf'} : {alt:'media'},config,signal);
    } else {
      const url = SharedFormsStore.safeUrl(file.url);
      if (!url) throw new Error('Liên kết file không hợp lệ.');
      response = await fetch(url,{signal});
      if (!response.ok) throw new Error('Không tải được nội dung file. Kiểm tra quyền đọc tài liệu trên dịch vụ lưu trữ.');
    }
    if (Number(response.headers.get('content-length')) > SharedFormsStore.maxBytes) throw new Error('File vượt giới hạn xem 20 MB.');
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > SharedFormsStore.maxBytes) { await reader.cancel(); throw new Error('File vượt giới hạn xem 20 MB.'); }
      chunks.push(chunk.value);
    }
    return new Blob(chunks).arrayBuffer();
  }
  function setReady(state, count) {
    if (current !== state || state.basic) return;
    state.status.textContent = count ? count + ' trang · Sẵn sàng in' : 'Sẵn sàng in';
    state.print.disabled = false;
  }
  function resetDocument(state) {
    const doc = state.frame.contentDocument;
    doc.open();
    doc.write('<!doctype html><html lang="vi"><head><meta charset="UTF-8"><style>html{background:#e9edf2}body{margin:0;padding:24px;color:#111827;font:14px Arial,sans-serif}body>canvas,body>img{display:block;max-width:100%;height:auto;margin:0 auto 20px;background:white;box-shadow:0 2px 12px #0002}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:white;padding:24px}table{border-collapse:collapse;background:white}td,th{border:1px solid #b8c1cc;padding:6px;white-space:pre-wrap}h2{font-size:18px}.docx-wrapper{padding:0!important;background:transparent!important}.docx-wrapper>section.docx{margin:0 auto 24px!important}@media print{html,body{background:white!important;margin:0!important;padding:0!important;zoom:1!important}body>canvas,body>img{width:100%!important;max-width:100%;box-shadow:none;margin:0;break-after:page}body>canvas:last-child,body>img:last-child{break-after:auto}.docx-wrapper>section.docx{box-shadow:none!important;margin:0!important;break-after:page}pre{padding:0}table{width:100%;font-size:10pt}thead{display:table-header-group}tr{break-inside:avoid}}@page{margin:10mm}</style></head><body></body></html>');
    doc.close();
    return doc;
  }
  async function render(state, config) {
    const file = state.file;
    const suffix = SharedFormsStore.extension(file.originalName || file.name);
    if ((file.source === 'drive' && !config?.apiKey) || suffix === 'doc' || (file.source === 'drive' && !['pdf','word','sheet','image','text'].includes(SharedFormsStore.kind(file)))) { basicViewer(state); return; }
    const data = await bytes(file,config,state.controller.signal);
    if (current !== state || state.basic) return;
    state.status.textContent = 'Đang dựng trang…';
    const doc = resetDocument(state);
    const native = String(file.mimeType).startsWith('application/vnd.google-apps.');
    if (suffix === 'pdf' || native) {
      await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',() => !!window.pdfjsLib);
      if (current !== state || state.basic) return;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      state.pdf = await pdfjsLib.getDocument({data,isEvalSupported:false}).promise;
      if (current !== state || state.basic) { state.pdf.destroy(); return; }
      if (state.pdf.numPages > 100) throw new Error('Tài liệu trên 100 trang. Vui lòng tải về để xem và in.');
      let pixels = 0;
      for (let pageNumber = 1; pageNumber <= state.pdf.numPages; pageNumber++) {
        if (current !== state || state.basic) return;
        const page = await state.pdf.getPage(pageNumber);
        const viewport = page.getViewport({scale:1.5});
        pixels += viewport.width * viewport.height;
        if (pixels > 90000000) throw new Error('Tài liệu quá lớn để dựng toàn bộ. Vui lòng tải về để in.');
        const canvas = doc.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.setAttribute('aria-label','Trang ' + pageNumber);
        doc.body.appendChild(canvas);
        await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
        state.status.textContent = 'Đang dựng trang ' + pageNumber + '/' + state.pdf.numPages;
      }
      setReady(state,state.pdf.numPages);
    } else if (suffix === 'docx') {
      await loadScript('https://cdn.jsdelivr.net/npm/docx-preview@0.4.1/dist/docx-preview.min.js',() => !!window.docx);
      if (current !== state || state.basic) return;
      await window.docx.renderAsync(data,doc.body,doc.head,{inWrapper:true,breakPages:true,useBase64URL:true,renderAltChunks:false,ignoreLastRenderedPageBreak:false});
      setReady(state,doc.querySelectorAll('section.docx').length);
    } else if (['xlsx','xls','csv'].includes(suffix)) {
      if (!window.XLSX) throw new Error('Chưa tải được thư viện Excel. Vui lòng tải lại trang.');
      const book = XLSX.read(data,{type:'array',cellHTML:false,sheetRows:5000});
      const select = state.overlay.querySelector('[data-sf-sheet]');
      select.hidden = false;
      book.SheetNames.forEach(name => { const option = document.createElement('option'); option.textContent = name; option.value = name; select.appendChild(option); });
      const showSheet = () => {
        const sheetDoc = resetDocument(state);
        const heading = sheetDoc.createElement('h2');
        heading.textContent = select.value;
        sheetDoc.body.appendChild(heading);
        const table = sheetDoc.createElement('table');
        const rows = XLSX.utils.sheet_to_json(book.Sheets[select.value],{header:1,defval:'',raw:false});
        rows.forEach(row => { const rowNode = sheetDoc.createElement('tr'); row.slice(0,100).forEach(value => { const cell = sheetDoc.createElement('td'); cell.textContent = String(value); rowNode.appendChild(cell); }); table.appendChild(rowNode); });
        sheetDoc.body.appendChild(table);
        setReady(state);
        state.status.textContent = 'In trang tính đang chọn · Tối đa 5.000 dòng, 100 cột';
      };
      select.onchange = showSheet;
      showSheet();
      SharedFormsControls.enhance(state.overlay);
    } else if (SharedFormsStore.kind(file) === 'image') {
      const url = URL.createObjectURL(new Blob([data],{type:file.mimeType || SharedFormsStore.types[suffix]}));
      state.urls.push(url);
      const picture = doc.createElement('img');
      picture.src = url;
      picture.alt = file.name;
      doc.body.appendChild(picture);
      await picture.decode();
      setReady(state,1);
    } else if (suffix === 'txt') {
      const text = doc.createElement('pre');
      text.textContent = new TextDecoder().decode(data);
      doc.body.appendChild(text);
      setReady(state);
    } else if (file.source === 'drive') basicViewer(state);
    else throw new Error('Định dạng này chưa hỗ trợ xem trực tiếp. Vui lòng tải file về.');
  }
  function basicViewer(state) {
    state.basic = true;
    state.print.disabled = true;
    state.pdf?.destroy();
    state.frame.removeAttribute('srcdoc');
    state.frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-modals allow-downloads');
    state.frame.src = previewUrl(state.file);
    state.status.textContent = 'Tài liệu đang được xem ngay trong trang. Nếu trình xem không có nút In, tải bản gốc để in bằng Word hoặc Excel.';
    state.overlay.querySelector('[data-sf-zoom]').disabled = true;
    state.print.hidden = true;
    state.overlay.querySelector('[data-sf-inner-expand]').hidden = false;
    SharedFormsControls.enhance(state.overlay);
  }
  async function download(file) {
    const url = downloadUrl(file);
    if (!url) { triggerToast('Liên kết tải file không hợp lệ.','error'); return; }
    if (file.source === 'drive') {
      let frame = document.getElementById('sfFileDownload');
      if (!frame) { frame = document.createElement('iframe'); frame.id = 'sfFileDownload'; frame.title = 'Tải biểu mẫu'; frame.hidden = true; frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-downloads'); document.body.appendChild(frame); }
      frame.src = url;
      return;
    }
    try {
      const response = await fetch(url,{signal:AbortSignal.timeout(30000)});
      if (!response.ok) throw new Error('Không tải được file.');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = objectUrl; link.download = file.originalName || file.name;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl),60000);
    } catch { triggerToast('Chưa tải được biểu mẫu. Vui lòng kiểm tra kết nối và thử lại.','error'); }
  }
  function open(file, config, options = {}) {
    close();
    const overlay = document.createElement('dialog');
    overlay.className = 'sf-viewer';
    overlay.setAttribute('aria-label','Xem biểu mẫu: ' + file.name);
    const icon = name => SharedFormsControls.icon(name);
    overlay.innerHTML = `
      <header class="sf-viewer-heading"><div><span class="sf-eyebrow">ĐANG XEM TÀI LIỆU</span><strong data-sf-title></strong></div><button class="sf-icon-button" data-sf-close type="button" aria-label="Đóng trình xem" title="Đóng trình xem">${icon('close')}</button></header>
      <div class="sf-viewer-bar">
        <select data-sf-sheet data-sf-select data-sf-label="Chọn trang tính" data-sf-description="Xem và in trang tính đang chọn" data-sf-icon="grid" aria-label="Chọn trang tính" hidden></select>
        <select data-sf-zoom data-sf-select data-sf-label="Thu phóng" data-sf-description="Điều chỉnh kích thước trang tài liệu" data-sf-icon="zoom" aria-label="Thu phóng"><option value="0.75">75%</option><option value="1" selected>100%</option><option value="1.25">125%</option><option value="1.5">150%</option></select>
        <button class="sf-button sf-primary" data-sf-print type="button" disabled>${icon('print')} In tài liệu</button>
        <button class="sf-button" data-sf-download type="button">${icon('download')} Tải về</button>
        <button class="sf-icon-button" data-sf-expand type="button" aria-label="Mở rộng vùng xem" aria-pressed="false" title="Mở rộng vùng xem">${icon('expand')}</button>
        <button class="sf-button" data-sf-drive-preview type="button" hidden>Xem bằng Drive</button>
      </div>
      <p class="sf-viewer-status" role="status" aria-live="polite"></p>
      <div class="sf-document-surface"><iframe class="sf-viewer-frame" title="Nội dung biểu mẫu" sandbox="allow-same-origin allow-modals"></iframe><button class="sf-icon-button sf-provider-expand" type="button" data-sf-inner-expand aria-label="Mở rộng tài liệu trong trang" title="Mở rộng trong trang" hidden>${icon('expand')}</button></div>`;
    overlay.querySelector('[data-sf-title]').textContent = file.name;
    overlay.querySelector('[data-sf-download]').onclick = () => download(file);
    const state = {overlay,file,frame:overlay.querySelector('iframe'),status:overlay.querySelector('[role="status"]'),print:overlay.querySelector('[data-sf-print]'),controller:new AbortController(),urls:[],overflow:document.body.style.overflow,previousFocus:document.activeElement,onClose:options.onClose,expanded:false};
    current = state;
    document.body.appendChild(overlay);
    overlay.showModal();
    document.body.style.overflow = 'hidden';
    overlay.querySelector('[data-sf-expand]').onclick = () => {
      SharedFormsControls.close();
      state.expanded = !state.expanded;
      overlay.classList.toggle('is-expanded',state.expanded);
      overlay.querySelector('[data-sf-expand]').setAttribute('aria-pressed',String(state.expanded));
      overlay.querySelector('[data-sf-expand]').setAttribute('aria-label',state.expanded ? 'Thu gọn vùng xem' : 'Mở rộng vùng xem');
      overlay.querySelector('[data-sf-expand]').title = state.expanded ? 'Thu gọn vùng xem' : 'Mở rộng vùng xem';
    };
    overlay.querySelector('[data-sf-inner-expand]').onclick = () => overlay.querySelector('[data-sf-expand]').click();
    state.status.textContent = 'Đang tải tài liệu…';
    overlay.querySelector('[data-sf-close]').onclick = close;
    overlay.querySelector('[data-sf-close]').focus();
    overlay.querySelector('[data-sf-zoom]').onchange = event => { state.frame.contentDocument.body.style.zoom = event.target.value; };
    state.print.onclick = async () => {
      try {
        await state.frame.contentDocument.fonts.ready;
        if (current !== state) return;
        state.frame.contentWindow.focus();
        state.frame.contentWindow.print();
      } catch { state.status.textContent = 'Trình duyệt chưa mở được hộp thoại in. Hãy tải file về để in.'; }
    };
    const fallback = overlay.querySelector('[data-sf-drive-preview]');
    if (file.source === 'drive' && config?.apiKey) { fallback.hidden = false; fallback.onclick = () => { state.controller.abort(); state.print.disabled = true; basicViewer(state); }; }
    overlay.addEventListener('cancel',event => { event.preventDefault(); close(); });
    overlay.addEventListener('close',() => { if (current === state) close(); });
    SharedFormsControls.enhance(overlay);
    render(state,config).catch(error => { if (current === state && !state.basic && error.name !== 'AbortError') { state.print.disabled = true; state.status.textContent = error.message + ' Bạn có thể tải về để xem và in.'; } });
  }
  return {open,close,download,downloadUrl};
})();
