import crypto from "crypto";
import fs from "fs";
import path from "path";
import sharp from "sharp";

/** Confirmed HolyGuest / safe-room marketing cards (from catalog fingerprint scan). */
export const KNOWN_BRANDING_HASHES = new Set([
  "acac530faee6d86d077e8e48986012c9", // HolyGuest "Your Home, At Home" (variant A)
  "20afc6b8d5f679e64c3ec8717e3a75ab", // In-house safe room card (variant A)
  "24871f65e29f51631254b97086a93c9c", // HolyGuest card (variant B)
  "c2d9f8aed4bc3098c0575f347700bd02", // Safe room card (variant B)
  "7a63ec7162b879570a85794691c1ec6e", // HolyGuest / promo card
  "02176ecde959c89afeac60506bb4459a", // Safe room / promo card
  "2bef5d548506f0c0bc81a9606a6c98cf", // HolyGuest card
  "230aeff3ecee3abd53620d0896d5467c", // Safe room card
]);

const BRAND_IMAGE_URL_RE =
  /(?:logo|brand|branding|watermark|welcome[\-_]?card|marketing|banner|cover[\-_]?slide|info[\-_]?card|promo|Seanrent|holyguest|guesty[\-_]?logo|powered[\-_]?by|safe[\-_]?room|mamad[\-_]?card|instruction|review|rating|airbnb|booking\.com|vrbo|tripadvisor)/i;

let cachedBlocklist = null;

export function md5File(filepath) {
  return crypto.createHash("md5").update(fs.readFileSync(filepath)).digest("hex");
}

/** Images reused across multiple listings are marketing templates, not property photos. */
export function buildBrandingHashBlocklist(imagesDir, catalog, minOccurrences = 3) {
  const counts = new Map();

  for (const apt of catalog.apartments) {
    const dir = path.join(imagesDir, apt.slug);
    if (!fs.existsSync(dir)) continue;

    const seenInApt = new Set();
    for (const file of fs.readdirSync(dir)) {
      if (!/\.(jpe?g|png|webp)$/i.test(file)) continue;
      const fp = path.join(dir, file);
      let hash;
      try {
        hash = md5File(fp);
      } catch {
        continue;
      }
      if (seenInApt.has(hash)) continue;
      seenInApt.add(hash);
      counts.set(hash, (counts.get(hash) || 0) + 1);
    }
  }

  const blocklist = new Set(KNOWN_BRANDING_HASHES);
  for (const [hash, count] of counts) {
    if (count >= minOccurrences) blocklist.add(hash);
  }
  return blocklist;
}

export function getBrandingHashBlocklist(imagesDir, catalog) {
  if (!cachedBlocklist) {
    cachedBlocklist = buildBrandingHashBlocklist(imagesDir, catalog);
  }
  return cachedBlocklist;
}

export function resetBrandingHashCache() {
  cachedBlocklist = null;
}

async function imageStats(filepath) {
  const meta = await sharp(filepath).metadata();
  const { data, info } = await sharp(filepath)
    .resize(240, 240, { fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = data.length / info.channels;
  let light = 0;
  let dark = 0;
  let variance = 0;
  const lumSamples = [];

  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    lumSamples.push(lum);
    if (lum > 215) light++;
    if (lum < 40) dark++;
    variance += Math.abs(r - g) + Math.abs(g - b);
  }

  const avgLum = lumSamples.reduce((a, b) => a + b, 0) / lumSamples.length;
  const lumVar =
    lumSamples.reduce((a, l) => a + (l - avgLum) ** 2, 0) / lumSamples.length;

  return {
    width: meta.width || 0,
    height: meta.height || 0,
    size: fs.statSync(filepath).size,
    lightRatio: light / pixels,
    darkRatio: dark / pixels,
    colorVariance: variance / pixels,
    lumVariance: lumVar,
  };
}

export async function isBrandingImageFile(filepath, blocklist, { url, sourceUrl } = {}) {
  for (const candidate of [sourceUrl, url]) {
    if (!isExternalImageUrl(candidate)) continue;
    if (BRAND_IMAGE_URL_RE.test(candidate)) return { match: true, reason: "url" };
    if (/tenants\/Seanrent\/.*(?:logo|brand|welcome|banner|card|info)/i.test(candidate)) {
      return { match: true, reason: "cloudinary-brand" };
    }
  }

  if (!filepath || !fs.existsSync(filepath)) return { match: false };

  let hash;
  try {
    hash = md5File(filepath);
  } catch {
    return { match: false };
  }

  if (blocklist.has(hash) || KNOWN_BRANDING_HASHES.has(hash)) {
    return { match: true, reason: "duplicate-template" };
  }

  try {
    const stats = await imageStats(filepath);
    const ratio = stats.width / Math.max(stats.height, 1);

    // White safe-room / emergency instruction cards (very bright, small graphics — not bright interiors)
    if (stats.lightRatio > 0.78 && stats.size < 160_000 && stats.lumVariance < 2200) {
      return { match: true, reason: "white-card" };
    }

    // Wide low-variance marketing banners
    if (ratio > 1.65 && stats.lightRatio > 0.55 && stats.lumVariance < 1400 && stats.size < 250_000) {
      return { match: true, reason: "banner" };
    }

    // Small flat graphic cards (icons + text on solid backgrounds)
    if (
      stats.size < 120_000 &&
      stats.lightRatio > 0.5 &&
      stats.colorVariance < 28 &&
      stats.lumVariance < 1800
    ) {
      return { match: true, reason: "flat-graphic" };
    }
  } catch {}

  return { match: false };
}

function isExternalImageUrl(url) {
  return /^https?:\/\//i.test(url || "");
}

function isDefiniteBranding({ url, sourceUrl, hash, blocklist }) {
  for (const candidate of [sourceUrl, url]) {
    if (!isExternalImageUrl(candidate)) continue;
    if (BRAND_IMAGE_URL_RE.test(candidate)) return true;
    if (/tenants\/Seanrent\/.*(?:logo|brand|welcome|banner|card|info)/i.test(candidate)) {
      return true;
    }
  }
  if (hash && (blocklist.has(hash) || KNOWN_BRANDING_HASHES.has(hash))) return true;
  return false;
}

export async function filterBrandingImagesAsync(
  images,
  imagesDir,
  slug,
  blocklist,
  { safeMinKeep = 1, definiteOnly = false } = {}
) {
  const kept = [];
  const heuristicFallback = [];

  for (const img of images || []) {
    const rel = img.url?.replace(/^\/apartments\//, "") || "";
    const filepath = path.join(imagesDir, rel);

    let hash;
    if (filepath && fs.existsSync(filepath)) {
      try {
        hash = md5File(filepath);
      } catch {}
    }

    if (definiteOnly) {
      if (isDefiniteBranding({ url: img.url, sourceUrl: img.sourceUrl, hash, blocklist })) {
        continue;
      }
      kept.push(img);
      continue;
    }

    const { match, reason } = await isBrandingImageFile(filepath, blocklist, {
      url: img.url,
      sourceUrl: img.sourceUrl,
    });

    if (!match) {
      kept.push(img);
      continue;
    }

    if (isDefiniteBranding({ url: img.url, sourceUrl: img.sourceUrl, hash, blocklist })) {
      continue;
    }

    // Heuristic match — hold for safety fallback if gallery would be emptied
    if (reason !== "duplicate-template") {
      heuristicFallback.push(img);
    }
  }

  if (kept.length >= safeMinKeep) return kept;

  // Never wipe an entire gallery on heuristics alone — keep non-definite matches
  return kept.length ? kept : [...kept, ...heuristicFallback];
}
