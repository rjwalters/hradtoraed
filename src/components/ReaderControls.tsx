import { PRESETS, type PresetName } from '../reading/difficulty'
import type { TransformResult, TransformSettings } from '../reading/transform'

/**
 * The second question.
 *
 * Sits under the reading pane, because "how is it choosing these?" only occurs to
 * you after you have read something and noticed that some words are much worse
 * than others. Four presets collapse into one select rather than a row of chips:
 * the choice matters, but not enough to spend four controls on it.
 */

interface ReaderControlsProps {
  settings: TransformSettings
  onChange: (next: Partial<TransformSettings>) => void
  onReshuffle: () => void
  result: TransformResult
  askedCount: number
  markAsked: boolean
  onToggleMarkAsked: () => void
}

export function ReaderControls({
  settings,
  onChange,
  onReshuffle,
  result,
  askedCount,
  markAsked,
  onToggleMarkAsked,
}: ReaderControlsProps) {
  const preset = PRESETS[settings.preset]

  return (
    <div className="strip">
      <div className="strip__row">
        <label className="strip__field">
          <span>Choosing by</span>
          <select
            value={settings.preset}
            onChange={(e) => onChange({ preset: e.target.value as PresetName })}
          >
            {(Object.keys(PRESETS) as PresetName[]).map((name) => (
              <option key={name} value={name}>
                {PRESETS[name].label}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="linky" onClick={onReshuffle}>
          Reshuffle
        </button>

        {askedCount > 0 && (
          <button
            type="button"
            className="linky"
            data-active={markAsked}
            onClick={onToggleMarkAsked}
          >
            {markAsked ? 'Unmark' : 'Mark'} the {askedCount} you opened
          </button>
        )}

        <span className="strip__spacer" />

        <span className="strip__stat">
          <strong>{result.stats.words}</strong> words,{' '}
          <strong>{result.stats.words - result.stats.eligible}</strong> of them too short
          to rearrange at all
        </span>
      </div>

      <p className="strip__note">{preset.description}</p>
    </div>
  )
}
