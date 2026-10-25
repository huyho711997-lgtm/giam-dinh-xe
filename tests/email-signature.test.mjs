import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/admin/email-signature.js', import.meta.url), 'utf8');
const context = vm.createContext({URL, document: {getElementById: () => null}});
const Sig = vm.runInContext(source + '\n;EmailSignature', context);
const profile = {displayName: 'Hồ Quang Huy', email: 'huy@x.vn', phone: '0917 828 538'};

test('chưa cài chân email: chỉ ký tên như trước', () => {
  assert.equal(Sig.text(Sig.resolve(profile)), 'Hồ Quang Huy');
  assert.equal(Sig.text(Sig.resolve({})), '');
});

test('chân email đầy đủ: tên, chức danh, T/E/W theo mẫu', () => {
  const sig = Sig.normalize({name: 'Hồ Quang Huy (Mr)', title: 'Trưởng Zone giám định địa bàn Đắk Lắk', phone: '+(84) 0917 828 538', email: 'Huy.hq@baohiemtasco.vn', website: 'https://www.tascoinsurance.com.vn/'}, profile);
  assert.equal(Sig.text(sig), 'Hồ Quang Huy (Mr)\nTrưởng Zone giám định địa bàn Đắk Lắk\n\nT: +(84) 0917 828 538\nE: Huy.hq@baohiemtasco.vn\nW: www.tascoinsurance.com.vn');
});

test('trường bị bỏ trống thì mặc định lấy từ hồ sơ; trường đã lưu rỗng thì giữ rỗng', () => {
  assert.equal(Sig.normalize(null, profile).email, 'huy@x.vn');
  assert.equal(Sig.normalize({name: 'A', email: ''}, profile).email, '', 'đã chủ động xoá thì không tự điền lại');
  assert.equal(Sig.normalize({}, profile).website, 'www.tascoinsurance.com.vn');
});

test('banner chỉ nhận https; HTML được escape', () => {
  assert.equal(Sig.safeUrl('javascript:alert(1)'), '');
  assert.equal(Sig.safeUrl('http://a.vn/x.png'), '');
  assert.equal(Sig.safeUrl('data:image/png;base64,AAA'), '');
  assert.equal(Sig.safeUrl('https://cdn.tasco.vn/b.png'), 'https://cdn.tasco.vn/b.png');
  assert.equal(Sig.normalize({banner: 'http://a.vn/x.png'}, profile).banner, '');
  const html = Sig.html(Sig.normalize({name: '<img src=x onerror=1>', banner: 'https://cdn.tasco.vn/b.png'}, profile));
  assert.ok(!html.includes('<img src=x'), 'tên bị escape');
  assert.match(html, /<img src="https:\/\/cdn\.tasco\.vn\/b\.png"/);
});
