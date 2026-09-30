import { describe, expect, it, beforeAll } from 'vitest'
import fc from 'fast-check'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { tokenize, detokenize, caseShapeOf } from './tokenize'
import { generateCandidates, internalOf, countDistinctPermutations } from './permutations'
import { computeFeatures } from './features'
import { PRESETS, scoreBreakdown } from './difficulty'
import { ScrambleEngine, coverageFor, percentileFor, type TransformSettings } from './transform'
import { parseLexicon, buildNgramModel, EMPTY_RESOURCES, type Resources } from './lexicon'
import { rngFrom, unitFrom, seedFrom } from './seededRandom'

const dataDir = join(__dirname, '..', '..', 'public', 'data')

let resources: Resources

beforeAll(() => {
  resources = {
    lexicon: parseLexicon(readFileSync(join(dataDir, 'lexicon.txt'), 'utf8')),
    ngrams: buildNgramModel(JSON.parse(readFileSync(join(dataDir, 'ngrams.json'), 'utf8'))),
  }
})

const settings = (over: Partial<TransformSettings> = {}): TransformSettings => ({
  difficulty: 50,
  seed: 1,
  preset: 'balanced',
  ...over,
})

// ---------------------------------------------------------------- tokenize

describe('tokenize', () => {
  it('round-trips arbitrary text exactly', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        expect(detokenize(tokenize(text))).toBe(text)
      }),
      { numRuns: 500 },
    )
  })

  it('round-trips text with unicode, punctuation and whitespace', () => {
    const samples = [
      'Hello, world! Isn’t it lovely?',
      'naïve café résumé — straße',
      '  leading and trailing   \n\n\ttabs  ',
      'emoji \u{1F9E0} between \u{1F4D6} words',
      '',
      'a',
    ]
    for (const s of samples) expect(detokenize(tokenize(s))).toBe(s)
  })

  const eligibleWords = (text: string) =>
    tokenize(text)
      .filter((t) => t.kind === 'word' && t.eligible)
      .map((t) => t.text)

  it('leaves short words alone', () => {
    expect(eligibleWords('a an the cat word')).toEqual(['word'])
  })

  it('protects urls, emails, domains and code-like tokens', () => {
    const text =
      'Visit https://example.com/reading or hradtoraed.com, mail someone@example.org, ' +
      'run build_lexicon(), see config.json and snake_case_name plus version 12 and h2o.'
    // "reading" is inside the URL path and "someone" inside the email address, so
    // both are protected along with the chunk that contains them.
    expect(eligibleWords(text)).toEqual(['Visit', 'mail', 'plus', 'version'])
  })

  it('leaves contractions and possessives alone', () => {
    expect(eligibleWords("wouldn't Rachel's readers")).toEqual(['readers'])
  })

  it('leaves mixed case and all caps alone', () => {
    expect(eligibleWords('camelCase McDonald NASA HTTP reading Reading')).toEqual([
      'reading',
      'Reading',
    ])
  })

  it('leaves combining marks alone but allows precomposed letters', () => {
    expect(eligibleWords('café cafés')).toEqual(['cafés'])
  })

  it('classifies case shape', () => {
    expect(caseShapeOf('reading')).toBe('lower')
    expect(caseShapeOf('Reading')).toBe('capitalized')
    expect(caseShapeOf('READING')).toBe('upper')
    expect(caseShapeOf('camelCase')).toBe('mixed')
  })

  it('splits hyphenated words into independently eligible parts', () => {
    expect(eligibleWords('well-known reading-time')).toEqual([
      'well',
      'known',
      'reading',
      'time',
    ])
  })
})

// ------------------------------------------------------------ permutations

describe('permutations', () => {
  it('counts distinct permutations of a multiset', () => {
    expect(countDistinctPermutations(['a', 'b', 'c'])).toBe(6)
    expect(countDistinctPermutations(['a', 'a', 'b'])).toBe(3)
    expect(countDistinctPermutations(['a', 'a', 'a'])).toBe(1)
    expect(countDistinctPermutations(['a', 'b', 'c', 'd'], 5)).toBe(5)
  })

  it('enumerates exactly the legal rearrangements of a short word', () => {
    // "word" -> internal "or" -> one alternative, "wrod".
    expect(generateCandidates('word', rngFrom('t'))).toEqual(['wrod'])
  })

  it('returns nothing when the internal letters are all identical', () => {
    expect(generateCandidates('cool', rngFrom('t'))).toEqual([])
    expect(generateCandidates('a', rngFrom('t'))).toEqual([])
    expect(generateCandidates('to', rngFrom('t'))).toEqual([])
  })

  it('never produces duplicates, even with repeated letters', () => {
    for (const word of ['letter', 'banana', 'assess', 'bookkeeper', 'mississippi']) {
      const candidates = generateCandidates(word, rngFrom('t'))
      expect(new Set(candidates).size).toBe(candidates.length)
      expect(candidates).not.toContain(word)
    }
  })

  it('includes every adjacent swap for long sampled words', () => {
    const word = 'extraordinarily'
    const candidates = new Set(generateCandidates(word, rngFrom('t')))
    const internal = internalOf(word)
    for (let i = 0; i < internal.length - 1; i++) {
      const swapped = [...internal]
      ;[swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]]
      const expected = word[0] + swapped.join('') + word[word.length - 1]
      if (expected !== word) expect(candidates.has(expected)).toBe(true)
    }
  })

  it('is deterministic for a given seed and differs across seeds', () => {
    const a = generateCandidates('extraordinarily', rngFrom('seed', 1))
    const b = generateCandidates('extraordinarily', rngFrom('seed', 1))
    const c = generateCandidates('extraordinarily', rngFrom('seed', 2))
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
  })
})

// ----------------------------------------------------- the core invariants

/**
 * The rule the entire site rests on. If any of these ever fail we are no longer
 * manipulating only character order, and every claim on the page is void.
 */
describe('permutation invariants', () => {
  const sorted = (s: string) => Array.from(s).sort().join('')

  const checkInvariants = (original: string, permutation: string) => {
    const o = Array.from(original)
    const p = Array.from(permutation)
    expect(p.length).toBe(o.length)
    expect(p[0]).toBe(o[0])
    expect(p[p.length - 1]).toBe(o[o.length - 1])
    expect(sorted(p.slice(1, -1).join(''))).toBe(sorted(o.slice(1, -1).join('')))
    expect(sorted(permutation)).toBe(sorted(original))
  }

  it('holds for every candidate of a fixed word set', () => {
    const words = [
      'word', 'reading', 'problem', 'letter', 'banana', 'assess', 'judge',
      'Reading', 'Problem', 'cafés', 'extraordinarily', 'bookkeeper',
    ]
    for (const word of words) {
      for (const candidate of generateCandidates(word, rngFrom('inv', word))) {
        checkInvariants(word, candidate)
      }
    }
  })

  it('holds for arbitrary generated words', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{4,9}$/),
        fc.integer({ min: 0, max: 1000 }),
        (word, seed) => {
          for (const candidate of generateCandidates(word, rngFrom('inv', seed))) {
            checkInvariants(word, candidate)
          }
        },
      ),
      { numRuns: 200 },
    )
  })

  it('holds for every word the engine actually renders, at every difficulty', () => {
    const engine = new ScrambleEngine(resources)
    const text =
      'It is surprising how much you can change the letters inside a word and still ' +
      'read it. But some rearrangements are much harder to read than others. Why?'
    for (let d = 0; d <= 100; d += 5) {
      for (const preset of Object.keys(PRESETS) as Array<keyof typeof PRESETS>) {
        const result = engine.transform(text, settings({ difficulty: d, preset }))
        for (const token of result.tokens) {
          if (token.changed) checkInvariants(token.original, token.shown)
        }
      }
    }
  })
})

// ----------------------------------------------------------------- features

describe('features', () => {
  it('does not treat an unrearranged word as a competing word', () => {
    const f = computeFeatures('reading', 'reading', resources)
    expect(f.lexical?.permutationIsWord).toBe(false)
    expect(f.lexical?.originalZipf).toBeGreaterThan(0)
  })

  it('reports no movement for an identical string', () => {
    const f = computeFeatures('reading', 'reading', resources)
    expect(f.meanDisplacement).toBe(0)
    expect(f.movedFraction).toBe(0)
    expect(f.bigramsPreserved).toBe(f.bigramsTotal)
    expect(f.trigramsPreserved).toBe(f.trigramsTotal)
  })

  it('counts bigrams and trigrams over the whole word', () => {
    // "reading" has 7 letters: 6 bigrams, 5 trigrams.
    const f = computeFeatures('reading', 'reading', resources)
    expect(f.bigramsTotal).toBe(6)
    expect(f.trigramsTotal).toBe(5)
  })

  it('does not inflate displacement when identical letters swap', () => {
    // The two t's are interchangeable, so "letter" -> "lette r" style swaps of the
    // t's must register as no movement at all.
    const f = computeFeatures('letter', 'letter', resources)
    expect(f.meanDisplacement).toBe(0)
  })

  it('scores an adjacent swap as less displaced than a distant one', () => {
    const adjacent = computeFeatures('problem', 'porblem', resources)
    const distant = computeFeatures('problem', 'pmelbor', resources)
    expect(adjacent.meanDisplacement).toBeLessThan(distant.meanDisplacement)
  })

  it('weights movement near the word beginning more heavily', () => {
    // Same single adjacent swap, once near the start and once near the end.
    const nearStart = computeFeatures('problem', 'porblem', resources)
    const nearEnd = computeFeatures('problem', 'probelm', resources)
    expect(nearStart.meanDisplacement).toBeCloseTo(nearEnd.meanDisplacement, 10)
    expect(nearStart.beginningWeightedDisplacement).toBeGreaterThan(
      nearEnd.beginningWeightedDisplacement,
    )
  })

  it('detects when a rearrangement lands on another real word', () => {
    const calm = computeFeatures('calm', 'clam', resources)
    expect(calm.lexical?.permutationIsWord).toBe(true)
    expect(calm.lexical?.permutationZipf).toBeLessThan(calm.lexical!.originalZipf!)

    const clam = computeFeatures('clam', 'calm', resources)
    expect(clam.lexical?.permutationIsWord).toBe(true)
    // calm is the commoner word, so scrambling clam into it is the costly direction.
    expect(clam.lexical!.frequencyAdvantage!).toBeGreaterThan(0)
  })

  it('reports lexical features as unavailable without a lexicon', () => {
    const f = computeFeatures('calm', 'clam', EMPTY_RESOURCES)
    expect(f.lexical).toBeNull()
    expect(f.orthographicPenalty).toBeNull()
  })

  it('penalises un-English letter sequences', () => {
    const english = computeFeatures('problem', 'porblem', resources)
    const notEnglish = computeFeatures('problem', 'pmlboer', resources)
    expect(notEnglish.orthographicPenalty!).toBeGreaterThan(english.orthographicPenalty!)
  })
})

// --------------------------------------------------------------- difficulty

describe('difficulty', () => {
  it('scores the identity as zero and stays within 0..100', () => {
    const identity = scoreBreakdown(
      computeFeatures('reading', 'reading', resources),
      PRESETS.balanced.weights,
    )
    expect(identity.score).toBe(0)

    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{4,8}$/), (word) => {
        for (const candidate of generateCandidates(word, rngFrom('s'))) {
          const { score } = scoreBreakdown(
            computeFeatures(word, candidate, resources),
            PRESETS.balanced.weights,
          )
          expect(score).toBeGreaterThanOrEqual(0)
          expect(score).toBeLessThanOrEqual(100)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('rates an adjacent swap easier than a full scatter', () => {
    const gentle = scoreBreakdown(
      computeFeatures('problem', 'porblem', resources),
      PRESETS.balanced.weights,
    ).score
    const nasty = scoreBreakdown(
      computeFeatures('problem', 'pmelbor', resources),
      PRESETS.balanced.weights,
    ).score
    expect(gentle).toBeLessThan(nasty)
  })

  it('marks a term as unavailable rather than inventing it', () => {
    const breakdown = scoreBreakdown(
      computeFeatures('problem', 'porblem', EMPTY_RESOURCES),
      PRESETS.balanced.weights,
    )
    expect(breakdown.partial).toBe(true)
    const lexical = breakdown.terms.find((t) => t.key === 'lexical')
    expect(lexical?.value).toBeNull()
  })

  it('adversarial weighting prefers rearrangements that are real words', () => {
    const engine = new ScrambleEngine(resources)
    const adversarial = engine.candidatesFor('clam', settings({ preset: 'adversarial' }))
    const hardest = adversarial[adversarial.length - 1]
    expect(hardest.permutation).toBe('calm')
  })
})

// ---------------------------------------------------------------- transform

describe('transform', () => {
  const sample =
    'It is surprising how much you can change the letters inside a word and still ' +
    'read it. But some rearrangements are much harder to read than others. Why?'

  it('leaves text untouched at difficulty zero', () => {
    const engine = new ScrambleEngine(resources)
    const result = engine.transform(sample, settings({ difficulty: 0 }))
    expect(result.text).toBe(sample)
    expect(result.stats.changed).toBe(0)
  })

  it('always preserves the text length and non-word characters', () => {
    const engine = new ScrambleEngine(resources)
    for (let d = 0; d <= 100; d += 10) {
      const result = engine.transform(sample, settings({ difficulty: d }))
      expect(result.text.length).toBe(sample.length)
      expect(result.text.replace(/\p{L}/gu, '')).toBe(sample.replace(/\p{L}/gu, ''))
    }
  })

  it('is deterministic: 70 then 40 then 70 gives identical output', () => {
    const engine = new ScrambleEngine(resources)
    const at70 = engine.transform(sample, settings({ difficulty: 70 })).text
    engine.transform(sample, settings({ difficulty: 40 }))
    const again = engine.transform(sample, settings({ difficulty: 70 })).text
    expect(again).toBe(at70)

    // And a fresh engine with no cache agrees.
    expect(new ScrambleEngine(resources).transform(sample, settings({ difficulty: 70 })).text)
      .toBe(at70)
  })

  it('changes output when the seed changes', () => {
    const engine = new ScrambleEngine(resources)
    const a = engine.transform(sample, settings({ difficulty: 60, seed: 1 })).text
    const b = engine.transform(sample, settings({ difficulty: 60, seed: 2 })).text
    expect(b).not.toBe(a)
  })

  it('renders the same word identically everywhere in a document', () => {
    const engine = new ScrambleEngine(resources)
    const result = engine.transform('problem problem problem', settings({ difficulty: 80 }))
    const shown = result.tokens.filter((t) => t.kind === 'word').map((t) => t.shown)
    expect(new Set(shown).size).toBe(1)
  })

  it('transforms more words as the slider rises, and never fewer', () => {
    const engine = new ScrambleEngine(resources)
    let previous = -1
    for (let d = 0; d <= 100; d += 5) {
      const { changed } = engine.transform(sample, settings({ difficulty: d })).stats
      expect(changed).toBeGreaterThanOrEqual(previous)
      previous = changed
    }
  })

  it('raises the mean scramble score as the slider rises', () => {
    const engine = new ScrambleEngine(resources)
    const scoreAt = (d: number) =>
      engine.transform(sample, settings({ difficulty: d })).stats.meanScore ?? 0
    expect(scoreAt(20)).toBeLessThan(scoreAt(50))
    expect(scoreAt(50)).toBeLessThan(scoreAt(90))
  })

  it('does not raise the mean score under the random control preset', () => {
    const engine = new ScrambleEngine(resources)
    const scoreAt = (d: number) =>
      engine.transform(sample, settings({ difficulty: d, preset: 'random' })).stats.meanScore ?? 0
    // The control shuffles without scoring, so the top of the slider should not be
    // systematically harder than the middle the way Balanced is.
    const balanced = new ScrambleEngine(resources)
    const balancedGap =
      (balanced.transform(sample, settings({ difficulty: 95 })).stats.meanScore ?? 0) -
      (balanced.transform(sample, settings({ difficulty: 50 })).stats.meanScore ?? 0)
    const randomGap = scoreAt(95) - scoreAt(50)
    expect(randomGap).toBeLessThan(balancedGap)
  })

  it('picks the hardest available rearrangement at 100', () => {
    const engine = new ScrambleEngine(resources)
    const word = 'problem'
    const candidates = engine.candidatesFor(word, settings({ difficulty: 100 }))
    const chosen = engine.chooseFor(word, settings({ difficulty: 100 }))!
    // Jitter can pull the choice slightly below the very top, but never far.
    expect(chosen.percentile).toBeGreaterThan(0.95)
    expect(chosen.candidate.breakdown.score).toBeGreaterThanOrEqual(
      candidates[Math.floor(candidates.length * 0.95)].breakdown.score,
    )
  })

  it('handles a multi-thousand-word document quickly', () => {
    const engine = new ScrambleEngine(resources)
    const article = Array.from(
      { length: 400 },
      (_, i) =>
        `Paragraph ${'x'.repeat(0)} number covers reading comprehension and ` +
        `orthographic neighbourhood effects in sentence ${'y'.repeat(0)} context ${i % 7}.`,
    ).join(' ')
    const started = performance.now()
    const first = engine.transform(article, settings({ difficulty: 60 }))
    const firstPass = performance.now() - started

    const second = performance.now()
    engine.transform(article, settings({ difficulty: 65 }))
    const cachedPass = performance.now() - second

    expect(first.stats.words).toBeGreaterThan(3000)
    expect(firstPass).toBeLessThan(3000)
    // Once candidates are cached, moving the slider must be far cheaper.
    expect(cachedPass).toBeLessThan(firstPass)
  })

  it('works with no data files loaded at all', () => {
    const engine = new ScrambleEngine(EMPTY_RESOURCES)
    const result = engine.transform(sample, settings({ difficulty: 60 }))
    expect(result.stats.changed).toBeGreaterThan(0)
    expect(result.stats.lexicalUnavailable).toBe(true)
    expect(result.text.length).toBe(sample.length)
  })

  it('maps the slider to coverage and percentile as configured', () => {
    expect(coverageFor(0)).toBe(0)
    expect(percentileFor(0)).toBe(0)
    expect(coverageFor(45)).toBe(1)
    expect(coverageFor(100)).toBe(1)
    expect(coverageFor(10)).toBeLessThan(1)
    expect(percentileFor(100)).toBe(1)
  })

  it('steps to a different rearrangement on request without changing the page', () => {
    const engine = new ScrambleEngine(resources)
    const base = engine.chooseFor('problem', settings({ difficulty: 50 }))!
    const next = engine.chooseFor('problem', settings({ difficulty: 50 }), 1)!
    expect(next.candidate.permutation).not.toBe(base.candidate.permutation)
    // The page-level choice is untouched.
    expect(engine.chooseFor('problem', settings({ difficulty: 50 }))!.candidate.permutation).toBe(
      base.candidate.permutation,
    )
  })
})

// ------------------------------------------------------------- seededRandom

describe('seededRandom', () => {
  it('produces the same stream for the same seed', () => {
    const a = Array.from({ length: 8 }, rngFrom('x', 1))
    const b = Array.from({ length: 8 }, rngFrom('x', 1))
    expect(a).toEqual(b)
  })

  it('produces values in [0, 1)', () => {
    const rng = rngFrom('range')
    for (let i = 0; i < 5000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('gives stable unit values per key', () => {
    expect(unitFrom('a', 1)).toBe(unitFrom('a', 1))
    expect(unitFrom('a', 1)).not.toBe(unitFrom('a', 2))
    expect(seedFrom('a')).not.toBe(seedFrom('b'))
  })
})
