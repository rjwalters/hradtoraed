import { memo } from 'react'
import type { TransformResult } from '../reading/transform'

interface ReadingPaneProps {
  result: TransformResult
  revealAll: boolean
  selectedIndex: number | null
  askedIndices: ReadonlySet<number>
  markAsked: boolean
  onSelect: (index: number) => void
}

/**
 * The transformed text.
 *
 * Because every rearrangement has exactly the same length as the original,
 * revealing a word swaps its glyphs without moving anything else on the line.
 * That is what makes the hold-to-peek gesture feel like looking rather than like
 * the page rewriting itself.
 */
export const ReadingPane = memo(function ReadingPane({
  result,
  revealAll,
  selectedIndex,
  askedIndices,
  markAsked,
  onSelect,
}: ReadingPaneProps) {
  if (result.tokens.length === 0) {
    return (
      <p className="reader reader--empty">
        Paste something you actually want to read.
      </p>
    )
  }

  return (
    <div className="reader" data-mark-asked={markAsked}>
      {result.tokens.map((token, index) => {
        if (!token.changed) {
          return <span key={index}>{token.shown}</span>
        }
        const revealed = revealAll || selectedIndex === index
        return (
          <button
            key={index}
            type="button"
            className="w"
            data-selected={selectedIndex === index}
            data-revealed={revealed}
            data-asked={askedIndices.has(index)}
            onClick={() => onSelect(index)}
            title={revealed ? token.shown : token.original}
            aria-label={`${token.shown}, rearranged from ${token.original}`}
          >
            {revealed ? token.original : token.shown}
          </button>
        )
      })}
    </div>
  )
})
