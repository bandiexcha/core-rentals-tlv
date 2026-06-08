import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const requests = [];

page.on("request", (req) => {
  const u = req.url();
  if (/maps|place|location|search|maveriks|autocomplete/i.test(u)) {
    requests.push({ type: "req", method: req.method(), url: u.slice(0, 200) });
  }
});

page.on("response", async (res) => {
  const u = res.url();
  if (/maps|place|location|search|maveriks|autocomplete/i.test(u)) {
    let preview = "";
    try {
      if ((res.headers()["content-type"] || "").includes("json")) {
        preview = JSON.stringify(await res.json()).slice(0, 300);
      }
    } catch {}
    requests.push({ type: "res", status: res.status(), url: u.slice(0, 200), preview });
  }
});

await page.goto("https://booking.seanrent.com/s", { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(3000);

const inputs = await page.evaluate(() =>
  [...document.querySelectorAll("input")].map((i) => ({
    placeholder: i.placeholder,
    name: i.name,
    id: i.id,
    type: i.type,
    className: i.className.slice(0, 80),
  }))
);
console.log("Inputs:", JSON.stringify(inputs, null, 2));

const loc = page.locator("input").filter({ hasText: "" }).first();
// Try all inputs that look like location
for (const sel of [
  'input[placeholder="Location"]',
  'input[placeholder*="ocation"]',
  'input[name*="location"]',
  'input[type="search"]',
]) {
  const count = await page.locator(sel).count();
  if (count) {
    console.log("\nUsing selector:", sel);
    const input = page.locator(sel).first();
    await input.click({ force: true });
    await input.fill("Tel Aviv");
    await page.waitForTimeout(5000);
    break;
  }
}

console.log("\nRequests after typing:");
for (const r of requests) console.log(r);

await browser.close();
