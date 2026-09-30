/**
 * Turning features into a single number.
 *
 * This is the weakest link in the project and it is labelled as such everywhere
 * it surfaces. The features in features.ts are motivated by published findings,
 * but the weights below are hand-tuned guesses. No behavioural data has been
 * collected against them.
 *
 * That is why the number is called a **scramble score** rather than a predicted
 * reading difficulty. The name gets upgraded when it is earned.
 *
 * The whole model is a weighted mean of 0..1 terms, deliberately so: it is easy
 * to explain in the word inspector, easy to argue with, and easy to replace with
 * something fitted later.
 */

import { clamp01, type PermutationFeatures } from './features'

export interface DifficultyWeights {
  displacement: number
  beginning: number
  bigrams: number
  trigrams: number
  vowels: number
  orthographic: number
  lexical: number
}

export type PresetName = 'balanced' | 'local' | 'adversarial' | 'random'

export interface Preset {
  name: PresetName
  label: string
  description: string
  weights: DifficultyWeights
  /**
   * Ignore the scoring entirely and order candidates at random. This is the
   * control condition: it is what every other scrambled-text generator does.
   */
  ignoreScore?: boolean
}

export const PRESETS: Record<PresetName, Preset> = {
  balanced: {
    name: 'balanced',
    label: 'Balanced',
    description:
      'Every feature contributes. The default reading of our difficulty heuristic.',
    weights: {
      displacement: 1,
      beginning: 1.4,
      bigrams: 1,
      trigrams: 1.2,
      vowels: 0.5,
      orthographic: 0.8,
      lexical: 1.2,
    },
  },
  local: {
    name: 'local',
    label: 'Preserve local pairs',
    description:
      'Scores mainly on destroyed letter sequences, so the slider hunts for rearrangements that keep familiar chunks intact for as long as possible.',
    weights: {
      displacement: 0.4,
      beginning: 0.4,
      bigrams: 2,
      trigrams: 2.4,
      vowels: 0.2,
      orthographic: 1.2,
      lexical: 0.3,
    },
  },
  adversarial: {
    name: 'adversarial',
    label: 'Adversarial',
    description:
      'Weighted hard towards rearrangements that land on, or near, a more common English word. Needs the word list; falls back to Balanced without it.',
    weights: {
      displacement: 0.4,
      beginning: 0.8,
      bigrams: 0.4,
      trigrams: 0.5,
      vowels: 0.3,
      orthographic: 0.4,
      lexical: 5,
    },
  },
  random: {
    name: 'random',
    label: 'Random (control)',
    description:
      'No scoring at all. Rearrangements are picked at random, the way ordinary typoglycemia generators work. Use it to check whether our scoring is doing anything.',
    weights: {
      displacement: 1,
      beginning: 1,
      bigrams: 1,
      trigrams: 1,
      vowels: 1,
      orthographic: 1,
      lexical: 1,
    },
    ignoreScore: true,
  },
}

export interface ScoreTerm {
  key: keyof DifficultyWeights
  label: string
  /** 0..1 contribution before weighting, or null when the input is unavailable. */
  value: number | null
  weight: number
  explanation: string
}

export interface ScoreBreakdown {
  /** 0..100. */
  score: number
  terms: ScoreTerm[]
  /** True when some term was dropped because its data was not loaded. */
  partial: boolean
}

/**
 * Displacement is normalised against half the internal length, which is roughly
 * the mean displacement of a uniformly random rearrangement. So ~1.0 means "as
 * scattered as chance", and the scale stays comparable across word lengths.
 */
function displacementTerm(f: PermutationFeatures): number {
  const reference = Math.max(1, f.internalLength / 2)
  return clamp01(f.meanDisplacement / reference)
}

function ngramTerm(preserved: number, total: number): number | null {
  if (total === 0) return null
  return clamp01(1 - preserved / total)
}

/**
 * Lexical interference, the one term with a real theoretical claim behind it.
 *
 * Acha & Perea (2008) and Pagán, Paterson, Blythe & Liversedge (2016) report that
 * a word with a higher-frequency transposed-letter neighbour is read more slowly.
 * Johnson, Koch & Wootten (2024) report readers straightforwardly misreading one
 * neighbour as the other. So landing the rearrangement on a real word should be
 * costly, and landing it on a *commoner* word than the one actually written
 * should be worse.
 */
function lexicalTerm(f: PermutationFeatures): number | null {
  if (!f.lexical) return null
  if (!f.lexical.permutationIsWord) return 0
  const advantage = f.lexical.frequencyAdvantage
  if (advantage === null) return 0.7
  // -2 (landed on something much rarer) .. +2 (landed on something much commoner)
  return clamp01(0.55 + 0.45 * clamp01((advantage + 1) / 3))
}

/**
 * Orthographic penalty is in log10 units of mean trigram probability. A drop of
 * about 1.5 is a thoroughly un-English-looking string.
 */
function orthographicTerm(f: PermutationFeatures): number | null {
  if (f.orthographicPenalty === null) return null
  return clamp01(f.orthographicPenalty / 1.5)
}

export function scoreBreakdown(
  features: PermutationFeatures,
  weights: DifficultyWeights,
): ScoreBreakdown {
  const terms: ScoreTerm[] = [
    {
      key: 'displacement',
      label: 'Letter displacement',
      value: displacementTerm(features),
      weight: weights.displacement,
      explanation: 'How far internal letters moved, relative to a random rearrangement.',
    },
    {
      key: 'beginning',
      label: 'Disruption near the word start',
      value: features.beginningWeightedDisplacement,
      weight: weights.beginning,
      explanation: 'The same movement, weighted towards the beginning of the word.',
    },
    {
      key: 'bigrams',
      label: 'Letter pairs destroyed',
      value: ngramTerm(features.bigramsPreserved, features.bigramsTotal),
      weight: weights.bigrams,
      explanation: 'Adjacent pairs from the original that no longer appear.',
    },
    {
      key: 'trigrams',
      label: 'Letter triples destroyed',
      value: ngramTerm(features.trigramsPreserved, features.trigramsTotal),
      weight: weights.trigrams,
      explanation: 'Three-letter sequences from the original that no longer appear.',
    },
    {
      key: 'vowels',
      label: 'Vowels moved',
      value: features.movedVowelRatio,
      weight: weights.vowels,
      explanation: 'Of the letters that moved, how many were vowels.',
    },
    {
      key: 'orthographic',
      label: 'Looks un-English',
      value: orthographicTerm(features),
      weight: weights.orthographic,
      explanation: 'Drop in letter-sequence probability against an English letter model.',
    },
    {
      key: 'lexical',
      label: 'Competing word',
      value: lexicalTerm(features),
      weight: weights.lexical,
      explanation: 'Whether the rearrangement is itself a word, and how common that word is.',
    },
  ]

  let weighted = 0
  let weightSum = 0
  let partial = false
  for (const term of terms) {
    if (term.value === null) {
      partial = true
      continue
    }
    weighted += term.value * term.weight
    weightSum += term.weight
  }

  const raw = weightSum === 0 ? 0 : weighted / weightSum
  return { score: Math.round(raw * 1000) / 10, terms, partial }
}

export function scrambleScore(
  features: PermutationFeatures,
  weights: DifficultyWeights,
): number {
  return scoreBreakdown(features, weights).score
}
