// Xuất bảng kết quả của trợ lý AI ra Excel / CSV hoặc sao chép để dán vào email.
// Bảng có dạng {title, head: [..], rows: [[..]]}; số giữ nguyên là số, chữ được chống "chèn công thức" khi mở bằng Excel.
const TascoAIExport = (() => {
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
  // Ô bắt đầu bằng = + @ (hoặc - theo sau chữ) bị Excel hiểu là công thức → thêm dấu nháy đơn phía trước.
  const safeText = value => { const text = String(value ?? ''); return /^[=+@\t\r]/.test(text) || (/^-/.test(text) && !/^-?\d+([.,]\d+)?$/.test(text) && text.length > 1) ? "'" + text : text; };
  const cell = value => typeof value === 'number' && Number.isFinite(value) ? value : safeText(value);
  const fileStem = title => (String(title || 'ket-qua').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'ket-qua');
  const stamp = () => new Date().toISOString().slice(0, 10);

  // CSV dùng dấu chấm phẩy (Excel tiếng Việt) và BOM để giữ dấu tiếng Việt.
  function toCsv(table) {
    const quote = value => { const text = String(cell(value)); return /[";\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text; };
    return '﻿' + [table.head, ...table.rows].map(row => row.map(quote).join(';')).join('\r\n');
  }
  function toText(table) {
    return [table.head, ...table.rows].map(row => row.map(value => String(value ?? '').replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');
  }
  // Bảng HTML có viền inline: dán vào Outlook/Gmail vẫn giữ nguyên dạng bảng.
  function toHtml(table) {
    const td = (value, header) => '<' + (header ? 'th' : 'td') + ' style="border:1px solid #bbb;padding:4px 8px;text-align:' + (typeof value === 'number' ? 'right' : 'left') + (header ? ';background:#f1f1f1' : '') + '">' + escapeHtml(typeof value === 'number' ? value.toLocaleString('vi-VN') : value) + '</' + (header ? 'th' : 'td') + '>';
    return '<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px"><thead><tr>' + table.head.map(value => td(value, true)).join('') + '</tr></thead><tbody>'
      + table.rows.map(row => '<tr>' + row.map(value => td(value, false)).join('') + '</tr>').join('') + '</tbody></table>';
  }

  function toXlsxBlob(table) {
    if (typeof XLSX === 'undefined' || !XLSX.utils) return null;
    const sheet = XLSX.utils.aoa_to_sheet([table.head, ...table.rows.map(row => row.map(cell))]);
    sheet['!cols'] = table.head.map((_, index) => ({wch: Math.min(40, Math.max(10, ...[table.head[index], ...table.rows.slice(0, 200).map(row => row[index])].map(value => String(value ?? '').length + 2)))}));
    table.head.forEach((_, index) => { const ref = XLSX.utils.encode_cell({r: 0, c: index}); if (sheet[ref]) sheet[ref].s = {font: {bold: true}, fill: {fgColor: {rgb: 'F1F1F1'}}}; });
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, String(table.title || 'Kết quả').replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31));
    return new Blob([XLSX.write(book, {bookType: 'xlsx', type: 'array'})], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }

  function save(blob, name) {
    if (typeof SharedFormsAI !== 'undefined' && SharedFormsAI.saveBlob) return SharedFormsAI.saveBlob(blob, name);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = name; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  }
  // Ưu tiên .xlsx; thiếu thư viện Excel thì tải CSV.
  function download(table) {
    const stem = fileStem(table.title) + '-' + stamp();
    const xlsx = toXlsxBlob(table);
    if (xlsx) { save(xlsx, stem + '.xlsx'); return 'xlsx'; }
    save(new Blob([toCsv(table)], {type: 'text/csv;charset=utf-8'}), stem + '.csv');
    return 'csv';
  }
  async function copy(table) {
    const text = toText(table), html = toHtml(table);
    try {
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') { await navigator.clipboard.write([new ClipboardItem({'text/html': new Blob([html], {type: 'text/html'}), 'text/plain': new Blob([text], {type: 'text/plain'})})]); return true; }
      if (navigator.clipboard) { await navigator.clipboard.writeText(text); return true; }
    } catch (_) { /* thử cách dự phòng */ }
    const area = document.createElement('textarea');
    area.value = text; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.appendChild(area); area.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    area.remove();
    return ok;
  }

  return {toCsv, toText, toHtml, toXlsxBlob, download, copy, safeText, fileStem};
})();
