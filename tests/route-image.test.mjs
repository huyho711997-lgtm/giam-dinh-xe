import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../js/features/reimbursements/route-image.js', import.meta.url), 'utf8');
const R = vm.runInContext(src + '\n;FieldRouteImage', vm.createContext({}));

test('project: gốc toạ độ ở giữa bản đồ thế giới, mỗi mức zoom nhân đôi', () => {
  const p0 = R.project(0, 0, 0);
  assert.ok(Math.abs(p0.x - 128) < 1e-6 && Math.abs(p0.y - 128) < 1e-6);
  const p1 = R.project(12.6667, 108.0383, 10), p2 = R.project(12.6667, 108.0383, 11);
  assert.ok(Math.abs(p2.x - p1.x * 2) < 1e-6 && Math.abs(p2.y - p1.y * 2) < 1e-6);
  assert.ok(Number.isFinite(R.project(90, 0, 5).y));          // cực không làm hỏng phép chiếu
});
test('fit: mọi điểm nằm gọn trong khung, chừa lề; điểm càng xa zoom càng nhỏ', () => {
  const a = {lat: 12.6667, lon: 108.0383}, near = {lat: 12.70, lon: 108.06}, far = {lat: 13.9, lon: 108.9};
  for (const b of [near, far]) {
    const v = R.fit([a, b], 1200, 760, {pad: 90});
    for (const point of [a, b]) {
      const at = R.toPixel(v, point.lat, point.lon);
      assert.ok(at.x >= 89 && at.x <= 1200 - 89 && at.y >= 89 && at.y <= 760 - 89, JSON.stringify(at));
    }
  }
  assert.ok(R.fit([a, near], 1200, 760).zoom > R.fit([a, far], 1200, 760).zoom);
  assert.equal(R.fit([a, a], 1200, 760).zoom, 17);              // trùng điểm → zoom tối đa
  assert.equal(R.fit([], 1200, 760), null);
  assert.equal(R.fit([{lat: NaN, lon: 1}], 1200, 760), null);
});
test('tiles: phủ kín khung nhìn, toạ độ ô hợp lệ, không trùng', () => {
  const v = R.fit([{lat: 12.6667, lon: 108.0383}, {lat: 12.80, lon: 108.2}], 1200, 760);
  const list = R.tiles(v), n = 2 ** v.zoom;
  assert.ok(list.length >= 6 && list.length < 60);
  assert.equal(new Set(list.map(t => t.x + '/' + t.y)).size, list.length);
  for (const t of list) {
    assert.ok(t.x >= 0 && t.x < n && t.y >= 0 && t.y < n);
    assert.match(t.url, new RegExp('^https://server\\.arcgisonline\\.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/' + v.zoom + '/' + t.y + '/' + t.x + '$'));
    assert.ok(t.dx > -256 && t.dx < 1200 && t.dy > -256 && t.dy < 760);
  }
  const xs = list.map(t => t.dx), ys = list.map(t => t.dy);
  assert.ok(Math.min(...xs) <= 0 && Math.max(...xs) + 256 >= 1200 && Math.min(...ys) <= 0 && Math.max(...ys) + 256 >= 760);
});
test('midpoint: nằm giữa chiều dài đường, không giữa số điểm', () => {
  const m = R.midpoint([{x: 0, y: 0}, {x: 10, y: 0}, {x: 100, y: 0}]);   // dài 100 → giữa là x=50
  assert.ok(Math.abs(m.x - 50) < 1e-9 && m.y === 0);
  assert.deepEqual({...R.midpoint([{x: 3, y: 4}])}, {x: 3, y: 4});
});
