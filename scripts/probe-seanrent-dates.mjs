import { chromium } from "playwright";

const checkIn = "2026-07-01";
const checkOut = "2026-07-08";

const urls = [
  `https://booking.seanrent.com/en-US/s?city=tel-aviv&country=IL&checkIn=${checkIn}&checkOut=${checkOut}&region=%7B%22city%22%3A%22tel-aviv%22%2C%22country%22%3A%22IL%22%7D`,
  `https://booking.seanrent.com/en-US/s?city=tel-aviv&country=IL&from=${checkIn}&to=${checkOut}`,
  `https://booking.seanrent.com/en-US/s?city=tel-aviv&country=IL&startDate=${checkIn}&endDate=${checkOut}`,
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

for (const url of urls) {
  console.log("\n===", url.slice(0, 120));
  page.removeAllListeners("response");
  page.on("response", async (res) => {
    const u = res.url();
    if (!/shine-api\.maveriks\.com\/search/i.test(u)) return;
    try {
      const json = await res.json();
      console.log("Search:", u.slice(0, 160));
      console.log("  count:", json.data?.length, "total:", json.meta?.total);
      if (json.data?.[0]) {
        console.log("  first:", json.data[0].name || json.data[0].title, json.data[0].slug);
      }
    } catch {}
  });

  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(8000);
}

// Also try setting dates via UI
console.log("\n=== UI date entry ===");
await page.goto("https://booking.seanrent.com/en-US/s?city=tel-aviv&country=IL", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(3000);

const dateInput = page.locator('input[placeholder="Check in - Check out"]').first();
if (await dateInput.count()) {
  await dateInput.click({ force: true });
  await page.waitForTimeout(2000);
  // click first available future date cells
  const days = page.locator('[role="gridcell"]:not([disabled]) button, .MuiPickersDay-root:not(.Mui-disabled)');
  const dayCount = await days.count();
  console.log("Available day buttons:", dayCount);
  if (dayCount > 5) {
    await days.nth(5).click();
    await page.waitForTimeout(500);
    await days.nth(10).click();
    await page.waitForTimeout(1000);
    await page.locator('button:has-text("Search")').last().click().catch(() => {});
    await page.waitForTimeout(12000);
  }
}

page.on("response", async (res) => {
  const u = res.url();
  if (/shine-api\.maveriks\.com\/search/i.test(u)) {
    try {
      const json = await res.json();
      if (json.data?.length) console.log("UI search results:", json.data.length, json.data[0]?.name);
    } catch {}
  }
});

await browser.close();
