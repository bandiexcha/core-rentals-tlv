import fs from "fs";
import path from "path";
import crypto from "crypto";
import { slugify } from "./import-utils.mjs";
import { KNOWN_BRANDING_HASHES } from "./branding-image-detect.mjs";

/** Matches HolyGuest, Sea N' Rent, Sea N Rent, Sea and Rent, Seanrent, etc. */
export const BRAND_NAME_RE =
  /(?:Holy\s*Guest|HolyGuest|Sea\s*N[\u2019']?\s*Rent|Sea\s*and\s*Rent|Seanrent|Sean\s*Rent)/gi;

export const BRAND_SUFFIX_RE =
  /\s*by\s+(?:Holy\s*Guest|HolyGuest|Sea\s*N[\u2019']?\s*Rent|Sea\s*and\s*Rent|Seanrent|Sean\s*Rent)\b.*$/i;

const BRAND_IMAGE_URL_RE =
  /(?:logo|brand|branding|watermark|welcome[\-_]?card|marketing|banner|cover[\-_]?slide|info[\-_]?card|promo|Seanrent|holyguest|guesty[\-_]?logo|powered[\-_]?by)/i;

const HOSTED_BY_RE =
  /\s*(?:hosted|operated|managed|provided)\s+by\s+(?:Holy\s*Guest|HolyGuest|Sea\s*N[\u2019']?\s*Rent|Sea\s*and\s*Rent|Seanrent|Sean\s*Rent)\.?/gi;

export function stripBrandSuffix(text = "") {
  return text.replace(BRAND_SUFFIX_RE, "").replace(/\s*\|\s*.+$/, "").trim();
}

export function cleanAddress(address = "") {
  if (!address) return "";
  let out = address.replace(BRAND_SUFFIX_RE, "").replace(BRAND_NAME_RE, "").trim();
  out = out.replace(/\s{2,}/g, " ").replace(/^[,.\s]+|[,.\s]+$/g, "");
  return out;
}

export function cleanApartmentName(name = "") {
  let cleaned = stripBrandSuffix(name);
  cleaned = cleaned.replace(BRAND_NAME_RE, "").replace(/\s{2,}/g, " ").trim();
  cleaned = cleaned.replace(/^[-–—,\s]+|[-–—,\s]+$/g, "").trim();
  return cleaned || "Apartment";
}

export function cleanDescription(text = "") {
  if (!text) return text;

  let out = text;

  // Booking.com boilerplate with embedded brand in property name
  out = out.replace(
    /Prime Location:\s*([^.\n]+?)\s+by\s+Sea\s*N[\u2019']?\s*Rent\s+in\s+/gi,
    "Prime Location: $1 in "
  );
  out = out.replace(
    /([^.\n]+?)\s+by\s+Sea\s*N[\u2019']?\s*Rent\s+offers\s+/gi,
    "$1 offers "
  );
  out = out.replace(
    /The Vacation rental apartment hosted by Sea\s*N[\u2019']?\s*Rent is\s+/gi,
    "This vacation rental apartment is "
  );
  // Remove "by [Brand]" anywhere in text (not just suffix)
  out = out.replace(
    /\s+by\s+(?:Holy\s*Guest|HolyGuest|Sea\s*N[\u2019']?\s*Rent|Sea\s*and\s*Rent|Seanrent|Sean\s*Rent)\b[,.\s]*/gi,
    " "
  );
  out = out.replace(
    /(?:Welcome to (?:our|your|this) )([^!.\n]+?) by Sea\s*N[\u2019']?\s*Rent/gi,
    "Welcome to $1"
  );
  out = out.replace(
    /(?:a|an|the|this)\s+([^,.\n]+?)\s+by Sea\s*N[\u2019']?\s*Rent/gi,
    "$1"
  );
  out = out.replace(
    /(?:vacation rental )?apartment\s+by Sea\s*N[\u2019']?\s*Rent/gi,
    "apartment"
  );
  out = out.replace(
    /Welcome to your home away from home by Sea\s*N[\u2019']?\s*Rent!/gi,
    "Welcome to your home away from home!"
  );
  out = out.replace(
    /(?:in|from|at|by)\s+Sea\s*N[\u2019']?\s*Rent[!.]?\s*/gi,
    ""
  );

  // Booking.com auto-generated section headers (inline or line-start)
  out = out.replace(
    /(?:^|\.\s*)(?:Spacious Accommodations|Modern Amenities|Prime Location|Comfortable Accommodations|Excellent Location):\s*/gim,
    (match) => (match.startsWith(".") ? ". " : "")
  );
  out = out.replace(
    /Distance in property description is calculated using © OpenStreetMap/gi,
    ""
  );

  // HolyGuest-specific copy
  out = out.replace(/At this HolyGuest,?\s*/gi, "");
  out = out.replace(
    /(?:explore|use|download)\s+(?:the\s+)?HolyGuest app(?:\s+for[^.!\n]*)?[.!]?\s*/gi,
    ""
  );
  out = out.replace(
    /(?:with|through|via)\s+HolyGuest(?:\s+for[^.!\n]*)?[.!]?\s*/gi,
    ""
  );
  out = out.replace(/Experience the essence of Tel Aviv living with HolyGuest\.?\s*/gi, "");
  out = out.replace(HOSTED_BY_RE, " ");

  // Generic brand removal
  out = out.replace(BRAND_SUFFIX_RE, "");
  out = out.replace(BRAND_NAME_RE, "");

  // Cleanup artifacts
  out = out.replace(/\s{2,}/g, " ");
  out = out.replace(/\n{3,}/g, "\n\n");
  out = out.replace(/^\s+|\s+$/gm, "");
  out = out.replace(/\.\s+\./g, ".");
  out = out.replace(/,\s*,/g, ",");

  return out.trim();
}

export function shortDescriptionFromFull(full = "", max = 220) {
  const cleaned = cleanDescription(full);
  if (cleaned.length <= max) return cleaned;
  const cut = cleaned.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}

export function containsBranding(text = "") {
  BRAND_NAME_RE.lastIndex = 0;
  return BRAND_NAME_RE.test(text) || /by-holyguest|by-sea-n/i.test(text);
}

export function cleanAmenitiesList(amenities = []) {
  return amenities
    .map((a) => cleanDescription(String(a)))
    .filter((a) => {
      if (!a) return false;
      if (/^(?:Do they|Can I|Is there|What |Are there|How )/i.test(a)) return false;
      if (/\d+\s*(?:ft|mi|km)\s*$/i.test(a)) return false;
      if (containsBranding(a)) return false;
      return true;
    });
}

export function isBrandingImage({ url, sourceUrl, filepath }) {
  for (const candidate of [sourceUrl, url]) {
    if (!/^https?:\/\//i.test(candidate || "")) continue;
    if (BRAND_IMAGE_URL_RE.test(candidate)) return true;
    if (/tenants\/Seanrent\/.*(?:logo|brand|welcome|banner|card|info)/i.test(candidate)) {
      return true;
    }
    if (/assets\.guesty\.com.*(?:logo|brand|watermark)/i.test(candidate)) return true;
  }

  if (filepath && fs.existsSync(filepath)) {
    const base = path.basename(filepath).toLowerCase();
    if (/logo|brand|welcome|banner|promo|card/.test(base)) return true;

    try {
      const hash = crypto.createHash("md5").update(fs.readFileSync(filepath)).digest("hex");
      if (KNOWN_BRANDING_HASHES.has(hash)) return true;
    } catch {}
  }

  return false;
}

export function filterBrandingImages(images, imagesDir, slug) {
  const kept = [];
  for (const img of images || []) {
    const rel = img.url?.replace(/^\/apartments\//, "") || "";
    const filepath = path.join(imagesDir, rel);
    if (isBrandingImage({ url: img.url, sourceUrl: img.sourceUrl, filepath })) {
      continue;
    }
    kept.push(img);
  }
  return kept;
}

export function renameImageFolder(imagesDir, oldSlug, newSlug) {
  if (oldSlug === newSlug) return false;
  const oldDir = path.join(imagesDir, oldSlug);
  const newDir = path.join(imagesDir, newSlug);
  if (!fs.existsSync(oldDir)) return false;
  if (fs.existsSync(newDir)) {
    // Merge: move files from old into new with new indices
    const existing = fs.readdirSync(newDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
    let next = existing.length + 1;
    for (const file of fs.readdirSync(oldDir).sort()) {
      if (!/\.(jpe?g|png|webp)$/i.test(file)) continue;
      const ext = path.extname(file);
      fs.renameSync(path.join(oldDir, file), path.join(newDir, `${String(next).padStart(2, "0")}${ext}`));
      next++;
    }
    fs.rmSync(oldDir, { recursive: true, force: true });
  } else {
    fs.renameSync(oldDir, newDir);
  }
  return true;
}

export function renumberImagesInFolder(imagesDir, slug) {
  const dir = path.join(imagesDir, slug);
  if (!fs.existsSync(dir)) return [];

  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort();

  const result = [];
  let index = 1;
  const tempNames = [];

  for (const file of files) {
    const ext = path.extname(file);
    const temp = path.join(dir, `_tmp_${index}${ext}`);
    fs.renameSync(path.join(dir, file), temp);
    tempNames.push({ temp, ext });
    index++;
  }

  index = 1;
  for (const { temp, ext } of tempNames) {
    const finalName = `${String(index).padStart(2, "0")}${ext}`;
    fs.renameSync(temp, path.join(dir, finalName));
    result.push({
      url: `/apartments/${slug}/${finalName}`,
      alt: `Apartment photo ${index}`,
    });
    index++;
  }

  return result;
}

export function uniqueSlugForRename(catalog, baseSlug, excludeId) {
  let slug = baseSlug;
  let i = 2;
  while (
    catalog.apartments.some((a) => a.slug === slug && a.id !== excludeId)
  ) {
    slug = `${baseSlug}-${i}`;
    i++;
  }
  return slug;
}

export function cleanApartment(apartment, catalog, imagesDir) {
  const changes = {
    name: false,
    slug: false,
    descriptions: false,
    imagesRemoved: 0,
  };

  const cleanedName = cleanApartmentName(apartment.name);
  if (cleanedName !== apartment.name) {
    changes.name = true;
    apartment.name = cleanedName;
  }

  const cleanedFull = cleanDescription(apartment.fullDescription || "");
  const cleanedShort = cleanDescription(apartment.shortDescription || "");

  if (cleanedFull !== apartment.fullDescription) {
    changes.descriptions = true;
    apartment.fullDescription = cleanedFull;
  }

  const newShort =
    cleanedShort && cleanedShort !== cleanedFull.slice(0, 220)
      ? cleanedShort.slice(0, 220)
      : shortDescriptionFromFull(cleanedFull);

  if (newShort !== apartment.shortDescription) {
    changes.descriptions = true;
    apartment.shortDescription = newShort;
  }

  const cleanedAmenities = cleanAmenitiesList(apartment.amenities || []);
  if (
    cleanedAmenities.length !== (apartment.amenities?.length || 0) ||
    cleanedAmenities.some((a, i) => a !== apartment.amenities[i])
  ) {
    changes.descriptions = true;
    apartment.amenities = cleanedAmenities;
  }

  const baseSlug = slugify(apartment.name) || apartment.id;
  const newSlug = uniqueSlugForRename(catalog, baseSlug, apartment.id);
  const oldSlug = apartment.slug;

  if (newSlug !== oldSlug) {
    renameImageFolder(imagesDir, oldSlug, newSlug);
    changes.slug = true;
    apartment.slug = newSlug;
  }

  // Remove branding images from disk and metadata
  const dir = path.join(imagesDir, apartment.slug);
  if (fs.existsSync(dir)) {
    const currentImages =
      apartment.images?.length > 0
        ? apartment.images
        : fs
            .readdirSync(dir)
            .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
            .sort()
            .map((f, i) => ({
              url: `/apartments/${apartment.slug}/${f}`,
              alt: `Apartment photo ${i + 1}`,
            }));

    const before = currentImages.length;
    const filtered = filterBrandingImages(currentImages, imagesDir, apartment.slug);

    for (const img of currentImages) {
      if (!filtered.includes(img)) {
        const rel = img.url?.replace(/^\/apartments\//, "") || "";
        const fp = path.join(imagesDir, rel);
        if (fs.existsSync(fp)) {
          try {
            fs.unlinkSync(fp);
          } catch {}
        }
      }
    }

    apartment.images = renumberImagesInFolder(imagesDir, apartment.slug);
    for (let i = 0; i < apartment.images.length && i < filtered.length; i++) {
      if (filtered[i]?.sourceUrl) apartment.images[i].sourceUrl = filtered[i].sourceUrl;
    }

    changes.imagesRemoved = before - apartment.images.length;
  }

  return changes;
}
