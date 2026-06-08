import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const requests = [];

page.on("request", (req) => {
  const u = req.url();
  if (/Autocomplete|autocomplete|place|shine-api.*search/i.test(u)) {
    requests.push({ url: u, method: req.method() });
  }
});

page.on("response", async (res) => {
  const u = res.url();
  if (/Autocomplete|autocomplete|shine-api.*search/i.test(u)) {
    let preview = "";
    try {
      preview = JSON.stringify(await res.json()).slice(0, 400);
    } catch {}
    requests.push({ url: u, status: res.status(), preview });
  }
});

await page.goto("https://booking.seanrent.com/s", { waitUntil: "networkidle", timeout: 120000 });

// Wait for Google Maps to initialize
await page.waitForFunction(() => typeof window.google?.maps?.places !== "undefined", { timeout: 60000 }).catch(() => {
  console.log("Google Maps places not loaded");
});

await page.waitForTimeout(2000);

const input = page.locator('input[placeholder="Location"]').first();
await input.click({ force: true });
await input.press("Control+a");
await input.press("Backspace");
await page.keyboard.type("Tel Aviv", { delay: 120 });
await page.waitForTimeout(6000);

const pacCount = await page.locator(".pac-item").count();
console.log("PAC items:", pacCount);

// Try MUI listbox / autocomplete options
const options = await page.locator('[role="option"], .pac-item, li[class*="option"]').allTextContents();
console.log("Options:", options.slice(0, 10));

console.log("\nRelevant requests:");
for (const r of requests) console.log(r);

await browser.close();
