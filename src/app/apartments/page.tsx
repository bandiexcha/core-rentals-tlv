import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ApartmentCatalogClient } from "@/components/apartments/ApartmentCatalogClient";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getAllApartments,
  getApartmentCount,
} from "@/lib/apartments";
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
  const city = typeof params.city === "string" ? params.city : undefined;
  const count = getApartmentCount();

  if (neighborhood) {
    return buildPageMetadata({
      title: `${neighborhood} Tel Aviv Vacation Apartments`,
      description: `Browse curated vacation apartments in ${neighborhood}, Tel Aviv, Israel. ${count}+ listings with photos, amenities, and capacity. Request availability via Core Rentals TLV.`,
      path: `/apartments?neighborhood=${encodeURIComponent(neighborhood)}`,
    });
  }

  if (city) {
    return buildPageMetadata({
      title: `${city} Vacation Apartments`,
      description: `Browse curated vacation apartments in ${city}. ${count}+ listings with photos, amenities, and capacity. Request availability via Core Rentals TLV.`,
      path: `/apartments?city=${encodeURIComponent(city)}`,
    });
  }

  return buildPageMetadata({
    title: "Tel Aviv Apartment Catalog | Vacation Rentals",
    description: `Browse ${count}+ curated Tel Aviv vacation apartments. Filter by city, neighborhood, guests, bedrooms, amenities, and tags. Core Rentals TLV — inquiry-only boutique catalog in Israel.`,
    path: "/apartments",
  });
}

export default async function ApartmentsPage({ searchParams }: PageProps) {
  await searchParams;
  const apartments = withCatalogCovers(getAllApartments(), {
    reorder: true,
  });
  const totalCount = getApartmentCount();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <JsonLd
        data={itemListSchema(
          "Tel Aviv Vacation Apartment Catalog",
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
          Tel Aviv Apartments
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          Find any apartment in seconds — filter by city, neighborhood, and
          exact bedroom count. Explore our{" "}
          <Link href="/guides" className="text-mediterranean hover:underline">
            Tel Aviv area guides
          </Link>{" "}
          for neighborhood tips.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="h-96 animate-pulse rounded-2xl bg-cream" />
        }
      >
        <ApartmentCatalogClient
          apartments={apartments}
          totalCount={totalCount}
        />
      </Suspense>
    </div>
  );
}
