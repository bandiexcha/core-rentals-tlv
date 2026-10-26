"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_COOKIE_MAX_AGE,
  hasUtmSignal,
  mergeAttribution,
  parseAttributionFromSearchParams,
  type AttributionCookiePayload,
} from "@/lib/leads/attribution";

function readCookie(): AttributionCookiePayload | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${ATTRIBUTION_COOKIE}=`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match.split("=").slice(1).join("=")));
  } catch {
    return null;
  }
}

function writeCookie(payload: AttributionCookiePayload) {
  const value = encodeURIComponent(JSON.stringify(payload));
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${ATTRIBUTION_COOKIE}=${value}; Path=/; Max-Age=${ATTRIBUTION_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

/**
 * First-touch UTM capture. Preserves original campaign attribution while
 * updating inquiryPage on later navigations.
 */
export function AttributionCapture() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    const fromUrl = parseAttributionFromSearchParams(searchParams);
    const existing = readCookie();
    const referrer =
      existing?.referrer ||
      (typeof document !== "undefined" && document.referrer
        ? document.referrer
        : undefined);
    const landingPage =
      existing?.landingPage ||
      (typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : pathname);

    const next = mergeAttribution(existing, {
      ...fromUrl,
      referrer,
      landingPage,
      inquiryPage: pathname,
    });

    if (!existing?.firstTouchAt) {
      (next as AttributionCookiePayload).firstTouchAt = new Date().toISOString();
    } else {
      (next as AttributionCookiePayload).firstTouchAt = existing.firstTouchAt;
    }

    // Only write when we have signal or need to refresh inquiry page path
    if (hasUtmSignal(fromUrl) || !existing || existing.inquiryPage !== pathname) {
      writeCookie(next as AttributionCookiePayload);
    }
  }, [searchParams, pathname]);

  return null;
}

export function readAttributionFromBrowser(): AttributionCookiePayload | null {
  return readCookie();
}
