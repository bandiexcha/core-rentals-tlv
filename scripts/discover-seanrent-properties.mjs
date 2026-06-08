#!/usr/bin/env node
/**
 * Discover Sea N' Rent accommodation URLs from booking engine JS bundles
 * and public pages — no search engine autocomplete required.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src/data/seanrent-urls.json");
const ACC_RE = /\/s\/accommodations\/([a-zA-Z0-9_-]{6,})/g;

async function extractFromScripts(page, baseUrl) {
  const slugs = new Set();
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 120000 });
  const html = await page.content();

  for (const m of html.matchAll(ACC_RE)) slugs.add(m[1]);

  const scripts = [...html.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]);
  console.log(`  ${baseUrl}: ${scripts.length} JS chunks`);

  for (const rel of scripts) {
    const url = `https://booking.seanrent.com${rel}`;
    try {
      const text = await (await page.request.get(url)).text();
      for (const m of text.matchAll(ACC_RE)) slugs.add(m[1]);
      for (const m of text.matchAll(/accommodations[/\\]+([a-zA-Z0-9_-]{8,})/g)) slugs.add(m[1]);
    } catch {}
  }
  return slugs;
}

async function validateAccommodation(page, slug) {
  const url = `https://booking.seanrent.com/s/accommodations/${slug}`;
  const payloads = [];

  page.removeAllListeners("response");
  page.on("response", async (res) => {
    const u = res.url();
    if (!/shine-api|web-api|maveriks/i.test(u)) return;
    const ct = res.headers()["content-type"] || "";
    if (!ct.includes("json")) return;
    try {
      const json = await res.json();
      if (json.name || json.title || json.data?.name) payloads.push(json);
    } catch {}
  });

  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(5000);
    const title = await page.title();
    if (res?.status() === 404 || /not found/i.test(title)) return null;

    const dom = await page.evaluate(() => ({
      title: document.querySelector("h1")?.textContent?.trim() || document.title,
      textLen: document.body?.innerText?.length || 0,
      imgs: [...document.querySelectorAll("img")].map((i) => i.src).filter(Boolean).length,
    }));

    if (dom.textLen < 300 && dom.imgs < 2) return null;
    return { url, slug, title: dom.title, payloads: payloads.length };
  } catch {
    return null;
  }
}

async function main() {
  console.log("🔍 Discovering Sea N' Rent property pages...\n");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const slugs = new Set();

  for (const url of [
    "https://booking.seanrent.com/s",
    "https://booking.seanrent.com/en-US/s?city=tel-aviv&country=IL",
    "https://www.seanrent.com/",
  ]) {
    const found = await extractFromScripts(page, url);
    found.forEach((s) => slugs.add(s));
    console.log(`  → ${found.size} slugs from ${url}`);
  }

  console.log(`\nCandidate slugs: ${slugs.size}`);

  const valid = [];
  const slugList = [...slugs];
  for (let i = 0; i < slugList.length; i++) {
    const slug = slugList[i];
    process.stdout.write(`\rValidating ${i + 1}/${slugList.length}...`);
    const result = await validateAccommodation(page, slug);
    if (result) valid.push(result.url);
  }
  console.log(`\n\nValid property URLs: ${valid.length}`);

  fs.writeFileSync(
    OUT,
    JSON.stringify({ discoveredAt: new Date().toISOString(), count: valid.length, urls: valid.sort() }, null, 2) + "\n"
  );
  console.log(`Saved to src/data/seanrent-urls.json`);
  valid.slice(0, 10).forEach((u) => console.log(" ", u));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
