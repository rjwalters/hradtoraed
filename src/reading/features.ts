/**
 * Interpretable features of a single legal rearrangement.
 *
 * Every feature here is a description of the string, not a claim about a reader.
 * The mapping from these numbers to a difficulty score lives in difficulty.ts and
 * is a hand-tuned heuristic; these measurements are not.
 *
 * Each feature notes the published finding that motivates measuring it. None of
 * those studies fitted the weights we use, and none of them measured the
 * arbitrary permutations this site generates: they motivate the feature set, not
 * the score. See src/content/bibliography.ts for the references.
 */

import type { Resources } from './lexicon'

export interface LexicalFeatures {
  /** Zipf frequency of the original word, or null if not in the lexicon. */
  originalZipf: number | null
  /**
   * Did the rearrangement land on a *different* real English word?
   *
   * The "different" matters: an unrearranged word is trivially still a word, and
   * counting that as lexical interference would score the identity as difficult.
   */
  permutationIsWord: boolean
  /** Zipf frequency of that competing word, when there is one. */
  permutationZipf: number | null
  /**
   * permutationZipf - originalZipf. Positive means the string the reader sees is
   * a *more* common word than the one that was written.
   */
  frequencyAdvantage: number | null
}

export interface PermutationFeatures {
  original: string
  permutation: string
  length: number
  internalLength: number

  /** Mean number of positions an internal character moved. */
  meanDisplacement: number
  maxDisplacement: number
  /** Fraction of internal characters that did not stay put. */
  movedFraction: number

  /**
   * Displacement weighted towards the start of the word, normalised to 0..1.
   * White, Johnson, Liversedge & Rayner (2008) found transpositions near the
   * beginning of a word disrupt reading substantially more than ones near the end.
   */
  beginningWeightedDisplacement: number

  /**
   * Adjacent letter pairs from the original that survive. Davis's discussion of
   * the meme, and the open-bigram family of letter-position models, both treat
   * surviving letter sequences as carrying much of the evidence for word identity.
   */
  bigramsPreserved: number
  bigramsTotal: number
  trigramsPreserved: number
  trigramsTotal: number

  /**
   * Of the characters that moved, the fraction that are vowels. Lupker, Perea &
   * Davis (2008) found transposed-letter priming for consonant transpositions but
   * not vowel transpositions, so moving vowels appears to damage word identity more.
   */
  movedVowelRatio: number

  /**
   * How much less English-like the rearrangement looks, in mean log10 trigram
   * probability relative to the original. Null when the n-gram model is absent.
   */
  orthographicPenalty: number | null
  orthographicLogProb: number | null

  /** Null when no lexicon is loaded. */
  lexical: LexicalFeatures | null
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y'])

/**
 * Where did each character go?
 *
 * Repeated letters need care: in "letter" -> "lteter" the two t's should be
 * matched so that total movement is minimal, otherwise identical letters swapping
 * with each other inflates displacement for a string that did not really change.
 * Matching the k-th occurrence in the original to the k-th occurrence in the
 * permutation is the optimal assignment for this cost in one dimension.
 */
function displacements(original: string[], permuted: string[]): number[] {
  const originalPositions = new Map<string, number[]>()
  original.forEach((ch, i) => {
    const list = originalPositions.get(ch)
    if (list) list.push(i)
    else originalPositions.set(ch, [i])
  })

  const cursor = new Map<string, number>()
  return permuted.map((ch, newIndex) => {
    const positions = originalPositions.get(ch)
    /* c8 ignore next */
    if (!positions) return 0
    const k = cursor.get(ch) ?? 0
    cursor.set(ch, k + 1)
    return Math.abs(positions[k] - newIndex)
  })
}

function countPreservedNgrams(original: string, permutation: string, n: number): [number, number] {
  if (original.length < n) return [0, 0]
  const originalGrams = new Map<string, number>()
  for (let i = 0; i + n <= original.length; i++) {
    const g = original.slice(i, i + n)
    originalGrams.set(g, (originalGrams.get(g) ?? 0) + 1)
  }
  const total = original.length - n + 1
  let preserved = 0
  const remaining = new Map(originalGrams)
  for (let i = 0; i + n <= permutation.length; i++) {
    const g = permutation.slice(i, i + n)
    const left = remaining.get(g) ?? 0
    if (left > 0) {
      preserved++
      remaining.set(g, left - 1)
    }
  }
  return [preserved, total]
}

export function computeFeatures(
  original: string,
  permutation: string,
  resources: Resources,
): PermutationFeatures {
  const lowerOriginal = original.toLowerCase()
  const lowerPermutation = permutation.toLowerCase()

  const originalChars = Array.from(lowerOriginal)
  const permutedChars = Array.from(lowerPermutation)
  const internalOriginal = originalChars.slice(1, -1)
  const internalPermuted = permutedChars.slice(1, -1)
  const internalLength = internalOriginal.length

  const moved = displacements(internalOriginal, internalPermuted)
  const meanDisplacement = internalLength === 0 ? 0 : sum(moved) / internalLength
  const maxDisplacement = moved.length === 0 ? 0 : Math.max(...moved)
  const movedCount = moved.filter((d) => d > 0).length
  const movedFraction = internalLength === 0 ? 0 : movedCount / internalLength

  // Weight by distance from the word beginning. Internal position 0 here is the
  // word's second character, the earliest one that is allowed to move at all.
  let weightedMovement = 0
  let weightSum = 0
  for (let i = 0; i < internalLength; i++) {
    const weight = Math.exp(-i / 2.5)
    weightedMovement += weight * moved[i]
    weightSum += weight
  }
  const maxPerPosition = Math.max(1, internalLength - 1)
  const beginningWeightedDisplacement =
    weightSum === 0 ? 0 : clamp01(weightedMovement / (weightSum * maxPerPosition))

  const [bigramsPreserved, bigramsTotal] = countPreservedNgrams(
    lowerOriginal,
    lowerPermutation,
    2,
  )
  const [trigramsPreserved, trigramsTotal] = countPreservedNgrams(
    lowerOriginal,
    lowerPermutation,
    3,
  )

  let movedVowels = 0
  for (let i = 0; i < internalLength; i++) {
    if (moved[i] > 0 && VOWELS.has(internalOriginal[i])) movedVowels++
  }
  const movedVowelRatio = movedCount === 0 ? 0 : movedVowels / movedCount

  let orthographicLogProb: number | null = null
  let orthographicPenalty: number | null = null
  if (resources.ngrams) {
    orthographicLogProb = resources.ngrams.meanTrigramLogProb(lowerPermutation)
    orthographicPenalty =
      resources.ngrams.meanTrigramLogProb(lowerOriginal) - orthographicLogProb
  }

  let lexical: LexicalFeatures | null = null
  if (resources.lexicon) {
    const isIdentity = lowerPermutation === lowerOriginal
    const originalZipf = resources.lexicon.zipf(lowerOriginal) ?? null
    const permutationZipf = isIdentity ? null : resources.lexicon.zipf(lowerPermutation) ?? null
    lexical = {
      originalZipf,
      permutationIsWord: permutationZipf !== null,
      permutationZipf,
      frequencyAdvantage:
        permutationZipf !== null && originalZipf !== null
          ? Number((permutationZipf - originalZipf).toFixed(2))
          : null,
    }
  }

  return {
    original,
    permutation,
    length: originalChars.length,
    internalLength,
    meanDisplacement,
    maxDisplacement,
    movedFraction,
    beginningWeightedDisplacement,
    bigramsPreserved,
    bigramsTotal,
    trigramsPreserved,
    trigramsTotal,
    movedVowelRatio,
    orthographicPenalty,
    orthographicLogProb,
    lexical,
  }
}

function sum(values: number[]): number {
  let total = 0
  for (const v of values) total += v
  return total
}

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}
