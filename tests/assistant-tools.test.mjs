import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL('../js/features/' + name, import.meta.url), 'utf8');
function setup(pending, cases = {}) {
  const context = vm.createContext({
    console, JSON, Map, Set, Array, Object, Number, String, Math, Promise, Error,
    cachedPendingClaimsPayload: pending, cachedCasesPayload: cases,
    PENDING_STATUS_MAP: { moi: { label: 'Mới' }, cho_gdct: { label: 'Chờ GĐCT' }, kt_duyet: { label: 'KT duyệt' }, cho_kt_duyet: { label: 'Chờ KT duyệt' }, da_duyet_hsbt: { label: 'Đã duyệt HSBT' } },
    document: { readyState: 'complete', addEventListener() {}, querySelectorAll: () => [], getElementById: () => null, documentElement: { classList: { toggle() {} } } },
    localStorage: { getItem: () => null }, MutationObserver: class { observe() {} }, window: {}
  });
  vm.runInContext(read('documents/shared-forms-ai.js') + '\n;this.forms = SharedFormsAI;', context);
  vm.runInContext(read('ai/assistant-tools.js') + '\n;this.tools = TascoAITools;', context);
  vm.runInContext(read('ai/assistant.js') + '\n;this.fmt = formatTascoAIText; this.hist = tascoGeminiHistory;', context);
  return context;
}
const data = {
  a1: { bienSo: '47H11450', khachHang: 'TRẦN VĂN HIỆP', trangThai: 'cho_gdct', gdvTiepNhan: 'Nguyễn An', soHoSoBoiThuong: 'HSBT/1' },
  a2: { bienSo: '51K99999', khachHang: 'LÊ THỊ MAI', gdvTiepNhan: 'Nguyễn An' },
  a3: { bienSo: '60A12345', khachHang: 'Phạm Bình', trangThai: 'cho_gdct', gdvTiepNhan: 'Trần Bảo', hinhAnh: ['x'], url: 'http://x' }
};
const plain = value => JSON.parse(JSON.stringify(value));

test('tìm hồ sơ không phân biệt dấu/hoa thường và khớp mọi từ khoá', () => {
  const { tools } = setup(data);
  assert.equal(tools.search('ton', { tu_khoa: 'tran van hiep' }).so_ket_qua_khop, 1);
  assert.equal(tools.search('ton', { tu_khoa: '47h11450' }).ket_qua[0].ma, 'a1');
  assert.equal(tools.search('ton', { tu_khoa: 'hiep mai' }).so_ket_qua_khop, 0);
});

test('lọc theo trạng thái (tên hoặc mã) và giám định viên; hồ sơ thiếu trạng thái tính là Mới', () => {
  const { tools } = setup(data);
  assert.equal(tools.search('ton', { trang_thai: 'Chờ GĐCT' }).so_ket_qua_khop, 2);
  assert.equal(tools.search('ton', { trang_thai: 'cho_gdct', gdv: 'Trần Bảo' }).so_ket_qua_khop, 1);
  assert.equal(tools.search('ton', { trang_thai: 'moi' }).ket_qua[0].ma, 'a2');
});

test('giới hạn kết quả và không trả ảnh/đường dẫn', () => {
  const { tools } = setup(data);
  assert.equal(tools.search('ton', { gioi_han: 1 }).ket_qua.length, 1);
  const detail = tools.detail('ton', 'a3');
  assert.ok(!('hinhAnh' in detail.cac_truong) && !('url' in detail.cac_truong));
});

test('chi tiết: tìm theo mã, biển số; báo lỗi khi không thấy', () => {
  const { tools } = setup(data);
  assert.equal(tools.detail('ton', '51K99999').ma, 'a2');
  assert.match(tools.detail('ton', 'khong-co').loi, /Không tìm thấy/);
});

test('thống kê theo trạng thái và giám định viên', () => {
  const { tools } = setup(data);
  assert.deepEqual(plain(tools.stats('ton', 'trang_thai').thong_ke), [{ gia_tri: 'Chờ GĐCT', so_luong: 2 }, { gia_tri: 'Mới', so_luong: 1 }]);
  assert.equal(tools.stats('ton', 'gdv').thong_ke[0].gia_tri, 'Nguyễn An');
});

test('công cụ lỗi/không tồn tại trả về thông báo thay vì ném lỗi', async () => {
  const { tools } = setup(data);
  assert.match((await tools.run('khong_ton_tai')).loi, /không tồn tại/);
  assert.match((await tools.run('mo_ho_so', { ma: 'zzz' })).loi, /Không tìm thấy/);
});

test('định dạng trả lời: thoát HTML, danh sách, in đậm và liên kết mở hồ sơ', () => {
  const { fmt } = setup(data);
  const html = fmt('**Xong** <img src=x onerror=alert(1)>\n- [[mo:a1|47H11450 - HIỆP]]\n- hai');
  assert.ok(!html.includes('<img'));
  assert.match(html, /<b>Xong<\/b>/);
  assert.match(html, /<ul><li><button type="button" class="tasco-ai-link" data-ai-open="a1">47H11450 - HIỆP<\/button><\/li><li>hai<\/li><\/ul>/);
});

const dated = {
  d1: { bienSo: 'A1', trangThai: 'da_duyet_hsbt', toTrinhNgayDuyet: '05/10/2026', soTienDuyetBT: '12.500.000 đ' },
  d2: { bienSo: 'A2', trangThai: 'kt_duyet', ngayDuyetHsbt: '2026-10-20', soTienDuyetBT: 7500000 },
  d3: { bienSo: 'A3', trangThai: 'da_duyet_hsbt', toTrinhNgayDuyet: '30/09/2026', soTienDuyetBT: '1.000.000' },
  d4: { bienSo: 'A4', trangThai: 'cho_gdct' },
  d5: { bienSo: 'A5', trangThai: 'da_duyet_hsbt', pascNgayDuyet: 1792400000000 }
};

test('lọc theo khoảng ngày duyệt: đọc được dd/mm/yyyy, ISO và mili-giây; hồ sơ thiếu ngày bị loại và được báo', () => {
  const { tools } = setup(dated);
  const result = tools.stats('ton', 'khong', { tu_ngay: '2026-10-01', den_ngay: '2026-10-31' });
  assert.equal(result.so_ho_so_khop_bo_loc, 3);
  assert.equal(result.so_ho_so_khong_co_ngay_nen_bi_loai, 1);
  assert.equal(result.thong_ke[0].so_luong, 3);
});

test('kết hợp nhiều trạng thái và loại trừ trạng thái', () => {
  const { tools } = setup(dated);
  assert.equal(tools.search('ton', { trang_thai: ['Đã duyệt HSBT', 'KT duyệt'] }).so_ket_qua_khop, 4);
  assert.equal(tools.search('ton', { loai_tru_trang_thai: ['da_duyet_hsbt', 'kt_duyet'] }).ket_qua[0].ma, 'd4');
  assert.equal(tools.search('ton', { trang_thai: 'Đã duyệt HSBT', tu_ngay: '2026-10-01', den_ngay: '2026-10-31' }).so_ket_qua_khop, 2);
});

test('thống kê theo tháng và cộng tổng tiền (đọc "12.500.000 đ")', () => {
  const { tools } = setup(dated);
  const result = tools.stats('ton', 'thang', { tu_ngay: '2026-09-01', den_ngay: '2026-10-31', tinh_tong: 'soTienDuyetBT' });
  assert.deepEqual(plain(result.thong_ke.map(row => [row.gia_tri, row.so_luong, row.tong_tien])), [['09/2026', 1, 1000000], ['10/2026', 3, 20000000]]);
  assert.equal(result.tong_tien, 21000000);
});

test('ngày không hợp lệ bị bỏ qua, không ném lỗi', () => {
  const { tools } = setup(dated);
  assert.equal(tools.dayNumber('abc'), 0);
  assert.equal(tools.dayNumber('31/02/2026') > 0, true);
  assert.equal(tools.dayNumber('1970-01-01'), 0);
  assert.equal(tools.search('ton', { tu_ngay: 'xxx' }).so_ket_qua_khop, 5);
});

test('loại trừ "KT duyệt" không loại nhầm "Chờ KT duyệt"', () => {
  const { tools } = setup({ ...dated, d6: { bienSo: 'A6', trangThai: 'cho_kt_duyet' } });
  const result = tools.search('ton', { loai_tru_trang_thai: ['Đã duyệt HSBT', 'KT duyệt'] });
  assert.deepEqual(plain(result.ket_qua.map(row => row.ma).sort()), ['d4', 'd6']);
});

test('gom hồ sơ theo xe: tìm theo tên hoặc biển số, xe nhiều vụ có nhiều hồ sơ', () => {
  const { tools } = setup({
    c1: { bienSo: '47H-114.50', khachHang: 'TRẦN VĂN HIỆP', maVuTonThat: 'V1', ngayTonThat: '01/03/2026' },
    c2: { bienSo: '47H11450', khachHang: 'TRẦN VĂN HIỆP', maVuTonThat: 'V2', ngayTonThat: '15/09/2026', diaDiemTonThat: 'QL14' },
    c3: { bienSo: '51K99999', khachHang: 'LÊ THỊ MAI' }
  });
  const byOwner = tools.vehicleGroups('hiep');
  assert.equal(byOwner.total, 1);
  assert.equal(byOwner.groups[0].claims.length, 2);
  assert.deepEqual(plain(byOwner.groups[0].claims.map(claim => claim.label.vtt).sort()), ['V1', 'V2']);
  assert.equal(byOwner.groups[0].claims.find(claim => claim.label.vtt === 'V2').label.ngay, '15/09/2026');
  assert.equal(tools.vehicleGroups('51k99999').groups[0].claims.length, 1);
  assert.equal(tools.vehicleGroups('khong co').total, 0);
  assert.equal(tools.vehicleGroups('').total, 2);
});

const at = (y, m, d) => new Date(y, m - 1, d, 12).getTime();
const aging = {
  t1: { bienSo: '47H11450', khachHang: 'TRẦN VĂN HIỆP', trangThai: 'cho_gdct', gdvTiepNhan: 'Nguyễn An', updatedAt: at(2026, 10, 15) },
  t2: { bienSo: '51K99999', khachHang: 'LÊ THỊ MAI', trangThai: 'cho_duyet_hsbt', gdvTiepNhan: 'Nguyễn An', updatedAt: at(2026, 10, 1) },
  t3: { bienSo: '60A12345', khachHang: 'Phạm Bình', trangThai: 'cho_gdct', gdvTiepNhan: 'Trần Bảo', updatedAt: at(2026, 10, 27) },
  t4: { bienSo: '30A00001', khachHang: 'Cũ Đã Xong', trangThai: 'da_duyet_hsbt', gdvTiepNhan: 'Trần Bảo', updatedAt: at(2026, 1, 1) },
  t5: { bienSo: '29A00002', khachHang: 'Không Ngày', trangThai: 'cho_gdct', gdvTiepNhan: 'Trần Bảo' },
  t6: { bienSo: '28A00003', khachHang: 'Chưa Phân', trangThai: 'moi', updatedAt: at(2026, 10, 10) }
};
const NOW = '2026-10-29';

test('lọc tồn đọng: tồn LỚN HƠN N ngày tính từ lần cập nhật, hồ sơ thiếu ngày bị loại và được báo', () => {
  const { tools } = setup(aging);
  const result = plain(tools.search('ton', { ton_tren_ngay: 7, hom_nay: NOW }));
  assert.deepEqual(result.ket_qua.map(row => row.ma).sort(), ['t1', 't2', 't4', 't6']);
  assert.equal(result.ket_qua.find(row => row.ma === 't1').so_ngay_ton, 14);
  assert.equal(result.so_ho_so_khong_co_ngay_nen_bi_loai, 1);
  assert.equal(result.tinh_so_ngay_ton_tu, 'cap_nhat');
  assert.equal(plain(tools.search('ton', { ton_tren_ngay: 14, hom_nay: NOW })).ket_qua.some(row => row.ma === 't1'), false, 'đúng 14 ngày thì chưa "quá" 14 ngày');
});

test('báo cáo tồn đọng loại hồ sơ đã xong, gom theo GĐV, sắp theo số lượng rồi độ trễ', () => {
  const { tools } = setup(aging);
  const report = plain(tools.overdueReport({ ton_tren_ngay: 7, hom_nay: NOW }));
  assert.equal(report.count, 3);
  assert.equal(report.noDate, 1);
  assert.deepEqual(report.groups.map(group => [group.gdv, group.count, group.oldest]), [['Nguyễn An', 2, 28], ['(chưa phân công)', 1, 19]]);
  assert.deepEqual(report.groups[0].claims.map(row => row.ma), ['t2', 't1']);
  const only = plain(tools.overdueReport({ ton_tren_ngay: 7, hom_nay: NOW, trang_thai: ['Chờ GĐCT'] }));
  assert.equal(only.count, 1);
  assert.equal(only.groups[0].claims[0].ma, 't1');
  const table = plain(tools.overdueTable(report));
  assert.equal(table.rows.length, 3);
  assert.equal(table.rows[0][0], 'Nguyễn An');
  assert.equal(table.rows[0].at(-1), 28);
});

test('công cụ ton_dong trả bản rút gọn cho AI và bảng đầy đủ cho nút xuất', async () => {
  const { tools } = setup(aging);
  const tables = [];
  const out = plain(await tools.run('ton_dong', { ton_tren_ngay: 7, hom_nay: NOW }, { onTable: table => tables.push(table) }));
  assert.equal(out.so_ho_so_ton, 3);
  assert.equal(out.theo_gdv[0].gdv, 'Nguyễn An');
  assert.equal(tables.length, 1);
  assert.equal(plain(tables[0]).rows.length, 3);
  const stats = [];
  await tools.run('thong_ke', { loai: 'ton', nhom_theo: 'gdv' }, { onTable: table => stats.push(table) });
  assert.deepEqual(plain(stats[0]).head, ['GĐV', 'Số lượng']);
  const found = [];
  await tools.run('tim_ho_so', { loai: 'ton', gioi_han: 1 }, { onTable: table => found.push(table) });
  assert.equal(plain(found[0]).rows.length, Object.keys(aging).length, 'bảng xuất đủ hồ sơ dù AI chỉ xem 1 dòng');
});

test('lịch sử chat dựng lại cho Gemini: bắt đầu bằng người dùng và xen kẽ lượt', () => {
  const { hist } = setup({});
  const out = plain(hist([{ r: 'a', x: 'chào' }, { r: 'u', x: 'a' }, { r: 'u', x: 'b' }, { r: 'a', x: 'c' }]));
  assert.deepEqual(out.map(item => item.role), ['user', 'model']);
  assert.equal(out[0].parts[0].text, 'a\nb');
});

test('tìm xe theo biển số gõ có dấu gạch/chấm/cách', () => {
  const { tools } = setup({ a: { bienSo: '47H11450', khachHang: 'A' }, b: { bienSo: '51K99999', khachHang: 'B' } });
  for (const query of ['47H-114.50', '47h 11450', '47H-11450']) assert.equal(tools.vehicleGroups(query).groups[0]?.plate, '47H11450', query);
  assert.equal(tools.vehicleGroups('47H-999').total, 0);
});
