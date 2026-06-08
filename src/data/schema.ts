/**
 * Apartment catalog JSON schema reference for admin editing.
 * Data file: src/data/apartments.json
 */
export interface ApartmentCatalogSchema {
  version: number;
  updatedAt: string;
  apartments: Array<{
    id: string;
    slug: string;
    name: string;
    city: string;
    neighborhood: string;
    shortDescription: string;
    fullDescription: string;
    guests: number;
    bedrooms: number;
    bathrooms: number;
    amenities: string[];
    tags: Array<"sea-view" | "city-view" | "luxury" | "family" | "corporate">;
    images: Array<{ url: string; alt: string }>;
    /** Admin-only — never shown on the public website */
    internalSourceUrl: string;
    source: "seanrent" | "holyguest" | "manual";
    featured: boolean;
    published: boolean;
    needsReview?: boolean;
    importedAt?: string;
  }>;
}
