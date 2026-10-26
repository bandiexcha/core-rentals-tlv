import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApartmentGrid } from "@/components/apartments/ApartmentGrid";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { FaqSection } from "@/components/seo/FaqSection";
import { JsonLd } from "@/components/seo/JsonLd";
import { Button } from "@/components/ui/Button";
import {
  getAllCampaignSlugs,
  getCampaignBySlug,
} from "@/data/campaigns";
import { getApartmentsForGuide } from "@/lib/apartments";
import { withCatalogCovers } from "@/lib/catalog-images";
import { faqSchema } from "@/lib/json-ld";
import { buildPageMetadata } from "@/lib/seo";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllCampaignSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const campaign = getCampaignBySlug(slug);
  if (!campaign) return { title: "Campaign Not Found" };
  return buildPageMetadata({
    title: campaign.metaTitle,
    description: campaign.metaDescription,
    path: `/campaigns/${slug}`,
  });
}

export default async function CampaignPage({ params }: PageProps) {
  const { slug } = await params;
  const campaign = getCampaignBySlug(slug);
  if (!campaign) notFound();

  const apartments = withCatalogCovers(
    getApartmentsForGuide({
      neighborhoods: campaign.neighborhoods,
      tag: campaign.tag,
      limit: 6,
    })
  );

  const contactHref = `/contact?campaign=${encodeURIComponent(campaign.utmCampaign)}&utm_campaign=${encodeURIComponent(campaign.utmCampaign)}&utm_source=website&utm_medium=campaign_page&destination=${encodeURIComponent("Tel Aviv")}`;

  const catalogHref = campaign.neighborhoods?.length
    ? `/apartments?neighborhood=${encodeURIComponent(campaign.neighborhoods[0])}`
    : campaign.tag
      ? `/apartments?tags=${campaign.tag}`
      : "/apartments";

  return (
    <article className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <JsonLd data={faqSchema(campaign.faqs)} />
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Campaigns", path: "/campaigns" },
          { name: campaign.title },
        ]}
      />

      <header className="mt-6 max-w-3xl">
        <p className="text-xs uppercase tracking-[0.25em] text-gold">
          {campaign.audience}
        </p>
        <h1 className="mt-2 font-serif text-3xl text-navy sm:text-4xl">
          {campaign.h1}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          {campaign.intro}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href={contactHref}>{campaign.ctaLabel}</Button>
          <Button href={catalogHref} variant="secondary">
            Browse catalog
          </Button>
        </div>
      </header>

      <div className="prose prose-navy mt-10 max-w-3xl">
        {campaign.body.map((paragraph, i) => (
          <p key={i} className="mb-4 leading-relaxed text-muted">
            {paragraph}
          </p>
        ))}
      </div>

      {apartments.length > 0 && (
        <section className="mt-14">
          <h2 className="font-serif text-2xl text-navy">
            Sample apartments from the catalog
          </h2>
          <p className="mt-2 text-sm text-muted">
            Real published inventory only. Availability is confirmed after you
            inquire — never assumed on this page.
          </p>
          <div className="mt-6">
            <ApartmentGrid apartments={apartments} />
          </div>
        </section>
      )}

      <section className="mt-14 max-w-3xl">
        <h2 className="font-serif text-2xl text-navy">Related pages</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {campaign.internalLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="text-mediterranean hover:underline">
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/contact" className="text-mediterranean hover:underline">
              Request availability
            </Link>
          </li>
        </ul>
      </section>

      <div className="mt-14 max-w-3xl">
        <FaqSection faqs={campaign.faqs} />
      </div>

      <div className="mt-12 rounded-2xl bg-navy px-6 py-8 text-center text-cream">
        <h2 className="font-serif text-2xl text-gold-light">
          Ready to request availability?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-cream/75">
          Your campaign source is preserved through the inquiry form so our
          team can follow up with the right context.
        </p>
        <div className="mt-6">
          <Button href={contactHref}>{campaign.ctaLabel}</Button>
        </div>
      </div>
    </article>
  );
}
