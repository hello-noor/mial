const { THREE, Lab, MAT, GEO, clamp, lerp, approach, fmt, smoothstep } = window.LabKit
const PI = Math.PI

/* ------------------------------------------------------------------ research
 MF TECNO "MF Trio Line" (a Massini Industries brand): a packaging line ready to go, three machines in one integrated
 supply: MF 54 vertical packaging machine -> MF Smart Palletizer -> MF Wrap 35 stretch wrapper.
 From the MF TECNO flyer, film and website (mftecno.com/it, checked against the three product pages): "3 machines,
 1 single supply", "ready to ship", "tested integration", immediate delivery. Quoted capacities in the line: MF 54 up to
 20 bags/min (1200 bags/h, bags 5 to 20 kg, 230 x 300 to 470 x 680 mm), palletizer up to 500 cycles/h in the line (the MF PCA
 Smart Pro product page says up to 800 cycles/h, load up to 50 kg, pallet up to 1800 mm incl. pallet, 800 x 1200 and 1000 x 1200,
 4 brushless axes), wrapper up to 35 pallets/h, capacity 2000 kg.
 Photo of the line (flyer): the palletizer portal stands BEHIND the line; a blue arm hangs from its beam and reaches out over
 the line, ending in a large gripper that takes the bags one at a time and moves forward/back and along the beam.
 ASSUMED and marked as such in the page: the exact bag size, 1 bag per palletizer cycle (as in the photo), 6 bags per layer on a
 1200 x 800 pallet, belt speed, turntable speed, all the geometry.

 Layout of the model (m): MF 54 on a platform at the left, bags drop on the infeed belt, a portal palletizer picks a row of
 bag after bag and stacks them on a pallet on the roller conveyor, the full pallet rolls to the turntable of the wrapper at the
 right, is wrapped in stretch film and leaves toward the front.

 Model (computed in the tick below, not typed in):
   bags/h = 60 x rate       rate = min(bagger setting, bag limit), and 0 while the line is backed up
   t/h    = bags/h x kg
   cycles/h = bags/h      (palletizer cycle fixed at 3600/500 = 7.2 s, one bag per pick, so at most 500/60 = 8.3 bags/min)
   pallets/h = bags/h / (6 x layers)     wrapper cycle 3600/35 = 102.9 s
 Hero: bags per minute. Input: bagger speed. Break: the film runs out on the wrapper, the line backs up.
*/

// ------------------------------------------------------------------ constants
const BELT_Y = 0.75, X_DROP = 2.0, X_STOP = 3.7, X_PICK = 3.5             // belt top, bag drop, belt end, pick position (one bag)
const ROLL_Y = 0.2                                                       // top of the rollers and of the turntable
const X_PAL = 4.65, X_WRAP = 7.7, X_MAST = 9.2
const BAG = { L: 0.40, T0: 0.13 }                                         // square pillow bag, 0.40 x 0.40, 0.13 thick at 10 kg
const PAL = { L: 1.2, W: 0.8, H: 0.144 }
const PER_ROW = 1, ROWS_PER_LAYER = 6, PER_LAYER = PER_ROW * ROWS_PER_LAYER   // one bag per cycle; 3 x 2 bags per layer
const CYCLE_S = 3600 / 500                                                // palletizer cycle, s (500 cycles/h)
const WRAP_TOTAL_S = 3600 / 35                                            // wrapper cycle, s (35 pallets/h)
const IN_S = 8, OUT_S = 4, WRAP_S = WRAP_TOTAL_S - IN_S - OUT_S
const BELT_V = 0.5, TT_RPM = 8
const BPM_MAX = 20
const PZ_BPM = 3600 / CYCLE_S / 60                                        // the palletizer takes one bag per cycle: 500 cycles/h = 8.3 bags/min
const YC = 1.75                                                           // travel height of the gripper (underside of the plate)
const HEAD_X = 2.2, HEAD_X1 = 5.95, GZ = 1.15                             // gantry posts
const BAG_KG = { 5: { t: 0.065, layers: 12, cap: PZ_BPM }, 10: { t: 0.13, layers: 6, cap: PZ_BPM }, 20: { t: 0.26, layers: 3, cap: PZ_BPM } }
let kg = 10
let LY = null                                                             // pallet height in layers, null = the default for the bag weight
const PH = innerWidth <= 760                                              // phone layout: the whole line has to fit the narrow screen

const lab = new Lab({
  prompt: 'a vertical bagging machine, a palletizer and a pallet wrapper as one packaging line',
  no: 8, title: 'MF Trio Line', sub: '20 bags/min',
  size: 9.6,
  view: PH ? { az: 14, el: 10, dist: 4.5, target: [4.75, 1.5, 0], fov: 30, frameX: 0 } : { az: 14, el: 10, dist: 1.98, target: [4.75, 2.45, 0], fov: 30, frameX: -0.07 },
  cut: { a: [0, 0, 1], b: [0, 0, 1], center: [0, 0, 0], reach: 0.3 },
})

// ------------------------------------------------------------------ editorial: logo, machine name, description
{
  const st = document.createElement('style')
  st.textContent = `
  .lab-prompt, .lab-pills { display:none !important }
  .sw { position:absolute; left:50%; top:3.2vh; transform:translateX(-50%); z-index:45; display:flex; gap:2px; padding:3px; border-radius:999px; background:rgba(249,246,240,0.92); border:1px solid rgba(40,36,30,0.16); pointer-events:auto; font:600 clamp(11px,0.82vw,14px) 'Inter',sans-serif }
  .sw a { padding:0.42em 0.95em; border-radius:999px; color:#4a463f; text-decoration:none }
  .sw a:hover { background:rgba(40,36,30,0.08) }
  .sw a.on { background:#1d1b18; color:#f4f1ea }
  .sw .home { padding:0.42em 0.7em }
  .mial-head { position:absolute; left:4.2vw; top:4.4vh; display:flex; align-items:center; gap:1.1vw; pointer-events:none }
  .mial-head img { height:clamp(28px,4.2vh,58px); display:block }
  .mial-head .sep { width:1px; height:clamp(24px,3.4vh,46px); background:rgba(40,36,30,0.28) }
  .mial-head b { display:block; font:500 clamp(15px,1.45vw,26px)/1.1 'Inter',sans-serif; letter-spacing:-0.01em; color:#1d1b18 }
  .mial-head small { display:block; margin-top:0.25em; font:400 clamp(10px,0.82vw,14px)/1.2 'JetBrains Mono',monospace; letter-spacing:0.02em; color:#7b766c }
  .mial-spec { position:absolute; left:4.2vw; top:14vh; pointer-events:none }
  .mial-spec b { display:block; font:600 clamp(18px,1.75vw,32px)/1.1 'Inter',sans-serif; letter-spacing:-0.01em; color:#1f4e9c; margin-bottom:0.45em }
  .mial-spec span { display:block; font:400 clamp(13px,1.25vw,23px)/1.45 'Inter',sans-serif; color:#1d1b18 }
  .mial-spec p { margin:1.3em 0 0; max-width:15.5vw; font:400 clamp(11px,0.82vw,14px)/1.55 'Inter',sans-serif; color:#5b574f }
  .mial-spec p strong { font-weight:600; color:#2a2723 }
  .lab-how { z-index:40; pointer-events:auto; top:4.4vh; bottom:auto; right:4.2vw; width:auto; text-align:right }
  .lab-how[open] { text-align:left }
  .lab-how summary { padding:0.2em 0 }
  .lab-how[open] { right:3vw; top:3vh; bottom:auto; width:clamp(340px,33vw,620px); max-height:90vh; overflow:auto; padding:1.3em 1.5em; background:#f9f6f0; border:1px solid rgba(40,36,30,0.14); border-radius:14px; box-shadow:0 20px 64px rgba(0,0,0,0.22); color:#34312b; font-size:clamp(12px,0.92vw,16px); line-height:1.6 }
  .lab-how[open] summary { margin-bottom:0.8em; font-weight:600 }
  .lab-how .eq { background:rgba(40,36,30,0.05); padding:0.4em 0.7em; border-radius:6px }
  .lab-lab { font-size:clamp(11px,0.84vw,16px); font-weight:600; color:#1d1b18; padding:0.35em 0.7em 0.45em; background:rgba(249,246,240,0.9); border-radius:9px; box-shadow:0 1px 0 rgba(0,0,0,0.05),0 8px 22px rgba(0,0,0,0.1); text-shadow:none }
    .lab-lab small { margin-top:0.15em; font:600 1.18em 'JetBrains Mono',monospace; color:#1f4e9c; letter-spacing:-0.01em }
  .kpis { display:grid; grid-template-columns:repeat(3,1fr); gap:0.55em 0.7em; margin-top:clamp(12px,2vh,26px); padding-top:clamp(10px,1.6vh,20px); border-top:1px solid rgba(40,36,30,0.14) }
  .kpis div { min-width:0 }
  .kpis small { display:block; font:500 clamp(9px,0.7vw,12px)/1.2 'Inter',sans-serif; letter-spacing:0.08em; text-transform:uppercase; color:#8a857a }
  .kpis b { display:block; margin-top:0.2em; font:600 clamp(15px,1.4vw,27px)/1.1 'JetBrains Mono',monospace; letter-spacing:-0.02em; color:#1d1b18; white-space:nowrap }
  .kpis b i { font:500 0.55em 'Inter',sans-serif; color:#8a857a; margin-left:0.25em; letter-spacing:0 }
  .kpis.bad b { color:#c4511a }
  @media (min-width:761px) { .lab-modes { right:30vw; left:4.2vw } }
  @media (max-height:920px) { .gate-hint { display:none } .lab-big { font-size:clamp(48px,5.6vw,100px) !important } .lab-title { font-size:clamp(34px,3.6vw,64px) !important } .lab-metric { margin-top:1.6vh !important } .lab-ctl { margin-top:1.8vh !important } .kpis { margin-top:1.4vh; padding-top:1vh } }
  @media (max-height:760px) { .mial-spec p { display:none } .lab-title i { display:none } }
  .mial-all { margin-top:1.1em; padding:0.5em 0.95em; border-radius:999px; border:1px solid rgba(31,78,156,0.55); background:transparent; color:#1f4e9c; font:600 clamp(11px,0.82vw,14px) 'Inter',sans-serif; cursor:pointer; pointer-events:auto }
  .mial-all kbd { margin-left:0.6em; font:500 0.85em 'JetBrains Mono',monospace; color:#a8a398 }
  .mial-btns { display:flex; flex-wrap:wrap; gap:0.5em; margin-top:1.1em }
  .mial-btns .mial-all { margin-top:0 }
  .spc, .faq { position:absolute; inset:0 0 8.5vh 0; display:none; align-items:center; justify-content:center; background:#eeeae1; pointer-events:auto }
  .spc { z-index:62 } .faq { z-index:63 }
  .spc.on, .faq.on { display:flex }
  .spc-card, .faq-card { position:relative; max-height:88vh; overflow:auto; padding:0 0.4vw }
  .spc-card { width:min(90vw,1600px) } .faq-card { width:min(88vw,1500px) }
  .spc-x, .faq-x { position:absolute; right:0; top:0; width:2.4em; height:2.4em; border-radius:50%; border:1px solid rgba(40,36,30,0.25); background:#f9f6f0; font:400 20px/1 'Inter',sans-serif; cursor:pointer }
  .spc h2, .faq h2 { margin:0; font:400 clamp(30px,3.3vw,60px)/1.05 'Instrument Serif',serif; letter-spacing:-0.01em; color:#1d1b18 }
  .spc h2 i, .faq h2 i { color:#7a7873 }
  .spc .sub, .faq .sub { margin:0.5em 0 1.6em; font:500 clamp(10px,0.8vw,13px)/1.3 'JetBrains Mono',monospace; letter-spacing:0.06em; text-transform:uppercase; color:#1f4e9c }
  .spc-lines { display:grid; grid-template-columns:repeat(3,1fr); gap:2.2vw }
  .spc-line { border-top:2px solid #1d1b18; padding-top:0.9em }
  .spc-line h3 { margin:0; font:600 clamp(18px,1.6vw,28px)/1.1 'Inter',sans-serif; letter-spacing:-0.01em; color:#1d1b18 }
  .spc-line p { margin:0.4em 0 1em; font:400 clamp(12px,0.9vw,15px)/1.5 'Inter',sans-serif; color:#5b574f }
  .spc-tile { padding:0.8em 0.9em 0.9em; border-radius:10px; border:1px solid rgba(40,36,30,0.16); background:#f9f6f0; margin-bottom:1.1em }
  .spc-tile small { display:block; font:500 clamp(10px,0.74vw,12px)/1.3 'Inter',sans-serif; color:#8a857a }
  .spc-tile .q { margin-top:0.4em; font:600 clamp(24px,2.3vw,40px)/1 'JetBrains Mono',monospace; letter-spacing:-0.03em; color:#1f4e9c }
  .spc-tile .q i { font:500 0.42em 'Inter',sans-serif; color:#8a857a; margin-left:0.3em; letter-spacing:0 }
  .spc-tile .bar { height:4px; margin-top:0.7em; border-radius:2px; background:rgba(40,36,30,0.1) } .spc-tile .bar span { display:block; height:100%; border-radius:2px; background:#1f4e9c }
  .spc-rows div { display:grid; grid-template-columns:7.5em 1fr; gap:0.8em; padding:0.5em 0; border-bottom:1px solid rgba(40,36,30,0.1); font:400 clamp(11px,0.86vw,14px)/1.45 'Inter',sans-serif; color:#2e2b26 }
  .spc-rows div span { color:#8a857a }
  .spc-common { margin-top:1.6em; display:flex; flex-wrap:wrap; gap:0.5em }
  .spc-common b { padding:0.4em 0.85em; border-radius:999px; background:#1d1b18; color:#f4f1ea; font:500 clamp(10px,0.8vw,13px) 'Inter',sans-serif }
  .spc-foot, .faq-foot { margin-top:1.2em; font:400 clamp(10px,0.74vw,12px)/1.5 'Inter',sans-serif; color:#8a857a }
  .faq-cols { display:grid; grid-template-columns:1fr 1fr; gap:2.4vw; align-items:start }
  .faq-col h3 { margin:0 0 0.5em; padding-top:0.8em; border-top:2px solid #1d1b18; font:600 clamp(15px,1.3vw,22px)/1.1 'Inter',sans-serif; color:#1d1b18 }
  .faq-col h3 small { display:block; margin-top:0.35em; font:400 clamp(10px,0.78vw,13px)/1.3 'Inter',sans-serif; color:#8a857a }
  .faq details { border-bottom:1px solid rgba(40,36,30,0.14) }
  .faq summary { cursor:pointer; list-style:none; padding:0.85em 1.6em 0.85em 0; position:relative; font:600 clamp(13px,1.02vw,18px)/1.35 'Inter',sans-serif; color:#1d1b18 }
  .faq summary::-webkit-details-marker { display:none }
  .faq summary::after { content:'+'; position:absolute; right:0.2em; top:0.7em; font:400 1.3em/1 'Inter',sans-serif; color:#1f4e9c }
  .faq details[open] summary::after { content:'\\2212' }
  .faq details p { margin:0 0 1em; padding-right:1.6em; font:400 clamp(12px,0.95vw,16px)/1.6 'Inter',sans-serif; color:#4d4a43 }
  .gate-hint { margin-top:0.5em; font:400 clamp(10px,0.78vw,13px)/1.4 'Inter',sans-serif; color:#8a857a }
  .mat-sel .chips { display:flex; flex-wrap:wrap; gap:5px; margin-top:0.6em; pointer-events:auto }
  .mat-sel button { display:inline-flex; align-items:center; gap:0.5em; padding:0.32em 0.7em; border-radius:999px; border:1px solid rgba(40,36,30,0.22); background:transparent; color:#4a463f; font:500 clamp(10px,0.74vw,13px) 'Inter',sans-serif; cursor:pointer }
  .mat-sel button.on { background:#1d1b18; color:#f4f1ea; border-color:#1d1b18 }
  .mial-head, .mial-spec, .lab-how { }
  `
  document.head.appendChild(st)
  const mst = document.createElement('style')
  mst.textContent = `
@media (max-width:760px) {
    .sw { left:10px; top:62px; transform:none; font-size:11px }
    body.mob-open .sw { display:none }
    .mial-head { left:10px; right:10px; top:10px; gap:10px; padding:10px 12px; border-radius:14px; background:rgba(238,234,225,0.94) }
    .mial-head img { height:24px }
    .mial-head .sep { height:22px }
    .mial-head b { font-size:13px }
    .mial-head small { font-size:9px }
    .mial-spec { left:10px; right:10px; top:82px; padding:12px 14px 14px; border-radius:14px; background:rgba(238,234,225,0.94) }
    .mial-spec b { font-size:17px; margin-bottom:0.2em }
    .mial-spec span { font-size:12px }
    .mial-spec p, .lab-beat, .lab-brand, .lab-scale, .lab-how, .lab-pills { display:none !important }
    .mial-btns { margin-top:10px; gap:6px }
    .mial-all { margin-top:0; padding:0.42em 0.8em; font-size:11px }
    .mial-all kbd { display:none }
    .lab-side { top:auto; bottom:64px; left:10px; right:10px; width:auto; transform:none; padding:12px 14px 14px; background:rgba(249,246,240,0.96); border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,0.14); max-height:50vh; overflow:auto }
    .lab-title { font-size:24px !important }
    .lab-title i { display:none }
    .lab-metric { margin-top:8px !important }
    .lab-metric .lbl { font-size:11px }
    .lab-big { font-size:44px !important }
    .lab-sub { font-size:11px }
    .lab-ctl { margin-top:10px !important }
    .lab-ctl .row { font-size:11px; margin-bottom:0.35em }
    .lab-ctl .ends { font-size:10px }
    .kpis { margin-top:10px !important; padding-top:8px !important; gap:6px 8px }
    .kpis small { font-size:8px }
    .kpis b { font-size:14px }
    .mat-sel .chips { flex-wrap:nowrap; overflow-x:auto; scrollbar-width:none; padding-bottom:2px }
    .mat-sel .chips::-webkit-scrollbar { display:none }
    .mat-sel button { flex:0 0 auto; font-size:11px }
    .lab-modes { left:10px; right:86px; bottom:12px; flex-wrap:nowrap; overflow-x:auto; scrollbar-width:none; gap:6px; font-size:12px }
    .lab-modes::-webkit-scrollbar { display:none }
    .lab-modes button { flex:0 0 auto; padding:0.45em 0.85em; background:rgba(249,246,240,0.96) }
    .lab-modes kbd { display:none }
    .gate-hint { display:none !important }
    .mial-spec, .lab-side { display:none }
    body.mob-open .mial-head { display:flex }
    body.mob-open .mial-spec, body.mob-open .lab-side { display:block }
    .mob-info { display:block; position:fixed; right:10px; bottom:12px; z-index:70; padding:0.45em 0.85em; border-radius:999px; border:1px solid rgba(40,36,30,0.3); background:#1d1b18; color:#f4f1ea; font:600 12px 'Inter',sans-serif; cursor:pointer }
    body.mob-open .mob-info { background:#f9f6f0; color:#1d1b18 }
    .spc-lines, .faq-cols { grid-template-columns:1fr !important }
    .spc-card, .faq-card { width:92vw }
  }
`
  document.head.appendChild(mst)
  const nv = document.createElement('nav'); nv.className = 'sw'; nv.setAttribute('aria-label', 'Simulators'); nv.innerHTML = '__NAV__'; lab.ui.appendChild(nv)
  const h = document.createElement('div'); h.className = 'mial-head'
  h.innerHTML = `<img alt="MF TECNO" src="data:image/png;base64,__MF_LOGO__"><span class="sep"></span><div><b>MF Trio Line</b><small>MF 54 · MF Smart Palletizer · MF Wrap 35</small></div>`
  lab.ui.appendChild(h)
  const sp = document.createElement('div'); sp.className = 'mial-spec'
  sp.innerHTML = '<b>Your packaging line ready to go</b><span>Vertical packaging machine</span><span>Palletizer · Pallet wrapper</span><p>Three machines, <strong>one single supply</strong>: bagging, palletizing and stretch wrapping in one integrated solution, with proven mechanics, electrics and software. Available for immediate delivery: production in weeks, not months.</p><div class="mial-btns"><button class="mial-all mial-specb">Models and specs<kbd>D</kbd></button><button class="mial-all mial-faqb">FAQ<kbd>F</kbd></button></div>'
  lab.ui.appendChild(sp)
  sp.querySelector('.mial-specb').addEventListener('click', () => lab.toggle('models'))
  sp.querySelector('.mial-faqb').addEventListener('click', () => lab.toggle('faq'))
  lab.$('.lab-no').textContent = 'MF TECNO · MF TRIO LINE'
  lab.$('.lab-title').innerHTML = 'Live<i>from the simulation</i>'
}

// ------------------------------------------------------------------ materials
const steelM = MAT.stainless({ roughness: 0.32 })
const steelBrushed = MAT.stainless({ roughness: 0.24 })
const frameM = MAT.stainless({ roughness: 0.42 })
const blue = MAT.paint({ color: [0.02, 0.1, 0.36], roughness: 0.34 })
const white = MAT.paint({ color: [0.8, 0.82, 0.84], roughness: 0.4 })
const dark = MAT.satin({ color: [0.04, 0.045, 0.05], roughness: 0.5 })
const chrome = MAT.chrome({ roughness: 0.1 })
const rubberM = MAT.rubber()
const woodM = MAT.satin({ color: [0.5, 0.31, 0.13], roughness: 0.85, finish: null, cap: [0.6, 0.42, 0.2] })

// ------------------------------------------------------------------ geometry helpers
const place = (g, x, y, z = 0, rz = 0) => { if (rz) g.rotateZ(rz); g.translate(x, y, z); return g }
const box = (w, h, d, x, y, z = 0, r) => place(GEO.rbox(w, h, d, r ?? Math.min(w, h, d) * 0.12, 3), x, y, z)
const cylY = (r, h, x, y, z = 0, seg = 28) => new THREE.CylinderGeometry(r, r, h, seg).translate(x, y, z)
const cylZ = (r, len, x, y, z = 0, seg = 28) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(PI / 2).translate(x, y, z)
const cylX = (r, len, x, y, z = 0, seg = 28) => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(PI / 2).translate(x, y, z)
const ribbon = (p0, p1, w, th = 0.004) => {
  const a = new THREE.Vector3(...p0), b = new THREE.Vector3(...p1), len = a.distanceTo(b)
  const g = new THREE.BoxGeometry(w, th, len), m = new THREE.Matrix4().lookAt(b, a, new THREE.Vector3(0, 1, 0))
  m.setPosition(a.clone().add(b).multiplyScalar(0.5)); g.applyMatrix4(m); return g
}
const plateTex = (text, sub, aspect = 4) => {
  const H = 128, W = Math.round(H * aspect)
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')
  g.fillStyle = '#14377a'; g.fillRect(0, 0, W, H)
  g.fillStyle = '#ffffff'; g.textBaseline = 'middle'
  let fs = 58; g.font = `700 ${fs}px Inter, Arial, sans-serif`
  const tw = g.measureText(text).width, room = W - 44
  if (tw > room) { fs = Math.floor(fs * room / tw); g.font = `700 ${fs}px Inter, Arial, sans-serif` }
  if (aspect > 6) { g.textAlign = 'center'; g.fillText(text, W / 2, H / 2 + 2); g.textAlign = 'left' } else g.fillText(text, 22, sub ? 48 : H / 2 + 2)
  if (sub) { g.font = '500 24px Inter, Arial, sans-serif'; g.fillStyle = '#b9c8e8'; g.fillText(sub, 24, 98) }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t
}
const plate = (text, sub, w, h, x, y, z, ry = 0, name = 'Name plate') => {
  const m = MAT.satin({ color: [1, 1, 1], map: plateTex(text, sub, w / h), roughness: 0.45, finish: null, noCap: true })
  const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); o.position.set(x, y, z); o.rotation.y = ry
  return lab.add(o, { name, explode: [0, 0, ry === 0 ? 1.2 : -1.2] })
}

// ------------------------------------------------------------------ MF 54 vertical packaging machine
const XJ = 1.25, HUB_X = 1.625, CR = 0.375                                   // XJ: fill station under the funnel; the carousel hub sits half way to the drop station X_DROP above the belt
const hopM = MAT.stainless({ roughness: 0.24, side: THREE.DoubleSide })
{
  // electrical cabinet at the front, stainless forming column behind it
  const cab = [
    box(0.85, 1.95, 0.5, 0.58, 0.975, 0.2, 0.02),
    box(0.9, 0.06, 0.96, 0.58, 0.03, 0, 0.01),
  ]
  for (const x of [0.4, 0.78]) { cab.push(box(0.34, 0.78, 0.012, x, 0.62, 0.456, 0.003)); cab.push(cylX(0.011, 0.07, x + 0.12, 0.62, 0.47, 12)) }
  lab.mesh(GEO.merge(cab), white, { name: 'MF 54 electrical cabinet', explode: [0, 0, -1.0], xray: 'shell', count: 3 })
  lab.mesh(box(0.85, 1.95, 0.5, 0.58, 0.975, -0.3, 0.02), steelBrushed, { name: 'Forming column', explode: [0, 0, -1.4], xray: 'shell', count: 3 })
  lab.mesh(GEO.merge([box(0.3, 0.2, 0.014, 0.58, 1.42, 0.463, 0.005)]), dark, { name: 'Touch screen', explode: [0, 0, 1.2] })
  plate('MF 54', 'VERTICAL BAGGING MACHINE', 0.5, 0.125, 0.58, 1.78, 0.461, 0, 'MF 54 plate')
  // platform, rails, ladder
  const pf = [box(1.9, 0.04, 1.1, 0.95, 1.97, 0, 0.005)]
  const rail = (x0, z0, x1, z1, y) => { const l = Math.hypot(x1 - x0, z1 - z0); return place(new THREE.BoxGeometry(l, 0.035, 0.035).rotateY(-Math.atan2(z1 - z0, x1 - x0)), (x0 + x1) / 2, y, (z0 + z1) / 2) }
  for (const sz of [-1, 1]) for (const y of [2.45, 2.95]) pf.push(rail(0, sz * 0.55, 1.9, sz * 0.55, y))
  for (const y of [2.45, 2.95]) pf.push(rail(1.9, -0.55, 1.9, 0.55, y))
  for (const x of [0, 0.475, 0.95, 1.425, 1.9]) for (const sz of [-1, 1]) pf.push(box(0.04, 1.0, 0.04, x, 2.47, sz * 0.55, 0.008))
  lab.mesh(GEO.merge(pf), steelM, { name: 'Platform and rails', explode: [0, 0.9, 0], count: 14 })
  const ld = [box(0.04, 1.95, 0.04, -0.05, 0.975, -0.2, 0.008), box(0.04, 1.95, 0.04, -0.05, 0.975, 0.2, 0.008)]
  for (let y = 0.2; y < 1.95; y += 0.25) ld.push(box(0.03, 0.03, 0.4, -0.05, y, 0, 0.006))
  lab.mesh(GEO.merge(ld), steelM, { name: 'Ladder', explode: [-0.8, 0, 0.5], count: 9 })
  // dosing unit on the platform: two stainless boxes, a blue gear motor and logos
  lab.mesh(GEO.merge([box(0.62, 0.5, 0.52, XJ, 2.25, 0, 0.02), box(0.62, 0.55, 0.52, XJ, 2.78, 0, 0.02)]), steelBrushed, { name: 'Dosing unit', explode: [0, 1.0, 0], xray: 'shell', count: 2 })
  lab.mesh(GEO.merge([cylX(0.085, 0.22, XJ + 0.37, 2.8, 0.12, 24), cylZ(0.1, 0.012, XJ - 0.14, 2.82, 0.266, 28), cylZ(0.07, 0.012, XJ - 0.14, 2.25, 0.266, 28)]), blue, { name: 'Gear motor and logos', explode: [0.4, 1.0, 0.6], count: 3 })
  // open hopper on top: a wide rectangular mouth that leans away from the carousel, toward the ladder side (-x), its neck standing on the dosing unit
  lab.mesh(new THREE.CylinderGeometry(0.5, 0.2, 0.6, 4, 1, true).rotateY(PI / 4).scale(1, 1, 0.8).rotateZ(0.45).translate(XJ - 0.13, 3.34, 0), hopM, { name: 'Open hopper', explode: [-0.3, 1.4, 0], count: 2 })
  // funnel under the dosing unit, through the platform, ending just above the spout at the fill station
  lab.mesh(new THREE.CylinderGeometry(0.2, 0.06, 0.26, 36, 1, true).translate(XJ, 1.88, 0), hopM, { name: 'Funnel', explode: [0, 0.6, 0], count: 1 })
  lab.mesh(cylY(0.05, 0.2, HUB_X, 1.86, 0, 16), steelM, { name: 'Carousel post', explode: [0, 0.4, 0], count: 1 })
}
// the filling carousel: a hub under the platform with four arms, each carrying a hanging spout. It indexes 90 degrees at a time:
// fill station under the funnel, side, drop station above the belt, side
const carousel = new THREE.Group()
{
  const g = [cylY(0.1, 0.05, 0, 0, 0, 32)]
  for (let i = 0; i < 4; i++) {
    const a = -i * PI / 2
    g.push(new THREE.BoxGeometry(CR, 0.05, 0.07).translate(CR / 2, 0, 0).rotateY(a))
    g.push(cylY(0.05, 0.46, CR, -0.23, 0, 18).rotateY(a))
    g.push(cylY(0.065, 0.04, CR, -0.46, 0, 18).rotateY(a))
  }
  carousel.add(new THREE.Mesh(GEO.merge(g), chrome))
}
lab.add(carousel, { name: 'Filling carousel (4 spouts)', explode: [0, 0.8, 0], count: 13 })

// ------------------------------------------------------------------ infeed belt
const beltT = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 16; const g = c.getContext('2d'); g.fillStyle = '#1b1c1e'; g.fillRect(0, 0, 64, 16); g.fillStyle = '#2c2e31'; g.fillRect(0, 0, 4, 16); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 1); t.colorSpace = THREE.SRGBColorSpace; return t })()
{
  const x0 = 1.7, x1 = X_STOP + 0.05, len = x1 - x0, cx = (x0 + x1) / 2
  const fr = [box(len, 0.1, 0.04, cx, 0.62, 0.3, 0.008), box(len, 0.1, 0.04, cx, 0.62, -0.3, 0.008), box(len, 0.1, 0.02, cx, 0.785, 0.31, 0.004), box(len, 0.1, 0.02, cx, 0.785, -0.31, 0.004), box(0.02, 0.12, 0.5, X_STOP + 0.04, 0.81, 0, 0.004)]
  for (const x of [1.9, 2.7, 3.45]) for (const sz of [-1, 1]) fr.push(box(0.05, 0.6, 0.05, x, 0.3, sz * 0.3, 0.008))
  for (const x of [1.9, 2.7, 3.45]) fr.push(box(0.04, 0.04, 0.6, x, 0.12, 0, 0.006))
  fr.push(cylZ(0.045, 0.56, x0, 0.69, 0, 20), cylZ(0.045, 0.56, x1, 0.69, 0, 20))
  lab.mesh(GEO.merge(fr), frameM, { name: 'Infeed conveyor frame', explode: [0, -0.2, -1.3], count: 16, xray: 'shell' })
  const bm = MAT.rubber({ map: beltT, roughness: 0.7, finish: null })
  lab.mesh(GEO.rbox(len - 0.04, 0.02, 0.56, 0.004, 2), bm, { name: 'Infeed belt', pos: [cx, 0.735, 0], explode: [0, 0.5, 0.8] })
}

// ------------------------------------------------------------------ roller conveyor
{
  const x0 = 3.88, x1 = 6.78, rl = []
  for (let x = x0 + 0.06; x < x1; x += 0.12) rl.push(cylZ(0.03, 0.86, x, 0.17, 0, 14))
  lab.mesh(GEO.merge(rl), steelBrushed, { name: 'Rollers', explode: [0, 0.5, 0.8], count: rl.length })
  const fr = [box(x1 - x0, 0.13, 0.04, (x0 + x1) / 2, 0.12, 0.47, 0.008), box(x1 - x0, 0.13, 0.04, (x0 + x1) / 2, 0.12, -0.47, 0.008)]
  for (const x of [4.1, 5.2, 6.3]) for (const sz of [-1, 1]) fr.push(box(0.05, 0.07, 0.05, x, 0.035, sz * 0.47, 0.008)), fr.push(box(0.05, 0.04, 1.0, x, 0.02, 0, 0.006))
  lab.mesh(GEO.merge(fr), frameM, { name: 'Roller conveyor frame', explode: [0, -0.3, -1.4], count: 10 })
}

// ------------------------------------------------------------------ palletizer: portal gantry, cross member, slider, mast, gripper
{
  const f = []
  // as on the MF flyer: one deep beam along the line on two heavy posts; the blue arm hangs from it and reaches out across the line
  for (const x of [HEAD_X, HEAD_X1]) { f.push(box(0.3, 2.97, 0.3, x, 1.485, -GZ, 0.014)); f.push(box(0.5, 0.03, 0.5, x, 0.015, -GZ, 0.006)); f.push(box(0.4, 0.04, 0.4, x, 2.95, -GZ, 0.008)) }
  f.push(box(HEAD_X1 - HEAD_X + 0.5, 0.34, 0.26, (HEAD_X + HEAD_X1) / 2, 2.8, -GZ, 0.014))
  lab.mesh(GEO.merge(f), steelBrushed, { name: 'Palletizer portal', explode: [0, 0, -1.2], count: 12, xray: 'shell' })
  plate('MF SMART PALLETIZER', null, 3.0, 0.15, (HEAD_X + HEAD_X1) / 2, 2.8, -GZ + 0.132, 0, 'Palletizer plate')
  lab.mesh(GEO.merge([box(0.6, 1.4, 0.35, 6.45, 0.7, -1.45, 0.02), box(0.16, 0.1, 0.014, 6.45, 1.15, -1.27, 0.004)]), white, { name: 'Palletizer cabinet', explode: [0.5, 0, -1.2], count: 2 })
}
// the blue cantilever: a carriage on the beam, a vertical column rising from it with a motor cap, the arm reaching out over the belt
const xcar = lab.mesh(GEO.merge([box(0.24, 0.2, 1.95, 0, 0, -0.275, 0.014), box(0.62, 0.66, 0.42, 0, 0.2, -GZ, 0.014), box(0.3, 0.1, 0.3, 0, -0.05, 0.65, 0.01), box(0.26, 0.7, 0.26, 0, 0.88, -GZ, 0.012), box(0.36, 0.14, 0.36, 0, 1.3, -GZ, 0.01)]), blue, { name: 'Blue arm (cantilever over the line)', pos: [X_PICK, 2.55, 0], explode: [0, 0.9, 0], count: 3 })
const chain = lab.mesh(box(0.12, 0.72, 0.12, 0, 0, 0, 0.02), steelBrushed, { name: 'Cable chain (column)', pos: [X_PICK + 0.19, 3.43, -GZ], explode: [0.5, 0.9, 0], count: 2 })
const zsl = lab.mesh(box(0.34, 0.26, 0.32, 0, 0, 0, 0.02), blue, { name: 'Slider', pos: [X_PICK, 2.4, 0], explode: [0, 1.3, 0.6] })
const mastG = new THREE.BoxGeometry(0.14, 1, 0.14).translate(0, 0.5, 0)
const mast = lab.mesh(mastG, blue, { name: 'Telescopic mast', pos: [X_PICK, 1.8, 0], explode: [0, 1.8, 0.9] })
const gripG = GEO.merge([box(0.84, 0.05, 0.56, 0, 0.025, 0, 0.008), box(0.22, 0.1, 0.22, 0, 0.1, 0, 0.012), box(0.14, 0.22, 0.56, -0.35, 0.15, 0, 0.012), box(0.14, 0.22, 0.56, 0.35, 0.15, 0, 0.012), box(0.56, 0.06, 0.56, 0, 0.16, 0, 0.01)])
const grip = lab.mesh(gripG, steelBrushed, { name: 'Gripper head', pos: [X_PICK, YC, 0], explode: [0, 0.5, 1.4], count: 2 })
const clG = new THREE.BoxGeometry(0.02, 1, 0.5).translate(0, -0.5, 0)
const clA = lab.mesh(clG, chrome, { name: 'Clamp plates', pos: [X_PICK - 0.21, YC, 0], explode: [-0.7, 0.2, 1.4], count: 2 })
const clB = lab.mesh(clG.clone(), chrome, { name: 'Clamp plate (far)', pos: [X_PICK + 0.21, YC, 0], explode: [0.7, 0.2, 1.4] })

// ------------------------------------------------------------------ wrapper: turntable, mast, film carriage
const ttSpin = new THREE.Group(); ttSpin.position.set(X_WRAP, 0, 0)
{
  const pads = []
  for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * PI; pads.push(box(0.5, 0.012, 0.09, Math.cos(a) * 0.62, 0.2, Math.sin(a) * 0.62, 0.004).rotateY(-a)) }
  const plateG = GEO.merge([GEO.lathe([[0, 0.09], [0.95, 0.09], [0.95, 0.2], [0, 0.2]], 72), ...pads, box(0.12, 0.012, 0.3, 0.84, 0.2, 0, 0.003)])
  ttSpin.add(new THREE.Mesh(plateG, steelBrushed))
}
lab.add(ttSpin, { name: 'Turntable', explode: [0, 0.6, 0.9], count: 14, xray: 'shell' })
lab.mesh(GEO.merge([GEO.lathe([[0, 0], [0.9, 0], [0.9, 0.09], [0, 0.09]], 64).translate(X_WRAP, 0, 0), box(1.5, 0.04, 0.2, X_WRAP, 0.02, 0, 0.005)]), frameM, { name: 'Turntable base', explode: [0, -0.2, -1.3], count: 2 })
lab.mesh(GEO.merge([box(0.55, 0.06, 0.55, X_MAST, 0.03, 0, 0.01), box(0.2, 2.55, 0.2, X_MAST, 1.33, 0, 0.012)]), blue, { name: 'Wrapper mast', explode: [0.6, 0.3, -0.9], count: 2, xray: 'shell' })
lab.mesh(GEO.merge([box(0.5, 1.4, 0.3, X_MAST, 0.7, -0.62, 0.02), box(0.18, 0.1, 0.014, X_MAST, 1.1, -0.465, 0.004)]), white, { name: 'Wrapper cabinet', explode: [0.5, 0, -1.2], count: 2 })
plate('MF WRAP 35', null, 0.42, 0.105, X_MAST, 1.36, -0.463, 0, 'MF Wrap 35 plate')
const carr = new THREE.Group()
{
  const film = MAT.plastic({ color: [0.93, 0.95, 0.97], roughness: 0.2, clearcoat: 0.8, cap: [0.9, 0.92, 0.95] })
  carr.add(new THREE.Mesh(box(0.34, 0.5, 0.34, X_MAST - 0.27, 0, 0, 0.02), blue))
  carr.add(new THREE.Mesh(cylY(0.145, 0.5, X_MAST - 0.57, 0, 0, 36), film))
  carr.add(new THREE.Mesh(cylY(0.04, 0.54, X_MAST - 0.57, 0, 0, 14), chrome))
  carr.add(new THREE.Mesh(cylY(0.05, 0.5, X_MAST - 0.43, 0.12, 0, 16), chrome))
  carr.add(new THREE.Mesh(cylY(0.05, 0.5, X_MAST - 0.43, -0.12, 0, 16), chrome))
}
lab.add(carr, { name: 'Film carriage', explode: [-0.4, 0.5, 1.0], count: 5 })
const webMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 0.004), MAT.plastic({ color: [0.96, 0.97, 0.99], roughness: 0.15, transparent: true, opacity: 0.55, noCap: true }))
lab.add(webMesh, { name: 'Stretch film', explode: [-0.4, 0.5, 1.0] })
const lampG = MAT.glow({ emissive: [0.2, 1, 0.35], emissiveIntensity: 3, noCap: true }), lampR = MAT.glow({ emissive: [1, 0.12, 0.08], emissiveIntensity: 0.1, noCap: true })
lab.mesh(cylY(0.05, 0.07, X_MAST, 2.64, 0, 18), lampG, { name: 'Green lamp', explode: [0, 1, 0], count: 0 })
lab.mesh(cylY(0.05, 0.07, X_MAST, 2.72, 0, 18), lampR, { name: 'Red lamp', explode: [0, 1, 0], count: 0 })

// ------------------------------------------------------------------ bags, pallets and film shells (instanced, moved by the simulation)
const bagTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')
  g.fillStyle = '#eef1f6'; g.fillRect(0, 0, 256, 256)
  const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, '#1b4fa8'); gr.addColorStop(1, '#2f6fd0')
  g.fillStyle = gr; g.fillRect(0, 96, 256, 64)
  g.fillStyle = '#ffffff'; g.font = '700 38px Inter, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('MF', 128, 128)
  g.strokeStyle = 'rgba(120,130,150,0.25)'; g.lineWidth = 1.5
  for (let i = 0; i < 26; i++) { const x = Math.random() * 256; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (Math.random() - 0.5) * 20, 256); g.stroke() }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t
})()
const bagGeo = GEO.merge([GEO.rbox(0.36, 0.13, 0.40, 0.055, 2), box(0.03, 0.012, 0.40, 0.19, 0, 0, 0.004), box(0.03, 0.012, 0.40, -0.19, 0, 0, 0.004)])
const bagM = MAT.plastic({ color: [1, 1, 1], map: bagTex, roughness: 0.3, clearcoat: 0.6, finish: null, cap: [0.9, 0.92, 0.95] })
const NB = 250
const bagI = new THREE.InstancedMesh(bagGeo, bagM, NB); bagI.instanceMatrix.setUsage(THREE.DynamicDrawUsage); bagI.frustumCulled = false
lab.add(bagI, { name: 'Bags', count: NB, explode: [0, 1.6, 1.8] })
const palGeo = (() => {
  const p = []
  for (const x of [-0.55, 0, 0.55]) { p.push(box(0.145, 0.022, 0.8, x, 0.011, 0, 0.003)); for (const z of [-0.35, 0, 0.35]) p.push(box(0.1, 0.1, 0.1, x, 0.072, z, 0.004)) }
  for (let i = 0; i < 7; i++) p.push(box(1.2, 0.022, 0.1, 0, 0.133, -0.36 + i * 0.12, 0.003))
  return GEO.merge(p)
})()
const NP = 3
const palI = new THREE.InstancedMesh(palGeo, woodM, NP); palI.instanceMatrix.setUsage(THREE.DynamicDrawUsage); palI.frustumCulled = false
lab.add(palI, { name: 'Pallets', count: NP * 17, explode: [0, -0.3, 1.8] })
const shells = Array.from({ length: NP }, (_, i) => {
  const m = new THREE.Mesh(GEO.rbox(1, 1, 1, 0.01, 2), MAT.plastic({ color: [1, 1, 1], roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.4, noCap: true }))
  m.visible = false; lab.add(m, { name: i === 0 ? 'Stretch wrap' : 'Stretch wrap ' + (i + 1), count: 1, explode: [0, 0.8, 1.8] }); return m
})
const bagDisp = document.createElement('canvas'); bagDisp.width = 256; bagDisp.height = 128

// ------------------------------------------------------------------ simulation
const dummy = new THREE.Object3D(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion()
const Q_HANG = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, PI / 2)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(PI / 2, 0, 0)))
const Q_ID = new THREE.Quaternion()
const AX_Y = new THREE.Vector3(0, 1, 0)
const easeIO = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

let TS = 3                                                              // simulation speed, x real time
const sim = {
  bags: Array.from({ length: NB }, (_, i) => ({ i, st: 'free', x: 0, y: -9, z: 0, f: 0, q: 0, t: 0, pal: null, lx: 0, ly: 0, lz: 0, dx: 0 })),
  pallets: [], palId: 0,
  form: { f: 0, bag: null, stalled: false }, car: { s: 0, rot: 0, phase: 'fill' }, bagger: { rate: 0, set: 12 },
  pz: { st: 'idle', ph: 0, rest: { x: X_PICK, z: 0, y: YC }, row: 0, grab: [], pose: { x: X_PICK, z: 0, y: YC }, grip: 0, did: 0 },
  wr: { stopped: false, ang: 0, carY: 0.7, wrap: 0 },
  out: 0, bagsDone: 0, rate: 0, stalledS: 0, clock: 0, drops: [], pickN: 0, cyc: 0, wrapBusy: 0,
}
window.__sim = sim                                                       // read-only handle for tests and screenshots
const PAL_MAX_H = 1.8                                                  // palletizer limit, pallet included
const maxLayers = () => Math.floor((PAL_MAX_H - PAL.H) / BAG_KG[kg].t)
const cfg = () => ({ ...BAG_KG[kg], layers: Math.min(LY ?? BAG_KG[kg].layers, maxLayers()) })
const rowsTotal = () => cfg().layers * ROWS_PER_LAYER
const freeBag = () => sim.bags.find((b) => b.st === 'free')
function resetLine() {
  for (const b of sim.bags) { b.st = 'free'; b.pal = null; b.y = -9 }
  sim.pallets = []; sim.form = { f: 0, bag: null, stalled: false }; sim.car = { s: 0, rot: 0, phase: 'fill' }
  Object.assign(sim.pz, { st: 'idle', ph: 0, rest: { x: X_PICK, z: 0, y: YC }, row: 0, grab: [], pose: { x: X_PICK, z: 0, y: YC }, grip: 0 })
  Object.assign(sim.wr, { ang: 0, carY: 0.7, wrap: 0 })
  sim.drops = []; sim.stalledS = 0
}
const stationPallet = () => sim.pallets.find((p) => ['in', 'loading', 'ready'].includes(p.st))
const wrapperBusy = () => sim.pallets.some((p) => ['toWrap', 'wrapping', 'out'].includes(p.st))
const loadH = () => PAL.H + cfg().layers * cfg().t

function stepSim(dt) {
  const c = cfg(), t = c.t
  sim.clock += dt
  // ---- pallets: spawn, slide in, hand over to the wrapper, wrap, leave
  if (!stationPallet() && sim.pallets.length < NP) sim.pallets.push({ id: sim.palId++, st: 'in', x: X_PAL, z: 2.3, yaw: 0, row: 0, wrap: 0, tt: 0, shellH: 0 })
  for (const p of sim.pallets) {
    if (p.st === 'in') { p.z = Math.max(0, p.z - dt * 1.6); if (p.z <= 0) p.st = 'loading' }
    else if (p.st === 'loading' && p.row >= rowsTotal() && sim.pz.st === 'idle') p.st = 'ready'
    else if (p.st === 'ready' && !wrapperBusy()) { p.st = 'toWrap' }
    else if (p.st === 'toWrap') { p.x = Math.min(X_WRAP, p.x + dt * (X_WRAP - X_PAL) / IN_S); if (p.x >= X_WRAP) { p.st = 'wrapping'; p.wrap = 0; sim.wr.ang = 0 } }
    else if (p.st === 'wrapping') {
      if (!sim.wr.stopped) { p.wrap = Math.min(1, p.wrap + dt / WRAP_S); sim.wr.ang += dt * TT_RPM * 2 * PI / 60; if (p.wrap >= 1) { p.st = 'out'; p.tt = 0 } }
      p.yaw = sim.wr.ang
    } else if (p.st === 'out') { p.yaw = sim.wr.ang; p.tt += dt; if (p.tt > 0.4) { p.z += dt * 2.4 / OUT_S; p.x = X_WRAP } if (p.z > 2.4) { p.st = 'gone'; sim.out++; sim.bagsDone += p.row * PER_ROW } }
  }
  if (!sim.pallets.some((q) => q.st === 'wrapping' || q.st === 'out')) { const a = sim.wr.ang % (2 * PI); sim.wr.ang = approach(a, a > PI ? 2 * PI : 0, 0.5, dt) }
  for (const p of sim.pallets.filter((q) => q.st === 'gone')) { for (const b of sim.bags) if (b.pal === p) { b.st = 'free'; b.pal = null; b.y = -9 } }
  sim.pallets = sim.pallets.filter((p) => p.st !== 'gone')

  // ---- belt: bags ride to the stop plate and queue
  const belt = sim.bags.filter((b) => b.st === 'belt').sort((a, b) => b.x - a.x)
  belt.forEach((b, i) => { const lim = i === 0 ? X_STOP - 0.2 : belt[i - 1].x - BAG.L; b.x = Math.min(b.x + BELT_V * dt, lim); b.y = BELT_Y + t / 2 })
  const falling = sim.bags.filter((b) => b.st === 'fall')
  for (const b of falling) { b.t += dt; const k = clamp(b.t / 0.3); b.y = lerp(1.14, BELT_Y + t / 2, k * k); b.q = 1 - k; if (k >= 1) { b.st = 'belt'; b.x = X_DROP; b.y = BELT_Y + t / 2; b.q = 0 } }
  const entryClear = !belt.some((b) => b.x < X_DROP + BAG.L + 0.02) && falling.length === 0

  // ---- MF 54: the carousel arms index by 90 degrees. The bag on the arm under the funnel fills; the bag on the arm above the belt drops
  const bg = sim.bagger, F = sim.form, car = sim.car
  const rateSet = Math.min(bg.set, c.cap)
  const RT = 1.2                                                                   // seconds for one 90 degree step
  const iF = car.s % 4, iD = (car.s + 2) % 4                                       // arm at the fill station, arm at the drop station
  const atD = () => sim.bags.find((b) => b.st === 'arm' && b.arm === iD && b.f >= 1)
  F.stalled = false
  if (car.phase === 'fill') {
    if (!F.bag) { const nb = freeBag(); if (nb) { F.bag = nb; nb.st = 'arm'; nb.arm = iF; nb.f = 0; F.f = 0 } }
    const dBag = atD()
    if (dBag && entryClear) { dBag.st = 'fall'; dBag.t = 0; dBag.x = X_DROP; sim.drops.push(sim.clock) }
    if (F.bag && rateSet > 0.05) {
      if (F.f < 1) { F.f = Math.min(1, F.f + dt / Math.max(0.4, 60 / rateSet - RT)); F.bag.f = F.f }
      if (F.f >= 1) { if (!atD()) { car.phase = 'rot'; car.rot = 0 } else F.stalled = true }
    }
  } else {
    car.rot += dt / RT
    if (car.rot >= 1) { car.s++; car.rot = 0; car.phase = 'fill'; F.bag = null; F.f = 0 }
  }

  // ---- palletizer: picks one bag, stacks it in the layer pattern (3 x 2, turned every other layer)
  const pz = sim.pz, sp = stationPallet()
  const pickReady = belt.length >= PER_ROW && belt.slice(0, PER_ROW).every((b, i) => Math.abs(b.x - (X_STOP - 0.2 - i * BAG.L)) < 0.015)
  if (pz.st === 'idle' && pickReady && sp && sp.st === 'loading' && sp.row < rowsTotal()) {
    pz.st = 'cycle'; pz.ph = 0; pz.row = sp.row; pz.pal = sp; pz.layer = Math.floor(sp.row / ROWS_PER_LAYER)
    { const i = pz.row % PER_LAYER, ix = i % 3, iz = Math.floor(i / 3), fl = pz.layer % 2
      pz.xrow = ((fl ? 2 - ix : ix) - 1) * BAG.L; pz.zrow = ((iz ^ fl) ? 0.2 : -0.2) }
    pz.grab = []
  }
  if (pz.st === 'cycle') {
    const prev = pz.ph; pz.ph = Math.min(1, pz.ph + dt / CYCLE_S)
    const B = [0.18, 0.30, 0.36, 0.48, 0.68, 0.80, 0.86, 1.0]                      // phase ends
    const yPick = BELT_Y + t, yPlace = ROLL_Y + PAL.H + (pz.layer + 1) * t
    const P = [pz.rest, { x: X_PICK, z: 0, y: YC }, { x: X_PICK, z: 0, y: yPick }, { x: X_PICK, z: 0, y: yPick }, { x: X_PICK, z: 0, y: YC }, { x: X_PAL + pz.xrow, z: pz.zrow, y: YC }, { x: X_PAL + pz.xrow, z: pz.zrow, y: yPlace }, { x: X_PAL + pz.xrow, z: pz.zrow, y: yPlace }, { x: X_PAL + pz.xrow, z: pz.zrow, y: YC }]
    let k = 0; while (k < 7 && pz.ph > B[k]) k++
    const a = P[k], b = P[k + 1], u = clamp((pz.ph - (k ? B[k - 1] : 0)) / (B[k] - (k ? B[k - 1] : 0)))
    const e = easeIO(u)
    pz.pose = { x: lerp(a.x, b.x, e), z: lerp(a.z, b.z, e), y: lerp(a.y, b.y, e) }
    pz.grip = k === 2 ? u : k >= 3 && k <= 5 ? 1 : k === 6 ? 1 - u : 0
    if (prev <= B[2] && pz.ph > B[2]) { pz.grab = belt.slice(0, PER_ROW); for (const g of pz.grab) { g.st = 'grip'; g.dx = g.x - X_PICK; g.z = 0 } }
    if (prev <= B[6] && pz.ph > B[6]) {
      for (const g of pz.grab) { g.st = 'stack'; g.pal = pz.pal; g.lx = pz.xrow; g.lz = pz.zrow; g.ly = PAL.H + pz.layer * t + t / 2 }
      pz.pal.row++; pz.grab = []; sim.cyc++
    }
    if (pz.ph >= 1) { pz.st = 'idle'; pz.rest = { ...pz.pose } }
  } else if (pz.st === 'idle') {
    // creep back above the pick point while waiting
    const r = pz.rest; r.x = approach(r.x, X_PICK, 0.4, dt); r.z = approach(r.z, 0, 0.4, dt); r.y = approach(r.y, YC, 0.4, dt); pz.pose = { ...r }
    pz.grip = approach(pz.grip, 0, 0.3, dt)
  }
  // ---- measured rate: smoothed, and zero while the line is backed up
  const running = !F.stalled && rateSet > 0.05 && F.bag
  sim.rate = approach(sim.rate, running ? rateSet : 0, 2.5, dt)
  sim.stalledS = F.stalled ? sim.stalledS + dt : 0
}

// ------------------------------------------------------------------ controls and readouts
lab.hero({ label: 'Bagging rate', unit: 'bags/min', max: BPM_MAX, digits: 1 })
const spd = lab.slider({ id: 'speed', label: 'MF 54 speed', min: 0, max: BPM_MAX, value: 8, step: 0.5, ends: ['Stopped', `Up to ${BPM_MAX} bags/min`], fmt: (v) => `${fmt(v, 1)} bags/min` })
spd.wrap.insertAdjacentHTML('beforeend', '<div class="gate-hint">Drag to set the speed of the vertical packaging machine (keys [ and ]). Palletizer and wrapper follow.</div>')
addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT') return; if (e.key === '[') spd.set(spd.value - 1); if (e.key === ']') spd.set(spd.value + 1) })
const kpiEl = document.createElement('div'); kpiEl.className = 'kpis'
kpiEl.innerHTML = ['Bags|/h', 'Product|t/h', 'Pallets|/h', 'Palletizer|cycles/h', 'Wrapper|% busy', 'Layer|'].map((k) => `<div><small>${k.split('|')[0]}</small><b><span>0</span><i>${k.split('|')[1]}</i></b></div>`).join('')
lab.$('.lab-metric').insertAdjacentElement('afterend', kpiEl)
const kpiV = [...kpiEl.querySelectorAll('b span')]
{
  const sel = document.createElement('div'); sel.className = 'lab-ctl on mat-sel'
  sel.innerHTML = `<div class="row"><span>Bag weight</span><b>5 to 20 kg</b></div><div class="chips" data-k="kg">${[5, 10, 20].map((w) => `<button data-v="${w}">${w} kg</button>`).join('')}</div>
    <div class="row" style="margin-top:0.9em"><span>Pallet height</span><b class="ly-val">6 layers</b></div><div class="chips" data-k="ly">${[3, 6, 9, 12].map((w) => `<button data-v="${w}">${w}</button>`).join('')}</div>
    <div class="row" style="margin-top:0.9em"><span>Simulation speed</span><b>x real time</b></div><div class="chips" data-k="ts">${[1, 3, 6, 12].map((w) => `<button data-v="${w}">${w}×</button>`).join('')}</div>`
  lab.$('.lab-ctls').appendChild(sel)
  const sync = () => {
    sel.querySelectorAll('button').forEach((b) => {
      const k = b.parentNode.dataset.k, v = Number(b.dataset.v)
      b.classList.toggle('on', k === 'kg' ? v === kg : k === 'ly' ? v === cfg().layers : v === TS)
      if (k === 'ly') b.disabled = v > maxLayers()
    })
    sel.querySelector('.ly-val').textContent = `${cfg().layers} layers · ${cfg().layers * PER_LAYER} bags`
  }
  sel.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled) return
    const v = Number(b.dataset.v), k = b.parentNode.dataset.k
    if (k === 'kg') { if (v !== kg) { kg = v; LY = null; resetLine() } }
    else if (k === 'ly') { if (v !== cfg().layers) { LY = v; resetLine() } }
    else TS = v
    sync()
  })
  sync()
  const mobBtn = document.createElement('button'); mobBtn.className = 'mob-info'; mobBtn.textContent = 'Controls'
  mobBtn.addEventListener('click', () => { const on = document.body.classList.toggle('mob-open'); mobBtn.textContent = on ? 'Close' : 'Controls' })
  document.body.appendChild(mobBtn)
}
{
  const how = lab.$('.lab-how')
  const fit = () => { if (!how.open) { how.style.maxHeight = ''; return } const top = innerHeight * 0.03, lim = lab.$('.mat-sel').getBoundingClientRect().top - top - 14; how.style.maxHeight = (lim > 260 ? lim : innerHeight * 0.9) + 'px' }
  how.addEventListener('toggle', fit); addEventListener('resize', fit)
}
lab.how(`Three machines in sequence. The <b>MF 54</b> carries an empty bag on each of four hanging spouts around a turning carousel: under the hopper the bag fills, then the carousel turns it to the belt, where it drops, at the speed you set (up to 20 bags/min, bags of 5 to 20 kg, from the website). It drops each bag on the infeed belt, where the bags queue against a stop plate. The <b>palletizer</b> stands behind the line: its blue arm hangs from the beam and reaches out over the belt, and the large gripper takes the bags one at a time (as in the flyer photo) in a cycle of 7.2 s (500 cycles/h in the line, from the film; its product page says up to 800), so the line cannot go faster than 8.3 bags/min. It stacks them, 3 x 2 per layer, on a pallet on the roller conveyor. When the pallet is full it rolls to the turntable of the <b>MF Wrap 35</b>, which spins it and wraps it in stretch film, 35 pallets/h at most, up to 2000 kg (from the website). Everything between those three quoted capacities is assumed: bags of 5, 10 or 20 kg (the range is from the website; 0.40 x 0.40 m, the thickness follows the weight, is assumed), one bag per cycle, 6 bags per layer on a 1200 x 800 pallet so every pallet carries 360 kg, belt at 0.5 m/s, turntable 8 rpm. The line is a queue network: if the wrapper stops, the full pallet waits, the palletizer has nowhere to stack, the belt fills, and the MF 54 holds its bag until there is room. That is what <b>Film runs out</b> shows. The simulation runs faster than real time (the chips under the slider); every number on screen is the real-time value.`, [
  'bags/h = 60 x rate      t/h = bags/h x kg',
  'cycles/h = bags/h / 3      cycle = 3600 / 500 = 7.2 s',
  'pallets/h = bags/h / (6 x layers)      wrapper cycle = 3600 / 35 = 102.9 s',
  'wrapper busy % = pallets/h / 35',
])
const LB = (t, at, value, side = 'right') => lab.label(lab.machine, t, { at, value, side })
LB('MF 54', [XJ + 0.3, 2.1, 0], () => `${fmt(sim.rate, 1)} bags/min`)
LB('Infeed belt', [2.2, 0.8, 0.3], () => `${sim.bags.filter((b) => b.st === 'belt').length} bags waiting`)
LB('Smart Palletizer', [4.1, 2.9, -GZ], () => `${fmt(sim.rate * 60 / PER_ROW)} cycles/h`)
LB('Pallet', [X_PAL, 1.25, 0.5], () => { const p = stationPallet(); return p ? `layer ${Math.min(cfg().layers, Math.floor(p.row / ROWS_PER_LAYER) + 1)} / ${cfg().layers}` : '--' })
LB('Turntable', [X_WRAP, 0.25, 0.9], () => { const p = sim.pallets.find((q) => q.st === 'wrapping'); return p ? `wrapping ${fmt(p.wrap * 100)} %` : 'free' })
LB('MF Wrap 35', [X_MAST, 2.4, 0], () => sim.wr.stopped ? 'film out' : `${fmt(Math.min(35, sim.rate * 60 / (cfg().layers * PER_LAYER)))} pallets/h`)

// ------------------------------------------------------------------ the display on the MF 54 and run
const dispT = new THREE.CanvasTexture(bagDisp); dispT.colorSpace = THREE.SRGBColorSpace
{
  const m = MAT.glow({ emissive: [1, 1, 1], emissiveMap: dispT, emissiveIntensity: 1.1, noCap: true })
  lab.mesh(new THREE.PlaneGeometry(0.27, 0.16), m, { name: 'Display', pos: [0.58, 1.42, 0.472], explode: [0, 0, 1.3], count: 0 })
}
const drawDisplay = (() => {
  const g = bagDisp.getContext('2d'); let last = ''
  return (a, b, bad) => {
    const key = a + b + bad; if (key === last) return; last = key
    g.fillStyle = '#04100a'; g.fillRect(0, 0, 256, 128)
    g.fillStyle = bad ? '#ffb15a' : '#8dffb0'; g.font = '600 46px "JetBrains Mono", monospace'; g.textBaseline = 'middle'; g.fillText(a, 12, 44)
    g.font = '500 26px "JetBrains Mono", monospace'; g.fillStyle = bad ? '#ffd2a0' : '#58c98a'; g.fillText(b, 12, 98)
    dispT.needsUpdate = true
  }
})()
lab.onTick((dt0, lab) => {
  sim.bagger.set = spd.value
  const dtr = dt0 * TS
  for (let left = dtr; left > 1e-6;) { const h = Math.min(0.1, left); stepSim(h); left -= h }
  const c = cfg(), t = c.t, ts = t / BAG.T0
  beltT.offset.x = (beltT.offset.x - BELT_V * dtr / 2.75 * 14) % 1
  // jaws
  const sf = sim.car.s + (sim.car.phase === 'rot' ? easeIO(clamp(sim.car.rot)) : 0)   // carousel position in 90 degree steps
  lab.place(carousel, HUB_X, 1.78, 0); carousel.rotation.y = sf * PI / 2 - PI
  // gantry
  const P = sim.pz.pose
  lab.place(xcar, P.x, 2.55, 0); lab.place(chain, P.x + 0.19, 3.43, -GZ); lab.place(zsl, P.x, 2.4, P.z)
  lab.place(mast, P.x, P.y + 0.06, P.z); mast.scale.y = 2.58 - (P.y + 0.06)
  lab.place(grip, P.x, P.y, P.z)
  const gap = lerp(0.06, 0.0, sim.pz.grip)
  lab.place(clA, P.x - 0.2 - 0.01 - gap, P.y + 0.03, P.z); lab.place(clB, P.x + 0.2 + 0.01 + gap, P.y + 0.03, P.z)
  clA.scale.y = clB.scale.y = Math.min(0.12, t * 0.85) + 0.03
  // bag instances
  const hold = P.y
  let n = 0
  for (const b of sim.bags) {
    if (b.st === 'free') { dummy.position.set(0, -9, 0); dummy.scale.set(0, 0, 0); dummy.quaternion.copy(Q_ID); dummy.updateMatrix(); bagI.setMatrixAt(b.i, dummy.matrix); continue }
    n++
    let x, y, z, yaw = 0, q = 0, sx = 1
    if (b.st === 'arm') { const al = PI - (sf - b.arm) * PI / 2; x = HUB_X + CR * Math.cos(al); z = CR * Math.sin(al); sx = Math.max(0.2, b.f); y = 1.32 - 0.36 * sx / 2; q = 1 }   // hangs from its spout, grows as it fills
    else if (b.st === 'fall') { x = X_DROP; z = 0; y = b.y; q = b.q }
    else if (b.st === 'belt') { x = b.x; y = b.y; z = 0 }
    else if (b.st === 'grip') { x = P.x + b.dx; y = hold - t / 2; z = P.z }
    else { const p = b.pal; const cs = Math.cos(p.yaw), sn = Math.sin(p.yaw); x = p.x + b.lx * cs + b.lz * sn; z = p.z - b.lx * sn + b.lz * cs; y = ROLL_Y + b.ly; yaw = p.yaw }
    qa.copy(q > 0 ? qb.copy(Q_ID).slerp(Q_HANG, q) : Q_ID)
    if (yaw) qa.premultiply(qc.setFromAxisAngle(AX_Y, yaw))
    dummy.position.set(x, y, z); dummy.quaternion.copy(qa); dummy.scale.set(sx, ts, 1); dummy.updateMatrix(); bagI.setMatrixAt(b.i, dummy.matrix)
  }
  bagI.instanceMatrix.needsUpdate = true
  // pallets and film
  for (let i = 0; i < NP; i++) {
    const p = sim.pallets[i], sh = shells[i]
    if (!p) { dummy.position.set(0, -9, 0); dummy.scale.set(0, 0, 0); dummy.quaternion.copy(Q_ID); dummy.updateMatrix(); palI.setMatrixAt(i, dummy.matrix); sh.scale.set(0.01, 0.01, 0.01); lab.place(sh, 0, -9, 0); continue }
    dummy.position.set(p.x, ROLL_Y, p.z); dummy.quaternion.setFromAxisAngle(AX_Y, p.yaw); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); palI.setMatrixAt(i, dummy.matrix)
    const wrapped = p.st === 'wrapping' || p.st === 'out'
    const prog = p.st === 'out' ? 1 : p.wrap
    const h = loadH() + 0.04
    const hh = wrapped ? Math.min(h, Math.max(0.05, h * Math.min(1, prog * 3))) : 0
    // the kit shows every registered part each frame, so an unused shell is parked under the floor with a tiny (never zero) scale
    const used = wrapped && prog > 0.003 && lab.state.xray < 0.5
    sh.scale.set(PAL.L + 0.05, Math.max(0.01, hh), PAL.W + 0.05); sh.rotation.y = p.yaw
    lab.place(sh, p.x, used ? ROLL_Y + hh / 2 : -9, p.z)
    sh.material.opacity = 0.12 + 0.4 * smoothstep(0, 1, prog)
  }
  palI.instanceMatrix.needsUpdate = true
  // wrapper: turntable, carriage, film web
  const wp = sim.pallets.find((q) => q.st === 'wrapping')
  ttSpin.rotation.y = sim.wr.ang
  const prog = wp ? wp.wrap : 0, H = loadH()
  const tri = (u) => 1 - Math.abs(2 * (u - Math.floor(u)) - 1)
  const cy = wp ? 0.5 + (H - 0.1) * smoothstep(0, 1, tri(prog * 1.5 + 0.0001)) : 0.7
  sim.wr.carY = approach(sim.wr.carY, cy, 0.15, dt0)
  lab.place(carr, 0, sim.wr.carY, 0)
  const rect = (a) => Math.min(0.6 / Math.max(1e-3, Math.abs(Math.cos(a))), 0.4 / Math.max(1e-3, Math.abs(Math.sin(a))))
  const xe = X_WRAP + rect(sim.wr.ang), xs = X_MAST - 0.57 - 0.145
  const showWeb = !!wp && !sim.wr.stopped
  const wl = Math.max(0.05, xs - xe)
  webMesh.scale.set(wl, 0.5, 1); lab.place(webMesh, xe + wl / 2, showWeb ? sim.wr.carY : -9, 0)
  const stop = sim.wr.stopped
  lampG.emissiveIntensity = stop ? 0.1 : 3; lampR.emissiveIntensity = stop ? 5 + Math.sin(lab.time * 14) * 2 : 0.1
  // hero and kpis
  const bph = sim.rate * 60, tph = bph * kg / 1000, pph = Math.min(35, bph / (c.layers * PER_LAYER))
  const sp = stationPallet()
  const backed = sim.stalledS > 1.5 || (sim.form.stalled && sim.rate < 0.3)
  const st = stop ? (sim.rate < 0.3 ? 'backed up' : 'wrapper stopped') : spd.value < 0.1 ? 'stopped' : sim.form.stalled ? 'belt full, waiting' : spd.value > c.cap ? 'at palletizer limit' : sim.rate < Math.min(spd.value, c.cap) - 0.4 ? 'starting up' : 'steady'
  const sub = stop
    ? `<span class="bad">film out · wrapper stopped · pallet waits, palletizer idle${backed ? ', MF 54 holding its bag' : ''}</span>`
    : `${kg} kg bags · ${c.layers} layers · ${c.layers * PER_LAYER} bags and ${c.layers * PER_LAYER * kg} kg per pallet`
  kpiV[0].textContent = fmt(bph); kpiV[1].textContent = fmt(tph, 2); kpiV[2].textContent = fmt(pph, 1)
  kpiV[3].textContent = fmt(bph / PER_ROW); kpiV[4].textContent = fmt(pph / 35 * 100); kpiV[5].textContent = sp ? `${Math.min(c.layers, Math.floor(sp.row / ROWS_PER_LAYER) + 1)}/${c.layers}` : '--'
  kpiEl.classList.toggle('bad', stop)
  drawDisplay(`${fmt(sim.rate, 1)} /min`, stop ? 'LINE BACKED UP' : sim.form.stalled ? 'BELT FULL' : 'RUN', stop && sim.rate < 0.3)
  lab.setHero(sim.rate, { state: st, sub, bad: stop })
})
lab.breakIt({
  label: 'Film runs out',
  run() { sim.wr.stopped = true },
  reset() { sim.wr.stopped = false },
})

// ------------------------------------------------------------------ models and specs, FAQ
const MODULES = [
  ['MF 54', 'Vertical packaging machine', 20, 'bags/min', 20, 'Forms, fills and seals the bags from a roll of film. First of the three machines.', [['Speed', 'Up to 20 bags/min (1200/h)'], ['Bag weight', '5 to 20 kg'], ['Bag size', '230 x 300 to 470 x 680 mm'], ['Bag types', 'Pillow, gusseted (PE)'], ['Build', 'AISI 304 steel, brushless servo motors']]],
  ['MF Smart Palletizer', 'Palletizer', 500, 'cycles/h', 500, 'A Cartesian palletizer for bags, boxes or bundles: it picks the bags from the belt and stacks them on the pallet layer by layer.', [['Speed in the line', 'Up to 500 cycles/h'], ['Speed, MF PCA Smart Pro page', 'Up to 800 cycles/h'], ['Max load', 'Up to 50 kg'], ['Pallets', '800 x 1200, 1000 x 1200 mm'], ['Max height', '1800 mm incl. pallet'], ['Axes', '4, brushless; PLC and touch screen']]],
  ['MF Wrap 35', 'Stretch wrapper', 35, 'pallets/h', 35, 'Automatic stretch wrapper: the pallet turns while a film carriage rises and descends the mast (the website says both "rotating table" and "rotating arm"; the model shows the turntable).', [['Speed', 'Up to 35 pallets/h'], ['Capacity', '2000 kg'], ['Film', 'Motorised pre-stretch, automatic cut and weld'], ['Control', 'Inverter, PLC and touch screen, CE'], ['Options', 'Top sheet, top press, 90\u00b0 discharge, roller or chain platform']]],
]
const spc = document.createElement('div'); spc.className = 'spc'
spc.innerHTML = `<div class="spc-card"><button class="spc-x" aria-label="Close">×</button>
  <h2>MF Trio Line <i>at a glance</i></h2><div class="sub">MF TECNO · a Massini Industries brand · three machines, one single supply</div>
  <div class="spc-lines">${MODULES.map(([n, d, q, u, mx, txt, rows], i) => `<div class="spc-line"><h3>${i + 1} · ${n}</h3><p>${d}. ${txt}</p>
    <div class="spc-tile"><small>Up to</small><div class="q">${q}<i>${u}</i></div><div class="bar"><span style="width:100%"></span></div></div>
    <div class="spc-rows">${rows.map(([k, v]) => `<div><span>${k}</span><b style="font-weight:500">${v}</b></div>`).join('')}</div></div>`).join('')}</div>
  <div class="spc-common"><b>3 machines, 1 single supply</b><b>Single point of contact from design to startup</b><b>Ready to ship: production in weeks, not months</b><b>Tested integration: mechanics, electrics and software</b><b>Available for immediate delivery</b></div>
  <div class="spc-foot">Data from the MF TECNO flyer, film and the product pages of mftecno.com. The Trio Line quotes 500 cycles/h for the palletizer; its own product page (MF PCA Smart Pro) says up to 800. Via del Lavoro 9, 06083 Bastia Umbra (PG), Italy · www.mftecno.com · info@mftecno.com · +39 075 8043623 · USA: MF TECNO USA, Hughson CA, 209-410-3637. Bags per cycle and layer, belt and turntable speeds are assumptions of this simulator.</div></div>`
lab.ui.appendChild(spc)
spc.querySelector('.spc-x').addEventListener('click', () => lab.toggle('models', false))
spc.addEventListener('click', (e) => { if (e.target === spc) lab.toggle('models', false) })
const FAQ_LINE = [
  ['What is the MF Trio Line?', 'A packaging line ready to go: a vertical packaging machine (MF 54), a palletizer (MF Smart Palletizer) and a pallet wrapper (MF Wrap 35), in this sequence, in one integrated solution.'],
  ['Why one supply for three machines?', 'There is a single point of contact from design to startup, and the three machines come as a tested integration: proven mechanics, electrics and software, with zero surprises on the shop floor.'],
  ['How fast can it be delivered?', 'The line is available for immediate delivery. Compared with a custom solution the timelines are shorter: production starts in weeks, not months.'],
  ['What speeds are quoted?', 'Up to 20 bags per minute (1200 per hour) for the MF 54, up to 500 cycles per hour for the palletizer in the line and up to 35 pallets per hour for the wrapper. The palletizer product page (MF PCA Smart Pro) quotes up to 800 cycles per hour on its own.'],
  ['Which bags and pallets can it handle?', 'The MF 54 makes pillow and gusseted PE bags of 5 to 20 kg, from 230 x 300 to 470 x 680 mm. The palletizer works on 800 x 1200 and 1000 x 1200 pallets up to 1800 mm high including the pallet. The wrapper takes loads up to 2000 kg.'],
  ['Where do I get the details?', 'On mftecno.com, or from MF TECNO in Bastia Umbra: info@mftecno.com, +39 075 8043623.'],
]
const FAQ_SIM = [
  ['How do I change the output?', 'With the MF 54 speed slider (or the [ and ] keys). The palletizer and the wrapper follow: every bag is picked and stacked, and every full pallet is wrapped.'],
  ['Why does the simulation run faster than real time?', 'One pallet takes about two minutes to build at full speed. The chips under the slider speed the animation up (1× to 12×); every figure on screen stays a real-time value.'],
  ['What does Film runs out show?', 'The wrapper stops mid-pallet. The next full pallet waits, the palletizer has nowhere to stack, the belt fills up and the MF 54 holds its bag. Press the button again to change the film roll and let the line empty out.'],
  ['Why does the line stop at 8.3 bags per minute?', 'The palletizer takes one bag per cycle and the line quotes up to 500 cycles per hour, which is 8.3 bags per minute. The MF 54 can bag faster (up to 20 bags per minute), but the bags would only queue on the belt. The model uses the 500 cycles/h of the line; the palletizer product page (MF PCA Smart Pro) quotes up to 800.'],
  ['What comes from MF TECNO and what is assumed?', 'The three machines, their sequence and the three speeds come from the MF TECNO flyer, film and website, as do the 5 to 20 kg bag range and the pallet limits. The exact bag size, one bag per palletizer cycle (as in the flyer photo), six per layer, the belt speed and the turntable speed are assumptions. Open How it is computed for the model.'],
]
const faq = document.createElement('div'); faq.className = 'faq'
const faqCol = (title, sub, items, open) => `<div class="faq-col"><h3>${title}<small>${sub}</small></h3>${items.map(([q, a], i) => `<details${open && i === 0 ? ' open' : ''}><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>`
faq.innerHTML = `<div class="faq-card"><button class="faq-x" aria-label="Close">×</button><h2>Frequently asked <i>questions</i></h2><div class="sub">MF Trio Line · MF TECNO</div>
  <div class="faq-cols">${faqCol('About the line', 'Condensed from the MF TECNO flyer and film', FAQ_LINE, true)}${faqCol('About this simulator', 'How to read and use what you see', FAQ_SIM, false)}</div>
  <div class="faq-foot">Source: MF TECNO, MF Trio Line flyer, presentation film and the product pages of mftecno.com.</div></div>`
lab.ui.appendChild(faq)
faq.querySelector('.faq-x').addEventListener('click', () => lab.toggle('faq', false))
faq.addEventListener('click', (e) => { if (e.target === faq) lab.toggle('faq', false) })
lab.target.models = 0; lab.target.faq = 0

// ------------------------------------------------------------------ camera shortcuts: the whole line, or one machine
const VIEWS = {
  line: { az: 14, el: 10, dist: 1.98, target: [4.75, 2.45, 0] },
  bagger: { az: 24, el: 8, dist: 0.95, target: [1.5, 1.7, 0] },
  palletizer: { az: 14, el: 10, dist: 1.0, target: [4.5, 1.3, 0] },
  wrapper: { az: 24, el: 10, dist: 0.9, target: [8.2, 1.1, 0] },
}
const camView = () => {
  const t = lab.controlsOrbit.target.clone().divideScalar(lab.k), o = lab.camera.position.clone().sub(lab.controlsOrbit.target), d = o.length()
  return { az: THREE.MathUtils.radToDeg(Math.atan2(o.x, o.z)), el: THREE.MathUtils.radToDeg(Math.asin(o.y / d)), dist: d / 2.4, target: [t.x, t.y, t.z] }
}
const cam = { from: null, to: null, k0: 0, on: false }
const goView = (k) => { cam.from = camView(); cam.to = PH ? { ...VIEWS[k], dist: VIEWS[k].dist * (k === 'line' ? 2.3 : 2.2) } : VIEWS[k]; cam.k0 = performance.now(); cam.on = true }
lab.onTick(() => {
  { const w = lab.target.models > 0.5; if (w !== spc.classList.contains('on')) { spc.classList.toggle('on', w); if (w) lab.toggle('faq', false) } }
  { const w = lab.target.faq > 0.5; if (w !== faq.classList.contains('on')) { faq.classList.toggle('on', w); if (w) lab.toggle('models', false) } }
  if (lab.filmMode || !cam.on) return
  const p = clamp((performance.now() - cam.k0) / 1100), e = easeIO(p), A = cam.from, B = cam.to
  lab.setView({ az: lerp(A.az, B.az, e), el: lerp(A.el, B.el, e), dist: lerp(A.dist, B.dist, e), target: A.target.map((x, i) => lerp(x, B.target[i], e)), fov: 30 })
  if (p >= 1) cam.on = false
})
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return
  const k = e.key.toLowerCase()
  if (k === 'd') lab.toggle('models')
  if (k === 'f') lab.toggle('faq')
  if (e.key === 'Escape') { lab.toggle('models', false); lab.toggle('faq', false) }
  const v = { 1: 'line', 2: 'bagger', 3: 'palletizer', 4: 'wrapper' }[e.key]
  if (v) goView(v)
})

window.__trio = { sim, stepSim, resetLine }                               // handle for the screenshot scripts
lab.start()
{
  const m = lab.$('.lab-modes'), brk = m.querySelector('.brk')
  const html = '<button data-v="bagger">MF 54<kbd>2</kbd></button><button data-v="palletizer">Palletizer<kbd>3</kbd></button><button data-v="wrapper">Wrap 35<kbd>4</kbd></button><button data-v="line">Whole line<kbd>1</kbd></button>'
  brk ? brk.insertAdjacentHTML('beforebegin', html) : m.insertAdjacentHTML('beforeend', html)
  m.addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (b) { e.stopImmediatePropagation(); goView(b.dataset.v) } }, true)
}
