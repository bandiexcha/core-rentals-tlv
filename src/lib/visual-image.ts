import type { Apartment, ApartmentImage } from "@/types/apartment";

/**
 * Hamming distance at or below this threshold = visually similar (256-bit dHash).
 * 150 catches near-identical beachfront interiors that differ only by angle.
 */
export const VISUAL_SIMILARITY_THRESHOLD = 150;

export function hammingDistance(a: string, b: string): number {
  const len = Math.min(a.length, b.length);
  let distance = 0;
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) distance++;
  }
  return distance + Math.abs(a.length - b.length);
}

export function isVisuallySimilar(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return hammingDistance(a, b) <= VISUAL_SIMILARITY_THRESHOLD;
}

export function getImageVisualHash(
  apartment: Pick<Apartment, "imageVisualHashes">,
  imageIndex: number,
  image?: ApartmentImage
): string | null {
  const stored = apartment.imageVisualHashes?.[imageIndex];
  if (stored) return stored;
  return image?.url ?? null;
}

export function minVisualSeparation(
  candidateHash: string | null,
  neighborHashes: Array<string | null>
): number {
  if (!candidateHash) return 0;
  const valid = neighborHashes.filter((hash): hash is string => Boolean(hash));
  if (!valid.length) return 256;
  return Math.min(...valid.map((hash) => hammingDistance(candidateHash, hash)));
}
