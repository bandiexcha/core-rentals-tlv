import { chromium } from "playwright";

const urls = [
  "https://booking.seanrent.com/s?destination=Tel%20Aviv",
  "https://booking.seanrent.com/s?location=Tel%20Aviv",
  "https://booking.seanrent.com/s/search?query=Tel%20Aviv",
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

for (const url of urls) {
  const responses = [];
  page.removeAllListeners("response");
  page.on("response", async (res) => {
    const u = res.url();
    if (/shine-api|maveriks/i.test(u) && (res.headers()["content-type"] || "").includes("json")) {
      try {
        const json = await res.json();
        if (json.data?.length) responses.push({ url: u, count: json.data.length, id: json.data[0]?.id || json.data[0]?.slug });
      } catch {}
    }
  });
  console.log("\nTrying", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(8000);
  console.log("Responses with data:", responses);
}

await browser.close();
