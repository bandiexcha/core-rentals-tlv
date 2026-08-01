/**
 * Canonical city / neighborhood normalization for catalog filters.
 * Strips postal codes, IDs, duplicates, and overseas junk from filter options.
 */

const POSTAL_OR_ID = /^\d+$/;

/** Approved Israeli cities that may appear in the City filter. */
export const CANONICAL_CITIES = [
  "Tel Aviv",
  "Herzliya",
  "Ramat Gan",
  "Givatayim",
  "Ramat Hasharon",
  "Bat Yam",
  "Netanya",
  "Haifa",
  "Nahariya",
  "Caesarea",
  "Eilat",
  "Jerusalem",
  "Eilon",
  "Shavei Tzion",
] as const;

export type CanonicalCity = (typeof CANONICAL_CITIES)[number];

const CITY_ALIASES: Record<string, CanonicalCity> = {
  "tel aviv": "Tel Aviv",
  "tel-aviv": "Tel Aviv",
  "tel aviv-yafo": "Tel Aviv",
  "tel aviv yafo": "Tel Aviv",
  "tel-aviv-yafo": "Tel Aviv",
  yafo: "Tel Aviv",
  jaffa: "Tel Aviv",
  herzliya: "Herzliya",
  herzliyya: "Herzliya",
  "ramat gan": "Ramat Gan",
  givatayim: "Givatayim",
  "ramat hasharon": "Ramat Hasharon",
  "bat yam": "Bat Yam",
  netanya: "Netanya",
  haifa: "Haifa",
  nahariya: "Nahariya",
  nahariyya: "Nahariya",
  caesarea: "Caesarea",
  eilat: "Eilat",
  jerusalem: "Jerusalem",
  eilon: "Eilon",
  "shavei tzion": "Shavei Tzion",
  "shavei tziyon": "Shavei Tzion",
};

/** Tel Aviv neighborhoods that are real areas — never cities or postal codes. */
export const TEL_AVIV_NEIGHBORHOODS = [
  "Gordon Beach",
  "Bograshov Beach",
  "Old North",
  "North Tel Aviv",
  "Neve Tzedek",
  "Florentin",
  "Kerem HaTeimanim",
  "Rothschild",
  "Sarona",
  "Dizengoff",
  "Lev Ha'ir",
  "Jaffa",
] as const;

const NEIGHBORHOOD_ALIASES: Record<string, string> = {
  "gordon beach": "Gordon Beach",
  "bograshov beach": "Bograshov Beach",
  "bugrashov beach": "Bograshov Beach",
  "old north": "Old North",
  "new north": "Old North",
  "north tel aviv": "North Tel Aviv",
  "neve tzedek": "Neve Tzedek",
  "neve tsedek": "Neve Tzedek",
  florentin: "Florentin",
  florentine: "Florentin",
  "kerem hateimanim": "Kerem HaTeimanim",
  rothschild: "Rothschild",
  sarona: "Sarona",
  dizengoff: "Dizengoff",
  "lev ha'ir": "Lev Ha'ir",
  "lev hair": "Lev Ha'ir",
  "city center": "Lev Ha'ir",
  jaffa: "Jaffa",
  yaffa: "Jaffa",
  "old jaffa": "Jaffa",
};

const OVERSEAS = new Set([
  "athens",
  "ko samui",
  "koh phangan",
  "koh pha ngan",
  "thailand",
  "greece",
]);

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isGarbageLocation(value?: string | null): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (POSTAL_OR_ID.test(trimmed)) return true;
  if (OVERSEAS.has(normalizeKey(trimmed))) return true;
  return false;
}

export function normalizeCity(raw?: string | null): CanonicalCity | "" {
  if (!raw || isGarbageLocation(raw)) return "";
  const key = normalizeKey(raw);
  if (OVERSEAS.has(key)) return "";
  const aliased = CITY_ALIASES[key];
  if (aliased) return aliased;
  // Accept already-canonical names
  const exact = CANONICAL_CITIES.find((c) => normalizeKey(c) === key);
  return exact ?? "";
}

export function normalizeNeighborhood(
  raw?: string | null,
  city?: string | null
): string {
  if (!raw || isGarbageLocation(raw)) return "";
  const key = normalizeKey(raw);

  // City names must never appear as neighborhoods
  if (CITY_ALIASES[key] || CANONICAL_CITIES.some((c) => normalizeKey(c) === key)) {
    // Exception: Jaffa is both a Tel Aviv neighborhood and sometimes mis-tagged as city
    if (key === "jaffa" || key === "yaffa" || key === "old jaffa") {
      return "Jaffa";
    }
    return "";
  }

  const aliased = NEIGHBORHOOD_ALIASES[key];
  if (aliased) return aliased;

  const resolvedCity = normalizeCity(city);
  if (resolvedCity === "Tel Aviv") {
    const tlv = TEL_AVIV_NEIGHBORHOODS.find((n) => normalizeKey(n) === key);
    return tlv ?? "";
  }

  // For other cities, only keep neighborhood if it's a real distinct area name
  // (not equal to the city, not numeric, not overseas)
  if (resolvedCity && key === normalizeKey(resolvedCity)) return "";
  if (POSTAL_OR_ID.test(raw.trim())) return "";
  if (OVERSEAS.has(key)) return "";

  // Outside Tel Aviv we rarely have true neighborhood taxonomy — omit dirty values
  return "";
}

export function normalizeApartmentLocation(input: {
  city?: string | null;
  neighborhood?: string | null;
  name?: string;
  address?: string;
}): { city: string; neighborhood: string } {
  let city = normalizeCity(input.city);

  // If city is missing but neighborhood is a known Tel Aviv area, assign Tel Aviv
  const nbhdGuess = normalizeNeighborhood(input.neighborhood, city || "Tel Aviv");
  if (!city && nbhdGuess && TEL_AVIV_NEIGHBORHOODS.includes(nbhdGuess as (typeof TEL_AVIV_NEIGHBORHOODS)[number])) {
    city = "Tel Aviv";
  }

  // If city is garbage but address/name mentions Tel Aviv
  if (!city) {
    const blob = `${input.name ?? ""} ${input.address ?? ""}`.toLowerCase();
    if (/tel[\s-]?aviv|yafo|jaffa/.test(blob)) city = "Tel Aviv";
  }

  const neighborhood = normalizeNeighborhood(input.neighborhood, city);
  return { city, neighborhood };
}

export interface LocationOption {
  value: string;
  label: string;
  count: number;
}

export function buildCityOptions(
  apartments: Array<{ city: string }>
): LocationOption[] {
  const counts = new Map<string, number>();
  for (const apt of apartments) {
    const city = normalizeCity(apt.city);
    if (!city) continue;
    counts.set(city, (counts.get(city) || 0) + 1);
  }
  return CANONICAL_CITIES.filter((c) => (counts.get(c) || 0) > 0)
    .map((c) => ({ value: c, label: `${c} (${counts.get(c)})`, count: counts.get(c)! }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function buildNeighborhoodOptions(
  apartments: Array<{ city: string; neighborhood: string }>,
  selectedCity: string
): LocationOption[] {
  const counts = new Map<string, number>();
  for (const apt of apartments) {
    const city = normalizeCity(apt.city);
    if (selectedCity && city !== selectedCity) continue;
    if (!selectedCity && !city) continue;
    const nbhd = normalizeNeighborhood(apt.neighborhood, city);
    if (!nbhd) continue;
    counts.set(nbhd, (counts.get(nbhd) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: `${value} (${count})`, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}
