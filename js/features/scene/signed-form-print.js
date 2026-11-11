// In sơ đồ hiện trường LÊN GIẤY KÝ SẴN (biểu mẫu BM.TASCO.XCG.01.04 đã in sẵn logo, tiêu đề, nhãn chữ ký và đã ký "Các bên liên quan").
// Chỉ in khung sơ đồ + cột chú thích + hình vẽ; mọi chữ in sẵn và chỗ chấm trên giấy (giờ/ngày/địa điểm, ngày lập) để nguyên, không in.
// Toạ độ đo từ bản quét giấy mẫu (A4 ngang = 1280×905 "px giấy"); mỗi máy in lệch một chút nên có chỉnh lề X/Y theo mm và nhớ lại.
const SceneSignedForm = (() => {
  const PAPER = {w:1280,h:905,mmW:297,mmH:210}, OUT = {w:3508,h:2480};   // in 300 dpi
  const PX_PER_MM = PAPER.w / PAPER.mmW;
  // Vùng đặt khung sơ đồ: đo lại từ bản quét tờ mẫu đã ký (11/2026). Bản cũ (y 118 → 678) đè lên dòng "Tại: ……" in sẵn
  // ở trên và dòng ", ngày … tháng … năm" ở dưới. Nay khung nằm gọn giữa hai dòng đó, chừa ~3 mm mỗi phía cho sai lệch máy in.
  const AREA = {x:40,y:152,w:1200,h:503};
  // Vị trí chữ in sẵn trên tờ mẫu (px giấy) — chỉ vẽ mờ ở bản xem trước để canh, KHÔNG in ra.
  const PREPRINTED = [
    {kind:'box',x:63,y:44,w:194,h:85,label:'Logo TASCO'},
    {kind:'text',x:747,y:63,text:'SƠ ĐỒ HIỆN TRƯỜNG VỤ TAI NẠN',size:22,bold:true},
    {kind:'line',x1:481,x2:1028,y:110,text:'Tai nạn xảy ra hồi: …… giờ …… ngày …… tháng …… năm 20……'},
    {kind:'line',x1:519,x2:995,y:144,text:'Tại: ……………………………………………………'},
    {kind:'line',x1:864,x2:1165,y:689,text:'……………, ngày …… tháng …… năm 20……'},
    {kind:'text',x:233,y:710,text:'Các bên liên quan'},{kind:'text',x:625,y:710,text:'Người chứng kiến (nếu có)'},{kind:'text',x:1012,y:710,text:'Người vẽ sơ đồ'},
    {kind:'rule',x1:38,x2:733,y:815}
  ];
  const GRID = {x:20,y:85,w:960,h:475,legendX:820,sceneW:1000};            // khung + cột chú thích trong hệ toạ độ trình vẽ (drawTemplate)
  const KEY = 'sceneSignedFormPrint.v1', DEFAULTS = {dx:0,dy:0,frame:true};
  let settings = {...DEFAULTS}, overlay = null;
  try { Object.assign(settings,JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (_) { /* dùng mặc định */ }
  const clampMm = value => Math.max(-15,Math.min(15,Number.isFinite(+value) ? +value : 0));
  const save = () => { try { localStorage.setItem(KEY,JSON.stringify(settings)); } catch (_) { /* không lưu được thì bỏ qua */ } };
  function drawDiagram(ctx, withFrame) {
    const k = Math.min(AREA.w / GRID.w,AREA.h / GRID.h), x0 = AREA.x + (AREA.w - GRID.w * k) / 2, y0 = AREA.y;
    ctx.save(); ctx.translate(x0,y0); ctx.scale(k,k); ctx.translate(-GRID.x,-GRID.y);
    if (withFrame) {
      ctx.strokeStyle = '#000'; ctx.fillStyle = '#000'; ctx.lineWidth = 1.5;
      ctx.strokeRect(GRID.x,GRID.y,GRID.w,GRID.h);
      ctx.beginPath(); ctx.moveTo(GRID.legendX,GRID.y); ctx.lineTo(GRID.legendX,GRID.y + GRID.h); ctx.stroke();
      ctx.textAlign = 'center'; ctx.font = 'bold 14px Arial'; ctx.fillText('Chú thích',GRID.legendX + 80,GRID.y + 25);
      ctx.font = 'italic 12px Arial'; ctx.fillText('(Số — nội dung giải thích)',GRID.legendX + 80,GRID.y + 45);
      ctx.beginPath(); ctx.moveTo(GRID.legendX,GRID.y + 55); ctx.lineTo(GRID.sceneW - 20,GRID.y + 55); ctx.stroke();
      drawSceneNumberLegend(ctx,GRID.legendX,GRID.y,GRID.sceneW - 20 - GRID.legendX,GRID.h);
    }
    ctx.save(); applySceneDrawingAreaClip(ctx);
    for (let i = 0; i < sceneShapes.length; i++) renderShape(ctx,sceneShapes[i]);
    ctx.restore(); ctx.restore();
  }
  function drawPreprinted(ctx) {
    ctx.save(); ctx.fillStyle = 'rgba(100,116,139,.55)'; ctx.strokeStyle = 'rgba(100,116,139,.45)'; ctx.lineWidth = 1; ctx.textBaseline = 'alphabetic';
    PREPRINTED.forEach(item => {
      if (item.kind === 'box') { ctx.setLineDash([4,3]); ctx.strokeRect(item.x,item.y,item.w,item.h); ctx.setLineDash([]); ctx.textAlign = 'center'; ctx.font = '12px Arial'; ctx.fillText(item.label,item.x + item.w / 2,item.y + item.h / 2 + 4); }
      else if (item.kind === 'text') { ctx.textAlign = 'center'; ctx.font = (item.bold ? 'bold ' : '') + (item.size || 13) + 'px Arial'; ctx.fillText(item.text,item.x,item.y); }
      else if (item.kind === 'line') { ctx.textAlign = 'center'; ctx.font = '13px Arial'; ctx.fillText(item.text,(item.x1 + item.x2) / 2,item.y,item.x2 - item.x1); }
      else if (item.kind === 'rule') { ctx.beginPath(); ctx.moveTo(item.x1,item.y); ctx.lineTo(item.x2,item.y); ctx.stroke(); }
    });
    ctx.restore();
  }
  // Vẽ toàn bộ phần in lên canvas trong suốt khổ A4 ngang; scale = số px canvas / px giấy.
  function build(options = settings, width = OUT.w, withGuide = false) {
    const canvas = document.createElement('canvas'), scale = width / PAPER.w;
    canvas.width = width; canvas.height = Math.round(PAPER.h * scale);
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Trình duyệt không thể khởi tạo vùng in.');
    ctx.imageSmoothingQuality = 'high'; ctx.scale(scale,scale);
    if (withGuide) { ctx.fillStyle = '#fff'; ctx.fillRect(0,0,PAPER.w,PAPER.h); drawPreprinted(ctx); }   // nền tờ mẫu (chỉ xem trước)
    ctx.translate(clampMm(options.dx) * PX_PER_MM,clampMm(options.dy) * PX_PER_MM);
    drawDiagram(ctx,options.frame);
    return canvas;
  }

  function printCanvas(canvas) {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden','true'); frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
    document.body.appendChild(frame);
    const doc = frame.contentDocument || frame.contentWindow.document;
    doc.open();
    doc.write('<!doctype html><html><head><meta charset="utf-8"><title>In sơ đồ lên giấy ký sẵn</title><style>@page{size:A4 landscape;margin:0}html,body{margin:0;padding:0;background:#fff;width:297mm;height:209.5mm;overflow:hidden}img{display:block;width:297mm;height:210mm;page-break-after:avoid;break-after:avoid;print-color-adjust:exact;-webkit-print-color-adjust:exact}</style></head><body><img id="p" alt="Sơ đồ hiện trường" src="' + canvas.toDataURL('image/png') + '"></body></html>');
    doc.close();
    const cleanup = () => frame.parentNode && frame.parentNode.removeChild(frame);
    const go = () => { try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (error) { cleanup(); throw error; } };
    const image = doc.getElementById('p'); frame.contentWindow.onafterprint = cleanup;
    if (image.complete) setTimeout(go,80); else image.onload = () => setTimeout(go,80);
    setTimeout(cleanup,60000);
  }

  function close() { if (overlay) { overlay.remove(); overlay = null; document.removeEventListener('keydown',onKey,true); } }
  function onKey(event) { if (event.key === 'Escape') { event.stopPropagation(); close(); } }
  function preview() {
    const holder = overlay?.querySelector('[data-ssf-preview]'); if (!holder) return;
    try {
      const canvas = build(settings,960,true); canvas.className = 'ssf-canvas';
      // Nền mờ: chữ in sẵn của tờ mẫu (logo, tiêu đề, dòng Tại, ngày lập, nhãn ký) để thấy khung có đè lên không.
      holder.replaceChildren(canvas);
    } catch (error) { holder.textContent = 'Không dựng được bản xem trước: ' + error.message; }
  }
  function open() {
    if (typeof sceneShapes === 'undefined') return;
    close();
    overlay = document.createElement('div'); overlay.className = 'ssf-overlay'; overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true'); overlay.setAttribute('aria-labelledby','ssfTitle');
    overlay.innerHTML = '<div class="ssf-card"><header><div><small>IN SƠ ĐỒ HIỆN TRƯỜNG</small><h2 id="ssfTitle">In lên giấy đã ký sẵn</h2><p>Đặt tờ biểu mẫu BM.TASCO.XCG.01.04 đã ký (khổ A4 ngang) vào máy in. Chỉ in khung sơ đồ, cột Chú thích và hình vẽ; không in giờ, ngày, địa điểm, logo, tiêu đề, chữ ký.</p></div><button type="button" class="ssf-x" data-ssf-close aria-label="Đóng">×</button></header>' +
      '<div class="ssf-body"><div class="ssf-preview" data-ssf-preview></div><div class="ssf-options">' +
      '<label class="ssf-check"><input type="checkbox" data-ssf="frame"><span>In khung sơ đồ và cột Chú thích (tờ mẫu không có sẵn khung)</span></label>' +
      '<div class="ssf-offsets"><label>Lệch ngang (mm)<input type="number" step="0.5" min="-15" max="15" data-ssf="dx"></label><label>Lệch dọc (mm)<input type="number" step="0.5" min="-15" max="15" data-ssf="dy"></label></div>' +
      '<p class="ssf-hint">Bản xem trước có nền mờ là chữ in sẵn trên tờ mẫu: khung sơ đồ phải nằm gọn giữa dòng “Tại:” và dòng “ngày … tháng … năm”. Mỗi máy in lệch lề một chút. In thử trên giấy nháp rồi chỉnh: số dương dịch sang phải / xuống dưới. Cài đặt được nhớ cho lần sau. Khi in, chọn khổ A4 ngang, tỉ lệ 100% (không “Vừa trang”).</p>' +
      '<div class="ssf-actions"><button type="button" class="ssf-btn" data-ssf-close>Hủy</button><button type="button" class="ssf-btn ssf-primary" data-ssf-print>In ngay</button></div></div></div></div>';
    document.body.appendChild(overlay); document.addEventListener('keydown',onKey,true);
    overlay.querySelectorAll('[data-ssf]').forEach(input => { const key = input.dataset.ssf; if (input.type === 'checkbox') input.checked = !!settings[key]; else input.value = settings[key]; });
    overlay.addEventListener('click',event => {
      if (event.target === overlay || event.target.closest('[data-ssf-close]')) return close();
      if (event.target.closest('[data-ssf-print]')) {
        try { printCanvas(build(settings)); close(); } catch (error) { console.error(error); (typeof triggerToast === 'function' ? triggerToast : alert)('Không thể in: ' + (error.message || 'lỗi không xác định'),'error'); }
      }
    });
    overlay.addEventListener('input',event => {
      const input = event.target.closest('[data-ssf]'); if (!input) return;
      settings[input.dataset.ssf] = input.type === 'checkbox' ? input.checked : clampMm(input.value);
      save(); preview();
    });
    preview(); overlay.querySelector('[data-ssf-print]').focus();
  }
  return {open,build,settings:() => ({...settings}),AREA};
})();
