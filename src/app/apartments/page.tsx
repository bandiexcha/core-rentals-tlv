import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ApartmentFilters } from "@/components/apartments/ApartmentFilters";
import { ApartmentGrid } from "@/components/apartments/ApartmentGrid";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { getApartmentCount, filterApartments, parseSearchParams } from "@/lib/apartments";
import { withCatalogCovers } from "@/lib/catalog-images";
import { itemListSchema } from "@/lib/json-ld";
import { buildPageMetadata } from "@/lib/seo";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const neighborhood =
    typeof params.neighborhood === "string" ? params.neighborhood : undefined;
  const count = getApartmentCount();

  if (neighborhood) {
    return buildPageMetadata({
      title: `${neighborhood} Tel Aviv Vacation Apartments`,
      description: `Browse curated vacation apartments in ${neighborhood}, Tel Aviv, Israel. ${count}+ listings with photos, amenities, and capacity. Request availability via Core Rentals TLV.`,
      path: `/apartments?neighborhood=${encodeURIComponent(neighborhood)}`,
    });
  }

  return buildPageMetadata({
    title: "Tel Aviv Apartment Catalog | Vacation Rentals",
    description: `Browse ${count}+ curated Tel Aviv vacation apartments. Filter by neighborhood, guests, bedrooms, amenities, and tags. Core Rentals TLV — inquiry-only boutique catalog in Israel.`,
    path: "/apartments",
  });
}

export default async function ApartmentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseSearchParams(params);
  const apartments = withCatalogCovers(filterApartments(filters), {
    reorder: true,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <JsonLd
        data={itemListSchema(
          filters.neighborhood
            ? `${filters.neighborhood} Tel Aviv Apartments`
            : "Tel Aviv Vacation Apartment Catalog",
          apartments,
          "/apartments"
        )}
      />
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Apartments" },
        ]}
      />

      <div className="mb-10 mt-6">
        <p className="text-xs uppercase tracking-[0.25em] text-gold">
          Catalog
        </p>
        <h1 className="mt-2 font-serif text-3xl text-navy sm:text-4xl">
          {filters.neighborhood
            ? `${filters.neighborhood} — Tel Aviv Apartments`
            : "Tel Aviv Apartments"}
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          Filter by neighborhood, capacity, and amenities. When you find the
          right fit, request availability — we respond personally. Explore our{" "}
          <Link href="/guides" className="text-mediterranean hover:underline">
            Tel Aviv area guides
          </Link>{" "}
          for neighborhood tips.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-cream" />}>
          <ApartmentFilters />
        </Suspense>

        <div>
          <p className="mb-6 text-sm text-muted" aria-live="polite">
            {apartments.length}{" "}
            {apartments.length === 1 ? "apartment" : "apartments"} in Tel Aviv
          </p>
          <ApartmentGrid apartments={apartments} />
        </div>
      </div>
    </div>
  );
}
