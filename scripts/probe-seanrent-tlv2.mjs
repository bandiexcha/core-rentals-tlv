import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const urls = [];

page.on("response", async (res) => {
  const u = res.url();
  if (/shine-api.*search/i.test(u)) {
    try {
      const json = await res.json();
      console.log("Search URL:", u);
      console.log("Items:", json.data?.length ?? "n/a");
      if (json.data?.[0]) console.log("Sample keys:", Object.keys(json.data[0]));
    } catch {}
  }
});

await page.goto("https://booking.seanrent.com/s", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2000);

// Open mobile search if needed
const searchBtn = page.locator('button:has-text("Search"), [class*="SearchButton"]').first();
if (await searchBtn.isVisible()) await searchBtn.click();

const loc = page.locator('input[placeholder="Location"]').first();
await loc.click({ force: true });
await loc.fill("");
await loc.type("Tel Aviv", { delay: 100 });
await page.waitForTimeout(3000);

// Screenshot for debug
await page.screenshot({ path: "tmp-sn-search.png", fullPage: true });

// Try clicking visible listbox options
const options = page.locator('[role="listbox"] [role="option"], li[class*="option"], div[class*="pac-item"]');
const count = await options.count();
console.log("Options found:", count);
if (count > 0) {
  await options.first().click();
  await page.waitForTimeout(1000);
}

// Press search
await page.locator('button:has-text("Search")').last().click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(12000);

await browser.close();
