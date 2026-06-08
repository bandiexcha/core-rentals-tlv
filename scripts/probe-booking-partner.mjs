import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const urls = new Set();

page.on("response", async (res) => {
  const u = res.url();
  if (!/booking\.com/i.test(u)) return;
  try {
    const text = await res.text();
    for (const m of text.matchAll(/\/hotel\/il\/[a-z0-9-]+\.html/gi)) {
      urls.add(`https://www.booking.com${m[0]}`);
    }
  } catch {}
});

await page.goto(
  "https://www.booking.com/hotel/il/sea-n-39-rent-ramat-aviv.html",
  { waitUntil: "networkidle", timeout: 120000 }
);
await page.waitForTimeout(5000);

// Click "all properties" / partner link if exists
const partnerLinks = await page.$$eval("a[href]", (as) =>
  as
    .map((a) => ({ href: a.href, text: a.textContent?.trim() }))
    .filter((l) => /propert|206|all.*listing|managed by|partner|brand/i.test(l.text + l.href))
);
console.log("Partner links:", partnerLinks.slice(0, 15));

for (const link of partnerLinks.slice(0, 5)) {
  try {
    await page.goto(link.href, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(4000);
    const pageUrls = await page.$$eval("a[href]", (as) =>
      as.map((a) => a.href).filter((h) => /booking\.com\/hotel\/il\//i.test(h))
    );
    pageUrls.forEach((u) => urls.add(u.split("?")[0]));
  } catch {}
}

// Also try booking search with brand filter
await page.goto(
  "https://www.booking.com/searchresults.html?ss=Sea+N%27+Rent&dest_id=-781899&dest_type=city&group_adults=2",
  { waitUntil: "domcontentloaded", timeout: 90000 }
);
await page.waitForTimeout(5000);

for (let i = 0; i < 5; i++) {
  await page.evaluate(() => window.scrollBy(0, 2000));
  await page.waitForTimeout(2000);
}

const searchUrls = await page.$$eval("a[href]", (as) =>
  as.map((a) => a.href).filter((h) => /booking\.com\/hotel\/il\//i.test(h))
);
searchUrls.forEach((u) => urls.add(u.split("?")[0]));

console.log("\nTotal hotel URLs found:", urls.size);
console.log([...urls].slice(0, 30).join("\n"));

await browser.close();
