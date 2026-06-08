import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto("https://booking.seanrent.com/s", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(6000);

const result = await page.evaluate(async () => {
  const urls = [
    "https://shine-api.maveriks.com/search?page=1&per_page=50&filter[exact_match]=0",
    "https://shine-api.maveriks.com/search?page=1&per_page=50&filter[latitude]=32.0853&filter[longitude]=34.7818&filter[radius]=30",
  ];
  const out = [];
  for (const url of urls) {
    const res = await fetch(url, { credentials: "include" });
    const text = await res.text();
    let count = 0;
    try {
      count = JSON.parse(text).data?.length ?? 0;
    } catch {}
    out.push({ status: res.status, count, sample: text.slice(0, 300) });
  }
  return out;
});

console.log(JSON.stringify(result, null, 2));

// Also scrape seanrent.com for links
await page.goto("https://www.seanrent.com/", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(3000);
const links = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
const booking = links.filter((l) => /booking\.seanrent|accommodation|property/i.test(l));
console.log("seanrent.com booking links:", booking.length);
console.log(booking.slice(0, 10));

await browser.close();
