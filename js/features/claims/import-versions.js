// =============================================================================================
// Phiên bản dữ liệu hồ sơ từ file Excel (chỉ quản trị viên)
// - Mỗi lần nhập: file mới là nguồn dữ liệu hiển thị. Trước khi ghi, lưu một phiên bản gồm
//   (1) bản sao toàn bộ pending_claims trước khi ghi  → để khôi phục,
//   (2) các dòng của file mới (đã chuẩn hóa theo khóa hồ sơ) → để so sánh giữa các file.
// - Firebase:
//     claim_import_history/{versionId}        thông tin phiên bản (nhẹ, dùng cho danh sách)
//     claim_import_blobs/{versionId}/rows/[i] dữ liệu file (gzip + base64, chia khối)
//     claim_import_blobs/{versionId}/before/[i] bản sao pending_claims trước khi ghi
// Phần tính toán (key, record, plan, diffRows, pack/unpack) không đụng DOM → có unit test.
// =============================================================================================
const ClaimImportVersions = (() => {
  const HISTORY = 'claim_import_history', BLOBS = 'claim_import_blobs', CHUNK = 4000000;

  // Nhãn hiển thị cho các trường khi xem thay đổi.
  const FIELD_LABELS = {
    trangThai:'Trạng thái', bienSo:'Biển số', soHoSoBoiThuong:'Số HSBT', maVuTonThat:'Mã vụ tổn thất', khachHang:'Khách hàng',
    garaSuaChua:'Gara sửa chữa', tenGara:'Tên gara', tenGaraVietTat:'Gara (viết tắt)', maGara:'Mã gara', ngayVTT:'Ngày tổn thất', ngayTonThat:'Ngày tổn thất',
    ngayDuyetBT:'Ngày duyệt BT', soTienDuyetBT:'Số tiền duyệt BT', ngayThongBao:'Ngày thông báo', ngayMoHs:'Ngày mở HS',
    donViCapDon:'Đơn vị cấp đơn', chiNhanh:'Chi nhánh', chiNhanhXuly:'Chi nhánh xử lý', ttkd:'TTKD', phongBan:'Phòng ban',
    soHd:'Số hợp đồng', soGcn:'Số GCNBH', nguoiCapDon:'Người cấp đơn', ngayHieuLuc:'Ngày hiệu lực', ngayHetHan:'Ngày hết hạn',
    kenhKhaiThac:'Kênh khai thác', chiTietKenh:'Chi tiết kênh', maKhaiThac:'Mã khai thác', hinhThucCapDon:'Hình thức cấp đơn',
    ngayThanhToanPhi:'Ngày thanh toán phí', phiBh:'Phí BH', giaTriXe:'Giá trị xe', soTienBh:'Số tiền BH',
    hangXe:'Hãng xe', hieuXe:'Hiệu xe', loaiXe:'Loại xe', namSanXuat:'Năm sản xuất', loaiDongCo:'Loại động cơ', mdsd:'MĐSD', soChoTrongTai:'Số chỗ / trọng tải',
    maSpNghiepVu:'Mã SP nghiệp vụ', vcx:'VCX', tnds:'TNDS', gdvTiepNhan:'GĐV tiếp nhận', canBoXuLy:'Cán bộ xử lý', gdvHo:'GĐV HO',
    diaDiemVTT:'Địa điểm tổn thất', hienTruong:'Hiện trường', nguyenNhan:'Nguyên nhân', moTaTonThat:'Mô tả tổn thất', loaiTonThat:'Loại tổn thất',
    doiTuongTonThat:'Đối tượng tổn thất', tinhTonThat:'Tỉnh tổn thất', dienBienTonThat:'Diễn biến tổn thất', diaDiemTonThat:'Địa điểm tổn thất', nhomNguyenNhan:'Nhóm nguyên nhân',
    uocThietHai:'Ước thiệt hại', pascNgayDuyet:'PASC – ngày duyệt', pascNguoiDuyet:'PASC – người duyệt', pascSoTienDuyet:'PASC – số tiền duyệt',
    toTrinhNgayDuyet:'Tờ trình – ngày duyệt', toTrinhNguoiDuyet:'Tờ trình – người duyệt', ttbtSoTienBoiThuong:'TTBT – số tiền BT', ttbtTongSoTienBoiThuong:'TTBT – tổng tiền BT',
    chiPhiGiamDinh:'Chi phí giám định', chiPhiCuuHo:'Chi phí cứu hộ', chiPhiKhac:'Chi phí khác', duPhongBoiThuong:'Dự phòng bồi thường',
    thuDoiDongBhTyLe:'Thu đòi ĐBH – tỷ lệ', thuDoiDongBhSoTien:'Thu đòi ĐBH – số tiền', dongBhFollowTyLe:'ĐBH follow – tỷ lệ', dongBhFollowSoTien:'ĐBH follow – số tiền',
    tongBoiThuongSauThue:'Tổng BT sau thuế', vat:'VAT', ngayNhanDuHoSo:'Ngày nhận đủ HS', ngayDuyetDnttDauTien:'Ngày duyệt ĐNTT đầu', ngayDuyetDnttCuoiCung:'Ngày duyệt ĐNTT cuối',
    ngayKtXacNhan:'Ngày KT xác nhận', soTienDaThanhToan:'Số tiền đã thanh toán', ngayThanhToan:'Ngày thanh toán', ghiChu:'Ghi chú', lyDoHuy:'Lý do hủy',
    agentUniqCode:'Agent code', garageUniqCode:'Garage code', zoneBoiThuong:'Zone bồi thường', khuVucGiamDinh:'Khu vực giám định'
  };
  // Trường quan trọng: hiện trước khi xem thay đổi.
  const KEY_FIELDS = ['trangThai','soTienDuyetBT','ttbtTongSoTienBoiThuong','duPhongBoiThuong','pascSoTienDuyet','garaSuaChua','gdvTiepNhan','ngayThanhToan','soTienDaThanhToan'];
  const label = field => FIELD_LABELS[field] || field;
  const rank = field => { const index = KEY_FIELDS.indexOf(field); return index === -1 ? KEY_FIELDS.length : index; };
  const clean = value => { const text = value === null || value === undefined ? '' : String(value).trim(); return text === '—' ? '' : text; };
  const norm = value => clean(value).replace(/[^A-Za-z0-9]/g,'').toUpperCase();

  // Khóa duy nhất của hồ sơ: Số HSBT → Mã VTT → Biển số + ngày tổn thất.
  function keyOf(source) {
    const hsbt = norm(source.soHoSoBoiThuong);
    if (hsbt) return 'HSBT:' + hsbt;
    const vtt = norm(source.maVuTonThat);
    if (vtt) return 'VTT:' + vtt;
    const plate = norm(source.bienSo), date = norm(source.ngayVTT || source.ngayTonThat);
    return plate ? 'BSX:' + plate + (date ? '@' + date : '') : '';
  }

  // Dòng đã đọc từ Excel (parsedExcelBatchRows) → bản ghi phẳng các trường do file quản lý.
  function record(row) {
    const meta = row.fullRowMeta || {}, out = {};
    for (const [field, value] of Object.entries(meta)) out[field] = clean(value);
    const date = clean(row.rawDate), gara = clean(row.rawGara);
    Object.assign(out, {
      // File không có cột/ô trạng thái → để trống (không đặt lại mọi hồ sơ về "Mới"); hồ sơ thêm mới mặc định 'moi' ở updates().
      trangThai: clean(row.rawStatusStr) ? (clean(row.targetStatus) || 'moi') : '',
      bienSo: clean(row.rawBsx).toUpperCase(),
      soHoSoBoiThuong: clean(row.rawSoHsbt),
      maVuTonThat: clean(row.rawVtt),
      garaSuaChua: gara, tenGara: gara,
      ngayVTT: date, ngayTonThat: date, ngayDuyetBT: date,
      soTienDuyetBT: clean(row.rawAmount)
    });
    return out;
  }

  // Bảng dữ liệu của một file: {key → record}; dòng trùng khóa: dòng sau thắng (báo số lượng).
  function rowsFromFile(parsedRows) {
    const rows = {}; let duplicates = 0, skipped = 0;
    for (const row of parsedRows) {
      const data = record(row), key = keyOf(data);
      if (!key) { skipped++; continue; }
      if (rows[key]) duplicates++;
      rows[key] = data;
    }
    // Trường "có mặt" = có ít nhất một dòng có giá trị. Cột trống toàn bộ không được dùng để xóa dữ liệu.
    const present = new Set();
    for (const data of Object.values(rows)) for (const [field, value] of Object.entries(data)) if (value) present.add(field);
    return {rows, present:[...present], duplicates, skipped};
  }

  const same = (a, b) => clean(a) === clean(b);

  // Kế hoạch áp dụng file mới lên dữ liệu hiện tại.
  //   claims   : pending_claims hiện tại {id → claim}
  //   file     : kết quả rowsFromFile
  //   previous : rows của lần nhập trước (để biết giá trị nào do file cũ ghi → được phép xóa khi file mới để trống)
  function plan(claims, file, previous = null) {
    const byKey = new Map(), kept = [], present = new Set(file.present);
    for (const [id, claim] of Object.entries(claims || {})) {
      if (!claim || typeof claim !== 'object') continue;
      const key = claim.importKey || keyOf(claim);
      // Hồ sơ tạo trong ứng dụng chưa có HSBT và chưa từng đến từ file: giữ nguyên.
      if (!key || (!claim.importKey && !norm(claim.soHoSoBoiThuong))) { if (!file.rows[key]) { kept.push({id, claim}); continue; } }
      if (!byKey.has(key)) byKey.set(key, {id, claim});
    }
    const added = [], changed = [], removed = []; let unchanged = 0;
    for (const [key, data] of Object.entries(file.rows)) {
      const current = byKey.get(key);
      if (!current) { added.push({key, data}); continue; }
      byKey.delete(key);
      const changes = [], prev = previous?.[key];
      for (const field of Object.keys(data)) {
        if (!present.has(field)) continue;
        const next = data[field], before = current.claim[field];
        if (same(next, before)) continue;
        // Ô trống trong file mới: chỉ xóa khi giá trị hiện tại do file trước ghi vào (không xóa chỉnh sửa trong ứng dụng).
        if (!next && !(prev && same(prev[field], before))) continue;
        changes.push({field, from:clean(before), to:next});
      }
      if (changes.length) changed.push({key, id:current.id, claim:current.claim, changes, needsKey:current.claim.importKey !== key});
      else { unchanged++; if (current.claim.importKey !== key) changed.push({key, id:current.id, claim:current.claim, changes:[], needsKey:true, silent:true}); }
    }
    for (const [key, current] of byKey) removed.push({key, id:current.id, claim:current.claim});
    const visibleChanged = changed.filter(item => !item.silent);
    return {added, changed, removed, kept, unchanged, duplicates:file.duplicates, skipped:file.skipped,
      summary:{added:added.length, changed:visibleChanged.length, removed:removed.length, unchanged, kept:kept.length, duplicates:file.duplicates, total:Object.keys(file.rows).length}};
  }

  // Ghi kế hoạch thành multi-path update (chỉ các trường thay đổi → không ghi đè chỉnh sửa khác trong ứng dụng).
  function updates(planned, {now = Date.now(), versionId = '', newId} = {}) {
    const out = {}; let counter = 0;
    const makeId = newId || (() => 'claim_' + now + '_' + Math.random().toString(36).slice(2,8) + '_' + (counter++));
    for (const {key, data} of planned.added) {
      const id = makeId();
      const claim = {...data, id, importKey:key, importVersionId:versionId, createdAt:now, updatedAt:now, trangThai:data.trangThai || 'moi',
        gdvTiepNhan:data.gdvTiepNhan || data.gdvHo || 'Hệ thống Excel', canBoXuLy:data.canBoXuLy || data.gdvHo || 'Hệ thống Excel',
        donViCapDon:data.donViCapDon || data.chiNhanh || data.chiNhanhXuly || ''};
      if (!claim.maVuTonThat) claim.maVuTonThat = data.soHoSoBoiThuong || ('VTT/XCG/' + new Date(now).getFullYear() + '/' + Math.floor(100000 + Math.random() * 900000));
      if (!claim.bienSo) claim.bienSo = 'CHƯA_XÁC_ĐỊNH';
      for (const field of Object.keys(claim)) if (claim[field] === '') delete claim[field];
      out['pending_claims/' + id] = claim;
    }
    for (const item of planned.changed) {
      const base = 'pending_claims/' + item.id + '/';
      for (const {field, to} of item.changes) out[base + field] = to === '' ? null : to;
      if (item.needsKey) out[base + 'importKey'] = item.key;
      if (item.changes.length) { out[base + 'updatedAt'] = now; out[base + 'importVersionId'] = versionId; }
    }
    for (const item of planned.removed) out['pending_claims/' + item.id] = null;
    return out;
  }

  // So sánh hai file (rows) theo khóa hồ sơ.
  function diffRows(older, newer) {
    const a = older || {}, b = newer || {}, added = [], removed = [], changed = []; let unchanged = 0;
    for (const [key, data] of Object.entries(b)) {
      const prev = a[key];
      if (!prev) { added.push({key, data}); continue; }
      const fields = [...new Set([...Object.keys(prev), ...Object.keys(data)])].filter(field => !same(prev[field], data[field]) && field !== 'tenGara' && field !== 'ngayTonThat' && field !== 'ngayDuyetBT')
        .map(field => ({field, label:label(field), from:clean(prev[field]), to:clean(data[field])}))
        .sort((x, y) => rank(x.field) - rank(y.field));
      if (fields.length) changed.push({key, data, prev, fields}); else unchanged++;
    }
    for (const [key, data] of Object.entries(a)) if (!b[key]) removed.push({key, data});
    // Thống kê trường thay đổi nhiều nhất.
    const fieldCounts = {};
    for (const item of changed) for (const {field} of item.fields) fieldCounts[field] = (fieldCounts[field] || 0) + 1;
    return {added, removed, changed, unchanged, fieldCounts};
  }

  // ---- Nén lưu trữ: JSON → gzip → base64, chia khối ≤ 4MB (giới hạn chuỗi của Realtime Database) ----
  async function pipe(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
  function toBase64(bytes) { let text = ''; for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(text); }
  function fromBase64(text) { const raw = atob(text), out = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out; }
  async function pack(value) {
    const zipped = await pipe(new TextEncoder().encode(JSON.stringify(value ?? null)), new CompressionStream('gzip'));
    const text = toBase64(zipped), chunks = [];
    for (let i = 0; i < text.length; i += CHUNK) chunks.push(text.slice(i, i + CHUNK));
    return chunks.length ? chunks : [''];
  }
  async function unpack(chunks) {
    const list = Array.isArray(chunks) ? chunks : Object.keys(chunks || {}).sort((x, y) => x - y).map(key => chunks[key]);
    const text = list.join('');
    if (!text) return null;
    return JSON.parse(new TextDecoder().decode(await pipe(fromBase64(text), new DecompressionStream('gzip'))));
  }

  // ---- Lưu trữ Firebase ----------------------------------------------------------------------
  const db = () => { if (typeof dbNodeInstance === 'undefined' || !dbNodeInstance) throw new Error('Chưa kết nối cơ sở dữ liệu.'); return dbNodeInstance; };
  function isAdmin() {
    const profile = typeof activeUserProfile === 'undefined' ? null : activeUserProfile;
    return !!profile && (String(profile.role || '').trim().toLowerCase() === 'admin' || profile.permissions?.users?.admin === true);
  }
  function requireAdmin() { if (!isAdmin()) throw new Error('Chỉ quản trị viên được dùng chức năng phiên bản dữ liệu hồ sơ.'); }
  function actor() {
    const user = typeof firebase !== 'undefined' ? firebase.auth().currentUser : null;
    const profile = typeof activeUserProfile === 'undefined' ? {} : (activeUserProfile || {});
    return {uid:user?.uid || '', name:String(profile.fullName || profile.displayName || user?.displayName || user?.email || 'Quản trị viên')};
  }
  async function list() {
    requireAdmin();
    const snapshot = await db().ref(HISTORY).once('value');
    return Object.values(snapshot.val() || {}).filter(item => item && item.id).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
  async function blob(versionId, part) {
    requireAdmin();
    const snapshot = await db().ref(BLOBS + '/' + versionId + '/' + part).once('value');
    return snapshot.exists() ? unpack(snapshot.val()) : null;
  }
  // Lưu phiên bản TRƯỚC khi ghi dữ liệu; nếu không lưu được thì không ghi gì.
  async function saveVersion(meta, {rows, before}) {
    requireAdmin();
    const id = meta.id || ('v' + Date.now().toString(36) + Math.random().toString(36).slice(2,6));
    const packed = {rows:await pack(rows), before:await pack(before)};
    const size = packed.rows.join('').length + packed.before.join('').length;
    const entry = {...meta, id, createdAt:meta.createdAt || Date.now(), createdBy:actor(), storedBytes:size};
    await db().ref(BLOBS + '/' + id).set(packed);
    await db().ref(HISTORY + '/' + id).set(entry);
    return entry;
  }
  async function currentClaims() {
    const snapshot = await db().ref('pending_claims').once('value');
    return snapshot.val() || {};
  }
  // Áp dụng file mới: sao lưu → ghi theo khối 300 đường dẫn.
  async function apply(file, {fileName, onProgress} = {}) {
    requireAdmin();
    const history = await list();
    const latest = history[0] || null;
    const previousRows = latest ? await blob(latest.id, 'rows') : null;
    onProgress?.(5, 'Đang sao lưu dữ liệu hiện tại…');
    const claims = await currentClaims();
    const planned = plan(claims, file, previousRows);
    const versionId = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
    // createdAt luôn tăng dần để "phiên bản mới nhất" không bao giờ mơ hồ.
    const entry = await saveVersion({id:versionId, kind:'import', createdAt:Math.max(Date.now(), (latest?.createdAt || 0) + 1), fileName:fileName || 'Tệp Excel', rowCount:planned.summary.total, summary:planned.summary, prevVersionId:latest?.id || ''}, {rows:file.rows, before:claims});
    const changes = updates(planned, {versionId}), keys = Object.keys(changes);
    for (let i = 0; i < keys.length; i += 300) {
      const chunk = {}; for (const key of keys.slice(i, i + 300)) chunk[key] = changes[key];
      await db().ref().update(chunk);
      onProgress?.(10 + Math.round(Math.min(keys.length, i + 300) / Math.max(1, keys.length) * 90), 'Đang ghi dữ liệu… (' + Math.min(keys.length, i + 300) + '/' + keys.length + ')');
    }
    return {entry, planned};
  }
  // Khôi phục dữ liệu về trạng thái ngay trước phiên bản "target". Lưu bản hiện tại thành một phiên bản để có thể hoàn tác.
  async function restore(targetId, {onProgress} = {}) {
    requireAdmin();
    const history = await list(), target = history.find(item => item.id === targetId);
    if (!target) throw new Error('Không tìm thấy phiên bản cần khôi phục.');
    onProgress?.(10, 'Đang tải bản sao lưu…');
    const before = await blob(targetId, 'before');
    if (!before || typeof before !== 'object') throw new Error('Phiên bản này không có bản sao lưu để khôi phục.');
    const rows = target.prevVersionId ? await blob(target.prevVersionId, 'rows') : null;
    onProgress?.(35, 'Đang sao lưu dữ liệu hiện tại…');
    const claims = await currentClaims();
    const entry = await saveVersion({kind:'restore', createdAt:Math.max(Date.now(), (history[0]?.createdAt || 0) + 1), fileName:'Khôi phục về trước "' + (target.fileName || target.id) + '"', restoredFrom:targetId,
      rowCount:Object.keys(before).length, prevVersionId:target.prevVersionId || '', summary:{total:Object.keys(before).length}}, {rows, before:claims});
    onProgress?.(70, 'Đang khôi phục dữ liệu…');
    await db().ref('pending_claims').set(before);
    return entry;
  }

  return {FIELD_LABELS, label, keyOf, record, rowsFromFile, plan, updates, diffRows, pack, unpack, isAdmin, list, blob, apply, restore};
})();
