import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../js/features/drive/docx-patch.js', import.meta.url), 'utf8') + '\nthis.patch = DocxPatch;', ctx);
const P = ctx.patch;
const plain = value => JSON.parse(JSON.stringify(value));

const wrap = body => '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:mc="x" xmlns:m="y"><w:body>' + body + '<w:sectPr><w:pgSz w:w="11906"/></w:sectPr></w:body></w:document>';
const run = (text, rPr = '') => '<w:r>' + (rPr ? '<w:rPr>' + rPr + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + text + '</w:t></w:r>';
const texts = xml => plain(P.listParagraphs(xml).map(p => p.text));

const HEAD = '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' + run('BIÊN BẢN') + '</w:p>';
const MIXED = '<w:p>' + run('Số hồ sơ: ') + run('HS-001', '<w:b/>') + run(' ngày ') + run('14/11/2026', '<w:i/>') + '</w:p>';
const TABS = '<w:p><w:r><w:t>Cột A</w:t><w:tab/><w:t>Cột B</w:t><w:tab/><w:t>Cột C</w:t></w:r></w:p>';
const BREAK = '<w:p><w:r><w:t>Dòng một</w:t></w:r><w:r><w:br/></w:r><w:r><w:t>Dòng hai</w:t></w:r></w:p>';
const EMPTY = '<w:p/>';
const IMAGE = '<w:p>' + run('Ảnh: ') + '<w:r><w:drawing><wp:inline><a:blip r:embed="rId11"/></wp:inline></w:drawing></w:r>' + run(' hết.') + '</w:p>';
const CELL = '<w:tbl><w:tr><w:tc><w:p>' + run('Biển số') + '</w:p></w:tc><w:tc><w:p>' + run('47A-123.45') + '</w:p></w:tc></w:tr><w:tr><w:tc><w:p>' + run('Chủ xe') + '</w:p></w:tc><w:tc><w:p>' + run('Nguyễn Văn A &amp; &quot;B&quot; &lt;C&gt;') + '</w:p></w:tc></w:tr></w:tbl>';
const FIELD = '<w:p>' + run('Trang ') + '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>' + run('1') + '<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>';
const TRACKED = '<w:p><w:ins w:id="1" w:author="A">' + run('thêm') + '</w:ins></w:p>';
const SECTION = '<w:p><w:pPr><w:sectPr><w:pgSz w:w="12240"/></w:sectPr></w:pPr></w:p>';
const BOX = '<w:p><w:r><w:t>Ngoài</w:t></w:r><w:r><w:pict><w:txbxContent><w:p><w:r><w:t>Trong hộp</w:t></w:r></w:p></w:txbxContent></w:pict></w:r></w:p>';
const LAST = '<w:p>' + run('Đoạn cuối: 12.500.000 đồng.') + '</w:p>';
const DOC = wrap(HEAD + MIXED + TABS + BREAK + EMPTY + IMAGE + CELL + FIELD + TRACKED + SECTION + BOX + LAST);

test('liệt kê đoạn lá: giải mã thực thể, tab, xuống dòng, bỏ đoạn trong hộp văn bản', () => {
  assert.deepEqual(texts(DOC), ['BIÊN BẢN', 'Số hồ sơ: HS-001 ngày 14/11/2026', 'Cột A\tCột B\tCột C', 'Dòng một\nDòng hai', '', 'Ảnh:  hết.', 'Biển số', '47A-123.45', 'Chủ xe', 'Nguyễn Văn A & "B" <C>', 'Trang 1', 'thêm', '', 'Đoạn cuối: 12.500.000 đồng.']);
});

test('phân loại: khóa trường/theo dõi thay đổi, hộp văn bản, và đoạn không được xóa', () => {
  const list = P.listParagraphs(DOC);
  const byText = text => list.find(p => p.text === text);
  assert.equal(byText('Trang 1').locked, true);
  assert.equal(byText('thêm').locked, true);
  assert.equal(byText('Biển số').locked, false);
  assert.equal(byText('Ảnh:  hết.').removable, false);
  assert.equal(byText('Biển số').removable, true);
  assert.equal(list.find(p => p.text === '' && /sectPr/.test(DOC.slice(p.start, p.end))).removable, false);
  assert.ok(!list.some(p => p.text === 'Trong hộp'));
});

test('diff theo ký tự cho kết quả đúng và gọn', () => {
  const apply = (a, rawOps) => { const ops = plain(rawOps); return applyOps(a, ops); };
  const applyOps = (a, ops) => { let out = '', pos = 0; for (const op of ops) { out += a.slice(pos, op.at) + op.ins; pos = op.at + op.del; } return out + a.slice(pos); };
  for (const [a, b] of [['abc', 'abc'], ['abc', 'abXc'], ['hello world', 'hello brave new world'], ['12.500.000', '15.000.000'], ['', 'x'], ['x', ''], ['kitten', 'sitting'], ['aaa', 'bbb']]) {
    assert.equal(apply(a, P.diff(a, b)), b, a + ' → ' + b);
  }
  assert.deepEqual(plain(P.diff('abc', 'abXc')), [{at:2, del:0, ins:'X'}]);
  assert.equal(P.diff('đổi tên', 'đổi tên khác').length, 1);
});

test('sửa chữ giữa run đậm: giữ định dạng, các đoạn khác giữ nguyên từng byte', () => {
  const out = P.build(DOC, {edits:{1:'Số hồ sơ: HS-002 ngày 14/11/2026'}});
  assert.ok(out.includes(run('HS-002', '<w:b/>')) || out.includes('<w:rPr><w:b/></w:rPr><w:t xml:space="preserve">HS-002</w:t>'));
  assert.equal(texts(out)[1], 'Số hồ sơ: HS-002 ngày 14/11/2026');
  const before = DOC.replace(MIXED, '@@'), after = out.replace(/<w:p><w:r><w:t xml:space="preserve">Số hồ sơ: [\s\S]*?<\/w:p>/, '@@');
  assert.equal(after, before, 'chỉ đoạn được sửa thay đổi');
});

test('gõ thêm ở cuối run nghiêng thì chữ mới kế thừa định dạng nghiêng', () => {
  const out = P.build(DOC, {edits:{1:'Số hồ sơ: HS-001 ngày 14/11/2026 (bổ sung)'}});
  assert.match(out, /<w:i\/><\/w:rPr><w:t xml:space="preserve">14\/11\/2026 \(bổ sung\)<\/w:t>/);
});

test('xóa chữ trải qua nhiều run', () => {
  const out = P.build(DOC, {edits:{1:'Số hồ sơ: HS-0'}});
  assert.equal(texts(out)[1], 'Số hồ sơ: HS-0');
  assert.match(out, /<w:b\/><\/w:rPr><w:t xml:space="preserve">HS-0<\/w:t>/);
});

test('đoạn có tab và xuống dòng: sửa chữ nhưng giữ tab/br', () => {
  const out = P.build(DOC, {edits:{2:'Cột A\tCột Z\tCột C', 3:'Dòng một\nDòng hai sửa'}});
  assert.equal(texts(out)[2], 'Cột A\tCột Z\tCột C');
  assert.equal(texts(out)[3], 'Dòng một\nDòng hai sửa');
  assert.equal((out.match(/<w:tab\/>/g) || []).length, 2);
  assert.equal((out.match(/<w:br\/>/g) || []).length, 1);
});

test('xóa tab, và chèn tab / xuống dòng mới', () => {
  assert.equal(texts(P.build(DOC, {edits:{2:'Cột ACột B\tCột C'}}))[2], 'Cột ACột B\tCột C');
  const out = P.build(DOC, {edits:{2:'Cột A\tCột B\t\nCột C'}});
  assert.equal(texts(out)[2], 'Cột A\tCột B\t\nCột C');
});

test('gõ vào đoạn trống (<w:p/>) tạo run mới', () => {
  const out = P.build(DOC, {edits:{4:'Chữ mới & <đặc biệt>'}});
  assert.equal(texts(out)[4], 'Chữ mới & <đặc biệt>');
  assert.match(out, /<w:p><w:r><w:t xml:space="preserve">Chữ mới &amp; &lt;đặc biệt&gt;<\/w:t><\/w:r><\/w:p>/);
});

test('đoạn có ảnh: sửa chữ quanh ảnh mà ảnh còn nguyên', () => {
  const out = P.build(DOC, {edits:{5:'Hình minh họa:  xong.'}});
  assert.equal(texts(out)[5], 'Hình minh họa:  xong.');
  assert.ok(out.includes('<w:drawing><wp:inline><a:blip r:embed="rId11"/></wp:inline></w:drawing>'));
});

test('ô bảng và thực thể XML được mã hóa đúng', () => {
  const out = P.build(DOC, {edits:{9:'Công ty A & B "C" <D>'}});
  assert.equal(texts(out)[9], 'Công ty A & B "C" <D>');
  assert.match(out, /Công ty A &amp; B "C" &lt;D&gt;/);
});

test('ký tự điều khiển bị loại, nbsp coi như dấu cách', () => {
  const out = P.build(DOC, {edits:{0:'BIÊN\u0007 BẢN MỚI'}});
  assert.equal(texts(out)[0], 'BIÊN BẢN MỚI');
  assert.equal(P.build(DOC, {edits:{0:'BIÊN BẢN'}}), DOC, 'nbsp = dấu cách → không đổi gì');
});

test('từ chối sửa đoạn bị khóa, và từ chối xóa đoạn chứa ảnh hoặc ngắt mục', () => {
  assert.throws(() => P.build(DOC, {edits:{10:'Trang 2'}}), /không thể sửa/);
  assert.throws(() => P.build(DOC, {edits:{11:'x'}}), /không thể sửa/);
  assert.throws(() => P.build(DOC, {removed:[5]}), /không xóa được/);
  assert.throws(() => P.build(DOC, {removed:[12]}), /không xóa được/);
  assert.throws(() => P.build(DOC, {edits:{99:'x'}}), /không còn/);
});

test('xóa đoạn trống và đoạn thường', () => {
  const out = P.build(DOC, {removed:[4, 6]});
  const after = texts(out);
  assert.equal(after.length, texts(DOC).length - 2);
  assert.ok(!after.includes('Biển số'));
});

test('tạo đoạn mới sau đoạn gốc: nhân bản pPr, bỏ sectPr, không mang thuộc tính paraId', () => {
  const source = wrap('<w:p w14:paraId="AAAA1111"><w:pPr><w:pStyle w:val="Heading1"/><w:rPr><w:b/></w:rPr></w:pPr>' + run('Tiêu đề') + '</w:p><w:p>' + run('Sau') + '</w:p>');
  const out = P.build(source, {created:[{anchor:0, cloneOf:0, text:'Mục mới'}, {anchor:0, cloneOf:0, text:'Mục nữa'}]});
  assert.deepEqual(texts(out), ['Tiêu đề', 'Mục mới', 'Mục nữa', 'Sau']);
  assert.ok(out.includes('<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:rPr><w:b/></w:rPr></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Mục mới</w:t></w:r></w:p>'));
  assert.equal((out.match(/paraId/g) || []).length, 1);
  const withSection = P.build(DOC, {created:[{anchor:12, cloneOf:12, text:'x'}]});
  assert.equal((withSection.match(/<w:sectPr>/g) || []).length, (DOC.match(/<w:sectPr>/g) || []).length, 'đoạn mới không mang ngắt mục');
});

test('tách đoạn: sửa đoạn gốc và tạo đoạn mới cùng lúc, đoạn mới nằm ngay sau', () => {
  const out = P.build(DOC, {edits:{13:'Đoạn cuối: '}, created:[{anchor:13, cloneOf:13, text:'12.500.000 đồng.'}]});
  const after = texts(out);
  assert.deepEqual(after.slice(-2), ['Đoạn cuối: ', '12.500.000 đồng.']);
});

test('đoạn mới sau đoạn bị xóa vẫn nằm đúng vị trí', () => {
  const out = P.build(DOC, {removed:[6], created:[{anchor:6, cloneOf:7, text:'Thay thế'}]});
  assert.equal(texts(out)[6], 'Thay thế');
});

test('không thay đổi gì thì trả về nguyên văn', () => {
  assert.equal(P.build(DOC, {}), DOC);
  assert.equal(P.build(DOC, {edits:{1:'Số hồ sơ: HS-001 ngày 14/11/2026'}}), DOC);
});

test('ghép đoạn màn hình với XML: theo thứ tự, và chịu được đoạn lệch (hộp văn bản)', () => {
  const xml = ['a', 'b', '', 'c', 'd'];
  assert.deepEqual(plain(P.align(['a', 'b', '', 'c', 'd'], xml)), [0, 1, 2, 3, 4]);
  assert.deepEqual(plain(P.align(['a', 'b', 'khác', 'c', 'd'], xml)), [0, 1, -1, 3, 4]);
  assert.deepEqual(plain(P.align(['a', 'x', 'y', 'd'], ['a', 'b', 'c', 'd'])), [0, -1, -1, 3]);
  assert.deepEqual(plain(P.align(['a b'], ['a b'])), [0]);
});

test('đoạn dài: diff vẫn nhanh và đúng', () => {
  const a = 'từ '.repeat(3000), b = a.replace('từ từ', 'từ MỚI từ');
  const start = Date.now();
  const ops = P.diff(a, b);
  assert.ok(Date.now() - start < 1500);
  assert.equal(ops.length, 1);
});
