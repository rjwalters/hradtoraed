# Hrad to Raed

**[hradtoraed.com](https://hradtoraed.com)** — how hard can we make text before you can't read it?

Paste something you actually want to read, then move one slider. Every eligible word
is rearranged under a single rule:

> The first letter, the last letter and the exact multiset of internal letters are
> preserved. Only the order of the internal letters may change.

The point is not that the text becomes more shuffled. It is that the slider selects
*which* rearrangement, out of all the legal ones, according to how hard we predict it
will be to read. Same letters, same length, same word, same sentence — only character
order varies.

Everything runs in the browser. Nothing you paste is uploaded or stored.

## What makes this different from a typoglycemia generator

Ordinary generators shuffle the middle letters at random. This one enumerates or
samples the legal rearrangements of each word, scores every candidate, sorts them, and
maps the slider onto that distribution. The **Random (control)** preset reproduces the
ordinary behaviour, so you can check whether the scoring is doing anything at all.

## The honest part

The score is called a **scramble score**, not a predicted reading difficulty, and the
site says so everywhere it appears. The *features* are motivated by published work on
transposed-letter effects and letter-position coding — movement near the word beginning
costs more than movement near the end, moved vowels damage identity more than moved
consonants, and landing on a higher-frequency real word should be worst of all. The
*weights* combining them are hand-tuned guesses. No behavioural data has been fitted to
them. The bibliography in `src/content/bibliography.ts` says what each citation actually
supports, and every entry was checked against the publisher's record.

## Layout

```
src/reading/          the engine, with no React in it
  tokenize.ts         text -> tokens, and what is eligible to change
  permutations.ts     the legal rearrangements of a word
  features.ts         interpretable measurements of one rearrangement
  difficulty.ts       features -> a score, plus the presets
  transform.ts        slider position -> transformed text
  lexicon.ts          optional word-frequency and letter-statistics resources
  seededRandom.ts     deterministic randomness
src/components/       the interface
src/content/          samples, the explainer, the bibliography
scripts/              reproducible data generation
public/data/          generated: word list and letter statistics
```

The engine is independent of React and is where the tests live.

## Development

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # 54 tests, including the permutation invariants
npm run build
```

### Regenerating the data files

`public/data/` is generated from a word frequency list checked in at
`scripts/en_50k.source.txt` — hermitdave/FrequencyWords, OpenSubtitles 2018 via
OPUS. That repository is MIT for its code and **CC BY-SA 4.0 for the word lists**,
so `scripts/en_50k.source.txt` and everything generated from it in `public/data/`
are CC BY-SA 4.0 derivatives and are shared on those terms. See
`public/data/LICENSE.txt`. The rest of this repository is MIT.

```sh
npm run build:data
```

It writes `lexicon.txt` (41,601 words with Zipf frequencies) and `ngrams.json`
(frequency-weighted English letter bigram and trigram probabilities). Both load lazily;
the site works without them, and reports the features that depend on them as
unavailable rather than inventing values.

A subtitle corpus skews conversational, so rare and technical words are simply absent
rather than rated rare. That is the main known weakness of the lexical feature.

## Tests

The invariants are the ones that matter. If they break, every claim on the page is void:

```
first(original)            == first(transformed)
last(original)             == last(transformed)
sort(internal(original))   == sort(internal(transformed))
length(original)           == length(transformed)
```

They are checked exhaustively over fixed words, over arbitrary generated words with
fast-check, and over every word the engine actually renders at every difficulty and
every preset. Determinism is tested too: moving the slider 70 → 40 → 70 must return
exactly the same text.

## Deploying

Live at **https://hradtoraed.com**, served by the `hradtoraed` Worker (static
assets only — no script, no bindings) on the personal Cloudflare account.

```sh
set -a; . ~/.cloudflare/rjwalters/workers-hradtoraed.env; set +a
npm run deploy
```

That credential is dedicated to this project and scoped to Workers Scripts:Write
on the account plus Workers Routes:Write and Zone:Read on `hradtoraed.com` alone.
It is recorded in `2am/infra/cloudflare/token-manifest.yml` (id
`7808e3eb388b58fd26fd0dc303faf789`) and synced by chezmoi.

`wrangler.jsonc` declares the custom domain, so a deploy from a clean checkout
reconciles it rather than dropping it. `workers_dev` stays on, which means
`hradtoraed.personal-account-251.workers.dev` always serves the same build — use
it to check something before it is what the domain serves.

### The cache purge is not optional

`scripts/deploy.sh` purges the zone cache after every deploy and then checks that
the domain really serves the bundle that was just built. Skipping it produces a
convincing failure: `wrangler deploy` reports success, workers.dev serves the new
build, and `hradtoraed.com` keeps handing out the previous build's asset hashes,
because `index.html` is cached at the zone edge and is the one file whose name
never changes while its contents do. It looks exactly like a deploy that silently
did not happen. The censusapi Worker has the same trap; see `~/.cloudflare/README.md`.

## Not in this version

No accounts, no backend, no database, no crowdsourced experiments, no analytics, no
browser extension. The permutation scorer is deliberately modular so that a fitted model
can replace the hand-tuned one when there is data to fit it to.
