import type { ApartmentWithCatalogCover } from "@/types/apartment";
import { ApartmentCard } from "./ApartmentCard";

interface ApartmentGridProps {
  apartments: ApartmentWithCatalogCover[];
  emptyMessage?: string;
}

export function ApartmentGrid({
  apartments,
  emptyMessage = "No apartments match your filters. Try adjusting your search or contact us for a personalized recommendation.",
}: ApartmentGridProps) {
  if (apartments.length === 0) {
    return (
      <div className="rounded-2xl bg-cream px-6 py-16 text-center ring-1 ring-sand-dark/40">
        <p className="font-serif text-xl text-navy">No results found</p>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {apartments.map((apartment) => (
        <ApartmentCard
          key={apartment.id}
          apartment={apartment}
          coverIndex={apartment.catalogCoverIndex ?? 0}
        />
      ))}
    </div>
  );
}
