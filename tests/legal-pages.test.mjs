import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8');

test('terms name the operator, address, governing law and licence', async () => {
  const terms = await read('src/app/(marketing)/terms/page.tsx');
  assert.match(terms, /Ashbi Design|SENDER_LEGAL_NAME/);
  assert.match(terms, /SENDER_POSTAL_ADDRESS/);
  const legal = await read('src/lib/legal.ts');
  assert.match(legal, /Ashbi Design/);
  assert.match(legal, /95 Ellesmere Road Suite 1006/);
  assert.match(terms, /Ontario/);
  assert.match(terms, /AGPL/);
  assert.match(terms, /Last updated: October 6, 2026/);
  assert.doesNotMatch(terms, /money-back/i);
  assert.doesNotMatch(terms, /remain our property/i);
  assert.doesNotMatch(terms, /Seal and Send/);
});

test('privacy names providers, cookies, retention and the complaint route', async () => {
  const p = await read('src/app/(marketing)/privacy/page.tsx');
  for (const s of ['Mailgun', 'OpenAI', 'Stripe', 'Hostinger', 'Cloudflare', 'Twilio', 'United States',
    'sealsend_session', 'sealsend_user', '30 days', 'Privacy Commissioner', 'Cameron Ashley', 'SENDER_POSTAL_ADDRESS',
    'Last updated: October 10, 2026']) {
    assert.ok(p.includes(s), `privacy must mention ${s}`);
  }
  assert.doesNotMatch(p, /encryption[^.]*at rest/i);
});

test('support, pricing FAQ and use cases drop stale approval-gate claims', async () => {
  const support = await read('src/app/(marketing)/support/page.tsx');
  const faq = await read('src/components/pricing/PricingFAQ.tsx');
  const uc = await read('src/lib/use-case-content.ts');
  assert.doesNotMatch(support, /separate test, compliance, and approval gates/);
  assert.match(support, /free beta/i);
  assert.doesNotMatch(faq, /Provider delivery is verified with each approved beta host/);
  assert.doesNotMatch(uc, /completes provider, compliance, accessibility, and real-event launch evidence/);
  assert.doesNotMatch(uc, /controlled beta/i);
});

test('sign-up form shows the terms line with links', async () => {
  const f = await read('src/components/auth/SignupForm.tsx');
  assert.match(f, /By creating an account you agree to the/);
  assert.match(f, /href="\/terms"/);
  assert.match(f, /href="\/privacy"/);
});

test('no stale money-back, gate or controlled-beta wording in public copy', async () => {
  const { execSync } = await import('node:child_process');
  const grep = (re) => { try { return execSync(`git grep -n -i -E "${re}" -- src`, { encoding: 'utf8' }); } catch { return ''; } };
  assert.equal(grep('money-back'), '');
  assert.equal(grep('consented beta host'), '');
  const privacy = await read('src/app/(marketing)/privacy/page.tsx');
  assert.match(privacy, /feedback/i);
  assert.match(privacy, /waitlist/i);
  for (const p of ['src/app/(marketing)/pricing/page.tsx', 'src/components/pricing/PricingCTA.tsx', 'src/components/pricing/PricingCards.tsx', 'src/components/pricing/PricingFAQ.tsx']) {
    assert.doesNotMatch(await read(p), /controlled beta/i, p);
  }
});
