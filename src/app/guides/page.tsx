import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { LOCATION_GUIDES } from "@/data/location-guides";
import { SITE } from "@/lib/constants";
import { breadcrumbSchema } from "@/lib/json-ld";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: `Tel Aviv Rental Guides | ${SITE.name}`,
  description:
    "Neighborhood and travel guides for Tel Aviv vacation rentals — beachfront stays, Rothschild apartments, family homes, luxury listings, and business travel.",
  path: "/guides",
});

export default function GuidesIndexPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Guides", path: "/guides" },
        ])}
      />
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Tel Aviv Guides" },
        ]}
      />

      <header className="mt-6 max-w-2xl">
        <p className="text-xs uppercase tracking-[0.25em] text-gold">Guides</p>
        <h1 className="mt-2 font-serif text-3xl text-navy sm:text-4xl">
          Tel Aviv Vacation Rental Guides
        </h1>
        <p className="mt-4 text-muted">
          Entity-rich guides to help travelers — and search engines — understand
          where to stay in Tel Aviv. Each guide links to matching apartments in
          the Core Rentals TLV catalog.
        </p>
      </header>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {LOCATION_GUIDES.map((guide) => (
          <article
            key={guide.slug}
            className="flex flex-col rounded-2xl bg-cream p-6 ring-1 ring-sand-dark/40"
          >
            <h2 className="font-serif text-xl text-navy">
              <Link
                href={`/guides/${guide.slug}`}
                className="hover:text-mediterranean"
              >
                {guide.title}
              </Link>
            </h2>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">
              {guide.intro.slice(0, 160)}…
            </p>
            <Link
              href={`/guides/${guide.slug}`}
              className="mt-4 text-sm font-medium text-mediterranean hover:underline"
            >
              Read guide →
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
