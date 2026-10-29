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
    ngay_tao: ['createdAt'],
    cap_nhat: ['updatedAt', 'ngayCapNhat', 'ngayMoHs', 'createdAt']
  };
  function dateOf(item, field) {
    const names = DATE_FIELDS[field] || DATE_FIELDS.ngay_duyet;
    if (field === 'ngay_duyet' && typeof getClaimToTrinhDuyetDate === 'function') { const day = dayNumber(getClaimToTrinhDuyetDate(item.record)); if (day) return day; }
    for (const name of names) { const day = dayNumber(item.record[name] ?? item.fields[name]); if (day) return day; }
    return 0;
  }
  const dayMs = day => Date.UTC(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100);
  const ageDays = (day, today) => Math.floor((dayMs(today) - dayMs(day)) / 86400000);
  const todayNumber = override => { const fixed = isoDay(override); if (fixed) return fixed; const now = new Date(); return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate(); };
  // Hồ sơ đã xong việc của người xử lý nên không tính là "tồn": đã duyệt HSBT, KT duyệt, đã thanh toán, từ chối.
  const CLOSED_STATUSES = ['da_duyet_hsbt', 'kt_duyet', 'da_thanh_toan', 'tu_choi'];
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
    const minAge = Number(args.ton_tren_ngay);
    const aged = Number.isFinite(minAge) && args.ton_tren_ngay !== undefined && args.ton_tren_ngay !== null && args.ton_tren_ngay !== '';
    const ageBasis = DATE_FIELDS[args.tinh_tu] ? args.tinh_tu : 'cap_nhat';
    if (aged) {
      const today = todayNumber(args.hom_nay);
      rows = rows.filter(item => { const day = dateOf(item, ageBasis); if (!day) { noDate++; return false; } item.age = ageDays(day, today); return item.age > minAge; });
    }
    return {rows, total, field, noDate, ranged: !!(from || to) || aged, aged, ageBasis};
  }

  function search(kind, args = {}) {
    const {rows, total, field, noDate, ranged, aged, ageBasis} = filterRows(kind, args);
    const limit = limitOf(args.gioi_han);
    const out = {tong_so_ho_so_trong_nhom: total, so_ket_qua_khop: rows.length, dang_hien_thi: Math.min(limit, rows.length), ket_qua: rows.slice(0, limit).map(item => {
      const row = brief(item);
      if (aged) row.so_ngay_ton = item.age;
      else if (ranged || args.truong_ngay) row.ngay = dayText(dateOf(item, field || 'ngay_duyet'));
      return row;
    })};
    if (aged) out.tinh_so_ngay_ton_tu = ageBasis;
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
    const {rows, total, field, noDate, ranged, aged, ageBasis} = filterRows(kind, args);
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
    if (ranged) { if (field) out.truong_ngay = field; if (aged) out.tinh_so_ngay_ton_tu = ageBasis; out.so_ho_so_khong_co_ngay_nen_bi_loai = noDate; }
    return out;
  }

  // ---- Hồ sơ tồn đọng ----
  const gdvOf = item => pick(item.fields, GDV_FIELDS) || '(chưa phân công)';
  const claimRow = item => ({
    ma: item.id, bienSo: item.fields.bienSo || '', khachHang: item.fields.khachHang || item.fields.chuXe || '', hsbt: item.fields.soHoSoBoiThuong || '', vtt: item.fields.maVuTonThat || '',
    trangThai: statusOf(item).label, gdv: gdvOf(item), gara: pick(item.fields, GROUPS.gara), ngayTonThat: dayText(dateOf(item, 'ngay_ton_that')), soNgayTon: item.age
  });
  // Báo cáo đầy đủ (dùng cho thẻ tóm tắt và xuất file); công cụ gửi cho AI chỉ lấy phần rút gọn.
  function overdueReport(args = {}) {
    const days = Math.max(0, Math.floor(Number(args.ton_tren_ngay ?? 7)) || 0);
    const hasStatus = list(args.trang_thai).length > 0;
    const query = {...args, ton_tren_ngay: days};
    if (!hasStatus) query.loai_tru_trang_thai = [...CLOSED_STATUSES, ...list(args.loai_tru_trang_thai)];
    const {rows, total, noDate, ageBasis} = filterRows('ton', query);
    const groups = new Map();
    for (const item of rows) {
      const name = gdvOf(item);
      const group = groups.get(name) || {gdv: name, claims: []};
      group.claims.push(claimRow(item));
      groups.set(name, group);
    }
    const ordered = [...groups.values()].map(group => {
      group.claims.sort((first, second) => second.soNgayTon - first.soNgayTon);
      return {...group, count: group.claims.length, oldest: group.claims[0].soNgayTon};
    }).sort((first, second) => second.count - first.count || second.oldest - first.oldest);
    return {days, basis: ageBasis, total, count: rows.length, noDate, groups: ordered, statuses: hasStatus ? list(args.trang_thai) : 'tất cả trừ đã duyệt HSBT, KT duyệt, đã thanh toán, từ chối'};
  }
  function overdueForModel(report) {
    return {tieu_chi: {ton_tren_ngay: report.days, tinh_so_ngay_ton_tu: report.basis, trang_thai: report.statuses},
      tong_so_ho_so_trong_nhom: report.total, so_ho_so_ton: report.count, so_ho_so_khong_co_ngay_nen_bi_loai: report.noDate,
      theo_gdv: report.groups.slice(0, 15).map(group => ({gdv: group.gdv, so_luong: group.count, ton_lau_nhat_ngay: group.oldest, ho_so_ton_lau_nhat: group.claims.slice(0, 5).map(row => ({ma: row.ma, bienSo: row.bienSo, khachHang: row.khachHang, trangThai: row.trangThai, so_ngay_ton: row.soNgayTon}))}))};
  }

  // ---- Bảng để xuất Excel / dán email (đầy đủ kết quả, không bị giới hạn như phần AI nhìn thấy) ----
  const TABLE_CAP = 5000;
  const CLAIM_HEAD = ['Biển số', 'Khách hàng', 'Số HSBT', 'Mã VTT', 'Trạng thái', 'GĐV', 'Gara', 'Ngày tổn thất'];
  const claimCells = item => [item.fields.bienSo || '', item.fields.khachHang || item.fields.chuXe || '', item.fields.soHoSoBoiThuong || '', item.fields.maVuTonThat || '', statusOf(item).label, gdvOf(item), pick(item.fields, GROUPS.gara), dayText(dateOf(item, 'ngay_ton_that'))];
  function searchTable(kind, args = {}) {
    const {rows, aged} = filterRows(kind, args);
    return {title: 'Danh sách hồ sơ', head: aged ? [...CLAIM_HEAD, 'Số ngày tồn'] : CLAIM_HEAD, rows: rows.slice(0, TABLE_CAP).map(item => aged ? [...claimCells(item), item.age] : claimCells(item))};
  }
  function statsTable(result) {
    const money = !!result.tinh_tong;
    const label = {khong: 'Nhóm', trang_thai: 'Trạng thái', gdv: 'GĐV', don_vi: 'Đơn vị', gara: 'Gara', nghiep_vu: 'Nghiệp vụ', thang: 'Tháng'}[result.nhom_theo] || 'Nhóm';
    return {title: 'Thống kê theo ' + label.toLowerCase(), head: money ? [label, 'Số lượng', 'Tổng tiền (đồng)'] : [label, 'Số lượng'], rows: result.thong_ke.map(row => money ? [row.gia_tri, row.so_luong, row.tong_tien] : [row.gia_tri, row.so_luong])};
  }
  function overdueTable(report) {
    return {title: 'Hồ sơ tồn trên ' + report.days + ' ngày', head: ['GĐV', 'Biển số', 'Khách hàng', 'Số HSBT', 'Mã VTT', 'Trạng thái', 'Ngày tổn thất', 'Số ngày tồn'],
      rows: report.groups.flatMap(group => group.claims.map(row => [row.gdv, row.bienSo, row.khachHang, row.hsbt, row.vtt, row.trangThai, row.ngayTonThat, row.soNgayTon])).slice(0, TABLE_CAP)};
  }

  const DECLARATIONS = [
    {name: 'tim_ho_so', description: 'Tìm/lọc danh sách hồ sơ theo từ khoá (biển số, tên khách hàng, số hồ sơ, mã vụ tổn thất...), trạng thái, giám định viên, gara, đơn vị và khoảng ngày. loai="ton" là Hồ sơ bồi thường/tồn; loai="giam_dinh" là hồ sơ giám định hiện trường.',
      parameters: {type: 'OBJECT', properties: {loai: {type: 'STRING', enum: ['ton', 'giam_dinh']}, tu_khoa: {type: 'STRING'}, trang_thai: {type: 'ARRAY', items: {type: 'STRING'}, description: 'Chỉ lấy các trạng thái này (tên hoặc mã), VD ["Chờ GĐCT"]'}, loai_tru_trang_thai: {type: 'ARRAY', items: {type: 'STRING'}, description: 'Loại các trạng thái này, VD ["Đã duyệt HSBT","KT duyệt"]'}, gdv: {type: 'STRING'}, gara: {type: 'STRING'}, don_vi: {type: 'STRING'}, truong_ngay: {type: 'STRING', enum: ['ngay_duyet', 'ngay_ton_that', 'ngay_mo_hs', 'ngay_thanh_toan', 'ngay_tao'], description: 'Ngày dùng để lọc/nhóm; mặc định ngay_duyet (ngày duyệt HSBT/tờ trình)'}, tu_ngay: {type: 'STRING', description: 'YYYY-MM-DD, tính cả ngày này'}, den_ngay: {type: 'STRING', description: 'YYYY-MM-DD, tính cả ngày này'}, ton_tren_ngay: {type: 'INTEGER', description: 'Chỉ lấy hồ sơ tồn LỚN HƠN số ngày này (VD "quá 7 ngày" → 7)'}, tinh_tu: {type: 'STRING', enum: ['cap_nhat', 'ngay_mo_hs', 'ngay_ton_that', 'ngay_duyet'], description: 'Mốc tính số ngày tồn; mặc định cap_nhat (lần cập nhật gần nhất của hồ sơ)'}, gioi_han: {type: 'INTEGER'}}, required: ['loai']}},
    {name: 'ton_dong', description: 'Báo cáo hồ sơ bồi thường tồn đọng (chưa xong) quá N ngày, gom theo giám định viên (GĐV) kèm hồ sơ tồn lâu nhất. Dùng cho "hồ sơ nào tồn quá 7 ngày", "ai đang tồn nhiều nhất", "hồ sơ chờ duyệt lâu". Mặc định loại các hồ sơ đã duyệt HSBT, KT duyệt, đã thanh toán, từ chối; muốn riêng một trạng thái thì truyền trang_thai (VD ["Chờ GĐCT"]).',
      parameters: {type: 'OBJECT', properties: {ton_tren_ngay: {type: 'INTEGER', description: 'Số ngày, mặc định 7; tồn LỚN HƠN số này'}, tinh_tu: {type: 'STRING', enum: ['cap_nhat', 'ngay_mo_hs', 'ngay_ton_that'], description: 'Mốc tính; mặc định cap_nhat'}, trang_thai: {type: 'ARRAY', items: {type: 'STRING'}}, gdv: {type: 'STRING'}, gara: {type: 'STRING'}, don_vi: {type: 'STRING'}}}},
    {name: 'chi_tiet_ho_so', description: 'Lấy toàn bộ thông tin văn bản của một hồ sơ theo mã (trường "ma" hoặc biển số/số hồ sơ chính xác).',
      parameters: {type: 'OBJECT', properties: {loai: {type: 'STRING', enum: ['ton', 'giam_dinh']}, ma: {type: 'STRING'}}, required: ['loai', 'ma']}},
    {name: 'thong_ke', description: 'Đếm số hồ sơ (và cộng tổng tiền nếu cần) sau khi lọc, có thể nhóm theo trang_thai, gdv, don_vi, gara, nghiep_vu, thang (theo truong_ngay) hoặc khong (chỉ tổng). Dùng cho mọi câu hỏi "bao nhiêu", "tổng", "theo tháng". Ví dụ "tháng 10/2026 có bao nhiêu hồ sơ duyệt" → tu_ngay=2026-10-01, den_ngay=2026-10-31, nhom_theo=khong.',
      parameters: {type: 'OBJECT', properties: {loai: {type: 'STRING', enum: ['ton', 'giam_dinh']}, nhom_theo: {type: 'STRING', enum: ['khong', 'trang_thai', 'gdv', 'don_vi', 'gara', 'nghiep_vu', 'thang']}, tinh_tong: {type: 'STRING', enum: ['soTienDuyetBT', 'ttbtTongSoTienBoiThuong', 'duPhongBoiThuong', 'pascSoTienDuyet', 'soTienDaThanhToan', 'uocThietHai', 'chiPhiGiamDinh', 'chiPhiCuuHo', 'tongBoiThuongSauThue'], description: 'Trường tiền cần cộng tổng (đồng)'}, tu_khoa: {type: 'STRING'}, trang_thai: {type: 'ARRAY', items: {type: 'STRING'}, description: 'Chỉ lấy các trạng thái này (tên hoặc mã), VD ["Chờ GĐCT"]'}, loai_tru_trang_thai: {type: 'ARRAY', items: {type: 'STRING'}, description: 'Loại các trạng thái này, VD ["Đã duyệt HSBT","KT duyệt"]'}, gdv: {type: 'STRING'}, gara: {type: 'STRING'}, don_vi: {type: 'STRING'}, truong_ngay: {type: 'STRING', enum: ['ngay_duyet', 'ngay_ton_that', 'ngay_mo_hs', 'ngay_thanh_toan', 'ngay_tao'], description: 'Ngày dùng để lọc/nhóm; mặc định ngay_duyet (ngày duyệt HSBT/tờ trình)'}, tu_ngay: {type: 'STRING', description: 'YYYY-MM-DD, tính cả ngày này'}, ton_tren_ngay: {type: 'INTEGER', description: 'Chỉ lấy hồ sơ tồn LỚN HƠN số ngày này (VD "quá 7 ngày" → 7)'}, tinh_tu: {type: 'STRING', enum: ['cap_nhat', 'ngay_mo_hs', 'ngay_ton_that', 'ngay_duyet'], description: 'Mốc tính số ngày tồn; mặc định cap_nhat (lần cập nhật gần nhất của hồ sơ)'}, den_ngay: {type: 'STRING', description: 'YYYY-MM-DD, tính cả ngày này'}}, required: ['loai', 'nhom_theo']}},
    {name: 'mo_ho_so', description: 'Mở cửa sổ chỉnh sửa của một hồ sơ bồi thường (loai="ton") trên màn hình người dùng.',
      parameters: {type: 'OBJECT', properties: {ma: {type: 'STRING'}}, required: ['ma']}},
    {name: 'ds_bieu_mau', description: 'Liệt kê các biểu mẫu Word (.docx) trong thư viện ứng dụng có thể soạn bằng AI.', parameters: {type: 'OBJECT', properties: {}}},
    {name: 'mo_trinh_soan_bieu_mau', description: 'Mở trình soạn biểu mẫu từng bước trong khung chat (người dùng tự chọn biểu mẫu, chọn hồ sơ theo tên chủ xe/biển số, chọn vụ tổn thất nếu xe có nhiều vụ). Ưu tiên dùng khi người dùng muốn soạn biểu mẫu mà chưa nói rõ biểu mẫu hoặc hồ sơ nào.',
      parameters: {type: 'OBJECT', properties: {ten_bieu_mau: {type: 'STRING'}, tu_khoa_ho_so: {type: 'STRING', description: 'Biển số hoặc tên chủ xe nếu người dùng đã nói'}}}},
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
      if (name === 'tim_ho_so') { const kind = args.loai === 'giam_dinh' ? 'giam_dinh' : 'ton'; const result = search(kind, args); if (result.so_ket_qua_khop) ui.onTable?.(searchTable(kind, args)); return result; }
      if (name === 'ton_dong') { const report = overdueReport(args); if (report.count) ui.onTable?.(overdueTable(report)); return overdueForModel(report); }
      if (name === 'chi_tiet_ho_so') return detail(args.loai === 'giam_dinh' ? 'giam_dinh' : 'ton', args.ma);
      if (name === 'thong_ke') { const result = stats(args.loai === 'giam_dinh' ? 'giam_dinh' : 'ton', args.nhom_theo, args); if (result.thong_ke.length) ui.onTable?.(statsTable(result)); return result; }
      if (name === 'mo_ho_so') {
        const item = find('ton', args.ma);
        if (!item) return {loi: 'Không tìm thấy hồ sơ để mở.'};
        if (typeof openEditPendingClaimModal !== 'function') return {loi: 'Không mở được hồ sơ trên màn hình này.'};
        await openEditPendingClaimModal(item.id);
        return {ket_qua: 'Đã mở hồ sơ ' + (item.fields.bienSo || item.id) + ' trên màn hình.'};
      }
      if (name === 'mo_trinh_soan_bieu_mau') {
        if (typeof TascoFormWizard === 'undefined') return {loi: 'Trình soạn biểu mẫu chưa sẵn sàng.'};
        TascoFormWizard.start({form: args.ten_bieu_mau, query: args.tu_khoa_ho_so});
        return {ket_qua: 'Đã mở trình soạn biểu mẫu trong khung chat để người dùng chọn tiếp. Hãy nói ngắn gọn rằng bạn đã mở trình chọn.'};
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

  // Danh sách hồ sơ gom theo xe (biển số; không có thì theo tên khách) cho trình soạn biểu mẫu từng bước.
  const OWNER_FIELDS = ['bienSo', 'khachHang', 'chuXe', 'tenChuXe', 'nguoiLienHe', 'laiXe', 'soHoSoBoiThuong', 'maVuTonThat', 'soHd'];
  function vehicleGroups(query, limit = 8) {
    const tokens = norm(query).split(/\s+/).filter(Boolean);
    const groups = new Map();
    for (const item of items('ton')) {
      if (tokens.length) {
        // Biển số gõ kiểu "47H-114.50" hay "47h 11450" đều khớp "47H11450": so sánh thêm bản đã bỏ ký tự phân cách.
        const text = norm(OWNER_FIELDS.map(name => item.fields[name] || '').join(' ')), packed = text.replace(/[^a-z0-9]/g, '');
        if (!tokens.every(token => text.includes(token) || (token.replace(/[^a-z0-9]/g, '').length >= 4 && packed.includes(token.replace(/[^a-z0-9]/g, ''))))) continue;
      }
      const plate = String(item.fields.bienSo || '').trim();
      const key = norm(plate || item.fields.khachHang || item.id).replace(/[^a-z0-9]/g, '') || item.id;
      const group = groups.get(key) || {key, plate, owner: item.fields.khachHang || item.fields.chuXe || item.fields.tenChuXe || '', claims: []};
      group.claims.push({id: item.id, record: item.record, label: claimLabel(item)});
      groups.set(key, group);
    }
    const list = [...groups.values()].sort((first, second) => second.claims.length - first.claims.length || first.plate.localeCompare(second.plate));
    return {total: list.length, groups: list.slice(0, limit)};
  }
  function claimLabel(item) {
    const status = statusOf(item);
    return {
      id: item.id, hsbt: item.fields.soHoSoBoiThuong || '', vtt: item.fields.maVuTonThat || '', ngay: dayText(dateOf(item, 'ngay_ton_that')),
      diaDiem: String(item.fields.diaDiemTonThat || item.fields.diaDiemVTT || '').slice(0, 80), trangThai: status.label, nguyenNhan: String(item.fields.nguyenNhan || item.fields.moTaTonThat || '').slice(0, 80)
    };
  }

  return {DECLARATIONS, run, search, detail, stats, norm, dayNumber, libraryForms, vehicleGroups, overdueReport, overdueTable, searchTable, statsTable};
})();
