import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const pages = [
  "https://www.seanrent.com/",
  "https://www.seanrent.com/apartments",
  "https://www.seanrent.com/listings",
  "https://www.seanrent.com/properties",
  "https://www.seanrent.com/rentals",
  "https://www.seanrent.com/book",
  "https://www.seanrent.com/stay",
];

const allLinks = new Set();

for (const url of pages) {
  try {
    const res = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    if (res?.status() === 404) continue;
    const links = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
    links.forEach((l) => allLinks.add(l));
    console.log(url, "status", res?.status(), "links", links.length);
  } catch (e) {
    console.log(url, e.message);
  }
}

const booking = [...allLinks].filter((l) =>
  /booking\.seanrent|accommodation|maveriks|\/s\//i.test(l)
);
console.log("\nBooking-related links:", booking.length);
console.log(booking.join("\n"));

// Also check webflow CMS collection
const cmsData = await page.evaluate(() => {
  const scripts = document.querySelectorAll("[data-wf-collection], [data-wf-item-id], .w-dyn-list");
  return scripts.length;
});

console.log("Webflow dyn elements on homepage:", cmsData);

await browser.close();
