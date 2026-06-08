import catalogData from "@/data/apartments.json";
import { sanitizeApartmentForPublic } from "@/lib/brand-sanitize";
import type {
  Apartment,
  ApartmentCatalog,
  ApartmentFilters,
  ApartmentTag,
} from "@/types/apartment";

const catalog = catalogData as ApartmentCatalog;

function publicApartment(apartment: Apartment): Apartment {
  return sanitizeApartmentForPublic(apartment);
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
  const set = new Set(getAllApartments().map((a) => a.neighborhood));
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
        apartment.neighborhood,
        apartment.city,
        apartment.shortDescription,
        apartment.fullDescription,
        ...apartment.amenities,
        ...apartment.tags,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
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
    if (filters.bedrooms && apartment.bedrooms < filters.bedrooms) {
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
      const hasAny = filters.tags.some((tag) =>
        apartment.tags.includes(tag as ApartmentTag)
      );
      if (!hasAny) return false;
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
