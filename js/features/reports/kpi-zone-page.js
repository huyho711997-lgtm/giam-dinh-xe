// "Báo cáo KPI bồi thường" theo Zone: một góc nhìn trong Báo cáo & thống kê GĐV.
// Dữ liệu lấy từ các hồ sơ bồi thường đã có trong hệ thống (pending_claims, nhập từ B001); tính ngay trong trình duyệt.
// Phần tính nằm ở kpi-zone-calc.js (hàm thuần); file này chỉ nạp file, vẽ bảng và xuất Excel.
const KpiZonePage = (() => {
  const K = KpiZoneCalc;
  const XLSX_SRC = 'js/vendor/xlsx-js-style-1.2.0.bundle.js?v=20261031-kpi-3';
  let host = null, prep = null, selected = null, report = null;
  let listFilter = {gdv: '', status: '', sort: 'desc'};

  const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const now = new Date();
  const defaultMonth = () => now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  let monthValue = defaultMonth();

  // ----- Thư viện đọc xlsx: nằm trong thư mục dự án, nạp khi cần -----
  let xlsxPromise = null;
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    xlsxPromise = xlsxPromise || new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = XLSX_SRC;
      script.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error('Không nạp được thư viện đọc Excel.')));
      script.onerror = () => { xlsxPromise = null; reject(new Error('Không nạp được thư viện đọc Excel (js/vendor).')); };
      document.head.appendChild(script);
    });
    return xlsxPromise;
  }

  // ----- Hiển thị -----
  const fmt = K;
  const delta = (value, kind) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '<span class="kz-delta">-</span>';
    const up = value > 0, flat = Math.abs(value) < 1e-12;
    const text = kind === 'pct' ? (value * 100).toFixed(1).replace('.', ',') + ' đ.%' : kind === 'score' ? value.toFixed(4).replace('.', ',') : Math.round(value).toLocaleString('vi-VN');
    return '<span class="kz-delta' + (flat ? '' : up ? ' up' : ' down') + '">' + (flat ? '' : up ? '▲ ' : '▼ ') + (up ? '+' : '') + text + '</span>';
  };
  // Với CP và tỉ lệ tồn, giảm là tốt; màu do người dùng đọc từ dấu ▲▼ nên chỉ đổi màu theo chiều "tốt/xấu".
  function deltaGood(value, kind, lowerBetter) {
    const html = delta(value, kind);
    if (!lowerBetter || value === null || value === undefined || Math.abs(value) < 1e-12) return html;
    return html.replace(/ (up|down)"/, (m, d) => ' ' + (d === 'up' ? 'down' : 'up') + '"');
  }

  function shell() {
    return '<section class="sf-library kz-card"><div class="kz-controls">' +
      '<label class="kz-field"><span>Tháng</span><input type="month" data-kz-month value="' + monthValue + '"></label>' +
      '<div class="kz-field kz-meta" data-kz-meta><span>Dữ liệu</span></div>' +
      '<div class="kz-field kz-actions"><span>&nbsp;</span><button type="button" class="sf-button" data-kz-export disabled>Xuất Excel</button></div></div>' +
      '<div data-kz-gdvs class="kz-gdvs"></div><div data-kz-msg class="kz-msg" role="status"></div></section>' +
      '<div data-kz-body></div>';
  }

  function paintMeta() {
    const meta = host.querySelector('[data-kz-meta]');
    meta.innerHTML = '<span>Dữ liệu</span>' + (prep && prep.records.length
      ? '<b>Hồ sơ bồi thường trong hệ thống</b><small>Đến ngày ' + fmt.fmtDate(prep.asOf) + ' · ' + prep.records.length.toLocaleString('vi-VN') + '/' + prep.total.toLocaleString('vi-VN') + ' hồ sơ có Ngày mở HS</small>'
      : '<b>Chưa có hồ sơ</b>');
    host.querySelector('[data-kz-export]').disabled = !report;
  }

  function paintGdvs() {
    const box = host.querySelector('[data-kz-gdvs]');
    if (!prep || !prep.records.length) { box.innerHTML = ''; return; }
    const list = K.listGdvs(prep.records);
    const picked = new Set(selected.map(K.nameKey));
    box.innerHTML = '<span class="kz-label">GĐV tính KPI</span>' + list.map(item =>
      '<label class="kz-chip"><input type="checkbox" data-kz-gdv value="' + esc(item.name) + '"' + (picked.has(K.nameKey(item.name)) ? ' checked' : '') + '><span>' + esc(item.name) + ' <small>' + item.count + '</small></span></label>').join('');
  }

  function message(text, kind) {
    const el = host.querySelector('[data-kz-msg]');
    el.className = 'kz-msg' + (kind ? ' ' + kind : '');
    el.innerHTML = text || '';
  }

  function warningText(w) {
    const parts = [];
    if (w.noId) parts.push(w.noId + ' dòng thiếu số hồ sơ');
    if (w.duplicate) parts.push(w.duplicate + ' dòng trùng số hồ sơ (giữ dòng đầu)');
    if (w.noOpen) parts.push(w.noOpen + ' dòng không có Ngày mở hs');
    if (w.badOpen) parts.push(w.badOpen + ' dòng Ngày mở hs không đọc được');
    if (w.badApprove) parts.push(w.badApprove + ' dòng ngày duyệt không đọc được (coi như chưa duyệt)');
    if (w.badMoney) parts.push(w.badMoney + ' dòng có số tiền không đọc được (coi như 0)');
    if (w.unknownStatus.length) parts.push('Trạng thái lạ: ' + w.unknownStatus.map(esc).join(', '));
    return parts.length ? 'Đã bỏ qua/lưu ý: ' + parts.join('; ') + '.' : '';
  }

  // ----- Tính + vẽ -----
  function recalc() {
    const body = host.querySelector('[data-kz-body]');
    report = null;
    if (!prep || !prep.records.length) { body.innerHTML = '<div class="kz-empty">Chưa có hồ sơ bồi thường nào có Ngày mở HS. Hãy nhập hồ sơ (Excel B001) ở trang Hồ sơ bồi thường.</div>'; paintMeta(); return; }
    const [year, month] = monthValue.split('-').map(Number);
    if (!year || !month) { body.innerHTML = '<div class="kz-empty">Hãy chọn tháng cần xem.</div>'; paintMeta(); return; }
    try {
      report = K.computeReport(prep.records, {year, month, gdvs: selected, asOf: prep.asOf});
      body.innerHTML = view(report);
    } catch (error) {
      console.error(error);
      body.innerHTML = '<div class="kz-empty kz-bad">Không tính được báo cáo: ' + esc(error.message) + '</div>';
    }
    paintMeta();
  }

  const label = r => 'T' + r.month + '.' + r.year;

  function view(r) {
    const c = r.current, p = r.previous;
    const est = c.estimate ? ' <em class="kz-est">ước tính</em>' : '';
    const warn = c.futureMonth ? '<div class="kz-msg warn">Tháng này sau ngày dữ liệu (' + fmt.fmtDate(prep.asOf) + ') nên chưa có số liệu.</div>' : '';
    const cards = '<section class="kz-cards">' +
      card('Tổng điểm (chưa giới hạn)', fmt.fmtScore(c.kpis.uncapped), r.compare.uncapped, 'Điểm từng nhóm có thể vượt tỷ trọng') +
      card('Tổng điểm (đã giới hạn)', fmt.fmtScore(c.kpis.capped), r.compare.capped, 'Mỗi nhóm tối đa bằng tỷ trọng · tối đa 1,0000') + '</section>';

    const kpiRows = c.kpis.rows.map(k => {
      const cls = k.pass === null ? '' : k.pass ? ' kz-pass' : ' kz-fail';
      const tgt = k.key === 'cost' ? fmt.fmtInt(k.target) : fmt.fmtPct(k.target, 0);
      const res = k.key === 'cost' ? fmt.fmtInt(k.result) : fmt.fmtPct(k.result, 2);
      return '<tr class="' + cls.trim() + '"><td>' + esc(k.label) + (k.key === 'backlog' && c.estimate ? ' <em class="kz-est">ước tính</em>' : '') + '</td><td class="n">' + k.weight.toString().replace('.', ',') + '</td><td class="n">' + tgt + '</td><td class="n">' + res + '</td><td class="n">' + fmt.fmtScore(k.score) + '</td><td class="n">' + fmt.fmtScore(k.shortfall) + '</td></tr>';
    }).join('');
    const kpiTable = block('3 nhóm KPI — ' + label(c) + est,
      table(['Nhóm KPI', 'Tỷ trọng', 'Mục tiêu', 'Kết quả', 'Điểm', 'Điểm hụt'], kpiRows,
        '<tr class="tot"><td>Tổng</td><td class="n">1</td><td></td><td></td><td class="n">' + fmt.fmtScore(c.kpis.uncapped) + ' / ' + fmt.fmtScore(c.kpis.capped) + '</td><td class="n">' + fmt.fmtScore(c.kpis.rows.reduce((a, k) => a + (k.shortfall || 0), 0)) + '</td></tr>') +
      '<p class="kz-note">CP bình quân lấy mẫu ' + fmt.fmtInt(c.totals.sample) + ' hồ sơ (loại ' + fmt.fmtInt(c.totals.excluded) + ' hồ sơ có ST/DPBT ≥ 10 triệu hoặc âm). Tỉ lệ tồn = tồn lũy kế ' + fmt.fmtInt(c.totals.ton) + ' / ' + fmt.fmtInt(c.totals.ytd) + ' hồ sơ phát sinh từ 01/01.' +
      (c.estimate ? ' <b>Tháng đã qua: tồn chỉ là ước tính</b> (mở tới cuối tháng, chưa có ngày duyệt hoặc duyệt sau tháng đó, không “Từ chối”).' : '') + '</p>');

    const gdvRows = c.perGdv.map(g => '<tr><td>' + esc(g.gdv) + '</td><td class="n">' + fmt.fmtInt(g.issued) + '</td><td class="n">' + fmt.fmtInt(g.approved) + '</td><td class="n">' + fmt.fmtPct(g.completion) + '</td><td class="n">' + fmt.fmtInt(g.cost) + '</td><td class="n">' + fmt.fmtInt(g.ton) + '</td><td class="n">' + fmt.fmtPct(g.backlogRate, 2) + '</td></tr>').join('');
    const t = c.totals;
    const gdvTable = block('Theo từng GĐV — ' + label(c) + est,
      table(['GĐV', 'HS phát sinh', 'HS duyệt', 'Tỷ lệ hoàn thành', 'CP bình quân', 'Tồn lũy kế', 'Tỉ lệ tồn'], gdvRows,
        '<tr class="tot"><td>Tổng</td><td class="n">' + fmt.fmtInt(t.issued) + '</td><td class="n">' + fmt.fmtInt(t.approved) + '</td><td class="n">' + fmt.fmtPct(t.completion) + '</td><td class="n">' + fmt.fmtInt(t.cost) + '</td><td class="n">' + fmt.fmtInt(t.ton) + '</td><td class="n">' + fmt.fmtPct(t.backlogRate, 2) + '</td></tr>'));

    const pt = p.totals;
    const cmpRows = [
      ['HS phát sinh', fmt.fmtInt(pt.issued), fmt.fmtInt(t.issued), delta(r.compare.issued), false],
      ['HS duyệt', fmt.fmtInt(pt.approved), fmt.fmtInt(t.approved), delta(r.compare.approved), false],
      ['Tỷ lệ hoàn thành', fmt.fmtPct(pt.completion), fmt.fmtPct(t.completion), delta(r.compare.completion, 'pct'), false],
      ['CP bình quân', fmt.fmtInt(pt.cost), fmt.fmtInt(t.cost), deltaGood(r.compare.cost, 'int', true), false],
      ['Tồn lũy kế' + (p.estimate ? ' (kỳ trước ước tính)' : ''), fmt.fmtInt(pt.ton), fmt.fmtInt(t.ton), deltaGood(r.compare.ton, 'int', true), false],
      ['Tỉ lệ tồn', fmt.fmtPct(pt.backlogRate, 2), fmt.fmtPct(t.backlogRate, 2), deltaGood(r.compare.backlogRate, 'pct', true), false],
      ['Tổng điểm (chưa giới hạn)', fmt.fmtScore(p.kpis.uncapped), fmt.fmtScore(c.kpis.uncapped), delta(r.compare.uncapped, 'score'), false],
      ['Tổng điểm (đã giới hạn)', fmt.fmtScore(p.kpis.capped), fmt.fmtScore(c.kpis.capped), delta(r.compare.capped, 'score'), false]
    ].map(x => '<tr><td>' + x[0] + '</td><td class="n">' + x[1] + '</td><td class="n">' + x[2] + '</td><td class="n">' + x[3] + '</td></tr>').join('');
    const cmpTable = block('So sánh với tháng trước', table(['Chỉ tiêu', label(p) + (p.estimate ? ' (ước tính)' : ''), label(c), 'Chênh lệch'], cmpRows));

    const need = c.needMore > 0
      ? '<div class="kz-need kz-fail"><b>' + fmt.fmtInt(c.needMore) + '</b> hồ sơ cần duyệt thêm để đạt 90%<small>Cần ' + fmt.fmtInt(c.target) + ' (làm tròn lên của 90% × ' + fmt.fmtInt(t.issued) + ' phát sinh), hiện đã duyệt ' + fmt.fmtInt(t.approved) + '.</small></div>'
      : '<div class="kz-need kz-pass"><b>Đã đạt</b> mục tiêu 90%<small>Cần ' + fmt.fmtInt(c.target) + ', đã duyệt ' + fmt.fmtInt(t.approved) + '.</small></div>';

    const ageRows = c.ageBuckets.map(b => '<tr><td>' + b.label + '</td><td class="n">' + fmt.fmtInt(b.count) + '</td></tr>').join('');
    const stRows = c.byStatus.map(s => '<tr><td>' + esc(s.status) + '</td><td class="n">' + fmt.fmtInt(s.count) + '</td></tr>').join('') || '<tr><td colspan="2" class="kz-none">Không có hồ sơ tồn</td></tr>';
    const aging = block('Tồn lũy kế theo tuổi và theo trạng thái' + (c.estimate ? ' (ước tính)' : ''),
      '<div class="kz-two">' + table(['Tuổi hồ sơ tồn', 'Số hồ sơ'], ageRows, '<tr class="tot"><td>Tổng</td><td class="n">' + fmt.fmtInt(t.ton) + '</td></tr>') + table(['Trạng thái', 'Số hồ sơ'], stRows) + '</div>' +
      '<p class="kz-note">Tuổi = số ngày từ ngày mở hồ sơ tới ' + (c.estimate ? 'cuối tháng' : 'ngày dữ liệu') + '.</p>');

    return warn + cards + kpiTable + gdvTable + cmpTable + block('Số hồ sơ cần duyệt thêm', need) + unapprovedBlock(c) + aging;
  }

  function unapprovedBlock(c) {
    const gdvs = [...new Set(c.unapproved.map(x => x.gdv))], statuses = [...new Set(c.unapproved.map(x => x.status || '(trống)'))];
    const opt = (list, value) => '<option value="">Tất cả</option>' + list.map(x => '<option' + (x === value ? ' selected' : '') + '>' + esc(x) + '</option>').join('');
    const rows = filteredUnapproved(c).map(x => '<tr><td>' + esc(x.id) + '</td><td>' + esc(x.gdv) + '</td><td>' + esc(x.status || '(trống)') + '</td><td class="n">' + fmt.fmtDate(x.open) + '</td><td class="n' + (x.days > 30 ? ' kz-late' : '') + '">' + x.days + '</td><td class="n">' + fmt.fmtInt(x.damage) + '</td></tr>').join('');
    return block('Hồ sơ mở trong tháng nhưng chưa duyệt (' + fmt.fmtInt(c.unapproved.length) + ')',
      '<div class="kz-filters"><label>GĐV <select data-kz-fgdv>' + opt(gdvs, listFilter.gdv) + '</select></label><label>Trạng thái <select data-kz-fstatus>' + opt(statuses, listFilter.status) + '</select></label>' +
      '<label>Sắp xếp <select data-kz-fsort><option value="desc"' + (listFilter.sort === 'desc' ? ' selected' : '') + '>Số ngày giảm dần</option><option value="asc"' + (listFilter.sort === 'asc' ? ' selected' : '') + '>Số ngày tăng dần</option></select></label></div>' +
      '<div class="kz-scroll" data-kz-list>' + table(['Số hồ sơ', 'GĐV', 'Trạng thái', 'Ngày mở', 'Số ngày', 'Ước thiệt hại'], rows || '<tr><td colspan="6" class="kz-none">Không có hồ sơ</td></tr>') + '</div>');
  }

  function filteredUnapproved(c) {
    const list = c.unapproved.filter(x => (!listFilter.gdv || x.gdv === listFilter.gdv) && (!listFilter.status || (x.status || '(trống)') === listFilter.status));
    return listFilter.sort === 'asc' ? [...list].reverse() : list;
  }

  const card = (title, value, change, hint) => '<div class="kz-score"><span>' + title + '</span><b>' + value + '</b><div>so với tháng trước ' + delta(change, 'score') + '</div><small>' + hint + '</small></div>';
  const block = (title, inner) => '<section class="sf-library kz-card"><h2 class="kz-h">' + title + '</h2>' + inner + '</section>';
  const table = (heads, rows, foot) => '<div class="kz-tablewrap"><table class="kz-table"><thead><tr>' + heads.map((h, i) => '<th' + (i ? ' class="n"' : '') + '>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody>' + (foot ? '<tfoot>' + foot + '</tfoot>' : '') + '</table></div>';

  // ----- Nạp dữ liệu từ hồ sơ bồi thường trong hệ thống -----
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
      const c = report.current, p = report.previous, t = c.totals;
      const est = c.estimate ? ' (tồn ước tính)' : '';
      const book = XLSX.utils.book_new();
      const sheet = (name, aoa, widths) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = widths.map(w => ({wch: w})); XLSX.utils.book_append_sheet(book, ws, name); };
      sheet('KPI', [['Báo cáo KPI bồi thường ' + label(c) + est], ['Dữ liệu đến ngày', fmt.fmtDate(prep.asOf)], [],
        ['Nhóm KPI', 'Tỷ trọng', 'Mục tiêu', 'Kết quả', 'Điểm', 'Điểm sau giới hạn', 'Điểm hụt'],
        ...c.kpis.rows.map(k => [k.label, k.weight, k.target, k.result ?? '-', k.score ?? '-', k.cappedScore ?? '-', k.shortfall ?? '-']),
        ['Tổng', 1, '', '', c.kpis.uncapped, c.kpis.capped, '']], [34, 10, 14, 14, 12, 18, 12]);
      sheet('Theo GĐV', [['GĐV', 'HS phát sinh', 'HS duyệt', 'Tỷ lệ hoàn thành', 'CP bình quân', 'Tồn lũy kế', 'HS phát sinh từ 01/01', 'Tỉ lệ tồn', 'Mở trong tháng chưa duyệt'],
        ...c.perGdv.map(g => [g.gdv, g.issued, g.approved, g.completion ?? '-', g.cost ?? '-', g.ton, g.ytd, g.backlogRate ?? '-', g.unapproved]),
        ['Tổng', t.issued, t.approved, t.completion ?? '-', t.cost ?? '-', t.ton, t.ytd, t.backlogRate ?? '-', c.unapproved.length]], [28, 14, 12, 16, 14, 12, 20, 10, 24]);
      sheet('So sánh', [['Chỉ tiêu', label(p), label(c), 'Chênh lệch'],
        ['HS phát sinh', p.totals.issued, t.issued, report.compare.issued], ['HS duyệt', p.totals.approved, t.approved, report.compare.approved],
        ['Tỷ lệ hoàn thành', p.totals.completion ?? '-', t.completion ?? '-', report.compare.completion ?? '-'], ['CP bình quân', p.totals.cost ?? '-', t.cost ?? '-', report.compare.cost ?? '-'],
        ['Tồn lũy kế', p.totals.ton, t.ton, report.compare.ton], ['Tỉ lệ tồn', p.totals.backlogRate ?? '-', t.backlogRate ?? '-', report.compare.backlogRate ?? '-'],
        ['Tổng điểm chưa giới hạn', p.kpis.uncapped, c.kpis.uncapped, report.compare.uncapped], ['Tổng điểm đã giới hạn', p.kpis.capped, c.kpis.capped, report.compare.capped],
        [], ['Cần duyệt thêm để đạt 90%', c.needMore, 'Cần', c.target]], [30, 16, 16, 16]);
      sheet('HS chưa duyệt', [['Số hồ sơ', 'GĐV', 'Trạng thái', 'Ngày mở', 'Số ngày', 'Ước thiệt hại'],
        ...filteredUnapproved(c).map(x => [x.id, x.gdv, x.status, fmt.fmtDate(x.open), x.days, x.damage])], [24, 26, 20, 12, 10, 16]);
      sheet('Tồn theo tuổi', [['Tuổi hồ sơ tồn', 'Số hồ sơ'], ...c.ageBuckets.map(b => [b.label, b.count]), [], ['Trạng thái', 'Số hồ sơ'], ...c.byStatus.map(s => [s.status, s.count])], [26, 12]);
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
      if (el.matches('[data-kz-month]')) { monthValue = el.value || defaultMonth(); recalc(); }
      else if (el.matches('[data-kz-gdv]')) {
        selected = [...host.querySelectorAll('[data-kz-gdv]:checked')].map(x => x.value);
        if (!selected.length) { el.checked = true; selected = [el.value]; message('Cần chọn ít nhất một GĐV.', 'warn'); }
        recalc();
      } else if (el.matches('[data-kz-fgdv],[data-kz-fstatus],[data-kz-fsort]')) {
        listFilter = {gdv: host.querySelector('[data-kz-fgdv]').value, status: host.querySelector('[data-kz-fstatus]').value, sort: host.querySelector('[data-kz-fsort]').value};
        if (report) host.querySelector('[data-kz-list]').innerHTML = table(['Số hồ sơ', 'GĐV', 'Trạng thái', 'Ngày mở', 'Số ngày', 'Ước thiệt hại'],
          filteredUnapproved(report.current).map(x => '<tr><td>' + esc(x.id) + '</td><td>' + esc(x.gdv) + '</td><td>' + esc(x.status || '(trống)') + '</td><td class="n">' + fmt.fmtDate(x.open) + '</td><td class="n' + (x.days > 30 ? ' kz-late' : '') + '">' + x.days + '</td><td class="n">' + fmt.fmtInt(x.damage) + '</td></tr>').join('') || '<tr><td colspan="6" class="kz-none">Không có hồ sơ</td></tr>');
      }
    });
    host.addEventListener('click', event => { if (event.target.closest('[data-kz-export]')) exportExcel(); });
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
