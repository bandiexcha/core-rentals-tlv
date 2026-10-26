import type { Attribution, LeadSource } from "@/lib/leads/types";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "fbclid",
] as const;

export type AttributionCookiePayload = Attribution & {
  firstTouchAt?: string;
};

export function parseAttributionFromSearchParams(
  params: URLSearchParams | Record<string, string | undefined>
): Attribution {
  const get = (key: string) => {
    if (params instanceof URLSearchParams) {
      return params.get(key)?.trim() || undefined;
    }
    return params[key]?.trim() || undefined;
  };

  return {
    utmSource: get("utm_source"),
    utmMedium: get("utm_medium"),
    utmCampaign: get("utm_campaign"),
    utmContent: get("utm_content"),
    utmTerm: get("utm_term"),
    gclid: get("gclid"),
    fbclid: get("fbclid"),
    campaignSlug: get("campaign") || get("utm_campaign"),
  };
}

export function mergeAttribution(
  first?: Attribution | null,
  next?: Attribution | null
): Attribution {
  const a = first ?? {};
  const b = next ?? {};
  return {
    utmSource: a.utmSource || b.utmSource,
    utmMedium: a.utmMedium || b.utmMedium,
    utmCampaign: a.utmCampaign || b.utmCampaign,
    utmContent: a.utmContent || b.utmContent,
    utmTerm: a.utmTerm || b.utmTerm,
    gclid: a.gclid || b.gclid,
    fbclid: a.fbclid || b.fbclid,
    referrer: a.referrer || b.referrer,
    landingPage: a.landingPage || b.landingPage,
    inquiryPage: b.inquiryPage || a.inquiryPage,
    campaignSlug: a.campaignSlug || b.campaignSlug,
  };
}

export function inferLeadSource(attribution: Attribution): LeadSource {
  const medium = (attribution.utmMedium || "").toLowerCase();
  const source = (attribution.utmSource || "").toLowerCase();
  const campaign = (attribution.utmCampaign || attribution.campaignSlug || "").toLowerCase();

  if (source === "orchestra" || medium === "orchestra") return "orchestra";
  if (campaign.includes("corporate") || source.includes("partner")) return "partner";
  if (campaign.includes("film") || campaign.includes("crew")) return "film_production";
  if (campaign.includes("corporate") || medium === "b2b") return "corporate";
  if (attribution.gclid || medium === "cpc" || medium === "ppc") return "paid_search";
  if (
    attribution.fbclid ||
    medium === "social" ||
    ["facebook", "instagram", "meta", "linkedin"].includes(source)
  ) {
    return "social";
  }
  if (medium === "organic" || source === "google" || source === "bing") {
    return "organic_search";
  }
  if (attribution.utmSource || attribution.utmCampaign) return "website";
  if (attribution.referrer) return "website";
  return "direct";
}

export function hasUtmSignal(attribution: Attribution): boolean {
  return UTM_KEYS.some((key) => {
    const map: Record<string, string | undefined> = {
      utm_source: attribution.utmSource,
      utm_medium: attribution.utmMedium,
      utm_campaign: attribution.utmCampaign,
      utm_content: attribution.utmContent,
      utm_term: attribution.utmTerm,
      gclid: attribution.gclid,
      fbclid: attribution.fbclid,
    };
    return Boolean(map[key]);
  });
}

export const ATTRIBUTION_COOKIE = "cr_tlv_attr";
export const ATTRIBUTION_COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days
