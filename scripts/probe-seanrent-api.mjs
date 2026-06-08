import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const hits = [];

page.on("response", async (res) => {
  const u = res.url();
  if (!/shine-api|maveriks|web-api/i.test(u)) return;
  const ct = res.headers()["content-type"] || "";
  if (!ct.includes("json")) return;
  try {
    const json = JSON.parse(await res.text());
    hits.push({ url: u, keys: Object.keys(json), dataLen: json.data?.length });
  } catch {}
});

// Try direct accommodation URL patterns
const testUrls = [
  "https://booking.seanrent.com/s/accommodations",
  "https://booking.seanrent.com/s/en/accommodations",
];

for (const url of testUrls) {
  console.log("\nVisit", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(5000);
}

console.log("\nJSON hits:", hits);

await browser.close();
