import fs from "fs";
import path from "path";
import {
  buildDescription,
  guessNeighborhood,
  guessTags,
  normalizeAmenities,
  sleep,
  slugify,
  SOURCE_CONFIG,
} from "./import-utils.mjs";
import {
  IMAGES_DIR,
  loadCatalog,
  saveCatalog,
  upsertApartment,
} from "./catalog-store.mjs";

function flattenObject(obj, prefix = "") {
  const out = [];
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) out.push(...flattenObject(v, key));
    else out.push([key, v]);
  }
  return out;
}

function findInPayload(payload, keys) {
  const flat = flattenObject(payload);
  for (const key of keys) {
    const hit = flat.find(([k]) => k.toLowerCase().endsWith(key.toLowerCase()));
    if (hit) return hit[1];
  }
  return null;
}

function extractSeanRentListing(json) {
  const data = json.data || json.listing || json.property || json;
  if (Array.isArray(data)) return data[0];
  return data;
}

function mapSeanRentPayload(raw, sourceUrl, { publish = false } = {}) {
  const title =
    raw.name ||
    raw.title ||
    raw.headline ||
    findInPayload(raw, ["name", "title", "headline"]) ||
    "SeanRent Apartment";

  const description =
    raw.description ||
    raw.summary ||
    raw.about ||
    findInPayload(raw, ["description", "summary", "about", "overview"]) ||
    "";

  const address =
    raw.address ||
    raw.location ||
    findInPayload(raw, ["address.full", "address", "location.name"]) ||
    "";

  const guests =
    raw.max_guests ||
    raw.guests ||
    raw.accommodates ||
    findInPayload(raw, ["max_guests", "guests", "accommodates", "sleeps"]) ||
    2;

  const bedrooms =
    raw.bedrooms ||
    raw.bedroom_count ||
    findInPayload(raw, ["bedrooms", "bedroom_count", "bedroomCount"]) ||
    1;

  const bathrooms =
    raw.bathrooms ||
    raw.bathroom_count ||
    findInPayload(raw, ["bathrooms", "bathroom_count", "bathroomCount"]) ||
    1;

  const amenities =
    raw.amenities ||
    raw.features ||
    findInPayload(raw, ["amenities", "features"]) ||
    [];

  const imagesRaw =
    raw.images ||
    raw.photos ||
    raw.gallery ||
    raw.media ||
    findInPayload(raw, ["images", "photos", "gallery", "media"]) ||
    [];

  const imageUrls = [];
  if (raw.cover_image) imageUrls.push(raw.cover_image);
  if (raw.main_image) imageUrls.push(raw.main_image);
  if (raw.thumbnail) imageUrls.push(raw.thumbnail);

  for (const item of imagesRaw) {
    if (typeof item === "string") imageUrls.push(item);
    else if (item?.url) imageUrls.push(item.url);
    else if (item?.original) imageUrls.push(item.original);
    else if (item?.large) imageUrls.push(item.large);
    else if (item?.src) imageUrls.push(item.src);
  }

  const slug = slugify(title);
  const fullDescription = typeof description === "string" ? description : JSON.stringify(description);
  const shortDescription = fullDescription.slice(0, 220);
  const combined = `${title} ${fullDescription} ${address}`;

  return {
    id: raw.id || raw.uuid || slug,
    slug,
    name: title,
    city: "Tel Aviv",
    neighborhood: guessNeighborhood(combined, "Tel Aviv"),
    shortDescription,
    fullDescription,
    guests: Number(guests) || 2,
    bedrooms: Number(bedrooms) || 1,
    bathrooms: Math.ceil(Number(bathrooms) || 1),
    amenities: normalizeAmenities(Array.isArray(amenities) ? amenities : []),
    tags: guessTags(combined, Array.isArray(amenities) ? amenities : []),
    imageUrls: [...new Set(imageUrls)].filter(Boolean),
    internalSourceUrl: sourceUrl,
    source: "seanrent",
    featured: false,
    published: publish,
    needsReview: !publish,
    importedAt: new Date().toISOString(),
  };
}

async function downloadImages(slug, imageUrls) {
  const dir = path.join(IMAGES_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  const saved = [];
  let index = 1;

  for (const url of imageUrls) {
    try {
      const absolute = url.startsWith("http") ? url : `https://booking.seanrent.com${url}`;
      const res = await fetch(absolute, {
        headers: { "User-Agent": "CoreRentalsTLV-Import/1.0" },
      });
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") || "image/jpeg";
      const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
      const filename = `${String(index).padStart(2, "0")}.${ext}`;
      fs.writeFileSync(path.join(dir, filename), Buffer.from(await res.arrayBuffer()));
      saved.push({ url: `/apartments/${slug}/${filename}`, alt: `Apartment photo ${index}` });
      index++;
      await sleep(300);
    } catch {
      /* skip broken image */
    }
  }
  return saved;
}

async function scrapeSeanRentDom(page) {
  return page.evaluate(() => {
    const getText = (sel) => document.querySelector(sel)?.textContent?.trim() || "";
    const title =
      getText("h1") ||
      getText('[class*="title"]') ||
      document.title.replace(/\s*\|.*/, "").trim();

    const description =
      getText('[class*="description"]') ||
      getText("article p") ||
      getText("main p");

    const images = [...document.querySelectorAll("img")]
      .map((img) => img.src || img.dataset.src)
      .filter((src) => src && /maveriks|cdn|image|photo|jpg|jpeg|png|webp/i.test(src))
      .filter((src) => !/logo|icon|avatar|svg/i.test(src));

    const text = document.body.innerText;
    const guests = text.match(/(\d+)\s+guests/i)?.[1];
    const bedrooms = text.match(/(\d+)\s+bedroom/i)?.[1];
    const bathrooms = text.match(/(\d+)\s+bath/i)?.[1];

    return { title, description, images: [...new Set(images)], guests, bedrooms, bathrooms };
  });
}

export async function importSeanRentUrl(page, url, { downloadImages: shouldDownload = true } = {}) {
  console.log(`\n📥 Importing SeanRent: ${url}`);
  const payloads = [];

  page.on("response", async (res) => {
    const u = res.url();
    if (!/shine-api|maveriks|web-api/i.test(u)) return;
    const ct = res.headers()["content-type"] || "";
    if (!ct.includes("json")) return;
    try {
      const json = await res.json();
      if (json.data && !Array.isArray(json.data)) payloads.push(json.data);
      else if (json.data?.length === 1) payloads.push(json.data[0]);
      else if (json.id || json.uuid || json.title || json.name) payloads.push(json);
    } catch {
      /* ignore */
    }
  });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await sleep(6000);

  let mapped;
  const apiPayload = payloads.find(
    (p) => p?.title || p?.name || p?.description || p?.images || p?.photos
  );

  if (apiPayload) {
    mapped = mapSeanRentPayload(apiPayload, url);
  } else {
    const dom = await scrapeSeanRentDom(page);
    mapped = mapSeanRentPayload(
      {
        title: dom.title,
        description: dom.description,
        images: dom.images,
        guests: dom.guests,
        bedrooms: dom.bedrooms,
        bathrooms: dom.bathrooms,
      },
      url
    );
  }

  const images = shouldDownload
    ? await downloadImages(mapped.slug, mapped.imageUrls)
    : mapped.imageUrls.slice(0, 12).map((u, i) => ({ url: u, alt: `Photo ${i + 1}` }));

  if (!images.length) throw new Error("No images extracted from SeanRent listing");

  const apartment = { ...mapped, images };
  delete apartment.imageUrls;

  const catalog = loadCatalog();
  const action = upsertApartment(catalog, apartment);
  saveCatalog(catalog);
  console.log(`  ✓ ${action}: ${apartment.name} (${images.length} images)`);
  return { apartment, action };
}

export async function discoverSeanRentFromSearch(page, searchTerm = "Tel Aviv, Israel") {
  console.log(`\n🔍 Discovering Sea N' Rent listings (Tel Aviv)...`);
  const listingUrls = new Set();
  const payloads = [];
  let searchHeaders = null;

  page.on("response", async (res) => {
    const u = res.url();
    if (!/shine-api\.maveriks\.com\/search/i.test(u)) return;
    if (!searchHeaders && res.request().headers()["x-host"]) {
      searchHeaders = res.request().headers();
    }
    try {
      const json = await res.json();
      for (const item of json.data || []) {
        payloads.push(item);
        const slug = item.slug || item.id || item.uuid;
        if (item.url) listingUrls.add(item.url);
        else if (slug) listingUrls.add(`https://booking.seanrent.com/s/accommodations/${slug}`);
      }
      if (json.data?.length) {
        console.log(`  Search page returned ${json.data.length} (total ${json.meta?.total || "?"})`);
      }
    } catch {
      /* ignore */
    }
  });

  const searchUrl =
    SOURCE_CONFIG.seanrent.searchUrl ||
    "https://booking.seanrent.com/en-US/s?city=tel-aviv&country=IL&currency=USD&region=%7B%22city%22%3A%22tel-aviv%22%2C%22country%22%3A%22IL%22%7D";

  await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 120000 });
  await sleep(5000);

  // Paginate search API using captured headers
  if (searchHeaders) {
    let pageNum = 1;
    let lastPage = 1;
    do {
      const variants = [
        `search?page=${pageNum}&per_page=100&filter[country_code]=IL&filter[city]=tel-aviv&filter[exact_match]=0`,
        `search?page=${pageNum}&per_page=100&filter[country_code]=IL&filter[city]=tel-aviv&filter[is_partner]=0&filter[exact_match]=0`,
        `search?page=${pageNum}&per_page=100&filter[exact_match]=0&filter[company_id]=${SOURCE_CONFIG.seanrent.companyId || "619a7443-b289-4b3c-a37a-44985fe8f329"}`,
      ];
      for (const q of variants) {
        const json = await page.evaluate(
          async ({ q, h }) => {
            const res = await fetch(`https://shine-api.maveriks.com/${q}`, {
              headers: h,
              credentials: "include",
            });
            if (!res.ok) return null;
            return res.json();
          },
          { q, h: searchHeaders }
        );
        if (!json?.data?.length) continue;
        for (const item of json.data) {
          payloads.push(item);
          const slug = item.slug || item.id;
          if (slug) listingUrls.add(`https://booking.seanrent.com/s/accommodations/${slug}`);
        }
        lastPage = json.meta?.last_page || 1;
        console.log(`  API page ${pageNum}: +${json.data.length} (total ${json.meta?.total})`);
        break;
      }
      pageNum++;
    } while (pageNum <= lastPage && pageNum <= 50);
  }

  // Fallback: location search UI
  if (!payloads.length) {
    const location = page.locator('input[placeholder="Location"]').first();
    if (await location.count()) {
      await location.click({ force: true });
      await location.fill(searchTerm);
      await sleep(3000);
      const pacItem = page.locator(".pac-item").first();
      if (await pacItem.count()) await pacItem.click();
      await page.locator('button:has-text("Search")').last().click().catch(() => {});
      await sleep(10000);
    }
  }

  const domLinks = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
  for (const link of domLinks) {
    if (/accommodations\//i.test(link)) listingUrls.add(link);
  }

  console.log(`  Found ${payloads.length} payloads, ${listingUrls.size} URLs`);
  return { urls: [...listingUrls], payloads };
}

export async function importSeanRentCatalog(page, options = {}) {
  const { searchTerm = "Tel Aviv, Israel", limit } = options;
  const { urls, payloads } = await discoverSeanRentFromSearch(page, searchTerm);

  if (!urls.length && payloads.length) {
    console.log(`  Importing ${payloads.length} listings from search payloads`);
    const catalog = loadCatalog();
    const results = [];

    for (const raw of payloads.slice(0, limit || payloads.length)) {
      const mapped = mapSeanRentPayload(raw, SOURCE_CONFIG.seanrent.catalogUrl);
      const images = await downloadImages(mapped.slug, mapped.imageUrls);
      if (!images.length) continue;
      const apartment = { ...mapped, images };
      delete apartment.imageUrls;
      const action = upsertApartment(catalog, apartment);
      results.push({ name: apartment.name, action });
    }

    saveCatalog(catalog);
    return results;
  }

  const selected = limit ? urls.slice(0, limit) : urls;
  const results = [];
  for (const url of selected) {
    try {
      const { apartment, action } = await importSeanRentUrl(page, url, options);
      results.push({ name: apartment.name, action });
      await sleep(2000);
    } catch (err) {
      console.error(`  ✗ ${url}: ${err.message}`);
    }
  }
  return results;
}
