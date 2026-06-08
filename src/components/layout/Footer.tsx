import Link from "next/link";
import { SITE, whatsappUrl } from "@/lib/constants";

const exploreLinks = [
  { href: "/apartments", label: "Apartment Catalog" },
  { href: "/guides", label: "Tel Aviv Guides" },
  { href: "/guides/tel-aviv-vacation-rentals", label: "Vacation Rentals" },
  { href: "/guides/beachfront-apartments-tel-aviv", label: "Beachfront Stays" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Request Availability" },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-sand-dark bg-navy text-cream">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <p className="font-serif text-2xl">{SITE.name}</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-cream/70">
              {SITE.tagline} Curated vacation apartments in Tel Aviv-Yafo,
              Israel.
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold">
              Explore
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {exploreLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-gold-light">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold">
              Contact
            </p>
            <ul className="mt-4 space-y-2 text-sm text-cream/80">
              <li>
                <a
                  href={whatsappUrl()}
                  rel="noopener noreferrer"
                  className="hover:text-gold-light"
                >
                  WhatsApp Concierge
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-cream/10 pt-6 text-center text-xs text-cream/50">
          © {new Date().getFullYear()} {SITE.name}. Curated Tel Aviv vacation
          rentals · Tel Aviv-Yafo, Israel
        </div>
      </div>
    </footer>
  );
}
