/**
 * Persist neighborhood corrections and image fingerprints to apartments.json.
 * Run: node scripts/apply-catalog-fixes.mjs
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { guessNeighborhood } from "./lib/import-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CATALOG_PATH = path.join(ROOT, "src/data/apartments.json");
const IMAGES_DIR = path.join(ROOT, "public/apartments");

const CATALOG_GRID_COLS = 3;

function md5File(filepath) {
  return crypto.createHash("md5").update(fs.readFileSync(filepath)).digest("hex");
}

function apartmentText(apt) {
  return [
    apt.name,
    apt.address,
    apt.neighborhood,
    apt.shortDescription,
    apt.fullDescription,
  ]
    .filter(Boolean)
    .join(" ");
}

function resolveNeighborhood(apt) {
  return guessNeighborhood(apartmentText(apt), apt.city, {
    name: apt.name,
    address: apt.address,
  });
}

function imageIdentityKey(image, fingerprint) {
  if (fingerprint) return fingerprint;
  if (image.sourceUrl) {
    const match = image.sourceUrl.match(/\/([^/?#]+)\.(?:jpe?g|png|webp)(?:\?|$)/i);
    if (match) return match[1].toLowerCase();
    return image.sourceUrl.replace(/\/v\d+\//, "/").toLowerCase();
  }
  return image.url.toLowerCase();
}

function catalogNeighbors(index, length, cols) {
  const neighbors = [];
  const col = index % cols;
  if (col > 0) neighbors.push(index - 1);
  if (col < cols - 1 && index + 1 < length) neighbors.push(index + 1);
  if (index - cols >= 0) neighbors.push(index - cols);
  if (index + cols < length) neighbors.push(index + cols);
  return neighbors;
}

function assignCatalogCoverIndices(apartments) {
  const chosenKeys = new Array(apartments.length).fill(null);
  const indices = [];

  for (let i = 0; i < apartments.length; i++) {
    const apt = apartments[i];
    const images = apt.images ?? [];
    const fingerprints = apt.imageFingerprints ?? [];

    if (!images.length) {
      indices.push(0);
      continue;
    }

    const avoidKeys = new Set();
    for (const neighborIdx of catalogNeighbors(i, apartments.length, CATALOG_GRID_COLS)) {
      const key = chosenKeys[neighborIdx];
      if (key) avoidKeys.add(key);
    }

    let pick = 0;
    for (let imageIdx = 0; imageIdx < images.length; imageIdx++) {
      const key = imageIdentityKey(images[imageIdx], fingerprints[imageIdx]);
      if (!avoidKeys.has(key)) {
        pick = imageIdx;
        break;
      }
    }

    indices.push(pick);
    chosenKeys[i] = imageIdentityKey(images[pick], fingerprints[pick]);
  }

  return indices;
}

function heroKey(apt, coverIndex = 0) {
  const image = apt.images?.[coverIndex];
  if (!image) return null;
  return imageIdentityKey(image, apt.imageFingerprints?.[coverIndex]);
}

function countGridAdjacentDupes(apartments, coverIndices) {
  let count = 0;
  for (let i = 0; i < apartments.length; i++) {
    const key = heroKey(apartments[i], coverIndices[i]);
    if (!key) continue;
    for (const j of catalogNeighbors(i, apartments.length, CATALOG_GRID_COLS)) {
      if (j <= i) continue;
      const otherKey = heroKey(apartments[j], coverIndices[j]);
      if (otherKey && otherKey === key) count++;
    }
  }
  return count;
}

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
const locationCorrections = [];

for (const apt of catalog.apartments) {
  const resolved = resolveNeighborhood(apt);
  if (resolved !== apt.neighborhood) {
    locationCorrections.push({
      slug: apt.slug,
      name: apt.name,
      from: apt.neighborhood,
      to: resolved,
    });
    apt.neighborhood = resolved;
  }

  const fingerprints = [];
  for (const image of apt.images ?? []) {
    if (!image.url?.startsWith("/apartments/")) {
      fingerprints.push(imageIdentityKey(image));
      continue;
    }
    const filepath = path.join(ROOT, "public", image.url);
    try {
      fingerprints.push(md5File(filepath));
    } catch {
      fingerprints.push(imageIdentityKey(image));
    }
  }
  if (fingerprints.length) apt.imageFingerprints = fingerprints;
  else delete apt.imageFingerprints;
}

const published = catalog.apartments.filter((a) => a.published);
const beforeIndices = published.map(() => 0);
const afterIndices = assignCatalogCoverIndices(published);

let heroFixes = 0;
const heroFixExamples = [];
for (let i = 0; i < published.length; i++) {
  if (afterIndices[i] !== 0) {
    heroFixes++;
    if (heroFixExamples.length < 8) {
      heroFixExamples.push({
        slug: published[i].slug,
        name: published[i].name,
        from: published[i].images?.[0]?.url,
        to: published[i].images?.[afterIndices[i]]?.url,
      });
    }
  }
}

const beforeDupes = countGridAdjacentDupes(published, beforeIndices);
const afterDupes = countGridAdjacentDupes(published, afterIndices);

catalog.updatedAt = new Date().toISOString().slice(0, 10);
fs.writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      locationCorrections: locationCorrections.length,
      locationExamples: locationCorrections.slice(0, 12),
      duplicateAdjacentHeroImagesFixed: heroFixes,
      gridAdjacentDupesBefore: beforeDupes,
      gridAdjacentDupesAfter: afterDupes,
      heroFixExamples,
    },
    null,
    2
  )
);
