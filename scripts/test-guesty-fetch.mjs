import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto("https://holyguest.guestybookings.com/en/properties?minOccupancy=1&adults=1", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(5000);

const result = await page.evaluate(async () => {
  const fields = "_id title publicDescription address accommodates bedrooms bathrooms amenities pictures picture";
  const res = await fetch(
    `https://app.guesty.com/api/pm-websites-backend/listings?minOccupancy=1&fields=${encodeURIComponent(fields)}&limit=3`
  );
  return { status: res.status, data: await res.json() };
});

console.log("Status:", result.status);
console.log("Count:", result.data.results?.length, "total:", result.data.pagination?.total);

const id = result.data.results?.[0]?._id;
const detail = await page.evaluate(async (listingId) => {
  const fields = "_id title publicDescription address accommodates bedrooms bathrooms amenities pictures picture";
  const res = await fetch(
    `https://app.guesty.com/api/pm-websites-backend/listings/${listingId}?fields=${encodeURIComponent(fields)}`
  );
  return { status: res.status, data: await res.json() };
}, id);

console.log("Detail status:", detail.status, "pictures:", detail.data.pictures?.length);

await browser.close();
