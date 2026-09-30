import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'

import { Console } from './components/Console'
import { Inspector } from './components/Inspector'
import { ReaderControls } from './components/ReaderControls'
import { ReadingPane } from './components/ReadingPane'
import { Scrambled } from './components/Scrambled'
import { TextPicker } from './components/TextPicker'
import { Explainer } from './content/Explainer'
import { DEFAULT_SAMPLE, type Sample } from './content/samples'
import { PRESETS, type PresetName } from './reading/difficulty'
import { loadResources } from './reading/lexicon'
import { DEFAULT_SETTINGS, ScrambleEngine, type TransformSettings } from './reading/transform'

/**
 * Settings live in the URL so a particular reading can be linked. The text never
 * does: it stays in this tab, in memory, and nowhere else.
 */
function settingsFromUrl(): TransformSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  const params = new URLSearchParams(window.location.search)
  const difficulty = Number(params.get('d'))
  const seed = Number(params.get('s'))
  const preset = params.get('p')
  return {
    difficulty:
      Number.isFinite(difficulty) && difficulty >= 0 && difficulty <= 100
        ? Math.round(difficulty)
        : DEFAULT_SETTINGS.difficulty,
    seed: Number.isFinite(seed) && seed > 0 ? Math.round(seed) : DEFAULT_SETTINGS.seed,
    preset:
      preset && preset in PRESETS ? (preset as PresetName) : DEFAULT_SETTINGS.preset,
  }
}

export default function App() {
  const [settings, setSettings] = useState<TransformSettings>(settingsFromUrl)
  const [text, setText] = useState<string>(DEFAULT_SAMPLE.text)
  const [activeSample, setActiveSample] = useState<Sample | null>(DEFAULT_SAMPLE)
  const [showSource, setShowSource] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [inspectorOffset, setInspectorOffset] = useState(0)
  const [askedIndices, setAskedIndices] = useState<ReadonlySet<number>>(new Set())
  const [markAsked, setMarkAsked] = useState(false)
  const [peeking, setPeeking] = useState(false)
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [resourcesReady, setResourcesReady] = useState(false)

  const engine = useMemo(() => new ScrambleEngine(), [])

  // The word list and letter statistics are a few hundred kilobytes, so the page
  // is usable before they arrive and simply gets a better scoring function when
  // they land.
  useEffect(() => {
    let cancelled = false
    loadResources().then((resources) => {
      if (cancelled) return
      if (resources.lexicon || resources.ngrams) {
        engine.setResources(resources)
        setResourcesReady(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [engine])

  // Keep the URL in step with the controls, without the text.
  useEffect(() => {
    const params = new URLSearchParams()
    params.set('d', String(settings.difficulty))
    if (settings.preset !== DEFAULT_SETTINGS.preset) params.set('p', settings.preset)
    if (settings.seed !== DEFAULT_SETTINGS.seed) params.set('s', String(settings.seed))
    window.history.replaceState(null, '', `?${params.toString()}`)
  }, [settings])

  // Hold Alt/Option to peek at the originals.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setPeeking(true)
      if (e.key === 'Escape') setSelectedIndex(null)
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setPeeking(false)
    }
    const blur = () => setPeeking(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  // Typing should not block on retransforming a long article.
  const deferredText = useDeferredValue(text)
  const result = useMemo(
    () => engine.transform(deferredText, settings),
    // resourcesReady flips when the data files land, which also bumps the
    // engine's cache version and gives every memoised consumer a new result.
    // Neither is read inside the callback, which is why the linter objects.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [engine, engine.cacheVersion, deferredText, settings, resourcesReady],
  )

  const selectedToken =
    selectedIndex !== null ? (result.tokens[selectedIndex] ?? null) : null
  const inspectedToken = useMemo(() => {
    if (!selectedToken?.changed || inspectorOffset === 0) return selectedToken
    const chosen = engine.chooseFor(selectedToken.original, settings, inspectorOffset)
    if (!chosen) return selectedToken
    return {
      ...selectedToken,
      shown: chosen.candidate.permutation,
      detail: {
        score: chosen.candidate.breakdown.score,
        percentile: chosen.percentile,
        candidateCount: chosen.total,
        candidateIndex: chosen.index,
        features: chosen.candidate.features,
        breakdown: chosen.candidate.breakdown,
      },
    }
  }, [selectedToken, inspectorOffset, engine, settings])

  const update = useCallback((next: Partial<TransformSettings>) => {
    setSettings((prev) => ({ ...prev, ...next }))
    setSelectedIndex(null)
    setInspectorOffset(0)
  }, [])

  const handleSelect = useCallback((index: number) => {
    setInspectorOffset(0)
    setSelectedIndex((prev) => (prev === index ? null : index))
    setAskedIndices((prev) => {
      if (prev.has(index)) return prev
      const next = new Set(prev)
      next.add(index)
      return next
    })
  }, [])

  const loadText = useCallback((next: string, sample: Sample | null) => {
    setText(next)
    setActiveSample(sample)
    setSelectedIndex(null)
    setAskedIndices(new Set())
    setPasteError(null)
  }, [])

  const handlePaste = useCallback(async () => {
    try {
      const clipboard = await navigator.clipboard.readText()
      if (clipboard.trim()) {
        loadText(clipboard, null)
        setShowSource(false)
      } else {
        setPasteError('Your clipboard looks empty. Try one of the texts below.')
      }
    } catch {
      setPasteError(
        'Your browser would not hand over the clipboard. Open the text box and press Ctrl/Cmd-V instead.',
      )
      setShowSource(true)
    }
  }, [loadText])

  const taglineSettings = useMemo(
    () => ({ ...settings, seed: settings.seed + 7 }),
    [settings],
  )

  return (
    <>
      <header className="masthead shell">
        <h1 className="wordmark">
          <span className="wordmark__domain">hradtoraed.com</span>
          Hrad to Raed
        </h1>
        <Scrambled
          as="p"
          className="tagline"
          text="How hard can we make text before you can't read it?"
          engine={engine}
          settings={taglineSettings}
        />
      </header>

      <Console settings={settings} onChange={update} result={result} />

      <main className="shell">
        <div className="inset">
          <ReadingPane
            result={result}
            revealAll={peeking}
            selectedIndex={selectedIndex}
            askedIndices={askedIndices}
            markAsked={markAsked}
            onSelect={handleSelect}
          />
        </div>

        <TextPicker
          activeSample={activeSample}
          editing={showSource}
          text={text}
          pasteError={pasteError}
          onPick={(sample) => loadText(sample.text, sample)}
          onPaste={handlePaste}
          onToggleEdit={() => setShowSource((v) => !v)}
          onEditText={(next) => {
            setText(next)
            setActiveSample(null)
            setSelectedIndex(null)
          }}
        />

        <ReaderControls
          settings={settings}
          onChange={update}
          onReshuffle={() => update({ seed: settings.seed + 1 })}
          result={result}
          askedCount={askedIndices.size}
          markAsked={markAsked}
          onToggleMarkAsked={() => setMarkAsked((v) => !v)}
        />
      </main>

      <Explainer engine={engine} settings={settings} />

      {inspectedToken?.changed && (
        <Inspector
          token={inspectedToken}
          onClose={() => setSelectedIndex(null)}
          onAnotherPermutation={() => setInspectorOffset((o) => o + 1)}
        />
      )}
    </>
  )
}
