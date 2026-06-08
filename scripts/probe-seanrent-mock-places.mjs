import { chromium } from "playwright";
import fs from "fs";

const TEL_AVIV = {
  place_id: "ChIJd8BlQ2BZAhMRLaV0iv9bA4",
  description: "Tel Aviv-Yafo, Israel",
  lat: 32.0853,
  lng: 34.7818,
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.route("**/maps/api/place/**", async (route) => {
  const url = route.request().url();
  if (url.includes("Autocomplete")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        predictions: [
          {
            description: TEL_AVIV.description,
            place_id: TEL_AVIV.place_id,
            structured_formatting: {
              main_text: "Tel Aviv-Yafo",
              secondary_text: "Israel",
            },
          },
        ],
        status: "OK",
      }),
    });
  }
  if (url.includes("Details") || url.includes("details")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: {
          place_id: TEL_AVIV.place_id,
          formatted_address: TEL_AVIV.description,
          geometry: { location: { lat: TEL_AVIV.lat, lng: TEL_AVIV.lng } },
          address_components: [
            { long_name: "Tel Aviv-Yafo", types: ["locality"] },
            { long_name: "Israel", types: ["country"] },
          ],
        },
        status: "OK",
      }),
    });
  }
  return route.continue();
});

const searchHits = [];
page.on("response", async (res) => {
  const u = res.url();
  if (!/shine-api\.maveriks\.com\/search/i.test(u)) return;
  try {
    const json = await res.json();
    searchHits.push({
      url: u,
      count: json.data?.length ?? 0,
      total: json.meta?.total ?? 0,
      first: json.data?.[0],
    });
  } catch {}
});

await page.goto("https://booking.seanrent.com/s", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(3000);

const loc = page.locator('input[placeholder="Location"]').first();
await loc.click({ force: true });
await loc.fill("Tel Aviv");
await page.waitForTimeout(2500);

const pacCount = await page.locator(".pac-item").count();
console.log("PAC items (mocked):", pacCount);

if (pacCount > 0) {
  await page.locator(".pac-item").first().click();
  await page.waitForTimeout(2000);
}

await page.locator('button:has-text("Search")').last().click().catch(() => {});
await page.waitForTimeout(15000);

for (let i = 0; i < 8; i++) {
  await page.evaluate(() => window.scrollBy(0, 1000));
  await page.waitForTimeout(2000);
}

const links = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
const propertyLinks = [...new Set(links)].filter((h) =>
  /accommodation|\/s\/[a-z0-9-]+/i.test(h)
);

console.log("Search hits with data:", searchHits.filter((h) => h.count > 0));
console.log("Total search requests:", searchHits.length);
console.log("Property links:", propertyLinks.length);
console.log(propertyLinks.slice(0, 10));

fs.writeFileSync("tmp-sn-mock-search.json", JSON.stringify({ searchHits, propertyLinks }, null, 2));
await browser.close();
