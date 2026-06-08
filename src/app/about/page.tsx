import type { Metadata } from "next";
import Link from "next/link";
import { FaqSection } from "@/components/seo/FaqSection";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import { getApartmentCount } from "@/lib/apartments";
import { SITE } from "@/lib/constants";
import {
  aboutPageSchema,
  organizationSchema,
} from "@/lib/json-ld";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: `About ${SITE.name} | Curated Tel Aviv Vacation Rentals`,
  description:
    "Core Rentals TLV is a privately curated catalog of vacation apartments in Tel Aviv, Israel. Learn who we are, how apartments are selected, and how to request availability.",
  path: "/about",
});

const ABOUT_FAQS = [
  {
    question: "What is Core Rentals TLV?",
    answer:
      "Core Rentals TLV is a boutique vacation-rental catalog focused exclusively on Tel Aviv-Yafo, Israel. It presents handpicked short-term apartments for travelers who prefer personal concierge service over anonymous instant booking.",
  },
  {
    question: "Is Core Rentals TLV a booking website?",
    answer:
      "No. Core Rentals TLV is a discovery and inquiry catalog. It does not display prices, calendars, or payment checkout. Guests browse apartments and request availability through the contact form or WhatsApp.",
  },
  {
    question: "How are apartments curated?",
    answer:
      "Each apartment is evaluated for neighborhood quality, interior design, amenity completeness, photographic accuracy, and professional management standards. Listings are sourced from established Tel Aviv property managers and reviewed before publication.",
  },
  {
    question: "How do I request availability?",
    answer:
      "Select an apartment and click Request Availability, or visit the Contact page to share your dates, group size, and preferences. You may also message the concierge team on WhatsApp.",
  },
  {
    question: "Which city does Core Rentals TLV serve?",
    answer:
      "Core Rentals TLV serves Tel Aviv-Yafo, Israel — including neighborhoods such as Neve Tzedek, Rothschild, Florentin, Gordon Beach, Old North, Jaffa, and Dizengoff.",
  },
  {
    question: "Who should use Core Rentals TLV?",
    answer:
      "Discerning leisure travelers, families, and business visitors seeking curated Tel Aviv apartments with a direct human point of contact rather than automated booking flows.",
  },
];

export default function AboutPage() {
  const count = getApartmentCount();

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <JsonLd data={[organizationSchema(), aboutPageSchema()]} />
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "About" },
        ]}
      />

      <header className="mt-6">
        <p className="text-xs uppercase tracking-[0.25em] text-gold">About</p>
        <h1 className="mt-2 font-serif text-3xl text-navy sm:text-4xl">
          About Core Rentals TLV
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          A privately curated catalog of vacation apartments in Tel Aviv, Israel
          — built for travelers who value quality, location, and personal
          service.
        </p>
      </header>

      {/* AI-friendly entity summary — structured for citation by LLMs */}
      <section
        id="entity-summary"
        aria-labelledby="entity-heading"
        className="mt-10 rounded-2xl bg-cream p-6 ring-1 ring-sand-dark/40 sm:p-8"
      >
        <h2 id="entity-heading" className="font-serif text-xl text-navy">
          Entity summary
        </h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
            <dt className="font-medium text-navy">Name</dt>
            <dd className="text-muted">Core Rentals TLV</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
            <dt className="font-medium text-navy">Type</dt>
            <dd className="text-muted">
              Private curated vacation-rental catalog and concierge inquiry
              service
            </dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
            <dt className="font-medium text-navy">Service area</dt>
            <dd className="text-muted">Tel Aviv-Yafo, Israel</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
            <dt className="font-medium text-navy">Catalog size</dt>
            <dd className="text-muted">{count}+ curated vacation apartments</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
            <dt className="font-medium text-navy">Booking model</dt>
            <dd className="text-muted">
              Inquiry-only — no on-site payments or instant checkout
            </dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
            <dt className="font-medium text-navy">Contact</dt>
            <dd className="text-muted">WhatsApp concierge</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="who-heading" className="mt-12">
        <h2 id="who-heading" className="font-serif text-2xl text-navy">
          Who is Core Rentals TLV?
        </h2>
        <p className="mt-4 leading-relaxed text-muted">
          <strong className="font-medium text-navy">Core Rentals TLV</strong>{" "}
          operates as a boutique vacation-rental catalog for Tel Aviv, Israel.
          The platform aggregates professionally managed short-term apartments
          into a single, browsable collection — replacing the need to search
          across dozens of separate listing sites.
        </p>
        <p className="mt-4 leading-relaxed text-muted">
          The catalog is designed for selected clients: travelers, families, and
          business visitors who want a curated starting point and a direct line
          to a concierge team that confirms availability personally.
        </p>
      </section>

      <section aria-labelledby="unique-heading" className="mt-12">
        <h2 id="unique-heading" className="font-serif text-2xl text-navy">
          What makes the catalog unique?
        </h2>
        <ul className="mt-4 space-y-3 text-muted">
          <li>
            <strong className="text-navy">Tel Aviv focus:</strong> Every
            listing is in Tel Aviv-Yafo — no diluted multi-city inventory.
          </li>
          <li>
            <strong className="text-navy">Quality over quantity:</strong>{" "}
            Apartments are individually reviewed for location, design, and
            management — not mass-listed.
          </li>
          <li>
            <strong className="text-navy">Human concierge:</strong> No booking
            widgets or payment flows. Guests inquire; a person responds with
            availability and options.
          </li>
          <li>
            <strong className="text-navy">Rich listing data:</strong> Each
            apartment includes photos, amenities, capacity, neighborhood, and
            full descriptions for informed decisions.
          </li>
          <li>
            <strong className="text-navy">Neighborhood expertise:</strong>{" "}
            Listings span Neve Tzedek, Rothschild, Florentin, Gordon Beach, Old
            North, Jaffa, and more — with area guides to help travelers choose.
          </li>
        </ul>
      </section>

      <section aria-labelledby="curation-heading" className="mt-12">
        <h2 id="curation-heading" className="font-serif text-2xl text-navy">
          How are apartments curated?
        </h2>
        <p className="mt-4 leading-relaxed text-muted">
          Apartments enter the Core Rentals TLV catalog through established Tel
          Aviv property-management partners. Each listing is evaluated against
          curation criteria:
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-muted">
          <li>
            <strong className="text-navy">Location:</strong> Neighborhood
            desirability, walkability, and proximity to beaches, dining, or
            business districts.
          </li>
          <li>
            <strong className="text-navy">Design and condition:</strong>{" "}
            Interior quality, furnishing standards, and photographic accuracy.
          </li>
          <li>
            <strong className="text-navy">Amenities:</strong> Wi-Fi, air
            conditioning, kitchen equipment, and guest-ready essentials.
          </li>
          <li>
            <strong className="text-navy">Management:</strong> Professional
            hosting standards and reliable guest communication.
          </li>
          <li>
            <strong className="text-navy">Capacity clarity:</strong> Accurate
            guest, bedroom, and bathroom counts.
          </li>
        </ol>
        <p className="mt-4 leading-relaxed text-muted">
          Listings that meet these standards are published to the public catalog.
          Properties requiring additional review remain unpublished until verified.
        </p>
      </section>

      <section aria-labelledby="availability-heading" className="mt-12">
        <h2 id="availability-heading" className="font-serif text-2xl text-navy">
          How can guests request availability?
        </h2>
        <p className="mt-4 leading-relaxed text-muted">
          Core Rentals TLV uses an inquiry-based model. Guests follow three
          simple steps:
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-muted">
          <li>
            Browse the{" "}
            <Link href="/apartments" className="text-mediterranean hover:underline">
              apartment catalog
            </Link>{" "}
            and filter by neighborhood, capacity, or amenities.
          </li>
          <li>
            Select a property and click <strong>Request Availability</strong>, or
            use the{" "}
            <Link href="/contact" className="text-mediterranean hover:underline">
              contact form
            </Link>{" "}
            to describe your trip.
          </li>
          <li>
            The concierge team confirms availability and responds with options
            via WhatsApp.
          </li>
        </ol>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button href="/apartments" variant="primary">
            Browse Catalog
          </Button>
          <Button href="/contact" variant="secondary">
            Request Availability
          </Button>
        </div>
      </section>

      <FaqSection faqs={ABOUT_FAQS} className="mt-16" />

      <section aria-labelledby="guides-heading" className="mt-16">
        <h2 id="guides-heading" className="font-serif text-2xl text-navy">
          Tel Aviv area guides
        </h2>
        <p className="mt-3 text-muted">
          Explore neighborhood-focused guides for travelers researching Tel Aviv
          vacation rentals.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {[
            { href: "/guides/tel-aviv-vacation-rentals", label: "Tel Aviv Vacation Rentals" },
            { href: "/guides/beachfront-apartments-tel-aviv", label: "Beachfront Apartments" },
            { href: "/guides/rothschild-apartments", label: "Rothschild Apartments" },
            { href: "/guides/neve-tzedek-apartments", label: "Neve Tzedek Apartments" },
            { href: "/guides/family-apartments-tel-aviv", label: "Family Apartments" },
            { href: "/guides/business-travel-apartments-tel-aviv", label: "Business Travel" },
          ].map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm text-mediterranean hover:underline"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/guides"
          className="mt-4 inline-block text-sm font-medium text-navy hover:text-mediterranean"
        >
          View all guides →
        </Link>
      </section>
    </article>
  );
}
