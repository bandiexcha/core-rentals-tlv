/**
 * Production media resolution for Core Rentals TLV.
 *
 * Apartment photos must NOT be served from Git LFS during deploys.
 * Prefer NEXT_PUBLIC_MEDIA_BASE_URL; fall back to the public Vercel Blob
 * origin so Preview/CLI builds still resolve media when Preview env cannot
 * be set (this Vercel project has no Git connection). See ASSETS.md.
 */

const DEFAULT_MEDIA_BASE =
  "https://oczbmewo4o86denx.public.blob.vercel-storage.com";

const MEDIA_BASE = (
  process.env.NEXT_PUBLIC_MEDIA_BASE_URL || DEFAULT_MEDIA_BASE
).replace(/\/$/, "");

/** Resolve a catalog image path (`/apartments/...`) to its public URL. */
export function resolveMediaUrl(url: string | undefined | null): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const path = url.startsWith("/") ? url : `/${url}`;
  if (path.startsWith("/apartments/")) {
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
