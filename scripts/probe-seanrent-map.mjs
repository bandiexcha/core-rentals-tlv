import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const apiHits = [];

page.on("response", async (res) => {
  const u = res.url();
  if (!/maveriks|shine-api|web-api/i.test(u)) return;
  const ct = res.headers()["content-type"] || "";
  if (!ct.includes("json")) return;
  try {
    const json = await res.json();
    const count = json.data?.length ?? (Array.isArray(json) ? json.length : null);
    if (count > 0 || json.slug || json.name) {
      apiHits.push({ url: u, count, keys: Object.keys(json).slice(0, 8), sample: JSON.stringify(json).slice(0, 200) });
    }
  } catch {}
});

// Try map search page with Tel Aviv region
await page.goto(
  "https://booking.seanrent.com/en-US/s?city=tel-aviv&country=IL&currency=USD&region=%7B%22city%22%3A%22tel-aviv%22%2C%22country%22%3A%22IL%22%7D",
  { waitUntil: "networkidle", timeout: 120000 }
);
await page.waitForTimeout(8000);

// Click map markers if any
const markers = await page.locator('[class*="marker"], [role="button"][aria-label*="property"], img[alt*="marker"]').count();
console.log("Map markers:", markers);

// Extract all links and slugs from page
const html = await page.content();
const slugs = [...new Set([...html.matchAll(/\/s\/accommodations\/([a-zA-Z0-9_-]{6,})/g)].map((m) => m[1]))];
console.log("Slugs in HTML:", slugs.length, slugs.slice(0, 15));

// Try web-api company endpoints from browser
const endpoints = await page.evaluate(async () => {
  const company = "619a7443-b289-4b3c-a37a-44985fe8f329";
  const website = "dac79519-a73b-4a6e-9e09-9be8257eeeba";
  const tries = [
    `https://web-api.maveriks.com/companies/${company}/accommodations?page=1&per_page=100`,
    `https://web-api.maveriks.com/websites/${website}/accommodations?page=1&per_page=100`,
    `https://web-api.maveriks.com/companies/${company}/properties?page=1&per_page=100`,
    `https://shine-api.maveriks.com/companies/${company}/accommodations?page=1&per_page=100`,
    `https://shine-api.maveriks.com/websites/${website}/accommodations?page=1&per_page=100`,
  ];
  const out = [];
  for (const url of tries) {
    const res = await fetch(url, {
      credentials: "include",
      headers: {
        referer: "https://booking.seanrent.com/",
        "x-host": "booking.seanrent.com",
        accept: "application/json",
      },
    });
    const text = await res.text();
    out.push({ url, status: res.status, preview: text.slice(0, 250) });
  }
  return out;
});

console.log("\nAPI endpoints:");
for (const e of endpoints) console.log(e.status, e.url.split("maveriks.com/")[1], e.preview.slice(0, 120));

console.log("\nNetwork JSON hits:", apiHits.length);
apiHits.forEach((h) => console.log(h));

await browser.close();
