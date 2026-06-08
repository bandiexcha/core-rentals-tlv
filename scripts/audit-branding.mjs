#!/usr/bin/env node
/**
 * Full branding audit — text + images + sampling.
 * Usage: node scripts/audit-branding.mjs [--json]
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { KNOWN_BRANDING_HASHES } from "./lib/branding-image-detect.mjs";
import { buildBrandingHashBlocklist } from "./lib/branding-image-detect.mjs";
import { containsBranding, BRAND_NAME_RE } from "./lib/branding-cleanup.mjs";
import { IMAGES_DIR, loadCatalog } from "./lib/catalog-store.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const JSON_OUT = process.argv.includes("--json");

const TEXT_PATTERNS = [
  { name: "HolyGuest", re: /HolyGuest/gi },
  { name: "Holy Guest", re: /Holy\s+Guest/gi },
  { name: "Your Home, At Home", re: /Your Home,?\s*At Home/gi },
  { name: "Sea N Rent", re: /Sea\s+N\s+Rent/gi },
  { name: "Sea N' Rent", re: /Sea\s+N['\u2019]\s*Rent/gi },
  { name: "Sea and Rent", re: /Sea\s+and\s+Rent/gi },
  { name: "Seanrent", re: /Seanrent/gi },
  { name: "by Sea N", re: /\sby\s+Sea\s+N/gi },
  { name: "by HolyGuest", re: /\sby\s+HolyGuest/gi },
];

const PUBLIC_FIELDS = ["name", "shortDescription", "fullDescription", "address"];
const INTERNAL_OK = new Set([
  "internalSourceUrl",
  "source",
  "discoveryChannel",
  "importedAt",
  "id",
]);

function walkDir(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".next", ".git", "public/apartments"].includes(entry.name)) continue;
      walkDir(fp, files);
    } else if (/\.(tsx?|jsx?|json|md|html|mjs)$/.test(entry.name)) {
      files.push(fp);
    }
  }
  return files;
}

function auditCatalogText(catalog) {
  const leaks = [];
  for (const apt of catalog.apartments) {
    for (const field of PUBLIC_FIELDS) {
      const val = apt[field];
      if (!val || typeof val !== "string") continue;
      for (const p of TEXT_PATTERNS) {
        p.re.lastIndex = 0;
        if (p.re.test(val)) {
          leaks.push({
            slug: apt.slug,
            field,
            pattern: p.name,
            sample: val.match(p.re)?.[0],
            context: val.slice(0, 120),
          });
        }
      }
    }
    for (const a of apt.amenities || []) {
      for (const p of TEXT_PATTERNS) {
        p.re.lastIndex = 0;
        if (p.re.test(a)) {
          leaks.push({ slug: apt.slug, field: "amenity", pattern: p.name, sample: a });
        }
      }
    }
    for (const img of apt.images || []) {
      for (const p of TEXT_PATTERNS) {
        p.re.lastIndex = 0;
        if (p.re.test(img.alt || "")) {
          leaks.push({ slug: apt.slug, field: "image.alt", pattern: p.name, sample: img.alt });
        }
      }
    }
  }
  return leaks;
}

function auditCodebaseText() {
  const leaks = [];
  const scanDirs = ["src", "scripts"];
  for (const dir of scanDirs) {
    for (const fp of walkDir(path.join(ROOT, dir))) {
      if (fp.includes("brand-sanitize") || fp.includes("branding-cleanup") || fp.includes("branding-image-detect")) continue;
      if (fp.includes("audit-branding")) continue;
      if (fp.includes("seanrent-discovery") || fp.includes("seanrent-import-progress") || fp.includes("seanrent-urls")) continue;
      const content = fs.readFileSync(fp, "utf8");
      for (const p of TEXT_PATTERNS) {
        p.re.lastIndex = 0;
        const matches = content.match(new RegExp(p.re.source, "gi"));
        if (matches?.length) {
          leaks.push({ file: path.relative(ROOT, fp), pattern: p.name, count: matches.length });
        }
      }
    }
  }
  return leaks;
}

function auditInternalFields(catalog) {
  let holyguestUrls = 0;
  let seanrentUrls = 0;
  for (const apt of catalog.apartments) {
    if (/holyguest/i.test(apt.internalSourceUrl || "")) holyguestUrls++;
    if (/seanrent|bookingsboom|booking\.com/i.test(apt.internalSourceUrl || "")) seanrentUrls++;
  }
  return { holyguestUrls, seanrentUrls };
}

async function auditImages(catalog) {
  const blocklist = buildBrandingHashBlocklist(IMAGES_DIR, catalog, 3);
  let totalImages = 0;
  let brandingRemaining = 0;
  const brandingExamples = [];
  const hashCounts = new Map();

  for (const apt of catalog.apartments) {
    const dir = path.join(IMAGES_DIR, apt.slug);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!/\.(jpe?g|png|webp)$/i.test(f)) continue;
      totalImages++;
      const fp = path.join(dir, f);
      const hash = crypto.createHash("md5").update(fs.readFileSync(fp)).digest("hex");
      hashCounts.set(hash, (hashCounts.get(hash) || 0) + 1);
      const isBrand =
        KNOWN_BRANDING_HASHES.has(hash) ||
        blocklist.has(hash);
      if (isBrand) {
        brandingRemaining++;
        if (brandingExamples.length < 20) {
          brandingExamples.push({ slug: apt.slug, file: f, hash: hash.slice(0, 12) });
        }
      }
    }
  }

  const duplicateTemplates = [...hashCounts.entries()]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return { totalImages, brandingRemaining, brandingExamples, blocklistSize: blocklist.size, duplicateTemplates };
}

function sampleApartments(catalog, source, n = 20) {
  const pool =
    source === "holyguest"
      ? catalog.apartments.filter((a) => a.source === "holyguest")
      : catalog.apartments.filter((a) => a.source === "seanrent");

  const step = Math.max(1, Math.floor(pool.length / n));
  const samples = [];
  for (let i = 0; i < pool.length && samples.length < n; i += step) {
    samples.push(pool[i]);
  }
  while (samples.length < n && samples.length < pool.length) {
    const next = pool[samples.length];
    if (!samples.includes(next)) samples.push(next);
  }

  return samples.map((apt) => {
    const dir = path.join(IMAGES_DIR, apt.slug);
    const imageCount = fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).length
      : 0;
    const textClean =
      !containsBranding(apt.name) &&
      !containsBranding(apt.shortDescription) &&
      !containsBranding(apt.fullDescription) &&
      !(apt.amenities || []).some((a) => containsBranding(a));

    let brandImages = 0;
    if (fs.existsSync(dir)) {
      const blocklist = buildBrandingHashBlocklist(IMAGES_DIR, catalog, 3);
      for (const f of fs.readdirSync(dir)) {
        if (!/\.(jpe?g|png|webp)$/i.test(f)) continue;
        const hash = crypto
          .createHash("md5")
          .update(fs.readFileSync(path.join(dir, f)))
          .digest("hex");
        if (KNOWN_BRANDING_HASHES.has(hash) || blocklist.has(hash)) brandImages++;
      }
    }

    const hasAddress = Boolean(apt.address?.trim());
    return {
      slug: apt.slug,
      name: apt.name,
      images: imageCount,
      catalogImages: apt.images?.length || 0,
      textClean,
      brandImages,
      hasAddress,
      published: apt.published,
    };
  });
}

function countBySource(catalog) {
  const counts = {};
  for (const a of catalog.apartments) {
    counts[a.source || "unknown"] = (counts[a.source || "unknown"] || 0) + 1;
  }
  return counts;
}

async function main() {
  const catalog = loadCatalog();
  const catalogLeaks = auditCatalogText(catalog);
  const codeLeaks = auditCodebaseText();
  const internal = auditInternalFields(catalog);
  const images = await auditImages(catalog);
  const hgSample = sampleApartments(catalog, "holyguest", 20);
  const snSample = sampleApartments(catalog, "seanrent", 20);

  const zeroImages = catalog.apartments.filter((a) => !(a.images?.length > 0)).length;
  const withAddress = catalog.apartments.filter((a) => a.address?.trim()).length;

  const report = {
    timestamp: new Date().toISOString(),
    catalog: {
      total: catalog.apartments.length,
      bySource: countBySource(catalog),
      zeroImages,
      withAddress,
    },
    textAudit: {
      catalogLeaks: catalogLeaks.length,
      catalogLeakDetails: catalogLeaks.slice(0, 30),
      codeLeaks: codeLeaks.length,
      codeLeakDetails: codeLeaks.slice(0, 20),
      internalOnly: internal,
    },
    imageAudit: images,
    sampling: { holyguest: hgSample, seanrent: snSample },
    deploymentGate: {
      catalogTextClean: catalogLeaks.length === 0,
      brandingImagesClean: images.brandingRemaining === 0,
      hgSampleTextClean: hgSample.every((s) => s.textClean),
      hgSampleImagesClean: hgSample.every((s) => s.brandImages === 0),
      snSampleTextClean: snSample.every((s) => s.textClean),
      snSampleImagesClean: snSample.every((s) => s.brandImages === 0),
      zeroImageApartments: zeroImages,
      readyToDeploy:
        catalogLeaks.length === 0 &&
        images.brandingRemaining === 0 &&
        zeroImages === 0 &&
        hgSample.every((s) => s.textClean && s.brandImages === 0) &&
        snSample.every((s) => s.textClean && s.brandImages === 0),
    },
  };

  if (JSON_OUT) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("  BRANDING AUDIT REPORT");
  console.log("═══════════════════════════════════════════\n");

  console.log("CATALOG");
  console.log(`  Total apartments: ${report.catalog.total}`);
  console.log(`  By source:`, report.catalog.bySource);
  console.log(`  Zero-image apartments: ${zeroImages}`);
  console.log(`  With address (Maps): ${withAddress}`);

  console.log("\nA. TEXT AUDIT (public-facing catalog)");
  console.log(`  Brand leaks in catalog: ${catalogLeaks.length}`);
  if (catalogLeaks.length) {
    for (const l of catalogLeaks.slice(0, 15)) {
      console.log(`    ✗ ${l.slug} [${l.field}] ${l.pattern}: "${l.sample}"`);
    }
  }
  console.log(`  Brand refs in src/scripts (excl. cleanup): ${codeLeaks.length} files`);
  if (codeLeaks.length) {
    for (const l of codeLeaks.slice(0, 10)) {
      console.log(`    · ${l.file}: ${l.pattern} (${l.count}x)`);
    }
  }
  console.log(`  Internal source URLs (not public): HG=${internal.holyguestUrls}, SN=${internal.seanrentUrls}`);

  console.log("\nB. IMAGE AUDIT");
  console.log(`  Total image files on disk: ${images.totalImages}`);
  console.log(`  Branding images remaining: ${images.brandingRemaining}`);
  console.log(`  Blocklist size: ${images.blocklistSize}`);
  if (images.brandingExamples.length) {
    console.log("  Examples:");
    for (const e of images.brandingExamples) {
      console.log(`    ✗ ${e.slug}/${e.file} (${e.hash})`);
    }
  }

  console.log("\nC. SAMPLING (20 each)");
  const hgFail = hgSample.filter((s) => !s.textClean || s.brandImages > 0);
  const snFail = snSample.filter((s) => !s.textClean || s.brandImages > 0);
  console.log(`  HolyGuest: ${hgSample.length} sampled, ${hgFail.length} failed`);
  console.log(`  Sea N' Rent: ${snSample.length} sampled, ${snFail.length} failed`);
  if (hgFail.length) hgFail.forEach((s) => console.log(`    ✗ HG ${s.slug} text=${s.textClean} brandImg=${s.brandImages}`));
  if (snFail.length) snFail.forEach((s) => console.log(`    ✗ SN ${s.slug} text=${s.textClean} brandImg=${s.brandImages}`));

  console.log("\nD. DEPLOYMENT GATE");
  console.log(`  Catalog text clean: ${report.deploymentGate.catalogTextClean ? "✓" : "✗"}`);
  console.log(`  Branding images clean: ${report.deploymentGate.brandingImagesClean ? "✓" : "✗"}`);
  console.log(`  Zero-image apartments: ${zeroImages === 0 ? "✓" : "✗"} (${zeroImages})`);
  console.log(`  READY TO DEPLOY: ${report.deploymentGate.readyToDeploy ? "YES ✓" : "NO ✗"}`);
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
