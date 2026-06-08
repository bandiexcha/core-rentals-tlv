import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { WhatsAppButton } from "@/components/ui/Button";
import { ContactForm } from "@/components/contact/ContactForm";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { FaqSection } from "@/components/seo/FaqSection";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Request Availability | Tel Aviv Vacation Rentals",
  description:
    "Request availability for curated Tel Aviv vacation apartments. Share your dates, group size, and preferences — Core Rentals TLV concierge responds via WhatsApp.",
  path: "/contact",
});

const CONTACT_FAQS = [
  {
    question: "How do I request availability at Core Rentals TLV?",
    answer:
      "Fill out the contact form with your dates, group size, and apartment preferences — or message the team on WhatsApp. A concierge responds with available options from the Tel Aviv catalog.",
  },
  {
    question: "How quickly will I receive a response?",
    answer:
      "The concierge team typically responds within one business day. WhatsApp inquiries often receive a faster initial reply.",
  },
  {
    question: "Can I inquire about a specific apartment?",
    answer:
      "Yes. Visit any apartment page and click Request Availability to pre-fill the apartment name, or mention it in the contact form notes.",
  },
  {
    question: "Does Core Rentals TLV process payments on this website?",
    answer:
      "No. This site is inquiry-only. Payment and booking arrangements are handled directly with the concierge team after availability is confirmed.",
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Contact" },
        ]}
      />

      <div className="mx-auto mt-6 max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-gold">Contact</p>
        <h1 className="mt-2 font-serif text-3xl text-navy sm:text-4xl">
          Request Availability
        </h1>
        <p className="mt-4 text-muted">
          Tell us about your Tel Aviv trip — dates, group size, and preferences.
          We&apos;ll respond with available options from our curated catalog of
          vacation apartments.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-4xl gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Suspense>
            <ContactForm />
          </Suspense>
        </div>

        <aside className="rounded-2xl bg-navy p-6 text-cream lg:col-span-2">
          <h2 className="font-serif text-xl text-gold-light">
            Prefer a quick chat?
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-cream/75">
            Message us on WhatsApp for immediate assistance. Share your dates
            and we&apos;ll suggest the best matches from our Tel Aviv collection.
          </p>
          <WhatsAppButton className="mt-6 w-full" />

          <p className="mt-8 text-xs leading-relaxed text-cream/60">
            Learn more about our curation process on the{" "}
            <Link href="/about" className="text-gold-light hover:underline">
              About page
            </Link>
            .
          </p>
        </aside>
      </div>

      <div className="mx-auto mt-16 max-w-3xl">
        <FaqSection faqs={CONTACT_FAQS} />
      </div>
    </div>
  );
}
