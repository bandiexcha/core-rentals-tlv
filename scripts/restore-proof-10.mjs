#!/usr/bin/env node
/** Re-download photos for proof apartments — no branding filter. */
import { chromium } from "playwright";
import { importBookingsBoomListing, obtainBookingsBoomSession } from "./lib/bookingsboom-importer.mjs";
import { importHolyGuestUrl } from "./lib/guesty-importer.mjs";
import { loadCatalog } from "./lib/catalog-store.mjs";

const SLUGS = [
  "mamad-tel-aviv-paradise-haven",
  "contemporary-3br-apt-near-geula-beach",
  "spacious-2br-apt-in-balfour-with-mamad",
  "stylish-sea-view-2br-apartment",
  "the-loft",
  "rustic-charm-2br-apt-in-tel-aviv",
  "sweet-home-3br-near-the-sea",
  "florentine-2br-with-sea-view",
  "mamma-mia-3br-in-frishman-beach",
  "designer-2br-in-rembrandt-street",
];

async function main() {
  const catalog = loadCatalog();
  const targets = SLUGS.map((s) => catalog.apartments.find((a) => a.slug === s)).filter(Boolean);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let sessionId = await obtainBookingsBoomSession(page);

  for (const apt of targets) {
    console.log(`\n${apt.slug} (${apt.source})`);
    try {
      if (apt.source === "holyguest" && apt.internalSourceUrl) {
        await importHolyGuestUrl(page, apt.internalSourceUrl, {
          publish: apt.published,
          downloadImages: true,
        });
      } else if (/bookingsboom\.com/i.test(apt.internalSourceUrl || "")) {
        const m = apt.internalSourceUrl.match(/listings\/(\d+)/);
        if (!m) throw new Error("no listing id");
        await importBookingsBoomListing(page, Number(m[1]), sessionId, { publish: apt.published });
      } else {
        console.log("  skip unknown source");
        continue;
      }
      const fresh = loadCatalog().apartments.find((a) => a.id === apt.id);
      console.log(`  ✓ ${fresh?.images?.length || 0} images`);
    } catch (err) {
      console.error(`  ✗ ${err.message}`);
    }
  }

  await browser.close();
}

main();
