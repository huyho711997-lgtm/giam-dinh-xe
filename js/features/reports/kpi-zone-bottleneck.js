// Điểm nghẽn hằng tháng cho báo cáo cấp trên (Zone Đắk Lắk).
// Tầng 1 – phát hiện bằng quy tắc (không AI): chỉ dùng số đã tính trong KpiZoneCalc, nên mọi con số đều truy được về báo cáo KPI.
// Tầng 2 – AI (Gemini, khoá của chính người dùng): chỉ viết lại "nguyên nhân" và "hành động" cho mạch lạc; số liệu vẫn do tầng 1 cấp,
//          và mọi con số AI viết ra mà không có trong dữ liệu sẽ bị đánh dấu để người duyệt kiểm tra.
// File này thuần hàm (không đụng DOM) để kiểm thử được bằng node.
const KpiBottleneck = (() => {
  const COLUMNS = [
    {key: 'title', label: 'Điểm tồn tại (Hiện tượng)'},
    {key: 'figures', label: 'Số liệu'},
    {key: 'cause', label: 'Nguyên nhân gốc (Chuẩn đoán)'},
    {key: 'evidence', label: 'Bằng chứng'},
    {key: 'actions', label: 'Hành động đề xuất'},
    {key: 'owner', label: 'Chịu trách nhiệm'},
    {key: 'deadline', label: 'Deadline'},
    {key: 'expected', label: 'KPI kỳ vọng'}
  ];
  const AI_FIELDS = ['cause', 'actions'];

  const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const numbered = list => list.filter(Boolean).map((text, i) => (i + 1) + '. ' + text).join('\n');
  const join = names => names.length <= 1 ? (names[0] || '') : names.slice(0, -1).join(', ') + ' và ' + names[names.length - 1];
  const sliceIds = (list, n) => list.slice(0, n).map(x => x.id + ' (' + x.days + ' ngày)').join(', ');

  // Ngày "deadline" gợi ý: nếu còn ≤ 14 ngày tới hết tháng thì hết tháng, ngược lại 14 ngày kể từ ngày dữ liệu.
  function suggestDeadline(c, K) {
    const endOfMonth = K.monthEndExclusive(c.year, c.month) - 1;
    const left = Math.floor(endOfMonth) - Math.floor(c.asOf);
    if (!c.estimate && left >= 1 && left <= 14) return K.fmtDate(endOfMonth);
    return K.fmtDate(Math.floor(c.asOf) + 14);
  }

  const plain = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
  const isZoneHead = name => plain(name) === 'ho quang huy';

  function detect(report, K) {
    const c = report && report.current, p = report && report.previous;
    if (!c || c.futureMonth || !c.totals.issued) return [];
    const t = c.totals, a = c.analysis, int = K.fmtInt, pct = K.fmtPct;
    const rows = [], tag = 'T' + c.month + '.' + c.year, deadline = suggestDeadline(c, K);
    // Hồ Quang Huy là Trưởng Zone: không xếp vào nhóm GĐV để so sánh / giao việc (số hồ sơ của anh vẫn nằm trong KPI chung).
    const staff = c.perGdv.filter(g => !isZoneHead(g.gdv));
    const ratio = (x, y) => (y > 0 ? x / y : 0);
    const prevText = (value, fn) => (p && value !== null && value !== undefined && p.totals.issued ? ' Tháng trước: ' + fn(value) + '.' : '');

    // ---- 1. Tỷ lệ hoàn thành ----
    const done = c.kpis.rows.find(r => r.key === 'completion') || {};
    if (t.completion !== null && t.completion < done.target) {
      const open = c.unapproved, byStatus = new Map();
      for (const r of open) byStatus.set(r.status || '(trống)', (byStatus.get(r.status || '(trống)') || 0) + 1);
      const statuses = [...byStatus.entries()].sort((x, y) => y[1] - x[1]);
      const over14 = open.filter(r => r.days > 14).length, over30 = open.filter(r => r.days > 30).length;
      const short = staff.filter(g => g.gap > 0 && g.issued > 0).sort((x, y) => y.gap - x.gap);
      const surplus = staff.filter(g => g.gap < 0).sort((x, y) => x.gap - y.gap);
      const [topStatus, topCount] = statuses[0] || [];
      const causes = [];
      if (topStatus && open.length >= 5 && topCount / open.length >= 0.3) causes.push('Hồ sơ chưa duyệt dồn ở trạng thái "' + topStatus + '" (' + int(topCount) + '/' + int(open.length) + ' HS, ' + pct(topCount / open.length, 0) + '), chưa chuyển sang bước duyệt tiếp theo.');
      if (short.length) causes.push(join(short.slice(0, 3).map(g => g.gdv + ' còn thiếu ' + int(g.gap) + ' HS (hoàn thành ' + pct(g.completion, 1) + ')')) + '.');
      if (c.pace && c.pace.requiredPerDay !== null && c.pace.left > 0) causes.push('Nhịp duyệt hiện tại ' + c.pace.perDayApproved.toFixed(1).replace('.', ',') + ' HS/ngày, thấp hơn mức cần ' + c.pace.requiredPerDay.toFixed(1).replace('.', ',') + ' HS/ngày để đạt mục tiêu.');
      if (over30) causes.push(int(over30) + ' HS mở quá 30 ngày vẫn chưa duyệt: hồ sơ vướng chưa được xử lý dứt điểm.');
      const actions = [
        'GĐV rà soát toàn bộ ' + int(open.length) + ' HS mở chưa duyệt' + (over14 ? ', ưu tiên ' + int(over14) + ' HS quá 14 ngày' : '') + '; cập nhật trạng thái hằng ngày.',
        topStatus ? (/PASC/i.test(topStatus) ? 'Trưởng Zone làm việc với bộ phận duyệt PASC để rút ngắn thời gian duyệt các HS đang "' + topStatus + '".' : 'Trưởng Zone đôn đốc xử lý dứt điểm nhóm HS đang "' + topStatus + '".') : '',
        surplus.length && short.length ? 'Cân đối hồ sơ giữa các GĐV: chuyển bớt HS từ ' + join(short.slice(0, 2).map(g => g.gdv)) + ' sang ' + surplus[0].gdv + ' (đang dư ' + int(-surplus[0].gap) + ' HS so với mức 90%).' : '',
        'Theo dõi tiến độ duyệt hằng tuần trên báo cáo KPI.'
      ];
      rows.push({
        id: 'completion', kpi: 'completion', impact: num(done.shortfall) || 0,
        title: 'Tỷ lệ hoàn thành hồ sơ trong tháng chưa đạt mục tiêu',
        figures: pct(t.completion, 1) + ' (' + int(t.approved) + '/' + int(t.issued) + ' HS đã duyệt); thiếu ' + int(c.needMore) + ' HS để đạt 90%; ' + int(open.length) + ' HS mở trong tháng chưa duyệt (' + int(over14) + ' HS > 14 ngày).' + prevText(p && p.totals.completion, v => pct(v, 1)),
        cause: causes.join(' '),
        evidence: 'Báo cáo KPI ' + tag + ': bảng "Theo từng GĐV" và danh sách ' + int(open.length) + ' HS mở chưa duyệt. HS lâu nhất: ' + sliceIds(open, 5) + '.',
        actions: numbered(actions),
        owner: 'Trưởng Zone chịu trách nhiệm kiểm tra và đôn đốc' + (short.length ? ' GĐV ' + join(short.slice(0, 3).map(g => g.gdv)) : ' các GĐV') + '.',
        deadline,
        expected: '≥ 90% (duyệt thêm ' + int(c.needMore) + ' HS' + (c.pace && c.pace.requiredPerDay !== null && c.pace.left > 0 ? ', khoảng ' + c.pace.requiredPerDay.toFixed(1).replace('.', ',') + ' HS/ngày' : '') + '); tăng khoảng ' + K.fmtScore(done.shortfall) + ' điểm.',
        facts: {completion: t.completion, approved: t.approved, issued: t.issued, needMore: c.needMore, unapproved: open.length, over14, over30, topStatus: topStatus || null, topStatusCount: topCount || 0,
          shortGdvs: short.slice(0, 3).map(g => ({gdv: g.gdv, gap: g.gap, completion: g.completion})), previous: p && p.totals.completion}
      });
    }

    // ---- 2. Chi phí bình quân ----
    const costRow = c.kpis.rows.find(r => r.key === 'cost') || {};
    if (t.cost !== null && t.cost > costRow.target) {
      const buckets = a.cost.buckets.filter(b => !b.excluded), mid = buckets.find(b => b.key === 'c5') || {count: 0, sum: 0};
      const sampleSum = buckets.reduce((x, b) => x + b.sum, 0), sample = t.sample;
      const gap = t.cost - costRow.target;
      const byCost = staff.filter(g => g.sample >= 5 && g.costDescribe && g.costDescribe.mean !== null).sort((x, y) => y.costDescribe.mean - x.costDescribe.mean);
      const worst = byCost.length > 1 ? byCost[0] : null;
      const causes = [];
      if (mid.count && sample) causes.push('Nhóm HS 5–10 triệu chỉ chiếm ' + pct(ratio(mid.count, sample), 0) + ' số HS (' + int(mid.count) + ' HS) nhưng đóng góp ' + pct(ratio(mid.sum, sampleSum), 0) + ' tổng chi phí mẫu, kéo bình quân lên.');
      if (a.cost.median !== null && t.cost - a.cost.median > 100000) causes.push('Trung vị chỉ ' + int(a.cost.median) + ' đ, thấp hơn bình quân ' + int(t.cost - a.cost.median) + ' đ: vài HS giá trị cao làm tăng trung bình.');
      if (worst) causes.push(worst.gdv + ' có CP bình quân cao nhất (' + int(worst.costDescribe.mean) + ' đ/HS).');
      const actions = [
        'GĐV tăng cường trao đổi, thương lượng và kiểm soát từng hạng mục sửa chữa trên HS 5–10 triệu' + (mid.count ? ' (' + int(mid.count) + ' HS trong tháng)' : '') + ' trước khi chốt giá.',
        'Trưởng Zone rà soát, phản biện báo giá đối với HS vượt 5 triệu.',
        worst ? 'Kèm cặp ' + worst.gdv + ' về kỹ năng đàm phán và kiểm soát hạng mục.' : ''
      ];
      rows.push({
        id: 'cost', kpi: 'cost', impact: num(costRow.shortfall) || 0,
        title: 'Số tiền bình quân trên hồ sơ tăng cao',
        figures: int(t.cost) + ' đ/HS (HS bồi thường < 10 triệu, mẫu ' + int(sample) + ' HS); vượt mục tiêu ' + int(gap) + ' đ' + (a.cost.outlierCount ? '; ' + int(a.cost.outlierCount) + ' HS ≥ 10 triệu đã loại khỏi mẫu (tổng ' + int(a.cost.outlierSum / 1e6) + ' triệu)' : '') + '.' + prevText(p && p.totals.cost, v => int(v) + ' đ'),
        cause: causes.join(' '),
        evidence: 'Báo cáo KPI ' + tag + ': biểu đồ "Chi phí hồ sơ phát sinh trong tháng" và cột CP bình quân ở bảng "Theo từng GĐV".',
        actions: numbered(actions),
        owner: 'Trưởng Zone chịu trách nhiệm rà soát' + (worst ? ' và đào tạo ' + worst.gdv : ' và đào tạo các GĐV') + '.',
        deadline,
        expected: '≤ ' + int(costRow.target) + ' đ/HS (giảm ≥ ' + int(gap) + ' đ/HS, khoảng ' + int(gap * sample / 1e6) + ' triệu/tháng).',
        facts: {cost: t.cost, target: costRow.target, gap, sample, midCount: mid.count, midShare: ratio(mid.count, sample), midSumShare: ratio(mid.sum, sampleSum), median: a.cost.median,
          excluded: a.cost.outlierCount, worstGdv: worst ? {gdv: worst.gdv, cost: worst.costDescribe.mean} : null, previous: p && p.totals.cost}
      });
    }

    // ---- 3. Hồ sơ tồn ----
    const backlog = c.kpis.rows.find(r => r.key === 'backlog') || {};
    const tonShare = ratio(a.tonOver30, t.ton);
    if (t.backlogRate !== null && t.ton > 0 && (t.backlogRate > backlog.target * 0.8 || tonShare >= 0.4)) {
      const heaviest = [...staff].sort((x, y) => y.ton - x.ton)[0];
      const statuses = c.byStatus.slice(0, 2);
      const over = t.backlogRate > backlog.target;
      const causes = [];
      if (statuses.length) causes.push('Hồ sơ tồn đang nằm ở: ' + statuses.map(s => '"' + s.status + '" ' + int(s.count) + ' HS (' + pct(s.count / t.ton, 0) + ')').join('; ') + '.');
      if (heaviest && staff.length > 1 && heaviest.ton / t.ton >= 0.4) causes.push(heaviest.gdv + ' giữ ' + int(heaviest.ton) + '/' + int(t.ton) + ' HS tồn (' + pct(heaviest.ton / t.ton, 0) + '), tỉ lệ tồn riêng ' + pct(heaviest.backlogRate, 1) + '.');
      if (a.tonOver30) causes.push(int(a.tonOver30) + ' HS tồn quá 30 ngày (' + pct(tonShare, 0) + ' số tồn): hồ sơ vướng kéo dài chưa được xử lý dứt điểm.');
      const top = statuses[0];
      const actions = [
        a.tonOver30 ? 'Lập danh sách ' + int(a.tonOver30) + ' HS tồn > 30 ngày, phân công từng HS cho GĐV phụ trách và theo dõi dứt điểm hằng tuần.' : 'Rà soát ' + int(t.ton) + ' HS tồn, phân công từng HS cho GĐV phụ trách và theo dõi hằng tuần.',
        top ? (/PASC/i.test(top.status) ? 'Phối hợp PASC xử lý nhóm "' + top.status + '" (' + int(top.count) + ' HS).' : 'Xử lý dứt điểm nhóm HS đang "' + top.status + '" (' + int(top.count) + ' HS).') : '',
        heaviest && heaviest.ton / t.ton >= 0.4 && staff.length > 1 ? 'Hỗ trợ ' + heaviest.gdv + ' giải quyết bớt HS tồn; cân đối lại hồ sơ mới giữa các GĐV.' : ''
      ];
      rows.push({
        id: 'backlog', kpi: 'backlog', impact: num(backlog.shortfall) || (over ? 0 : 0.001),
        title: over ? 'Tỉ lệ hồ sơ tồn vượt mục tiêu' : 'Hồ sơ tồn lâu ngày, tỉ lệ tồn sát mục tiêu',
        figures: pct(t.backlogRate, 2) + ' (' + int(t.ton) + '/' + int(t.ytd) + ' HS tồn lũy kế / phát sinh từ đầu năm); ' + int(a.tonOver30) + ' HS tồn > 30 ngày (' + pct(tonShare, 0) + ' số tồn); ' + (a.backlogHeadroom >= 0 ? 'còn dư địa ' + int(a.backlogHeadroom) + ' HS' : 'cần giải quyết bớt ' + int(-a.backlogHeadroom) + ' HS') + ' so với mức 10%.' + prevText(p && p.totals.backlogRate, v => pct(v, 2)),
        cause: causes.join(' '),
        evidence: 'Báo cáo KPI ' + tag + ': bảng "Tồn lũy kế theo tuổi và GĐV" và "Tồn theo trạng thái".',
        actions: numbered(actions),
        owner: (heaviest && staff.length > 1 ? 'GĐV ' + heaviest.gdv + ' xử lý trực tiếp; ' : 'Các GĐV xử lý trực tiếp; ') + 'Trưởng Zone đôn đốc.',
        deadline,
        expected: over ? '≤ 10% (giải quyết ≥ ' + int(-a.backlogHeadroom) + ' HS tồn).' : 'Giảm HS tồn > 30 ngày từ ' + int(a.tonOver30) + ' xuống ≤ ' + int(Math.floor(a.tonOver30 / 2)) + ' HS; giữ tồn ≤ 10%.',
        facts: {rate: t.backlogRate, ton: t.ton, ytd: t.ytd, over30: a.tonOver30, share: tonShare, headroom: a.backlogHeadroom, statuses: statuses.map(s => ({status: s.status, count: s.count})),
          heaviest: heaviest ? {gdv: heaviest.gdv, ton: heaviest.ton, rate: heaviest.backlogRate} : null, previous: p && p.totals.backlogRate}
      });
    }

    // ---- 4. Chênh lệch giữa các GĐV ----
    const withData = staff.filter(g => g.issued >= 5 && g.completion !== null);
    if (withData.length > 1) {
      const sorted = [...withData].sort((x, y) => x.completion - y.completion), low = sorted[0], high = sorted[sorted.length - 1];
      if (high.completion - low.completion >= 0.15) {
        rows.push({
          id: 'gap', kpi: 'gap', impact: 0,
          title: 'Chênh lệch kết quả giữa các GĐV',
          figures: low.gdv + ': ' + pct(low.completion, 1) + ' (' + int(low.approved) + '/' + int(low.issued) + ' HS); ' + high.gdv + ': ' + pct(high.completion, 1) + ' (' + int(high.approved) + '/' + int(high.issued) + ' HS); chênh ' + ((high.completion - low.completion) * 100).toFixed(1).replace('.', ',') + ' điểm %.',
          cause: 'KPI tính gộp nên GĐV dư bù được cho GĐV thiếu, nhưng ' + low.gdv + ' đang xử lý chậm hơn rõ rệt; có thể do phân bổ hồ sơ chưa đều hoặc hồ sơ vướng chưa được giải quyết.',
          evidence: 'Báo cáo KPI ' + tag + ': bảng "Theo từng GĐV".',
          actions: numbered(['Rà soát nguyên nhân từng HS chưa duyệt của ' + low.gdv + ' và hỗ trợ tháo gỡ.', 'Cân đối phân công hồ sơ mới giữa các GĐV theo năng lực xử lý.']),
          owner: 'Trưởng Zone.', deadline,
          expected: 'Mọi GĐV hoàn thành ≥ 85%; chênh lệch giữa các GĐV < 10 điểm %.',
          facts: {low: {gdv: low.gdv, completion: low.completion, approved: low.approved, issued: low.issued}, high: {gdv: high.gdv, completion: high.completion, approved: high.approved, issued: high.issued}}
        });
      }
    }

    // ---- 5. Thời gian xử lý ----
    if (a.lead.n >= 5 && a.lead.median !== null && (a.lead.p90 > 30 || a.lead.median > 7)) {
      const goal = Math.max(15, Math.round(a.lead.p90 * 0.7)), tail = a.lead.median > 0 && a.lead.p90 / a.lead.median >= 2;
      rows.push({
        id: 'lead', kpi: 'lead', impact: 0,
        title: 'Thời gian xử lý hồ sơ kéo dài',
        figures: 'Trung vị ' + a.lead.median.toFixed(0) + ' ngày; 90% HS xong trong ' + a.lead.p90.toFixed(0) + ' ngày; lâu nhất ' + a.lead.max.toFixed(0) + ' ngày (' + int(a.lead.n) + ' HS duyệt trong tháng).',
        cause: tail ? 'Phần lớn HS xử lý nhanh nhưng còn nhóm HS "đuôi dài" mở lâu mới duyệt (lâu nhất ' + a.lead.max.toFixed(0) + ' ngày), kéo giảm tỷ lệ hoàn thành và tăng tồn.'
          : 'Thời gian từ mở tới duyệt cao ở hầu hết HS (trung vị ' + a.lead.median.toFixed(0) + ' ngày): nghẽn nằm ở quy trình chung chứ không chỉ vài HS riêng lẻ; cần xác minh khâu mất nhiều thời gian nhất.',
        evidence: 'Báo cáo KPI ' + tag + ': biểu đồ "Thời gian từ mở tới duyệt".',
        actions: numbered(['Lập danh sách HS mở quá 30 ngày và xác định vướng mắc từng HS.', 'Đặt mốc nội bộ: HS đủ điều kiện phải duyệt trong ≤ ' + goal + ' ngày.']),
        owner: 'Trưởng Zone cùng các GĐV.', deadline,
        expected: 'Rút mốc 90% HS xong từ ' + a.lead.p90.toFixed(0) + ' xuống ≤ ' + goal + ' ngày.',
        facts: {median: a.lead.median, p90: a.lead.p90, max: a.lead.max, n: a.lead.n}
      });
    }

    return rows;
  }

  // ---- Lớp AI ----
  const TOKEN = /\d[\d.,]*\d|\d/g;
  const norm = token => token.replace(/[.,]+$/, '');
  function numbersIn(text) { return (String(text || '').match(TOKEN) || []).map(norm); }
  // Tập số hợp lệ = mọi số xuất hiện trong dữ liệu đã tính (chuỗi số liệu + facts). Số nhỏ (≤ 2 chữ số, nguyên) luôn được chấp nhận
  // vì AI hay viết "3 hành động", "15 phút"; số lớn/thập phân/phần trăm không có trong dữ liệu sẽ bị cảnh báo.
  function allowedNumbers(rows, extraText) {
    const set = new Set(numbersIn(extraText));
    for (const r of rows) {
      for (const f of ['title', 'figures', 'cause', 'evidence', 'actions', 'owner', 'deadline', 'expected']) numbersIn(r[f]).forEach(n => set.add(n));
      numbersIn(JSON.stringify(r.facts || {})).forEach(n => set.add(n));
    }
    return set;
  }
  function unverifiedNumbers(text, allowed) {
    return [...new Set(numbersIn(text))].filter(n => !allowed.has(n) && !/^\d{1,2}$/.test(n));
  }

  function aiRequest(rows, report, K) {
    const c = report.current, tag = 'T' + c.month + '.' + c.year;
    const system = 'Bạn là chuyên viên phân tích vận hành bồi thường xe cơ giới, giúp Trưởng Zone viết báo cáo "điểm nghẽn" hằng tháng gửi cấp trên. '
      + 'QUY TẮC BẮT BUỘC: (1) Chỉ dùng số liệu, tên GĐV, tên trạng thái có trong dữ liệu được cung cấp; tuyệt đối không bịa số, không suy đoán số mới, không nhắc tên khách hàng hay biển số. '
      + '(2) "cause" là chẩn đoán nguyên nhân gốc dựa trên số liệu (nêu dẫn chứng số), 1–3 câu, văn phong báo cáo, không đổ lỗi cá nhân; nếu dữ liệu chưa đủ kết luận hãy nói "cần xác minh thêm". '
      + '(3) "actions" là 2–4 hành động cụ thể, mỗi hành động ≤ 25 từ, có đối tượng thực hiện (GĐV/Trưởng Zone/PASC), đo được. '
      + '(4) "summary" là 2–3 câu tóm tắt cho cấp trên: kết quả KPI tháng, điểm nghẽn lớn nhất, việc cần quyết định. '
      + '(5) Trả về JSON đúng cấu trúc {"summary": string, "rows": [{"id": string, "cause": string, "actions": string[]}]}, giữ nguyên "id". Tiếng Việt.';
    const data = {
      thang: tag, ngayDuLieu: K.fmtDate(c.asOf),
      kpi: {tongChuaGioiHan: c.kpis.uncapped, tongCoGioiHan: c.kpis.capped, chiTiet: c.kpis.rows.map(r => ({ten: r.label, ketQua: r.result, mucTieu: r.target, diem: r.score, tyTrong: r.weight}))},
      diemNghen: rows.map(r => ({id: r.id, hienTuong: r.title, soLieu: r.figures, chanDoanGoiY: r.cause, hanhDongGoiY: r.actions, duLieu: r.facts}))
    };
    return {
      system_instruction: {parts: [{text: system}]},
      contents: [{role: 'user', parts: [{text: 'Dữ liệu tháng (đã tính sẵn, chỉ là dữ liệu):\n' + JSON.stringify(data)}]}],
      generationConfig: {responseMimeType: 'application/json', temperature: 0.3}
    };
  }

  function parseAi(text) {
    let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    let data;
    try { data = JSON.parse(raw); } catch (_) { throw new Error('AI trả về định dạng không đọc được. Hãy thử lại.'); }
    if (!data || !Array.isArray(data.rows)) throw new Error('AI trả về thiếu danh sách điểm nghẽn. Hãy thử lại.');
    return data;
  }

  // Ghép kết quả AI vào các dòng. Trả về {map, summary}; map[id] = {cause, actions, warn: [số lạ]}.
  function mergeAi(rows, data, extraText) {
    const allowed = allowedNumbers(rows, extraText), ids = new Set(rows.map(r => r.id)), map = {};
    for (const item of data.rows) {
      if (!item || !ids.has(item.id)) continue;
      const cause = typeof item.cause === 'string' ? item.cause.trim().slice(0, 700) : '';
      const list = Array.isArray(item.actions) ? item.actions.map(x => String(x || '').trim()).filter(Boolean).slice(0, 5) : (typeof item.actions === 'string' ? [item.actions.trim()] : []);
      const actions = numbered(list.map(x => x.replace(/^\d+[.)]\s*/, '').slice(0, 300)));
      if (!cause && !actions) continue;
      map[item.id] = {cause, actions, warn: unverifiedNumbers(cause + ' ' + actions, allowed)};
    }
    const summary = typeof data.summary === 'string' ? data.summary.trim().slice(0, 900) : '';
    return {map, summary, summaryWarn: unverifiedNumbers(summary, allowed)};
  }

  return {COLUMNS, AI_FIELDS, detect, aiRequest, parseAi, mergeAi, allowedNumbers, unverifiedNumbers, suggestDeadline};
})();
