import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Button, WhatsAppButton } from "@/components/ui/Button";
import { TagBadge } from "@/components/ui/TagBadge";
import { ApartmentLocationMap } from "@/components/apartments/ApartmentLocationMap";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { getAllApartments, getApartmentBySlug } from "@/lib/apartments";
import { apartmentWhatsAppMessage, inquiryUrl } from "@/lib/constants";
import { vacationRentalSchema } from "@/lib/json-ld";
import {
  apartmentImageAlt,
  apartmentMetaDescription,
  apartmentMetaTitle,
  absoluteUrl,
  buildPageMetadata,
} from "@/lib/seo";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllApartments().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const apartment = getApartmentBySlug(slug);
  if (!apartment) return { title: "Apartment Not Found" };

  const cover = apartment.images[0];
  const image = cover?.url.startsWith("http")
    ? cover.url
    : absoluteUrl(cover?.url ?? "/");

  return buildPageMetadata({
    title: apartmentMetaTitle(apartment),
    description: apartmentMetaDescription(apartment),
    path: `/apartments/${slug}`,
    image,
    type: "article",
  });
}

export default async function ApartmentDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const apartment = getApartmentBySlug(slug);
  if (!apartment) notFound();

  const whatsappMessage = apartmentWhatsAppMessage(apartment.name);
  const neighborhoodGuide = `/apartments?neighborhood=${encodeURIComponent(apartment.neighborhood)}`;

  return (
    <article itemScope itemType="https://schema.org/VacationRental">
      <JsonLd data={vacationRentalSchema(apartment)} />
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { name: "Home", path: "/" },
            { name: "Apartments", path: "/apartments" },
            { name: apartment.name },
          ]}
        />
      </div>

      <div className="relative h-[50vh] min-h-[320px] lg:h-[60vh]">
        {apartment.images[0] && (
          <Image
            src={apartment.images[0].url}
            alt={apartmentImageAlt(apartment, 0)}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-navy/70 via-navy/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
          <div className="mx-auto max-w-7xl">
            <Link
              href="/apartments"
              className="text-xs uppercase tracking-wider text-cream/70 hover:text-cream"
            >
              ← Back to catalog
            </Link>
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-gold-light">
              <Link href={neighborhoodGuide} className="hover:text-cream">
                {apartment.neighborhood}
              </Link>
              {" · "}
              {apartment.city}, Israel
            </p>
            <h1
              className="mt-2 font-serif text-3xl text-cream sm:text-5xl"
              itemProp="name"
            >
              {apartment.name}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2">
              {apartment.tags.map((tag) => (
                <TagBadge key={tag} tag={tag} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <p
              className="text-lg leading-relaxed text-navy-light"
              itemProp="description"
            >
              {apartment.shortDescription}
            </p>

            <div className="mt-8 grid grid-cols-3 gap-4 rounded-2xl bg-cream p-6 ring-1 ring-sand-dark/40">
              <DetailStat label="Guests" value={String(apartment.guests)} />
              <DetailStat label="Bedrooms" value={String(apartment.bedrooms)} />
              <DetailStat
                label="Bathrooms"
                value={String(apartment.bathrooms)}
              />
            </div>

            <section aria-labelledby="about-property" className="mt-10">
              <h2 id="about-property" className="font-serif text-xl text-navy">
                About this Tel Aviv vacation rental
              </h2>
              <div className="prose prose-navy mt-4 max-w-none">
                {apartment.fullDescription.split("\n\n").map((paragraph, i) => (
                  <p key={i} className="mb-4 leading-relaxed text-muted">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>

            {apartment.images.length > 1 && (
              <section aria-labelledby="photos-heading" className="mt-10">
                <h2 id="photos-heading" className="sr-only">
                  Apartment photos
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {apartment.images.slice(1).map((image, i) => (
                    <div
                      key={i}
                      className="relative aspect-[4/3] overflow-hidden rounded-2xl"
                    >
                      <Image
                        src={image.url}
                        alt={apartmentImageAlt(apartment, i + 1)}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, 50vw"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section aria-labelledby="amenities-heading" className="mt-10">
              <h2 id="amenities-heading" className="font-serif text-xl text-navy">
                Amenities
              </h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {apartment.amenities.map((amenity) => (
                  <li
                    key={amenity}
                    className="flex items-center gap-2 text-sm text-navy-light"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                    {amenity}
                  </li>
                ))}
              </ul>
            </section>

            <ApartmentLocationMap
              address={apartment.address}
              neighborhood={apartment.neighborhood}
              city={apartment.city}
            />

            <p className="mt-10 text-sm text-muted">
              Looking for more in{" "}
              <Link href={neighborhoodGuide} className="text-mediterranean hover:underline">
                {apartment.neighborhood}
              </Link>
              ? Browse all{" "}
              <Link href="/guides/tel-aviv-vacation-rentals" className="text-mediterranean hover:underline">
                Tel Aviv vacation rentals
              </Link>{" "}
              or read our{" "}
              <Link href="/about" className="text-mediterranean hover:underline">
                about page
              </Link>
              .
            </p>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl bg-cream p-6 ring-1 ring-sand-dark/40">
              <h2 className="font-serif text-xl text-navy">
                Interested in this apartment?
              </h2>
              <p className="mt-2 text-sm text-muted">
                Share your travel dates and group size. Our concierge team will
                confirm availability and respond within one business day.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <Button
                  href={inquiryUrl(apartment.name)}
                  variant="primary"
                  className="w-full"
                >
                  Request Availability
                </Button>
                <WhatsAppButton message={whatsappMessage} className="w-full" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </article>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="font-serif text-2xl text-mediterranean">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}
