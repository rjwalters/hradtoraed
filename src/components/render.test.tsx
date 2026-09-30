/**
 * Render smoke tests.
 *
 * These do not check that the page looks right, only that every component
 * actually renders for the states we ship: each sample text, each preset, the
 * ends of the slider, and the inspector for a word that landed on another word.
 */
import { describe, expect, it, beforeAll } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { ReadingPane } from './ReadingPane'
import { Inspector } from './Inspector'
import { Console } from './Console'
import { ReaderControls } from './ReaderControls'
import { TextPicker } from './TextPicker'
import { Scrambled } from './Scrambled'
import App from '../App'
import { Explainer } from '../content/Explainer'
import { SAMPLES, DEFAULT_SAMPLE } from '../content/samples'
import { PRESETS, type PresetName } from '../reading/difficulty'
import { ScrambleEngine, type TransformSettings } from '../reading/transform'
import { parseLexicon, buildNgramModel, type Resources } from '../reading/lexicon'

const dataDir = join(__dirname, '..', '..', 'public', 'data')
let engine: ScrambleEngine

beforeAll(() => {
  const resources: Resources = {
    lexicon: parseLexicon(readFileSync(join(dataDir, 'lexicon.txt'), 'utf8')),
    ngrams: buildNgramModel(JSON.parse(readFileSync(join(dataDir, 'ngrams.json'), 'utf8'))),
  }
  engine = new ScrambleEngine(resources)
})

const settings = (over: Partial<TransformSettings> = {}): TransformSettings => ({
  difficulty: 50,
  seed: 1,
  preset: 'balanced',
  ...over,
})

const noop = () => {}

describe('render', () => {
  it('renders every sample at every preset and both ends of the slider', () => {
    for (const sample of SAMPLES) {
      for (const preset of Object.keys(PRESETS) as PresetName[]) {
        for (const difficulty of [0, 50, 100]) {
          const s = settings({ preset, difficulty })
          const result = engine.transform(sample.text, s)
          const html = renderToStaticMarkup(
            <ReadingPane
              result={result}
              revealAll={false}
              selectedIndex={null}
              askedIndices={new Set()}
              markAsked={false}
              onSelect={noop}
            />,
          )
          expect(html).toContain('class="reader"')
        }
      }
    }
  })

  it('renders an empty document without crashing', () => {
    const result = engine.transform('', settings())
    const html = renderToStaticMarkup(
      <ReadingPane
        result={result}
        revealAll={false}
        selectedIndex={null}
        askedIndices={new Set()}
        markAsked={false}
        onSelect={noop}
      />,
    )
    expect(html).toContain('Paste something')
  })

  it('renders the console with the slider and nothing else', () => {
    const s = settings()
    const html = renderToStaticMarkup(
      <Console settings={s} onChange={noop} result={engine.transform(SAMPLES[0].text, s)} />,
    )
    expect(html).toContain('Diabolical')
    expect(html).toContain('type="range"')
    // The preset controls belong below the reading pane, not on arrival.
    expect(html).not.toContain('Adversarial')
    expect(html).not.toContain('Reshuffle')
  })

  it('renders the reader controls with every preset reachable', () => {
    const s = settings()
    const html = renderToStaticMarkup(
      <ReaderControls
        settings={s}
        onChange={noop}
        onReshuffle={noop}
        result={engine.transform(SAMPLES[0].text, s)}
        askedCount={3}
        markAsked={false}
        onToggleMarkAsked={noop}
      />,
    )
    for (const label of ['Balanced', 'Preserve local pairs', 'Adversarial', 'Random (control)']) {
      expect(html).toContain(label)
    }
    expect(html).toContain('Reshuffle')
    expect(html).toContain('the 3 you opened')
  })

  it('renders the text picker on a sample and on custom text', () => {
    const onSample = renderToStaticMarkup(
      <TextPicker
        activeSample={DEFAULT_SAMPLE}
        editing={false}
        text={DEFAULT_SAMPLE.text}
        pasteError={null}
        onPick={noop}
        onPaste={noop}
        onToggleEdit={noop}
        onEditText={noop}
      />,
    )
    expect(onSample).toContain(DEFAULT_SAMPLE.title)
    expect(onSample).toContain(`1/${SAMPLES.length}`)
    expect(onSample).toContain('Paste from clipboard')
    // The editor is behind the Edit action, not always open.
    expect(onSample).not.toContain('<textarea')

    const custom = renderToStaticMarkup(
      <TextPicker
        activeSample={null}
        editing
        text="hello"
        pasteError={null}
        onPick={noop}
        onPaste={noop}
        onToggleEdit={noop}
        onEditText={noop}
      />,
    )
    expect(custom).toContain('Your own text')
    expect(custom).toContain('<textarea')
    expect(custom).toContain('never uploaded')
  })

  it('renders the inspector, including the competing-word case', () => {
    const s = settings({ preset: 'adversarial', difficulty: 100 })
    const chosen = engine.chooseFor('clam', s)!
    expect(chosen.candidate.permutation).toBe('calm')

    const html = renderToStaticMarkup(
      <Inspector
        token={{
          kind: 'word',
          original: 'clam',
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
        }}
        onClose={noop}
        onAnotherPermutation={noop}
      />,
    )
    expect(html).toContain('scramble score')
    expect(html).toContain('is itself a word')
    expect(html).toContain('hand-tuned heuristic')
  })

  it('renders the inspector when no data files are loaded', () => {
    const bare = new ScrambleEngine()
    const s = settings()
    const chosen = bare.chooseFor('problem', s)!
    const html = renderToStaticMarkup(
      <Inspector
        token={{
          kind: 'word',
          original: 'problem',
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
        }}
        onClose={noop}
        onAnotherPermutation={noop}
      />,
    )
    expect(html).toContain('no data')
    expect(html).toContain('word list has not loaded')
  })

  it('renders the explainer with live demos', () => {
    const html = renderToStaticMarkup(<Explainer engine={engine} settings={settings()} />)
    expect(html).toContain('legal rearrangements')
    expect(html).toContain('Rayner')
    expect(html).toContain('doi.org')
    // The bibliography should be fully rendered, not truncated.
    expect(html).toContain('Keep clam and carry on')
  })

  it('links out from the prose, not only from the bibliography', () => {
    const html = renderToStaticMarkup(<Explainer engine={engine} settings={settings()} />)
    const essay = html.slice(0, html.indexOf('class="refs"'))

    // Inline citations resolve to the bibliography entry's own URL, so the two
    // can never disagree about where a source lives.
    for (const url of [
      'mrc-cbu.cam.ac.uk/people/matt.davis/cmabrigde/',
      'Cmabrigde/rawlinson.html',
      'doi.org/10.1111/j.1467-9280.2006.01684.x',
      'en.wikipedia.org/wiki/Transposed_letter_effect',
    ]) {
      expect(essay).toContain(url)
    }

    // Every outbound link in the prose opens safely.
    const anchors = essay.match(/<a [^>]*href="https?:[^"]*"[^>]*>/g) ?? []
    expect(anchors.length).toBeGreaterThanOrEqual(4)
    for (const a of anchors) {
      expect(a).toContain('target="_blank"')
      expect(a).toMatch(/rel="[^"]*noreferrer/)
    }
  })

  it('scrambles a heading but keeps the original available', () => {
    const html = renderToStaticMarkup(
      <Scrambled text="Not all scrambles are equal" engine={engine} settings={settings({ difficulty: 90 })} />,
    )
    expect(html).toContain('Not all scrambles are equal')
    expect(html).toContain('visually-hidden')
  })

  /**
   * The whole page. Guards the structure that keeps the controls from moving:
   * the text lives inside a fixed-height inset, and both control blocks come
   * after it, so swapping a short sample for a long one cannot shift them.
   */
  it('renders the whole page with the text inside the inset', () => {
    const html = renderToStaticMarkup(<App />)

    expect(html).toContain('Hrad to Raed')
    expect(html).toContain('class="inset"')

    // The reading pane is inside the inset, not a sibling of it.
    const inset = html.indexOf('class="inset"')
    const reader = html.indexOf('class="reader"')
    const picker = html.indexOf('class="picker"')
    const strip = html.indexOf('class="strip"')
    expect(inset).toBeGreaterThan(-1)
    expect(reader).toBeGreaterThan(inset)

    // Both control blocks sit below the text, in a fixed order.
    expect(picker).toBeGreaterThan(reader)
    expect(strip).toBeGreaterThan(picker)

    // The slider is above all of it, and carries no preset chips.
    expect(html.indexOf('type="range"')).toBeLessThan(inset)
  })
})
