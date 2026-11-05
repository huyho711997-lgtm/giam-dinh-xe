// Danh bạ nội bộ: hàm TÍNH THUẦN (không đụng DOM/mạng) — đọc bảng Excel, chuẩn hoá, so sánh, tìm kiếm.
// Giao diện ở directory.js; kiểm thử ở tests/contacts.test.mjs.
const ContactCalc = (() => {
  const FIELDS = ['maNv', 'hoTen', 'donVi', 'phong', 'to', 'chucDanh', 'noiLamViec', 'namSinh', 'gioiTinh', 'sdt', 'email', 'nhom'];
  const LABELS = {maNv: 'Mã NV', hoTen: 'Họ và tên', donVi: 'Đơn vị', phong: 'Phòng/ban/Chi nhánh', to: 'Tổ/nhóm', chucDanh: 'Chức danh', noiLamViec: 'Nơi làm việc', namSinh: 'Năm sinh', gioiTinh: 'Giới tính', sdt: 'Số điện thoại', email: 'Email công ty', nhom: 'Khối/Nhóm'};
  // Tên cột (đã bỏ dấu, chữ thường) → trường dữ liệu. Chấp nhận vài cách gọi thường gặp.
  const HEADERS = {
    stt: ['stt', 'so thu tu', 'tt'],
    maNv: ['ma nv', 'manv', 'ma nhan vien', 'ma so nv', 'ma cb'],
    hoTen: ['ho va ten', 'ho ten', 'ho & ten', 'ten nhan vien', 'ten'],
    donVi: ['don vi', 'khoi'],
    phong: ['phong/ban/chi nhanh', 'phong ban chi nhanh', 'phong/ban', 'phong ban', 'phong', 'bo phan'],
    to: ['to/nhom', 'to nhom', 'to', 'nhom'],
    chucDanh: ['chuc danh', 'chuc vu'],
    noiLamViec: ['noi lam viec', 'dia diem lam viec', 'dia diem'],
    namSinh: ['nam sinh', 'sinh nam'],
    gioiTinh: ['gioi tinh', 'gioi'],
    sdt: ['so dien thoai', 'sdt', 'dien thoai', 'so dt', 'phone', 'di dong'],
    email: ['email cong ty', 'email', 'e-mail', 'mail', 'email nhan vien']
  };
  const MAX = {hoTen: 120, email: 120, default: 200};

  const plain = v => String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
  const clean = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();

  function normPhone(value) {
    let d = String(value == null ? '' : value).replace(/\D/g, '');
    if (!d) return {value: '', valid: true, empty: true};
    if (d.startsWith('84') && d.length === 11) d = '0' + d.slice(2);      // +84…
    else if (d.length === 9 && d[0] !== '0') d = '0' + d;                // Excel làm mất số 0 đầu
    return {value: d, valid: /^0\d{9,10}$/.test(d), empty: false};
  }
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function normEmail(value) {
    const v = clean(value).toLowerCase();
    return {value: v, valid: !v || EMAIL_RE.test(v), empty: !v};
  }
  function normYear(value, nowYear = new Date().getFullYear()) {
    const text = String(value == null ? '' : value).trim();
    if (text === '') return {value: null, valid: true};   // Number('') = 0 → phải loại ô trống trước
    const n = Number(text);
    if (!Number.isInteger(n)) return {value: null, valid: false};
    return {value: n >= 1900 && n <= nowYear ? n : null, valid: n >= 1900 && n <= nowYear};
  }
  function normGender(value) {
    const t = plain(value);
    if (!t) return '';
    if (/^(nam|male|m)$/.test(t)) return 'Nam';
    if (/^(nu|female|f)$/.test(t)) return 'Nữ';
    return '';
  }

  // Khoá bản ghi: Mã NV (A-Z0-9_-); không có thì dùng email, cuối cùng là tên + SĐT.
  function makeKey(rec) {
    const code = String(rec.maNv || '').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
    if (code) return code;
    const email = String(rec.email || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (email) return 'EM_' + email.slice(0, 60);
    return 'N_' + plain(rec.hoTen).replace(/[^a-z0-9]/g, '') .slice(0, 40) + '_' + String(rec.sdt || '').slice(-6);
  }

  function findHeader(rows, scan = 30) {
    for (let i = 0; i < Math.min(rows.length, scan); i++) {
      const map = {};
      (rows[i] || []).forEach((cell, col) => {
        const t = plain(cell); if (!t) return;
        for (const [field, names] of Object.entries(HEADERS)) if (map[field] === undefined && names.includes(t)) { map[field] = col; break; }
      });
      if (map.hoTen !== undefined && Object.keys(map).length >= 4) return {index: i, map};
    }
    return null;
  }

  // rows: mảng các dòng (mảng ô) đọc từ Excel. Trả về bản ghi hợp lệ + dòng bị bỏ qua + cảnh báo.
  function parseRows(rows, nowYear) {
    const head = findHeader(rows);
    if (!head) return {ok: false, error: 'Không tìm thấy dòng tiêu đề. Cần có tối thiểu các cột "Họ và tên", "Số điện thoại", "Email"…', records: [], skipped: [], warnings: [], mapped: []};
    const {map} = head, get = (row, f) => map[f] === undefined ? '' : row[map[f]];
    const records = [], skipped = [], warnings = [], seen = new Map();
    let nhom = '';
    for (let i = head.index + 1; i < rows.length; i++) {
      const row = rows[i] || [], line = i + 1;
      const cells = row.map(clean);
      if (!cells.some(Boolean)) continue;
      const code = clean(get(row, 'maNv')), name = clean(get(row, 'hoTen'));
      const filled = cells.filter(Boolean);
      // Dòng tiêu đề nhóm (vd "CHI NHÁNH THANH HÓA"): chỉ có một ô chữ, không có Mã NV.
      if (!code && filled.length === 1) { nhom = filled[0].slice(0, MAX.default); continue; }
      if (!name) { skipped.push({line, reason: 'Thiếu họ và tên'}); continue; }
      const phone = normPhone(get(row, 'sdt')), mail = normEmail(get(row, 'email')), year = normYear(get(row, 'namSinh'), nowYear);
      const rec = {
        maNv: code.toUpperCase().slice(0, 40), hoTen: name.slice(0, MAX.hoTen), donVi: clean(get(row, 'donVi')).slice(0, MAX.default), phong: clean(get(row, 'phong')).slice(0, MAX.default),
        to: clean(get(row, 'to')).slice(0, MAX.default), chucDanh: clean(get(row, 'chucDanh')).slice(0, MAX.default), noiLamViec: clean(get(row, 'noiLamViec')).slice(0, MAX.default),
        namSinh: year.value, gioiTinh: normGender(get(row, 'gioiTinh')), sdt: phone.valid ? phone.value : '', email: mail.valid ? mail.value : '', nhom
      };
      if (!phone.valid) warnings.push({line, name, reason: 'SĐT không hợp lệ: "' + clean(get(row, 'sdt')) + '" (bỏ qua số này)'});
      if (!mail.valid) warnings.push({line, name, reason: 'Email không hợp lệ: "' + clean(get(row, 'email')) + '" (bỏ qua email này)'});
      if (!year.valid) warnings.push({line, name, reason: 'Năm sinh không hợp lệ: "' + clean(get(row, 'namSinh')) + '"'});
      const key = makeKey(rec);
      if (seen.has(key)) { skipped.push({line, reason: 'Trùng khoá "' + key + '" với dòng ' + seen.get(key)}); continue; }
      seen.set(key, line);
      records.push({key, ...rec});
    }
    return {ok: true, records, skipped, warnings, mapped: Object.keys(map).filter(f => f !== 'stt'), missing: ['hoTen', 'sdt', 'email', 'maNv'].filter(f => map[f] === undefined)};
  }

  const same = (a, b) => FIELDS.every(f => (a[f] ?? '') === (b[f] ?? ''));
  // existing: {key: rec} đang có trên hệ thống; records: bản ghi từ file.
  function diff(existing, records, mode = 'merge') {
    const added = [], updated = [], unchanged = [];
    for (const r of records) {
      const old = existing[r.key];
      if (!old) added.push(r); else if (same(old, r)) unchanged.push(r); else updated.push(r);
    }
    const keep = new Set(records.map(r => r.key));
    const removed = mode === 'replace' ? Object.keys(existing).filter(k => !keep.has(k)) : [];
    return {added, updated, unchanged, removed};
  }

  const initials = name => { const w = clean(name).split(' ').filter(Boolean); return ((w.length > 1 ? w[w.length - 2][0] : '') + (w[w.length - 1] || '')[0] || '?').toUpperCase(); };
  // Chuẩn hoá để khớp THEO ĐẦU TỪ: bỏ dấu, mọi ký tự không phải chữ/số → khoảng trắng, bao hai đầu bằng khoảng trắng.
  // (Trước đây dùng includes() trên chuỗi con nên "huy" khớp nhầm giữa "chuyên", "quang" khớp "Quảng Ninh".)
  const words = v => ' ' + plain(v).replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  const queryTokens = query => words(query).trim().split(' ').filter(Boolean);
  const searchText = r => words([r.hoTen, r.maNv, r.sdt, r.email, r.chucDanh, r.phong, r.to, r.noiLamViec, r.donVi, r.nhom].join(' '));
  function matches(rec, query) {
    const tokens = queryTokens(query), digits = plain(query).replace(/\D/g, '');
    if (!tokens.length) return true;
    const text = rec._s || searchText(rec);
    // Mỗi từ khoá phải là ĐẦU của một từ trong hồ sơ; SĐT cho phép khớp một phần (≥ 3 chữ số).
    return tokens.every(tok => text.includes(' ' + tok)) || (digits.length >= 3 && String(rec.sdt || '').includes(digits));
  }
  // Độ liên quan (số càng nhỏ càng đứng trước): 0 = cụm từ nằm liền trong tên; 1 = đủ các từ trong tên;
  // 2 = đủ các từ trong tên/mã NV/SĐT/email; 3 = khớp nhờ các trường còn lại (chức danh, phòng ban, nơi làm việc…).
  function rank(rec, query) {
    const tokens = queryTokens(query); if (!tokens.length) return 9;
    const name = words(rec.hoTen);
    if (name.includes(' ' + tokens.join(' '))) return 0;
    if (tokens.every(t => name.includes(' ' + t))) return 1;
    const identity = words([rec.hoTen, rec.maNv, rec.sdt, rec.email].join(' '));
    return tokens.every(t => identity.includes(' ' + t)) ? 2 : 3;
  }
  // Tra email trong danh bạ theo TÊN cán bộ ghi trên hồ sơ (vd "Võ Thị Mỹ Dung - NTN": phần sau " - " là ký hiệu, bỏ đi).
  // Chỉ trả email khi xác định được duy nhất một người: trùng tên thì thu hẹp theo đơn vị; vẫn nhiều email khác nhau → '' (không đoán).
  const nameKey = v => words(String(v == null ? '' : v).replace(/\s+[-–—]\s+.*$/, '')).trim();
  function lookupEmail(records, name, unit = '') {
    const key = nameKey(name); if (!key) return '';
    const hits = (records || []).filter(r => r && r.email && nameKey(r.hoTen) === key);
    const emails = list => [...new Set(list.map(r => String(r.email).toLowerCase()))];
    if (emails(hits).length <= 1) return hits.length ? hits[0].email : '';
    const place = words(unit).trim();
    const near = place ? hits.filter(r => words([r.donVi, r.phong, r.to, r.nhom, r.noiLamViec].join(' ')).includes(' ' + place + ' ')) : [];
    return emails(near).length === 1 ? near[0].email : '';
  }
  const fmtPhone = v => { const d = String(v || ''); return d.length === 10 ? d.slice(0, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7) : d.length === 11 ? d.slice(0, 4) + ' ' + d.slice(4, 8) + ' ' + d.slice(8) : d; };

  function vcard(r) {
    const esc = s => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
    const parts = clean(r.hoTen).split(' '), last = parts.pop() || '', first = parts.join(' ');
    return ['BEGIN:VCARD', 'VERSION:3.0', 'N:' + esc(first) + ';' + esc(last) + ';;;', 'FN:' + esc(r.hoTen), r.chucDanh ? 'TITLE:' + esc(r.chucDanh) : '', (r.phong || r.donVi) ? 'ORG:' + esc('Bảo hiểm Tasco') + ';' + esc(r.phong || r.donVi) : '',
      r.sdt ? 'TEL;TYPE=CELL:' + r.sdt : '', r.email ? 'EMAIL;TYPE=WORK:' + r.email : '', r.noiLamViec ? 'ADR;TYPE=WORK:;;' + esc(r.noiLamViec) + ';;;;' : '', 'END:VCARD'].filter(Boolean).join('\r\n');
  }

  return {FIELDS, LABELS, HEADERS, plain, clean, normPhone, normEmail, normYear, normGender, makeKey, findHeader, parseRows, diff, initials, searchText, matches, rank, lookupEmail, fmtPhone, vcard};
})();
if (typeof window !== 'undefined') window.ContactCalc = ContactCalc;
