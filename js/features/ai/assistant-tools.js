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

  function search(kind, args = {}) {
    let rows = items(kind);
    const total = rows.length;
    const tokens = norm(args.tu_khoa).split(/\s+/).filter(Boolean);
    if (tokens.length) rows = rows.filter(item => { const text = haystack(item); return tokens.every(token => text.includes(token)); });
    if (args.trang_thai) {
      const wanted = norm(args.trang_thai);
      rows = rows.filter(item => { const status = statusOf(item); return norm(status.code) === wanted || norm(status.label).includes(wanted); });
    }
    if (args.gdv) { const wanted = norm(args.gdv); rows = rows.filter(item => GDV_FIELDS.some(name => norm(item.fields[name]).includes(wanted))); }
    if (args.gara) { const wanted = norm(args.gara); rows = rows.filter(item => GROUPS.gara.some(name => norm(item.fields[name]).includes(wanted))); }
    const limit = limitOf(args.gioi_han);
    return {tong_so_ho_so_trong_nhom: total, so_ket_qua_khop: rows.length, dang_hien_thi: Math.min(limit, rows.length), ket_qua: rows.slice(0, limit).map(brief)};
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

  function stats(kind, groupBy) {
    const fields = GROUPS[groupBy] || GROUPS.trang_thai;
    const counts = new Map();
    const rows = items(kind);
    for (const item of rows) {
      let value = groupBy === 'trang_thai' || !GROUPS[groupBy] ? statusOf(item).label : pick(item.fields, fields);
      value = value || '(trống)';
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    const list = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([gia_tri, so_luong]) => ({gia_tri, so_luong}));
    return {tong: rows.length, nhom_theo: GROUPS[groupBy] ? groupBy : 'trang_thai', thong_ke: list};
  }

  const DECLARATIONS = [
    {name: 'tim_ho_so', description: 'Tìm hồ sơ theo từ khoá (biển số, tên khách hàng, số hồ sơ, mã vụ tổn thất, đơn vị...) và/hoặc lọc theo trạng thái, giám định viên, gara. loai="ton" là Hồ sơ bồi thường/tồn; loai="giam_dinh" là hồ sơ giám định hiện trường.',
      parameters: {type: 'OBJECT', properties: {loai: {type: 'STRING', enum: ['ton', 'giam_dinh']}, tu_khoa: {type: 'STRING'}, trang_thai: {type: 'STRING', description: 'Tên hoặc mã trạng thái, VD "Chờ GĐCT" hoặc cho_gdct'}, gdv: {type: 'STRING'}, gara: {type: 'STRING'}, gioi_han: {type: 'INTEGER'}}, required: ['loai']}},
    {name: 'chi_tiet_ho_so', description: 'Lấy toàn bộ thông tin văn bản của một hồ sơ theo mã (trường "ma" hoặc biển số/số hồ sơ chính xác).',
      parameters: {type: 'OBJECT', properties: {loai: {type: 'STRING', enum: ['ton', 'giam_dinh']}, ma: {type: 'STRING'}}, required: ['loai', 'ma']}},
    {name: 'thong_ke', description: 'Đếm số hồ sơ theo nhóm: trang_thai, gdv, don_vi, gara hoặc nghiep_vu.',
      parameters: {type: 'OBJECT', properties: {loai: {type: 'STRING', enum: ['ton', 'giam_dinh']}, nhom_theo: {type: 'STRING', enum: ['trang_thai', 'gdv', 'don_vi', 'gara', 'nghiep_vu']}}, required: ['loai', 'nhom_theo']}},
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
      if (name === 'thong_ke') return stats(args.loai === 'giam_dinh' ? 'giam_dinh' : 'ton', args.nhom_theo);
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

  return {DECLARATIONS, run, search, detail, stats, norm};
})();
