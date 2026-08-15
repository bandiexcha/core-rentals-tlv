#!/usr/bin/env node
/**
 * Upload public/apartments/** to the linked Vercel Blob store.
 * Requires BLOB_READ_WRITE_TOKEN (vercel env pull after linking store).
 *
 * Usage: node scripts/upload-apartments-to-blob.mjs [--dry-run] [--limit N] [--concurrency N]
 */
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const APT = path.join(ROOT, "public", "apartments");
const MANIFEST = path.join(ROOT, "scripts", ".blob-upload-manifest.json");

const dryRun = process.argv.includes("--dry-run");
const limitIdx = process.argv.indexOf("--limit");
const concIdx = process.argv.indexOf("--concurrency");
const limit =
  limitIdx >= 0 ? Number(process.argv[limitIdx + 1]) || 0 : Number.POSITIVE_INFINITY;
const concurrency = concIdx >= 0 ? Math.max(1, Number(process.argv[concIdx + 1]) || 4) : 4;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(jpe?g|png|webp|gif|avif)$/i.test(name)) out.push(p);
  }
  return out;
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST)) return {};
  try {
    return JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  } catch {
    return {};
  }
}

function saveManifest(m) {
  fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2));
}

async function putOne(file, pathname) {
  const { stdout } = await execFileAsync(
    "vercel",
    ["blob", "put", file, "--pathname", pathname, "--access", "public", "--yes"],
    { cwd: ROOT, encoding: "utf8", env: process.env, maxBuffer: 20 * 1024 * 1024 }
  );
  const urlMatch = stdout.match(/https:\/\/\S+/);
  return urlMatch ? urlMatch[0] : null;
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !dryRun) {
    console.error(
      "Missing BLOB_READ_WRITE_TOKEN. Link Blob store, then: vercel env pull .env.local"
    );
    process.exit(1);
  }

  const files = walk(APT);
  const manifest = loadManifest();
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  const queue = [];

  for (const file of files) {
    const rel = path.relative(path.join(ROOT, "public"), file).replace(/\\/g, "/");
    const st = fs.statSync(file);
    const prev = manifest[rel];
    if (prev && prev.size === st.size && prev.mtimeMs === st.mtimeMs && prev.url) {
      skipped++;
      continue;
    }
    queue.push({ file, rel, st });
    if (queue.length >= limit) break;
  }

  console.log(
    `Found ${files.length} images; queue ${queue.length}; skip ${skipped}; concurrency ${concurrency}`
  );

  let i = 0;
  async function worker() {
    while (i < queue.length) {
      const idx = i++;
      const item = queue[idx];
      if (dryRun) {
        console.log(`[dry-run] ${item.rel} (${(item.st.size / 1e6).toFixed(2)} MB)`);
        uploaded++;
        continue;
      }
      try {
        const url = await putOne(item.file, item.rel);
        manifest[item.rel] = {
          size: item.st.size,
          mtimeMs: item.st.mtimeMs,
          url,
          at: new Date().toISOString(),
        };
        if (uploaded % 10 === 0) saveManifest(manifest);
        uploaded++;
        if (uploaded % 25 === 0) {
          console.log(`Uploaded ${uploaded}/${queue.length} (failed ${failed})…`);
        }
      } catch (err) {
        failed++;
        console.error(`FAIL ${item.rel}:`, err?.message || err);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  if (!dryRun) saveManifest(manifest);

  console.log(JSON.stringify({ uploaded, skipped, failed, queued: queue.length, dryRun }, null, 2));
  if (!dryRun && uploaded > 0) {
    console.log(
      "Set NEXT_PUBLIC_MEDIA_BASE_URL to the Blob public origin (no trailing slash)."
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
