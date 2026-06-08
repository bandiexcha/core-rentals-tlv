import { chromium } from "playwright";
import fs from "fs";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const responses = [];

page.on("response", async (res) => {
  const u = res.url();
  if (!/shine-api|maveriks/i.test(u)) return;
  try {
    const ct = res.headers()["content-type"] || "";
    if (!ct.includes("json")) return;
    const body = await res.text();
    const json = JSON.parse(body);
    if (json.data?.length > 0) {
      responses.push({ url: u, count: json.data.length, sample: json.data[0] });
      console.log("FOUND", json.data.length, "items from", u);
    }
  } catch {}
});

await page.goto("https://booking.seanrent.com/s", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(3000);

const locationInput = page.locator('input[placeholder="Location"]').first();
await locationInput.click();
await locationInput.fill("Tel Aviv, Israel");
await page.waitForTimeout(2000);

// Click first autocomplete suggestion if present
const suggestion = page.locator('[role="option"], [class*="suggestion"], [class*="autocomplete"] li, [class*="place"]').first();
if (await suggestion.count()) {
  await suggestion.click();
  console.log("Clicked suggestion");
} else {
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(500);
  await page.keyboard.press("Enter");
}

await page.waitForTimeout(2000);

// Click search button
for (const sel of ['button:has-text("Search")', 'button[type="submit"]', '[class*="search"] button']) {
  const btn = page.locator(sel).first();
  if (await btn.count()) {
    await btn.click();
    console.log("Clicked", sel);
    break;
  }
}

await page.waitForTimeout(10000);
fs.writeFileSync("tmp-sn-search-results.json", JSON.stringify(responses, null, 2));

const links = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
console.log("Links:", [...new Set(links)].filter((h) => /listing|property|accommodation|\/s\//i.test(h)).slice(0, 15));

await browser.close();
