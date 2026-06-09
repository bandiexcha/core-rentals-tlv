#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../proof-screenshots");
const BASE = process.env.BASE_URL || "http://localhost:3000";

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.goto(BASE, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(2000);

  const topShot = path.join(OUT, "homepage-top.png");
  await page.screenshot({ path: topShot, fullPage: false });

  const featured = page.locator("#featured-heading").locator("xpath=..");
  await featured.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  const middleShot = path.join(OUT, "homepage-middle.png");
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: middleShot, fullPage: false });

  const button = page.getByRole("link", { name: /View Full Catalog/i });
  await button.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  const aboveCatalogShot = path.join(OUT, "homepage-above-catalog-button.png");
  await page.screenshot({ path: aboveCatalogShot, fullPage: false });

  const cardCount = await page.locator("#featured-heading").locator("xpath=../..").locator("article").count();

  console.log(
    JSON.stringify(
      {
        base: BASE,
        featuredCards: cardCount,
        screenshots: {
          top: topShot,
          middle: middleShot,
          aboveCatalogButton: aboveCatalogShot,
        },
      },
      null,
      2
    )
  );

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
