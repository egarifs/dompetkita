const fs = require("fs");
const { execSync } = require("child_process");
const vm = require("vm");

function runGit(command, fallback = "") {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return fallback;
  }
}

function escapeJs(value) {
  return JSON.stringify(value);
}

function changeType(message) {
  const lower = message.toLowerCase();
  if (lower.includes("fix") || lower.includes("bug") || lower.includes("memperbaiki")) return "Fixed";
  if (lower.includes("remove") || lower.includes("hapus") || lower.includes("revert")) return "Removed";
  if (lower.includes("change") || lower.includes("refactor") || lower.includes("ubah") || lower.includes("update")) return "Changed";
  return "Added";
}

function generateAppMeta() {
  const commitCount = Number(runGit("git rev-list --count HEAD", "1")) || 1;
  const log = runGit("git log -n 12 --date=short --pretty=format:%h%x1f%ad%x1f%s", "");
  const generatedAt = runGit("git log -1 --date=iso-strict --pretty=format:%cI", new Date().toISOString());
  const grouped = new Map();

  for (const line of log.split(/\r?\n/).filter(Boolean)) {
    const [hash, date, subject] = line.split("\x1f");
    if (!hash || !date || !subject) continue;
    const version = `1.0.${Math.max(commitCount - grouped.size, 0)}`;
    const key = `${version}|${date}`;
    if (!grouped.has(key)) {
      grouped.set(key, { version, date, changes: { Added: [], Changed: [], Fixed: [], Removed: [] } });
    }
    grouped.get(key).changes[changeType(subject)].push(`${subject} (${hash})`);
  }

  const changelog = [...grouped.values()].map((entry) => ({
    ...entry,
    changes: Object.fromEntries(Object.entries(entry.changes).filter(([, items]) => items.length)),
  }));

  const meta = {
    name: "Dompify",
    version: `1.0.${commitCount}`,
    shareUrl: "https://dompify.netlify.app/",
    generatedAt,
    changelog: changelog.length ? changelog : [
      {
        version: `1.0.${commitCount}`,
        date: new Date().toISOString().slice(0, 10),
        changes: { Changed: ["Build metadata generated without Git history."] },
      },
    ],
  };

  fs.writeFileSync("app-meta.js", `window.APP_META = ${escapeJs(meta)};\n`);
}

generateAppMeta();

const requiredFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "app-meta.js",
  "quotes.js",
  "sw.js",
  "manifest.webmanifest",
  "js/core/constants.js",
  "js/utils/dateUtils.js",
  "js/utils/formatCurrency.js",
  "js/utils/idUtils.js",
  "js/utils/validation.js",
  "js/components/icon.js",
  "js/components/toast.js",
  "js/components/modal.js",
  "js/components/moneyInput.js",
  "js/components/moneyCalculator.js",
  "js/core/state.js",
  "js/core/storage.js",
  "js/core/auth.js",
  "js/core/cloud.js",
  "js/core/router.js",
  "js/features/dashboard/dashboard.render.js",
  "js/features/wallets/wallet.service.js",
  "js/features/wallets/wallet.render.js",
  "js/features/transactions/transaction.service.js",
  "js/features/transactions/transaction.render.js",
  "js/features/budgets/budget.service.js",
  "js/features/budgets/budget.render.js",
  "js/features/debts/debt.service.js",
  "js/features/debts/debt.render.js",
  "js/features/savings/savings.service.js",
  "js/features/savings/savings.render.js",
  "js/features/account/account.service.js",
  "js/features/account/account.render.js",
  "icons/icon.svg",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    throw new Error(`${file} tidak ditemukan`);
  }
}

JSON.parse(fs.readFileSync("manifest.webmanifest", "utf8"));

for (const file of [
  "quotes.js",
  "js/core/constants.js",
  "js/utils/dateUtils.js",
  "js/utils/formatCurrency.js",
  "js/utils/idUtils.js",
  "js/utils/validation.js",
  "js/components/icon.js",
  "js/components/toast.js",
  "js/components/modal.js",
  "js/components/moneyInput.js",
  "js/components/moneyCalculator.js",
  "js/core/state.js",
  "js/core/storage.js",
  "js/core/auth.js",
  "js/core/cloud.js",
  "js/core/router.js",
  "js/features/dashboard/dashboard.render.js",
  "js/features/wallets/wallet.service.js",
  "js/features/wallets/wallet.render.js",
  "js/features/transactions/transaction.service.js",
  "js/features/transactions/transaction.render.js",
  "js/features/budgets/budget.service.js",
  "js/features/budgets/budget.render.js",
  "js/features/debts/debt.service.js",
  "js/features/debts/debt.render.js",
  "js/features/savings/savings.service.js",
  "js/features/savings/savings.render.js",
  "js/features/account/account.service.js",
  "js/features/account/account.render.js",
  "app.js",
  "app-meta.js",
  "sw.js",
]) {
  new vm.Script(fs.readFileSync(file, "utf8"), { filename: file });
}

console.log("Static build OK");
