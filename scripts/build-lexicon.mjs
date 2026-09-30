/**
 * Builds the two generated data assets the difficulty heuristic depends on:
 *
 *   public/data/lexicon.txt    words with Zipf frequency, for lexical-interference detection
 *   public/data/ngrams.json    frequency-weighted English letter bigram/trigram log probabilities
 *
 * Source: hermitdave/FrequencyWords, OpenSubtitles 2018 English (en_50k).
 * That repository is MIT for its code and CC BY-SA 4.0 for the word lists, so the
 * files this script writes are derivatives of CC BY-SA 4.0 content and carry the
 * same terms. See public/data/LICENSE.txt.
 * Kept at scripts/en_50k.source.txt so this build is reproducible offline.
 *
 * Frequencies are reported on the Zipf scale (van Heuven, Mandera, Keuleers &
 * Brysbaert, 2014): zipf = log10(occurrences per billion tokens). Roughly, zipf 1-3
 * is a rare word and 4-7 is a common one.
 *
 * Run: node scripts/build-lexicon.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'data')

/**
 * The source list is derived from subtitles, so stripping apostrophes has left
 * behind contraction fragments that are not words. They are frequent enough to
 * matter, and a fragment wrongly counted as a word would make the lexical
 * interference feature claim a scramble landed on a real word when it did not.
 */
const CONTRACTION_FRAGMENTS = new Set([
  'didn', 'doesn', 'isn', 'wasn', 'wouldn', 'couldn', 'shouldn', 'aren', 'weren',
  'hasn', 'haven', 'hadn', 'mustn', 'needn', 'daren', 'oughtn', 'shan', 'ain',
  'don', 'won', 'll', 've', 're', 'nt', 'em', 'til', 'bout',
])

const MIN_COUNT = 200 // trims the noisy tail of the source list
const MAX_WORDS = 42000

function main() {
  const raw = readFileSync(join(here, 'en_50k.source.txt'), 'utf8')

  const entries = []
  let totalTokens = 0
  for (const line of raw.split('\n')) {
    const [word, countText] = line.trim().split(/\s+/)
    if (!word || !countText) continue
    const count = Number(countText)
    if (!Number.isFinite(count)) continue
    totalTokens += count
    if (count < MIN_COUNT) continue
    if (!/^[a-z]{2,}$/.test(word)) continue
    if (CONTRACTION_FRAGMENTS.has(word)) continue
    entries.push({ word, count })
  }

  entries.sort((a, b) => b.count - a.count)
  const kept = entries.slice(0, MAX_WORDS)

  // Zipf scale: log10 of occurrences per billion tokens.
  for (const e of kept) {
    e.zipf = Math.log10((e.count / totalTokens) * 1e9)
  }

  writeLexicon(kept)
  writeNgrams(kept)

  const zipfs = kept.map((e) => e.zipf)
  console.log(
    `lexicon: ${kept.length} words, zipf ${Math.min(...zipfs).toFixed(2)}..${Math.max(...zipfs).toFixed(2)}`,
  )
}

/**
 * Stored as one line per word, "word zipf", Zipf quantised to one decimal. Plain
 * text compresses far better over the wire than the equivalent JSON object.
 */
function writeLexicon(entries) {
  const lines = entries.map((e) => `${e.word} ${e.zipf.toFixed(1)}`)
  mkdirSync(outDir, { recursive: true })
  const text = lines.join('\n')
  writeFileSync(join(outDir, 'lexicon.txt'), text)
  console.log(`  lexicon.txt ${(text.length / 1024).toFixed(0)} KB`)
}

/**
 * Character bigram and trigram log probabilities, weighted by how often each word
 * is actually read rather than by how many words contain the sequence. Used as the
 * orthographic-likelihood feature: how English-like does a permuted string look?
 *
 * Words are padded with "^" and "$" so that sequences at word edges are modelled
 * too, which matters because our first and last letters never move.
 */
function writeNgrams(entries) {
  const bigrams = new Map()
  const trigrams = new Map()
  let bigramTotal = 0
  let trigramTotal = 0

  for (const { word, count } of entries) {
    const padded = `^${word}$`
    for (let i = 0; i + 2 <= padded.length; i++) {
      const g = padded.slice(i, i + 2)
      bigrams.set(g, (bigrams.get(g) ?? 0) + count)
      bigramTotal += count
    }
    for (let i = 0; i + 3 <= padded.length; i++) {
      const g = padded.slice(i, i + 3)
      trigrams.set(g, (trigrams.get(g) ?? 0) + count)
      trigramTotal += count
    }
  }

  // Add-k smoothing so that unseen sequences get a finite, clearly low score
  // rather than -Infinity.
  const k = 0.5
  const alphabet = 28 // a-z plus the two boundary markers

  const toLogProbs = (counts, total, contexts) => {
    const out = {}
    for (const [gram, c] of counts) {
      out[gram] = Number(Math.log10((c + k) / (total + k * contexts)).toFixed(4))
    }
    return out
  }

  const payload = {
    note: 'log10 probabilities of letter sequences in English, weighted by word frequency. "^" and "$" mark word boundaries.',
    smoothing: { k, bigramFloor: 0, trigramFloor: 0 },
    bigrams: toLogProbs(bigrams, bigramTotal, alphabet ** 2),
    trigrams: toLogProbs(trigrams, trigramTotal, alphabet ** 3),
  }
  payload.smoothing.bigramFloor = Number(
    Math.log10(k / (bigramTotal + k * alphabet ** 2)).toFixed(4),
  )
  payload.smoothing.trigramFloor = Number(
    Math.log10(k / (trigramTotal + k * alphabet ** 3)).toFixed(4),
  )

  const text = JSON.stringify(payload)
  writeFileSync(join(outDir, 'ngrams.json'), text)
  console.log(
    `  ngrams.json ${(text.length / 1024).toFixed(0)} KB ` +
      `(${bigrams.size} bigrams, ${trigrams.size} trigrams)`,
  )
}

main()
