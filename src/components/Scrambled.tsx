import { useMemo } from 'react'
import type { ScrambleEngine, TransformSettings } from '../reading/transform'

/**
 * Text that distorts along with the reader's slider.
 *
 * Used for the tagline and the essay's headings, so the page demonstrates its own
 * thesis as you turn it up. Controls, labels and numbers are deliberately left
 * alone: a site you cannot operate is a worse experiment, not a better joke.
 */
export function Scrambled({
  text,
  engine,
  settings,
  as: Tag = 'span',
  className,
}: {
  text: string
  engine: ScrambleEngine
  settings: TransformSettings
  as?: 'span' | 'p' | 'h2'
  className?: string
}) {
  const shown = useMemo(
    () => engine.transform(text, settings).text,
    // cacheVersion is not read inside the callback, so the linter calls it
    // unnecessary. It is the point: it changes when the word list lands and the
    // engine drops its cache, which is exactly when this needs recomputing.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [engine, engine.cacheVersion, text, settings],
  )
  // The original stays available to assistive technology and to copy-paste.
  return (
    <Tag className={className} title={text}>
      <span aria-hidden="true">{shown}</span>
      <span className="visually-hidden">{text}</span>
    </Tag>
  )
}
