import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/notifications/notification-center.js', import.meta.url), 'utf8');

function setup(profile, transfers, storage = {}, db) {
  const holder = { innerHTML: '' }, badge = { style: {}, textContent: '' }, label = { style: {}, textContent: '' };
  const elements = { notificationItemsHolder: holder, navNotificationBadge: badge, lblNotifUnreadCount: label };
  const context = vm.createContext({
    console, JSON, Set, Array, Object, Date, Number, String,
    localStorage: { getItem: key => storage[key] ?? null, setItem: (key, value) => { storage[key] = value; } },
    document: { getElementById: id => elements[id] || null },
    firebase: { auth: () => ({ currentUser: { uid: 'u', displayName: '' } }) },
    activeUserProfile: profile, cachedAccountingTransfersPayload: transfers, cachedCasesPayload: null,
    getLoggedInUserAccountingRole: () => profile.acc || '', formatDateDisplay: String, parseDateParts: () => null,
    escapeHtmlOutput: String, triggerToast() {}, STATUS_COMPLETED: 'done',
    ...(db ? { dbNodeInstance: db } : {})
  });
  context.plays = 0;
  context.window = { AudioContext: class {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    createOscillator() { return { frequency: {}, connect() {}, start() { context.plays++; }, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    resume() {}
  } };
  vm.runInContext(`${source}\n;this.api={renderNotificationCenterItems,markAllNotificationsAsRead,dismissAllNotifications,markNotificationSourceLoaded,toggleNotificationSound,dismissNotification,markNotificationAsRead};`, context);
  return { context, holder, badge, storage, setTransfers: value => { context.cachedAccountingTransfersPayload = value; } };
}
const gdv = { role: 'Giám định viên', displayName: 'Nguyen Van A' };
const transfer = (trangThai, extra = {}) => ({ p1: { transferId: 'PBG1', trangThai, gdvName: 'Nguyen Van A', danhSachHoSo: [{}], ...extra } });

test('"Đọc tất cả" chỉ áp dụng cho trạng thái hiện tại: yêu cầu bổ sung mới vẫn báo chưa đọc', () => {
  const env = setup(gdv, transfer('cho_xac_nhan'));
  env.context.api.markAllNotificationsAsRead();
  env.context.api.renderNotificationCenterItems();
  assert.equal(env.badge.style.display, 'none');
  env.setTransfers(transfer('can_bo_sung', { ghiChuKeToan: 'Thiếu CCCD' }));
  env.context.api.renderNotificationCenterItems();
  assert.equal(env.badge.style.display, 'grid');
  assert.equal(env.badge.textContent, 1);
});

test('"Xóa tất cả" không ẩn thông báo của trạng thái phát sinh sau đó', () => {
  const env = setup(gdv, transfer('cho_xac_nhan'));
  env.context.api.dismissAllNotifications();
  env.context.api.renderNotificationCenterItems();
  assert.match(env.holder.innerHTML, /chưa có thông báo/);
  env.setTransfers(transfer('da_xac_nhan'));
  env.context.api.renderNotificationCenterItems();
  assert.match(env.holder.innerHTML, /Đã xác nhận Phiếu PBG1/);
});

test('dữ liệu cũ (mã phiếu trần) được chuyển đổi: giữ trạng thái đã đọc/xóa hiện tại, trạng thái mới vẫn hiện', () => {
  const storage = { read_notifs_u: JSON.stringify(['PBG1']), dismissed_notifs_u: JSON.stringify(['PBG9']) };
  const env = setup(gdv, { ...transfer('cho_xac_nhan'), p9: { transferId: 'PBG9', trangThai: 'cho_xac_nhan', gdvName: 'Nguyen Van A' } }, storage);
  env.context.api.renderNotificationCenterItems();
  assert.equal(env.badge.style.display, 'none', 'phiếu đã đọc vẫn đã đọc');
  assert.doesNotMatch(env.holder.innerHTML, /PBG9/, 'phiếu đã xóa vẫn ẩn');
  assert.ok(!JSON.parse(storage.read_notifs_u).includes('PBG1'), 'mã trần đã được bỏ');
  env.setTransfers({ ...transfer('can_bo_sung') });
  env.context.api.renderNotificationCenterItems();
  assert.equal(env.badge.style.display, 'grid');
});

test('GĐV chỉ thấy phiếu của mình; phiếu thiếu tên GĐV hoặc user thiếu tên thì ẩn', () => {
  const rows = {
    own: { transferId: 'PBG1', trangThai: 'cho_xac_nhan', gdvName: 'Nguyen Van A', danhSachHoSo: [{}] },
    other: { transferId: 'PBG2', trangThai: 'cho_xac_nhan', gdvName: 'Tran Van B', danhSachHoSo: [{}] },
    blank: { transferId: 'PBG3', trangThai: 'cho_xac_nhan', gdvName: '', danhSachHoSo: [{}] }
  };
  const env = setup(gdv, rows);
  env.context.api.renderNotificationCenterItems();
  assert.match(env.holder.innerHTML, /PBG1/);
  assert.doesNotMatch(env.holder.innerHTML, /PBG2|PBG3/);
  const nameless = setup({ role: 'Giám định viên' }, rows);
  nameless.context.api.renderNotificationCenterItems();
  assert.match(nameless.holder.innerHTML, /chưa có thông báo/);
  const admin = setup({ role: 'Admin' }, rows);
  admin.context.api.renderNotificationCenterItems();
  assert.match(admin.holder.innerHTML, /PBG1[\s\S]*PBG2|PBG2[\s\S]*PBG1/, 'Admin/Kế toán thấy tất cả');
});

// Mỗi lần phát chuông = 2 nốt → plays tăng 2.
function ready(env) { env.context.api.markNotificationSourceLoaded('transfers'); env.context.api.markNotificationSourceLoaded('cases'); }

test('chuông: không kêu lúc tải lần đầu, chỉ kêu khi có thông báo chưa đọc mới', () => {
  const env = setup(gdv, transfer('cho_xac_nhan'));
  env.context.api.renderNotificationCenterItems();            // dữ liệu chưa về đủ
  ready(env);
  env.context.api.renderNotificationCenterItems();            // ghi nhận hiện trạng
  assert.equal(env.context.plays, 0, 'tải trang không kêu dù đang có thông báo chưa đọc');
  env.context.api.renderNotificationCenterItems();
  assert.equal(env.context.plays, 0, 'vẽ lại không đổi gì thì không kêu');
  env.setTransfers(transfer('can_bo_sung'));
  env.context.api.renderNotificationCenterItems();
  assert.equal(env.context.plays, 2, 'có yêu cầu bổ sung mới → kêu 1 lần (2 nốt)');
  env.context.api.renderNotificationCenterItems();
  assert.equal(env.context.plays, 2, 'không kêu lặp lại cho cùng thông báo');
});

test('chuông: đọc/xóa thông báo hoặc tắt âm thì không kêu', () => {
  const env = setup(gdv, transfer('cho_xac_nhan'));
  ready(env);
  env.context.api.renderNotificationCenterItems();
  env.context.api.markAllNotificationsAsRead();
  env.context.api.dismissAllNotifications();
  assert.equal(env.context.plays, 0);
  env.context.api.toggleNotificationSound();                  // tắt
  assert.equal(env.storage?.notif_sound_off ?? env.context.localStorage.getItem('notif_sound_off'), '1');
  env.setTransfers(transfer('da_xac_nhan'));
  env.context.api.renderNotificationCenterItems();
  assert.equal(env.context.plays, 0, 'đã tắt âm → im lặng');
  env.context.api.toggleNotificationSound();                  // bật lại → phát thử
  assert.equal(env.context.plays, 2);
});

test('chuông: thông báo ca gara hoàn tất kêu khi tới sau lần tải đầu', () => {
  const env = setup({ ...gdv, uid: 'u', email: 'a@x.test' }, {});
  ready(env);
  env.context.api.renderNotificationCenterItems();
  env.context.cachedCasesPayload = { c1: { trangThai: 'done', bienSo: '47A1', nguoiTao: { uid: 'u' }, tenGara: 'Gara X' } };
  env.context.api.renderNotificationCenterItems();
  assert.equal(env.context.plays, 2);
});


// ---- Đồng bộ trạng thái đã đọc/đã xóa giữa các máy qua Firebase ----
function fakeDb(initial = {}, { failRead = false } = {}) {
  const tree = JSON.parse(JSON.stringify(initial));
  const listeners = [];
  const at = path => path.split('/').filter(Boolean).reduce((o, k) => (o && typeof o === 'object') ? o[k] : undefined, tree);
  const snap = path => ({ val: () => { const v = at(path); return v === undefined ? null : JSON.parse(JSON.stringify(v)); } });
  const db = {
    tree, writes: [],
    ref: path => ({
      on(event, cb, err) { if (failRead) { err && err(new Error('permission_denied')); return cb; } listeners.push({ path, cb }); cb(snap(path)); return cb; },
      off(event, cb) { const i = listeners.findIndex(l => l.path === path && l.cb === cb); if (i >= 0) listeners.splice(i, 1); },
      async update(updates) {
        db.writes.push({ path, updates });
        Object.entries(updates).forEach(([sub, value]) => {
          const keys = (path + '/' + sub).split('/').filter(Boolean);
          let o = tree; keys.slice(0, -1).forEach(k => { o = (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); });
          o[keys[keys.length - 1]] = value;
        });
        listeners.filter(l => l.path === path).forEach(l => l.cb(snap(path)));
      }
    })
  };
  return db;
}

test('đồng bộ: đọc ở máy A thì máy B (trình duyệt trống) không hiện lại là chưa đọc', () => {
  const db = fakeDb();
  const a = setup(gdv, transfer('cho_xac_nhan'), {}, db);
  a.context.api.renderNotificationCenterItems();
  assert.equal(a.badge.textContent, 1, 'máy A: có 1 thông báo chưa đọc');
  a.context.api.markNotificationAsRead(null, 'PBG1_cho_xac_nhan');
  assert.deepEqual(Object.keys(db.tree.notification_state.u.read), ['PBG1_cho_xac_nhan']);

  const b = setup(gdv, transfer('cho_xac_nhan'), {}, db);     // máy khác: localStorage rỗng
  b.context.api.renderNotificationCenterItems();
  assert.equal(b.badge.style.display, 'none', 'máy B: đã đọc, không còn huy hiệu');
  assert.ok(!b.holder.innerHTML.includes('Đã đọc</button>'), 'không còn nút "Đã đọc" của thông báo chưa đọc');
});

test('đồng bộ: xóa thông báo ở máy A thì máy B cũng không thấy nữa; trạng thái mới của phiếu vẫn báo', () => {
  const db = fakeDb();
  const a = setup(gdv, transfer('cho_xac_nhan'), {}, db);
  a.context.api.renderNotificationCenterItems();
  a.context.api.dismissNotification(null, 'PBG1_cho_xac_nhan');
  const b = setup(gdv, transfer('cho_xac_nhan'), {}, db);
  b.context.api.renderNotificationCenterItems();
  assert.match(b.holder.innerHTML, /Hiện chưa có thông báo nào/);
  b.setTransfers(transfer('da_xac_nhan'));
  b.context.api.renderNotificationCenterItems();
  assert.match(b.holder.innerHTML, /Đã xác nhận Phiếu PBG1/, 'đổi trạng thái → thông báo mới vẫn hiện');
  assert.equal(b.badge.textContent, 1);
});

test('đồng bộ: lịch sử đọc cũ chỉ có trong localStorage được đưa lên Firebase ở lần đầu', () => {
  const db = fakeDb();
  const storage = { read_notifs_u: JSON.stringify(['PBG1_cho_xac_nhan']) };
  const a = setup(gdv, transfer('cho_xac_nhan'), storage, db);
  a.context.api.renderNotificationCenterItems();
  assert.ok(db.tree.notification_state?.u?.read?.PBG1_cho_xac_nhan === true);
  const b = setup(gdv, transfer('cho_xac_nhan'), {}, db);
  b.context.api.renderNotificationCenterItems();
  assert.equal(b.badge.style.display, 'none');
});

test('đồng bộ: mã có ký tự cấm của Firebase được mã hóa và giải mã đúng', () => {
  const db = fakeDb();
  const weird = { p1: { transferId: 'PBG/2026.01', trangThai: 'cho_xac_nhan', gdvName: 'Nguyen Van A', danhSachHoSo: [{}] } };
  const a = setup(gdv, weird, {}, db);
  a.context.api.renderNotificationCenterItems();
  a.context.api.markNotificationAsRead(null, 'PBG/2026.01_cho_xac_nhan');
  const keys = Object.keys(db.tree.notification_state.u.read);
  assert.deepEqual(keys, ['PBG%2f2026%2e01_cho_xac_nhan']);
  const b = setup(gdv, weird, {}, db);
  b.context.api.renderNotificationCenterItems();
  assert.equal(b.badge.style.display, 'none');
});

test('đồng bộ: Firebase từ chối đọc → vẫn dùng localStorage, không mất tính năng', () => {
  const db = fakeDb({}, { failRead: true });
  const env = setup(gdv, transfer('cho_xac_nhan'), {}, db);
  env.context.api.renderNotificationCenterItems();
  env.context.api.markNotificationAsRead(null, 'PBG1_cho_xac_nhan');
  env.context.api.renderNotificationCenterItems();
  assert.equal(env.badge.style.display, 'none');
  assert.ok(JSON.parse(env.storage.read_notifs_u).includes('PBG1_cho_xac_nhan'));
});

test('đồng bộ: trong lúc chờ Firebase trả lời lần đầu không hiện huy hiệu chưa đọc', () => {
  let deliver;
  const db = { ref: () => ({ on(ev, cb) { deliver = () => cb({ val: () => ({ read: { PBG1_cho_xac_nhan: true } }) }); }, off() {}, async update() {} }) };
  const env = setup(gdv, transfer('cho_xac_nhan'), {}, db);
  env.context.api.renderNotificationCenterItems();
  assert.equal(env.badge.style.display, 'none', 'đang chờ → ẩn huy hiệu');
  deliver();
  assert.equal(env.badge.style.display, 'none', 'đã đọc ở máy khác → vẫn ẩn');
});
