#!/usr/bin/env node
/**
 * Import all discovered Sea N' Rent URLs — direct booking.seanrent.com first,
 * then Booking.com syndicated. Resume-safe.
 */
import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import { importSeanRentFromUrl } from "./lib/syndicated-importer.mjs";
import { importSeanRentUrl } from "./lib/seanrent-importer.mjs";
import { loadCatalog, saveCatalog, featureFirstApartments } from "./lib/catalog-store.mjs";
import { randomDelay } from "./lib/import-utils.mjs";

const URLS_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src/data/seanrent-urls.json");

function normalize(u) {
  return u.split("?")[0];
}

function isImported(catalog, url) {
  const n = normalize(url);
  return catalog.apartments.some(
    (a) => a.source === "seanrent" && a.images?.length && normalize(a.internalSourceUrl) === n
  );
}

async function main() {
  if (!fs.existsSync(URLS_FILE)) {
    console.error("Run: npm run discover:seanrent:full");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(URLS_FILE, "utf8"));
  const seanrentDirect = data.bookingSeanrent || [];
  const bookingCom = data.bookingCom || [];
  const generic = data.urls || [];
  const airbnb = data.airbnb || [];

  const ordered = [
    ...seanrentDirect.map((u) => ({ url: u, channel: "seanrent" })),
    ...bookingCom.map((u) => ({ url: u, channel: "booking" })),
    ...airbnb.map((u) => ({ url: u, channel: "booking" })),
    ...generic
      .filter((u) => !seanrentDirect.includes(u) && !bookingCom.includes(u))
      .map((u) => ({
        url: u,
        channel: /booking\.seanrent\.com/i.test(u) ? "seanrent" : "booking",
      })),
  ];

  const seen = new Set();
  const queue = [];
  for (const item of ordered) {
    const n = normalize(item.url);
    if (seen.has(n)) continue;
    seen.add(n);
    queue.push(item);
  }

  let catalog = loadCatalog();
  const pending = queue.filter((item) => !isImported(catalog, item.url));

  console.log(`\n📥 Sea N' Rent full import`);
  console.log(`   Queue: ${queue.length} | Pending: ${pending.length} | Already done: ${queue.length - pending.length}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let ok = 0;
  let fail = 0;

  try {
    for (const [i, { url, channel }] of pending.entries()) {
      console.log(`[${i + 1}/${pending.length}] (${channel})`);
      try {
        if (channel === "seanrent" && /booking\.seanrent\.com/i.test(url)) {
          await importSeanRentUrl(page, url, { publish: true, downloadImages: true });
        } else {
          await importSeanRentFromUrl(page, url, { publish: true });
        }
        ok++;
        catalog = loadCatalog();
        await randomDelay(2500, 5000);
      } catch (err) {
        fail++;
        console.error(`  ✗ ${err.message}`);
        await randomDelay(4000, 8000);
      }

      if ((i + 1) % 10 === 0) {
        const sr = loadCatalog().apartments.filter((a) => a.source === "seanrent");
        console.log(`  📊 Progress: ${sr.length} Sea N' Rent apartments imported so far`);
      }
    }
  } finally {
    await browser.close();
  }

  const final = loadCatalog();
  featureFirstApartments(final, 6);
  saveCatalog(final);

  const sr = final.apartments.filter((a) => a.source === "seanrent");
  const imgs = sr.reduce((s, a) => s + (a.images?.length || 0), 0);
  console.log(`\n✅ Sea N' Rent: ${sr.length} apartments | ${imgs} images | +${ok} new | ${fail} failed`);
}

main();
