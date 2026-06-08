import type { ApartmentTag } from "@/types/apartment";
import type { FaqItem } from "@/lib/json-ld";

export interface LocationGuide {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  body: string[];
  keywords: string[];
  neighborhoods?: string[];
  tag?: ApartmentTag;
  faqs: FaqItem[];
}

export const LOCATION_GUIDES: LocationGuide[] = [
  {
    slug: "tel-aviv-vacation-rentals",
    title: "Tel Aviv Vacation Rentals",
    metaTitle: "Tel Aviv Vacation Rentals | Curated Apartments",
    metaDescription:
      "Browse curated Tel Aviv vacation rentals with Core Rentals TLV. Handpicked apartments across Neve Tzedek, Rothschild, Gordon Beach, and more. Request availability personally.",
    h1: "Tel Aviv Vacation Rentals",
    intro:
      "Core Rentals TLV is a privately curated catalog of vacation apartments across Tel Aviv-Yafo, Israel. Each listing is selected for location, design, and professional management — offering an alternative to generic short-term rental search results.",
    body: [
      "Tel Aviv vacation rentals on Core Rentals TLV span the city's most sought-after neighborhoods: beachfront Gordon and Bograshov, leafy Old North, vibrant Florentin, historic Neve Tzedek, and central Rothschild Boulevard. Listings include studio apartments for solo travelers, family-sized multi-bedroom homes, and corporate-ready residences with workspace and fast Wi-Fi.",
      "Unlike mass-market booking platforms, Core Rentals TLV does not process payments or instant bookings on-site. Guests browse the catalog, then request availability through a personal concierge — by form or WhatsApp. This boutique model ensures every inquiry receives a thoughtful response matched to dates, group size, and neighborhood preferences.",
    ],
    keywords: [
      "Tel Aviv vacation rentals",
      "Tel Aviv holiday apartments",
      "short-term rentals Tel Aviv",
    ],
    faqs: [
      {
        question: "What is Core Rentals TLV?",
        answer:
          "Core Rentals TLV is a curated catalog of vacation apartments in Tel Aviv, Israel. It is operated as a private concierge service — not an automated booking engine.",
      },
      {
        question: "How do I book a Tel Aviv vacation rental through Core Rentals TLV?",
        answer:
          "Browse the apartment catalog, select a property, and submit a Request Availability form or contact the team via WhatsApp. A concierge confirms availability and coordinates your stay directly.",
      },
      {
        question: "Which Tel Aviv neighborhoods are covered?",
        answer:
          "The catalog includes apartments in Neve Tzedek, Florentin, Rothschild, Lev Ha'ir, Gordon Beach, Bograshov Beach, Dizengoff, Sarona, Jaffa, North Tel Aviv, Old North, and Kerem HaTeimanim.",
      },
    ],
  },
  {
    slug: "tel-aviv-apartments",
    title: "Tel Aviv Apartments",
    metaTitle: "Tel Aviv Apartments for Short-Term Stays",
    metaDescription:
      "Discover Tel Aviv apartments for short-term and vacation stays. Filter by neighborhood, bedrooms, guests, and amenities. Core Rentals TLV — curated apartments in Israel's coastal capital.",
    h1: "Tel Aviv Apartments for Short-Term Stays",
    intro:
      "Tel Aviv apartments in the Core Rentals TLV catalog range from compact city studios to spacious multi-bedroom residences near the Mediterranean coast. Every apartment includes verified photos, amenity lists, and capacity details.",
    body: [
      "Use the catalog filters to search by neighborhood, number of guests, bedrooms, bathrooms, amenities, and keywords. Popular amenity filters include sea view, balcony, fully equipped kitchen, air conditioning, washing machine, and workspace for remote work.",
      "All apartments are located in Tel Aviv-Yafo, Israel — one of the Middle East's most dynamic cities for culture, beach life, dining, and business travel. Core Rentals TLV focuses exclusively on this market to provide deep neighborhood expertise.",
    ],
    keywords: ["Tel Aviv apartments", "Tel Aviv short-term apartments", "apartments Tel Aviv Israel"],
    faqs: [
      {
        question: "How many apartments are in the Core Rentals TLV catalog?",
        answer:
          "The catalog includes 175+ curated vacation apartments across Tel Aviv, sourced from professionally managed portfolios and updated regularly.",
      },
      {
        question: "Can I filter Tel Aviv apartments by neighborhood?",
        answer:
          "Yes. The catalog supports filtering by neighborhood, guest capacity, bedrooms, bathrooms, amenities, and free-text search.",
      },
    ],
  },
  {
    slug: "luxury-tel-aviv-stays",
    title: "Luxury Tel Aviv Stays",
    metaTitle: "Luxury Tel Aviv Stays | Premium Vacation Apartments",
    metaDescription:
      "Luxury Tel Aviv vacation apartments with sea views, premium finishes, and prime locations. Curated by Core Rentals TLV for discerning travelers.",
    h1: "Luxury Tel Aviv Stays",
    intro:
      "Luxury Tel Aviv stays in the Core Rentals TLV collection feature premium locations, high-end furnishings, and amenities such as sea views, rooftop terraces, and concierge-level management.",
    body: [
      "Luxury listings are tagged and filterable in the catalog. Many offer Mediterranean or city skyline views, designer interiors, and proximity to Tel Aviv's finest dining and cultural destinations along Rothschild Boulevard, the Old North, and the beachfront promenade.",
      "Core Rentals TLV curates luxury apartments individually — prioritizing properties with consistent professional management, accurate photography, and guest-ready standards.",
    ],
    keywords: ["luxury Tel Aviv stays", "luxury apartments Tel Aviv", "premium Tel Aviv vacation rental"],
    tag: "luxury",
    faqs: [
      {
        question: "What defines a luxury apartment in the Core Rentals TLV catalog?",
        answer:
          "Luxury apartments are selected for premium location, design quality, high-end amenities, and professional management. They are tagged 'Luxury' in the catalog for easy discovery.",
      },
    ],
  },
  {
    slug: "rothschild-apartments",
    title: "Rothschild Apartments Tel Aviv",
    metaTitle: "Rothschild Boulevard Apartments Tel Aviv",
    metaDescription:
      "Vacation apartments on and near Rothschild Boulevard, Tel Aviv. Central location, Bauhaus architecture, walkable dining. Curated by Core Rentals TLV.",
    h1: "Rothschild Boulevard Apartments",
    intro:
      "Rothschild Boulevard is Tel Aviv's iconic tree-lined avenue — home to Bauhaus architecture, cafés, galleries, and a central position between the beach and Lev Ha'ir. Core Rentals TLV lists vacation apartments in and around the Rothschild area.",
    body: [
      "Staying on Rothschild puts guests within walking distance of Carmel Market, Neve Tzedek, the Habima Theatre, and Tel Aviv's startup and business district. Apartments in this area suit culture-focused travelers, couples, and business visitors who want a walkable central base.",
    ],
    keywords: ["Rothschild apartments Tel Aviv", "Rothschild Boulevard vacation rental"],
    neighborhoods: ["Rothschild", "Lev Ha'ir", "Neve Tzedek"],
    faqs: [
      {
        question: "Why stay near Rothschild Boulevard in Tel Aviv?",
        answer:
          "Rothschild Boulevard offers a central, walkable location with Bauhaus heritage, restaurants, and easy access to beaches, Neve Tzedek, and the business district.",
      },
    ],
  },
  {
    slug: "neve-tzedek-apartments",
    title: "Neve Tzedek Apartments Tel Aviv",
    metaTitle: "Neve Tzedek Vacation Apartments Tel Aviv",
    metaDescription:
      "Charming vacation apartments in Neve Tzedek, Tel Aviv's oldest neighborhood. Art galleries, boutiques, and seaside walks. Curated by Core Rentals TLV.",
    h1: "Neve Tzedek Vacation Apartments",
    intro:
      "Neve Tzedek is Tel Aviv's oldest neighborhood — a picturesque enclave of cobblestone lanes, art galleries, boutique shops, and restaurants, minutes from the beach and Suzanne Dellal Centre.",
    body: [
      "Neve Tzedek apartments appeal to travelers seeking character, walkability, and a village-like atmosphere within the city. Core Rentals TLV lists properties in Neve Tzedek and adjacent areas with full amenity and capacity details.",
    ],
    keywords: ["Neve Tzedek apartments", "Neve Tzedek vacation rental Tel Aviv"],
    neighborhoods: ["Neve Tzedek", "Jaffa", "Kerem HaTeimanim"],
    faqs: [
      {
        question: "What is Neve Tzedek known for?",
        answer:
          "Neve Tzedek is Tel Aviv's oldest neighborhood, known for its artistic community, boutique shopping, historic architecture, and proximity to the Mediterranean coast.",
      },
    ],
  },
  {
    slug: "beachfront-apartments-tel-aviv",
    title: "Beachfront Apartments Tel Aviv",
    metaTitle: "Beachfront Apartments Tel Aviv | Gordon & Bograshov",
    metaDescription:
      "Beachfront and near-beach vacation apartments in Tel Aviv. Gordon Beach, Bograshov, sea views. Curated catalog by Core Rentals TLV.",
    h1: "Beachfront Apartments in Tel Aviv",
    intro:
      "Tel Aviv's Mediterranean coastline stretches from north to south with iconic beaches including Gordon, Bograshov, and Frishman. Core Rentals TLV lists beachfront and near-beach vacation apartments with sea views, balconies, and walking distance to the sand.",
    body: [
      "Beachfront apartments are ideal for summer holidays, family beach trips, and travelers who want the sea as their daily backdrop. Filter the catalog by 'Sea View' tag or Gordon Beach / Bograshov Beach neighborhoods to find coastal listings.",
    ],
    keywords: [
      "beachfront apartments Tel Aviv",
      "Tel Aviv beach vacation rental",
      "Gordon Beach apartment",
    ],
    neighborhoods: ["Gordon Beach", "Bograshov Beach", "Old North", "North Tel Aviv"],
    tag: "sea-view",
    faqs: [
      {
        question: "Which Tel Aviv beaches are near catalog apartments?",
        answer:
          "Many listings are near Gordon Beach, Bograshov Beach, and the central Tel Aviv promenade (Tayelet). Specific proximity varies by apartment — check the neighborhood and description on each listing.",
      },
    ],
  },
  {
    slug: "family-apartments-tel-aviv",
    title: "Family Apartments Tel Aviv",
    metaTitle: "Family Apartments Tel Aviv | Multi-Bedroom Vacation Rentals",
    metaDescription:
      "Family-friendly vacation apartments in Tel Aviv with multiple bedrooms, kitchens, and space for children. Curated by Core Rentals TLV.",
    h1: "Family Apartments in Tel Aviv",
    intro:
      "Family trips to Tel Aviv need space, kitchens, and neighborhoods with parks and beach access. Core Rentals TLV lists multi-bedroom family apartments across the city, filterable by guest count and bedrooms.",
    body: [
      "Family-friendly listings typically offer two or more bedrooms, fully equipped kitchens, washing machines, and locations near parks, beaches, or family-oriented dining. Use catalog filters for 4+ guests and 2+ bedrooms to narrow results.",
    ],
    keywords: ["family apartments Tel Aviv", "Tel Aviv family vacation rental", "multi-bedroom Tel Aviv"],
    tag: "family",
    faqs: [
      {
        question: "How do I find family-sized apartments in Tel Aviv?",
        answer:
          "Use the catalog filters to set minimum guests and bedrooms. Family-tagged apartments are also marked in the catalog for quick discovery.",
      },
    ],
  },
  {
    slug: "business-travel-apartments-tel-aviv",
    title: "Business Travel Apartments Tel Aviv",
    metaTitle: "Business Travel Apartments Tel Aviv | Corporate Stays",
    metaDescription:
      "Corporate and business travel apartments in Tel Aviv with Wi-Fi, workspace, and central locations. Curated short-term stays by Core Rentals TLV.",
    h1: "Business Travel Apartments in Tel Aviv",
    intro:
      "Tel Aviv is Israel's business and innovation hub. Core Rentals TLV lists corporate-ready vacation apartments with fast Wi-Fi, workspace, air conditioning, and central locations near Rothschild, Sarona, and Dizengoff.",
    body: [
      "Business travelers benefit from apartments with dedicated workspace, reliable internet, self-check-in options where available, and proximity to the Azrieli business district, Rothschild startup corridor, and Ben Gurion Airport connections. Filter by 'Corporate' tag or amenities like Wi-Fi and Workspace.",
    ],
    keywords: [
      "business travel apartments Tel Aviv",
      "corporate housing Tel Aviv",
      "Tel Aviv extended stay apartment",
    ],
    tag: "corporate",
    faqs: [
      {
        question: "Are Core Rentals TLV apartments suitable for business travel?",
        answer:
          "Yes. Many listings include Wi-Fi, workspace, air conditioning, and central Tel Aviv locations suitable for corporate and extended business stays. Corporate-tagged apartments are highlighted in the catalog.",
      },
    ],
  },
];

export function getGuideBySlug(slug: string): LocationGuide | undefined {
  return LOCATION_GUIDES.find((g) => g.slug === slug);
}

export function getAllGuideSlugs(): string[] {
  return LOCATION_GUIDES.map((g) => g.slug);
}
