// Sunhaven's handover program (Node 22, standard library only).
//
// The game is the game/ folder beside this file: plain static files that a
// desktop browser opens offline — no build step, no network, nothing to
// install. This program performs the handover the gta6-01 kit prescribes:
// copy game/ and screenshots/ into the output directory, then write
// dossier.json there with the vendored make.fun library.
//
// The grader runs it with the real output directory in place; by hand:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// To simply play: node serve.ts, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Pre-flight: name any screenshot from shots.json that is not on disk yet.
// The dossier builder refuses an entry with a missing screen anyway; this
// just says which one, in plain words, before the refusal arrives.
try {
  const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
  for (const shot of shots) {
    if (!existsSync(join(here, 'screenshots', shot.name))) {
      console.error(`warning: screenshots/${shot.name} is missing — capture it before handing in (see README)`);
    }
  }
} catch {
  // No readable shots.json: the copy below and the builder will say so.
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps are the scorer's own, from the kit's gate: the dossier text is
// capped, screenshots are at most 4 files of at most 256 KiB apiece, and
// game/ holds at most 993 entries and 48 MiB, no path longer than 1000
// bytes. The library enforces them while it builds.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// A one-line receipt for whoever ran this by hand: what was handed in.
const gameFiles = readdirSync(join(out, 'game'), { recursive: true }).length;
const shotFiles = readdirSync(join(out, 'screenshots')).length;
const dossierBytes = statSync(join(out, 'dossier.json')).size;
console.log(`Sunhaven handed in: ${gameFiles} game files, ${shotFiles} screenshots, dossier ${dossierBytes} bytes → ${out}`);
