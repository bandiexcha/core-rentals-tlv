import { chromium } from "playwright";

const SEARCH_URL =
  "https://booking.seanrent.com/en-US/s?city=tel-aviv&country=IL&currency=USD&region=%7B%22city%22%3A%22tel-aviv%22%2C%22country%22%3A%22IL%22%7D&sort=%7B%22field%22%3A%22rating%22%2C%22order%22%3A%22DESC%22%7D";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on("response", async (res) => {
  const u = res.url();
  if (!/shine-api\.maveriks\.com/i.test(u)) return;
  const ct = res.headers()["content-type"] || "";
  if (!ct.includes("json")) return;
  try {
    const json = await res.json();
    console.log("API:", u.slice(0, 150));
    console.log("  count:", json.data?.length, "total:", json.meta?.total);
    if (json.data?.[0]) console.log("  first:", json.data[0].name || json.data[0].title, json.data[0].slug || json.data[0].id);
  } catch {}
});

await page.goto(SEARCH_URL, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(10000);

const text = await page.evaluate(() => document.body.innerText.slice(0, 2000));
console.log("\nPage text preview:\n", text);

const cards = await page.locator('[class*="card"], [class*="listing"], [class*="property"], [class*="accommodation"]').count();
console.log("\nCard-like elements:", cards);

await browser.close();
