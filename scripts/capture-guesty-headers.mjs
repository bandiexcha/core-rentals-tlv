import { chromium } from "playwright";
import fs from "fs";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const captured = [];

page.on("request", (req) => {
  if (req.url().includes("pm-websites-backend/listings")) {
    captured.push({ url: req.url(), headers: req.headers() });
  }
});

page.on("response", async (res) => {
  if (res.url().includes(`pm-websites-backend/listings/69fb33`)) {
    const ct = res.headers()["content-type"] || "";
    if (ct.includes("json")) {
      const text = await res.text();
      if (text.startsWith("{")) {
        fs.writeFileSync("tmp-guesty-detail.json", text);
        const d = JSON.parse(text);
        console.log("Detail keys:", Object.keys(d));
        console.log("pictures:", d.pictures?.length);
      }
    }
  }
});

await page.goto(
  "https://holyguest.guestybookings.com/en/properties/69fb33d01cd9700014a4b376?minOccupancy=1&adults=1",
  { waitUntil: "domcontentloaded", timeout: 60000 }
);
await page.waitForTimeout(12000);

fs.writeFileSync("tmp-guesty-headers.json", JSON.stringify(captured, null, 2));
console.log("Captured requests:", captured.length);
for (const c of captured) console.log(c.url.slice(0, 120));

await browser.close();
