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
      if (parsed.model !== 'gemini-3-flash' || parsed.stream !== false) { res.writeHead(400).end(); return; }
      const upstream = await fetchImpl('http://127.0.0.1:18317/v1/chat/completions', {method: 'POST', headers: {'Content-Type':'application/json', Authorization: 'Bearer ' + upstreamKey}, body, signal: AbortSignal.timeout(180000)});
      res.writeHead(upstream.status, {'Content-Type':'application/json', 'Cache-Control':'no-store'});
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch { if (!res.headersSent) res.writeHead(502, {'Content-Type':'application/json'}); res.end('{"error":{"message":"Không thể kết nối Antigravity trên máy này."}}'); }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'codex-antigravity-bridge');
  const local = JSON.parse(await readFile(join(dir, 'local-settings.json'), 'utf8'));
  const config = await readFile(join(dir, 'config.yaml'), 'utf8');
  const key = /^  - '([a-f0-9]+)'$/m.exec(config)?.[1];
  createBridge({email:local.email, upstreamKey:key}).listen(18318, '127.0.0.1', () => console.log('Antigravity local bridge: http://127.0.0.1:18318'));
}
