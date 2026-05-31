/**
 * Generates PWA icons for TabelaPro.
 * Uses sharp (bundled with Next.js) to create PNG icons from an SVG source.
 * Run with: node scripts/generate-icons.mjs
 */
import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dir, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

// SVG source — blue trophy icon, safe zone for maskable (80% visible)
const makeSvg = (size, padded = false) => {
  const pad = padded ? Math.round(size * 0.1) : 0
  const inner = size - pad * 2
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#2563EB"/>
  <g transform="translate(${pad}, ${pad})">
    <!-- Trophy cup -->
    <text x="${inner / 2}" y="${inner * 0.72}" font-size="${inner * 0.62}" text-anchor="middle" font-family="Arial, sans-serif" fill="white">🏆</text>
    <!-- "Pro" label -->
    <text x="${inner / 2}" y="${inner * 0.95}" font-size="${inner * 0.18}" text-anchor="middle" font-family="Arial Black, sans-serif" font-weight="900" fill="rgba(255,255,255,0.9)" letter-spacing="1">PRO</text>
  </g>
</svg>`
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

async function generate() {
  console.log('Generating PWA icons...')

  // Standard icons
  for (const size of sizes) {
    const svg = Buffer.from(makeSvg(size))
    await sharp(svg).png().toFile(join(outDir, `icon-${size}.png`))
    console.log(`  ✓ icon-${size}.png`)
  }

  // Apple touch icon (180×180)
  const apple = Buffer.from(makeSvg(180))
  await sharp(apple).png().toFile(join(outDir, 'apple-icon-180.png'))
  console.log('  ✓ apple-icon-180.png')

  // Maskable icon (512×512 with safe zone padding)
  const maskable = Buffer.from(makeSvg(512, true))
  await sharp(maskable).png().toFile(join(outDir, 'maskable-512.png'))
  console.log('  ✓ maskable-512.png')

  console.log('Done! All icons generated in public/icons/')
}

generate().catch(err => { console.error(err); process.exit(1) })
