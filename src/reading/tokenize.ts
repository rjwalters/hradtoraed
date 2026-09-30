/**
 * Splits text into tokens while preserving absolutely everything, so that
 * concatenating every token's text reproduces the input byte for byte.
 *
 * The tokenizer is also where eligibility lives. It is deliberately conservative:
 * when a token is ambiguous we leave it alone rather than guess, because a site
 * about reading difficulty should not mangle a URL and call it an experiment.
 */

export type IneligibleReason =
  | 'too-short'
  | 'protected-chunk'
  | 'apostrophe'
  | 'mixed-case'
  | 'all-caps'
  | 'combining-marks'

export interface WordToken {
  kind: 'word'
  text: string
  /** Index into the source string. */
  start: number
  eligible: boolean
  reason?: IneligibleReason
}

export interface GapToken {
  kind: 'gap'
  text: string
  start: number
}

export type Token = WordToken | GapToken

/** Minimum length that leaves at least two internal characters to reorder. */
export const MIN_WORD_LENGTH = 4

const LETTER = /\p{L}/u
const COMBINING = /\p{M}/u

/**
 * A whitespace-delimited chunk is protected wholesale if it looks like something
 * that is not prose. Protecting the whole chunk, rather than individual letter
 * runs inside it, is what keeps `hradtoraed.com` and `snake_case_name` intact.
 */
function isProtectedChunk(chunk: string): boolean {
  if (/^(?:https?:|mailto:|ftp:)/i.test(chunk)) return true
  if (/^www\./i.test(chunk)) return true
  if (/@/.test(chunk)) return true
  // A dot between two word characters: domains, filenames, module paths.
  if (/\w\.\w/.test(chunk)) return true
  // Digits touching letters, or any standalone number.
  if (/\d/.test(chunk)) return true
  // Punctuation that only shows up in code and identifiers.
  if (/[_/\\|<>{}[\]=+*^~`]/.test(chunk)) return true
  if (/::|\(\)|->|=>/.test(chunk)) return true
  return false
}

type CaseShape = 'lower' | 'capitalized' | 'upper' | 'mixed'

export function caseShapeOf(word: string): CaseShape {
  const lower = word.toLowerCase()
  const upper = word.toUpperCase()
  if (word === lower) return 'lower'
  if (word === upper) return 'upper'
  const capitalized = word[0] + word.slice(1).toLowerCase()
  if (word === capitalized && word[0] === upper[0]) return 'capitalized'
  return 'mixed'
}

function classify(
  word: string,
  before: string,
  after: string,
  protectedChunk: boolean,
): { eligible: boolean; reason?: IneligibleReason } {
  if (protectedChunk) return { eligible: false, reason: 'protected-chunk' }
  if (COMBINING.test(word)) return { eligible: false, reason: 'combining-marks' }
  if (Array.from(word).length < MIN_WORD_LENGTH) return { eligible: false, reason: 'too-short' }

  // Contractions and possessives: the letter run is only part of the word, so
  // transforming it would break a morpheme boundary we have not thought about.
  if (/['’]/.test(before) || /['’]/.test(after)) {
    return { eligible: false, reason: 'apostrophe' }
  }

  const shape = caseShapeOf(word)
  // Mixed case is camelCase, McDonald, iPhone: identifiers and names where a
  // positional case mask would also change which letters are present.
  if (shape === 'mixed') return { eligible: false, reason: 'mixed-case' }
  // All caps is usually an acronym, and NASA -> NSAA reads as a different thing
  // rather than as a scramble.
  if (shape === 'upper') return { eligible: false, reason: 'all-caps' }

  return { eligible: true }
}

export function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  if (!text) return tokens

  // Pass 1: find chunk boundaries and which chunks are protected.
  const protectedRanges: Array<[number, number]> = []
  const chunkRe = /\S+/g
  let chunkMatch: RegExpExecArray | null
  while ((chunkMatch = chunkRe.exec(text)) !== null) {
    if (isProtectedChunk(chunkMatch[0])) {
      protectedRanges.push([chunkMatch.index, chunkMatch.index + chunkMatch[0].length])
    }
  }
  let rangeCursor = 0
  const inProtectedRange = (index: number): boolean => {
    while (rangeCursor < protectedRanges.length && protectedRanges[rangeCursor][1] <= index) {
      rangeCursor++
    }
    const range = protectedRanges[rangeCursor]
    return range !== undefined && index >= range[0] && index < range[1]
  }

  // Pass 2: emit letter runs as words and everything else as gaps.
  let gapStart = 0
  let i = 0
  const chars = Array.from(text)
  // Map code-point index back to string index so token.start stays useful.
  const stringIndexOf: number[] = []
  let acc = 0
  for (const ch of chars) {
    stringIndexOf.push(acc)
    acc += ch.length
  }
  stringIndexOf.push(acc)

  const pushGap = (endCp: number) => {
    if (endCp > gapStart) {
      tokens.push({
        kind: 'gap',
        text: chars.slice(gapStart, endCp).join(''),
        start: stringIndexOf[gapStart],
      })
    }
  }

  while (i < chars.length) {
    if (!LETTER.test(chars[i])) {
      i++
      continue
    }
    const wordStart = i
    while (i < chars.length && (LETTER.test(chars[i]) || COMBINING.test(chars[i]))) i++
    const word = chars.slice(wordStart, i).join('')

    pushGap(wordStart)
    const { eligible, reason } = classify(
      word,
      chars[wordStart - 1] ?? '',
      chars[i] ?? '',
      inProtectedRange(stringIndexOf[wordStart]),
    )
    tokens.push({
      kind: 'word',
      text: word,
      start: stringIndexOf[wordStart],
      eligible,
      ...(reason ? { reason } : {}),
    })
    gapStart = i
  }
  pushGap(chars.length)

  return tokens
}

/** Round-trips a token list back to the original string. Used by the tests. */
export function detokenize(tokens: Token[]): string {
  return tokens.map((t) => t.text).join('')
}
