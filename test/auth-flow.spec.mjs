import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173/index.html';
const out = [];
const errors = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('pageerror', e => errors.push(`pageerror:${String(e)}`));
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(`console:${msg.text()}`);
});

const dialogs = [];
page.on('dialog', async d => {
  dialogs.push(d.message());
  await d.accept();
});

try {
  await page.goto(base, { waitUntil: 'networkidle' });
  out.push('loaded:index');

  await page.click('#continueToLoginButton');
  await page.waitForSelector('#authScreen:not(.hidden)');
  out.push('visible:authScreen');

  await page.fill('#loginUsername', 'admin@keuangan.local');
  await page.fill('#loginPassword', 'admin123');
  await page.click('#loginForm button[type="submit"]');
  await page.waitForSelector('#appShell:not(.hidden)', { timeout: 10000 });
  out.push('login:admin:success');

  await page.click('[data-view="account"]');
  await page.waitForSelector('#accountView.active', { timeout: 10000 });
  out.push('view:account:success');

  const syncBefore = (await page.textContent('#syncStatus'))?.trim() || '';
  out.push(`syncStatusBefore:${syncBefore}`);

  await page.click('#syncNowButton');
  await page.waitForTimeout(1000);
  out.push('click:syncNow');

  await page.click('#logoutButton');
  await page.waitForSelector('#authScreen:not(.hidden)', { timeout: 10000 });
  out.push('logout:success');

  await page.click('#guestLoginButton');
  await page.waitForSelector('#appShell:not(.hidden)', { timeout: 10000 });
  out.push('login:guest:success');

  await page.click('[data-view="account"]');
  await page.waitForSelector('#accountView.active', { timeout: 10000 });
  out.push('view:account:guest');

  await page.click('#syncNowButton');
  await page.waitForTimeout(1000);
  out.push('click:syncNow:guest');

  const syncAfterGuest = (await page.textContent('#syncStatus'))?.trim() || '';
  out.push(`syncStatusGuest:${syncAfterGuest}`);
} catch (e) {
  out.push(`exception:${String(e)}`);
}

await page.screenshot({ path: 'test/artifacts/auth-flow.spec.png', fullPage: true });
await browser.close();

console.log(JSON.stringify({ out, dialogs, errors, screenshot: 'test/artifacts/auth-flow.spec.png' }, null, 2));
