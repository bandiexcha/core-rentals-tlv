import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto("https://holyguest.guestybookings.com/en/properties?minOccupancy=1&adults=1", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(5000);

const ids = new Set();

for (let i = 0; i < 30; i++) {
  const links = await page.$$eval('a[href*="/properties/"]', (as) =>
    as.map((a) => a.href).filter((h) => /\/properties\/[a-f0-9]{24}/.test(h))
  );
  links.forEach((l) => {
    const m = l.match(/\/properties\/([a-f0-9]{24})/);
    if (m) ids.add(m[1]);
  });
  console.log("Scroll", i + 1, "unique IDs:", ids.size);
  if (ids.size >= 170) break;
  await page.evaluate(() => window.scrollBy(0, window.innerHeight));
  await page.waitForTimeout(1500);
}

console.log("Final IDs:", ids.size);
await browser.close();
