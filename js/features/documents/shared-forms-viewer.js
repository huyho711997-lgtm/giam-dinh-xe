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
    state.status.textContent = (count ? count + ' trang · ' : '') + (state.wordPdf ? 'Bản in xuất từ Microsoft Word · Sẵn sàng in' : 'Sẵn sàng in');
    state.print.disabled = false;
  }
  function printShortcut(state, event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      if (!state.print.disabled && !state.print.hidden) state.print.click();
    }
  }
  function resetDocument(state) {
    const doc = state.frame.contentDocument;
    doc.open();
    doc.write('<!doctype html><html lang="vi"><head><meta charset="UTF-8"><style>html{background:#e9edf2}body{margin:0;padding:24px;color:#111827;font:14px Arial,sans-serif}.sf-pdf-page,body>img{display:block;max-width:100%;height:auto;margin:0 auto 24px;background:white;box-shadow:0 2px 12px #0002}.sf-pdf-page :is(canvas,img){display:block;width:100%;height:auto}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:white;padding:24px}body.sf-sheet table{border-collapse:collapse;background:white}body.sf-sheet :is(td,th){border:1px solid #b8c1cc;padding:6px;white-space:pre-wrap}h2{font-size:18px}.docx-wrapper{padding:0!important;background:transparent!important}.docx-wrapper>section.docx{margin:0 auto 24px!important}@page{margin:10mm}@media print{html,body{background:white!important;margin:0!important;padding:0!important;zoom:1!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}.sf-pdf-page{max-width:none;height:var(--sf-page-height);box-shadow:none;margin:0;break-inside:avoid;break-after:page}.sf-pdf-page :is(canvas,img){height:100%}.sf-pdf-page:last-child{break-after:auto}body>img{width:100%;max-width:100%;box-shadow:none;margin:0;break-after:page}body>img:last-child{break-after:auto}.docx-wrapper>section.docx{box-shadow:none!important;margin:0!important;break-after:page}.docx-wrapper>section.docx:last-child{break-after:auto}pre{padding:0}body.sf-sheet table{width:100%;font-size:10pt}body.sf-sheet thead{display:table-header-group}body.sf-sheet tr{break-inside:avoid}}</style></head><body></body></html>');
    doc.close();
    doc.addEventListener('keydown',event => printShortcut(state,event));
    return doc;
  }
  async function render(state, config) {
    const file = state.file;
    const originalBytes = state.readOriginal;
    const printFile = state.loadBytes ? null : await SharedFormsPrint.resolve(file,config,state.controller.signal,originalBytes);
    if (current !== state) return;
    state.wordPdf = !!printFile;
    const suffix = printFile ? 'pdf' : SharedFormsStore.extension(file.originalName || file.name);
    if (!printFile && ((file.source === 'drive' && !config?.apiKey && !state.loadBytes) || suffix === 'doc' || (file.source === 'drive' && !['pdf','word','sheet','image','text'].includes(SharedFormsStore.kind(file))))) { basicViewer(state); return; }
    const data = printFile ? await bytes(printFile,config,state.controller.signal) : await originalBytes();
    if (current !== state || state.basic) return;
    state.status.textContent = 'Đang dựng trang…';
    const doc = resetDocument(state);
    const native = String(file.mimeType).startsWith('application/vnd.google-apps.');
    if (suffix === 'pdf' || native) {
      await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',() => !!window.pdfjsLib);
      if (current !== state || state.basic) return;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      // The PDF worker transfers its input buffer; preserve the original for downloading.
      state.pdf = await pdfjsLib.getDocument({data:data.slice(0),isEvalSupported:false,ownerDocument:doc}).promise;
      if (current !== state || state.basic) { state.pdf.destroy(); return; }
      if (state.pdf.numPages > 100) throw new Error('Tài liệu trên 100 trang. Vui lòng tải về để xem và in.');
      let pixels = 0;
      for (let pageNumber = 1; pageNumber <= state.pdf.numPages; pageNumber++) {
        if (current !== state || state.basic) return;
        const page = await state.pdf.getPage(pageNumber);
        const size = page.getViewport({scale:1});
        const viewport = page.getViewport({scale:2});
        pixels += viewport.width * viewport.height;
        if (pixels > 90000000) throw new Error('Tài liệu quá lớn để dựng toàn bộ. Vui lòng tải về để in.');
        const sheet = doc.createElement('div');
        sheet.className = 'sf-pdf-page';
        sheet.style.width = size.width + 'pt';
        sheet.style.setProperty('--sf-page-height',size.height + 'pt');
        sheet.style.page = 'sfPage' + pageNumber;
        const pageStyle = doc.createElement('style');
        pageStyle.textContent = SharedFormsPrint.pageRule(pageNumber,size.width,size.height);
        doc.head.appendChild(pageStyle);
        const canvas = doc.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.setAttribute('aria-label','Trang ' + pageNumber);
        sheet.appendChild(canvas);
        doc.body.appendChild(sheet);
        await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
        const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/png'));
        if (current !== state || state.basic) return;
        if (!blob) throw new Error('Không dựng được hình ảnh trang in.');
        const url = URL.createObjectURL(blob);
        state.urls.push(url);
        const picture = doc.createElement('img');
        picture.src = url;
        picture.alt = 'Trang ' + pageNumber;
        canvas.replaceWith(picture);
        await picture.decode();
        canvas.width = 0;
        canvas.height = 0;
        state.status.textContent = 'Đang dựng trang ' + pageNumber + '/' + state.pdf.numPages;
      }
      setReady(state,state.pdf.numPages);
    } else if (suffix === 'docx') {
      await loadScript('https://cdn.jsdelivr.net/npm/docx-preview@0.4.1/dist/docx-preview.min.js',() => !!window.docx);
      if (current !== state || state.basic) return;
      await window.docx.renderAsync(data,doc.body,doc.head,{inWrapper:true,breakPages:true,useBase64URL:true,renderAltChunks:false,ignoreLastRenderedPageBreak:false,hideWrapperOnPrint:true});
      SharedFormsPrint.wordPages(doc);
      await SharedFormsPrint.ready(doc);
      setReady(state,doc.querySelectorAll('section.docx').length);
    } else if (['xlsx','xls','csv'].includes(suffix)) {
      if (!window.XLSX) throw new Error('Chưa tải được thư viện Excel. Vui lòng tải lại trang.');
      const book = XLSX.read(data,{type:'array',cellHTML:false,sheetRows:5000});
      const select = state.overlay.querySelector('[data-sf-sheet]');
      select.hidden = false;
      book.SheetNames.forEach(name => { const option = document.createElement('option'); option.textContent = name; option.value = name; select.appendChild(option); });
      const showSheet = () => {
        const sheetDoc = resetDocument(state);
        sheetDoc.body.className = 'sf-sheet';
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
    state.overlay.querySelector('[data-sf-provider-mask]').hidden = false;
    SharedFormsControls.enhance(state.overlay);
  }
  async function download(file, options = {}) {
    if (options.loadBytes) {
      try {
        const data = await options.loadBytes();
        const objectUrl = URL.createObjectURL(new Blob([data],{type:file.mimeType}));
        const link = document.createElement('a'); link.href = objectUrl; link.download = file.originalName || file.name;
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl),60000);
      } catch (error) { if (error.name !== 'AbortError') triggerToast(error.message || 'Không tải được tài liệu.','error'); }
      return;
    }
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
    overlay.setAttribute('aria-label','Xem tài liệu: ' + file.name);
    const icon = name => SharedFormsControls.icon(name);
    overlay.innerHTML = `
      <header class="sf-viewer-heading"><div><span class="sf-eyebrow">ĐANG XEM TÀI LIỆU</span><strong data-sf-title></strong></div><button class="sf-icon-button" data-sf-close type="button" aria-label="Đóng trình xem" title="Đóng trình xem">${icon('close')}</button></header>
      <div class="sf-viewer-bar">
        <select data-sf-sheet data-sf-select data-sf-label="Chọn trang tính" data-sf-description="Xem và in trang tính đang chọn" data-sf-icon="grid" aria-label="Chọn trang tính" hidden></select>
        <select data-sf-zoom data-sf-select data-sf-label="Thu phóng" data-sf-description="Điều chỉnh kích thước trang tài liệu" data-sf-icon="zoom" aria-label="Thu phóng"><option value="0.75">75%</option><option value="1" selected>100%</option><option value="1.25">125%</option><option value="1.5">150%</option></select>
        <button class="sf-button sf-primary" data-sf-print type="button" title="In tài liệu (Ctrl+P)" disabled>${icon('print')} In tài liệu</button>
        <button class="sf-button" data-sf-download type="button">${icon('download')} Tải về</button>
        <button class="sf-button" data-sf-drive-preview type="button" hidden>Xem bằng Drive</button>
      </div>
      <p class="sf-viewer-status" role="status" aria-live="polite"></p>
      <div class="sf-document-surface"><iframe class="sf-viewer-frame" title="Nội dung biểu mẫu" sandbox="allow-same-origin allow-modals"></iframe><span class="sf-provider-mask" data-sf-provider-mask aria-hidden="true" hidden></span></div>`;
    overlay.querySelector('[data-sf-title]').textContent = file.name;
    const state = {overlay,file,frame:overlay.querySelector('iframe'),status:overlay.querySelector('[role="status"]'),print:overlay.querySelector('[data-sf-print]'),controller:new AbortController(),urls:[],overflow:document.body.style.overflow,previousFocus:document.activeElement,onClose:options.onClose,loadBytes:options.loadBytes};
    state.readOriginal = () => {
      if (!state.original) state.original = Promise.resolve().then(() => state.loadBytes ? state.loadBytes(state.controller.signal) : bytes(file,config,state.controller.signal)).then(data => {
        if (data.byteLength > SharedFormsStore.maxBytes) throw new Error('File vượt giới hạn xem 20 MB.');
        return data;
      }).catch(error => { state.original = null; throw error; });
      return state.original;
    };
    overlay.querySelector('[data-sf-download]').onclick = () => download(file,state.loadBytes ? {loadBytes:state.readOriginal} : {});
    current = state;
    document.body.appendChild(overlay);
    overlay.showModal();
    document.body.style.overflow = 'hidden';
    state.status.textContent = 'Đang tải tài liệu…';
    overlay.querySelector('[data-sf-close]').onclick = close;
    overlay.querySelector('[data-sf-close]').focus();
    overlay.querySelector('[data-sf-zoom]').onchange = event => { state.frame.contentDocument.body.style.zoom = event.target.value; };
    state.print.onclick = async () => {
      try {
        await SharedFormsPrint.print(state.frame,file.name,() => current === state);
      } catch { state.status.textContent = 'Trình duyệt chưa mở được hộp thoại in. Hãy tải file về để in.'; }
    };
    const fallback = overlay.querySelector('[data-sf-drive-preview]');
    if (file.source === 'drive' && config?.apiKey) { fallback.hidden = false; fallback.onclick = () => { state.controller.abort(); state.print.disabled = true; basicViewer(state); }; }
    overlay.addEventListener('cancel',event => { event.preventDefault(); close(); });
    overlay.addEventListener('close',() => { if (current === state) close(); });
    overlay.addEventListener('keydown',event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      else printShortcut(state,event);
    });
    SharedFormsControls.enhance(overlay);
    render(state,config).catch(error => { if (current === state && !state.basic && error.name !== 'AbortError') { state.print.disabled = true; state.status.textContent = error.message + ' Bạn có thể tải về để xem và in.'; } });
  }
  return {open,close,download,downloadUrl,bytes};
})();
