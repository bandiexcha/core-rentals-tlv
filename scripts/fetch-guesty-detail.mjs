import { chromium } from "playwright";
import fs from "fs";

const listingId = "69fb33d01cd9700014a4b376";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on("response", async (res) => {
  const u = res.url();
  if (u.includes("pm-websites-backend/listings") && u.includes(listingId)) {
    const body = await res.text();
    fs.writeFileSync("tmp-guesty-detail.json", body);
    console.log("Detail saved:", body.length);
    console.log(body.slice(0, 1500));
  }
});

await page.goto(
  `https://holyguest.guestybookings.com/en/properties/${listingId}?minOccupancy=1&adults=1`,
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.waitForTimeout(10000);
await browser.close();
