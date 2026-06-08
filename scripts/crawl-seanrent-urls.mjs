#!/usr/bin/env node
/**
 * Sea N' Rent — Public site crawler
 * Discovers apartment URLs from seanrent.com and booking.seanrent.com
 * without using the booking search engine.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "src/data/seanrent-urls.json");

const SEED_URLS = [
  "https://www.seanrent.com/",
  "https://www.seanrent.com/about",
  "https://booking.seanrent.com/s",
  "https://booking.seanrent.com/en-US/s?city=tel-aviv&country=IL",
];

const ACCOMMODATION_RE =
  /booking\.seanrent\.com\/(?:en-US\/)?s\/accommodations\/([a-zA-Z0-9_-]+)/i;

async function fetchText(page, url) {
  try {
    const res = await page.request.get(url, { timeout: 30000 });
    if (res.ok()) return res.text();
  } catch {}
  return "";
}

async function discoverFromSitemap(page) {
  const urls = new Set();
  for (const base of ["https://www.seanrent.com", "https://booking.seanrent.com"]) {
    for (const path of ["/sitemap.xml", "/sitemap_index.xml", "/robots.txt"]) {
      const text = await fetchText(page, base + path);
      if (!text) continue;
      for (const m of text.matchAll(/https?:\/\/[^\s<"']+/g)) {
        const u = m[0].replace(/&amp;/g, "&");
        if (ACCOMMODATION_RE.test(u) || /seanrent\.com\/[a-z0-9-]+$/i.test(u)) urls.add(u);
      }
      for (const m of text.matchAll(/\/s\/accommodations\/[a-zA-Z0-9_-]+/g)) {
        urls.add(`https://booking.seanrent.com${m[0]}`);
      }
    }
  }
  return urls;
}

async function crawlSite(page, startUrl, maxPages = 50) {
  const found = new Set();
  const queue = [startUrl];
  const visited = new Set();

  while (queue.length && visited.size < maxPages) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(2000);

      const links = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
      for (const link of links) {
        if (ACCOMMODATION_RE.test(link)) found.add(link.split("?")[0]);
        if (/seanrent\.com/i.test(link) && !visited.has(link) && !link.includes("#")) {
          queue.push(link);
        }
        if (/booking\.seanrent\.com\/s\//i.test(link)) {
          found.add(link.split("?")[0]);
        }
      }

      // Extract accommodation slugs from page HTML/JS
      const html = await page.content();
      for (const m of html.matchAll(/\/s\/accommodations\/([a-zA-Z0-9_-]{3,})/g)) {
        found.add(`https://booking.seanrent.com/s/accommodations/${m[1]}`);
      }
    } catch (err) {
      console.warn(`  skip ${url}: ${err.message}`);
    }
  }

  return { found, visited: [...visited] };
}

async function discoverFromWebflow(page) {
  const urls = new Set();
  await page.goto("https://www.seanrent.com/", { waitUntil: "networkidle", timeout: 90000 });

  const html = await page.content();
  const scriptSrcs = [...html.matchAll(/src="([^"]+\.js)"/g)].map((m) => m[1]);

  for (const rel of scriptSrcs) {
    const scriptUrl = rel.startsWith("http") ? rel : `https://www.seanrent.com${rel}`;
    try {
      const text = await (await page.request.get(scriptUrl)).text();
      for (const m of text.matchAll(/\/s\/accommodations\/([a-zA-Z0-9_-]{8,})/g)) {
        urls.add(`https://booking.seanrent.com/s/accommodations/${m[1]}`);
      }
      for (const m of text.matchAll(/booking\.seanrent\.com[^"'`\s]+/g)) {
        const clean = m[0].replace(/\\u002F/g, "/").split("?")[0];
        if (ACCOMMODATION_RE.test(clean)) urls.add(clean);
      }
    } catch {}
  }

  return urls;
}

async function validateUrls(page, urls) {
  const valid = [];
  for (const url of urls) {
    try {
      const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      const title = await page.title();
      if (res?.status() === 404 || /404|not found/i.test(title)) continue;
      if (/500|error/i.test(title) && !/apartment|rent|tel aviv/i.test(title)) continue;

      const hasContent = await page.evaluate(() => {
        const text = document.body?.innerText || "";
        return text.length > 200 && !/^Search Accommodations$/i.test(document.title);
      });
      if (hasContent) valid.push(url);
    } catch {}
  }
  return valid;
}

async function main() {
  console.log("🔍 Discovering Sea N' Rent apartment URLs...\n");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const all = new Set();

  const sitemap = await discoverFromSitemap(page);
  sitemap.forEach((u) => all.add(u));
  console.log(`Sitemap/robots: ${sitemap.size} URLs`);

  const webflow = await discoverFromWebflow(page);
  webflow.forEach((u) => all.add(u));
  console.log(`Webflow/JS bundles: ${webflow.size} URLs`);

  for (const seed of SEED_URLS) {
    const { found, visited } = await crawlSite(page, seed, 30);
    found.forEach((u) => all.add(u));
    console.log(`Crawl ${seed}: ${found.size} accommodation URLs (${visited.length} pages visited)`);
  }

  console.log(`\nTotal unique candidates: ${all.size}`);

  let valid = [...all];
  if (valid.length > 0 && valid.length <= 200) {
    console.log("Validating URLs...");
    valid = await validateUrls(page, valid);
    console.log(`Valid after check: ${valid.length}`);
  }

  const output = {
    discoveredAt: new Date().toISOString(),
    count: valid.length,
    urls: valid.sort(),
  };
  fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + "\n");
  console.log(`\n✅ Saved ${valid.length} URLs to src/data/seanrent-urls.json`);
  if (valid.length) console.log(valid.slice(0, 10).join("\n"));

  await browser.close();
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
