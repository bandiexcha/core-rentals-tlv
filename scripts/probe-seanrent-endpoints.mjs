import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto("https://booking.seanrent.com/s", { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(3000);

const html = await page.content();
const companyId = html.match(/619a7443-b289-4b3c-a37a-44985fe8f329/)?.[0];
const websiteId = html.match(/dac79519-a73b-4a6e-9e09-9be8257eeeba/)?.[0];
console.log("IDs:", { companyId, websiteId });

const endpoints = [
  "https://shine-api.maveriks.com/filter-attributes?filter[purpose]=searching&filter[typeable_slug]=inquiry-short-term&filter[typeable_type]=deal_type",
  "https://shine-api.maveriks.com/accommodations?page=1&per_page=100",
  "https://shine-api.maveriks.com/accommodations?filter[company_id]=619a7443-b289-4b3c-a37a-44985fe8f329&page=1&per_page=100",
  "https://shine-api.maveriks.com/accommodations?filter[website_id]=dac79519-a73b-4a6e-9e09-9be8257eeeba&page=1&per_page=100",
  "https://shine-api.maveriks.com/listings?page=1&per_page=100",
  "https://shine-api.maveriks.com/units?page=1&per_page=100",
  "https://shine-api.maveriks.com/search?page=1&per_page=100&filter[exact_match]=0&filter[filter_attributes][location]=Tel%20Aviv",
  "https://shine-api.maveriks.com/search?page=1&per_page=100&filter[exact_match]=0&filter[north]=32.15&filter[south]=32.02&filter[east]=34.85&filter[west]=34.72",
  "https://shine-api.maveriks.com/search?page=1&per_page=100&filter[exact_match]=0&filter[deal_type_slug]=inquiry-short-term",
  "https://shine-api.maveriks.com/search?page=1&per_page=100&filter[exact_match]=0&filter[typeable_slug]=inquiry-short-term&filter[typeable_type]=deal_type",
  "https://shine-api.maveriks.com/search?page=1&per_page=100&filter[exact_match]=0&filter[website_id]=dac79519-a73b-4a6e-9e09-9be8257eeeba",
  "https://shine-api.maveriks.com/search?page=1&per_page=100&filter[exact_match]=0&filter[company_id]=619a7443-b289-4b3c-a37a-44985fe8f329",
  "https://shine-api.maveriks.com/search?page=1&per_page=100&filter[exact_match]=0&filter[location_name]=Tel%20Aviv-Yafo",
  "https://shine-api.maveriks.com/search?page=1&per_page=100&filter[exact_match]=0&filter[location][name]=Tel%20Aviv",
  "https://shine-api.maveriks.com/search?page=1&per_page=100&filter[exact_match]=0&filter[location][latitude]=32.0853&filter[location][longitude]=34.7818&filter[location][radius]=50",
];

const results = await page.evaluate(async (urls) => {
  const out = [];
  for (const url of urls) {
    const res = await fetch(url, { credentials: "include" });
    const text = await res.text();
    let count = 0;
    let total = null;
    try {
      const json = JSON.parse(text);
      count = json.data?.length ?? 0;
      total = json.meta?.total ?? null;
    } catch {}
    out.push({ status: res.status, count, total, url: url.replace("https://shine-api.maveriks.com/", "") });
  }
  return out;
}, endpoints);

for (const r of results) {
  if (r.count > 0 || r.total > 0) console.log("✓", r);
  else console.log(" ", r.status, r.count, r.url.slice(0, 90));
}

await browser.close();
