/**
 * Render scripts/og-image.html to public/og.png.
 *
 *   npm run og
 *
 * Committed rather than generated at build time: it is a static asset that
 * changes about never, and the build should not need a browser.
 */
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { statSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const source = join(here, 'og-image.html')
const out = join(here, '..', 'public', 'og.png')

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  // Facebook, Slack and X all downscale; rendering at 2x keeps the serif crisp.
  deviceScaleFactor: 2,
  colorScheme: 'dark',
})
await page.goto(`file://${source}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
await page.screenshot({ path: out })
await browser.close()

const kb = (statSync(out).size / 1024).toFixed(0)
console.log(`public/og.png  1200x630 @2x  ${kb} KB`)
