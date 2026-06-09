import type { Apartment, TelAvivNeighborhood } from "@/types/apartment";

interface NeighborhoodRule {
  label: TelAvivNeighborhood;
  patterns: RegExp[];
}

/**
 * Street and area hints ordered most-specific first.
 * Trumpeldor and the central beachfront belong to Gordon Beach / Lev Ha'ir — not Old North.
 */
const NEIGHBORHOOD_RULES: NeighborhoodRule[] = [
  { label: "Neve Tzedek", patterns: [/neve tzedek|neve tsedek/i] },
  {
    label: "Florentin",
    patterns: [/florentin|florentine|maon street|elifelet|abarbananel/i],
  },
  {
    label: "Rothschild",
    patterns: [/rothschild|nahalat binyamin|balfour|montefiore|sheinkin|shenkin/i],
  },
  { label: "Jaffa", patterns: [/\bjaffa\b|\byaffa\b|old jaffa/i] },
  { label: "Sarona", patterns: [/sarona|haarba|ha'arba/i] },
  {
    label: "Kerem HaTeimanim",
    patterns: [
      /kerem hateimanim/i,
      /yona hanavi/i,
      /yemenite quarter/i,
      /\bgeula(?:\s+street)?\b/i,
      /hakerem/i,
      /in (?:the )?kerem/i,
    ],
  },
  {
    label: "Gordon Beach",
    patterns: [
      /trumpeldor/i,
      /gordon(?:\s+beach|\s+street|\s+area)?/i,
      /ruppin|ruplin/i,
      /herbert samuel/i,
      /tayelet|promenade/i,
      /sea hotel/i,
      /renoma/i,
      /edu?ard bernstein/i,
      /jabotinsky/i,
      /hayarkon/i,
      /beachfront avenue/i,
      /gazoz beach/i,
      /trumpeldor beach/i,
    ],
  },
  {
    label: "Bograshov Beach",
    patterns: [/bograshov|frishman|aharonovich|pinsker/i],
  },
  { label: "Dizengoff", patterns: [/dizengoff|mapu/i] },
  {
    label: "Lev Ha'ir",
    patterns: [
      /lev hair|lev ha'ir|city center|central tel aviv|yeho'?ash|king george|allenby/i,
    ],
  },
  {
    label: "Old North",
    patterns: [/ben yehuda|ness tsiyona|ness tsiona|ben gurion|basel|nordau/i],
  },
  {
    label: "North Tel Aviv",
    patterns: [/north tel aviv|ramat aviv|bavli|tzameret/i],
  },
];

function matchNeighborhood(text: string): TelAvivNeighborhood | null {
  for (const rule of NEIGHBORHOOD_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return rule.label;
    }
  }
  return null;
}

export function resolveNeighborhood(
  apartment: Pick<
    Apartment,
    "name" | "address" | "neighborhood" | "shortDescription" | "fullDescription" | "city"
  >
): TelAvivNeighborhood | string {
  const primaryText = [apartment.name, apartment.address].filter(Boolean).join(" ");
  const primaryMatch = primaryText ? matchNeighborhood(primaryText) : null;
  if (primaryMatch) return primaryMatch;

  const fullText = [
    apartment.name,
    apartment.address,
    apartment.shortDescription,
    apartment.fullDescription,
  ]
    .filter(Boolean)
    .join(" ");

  const fullMatch = matchNeighborhood(fullText);
  if (fullMatch) return fullMatch;

  if (/tel aviv/i.test(apartment.city ?? "")) return "Tel Aviv";
  return apartment.neighborhood || apartment.city || "Tel Aviv";
}
