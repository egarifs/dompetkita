import os from "node:os";
import path from "node:path";
import { createBrowserTest } from "./helpers/browser-test.mjs";

const out = [];
const dialogs = [];
const errors = [];
const screenshot = path.join(os.tmpdir(), "dompify-delete-account.png");
const { page, baseUrl, close } = await createBrowserTest({ disableCloud: true });

page.on("pageerror", (error) => errors.push(`pageerror:${String(error)}`));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console:${message.text()}`);
});
page.on("dialog", async (dialog) => {
  dialogs.push(dialog.message());
  await dialog.accept();
});

await page.addInitScript(() => {
  localStorage.setItem("finance-tracker-v2", JSON.stringify({
    transactions: [],
    budgets: [],
    debts: [],
    wallets: [{ id: "wallet-delete-ui", name: "Dompet Hapus", initialBalance: 100000, currentBalance: 100000 }],
    categories: ["Lainnya"],
    settings: {},
  }));
});

let failed = null;
try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.click("#skipSplashButton");
  await page.fill("#loginUsername", "user@keuangan.local");
  await page.fill("#loginPassword", "user123");
  await page.check("#rememberLogin");
  await page.click('#loginForm button[type="submit"]');
  await page.waitForSelector("#appShell:not(.hidden)", { timeout: 10000 });
  out.push("login:user");
  if (await page.locator("#modal.open").isVisible()) {
    await page.click("#closeModalButton");
    await page.waitForFunction(() => !document.querySelector("#modal")?.classList.contains("open"), null, { timeout: 10000 });
  }

  await page.click('[data-view="account"]');
  await page.waitForSelector("#accountView.active", { timeout: 10000 });
  await page.click("#deleteAccountButton");
  await page.waitForSelector("#authScreen:not(.hidden)", { timeout: 10000 });
  out.push("delete-account:auth-visible");

  const localState = await page.evaluate(() => ({
    deletedAccounts: JSON.parse(localStorage.getItem("finance-tracker-deleted-accounts-v1") || "[]"),
    rememberedLogin: localStorage.getItem("finance-tracker-remembered-login-v1"),
    session: localStorage.getItem("finance-tracker-session-v1"),
    snapshot: localStorage.getItem("finance-tracker-v2"),
    users: JSON.parse(localStorage.getItem("finance-tracker-users-v1") || "[]"),
  }));
  if (!localState.deletedAccounts.includes("user@keuangan.local")) throw new Error("Deleted account tombstone was not stored.");
  if (localState.users.some((user) => user.username === "user@keuangan.local")) throw new Error("Deleted user credentials remain in local storage.");
  if (localState.rememberedLogin !== null || localState.session !== null || localState.snapshot !== null) {
    throw new Error("Deleted account local data was not fully cleared.");
  }
  out.push("delete-account:local-storage-cleared");

  await page.fill("#loginUsername", "user@keuangan.local");
  await page.fill("#loginPassword", "user123");
  await page.click('#loginForm button[type="submit"]');
  const appShellHidden = await page.locator("#appShell").evaluate((element) => element.classList.contains("hidden"));
  if (!appShellHidden) throw new Error("Deleted account can still log in.");
  out.push("delete-account:login-blocked");
  await page.screenshot({ path: screenshot, fullPage: false });
} catch (error) {
  failed = error;
  out.push(`exception:${String(error)}`);
} finally {
  await close();
}

console.log(JSON.stringify({ out, dialogs, errors, screenshot }, null, 2));
if (failed) throw failed;
if (errors.length) throw new Error(errors.join("\n"));
