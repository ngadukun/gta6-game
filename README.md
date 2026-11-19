[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ngadukun/gta6-game/rank.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ngadukun/gta6-game/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Sunhaven — an open-world crime caper

An original open-world crime game, built for the [make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01). No engine, no asset files, no build step: one hand-written coastal city that runs from static files in a desktop browser.

The story in one breath: Leo Santos arrives in **Sunhaven** — pastel blocks, palm-lined promenades, one long beach — with an empty tank and a borrowed name. Marisol Vega, of Vega Auto Works, keeps work for drivers who don't ask questions: a package, a stolen sports car, a nervous accountant, a dockside distraction, and an armoured van carrying the Sunhaven Trust's money. The Sunhaven Police Department has opinions about all of it.

## What's in the city

- **A full open world** — 63 blocks across downtown, the suburbs, the beachfront and the docks, with self-driving traffic, pedestrians who stroll (and flee), parked cars waiting to be borrowed, and a sea you can almost drive into.
- **Cars to steal and drive** — 8 vehicle types, each with its own speed, grip and street value; arcade physics with drifting, damage and smoke.
- **A wanted system with memory** — crimes only count when witnessed; heat cools while nobody can see you. One to five stars bring one to six SHD Interceptors that navigate the roads, match your pace, and bust you if they can hold you still.
- **A five-job story** for Marisol Vega, told with dialogue — timers, a passenger to protect, crates to smash, heat to lose — plus cash, stats and a story-complete screen.
- **Endless side work** after the story: chop runs (steal anything worth $240+, paid by value and condition), off-the-books fares against the clock, and timed delivery runs for packages that officially don't exist.
- **Combat** — a pistol with magazines, reloads and ammo pickups; shoot cars, scatter crowds, fire drive-by from the driver's seat, and watch the stars climb.
- **HUD & minimap** — cash, health, wanted stars, the live objective with distance and timer, a bust meter, a weapon panel with magazine pips, a speedometer, district names, an edge arrow for off-screen objectives, and a minimap with traffic, police and objective blips.
- **Save & continue** — progress persists in the browser; the title screen offers Continue.
- **Synthesised sound** — gunshots, crashes, horns, an engine that revs with your speed, sirens that close in, and a slow synthwave pulse. All WebAudio, no audio files.

## How to play

Serve the game folder with any static file server — the repo ships one:

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

Begin at **Vega Auto Works** on the west side: walk to Marisol's porch and press F for the first job. To lose the police, break line of sight — heat only cools while no officer can see you. Ammo pickups wait at the chop shop, the marina and the hospital. When the story ends, the city doesn't: Marisol keeps the side work coming.

## One city, every time

Sunhaven is dealt from a seed. The city, the traffic, the crowds and the work are all drawn from one seeded stream (`game/src/random.js`), and the simulation advances in fixed steps — so seed 7 is the same city on every machine, and the screenshots in this repo are frames a real session of that seed genuinely reaches. Change the seed in the address (`?seed=42`) and the same streets grow a different town.

## Layout

- `game/` — the game itself: `index.html` plus ES modules in `game/src/`, one responsibility each (city, vehicles, people, police, combat, missions, hud, render, audio, save, shots…).
- `main.ts` — the handover program: copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored library.
- `serve.ts` — a tiny local server for playing.
- `screenshots/` — four real renders of the game, staged deterministically through `game/src/shots.js` (`?shot=chase&seed=7` and friends). To re-capture: run `node serve.ts`, open each query from `shots.json` at 1280×720, and save the frame as the named JPEG (≤256 KiB).
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

MIT licensed.
