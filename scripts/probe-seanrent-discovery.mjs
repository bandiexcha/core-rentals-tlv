import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const allResponses = [];

page.on("response", async (res) => {
  const u = res.url();
  if (!/maveriks|shine-api|web-api|cdn/i.test(u)) return;
  const ct = res.headers()["content-type"] || "";
  if (ct.includes("json")) {
    try {
      const json = await res.json();
      const count = Array.isArray(json.data) ? json.data.length : Array.isArray(json) ? json.length : null;
      if (count > 0) allResponses.push({ url: u, count, sample: json.data?.[0] || json[0] });
    } catch {}
  }
});

const urls = [
  "https://booking.seanrent.com/s",
  "https://booking.seanrent.com/en-US/s?currency=ILS",
  "https://booking.seanrent.com/s/accommodations",
  "https://www.seanrent.com/apartments/",
  "https://www.seanrent.com/properties/",
];

for (const url of urls) {
  console.log("\n===", url);
  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    console.log("Status:", res?.status());
    await page.waitForTimeout(5000);
    const links = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
    const acc = links.filter((l) => /accommodation|\/s\//i.test(l));
    console.log("Accommodation links:", acc.length, acc.slice(0, 5));
  } catch (e) {
    console.log("Error:", e.message);
  }
}

// Download JS chunks and grep for uuid patterns
const html = await page.content();
const scriptUrls = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
console.log("\nScript URLs:", scriptUrls.length);

for (const rel of scriptUrls.slice(0, 15)) {
  const scriptUrl = rel.startsWith("http") ? rel : new URL(rel, page.url()).href;
  try {
    const res = await page.request.get(scriptUrl);
    const text = await res.text();
    if (/accommodation|listing|property|search/i.test(text)) {
      const uuids = [...text.matchAll(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi)].map((m) => m[0]);
      const slugs = [...text.matchAll(/accommodations\/([a-z0-9-]+)/gi)].map((m) => m[1]);
      if (uuids.length || slugs.length) {
        console.log("Found in", scriptUrl.slice(-60), "uuids:", uuids.length, "slugs:", slugs.length);
      }
    }
  } catch {}
}

console.log("\nJSON responses with data:", allResponses);
await browser.close();
