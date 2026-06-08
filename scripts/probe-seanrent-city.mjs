import { chromium } from "playwright";

const SEARCH_URL =
  "https://booking.seanrent.com/en-US/s?city=tel-aviv&country=IL&currency=USD&region=%7B%22city%22%3A%22tel-aviv%22%2C%22country%22%3A%22IL%22%7D";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto(SEARCH_URL, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(3000);

const urls = [
  "search?page=1&per_page=100&filter[country_code]=IL&filter[city]=tel-aviv&filter[exact_match]=0",
  "search?page=1&per_page=100&filter[country_code]=IL&filter[city]=tel-aviv&filter[is_partner]=0&filter[exact_match]=0",
  "search?page=1&per_page=100&filter[country_code]=IL&filter[city]=tel-aviv&filter[exact_match]=0&filter[deal_type_slug]=inquiry-short-term",
  "search?page=1&per_page=100&filter[country_code]=IL&filter[city]=tel-aviv&filter[exact_match]=0&filter[only_company]=619a7443-b289-4b3c-a37a-44985fe8f329",
  "search?page=1&per_page=100&filter[country_code]=IL&filter[city]=tel-aviv&filter[exact_match]=0&filter[website_id]=dac79519-a73b-4a6e-9e09-9be8257eeeba",
  "search?page=1&per_page=100&filter[country_code]=IL&filter[city]=Tel%20Aviv&filter[exact_match]=0",
  "search?page=1&per_page=100&filter[country_code]=IL&filter[city]=tel-aviv-yafo&filter[exact_match]=0",
];

const results = await page.evaluate(async (paths) => {
  const base = "https://shine-api.maveriks.com/";
  const out = [];
  for (const p of paths) {
    const res = await fetch(base + p, { credentials: "include" });
    const text = await res.text();
    let count = 0;
    let total = 0;
    let first = null;
    try {
      const json = JSON.parse(text);
      count = json.data?.length ?? 0;
      total = json.meta?.total ?? 0;
      first = json.data?.[0];
    } catch {
      out.push({ status: res.status, error: text.slice(0, 80), p });
      continue;
    }
    out.push({
      status: res.status,
      count,
      total,
      name: first?.name || first?.title,
      slug: first?.slug || first?.id,
      p,
    });
  }
  return out;
}, urls);

for (const r of results) console.log(JSON.stringify(r));

await browser.close();
