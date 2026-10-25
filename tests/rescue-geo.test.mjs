import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/rescue/rescue-geo.js', import.meta.url), 'utf8');
const Geo = vm.runInContext(source + '\n;RescueGeo', vm.createContext({URLSearchParams, AbortController, setTimeout, clearTimeout, Promise}));
const HN = {lat: 21.0285, lon: 105.8542}, HCM = {lat: 10.8231, lon: 106.6297};

test('haversine: Hà Nội – TP.HCM khoảng 1.137 km, cùng điểm = 0', () => {
  const d = Geo.haversine(HN, HCM);
  assert.ok(d > 1125 && d < 1150, String(d));
  assert.equal(Geo.haversine(HN, HN), 0);
});

test('toạ độ: nhận "vĩ độ, kinh độ", từ chối giá trị ngoài phạm vi và chữ', () => {
  assert.deepEqual({...Geo.parseCoord('12.6667, 108.0383')}, {lat: 12.6667, lon: 108.0383});
  assert.deepEqual({...Geo.parseCoord('12.6667;108.0383')}, {lat: 12.6667, lon: 108.0383});
  assert.equal(Geo.parseCoord('95, 108'), null);
  assert.equal(Geo.parseCoord('Buôn Ma Thuột'), null);
  assert.equal(Geo.validCoord(NaN, 1), false);
  assert.equal(Geo.validCoord(91, 0), false);
});

test('chuẩn hóa gara: cắt độ dài, bắt buộc tên + toạ độ hợp lệ, nhận dấu phẩy thập phân', () => {
  const g = Geo.sanitizeGarage({name: '  Gara A  ', lat: '12,6667', lon: '108.0383', address: 'x'.repeat(500), active: false}, 'abc');
  assert.equal(g.id, 'abc'); assert.equal(g.name, 'Gara A'); assert.equal(g.lat, 12.6667);
  assert.equal(g.address.length, 200); assert.equal(g.active, false);
  assert.equal(Geo.sanitizeGarage({name: '', lat: 1, lon: 1}), null);
  assert.equal(Geo.sanitizeGarage({name: 'A', lat: 'x', lon: 1}), null);
  assert.equal(Geo.sanitizeGarage(null), null);
  assert.equal(Geo.normalize('Đắk Lắk – Buôn Ma Thuột'), 'dak lak – buon ma thuot');
});

test('xếp hạng gara: bỏ gara tạm ngưng / toạ độ hỏng, gần → xa', () => {
  const garages = [
    {id: 'far', name: 'Xa', lat: 10.8, lon: 106.6, active: true},
    {id: 'near', name: 'Gần', lat: 21.03, lon: 105.85, active: true},
    {id: 'off', name: 'Ngưng', lat: 21.0285, lon: 105.8542, active: false},
    {id: 'bad', name: 'Hỏng', lat: 999, lon: 0, active: true}
  ];
  const ranked = Geo.rank(HN, garages);
  assert.deepEqual(ranked.map(item => item.garage.id), ['near', 'far']);
  assert.ok(Math.abs(ranked[0].estimate - ranked[0].straight * Geo.STRAIGHT_FACTOR) < 1e-9);
  assert.deepEqual(Geo.rank(HN, []), []);
});

const jsonResponse = (data, ok = true, status = 200) => ({ok, status, json: async () => data});
const osrm = km => jsonResponse({code: 'Ok', routes: [{distance: km * 1000, duration: km * 60, geometry: {coordinates: [[106, 11], [106.1, 11.1]]}}]});

test('lộ trình: dùng OSRM (đổi lon,lat → lat,lon); lỗi mạng / mã lỗi → ước tính chim bay × 1,3', async () => {
  const urls = [];
  const ok = Geo.createClient({fetch: async url => { urls.push(url); return osrm(12.5); }});
  const route = await ok.route(HN, HCM);
  assert.equal(route.km, 12.5); assert.equal(route.estimated, false); assert.deepEqual([...route.coords[0]], [11, 106]);
  assert.match(urls[0], /105\.854200,21\.028500;106\.629700,10\.823100/);
  const down = Geo.createClient({fetch: async () => { throw new Error('offline'); }});
  const fallback = await down.route(HN, HCM);
  assert.equal(fallback.estimated, true);
  assert.ok(Math.abs(fallback.km - Geo.haversine(HN, HCM) * 1.3) < 1e-9);
  const noRoute = Geo.createClient({fetch: async () => jsonResponse({code: 'NoRoute', routes: []})});
  assert.equal((await noRoute.route(HN, HCM)).estimated, true);
  const http = Geo.createClient({fetch: async () => jsonResponse({}, false, 503)});
  assert.equal((await http.route(HN, HCM)).estimated, true);
});

test('gara gần nhất theo đường bộ: có thể khác thứ tự chim bay', async () => {
  const from = {lat: 12.67, lon: 108.04};
  const garages = [
    {id: 'a', name: 'A', lat: 12.68, lon: 108.04, active: true},  // gần nhất chim bay nhưng đường vòng xa
    {id: 'b', name: 'B', lat: 12.70, lon: 108.04, active: true},
    {id: 'c', name: 'C', lat: 12.90, lon: 108.04, active: true}
  ];
  const road = {a: 30, b: 6, c: 40}, asked = [];
  const client = Geo.createClient({fetch: async url => {
    const m = url.match(/;(-?[\d.]+),(-?[\d.]+)\?/), lat = Number(m[2]);
    const id = lat < 12.69 ? 'a' : lat < 12.8 ? 'b' : 'c'; asked.push(id);
    return osrm(road[id]);
  }});
  const result = await client.nearest(from, garages);
  assert.equal(result.garage.id, 'b');
  assert.equal(result.route.km, 6);
  assert.equal(result.checked, 3);
  assert.equal(await client.nearest(from, []), null);
  assert.equal(await client.nearest(from, [{id: 'x', name: 'X', lat: 1, lon: 1, active: false}]), null);
  assert.equal((await client.nearest(from, garages, 1)).garage.id, 'a', 'chỉ đo 1 ứng viên → lấy gara gần nhất chim bay');
});

test('tìm địa chỉ: toạ độ gõ trực tiếp, kết quả Nominatim, không thấy, lỗi mạng, giãn cách 1,1 giây', async () => {
  let clock = 1000; const sleeps = [];
  const client = Geo.createClient({
    now: () => clock, sleep: async ms => { sleeps.push(ms); clock += ms; },
    fetch: async url => url.includes('q=lost')
      ? jsonResponse([])
      : url.includes('q=boom') ? (() => { throw new Error('x'); })()
      : jsonResponse([{lat: '12.67', lon: '108.04', display_name: 'Buôn Ma Thuột'}, {lat: 'x', lon: '1', display_name: 'hỏng'}])
  });
  assert.equal((await client.geocode('ab')).note, 'Nhập ít nhất 3 ký tự.');
  assert.equal((await client.geocode('12.67, 108.04')).point.lat, 12.67);
  assert.match((await client.geocode('95, 108')).note || 'Toạ độ không hợp lệ', /không hợp lệ|Nhập/);
  const found = await client.geocode('Buon Ma Thuot');
  assert.equal(found.items.length, 1); assert.equal(found.items[0].label, 'Buôn Ma Thuột');
  assert.match((await client.geocode('lost')).note, /Không tìm thấy/);
  assert.match((await client.geocode('boom')).note, /Không tìm được/);
  assert.ok(sleeps.length >= 1 && sleeps.every(ms => ms > 0 && ms <= 1100), 'các yêu cầu Nominatim liên tiếp phải giãn cách');
});

test('định dạng km và thời gian', () => {
  assert.equal(Geo.fmtKm(12.345), '12,35');
  assert.equal(Geo.fmtDuration(0.5), '<1 phút');
  assert.equal(Geo.fmtDuration(45), '45 phút');
  assert.equal(Geo.fmtDuration(125), '2 giờ 05 phút');
});
