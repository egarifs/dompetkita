import { createBrowserTest } from './helpers/browser-test.mjs';

const { page, close, baseUrl } = await createBrowserTest({ disableCloud: true });
const out = [];
const dialogs = [];
const errors = [];
page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
page.on('pageerror', e => errors.push(String(e)));

await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.click('#skipSplashButton');
await page.waitForSelector('#authScreen:not(.hidden)');
await page.click('#guestLoginButton');
await page.waitForSelector('#appShell:not(.hidden)');
await page.click('[data-view="account"]');
await page.waitForSelector('#accountView.active');
const syncDisabled = await page.locator('#syncNowButton').isDisabled();
const syncStatus = (await page.textContent('#syncStatus'))?.trim() || '';
if (!syncDisabled) throw new Error('Sync button should be disabled for guest mode.');
if (!syncStatus.includes('Mode tamu')) throw new Error('Guest sync status should explain guest mode.');
out.push('guest-sync-disabled');
out.push(`syncStatus:${syncStatus}`);
await close();
console.log(JSON.stringify({ out, dialogs, errors }, null, 2));
