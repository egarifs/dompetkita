import { createBrowserTest } from './helpers/browser-test.mjs';

const out = [];
const errors = [];
const { browser, page, baseUrl, close } = await createBrowserTest({ disableCloud: true });

page.on('pageerror', e => errors.push(`pageerror:${String(e)}`));
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(`console:${msg.text()}`);
});

const dialogs = [];
page.on('dialog', async d => {
  dialogs.push(d.message());
  await d.accept();
});

let failed = null;
try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  out.push('loaded:index');

  await page.click('#continueToLoginButton');
  await page.waitForSelector('#authScreen:not(.hidden)');
  out.push('visible:authScreen');

  await page.fill('#loginUsername', 'admin@keuangan.local');
  await page.fill('#loginPassword', 'admin123');
  await page.click('#loginForm button[type="submit"]');
  await page.waitForSelector('#appShell:not(.hidden)', { timeout: 10000 });
  out.push('login:admin:success');

  if (await page.locator('#modal.open').isVisible()) {
    await page.click('#closeModalButton');
    await page.waitForFunction(() => !document.querySelector('#modal')?.classList.contains('open'), null, { timeout: 10000 });
    out.push('wallet-onboarding:closed');
  }

  await page.locator('.sidebar [data-view="account"]').click();
  await page.waitForSelector('#accountView.active', { timeout: 10000 });
  out.push('view:account:success');

  const syncBefore = (await page.textContent('#syncStatus'))?.trim() || '';
  out.push(`syncStatusBefore:${syncBefore}`);

  const localSyncDisabled = await page.locator('#syncNowButton').isDisabled();
  if (!localSyncDisabled) throw new Error('Sync button should be disabled when cloud config is disabled.');
  out.push(`syncNowDisabledLocal:${localSyncDisabled}`);

  await page.click('#logoutButton');
  await page.waitForSelector('#authScreen:not(.hidden)', { timeout: 10000 });
  out.push('logout:success');

  await page.click('#guestLoginButton');
  await page.waitForSelector('#appShell:not(.hidden)', { timeout: 10000 });
  out.push('login:guest:success');

  await page.click('[data-view="account"]');
  await page.waitForSelector('#accountView.active', { timeout: 10000 });
  out.push('view:account:guest');

  const guestSyncDisabled = await page.locator('#syncNowButton').isDisabled();
  out.push(`syncNowDisabledGuest:${guestSyncDisabled}`);

  const syncAfterGuest = (await page.textContent('#syncStatus'))?.trim() || '';
  out.push(`syncStatusGuest:${syncAfterGuest}`);
} catch (e) {
  failed = e;
  out.push(`exception:${String(e)}`);
}

await page.screenshot({ path: 'test/artifacts/auth-flow.spec.png', fullPage: true });
await close();

console.log(JSON.stringify({ out, dialogs, errors, screenshot: 'test/artifacts/auth-flow.spec.png' }, null, 2));
if (failed) throw failed;
if (errors.length) throw new Error(errors.join('\n'));
