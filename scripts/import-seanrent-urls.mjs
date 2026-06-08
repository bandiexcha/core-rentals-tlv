#!/usr/bin/env node
/**
 * Import Sea N' Rent apartments from discovered property URLs (resume-safe).
 */
import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import { importSeanRentUrl } from "./lib/seanrent-importer.mjs";
import { loadCatalog, saveCatalog, featureFirstApartments } from "./lib/catalog-store.mjs";
import { randomDelay } from "./lib/import-utils.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URLS_FILE = path.join(ROOT, "src/data/seanrent-urls.json");

async function main() {
  if (!fs.existsSync(URLS_FILE)) {
    console.error("No seanrent-urls.json — run: node scripts/discover-seanrent-properties.mjs");
    process.exit(1);
  }

  const { urls = [] } = JSON.parse(fs.readFileSync(URLS_FILE, "utf8"));
  if (!urls.length) {
    console.error("No Sea N' Rent URLs discovered yet.");
    process.exit(1);
  }

  const catalog = loadCatalog();
  const existing = new Set(
    catalog.apartments.filter((a) => a.source === "seanrent" && a.images?.length).map((a) => a.internalSourceUrl)
  );

  const pending = urls.filter((u) => !existing.has(u.split("?")[0]));
  console.log(`\n📥 Sea N' Rent import: ${pending.length} pending (${existing.size} already imported)\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let imported = 0;

  try {
    for (const [i, url] of pending.entries()) {
      console.log(`[${i + 1}/${pending.length}] ${url}`);
      try {
        await importSeanRentUrl(page, url, { downloadImages: true, publish: true });
        imported++;
        await randomDelay(3000, 6000);
      } catch (err) {
        console.error(`  ✗ ${err.message}`);
        await randomDelay(8000, 12000);
      }
    }
  } finally {
    await browser.close();
  }

  const final = loadCatalog();
  featureFirstApartments(final, 6);
  const sr = final.apartments.filter((a) => a.source === "seanrent");
  console.log(`\n✅ Sea N' Rent: ${sr.length} apartments (${imported} new this run)`);
}

main();
