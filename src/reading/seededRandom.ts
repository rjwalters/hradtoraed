/**
 * Deterministic pseudo-randomness.
 *
 * Every random choice the transformer makes is derived from an explicit seed plus
 * the thing being decided, never from a running stream. That is what lets the
 * slider be reversible: moving 70 -> 40 -> 70 recomputes the same values rather
 * than drawing new ones.
 */

/** FNV-1a, 32-bit. Fast, and spreads short similar strings well enough here. */
export function hashString(input: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Mixes any number of parts into a single 32-bit seed. */
export function seedFrom(...parts: Array<string | number>): number {
  let h = 0x811c9dc5
  for (const part of parts) {
    h = hashString(typeof part === 'number' ? `#${part}` : part, h)
    h = (h ^ 0x9e3779b9) >>> 0
  }
  return h >>> 0
}

/** Mulberry32: small, fast, good enough statistically for shuffling candidates. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function rngFrom(...parts: Array<string | number>): () => number {
  return mulberry32(seedFrom(...parts))
}

/** A stable value in [0, 1) for a given key. Used for "is this word transformed?". */
export function unitFrom(...parts: Array<string | number>): number {
  return seedFrom(...parts) / 4294967296
}

/** In-place Fisher-Yates using the supplied generator. */
export function shuffleInPlace<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}
