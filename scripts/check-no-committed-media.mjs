#!/usr/bin/env node
/** Fail if staged/committed media under public/ exceeds policy. */
import { execSync } from "node:child_process";
const out = execSync("git ls-files -z -- public/", { encoding: "buffer" });
const files = out.toString("utf8").split("\0").filter(Boolean);
const banned = files.filter((f) => /\.(jpg|jpeg|png|gif|webp|mp4|mov|pdf|zip|wav|mp3)$/i.test(f));
if (banned.length) {
  console.error("Media files must not be committed. Use Vercel Blob / CDN. Offenders:");
  banned.slice(0, 50).forEach((f) => console.error(" -", f));
  process.exit(1);
}
console.log("OK: no committed media binaries under public/");
