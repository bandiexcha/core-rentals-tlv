import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { guessNeighborhood } from "./lib/import-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.join(__dirname, "../src/data/apartments.json");

function apartmentText(apt) {
  return [apt.name, apt.address, apt.shortDescription, apt.fullDescription]
    .filter(Boolean)
    .join(" ");
}

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
const corrections = [];

for (const apt of catalog.apartments) {
  const resolved = guessNeighborhood(apartmentText(apt), apt.city, {
    name: apt.name,
    address: apt.address,
  });
  if (resolved !== apt.neighborhood) {
    corrections.push({
      slug: apt.slug,
      name: apt.name,
      from: apt.neighborhood,
      to: resolved,
    });
    apt.neighborhood = resolved;
  }
}

catalog.updatedAt = new Date().toISOString().slice(0, 10);
fs.writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(JSON.stringify({ corrections: corrections.length, examples: corrections.slice(0, 15) }, null, 2));
