import { chromium } from "playwright";

const SEARCH_URL =
  "https://booking.seanrent.com/en-US/s?city=tel-aviv&country=IL&currency=USD&region=%7B%22city%22%3A%22tel-aviv%22%2C%22country%22%3A%22IL%22%7D";

const browser = await chromium.launch({
  headless: false,
  args: ["--disable-blink-features=AutomationControlled"],
});
const context = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  locale: "en-US",
});
const page = await context.newPage();

const hits = [];
page.on("response", async (res) => {
  const u = res.url();
  if (/shine-api\.maveriks\.com\/search/i.test(u)) {
    try {
      const json = await res.json();
      hits.push({ url: u, count: json.data?.length, total: json.meta?.total });
    } catch {}
  }
});

await page.goto(SEARCH_URL, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(5000);

const hasPlaces = await page.evaluate(() => !!window.google?.maps?.places);
console.log("Google places loaded:", hasPlaces);

const loc = page.locator('input[placeholder="Location"]').first();
await loc.click();
await page.keyboard.type("Tel Aviv-Yafo", { delay: 100 });
await page.waitForTimeout(6000);

console.log("PAC:", await page.locator(".pac-item").count());
console.log("Search hits:", hits);

await browser.close();
