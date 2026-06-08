import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src/data/seanrent-urls.json");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const urls = new Set();

const queries = [
  "site:booking.seanrent.com accommodations Tel Aviv",
  "site:booking.seanrent.com/s/accommodations",
  '"Sea N Rent" site:booking.seanrent.com',
];

for (const q of queries) {
  await page.goto(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(2000);
  const html = await page.content();
  for (const m of html.matchAll(/uddg=([^&"']+)/g)) {
    try {
      const u = decodeURIComponent(m[1]);
      if (/booking\.seanrent\.com.*accommodations/i.test(u)) urls.add(u.split("?")[0]);
    } catch {}
  }
  for (const m of html.matchAll(/https:\/\/booking\.seanrent\.com\/[^"'\s<>]+/g)) {
    if (/accommodations/i.test(m[0])) urls.add(m[0].split("?")[0]);
  }
}

console.log("Found:", urls.size);
console.log([...urls].slice(0, 20).join("\n"));

fs.writeFileSync(OUT, JSON.stringify({ discoveredAt: new Date().toISOString(), urls: [...urls] }, null, 2));
await browser.close();
