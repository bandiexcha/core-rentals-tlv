import { chromium } from "playwright";

const urls = [
  "https://booking.seanrent.com/s/accommodations",
  "https://booking.seanrent.com/en-US/s?propertyType=%5B%22apartment%22%5D&country=IL&city=tel-aviv",
  "https://booking.seanrent.com/en-US/s?propertyType=%5B%22apartment%22%2C%22bungalow%22%5D",
  "https://b2bapartments.co.il/?b=26749811",
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

for (const url of urls) {
  console.log("\n===", url);
  const hits = [];
  page.removeAllListeners("response");
  page.on("response", async (res) => {
    const u = res.url();
    if (!/shine-api|maveriks/i.test(u)) return;
    try {
      const ct = res.headers()["content-type"] || "";
      if (!ct.includes("json")) return;
      const json = await res.json();
      const count = json.data?.length ?? 0;
      if (count > 0) hits.push({ url: u, count, first: json.data[0]?.name || json.data[0]?.title });
    } catch {}
  });

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(8000);
    const links = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
    const acc = [...new Set(links)].filter((l) => /accommodation|\/s\/[a-z0-9-]{8,}/i.test(l));
    console.log("API hits:", hits);
    console.log("Links:", acc.length, acc.slice(0, 8));
  } catch (e) {
    console.log("Error:", e.message);
  }
}

await browser.close();
