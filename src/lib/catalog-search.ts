import type { Apartment, ApartmentTag } from "@/types/apartment";
import {
  buildCityOptions,
  buildNeighborhoodOptions,
  normalizeCity,
  normalizeNeighborhood,
} from "@/lib/location";

/** Exact bedroom count — never "N or more". */
export type BedroomFilter = "any" | "1" | "2" | "3" | "4" | "5" | "6";

export type CatalogSort =
  | "recommended"
  | "newest"
  | "bedrooms-asc"
  | "bedrooms-desc"
  | "guests"
  | "name";

export type AmenityFacet =
  | "sea-view"
  | "parking"
  | "elevator"
  | "balcony"
  | "mamad"
  | "pet-friendly"
  | "accessibility"
  | "new-building"
  | "wifi";

export interface CatalogSearchState {
  q: string;
  city: string;
  neighborhood: string;
  street: string;
  bedrooms: BedroomFilter;
  guests: number | null;
  bathrooms: number | null;
  amenities: AmenityFacet[];
  tags: ApartmentTag[];
  sort: CatalogSort;
}

export const DEFAULT_CATALOG_SEARCH: CatalogSearchState = {
  q: "",
  city: "",
  neighborhood: "",
  street: "",
  bedrooms: "any",
  guests: null,
  bathrooms: null,
  amenities: [],
  tags: [],
  sort: "recommended",
};

export const BEDROOM_OPTIONS: { value: BedroomFilter; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "1", label: "1 Bedroom" },
  { value: "2", label: "2 Bedrooms" },
  { value: "3", label: "3 Bedrooms" },
  { value: "4", label: "4 Bedrooms" },
  { value: "5", label: "5 Bedrooms" },
  { value: "6", label: "6 Bedrooms" },
];

export const SORT_OPTIONS: { value: CatalogSort; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "newest", label: "Newest" },
  { value: "bedrooms-asc", label: "Bedrooms (Low → High)" },
  { value: "bedrooms-desc", label: "Bedrooms (High → Low)" },
  { value: "guests", label: "Guests" },
  { value: "name", label: "Alphabetical" },
];

export const AMENITY_FACETS: { value: AmenityFacet; label: string }[] = [
  { value: "sea-view", label: "Sea View" },
  { value: "parking", label: "Parking" },
  { value: "elevator", label: "Elevator" },
  { value: "balcony", label: "Balcony" },
  { value: "mamad", label: "Mamad" },
  { value: "pet-friendly", label: "Pet Friendly" },
  { value: "accessibility", label: "Accessibility" },
  { value: "wifi", label: "Wi-Fi" },
  { value: "new-building", label: "New Building" },
];

export const TRAVEL_STYLE_TAGS: { value: ApartmentTag; label: string }[] = [
  { value: "family", label: "Family" },
  { value: "corporate", label: "Business / Corporate" },
  { value: "luxury", label: "Luxury" },
  { value: "sea-view", label: "Beach" },
  { value: "city-view", label: "City View" },
];

function amenitiesBlob(apartment: Apartment): string {
  return apartment.amenities.join(" ").toLowerCase();
}

function copyBlob(apartment: Apartment): string {
  return `${apartment.name} ${apartment.shortDescription} ${apartment.fullDescription}`.toLowerCase();
}

const FACET_MATCHERS: Record<AmenityFacet, (apartment: Apartment) => boolean> = {
  "sea-view": (a) =>
    a.tags.includes("sea-view") ||
    /sea\s*view|beach\s*view|ocean\s*view/.test(amenitiesBlob(a)),
  parking: (a) => /parking/.test(amenitiesBlob(a)),
  elevator: (a) => /elevator|lift/.test(amenitiesBlob(a)),
  balcony: (a) => /balcony|terrace|patio/.test(amenitiesBlob(a)),
  mamad: (a) =>
    /mamad|miklat|safe\s*room|shelter|secured\s*room/.test(amenitiesBlob(a)) ||
    /mamad|miklat|safe\s*room|shelter/.test(copyBlob(a)),
  "pet-friendly": (a) => /pet/.test(amenitiesBlob(a)),
  accessibility: (a) =>
    /accessible|accessibility|wheelchair|step[\s-]?free/.test(amenitiesBlob(a)),
  wifi: (a) => /wi[\s-]?fi|wireless|internet/.test(amenitiesBlob(a)),
  "new-building": (a) =>
    /brand[\s-]?new|new\s+building|newly\s+built|new\s+construction/.test(
      copyBlob(a)
    ),
};

function amenityMatches(apartment: Apartment, facet: AmenityFacet): boolean {
  return FACET_MATCHERS[facet](apartment);
}

export function extractStreet(address?: string): string {
  if (!address) return "";
  const cleaned = address
    .replace(/,\s*Israel$/i, "")
    .replace(/,\s*Tel Aviv(?:-Yafo)?.*$/i, "")
    .trim();
  const match = cleaned.match(
    /^(.+?(?:Street|St\.?|Blvd\.?|Boulevard|Ave\.?|Avenue|Rd\.?|Road|Lane|Way)?)\s+\d+/i
  );
  if (match) return match[1].replace(/\s+/g, " ").trim();
  const first = cleaned.split(",")[0]?.trim() ?? "";
  return first.replace(/\s+\d+[A-Za-z]?$/, "").trim();
}

export function getCatalogStreets(apartments: Apartment[]): string[] {
  const set = new Set<string>();
  for (const apartment of apartments) {
    const street = extractStreet(apartment.address);
    if (street.length >= 3) set.add(street);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function matchesBedroomFilter(
  bedrooms: number,
  filter: BedroomFilter
): boolean {
  if (filter === "any") return true;
  return bedrooms === Number(filter);
}

export { buildCityOptions, buildNeighborhoodOptions };

function matchesQuery(apartment: Apartment, query: string): boolean {
  if (!query) return true;
  const haystack = [
    apartment.name,
    apartment.slug,
    apartment.id,
    apartment.neighborhood,
    apartment.city,
    apartment.address ?? "",
    extractStreet(apartment.address),
    apartment.shortDescription,
    ...apartment.amenities,
    ...apartment.tags,
  ]
    .join(" ")
    .toLowerCase();

  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.every((token) => haystack.includes(token));
}

export function filterCatalogApartments(
  apartments: Apartment[],
  state: CatalogSearchState
): Apartment[] {
  const query = state.q.trim();
  const street = state.street.trim().toLowerCase();

  return apartments.filter((apartment) => {
    if (!matchesQuery(apartment, query)) return false;

    const city = normalizeCity(apartment.city);
    const neighborhood = normalizeNeighborhood(
      apartment.neighborhood,
      city || apartment.city
    );

    if (state.city && city !== state.city) {
      return false;
    }

    if (state.neighborhood && neighborhood !== state.neighborhood) {
      return false;
    }

    if (street) {
      const aptStreet = extractStreet(apartment.address).toLowerCase();
      const address = (apartment.address ?? "").toLowerCase();
      if (!aptStreet.includes(street) && !address.includes(street)) {
        return false;
      }
    }

    if (!matchesBedroomFilter(apartment.bedrooms, state.bedrooms)) {
      return false;
    }

    if (state.guests != null && apartment.guests < state.guests) {
      return false;
    }

    if (state.bathrooms != null && apartment.bathrooms < state.bathrooms) {
      return false;
    }

    if (state.amenities.length) {
      const hasAll = state.amenities.every((facet) =>
        amenityMatches(apartment, facet)
      );
      if (!hasAll) return false;
    }

    if (state.tags.length) {
      const hasAllTags = state.tags.every((tag) => apartment.tags.includes(tag));
      if (!hasAllTags) return false;
    }

    return true;
  });
}

export function sortCatalogApartments(
  apartments: Apartment[],
  sort: CatalogSort,
  recommendedOrder?: Map<string, number>
): Apartment[] {
  const sorted = [...apartments];

  switch (sort) {
    case "newest":
      return sorted.sort((a, b) => {
        const aTime = a.importedAt ? Date.parse(a.importedAt) : 0;
        const bTime = b.importedAt ? Date.parse(b.importedAt) : 0;
        if (bTime !== aTime) return bTime - aTime;
        return a.name.localeCompare(b.name);
      });
    case "bedrooms-asc":
      return sorted.sort(
        (a, b) => a.bedrooms - b.bedrooms || a.name.localeCompare(b.name)
      );
    case "bedrooms-desc":
      return sorted.sort(
        (a, b) => b.bedrooms - a.bedrooms || a.name.localeCompare(b.name)
      );
    case "guests":
      return sorted.sort(
        (a, b) => b.guests - a.guests || a.name.localeCompare(b.name)
      );
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "recommended":
    default:
      if (recommendedOrder) {
        return sorted.sort((a, b) => {
          const aFeatured = a.featured ? 0 : 1;
          const bFeatured = b.featured ? 0 : 1;
          if (aFeatured !== bFeatured) return aFeatured - bFeatured;
          const aIdx = recommendedOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER;
          const bIdx = recommendedOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER;
          return aIdx - bIdx;
        });
      }
      return sorted.sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }
}

export function applyCatalogSearch(
  apartments: Apartment[],
  state: CatalogSearchState,
  recommendedOrder?: Map<string, number>
): Apartment[] {
  return sortCatalogApartments(
    filterCatalogApartments(apartments, state),
    state.sort,
    recommendedOrder
  );
}

export function hasActiveCatalogFilters(state: CatalogSearchState): boolean {
  return Boolean(
    state.q.trim() ||
      state.city ||
      state.neighborhood ||
      state.street ||
      state.bedrooms !== "any" ||
      state.guests != null ||
      state.bathrooms != null ||
      state.amenities.length ||
      state.tags.length
  );
}

export function catalogSearchFromParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>
): CatalogSearchState {
  const get = (key: string) => {
    if (params instanceof URLSearchParams) return params.get(key) ?? "";
    const value = params[key];
    return typeof value === "string" ? value : "";
  };

  const bedroomsRaw = get("bedrooms");
  const bedrooms: BedroomFilter = BEDROOM_OPTIONS.some(
    (o) => o.value === bedroomsRaw
  )
    ? (bedroomsRaw as BedroomFilter)
    : "any";

  const sortRaw = get("sort") as CatalogSort;
  const sort = SORT_OPTIONS.some((o) => o.value === sortRaw)
    ? sortRaw
    : "recommended";

  const amenities = get("amenities")
    .split(",")
    .filter((v): v is AmenityFacet =>
      AMENITY_FACETS.some((facet) => facet.value === v)
    );

  const tags = get("tags")
    .split(",")
    .filter(Boolean) as ApartmentTag[];

  const guests = get("guests") ? Number(get("guests")) : null;
  const bathrooms = get("bathrooms") ? Number(get("bathrooms")) : null;

  return {
    q: get("q"),
    city: get("city"),
    neighborhood: get("neighborhood"),
    street: get("street"),
    bedrooms,
    guests: Number.isFinite(guests) && guests! > 0 ? guests : null,
    bathrooms:
      Number.isFinite(bathrooms) && bathrooms! > 0 ? bathrooms : null,
    amenities,
    tags,
    sort,
  };
}

export function catalogSearchToParams(state: CatalogSearchState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set("q", state.q.trim());
  if (state.city) params.set("city", state.city);
  if (state.neighborhood) params.set("neighborhood", state.neighborhood);
  if (state.street) params.set("street", state.street);
  if (state.bedrooms !== "any") params.set("bedrooms", state.bedrooms);
  if (state.guests != null) params.set("guests", String(state.guests));
  if (state.bathrooms != null) params.set("bathrooms", String(state.bathrooms));
  if (state.amenities.length) params.set("amenities", state.amenities.join(","));
  if (state.tags.length) params.set("tags", state.tags.join(","));
  if (state.sort !== "recommended") params.set("sort", state.sort);
  return params;
}

export interface ActiveFilterChip {
  key: string;
  label: string;
  clear: Partial<CatalogSearchState>;
}

export function getActiveFilterChips(
  state: CatalogSearchState
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (state.q.trim()) {
    chips.push({
      key: "q",
      label: `“${state.q.trim()}”`,
      clear: { q: "" },
    });
  }
  if (state.city) {
    chips.push({
      key: "city",
      label: state.city,
      clear: { city: "", neighborhood: "" },
    });
  }
  if (state.neighborhood) {
    chips.push({
      key: "neighborhood",
      label: state.neighborhood,
      clear: { neighborhood: "" },
    });
  }
  if (state.street) {
    chips.push({
      key: "street",
      label: state.street,
      clear: { street: "" },
    });
  }
  if (state.bedrooms !== "any") {
    const label =
      BEDROOM_OPTIONS.find((o) => o.value === state.bedrooms)?.label ??
      state.bedrooms;
    chips.push({
      key: "bedrooms",
      label,
      clear: { bedrooms: "any" },
    });
  }
  if (state.guests != null) {
    chips.push({
      key: "guests",
      label: `${state.guests}+ guests`,
      clear: { guests: null },
    });
  }
  if (state.bathrooms != null) {
    chips.push({
      key: "bathrooms",
      label: `${state.bathrooms}+ baths`,
      clear: { bathrooms: null },
    });
  }
  for (const amenity of state.amenities) {
    const label =
      AMENITY_FACETS.find((f) => f.value === amenity)?.label ?? amenity;
    chips.push({
      key: `amenity:${amenity}`,
      label,
      clear: {
        amenities: state.amenities.filter((a) => a !== amenity),
      },
    });
  }
  for (const tag of state.tags) {
    const label =
      TRAVEL_STYLE_TAGS.find((t) => t.value === tag)?.label ?? tag;
    chips.push({
      key: `tag:${tag}`,
      label,
      clear: { tags: state.tags.filter((t) => t !== tag) },
    });
  }

  return chips;
}
