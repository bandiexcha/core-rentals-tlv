import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto("https://booking.seanrent.com/s", { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(5000);

// Extract config from page
const config = await page.evaluate(() => {
  const scripts = [...document.querySelectorAll("script")].map((s) => s.textContent || "");
  const combined = scripts.join("\n");
  const company = combined.match(/company[_-]?id["']?\s*[:=]\s*["']([a-f0-9-]+)/i)?.[1];
  const website = combined.match(/website[_-]?id["']?\s*[:=]\s*["']([a-f0-9-]+)/i)?.[1];
  return { company, website, title: document.title };
});
console.log("Config:", config);

const captured = [];
page.on("request", (req) => {
  const u = req.url();
  if (/shine-api\.maveriks\.com\/search/i.test(u)) {
    captured.push({ url: u, post: req.postData() });
  }
});

// Try triggering search via page evaluate with Tel Aviv coords
const searchResults = await page.evaluate(async () => {
  const tries = [
    "https://shine-api.maveriks.com/search?page=1&per_page=100&filter[exact_match]=0&filter[latitude]=32.0853&filter[longitude]=34.7818&filter[radius]=50",
    "https://shine-api.maveriks.com/search?page=1&per_page=100&filter[exact_match]=0&filter[place_id]=ChIJd8BlQ2BZAhMRLaV0iv9bA4",
    "https://shine-api.maveriks.com/search?page=1&per_page=100&filter[exact_match]=0&filter[location]=Tel%20Aviv",
    "https://shine-api.maveriks.com/search?page=1&per_page=100&filter[exact_match]=0&filter[city]=Tel%20Aviv",
    "https://shine-api.maveriks.com/search?page=1&per_page=100&filter[exact_match]=0&filter[destination]=Tel%20Aviv%2C%20Israel",
    "https://shine-api.maveriks.com/search?page=1&per_page=100&filter[exact_match]=0&filter[search]=Tel%20Aviv",
  ];
  const out = [];
  for (const url of tries) {
    const res = await fetch(url, { credentials: "include" });
    const text = await res.text();
    let count = 0;
    try {
      count = JSON.parse(text).data?.length ?? 0;
    } catch {}
    out.push({ url: url.split("filter")[1], status: res.status, count });
  }
  return out;
});
console.log("Search tries:", searchResults);

// Try headed-style: use keyboard on location after typing slowly
await page.locator('input[placeholder="Location"]').first().click({ force: true });
await page.keyboard.type("Tel Aviv-Yafo, Israel", { delay: 80 });
await page.waitForTimeout(5000);

const pacCount = await page.locator(".pac-item").count();
console.log("PAC count after slow type:", pacCount);

if (pacCount > 0) {
  await page.locator(".pac-item").first().click();
  await page.waitForTimeout(2000);
  await page.locator('button:has-text("Search")').last().click();
  await page.waitForTimeout(15000);
  console.log("Captured search requests:", captured);
}

await browser.close();
