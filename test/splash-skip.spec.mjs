import { createBrowserTest } from './helpers/browser-test.mjs';

const { page, close, baseUrl } = await createBrowserTest({ disableCloud: true });
const out = [];
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(baseUrl, { waitUntil: 'networkidle' });
out.push('loaded');
await page.click('#skipSplashButton');
await page.waitForSelector('#authScreen:not(.hidden)', { timeout: 10000 });
out.push('skip->auth-visible');
await page.screenshot({ path: 'test/artifacts/splash-skip.spec.png', fullPage: true });
await close();
console.log(JSON.stringify({ out, errors, screenshot: 'test/artifacts/splash-skip.spec.png' }, null, 2));
