import type { TransformedToken } from '../reading/transform'

/**
 * Why this word looks like that.
 *
 * The point of this panel is to make the heuristic arguable. It shows the actual
 * measured features, says which terms it could not compute, and never presents
 * the number as a measurement of a reader.
 */

interface InspectorProps {
  token: TransformedToken
  onClose: () => void
  onAnotherPermutation: () => void
}

export function Inspector({ token, onClose, onAnotherPermutation }: InspectorProps) {
  const detail = token.detail
  if (!detail) return null

  const { features, breakdown } = detail
  const lexical = features.lexical
  const landedOnWord = lexical?.permutationIsWord === true

  return (
    <aside className="inspector" role="dialog" aria-label={`Analysis of ${token.original}`}>
      <button type="button" className="inspector__close" onClick={onClose} aria-label="Close">
        ×
      </button>

      <p className="inspector__pair">
        <s>{token.original}</s> <span className="pair__arrow">→</span> <b>{token.shown}</b>
      </p>
      <p className="inspector__score">
        scramble score {detail.score} · harder than {Math.round(detail.percentile * 100)}% of the{' '}
        {detail.candidateCount.toLocaleString()} rearrangements we considered
      </p>

      {landedOnWord && (
        <p className="alarm">
          This rearrangement is itself a word: <strong>{token.shown}</strong>.
          {lexical?.frequencyAdvantage !== null && lexical !== null && (
            <>
              {' '}
              It is{' '}
              {lexical.frequencyAdvantage! > 0 ? (
                <>
                  <strong>more</strong> common than <em>{token.original}</em>
                </>
              ) : (
                <>less common than <em>{token.original}</em></>
              )}{' '}
              (Zipf {lexical.permutationZipf} vs {lexical.originalZipf}).
            </>
          )}{' '}
          A competing word is the one thing here with real experimental support behind it.
        </p>
      )}

      <div className="bars">
        {breakdown.terms.map((term) => (
          <div className="bar" key={term.key} data-unavailable={term.value === null}>
            <div className="bar__head">
              <span title={term.explanation}>{term.label}</span>
              <span className="bar__value">
                {term.value === null ? 'no data' : Math.round(term.value * 100)}
              </span>
            </div>
            <div className="bar__track">
              <div
                className="bar__fill"
                style={{ width: `${(term.value ?? 0) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="inspector__facts">
        <span>
          Mean displacement <code>{features.meanDisplacement.toFixed(2)}</code> positions, furthest{' '}
          <code>{features.maxDisplacement}</code>
        </span>
        <span>
          Letter pairs kept{' '}
          <code>
            {features.bigramsPreserved}/{features.bigramsTotal}
          </code>
          , triples kept{' '}
          <code>
            {features.trigramsPreserved}/{features.trigramsTotal}
          </code>
        </span>
        {lexical?.originalZipf != null && (
          <span>
            <em>{token.original}</em> has Zipf frequency <code>{lexical.originalZipf}</code>
          </span>
        )}
        {lexical !== null && !landedOnWord && (
          <span>No English word shares this arrangement.</span>
        )}
      </div>

      <button type="button" className="chip" onClick={onAnotherPermutation}>
        Try another rearrangement
      </button>

      <p className="caveat">
        The scramble score is our own hand-tuned heuristic, not a measurement of how hard
        anyone found this word. No behavioural data has been fitted to it yet.
        {breakdown.partial && ' Some terms could not be computed because the word list has not loaded.'}
      </p>
    </aside>
  )
}
