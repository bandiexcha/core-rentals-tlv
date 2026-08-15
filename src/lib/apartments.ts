import catalogData from "@/data/apartments.json";
import {
  HOME_PAGE_APARTMENT_LIMIT,
  selectVisuallyDiverseApartments,
} from "@/lib/catalog-images";
import { sanitizeApartmentForPublic } from "@/lib/brand-sanitize";
import {
  isGarbageLocation,
  normalizeApartmentLocation,
} from "@/lib/location";
import { resolveMediaUrl } from "@/lib/media";
import { resolveNeighborhood } from "@/lib/neighborhood";
import type {
  Apartment,
  ApartmentCatalog,
  ApartmentFilters,
  ApartmentTag,
} from "@/types/apartment";

const catalog = catalogData as ApartmentCatalog;

function publicApartment(apartment: Apartment): Apartment {
  const sanitized = sanitizeApartmentForPublic(apartment);
  const resolvedNeighborhood = resolveNeighborhood(sanitized);
  const location = normalizeApartmentLocation({
    ...sanitized,
    neighborhood: resolvedNeighborhood,
  });
  // Prefer normalized city; never fall back to garbage/overseas or invent Tel Aviv.
  const city =
    location.city ||
    (!isGarbageLocation(sanitized.city) ? sanitized.city.trim() : "");
  return {
    ...sanitized,
    city,
    neighborhood: location.neighborhood,
    images: (sanitized.images ?? []).map((img) => ({
      ...img,
      url: resolveMediaUrl(img.url),
    })),
  };
}

export function getAllApartments(includeUnpublished = false): Apartment[] {
  return catalog.apartments
    .filter((a) => includeUnpublished || a.published)
    .map(publicApartment);
}

export function getApartmentBySlug(slug: string): Apartment | undefined {
  return getAllApartments().find((a) => a.slug === slug);
}

export function getFeaturedApartments(limit = 6): Apartment[] {
  return getAllApartments()
    .filter((a) => a.featured)
    .slice(0, limit);
}

/** Homepage showcase: keep all featured listings, then fill to 12 with diverse picks. */
export function getHomepageApartments(
  limit = HOME_PAGE_APARTMENT_LIMIT
): Apartment[] {
  return selectVisuallyDiverseApartments(getAllApartments(), limit);
}

export function getApartmentCount(): number {
  return getAllApartments().length;
}

export function getApartmentsForGuide(options: {
  neighborhoods?: string[];
  tag?: ApartmentTag;
  limit?: number;
}): Apartment[] {
  let results = getAllApartments();

  if (options.neighborhoods?.length) {
    const set = new Set(options.neighborhoods.map((n) => n.toLowerCase()));
    results = results.filter((a) => set.has(a.neighborhood.toLowerCase()));
  }

  if (options.tag) {
    results = results.filter((a) => a.tags.includes(options.tag!));
  }

  return results.slice(0, options.limit ?? 6);
}

export function getNeighborhoods(): string[] {
  const set = new Set(
    getAllApartments()
      .map((a) => a.neighborhood)
      .filter((n) => n && !/^\d+$/.test(n))
  );
  return [...set].sort();
}

export function getCities(): string[] {
  const set = new Set(
    getAllApartments()
      .map((a) => a.city)
      .filter((c) => c && !/^\d+$/.test(c))
  );
  return [...set].sort();
}

export function getAllAmenities(): string[] {
  const set = new Set(getAllApartments().flatMap((a) => a.amenities));
  return [...set].sort();
}

export function filterApartments(filters: ApartmentFilters): Apartment[] {
  const query = filters.q?.trim().toLowerCase();

  return getAllApartments().filter((apartment) => {
    if (query) {
      const haystack = [
        apartment.name,
        apartment.slug,
        apartment.id,
        apartment.neighborhood,
        apartment.city,
        apartment.address ?? "",
        apartment.shortDescription,
        apartment.fullDescription,
        ...apartment.amenities,
        ...apartment.tags,
      ]
        .join(" ")
        .toLowerCase();
      const tokens = query.split(/\s+/).filter(Boolean);
      if (!tokens.every((token) => haystack.includes(token))) return false;
    }
    if (filters.city && apartment.city !== filters.city) {
      return false;
    }
    if (
      filters.neighborhood &&
      apartment.neighborhood !== filters.neighborhood
    ) {
      return false;
    }
    if (filters.guests && apartment.guests < filters.guests) {
      return false;
    }
    // Exact bedroom match (not "N or more")
    if (
      typeof filters.bedrooms === "number" &&
      apartment.bedrooms !== filters.bedrooms
    ) {
      return false;
    }
    if (filters.bathrooms && apartment.bathrooms < filters.bathrooms) {
      return false;
    }
    if (filters.amenities?.length) {
      const hasAll = filters.amenities.every((amenity) =>
        apartment.amenities.includes(amenity)
      );
      if (!hasAll) return false;
    }
    if (filters.tags?.length) {
      const hasAllTags = filters.tags.every((tag) =>
        apartment.tags.includes(tag as ApartmentTag)
      );
      if (!hasAllTags) return false;
    }
    return true;
  });
}

export function parseSearchParams(
  params: Record<string, string | string[] | undefined>
): ApartmentFilters {
  const get = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value : undefined;
  };

  const amenities = get("amenities");
  const tags = get("tags");

  return {
    city: get("city") || undefined,
    neighborhood: get("neighborhood") || undefined,
    guests: get("guests") ? Number(get("guests")) : undefined,
    bedrooms: get("bedrooms") ? Number(get("bedrooms")) : undefined,
    bathrooms: get("bathrooms") ? Number(get("bathrooms")) : undefined,
    q: get("q") || undefined,
    amenities: amenities ? amenities.split(",").filter(Boolean) : undefined,
    tags: tags
      ? (tags.split(",").filter(Boolean) as ApartmentTag[])
      : undefined,
  };
}
