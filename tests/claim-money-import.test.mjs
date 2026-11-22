import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('nhập Excel làm tròn ô tiền dạng số, không làm thay đổi chuỗi được định dạng', () => {
  const context = vm.createContext({
    console, cachedPendingClaimsPayload:{}, parsedExcelBatchRows:[], excelImportFileName:'mẫu.xlsx',
    PENDING_STATUS_MAP:{}, ClaimImportUI:{renderPreview(){}}, document:{getElementById:() => ({})}
  });
  vm.runInContext(fs.readFileSync(new URL('../js/features/claims/excel-import.js', import.meta.url), 'utf8'), context);
  context.processParsedExcelData([
    ['Biển số xe','Số hồ sơ bồi thường','Dự phòng bồi thường','TTBT - Tổng số tiền bồi thường'],
    ['47A12345','HSBT-MAU-1',43049479.99999999,60191003.00000001],
    ['47A12346','HSBT-MAU-2','1.234.567','12.000.000']
  ]);
  const rows = context.parsedExcelBatchRows;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].fullRowMeta.duPhongBoiThuong, '43049480');
  assert.equal(rows[0].fullRowMeta.ttbtTongSoTienBoiThuong, '60191003');
  assert.equal(rows[1].fullRowMeta.duPhongBoiThuong, '1.234.567');
  assert.equal(rows[1].fullRowMeta.ttbtTongSoTienBoiThuong, '12.000.000');
});
