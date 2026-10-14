// Builds ../tubular-chain-conveyor.html: head.html (page shell + the inlined lab kit) + machine.src.js,
// with the MIAL logo and the four brochure example images (assets/*.b64) embedded as data URIs.
//   node src/assemble.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(resolve(here, p), 'utf8')
const head = read('head.html')
let src = read('machine.src.js').replace('__MIAL_LOGO__', read('assets/logo.b64').trim())
for (let i = 1; i <= 4; i++) src = src.replace(`__EX${i}__`, read(`assets/ex${i}.b64`).trim())
writeFileSync(resolve(here, '../tubular-chain-conveyor.html'), head + '<script type="module">\n' + src + '\n</script>\n</body>\n</html>\n')
console.log('built tubular-chain-conveyor.html')
