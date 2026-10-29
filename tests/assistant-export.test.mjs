import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ console, String, Number, Date, Math, Blob: class {} });
vm.runInContext(fs.readFileSync(new URL('../js/features/ai/assistant-export.js', import.meta.url), 'utf8') + '\n;this.api = TascoAIExport;', context);
const api = context.api;
const table = { title: 'Hồ sơ tồn trên 7 ngày', head: ['Biển số', 'Ghi chú', 'Số ngày'], rows: [['47H11450', 'có "ngoặc"; và\nxuống dòng', 14], ['=HYPERLINK("x")', '<b>x</b>', 3], ['-', '-5', 0]] };

test('CSV: BOM, dấu chấm phẩy, thoát dấu nháy/xuống dòng, chống chèn công thức', () => {
  const csv = api.toCsv(table);
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines[0], 'Biển số;Ghi chú;Số ngày');
  assert.ok(csv.includes('"có ""ngoặc""; và\nxuống dòng";14'));
  assert.ok(csv.includes("'=HYPERLINK"), 'ô bắt đầu bằng = bị vô hiệu hoá');
  assert.ok(csv.includes('-;-5;0'), 'dấu - đơn lẻ và số âm giữ nguyên');
});

test('bảng HTML để dán email thoát ký tự đặc biệt, số căn phải', () => {
  const html = api.toHtml(table);
  assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;'));
  assert.ok(!html.includes('<b>x</b>'));
  assert.ok(html.includes('text-align:right'));
  assert.equal((html.match(/<tr>/g) || []).length, 4);
});

test('văn bản thuần tab-phân cách và tên file không dấu', () => {
  assert.equal(api.toText(table).split('\n')[1], '47H11450\tcó "ngoặc"; và xuống dòng\t14');
  assert.equal(api.fileStem(table.title), 'ho-so-ton-tren-7-ngay');
  assert.equal(api.toXlsxBlob(table), null, 'không có thư viện Excel thì trả null để dùng CSV');
});
