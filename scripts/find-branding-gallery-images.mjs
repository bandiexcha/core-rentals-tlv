#!/usr/bin/env node
/**
 * Find branding images in galleries via OCR (local files).
 * Outputs branding-gallery-hits.json
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { fileURLToPath } from "url";
import { loadCatalog } from "./lib/catalog-store.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const IMAGES_DIR = path.join(ROOT, "public/apartments");

const OCR_PATTERNS = [
  { name: "Sea N Rent", re: /sea\s*n['\u2019]?\s*rent/i },
  { name: "Seanrent", re: /seanrent/i },
  { name: "seanrent.com", re: /www\.?\s*seanrent\.com|seanrent\.com/i },
  { name: "hello@seanrent", re: /hello@seanrent/i },
  { name: "phone 55-729", re: /55[\s\-]?729[\s\-]?8661/i },
  { name: "HolyGuest", re: /holy\s*guest|holyguest/i },
  { name: "Your Home At Home", re: /your\s+home,?\s*at\s+home/i },
  { name: "vacation rentals", re: /vacation\s+rentals/i },
  { name: "property management", re: /property\s+management/i },
  { name: "tel +972", re: /tel:?\s*\+?972/i },
];

function matchPatterns(text) {
  const t = text.replace(/\s+/g, " ");
  return OCR_PATTERNS.filter((p) => p.re.test(t)).map((p) => p.name);
}

async function ocrImage(filepath, worker) {
  let meta;
  try {
    meta = await sharp(filepath).metadata();
  } catch {
    return [];
  }
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (w < 80 || h < 80) return [];

  const variants = [
    await sharp(filepath).resize(1400, null, { withoutEnlargement: true }).png().toBuffer(),
    await sharp(filepath)
      .resize(1400, null, { withoutEnlargement: true })
      .greyscale()
      .normalize()
      .threshold(175)
      .png()
      .toBuffer(),
  ];

  const matched = new Set();
  for (const buf of variants) {
    const { data } = await worker.recognize(buf);
    for (const m of matchPatterns(data.text)) matched.add(m);
  }
  return [...matched];
}

async function main() {
  const catalog = loadCatalog();
  const worker = await createWorker("eng");
  await worker.setParameters({ tessedit_pageseg_mode: "6" });

  const hits = [];
  let scanned = 0;

  for (const apt of catalog.apartments) {
    for (const img of apt.images || []) {
      const rel = img.url?.replace(/^\/apartments\//, "") || "";
      const fp = path.join(IMAGES_DIR, rel);
      if (!fs.existsSync(fp)) continue;
      scanned++;
      const patterns = await ocrImage(fp, worker);
      if (patterns.length) {
        hits.push({
          slug: apt.slug,
          id: apt.id,
          source: apt.source,
          file: path.basename(rel),
          url: img.url,
          patterns,
        });
      }
      if (scanned % 100 === 0) {
        console.error(`scanned ${scanned}, hits ${hits.length}`);
      }
    }
  }

  await worker.terminate();

  const out = { scanned, hitCount: hits.length, hits };
  fs.writeFileSync(path.join(ROOT, "branding-gallery-hits.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
