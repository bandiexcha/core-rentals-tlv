#!/usr/bin/env node
/**
 * Restore apartment galleries from sourceUrl / re-import URLs.
 * Then remove ONLY definite branding cards (known hashes + brand URLs).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import {
  KNOWN_BRANDING_HASHES,
  filterBrandingImagesAsync,
  resetBrandingHashCache,
} from "./lib/branding-image-detect.mjs";
import { renumberImagesInFolder } from "./lib/branding-cleanup.mjs";
import { importHolyGuestUrl } from "./lib/guesty-importer.mjs";
import { importBookingBoomListing } from "./lib/bookingsboom-importer.mjs";
import { importBookingComUrl } from "./lib/syndicated-importer.mjs";
import { IMAGES_DIR, loadCatalog, saveCatalog } from "./lib/catalog-store.mjs";
import { randomDelay, sleep } from "./lib/import-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const DEFINITE_ONLY = new Set(KNOWN_BRANDING_HASHES);

async function downloadUrl(url, dest) {
  const res = await fetch(url, {
    headers: { "User-Agent": "CoreRentalsTLV-Restore/1.0" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get("content-type") || "image/jpeg";
  const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
  const finalDest = dest.replace(/\.(jpe?g|png|webp)$/i, `.${ext}`);
  fs.mkdirSync(path.dirname(finalDest), { recursive: true });
  fs.writeFileSync(finalDest, Buffer.from(await res.arrayBuffer()));
  return finalDest;
}

async function restoreFromSourceUrls(apt) {
  const urls = [
    ...new Set(
      (apt.images || [])
        .map((i) => i.sourceUrl)
        .filter((u) => u && /^https?:\/\//i.test(u))
    ),
  ];
  if (!urls.length) return 0;

  const dir = path.join(IMAGES_DIR, apt.slug);
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      try {
        fs.unlinkSync(path.join(dir, f));
      } catch {}
    }
  } else {
    fs.mkdirSync(dir, { recursive: true });
  }

  const saved = [];
  let idx = 1;
  for (const url of urls) {
    try {
      const dest = path.join(dir, `${String(idx).padStart(2, "0")}.jpg`);
      await downloadUrl(url, dest);
      const filename = path.basename(
        fs.readdirSync(dir).find((f) => f.startsWith(String(idx).padStart(2, "0"))) || `${String(idx).padStart(2, "0")}.jpg`
      );
      saved.push({
        url: `/apartments/${apt.slug}/${filename}`,
        alt: `Apartment photo ${idx}`,
        sourceUrl: url,
      });
      idx++;
      await randomDelay(80, 200);
    } catch {}
  }
  apt.images = saved;
  return saved.length;
}

async function removeDefiniteBrandingOnly(apt) {
  const blocklist = DEFINITE_ONLY;
  const filtered = await filterBrandingImagesAsync(
    apt.images || [],
    IMAGES_DIR,
    apt.slug,
    blocklist,
    { definiteOnly: true, safeMinKeep: 3 }
  );

  if (filtered.length === (apt.images?.length || 0)) return 0;

  const keepUrls = new Set(filtered.map((i) => i.url));
  for (const img of apt.images || []) {
    if (keepUrls.has(img.url)) continue;
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

  return (apt.images?.length || 0) - filtered.length;
}

async function main() {
  const catalog = loadCatalog();
  resetBrandingHashCache();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let restored = 0;
  let reimported = 0;
  let brandingRemoved = 0;

  console.log(`\n🔄 Restoring ${catalog.apartments.length} galleries...\n`);

  for (const apt of catalog.apartments) {
    const before = apt.images?.length || 0;

    // 1) Try sourceUrl restore (HolyGuest)
    const fromSrc = await restoreFromSourceUrls(apt);

    // 2) Re-import if still thin
    if ((apt.images?.length || 0) < 3 && apt.internalSourceUrl) {
      try {
        if (/holyguest\.guestybookings\.com/i.test(apt.internalSourceUrl)) {
          await importHolyGuestUrl(page, apt.internalSourceUrl, {
            publish: apt.published,
            downloadImages: true,
          });
          const fresh = loadCatalog().apartments.find((a) => a.id === apt.id);
          if (fresh) Object.assign(apt, fresh);
          reimported++;
        } else if (/bookingsboom\.com/i.test(apt.internalSourceUrl)) {
          const m = apt.internalSourceUrl.match(/listings\/(\d+)/);
          if (m) {
            await importBookingBoomListing(page, m[1], { publish: apt.published });
            const fresh = loadCatalog().apartments.find((a) => a.id === apt.id);
            if (fresh) Object.assign(apt, fresh);
            reimported++;
          }
        } else if (/booking\.com\/hotel/i.test(apt.internalSourceUrl)) {
          await importBookingComUrl(page, apt.internalSourceUrl, { publish: apt.published });
          const fresh = loadCatalog().apartments.find((a) => a.id === apt.id);
          if (fresh) Object.assign(apt, fresh);
          reimported++;
        }
      } catch (err) {
        console.warn(`  ⚠ ${apt.slug} re-import failed: ${err.message}`);
      }
      await sleep(500);
    } else if (fromSrc > 0) {
      restored++;
    }

    const removed = await removeDefiniteBrandingOnly(apt);
    brandingRemoved += Math.max(0, removed);

    const after = apt.images?.length || 0;
    if (after !== before || fromSrc || removed) {
      console.log(
        `  ${apt.slug}: ${before} → ${after} images` +
          (fromSrc ? ` (restored ${fromSrc} from CDN)` : "") +
          (removed ? ` (-${removed} brand cards)` : "")
      );
    }
  }

  saveCatalog(catalog);
  await browser.close();

  console.log("\n📊 Restore summary");
  console.log(`   Restored from sourceUrl: ${restored}`);
  console.log(`   Re-imported: ${reimported}`);
  console.log(`   Definite brand cards removed: ${brandingRemoved}`);
  console.log("   ✅ Catalog saved\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
