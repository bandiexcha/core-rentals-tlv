#!/usr/bin/env node
/**
 * Migrate apartment images from live production CDN → Vercel Blob.
 * Does NOT use Git LFS.
 *
 * Reads BLOB_READ_WRITE_TOKEN from env or .env.local
 * Optional: PRODUCTION_URL (default https://core-rentals-tlv.vercel.app)
 *           --concurrency=8 --limit=N --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "src/data/apartments.json");
const MAP_PATH = path.join(ROOT, "docs/media-url-mapping.json");
const PROGRESS_PATH = path.join(ROOT, "docs/media-migration-progress.json");

function loadEnvLocal() {
  const p = path.join(ROOT, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}
loadEnvLocal();

const BASE =
  process.env.PRODUCTION_URL || "https://core-rentals-tlv.vercel.app";
const dry = process.argv.includes("--dry-run");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
const concArg = process.argv.find((a) => a.startsWith("--concurrency="));
const concurrency = concArg ? Number(concArg.split("=")[1]) : 8;

if (!process.env.BLOB_READ_WRITE_TOKEN && !dry) {
  console.error("Set BLOB_READ_WRITE_TOKEN (or create .env.local via vercel blob).");
  process.exit(2);
}

const catalog = JSON.parse(fs.readFileSync(DATA, "utf8"));
const apartments = catalog.apartments || catalog;

/** @type {Map<string, string>} pathname without leading slash → blob url */
const mapping = fs.existsSync(MAP_PATH)
  ? new Map(Object.entries(JSON.parse(fs.readFileSync(MAP_PATH, "utf8")).paths || {}))
  : new Map();

const paths = new Set();
for (const apt of apartments) {
  for (const img of apt.images || []) {
    const url = typeof img === "string" ? img : img.url;
    if (!url || typeof url !== "string") continue;
    if (!url.includes("/apartments/")) continue;
    const rel = url
      .replace(/^https?:\/\/[^/]+/, "")
      .replace(/^\//, "")
      .split("?")[0];
    if (rel.startsWith("apartments/")) paths.add(rel);
  }
}

const queue = [...paths].filter((p) => !mapping.has(p)).slice(0, limit);
console.log(
  `Unique apartment paths: ${paths.size}; already mapped: ${mapping.size}; to upload: ${queue.length}; concurrency=${concurrency}`
);

async function putBlob(pathname, bytes, contentType) {
  const res = await fetch(`https://blob.vercel-storage.com/${pathname}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      "x-api-version": "7",
      "x-content-type": contentType,
      "x-add-random-suffix": "0",
      "x-allow-overwrite": "true",
    },
    body: bytes,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Blob put ${pathname} → ${res.status}: ${t}`);
  }
  return res.json();
}

function saveProgress() {
  const obj = {
    updatedAt: new Date().toISOString(),
    productionSource: BASE,
    blobStore: "core-rentals-media-cdn",
    paths: Object.fromEntries(mapping),
    count: mapping.size,
  };
  fs.mkdirSync(path.dirname(MAP_PATH), { recursive: true });
  fs.writeFileSync(MAP_PATH, JSON.stringify(obj, null, 2));
  fs.writeFileSync(
    PROGRESS_PATH,
    JSON.stringify(
      {
        updatedAt: obj.updatedAt,
        mapped: mapping.size,
        remaining: paths.size - mapping.size,
        totalUnique: paths.size,
      },
      null,
      2
    )
  );
}

let ok = 0;
let fail = 0;
const failures = [];

async function worker(items) {
  for (const rel of items) {
    if (dry) {
      console.log(`[dry-run] ${BASE}/${rel}`);
      continue;
    }
    const src = `${BASE}/${rel}`;
    try {
      const r = await fetch(src);
      if (!r.ok) throw new Error(`download HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 100) throw new Error(`too small (${buf.length}b)`);
      const ct =
        r.headers.get("content-type") ||
        (rel.endsWith(".png") ? "image/png" : "image/jpeg");
      const put = await putBlob(rel, buf, ct);
      const newUrl = put.url || put.downloadUrl;
      if (!newUrl) throw new Error("no url in blob response");
      mapping.set(rel, newUrl);
      ok += 1;
      if (ok % 25 === 0) {
        saveProgress();
        console.log(`progress ok=${ok} fail=${fail} mapped=${mapping.size}/${paths.size}`);
      }
    } catch (e) {
      fail += 1;
      failures.push({ path: rel, error: String(e.message || e) });
      console.warn(`FAIL ${rel}: ${e.message || e}`);
    }
  }
}

const chunks = Array.from({ length: concurrency }, () => []);
queue.forEach((item, i) => chunks[i % concurrency].push(item));
await Promise.all(chunks.map((c) => worker(c)));

if (!dry) {
  // Rewrite apartments.json urls from mapping
  let rewritten = 0;
  for (const apt of apartments) {
    for (const img of apt.images || []) {
      if (!img || typeof img !== "object") continue;
      const url = img.url;
      if (!url || typeof url !== "string") continue;
      const rel = url
        .replace(/^https?:\/\/[^/]+/, "")
        .replace(/^\//, "")
        .split("?")[0];
      if (mapping.has(rel)) {
        if (img.url !== mapping.get(rel)) {
          img.url = mapping.get(rel);
          rewritten += 1;
        }
      }
    }
  }
  catalog.apartments = apartments;
  fs.writeFileSync(DATA, JSON.stringify(catalog, null, 2) + "\n");
  saveProgress();
  console.log(`Rewrote ${rewritten} image URL references in apartments.json`);
}

console.log(
  JSON.stringify(
    {
      uniquePaths: paths.size,
      mapped: mapping.size,
      uploadedThisRun: ok,
      failedThisRun: fail,
      failures: failures.slice(0, 20),
    },
    null,
    2
  )
);
if (fail > 0) process.exit(1);
