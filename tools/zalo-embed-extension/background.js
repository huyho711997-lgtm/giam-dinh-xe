// Khi Zalo chạy trong khung nhúng (trang khác tên miền), trình duyệt mặc định KHÔNG gửi cookie đăng nhập có SameSite=Lax/Strict.
// Tiện ích đổi cookie của zalo.me / zaloapp.com sang SameSite=None; Secure để phiên đăng nhập hoạt động trong khung.
// Chỉ áp dụng cho các tên miền Zalo bên dưới, chỉ trên trình duyệt đã cài tiện ích.
const SCOPES = ['zalo.me', 'zaloapp.com'];

const inScope = domain => { const host = String(domain || '').replace(/^\./, ''); return SCOPES.some(scope => host === scope || host.endsWith('.' + scope)); };

async function relax(cookie) {
  if (!cookie || !inScope(cookie.domain) || cookie.sameSite === 'no_restriction') return;
  const host = cookie.domain.replace(/^\./, '');
  const details = {
    url: 'https://' + host + (cookie.path || '/'), name: cookie.name, value: cookie.value, path: cookie.path || '/',
    secure: true, httpOnly: !!cookie.httpOnly, sameSite: 'no_restriction', storeId: cookie.storeId
  };
  if (!cookie.hostOnly) details.domain = cookie.domain;
  if (!cookie.session && cookie.expirationDate) details.expirationDate = cookie.expirationDate;
  try { await chrome.cookies.set(details); } catch (_) { /* cookie đặc biệt (VD tiền tố __Host-) không đổi được: bỏ qua */ }
}

async function relaxAll() {
  for (const scope of SCOPES) for (const cookie of await chrome.cookies.getAll({ domain: scope })) await relax(cookie);
}

chrome.cookies.onChanged.addListener(({ removed, cookie }) => { if (!removed) relax(cookie); });
chrome.runtime.onInstalled.addListener(relaxAll);
chrome.runtime.onStartup.addListener(relaxAll);
globalThis.__zaloEmbed = { inScope, relax };
