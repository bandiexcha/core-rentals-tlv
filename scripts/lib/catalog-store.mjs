import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "../..");
export const DATA_FILE = path.join(ROOT, "src/data/apartments.json");
export const IMAGES_DIR = path.join(ROOT, "public/apartments");

export function loadCatalog() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

export function saveCatalog(catalog) {
  catalog.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(catalog, null, 2) + "\n");
}

export function upsertApartment(catalog, apartment) {
  const idx = catalog.apartments.findIndex(
    (a) => a.id === apartment.id || a.internalSourceUrl === apartment.internalSourceUrl
  );
  if (idx >= 0) {
    catalog.apartments[idx] = { ...catalog.apartments[idx], ...apartment };
    return "updated";
  }
  catalog.apartments.push(apartment);
  return "created";
}

export function uniqueSlug(catalog, baseSlug) {
  let slug = baseSlug;
  let i = 2;
  while (catalog.apartments.some((a) => a.slug === slug)) {
    slug = `${baseSlug}-${i}`;
    i++;
  }
  return slug;
}

export function replaceCatalogSources(sources) {
  const catalog = loadCatalog();
  catalog.apartments = catalog.apartments.filter(
    (a) => !sources.includes(a.source)
  );
  saveCatalog(catalog);
  return catalog;
}

export function featureFirstApartments(catalog, count = 6) {
  let featured = 0;
  for (const apt of catalog.apartments) {
    if (!apt.published) continue;
    apt.featured = featured < count;
    if (apt.featured) featured++;
  }
  saveCatalog(catalog);
}
