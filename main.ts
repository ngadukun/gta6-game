// Sunhaven's handover program (Node 22, standard library only).
//
// The game itself is the game/ folder beside this file: plain static files a
// desktop browser opens offline, no build step, no network. This program
// hands it in — it copies game/ and screenshots/ into the output directory
// and writes dossier.json there with the vendored make.fun library, exactly
// as the gta6-01 kit prescribes.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play the game locally with: node serve.ts  (then open http://localhost:8080)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps are the scorer's own (the kit's gate): the dossier text is capped,
// screenshots are at most 4 files of at most 256 KiB, and game/ holds at most
// 993 entries, 48 MiB in all, no path longer than 1000 bytes.
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

// A one-line receipt for whoever runs this by hand: what was handed in.
import { readdirSync, statSync } from 'node:fs';
const gameFiles = readdirSync(join(out, 'game'), { recursive: true }).length;
const shotFiles = readdirSync(join(out, 'screenshots')).length;
const dossierBytes = statSync(join(out, 'dossier.json')).size;
console.log(`Sunhaven handed in: ${gameFiles} game files, ${shotFiles} screenshots, dossier ${dossierBytes} bytes → ${out}`);
