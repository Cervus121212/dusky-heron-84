// COSTA LUNA — the entry point the grader runs (Node, standard library only).
//
// What it does, in order:
//   1. Works out where to write: MAKEFUN_OUTPUT_DIR when set (local runs),
//      otherwise /output (the grader's writable directory — a bind mount, so
//      this file never deletes or recreates it, it only writes inside it).
//   2. Copies this repo's game/ and screenshots/ into the output directory.
//   3. Builds dossier.json from what was just copied, with the scorer's own
//      caps, using the vendored make.fun library. The dossier is what the
//      judge reads: the file list, the source outline, the screenshots.
//
// The game itself is plain static files (game/index.html + ES modules, the
// minified three.js vendored under game/vendor/); it makes no network request
// and runs fully offline. Run locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps for this bounty (from its gate.json). text_max_bytes is
// the only one that shapes the dossier bytes; the rest refuse an entry the
// scorer would refuse anyway: at most 4 screenshots of 256 KiB each, at most
// 993 files / 48 MiB under game/, no game path over 1000 bytes.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    n += entry.isDirectory() ? countFiles(p) : 1;
  }
  return n;
}

function copyEntry(name) {
  const src = join(repoRoot, name);
  if (!existsSync(src)) {
    throw new Error(`COSTA LUNA: missing ${name}/ next to main.ts — nothing to hand in`);
  }
  const dst = join(outDir, name);
  mkdirSync(dst, { recursive: true });
  cpSync(src, dst, { recursive: true });
  return countFiles(dst);
}

// Never remove or recreate outDir itself: on the grader it is a bind mount
// and removing it fails the run. Only create it if it is missing, then fill it.
mkdirSync(outDir, { recursive: true });
const gameFiles = copyEntry('game');
const shotFiles = copyEntry('screenshots');

const dossier = buildDossier(outDir, CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossier);

const dossierBytes = statSync(join(outDir, 'dossier.json')).size;
console.log(
  `COSTA LUNA handed in: ${gameFiles} game files, ${shotFiles} screenshots, ` +
  `dossier.json ${dossierBytes} bytes -> ${outDir}`,
);
