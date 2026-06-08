import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const all = [];

page.on("response", async (res) => {
  const u = res.url();
  if (!u.includes("pm-websites-backend/listings") || u.includes("/calendar")) return;
  try {
    const json = JSON.parse(await res.text());
    if (json.results?.length) {
      const ids = new Set(all.map((x) => x._id));
      const fresh = json.results.filter((r) => !ids.has(r._id));
      all.push(...fresh);
      console.log("Batch +", fresh.length, "total", all.length, "/", json.pagination?.total);
    }
  } catch {}
});

await page.goto("https://holyguest.guestybookings.com/en/properties?minOccupancy=1&adults=1", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(5000);

// Inspect pagination controls
const buttons = await page.$$eval("button, a", (els) =>
  els
    .filter((e) => e.offsetParent !== null)
    .map((e) => ({ tag: e.tagName, text: e.textContent?.trim().slice(0, 40), aria: e.getAttribute("aria-label") }))
    .filter((e) => /next|more|load|page|\d+/i.test(`${e.text} ${e.aria}`))
);
console.log("Pagination controls:", buttons.slice(0, 20));

// Try clicking page 2, 3, etc.
for (const n of ["2", "3", "4", "5"]) {
  const link = page.locator(`button:has-text("${n}"), a:has-text("${n}")`).first();
  if (await link.count()) {
    await link.click().catch(() => {});
    await page.waitForTimeout(4000);
  }
}

console.log("Final total:", all.length);
await browser.close();
