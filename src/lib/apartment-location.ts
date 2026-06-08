import type { Apartment } from "@/types/apartment";

const BRAND_RE =
  /(?:Holy\s*Guest|HolyGuest|Sea\s*N[\u2019']?\s*Rent|Sea\s*and\s*Rent|Seanrent|Sean\s*Rent)/gi;

const TEL_AVIV_NEIGHBORHOODS =
  /tel aviv|yafo|jaffa|florentin|neve tzedek|rothschild|gordon|bograshov|dizengoff|sarona|kerem|old north|north tel aviv|lev ha'ir|kerem hateimanim|ben yehuda|trumpeldor|hayarkon|frishman|pinsker|mapu|shenkin|carmel market/i;

const STREET_HINT_RE =
  /\d+|(?:\b(?:st\.?|street|road|rd\.?|avenue|ave\.?|boulevard|blvd\.?|promenade|tower|apt\.?|apartment|unit|floor|building)\b)/i;

export interface ApartmentMapLocation {
  /** Human-readable location line shown above the map */
  displayLabel: string;
  /** Query string for Google Maps (embed + external link) */
  mapQuery: string;
  /** Whether the map uses a street-level address vs neighborhood area */
  isExactAddress: boolean;
}

export function sanitizeLocationText(text: string): string {
  return text
    .replace(BRAND_RE, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[,.\s]+|[,.\s]+$/g, "")
    .trim();
}

export function normalizeCity(city: string, neighborhood: string): string {
  const trimmed = city?.trim() ?? "";
  if (!trimmed || /^\d{4,7}$/.test(trimmed)) {
    if (TEL_AVIV_NEIGHBORHOODS.test(neighborhood)) return "Tel Aviv-Yafo";
    return neighborhood || "Israel";
  }
  if (/^tel aviv/i.test(trimmed)) return "Tel Aviv-Yafo";
  return trimmed;
}

export function hasExactAddress(address?: string): boolean {
  const cleaned = sanitizeLocationText(address ?? "");
  if (cleaned.length < 8) return false;
  return STREET_HINT_RE.test(cleaned);
}

export function getApartmentMapLocation(
  apartment: Pick<Apartment, "address" | "neighborhood" | "city">
): ApartmentMapLocation {
  const city = normalizeCity(apartment.city, apartment.neighborhood);
  const address = sanitizeLocationText(apartment.address ?? "");

  if (hasExactAddress(address)) {
    const includesIsrael = /israel/i.test(address);
    const includesCity = new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(
      address
    );
    const parts = [address];
    if (!includesCity && city !== "Israel") parts.push(city);
    if (!includesIsrael) parts.push("Israel");

    const mapQuery = parts.join(", ");
    return {
      displayLabel: mapQuery,
      mapQuery,
      isExactAddress: true,
    };
  }

  const mapQuery = `${apartment.neighborhood}, ${city}, Israel`;
  return {
    displayLabel: mapQuery,
    mapQuery,
    isExactAddress: false,
  };
}

export function googleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function googleMapsEmbedUrl(query: string): string {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY;
  if (apiKey) {
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&zoom=15`;
  }
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&hl=en&output=embed`;
}
