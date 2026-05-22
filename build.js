const fs = require("fs");
const vm = require("vm");

const requiredFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "quotes.js",
  "sw.js",
  "manifest.webmanifest",
  "js/constants.js",
  "js/utils.js",
  "js/state.js",
  "js/auth.js",
  "js/cloud.js",
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
  "js/constants.js",
  "js/utils.js",
  "js/state.js",
  "js/auth.js",
  "js/cloud.js",
  "app.js",
  "sw.js",
]) {
  new vm.Script(fs.readFileSync(file, "utf8"), { filename: file });
}

console.log("Static build OK");
