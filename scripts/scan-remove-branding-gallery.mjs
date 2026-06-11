#!/usr/bin/env node
/**
 * Full gallery scan — remove branding / contact / marketing images.
 * Uses: known MD5 hashes, duplicate templates, OCR text detection, brand URLs.
 *
 * Usage:
 *   node scripts/scan-remove-branding-gallery.mjs [--dry-run] [--json]
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { fileURLToPath } from "url";
import {
  KNOWN_BRANDING_HASHES,
  buildBrandingHashBlocklist,
  md5File,
  resetBrandingHashCache,
} from "./lib/branding-image-detect.mjs";
import { renumberImagesInFolder } from "./lib/branding-cleanup.mjs";
import { IMAGES_DIR, loadCatalog, saveCatalog } from "./lib/catalog-store.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");
const jsonOut = process.argv.includes("--json");

const BRAND_IMAGE_URL_RE =
  /(?:logo|brand|branding|watermark|welcome[\-_]?card|marketing|banner|cover[\-_]?slide|info[\-_]?card|promo|Seanrent|holyguest|guesty[\-_]?logo|powered[\-_]?by|safe[\-_]?room|mamad[\-_]?card|booking[\-_]?engine)/i;

const OCR_PATTERNS = [
  { name: "Sea N Rent", re: /sea\s*n['\u2019]?\s*rent/i },
  { name: "Seanrent", re: /seanrent/i },
  { name: "HolyGuest", re: /holy\s*guest|holyguest/i },
  { name: "seanrent.com", re: /www\.?\s*seanrent\.com|seanrent\.com/i },
  { name: "hello@seanrent", re: /hello@seanrent/i },
  { name: "phone 55-729", re: /55[\s\-]?729[\s\-]?8661/i },
  { name: "vacation rentals card", re: /vacation\s+rentals/i },
  { name: "property management card", re: /property\s+management/i },
  { name: "Your Home At Home", re: /your\s+home,?\s*at\s+home/i },
  { name: "Book your HolyGuest", re: /book\s+your\s+holyguest/i },
  { name: "email@", re: /[a-z0-9._%+-]+@(seanrent|holyguest|guesty)\.[a-z]{2,}/i },
  { name: "tel +972", re: /tel:?\s*\+?972[\s\-]?\d{2}[\s\-]?\d{3}[\s\-]?\d{4}/i },
];

function hasOcrBranding(text) {
  const t = text.replace(/\s+/g, " ");
  return OCR_PATTERNS.filter((p) => p.re.test(t));
}

function isBrandUrl(url = "") {
  if (!/^https?:\/\//i.test(url)) return false;
  if (BRAND_IMAGE_URL_RE.test(url)) return true;
  if (/tenants\/Seanrent\/.*(?:logo|brand|welcome|banner|card|info|booking-engine)/i.test(url)) {
    return true;
  }
  return false;
}

async function ocrBuffers(filepath) {
  const meta = await sharp(filepath).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (w < 80 || h < 80) return "";

  const bufs = [];
  bufs.push(
    await sharp(filepath).resize(1400, null, { withoutEnlargement: true }).png().toBuffer()
  );
  bufs.push(
    await sharp(filepath)
      .resize(1400, null, { withoutEnlargement: true })
      .greyscale()
      .normalize()
      .threshold(185)
      .png()
      .toBuffer()
  );
  if (w > 200 && h > 200) {
    bufs.push(
      await sharp(filepath)
        .extract({
          left: Math.floor(w * 0.08),
          top: Math.floor(h * 0.12),
          width: Math.floor(w * 0.84),
          height: Math.floor(h * 0.76),
        })
        .resize(1200, null, { withoutEnlargement: true })
        .greyscale()
        .normalize()
        .threshold(170)
        .png()
        .toBuffer()
    );
  }

  let combined = "";
  for (const buf of bufs) {
    const { data } = await worker.recognize(buf);
    combined += ` ${data.text}`;
    const hits = hasOcrBranding(combined);
    if (hits.length) return { text: combined, hits };
  }
  return { text: combined, hits: hasOcrBranding(combined) };
}

let worker;

async function classifyImage(img, apt, blocklist) {
  const rel = img.url?.replace(/^\/apartments\//, "") || "";
  const filepath = path.join(IMAGES_DIR, rel);
  const reasons = [];

  if (isBrandUrl(img.sourceUrl) || isBrandUrl(img.url)) {
    reasons.push("brand-url");
  }

  if (!filepath || !fs.existsSync(filepath)) {
    return reasons.length ? { remove: true, reasons } : { remove: false, reasons: [] };
  }

  let hash;
  try {
    hash = md5File(filepath);
  } catch {
    return reasons.length ? { remove: true, reasons } : { remove: false, reasons: [] };
  }

  if (KNOWN_BRANDING_HASHES.has(hash) || blocklist.has(hash)) {
    reasons.push("known-or-duplicate-template");
  }

  const ocr = await ocrBuffers(filepath);
  if (ocr.hits?.length) {
    for (const h of ocr.hits) reasons.push(`ocr:${h.name}`);
  }

  return { remove: reasons.length > 0, reasons, hash, ocrSample: ocr.text?.slice(0, 100) };
}

async function main() {
  resetBrandingHashCache();
  const catalog = loadCatalog();
  const blocklist = buildBrandingHashBlocklist(IMAGES_DIR, catalog, 3);

  console.log(
    `\n🔍 Gallery branding scan${dryRun ? " (dry run)" : ""} — ${catalog.apartments.length} apartments`
  );
  console.log(`   Blocklist size: ${blocklist.size} (incl. ${KNOWN_BRANDING_HASHES.size} known)\n`);

  worker = await createWorker("eng");
  await worker.setParameters({ tessedit_pageseg_mode: "6" });

  const removedByApt = [];
  let totalRemoved = 0;
  let scanned = 0;

  for (const apt of catalog.apartments) {
    const images = apt.images || [];
    if (!images.length) continue;

    const toRemove = [];
    const details = [];

    for (const img of images) {
      scanned++;
      const result = await classifyImage(img, apt, blocklist);
      if (result.remove) {
        toRemove.push(img);
        details.push({
          file: path.basename(img.url || ""),
          reasons: result.reasons,
          hash: result.hash?.slice(0, 12),
        });
      }
      if (scanned % 100 === 0) {
        console.error(`   … scanned ${scanned} gallery images`);
      }
    }

    if (!toRemove.length) continue;

    totalRemoved += toRemove.length;
    removedByApt.push({ slug: apt.slug, id: apt.id, source: apt.source, removed: details });

    if (!dryRun) {
      for (const img of toRemove) {
        const rel = img.url?.replace(/^\/apartments\//, "") || "";
        const fp = path.join(IMAGES_DIR, rel);
        if (fs.existsSync(fp)) {
          try {
            fs.unlinkSync(fp);
          } catch {}
        }
      }

      const keptSource = images.filter((i) => !toRemove.includes(i));
      apt.images = renumberImagesInFolder(IMAGES_DIR, apt.slug);
      for (let i = 0; i < apt.images.length && i < keptSource.length; i++) {
        if (keptSource[i]?.sourceUrl) apt.images[i].sourceUrl = keptSource[i].sourceUrl;
      }
    }

    console.log(
      `  ✓ ${apt.slug}: removed ${toRemove.length} — ${details.map((d) => d.file).join(", ")}`
    );
  }

  await worker.terminate();

  if (!dryRun) saveCatalog(catalog);

  const report = {
    dryRun,
    galleryImagesScanned: scanned,
    brandingImagesRemoved: totalRemoved,
    apartmentsAffected: removedByApt.map((a) => a.slug),
    details: removedByApt,
  };

  if (jsonOut) {
    fs.writeFileSync(path.join(ROOT, "branding-scan-report.json"), JSON.stringify(report, null, 2));
  }

  console.log("\n📊 Summary");
  console.log(`   Gallery images scanned: ${scanned}`);
  console.log(`   Branding images removed: ${totalRemoved}`);
  console.log(`   Apartments affected: ${removedByApt.length}`);
  if (removedByApt.length) {
    console.log(`   Slugs: ${removedByApt.map((a) => a.slug).join(", ")}`);
  }
  console.log(dryRun ? "\n(dry run — no files changed)\n" : "\n✅ Catalog saved\n");

  return report;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
