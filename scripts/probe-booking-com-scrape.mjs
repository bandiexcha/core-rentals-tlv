import { chromium } from "playwright";

const url = "https://www.booking.com/hotel/il/modern-amp-bright-3br-apt-by-sea-n-rent.html";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(5000);

const data = await page.evaluate(() => {
  const title =
    document.querySelector("h2.pp-header__title")?.textContent?.trim() ||
    document.querySelector("h1")?.textContent?.trim() ||
    document.title;

  const desc = [...document.querySelectorAll("#property_description_content p, [data-testid='property-description']")]
    .map((p) => p.textContent?.trim())
    .filter(Boolean)
    .join("\n\n");

  const images = [...document.querySelectorAll("img")]
    .map((img) => img.src || img.dataset?.src)
    .filter((s) => s && /bstatic\.com|booking\.com.*photo/i.test(s) && !/logo|icon|avatar|flag/i.test(s));

  const text = document.body.innerText;
  const bedrooms = text.match(/(\d+)\s+bedroom/i)?.[1];
  const bathrooms = text.match(/(\d+)\s+bathroom/i)?.[1];
  const guests = text.match(/(\d+)\s+guests?/i)?.[1] || text.match(/Sleeps\s+(\d+)/i)?.[1];

  const amenities = [...document.querySelectorAll('[data-testid="property-section--content"] li, .facilitiesChecklistSection li, .hp_desc_additional_facilities li')]
    .map((el) => el.textContent?.trim())
    .filter(Boolean);

  const address =
    document.querySelector('[data-testid="address"]')?.textContent?.trim() ||
    document.querySelector(".hp_address_subtitle")?.textContent?.trim() ||
    "";

  const managedBySeaNrent = /managed by sea n.?['']?\s*rent|by sea n.?['']?\s*rent/i.test(text);

  return {
    title,
    address,
    desc: desc.slice(0, 500),
    images: [...new Set(images)].slice(0, 5),
    imageCount: [...new Set(images)].length,
    bedrooms,
    bathrooms,
    guests,
    amenities: amenities.slice(0, 15),
    managedBySeaNrent,
  };
});

console.log(JSON.stringify(data, null, 2));
await browser.close();
