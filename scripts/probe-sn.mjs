import fs from "fs";

const html = fs.readFileSync("tmp-sn.html", "utf8");

// Extract JSON blobs from script tags
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
console.log("script blocks:", scripts.length);

// Look for company/website IDs
const ids = [...html.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)].map(m => m[0]);
console.log("UUIDs:", [...new Set(ids)].slice(0, 10));

// Search for listing/property related strings in inline JSON
for (const pattern of ["listings", "properties", "accommodates", "bedrooms", "websiteId", "companyId"]) {
  const idx = html.indexOf(pattern);
  if (idx >= 0) {
    console.log("\n---", pattern, "---");
    console.log(html.slice(Math.max(0, idx - 80), idx + 200).replace(/\s+/g, " ").slice(0, 300));
  }
}

// Try to find __NEXT_DATA__ or similar
const nextData = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
if (nextData) {
  const data = JSON.parse(nextData[1]);
  fs.writeFileSync("tmp-sn-next.json", JSON.stringify(data, null, 2));
  console.log("\nWrote tmp-sn-next.json");
}

// Search in RSC payload
const rscMatches = [...html.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g)];
console.log("\nRSC chunks:", rscMatches.length);
for (const [, chunk] of rscMatches.slice(0, 5)) {
  const decoded = chunk.replace(/\\n/g, "\n").replace(/\\"/g, '"');
  if (/listing|property|accommodat|bedroom/i.test(decoded)) {
    console.log(decoded.slice(0, 500));
  }
}
