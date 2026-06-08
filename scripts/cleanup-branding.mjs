#!/usr/bin/env node
/**
 * Remove all HolyGuest / Sea N' Rent branding from the catalog.
 * Usage: node scripts/cleanup-branding.mjs [--dry-run]
 */
import {
  cleanApartment,
  containsBranding,
} from "./lib/branding-cleanup.mjs";
import { IMAGES_DIR, loadCatalog, saveCatalog } from "./lib/catalog-store.mjs";

const dryRun = process.argv.includes("--dry-run");

function main() {
  const catalog = loadCatalog();
  const stats = {
    total: catalog.apartments.length,
    namesFixed: 0,
    slugsFixed: 0,
    descriptionsFixed: 0,
    imagesRemoved: 0,
    stillBranded: [],
  };

  console.log(`\n🧹 Branding cleanup${dryRun ? " (dry run)" : ""} — ${stats.total} apartments\n`);

  for (const apt of catalog.apartments) {
    const before = {
      name: apt.name,
      slug: apt.slug,
      short: apt.shortDescription,
      full: apt.fullDescription,
      imageCount: apt.images?.length || 0,
    };

    const changes = cleanApartment(apt, catalog, IMAGES_DIR);

    if (changes.name) stats.namesFixed++;
    if (changes.slug) stats.slugsFixed++;
    if (changes.descriptions) stats.descriptionsFixed++;
    stats.imagesRemoved += changes.imagesRemoved;

    const branded =
      containsBranding(apt.name) ||
      containsBranding(apt.shortDescription) ||
      containsBranding(apt.fullDescription) ||
      /by-holyguest|by-sea-n/i.test(apt.slug);

    if (branded) {
      stats.stillBranded.push({ slug: apt.slug, name: apt.name });
    }

    if (
      changes.name ||
      changes.slug ||
      changes.descriptions ||
      changes.imagesRemoved
    ) {
      const parts = [];
      if (changes.name) parts.push(`name: "${before.name}" → "${apt.name}"`);
      if (changes.slug) parts.push(`slug: ${before.slug} → ${apt.slug}`);
      if (changes.descriptions) parts.push("descriptions cleaned");
      if (changes.imagesRemoved) {
        parts.push(`images: ${before.imageCount} → ${apt.images?.length || 0}`);
      }
      console.log(`  ✓ ${apt.slug}: ${parts.join("; ")}`);
    }
  }

  if (!dryRun) saveCatalog(catalog);

  console.log("\n📊 Summary");
  console.log(`   Names cleaned:        ${stats.namesFixed}`);
  console.log(`   Slugs renamed:        ${stats.slugsFixed}`);
  console.log(`   Descriptions cleaned: ${stats.descriptionsFixed}`);
  console.log(`   Branding images removed: ${stats.imagesRemoved}`);
  console.log(`   Remaining brand leaks: ${stats.stillBranded.length}`);

  if (stats.stillBranded.length) {
    console.log("\n⚠ Still contains branding:");
    for (const item of stats.stillBranded.slice(0, 20)) {
      console.log(`   - ${item.slug}: ${item.name}`);
    }
    if (stats.stillBranded.length > 20) {
      console.log(`   ... and ${stats.stillBranded.length - 20} more`);
    }
  }

  console.log(dryRun ? "\n(dry run — no files saved)\n" : "\n✅ Catalog saved\n");
}

main();
