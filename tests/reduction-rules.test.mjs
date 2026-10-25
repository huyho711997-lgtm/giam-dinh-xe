import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(read('js/data/insurance-reduction-rules.js') + '\n' + read('js/features/claims/reduction-rules.js') + '\nthis.rules=ClaimReductionRules;', context);
const {rules} = context;
const evaluate = state => rules.evaluate(state);

test('a single fixed violation applies 10%', () => {
  const result = evaluate({items:[{id:'rescue'}]});
  assert.equal(result.applied.rate, 10);
  assert.equal(result.applied.item.id, 'rescue');
});

test('several violations apply only the highest rate (khoản 2.1), never the sum', () => {
  const result = evaluate({items:[{id:'rescue'},{id:'moved',rate:30},{id:'late-notice'}]});
  assert.equal(result.applied.rate, 30);
  assert.equal(result.applied.item.id, 'moved');
});

test('range rates are clamped to the band allowed by the rule', () => {
  assert.equal(evaluate({items:[{id:'moved',rate:80}]}).applied.rate, 50);
  assert.equal(evaluate({items:[{id:'moved',rate:5}]}).applied.rate, 20);
  assert.equal(evaluate({items:[{id:'moved'}]}).applied.rate, 20, 'defaults to the minimum of the band');
  assert.equal(evaluate({items:[{id:'dishonest',rate:100}]}).applied.rate, 100);
});

test('speeding: within 20–50% is a reduction, ≤20% is below threshold, >50% is an exclusion', () => {
  const ok = evaluate({items:[{id:'speed',actual:'66',limit:'50',rate:40}]});
  assert.equal(ok.rows[0].over, 32); assert.equal(ok.applied.rate, 40);
  const below = evaluate({items:[{id:'speed',actual:'60',limit:'50'}]});
  assert.equal(below.rows[0].status, 'below'); assert.equal(below.applied, null);
  const excluded = evaluate({items:[{id:'speed',actual:'80',limit:'50'}]});
  assert.equal(excluded.rows[0].status, 'excluded'); assert.equal(excluded.applied, null);
  assert.match(excluded.excluded[0].message, /mục 10 Điều 10/);
});

test('overload reduces by exactly the overload percentage and excludes above 50%', () => {
  const result = evaluate({items:[{id:'overload',actual:'13.5',limit:'10'}]});
  assert.equal(result.applied.rate, 35);
  const excluded = evaluate({items:[{id:'overload',actual:'16',limit:'10'}]});
  assert.equal(excluded.rows[0].status, 'excluded');
  assert.match(excluded.excluded[0].message, /mục 9 Điều 10/);
});

test('an exclusion (Điều 10) overrides every reduction: the claim is refused, nothing is deducted', () => {
  const result = evaluate({items:[{id:'speed',actual:'90',limit:'50'},{id:'rescue'}],base:'10000000'});
  assert.equal(result.refused, true); assert.equal(result.applied, null);
  assert.equal(result.candidate.rate, 10, 'the would-be reduction is still reported for context');
  assert.equal(result.deduction, 0); assert.equal(result.remain, 0);
  const text = rules.texts({items:[{id:'speed',actual:'90',limit:'50'},{id:'overload',actual:'17',limit:'10'},{id:'rescue'}]});
  assert.match(text.impact, /từ chối bồi thường/);
  assert.match(text.basis, /^Căn cứ mục 9, mục 10 Điều 10/);
});

test('money: deduction and remaining amount are computed from the base', () => {
  const result = evaluate({items:[{id:'moved',rate:30}], base:'15.000.000'});
  assert.equal(result.base, 15000000); assert.equal(result.deduction, 4500000); assert.equal(result.remain, 10500000);
});

test('generated basis cites point, clause and article; scope switches Điều 14 ↔ Điều 24', () => {
  const vcx = rules.texts({items:[{id:'moved',rate:30},{id:'rescue'}]});
  assert.match(vcx.basis, /^Căn cứ điểm a khoản 1\.1, điểm a khoản 1\.2 mục 1 Điều 14 và khoản 2\.1/);
  assert.equal((vcx.basis.match(/Điều 14/g) || []).length, 2, 'article named once for the points and once for khoản 2.1');
  assert.match(vcx.basis, /khoản 2\.1 mục 2 Điều 14/);
  assert.match(vcx.basis, /08\/2025\/QĐ-BH Tasco/);
  assert.match(vcx.impact, /^Giảm trừ 30%/);
  const hh = rules.texts({scope:'hh',items:[{id:'overload',actual:'12.5',limit:'10'}]});
  assert.match(hh.basis, /khoản 1\.4 mục 1 Điều 24/);
  assert.doesNotMatch(hh.basis, /khoản 2\.1/, 'single violation does not cite the highest-rate rule');
});

test('impact reports refusal when only excluded violations are selected', () => {
  assert.match(rules.texts({items:[{id:'overload',actual:'20',limit:'10'}]}).impact, /từ chối bồi thường/);
});

test('saved state is sanitized: unknown or duplicate items and junk numbers are dropped', () => {
  const state = rules.normalize({scope:'x',items:[{id:'nope'},{id:'moved',rate:'abc'},{id:'moved',rate:40}],base:'1.2a3'});
  assert.equal(state.scope, 'vcx');
  assert.deepEqual(JSON.parse(JSON.stringify(state.items)), [{id:'moved',rate:null,actual:'',limit:''}]);
  assert.equal(state.base, '123');
});

test('custom case outside the rule list: counted with its own rate, cited as outside the list', () => {
  const result = evaluate({items:[{id:'rescue'}],custom:{on:true,title:'Không cung cấp bản gốc hóa đơn sửa chữa theo thỏa thuận HĐ',rate:15}});
  assert.equal(result.applied.rate, 15); assert.equal(result.applied.custom, true);
  const text = rules.texts({items:[{id:'rescue'}],custom:{on:true,title:'Vi phạm thỏa thuận riêng',rate:15}});
  assert.match(text.reason, /Vi phạm thỏa thuận riêng \(ngoài danh mục quy tắc\) → 15%/);
  assert.match(text.basis, /điểm a khoản 1\.1 mục 1 Điều 14 và khoản 2\.1/);
  assert.match(text.basis, /Trường hợp ngoài danh mục/);
  const noRate = evaluate({custom:{on:true,title:'Chỉ ghi nhận'}});
  assert.equal(noRate.rows[0].status, 'norate'); assert.equal(noRate.applied, null);
  assert.equal(evaluate({custom:{on:true,title:'   '}}).rows.length, 0, 'empty description is ignored');
});

// ---- Thông báo: chuyển hồ sơ mẫu cũ (tự gõ Lý do / Mức / Căn cứ) sang mẫu mới ----
const notice = (() => {
  const ctx = vm.createContext({document:{getElementById:()=>null,querySelector:()=>null},firebase:{auth:()=>({currentUser:null})},SharedFormsControls:{enhance(){}}});
  vm.runInContext(read('js/data/insurance-reduction-rules.js') + '\n' + read('js/features/claims/reduction-rules.js') + '\n' + read('js/features/claims/reduction-notice.js') + '\nthis.notice=ClaimReductionNotice;this.rules=ClaimReductionRules;', ctx);
  return ctx;
})();

test('legacy notice with a % becomes a custom case and keeps its basis as evidence', () => {
  notice.notice.load({reason:'Tự ý sửa xe',impact:'30%',basis:'Biên bản ngày 10/10',stage:'Dự kiến áp dụng'});
  const state = notice.notice.getState();
  assert.equal(state.stage, 'Dự kiến áp dụng');
  assert.equal(state.rule.custom.on, true); assert.equal(state.rule.custom.title, 'Tự ý sửa xe'); assert.equal(state.rule.custom.rate, 30);
  assert.equal(state.evidence, 'Biên bản ngày 10/10');
  assert.match(state.impact, /^Giảm trừ 30%/);
});

test('legacy notice with a money amount keeps it in the facts note instead of guessing a rate', () => {
  notice.notice.load({reason:'Không thông báo kịp thời',impact:'5.000.000 đ'});
  const state = notice.notice.getState();
  assert.equal(state.rule.custom.rate, null);
  assert.match(state.notes, /5\.000\.000 đ/);
});

test('new-format notices are not migrated again', () => {
  notice.notice.load({notes:'Ghi nhận',evidence:'Ảnh',rule:{items:[{id:'moved',rate:40}]},reason:'cũ',impact:'cũ',basis:'cũ'});
  const state = notice.notice.getState();
  assert.equal(state.notes, 'Ghi nhận'); assert.equal(state.rule.custom.on, false);
  assert.match(state.impact, /^Giảm trừ 40%/, 'derived fields are regenerated from the rule, not copied from the old text');
});

test('scene violations: "tự ý di dời" and "không có hiện trường" share điểm a khoản 1.2 and cite the Điều 5 duty once', () => {
  const both = rules.texts({items:[{id:'no-scene',rate:40},{id:'moved',rate:30}]});
  assert.equal((both.basis.match(/điểm a khoản 1\.2/g) || []).length, 1, 'same clause is cited once');
  assert.match(both.basis, /Nghĩa vụ bị vi phạm: điểm b khoản 2\.7 mục 2 Điều 5\./);
  assert.equal(rules.evaluate({items:[{id:'no-scene',rate:40},{id:'moved',rate:30}]}).applied.rate, 40);
  const mixed = rules.texts({items:[{id:'dishonest',rate:60},{id:'rescue'},{id:'disclosure'}]});
  assert.match(mixed.basis, /Nghĩa vụ bị vi phạm: khoản 2\.3, khoản 2\.5, điểm a khoản 2\.7, điểm b khoản 2\.7, khoản 2\.8 mục 2 Điều 5\./, 'duties sorted numerically');
  assert.doesNotMatch(rules.texts({items:[{id:'speed',actual:'90',limit:'50'}]}).basis, /Nghĩa vụ/, 'refusals cite Điều 10 only');
});

test('trạng thái xử lý mặc định là "Dự kiến áp dụng"; trạng thái đã lưu được giữ nguyên', () => {
  notice.notice.load({});
  assert.equal(notice.notice.getState().stage, 'Dự kiến áp dụng', 'hồ sơ chưa có thông báo giảm trừ');
  notice.notice.load({stage:'Không hợp lệ'});
  assert.equal(notice.notice.getState().stage, 'Dự kiến áp dụng', 'giá trị lạ quay về mặc định');
  notice.notice.load({stage:'Đang xem xét'});
  assert.equal(notice.notice.getState().stage, 'Đang xem xét', 'hồ sơ đã lưu "Đang xem xét" không bị đổi');
  notice.notice.load({stage:'Đã phê duyệt'});
  assert.equal(notice.notice.getState().stage, 'Đã phê duyệt');
});

test('danh bạ email: khóa bỏ dấu theo tên, gộp địa chỉ không trùng (không phân biệt hoa/thường)', () => {
  const {slug, mergeAddresses} = notice.notice.directory;
  assert.equal(slug('Chi nhánh Đắk Lắk'), 'chi-nhanh-dak-lak');
  assert.equal(slug('  Bùi Thị Thanh Thảo '), 'bui-thi-thanh-thao');
  assert.equal(slug('Phòng KD số 2 / TTKD.1'), 'phong-kd-so-2-ttkd-1', 'không chứa ký tự cấm trong khóa Firebase (. / # $ [ ])');
  assert.equal(slug(''), '');
  assert.equal(mergeAddresses('a@x.vn; B@x.vn', 'b@X.vn, c@x.vn', '', null), 'a@x.vn; B@x.vn; c@x.vn');
  assert.equal(mergeAddresses('', ''), '');
});
