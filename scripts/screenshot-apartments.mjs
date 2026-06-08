#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../proof-screenshots");
const BASE = process.env.BASE_URL || "http://localhost:3000";

const SLUGS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "mamad-tel-aviv-paradise-haven",
      "contemporary-3br-apt-near-geula-beach",
      "spacious-2br-apt-in-balfour-with-mamad",
      "stylish-sea-view-2br-apartment",
      "the-loft",
      "rustic-charm-2br-apt-in-tel-aviv",
      "sweet-home-3br-near-the-sea",
      "florentine-2br-with-sea-view",
      "mamma-mia-3br-in-frishman-beach",
      "designer-2br-in-rembrandt-street",
    ];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const results = [];

  for (const slug of SLUGS) {
    const url = `${BASE}/apartments/${slug}`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(1500);

    const heroShot = path.join(OUT, `${slug}-hero.png`);
    await page.locator("article").screenshot({ path: heroShot });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    const galleryShot = path.join(OUT, `${slug}-gallery.png`);
    const gallerySection = page.locator("#photos-heading").locator("xpath=..");
    if (await gallerySection.count()) {
      await gallerySection.screenshot({ path: galleryShot });
    }

    const imgs = await page.locator("img").all();
    let loaded = 0;
    let broken = 0;
    for (const img of imgs) {
      const ok = await img.evaluate((el) => el.complete && el.naturalWidth > 200);
      if (ok) loaded++;
      else if (await img.isVisible()) broken++;
    }

    const firstSrc = await page.locator("article img").first().getAttribute("src").catch(() => null);

    const catalog = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../src/data/apartments.json"), "utf8")
    );
    const apt = catalog.apartments.find((a) => a.slug === slug);
    const photoCount = apt?.images?.length || 0;

    results.push({
      slug,
      url,
      heroScreenshot: heroShot,
      galleryScreenshot: galleryShot,
      photosInCatalog: photoCount,
      imagesLoaded: loaded,
      imagesBroken: broken,
      firstImageSrc: firstSrc,
      pass: loaded >= 3 && broken === 0 && photoCount >= 3,
    });
    console.log(
      `${loaded >= 3 ? "✓" : "✗"} ${slug} — ${photoCount} photos, ${loaded} rendered → ${heroShot}`
    );
  }

  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ base: BASE, results }, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
