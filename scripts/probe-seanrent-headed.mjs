import { chromium } from "playwright";

// Non-headless may load Google Places autocomplete
const browser = await chromium.launch({ headless: false, slowMo: 50 });
const page = await browser.newPage();
const hits = [];

page.on("response", async (res) => {
  const u = res.url();
  if (!/shine-api\.maveriks\.com\/search/i.test(u)) return;
  try {
    const json = await res.json();
    hits.push({ url: u, count: json.data?.length, meta: json.meta, first: json.data?.[0]?.name || json.data?.[0]?.title });
  } catch {}
});

await page.goto("https://booking.seanrent.com/s", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(4000);

const loc = page.locator('input[placeholder="Location"]').first();
await loc.click();
await loc.fill("");
await loc.type("Tel Aviv", { delay: 100 });
await page.waitForTimeout(5000);

const pacCount = await page.locator(".pac-item").count();
console.log("PAC items:", pacCount);

if (pacCount > 0) {
  const texts = [];
  for (let i = 0; i < Math.min(pacCount, 5); i++) {
    texts.push(await page.locator(".pac-item").nth(i).textContent());
  }
  console.log("PAC texts:", texts);
  await page.locator(".pac-item").first().click();
  await page.waitForTimeout(2000);
}

await page.locator('button:has-text("Search")').last().click().catch(() => {});
await page.waitForTimeout(15000);

console.log("Search hits:", hits.filter((h) => h.count > 0));
console.log("All hits:", hits);

await browser.close();
