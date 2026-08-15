/**
 * Production media resolution for Core Rentals TLV.
 *
 * Apartment photos must NOT be served from Git LFS during deploys.
 * Set NEXT_PUBLIC_MEDIA_BASE_URL to the Vercel Blob (or CDN) origin that
 * hosts `/apartments/<slug>/…` objects. See ASSETS.md.
 */

const MEDIA_BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? "").replace(
  /\/$/,
  ""
);

/** Resolve a catalog image path (`/apartments/...`) to its public URL. */
export function resolveMediaUrl(url: string | undefined | null): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const path = url.startsWith("/") ? url : `/${url}`;
  if (MEDIA_BASE && path.startsWith("/apartments/")) {
    return `${MEDIA_BASE}${path}`;
  }
  return path;
}

export function hasExternalMediaBase(): boolean {
  return MEDIA_BASE.length > 0;
}

export function getMediaBaseUrl(): string {
  return MEDIA_BASE;
}
