import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ApartmentGrid } from "@/components/apartments/ApartmentGrid";
import { FaqSection } from "@/components/seo/FaqSection";
import { Button, WhatsAppButton } from "@/components/ui/Button";
import { getApartmentCount, getFeaturedApartments } from "@/lib/apartments";
import { SITE } from "@/lib/constants";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Curated Tel Aviv Vacation Rentals & Apartments",
  description:
    "Core Rentals TLV — a privately curated catalog of 175+ vacation apartments in Tel Aviv, Israel. Browse handpicked stays in Neve Tzedek, Rothschild, Gordon Beach, and more. Request availability via concierge.",
  path: "/",
});

const HOME_FAQS = [
  {
    question: "What is Core Rentals TLV?",
    answer:
      "Core Rentals TLV is a boutique catalog of curated vacation apartments in Tel Aviv, Israel. Guests browse listings and request availability through a personal concierge — there is no on-site booking or payment.",
  },
  {
    question: "How many Tel Aviv apartments are in the catalog?",
    answer:
      "The catalog includes 175+ handpicked vacation apartments across Tel Aviv neighborhoods including Neve Tzedek, Rothschild, Florentin, Gordon Beach, Old North, and Jaffa.",
  },
  {
    question: "How do I request availability for a Tel Aviv apartment?",
    answer:
      "Browse the apartment catalog, select a property, and click Request Availability — or contact the team via the contact form or WhatsApp. A concierge confirms availability personally.",
  },
  {
    question: "Does Core Rentals TLV show prices or accept bookings online?",
    answer:
      "No. Core Rentals TLV is an inquiry-only catalog. It does not display nightly rates, calendars, or payment checkout. All stays are arranged through direct concierge communication.",
  },
];

const LOCATION_LINKS = [
  { href: "/guides/tel-aviv-vacation-rentals", label: "Tel Aviv Vacation Rentals" },
  { href: "/guides/tel-aviv-apartments", label: "Tel Aviv Apartments" },
  { href: "/guides/luxury-tel-aviv-stays", label: "Luxury Tel Aviv Stays" },
  { href: "/guides/rothschild-apartments", label: "Rothschild Apartments" },
  { href: "/guides/neve-tzedek-apartments", label: "Neve Tzedek Apartments" },
  { href: "/guides/beachfront-apartments-tel-aviv", label: "Beachfront Apartments" },
  { href: "/guides/family-apartments-tel-aviv", label: "Family Apartments" },
  { href: "/guides/business-travel-apartments-tel-aviv", label: "Business Travel Stays" },
];

export default function HomePage() {
  const featured = getFeaturedApartments(6);
  const count = getApartmentCount();

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1920&q=80"
            alt="Tel Aviv Mediterranean coastline — curated vacation rental apartments by Core Rentals TLV"
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-navy/55" />
        </div>

        <div className="relative mx-auto flex min-h-[85vh] max-w-7xl flex-col justify-center px-4 py-24 sm:px-6 lg:px-8">
          <p className="text-xs uppercase tracking-[0.3em] text-gold-light">
            Private Curated Catalog · Tel Aviv, Israel
          </p>
          <h1 className="mt-4 max-w-4xl font-serif text-4xl leading-tight text-cream sm:text-[2.75rem] lg:max-w-none lg:whitespace-nowrap lg:text-[3.25rem]">
            Tel Aviv stays, thoughtfully selected
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-cream/85 sm:text-lg">
            {SITE.tagline} Browse {count}+ handpicked Tel Aviv vacation
            apartments and reach out — we handle availability personally.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Button href="/apartments" variant="primary">
              Explore Apartments
            </Button>
            <Button
              href="/contact"
              variant="outline"
              className="border-cream/30 text-cream hover:border-cream hover:text-cream"
            >
              Request Availability
            </Button>
            <WhatsAppButton />
          </div>
        </div>
      </section>

      <section
        aria-labelledby="featured-heading"
        className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="mb-12 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-gold">
            Featured Collection
          </p>
          <h2
            id="featured-heading"
            className="mt-2 font-serif text-3xl text-navy sm:text-4xl"
          >
            Curated Tel Aviv vacation rentals
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted">
            Each residence in our Tel Aviv apartment catalog is personally vetted
            for location, design, and service quality. No booking widgets — just
            a direct line to our concierge team.
          </p>
        </div>
        <ApartmentGrid apartments={featured} />
        <div className="mt-12 text-center">
          <Button href="/apartments" variant="secondary">
            View Full Catalog ({count} apartments)
          </Button>
        </div>
      </section>

      <section
        aria-labelledby="areas-heading"
        className="border-y border-sand-dark/40 bg-sand/50 py-16"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 id="areas-heading" className="font-serif text-2xl text-navy">
            Explore Tel Aviv by stay type
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Neighborhood and travel-style guides to help you find the right Tel
            Aviv vacation rental.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {LOCATION_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block rounded-xl bg-cream px-4 py-3 text-sm text-navy transition-colors ring-1 ring-sand-dark/40 hover:text-mediterranean hover:ring-gold/30"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/about"
            className="mt-6 inline-block text-sm font-medium text-mediterranean hover:underline"
          >
            Learn about Core Rentals TLV →
          </Link>
        </div>
      </section>

      <section className="bg-navy py-20 text-cream">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
          {[
            {
              title: "Boutique curation",
              text: "Every Tel Aviv apartment is selected for its character, neighborhood, and professional management — not listed by the hundreds.",
            },
            {
              title: "Personal concierge",
              text: "Tell us your dates and preferences. We confirm availability and arrange your stay directly — no automated checkout.",
            },
            {
              title: "Tel Aviv expertise",
              text: "From Gordon Beach to Neve Tzedek, we know the neighborhoods that match your trip — family, corporate, or leisure.",
            },
          ].map((item) => (
            <div key={item.title}>
              <h3 className="font-serif text-xl text-gold-light">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-cream/75">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <FaqSection faqs={HOME_FAQS} />
      </section>
    </>
  );
}
