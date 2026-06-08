import { chromium } from "playwright";

const SEARCH_URL =
  "https://booking.seanrent.com/en-US/s?city=tel-aviv&country=IL&currency=USD&region=%7B%22city%22%3A%22tel-aviv%22%2C%22country%22%3A%22IL%22%7D";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
let captured = null;

page.on("request", (req) => {
  const u = req.url();
  if (/shine-api\.maveriks\.com\/search/i.test(u) && u.includes("tel-aviv")) {
    captured = { url: u, headers: req.headers() };
  }
});

page.on("response", async (res) => {
  const u = res.url();
  if (/shine-api\.maveriks\.com\/search/i.test(u) && u.includes("tel-aviv")) {
    try {
      const json = await res.json();
      console.log("SPA search:", u);
      console.log("Count:", json.data?.length, "Total:", json.meta?.total);
      if (json.data?.[0]) console.log("First item keys:", Object.keys(json.data[0]));
    } catch {}
  }
});

await page.goto(SEARCH_URL, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(5000);

console.log("\nCaptured URL:", captured?.url);
console.log("Headers:", JSON.stringify(captured?.headers, null, 2));

if (captured) {
  // Try same URL with is_partner=0
  const variants = [
    captured.url.replace("is_partner%5D=1", "is_partner%5D=0"),
    captured.url.replace(/filter%5Bis_partner%5D=1&?/, ""),
    captured.url.replace("exact_match%5D=1", "exact_match%5D=0"),
  ];

  for (const url of variants) {
    const res = await page.evaluate(
      async ({ url, headers }) => {
        const r = await fetch(url, { headers, credentials: "include" });
        const json = await r.json();
        return { status: r.status, count: json.data?.length, total: json.meta?.total, url };
      },
      { url, headers: captured.headers }
    );
    console.log("\nVariant:", res.count, res.total, res.url.slice(0, 120));
  }
}

await browser.close();
