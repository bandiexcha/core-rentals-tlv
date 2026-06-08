import { chromium } from "playwright";
import fs from "fs";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
let cursor = null;
const all = [];

page.on("response", async (res) => {
  const u = res.url();
  if (!u.includes("pm-websites-backend/listings") || u.includes("/calendar")) return;
  try {
    const json = JSON.parse(await res.text());
    if (json.results) {
      all.push(...json.results);
      cursor = json.pagination?.cursor?.next ?? null;
      console.log("Got", json.results.length, "cursor?", !!cursor);
    }
  } catch {}
});

await page.goto("https://holyguest.guestybookings.com/en/properties?minOccupancy=1&adults=1", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(6000);

while (cursor && all.length < 200) {
  const nextCursor = cursor;
  const batch = await page.evaluate(async (c) => {
    const fields = "_id title roomType beds timezone publicDescription picture address accommodates bedrooms bathrooms propertyType";
    const url = `https://app.guesty.com/api/pm-websites-backend/listings?minOccupancy=1&fields=${encodeURIComponent(fields)}&limit=20&cursor=${encodeURIComponent(c)}`;
    const res = await fetch(url, { credentials: "include" });
    const text = await res.text();
    return { status: res.status, text: text.slice(0, 500), len: text.length };
  }, nextCursor);
  console.log("Fetch cursor status:", batch.status, "len:", batch.len, batch.text.slice(0, 200));

  if (batch.status !== 200 || batch.len < 50) break;

  const json = JSON.parse(await page.evaluate(async (c) => {
    const fields = "_id title roomType beds timezone publicDescription picture address accommodates bedrooms bathrooms propertyType";
    const url = `https://app.guesty.com/api/pm-websites-backend/listings?minOccupancy=1&fields=${encodeURIComponent(fields)}&limit=20&cursor=${encodeURIComponent(c)}`;
    const res = await fetch(url, { credentials: "include" });
    return res.json();
  }, nextCursor));

  if (!json.results?.length) break;
  all.push(...json.results);
  cursor = json.pagination?.cursor?.next ?? null;
  console.log("Total now:", all.length);
  await page.waitForTimeout(1500);
}

const tlv = all.filter((l) => (l.address?.city || "").includes("Tel Aviv") || (l.address?.full || "").includes("Tel Aviv"));
console.log("Total listings:", all.length, "Tel Aviv:", tlv.length);
fs.writeFileSync("tmp-guesty-all-ids.json", JSON.stringify(tlv.map((l) => ({ id: l._id, title: l.title })), null, 2));

await browser.close();
