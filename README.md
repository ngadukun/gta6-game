[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ngadukun/gta6-game/rank.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ngadukun/gta6-game/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Sunhaven — an open-world crime caper

An original open-world crime game built for the [make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01). No engines, no assets, no build step: a hand-written city that runs from static files in a desktop browser.

Leo Santos rolls into **Sunhaven** — a sun-soaked coastal city of pastel blocks, palm-lined promenades and one long beach — with an empty tank and a borrowed name. Marisol Vega, of Vega Auto Works, has work for a driver who doesn't ask questions: packages, stolen sports cars, a nervous accountant, a dockside distraction, and one armoured van full of the Sunhaven Trust's money. The Sunhaven Police Department has opinions about all of it.

## What's in the city

- **A full open world** — 63 city blocks across downtown, suburbs, the beachfront and the docks, with traffic that drives itself, pedestrians who stroll (and flee), parked cars, and a sea you can almost drive into.
- **Cars to steal and drive** — 8 vehicle types with their own speed, grip and value; arcade physics with drifting, damage and smoke.
- **A wanted system** — crimes witnessed by pedestrians, drivers or officers raise your heat; 1–5 stars bring 1–6 SHD Interceptors that hunt you down. Get pinned and you're **busted**; wreck at speed and you're **wasted**.
- **A five-job story** for Marisol Vega, with dialogue, timers, a passenger to protect, crates to smash and heat to lose — plus cash, stats and a story-complete screen.
- **Endless side work** once the story is told: chop runs (steal anything worth $240+, priced by value and condition) and off-the-books fares with the clock running.
- **Combat** — a pistol with magazines, reloads and ammo pickups; shoot cars, scatter crowds, drive-by from the driver's seat, and watch the stars climb.
- **HUD & minimap** — cash, health, wanted stars, live objective with distance and timer, a bust meter, a weapon panel with magazine pips, a speedometer, district names, an edge arrow that points to off-screen objectives, and a minimap with traffic, police and objective blips.
- **Save & continue** — progress is kept in the browser; the title screen offers Continue.
- **Synthesised sound** — gunshots, crashes, horns, an engine that revs with your speed, sirens that close in, and a slow synthwave pulse — all WebAudio, no audio files.

## How to play

Serve the game folder with any static server — the repo ships one:

```
node serve.ts            # then open http://localhost:8080
```

| Keys | Action |
| --- | --- |
| WASD / arrows | Walk and drive |
| Shift | Sprint on foot |
| F or E | Enter / exit a car, talk to Marisol |
| Mouse | Aim (on foot, or out the driver's window) |
| Click / hold | Shoot — on foot, or drive-by while driving |
| R | Reload |
| Space | Handbrake |
| P / Esc | Pause |
| M | Mute |

Start at **Vega Auto Works** (west side): walk to Marisol's porch and press F for your first job. Lose the police by breaking line of sight — heat cools when no officer can see you. Ammo pickups sit at the chop shop, the marina and the hospital. When the story is done, Marisol keeps the side work coming.

## Layout

- `game/` — the game itself: `index.html` plus ES modules in `game/src/`, one job each (city, vehicles, people, police, combat, missions, hud, render, audio, save, shots…).
- `main.ts` — the handover program: copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored library.
- `serve.ts` — a tiny local server for playing.
- `screenshots/` — four real renders of the game, staged deterministically through `game/src/shots.js` (`?shot=chase&seed=7` and friends). To re-capture: `node serve.ts`, open each query from `shots.json` at 1280×720, and save the frame as the named JPEG (≤256 KiB).
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

MIT licensed.
