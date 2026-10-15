#!/usr/bin/env node
// Records the short looping clips used on the home page: the simulator is driven through its modes while the browser records.
//   node scripts/clip.mjs ../mial.html ../video/home-mial.mp4 --root .. --steps mial
// Needs ffmpeg on the PATH.
import { dirname, resolve, relative, join } from 'node:path'
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { serve } from './lib/serve.mjs'
let pw
try { pw = await import('playwright') } catch { pw = await import('playwright-core') }
const a = process.argv.slice(2)
const opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d }
const [PAGE, OUT] = a.filter((x, i) => !x.startsWith('--') && !(i > 0 && a[i - 1].startsWith('--')))
const file = resolve(PAGE), root = resolve(opt('--root', dirname(dirname(file))))
const steps = opt('--steps', 'mial')
const SCENES = {
  // the MIAL: a short tour of the cut-away, the explode and the X-ray
  mial: [
    ['wait', 3.5], ['set', 'cut', true], ['wait', 3.5], ['set', 'cut', false],
    ['set', 'explode', true], ['wait', 3.5], ['set', 'explode', false],
    ['set', 'xray', true], ['wait', 3.5], ['set', 'xray', false], ['wait', 1.2],
  ],
  // the trio line: explode, X-ray (the powder shows), a cut-away of the bagger, then the palletizer close up
  trio: [
    ['wait', 3.5], ['set', 'explode', true], ['wait', 3.5], ['set', 'explode', false],
    ['set', 'xray', true], ['wait', 3.5], ['set', 'xray', false],
    ['set', 'cut', true], ['view', { az: 30, el: 10, dist: 0.95, target: [1.6, 2.2, 0.1], fov: 30 }], ['wait', 3.5],
    ['set', 'cut', false], ['view', { az: 14, el: 10, dist: 1.9, target: [4.75, 2.2, -0.2], fov: 30 }], ['wait', 2],
  ],
}
const srv = await serve(root)
const tmp = join(dirname(resolve(OUT)), '_clip_tmp'); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true })
const args = ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=metal']
const browser = await pw.chromium.launch({ headless: true, args })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: tmp, size: { width: 1280, height: 720 } } })
const page = await ctx.newPage()
await page.goto(`${srv.url}/${relative(root, file)}`, { waitUntil: 'load', timeout: 120000 })
await page.waitForFunction(() => window.__lab?.renderer, null, { timeout: 120000 })
await page.waitForTimeout(2500)
for (const [kind, x, y] of SCENES[steps]) {
  if (kind === 'wait') await page.waitForTimeout(x * 1000)
  if (kind === 'set') await page.evaluate(([k, v]) => window.__lab.toggle(k, v), [x, y])
  if (kind === 'view') await page.evaluate((v) => window.__lab.setView(v), x)
}
await ctx.close(); await browser.close(); srv.close?.()
const webm = readdirSync(tmp).find((f) => f.endsWith('.webm'))
const mp4 = resolve(OUT)
mkdirSync(dirname(mp4), { recursive: true })
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(tmp, webm), '-vf', 'scale=1280:-2', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4])
rmSync(tmp, { recursive: true, force: true })
console.log('clip', mp4)
process.exit(0)
