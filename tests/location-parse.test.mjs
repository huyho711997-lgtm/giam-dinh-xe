import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../js/features/reimbursements/location-parse.js', import.meta.url), 'utf8');
const P = vm.runInContext(src + '\n;FieldLocationParse', vm.createContext({}));
const near = (r, lat, lon) => { assert.ok(r && r.point, JSON.stringify(r)); assert.ok(Math.abs(r.point.lat - lat) < 1e-6 && Math.abs(r.point.lon - lon) < 1e-6, JSON.stringify(r.point)); };

test('link Google Maps các dạng', () => {
  near(P.parse('https://maps.google.com/?q=12.686955,108.054487'), 12.686955, 108.054487);
  near(P.parse('https://www.google.com/maps?q=12.686955%2C108.054487&z=17'), 12.686955, 108.054487);
  near(P.parse('https://www.google.com/maps/search/?api=1&query=12.686955,108.054487'), 12.686955, 108.054487);
  near(P.parse('https://www.google.com/maps/place/Buon+Ma+Thuot/@12.686955,108.054487,15z/data=!3m1!4b1'), 12.686955, 108.054487);
  near(P.parse('https://www.google.com/maps/place/12.686955,108.054487'), 12.686955, 108.054487);
  near(P.parse('https://www.google.com/maps/dir/?api=1&destination=12.686955,108.054487'), 12.686955, 108.054487);
  near(P.parse('https://www.google.com/maps/place/x/data=!3d12.686955!4d108.054487'), 12.686955, 108.054487);
});
test('tin nhắn Zalo có chữ kèm link; link khác (OSM, geo:)', () => {
  near(P.parse('Vị trí của tôi: https://maps.google.com/?q=12.686955,108.054487 anh ra giúp em'), 12.686955, 108.054487);
  near(P.parse('https://www.openstreetmap.org/?mlat=12.686955&mlon=108.054487#map=17/12.686955/108.054487'), 12.686955, 108.054487);
  near(P.parse('geo:12.686955,108.054487'), 12.686955, 108.054487);
});
test('toạ độ trần và độ-phút-giây', () => {
  near(P.parse('12.686955587559002, 108.0544871267908'), 12.686955587559002, 108.0544871267908);
  near(P.parse('12.686955 108.054487'), 12.686955, 108.054487);
  near(P.parse('12°41\'10.3"N 108°03\'16.2"E'), 12 + 41 / 60 + 10.3 / 3600, 108 + 3 / 60 + 16.2 / 3600);
  near(P.parse('Em đang ở 12.7001, 108.0602 nhé'), 12.7001, 108.0602);
});
test('link rút gọn được nhận diện; chữ thường không bị nhầm thành vị trí', () => {
  assert.equal(P.parse('https://maps.app.goo.gl/AbCdEf123').shortLink, true);
  assert.equal(P.parse('193/22 nguyễn văn cừ'), null);
  assert.equal(P.parse('Biển 47A-123.45'), null);
  assert.equal(P.parse('Giá 120, 500 nghìn'), null);
  assert.equal(P.parse(''), null);
  assert.equal(P.parse('0,0'), null);
});
