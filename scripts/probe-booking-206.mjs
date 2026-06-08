import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto("https://www.booking.com/hotel/il/sea-n-39-rent-ramat-aviv.html", {
  waitUntil: "networkidle",
  timeout: 120000,
});
await page.waitForTimeout(5000);

// Find "206 properties" / company review section links
const links = await page.evaluate(() => {
  const all = [...document.querySelectorAll("a[href]")].map((a) => ({
    href: a.href,
    text: a.textContent?.trim().slice(0, 80),
  }));
  return all.filter(
    (l) =>
      /propert|206|sea n|hotel\/il|brand|partner|more from/i.test(l.text + l.href) ||
      l.text.includes("206")
  );
});

console.log("Relevant links:", links);

// Extract JSON-LD or embedded data
const scripts = await page.evaluate(() =>
  [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent?.slice(0, 500))
);
console.log("JSON-LD:", scripts);

// Try clicking company review score area
const companyLink = page.locator('a:has-text("206")').first();
if (await companyLink.count()) {
  console.log("Clicking 206 properties link...");
  await companyLink.click();
  await page.waitForTimeout(5000);
  const after = await page.$$eval("a[href]", (as) =>
    as.map((a) => a.href).filter((h) => /hotel\/il\//i.test(h))
  );
  console.log("URLs after click:", after.length, after.slice(0, 20));
}

await browser.close();
