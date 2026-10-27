import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/reimbursements/editor.js', import.meta.url), 'utf8');
const match = source.match(/function calculatePersonalTravelCost[\s\S]*?\n    }\n/);
const context = vm.createContext({});
vm.runInContext(match[0] + '\nthis.calc = calculatePersonalTravelCost;', context);
const calc = context.calc;

test('personal vehicle travel cost doubles one-way km and prices by round-trip distance', () => {
  assert.equal(calc(0), 0);
  assert.equal(calc(-5), 0);
  assert.equal(calc('abc'), 0);
  assert.equal(calc(32), 256000);   // 64 km x 4.000
  assert.equal(calc(49), 392000);   // 98 km x 4.000
  assert.equal(calc(50), 300000);   // 100 km x 3.000
  assert.equal(calc(60), 360000);   // 120 km x 3.000
  assert.equal(calc(81), 486000);   // 162 km x 3.000
});

test('batch recalculation updates only personal-vehicle items above the free distance', () => {
  const calcMatch = source.match(/function planReimbursementTravelRecalc[\s\S]*?\n    }\n/);
  const ctx = vm.createContext({calculatePersonalTravelCost: calc});
  vm.runInContext(calcMatch[0] + '\nthis.plan = planReimbursementTravelRecalc;', ctx);
  const items = [
    {distanceKm:60, vehicle:'Phương tiện cá nhân', travelCost:480000, calcResult:{finalCost:600000}},
    {distanceKm:24, vehicle:'Phương tiện cá nhân', travelCost:0, calcResult:{finalCost:300000}},
    {distanceKm:38, vehicle:'Phương tiện cá nhân', travelCost:344000, calcResult:{finalCost:400000}},
    {distanceKm:50, vehicle:'Ô tô cơ quan', travelCost:0, calcResult:{finalCost:200000}},
    {distanceKm:32, vehicle:'Phương tiện cá nhân', travelCost:256000, calcResult:{finalCost:200000}}
  ];
  const result = ctx.plan(items);
  assert.equal(result.changed, 2);
  assert.deepEqual(result.nextItems.map(item => item.travelCost), [360000, 0, 304000, 0, 256000]);
  assert.equal(result.totalAmount, 600000 + 360000 + 300000 + 400000 + 304000 + 200000 + 200000 + 256000);
});
