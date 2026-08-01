#!/usr/bin/env node
import data from "../src/data/apartments.json" with { type: "json" };
import {
  buildCityOptions,
  buildNeighborhoodOptions,
  normalizeApartmentLocation,
  normalizeCity,
  normalizeNeighborhood,
} from "../src/lib/location.ts";
import { resolveNeighborhood } from "../src/lib/neighborhood.ts";

function matchesBedroomFilter(bedrooms, filter) {
  if (filter === "any") return true;
  return bedrooms === Number(filter);
}

const published = data.apartments.filter((a) => a.published);
const normalized = published.map((a) => {
  const resolved = resolveNeighborhood(a);
  const loc = normalizeApartmentLocation({ ...a, neighborhood: resolved });
  return {
    city: loc.city || "Tel Aviv",
    neighborhood: loc.neighborhood,
    bedrooms: a.bedrooms,
  };
});

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else console.log("OK:", msg);
}

const cities = buildCityOptions(normalized);
console.log("Cities:", cities.map((c) => c.label).join(" | "));
assert(!cities.some((c) => /^\d+$/.test(c.value)), "no numeric cities");
assert(!cities.some((c) => /athens|koh|samui/i.test(c.value)), "no overseas");
assert(cities.some((c) => c.value === "Tel Aviv"), "Tel Aviv present");

const tlv = buildNeighborhoodOptions(normalized, "Tel Aviv");
console.log("TLV nbhd:", tlv.map((n) => n.label).join(" | "));
assert(!tlv.some((n) => /^\d+$/.test(n.value)), "no numeric neighborhoods");
assert(
  !tlv.some((n) =>
    ["Tel Aviv", "Herzliya", "Netanya", "Eilat", "Athens", "Haifa"].includes(
      n.value
    )
  ),
  "no cities in neighborhood list"
);
assert(tlv.some((n) => n.value === "Neve Tzedek"), "Neve Tzedek present");

for (const beds of [1, 2, 3, 4, 5, 6]) {
  const filtered = normalized.filter((a) =>
    matchesBedroomFilter(a.bedrooms, String(beds))
  );
  assert(
    filtered.every((a) => a.bedrooms === beds),
    `exact ${beds}BR → ${filtered.length}`
  );
}

const combo = normalized.filter(
  (a) =>
    a.city === "Tel Aviv" &&
    a.neighborhood === "Neve Tzedek" &&
    a.bedrooms === 2
);
assert(
  combo.every(
    (a) =>
      a.city === "Tel Aviv" &&
      a.neighborhood === "Neve Tzedek" &&
      a.bedrooms === 2
  ),
  `TLV+NeveTzedek+2BR → ${combo.length}`
);

assert(normalizeCity("Tel Aviv-Yafo") === "Tel Aviv", "Tel Aviv-Yafo → Tel Aviv");
assert(normalizeCity("Nahariyya") === "Nahariya", "Nahariyya → Nahariya");
assert(normalizeCity("22311") === "", "postal rejected");
assert(normalizeNeighborhood("Tel Aviv", "Tel Aviv") === "", "city≠neighborhood");

process.exit(failed ? 1 : 0);
