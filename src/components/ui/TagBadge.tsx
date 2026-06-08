import type { ApartmentTag } from "@/types/apartment";

const tagStyles: Record<ApartmentTag, string> = {
  "sea-view": "bg-mediterranean/10 text-mediterranean",
  "city-view": "bg-navy/8 text-navy-light",
  luxury: "bg-gold/15 text-navy",
  family: "bg-sand-dark text-navy-light",
  corporate: "bg-navy/10 text-navy",
};

const tagLabels: Record<ApartmentTag, string> = {
  "sea-view": "Sea View",
  "city-view": "City View",
  luxury: "Luxury",
  family: "Family",
  corporate: "Corporate",
};

export function TagBadge({ tag }: { tag: ApartmentTag }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ${tagStyles[tag]}`}
    >
      {tagLabels[tag]}
    </span>
  );
}
