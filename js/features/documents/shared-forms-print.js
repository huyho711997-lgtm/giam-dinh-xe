const SharedFormsPrint = (() => {
  async function resolve(file, config, signal, originalBytes) {
    if (!['drive','builtin'].includes(file.source)) return null;
    try {
      const response = await fetch('js/data/shared-forms-print.json',{signal,cache:'no-cache'});
      if (!response.ok) return null;
      const manifest = await response.json();
      const entry = manifest.files?.[file.id];
      if (manifest.version !== 1 || !entry || !/^[a-f0-9]{64}$/.test(entry.sourceSha256) || entry.source !== file.source || entry.url !== 'assets/shared-form-previews/' + file.id + '.pdf') return null;
      if (file.source === 'drive' && !config?.apiKey) {
        const modified = Date.parse(file.modifiedTime);
        if (config?.folderId !== manifest.rootFolderId || file.catalogAt !== manifest.catalogAt || !Number.isFinite(modified) || modified !== Date.parse(entry.sourceModifiedTime)) return null;
      } else {
        if (file.source === 'builtin' && file.url !== entry.sourceUrl) return null;
        const digest = await crypto.subtle.digest('SHA-256',await originalBytes());
        const hash = Array.from(new Uint8Array(digest),value => value.toString(16).padStart(2,'0')).join('');
        if (hash !== entry.sourceSha256) return null;
      }
      return {...file,source:'print',url:entry.url + '?v=' + entry.sourceSha256,size:entry.size,mimeType:'application/pdf',originalName:file.id + '.pdf'};
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      return null;
    }
  }
  function pageRule(index, width, height) {
    if (!Number.isInteger(index) || index < 0 || ![width,height].every(value => Number.isFinite(value) && value > 0 && value <= 20000)) throw new Error('Kích thước trang in không hợp lệ.');
    return '@page sfPage' + index + '{size:' + width.toFixed(3) + 'pt ' + height.toFixed(3) + 'pt;margin:0}';
  }
  function wordPages(doc) {
    const rules = [];
    doc.querySelectorAll('section.docx').forEach((section,index) => {
      const dimensions = [section.style.width,section.style.minHeight];
      if (!dimensions.every(value => /^\d+(?:\.\d+)?pt$/.test(value))) return;
      const [width,height] = dimensions.map(parseFloat);
      rules.push(pageRule(index,width,height));
      section.style.page = 'sfPage' + index;
    });
    const style = doc.createElement('style');
    style.textContent = rules.join('\n');
    doc.head.appendChild(style);
  }
  async function ready(doc) {
    await doc.fonts.ready;
    await Promise.all(Array.from(doc.images,image => image.decode()));
    await new Promise(resolve => doc.defaultView.requestAnimationFrame(() => doc.defaultView.requestAnimationFrame(resolve)));
  }
  async function print(frame, title, active = () => true) {
    const doc = frame.contentDocument;
    if (!doc) throw new Error('Trình xem bên ngoài không cho phép in từ ứng dụng.');
    await ready(doc);
    if (!active()) return;
    doc.title = title;
    frame.contentWindow.focus();
    frame.contentWindow.print();
  }
  return {resolve,pageRule,wordPages,ready,print};
})();
