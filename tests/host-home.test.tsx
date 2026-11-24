import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { loginMethods } from '../src/lib/auth/login-methods';

const read = (file: string) => readFileSync(file, 'utf8');

test('hosts are only offered sign-in methods that can work', () => {
  assert.deepEqual(loginMethods({ emailEnabled: false, smsEnabled: false }), ['password']);
  assert.deepEqual(loginMethods({ emailEnabled: true, smsEnabled: false }), ['email', 'password']);
  assert.deepEqual(loginMethods({ emailEnabled: true, smsEnabled: true }), ['email', 'password', 'phone']);
  assert.deepEqual(loginMethods({ emailEnabled: false, smsEnabled: true }), ['password', 'phone']);
});

test('sign-in speaks to hosts, not administrators', () => {
  const form = read('src/components/auth/EnhancedLoginForm.tsx');
  assert.doesNotMatch(form, /Admin password|for administrators|admin@example\.com/);
  assert.match(read('src/app/(auth)/login/page.tsx'), /emailEnabled=\{/);
});

test('password recovery offers help when codes cannot be sent', () => {
  const page = read('src/app/(auth)/forgot-password/page.tsx');
  assert.match(page, /isEmailConfigured\(\)/);
  assert.match(page, /\/support/);
});

test('the dashboard puts events before guides and usage', () => {
  const page = read('src/app/(dashboard)/dashboard/page.tsx');
  const order = ['id="my-events-list"', '<OnboardingChecklist', '<UsageStats'].map((part) => page.indexOf(part));
  assert.ok(order.every((index) => index > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.doesNotMatch(page, /WelcomeTour|Total events|Welcome back/);
  assert.match(page, /Your events/);
});
