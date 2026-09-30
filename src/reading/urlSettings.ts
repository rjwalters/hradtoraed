import { PRESETS, type PresetName } from './difficulty'
import { DEFAULT_SETTINGS, type TransformSettings } from './transform'

/**
 * Settings travel in the URL so a particular reading can be linked. The text
 * never does: it stays in the tab, in memory, and nowhere else.
 */
export function settingsFromSearch(search: string): TransformSettings {
  const params = new URLSearchParams(search)

  // An absent parameter has to be distinguished from a present one before it is
  // parsed. Number(null) is 0, which passes every range check below, so reading
  // it directly made a fresh visit resolve to difficulty 0 -- untouched text --
  // and the default was unreachable. Worse, the URL effect then wrote ?d=0, so
  // the wrong value stuck across reloads.
  const num = (key: string): number | null => {
    const raw = params.get(key)
    if (raw === null || raw.trim() === '') return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  }

  const difficulty = num('d')
  const seed = num('s')
  const preset = params.get('p')

  return {
    difficulty:
      difficulty !== null && difficulty >= 0 && difficulty <= 100
        ? Math.round(difficulty)
        : DEFAULT_SETTINGS.difficulty,
    seed: seed !== null && seed > 0 ? Math.round(seed) : DEFAULT_SETTINGS.seed,
    preset: preset && preset in PRESETS ? (preset as PresetName) : DEFAULT_SETTINGS.preset,
  }
}

/** The query string this session should carry, with the text left out. */
export function searchFromSettings(settings: TransformSettings): string {
  const params = new URLSearchParams()
  params.set('d', String(settings.difficulty))
  if (settings.preset !== DEFAULT_SETTINGS.preset) params.set('p', settings.preset)
  if (settings.seed !== DEFAULT_SETTINGS.seed) params.set('s', String(settings.seed))
  return `?${params.toString()}`
}
