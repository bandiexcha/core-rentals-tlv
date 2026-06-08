#!/usr/bin/env node
/**
 * Broad web discovery for Sea N' Rent inventory (Tel Aviv).
 * Sources: DuckDuckGo, Bing, Booking.com search — not limited to seanrent.com.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src/data/seanrent-urls.json");

const SEARCH_QUERIES = [
  'site:booking.com/hotel/il "Sea N Rent" Tel Aviv',
  'site:booking.com/hotel/il "Sea N\' Rent" Tel Aviv',
  'site:booking.com "by Sea N Rent" Tel Aviv apartment',
  'site:booking.com "Managed by Sea N\' Rent" Tel Aviv',
  '"Sea N Rent" Tel Aviv apartment booking.com',
  'site:airbnb.com "Sea N Rent" Tel Aviv',
  'site:vrbo.com "Sea N Rent" Tel Aviv',
  'site:booking.seanrent.com accommodations Tel Aviv',
];

const SEANRENT_RE = /sea\s*n[\u2019']?\s*rent/i;
const TLV_RE = /tel\s*aviv|tel-?aviv|yafo|jaffa/i;
const BOOKING_IL = /booking\.com\/hotel\/il\/[a-z0-9-]+\.html/i;

function normalizeUrl(url) {
  try {
    const u = new URL(url.split("?")[0]);
    if (u.hostname.includes("booking.com")) {
      return u.origin + u.pathname.replace(/\.en-gb\.html$/, ".html");
    }
    return u.origin + u.pathname;
  } catch {
    return url.split("?")[0];
  }
}

function extractUrlsFromHtml(html) {
  const found = new Set();
  for (const m of html.matchAll(/https?:\/\/[^\s"'<>]+/g)) {
    let u = m[0].replace(/&amp;/g, "&");
    if (BOOKING_IL.test(u)) found.add(normalizeUrl(u));
    if (/booking\.seanrent\.com\/.*accommodations\//i.test(u)) found.add(normalizeUrl(u));
    if (/airbnb\.com\/rooms\/\d+/i.test(u)) found.add(normalizeUrl(u));
  }
  for (const m of html.matchAll(/uddg=([^&"']+)/g)) {
    try {
      const u = decodeURIComponent(m[1]);
      if (BOOKING_IL.test(u) || /accommodations\//i.test(u)) found.add(normalizeUrl(u));
    } catch {}
  }
  return found;
}

async function searchEngine(page, engine, query) {
  const urls = new Set();
  const encoded = encodeURIComponent(query);

  if (engine === "ddg") {
    await page.goto(`https://html.duckduckgo.com/html/?q=${encoded}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(2000);
    extractUrlsFromHtml(await page.content()).forEach((u) => urls.add(u));
  }

  if (engine === "bing") {
    await page.goto(`https://www.bing.com/search?q=${encoded}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(2000);
    extractUrlsFromHtml(await page.content()).forEach((u) => urls.add(u));
  }

  return urls;
}

async function discoverFromBookingSearch(page) {
  const urls = new Set();
  try {
    await page.goto(
      "https://www.booking.com/searchresults.html?ss=Sea+N+Rent+Tel+Aviv&nflt=ht_id%3D201",
      { waitUntil: "domcontentloaded", timeout: 90000 }
    );
    await page.waitForTimeout(5000);
    const links = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
    for (const link of links) {
      if (BOOKING_IL.test(link)) urls.add(normalizeUrl(link));
    }
  } catch (err) {
    console.warn("  Booking search:", err.message);
  }
  return urls;
}

async function validateBookingProperty(page, url) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3000);
    const info = await page.evaluate(() => {
      const text = document.body?.innerText || "";
      const title =
        document.querySelector("h2.pp-header__title")?.textContent?.trim() ||
        document.querySelector("h1")?.textContent?.trim() ||
        "";
      const isSeaNrent =
        /managed by sea n[\u2019']?\s*rent|by sea n[\u2019']?\s*rent/i.test(text) ||
        /by sea n[\u2019']?\s*rent/i.test(title);
      const isTelAviv =
        /tel aviv|tel-?aviv|yafo|jaffa|ramat aviv|old north|florentin|neve tzedek|dizengoff|gordon|bograshov|hayarkon|carmel|rothschild|kerem|lev ha?ir/i.test(
          text + title + (document.querySelector('[data-testid="address"]')?.textContent || "")
        );
      return { title, isSeaNrent, isTelAviv };
    });
    if (!info.isSeaNrent) return null;
    if (!info.isTelAviv) return null;
    return { url, title: info.title };
  } catch {
    return null;
  }
}

async function main() {
  console.log("🌐 Broad Sea N' Rent discovery (Tel Aviv)...\n");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const candidates = new Set();

  // Seed known URLs from search results
  const seeds = [
    "https://www.booking.com/hotel/il/modern-amp-bright-3br-apt-by-sea-n-rent.html",
    "https://www.booking.com/hotel/il/beachfront-apartments-tel-aviv.html",
    "https://www.booking.com/hotel/il/sea-n-39-rent-ramat-aviv.html",
    "https://www.booking.com/hotel/il/quiet-street-in-a-super-central-location-classic-apt.html",
    "https://www.booking.com/hotel/il/hayarkon-park-cozy-and-charming-stay-by-sea-n-rent.html",
    "https://www.booking.com/hotel/il/hacarmel-market-vibrat-apartment-by-sea-n-rent.html",
    "https://www.booking.com/hotel/il/spacious-apartment-near-dizengoff-by-sea-n-rent.html",
    "https://www.booking.com/hotel/il/cozy-apartment-in-the-heart-of-tlv-by-sea-n-rent.html",
    "https://www.booking.com/hotel/il/stylish-apartment-near-beach-by-sea-n-rent.html",
    "https://www.booking.com/hotel/il/luxury-apartment-tel-aviv-by-sea-n-rent.html",
  ];
  seeds.forEach((u) => candidates.add(normalizeUrl(u)));

  for (const q of SEARCH_QUERIES) {
    console.log(`Query: ${q.slice(0, 70)}...`);
    const ddg = await searchEngine(page, "ddg", q);
    const bing = await searchEngine(page, "bing", q);
    console.log(`  DDG: ${ddg.size} | Bing: ${bing.size}`);
    ddg.forEach((u) => candidates.add(u));
    bing.forEach((u) => candidates.add(u));
  }

  const bookingSearch = await discoverFromBookingSearch(page);
  console.log(`Booking.com search: ${bookingSearch.size} URLs`);
  bookingSearch.forEach((u) => candidates.add(u));

  console.log(`\nCandidate URLs: ${candidates.size}`);
  console.log("Validating Sea N' Rent + Tel Aviv...");

  const valid = [];
  const list = [...candidates];
  for (let i = 0; i < list.length; i++) {
    process.stdout.write(`\r  ${i + 1}/${list.length}`);
    const url = list[i];
    if (!BOOKING_IL.test(url) && !/booking\.seanrent\.com/i.test(url)) continue;
    const result = await validateBookingProperty(page, url);
    if (result) valid.push(result);
  }
  console.log(`\n\nValid Tel Aviv Sea N' Rent properties: ${valid.length}`);

  // Dedupe by normalized title
  const byTitle = new Map();
  for (const item of valid) {
    const key = item.title
      .replace(/\s*by\s+sea n[\u2019']?\s*rent.*/i, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (!byTitle.has(key)) byTitle.set(key, item);
  }

  const deduped = [...byTitle.values()];
  console.log(`After dedup: ${deduped.length} unique properties`);

  const output = {
    discoveredAt: new Date().toISOString(),
    source: "multi-channel-web-discovery",
    count: deduped.length,
    properties: deduped.map((p) => ({ url: p.url, title: p.title })),
    urls: deduped.map((p) => p.url),
  };

  fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + "\n");
  deduped.slice(0, 15).forEach((p) => console.log(`  • ${p.title}\n    ${p.url}`));

  await browser.close();
  console.log(`\n✅ Saved to src/data/seanrent-urls.json`);
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
