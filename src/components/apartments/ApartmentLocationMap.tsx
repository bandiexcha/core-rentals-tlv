import { Button } from "@/components/ui/Button";
import {
  getApartmentMapLocation,
  googleMapsEmbedUrl,
  googleMapsSearchUrl,
} from "@/lib/apartment-location";

interface ApartmentLocationMapProps {
  address?: string;
  neighborhood: string;
  city: string;
}

export function ApartmentLocationMap({
  address,
  neighborhood,
  city,
}: ApartmentLocationMapProps) {
  const location = getApartmentMapLocation({ address, neighborhood, city });
  const mapsUrl = googleMapsSearchUrl(location.mapQuery);
  const embedUrl = googleMapsEmbedUrl(location.mapQuery);

  return (
    <section aria-labelledby="location-heading" className="mt-10">
      <h2 id="location-heading" className="font-serif text-xl text-navy">
        Location
      </h2>
      <p className="mt-2 text-sm text-navy-light">{location.displayLabel}</p>
      {!location.isExactAddress && (
        <p className="mt-1 text-xs text-muted">
          Map shows the approximate neighborhood area.
        </p>
      )}
      <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-sand-dark/40">
        <div className="relative aspect-[16/10] w-full bg-sand/30">
          <iframe
            src={embedUrl}
            title={`Map — ${location.displayLabel}`}
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </div>
      <div className="mt-4">
        <Button href={mapsUrl} variant="outline" external>
          Open in Google Maps
        </Button>
      </div>
    </section>
  );
}
