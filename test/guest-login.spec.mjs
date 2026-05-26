import { createBrowserTest } from './helpers/browser-test.mjs';

const { page, close, baseUrl } = await createBrowserTest({ disableCloud: true });
const out = [];
const errors = [];
const dialogs = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });

await page.goto(baseUrl, { waitUntil: 'networkidle' });
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

const role = (await page.textContent('#profileRole'))?.trim() || '';
out.push(`profileRole:${role}`);

await page.screenshot({ path: 'test/artifacts/guest-login.spec.png', fullPage: true });
await close();

console.log(JSON.stringify({ out, dialogs, errors, screenshot: 'test/artifacts/guest-login.spec.png' }, null, 2));
