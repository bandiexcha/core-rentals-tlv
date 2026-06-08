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
  cleanAmenitiesList,
  cleanDescription,
  shortDescriptionFromFull,
} from "./branding-cleanup.mjs";
import { IMAGES_DIR, loadCatalog, saveCatalog, upsertApartment } from "./catalog-store.mjs";

const SEANRENT_SUFFIX = /\s*by\s+Sea\s*N[\u2019']?\s*Rent.*$/i;

export function stripSeanRentSuffix(name) {
  return cleanApartmentName(name.replace(SEANRENT_SUFFIX, "").replace(/\s*\(.*\)$/, "").trim());
}

export function bookingHotelId(url) {
  const m = url.match(/booking\.com\/hotel\/il\/([^.]+)/i);
  return m ? `booking-${m[1]}` : slugify(url);
}

async function scrapeBookingCom(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(4000);

  return page.evaluate(() => {
    const text = document.body?.innerText || "";

    const rawTitle =
      document.querySelector("h2.pp-header__title")?.textContent?.trim() ||
      document.querySelector("h1")?.textContent?.trim() ||
      document.title.split("|")[0].trim();

    if (!/sea n[\u2019']?\s*rent/i.test(rawTitle + text)) return null;

    const paragraphs = [
      ...document.querySelectorAll(
        "#property_description_content p, [data-testid='property-description'] p, .hp_desc_main_content p"
      ),
    ]
      .map((p) => p.textContent?.trim())
      .filter(Boolean);

    const aboutSection = text.match(/About this property([\s\S]{200,3000}?)(?:Most popular|Facilities|Area info)/i);
    const fullDescription = paragraphs.join("\n\n") || aboutSection?.[1]?.trim() || "";

    const images = [
      ...document.querySelectorAll(
        'img[src*="bstatic.com/xdata/images/hotel"], img[data-src*="bstatic.com"]'
      ),
    ]
      .map((img) => {
        const src = img.src || img.dataset?.src || "";
        return src.replace(/max\d+x\d+/, "max1024x768");
      })
      .filter((s) => s && !/logo|icon|avatar|flag|sprite/i.test(s));

    const address =
      document.querySelector('[data-testid="address"]')?.textContent?.trim() ||
      document.querySelector(".hp_address_subtitle")?.textContent?.trim() ||
      "";

    let bedrooms =
      text.match(/(\d+)\s+bedroom/i)?.[1] ||
      text.match(/(\d+)-Bedroom/i)?.[1] ||
      text.match(/(\d+)\s+bedrooms/i)?.[1];
    let bathrooms =
      text.match(/(\d+)\s+bathroom/i)?.[1] ||
      text.match(/(\d+)\s+bathrooms/i)?.[1];
    let guests =
      text.match(/(\d+)\s+guests?/i)?.[1] ||
      text.match(/Sleeps\s+(\d+)/i)?.[1] ||
      text.match(/Max\. people:\s*(\d+)/i)?.[1];

    const amenityEls = [
      ...document.querySelectorAll(
        '[data-testid="property-section--content"] li, .facilitiesChecklistSection li, .hp_desc_additional_facilities li, [data-testid="facility-group"] li'
      ),
    ];
    const amenities = amenityEls.map((el) => el.textContent?.trim()).filter(Boolean);

    // Parse from title e.g. "Modern & Bright 3BR Apt"
    if (!bedrooms) {
      const br = rawTitle.match(/(\d+)\s*BR\b/i);
      if (br) bedrooms = br[1];
    }

    return {
      rawTitle,
      fullDescription,
      shortDescription: fullDescription.slice(0, 220),
      address,
      images: [...new Set(images)],
      bedrooms: bedrooms ? Number(bedrooms) : 1,
      bathrooms: bathrooms ? Number(bathrooms) : 1,
      guests: guests ? Number(guests) : 2,
      amenities: [...new Set(amenities)].slice(0, 25),
    };
  });
}

async function downloadImages(slug, imageUrls) {
  const dir = path.join(IMAGES_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  const saved = [];
  let index = 1;

  for (const url of imageUrls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "CoreRentalsTLV-Import/1.0", Referer: "https://www.booking.com/" },
      });
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") || "image/jpeg";
      const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
      const filename = `${String(index).padStart(2, "0")}.${ext}`;
      fs.writeFileSync(path.join(dir, filename), Buffer.from(await res.arrayBuffer()));
      saved.push({ url: `/apartments/${slug}/${filename}`, alt: `Apartment photo ${index}` });
      index++;
      await randomDelay(400, 900);
    } catch {}
  }
  return saved;
}

export async function importBookingComUrl(page, url, { publish = true } = {}) {
  console.log(`\n📥 Importing (Booking.com): ${url}`);

  const scraped = await scrapeBookingCom(page, url);
  if (!scraped) throw new Error("Not a Sea N' Rent property or scrape failed");

  const name = stripSeanRentSuffix(scraped.rawTitle);
  const slug = slugify(name) || bookingHotelId(url);
  const address = cleanAddress(scraped.address || "");
  const fullDescription = cleanDescription(scraped.fullDescription);
  const combined = `${name} ${fullDescription} ${address}`;

  const images = await downloadImages(slug, scraped.images);
  if (!images.length) throw new Error("No images downloaded");

  const apartment = {
    id: bookingHotelId(url),
    slug,
    name,
    city: "Tel Aviv",
    neighborhood: guessNeighborhood(combined, "Tel Aviv"),
    ...(address ? { address } : {}),
    shortDescription: shortDescriptionFromFull(fullDescription),
    fullDescription,
    guests: scraped.guests,
    bedrooms: scraped.bedrooms,
    bathrooms: Math.ceil(scraped.bathrooms),
    amenities: cleanAmenitiesList(normalizeAmenities(scraped.amenities)),
    tags: guessTags(combined, scraped.amenities),
    images,
    internalSourceUrl: url.split("?")[0],
    source: "seanrent",
    featured: false,
    published: publish,
    needsReview: !publish,
    importedAt: new Date().toISOString(),
    discoveryChannel: "booking.com",
  };

  const catalog = loadCatalog();
  const action = upsertApartment(catalog, apartment);
  saveCatalog(catalog);
  console.log(`  ✓ ${action}: ${name} (${images.length} images, ${scraped.bedrooms}BR)`);
  return { apartment, action };
}

export async function importSeanRentFromUrl(page, url, options = {}) {
  if (/booking\.com\/hotel/i.test(url)) {
    return importBookingComUrl(page, url, options);
  }
  const { importSeanRentUrl } = await import("./seanrent-importer.mjs");
  return importSeanRentUrl(page, url, options);
}
