import { NextResponse } from "next/server";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import {
  extractBearer,
  isOrchestraAuthConfigured,
  serviceUnavailable,
  unauthorized,
  verifyOrchestraApiKey,
} from "@/lib/leads/auth";
import { absoluteUrl } from "@/lib/seo";

/**
 * Returns campaign landing URLs with UTM parameters for Orchestra acquisition.
 * Does not invent Orchestra Cloud callbacks — inbound contract only.
 */
export async function GET(request: Request) {
  if (!FEATURE_FLAGS.orchestraApi) {
    return serviceUnavailable("Orchestra API disabled.");
  }
  if (!isOrchestraAuthConfigured()) {
    return serviceUnavailable("ORCHESTRA_API_KEY not configured.");
  }
  const key = extractBearer(request) || request.headers.get("x-orchestra-key");
  if (!verifyOrchestraApiKey(key)) return unauthorized();

  const url = new URL(request.url);
  const campaign = url.searchParams.get("campaign") || "orchestra";
  const partner = url.searchParams.get("partner") || "orchestra";
  const medium = url.searchParams.get("medium") || "partner";

  const destinations = [
    "corporate-accommodation-tel-aviv",
    "relocation-employee-assignments",
    "film-tv-crew-accommodation",
    "israelis-abroad-family-visits",
    "summer-stays-tel-aviv",
    "passover-jewish-holiday-visits",
    "international-delegations-group-travel",
    "sports-events-accompanying-families",
    "extended-stay-furnished-apartments",
  ];

  const links = destinations.map((slug) => {
    const params = new URLSearchParams({
      utm_source: partner,
      utm_medium: medium,
      utm_campaign: campaign,
      campaign: slug,
    });
    return {
      slug,
      landingUrl: `${absoluteUrl(`/campaigns/${slug}`)}?${params}`,
      contactUrl: `${absoluteUrl("/contact")}?${params}`,
    };
  });

  return NextResponse.json({
    partner,
    campaign,
    medium,
    links,
    note: "Append these URLs to Orchestra campaigns. Attribution is first-touch captured on the website. Conversion results available via GET /api/orchestra/leads for Orchestra-sourced leads only.",
  });
}
