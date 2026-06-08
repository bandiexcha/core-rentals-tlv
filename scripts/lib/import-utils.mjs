export const DELAY_MS = 1500;
export const USER_AGENT =
  "CoreRentalsTLV-Import/1.0 (+private catalog; authorized partner)";

export const SOURCE_CONFIG = {
  holyguest: {
    source: "holyguest",
    catalogUrl: "https://holyguest.guestybookings.com/en/properties?minOccupancy=1&adults=1",
    siteUrl: "https://holyguest.com/",
    propertyUrl: (id) =>
      `https://holyguest.guestybookings.com/en/properties/${id}?minOccupancy=1&adults=1`,
    apiBase: "https://app.guesty.com/api/pm-websites-backend",
    referer: "https://holyguest.guestybookings.com/",
  },
  seanrent: {
    source: "seanrent",
    catalogUrl: "https://booking.seanrent.com/s",
    searchUrl:
      "https://booking.seanrent.com/en-US/s?city=tel-aviv&country=IL&currency=USD&region=%7B%22city%22%3A%22tel-aviv%22%2C%22country%22%3A%22IL%22%7D",
    siteUrl: "https://www.seanrent.com/",
    companyId: "619a7443-b289-4b3c-a37a-44985fe8f329",
    websiteId: "dac79519-a73b-4a6e-9e09-9be8257eeeba",
    referer: "https://booking.seanrent.com/",
  },
};

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomDelay(minMs, maxMs) {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return sleep(Math.round(ms));
}

export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function stripHolyGuestSuffix(name) {
  return name
    .replace(/\s*by\s+holy\s*guest\b.*$/i, "")
    .replace(/\s*\|\s*.+$/, "")
    .trim();
}

export function guessNeighborhood(text, city) {
  const neighborhoods = [
    { label: "Neve Tzedek", patterns: [/neve tzedek|neve tsedek/i] },
    { label: "Florentin", patterns: [/florentin|florentine|maon street/i] },
    { label: "Rothschild", patterns: [/rothschild|balfour|nahalat binyamin|allenby/i] },
    { label: "Gordon Beach", patterns: [/gordon|ruplin|edu?ard bernstein/i] },
    { label: "Bograshov Beach", patterns: [/bograshov|frishman|aharonovich|dizengoff/i] },
    { label: "Dizengoff", patterns: [/dizengoff/i] },
    { label: "Sarona", patterns: [/sarona/i] },
    { label: "Jaffa", patterns: [/jaffa|yaffa|yona hanavi|eilat street/i] },
    { label: "Kerem HaTeimanim", patterns: [/kerem|geula street|hateimanim|carmel market/i] },
    { label: "Old North", patterns: [/ben yehuda|trumpeldor|hayarkon|ness tsiyona/i] },
    { label: "North Tel Aviv", patterns: [/north tel aviv|ramat aviv/i] },
  ];

  for (const n of neighborhoods) {
    if (n.patterns.some((p) => p.test(text))) return n.label;
  }

  if (city?.includes("Tel Aviv")) return "Tel Aviv";
  return city || "Tel Aviv";
}

export function guessTags(text, amenities = []) {
  const lower = `${text} ${amenities.join(" ")}`.toLowerCase();
  const tags = [];
  if (/sea view|beach|ocean|mediterranean|beachfront|sea-view/.test(lower)) tags.push("sea-view");
  if (/city view|rothschild|florentin|neve|urban|skyline/.test(lower)) tags.push("city-view");
  if (/luxury|premium|penthouse|designer|boutique|high-end/.test(lower)) tags.push("luxury");
  if (/family|kids|spacious|group/.test(lower)) tags.push("family");
  if (/business|corporate|executive|workspace|work/.test(lower)) tags.push("corporate");
  return tags.length ? [...new Set(tags)] : ["city-view"];
}

export function normalizeAmenities(raw = []) {
  const map = {
    "wireless internet": "Wi-Fi",
    internet: "Wi-Fi",
    "air conditioning": "Air conditioning",
    kitchen: "Fully equipped kitchen",
    "laptop friendly workspace": "Workspace",
    elevator: "Elevator",
    "washing machine": "Washing machine",
    dryer: "Dryer",
    "patio or balcony": "Balcony",
    balcony: "Balcony",
    terrace: "Terrace",
    "sea view": "Sea view",
    "city view": "City view",
    parking: "Parking",
    pool: "Pool access",
    tv: "Smart TV",
    "cable tv": "Smart TV",
    "beach front": "Beach access",
    "near ocean": "Beach access",
  };

  const normalized = raw.map((a) => {
    const key = a.toLowerCase();
    if (map[key]) return map[key];
    if (/wifi|wi-fi/i.test(a)) return "Wi-Fi";
    if (/kitchen/i.test(a)) return "Fully equipped kitchen";
    return a;
  });

  return [...new Set(normalized)].slice(0, 20);
}

export function buildDescription(publicDescription = {}) {
  const parts = [
    publicDescription.summary,
    publicDescription.space,
    publicDescription.neighborhood,
  ].filter(Boolean);
  return parts.join("\n\n").trim();
}

export function isTelAvivListing(item) {
  const city = item.address?.city || "";
  const full = item.address?.full || "";
  const text = `${item.title || ""} ${full} ${city}`;
  if (/tel aviv|tel-?aviv|yafo|jaffa/i.test(text)) return true;
  if (/courchevel|france|cyprus|greece|miami|new york/i.test(text)) return false;
  return false;
}
