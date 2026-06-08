/**
 * Incremental, resume-safe Sea N' Rent discovery store.
 *
 * Every candidate URL, property, and validation result is persisted immediately.
 * Safe to interrupt — progress resumes from the last saved item per channel.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const DISCOVERY_FILE = path.join(ROOT, "src/data/seanrent-discovery.json");
export const LEGACY_URLS_FILE = path.join(ROOT, "src/data/seanrent-urls.json");

const EMPTY = {
  version: 1,
  updatedAt: null,
  stats: {
    candidates: 0,
    validated: 0,
    rejected: 0,
    properties: 0,
  },
  progress: {},
  items: {},
};

function normalizeBookingUrl(url) {
  try {
    const u = new URL(url.split("#")[0].split("?")[0]);
    return u.origin + u.pathname.replace(/\.en-gb\.html$/i, ".html");
  } catch {
    return url.split("#")[0].split("?")[0];
  }
}

export function itemKey(type, id) {
  return `${type}:${id}`;
}

export function bookingKey(url) {
  return itemKey("booking.com", normalizeBookingUrl(url));
}

export function bookingsBoomKey(id) {
  return itemKey("bookingsboom", String(id));
}

export function revyoosKey(name) {
  return itemKey("revyoos", name.trim().toLowerCase());
}

export function airbnbKey(url) {
  return itemKey("airbnb", url.split("?")[0]);
}

export function loadDiscovery() {
  if (!fs.existsSync(DISCOVERY_FILE)) {
    return structuredClone(EMPTY);
  }
  try {
    const data = JSON.parse(fs.readFileSync(DISCOVERY_FILE, "utf8"));
    return {
      ...structuredClone(EMPTY),
      ...data,
      stats: { ...EMPTY.stats, ...(data.stats || {}) },
      progress: data.progress || {},
      items: data.items || {},
    };
  } catch {
    return structuredClone(EMPTY);
  }
}

function recomputeStats(data) {
  const items = Object.values(data.items);
  data.stats = {
    candidates: items.filter((i) => i.status === "candidate").length,
    validated: items.filter((i) => i.status === "validated").length,
    rejected: items.filter((i) => i.status === "rejected").length,
    properties: items.filter((i) =>
      ["bookingsboom", "bookingsboom-detail"].includes(i.type)
    ).length,
  };
}

export function saveDiscovery(data) {
  data.updatedAt = new Date().toISOString();
  recomputeStats(data);
  fs.writeFileSync(DISCOVERY_FILE, JSON.stringify(data, null, 2) + "\n");
  exportLegacyUrls(data);
}

export function exportLegacyUrls(data = loadDiscovery()) {
  const validated = Object.values(data.items)
    .filter((i) => i.type === "booking.com" && i.status === "validated" && i.url)
    .map((i) => normalizeBookingUrl(i.url));

  const bookingsBoom = Object.values(data.items)
    .filter((i) => i.type === "bookingsboom" && i.id)
    .map((i) => ({
      id: i.id,
      nickname: i.nickname,
      address: i.address,
      url: i.detailUrl || `https://seanrent.bookingsboom.com/listings/${i.id}`,
    }));

  const allBookingUrls = [...new Set(validated)].sort();

  const legacy = {
    discoveredAt: data.updatedAt,
    source: "incremental-discovery-store",
    count: allBookingUrls.length,
    stats: data.stats,
    progress: data.progress,
    urls: allBookingUrls,
    bookingCom: allBookingUrls,
    bookingsBoom: bookingsBoom.sort((a, b) => a.id - b.id),
    bookingSeanrent: [],
    airbnb: Object.values(data.items)
      .filter((i) => i.type === "airbnb" && i.url)
      .map((i) => i.url),
  };

  fs.writeFileSync(LEGACY_URLS_FILE, JSON.stringify(legacy, null, 2) + "\n");
  return legacy;
}

export function getItem(data, key) {
  return data.items[key] || null;
}

export function hasItem(data, key) {
  return Boolean(data.items[key]);
}

/** Save a discovered URL or property immediately (status: candidate). */
export function saveCandidate(data, entry) {
  const key = entry.key || itemKey(entry.type, entry.id || entry.url || entry.name);
  if (data.items[key]?.status === "validated") return data.items[key];

  const existing = data.items[key] || {};
  data.items[key] = {
    ...existing,
    ...entry,
    key,
    status: existing.status === "validated" ? "validated" : "candidate",
    discoveredAt: existing.discoveredAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveDiscovery(data);
  return data.items[key];
}

/** Save a validated Booking.com URL immediately. */
export function saveValidatedBooking(data, url, meta = {}) {
  const key = bookingKey(url);
  const normalized = normalizeBookingUrl(url);
  data.items[key] = {
    ...(data.items[key] || {}),
    key,
    type: "booking.com",
    url: normalized,
    status: "validated",
    validatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    discoveredAt: data.items[key]?.discoveredAt || new Date().toISOString(),
    ...meta,
  };
  saveDiscovery(data);
  return data.items[key];
}

/** Save a rejected URL immediately so we don't re-validate it. */
export function saveRejected(data, key, reason, meta = {}) {
  const existing = data.items[key] || {};
  data.items[key] = {
    ...existing,
    key,
    status: "rejected",
    rejectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rejectReason: reason,
    ...meta,
  };
  saveDiscovery(data);
  return data.items[key];
}

/** Save a Revyoos name → Booking.com match immediately. */
export function saveRevyoosMatch(data, propertyName, bookingUrl, meta = {}) {
  const key = revyoosKey(propertyName);
  saveCandidate(data, {
    key,
    type: "revyoos",
    name: propertyName,
    bookingUrl: bookingUrl ? normalizeBookingUrl(bookingUrl) : null,
    channel: "revyoos",
    ...meta,
  });
  if (bookingUrl) {
    saveCandidate(data, {
      key: bookingKey(bookingUrl),
      type: "booking.com",
      url: normalizeBookingUrl(bookingUrl),
      channel: "revyoos",
      revyoosName: propertyName,
      ...meta,
    });
  }
  return data.items[key];
}

/** Save a BookingsBoom listing summary immediately. */
export function saveBookingsBoomListing(data, listing, channel = "bookingsboom") {
  const key = bookingsBoomKey(listing.id);
  saveCandidate(data, {
    key,
    type: "bookingsboom",
    id: listing.id,
    nickname: listing.nickname,
    title: listing.title,
    address: listing.address,
    city: listing.city_name,
    accommodates: listing.accommodates,
    beds: listing.beds,
    baths: listing.baths,
    picture: listing.picture,
    detailUrl: `https://seanrent.bookingsboom.com/listings/${listing.id}`,
    channel,
    raw: {
      lat: listing.lat,
      lng: listing.lng,
      hotel_id: listing.hotel_id,
    },
  });
  return data.items[key];
}

/** Update per-channel resume cursor — saved immediately. */
export function saveProgress(data, channel, patch) {
  data.progress[channel] = {
    ...(data.progress[channel] || {}),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  saveDiscovery(data);
  return data.progress[channel];
}

export function getProgress(data, channel) {
  return data.progress[channel] || {};
}

export function isChannelComplete(data, channel) {
  return Boolean(data.progress[channel]?.complete);
}

export function migrateLegacyUrls() {
  const data = loadDiscovery();
  let added = 0;

  if (fs.existsSync(LEGACY_URLS_FILE)) {
    try {
      const legacy = JSON.parse(fs.readFileSync(LEGACY_URLS_FILE, "utf8"));
      for (const url of legacy.urls || []) {
        const key = bookingKey(url);
        if (!hasItem(data, key)) {
          saveValidatedBooking(data, url, { channel: "legacy-migration", migrated: true });
          added++;
        }
      }
    } catch {}
  }

  return { added, stats: data.stats };
}

export function printDiscoverySummary(data = loadDiscovery()) {
  const byType = {};
  const byChannel = {};
  for (const item of Object.values(data.items)) {
    byType[item.type] = (byType[item.type] || 0) + 1;
    if (item.channel) byChannel[item.channel] = (byChannel[item.channel] || 0) + 1;
  }

  console.log("\n📊 Discovery store summary");
  console.log(`   File: ${DISCOVERY_FILE}`);
  console.log(`   Updated: ${data.updatedAt}`);
  console.log(`   Validated Booking.com: ${data.stats.validated}`);
  console.log(`   Candidates: ${data.stats.candidates}`);
  console.log(`   Rejected: ${data.stats.rejected}`);
  console.log(`   BookingsBoom properties: ${data.stats.properties}`);
  console.log("   By type:", byType);
  console.log("   By channel:", byChannel);
  console.log("   Progress:", Object.keys(data.progress).map((c) => `${c}=${data.progress[c].complete ? "done" : "pending"}`).join(", ") || "(none)");
}

export { normalizeBookingUrl };
