#!/usr/bin/env node
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { KNOWN_BRANDING_HASHES } from "./lib/branding-image-detect.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BASE = "https://core-rentals-tlv.vercel.app";
const HG = ["HolyGuest", "Holy Guest", "holyguest"];
const SN = ["Sea N Rent", "Sea N' Rent", "SeaNRent", "Sea and Rent", "Seanrent", "seanrent"];

function pats(names) {
  return names.map((n) => ({ name: n, re: new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi") }));
}
function visibleText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}
function count(text, list) {
  const o = {};
  for (const p of list) {
    p.re.lastIndex = 0;
    o[p.name] = (text.match(p.re) || []).length;
  }
  return o;
}
function imagePaths(html, slug) {
  return [...new Set([...html.replace(/&amp;/g, "&").matchAll(new RegExp(`/apartments/${slug}/\\d+\\.(?:jpg|jpeg|png|webp)`, "gi"))].map((m) => m[0]))];
}
async function hashImg(p) {
  const res = await fetch(`${BASE}${p}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const hash = crypto.createHash("md5").update(buf).digest("hex");
  return { p, hash, branding: KNOWN_BRANDING_HASHES.has(hash) };
}
function pickRandom(arr, n, seed = 99) {
  const c = [...arr];
  let s = seed;
  const r = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const o = [];
  while (o.length < n && c.length) o.push(c.splice(Math.floor(r() * c.length), 1)[0]);
  return o;
}
async function pool(items, fn, n = 12) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const x = i++; out[x] = await fn(items[x], x); } }));
  return out;
}

async function audit(apt) {
  const html = await (await fetch(`${BASE}/apartments/${apt.slug}`)).text();
  const vis = visibleText(html);
  const hgVis = count(vis, pats(HG));
  const snVis = count(vis, pats(SN));
  const hgFull = count(html, pats(HG));
  const snFull = count(html, pats(SN));
  const visHits = [];
  const embedHits = [];
  for (const n of HG) {
    if (hgVis[n]) visHits.push({ pattern: n, count: hgVis[n] });
    if (hgFull[n] > hgVis[n]) embedHits.push({ pattern: n, full: hgFull[n], visible: hgVis[n] });
  }
  for (const n of SN) {
    if (snVis[n]) visHits.push({ pattern: n, count: snVis[n] });
    if (snFull[n] > snVis[n]) embedHits.push({ pattern: n, full: snFull[n], visible: snVis[n] });
  }
  const imgs = imagePaths(html, apt.slug);
  const checked = [];
  for (const p of imgs.slice(0, 10)) checked.push(await hashImg(p));
  const branding = checked.filter((c) => c.branding);
  return {
    slug: apt.slug,
    source: apt.source,
    name: apt.name,
    url: `${BASE}/apartments/${apt.slug}`,
    visibleHits: visHits,
    embeddedOnly: embedHits,
    imageCount: imgs.length,
    brandingImages: branding,
    pass: visHits.length === 0 && branding.length === 0,
  };
}

async function main() {
  const apts = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/apartments.json"), "utf8")).apartments;
  console.error(`Deep audit ${apts.length} production pages...`);
  const all = await pool(apts, audit, 12);
  const visLeaks = all.filter((a) => a.visibleHits.length);
  const imgLeaks = all.filter((a) => a.brandingImages.length);
  const embed = all.filter((a) => a.embeddedOnly.length);
  const aggHg = Object.fromEntries(HG.map((n) => [n, 0]));
  const aggSn = Object.fromEntries(SN.map((n) => [n, 0]));
  for (const a of all) {
    for (const h of a.visibleHits) {
      if (HG.includes(h.pattern)) aggHg[h.pattern] += h.count;
      if (SN.includes(h.pattern)) aggSn[h.pattern] += h.count;
    }
  }
  const sample = pickRandom(all, 20);
  console.log(JSON.stringify({
    productionUrl: BASE,
    pagesCrawled: apts.length,
    holyguestVisibleHitsTotal: aggHg,
    seanrentVisibleHitsTotal: aggSn,
    pagesWithVisibleBrandText: visLeaks,
    pagesWithBrandingImageHashes: imgLeaks,
    pagesWithEmbeddedHtmlOnly: embed.length,
    embeddedExamples: embed.slice(0, 5),
    randomSample20: sample,
    gatePass: visLeaks.length === 0 && imgLeaks.length === 0 && sample.every((s) => s.pass),
  }, null, 2));
}
main();
