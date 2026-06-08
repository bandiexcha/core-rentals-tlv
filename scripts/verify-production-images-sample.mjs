#!/usr/bin/env node
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { KNOWN_BRANDING_HASHES } from "./lib/branding-image-detect.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.PRODUCTION_URL || "https://core-rentals-tlv.vercel.app";

function pickRandom(arr, n, seed = 20260608) {
  const copy = [...arr];
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const out = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  return out;
}

async function checkPage(apt) {
  const pageUrl = `${BASE}/apartments/${apt.slug}`;
  const res = await fetch(pageUrl);
  if (!res.ok) {
    return { slug: apt.slug, source: apt.source, url: pageUrl, pass: false, error: `HTTP ${res.status}` };
  }
  const html = await res.text();
  const re = new RegExp(`/apartments/${apt.slug}/\\d+\\.(?:jpg|jpeg|png|webp)`, "gi");
  const imgs = [...new Set([...html.matchAll(re)].map((m) => m[0]))];
  let real = 0;
  let brand = 0;
  let tiny = 0;
  let broken = 0;
  const brandingPaths = [];
  for (const p of imgs.slice(0, 12)) {
    const imgRes = await fetch(`${BASE}${p}`);
    if (!imgRes.ok) {
      broken++;
      continue;
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const hash = crypto.createHash("md5").update(buf).digest("hex");
    if (KNOWN_BRANDING_HASHES.has(hash)) {
      brand++;
      brandingPaths.push(p);
    } else if (buf.length < 15000) tiny++;
    else real++;
  }
  return {
    slug: apt.slug,
    source: apt.source,
    name: apt.name,
    url: pageUrl,
    imagesOnPage: imgs.length,
    checked: Math.min(12, imgs.length),
    real,
    brand,
    tiny,
    broken,
    brandingPaths,
    pass: real >= 3 && brand === 0 && broken === 0,
  };
}

async function main() {
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/apartments.json"), "utf8"));
  const published = catalog.apartments.filter((a) => a.published);
  const sample = pickRandom(published, 20);
  const results = [];
  for (const apt of sample) results.push(await checkPage(apt));
  const pass = results.filter((r) => r.pass).length;
  console.log(
    JSON.stringify(
      {
        productionUrl: BASE,
        sampleSize: 20,
        passed: pass,
        failed: 20 - pass,
        results,
      },
      null,
      2
    )
  );
}

main();
