import os from "node:os";
import path from "node:path";
import { createBrowserTest } from "./helpers/browser-test.mjs";

const out = [];
const errors = [];
const screenshot = path.join(os.tmpdir(), "dompify-category-hierarchy.png");
const { page, baseUrl, close } = await createBrowserTest({ disableCloud: true });

page.on("pageerror", (error) => errors.push(`pageerror:${String(error)}`));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console:${message.text()}`);
});

await page.addInitScript(() => {
  localStorage.setItem("finance-tracker-v2", JSON.stringify({
    transactions: [],
    budgets: [
      { id: "budget-tagihan", name: "Tagihan", category: "Tagihan", type: "expense", parentId: null, budgetLimit: 0, isActive: true },
      { id: "budget-internet", name: "Internet", category: "Internet", type: "expense", parentId: "budget-tagihan", budgetLimit: 0, isActive: true },
    ],
    debts: [],
    wallets: [
      { id: "wallet-manual", name: "Dompet Manual", initialBalance: 0, currentBalance: 0, isActive: true },
    ],
    categories: ["Tagihan", "Internet", "Lainnya"],
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

  await page.locator('.sidebar [data-view="account"]').click();
  await page.waitForSelector("#accountView.active", { timeout: 10000 });
  await page.click('[data-open-form="category"]');
  await page.waitForSelector("#categoryForm", { timeout: 10000 });

  const childRows = await page.locator(".category-tree-child").allTextContents();
  if (childRows.length !== 1 || !childRows[0].includes("Internet")) {
    throw new Error(`Expected one Internet child row, received: ${JSON.stringify(childRows)}`);
  }
  const categoryTreeText = await page.locator(".category-tree").innerText();
  if (categoryTreeText.indexOf("Tagihan") > categoryTreeText.indexOf("Internet")) {
    throw new Error("Parent Tagihan must render before child Internet.");
  }
  out.push("category-manager:tree");
  await page.screenshot({ path: screenshot, fullPage: false });

  await page.click("#closeModalButton");
  await page.click("#addMenuButton");
  await page.click('#addMenu [data-open-form="transaction"]');
  await page.waitForSelector("#transactionCategory", { timeout: 10000 });
  const transactionOptions = await page.locator("#transactionCategory option").allTextContents();
  const tagihanIndex = transactionOptions.indexOf("Tagihan");
  const internetIndex = transactionOptions.indexOf("\u2014 Internet");
  if (tagihanIndex < 0 || internetIndex !== tagihanIndex + 1) {
    throw new Error(`Transaction category hierarchy is incorrect: ${JSON.stringify(transactionOptions)}`);
  }
  out.push("transaction-form:tree-options");
} catch (error) {
  failed = error;
  out.push(`exception:${String(error)}`);
} finally {
  await close();
}

console.log(JSON.stringify({ out, errors, screenshot }, null, 2));
if (failed) throw failed;
if (errors.length) throw new Error(errors.join("\n"));
