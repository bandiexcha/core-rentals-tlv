export type ApartmentSource = "seanrent" | "holyguest" | "manual";

export type ApartmentTag =
  | "sea-view"
  | "city-view"
  | "luxury"
  | "family"
  | "corporate";

export type TelAvivNeighborhood =
  | "Neve Tzedek"
  | "Florentin"
  | "Rothschild"
  | "Lev Ha'ir"
  | "Gordon Beach"
  | "Bograshov Beach"
  | "Dizengoff"
  | "Sarona"
  | "Jaffa"
  | "North Tel Aviv"
  | "Old North"
  | "Kerem HaTeimanim";

export interface Apartment {
  /** Stable URL-safe identifier */
  id: string;
  slug: string;
  name: string;
  city: string;
  neighborhood: TelAvivNeighborhood | string;
  /** Public street address when available — never expose internalSourceUrl */
  address?: string;
  shortDescription: string;
  fullDescription: string;
  guests: number;
  bedrooms: number;
  bathrooms: number;
  amenities: string[];
  tags: ApartmentTag[];
  images: ApartmentImage[];
  /** MD5 fingerprints for local images — used to avoid duplicate catalog heroes */
  imageFingerprints?: string[];
  /** 256-bit perceptual hashes for visual de-duplication in catalog grids */
  imageVisualHashes?: string[];
  /** Admin-only — never exposed on the public site */
  internalSourceUrl: string;
  source: ApartmentSource;
  featured: boolean;
  published: boolean;
  /** Set true when imported draft needs manual review */
  needsReview?: boolean;
  importedAt?: string;
}

export interface ApartmentImage {
  url: string;
  alt: string;
  /** Original CDN URL — used for catalog de-duplication, not shown publicly */
  sourceUrl?: string;
}

export interface ApartmentWithCatalogCover extends Apartment {
  catalogCoverIndex?: number;
}

export interface ApartmentCatalog {
  version: number;
  updatedAt: string;
  apartments: Apartment[];
}

export interface ApartmentFilters {
  neighborhood?: string;
  guests?: number;
  bedrooms?: number;
  bathrooms?: number;
  amenities?: string[];
  tags?: ApartmentTag[];
  q?: string;
}
