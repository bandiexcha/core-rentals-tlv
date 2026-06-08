import { chromium } from "playwright";
import fs from "fs";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const allListings = [];

page.on("response", async (res) => {
  const u = res.url();
  if (!u.includes("pm-websites-backend/listings") || u.includes("/calendar")) return;
  try {
    const ct = res.headers()["content-type"] || "";
    if (!ct.includes("json")) return;
    const text = await res.text();
    const json = JSON.parse(text);
    if (json.results) {
      allListings.push(...json.results);
      console.log("Page batch:", json.results.length, "total collected:", allListings.length, "/", json.pagination?.total);
    } else if (json._id && json.pictures) {
      fs.writeFileSync("tmp-single-detail.json", text);
      console.log("Detail captured:", json.title, json.pictures.length, "photos");
    }
  } catch {}
});

// Initial listings page
await page.goto("https://holyguest.guestybookings.com/en/properties?minOccupancy=1&adults=1", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(8000);

// Try load more / pagination
for (let i = 0; i < 3; i++) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);
  const loadMore = page.locator('button:has-text("Load"), button:has-text("Show more"), [class*="load-more"]').first();
  if (await loadMore.isVisible()) {
    await loadMore.click();
    await page.waitForTimeout(3000);
  }
}

// Detail page
await page.goto(
  "https://holyguest.guestybookings.com/en/properties/69fb33d01cd9700014a4b376?minOccupancy=1&adults=1",
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.waitForTimeout(8000);

fs.writeFileSync("tmp-all-listings-preview.json", JSON.stringify(allListings.slice(0, 5), null, 2));
console.log("Final listing count:", allListings.length);

await browser.close();
