import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto("https://holyguest.guestybookings.com/en/properties?minOccupancy=1&adults=1", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(2000);

const fields = "_id title publicDescription address accommodates bedrooms bathrooms amenities pictures picture";
const listUrl = `https://app.guesty.com/api/pm-websites-backend/listings?minOccupancy=1&fields=${encodeURIComponent(fields)}&limit=5`;
const res = await context.request.get(listUrl);
console.log("List status:", res.status());
const list = await res.json();
console.log("Results:", list.results?.length, "total:", list.pagination?.total);

const id = list.results?.[0]?._id;
const detailUrl = `https://app.guesty.com/api/pm-websites-backend/listings/${id}?fields=${encodeURIComponent(fields)}`;
const detailRes = await context.request.get(detailUrl);
console.log("Detail status:", detailRes.status());
const detail = await detailRes.json();
console.log("Pictures:", detail.pictures?.length);

await browser.close();
