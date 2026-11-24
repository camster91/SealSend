import { defineConfig, devices } from '@playwright/test';

// The local HTTPS harness uses a throwaway certificate. ignoreHTTPSErrors alone lets Chromium
// reject and retry every handshake, which intermittently ends in ERR_TOO_MANY_RETRIES.
const ignoreHttpsErrors = process.env.SEALSEND_E2E_IGNORE_HTTPS_ERRORS === 'true';
const chromiumLaunchOptions = {
  ...(process.env.SEALSEND_BROWSER_EXECUTABLE ? { executablePath: process.env.SEALSEND_BROWSER_EXECUTABLE } : {}),
  ...(ignoreHttpsErrors ? { args: ['--ignore-certificate-errors'] } : {}),
};

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3100',
    ignoreHTTPSErrors: ignoreHttpsErrors,
    trace: 'on-first-retry',
    extraHTTPHeaders: { DNT: '1' },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: chromiumLaunchOptions } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 15'] } },
  ],
  webServer: process.env.NEXT_PUBLIC_SITE_URL
    ? undefined
    : {
        command: 'npm run start:e2e',
        url: 'http://127.0.0.1:3100',
        reuseExistingServer: !process.env.CI,
        timeout: 180000,
      },
});
