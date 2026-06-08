#!/usr/bin/env node
/** Re-download HolyGuest galleries from Guesty CDN sourceUrl fields. */
import fs from "fs";
import path from "path";
import {
  KNOWN_BRANDING_HASHES,
  filterBrandingImagesAsync,
} from "./lib/branding-image-detect.mjs";
import { renumberImagesInFolder } from "./lib/branding-cleanup.mjs";
import { IMAGES_DIR, loadCatalog, saveCatalog } from "./lib/catalog-store.mjs";

async function download(url, dest) {
  const res = await fetch(url, {
    headers: { "User-Agent": "CoreRentalsTLV-Restore/1.0" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function restoreApartment(apt) {
  const urls = [
    ...new Set(
      (apt.images || [])
        .map((i) => i.sourceUrl)
        .filter((u) => u && /^https?:\/\//i.test(u))
    ),
  ];
  if (!urls.length) return { slug: apt.slug, status: "skip-no-sourceUrl", count: apt.images?.length || 0 };

  const dir = path.join(IMAGES_DIR, apt.slug);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const staged = [];
  let idx = 1;
  for (const sourceUrl of urls) {
    const tmp = path.join(dir, `${String(idx).padStart(2, "0")}.jpg`);
    try {
      await download(sourceUrl, tmp);
      staged.push({
        url: `/apartments/${apt.slug}/${path.basename(tmp)}`,
        alt: `Apartment photo ${idx}`,
        sourceUrl,
      });
      idx++;
    } catch {}
  }

  const filtered = await filterBrandingImagesAsync(
    staged,
    IMAGES_DIR,
    apt.slug,
    KNOWN_BRANDING_HASHES,
    { definiteOnly: true, safeMinKeep: 3 }
  );

  for (const img of staged) {
    if (filtered.some((f) => f.url === img.url)) continue;
    const rel = img.url.replace(/^\/apartments\//, "");
    const fp = path.join(IMAGES_DIR, rel);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }

  apt.images = renumberImagesInFolder(IMAGES_DIR, apt.slug);
  for (let i = 0; i < apt.images.length && i < filtered.length; i++) {
    if (filtered[i]?.sourceUrl) apt.images[i].sourceUrl = filtered[i].sourceUrl;
  }

  return {
    slug: apt.slug,
    status: "restored",
    count: apt.images.length,
    removed: staged.length - filtered.length,
  };
}

async function pool(items, fn, n = 8) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const x = i++;
        out[x] = await fn(items[x]);
        if (out[x]?.status === "restored") {
          console.log(`  ✓ ${out[x].slug}: ${out[x].count} photos (${out[x].removed} brand cards removed)`);
        }
      }
    })
  );
  return out;
}

async function main() {
  const catalog = loadCatalog();
  const hg = catalog.apartments.filter((a) => a.source === "holyguest");
  console.log(`\n🔄 Restoring ${hg.length} HolyGuest galleries from CDN...\n`);
  const results = await pool(hg, restoreApartment, 10);
  saveCatalog(catalog);
  const restored = results.filter((r) => r.status === "restored");
  console.log(`\n✅ Restored ${restored.length} apartments, ${restored.reduce((s, r) => s + r.count, 0)} photos\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
