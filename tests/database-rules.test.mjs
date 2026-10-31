// Giả lập tối giản luật Realtime Database (cascade .write/.read, .validate trên nút ghi và con của nó)
// để kiểm tra các kịch bản tấn công chính. Không thay thế Firebase Emulator, nhưng bắt được lỗi logic trong biểu thức rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const RULES = JSON.parse(fs.readFileSync(new URL('../firebase/database.rules.json', import.meta.url), 'utf8')).rules;
String.prototype.matches = function (re) { return re.test(String(this)); };

const parts = path => String(path).split('/').filter(Boolean);
const getAt = (tree, keys) => keys.reduce((node, key) => (node && typeof node === 'object') ? node[key] : undefined, tree);
function setAt(tree, keys, value) {
  const copy = JSON.parse(JSON.stringify(tree || {}));
  if (!keys.length) return value;
  let node = copy;
  keys.slice(0, -1).forEach(key => { if (!node[key] || typeof node[key] !== 'object') node[key] = {}; node = node[key]; });
  if (value === null || value === undefined) delete node[keys.at(-1)]; else node[keys.at(-1)] = value;
  return copy;
}
class Snap {
  constructor(tree, keys) { this.tree = tree; this.keys = keys; }
  get raw() { return getAt(this.tree, this.keys); }
  child(path) { return new Snap(this.tree, [...this.keys, ...parts(path)]); }
  val() { const value = this.raw; return value === undefined ? null : value; }
  exists() { return this.raw !== undefined && this.raw !== null; }
  hasChildren(names) { const value = this.raw; return !!value && typeof value === 'object' && (!names || names.every(name => value[name] !== undefined)); }
  numChildren() { const value = this.raw; return value && typeof value === 'object' ? Object.keys(value).length : 0; }
  isString() { return typeof this.raw === 'string'; }
  isNumber() { return typeof this.raw === 'number'; }
  isBoolean() { return typeof this.raw === 'boolean'; }
}
function evaluate(expression, ctx) {
  if (typeof expression === 'boolean') return expression;
  const names = ['auth', 'root', 'data', 'newData', 'now', ...Object.keys(ctx.vars)];
  try { return !!new Function(...names, 'return (' + expression + ');')(ctx.auth, new Snap(ctx.oldRoot, []), new Snap(ctx.oldRoot, ctx.keys), new Snap(ctx.newRoot, ctx.keys), Date.now(), ...Object.values(ctx.vars)); } catch (_) { return false; }
}
// Tìm nút luật cho khoá: ưu tiên khoá tường minh, không có thì dùng khoá "$biến".
function step(rule, key, vars) {
  if (rule[key] && typeof rule[key] === 'object') return {rule: rule[key], vars};
  const wild = Object.keys(rule).find(name => name.startsWith('$'));
  return wild ? {rule: rule[wild], vars: {...vars, [wild]: key}} : null;
}
function ruleAt(keys) {
  let rule = RULES, vars = {};
  for (const key of keys) { const next = step(rule, key, vars); if (!next) return null; ({rule, vars} = next); }
  return {rule, vars};
}
function allowed(kind, auth, keys, oldRoot, newRoot) {
  let rule = RULES, vars = {};
  const check = () => rule['.' + kind] !== undefined && evaluate(rule['.' + kind], {auth, keys: here, oldRoot, newRoot, vars});
  let here = [];
  if (check()) return true;
  for (const key of keys) {
    const next = step(rule, key, vars);
    if (!next) return false;
    ({rule, vars} = next); here = [...here, key];
    if (check()) return true;
  }
  return false;
}
function validates(auth, keys, oldRoot, newRoot) {
  const found = ruleAt(keys);
  if (!found) return true;
  const walk = (rule, vars, here) => {
    if (rule['.validate'] !== undefined && getAt(newRoot, here) !== undefined && !evaluate(rule['.validate'], {auth, keys: here, oldRoot, newRoot, vars})) return false;
    const value = getAt(newRoot, here);
    if (!value || typeof value !== 'object') return true;
    return Object.keys(value).every(key => { const next = step(rule, key, vars); return !next || walk(next.rule, next.vars, [...here, key]); });
  };
  return walk(found.rule, found.vars, keys);
}
const canWrite = (auth, path, value, db) => { const keys = parts(path), next = setAt(db, keys, value); return allowed('write', auth, keys, db, next) && validates(auth, keys, db, next); };
const canRead = (auth, path, db) => allowed('read', auth, parts(path), db, db);

const profile = (role = 'Giám định viên', extra = {}) => ({profile: {displayName: 'A', role, department: 'X', ...extra}});
const DB = {
  users: {admin1: profile('Admin'), admin2: profile('Giám định viên', {permissions: {users: {admin: true}}}), gdv1: profile(), gdv2: profile()},
  pending_claims: {c1: {bienSo: '47A1'}},
  cases: {k1: {trangThai: 'Chờ'}}
};
const asUser = uid => ({uid, token: {email: uid + '@x.vn'}});

test('người dùng thường KHÔNG tự nâng mình thành quản trị viên', () => {
  const gdv = asUser('gdv1');
  assert.equal(canWrite(gdv, 'users/gdv1/profile', {...DB.users.gdv1.profile, role: 'Admin'}, DB), false, 'ghi cả hồ sơ với role Admin');
  assert.equal(canWrite(gdv, 'users/gdv1/profile', {...DB.users.gdv1.profile, role: 'admin'}, DB), false);
  assert.equal(canWrite(gdv, 'users/gdv1/profile', {...DB.users.gdv1.profile, role: ' ADMIN '}, DB), false, 'biến thể hoa/khoảng trắng');
  assert.equal(canWrite(gdv, 'users/gdv1/profile/role', 'Admin', DB), false, 'chỉ ghi trường role');
  assert.equal(canWrite(gdv, 'users/gdv1/profile/permissions/users/admin', true, DB), false, 'cấp quyền users.admin');
  assert.equal(canWrite(gdv, 'users/gdv1/profile', {...DB.users.gdv1.profile, permissions: {users: {admin: true}}}, DB), false);
  assert.equal(canWrite(gdv, 'users/gdv1/profile/isAdmin', true, DB), false);
  assert.equal(canWrite(gdv, 'users/gdv1', {profile: {...DB.users.gdv1.profile, role: 'Admin'}}, DB), false, 'ghi cả nút users/uid');
  assert.equal(canWrite(gdv, 'users', {gdv1: {profile: {role: 'Admin'}}}, DB), false, 'ghi cả nút users');
});

test('người dùng thường vẫn sửa được hồ sơ cá nhân, cài đặt và bộ lọc yêu thích của chính mình', () => {
  const gdv = asUser('gdv1');
  assert.equal(canWrite(gdv, 'users/gdv1/profile', {...DB.users.gdv1.profile, displayName: 'Tên mới', role: 'Trưởng nhóm', phone: '090'}, DB), true);
  assert.equal(canWrite(gdv, 'users/gdv1/profile/email', 'a@b.c', DB), true);
  assert.equal(canWrite(gdv, 'users/gdv1/settings/weeklyReportCols', ['a'], DB), true);
  assert.equal(canWrite(gdv, 'users/gdv1/favorite_filters/f1', {name: 'x'}, DB), true);
  assert.equal(canWrite(gdv, 'users/gdv2/profile/displayName', 'Hack', DB), false, 'không sửa hồ sơ người khác');
  assert.equal(canWrite(gdv, 'users/gdv2/settings/x', 1, DB), false);
});

test('quản trị viên quản lý người dùng; quản trị viên giữ nguyên quyền khi tự lưu hồ sơ', () => {
  const admin = asUser('admin1');
  assert.equal(canWrite(admin, 'users/gdv1/profile', {...DB.users.gdv1.profile, role: 'Admin'}, DB), true);
  assert.equal(canWrite(admin, 'users/newuid/profile', {displayName: 'Mới', role: 'Giám định viên'}, DB), true, 'tạo hồ sơ cho tài khoản mới');
  assert.equal(canWrite(admin, 'users/gdv2', null, DB), true, 'xoá người dùng');
  assert.equal(canWrite(admin, 'users/admin1/profile', {...DB.users.admin1.profile, displayName: 'Đổi tên'}, DB), true);
  assert.equal(canWrite(asUser('admin2'), 'users/gdv1/profile/role', 'Admin', DB), true, 'quản trị qua permissions.users.admin');
});

test('tài khoản chưa có hồ sơ (tự đăng ký) không tự tạo hồ sơ và không đọc/ghi dữ liệu nghiệp vụ', () => {
  const stranger = asUser('stranger');
  assert.equal(canWrite(stranger, 'users/stranger/profile', {displayName: 'x', role: 'Giám định viên'}, DB), false, 'không tự tạo hồ sơ');
  assert.equal(canWrite(stranger, 'users/stranger/profile', {displayName: 'x', role: 'Admin'}, DB), false);
  assert.equal(canRead(stranger, 'pending_claims', DB), false);
  assert.equal(canWrite(stranger, 'pending_claims/c1/bienSo', 'HACK', DB), false);
  assert.equal(canWrite(stranger, 'accounting_transfers/t1', {a: 1}, DB), false);
  assert.equal(canRead(stranger, 'users/gdv1/profile', DB), true, 'tài khoản đăng nhập đọc được hồ sơ của chính mình để tải thông tin');
});

test('người dùng có hồ sơ vẫn dùng dữ liệu nghiệp vụ bình thường', () => {
  const gdv = asUser('gdv1');
  assert.equal(canRead(gdv, 'pending_claims', DB), true);
  assert.equal(canWrite(gdv, 'pending_claims/c1/status', 'x', DB), true);
  assert.equal(canWrite(gdv, 'field_reimbursements/b1', {a: 1}, DB), true);
  assert.equal(canWrite(gdv, 'user_chats/gdv1', {updatedAt: 1, messages: []}, DB), true);
  assert.equal(canWrite(gdv, 'user_chats/gdv2', {updatedAt: 1, messages: []}, DB), false);
});

test('các nhánh chỉ dành cho quản trị viên không còn bị vượt quyền', () => {
  assert.equal(canWrite(asUser('gdv1'), 'doc_library/d1', {meta: {ten: 'x', trangThai: 'dang_hieu_luc'}, chunks: [{t: 't', x: 'x'}], createdAt: 1}, DB), false);
  assert.equal(canWrite(asUser('admin1'), 'doc_library/d1', {meta: {ten: 'x', trangThai: 'dang_hieu_luc'}, chunks: [{t: 't', x: 'x'}], createdAt: 1}, DB), true);
  assert.equal(canRead(asUser('gdv1'), 'claim_import_history', DB), false);
  assert.equal(canRead(asUser('admin1'), 'claim_import_history', DB), true);
});

test('cổng gara (chưa đăng nhập) giữ nguyên hành vi hiện có', () => {
  assert.equal(canRead(null, 'cases/k1', DB), true);
  assert.equal(canWrite(null, 'cases/k1/hinhAnh', ['a'], DB), true);
  assert.equal(canWrite(null, 'cases/k1/bienSo', 'HACK', DB), false);
  assert.equal(canWrite(null, 'pending_claims/c1/bienSo', 'HACK', DB), false);
  assert.equal(canWrite(null, 'users/gdv1/profile/role', 'Admin', DB), false);
});
