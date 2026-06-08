import type { Apartment } from "@/types/apartment";
import { SITE } from "@/lib/constants";
import { getApartmentMapLocation } from "@/lib/apartment-location";
import { absoluteUrl, apartmentImageAlt } from "@/lib/seo";

export interface FaqItem {
  question: string;
  answer: string;
}

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "LocalBusiness", "LodgingBusiness"],
    "@id": `${absoluteUrl("/")}#organization`,
    name: SITE.name,
    description: SITE.description,
    url: absoluteUrl("/"),
    telephone: `+${SITE.whatsappNumber}`,
    areaServed: {
      "@type": "City",
      name: "Tel Aviv-Yafo",
      containedInPlace: { "@type": "Country", name: "Israel" },
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: "Tel Aviv",
      addressRegion: "Tel Aviv District",
      addressCountry: "IL",
    },
    sameAs: [SITE.whatsappUrl],
    knowsAbout: [
      "Tel Aviv vacation rentals",
      "Tel Aviv apartments",
      "Luxury short-term stays",
      "Boutique apartment curation",
    ],
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${absoluteUrl("/")}#website`,
    name: SITE.name,
    url: absoluteUrl("/"),
    description: SITE.description,
    publisher: { "@id": `${absoluteUrl("/")}#organization` },
    inLanguage: "en",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl("/apartments")}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbSchema(
  items: Array<{ name: string; path: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqSchema(faqs: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function vacationRentalSchema(apartment: Apartment) {
  const image = apartment.images[0];
  const imageUrl = image?.url.startsWith("http")
    ? image.url
    : absoluteUrl(image?.url ?? "/");
  const mapLocation = getApartmentMapLocation(apartment);

  return {
    "@context": "https://schema.org",
    "@type": "VacationRental",
    "@id": `${absoluteUrl(`/apartments/${apartment.slug}`)}#rental`,
    name: apartment.name,
    description: apartment.fullDescription || apartment.shortDescription,
    url: absoluteUrl(`/apartments/${apartment.slug}`),
    image: apartment.images.map((img, i) =>
      img.url.startsWith("http") ? img.url : absoluteUrl(img.url)
    ),
    address: {
      "@type": "PostalAddress",
      addressLocality: apartment.city,
      addressRegion: "Israel",
      addressCountry: "IL",
      ...(mapLocation.isExactAddress
        ? { streetAddress: apartment.address }
        : { streetAddress: apartment.neighborhood }),
    },
    geo: {
      "@type": "GeoCoordinates",
      addressCountry: "IL",
      addressLocality: "Tel Aviv",
    },
    numberOfRooms: apartment.bedrooms,
    numberOfBathroomsTotal: apartment.bathrooms,
    occupancy: {
      "@type": "QuantitativeValue",
      value: apartment.guests,
      unitText: "guests",
    },
    amenityFeature: apartment.amenities.map((name) => ({
      "@type": "LocationFeatureSpecification",
      name,
      value: true,
    })),
    ...(image
      ? {
          primaryImageOfPage: {
            "@type": "ImageObject",
            url: imageUrl,
            caption: apartmentImageAlt(apartment, 0),
          },
        }
      : {}),
    provider: { "@id": `${absoluteUrl("/")}#organization` },
  };
}

export function itemListSchema(
  name: string,
  apartments: Apartment[],
  listUrl: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url: absoluteUrl(listUrl),
    numberOfItems: apartments.length,
    itemListElement: apartments.slice(0, 50).map((apt, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(`/apartments/${apt.slug}`),
      name: apt.name,
    })),
  };
}

export function aboutPageSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": `${absoluteUrl("/about")}#page`,
    name: `About ${SITE.name}`,
    url: absoluteUrl("/about"),
    description:
      "Core Rentals TLV is a privately curated catalog of vacation apartments in Tel Aviv, Israel. Learn how apartments are selected and how guests request availability.",
    isPartOf: { "@id": `${absoluteUrl("/")}#website` },
    about: { "@id": `${absoluteUrl("/")}#organization` },
    inLanguage: "en",
  };
}
