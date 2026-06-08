import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto("https://www.booking.com/searchresults.html?ss=Tel+Aviv&nflt=hotelfacility%3D999", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
}).catch(() => {});

// Search booking.com for Sea N Rent specifically
await page.goto(
  "https://www.booking.com/searchresults.html?ss=Sea+N+Rent+Tel+Aviv",
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.waitForTimeout(5000);

const links = await page.$$eval("a[href]", (as) => as.map((a) => a.href)).catch(() => []);
const seanrent = links.filter((l) => /seanrent|sea.n.rent/i.test(l));
const hotels = links.filter((l) => /booking\.com\/hotel/i.test(l)).slice(0, 10);
console.log("SeanRent links:", seanrent);
console.log("Hotel links:", hotels);

await browser.close();
