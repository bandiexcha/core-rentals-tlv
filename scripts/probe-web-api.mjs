import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto("https://booking.seanrent.com/s", { waitUntil: "networkidle", timeout: 120000 });

const state = await page.evaluate(() => {
  const keys = Object.keys(window).filter((k) =>
    /__|initial|state|config|store|data/i.test(k)
  );
  const out = {};
  for (const k of keys.slice(0, 20)) {
    try {
      const v = window[k];
      if (v && typeof v === "object") out[k] = JSON.stringify(v).slice(0, 500);
    } catch {}
  }
  return out;
});
console.log("Window state keys:", Object.keys(state));

const nextData = await page.evaluate(() => {
  const el = document.getElementById("__NEXT_DATA__");
  return el ? el.textContent?.slice(0, 2000) : null;
});
console.log("__NEXT_DATA__:", nextData?.slice(0, 500));

// Try web-api endpoints from browser
const endpoints = [
  "https://web-api.maveriks.com/company/619a7443-b289-4b3c-a37a-44985fe8f329",
  "https://web-api.maveriks.com/website/dac79519-a73b-4a6e-9e09-9be8257eeeba",
  "https://web-api.maveriks.com/website/dac79519-a73b-4a6e-9e09-9be8257eeeba/accommodations",
  "https://web-api.maveriks.com/website/dac79519-a73b-4a6e-9e09-9be8257eeeba/properties",
  "https://web-api.maveriks.com/website/dac79519-a73b-4a6e-9e09-9be8257eeeba/listings",
  "https://web-api.maveriks.com/company/619a7443-b289-4b3c-a37a-44985fe8f329/accommodations",
  "https://web-api.maveriks.com/company/619a7443-b289-4b3c-a37a-44985fe8f329/properties",
  "https://web-api.maveriks.com/accommodations?filter[website_id]=dac79519-a73b-4a6e-9e09-9be8257eeeba&page=1&per_page=100",
  "https://web-api.maveriks.com/search?filter[website_id]=dac79519-a73b-4a6e-9e09-9be8257eeeba&page=1&per_page=100",
];

const results = await page.evaluate(async (urls) => {
  const out = [];
  for (const url of urls) {
    const res = await fetch(url, { credentials: "include" });
    const text = await res.text();
    let count = 0;
    try {
      const json = JSON.parse(text);
      count = json.data?.length ?? (Array.isArray(json) ? json.length : json.accommodations?.length ?? 0);
    } catch {}
    out.push({ status: res.status, count, url: url.replace("https://web-api.maveriks.com/", ""), sample: text.slice(0, 200) });
  }
  return out;
}, endpoints);

for (const r of results) {
  console.log(r.status, r.count, r.url);
  if (r.count > 0) console.log("SAMPLE:", r.sample);
}

await browser.close();
