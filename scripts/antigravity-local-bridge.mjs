// Local relay: the Google OAuth and CLIProxyAPI keys never leave this computer.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createVerify} from 'node:crypto';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const project = 'doi-chieu-gara';
const origins = new Set(['https://giam-dinh-xe-rose.vercel.app', 'http://localhost:3000']);
const certUrl = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certCache = null, certExpires = 0;
// Đồng hồ Windows thường chậm vài giây so với Google: token vừa được làm mới có iat "ở tương lai" so với máy này → trước đây bị từ chối (lúc được lúc không).
// Cho phép lệch đồng hồ tới 5 phút (mức các thư viện xác minh JWT của Google cũng chấp nhận).
export const CLOCK_SKEW_SECONDS = 300;
// Mô hình hợp lệ: id do CLIProxyAPI cung cấp (gemini-3-pro-high, claude-sonnet-4-5-thinking, gpt-oss-120b-medium…). CLIProxyAPI tự từ chối id không có trong tài khoản.
export const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@+\-]{0,99}$/;
const decodePayload = token => { try { return JSON.parse(Buffer.from(String(token || '').split('.')[1] || '', 'base64url')); } catch { return null; } };
// Giải thích vì sao token bị từ chối (chỉ đọc phần chưa xác thực để gợi ý cách xử lý; không dùng để cho phép truy cập).
export function explainToken(token, email, now = Date.now()) {
  const payload = decodePayload(token), seconds = Math.floor(now / 1000);
  if (!payload) return 'Token không hợp lệ.';
  if (payload.exp && payload.exp <= seconds - CLOCK_SKEW_SECONDS) return 'Token đã hết hạn — hãy tải lại trang/mở lại app rồi thử lại.';
  if (payload.iat && payload.iat > seconds + CLOCK_SKEW_SECONDS) return 'Đồng hồ máy tính chạy chậm hơn ' + Math.round((payload.iat - seconds) / 60) + ' phút so với Google — hãy đồng bộ giờ Windows (Settings → Time & language → Sync now).';
  if (payload.email && email && String(payload.email).toLowerCase() !== String(email).toLowerCase()) return 'Tài khoản đăng nhập (' + payload.email + ') khác với tài khoản đã cấu hình trong local-settings.json.';
  if (payload.iss && String(payload.iss).includes('/auth/v1')) return 'Supabase không xác nhận token này (hết hạn, hoặc email khác với tài khoản đã cấu hình).';
  if (payload.aud && payload.aud !== project) return 'Token thuộc dự án Firebase khác.';
  return 'Không xác minh được chữ ký token.';
}

// Bản "Kho giá phụ tùng Pro" đăng nhập bằng Supabase: nhờ chính Supabase Auth xác minh token (không cần giữ khoá bí mật nào trên máy).
// URL và khoá anon là giá trị công khai (cùng giá trị nằm trong trang web); có thể ghi đè trong local-settings.json (supabaseUrl, supabaseAnonKey).
export const SUPABASE_AUTH = {url: 'https://yxwmcpoklxpzlikxojez.supabase.co', anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d21jcG9rbHhwemxpa3hvamV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1Njk0MDEsImV4cCI6MjA5NjE0NTQwMX0.dmyjtDDo_KTlUFyxQgoCGqEt5Bsq2krEEYg2BCyXeFc'};
export async function verifySupabaseToken(token, email, fetchImpl = fetch, auth = SUPABASE_AUTH) {
  const payload = decodePayload(token);
  if (!payload || !auth.url || !auth.anonKey || payload.iss !== auth.url + '/auth/v1' || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000) - 60) return false;
  const response = await fetchImpl(auth.url + '/auth/v1/user', {headers: {Authorization: 'Bearer ' + token, apikey: auth.anonKey}, signal: AbortSignal.timeout(8000)});
  if (response.status === 401 || response.status === 403) return false;
  if (!response.ok) throw new Error('Supabase Auth không phản hồi.');
  const user = await response.json().catch(() => null);
  return !!user?.id && String(user.email || '').toLowerCase() === String(email || '').toLowerCase();
}
// Chọn cách xác minh theo nơi cấp token: Firebase (giam-dinh-xe) hoặc Supabase (Kho giá phụ tùng Pro).
export async function verifyAccountToken(token, email, now = Date.now()) {
  return decodePayload(token)?.iss === SUPABASE_AUTH.url + '/auth/v1' ? verifySupabaseToken(token, email) : verifyFirebaseToken(token, email, now);
}

export async function verifyFirebaseToken(token, email, now = Date.now()) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return false;
  let header, payload;
  try { header = JSON.parse(Buffer.from(parts[0], 'base64url')); payload = JSON.parse(Buffer.from(parts[1], 'base64url')); } catch { return false; }
  const seconds = Math.floor(now / 1000);
  if (header.alg !== 'RS256' || !header.kid || payload.aud !== project || payload.iss !== `https://securetoken.google.com/${project}` || !payload.sub || payload.exp <= seconds - 60 || !payload.exp || !payload.iat || payload.iat > seconds + CLOCK_SKEW_SECONDS || payload.email?.toLowerCase() !== email.toLowerCase()) return false;
  if (!certCache || Date.now() >= certExpires || !certCache[header.kid]) {
    // Mạng của máy tính chập chờn khi lấy chứng chỉ không được làm hỏng cả yêu cầu: thử lại một lần, rồi dùng tạm chứng chỉ cũ (Google chỉ xoay khoá vài ngày một lần).
    let fresh = null, lastError = null;
    for (let attempt = 0; attempt < 2 && !fresh; attempt++) {
      try {
        const response = await fetch(certUrl, {signal: AbortSignal.timeout(8000)});
        if (!response.ok) throw new Error('Không thể xác minh tài khoản Firebase.');
        fresh = {certs: await response.json(), expires: Date.now() + Math.min(Number(/max-age=(\d+)/.exec(response.headers.get('cache-control') || '')?.[1] || 300), 3600) * 1000};
      } catch (error) { lastError = error; }
    }
    if (fresh) { certCache = fresh.certs; certExpires = fresh.expires; }
    else if (!certCache || !certCache[header.kid]) throw lastError || new Error('Không thể xác minh tài khoản Firebase.');
  }
  if (!certCache[header.kid]) return false;
  const verify = createVerify('RSA-SHA256');
  verify.update(parts[0] + '.' + parts[1]); verify.end();
  try { return verify.verify(certCache[header.kid], Buffer.from(parts[2], 'base64url')); } catch { return false; }
}

export function createBridge({email, upstreamKey, fetchImpl = fetch, verifyToken = verifyAccountToken, allowedHosts = new Set(['127.0.0.1:18318', 'localhost:18318']), allowedOrigins = origins}) {
  if (!email || !upstreamKey) throw new Error('Thiếu tài khoản website hoặc khoá kết nối cục bộ.');
  let modelsCache = null;
  return http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    const host = String(req.headers.host || '').trim();
    if (!allowedOrigins.has(origin) || (!allowedHosts.has(host) && !allowedHosts.has(host.toLowerCase()))) { res.writeHead(403).end(); return; }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
    const isModels = req.method === 'GET' && req.url === '/v1/models';
    if (!isModels && (req.method !== 'POST' || req.url !== '/v1/chat/completions')) { res.writeHead(404).end(); return; }
    const fail = (status, message, code) => { if (!res.headersSent) res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); res.end(JSON.stringify({error: {message, code}})); };
    try {
      const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
      if (!token) { fail(401, 'Thiếu token đăng nhập.', 'auth'); return; }
      let accepted;
      try { accepted = await verifyToken(token, email); }
      catch { fail(503, 'Máy trung gian không tải được chứng chỉ xác minh của Google (mạng của máy tính đang chập chờn). Thử lại sau vài giây.', 'cert'); return; }
      if (!accepted) { fail(401, 'Cầu nối từ chối token: ' + explainToken(token, email), 'auth'); return; }
      if (isModels) {
        // Danh sách mô hình thật mà các tài khoản Antigravity trong CLIProxyAPI đang dùng được (lưu đệm 30 giây).
        if (!modelsCache || Date.now() > modelsCache.until) {
          const upstream = await fetchImpl('http://127.0.0.1:18317/v1/models', {headers: {Authorization: 'Bearer ' + upstreamKey}, signal: AbortSignal.timeout(15000)});
          if (!upstream.ok) { fail(upstream.status === 401 ? 502 : upstream.status, 'CLIProxyAPI không trả được danh sách mô hình (HTTP ' + upstream.status + ').', 'upstream'); return; }
          modelsCache = {body: Buffer.from(await upstream.arrayBuffer()), until: Date.now() + 30000};
        }
        res.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
        res.end(modelsCache.body);
        return;
      }
      let size = 0; const chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 12 * 1024 * 1024) { res.writeHead(413).end(); return; } chunks.push(chunk); }
      const body = Buffer.concat(chunks);
      const parsed = JSON.parse(body.toString('utf8'));
      if (!MODEL_PATTERN.test(String(parsed.model || '')) || parsed.stream !== false) { fail(400, 'Tên mô hình không hợp lệ hoặc yêu cầu không ở chế độ stream=false.', 'bad_request'); return; }
      const send = () => fetchImpl('http://127.0.0.1:18317/v1/chat/completions', {method: 'POST', headers: {'Content-Type':'application/json', Authorization: 'Bearer ' + upstreamKey}, body, signal: AbortSignal.timeout(180000)});
      let upstream;
      // Chỉ thử lại khi KẾT NỐI tới CLIProxyAPI bị ngắt trước khi có phản hồi (không thử lại khi đã nhận mã HTTP, để khỏi tính phí/hạn mức hai lần).
      try { upstream = await send(); }
      catch (error) { if (error && error.name === 'TimeoutError') throw error; await new Promise(resolve => setTimeout(resolve, 400)); upstream = await send(); }
      res.writeHead(upstream.status, {'Content-Type':'application/json', 'Cache-Control':'no-store'});
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch { fail(502, 'Không thể kết nối Antigravity trên máy này.', 'upstream'); }
  });
}

export const bridgeDir = () => join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'codex-antigravity-bridge');

// Đọc cấu hình cục bộ; trả về {email, key, allowedHosts, allowedOrigins, problems} (mỗi lỗi kèm cách xử lý) thay vì ném lỗi khó hiểu.
export async function loadLocal(dir = bridgeDir(), read = readFile) {
  const problems = [];
  let email = '', key = '', allowedHosts = null, allowedOrigins = null;
  try {
    const settings = JSON.parse(await read(join(dir, 'local-settings.json'), 'utf8'));
    email = String(settings?.email || '').trim();
    if (typeof settings?.supabaseUrl === 'string' && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(settings.supabaseUrl.trim())) SUPABASE_AUTH.url = settings.supabaseUrl.trim();
    if (typeof settings?.supabaseAnonKey === 'string' && settings.supabaseAnonKey.trim()) SUPABASE_AUTH.anonKey = settings.supabaseAnonKey.trim();
    const rawHosts = Array.isArray(settings?.allowedHosts) ? settings.allowedHosts : (typeof settings?.tailscaleHost === 'string' ? [settings.tailscaleHost] : []);
    const hosts = rawHosts.map(item => String(item || '').trim().toLowerCase()).filter(Boolean);
    if (hosts.length) allowedHosts = new Set(hosts);
    const rawOrigins = Array.isArray(settings?.allowedOrigins) ? settings.allowedOrigins : [];
    const originList = rawOrigins.map(item => String(item || '').trim()).filter(Boolean);
    if (originList.length) allowedOrigins = new Set(originList);
  } catch { /* báo bên dưới */ }
  if (!email) problems.push('Thiếu hoặc sai ' + join(dir, 'local-settings.json') + ' (cần {"email":"<email đăng nhập website>"}).');
  try {
    const rawConfig = await read(join(dir, 'config.yaml'), 'utf8');
    key = /^\s*api-keys:\r?\n\s*-\s+['"]?([a-f0-9]+)['"]?\s*$/m.exec(rawConfig)?.[1]
      || /^\s+- '([a-f0-9]+)'\r?$/m.exec(rawConfig)?.[1]
      || '';
  } catch { /* báo bên dưới */ }
  if (!key) problems.push('Thiếu hoặc sai ' + join(dir, 'config.yaml') + ' (cần dòng khoá api-keys dạng:   - \'<chuỗi hex>\').');
  return {email, key, allowedHosts, allowedOrigins, problems};
}

// Kiểm tra từng mắt xích: cấu hình → CLIProxyAPI (18317) → cầu nối (18318). Trả về danh sách dòng "OK/LỖI".
export async function checkSetup({dir = bridgeDir(), read = readFile, fetchImpl = fetch} = {}) {
  const lines = [], extra = [];
  const local = await loadLocal(dir, read);
  if (local.problems.length) local.problems.forEach(text => lines.push('LỖI  ' + text)); else lines.push('OK    Cấu hình cục bộ (' + local.email + ')');
  if (local.key) {
    try {
      const upstream = await fetchImpl('http://127.0.0.1:18317/v1/models', {headers: {Authorization: 'Bearer ' + local.key}, signal: AbortSignal.timeout(5000)});
      if (upstream.ok && typeof upstream.json === 'function') {
        try {
          const list = (await upstream.json())?.data;
          const ids = Array.isArray(list) ? list.map(item => item?.id).filter(Boolean) : [];
          extra.push(ids.length ? 'OK    Antigravity cung cấp ' + ids.length + ' mô hình: ' + ids.join(', ') : 'CẢNH BÁO  CLIProxyAPI chưa liệt kê mô hình nào — hãy đăng nhập tài khoản Antigravity trong CLIProxyAPI.');
        } catch { /* không đọc được danh sách: bỏ qua */ }
      }
      lines.push(upstream.ok ? 'OK    CLIProxyAPI đang chạy ở cổng 18317' : 'LỖI  CLIProxyAPI ở cổng 18317 trả về HTTP ' + upstream.status + (upstream.status === 401 ? ' — khoá trong config.yaml không khớp với CLIProxyAPI đang chạy.' : '.'));
    } catch { lines.push('LỖI  Không kết nối được CLIProxyAPI ở cổng 18317 — hãy chạy CLIProxyAPI (và đăng nhập Google/Antigravity trong đó) trước.'); }
  }
  const checkOrigin = local.allowedOrigins ? [...local.allowedOrigins][0] : [...origins][0];
  const remoteHost = local.allowedHosts && !local.allowedHosts.has('127.0.0.1:18318') ? [...local.allowedHosts][0] : '';
  const checkUrl = remoteHost ? `https://${remoteHost}/v1/chat/completions` : 'http://127.0.0.1:18318/v1/chat/completions';
  try {
    const bridge = await fetchImpl(checkUrl, {method: 'OPTIONS', headers: {Origin: checkOrigin, 'Access-Control-Request-Method': 'POST'}, signal: AbortSignal.timeout(3000)});
    lines.push(bridge.status === 204 ? ('OK    Cầu nối đang chạy' + (remoteHost ? ' qua https://' + remoteHost : ' ở cổng 18318')) : 'LỖI  Cổng 18318 có dịch vụ nhưng trả HTTP ' + bridge.status + ' (có thể là chương trình khác chiếm cổng hoặc sai Host/Origin).');
  } catch { lines.push('LỖI  Cầu nối chưa chạy ở cổng 18318 — chạy: node scripts/antigravity-local-bridge.mjs'); }
  // Đồng hồ máy tính lệch so với Google làm token đăng nhập bị từ chối ngẫu nhiên.
  try {
    const clock = await fetchImpl(certUrl, {method: 'HEAD', signal: AbortSignal.timeout(5000)});
    const header = clock?.headers?.get?.('date');
    const skew = header ? Math.round((Date.now() - Date.parse(header)) / 1000) : NaN;
    if (Number.isFinite(skew)) {
      if (Math.abs(skew) > CLOCK_SKEW_SECONDS - 60) extra.push('LỖI  Đồng hồ máy tính lệch ' + skew + ' giây so với Google — hãy đồng bộ giờ Windows (Settings → Time & language → Sync now).');
      else if (Math.abs(skew) > 30) extra.push('CẢNH BÁO  Đồng hồ máy tính lệch ' + skew + ' giây so với Google (cầu nối chịu được ' + CLOCK_SKEW_SECONDS + ' giây) — nên đồng bộ giờ Windows.');
      else extra.push('OK    Đồng hồ máy tính khớp Google (lệch ' + skew + ' giây)');
    }
  } catch { /* không có mạng ra ngoài: bỏ qua */ }
  return lines.concat(extra);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--check')) {
    const lines = await checkSetup();
    console.log(lines.join('\n'));
    process.exit(lines.some(line => line.startsWith('LỖI')) ? 1 : 0);
  }
  const local = await loadLocal();
  if (local.problems.length) { console.error('Chưa chạy được cầu nối Antigravity:\n- ' + local.problems.join('\n- ') + '\nChạy "node scripts/antigravity-local-bridge.mjs --check" để kiểm tra toàn bộ.'); process.exit(1); }
  const opts = {email: local.email, upstreamKey: local.key};
  if (local.allowedHosts) opts.allowedHosts = local.allowedHosts;
  if (local.allowedOrigins) opts.allowedOrigins = local.allowedOrigins;
  const server = createBridge(opts);
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Cổng 18318 đang bị chiếm — có thể cầu nối đã chạy sẵn ở cửa sổ khác.' : 'Lỗi cầu nối: ' + error.message); process.exit(1); });
  server.listen(18318, '127.0.0.1', () => console.log('Antigravity local bridge: http://127.0.0.1:18318 (tài khoản ' + local.email + (local.allowedHosts ? ', hosts: ' + [...local.allowedHosts].join(', ') : '') + ')'));
}
