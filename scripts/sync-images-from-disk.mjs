#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { IMAGES_DIR, loadCatalog, saveCatalog } from "./lib/catalog-store.mjs";

const catalog = loadCatalog();
let fixed = 0;

for (const apt of catalog.apartments) {
  const dir = path.join(IMAGES_DIR, apt.slug);
  if (!fs.existsSync(dir)) continue;

  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort();

  if (!files.length) continue;
  if (apt.images?.length === files.length) continue;

  apt.images = files.map((f, i) => ({
    url: `/apartments/${apt.slug}/${f}`,
    alt: `Apartment photo ${i + 1}`,
  }));
  console.log(`  ✓ ${apt.slug}: ${files.length} images`);
  fixed++;
}

if (fixed) saveCatalog(catalog);
console.log(`\nSynced ${fixed} apartments\n`);
