#!/usr/bin/env node
/** Revert accidental -2/-3 slugs and align catalog URLs with on-disk galleries. */
import fs from "fs";
import path from "path";
import { IMAGES_DIR, loadCatalog, saveCatalog } from "./lib/catalog-store.mjs";

function baseSlugFrom(slug) {
  return slug.replace(/-(\d+)$/, "");
}

function rewriteImageUrls(images, fromSlug, toSlug) {
  if (!images?.length || fromSlug === toSlug) return images;
  const from = `/apartments/${fromSlug}/`;
  const to = `/apartments/${toSlug}/`;
  return images.map((img) => ({
    ...img,
    url: img.url?.startsWith(from) ? img.url.replace(from, to) : img.url,
  }));
}

function moveGallery(fromSlug, toSlug) {
  const fromDir = path.join(IMAGES_DIR, fromSlug);
  const toDir = path.join(IMAGES_DIR, toSlug);

  if (fs.existsSync(fromDir) && fs.existsSync(toDir)) {
    fs.rmSync(toDir, { recursive: true, force: true });
    fs.renameSync(fromDir, toDir);
    return "moved";
  }
  if (fs.existsSync(fromDir)) {
    fs.renameSync(fromDir, toDir);
    return "moved";
  }
  if (fs.existsSync(toDir)) return "catalog-only";
  return "missing";
}

function main() {
  const catalog = loadCatalog();
  const slugOwners = new Map(catalog.apartments.map((a) => [a.slug, a.id]));
  let fixed = 0;
  let skipped = 0;

  for (const apt of catalog.apartments) {
    if (apt.source !== "seanrent" || !/-\d+$/.test(apt.slug)) continue;

    const base = baseSlugFrom(apt.slug);
    const owner = slugOwners.get(base);
    if (owner && owner !== apt.id) {
      skipped++;
      continue;
    }

    const oldSlug = apt.slug;
    apt.slug = base;
    apt.images = rewriteImageUrls(apt.images, oldSlug, base);
    slugOwners.delete(oldSlug);
    slugOwners.set(base, apt.id);

    const action = moveGallery(oldSlug, base);
    console.log(`  ${oldSlug} → ${base} (${action})`);
    fixed++;
  }

  saveCatalog(catalog);
  console.log(`\n✅ Fixed ${fixed} slugs (${skipped} kept due to name collision)\n`);
}

main();
