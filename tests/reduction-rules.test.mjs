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
