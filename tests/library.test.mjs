import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const load = (file, name) => {
  const ctx = vm.createContext({console});
  vm.runInContext(fs.readFileSync(new URL('../js/features/ai/' + file, import.meta.url), 'utf8') + '\nthis.api = ' + name + ';', ctx);
  return ctx.api;
};
const Parse = load('library-parse.js', 'TascoLibParse');
const Search = load('library-search.js', 'TascoLibSearch');

const MD = `---
ten: Quy trình giám định
so_hieu: QT-GD-01
hieu_luc_tu: 01/01/2026
trang_thai: đang hiệu lực
nguon: https://example.com/qt.pdf
---

# Quy trình giám định

Lời mở đầu.

## Điều 1. Phạm vi
Áp dụng cho xe cơ giới.

### 1.1. Đối tượng
Chủ xe và lái xe.

## Điều 2. Loại trừ bảo hiểm
Xe không có đăng kiểm còn hiệu lực khi xảy ra tai nạn thì không được bồi thường.
`;

test('đọc khối thông tin đầu file', () => {
  const {meta, body} = Parse.parseFrontMatter(MD);
  assert.deepEqual({...meta}, {ten: 'Quy trình giám định', soHieu: 'QT-GD-01', hieuLucTu: '2026-01-01', trangThai: 'dang_hieu_luc', nguon: 'https://example.com/qt.pdf'});
  assert.ok(body.startsWith('\n# Quy trình') || body.startsWith('# Quy trình'));
  assert.deepEqual({...Parse.parseFrontMatter('# Không có').meta}, {});
  assert.equal(Parse.normalizeStatus('Hết hiệu lực'), 'het_hieu_luc');
  assert.equal(Parse.normalizeStatus('đã thay thế'), 'da_thay_the');
});

test('cắt Markdown theo tiêu đề, ghép đường dẫn mục', () => {
  const {meta, body} = Parse.parseFrontMatter(MD);
  const chunks = Parse.chunkMarkdown(body, {docTitle: meta.ten});
  assert.deepEqual([...chunks.map(chunk => chunk.t)], ['Quy trình giám định', 'Điều 1. Phạm vi', 'Điều 1. Phạm vi › 1.1. Đối tượng', 'Điều 2. Loại trừ bảo hiểm']);
  assert.match(chunks[3].x, /đăng kiểm/);
  assert.equal(chunks[0].x, 'Lời mở đầu.');
});

test('mục dài được cắt thành nhiều phần, không phần nào vượt giới hạn', () => {
  const long = '## Điều 9\n' + Array.from({length: 40}, (_, i) => 'Đoạn ' + i + ' ' + 'chữ '.repeat(60)).join('\n\n');
  const chunks = Parse.chunkMarkdown(long, {docTitle: 'X', maxChars: 600});
  assert.ok(chunks.length > 3);
  assert.ok(chunks.every(chunk => chunk.x.length <= 600));
  assert.match(chunks[1].t, /phần 2/);
});

test('văn bản thường: nhận diện Chương/Mục/Điều', () => {
  const md = Parse.textToMarkdown('Chương I Quy định chung\nĐiều 1. Phạm vi\nNội dung A\nĐiều 2. Khác\nNội dung B');
  const chunks = Parse.chunkMarkdown(md, {docTitle: 'D'});
  assert.deepEqual([...chunks.map(chunk => chunk.t)], ['Chương I Quy định chung › Điều 1. Phạm vi', 'Chương I Quy định chung › Điều 2. Khác']);
  assert.equal(Parse.textToMarkdown('# đã là markdown'), '# đã là markdown');
});

test('bảng tính thành đoạn có tên cột', () => {
  const rows = [['Loại xe', 'Khấu hao'], ['Ô tô con', '10%'], ['Xe tải', '12%'], ['', '']];
  const [chunk] = Parse.rowsToChunks(rows, 'Bảng khấu hao');
  assert.match(chunk.t, /Bảng khấu hao \(dòng 2–3\)/);
  assert.equal(chunk.x, 'Loại xe: Ô tô con; Khấu hao: 10%\nLoại xe: Xe tải; Khấu hao: 12%');
});

test('giới hạn số đoạn', () => {
  const many = Array.from({length: 700}, (_, i) => ({t: 'm' + i, x: 'x'}));
  const result = Parse.limitChunks(many);
  assert.equal(result.chunks.length, 600);
  assert.equal(result.truncated, true);
});

test('BM25: tìm không phân biệt dấu, ưu tiên đúng mục, bỏ bản hết hiệu lực', () => {
  const {meta, body} = Parse.parseFrontMatter(MD);
  const docs = [
    {id: 'a', meta, chunks: Parse.chunkMarkdown(body, {docTitle: meta.ten})},
    {id: 'b', meta: {ten: 'Bản cũ', trangThai: 'het_hieu_luc'}, chunks: [{t: 'Điều 2', x: 'Xe không có đăng kiểm vẫn được bồi thường.'}]},
    {id: 'c', meta: {ten: 'Bảng giá', trangThai: 'dang_hieu_luc'}, chunks: [{t: 'Bảng khấu hao', x: 'Ô tô con: 10%. Xe tải: 12%.'}, {t: 'Thanh toán', x: 'Chuyển khoản trong 5 ngày làm việc.'}]}
  ];
  const index = Search.build(docs);
  const found = Search.search(index, 'xe chưa dang kiem có được bồi thường không?', {keywords: ['hết hạn đăng kiểm', 'loại trừ']});
  assert.equal(found[0].docId, 'a');
  assert.equal(found[0].chunk.t, 'Điều 2. Loại trừ bảo hiểm');
  assert.ok(!found.some(row => row.docId === 'b'), 'bản hết hiệu lực bị loại');
  assert.equal(Search.search(index, 'đăng kiểm', {includeInactive: true}).some(row => row.docId === 'b'), true);
  assert.equal(Search.search(index, 'khau hao o to', {})[0].docId, 'c');
  assert.equal(Search.search(index, 'blockchain', {}).length, 0);
  assert.equal(Search.search(Search.build([]), 'abc', {}).length, 0);
});
