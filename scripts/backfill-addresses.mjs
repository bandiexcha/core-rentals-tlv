#!/usr/bin/env node
/** Backfill public address field from seanrent-discovery.json */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { cleanAddress } from "./lib/branding-cleanup.mjs";
import { loadCatalog, saveCatalog } from "./lib/catalog-store.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DISCOVERY_FILE = path.join(__dirname, "../src/data/seanrent-discovery.json");

function listingIdFromUrl(url = "") {
  const m = url.match(/\/listings\/(\d+)/);
  return m ? m[1] : null;
}

function main() {
  const catalog = loadCatalog();
  const discovery = JSON.parse(fs.readFileSync(DISCOVERY_FILE, "utf8"));
  const byListingId = new Map();

  for (const item of Object.values(discovery.items || {})) {
    const id = String(item.id ?? item.listingId ?? listingIdFromUrl(item.detailUrl || item.url) ?? "");
    if (id && item.address) byListingId.set(id, item.address);
  }

  let updated = 0;
  for (const apt of catalog.apartments) {
    if (apt.address) continue;
    const fromUrl = listingIdFromUrl(apt.internalSourceUrl);
    const fromId = String(apt.id || "").replace(/^seanrent-bb-/, "");
    const raw = (fromUrl && byListingId.get(fromUrl)) || (fromId && byListingId.get(fromId));
    if (!raw) continue;
    const address = cleanAddress(raw);
    if (!address) continue;
    apt.address = address;
    updated++;
  }

  if (updated) saveCatalog(catalog);
  console.log(`\n✅ Backfilled ${updated} addresses from discovery data\n`);
}

main();
