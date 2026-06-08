#!/usr/bin/env node
/** Re-import HolyGuest listings that still have thumbnail-sized broken galleries. */
import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { IMAGES_DIR, loadCatalog } from "./lib/catalog-store.mjs";
import { importHolyGuestUrl } from "./lib/guesty-importer.mjs";

function needsRestore(apt) {
  const dir = path.join(IMAGES_DIR, apt.slug);
  if (!fs.existsSync(dir)) return true;
  const files = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  if (files.length < 3) return true;
  const large = files.filter((f) => fs.statSync(path.join(dir, f)).size >= 30000).length;
  return large < Math.min(3, files.length);
}

async function main() {
  const catalog = loadCatalog();
  const targets = catalog.apartments.filter(
    (a) => a.source === "holyguest" && a.internalSourceUrl && needsRestore(a)
  );

  if (!targets.length) {
    console.log("No HolyGuest apartments need restore.");
    return;
  }

  console.log(`\n🔄 Restoring ${targets.length} HolyGuest galleries...\n`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const apt of targets) {
    console.log(`  ${apt.slug}`);
    try {
      await importHolyGuestUrl(page, apt.internalSourceUrl, {
        publish: apt.published,
        downloadImages: true,
      });
      const fresh = loadCatalog().apartments.find((a) => a.id === apt.id);
      console.log(`    ✓ ${fresh?.images?.length || 0} images`);
    } catch (err) {
      console.error(`    ✗ ${err.message}`);
    }
  }

  await browser.close();
  console.log("\n✅ HolyGuest restore complete\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
