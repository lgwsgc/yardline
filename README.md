# YARDLINE — 3v3 Tactical FPS

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/lgwsgc/yardline/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/lgwsgc/yardline/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A Counter-Strike-style round-based tactical FPS in a dusk container yard, built with three.js. You plus two AI teammates (Vex, Mira) against three enemy bots (Rook, Juno, Kade). First team to 3 rounds wins, at most 5 rounds.

## How a round plays

- **Sides alternate every round.** Round 1: your team (AZURE) attacks. Attackers plant the relay on the pad at the north end of mid (hold **E** for 4 seconds); the charge completes 20 seconds later unless defenders defuse it (hold **E** for 5 seconds). Rounds also end by elimination or by the 90-second timer (defenders win on timeout).
- **Economy.** Start with $800. Kills pay $300, round wins $1,000, round losses $500. Weapons persist across rounds; ammo refills each round; grenades are per-round consumables.
- **Buy phase.** 12 seconds before each round: click a row or press **1–5**, then **Deploy** (or **Enter**).
- **Death.** You spectate a living teammate — click or press **Space** to switch between them. The round continues without you.

## Arsenal

| Weapon | Price | Role |
| --- | --- | --- |
| P9 pistol | free | Semi-auto sidearm, 22 dmg |
| VK-7 rifle | $1,200 | Full-auto workhorse, 28 dmg, 4× headshot |
| Hornet-9 SMG | $800 | Fast full-auto, 16 dmg |
| Longshot DMR | $2,000 | Slow semi-auto, 65 dmg, 2× headshot |
| Frag grenade | $300 | 1.2 s fuse, 5.5 m radius |

Spread rewards standing still, crouching and aiming down sights, and punishes moving and spraying (bloom). Friendly fire is off: teammates can never be hurt by your shots or grenades, and your own bots never target you.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move |
| Mouse | Aim, click to fire |
| Right mouse | Aim down sights |
| R | Reload |
| 1–4 | Switch weapon (buy phase: buy) |
| 5 | Buy frag grenade (buy phase) |
| Space | Jump (spectating: switch teammate) |
| Ctrl / C | Crouch |
| E | Plant / defuse the relay |
| G | Throw grenade |
| Enter | Deploy (buy phase) |

## Running it

No build step — plain static files. Serve the repo root and open `game/`:

```sh
node serve.ts        # then http://localhost:8080
```

Or any static server pointed at the repo root (the import map resolves `three` to `game/vendor/three/`).

## Layout

- `game/index.html` — page, HUD, import map
- `game/src/boot.js` — renderer, game loop, shooting, camera, spectating, screenshot staging
- `game/src/yard.js` — the 44×36 m container yard, colliders, waypoint graph
- `game/src/look.js` — dusk palette, seeded RNG, procedural canvas textures
- `game/src/crew.js` — bot AI (sensing, combat, plant/defuse, guarding)
- `game/src/arms.js` — weapons, viewmodels, tracers, grenades
- `game/src/match.js` — rounds, phases, economy, plant/defuse timers
- `game/src/body.js` — player movement, collision, health
- `game/src/keys.js` — keyboard, mouse, pointer lock
- `game/src/sfx.js` — synthesized WebAudio sound
- `game/src/face.js` — HUD and menus
- `main.ts` — entry point: copies `game/` + `screenshots/` to the output directory and writes `dossier.json`
- `shots.json` — the four staged screenshots (menu, live fire, buy phase, victory)

## Screenshots

The game stages four deterministic scenes for `?shot=start|play|buy|end&seed=1` and sets `window.__shotReady` once each is painted. Capture at 1280×720 JPEG.

## Verification

All checks below were run locally on 2026-11-17 before submission:

- **Syntax:** `node --check` passes on all ten `game/src/*.js` modules.
- **Screenshots:** four 1280×720 JPEGs in `screenshots/`, each under 256 KiB, all four scenes visually confirmed (menu, live fire with hitmarker + tracer + fallen enemy, buy phase, victory).
- **Friendly fire:** a Node unit test imports `crew.js` directly — azure bots never acquire or damage the player (0 hurt calls over 3 sim-seconds at point-blank range), while a crimson bot acquires and damages the player (12 hits in 6 sim-seconds).
- **Playtest:** a headless-Chromium end-to-end run clicks through start → buy (Hornet-9, $800 → $0) → deploy → pointer lock → move → fire (32 → 29) → reload (32/93) → death → spectate → round 2, with zero page errors.
- **Determinism:** `main.ts` run twice produces byte-identical `dossier.json` (417 KB, under the 1.5 MiB cap). Source text is ~105 KB, under the 160 KiB cap.
- **`makefun check`:** passes everything checkable locally; only `transcripts_present` fails, as expected before the transcript bundle is made at submission time.

---

<sub>Entered on [make.fun](https://make.fun/?ref=fa1ga8zv&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
