import type { Apartment } from "@/types/apartment";

/** Matches HolyGuest, Sea N' Rent, Sea N Rent, Seanrent, etc. */
const BRAND_NAME_RE =
  /(?:Holy\s*Guest|HolyGuest|Sea\s*N[\u2019']?\s*Rent|Sea\s*and\s*Rent|Seanrent|Sean\s*Rent)/gi;

const BRAND_SUFFIX_RE =
  /\s*by\s+(?:Holy\s*Guest|HolyGuest|Sea\s*N[\u2019']?\s*Rent|Sea\s*and\s*Rent|Seanrent|Sean\s*Rent)\b.*$/i;

const HOSTED_BY_RE =
  /\s*(?:hosted|operated|managed|provided)\s+by\s+(?:Holy\s*Guest|HolyGuest|Sea\s*N[\u2019']?\s*Rent|Sea\s*and\s*Rent|Seanrent|Sean\s*Rent)\.?/gi;

const BOOKING_BOILERPLATE_RE =
  /Distance in property description is calculated using © OpenStreetMap/gi;

const BOOKING_SECTION_RE =
  /(?:^|\.\s*)(?:Spacious Accommodations|Modern Amenities|Prime Location|Comfortable Accommodations|Excellent Location):\s*/gim;

function stripBrandFromText(text: string): string {
  if (!text) return text;

  let out = text;

  out = out.replace(
    /Prime Location:\s*([^.\n]+?)\s+by\s+Sea\s*N[\u2019']?\s*Rent\s+in\s+/gi,
    "Prime Location: $1 in "
  );
  out = out.replace(
    /([^.\n]+?)\s+by\s+Sea\s*N[\u2019']?\s*Rent\s+offers\s+/gi,
    "$1 offers "
  );
  out = out.replace(
    /The Vacation rental apartment hosted by Sea\s*N[\u2019']?\s*Rent is\s+/gi,
    "This vacation rental apartment is "
  );
  out = out.replace(
    /\s+by\s+(?:Holy\s*Guest|HolyGuest|Sea\s*N[\u2019']?\s*Rent|Sea\s*and\s*Rent|Seanrent|Sean\s*Rent)\b[,.\s]*/gi,
    " "
  );
  out = out.replace(
    /(?:Welcome to (?:our|your|this) )([^!.\n]+?) by Sea\s*N[\u2019']?\s*Rent/gi,
    "Welcome to $1"
  );
  out = out.replace(
    /(?:a|an|the|this)\s+([^,.\n]+?)\s+by Sea\s*N[\u2019']?\s*Rent/gi,
    "$1"
  );
  out = out.replace(
    /(?:vacation rental )?apartment\s+by Sea\s*N[\u2019']?\s*Rent/gi,
    "apartment"
  );
  out = out.replace(
    /Welcome to your home away from home by Sea\s*N[\u2019']?\s*Rent!/gi,
    "Welcome to your home away from home!"
  );
  out = out.replace(/(?:in|from|at|by)\s+Sea\s*N[\u2019']?\s*Rent[!.]?\s*/gi, "");

  out = out.replace(/At this HolyGuest,?\s*/gi, "");
  out = out.replace(
    /(?:explore|use|download)\s+(?:the\s+)?HolyGuest app(?:\s+for[^.!\n]*)?[.!]?\s*/gi,
    ""
  );
  out = out.replace(
    /(?:with|through|via)\s+HolyGuest(?:\s+for[^.!\n]*)?[.!]?\s*/gi,
    ""
  );
  out = out.replace(
    /Experience the essence of Tel Aviv living with HolyGuest\.?\s*/gi,
    ""
  );
  out = out.replace(HOSTED_BY_RE, " ");

  out = out.replace(BRAND_SUFFIX_RE, "");
  out = out.replace(BRAND_NAME_RE, "");
  out = out.replace(BOOKING_BOILERPLATE_RE, "");
  out = out.replace(BOOKING_SECTION_RE, (match) =>
    match.startsWith(".") ? ". " : ""
  );

  out = out.replace(/\s{2,}/g, " ");
  out = out.replace(/\n{3,}/g, "\n\n");
  out = out.replace(/^\s+|\s+$/gm, "");
  out = out.replace(/\.\s+\./g, ".");
  out = out.replace(/,\s*,/g, ",");

  return out.trim();
}

function cleanAmenity(amenity: string): string | null {
  const a = stripBrandFromText(amenity);
  if (!a) return null;
  if (/^(?:Do they|Can I|Is there|What |Are there|How )/i.test(a)) return null;
  if (/\d+\s*(?:ft|mi|km)\s*$/i.test(a)) return null;
  if (/^©\s*OpenStreetMap/i.test(a)) return null;
  return a;
}

/** Strip supplier branding from all user-visible apartment fields. */
export function sanitizeApartmentForPublic(apartment: Apartment): Apartment {
  const name = stripBrandFromText(apartment.name) || apartment.name;
  const fullDescription = stripBrandFromText(apartment.fullDescription);
  let shortDescription = stripBrandFromText(apartment.shortDescription);
  if (!shortDescription || shortDescription.length < 20) {
    shortDescription =
      fullDescription.length <= 220
        ? fullDescription
        : `${fullDescription.slice(0, 220).replace(/\s+\S*$/, "").trim()}…`;
  }

  const amenities = apartment.amenities
    .map(cleanAmenity)
    .filter((a): a is string => Boolean(a));

  const images = apartment.images.map((img, i) => ({
    ...img,
    alt: stripBrandFromText(img.alt) || `Apartment photo ${i + 1}`,
  }));

  return {
    ...apartment,
    name,
    shortDescription,
    fullDescription,
    amenities,
    images,
  };
}

export function containsSupplierBranding(text: string): boolean {
  BRAND_NAME_RE.lastIndex = 0;
  return (
    BRAND_NAME_RE.test(text) ||
    /\sby\s+(?:Holy|Sea|Sean)/i.test(text) ||
    /hosted by/i.test(text)
  );
}
