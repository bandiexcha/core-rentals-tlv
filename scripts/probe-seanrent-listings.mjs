import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const urls = [
  "https://booking.seanrent.com/s/listings",
  "https://booking.seanrent.com/en-US/s/listings",
  "https://booking.seanrent.com/s/properties",
];

for (const url of urls) {
  console.log("\n===", url);
  page.on("response", async (res) => {
    const u = res.url();
    if (/shine-api|maveriks/i.test(u)) {
      try {
        const ct = res.headers()["content-type"] || "";
        if (ct.includes("json")) {
          const json = await res.json();
          if (json.data?.length) console.log("DATA:", u, json.data.length, json.data[0]?.name);
        }
      } catch {}
    }
  });
  const res = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  console.log("Status:", res?.status(), "Title:", await page.title());
  const links = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
  const acc = links.filter((l) => /accommodation|listing/i.test(l));
  console.log("Links:", acc.slice(0, 10));
  page.removeAllListeners("response");
}

await browser.close();
