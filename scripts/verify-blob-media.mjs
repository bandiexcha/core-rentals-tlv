#!/usr/bin/env node
/**
 * Verify every catalog image URL is on Blob and returns HTTP 200.
 * Optionally HEAD-check every URL (--head) and every published property page (--pages).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(
  fs.readFileSync(path.join(ROOT, "src/data/apartments.json"), "utf8")
);
const map = JSON.parse(
  fs.readFileSync(path.join(ROOT, "docs/media-url-mapping.json"), "utf8")
);
const doHead = process.argv.includes("--head");
const doPages = process.argv.includes("--pages");
const BASE =
  process.env.PRODUCTION_URL || "https://core-rentals-tlv.vercel.app";

const apartments = catalog.apartments || [];
let blob = 0;
let nonBlob = 0;
const nonBlobSamples = [];
const urls = [];

for (const apt of apartments) {
  for (const img of apt.images || []) {
    const u = img.url || "";
    if (u.includes("blob.vercel-storage.com")) {
      blob += 1;
      urls.push({ slug: apt.slug, url: u, published: apt.published });
    } else {
      nonBlob += 1;
      if (nonBlobSamples.length < 10) nonBlobSamples.push({ slug: apt.slug, url: u });
    }
  }
}

const mappedCount = Object.keys(map.paths || {}).length;
console.log(
  JSON.stringify(
    {
      apartments: apartments.length,
      published: apartments.filter((a) => a.published).length,
      blobUrls: blob,
      nonBlobUrls: nonBlob,
      mappedPaths: mappedCount,
      nonBlobSamples,
    },
    null,
    2
  )
);

if (nonBlob > 0) process.exit(2);

async function pool(items, n, fn) {
  let i = 0;
  const workers = Array.from({ length: n }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

if (doHead) {
  let ok = 0;
  let fail = 0;
  const failures = [];
  await pool(urls, 20, async (item) => {
    try {
      const r = await fetch(item.url, { method: "HEAD" });
      if (!r.ok) {
        // some CDNs reject HEAD
        const g = await fetch(item.url, { method: "GET" });
        if (!g.ok) throw new Error(`HTTP ${g.status}`);
        // consume minimally
        await g.arrayBuffer();
      }
      ok += 1;
      if (ok % 200 === 0) console.log(`head ok=${ok} fail=${fail}`);
    } catch (e) {
      fail += 1;
      if (failures.length < 30)
        failures.push({ ...item, error: String(e.message || e) });
    }
  });
  console.log(JSON.stringify({ headOk: ok, headFail: fail, failures }, null, 2));
  if (fail > 0) process.exit(1);
}

if (doPages) {
  const published = apartments.filter((a) => a.published);
  let ok = 0;
  let fail = 0;
  const failures = [];
  await pool(published, 8, async (apt) => {
    const pageUrl = `${BASE}/apartments/${apt.slug}`;
    try {
      const r = await fetch(pageUrl);
      if (!r.ok) throw new Error(`page HTTP ${r.status}`);
      const html = await r.text();
      // After deploy, pages should embed blob URLs. Before deploy they may still be relative.
      const imgs = apt.images || [];
      let missing = 0;
      for (const img of imgs) {
        const u = img.url;
        // Check pathname fragment appears OR full blob url
        const pathPart = new URL(u).pathname;
        if (!html.includes(u) && !html.includes(pathPart)) missing += 1;
      }
      if (missing > 0) {
        // Before deploy this is expected — report separately
        fail += 1;
        if (failures.length < 20)
          failures.push({ slug: apt.slug, missingImageRefs: missing, total: imgs.length });
      } else {
        ok += 1;
      }
    } catch (e) {
      fail += 1;
      if (failures.length < 20)
        failures.push({ slug: apt.slug, error: String(e.message || e) });
    }
  });
  console.log(
    JSON.stringify(
      { pagesOk: ok, pagesFail: fail, published: published.length, failures },
      null,
      2
    )
  );
}
