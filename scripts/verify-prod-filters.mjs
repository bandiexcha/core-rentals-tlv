#!/usr/bin/env node
import { chromium } from "playwright";

const BASE = "https://core-rentals-tlv.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

function pass(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

let failures = 0;

await page.goto(`${BASE}/apartments`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(1200);

await page.getByRole("button", { name: /Filters/i }).first().click();
await page.waitForTimeout(700);

// Drawer is the only interactive filter panel on mobile; use getByLabel within it.
const citySel = page.locator("#drawer-city");
const nbhdSel = page.locator("#drawer-neighborhood");
const bedSel = page.locator("#drawer-bedrooms");

const bedroomOptions = [
  ...new Set((await bedSel.locator("option").allTextContents()).map((o) => o.trim())),
];
console.log("BEDROOM_OPTIONS", bedroomOptions);
if (
  !pass(
    "bedrooms_no_plus",
    !bedroomOptions.some((o) => /^\d+\+/.test(o)),
    bedroomOptions.join(", ")
  )
)
  failures++;
if (
  !pass(
    "bedrooms_exact_labels",
    ["1 Bedroom", "2 Bedrooms", "3 Bedrooms", "4 Bedrooms", "5 Bedrooms", "6 Bedrooms"].every(
      (l) => bedroomOptions.includes(l)
    )
  )
)
  failures++;

const cityOptions = [
  ...new Set((await citySel.locator("option").allTextContents()).map((o) => o.trim())),
];
console.log("CITY_OPTIONS", cityOptions);
if (
  !pass(
    "city_no_numeric",
    !cityOptions.some((o) => /^\d+(\s|\(|$)/.test(o)),
    cityOptions.filter((o) => /^\d+/.test(o)).join(", ")
  )
)
  failures++;
if (!pass("city_has_tlv", cityOptions.some((o) => o.startsWith("Tel Aviv")))) failures++;

const nbhdBefore = [
  ...new Set((await nbhdSel.locator("option").allTextContents()).map((o) => o.trim())),
];
console.log("NBHD_BEFORE", nbhdBefore);
if (
  !pass(
    "nbhd_requires_city",
    nbhdBefore.includes("Select a city first") ||
      (nbhdBefore.includes("Any") && nbhdBefore.length <= 2)
  )
)
  failures++;

await citySel.selectOption({ value: "Tel Aviv" });
await page.waitForTimeout(1000);
console.log("URL_AFTER_CITY", page.url());

const nbhdAfter = [
  ...new Set((await nbhdSel.locator("option").allTextContents()).map((o) => o.trim())),
];
console.log("NBHD_AFTER_TLV", nbhdAfter);
if (
  !pass(
    "nbhd_dynamic_tlv",
    nbhdAfter.some((n) => n.includes("Neve Tzedek")) &&
      !nbhdAfter.some((n) =>
        ["Herzliya", "Netanya", "Eilat", "Athens", "Haifa"].some((c) => n.startsWith(c))
      )
  )
)
  failures++;

const counterAfterCity = await page.locator("text=/Showing \\d+ of \\d+/").first().textContent();
console.log("COUNTER_AFTER_CITY", counterAfterCity);
const cityCount = Number(counterAfterCity?.match(/Showing (\d+)/)?.[1] || 0);
if (!pass("tlv_count_reasonable", cityCount >= 200, String(cityCount))) failures++;
if (!pass("url_has_city", /city=Tel(\+|%20)?Aviv/i.test(page.url()), page.url())) failures++;

await bedSel.selectOption({ value: "2" });
await page.waitForTimeout(1000);
console.log("URL_AFTER_BR", page.url());
const counterAfterBr = await page.locator("text=/Showing \\d+ of \\d+/").first().textContent();
console.log("COUNTER_AFTER_BR", counterAfterBr);
if (!pass("url_has_bedrooms_2", page.url().includes("bedrooms=2"), page.url())) failures++;

const brCount = Number(counterAfterBr?.match(/Showing (\d+)/)?.[1] || 0);
if (!pass("tlv_2br_count", brCount > 0 && brCount < cityCount, String(brCount))) failures++;

await page.getByRole("button", { name: /Apply Filters/i }).click();
await page.waitForTimeout(600);

// Direct URL acceptance tests
const cases = [
  { url: `${BASE}/apartments?bedrooms=1`, key: "1br", min: 80, max: 120 },
  { url: `${BASE}/apartments?bedrooms=2`, key: "2br", min: 100, max: 160 },
  { url: `${BASE}/apartments?bedrooms=3`, key: "3br", min: 80, max: 130 },
  {
    url: `${BASE}/apartments?city=Tel+Aviv&neighborhood=Neve+Tzedek&bedrooms=2`,
    key: "combo",
    min: 5,
    max: 15,
  },
];

for (const c of cases) {
  await page.goto(c.url, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1000);
  const text = await page.locator("text=/Showing \\d+ of \\d+/").first().textContent();
  const n = Number(text?.match(/Showing (\d+)/)?.[1] || 0);
  console.log(`DEEPLINK_${c.key}`, text, page.url());
  if (!pass(`deeplink_${c.key}`, n >= c.min && n <= c.max, String(n))) failures++;
}

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1000);
if (
  !pass(
    "refresh_persists",
    page.url().includes("bedrooms=2") &&
      page.url().includes("Neve") &&
      /city=Tel/i.test(page.url())
  )
)
  failures++;

await page.getByRole("button", { name: /Filters/i }).first().click();
await page.waitForTimeout(700);
const bedSel2 = page.locator("#drawer-bedrooms");
const opts2 = (await bedSel2.locator("option").allTextContents()).map((o) => o.trim());
if (!pass("mobile_bedrooms_still_no_plus", !opts2.some((o) => /^\d+\+/.test(o)), opts2.join("|")))
  failures++;
const selectedBed = await bedSel2.inputValue();
if (!pass("mobile_selected_bedrooms_2", selectedBed === "2", selectedBed)) failures++;

const citySel2 = page.locator("#drawer-city");
if (!pass("mobile_selected_city", (await citySel2.inputValue()) === "Tel Aviv")) failures++;

console.log("\nTOTAL_FAILURES", failures);
await browser.close();
process.exit(failures > 0 ? 1 : 0);
