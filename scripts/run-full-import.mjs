import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  importHolyGuestCatalog,
} from "./lib/guesty-importer.mjs";
import {
  importSeanRentCatalog,
} from "./lib/seanrent-importer.mjs";
import { loadCatalog, saveCatalog, featureFirstApartments } from "./lib/catalog-store.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG = path.join(__dirname, "..", "import-progress.log");

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOG, line);
  console.log(msg);
}

async function main() {
  fs.writeFileSync(LOG, "");
  log("Starting full catalog import...");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    log("=== HolyGuest (~170 listings) ===");
    await importHolyGuestCatalog(page, { publish: true });
    const mid = loadCatalog();
    log(`HolyGuest done: ${mid.apartments.filter((a) => a.source === "holyguest").length} apartments`);

    log("=== Sea N Rent ===");
    await importSeanRentCatalog(page, { publish: true });
    const final = loadCatalog();
    featureFirstApartments(final, 6);

    const hg = final.apartments.filter((a) => a.source === "holyguest").length;
    const sr = final.apartments.filter((a) => a.source === "seanrent").length;
    log(`COMPLETE — HolyGuest: ${hg} | Sea N Rent: ${sr} | Total published: ${final.apartments.filter((a) => a.published).length}`);
  } catch (err) {
    log(`ERROR: ${err.message}`);
    throw err;
  } finally {
    await browser.close();
  }
}

main();
