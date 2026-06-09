import type { Apartment, ApartmentImage } from "@/types/apartment";
import {
  getImageVisualHash,
  isVisuallySimilar,
  minVisualSeparation,
} from "@/lib/visual-image";

/** Columns in the apartment catalog grid at lg breakpoint. */
export const CATALOG_GRID_COLS = 3;

export const HOME_PAGE_APARTMENT_LIMIT = 12;

export function imageIdentityKey(
  image: ApartmentImage,
  fingerprint?: string
): string {
  if (fingerprint) return fingerprint;

  const sourceUrl = (image as ApartmentImage & { sourceUrl?: string }).sourceUrl;
  if (sourceUrl) {
    const idMatch = sourceUrl.match(/\/([^/?#]+)\.(?:jpe?g|png|webp)(?:\?|$)/i);
    if (idMatch) return idMatch[1].toLowerCase();
    return sourceUrl.replace(/\/v\d+\//, "/").toLowerCase();
  }

  return image.url.toLowerCase();
}

function catalogNeighbors(
  index: number,
  length: number,
  cols: number
): number[] {
  const neighbors: number[] = [];
  const col = index % cols;

  if (col > 0) neighbors.push(index - 1);
  if (col < cols - 1 && index + 1 < length) neighbors.push(index + 1);
  if (index - cols >= 0) neighbors.push(index - cols);
  if (index + cols < length) neighbors.push(index + cols);

  return neighbors;
}

function coverHash(
  apartment: Apartment,
  imageIndex: number
): string | null {
  const image = apartment.images?.[imageIndex];
  if (!image) return null;

  const visual = getImageVisualHash(apartment, imageIndex, image);
  if (visual) return visual;

  const fingerprint = apartment.imageFingerprints?.[imageIndex];
  return imageIdentityKey(image, fingerprint);
}

function pickMostDistinctCover(
  apartment: Apartment,
  avoidHashes: Set<string>
): number {
  const images = apartment.images ?? [];
  if (!images.length) return 0;

  let bestIndex = 0;
  let bestScore = -1;
  let fallbackIndex = 0;
  let fallbackScore = -1;

  for (let imageIndex = 0; imageIndex < images.length; imageIndex++) {
    const hash = coverHash(apartment, imageIndex);
    if (!hash) continue;

    const separation = minVisualSeparation(hash, [...avoidHashes]);
    if (separation > fallbackScore) {
      fallbackScore = separation;
      fallbackIndex = imageIndex;
    }

    const blocked = [...avoidHashes].some((avoidHash) =>
      isVisuallySimilar(hash, avoidHash)
    );
    if (blocked) continue;

    if (separation > bestScore) {
      bestScore = separation;
      bestIndex = imageIndex;
    }
  }

  return bestScore >= 0 ? bestIndex : fallbackIndex;
}

/**
 * Pick a catalog hero index per listing so grid-adjacent cards look visually
 * different whenever the gallery has an alternative.
 */
export function assignCatalogCoverIndices(
  apartments: Apartment[],
  options?: { gridCols?: number }
): number[] {
  const cols = options?.gridCols ?? CATALOG_GRID_COLS;
  const chosenHashes: Array<string | null> = new Array(apartments.length).fill(
    null
  );
  const indices: number[] = [];

  for (let i = 0; i < apartments.length; i++) {
    const apartment = apartments[i];
    const images = apartment.images ?? [];

    if (!images.length) {
      indices.push(0);
      continue;
    }

    const avoidHashes = new Set<string>();
    for (const neighborIdx of catalogNeighbors(i, apartments.length, cols)) {
      const hash = chosenHashes[neighborIdx];
      if (hash) avoidHashes.add(hash);
    }

    const pick = pickMostDistinctCover(apartment, avoidHashes);
    indices.push(pick);
    chosenHashes[i] = coverHash(apartment, pick);
  }

  return indices;
}

function swapIfSimilar(
  apartments: Apartment[],
  coverIndices: number[],
  index: number,
  cols: number
): void {
  const left = index - 1;
  if (left < 0) return;

  const currentHash = coverHash(apartments[index], coverIndices[index]);
  const leftHash = coverHash(apartments[left], coverIndices[left]);
  if (!currentHash || !leftHash || !isVisuallySimilar(currentHash, leftHash)) {
    return;
  }

  for (let j = index + 1; j < Math.min(index + 20, apartments.length); j++) {
    const candidateHash = coverHash(apartments[j], coverIndices[j]);
    if (!candidateHash || isVisuallySimilar(candidateHash, leftHash)) continue;

    const prevHash =
      j > 0 ? coverHash(apartments[j - 1], coverIndices[j - 1]) : null;
    if (prevHash && isVisuallySimilar(currentHash, prevHash)) continue;

    const tmpApt = apartments[index];
    apartments[index] = apartments[j];
    apartments[j] = tmpApt;

    const tmpCover = coverIndices[index];
    coverIndices[index] = coverIndices[j];
    coverIndices[j] = tmpCover;
    break;
  }
}

export function arrangeCatalogForVisualDiversity(
  apartments: Apartment[],
  options?: { gridCols?: number }
): { apartments: Apartment[]; coverIndices: number[] } {
  const cols = options?.gridCols ?? CATALOG_GRID_COLS;
  const ordered = [...apartments];
  let coverIndices = assignCatalogCoverIndices(ordered, { gridCols: cols });

  for (let i = 1; i < ordered.length; i++) {
    swapIfSimilar(ordered, coverIndices, i, cols);
  }

  coverIndices = assignCatalogCoverIndices(ordered, { gridCols: cols });
  return { apartments: ordered, coverIndices };
}

export function selectVisuallyDiverseApartments(
  apartments: Apartment[],
  limit: number
): Apartment[] {
  const featured = apartments.filter((apartment) => apartment.featured);
  const remainder = apartments.filter((apartment) => !apartment.featured);
  const selected: Apartment[] = [...featured];
  const selectedIds = new Set(selected.map((apartment) => apartment.id));
  const pool = remainder.filter((apartment) => !selectedIds.has(apartment.id));

  while (selected.length < limit && pool.length > 0) {
    const selectedHashes = selected.map((apartment) =>
      coverHash(apartment, 0)
    );

    let bestIndex = 0;
    let bestScore = -1;

    for (let i = 0; i < pool.length; i++) {
      const hash = coverHash(pool[i], 0);
      const score = minVisualSeparation(hash, selectedHashes);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    selected.push(pool.splice(bestIndex, 1)[0]);
  }

  return selected.slice(0, limit);
}

export function withCatalogCovers<T extends Apartment>(
  apartments: T[],
  options?: { gridCols?: number; reorder?: boolean }
): Array<T & { catalogCoverIndex: number }> {
  const { apartments: arranged, coverIndices } = options?.reorder
    ? arrangeCatalogForVisualDiversity(apartments, options)
    : {
        apartments,
        coverIndices: assignCatalogCoverIndices(apartments, options),
      };

  return arranged.map((apartment, index) => ({
    ...apartment,
    catalogCoverIndex: coverIndices[index] ?? 0,
  })) as Array<T & { catalogCoverIndex: number }>;
}
