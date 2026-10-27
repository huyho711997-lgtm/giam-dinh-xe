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
