#!/usr/bin/env node
/**
 * Remove marketing/branding graphic cards from all apartment galleries.
 * Targets HolyGuest safe-room cards, "Your Home At Home" cards, review slides, etc.
 *
 * Usage: node scripts/cleanup-branding-images.mjs [--dry-run]
 */
import fs from "fs";
import path from "path";
import {
  buildBrandingHashBlocklist,
  filterBrandingImagesAsync,
  resetBrandingHashCache,
} from "./lib/branding-image-detect.mjs";
import { renumberImagesInFolder } from "./lib/branding-cleanup.mjs";
import { IMAGES_DIR, loadCatalog, saveCatalog } from "./lib/catalog-store.mjs";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  resetBrandingHashCache();
  const catalog = loadCatalog();
  const blocklist = buildBrandingHashBlocklist(IMAGES_DIR, catalog, 5);

  console.log(
    `\n🖼  Branding image cleanup${dryRun ? " (dry run)" : ""} — ${catalog.apartments.length} apartments`
  );
  console.log(`   Blocklist: ${blocklist.size} duplicate template hashes\n`);

  let totalRemoved = 0;
  let apartmentsAffected = 0;

  for (const apt of catalog.apartments) {
    const dir = path.join(IMAGES_DIR, apt.slug);
    if (!fs.existsSync(dir)) continue;

    const currentImages =
      apt.images?.length > 0
        ? apt.images
        : fs
            .readdirSync(dir)
            .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
            .sort()
            .map((f, i) => ({
              url: `/apartments/${apt.slug}/${f}`,
              alt: `Apartment photo ${i + 1}`,
            }));

    if (!currentImages.length) continue;

    const filtered = await filterBrandingImagesAsync(
      currentImages,
      IMAGES_DIR,
      apt.slug,
      blocklist
    );

    if (filtered.length === currentImages.length) continue;

    const removed = currentImages.length - filtered.length;
    totalRemoved += removed;
    apartmentsAffected++;

    if (!dryRun) {
      for (const img of currentImages) {
        if (filtered.includes(img)) continue;
        const rel = img.url?.replace(/^\/apartments\//, "") || "";
        const fp = path.join(IMAGES_DIR, rel);
        if (fs.existsSync(fp)) {
          try {
            fs.unlinkSync(fp);
          } catch {}
        }
      }

      apt.images = renumberImagesInFolder(IMAGES_DIR, apt.slug);
      for (let i = 0; i < apt.images.length && i < filtered.length; i++) {
        if (filtered[i]?.sourceUrl) apt.images[i].sourceUrl = filtered[i].sourceUrl;
      }
    }

    console.log(
      `  ✓ ${apt.slug}: ${currentImages.length} → ${filtered.length} (-${removed} graphic cards)`
    );
  }

  if (!dryRun) saveCatalog(catalog);

  console.log("\n📊 Summary");
  console.log(`   Apartments cleaned: ${apartmentsAffected}`);
  console.log(`   Graphic cards removed: ${totalRemoved}`);
  console.log(dryRun ? "\n(dry run — no files changed)\n" : "\n✅ Catalog saved\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
