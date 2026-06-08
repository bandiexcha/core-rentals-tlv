import fs from "fs";
import path from "path";
import {
  guessNeighborhood,
  guessTags,
  normalizeAmenities,
  randomDelay,
  slugify,
  sleep,
} from "./import-utils.mjs";
import {
  cleanApartmentName,
  cleanAddress,
  cleanDescription,
  renumberImagesInFolder,
  shortDescriptionFromFull,
} from "./branding-cleanup.mjs";
import {
  KNOWN_BRANDING_HASHES,
  filterBrandingImagesAsync,
} from "./branding-image-detect.mjs";
import {
  IMAGES_DIR,
  loadCatalog,
  saveCatalog,
  uniqueSlug,
  upsertApartment,
} from "./catalog-store.mjs";

const BB_BASE = "https://seanrent.bookingsboom.com";

export function bookingsBoomSourceUrl(id) {
  return `${BB_BASE}/listings/${id}`;
}

export function bookingsBoomApartmentId(id) {
  return `seanrent-bb-${id}`;
}

function countBedrooms(listing) {
  const rooms = listing.room_composition || [];
  const bedrooms = rooms.filter(
    (r) =>
      /bedroom/i.test(r.integration_type || "") ||
      /bedroom/i.test(r.bedroomName || "")
  );
  if (bedrooms.length) return bedrooms.length;
  const beds = Number(listing.beds);
  if (beds >= 1) return Math.max(1, Math.round(beds));
  return 1;
}

function buildDescription(listing) {
  const parts = [];
  const summary =
    listing.marketing_content?.summary ||
    listing.description ||
    listing.localization?.en?.summary;
  if (summary) parts.push(cleanDescription(summary.trim()));

  const neighborhood = listing.neighborhood;
  if (neighborhood && !summary?.includes(neighborhood)) {
    parts.push(`Located in ${neighborhood}.`);
  }

  return parts.join("\n\n").trim();
}

function pickName(listing) {
  const raw =
    listing.title ||
    listing.nickname?.replace(/\s*#\d+\s*$/, "").trim() ||
    listing.nickname ||
    `Apartment ${listing.id}`;
  return cleanApartmentName(raw);
}

function extractImageUrls(listing) {
  const urls = [];
  if (listing.picture) urls.push(listing.picture);
  for (const pic of listing.pictures || []) {
    const url = pic.original || pic.large || pic.url;
    if (url) urls.push(url.replace(/^http:/, "https:"));
  }
  return [...new Set(urls)].filter((u) => /cloudinary|jpg|jpeg|png|webp/i.test(u));
}

function filterListingImages(imageUrls) {
  return imageUrls.filter(
    (url) => !/(?:logo|brand|welcome[\-_]?card|marketing|banner|Seanrent\/.*logo)/i.test(url)
  );
}

async function downloadImages(slug, imageUrls) {
  const dir = path.join(IMAGES_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  const saved = [];
  let index = 1;

  for (const url of imageUrls.slice(0, 20)) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "CoreRentalsTLV-Import/1.0" },
      });
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") || "image/jpeg";
      const ext = contentType.includes("png")
        ? "png"
        : contentType.includes("webp")
          ? "webp"
          : "jpg";
      const filename = `${String(index).padStart(2, "0")}.${ext}`;
      fs.writeFileSync(path.join(dir, filename), Buffer.from(await res.arrayBuffer()));
      saved.push({
        url: `/apartments/${slug}/${filename}`,
        alt: `Apartment photo ${index}`,
      });
      index++;
      await randomDelay(300, 700);
    } catch {}
  }
  return saved;
}

async function filterDownloadedGallery(slug, images) {
  if (!images.length) return images;
  const blocklist = KNOWN_BRANDING_HASHES;
  const filtered = await filterBrandingImagesAsync(images, IMAGES_DIR, slug, blocklist, {
    definiteOnly: true,
    safeMinKeep: 3,
  });
  if (filtered.length === images.length) return filtered;

  for (const img of images) {
    if (filtered.some((f) => f.url === img.url)) continue;
    const rel = img.url?.replace(/^\/apartments\//, "") || "";
    const fp = path.join(IMAGES_DIR, rel);
    if (fs.existsSync(fp)) {
      try {
        fs.unlinkSync(fp);
      } catch {}
    }
  }
  return renumberImagesInFolder(IMAGES_DIR, slug);
}

export async function fetchListingDetail(page, listingId, sessionId, retries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await page.goto(`${BB_BASE}/?lang=en`, {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      await sleep(1000 + attempt * 500);

      const fetchUrl = `/api/booking/listings/${listingId}?language=en&booking_session_id=${sessionId}`;
      const result = await page.evaluate(async (url) => {
        try {
          const r = await fetch(url);
          if (!r.ok) return { error: r.status };
          return r.json();
        } catch (e) {
          return { error: e.message };
        }
      }, fetchUrl);

      if (result?.error) throw new Error(`Detail API ${result.error}`);
      if (!result?.listing) throw new Error("No listing in API response");
      return result.listing;
    } catch (err) {
      lastError = err;
      await sleep(2000 * attempt);
    }
  }

  throw lastError || new Error("Failed to fetch listing detail");
}

export async function importBookingsBoomListing(page, listingId, sessionId, options = {}) {
  const { publish = true } = options;
  const listing = await fetchListingDetail(page, listingId, sessionId);

  const name = pickName(listing);
  const fullDescription = buildDescription(listing);
  if (!fullDescription) throw new Error("No description available");

  const catalog = loadCatalog();
  const aptId = bookingsBoomApartmentId(listingId);
  const existing = catalog.apartments.find(
    (a) => a.id === aptId || a.internalSourceUrl === bookingsBoomSourceUrl(listingId)
  );
  const baseSlug = slugify(name) || `seanrent-${listingId}`;
  const slug = existing
    ? catalog.apartments.some((a) => a.slug === baseSlug && a.id !== existing.id)
      ? existing.slug
      : baseSlug
    : uniqueSlug(catalog, baseSlug);

  const imageUrls = filterListingImages(extractImageUrls(listing));
  if (!imageUrls.length) throw new Error("No images found");

  const images = await downloadImages(slug, imageUrls);
  if (!images.length) throw new Error("No images downloaded");

  const filteredImages = await filterDownloadedGallery(slug, images);

  const address = cleanAddress(listing.address || "");
  const cityMatch = address.match(/,\s*([^,]+),\s*Israel/i);
  const city = cityMatch?.[1]?.trim() || listing.city_name || "Tel Aviv";
  const combined = `${name} ${fullDescription} ${address} ${listing.neighborhood || ""}`;

  const bedrooms = countBedrooms(listing);
  const bathrooms = Math.max(1, Math.ceil(Number(listing.baths) || 1));
  const guests = Math.max(1, Number(listing.accommodates) || Math.max(2, bedrooms * 2));

  const apartment = {
    id: aptId,
    slug,
    name,
    city,
    neighborhood: guessNeighborhood(combined, city),
    ...(address ? { address } : {}),
    shortDescription: shortDescriptionFromFull(fullDescription),
    fullDescription,
    guests,
    bedrooms,
    bathrooms,
    amenities: normalizeAmenities(listing.amenities || []),
    tags: guessTags(combined, listing.amenities || []),
    images: filteredImages.length ? filteredImages : images,
    internalSourceUrl: bookingsBoomSourceUrl(listingId),
    source: "seanrent",
    featured: false,
    published: publish,
    needsReview: false,
    importedAt: new Date().toISOString(),
    discoveryChannel: "bookingsboom",
  };

  const action = upsertApartment(catalog, apartment);
  saveCatalog(catalog);

  return { apartment, action, imageCount: images.length };
}

export async function obtainBookingsBoomSession(page) {
  let sessionId = "";
  const capture = (res) => {
    const m = res.url().match(/booking_session_id=([^&]+)/);
    if (m) sessionId = m[1];
  };
  page.on("response", capture);
  await page.goto(`${BB_BASE}/?lang=en`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await sleep(3000);
  page.off("response", capture);
  if (!sessionId) throw new Error("Could not obtain BookingsBoom session ID");
  return sessionId;
}
