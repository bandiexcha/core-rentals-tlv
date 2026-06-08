import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto("https://booking.seanrent.com/s", { waitUntil: "networkidle", timeout: 120000 });
const html = await page.content();

const scriptSrcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
const appScripts = scriptSrcs.filter((s) => /booking|maveriks|chunk|main|app/i.test(s) && !/gtm|google/i.test(s));
console.log("App scripts:", appScripts.length);

for (const src of appScripts) {
  const url = src.startsWith("http") ? src : `https://booking.seanrent.com${src.startsWith("/") ? "" : "/"}${src}`;
  try {
    const res = await page.request.get(url);
    const text = await res.text();
    if (!/search|location|filter\[/i.test(text)) continue;

    const snippets = [];
    for (const m of text.matchAll(/filter\[([^\]]+)\]/g)) snippets.push(m[0]);
    const uniqueFilters = [...new Set(snippets)].slice(0, 30);
    if (uniqueFilters.length) {
      console.log("\n", url.slice(-70));
      console.log("Filters:", uniqueFilters);
    }

    const searchUrls = text.match(/shine-api[^"'`]+search[^"'`]*/g);
    if (searchUrls) console.log("Search patterns:", [...new Set(searchUrls)].slice(0, 5));
  } catch {}
}

await browser.close();
