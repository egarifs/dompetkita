import { createBrowserTest } from './helpers/browser-test.mjs';

const { page, close, baseUrl } = await createBrowserTest({ disableCloud: true });
const out = [];
const errors = [];
const dialogs = [];
page.on('pageerror', e => errors.push(`pageerror:${String(e)}`));
page.on('console', msg => { if (msg.type() === 'error') errors.push(`console:${msg.text()}`); });
page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });

async function login() {
  await page.fill('#loginUsername', 'admin@keuangan.local');
  await page.fill('#loginPassword', 'admin123');
  await page.click('#loginForm button[type="submit"]');
  await page.waitForSelector('#appShell:not(.hidden)', { timeout: 10000 });
  if (await page.locator('#modal.open').isVisible()) {
    await page.click('#closeModalButton');
    await page.waitForFunction(() => !document.querySelector('#modal')?.classList.contains('open'), null, { timeout: 10000 });
  }
}

await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.click('#continueToLoginButton');
await page.waitForSelector('#authScreen:not(.hidden)', { timeout: 10000 });
out.push('visible:auth');

await login();
out.push('login:first');

await page.evaluate(() => {
  const key = window.AppConstants.storageKey;
  const now = new Date().toISOString();
  const snapshot = {
    transactions: [],
    budgets: [],
    debts: [],
    savings: [],
    billReminders: [],
    recurring: [],
    vehicles: [],
    vehicleServices: [],
    vehicleOilChanges: [],
    vehicleParts: [],
    vehicleTaxes: [],
    categories: window.AppConstants.defaultCategories,
    wallets: [{ id: 'wallet-relogin', name: 'Dompet Relogin', initialBalance: 100000, currentBalance: 100000, type: 'Cash', createdAt: now, updatedAt: now }],
    deleted: { transactions: [], debts: [], budgets: [], savings: [], billReminders: [], recurring: [], wallets: [], vehicles: [], vehicleServices: [], vehicleOilChanges: [], vehicleParts: [], vehicleTaxes: [], familyMembers: [] },
    settings: { language: 'id', cloudSyncEnabled: true },
    syncStatus: 'synced',
    localChangedAt: now,
  };
  localStorage.setItem(key, JSON.stringify(snapshot));
});
out.push('wallet:snapshot:saved');

await page.click('[data-view="account"]');
await page.waitForSelector('#accountView.active', { timeout: 10000 });
await page.click('#logoutButton');
await page.waitForSelector('#authScreen:not(.hidden)', { timeout: 10000 });
out.push('logout');

await login();
out.push('login:second');

const homeWalletText = await page.textContent('#homeWalletList');
if (!homeWalletText?.includes('Dompet Relogin')) {
  throw new Error('Dompet dari local storage tidak tampil setelah logout dan login kembali.');
}
out.push('wallet:restored-after-relogin');

await close();

console.log(JSON.stringify({ out, dialogs, errors }, null, 2));
if (errors.length) throw new Error(errors.join('\n'));
