import test from 'node:test';
import assert from 'node:assert/strict';
import {createBridge, verifyFirebaseToken, explainToken, loadLocal, checkSetup, CLOCK_SKEW_SECONDS} from '../scripts/antigravity-local-bridge.mjs';

test('cầu nối chỉ nhận đúng website, tài khoản và mô hình, không tiết lộ khoá', async t => {
  let forwarded;
  const allowedHosts = new Set();
  const server = createBridge({email:'owner@example.com', upstreamKey:'private-key', allowedHosts, verifyToken: async token => token === 'valid', fetchImpl: async (url, options) => { forwarded = {url, options}; return new Response(JSON.stringify({choices:[{message:{content:'OK'}}]}), {status:200}); }});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  allowedHosts.add(`127.0.0.1:${server.address().port}`);
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/v1/chat/completions`;
  const headers = {host:'127.0.0.1:18318',origin:'https://giam-dinh-xe-rose.vercel.app',authorization:'Bearer valid','content-type':'application/json'};
  const preflight = await fetch(url,{method:'OPTIONS',headers:{...headers,'access-control-request-private-network':'true'}});
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('access-control-allow-private-network'),'true');
  assert.equal((await fetch(url,{method:'POST',headers:{...headers,origin:'https://other.example'},body:'{}'})).status,403);
  assert.equal((await fetch(url,{method:'POST',headers:{...headers,authorization:'Bearer invalid'},body:'{}'})).status,401);
  assert.equal((await fetch(url,{method:'POST',headers,body:JSON.stringify({model:'../etc/passwd',stream:false})})).status,400);
  assert.equal((await fetch(url,{method:'POST',headers,body:JSON.stringify({model:'gemini-3-flash',stream:true})})).status,400);
  const ok = await fetch(url,{method:'POST',headers,body:JSON.stringify({model:'gemini-3-flash',stream:false,messages:[]})});
  assert.equal(ok.status,200);
  assert.equal((await ok.json()).choices[0].message.content,'OK');
  assert.equal(forwarded.options.headers.Authorization,'Bearer private-key');
  assert.notEqual(ok.headers.get('authorization'),'Bearer private-key');
  const upgraded = await fetch(url,{method:'POST',headers,body:JSON.stringify({model:'gemini-3.8-flash-tiered',stream:false,messages:[]})});
  assert.equal(upgraded.status,200);
  assert.equal(JSON.parse(forwarded.options.body).model,'gemini-3.8-flash-tiered');
});

test('từ chối JWT không hợp lệ trước khi truy vấn chứng chỉ', async () => {
  assert.equal(await verifyFirebaseToken('not-a-token','owner@example.com'),false);
  const part = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  assert.equal(await verifyFirebaseToken(`${part({alg:'none'})}.${part({aud:'doi-chieu-gara'})}.x`,'owner@example.com'),false);
});

const fakeFiles = files => async path => { const name = String(path).split(/[\\/]/).pop(); if (!(name in files)) throw new Error('ENOENT'); return files[name]; };

test('loadLocal báo rõ tệp cấu hình thiếu thay vì ném lỗi', async () => {
  const none = await loadLocal('D:/x', fakeFiles({}));
  assert.equal(none.problems.length, 2);
  assert.match(none.problems[0], /local-settings\.json/);
  assert.match(none.problems[1], /config\.yaml/);
  const ok = await loadLocal('D:/x', fakeFiles({'local-settings.json': '{"email":"a@b.c"}', 'config.yaml': "api-keys:\n  - 'abc123'\n"}));
  assert.deepEqual([ok.email, ok.key, ok.problems.length], ['a@b.c', 'abc123', 0]);
});

test('checkSetup chỉ ra mắt xích đang hỏng', async () => {
  const read = fakeFiles({'local-settings.json': '{"email":"a@b.c"}', 'config.yaml': "  - 'abc123'\n"});
  const down = await checkSetup({dir: 'D:/x', read, fetchImpl: async () => { throw new Error('ECONNREFUSED'); }});
  assert.match(down[0], /^OK/);
  assert.match(down[1], /^LỖI.*18317/);
  assert.match(down[2], /^LỖI.*18318/);
  const up = await checkSetup({dir: 'D:/x', read, fetchImpl: async (url, options) => ({ok: true, status: options && options.method === 'OPTIONS' ? 204 : 200})});
  assert.ok(up.every(line => line.startsWith('OK')), up.join('\n'));
  const unauthorized = await checkSetup({dir: 'D:/x', read, fetchImpl: async () => ({ok: false, status: 401})});
  assert.match(unauthorized[1], /khoá trong config\.yaml/);
});

test('loadLocal hỗ trợ config.yaml CLIProxyAPI v8 (thụt 4 dấu cách, CRLF) và allowedHosts/allowedOrigins', async () => {
  const v8Config = 'config-version: 8\r\naccess:\r\n  api-keys:\r\n    - \'deadbeef01234567\'\r\n';
  const settings = JSON.stringify({
    email: 'owner@example.com',
    allowedHosts: ['RELAY-NODE.tail1234.ts.net'],
    allowedOrigins: ['https://giam-dinh-xe-rose.vercel.app']
  });
  const local = await loadLocal('D:/x', fakeFiles({'local-settings.json': settings, 'config.yaml': v8Config}));
  assert.equal(local.problems.length, 0);
  assert.equal(local.key, 'deadbeef01234567');
  assert.deepEqual([...local.allowedHosts], ['relay-node.tail1234.ts.net']);
  assert.deepEqual([...local.allowedOrigins], ['https://giam-dinh-xe-rose.vercel.app']);

  const seen = [];
  const lines = await checkSetup({
    dir: 'D:/x',
    read: fakeFiles({'local-settings.json': settings, 'config.yaml': v8Config}),
    fetchImpl: async (url, options) => {
      seen.push({url, method: options?.method || 'GET', origin: options?.headers?.Origin});
      return {ok: true, status: options?.method === 'OPTIONS' ? 204 : 200};
    }
  });
  assert.ok(lines.every(line => line.startsWith('OK')), lines.join('\n'));
  assert.equal(seen[1].url, 'https://relay-node.tail1234.ts.net/v1/chat/completions');
  assert.equal(seen[1].origin, 'https://giam-dinh-xe-rose.vercel.app');
});

test('cầu nối giới hạn đúng hostname .ts.net và origin Vercel khi cấu hình Tailscale', async t => {
  const http = await import('node:http');
  const server = createBridge({
    email: 'owner@example.com',
    upstreamKey: 'private-key',
    allowedHosts: new Set(['relay-node.tail1234.ts.net']),
    allowedOrigins: new Set(['https://giam-dinh-xe-rose.vercel.app']),
    verifyToken: async token => token === 'valid',
    fetchImpl: async () => new Response(JSON.stringify({choices: [{message: {content: 'OK'}}]}), {status: 200})
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const {port} = server.address();
  t.after(() => server.close());

  const req = (method, headers, body = '') => new Promise((resolve, reject) => {
    const r = http.request({host: '127.0.0.1', port, path: '/v1/chat/completions', method, headers}, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({status: res.statusCode, body: Buffer.concat(chunks).toString('utf8')}));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });

  // Sai Host (127.0.0.1 hoặc domain lạ) bị chặn 403
  assert.equal((await req('OPTIONS', {Host: '127.0.0.1:18318', Origin: 'https://giam-dinh-xe-rose.vercel.app'})).status, 403);
  assert.equal((await req('OPTIONS', {Host: 'evil.ts.net', Origin: 'https://giam-dinh-xe-rose.vercel.app'})).status, 403);
  // Origin localhost:3000 bị chặn khi allowedOrigins chỉ cho Vercel
  assert.equal((await req('OPTIONS', {Host: 'relay-node.tail1234.ts.net', Origin: 'http://localhost:3000'})).status, 403);
  // Đúng Host + đúng Origin được chấp nhận
  assert.equal((await req('OPTIONS', {Host: 'relay-node.tail1234.ts.net', Origin: 'https://giam-dinh-xe-rose.vercel.app'})).status, 204);
  // Đúng Host + Origin nhưng thiếu/sai Firebase token bị chặn 401
  assert.equal((await req('POST', {Host: 'relay-node.tail1234.ts.net', Origin: 'https://giam-dinh-xe-rose.vercel.app', 'Content-Type': 'application/json'}, JSON.stringify({model: 'gemini-3-flash', stream: false}))).status, 401);
  // Đúng Host + Origin + Firebase token hợp lệ được chuyển tiếp
  const ok = await req('POST', {Host: 'relay-node.tail1234.ts.net', Origin: 'https://giam-dinh-xe-rose.vercel.app', Authorization: 'Bearer valid', 'Content-Type': 'application/json'}, JSON.stringify({model: 'gemini-3-flash', stream: false, messages: []}));
  assert.equal(ok.status, 200);
});


test('cầu nối cho phép mọi mô hình hợp lệ của Antigravity và liệt kê mô hình thật (GET /v1/models)', async t => {
  const calls = [];
  const allowedHosts = new Set();
  const server = createBridge({email:'owner@example.com', upstreamKey:'private-key', allowedHosts, verifyToken: async token => token === 'valid',
    fetchImpl: async (url, options) => { calls.push({url, method: options?.method || 'GET'}); return url.endsWith('/v1/models') ? new Response(JSON.stringify({data:[{id:'gemini-3-pro-high'},{id:'claude-sonnet-4-5-thinking'}]}), {status:200}) : new Response(JSON.stringify({choices:[{message:{content:'OK'}}]}), {status:200}); }});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  allowedHosts.add(`127.0.0.1:${server.address().port}`);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = {host:'127.0.0.1:18318',origin:'https://giam-dinh-xe-rose.vercel.app',authorization:'Bearer valid','content-type':'application/json'};
  const preflight = await fetch(base + '/v1/models',{method:'OPTIONS',headers});
  assert.match(preflight.headers.get('access-control-allow-methods'), /GET/);
  const noAuth = await fetch(base + '/v1/models',{headers:{...headers,authorization:'Bearer bad'}});
  assert.equal(noAuth.status,401);
  assert.match((await noAuth.json()).error.message, /từ chối token/);
  const list = await fetch(base + '/v1/models',{headers});
  assert.equal(list.status,200);
  assert.deepEqual((await list.json()).data.map(item => item.id), ['gemini-3-pro-high','claude-sonnet-4-5-thinking']);
  await fetch(base + '/v1/models',{headers});
  assert.equal(calls.filter(call => call.url.endsWith('/v1/models')).length, 1, 'danh sách được lưu đệm');
  for (const model of ['gemini-3-pro-high','claude-sonnet-4-5-thinking','gpt-oss-120b-medium']) {
    const reply = await fetch(base + '/v1/chat/completions',{method:'POST',headers,body:JSON.stringify({model,stream:false,messages:[]})});
    assert.equal(reply.status,200, model);
  }
  assert.equal((await fetch(base + '/v1/other',{headers})).status,404);
});

test('token mới làm mới (iat hơi ở tương lai do đồng hồ máy chậm) vẫn được chấp nhận; lỗi token được giải thích rõ', async () => {
  const part = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Date.now(), seconds = Math.floor(now / 1000);
  const mk = extra => `${part({alg:'RS256',kid:'k'})}.${part({aud:'doi-chieu-gara',iss:'https://securetoken.google.com/doi-chieu-gara',sub:'u',email:'Owner@Example.com',iat:seconds,exp:seconds+3600,...extra})}.sig`;
  // Chữ ký giả nên vẫn bị từ chối, nhưng KHÔNG phải vì iat: mô phỏng lấy chứng chỉ để chắc chắn đã đi qua bước kiểm tra thời gian.
  const realFetch = globalThis.fetch; let certRequests = 0;
  globalThis.fetch = async () => { certRequests++; return new Response('{}', {status:200}); };
  try {
    assert.equal(await verifyFirebaseToken(mk({iat:seconds+30}),'owner@example.com',now), false);
    assert.ok(certRequests > 0, 'iat lệch 30 giây phải đi tới bước kiểm tra chữ ký');
    certRequests = 0;
    assert.equal(await verifyFirebaseToken(mk({iat:seconds+CLOCK_SKEW_SECONDS+60}),'owner@example.com',now), false);
    assert.equal(certRequests, 0, 'iat quá xa bị loại trước khi lấy chứng chỉ');
  } finally { globalThis.fetch = realFetch; }
  assert.match(explainToken(mk({exp:seconds-4000}),'owner@example.com',now), /hết hạn/);
  assert.match(explainToken(mk({iat:seconds+1200}),'owner@example.com',now), /Đồng hồ máy tính/);
  assert.match(explainToken(mk({email:'x@y.z'}),'owner@example.com',now), /khác với tài khoản/);
});

test('chứng chỉ Google tải lỗi thì cầu nối báo 503 rõ nguyên nhân thay vì "không kết nối Antigravity"', async t => {
  const allowedHosts = new Set();
  const server = createBridge({email:'owner@example.com', upstreamKey:'k', allowedHosts, verifyToken: async () => { throw new Error('cert'); }, fetchImpl: async () => new Response('{}')});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  allowedHosts.add(`127.0.0.1:${server.address().port}`);
  t.after(() => server.close());
  const reply = await fetch(`http://127.0.0.1:${server.address().port}/v1/models`,{headers:{host:'127.0.0.1:18318',origin:'https://giam-dinh-xe-rose.vercel.app',authorization:'Bearer x'}});
  assert.equal(reply.status,503);
  assert.match((await reply.json()).error.message,/chứng chỉ/);
});

test('cầu nối thử lại một lần khi kết nối tới CLIProxyAPI bị ngắt, nhưng không thử lại khi đã có mã HTTP', async t => {
  let attempts = 0, mode = 'drop';
  const allowedHosts = new Set();
  const server = createBridge({email:'owner@example.com', upstreamKey:'k', allowedHosts, verifyToken: async () => true,
    fetchImpl: async () => { attempts++; if (mode === 'drop' && attempts === 1) throw new Error('ECONNRESET'); return new Response(mode === 'status' ? '{"error":"quota"}' : '{"ok":true}', {status: mode === 'status' ? 429 : 200}); }});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  allowedHosts.add(`127.0.0.1:${server.address().port}`);
  t.after(() => server.close());
  const call = () => fetch(`http://127.0.0.1:${server.address().port}/v1/chat/completions`,{method:'POST',headers:{host:'127.0.0.1:18318',origin:'https://giam-dinh-xe-rose.vercel.app',authorization:'Bearer x','content-type':'application/json'},body:JSON.stringify({model:'gemini-3-flash',stream:false,messages:[]})});
  assert.equal((await call()).status,200);
  assert.equal(attempts,2);
  mode = 'status'; attempts = 0;
  assert.equal((await call()).status,429);
  assert.equal(attempts,1);
});
