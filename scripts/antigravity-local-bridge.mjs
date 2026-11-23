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

export async function verifyFirebaseToken(token, email, now = Date.now()) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return false;
  let header, payload;
  try { header = JSON.parse(Buffer.from(parts[0], 'base64url')); payload = JSON.parse(Buffer.from(parts[1], 'base64url')); } catch { return false; }
  const seconds = Math.floor(now / 1000);
  if (header.alg !== 'RS256' || !header.kid || payload.aud !== project || payload.iss !== `https://securetoken.google.com/${project}` || !payload.sub || payload.exp <= seconds || !payload.exp || !payload.iat || payload.iat > seconds || payload.email?.toLowerCase() !== email.toLowerCase()) return false;
  if (!certCache || Date.now() >= certExpires || !certCache[header.kid]) {
    const response = await fetch(certUrl, {signal: AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error('Không thể xác minh tài khoản Firebase.');
    certCache = await response.json();
    certExpires = Date.now() + Math.min(Number(/max-age=(\d+)/.exec(response.headers.get('cache-control') || '')?.[1] || 300), 3600) * 1000;
  }
  if (!certCache[header.kid]) return false;
  const verify = createVerify('RSA-SHA256');
  verify.update(parts[0] + '.' + parts[1]); verify.end();
  try { return verify.verify(certCache[header.kid], Buffer.from(parts[2], 'base64url')); } catch { return false; }
}

export function createBridge({email, upstreamKey, fetchImpl = fetch, verifyToken = verifyFirebaseToken, allowedHosts = new Set(['127.0.0.1:18318', 'localhost:18318'])}) {
  if (!email || !upstreamKey) throw new Error('Thiếu tài khoản website hoặc khoá kết nối cục bộ.');
  return http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (!origins.has(origin) || !allowedHosts.has(req.headers.host)) { res.writeHead(403).end(); return; }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') { res.writeHead(404).end(); return; }
    try {
      const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
      if (!token || !await verifyToken(token, email)) { res.writeHead(401).end(); return; }
      let size = 0; const chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 12 * 1024 * 1024) { res.writeHead(413).end(); return; } chunks.push(chunk); }
      const body = Buffer.concat(chunks);
      const parsed = JSON.parse(body.toString('utf8'));
      if (!['gemini-3-flash', 'gemini-3.8-flash-tiered'].includes(parsed.model) || parsed.stream !== false) { res.writeHead(400).end(); return; }
      const upstream = await fetchImpl('http://127.0.0.1:18317/v1/chat/completions', {method: 'POST', headers: {'Content-Type':'application/json', Authorization: 'Bearer ' + upstreamKey}, body, signal: AbortSignal.timeout(180000)});
      res.writeHead(upstream.status, {'Content-Type':'application/json', 'Cache-Control':'no-store'});
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch { if (!res.headersSent) res.writeHead(502, {'Content-Type':'application/json'}); res.end('{"error":{"message":"Không thể kết nối Antigravity trên máy này."}}'); }
  });
}

export const bridgeDir = () => join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'codex-antigravity-bridge');

// Đọc cấu hình cục bộ; trả về {email, key} hoặc {problems} (mỗi lỗi kèm cách xử lý) thay vì ném lỗi khó hiểu.
export async function loadLocal(dir = bridgeDir(), read = readFile) {
  const problems = [];
  let email = '', key = '';
  try { email = String(JSON.parse(await read(join(dir, 'local-settings.json'), 'utf8')).email || '').trim(); } catch { /* báo bên dưới */ }
  if (!email) problems.push('Thiếu hoặc sai ' + join(dir, 'local-settings.json') + ' (cần {"email":"<email đăng nhập website>"}).');
  try { key = /^  - '([a-f0-9]+)'$/m.exec(await read(join(dir, 'config.yaml'), 'utf8'))?.[1] || ''; } catch { /* báo bên dưới */ }
  if (!key) problems.push('Thiếu hoặc sai ' + join(dir, 'config.yaml') + ' (cần dòng khoá api-keys dạng:   - \'<chuỗi hex>\').');
  return {email, key, problems};
}

// Kiểm tra từng mắt xích: cấu hình → CLIProxyAPI (18317) → cầu nối (18318). Trả về danh sách dòng "OK/LỖI".
export async function checkSetup({dir = bridgeDir(), read = readFile, fetchImpl = fetch} = {}) {
  const lines = [];
  const local = await loadLocal(dir, read);
  if (local.problems.length) local.problems.forEach(text => lines.push('LỖI  ' + text)); else lines.push('OK    Cấu hình cục bộ (' + local.email + ')');
  if (local.key) {
    try {
      const upstream = await fetchImpl('http://127.0.0.1:18317/v1/models', {headers: {Authorization: 'Bearer ' + local.key}, signal: AbortSignal.timeout(5000)});
      lines.push(upstream.ok ? 'OK    CLIProxyAPI đang chạy ở cổng 18317' : 'LỖI  CLIProxyAPI ở cổng 18317 trả về HTTP ' + upstream.status + (upstream.status === 401 ? ' — khoá trong config.yaml không khớp với CLIProxyAPI đang chạy.' : '.'));
    } catch { lines.push('LỖI  Không kết nối được CLIProxyAPI ở cổng 18317 — hãy chạy CLIProxyAPI (và đăng nhập Google/Antigravity trong đó) trước.'); }
  }
  try {
    const bridge = await fetchImpl('http://127.0.0.1:18318/v1/chat/completions', {method: 'OPTIONS', headers: {Origin: [...origins][0], 'Access-Control-Request-Method': 'POST'}, signal: AbortSignal.timeout(3000)});
    lines.push(bridge.status === 204 ? 'OK    Cầu nối đang chạy ở cổng 18318' : 'LỖI  Cổng 18318 có dịch vụ nhưng trả HTTP ' + bridge.status + ' (có thể là chương trình khác chiếm cổng).');
  } catch { lines.push('LỖI  Cầu nối chưa chạy ở cổng 18318 — chạy: node scripts/antigravity-local-bridge.mjs'); }
  return lines;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--check')) {
    const lines = await checkSetup();
    console.log(lines.join('\n'));
    process.exit(lines.some(line => line.startsWith('LỖI')) ? 1 : 0);
  }
  const local = await loadLocal();
  if (local.problems.length) { console.error('Chưa chạy được cầu nối Antigravity:\n- ' + local.problems.join('\n- ') + '\nChạy "node scripts/antigravity-local-bridge.mjs --check" để kiểm tra toàn bộ.'); process.exit(1); }
  const server = createBridge({email: local.email, upstreamKey: local.key});
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Cổng 18318 đang bị chiếm — có thể cầu nối đã chạy sẵn ở cửa sổ khác.' : 'Lỗi cầu nối: ' + error.message); process.exit(1); });
  server.listen(18318, '127.0.0.1', () => console.log('Antigravity local bridge: http://127.0.0.1:18318 (tài khoản ' + local.email + ')'));
}
