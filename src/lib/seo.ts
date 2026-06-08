import type { Metadata } from "next";
import type { Apartment } from "@/types/apartment";
import { SITE } from "@/lib/constants";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://core-rentals-tlv.vercel.app";

const DEFAULT_OG =
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80";

export interface PageMetaInput {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article";
  noIndex?: boolean;
}

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}

export function buildPageMetadata({
  title,
  description,
  path,
  image = DEFAULT_OG,
  type = "website",
  noIndex = false,
}: PageMetaInput): Metadata {
  const url = absoluteUrl(path);

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { index: true, follow: true } },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE.name,
      locale: "en_US",
      type,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export function apartmentImageAlt(apartment: Apartment, index = 0): string {
  const photo = index + 1;
  return `${apartment.name} — ${apartment.bedrooms}-bedroom vacation rental in ${apartment.neighborhood}, Tel Aviv, Israel (photo ${photo})`;
}

export function apartmentMetaDescription(apartment: Apartment): string {
  return `${apartment.name} in ${apartment.neighborhood}, Tel Aviv — sleeps ${apartment.guests}, ${apartment.bedrooms} bedrooms, ${apartment.bathrooms} bathrooms. ${apartment.shortDescription.slice(0, 140).trim()}… Request availability via Core Rentals TLV.`;
}

export function apartmentMetaTitle(apartment: Apartment): string {
  return `${apartment.name} | ${apartment.neighborhood} Tel Aviv Vacation Rental`;
}
