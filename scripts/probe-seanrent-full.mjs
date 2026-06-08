import { chromium } from "playwright";
import fs from "fs";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const hits = [];

page.on("response", async (res) => {
  const u = res.url();
  if (!/shine-api|maveriks|web-api/i.test(u)) return;
  const ct = res.headers()["content-type"] || "";
  if (!ct.includes("json")) return;
  try {
    const json = await res.json();
    hits.push({ url: u, count: json.data?.length, meta: json.meta, sample: json.data?.[0] });
  } catch {}
});

await page.goto("https://booking.seanrent.com/s", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(3000);

const loc = page.locator('input[placeholder="Location"]').first();
await loc.click({ force: true });
await loc.fill("Tel Aviv");
await page.waitForTimeout(3000);

const pacItems = page.locator(".pac-item");
const pacCount = await pacItems.count();
console.log("PAC items:", pacCount);
if (pacCount > 0) {
  for (let i = 0; i < Math.min(pacCount, 3); i++) {
    console.log(i, await pacItems.nth(i).textContent());
  }
  await pacItems.first().click();
  await page.waitForTimeout(2000);
}

await page.locator('button:has-text("Search")').last().click().catch(() => {});
await page.waitForTimeout(12000);

// scroll results
for (let i = 0; i < 5; i++) {
  await page.evaluate(() => window.scrollBy(0, 800));
  await page.waitForTimeout(2000);
}

const links = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
const propertyLinks = [...new Set(links)].filter((h) =>
  /accommodation|listing|property|unit|rental/i.test(h)
);
console.log("Property links:", propertyLinks.slice(0, 20));
console.log("API hits:", hits.filter((h) => h.count > 0));

fs.writeFileSync("tmp-sn-probe.json", JSON.stringify({ hits, propertyLinks }, null, 2));
await browser.close();
