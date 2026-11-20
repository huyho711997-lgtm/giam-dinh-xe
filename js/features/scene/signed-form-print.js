// In sơ đồ hiện trường LÊN GIẤY BIỂU MẪU BM.TASCO.XCG.01.04 đã in sẵn (logo, tiêu đề, nhãn chữ ký, đã ký "Các bên liên quan").
// Có hai loại tờ mẫu (chọn trong hộp thoại):
//  • 'grid'  — tờ CÓ SẴN khung ô li + cột "Chú thích" (trang 3/3): chỉ in hình vẽ và nội dung chú thích vào đúng ô li, KHÔNG in khung.
//  • 'blank' — tờ chưa có khung: in thêm khung sơ đồ + cột chú thích.
// Mọi chữ in sẵn và chỗ chấm trên giấy (giờ/ngày/địa điểm, ngày lập) để nguyên, không in.
// Toạ độ đo từ bản quét giấy mẫu (A4 ngang = 1280×905 "px giấy"); mỗi máy in lệch một chút nên có chỉnh lề X/Y theo mm và nhớ lại.
const SceneSignedForm = (() => {
  const PAPER = {w:1280,h:905,mmW:297,mmH:210}, OUT = {w:3508,h:2480};   // in 300 dpi
  const PX_PER_MM = PAPER.w / PAPER.mmW;
  // Vùng đặt khung sơ đồ (tờ 'blank'): đo lại từ bản quét tờ mẫu đã ký (11/2026). Bản cũ (y 118 → 678) đè lên dòng "Tại: ……"
  // in sẵn ở trên và dòng ", ngày … tháng … năm" ở dưới. Nay khung nằm gọn giữa hai dòng đó, chừa ~3 mm mỗi phía cho sai lệch máy in.
  const AREA = {x:40,y:152,w:1200,h:503};
  // Tờ 'grid': đo từ bản quét A4 ngang 1521×1076 (đã xoay thẳng, lệch nghiêng < 0,1°, khung cân giữa trái/phải 24 mm) × F → px giấy.
  //  khung ngoài x 123→1395, y 167,5→828,5; vạch dọc cột Chú thích x 1151; ô li rộng ~37, cao ~44; đầu cột Chú thích ("Chú thích",
  //  "(Dấu vết, vật chứng…)") kết thúc ở y 256 → nội dung chú thích bắt đầu từ hàng kẻ thứ ba.
  const F = PAPER.w / 1521;
  const GRID_FORM = {
    frame:{x:123 * F,y:167.5 * F,w:(1395 - 123) * F,h:(828.5 - 167.5) * F},
    legendX:1151 * F, headEnd:256 * F, rowPitch:(661 / 15) * F, colPitch:(1151 - 154) / 27 * F, firstCol:154 * F,
    inset:3                                                              // chừa ~0,7 mm sát vạch kẻ để nét in không đè lên khung
  };
  const SCENE_AREA = {x:20,y:85,w:800,h:475};                            // vùng vẽ (không gồm cột chú thích) trong hệ toạ độ trình vẽ
  const NOTE_ROW_UNITS = 27;                                             // chiều cao tối thiểu 1 dòng chú thích số (rendering.js) → khớp đúng 1 hàng ô li
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
  const PREPRINTED_GRID = [
    {kind:'box',x:36,y:23,w:219,h:88,label:'Logo TASCO'},
    {kind:'text',x:627,y:51,text:'SƠ ĐỒ HIỆN TRƯỜNG VỤ TAI NẠN',size:23,bold:true},
    {kind:'line',x1:338,x2:874,y:84,text:'Tai nạn xảy ra hồi: …… giờ …… ngày …… tháng …… năm 20……'},
    {kind:'line',x1:351,x2:952,y:114,text:'Tại: ………………………………………………………………'},
    {kind:'line',x1:837,x2:1119,y:718,text:'……………, ngày …… tháng …… năm 20……'},
    {kind:'text',x:237,y:746,text:'Các bên liên quan'},{kind:'text',x:608,y:746,text:'Người chứng kiến (nếu có)'},{kind:'text',x:976,y:746,text:'Người vẽ sơ đồ'},
    {kind:'rule',x1:40,x2:721,y:812}
  ];
  const GRID = {x:20,y:85,w:960,h:475,legendX:820,sceneW:1000};            // khung + cột chú thích trong hệ toạ độ trình vẽ (drawTemplate)
  const KEY = 'sceneSignedFormPrint.v1', DEFAULTS = {dx:0,dy:0,frame:true,template:'blank'};
  const TEMPLATES = ['grid','blank'];
  let settings = {...DEFAULTS}, overlay = null;
  try { Object.assign(settings,JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (_) { /* dùng mặc định */ }
  if (!TEMPLATES.includes(settings.template)) settings.template = DEFAULTS.template;
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
      drawSceneLegendColumn(ctx,GRID.legendX,GRID.y,GRID.sceneW - 20 - GRID.legendX,GRID.h,{preview:true});   // preview: không ghi đè vùng bấm bảng ký hiệu của canvas đang vẽ
    }
    ctx.save(); applySceneDrawingAreaClip(ctx);
    for (let i = 0; i < sceneShapes.length; i++) renderShape(ctx,sceneShapes[i]);
    ctx.restore(); ctx.restore();
  }
  // Tờ 'grid': hình vẽ co đều (không méo) cho vừa khít vùng ô li bên trái vạch cột Chú thích; nội dung chú thích số + bảng ký hiệu
  // xếp vào cột Chú thích bên phải, mỗi chú thích một dòng đúng một hàng ô li. Không in khung/tiêu đề cột vì tờ đã in sẵn.
  function getGridLayout() {
    const G = GRID_FORM, right = G.frame.x + G.frame.w, bottom = G.frame.y + G.frame.h;
    const box = {x:G.frame.x + G.inset,y:G.frame.y + G.inset,w:G.legendX - G.frame.x - 2 * G.inset,h:G.frame.h - 2 * G.inset};
    const k = Math.min(box.w / SCENE_AREA.w,box.h / SCENE_AREA.h);
    const legendScale = G.rowPitch / NOTE_ROW_UNITS;
    return {
      k, x0:box.x + (box.w - SCENE_AREA.w * k) / 2, y0:box.y + (box.h - SCENE_AREA.h * k) / 2,
      legend:{x:G.legendX + G.inset,top:G.headEnd,bottom:bottom - G.inset,w:right - G.legendX - 2 * G.inset,scale:legendScale}
    };
  }
  function drawGridDiagram(ctx) {
    const L = getGridLayout();
    ctx.save(); ctx.translate(L.x0,L.y0); ctx.scale(L.k,L.k); ctx.translate(-SCENE_AREA.x,-SCENE_AREA.y);
    ctx.save(); applySceneDrawingAreaClip(ctx);
    for (let i = 0; i < sceneShapes.length; i++) renderShape(ctx,sceneShapes[i]);
    ctx.restore(); ctx.restore();
    const g = L.legend, gy = -69;     // -69: chữ + số thứ tự nằm giữa hàng ô li (mục đầu bắt đầu sau gy + 73 = 4 đơn vị kể từ vạch kẻ)
    ctx.save(); ctx.translate(g.x,g.top); ctx.scale(g.scale,g.scale);
    drawSceneLegendColumn(ctx,0,gy,g.w / g.scale,(g.bottom - g.top) / g.scale - gy,{preview:true,separators:false});
    ctx.restore();
  }
  // Nền mờ ô li của tờ 'grid' — chỉ để xem trước, KHÔNG in ra.
  function drawGridGuide(ctx) {
    const G = GRID_FORM, right = G.frame.x + G.frame.w, bottom = G.frame.y + G.frame.h;
    ctx.save(); ctx.strokeStyle = 'rgba(100,116,139,.35)'; ctx.fillStyle = 'rgba(100,116,139,.55)'; ctx.lineWidth = 1;
    ctx.strokeRect(G.frame.x,G.frame.y,G.frame.w,G.frame.h);
    ctx.beginPath();
    for (let i = 0; i <= 27; i++) { const x = G.firstCol + i * G.colPitch; ctx.moveTo(x,G.frame.y); ctx.lineTo(x,bottom); }
    for (let i = 1; i < 15; i++) { const y = G.frame.y + i * G.rowPitch; ctx.moveTo(G.frame.x,y); ctx.lineTo(right,y); }
    ctx.stroke();
    ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(G.legendX,G.frame.y); ctx.lineTo(G.legendX,bottom); ctx.stroke();
    ctx.textAlign = 'center'; ctx.font = 'bold 14px Arial'; ctx.fillText('Chú thích',(G.legendX + right) / 2,G.frame.y + 31);
    ctx.font = 'italic 12px Arial'; ctx.fillText('(Dấu vết, vật chứng…)',(G.legendX + right) / 2,G.frame.y + 68);
    ctx.restore();
  }
  function drawPreprinted(ctx,items = PREPRINTED) {
    ctx.save(); ctx.fillStyle = 'rgba(100,116,139,.55)'; ctx.strokeStyle = 'rgba(100,116,139,.45)'; ctx.lineWidth = 1; ctx.textBaseline = 'alphabetic';
    items.forEach(item => {
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
    const grid = options.template === 'grid';
    if (withGuide) {   // nền tờ mẫu (chỉ xem trước)
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,PAPER.w,PAPER.h);
      if (grid) { drawPreprinted(ctx,PREPRINTED_GRID); drawGridGuide(ctx); } else drawPreprinted(ctx);
    }
    ctx.translate(clampMm(options.dx) * PX_PER_MM,clampMm(options.dy) * PX_PER_MM);
    if (grid) drawGridDiagram(ctx); else drawDiagram(ctx,options.frame);
    return canvas;
  }

  function printCanvas(canvas) {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden','true'); frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
    document.body.appendChild(frame);
    const doc = frame.contentDocument || frame.contentWindow.document;
    doc.open();
    doc.write('<!doctype html><html><head><meta charset="utf-8"><title>In sơ đồ lên giấy biểu mẫu</title><style>@page{size:A4 landscape;margin:0}html,body{margin:0;padding:0;background:#fff;width:297mm;height:209.5mm;overflow:hidden}img{display:block;width:297mm;height:210mm;page-break-after:avoid;break-after:avoid;print-color-adjust:exact;-webkit-print-color-adjust:exact}</style></head><body><img id="p" alt="Sơ đồ hiện trường" src="' + canvas.toDataURL('image/png') + '"></body></html>');
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
  const HINTS = {
    grid:'Bản xem trước có nền mờ là khung ô li và chữ in sẵn của tờ mẫu: hình vẽ phải nằm gọn trong ô li, nội dung chú thích nằm trong cột Chú thích, mỗi chú thích một hàng. Chỉ in hình vẽ và chữ chú thích, không in lại khung. Mỗi máy in lệch lề một chút: in thử trên giấy nháp (hoặc đặt lên tờ mẫu soi đèn) rồi chỉnh, số dương dịch sang phải / xuống dưới. Cài đặt được nhớ cho lần sau. Khi in, chọn khổ A4 ngang, tỉ lệ 100% (không “Vừa trang”).',
    blank:'Bản xem trước có nền mờ là chữ in sẵn trên tờ mẫu: khung sơ đồ phải nằm gọn giữa dòng “Tại:” và dòng “ngày … tháng … năm”. Mỗi máy in lệch lề một chút. In thử trên giấy nháp rồi chỉnh: số dương dịch sang phải / xuống dưới. Cài đặt được nhớ cho lần sau. Khi in, chọn khổ A4 ngang, tỉ lệ 100% (không “Vừa trang”).'
  };
  function syncTemplateUi() {
    if (!overlay) return;
    const grid = settings.template === 'grid';
    const frameOption = overlay.querySelector('[data-ssf-frame-option]'), hint = overlay.querySelector('[data-ssf-hint]');
    if (frameOption) frameOption.hidden = grid;     // tờ 'grid' đã có sẵn khung nên không có tuỳ chọn in khung
    if (hint) hint.textContent = HINTS[settings.template] || HINTS.blank;
  }
  function open() {
    if (typeof sceneShapes === 'undefined') return;
    close();
    overlay = document.createElement('div'); overlay.className = 'ssf-overlay'; overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true'); overlay.setAttribute('aria-labelledby','ssfTitle');
    overlay.innerHTML = '<div class="ssf-card"><header><div><small>IN SƠ ĐỒ HIỆN TRƯỜNG</small><h2 id="ssfTitle">In lên giấy biểu mẫu đã in sẵn</h2><p>Đặt tờ biểu mẫu BM.TASCO.XCG.01.04 (khổ A4 ngang) vào máy in và chọn đúng loại giấy bên dưới. Không in giờ, ngày, địa điểm, logo, tiêu đề, chữ ký.</p></div><button type="button" class="ssf-x" data-ssf-close aria-label="Đóng">×</button></header>' +
      '<div class="ssf-body"><div class="ssf-preview" data-ssf-preview></div><div class="ssf-options">' +
      '<fieldset class="ssf-templates"><legend>Loại giấy đang đặt vào máy in</legend>' +
      '<label class="ssf-radio"><input type="radio" name="ssfTemplate" value="grid" data-ssf="template"><span><b>Giấy có sẵn khung ô li</b><small>Tờ có sẵn khung ô li và cột “Chú thích” (trang 3/3). Chỉ in hình vẽ và nội dung chú thích vào đúng ô li.</small></span></label>' +
      '<label class="ssf-radio"><input type="radio" name="ssfTemplate" value="blank" data-ssf="template"><span><b>Giấy ký sẵn chưa có khung</b><small>Tờ chỉ có tiêu đề và chữ ký. In thêm khung sơ đồ, cột Chú thích và hình vẽ.</small></span></label></fieldset>' +
      '<label class="ssf-check" data-ssf-frame-option><input type="checkbox" data-ssf="frame"><span>In khung sơ đồ và cột Chú thích (tờ mẫu không có sẵn khung)</span></label>' +
      '<div class="ssf-offsets"><label>Lệch ngang (mm)<input type="number" step="0.5" min="-15" max="15" data-ssf="dx"></label><label>Lệch dọc (mm)<input type="number" step="0.5" min="-15" max="15" data-ssf="dy"></label></div>' +
      '<p class="ssf-hint" data-ssf-hint></p>' +
      '<div class="ssf-actions"><button type="button" class="ssf-btn" data-ssf-close>Hủy</button><button type="button" class="ssf-btn ssf-primary" data-ssf-print>In ngay</button></div></div></div></div>';
    document.body.appendChild(overlay); document.addEventListener('keydown',onKey,true);
    overlay.querySelectorAll('[data-ssf]').forEach(input => {
      const key = input.dataset.ssf;
      if (input.type === 'checkbox') input.checked = !!settings[key]; else if (input.type === 'radio') input.checked = settings[key] === input.value; else input.value = settings[key];
    });
    overlay.addEventListener('click',event => {
      if (event.target === overlay || event.target.closest('[data-ssf-close]')) return close();
      if (event.target.closest('[data-ssf-print]')) {
        try { printCanvas(build(settings)); close(); } catch (error) { console.error(error); (typeof triggerToast === 'function' ? triggerToast : alert)('Không thể in: ' + (error.message || 'lỗi không xác định'),'error'); }
      }
    });
    overlay.addEventListener('input',event => {
      const input = event.target.closest('[data-ssf]'); if (!input) return;
      if (input.type === 'radio') { if (!input.checked || !TEMPLATES.includes(input.value)) return; settings.template = input.value; }
      else settings[input.dataset.ssf] = input.type === 'checkbox' ? input.checked : clampMm(input.value);
      save(); syncTemplateUi(); preview();
    });
    syncTemplateUi(); preview(); overlay.querySelector('[data-ssf-print]').focus();
  }
  return {open,build,settings:() => ({...settings}),AREA,GRID_FORM,getGridLayout};
})();
