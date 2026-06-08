import { chromium } from "playwright";
import fs from "fs";

async function capture(url, label) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const responses = [];

  page.on("response", async (res) => {
    const u = res.url();
    const ct = res.headers()["content-type"] || "";
    if (!/json|graphql/i.test(ct) && !/api|listing|property|search|maveriks|guesty/i.test(u)) {
      return;
    }
    try {
      const body = await res.text();
      if (body.length > 100 && body.length < 5_000_000) {
        responses.push({ url: u, status: res.status(), body: body.slice(0, 5000) });
      }
    } catch {
      /* ignore */
    }
  });

  console.log(`\n=== Loading ${label}: ${url} ===`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(5000);

  const links = await page.$$eval("a[href]", (as) =>
    as.map((a) => a.href).filter((h) => /property|listing|apartment|\/s\//i.test(h))
  );

  console.log("Property-like links:", [...new Set(links)].slice(0, 15));
  console.log("JSON responses:", responses.length);
  for (const r of responses.slice(0, 8)) {
    console.log(`\n[${r.status}] ${r.url}`);
    console.log(r.body.slice(0, 400));
  }

  fs.writeFileSync(
    `tmp-capture-${label}.json`,
    JSON.stringify({ links: [...new Set(links)], responses: responses.map((r) => ({ url: r.url, status: r.status, preview: r.body.slice(0, 2000) })) }, null, 2)
  );

  await browser.close();
}

await capture("https://holyguest.guestybookings.com/en/properties", "hg");
await capture("https://booking.seanrent.com/s", "sn");
