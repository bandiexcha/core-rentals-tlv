import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const hits = [];

page.on("response", async (res) => {
  const u = res.url();
  if (!/maveriks/i.test(u)) return;
  const ct = res.headers()["content-type"] || "";
  if (!ct.includes("json")) return;
  try {
    const json = await res.json();
    const str = JSON.stringify(json);
    if (/accommodation|listing|property|apartment/i.test(str) && str.length > 200) {
      hits.push({ url: u, preview: str.slice(0, 400) });
    }
  } catch {}
});

const pages = [
  "https://booking.seanrent.com/s",
  "https://booking.seanrent.com/en-US/s?city=tel-aviv&country=IL",
  "https://booking.seanrent.com/en-US/s?propertyType=%5B%22apartment%22%5D",
];

for (const url of pages) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(5000);
}

// Try web-api paths
const paths = await page.evaluate(async () => {
  const website = "dac79519-a73b-4a6e-9e09-9be8257eeeba";
  const company = "619a7443-b289-4b3c-a37a-44985fe8f329";
  const tries = [
    `https://web-api.maveriks.com/v1/websites/${website}`,
    `https://web-api.maveriks.com/v1/companies/${company}`,
    `https://web-api.maveriks.com/v1/websites/${website}/accommodations`,
    `https://web-api.maveriks.com/v1/companies/${company}/accommodations`,
    `https://shine-api.maveriks.com/v1/websites/${website}/accommodations`,
    `https://shine-api.maveriks.com/v1/companies/${company}/accommodations`,
    `https://shine-api.maveriks.com/websites/${website}/accommodations?page=1&per_page=100`,
    `https://shine-api.maveriks.com/companies/${company}/accommodations?page=1&per_page=100`,
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
    out.push({ url, status: res.status, body: (await res.text()).slice(0, 300) });
  }
  return out;
});

console.log("API paths:");
paths.forEach((p) => console.log(p.status, p.url.split("maveriks.com/")[1], p.body.slice(0, 100)));

console.log("\nNetwork hits:", hits.length);
hits.forEach((h) => console.log(h.url, h.preview));

await browser.close();
