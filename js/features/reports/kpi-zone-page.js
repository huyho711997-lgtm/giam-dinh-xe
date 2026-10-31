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
  let monthValue = defaultMonth();
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
  const block = (title, inner, extra = '', cls = '') => '<section class="sf-library kz-card ' + cls + '"><div class="kz-head"><h2>' + title + '</h2>' + extra + '</div>' + inner + '</section>';
  const table = (heads, rows, foot, cls = '') => '<div class="kz-tablewrap"><table class="kz-table ' + cls + '"><thead><tr>' + heads.map((h, i) => '<th' + (i ? ' class="n"' : '') + '>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody>' + (foot ? '<tfoot>' + foot + '</tfoot>' : '') + '</table></div>';
  const estTag = '<em class="kz-est">ước tính</em>';

  // ----- Biểu đồ SVG nhẹ, không phụ thuộc thư viện -----
  function lineChart(points, o) {
    const W = 320, H = 132, L = 10, R = 12, T = 20, B = 22;
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
      '<text x="' + (W - R) + '" y="' + (y(o.target) - 4).toFixed(1) + '" text-anchor="end" class="kz-tick">mục tiêu ' + o.fmt(o.target) + '</text>' +
      '<path d="' + path + '" class="kz-line"/>' + dots +
      (last.value !== null && last.value !== undefined ? '<text x="' + (x(lastIdx) - 6).toFixed(1) + '" y="' + (y(last.value) - 9).toFixed(1) + '" text-anchor="end" class="kz-val">' + o.fmt(last.value) + '</text>' : '') + ticks + '</svg>';
  }

  function barChart(trend) {
    const W = 920, H = 210, L = 34, R = 8, T = 16, B = 26;
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
      if (i === trend.length - 1) svg += '<text x="' + (cx - bw / 2 - 1).toFixed(1) + '" y="' + (y(t.issued) - 5).toFixed(1) + '" text-anchor="middle" class="kz-val">' + t.issued + '</text><text x="' + (cx + bw / 2 + 1).toFixed(1) + '" y="' + (y(t.approved) - 5).toFixed(1) + '" text-anchor="middle" class="kz-val">' + t.approved + '</text>';
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
    const names = {completion: 'Hoàn thành', cost: 'CP bình quân', backlog: 'Tồn'};
    const segs = k.rows.map(row => {
      const fill = row.score === null ? 0 : Math.min(1, row.score / row.weight) * 100;
      const over = row.score !== null && row.score > row.weight;
      return '<div class="kz-seg" style="flex:' + row.weight * 100 + ' 1 0"><div class="kz-track"><i class="' + (row.pass ? 'ok' : row.pass === false ? 'miss' : '') + '" style="width:' + fill.toFixed(1) + '%"></i></div>' +
        '<div class="kz-segl"><b>' + names[row.key] + '</b><span>' + fmt.fmtScore(row.cappedScore) + ' / ' + String(row.weight).replace('.', ',') + (over ? ' <em title="Phần vượt tỷ trọng bị cắt">+' + dec(row.score - row.weight, 4) + ' bị cắt</em>' : '') + '</span></div></div>';
    }).join('');
    const facts = k.rows.map(row => {
      const res = row.key === 'cost' ? fmt.fmtInt(row.result) : fmt.fmtPct(row.result, row.key === 'completion' ? 1 : 2);
      const tgt = row.key === 'cost' ? fmt.fmtInt(row.target) : fmt.fmtPct(row.target, 0);
      return '<div class="kz-fact ' + (row.pass === null ? '' : row.pass ? 'ok' : 'miss') + '"><span>' + esc(row.label) + '</span><b>' + res + '</b><small>mục tiêu ' + (row.key === 'completion' ? '≥' : '≤') + ' ' + tgt + '</small></div>';
    }).join('');
    return '<section class="kz-ledger"><div class="kz-ledger-main"><span class="kz-ledger-title">Điểm KPI ' + label(c) + (c.estimate ? ' ' + estTag : '') + '</span>' +
      '<div class="kz-big"><b>' + fmt.fmtScore(k.capped) + '</b><span>/ 1,0000</span></div>' +
      '<div class="kz-ledger-sub"><span>Chưa giới hạn <b>' + fmt.fmtScore(k.uncapped) + '</b></span><span>so với ' + label(r.previous) + ' ' + delta(r.compare.capped, 'score') + '</span></div></div>' +
      '<div class="kz-ledger-scale"><div class="kz-segs">' + segs + '</div><div class="kz-facts">' + facts + '</div></div></section>';
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
    const filters = '<div class="kz-filters"><label>GĐV<select data-kz-fgdv>' + opt(gdvs, listFilter.gdv) + '</select></label><label>Trạng thái<select data-kz-fstatus>' + opt(statuses, listFilter.status) + '</select></label>' +
      '<label>Sắp xếp<select data-kz-fsort><option value="desc"' + (listFilter.sort === 'desc' ? ' selected' : '') + '>Số ngày giảm dần</option><option value="asc"' + (listFilter.sort === 'asc' ? ' selected' : '') + '>Số ngày tăng dần</option></select></label></div>';
    return block('Hồ sơ mở trong tháng, chưa duyệt (' + fmt.fmtInt(c.unapproved.length) + ')', filters + '<div class="kz-scroll" data-kz-list>' + table(LIST_HEADS, filteredUnapproved(c).map(listRow).join('') || '<tr><td colspan="6" class="kz-none">Không có hồ sơ</td></tr>') + '</div>');
  }

  function view(r) {
    const c = r.current;
    const warn = c.futureMonth ? '<div class="kz-msg warn">Tháng này sau ngày dữ liệu (' + fmt.fmtDate(prep.asOf) + ') nên chưa có số liệu.</div>' : '';
    return warn + ledger(r) + '<div class="kz-split">' + insightsBlock(r) + needBlock(r) + '</div>' + trendBlock(r) + gdvBlock(r) + costLeadBlock(r) + backlogBlock(r) + compareBlock(r) + unapprovedBlock(c);
  }

  // ----- Khung + điều khiển -----
  function shell() {
    return '<div class="kz-bar-top"><div class="kz-stepper" role="group" aria-label="Chọn tháng">' +
      '<button type="button" class="sf-button" data-kz-step="-1" aria-label="Tháng trước">‹</button>' +
      '<label class="kz-month"><span class="kz-sr">Tháng</span><input type="month" data-kz-month value="' + monthValue + '"></label>' +
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
      zones.map(z => '<tr><td>' + esc(z.name) + '</td><td class="n">' + fmt.fmtInt(z.count) + '</td><td class="n">' + fmt.fmtInt(z.byGdvs) + '</td><td>' + (z.key ? '<select data-kz-zone="' + esc(z.key) + '" aria-label="Gán zone ' + esc(z.name) + '"><option value="">Theo GĐV (chưa gán)</option><option value="in"' + (zoneMap[z.key] === 'in' ? ' selected' : '') + '>Thuộc zone báo cáo</option><option value="out"' + (zoneMap[z.key] === 'out' ? ' selected' : '') + '>Zone khác</option></select>' : '<span class="kz-none">luôn theo GĐV</span>') + '</td></tr>').join('') + '</tbody></table></div></div>';
    box.open = wasOpen;
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
    paintMeta(); paintZones();
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
      } else if (el.matches('[data-kz-month]')) { monthValue = el.value || defaultMonth(); recalc(); }
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
      if (event.target.closest('[data-kz-export]')) exportExcel();
      const step = event.target.closest('[data-kz-step]');
      if (step) {
        let [y, m] = monthValue.split('-').map(Number); m += Number(step.dataset.kzStep);
        if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
        monthValue = y + '-' + String(m).padStart(2, '0');
        host.querySelector('[data-kz-month]').value = monthValue; recalc();
      }
    });
    container.replaceChildren(host);
    refresh();
  }

  // Tính lại từ hồ sơ hiện có (gọi khi mở trang và mỗi lần danh sách hồ sơ cập nhật).
  function refresh() {
    if (!host || !host.isConnected) return;
    try { loadClaims(); } catch (error) { console.error(error); prep = null; message('Không đọc được dữ liệu hồ sơ: ' + esc(error.message), 'bad'); }
    paintGdvs(); recalc();
  }

  function leave() { host = null; }

  return {mount, refresh, leave};
})();
