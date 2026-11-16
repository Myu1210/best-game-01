# HEARTSTAR — Defend the Heart Star

An original neon arena shooter. Void creatures hunt the Heart Star at the
centre of the arena — if it shatters, the run ends. Fly your ship, shoot them
down, catch the star shards they drop to feed your combo, grab spread / rapid /
shield power-ups, and survive all 10 waves. Bosses on waves 5 (Gloom Maw) and
10 (Void Sovereign). Beat wave 10 to win.

## How to play

- **WASD / arrow keys** — fly
- **Mouse** — aim
- **Hold click or Space** — fire
- **P** — pause, **M** — mute, **R** — restart

Score, combo multiplier, wave, Heart HP and ships are on the HUD; the boss
gets its own health bar. Best score is kept in `localStorage`.

## Structure

- `game/index.html` — the page; loads `game/src/main.js`, nothing else
- `game/src/config.js` — tuning numbers, palette, wave table
- `game/src/random.js` — seeded RNG (deterministic screenshot scenes)
- `game/src/audio.js` — synthesized WebAudio sound effects + drone, no files
- `game/src/input.js` — keyboard + mouse
- `game/src/world.js` — the simulation: fixed 1/60 s steps, waves, boss, scoring
- `game/src/render.js` — all drawing: shapes, gradients and glow, no images
- `game/src/shots.js` — deterministic scenes behind `?shot=<scene>&seed=<n>`
  (title / play / boss / victory), played forward by an autopilot
- `game/src/main.js` — boot, game loop, screen state machine
- `main.ts` — the entry program: copies `game/` + `screenshots/` to `/output`
  and writes `dossier.json` with `vendor/makefun-game.ts`
- `serve.ts` — tiny static server for local play (`node serve.ts`)

Everything runs offline from static files — no network request, no library,
no build step. Screenshots are real renders of the game's own code.

## License

MIT — see `LICENSE`.
