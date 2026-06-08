#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { loadCatalog, saveCatalog } from "./lib/catalog-store.mjs";

const catalog = loadCatalog();
let pruned = 0;

for (const apt of catalog.apartments) {
  if (!apt.images?.length) continue;
  const before = apt.images.length;
  apt.images = apt.images.filter((img) => {
    const p = path.join("public", img.url.replace(/^\//, ""));
    return fs.existsSync(p);
  });
  pruned += before - apt.images.length;
}

saveCatalog(catalog);
console.log(`Pruned ${pruned} missing image refs`);
