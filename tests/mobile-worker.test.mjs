import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
const source = await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
function worker(fetch) {
  const handlers = {}, writes = [];
  const offline = new Response('Reconnect',{ headers:{ 'Content-Type':'text/html' } });
  runInNewContext(source, { URL,Response,fetch,self:{ skipWaiting:async()=>{},location:{ origin:'https://sealsend.app' },clients:{ claim:async()=>{} },addEventListener:(name,fn)=>handlers[name]=fn },caches:{ open:async()=>({ addAll:async urls=>writes.push(...urls) }),keys:async()=>[],match:async()=>offline } });
  return { handlers,writes };
}
test('worker stores only generic offline HTML, never authenticated responses', async()=>{
  const { handlers,writes } = worker(async()=>new Response('private'));
  let work;
  handlers.install({ waitUntil:p=>work=p }); await work;
  assert.deepEqual(writes,['/offline.html']);
  let response;
  handlers.fetch({ request:{ method:'GET',mode:'navigate',url:'https://sealsend.app/e/private?t=secret' },respondWith:p=>response=p });
  assert.equal(await (await response).text(),'private');
  assert.deepEqual(writes,['/offline.html']);
});
test('worker leaves API calls untouched and returns generic content on failed navigation',async()=>{
  const { handlers } = worker(async()=>{ throw new Error('offline'); });
  handlers.fetch({ request:{ method:'GET',mode:'cors',url:'https://sealsend.app/api/social/event' },respondWith:()=>assert.fail('API intercepted') });
  let response;
  handlers.fetch({ request:{ method:'GET',mode:'navigate',url:'https://sealsend.app/events/private' },respondWith:p=>response=p });
  assert.equal(await (await response).text(),'Reconnect');
});
