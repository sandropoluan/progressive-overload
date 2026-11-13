/**
 * Generates the iOS launch screens (apple-touch-startup-image) into public/splash/
 * and prints the <link> tags for index.html.
 *
 * iOS shows a blank screen while a home-screen web app starts unless a startup image
 * matches the device's exact pixel size, so there is one PNG per iPhone screen size.
 *
 *   node scripts/build-splash.mjs
 */
import { mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'splash')
const BG = '#0b0d12'
/** Logo edge in CSS points. */
const LOGO_PT = 96

/** [device-width, device-height, pixel ratio] in portrait. */
export const SCREENS = [
  [320, 568, 2], // SE (1st gen)
  [375, 667, 2], // 8, SE (2nd/3rd gen)
  [414, 736, 3], // 8 Plus
  [375, 812, 3], // X, XS, 11 Pro, 12 mini, 13 mini
  [414, 896, 2], // XR, 11
  [414, 896, 3], // XS Max, 11 Pro Max
  [390, 844, 3], // 12, 13, 14, 16e
  [428, 926, 3], // 12/13 Pro Max, 14 Plus
  [393, 852, 3], // 14 Pro, 15, 15 Pro, 16
  [430, 932, 3], // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  [402, 874, 3], // 16 Pro, 17, 17 Pro
  [440, 956, 3], // 16 Pro Max, 17 Pro Max
  [420, 912, 3], // Air
]

const name = ([w, h, r]) => `${w * r}x${h * r}.png`

await mkdir(OUT, { recursive: true })
const logoSvg = await readFile(join(ROOT, 'public', 'favicon.svg'))
const tags = []
for (const s of SCREENS) {
  const [w, h, r] = s
  const size = LOGO_PT * r
  const logo = await sharp(logoSvg, { density: (72 * size) / 512 * 4 }).resize(size, size).png().toBuffer()
  await sharp({ create: { width: w * r, height: h * r, channels: 3, background: BG } })
    .composite([{ input: logo, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, name(s)))
  tags.push(
    `    <link rel="apple-touch-startup-image" href="splash/${name(s)}" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)" />`,
  )
}
console.log(tags.join('\n'))
