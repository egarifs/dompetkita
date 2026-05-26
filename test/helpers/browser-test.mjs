import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const mimeTypes = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

export async function startStaticServer() {
  const server = http.createServer((request, response) => {
    let pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    if (pathname === "/") pathname = "/index.html";
    const file = path.join(root, pathname);
    if (!file.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    fs.readFile(file, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      response.writeHead(200, { "Content-Type": mimeTypes[path.extname(file)] || "application/octet-stream" });
      response.end(data);
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}/index.html`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

export async function createBrowserTest({ disableCloud = true } = {}) {
  const server = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  if (disableCloud) {
    await page.route("**/config.js", (route) => {
      route.fulfill({
        contentType: "application/javascript",
        body: "window.APP_CONFIG = {};",
      });
    });
  }
  return {
    browser,
    page,
    baseUrl: server.baseUrl,
    async close() {
      await browser.close();
      await server.close();
    },
  };
}
