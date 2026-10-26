import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { CAMPAIGN_PAGES } from "@/data/campaigns";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Accommodation Campaigns | Tel Aviv Furnished Apartments",
  description:
    "Campaign destinations for corporate, relocation, film crews, holiday visits, and extended stays in Tel Aviv — request availability via Core Rentals TLV.",
  path: "/campaigns",
});

export default function CampaignsIndexPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Campaigns" },
        ]}
      />
      <header className="mt-6 max-w-3xl">
        <p className="text-xs uppercase tracking-[0.25em] text-gold">
          Acquisition destinations
        </p>
        <h1 className="mt-2 font-serif text-3xl text-navy sm:text-4xl">
          Tel Aviv accommodation campaigns
        </h1>
        <p className="mt-4 text-muted">
          Each page leads into the same request-and-quote process. No public
          prices. No instant booking.
        </p>
      </header>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CAMPAIGN_PAGES.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/campaigns/${c.slug}`}
              className="block rounded-2xl bg-cream p-5 ring-1 ring-sand-dark/40 transition hover:ring-mediterranean/40"
            >
              <h2 className="font-serif text-xl text-navy">{c.title}</h2>
              <p className="mt-2 text-sm text-muted">{c.audience}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
