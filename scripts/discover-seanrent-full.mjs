#!/usr/bin/env node
/**
 * Full Sea N' Rent discovery — all public inventory channels.
 * Uses headed browser for anti-bot sources (Booking.com, booking.seanrent.com).
 *
 * Channels:
 *  1. booking.seanrent.com Maveriks API (Tel Aviv pagination)
 *  2. Booking.com brand/partner listings (206+ properties link)
 *  3. Booking.com search pagination (Tel Aviv + Sea N Rent)
 *  4. Revyoos property names → Booking.com URL resolution
 *  5. Airbnb / VRBO syndicated (search engines)
 *  6. Broad DDG/Bing web queries
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { discoverSeanRentFromSearch } from "./lib/seanrent-importer.mjs";
import { SOURCE_CONFIG, sleep } from "./lib/import-utils.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "src/data/seanrent-urls.json");
const HEADED = !process.argv.includes("--headless");

const BOOKING_IL = /booking\.com\/hotel\/il\/[a-z0-9-]+\.html/i;
const SEANRENT_ACC = /booking\.seanrent\.com\/(?:en-US\/)?s\/accommodations\//i;
const AIRBNB_ROOM = /airbnb\.com\/rooms\/\d+/i;

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

function loadExisting() {
  if (!fs.existsSync(OUT)) return { urls: [], bookingSeanrent: [], airbnb: [] };
  const data = JSON.parse(fs.readFileSync(OUT, "utf8"));
  return {
    urls: data.urls || [],
    bookingSeanrent: data.bookingSeanrent || [],
    airbnb: data.airbnb || [],
    properties: data.properties || [],
  };
}

function extractBookingUrls(html) {
  const found = new Set();
  for (const m of html.matchAll(/https?:\/\/[^\s"'<>]+/g)) {
    const u = m[0].replace(/&amp;/g, "&");
    if (BOOKING_IL.test(u)) found.add(normalizeUrl(u));
  }
  for (const m of html.matchAll(/\/hotel\/il\/[a-z0-9-]+\.html/gi)) {
    found.add(normalizeUrl(`https://www.booking.com${m[0]}`));
  }
  for (const m of html.matchAll(/uddg=([^&"']+)/g)) {
    try {
      const u = decodeURIComponent(m[1]);
      if (BOOKING_IL.test(u)) found.add(normalizeUrl(u));
    } catch {}
  }
  return found;
}

async function discoverBookingPartner(page, store) {
  console.log("\n📋 Channel 2: Booking.com partner / brand listings...");
  const seeds = [
    "https://www.booking.com/hotel/il/sea-n-39-rent-ramat-aviv.html",
    "https://www.booking.com/hotel/il/beachfront-apartments-tel-aviv.html",
  ];

  for (const seed of seeds) {
    try {
      await page.goto(seed, { waitUntil: "domcontentloaded", timeout: 120000 });
      await sleep(5000);

      const partnerLinks = await page.evaluate(() =>
        [...document.querySelectorAll("a[href]")]
          .map((a) => ({ href: a.href, text: a.textContent?.trim() || "" }))
          .filter(
            (l) =>
              /\d+\s*propert|all propert|more from|managed by|brand|partner|see all|view all/i.test(
                l.text + l.href
              ) || /hotel\/il\//i.test(l.href)
          )
      );

      for (const link of partnerLinks.slice(0, 8)) {
        if (!link.href.startsWith("http")) continue;
        try {
          await page.goto(link.href, { waitUntil: "domcontentloaded", timeout: 90000 });
          await sleep(4000);
          for (let scroll = 0; scroll < 8; scroll++) {
            await page.evaluate(() => window.scrollBy(0, 2500));
            await sleep(1500);
          }
          const links = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
          links.filter((u) => BOOKING_IL.test(u)).forEach((u) => store.booking.add(normalizeUrl(u)));
        } catch {}
      }

      const click206 = page.locator('a:has-text("206"), a:has-text("properties")').first();
      if (await click206.count()) {
        await click206.click().catch(() => {});
        await sleep(6000);
        for (let i = 0; i < 10; i++) {
          await page.evaluate(() => window.scrollBy(0, 2000));
          await sleep(1200);
        }
        const after = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
        after.filter((u) => BOOKING_IL.test(u)).forEach((u) => store.booking.add(normalizeUrl(u)));
      }
    } catch (err) {
      console.warn("  Partner seed error:", err.message);
    }
  }
  console.log(`  Partner listings: ${store.booking.size} booking.com URLs`);
}

async function discoverBookingPagination(page, store) {
  console.log("\n📋 Channel 3: Booking.com search pagination...");
  const searches = [
    "https://www.booking.com/searchresults.html?ss=Sea+N%27+Rent&dest_id=-781899&dest_type=city&group_adults=2",
    "https://www.booking.com/searchresults.html?ss=Sea+N+Rent+Tel+Aviv&dest_id=-781899&dest_type=city&group_adults=2",
    "https://www.booking.com/searchresults.html?ss=managed+by+Sea+N+Rent&dest_id=-781899&dest_type=city",
  ];

  for (const base of searches) {
    for (let offset = 0; offset <= 300; offset += 25) {
      const url = `${base}&offset=${offset}`;
      process.stdout.write(`\r  offset ${offset} (total ${store.booking.size})`);
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
        await sleep(4000);
        for (let s = 0; s < 4; s++) {
          await page.evaluate(() => window.scrollBy(0, 2000));
          await sleep(1000);
        }

        const links = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
        const before = store.booking.size;
        links.filter((u) => BOOKING_IL.test(u)).forEach((u) => store.booking.add(normalizeUrl(u)));
        if (store.booking.size === before) break;
      } catch (err) {
        console.warn(`\n  Pagination error offset ${offset}:`, err.message);
        break;
      }
    }
  }
  console.log(`\n  After pagination: ${store.booking.size} booking.com URLs`);
}

async function discoverRevyoos(page, store) {
  console.log("\n📋 Channel 4: Revyoos property names...");
  await page.goto("https://www.revyoos.com/reviews/seanrent", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await sleep(4000);

  for (let i = 0; i < 30; i++) {
    const btn = page.locator('button:has-text("Load more"), a:has-text("Load more")').first();
    if (await btn.count()) {
      await btn.click().catch(() => {});
      await sleep(2000);
    } else {
      await page.evaluate(() => window.scrollBy(0, 2000));
      await sleep(1500);
    }
  }

  const names = await page.evaluate(() => {
    const text = document.body.innerText;
    const set = new Set();
    for (const m of text.matchAll(/Stayed in (.+?)(?:\n|$)/g)) {
      const n = m[1].trim();
      if (n.length > 3 && n.length < 140) set.add(n);
    }
    return [...set];
  });

  const tlvNames = names.filter(
    (n) =>
      !/firenze|florence|italy|paris|france|courchevel|rome|milano|miami|new york|london|barcelona/i.test(
        n
      )
  );
  console.log(`  Revyoos names: ${names.length} (${tlvNames.length} non-abroad)`);

  for (let i = 0; i < tlvNames.length; i++) {
    const name = tlvNames[i];
    process.stdout.write(`\r  Resolving ${i + 1}/${tlvNames.length}: ${name.slice(0, 45)}...`);
    const q = encodeURIComponent(`site:booking.com/hotel/il "${name}" "Sea N Rent"`);
    try {
      await page.goto(`https://html.duckduckgo.com/html/?q=${q}`, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
      await sleep(1200);
      extractBookingUrls(await page.content()).forEach((u) => store.booking.add(u));
    } catch {}
  }
  console.log(`\n  After Revyoos: ${store.booking.size} booking.com URLs`);
}

async function discoverWebQueries(page, store) {
  console.log("\n📋 Channel 6: Broad DDG/Bing queries...");
  const queries = [
    'site:booking.com/hotel/il "by Sea N Rent" Tel Aviv',
    'site:booking.com/hotel/il "Sea N\' Rent" apartment',
    'site:booking.com/hotel/il "Managed by Sea N Rent"',
    'site:airbnb.com/rooms "Sea N Rent" Tel Aviv',
    'site:airbnb.com "Sea N Rent" Tel Aviv Israel',
    'site:vrbo.com "Sea N Rent" Tel Aviv',
    'site:booking.seanrent.com accommodations Tel Aviv',
    '"Sea N Rent" Tel Aviv Gordon booking.com',
    '"Sea N Rent" Tel Aviv Dizengoff booking.com',
    '"Sea N Rent" Tel Aviv Florentin booking.com',
    '"Sea N Rent" Tel Aviv Rothschild booking.com',
    '"Sea N Rent" Tel Aviv Hayarkon booking.com',
    '"Sea N Rent" Tel Aviv Neve Tzedek booking.com',
    '"Sea N Rent" Tel Aviv Jaffa booking.com',
    '"Sea N Rent" Tel Aviv beach booking.com',
  ];

  for (const q of queries) {
    process.stdout.write(`\r  Query: ${q.slice(0, 55)}...`);
    for (const engine of ["ddg", "bing"]) {
      const encoded = encodeURIComponent(q);
      const url =
        engine === "ddg"
          ? `https://html.duckduckgo.com/html/?q=${encoded}`
          : `https://www.bing.com/search?q=${encoded}`;
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        await sleep(1500);
        const html = await page.content();
        extractBookingUrls(html).forEach((u) => store.booking.add(u));
        for (const m of html.matchAll(/https?:\/\/[^\s"'<>]+/g)) {
          const u = m[0];
          if (SEANRENT_ACC.test(u)) store.seanrent.add(normalizeUrl(u));
          if (AIRBNB_ROOM.test(u)) store.airbnb.add(normalizeUrl(u));
        }
      } catch {}
    }
  }
  console.log(`\n  Web queries: ${store.booking.size} booking | ${store.airbnb.size} airbnb`);
}

async function validateBookingBatch(page, urls) {
  const valid = [];
  const list = [...urls];
  for (let i = 0; i < list.length; i++) {
    const url = list[i];
    process.stdout.write(`\r  Validating ${i + 1}/${list.length}...`);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await sleep(2500);
      const ok = await page.evaluate(() => {
        const text = document.body?.innerText || "";
        const title =
          document.querySelector("h2.pp-header__title")?.textContent?.trim() ||
          document.querySelector("h1")?.textContent?.trim() ||
          "";
        const isSeaNrent =
          /managed by sea n|by sea n[\u2019']?\s*rent|sea n[\u2019']?\s*rent/i.test(text + title);
        const isTelAviv =
          /tel aviv|tel-?aviv|yafo|jaffa|ramat aviv|israel|gordon|dizengoff|florentin|rothschild|hayarkon|carmel|neve tzedek|lev ha?ir|old north|bograshov|trumpeldor|sheinkin|ben yehuda|graham|mapu|frishman|kerem|sarona|jaffa port|namal|rothschild/i.test(
            text + title
          );
        return isSeaNrent && isTelAviv;
      });
      if (ok) valid.push(url);
    } catch {}
  }
  console.log(`\n  Validated: ${valid.length}/${list.length}`);
  return valid;
}

async function main() {
  console.log(`🔍 Full Sea N' Rent discovery (${HEADED ? "HEADED" : "headless"})...\n`);

  const existing = loadExisting();
  const store = {
    booking: new Set(existing.urls.map(normalizeUrl)),
    seanrent: new Set(existing.bookingSeanrent.map(normalizeUrl)),
    airbnb: new Set(existing.airbnb.map(normalizeUrl)),
  };

  const browser = await chromium.launch({
    headless: !HEADED,
    slowMo: HEADED ? 30 : 0,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1400, height: 900 },
    locale: "en-US",
  });
  const page = await context.newPage();

  // Channel 1: booking.seanrent.com API
  console.log("📋 Channel 1: booking.seanrent.com Maveriks API...");
  try {
    const { urls, payloads } = await discoverSeanRentFromSearch(page, "Tel Aviv, Israel");
    urls.forEach((u) => store.seanrent.add(normalizeUrl(u)));
    for (const item of payloads) {
      const slug = item.slug || item.id || item.uuid;
      if (slug) store.seanrent.add(`https://booking.seanrent.com/s/accommodations/${slug}`);
    }
    console.log(`  Direct SeanRent: ${store.seanrent.size} URLs (${payloads.length} API payloads)`);
  } catch (err) {
    console.warn("  SeanRent API:", err.message);
  }

  await discoverBookingPartner(page, store);
  await discoverBookingPagination(page, store);
  await discoverRevyoos(page, store);
  await discoverWebQueries(page, store);

  // Crawl seanrent.com JS bundles for accommodation slugs
  console.log("\n📋 Channel 7: seanrent.com JS bundle slugs...");
  try {
    await page.goto("https://www.seanrent.com/", { waitUntil: "domcontentloaded", timeout: 90000 });
    await sleep(3000);
    const scripts = await page.$$eval("script[src]", (ss) => ss.map((s) => s.src));
    for (const rel of scripts) {
      if (!/\.js$/i.test(rel)) continue;
      try {
        const res = await page.request.get(rel);
        const text = await res.text();
        for (const m of text.matchAll(/accommodations\/([a-zA-Z0-9_-]{8,})/g)) {
          store.seanrent.add(`https://booking.seanrent.com/s/accommodations/${m[1]}`);
        }
      } catch {}
    }
    console.log(`  After JS crawl: ${store.seanrent.size} SeanRent URLs`);
  } catch (err) {
    console.warn("  JS crawl:", err.message);
  }

  console.log("\n🔎 Validating Booking.com candidates...");
  const bookingCandidates = [...store.booking];
  const validatedBooking = await validateBookingBatch(page, bookingCandidates);

  await browser.close();

  const allUrls = [...new Set([...validatedBooking, ...store.seanrent, ...store.airbnb])].sort();

  const output = {
    discoveredAt: new Date().toISOString(),
    source: "full-multi-channel-headed",
    count: allUrls.length,
    channels: {
      bookingCom: validatedBooking.length,
      bookingSeanrent: store.seanrent.size,
      airbnb: store.airbnb.size,
    },
    urls: allUrls,
    bookingCom: validatedBooking.sort(),
    bookingSeanrent: [...store.seanrent].sort(),
    airbnb: [...store.airbnb].sort(),
  };

  fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + "\n");

  console.log("\n✅ Discovery complete");
  console.log(`   Booking.com (validated): ${validatedBooking.length}`);
  console.log(`   booking.seanrent.com:    ${store.seanrent.size}`);
  console.log(`   Airbnb:                  ${store.airbnb.size}`);
  console.log(`   Total unique URLs:       ${allUrls.length}`);
  console.log(`   Saved: src/data/seanrent-urls.json`);
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
