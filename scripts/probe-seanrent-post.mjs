import { chromium } from "playwright";
import fs from "fs";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto("https://booking.seanrent.com/s", { waitUntil: "networkidle", timeout: 120000 });

const headers = {
  referer: "https://booking.seanrent.com/",
  "x-host": "booking.seanrent.com",
  "x-currency": "USD",
  "x-locale": "en-US",
  accept: "application/json",
  "content-type": "application/json",
};

const filterAttrs = await page.evaluate(async () => {
  const res = await fetch(
    "https://shine-api.maveriks.com/filter-attributes?filter[purpose]=searching&filter[typeable_slug]=inquiry-short-term&filter[typeable_type]=deal_type",
    { credentials: "include" }
  );
  return res.json();
});

console.log("Filter attributes:", filterAttrs.data?.map((d) => d.filter_attribute?.slug || d.filter_attribute?.name));

const bodies = [
  { filter: { country_code: "IL", city: "tel-aviv", exact_match: 0, check_in: "2026-07-01", check_out: "2026-07-08" } },
  { filter: { country_code: "IL", city: "tel-aviv", exact_match: 0, start_date: "2026-07-01", end_date: "2026-07-08" } },
  { filter: { country_code: "IL", city: "tel-aviv", exact_match: 0, company_id: "619a7443-b289-4b3c-a37a-44985fe8f329" } },
  { filters: { country_code: "IL", city: "tel-aviv" }, page: 1, per_page: 100 },
];

for (const body of bodies) {
  const result = await page.evaluate(
    async ({ body, headers }) => {
      const res = await fetch("https://shine-api.maveriks.com/search?page=1&per_page=100", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(body),
      });
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        return { status: res.status, count: json.data?.length, total: json.meta?.total, body };
      } catch {
        return { status: res.status, error: text.slice(0, 100), body };
      }
    },
    { body, headers }
  );
  console.log("POST result:", result);
}

fs.writeFileSync("tmp-sn-filters.json", JSON.stringify(filterAttrs, null, 2));
await browser.close();
