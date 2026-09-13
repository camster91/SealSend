// Coverage for issue #149: the Pro CTA must never dead-end, and must never
// expose internal billing state to customers.
//
// Two states are asserted:
//   billing-unavailable -> a waitlist path must exist (not a disabled button)
//   billing-ready       -> the checkout path must be the active CTA
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const cardsSrc = readFileSync(path.join(root, 'src/components/pricing/PricingCards.tsx'), 'utf8');
const waitlistSrc = readFileSync(path.join(root, 'src/components/pricing/ProWaitlistForm.tsx'), 'utf8');
const routeSrc = readFileSync(path.join(root, 'src/app/api/waitlist/route.ts'), 'utf8');

test('pricing never exposes internal test-state wording to customers', () => {
  assert.doesNotMatch(
    cardsSrc,
    /Test billing setup pending/,
    'the internal "Test billing setup pending" string must not appear in customer-facing pricing UI'
  );
  assert.doesNotMatch(
    cardsSrc,
    /disabled\s+className=[^>]*>\s*Test billing/,
    'the dead-end disabled Pro button must not exist'
  );
});

test('billing-unavailable state renders a working waitlist path', () => {
  assert.match(
    cardsSrc,
    /!annualCheckoutAvailable\s*\?\s*\(\s*<ProWaitlistForm/,
    'when checkout is unavailable the Pro card must render the waitlist form'
  );
  assert.match(waitlistSrc, /\/api\/waitlist/, 'waitlist form must post to the real endpoint');
  assert.match(waitlistSrc, /type="email"/, 'waitlist form must collect an email');
  assert.match(waitlistSrc, /role="status"|role="alert"/, 'waitlist form must expose an accessible status/error');
});

test('billing-ready state keeps the checkout CTA', () => {
  assert.match(
    cardsSrc,
    /plan\.id === "pro_annual"\s*&&\s*isAuthenticated\s*\?/,
    'checkout path must remain gated on auth (availability handled by the prior branch)'
  );
  assert.match(cardsSrc, /startAnnualProCheckout/, 'checkout handler must still be wired');
});

test('waitlist endpoint validates input and is rate limited', () => {
  assert.match(routeSrc, /z\.string\(\)\.trim\(\)\.email\(\)/, 'must validate email');
  assert.match(routeSrc, /\.strict\(\)/, 'must reject unknown fields');
  assert.match(routeSrc, /rateLimit\(/, 'must be rate limited');
  assert.match(routeSrc, /ON CONFLICT/, 'must be idempotent for repeat submissions');
});
