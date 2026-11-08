// Tên lái xe & Số điện thoại lái xe của hồ sơ: tách dữ liệu cũ ("Tên - SĐT"), đọc file Excel bổ sung, đối chiếu theo Số hồ sơ bồi thường.
// Module thuần (không đụng DOM/mạng) để kiểm thử được. Trường lưu trên hồ sơ: laiXe (họ tên) và dienThoaiLaiXe (số điện thoại).
const DriverContact = (() => {
  const EMPTY = new Set(['', '—', '-', '–', 'null', 'undefined', 'false', 'n/a']);
  const clean = value => {
    const text = value === null || value === undefined ? '' : String(value).replace(/\s+/g, ' ').trim();
    return EMPTY.has(text.toLowerCase()) ? '' : text;
  };
  const normKey = value => clean(value).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const fold = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, ' ').trim();

  // Số điện thoại: bỏ khoảng trắng/dấu chấm/gạch; số 9 chữ số mất số 0 đầu (Excel lưu dạng số) thì thêm lại; +84/84 đổi về 0.
  function normPhone(value) {
    let text = clean(value);
    if (!text) return '';
    if (/^\d+\.0+$/.test(text)) text = text.replace(/\.0+$/, '');
    text = text.replace(/[\s.\-()]/g, '');
    if (/^\+?84\d{9}$/.test(text)) return '0' + text.replace(/^\+?84/, '');
    if (/^\d{9}$/.test(text)) return '0' + text;
    return text;
  }

  // Dữ liệu cũ gộp "Tên - SĐT" trong một ô → {name, phone}.
  const PHONE_AT = /(?:\+?84|0)(?:[\s.\-]?\d){9}/;
  function splitLegacy(text) {
    const raw = clean(text);
    if (!raw) return {name: '', phone: ''};
    const match = raw.match(PHONE_AT);
    if (!match) return {name: raw, phone: ''};
    const name = (raw.slice(0, match.index) + ' ' + raw.slice(match.index + match[0].length))
      .replace(/\b(?:s[đd]t|đt|dt|tel|phone|điện thoại|dien thoai|số điện thoại)\b\s*[:.]?/gi, ' ')
      .replace(/[()\[\]]/g, ' ').replace(/\s*[-–,;:/|]+\s*/g, ' ').replace(/\s+/g, ' ').trim();
    return {name, phone: normPhone(match[0])};
  }

  // Giá trị đang có của hồ sơ. Hồ sơ cũ chưa có dienThoaiLaiXe thì tách từ laiXe.
  function readDriver(claim) {
    const item = claim || {};
    if (item.dienThoaiLaiXe !== undefined && item.dienThoaiLaiXe !== null) return {name: clean(item.laiXe), phone: normPhone(item.dienThoaiLaiXe)};
    return splitLegacy(item.laiXe);
  }

  // ---- Đọc file Excel (insurance.claim.profile): cột "Tên" là Số hồ sơ bồi thường ----------------
  // rows: mảng các dòng (sheet_to_json header:1). Trả null khi không phải file dạng này.
  function parseSheet(rows) {
    if (!Array.isArray(rows)) return null;
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;
      const col = {hsbt: -1, name: -1, phone: -1, plate: -1};
      row.forEach((cell, index) => {
        const text = fold(cell);
        if (!text) return;
        if (text === 'ten' || text.includes('so ho so boi thuong') || text.includes('so hsbt')) { if (col.hsbt === -1 || text !== 'ten') col.hsbt = index; }
        else if (text.includes('ten lai xe') || text === 'lai xe' || text.includes('tai xe')) col.name = index;
        else if (text.includes('dien thoai') || text === 'sdt' || text.includes('so dt')) col.phone = index;
        else if (text.includes('bien kiem soat') || text.includes('bien so') || text === 'bsx') col.plate = index;
      });
      // Phải có cột Số HSBT và ít nhất một trong hai cột tên lái xe / điện thoại.
      if (col.hsbt === -1 || (col.name === -1 && col.phone === -1)) continue;
      // File xuất đầy đủ (hàng chục cột) do luồng cập nhật toàn bộ hồ sơ xử lý, không phải file bổ sung lái xe.
      if (row.filter(cell => clean(cell)).length > 25) return null;
      const out = [], seen = new Map(); let skipped = 0, duplicates = 0;
      for (let r = i + 1; r < rows.length; r++) {
        const line = rows[r];
        if (!Array.isArray(line) || line.every(cell => !clean(cell))) continue;
        const hsbt = clean(line[col.hsbt]), key = normKey(hsbt);
        // Dòng nhóm (vd "cancel (430)") và dòng không có số hồ sơ: bỏ qua.
        if (!key || !/\d/.test(key)) { skipped++; continue; }
        const name = col.name === -1 ? '' : clean(line[col.name]);
        const phone = col.phone === -1 ? '' : normPhone(line[col.phone]);
        const plate = col.plate === -1 ? '' : clean(line[col.plate]).toUpperCase();
        if (seen.has(key)) {
          // Trùng số hồ sơ: gộp, giá trị không rỗng của dòng sau thắng.
          duplicates++;
          const old = out[seen.get(key)];
          old.name = name || old.name; old.phone = phone || old.phone; old.plate = plate || old.plate;
        } else { seen.set(key, out.length); out.push({key, hsbt, name, phone, plate}); }
      }
      return {rows: out, skipped, duplicates, hasName: col.name !== -1, hasPhone: col.phone !== -1};
    }
    return null;
  }

  // claims: {id → hồ sơ}. Chỉ điền giá trị file có (ô trống trong file không xoá dữ liệu đang có).
  function plan(claims, parsed) {
    const byKey = new Map();
    for (const [id, claim] of Object.entries(claims || {})) {
      if (!claim || typeof claim !== 'object') continue;
      const key = normKey(claim.soHoSoBoiThuong);
      if (!key) continue;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push({id, claim});
    }
    const changes = [], notFound = []; let unchanged = 0, empty = 0;
    for (const row of parsed.rows) {
      if (!row.name && !row.phone) { empty++; continue; }
      const targets = byKey.get(row.key);
      if (!targets) { notFound.push(row); continue; }
      for (const {id, claim} of targets) {
        const before = readDriver(claim);
        const after = {name: row.name || before.name, phone: row.phone || before.phone};
        if (after.name === before.name && after.phone === before.phone) { unchanged++; continue; }
        changes.push({id, hsbt: row.hsbt, plate: claim.bienSo || row.plate || '', before, after,
          nameChanged: after.name !== before.name, phoneChanged: after.phone !== before.phone});
      }
    }
    const summary = {total: parsed.rows.length, matched: parsed.rows.length - notFound.length - empty, changed: changes.length, unchanged, notFound: notFound.length, empty, skipped: parsed.skipped || 0, duplicates: parsed.duplicates || 0};
    return {changes, notFound, summary};
  }

  // Đường dẫn ghi (multi-path update của Firebase).
  function updates(planned, now = Date.now()) {
    const out = {};
    for (const item of planned.changes) {
      out['pending_claims/' + item.id + '/laiXe'] = item.after.name || '—';
      out['pending_claims/' + item.id + '/dienThoaiLaiXe'] = item.after.phone || '—';
      out['pending_claims/' + item.id + '/updatedAt'] = now;
    }
    return out;
  }

  return {clean, normPhone, splitLegacy, readDriver, parseSheet, plan, updates};
})();
