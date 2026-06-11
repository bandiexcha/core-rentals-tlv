#!/usr/bin/env node
/**
 * OCR-scan every gallery image served on production.
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { fileURLToPath } from "url";
import { loadCatalog } from "./lib/catalog-store.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.PRODUCTION_URL || "https://core-rentals-tlv.vercel.app";

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
  { name: "tel +972", re: /tel:?\s*\+?972[\s\-]?\d{2}/i },
];

function matchPatterns(text) {
  const t = text.replace(/\s+/g, " ");
  return OCR_PATTERNS.filter((p) => p.re.test(t)).map((p) => p.name);
}

async function ocrBuffer(buf, worker) {
  let pipeline;
  try {
    pipeline = sharp(buf);
    await pipeline.metadata();
  } catch {
    return [];
  }

  const variants = [
    await sharp(buf).resize(1400, null, { withoutEnlargement: true }).png().toBuffer(),
    await sharp(buf)
      .resize(1400, null, { withoutEnlargement: true })
      .greyscale()
      .normalize()
      .threshold(175)
      .png()
      .toBuffer(),
  ];

  const matched = new Set();
  for (const png of variants) {
    try {
      const { data } = await worker.recognize(png);
      for (const m of matchPatterns(data.text)) matched.add(m);
    } catch {}
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
      const url = img.url?.startsWith("/") ? `${BASE}${img.url}` : img.url;
      if (!url) continue;
      scanned++;
      try {
        const res = await fetch(url, { headers: { "User-Agent": "CoreRentalsTLV-Audit/1.0" } });
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        const patterns = await ocrBuffer(buf, worker);
        if (patterns.length) {
          hits.push({
            slug: apt.slug,
            id: apt.id,
            source: apt.source,
            url: img.url,
            productionUrl: url,
            patterns,
          });
          console.error(`HIT ${apt.slug} ${img.url} → ${patterns.join(", ")}`);
        }
      } catch {}
      if (scanned % 100 === 0) console.error(`scanned ${scanned}, hits ${hits.length}`);
    }
  }

  await worker.terminate();

  const report = { productionUrl: BASE, scanned, hitCount: hits.length, hits };
  fs.writeFileSync(path.join(ROOT, "production-ocr-branding.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
