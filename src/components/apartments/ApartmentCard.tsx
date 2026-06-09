import Image from "next/image";
import Link from "next/link";
import type { Apartment } from "@/types/apartment";
import { TagBadge } from "@/components/ui/TagBadge";
import { apartmentWhatsAppMessage, inquiryUrl, whatsappUrl } from "@/lib/constants";
import { apartmentImageAlt } from "@/lib/seo";

interface ApartmentCardProps {
  apartment: Apartment;
  coverIndex?: number;
}

export function ApartmentCard({ apartment, coverIndex = 0 }: ApartmentCardProps) {
  const cover = apartment.images[coverIndex] ?? apartment.images[0];
  const whatsappMessage = apartmentWhatsAppMessage(apartment.name);

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl bg-cream shadow-sm ring-1 ring-sand-dark/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:ring-gold/30">
      <Link href={`/apartments/${apartment.slug}`} className="relative block">
        <div className="relative aspect-[4/3] overflow-hidden">
          {cover ? (
            <Image
              src={cover.url}
              alt={apartmentImageAlt(apartment, coverIndex)}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-sand-dark text-muted">
              No image
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-navy/50 via-transparent to-transparent opacity-60" />
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5">
            {apartment.tags.slice(0, 2).map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs uppercase tracking-[0.15em] text-muted">
          {apartment.neighborhood} · {apartment.city}
        </p>
        <Link href={`/apartments/${apartment.slug}`}>
          <h3 className="mt-1 font-serif text-xl text-navy transition-colors group-hover:text-mediterranean">
            {apartment.name}
          </h3>
        </Link>
        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted">
          {apartment.shortDescription}
        </p>

        <div className="mt-4 flex items-center gap-4 border-t border-sand-dark/60 pt-4 text-xs text-navy-light">
          <Stat icon="guests" value={apartment.guests} label="Guests" />
          <Stat icon="bed" value={apartment.bedrooms} label="Beds" />
          <Stat icon="bath" value={apartment.bathrooms} label="Baths" />
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Link
            href={inquiryUrl(apartment.name)}
            className="flex-1 rounded-full bg-mediterranean px-4 py-2.5 text-center text-xs font-medium tracking-wide text-cream transition-colors hover:bg-mediterranean-light"
          >
            Request Availability
          </Link>
          <a
            href={whatsappUrl(whatsappMessage)}
            rel="noopener noreferrer"
            className="flex-1 rounded-full border border-navy/15 px-4 py-2.5 text-center text-xs font-medium tracking-wide text-navy transition-colors hover:border-mediterranean hover:text-mediterranean"
          >
            WhatsApp
          </a>
        </div>
      </div>
    </article>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: "guests" | "bed" | "bath";
  value: number;
  label: string;
}) {
  const icons = {
    guests: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
      />
    ),
    bed: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
      />
    ),
    bath: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 12h19.5M2.25 12v6.75A2.25 2.25 0 004.5 20.25h15a2.25 2.25 0 002.25-2.25V12M2.25 12V9.75A2.25 2.25 0 014.5 7.5h15a2.25 2.25 0 012.25 2.25V12M6 7.5V4.875A1.125 1.125 0 017.125 3.75h9.75A1.125 1.125 0 0118 4.875V7.5"
      />
    ),
  };

  return (
    <div className="flex items-center gap-1.5" title={label}>
      <svg
        className="h-4 w-4 text-gold"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        aria-hidden
      >
        {icons[icon]}
      </svg>
      <span className="font-medium">{value}</span>
      <span className="text-muted">{label}</span>
    </div>
  );
}
