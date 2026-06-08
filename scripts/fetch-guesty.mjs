import { chromium } from "playwright";
import fs from "fs";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const captured = [];

page.on("request", (req) => {
  if (req.url().includes("pm-websites-backend/listings")) {
    captured.push({
      url: req.url(),
      headers: req.headers(),
    });
  }
});

page.on("response", async (res) => {
  if (res.url().includes("pm-websites-backend/listings")) {
    const body = await res.text();
    fs.writeFileSync("tmp-guesty-listings.json", body);
    console.log("Saved listings:", body.length, "bytes");
    console.log("Preview:", body.slice(0, 500));
  }
});

await page.goto("https://holyguest.guestybookings.com/en/properties?minOccupancy=1&adults=1", {
  waitUntil: "networkidle",
  timeout: 90000,
});
await page.waitForTimeout(8000);

console.log("\nCaptured requests:", captured.length);
for (const c of captured) {
  console.log(c.url);
  console.log("headers:", JSON.stringify(c.headers, null, 2));
}

await browser.close();
