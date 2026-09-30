/**
 * The two data resources the heuristic can use, and honest behaviour when they
 * are missing.
 *
 * Both are optional. If they have not loaded, the features that depend on them
 * report `null` and the difficulty score is computed from the remaining features
 * with the weights renormalised. Nothing is invented to fill the gap.
 */

/** Word frequencies on the Zipf scale: log10(occurrences per billion tokens). */
export interface Lexicon {
  readonly size: number
  has(word: string): boolean
  /** Zipf frequency, or undefined when the word is not in the list. */
  zipf(word: string): number | undefined
}

export interface NgramModel {
  bigramLogProb(gram: string): number
  trigramLogProb(gram: string): number
  /** Mean log10 probability of the word's trigrams, with word-boundary padding. */
  meanTrigramLogProb(word: string): number
  /** Mean log10 probability of the word's bigrams, with word-boundary padding. */
  meanBigramLogProb(word: string): number
}

export interface Resources {
  lexicon: Lexicon | null
  ngrams: NgramModel | null
}

export const EMPTY_RESOURCES: Resources = { lexicon: null, ngrams: null }

export function parseLexicon(text: string): Lexicon {
  const map = new Map<string, number>()
  for (const line of text.split('\n')) {
    if (!line) continue
    const space = line.indexOf(' ')
    if (space < 1) continue
    map.set(line.slice(0, space), Number(line.slice(space + 1)))
  }
  return {
    size: map.size,
    has: (word) => map.has(word.toLowerCase()),
    zipf: (word) => map.get(word.toLowerCase()),
  }
}

interface NgramPayload {
  bigrams: Record<string, number>
  trigrams: Record<string, number>
  smoothing: { bigramFloor: number; trigramFloor: number }
}

export function buildNgramModel(payload: NgramPayload): NgramModel {
  const { bigrams, trigrams, smoothing } = payload

  const bigramLogProb = (gram: string) => bigrams[gram] ?? smoothing.bigramFloor
  const trigramLogProb = (gram: string) => trigrams[gram] ?? smoothing.trigramFloor

  const mean = (word: string, n: number, lookup: (g: string) => number) => {
    const padded = `^${word.toLowerCase()}$`
    if (padded.length < n) return 0
    let total = 0
    let count = 0
    for (let i = 0; i + n <= padded.length; i++) {
      total += lookup(padded.slice(i, i + n))
      count++
    }
    return count === 0 ? 0 : total / count
  }

  return {
    bigramLogProb,
    trigramLogProb,
    meanBigramLogProb: (word) => mean(word, 2, bigramLogProb),
    meanTrigramLogProb: (word) => mean(word, 3, trigramLogProb),
  }
}

/**
 * Loads both resources. Failures are not fatal: the site works without them, with
 * the lexical-interference feature reported as unavailable.
 */
export async function loadResources(base = import.meta.env.BASE_URL ?? '/'): Promise<Resources> {
  const prefix = base.endsWith('/') ? base : `${base}/`
  const [lexicon, ngrams] = await Promise.all([
    fetch(`${prefix}data/lexicon.txt`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then(parseLexicon)
      .catch(() => null),
    fetch(`${prefix}data/ngrams.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(buildNgramModel)
      .catch(() => null),
  ])
  return { lexicon, ngrams }
}
