import { chromium } from "playwright";
import fs from "fs";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const responses = [];

page.on("response", async (res) => {
  const u = res.url();
  if (!/shine-api|maveriks|listing|property|search/i.test(u)) return;
  try {
    const ct = res.headers()["content-type"] || "";
    if (!ct.includes("json")) return;
    const body = await res.text();
    responses.push({ url: u, status: res.status(), body: JSON.parse(body) });
  } catch {}
});

await page.goto("https://booking.seanrent.com/s", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(8000);

// Try scrolling to trigger lazy load
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(3000);

console.log("Responses:", responses.length);
for (const r of responses) {
  console.log(r.url, r.status, Array.isArray(r.body?.data) ? r.body.data.length + " items" : typeof r.body);
}

fs.writeFileSync("tmp-sn-api.json", JSON.stringify(responses, null, 2));

// Try direct API calls with company id from HTML
const companyId = "619a7443-b289-4b3c-a37a-44985fe8f329";
const websiteId = "dac79519-a73b-4a6e-9e09-9be8257eeeba";

const tries = [
  `https://shine-api.maveriks.com/search?page=1&per_page=50&filter[company_id]=${companyId}`,
  `https://shine-api.maveriks.com/search?page=1&per_page=50&filter[website_id]=${websiteId}`,
  `https://shine-api.maveriks.com/properties?page=1&per_page=50`,
  `https://web-api.maveriks.com/company/${companyId}/listings`,
  `https://web-api.maveriks.com/website/${websiteId}/listings`,
];

for (const url of tries) {
  const res = await page.request.get(url);
  const text = await res.text();
  console.log("\n", url, res.status(), text.slice(0, 300));
}

await browser.close();
