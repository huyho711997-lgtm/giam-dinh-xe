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

// ---- Định dạng: font, cỡ chữ, đậm/nghiêng…, căn lề ----------------------------------------------
const idxOf = (xml, text) => P.listParagraphs(xml).find(p => p.text === text).idx;
const paraXml = (xml, text) => { const p = P.listParagraphs(xml).find(item => item.text === text); return xml.slice(p.start, p.end); };

test('đổi định dạng một đoạn chữ: tách run đúng chỗ, giữ nguyên chữ và định dạng cũ', () => {
  const idx = idxOf(DOC, 'Số hồ sơ: HS-001 ngày 14/11/2026');
  const out = P.build(DOC, {formats:{[idx]:{ranges:[{start:3, end:12, props:{u:true, sz:30, font:'Arial'}}]}}});
  assert.deepEqual(texts(out), texts(DOC));
  const xml = paraXml(out, 'Số hồ sơ: HS-001 ngày 14/11/2026');
  assert.match(xml, /<w:t xml:space="preserve">Số <\/w:t>/);
  assert.match(xml, /<w:rPr><w:rFonts w:ascii="Arial"[^>]*\/><w:sz w:val="30"\/><w:u w:val="single"\/><\/w:rPr><w:t xml:space="preserve">hồ sơ: <\/w:t>/);
  // "HS-001" vốn đậm: vùng bị đổi phủ lên run đậm, nên phần còn lại của run đó vẫn đậm.
  assert.match(xml, /<w:b\/><w:sz w:val="30"\/><w:u w:val="single"\/><\/w:rPr><w:t xml:space="preserve">HS<\/w:t>/);
  assert.match(xml, /<w:rPr><w:b\/><\/w:rPr><w:t xml:space="preserve">-001<\/w:t>/);
  assert.match(xml, /<w:rPr><w:i\/><\/w:rPr><w:t xml:space="preserve">14\/11\/2026<\/w:t>/);
  // Các đoạn khác không bị đụng tới.
  assert.equal(paraXml(out, 'BIÊN BẢN'), paraXml(DOC, 'BIÊN BẢN'));
});

test('bỏ đậm / bỏ nghiêng ghi rõ w:val="0" để ghi đè kiểu', () => {
  const idx = idxOf(DOC, 'Số hồ sơ: HS-001 ngày 14/11/2026');
  const out = P.build(DOC, {formats:{[idx]:{ranges:[{start:10, end:16, props:{b:false}}]}}});
  assert.match(paraXml(out, 'Số hồ sơ: HS-001 ngày 14/11/2026'), /<w:rPr><w:b w:val="0"\/><\/w:rPr><w:t xml:space="preserve">HS-001<\/w:t>/);
});

test('phần tử trong rPr đúng thứ tự schema, thay thế thay vì trùng lặp', () => {
  const rPr = P.mergeRPr('<w:rPr><w:rFonts w:asciiTheme="minorHAnsi"/><w:color w:val="000000"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="vi-VN"/></w:rPr>', {b:true, i:true, u:true, sz:28, color:'1e40af', font:'Tahoma'});
  assert.equal(rPr, '<w:rPr><w:rFonts w:ascii="Tahoma" w:hAnsi="Tahoma" w:eastAsia="Tahoma" w:cs="Tahoma"/><w:b/><w:i/><w:color w:val="1E40AF"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:u w:val="single"/><w:lang w:val="vi-VN"/></w:rPr>');
  assert.equal(P.mergeRPr('', {b:true}), '<w:rPr><w:b/></w:rPr>');
  assert.equal(P.mergeRPr('<w:rPr/>', {i:true}), '<w:rPr><w:i/></w:rPr>');
  // Giá trị lạ bị bỏ qua, không sinh XML hỏng.
  assert.equal(P.mergeRPr('<w:rPr><w:b/></w:rPr>', {color:'red', sz:-5, font:'  '}), '<w:rPr><w:b/></w:rPr>');
  assert.match(P.mergeRPr('', {font:'A"B<C'}), /w:ascii="A&quot;B&lt;C"/);
});

test('định dạng trong run có tab, xuống dòng và ảnh: tách giữa token, không mất phần tử nào', () => {
  const idx = idxOf(DOC, 'Cột A\tCột B\tCột C');
  const out = P.build(DOC, {formats:{[idx]:{ranges:[{start:6, end:11, props:{b:true}}]}}});
  const xml = paraXml(out, 'Cột A\tCột B\tCột C');
  assert.equal((xml.match(/<w:tab\/>/g) || []).length, 2);
  assert.deepEqual(texts(out), texts(DOC));
  assert.match(xml, /<w:rPr><w:b\/><\/w:rPr><w:t>Cột B<\/w:t>/);
  const img = idxOf(DOC, 'Ảnh:  hết.');
  const withImage = P.build(DOC, {formats:{[img]:{ranges:[{start:0, end:5, props:{i:true}}]}}});
  assert.match(paraXml(withImage, 'Ảnh:  hết.'), /<w:drawing>[\s\S]*<a:blip r:embed="rId11"\/>[\s\S]*<\/w:drawing>/);
  const lines = idxOf(DOC, 'Dòng một\nDòng hai');
  const br = P.build(DOC, {formats:{[lines]:{ranges:[{start:0, end:17, props:{sz:24}}]}}});
  assert.equal((paraXml(br, 'Dòng một\nDòng hai').match(/<w:br\/>/g) || []).length, 1);
});

test('căn lề: chèn <w:jc> đúng chỗ trong pPr, tạo pPr khi chưa có, thay khi đã có', () => {
  const idx = idxOf(DOC, 'BIÊN BẢN');
  assert.match(paraXml(P.build(DOC, {formats:{[idx]:{align:'center'}}}), 'BIÊN BẢN'), /<w:pPr><w:pStyle w:val="Heading1"\/><w:jc w:val="center"\/><\/w:pPr>/);
  const plainIdx = idxOf(DOC, 'Biển số');
  assert.match(paraXml(P.build(DOC, {formats:{[plainIdx]:{align:'right'}}}), 'Biển số'), /^<w:p><w:pPr><w:jc w:val="right"\/><\/w:pPr><w:r>/);
  assert.equal(P.applyFormat('<w:p><w:pPr><w:spacing w:after="0"/><w:jc w:val="left"/><w:rPr><w:b/></w:rPr></w:pPr><w:r><w:t>x</w:t></w:r></w:p>', {align:'both'}), '<w:p><w:pPr><w:spacing w:after="0"/><w:jc w:val="both"/><w:rPr><w:b/></w:rPr></w:pPr><w:r><w:t>x</w:t></w:r></w:p>');
  assert.equal(P.applyFormat('<w:p><w:pPr><w:spacing w:after="0"/><w:rPr><w:b/></w:rPr></w:pPr><w:r><w:t>x</w:t></w:r></w:p>', {align:'center'}), '<w:p><w:pPr><w:spacing w:after="0"/><w:jc w:val="center"/><w:rPr><w:b/></w:rPr></w:pPr><w:r><w:t>x</w:t></w:r></w:p>');
  assert.match(P.applyFormat('<w:p><w:pPr/><w:r><w:t>x</w:t></w:r></w:p>', {align:'center'}), /<w:pPr><w:jc w:val="center"\/><\/w:pPr>/);
  assert.match(P.applyFormat('<w:p/>', {align:'center'}), /^<w:p><w:pPr><w:jc w:val="center"\/><\/w:pPr><\/w:p>$/);
  assert.equal(P.applyFormat('<w:p><w:r><w:t>x</w:t></w:r></w:p>', {align:'lạ'}), '<w:p><w:r><w:t>x</w:t></w:r></w:p>');
});

test('sửa chữ và đổi định dạng cùng lúc (toạ độ theo chữ mới); đoạn mới tách ra cũng nhận định dạng', () => {
  const idx = idxOf(DOC, 'Đoạn cuối: 12.500.000 đồng.');
  const out = P.build(DOC, {
    edits:{[idx]:'Đoạn cuối: 99 đồng.'},
    formats:{[idx]:{ranges:[{start:11, end:13, props:{b:true, color:'ff0000'}}]}},
    created:[{anchor:idx, cloneOf:idx, text:'Phần tách ra', ranges:[{start:0, end:5, props:{sz:36}}], align:'center'}]
  });
  assert.deepEqual(texts(out).slice(-2), ['Đoạn cuối: 99 đồng.', 'Phần tách ra']);
  assert.match(paraXml(out, 'Đoạn cuối: 99 đồng.'), /<w:rPr><w:b\/><w:color w:val="FF0000"\/><\/w:rPr><w:t xml:space="preserve">99<\/w:t>/);
  const created = paraXml(out, 'Phần tách ra');
  assert.match(created, /<w:jc w:val="center"\/>/);
  assert.match(created, /<w:sz w:val="36"\/><\/w:rPr><w:t xml:space="preserve">Phần <\/w:t>/);
});

test('định dạng: chặn đoạn bị khóa; vùng không hợp lệ bị bỏ qua; không đổi gì thì giữ nguyên chuỗi', () => {
  const locked = idxOf(DOC, 'Trang 1');
  assert.throws(() => P.build(DOC, {formats:{[locked]:{ranges:[{start:0, end:2, props:{b:true}}]}}}), /không thể đổi định dạng/);
  const idx = idxOf(DOC, 'BIÊN BẢN');
  assert.equal(P.build(DOC, {formats:{[idx]:{ranges:[{start:3, end:3, props:{b:true}}, {start:-1, end:2, props:{b:true}}, {start:0, end:999, props:{b:true}}]}}}), DOC);
  assert.equal(P.build(DOC, {}), DOC);
});

test('sourceMap: ký tự mới thừa hưởng định dạng của ký tự bên trái, thay thế thừa hưởng ký tự bị thay', () => {
  assert.deepEqual(plain(P.sourceMap('abc', 'abc')), [0, 1, 2]);
  assert.deepEqual(plain(P.sourceMap('abc', 'abXYc')), [0, 1, 1, 1, 2]);
  assert.deepEqual(plain(P.sourceMap('abc', 'aZc')), [0, 1, 2]);
  assert.deepEqual(plain(P.sourceMap('abc', 'ac')), [0, 2]);
  assert.deepEqual(plain(P.sourceMap('abc', 'Xabc')), [0, 0, 1, 2]);
  assert.deepEqual(plain(P.sourceMap('', 'ab')), [-1, -1]);
});
