#!/usr/bin/env node
/** Re-download images for apartments that lost their gallery during branding cleanup. */
import { chromium } from "playwright";
import { loadCatalog, saveCatalog } from "./lib/catalog-store.mjs";
import { importHolyGuestUrl } from "./lib/guesty-importer.mjs";
import { importBookingComUrl } from "./lib/syndicated-importer.mjs";

const MIN_IMAGES = 3;

async function main() {
  const catalog = loadCatalog();
  const needsRestore = catalog.apartments.filter(
    (a) => (a.images?.length || 0) < MIN_IMAGES && a.internalSourceUrl
  );

  if (!needsRestore.length) {
    console.log("No apartments need image restore.");
    return;
  }

  console.log(`\n🖼 Restoring images for ${needsRestore.length} apartments\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const apt of needsRestore) {
    console.log(`  ${apt.slug} (${apt.images?.length || 0} images) — ${apt.internalSourceUrl}`);
    try {
      if (/holyguest\.guestybookings\.com/i.test(apt.internalSourceUrl)) {
        await importHolyGuestUrl(page, apt.internalSourceUrl, {
          publish: apt.published,
          downloadImages: true,
        });
      } else if (/booking\.com\/hotel/i.test(apt.internalSourceUrl)) {
        await importBookingComUrl(page, apt.internalSourceUrl, {
          publish: apt.published,
        });
      } else if (/bookingsboom\.com/i.test(apt.internalSourceUrl)) {
        console.log("    ↷ BookingsBoom — skip (re-run import if needed)");
        continue;
      } else {
        console.log("    ⚠ Unknown source — skip");
        continue;
      }
      const updated = loadCatalog().apartments.find((a) => a.id === apt.id);
      console.log(`    ✓ ${updated?.images?.length || 0} images`);
    } catch (err) {
      console.error(`    ✗ ${err.message}`);
    }
  }

  await browser.close();
  console.log("\n✅ Restore pass complete\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
