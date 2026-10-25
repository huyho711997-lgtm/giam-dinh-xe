// Xuất bảng tính chi phí cứu hộ thành ảnh PNG (vẽ bằng canvas, không phụ thuộc thư viện ngoài, chạy được khi offline).
// render(model) → Promise<Blob>; model: {title, time, info:[[nhãn,giá trị]], lines:[{label,value,sub}], total, totalNote, approver, warnings:[], footer}
const RescueExport = (() => {
  const W = 880, PAD = 40, SCALE = 2;
  const FONT = "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif";
  const C = {bg:'#fbf8f2',paper:'#ffffff',ink:'#2b2418',muted:'#7a6f5d',line:'#e6dcc8',gold:'#8a6a32',goldBg:'#f6ecd8',warn:'#fdf1d9',warnLine:'#e3c27a'};

  function wrap(ctx, text, maxWidth) {
    const out = [];
    for (const paragraph of String(text ?? '').split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width > maxWidth && line) { out.push(line); line = word; } else line = test;
      }
      out.push(line);
    }
    return out;
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x,y,w,h,r) : ctx.rect(x,y,w,h); }

  // Một lượt "vẽ" dùng cho cả đo chiều cao (draw=false) lẫn vẽ thật (draw=true).
  function paint(ctx, model, draw) {
    let y = PAD;
    const inner = W - PAD * 2;
    const font = (size, weight = 500) => { ctx.font = weight + ' ' + size + 'px ' + FONT; };
    const text = (value, x, baseline, color, align = 'left') => { if (!draw) return; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(value,x,baseline); };
    const box = (x, top, w, h, fill, stroke, r = 14) => { if (!draw) return; roundRect(ctx,x + .5,top + .5,w - 1,h - 1,r); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); } };
    ctx.textBaseline = 'alphabetic';

    font(12,800); text('CHI PHÍ CỨU HỘ · BAREM NỘI BỘ',PAD,y + 12,C.gold); y += 36;
    font(26,800); text(model.title,PAD,y + 10,C.ink); y += 30;
    font(12.5); text(model.time,PAD,y + 14,C.muted); y += 40;

    // Thông tin đầu vào
    font(11,800); text('THÔNG TIN TÍNH',PAD,y + 10,C.muted); y += 22;
    const infoTop = y; let rowsHeight = 0;
    const rows = model.info.map(([label, value]) => { font(13,700); const lines = wrap(ctx,value,inner - 220 - 32); rowsHeight += Math.max(1,lines.length) * 19 + 14; return [label,lines]; });
    box(PAD,infoTop,inner,rowsHeight + 8,C.paper,C.line);
    let ry = infoTop + 4;
    rows.forEach(([label, lines], index) => {
      const height = Math.max(1,lines.length) * 19 + 14;
      font(12.5); text(label,PAD + 16,ry + 22,C.muted);
      font(13,700); lines.forEach((line, i) => text(line,PAD + 16 + 220,ry + 22 + i * 19,C.ink));
      if (draw && index < rows.length - 1) { ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(PAD + 16,ry + height); ctx.lineTo(PAD + inner - 16,ry + height); ctx.stroke(); }
      ry += height;
    });
    y = infoTop + rowsHeight + 8 + 24;

    // Tổng trần
    const totalHeight = 96 + (model.totalNote ? 0 : -8);
    box(PAD,y,inner,totalHeight,C.goldBg,C.gold);
    font(11,800); text('TỔNG TRẦN CHI PHÍ · CHƯA VAT',PAD + 20,y + 28,C.gold);
    font(36,800); text(model.total,PAD + 20,y + 68,C.ink);
    if (model.totalNote) { font(11.5); text(model.totalNote,PAD + 20,y + 88,C.muted); }
    y += totalHeight + 24;

    // Chi tiết
    font(11,800); text('CHI TIẾT',PAD,y + 10,C.muted); y += 22;
    const lineHeights = model.lines.map(line => { font(13,line.sub ? 800 : 500); return Math.max(1,wrap(ctx,line.label,inner - 200).length) * 19 + 16; });
    const linesTotal = lineHeights.reduce((a, b) => a + b, 0);
    box(PAD,y,inner,linesTotal,C.paper,C.line);
    let ly = y;
    model.lines.forEach((line, index) => {
      if (draw && line.sub) { ctx.fillStyle = C.bg; ctx.fillRect(PAD + 1,ly + 1,inner - 2,lineHeights[index] - 2); }
      font(13,line.sub ? 800 : 500); wrap(ctx,line.label,inner - 200).forEach((part, i) => text(part,PAD + 16,ly + 23 + i * 19,line.sub ? C.ink : C.muted));
      font(13.5,800); text(line.value,PAD + inner - 16,ly + 23,C.ink,'right');
      if (draw && index < model.lines.length - 1) { ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(PAD,ly + lineHeights[index]); ctx.lineTo(PAD + inner,ly + lineHeights[index]); ctx.stroke(); }
      ly += lineHeights[index];
    });
    y += linesTotal + 24;

    // Cấp phê duyệt
    font(16,800); const approverLines = wrap(ctx,model.approver,inner - 40);
    const approvalHeight = 46 + approverLines.length * 22 + 26;
    box(PAD,y,inner,approvalHeight,C.paper,C.line);
    font(11,800); text('CẤP PHÊ DUYỆT',PAD + 20,y + 26,C.muted);
    font(16,800); approverLines.forEach((line, i) => text(line,PAD + 20,y + 52 + i * 22,C.ink));
    font(11.5); text('Căn cứ tổng chi phí một sự kiện cứu hộ, không tách nhỏ để giảm cấp duyệt.',PAD + 20,y + 46 + approverLines.length * 22 + 8,C.muted);
    y += approvalHeight + 20;

    // Cảnh báo
    if (model.warnings.length) {
      font(12.5,600);
      const parts = model.warnings.map(item => wrap(ctx,'• ' + item,inner - 40));
      const count = parts.reduce((sum, item) => sum + item.length, 0), height = count * 19 + 28 + (parts.length - 1) * 6;
      box(PAD,y,inner,height,C.warn,C.warnLine);
      let wy = y + 28;
      parts.forEach(group => { group.forEach((line, i) => { font(12.5,600); text(i ? '  ' + line : line,PAD + 20,wy,C.ink); wy += 19; }); wy += 6; });
      y += height + 20;
    }
    font(11); wrap(ctx,model.footer,inner).forEach((line, i) => text(line,PAD,y + 12 + i * 16,C.muted));
    y += wrap(ctx,model.footer,inner).length * 16;
    return y + PAD;
  }

  async function render(model) {
    try { await Promise.all([document.fonts?.load('800 16px "Plus Jakarta Sans"'),document.fonts?.load('500 13px "Plus Jakarta Sans"')]); } catch (_) { /* dùng font dự phòng */ }
    const probe = document.createElement('canvas').getContext('2d');
    const height = Math.ceil(paint(probe,model,false));
    const canvas = document.createElement('canvas'); canvas.width = W * SCALE; canvas.height = height * SCALE;
    const ctx = canvas.getContext('2d'); ctx.scale(SCALE,SCALE);
    ctx.fillStyle = C.bg; ctx.fillRect(0,0,W,height);
    paint(ctx,model,true);
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Không tạo được ảnh.')),'image/png'));
  }
  return {render};
})();
