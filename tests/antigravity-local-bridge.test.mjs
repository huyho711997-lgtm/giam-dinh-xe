import test from 'node:test';
import assert from 'node:assert/strict';
import {createBridge, verifyFirebaseToken} from '../scripts/antigravity-local-bridge.mjs';

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
  assert.equal((await fetch(url,{method:'POST',headers,body:JSON.stringify({model:'other',stream:false})})).status,400);
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
