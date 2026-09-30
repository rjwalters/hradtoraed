/**
 * Turning a slider position into transformed text.
 *
 * The important design decision: difficulty does not mean "do more swaps". For
 * each word we build its legal rearrangements once, score them, sort them, and
 * then use the slider to pick a percentile of that distribution. So a word can
 * look qualitatively different at 30 and at 80 rather than merely more shuffled,
 * and dragging back to 30 returns exactly what was there before.
 *
 * Everything is a pure function of (text, difficulty, seed, preset). There is no
 * running random stream anywhere.
 */

import { computeFeatures, type PermutationFeatures } from './features'
import { EMPTY_RESOURCES, type Resources } from './lexicon'
import {
  DEFAULT_CANDIDATE_OPTIONS,
  generateCandidates,
  type CandidateOptions,
} from './permutations'
import { PRESETS, scoreBreakdown, type PresetName, type ScoreBreakdown } from './difficulty'
import { rngFrom, unitFrom } from './seededRandom'
import { tokenize, type Token } from './tokenize'

export interface TransformSettings {
  /** 0..100. 0 leaves the text exactly as written. */
  difficulty: number
  seed: number
  preset: PresetName
}

export const DEFAULT_SETTINGS: TransformSettings = {
  difficulty: 35,
  seed: 1,
  preset: 'balanced',
}

/**
 * How the slider maps onto "how many words" and "how hard a rearrangement".
 *
 * Kept in one object because the mapping is exploratory and will be the first
 * thing we change once there is any behavioural data.
 */
export interface SliderMapping {
  /** Difficulty at which every eligible word is being transformed. */
  fullCoverageAt: number
  /** Coverage never drops below this once the slider leaves zero. */
  minCoverage: number
  /** Percentile floor, so even the gentlest setting is not always the identity. */
  minPercentile: number
  /** How much the reshuffle seed may nudge the chosen percentile. */
  percentileJitter: number
}

export const DEFAULT_MAPPING: SliderMapping = {
  fullCoverageAt: 45,
  minCoverage: 0.12,
  minPercentile: 0,
  percentileJitter: 0.08,
}

export function coverageFor(difficulty: number, mapping = DEFAULT_MAPPING): number {
  if (difficulty <= 0) return 0
  const ramp = difficulty / mapping.fullCoverageAt
  return Math.min(1, Math.max(mapping.minCoverage, ramp))
}

export function percentileFor(difficulty: number, mapping = DEFAULT_MAPPING): number {
  if (difficulty <= 0) return 0
  return Math.min(1, Math.max(mapping.minPercentile, difficulty / 100))
}

export interface ScoredCandidate {
  permutation: string
  features: PermutationFeatures
  breakdown: ScoreBreakdown
}

export interface TransformedToken {
  kind: 'word' | 'gap'
  /** As written. */
  original: string
  /** As displayed. Equal to `original` when nothing was changed. */
  shown: string
  changed: boolean
  /** Populated for changed words only. */
  detail?: {
    score: number
    /** Where the chosen rearrangement sits in this word's own difficulty distribution. */
    percentile: number
    candidateCount: number
    candidateIndex: number
    features: PermutationFeatures
    breakdown: ScoreBreakdown
  }
}

export interface TransformResult {
  tokens: TransformedToken[]
  text: string
  stats: {
    words: number
    eligible: number
    changed: number
    meanScore: number | null
    /** True when the lexical feature was unavailable for every word. */
    lexicalUnavailable: boolean
  }
}

/**
 * Candidate generation and scoring is by far the expensive part, so it is cached
 * per (word, preset, seed). Slider movement then costs only an array index, which
 * is what keeps a long article responsive while dragging.
 */
export class ScrambleEngine {
  private cache = new Map<string, ScoredCandidate[]>()
  /**
   * Bumped whenever the cache is dropped, so memoised callers (the scrambled
   * headings, the essay's demos) know to recompute when the data files land.
   */
  private version = 0
  private resources: Resources
  private candidateOptions: CandidateOptions
  private mapping: SliderMapping

  constructor(
    resources: Resources = EMPTY_RESOURCES,
    candidateOptions: CandidateOptions = DEFAULT_CANDIDATE_OPTIONS,
    mapping: SliderMapping = DEFAULT_MAPPING,
  ) {
    this.resources = resources
    this.candidateOptions = candidateOptions
    this.mapping = mapping
  }

  setResources(resources: Resources): void {
    this.resources = resources
    this.cache.clear()
    this.version++
  }

  /** Changes when the scoring inputs change. Safe to use as a memo dependency. */
  get cacheVersion(): number {
    return this.version
  }

  getResources(): Resources {
    return this.resources
  }

  /**
   * Every legal rearrangement of `word` we are willing to consider, ordered from
   * lowest to highest scramble score.
   */
  candidatesFor(word: string, settings: TransformSettings): ScoredCandidate[] {
    const key = `${settings.preset}\u0000${settings.seed}\u0000${word}`
    const cached = this.cache.get(key)
    if (cached) return cached

    const preset = PRESETS[settings.preset]
    const rng = rngFrom('candidates', settings.seed, word)
    const permutations = generateCandidates(word, rng, this.candidateOptions)

    const scored: ScoredCandidate[] = permutations.map((permutation) => {
      const features = computeFeatures(word, permutation, this.resources)
      return { permutation, features, breakdown: scoreBreakdown(features, preset.weights) }
    })

    // Sort keys are precomputed rather than derived inside the comparator: a
    // comparator that consumes a random stream is not a consistent ordering, and
    // Array.sort would then give engine-dependent results.
    if (preset.ignoreScore) {
      // The control condition: order at random, so the slider picks arbitrary
      // rearrangements rather than systematically harder ones.
      const keyed = scored.map((candidate) => ({
        candidate,
        key: unitFrom('control-order', settings.seed, word, candidate.permutation),
      }))
      keyed.sort((a, b) => a.key - b.key || compareStrings(a.candidate, b.candidate))
      return this.store(key, keyed.map((k) => k.candidate))
    }

    scored.sort((a, b) => a.breakdown.score - b.breakdown.score || compareStrings(a, b))
    return this.store(key, scored)
  }

  private store(key: string, candidates: ScoredCandidate[]): ScoredCandidate[] {
    this.cache.set(key, candidates)
    return candidates
  }

  /**
   * Which rearrangement this word gets at this slider position, or null for none.
   * `indexOffset` lets the inspector step to a neighbouring candidate without
   * disturbing anything else on the page.
   */
  chooseFor(
    word: string,
    settings: TransformSettings,
    indexOffset = 0,
  ): {
    candidate: ScoredCandidate
    index: number
    percentile: number
    total: number
  } | null {
    const candidates = this.candidatesFor(word, settings)
    if (candidates.length === 0) return null

    const jitter =
      (unitFrom('jitter', settings.seed, word) - 0.5) * this.mapping.percentileJitter
    const target = Math.min(
      1,
      Math.max(0, percentileFor(settings.difficulty, this.mapping) + jitter),
    )

    let index = Math.round(target * (candidates.length - 1)) + indexOffset
    index = ((index % candidates.length) + candidates.length) % candidates.length

    return {
      candidate: candidates[index],
      index,
      percentile: candidates.length === 1 ? 1 : index / (candidates.length - 1),
      total: candidates.length,
    }
  }

  transform(text: string, settings: TransformSettings): TransformResult {
    const tokens = tokenize(text)
    return this.applyToTokens(tokens, settings)
  }

  private applyToTokens(tokens: Token[], settings: TransformSettings): TransformResult {
    const coverage = coverageFor(settings.difficulty, this.mapping)
    const out: TransformedToken[] = []

    let words = 0
    let eligible = 0
    let changed = 0
    let scoreTotal = 0
    let lexicalSeen = false

    for (const token of tokens) {
      if (token.kind === 'gap') {
        out.push({ kind: 'gap', original: token.text, shown: token.text, changed: false })
        continue
      }

      words++
      if (!token.eligible || settings.difficulty <= 0) {
        out.push({ kind: 'word', original: token.text, shown: token.text, changed: false })
        continue
      }
      eligible++

      // Keyed on the lowercased word, so the same word looks the same everywhere
      // in the document and the reader can actually learn it. Monotone in
      // coverage, so raising the slider only ever adds words.
      const wordKey = token.text.toLowerCase()
      if (unitFrom('coverage', settings.seed, wordKey) >= coverage) {
        out.push({ kind: 'word', original: token.text, shown: token.text, changed: false })
        continue
      }

      const chosen = this.chooseFor(token.text, settings)
      if (!chosen) {
        out.push({ kind: 'word', original: token.text, shown: token.text, changed: false })
        continue
      }
      changed++
      scoreTotal += chosen.candidate.breakdown.score
      if (chosen.candidate.features.lexical) lexicalSeen = true

      out.push({
        kind: 'word',
        original: token.text,
        shown: chosen.candidate.permutation,
        changed: true,
        detail: {
          score: chosen.candidate.breakdown.score,
          percentile: chosen.percentile,
          candidateCount: chosen.total,
          candidateIndex: chosen.index,
          features: chosen.candidate.features,
          breakdown: chosen.candidate.breakdown,
        },
      })
    }

    return {
      tokens: out,
      text: out.map((t) => t.shown).join(''),
      stats: {
        words,
        eligible,
        changed,
        meanScore: changed === 0 ? null : Math.round((scoreTotal / changed) * 10) / 10,
        lexicalUnavailable: changed > 0 && !lexicalSeen,
      },
    }
  }
}

/** Locale-independent tiebreak, so candidate order never depends on the runtime. */
function compareStrings(a: ScoredCandidate, b: ScoredCandidate): number {
  return a.permutation < b.permutation ? -1 : a.permutation > b.permutation ? 1 : 0
}
