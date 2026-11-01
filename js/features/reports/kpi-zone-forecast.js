// Dự báo KPI Zone cuối tháng: hàm TÍNH THUẦN dựa trên kết quả KpiZoneCalc.computeMonth() của tháng đang chạy.
// Giả định (nêu rõ trên giao diện): giữ nguyên nhịp mở/duyệt hồ sơ trung bình từ đầu tháng tới nay; CP bình quân giữ như hiện tại.
//  - Tỷ lệ hoàn thành = (đã duyệt + nhịp duyệt × ngày còn lại) / (đã mở + nhịp mở × ngày còn lại)
//  - Tỉ lệ tồn        = (tồn hiện tại + (nhịp mở − nhịp duyệt) × ngày còn lại) / (lũy kế năm + nhịp mở × ngày còn lại)
const KpiZoneForecast = (() => {
  const K = typeof KpiZoneCalc !== 'undefined' ? KpiZoneCalc : null;
  const LOW_CONFIDENCE_DAYS = 7;
  const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const ceilTarget = (rate, count) => Math.ceil(Math.round(rate * count * 1e6) / 1e6);

  function scoreRows(calc, completion, cost, backlog) {
    const rows = [['completion', completion], ['cost', cost], ['backlog', backlog]].map(([key, result]) => {
      const kpi = calc.KPI[key], s = calc.score(kpi, result);
      return {key, label: kpi.label, weight: kpi.weight, target: kpi.target, result, score: s, capped: s === null ? null : Math.min(s, kpi.weight),
        pass: s === null ? null : (kpi.higherBetter ? result >= kpi.target : result <= kpi.target)};
    });
    const sum = pick => rows.reduce((a, r) => a + (r[pick] || 0), 0);
    return {rows, uncapped: sum('score'), capped: sum('capped')};
  }

  // verdict: on = đủ điểm · watch = gần đạt (≥ 90% điểm) · risk = có nguy cơ hụt
  function verdictOf(capped, failing) {
    if (failing.length === 0 && capped >= 0.9999) return {key: 'on', label: 'Đang đi đúng hướng'};
    if (capped >= 0.9) return {key: 'watch', label: 'Gần đạt – cần theo dõi'};
    return {key: 'risk', label: 'Có nguy cơ hụt điểm'};
  }

  function build(current, calc = K) {
    if (!calc || !current || !current.pace || current.estimate || current.futureMonth) return null;
    const p = current.pace, t = current.totals, left = p.left;
    const projIssued = p.projIssued, projApproved = p.projApproved;
    const completion = projIssued > 0 ? projApproved / projIssued : null;
    const cost = num(t.cost);
    const projTon = Math.max(0, t.ton + (p.perDayIssued - p.perDayApproved) * left);
    const projYtd = t.ytd + p.perDayIssued * left;
    const backlog = projYtd > 0 ? projTon / projYtd : null;

    const now = scoreRows(calc, t.completion, cost, t.backlogRate);
    const end = scoreRows(calc, completion, cost, backlog);
    const failing = end.rows.filter(r => r.pass === false);
    const verdict = verdictOf(end.capped, failing);

    // Nhịp cần có để chốt tháng ở đúng 90% theo số hồ sơ dự kiến cuối tháng (hồ sơ mới mở vẫn tăng thêm).
    const targetEnd = ceilTarget(calc.KPI.completion.target, Math.ceil(projIssued));
    const needTotal = Math.max(0, targetEnd - t.approved);
    const requiredPerDay = left > 0 ? needTotal / left : null;
    const gapPerDay = requiredPerDay === null ? null : requiredPerDay - p.perDayApproved; // > 0: cần nhanh hơn hiện tại

    // GĐV nào đang kéo điểm: ưu tiên người còn thiếu nhiều nhất so với 90% hồ sơ của chính họ.
    const drivers = (current.perGdv || []).filter(g => g.issued > 0 || g.ton > 0).map(g => ({
      gdv: g.gdv, issued: g.issued, approved: g.approved, completion: g.completion, gap: g.gap, unapproved: g.unapproved, ton: g.ton, tonOver30: g.tonOver30
    })).sort((a, b) => b.gap - a.gap || b.tonOver30 - a.tonOver30);

    const actions = [];
    const cRow = end.rows.find(r => r.key === 'completion'), kRow = end.rows.find(r => r.key === 'cost'), bRow = end.rows.find(r => r.key === 'backlog');
    if (cRow.pass === false) actions.push({tone: 'bad', text: `Tỷ lệ hoàn thành dự kiến ${pct(completion)} (< 90%): cần duyệt thêm ≈ ${needTotal} hồ sơ, tức ${dec(requiredPerDay)}/ngày trong ${left} ngày còn lại (hiện ${dec(p.perDayApproved)}/ngày).`});
    else if (cRow.pass) actions.push({tone: 'good', text: `Tỷ lệ hoàn thành dự kiến ${pct(completion)}, đạt mục tiêu nếu giữ nhịp ${dec(p.perDayApproved)} hồ sơ/ngày.`});
    if (bRow.pass === false) actions.push({tone: 'bad', text: `Tỉ lệ tồn dự kiến ${pct(backlog, 2)} (> 10%): cần giải quyết bớt hồ sơ tồn, ưu tiên nhóm quá 30 ngày (${current.analysis.tonOver30} hồ sơ).`});
    else if (bRow.pass && current.analysis.tonOver30 > 0) actions.push({tone: 'info', text: `Tỉ lệ tồn dự kiến ${pct(backlog, 2)} vẫn đạt, nhưng còn ${current.analysis.tonOver30} hồ sơ tồn quá 30 ngày cần xử lý dứt điểm.`});
    if (kRow.pass === false) actions.push({tone: 'bad', text: `CP bình quân ${fmtInt(cost)} đ vượt mục tiêu ${fmtInt(kRow.target)} đ: rà soát hồ sơ chi phí cao trước khi duyệt.`});
    const worst = drivers.find(d => d.gap > 0);
    if (worst && cRow.pass === false) actions.push({tone: 'warn', text: `${worst.gdv} đang thiếu ${worst.gap} hồ sơ so với 90% của chính họ (còn ${worst.unapproved} hồ sơ mở trong tháng chưa duyệt).`});

    return {
      asOfElapsed: p.elapsed, daysLeft: left, daysInMonth: p.daysInMonth, lowConfidence: p.elapsed < LOW_CONFIDENCE_DAYS,
      now: {uncapped: now.uncapped, capped: now.capped},
      projected: {issued: projIssued, approved: projApproved, completion, cost, backlog, ton: projTon, uncapped: end.uncapped, capped: end.capped, rows: end.rows},
      delta: {uncapped: end.uncapped - now.uncapped, capped: end.capped - now.capped},
      needTotal, requiredPerDay, perDayApproved: p.perDayApproved, gapPerDay,
      verdict, failing: failing.map(r => r.key), drivers, actions
    };
  }

  const dec = (n, d = 1) => (n === null || n === undefined || !Number.isFinite(n) ? '-' : n.toFixed(d).replace('.', ','));
  const pct = (n, d = 1) => (n === null || n === undefined || !Number.isFinite(n) ? '-' : (n * 100).toFixed(d).replace('.', ',') + '%');
  const fmtInt = n => (n === null || n === undefined || !Number.isFinite(n) ? '-' : Math.round(n).toLocaleString('vi-VN'));

  return {build, verdictOf, LOW_CONFIDENCE_DAYS};
})();
if (typeof window !== 'undefined') window.KpiZoneForecast = KpiZoneForecast;
