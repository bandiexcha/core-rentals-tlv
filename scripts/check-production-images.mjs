#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://core-rentals-tlv.vercel.app";
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/apartments.json"), "utf8"));

async function pool(items, fn, n = 20) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const x = i++;
      out[x] = await fn(items[x]);
    }
  }));
  return out;
}

async function check(img) {
  const res = await fetch(`${BASE}${img.url}`, { method: "HEAD" });
  return res.ok ? null : img.url;
}

async function main() {
  const refs = catalog.apartments.flatMap((a) => a.images || []);
  console.error(`Checking ${refs.length} production image URLs...`);
  const bad = (await pool(refs, check, 25)).filter(Boolean);
  console.log(JSON.stringify({ total: refs.length, broken: bad.length, examples: bad.slice(0, 30) }, null, 2));
}

main();
