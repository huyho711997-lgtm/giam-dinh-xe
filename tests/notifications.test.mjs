import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/features/notifications/notification-center.js', import.meta.url), 'utf8');

function setup(profile, transfers, storage = {}) {
  const holder = { innerHTML: '' }, badge = { style: {}, textContent: '' }, label = { style: {}, textContent: '' };
  const elements = { notificationItemsHolder: holder, navNotificationBadge: badge, lblNotifUnreadCount: label };
  const context = vm.createContext({
    console, JSON, Set, Array, Object, Date, Number, String,
    localStorage: { getItem: key => storage[key] ?? null, setItem: (key, value) => { storage[key] = value; } },
    document: { getElementById: id => elements[id] || null },
    firebase: { auth: () => ({ currentUser: { uid: 'u', displayName: '' } }) },
    activeUserProfile: profile, cachedAccountingTransfersPayload: transfers, cachedCasesPayload: null,
    getLoggedInUserAccountingRole: () => profile.acc || '', formatDateDisplay: String, parseDateParts: () => null,
    escapeHtmlOutput: String, triggerToast() {}, STATUS_COMPLETED: 'done'
  });
  vm.runInContext(`${source}\n;this.api={renderNotificationCenterItems,markAllNotificationsAsRead,dismissAllNotifications};`, context);
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
