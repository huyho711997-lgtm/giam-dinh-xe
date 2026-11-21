// Dựng "hồ sơ đọc được" cho Công văn AI: biến bản ghi hồ sơ thô (cachedPendingClaimsPayload / cachedCasesPayload)
// thành các nhóm có nhãn tiếng Việt + nhận định nghiệp vụ TÍNH SẴN bằng quy tắc (không do AI đoán):
// thời hạn bảo hiểm so với ngày tổn thất, số ngày báo tổn thất, số ngày tồn, giai đoạn & bước kế tiếp,
// đối chiếu số tiền, giảm trừ, ghi chú tiến độ, hồ sơ khác cùng biển số, mục còn trống.
// Thuần JS (không DOM) → có unit test (tests/official-letter-dossier.test.mjs).
const OfficialLetterDossier = (() => {
  const LONG = 1500, SHORT = 300, MAX_NOTES = 8, MAX_RELATED = 6, MAX_ITEMS = 40, MAX_OTHER = 30;
  // Không đưa cho AI: ảnh/đường dẫn/khóa, giấy tờ tuỳ thân (CCCD/CMND/GPLX/hộ chiếu), dữ liệu kỹ thuật.
  const SKIP = /anh|image|photo|url|base64|signature|chu_?ky|token|password|matkhau|cccd|cmnd|cmt|gplx|hochieu|passport|uid|^id$|uniqcode|version|hash|ocrraw/i;

  const LABELS = {
    trangThai: 'Trạng thái', bienSo: 'Biển số', soHoSoBoiThuong: 'Số HSBT', soHSBT: 'Số HSBT', soHoSo: 'Số hồ sơ', maVuTonThat: 'Mã vụ tổn thất',
    khachHang: 'Khách hàng', chuXe: 'Chủ xe', tenChuXe: 'Chủ xe', diaChi: 'Địa chỉ', diaChiKhachHang: 'Địa chỉ khách hàng',
    laiXe: 'Lái xe', dienThoaiLaiXe: 'Điện thoại lái xe', nguoiLienHe: 'Người liên hệ', dienThoai: 'Điện thoại', soDienThoai: 'Điện thoại',
    soHd: 'Số hợp đồng', soGcn: 'Số GCNBH', soGCN: 'Số GCNBH', nguoiCapDon: 'Người cấp đơn', ngayHieuLuc: 'Ngày hiệu lực', ngayHetHan: 'Ngày hết hạn',
    donViCapDon: 'Đơn vị cấp đơn', chiNhanh: 'Chi nhánh', chiNhanhXuly: 'Chi nhánh xử lý', kenhKhaiThac: 'Kênh khai thác', hinhThucCapDon: 'Hình thức cấp đơn',
    ngayThanhToanPhi: 'Ngày thanh toán phí', phiBh: 'Phí bảo hiểm', giaTriXe: 'Giá trị xe', soTienBh: 'Số tiền bảo hiểm', maSpNghiepVu: 'Nghiệp vụ', nghiepVu: 'Nghiệp vụ',
    loaiHinhBaoHiem: 'Loại hình bảo hiểm', vcx: 'Vật chất xe', tnds: 'TNDS',
    hangXe: 'Hãng xe', hieuXe: 'Hiệu xe', loaiXe: 'Loại xe', namSanXuat: 'Năm sản xuất', loaiDongCo: 'Loại động cơ', mdsd: 'Mục đích sử dụng', soChoTrongTai: 'Số chỗ / trọng tải', soKhungSoMay: 'Số khung / số máy',
    ngayVTT: 'Ngày tổn thất', ngayTonThat: 'Ngày tổn thất', gioTonThat: 'Giờ tổn thất', ngayThongBao: 'Ngày thông báo tổn thất', diaDiemVTT: 'Địa điểm tổn thất', diaDiemTonThat: 'Địa điểm tổn thất', tinhTonThat: 'Tỉnh tổn thất',
    hienTruong: 'Hiện trường', nguyenNhan: 'Nguyên nhân', nhomNguyenNhan: 'Nhóm nguyên nhân', dienBienTonThat: 'Diễn biến tổn thất', moTaTonThat: 'Mô tả tổn thất', loaiTonThat: 'Loại tổn thất', doiTuongTonThat: 'Đối tượng tổn thất',
    gdvTiepNhan: 'GĐV tiếp nhận', canBoXuLy: 'Cán bộ xử lý', gdvHo: 'GĐV HO', zoneBoiThuong: 'Zone bồi thường', khuVucGiamDinh: 'Khu vực giám định',
    garaSuaChua: 'Gara sửa chữa', tenGara: 'Gara', tenGaraVietTat: 'Gara (viết tắt)', gara: 'Gara', maGara: 'Mã gara',
    ngayMoHs: 'Ngày mở hồ sơ', ngayNhanDuHoSo: 'Ngày nhận đủ hồ sơ', pascNgayDuyet: 'Ngày duyệt PASC', pascNguoiDuyet: 'Người duyệt PASC', toTrinhNgayDuyet: 'Ngày duyệt tờ trình',
    toTrinhNguoiDuyet: 'Người duyệt tờ trình', ngayDuyetBT: 'Ngày duyệt bồi thường', ngayDuyetHsbt: 'Ngày duyệt HSBT', ngayDuyetDnttDauTien: 'Ngày duyệt ĐNTT đầu', ngayDuyetDnttCuoiCung: 'Ngày duyệt ĐNTT cuối',
    ngayKtXacNhan: 'Ngày KT xác nhận', ngayThanhToan: 'Ngày thanh toán',
    uocThietHai: 'Ước thiệt hại', duPhongBoiThuong: 'Dự phòng bồi thường', pascSoTienDuyet: 'Số tiền duyệt PASC', soTienDuyetBT: 'Số tiền duyệt bồi thường',
    ttbtSoTienBoiThuong: 'TTBT – số tiền bồi thường', ttbtTongSoTienBoiThuong: 'TTBT – tổng tiền bồi thường', tongBoiThuongSauThue: 'Tổng bồi thường sau thuế', vat: 'VAT',
    chiPhiGiamDinh: 'Chi phí giám định', chiPhiCuuHo: 'Chi phí cứu hộ', chiPhiKhac: 'Chi phí khác', soTienDaThanhToan: 'Số tiền đã thanh toán',
    thuDoiDongBhTyLe: 'Thu đòi đồng BH – tỷ lệ', thuDoiDongBhSoTien: 'Thu đòi đồng BH – số tiền', dongBhFollowTyLe: 'Đồng BH follow – tỷ lệ', dongBhFollowSoTien: 'Đồng BH follow – số tiền',
    ghiChu: 'Ghi chú', lyDoHuy: 'Lý do huỷ', lyDoTuChoi: 'Lý do từ chối', createdAt: 'Ngày tạo trên hệ thống', updatedAt: 'Cập nhật lần cuối'
  };
  const GROUPS = [
    ['Định danh hồ sơ', ['soHoSoBoiThuong', 'soHSBT', 'soHoSo', 'maVuTonThat', 'trangThai', 'bienSo']],
    ['Khách hàng & người liên quan', ['khachHang', 'chuXe', 'tenChuXe', 'diaChi', 'diaChiKhachHang', 'laiXe', 'dienThoaiLaiXe', 'nguoiLienHe', 'dienThoai', 'soDienThoai']],
    ['Xe được bảo hiểm', ['hangXe', 'hieuXe', 'loaiXe', 'namSanXuat', 'loaiDongCo', 'mdsd', 'soChoTrongTai', 'soKhungSoMay', 'giaTriXe']],
    ['Hợp đồng bảo hiểm', ['soHd', 'soGcn', 'soGCN', 'maSpNghiepVu', 'nghiepVu', 'loaiHinhBaoHiem', 'vcx', 'tnds', 'soTienBh', 'phiBh', 'ngayHieuLuc', 'ngayHetHan', 'ngayThanhToanPhi', 'donViCapDon', 'chiNhanh', 'nguoiCapDon', 'kenhKhaiThac', 'hinhThucCapDon']],
    ['Vụ tổn thất', ['ngayTonThat', 'ngayVTT', 'gioTonThat', 'ngayThongBao', 'diaDiemTonThat', 'diaDiemVTT', 'tinhTonThat', 'hienTruong', 'loaiTonThat', 'doiTuongTonThat', 'nhomNguyenNhan', 'nguyenNhan', 'dienBienTonThat', 'moTaTonThat']],
    ['Giám định & xử lý', ['gdvTiepNhan', 'canBoXuLy', 'gdvHo', 'garaSuaChua', 'tenGara', 'tenGaraVietTat', 'gara', 'chiNhanhXuly', 'zoneBoiThuong', 'khuVucGiamDinh']],
    ['Mốc thời gian xử lý', ['ngayMoHs', 'ngayNhanDuHoSo', 'pascNgayDuyet', 'pascNguoiDuyet', 'toTrinhNgayDuyet', 'toTrinhNguoiDuyet', 'ngayDuyetBT', 'ngayDuyetHsbt', 'ngayDuyetDnttDauTien', 'ngayDuyetDnttCuoiCung', 'ngayKtXacNhan', 'ngayThanhToan']],
    ['Tài chính', ['uocThietHai', 'duPhongBoiThuong', 'pascSoTienDuyet', 'soTienDuyetBT', 'ttbtSoTienBoiThuong', 'ttbtTongSoTienBoiThuong', 'tongBoiThuongSauThue', 'vat', 'chiPhiGiamDinh', 'chiPhiCuuHo', 'chiPhiKhac', 'soTienDaThanhToan', 'thuDoiDongBhTyLe', 'thuDoiDongBhSoTien', 'dongBhFollowTyLe', 'dongBhFollowSoTien']],
    ['Ghi chú trên hồ sơ', ['ghiChu', 'lyDoHuy', 'lyDoTuChoi']]
  ];
  const MONEY = new Set(['giaTriXe', 'soTienBh', 'phiBh', 'uocThietHai', 'duPhongBoiThuong', 'pascSoTienDuyet', 'soTienDuyetBT', 'ttbtSoTienBoiThuong', 'ttbtTongSoTienBoiThuong', 'tongBoiThuongSauThue', 'vat', 'chiPhiGiamDinh', 'chiPhiCuuHo', 'chiPhiKhac', 'soTienDaThanhToan', 'thuDoiDongBhSoTien', 'dongBhFollowSoTien']);
  const DATE = new Set(['ngayHieuLuc', 'ngayHetHan', 'ngayThanhToanPhi', 'ngayTonThat', 'ngayVTT', 'ngayThongBao', 'ngayMoHs', 'ngayNhanDuHoSo', 'pascNgayDuyet', 'toTrinhNgayDuyet', 'ngayDuyetBT', 'ngayDuyetHsbt', 'ngayDuyetDnttDauTien', 'ngayDuyetDnttCuoiCung', 'ngayKtXacNhan', 'ngayThanhToan', 'createdAt', 'updatedAt']);
  const LONG_TEXT = new Set(['dienBienTonThat', 'moTaTonThat', 'nguyenNhan', 'hienTruong', 'ghiChu', 'lyDoHuy', 'lyDoTuChoi']);
  // Quan trọng cho hầu hết công văn: nếu trống thì báo để AI hỏi lại thay vì bịa.
  const IMPORTANT = [['Số HSBT', ['soHoSoBoiThuong', 'soHSBT', 'soHoSo']], ['Biển số', ['bienSo']], ['Chủ xe / khách hàng', ['chuXe', 'khachHang', 'tenChuXe']],
    ['Ngày tổn thất', ['ngayTonThat', 'ngayVTT']], ['Địa điểm tổn thất', ['diaDiemTonThat', 'diaDiemVTT']], ['Nguyên nhân / diễn biến', ['nguyenNhan', 'dienBienTonThat', 'moTaTonThat']],
    ['Số GCNBH / hợp đồng', ['soGcn', 'soGCN', 'soHd']], ['Gara sửa chữa', ['garaSuaChua', 'tenGara', 'gara']]];
  const STATUS = {moi: 'Mới', cho_giam_dinh_ht: 'Chờ giám định hiện trường', da_giam_dinh_ht: 'Đã giám định hiện trường', cho_gdct: 'Chờ giám định chi tiết', da_gdct: 'Đã giám định chi tiết',
    cho_duyet_pasc: 'Chờ duyệt PASC', da_duyet_pasc: 'Đã duyệt PASC', cho_duyet_hsbt: 'Chờ duyệt HSBT', da_duyet_hsbt: 'Đã duyệt HSBT', cho_duyet_dntt: 'Chờ duyệt ĐNTT',
    cho_kt_duyet: 'Chờ kế toán duyệt', kt_duyet: 'Kế toán đã duyệt', da_thanh_toan: 'Đã thanh toán', tu_choi: 'Từ chối'};
  const NEXT = {moi: 'tổ chức giám định hiện trường / liên hệ khách hàng', cho_giam_dinh_ht: 'giám định hiện trường', da_giam_dinh_ht: 'giám định chi tiết, thu thập báo giá',
    cho_gdct: 'giám định chi tiết tại gara', da_gdct: 'lập và trình phương án sửa chữa (PASC)', cho_duyet_pasc: 'chờ duyệt PASC', da_duyet_pasc: 'sửa chữa, thu thập đủ chứng từ, trình HSBT',
    cho_duyet_hsbt: 'chờ duyệt hồ sơ bồi thường', da_duyet_hsbt: 'đề nghị thanh toán', cho_duyet_dntt: 'chờ duyệt đề nghị thanh toán', cho_kt_duyet: 'chờ kế toán duyệt chi', kt_duyet: 'chi trả bồi thường'};
  const CLOSED = new Set(['da_duyet_hsbt', 'kt_duyet', 'da_thanh_toan', 'tu_choi']);

  const clip = (value, max) => { const text = String(value ?? '').replace(/\s+/g, ' ').trim(); return text.length > max ? text.slice(0, max - 1) + '…' : text; };
  const blank = value => value === null || value === undefined || (typeof value === 'string' && (!value.trim() || /^[-—–]+$/.test(value.trim())));
  const first = (record, keys) => { for (const key of keys) if (!blank(record[key]) && typeof record[key] !== 'object') return {key, value: record[key]}; return null; };

  // ---- Ngày: ISO, dd/mm/yyyy, mili-giây, số serial Excel → yyyymmdd (0 nếu không đọc được) ----
  function dayNumber(value) {
    if (blank(value)) return 0;
    const text = String(value).trim(), num = Number(text);
    let year, month, day;
    if (Number.isFinite(num) && num > 100000000000) { const d = new Date(num); year = d.getFullYear(); month = d.getMonth() + 1; day = d.getDate(); }
    else if (Number.isFinite(num) && num >= 30000 && num <= 75000) { const d = new Date(Math.round((num - 25569) * 86400) * 1000); year = d.getUTCFullYear(); month = d.getUTCMonth() + 1; day = d.getUTCDate(); }
    else {
      const parts = text.split(/[\/\-.\sT:]/).filter(Boolean).map(Number);
      if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return 0;
      if (parts[0] > 1000) [year, month, day] = parts; else { [day, month, year] = parts; if (month > 12 && day <= 12) [day, month] = [month, day]; }
    }
    if (!(year > 1990 && year < 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31)) return 0;
    return year * 10000 + month * 100 + day;
  }
  const dayText = day => day ? String(day % 100).padStart(2, '0') + '/' + String(Math.floor(day / 100) % 100).padStart(2, '0') + '/' + Math.floor(day / 10000) : '';
  const dayMs = day => Date.UTC(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100);
  const diffDays = (later, earlier) => Math.round((dayMs(later) - dayMs(earlier)) / 86400000);
  const todayNumber = today => { const fixed = dayNumber(today); if (fixed) return fixed; const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };

  // ---- Tiền: "1.234.567 đ", "1,234,567", 1234567 → 1234567; định dạng lại "1.234.567 đ" ----
  function moneyOf(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const text = String(value ?? '').trim();
    if (!/\d/.test(text) || /%/.test(text)) return 0;
    const digits = text.replace(/[^\d-]/g, '');
    return digits && digits !== '-' ? Number(digits) : 0;
  }
  const money = amount => Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' đ';

  function statusLabel(code) {
    const raw = String(code ?? '').trim();
    const map = typeof PENDING_STATUS_MAP !== 'undefined' && PENDING_STATUS_MAP ? PENDING_STATUS_MAP : {};
    return STATUS[raw] || (map[raw] && map[raw].label) || raw;
  }

  function display(key, value) {
    if (key === 'trangThai') return statusLabel(value);
    if (DATE.has(key)) { const day = dayNumber(value); return day ? dayText(day) : clip(value, 40); }
    if (MONEY.has(key)) { const amount = moneyOf(value); return amount ? money(amount) : clip(value, 60); }
    if (typeof value === 'boolean') return value ? 'Có' : 'Không';
    return clip(value, LONG_TEXT.has(key) ? LONG : SHORT);
  }
  const labelOf = key => LABELS[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');

  // Danh sách (mảng hoặc object Firebase) → mảng; phần tử chuỗi hoặc object có tên hạng mục.
  function listOf(value) {
    const arr = Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];
    return arr.map(item => typeof item === 'string' ? item : item && typeof item === 'object'
      ? [item.tenHangMuc || item.item || item.ten || item.name || item.noiDung || item.title, item.soLuong && 'SL ' + item.soLuong, item.thanhTien ? money(moneyOf(item.thanhTien)) : item.donGia ? money(moneyOf(item.donGia)) : '', item.phuongAn || item.ghiChu].filter(Boolean).map(text => clip(text, 160)).join(' – ')
      : '').filter(Boolean).slice(0, MAX_ITEMS);
  }

  function reductionOf(data) {
    if (!data || typeof data !== 'object') return null;
    const rule = data.rule && typeof data.rule === 'object' ? data.rule : {};
    const items = listOf(rule.items).concat(rule.custom && rule.custom.on && rule.custom.title ? [clip(rule.custom.title, 300) + (rule.custom.rate ? ' (' + rule.custom.rate + '%)' : '')] : []);
    if (!items.length && !data.reason && !data.notes && !data.evidence) return null;
    return {stage: clip(data.stage, 40), items: items.length ? items : (data.reason ? [clip(data.reason, 300) + (data.impact ? ' – ' + clip(data.impact, 100) : '')] : []), notes: clip(data.notes, 800), evidence: clip(data.evidence || data.basis, 600)};
  }

  // record: bản ghi hồ sơ; options: {group:'Hồ sơ tồn'|'Hồ sơ giám định', notes:[{author,timestamp,content}], related:[record], today:'yyyy-mm-dd'}
  function build(record, options = {}) {
    const r = record && typeof record === 'object' ? record : {};
    const used = new Set(), sections = [], facts = [];
    const add = (level, text) => facts.push({level, text});
    for (const [title, keys] of GROUPS) {
      const rows = [];
      for (const key of keys) {
        if (used.has(key) || blank(r[key]) || typeof r[key] === 'object') continue;
        const shown = display(key, r[key]);
        if (!shown) continue;
        // Cùng nhãn (VD ngayVTT/ngayTonThat cùng giá trị) chỉ ghi một lần.
        if (rows.some(row => row[0] === labelOf(key) && row[1] === shown)) { used.add(key); continue; }
        rows.push([labelOf(key), shown]); used.add(key);
      }
      if (rows.length) sections.push({title, rows});
    }
    // Các trường còn lại (vô hướng, có nghĩa) — giữ để AI không bỏ sót.
    const other = [];
    for (const [key, value] of Object.entries(r)) {
      if (other.length >= MAX_OTHER) break;
      if (used.has(key) || SKIP.test(key) || blank(value) || key === 'nguoiTao' || key === 'thongBaoGiamTru') continue;
      if (typeof value === 'object') {
        if (value && !Array.isArray(value) && value.tenHienThi && key !== 'nguoiTao') other.push([labelOf(key), clip(value.tenHienThi, 80)]);
        continue;
      }
      other.push([labelOf(key), display(key, value)]); used.add(key);
    }
    if (r.nguoiTao && typeof r.nguoiTao === 'object' && r.nguoiTao.tenHienThi) other.unshift(['Người tạo hồ sơ', clip(r.nguoiTao.tenHienThi, 80)]);
    if (other.length) sections.push({title: 'Thông tin khác', rows: other});

    // Danh sách hạng mục (hồ sơ giám định)
    const requested = listOf(r.hangMucYeuCauAnh), extracted = listOf(r.ocrExtractedItems), damage = listOf(r.hangMucTonThat || r.danhSachHangMuc || r.hangMuc);
    if (damage.length) sections.push({title: 'Hạng mục tổn thất', rows: damage.map((text, i) => [String(i + 1), text])});
    if (extracted.length) sections.push({title: 'Hạng mục trích từ báo giá', rows: extracted.map((text, i) => [String(i + 1), text])});
    if (requested.length) sections.push({title: 'Hạng mục yêu cầu chụp ảnh', rows: requested.map((text, i) => [String(i + 1), text])});

    // Giảm trừ / chế tài
    const reduction = reductionOf(r.thongBaoGiamTru);
    if (reduction) {
      const rows = [['Giai đoạn', reduction.stage || 'Chưa rõ']].concat(reduction.items.map((text, i) => ['Vi phạm ' + (i + 1), text]));
      if (reduction.notes) rows.push(['Ghi nhận thực tế', reduction.notes]);
      if (reduction.evidence) rows.push(['Tài liệu căn cứ', reduction.evidence]);
      sections.push({title: 'Giảm trừ / chế tài bồi thường', rows});
      add('warn', 'Hồ sơ có thông tin giảm trừ (' + (reduction.stage || 'chưa rõ giai đoạn') + '): ' + reduction.items.slice(0, 3).join('; ') + '.');
    }

    // Ghi chú tiến độ (mới nhất trước)
    const notes = (Array.isArray(options.notes) ? options.notes : []).filter(note => note && note.content)
      .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0)).slice(0, MAX_NOTES);
    if (notes.length) sections.push({title: 'Ghi chú tiến độ (mới nhất trước)', rows: notes.map(note => {
      const day = dayNumber(Number(note.timestamp)); return [[dayText(day), clip(note.author, 40)].filter(Boolean).join(' · ') || 'Ghi chú', clip(note.content, 400)];
    })});

    // ---- Nhận định tính sẵn ----
    const today = todayNumber(options.today);
    const status = String(r.trangThai || '').trim();
    if (status) add('info', 'Giai đoạn hiện tại: ' + statusLabel(status) + (NEXT[status] ? ' → bước tiếp theo thường là ' + NEXT[status] + '.' : '.'));
    const loss = dayNumber(r.ngayTonThat) || dayNumber(r.ngayVTT), from = dayNumber(r.ngayHieuLuc), to = dayNumber(r.ngayHetHan);
    if (loss && (from || to)) {
      if ((from && loss < from) || (to && loss > to)) add('warn', 'Ngày tổn thất ' + dayText(loss) + ' NẰM NGOÀI thời hạn bảo hiểm (' + (dayText(from) || '?') + ' – ' + (dayText(to) || '?') + ').');
      else {
        add('info', 'Ngày tổn thất ' + dayText(loss) + ' nằm trong thời hạn bảo hiểm (' + (dayText(from) || '?') + ' – ' + (dayText(to) || '?') + ').');
        if (from && diffDays(loss, from) <= 7) add('warn', 'Tổn thất xảy ra ' + diffDays(loss, from) + ' ngày sau ngày hiệu lực — cần lưu ý xác minh.');
        if (to && diffDays(to, loss) <= 7) add('info', 'Tổn thất xảy ra sát ngày hết hạn (còn ' + diffDays(to, loss) + ' ngày).');
      }
    }
    const pay = dayNumber(r.ngayThanhToanPhi);
    if (pay && loss && pay > loss) add('warn', 'Ngày thanh toán phí (' + dayText(pay) + ') SAU ngày tổn thất (' + dayText(loss) + ').');
    const notified = dayNumber(r.ngayThongBao);
    if (loss && notified && notified >= loss) { const gap = diffDays(notified, loss); add(gap > 5 ? 'warn' : 'info', 'Thông báo tổn thất sau ' + gap + ' ngày kể từ ngày xảy ra' + (gap > 5 ? ' (quá 5 ngày).' : '.')); }
    const opened = dayNumber(r.ngayMoHs) || dayNumber(r.createdAt);
    if (status && !CLOSED.has(status)) {
      if (opened && today >= opened) add(diffDays(today, opened) > 30 ? 'warn' : 'info', 'Hồ sơ đã mở ' + diffDays(today, opened) + ' ngày (từ ' + dayText(opened) + '), chưa kết thúc.');
      if (!dayNumber(r.ngayNhanDuHoSo)) add('info', 'Chưa ghi nhận ngày nhận đủ hồ sơ.');
    }
    const full = dayNumber(r.ngayNhanDuHoSo);
    if (full) add('info', 'Đã nhận đủ hồ sơ ngày ' + dayText(full) + '.');
    const estimate = moneyOf(r.uocThietHai), pasc = moneyOf(r.pascSoTienDuyet), approved = moneyOf(r.soTienDuyetBT) || moneyOf(r.ttbtTongSoTienBoiThuong) || moneyOf(r.tongBoiThuongSauThue), paid = moneyOf(r.soTienDaThanhToan);
    if (estimate && pasc) add('info', 'PASC duyệt ' + money(pasc) + ' so với ước thiệt hại ' + money(estimate) + ' (' + (pasc >= estimate ? 'cao hơn ' : 'thấp hơn ') + money(Math.abs(pasc - estimate)) + ').');
    if (approved && paid) add(paid < approved ? 'warn' : 'info', 'Đã thanh toán ' + money(paid) + ' / duyệt ' + money(approved) + (paid < approved ? ' — còn ' + money(approved - paid) + '.' : '.'));
    else if (approved) add('info', 'Số tiền duyệt bồi thường: ' + money(approved) + '.');
    const insured = moneyOf(r.soTienBh) || moneyOf(r.giaTriXe);
    if (insured && (approved || pasc || estimate) && (approved || pasc || estimate) >= insured * 0.75) add('warn', 'Thiệt hại đạt ≥75% số tiền bảo hiểm/giá trị xe — có thể thuộc trường hợp tổn thất toàn bộ.');
    if (!blank(r.thuDoiDongBhTyLe) || !blank(r.dongBhFollowTyLe)) add('info', 'Hồ sơ có đồng bảo hiểm (' + [r.thuDoiDongBhTyLe && 'thu đòi ' + r.thuDoiDongBhTyLe, r.dongBhFollowTyLe && 'follow ' + r.dongBhFollowTyLe].filter(Boolean).join(', ') + ').');
    if (r.trangThai === 'tu_choi' || !blank(r.lyDoTuChoi)) add('warn', 'Hồ sơ đã/đang bị từ chối' + (r.lyDoTuChoi ? ': ' + clip(r.lyDoTuChoi, 200) : '.'));

    // Hồ sơ khác cùng biển số (lịch sử tổn thất)
    const related = (Array.isArray(options.related) ? options.related : []).filter(item => item && item !== r).slice(0, MAX_RELATED);
    if (related.length) {
      sections.push({title: 'Hồ sơ khác cùng biển số', rows: related.map(item => [dayText(dayNumber(item.ngayTonThat) || dayNumber(item.ngayVTT)) || 'Chưa rõ ngày',
        [item.soHoSoBoiThuong || item.soHSBT || item.maVuTonThat, statusLabel(item.trangThai), clip(item.nguyenNhan || item.moTaTonThat || '', 120)].filter(Boolean).join(' · ')])});
      add(related.length >= 2 ? 'warn' : 'info', 'Xe có ' + related.length + ' hồ sơ tổn thất khác trên hệ thống.');
    }

    const gaps = IMPORTANT.filter(([, keys]) => !first(r, keys)).map(([label]) => label);
    return {group: options.group || '', sections, facts, gaps};
  }

  // Văn bản đưa vào prompt (gọn, có cấu trúc, tiếng Việt).
  function toText(dossier) {
    if (!dossier || (!dossier.sections.length && !dossier.facts.length)) return '';
    const out = [];
    if (dossier.group) out.push('Loại: ' + dossier.group);
    for (const section of dossier.sections) out.push('[' + section.title + ']', ...section.rows.map(([label, value]) => '- ' + label + ': ' + value));
    if (dossier.facts.length) out.push('[Nhận định tính sẵn từ dữ liệu — chính xác, ưu tiên dùng]', ...dossier.facts.map(fact => '- ' + (fact.level === 'warn' ? '(Lưu ý) ' : '') + fact.text));
    if (dossier.gaps.length) out.push('[Thông tin quan trọng còn trống trong hồ sơ]', '- ' + dossier.gaps.join('; '));
    return out.join('\n');
  }

  // Khóa ghi chú tiến độ giống trang Tiến độ hồ sơ tồn: BSX (hoặc Số HSBT/id) chỉ giữ chữ số, viết hoa.
  const notesKey = (record, id) => String((record && (record.bienSo || record.soHoSoBoiThuong)) || id || '').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
  const plateKey = value => String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  return {build, toText, notesKey, plateKey, dayNumber, moneyOf, money, statusLabel, LABELS};
})();
