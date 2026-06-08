import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const captured = [];
page.on("request", (req) => {
  const u = req.url();
  if (/shine-api|maveriks|web-api/i.test(u)) {
    captured.push({ type: "req", method: req.method(), url: u, post: req.postData()?.slice(0, 500) });
  }
});
page.on("response", async (res) => {
  const u = res.url();
  if (/shine-api|maveriks|web-api/i.test(u)) {
    let body = "";
    try {
      body = (await res.text()).slice(0, 500);
    } catch {}
    captured.push({ type: "res", status: res.status(), url: u, body });
  }
});

await page.goto("https://booking.seanrent.com/s", { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(3000);

// Try setting location input and dispatching events
await page.evaluate(() => {
  const input = document.querySelector('input[placeholder="Location"]');
  if (!input) return;
  input.value = "Tel Aviv-Yafo, Israel";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.waitForTimeout(4000);

// Try clicking search
const btn = page.locator('button:has-text("Search")').last();
if (await btn.count()) await btn.click();
await page.waitForTimeout(12000);

console.log("Captured", captured.length, "API calls");
for (const c of captured.slice(0, 20)) {
  console.log(JSON.stringify(c));
}

// Check for accommodation links in DOM
const links = await page.$$eval("a[href]", (as) =>
  as.map((a) => a.href).filter((h) => /accommodation|listing|property/i.test(h))
);
console.log("DOM accommodation links:", links.length, links.slice(0, 15));

await browser.close();
