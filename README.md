# COSTA LUNA — Open-World Crime

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Cervus121212/dusky-heron-84/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Cervus121212/dusky-heron-84/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game for the **gta6-01** bounty on make.fun ($1,666, top 100
paid). Rico Solano is out and the whole coast of Costa Luna is open: steal cars,
outrun Luna PD, and run eight story jobs for fixer Lena Cruz while Det. Marlow
puts the whole department on you.

## The game

- **Open world:** a 9×9 sun-soaked coastal city (576×576 m) — downtown, beach,
  docks, marina — with 69 buildings, a yacht, billboards, palms and a dusk sky
  that slides from golden hour to night over ~8 minutes.
- **8 story jobs, $19,000 total:** First Wheels $500 · The Pickup $800 ·
  Hot Pursuit $1,200 · Dockside Deal $2,000 · Getaway Driver $2,500 ·
  The Informant $3,000 · Beachfront Heist $4,000 · King of Luna $5,000.
- **Luna PD dispatch:** wanted 1–5 stars, cruisers, foot cops, Air One
  helicopter at 3+ stars, roadblocks at 4+ stars, wanted decay when you break
  line of sight.
- **Driving & combat:** arcade car physics (accel/brake/reverse, max 42 m/s),
  14 traffic cars with anti-jam, 12 pedestrians who flee your car, pistol +
  SMG with weapon slots, enemies who shoot back.
- **Systems:** 3 synth radio stations (COSTA 88, LA VOZ 104, ONDA 97), respect
  ranks (ROOKIE → DRIVER → KING), minimap, HUD, localStorage saves.
- **Tech:** three.js 0.160 (minified build vendored under `game/vendor/`),
  WebGL2, fully offline — no network request at all. A 59-check autopilot
  (`?autopilot=1`) verifies the whole game: city, driving, camera, all 8
  missions, police, combat, traffic, pedestrians, radio, save and performance.

## Play

Open `game/index.html` in a browser (or serve the folder statically), or run
the entry point the grader uses:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Controls: WASD drive/walk · E enter car / interact · mouse drag camera ·
click shoot · 1/2 weapons · R radio · M mute · ESC pause.

## Files

- `game/` — the game (index.html + `src/` modules + vendored three.js)
- `screenshots/` — 4 renders (cover first): chase, mission, title
- `main.ts` — the entry point: copies `game/` + `screenshots/` to the output
  directory and writes `dossier.json` with the vendored make.fun library
- `vendor/makefun-game.ts` — the make.fun dossier library (kit copy, unchanged)

## License

MIT — see [LICENSE](LICENSE).
