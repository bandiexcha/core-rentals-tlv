#!/usr/bin/env node
/**
 * Crawl production apartment pages and search live HTML for brand leaks.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BASE = process.env.PRODUCTION_URL || "https://core-rentals-tlv.vercel.app";
const CONCURRENCY = 12;

const HG_PATTERNS = [
  { name: "HolyGuest", re: /HolyGuest/g },
  { name: "Holy Guest", re: /Holy Guest/g },
  { name: "holyguest", re: /holyguest/g },
];

const SN_PATTERNS = [
  { name: "Sea N Rent", re: /Sea N Rent/g },
  { name: "Sea N' Rent", re: /Sea N['\u2019] Rent/g },
  { name: "SeaNRent", re: /SeaNRent/g },
  { name: "Sea and Rent", re: /Sea and Rent/g },
  { name: "Seanrent", re: /Seanrent/g },
  { name: "seanrent", re: /seanrent/g },
];

const BRAND_IMG_RE =
  /(?:holyguest|seanrent|guesty|welcome[\-_]?card|safe[\-_]?room|your[\-_]?home|powered[\-_]?by|marketing|promo|review[\-_]?card|booking\.com\/logo|airbnb)/i;

function loadSlugs() {
  const catalog = JSON.parse(
    fs.readFileSync(path.join(ROOT, "src/data/apartments.json"), "utf8")
  );
  return catalog.apartments.map((a) => ({
    slug: a.slug,
    source: a.source,
    name: a.name,
  }));
}

function pickRandom(arr, n, seed = 20260608) {
  const copy = [...arr];
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const out = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  }
  return out;
}

function extractVisibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractImgSrcs(html) {
  const srcs = [];
  const re = /(?:src|href)=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
  let m;
  while ((m = re.exec(html))) srcs.push(m[1]);
  return [...new Set(srcs)];
}

function scanPage(html, slug) {
  const text = extractVisibleText(html);
  const raw = html;
  const hits = [];
  for (const p of [...HG_PATTERNS, ...SN_PATTERNS]) {
    const inText = text.match(p.re) || [];
    const inRaw = raw.match(p.re) || [];
    const count = Math.max(inText.length, inRaw.length);
    if (count) {
      hits.push({
        pattern: p.name,
        count,
        inVisibleText: inText.length,
        inRawHtml: inRaw.length,
        sample: (inText[0] || inRaw[0] || "").slice(0, 80),
      });
    }
  }
  const imgSrcs = extractImgSrcs(html);
  const brandImgs = imgSrcs.filter((s) => BRAND_IMG_RE.test(s));
  return { slug, hits, brandImgs, imgCount: imgSrcs.length };
}

async function fetchPage(apt) {
  const slug = typeof apt === "string" ? apt : apt.slug;
  const url = `${BASE}/apartments/${slug}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "CoreRentalsAudit/1.0" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  return scanPage(html, slug);
}

async function pool(items, fn, limit) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try {
        results[idx] = { ok: true, ...(await fn(items[idx])) };
      } catch (e) {
        results[idx] = { ok: false, slug: items[idx].slug, error: String(e.message || e) };
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

async function main() {
  const apartments = loadSlugs();
  console.error(`Crawling ${apartments.length} pages at ${BASE} ...`);
  const t0 = Date.now();
  const results = await pool(apartments, fetchPage, CONCURRENCY);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const failed = results.filter((r) => !r.ok);
  const withHits = results.filter((r) => r.ok && r.hits?.length);
  const withBrandImgs = results.filter((r) => r.ok && r.brandImgs?.length);

  const byPattern = {};
  for (const r of withHits) {
    for (const h of r.hits) {
      byPattern[h.pattern] = (byPattern[h.pattern] || 0) + h.count;
    }
  }

  const samplePool = pickRandom(results.filter((r) => r.ok), 20);
  const sample = samplePool.map((r) => {
    const apt = apartments.find((a) => a.slug === r.slug);
    return {
      slug: r.slug,
      source: apt?.source,
      name: apt?.name,
      url: `${BASE}/apartments/${r.slug}`,
      brandTextHits: r.hits?.length || 0,
      patterns: (r.hits || []).map((h) => h.pattern),
      imageCount: r.imgCount,
      suspiciousImages: r.brandImgs || [],
      status: (r.hits?.length || 0) === 0 && (r.brandImgs?.length || 0) === 0 ? "PASS" : "FAIL",
    };
  });

  const report = {
    productionUrl: BASE,
    pagesCrawled: apartments.length,
    pagesFailed: failed.length,
    elapsedSeconds: Number(elapsed),
    brandTextLeaks: withHits.length,
    brandTextLeakDetails: withHits.slice(0, 30).map((r) => ({
      slug: r.slug,
      url: `${BASE}/apartments/${r.slug}`,
      hits: r.hits,
    })),
    hitsByPattern: byPattern,
    suspiciousImagePages: withBrandImgs.length,
    suspiciousImageDetails: withBrandImgs.slice(0, 20).map((r) => ({
      slug: r.slug,
      brandImgs: r.brandImgs,
    })),
    randomSample20: sample,
    randomSamplePass: sample.every((s) => s.status === "PASS"),
    gatePass:
      failed.length === 0 &&
      withHits.length === 0 &&
      withBrandImgs.length === 0 &&
      sample.every((s) => s.status === "PASS"),
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
