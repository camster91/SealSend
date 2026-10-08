/** Runs a local synthetic DB, production web build and browser in one process tree. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import sharp from 'sharp';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:https';
import { request as proxyRequest } from 'node:http';
import { reviewBrowserChecks } from './review-browser-checks.mjs';
import { startSocialQa } from './start-social-qa.ts';
async function main() {
const cwd = process.cwd();
// Concurrent RSVP transactions require native PostgreSQL, not the socket emulator.
process.env.SEALSEND_QA_USE_POSTGRES ??= 'true';
const { db,server } = await startSocialQa();
process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:55432/postgres';
process.env.AI_PROVIDER = 'fake';
process.env.PAYMENTS_TEST_ONLY = 'true';
process.env.COMMUNICATIONS_TEST_ONLY = 'true';
process.env.PORT = '3100';
await import('./start-playwright-server.mjs');
// HTTPS exercises production Secure cookies in both browsers and API clients.
const certDir = await mkdtemp(join(tmpdir(),'sealsend-qa-'));
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(certDir,'key.pem'),'-out',join(certDir,'cert.pem'),'-days','1','-subj','/CN=localhost'],{stdio:'ignore'});
const secureServer = createServer({ key:await readFile(join(certDir,'key.pem')),cert:await readFile(join(certDir,'cert.pem')) },(req,res)=>{
  const upstream = proxyRequest({hostname:'127.0.0.1',port:3100,path:req.url,method:req.method,headers:req.headers},response=>{
    res.writeHead(response.statusCode,response.headers); response.pipe(res);
  });
  upstream.on('error',()=>{ res.writeHead(502);res.end(); }); req.pipe(upstream);
});
await new Promise(resolve=>secureServer.listen(3101,'127.0.0.1',resolve));
const origin = 'https://localhost:3101';
const localApi = 'http://127.0.0.1:3100';
for (let i=0;i<80;i++) {
  try { if ((await fetch(`${localApi}/api/health`)).ok) break; } catch {}
  if (i===79) throw new Error('Local server did not become healthy');
  await new Promise(resolve=>setTimeout(resolve,250));
}
const probe = await fetch(`${localApi}/api/social/social-qa`,{ headers:{ 'X-Guest-Token':'a'.repeat(24) } });
assert.equal(probe.status,200);
const browser = await chromium.launch({ headless:true,...(process.env.SEALSEND_BROWSER_EXECUTABLE ? { executablePath:process.env.SEALSEND_BROWSER_EXECUTABLE } : {}),args:['--no-sandbox','--ignore-certificate-errors','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] });
const eventId = '00000000-0000-4000-8000-000000000011';
const errors = [];
try {
  const host = await browser.newContext({ignoreHTTPSErrors:true});
  await host.addCookies([{ name:'sealsend_session',value:'social-local-host-session',url:origin }]);
  const hostPage = await host.newPage(); hostPage.on('pageerror',e=>errors.push(e.message));
  await reviewBrowserChecks({browser,origin,db,host});
  const failNextRead = async (page,url) => {
    const handler = async route => {
      if (route.request().method() !== 'GET') { await route.continue(); return; }
      await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic refresh outage'})});
      await page.unroute(url,handler);
    };
    await page.route(url,handler);
  };
  await failNextRead(hostPage,`**/api/events/${eventId}/social`);
  await hostPage.goto(`${origin}/events/${eventId}`);
  await hostPage.getByRole('heading',{ name:'Guest activities',exact:true }).waitFor();
  await hostPage.getByRole('button',{name:'Refresh activities',exact:true}).click();
  await hostPage.getByLabel('Reactions and excitement').waitFor();
  await hostPage.getByLabel('Question',{exact:true}).fill('Recovery test poll');
  await hostPage.getByLabel('Options (2–6, one per line)',{exact:true}).fill('Yes\nNo');
  await failNextRead(hostPage,`**/api/events/${eventId}/social`);
  await hostPage.getByRole('button',{name:'Add poll',exact:true}).click();
  await hostPage.getByText('Saved. Refresh activities to see the latest changes.',{exact:true}).waitFor();
  assert.equal(await hostPage.getByLabel('Question',{exact:true}).inputValue(),'');
  await hostPage.getByRole('button',{name:'Refresh activities',exact:true}).click();
  await hostPage.getByRole('heading',{name:'Recovery test poll',exact:true}).waitFor();
  assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM event_social_polls WHERE question = 'Recovery test poll'")).rows[0].count,1);
  const token = 'a'.repeat(24), otherToken = 'b'.repeat(24);
  const ctx = await browser.newContext({ ignoreHTTPSErrors:true,extraHTTPHeaders:{ Origin:origin } });
  const page = await ctx.newPage(); page.on('pageerror',e=>errors.push(e.message)); 
  await failNextRead(page,'**/api/social/social-qa');
  await page.goto(`${origin}/e/social-qa?t=${token}`);
  await page.getByRole('button',{name:'Refresh activities',exact:true}).click();
  await page.getByRole('heading',{name:'Join in',exact:true}).waitFor();
  console.log('PASS initial guest/host loading recovery and saved poll survives failed refresh without duplicate submission');
  for (const width of [375,768,1440]) {
    await page.setViewportSize({ width,height:1000 });
    await page.goto(`${origin}/e/social-qa?t=${token}`);
    await page.getByRole('heading',{ name:'Join in',exact:true }).waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),`overflow ${width}`);
    const axe = await new AxeBuilder({ page }).include('[aria-label="Event activities"]').analyze();
    assert.deepEqual(axe.violations.filter(v=>['serious','critical'].includes(v.impact)),[],`guest accessibility ${width}`);
    await hostPage.setViewportSize({ width,height:1000 });
    const hostAxe = await new AxeBuilder({ page:hostPage }).include('[aria-label="Guest activities"]').analyze();
    assert.deepEqual(hostAxe.violations.filter(v=>['serious','critical'].includes(v.impact)),[],`host accessibility ${width}`);
    assert.ok(await hostPage.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),`host overflow ${width}`);
    console.log(`PASS social guest/host layout and accessibility at ${width}px`);
  }
  await page.getByLabel(/Show my name/).click();
  await page.getByRole('listitem').filter({ hasText:'Invited Guest' }).waitFor();
  await failNextRead(page,'**/api/social/social-qa');
  await page.getByRole('button',{ name:/I'm excited/ }).click();
  await page.getByText('Saved. Refresh activities to see the latest changes.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Refresh activities',exact:true}).click();
  await page.getByRole('button',{ name:/I'm excited · 1/ }).waitFor();
  await page.getByLabel('Fruit').click();
  await page.getByText('1 vote',{ exact:true }).waitFor();
  await page.getByLabel('Crackers').click();
  await page.getByRole('radio',{ name:'Crackers 1 vote',exact:true }).waitFor();
  const votes = await db.query('SELECT COUNT(*)::int AS count FROM event_social_votes');
  assert.equal(votes.rows[0].count,1);
  const png = await sharp({ create:{ width:16,height:16,channels:3,background:'#224466' } }).png().toBuffer();
  await page.getByLabel(/Photo \(JPEG/).setInputFiles({ name:'qa.png',mimeType:'image/png',buffer:png });
  await page.getByLabel('Caption (optional)').fill('Synthetic QA photo');
  await page.getByLabel(/I have permission/).check();
  const uploaded = page.waitForResponse(r=>r.url().endsWith('/api/social/social-qa/photos') && r.request().method()==='POST');
  await failNextRead(page,'**/api/social/social-qa');
  await page.getByRole('button',{ name:'Upload photo',exact:true }).click();
  const uploadResult = await uploaded; assert.equal(uploadResult.status(),201,await uploadResult.text());
  await page.getByText('Uploaded. Refresh activities to see your photo.',{exact:true}).waitFor();
  assert.equal(await page.getByLabel(/Photo \(JPEG/).inputValue(),'');
  assert.equal(await page.getByLabel('Caption (optional)').inputValue(),'');
  assert.equal(await page.getByLabel(/I have permission/).isChecked(),false);
  await page.getByRole('button',{name:'Refresh activities',exact:true}).click();
  await page.getByText('Waiting for host approval',{ exact:true }).waitFor();
  const photo = (await db.query('SELECT id,storage_path FROM event_social_photos')).rows[0];
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM event_social_photos')).rows[0].count,1);
  console.log('PASS confirmed guest save/upload survives failed refresh and upload form resets without a duplicate');
  const publicResponse = await fetch(`${localApi}${photo.storage_path}`); assert.equal(publicResponse.status,404);
  const denied = await fetch(`${localApi}/api/social/social-qa/photos/${photo.id}`); assert.equal(denied.status,404);
  const other = await browser.newContext({ignoreHTTPSErrors:true});
  const otherPage = await other.newPage();
  await otherPage.goto(`${origin}/e/social-qa?t=${otherToken}`);
  await otherPage.getByRole('heading',{ name:'Join in',exact:true }).waitFor();
  assert.equal(await otherPage.getByText('Synthetic QA photo',{ exact:true }).count(),0);
  await host.addCookies([{name:`sealsend_social_${eventId}`,value:otherToken,domain:'localhost',path:'/api/social/social-qa',httpOnly:true,secure:true,sameSite:'Strict'}]);
  assert.equal((await host.request.get(`${origin}/api/social/social-qa/photos/${photo.id}`)).status(),200);
  await hostPage.reload();
  await hostPage.getByRole('button',{ name:'Approve photo',exact:true }).click();
  await hostPage.getByText('Synthetic QA photo · Shared',{ exact:true }).waitFor();
  const approvedState = await other.request.get(`${origin}/api/social/social-qa`, { headers: { 'X-Guest-Token': otherToken } });
  assert.equal(approvedState.status(), 200, await approvedState.text());
  assert.ok((await approvedState.json()).photos.some(item => item.id === photo.id && item.approved), 'Approved photo must be visible to another invited guest');
  await otherPage.reload(); await otherPage.getByText('Synthetic QA photo',{ exact:true }).waitFor();
  assert.equal((await other.request.get(`${origin}/api/social/social-qa/photos/${photo.id}`,{headers:{'X-Guest-Token':otherToken}})).status(),200);
  await otherPage.locator(`img[src$="/${photo.id}"]`).evaluate(img => { if (!img.complete || !img.naturalWidth) throw new Error('Approved album image did not load with the guest cookie'); });
  await page.getByRole('button',{ name:'Remove my photo',exact:true }).click();
  await page.getByRole('alertdialog').getByRole('button',{name:'Remove photo',exact:true}).click();
  await page.getByText('Photo removed.',{ exact:true }).waitFor();
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM event_social_photos')).rows[0].count,0);
  console.log('PASS guest opt-in, reactions, changeable single vote, private upload, moderation and removal');
  for (const deletingEvent of [false,true]) {
    const invite = deletingEvent ? otherToken : token;
    const uploaded = await ctx.request.post(`${origin}/api/social/social-qa/photos`,{headers:{Origin:origin,'X-Guest-Token':invite},multipart:{file:{name:'cascade.png',mimeType:'image/png',buffer:png},permission:'yes',caption:'Cascade QA'}});
    assert.equal(uploaded.status(),201,await uploaded.text());
    const asset = (await db.query('SELECT storage_path FROM event_social_photos')).rows[0].storage_path;
    const file = join(process.cwd(),asset.slice(1));
    await readFile(file);
    const endpoint = deletingEvent ? `/api/events/${eventId}` : `/api/events/${eventId}/guests/00000000-0000-4000-8000-000000000012`;
    assert.equal((await host.request.delete(`${origin}${endpoint}`,{headers:{Origin:origin}})).status(),200);
    await assert.rejects(readFile(file),{code:'ENOENT'});
    assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM upload_assets')).rows[0].count,0);
    assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM event_social_file_cleanup')).rows[0].count,0);
    if (!deletingEvent) {
      await page.getByRole('button',{name:/I'm excited/}).click();
      await page.getByText('Open your personal invitation to join in.',{exact:true}).waitFor();
      assert.equal(await page.getByRole('heading',{name:'Join in',exact:true}).count(),0);
    }
  }
  console.log('PASS guest/event deletion erases private files and releases quota with orphan cleanup disabled');
  await page.goto(`${origin}/install`);
  await page.getByRole('heading',{ name:'SealSend on your phone',exact:true }).waitFor();
  await page.evaluate(async()=>{ await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Service worker did not become ready')),15000))]); });
  await ctx.setOffline(true);
  await page.goto(`${origin}/events/offline-check`);
  await page.getByRole('heading',{ name:'You’re offline',exact:true }).waitFor();
  await ctx.setOffline(false);
  assert.deepEqual(errors,[]);
  console.log('PASS installation guide and generic offline fallback; no browser runtime errors');
  process.chdir(cwd);
  if (process.env.SEALSEND_QA_BUILDER === 'true') {
    for (const suite of ['live-builder.spec.ts','live-templates.spec.ts']) {
    await db.query("DELETE FROM rate_limit_attempts WHERE key LIKE 'login-password:%'");
    const code = await new Promise(resolve => {
      const child = spawn(process.execPath,['node_modules/@playwright/test/cli.js','test',suite,'--project=chromium','--workers=1'],{
        cwd,stdio:'inherit',env:{ ...process.env,NEXT_PUBLIC_SITE_URL:origin,SEALSEND_E2E_IGNORE_HTTPS_ERRORS:'true',SEALSEND_TEMPLATE_EMAIL:'builder-qa@example.test',SEALSEND_TEMPLATE_PASSWORD:'Local-QA-only-Password-42' }
      });
      child.on('error',()=>resolve(1)); child.on('exit',resolve);
    });
    assert.equal(code,0,`Authenticated ${suite} browser checks`);
    }
  }
} catch (error) { console.error("Browser QA failure:", error); throw error; } finally { await browser.close(); secureServer.closeAllConnections(); await server.stop(); await db.close(); await new Promise(resolve=>secureServer.close(resolve)); await rm(certDir,{recursive:true,force:true}); }
process.exit(0);

}
void main().catch(error => { console.error(error); process.exit(1); });
