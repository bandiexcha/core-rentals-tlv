"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ApartmentWithCatalogCover } from "@/types/apartment";
import { ApartmentGrid } from "@/components/apartments/ApartmentGrid";
import { CatalogFiltersPanel } from "@/components/apartments/CatalogFiltersPanel";
import {
  DEFAULT_CATALOG_SEARCH,
  SORT_OPTIONS,
  applyCatalogSearch,
  buildCityOptions,
  buildNeighborhoodOptions,
  catalogSearchFromParams,
  catalogSearchToParams,
  getActiveFilterChips,
  getCatalogStreets,
  hasActiveCatalogFilters,
  type CatalogSearchState,
  type CatalogSort,
} from "@/lib/catalog-search";

interface ApartmentCatalogClientProps {
  apartments: ApartmentWithCatalogCover[];
  totalCount: number;
}

export function ApartmentCatalogClient({
  apartments,
  totalCount,
}: ApartmentCatalogClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<CatalogSearchState>(() =>
    catalogSearchFromParams(searchParams)
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  const streets = useMemo(() => getCatalogStreets(apartments), [apartments]);
  const cities = useMemo(() => buildCityOptions(apartments), [apartments]);
  const neighborhoods = useMemo(
    () =>
      state.city
        ? buildNeighborhoodOptions(apartments, state.city)
        : [],
    [apartments, state.city]
  );

  const recommendedOrder = useMemo(() => {
    const map = new Map<string, number>();
    apartments.forEach((apartment, index) => map.set(apartment.id, index));
    return map;
  }, [apartments]);

  const filtered = useMemo(
    () => applyCatalogSearch(apartments, state, recommendedOrder),
    [apartments, state, recommendedOrder]
  );

  const chips = useMemo(() => getActiveFilterChips(state), [state]);
  const hasFilters = hasActiveCatalogFilters(state);

  useEffect(() => {
    const next = catalogSearchFromParams(searchParams);
    setState((prev) =>
      JSON.stringify(prev) === JSON.stringify(next) ? prev : next
    );
  }, [searchParams]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  // Drop neighborhood if it no longer belongs to the selected city
  useEffect(() => {
    if (!state.neighborhood) return;
    const stillValid = neighborhoods.some((n) => n.value === state.neighborhood);
    if (!stillValid) {
      setState((prev) => {
        const next = { ...prev, neighborhood: "" };
        const params = catalogSearchToParams(next);
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
        return next;
      });
    }
  }, [neighborhoods, state.neighborhood, pathname, router]);

  const syncUrl = (next: CatalogSearchState) => {
    const params = catalogSearchToParams(next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const updateState = (patch: Partial<CatalogSearchState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      syncUrl(next);
      return next;
    });
  };

  const clearFilters = () => {
    const next = { ...DEFAULT_CATALOG_SEARCH, sort: state.sort };
    setState(next);
    syncUrl(next);
  };

  const broadenSearch = () => {
    updateState({
      amenities: [],
      tags: [],
      bathrooms: null,
      street: "",
    });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
      <div className="hidden lg:block">
        <CatalogFiltersPanel
          state={state}
          cities={cities}
          neighborhoods={neighborhoods}
          streets={streets}
          onChange={updateState}
          onClear={clearFilters}
          variant="sidebar"
        />
      </div>

      <div>
        <div className="mb-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
              Search by property
            </label>
            <input
              type="search"
              value={state.q}
              onChange={(e) => updateState({ q: e.target.value })}
              placeholder="Title, street, neighborhood, ID… e.g. Trumpeldor, Rembrandt"
              className="w-full rounded-2xl border border-sand-dark bg-cream px-4 py-3.5 text-sm text-navy placeholder:text-muted/60 focus:border-mediterranean focus:outline-none focus:ring-1 focus:ring-mediterranean"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-sand-dark bg-cream px-4 py-2.5 text-sm text-navy lg:hidden"
            >
              Filters
              {chips.length > 0 && (
                <span className="rounded-full bg-mediterranean px-2 py-0.5 text-xs text-cream">
                  {chips.length}
                </span>
              )}
            </button>

            <div className="ml-auto flex items-center gap-2">
              <label
                htmlFor="catalog-sort"
                className="text-xs uppercase tracking-wider text-muted"
              >
                Sort
              </label>
              <select
                id="catalog-sort"
                value={state.sort}
                onChange={(e) =>
                  updateState({ sort: e.target.value as CatalogSort })
                }
                className="rounded-xl border border-sand-dark bg-cream px-3 py-2 text-sm text-navy focus:border-mediterranean focus:outline-none focus:ring-1 focus:ring-mediterranean"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => updateState(chip.clear)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3 py-1.5 text-xs text-cream transition-colors hover:bg-navy-light"
                >
                  {chip.label}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-mediterranean hover:underline"
              >
                Clear All Filters
              </button>
            </div>
          )}

          <p className="text-sm text-muted" aria-live="polite">
            Showing{" "}
            <span className="font-medium text-navy">{filtered.length}</span> of{" "}
            <span className="font-medium text-navy">{totalCount}</span>{" "}
            apartments
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-cream px-6 py-16 text-center ring-1 ring-sand-dark/40">
            <p className="font-serif text-xl text-navy">
              No apartments match these filters.
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted">
              Try removing a filter, searching a different street, or broadening
              amenities.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-full bg-mediterranean px-5 py-2.5 text-sm text-cream hover:bg-mediterranean-light"
              >
                Clear Filters
              </button>
              {hasFilters && (
                <button
                  type="button"
                  onClick={broadenSearch}
                  className="rounded-full border border-sand-dark px-5 py-2.5 text-sm text-navy hover:bg-sand"
                >
                  Broaden Search
                </button>
              )}
            </div>
          </div>
        ) : (
          <ApartmentGrid apartments={filtered} />
        )}
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-navy/50"
            aria-label="Close filters overlay"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-3xl shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:max-w-md sm:rounded-none">
            <CatalogFiltersPanel
              state={state}
              cities={cities}
              neighborhoods={neighborhoods}
              streets={streets}
              onChange={updateState}
              onClear={clearFilters}
              onClose={() => setDrawerOpen(false)}
              onApply={() => setDrawerOpen(false)}
              variant="drawer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
