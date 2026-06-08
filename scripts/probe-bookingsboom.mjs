/**
 * Probe BookingsBoom + Booking share links + network APIs
 */
import { chromium } from "playwright";
import fs from "fs";

const OUT = "tmp-seanrent-probe.json";
const hits = [];
const urls = new Set();

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on("response", async (res) => {
  const u = res.url();
  const ct = res.headers()["content-type"] || "";
  if (!/json|graphql|api|boom|bookings|property|listing|inventory|search/i.test(u + ct)) return;
  try {
    if (!ct.includes("json") && !ct.includes("text")) return;
    const body = await res.text();
    if (body.length < 20) return;
    let parsed = null;
    try {
      parsed = JSON.parse(body);
    } catch {}
    hits.push({ url: u.slice(0, 200), status: res.status(), size: body.length, sample: body.slice(0, 500), parsedKeys: parsed ? Object.keys(parsed).slice(0, 10) : null });
    // Extract property URLs/IDs from JSON text
    for (const m of body.matchAll(/https?:\/\/[^\s"'\\]+/g)) {
      if (/bookingsboom|booking\.com|airbnb|property|listing|accommodation/i.test(m[0])) urls.add(m[0].slice(0, 300));
    }
    for (const m of body.matchAll(/"slug"\s*:\s*"([^"]+)"/g)) urls.add(`slug:${m[1]}`);
    for (const m of body.matchAll(/"id"\s*:\s*"([a-f0-9-]{8,})"/gi)) urls.add(`id:${m[1]}`);
    for (const m of body.matchAll(/\/hotel\/il\/[a-z0-9-]+\.html/gi)) urls.add(`https://www.booking.com${m[0]}`);
  } catch {}
});

console.log("=== BookingsBoom ===");
await page.goto("https://seanrent.bookingsboom.com/?lang=en", {
  waitUntil: "networkidle",
  timeout: 120000,
});
await page.waitForTimeout(8000);

// Scroll to trigger lazy load
for (let i = 0; i < 8; i++) {
  await page.evaluate(() => window.scrollBy(0, 1500));
  await page.waitForTimeout(2000);
}

const bbLinks = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
bbLinks.forEach((u) => urls.add(u));
console.log("BookingsBoom links:", bbLinks.length);
console.log("Sample links:", bbLinks.filter((u) => /property|listing|room|unit|accommodation|detail/i.test(u)).slice(0, 15));

const bbText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
console.log("Page text sample:", bbText.slice(0, 400));

console.log("\n=== Booking Share 1 ===");
await page.goto("https://www.booking.com/Share-ZQNp2t", {
  waitUntil: "domcontentloaded",
  timeout: 120000,
});
await page.waitForTimeout(6000);
for (let i = 0; i < 5; i++) {
  await page.evaluate(() => window.scrollBy(0, 2000));
  await page.waitForTimeout(2000);
}
const share1Links = await page.$$eval("a[href]", (as) =>
  as.map((a) => a.href).filter((h) => /hotel\/il\//i.test(h))
);
share1Links.forEach((u) => urls.add(u.split("?")[0]));
console.log("Share-ZQNp2t hotel links:", share1Links.length, share1Links.slice(0, 5));

console.log("\n=== Booking Share 2 ===");
await page.goto("https://www.booking.com/Share-hjY5T4D", {
  waitUntil: "domcontentloaded",
  timeout: 120000,
});
await page.waitForTimeout(6000);
for (let i = 0; i < 5; i++) {
  await page.evaluate(() => window.scrollBy(0, 2000));
  await page.waitForTimeout(2000);
}
const share2Links = await page.$$eval("a[href]", (as) =>
  as.map((a) => a.href).filter((h) => /hotel\/il\//i.test(h))
);
share2Links.forEach((u) => urls.add(u.split("?")[0]));
console.log("Share-hjY5T4D hotel links:", share2Links.length, share2Links.slice(0, 5));

fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      hits: hits.slice(0, 80),
      urls: [...urls],
      apiHits: hits.filter((h) => h.parsedKeys).length,
    },
    null,
    2
  )
);

console.log("\nAPI hits:", hits.length);
console.log("Unique URLs/IDs:", urls.size);
console.log("Saved:", OUT);

await browser.close();
