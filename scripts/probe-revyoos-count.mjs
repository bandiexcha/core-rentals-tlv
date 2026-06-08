import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto("https://www.revyoos.com/reviews/seanrent", {
  waitUntil: "domcontentloaded",
  timeout: 90000,
});
await page.waitForTimeout(3000);

for (let i = 0; i < 50; i++) {
  const btn = page.locator('button:has-text("Load more"), a:has-text("Load more")').first();
  if (await btn.count()) {
    await btn.click().catch(() => {});
    await page.waitForTimeout(1500);
  } else {
    await page.evaluate(() => window.scrollBy(0, 3000));
    await page.waitForTimeout(1000);
  }
}

const text = await page.evaluate(() => document.body.innerText);
const names = [...text.matchAll(/Stayed in (.+?)(?:\n|$)/g)].map((m) => m[1].trim());
const uniq = [...new Set(names)];
const tlv = uniq.filter(
  (n) =>
    /tel aviv|tel-?aviv|yafo|jaffa|#\d+/i.test(n) &&
    !/firenze|florence|italy|paris|miami|rome|milano|courchevel/i.test(n)
);

console.log("total names", uniq.length);
console.log("tlv-ish", tlv.length);
console.log("sample:\n", tlv.slice(0, 40).join("\n"));

// Check for embedded links in HTML
const html = await page.content();
const bookingLinks = [...html.matchAll(/booking\.com\/hotel\/il\/[a-z0-9-]+\.html/gi)].map((m) => m[0]);
console.log("\nembedded booking links:", [...new Set(bookingLinks)].length);

await browser.close();
