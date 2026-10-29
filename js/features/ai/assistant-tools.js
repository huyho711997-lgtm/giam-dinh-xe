// Công cụ cho Trợ lý TASCO AI (Gemini function calling): tra cứu hồ sơ, thống kê, mở hồ sơ, soạn biểu mẫu.
// Chỉ đọc dữ liệu đang có trên máy (cachedPendingClaimsPayload / cachedCasesPayload) và mở màn hình; không tự ghi, xoá hay gửi gì.
const TascoAITools = (() => {
  const norm = text => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
  const LIMIT_DEFAULT = 10, LIMIT_MAX = 25;
  const STATUS_FIELDS = ['trangThai', 'status'];
  const GDV_FIELDS = ['gdvTiepNhan', 'canBoXuLy', 'gdvHo', 'nguoiTao.tenHienThi'];
  const GROUPS = {trang_thai: STATUS_FIELDS, gdv: GDV_FIELDS, don_vi: ['donViCapDon'], gara: ['tenGara', 'gara'], nghiep_vu: ['maSpNghiepVu', 'nghiepVu', 'loaiHinhBaoHiem']};
  const BRIEF_FIELDS = ['bienSo', 'khachHang', 'chuXe', 'soHoSoBoiThuong', 'maVuTonThat', 'donViCapDon', 'gdvTiepNhan', 'tenGara', 'ngayTonThat', 'nguoiTao.tenHienThi'];
  const flat = record => (typeof SharedFormsAI !== 'undefined' ? SharedFormsAI.describeRecord(record) : {});

  const source = kind => kind === 'giam_dinh'
    ? (typeof cachedCasesPayload !== 'undefined' ? cachedCasesPayload : null)
    : (typeof cachedPendingClaimsPayload !== 'undefined' ? cachedPendingClaimsPayload : null);
  const items = kind => Object.entries(source(kind) || {}).filter(([, record]) => record && typeof record === 'object').map(([id, record]) => ({id, kind, record, fields: flat(record)}));
  const pick = (fields, names) => { for (const name of names) if (fields[name] !== undefined && fields[name] !== '') return String(fields[name]); return ''; };

  function statusOf(item) {
    const raw = pick(item.fields, STATUS_FIELDS) || (item.kind === 'ton' ? 'moi' : '');
    const map = typeof PENDING_STATUS_MAP !== 'undefined' ? PENDING_STATUS_MAP : {};
    return {code: raw, label: item.kind === 'ton' ? (map[raw]?.label || raw) : raw};
  }
  function brief(item) {
    const out = {ma: item.id, loai: item.kind};
    for (const name of BRIEF_FIELDS) if (item.fields[name] !== undefined) out[name] = item.fields[name];
    const status = statusOf(item);
    if (status.code) { out.trangThai = status.label; if (status.label !== status.code) out.maTrangThai = status.code; }
    return out;
  }
  const haystack = item => norm(item.id + ' ' + Object.values(item.fields).join(' '));
  const limitOf = value => Math.max(1, Math.min(LIMIT_MAX, Number(value) || LIMIT_DEFAULT));

  // ---- Ngày & số tiền ----
  // Chuyển giá trị ngày (ISO, dd/mm/yyyy, dd-mm-yyyy, mili-giây, số serial Excel) thành số yyyymmdd để so sánh; không đọc được → 0.
  function dayNumber(value) {
    if (value === null || value === undefined || value === '' || value === '—' || value === '-') return 0;
    const text = String(value).trim();
    const num = Number(text);
    let year, month, day;
    if (Number.isFinite(num) && num > 100000000000) { const date = new Date(num); year = date.getFullYear(); month = date.getMonth() + 1; day = date.getDate(); }
    else if (Number.isFinite(num) && num >= 30000 && num <= 75000) { const date = new Date(Math.round((num - 25569) * 86400) * 1000); year = date.getUTCFullYear(); month = date.getUTCMonth() + 1; day = date.getUTCDate(); }
    else {
      const parts = text.split(/[\/\-.\sT:]/).filter(Boolean).map(Number);
      if (parts.length < 3 || parts.some(Number.isNaN)) return 0;
      if (parts[0] > 1000) [year, month, day] = parts; else { [day, month, year] = parts; if (month > 12 && day <= 12) [day, month] = [month, day]; }
    }
    if (!(year > 1990 && year < 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31)) return 0;
    return year * 10000 + month * 100 + day;
  }
  const isoDay = value => { const match = String(value ?? '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); return match ? Number(match[1]) * 10000 + Number(match[2]) * 100 + Number(match[3]) : 0; };
  const DATE_FIELDS = {
    ngay_duyet: ['toTrinhNgayDuyet', 'pascNgayDuyet', 'ngayDuyetHsbt', 'ngayDuyetBT'],
    ngay_ton_that: ['ngayTonThat', 'ngayVTT'],
    ngay_mo_hs: ['ngayMoHs', 'createdAt'],
    ngay_thanh_toan: ['ngayThanhToan'],
    ngay_tao: ['createdAt']
  };
  function dateOf(item, field) {
    const names = DATE_FIELDS[field] || DATE_FIELDS.ngay_duyet;
    if (field === 'ngay_duyet' && typeof getClaimToTrinhDuyetDate === 'function') { const day = dayNumber(getClaimToTrinhDuyetDate(item.record)); if (day) return day; }
    for (const name of names) { const day = dayNumber(item.record[name] ?? item.fields[name]); if (day) return day; }
    return 0;
  }
  const dayText = day => day ? String(day % 100).padStart(2, '0') + '/' + String(Math.floor(day / 100) % 100).padStart(2, '0') + '/' + Math.floor(day / 10000) : '';
  // "1.234.567 đ", "1,234,567", 1234567 → 1234567 (đơn vị: đồng).
  const moneyOf = value => { if (typeof value === 'number') return Number.isFinite(value) ? value : 0; const digits = String(value ?? '').replace(/[^\d-]/g, ''); return digits && digits !== '-' ? Number(digits) : 0; };
  const spaced = value => norm(value).replace(/_/g, ' ');
  const list = value => (Array.isArray(value) ? value : value ? String(value).split(/[,;|]/) : []).map(spaced).filter(Boolean);
  // Trùng khớp chính xác với một trạng thái đã biết (VD "KT duyệt" không lẫn "Chờ KT duyệt"); chỉ khớp một phần khi cụm từ không phải trạng thái đã biết.
  const knownStatuses = () => { const map = typeof PENDING_STATUS_MAP !== 'undefined' ? PENDING_STATUS_MAP : {}; return new Set(Object.entries(map).flatMap(([code, value]) => [spaced(code), spaced(value?.label)])); };
  const hasStatus = (item, wanted, known) => { const status = statusOf(item), code = spaced(status.code), label = spaced(status.label); return code === wanted || label === wanted || (!known.has(wanted) && label.includes(wanted)); };

  // Bộ lọc dùng chung cho tìm kiếm và thống kê.
  function filterRows(kind, args = {}) {
    let rows = items(kind);
    const total = rows.length;
    const tokens = norm(args.tu_khoa).split(/\s+/).filter(Boolean);
    if (tokens.length) rows = rows.filter(item => { const text = haystack(item); return tokens.every(token => text.includes(token)); });
    const include = list(args.trang_thai), exclude = list(args.loai_tru_trang_thai);
    if (include.length) { const known = knownStatuses(); rows = rows.filter(item => include.some(wanted => hasStatus(item, wanted, known))); }
    if (exclude.length) { const known = knownStatuses(); rows = rows.filter(item => !exclude.some(wanted => hasStatus(item, wanted, known))); }
    if (args.gdv) { const wanted = norm(args.gdv); rows = rows.filter(item => GDV_FIELDS.some(name => norm(item.fields[name]).includes(wanted))); }
    if (args.gara) { const wanted = norm(args.gara); rows = rows.filter(item => GROUPS.gara.some(name => norm(item.fields[name]).includes(wanted))); }
    if (args.don_vi) { const wanted = norm(args.don_vi); rows = rows.filter(item => norm(item.fields.donViCapDon).includes(wanted)); }
    const from = isoDay(args.tu_ngay), to = isoDay(args.den_ngay);
    const field = args.truong_ngay || (from || to ? 'ngay_duyet' : '');
    let noDate = 0;
    if (from || to) {
      rows = rows.filter(item => { const day = dateOf(item, field); if (!day) { noDate++; return false; } return (!from || day >= from) && (!to || day <= to); });
    }
    return {rows, total, field, noDate, ranged: !!(from || to)};
  }

  function search(kind, args = {}) {
    const {rows, total, field, noDate, ranged} = filterRows(kind, args);
    const limit = limitOf(args.gioi_han);
    const out = {tong_so_ho_so_trong_nhom: total, so_ket_qua_khop: rows.length, dang_hien_thi: Math.min(limit, rows.length), ket_qua: rows.slice(0, limit).map(item => {
      const row = brief(item);
      if (ranged || args.truong_ngay) row.ngay = dayText(dateOf(item, field || 'ngay_duyet'));
      return row;
    })};
    if (ranged) out.so_ho_so_khong_co_ngay_nen_bi_loai = noDate;
    return out;
  }

  function find(kind, code) {
    const wanted = norm(code);
    const all = items(kind);
    return all.find(item => norm(item.id) === wanted) || all.find(item => ['bienSo', 'soHoSoBoiThuong', 'maVuTonThat'].some(name => norm(item.fields[name]) === wanted))
      || all.filter(item => haystack(item).includes(wanted)).filter((_, index, list) => list.length === 1)[0] || null;
  }
  function detail(kind, code) {
    const item = find(kind, code);
    if (!item) return {loi: 'Không tìm thấy hồ sơ "' + code + '". Hãy dùng công cụ tìm hồ sơ trước để lấy đúng mã.'};
    return {...brief(item), cac_truong: item.fields};
  }

  // Thống kê số lượng (và tổng tiền nếu có tinh_tong) theo nhóm, sau khi áp dụng cùng bộ lọc với tim_ho_so.
  const SUM_FIELDS = new Set(['soTienDuyetBT', 'ttbtTongSoTienBoiThuong', 'ttbtSoTienBoiThuong', 'duPhongBoiThuong', 'pascSoTienDuyet', 'soTienDaThanhToan', 'uocThietHai', 'chiPhiGiamDinh', 'chiPhiCuuHo', 'chiPhiKhac', 'tongBoiThuongSauThue', 'giaTriXe', 'soTienBh', 'phiBh']);
  function stats(kind, groupBy, args = {}) {
    const {rows, total, field, noDate, ranged} = filterRows(kind, args);
    const sumField = SUM_FIELDS.has(args.tinh_tong) ? args.tinh_tong : '';
    const groups = new Map();
    let overall = 0;
    for (const item of rows) {
      let value;
      if (!groupBy || groupBy === 'khong') value = 'Tất cả';
      else if (groupBy === 'thang') { const day = dateOf(item, field || 'ngay_duyet'); value = day ? String(Math.floor(day / 100) % 100).padStart(2, '0') + '/' + Math.floor(day / 10000) : '(không có ngày)'; }
      else if (groupBy === 'trang_thai' || !GROUPS[groupBy]) value = statusOf(item).label;
      else value = pick(item.fields, GROUPS[groupBy]);
      value = value || '(trống)';
      const entry = groups.get(value) || {so_luong: 0, tong_tien: 0};
      entry.so_luong++;
      if (sumField) { const money = moneyOf(item.record[sumField] ?? item.fields[sumField]); entry.tong_tien += money; overall += money; }
      groups.set(value, entry);
    }
    const ordered = [...groups.entries()].sort((first, second) => groupBy === 'thang' ? first[0].split('/').reverse().join('').localeCompare(second[0].split('/').reverse().join('')) : second[1].so_luong - first[1].so_luong)
      .slice(0, 31).map(([gia_tri, entry]) => sumField ? {gia_tri, so_luong: entry.so_luong, tong_tien: entry.tong_tien} : {gia_tri, so_luong: entry.so_luong});
    const out = {tong_so_ho_so_trong_nhom: total, so_ho_so_khop_bo_loc: rows.length, nhom_theo: groupBy || 'khong', thong_ke: ordered};
    if (sumField) { out.tinh_tong = sumField; out.tong_tien = overall; out.don_vi_tien = 'đồng'; }
    if (ranged) { out.truong_ngay = field || 'ngay_duyet'; out.so_ho_so_khong_co_ngay_nen_bi_loai = noDate; }
    return out;
  }

  const DECLARATIONS = [
    {name: 'tim_ho_so', description: 'Tìm/lọc danh sách hồ sơ theo từ khoá (biển số, tên khách hàng, số hồ sơ, mã vụ tổn thất...), trạng thái, giám định viên, gara, đơn vị và khoảng ngày. loai="ton" là Hồ sơ bồi thường/tồn; loai="giam_dinh" là hồ sơ giám định hiện trường.',
      parameters: {type: 'OBJECT', properties: {loai: {type: 'STRING', enum: ['ton', 'giam_dinh']}, tu_khoa: {type: 'STRING'}, trang_thai: {type: 'ARRAY', items: {type: 'STRING'}, description: 'Chỉ lấy các trạng thái này (tên hoặc mã), VD ["Chờ GĐCT"]'}, loai_tru_trang_thai: {type: 'ARRAY', items: {type: 'STRING'}, description: 'Loại các trạng thái này, VD ["Đã duyệt HSBT","KT duyệt"]'}, gdv: {type: 'STRING'}, gara: {type: 'STRING'}, don_vi: {type: 'STRING'}, truong_ngay: {type: 'STRING', enum: ['ngay_duyet', 'ngay_ton_that', 'ngay_mo_hs', 'ngay_thanh_toan', 'ngay_tao'], description: 'Ngày dùng để lọc/nhóm; mặc định ngay_duyet (ngày duyệt HSBT/tờ trình)'}, tu_ngay: {type: 'STRING', description: 'YYYY-MM-DD, tính cả ngày này'}, den_ngay: {type: 'STRING', description: 'YYYY-MM-DD, tính cả ngày này'}, gioi_han: {type: 'INTEGER'}}, required: ['loai']}},
    {name: 'chi_tiet_ho_so', description: 'Lấy toàn bộ thông tin văn bản của một hồ sơ theo mã (trường "ma" hoặc biển số/số hồ sơ chính xác).',
      parameters: {type: 'OBJECT', properties: {loai: {type: 'STRING', enum: ['ton', 'giam_dinh']}, ma: {type: 'STRING'}}, required: ['loai', 'ma']}},
    {name: 'thong_ke', description: 'Đếm số hồ sơ (và cộng tổng tiền nếu cần) sau khi lọc, có thể nhóm theo trang_thai, gdv, don_vi, gara, nghiep_vu, thang (theo truong_ngay) hoặc khong (chỉ tổng). Dùng cho mọi câu hỏi "bao nhiêu", "tổng", "theo tháng". Ví dụ "tháng 10/2026 có bao nhiêu hồ sơ duyệt" → tu_ngay=2026-10-01, den_ngay=2026-10-31, nhom_theo=khong.',
      parameters: {type: 'OBJECT', properties: {loai: {type: 'STRING', enum: ['ton', 'giam_dinh']}, nhom_theo: {type: 'STRING', enum: ['khong', 'trang_thai', 'gdv', 'don_vi', 'gara', 'nghiep_vu', 'thang']}, tinh_tong: {type: 'STRING', enum: ['soTienDuyetBT', 'ttbtTongSoTienBoiThuong', 'duPhongBoiThuong', 'pascSoTienDuyet', 'soTienDaThanhToan', 'uocThietHai', 'chiPhiGiamDinh', 'chiPhiCuuHo', 'tongBoiThuongSauThue'], description: 'Trường tiền cần cộng tổng (đồng)'}, tu_khoa: {type: 'STRING'}, trang_thai: {type: 'ARRAY', items: {type: 'STRING'}, description: 'Chỉ lấy các trạng thái này (tên hoặc mã), VD ["Chờ GĐCT"]'}, loai_tru_trang_thai: {type: 'ARRAY', items: {type: 'STRING'}, description: 'Loại các trạng thái này, VD ["Đã duyệt HSBT","KT duyệt"]'}, gdv: {type: 'STRING'}, gara: {type: 'STRING'}, don_vi: {type: 'STRING'}, truong_ngay: {type: 'STRING', enum: ['ngay_duyet', 'ngay_ton_that', 'ngay_mo_hs', 'ngay_thanh_toan', 'ngay_tao'], description: 'Ngày dùng để lọc/nhóm; mặc định ngay_duyet (ngày duyệt HSBT/tờ trình)'}, tu_ngay: {type: 'STRING', description: 'YYYY-MM-DD, tính cả ngày này'}, den_ngay: {type: 'STRING', description: 'YYYY-MM-DD, tính cả ngày này'}}, required: ['loai', 'nhom_theo']}},
    {name: 'mo_ho_so', description: 'Mở cửa sổ chỉnh sửa của một hồ sơ bồi thường (loai="ton") trên màn hình người dùng.',
      parameters: {type: 'OBJECT', properties: {ma: {type: 'STRING'}}, required: ['ma']}},
    {name: 'ds_bieu_mau', description: 'Liệt kê các biểu mẫu Word (.docx) trong thư viện ứng dụng có thể soạn bằng AI.', parameters: {type: 'OBJECT', properties: {}}},
    {name: 'soan_bieu_mau', description: 'Soạn nháp một biểu mẫu Word theo một hồ sơ bồi thường và yêu cầu của người dùng. Người dùng sẽ duyệt từng thay đổi rồi tải về trong khung chat. Chỉ gọi khi đã biết rõ biểu mẫu và hồ sơ.',
      parameters: {type: 'OBJECT', properties: {ten_bieu_mau: {type: 'STRING'}, ma_ho_so: {type: 'STRING', description: 'Mã hồ sơ tồn (trường ma)'}, lenh: {type: 'STRING', description: 'Yêu cầu soạn/sửa biểu mẫu'}}, required: ['ten_bieu_mau', 'ma_ho_so', 'lenh']}}
  ];

  async function libraryForms() {
    const forms = SharedFormsStore.builtins();
    try {
      const uploaded = Object.entries((await dbNodeInstance.ref('shared_forms/files').once('value')).val() || {}).map(([id, file]) => ({...file, id, source: 'upload'}));
      forms.push(...uploaded);
    } catch (_) { /* chỉ dùng biểu mẫu hệ thống */ }
    return forms.filter(file => SharedFormsStore.extension(file.originalName || file.name) === 'docx');
  }

  // `ui` do trợ lý chat truyền vào: {showDraft(card)} để hiển thị bản nháp biểu mẫu trong khung chat.
  async function run(name, args = {}, ui = {}) {
    try {
      if (name === 'tim_ho_so') return search(args.loai === 'giam_dinh' ? 'giam_dinh' : 'ton', args);
      if (name === 'chi_tiet_ho_so') return detail(args.loai === 'giam_dinh' ? 'giam_dinh' : 'ton', args.ma);
      if (name === 'thong_ke') return stats(args.loai === 'giam_dinh' ? 'giam_dinh' : 'ton', args.nhom_theo, args);
      if (name === 'mo_ho_so') {
        const item = find('ton', args.ma);
        if (!item) return {loi: 'Không tìm thấy hồ sơ để mở.'};
        if (typeof openEditPendingClaimModal !== 'function') return {loi: 'Không mở được hồ sơ trên màn hình này.'};
        await openEditPendingClaimModal(item.id);
        return {ket_qua: 'Đã mở hồ sơ ' + (item.fields.bienSo || item.id) + ' trên màn hình.'};
      }
      if (name === 'ds_bieu_mau') return {bieu_mau: (await libraryForms()).map(file => file.name)};
      if (name === 'soan_bieu_mau') {
        const item = find('ton', args.ma_ho_so);
        if (!item) return {loi: 'Không tìm thấy hồ sơ. Hãy tìm hồ sơ trước để lấy đúng mã.'};
        const forms = await libraryForms();
        const wanted = norm(args.ten_bieu_mau);
        const matches = forms.filter(file => norm(file.name).includes(wanted) || wanted.includes(norm(file.name)));
        if (matches.length !== 1) return {loi: matches.length ? 'Có nhiều biểu mẫu khớp, hãy hỏi người dùng chọn.' : 'Không tìm thấy biểu mẫu.', bieu_mau_co_san: forms.map(file => file.name)};
        const file = matches[0];
        const result = await SharedFormsAI.draft(file, async () => { const response = await fetch(SharedFormsStore.safeUrl(file.url)); if (!response.ok) throw new Error('Không tải được biểu mẫu.'); return response.arrayBuffer(); }, item.record, String(args.lenh || ''), ui.signal);
        ui.showDraft?.({file, record: item.record, label: item.fields.bienSo || item.id, ...result});
        return {ket_qua: 'Đã soạn nháp biểu mẫu "' + file.name + '" cho hồ sơ ' + (item.fields.bienSo || item.id) + ' với ' + result.proposal.edits.length + ' chỗ sửa. Người dùng sẽ xem, chọn và tải ngay trong khung chat.', con_thieu: result.proposal.missing};
      }
      return {loi: 'Công cụ không tồn tại.'};
    } catch (error) { return {loi: error?.message || 'Công cụ gặp lỗi.'}; }
  }

  return {DECLARATIONS, run, search, detail, stats, norm, dayNumber};
})();
