/**
 * Probe BookingsBoom listings API pagination + detail endpoint
 */
import { chromium } from "playwright";

const BASE = "https://seanrent.bookingsboom.com";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
let sessionId = "";

page.on("response", async (res) => {
  const u = res.url();
  if (u.includes("booking_session_id=")) {
    const m = u.match(/booking_session_id=([^&]+)/);
    if (m) sessionId = m[1];
  }
});

await page.goto(`${BASE}/?lang=en`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(3000);
console.log("Session:", sessionId);

async function fetchListings(params = "") {
  const url = `${BASE}/api/booking/listings?language=en&booking_session_id=${sessionId}${params}`;
  return page.evaluate(async (u) => {
    const r = await fetch(u);
    return r.json();
  }, url);
}

// Try various listing endpoints
for (const params of [
  "",
  "&featured=true",
  "&featured=false",
  "&page=1",
  "&page=2",
  "&per_page=100",
  "&limit=100",
  "&offset=0",
  "&offset=100",
]) {
  try {
    const data = await fetchListings(params);
    const count = data.listings?.length ?? 0;
    const pagi = data.pagi_info;
    console.log(`params="${params}" → ${count} listings`, pagi ? JSON.stringify(pagi) : "");
    if (count > 0) {
      const sample = data.listings[0];
      console.log("  sample:", sample.id, sample.nickname, sample.address?.slice(0, 50));
    }
  } catch (e) {
    console.log(`params="${params}" → error`, e.message);
  }
}

// Full listings page
await page.goto(`${BASE}/listings?lang=en`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(5000);
for (let i = 0; i < 10; i++) {
  await page.evaluate(() => window.scrollBy(0, 2000));
  await page.waitForTimeout(1500);
}

const allData = await fetchListings("");
console.log("\nAfter /listings page, default fetch:", allData.listings?.length, allData.pagi_info);

// Try listing detail
const featured = await fetchListings("&featured=true");
const firstId = featured.listings?.[0]?.id;
if (firstId) {
  for (const detailPath of [
    `/api/booking/listings/${firstId}?language=en&booking_session_id=${sessionId}`,
    `/api/booking/listing/${firstId}?language=en&booking_session_id=${sessionId}`,
    `/api/booking/listings/${firstId}/details?language=en&booking_session_id=${sessionId}`,
  ]) {
    try {
      const detail = await page.evaluate(
        async (u) => {
          const r = await fetch(u);
          return { status: r.status, json: await r.json() };
        },
        `${BASE}${detailPath}`
      );
      console.log(`\nDetail ${detailPath.split("?")[0]}:`, detail.status, Object.keys(detail.json || {}));
      if (detail.json?.listing || detail.json?.pictures) {
        const l = detail.json.listing || detail.json;
        console.log("  keys:", Object.keys(l).slice(0, 20));
        console.log("  pictures:", l.pictures?.length || l.images?.length || "n/a");
        console.log("  description len:", (l.description || l.summary || "").length);
      }
    } catch (e) {
      console.log("Detail error:", e.message);
    }
  }
}

// Tel Aviv filter?
for (const params of [
  "&city=Tel+Aviv",
  "&location=Tel+Aviv",
  "&search=Tel+Aviv",
  "&q=Tel+Aviv",
  "&filter_city=tel-aviv",
]) {
  try {
    const data = await fetchListings(params);
    const tlv = (data.listings || []).filter((l) => /tel aviv|tel-aviv|yafo|jaffa/i.test(l.address || ""));
    console.log(`Filter ${params}: total ${data.listings?.length}, TLV ${tlv.length}`);
  } catch {}
}

await browser.close();
