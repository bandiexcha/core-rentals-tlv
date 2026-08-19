export const SITE = {
  name: "Core Rentals TLV",
  tagline: "A private curated Tel Aviv vacation-rental catalog for selected clients.",
  description:
    "Handpicked vacation apartments across Tel Aviv — privately curated for discerning travelers. Request availability through our boutique concierge team.",
  city: "Tel Aviv",
  whatsappNumber: "972527599399",
  whatsappUrl: "https://wa.me/972527599399",
  /**
   * Canonical Core Rentals contact — Single Source of Truth.
   * Never invent @corerentals.com / @corerentalstlv.com mailboxes.
   */
  contactEmail: "avishayairbnb@gmail.com",
  inquiryEmail: "avishayairbnb@gmail.com",
} as const;

export const WHATSAPP_DEFAULT_MESSAGE = `Hello,

I am interested in one of the apartments listed on Core Rentals TLV.

Please send me availability and more information.

Thank you.`;

export function apartmentWhatsAppMessage(apartmentName: string): string {
  return `Hello,

I am interested in:
${apartmentName}

Please send me availability and more information.

Thank you.`;
}

export const NEIGHBORHOODS = [
  "Neve Tzedek",
  "Florentin",
  "Rothschild",
  "Lev Ha'ir",
  "Gordon Beach",
  "Bograshov Beach",
  "Dizengoff",
  "Sarona",
  "Jaffa",
  "North Tel Aviv",
  "Old North",
  "Kerem HaTeimanim",
] as const;

export const AMENITIES = [
  "Wi-Fi",
  "Air conditioning",
  "Fully equipped kitchen",
  "Washing machine",
  "Dryer",
  "Balcony",
  "Terrace",
  "Sea view",
  "City view",
  "Elevator",
  "Parking",
  "Workspace",
  "Smart TV",
  "Premium linens",
  "Beach access",
  "Pool access",
  "Rooftop access",
  "Shabbat-friendly",
] as const;

export const TAGS = [
  { value: "sea-view", label: "Sea View" },
  { value: "city-view", label: "City View" },
  { value: "luxury", label: "Luxury" },
  { value: "family", label: "Family" },
  { value: "corporate", label: "Corporate" },
] as const;

export function whatsappUrl(message?: string): string {
  const text = encodeURIComponent(message ?? WHATSAPP_DEFAULT_MESSAGE);
  return `${SITE.whatsappUrl}?text=${text}`;
}

export function inquiryUrl(apartmentName?: string): string {
  const base = "/contact";
  if (!apartmentName) return base;
  return `${base}?apartment=${encodeURIComponent(apartmentName)}`;
}
