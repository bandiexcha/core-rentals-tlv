import type { ApartmentTag } from "@/types/apartment";
import type { FaqItem } from "@/lib/json-ld";

export interface CampaignPage {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  body: string[];
  audience: string;
  utmCampaign: string;
  ctaLabel: string;
  neighborhoods?: string[];
  tag?: ApartmentTag;
  faqs: FaqItem[];
  internalLinks: { href: string; label: string }[];
}

/**
 * Conversion-focused campaign destinations. Content uses only verified
 * catalog services (request-and-quote) — no fabricated partnerships,
 * prices, availability, or testimonials.
 */
export const CAMPAIGN_PAGES: CampaignPage[] = [
  {
    slug: "corporate-accommodation-tel-aviv",
    title: "Corporate Accommodation Tel Aviv",
    metaTitle: "Corporate Accommodation in Tel Aviv | Furnished Apartments",
    metaDescription:
      "Request corporate accommodation in Tel Aviv from Core Rentals TLV. Curated furnished apartments for business travelers — concierge availability and quotes, no instant booking.",
    h1: "Corporate Accommodation in Tel Aviv",
    intro:
      "Core Rentals TLV supports corporate travelers who need furnished apartments in Tel Aviv with a personal concierge — not an automated marketplace. Share your dates, team size, and location preferences; we respond with availability from our curated catalog.",
    body: [
      "Corporate stays often require workspace-ready apartments, reliable Wi-Fi, and neighborhoods convenient to business districts along Rothschild, Sarona, and the Old North. Our catalog includes residences tagged for corporate use where applicable, alongside family and longer-stay options.",
      "We do not publish public rental prices or process payments on this site. After you submit a request, our team confirms availability manually and prepares a quotation. This keeps arrangements accurate for employers, relocation desks, and travel managers.",
    ],
    audience: "Corporate travel managers and business travelers",
    utmCampaign: "corporate-accommodation-tel-aviv",
    ctaLabel: "Request corporate availability",
    tag: "corporate",
    faqs: [
      {
        question: "Can my company request multiple apartments?",
        answer:
          "Yes. Describe team size, dates, and neighborhood preferences in the inquiry form. The concierge prepares options from the curated catalog.",
      },
      {
        question: "Are prices listed online?",
        answer:
          "No. Core Rentals TLV is inquiry-only. Pricing is prepared after availability is checked for your dates.",
      },
    ],
    internalLinks: [
      { href: "/apartments?tags=corporate", label: "Corporate-tagged apartments" },
      { href: "/campaigns/relocation-employee-assignments", label: "Relocation stays" },
      { href: "/guides/tel-aviv-vacation-rentals", label: "Tel Aviv vacation rentals guide" },
    ],
  },
  {
    slug: "relocation-employee-assignments",
    title: "Relocation & Employee Assignments",
    metaTitle: "Tel Aviv Relocation Housing | Employee Assignment Apartments",
    metaDescription:
      "Furnished apartments in Tel Aviv for international employee assignments and relocation. Request availability through Core Rentals TLV concierge.",
    h1: "Relocation and International Employee Assignments",
    intro:
      "When employees relocate to Tel Aviv or arrive on temporary assignment, furnished apartments reduce setup friction. Core Rentals TLV helps HR and mobility teams request suitable options from a curated Tel Aviv catalog.",
    body: [
      "Tell us assignment length, preferred neighborhoods, bedroom count, and any workplace or school constraints. We match against published inventory and reply with availability — never guaranteed listings invented for marketing.",
      "Extended-stay needs are common for relocation. Browse the extended-stay campaign page as well, then submit one inquiry so attribution and requirements stay together.",
    ],
    audience: "HR, mobility, and relocating employees",
    utmCampaign: "relocation-employee-assignments",
    ctaLabel: "Request relocation housing",
    faqs: [
      {
        question: "Do you handle lease paperwork for employers?",
        answer:
          "Booking and contractual terms are arranged directly with the concierge after availability is confirmed. This website does not process contracts online.",
      },
    ],
    internalLinks: [
      { href: "/campaigns/corporate-accommodation-tel-aviv", label: "Corporate accommodation" },
      { href: "/campaigns/extended-stay-furnished-apartments", label: "Extended-stay apartments" },
      { href: "/apartments", label: "Full apartment catalog" },
    ],
  },
  {
    slug: "film-tv-crew-accommodation",
    title: "Film & TV Crew Accommodation",
    metaTitle: "Film & TV Crew Accommodation Tel Aviv | Group Apartments",
    metaDescription:
      "Request furnished apartments in Tel Aviv for film and television crews. Core Rentals TLV concierge coordinates availability for production schedules.",
    h1: "Film and Television Crew Accommodation",
    intro:
      "Production schedules need flexible housing for cast and crew. Core Rentals TLV can check curated Tel Aviv apartments against your shoot dates and guest counts — via the same request-and-quote process used for all clients.",
    body: [
      "Share call-sheet windows, unit count, and whether you need clustered neighborhoods or dispersed housing. We do not claim exclusive studio partnerships or invent capacity guarantees.",
      "Group inquiries are welcome. Use the notes field for production company name, department contacts, and any accessibility or parking requirements listed on apartment pages.",
    ],
    audience: "Production managers and location teams",
    utmCampaign: "film-tv-crew-accommodation",
    ctaLabel: "Request crew housing",
    faqs: [
      {
        question: "Can you house an entire crew?",
        answer:
          "We check real catalog inventory against your dates. Capacity depends on available apartments — not marketing promises.",
      },
    ],
    internalLinks: [
      { href: "/campaigns/international-delegations-group-travel", label: "Group travel" },
      { href: "/apartments", label: "Browse apartments" },
      { href: "/contact", label: "General inquiry" },
    ],
  },
  {
    slug: "israelis-abroad-family-visits",
    title: "Israelis Abroad Visiting Family",
    metaTitle: "Tel Aviv Apartments for Israelis Living Abroad | Family Visits",
    metaDescription:
      "Planning a family visit to Israel from abroad? Request curated Tel Aviv vacation apartments through Core Rentals TLV — personal concierge, no public prices.",
    h1: "Apartments for Israelis Living Abroad Visiting Family",
    intro:
      "Many Israelis living overseas need a comfortable base in Tel Aviv when visiting family. Core Rentals TLV offers a curated catalog and a simple request form so you can ask for dates that match school holidays, Passover, or summer trips.",
    body: [
      "Filter the catalog by bedrooms and neighborhoods near relatives, then request availability. WhatsApp is available if you prefer a quick conversation in Hebrew or English with the concierge team.",
      "Holiday peaks fill quickly. Submit preferred and flexible dates so we can check alternatives without inventing availability.",
    ],
    audience: "Israelis living abroad",
    utmCampaign: "israelis-abroad-family-visits",
    ctaLabel: "Request dates for a family visit",
    faqs: [
      {
        question: "Is this site only in English?",
        answer:
          "The website is in English. You may write inquiries in Hebrew or English; the concierge will respond accordingly.",
      },
    ],
    internalLinks: [
      { href: "/campaigns/passover-jewish-holiday-visits", label: "Passover & holiday visits" },
      { href: "/campaigns/summer-stays-tel-aviv", label: "Summer stays" },
      { href: "/guides/family-apartments-tel-aviv", label: "Family apartments guide" },
    ],
  },
  {
    slug: "summer-stays-tel-aviv",
    title: "Summer Stays Tel Aviv",
    metaTitle: "Summer Stays in Tel Aviv | Beach & City Vacation Apartments",
    metaDescription:
      "Plan a summer stay in Tel Aviv with Core Rentals TLV. Request availability for curated beach and city apartments — concierge quotes only.",
    h1: "Summer Stays in Tel Aviv",
    intro:
      "Summer in Tel Aviv means beach days, outdoor dining, and high seasonal demand. Use Core Rentals TLV to browse curated apartments and request availability for your summer dates.",
    body: [
      "Beachfront and Old North neighborhoods are popular in summer. Our guides and catalog filters help you shortlist apartments; we never display public rates or invent sold-out claims.",
      "Submit an inquiry early with check-in and check-out dates. The concierge confirms what is actually available in the catalog for those nights.",
    ],
    audience: "Summer leisure travelers",
    utmCampaign: "summer-stays-tel-aviv",
    ctaLabel: "Request summer availability",
    neighborhoods: ["Gordon Beach", "Bograshov Beach", "Old North"],
    faqs: [
      {
        question: "Do you offer summer discounts?",
        answer:
          "We do not advertise discounts on this site. Any pricing is prepared individually after availability is verified.",
      },
    ],
    internalLinks: [
      { href: "/guides/beachfront-apartments-tel-aviv", label: "Beachfront apartments" },
      { href: "/apartments", label: "Apartment catalog" },
      { href: "/campaigns/passover-jewish-holiday-visits", label: "Holiday visits" },
    ],
  },
  {
    slug: "passover-jewish-holiday-visits",
    title: "Passover & Jewish Holiday Visits",
    metaTitle: "Passover & Jewish Holiday Apartments in Tel Aviv",
    metaDescription:
      "Request Tel Aviv apartments for Passover and Jewish holiday visits. Core Rentals TLV concierge checks curated inventory for your holiday dates.",
    h1: "Passover and Jewish Holiday Visits",
    intro:
      "Holiday travel to Israel often centers on family gatherings and short stays in Tel Aviv. Request availability from our curated catalog for Passover and other Jewish holidays — without online booking or public pricing.",
    body: [
      "Some apartments note Shabbat-friendly amenities where listed. Always verify details with the concierge for your specific dates and household needs.",
      "Peak holidays require early inquiries. Provide flexible date ranges when possible so we can propose real alternatives from published inventory.",
    ],
    audience: "Holiday visitors and families",
    utmCampaign: "passover-jewish-holiday-visits",
    ctaLabel: "Request holiday dates",
    faqs: [
      {
        question: "Are apartments kosher or Shabbat-ready?",
        answer:
          "Amenity lists vary by apartment. Ask in your inquiry; we confirm against the specific listing rather than making blanket claims.",
      },
    ],
    internalLinks: [
      { href: "/campaigns/israelis-abroad-family-visits", label: "Visits from abroad" },
      { href: "/campaigns/summer-stays-tel-aviv", label: "Summer stays" },
      { href: "/contact", label: "Contact concierge" },
    ],
  },
  {
    slug: "international-delegations-group-travel",
    title: "International Delegations & Group Travel",
    metaTitle: "Group & Delegation Accommodation Tel Aviv",
    metaDescription:
      "Furnished apartments in Tel Aviv for international delegations and group travel. Request multi-unit availability via Core Rentals TLV.",
    h1: "International Delegations and Group Travel",
    intro:
      "Delegations and organized groups often need several apartments near each other. Core Rentals TLV reviews your headcount and dates against the curated catalog and responds with a coordinated quote request workflow.",
    body: [
      "Include organization name, arrival window, and whether units must be walking distance apart. We do not invent block bookings or institutional affiliations.",
      "For sports-related groups, see the sports events page; the inquiry process is the same so campaign attribution remains intact.",
    ],
    audience: "Delegation organizers and group travel leads",
    utmCampaign: "international-delegations-group-travel",
    ctaLabel: "Request group accommodation",
    faqs: [
      {
        question: "Is there a minimum group size?",
        answer:
          "No fixed minimum. Describe your needs; we check what the catalog can support for those dates.",
      },
    ],
    internalLinks: [
      { href: "/campaigns/film-tv-crew-accommodation", label: "Film & TV crews" },
      { href: "/campaigns/sports-events-accompanying-families", label: "Sports events" },
      { href: "/apartments", label: "Catalog" },
    ],
  },
  {
    slug: "sports-events-accompanying-families",
    title: "Sports Events & Accompanying Families",
    metaTitle: "Tel Aviv Apartments for Sports Events & Families",
    metaDescription:
      "Need apartments in Tel Aviv around sports events for athletes or accompanying families? Request availability through Core Rentals TLV concierge.",
    h1: "Sports Events and Accompanying Families",
    intro:
      "When tournaments or matches bring athletes and families to Tel Aviv, furnished apartments can be a practical base. Request dates and guest counts through our standard inquiry process.",
    body: [
      "We do not claim official event partnerships or ticket packages. This page simply routes sports-related housing requests into the same CRM pipeline with clear campaign attribution.",
      "Share venue area preferences if known; otherwise ask for central or beach neighborhoods from the published catalog.",
    ],
    audience: "Sports travelers and accompanying families",
    utmCampaign: "sports-events-accompanying-families",
    ctaLabel: "Request event-week housing",
    tag: "family",
    faqs: [
      {
        question: "Do you reserve blocks for specific tournaments?",
        answer:
          "No pre-reserved event blocks are sold on this site. Availability is checked per inquiry against real inventory.",
      },
    ],
    internalLinks: [
      { href: "/campaigns/international-delegations-group-travel", label: "Group travel" },
      { href: "/guides/family-apartments-tel-aviv", label: "Family apartments" },
      { href: "/contact", label: "Request availability" },
    ],
  },
  {
    slug: "extended-stay-furnished-apartments",
    title: "Extended-Stay Furnished Apartments",
    metaTitle: "Extended-Stay Furnished Apartments Tel Aviv",
    metaDescription:
      "Request extended-stay furnished apartments in Tel Aviv. Core Rentals TLV concierge checks longer dates against the curated catalog.",
    h1: "Extended-Stay Furnished Apartments",
    intro:
      "Extended stays need kitchens, laundry, and stable Wi-Fi more than hotel nights. Browse Core Rentals TLV apartments and request availability for multi-week or multi-month windows.",
    body: [
      "Tell us approximate length of stay, budget discussion preferences (handled offline), and must-have amenities. Pricing is never published here; quotes follow a manual availability check.",
      "Corporate relocation and employee assignments often overlap with extended stays — use whichever campaign page matches your source; attribution is preserved either way.",
    ],
    audience: "Longer-stay guests and assignees",
    utmCampaign: "extended-stay-furnished-apartments",
    ctaLabel: "Request extended-stay options",
    faqs: [
      {
        question: "What counts as extended stay?",
        answer:
          "Typically multi-week or longer. Include your target dates in the inquiry so we can check suitable apartments.",
      },
    ],
    internalLinks: [
      { href: "/campaigns/relocation-employee-assignments", label: "Relocation housing" },
      { href: "/campaigns/corporate-accommodation-tel-aviv", label: "Corporate accommodation" },
      { href: "/apartments", label: "Apartment catalog" },
    ],
  },
];

export function getAllCampaignSlugs(): string[] {
  return CAMPAIGN_PAGES.map((c) => c.slug);
}

export function getCampaignBySlug(slug: string): CampaignPage | undefined {
  return CAMPAIGN_PAGES.find((c) => c.slug === slug);
}
