/**
 * Generating the legal rearrangements of a word.
 *
 * The one rule the whole site is built on: the first character, the last
 * character and the exact multiset of internal characters are preserved. Only the
 * order of the internal characters may change.
 */

import { shuffleInPlace } from './seededRandom'

export interface CandidateOptions {
  /**
   * Internal lengths up to this are enumerated exhaustively. 6 internal
   * characters is 720 orderings, which stays fast across a whole article once
   * results are cached per word. Beyond that we sample.
   */
  maxEnumerateInternal: number
  /** How many distinct orderings to sample for words too long to enumerate. */
  sampleCount: number
  /** Give up sampling after this many draws, in case few distinct orderings exist. */
  maxSampleAttempts: number
}

export const DEFAULT_CANDIDATE_OPTIONS: CandidateOptions = {
  maxEnumerateInternal: 6,
  sampleCount: 400,
  maxSampleAttempts: 3000,
}

export function internalOf(word: string): string[] {
  return Array.from(word).slice(1, -1)
}

export function assemble(word: string, internal: string[]): string {
  const chars = Array.from(word)
  return chars[0] + internal.join('') + chars[chars.length - 1]
}

/**
 * Every distinct ordering of a multiset, in lexicographic order, via repeated
 * next-permutation. Distinctness is structural, so repeated letters never produce
 * duplicate strings and no Set is needed.
 */
function* distinctPermutations(items: string[], limit: number): Generator<string[]> {
  const current = [...items].sort()
  let produced = 0
  for (;;) {
    yield [...current]
    if (++produced >= limit) return

    // next_permutation
    let i = current.length - 2
    while (i >= 0 && current[i] >= current[i + 1]) i--
    if (i < 0) return
    let j = current.length - 1
    while (current[j] <= current[i]) j--
    ;[current[i], current[j]] = [current[j], current[i]]
    for (let lo = i + 1, hi = current.length - 1; lo < hi; lo++, hi--) {
      ;[current[lo], current[hi]] = [current[hi], current[lo]]
    }
  }
}

/** Upper bound on distinct orderings of a multiset, saturating at `cap`. */
export function countDistinctPermutations(items: string[], cap = Number.MAX_SAFE_INTEGER): number {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1)
  let total = 1
  let n = 0
  for (const count of counts.values()) {
    for (let k = 1; k <= count; k++) {
      n++
      total = (total * n) / k
      if (total > cap) return cap
    }
  }
  return Math.round(total)
}

/**
 * The legal rearrangements of `word`, excluding the word itself.
 *
 * Returns an empty array when no rearrangement is possible, which happens for
 * short words and for words whose internal letters are all the same ("cool",
 * "eerie"). Those simply stay as they are at every difficulty.
 */
export function generateCandidates(
  word: string,
  rng: () => number,
  options: CandidateOptions = DEFAULT_CANDIDATE_OPTIONS,
): string[] {
  const internal = internalOf(word)
  if (internal.length < 2) return []

  const distinct = countDistinctPermutations(internal, options.sampleCount * 4)
  if (distinct <= 1) return []

  const out: string[] = []

  if (internal.length <= options.maxEnumerateInternal) {
    // Exhaustive: the candidate set is the entire legal space for this word.
    for (const perm of distinctPermutations(internal, Number.MAX_SAFE_INTEGER)) {
      const candidate = assemble(word, perm)
      if (candidate !== word) out.push(candidate)
    }
    return out
  }

  // Sampled, and deliberately stratified rather than uniform.
  //
  // A uniform draw from the orderings of a long word is overwhelmingly made of
  // total scatters: for a 12-letter interior, essentially nothing in a random
  // sample looks like a single swap. That would leave long words with no gentle
  // end at all, so "rearrangements" would explode into noise while short words
  // beside it were still only lightly disturbed.
  //
  // Instead we sample across the whole range of disturbance, from one
  // transposition up to a full shuffle, so a long word's candidate list spans the
  // same kind of spread that enumeration gives a short one.
  const seen = new Set<string>([word])
  const add = (arrangement: string[]): void => {
    const candidate = assemble(word, arrangement)
    if (seen.has(candidate)) return
    seen.add(candidate)
    out.push(candidate)
  }

  const n = internal.length

  // Every single transposition: the gentlest legal moves there are, adjacent
  // swaps among them.
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const swapped = [...internal]
      ;[swapped[i], swapped[j]] = [swapped[j], swapped[i]]
      add(swapped)
    }
  }

  // Then progressively more transpositions, filling the middle of the range.
  const perLevel = Math.max(8, Math.floor(options.sampleCount / (2 * n)))
  for (let k = 2; k <= n && out.length < options.sampleCount; k++) {
    for (let t = 0; t < perLevel && out.length < options.sampleCount; t++) {
      const arrangement = [...internal]
      for (let s = 0; s < k; s++) {
        const i = Math.floor(rng() * n)
        const j = Math.floor(rng() * n)
        ;[arrangement[i], arrangement[j]] = [arrangement[j], arrangement[i]]
      }
      add(arrangement)
    }
  }

  // Top up with full shuffles so the hard end is properly represented.
  let attempts = 0
  while (out.length < options.sampleCount && attempts < options.maxSampleAttempts) {
    attempts++
    add(shuffleInPlace([...internal], rng))
  }

  return out
}
