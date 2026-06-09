/**
 * Build 256-bit perceptual hashes for catalog image de-duplication.
 * Run: node scripts/build-visual-hashes.mjs
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CATALOG_PATH = path.join(ROOT, "src/data/apartments.json");

async function visualHash(filepath) {
  const { data } = await sharp(filepath)
    .resize(17, 16, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bits = "";
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      bits += data[y * 17 + x] < data[y * 17 + x + 1] ? "1" : "0";
    }
  }
  return bits;
}

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
let updated = 0;

for (const apt of catalog.apartments.filter((a) => a.published)) {
  const hashes = [];
  for (const image of (apt.images ?? []).slice(0, 8)) {
    if (!image.url?.startsWith("/apartments/")) {
      hashes.push("");
      continue;
    }
    const filepath = path.join(ROOT, "public", image.url);
    try {
      hashes.push(await visualHash(filepath));
    } catch {
      hashes.push("");
    }
  }

  if (hashes.some(Boolean)) {
    apt.imageVisualHashes = hashes;
    updated++;
  } else {
    delete apt.imageVisualHashes;
  }
}

catalog.updatedAt = new Date().toISOString().slice(0, 10);
fs.writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Visual hashes updated for ${updated} apartments`);
