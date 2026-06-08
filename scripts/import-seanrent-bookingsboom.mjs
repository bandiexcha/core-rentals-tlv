#!/usr/bin/env node
/**
 * Import full Sea N' Rent inventory from BookingsBoom API.
 * Resume-safe — saves catalog + progress after every listing.
 *
 * Usage:
 *   node scripts/import-seanrent-bookingsboom.mjs
 *   node scripts/import-seanrent-bookingsboom.mjs --status
 */
import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import {
  bookingsBoomApartmentId,
  bookingsBoomSourceUrl,
  importBookingsBoomListing,
  obtainBookingsBoomSession,
} from "./lib/bookingsboom-importer.mjs";
import { loadCatalog } from "./lib/catalog-store.mjs";
import {
  bookingsBoomKey,
  loadDiscovery,
  saveDiscovery,
  saveProgress,
} from "./lib/seanrent-discovery-store.mjs";
import { randomDelay, sleep } from "./lib/import-utils.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROGRESS_FILE = path.join(ROOT, "src/data/seanrent-import-progress.json");

function loadImportProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) {
    return { imported: {}, failed: {}, lastListingId: null, stats: { ok: 0, fail: 0, skipped: 0 } };
  }
  return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
}

function saveImportProgress(progress) {
  progress.updatedAt = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2) + "\n");
}

function markImported(progress, listingId, meta) {
  progress.imported[String(listingId)] = {
    ...meta,
    importedAt: new Date().toISOString(),
  };
  progress.lastListingId = listingId;
  progress.stats.ok = Object.keys(progress.imported).length;
  saveImportProgress(progress);
}

function markFailed(progress, listingId, error) {
  progress.failed[String(listingId)] = {
    error,
    failedAt: new Date().toISOString(),
  };
  progress.stats.fail = Object.keys(progress.failed).length;
  saveImportProgress(progress);
}

function isAlreadyImported(listingId, progress, catalog) {
  const aptId = bookingsBoomApartmentId(listingId);
  return catalog.apartments.some(
    (a) =>
      a.source === "seanrent" &&
      (a.id === aptId || a.internalSourceUrl === bookingsBoomSourceUrl(listingId)) &&
      (a.images?.length ?? 0) > 0
  );
}

function getBookingsBoomListingIds(discovery) {
  return Object.values(discovery.items)
    .filter((i) => i.type === "bookingsboom" && i.id)
    .map((i) => i.id)
    .sort((a, b) => a - b);
}

function printStatus() {
  const catalog = loadCatalog();
  const sr = catalog.apartments.filter((a) => a.source === "seanrent");
  const bb = sr.filter((a) => a.discoveryChannel === "bookingsboom" || a.id.startsWith("seanrent-bb-"));
  const imgs = sr.reduce((n, a) => n + (a.images?.length || 0), 0);
  const progress = loadImportProgress();
  const discovery = loadDiscovery();

  console.log("\n📊 Sea N' Rent import status");
  console.log(`   BookingsBoom discovered: ${getBookingsBoomListingIds(discovery).length}`);
  console.log(`   Imported (progress file): ${progress.stats.ok}`);
  console.log(`   Failed (progress file): ${progress.stats.fail}`);
  console.log(`   Skipped: ${progress.stats.skipped}`);
  console.log(`   Catalog — Sea N' Rent total: ${sr.length}`);
  console.log(`   Catalog — BookingsBoom: ${bb.length}`);
  console.log(`   Catalog — images: ${imgs}`);
}

async function main() {
  if (process.argv.includes("--reset-failed")) {
    const progress = loadImportProgress();
    progress.failed = {};
    progress.stats.fail = 0;
    saveImportProgress(progress);
    console.log("Cleared failed import records");
  }

  if (process.argv.includes("--status")) {
    printStatus();
    return;
  }

  const discovery = loadDiscovery();
  const listingIds = getBookingsBoomListingIds(discovery);

  if (!listingIds.length) {
    console.error("No BookingsBoom listings in discovery store. Run: npm run discover:seanrent -- --channel=bookingsboom");
    process.exit(1);
  }

  let progress = loadImportProgress();
  const catalog = loadCatalog();

  const pending = listingIds.filter((id) => !isAlreadyImported(id, progress, catalog));
  progress.stats.skipped = listingIds.length - pending.length;
  saveImportProgress(progress);

  console.log(`\n📥 BookingsBoom import: ${pending.length} pending (${listingIds.length} total, ${progress.stats.skipped} already done)\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let sessionId =
    discovery.progress?.bookingsboom?.sessionId || (await obtainBookingsBoomSession(page));

  // Ensure browser session is warm before API calls
  await page.goto("https://seanrent.bookingsboom.com/?lang=en", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await sleep(2000);
  if (!sessionId) sessionId = await obtainBookingsBoomSession(page);

  const data = loadDiscovery();
  saveProgress(data, "bookingsboom", { sessionId });

  try {
    for (let i = 0; i < pending.length; i++) {
      const listingId = pending[i];
      progress = loadImportProgress();

      if (isAlreadyImported(listingId, progress, loadCatalog())) {
        progress.stats.skipped++;
        saveImportProgress(progress);
        continue;
      }

      console.log(`[${i + 1}/${pending.length}] Listing #${listingId}`);

      try {
        const { apartment, action, imageCount } = await importBookingsBoomListing(
          page,
          listingId,
          sessionId,
          { publish: true }
        );

        markImported(progress, listingId, {
          name: apartment.name,
          slug: apartment.slug,
          images: imageCount,
          action,
        });

        // Mark in discovery store
        const disc = loadDiscovery();
        const key = bookingsBoomKey(listingId);
        if (disc.items[key]) {
          disc.items[key].importStatus = "imported";
          disc.items[key].importedAt = new Date().toISOString();
          disc.items[key].catalogSlug = apartment.slug;
          saveDiscovery(disc);
        }

        saveProgress(loadDiscovery(), "import-bookingsboom", {
          lastListingId: listingId,
          importedCount: progress.stats.ok,
          pendingCount: pending.length - i - 1,
        });

        console.log(`  ✓ ${action}: ${apartment.name} (${imageCount} images)`);
        await randomDelay(1500, 3500);

        if ((i + 1) % 15 === 0) {
          console.log("  ↻ Proactive session refresh...");
          sessionId = await obtainBookingsBoomSession(page);
          saveProgress(loadDiscovery(), "bookingsboom", { sessionId });
        }
      } catch (err) {
        console.error(`  ✗ ${err.message}`);

        // Retry once after session refresh on fetch errors
        if (/401|403|session|fetch|Failed to fetch/i.test(err.message)) {
          console.log("  ↻ Refreshing session and retrying...");
          sessionId = await obtainBookingsBoomSession(page);
          saveProgress(loadDiscovery(), "bookingsboom", { sessionId });
          try {
            const { apartment, action, imageCount } = await importBookingsBoomListing(
              page,
              listingId,
              sessionId,
              { publish: true }
            );
            progress = loadImportProgress();
            delete progress.failed[String(listingId)];
            progress.stats.fail = Object.keys(progress.failed).length;
            markImported(progress, listingId, {
              name: apartment.name,
              slug: apartment.slug,
              images: imageCount,
              action,
              retried: true,
            });
            console.log(`  ✓ ${action} (retry): ${apartment.name} (${imageCount} images)`);
            await randomDelay(1500, 3500);
            continue;
          } catch (retryErr) {
            console.error(`  ✗ Retry failed: ${retryErr.message}`);
          }
        }

        progress = loadImportProgress();
        markFailed(progress, listingId, err.message);
        await randomDelay(3000, 6000);
      }

      if ((i + 1) % 10 === 0) {
        printStatus();
      }
    }
  } finally {
    await browser.close();
  }

  const finalCatalog = loadCatalog();
  saveProgress(loadDiscovery(), "import-bookingsboom", { complete: true });

  printStatus();
  console.log("\n🧹 Running post-import branding cleanup...");
  const { execSync } = await import("child_process");
  execSync("node scripts/cleanup-branding.mjs", { stdio: "inherit", cwd: process.cwd() });

  console.log("\n✅ BookingsBoom import complete");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
