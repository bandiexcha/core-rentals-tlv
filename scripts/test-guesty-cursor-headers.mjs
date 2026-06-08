import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
let firstHeaders = null;
let cursor = null;

page.on("request", (req) => {
  if (req.url().includes("pm-websites-backend/listings") && !req.url().includes("/calendar") && !firstHeaders) {
    firstHeaders = req.headers();
  }
});

page.on("response", async (res) => {
  if (res.url().includes("pm-websites-backend/listings") && !res.url().includes("/calendar")) {
    try {
      const json = JSON.parse(await res.text());
      cursor = json.pagination?.cursor?.next;
    } catch {}
  }
});

await page.goto("https://holyguest.guestybookings.com/en/properties?minOccupancy=1&adults=1", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(6000);

const result = await page.evaluate(async ({ c, h }) => {
  const fields = "_id title roomType beds timezone publicDescription picture address accommodates bedrooms bathrooms propertyType";
  const url = `https://app.guesty.com/api/pm-websites-backend/listings?minOccupancy=1&fields=${encodeURIComponent(fields)}&limit=20&cursor=${encodeURIComponent(c)}`;
  const res = await fetch(url, { headers: h, credentials: "include" });
  const text = await res.text();
  return { status: res.status, text: text.slice(0, 300), fullLen: text.length };
}, { c: cursor, h: firstHeaders });

console.log("Cursor:", cursor?.slice(0, 40));
console.log("Headers keys:", Object.keys(firstHeaders || {}));
console.log("Result:", result);

await browser.close();
