import { chromium } from "playwright";
import fs from "fs";

const SEARCH_URL =
  "https://booking.seanrent.com/en-US/s?city=tel-aviv&country=IL&currency=ILS&region=%7B%22city%22%3A%22tel-aviv%22%2C%22country%22%3A%22IL%22%7D";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const searchHits = [];

page.on("response", async (res) => {
  const u = res.url();
  if (!/shine-api\.maveriks\.com/i.test(u)) return;
  const ct = res.headers()["content-type"] || "";
  if (!ct.includes("json")) return;
  try {
    const json = await res.json();
    const count = json.data?.length ?? 0;
    if (count > 0 || json.meta?.total > 0) {
      searchHits.push({ url: u, count, total: json.meta?.total, first: json.data?.[0] });
    }
  } catch {}
});

await page.goto(SEARCH_URL, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(8000);

for (let i = 0; i < 10; i++) {
  await page.evaluate(() => window.scrollBy(0, 1200));
  await page.waitForTimeout(2000);
}

const links = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
const propertyLinks = [...new Set(links)].filter((h) =>
  /\/s\/accommodations\/|\/accommodations\//i.test(h)
);

console.log("Search hits:", searchHits);
console.log("Property links:", propertyLinks.length);
console.log(propertyLinks.slice(0, 15));

fs.writeFileSync("tmp-sn-tlv-search.json", JSON.stringify({ searchHits, propertyLinks }, null, 2));
await browser.close();
