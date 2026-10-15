const { THREE, Lab, MAT, GEO, clamp, lerp, approach, fmt, smoothstep } = window.LabKit
const PI = Math.PI

/* ------------------------------------------------------------------ research
 MIAL "Tubular chain conveyor", CLEAN200 version (brochure Tubular-chain-conveyor-EN.pdf, mialtecno.com):
 a closed AISI 304 stainless tube loop, plastic discs evenly spaced and bolted to a steel chain, one gearmotor
 on the chain drive (400 V, 50 Hz, inverter, up to 7.5 kW), a loading hopper with a flow control device and an
 unloading hopper with a slide gate valve. CLEAN200: drive unit / tube 204 mm, up to 60 m3/h.
 Brochure claims: energy savings over 50 % against pneumatic or screw conveying, pet food breakage under 0.2 %.

 Layout of the model: product goes in at the bottom, rises in the vertical tube, goes over the top bend and is
 released through the bottom hole of the top run into a receiving silo. The empty chain comes back down the left
 leg (drive sprocket top left, take-up wheel bottom left).

 Real dimensions used (m):  tube 204 x 4 mm (ID 196) · chain pitch 62.5 mm · plastic disc 179 mm every third link
 (187.5 mm) · loop 16.7 m, product lift 4.45 m · big bends R 0.8 m · sprocket 33 teeth, pitch radius 0.329 m.
 Assumed (not in the brochure): chain wire, motor 2.2 kW, gearbox 58:1, sight glasses, silo and hopper sizes.

 Physics (all computed in the solver below):
   Q = min(feed setting, A phi v)        loading capacity set at the flow control gate, bore area x fill x speed
   v = (120 f / p)(1 - slip) / i x R     inverter frequency to chain speed (fixed at the nominal 50 Hz here)
   dT/ds = m g (mu cos + sin) + mu T k   chain tension walked round the loop (friction, lift, capstan on bends)
   W = C rho sqrt(g) (D - k d)^2.5       Beverloo discharge of the loading hopper outlet
   P = F v / (eta_g eta_m)               drive power, F = T_tight - T_slack
 Hero: throughput m3/h.  Input: loading capacity (the flow control gate).
 Break: a steel bolt in the product wedges between a disc and the first bend. The inverter limits torque to 150 %,
 the wedge needs more than the drive can pull, the chain stalls and the overload timer trips.
*/

// ------------------------------------------------------------------ constants
const TUBE_RO = 0.102, TUBE_T = 0.004, TUBE_RI = TUBE_RO - TUBE_T      // 204 x 4 mm
const A_I = PI * TUBE_RI * TUBE_RI                                    // bore area, m2
const PITCH_TARGET = 0.0625, TEETH = 33
const RS = PITCH_TARGET / (2 * Math.sin(PI / TEETH))                  // sprocket pitch radius, 0.329 m
const RB = 0.8
const XL = 0, XR = 4.4, YB = 0.95, YT = 5.4                           // left tube x, right riser x, bottom run y, top run y
const XD = XL + RS, YD = YT - RS, YWHEEL = YB + RS                    // sprocket centre x, drive sprocket y, wheel y
const G = 9.81

const lab = new Lab({
  prompt: 'a tubular chain conveyor lifting pet food from a bottom hopper to a top silo',
  no: 7, title: 'CLEAN200', sub: '60 m³/h',
  size: 6.4,
  view: { az: 24, el: 8, dist: 2.3, target: [1.9, 2.75, 0], fov: 30, frameX: -0.13 },
  cut: { a: [0, 0, 1], b: [0, 0, 1], center: [0, 0, 0], reach: 0.5 },
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
  .mial-head img { height:clamp(26px,3.7vh,52px); mix-blend-mode:multiply; display:block }
  .mial-head .sep { width:1px; height:clamp(24px,3.4vh,46px); background:rgba(40,36,30,0.28) }
  .mial-head b { display:block; font:500 clamp(15px,1.45vw,26px)/1.1 'Inter',sans-serif; letter-spacing:-0.01em; color:#1d1b18 }
  .mial-head small { display:block; margin-top:0.25em; font:400 clamp(10px,0.82vw,14px)/1.2 'JetBrains Mono',monospace; letter-spacing:0.02em; color:#7b766c }
  .mial-spec { position:absolute; left:4.2vw; top:24vh; pointer-events:none }
  .mial-spec b { display:block; font:600 clamp(18px,1.75vw,32px)/1.1 'Inter',sans-serif; letter-spacing:-0.01em; color:#d96a2b; margin-bottom:0.45em }
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
    .lab-lab small { margin-top:0.15em; font:600 1.18em 'JetBrains Mono',monospace; color:#c4511a; letter-spacing:-0.01em }
  .kpis { display:grid; grid-template-columns:repeat(3,1fr); gap:0.55em 0.7em; margin-top:clamp(12px,2vh,26px); padding-top:clamp(10px,1.6vh,20px); border-top:1px solid rgba(40,36,30,0.14) }
  .kpis div { min-width:0 }
  .kpis small { display:block; font:500 clamp(9px,0.7vw,12px)/1.2 'Inter',sans-serif; letter-spacing:0.08em; text-transform:uppercase; color:#8a857a }
  .kpis b { display:block; margin-top:0.2em; font:600 clamp(15px,1.4vw,27px)/1.1 'JetBrains Mono',monospace; letter-spacing:-0.02em; color:#1d1b18; white-space:nowrap }
  .kpis b i { font:500 0.55em 'Inter',sans-serif; color:#8a857a; margin-left:0.25em; letter-spacing:0 }
  .kpis.bad b { color:#c4511a }
  .gal { position:absolute; inset:0 0 8.5vh 0; display:none; align-items:center; justify-content:center; z-index:60; background:rgba(238,234,225,0.985); backdrop-filter:blur(10px); pointer-events:auto }
  .gal.on { display:flex }
  .gal-card { position:relative; display:grid; grid-template-columns:1.75fr 1fr; gap:2.4vw; width:min(88vw,1560px); align-items:center }
  .gal-main img { width:100%; max-height:70vh; object-fit:contain; display:block; border-radius:12px; box-shadow:0 18px 60px rgba(0,0,0,0.16); background:#fff }
  .gal-side small { display:block; font:500 clamp(10px,0.8vw,13px)/1.2 'JetBrains Mono',monospace; letter-spacing:0.06em; text-transform:uppercase; color:#c4511a }
  .gal-side h3 { margin:0.45em 0 0.5em; font:400 clamp(26px,2.9vw,52px)/1.05 'Instrument Serif',serif; letter-spacing:-0.01em; color:#1d1b18 }
  .gal-side p { margin:0 0 1.4em; font:400 clamp(12px,0.98vw,17px)/1.55 'Inter',sans-serif; color:#4d4a43 }
  .gal-th { display:grid; grid-template-columns:repeat(4,1fr); gap:0.6em }
  .gal-th button { padding:0; border:2px solid transparent; border-radius:8px; overflow:hidden; background:#fff; cursor:pointer; opacity:0.6; aspect-ratio:4/3 }
  .gal-th button.on { border-color:#d96a2b; opacity:1 }
  .gal-th img { width:100%; height:100%; object-fit:cover; display:block }
  .gal-side em { display:block; margin-top:1.2em; font:400 clamp(10px,0.76vw,12px)/1.4 'Inter',sans-serif; color:#8a857a; font-style:normal }
  .gal-x { position:absolute; right:-0.4vw; top:-4.2vh; width:2.4em; height:2.4em; border-radius:50%; border:1px solid rgba(40,36,30,0.25); background:#f9f6f0; font:400 20px/1 'Inter',sans-serif; cursor:pointer }
  @media (min-width:761px) { .lab-side { background:rgba(238,234,225,0.8); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); border-radius:16px; padding:1.1em 1.3em 1.2em; box-shadow:0 10px 30px rgba(0,0,0,0.08) } }
  @media (max-height:920px) { .gate-hint { display:none } .lab-big { font-size:clamp(48px,5.6vw,100px) !important } .lab-title { font-size:clamp(34px,3.6vw,64px) !important } .lab-metric { margin-top:1.6vh !important } .lab-ctl { margin-top:1.8vh !important } .kpis { margin-top:1.4vh; padding-top:1vh } }
  @media (max-height:760px) { .mial-spec p { display:none } .lab-title i { display:none } }
  .mial-all { margin-top:1.1em; padding:0.5em 0.95em; border-radius:999px; border:1px solid rgba(217,106,43,0.55); background:transparent; color:#c4511a; font:600 clamp(11px,0.82vw,14px) 'Inter',sans-serif; cursor:pointer; pointer-events:auto }
  .mial-all kbd { margin-left:0.6em; font:500 0.85em 'JetBrains Mono',monospace; color:#a8a398 }
  .spc { position:absolute; inset:0 0 8.5vh 0; display:none; align-items:center; justify-content:center; z-index:62; background:#eeeae1; pointer-events:auto }
  .spc.on { display:flex }
  .spc-card { position:relative; width:min(90vw,1600px); max-height:88vh; overflow:auto; padding:0 0.4vw }
  .spc-x { position:absolute; right:0; top:0; width:2.4em; height:2.4em; border-radius:50%; border:1px solid rgba(40,36,30,0.25); background:#f9f6f0; font:400 20px/1 'Inter',sans-serif; cursor:pointer }
  .spc h2 { margin:0; font:400 clamp(30px,3.3vw,60px)/1.05 'Instrument Serif',serif; letter-spacing:-0.01em; color:#1d1b18 }
  .spc h2 i { color:#7a7873 }
  .spc .sub { margin:0.5em 0 1.6em; font:500 clamp(10px,0.8vw,13px)/1.3 'JetBrains Mono',monospace; letter-spacing:0.06em; text-transform:uppercase; color:#c4511a }
  .spc-lines { display:grid; grid-template-columns:1fr 1fr; gap:2.2vw }
  .spc-line { border-top:2px solid #1d1b18; padding-top:0.9em }
  .spc-line h3 { margin:0; font:600 clamp(18px,1.6vw,28px)/1.1 'Inter',sans-serif; letter-spacing:-0.01em; color:#1d1b18 }
  .spc-line p { margin:0.4em 0 1em; font:400 clamp(12px,0.9vw,15px)/1.5 'Inter',sans-serif; color:#5b574f }
  .spc-tiles { display:grid; grid-template-columns:repeat(3,1fr); gap:0.7em; margin-bottom:1.1em }
  .spc-tile { padding:0.8em 0.9em 0.9em; border-radius:10px; border:1px solid rgba(40,36,30,0.16); background:#f9f6f0 }
  .spc-tile.cur { border:2px solid #d96a2b; background:#fff7f0 }
  .spc-tile b { display:block; font:600 clamp(14px,1.2vw,21px)/1.1 'Inter',sans-serif; color:#1d1b18 }
  .spc-tile small { display:block; margin-top:0.35em; font:500 clamp(10px,0.74vw,12px)/1.3 'Inter',sans-serif; color:#8a857a }
  .spc-tile .q { margin-top:0.55em; font:600 clamp(20px,1.9vw,34px)/1 'JetBrains Mono',monospace; letter-spacing:-0.03em; color:#c4511a }
  .spc-tile .q i { font:500 0.45em 'Inter',sans-serif; color:#8a857a; margin-left:0.3em; letter-spacing:0 }
  .spc-tile .bar { height:4px; margin-top:0.6em; border-radius:2px; background:rgba(40,36,30,0.1) } .spc-tile .bar span { display:block; height:100%; border-radius:2px; background:#d96a2b }
  .spc-tile em { display:block; margin-top:0.55em; font:500 clamp(9px,0.68vw,11px)/1 'JetBrains Mono',monospace; color:#d96a2b; font-style:normal; letter-spacing:0.05em; text-transform:uppercase }
  .spc-rows div { display:grid; grid-template-columns:9.5em 1fr; gap:0.8em; padding:0.5em 0; border-bottom:1px solid rgba(40,36,30,0.1); font:400 clamp(11px,0.86vw,14px)/1.45 'Inter',sans-serif; color:#2e2b26 }
  .spc-rows div span { color:#8a857a }
  .spc-common { margin-top:1.6em; display:flex; flex-wrap:wrap; gap:0.5em 0.5em }
  .spc-common b { padding:0.4em 0.85em; border-radius:999px; background:#1d1b18; color:#f4f1ea; font:500 clamp(10px,0.8vw,13px) 'Inter',sans-serif }
  .spc-apps { margin-top:0.8em; display:flex; flex-wrap:wrap; gap:0.4em }
  .spc-apps span { padding:0.35em 0.8em; border-radius:999px; border:1px solid rgba(40,36,30,0.22); font:400 clamp(10px,0.8vw,13px) 'Inter',sans-serif; color:#4d4a43 }
  .spc-foot { margin-top:1.2em; font:400 clamp(10px,0.74vw,12px)/1.5 'Inter',sans-serif; color:#8a857a }
  .mial-btns { display:flex; flex-wrap:wrap; gap:0.5em; margin-top:1.1em }
  .mial-btns .mial-all { margin-top:0 }
  .faq { position:absolute; inset:0 0 8.5vh 0; display:none; align-items:center; justify-content:center; z-index:63; background:#eeeae1; pointer-events:auto }
  .faq.on { display:flex }
  .faq-card { position:relative; width:min(88vw,1500px); max-height:88vh; overflow:auto; padding:0 0.4vw }
  .faq-x { position:absolute; right:0; top:0; width:2.4em; height:2.4em; border-radius:50%; border:1px solid rgba(40,36,30,0.25); background:#f9f6f0; font:400 20px/1 'Inter',sans-serif; cursor:pointer }
  .faq h2 { margin:0; font:400 clamp(30px,3.3vw,60px)/1.05 'Instrument Serif',serif; letter-spacing:-0.01em; color:#1d1b18 } .faq h2 i { color:#7a7873 }
  .faq .sub { margin:0.5em 0 1.6em; font:500 clamp(10px,0.8vw,13px)/1.3 'JetBrains Mono',monospace; letter-spacing:0.06em; text-transform:uppercase; color:#c4511a }
  .faq-cols { display:grid; grid-template-columns:1fr 1fr; gap:2.4vw; align-items:start }
  .faq-col h3 { margin:0 0 0.5em; padding-top:0.8em; border-top:2px solid #1d1b18; font:600 clamp(15px,1.3vw,22px)/1.1 'Inter',sans-serif; color:#1d1b18 }
  .faq-col h3 small { display:block; margin-top:0.35em; font:400 clamp(10px,0.78vw,13px)/1.3 'Inter',sans-serif; color:#8a857a }
  .faq details { border-bottom:1px solid rgba(40,36,30,0.14) }
  .faq summary { cursor:pointer; list-style:none; padding:0.85em 1.6em 0.85em 0; position:relative; font:600 clamp(13px,1.02vw,18px)/1.35 'Inter',sans-serif; color:#1d1b18 }
  .faq summary::-webkit-details-marker { display:none }
  .faq summary::after { content:'+'; position:absolute; right:0.2em; top:0.7em; font:400 1.3em/1 'Inter',sans-serif; color:#c4511a }
  .faq details[open] summary::after { content:'\\2212' }
  .faq details p { margin:0 0 1em; padding-right:1.6em; font:400 clamp(12px,0.95vw,16px)/1.6 'Inter',sans-serif; color:#4d4a43 }
  .faq-foot { margin-top:1.4em; font:400 clamp(10px,0.74vw,12px)/1.5 'Inter',sans-serif; color:#8a857a }
  .gate-hint { margin-top:0.5em; font:400 clamp(10px,0.78vw,13px)/1.4 'Inter',sans-serif; color:#8a857a }
  .mat-sel .chips { display:flex; flex-wrap:wrap; gap:5px; margin-top:0.6em; pointer-events:auto }
  .mat-sel .grp { flex-basis:100%; margin-top:0.25em; font:500 clamp(9px,0.66vw,11px)/1 'Inter',sans-serif; letter-spacing:0.09em; text-transform:uppercase; color:#8a857a }
  .mat-sel button { display:inline-flex; align-items:center; gap:0.5em; padding:0.32em 0.7em; border-radius:999px; border:1px solid rgba(40,36,30,0.22); background:transparent; color:#4a463f; font:500 clamp(10px,0.74vw,13px) 'Inter',sans-serif; cursor:pointer }
  .mat-sel button i { width:0.7em; height:0.7em; border-radius:50%; background:var(--dot); box-shadow:inset 0 0 0 1px rgba(0,0,0,0.18) }
  .mat-sel button.on { background:#1d1b18; color:#f4f1ea; border-color:#1d1b18 }
  `
  document.head.appendChild(st)
  // phone layout: its own style element so it wins over the desktop rules above
  const mst = document.createElement('style')
  mst.textContent = `
@media (max-width:760px) {
    .sw { left:10px; top:62px; transform:none; font-size:11px }
    body.mob-open .sw { display:none }
    .mial-head { left:10px; right:10px; top:10px; gap:10px; padding:10px 12px; border-radius:14px; background:rgba(238,234,225,0.94) }
    .mial-head img { height:22px }
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
    .mat-sel .grp { display:none }
    .mat-sel button { flex:0 0 auto; font-size:11px }
    .lab-modes { left:10px; right:10px; bottom:12px; flex-wrap:nowrap; overflow-x:auto; scrollbar-width:none; gap:6px; font-size:12px }
    .lab-modes::-webkit-scrollbar { display:none }
    .lab-modes button { flex:0 0 auto; padding:0.45em 0.85em; background:rgba(249,246,240,0.96) }
    .lab-modes kbd { display:none }
    .gate-hint { display:none !important }
    .mial-spec, .lab-side { display:none }
    body.mob-open .mial-head { display:flex }
    body.mob-open .mial-spec, body.mob-open .lab-side { display:block }
    .mob-info { display:block; position:fixed; right:10px; bottom:12px; z-index:70; padding:0.45em 0.85em; border-radius:999px; border:1px solid rgba(40,36,30,0.3); background:#1d1b18; color:#f4f1ea; font:600 12px 'Inter',sans-serif; cursor:pointer }
    body.mob-open .mob-info { background:#f9f6f0; color:#1d1b18 }
    .lab-modes { right:86px !important }
    .spc-lines, .faq-cols, .gal-card { grid-template-columns:1fr !important }
    .spc-card, .faq-card { width:92vw }
    .spc-tiles { grid-template-columns:repeat(3,1fr); gap:6px }
    .spc-tile { padding:0.6em 0.6em 0.7em }
    .spc-tile .q { font-size:18px }
    .gal-card { width:92vw; gap:14px }
    .gal-main img { max-height:40vh }
  }
`
  document.head.appendChild(mst)
  const h = document.createElement('div'); h.className = 'mial-head'
  h.innerHTML = `<img alt="MIAL" src="data:image/png;base64,__MIAL_LOGO__"><span class="sep"></span><div><b>Tubular chain conveyor</b><small>CLEAN200 · Ø 204 mm · AISI 304</small></div>`
  lab.ui.appendChild(h)
  { const nv = document.createElement('nav'); nv.className = 'sw'; nv.setAttribute('aria-label', 'Simulators'); nv.innerHTML = '__NAV__'; lab.ui.appendChild(nv) }
  const sp = document.createElement('div'); sp.className = 'mial-spec'
  sp.innerHTML = '<b>CLEAN200</b><span>Drive unit ø 204</span><span>Max flow rate 60 m³/h</span><p>A closed stainless tube with a chain inside. <strong>Plastic discs, bolted at even spacing,</strong> gently drag the product from the hopper at the bottom up to the silo at the top. One gearmotor, up to 60 m³/h, over 50 % less energy than pneumatic or screw conveying, pet food breakage under 0.2 %.</p><div class="mial-btns"><button class="mial-all">All models and specs<kbd>D</kbd></button><button class="mial-all mial-faqb">FAQ<kbd>F</kbd></button></div>'
  lab.ui.appendChild(sp)
  sp.querySelector('.mial-all').addEventListener('click', () => lab.toggle('models'))
  sp.querySelector('.mial-faqb').addEventListener('click', () => lab.toggle('faq'))
  { const im = h.querySelector('img'); const src = im.src; const t = new Image(); t.onload = () => { const c = document.createElement('canvas'); c.width = t.width; c.height = t.height; const g = c.getContext('2d'); g.drawImage(t, 0, 0); const d = g.getImageData(0, 0, c.width, c.height); for (let i = 0; i < d.data.length; i += 4) { const m = Math.min(d.data[i], d.data[i + 1], d.data[i + 2]); const a = Math.max(0, Math.min(1, (250 - m) / 70)); d.data[i + 3] = Math.round(255 * a) } g.putImageData(d, 0, 0); im.src = c.toDataURL('image/png'); im.style.mixBlendMode = 'normal' }; t.src = src }
  lab.$('.lab-no').textContent = 'MIAL · CLEAN200'
  lab.$('.lab-title').innerHTML = 'Live<i>from the solver</i>'
}

// ------------------------------------------------------------------ the circuit (planar, in x y)
const segs = []
let px = XD, py = YB, ph = 0, S = 0
const line = (len) => { segs.push({ t: 'L', s0: S, len, x: px, y: py, h: ph }); px += len * Math.cos(ph); py += len * Math.sin(ph); S += len }
const arc = (R, dth) => {
  const sg = Math.sign(dth)
  const cx = px + sg * R * -Math.sin(ph), cy = py + sg * R * Math.cos(ph)
  const a0 = Math.atan2(py - cy, px - cx), len = R * Math.abs(dth)
  segs.push({ t: 'A', s0: S, len, R, cx, cy, a0, dth, sg, h: ph })
  ph += dth; px = cx + R * Math.cos(a0 + dth); py = cy + R * Math.sin(a0 + dth); S += len
}
line((XR - RB) - px)                 // 0 bottom run, loading
arc(RB, PI / 2)                      // 1 bend up
line((YT - RB) - py)                 // 2 vertical riser
arc(RB, PI / 2)                      // 3 bend over the top
line(px - XD)                        // 4 top run, unloading
arc(RS, PI / 2)                      // 5 wrap on the drive sprocket
line(py - YWHEEL)                    // 6 return leg, down
arc(RS, PI / 2)                      // 7 wrap on the take-up wheel
const L = S
const at = (s) => {
  s = ((s % L) + L) % L
  for (let i = 0; i < segs.length; i++) {
    const g = segs[i]
    if (s <= g.s0 + g.len || i === segs.length - 1) {
      const t = s - g.s0
      if (g.t === 'L') return [g.x + t * Math.cos(g.h), g.y + t * Math.sin(g.h), g.h]
      const a = g.a0 + g.sg * t / g.R
      return [g.cx + g.R * Math.cos(a), g.cy + g.R * Math.sin(a), g.h + g.sg * t / g.R]
    }
  }
}
const X_IN = 1.6, X_OUT = 3.0
const S_IN = segs[0].s0 + (X_IN - segs[0].x), S_OUT = segs[4].s0 + (segs[4].x - X_OUT)
const S_DRIVE = segs[5].s0, S_RET0 = segs[6].s0, S_WHEEL = segs[7].s0

// chain: round links, a plastic disc bolted on every third link
const NL = 3 * Math.round(L / (3 * PITCH_TARGET)), P_LINK = L / NL, ND = NL / 3, P_DISC = 3 * P_LINK

// ------------------------------------------------------------------ materials
const tubeM = MAT.stainless({ roughness: 0.26, rep: [1, 1] })
const steelM = MAT.stainless({ roughness: 0.34 })
const chainM = MAT.stainless({ roughness: 0.16, finish: null, color: [0.74, 0.74, 0.76] })
const discM = MAT.plastic({ color: [0.9, 0.9, 0.88], roughness: 0.34, clearcoat: 0.35, finish: 'smudge', cap: [0.92, 0.92, 0.9] })
const orange = MAT.paint({ color: [0.62, 0.13, 0.025], roughness: 0.38 })
const rubber = MAT.rubber()
const chrome = MAT.chrome({ roughness: 0.1 })
const glassM = MAT.glass({ thickness: 0.004 })

// ------------------------------------------------------------------ products: four materials from the brochure
const PRODUCTS = [
  // food
  { id: 'malt', grp: 'Food', name: 'Malt', rho: 540, mu: 0.32, d: 0.0065, cap: [0.55, 0.38, 0.16], dot: '#c99a4a', sc: [0.5, 0.5, 0.9] },
  { id: 'cereals', grp: 'Food', name: 'Cereals', rho: 770, mu: 0.30, d: 0.0055, cap: [0.62, 0.40, 0.10], dot: '#d19a2a', sc: [0.5, 0.5, 0.75] },
  { id: 'fruit', grp: 'Food', name: 'Dried fruit', rho: 650, mu: 0.50, d: 0.012, cap: [0.20, 0.08, 0.07], dot: '#5a2a30', sc: [0.95, 0.8, 0.9] },
  { id: 'rice', grp: 'Food', name: 'Rice', rho: 780, mu: 0.30, d: 0.006, cap: [0.72, 0.65, 0.48], dot: '#e8dfc6', sc: [0.5, 0.5, 1.0] },
  { id: 'coffee', grp: 'Food', name: 'Coffee', rho: 380, mu: 0.38, d: 0.009, cap: [0.1, 0.05, 0.025], dot: '#3a2012', sc: [0.9, 0.65, 1.0] },
  // non-food
  { id: 'pet', grp: 'Non-food', name: 'Pet food', rho: 470, mu: 0.35, d: 0.012, cap: [0.36, 0.17, 0.065], dot: '#8a4a22', sc: [1, 1, 1] },
  { id: 'feed', grp: 'Non-food', name: 'Feed', rho: 640, mu: 0.40, d: 0.004, cap: [0.40, 0.34, 0.18], dot: '#8c7a45', sc: [0.35, 0.35, 0.6] },
  { id: 'pellets', grp: 'Non-food', name: 'Pellets', rho: 650, mu: 0.35, d: 0.006, cap: [0.60, 0.42, 0.22], dot: '#c99a5b', sc: [0.4, 0.4, 1.5] },
  { id: 'granules', grp: 'Non-food', name: 'Plastic granules', rho: 560, mu: 0.22, d: 0.004, cap: [0.42, 0.58, 0.74], dot: '#8fb3d6', sc: [0.5, 0.5, 0.35] },
  { id: 'chem', grp: 'Non-food', name: 'Chemicals', rho: 850, mu: 0.45, d: 0.002, cap: [0.74, 0.77, 0.8], dot: '#d9dee3', sc: [0.28, 0.28, 0.28] },
]
let prod = PRODUCTS.find((p) => p.id === 'pet')
const texCache = {}
function drawProduct(id) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d')
  let s = 11 + id.length * 7; const R = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const ell = (x, y, rx, ry, a, fill, stroke) => { g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, PI * 2); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.2; g.stroke() } }
  if (id === 'pet') {
    g.fillStyle = '#2a170a'; g.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 1500; i++) { const x = R() * 512, y = R() * 512, r = 7 + R() * 7, v = 0.55 + R() * 0.55
      ell(x, y, r, r * (0.7 + R() * 0.3), R() * PI, `rgb(${Math.round(150 * v)},${Math.round(84 * v)},${Math.round(36 * v)})`)
      ell(x - r * 0.25, y - r * 0.25, r * 0.45, r * 0.3, 0, `rgba(255,220,170,${0.10 + R() * 0.12})`) }
  } else if (id === 'rice') {
    g.fillStyle = '#b9ab88'; g.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 2600; i++) { const x = R() * 512, y = R() * 512, v = 215 + R() * 36
      ell(x, y, 10 + R() * 6, 3.4 + R() * 1.6, R() * PI, `rgb(${v},${v - 8},${v - 30})`, 'rgba(110,92,55,0.38)') }
  } else if (id === 'coffee') {
    g.fillStyle = '#0d0603'; g.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 800; i++) { const x = R() * 512, y = R() * 512, a = R() * PI, rx = 12 + R() * 5, ry = 8 + R() * 3.5, v = 0.7 + R() * 0.6
      ell(x, y, rx, ry, a, `rgb(${Math.round(92 * v)},${Math.round(52 * v)},${Math.round(26 * v)})`, 'rgba(10,5,2,0.6)')
      g.save(); g.translate(x, y); g.rotate(a); g.strokeStyle = 'rgba(12,6,3,0.9)'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(-rx * 0.85, 0); g.bezierCurveTo(-rx * 0.3, -ry * 0.5, rx * 0.3, ry * 0.5, rx * 0.85, 0); g.stroke(); g.restore()
      ell(x - rx * 0.3, y - ry * 0.35, rx * 0.35, ry * 0.2, a, 'rgba(255,220,180,0.18)') }
  } else if (id === 'malt') {
    g.fillStyle = '#6e4e22'; g.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 2300; i++) { const x = R() * 512, y = R() * 512, a = R() * PI, rx = 11 + R() * 5, ry = 4.6 + R() * 1.8, v = 0.82 + R() * 0.3
      ell(x, y, rx, ry, a, `rgb(${Math.round(222 * v)},${Math.round(178 * v)},${Math.round(104 * v)})`, 'rgba(70,45,15,0.45)')
      g.save(); g.translate(x, y); g.rotate(a); g.strokeStyle = 'rgba(90,60,25,0.55)'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(-rx * 0.8, 0); g.lineTo(rx * 0.8, 0); g.stroke(); g.restore() }
  } else if (id === 'cereals') {
    g.fillStyle = '#6a4210'; g.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 2000; i++) { const x = R() * 512, y = R() * 512, a = R() * PI, rx = 8.5 + R() * 3.5, ry = 5.2 + R() * 1.6, v = 0.85 + R() * 0.3
      ell(x, y, rx, ry, a, `rgb(${Math.round(214 * v)},${Math.round(158 * v)},${Math.round(52 * v)})`, 'rgba(80,48,10,0.5)')
      g.save(); g.translate(x, y); g.rotate(a + 0.15); g.strokeStyle = 'rgba(100,60,12,0.6)'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(-rx * 0.7, ry * 0.15); g.quadraticCurveTo(0, -ry * 0.25, rx * 0.7, ry * 0.1); g.stroke(); g.restore()
      ell(x - rx * 0.25, y - ry * 0.3, rx * 0.35, ry * 0.2, a, 'rgba(255,235,170,0.22)') }
  } else if (id === 'fruit') {
    g.fillStyle = '#26100a'; g.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 520; i++) { const x = R() * 512, y = R() * 512, r = 11 + R() * 7, apricot = R() < 0.22, v = 0.75 + R() * 0.45
      ell(x, y, r, r * (0.75 + R() * 0.25), R() * PI, apricot ? `rgb(${Math.round(222 * v)},${Math.round(130 * v)},${Math.round(36 * v)})` : `rgb(${Math.round(92 * v)},${Math.round(42 * v)},${Math.round(52 * v)})`, 'rgba(20,8,6,0.55)')
      g.strokeStyle = apricot ? 'rgba(120,60,10,0.45)' : 'rgba(25,8,12,0.55)'; g.lineWidth = 1.2
      for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x - r * 0.6 + R() * r * 0.3, y - r * 0.4 + k * r * 0.4); g.quadraticCurveTo(x, y - r * 0.2 + k * r * 0.35 + (R() - 0.5) * 4, x + r * 0.6, y - r * 0.4 + k * r * 0.4 + (R() - 0.5) * 3); g.stroke() }
      ell(x - r * 0.3, y - r * 0.35, r * 0.3, r * 0.18, 0, 'rgba(255,230,210,0.2)') }
  } else if (id === 'feed') {
    g.fillStyle = '#2f2a18'; g.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 2600; i++) { const x = R() * 512, y = R() * 512, a = R() * PI, L2 = 9 + R() * 6, W = 3.4 + R() * 1.1, v = 0.8 + R() * 0.35
      g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = `rgb(${Math.round(150 * v)},${Math.round(128 * v)},${Math.round(72 * v)})`; g.strokeStyle = 'rgba(40,32,12,0.55)'; g.lineWidth = 1
      g.beginPath(); g.roundRect(-L2, -W, L2 * 2, W * 2, W * 0.6); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,235,170,0.14)'; g.fillRect(-L2 * 0.8, -W * 0.7, L2 * 1.2, W * 0.5); g.restore() }
  } else if (id === 'pellets') {
    g.fillStyle = '#4a3318'; g.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 900; i++) { const x = R() * 512, y = R() * 512, a = R() * PI, L2 = 16 + R() * 10, W = 4.8 + R() * 1.0, v = 0.82 + R() * 0.3
      g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = `rgb(${Math.round(206 * v)},${Math.round(158 * v)},${Math.round(98 * v)})`; g.strokeStyle = 'rgba(70,44,18,0.6)'; g.lineWidth = 1.1
      g.beginPath(); g.roundRect(-L2, -W, L2 * 2, W * 2, 2); g.fill(); g.stroke()
      g.strokeStyle = 'rgba(110,72,32,0.4)'; g.lineWidth = 0.9; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-L2 * 0.9, -W * 0.6 + k * W * 0.4); g.lineTo(L2 * 0.9, -W * 0.6 + k * W * 0.4 + (R() - 0.5) * 1.5); g.stroke() } g.restore() }
  } else if (id === 'chem') {
    g.fillStyle = '#9ca3a9'; g.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 5200; i++) { const x = R() * 512, y = R() * 512, r = 2.4 + R() * 2.0, v = R()
      ell(x, y, r, r, 0, `rgb(${Math.round(226 + 26 * v)},${Math.round(232 + 20 * v)},${Math.round(238 + 14 * v)})`, 'rgba(70,80,90,0.3)')
      ell(x - r * 0.3, y - r * 0.3, r * 0.35, r * 0.3, 0, 'rgba(255,255,255,0.7)') }
  } else {
    g.fillStyle = '#4c6a88'; g.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 3000; i++) { const x = R() * 512, y = R() * 512, r = 3.6 + R() * 2.6, v = R()
      ell(x, y, r, r * (0.75 + R() * 0.25), R() * PI, `rgb(${Math.round(150 + 50 * v)},${Math.round(188 + 40 * v)},${Math.round(222 + 28 * v)})`, 'rgba(40,70,100,0.35)')
      ell(x - r * 0.3, y - r * 0.3, r * 0.35, r * 0.25, 0, 'rgba(255,255,255,0.55)') }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
  return t
}
const texFor = (id, rx, ry) => {
  const k = `${id}_${rx}_${ry}`
  if (!texCache[k]) { texCache.base ??= {}; const b = (texCache.base[id] ??= drawProduct(id)); const t = b.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); texCache[k] = t }
  return texCache[k]
}
const prodMats = []
const kibble = (rx = 2, ry = 2) => {
  const t = texFor(prod.id, rx, ry)
  const m = MAT.satin({ color: [1, 1, 1], map: t, bumpMap: t, bumpScale: 3.2, roughness: 0.78, finish: null, cap: prod.cap })
  prodMats.push({ m, rx, ry }); return m
}
function setProduct(id) {
  prod = PRODUCTS.find((p) => p.id === id) ?? PRODUCTS[0]
  for (const { m, rx, ry } of prodMats) { const t = texFor(prod.id, rx, ry); m.map = t; m.bumpMap = t; m.userData.capColor?.setRGB(...prod.cap); m.needsUpdate = true }
  document.querySelectorAll('.mat-sel button').forEach((b) => b.classList.toggle('on', b.dataset.id === prod.id))
  const lab2 = document.querySelector('.mat-sel .row b'); if (lab2) lab2.textContent = `${prod.rho} kg/m³`
}

// ------------------------------------------------------------------ geometry helpers
const place = (g, x, y, z = 0, rz = 0) => { if (rz) g.rotateZ(rz); g.translate(x, y, z); return g }
const box = (w, h, d, x, y, z = 0, r) => place(GEO.rbox(w, h, d, r ?? Math.min(w, h, d) * 0.12), x, y, z)
const ringAlong = (s, ri, ro, w) => { const [x, y, h] = at(s); return place(GEO.lathe([[ri, -w / 2], [ro, -w / 2], [ro, w / 2], [ri, w / 2]], 40), x, y, 0, h - PI / 2) }
const tubePiece = (s0, s1) => { const [x, y, h] = at(s0); return place(GEO.tube(TUBE_RO, TUBE_RI, s1 - s0, 40, 0), x, y, 0, h - PI / 2) }
const slotPiece = (s0, s1, top) => {
  const [x, y, h] = at(s0), gap = 2.6, th = h - PI / 2
  const topPhi = Math.sin(th) > 0 ? 0.5 * PI : 1.5 * PI
  const c = top ? topPhi : topPhi + PI
  return place(GEO.lathe([[TUBE_RI, 0], [TUBE_RO, 0], [TUBE_RO, s1 - s0], [TUBE_RI, s1 - s0]], 48, { phi0: c + gap / 2, phiLen: 2 * PI - gap }), x, y, 0, th)
}
const bendPiece = (g) => {
  const prof = [], N = 26, e = 0.003
  for (let i = 0; i <= N; i++) { const a = e + (2 * PI - 2 * e) * i / N; prof.push([g.R + TUBE_RO * Math.cos(a), TUBE_RO * Math.sin(a)]) }
  for (let i = N; i >= 0; i--) { const a = e + (2 * PI - 2 * e) * i / N; prof.push([g.R + TUBE_RI * Math.cos(a), TUBE_RI * Math.sin(a)]) }
  const amin = g.dth > 0 ? g.a0 : g.a0 + g.dth
  const geo = GEO.lathe(prof, 26, { phi0: amin + PI / 2, phiLen: Math.abs(g.dth) })
  geo.rotateX(PI / 2); geo.translate(g.cx, g.cy, 0); return geo
}
const flat = (g) => { g = g.toNonIndexed(); g.computeVertexNormals(); return g }

// the two stations are boxes: x range, y range, tubes enter through gaps
const HD = { x0: -0.4, x1: 0.85, y0: 4.65, y1: 5.62 }                 // drive station, top left
const HT = { x0: -0.4, x1: 0.85, y0: 0.6, y1: 1.62 }                  // take-up station, bottom left
const zones = [
  [S_IN - 0.14, S_IN + 0.14, 'slot-top'],
  [segs[2].s0 + 0.6, segs[2].s0 + 0.9, 'glass'],
  [segs[2].s0 + 1.65, segs[2].s0 + 1.95, 'glass'],
  [S_OUT - 0.14, S_OUT + 0.14, 'slot-bottom'],
]
const straight = (i, a, b) => {
  const g = segs[i], out = { tube: [], glass: [] }
  let cur = g.s0 + a
  const end = g.s0 + b
  const zs = zones.filter(([z0, z1]) => z1 > cur && z0 < end).sort((p, q) => p[0] - q[0])
  for (const [z0, z1, kind] of zs) {
    if (z0 > cur) out.tube.push(tubePiece(cur, z0))
    if (kind === 'glass') out.glass.push(tubePiece(z0, z1)); else out.tube.push(slotPiece(z0, z1, kind === 'slot-top'))
    cur = z1
  }
  if (end > cur) out.tube.push(tubePiece(cur, end))
  return out
}
const conv = { tube: [], glass: [] }, ret = { tube: [], glass: [] }
const add = (acc, r) => { acc.tube.push(...r.tube); acc.glass.push(...r.glass) }
add(conv, straight(0, (HT.x1 - 0.05) - segs[0].x, segs[0].len))
conv.tube.push(bendPiece(segs[1]))
add(conv, straight(2, 0, segs[2].len))
conv.tube.push(bendPiece(segs[3]))
add(conv, straight(4, 0, segs[4].x - (HD.x1 - 0.05)))
add(ret, straight(6, segs[6].y - (HD.y0 + 0.05), segs[6].y - (HT.y1 - 0.05)))

const collarS = []
for (const [z0, z1] of zones) collarS.push(z0, z1)
for (const i of [0, 2, 4, 6]) {
  for (let t = 1.1; t < segs[i].len - 0.5; t += 1.3) {
    const s = segs[i].s0 + t
    if (zones.every(([z0, z1]) => s < z0 - 0.3 || s > z1 + 0.3)) collarS.push(s)
  }
}
const collars = collarS.map((s) => ringAlong(s, TUBE_RO - 0.002, TUBE_RO + 0.014, 0.04))
const lugs = collarS.map((s) => {
  const [x, y, h] = at(s); const g = GEO.rbox(0.036, 0.03, 0.03, 0.007); g.translate(-(TUBE_RO + 0.022), 0, 0); g.rotateZ(h - PI / 2); g.translate(x, y, 0); return g
})
lab.mesh(GEO.merge(conv.tube), tubeM, { name: 'Conveying tube', explode: [0, 0, -1.0], xray: 'shell' })
lab.mesh(GEO.merge(ret.tube), tubeM, { name: 'Return tube', explode: [0, 0, -1.9], xray: 'shell' })
lab.mesh(GEO.merge(conv.glass), glassM, { name: 'Sight glasses', explode: [0, 0, 0.8], count: 2 })
lab.mesh(GEO.merge([...collars, ...lugs]), steelM, { name: 'Tube clamps', explode: [0, 0, -0.55], count: collars.length * 2 })

// ------------------------------------------------------------------ chain, discs, product (instanced, moved by the solver)
const linkCurve = (() => {
  const hs = 0.0175, rc = 0.0181, pts = []
  for (let i = 0; i <= 12; i++) { const a = PI * i / 12; pts.push(new THREE.Vector3(rc * Math.cos(a), hs + rc * Math.sin(a), 0)) }
  for (let i = 0; i <= 12; i++) { const a = PI + PI * i / 12; pts.push(new THREE.Vector3(rc * Math.cos(a), -hs + rc * Math.sin(a), 0)) }
  pts.splice(13, 1); pts.pop()
  return new THREE.CatmullRomCurve3(pts, true, 'centripetal')
})()
const linkGeo = new THREE.TubeGeometry(linkCurve, 22, 0.0044, 5, true)
const discGeo = GEO.lathe([[0.015, 0], [0.05, 0], [0.0825, 0.015], [0.0894, 0.025], [0.0894, 0.0363], [0.0844, 0.0363], [0.0775, 0.0256], [0.05, 0.0144], [0.015, 0.0144]], 56)
const hubGeo = GEO.lathe([[0, -0.015], [0.0206, -0.015], [0.0206, 0.0425], [0, 0.0425]], 24)
// the product rides on top of the disc (the disc pushes it): a thin filler in the dish, and a column on the rim whose
// length follows the fill factor, so the quantity you see is proportional to the flow
const RIM_Y = 0.0378, PLUG_BASE = 0.0159
const L_FULL = 3 * (L / (3 * Math.round(L / (3 * PITCH_TARGET)))) - 0.012 - RIM_Y            // column length at the full fill factor
const fillerGeo = GEO.lathe([[0, PLUG_BASE], [0.05, PLUG_BASE], [0.0775, 0.0271], [0.0844, RIM_Y], [0, RIM_Y]], 36)
const bodyGeo = GEO.lathe([[0, 0], [0.0844, 0], [0.0844, 1], [0, 1]], 36)
const inst = (geo, mat, n, name, o = {}) => {
  const m = new THREE.InstancedMesh(geo, mat, n); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false
  return lab.add(m, { name, count: n, ...o })
}
const chainI = inst(linkGeo, chainM, NL, 'Chain links', { explode: [0, 0, 0.55] })
const discI = inst(discGeo, discM, ND, 'Plastic discs', { explode: [0, 0, 0.55] })
const hubI = inst(hubGeo, chainM, ND, 'Disc bolts', { explode: [0, 0, 0.55] })
const plugI = inst(bodyGeo, kibble(3, 1.2), ND, 'Product', { explode: [0, 0, 0.55] })
const fillI = inst(fillerGeo, kibble(3, 1.2), ND, 'Product in the dishes', { explode: [0, 0, 0.55], count: 0 })
const dummy = new THREE.Object3D()
const put = (s, roll, off, sx = 1, sy = 1) => {
  const [x, y, h] = at(s)
  dummy.position.set(x + off * Math.cos(h), y + off * Math.sin(h), 0)
  dummy.rotation.set(0, roll, h - PI / 2, 'ZYX'); dummy.scale.set(sx, sy, sx); dummy.updateMatrix()
}
const m_link = GEO.volume(linkGeo).V * 7900, m_disc = GEO.volume(discGeo).V * 950 + GEO.volume(hubGeo).V * 7900
const MC = (NL * m_link + ND * m_disc) / L                             // kg per metre of chain with discs

// ------------------------------------------------------------------ sprockets and stations
const spGeo = GEO.gear({ teeth: TEETH, module: 2 * RS / TEETH, width: 0.04, bore: 0.04, spokes: 6, rim: 0.06 })
const spDrive = lab.mesh(spGeo, steelM, { name: 'Drive sprocket', pos: [XD, YD, 0], explode: [0, 0, 0.5] })
const spWheel = lab.mesh(spGeo.clone(), steelM, { name: 'Take-up wheel', pos: [XD, YWHEEL, 0], explode: [0, 0, 0.5] })
const axle = (x, y, z0, z1, r) => place(GEO.lathe([[0, 0], [r, 0], [r, z1 - z0], [0, z1 - z0]], 32).rotateX(PI / 2), x, y, z0)
lab.mesh(GEO.merge([axle(XD, YD, -0.15, 0.36, 0.026), place(GEO.lathe([[0, -0.025], [0.06, -0.025], [0.06, 0.025], [0, 0.025]], 32).rotateX(PI / 2), XD, YD, 0)]), chrome, { name: 'Drive shaft', explode: [0, 0, 0.9] })

const WT = 0.022, DEPTH = 0.26, GAP = TUBE_RO + 0.016
const wallsV = (x, y0, y1, gaps) => {
  const out = []; let cur = y0
  for (const [c, hf] of [...gaps].sort((a, b) => a[0] - b[0])) { if (c - hf > cur + 0.005) out.push(box(WT, c - hf - cur, DEPTH, x, (cur + c - hf) / 2, 0, 0.004)); cur = c + hf }
  if (y1 > cur + 0.005) out.push(box(WT, y1 - cur, DEPTH, x, (cur + y1) / 2, 0, 0.004))
  return out
}
const wallsH = (y, x0, x1, gaps) => {
  const out = []; let cur = x0
  for (const [c, hf] of [...gaps].sort((a, b) => a[0] - b[0])) { if (c - hf > cur + 0.005) out.push(box(c - hf - cur, WT, DEPTH, (cur + c - hf) / 2, y, 0, 0.004)); cur = c + hf }
  if (x1 > cur + 0.005) out.push(box(x1 - cur, WT, DEPTH, (cur + x1) / 2, y, 0, 0.004))
  return out
}
const collar = (x, y, rz) => place(GEO.lathe([[TUBE_RO - 0.002, -0.017], [TUBE_RO + 0.02, -0.017], [TUBE_RO + 0.02, 0.017], [TUBE_RO - 0.002, 0.017]], 40), x, y, 0, rz)
const dw = HD.x1 - HD.x0 + 0.044, dh = HD.y1 - HD.y0 + 0.044, dcx = (HD.x0 + HD.x1) / 2, dcy = (HD.y0 + HD.y1) / 2
const tw = HT.x1 - HT.x0 + 0.044, th = HT.y1 - HT.y0 + 0.044, tcx = (HT.x0 + HT.x1) / 2, tcy = (HT.y0 + HT.y1) / 2
const driveBody = [
  ...wallsV(HD.x0, HD.y0, HD.y1, []), ...wallsV(HD.x1, HD.y0, HD.y1, [[YT, GAP]]),
  ...wallsH(HD.y1, HD.x0, HD.x1, []), ...wallsH(HD.y0, HD.x0, HD.x1, [[XL, GAP]]),
  box(dw, dh, 0.022, dcx, dcy, -0.14, 0.006),
  collar(HD.x1 + 0.022, YT, -PI / 2), collar(XL, HD.y0 - 0.022, 0),
]
const tensionBody = [
  ...wallsV(HT.x0, HT.y0, HT.y1, []), ...wallsV(HT.x1, HT.y0, HT.y1, [[YB, GAP]]),
  ...wallsH(HT.y0, HT.x0, HT.x1, []), ...wallsH(HT.y1, HT.x0, HT.x1, [[XL, GAP]]),
  box(tw, th, 0.022, tcx, tcy, -0.14, 0.006),
  collar(HT.x1 + 0.022, YB, -PI / 2), collar(XL, HT.y1 + 0.022, 0),
]
lab.mesh(GEO.merge(driveBody), steelM, { name: 'Drive station', explode: [0, 0, -0.45], xray: 'shell' })
lab.mesh(GEO.merge(tensionBody), steelM, { name: 'Take-up station', explode: [0, 0, -0.45], xray: 'shell' })
const boltRow = (cx, cy, w, h, z, inset) => {
  const one = new THREE.CylinderGeometry(0.01, 0.01, 0.009, 6).rotateX(PI / 2), out = []
  const px0 = cx - w / 2 + inset, px1 = cx + w / 2 - inset, py0 = cy - h / 2 + inset, py1 = cy + h / 2 - inset
  const nx = Math.round((px1 - px0) / 0.11), ny = Math.round((py1 - py0) / 0.11)
  for (let i = 0; i <= nx; i++) for (const y of [py0, py1]) out.push(one.clone().translate(px0 + (px1 - px0) * i / nx, y, z))
  for (let j = 1; j < ny; j++) for (const x of [px0, px1]) out.push(one.clone().translate(x, py0 + (py1 - py0) * j / ny, z))
  return out
}
lab.mesh(GEO.merge([box(dw, dh, 0.022, dcx, dcy, 0.14, 0.006), ...boltRow(dcx, dcy, dw, dh, 0.155, 0.036)]), steelM, { name: 'Drive cover', explode: [0, 0, 1.15] })
lab.mesh(GEO.merge([box(tw, th, 0.022, tcx, tcy, 0.14, 0.006), ...boltRow(tcx, tcy, tw, th, 0.155, 0.036)]), steelM, { name: 'Take-up cover', explode: [0, 0, 1.15] })

const takeup = []
takeup.push(box(0.045, 0.2, 0.09, HT.x0 - 0.022, YWHEEL, 0.2, 0.007))
takeup.push(place(GEO.lathe([[0, 0], [0.013, 0], [0.013, 0.5], [0, 0.5]], 20).rotateZ(-PI / 2), HT.x0 - 0.022, YWHEEL, 0.2))
takeup.push(box(0.12, 0.14, 0.08, XD, YWHEEL, 0.2, 0.01))
takeup.push(place(new THREE.CylinderGeometry(0.024, 0.024, 0.024, 6).rotateZ(PI / 2), HT.x0 - 0.07, YWHEEL, 0.2))
takeup.push(place(GEO.lathe([[0, 0], [0.03, 0], [0.03, 0.06], [0, 0.06]], 24).rotateX(PI / 2), XD, YWHEEL, 0.14))
lab.mesh(GEO.merge(takeup), steelM, { name: 'Take-up screw', explode: [0, 0, 1.5] })
lab.mesh(GEO.merge([axle(XD, YWHEEL, -0.15, 0.2, 0.026)]), chrome, { name: 'Wheel axle', explode: [0, 0, 1.3] })

// ------------------------------------------------------------------ gearmotor, inverter cabinet
const GZ = 0.34
lab.mesh(GEO.merge([box(0.32, 0.32, 0.26, XD, YD, GZ, 0.035), box(0.27, 0.27, 0.04, XD, YD, 0.17, 0.007)]), orange, { name: 'Gearbox 58:1', explode: [0, 0, 1.55] })
const finProf = [[0, 0], [0.085, 0]]
for (let k = 0; k < 13; k++) { const y0 = 0.02 + k * 0.028; finProf.push([0.095, y0], [0.11, y0 + 0.004], [0.11, y0 + 0.018], [0.095, y0 + 0.022]) }
finProf.push([0.095, 0.4], [0.085, 0.405], [0, 0.405])
const motorX = XD + 0.16
lab.mesh(GEO.merge([
  place(GEO.lathe(finProf, 48), motorX, YD, GZ, -PI / 2),
  place(GEO.lathe([[0, 0.405], [0.102, 0.405], [0.105, 0.425], [0.105, 0.475], [0.084, 0.5], [0, 0.5]], 48), motorX, YD, GZ, -PI / 2),
  box(0.13, 0.085, 0.12, motorX + 0.2, YD + 0.145, GZ, 0.014),
]), orange, { name: 'Gearmotor 2.2 kW', explode: [0, 0, 1.55] })

const CAB = { x: -0.95, z: 0.3 }
lab.mesh(GEO.merge([box(0.56, 1.3, 0.3, CAB.x, 0.72, CAB.z, 0.022), box(0.52, 0.06, 0.26, CAB.x, 0.03, CAB.z, 0.01)]), steelM, { name: 'Inverter cabinet', explode: [0, 0, 1.3] })
const dispC = document.createElement('canvas'); dispC.width = 256; dispC.height = 128
const dispT = new THREE.CanvasTexture(dispC); dispT.colorSpace = THREE.SRGBColorSpace
const dispM = MAT.glow({ emissive: [1, 1, 1], emissiveMap: dispT, emissiveIntensity: 1.1, noCap: true })
lab.mesh(GEO.rbox(0.22, 0.11, 0.012, 0.003), dispM, { name: 'Inverter display', pos: [CAB.x, 1.1, CAB.z + 0.156], explode: [0, 0, 1.3] })
const ledG = MAT.glow({ emissive: [0.2, 1, 0.35], emissiveIntensity: 3, noCap: true }), ledR = MAT.glow({ emissive: [1, 0.12, 0.08], emissiveIntensity: 0.1, noCap: true })
lab.mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.009, 16).rotateX(PI / 2), ledG, { name: 'Run lamp', pos: [CAB.x - 0.07, 0.98, CAB.z + 0.154], explode: [0, 0, 1.3], count: 0 })
lab.mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.009, 16).rotateX(PI / 2), ledR, { name: 'Trip lamp', pos: [CAB.x + 0.07, 0.98, CAB.z + 0.154], explode: [0, 0, 1.3], count: 0 })
lab.mesh(GEO.merge([place(GEO.lathe([[0, 0], [0.009, 0], [0.009, 0.2], [0, 0.2]], 12), CAB.x + 0.21, 0.6, CAB.z + 0.16), box(0.018, 0.22, 0.028, CAB.x + 0.21, 0.7, CAB.z + 0.17, 0.006)]), chrome, { name: 'Door handle', explode: [0, 0, 1.3], count: 0 })
lab.mesh(GEO.pipe([[CAB.x, 1.37, CAB.z], [CAB.x, 1.6, CAB.z + 0.04], [-0.52, 2.0, 0.36], [-0.52, 5.8, 0.36], [-0.1, 5.88, 0.36], [motorX + 0.2, 5.88, 0.36], [motorX + 0.2, YD + 0.2, GZ], [motorX + 0.2, YD + 0.19, GZ]], 0.014, { seg: 120, radial: 12 }), rubber, { name: 'Motor cable', explode: [0, 0, 1.5] })

// ------------------------------------------------------------------ loading hopper with the flow control gate
const HX = X_IN, HY = YB + TUBE_RO
const SPR = 0.0985                                                     // spout radius: 190 mm outlet
const hopperG = new THREE.Group()
const pyr = (profile, t) => { const g = GEO.shell(profile, t, 4); g.rotateY(PI / 4); return flat(g) }
hopperG.add(new THREE.Mesh(GEO.shell([[SPR, -0.05], [SPR, 0.09]], 0.0035, 48), steelM))
hopperG.add(new THREE.Mesh(pyr([[SPR * 1.414, 0.09], [0.707, 0.98]], 0.004), steelM))
for (const sx of [1, -1]) { const m = new THREE.Mesh(GEO.rbox(1.02, 0.03, 0.03, 0.007), steelM); m.position.set(0, 0.99, sx * 0.5); hopperG.add(m) }
for (const sz of [1, -1]) { const m = new THREE.Mesh(GEO.rbox(0.03, 0.03, 1.0, 0.007), steelM); m.position.set(sz * 0.5, 0.99, 0); hopperG.add(m) }
hopperG.add(new THREE.Mesh(GEO.lathe([[SPR - 0.002, -0.014], [SPR + 0.026, -0.014], [SPR + 0.026, 0.014], [SPR - 0.002, 0.014]], 48), steelM))
hopperG.position.set(HX, HY, 0)
lab.add(hopperG, { name: 'Loading hopper', explode: [0, 1.1, 0], xray: 'shell', count: 4 })
const pyrR = (y) => SPR * 1.414 + (y - 0.09) / 0.89 * (0.707 - SPR * 1.414)
const heapG = (() => { const g = GEO.lathe([[0, -0.045], [SPR * 1.414 - 0.01, -0.045], [SPR * 1.414 - 0.01, 0.09], [pyrR(0.86) - 0.02, 0.86], [pyrR(0.9) - 0.04, 0.9], [0.5, 0.95], [0.26, 0.985], [0, 1.0]], 4); g.rotateY(PI / 4); return flat(g) })()
const planarUV = (g, k) => { const p = g.attributes.position, uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) * k + 0.5; uv[i * 2 + 1] = p.getZ(i) * k + 0.5 } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g }
const heap = new THREE.Mesh(planarUV(heapG, 1.1), kibble(1.4, 1.4))
heap.position.set(HX, HY, 0)
lab.add(heap, { name: 'Product in hopper', explode: [0, 1.9, 0], count: 1 })
// flow control gate: a slide plate across the spout, opening with the loading capacity setting
const gate = new THREE.Group()
gate.add(new THREE.Mesh(GEO.rbox(0.26, 0.014, 0.23, 0.004), steelM))
{ const m = new THREE.Mesh(GEO.rbox(0.05, 0.04, 0.07, 0.01), orange); m.position.set(0.17, 0, 0); gate.add(m) }
{ const m = new THREE.Mesh(GEO.lathe([[0, 0], [0.008, 0], [0.008, 0.07], [0, 0.07]], 12).rotateZ(-PI / 2), chrome); m.position.set(0.13, 0, 0); gate.add(m) }
gate.position.set(HX, HY + 0.045, 0)
lab.add(gate, { name: 'Flow control gate', explode: [0, 0.6, 0.9], count: 3 })

// ------------------------------------------------------------------ unloading: duct, slide gate valve, and the silo at the top
const BX = X_OUT
const LID_Y = 4.85, DUCT_TOP = YT - TUBE_RI + 0.004, DUCT_BOT = 5.12
const flange = (y) => place(GEO.lathe([[SPR - 0.002, -0.016], [SPR + 0.028, -0.016], [SPR + 0.028, 0.016], [SPR - 0.002, 0.016]], 40), BX, y)
lab.mesh(GEO.merge([
  GEO.tube(SPR + 0.0035, SPR, DUCT_TOP - DUCT_BOT, 40, 0).translate(BX, DUCT_BOT, 0),
  place(GEO.lathe([[SPR - 0.002, -0.016], [SPR + 0.028, -0.016], [SPR + 0.028, 0.016], [SPR - 0.002, 0.016]], 40), BX, DUCT_TOP - 0.02),
  flange(DUCT_BOT + 0.016),
]), steelM, { name: 'Unloading duct', explode: [0, 0.5, 0.5], xray: 'shell', count: 3 })
const VY = DUCT_BOT - 0.012
const valveParts = [
  box(0.3, 0.014, 0.3, BX, VY - 0.1, 0, 0.004), box(0.3, 0.014, 0.3, BX, VY, 0, 0.004),
  box(0.014, 0.1, 0.3, BX - 0.143, VY - 0.05, 0, 0.004), box(0.014, 0.1, 0.3, BX + 0.143, VY - 0.05, 0, 0.004),
  box(0.3, 0.1, 0.014, BX, VY - 0.05, -0.143, 0.004), box(0.3, 0.1, 0.014, BX, VY - 0.05, 0.143, 0.004),
]
lab.mesh(GEO.merge(valveParts), steelM, { name: 'Slide gate valve', explode: [0, 0.3, 0.9], xray: 'shell', count: 3 })
lab.mesh(GEO.merge([place(GEO.lathe([[0, 0], [0.04, 0], [0.04, 0.24], [0, 0.24]], 28).rotateZ(-PI / 2), BX + 0.15, VY - 0.05, 0), box(0.06, 0.1, 0.1, BX + 0.38, VY - 0.05, 0, 0.012)]), orange, { name: 'Gate actuator', explode: [0, 0.3, 1.3] })
const CH_TOP = VY - 0.11, CH_BOT = LID_Y - 0.08
lab.mesh(GEO.tube(SPR + 0.0035, SPR - 0.0005, CH_TOP - CH_BOT, 36, 0).translate(BX, CH_BOT, 0), glassM, { name: 'Unloading sight chute', explode: [0, 0.2, 0.7] })

// the silo: a stainless cone and cylinder, a vertical glass strip to see the level, a lid with the inlet
const SY0 = 3.25, SY1 = 3.85, SR = 0.5, ST = 0.004
const siloR = (y) => y <= SY1 ? lerp(0.09, SR, clamp((y - SY0) / (SY1 - SY0))) - ST : SR - ST
const siloVol = []                                                     // cumulative volume from the cone tip
{ let v = 0; for (let y = SY0; y <= LID_Y - 0.1; y += 0.01) { siloVol.push([y, v]); v += PI * siloR(y) ** 2 * 0.01 } }
const V_SILO = siloVol[siloVol.length - 1][1]
const fillY = (frac) => { const v = frac * V_SILO; for (let i = 1; i < siloVol.length; i++) if (siloVol[i][1] >= v) return lerp(siloVol[i - 1][0], siloVol[i][0], (v - siloVol[i - 1][1]) / Math.max(1e-9, siloVol[i][1] - siloVol[i - 1][1])); return LID_Y - 0.1 }
const shellPoly = (pts, t) => {
  const out = pts.map((p) => new THREE.Vector2(p[0], p[1]))
  const inn = out.map((p, i) => { const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)]; const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1; return new THREE.Vector2(Math.max(0, p.x - (ty / l) * t), p.y + (tx / l) * t) })
  return [...out.map((v) => [v.x, v.y]), ...inn.reverse().map((v) => [v.x, v.y])]
}
const WIN = 0.52                                                       // half angle of the glass strip, rad
const silo = new THREE.Group()
silo.add(new THREE.Mesh(GEO.shell([[0.09, SY0], [SR, SY1]], ST, 80), steelM))                    // cone
silo.add(new THREE.Mesh(GEO.lathe(shellPoly([[SR, SY1], [SR, LID_Y]], ST), 80, { phi0: WIN, phiLen: 2 * PI - 2 * WIN }), steelM))  // cylinder with the window gap
for (const sg of [-1, 1]) { const m = new THREE.Mesh(GEO.rbox(0.03, LID_Y - SY1, 0.02, 0.005), steelM); m.position.set(SR * Math.sin(sg * WIN), (LID_Y + SY1) / 2, SR * Math.cos(WIN)); m.rotation.y = sg * WIN; silo.add(m) }
silo.add(new THREE.Mesh(GEO.lathe([[SPR + 0.004, LID_Y - 0.01], [SR + 0.008, LID_Y - 0.01], [SR + 0.008, LID_Y + 0.02], [SPR + 0.004, LID_Y + 0.02]], 80), steelM))
silo.add(new THREE.Mesh(GEO.lathe([[0.088, SY0 - 0.12], [0.12, SY0 - 0.12], [0.12, SY0 + 0.06], [0.088, SY0 + 0.06]], 40), steelM))
silo.add(new THREE.Mesh(GEO.lathe([[SR - 0.002, SY1 - 0.06], [SR + 0.04, SY1 - 0.06], [SR + 0.04, SY1 + 0.06], [SR - 0.002, SY1 + 0.06]], 80), steelM))
silo.position.set(BX, 0, 0)
lab.add(silo, { name: 'Receiving silo', explode: [0, 0, 1.0], xray: 'shell', count: 6 })
{
  const gl = new THREE.Mesh(GEO.lathe(shellPoly([[SR, SY1], [SR, LID_Y]], ST), 20, { phi0: -WIN, phiLen: 2 * WIN }), glassM)
  gl.position.set(BX, 0, 0)
  lab.add(gl, { name: 'Level window', explode: [0, 0, 1.3] })
}
// the product in the silo: rebuilt as the level moves
const siloHeap = new THREE.Mesh(new THREE.BufferGeometry(), kibble(1.4, 1.4))
siloHeap.position.set(BX, 0, 0)
lab.add(siloHeap, { name: 'Product in silo', explode: [0, 0.4, 1.0], count: 1 })
let heapLevel = -1
const buildHeap = (frac) => {
  const h = fillY(frac), pts = [[0, SY0 + 0.02], [0.085, SY0 + 0.02]]
  for (let y = SY0 + 0.1; y < h - 0.02; y += 0.12) pts.push([siloR(y) - 0.004, y])
  pts.push([siloR(h - 0.02) - 0.004, h - 0.02], [siloR(h) * 0.7, h + 0.03], [siloR(h) * 0.35, h + 0.06], [0, h + 0.075])
  const g = GEO.lathe(pts, 64)
  const p = g.attributes.position, uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z), top = p.getY(i) > h - 0.04; uv[i * 2] = top ? x * 1.1 + 0.5 : Math.atan2(x, z) / (2 * PI) * 3; uv[i * 2 + 1] = top ? z * 1.1 + 0.5 : p.getY(i) * 1.6 }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  siloHeap.geometry.dispose(); siloHeap.geometry = g; heapLevel = frac
}
buildHeap(0.25)
lab.mesh(GEO.merge([
  box(0.26, 0.012, 0.26, BX, SY0 - 0.04, 0, 0.003), box(0.26, 0.012, 0.26, BX, SY0 - 0.1, 0, 0.003),
  box(0.012, 0.06, 0.26, BX - 0.124, SY0 - 0.07, 0, 0.003), box(0.012, 0.06, 0.26, BX + 0.124, SY0 - 0.07, 0, 0.003),
]), steelM, { name: 'Silo outlet gate', explode: [0, 0, 1.3], count: 2 })

// ------------------------------------------------------------------ stands, frames, skid
const legs = []
const post = (x, z, y0, y1, w = 0.06) => legs.push(box(w, y1 - y0, w, x, (y0 + y1) / 2, z, 0.009))
const halfRing = (x, y, vertical) => vertical
  ? GEO.lathe([[TUBE_RO, -0.025], [TUBE_RO + 0.018, -0.025], [TUBE_RO + 0.018, 0.025], [TUBE_RO, 0.025]], 40).translate(x, y, 0)
  : place(GEO.lathe([[TUBE_RO, -0.025], [TUBE_RO + 0.018, -0.025], [TUBE_RO + 0.018, 0.025], [TUBE_RO, 0.025]], 40, { phi0: 0, phiLen: PI }), x, y, 0, -PI / 2)
const FLOOR = 0.075, ZZ = 0.36
const stand = (x, levels, top, tie = []) => {
  for (const sz of [1, -1]) post(x, sz * ZZ, FLOOR, top, 0.065)
  for (const y of levels) { legs.push(box(0.07, 0.05, 2 * ZZ, x, y - TUBE_RO - 0.035, 0, 0.008)); legs.push(halfRing(x, y, false)) }
  for (const y of tie) legs.push(box(0.05, 0.05, 2 * ZZ, x, y, 0, 0.008))
}
stand(0.95, [YB, YT], YT - TUBE_RO + 0.02, [1.7, 2.9, 4.1])
stand(2.3, [YB, YT], YT - TUBE_RO + 0.02, [1.7, 2.9, 4.1])
for (const y of [2.0, 3.0, 4.0]) {
  for (const sz of [1, -1]) legs.push(box(0.055, 0.05, ZZ - TUBE_RO - 0.02, XR, y, sz * (TUBE_RO + 0.01 + (ZZ - TUBE_RO - 0.02) / 2), 0.008))
  legs.push(halfRing(XR, y, true))
}
for (const sz of [1, -1]) post(XR, sz * ZZ, FLOOR, 4.2, 0.065)
for (const y of [1.2, 3.4]) legs.push(box(0.05, 0.05, 2 * ZZ, XR, y, 0, 0.008))
for (const sz of [1, -1]) for (const y of [1.2, 2.2, 3.2]) legs.push(box(XR - (BX + 0.36), 0.05, 0.05, (XR + BX + 0.36) / 2, y, sz * ZZ, 0.008))
for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) post(BX + sx * 0.36, sz * 0.36, FLOOR, SY1 + 0.02, 0.06)
for (const y of [0.6, 1.5, 2.4, 3.1]) for (const sz of [1, -1]) legs.push(box(0.72, 0.045, 0.045, BX, y, sz * 0.36, 0.008), box(0.045, 0.045, 0.72, BX + sz * 0.36, y, 0, 0.008))
for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) post(HX + sx * 0.42, sz * 0.42, FLOOR, HY + 0.77, 0.055)
for (const sz of [1, -1]) legs.push(box(0.84, 0.04, 0.04, HX, 0.7, sz * 0.42, 0.007), box(0.04, 0.04, 0.84, HX + sz * 0.42, 0.7, 0, 0.007))
post(XL, -ZZ, FLOOR, HD.y0, 0.08)
for (const y of [2.4, 3.6]) { legs.push(box(0.06, 0.05, ZZ - TUBE_RO - 0.02, XL, y, -(TUBE_RO + 0.01 + (ZZ - TUBE_RO - 0.02) / 2), 0.008)); legs.push(halfRing(XL, y, true)) }
for (const y of [1.9, 3.1, 4.3]) legs.push(box(0.95 - XL, 0.05, 0.05, (0.95 + XL) / 2, y, -ZZ, 0.008))
legs.push(box(1.35, 1.05, 0.03, dcx + 0.05, dcy, -0.175, 0.007))
for (const x of [-0.3, 0.7]) for (const sz of [1, -1]) post(x, sz * 0.07, FLOOR, HT.y0, 0.06)
const xs = [-0.3, XL, 0.7, 0.95, HX - 0.42, HX + 0.42, 2.3, BX - 0.36, BX + 0.36, XR]
for (const x of xs) legs.push(box(0.09, 0.07, 1.0, x, 0.04, 0, 0.01))
for (const sz of [1, -1]) legs.push(box(5.4, 0.07, 0.09, 2.05, 0.04, sz * ZZ, 0.01))
lab.mesh(GEO.merge(legs), MAT.stainless({ roughness: 0.42 }), { name: 'Stands, frames and skid', explode: [0, 0, -2.6], count: 54 })

// ------------------------------------------------------------------ product particles in the chute, and the jam bolt
const NP = 420
const partI = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.0135, 0), kibble(1, 1), NP)
partI.instanceMatrix.setUsage(THREE.DynamicDrawUsage); partI.frustumCulled = false
lab.add(partI, { name: 'Falling product', count: NP })
const pp = Array.from({ length: NP }, () => ({ on: false, x: 0, y: 0, z: 0, vy: 0 }))
let pCursor = 0, spawnAcc = 0
const rnd = (() => { let s = 5; return () => ((s = (s * 16807) % 2147483647) / 2147483647) })()
const hideM = new THREE.Matrix4().makeScale(0, 0, 0)
for (let i = 0; i < NP; i++) partI.setMatrixAt(i, hideM)

const bolt = new THREE.Group()
const boltM = MAT.chrome({ roughness: 0.18 })
bolt.add(new THREE.Mesh(GEO.lathe([[0, 0], [0.007, 0], [0.007, 0.08], [0, 0.08]], 14), boltM))
bolt.add(new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.0135, 0.01, 6).translate(0, 0.085, 0), boltM))
bolt.scale.setScalar(0.0001)
lab.add(bolt, { name: 'Foreign bolt', count: 0, explode: [0, 0, 0.55] })

// ------------------------------------------------------------------ solver
const I_RATIO = 58, ETA_G = 0.88, ETA_M = 0.78, P_N = 2200, T_N = P_N / (1440 * 2 * PI / 60)
const MU_C = 0.2, PHI_MAX = 0.64, T0 = 450, T_MIN = 60, I_LIM = 1.5, TRIP_S = 2.0
const SILO_OUT = 6                                                  // m3/h drawn from the silo outlet by the next process
const D_OUT = 2 * SPR, BEV = { C: 0.58, k: 1.4, d: 0.012 }
const whop = () => BEV.C * prod.rho * Math.sqrt(G) * Math.pow(D_OUT - BEV.k * prod.d, 2.5)   // kg/s
const qhop = () => whop() / prod.rho * 3600                          // m3/h
const F_WEDGE = 22e6 * (0.014 * 0.016)                              // PE yield 22 MPa over bolt x disc rim: force to crush through
const FD_MAX = I_LIM * T_N * I_RATIO * ETA_G / RS                   // N, drive force at the 150 % torque limit
const S_JAM = segs[1].s0 + 0.55

const DS = 0.05, NS = Math.round(L / DS)
const smp = Array.from({ length: NS }, (_, j) => {
  const s = (j + 0.5) * L / NS, [, , h] = at(s)
  const seg = segs.find((g) => s >= g.s0 && s < g.s0 + g.len) ?? segs[segs.length - 1]
  const bend = seg.t === 'A' && seg.R === RB ? 1 / RB : 0
  return { s, c: Math.abs(Math.cos(h)), n: Math.sin(h), k: bend, prod: s > S_IN && s < S_OUT ? 1 : 0, ds: L / NS }
})
function walk(T, a, b, lam) {
  for (const p of smp) {
    if (p.s < a || p.s >= b) continue
    T += p.ds * (MC * G * (MU_C * p.c + p.n) + p.prod * lam * G * (prod.mu * p.c + p.n)) + p.ds * MU_C * T * p.k
  }
  return T
}
function loads(phi) {
  const lam = prod.rho * A_I * phi
  const Tt = walk(T0, 0, S_DRIVE, lam)
  const b = walk(0, S_RET0, S_WHEEL, 0), a = walk(1, S_RET0, S_WHEEL, 0) - b
  const Ts = Math.max(T_MIN, (T0 - b) / a)
  return { Tt, Ts, Fd: Tt - Ts, lam }
}

const sim = { f: 50, v: 0.86, trav: 0, slip: 0.02, phi: PHI_MAX, Q: 0, ld: loads(PHI_MAX), Pel: 0, Pm: 0, jam: 0, stuck: false, tJam: 0, trip: false, travJam: 0, boltK: -1, boltS: 0, nm: 1470, cur: 0, open: 0.6, silo: 0.25, full: false, phiVis: PHI_MAX * 0.6 }

lab.hero({ label: 'Throughput', unit: 'm³/h', max: 60, digits: 1 })
const feed = lab.slider({ id: 'feed', label: 'Flow gate opening', min: 0, max: 60, value: 36, ends: ['Closed', 'Fully open · 60 m³/h'], fmt: (v) => `${Math.round(v / 60 * 100)} % · ${fmt(v)} m³/h` })
{
  feed.wrap.insertAdjacentHTML('beforeend', '<div class="gate-hint">Drag to open or close the flow control gate under the hopper (keys [ and ]). The slide plate moves, the discs fill more or less.</div>')
  addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT') return; if (e.key === '[') feed.set(feed.value - 3); if (e.key === ']') feed.set(feed.value + 3) })
}
const kpiEl = document.createElement('div'); kpiEl.className = 'kpis'
kpiEl.innerHTML = ['Mass flow|t/h', 'Chain speed|m/s', 'Power|kW', 'Chain tension|N', 'Silo level|%', 'Energy|Wh/t'].map((k) => `<div><small>${k.split('|')[0]}</small><b><span>0</span><i>${k.split('|')[1]}</i></b></div>`).join('')
lab.$('.lab-metric').insertAdjacentElement('afterend', kpiEl)
const kpiV = [...kpiEl.querySelectorAll('b span')]
{
  const sel = document.createElement('div'); sel.className = 'lab-ctl on mat-sel'
  const grp = (g) => `<div class="grp">${g}</div>${PRODUCTS.filter((p) => p.grp === g).map((p) => `<button data-id="${p.id}" title="${p.name}" style="--dot:${p.dot}"><i></i>${p.name}</button>`).join('')}`
  sel.innerHTML = `<div class="row"><span>Product</span><b></b></div><div class="chips">${grp('Food')}${grp('Non-food')}</div>`
  lab.$('.lab-ctls').appendChild(sel)
  // phones: the info panel and product/gate controls stay hidden until this toggle opens them
  const mobBtn = document.createElement('button'); mobBtn.className = 'mob-info'; mobBtn.textContent = 'Controls'
  mobBtn.addEventListener('click', () => { const on = document.body.classList.toggle('mob-open'); mobBtn.textContent = on ? 'Close' : 'Controls' })
  document.body.appendChild(mobBtn)
  sel.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setProduct(b.dataset.id) })
  addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'm' && e.target.tagName !== 'INPUT') setProduct(PRODUCTS[(PRODUCTS.indexOf(prod) + 1) % PRODUCTS.length].id) })
  setProduct('pet')
}
{
  // the open "How it is computed" card stops above the product buttons, so it never covers them
  const how = lab.$('.lab-how')
  const fit = () => { if (!how.open) { how.style.maxHeight = ''; return } const top = innerHeight * 0.03, lim = lab.$('.mat-sel').getBoundingClientRect().top - top - 14; how.style.maxHeight = (lim > 260 ? lim : innerHeight * 0.9) + 'px' }
  how.addEventListener('toggle', fit); addEventListener('resize', fit)
}
lab.how(`A closed loop of ${fmt(L, 1)} m with ${fmt(NL)} round links and ${fmt(ND)} plastic discs. The chain runs at the nominal inverter speed; what you set is the opening of the flow control gate under the hopper (the slider), which meters the loading capacity. The product (malt, cereals, dried fruit, rice, coffee, pet food, feed, pellets, plastic granules or chemicals: each with its own bulk density, wall friction and grain size) fills the tube between the discs up to 64 %, so the flow is the gate setting, capped by bore area x fill x chain speed (60 m³/h) and by what the hopper outlet can deliver (Beverloo). The chain tension is walked round the loop in 5 cm steps: sliding friction of chain and product, the 4.45 m lift, and the capstan gain on the two big bends; the take-up holds ${T0} N at the wheel and the drive supplies the difference between the tight and the slack side. Simplified: non-cohesive product, constant fill, no polygon effect on the sprocket. Chain wire, motor, gearbox and silo sizes are assumed.`, [
  'Q = min(Q_set, A phi v)      A = 0.03017 m2, phi = 0.64',
  'v = (120 f / p)(1 - s) / i x R      p = 4, i = 58, R = 0.329 m',
  'dT/ds = m g (mu cos a + sin a) + mu T k',
  'F = T_tight - T_slack      P = F v / (eta_g eta_m)',
  'W = C rho sqrt(g) (D - k d)^2.5      D = 0.19 m',
])

const LB = (t, at, value, side = 'right') => lab.label(lab.machine, t, { at, value, side })
LB('Loading hopper', [HX + 0.15, 1.75, 0], () => `${prod.name}`)
LB('Chain and discs', [XR + 0.08, 3.45, 0], () => `${fmt(sim.ld.Tt)} N tight`)
LB('Receiving silo', [BX + 0.42, 4.3, 0], () => `${fmt(sim.silo * 100)} % · ${fmt(sim.Q * prod.rho / 1000, 1)} t/h`)
LB('Drive sprocket', [XD, YD + 0.12, 0], () => `${fmt(sim.ld.Fd * RS)} N·m · ${fmt(sim.Pel / 1000, 2)} kW`)
LB('Flow control gate', [HX + 0.12, HY + 0.05, 0], () => `${fmt(sim.open * 100)} % · ${fmt(sim.Q, 1)} m³/h`)
LB('Return run', [XL, 3.0, 0], () => `${fmt(sim.ld.Ts)} N slack`)

// ------------------------------------------------------------------ run
const drawDisplay = (() => {
  const g = dispC.getContext('2d'); let last = ''
  return (txt1, txt2, bad) => {
    const key = txt1 + txt2 + bad; if (key === last) return; last = key
    g.fillStyle = '#04100a'; g.fillRect(0, 0, 256, 128)
    g.fillStyle = bad ? '#ff6a4a' : '#8dffb0'; g.font = '600 54px "JetBrains Mono", monospace'; g.textBaseline = 'middle'; g.fillText(txt1, 14, 46)
    g.font = '500 26px "JetBrains Mono", monospace'; g.fillStyle = bad ? '#ffae9a' : '#58c98a'; g.fillText(txt2, 14, 100)
    dispT.needsUpdate = true
  }
})()

function boltPos(s, blend) {
  const [x, y, h] = at(s), g = segs[1]
  const ox = x - g.cx, oy = y - g.cy, l = Math.hypot(ox, oy) || 1
  const w = { x: ox / l * 0.07, y: oy / l * 0.07 }
  return [lerp(x, x + w.x, blend), lerp(y - 0.065, y + w.y, blend), 0, lerp(h - PI / 2, h - PI / 2 + 0.55, blend)]
}

lab.onTick((dt, lab) => {
  const fcmd = sim.trip ? 0 : 50
  sim.f += clamp(fcmd - sim.f, -25 * dt, 12.5 * dt)
  sim.open = approach(sim.open, feed.value / 60, 0.25, dt)
  const ld = loads(sim.phi)
  sim.ld = ld
  const Pshaft = ld.Fd * sim.v / ETA_G + 60 * sim.f / 50
  sim.slip = 0.035 * clamp(Pshaft / P_N, 0, 1.7)
  sim.nm = 30 * sim.f * (1 - sim.slip)
  const vT = (sim.nm / 60 * 2 * PI / I_RATIO) * RS
  if (sim.stuck) {
    sim.v = approach(sim.v, 0, 0.04, dt)
    if (!sim.trip) { sim.tJam += dt; if (sim.tJam >= TRIP_S) sim.trip = true }
  } else sim.v = approach(sim.v, vT, 0.3, dt)
  sim.trav += sim.v * dt
  if (sim.jam === 1) {
    const sk = ((sim.boltK * 3 * P_LINK + sim.trav) % L + L) % L
    sim.boltS = Math.min(sk + 0.06, S_JAM)
    if (sim.trav >= sim.travJam) {
      sim.trav = sim.travJam; sim.jam = 2; sim.stuck = true; sim.tJam = 0
      const [bx, by] = boltPos(S_JAM, 1); lab.sparks.emit(lab.machine.localToWorld(new THREE.Vector3(bx, by, 0)), 140, 2.2)
    }
  }
  const Qcap = A_I * PHI_MAX * sim.v * 3600
  sim.Q = Math.min(sim.open * 60, Qcap, qhop())
  if (sim.silo >= 0.985) sim.full = true; else if (sim.silo < 0.93) sim.full = false
  if (sim.full) sim.Q = Math.min(sim.Q, SILO_OUT)
  sim.silo = clamp(sim.silo + (sim.Q - SILO_OUT) / 3600 * dt / V_SILO, 0, 1)
  if (Math.abs(sim.silo - heapLevel) > 0.004) buildHeap(sim.silo)
  sim.phi = sim.v > 1e-3 ? clamp(sim.Q / 3600 / (A_I * sim.v), 0, PHI_MAX) : 0
  if (sim.v > 0.05 && !sim.stuck) sim.phiVis = sim.phi
  sim.Pm = Pshaft
  sim.Pel = sim.stuck && !sim.trip ? (I_LIM * P_N) / ETA_M : sim.trip ? 20 : Pshaft / ETA_M
  sim.cur = sim.trip ? 0 : sim.stuck ? I_LIM : clamp(Pshaft / P_N, 0, 1.6)

  const trav = sim.trav
  for (let i = 0; i < NL; i++) { put(i * P_LINK + trav, (i & 1) ? PI / 2 : 0, 0); chainI.setMatrixAt(i, dummy.matrix) }
  for (let k = 0; k < ND; k++) {
    const s = ((k * P_DISC + trav) % L + L) % L
    put(s, 0, 0); discI.setMatrixAt(k, dummy.matrix); hubI.setMatrixAt(k, dummy.matrix)
    const loaded = s > S_IN - 0.05 && s < S_OUT - 0.03
    const f = loaded ? smoothstep(S_IN - 0.05, S_IN + 0.25, s) * clamp(sim.phiVis / PHI_MAX, 0, 1) : 0
    const len = Math.min(L_FULL * f, Math.max(0, S_OUT - s - RIM_Y - 0.02))
    const fk = Math.min(1, f * 4)
    if (fk > 0.03) put(s, 0, 0, 1, fk); else { dummy.scale.set(0, 0, 0); dummy.updateMatrix() }
    fillI.setMatrixAt(k, dummy.matrix)
    if (len > 0.004) put(s, 0, RIM_Y, 1, len); else { dummy.scale.set(0, 0, 0); dummy.updateMatrix() }
    plugI.setMatrixAt(k, dummy.matrix)
  }
  for (const m of [chainI, discI, hubI, plugI, fillI]) m.instanceMatrix.needsUpdate = true
  spDrive.rotation.z = spWheel.rotation.z = trav / RS
  lab.place(gate, HX + 0.24 * sim.open, HY + 0.045, 0)
  if (sim.jam) { const [bx, by, , br] = boltPos(sim.boltS, clamp((sim.boltS - (S_JAM - 0.45)) / 0.45, 0, 1)); lab.place(bolt, bx, by, -0.026); bolt.rotation.set(0, 0, br); bolt.scale.setScalar(2.0) } else bolt.scale.setScalar(0.0001)
  spawnAcc += sim.Q / 3600 / 4.5e-5 * dt
  while (spawnAcc >= 1) {
    spawnAcc -= 1; const p = pp[pCursor++ % NP]
    const a = rnd() * 2 * PI, r = Math.sqrt(rnd()) * 0.07
    p.on = true; p.x = BX + r * Math.cos(a); p.z = r * Math.sin(a); p.y = DUCT_TOP - 0.03 - rnd() * 0.05; p.vy = -0.2 - rnd() * 0.2
  }
  const showP = lab.state.explode < 0.12
  for (let i = 0; i < NP; i++) {
    const p = pp[i]
    if (p.on) { p.vy -= G * dt; p.y += p.vy * dt; if (p.y < fillY(sim.silo) + 0.05 * Math.sqrt(Math.max(0, 1 - ((p.x - BX) / 0.5) ** 2 - (p.z / 0.5) ** 2))) p.on = false }
    if (p.on && showP) { dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(i, i * 2, 0); dummy.scale.set(prod.sc[0], prod.sc[1], prod.sc[2]); dummy.updateMatrix(); partI.setMatrixAt(i, dummy.matrix) } else partI.setMatrixAt(i, hideM)
  }
  partI.instanceMatrix.needsUpdate = true
  ledG.emissiveIntensity = sim.trip ? 0.1 : 3; ledR.emissiveIntensity = sim.trip ? 5 + Math.sin(lab.time * 14) * 2 : sim.stuck ? 1.6 : 0.1
  drawDisplay(`${fmt(sim.f, 1)} Hz`, sim.trip ? 'OVERLOAD TRIP' : `${fmt(sim.cur * 100)} % torque`, sim.trip || sim.stuck)
  { const hide = lab.filmMode && ((lab.ft > 11.8 && lab.ft < 16.4) || (lab.ft > 19.0 && lab.ft < 27.3) || (lab.ft > 33.4 && lab.ft < 39.6)); const sp = lab.ui.querySelector('.mial-spec'); sp.style.opacity = hide ? '0' : '1'; sp.style.transition = 'opacity 0.5s' }
  const bad = sim.stuck
  const st = sim.trip ? 'jammed, drive tripped' : sim.stuck ? 'jammed, torque limit' : sim.Q < 0.5 ? 'gate shut' : Math.abs(sim.Q - feed.value) > 1.5 && feed.value <= Qcap ? (sim.Q < feed.value ? 'gate opening' : 'gate closing') : sim.Q >= Math.min(Qcap, qhop()) - 0.3 ? 'at full capacity' : 'steady'
  const tph = sim.Q * prod.rho / 1000
  const sub = sim.stuck
    ? `<span class="bad">bolt wedged at the first bend · needs ${fmt(F_WEDGE / 1000, 1)} kN · drive can pull ${fmt(FD_MAX / 1000, 1)} kN${sim.trip ? ' · tripped' : ` · trip in ${fmt(Math.max(0, TRIP_S - sim.tJam), 1)} s`}</span>`
    : `${prod.name} · gate ${fmt(sim.open * 100)} % open`
  const kw = sim.Pel / 1000
  kpiV[0].textContent = fmt(tph, 1); kpiV[1].textContent = fmt(sim.v, 2); kpiV[2].textContent = fmt(kw, 2)
  kpiV[3].textContent = fmt(sim.stuck ? sim.ld.Ts + FD_MAX : sim.ld.Tt); kpiV[4].textContent = fmt(sim.silo * 100); kpiV[5].textContent = tph > 0.3 ? fmt(kw * 1000 / tph) : '--'
  kpiEl.classList.toggle('bad', bad)
  lab.setHero(sim.Q, { state: st, sub, bad })
})

lab.breakIt({
  label: 'Jam a bolt',
  run(lab) {
    let best = -1, bd = 1e9
    for (let k = 0; k < ND; k++) {
      const s = ((k * P_DISC + sim.trav) % L + L) % L
      const d = ((S_JAM - 0.06 - s) % L + L) % L
      if (d >= 0.55 && d < bd) { bd = d; best = k }
    }
    sim.boltK = best; sim.travJam = sim.trav + bd; sim.jam = 1; sim.stuck = false; sim.tJam = 0
    sim.boltS = ((best * P_DISC + sim.trav) % L + L) % L + 0.06
  },
  reset() { sim.jam = 0; sim.stuck = false; sim.trip = false; sim.tJam = 0; sim.boltK = -1 },
})

// ------------------------------------------------------------------ plant examples (brochure pages 9 and 13) and the window inspection
const EXAMPLES = [
  { src: 'data:image/jpeg;base64,__EX1__', tag: 'CLEAN · brochure page 9', t: 'From a loading frame to a packaging line', d: 'A CLEAN loop starts in a steel frame at floor level, runs overhead on slim posts and drops the product into the hopper of a packaging machine on a raised floor.' },
  { src: 'data:image/jpeg;base64,__EX2__', tag: 'CLEAN · brochure page 9', t: 'Silos and an extruder on a platform', d: 'One tube serves two silos at the left, and a second line climbs, arches and feeds an extruder on a raised steel platform.' },
  { src: 'data:image/jpeg;base64,__EX3__', tag: 'CHAINMOVE · brochure page 13', t: 'Five silos on one line', d: 'A single chain runs along a catwalk above a row of five silos. Each silo has its own unloading hopper with a slide gate valve.' },
  { src: 'data:image/jpeg;base64,__EX4__', tag: 'CHAINMOVE · brochure page 13', t: 'Four silos fed from a process line', d: 'Four silos on steel frames are filled from above by one conveyor that starts at the process machine on the left.' },
]
const gal = document.createElement('div'); gal.className = 'gal'
gal.innerHTML = '<div class="gal-card"><button class="gal-x" aria-label="Close">×</button><div class="gal-main"><img alt=""></div><div class="gal-side"><small></small><h3></h3><p></p><div class="gal-th"></div><em>Images from the MIAL brochure, Tubular Chain Conveyor</em></div></div>'
lab.ui.appendChild(gal)
let galOn = false, galIdx = 0
const galImg = gal.querySelector('.gal-main img'), galTh = gal.querySelector('.gal-th')
EXAMPLES.forEach((e, i) => { const b = document.createElement('button'); b.dataset.i = i; const im = document.createElement('img'); im.src = e.src; b.appendChild(im); galTh.appendChild(b) })
const galShow = (i) => {
  galIdx = (i + EXAMPLES.length) % EXAMPLES.length; const e = EXAMPLES[galIdx]
  galImg.src = e.src; gal.querySelector('small').textContent = e.tag; gal.querySelector('h3').textContent = e.t; gal.querySelector('p').textContent = e.d
  galTh.querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', k === galIdx))
}
galTh.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) galShow(Number(b.dataset.i)) })
gal.querySelector('.gal-x').addEventListener('click', () => lab.toggle('examples', false))
gal.addEventListener('click', (e) => { if (e.target === gal) lab.toggle('examples', false) })
// the range at a glance: every CLEAN and CHAINMOVE model, from the brochure (pages 8, 12, 14, 15)
const MODELS = {
  CLEAN: [['CLEAN200', 'Drive unit ø 204', 60], ['CLEAN159', 'Drive unit ø 159', 30], ['CLEAN100', 'Drive unit ø 100', 10]],
  CHAINMOVE: [['CHAINMOVE159', 'Drive unit ø 159', 30], ['CHAINMOVE100', 'Drive unit ø 100', 10], ['CHAINMOVE60', 'Drive unit ø 60', 2]],
}
const LINES = {
  CLEAN: { tag: 'Gentle and safe handling of a wide range of granular and non-granular products.', rows: [['Drive', 'Gearmotor, no belt, drive on the chain'], ['Discs', 'Plastic, bolted to the chain'], ['Tube diameters', '100 · 159 · 200 mm'], ['Voltage', '400 V · 50 Hz (other voltages on request)'], ['Installed power', 'Up to 7.5 kW'], ['Versions', 'Galvanized steel · AISI 304 stainless steel'], ['Control panel', 'Available on request']] },
  CHAINMOVE: { tag: 'Long distances in a simple and safe way, as an alternative to traditional conveying systems.', rows: [['Drive', 'Gearmotor, no belt, drive on the discs'], ['Discs', 'Plastic, overmoulded onto the chain'], ['Tube diameters', '60 · 100 · 159 mm'], ['Voltage', '400 V · 50 Hz (other voltages on request)'], ['Installed power', 'Up to 7.5 kW'], ['Versions', 'Galvanized steel · AISI 304 stainless steel'], ['Loading', 'One or more hoppers, each with a flow control device'], ['Unloading', 'Stainless hoppers with slide gate valves: manual, pneumatic or motorized']] },
}
const spc = document.createElement('div'); spc.className = 'spc'
spc.innerHTML = `<div class="spc-card"><button class="spc-x" aria-label="Close">×</button>
  <h2>MIAL tubular chain conveyors <i>at a glance</i></h2><div class="sub">CLEAN and CHAINMOVE · six models · brochure pages 8, 12, 14, 15</div>
  <div class="spc-lines">${['CLEAN', 'CHAINMOVE'].map((ln) => `<div class="spc-line"><h3>${ln}</h3><p>${LINES[ln].tag}</p>
    <div class="spc-tiles">${MODELS[ln].map(([n, d, q]) => `<div class="spc-tile${n === 'CLEAN200' ? ' cur' : ''}"><b>${n}</b><small>${d}</small><div class="q">${q}<i>m³/h</i></div><div class="bar"><span style="width:${q / 60 * 100}%"></span></div>${n === 'CLEAN200' ? '<em>Shown here</em>' : ''}</div>`).join('')}</div>
    <div class="spc-rows">${LINES[ln].rows.map(([k, v]) => `<div><span>${k}</span><b style="font-weight:500">${v}</b></div>`).join('')}</div></div>`).join('')}</div>
  <div class="spc-common"><b>Energy savings over 50 %</b><b>One motorized traction point</b><b>AISI 304 stainless steel</b><b>Inverter-controlled motor</b><b>Pet food breakage under 0.2 %*</b></div>
  <div class="spc-apps">${['Malt and cereals', 'Coffee', 'Nuts and dried fruit', 'Pet food', 'Animal feed', 'Pellets', 'Plastic granules', 'Chemical products'].map((a) => `<span>${a}</span>`).join('')}</div>
  <div class="spc-foot">Max flow rates as listed on the brochure range pages. * Varies with the hardness and particle size of the product. The 3D model in this page is the CLEAN200. Source: MIAL, Tubular Chain Conveyor brochure.</div></div>`
lab.ui.appendChild(spc)
spc.querySelector('.spc-x').addEventListener('click', () => lab.toggle('models', false))
spc.addEventListener('click', (e) => { if (e.target === spc) lab.toggle('models', false) })
// FAQ: the five questions from the MIAL page (answers condensed) plus five about this simulator
const FAQ_SITE = [
  ['What is a tube chain conveyor?', 'A mechanical system that moves granular and powdery bulk materials around a closed circuit. A steel chain fitted with discs runs inside the tube and carries the product steadily along the whole route.'],
  ['What materials does it transport?', 'Food products such as malt, cereals, dried fruit, rice and coffee, and non-food products such as pet food, feed, pellets, plastic granules and chemical products. All ten can be selected in the Product buttons of this page.'],
  ['Does the product break during transport?', 'Hardly at all. The enclosed tube and the slow, steady movement keep breakage below 0.2 % (the brochure quotes this for pet food, and notes that it varies with the hardness and size of the product).'],
  ['Is the system suitable for complex routes?', 'Yes. One circuit can go vertically, horizontally and at angles, also over long distances, with flow and product under control throughout.'],
  ['Can it be integrated into existing systems?', 'Yes. The modular layout can be connected to storage units such as silos and to packaging lines without major structural changes.'],
]
const FAQ_SIM = [
  ['How do I change the throughput?', 'With the Flow gate opening slider (or the [ and ] keys). It moves the slide plate of the flow control gate under the hopper: the more it opens, the more the discs fill, up to 60 m³/h for the CLEAN200. The chain keeps running at its nominal speed.'],
  ['Why do rice, coffee and pellets give different tonnes per hour?', 'The volume flow in m³/h is the same, but the bulk density is not: from about 380 kg/m³ for coffee to about 850 kg/m³ for chemicals. Heavier products also load the drive more, because of the lift and the friction on the wall.'],
  ['What does Jam a bolt show?', 'A foreign steel bolt wedges between a disc and the first bend. It needs about 4.9 kN to crush through, the drive can pull about 3.4 kN at its torque limit, so the chain stops and the inverter trips. The chain tension stays near 4 kN, far from its breaking load.'],
  ['Which models are there?', 'The CLEAN200, CLEAN159 and CLEAN100, and the CHAINMOVE159, CHAINMOVE100 and CHAINMOVE60, from 60 down to 2 m³/h. Press D for the specifications. The 3D model shows the CLEAN200.'],
  ['What comes from the brochure and what is assumed?', 'Tube size, discs, drive type, voltage, power range, materials and capacities come from the brochure. The 2.2 kW motor, the 58:1 gearbox, the chain wire, the friction and density of each product and the silo size are assumptions. Open How it is computed for the equations.'],
]
const faq = document.createElement('div'); faq.className = 'faq'
const faqCol = (title, sub, items, open) => `<div class="faq-col"><h3>${title}<small>${sub}</small></h3>${items.map(([q, a], i) => `<details${open && i === 0 ? ' open' : ''}><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>`
faq.innerHTML = `<div class="faq-card"><button class="faq-x" aria-label="Close">×</button><h2>Frequently asked <i>questions</i></h2><div class="sub">Tubular chain conveyor · MIAL</div>
  <div class="faq-cols">${faqCol('About the conveyor', 'The questions on the MIAL product page, answers condensed', FAQ_SITE, true)}${faqCol('About this simulator', 'How to read and use what you see', FAQ_SIM, false)}</div>
  <div class="faq-foot">Source of the first five questions: mialtecno.com, Tubular Chain Conveyor page. The answers are shortened here; see the page for the original wording.</div></div>`
lab.ui.appendChild(faq)
faq.querySelector('.faq-x').addEventListener('click', () => lab.toggle('faq', false))
faq.addEventListener('click', (e) => { if (e.target === faq) lab.toggle('faq', false) })
lab.target.inspect = 0; lab.target.examples = 0; lab.target.models = 0; lab.target.faq = 0

// zoom to the first riser sight glass, in slow motion, as if inspecting it
const INSPECT = { az: 24, el: 4, dist: 0.145, target: [XR, 2.5, 0] }
const insp = { on: false, from: null, k0: 0, dir: 0 }
const camView = () => {
  const t = lab.controlsOrbit.target.clone().divideScalar(lab.k), o = lab.camera.position.clone().sub(lab.controlsOrbit.target), d = o.length()
  return { az: THREE.MathUtils.radToDeg(Math.atan2(o.x, o.z)), el: THREE.MathUtils.radToDeg(Math.asin(o.y / d)), dist: d / 2.4, target: [t.x, t.y, t.z] }
}
const easeIO = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
lab.onTick(() => {
  const wantG = lab.target.examples > 0.5
  { const wantF = lab.target.faq > 0.5; if (wantF !== faq.classList.contains('on')) { faq.classList.toggle('on', wantF); if (wantF) { lab.toggle('models', false); if (galOn) lab.toggle('examples', false) } } }
  { const wantM = lab.target.models > 0.5; if (wantM !== spc.classList.contains('on')) { spc.classList.toggle('on', wantM); if (wantM && galOn) lab.toggle('examples', false) } }
  if (wantG !== galOn) { galOn = wantG; gal.classList.toggle('on', galOn); if (galOn) galShow(galIdx) }
  if (lab.filmMode) return
  const wantI = lab.target.inspect > 0.5
  if (wantI && !insp.on) { insp.on = true; insp.from = camView(); insp.k0 = performance.now(); insp.dir = 1; lab.target.slow = 1; lab._syncButtons() }
  else if (!wantI && insp.on) { insp.on = false; insp.k0 = performance.now(); insp.dir = -1; lab.target.slow = 0; lab._syncButtons() }
  if (insp.dir) {
    const p = clamp((performance.now() - insp.k0) / 1100), e = easeIO(p), f = insp.dir > 0 ? e : 1 - e, A = insp.from, B = INSPECT
    lab.setView({ az: lerp(A.az, B.az, f), el: lerp(A.el, B.el, f), dist: lerp(A.dist, B.dist, f), target: A.target.map((x, i) => lerp(x, B.target[i], f)), fov: 30 })
    if (p >= 1) insp.dir = 0
  }
})
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return
  const k = e.key.toLowerCase()
  if (k === 'i') lab.toggle('inspect')
  if (k === 'p') lab.toggle('examples')
  if (k === 'd') lab.toggle('models')
  if (k === 'f') lab.toggle('faq')
  if (e.key === 'Escape') { lab.toggle('models', false); lab.toggle('faq', false) }
  if (galOn) { if (e.key === 'Escape') lab.toggle('examples', false); if (e.key === 'ArrowRight') galShow(galIdx + 1); if (e.key === 'ArrowLeft') galShow(galIdx - 1) }
})

// ------------------------------------------------------------------ film
{
  const v = lab.view, K = (o) => ({ ...v, ...o })
  const c = feed
  lab.autoFilm({
    override: {
      len: 49,
      shots: [
        { t: 0, ...K({ az: 12, el: 6, dist: 2.55 }) },
        { t: 4.5, ...K({ az: 26, el: 8, dist: 2.4 }) },
        { t: 10.2, ...K({ az: 34, el: 9, dist: 2.25 }) },
        { t: 12.2, ...K({ az: 24, el: 4, dist: 0.145, target: [XR, 2.5, 0] }) },
        { t: 15.0, ...K({ az: 24, el: 4, dist: 0.145, target: [XR, 2.5, 0] }) },
        { t: 16.8, ...K({ az: 20, el: 6, dist: 2.4 }) },
        { t: 19.4, ...K({ az: 16, el: 6, dist: 1.5, target: [2.4, 2.3, 0] }) },
        { t: 23.4, ...K({ az: 14, el: 6, dist: 1.4, target: [3.0, 3.4, 0] }) },
        { t: 27.2, ...K({ az: 30, el: 9, dist: 2.5 }) },
        { t: 29.0, ...K({ az: 32, el: 10, dist: 2.6, target: [1.8, 2.7, 0] }) },
        { t: 32.0, ...K({ az: 40, el: 14, dist: 2.75, target: [1.8, 2.7, 0] }) },
        { t: 33.0, ...K({ az: 22, el: 8, dist: 2.4 }) },
        { t: 34.6, ...K({ az: 14, el: 6, dist: 0.72, target: [4.0, 1.3, 0] }) },
        { t: 37.8, ...K({ az: 14, el: 6, dist: 0.72, target: [4.0, 1.3, 0] }) },
        { t: 40.0, ...K({ az: 24, el: 8, dist: 2.4 }) },
        { t: 49, ...K({ az: 12, el: 6, dist: 2.55 }) },
      ],
      events: [
        { t: 0, beat: ['01', 'One closed tube, one chain.', 'Product goes in at the bottom and comes out at the top, dust free.'] },
        { t: 2.2, beat: ['02', 'Claude builds the machine.', `${lab.parts.length} named parts, hopper to silo.`] },
        { t: 6.2, beat: ['03', 'You set the flow gate.', 'The gate opens, the discs fill, up to 60 m³/h.'], cursor: { to: `slider:feed:${(c.value - c.o.min) / (c.o.max - c.o.min)}`, dur: 0.9 } },
        { t: 7.4, cursor: { to: 'slider:feed:1', dur: 2.4, drag: true }, slider: { id: 'feed', to: 60, dur: 2.4 } },
        { t: 10.4, cursor: { hide: true } },
        { t: 11.2, beat: ['04', 'Look through the window.', 'Slow motion: discs, chain and product climbing.'], set: { slow: 1 } },
        { t: 15.6, beat: ['05', 'Cut it open.', 'Real section caps, live.'], set: { slow: 0, cut: 1, labels: 1 } },
        { t: 19.4, beat: ['06', 'Pet food.', 'Kibble, 470 kg/m³, the brochure case.'], set: { labels: 0 } },
        { t: 21.4, beat: ['06', 'Rice.', '780 kg/m³: the heaviest, so the most power.'], do: () => setProduct('rice') },
        { t: 23.4, beat: ['06', 'Coffee.', '380 kg/m³: light, and it tumbles easily.'], do: () => setProduct('coffee') },
        { t: 25.4, beat: ['06', 'Plastic granules.', 'Smooth, the lowest friction on the wall.'], do: () => setProduct('granules') },
        { t: 27.2, do: () => setProduct('pet'), set: { cut: 0 } },
        { t: 27.4, beat: ['07', 'Take it apart.', 'Every part on its own axis.'], set: { explode: 1 } },
        { t: 31.8, set: { explode: 0 } },
        { t: 32.6, beat: ['08', 'Then jam a bolt in the bend.', 'The drive stalls, the inverter trips.'], cursor: { to: 'button:break', dur: 0.8 }, set: { cut: 1 } },
        { t: 33.6, cursor: { click: true }, do: (lab) => lab.breakNow() },
        { t: 34.1, cursor: { hide: true } },
        { t: 38.4, do: (lab) => { lab.resetBreak(); setProduct('pet') }, slider: { id: 'feed', to: c.o.value, dur: 0.01 }, set: { cut: 0 } },
        { t: 40.0, beat: ['09', 'Seen in real plants.', 'Examples from the MIAL brochure.'], do: () => { galShow(0); lab.toggle('examples', true) } },
        { t: 42.0, do: () => galShow(1) },
        { t: 44.0, do: () => galShow(2) },
        { t: 46.0, do: () => galShow(3) },
        { t: 48.0, do: () => lab.toggle('examples', false) },
      ],
    },
  })
}
lab.start()
{
  const m = lab.$('.lab-modes'), brk = m.querySelector('.brk')
  const html = '<button data-k="inspect">Inspect window<kbd>I</kbd></button><button data-k="examples">Plant examples<kbd>P</kbd></button>'
  brk ? brk.insertAdjacentHTML('beforebegin', html) : m.insertAdjacentHTML('beforeend', html)
}
