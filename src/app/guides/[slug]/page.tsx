import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApartmentGrid } from "@/components/apartments/ApartmentGrid";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { FaqSection } from "@/components/seo/FaqSection";
import { JsonLd } from "@/components/seo/JsonLd";
import { Button } from "@/components/ui/Button";
import {
  getAllGuideSlugs,
  getGuideBySlug,
} from "@/data/location-guides";
import { getApartmentsForGuide } from "@/lib/apartments";
import { faqSchema } from "@/lib/json-ld";
import { buildPageMetadata } from "@/lib/seo";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllGuideSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) return { title: "Guide Not Found" };
  return buildPageMetadata({
    title: guide.metaTitle,
    description: guide.metaDescription,
    path: `/guides/${slug}`,
    type: "article",
  });
}

export default async function GuidePage({ params }: PageProps) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) notFound();

  const apartments = getApartmentsForGuide({
    neighborhoods: guide.neighborhoods,
    tag: guide.tag,
    limit: 6,
  });

  const catalogHref = guide.neighborhoods?.length
    ? `/apartments?neighborhood=${encodeURIComponent(guide.neighborhoods[0])}`
    : guide.tag
      ? `/apartments?tags=${guide.tag}`
      : "/apartments";

  return (
    <article className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <JsonLd data={faqSchema(guide.faqs)} />
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Guides", path: "/guides" },
          { name: guide.title },
        ]}
      />

      <header className="mt-6 max-w-3xl">
        <p className="text-xs uppercase tracking-[0.25em] text-gold">
          Tel Aviv Guide
        </p>
        <h1 className="mt-2 font-serif text-3xl text-navy sm:text-4xl">
          {guide.h1}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">{guide.intro}</p>
      </header>

      <div className="prose prose-navy mt-10 max-w-3xl">
        {guide.body.map((paragraph, i) => (
          <p key={i} className="mb-4 leading-relaxed text-muted">
            {paragraph}
          </p>
        ))}
      </div>

      {apartments.length > 0 && (
        <section aria-labelledby="listings-heading" className="mt-16">
          <h2 id="listings-heading" className="font-serif text-2xl text-navy">
            Matching apartments in the catalog
          </h2>
          <p className="mt-2 text-sm text-muted">
            A selection of curated listings relevant to this guide.{" "}
            <Link href={catalogHref} className="text-mediterranean hover:underline">
              View all matching apartments
            </Link>
            .
          </p>
          <div className="mt-8">
            <ApartmentGrid apartments={apartments} />
          </div>
        </section>
      )}

      <section aria-labelledby="related-heading" className="mt-16">
        <h2 id="related-heading" className="font-serif text-xl text-navy">
          Related topics
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {guide.keywords.map((kw) => (
            <li
              key={kw}
              className="rounded-full bg-sand px-3 py-1 text-xs text-navy-light"
            >
              {kw}
            </li>
          ))}
        </ul>
      </section>

      <FaqSection faqs={guide.faqs} className="mt-16" />

      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
        <Button href={catalogHref} variant="primary">
          Browse Apartments
        </Button>
        <Button href="/contact" variant="secondary">
          Request Availability
        </Button>
      </div>
    </article>
  );
}
