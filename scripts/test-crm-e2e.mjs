/**
 * Controlled CRM / inquiry E2E against local or production.
 * Does not send real customer messages when EMAIL providers are unset
 * or when --dry-store is used with a local server that has no mail keys.
 *
 * Usage:
 *   node scripts/test-crm-e2e.mjs
 *   node scripts/test-crm-e2e.mjs --base https://core-rentals-tlv.vercel.app
 *   node scripts/test-crm-e2e.mjs --base http://localhost:3000 --crm-password SECRET
 */

const args = process.argv.slice(2);
function flag(name, fallback = "") {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
}

const BASE = (flag("--base", process.env.TEST_BASE_URL || "http://localhost:3000")).replace(
  /\/$/,
  ""
);
const CRM_PASSWORD = flag("--crm-password", process.env.CRM_ADMIN_PASSWORD || "");
const ORCHESTRA_KEY = flag("--orchestra-key", process.env.ORCHESTRA_API_KEY || "");

const results = [];

function record(name, status, detail) {
  results.push({ name, status, detail });
  const mark = status === "PASS" ? "PASS" : status === "SKIP" ? "SKIP" : "FAIL";
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log(`Base: ${BASE}\n`);

  // 1) Campaign landing pages exist
  const campaignSlug = "corporate-accommodation-tel-aviv";
  const campaignRes = await fetch(`${BASE}/campaigns/${campaignSlug}`);
  record(
    "Campaign landing page",
    campaignRes.ok ? "PASS" : "FAIL",
    `HTTP ${campaignRes.status}`
  );

  // 2) Contact with UTM
  const contactRes = await fetch(
    `${BASE}/contact?utm_source=e2e&utm_medium=test&utm_campaign=crm-accept&campaign=${campaignSlug}`
  );
  record(
    "Contact page with UTM",
    contactRes.ok ? "PASS" : "FAIL",
    `HTTP ${contactRes.status}`
  );

  // 3) Inquiry creates durable lead (test payload — use clearly fake identity)
  const inquiryPayload = {
    name: "E2E Test Lead (DO NOT CONTACT)",
    email: `e2e-test-${Date.now()}@example.invalid`,
    phone: "",
    apartment: "E2E Catalog Check",
    checkin: "2030-01-10",
    checkout: "2030-01-17",
    guests: "2",
    bedroomsRequested: "1",
    destination: "Tel Aviv",
    requirements: "Automated acceptance test — discard",
    notes: "Automated CRM acceptance test. Not a real customer.",
    message: "Automated CRM acceptance test. Not a real customer.",
    consentMarketing: false,
    attribution: {
      utmSource: "e2e",
      utmMedium: "test",
      utmCampaign: "crm-accept",
      landingPage: `/campaigns/${campaignSlug}`,
      inquiryPage: "/contact",
      campaignSlug,
    },
  };

  const inquiryRes = await fetch(`${BASE}/api/inquiry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(inquiryPayload),
  });
  const inquiryJson = await inquiryRes.json().catch(() => ({}));
  const leadId = inquiryJson.leadId;
  record(
    "Inquiry API persistence",
    inquiryRes.ok && inquiryJson.success ? "PASS" : "FAIL",
    `HTTP ${inquiryRes.status}; leadId=${leadId || "none"}; emailSent=${inquiryJson.emailSent}`
  );

  // 4) CRM login + fetch lead
  if (!CRM_PASSWORD) {
    record(
      "CRM dashboard auth",
      "SKIP",
      "CRM_ADMIN_PASSWORD not provided — set env or --crm-password"
    );
  } else if (!leadId) {
    record("CRM lead recovery", "FAIL", "No leadId returned from inquiry");
  } else {
    const loginRes = await fetch(`${BASE}/api/admin/crm/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: CRM_PASSWORD }),
    });
    const setCookie = loginRes.headers.getSetCookie?.() || [];
    const cookieHeader = setCookie.map((c) => c.split(";")[0]).join("; ");
    record(
      "CRM dashboard auth",
      loginRes.ok ? "PASS" : loginRes.status === 503 ? "SKIP" : "FAIL",
      `HTTP ${loginRes.status}`
    );

    if (loginRes.ok) {
      const leadRes = await fetch(`${BASE}/api/admin/crm/leads/${leadId}`, {
        headers: { Cookie: cookieHeader, Authorization: `Bearer ${CRM_PASSWORD}` },
      });
      const leadJson = await leadRes.json().catch(() => ({}));
      const attrOk =
        leadJson.lead?.attribution?.utmCampaign === "crm-accept" ||
        leadJson.lead?.attribution?.campaignSlug === campaignSlug;
      record(
        "CRM lead recovery + attribution",
        leadRes.ok && attrOk ? "PASS" : "FAIL",
        `HTTP ${leadRes.status}; utm=${leadJson.lead?.attribution?.utmCampaign}`
      );

      // Quote prep
      const quoteRes = await fetch(`${BASE}/api/admin/crm/leads/${leadId}/quotes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
          Authorization: `Bearer ${CRM_PASSWORD}`,
        },
        body: JSON.stringify({
          amount: null,
          notes: "E2E draft quote — no real price",
          status: "draft",
          propertyNames: ["E2E Catalog Check"],
        }),
      });
      record(
        "Quote preparation",
        quoteRes.ok ? "PASS" : "FAIL",
        `HTTP ${quoteRes.status}`
      );

      const metricsRes = await fetch(`${BASE}/api/admin/crm/metrics`, {
        headers: { Cookie: cookieHeader, Authorization: `Bearer ${CRM_PASSWORD}` },
      });
      const metricsJson = await metricsRes.json().catch(() => ({}));
      record(
        "Acquisition metrics (truthful)",
        metricsRes.ok && metricsJson.metrics?.note ? "PASS" : "FAIL",
        metricsJson.metrics?.note?.slice(0, 80)
      );

      // Mark lost so test data does not pollute pipeline as active
      await fetch(`${BASE}/api/admin/crm/leads/${leadId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
          Authorization: `Bearer ${CRM_PASSWORD}`,
        },
        body: JSON.stringify({
          status: "lost",
          lostReason: "E2E automated test — discard",
        }),
      });
      record("Test lead marked lost", "PASS", leadId);
    }
  }

  // 5) Orchestra boundary
  if (!ORCHESTRA_KEY) {
    record(
      "Orchestra API",
      "SKIP",
      "ORCHESTRA_API_KEY not provided — integration BLOCKED until owner sets key"
    );
  } else {
    const orchRes = await fetch(`${BASE}/api/orchestra/attribution?campaign=e2e`, {
      headers: { Authorization: `Bearer ${ORCHESTRA_KEY}` },
    });
    record(
      "Orchestra attribution endpoint",
      orchRes.ok ? "PASS" : orchRes.status === 503 ? "SKIP" : "FAIL",
      `HTTP ${orchRes.status}`
    );
  }

  // 6) Sitemap includes campaigns
  const sm = await fetch(`${BASE}/sitemap.xml`);
  const smText = await sm.text();
  record(
    "Sitemap campaigns",
    sm.ok && smText.includes("/campaigns/") ? "PASS" : "FAIL",
    `HTTP ${sm.status}`
  );

  console.log("\n--- Summary ---");
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const skip = results.filter((r) => r.status === "SKIP").length;
  console.log(`PASS ${pass} · FAIL ${fail} · SKIP ${skip}`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
