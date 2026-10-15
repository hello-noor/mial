// Builds the three pages of the site:
//   ../index.html   the chooser (MIAL or MF TECNO), from chooser.html with its images embedded
//   ../mial.html    the MIAL tubular chain conveyor simulator (machine.src.js)
//   ../mftrio.html  the MF TECNO MF Trio Line simulator (trio.src.js)
// Both simulators share head.html (page shell + the inlined lab kit); only title and description differ.
//   node src/assemble.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(resolve(here, p), 'utf8')
const b64 = (p) => read(`assets/${p}.b64`).trim()
const head = read('head.html')
const BASE = 'https://hello-noor.github.io/mial'                                   // public URL of the GitHub Pages site (absolute links for social previews)

function page(out, srcFile, { title, description }, fill) {
  const shell = head
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description" content=".*?">/, `<meta name="description" content="${description}">`)
    .replaceAll('__OG_TITLE__', title).replaceAll('__OG_DESC__', description).replaceAll('__OG_URL__', `${BASE}/${out}`)
  writeFileSync(resolve(here, '..', out), shell + '<script type="module">\n' + fill(read(srcFile)) + '\n</script>\n</body>\n</html>\n')
  console.log('built', out)
}

page('mial.html', 'machine.src.js', {
  title: 'MIAL tubular chain conveyor · CLEAN200',
  description: 'Interactive 3D simulator of the MIAL CLEAN200 tubular chain conveyor: cut it open, take it apart, jam a bolt in the bend. Every number comes from a tension and drive solver.',
}, (src) => {
  src = src.replace('__MIAL_LOGO__', b64('logo'))
  for (let i = 1; i <= 4; i++) src = src.replace(`__EX${i}__`, b64(`ex${i}`))
  return src.replace('__NAV__', navHtml('mial'))
})

page('mftrio.html', 'trio.src.js', {
  title: 'MF Trio Line · MF TECNO',
  description: 'Interactive 3D simulator of the MF TECNO MF Trio Line: MF 54 vertical packaging machine, MF Smart Palletizer and MF Wrap 35 stretch wrapper in one integrated line.',
}, (src) => src.replace('__MF_LOGO__', b64('mflogo')).replace('__NAV__', navHtml('mftrio')))

// the chooser is plain HTML, no three.js
{
  const html = read('chooser.html')
    .replace('__MIAL_LOGO__', b64('logo')).replace('__MF_LOGO__', b64('mflogo')).replace('__MASSINI_LOGO__', b64('massini'))
    .replace('__MIAL_IMG__', b64('mialcard')).replace('__MF_IMG__', b64('mfline'))
  writeFileSync(resolve(here, '../index.html'), html)
  console.log('built index.html')
}

// the small switcher shown at the top of both simulator pages
function navHtml(cur) {
  const a = (id, href, label) => `<a href="${href}"${id === cur ? ' class="on" aria-current="page"' : ''}>${label}</a>`
  return `<a class="home" href="index.html" aria-label="Home">&#8592;</a>${a('mial', 'mial.html', 'MIAL')}${a('mftrio', 'mftrio.html', 'MF TECNO')}`
}
