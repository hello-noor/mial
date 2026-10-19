import { serve } from '/Users/mariomele/Desktop/ClaudeCode Workspace/mial/tools/scripts/lib/serve.mjs'
import { launch } from '/Users/mariomele/Desktop/ClaudeCode Workspace/mial/tools/scripts/lib/browser.mjs'
const srv = await serve('/Users/mariomele/Desktop/ClaudeCode Workspace/mial')
const { browser, page } = await launch({ width: 1400, height: 800 })
await page.goto(`${srv.url}/mftrio.html`, { waitUntil: 'load', timeout: 120000 })
await page.waitForFunction(() => window.__lab?.renderer, null, { timeout: 120000 })
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /12/.test(x.textContent) && /×|x/.test(x.textContent)); b && b.click() })
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(15000)
  const r = await page.evaluate(() => { const h = document.querySelector('.lab-big')?.textContent; const st = document.querySelector('.lab-metric .st')?.textContent; const sub = document.querySelector('.lab-sub')?.textContent; return [h, st, sub] })
  console.log(new Date().toISOString().slice(11,19), JSON.stringify(r))
}
await browser.close(); process.exit(0)
