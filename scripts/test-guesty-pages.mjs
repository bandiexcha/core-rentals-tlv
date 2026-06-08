import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const batches = [];

page.on("response", async (res) => {
  const u = res.url();
  if (!u.includes("pm-websites-backend/listings") || u.includes("/calendar")) return;
  try {
    const json = JSON.parse(await res.text());
    if (json.results) batches.push({ url: u, count: json.results.length, next: json.pagination?.cursor?.next });
  } catch {}
});

await page.goto("https://holyguest.guestybookings.com/en/properties?minOccupancy=1&adults=1", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(5000);

// Click next page if exists
for (const sel of ['button[aria-label="Next"]', '[class*="pagination"] button:last-child', 'a:has-text("Next")', '[data-qa*="next"]']) {
  const btn = page.locator(sel).first();
  if (await btn.count() && await btn.isVisible()) {
    console.log("Clicking", sel);
    await btn.click();
    await page.waitForTimeout(5000);
    break;
  }
}

// Infinite scroll
for (let i = 0; i < 15; i++) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);
}

console.log("Batches:", batches.length);
for (const b of batches) console.log(b.count, b.url.slice(0, 150), "next?", !!b.next);

await browser.close();
