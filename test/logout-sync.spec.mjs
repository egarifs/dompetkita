import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const out = [];
const errors = [];
const dialogs = [];

page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('dialog', async (d) => {
  dialogs.push(d.message());
  await d.accept();
});

await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'networkidle' });
out.push('loaded:index');

await page.click('#skipSplashButton');
await page.waitForSelector('#authScreen:not(.hidden)', { timeout: 10000 });
out.push('visible:auth');

await page.click('#guestLoginButton');
await page.waitForSelector('#appShell:not(.hidden)', { timeout: 10000 });
out.push('guest:login:success');

await page.click('[data-view="account"]');
await page.waitForSelector('#accountView.active', { timeout: 10000 });
out.push('view:account:success');

await page.click('#syncNowButton');
await page.waitForTimeout(800);
const syncStatus = (await page.textContent('#syncStatusText'))?.trim() || '';
out.push(`syncStatus:${syncStatus}`);

await page.click('#logoutButton');
await page.waitForSelector('#authScreen:not(.hidden)', { timeout: 10000 });
out.push('logout:auth-visible');

const appShellHidden = await page.locator('#appShell').evaluate((el) => el.classList.contains('hidden'));
out.push(`appShellHidden:${appShellHidden}`);

await page.screenshot({ path: 'test/artifacts/logout-sync.spec.png', fullPage: true });
await browser.close();

console.log(JSON.stringify({ out, dialogs, errors, screenshot: 'test/artifacts/logout-sync.spec.png' }, null, 2));
