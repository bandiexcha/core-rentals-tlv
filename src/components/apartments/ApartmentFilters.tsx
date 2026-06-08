"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { AMENITIES, TAGS } from "@/lib/constants";
import { getNeighborhoods } from "@/lib/apartments";

export function ApartmentFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const neighborhoods = getNeighborhoods();

  const get = (key: string) => searchParams.get(key) ?? "";

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      startTransition(() => {
        router.push(`/apartments?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  const selectedAmenities = get("amenities").split(",").filter(Boolean);
  const selectedTags = get("tags").split(",").filter(Boolean);

  const toggleAmenity = (amenity: string) => {
    const next = selectedAmenities.includes(amenity)
      ? selectedAmenities.filter((a) => a !== amenity)
      : [...selectedAmenities, amenity];
    updateParams({ amenities: next.join(",") });
  };

  const toggleTag = (tag: string) => {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    updateParams({ tags: next.join(",") });
  };

  const clearFilters = () => {
    startTransition(() => router.push("/apartments"));
  };

  const hasFilters = searchParams.toString().length > 0;

  return (
    <aside
      className={`rounded-2xl bg-cream p-5 ring-1 ring-sand-dark/40 lg:sticky lg:top-24 ${isPending ? "opacity-70" : ""}`}
    >
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-serif text-lg text-navy">Filters</h2>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs text-mediterranean hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
            Search
          </label>
          <input
            type="search"
            value={get("q")}
            onChange={(e) => updateParams({ q: e.target.value })}
            placeholder="Name, area, amenity..."
            className="w-full rounded-xl border border-sand-dark bg-sand px-3 py-2.5 text-sm text-navy placeholder:text-muted/60 focus:border-mediterranean focus:outline-none focus:ring-1 focus:ring-mediterranean"
          />
        </div>

        <FilterSelect
          label="Neighborhood"
          value={get("neighborhood")}
          onChange={(v) => updateParams({ neighborhood: v })}
          options={neighborhoods.map((n) => ({ value: n, label: n }))}
        />

        <FilterSelect
          label="Min. Guests"
          value={get("guests")}
          onChange={(v) => updateParams({ guests: v })}
          options={[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
            value: String(n),
            label: `${n}+`,
          }))}
        />

        <FilterSelect
          label="Min. Bedrooms"
          value={get("bedrooms")}
          onChange={(v) => updateParams({ bedrooms: v })}
          options={[1, 2, 3, 4].map((n) => ({
            value: String(n),
            label: `${n}+`,
          }))}
        />

        <FilterSelect
          label="Min. Bathrooms"
          value={get("bathrooms")}
          onChange={(v) => updateParams({ bathrooms: v })}
          options={[1, 2, 3].map((n) => ({
            value: String(n),
            label: `${n}+`,
          }))}
        />

        <fieldset>
          <legend className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
            Style
          </legend>
          <div className="flex flex-wrap gap-2">
            {TAGS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleTag(value)}
                className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                  selectedTags.includes(value)
                    ? "bg-mediterranean text-cream"
                    : "bg-sand text-navy-light hover:bg-sand-dark"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
            Amenities
          </legend>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {AMENITIES.map((amenity) => (
              <label
                key={amenity}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-sand"
              >
                <input
                  type="checkbox"
                  checked={selectedAmenities.includes(amenity)}
                  onChange={() => toggleAmenity(amenity)}
                  className="rounded border-sand-dark text-mediterranean focus:ring-mediterranean"
                />
                {amenity}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </aside>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-sand-dark bg-sand px-3 py-2.5 text-sm text-navy focus:border-mediterranean focus:outline-none focus:ring-1 focus:ring-mediterranean"
      >
        <option value="">Any</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
