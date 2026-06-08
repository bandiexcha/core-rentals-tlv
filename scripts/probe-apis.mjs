import fs from "fs";

for (const file of ["tmp-hg.html", "tmp-sn.html"]) {
  const html = fs.readFileSync(file, "utf8");
  const urls = [...new Set([...html.matchAll(/https?:\/\/[^"'\s\\]+/g)].map((m) => m[0]))];
  const interesting = urls.filter(
    (u) =>
      /api|listing|property|guesty|maveriks|graphql/i.test(u) &&
      !/\.js|\.css|\.svg|\.woff|static|chunks/i.test(u)
  );
  console.log(`\n=== ${file} ===`);
  console.log(interesting.slice(0, 40).join("\n"));
}

// Also search for embedded JSON keys
for (const file of ["tmp-hg.html", "tmp-sn.html"]) {
  const html = fs.readFileSync(file, "utf8");
  const keys = ["apiKey", "clientId", "siteId", "companyId", "tenant", "listingId", "maveriks", "guesty"];
  console.log(`\n=== keys in ${file} ===`);
  for (const k of keys) {
    const idx = html.indexOf(k);
    if (idx >= 0) console.log(k, html.slice(Math.max(0, idx - 50), idx + 150));
  }
}
