import { test, expect } from '@playwright/test';

test.describe('anonymous marketing attribution', () => {
  // API fixtures must intercept the network rather than a service-worker controlled request.
  test.use({ serviceWorkers: 'block', extraHTTPHeaders: { DNT: '0' }, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' });
  test('broad channel survives marketing navigation and signup verification', async ({ page }) => {
    await page.goto('/?utm_medium=email&utm_source=private-person@example.test');
    await expect(page.getByRole('link', {name:'Create a free event',exact:true}).first()).toHaveAttribute('href', '/signup?source=email');
    await page.getByRole('link', {name:'How it works',exact:true}).first().click();
    await expect(page.getByRole('link', {name:'Create a free event',exact:true}).first()).toHaveAttribute('href', '/signup?source=email');
    await page.getByRole('link', {name:'Create a free event',exact:true}).first().click();
    await expect(page).toHaveURL(/\/signup\?source=email$/);
    // The QA server has no email provider, so sign-up uses a password.
    await page.route('**/api/auth/signup-password', async route => {
      expect(route.request().postDataJSON()).toMatchObject({channel:'email'});
      expect(route.request().postData()).not.toContain('private-person');
      await route.fulfill({status:400,json:{success:false,error:'Fixture sign-up stopped'}});
    });
    await page.getByLabel('Email', {exact:true}).fill('synthetic-marketing@example.test');
    await page.getByLabel('Password', {exact:true}).fill('fixture-password-1');
    await page.getByRole('button', {name:'Create account'}).click();
    await expect(page.getByText('Fixture sign-up stopped')).toBeVisible();
  });
});

test('privacy opt-out produces ordinary signup links', async ({page}) => {
  await page.goto('/?utm_medium=email');
  await expect(page.getByRole('link', {name:'Create a free event',exact:true}).first()).toHaveAttribute('href', '/signup');
});
