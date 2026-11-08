// "Báo cáo KPI bồi thường" theo Zone: một góc nhìn trong Báo cáo & thống kê GĐV.
// Dữ liệu lấy từ các hồ sơ bồi thường đã có trong hệ thống (pending_claims, nhập từ B001); tính ngay trong trình duyệt.
// Phần tính nằm ở kpi-zone-calc.js (hàm thuần); file này chỉ vẽ giao diện và xuất Excel.
const KpiZonePage = (() => {
  const K = KpiZoneCalc;
  const XLSX_SRC = 'js/vendor/xlsx-js-style-1.2.0.bundle.js?v=20261031-kpi-4';
  let host = null, prep = null, selected = null, report = null;
  let listFilter = {gdv: '', status: '', sort: 'desc'};
  // Zone BT map do người dùng gán (lưu trên trình duyệt này): {zone chuẩn hoá: 'in' | 'out'}; chưa gán = theo GĐV.
  const ZONE_KEY = 'kpiZoneBtMap:v1';
  const loadZoneMap = () => { try { const v = JSON.parse(localStorage.getItem(ZONE_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } };
  const saveZoneMap = () => { try { localStorage.setItem(ZONE_KEY, JSON.stringify(zoneMap)); } catch (_) { /* trình duyệt chặn lưu: vẫn dùng được trong phiên */ } };
  let zoneMap = loadZoneMap();

  const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const now = new Date();
  const defaultMonth = () => now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  let monthValue = defaultMonth(), monthTouched = false;
  const fmt = K;
  const dec = (n, d = 1) => n.toFixed(d).replace('.', ',');
  const label = r => 'T' + r.month + '.' + r.year;

  // ----- Thư viện xuất xlsx: nằm trong thư mục dự án, nạp khi cần -----
  let xlsxPromise = null;
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    xlsxPromise = xlsxPromise || new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = XLSX_SRC;
      script.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error('Không nạp được thư viện Excel.')));
      script.onerror = () => { xlsxPromise = null; reject(new Error('Không nạp được thư viện Excel (js/vendor).')); };
      document.head.appendChild(script);
    });
    return xlsxPromise;
  }

  // ----- Thành phần nhỏ -----
  const delta = (value, kind, lowerBetter) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '<span class="kz-delta">-</span>';
    const flat = Math.abs(value) < 1e-9, up = value > 0;
    const good = lowerBetter ? !up : up;
    const text = kind === 'pct' ? dec(Math.abs(value) * 100) + ' đ.%' : kind === 'score' ? dec(Math.abs(value), 4) : Math.round(Math.abs(value)).toLocaleString('vi-VN');
    return '<span class="kz-delta ' + (flat ? '' : good ? 'good' : 'bad') + '">' + (flat ? '' : up ? '▲ ' : '▼ ') + text + '</span>';
  };
  const imgBtn = '<button type="button" class="kz-img" data-kz-img title="Tải ảnh khối này về máy" aria-label="Tải ảnh về máy"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg><span>Tải ảnh</span></button>';
  const xlsBtn = '<button type="button" class="kz-img kz-xls" data-kz-xls title="Xuất bảng này ra Excel" aria-label="Xuất Excel"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9.5 12.5l5 5M14.5 12.5l-5 5"/></svg><span>Xuất Excel</span></button>';
  const block = (title, inner, extra = '', cls = '') => '<section class="sf-library kz-card ' + cls + '"><div class="kz-head"><h2>' + title + '</h2><span class="kz-head-tools">' + extra + (inner.indexOf('<table') >= 0 ? xlsBtn : '') + imgBtn + '</span></div>' + inner + '</section>';
  const table = (heads, rows, foot, cls = '') => '<div class="kz-tablewrap"><table class="kz-table ' + cls + '"><thead><tr>' + heads.map((h, i) => '<th' + (i ? ' class="n"' : '') + '>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody>' + (foot ? '<tfoot>' + foot + '</tfoot>' : '') + '</table></div>';
  const estTag = '<em class="kz-est">ước tính</em>';

  // ----- Biểu đồ SVG nhẹ, không phụ thuộc thư viện -----
  function lineChart(points, o) {
    const W = 320, H = 136, L = 10, R = 12, T = 28, B = 22;
    const vals = points.map(p => p.value).filter(v => v !== null && v !== undefined);
    if (vals.length < 2) return '<div class="kz-none">Chưa đủ dữ liệu</div>';
    let lo = Math.min(...vals, o.target), hi = Math.max(...vals, o.target);
    const pad = (hi - lo || Math.abs(hi) || 1) * 0.18; lo -= pad; hi += pad;
    const x = i => L + (W - L - R) * (i / (points.length - 1)), y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
    let path = '', pen = false;
    points.forEach((p, i) => { if (p.value === null || p.value === undefined) { pen = false; return; } path += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.value).toFixed(1); pen = true; });
    const dots = points.map((p, i) => p.value === null || p.value === undefined ? '' :
      '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(p.value).toFixed(1) + '" r="' + (i === points.length - 1 ? 4 : 2.6) + '" class="kz-dot' + (p.estimate ? ' est' : '') + '"><title>' + esc(p.label) + ': ' + o.fmt(p.value) + (p.estimate ? ' (ước tính)' : '') + '</title></circle>').join('');
    const last = points[points.length - 1], lastIdx = points.length - 1;
    const ticks = points.map((p, i) => (i === 0 || i === lastIdx || (i % 3 === 0 && i < lastIdx - 1)) ? '<text x="' + x(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + (i === 0 ? 'start' : i === lastIdx ? 'end' : 'middle') + '" class="kz-tick">' + esc(p.label) + '</text>' : '').join('');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="kz-svg" role="img" aria-label="' + esc(o.title) + '">' +
      '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(o.target).toFixed(1) + '" y2="' + y(o.target).toFixed(1) + '" class="kz-target"/>' +
      '<text x="' + L + '" y="9" text-anchor="start" class="kz-tick kz-tgt-label">┄ mục tiêu ' + o.fmt(o.target) + '</text>' +
      '<path d="' + path + '" class="kz-line"/>' + dots +
      (last.value !== null && last.value !== undefined ? '<text x="' + (x(lastIdx) - 6).toFixed(1) + '" y="' + (y(last.value) - 9).toFixed(1) + '" text-anchor="end" class="kz-val kz-val-last">' + o.fmt(last.value) + '</text>' : '') + ticks + '</svg>';
  }

  function barChart(trend) {
    const W = 920, H = 220, L = 34, R = 8, T = 26, B = 26;
    const max = Math.max(1, ...trend.map(t => Math.max(t.issued, t.approved)));
    const nice = Math.ceil(max / 50) * 50 || 50;
    const slot = (W - L - R) / trend.length, bw = Math.min(26, slot * 0.34);
    const y = v => T + (H - T - B) * (1 - v / nice);
    let svg = '';
    for (let g = 0; g <= 4; g++) { const v = nice * g / 4; svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" class="kz-grid"/><text x="' + (L - 6) + '" y="' + (y(v) + 3).toFixed(1) + '" text-anchor="end" class="kz-tick">' + Math.round(v) + '</text>'; }
    trend.forEach((t, i) => {
      const cx = L + slot * i + slot / 2;
      svg += '<rect x="' + (cx - bw - 1).toFixed(1) + '" y="' + y(t.issued).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0, y(0) - y(t.issued)).toFixed(1) + '" rx="3" class="kz-bar a"><title>' + esc(t.label) + ' · phát sinh ' + t.issued + '</title></rect>' +
        '<rect x="' + (cx + 1).toFixed(1) + '" y="' + y(t.approved).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0, y(0) - y(t.approved)).toFixed(1) + '" rx="3" class="kz-bar b"><title>' + esc(t.label) + ' · duyệt ' + t.approved + '</title></rect>' +
        '<text x="' + cx.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" class="kz-tick">' + esc(t.label) + '</text>';
      const lab = (v, x) => v > 0 ? '<text x="' + x.toFixed(1) + '" y="' + (y(v) - 4).toFixed(1) + '" text-anchor="middle" class="kz-val kz-val-bar' + (i === trend.length - 1 ? ' last' : '') + '">' + Math.round(v) + '</text>' : '';
      svg += lab(t.issued, cx - bw / 2 - 1) + lab(t.approved, cx + bw / 2 + 1);
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="kz-svg kz-svg-wide" role="img" aria-label="Hồ sơ phát sinh và hồ sơ duyệt theo tháng">' + svg + '</svg>' +
      '<div class="kz-legend"><span><i class="kz-sw a"></i>Phát sinh</span><span><i class="kz-sw b"></i>Duyệt</span></div>';
  }

  const hbars = (items, total) => items.map(b => {
    const pct = total > 0 ? b.count / total * 100 : 0;
    return '<div class="kz-hrow' + (b.excluded ? ' out' : '') + '"><span class="kz-hl">' + esc(b.label) + '</span><span class="kz-hbar"><i style="width:' + pct.toFixed(1) + '%"></i></span><b>' + fmt.fmtInt(b.count) + '</b><small>' + (total > 0 ? Math.round(pct) + '%' : '-') + '</small></div>';
  }).join('');

  // ----- Các khối -----
  function ledger(r) {
    const c = r.current, k = c.kpis;
    const names = {completion: 'Tỷ lệ hoàn thành zone', cost: 'CP bình quân', backlog: 'Tỉ lệ tồn hồ sơ'};
    const cards = k.rows.map(row => {
      const fill = row.score === null ? 0 : Math.min(1, row.score / row.weight) * 100;
      const over = row.score !== null && row.score > row.weight;
      const res = row.key === 'cost' ? fmt.fmtInt(row.result) : fmt.fmtPct(row.result, row.key === 'completion' ? 2 : 2);
      const tgt = row.key === 'cost' ? fmt.fmtInt(row.target) : fmt.fmtPct(row.target, 0);
      const state = row.pass === null ? '' : row.pass ? 'ok' : 'miss';
      const badge = row.pass === null ? '' : '<em class="kz-state ' + state + '">' + (row.pass ? 'Đạt' : 'Chưa đạt') + '</em>';
      return '<article class="kz-kpi ' + state + '"><header><span class="kz-kpi-name">' + names[row.key] + '</span><span class="kz-kpi-w">' + Math.round(row.weight * 100) + '%</span></header>' +
        '<div class="kz-kpi-val"><b>' + res + '</b>' + badge + '</div>' +
        '<div class="kz-kpi-tgt">Mục tiêu ' + (row.key === 'completion' ? '≥' : '≤') + ' ' + tgt + '</div>' +
        '<div class="kz-track"><i style="width:' + fill.toFixed(1) + '%"></i></div>' +
        '<footer><span>Điểm <b>' + fmt.fmtScore(row.score) + '</b> / ' + String(row.weight).replace('.', ',') + '</span>' +
        (over ? '<span class="kz-cut" title="Phần vượt tỷ trọng bị cắt">cắt +' + dec(row.score - row.weight, 4) + '</span>' : '') + '</footer></article>';
    }).join('');
    return '<section class="kz-ledger" data-kz-title="Tong-KPI"><button type="button" class="kz-img kz-img-dark" data-kz-img title="Tải ảnh khối này về máy" aria-label="Tải ảnh về máy"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg><span>Tải ảnh</span></button><div class="kz-ledger-main"><span class="kz-ledger-title">Tổng KPI ' + label(c) + (c.estimate ? ' ' + estTag : '') + '</span>' +
      '<div class="kz-big"><b>' + fmt.fmtPct(k.uncapped, 2) + '</b></div>' +
      '<div class="kz-ledger-sub"><span>Điểm chưa giới hạn <b>' + fmt.fmtScore(k.uncapped) + '</b></span>' +
      '<span>Có giới hạn tỷ trọng <b>' + fmt.fmtPct(k.capped, 2) + '</b> <small>(' + fmt.fmtScore(k.capped) + ' / 1,0000)</small></span>' +
      '<span class="kz-vs">so với ' + label(r.previous) + ' ' + delta(r.compare.uncapped, 'score') + '</span></div></div>' +
      '<div class="kz-kpis">' + cards + '</div></section>';
  }

  function insightsBlock(r) {
    const icon = {good: '✓', warn: '!', bad: '✕', info: 'i'};
    return block('Nhận định', '<ul class="kz-insights">' + r.insights.map(x => '<li class="' + x.tone + '"><span class="kz-ic" aria-hidden="true">' + icon[x.tone] + '</span><div><b>' + esc(x.title) + '</b><p>' + esc(x.text) + '</p></div></li>').join('') + '</ul>', '', 'kz-insight-card');
  }

  function needBlock(r) {
    const c = r.current, t = c.totals, a = c.analysis, p = c.pace;
    const pctDone = c.target > 0 ? Math.min(100, t.approved / c.target * 100) : 0;
    const done = c.needMore === 0 && t.issued > 0;
    let rows = '<div class="kz-need-num ' + (done ? 'ok' : 'miss') + '"><b>' + (done ? 'Đạt' : fmt.fmtInt(c.needMore)) + '</b><span>' + (done ? 'mục tiêu duyệt 90%' : 'hồ sơ cần duyệt thêm để đạt 90%') + '</span></div>' +
      '<div class="kz-progress" aria-label="Tiến độ duyệt"><i style="width:' + pctDone.toFixed(1) + '%"></i></div>' +
      '<div class="kz-progress-note"><span>Đã duyệt ' + fmt.fmtInt(t.approved) + '</span><span>Cần ' + fmt.fmtInt(c.target) + ' (90% × ' + fmt.fmtInt(t.issued) + ')</span></div><dl class="kz-dl">';
    if (p) rows += '<div><dt>Còn lại trong tháng</dt><dd>' + p.left + ' ngày</dd></div>' +
      (p.requiredPerDay !== null && !done ? '<div><dt>Cần duyệt mỗi ngày</dt><dd>' + dec(p.requiredPerDay) + '</dd></div>' : '') +
      '<div><dt>Nhịp duyệt hiện tại</dt><dd>' + dec(p.perDayApproved) + ' / ngày</dd></div>' +
      '<div><dt>Dự kiến cuối tháng</dt><dd>' + fmt.fmtPct(p.projCompletion) + '</dd></div>';
    if (a.marginalApproval > 0) rows += '<div><dt>Mỗi hồ sơ duyệt thêm</dt><dd>+' + dec(a.marginalApproval, 4) + ' điểm</dd></div>';
    if (a.backlogHeadroom !== null) rows += '<div><dt>Dư địa tồn (tới 10%)</dt><dd class="' + (a.backlogHeadroom >= 0 ? '' : 'bad') + '">' + (a.backlogHeadroom >= 0 ? '+' : '') + fmt.fmtInt(a.backlogHeadroom) + ' hồ sơ</dd></div>';
    if (a.costGap !== null) rows += '<div><dt>CP so với mục tiêu</dt><dd class="' + (a.costGap > 0 ? 'bad' : '') + '">' + (a.costGap > 0 ? '+' : '') + fmt.fmtInt(a.costGap) + ' đ</dd></div>';
    return block('Cần gì để đạt mục tiêu', rows + '</dl>', '', 'kz-need-card');
  }

  // ----- Dự báo cuối tháng (kpi-zone-forecast.js) -----
  function forecastBlock(r) {
    const f = typeof KpiZoneForecast !== 'undefined' ? KpiZoneForecast.build(r.current, KpiZoneCalc) : null;
    if (!f) return '';
    const pr = f.projected, tone = f.verdict.key;
    const cur = {completion: r.current.totals.completion, cost: r.current.totals.cost, backlog: r.current.totals.backlogRate};
    const show = {completion: v => fmt.fmtPct(v, 1), cost: v => v === null ? '-' : fmt.fmtInt(v) + ' đ', backlog: v => fmt.fmtPct(v, 2)};
    const kpiRows = pr.rows.map(k => '<li class="' + (k.pass === null ? '' : k.pass ? 'ok' : 'miss') + '"><span class="kz-fc-k">' + esc(k.label) + '<small>Mục tiêu ' + (k.key === 'completion' ? '≥ 90%' : k.key === 'cost' ? '≤ 3.500.000 đ' : '≤ 10%') + '</small></span>' +
      '<span class="kz-fc-v"><s>' + show[k.key](cur[k.key]) + '</s><i aria-hidden="true">→</i><b>' + show[k.key](k.result) + '</b></span>' +
      '<span class="kz-fc-s">' + (k.pass === null ? 'Chưa đủ dữ liệu' : k.pass ? 'Đạt' : 'Chưa đạt') + '</span></li>').join('');
    const delta = f.delta.uncapped, up = delta >= 0;
    const drivers = f.drivers.length ? table(['GĐV', 'Phát sinh', 'Đã duyệt', 'Tỷ lệ', 'So với 90%', 'Chưa duyệt (tháng)', 'Tồn > 30 ngày'],
      f.drivers.map(g => '<tr><td>' + esc(g.gdv) + '</td><td class="n">' + fmt.fmtInt(g.issued) + '</td><td class="n">' + fmt.fmtInt(g.approved) + '</td><td class="n">' + fmt.fmtPct(g.completion, 1) + '</td>' +
        '<td class="n ' + (g.gap > 0 ? 'bad' : 'good') + '">' + (g.issued ? (g.gap > 0 ? 'thiếu ' + g.gap : g.gap < 0 ? 'dư ' + (-g.gap) : 'đủ') : '-') + '</td><td class="n">' + fmt.fmtInt(g.unapproved) + '</td><td class="n">' + (g.tonOver30 ? '<span class="bad">' + g.tonOver30 + '</span>' : '0') + '</td></tr>')
        .join('')) : '';
    const body = '<div class="kz-fc ' + tone + '">' +
      '<div class="kz-fc-hero"><span class="kz-fc-pill ' + tone + '">' + esc(f.verdict.label) + '</span>' +
      '<div class="kz-fc-score"><b>' + fmt.fmtPct(pr.uncapped, 2) + '</b><span>điểm KPI dự kiến cuối tháng</span></div>' +
      '<div class="kz-fc-sub"><span>Có giới hạn <b>' + fmt.fmtPct(pr.capped, 1) + '</b></span><span class="' + (up ? 'good' : 'bad') + '">' + (up ? '▲ ' : '▼ ') + dec(Math.abs(delta) * 100) + ' đ.% so với hiện tại</span></div>' +
      '<div class="kz-fc-days"><i style="width:' + Math.min(100, f.asOfElapsed / f.daysInMonth * 100).toFixed(0) + '%"></i></div><small>Ngày ' + f.asOfElapsed + '/' + f.daysInMonth + ' · còn ' + f.daysLeft + ' ngày</small></div>' +
      '<div class="kz-fc-main"><ul class="kz-fc-rows">' + kpiRows + '</ul>' +
      '<ul class="kz-fc-actions">' + f.actions.map(a => '<li class="' + a.tone + '">' + esc(a.text) + '</li>').join('') + '</ul></div></div>' + drivers +
      '<p class="kz-note">Dự báo giả định giữ nguyên nhịp mở/duyệt hồ sơ trung bình từ đầu tháng (' + dec(r.current.pace.perDayIssued) + ' mở · ' + dec(r.current.pace.perDayApproved) + ' duyệt mỗi ngày) và CP bình quân như hiện tại.' +
      (f.lowConfidence ? ' <b>Mới ' + f.asOfElapsed + ' ngày dữ liệu nên độ tin cậy còn thấp.</b>' : '') + '</p>';
    return block('Dự báo cuối tháng <em class="kz-est">giả định giữ nhịp hiện tại</em>', body, '', 'kz-fc-card');
  }

  function trendBlock(r) {
    const tr = r.trend.filter(t => !t.futureMonth);
    if (tr.length < 2) return '';
    const series = (get, fmtFn, target, title, extra) => '<div class="kz-mini"><h3>' + title + (extra || '') + '</h3>' + lineChart(tr.map(t => ({label: t.label, value: get(t), estimate: t.estimate})), {target, fmt: fmtFn, title}) + '</div>';
    return block('Xu hướng ' + tr.length + ' tháng gần nhất', barChart(tr) +
      '<div class="kz-minis">' +
      series(t => t.completion, v => fmt.fmtPct(v, 0), 0.9, 'Tỷ lệ hoàn thành') +
      series(t => t.cost, v => v >= 1e6 ? dec(v / 1e6, 2) + ' tr' : fmt.fmtInt(v), 3500000, 'CP bình quân') +
      series(t => t.backlogRate, v => fmt.fmtPct(v, 1), 0.1, 'Tỉ lệ tồn', '<small>chấm rỗng = ước tính</small>') +
      series(t => t.capped, v => dec(v, 2), 0.9, 'Điểm có giới hạn') + '</div>');
  }

  function gdvBlock(r) {
    const c = r.current, t = c.totals;
    const bar = v => v === null ? '<span class="kz-none">-</span>' : '<div class="kz-meter"><i class="' + (v >= 0.9 ? 'ok' : 'miss') + '" style="width:' + Math.min(100, v / 1.2 * 100).toFixed(1) + '%"></i><u style="left:' + (0.9 / 1.2 * 100).toFixed(1) + '%"></u></div><span>' + fmt.fmtPct(v) + '</span>';
    const rows = c.perGdv.map(g => '<tr><td>' + esc(g.gdv) + '</td><td class="n">' + fmt.fmtInt(g.issued) + '</td><td class="n">' + fmt.fmtInt(g.approved) + '</td><td class="n kz-meter-cell">' + bar(g.completion) + '</td>' +
      '<td class="n ' + (g.gap > 0 ? 'bad' : 'good') + '">' + (g.issued ? (g.gap > 0 ? 'thiếu ' + g.gap : g.gap < 0 ? 'dư ' + (-g.gap) : 'đủ') : '-') + '</td>' +
      '<td class="n">' + fmt.fmtInt(g.cost) + '</td><td class="n">' + fmt.fmtInt(g.ton) + '</td><td class="n">' + (g.tonOver30 ? '<span class="bad">' + g.tonOver30 + '</span>' : '0') + '</td><td class="n">' + fmt.fmtPct(g.backlogRate, 2) + '</td><td class="n">' + (g.lead.median === null ? '-' : g.lead.median.toFixed(0) + ' ngày') + '</td></tr>').join('');
    const foot = '<tr class="tot"><td>Tổng</td><td class="n">' + fmt.fmtInt(t.issued) + '</td><td class="n">' + fmt.fmtInt(t.approved) + '</td><td class="n">' + fmt.fmtPct(t.completion) + '</td><td class="n">' + (c.needMore > 0 ? 'thiếu ' + c.needMore : 'đủ') + '</td><td class="n">' + fmt.fmtInt(t.cost) + '</td><td class="n">' + fmt.fmtInt(t.ton) + '</td><td class="n">' + fmt.fmtInt(c.analysis.tonOver30) + '</td><td class="n">' + fmt.fmtPct(t.backlogRate, 2) + '</td><td class="n">' + (c.analysis.lead.median === null ? '-' : c.analysis.lead.median.toFixed(0) + ' ngày') + '</td></tr>';
    return block('Theo từng GĐV ' + (c.estimate ? estTag : ''), table(['GĐV', 'HS phát sinh', 'HS duyệt', 'Tỷ lệ hoàn thành', 'So với 90%', 'CP bình quân', 'Tồn lũy kế', 'Tồn > 30 ngày', 'Tỉ lệ tồn', 'Xử lý (trung vị)'], rows, foot, 'kz-gdvtable') +
      '<p class="kz-note">Vạch trên thanh là mức 90%. “Thiếu/dư” tính theo hồ sơ phát sinh của từng GĐV; KPI tính gộp nên GĐV dư bù được cho GĐV thiếu.</p>');
  }

  function costLeadBlock(r) {
    const c = r.current, a = c.analysis, t = c.totals;
    const costNote = '<p class="kz-note">Trung bình <b>' + fmt.fmtInt(t.cost) + '</b> đ · trung vị <b>' + fmt.fmtInt(a.cost.median) + '</b> đ · cao nhất trong mẫu <b>' + fmt.fmtInt(a.cost.max) + '</b> đ · mục tiêu ' + fmt.fmtInt(3500000) + ' đ. Nhóm “từ 10 triệu” bị loại khỏi trung bình.</p>';
    const leadNote = a.lead.n ? '<p class="kz-note">Trung bình <b>' + dec(a.lead.mean) + '</b> ngày · trung vị <b>' + a.lead.median.toFixed(0) + '</b> · 9/10 hồ sơ xong trong <b>' + a.lead.p90.toFixed(0) + '</b> ngày · lâu nhất <b>' + a.lead.max + '</b> ngày.</p>' : '';
    return '<div class="kz-pair">' +
      block('Chi phí hồ sơ phát sinh trong tháng', '<div class="kz-hist">' + hbars(a.cost.buckets, t.issued) + '</div>' + costNote) +
      block('Thời gian từ mở tới duyệt', a.lead.n ? '<div class="kz-hist">' + hbars(a.lead.buckets, a.lead.n) + '</div>' + leadNote : '<div class="kz-none">Chưa có hồ sơ duyệt trong tháng</div>') + '</div>';
  }

  function backlogBlock(r) {
    const c = r.current;
    const max = Math.max(1, ...c.perGdv.flatMap(g => g.ages.map(b => b.count)));
    const head = '<tr><th>GĐV</th>' + K.AGE_BUCKETS.map(b => '<th class="n">' + b.label + '</th>').join('') + '<th class="n">Tổng</th></tr>';
    const rows = c.perGdv.map(g => '<tr><td>' + esc(g.gdv) + '</td>' + g.ages.map((b, i) => '<td class="n kz-heat" style="--h:' + (b.count / max).toFixed(2) + '"><span class="' + (i === 4 && b.count ? 'late' : '') + '">' + (b.count || '·') + '</span></td>').join('') + '<td class="n"><b>' + g.ton + '</b></td></tr>').join('');
    const st = c.byStatus.map(s => ({label: s.status, count: s.count}));
    return '<div class="kz-pair">' + block('Tồn lũy kế theo tuổi và GĐV ' + (c.estimate ? estTag : ''), '<div class="kz-tablewrap"><table class="kz-table kz-heatmap"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div><p class="kz-note">Tuổi tính từ ngày mở hồ sơ tới ' + (c.estimate ? 'cuối tháng' : 'ngày dữ liệu') + '. Ô càng đậm càng nhiều hồ sơ.</p>') +
      block('Tồn theo trạng thái', st.length ? '<div class="kz-hist">' + hbars(st, c.totals.ton) + '</div>' : '<div class="kz-none">Không có hồ sơ tồn</div>') + '</div>';
  }

  function compareBlock(r) {
    const c = r.current, p = r.previous, t = c.totals, pt = p.totals;
    const row = (name, a, b, d) => '<tr><td>' + name + '</td><td class="n">' + a + '</td><td class="n">' + b + '</td><td class="n">' + d + '</td></tr>';
    const rows = row('HS phát sinh', fmt.fmtInt(pt.issued), fmt.fmtInt(t.issued), delta(r.compare.issued)) + row('HS duyệt', fmt.fmtInt(pt.approved), fmt.fmtInt(t.approved), delta(r.compare.approved)) +
      row('Tỷ lệ hoàn thành', fmt.fmtPct(pt.completion), fmt.fmtPct(t.completion), delta(r.compare.completion, 'pct')) +
      row('CP bình quân', fmt.fmtInt(pt.cost), fmt.fmtInt(t.cost), delta(r.compare.cost, 'int', true)) +
      row('Tồn lũy kế' + (p.estimate ? ' (kỳ trước ước tính)' : ''), fmt.fmtInt(pt.ton), fmt.fmtInt(t.ton), delta(r.compare.ton, 'int', true)) +
      row('Tỉ lệ tồn', fmt.fmtPct(pt.backlogRate, 2), fmt.fmtPct(t.backlogRate, 2), delta(r.compare.backlogRate, 'pct', true)) +
      row('Tổng điểm chưa giới hạn', fmt.fmtScore(p.kpis.uncapped), fmt.fmtScore(c.kpis.uncapped), delta(r.compare.uncapped, 'score')) +
      row('Tổng điểm có giới hạn', fmt.fmtScore(p.kpis.capped), fmt.fmtScore(c.kpis.capped), delta(r.compare.capped, 'score'));
    const kpiRows = c.kpis.rows.map(k => '<tr class="' + (k.pass === null ? '' : k.pass ? 'pass' : 'fail') + '"><td>' + esc(k.label) + '</td><td class="n">' + String(k.weight).replace('.', ',') + '</td><td class="n">' + (k.key === 'cost' ? fmt.fmtInt(k.target) : fmt.fmtPct(k.target, 0)) + '</td><td class="n">' + (k.key === 'cost' ? fmt.fmtInt(k.result) : fmt.fmtPct(k.result, 2)) + '</td><td class="n">' + fmt.fmtScore(k.score) + '</td><td class="n">' + fmt.fmtScore(k.shortfall) + '</td></tr>').join('');
    return '<div class="kz-pair">' + block('Bảng điểm ' + label(c) + (c.estimate ? ' ' + estTag : ''), table(['Nhóm KPI', 'Tỷ trọng', 'Mục tiêu', 'Kết quả', 'Điểm', 'Điểm hụt'], kpiRows,
      '<tr class="tot"><td>Tổng</td><td class="n">1</td><td></td><td></td><td class="n">' + fmt.fmtScore(c.kpis.uncapped) + ' / ' + fmt.fmtScore(c.kpis.capped) + '</td><td class="n">' + fmt.fmtScore(c.kpis.rows.reduce((x, k) => x + (k.shortfall || 0), 0)) + '</td></tr>') +
      '<p class="kz-note">Điểm hụt = tỷ trọng − min(điểm, tỷ trọng). Hai số ở dòng Tổng là chưa giới hạn / có giới hạn. CP lấy mẫu ' + fmt.fmtInt(t.sample) + ' hồ sơ, loại ' + fmt.fmtInt(t.excluded) + '.</p>') +
      block('So với ' + label(p) + (p.estimate ? ' ' + estTag : ''), table(['Chỉ tiêu', label(p), label(c), 'Chênh lệch'], rows)) + '</div>';
  }

  const listRow = x => '<tr><td>' + esc(x.id) + '</td><td>' + esc(x.gdv) + '</td><td>' + esc(x.status || '(trống)') + '</td><td class="n">' + fmt.fmtDate(x.open) + '</td><td class="n' + (x.days > 30 ? ' kz-late' : '') + '">' + x.days + '</td><td class="n">' + fmt.fmtInt(x.damage) + '</td></tr>';
  const LIST_HEADS = ['Số hồ sơ', 'GĐV', 'Trạng thái', 'Ngày mở', 'Số ngày', 'Ước thiệt hại'];
  function filteredUnapproved(c) {
    const list = c.unapproved.filter(x => (!listFilter.gdv || x.gdv === listFilter.gdv) && (!listFilter.status || (x.status || '(trống)') === listFilter.status));
    return listFilter.sort === 'asc' ? [...list].reverse() : list;
  }
  function unapprovedBlock(c) {
    const gdvs = [...new Set(c.unapproved.map(x => x.gdv))], statuses = [...new Set(c.unapproved.map(x => x.status || '(trống)'))];
    const opt = (list, value) => '<option value="">Tất cả</option>' + list.map(x => '<option' + (x === value ? ' selected' : '') + '>' + esc(x) + '</option>').join('');
    const dd = (attr, prefix, icon, title, inner) => '<select ' + attr + ' data-kz-dd data-kz-icon="' + icon + '" data-kz-prefix="' + prefix + '" data-kz-title="' + title + '" aria-label="' + title + '">' + inner + '</select>';
    const sortOpts = '<option value="desc"' + (listFilter.sort === 'desc' ? ' selected' : '') + '>Số ngày giảm dần</option><option value="asc"' + (listFilter.sort === 'asc' ? ' selected' : '') + '>Số ngày tăng dần</option>';
    const filters = '<div class="kz-filters">' + dd('data-kz-fgdv', 'GĐV', 'user', 'Giám định viên', opt(gdvs, listFilter.gdv)) + dd('data-kz-fstatus', 'Trạng thái', 'doc', 'Trạng thái hồ sơ', opt(statuses, listFilter.status)) +
      dd('data-kz-fsort', 'Sắp xếp', 'sort', 'Sắp xếp theo', sortOpts) + '</div>';
    return block('Hồ sơ mở trong tháng, chưa duyệt (' + fmt.fmtInt(c.unapproved.length) + ')', filters + '<div class="kz-scroll" data-kz-list>' + table(LIST_HEADS, filteredUnapproved(c).map(listRow).join('') || '<tr><td colspan="6" class="kz-none">Không có hồ sơ</td></tr>') + '</div>');
  }

  function view(r) {
    const c = r.current;
    const warn = c.futureMonth ? '<div class="kz-msg warn">Tháng này sau ngày dữ liệu (' + fmt.fmtDate(prep.asOf) + ') nên chưa có số liệu.</div>' : '';
    return warn + ledger(r) + forecastBlock(r) + '<div class="kz-split">' + insightsBlock(r) + needBlock(r) + '</div>' + bnBlock(r) + trendBlock(r) + gdvBlock(r) + costLeadBlock(r) + backlogBlock(r) + compareBlock(r) + unapprovedBlock(c);
  }

  // ----- Khung + điều khiển -----
  function shell() {
    return '<div class="kz-bar-top"><div class="kz-stepper" role="group" aria-label="Chọn tháng">' +
      '<button type="button" class="sf-button" data-kz-step="-1" aria-label="Tháng trước">‹</button>' +
      '<div class="kz-month"><select data-kz-month data-kz-dd data-kz-icon="calendar" data-kz-title="Tháng báo cáo" aria-label="Tháng báo cáo"></select></div>' +
      '<button type="button" class="sf-button" data-kz-step="1" aria-label="Tháng sau">›</button></div>' +
      '<div class="kz-source" data-kz-meta></div>' +
      '<button type="button" class="sf-button kz-export" data-kz-export disabled>Xuất Excel</button></div>' +
      '<div data-kz-gdvs class="kz-gdvs"></div><details class="kz-zones" data-kz-zones hidden></details><div data-kz-msg class="kz-msg" role="status"></div><div data-kz-body></div>';
  }

  function paintMeta() {
    host.querySelector('[data-kz-meta]').innerHTML = prep && prep.records.length
      ? '<b>Hồ sơ bồi thường trong hệ thống</b><span>Dữ liệu đến ' + fmt.fmtDate(prep.asOf) + ' · ' + prep.records.length.toLocaleString('vi-VN') + '/' + prep.total.toLocaleString('vi-VN') + ' hồ sơ có Ngày mở HS</span>'
      : '<b>Chưa có hồ sơ</b>';
    host.querySelector('[data-kz-export]').disabled = !report;
  }

  function paintGdvs() {
    const box = host.querySelector('[data-kz-gdvs]');
    if (!prep || !prep.records.length) { box.innerHTML = ''; return; }
    const picked = new Set(selected.map(K.nameKey));
    box.innerHTML = '<span class="kz-label" title="Dùng cho hồ sơ chưa có Zone BT map">GĐV (khi hồ sơ chưa có Zone BT map)</span>' + K.listGdvs(prep.records).map(item =>
      '<label class="kz-chip"><input type="checkbox" data-kz-gdv value="' + esc(item.name) + '"' + (picked.has(K.nameKey(item.name)) ? ' checked' : '') + '><span>' + esc(item.name) + ' <small>' + item.count + '</small></span></label>').join('');
  }

  // Bảng gán Zone BT map: ưu tiên Zone BT map, sau đó mới theo GĐV.
  function paintZones() {
    const box = host.querySelector('[data-kz-zones]');
    if (!prep || !prep.records.length) { box.hidden = true; return; }
    const zones = K.listZones(prep.records, selected);
    const mapped = zones.filter(z => zoneMap[z.key]).length;
    const sc = report ? report.current.scope : null;
    const wasOpen = box.open;
    box.hidden = false;
    box.innerHTML = '<summary><b>Zone BT map</b><span>' + (mapped ? mapped + '/' + zones.length + ' zone đã gán' : 'chưa gán: đang tính theo GĐV') + '</span>' +
      (sc ? '<small>Hồ sơ phát sinh trong năm: ' + fmt.fmtInt(sc.zone) + ' theo Zone map · ' + fmt.fmtInt(sc.gdv) + ' theo GĐV · ' + fmt.fmtInt(sc.out) + ' ngoài zone</small>' : '') + '</summary>' +
      '<div class="kz-zbody"><p class="kz-note">Cột “Zone bồi thường” của từng hồ sơ được xét trước: gán “Thuộc zone báo cáo” thì hồ sơ được tính dù GĐV nào xử lý, gán “Zone khác” thì bị loại dù GĐV là ai. Hồ sơ không có Zone bồi thường hoặc chưa gán thì xét theo GĐV đã chọn.</p>' +
      '<div class="kz-tablewrap"><table class="kz-table"><thead><tr><th>Zone bồi thường</th><th class="n">Số hồ sơ</th><th class="n">Do GĐV đã chọn xử lý</th><th>Gán</th></tr></thead><tbody>' +
      zones.map(z => '<tr><td>' + esc(z.name) + '</td><td class="n">' + fmt.fmtInt(z.count) + '</td><td class="n">' + fmt.fmtInt(z.byGdvs) + '</td><td>' + (z.key ? '<select data-kz-zone="' + esc(z.key) + '" data-kz-dd data-kz-icon="pin" data-kz-title="Gán zone ' + esc(z.name) + '" aria-label="Gán zone ' + esc(z.name) + '"><option value="">Theo GĐV (chưa gán)</option><option value="in"' + (zoneMap[z.key] === 'in' ? ' selected' : '') + '>Thuộc zone báo cáo</option><option value="out"' + (zoneMap[z.key] === 'out' ? ' selected' : '') + '>Zone khác</option></select>' : '<span class="kz-none">luôn theo GĐV</span>') + '</td></tr>').join('') + '</tbody></table></div></div>';
    box.open = wasOpen; enhanceDropdowns(box);
  }

  function message(text, kind) {
    const el = host.querySelector('[data-kz-msg]');
    el.className = 'kz-msg' + (kind ? ' ' + kind : '');
    el.innerHTML = text || '';
  }

  function warningText(w) {
    const parts = [];
    if (w.noId) parts.push(w.noId + ' hồ sơ thiếu số hồ sơ');
    if (w.duplicate) parts.push(w.duplicate + ' hồ sơ trùng số (giữ hồ sơ đầu)');
    if (w.noOpen) parts.push(w.noOpen + ' hồ sơ không có Ngày mở HS');
    if (w.badOpen) parts.push(w.badOpen + ' hồ sơ có Ngày mở HS không đọc được');
    if (w.badApprove) parts.push(w.badApprove + ' hồ sơ có ngày duyệt không đọc được (coi như chưa duyệt)');
    if (w.badMoney) parts.push(w.badMoney + ' hồ sơ có số tiền không đọc được (coi như 0)');
    if (w.unknownStatus.length) parts.push('trạng thái lạ: ' + w.unknownStatus.map(esc).join(', '));
    return parts.length ? 'Không tính hoặc cần lưu ý: ' + parts.join('; ') + '.' : '';
  }

  function recalc() {
    const body = host.querySelector('[data-kz-body]');
    report = null;
    if (!prep || !prep.records.length) { body.innerHTML = '<div class="kz-empty">Chưa có hồ sơ bồi thường nào có Ngày mở HS. Nhập hồ sơ từ Excel B001 ở trang Hồ sơ bồi thường để xem báo cáo.</div>'; paintMeta(); return; }
    const [year, month] = monthValue.split('-').map(Number);
    if (!year || !month) { body.innerHTML = '<div class="kz-empty">Chọn tháng cần xem.</div>'; paintMeta(); return; }
    try {
      report = K.computeReport(prep.records, {year, month, gdvs: selected, zoneMap, asOf: prep.asOf});
      body.innerHTML = view(report);
    } catch (error) {
      console.error(error);
      body.innerHTML = '<div class="kz-empty kz-bad">Không tính được báo cáo: ' + esc(error.message) + '</div>';
    }
    enhanceDropdowns(body); paintMeta(); paintZones();
  }

  function loadClaims() {
    const statusMap = typeof PENDING_STATUS_MAP !== 'undefined' ? PENDING_STATUS_MAP : {};
    prep = K.fromClaims(typeof cachedPendingClaimsPayload !== 'undefined' ? cachedPendingClaimsPayload : {}, statusMap);
    const known = K.listGdvs(prep.records).map(x => x.name);
    if (selected) selected = selected.filter(n => known.some(k => K.nameKey(k) === K.nameKey(n)));
    if (!selected || !selected.length) {
      selected = known.filter(n => K.DEFAULT_GDVS.map(K.nameKey).includes(K.nameKey(n)));
      if (!selected.length) selected = [...K.DEFAULT_GDVS];
    }
    const warn = warningText(prep.warnings);
    message(warn ? esc(warn) : '', warn ? 'warn' : '');
  }

  // ----- Xuất Excel -----
  async function exportExcel() {
    if (!report) return;
    try {
      const XLSX = await loadXlsx();
      const c = report.current, p = report.previous, t = c.totals, a = c.analysis;
      const book = XLSX.utils.book_new();
      const sheet = (name, aoa, widths) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = widths.map(w => ({wch: w})); XLSX.utils.book_append_sheet(book, ws, name); };
      sheet('KPI', [['Báo cáo KPI bồi thường ' + label(c) + (c.estimate ? ' (tồn ước tính)' : '')], ['Dữ liệu đến ngày', fmt.fmtDate(prep.asOf)], ['Cách gán hồ sơ (phát sinh trong năm)', 'Theo Zone map: ' + c.scope.zone + ' · theo GĐV: ' + c.scope.gdv + ' · ngoài zone: ' + c.scope.out], [],
        ['Nhóm KPI', 'Tỷ trọng', 'Mục tiêu', 'Kết quả', 'Điểm', 'Điểm sau giới hạn', 'Điểm hụt'],
        ...c.kpis.rows.map(k => [k.label, k.weight, k.target, k.result ?? '-', k.score ?? '-', k.cappedScore ?? '-', k.shortfall ?? '-']),
        ['Tổng', 1, '', '', c.kpis.uncapped, c.kpis.capped, '']], [34, 10, 14, 14, 12, 18, 12]);
      sheet('Theo GĐV', [['GĐV', 'HS phát sinh', 'HS duyệt', 'Tỷ lệ hoàn thành', 'Thiếu(+)/dư(-) so với 90%', 'CP bình quân', 'Tồn lũy kế', 'Tồn > 30 ngày', 'HS phát sinh từ 01/01', 'Tỉ lệ tồn', 'Mở trong tháng chưa duyệt', 'Xử lý trung vị (ngày)'],
        ...c.perGdv.map(g => [g.gdv, g.issued, g.approved, g.completion ?? '-', g.gap, g.cost ?? '-', g.ton, g.tonOver30, g.ytd, g.backlogRate ?? '-', g.unapproved, g.lead.median ?? '-']),
        ['Tổng', t.issued, t.approved, t.completion ?? '-', c.needMore, t.cost ?? '-', t.ton, a.tonOver30, t.ytd, t.backlogRate ?? '-', c.unapproved.length, a.lead.median ?? '-']], [28, 14, 12, 16, 22, 14, 12, 14, 20, 10, 24, 20]);
      sheet('So sánh', [['Chỉ tiêu', label(p), label(c), 'Chênh lệch'],
        ['HS phát sinh', p.totals.issued, t.issued, report.compare.issued], ['HS duyệt', p.totals.approved, t.approved, report.compare.approved],
        ['Tỷ lệ hoàn thành', p.totals.completion ?? '-', t.completion ?? '-', report.compare.completion ?? '-'], ['CP bình quân', p.totals.cost ?? '-', t.cost ?? '-', report.compare.cost ?? '-'],
        ['Tồn lũy kế', p.totals.ton, t.ton, report.compare.ton], ['Tỉ lệ tồn', p.totals.backlogRate ?? '-', t.backlogRate ?? '-', report.compare.backlogRate ?? '-'],
        ['Tổng điểm chưa giới hạn', p.kpis.uncapped, c.kpis.uncapped, report.compare.uncapped], ['Tổng điểm đã giới hạn', p.kpis.capped, c.kpis.capped, report.compare.capped],
        [], ['Cần duyệt thêm để đạt 90%', c.needMore, 'Cần', c.target]], [30, 16, 16, 16]);
      sheet('Xu hướng', [['Tháng', 'Ước tính', 'HS phát sinh', 'HS duyệt', 'Tỷ lệ hoàn thành', 'CP bình quân', 'Tồn lũy kế', 'Tỉ lệ tồn', 'Điểm chưa giới hạn', 'Điểm có giới hạn'],
        ...report.trend.filter(x => !x.futureMonth).map(x => ['T' + x.month + '.' + x.year, x.estimate ? 'có' : '', x.issued, x.approved, x.completion ?? '-', x.cost ?? '-', x.ton, x.backlogRate ?? '-', x.uncapped, x.capped])], [12, 10, 14, 12, 16, 14, 12, 12, 18, 18]);
      if (BN) { const rowsBn = bnRows(report); if (rowsBn.length) XLSX.utils.book_append_sheet(book, bnSheet(XLSX, rowsBn, c), 'Điểm nghẽn'); }
      sheet('Phân tích', [['Nhận định'], ...report.insights.map(x => [x.title, x.text]), [],
        ['Chi phí hồ sơ phát sinh', 'Số hồ sơ'], ...a.cost.buckets.map(b => [b.label, b.count]), [],
        ['Thời gian từ mở tới duyệt', 'Số hồ sơ'], ...a.lead.buckets.map(b => [b.label, b.count]), [],
        ['Tồn theo tuổi', ...K.AGE_BUCKETS.map(b => b.label)], ...c.perGdv.map(g => [g.gdv, ...g.ages.map(b => b.count)]), [],
        ['Tồn theo trạng thái', 'Số hồ sơ'], ...c.byStatus.map(s => [s.status, s.count])], [40, 90, 14, 14, 14, 14, 14]);
      sheet('HS chưa duyệt', [LIST_HEADS, ...filteredUnapproved(c).map(x => [x.id, x.gdv, x.status, fmt.fmtDate(x.open), x.days, x.damage])], [24, 26, 20, 12, 10, 16]);
      XLSX.writeFile(book, 'KPI-boi-thuong-T' + c.month + '-' + c.year + '.xlsx');
    } catch (error) {
      console.error(error);
      message('Không xuất được Excel: ' + esc(error.message), 'bad');
    }
  }

  // ----- Vòng đời -----
  function mount(container) {
    leave();
    host = document.createElement('section');
    host.className = 'sf-workspace kz-workspace';
    host.setAttribute('aria-label', 'Báo cáo KPI bồi thường');
    host.innerHTML = shell();
    host.addEventListener('change', event => {
      const el = event.target;
      if (el.matches('[data-kz-zone]')) {
        if (el.value) zoneMap[el.dataset.kzZone] = el.value; else delete zoneMap[el.dataset.kzZone];
        saveZoneMap(); recalc();
      } else if (el.matches('[data-kz-month]')) { monthValue = el.value || defaultMonth(); monthTouched = true; recalc(); }
      else if (el.matches('[data-kz-gdv]')) {
        selected = [...host.querySelectorAll('[data-kz-gdv]:checked')].map(x => x.value);
        if (!selected.length) { el.checked = true; selected = [el.value]; message('Cần chọn ít nhất một GĐV.', 'warn'); }
        recalc();
      } else if (el.matches('[data-kz-fgdv],[data-kz-fstatus],[data-kz-fsort]')) {
        listFilter = {gdv: host.querySelector('[data-kz-fgdv]').value, status: host.querySelector('[data-kz-fstatus]').value, sort: host.querySelector('[data-kz-fsort]').value};
        if (report) host.querySelector('[data-kz-list]').innerHTML = table(LIST_HEADS, filteredUnapproved(report.current).map(listRow).join('') || '<tr><td colspan="6" class="kz-none">Không có hồ sơ</td></tr>');
      }
    });
    host.addEventListener('click', event => {
      if (onDropdownClick(event)) return;
      if (event.target.closest('[data-kz-export]')) exportExcel();
      if (bnClick(event)) return;
      const xls = event.target.closest('[data-kz-xls]');
      if (xls) { const card = xls.closest('.kz-card'); if (card) (card.classList.contains('kz-bn-card') ? exportBottleneck(xls) : downloadExcel(card, xls)); return; }
      const img = event.target.closest('[data-kz-img]');
      if (img) { const card = img.closest('.kz-card, .kz-ledger'); if (card) downloadImage(card, img); return; }
      const step = event.target.closest('[data-kz-step]');
      if (step) {
        let [y, m] = monthValue.split('-').map(Number); m += Number(step.dataset.kzStep);
        if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
        monthValue = y + '-' + String(m).padStart(2, '0');
        monthTouched = true; paintMonths(); enhanceDropdowns(host); recalc();
      }
    });
    host.addEventListener('keydown', onDropdownKey);
    host.addEventListener('input', event => { const el = event.target.closest && event.target.closest('[data-bn-f]'); if (el) bnOnInput(el); });
    host.addEventListener('paste', event => { const el = event.target.closest && event.target.closest('[data-bn-f]'); if (!el) return; event.preventDefault(); document.execCommand('insertText', false, (event.clipboardData || window.clipboardData).getData('text/plain')); });
    document.addEventListener('click', outsideDd, true); window.addEventListener('resize', closeDdSoft); window.addEventListener('scroll', closeDdSoft, true);
    container.replaceChildren(host);
    refresh();
  }




  // ----- Điểm nghẽn & đề xuất xử lý (báo cáo cấp trên) -----
  // Dòng gợi ý do KpiBottleneck.detect tính từ số liệu KPI; AI chỉ viết lại nguyên nhân/hành động. Người dùng sửa trực tiếp trong ô,
  // bản sửa và kết quả AI lưu theo tháng trên máy này (localStorage) và ưu tiên: bản sửa > AI > gợi ý tự động.
  const BN = typeof KpiBottleneck !== 'undefined' ? KpiBottleneck : null;
  const bnKey = () => 'kpiZoneBn:v1:' + monthValue;
  const bnLoad = () => { try { return JSON.parse(localStorage.getItem(bnKey()) || '{}') || {}; } catch (_) { return {}; } };
  const bnSave = state => { try { localStorage.setItem(bnKey(), JSON.stringify(state)); } catch (_) { /* không lưu được: vẫn dùng trong phiên */ } };
  let bnBusy = false, bnNotice = {text: '', kind: ''};

  function bnRows(r) {
    if (!BN) return [];
    const state = bnLoad(), hidden = new Set(state.hidden || []);
    const rows = BN.detect(r, K).filter(b => !hidden.has(b.id)).map(base => {
      const ai = (state.ai || {})[base.id] || {}, edit = (state.edits || {})[base.id] || {};
      const row = {...base, base};
      row.fromAi = {};
      for (const f of BN.AI_FIELDS) if (ai[f]) { row[f] = ai[f]; row.fromAi[f] = true; }
      for (const [f, v] of Object.entries(edit)) { row[f] = v; delete row.fromAi[f]; }
      row.warn = ai.warn || [];
      return row;
    });
    for (const extra of state.added || []) rows.push({...extra, manual: true, fromAi: {}, warn: [], base: null});
    return rows;
  }

  function bnBlock(r) {
    if (!BN) return '';
    const rows = bnRows(r), state = bnLoad();
    const tools = '<span class="kz-bn-tools"><button type="button" class="kz-img kz-ai" data-bn-ai' + (bnBusy ? ' disabled' : '') + ' title="Gemini viết lại nguyên nhân và hành động từ số liệu đã tính">' +
      ddSvg('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M17 5h4"/>', 14) + '<span>' + (bnBusy ? 'AI đang soạn…' : 'Soạn bằng AI') + '</span></button>' +
      '<button type="button" class="kz-img" data-bn-add title="Thêm một dòng tự nhập"><span>+ Thêm dòng</span></button>' +
      '<button type="button" class="kz-img" data-bn-reset title="Xoá bản sửa và kết quả AI của tháng này"><span>Khôi phục gợi ý</span></button></span>';
    const notice = '<div class="kz-bn-notice ' + (bnNotice.kind || '') + '" data-bn-status role="status">' + esc(bnNotice.text) + '</div>';
    const summary = state.summary ? '<div class="kz-bn-summary"><b>Tóm tắt cho cấp trên (AI soạn)</b><p>' + esc(state.summary) + '</p>' + ((state.summaryWarn || []).length ? '<small class="kz-bn-warn">⚠ Số chưa đối chiếu được với dữ liệu: ' + esc(state.summaryWarn.join(', ')) + '</small>' : '') + '</div>' : '';
    if (!rows.length) return block('Điểm nghẽn & đề xuất xử lý', '<div class="kz-none kz-bn-clear">Không phát hiện điểm nghẽn nào trong ' + label(r.current) + ': các chỉ tiêu KPI đều trong mục tiêu và tồn không tập trung. Có thể bấm “Thêm dòng” nếu cần nêu vấn đề khác.</div>', tools, 'kz-bn-card');
    const cell = (row, field) => {
      const ai = row.fromAi[field], warn = ai && row.warn.length ? ' title="Có số chưa đối chiếu được với dữ liệu: ' + esc(row.warn.join(', ')) + '"' : '';
      return '<td class="kz-bn-c kz-bn-' + field + (ai ? ' is-ai' : '') + (ai && row.warn.length ? ' has-warn' : '') + '"' + warn + '><div class="kz-bn-edit" contenteditable="plaintext-only" spellcheck="false" data-bn-id="' + esc(row.id) + '" data-bn-f="' + field + '">' + esc(row[field] || '') + '</div></td>';
    };
    const body = rows.map((row, i) => '<tr data-bn-row="' + esc(row.id) + '"><td class="kz-bn-n"><b>' + (i + 1) + '</b><button type="button" class="kz-bn-del" data-bn-del="' + esc(row.id) + '" title="Bỏ dòng này khỏi báo cáo" aria-label="Bỏ dòng ' + (i + 1) + '">×</button></td>' + BN.COLUMNS.map(col => cell(row, col.key)).join('') + '</tr>').join('');
    const head = '<tr><th class="kz-bn-n">Stt</th>' + BN.COLUMNS.map(col => '<th>' + esc(col.label) + '</th>').join('') + '</tr>';
    const note = '<p class="kz-note">Nguyên nhân và hành động là <b>gợi ý suy ra từ số liệu</b>, cần Trưởng Zone xác nhận với thực tế trước khi gửi cấp trên. Nhấp vào ô để sửa; bản sửa lưu trên máy này theo từng tháng. Ô có nền vàng nhạt do AI soạn; dấu ⚠ nghĩa là có con số AI viết chưa đối chiếu được với dữ liệu. AI chỉ nhận số liệu tổng hợp (không có tên khách hàng, biển số, mã hồ sơ).</p>';
    return block('Điểm nghẽn & đề xuất xử lý<span class="kz-bn-sub"> (báo cáo cấp trên)</span>', notice + summary + '<div class="kz-tablewrap kz-bn-wrap"><table class="kz-table kz-bn-table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' + note, tools, 'kz-bn-card');
  }

  function bnRepaint() {
    const card = host && host.querySelector('.kz-bn-card');
    if (!card || !report) return;
    const holder = document.createElement('div'); holder.innerHTML = bnBlock(report);
    const fresh = holder.firstElementChild; if (fresh) card.replaceWith(fresh);
  }
  function bnNote(text, kind) { bnNotice = {text, kind: kind || ''}; const el = host && host.querySelector('[data-bn-status]'); if (el) { el.textContent = text; el.className = 'kz-bn-notice ' + (kind || ''); } }

  let bnTimer = 0;
  function bnOnInput(el) {
    const id = el.dataset.bnId, field = el.dataset.bnF, text = el.innerText.replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    clearTimeout(bnTimer);
    bnTimer = setTimeout(() => {
      const state = bnLoad();
      const extra = (state.added || []).find(x => x.id === id);
      if (extra) extra[field] = text;
      else { state.edits = state.edits || {}; state.edits[id] = {...(state.edits[id] || {}), [field]: text}; }
      bnSave(state);
      el.closest('td')?.classList.remove('is-ai', 'has-warn');
    }, 250);
  }

  function bnClick(event) {
    const del = event.target.closest('[data-bn-del]');
    if (del) {
      const id = del.dataset.bnDel, state = bnLoad();
      if ((state.added || []).some(x => x.id === id)) state.added = state.added.filter(x => x.id !== id); else state.hidden = [...new Set([...(state.hidden || []), id])];
      bnSave(state); bnRepaint(); return true;
    }
    if (event.target.closest('[data-bn-add]')) {
      const state = bnLoad(); state.added = [...(state.added || []), {id: 'x' + Date.now(), title: '', figures: '', cause: '', evidence: '', actions: '', owner: '', deadline: '', expected: ''}];
      bnSave(state); bnRepaint(); const last = host.querySelector('.kz-bn-table tbody tr:last-child [data-bn-f="title"]'); if (last) last.focus(); return true;
    }
    if (event.target.closest('[data-bn-reset]')) { try { localStorage.removeItem(bnKey()); } catch (_) { /* bỏ qua */ } bnNote('', ''); bnRepaint(); return true; }
    if (event.target.closest('[data-bn-ai]')) { bnAskAi(); return true; }
    return false;
  }

  async function bnGemini(request, apiKey, model) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
        method: 'POST', signal: controller.signal, headers: {'Content-Type': 'application/json', 'x-goog-api-key': apiKey}, body: JSON.stringify(request)
      });
      let data = null; try { data = await response.json(); } catch (_) { /* không phải JSON */ }
      if (!response.ok || (data && data.error)) {
        if (response.status === 429) throw new Error('Gemini báo hết hạn mức tạm thời. Đợi 1–2 phút rồi thử lại.');
        if (response.status === 400 || response.status === 403) throw new Error('Khoá Gemini API không hợp lệ hoặc không dùng được mô hình này. Kiểm tra lại khoá ở Trợ lý AI.');
        throw new Error('Gemini lỗi: ' + ((data && data.error && data.error.message) || 'HTTP ' + response.status));
      }
      const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
      const text = parts ? parts.map(p => p.text || '').join('') : '';
      if (!text) throw new Error('AI không trả về nội dung (có thể bị bộ lọc chặn). Hãy thử lại.');
      return text;
    } catch (error) {
      if (error && error.name === 'AbortError') throw new Error('AI phản hồi quá lâu. Hãy thử lại.');
      throw error;
    } finally { clearTimeout(timer); }
  }

  async function bnAskAi() {
    if (!report || bnBusy || !BN) return;
    const base = BN.detect(report, K);
    if (!base.length) { bnNote('Không có điểm nghẽn để AI soạn.', 'warn'); return; }
    let key = '';
    try { key = typeof GeminiKeyStore !== 'undefined' ? await GeminiKeyStore.get() : ''; } catch (_) { key = ''; }
    if (!key) { bnNote('Chưa có khoá Gemini API. Mở Trợ lý AI (nút robot góc phải) → biểu tượng ⚙ để nhập khoá, rồi bấm lại.', 'warn'); return; }
    let model = 'gemini-2.5-flash'; try { model = localStorage.getItem('gemini_model_name') || model; } catch (_) { /* dùng mặc định */ }
    bnBusy = true; bnNote('AI đang soạn từ số liệu tổng hợp…', 'info'); bnRepaint();
    try {
      const c = report.current;
      const extra = [c.kpis.uncapped, c.kpis.capped].map(v => fmt.fmtPct(v, 2) + ' ' + fmt.fmtScore(v)).join(' ') + ' ' + c.kpis.rows.map(k => fmt.fmtPct(k.result, 2) + ' ' + fmt.fmtInt(k.result) + ' ' + fmt.fmtScore(k.score)).join(' ');
      const raw = await bnGemini(BN.aiRequest(base, report, K), key, model);
      const merged = BN.mergeAi(base, BN.parseAi(raw), extra);
      const state = bnLoad(); state.ai = {...(state.ai || {}), ...merged.map}; state.summary = merged.summary; state.summaryWarn = merged.summaryWarn;
      for (const id of Object.keys(merged.map)) if (state.edits && state.edits[id]) for (const f of BN.AI_FIELDS) delete state.edits[id][f];
      bnSave(state);
      const n = Object.keys(merged.map).length, warns = Object.values(merged.map).filter(x => x.warn.length).length;
      bnNotice = {text: 'AI đã soạn ' + n + ' dòng' + (warns ? ' — ' + warns + ' dòng có số cần kiểm tra lại (dấu ⚠)' : '') + '. Hãy đọc và chỉnh sửa trước khi gửi cấp trên.', kind: warns ? 'warn' : 'ok'};
    } catch (error) { bnNotice = {text: error.message || 'AI không soạn được.', kind: 'bad'}; }
    finally { bnBusy = false; bnRepaint(); }
  }

  // Bảng Excel theo mẫu báo cáo điểm nghẽn: có viền, tiêu đề đậm, tự xuống dòng, chiều cao dòng ước lượng theo nội dung.
  function bnSheet(XLSX, rows, c) {
    const widths = [5, 28, 38, 42, 28, 46, 32, 13, 28], border = {top: {style: 'thin', color: {rgb: '9AA39B'}}, bottom: {style: 'thin', color: {rgb: '9AA39B'}}, left: {style: 'thin', color: {rgb: '9AA39B'}}, right: {style: 'thin', color: {rgb: '9AA39B'}}};
    const head = {font: {bold: true, sz: 11}, fill: {fgColor: {rgb: 'F3E7C9'}}, alignment: {horizontal: 'center', vertical: 'center', wrapText: true}, border};
    const body = {alignment: {vertical: 'top', wrapText: true}, border, font: {sz: 10}};
    const state = bnLoad();
    const cols = ['Stt', ...BN.COLUMNS.map(x => x.label)];
    const aoa = [[{v: 'BÁO CÁO ĐIỂM NGHẼN ' + label(c) + ' – ZONE ĐẮK LẮK', t: 's', s: {font: {bold: true, sz: 14}}}], [{v: 'Số liệu đến ngày ' + fmt.fmtDate(prep.asOf) + ' · nguồn: Báo cáo KPI bồi thường (hồ sơ trong hệ thống)', t: 's', s: {font: {italic: true, sz: 10}}}]];
    const merges = [{s: {r: 0, c: 0}, e: {r: 0, c: 8}}, {s: {r: 1, c: 0}, e: {r: 1, c: 8}}];
    let summaryRows = 0;
    if (state.summary) { aoa.push([{v: 'Tóm tắt (AI soạn, đã/chưa chỉnh sửa): ' + state.summary, t: 's', s: {alignment: {wrapText: true, vertical: 'top'}, font: {sz: 10}}}]); merges.push({s: {r: 2, c: 0}, e: {r: 2, c: 8}}); summaryRows = 1; }
    aoa.push([]);
    const headRow = aoa.length; aoa.push(cols.map(v => ({v, t: 's', s: head})));
    const heights = [];
    rows.forEach((row, i) => {
      aoa.push([{v: i + 1, t: 'n', s: {...body, alignment: {horizontal: 'center', vertical: 'top'}}}, ...BN.COLUMNS.map(col => ({v: String(row[col.key] || ''), t: 's', s: body}))]);
      const lines = Math.max(...BN.COLUMNS.map((col, ci) => String(row[col.key] || '').split('\n').reduce((n, part) => n + Math.max(1, Math.ceil(part.length / (widths[ci + 1] * 1.05))), 0)));
      heights[headRow + 1 + i] = {hpx: Math.min(409, Math.max(30, lines * 14 + 8))};
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = widths.map(w => ({wch: w})); ws['!merges'] = merges;
    ws['!rows'] = []; ws['!rows'][headRow] = {hpx: 34}; if (summaryRows) ws['!rows'][2] = {hpx: Math.min(120, 20 + Math.ceil(state.summary.length / 150) * 14)};
    heights.forEach((h, i) => { if (h) ws['!rows'][i] = h; });
    return ws;
  }
  async function exportBottleneck(button) {
    if (!report) return;
    button.disabled = true;
    try {
      const XLSX = await loadXlsx(), book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, bnSheet(XLSX, bnRows(report), report.current), 'Điểm nghẽn');
      const file = 'bao-cao-diem-nghen-' + monthValue + '.xlsx';
      XLSX.writeFile(book, file); toast('Đã xuất ' + file, 'success');
    } catch (error) { console.error(error); toast('Không xuất được Excel: ' + (error && error.message || 'lỗi không xác định'), 'error'); }
    finally { button.disabled = false; }
  }

  // ----- Dropdown tuỳ biến (cùng ngôn ngữ thiết kế với bộ lọc của các báo cáo khác) -----
  // <select> gốc vẫn là nguồn giá trị (ẩn): chọn mục -> gán value rồi phát sự kiện change như cũ.
  const DD_ICON = {
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    sort: '<path d="M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>'
  };
  const ddSvg = (name, size = 15) => '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + name + '</svg>';
  let openDd = null;
  function closeDd(restore) {
    if (!openDd) return;
    const {wrap, menu, trigger} = openDd;
    menu.hidden = true; wrap.classList.remove('is-open'); trigger.setAttribute('aria-expanded', 'false');
    if (restore) trigger.focus({preventScroll: true});
    openDd = null;
  }
  function placeDd(wrap) {
    const trigger = wrap.querySelector('.kz-dd-trigger'), menu = wrap.querySelector('.kz-dd-menu');
    const r = trigger.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const width = Math.min(Math.max(r.width, 230), vw - 24);
    menu.style.width = width + 'px';
    menu.style.left = Math.max(12, Math.min(r.left, vw - width - 12)) + 'px';
    const body = menu.querySelector('.kz-dd-list'), chrome = menu.offsetHeight - body.offsetHeight;
    const below = vh - r.bottom - 16, above = r.top - 16, up = below < 220 && above > below;
    body.style.maxHeight = Math.max(96, Math.min(320, (up ? above : below) - chrome)) + 'px';
    menu.style.top = (up ? r.top - menu.offsetHeight - 8 : r.bottom + 8) + 'px';
  }
  function openDropdown(wrap) {
    if (openDd && openDd.wrap === wrap) { closeDd(true); return; }
    closeDd();
    const menu = wrap.querySelector('.kz-dd-menu'), trigger = wrap.querySelector('.kz-dd-trigger');
    menu.hidden = false; wrap.classList.add('is-open'); trigger.setAttribute('aria-expanded', 'true');
    openDd = {wrap, menu, trigger}; placeDd(wrap);
    (menu.querySelector('.kz-dd-opt.is-selected') || menu.querySelector('.kz-dd-opt'))?.focus({preventScroll: false});
  }
  function syncDropdown(select) {
    const wrap = select.closest('.kz-dd'); if (!wrap) return;
    const options = [...select.options], cur = options.find(o => o.value === select.value) || options[0];
    const prefix = select.dataset.kzPrefix;
    wrap.querySelector('.kz-dd-label').innerHTML = (prefix ? '<small>' + esc(prefix) + ':</small> ' : '') + '<b>' + esc(cur ? cur.textContent : '') + '</b>';
    wrap.querySelector('.kz-dd-list').innerHTML = options.map(o => '<button type="button" role="option" class="kz-dd-opt' + (o === cur ? ' is-selected' : '') + '" aria-selected="' + (o === cur) + '" data-value="' + esc(o.value) + '"><span>' + esc(o.textContent) + '</span>' + (o === cur ? ddSvg('<path d="m5 12 5 5 9-10"/>', 15) : '') + '</button>').join('');
  }
  function enhanceDropdowns(root) {
    root.querySelectorAll('select[data-kz-dd]').forEach(select => {
      if (select.closest('.kz-dd')) { syncDropdown(select); return; }
      const wrap = document.createElement('div');
      wrap.className = 'kz-dd' + (select.hasAttribute('data-kz-zone') ? ' kz-dd-sm' : '');
      const icon = DD_ICON[select.dataset.kzIcon];
      wrap.innerHTML = '<button type="button" class="kz-dd-trigger" aria-haspopup="listbox" aria-expanded="false" aria-label="' + esc(select.getAttribute('aria-label') || '') + '">' +
        (icon ? '<span class="kz-dd-ic">' + ddSvg(icon) + '</span>' : '') + '<span class="kz-dd-label"></span><span class="kz-dd-chev">' + ddSvg('<path d="m6 9 6 6 6-6"/>', 14) + '</span></button>' +
        '<div class="kz-dd-menu" role="listbox" hidden><div class="kz-dd-head">' + esc(select.dataset.kzTitle || '') + '</div><div class="kz-dd-list"></div></div>';
      select.before(wrap); select.classList.add('kz-dd-native'); select.tabIndex = -1; select.setAttribute('aria-hidden', 'true'); wrap.prepend(select);
      syncDropdown(select);
    });
  }
  function onDropdownClick(event) {
    const opt = event.target.closest('.kz-dd-opt');
    if (opt) {
      const wrap = opt.closest('.kz-dd'), select = wrap.querySelector('select');
      closeDd(true);
      if (select.value !== opt.dataset.value) { select.value = opt.dataset.value; syncDropdown(select); select.dispatchEvent(new Event('change', {bubbles: true})); }
      return true;
    }
    const trigger = event.target.closest('.kz-dd-trigger');
    if (trigger) { openDropdown(trigger.closest('.kz-dd')); return true; }
    return false;
  }
  function onDropdownKey(event) {
    const trigger = event.target.closest && event.target.closest('.kz-dd-trigger');
    if (trigger && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) { event.preventDefault(); openDropdown(trigger.closest('.kz-dd')); return; }
    if (!openDd) return;
    if (event.key === 'Escape') { event.preventDefault(); closeDd(true); return; }
    if (event.key === 'Tab') { closeDd(); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = [...openDd.menu.querySelectorAll('.kz-dd-opt')]; if (!items.length) return;
    event.preventDefault();
    let i = items.indexOf(document.activeElement);
    i = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : Math.max(0, Math.min(items.length - 1, i + (event.key === 'ArrowDown' ? 1 : -1)));
    items[i].focus();
  }
  // Danh sách tháng cho dropdown: từ tháng dữ liệu cũ nhất tới tháng sau tháng dữ liệu mới nhất (tối đa 36 tháng).
  function paintMonths() {
    const select = host.querySelector('[data-kz-month]'); if (!select) return;
    const idx = (y, m) => y * 12 + m - 1;
    const [cy, cm] = monthValue.split('-').map(Number);
    let hi = idx(cy, cm), lo = hi;
    if (prep && prep.records.length) { const a = K.partsOf(prep.asOf); hi = Math.max(hi, idx(a.y, a.m) + 1); lo = Math.min(lo, idx(a.y, a.m) - 35); const first = prep.records.reduce((n, r) => Math.min(n, r.open), Infinity); const f = K.partsOf(first); lo = Math.max(lo, idx(f.y, f.m)); lo = Math.min(lo, idx(cy, cm)); }
    let html = '';
    for (let i = hi; i >= lo; i--) { const y = Math.floor(i / 12), m = i % 12 + 1, v = y + '-' + String(m).padStart(2, '0'); html += '<option value="' + v + '"' + (v === monthValue ? ' selected' : '') + '>Tháng ' + m + '/' + y + '</option>'; }
    select.innerHTML = html; select.value = monthValue;
  }

  // ----- Tải ảnh một khối (biểu đồ / bảng) về máy -----
  const slugify = text => String(text || 'bao-cao').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 48) || 'bao-cao';
  async function downloadImage(card, button) {
    if (typeof html2canvas === 'undefined') { toast('Thư viện xuất ảnh chưa tải xong, thử lại sau ít giây.', 'warning'); return; }
    const title = card.dataset.kzTitle || (card.querySelector('.kz-head h2') || {}).textContent || 'bao-cao';
    button.disabled = true;
    try {
      try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (_) { /* không chặn việc tải ảnh */ }
      const bg = (getComputedStyle(card).backgroundColor || '').replace(/\s/g, '') === 'rgba(0,0,0,0)' ? '#ffffff' : getComputedStyle(card).backgroundColor;
      const wide = Math.max(card.offsetWidth, ...[...card.querySelectorAll('.kz-tablewrap')].map(w => w.scrollWidth + 52));
      const canvas = await html2canvas(card, {
        ...(wide > card.offsetWidth ? {width: wide, windowWidth: wide + 80} : {}),
        scale: Math.min(3, Math.max(2, window.devicePixelRatio || 2)), backgroundColor: bg, useCORS: true, logging: false,
        ignoreElements: el => el.hasAttribute && (el.hasAttribute('data-kz-img') || el.hasAttribute('data-kz-xls') || el.hasAttribute('data-bn-ai') || el.hasAttribute('data-bn-add') || el.hasAttribute('data-bn-reset') || el.hasAttribute('data-bn-del')),
        onclone: (doc, clone) => {
          // html2canvas vẽ chữ bằng canvas, không hỗ trợ số cùng độ rộng/kerning/ligature của font web -> chữ bị lệch, dính. Tắt các tính năng đó trong bản chụp.
          const fix = doc.createElement('style');
          fix.textContent = '*{font-variant-numeric:normal!important;font-feature-settings:normal!important;font-kerning:none!important;font-variant-ligatures:none!important;letter-spacing:normal!important;text-rendering:auto!important;-webkit-font-smoothing:antialiased}';
          doc.head.appendChild(fix);
          if (wide > card.offsetWidth) { clone.style.width = wide + 'px'; clone.style.maxWidth = 'none'; }
          // Ảnh chỉ giữ bảng: bỏ phụ đề tiêu đề, thông báo AI, khung tóm tắt và ghi chú chân bảng.
          clone.querySelectorAll('.kz-bn-sub, .kz-bn-notice, .kz-bn-summary, .kz-bn-card .kz-note').forEach(el => el.remove());
          // Ô sửa được: bỏ viền/khung sửa khi chụp.
          clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
          // Bảng cuộn: mở rộng để ảnh chứa đủ dòng.
          clone.querySelectorAll('.kz-scroll, .kz-tablewrap').forEach(el => { el.style.maxHeight = 'none'; el.style.overflow = 'visible'; });
          // html2canvas vẽ box-shadow inset thành khối đặc -> đổi dấu cảnh báo sang viền trái.
          const rose = getComputedStyle(card).getPropertyValue('--sf-rose').trim() || '#c0392b';
          clone.querySelectorAll('.kz-bn-c.has-warn').forEach(td => { td.style.boxShadow = 'none'; td.style.borderLeft = '3px solid ' + rose; });
          // Ô nhiệt dùng color-mix() mà html2canvas chưa hiểu -> thay bằng rgba tính sẵn.
          const probe = document.createElement('i'); probe.style.color = 'var(--sf-gold)'; card.appendChild(probe);
          const gold = (getComputedStyle(probe).color.match(/\d+(\.\d+)?/g) || ['176', '122', '31']).slice(0, 3).join(','); probe.remove();
          clone.querySelectorAll('td.kz-heat').forEach(td => { const h = parseFloat(td.style.getPropertyValue('--h')) || 0; td.style.background = 'rgba(' + gold + ',' + (h * 0.55).toFixed(3) + ')'; });
          // SVG: html2canvas chỉ chép được SVG nếu kiểu dáng nằm trong thuộc tính -> nhúng giá trị tính toán.
          const view = doc.defaultView, props = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'font-size', 'font-weight', 'font-family', 'paint-order'];
          clone.querySelectorAll('svg *').forEach(node => {
            const cs = view.getComputedStyle(node);
            props.forEach(prop => { const v = cs.getPropertyValue(prop); if (v) node.style.setProperty(prop, v); });
          });
        }
      });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Không tạo được ảnh');
      const name = 'kpi-zone-' + slugify(title) + '-' + monthValue + '.png';
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast('Đã tải ảnh ' + name, 'success');
    } catch (error) { toast('Không tải được ảnh: ' + (error && error.message || 'lỗi không xác định'), 'error'); }
    finally { button.disabled = false; }
  }

  // ----- Xuất Excel từng bảng (đúng như đang hiển thị, kể cả bộ lọc) -----
  function cellValue(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (/^-?\d{1,3}(\.\d{3})+( ?đ)?$/.test(t) || /^-?\d+( ?đ)?$/.test(t)) return {v: Number(t.replace(/[^\d-]/g, '')), z: '#,##0'};
    if (/^-?\d+(,\d+)?%$/.test(t)) return {v: Number(t.replace('%', '').replace(',', '.')) / 100, z: '0.00%'};
    if (/^-?\d+,\d+$/.test(t)) return {v: Number(t.replace(',', '.')), z: '0.0000'};
    return {v: t, z: null};
  }
  async function downloadExcel(card, button) {
    const tables = [...card.querySelectorAll('table')];
    if (!tables.length) return;
    const title = ((card.querySelector('.kz-head h2') || {}).textContent || 'Bao cao').replace(/\s+/g, ' ').trim();
    button.disabled = true;
    try {
      const XLSX = await loadXlsx(), book = XLSX.utils.book_new(), used = new Set();
      tables.forEach((table, index) => {
        const rows = [...table.querySelectorAll('tr')].map(tr => [...tr.children].map(td => cellValue(td.textContent)));
        const aoa = [[title + ' · ' + (report ? label(report.current) : monthValue)], [], ...rows.map(r => r.map(c => c.v))];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        rows.forEach((r, ri) => r.forEach((c, ci) => { const ref = XLSX.utils.encode_cell({r: ri + 2, c: ci}); if (c.z && ws[ref]) ws[ref].z = c.z; }));
        const cols = Math.max(0, ...rows.map(r => r.length));
        ws['!cols'] = Array.from({length: cols}, (_, ci) => ({wch: Math.min(44, Math.max(10, ...rows.map(r => String((r[ci] || {}).v ?? '').length + 2)))}));
        let name = (tables.length > 1 ? title + ' ' + (index + 1) : title).replace(/[\\/?*\[\]:]/g, ' ').slice(0, 28).trim() || 'Bang'; let n = 2;
        while (used.has(name.toLowerCase())) name = name.slice(0, 25) + ' ' + n++;
        used.add(name.toLowerCase()); XLSX.utils.book_append_sheet(book, ws, name);
      });
      const file = 'kpi-zone-' + slugify(title) + '-' + monthValue + '.xlsx';
      XLSX.writeFile(book, file);
      toast('Đã xuất ' + file, 'success');
    } catch (error) { console.error(error); toast('Không xuất được Excel: ' + (error && error.message || 'lỗi không xác định'), 'error'); }
    finally { button.disabled = false; }
  }
  const toast = (text, type) => { if (typeof triggerToast === 'function') triggerToast(text, type); else message(text, type === 'error' ? 'bad' : 'info'); };

  // Tính lại từ hồ sơ hiện có (gọi khi mở trang và mỗi lần danh sách hồ sơ cập nhật).
  function refresh() {
    if (!host || !host.isConnected) return;
    try { loadClaims(); } catch (error) { console.error(error); prep = null; message('Không đọc được dữ liệu hồ sơ: ' + esc(error.message), 'bad'); }
    if (!monthTouched && prep && prep.records.length) { const a = K.partsOf(prep.asOf); monthValue = a.y + '-' + String(a.m).padStart(2, '0'); }
    paintMonths(); enhanceDropdowns(host);
    paintGdvs(); recalc();
  }

  function outsideDd(event) { if (openDd && !event.target.closest('.kz-dd')) closeDd(); }
  function closeDdSoft(event) { if (openDd && !(event && event.target && event.target.closest && event.target.closest('.kz-dd-menu'))) { if (openDd.trigger.isConnected) placeDd(openDd.wrap); else closeDd(); } }
  function leave() { closeDd(); document.removeEventListener('click', outsideDd, true); window.removeEventListener('resize', closeDdSoft); window.removeEventListener('scroll', closeDdSoft, true); host = null; }

  return {mount, refresh, leave};
})();
