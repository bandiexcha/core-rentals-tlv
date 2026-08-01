"use client";

import type { ReactNode } from "react";
import type { CatalogSearchState } from "@/lib/catalog-search";
import {
  AMENITY_FACETS,
  BEDROOM_OPTIONS,
  TRAVEL_STYLE_TAGS,
  type AmenityFacet,
  type BedroomFilter,
} from "@/lib/catalog-search";
import type { LocationOption } from "@/lib/location";
import type { ApartmentTag } from "@/types/apartment";

interface CatalogFiltersPanelProps {
  state: CatalogSearchState;
  cities: LocationOption[];
  neighborhoods: LocationOption[];
  streets: string[];
  onChange: (patch: Partial<CatalogSearchState>) => void;
  onClear: () => void;
  onClose?: () => void;
  onApply?: () => void;
  variant?: "sidebar" | "drawer";
}

export function CatalogFiltersPanel({
  state,
  cities,
  neighborhoods,
  streets,
  onChange,
  onClear,
  onClose,
  onApply,
  variant = "sidebar",
}: CatalogFiltersPanelProps) {
  const idPrefix = variant === "drawer" ? "drawer" : "sidebar";

  const toggleAmenity = (facet: AmenityFacet) => {
    const next = state.amenities.includes(facet)
      ? state.amenities.filter((a) => a !== facet)
      : [...state.amenities, facet];
    onChange({ amenities: next });
  };

  const toggleTag = (tag: ApartmentTag) => {
    const next = state.tags.includes(tag)
      ? state.tags.filter((t) => t !== tag)
      : [...state.tags, tag];
    onChange({ tags: next });
  };

  return (
    <div
      className={
        variant === "drawer"
          ? "flex h-full max-h-[100dvh] flex-col bg-cream"
          : "rounded-2xl bg-cream p-5 ring-1 ring-sand-dark/40 lg:sticky lg:top-24"
      }
    >
      {variant === "drawer" && (
        <div className="flex shrink-0 items-center justify-between border-b border-sand-dark/40 px-5 py-4">
          <h2 className="font-serif text-xl text-navy">Filters</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1.5 text-sm text-navy-light hover:bg-sand"
            aria-label="Close filters"
          >
            Close
          </button>
        </div>
      )}

      <div
        className={
          variant === "drawer"
            ? "min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5"
            : "space-y-6"
        }
      >
        {variant === "sidebar" && (
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg text-navy">Filters</h2>
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-mediterranean hover:underline"
            >
              Clear all
            </button>
          </div>
        )}

        <FilterSection title="Location">
          <FilterSelect
            id={`${idPrefix}-city`}
            label="City"
            value={state.city}
            onChange={(city) =>
              onChange({
                city,
                neighborhood: "",
              })
            }
            options={cities.map((c) => ({ value: c.value, label: c.label }))}
          />
          <FilterSelect
            id={`${idPrefix}-neighborhood`}
            label="Neighborhood"
            value={state.neighborhood}
            onChange={(neighborhood) => onChange({ neighborhood })}
            options={neighborhoods.map((n) => ({
              value: n.value,
              label: n.label,
            }))}
            disabled={!state.city && neighborhoods.length === 0}
            emptyHint={
              state.city
                ? "No neighborhoods for this city"
                : "Select a city first"
            }
          />
          <FilterSelect
            id={`${idPrefix}-street`}
            label="Street"
            value={state.street}
            onChange={(street) => onChange({ street })}
            options={streets.map((s) => ({ value: s, label: s }))}
          />
        </FilterSection>

        <FilterSection title="Apartment">
          <FilterSelect
            id={`${idPrefix}-bedrooms`}
            label="Bedrooms"
            value={state.bedrooms === "any" ? "" : state.bedrooms}
            onChange={(v) =>
              onChange({
                bedrooms: (v || "any") as BedroomFilter,
              })
            }
            options={BEDROOM_OPTIONS.filter((o) => o.value !== "any").map(
              (opt) => ({
                value: opt.value,
                label: opt.label,
              })
            )}
            anyLabel="Any"
          />

          <FilterSelect
            id={`${idPrefix}-guests`}
            label="Guests"
            value={state.guests == null ? "" : String(state.guests)}
            onChange={(v) => onChange({ guests: v ? Number(v) : null })}
            options={[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((n) => ({
              value: String(n),
              label: `${n}+`,
            }))}
          />

          <FilterSelect
            id={`${idPrefix}-bathrooms`}
            label="Bathrooms"
            value={state.bathrooms == null ? "" : String(state.bathrooms)}
            onChange={(v) => onChange({ bathrooms: v ? Number(v) : null })}
            options={[1, 2, 3, 4].map((n) => ({
              value: String(n),
              label: `${n}+`,
            }))}
          />
        </FilterSection>

        <FilterSection title="Amenities">
          <div className="space-y-1">
            {AMENITY_FACETS.filter(
              (facet) =>
                facet.value !== "elevator" && facet.value !== "new-building"
            ).map((facet) => (
              <label
                key={facet.value}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-sand"
              >
                <input
                  type="checkbox"
                  checked={state.amenities.includes(facet.value)}
                  onChange={() => toggleAmenity(facet.value)}
                  className="rounded border-sand-dark text-mediterranean focus:ring-mediterranean"
                />
                {facet.label}
              </label>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Building">
          <div className="space-y-1">
            {(
              [
                ["elevator", "Elevator"],
                ["new-building", "New Building"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-sand"
              >
                <input
                  type="checkbox"
                  checked={state.amenities.includes(value)}
                  onChange={() => toggleAmenity(value)}
                  className="rounded border-sand-dark text-mediterranean focus:ring-mediterranean"
                />
                {label}
              </label>
            ))}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-sand">
              <input
                type="checkbox"
                checked={state.tags.includes("luxury")}
                onChange={() => toggleTag("luxury")}
                className="rounded border-sand-dark text-mediterranean focus:ring-mediterranean"
              />
              Luxury
            </label>
          </div>
        </FilterSection>

        <FilterSection title="Travel Style">
          <div className="flex flex-wrap gap-2">
            {TRAVEL_STYLE_TAGS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleTag(value)}
                className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                  state.tags.includes(value)
                    ? "bg-mediterranean text-cream"
                    : "bg-sand text-navy-light hover:bg-sand-dark"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </FilterSection>
      </div>

      {variant === "drawer" && (
        <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-sand-dark/40 px-5 py-4">
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-sand-dark px-4 py-3 text-sm text-navy hover:bg-sand"
          >
            Clear Filters
          </button>
          <button
            type="button"
            onClick={onApply}
            className="rounded-full bg-mediterranean px-4 py-3 text-sm text-cream hover:bg-mediterranean-light"
          >
            Apply Filters
          </button>
        </div>
      )}
    </div>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-gold">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  disabled,
  emptyHint,
  anyLabel = "Any",
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  emptyHint?: string;
  anyLabel?: string;
  id?: string;
}) {
  const selectId =
    id ?? `filter-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <label
        htmlFor={selectId}
        className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted"
      >
        {label}
      </label>
      <select
        id={selectId}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="max-h-48 w-full rounded-xl border border-sand-dark bg-sand px-3 py-2.5 text-sm text-navy focus:border-mediterranean focus:outline-none focus:ring-1 focus:ring-mediterranean disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">{anyLabel}</option>
        {options.length === 0 && emptyHint ? (
          <option value="" disabled>
            {emptyHint}
          </option>
        ) : (
          options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
