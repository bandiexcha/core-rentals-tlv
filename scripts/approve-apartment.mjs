#!/usr/bin/env node
/**
 * Publish imported apartments after review.
 *
 * Usage:
 *   npm run approve -- --all
 *   npm run approve -- --slug modern-2br-steps-to-beach
 *   npm run approve -- --source holyguest
 */

import { loadCatalog, saveCatalog } from "./lib/catalog-store.mjs";

function parseArgs(argv) {
  const args = { all: false, slug: null, source: null, featured: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--all") args.all = true;
    else if (argv[i] === "--slug") args.slug = argv[++i];
    else if (argv[i] === "--source") args.source = argv[++i];
    else if (argv[i] === "--featured") args.featured = true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const catalog = loadCatalog();
let count = 0;

for (const apt of catalog.apartments) {
  const match =
    args.all ||
    (args.slug && apt.slug === args.slug) ||
    (args.source && apt.source === args.source);

  if (!match) continue;

  apt.published = true;
  apt.needsReview = false;
  if (args.featured) apt.featured = true;
  count++;
}

if (!count) {
  console.log("No apartments matched. Use --all, --slug <slug>, or --source holyguest|seanrent");
  process.exit(1);
}

saveCatalog(catalog);
console.log(`✅ Published ${count} apartment(s). Run npm run dev to preview.`);
