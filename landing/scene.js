import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sm = x => x * x * (3 - 2 * x);
const eo = x => 1 - Math.pow(1 - x, 3);
const lerp = (a, b, k) => a + (b - a) * k;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = s => document.querySelector(s);
const fmt = (n, d = 0) => n.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });

/* ---------- renderer / scene ---------- */
const canvas = $('#gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  $('#nogl').style.display = 'block'; canvas.style.display = 'none';
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.localClippingEnabled = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .98;

const BG = 0x000000;
const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.fog = new THREE.Fog(BG, 90, 260);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;

const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 800);

const key = new THREE.DirectionalLight(0xfff1e0, 2.4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
const sc = key.shadow.camera; sc.left = -44; sc.right = 44; sc.top = 44; sc.bottom = -44; sc.near = 1; sc.far = 220;
key.shadow.bias = -0.0005; key.shadow.normalBias = 0.06; key.shadow.radius = 2.5;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0xb4c8ff, 1.0);
scene.add(rim, rim.target);
scene.add(new THREE.HemisphereLight(0x8aa0c0, 0x15110d, 0.38));

/* ---------- materials & helpers ---------- */
const std = (color, metalness, roughness, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
const M = {
  steel: std(0xc3ccd6, .85, .3),
  steelD: std(0x6c7783, .8, .42),
  dark: std(0x1a222c, .5, .6),
  asphalt: std(0x16181c, 0, .95, { transparent: true }),
  orange: std(0xee7319, .25, .42),
  blue: std(0x0c447f, .3, .45),
  white: std(0xe6ebf0, .1, .55),
  wood: std(0xa57c4a, 0, .85),
  belt: std(0x14181e, .3, .8),
  glass: std(0xaed4ff, 0, .06, { transparent: true, opacity: .2, depthWrite: false }),
  win: std(0x1b2b44, 0, .3, { emissive: 0x4da3ff, emissiveIntensity: .12 }),
  screen: std(0x0a2a4d, 0, .3, { emissive: 0x4da3ff, emissiveIntensity: 1.2 }),
  bag: std(0x1d6fb8, .05, .55),
  label: std(0xf4f6f8, 0, .6),
  film: std(0xff4fb2, 0, .15, { transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  wrap: std(0xff7cc4, 0, .15, { transparent: true, opacity: .32, depthWrite: false }),
  lvl: std(0x2997ff, 0, .4, { emissive: 0x2997ff, emissiveIntensity: 1.1 }),
  grain: std(0xb99a5e, 0, .9),
};
const shadow = m => { m.castShadow = true; m.receiveShadow = true; return m; };
function box(w, h, d, mat, x = 0, y = 0, z = 0) { const m = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)); m.position.set(x, y, z); return m; }
function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 28, open = false) { const m = shadow(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat)); m.position.set(x, y, z); return m; }
function cone(r, h, mat, x, y, z, down = false, seg = 28) { const geo = new THREE.ConeGeometry(r, h, seg); if (down) geo.rotateX(Math.PI); const m = shadow(new THREE.Mesh(geo, mat)); m.position.set(x, y, z); return m; }
function ring(r, t, mat, x, y, z) { const m = shadow(new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 36), mat)); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); return m; }
function beam(a, b, t, mat) {
  const d = b.clone().sub(a), m = shadow(new THREE.Mesh(new THREE.BoxGeometry(t, d.length(), t), mat));
  m.position.copy(a).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize()); return m;
}
const rot = (m, a, v) => { m.rotation[a] = v; return m; };
const RUNG = new THREE.BoxGeometry(.5, .04, .04);
function ladder(g, x, z, y0, y1, ry = 0) { // rails, rungs and safety hoops
  const L = new THREE.Group(); L.position.set(x, 0, z); L.rotation.y = ry; g.add(L);
  for (const sx of [-.25, .25]) L.add(box(.05, y1 - y0, .05, M.steelD, sx, (y0 + y1) / 2, 0));
  const n = Math.floor((y1 - y0) / .35), im = new THREE.InstancedMesh(RUNG, M.steel, n), o = new THREE.Object3D();
  for (let i = 0; i < n; i++) { o.position.set(0, y0 + .2 + i * .35, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); } L.add(im);
  for (let y = y0 + 2.2; y < y1; y += 1.1) { const h = ring(.4, .015, M.steelD, 0, y, .22); L.add(h); }
}
function stairs(g, a, b, w = .9) { // flight from a (low) to b (high): stringers, treads, handrails
  const d = b.clone().sub(a), n = Math.round(d.length() / .28), side = V3(-d.z, 0, d.x).normalize().multiplyScalar(w / 2), yaw = Math.atan2(d.x, d.z);
  for (const k of [-1, 1]) { g.add(beam(a.clone().addScaledVector(side, k), b.clone().addScaledVector(side, k), .07, M.steelD)); g.add(beam(a.clone().addScaledVector(side, k).add(V3(0, .95, 0)), b.clone().addScaledVector(side, k).add(V3(0, .95, 0)), .045, M.orange)); }
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(w, .035, .26), M.steel, n), o = new THREE.Object3D();
  for (let i = 0; i < n; i++) { o.position.copy(a).addScaledVector(d, (i + .5) / n); o.rotation.set(0, yaw, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); } g.add(im);
}
function stackLight(g, x, y, z) { g.add(cyl(.03, .03, .35, M.steelD, x, y + .17, z, 8)); [[0x30d158, 0], [0xffd60a, .14], [0xff453a, .28]].forEach(([c, dy]) => g.add(cyl(.07, .07, .12, emi(c, .9), x, y + .4 + dy, z, 12))); }
const emi = (c, i) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: .4 });

function padTex() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#121214'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1.5;
  for (let i = 0; i <= 512; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace; return t;
}
const fadeTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 20, 128, 128, 128); gr.addColorStop(0, '#fff'); gr.addColorStop(.62, '#fff'); gr.addColorStop(1, '#000');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
})();
const PAD = padTex();
function pad(g, w, d, cx = 0, cz = 0) {
  const t = PAD.clone(); t.needsUpdate = true; t.repeat.set(w / 8, d / 8);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, alphaMap: fadeTex, transparent: true, roughness: .92, metalness: 0 }));
  m.rotation.x = -Math.PI / 2; m.position.set(cx, 0, cz); m.receiveShadow = true; g.add(m); return m;
}

function roundPath(P, r, closed = false, steps = 8) {
  const out = [], n = P.length;
  for (let i = 0; i < n; i++) {
    const p = P[i];
    if (!closed && (i === 0 || i === n - 1)) { out.push(p.clone()); continue; }
    const a = P[(i - 1 + n) % n], b = P[(i + 1) % n];
    const da = a.clone().sub(p), db = b.clone().sub(p);
    const ra = Math.min(r, da.length() / 2), rb = Math.min(r, db.length() / 2);
    const p0 = p.clone().addScaledVector(da.normalize(), ra), p1 = p.clone().addScaledVector(db.normalize(), rb);
    for (let s = 0; s <= steps; s++) { const t = s / steps; out.push(new THREE.Vector3().addScaledVector(p0, (1 - t) * (1 - t)).addScaledVector(p, 2 * t * (1 - t)).addScaledVector(p1, t * t)); }
  }
  return out;
}
const tubeCurve = (P, r, closed) => new THREE.CatmullRomCurve3(roundPath(P, r, closed), closed, 'catmullrom', 0);

function mkPulses(g, curve, n) {
  const im = new THREE.InstancedMesh(new THREE.SphereGeometry(.17, 10, 8), new THREE.MeshStandardMaterial({ color: 0xee7319, emissive: 0xee7319, emissiveIntensity: 2.2 }), n);
  const o = new THREE.Object3D(); g.add(im); let ph = 0;
  return { update(dt, speed, cnt) { ph += dt * speed; im.count = cnt; for (let i = 0; i < cnt; i++) { curve.getPointAt(((ph) + i / cnt) % 1, o.position); o.updateMatrix(); im.setMatrixAt(i, o.matrix); } im.instanceMatrix.needsUpdate = true; } };
}

/* ---------- vehicles ---------- */
function mkWheel(r = .5, w = .32) { const m = cyl(r, r, w, M.dark, 0, 0, 0, 18); m.rotation.x = Math.PI / 2; return m; }
function mkTruck(tipper) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  body.add(box(2.4, 2.2, 2.4, tipper ? M.blue : M.white, 4.4, 1.9, 0));
  body.add(box(.08, 1.0, 2.0, M.glass, 5.62, 2.5, 0));
  body.add(box(9.8, .35, 1.0, M.dark, -.1, .9, 0));
  [4.2, -2.4, -3.7].forEach(x => { for (const z of [-1.1, 1.1]) { const w = mkWheel(); w.position.set(x, .5, z); body.add(w); } });
  const trl = new THREE.Group(); trl.position.set(-4.9, 1.1, 0); body.add(trl);
  trl.add(box(8.6, .14, 2.4, M.steelD, 4.3, 0, 0));
  if (tipper) {
    for (const z of [-1.2, 1.2]) trl.add(box(8.6, 1.3, .1, M.steel, 4.3, .65, z));
    trl.add(box(.1, 1.3, 2.4, M.steel, 0, .65, 0)); trl.add(box(.1, 1.5, 2.4, M.steel, 8.6, .75, 0));
    const load = box(8.3, .7, 2.2, M.grain, 4.3, .5, 0); trl.add(load); trl.userData.load = load;
  } else {
    for (const x of [0, 2.9, 5.8, 8.6]) for (const z of [-1.2, 1.2]) trl.add(box(.08, 1.6, .08, M.steel, x, .8, z));
    trl.add(box(8.6, .06, .06, M.steel, 4.3, 1.6, -1.2)); trl.add(box(8.6, .06, .06, M.steel, 4.3, 1.6, 1.2));
  }
  return { g, body, trl };
}
function mkLoad() {
  const p = new THREE.Group();
  p.add(box(1.2, .15, .8, M.wood, 0, .075, 0)); p.add(box(1.1, .95, .72, M.bag, 0, .62, 0)); p.add(box(1.14, 1.0, .76, M.wrap, 0, .65, 0));
  return p;
}
function mkForklift() {
  const f = new THREE.Group();
  f.add(box(1.1, .75, 2.0, M.orange, 0, .75, -.2)); f.add(box(1.1, .7, .7, M.dark, 0, .75, -1.2));
  for (const x of [-.5, .5]) for (const z of [-.9, .6]) { const w = cyl(.34, .34, .24, M.dark, x, .34, z, 16); w.rotation.z = Math.PI / 2; f.add(w); }
  for (const x of [-.5, .5]) { f.add(box(.07, 1.3, .07, M.dark, x, 1.8, -.7)); f.add(box(.07, 1.3, .07, M.dark, x, 1.8, .3)); }
  f.add(box(1.1, .06, 1.1, M.dark, 0, 2.45, -.2)); f.add(box(.5, .12, .5, M.dark, 0, 1.2, -.6));
  for (const x of [-.4, .4]) f.add(box(.08, 2.4, .08, M.steelD, x, 1.3, .95));
  const fork = new THREE.Group(); fork.position.set(0, .15, .95); f.add(fork);
  for (const x of [-.4, .4]) fork.add(box(.1, .06, 1.4, M.steel, x, 0, .65));
  fork.add(box(1.0, .5, .06, M.steelD, 0, .25, -.02));
  return { g: f, fork };
}

/* ======================================================================
   MODEL 0 · feed mill, from truck to pallet
   ====================================================================== */
const MIAL_C = 0xff9a4d, MF_C = 0x2997ff;
// one function = one coloured volume (orange MIAL, blue MF TECNO)
const FUNCS = {
  ric: { b: 'mial', boxes: [[-17, 7.2, 6.4, 3.6, 15, 7.4]] },
  sto: { b: 'mial', boxes: [[-6.6, 6.4, -1, 13.8, 13.2, 12]] },
  tra: { b: 'mial', boxes: [[-7, 14.2, -1, 21, 1.6, 1.7], [-17, 14.2, 2, 1.7, 1.6, 7.2], [12, 10.4, -1, 15, 1.6, 1.7]] },
  dos: { b: 'mial', boxes: [[3, 4.8, -1, 5.2, 9.8, 5.2], [-1.2, 1.1, 3.8, 2.6, 2.2, 2.4]] },
  pro: { b: 'mial', boxes: [[3, 12.2, -1, 5.2, 5, 5.2], [6, 3.4, 1.9, 1.9, 6.9, 1.9], [3, 3.9, -6.4, 2.4, 7.8, 2.4]] },
  alv: { b: 'mial', boxes: [[50, 2.6, -8, 29.5, 5.6, 10.5], [34, 3.7, -8, 3.4, 7.6, 3.4]] },
  ins: { b: 'mf', boxes: [[9.2, 3.4, -1, 3.4, 7, 3.6]] },
  pal: { b: 'mf', boxes: [[20.2, 2.6, -1, 5.8, 5.4, 3.8], [25.4, 1.8, -1, 2.6, 3.8, 2.6]] },
  car: { b: 'mf', boxes: [[19.2, 1.9, -4.8, 20, 3.8, 3.2]] },
  spe: { b: 'mf', boxes: [[28.8, 2.4, 6.2, 10, 4.9, 11.6]] },
};
const VIEWS = [
  { n: 'Panoramica', b: '', f: '*', sec: 'none', c: [16, 5, -2], dist: 118, az: -36, el: 19, t: 'Un’azienda completa, dal silo al camion', d: 'In arancione gli impianti MIAL (ricezione, stoccaggio, trasporto, produzione, allevamento), in blu le linee MF TECNO (insacco, pallet, cartoni, spedizione).' },
  { n: 'Ricezione', b: 'mial', f: 'ric', sec: 'ground', c: [-15, 2, 6.5], dist: 30, az: -22, el: 10, t: 'Sezione: dalla fossa all’elevatore', d: 'Il camion scarica in fossa interrata, un trasportatore porta il prodotto al piede dell’elevatore a tazze che lo solleva in quota.' },
  { n: 'Stoccaggio', b: 'mial', f: 'sto', sec: 'ground', c: [-6.6, 6.2, -4], dist: 40, az: -12, el: 10, t: 'Sezione: silos e livelli', d: 'Silos di stoccaggio tagliati a metà: si vede il prodotto e il suo livello, controllato silo per silo.' },
  { n: 'Trasporto', b: 'mial', f: 'tra', sec: 'tra', c: [-8, 9.5, -1], dist: 42, az: -10, el: 16, t: 'Sezione: il prodotto nel tubo', d: 'Catena con dischi dentro il trasportatore tubolare: il prodotto sale dall’elevatore, corre sopra i silos e un deviatore lo fa scendere nel silo scelto.' },
  { n: 'Dosaggio', b: 'mial', f: 'dos', sec: 'dos', c: [1.2, 5.2, 1.6], dist: 22, az: -26, el: 14, t: 'Sezione: macinazione, dosaggio, miscela', d: 'Il mulino a martelli macina, la scala di dosaggio pesa gli ingredienti, il miscelatore orizzontale monoalbero li omogeneizza.' },
  { n: 'Produzione', b: 'mial', f: 'pro', sec: 'pro', c: [4.6, 8, .5], dist: 26, az: -30, el: 12, t: 'Sezione: pellet e raffreddamento', d: 'La pressa forma il pellet; il raffreddatore a controcorrente lo raffredda con aria. Impianti da 1 a 60 t/h, anche modulari.' },
  { n: 'Insacco', b: 'mf', f: 'ins', sec: 'hall', c: [11, 3, -1], dist: 24, az: -26, el: 28, t: 'Sezione: pesatura e insacco', d: 'Pesatrice multitesta e insaccatrice a bocca aperta riempiono i sacchi, che passano dal controllo peso.' },
  { n: 'Pallet', b: 'mf', f: 'pal', sec: 'hall', c: [21, 2.5, -1], dist: 28, az: -24, el: 30, t: 'Sezione: pallettizzazione e fasciatura', d: 'Pallettizzatore cartesiano e avvolgitore pallet completano il pallet, pronto per la spedizione.' },
  { n: 'Cartoni', b: 'mf', f: 'car', sec: 'hall', c: [19, 1.4, -4.5], dist: 30, az: -16, el: 34, t: 'Sezione: incartonamento', d: 'Cartonatrice: i prodotti confezionati entrano nelle scatole, pronte per essere pallettizzate.' },
  { n: 'Spedizione', b: 'mf', f: 'spe', sec: 'hall', c: [28, 2, 3], dist: 32, az: -30, el: 22, t: 'Dal pallet al camion', d: 'Il carrello elevatore preleva il pallet a fine linea, esce dal portone e carica il camion.' },
  { n: 'Allevamento', b: 'mial', f: 'alv', sec: 'barn', c: [47, 1.4, -8], dist: 40, az: -24, el: 30, t: 'Sezione: mangimificio in allevamento', d: 'Impianto modulare MIAL in azienda agricola: mulino a martelli, scala di dosaggio e miscelatore orizzontale preparano il mangime, poi una linea lo porta alle mangiatoie.' },
];
/* ---------- MIAL machines with a "section" (ghost casing + moving internals) ---------- */
const gm = c => std(c, .3, .5, { transparent: true, opacity: 1 });
const ghostOn = (mats, on) => mats.forEach(m => { m.opacity = on ? .1 : 1; m.depthWrite = !on; });
const grainSolid = std(0xb99a5e, 0, .9), grainSoft = std(0xb99a5e, 0, .9, { transparent: true, opacity: .62 });
function mkMill(g, x, y, z) { // hammer mill: rotor with hammers behind a screen
  const body = gm(0x0c447f), hop = gm(0xe6ebf0), mats = [body, hop];
  g.add(box(1.8, 1.2, 1.3, body, x, y + .8, z)); g.add(cone(.7, .9, hop, x, y + 2.0, z, true, 20)); g.add(cyl(.7, .7, .5, hop, x, y + 2.7, z, 20));
  const mot = cyl(.4, .4, 1.6, M.steel, x - 1.7, y + .8, z, 20); mot.rotation.z = Math.PI / 2; g.add(mot); g.add(box(1.0, .12, .9, M.dark, x - 1.7, y + .05, z));
  g.add(box(2.6, .16, 1.6, M.dark, x - .2, y + .08, z)); for (const dz of [-.6, .6]) g.add(box(2.6, .1, .12, M.steelD, x - .2, y + .2, z + dz));
  g.add(box(.9, .6, .3, M.steelD, x - 1.3, y + .8, z + .72)); g.add(box(.3, .25, .3, M.dark, x - 1.7, y + 1.28, z)); // belt guard, motor terminal box
  for (let i = 0; i < 7; i++) { const f = cyl(.43, .43, .035, M.steelD, x - 2.2 + i * .15, y + .8, z, 20); f.rotation.z = Math.PI / 2; g.add(f); } // cooling fins
  g.add(box(.82, .72, .06, M.steelD, x, y + .8, z + .68)); g.add(box(.09, .34, .1, M.orange, x + .26, y + .8, z + .76)); for (const dy of [-.25, .25]) g.add(box(.1, .1, .1, M.dark, x - .36, y + .8 + dy, z + .7)); // access door, handle, hinges
  g.add(ring(.74, .035, M.steelD, x, y + 1.9, z)); g.add(ring(.74, .035, M.steelD, x, y + 2.45, z)); g.add(box(.5, .3, .6, M.orange, x + .95, y + 2.0, z)); // flanges, magnet
  g.add(cyl(.2, .2, .45, M.blue, x, y + 3.15, z, 18)); g.add(cone(.6, .55, M.steel, x, y + .02, z, true, 20)); g.add(box(.8, .08, .8, M.steelD, x, y - .3, z)); // feeder motor, outlet hopper
  const inner = new THREE.Group(); inner.position.set(x, y + .8, z); inner.visible = false; g.add(inner);
  const rotor = new THREE.Group(); inner.add(rotor);
  const shaft = cyl(.07, .07, 1.2, M.steel, 0, 0, 0, 10); shaft.rotation.x = Math.PI / 2; rotor.add(shaft);
  for (let k = 0; k < 8; k++) { const h = new THREE.Group(); h.rotation.z = k * Math.PI / 4; h.add(box(.34, .09, .06, M.steel, .32, 0, k % 2 ? .3 : -.3)); h.add(box(.34, .09, .06, M.steel, .32, 0, k % 2 ? -.1 : .1)); rotor.add(h); }
  const scr = new THREE.Mesh(new THREE.TorusGeometry(.5, .018, 6, 28, Math.PI), M.steelD); scr.rotation.z = Math.PI; inner.add(scr);
  const gN = 26, gI = new THREE.InstancedMesh(new THREE.SphereGeometry(.035, 6, 5), grainSolid, gN), o = new THREE.Object3D(); inner.add(gI);
  return { mats, setGhost(on) { ghostOn(mats, on); inner.visible = on; },
    update(dt, ph) { if (!inner.visible) return; rotor.rotation.z -= dt * 16; for (let i = 0; i < gN; i++) { const a = ph * 3 + i * 2.4, r = .32 + (i % 5) * .04; o.position.set(Math.cos(a) * r, Math.sin(a) * r, ((i * 37) % 11 - 5) * .09); o.updateMatrix(); gI.setMatrixAt(i, o.matrix); } gI.instanceMatrix.needsUpdate = true; } };
}
function mkMixer(g, x, y, z) { // horizontal single-shaft mixer
  const tr = gm(0xdfe5ea), mats = [tr];
  const trough = new THREE.Mesh(new THREE.CylinderGeometry(.65, .65, 2.4, 28, 1, true), tr); trough.rotation.z = Math.PI / 2; trough.position.set(x, y, z); trough.castShadow = true; g.add(trough);
  for (const dx of [-1.2, 1.2]) { const c = cyl(.65, .65, .06, tr, x + dx, y, z, 28); c.rotation.z = Math.PI / 2; g.add(c); }
  g.add(cyl(.28, .28, .35, tr, x, y + .8, z, 20)); g.add(box(.5, .3, .5, M.dark, x + .8, y - .72, z)); g.add(box(.6, .12, .8, M.steelD, x - 1.0, y - .9, z)); g.add(box(.6, .12, .8, M.steelD, x + 1.0, y - .95, z));
  for (const dx of [-1.28, 1.28]) g.add(box(.26, .5, .5, M.dark, x + dx, y, z)); // bearing blocks
  g.add(box(.5, .6, .6, M.steelD, x + 1.55, y, z)); const gm1 = cyl(.26, .26, .8, M.blue, x + 2.05, y, z, 20); gm1.rotation.z = Math.PI / 2; g.add(gm1); g.add(box(.2, .22, .24, M.dark, x + 2.05, y + .3, z)); // gearbox and motor
  for (const dx of [-.5, .5]) { g.add(box(.5, .08, .5, M.steelD, x + dx, y - .62, z)); g.add(cyl(.04, .04, .45, M.steel, x + dx, y - .85, z + .35, 8)); } // discharge doors with cylinders
  g.add(ring(.3, .03, M.steelD, x, y + .98, z)); g.add(box(.55, .05, .38, M.steelD, x - .5, y + .66, z)); g.add(box(.08, .06, .22, M.orange, x - .5, y + .72, z)); // inlet flange, hatch
  const spray = cyl(.03, .03, 1.9, M.orange, x, y + .72, z + .3, 8); spray.rotation.z = Math.PI / 2; g.add(spray); for (let i = -2; i <= 2; i++) g.add(cyl(.015, .015, .12, M.steel, x + i * .4, y + .66, z + .3, 6)); // liquid spray bar
  const inner = new THREE.Group(); inner.position.set(x, y, z); inner.visible = false; g.add(inner);
  const shaft = new THREE.Group(); inner.add(shaft);
  const sc = cyl(.06, .06, 2.3, M.steel, 0, 0, 0, 10); sc.rotation.z = Math.PI / 2; shaft.add(sc);
  for (let i = 0; i < 8; i++) { const a = new THREE.Group(); a.position.x = -1.0 + i * .285; a.rotation.x = i * .8; a.add(box(.04, .5, .04, M.steel, 0, .25, 0)); a.add(box(.2, .06, .14, M.steel, 0, .52, 0)); shaft.add(a); }
  inner.add(box(2.3, .36, 1.0, grainSoft, 0, -.3, 0));
  return { mats, setGhost(on) { ghostOn(mats, on); inner.visible = on; }, update(dt) { if (inner.visible) shaft.rotation.x += dt * 3; } };
}
function mkScale(g, x, y, z) { // dosing scale hopper with level
  const hop = gm(0xe6ebf0), mats = [hop];
  g.add(cyl(.75, .75, 2.2, hop, x, y, z, 24)); g.add(cone(.75, .9, hop, x, y - 1.55, z, true, 24));
  g.add(ring(.8, .04, M.steelD, x, y + 1.1, z)); g.add(ring(.8, .04, M.steelD, x, y - 1.0, z)); g.add(cyl(.22, .22, .35, M.steel, x, y + 1.3, z, 16)); // flanges, inlet
  for (let k = 0; k < 3; k++) { const a = k * 2.094 + .5; g.add(cyl(.07, .07, .28, M.orange, x + Math.cos(a) * .8, y + .95, z + Math.sin(a) * .8, 10)); } // load cells
  g.add(box(.55, .1, .55, M.steelD, x, y - 2.05, z)); g.add(rot(cyl(.05, .05, .5, M.steel, x + .45, y - 2.05, z, 8), 'z', Math.PI / 2)); g.add(rot(cyl(.12, .12, .24, M.blue, x + .8, y - 2.05, z, 12), 'z', Math.PI / 2)); // discharge gate with actuator
  g.add(cyl(.02, .02, .5, M.steel, x - .4, y + 1.35, z + .3, 6)); // level probe
  const inner = new THREE.Group(); inner.position.set(x, y, z); inner.visible = false; g.add(inner);
  const fill = new THREE.Mesh(new THREE.CylinderGeometry(.68, .68, 1, 24), grainSoft); inner.add(fill);
  return { mats, setGhost(on) { ghostOn(mats, on); inner.visible = on; }, update(dt, ph) { if (!inner.visible) return; const l = (ph * .22) % 1; fill.scale.y = Math.max(.02, l * 2.0); fill.position.y = -1.1 + fill.scale.y / 2; } };
}
function mkPress(g, x, y, z) { // pellet press: ring die and rollers, pellets falling out
  const hop = gm(0xe6ebf0), mats = [hop];
  g.add(cyl(.95, .95, 1.1, hop, x, y, z, 28)); g.add(cone(.95, 1.0, hop, x, y - 1.0, z, true, 28));
  const mot = cyl(.5, .5, 1.1, M.blue, x + 2.2, y - .1, z, 24); mot.rotation.z = Math.PI / 2; g.add(mot); g.add(box(1.1, .95, .95, M.steelD, x + 1.3, y - .1, z)); g.add(box(.4, .3, .4, M.dark, x + 2.2, y + .5, z)); // main motor and gearbox
  const fd = cyl(.16, .16, 1.7, M.steel, x - 1.6, y + .3, z, 14); fd.rotation.z = Math.PI / 2; g.add(fd); g.add(rot(cyl(.2, .2, .4, M.blue, x - 2.55, y + .3, z, 14), 'z', Math.PI / 2)); // conditioner / feeder screw with motor
  g.add(box(1.5, .3, 1.5, M.steelD, x, y - 1.75, z)); g.add(box(.5, .5, .06, M.dark, x, y - 1.75, z + .78)); g.add(box(.08, .2, .1, M.orange, x + .3, y - 1.75, z + .83)); // cutter box with door
  g.add(ring(.97, .04, M.steelD, x, y + .55, z)); g.add(box(.5, .35, .4, M.white, x - .4, y + .75, z + .9)); // flange, control box
  const inner = new THREE.Group(); inner.position.set(x, y, z); inner.visible = false; g.add(inner);
  const die = new THREE.Mesh(new THREE.TorusGeometry(.62, .12, 10, 32), M.steelD); die.rotation.x = Math.PI / 2; inner.add(die);
  const rol = new THREE.Group(); inner.add(rol); for (let k = 0; k < 3; k++) { const a = k * 2.094, r = cyl(.13, .13, .36, M.steel, Math.cos(a) * .38, 0, Math.sin(a) * .38, 12); rol.add(r); }
  const pN = 22, pI = new THREE.InstancedMesh(new THREE.CylinderGeometry(.04, .04, .14, 6), grainSolid, pN), o = new THREE.Object3D(); inner.add(pI);
  return { mats, setGhost(on) { ghostOn(mats, on); inner.visible = on; },
    update(dt, ph) { if (!inner.visible) return; rol.rotation.y += dt * 4; die.rotation.z += dt * 1.2; for (let i = 0; i < pN; i++) { const u = (ph * .6 + i / pN) % 1; o.position.set(Math.sin(i * 7) * .14, -.9 - u * 1.5, Math.cos(i * 5) * .14); o.updateMatrix(); pI.setMatrixAt(i, o.matrix); } pI.instanceMatrix.needsUpdate = true; } };
}
function mkCooler(g, x, y, z, h) { // counter-flow cooler: pellets go down, air goes up
  const col = gm(0xdfe5ea), mats = [col];
  g.add(box(1.5, h, 1.5, col, x, y, z)); g.add(cyl(.6, .7, .5, M.steelD, x, y + h / 2 + .25, z, 20)); for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) g.add(box(.12, .5, .12, M.steelD, x + a * .6, y - h / 2 - .25, z + b * .6));
  ladder(g, x - 1.05, z + .6, y - h / 2, y + h / 2, Math.PI / 2);
  g.add(box(.55, .75, .05, M.steelD, x, y + h * .12, z + .78)); g.add(box(.09, .3, .08, M.orange, x + .18, y + h * .12, z + .83)); g.add(box(.55, .75, .05, M.steelD, x, y - h * .25, z + .78)); g.add(box(.09, .3, .08, M.orange, x + .18, y - h * .25, z + .83)); // inspection doors
  const al = cyl(.3, .3, .8, M.blue, x + 1.2, y - h / 2 + .3, z, 20); al.rotation.z = Math.PI / 2; g.add(al); g.add(box(.9, .5, .7, M.steelD, x + .95, y - h / 2 + .3, z)); g.add(rot(cyl(.12, .12, .24, M.dark, x + 1.7, y - h / 2 + .3, z, 12), 'z', Math.PI / 2)); // rotary airlock
  g.add(rot(cyl(.2, .2, .08, M.glass, x - .76, y + h * .3, z, 16), 'z', Math.PI / 2)); g.add(box(.7, .15, .7, M.steelD, x, y + h / 2 + .03, z)); // sight glass, top frame
  const fan = new THREE.Group(); fan.position.set(x, y + h / 2 + .52, z); g.add(fan); for (let k = 0; k < 4; k++) { const hh = new THREE.Group(); hh.rotation.y = k * Math.PI / 2; hh.add(box(.5, .03, .16, M.steel, .27, 0, 0)); fan.add(hh); }
  const inner = new THREE.Group(); inner.position.set(x, y, z); inner.visible = false; g.add(inner);
  const pN = 60, pI = new THREE.InstancedMesh(new THREE.CylinderGeometry(.04, .04, .1, 6), grainSolid, pN), aN = 16, aI = new THREE.InstancedMesh(new THREE.ConeGeometry(.05, .3, 6), std(0x9fd0ff, 0, .4, { emissive: 0x4da3ff, emissiveIntensity: .8 }), aN), o = new THREE.Object3D(); inner.add(pI, aI);
  return { mats, setGhost(on) { ghostOn(mats, on); inner.visible = on; },
    update(dt, ph) { fan.rotation.y += dt * 8; if (!inner.visible) return; for (let i = 0; i < pN; i++) { const u = (ph * .12 + i * .137) % 1; o.position.set(Math.sin(i * 3.1) * .55, h / 2 - u * h, Math.cos(i * 2.3) * .55); o.updateMatrix(); pI.setMatrixAt(i, o.matrix); }
      for (let i = 0; i < aN; i++) { const u = (ph * .35 + i / aN) % 1; o.position.set(Math.sin(i * 5.3) * .6, -h / 2 + u * h, Math.cos(i * 4.1) * .6); o.updateMatrix(); aI.setMatrixAt(i, o.matrix); } pI.instanceMatrix.needsUpdate = aI.instanceMatrix.needsUpdate = true; } };
}
function mkFlow(g, curve) { // chain discs + product moving inside a tubular conveyor (visible in section)
  const L = curve.getLength(), SP = .42, N = Math.floor(L / SP), o = new THREE.Object3D(), p = V3(), t = V3(), Y = V3(0, 1, 0);
  const discs = new THREE.InstancedMesh(new THREE.CylinderGeometry(.14, .14, .03, 12), std(0xe8ecef, .1, .5), N), plugs = new THREE.InstancedMesh(new THREE.CylinderGeometry(.16, .16, 1, 12), grainSolid, N);
  discs.visible = plugs.visible = false; g.add(discs, plugs); let s = 0;
  return { set(v) { discs.visible = plugs.visible = v; },
    update(dt) { if (!discs.visible) return; s = (s + .865 * dt) % SP; for (let i = 0; i < N; i++) { const u = (i * SP + s) / L; curve.getPointAt(u, p); curve.getTangentAt(u, t); o.position.copy(p); o.quaternion.setFromUnitVectors(Y, t); o.scale.set(1, 1, 1); o.updateMatrix(); discs.setMatrixAt(i, o.matrix); const u2 = Math.min(.999, u + SP * .5 / L); curve.getPointAt(u2, p); o.position.copy(p); o.scale.set(1, SP * .8, 1); o.updateMatrix(); plugs.setMatrixAt(i, o.matrix); } discs.instanceMatrix.needsUpdate = plugs.instanceMatrix.needsUpdate = true; } };
}
function buildPlant(ox) {
  const g = new THREE.Group(); g.position.set(ox, 0, 0);
  const padMesh = pad(g, 150, 90, 6, 4);
  g.add(box(130, .04, 10.2, M.asphalt, 4, .02, 10.2));
  for (let x = -58; x < 62; x += 4) g.add(box(1.8, .045, .12, M.label, x, .03, 10.2));
  // silos: dedicated materials so a section plane can cut them in half
  const R = 1.8, silos = [[-9, -4.6], [-9, 2.6], [-4.2, -4.6], [-4.2, 2.6]], bars = [], fills = [], caps = [];
  const clipP = new THREE.Plane(new THREE.Vector3(0, 0, -1), -4.6); // keeps z <= -4.6
  const DS = THREE.DoubleSide;
  const sM = { s: std(0xc3ccd6, .85, .3, { side: DS }), d: std(0x6c7783, .8, .42, { side: DS }), o: std(0xee7319, .25, .42, { side: DS }), k: std(0x1a222c, .5, .6), l: std(0x2997ff, 0, .4, { emissive: 0x2997ff, emissiveIntensity: 1.1 }), grain: std(0xb99a5e, 0, .9, { side: DS }) };
  const siloMats = Object.values(sM);
  silos.forEach(([x, z]) => {
    g.add(cyl(R, R, 8, sM.s, x, 7, z, 36)); g.add(cone(R, 2.2, sM.s, x, 1.9, z, true, 36)); g.add(cone(R + .05, 1.1, sM.s, x, 11.55, z, false, 36));
    [4.5, 6.2, 7.9, 9.6].forEach(y => g.add(ring(R + .02, .06, sM.d, x, y, z)));
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([a, b]) => g.add(box(.2, 3, .2, sM.d, x + a * R * .78, 1.5, z + b * R * .78)));
    g.add(box(.08, 8.6, .34, sM.o, x, 7.3, z + (z > 0 ? -R - .04 : R + .04)));
    g.add(cyl(.28, .28, .5, sM.o, x, 12.35, z, 16));
    g.add(box(.7, .9, .7, sM.s, x + .85, 11.75, z)); g.add(box(.6, .1, .6, sM.d, x + .85, 12.25, z)); g.add(cyl(.02, .02, .7, sM.k, x - .6, 11.9, z + .3, 6)); // dust filter, level probe
    g.add(cyl(.3, .3, .7, sM.d, x, .45, z, 18)); g.add(box(.5, .15, .5, sM.k, x, .02, z)); // rotary outlet valve
    ladder(g, x + R * .93, z + R * .4 * (z > 0 ? -1 : 1), 0, 11.3, Math.PI / 2 + (z > 0 ? -.4 : .4));
    const a = -36 * Math.PI / 180, bx = x + Math.sin(a) * (R + .06), bz = z + Math.cos(a) * (R + .06);
    const holder = new THREE.Group(); holder.position.set(bx, 3.4, bz); holder.rotation.y = a; g.add(holder);
    holder.add(box(.34, 7.2, .08, sM.k, 0, 3.6, 0));
    const fill = new THREE.Mesh(new THREE.BoxGeometry(.2, 1, .06), sM.l); fill.position.set(0, 0, .06); holder.add(fill);
    bars.push(fill);
    // product inside (shown in section) with a flat cap on the cutting plane
    const pf = new THREE.Mesh(new THREE.CylinderGeometry(R - .06, R - .06, 1, 28), sM.grain); pf.visible = false; g.add(pf); fills.push(pf);
    const cp = new THREE.Mesh(new THREE.PlaneGeometry(2 * (R - .06), 1), sM.grain); cp.position.set(x, 0, -4.6 + .01); cp.visible = false; g.add(cp); caps.push(cp);
  });
  // intake pit, conveyor and bucket elevator
  g.add(box(3.2, .08, 2.6, M.dark, -17, .06, 8.5));
  for (let i = -3; i <= 3; i++) g.add(box(.05, .1, 2.5, M.steel, -17 + i * .4, .12, 8.5));
  g.add(box(3.4, .1, .12, M.orange, -17, .12, 7.15)); g.add(box(3.4, .1, .12, M.orange, -17, .12, 9.85));
  g.add(box(.8, .5, 3.6, M.steelD, -17, .35, 6.7));
  const elevM = gm(0xc3ccd6); g.add(box(.8, 15, .8, elevM, -17, 7.5, 5)); g.add(box(1.3, 1.3, 1.3, M.steelD, -17, 14.7, 5));
  const bkN = 22, bkI = new THREE.InstancedMesh(new THREE.BoxGeometry(.26, .2, .24), M.orange, bkN); bkI.visible = false; g.add(bkI); const bo = new THREE.Object3D(); g.add(cyl(.4, .4, .9, M.blue, -17, 15.6, 5, 16));
  for (let y = 3; y < 14; y += 3.5) { g.add(box(.95, .1, .95, M.steelD, -17, y, 5)); g.add(box(.5, .6, .06, M.steelD, -17, y + .8, 5.43)); g.add(box(.09, .25, .08, M.orange, -16.82, y + .8, 5.48)); } // flanges and inspection doors
  g.add(box(1.2, 1.3, 1.2, M.steelD, -17, .65, 5)); g.add(box(.5, .6, .06, M.steelD, -17, .7, 5.63)); g.add(cone(.5, .8, M.steel, -17, 15.2, 5, false, 4)); // boot, head hood
  { const dm = cyl(.35, .35, 1.0, M.blue, -15.6, 14.7, 5, 20); dm.rotation.z = Math.PI / 2; g.add(dm); g.add(box(.9, .8, .8, M.steelD, -16.2, 14.7, 5)); g.add(box(.3, .25, .3, M.dark, -15.6, 15.1, 5)); } // head drive: gearbox and motor
  ladder(g, -17.7, 5, 0, 14.6, Math.PI / 2);
  // underground reception (shown in section): pit hopper, conveyor, elevator boot
  const ug = new THREE.Group(); ug.visible = false; g.add(ug);
  ug.add(cone(1.5, 2.2, M.steel, -17, -1.3, 8.5, true, 28)); ug.add(box(.8, .5, 3.9, M.steelD, -17, -1.9, 6.6)); ug.add(box(1.1, 1.4, 1.1, M.steel, -17, -1.4, 5));
  ug.add(box(3.8, 2.6, 6.6, M.glass, -17, -1.3, 7.2)); ug.add(box(3.8, .08, 6.6, M.dark, -17, -2.6, 7.2));
  // process tower
  const tx = 3, tz = -1, lights = [];
  [[-2, -2], [2, -2], [-2, 2], [2, 2]].forEach(([a, b]) => g.add(box(.3, 13.2, .3, M.orange, tx + a, 6.6, tz + b)));
  [4.2, 8.4, 12.6].forEach((y, i) => {
    g.add(box(4.6, .14, 4.6, M.steelD, tx, y, tz));
    for (const s of [-1, 1]) { g.add(box(4.6, .07, .07, M.orange, tx, y + 1, tz + s * 2.3)); g.add(box(.07, .07, 4.6, M.orange, tx + s * 2.3, y + 1, tz)); g.add(box(4.6, .07, .07, M.orange, tx, y + .5, tz + s * 2.3)); g.add(box(.07, .07, 4.6, M.orange, tx + s * 2.3, y + .5, tz)); }
    if (i < 2) {
      const lo = y, hi = y + 4.2;
      g.add(beam(V3(tx - 2, lo, tz + 2), V3(tx + 2, hi, tz + 2), .1, M.steelD)); g.add(beam(V3(tx + 2, lo, tz + 2), V3(tx - 2, hi, tz + 2), .1, M.steelD));
      g.add(beam(V3(tx + 2, lo, tz - 2), V3(tx + 2, hi, tz + 2), .1, M.steelD)); g.add(beam(V3(tx + 2, lo, tz + 2), V3(tx + 2, hi, tz - 2), .1, M.steelD));
    }
    const lm = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), emi(0x2997ff, 1)); lm.position.set(tx + 2.1, y + .2, tz + 2.1); g.add(lm); lights.push(lm);
  });
  const tMix = mkMixer(g, tx - .4, 5.0, tz), tScale = mkScale(g, tx, 9.6, tz), tPress = mkPress(g, tx, 13.4, tz);
  g.add(box(.9, 1.1, .6, M.dark, tx + 1.2, 4.9, tz + 1.55)); g.add(box(.5, .35, .04, M.screen, tx + 1.2, 5.05, tz + 1.87));
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(.22, 12, 10), emi(0xee7319, 2)); beacon.position.set(tx, 14.6, tz); g.add(beacon);
  // hammer mill feeding the tower through a screw conveyor
  const tMill = mkMill(g, -1.2, 0, 3.8);
  g.add(box(.35, .35, 4.6, M.steel, 1.2, 1.2, 1.9)); g.add(box(.35, .35, 2.4, M.steel, 0, 1.2, 3.8).rotateY(Math.PI / 2));
  // cyclone with steam
  g.add(cyl(.95, .95, 2.4, M.steel, 3, 4.7, -6.4, 28)); g.add(cone(.95, 2.2, M.steel, 3, 2.4, -6.4, true, 28)); g.add(cyl(.22, .22, 1.6, M.steelD, 3, 6.7, -6.4, 14));
  [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([a, b]) => g.add(box(.14, 2.4, .14, M.steelD, 3 + a * .7, 1.2, -6.4 + b * .7)));
  const steamN = 36, steamGeo = new THREE.BufferGeometry(), sp = new Float32Array(steamN * 3), sph = Array.from({ length: steamN }, (_, i) => i / steamN);
  steamGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const steam = new THREE.Points(steamGeo, new THREE.PointsMaterial({ color: 0xdfe6ee, size: .9, transparent: true, opacity: .16, depthWrite: false })); steam.frustumCulled = false; g.add(steam);
  // hall (cutaway-able) with the MF TECNO line inside
  const hx = 19, hz = -1;
  const ghost = c => std(c, .1, .55, { transparent: true, opacity: 1 });
  const wallM = ghost(0xe6ebf0), roofM = ghost(0x6c7783), bandM = ghost(0x0c447f), orgM = ghost(0xee7319);
  const shell = [wallM, roofM, bandM, orgM];
  g.add(box(24, 7.4, 12, wallM, hx, 3.7, hz)); const roof = box(24.5, .3, 12.5, roofM, hx, 7.55, hz); g.add(roof);
  g.add(box(24.1, 1.1, 12.1, bandM, hx, 6.55, hz)); g.add(box(24.1, .12, 12.1, orgM, hx, 5.95, hz));
  g.add(box(24, .06, 12, std(0x23262b, .1, .8), hx, .03, hz));
  const win = new THREE.Mesh(new THREE.BoxGeometry(17, .9, .06), M.win); win.position.set(hx - 2.5, 4.1, hz + 6.03); g.add(win);
  const win2 = win.clone(); win2.position.set(hx + 12.03, 4.1, hz); win2.rotation.y = Math.PI / 2; win2.scale.x = .55; g.add(win2);
  g.add(box(5.4, .22, .12, M.orange, hx + 8.2, 4.3, hz + 6.05)); g.add(box(.22, 4.3, .12, M.orange, hx + 5.6, 2.15, hz + 6.05)); g.add(box(.22, 4.3, .12, M.orange, hx + 10.8, 2.15, hz + 6.05));
  const door = box(5, 4.1, .08, M.steel, hx + 8.2, 2.05, hz + 6.04); g.add(door);
  const roofBits = new THREE.Group(); g.add(roofBits);
  [-8, -3, 2, 7].forEach(x => roofBits.add(box(2.2, .22, 3, M.glass, hx + x, 7.8, hz + 2)));
  g.add(box(3, 2.2, 3, M.white, hx, 8.5, hz));
  const fans = [];
  [[-8, -3], [-2, -3], [4, -3], [10, -3]].forEach(([x, z]) => { const f = new THREE.Group(); f.position.set(hx + x, 7.7, hz + z); f.add(cyl(.7, .75, .35, M.steelD, 0, 0, 0, 20)); const bl = new THREE.Group(); bl.position.y = .22; for (let k = 0; k < 4; k++) { const b = box(.55, .03, .18, M.steel, .3, 0, 0); const h = new THREE.Group(); h.rotation.y = k * Math.PI / 2; h.add(b); bl.add(h); } f.add(bl); roofBits.add(f); fans.push(bl); });
  const pack = buildPack(0, true); pack.g.position.set(8.4, 0, -1); g.add(pack.g); pack.st.layers = 3; pack.reset();
  // MIAL feed mill on the farm: modular plant in a barn (hammer mill, dosing scale, horizontal mixer) + feed lines and animals
  const bx0 = 50, bz0 = -8;
  const barnW = ghost(0xd9dee4), barnR = ghost(0x8a949f);
  g.add(box(28, 4.2, 9, barnW, bx0, 2.1, bz0)); const barnRoof = new THREE.Group(); g.add(barnRoof);
  for (const sgn of [-1, 1]) { const r = box(28.6, .18, 5.4, barnR, bx0, 5.0, bz0 + sgn * 2.1); r.rotation.x = sgn * .4; barnRoof.add(r); }
  g.add(box(27, .05, 8.4, std(0xb9a889, 0, .95), bx0, .03, bz0));
  const barnShell = [barnW, barnR];
  const bMill = mkMill(g, 38.8, 0, bz0), bScale = mkScale(g, 43.2, 3.6, bz0), bMix = mkMixer(g, 43.2, .95, bz0);
  g.add(cyl(1.3, 1.3, 6, M.steel, bx0 - 16, 3.4, bz0, 28)); g.add(cone(1.3, 1.6, M.steel, bx0 - 16, 7.2, bz0, false, 28)); g.add(cone(1.3, 1.4, M.steel, bx0 - 16, .9, bz0, true, 28));
  const feedT = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, 3.6, 10), M.steel); feedT.rotation.z = Math.PI / 2; feedT.position.set(37.1, 3.0, bz0); g.add(feedT);
  const tubeB = (pts, r) => { const c = tubeCurve(pts, .4, false); g.add(shadow(new THREE.Mesh(new THREE.TubeGeometry(c, 30, r, 10, false), M.steel))); return c; };
  tubeB([V3(39.8, .8, bz0), V3(40.7, .8, bz0), V3(40.7, 3.6, bz0), V3(42.45, 3.6, bz0)], .12);
  tubeB([V3(44.0, .35, bz0), V3(45.3, .35, bz0), V3(45.3, 2.7, bz0), V3(46.5, 2.7, bz0)], .13);
  const lineZ = [-2.6, 0, 2.6], pans = [], PN = 36, LX0 = 46.5, LX1 = 62.5;
  lineZ.forEach(dz => { const l = cyl(.07, .07, LX1 - LX0, M.steel, (LX0 + LX1) / 2, 2.7, bz0 + dz, 10); l.rotation.z = Math.PI / 2; g.add(l); });
  g.add(box(.12, .12, 5.4, M.steel, LX0, 2.7, bz0));
  const panM = new THREE.InstancedMesh(new THREE.CylinderGeometry(.3, .3, .07, 16), M.orange, PN), o2 = new THREE.Object3D(); g.add(panM);
  lineZ.forEach((dz, li) => { for (let i = 0; i < 12; i++) { const px = LX0 + .9 + i * 1.3; g.add(cyl(.025, .025, 2.3, M.steelD, px, 1.5, bz0 + dz, 6)); o2.position.set(px, .36, bz0 + dz); o2.updateMatrix(); panM.setMatrixAt(li * 12 + i, o2.matrix); pans.push([px, bz0 + dz]); } });
  const birdN = 110, birdM = new THREE.InstancedMesh(new THREE.SphereGeometry(.2, 8, 6), std(0xf4f1ea, 0, .9), birdN), birds = Array.from({ length: birdN }, (_, i) => { const p = pans[(i * 7) % pans.length]; const a = Math.random() * 6.28, r = .45 + Math.random() * .9; return { x: p[0] + Math.cos(a) * r, z: p[1] + Math.sin(a) * r * .7, a, ph: Math.random() * 6.28 }; });
  g.add(birdM);
  const feedP = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), emi(0xee7319, 1.6)); g.add(feedP);
  const lineC = new THREE.LineCurve3(V3(LX0, 2.7, bz0), V3(LX1, 2.7, bz0)), lineFlow = mkPulses(g, lineC, 10);
  // case packer cell (MF TECNO) at the back of the hall
  const cz = -4.8, cpItems = new THREE.InstancedMesh(new THREE.BoxGeometry(.4, .12, .3), M.bag, 14), cartons = new THREE.InstancedMesh(new THREE.BoxGeometry(.55, .38, .42), std(0xb8895a, 0, .85), 8);
  g.add(box(8, .12, .5, M.steelD, 13.6, .9, cz)); g.add(box(6, .12, .7, M.steelD, 24.4, .9, cz));
  [[10, 17.5], [21.6, 27.2]].forEach(([a, b]) => { for (let x = a; x <= b; x += 1.8) for (const dz of [-.22, .22]) g.add(box(.08, .85, .08, M.steelD, x, .43, cz + dz)); });
  g.add(box(2.4, 2.2, 1.9, M.white, 19.4, 1.1, cz)); g.add(box(2.45, .35, 1.95, M.blue, 19.4, 2.3, cz)); g.add(box(1.6, .5, .06, M.screen, 19.4, 1.5, cz + .96));
  g.add(box(1.0, 1.2, .8, M.steelD, 17.9, 2.1, cz - .1)); for (let i = 0; i < 4; i++) g.add(box(.8, .04, .6, std(0xb8895a, 0, .85), 17.9, 1.6 + i * .06, cz - .1)); // flat-carton magazine
  g.add(box(.7, .5, .5, M.orange, 21.0, 2.5, cz + .3)); g.add(box(.4, .12, .4, M.dark, 21.0, 2.1, cz)); stackLight(g, 20.6, 2.45, cz - .7); // tape sealer, light
  const cpArm = box(.5, .12, .5, M.dark, 19.4, 2.7, cz); g.add(cpArm); g.add(box(.12, .9, .12, M.steel, 19.4, 3.2, cz));
  g.add(cpItems, cartons);
  g.add(box(1.2, .15, .8, M.wood, 28.6, .075, cz)); const stack = []; for (let i = 0; i < 6; i++) { const cb = box(.55, .38, .42, std(0xb8895a, 0, .85), 28.6 + (i % 2 ? .1 : -.1), .15 + .19 + i * .38, cz); cb.visible = false; g.add(cb); stack.push(cb); }
  // tubular conveyors
  const tubeMat = std(0xd5dde6, .9, .25, { transparent: true, opacity: 1 });
  const cA = tubeCurve([V3(-17, 14.2, 5), V3(-17, 14.2, -1), V3(3, 14.2, -1), V3(3, 13.7, -1)], 1.2, false);
  const cB = tubeCurve([V3(5.1, 10.4, -1), V3(19, 10.4, -1), V3(19, 9.7, -1)], 1, false);
  [cA, cB].forEach(c => g.add(shadow(new THREE.Mesh(new THREE.TubeGeometry(c, 120, .3, 14, false), tubeMat))));
  [-13, -7, -1.5].forEach(x => g.add(box(.22, 14.2, .22, M.steelD, x, 7.1, -1)));
  g.add(box(.22, 10.4, .22, M.steelD, 6.6, 5.2, -1));
  [12.5, 17].forEach(x => g.add(box(.2, 2.9, .2, M.steelD, x, 8.85, -1)));
  const pA = mkPulses(g, cA, 26), pB = mkPulses(g, cB, 20), flowA = mkFlow(g, cA), flowB = mkFlow(g, cB);
  // diverter branches down to each silo
  const branches = silos.map(([x, z]) => {
    const c = tubeCurve([V3(x, 14.2, -1), V3(x, 13.4, -1), V3(x, 13.2, z), V3(x, 12.6, z)], .6, false);
    g.add(shadow(new THREE.Mesh(new THREE.TubeGeometry(c, 30, .22, 12, false), tubeMat))); g.add(cyl(.38, .3, .4, M.orange, x, 14.0, -1, 14));
    return mkPulses(g, c, 6);
  });
  // pellet cooler next to the tower, fed from the press
  const tCool = mkCooler(g, 6, 3.2, 1.9, 6.4);
  g.add(shadow(new THREE.Mesh(new THREE.TubeGeometry(tubeCurve([V3(3, 11.7, -1), V3(3, 11.0, 1.9), V3(6, 11.0, 1.9), V3(6, 6.7, 1.9)], .6, false), 40, .2, 10, false), tubeMat)));
  stairs(g, V3(5.7, 0, -4.7), V3(5.7, 4.2, -1.9), .9); stairs(g, V3(5.7, 4.2, -1.9), V3(5.7, 8.4, -4.7), .9); // tower stairs
  g.add(shadow(new THREE.Mesh(new THREE.TubeGeometry(tubeCurve([V3(6, 6.95, 1.9), V3(6, 7.5, 1.9), V3(6.35, 7.5, 1.9), V3(6.35, 5.6, -6.4), V3(3.95, 5.6, -6.4)], .5, false), 60, .15, 10, false), M.steel))); // cooler air to the cyclone
  g.add(cyl(.3, .3, .6, M.blue, 3, .5, -6.4, 18)); g.add(box(.6, .2, .6, M.steelD, 3, .15, -6.4)); // cyclone airlock
  // coloured volumes: orange MIAL, blue MF TECNO; the focused function is brighter
  const mkVol = (color, b) => { const gr = new THREE.Group(), f = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .08, depthWrite: false })), e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .45 })); gr.add(f, e); gr.position.set(b[0], b[1], b[2]); gr.scale.set(b[3], b[4], b[5]); g.add(gr); return { f, e }; };
  const vols = {}; Object.entries(FUNCS).forEach(([k, fn]) => { vols[k] = fn.boxes.map(b => mkVol(fn.b === 'mial' ? MIAL_C : MF_C, b)); });
  // trucks and forklift
  const T1 = mkTruck(true), T2 = mkTruck(false); g.add(T1.g, T2.g);
  T1.g.position.set(-70, 0, 8.5); T2.g.position.set(70, 0, 11.9); T2.g.rotation.y = Math.PI;
  const cascade = box(.7, 1, .7, M.grain, -17, .5, 8.5); cascade.visible = false; g.add(cascade);
  const FK = mkForklift(), FKREST = V3(34, 0, 8.6), HX = 28.8, slotsX = [27.0, 28.8, 30.6];
  g.add(FK.g); FK.g.position.copy(FKREST); FK.g.rotation.y = Math.PI;
  const st = { cap: 20, view: 0, lev: [.55, .4, .7, .3], dumpIdx: 0, sec: 'none', heroOff: false, doorK: 0, focus: '*' };
  const tr = { s: 'wait', t: 0, next: 3 }, tr2 = { s: 'wait', t: 6, k: 0, p: 'idle', pt: 0, cur: null, loaded: [] };
  const ghostSet = (mats, on) => mats.forEach(mt => { mt.opacity = on ? .07 : 1; mt.depthWrite = !on; });
  const machines = { dos: [tMill, tMix, tScale], pro: [tPress, tCool], alv: [bMill, bMix, bScale] };
  const applySection = () => {
    const mode = st.heroOff ? 'none' : st.sec;
    ghostSet(shell, mode === 'hall'); roof.visible = roofBits.visible = mode !== 'hall';
    ghostSet(barnShell, mode === 'barn'); barnRoof.visible = mode !== 'barn';
    machines.alv.forEach(x => x.setGhost(mode === 'barn')); machines.dos.forEach(x => x.setGhost(mode === 'dos')); machines.pro.forEach(x => x.setGhost(mode === 'pro'));
    const ground = mode === 'ground', clip = ground || mode === 'tra';
    padMesh.material.opacity = ground ? .12 : 1; M.asphalt.opacity = ground ? .12 : 1; ug.visible = ground;
    ghostOn([elevM], ground); bkI.visible = ground;
    ghostOn([tubeMat], mode === 'tra'); flowA.set(mode === 'tra'); flowB.set(mode === 'tra');
    siloMats.forEach(mt => { mt.clippingPlanes = clip ? [clipP] : null; mt.needsUpdate = true; });
    fills.forEach(f => f.visible = clip); caps.forEach((c, i) => c.visible = clip && silos[i][1] < 0);
  };
  let ph = 0;
  const m = { g, origin: V3(ox, 0, 0), t: 0, target: 0, st,
    setCap(c) { st.cap = c; },
    setSection(mode) { st.sec = mode; applySection(); },
    hero(on) { if (on === st.heroOff) return; st.heroOff = on; applySection(); },
    setFocus(f) { st.focus = f; Object.entries(vols).forEach(([k, list]) => list.forEach(v => { const on = f === '*' ? .1 : (k === f ? .24 : .05); v.f.material.opacity = on; v.e.material.opacity = f === '*' ? .6 : (k === f ? 1 : .3); })); },
    mix() { return st.lev.reduce((a, b) => a + b, 0) / 4; },
    pack, vols,
    update(dt) {
      const cap = st.cap, flow = .35 + cap / 60 * 1.4;
      pA.update(dt, .018 * flow, Math.round(8 + cap / 60 * 18)); pB.update(dt, .022 * flow, Math.round(6 + cap / 60 * 14));
      pack.st.rate = 8 + cap / 60 * 17; pack.update(dt * 2.2);
      let hi = 0; st.lev.forEach((v, i) => { if (v > st.lev[hi]) hi = i; });
      st.lev[hi] = Math.max(.06, st.lev[hi] - dt * cap / 60 * .02);
      const interval = 24 / (1 + cap / 8);
      // intake truck: unloads into the pit, the conveyor above the silos fills the lowest one
      tr.t += dt;
      if (tr.s === 'wait') { T1.g.position.x = -70; T1.g.rotation.y = 0; if (tr.t >= tr.next) { tr.s = 'in'; tr.t = 0; let lo = 0; st.lev.forEach((v, i) => { if (v < st.lev[lo]) lo = i; }); st.dumpIdx = lo; } }
      else if (tr.s === 'in') { T1.g.position.x = lerp(-70, -12.1, sm(clamp(tr.t / 6, 0, 1))); if (tr.t >= 6) { tr.s = 'tip'; tr.t = 0; } }
      else if (tr.s === 'tip') { T1.trl.rotation.z = sm(clamp(tr.t / 3, 0, 1)) * .62; if (tr.t >= 3) { tr.s = 'dump'; tr.t = 0; } }
      else if (tr.s === 'dump') {
        cascade.visible = true; cascade.scale.y = 1.2; cascade.position.set(-17, .45, 8.5); T1.trl.userData.load.scale.y = Math.max(.05, 1 - tr.t / 7);
        st.lev[st.dumpIdx] = Math.min(.96, st.lev[st.dumpIdx] + dt * .016);
        if (tr.t >= 7) { tr.s = 'down'; tr.t = 0; cascade.visible = false; }
      }
      else if (tr.s === 'down') { T1.trl.rotation.z = (1 - sm(clamp(tr.t / 2.5, 0, 1))) * .62; if (tr.t >= 2.5) { tr.s = 'out'; tr.t = 0; } }
      else if (tr.s === 'out') { T1.g.rotation.y = Math.PI * sm(clamp(tr.t / 1.5, 0, 1)); T1.g.position.x = lerp(-12.1, -70, sm(clamp((tr.t - 1.5) / 6, 0, 1))); if (tr.t >= 7.5) { tr.s = 'wait'; tr.t = 0; tr.next = interval; T1.trl.userData.load.scale.y = 1; } }
      branches.forEach((b, i) => b.update(dt, .05, tr.s === 'dump' && st.dumpIdx === i ? 6 : 0));
      // dispatch: the forklift takes wrapped pallets from the end of the line and loads the truck
      tr2.t += dt; const F = FK.g, fpos = V3();
      if (tr2.s === 'wait') { T2.g.position.x = 70; F.position.lerp(FKREST, Math.min(1, dt * 2)); F.rotation.y = Math.PI; FK.fork.position.y = .15; if (tr2.t >= 2 + interval * .8) { tr2.s = 'in'; tr2.t = 0; } }
      else if (tr2.s === 'in') { T2.g.position.x = lerp(70, HX - .6, sm(clamp(tr2.t / 6, 0, 1))); if (tr2.t >= 6) { tr2.s = 'load'; tr2.t = 0; tr2.k = 0; tr2.p = 'goto'; tr2.pt = 0; tr2.loaded = []; } }
      else if (tr2.s === 'load') {
        tr2.pt += dt; const P = tr2.p;
        if (P === 'goto') { F.position.lerp(fpos.set(HX, 0, 9), Math.min(1, dt * 2.5)); if (F.position.distanceTo(fpos) < .06) { F.position.copy(fpos); tr2.p = 'idle'; tr2.pt = 0; } }
        else if (P === 'idle') { if (pack.hasReady()) { tr2.p = 'in'; tr2.pt = 0; } }
        else if (P === 'in') { F.position.z = lerp(9, .65, sm(clamp(tr2.pt / 3.2, 0, 1))); if (tr2.pt >= 3.2) { tr2.cur = pack.takeReady(); g.updateMatrixWorld(true); FK.fork.attach(tr2.cur.g); tr2.p = 'lift'; tr2.pt = 0; } }
        else if (P === 'lift') { FK.fork.position.y = .15 + sm(clamp(tr2.pt / .9, 0, 1)) * 1.3; if (tr2.pt >= .9) { tr2.p = 'out'; tr2.pt = 0; } }
        else if (P === 'out') { F.position.z = lerp(.65, 9, sm(clamp(tr2.pt / 3.2, 0, 1))); if (tr2.pt >= 3.2) { tr2.p = 'spin'; tr2.pt = 0; } }
        else if (P === 'spin') { F.rotation.y = Math.PI * (1 + sm(clamp(tr2.pt / 1.4, 0, 1))); if (tr2.pt >= 1.4) { tr2.p = 'shift'; tr2.pt = 0; } }
        else if (P === 'shift') { F.position.x = lerp(HX, slotsX[tr2.k], sm(clamp(tr2.pt / .8, 0, 1))); if (tr2.pt >= .8) { tr2.p = 'place'; tr2.pt = 0; } }
        else if (P === 'place') {
          FK.fork.position.y = lerp(1.45, 1.25, sm(clamp(tr2.pt / .5, 0, 1)));
          if (tr2.pt >= .5) { g.updateMatrixWorld(true); T2.g.attach(tr2.cur.g); tr2.loaded.push(tr2.cur); tr2.cur = null; tr2.p = 'drop'; tr2.pt = 0; }
        }
        else if (P === 'drop') { FK.fork.position.y = lerp(1.25, .15, sm(clamp(tr2.pt / .7, 0, 1))); if (tr2.pt >= .7) { tr2.p = 'back'; tr2.pt = 0; } }
        else if (P === 'back') {
          const kk = sm(clamp(tr2.pt / 1.2, 0, 1)); F.rotation.y = Math.PI * (2 - kk); F.position.x = lerp(slotsX[tr2.k], HX, kk);
          if (tr2.pt >= 1.2) { tr2.k++; tr2.pt = 0; if (tr2.k >= 3) { tr2.s = 'leave'; tr2.t = 0; } else tr2.p = 'idle'; }
        }
      }
      else if (tr2.s === 'leave') {
        T2.g.position.x = lerp(HX - .6, -70, sm(clamp(tr2.t / 7, 0, 1)));
        F.position.lerp(FKREST, Math.min(1, dt * 1.5)); F.rotation.y = Math.PI; FK.fork.position.y = .15;
        if (tr2.t >= 7) { tr2.s = 'wait'; tr2.t = 0; tr2.loaded.forEach(p => T2.g.remove(p.g)); tr2.loaded = []; }
      }
      // the roller door opens while the forklift is inside or crossing
      const open = tr2.s === 'load' && (tr2.p === 'in' || tr2.p === 'lift' || tr2.p === 'out' || (tr2.p === 'idle' && pack.hasReady()));
      st.doorK += ((open ? 1 : 0) - st.doorK) * Math.min(1, dt * 3); door.position.y = 2.05 + st.doorK * 3.6;
      // moving details
      ph += dt;
      lights.forEach((l, i) => { l.material.emissiveIntensity = .3 + (Math.sin(ph * 3 + i * 2) > 0 ? 1.4 : 0); });
      beacon.material.emissiveIntensity = Math.sin(ph * 5) > 0 ? 3 : .2;
      fans.forEach((b, i) => b.rotation.y += dt * (6 + i));
      bars.forEach((b, i) => { const h = Math.max(.05, st.lev[i] * 7.0); b.scale.y = h; b.position.y = h / 2; });
      const pos = steamGeo.attributes.position;
      for (let i = 0; i < steamN; i++) { sph[i] = (sph[i] + dt * .12) % 1; const a = sph[i]; pos.setXYZ(i, 3 + a * 3 + Math.sin(i * 5 + ph) * .3, 7.6 + a * 5, -6.4 + Math.cos(i * 3) * .4); }
      pos.needsUpdate = true;
      [tMill, tMix, tScale, tPress, tCool, bMill, bMix, bScale].forEach(x => x.update(dt, ph)); flowA.update(dt); flowB.update(dt); lineFlow.update(dt, .03, 9);
      if (bkI.visible) for (let i = 0; i < bkN; i++) { const u = (i / bkN + ph * .04) % 1, up = u < .5; bo.position.set(-17 + (up ? -.2 : .2), up ? lerp(-1.2, 14.6, u * 2) : lerp(14.6, -1.2, (u - .5) * 2), 5); bo.updateMatrix(); bkI.setMatrixAt(i, bo.matrix); } if (bkI.visible) bkI.instanceMatrix.needsUpdate = true;
      // product inside the silos (section view)
      fills.forEach((f, i) => { const h = Math.max(.05, st.lev[i] * 8); f.scale.y = h; f.position.set(silos[i][0], 3 + h / 2, silos[i][1]); const c = caps[i]; c.scale.y = h; c.position.y = 3 + h / 2; });
      // barn: birds peck around the pans, feed travels along the supply line
      for (let i = 0; i < birdN; i++) { const b = birds[i], w = Math.sin(ph * 2.2 + b.ph); o2.position.set(b.x + Math.cos(ph * .7 + b.ph) * .08, .2 + Math.max(0, Math.sin(ph * 5 + b.ph * 3)) * .05, b.z); o2.rotation.set(0, b.a + w * .3, 0); o2.scale.set(1, .9 + w * .05, 1.25); o2.updateMatrix(); birdM.setMatrixAt(i, o2.matrix); }
      birdM.instanceMatrix.needsUpdate = true; o2.rotation.set(0, 0, 0); o2.scale.set(1, 1, 1);
      { const u = (ph * .6) % 1; feedP.position.set(35.3 + u * 3.6, 3.0, bz0); }
      // case packer cell: pouches in, cartons out, stack grows
      for (let i = 0; i < 14; i++) { const x = 9.8 + (((ph * .9 + i * .6) % 8.4) ); o2.position.set(x, 1.04, cz); o2.updateMatrix(); cpItems.setMatrixAt(i, o2.matrix); }
      for (let i = 0; i < 8; i++) { const x = 21.8 + ((ph * .9 + i * .75) % 6); o2.position.set(x, 1.15, cz); o2.updateMatrix(); cartons.setMatrixAt(i, o2.matrix); }
      cpItems.instanceMatrix.needsUpdate = cartons.instanceMatrix.needsUpdate = true;
      cpArm.position.y = 2.2 + Math.max(0, Math.sin(ph * 4)) * .5;
      const sc2 = Math.floor((ph * .8) % 7); stack.forEach((cb, i) => cb.visible = i < sc2);
    } };
  m.setFocus('*'); applySection();
  return m;
}

/* ======================================================================
   MODEL 1 · MIAL CLEAN200 tubular chain conveyor, sizeable
   ====================================================================== */
const PRODUCTS = {
  pet: { name: 'Pet food', color: 0x8a5a2b, dens: .40, size: .075 },
  feed: { name: 'Mangime', color: 0xb99a5e, dens: .60, size: .055 },
  pellet: { name: 'Pellet', color: 0x6b4a2a, dens: .65, size: .06 },
  rice: { name: 'Riso', color: 0xf2ecdc, dens: .80, size: .05 },
  malt: { name: 'Malto', color: 0xd9b76a, dens: .55, size: .055 },
};
function buildConveyor(ox) {
  const g = new THREE.Group(); g.position.set(ox, 0, 0);
  pad(g, 80, 50, 3, 0);
  const tubeMat = std(0xd5dde6, .92, .24, { transparent: true, opacity: 1 });
  const plugMat = std(PRODUCTS.pet.color, 0, .85), fillMat = std(0x8a5a2b, 0, .9);
  const st = { Q: 30, H: 6, W: 5, level: .15, drain: false, prod: 'pet', cut: false, run: true, s: 0, acc: 0, fill: 0 };
  const hop = cyl(.82, .82, .04, std(0x8a5a2b, 0, .9), -2.3, 2.66, 0, 24);
  g.add(cyl(.9, .9, .6, M.white, -2.3, 2.4, 0, 28), cone(.9, 1.1, M.white, -2.3, 1.55, 0, true, 28), hop, box(2.2, .3, .3, M.steel, -1.2, 1.0, 0), box(1.4, .5, .5, M.dark, -1.45, 1.1, 0));
  for (let i = -3; i <= 3; i++) g.add(box(.04, .05, 1.6, M.dark, -2.3 + i * .22, 2.7, 0));
  g.add(box(.9, 1.9, .55, M.dark, -4.0, .95, -1.4)); g.add(box(.5, .32, .04, M.screen, -4.0, 1.4, -1.1));
  const o = new THREE.Object3D(), tg = V3(), Y = V3(0, 1, 0), Z = V3(0, 0, 1), pp = V3();
  let dyn = null, curve, L = 20, N = 0, NL = 0, discs, links, plugs, gr, fill, sx = 8, sr = 1.3, sh = 5, uA = 0, uB = .5, outlet = V3();
  const SP = .42, GN = 90, grS = Array.from({ length: GN }, () => ({ a: false, p: V3(), v: V3() }));
  const nearestU = p => { let best = 0, bd = 1e9; for (let i = 0; i < 1200; i++) { const u = i / 1200, d = curve.getPointAt(u).distanceToSquared(p); if (d < bd) { bd = d; best = u; } } return best; };
  function rebuild() {
    if (dyn) { g.remove(dyn); dyn.traverse(x => { if (x.geometry) x.geometry.dispose(); }); }
    dyn = new THREE.Group(); g.add(dyn);
    const H = st.H, W = st.W, top = .9 + H;
    curve = tubeCurve([V3(0, .9, 0), V3(0, top, 0), V3(W, top, 0), V3(W, .9, 0)], Math.min(.95, W / 2.5, H / 3), true); L = curve.getLength();
    const tube = shadow(new THREE.Mesh(new THREE.TubeGeometry(curve, 400, .235, 24, true), tubeMat)); tube.castShadow = !st.cut; dyn.add(tube); dyn.userData.tube = tube;
    const nc = Math.floor(L / 1.8);
    for (let i = 0; i < nc; i++) { const u = (i + .5) / nc; curve.getPointAt(u, pp); curve.getTangentAt(u, tg); const r = shadow(new THREE.Mesh(new THREE.TorusGeometry(.255, .03, 6, 22), M.steelD)); r.position.copy(pp); r.quaternion.setFromUnitVectors(Z, tg); dyn.add(r); }
    const win = (u0, u1) => { const pts = []; for (let i = 0; i <= 14; i++) pts.push(curve.getPointAt(u0 + (u1 - u0) * i / 14)); const c = new THREE.CatmullRomCurve3(pts); dyn.add(new THREE.Mesh(new THREE.TubeGeometry(c, 20, .245, 20, false), std(0xbfe0ff, 0, .05, { transparent: true, opacity: .22, depthWrite: false }))); };
    uA = nearestU(V3(0, 1.6, 0)); uB = nearestU(V3(W - .3, top, 0));
    const uS = nearestU(V3(0, .9 + H * .3, 0)), uS2 = nearestU(V3(0, .9 + H * .68, 0)); win(uS - .012, uS + .012); win(uS2 - .012, uS2 + .012);
    dyn.add(box(W + 3.4, .16, 1.2, M.steelD, W / 2, .08, 0));
    for (const cx of [-.85, W + .85]) { dyn.add(box(.16, top + .8, .3, M.steelD, cx, (top + .8) / 2, 0)); for (let y = 1.2; y < top; y += 1.6) dyn.add(box(.7, .1, .3, M.steelD, cx + (cx < 0 ? .35 : -.35), y, 0)); }
    dyn.add(box(W + 1.9, .12, .12, M.steelD, W / 2, top + .8, 0));
    const rz = (mesh) => { mesh.rotation.x = Math.PI / 2; return mesh; };
    dyn.add(rz(cyl(.55, .55, .55, M.blue, W, top, 0, 28)));
    dyn.add(box(.9, .9, .7, M.orange, W, top, -.85)); dyn.add(rz(cyl(.3, .3, 1.1, M.blue, W, top, -1.7, 22))); dyn.add(box(.35, .3, .35, M.dark, W, top + .38, -1.7));
    dyn.add(rz(cyl(.34, .34, .12, M.dark, W, top, -2.3, 22)));
    dyn.add(rz(cyl(.5, .5, .5, M.white, 0, .9, 0, 28))); for (const dz of [-.3, .3]) dyn.add(cyl(.03, .03, .8, M.steel, 0, .5, dz, 8));
    NL = Math.floor(L / .12); links = new THREE.InstancedMesh(new THREE.BoxGeometry(.1, .05, .035), std(0x59636e, .9, .35), NL); dyn.add(links);
    N = Math.floor(L / SP);
    discs = new THREE.InstancedMesh(new THREE.CylinderGeometry(.165, .165, .035, 14), std(0xe8ecef, .1, .5), N); discs.castShadow = true; dyn.add(discs);
    plugs = new THREE.InstancedMesh(new THREE.CylinderGeometry(.19, .19, 1, 14), plugMat, N); dyn.add(plugs);
    sx = W + 2.5; sh = Math.max(2.2, H - .7);
    dyn.add(cyl(sr, sr, sh, M.glass, sx, sh / 2 + .4, 0, 36, true)); dyn.add(cyl(sr + .05, sr + .05, .12, M.steelD, sx, sh + .4, 0, 36, true));
    dyn.add(cyl(sr + .02, sr * .35, .9, M.steel, sx, .45, 0, 36)); dyn.add(box(.2, .5, .2, M.steelD, sx - 1, .2, 0));
    fill = shadow(new THREE.Mesh(new THREE.CylinderGeometry(sr - .04, sr - .04, 1, 28), fillMat)); dyn.add(fill);
    for (let i = 1; i < 5; i++) dyn.add(box(.05, .02, .05, M.label, sx + sr + .03, .4 + sh * i / 5, 0));
    const chute = box(.9, .08, .5, M.steelD, W + .55, top - .35, 0); chute.rotation.z = -.5; dyn.add(chute);
    outlet = curve.getPointAt(uB, V3());
    gr = new THREE.InstancedMesh(new THREE.SphereGeometry(PRODUCTS[st.prod].size * .9, 6, 5), plugMat, GN); dyn.add(gr);
    st.cb && st.cb();
  }
  const m = { g, origin: V3(ox, 0, 0), t: 0, target: 0, st, PRODUCTS, rebuild, chainLen: () => L, discCount: () => N,
    setProduct(k) { st.prod = k; const p = PRODUCTS[k]; plugMat.color.setHex(p.color); fillMat.color.setHex(p.color); hop.material.color.setHex(p.color); gr.geometry.dispose(); gr.geometry = new THREE.SphereGeometry(p.size * .9, 6, 5); },
    setCut(on) { st.cut = on; tubeMat.opacity = on ? .13 : 1; tubeMat.depthWrite = !on; dyn.userData.tube.castShadow = !on; },
    update(dt) {
      if (!st.run) return;
      const v = .865; st.s = (st.s + v * dt) % SP; st.fill = st.Q / 60 * .64;
      for (let i = 0; i < N; i++) {
        const u = ((i * SP + st.s) / L) % 1; curve.getPointAt(u, pp); curve.getTangentAt(u, tg);
        o.position.copy(pp); o.quaternion.setFromUnitVectors(Y, tg); o.scale.set(1, 1, 1); o.updateMatrix(); discs.setMatrixAt(i, o.matrix);
        const inLoad = u >= uA && u <= uB && st.fill > .01, ul = (u + SP * .5 / L) % 1; curve.getPointAt(ul, pp);
        o.position.copy(pp); o.scale.set(inLoad ? st.fill / .64 * .95 : 0, inLoad ? SP * .86 * Math.min(1, st.fill / .64 + .35) : 0, inLoad ? st.fill / .64 * .95 : 0); o.updateMatrix(); plugs.setMatrixAt(i, o.matrix);
      }
      for (let i = 0; i < NL; i++) { const u = ((i * .12 + st.s) / L) % 1; curve.getPointAt(u, pp); curve.getTangentAt(u, tg); o.position.copy(pp); o.quaternion.setFromUnitVectors(V3(1, 0, 0), tg); if (i % 2) o.rotateX(Math.PI / 2); o.scale.set(1, 1, 1); o.updateMatrix(); links.setMatrixAt(i, o.matrix); }
      discs.instanceMatrix.needsUpdate = plugs.instanceMatrix.needsUpdate = links.instanceMatrix.needsUpdate = true;
      st.acc += dt * (st.Q / 60) * 38;
      while (st.acc >= 1) { st.acc -= 1; const s = grS.find(x => !x.a); if (!s) break; s.a = true; s.p.set(outlet.x + .1 + Math.random() * .15, outlet.y - .25, (Math.random() - .5) * .25); s.v.set(1.1 + Math.random() * .5, 0, (Math.random() - .5) * .3); }
      const surf = .4 + st.level * (sh - .5);
      grS.forEach((s, i) => {
        if (s.a) { s.v.y -= 9.8 * dt; s.p.addScaledVector(s.v, dt); if (s.p.y < surf && s.p.x > sx - sr + .1) s.a = false; if (s.p.y < 0) s.a = false; }
        o.position.copy(s.a ? s.p : V3(0, -50, 0)); o.quaternion.identity(); o.scale.set(1, 1, 1); o.updateMatrix(); gr.setMatrixAt(i, o.matrix);
      });
      gr.instanceMatrix.needsUpdate = true;
      if (st.drain) { st.level -= dt * .35; if (st.level <= .12) st.drain = false; } else { st.level += dt * (st.Q / 60) * .02 * 8 * (4 / Math.max(2, sh)); if (st.level >= .96) st.drain = true; }
      fill.scale.y = Math.max(.01, st.level * (sh - .5)); fill.position.set(sx, .4 + fill.scale.y / 2, 0);
    } };
  rebuild(); m.setProduct('pet');
  return m;
}

/* ======================================================================
   MODEL 2 · MF TECNO end of line, configurable
   ====================================================================== */
const FORMATS = {
  10: { kg: 10, W: .42, H: .12, D: .28, per: 9, slot: i => V3((i % 3 - 1) * .4, 0, (Math.floor(i / 3) - 1) * .26) },
  25: { kg: 25, W: .6, H: .15, D: .4, per: 4, slot: i => V3((i % 2 ? .3 : -.3), 0, (i >> 1 ? .2 : -.2)) },
};
function buildPack(ox, embed = false) {
  const g = new THREE.Group(); g.position.set(ox, 0, 0);
  if (!embed) pad(g, 90, 50, 11, 0);
  const BL0 = -.6, BL1 = 9.0, BY = 1.0, PX = 12.2, WX = 16.8, EX = 21, ARCH = 4.2, PUSH = 5.4;
  g.add(box(BL1 - BL0, .14, .62, M.steelD, (BL0 + BL1) / 2, BY, 0));
  const stripe = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 16; const x = c.getContext('2d'); x.fillStyle = '#12161c'; x.fillRect(0, 0, 64, 16); x.fillStyle = '#26303c'; x.fillRect(0, 0, 4, 16); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set((BL1 - BL0) / .4, 1); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const beltTop = new THREE.Mesh(new THREE.PlaneGeometry(BL1 - BL0, .56), new THREE.MeshStandardMaterial({ map: stripe, roughness: .85 })); beltTop.rotation.x = -Math.PI / 2; beltTop.position.set((BL0 + BL1) / 2, BY + .075, 0); beltTop.receiveShadow = true; g.add(beltTop);
  for (const s of [-1, 1]) g.add(box(BL1 - BL0, .14, .04, M.steel, (BL0 + BL1) / 2, BY + .12, s * .33));
  for (let x = BL0 + .3; x < BL1; x += 1.8) for (const s of [-1, 1]) g.add(box(.09, BY - .05, .09, M.steelD, x, (BY - .05) / 2, s * .26));
  // bagger: multihead weigher, forming tube, jaws
  const bx = .2;
  [[-.75, -.6], [.75, -.6], [-.75, .6], [.75, .6]].forEach(([a, b]) => g.add(box(.14, 5.2, .14, M.steel, bx + a, 2.6, b)));
  g.add(box(1.8, .9, 1.4, M.white, bx, 4.3, 0)); g.add(box(1.8, .12, 1.4, M.steelD, bx, 5.25, 0)); g.add(box(1.6, .1, 1.3, M.orange, bx, 4.75, 0));
  g.add(cyl(.5, .5, .6, M.blue, bx, 6.0, 0, 28));
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; g.add(cone(.16, .5, M.white, bx + Math.cos(a) * .95, 5.6, Math.sin(a) * .95, true, 14)); g.add(cyl(.13, .13, .4, M.steel, bx + Math.cos(a) * .95, 5.95, Math.sin(a) * .95, 12)); }
  g.add(ring(.95, .05, M.steel, bx, 5.72, 0));
  g.add(cyl(.28, .28, 1.9, M.steel, bx, 3.3, 0, 20));
  const jaws = box(1.1, .42, .9, M.dark, bx, 2.5, 0); g.add(jaws);
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 + .3; g.add(box(.2, .22, .18, M.white, bx + Math.cos(a) * .55, 4.9, Math.sin(a) * .55)); } // pool hoppers
  g.add(cone(.35, .5, M.steel, bx, 6.35, 0, false, 20)); g.add(cyl(.12, .12, .6, M.steel, bx, 6.6, 0, 12)); // distribution cone and feed
  const reel = cyl(.55, .55, .34, M.wrap, bx - 1.6, 3.4, 0, 28); reel.rotation.x = Math.PI / 2; g.add(reel); g.add(rot(cyl(.1, .1, .5, M.steelD, bx - 1.6, 3.4, 0, 10), 'x', Math.PI / 2)); g.add(box(.1, 1.1, .1, M.steelD, bx - 1.6, 2.85, .3)); // film reel
  g.add(cone(.34, .7, M.steel, bx, 3.0, 0, true, 4)); g.add(box(.5, .08, .5, M.steelD, bx, 3.35, 0)); // forming collar
  g.add(box(.12, 2.4, .12, M.steelD, bx + 1.0, 1.9, -.75)); stackLight(g, bx + 1.0, 3.05, -.75);
  g.add(box(.7, .8, .14, M.dark, bx + 1.2, 1.9, .85)); g.add(box(.5, .4, .04, M.screen, bx + 1.2, 2.0, .93));
  // checkweigher + metal detector tunnel, reject pusher and bin
  for (const s of [-1, 1]) g.add(box(.5, .9, .08, M.white, ARCH, BY + .55, s * .42));
  g.add(box(.5, .12, .92, M.white, ARCH, BY + 1.02, 0)); g.add(box(.5, .05, .92, M.blue, ARCH, BY + 1.1, 0));
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), emi(0x2997ff, 1.6)); lamp.position.set(ARCH, BY + 1.22, 0); g.add(lamp);
  g.add(box(.4, .16, .06, M.screen, ARCH, BY + .9, -.5));
  const pusher = box(.2, .12, .12, M.orange, PUSH, BY + .22, -.62); g.add(pusher);
  g.add(box(.3, .3, .3, M.dark, PUSH, BY + .22, -.85));
  g.add(box(.9, .5, .7, M.steelD, PUSH + .2, BY - .12, 1.05)); g.add(box(.8, .04, .6, M.dark, PUSH + .2, BY + .13, 1.05));
  // palletizer portal with safety guards
  [[-1.9, -1.5], [1.9, -1.5], [-1.9, 1.5], [1.9, 1.5]].forEach(([a, b]) => g.add(box(.18, 4.8, .18, M.steel, PX + a, 2.4, b)));
  [-1.5, 1.5].forEach(z => g.add(box(6.0, .22, .22, M.orange, PX - .5, 4.8, z)));
  g.add(box(.18, .18, 3.2, M.orange, PX - 2.4, 4.8, 0)); g.add(box(.18, .18, 3.2, M.orange, PX + 1.9, 4.8, 0));
  g.add(box(.5, .3, .6, M.steelD, PX, 4.8, 0));
  g.add(box(.04, 1.8, 3.0, M.glass, PX + 2.05, .95, 0)); g.add(box(3.8, 1.8, .04, M.glass, PX, .95, 1.62)); g.add(box(3.8, 1.8, .04, M.glass, PX, .95, -1.62));
  const carr = new THREE.Group(); g.add(carr);
  const mast = box(.12, 1, .12, M.steel, 0, 0, 0); carr.add(mast);
  const grip = new THREE.Group(); carr.add(grip);
  grip.add(box(.72, .07, .5, M.dark, 0, 0, 0)); grip.add(box(.72, .02, .06, M.orange, 0, -.045, .21)); grip.add(box(.72, .02, .06, M.orange, 0, -.045, -.21));
  for (let i = 0; i < 5; i++) g.add(box(1.2, .15, .8, M.wood, PX - 3.4, .075 + i * .16, 1.0)); // pallet magazine
  for (const sx of [-1.95, 1.95]) g.add(box(.06, 1.8, .1, M.orange, PX + sx, .95, 1.55)); // light curtain
  g.add(box(.9, 2.0, .6, M.white, PX + 2.6, 1.0, -1.1)); g.add(box(.5, .35, .04, M.screen, PX + 2.6, 1.35, -.79)); stackLight(g, PX + 2.6, 2.0, -1.1); // cabinet
  for (const dz of [-.45, .45]) g.add(box(.12, .12, 2.6, M.steelD, PX, 4.55, dz).rotateY(Math.PI / 2)); // gantry slides
  // wrapper and exit roller
  const turn = cyl(.95, .95, .1, M.steel, WX, .05, 0, 40); g.add(turn); g.add(ring(.96, .03, M.orange, WX, .1, 0));
  g.add(box(.18, 3.4, .18, M.orange, WX + 1.6, 1.7, 0)); g.add(box(.5, .1, .5, M.steelD, WX + 1.6, .05, 0));
  g.add(box(.7, 1.5, .5, M.white, WX + 1.9, .75, -1.0)); g.add(box(.4, .3, .04, M.screen, WX + 1.9, 1.2, -.74)); stackLight(g, WX + 1.9, 1.5, -1.0); // wrapper cabinet
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.add(cyl(.05, .05, .08, M.dark, WX + Math.cos(a) * .8, .13, Math.sin(a) * .8, 8)); } // turntable rollers
  const wcar = new THREE.Group(); g.add(wcar); wcar.add(box(.9, .3, .34, M.dark, -.5, 0, 0)); wcar.add(cyl(.12, .12, .55, M.wrap, -.95, 0, 0, 14));
  const film = new THREE.Mesh(new THREE.CylinderGeometry(.74, .74, 1, 36, 1, true), M.film); g.add(film);
  g.add(box(3.6, .14, 1.1, M.steelD, EX - .6, .55, 0));
  for (let i = 0; i < 9; i++) { const r = cyl(.05, .05, 1.0, M.steel, EX - 2.2 + i * .4, .64, 0, 8); r.rotation.x = Math.PI / 2; g.add(r); }
  const FK = mkForklift(); if (!embed) { g.add(FK.g); FK.g.rotation.y = -Math.PI / 2; FK.g.position.set(EX + 14, 0, 0); }
  const st = { rate: 12, run: true, fmt: 25, layers: 5, bags: [], fx: [], pallets: [], rob: { ph: -1, t: 0, bag: null, pos: V3(PX, 2.6, 0) }, sp: 0, done: 0, total: 0, rej: 0, times: [], clock: 0, blocked: false, jaw: 0, pusher: 0, lampT: 0, fk: { s: 'away', t: 0, p: null } };
  const legs = [.65, .25, .25, .7, .25, .3], CYCLE = legs.reduce((a, b) => a + b, 0);
  const F = () => FORMATS[st.fmt], CAP = () => F().per * st.layers, PH = () => .15 + st.layers * F().H;
  let bagGeo, labGeo;
  const mkBag = () => { const b = new THREE.Mesh(bagGeo, M.bag); b.castShadow = b.receiveShadow = true; const l = new THREE.Mesh(labGeo, M.label); l.rotation.x = -Math.PI / 2; l.position.y = F().H / 2 + .002; b.add(l); return b; };
  const setFmt = () => { const f = F(); bagGeo = new THREE.BoxGeometry(f.W, f.H, f.D); labGeo = new THREE.PlaneGeometry(f.W * .5, f.D * .4); };
  const slotP = (l, i) => { const f = F(), v = f.slot(i); if (l % 2) { v.x = -v.x; v.z = -v.z; } v.y = .15 + l * f.H + f.H / 2; return v; };
  const mkPallet = () => { const gp = new THREE.Group(); gp.add(box(1.2, .15, .8, M.wood, 0, .075, 0)); const b = { g: gp, n: 0, state: 'build', t: 0 }; gp.position.set(PX, 0, 0); g.add(gp); return b; };
  const L = BL1 - BL0 - .4, BAGV = .6, BX = BL1 - .35;
  const wps = sv => [V3(BX, 2.5, 0), V3(BX, BY + .075 + F().H + .06, 0), V3(BX, 2.5, 0), V3(sv.x, 2.5, sv.z), V3(sv.x, sv.y + .06, sv.z), V3(sv.x, 2.5, sv.z)];
  const buildP = () => st.pallets.find(p => p.state === 'build');
  const wrapP = () => st.pallets.find(p => p.state === 'wrap' || p.state === 'toWrap');
  const setGrip = v => { carr.position.set(v.x, 4.8, v.z); grip.position.set(0, v.y - 4.8, 0); mast.scale.y = 4.8 - v.y; mast.position.y = (v.y - 4.8) / 2; };
  const xOf = s => BL0 + .8 + s;
  const m = { g, origin: V3(ox, 0, 0), t: 0, target: 0, st, CYCLE, CAP, PH,
    reset() {
      st.pallets.forEach(p => g.remove(p.g)); st.bags.forEach(b => g.remove(b.m)); st.fx.forEach(b => g.remove(b.m)); st.fx = []; st.bags = [];
      if (st.fk.p) { FK.fork.remove(st.fk.p.g); }
      setFmt(); st.pallets = [mkPallet()]; st.rob.ph = -1; st.rob.bag = null; st.rob.pos.set(PX, 2.6, 0); setGrip(st.rob.pos);
      st.done = 0; st.total = 0; st.rej = 0; st.times = []; st.clock = 0; film.material.opacity = 0; st.fk.s = 'away'; st.fk.p = null; FK.g.position.x = EX + 14; FK.fork.position.y = .15; st.sp = 0;
    },
    update(dt) {
      if (!st.run) return;
      st.clock += dt; if (st.bags.length) stripe.offset.x -= BAGV * dt / .4;
      st.sp += dt; const iv = 60 / st.rate; st.blocked = false;
      if (st.sp >= iv) { const last = st.bags[st.bags.length - 1]; if (!last || last.s > .75) { const bg = mkBag(); g.add(bg); st.bags.push({ m: bg, s: 0, fall: 0, rej: Math.random() < .045, done: false }); st.sp = 0; st.jaw = 1; } else { st.sp = iv; st.blocked = true; } }
      jaws.scale.y = 1 - st.jaw * .5; st.jaw = Math.max(0, st.jaw - dt * 4);
      for (let i = 0; i < st.bags.length; i++) {
        const b = st.bags[i], lim = i === 0 ? L : st.bags[i - 1].s - (F().W + .12);
        b.fall = Math.min(1, b.fall + dt * 4.5); b.s = Math.min(b.s + BAGV * dt, Math.max(lim, b.s));
        b.m.position.set(xOf(b.s), lerp(2.1, BY + .075 + F().H / 2, eo(b.fall)), 0);
        if (b.rej && !b.done && xOf(b.s) >= PUSH - .05) { b.done = true; st.bags.splice(i, 1); i--; b.t = 0; st.fx.push(b); st.pusher = 1; st.lampT = 1.2; st.rej++; }
      }
      for (let i = st.fx.length - 1; i >= 0; i--) { const b = st.fx[i]; b.t += dt; const k = sm(clamp(b.t / .6, 0, 1)); b.m.position.set(PUSH + .2, lerp(BY + .075 + F().H / 2, BY + .3, k), lerp(0, 1.05, k)); b.m.rotation.y = k * .6; if (b.t > 4) { g.remove(b.m); st.fx.splice(i, 1); } }
      pusher.position.z = -.62 + sm(clamp(st.pusher, 0, 1)) * .55; st.pusher = Math.max(0, st.pusher - dt * 2.2);
      st.lampT = Math.max(0, st.lampT - dt); lamp.material.color.setHex(st.lampT > 0 ? 0xff453a : 0x2997ff); lamp.material.emissive.setHex(st.lampT > 0 ? 0xff453a : 0x2997ff);
      const r = st.rob, bp = buildP();
      if (r.ph === -1 && bp && bp.n < CAP() && st.bags[0] && st.bags[0].s >= L - .02 && st.bags[0].fall >= 1) {
        r.bag = st.bags[0]; r.ph = 0; r.t = 0; r.from = r.pos.clone(); r.grab = false;
        const sl = slotP(Math.floor(bp.n / F().per), bp.n % F().per); r.slotP = sl; r.wp = wps(V3(PX + sl.x, sl.y, sl.z)); r.bp = bp;
      }
      if (r.ph >= 0) {
        r.t += dt; const dur = legs[r.ph]; r.pos.lerpVectors(r.from, r.wp[r.ph], sm(clamp(r.t / dur, 0, 1)));
        if (r.grab) r.bag.m.position.set(r.pos.x, r.pos.y - .12, r.pos.z);
        if (r.t >= dur) {
          r.t = 0; r.from = r.wp[r.ph].clone();
          if (r.ph === 1) { r.grab = true; st.bags.shift(); }
          if (r.ph === 4) { g.remove(r.bag.m); r.bp.g.add(r.bag.m); r.bag.m.position.copy(r.slotP); r.bp.n++; st.total++; st.times.push(st.clock); r.bag = null; r.grab = false; }
          r.ph++; if (r.ph >= legs.length) r.ph = -1;
        }
      }
      setGrip(r.pos);
      st.pallets.forEach(p => {
        p.t += dt;
        if (p.state === 'build') { p.g.scale.setScalar(.2 + .8 * eo(clamp(p.t / .5, 0, 1))); p.g.position.set(PX, 0, 0); if (p.n >= CAP() && r.ph === -1) { p.state = wrapP() ? 'wait' : 'toWrap'; p.t = 0; } }
        else if (p.state === 'wait') { if (!wrapP()) { p.state = 'toWrap'; p.t = 0; } }
        if (p.state === 'toWrap') { const k = sm(clamp(p.t / 1.3, 0, 1)); p.g.position.set(lerp(PX, WX, k), 0, 0); if (k >= 1) { p.state = 'wrap'; p.t = 0; } }
        if (p.state === 'wrap') {
          const T = 4.4, k = clamp(p.t / T, 0, 1), ph = PH(); p.g.position.set(WX, .1, 0); p.g.rotation.y = k * Math.PI * 6; turn.rotation.y = p.g.rotation.y;
          wcar.position.set(WX + 1.6, .25 + (1 - Math.abs(k * 2 - 1)) * ph * .85 + .1, 0);
          film.scale.y = ph + .05; film.position.set(WX, .1 + (ph + .05) / 2, 0); film.material.opacity = .42 * sm(clamp(k * 2.2, 0, 1));
          if (k >= 1 && !(embed && st.pallets.some(q => q !== p && (q.state === 'exit' || q.state === 'ready')))) { p.state = 'exit'; p.t = 0; st.done++; wcar.position.y = .35; p.g.rotation.y = 0; p.g.add(box(1.14, PH() + .05, .76, M.wrap, 0, PH() / 2 + .05, 0)); }
        }
        if (p.state === 'exit') { const k = sm(clamp(p.t / 1.5, 0, 1)); p.g.position.set(lerp(WX, EX - .6, k), .1, 0); film.material.opacity = .42 * (1 - k); if (k >= 1) { p.state = 'ready'; p.t = 0; } }
      });
      if (!st.pallets.some(p => p.state === 'build' || p.state === 'wait')) st.pallets.push(mkPallet());
      const fk = st.fk, rp = embed ? null : st.pallets.find(p => p.state === 'ready'); fk.t += dt;
      if (embed) { /* the plant forklift takes the pallets */ } else if (fk.s === 'away') { FK.g.position.x = EX + 14; if (rp) { fk.s = 'in'; fk.t = 0; fk.p = rp; rp.state = 'picked'; } }
      else if (fk.s === 'in') { FK.g.position.x = lerp(EX + 14, EX + 1.6, sm(clamp(fk.t / 4, 0, 1))); FK.fork.position.y = .15; if (fk.t >= 4) { fk.s = 'lift'; fk.t = 0; } }
      else if (fk.s === 'lift') { FK.fork.position.y = .15 + sm(clamp(fk.t / .9, 0, 1)) * .5; if (fk.t >= .9) { g.updateMatrixWorld(true); FK.fork.attach(fk.p.g); fk.s = 'out'; fk.t = 0; } }
      else if (fk.s === 'out') { FK.g.position.x = lerp(EX + 1.6, EX + 14, sm(clamp(fk.t / 4, 0, 1))); if (fk.t >= 4) { FK.fork.remove(fk.p.g); st.pallets = st.pallets.filter(p => p !== fk.p); fk.s = 'away'; fk.t = 0; fk.p = null; FK.fork.position.y = .15; } }
      st.times = st.times.filter(t => st.clock - t < 30);
    },
    hasReady() { return st.pallets.some(p => p.state === 'ready'); },
    takeReady() { const p = st.pallets.find(q => q.state === 'ready'); st.pallets = st.pallets.filter(q => q !== p); return p; },
    eff() { const w = Math.min(30, st.clock); return w < 6 ? null : st.times.length / w * 60; },
    onPallet() { const p = buildP(); return p ? p.n : (st.pallets.find(q => q.state === 'wait') ? CAP() : 0); },
  };
  setFmt(); st.pallets.push(mkPallet());
  return m;
}

/* ---------- build ---------- */
const STEP = 110;
const mPlant = buildPlant(0), mConv = buildConveyor(STEP), mPack = buildPack(STEP * 2);
const models = [mPlant, mConv, mPack];
models.forEach(m => scene.add(m.g));

/* ---------- labels ---------- */
const labelHost = $('#labels');
function mkLabel(p, t) { const el = document.createElement('div'); el.className = 'tag'; el.textContent = t; labelHost.appendChild(el); return { p, el }; }
const Bt = (m, c, d, az, el, labels = []) => ({ m, c: m.origin.clone().add(c), d, az, el, labels: labels.map(([p, t, fn, main, br]) => { const l = mkLabel(m.origin.clone().add(V3(...p)), t); if (br) l.el.classList.add(br); return Object.assign(l, { fn, main }); }) });
const V0 = VIEWS[0];
const beats = [
  Bt(mPlant, V3(...V0.c), V0.dist, V0.az, V0.el),
  Bt(mPlant, V3(...V0.c), V0.dist, V0.az, V0.el, [
    [[-17, 16.6, 5], 'Elevatore a tazze', 'ric', 1, 'mial'], [[-17, -.6, 8.5], 'Fossa di scarico', 'ric', 0, 'mial'],
    [[-6.6, 13.4, -1], 'Silos di stoccaggio', 'sto', 1, 'mial'], [[-9, 6, -4.6], 'Prodotto e livello', 'sto', 0, 'mial'],
    [[-7, 15, -1], 'Trasportatore tubolare con dischi', 'tra', 1, 'mial'], [[-9, 13.6, -1], 'Deviatore verso il silo', 'tra', 0, 'mial'], [[-17, 16.6, 5], 'Elevatore a tazze', 'tra', 0, 'mial'],
        [[-1.2, 3.4, 3.8], 'Mulino a martelli', 'dos', 1, 'mial'], [[2.6, 6.3, -1], 'Miscelatore orizzontale', 'dos', 0, 'mial'], [[3, 10.9, -1], 'Scala di dosaggio', 'dos', 0, 'mial'],
    [[3, 15, -1], 'Pressa per pellet', 'pro', 1, 'mial'], [[6, 7.4, 1.9], 'Raffreddatore a controcorrente', 'pro', 0, 'mial'], [[3, 7.8, -6.4], 'Ciclone', 'pro', 0, 'mial'], [[6, 3.6, 1.9], 'Valvola stellare', 'pro', 0, 'mial'],
    [[50, 6, -8], 'Mangimificio in allevamento', 'alv', 1, 'mial'], [[38.8, 3.3, -8], 'Mulino a martelli', 'alv', 0, 'mial'], [[43.2, 5.3, -8], 'Scala di dosaggio e miscelatore', 'alv', 0, 'mial'], [[34, 8.4, -8], 'Silo', 'alv', 0, 'mial'], [[56, 3.2, -8], 'Linee di alimentazione', 'alv', 0, 'mial'],
    [[8.6, 7.3, -1], 'Pesatrice multitesta', 'ins', 1, 'mf'], [[8.6, 2.5, -1], 'Insaccatrice a bocca aperta', 'ins', 0, 'mf'], [[12.6, 2.6, -1], 'Controllo peso e metal detector', 'ins', 0, 'mf'],
    [[20.6, 5.5, -1], 'Pallettizzatore cartesiano', 'pal', 1, 'mf'], [[25.2, 3.5, -1], 'Avvolgitore pallet', 'pal', 0, 'mf'], [[17.2, 1.7, 0], 'Magazzino pallet vuoti', 'pal', 0, 'mf'],
    [[19.4, 3.9, -4.8], 'Cartonatrice', 'car', 1, 'mf'],
    [[28.8, 3.4, 1.2], 'Carrello elevatore', 'spe', 1, 'mf'], [[28.2, 3.7, 12], 'Camion', 'spe', 0, 'mf']]),
  Bt(mConv, V3(3.5, 4.2, 0), 26, -24, 11, [[[0, 5.6, 0], 'Catena con dischi'], [[-2.3, 3.4, 0], 'Tramoggia di carico'], [[5, 7.6, -.8], 'Gruppo di trascinamento'], [[7.5, 5.4, 0], 'Silo di arrivo']]),
  Bt(mPack, V3(8.6, 2.2, 0), 36, -22, 17, [[[.2, 7.0, 0], 'Insaccatrice'], [[4.2, 2.4, 0], 'Controllo peso e metal detector'], [[5.6, 1.6, 1.05], 'Scarto'], [[12.2, 5.1, 0], 'Pallettizzatore'], [[16.8, 3.2, 0], 'Fasciatrice'], [[22.6, 1.8, 0], 'Carrello']]),
];
beats.forEach((b, i) => { (b.m.beats ||= []).push(i); });

/* ---------- scroll mapping ---------- */
let anchors = [], vw = innerWidth, vh = innerHeight, ranges = [], secR = {};
function measure() {
  vw = innerWidth; vh = innerHeight;
  anchors = [...document.querySelectorAll('[data-beat]')].map(el => { const r = el.getBoundingClientRect(), top = r.top + scrollY, bot = r.bottom + scrollY; return el.classList.contains('tall') ? { i: +el.dataset.beat, y0: top + vh / 2, y1: Math.max(top + vh / 2, bot - vh / 2) } : { i: +el.dataset.beat, y0: (top + bot) / 2, y1: (top + bot) / 2 }; });
  secR = {}; document.querySelectorAll('[data-beat]').forEach(el => { const r = el.getBoundingClientRect(); secR[+el.dataset.beat] = [r.top + scrollY, r.bottom + scrollY]; });
  ranges = [...document.querySelectorAll('.s3d')].map(el => { const r = el.getBoundingClientRect(); return [r.top + scrollY, r.bottom + scrollY]; });
  renderer.setSize(vw, vh, false);
  camera.aspect = vw / vh; camera.updateProjectionMatrix(); layoutView();
}
function layoutView() { const wide = vw > 900; camera.setViewOffset(vw, vh, wide ? -vw * .19 : 0, wide ? 0 : -vh * .2, vw, vh); }
function frac() {
  const sy = scrollY + vh / 2;
  if (!anchors.length || sy <= anchors[0].y0) return 0;
  for (let k = 0; k < anchors.length; k++) {
    const a = anchors[k]; if (sy <= a.y1) return a.i;
    const nx = anchors[k + 1]; if (!nx) return a.i;
    if (sy < nx.y0) return a.i + sm(clamp((sy - a.y1) / (nx.y0 - a.y1), 0, 1)) * (nx.i - a.i);
  }
  return anchors[anchors.length - 1].i;
}
addEventListener('resize', measure);
addEventListener('load', () => { measure(); setTimeout(measure, 700); });
document.fonts && document.fonts.ready.then(measure);
const inView = () => ranges.some(r => r[1] > scrollY - vh * .1 && r[0] < scrollY + vh * 1.1);
let mx = 0, my = 0;
addEventListener('pointermove', e => { mx = (e.clientX / vw - .5) * 2; my = (e.clientY / vh - .5) * 2; });
const setOn = (sel, el) => document.querySelectorAll(sel).forEach(x => x.classList.toggle('on', x === el));

/* ---------- UI: plant (views, sections, auto tour) ---------- */
const pl = mPlant.st, AUTO_MS = 1500, auto = { on: true, t: 0 };
$('#plSt').innerHTML = VIEWS.map((v, i) => `<button data-s="${i}" data-b="${v.b}">${v.n}</button>`).join('');
const setCam = (b, v) => { b.c.copy(mPlant.origin).add(V3(...v.c)); b.d = v.dist; b.az = v.az; b.el = v.el; };
function plView(i) {
  const v = VIEWS[i]; pl.view = i; pl.secDefault = v.sec;
  mPlant.setSection(v.sec); mPlant.setFocus(v.f);
  setCam(beats[1], v); setCam(beats[0], auto.on ? { ...v, dist: v.dist * 1.25 } : V0);
  $('#plT').textContent = v.t; $('#plD').textContent = v.d;
  setOn('#plSt button', document.querySelector(`#plSt button[data-s="${i}"]`));
  setOn('#plV button', document.querySelector(`#plV button[data-c="${v.sec === 'none' ? 0 : 1}"]`));
  beats[1].labels.forEach(l => { l.show = v.f === '*' ? !!l.main : l.fn === v.f; });
}
function stopAuto() { if (!auto.on) return; auto.on = false; setCam(beats[0], V0); }
addEventListener('pointerdown', stopAuto, { capture: true });
document.querySelectorAll('#plSt button').forEach(b => b.addEventListener('click', () => plView(+b.dataset.s)));
document.querySelectorAll('#plV button').forEach(b => b.addEventListener('click', () => { const v = VIEWS[pl.view]; mPlant.setSection(b.dataset.c === '1' ? (v.sec !== 'none' ? v.sec : 'hall') : 'none'); setOn('#plV button', b); }));
function plUI() {
  const c = pl.cap, tpd = c * 16;
  $('#plQo').textContent = fmt(c) + ' t/h'; $('#plTd').textContent = fmt(tpd); $('#plTr').textContent = fmt(Math.ceil(tpd / 25)); $('#plBg').textContent = fmt(c * 40);
}
$('#plQ').addEventListener('input', e => { mPlant.setCap(+e.target.value); plUI(); });

/* ---------- UI: conveyor ---------- */
const cv = mConv.st;
function cvCam() { const b = beats[2], H = cv.H, W = cv.W; b.c.copy(mConv.origin).add(V3(W / 2 + 1.5, (H + 1) / 2 + .8, 0)); b.d = 14 + (H + W) * 1.15; }
cv.cb = cvCam;
function cvUI() {
  const p = PRODUCTS[cv.prod], mdot = cv.Q * p.dens * 1000 / 3600, Pl = mdot * 9.81 * cv.H, L = mConv.chainLen();
  const kw = ((Pl / .6 + (100 + 25 * L)) / .85) / 1000;
  $('#cvQo').textContent = fmt(cv.Q) + ' m³/h'; $('#cvHo').textContent = fmt(cv.H, 1) + ' m'; $('#cvWo').textContent = fmt(cv.W, 1) + ' m';
  $('#cvT').textContent = fmt(cv.Q * p.dens, 1); $('#cvK').textContent = fmt(kw, 1); $('#cvC').textContent = fmt(L, 1);
  $('#cvF').textContent = fmt(cv.Q / 60 * .64 * 100) + ' %';
  $('#cvL').style.width = clamp(cv.level * 100, 0, 100) + '%'; $('#cvLo').textContent = cv.drain ? 'scarico a valle' : fmt(cv.level * 100) + ' %';
  $('#cvS').textContent = cv.Q === 0 ? 'Cancello chiuso: la catena gira a vuoto e consuma comunque.' : `Per ${fmt(cv.Q * p.dens, 1)} t/h di ${p.name.toLowerCase()} su ${fmt(cv.H, 1)} m di salto serve un motore da circa ${fmt(kw, 1)} kW.`;
}
let cvT = 0;
const cvDim = () => { clearTimeout(cvT); cvT = setTimeout(() => { mConv.rebuild(); mConv.setCut(cv.cut); cvUI(); }, 40); };
$('#cvQ').addEventListener('input', e => { cv.Q = +e.target.value; cvUI(); });
$('#cvH').addEventListener('input', e => { cv.H = +e.target.value; $('#cvHo').textContent = fmt(cv.H, 1) + ' m'; cvDim(); });
$('#cvW').addEventListener('input', e => { cv.W = +e.target.value; $('#cvWo').textContent = fmt(cv.W, 1) + ' m'; cvDim(); });
document.querySelectorAll('#cvP button').forEach(b => b.addEventListener('click', () => { mConv.setProduct(b.dataset.p); setOn('#cvP button', b); cvUI(); }));
document.querySelectorAll('#cvV button').forEach(b => b.addEventListener('click', () => { mConv.setCut(b.dataset.v === 'cut'); setOn('#cvV button', b); }));

/* ---------- UI: packaging line ---------- */
const pk = mPack.st; pk.speed = 20;
function pkUI() {
  const e = mPack.eff(), on = mPack.onPallet(), f = FORMATS[pk.fmt], cap = mPack.CAP(), sat = 60 / mPack.CYCLE;
  $('#pkRo').textContent = fmt(pk.rate) + ' sacchi/min'; $('#pkLyo').textContent = pk.layers + ' strati';
  $('#pkE').textContent = e === null ? '…' : fmt(e); $('#pkK').textContent = e === null ? '…' : fmt(e * f.kg * 60);
  $('#pkD').textContent = fmt(pk.done); $('#pkX').textContent = fmt(pk.rej);
  $('#pkB').textContent = `${on} / ${cap} · ${fmt(cap * f.kg)} kg`; $('#pkM').style.width = on / cap * 100 + '%';
  const over = pk.rate > sat + .5;
  $('#pkS').textContent = !pk.run ? 'In pausa.' : over ? `Oltre circa ${fmt(sat)} sacchi/min il pallettizzatore non regge: i sacchi si accodano sul nastro.` : pk.blocked ? 'Nastro pieno: l’insaccatrice aspetta.' : `Ogni sacco passa dal controllo peso e dal metal detector: i non conformi finiscono nel contenitore degli scarti (${fmt(pk.rej)} finora).`;
  $('#pkS').className = 'status ' + (over ? 'warn' : '');
}
$('#pkR').addEventListener('input', e => { pk.rate = +e.target.value; pkUI(); });
$('#pkLy').addEventListener('input', e => { pk.layers = +e.target.value; mPack.reset(); pkUI(); });
document.querySelectorAll('#pkFmt button').forEach(b => b.addEventListener('click', () => { pk.fmt = +b.dataset.f; setOn('#pkFmt button', b); mPack.reset(); pkUI(); }));
document.querySelectorAll('#pkSp button').forEach(b => b.addEventListener('click', () => { pk.speed = +b.dataset.x; setOn('#pkSp button', b); }));
$('#pkPause').addEventListener('click', e => { pk.run = !pk.run; e.currentTarget.textContent = pk.run ? 'Pausa' : 'Riprendi'; });
$('#pkReset').addEventListener('click', () => { mPack.reset(); pkUI(); });

/* ---------- camera loop ---------- */
const camTgt = V3(), camPos = V3(), tmp = V3(), tmp2 = V3(), camSm = { c: V3(), d: 90, az: -36, el: 19 };
let fS = 0, intro = 0, camInit = false, last = performance.now(), time = 0, activeBeat = 0, uiT = 0, labelsShown = false;
function sph(t, d, az, el, out) { const a = az * Math.PI / 180, e = el * Math.PI / 180; return out.set(t.x + d * Math.cos(e) * Math.sin(a), t.y + d * Math.sin(e), t.z + d * Math.cos(e) * Math.cos(a)); }
function tick(now) {
  requestAnimationFrame(tick);
  const dt = clamp((now - last) / 1000, 0, .05); last = now; time += dt;
  if (!anchors.length) measure();
  const f = frac();
  fS += (f - fS) * (1 - Math.exp(-dt * 4.5));
  const i = clamp(Math.floor(fS), 0, beats.length - 1), j = Math.min(i + 1, beats.length - 1), k = sm(clamp(fS - i, 0, 1));
  const A = beats[i], Bb = beats[j];
  tmp.lerpVectors(A.c, Bb.c, k);
  const dT = lerp(A.d, Bb.d, k) * (vw < 900 ? 1.5 : 1), azT = lerp(A.az, Bb.az, k), elT = lerp(A.el, Bb.el, k);
  if (!camInit) { camSm.c.copy(tmp); camSm.d = dT; camSm.az = azT; camSm.el = elT; camInit = true; }
  const cs = 1 - Math.exp(-dt * (auto.on && fS < 1.5 ? 7 : 4));
  camSm.c.lerp(tmp, cs); camSm.d += (dT - camSm.d) * cs; camSm.az += (azT - camSm.az) * cs; camSm.el += (elT - camSm.el) * cs;
  camTgt.copy(camSm.c);
  const introK = REDUCED ? 1 : eo(clamp(intro, 0, 1));
  const az = camSm.az + mx * 5 + (REDUCED ? 0 : Math.sin(time * .15) * 3.5), el = camSm.el - my * 2;
  sph(camTgt, camSm.d * (1 + (1 - introK) * .3), az + (1 - introK) * 28, el + (1 - introK) * 6, camPos);
  camera.position.copy(camPos); camera.lookAt(camTgt);
  if (intro < 1) intro += dt * .33;
  models.forEach(m => { m.target = m.beats.some(b => Math.abs(fS - b) < 1.2) ? 1 : 0; m.g.visible = m.target > 0; });
  mPlant.hero(fS < .6 && !auto.on);
  if (auto.on && fS < 1.5) { auto.t += dt; if (auto.t >= AUTO_MS / 1000) { auto.t = 0; plView((pl.view + 1) % VIEWS.length); } }
  key.position.set(camTgt.x - 26, camTgt.y + 44, camTgt.z + 30); key.target.position.copy(camTgt);
  rim.position.set(camTgt.x + 30, camTgt.y + 20, camTgt.z - 34); rim.target.position.copy(camTgt);
  const ab = Math.round(fS); if (ab !== activeBeat) { activeBeat = ab; labelHost.querySelectorAll('.tag.on').forEach(x => x.classList.remove('on')); }
  const run = inView() || Math.abs(fS - Math.round(fS)) > .02;
  if (run) {
    models.forEach(m => { if (m.g.visible) for (let k = m === mPack ? pk.speed : 1; k > 0; k--) m.update(dt, time); });
    uiT += dt; if (uiT > .12) { uiT = 0; if (fS < 1.5) plUI(); else if (fS < 2.5) cvUI(); else pkUI(); }
    beats.forEach((b, bi) => {
      const sr = secR[bi], cy = scrollY + vh / 2, inSec = sr && cy > sr[0] - vh * .1 && cy < sr[1] + vh * .1;
      const show = (bi === 1 && auto.on && fS < 1.5) || (inSec && Math.abs(fS - bi) < .22 && b.m.t > .97);
      b.labels.forEach(l => {
        tmp2.copy(l.p).project(camera);
        const x = (tmp2.x * .5 + .5) * vw, y = (-tmp2.y * .5 + .5) * vh;
        l.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-12px,-50%)`;
        const covered = vw > 900 ? x < Math.min(560, vw * .4) : y > vh * .5;
        l.el.classList.toggle('on', show && tmp2.z < 1 && !covered && (l.show !== false));
      });
    });
    labelsShown = true;
    models.forEach(m => { m.t += ((m.target - m.t)) * (1 - Math.exp(-dt * 6)); });
    renderer.render(scene, camera);
  } else if (labelsShown) { labelHost.querySelectorAll('.tag.on').forEach(x => x.classList.remove('on')); labelsShown = false; }
}
mConv.setCut(true); mPlant.setCap(20); plView(0); plUI(); cvCam(); cvUI(); mPack.reset(); pkUI();
measure();
requestAnimationFrame(tick);
window.__massini = { models, beats, go(i) { const a = anchors.find(a => a.i === i); scrollTo({ top: a.y0 - vh / 2, behavior: 'instant' }); fS = i; camInit = false; intro = 1; models.forEach(m => m.t = 1); }, step(n = 60) { for (let k = 0; k < n; k++) models.forEach(m => m.update(.05, time)); }, stage: plView, auto, get f() { return fS; } };
