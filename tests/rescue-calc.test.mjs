import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/rescue/rescue-calc.js', import.meta.url), 'utf8');
const Rescue = vm.runInContext(source + '\n;RescueCalc', vm.createContext({}));
const calc = input => Rescue.calculate(input);

test('kéo xe: 10 km đầu trọn gói, từ km 11 tính theo km và làm tròn lên', () => {
  assert.equal(calc({service:'tow',towGroup:0,km:10}).total, 800000);
  assert.equal(calc({service:'tow',towGroup:0,km:0}).total, 800000);
  const result = calc({service:'tow',towGroup:0,km:25.3});
  assert.equal(result.extraKm, 16);
  assert.equal(result.total, 800000 + 16 * 30000);
  assert.equal(calc({service:'tow',towGroup:6,km:11}).total, 3250000 + 70000, 'chỉ vượt 0,0…1 km vẫn tính 1 km');
});

test('hệ số vùng tính trên giá cứu hộ, không cộng dồn', () => {
  const b = calc({towGroup:0,km:25.3,region:1});
  assert.equal(b.rescue, 1408000);
  assert.equal(b.regionAmount, 128000);
  assert.equal(calc({towGroup:0,km:10,region:2}).total, 920000);
  assert.equal(calc({towGroup:0,km:10,region:0}).regionAmount, 0);
});

test('phụ phí: phần trăm tính trên giá sau vùng, dolly là số tiền cố định, trần 50%', () => {
  const night = calc({towGroup:0,km:10,surcharges:{night:true}});
  assert.equal(night.surchargeTotal, 120000);
  assert.equal(night.total, 920000);
  const dolly = calc({towGroup:0,km:10,surcharges:{dolly:true}});
  assert.equal(dolly.surchargeTotal, 200000);
  const edge = calc({towGroup:0,km:10,surcharges:{night:true,highway:true}});
  assert.equal(edge.surchargeTotal, 400000);
  assert.equal(edge.capped, false, 'đúng bằng trần chưa bị cắt');
  const over = calc({towGroup:0,km:10,surcharges:{night:true,highway:true,disaster:true}});
  assert.equal(over.surchargeTotal, 400000);
  assert.equal(over.capped, true);
  assert.equal(over.total, 1200000);
  assert.ok(Rescue.warnings(over).some(text => /trần 50%/.test(text)));
});

test('cẩu xe theo vị trí × nhóm xe; trên 100 m / nhiều xe cẩu phải báo giá riêng', () => {
  const crane = calc({service:'crane',cranePos:0,craneClass:2});
  assert.equal(crane.total, 5000000);
  assert.equal(crane.lines[0].label, 'Cẩu xe · nhóm C');
  const quote = calc({service:'crane',cranePos:5,craneClass:0});
  assert.equal(quote.quote, true);
  assert.equal(quote.total, 0);
  assert.equal(Rescue.totalText(quote), 'Báo giá');
  assert.equal(quote.lines[0].amount, null);
  const both = calc({service:'both',towGroup:0,km:10,cranePos:5,craneClass:0});
  assert.equal(Rescue.totalText(both), '800.000đ + báo giá');
});

test('kéo + cẩu cộng hai hạng mục rồi mới nhân hệ số vùng', () => {
  const both = calc({service:'both',towGroup:0,km:10,cranePos:0,craneClass:0,region:1});
  assert.equal(both.base, 2500000);
  assert.equal(both.rescue, 2750000);
  assert.equal(both.lines.length, 2);
});

test('cấp phê duyệt theo ngưỡng tổng chi phí, vượt barem và tình huống đặc biệt', () => {
  const {approver} = Rescue;
  assert.equal(approver(3000000,false,false,false), 'Trưởng Zone');
  assert.equal(approver(3000001,false,false,false), 'Chuyên quản');
  assert.equal(approver(5000000,false,false,false), 'Chuyên quản');
  assert.equal(approver(5000001,false,false,false), 'TP KSVH / Giám đốc Trung tâm DVGĐBT');
  assert.equal(approver(20000000,false,false,false), 'TP KSVH / Giám đốc Trung tâm DVGĐBT');
  assert.equal(approver(20000001,false,false,false), 'Giám đốc Ban GĐBT');
  assert.equal(approver(4000000,true,false,false), 'Chuyên quản');
  assert.equal(approver(6000000,true,false,false), 'TP KSVH / Giám đốc Trung tâm DVGĐBT');
  assert.equal(approver(1000000,false,true,false), 'Giám đốc Ban GĐBT');
  assert.match(approver(0,false,false,true), /theo báo giá/);
  assert.equal(calc({towGroup:0,km:10,special:true}).approver, 'Giám đốc Ban GĐBT');
});

test('đầu vào sai: km âm / chữ / vô cực, chỉ số ngoài phạm vi → dùng mặc định, không ném lỗi', () => {
  assert.equal(calc({km:-5}).total, 800000);
  assert.equal(calc({km:'abc'}).total, 800000);
  assert.equal(calc({km:Infinity}).kmClamped, true);
  assert.equal(calc({towGroup:99}).total, 800000);
  assert.equal(calc({service:'khác',region:-1,towGroup:'x'}).total, 800000);
  assert.doesNotThrow(() => calc());
  const big = calc({towGroup:0,km:999999});
  assert.equal(big.kmClamped, true);
  assert.equal(big.extraKm, Rescue.MAX_KM - Rescue.FREE_KM);
  assert.ok(Rescue.warnings(big).some(text => /vượt/.test(text)));
});

test('bản tóm tắt văn bản có tổng, cấp duyệt và các dòng chi tiết', () => {
  const text = Rescue.summaryText(calc({towGroup:1,km:20,region:1,surcharges:{night:true}}));
  assert.match(text, /Kéo xe · 10 km đầu: 1\.300\.000đ/);
  assert.match(text, /Thêm 10 km × 35\.000đ: 350\.000đ/);
  assert.match(text, /Hệ số Vùng B \(\+10%\): \+165\.000đ/);
  assert.match(text, /TỔNG TRẦN CHI PHÍ: /);
  assert.match(text, /Cấp phê duyệt: /);
});

test('dữ liệu barem nhất quán: mỗi dòng cẩu đủ 6 nhóm xe, đơn giá tăng theo nhóm', () => {
  for (const row of Rescue.CRANE) if (row.price) {
    assert.equal(row.price.length, Rescue.CLASSES.length);
    assert.deepEqual([...row.price], [...row.price].sort((a,b) => a - b));
  }
  assert.equal(Rescue.TOW.length, 7);
  assert.ok(Rescue.TOW.every(item => item.base > 0 && item.km > 0));
});
