#!/usr/bin/env node
/**
 * Discover Sea N' Rent Booking.com URLs via Revyoos property names + direct search.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src/data/seanrent-urls.json");

const EXTRA_SEEDS = [
  "https://www.booking.com/hotel/il/sea-n-39-rent-ramat-aviv.html",
  "https://www.booking.com/hotel/il/hacarmel-market-vibrat-apartment-by-sea-n-rent.html",
  "https://www.booking.com/hotel/il/modern-amp-bright-3br-apt-by-sea-n-rent.html",
  "https://www.booking.com/hotel/il/beachfront-apartments-tel-aviv.html",
  "https://www.booking.com/hotel/il/quiet-street-in-a-super-central-location-classic-apt.html",
  "https://www.booking.com/hotel/il/hayarkon-park-cozy-and-charming-stay-by-sea-n-rent.html",
];

async function scrapeRevyoosNames(page) {
  await page.goto("https://www.revyoos.com/reviews/seanrent", {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(3000);

  for (let i = 0; i < 15; i++) {
    const btn = page.locator('button:has-text("Load more"), a:has-text("Load more")').first();
    if (await btn.count()) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(2000);
    } else break;
  }

  const text = await page.evaluate(() => document.body.innerText);
  const names = new Set();
  for (const m of text.matchAll(/Stayed in (.+?)(?:\n|$)/g)) {
    const name = m[1].trim();
    if (name.length > 3 && name.length < 120) names.add(name);
  }
  return [...names];
}

async function findBookingUrl(page, propertyName) {
  // Skip non-Israel properties
  if (/firenze|florence|italy|paris|france|courchevel|rome|milano|miami|new york/i.test(propertyName))
    return null;

  const query = encodeURIComponent(`site:booking.com/hotel/il "${propertyName}" Sea N Rent`);
  await page.goto(`https://html.duckduckgo.com/html/?q=${query}`, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await page.waitForTimeout(1500);

  const html = await page.content();
  for (const m of html.matchAll(/uddg=([^&"']+)/g)) {
    try {
      const u = decodeURIComponent(m[1]);
      if (/booking\.com\/hotel\/il\/[a-z0-9-]+\.html/i.test(u)) {
        return u.split("?")[0].replace(".en-gb.html", ".html");
      }
    } catch {}
  }
  return null;
}

async function validateUrl(page, url) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2000);
    return await page.evaluate(() => {
      const text = document.body?.innerText || "";
      const title =
        document.querySelector("h2.pp-header__title")?.textContent?.trim() || "";
      return (
        /managed by sea n/i.test(text) &&
        /tel aviv|yafo|jaffa|ramat aviv|hayarkon|gordon|dizengoff|florentin|rothschild|carmel|israel/i.test(
          text + title
        )
      );
    });
  } catch {
    return false;
  }
}

async function main() {
  console.log("🔍 Revyoos + Booking.com discovery...\n");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const urls = new Map(); // url -> title

  for (const seed of EXTRA_SEEDS) urls.set(seed, seed);

  const names = await scrapeRevyoosNames(page);
  console.log(`Revyoos property names: ${names.length}`);
  console.log(names.slice(0, 15).join("\n"));

  const tlvNames = names.filter((n) =>
    /tel aviv|tel-?aviv|yafo|gordon|hayarkon|dizengoff|bograshov|rothschild|florentin|neve|mapu|frishman|trumpeldor|ben yehuda|sirkin|graham|sheinkin|kalischer|lev/i.test(
      n
    )
  );
  console.log(`\nTel Aviv-ish names: ${tlvNames.length}`);

  // Search booking for each name (limit to avoid rate limits)
  const toSearch = [...new Set([...tlvNames, ...names.slice(0, 80)])].slice(0, 100);
  for (let i = 0; i < toSearch.length; i++) {
    const name = toSearch[i];
    process.stdout.write(`\r  Searching ${i + 1}/${toSearch.length}: ${name.slice(0, 40)}...`);
    const url = await findBookingUrl(page, name);
    if (url && !urls.has(url)) {
      const ok = await validateUrl(page, url);
      if (ok) urls.set(url, name);
    }
  }
  console.log(`\n\nFound ${urls.size} validated Booking.com URLs`);

  // Merge with existing
  let existing = { urls: [] };
  if (fs.existsSync(OUT)) existing = JSON.parse(fs.readFileSync(OUT, "utf8"));
  const merged = new Set([...(existing.urls || []), ...urls.keys()]);

  const output = {
    discoveredAt: new Date().toISOString(),
    source: "revyoos+booking.com+seeds",
    count: merged.size,
    urls: [...merged].sort(),
  };
  fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + "\n");
  console.log(`✅ Total URLs saved: ${merged.size}`);
  [...merged].slice(0, 20).forEach((u) => console.log(" ", u));

  await browser.close();
}

main();
