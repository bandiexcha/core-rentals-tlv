import Link from "next/link";
import { SITE } from "@/lib/constants";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/apartments", label: "Apartments" },
  { href: "/guides", label: "Guides" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-sand-dark/60 bg-cream/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex flex-col">
          <span className="font-serif text-xl tracking-wide text-navy transition-colors group-hover:text-mediterranean sm:text-2xl">
            {SITE.name}
          </span>
          <span className="hidden text-[10px] uppercase tracking-[0.2em] text-muted sm:block">
            Tel Aviv · Curated Stays
          </span>
        </Link>

        <nav aria-label="Main navigation" className="flex items-center gap-1 sm:gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-2 py-2 text-sm text-navy-light transition-colors hover:bg-sand-dark/50 hover:text-mediterranean sm:px-3"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
