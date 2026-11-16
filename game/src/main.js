// HEARTSTAR — main: boot, the game loop, and the screens' state machine.
// One job: wire input + world + render together. Live play runs a fixed-step
// accumulator (1/60 s steps, render apart); ?shot=<scene>&seed=<n> stages a
// deterministic scene instead and sets window.__shotReady when it is drawn.
import { STEP, VIEW } from './config.js';
import { Sfx } from './audio.js';
import { Input } from './input.js';
import { World, MODE_OVER, MODE_PAUSED, MODE_PLAY, MODE_TITLE, MODE_VICTORY } from './world.js';
import { draw } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const sfx = new Sfx();
const input = new Input(canvas);
const world = new World(sfx);
window.__game = { world, input };

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const shotSeed = Number(params.get('seed') || '1') || 1;

function startRun() {
  sfx.ensure();
  world.startGame();
}

function togglePause() {
  if (world.mode === MODE_PLAY) {
    world.mode = MODE_PAUSED;
    sfx.stopDrone();
  } else if (world.mode === MODE_PAUSED) {
    world.mode = MODE_PLAY;
    sfx.startDrone();
  }
}

input.onPress = (code) => {
  if (code === 'KeyM') {
    sfx.ensure();
    sfx.setMuted(!sfx.muted);
    return;
  }
  if (code === 'KeyP' || code === 'Escape') {
    if (world.mode === MODE_PLAY || world.mode === MODE_PAUSED) togglePause();
    return;
  }
  if (code === 'KeyR') {
    if (world.mode === MODE_PLAY || world.mode === MODE_PAUSED) startRun();
    return;
  }
  if (code === 'Enter' || code === 'Mouse') {
    if (world.mode === MODE_TITLE || world.mode === MODE_OVER || world.mode === MODE_VICTORY) {
      startRun();
    }
  }
};

// Auto-pause when the tab loses focus mid-run.
window.addEventListener('blur', () => {
  if (world.mode === MODE_PLAY) togglePause();
});

if (shotName) {
  // Deterministic screenshot scene: no audio, no live loop, frozen frame.
  const staged = stageShot(shotName, world, shotSeed);
  draw(ctx, world);
  window.__shot = staged;
  window.__shotReady = true;
} else {
  // Live play: fixed-step simulation, render apart from it.
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    if (world.mode === MODE_PLAY) {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 5) {
        world.step(STEP, input);
        acc -= STEP;
        n += 1;
      }
      if (n === 5) acc = 0;
    } else if (world.mode === MODE_TITLE) {
      // Gentle ambient drift behind the title.
      world.stepAmbient(dt);
    }
    draw(ctx, world);
  }
  requestAnimationFrame(frame);
}
