# MIAL tubular chain conveyor: interactive 3D simulator (CLEAN200)

A single-page, physics-driven 3D model of the MIAL **CLEAN200** tubular chain conveyor (drive unit ø 204, up to 60 m³/h): a closed stainless tube with plastic discs bolted to a chain that lifts bulk product from a loading hopper at the bottom to a silo at the top. Every number on screen is computed by a small solver, not typed in.

![Main view](docs/preview/main.jpg)

| Cut-away with live values | Inspecting a sight window |
|---|---|
| ![Cut-away](docs/preview/cutaway.jpg) | ![Inspect](docs/preview/inspect.jpg) |

A 49 s film of the model is in [`video/tubular-chain-conveyor.mp4`](video/tubular-chain-conveyor.mp4).

## Open it

Double-click `tubular-chain-conveyor.html` (one self-contained file; it loads three.js 0.170 and the Google Fonts from their CDNs, so it needs an internet connection).

## What you can do

- **Flow gate opening** (slider, or keys `[` and `]`): opens the flow control gate under the hopper, 0 to 60 m³/h. The discs fill more or less, the throughput and all KPIs follow.
- **Product**: pet food, rice, coffee, plastic granules (key `M`). Each has its own bulk density, wall friction and grain size, so tonnes per hour, power and chain tension change.
- **Modes**: Explode `E`, Cut away `C`, X-ray `X`, Slow motion `S`, Labels `L`, Pause `Space`.
- **Inspect window** `I`: zooms to a riser sight glass in slow motion to see discs, chain and product climb.
- **Plant examples** `P`: gallery of the plant layouts from the brochure (pages 9 and 13).
- **All models and specs** `D`: CLEAN200 / 159 / 100 and CHAINMOVE159 / 100 / 60 at a glance.
- **Jam a bolt** `B`: a steel bolt wedges between a disc and the first bend. It needs about 4.9 kN to crush through; the drive can pull about 3.4 kN at its 150 % torque limit, so the chain stalls and the inverter trips after 2 s. The chain itself stays far from its breaking load (about 4 kN against roughly 36 kN).
- **How it is computed**: the model in plain words, with the equations.

## What is computed

- Flow `Q = min(gate setting, A·φ·v)`, fill factor φ = 0.64, bore area from the 204 × 4 mm tube.
- Chain speed from inverter frequency, slip, gearbox ratio and sprocket radius.
- Chain tension walked round the 16.7 m loop (friction of chain and product, 4.45 m lift, capstan gain on the bends); take-up fixed at the wheel; drive force = tight side − slack side.
- Hopper outlet limit by Beverloo's law; silo level integrated from inflow and a fixed outlet draw.
- Power from drive force, speed, gearbox and motor efficiency.

**Taken from the brochure:** tube ø 204, plastic discs bolted to the chain, gearmotor on the chain drive, 400 V 50 Hz, up to 7.5 kW, AISI 304, 60 m³/h, hopper with flow control device, unloading with slide gate valve, energy savings over 50 %, pet food breakage under 0.2 %.

**Assumed (not in the brochure):** motor 2.2 kW and 58:1 gearbox, chain wire size, disc and chain masses, friction and bulk density of the four products, sight glasses, silo and hopper sizes, the 2 s inverter trip time, and the wedge force of the bolt. The 3D model shows the CLEAN200 only; the other models appear as specs.

**Source discrepancies:** the website lists "ChainMove200 ø 204, 60 m³/h"; the brochure range pages (14, 15) put 60 m³/h on the CLEAN200 and 30 m³/h on the ChainMove159, and the ChainMove data page (12) is inconsistent. The model follows pages 14 and 15.

## Repository layout

```
tubular-chain-conveyor.html   the built page (open this)
video/                        the film
docs/                         the MIAL brochure (PDF) and preview images
src/machine.src.js            the machine: geometry, solver, UI, film
src/head.html                 page shell with the inlined lab kit (tools/kit/lab-kit.js)
src/assets/                   MIAL logo and the four brochure images, base64
src/assemble.mjs              builds the page from the above
tools/                        screenshot and film recording scripts + the lab kit
```

## Rebuild and record

```sh
node src/assemble.mjs                       # rebuild tubular-chain-conveyor.html

cd tools && npm install && npx playwright install chromium   # once; the film also needs ffmpeg
node scripts/shot.mjs ../tubular-chain-conveyor.html ../out/review.png --root ..
node scripts/record.mjs ../tubular-chain-conveyor.html ../video/tubular-chain-conveyor.mp4 --root ..
```

The film is deterministic: the page runs in `?film=1` mode and its clock only moves when the recorder steps it.

## Credits and rights

- Built with the *Machine* skill for Claude Code (kit and scripts in `tools/`, MIT, see `tools/LICENSE`) and three.js.
- The MIAL name, logo, brochure text and the plant images (pages 9 and 13) belong to MIAL / Massini Industries srl. They are included here to illustrate the product. This simulator is an independent illustration, not an official MIAL product.
