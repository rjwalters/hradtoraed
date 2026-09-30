import { SAMPLES, type Sample } from '../content/samples'

/**
 * What you are reading.
 *
 * One thing at a time, stepped through, rather than a row of chips that all
 * compete. The carousel is only ever about *texts*; pasting and editing are
 * actions, so they sit beside it as plain links instead of becoming positions in
 * the sequence.
 */

interface TextPickerProps {
  activeSample: Sample | null
  editing: boolean
  text: string
  pasteError: string | null
  onPick: (sample: Sample) => void
  onPaste: () => void
  onToggleEdit: () => void
  onEditText: (next: string) => void
}

export function TextPicker({
  activeSample,
  editing,
  text,
  pasteError,
  onPick,
  onPaste,
  onToggleEdit,
  onEditText,
}: TextPickerProps) {
  const index = activeSample ? SAMPLES.findIndex((s) => s.id === activeSample.id) : -1

  // From your own text, stepping either way lands at an end of the samples
  // rather than refusing to move.
  const step = (delta: number) => {
    const next =
      index === -1
        ? delta > 0
          ? 0
          : SAMPLES.length - 1
        : (index + delta + SAMPLES.length) % SAMPLES.length
    onPick(SAMPLES[next])
  }

  return (
    <section className="picker">
      <div className="picker__row">
        <div className="picker__label" aria-live="polite">
          <strong>{activeSample ? activeSample.title : 'Your own text'}</strong>
          <span className="picker__attr">
            {activeSample ? activeSample.attribution : 'Pasted or typed here'}
          </span>
        </div>

        {/* Arrows and count are grouped and right-aligned, so a long title
            cannot shove them sideways when the sample changes. */}
        <div className="picker__nav">
          <button
            type="button"
            className="picker__arrow"
            onClick={() => step(-1)}
            aria-label="Previous text"
          >
            ‹
          </button>
          <span className="picker__count">
            {index === -1 ? '—' : `${index + 1}/${SAMPLES.length}`}
          </span>
          <button
            type="button"
            className="picker__arrow"
            onClick={() => step(1)}
            aria-label="Next text"
          >
            ›
          </button>
        </div>

        <div className="picker__actions">
          <button type="button" className="linky" onClick={onPaste}>
            Paste from clipboard
          </button>
          <button type="button" className="linky" data-active={editing} onClick={onToggleEdit}>
            {editing ? 'Done editing' : 'Edit'}
          </button>
        </div>
      </div>

      <p className="picker__note">
        {pasteError ?? activeSample?.note ?? 'Paste something you actually want to read.'}
      </p>

      {editing && (
        <div className="picker__editor">
          <textarea
            className="source__input"
            value={text}
            spellCheck={false}
            onChange={(e) => onEditText(e.target.value)}
            placeholder="Paste something you actually want to read."
            aria-label="Source text"
          />
          <p className="privacy">
            Private by default. Your text is transformed entirely in your browser, is never
            uploaded, and never appears in the URL.
          </p>
        </div>
      )}
    </section>
  )
}
