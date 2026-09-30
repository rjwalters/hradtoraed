/**
 * The named stretches of the slider.
 *
 * Kept out of the component file so the labels can be reused (and so React fast
 * refresh stays happy with a components-only module).
 */
export interface Region {
  name: string
  /** Lowest difficulty that counts as this region. */
  from: number
}

export const REGIONS: Region[] = [
  { name: 'Original', from: 0 },
  { name: 'Gentle', from: 1 },
  { name: 'Scrambled', from: 26 },
  { name: 'Difficult', from: 51 },
  { name: 'Diabolical', from: 76 },
]

export function regionFor(difficulty: number): Region {
  let current = REGIONS[0]
  for (const region of REGIONS) if (difficulty >= region.from) current = region
  return current
}
