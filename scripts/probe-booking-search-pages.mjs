import { chromium } from "playwright";
import fs from "fs";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const urls = new Set();

// Booking.com brand search - paginate through results
for (let offset = 0; offset <= 200; offset += 25) {
  const searchUrl = `https://www.booking.com/searchresults.html?ss=Sea+N+Rent&dest_id=-781899&dest_type=city&group_adults=2&offset=${offset}`;
  console.log("Page offset", offset);
  try {
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(4000);

    const links = await page.$$eval('[data-testid="property-card"] a[href], a[data-testid="title-link"]', (as) =>
      as.map((a) => a.href).filter((h) => /hotel\/il\//i.test(h))
    );
    if (!links.length) break;
    links.forEach((u) => urls.add(u.split("?")[0].replace(".en-gb.html", ".html")));
    console.log("  found", links.length, "total", urls.size);
  } catch (e) {
    console.log("  error", e.message);
    break;
  }
}

// Revyoos property names -> search booking
await page.goto("https://www.revyoos.com/reviews/seanrent", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3000);

for (let i = 0; i < 10; i++) {
  await page.evaluate(() => window.scrollBy(0, 1500));
  await page.waitForTimeout(1000);
}

const revyoosText = await page.evaluate(() => document.body.innerText);
const propertyNames = [...revyoosText.matchAll(/Stayed in (.+)/g)].map((m) => m[1].trim());
console.log("\nRevyoos property names sample:", propertyNames.slice(0, 20));

fs.writeFileSync("tmp-revyoos-names.json", JSON.stringify([...new Set(propertyNames)], null, 2));

console.log("\nTotal booking URLs:", urls.size);
console.log([...urls].join("\n"));

await browser.close();
