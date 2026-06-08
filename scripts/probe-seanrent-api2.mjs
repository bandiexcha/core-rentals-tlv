import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto("https://booking.seanrent.com/s", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(5000);

const tries = [
  "https://shine-api.maveriks.com/search?page=1&per_page=50&filter[latitude]=32.0853&filter[longitude]=34.7818&filter[radius]=30",
  "https://shine-api.maveriks.com/search?page=1&per_page=50&filter[city]=Tel%20Aviv",
  "https://shine-api.maveriks.com/search?page=1&per_page=50&filter[destination]=Tel%20Aviv",
  "https://shine-api.maveriks.com/search?page=1&per_page=50&filter[location]=Tel%20Aviv",
  "https://shine-api.maveriks.com/search?page=1&per_page=50&filter[country]=Israel&filter[city]=Tel%20Aviv",
  "https://shine-api.maveriks.com/accommodations?page=1&per_page=50",
  "https://shine-api.maveriks.com/listings?page=1&per_page=50",
];

for (const url of tries) {
  const res = await page.request.get(url, {
    headers: {
      Referer: "https://booking.seanrent.com/",
      Origin: "https://booking.seanrent.com",
      Accept: "application/json",
    },
  });
  const text = await res.text();
  let count = 0;
  try {
    count = JSON.parse(text).data?.length ?? 0;
  } catch {}
  console.log(res.status(), count, url.slice(0, 100));
  if (count > 0) console.log(text.slice(0, 400));
}

await browser.close();
