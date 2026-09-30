import { REGIONS, regionFor } from '../reading/regions'
import type { TransformResult, TransformSettings } from '../reading/transform'

/**
 * The slider, and nothing else.
 *
 * Everything that is an answer to "how is it choosing these?" lives below the
 * reading pane instead, because that is the first moment the question occurs to
 * anyone. Arriving at a row of options before you have read a scrambled word is
 * being handed the answer to a question you have not asked.
 */

interface ConsoleProps {
  settings: TransformSettings
  onChange: (next: Partial<TransformSettings>) => void
  result: TransformResult
}

export function Console({ settings, onChange, result }: ConsoleProps) {
  const region = regionFor(settings.difficulty)

  return (
    <div className="console">
      <div className="shell console__inner">
        <div className="slider-row">
          <span className="slider-row__label">{region.name}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={settings.difficulty}
            aria-label="Reading distortion"
            aria-valuetext={`${settings.difficulty} of 100, ${region.name}`}
            onChange={(e) => onChange({ difficulty: Number(e.target.value) })}
          />
          <span className="slider-row__value">{settings.difficulty}</span>
        </div>

        <div className="scale">
          {REGIONS.map((r) => (
            <button
              key={r.name}
              type="button"
              data-active={region.name === r.name}
              onClick={() => onChange({ difficulty: r.from === 0 ? 0 : r.from + 12 })}
              title={`Jump to ${r.name}`}
            >
              {r.name}
            </button>
          ))}
        </div>

        <p className="toolbar__note">
          {settings.difficulty === 0 ? (
            <>Untouched. Move the slider.</>
          ) : (
            <>
              {result.stats.changed} of {result.stats.eligible} words rearranged. Click any
              one to see why, or hold Alt / Option to peek at the originals.
            </>
          )}
        </p>
      </div>
    </div>
  )
}
