#!/usr/bin/env node
/**
 * Core Rentals TLV — Automated Apartment Import
 *
 * Imports apartment data directly from authorized source websites.
 * Downloads images locally to public/apartments/{slug}/.
 * Updates src/data/apartments.json — pages are generated automatically.
 *
 * Usage:
 *   npm run import:catalog -- --source holyguest
 *   npm run import:catalog -- --source seanrent
 *   npm run import:catalog -- --source all
 *   npm run import:catalog -- --url <property-url>
 *   npm run import:catalog -- --batch
 *   npm run import:catalog -- --source holyguest --limit 5
 *
 * After import, review src/data/apartments.json:
 *   - Set published: true to show on site
 *   - Set featured: true for homepage
 *   - Edit text if needed
 *   - Set published: false to hide
 */

import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import {
  importHolyGuestCatalog,
  importHolyGuestUrl,
} from "./lib/guesty-importer.mjs";
import {
  importSeanRentCatalog,
  importSeanRentUrl,
} from "./lib/seanrent-importer.mjs";
import { replaceCatalogSources, featureFirstApartments, loadCatalog, saveCatalog } from "./lib/catalog-store.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const URLS_FILE = path.join(ROOT, "src/data/import-urls.json");

function parseArgs(argv) {
  const args = {
    source: null,
    url: null,
    batch: false,
    limit: null,
    replace: false,
    publish: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--source") args.source = argv[++i];
    else if (arg === "--url") args.url = argv[++i];
    else if (arg === "--batch") args.batch = true;
    else if (arg === "--limit") args.limit = Number(argv[++i]);
    else if (arg === "--replace") args.replace = true;
    else if (arg === "--publish") args.publish = true;
    else if (arg.startsWith("http")) args.url = arg;
  }

  return args;
}

function detectSource(url) {
  if (/holyguest|guestybookings/i.test(url)) return "holyguest";
  if (/seanrent|maveriks/i.test(url)) return "seanrent";
  return null;
}

function printHelp() {
  console.log(`
Core Rentals TLV — Automated Import

Commands:
  npm run import:catalog -- --source holyguest       Import all HolyGuest Tel Aviv listings
  npm run import:catalog -- --source seanrent        Search & import SeanRent Tel Aviv listings
  npm run import:catalog -- --source all             Import both sources
  npm run import:catalog -- --url <property-url>     Import a single property URL
  npm run import:catalog -- --batch                  Import URLs from src/data/import-urls.json
  npm run import:catalog -- --source holyguest --limit 5   Test with first 5 listings

Options:
  --limit N     Import only N apartments (for testing)
  --replace     Clear existing catalog entries for the selected source(s)
  --publish       Auto-publish imported apartments (no review queue)

After import:
  Apartments are saved to src/data/apartments.json with published: true when using --publish

Images are saved to public/apartments/{slug}/
Source URLs are stored in internalSourceUrl (admin-only, never shown publicly).
`);
}

async function runBatch(page, limit) {
  const { urls = [] } = JSON.parse(fs.readFileSync(URLS_FILE, "utf8"));
  for (const url of urls) {
    const source = detectSource(url);
    if (!source) {
      console.warn(`Skipping unsupported URL: ${url}`);
      continue;
    }
    if (source === "holyguest") await importHolyGuestUrl(page, url);
    else await importSeanRentUrl(page, url);
  }
}

async function clearCatalog(sources) {
  if (sources.includes("all")) {
    const catalog = { version: 1, updatedAt: new Date().toISOString(), apartments: [] };
    saveCatalog(catalog);
    return catalog;
  }
  return replaceCatalogSources(sources);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.source && !args.url && !args.batch) {
    printHelp();
    process.exit(0);
  }

  const importOpts = { limit: args.limit, publish: args.publish };

  if (args.replace) {
    const sources =
      args.source === "all"
        ? ["holyguest", "seanrent"]
        : args.source
          ? [args.source]
          : [];
    if (sources.length) {
      console.log(`\n🗑 Clearing catalog for: ${sources.join(", ")}`);
      clearCatalog(sources.includes("all") ? ["all"] : sources);
    }
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    if (args.url) {
      const source = detectSource(args.url);
      if (source === "holyguest") await importHolyGuestUrl(page, args.url, importOpts);
      else if (source === "seanrent") await importSeanRentUrl(page, args.url, importOpts);
      else throw new Error(`Unsupported URL: ${args.url}`);
    } else if (args.batch) {
      await runBatch(page, args.limit);
    } else if (args.source === "holyguest") {
      await importHolyGuestCatalog(page, importOpts);
    } else if (args.source === "seanrent") {
      await importSeanRentCatalog(page, importOpts);
    } else if (args.source === "all") {
      await importHolyGuestCatalog(page, importOpts);
      await importSeanRentCatalog(page, importOpts);
      if (args.publish) {
        const catalog = loadCatalog();
        featureFirstApartments(catalog, 6);
      }
    } else {
      throw new Error(`Unknown source: ${args.source}`);
    }

    const catalog = loadCatalog();
    const hg = catalog.apartments.filter((a) => a.source === "holyguest").length;
    const sr = catalog.apartments.filter((a) => a.source === "seanrent").length;
    const pub = catalog.apartments.filter((a) => a.published).length;
    console.log(`\n✅ Import complete. HolyGuest: ${hg} | Sea N Rent: ${sr} | Published: ${pub}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("\n❌ Import failed:", err.message);
  process.exit(1);
});
