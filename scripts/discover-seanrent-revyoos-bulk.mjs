#!/usr/bin/env node
/**
 * Resolve Revyoos property names + Bing/DDG bulk search → Booking.com URLs.
 * Booking.com direct search is blocked in automation; search engines work better.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src/data/seanrent-urls.json");
const BOOKING_IL = /booking\.com\/hotel\/il\/([a-z0-9-]+)\.html/i;

function normalize(url) {
  try {
    const u = new URL(url.split("?")[0]);
    return u.origin + u.pathname.replace(/\.en-gb\.html$/, ".html");
  } catch {
    return url.split("?")[0];
  }
}

function extractFromHtml(html) {
  const urls = new Set();
  for (const m of html.matchAll(/uddg=([^&"']+)/g)) {
    try {
      const u = decodeURIComponent(m[1]);
      if (BOOKING_IL.test(u)) urls.add(normalize(u));
    } catch {}
  }
  for (const m of html.matchAll(/https?:\/\/www\.booking\.com\/hotel\/il\/[a-z0-9-]+\.html/gi)) {
    urls.add(normalize(m[0]));
  }
  for (const m of html.matchAll(/\/hotel\/il\/[a-z0-9-]+\.html/gi)) {
    urls.add(normalize(`https://www.booking.com${m[0]}`));
  }
  return urls;
}

async function scrapeRevyoosNames(page) {
  await page.goto("https://www.revyoos.com/reviews/seanrent", {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(3000);
  for (let i = 0; i < 50; i++) {
    const btn = page.locator('button:has-text("Load more"), a:has-text("Load more")').first();
    if (await btn.count()) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(1500);
    } else {
      await page.evaluate(() => window.scrollBy(0, 3000));
      await page.waitForTimeout(800);
    }
  }
  const html = await page.content();
  const text = await page.evaluate(() => document.body.innerText);
  const names = [...text.matchAll(/Stayed in (.+?)(?:\n|$)/g)].map((m) => m[1].trim());
  const embedded = extractFromHtml(html);
  return { names: [...new Set(names)], embedded };
}

async function searchEngine(page, engine, query, pageNum = 0) {
  const encoded = encodeURIComponent(query);
  let url;
  if (engine === "bing") {
    url = pageNum
      ? `https://www.bing.com/search?q=${encoded}&first=${1 + pageNum * 10}`
      : `https://www.bing.com/search?q=${encoded}`;
  } else {
    url = pageNum
      ? `https://html.duckduckgo.com/html/?q=${encoded}&s=${pageNum * 30}`
      : `https://html.duckduckgo.com/html/?q=${encoded}`;
  }
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1500);
    return extractFromHtml(await page.content());
  } catch (err) {
    console.warn(`\n  ${engine} search failed: ${err.message.slice(0, 60)}`);
    return new Set();
  }
}

async function validateBooking(page, url) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2000);
    return page.evaluate(() => {
      const text = document.body?.innerText || "";
      const title =
        document.querySelector("h2.pp-header__title")?.textContent?.trim() || "";
      const seaN = /managed by sea n|by sea n[\u2019']?\s*rent|sea n[\u2019']?\s*rent/i.test(
        text + title
      );
      const tlv =
        /tel aviv|tel-?aviv|yafo|jaffa|ramat aviv|israel|gordon|dizengoff|florentin|rothschild|hayarkon|carmel|neve tzedek|lev ha?ir|old north|bograshov|trumpeldor|sheinkin|ben yehuda|graham|mapu|frishman|kerem|sarona|jaffa port|namal|rothschild|balfour|mazeh|arlozorov|weitzman|idelson|geula|cordovero|dizengoff|hashmonaim|shats|rupin|nordau|yefet|ahad ha.?am/i.test(
          text + title
        );
      return seaN && tlv;
    });
  } catch {
    return false;
  }
}

async function main() {
  console.log("🔍 Revyoos + search engine discovery...\n");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const candidates = new Set();

  const seeds = [
    "https://www.booking.com/hotel/il/beachfront-apartments-tel-aviv.html",
    "https://www.booking.com/hotel/il/hacarmel-market-vibrat-apartment-by-sea-n-rent.html",
    "https://www.booking.com/hotel/il/hayarkon-park-cozy-and-charming-stay-by-sea-n-rent.html",
    "https://www.booking.com/hotel/il/modern-amp-bright-3br-apt-by-sea-n-rent.html",
    "https://www.booking.com/hotel/il/quiet-street-in-a-super-central-location-classic-apt.html",
    "https://www.booking.com/hotel/il/sea-n-39-rent-ramat-aviv.html",
  ];
  seeds.forEach((u) => candidates.add(u));

  const { names, embedded } = await scrapeRevyoosNames(page);
  embedded.forEach((u) => candidates.add(u));
  console.log(`Revyoos: ${names.length} names, ${embedded.size} embedded links`);

  const tlvNames = names.filter(
    (n) =>
      /tel aviv|tel-?aviv|yafo|jaffa|#\d+/i.test(n) &&
      !/firenze|florence|italy|paris|miami|rome|milano|courchevel|haifa|netanya|via panicale/i.test(
        n
      )
  );
  console.log(`Tel Aviv names to resolve: ${tlvNames.length}`);

  for (let i = 0; i < tlvNames.length; i++) {
    const name = tlvNames[i];
    process.stdout.write(`\r  Name ${i + 1}/${tlvNames.length}: ${name.slice(0, 40)}...`);
    for (const q of [
      `site:booking.com/hotel/il "${name}"`,
      `site:booking.com/hotel/il "${name}" "Sea N Rent"`,
    ]) {
      const found = await searchEngine(page, "ddg", q);
      found.forEach((u) => candidates.add(u));
      await page.waitForTimeout(800);
    }
  }

  const bulkQueries = [
    'site:booking.com/hotel/il "by Sea N Rent" Tel Aviv',
    'site:booking.com/hotel/il "Sea N\' Rent" Tel Aviv',
    'site:booking.com/hotel/il "Managed by Sea N Rent" Tel Aviv',
    'site:booking.com/hotel/il "Sea N Rent" apartment Tel Aviv',
    '"Sea N Rent" Tel Aviv site:booking.com/hotel/il',
  ];
  console.log("\n\nBulk search queries...");
  for (const q of bulkQueries) {
    process.stdout.write(`\r  ${q.slice(0, 60)}...`);
    for (let p = 0; p < 3; p++) {
      const found = await searchEngine(page, "ddg", q, p);
      found.forEach((u) => candidates.add(u));
      if (!found.size) break;
      await page.waitForTimeout(1000);
    }
  }

  console.log(`\n\nCandidates: ${candidates.size}. Validating...`);
  const valid = [];
  const list = [...candidates];
  for (let i = 0; i < list.length; i++) {
    process.stdout.write(`\r  ${i + 1}/${list.length}`);
    if (await validateBooking(page, list[i])) valid.push(list[i]);
  }
  console.log(`\n\nValidated: ${valid.length}`);

  let existing = { urls: [] };
  if (fs.existsSync(OUT)) existing = JSON.parse(fs.readFileSync(OUT, "utf8"));
  const merged = [...new Set([...(existing.urls || []), ...valid])].sort();

  fs.writeFileSync(
    OUT,
    JSON.stringify(
      {
        discoveredAt: new Date().toISOString(),
        source: "revyoos+search-engines",
        count: merged.length,
        bookingCom: merged,
        urls: merged,
      },
      null,
      2
    ) + "\n"
  );

  valid.slice(0, 20).forEach((u) => console.log(" ", u));
  console.log(`\n✅ Saved ${merged.length} URLs`);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
