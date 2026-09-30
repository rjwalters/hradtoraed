/**
 * Look at the site.
 *
 * This whole interface was first built without anyone rendering it, and three
 * visual bugs survived every passing test: an inset two thirds empty, a tagline
 * with no gutter on a phone, and paragraphs ghosting through the sticky header.
 * None of them are expressible as a DOM assertion. Run this and open the files.
 *
 *   npm run shots                 # against the dev server
 *   SITE=https://hradtoraed.com npm run shots
 */
import { chromium, devices } from 'playwright'
import { mkdirSync } from 'node:fs'

const URL = process.env.SITE || 'http://localhost:5173/'
const OUT = process.env.OUT || 'screenshots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
let failures = 0

async function shot(name, { width = 1280, height = 900, scheme = 'dark', device, after } = {}) {
  const ctx = await browser.newContext({
    ...(device ? devices[device] : { viewport: { width, height } }),
    colorScheme: scheme,
    deviceScaleFactor: 2,
  })
  const page = await ctx.newPage()
  const problems = []
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text()))
  page.on('pageerror', (e) => problems.push(String(e)))

  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  if (after) await after(page)

  // Nothing should ever scroll sideways.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  if (overflow > 0) {
    problems.push(`horizontal overflow: ${overflow}px`)
  }

  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log(problems.length ? `  ${name}  ${problems.join(' | ')}` : `  ${name}  ok`)
  if (problems.length) failures++
  await ctx.close()
}

await shot('desktop-dark')
await shot('desktop-light', { scheme: 'light' })
await shot('mobile-dark', { device: 'iPhone 13' })
await shot('mobile-light', { device: 'iPhone 13', scheme: 'light' })
await shot('narrow', { width: 340, height: 800 })
await shot('inspector', {
  after: async (p) => {
    await p.locator('button.w').first().click()
    await p.waitForTimeout(300)
  },
})
await shot('diabolical', {
  after: async (p) => {
    await p.locator('input[type=range]').fill('100')
    await p.waitForTimeout(300)
  },
})
await shot('long-sample', {
  after: async (p) => {
    await p.getByLabel('Next text').click()
    await p.waitForTimeout(400)
  },
})

await browser.close()
console.log(failures ? `${failures} view(s) reported problems` : 'all views clean')
process.exit(failures ? 1 : 0)
