#!/usr/bin/env node
/**
 * Import Sea N' Rent from discovered syndicated URLs (resume-safe).
 */
import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import { importSeanRentFromUrl } from "./lib/syndicated-importer.mjs";
import { loadCatalog, saveCatalog, featureFirstApartments } from "./lib/catalog-store.mjs";
import { randomDelay } from "./lib/import-utils.mjs";

const URLS_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src/data/seanrent-urls.json");

async function main() {
  if (!fs.existsSync(URLS_FILE)) {
    console.error("Run: node scripts/discover-seanrent-web.mjs");
    process.exit(1);
  }

  const { urls = [] } = JSON.parse(fs.readFileSync(URLS_FILE, "utf8"));
  if (!urls.length) {
    console.error("No URLs discovered. Run discovery first.");
    process.exit(1);
  }

  const catalog = loadCatalog();
  const existingIds = new Set(
    catalog.apartments.filter((a) => a.source === "seanrent" && a.images?.length).map((a) => a.internalSourceUrl)
  );

  const pending = urls.filter((u) => !existingIds.has(u.split("?")[0]));
  console.log(`\n📥 Sea N' Rent syndicated import: ${pending.length} pending (${existingIds.size} already done)\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let ok = 0;
  let fail = 0;

  try {
    for (const [i, url] of pending.entries()) {
      console.log(`[${i + 1}/${pending.length}]`);
      try {
        await importSeanRentFromUrl(page, url, { publish: true, downloadImages: true });
        ok++;
        await randomDelay(3000, 6000);
      } catch (err) {
        fail++;
        console.error(`  ✗ ${err.message}`);
        await randomDelay(5000, 10000);
      }
    }
  } finally {
    await browser.close();
  }

  const final = loadCatalog();
  featureFirstApartments(final, 6);
  const sr = final.apartments.filter((a) => a.source === "seanrent");
  const imgs = sr.reduce((s, a) => s + (a.images?.length || 0), 0);
  console.log(`\n✅ Sea N' Rent: ${sr.length} apartments | ${imgs} images | +${ok} new | ${fail} failed`);
}

main();
