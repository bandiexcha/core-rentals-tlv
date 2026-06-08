import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto("https://www.seanrent.com/", { waitUntil: "networkidle", timeout: 120000 });
const html = await page.content();
const scriptUrls = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);

const uuids = new Set();
for (const rel of scriptUrls) {
  const url = rel.startsWith("http") ? rel : `https://www.seanrent.com${rel.startsWith("/") ? "" : "/"}${rel}`;
  try {
    const text = await (await page.request.get(url)).text();
    for (const m of text.matchAll(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi)) {
      uuids.add(m[0]);
    }
  } catch {}
}

console.log("UUIDs found:", uuids.size);

// Test first 20 as accommodation URLs
const sample = [...uuids].slice(0, 30);
const valid = [];

for (const id of sample) {
  const url = `https://booking.seanrent.com/s/accommodations/${id}`;
  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    const title = await page.title();
    const is404 = title.includes("404") || res.status() === 404;
    if (!is404 && !title.includes("Search Accommodations")) {
      valid.push({ id, title, url });
      console.log("VALID:", title, url);
    }
  } catch {}
}

console.log("\nValid accommodation URLs:", valid.length);
await browser.close();
