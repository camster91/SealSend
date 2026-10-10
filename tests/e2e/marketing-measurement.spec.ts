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
    await page.route('**/api/auth/send-code', route => route.fulfill({json:{success:true,message:'Fixture only'}}));
    await page.route('**/api/auth/verify-code', async route => {
      expect(route.request().postDataJSON()).toMatchObject({channel:'email',method:'email'});
      expect(route.request().postData()).not.toContain('private-person');
      await route.fulfill({status:400,json:{success:false,error:'Fixture verification stopped'}});
    });
    await page.getByLabel('Email', {exact:true}).fill('synthetic-marketing@example.test');
    await page.getByRole('button', {name:/email my sign-in code/i}).click();
    await page.getByLabel(/verification code/i).fill('123456');
    await page.getByRole('button', {name:/verify|create account/i}).click();
    await expect(page.getByText('Fixture verification stopped')).toBeVisible();
  });
});

test('privacy opt-out produces ordinary signup links', async ({page}) => {
  await page.goto('/?utm_medium=email');
  await expect(page.getByRole('link', {name:'Create a free event',exact:true}).first()).toHaveAttribute('href', '/signup');
});
