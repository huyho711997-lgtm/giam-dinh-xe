import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL('../js/features/' + name, import.meta.url), 'utf8');
function setup(pending, cases = {}) {
  const context = vm.createContext({
    console, JSON, Map, Set, Array, Object, Number, String, Math, Promise, Error,
    cachedPendingClaimsPayload: pending, cachedCasesPayload: cases,
    PENDING_STATUS_MAP: { moi: { label: 'Mới' }, cho_gdct: { label: 'Chờ GĐCT' } },
    document: { readyState: 'complete', addEventListener() {}, querySelectorAll: () => [], getElementById: () => null, documentElement: { classList: { toggle() {} } } },
    localStorage: { getItem: () => null }, MutationObserver: class { observe() {} }, window: {}
  });
  vm.runInContext(read('documents/shared-forms-ai.js') + '\n;this.forms = SharedFormsAI;', context);
  vm.runInContext(read('ai/assistant-tools.js') + '\n;this.tools = TascoAITools;', context);
  vm.runInContext(read('ai/assistant.js') + '\n;this.fmt = formatTascoAIText;', context);
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
