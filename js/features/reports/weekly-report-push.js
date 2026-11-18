/* Đồng bộ TỰ ĐỘNG (real time) báo cáo tuần Zone sang Supabase để xem trên điện thoại (trang Tasco DLK mobile).
 * Mỗi kỳ báo cáo = 1 hàng (id = "YYYY-MM-DD_YYYY-MM-DD"); số liệu đổi thì ghi đè, không đổi thì bỏ qua. Chỉ Admin được ghi/đọc (RLS).
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
  // ----- Đồng bộ TỰ ĐỘNG (real time): webapp đổi dữ liệu → dựng lại các kỳ cần thiết → chỉ ghi kỳ nào có số liệu thay đổi.
  const DELAY_MS = 5000, pushedFp = new Map();
  let timer = 0, builder = null, running = false, blocked = false, state = {status: 'idle', at: 0, message: ''}, listeners = [];
  const fingerprint = snap => JSON.stringify(snap.payload) + '|' + snap.label;
  const setState = (status, message) => { state = {status, at: Date.now(), message: message || ''}; listeners.slice().forEach(cb => { try { cb(state); } catch (e) { console.error(e); } }); };
  const onStatus = cb => { listeners.push(cb); try { cb(state); } catch (e) { console.error(e); } return () => { listeners = listeners.filter(x => x !== cb); }; };
  // Chọn các bản chụp thật sự cần ghi (khác lần ghi trước).
  const changed = snaps => snaps.filter(snap => pushedFp.get(snap.id) !== fingerprint(snap));
  async function run(force) {
    if (running || !builder || (blocked && !force)) return state;
    running = true;
    try {
      const snaps = changed(builder());
      if (!snaps.length) { if (state.status !== 'ok') setState('ok'); return state; }
      setState('syncing');
      for (const snap of snaps) {
        const res = await push(snap);
        if (!res.ok) {
          if (res.reason === 'denied') blocked = true;
          setState(res.reason === 'signedout' ? 'signedout' : res.reason === 'denied' ? 'denied' : 'error', res.message);
          return state;
        }
        pushedFp.set(snap.id, fingerprint(snap));
      }
      blocked = false; setState('ok');
    } catch (error) { setState('error', error && error.message); }
    finally { running = false; }
    return state;
  }
  // build: () => mảng bản chụp (gọi lúc đã gom nhịp để lấy dữ liệu mới nhất).
  function schedule(build) { builder = build || builder; clearTimeout(timer); timer = setTimeout(() => { run(false); }, DELAY_MS); }
  async function syncNow() { blocked = false; clearTimeout(timer); return run(true); }
  return {buildSnapshot, push, schedule, syncNow, onStatus, get state() { return state; }, pure: {buildSnapshot, ymd, num, fingerprint, changed: snaps => changed(snaps)}, _reset: () => { pushedFp.clear(); blocked = false; running = false; clearTimeout(timer); builder = null; }};
})();
