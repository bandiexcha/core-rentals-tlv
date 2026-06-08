#!/usr/bin/env node
/** Verify random apartment pages have real photos and no branding hashes. */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { loadCatalog } from "./lib/catalog-store.mjs";

const KNOWN = new Set([
  "acac530faee6d86d077e8e48986012c9",
  "20afc6b8d5f679e64c3ec8717e3a75ab",
  "24871f65e29f51631254b97086a93c9c",
  "c2d9f8aed4bc3098c0575f347700bd02",
  "7a63ec7162b879570a85794691c1ec6e",
  "02176ecde959c89afeac60506bb4459a",
  "2bef5d548506f0c0bc81a9606a6c98cf",
  "230aeff3ecee3abd53620d0896d5467c",
]);

const base = process.argv[2] || "http://localhost:3000";
const catalog = loadCatalog();
const picks = [...catalog.apartments].sort(() => Math.random() - 0.5).slice(0, 10);

let pass = 0;
for (const apt of picks) {
  let real = 0;
  let brand = 0;
  let miss = 0;
  for (const img of apt.images || []) {
    const p = path.join("public", img.url.replace(/^\//, ""));
    if (!fs.existsSync(p)) {
      miss++;
      continue;
    }
    const buf = fs.readFileSync(p);
    const hash = crypto.createHash("md5").update(buf).digest("hex");
    if (KNOWN.has(hash)) brand++;
    else if (buf.length >= 15000) real++;
  }
  const ok = real >= 3 && brand === 0 && miss === 0;
  console.log(`${ok ? "✓" : "✗"} ${apt.slug} — ${real} real, ${brand} brand, ${miss} missing`);
  if (ok) pass++;
}

console.log(`\n${pass}/10 passed (local files)`);
console.log(`Pages: ${picks.map((a) => `${base}/apartments/${a.slug}`).join("\n")}`);
