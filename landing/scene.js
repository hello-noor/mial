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
  asphalt: std(0x16181c, 0, .95),
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
  m.rotation.x = -Math.PI / 2; m.position.set(cx, 0, cz); m.receiveShadow = true; g.add(m);
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
const STAGES = [
  { n: 'Ricezione', t: 'Il camion scarica, il prodotto sale', d: 'Tutto parte dalla ricezione delle materie prime: il camion scarica in fossa e un elevatore porta il prodotto in quota.', c: [-13, 6.5, 6], dist: 40, az: -42, el: 15, box: [-17, 7.5, 6.5, 7, 16, 9] },
  { n: 'Stoccaggio', t: 'Quattro silos, livello sempre noto', d: 'Le materie prime si stoccano nei silos. Il livello di ciascuno è sotto controllo, così sai sempre quanto prodotto hai a disposizione.', c: [-6.5, 6.5, -1], dist: 36, az: -52, el: 14, box: [-6.6, 6.3, -1, 13.8, 13.4, 12] },
  { n: 'Dosaggio', t: 'Dosare e miscelare secondo ricetta', d: 'Le materie prime vengono dosate e miscelate secondo la ricetta richiesta, nella torre di processo.', c: [3, 5.5, -1], dist: 28, az: -40, el: 16, box: [3, 4.8, -1, 5, 9.6, 5] },
  { n: 'Produzione', t: 'Farina, pellet o estruso', d: 'Mangimi in farina, in pellet o estrusi: gli impianti coprono da 1 a 60 t/h, anche in versione modulare per installazioni rapide in spazi ridotti.', c: [4.8, 10, -2.4], dist: 30, az: -40, el: 15, box: [4.8, 10.9, -2.6, 9, 7.4, 7.4] },
  { n: 'Confezionamento', t: 'Insacco, palletizzazione, fasciatura', d: 'Il prodotto passa al reparto di confezionamento (MF TECNO): insacco, pallettizzazione e fasciatura, fino al pallet pronto.', c: [19, 4, -1], dist: 46, az: -35, el: 17, box: [19, 4.1, -1, 25, 8.6, 13] },
  { n: 'Spedizione', t: 'Dal pallet al camion', d: 'I pallet fasciati vengono caricati sui camion con il carrello elevatore e partono verso il cliente.', c: [27, 2.5, 8], dist: 32, az: -32, el: 14, box: [27.2, 2.6, 8.8, 10, 5.6, 10.5] },
];
function buildPlant(ox) {
  const g = new THREE.Group(); g.position.set(ox, 0, 0);
  pad(g, 150, 90, 6, 4);
  g.add(box(130, .04, 10.2, M.asphalt, 4, .02, 10.2));
  for (let x = -58; x < 62; x += 4) g.add(box(1.8, .045, .12, M.label, x, .03, 10.2));
  // silos with level bars
  const R = 1.8, silos = [[-9, -4.6], [-9, 2.6], [-4.2, -4.6], [-4.2, 2.6]], bars = [];
  silos.forEach(([x, z]) => {
    g.add(cyl(R, R, 8, M.steel, x, 7, z, 36)); g.add(cone(R, 2.2, M.steel, x, 1.9, z, true, 36)); g.add(cone(R + .05, 1.1, M.steel, x, 11.55, z, false, 36));
    [4.5, 6.2, 7.9, 9.6].forEach(y => g.add(ring(R + .02, .06, M.steelD, x, y, z)));
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([a, b]) => g.add(box(.2, 3, .2, M.steelD, x + a * R * .78, 1.5, z + b * R * .78)));
    g.add(box(.08, 8.6, .34, M.orange, x, 7.3, z + (z > 0 ? -R - .04 : R + .04)));
    g.add(cyl(.28, .28, .5, M.orange, x, 12.35, z, 16));
    const a = -36 * Math.PI / 180, bx = x + Math.sin(a) * (R + .06), bz = z + Math.cos(a) * (R + .06);
    const holder = new THREE.Group(); holder.position.set(bx, 3.4, bz); holder.rotation.y = a; g.add(holder);
    holder.add(box(.34, 7.2, .08, M.dark, 0, 3.6, 0));
    const fill = new THREE.Mesh(new THREE.BoxGeometry(.2, 1, .06), M.lvl); fill.position.set(0, 0, .06); holder.add(fill);
    bars.push(fill);
  });
  // intake pit, conveyor and bucket elevator
  g.add(box(3.2, .08, 2.6, M.dark, -17, .06, 8.5));
  for (let i = -3; i <= 3; i++) g.add(box(.05, .1, 2.5, M.steel, -17 + i * .4, .12, 8.5));
  g.add(box(3.4, .1, .12, M.orange, -17, .12, 7.15)); g.add(box(3.4, .1, .12, M.orange, -17, .12, 9.85));
  g.add(box(.8, .5, 3.6, M.steelD, -17, .35, 6.7));
  g.add(box(.8, 15, .8, M.steel, -17, 7.5, 5)); g.add(box(1.3, 1.3, 1.3, M.steelD, -17, 14.7, 5)); g.add(cyl(.4, .4, .9, M.blue, -17, 15.6, 5, 16));
  for (let y = 3; y < 14; y += 3.5) g.add(box(.95, .1, .95, M.steelD, -17, y, 5));
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
  g.add(box(2.4, 1.5, 1.4, M.blue, tx - .4, 5.0, tz));
  const mixer = box(.2, 1, .2, M.steel, tx - .4, 5.9, tz); g.add(mixer);
  g.add(cyl(.75, .75, 2.2, M.white, tx, 9.6, tz, 24)); g.add(cone(.75, .9, M.white, tx, 8.2, tz, true, 24));
  g.add(cyl(.95, .95, 1.1, M.white, tx, 13.4, tz, 28)); g.add(cone(.95, 1.0, M.white, tx, 12.4, tz, true, 28));
  g.add(box(.9, 1.1, .6, M.dark, tx + 1.2, 4.9, tz + 1.55)); g.add(box(.5, .35, .04, M.screen, tx + 1.2, 5.05, tz + 1.87));
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(.22, 12, 10), emi(0xee7319, 2)); beacon.position.set(tx, 14.6, tz); g.add(beacon);
  // cyclone with steam
  g.add(cyl(.95, .95, 2.4, M.steel, 8, 4.7, -4.2, 28)); g.add(cone(.95, 2.2, M.steel, 8, 2.4, -4.2, true, 28)); g.add(cyl(.22, .22, 1.6, M.steelD, 8, 6.7, -4.2, 14));
  [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([a, b]) => g.add(box(.14, 2.4, .14, M.steelD, 8 + a * .7, 1.2, -4.2 + b * .7)));
  const steamN = 36, steamGeo = new THREE.BufferGeometry(), sp = new Float32Array(steamN * 3), sph = Array.from({ length: steamN }, (_, i) => i / steamN);
  steamGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const steam = new THREE.Points(steamGeo, new THREE.PointsMaterial({ color: 0xdfe6ee, size: .9, transparent: true, opacity: .16, depthWrite: false })); steam.frustumCulled = false; g.add(steam);
  // hall
  const hx = 19, hz = -1;
  g.add(box(24, 7.4, 12, M.white, hx, 3.7, hz)); g.add(box(24.5, .3, 12.5, M.steelD, hx, 7.55, hz));
  g.add(box(24.1, 1.1, 12.1, M.blue, hx, 6.55, hz)); g.add(box(24.1, .12, 12.1, M.orange, hx, 5.95, hz));
  const win = new THREE.Mesh(new THREE.BoxGeometry(17, .9, .06), M.win); win.position.set(hx - 2.5, 4.1, hz + 6.03); g.add(win);
  const win2 = win.clone(); win2.position.set(hx + 12.03, 4.1, hz); win2.rotation.y = Math.PI / 2; win2.scale.x = .55; g.add(win2);
  g.add(box(5.4, .22, .12, M.orange, hx + 8.2, 4.3, hz + 6.05)); g.add(box(.22, 4.3, .12, M.orange, hx + 5.6, 2.15, hz + 6.05)); g.add(box(.22, 4.3, .12, M.orange, hx + 10.8, 2.15, hz + 6.05));
  g.add(box(5, 4.1, .08, M.steel, hx + 8.2, 2.05, hz + 6.04));
  [-8, -3, 2, 7].forEach(x => g.add(box(2.2, .22, 3, M.glass, hx + x, 7.8, hz + 2)));
  g.add(box(3, 2.2, 3, M.white, hx, 8.5, hz));
  const fans = [];
  [[-8, -3], [-2, -3], [4, -3], [10, -3]].forEach(([x, z]) => { const f = new THREE.Group(); f.position.set(hx + x, 7.7, hz + z); f.add(cyl(.7, .75, .35, M.steelD, 0, 0, 0, 20)); const bl = new THREE.Group(); bl.position.y = .22; for (let k = 0; k < 4; k++) { const b = box(.55, .03, .18, M.steel, .3, 0, 0); const h = new THREE.Group(); h.rotation.y = k * Math.PI / 2; h.add(b); bl.add(h); } f.add(bl); g.add(f); fans.push(bl); });
  // tubular conveyors
  const tubeMat = std(0xd5dde6, .9, .25);
  const cA = tubeCurve([V3(-17, 14.2, 5), V3(-17, 14.2, -1), V3(3, 14.2, -1), V3(3, 13.7, -1)], 1.2, false);
  const cB = tubeCurve([V3(5.1, 10.4, -1), V3(19, 10.4, -1), V3(19, 9.7, -1)], 1, false);
  [cA, cB].forEach(c => g.add(shadow(new THREE.Mesh(new THREE.TubeGeometry(c, 120, .3, 14, false), tubeMat))));
  [-13, -7, -1.5].forEach(x => g.add(box(.22, 14.2, .22, M.steelD, x, 7.1, -1)));
  g.add(box(.22, 10.4, .22, M.steelD, 6.6, 5.2, -1));
  [12.5, 17].forEach(x => g.add(box(.2, 2.9, .2, M.steelD, x, 8.85, -1)));
  [-12, -6, -2.3].forEach(x => g.add(cyl(.38, .3, .35, M.orange, x, 13.8, -1, 14)));
  const pA = mkPulses(g, cA, 26), pB = mkPulses(g, cB, 20);
  // stage highlight
  const halo = new THREE.Group(); g.add(halo);
  const haloFill = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x2997ff, transparent: true, opacity: .1, depthWrite: false }));
  const haloEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0x2997ff, transparent: true, opacity: .9 }));
  halo.add(haloFill, haloEdge);
  // trucks and forklift
  const T1 = mkTruck(true), T2 = mkTruck(false); g.add(T1.g, T2.g);
  T1.g.position.set(-70, 0, 8.5); T2.g.position.set(70, 0, 11.9); T2.g.rotation.y = Math.PI;
  const cascade = box(.7, 1, .7, M.grain, -17, .5, 8.5); cascade.visible = false; g.add(cascade);
  const FK = mkForklift(); g.add(FK.g); FK.g.position.set(31.5, 0, 8.6); FK.g.rotation.y = Math.PI;
  const loads = [0, 1, 2].map(() => { const l = mkLoad(); l.visible = false; g.add(l); return l; });
  const dockX = [25.4, 27.2, 29.0];
  const st = { cap: 20, stage: 0, lev: [.55, .4, .7, .3], dumpIdx: 0 };
  const tr = { s: 'wait', t: 0, next: 3 }, tr2 = { s: 'wait', t: 6, k: 0, p: 0, pt: 0 };
  let ph = 0;
  const m = { g, halo, origin: V3(ox, 0, 0), t: 0, target: 0, st,
    setStage(i) { st.stage = i; const b = STAGES[i].box; halo.position.set(b[0], b[1], b[2]); halo.scale.set(b[3], b[4], b[5]); },
    setCap(c) { st.cap = c; },
    mix() { return st.lev.reduce((a, b) => a + b, 0) / 4; },
    update(dt) {
      const cap = st.cap, flow = .35 + cap / 60 * 1.4;
      pA.update(dt, .018 * flow, Math.round(8 + cap / 60 * 18)); pB.update(dt, .022 * flow, Math.round(6 + cap / 60 * 14));
      let hi = 0; st.lev.forEach((v, i) => { if (v > st.lev[hi]) hi = i; });
      st.lev[hi] = Math.max(.06, st.lev[hi] - dt * cap / 60 * .02);
      // intake truck: unloads into the pit, the lowest silo fills
      tr.t += dt; const interval = 24 / (1 + cap / 8);
      if (tr.s === 'wait') { T1.g.position.x = -70; if (tr.t >= tr.next) { tr.s = 'in'; tr.t = 0; let lo = 0; st.lev.forEach((v, i) => { if (v < st.lev[lo]) lo = i; }); st.dumpIdx = lo; } }
      else if (tr.s === 'in') { T1.g.position.x = lerp(-70, -12.1, sm(clamp(tr.t / 6, 0, 1))); if (tr.t >= 6) { tr.s = 'tip'; tr.t = 0; } }
      else if (tr.s === 'tip') { T1.trl.rotation.z = sm(clamp(tr.t / 3, 0, 1)) * .62; if (tr.t >= 3) { tr.s = 'dump'; tr.t = 0; } }
      else if (tr.s === 'dump') {
        cascade.visible = true; cascade.scale.y = 1.2; cascade.position.set(-17, .45, 8.5); T1.trl.userData.load.scale.y = Math.max(.05, 1 - tr.t / 5);
        st.lev[st.dumpIdx] = Math.min(.96, st.lev[st.dumpIdx] + dt * .02);
        if (tr.t >= 5) { tr.s = 'down'; tr.t = 0; cascade.visible = false; }
      }
      else if (tr.s === 'down') { T1.trl.rotation.z = (1 - sm(clamp(tr.t / 2.5, 0, 1))) * .62; if (tr.t >= 2.5) { tr.s = 'out'; tr.t = 0; } }
      else if (tr.s === 'out') { T1.g.position.x = lerp(-12.1, 70, sm(clamp(tr.t / 7, 0, 1))); if (tr.t >= 7) { tr.s = 'wait'; tr.t = 0; tr.next = interval; T1.trl.userData.load.scale.y = 1; } }
      // dispatch truck, forklift swings pallets from the staging area onto the bed
      tr2.t += dt;
      if (tr2.s === 'wait') { T2.g.position.x = 70; FK.g.position.set(31.5, 0, 8.6); FK.g.rotation.y = Math.PI; if (tr2.t >= 2 + interval * .8) { tr2.s = 'in'; tr2.t = 0; loads.forEach(l => { l.visible = false; g.add(l); }); } }
      else if (tr2.s === 'in') { T2.g.position.x = lerp(70, 26.6, sm(clamp(tr2.t / 6, 0, 1))); if (tr2.t >= 6) { tr2.s = 'load'; tr2.t = 0; tr2.k = 0; tr2.p = 0; tr2.pt = 0; loads[0].visible = true; loads[0].position.set(dockX[0], 0, 7); FK.g.position.set(dockX[0], 0, 9.2); FK.g.rotation.y = Math.PI; } }
      else if (tr2.s === 'load') {
        tr2.pt += dt; const k = tr2.k, Ld = loads[k];
        if (tr2.p === 0) { FK.fork.position.y = .15 + sm(clamp(tr2.pt / .9, 0, 1)) * 1.4; if (tr2.pt >= .9) { g.updateMatrixWorld(true); FK.fork.attach(Ld); tr2.p = 1; tr2.pt = 0; } }
        else if (tr2.p === 1) { FK.g.rotation.y = Math.PI + sm(clamp(tr2.pt / 1.4, 0, 1)) * Math.PI; if (tr2.pt >= 1.4) { tr2.p = 2; tr2.pt = 0; } }
        else if (tr2.p === 2) { FK.fork.position.y = 1.55 - sm(clamp(tr2.pt / .8, 0, 1)) * .1; if (tr2.pt >= .8) { g.updateMatrixWorld(true); g.attach(Ld); Ld.position.y = 1.25; Ld.rotation.set(0, 0, 0); tr2.p = 3; tr2.pt = 0; } }
        else if (tr2.p === 3) { FK.fork.position.y = Math.max(.15, 1.45 - sm(clamp(tr2.pt / .8, 0, 1)) * 1.3); if (tr2.pt >= .8) { if (tr2.k >= 2) { tr2.s = 'leave'; tr2.t = 0; } else { tr2.p = 4; tr2.pt = 0; } } }
        else if (tr2.p === 4) {
          const kk = sm(clamp(tr2.pt / 1.2, 0, 1)); FK.g.rotation.y = Math.PI * 2 - kk * Math.PI; FK.g.position.x = lerp(dockX[tr2.k], dockX[tr2.k + 1], kk);
          if (tr2.pt >= 1.2) { tr2.k++; tr2.p = 0; tr2.pt = 0; loads[tr2.k].visible = true; loads[tr2.k].position.set(dockX[tr2.k], 0, 7); FK.g.rotation.y = Math.PI; }
        }
      }
      else if (tr2.s === 'leave') {
        const k = sm(clamp(tr2.t / 7, 0, 1)), dx = lerp(26.6, -70, k); T2.g.position.x = dx;
        loads.forEach((l, i) => { l.position.x = dockX[i] + (dx - 26.6); });
        FK.g.position.x = lerp(FK.g.position.x, 31.5, Math.min(1, dt * 2)); FK.g.position.z = lerp(FK.g.position.z, 8.6, Math.min(1, dt * 2)); FK.g.rotation.y = Math.PI;
        if (tr2.t >= 7) { tr2.s = 'wait'; tr2.t = 0; loads.forEach(l => l.visible = false); }
      }
      // moving details
      ph += dt;
      lights.forEach((l, i) => { l.material.emissiveIntensity = .3 + (Math.sin(ph * 3 + i * 2) > 0 ? 1.4 : 0); });
      beacon.material.emissiveIntensity = Math.sin(ph * 5) > 0 ? 3 : .2;
      fans.forEach((b, i) => b.rotation.y += dt * (6 + i));
      mixer.rotation.y += dt * 4; mixer.scale.y = 1 + Math.sin(ph * 6) * .05;
      bars.forEach((b, i) => { const h = Math.max(.05, st.lev[i] * 7.0); b.scale.y = h; b.position.y = h / 2; });
      const pos = steamGeo.attributes.position;
      for (let i = 0; i < steamN; i++) { sph[i] = (sph[i] + dt * .12) % 1; const a = sph[i]; pos.setXYZ(i, 8 + a * 3 + Math.sin(i * 5 + ph) * .3, 7.6 + a * 5, -4.2 + Math.cos(i * 3) * .4); }
      pos.needsUpdate = true;
      const kk2 = .5 + .5 * Math.sin(ph * 3);
      haloFill.material.opacity = .06 + kk2 * .07; haloEdge.material.opacity = .55 + kk2 * .4;
    } };
  m.setStage(0);
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
function buildPack(ox) {
  const g = new THREE.Group(); g.position.set(ox, 0, 0);
  pad(g, 90, 50, 11, 0);
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
  // wrapper and exit roller
  const turn = cyl(.95, .95, .1, M.steel, WX, .05, 0, 40); g.add(turn); g.add(ring(.96, .03, M.orange, WX, .1, 0));
  g.add(box(.18, 3.4, .18, M.orange, WX + 1.6, 1.7, 0)); g.add(box(.5, .1, .5, M.steelD, WX + 1.6, .05, 0));
  const wcar = new THREE.Group(); g.add(wcar); wcar.add(box(.9, .3, .34, M.dark, -.5, 0, 0)); wcar.add(cyl(.12, .12, .55, M.wrap, -.95, 0, 0, 14));
  const film = new THREE.Mesh(new THREE.CylinderGeometry(.74, .74, 1, 36, 1, true), M.film); g.add(film);
  g.add(box(3.6, .14, 1.1, M.steelD, EX - .6, .55, 0));
  for (let i = 0; i < 9; i++) { const r = cyl(.05, .05, 1.0, M.steel, EX - 2.2 + i * .4, .64, 0, 8); r.rotation.x = Math.PI / 2; g.add(r); }
  const FK = mkForklift(); g.add(FK.g); FK.g.rotation.y = -Math.PI / 2; FK.g.position.set(EX + 14, 0, 0);
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
          if (k >= 1) { p.state = 'exit'; p.t = 0; st.done++; wcar.position.y = .35; p.g.rotation.y = 0; }
        }
        if (p.state === 'exit') { const k = sm(clamp(p.t / 1.5, 0, 1)); p.g.position.set(lerp(WX, EX - .6, k), .1, 0); film.material.opacity = .42 * (1 - k); if (k >= 1) { p.state = 'ready'; p.t = 0; } }
      });
      if (!st.pallets.some(p => p.state === 'build' || p.state === 'wait')) st.pallets.push(mkPallet());
      const fk = st.fk, rp = st.pallets.find(p => p.state === 'ready'); fk.t += dt;
      if (fk.s === 'away') { FK.g.position.x = EX + 14; if (rp) { fk.s = 'in'; fk.t = 0; fk.p = rp; rp.state = 'picked'; } }
      else if (fk.s === 'in') { FK.g.position.x = lerp(EX + 14, EX + 1.6, sm(clamp(fk.t / 4, 0, 1))); FK.fork.position.y = .15; if (fk.t >= 4) { fk.s = 'lift'; fk.t = 0; } }
      else if (fk.s === 'lift') { FK.fork.position.y = .15 + sm(clamp(fk.t / .9, 0, 1)) * .5; if (fk.t >= .9) { g.updateMatrixWorld(true); FK.fork.attach(fk.p.g); fk.s = 'out'; fk.t = 0; } }
      else if (fk.s === 'out') { FK.g.position.x = lerp(EX + 1.6, EX + 14, sm(clamp(fk.t / 4, 0, 1))); if (fk.t >= 4) { FK.fork.remove(fk.p.g); st.pallets = st.pallets.filter(p => p !== fk.p); fk.s = 'away'; fk.t = 0; fk.p = null; FK.fork.position.y = .15; } }
      st.times = st.times.filter(t => st.clock - t < 30);
    },
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
const Bt = (m, c, d, az, el, labels = []) => ({ m, c: m.origin.clone().add(c), d, az, el, labels: labels.map(([p, t]) => mkLabel(m.origin.clone().add(V3(...p)), t)) });
const beats = [
  Bt(mPlant, V3(8, 5.5, 0), 112, -36, 19),
  Bt(mPlant, V3(...STAGES[0].c), STAGES[0].dist, STAGES[0].az, STAGES[0].el, [[[-17, 16.4, 5], 'Ricezione'], [[-6.6, 12.9, -1], 'Stoccaggio'], [[3, 7.4, 1.4], 'Dosaggio'], [[8, 7.6, -4.2], 'Produzione'], [[19, 8.2, 5], 'Confezionamento'], [[27.2, 5.2, 7], 'Spedizione']]),
  Bt(mConv, V3(3.5, 4.2, 0), 26, -24, 11, [[[0, 5.6, 0], 'Catena con dischi'], [[-2.3, 3.4, 0], 'Tramoggia di carico'], [[5, 7.6, -.8], 'Gruppo di trascinamento'], [[7.5, 5.4, 0], 'Silo di arrivo']]),
  Bt(mPack, V3(8.6, 2.2, 0), 36, -22, 17, [[[.2, 7.0, 0], 'Insaccatrice'], [[4.2, 2.4, 0], 'Controllo peso e metal detector'], [[5.6, 1.6, 1.05], 'Scarto'], [[12.2, 5.1, 0], 'Pallettizzatore'], [[16.8, 3.2, 0], 'Fasciatrice'], [[22.6, 1.8, 0], 'Carrello']]),
];
beats.forEach((b, i) => { (b.m.beats ||= []).push(i); });
const stageTags = beats[1].labels;

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

/* ---------- UI: plant ---------- */
const pl = mPlant.st;
function plStage(i) {
  const s = STAGES[i]; mPlant.setStage(i);
  const b = beats[1]; b.c.copy(mPlant.origin).add(V3(...s.c)); b.d = s.dist; b.az = s.az; b.el = s.el;
  $('#plT').textContent = s.t; $('#plD').textContent = s.d;
  setOn('#plSt button', document.querySelector(`#plSt button[data-s="${i}"]`));
  stageTags.forEach((l, k) => l.el.classList.toggle('sel', k === i));
}
function plUI() {
  const c = pl.cap, tpd = c * 16;
  $('#plQo').textContent = fmt(c) + ' t/h'; $('#plTd').textContent = fmt(tpd); $('#plTr').textContent = fmt(Math.ceil(tpd / 25)); $('#plBg').textContent = fmt(c * 40);
  const lv = mPlant.mix(); $('#plL').style.width = lv * 100 + '%'; $('#plLo').textContent = fmt(lv * 100) + ' %';
}
document.querySelectorAll('#plSt button').forEach(b => b.addEventListener('click', () => plStage(+b.dataset.s)));
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
const pk = mPack.st;
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
  const cs = 1 - Math.exp(-dt * 4);
  camSm.c.lerp(tmp, cs); camSm.d += (dT - camSm.d) * cs; camSm.az += (azT - camSm.az) * cs; camSm.el += (elT - camSm.el) * cs;
  camTgt.copy(camSm.c);
  const introK = REDUCED ? 1 : eo(clamp(intro, 0, 1));
  const az = camSm.az + mx * 5 + (REDUCED ? 0 : Math.sin(time * .15) * 3.5), el = camSm.el - my * 2;
  sph(camTgt, camSm.d * (1 + (1 - introK) * .3), az + (1 - introK) * 28, el + (1 - introK) * 6, camPos);
  camera.position.copy(camPos); camera.lookAt(camTgt);
  if (intro < 1) intro += dt * .33;
  models.forEach(m => { m.target = m.beats.some(b => Math.abs(fS - b) < 1.2) ? 1 : 0; m.g.visible = m.target > 0; });
  mPlant.halo.visible = fS > .6 && fS < 1.5;
  key.position.set(camTgt.x - 26, camTgt.y + 44, camTgt.z + 30); key.target.position.copy(camTgt);
  rim.position.set(camTgt.x + 30, camTgt.y + 20, camTgt.z - 34); rim.target.position.copy(camTgt);
  const ab = Math.round(fS); if (ab !== activeBeat) { activeBeat = ab; labelHost.querySelectorAll('.tag.on').forEach(x => x.classList.remove('on')); }
  const run = inView() || Math.abs(fS - Math.round(fS)) > .02;
  if (run) {
    models.forEach(m => { if (m.g.visible) m.update(dt, time); });
    uiT += dt; if (uiT > .12) { uiT = 0; if (fS < 1.5) plUI(); else if (fS < 2.5) cvUI(); else pkUI(); }
    beats.forEach((b, bi) => {
      const sr = secR[bi], cy = scrollY + vh / 2, inSec = sr && cy > sr[0] - vh * .1 && cy < sr[1] + vh * .1;
      const show = inSec && Math.abs(fS - bi) < .22 && b.m.t > .97;
      b.labels.forEach(l => {
        tmp2.copy(l.p).project(camera);
        const x = (tmp2.x * .5 + .5) * vw, y = (-tmp2.y * .5 + .5) * vh;
        l.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-12px,-50%)`;
        const covered = vw > 900 ? x < Math.min(560, vw * .4) : y > vh * .5;
        l.el.classList.toggle('on', show && tmp2.z < 1 && !covered);
      });
    });
    labelsShown = true;
    models.forEach(m => { m.t += ((m.target - m.t)) * (1 - Math.exp(-dt * 6)); });
    renderer.render(scene, camera);
  } else if (labelsShown) { labelHost.querySelectorAll('.tag.on').forEach(x => x.classList.remove('on')); labelsShown = false; }
}
mPlant.setCap(20); plStage(0); plUI(); cvCam(); cvUI(); mPack.reset(); pkUI();
measure();
requestAnimationFrame(tick);
window.__massini = { models, beats, go(i) { const a = anchors.find(a => a.i === i); scrollTo({ top: a.y0 - vh / 2, behavior: 'instant' }); fS = i; camInit = false; intro = 1; models.forEach(m => m.t = 1); }, step(n = 60) { for (let k = 0; k < n; k++) models.forEach(m => m.update(.05, time)); }, stage: plStage, get f() { return fS; } };
