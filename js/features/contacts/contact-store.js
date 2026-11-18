/* Kho dữ liệu DÙNG CHUNG giữa giam-dinh-xe và trang Tasco DLK (mobile) trên Supabase.
 *   • Danh bạ nội bộ:  bảng tasco_contacts (+ tasco_contact_private: năm sinh/giới tính, chỉ Admin đọc được).
 *   • Hồ sơ bồi thường: bảng tasco_claims_mirror — bản RÚT GỌN, đẩy MỘT CHIỀU từ Firebase sang (không có số tiền, SĐT).
 * Dùng chung phiên đăng nhập Supabase với tab Gara cứu hộ (RescueGarages.getClient) nên chỉ phải đăng nhập một lần / thiết bị.
 * Quyền thật sự do RLS của Supabase quyết định: mọi tài khoản đang hoạt động được đọc; chỉ Admin được ghi.
 * Các hàm ánh xạ dữ liệu là hàm thuần (ContactStore.pure / ClaimsMirror.pure) để kiểm thử. */
const ContactStore = (() => {
  const T = 'tasco_contacts', P = 'tasco_contact_private', TIMEOUT_MS = 15000, CHUNK = 200, KEY_RE = /^[A-Za-z0-9_-]{1,80}$/;
  const str = (value, max) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);

  // ----- Hàm thuần -----
  const toRow = (rec, by, at) => ({
    ma_nv: rec.key, ho_ten: str(rec.hoTen, 120), don_vi: str(rec.donVi, 200), phong: str(rec.phong, 200), to_nhom: str(rec.to, 200),
    chuc_danh: str(rec.chucDanh, 200), noi_lam_viec: str(rec.noiLamViec, 200), nhom: str(rec.nhom, 200), sdt: str(rec.sdt, 20), email: str(rec.email, 120),
    updated_by: str(by, 120), updated_at: at || new Date().toISOString()
  });
  const toPrivate = rec => ({ma_nv: rec.key, nam_sinh: Number.isInteger(rec.namSinh) && rec.namSinh >= 1900 && rec.namSinh <= 2100 ? rec.namSinh : null, gioi_tinh: rec.gioiTinh === 'Nam' || rec.gioiTinh === 'Nữ' ? rec.gioiTinh : ''});
  // Khoá tự sinh (EM_… / N_…) nghĩa là bản ghi gốc không có Mã NV.
  const hasCode = key => !/^(EM|N)_/.test(key);
  function fromRows(rows, privateRows) {
    const priv = new Map((privateRows || []).map(row => [row.ma_nv, row]));
    return (rows || []).map(row => {
      const p = priv.get(row.ma_nv), rec = {
        key: row.ma_nv, maNv: hasCode(row.ma_nv) ? row.ma_nv : '', hoTen: row.ho_ten, donVi: row.don_vi, phong: row.phong, to: row.to_nhom, chucDanh: row.chuc_danh,
        noiLamViec: row.noi_lam_viec, nhom: row.nhom, sdt: row.sdt, email: row.email, updatedBy: row.updated_by, updatedAt: Date.parse(row.updated_at) || 0
      };
      if (p) { if (p.nam_sinh) rec.namSinh = p.nam_sinh; if (p.gioi_tinh) rec.gioiTinh = p.gioi_tinh; }
      return rec;
    });
  }
  // Bản ghi Firebase (contact_directory/{key}) → bản ghi dùng chung; bỏ bản ghi hỏng/khoá không hợp lệ.
  function fromFirebase(value) {
    const out = [], skipped = [];
    for (const [key, rec] of Object.entries(value || {})) {
      if (!rec || typeof rec !== 'object' || !str(rec.hoTen, 120)) { skipped.push(key); continue; }
      if (!KEY_RE.test(key)) { skipped.push(key); continue; }
      out.push({...rec, key, namSinh: Number.isInteger(Number(rec.namSinh)) && Number(rec.namSinh) ? Number(rec.namSinh) : null});
    }
    return {records: out, skipped};
  }
  const chunks = (list, size) => { const out = []; for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size)); return out; };

  // ----- Kết nối -----
  let status = 'idle', message = '', records = [], subscribers = [], loading = null, epoch = 0, lastSync = 0, boundAuth = false;
  const emit = () => subscribers.slice().forEach(cb => { try { cb(snapshot()); } catch (error) { console.error(error); } });
  const snapshot = () => ({status, message, records});
  const garages = () => (typeof RescueGarages !== 'undefined' && RescueGarages.getClient) ? RescueGarages : null;
  async function client() { const g = garages(); if (!g) throw new Error('Chưa nạp được module kết nối Supabase.'); return g.getClient(); }
  async function timed(query) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try { const result = await query.abortSignal(controller.signal); if (result.error) throw result.error; return result.data; } finally { clearTimeout(timer); }
  }
  function describe(error) {
    const code = error && error.code || '';
    if (['42P01', 'PGRST205'].includes(code)) return 'Chưa có bảng danh bạ trên Supabase. Liên hệ quản trị viên.';
    if (code === '42501' || /row.level security/i.test(error && error.message || '')) return 'Chỉ Admin được thêm/sửa/xóa danh bạ dùng chung (kiểm tra tài khoản Supabase đang đăng nhập).';
    if (error && error.name === 'AbortError') return 'Kết nối quá thời gian. Kiểm tra mạng rồi thử lại.';
    return 'Chưa kết nối được danh bạ dùng chung. Kiểm tra mạng rồi thử lại.';
  }
  async function pageAll(api, table, order) {
    const rows = [];
    for (let start = 0; ; start += 500) {
      const page = await timed(api.from(table).select('*').order(order).range(start, start + 499));
      rows.push(...(page || [])); if (!page || page.length < 500) break;
    }
    return rows;
  }
  async function load() {
    if (loading) return loading;
    const rev = epoch; status = 'loading'; message = ''; emit();
    loading = (async () => {
      try {
        const api = await client(), {data} = await api.auth.getSession();
        if (!data || !data.session) { if (rev === epoch) { status = 'signedout'; records = []; } return false; }
        const [rows, priv] = await Promise.all([pageAll(api, T, 'ma_nv'), pageAll(api, P, 'ma_nv')]);
        if (rev !== epoch) return false;
        records = fromRows(rows, priv); lastSync = Date.now(); status = 'ready'; return true;
      } catch (error) { if (rev === epoch) { status = 'error'; message = describe(error); } return false; }
      finally { if (rev === epoch) { loading = null; emit(); } }
    })();
    return loading;
  }
  async function start() {
    if (!boundAuth) {
      boundAuth = true;
      try {
        const api = await client();
        api.auth.onAuthStateChange((event, session) => { if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return; epoch++; loading = null; lastSync = 0; if (session) load(); else { status = 'signedout'; records = []; emit(); } });
        document.addEventListener('visibilitychange', () => { if (!document.hidden && subscribers.length && status === 'ready' && Date.now() - lastSync > 30000) load(); });
      } catch (error) { boundAuth = false; status = 'error'; message = describe(error); emit(); return; }
    }
    if (status === 'idle' || status === 'error' || status === 'signedout') return load();
  }
  function subscribe(callback) { subscribers.push(callback); start(); callback(snapshot()); return () => { subscribers = subscribers.filter(cb => cb !== callback); }; }
  async function signIn(email, password) { const g = garages(); if (!g) throw new Error('Chưa nạp được module kết nối Supabase.'); await g.signIn(email, password); }

  // ----- Ghi (RLS: chỉ Admin) -----
  async function write(operation) {
    const api = await client(), {data} = await api.auth.getSession();
    if (!data || !data.session) throw new Error('Đăng nhập tài khoản Supabase để lưu danh bạ.');
    try { await operation(api); } catch (error) { throw error instanceof Error && !error.code ? error : new Error(describe(error)); }
    await load();
  }
  // upsert: danh sách bản ghi {key,...}; removeKeys: khoá cần xóa. onProgress(done,total).
  async function upsertMany(recs, {removeKeys = [], by = '', onProgress} = {}) {
    const list = recs.filter(rec => KEY_RE.test(String(rec.key || ''))), total = list.length + removeKeys.length;
    if (list.length !== recs.length) throw new Error('Có liên hệ có Mã NV không hợp lệ (chỉ dùng chữ, số, gạch ngang/dưới).');
    let done = 0;
    await write(async api => {
      for (const part of chunks(list, CHUNK)) {
        const at = new Date().toISOString();
        await timed(api.from(T).upsert(part.map(rec => toRow(rec, by, at)), {onConflict: 'ma_nv'}));
        await timed(api.from(P).upsert(part.map(toPrivate), {onConflict: 'ma_nv'}));
        done += part.length; if (onProgress) onProgress(done, total);
      }
      for (const part of chunks(removeKeys, CHUNK)) { await timed(api.from(T).delete().in('ma_nv', part)); done += part.length; if (onProgress) onProgress(done, total); }
    });
    return {written: list.length, removed: removeKeys.length};
  }
  const remove = key => upsertMany([], {removeKeys: [key]});

  // Chuyển một lần từ Firebase (contact_directory) sang Supabase; không xóa gì ở Firebase.
  async function migrateFromFirebase({by = '', onProgress} = {}) {
    if (typeof dbNodeInstance === 'undefined' || !dbNodeInstance) throw new Error('Chưa kết nối Firebase.');
    const snap = await dbNodeInstance.ref('contact_directory').once('value'), parsed = fromFirebase(snap.val());
    if (!parsed.records.length) throw new Error('Danh bạ Firebase đang trống, không có gì để chuyển.');
    const result = await upsertMany(parsed.records, {by, onProgress});
    return {...result, skipped: parsed.skipped.length};
  }

  return {subscribe, reload: load, signIn, upsertMany, remove, migrateFromFirebase, snapshot, get status() { return status; }, pure: {toRow, toPrivate, fromRows, fromFirebase, hasCode, chunks, KEY_RE}};
})();

/* Bản rút gọn hồ sơ bồi thường → Supabase (một chiều). Chỉ chạy khi trình duyệt đã đăng nhập Supabase bằng tài khoản Admin. */
const ClaimsMirror = (() => {
  const T = 'tasco_claims_mirror', DELAY_MS = 4000, CHUNK = 200;
  const str = (value, max = 300) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
  const ID_RE = /^[A-Za-z0-9_.:-]{1,120}$/;
  const toRow = (id, c) => ({
    id, so_ho_so_boi_thuong: str(c.soHoSoBoiThuong), ma_vu_ton_that: str(c.maVuTonThat), bien_so: str(c.bienSo, 40), hang_xe: str(c.hangXe), hieu_xe: str(c.hieuXe),
    gdv_tiep_nhan: str(c.gdvTiepNhan), don_vi_cap_don: str(c.donViCapDon), loai_ton_that: str(c.loaiTonThat), dia_diem_vtt: str(c.diaDiemVTT, 500), trang_thai: str(c.trangThai, 80),
    ngay_ton_that: str(c.ngayTonThat, 60), ngay_mo_hs: str(c.ngayMoHs, 60), ngay_nhan_du_ho_so: str(c.ngayNhanDuHoSo, 60)
  });
  const fingerprint = row => JSON.stringify(row);
  // So sánh payload hiện tại với những gì đã đẩy: trả về hàng cần ghi và id cần xóa.
  function plan(payload, pushed) {
    const rows = [], seen = new Set();
    for (const [id, claim] of Object.entries(payload || {})) {
      if (!claim || typeof claim !== 'object' || !ID_RE.test(id)) continue;
      seen.add(id);
      const row = toRow(id, claim);
      if (pushed.get(id) !== fingerprint(row)) rows.push(row);
    }
    // Không xóa hàng loạt khi payload rỗng (tránh xóa sạch bản sao vì lỗi tải tạm thời).
    const removeIds = seen.size ? [...pushed.keys()].filter(id => !seen.has(id)) : [];
    return {rows, removeIds};
  }
  const chunks = (list, size) => { const out = []; for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size)); return out; };

  let pushed = null, timer = 0, running = false, latest = null, blocked = false, lastResult = null;
  const garages = () => (typeof RescueGarages !== 'undefined' && RescueGarages.getClient) ? RescueGarages : null;
  async function ready() {
    const g = garages(); if (!g) return null;
    const api = await g.getClient(), {data} = await api.auth.getSession();
    return data && data.session ? api : null;
  }
  async function run(force) {
    if (running || !latest || (blocked && !force)) return lastResult;
    running = true;
    try {
      const api = await ready(); if (!api) { lastResult = {ok: false, reason: 'signedout'}; return lastResult; }
      if (!pushed) {
        pushed = new Map();
        const existing = await api.from(T).select('id').limit(100000);
        if (existing.error) throw existing.error;
        for (const row of existing.data || []) pushed.set(row.id, '');   // đã có trên Supabase nhưng chưa biết nội dung → ghi lại 1 lần
      }
      const {rows, removeIds} = plan(latest, pushed);
      for (const part of chunks(rows, CHUNK)) {
        const result = await api.from(T).upsert(part.map(row => ({...row, synced_at: new Date().toISOString()})), {onConflict: 'id'});
        if (result.error) throw result.error;
        part.forEach(row => pushed.set(row.id, fingerprint(row)));
      }
      for (const part of chunks(removeIds, CHUNK)) {
        const result = await api.from(T).delete().in('id', part);
        if (result.error) throw result.error;
        part.forEach(id => pushed.delete(id));
      }
      blocked = false; lastResult = {ok: true, written: rows.length, removed: removeIds.length}; return lastResult;
    } catch (error) {
      const denied = error && (error.code === '42501' || /row.level security/i.test(error.message || ''));
      if (denied) blocked = true;   // tài khoản không phải Admin: ngừng thử tới khi đăng nhập lại / bấm đồng bộ thủ công
      pushed = denied ? pushed : null;
      lastResult = {ok: false, reason: denied ? 'denied' : 'error', message: error && error.message || ''}; return lastResult;
    } finally { running = false; }
  }
  // Gọi mỗi khi pending_claims đổi: gom nhịp rồi đẩy phần thay đổi.
  function schedule(payload) { latest = payload || {}; clearTimeout(timer); timer = setTimeout(() => { run(false); }, DELAY_MS); }
  async function syncNow() { blocked = false; return run(true); }

  return {schedule, syncNow, pure: {toRow, plan, fingerprint, ID_RE}};
})();
