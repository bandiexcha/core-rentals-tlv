import { chromium } from "playwright";
import fs from "fs";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto("https://holyguest.guestybookings.com/en/properties?minOccupancy=1&adults=1", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(3000);

const listingId = "69fb33d01cd9700014a4b376";
const fields = [
  "_id", "title", "publicDescription", "address", "accommodates",
  "bedrooms", "bathrooms", "amenities", "pictures", "picture",
].join(" ");

const detailUrl = `https://app.guesty.com/api/pm-websites-backend/listings/${listingId}?fields=${encodeURIComponent(fields)}`;
const res = await context.request.get(detailUrl);
const body = await res.text();
fs.writeFileSync("tmp-guesty-detail.json", body);
console.log("Status:", res.status());
const data = JSON.parse(body);
console.log("Keys:", Object.keys(data));
console.log("pictures:", data.pictures?.length);
console.log("amenities:", data.amenities?.length);
if (data.pictures?.[0]) console.log(JSON.stringify(data.pictures[0], null, 2));

await browser.close();
