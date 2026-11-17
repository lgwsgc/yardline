// YARDLINE — a threejs-fps-01 entry (Node 22, standard library only). The game
// is the game/ folder beside this file: plain static files the browser loads as
// ES modules, with three.js from an import map. This program hands the entry
// in: it copies game/ and screenshots/ into the output directory and writes
// dossier.json, the summary the judge reads, with the vendored make.fun
// library. First to 3 rounds wins; plant the relay or wipe the other team.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// dossier bytes; the others refuse an entry the scorer would refuse — more
// than 4 screenshots or one over 256 KiB, more than 993 files in game/ or
// 48 MiB of game files, a game path longer than 1000 bytes.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const root = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

if (!existsSync(join(root, 'game'))) {
  throw new Error('game/ is missing beside main.ts: nothing to hand in');
}
mkdirSync(out, { recursive: true });
cpSync(join(root, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(root, 'screenshots'))) {
  cpSync(join(root, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

writeFileSync(join(out, 'dossier.json'), buildDossier(out, CAPS));
