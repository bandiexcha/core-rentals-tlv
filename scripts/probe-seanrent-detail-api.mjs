import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto("https://booking.seanrent.com/s", { waitUntil: "networkidle", timeout: 120000 });

// Paginate search with company filter using proper headers
async function fetchSearch(pageNum, extra = "") {
  return page.evaluate(
    async ({ pageNum, extra }) => {
      const url = `https://shine-api.maveriks.com/search?page=${pageNum}&per_page=100&filter[exact_match]=0&filter[company_id]=619a7443-b289-4b3c-a37a-44985fe8f329${extra}`;
      const res = await fetch(url, {
        credentials: "include",
        headers: {
          referer: "https://booking.seanrent.com/",
          "x-host": "booking.seanrent.com",
          "x-currency": "USD",
          "x-locale": "en-US",
          accept: "application/json",
        },
      });
      return { status: res.status, json: await res.json() };
    },
    { pageNum, extra }
  );
}

for (let p = 1; p <= 3; p++) {
  const { status, json } = await fetchSearch(p);
  console.log(`Page ${p}:`, status, json.data?.length, "total:", json.meta?.total);
  if (json.data?.[0]) console.log("  sample:", JSON.stringify(json.data[0]).slice(0, 300));
}

// Try accommodation detail API patterns
const testIds = [
  "619a7443-b289-4b3c-a37a-44985fe8f329",
  "dac79519-a73b-4a6e-9e09-9be8257eeeba",
];

for (const id of testIds) {
  for (const path of [`accommodations/${id}`, `listings/${id}`, `properties/${id}`, `units/${id}`]) {
    const r = await page.evaluate(async (path) => {
      const res = await fetch(`https://shine-api.maveriks.com/${path}`, {
        credentials: "include",
        headers: {
          referer: "https://booking.seanrent.com/",
          "x-host": "booking.seanrent.com",
          accept: "application/json",
        },
      });
      const text = await res.text();
      return { status: res.status, len: text.length, preview: text.slice(0, 100) };
    }, path);
    if (r.status !== 404) console.log(path, r);
  }
}

await browser.close();
