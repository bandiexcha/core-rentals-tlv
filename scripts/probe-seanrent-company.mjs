import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const headers = {
  referer: "https://booking.seanrent.com/",
  "x-host": "booking.seanrent.com",
  "x-currency": "USD",
  "x-locale": "en-US",
  accept: "application/json",
};

await page.goto("https://booking.seanrent.com/s", { waitUntil: "networkidle", timeout: 120000 });

const paths = [
  "search?page=1&per_page=100&filter[exact_match]=0&filter[company_id]=619a7443-b289-4b3c-a37a-44985fe8f329",
  "search?page=1&per_page=100&filter[exact_match]=0&filter[website_id]=dac79519-a73b-4a6e-9e09-9be8257eeeba",
  "search?page=1&per_page=100&filter[exact_match]=0&filter[owner_id]=619a7443-b289-4b3c-a37a-44985fe8f329",
  "search?page=1&per_page=100&filter[exact_match]=0&filter[organization_id]=619a7443-b289-4b3c-a37a-44985fe8f329",
  "search?page=1&per_page=100&filter[exact_match]=0&filter[brand_id]=619a7443-b289-4b3c-a37a-44985fe8f329",
  "search?page=1&per_page=100&filter[exact_match]=0&filter[provider_id]=619a7443-b289-4b3c-a37a-44985fe8f329",
  "search?page=1&per_page=100&filter[exact_match]=0&filter[host_id]=619a7443-b289-4b3c-a37a-44985fe8f329",
  "search?page=1&per_page=100&filter[exact_match]=0&filter[is_partner]=0&filter[company_id]=619a7443-b289-4b3c-a37a-44985fe8f329",
  "search?page=1&per_page=100&filter[exact_match]=0&filter[is_owned]=1",
  "search?page=1&per_page=100&filter[exact_match]=0&filter[is_internal]=1",
  "search?page=1&per_page=100&filter[exact_match]=0&filter[type]=accommodation",
  "search?page=1&per_page=100&filter[exact_match]=0&filter[deal_type_slug]=inquiry-short-term&filter[company_id]=619a7443-b289-4b3c-a37a-44985fe8f329",
];

const results = await page.evaluate(
  async ({ paths, headers }) => {
    const out = [];
    for (const p of paths) {
      const res = await fetch("https://shine-api.maveriks.com/" + p, {
        headers,
        credentials: "include",
      });
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        out.push({
          status: res.status,
          count: json.data?.length ?? 0,
          total: json.meta?.total ?? 0,
          p,
          first: json.data?.[0]?.name,
        });
      } catch {
        out.push({ status: res.status, error: true, p });
      }
    }
    return out;
  },
  { paths, headers }
);

for (const r of results) {
  if (r.count > 0) console.log("✓", r);
  else console.log(" ", r.status, r.p.slice(0, 80));
}

await browser.close();
