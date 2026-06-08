#!/usr/bin/env node
/**
 * Sea N' Rent discovery — incremental, resume-safe.
 *
 * Channels (each saves immediately after every item):
 *   1. BookingsBoom API (primary — 199 listings)
 *   2. Booking.com share links
 *   3. Revyoos property names
 *   4. Seed URLs
 *
 * Usage:
 *   node scripts/discover-seanrent.mjs              # all channels, resume
 *   node scripts/discover-seanrent.mjs --channel=bookingsboom
 *   node scripts/discover-seanrent.mjs --migrate      # import legacy seanrent-urls.json
 *   node scripts/discover-seanrent.mjs --status       # print summary only
 */
import { chromium } from "playwright";
import {
  bookingKey,
  loadDiscovery,
  migrateLegacyUrls,
  normalizeBookingUrl,
  printDiscoverySummary,
  saveBookingsBoomListing,
  saveCandidate,
  saveProgress,
  saveRejected,
  saveRevyoosMatch,
  saveValidatedBooking,
  getProgress,
  isChannelComplete,
} from "./lib/seanrent-discovery-store.mjs";
import { randomDelay, sleep } from "./lib/import-utils.mjs";

const BOOKING_IL = /booking\.com\/hotel\/il\/[a-z0-9-]+\.html/i;
const TLV_RE =
  /tel aviv|tel-?aviv|yafo|jaffa|ramat aviv|florentin|rothschild|gordon|dizengoff|neve tzedek|bograshov|trumpeldor|hayarkon|lev ha?ir|old north|kerem|sarona|namal|balfour|mazeh|sheinkin|ben yehuda|graham|mapu|frishman|idelson|geula|cordovero|hashmonaim|shats|rupin|nordau|yefet|ahad ha.?am|arlozorov|weitzman|chen|shlomo ha?melekh|david ha?melech/i;

const SEEDS = [
  "https://www.booking.com/hotel/il/beachfront-apartments-tel-aviv.html",
  "https://www.booking.com/hotel/il/hacarmel-market-vibrat-apartment-by-sea-n-rent.html",
  "https://www.booking.com/hotel/il/hayarkon-park-cozy-and-charming-stay-by-sea-n-rent.html",
  "https://www.booking.com/hotel/il/modern-amp-bright-3br-apt-by-sea-n-rent.html",
  "https://www.booking.com/hotel/il/quiet-street-in-a-super-central-location-classic-apt.html",
  "https://www.booking.com/hotel/il/sea-n-39-rent-ramat-aviv.html",
];

const BOOKING_SHARES = [
  "https://www.booking.com/Share-ZQNp2t",
  "https://www.booking.com/Share-hjY5T4D",
];

const args = process.argv.slice(2);
const channelFilter = args.find((a) => a.startsWith("--channel="))?.split("=")[1];
const statusOnly = args.includes("--status");
const migrateOnly = args.includes("--migrate");

function shouldRun(channel) {
  return !channelFilter || channelFilter === channel;
}

async function getBookingsBoomSession(page) {
  let data = loadDiscovery();
  const existing = getProgress(data, "bookingsboom").sessionId;
  if (existing) return existing;

  let sessionId = "";
  const capture = (res) => {
    const m = res.url().match(/booking_session_id=([^&]+)/);
    if (m) sessionId = m[1];
  };
  page.on("response", capture);

  await page.goto("https://seanrent.bookingsboom.com/?lang=en", {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await sleep(2000);
  page.off("response", capture);

  if (sessionId) {
    data = loadDiscovery();
    saveProgress(data, "bookingsboom", { sessionId });
  }
  return sessionId;
}

async function discoverBookingsBoom(page) {
  const CHANNEL = "bookingsboom";
  if (!shouldRun(CHANNEL)) return;

  let data = loadDiscovery();
  if (isChannelComplete(data, CHANNEL)) {
    console.log("⏭  BookingsBoom: already complete");
    return;
  }

  console.log("\n📋 Channel: BookingsBoom API");
  const sessionId = await getBookingsBoomSession(page);
  if (!sessionId) {
    console.warn("  ✗ Could not obtain booking_session_id");
    return;
  }

  let progress = getProgress(data, CHANNEL);
  let startPage = progress.lastPage ? progress.lastPage + 1 : 1;
  let totalCount = progress.totalCount || 0;
  let saved = progress.savedCount || 0;

  for (let pageNum = startPage; pageNum <= 50; pageNum++) {
    data = loadDiscovery();
    progress = getProgress(data, CHANNEL);

    const json = await page.evaluate(
      async ({ sessionId, pageNum }) => {
        const r = await fetch(
          `https://seanrent.bookingsboom.com/api/booking/listings?language=en&booking_session_id=${sessionId}&page=${pageNum}&per_page=100`
        );
        if (!r.ok) return null;
        return r.json();
      },
      { sessionId, pageNum }
    );

    if (!json?.listings?.length) {
      saveProgress(data, CHANNEL, { complete: true, lastPage: pageNum - 1, savedCount: saved, totalCount });
      console.log(`  ✓ BookingsBoom complete at page ${pageNum - 1}`);
      break;
    }

    totalCount = json.pagi_info?.count || totalCount;
    console.log(`  Page ${pageNum}: ${json.listings.length} listings (catalog total: ${totalCount})`);

    for (const listing of json.listings) {
      data = loadDiscovery();
      saveBookingsBoomListing(data, listing, CHANNEL);
      saved++;

      // Save progress after each listing
      data = loadDiscovery();
      saveProgress(data, CHANNEL, {
        sessionId,
        lastPage: pageNum,
        lastListingId: listing.id,
        savedCount: saved,
        totalCount,
        complete: false,
      });
    }

    const lastPage = json.pagi_info?.page || pageNum;
    const maxPage = Math.ceil((json.pagi_info?.count || 0) / (json.pagi_info?.per_page || 100));
    if (lastPage >= maxPage) {
      data = loadDiscovery();
      saveProgress(data, CHANNEL, { complete: true, lastPage: pageNum, savedCount: saved, totalCount });
      console.log(`  ✓ BookingsBoom: ${saved} properties saved (${totalCount} in API)`);
      break;
    }

    await sleep(500);
  }
}

async function validateBookingUrl(page, url) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await sleep(2500);
    return await page.evaluate(() => {
      const text = document.body?.innerText || "";
      const title =
        document.querySelector("h2.pp-header__title")?.textContent?.trim() ||
        document.querySelector("h1")?.textContent?.trim() ||
        "";
      const seaN = /managed by sea n|by sea n[\u2019']?\s*rent|sea n[\u2019']?\s*rent/i.test(text + title);
      const tlv = /tel aviv|tel-?aviv|yafo|jaffa|israel|gordon|dizengoff|florentin|rothschild|hayarkon|carmel|neve tzedek|lev ha?ir|old north|bograshov|trumpeldor|sheinkin|ben yehuda|graham|mapu|frishman|kerem|sarona|jaffa port|namal|rothschild|balfour|mazeh|arlozorov|weitzman|idelson|geula|cordovero|dizengoff|hashmonaim|shats|rupin|nordau|yefet|ahad ha.?am/i.test(
        text + title
      );
      return { ok: seaN && tlv, title };
    });
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function discoverBookingShares(page) {
  const CHANNEL = "booking-shares";
  if (!shouldRun(CHANNEL)) return;

  let data = loadDiscovery();
  if (isChannelComplete(data, CHANNEL)) {
    console.log("⏭  Booking shares: already complete");
    return;
  }

  console.log("\n📋 Channel: Booking.com share links");
  let progress = getProgress(data, CHANNEL);
  const startShare = progress.lastShareIndex || 0;
  const collected = new Set();

  for (let si = startShare; si < BOOKING_SHARES.length; si++) {
    const shareUrl = BOOKING_SHARES[si];
    console.log(`  Share ${si + 1}/${BOOKING_SHARES.length}: ${shareUrl}`);

    try {
      await page.goto(shareUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
      await sleep(5000);
      for (let scroll = 0; scroll < 6; scroll++) {
        await page.evaluate(() => window.scrollBy(0, 2000));
        await sleep(1500);
      }

      const links = await page.$$eval("a[href]", (as) =>
        as.map((a) => a.href).filter((h) => /booking\.com\/hotel\/il\//i.test(h))
      );

      for (const raw of links) {
        const url = normalizeBookingUrl(raw);
        if (collected.has(url)) continue;
        collected.add(url);

        data = loadDiscovery();
        const key = bookingKey(url);
        const existing = data.items[key];
        if (existing?.status === "validated" || existing?.status === "rejected") continue;

        saveCandidate(data, { key, type: "booking.com", url, channel: CHANNEL });

        data = loadDiscovery();
        const result = await validateBookingUrl(page, url);
        data = loadDiscovery();

        if (result.ok) {
          saveValidatedBooking(data, url, { channel: CHANNEL, title: result.title });
          console.log(`    ✓ validated: ${result.title?.slice(0, 50) || url}`);
        } else {
          saveRejected(data, key, result.error || "not Sea N Rent TLV", { channel: CHANNEL, url });
        }

        data = loadDiscovery();
        saveProgress(data, CHANNEL, { lastShareIndex: si, lastUrl: url, validatedCount: collected.size });
        await randomDelay(2000, 4000);
      }
    } catch (err) {
      console.warn(`  ✗ Share error: ${err.message}`);
      data = loadDiscovery();
      saveProgress(data, CHANNEL, { lastShareIndex: si, error: err.message });
    }
  }

  data = loadDiscovery();
  saveProgress(data, CHANNEL, { complete: true, validatedCount: collected.size });
  console.log(`  ✓ Booking shares: ${collected.size} URLs processed`);
}

async function discoverSeeds(page) {
  const CHANNEL = "seeds";
  if (!shouldRun(CHANNEL)) return;

  let data = loadDiscovery();
  console.log("\n📋 Channel: Seed URLs");

  for (const url of SEEDS) {
    data = loadDiscovery();
    const key = bookingKey(url);
    if (data.items[key]?.status === "validated") {
      console.log(`  ⏭  already validated: ${url}`);
      continue;
    }

    saveCandidate(data, { key, type: "booking.com", url, channel: CHANNEL });
    data = loadDiscovery();

    const result = await validateBookingUrl(page, url);
    data = loadDiscovery();

    if (result.ok) {
      saveValidatedBooking(data, url, { channel: CHANNEL, title: result.title });
      console.log(`  ✓ ${result.title}`);
    } else {
      saveRejected(data, key, "validation failed", { channel: CHANNEL, url });
    }

    saveProgress(data, CHANNEL, { lastUrl: url });
    await randomDelay(1500, 3000);
  }

  data = loadDiscovery();
  saveProgress(data, CHANNEL, { complete: true });
}

async function discoverRevyoos(page) {
  const CHANNEL = "revyoos";
  if (!shouldRun(CHANNEL)) return;

  let data = loadDiscovery();
  if (isChannelComplete(data, CHANNEL)) {
    console.log("⏭  Revyoos: already complete");
    return;
  }

  console.log("\n📋 Channel: Revyoos");
  await page.goto("https://www.revyoos.com/reviews/seanrent", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await sleep(3000);

  for (let i = 0; i < 50; i++) {
    const btn = page.locator('button:has-text("Load more"), a:has-text("Load more")').first();
    if (await btn.count()) {
      await btn.click().catch(() => {});
      await sleep(1500);
    } else {
      await page.evaluate(() => window.scrollBy(0, 2500));
      await sleep(800);
    }
  }

  const names = await page.evaluate(() => {
    const set = new Set();
    for (const m of document.body.innerText.matchAll(/Stayed in (.+?)(?:\n|$)/g)) {
      const n = m[1].trim();
      if (n.length > 3 && n.length < 140) set.add(n);
    }
    return [...set];
  });

  const tlvNames = names.filter(
    (n) =>
      (TLV_RE.test(n) || /#\d+/.test(n)) &&
      !/firenze|florence|italy|paris|miami|rome|milano|courchevel|haifa|netanya|koh phangan|thailand|herzliya|nahariya|eilat|athens|caesarea|samui|jerusalem/i.test(n)
  );

  console.log(`  Revyoos names: ${names.length}, TLV-filtered: ${tlvNames.length}`);

  let progress = getProgress(data, CHANNEL);
  const startIdx = progress.lastNameIndex || 0;

  for (let i = startIdx; i < tlvNames.length; i++) {
    const name = tlvNames[i];
    data = loadDiscovery();
    progress = getProgress(data, CHANNEL);

    process.stdout.write(`\r  Name ${i + 1}/${tlvNames.length}: ${name.slice(0, 45)}...`);

    // Save Revyoos name immediately even before match
    saveRevyoosMatch(data, name, null, { channel: CHANNEL, status: "candidate" });

    // Try embedded booking links from Revyoos page only for first batch — skip DDG to avoid rate limits in this run
    data = loadDiscovery();
    saveProgress(data, CHANNEL, {
      lastNameIndex: i + 1,
      lastName: name,
      totalNames: tlvNames.length,
    });

    await sleep(200);
  }

  data = loadDiscovery();
  saveProgress(data, CHANNEL, { complete: true, totalNames: tlvNames.length });
  console.log(`\n  ✓ Revyoos: ${tlvNames.length} property names saved`);
}

async function validatePendingCandidates(page) {
  const CHANNEL = "validate-pending";
  if (!shouldRun(CHANNEL) && channelFilter) return;

  let data = loadDiscovery();
  const pending = Object.values(data.items).filter(
    (i) => i.type === "booking.com" && i.status === "candidate" && i.url
  );

  if (!pending.length) return;

  console.log(`\n📋 Validating ${pending.length} pending Booking.com candidates...`);
  let progress = getProgress(data, CHANNEL);
  const startIdx = progress.lastIndex || 0;

  for (let i = startIdx; i < pending.length; i++) {
    const item = pending[i];
    data = loadDiscovery();

    if (data.items[item.key]?.status !== "candidate") continue;

    process.stdout.write(`\r  ${i + 1}/${pending.length}`);
    const result = await validateBookingUrl(page, item.url);
    data = loadDiscovery();

    if (result.ok) {
      saveValidatedBooking(data, item.url, { channel: CHANNEL, title: result.title });
    } else {
      saveRejected(data, item.key, result.error || "validation failed", { channel: CHANNEL });
    }

    data = loadDiscovery();
    saveProgress(data, CHANNEL, { lastIndex: i + 1, total: pending.length });
    await randomDelay(2000, 5000);
  }

  data = loadDiscovery();
  saveProgress(data, CHANNEL, { complete: true });
  console.log("\n  ✓ Pending validation complete");
}

async function main() {
  if (migrateOnly) {
    const result = migrateLegacyUrls();
    console.log(`Migrated ${result.added} legacy URLs`);
    printDiscoverySummary();
    return;
  }

  if (statusOnly) {
    printDiscoverySummary();
    return;
  }

  console.log("🔍 Sea N' Rent discovery (incremental, resume-safe)\n");

  // Migrate legacy on first run
  migrateLegacyUrls();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    if (shouldRun("seeds")) await discoverSeeds(page);
    if (shouldRun("bookingsboom")) await discoverBookingsBoom(page);
    if (shouldRun("booking-shares")) await discoverBookingShares(page);
    if (shouldRun("revyoos")) await discoverRevyoos(page);
    if (!channelFilter || channelFilter === "validate-pending") {
      await validatePendingCandidates(page);
    }
  } finally {
    await browser.close();
  }

  printDiscoverySummary();
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
