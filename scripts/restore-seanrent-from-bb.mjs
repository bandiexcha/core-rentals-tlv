#!/usr/bin/env node
/** Re-download Sea N' Rent galleries from BookingsBoom (narrow branding filter). */
import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import {
  importBookingsBoomListing,
  obtainBookingsBoomSession,
} from "./lib/bookingsboom-importer.mjs";
import { importBookingComUrl } from "./lib/syndicated-importer.mjs";
import { IMAGES_DIR, loadCatalog } from "./lib/catalog-store.mjs";
import { randomDelay, sleep } from "./lib/import-utils.mjs";

function galleryLooksRestored(apt) {
  const candidates = [apt.slug];
  const base = apt.slug.replace(/-(\d+)$/, "");
  if (base !== apt.slug) candidates.push(base);

  for (const slug of candidates) {
    const dir = path.join(IMAGES_DIR, slug);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
    if (files.length < 3) continue;
    const large = files.filter((f) => fs.statSync(path.join(dir, f)).size >= 30000).length;
    if (large >= Math.min(3, files.length)) return true;
  }
  return false;
}

async function main() {
  const catalog = loadCatalog();
  const sn = catalog.apartments.filter((a) => a.source === "seanrent");
  const bb = sn.filter((a) => /bookingsboom\.com/i.test(a.internalSourceUrl || ""));
  const bc = sn.filter((a) => /booking\.com\/hotel/i.test(a.internalSourceUrl || ""));

  console.log(`\n🔄 Restoring ${bb.length} BookingsBoom + ${bc.length} Booking.com galleries...\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let sessionId = await obtainBookingsBoomSession(page);

  for (let i = 0; i < bb.length; i++) {
    const seed = bb[i];
    const apt = loadCatalog().apartments.find((a) => a.id === seed.id) || seed;
    const m = apt.internalSourceUrl.match(/listings\/(\d+)/);
    if (!m) continue;
    const listingId = Number(m[1]);
    if (galleryLooksRestored(apt)) {
      console.log(`[${i + 1}/${bb.length}] ${apt.slug} (#${listingId}) — skip (already restored)`);
      continue;
    }
    console.log(`[${i + 1}/${bb.length}] ${apt.slug} (#${listingId})`);
    try {
      const { imageCount } = await importBookingsBoomListing(page, listingId, sessionId, {
        publish: apt.published,
      });
      console.log(`  ✓ ${imageCount} images`);
      if ((i + 1) % 15 === 0) sessionId = await obtainBookingsBoomSession(page);
      await randomDelay(1200, 2500);
    } catch (err) {
      console.error(`  ✗ ${err.message}`);
      sessionId = await obtainBookingsBoomSession(page);
      await sleep(2000);
    }
  }

  for (const apt of bc) {
    console.log(`Booking.com ${apt.slug}`);
    try {
      await importBookingComUrl(page, apt.internalSourceUrl, { publish: apt.published });
      const fresh = loadCatalog().apartments.find((a) => a.id === apt.id);
      console.log(`  ✓ ${fresh?.images?.length || 0} images`);
    } catch (err) {
      console.error(`  ✗ ${err.message}`);
    }
  }

  await browser.close();
  console.log("\n✅ Sea N' Rent restore complete\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
