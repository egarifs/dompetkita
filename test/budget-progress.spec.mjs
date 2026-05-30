import os from "node:os";
import path from "node:path";
import { createBrowserTest } from "./helpers/browser-test.mjs";

const out = [];
const errors = [];
const screenshot = path.join(os.tmpdir(), "dompify-budget-progress.png");
const mobileScreenshot = path.join(os.tmpdir(), "dompify-budget-progress-mobile.png");
const { page, baseUrl, close } = await createBrowserTest({ disableCloud: true });

page.on("pageerror", (error) => errors.push(`pageerror:${String(error)}`));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console:${message.text()}`);
});

await page.addInitScript(() => {
  localStorage.setItem("finance-tracker-v2", JSON.stringify({
    transactions: [
      { id: "transaction-progress-food", date: "2026-05-10", type: "expense", category: "Makanan", amount: 950000, description: "Belanja bulanan", walletId: "wallet-progress" },
    ],
    budgets: [
      { id: "budget-progress-food", name: "Makanan", category: "Makanan", type: "expense", parentId: null, budgetLimit: 1000000, limit: 1000000, period: "monthly", isActive: true },
    ],
    debts: [],
    wallets: [
      { id: "wallet-progress", name: "Dompet Progress", initialBalance: 2000000, currentBalance: 2000000, isActive: true },
    ],
    categories: ["Makanan", "Lainnya"],
    settings: {},
  }));
});

let failed = null;
try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.click("#continueToLoginButton");
  await page.fill("#loginUsername", "admin@keuangan.local");
  await page.fill("#loginPassword", "admin123");
  await page.click('#loginForm button[type="submit"]');
  await page.waitForSelector("#appShell:not(.hidden)", { timeout: 10000 });
  if (await page.locator("#modal.open").isVisible()) {
    await page.click("#closeModalButton");
    await page.waitForFunction(() => !document.querySelector("#modal")?.classList.contains("open"), null, { timeout: 10000 });
  }

  await page.click('[data-view="finance"]');
  await page.waitForSelector("#financeView.active", { timeout: 10000 });
  await page.click('[data-view="analytics"]');
  await page.waitForSelector("#analyticsView.active", { timeout: 10000 });
  await page.selectOption("#budgetProgressMonth", "05");
  await page.selectOption("#budgetProgressYear", "2026");

  const rowText = (await page.locator('[data-budget-progress-id="budget-progress-food"]').innerText()).replace(/\s+/g, " ");
  if (!rowText.includes("Makanan") || !rowText.includes("950.000") || !rowText.includes("95%") || !rowText.includes("Hampir Habis")) {
    throw new Error(`Budget progress row is incomplete: ${rowText}`);
  }
  const summaryText = (await page.locator("#budgetProgressSummary").innerText()).replace(/\s+/g, " ");
  if (!summaryText.includes("1.000.000") || !summaryText.includes("950.000") || !summaryText.includes("50.000")) {
    throw new Error(`Budget progress summary is incomplete: ${summaryText}`);
  }
  out.push("budget-progress:rendered");
  await page.screenshot({ path: screenshot, fullPage: false });

  await page.click('[data-budget-progress-id="budget-progress-food"]');
  await page.waitForSelector("#modal.open", { timeout: 10000 });
  const modalText = await page.locator("#modalBody").innerText();
  if (!modalText.includes("Belanja bulanan") || !modalText.includes("Dompet Progress")) {
    throw new Error(`Budget transaction detail is incomplete: ${modalText}`);
  }
  out.push("budget-progress:transaction-detail");

  await page.click("#closeModalButton");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: mobileScreenshot, fullPage: false });
  if (!await page.locator('[data-budget-progress-id="budget-progress-food"]').isVisible()) {
    throw new Error("Budget progress row is not visible on mobile.");
  }
  out.push("budget-progress:mobile-visible");
} catch (error) {
  failed = error;
  out.push(`exception:${String(error)}`);
} finally {
  await close();
}

console.log(JSON.stringify({ out, errors, screenshot, mobileScreenshot }, null, 2));
if (failed) throw failed;
if (errors.length) throw new Error(errors.join("\n"));
