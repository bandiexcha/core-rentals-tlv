import fs from "fs";
import path from "path";
import {
  buildDescription,
  guessNeighborhood,
  guessTags,
  isTelAvivListing,
  normalizeAmenities,
  randomDelay,
  sleep,
  slugify,
  SOURCE_CONFIG,
  stripHolyGuestSuffix,
} from "./import-utils.mjs";
import {
  cleanApartmentName,
  cleanAddress,
  cleanDescription,
  renumberImagesInFolder,
  shortDescriptionFromFull,
} from "./branding-cleanup.mjs";
import {
  filterBrandingImagesAsync,
  KNOWN_BRANDING_HASHES,
} from "./branding-image-detect.mjs";
import {
  IMAGES_DIR,
  loadCatalog,
  saveCatalog,
  upsertApartment,
  featureFirstApartments,
} from "./catalog-store.mjs";

const LIST_FIELDS =
  "_id title roomType beds timezone publicDescription picture address accommodates bedrooms bathrooms propertyType amenities";
const DETAIL_FIELDS =
  "_id title nickname publicDescription address accommodates bedrooms bathrooms amenities pictures picture tags propertyType roomType";

const SESSION_REFRESH_EVERY = 20;
const CONSECUTIVE_FAIL_PAUSE = 5;

async function fetchGuestyPage(page, headers, cursor = null) {
  const params = new URLSearchParams({
    minOccupancy: "1",
    fields: LIST_FIELDS,
    limit: "20",
  });
  if (cursor) params.set("cursor", cursor);

  return page.evaluate(
    async ({ url, h }) => {
      const res = await fetch(url, { headers: h, credentials: "include" });
      if (!res.ok) throw new Error(`Guesty list HTTP ${res.status}`);
      const text = await res.text();
      if (!text) throw new Error("Guesty list empty response");
      return JSON.parse(text);
    },
    {
      url: `${SOURCE_CONFIG.holyguest.apiBase}/listings?${params.toString()}`,
      h: headers,
    }
  );
}

async function fetchGuestyDetail(page, headers, id) {
  const params = new URLSearchParams({ fields: DETAIL_FIELDS });
  return page.evaluate(
    async ({ url, h }) => {
      const res = await fetch(url, { headers: h, credentials: "include" });
      if (!res.ok) throw new Error(`Guesty detail HTTP ${res.status}`);
      const text = await res.text();
      if (!text) throw new Error("Guesty detail empty response");
      try {
        return JSON.parse(text);
      } catch {
        throw new Error("Guesty detail invalid JSON");
      }
    },
    {
      url: `${SOURCE_CONFIG.holyguest.apiBase}/listings/${id}?${params.toString()}`,
      h: headers,
    }
  );
}

async function captureGuestyHeaders(page) {
  let headers = null;
  const handler = (req) => {
    if (
      req.url().includes("pm-websites-backend/listings") &&
      !req.url().includes("/calendar") &&
      !headers
    ) {
      headers = req.headers();
    }
  };
  page.on("request", handler);
  await page.goto(SOURCE_CONFIG.holyguest.catalogUrl, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await sleep(5000);
  page.off("request", handler);
  if (!headers) throw new Error("Could not capture HolyGuest API headers");
  return headers;
}

async function fetchGuestyDetailWithRetry(page, headersRef, id, retries = 4) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetchGuestyDetail(page, headersRef.current, id);
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        const wait = 4000 * attempt + Math.random() * 2000;
        console.warn(`    ↻ Retry ${attempt}/${retries - 1} — ${err.message} (refreshing session, wait ${Math.round(wait / 1000)}s)`);
        headersRef.current = await captureGuestyHeaders(page);
        await sleep(wait);
      }
    }
  }
  throw lastErr;
}

async function fetchAllGuestySummaries(page, headers, maxCount = null) {
  const all = [];
  let cursor = null;
  let pageNum = 0;

  do {
    const json = await fetchGuestyPage(page, headers, cursor);
    all.push(...(json.results || []));
    cursor = json.pagination?.cursor?.next || null;
    pageNum++;
    console.log(`  HolyGuest page ${pageNum}: +${json.results?.length || 0} (total ${all.length}/${json.pagination?.total || "?"})`);
    if (maxCount && all.length >= maxCount * 3) break;
    await randomDelay(1500, 2800);
  } while (cursor);

  return all;
}

function extractImageUrls(detail) {
  const urls = [];
  if (detail.picture?.original) urls.push(detail.picture.original);
  for (const pic of detail.pictures || []) {
    const url = pic.original || pic.large || pic.regular || pic.thumbnail;
    if (url) urls.push(url);
  }
  return [...new Set(urls)].filter(Boolean);
}

async function downloadImages(slug, imageUrls) {
  const dir = path.join(IMAGES_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });

  const saved = [];
  let index = 1;

  for (const url of imageUrls) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "CoreRentalsTLV-Import/1.0" } });
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") || "image/jpeg";
      const ext = contentType.includes("png")
        ? "png"
        : contentType.includes("webp")
          ? "webp"
          : "jpg";
      const filename = `${String(index).padStart(2, "0")}.${ext}`;
      const filepath = path.join(dir, filename);
      fs.writeFileSync(filepath, Buffer.from(await res.arrayBuffer()));
      saved.push({
        url: `/apartments/${slug}/${filename}`,
        alt: `Apartment photo ${index}`,
        sourceUrl: url,
      });
      index++;
      await randomDelay(450, 950);
    } catch (err) {
      console.warn(`    ⚠ Failed image: ${url.slice(0, 80)}... (${err.message})`);
    }
  }

  return filterDownloadedGallery(slug, saved);
}

async function filterDownloadedGallery(slug, images) {
  if (!images.length) return images;
  const filtered = await filterBrandingImagesAsync(
    images,
    IMAGES_DIR,
    slug,
    KNOWN_BRANDING_HASHES,
    { definiteOnly: true }
  );

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

  const renumbered = renumberImagesInFolder(IMAGES_DIR, slug);
  for (let i = 0; i < renumbered.length && i < filtered.length; i++) {
    if (filtered[i]?.sourceUrl) renumbered[i].sourceUrl = filtered[i].sourceUrl;
  }
  return renumbered;
}

function mapGuestyToApartment(detail, images, sourceUrl, { publish = false } = {}) {
  const name = cleanApartmentName(stripHolyGuestSuffix(detail.title || "Untitled Apartment"));
  const slug = slugify(name) || detail._id;
  const fullDescription = cleanDescription(buildDescription(detail.publicDescription));
  const shortDescription = shortDescriptionFromFull(fullDescription);
  const rawAddress = detail.address?.full || "";
  const address = cleanAddress(rawAddress);
  const combined = `${name} ${fullDescription} ${address}`;
  const city = detail.address?.city?.includes("Tel Aviv")
    ? "Tel Aviv"
    : detail.address?.city || "Tel Aviv";

  return {
    id: detail._id,
    slug,
    name,
    city,
    neighborhood: guessNeighborhood(combined, city),
    ...(address ? { address } : {}),
    shortDescription,
    fullDescription,
    guests: detail.accommodates || 2,
    bedrooms: detail.bedrooms || 1,
    bathrooms: Math.ceil(detail.bathrooms || 1),
    amenities: normalizeAmenities(detail.amenities || []),
    tags: guessTags(combined, detail.amenities || []),
    images,
    internalSourceUrl: sourceUrl,
    source: "holyguest",
    featured: false,
    published: publish,
    needsReview: !publish,
    importedAt: new Date().toISOString(),
  };
}

export async function importHolyGuestCatalog(page, { limit, downloadImages: shouldDownload = true, publish = false } = {}) {
  console.log("\n📥 Importing HolyGuest catalog (resume mode)...");
  const headersRef = { current: await captureGuestyHeaders(page) };
  const summaries = (await fetchAllGuestySummaries(page, headersRef.current, limit)).filter(isTelAvivListing);

  const selected = limit ? summaries.slice(0, limit) : summaries;
  const targetTotal = selected.length;
  console.log(`  Found ${summaries.length} Tel Aviv listings (${targetTotal} target)`);

  const catalog = loadCatalog();
  const stats = { imported: 0, skipped: 0, failed: 0, total: targetTotal };
  let processedSinceRefresh = 0;
  let consecutiveFails = 0;

  for (const [i, summary] of selected.entries()) {
    const sourceUrl = SOURCE_CONFIG.holyguest.propertyUrl(summary._id);
    const existing = catalog.apartments.find((a) => a.id === summary._id);
    if (existing?.images?.length > 0) {
      stats.skipped++;
      console.log(`\n[${i + 1}/${targetTotal}] ${summary.title} — skip (already imported)`);
      continue;
    }

    if (processedSinceRefresh >= SESSION_REFRESH_EVERY) {
      console.log("\n  🔄 Proactive session refresh...");
      headersRef.current = await captureGuestyHeaders(page);
      processedSinceRefresh = 0;
      await randomDelay(3000, 5000);
    }

    console.log(`\n[${i + 1}/${targetTotal}] ${summary.title}`);

    try {
      const detail = await fetchGuestyDetailWithRetry(page, headersRef, summary._id);
      const imageUrls = extractImageUrls(detail);
      const slug = slugify(stripHolyGuestSuffix(detail.title)) || detail._id;

      const images = shouldDownload
        ? await downloadImages(slug, imageUrls)
        : imageUrls.slice(0, 12).map((url, idx) => ({
            url,
            alt: `Apartment photo ${idx + 1}`,
          }));

      if (!images.length) {
        console.warn("  ⚠ No images downloaded — skipping");
        stats.failed++;
        continue;
      }

      const apartment = mapGuestyToApartment(detail, images, sourceUrl, { publish });
      apartment.slug = slug;
      apartment.id = detail._id;

      const action = upsertApartment(catalog, apartment);
      stats.imported++;
      consecutiveFails = 0;
      processedSinceRefresh++;
      console.log(`  ✓ ${action} (${images.length} images)`);
      saveCatalog(catalog);
      await randomDelay(2200, 4800);
    } catch (err) {
      stats.failed++;
      consecutiveFails++;
      console.error(`  ✗ Failed: ${err.message}`);
      if (consecutiveFails >= CONSECUTIVE_FAIL_PAUSE) {
        console.warn(`  ⏸ ${consecutiveFails} consecutive failures — cooling down & refreshing session...`);
        headersRef.current = await captureGuestyHeaders(page);
        processedSinceRefresh = 0;
        consecutiveFails = 0;
        await randomDelay(15000, 25000);
      } else {
        await randomDelay(5000, 9000);
      }
    }
  }

  saveCatalog(catalog);
  if (publish) featureFirstApartments(catalog, 6);

  const inCatalog = catalog.apartments.filter((a) => a.source === "holyguest" && a.images?.length > 0).length;
  stats.inCatalog = inCatalog;
  stats.remaining = targetTotal - inCatalog;
  console.log(`\n📊 Pass complete: ${inCatalog}/${targetTotal} in catalog (+${stats.imported} new, ${stats.skipped} skipped, ${stats.failed} failed)`);
  return stats;
}

export async function importHolyGuestUrl(page, url, options = {}) {
  const match = url.match(/\/properties\/([a-f0-9]{24})/);
  if (!match) throw new Error("Invalid HolyGuest property URL");
  const id = match[1];
  const publish = options.publish ?? false;

  let headers = null;
  page.on("request", (req) => {
    if (req.url().includes("pm-websites-backend/listings") && !headers) {
      headers = req.headers();
    }
  });

  await page.goto(SOURCE_CONFIG.holyguest.propertyUrl(id), {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await sleep(4000);

  if (!headers) {
    await page.goto(SOURCE_CONFIG.holyguest.catalogUrl, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await sleep(3000);
    headers = await captureGuestyHeaders(page);
  }

  const detail = await fetchGuestyDetail(page, headers, id);
  const imageUrls = extractImageUrls(detail);

  const catalog = loadCatalog();
  const existing = catalog.apartments.find(
    (a) => a.id === id || a.internalSourceUrl === url
  );
  const slug = existing?.slug || slugify(stripHolyGuestSuffix(detail.title)) || id;

  const images =
    options.downloadImages !== false
      ? await downloadImages(slug, imageUrls)
      : imageUrls.map((u, i) => ({ url: u, alt: `Photo ${i + 1}` }));

  const apartment = mapGuestyToApartment(detail, images, url, { publish });
  apartment.slug = slug;
  apartment.id = detail._id;

  const action = upsertApartment(catalog, apartment);
  saveCatalog(catalog);
  return { apartment, action };
}
