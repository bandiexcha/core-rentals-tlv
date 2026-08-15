#!/usr/bin/env node
/**
 * Post-deploy verification: every published apartment page embeds Blob URLs
 * and every gallery image returns HTTP 200.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(
  fs.readFileSync(path.join(ROOT, "src/data/apartments.json"), "utf8")
);
const BASE =
  process.env.PRODUCTION_URL || "https://core-rentals-tlv.vercel.app";

const apartments = (catalog.apartments || []).filter((a) => a.published);
let pagesOk = 0;
let pagesFail = 0;
let brokenImages = 0;
let imagesChecked = 0;
const pageFailures = [];
const imageFailures = [];

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const idx = i++;
        await fn(items[idx], idx);
      }
    })
  );
}

await pool(apartments, 10, async (apt) => {
  const pageUrl = `${BASE}/apartments/${apt.slug}`;
  try {
    const r = await fetch(pageUrl);
    if (!r.ok) throw new Error(`page HTTP ${r.status}`);
    const html = await r.text();
    const imgs = apt.images || [];
    let missing = 0;
    let nonBlob = 0;
    for (const img of imgs) {
      const u = img.url || "";
      if (!u.includes("blob.vercel-storage.com")) nonBlob += 1;
      if (!html.includes(u)) missing += 1;
    }
    if (nonBlob > 0 || missing > 0) {
      pagesFail += 1;
      if (pageFailures.length < 25) {
        pageFailures.push({
          slug: apt.slug,
          missing,
          nonBlob,
          total: imgs.length,
        });
      }
    } else {
      pagesOk += 1;
    }

    // Check first + last image (full gallery HEAD would be huge; we already HEAD'd all blobs)
    // Full gallery: verify every image URL still 200 for this property
    for (const img of imgs) {
      imagesChecked += 1;
      try {
        const ir = await fetch(img.url, { method: "HEAD" });
        let ok = ir.ok;
        if (!ok) {
          const g = await fetch(img.url);
          ok = g.ok;
        }
        if (!ok) {
          brokenImages += 1;
          if (imageFailures.length < 30)
            imageFailures.push({ slug: apt.slug, url: img.url });
        }
      } catch {
        brokenImages += 1;
        if (imageFailures.length < 30)
          imageFailures.push({ slug: apt.slug, url: img.url, error: "fetch failed" });
      }
    }
  } catch (e) {
    pagesFail += 1;
    if (pageFailures.length < 25)
      pageFailures.push({ slug: apt.slug, error: String(e.message || e) });
  }
});

const report = {
  productionUrl: BASE,
  propertiesTotal: apartments.length,
  propertiesVisuallyVerified: pagesOk,
  propertiesFailed: pagesFail,
  imagesChecked,
  brokenImages,
  pageFailures,
  imageFailures: imageFailures.slice(0, 20),
};
fs.writeFileSync(
  path.join(ROOT, "docs/media-production-verify.json"),
  JSON.stringify(report, null, 2)
);
console.log(JSON.stringify(report, null, 2));
if (pagesFail > 0 || brokenImages > 0) process.exit(1);
