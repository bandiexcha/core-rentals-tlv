#!/usr/bin/env node
/**
 * Guardrail: refuse committing huge media into Git / LFS.
 * Usage: node scripts/check-asset-size.mjs [--staged]
 */
import { execSync } from "child_process";
import fs from "fs";

const MAX_BYTES = 1.5 * 1024 * 1024; // 1.5 MB
const MEDIA_EXT = /\.(png|jpe?g|webp|gif|avif|mp4|mov|webm|wav|mp3|zip|pdf)$/i;
const staged = process.argv.includes("--staged");

function listedFiles() {
  if (staged) {
    const out = execSync("git diff --cached --name-only --diff-filter=ACMR", {
      encoding: "utf8",
    });
    return out.split(/\r?\n/).filter(Boolean);
  }
  const out = execSync("git ls-files", { encoding: "utf8" });
  return out.split(/\r?\n/).filter(Boolean);
}

const offenders = [];
for (const file of listedFiles()) {
  if (!MEDIA_EXT.test(file)) continue;
  if (!fs.existsSync(file)) continue;
  // Pointer files are tiny; only flag real binaries present in the working tree.
  const size = fs.statSync(file).size;
  if (size > MAX_BYTES) {
    offenders.push({ file, mb: +(size / 1e6).toFixed(2) });
  }
}

if (offenders.length) {
  console.error(
    `Asset size check failed: ${offenders.length} file(s) over ${MAX_BYTES / 1e6} MB.`
  );
  console.error("Production media belongs in Vercel Blob — see ASSETS.md.");
  for (const o of offenders.slice(0, 40)) {
    console.error(`  ${o.mb} MB  ${o.file}`);
  }
  if (offenders.length > 40) console.error(`  …and ${offenders.length - 40} more`);
  process.exit(1);
}

console.log("Asset size check OK.");
