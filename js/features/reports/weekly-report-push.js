/* Đẩy BẢN CHỤP báo cáo tuần Zone (đúng số liệu đang hiển thị) sang Supabase để xem trên điện thoại (trang Tasco DLK mobile).
 * Mỗi kỳ báo cáo = 1 hàng (id = "YYYY-MM-DD_YYYY-MM-DD"); đẩy lại cùng kỳ thì ghi đè. Chỉ Admin được ghi/đọc (RLS).
 * Dùng chung phiên đăng nhập Supabase với tab Gara cứu hộ / Danh bạ (RescueGarages.getClient). */
const WeeklyReportPush = (() => {
  const T = 'tasco_weekly_reports', TIMEOUT_MS = 15000;
  const num = v => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? n : 0; };
  const text = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
  const ymd = d => Object.prototype.toString.call(d) === '[object Date]' && !Number.isNaN(d.getTime())
    ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : '';
  const KEYS = ['ps', 'dd', 'cd', 'dntt', 'carpla', 'tnds', 'ton', 'dpbt', 'avg', 'rev'];

  // period + list lấy từ getWeeklyZoneReportData(); rules = cachedReportRules. Công thức cột giống bảng trên webapp.
  function buildSnapshot(period, list, rules, pushedBy) {
    const start = ymd(period && period.startDate), end = ymd(period && period.endDate);
    if (!start || !end || end < start) throw new Error('Kỳ báo cáo không hợp lệ.');
    const r = rules || {};
    let sumAmt = 0, cntAmt = 0;
    const rows = (list || []).map(item => {
      sumAmt += Number(item.sumAmtUnder10M) || 0; cntAmt += Number(item.countUnder10M) || 0;
      return {
        gdv: text(item.gdvName, 120) || 'Chưa phân công', ps: num(item.phatSinh), dd: num(item.daDuyetHsb),
        cd: num(item.chuaDuyetPasc || Math.max(0, (item.phatSinh || 0) - (item.daDuyetHsb || 0))),
        dntt: num(item.chuyenDntt), carpla: num(item.carplaCount), tnds: num(item.tndsTonLuyKe), ton: num(item.hsTonOver30Days),
        dpbt: num(item.hsDuPhongOver50M), avg: item.countUnder10M > 0 ? num(item.sumAmtUnder10M / item.countUnder10M) : 0, rev: num(item.carplaCumulativeRevenue)
      };
    });
    const totals = Object.fromEntries(KEYS.map(k => [k, rows.reduce((s, x) => s + (k === 'avg' ? 0 : x[k]), 0)]));
    totals.avg = cntAmt > 0 ? num(sumAmt / cntAmt) : 0;   // bình quân chung = tổng tiền / tổng số hồ sơ, không phải trung bình các dòng
    return {
      id: start + '_' + end, start_date: start, end_date: end, label: text(period.label, 120),
      payload: {v: 1, startStr: text(period.startStr, 12), endStr: text(period.endStr, 12), month: period.endDate.getMonth() + 1,
        rules: {hsTonDays: num(r.hsTonDays), hsDpbtAmount: num(r.hsDpbtAmount), avgAmount: num(r.avgAmount)}, rows, totals},
      pushed_by: text(pushedBy, 120)
    };
  }
  const garages = () => (typeof RescueGarages !== 'undefined' && RescueGarages.getClient) ? RescueGarages : null;
  async function push(snapshot) {
    const g = garages(); if (!g) return {ok: false, reason: 'nomodule'};
    const api = await g.getClient(), {data} = await api.auth.getSession();
    if (!data || !data.session) return {ok: false, reason: 'signedout'};
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await api.from(T).upsert({...snapshot, pushed_at: new Date().toISOString()}, {onConflict: 'id'}).abortSignal(controller.signal);
      if (res.error) throw res.error;
      return {ok: true, id: snapshot.id};
    } catch (error) {
      const denied = error && (error.code === '42501' || /row.level security/i.test(error.message || ''));
      const missing = error && ['42P01', 'PGRST205'].includes(error.code);
      return {ok: false, reason: denied ? 'denied' : missing ? 'missing' : error && error.name === 'AbortError' ? 'timeout' : 'error', message: error && error.message || ''};
    } finally { clearTimeout(timer); }
  }
  return {buildSnapshot, push, pure: {buildSnapshot, ymd, num}};
})();
