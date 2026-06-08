#!/usr/bin/env node
/**
 * Resume HolyGuest import until catalog is complete.
 * Never clears existing apartments — only imports missing ones.
 */
import { chromium } from "playwright";
import { importHolyGuestCatalog } from "./lib/guesty-importer.mjs";
import { loadCatalog } from "./lib/catalog-store.mjs";
import { randomDelay } from "./lib/import-utils.mjs";

const MAX_PASSES = 10;
const TARGET = 170;

function countHolyGuest() {
  const catalog = loadCatalog();
  return catalog.apartments.filter((a) => a.source === "holyguest" && a.images?.length > 0).length;
}

function countImages() {
  const catalog = loadCatalog();
  return catalog.apartments
    .filter((a) => a.source === "holyguest")
    .reduce((s, a) => s + (a.images?.length || 0), 0);
}

async function main() {
  const startCount = countHolyGuest();
  console.log(`\n🏁 Resume HolyGuest import — starting with ${startCount} apartments in catalog\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    for (let pass = 1; pass <= MAX_PASSES; pass++) {
      const before = countHolyGuest();
      if (before >= TARGET) {
        console.log(`\n✅ Catalog complete: ${before}/${TARGET} HolyGuest apartments`);
        break;
      }

      console.log(`\n══════ Pass ${pass}/${MAX_PASSES} (${before}/${TARGET} done) ══════`);
      await importHolyGuestCatalog(page, { publish: true });

      const after = countHolyGuest();
      if (after >= TARGET) {
        console.log(`\n✅ Catalog complete: ${after}/${TARGET} HolyGuest apartments`);
        break;
      }
      if (after === before) {
        console.warn(`\n⚠ No progress this pass (${after}/${TARGET}). Waiting before retry...`);
        await randomDelay(30000, 45000);
      } else {
        await randomDelay(8000, 15000);
      }
    }
  } finally {
    await browser.close();
  }

  const final = countHolyGuest();
  const images = countImages();
  console.log(`\n══════════════════════════════════════`);
  console.log(`Final HolyGuest count: ${final}/${TARGET}`);
  console.log(`Total images: ${images}`);
  console.log(`Added this run: ${final - startCount}`);
  console.log(`══════════════════════════════════════\n`);

  if (final < TARGET) {
    console.warn(`Still missing ${TARGET - final} — re-run: node scripts/resume-holyguest.mjs`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
