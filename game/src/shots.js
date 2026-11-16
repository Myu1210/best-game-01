// HEARTSTAR — shots: deterministic screenshot scenes behind ?shot=<scene>&seed=<n>.
// One job: stage a scene by playing the real rules forward from a fresh world
// for a fixed number of fixed steps, steered by a simple autopilot (chase the
// nearest enemy, keep ~240 px from it, dodge orbs, fire constantly), so the
// frame is what a real game looks like and the same seed always gives the same
// frame. window.__shotReady is set by main.js once the scene is drawn.
import { STEP, VIEW } from './config.js';
import { MODE_OVER, MODE_PLAY, MODE_TITLE, MODE_VICTORY } from './world.js';

const PLAY_SECONDS = 20;
const PLAY_WAVE = 6;
const BOSS_SECONDS = 55;
const VICTORY_LIMIT_SECONDS = 150;
const TITLE_SECONDS = 5;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Fake input the autopilot drives: moveVec, aimAngle and firing. */
export function autopilotInput(world) {
  const p = world.player;
  const input = {
    _mx: 0,
    _my: 0,
    _aim: -Math.PI / 2,
    firing: false,
    moveVec() { return { x: this._mx, y: this._my }; },
    aimAngle() { return this._aim; },
  };
  if (!p.alive) return input;
  const heartD = (e) => dist2(e.x, e.y, VIEW.width / 2, VIEW.height / 2);
  const playerD = (e) => dist2(e.x, e.y, p.x, p.y);
  // Threat order: anything about to bite the Heart first; then the closest
  // enemy to us (short bullet flight = hits land); then the boss; then the
  // nearest enemy overall. Clearing the field first is what keeps the Heart
  // alive — the boss is a damage sponge that eats bullets meant for mobs.
  let target = null;
  let bestUrgent = Infinity;
  let urgentMob = false;
  for (const e of world.enemies) {
    if (heartD(e) < 280 * 280 && heartD(e) < bestUrgent) { bestUrgent = heartD(e); target = e; urgentMob = true; }
  }
  if (!target) {
    let bd = 380 * 380;
    for (const e of world.enemies) {
      const d = playerD(e);
      if (d < bd) { bd = d; target = e; }
    }
  }
  if (!target) target = world.boss;
  if (!target) {
    let bd = Infinity;
    for (const e of world.enemies) {
      const d = playerD(e);
      if (d < bd) { bd = d; target = e; }
    }
  }
  if (!target) return input;
  // Incoming orbs outrank everything when one is close — unless something is
  // a heartbeat from biting the Heart, which outranks even that. Bullets
  // destroy orbs.
  let orbTarget = null;
  let orbD = 200 * 200;
  const aboutToBite = world.enemies.some((e) => heartD(e) < 160 * 160);
  if (!aboutToBite) {
    for (const b of world.enemyBullets) {
      const d = dist2(p.x, p.y, b.x, b.y);
      if (d < orbD) { orbD = d; orbTarget = b; }
    }
  }
  if (orbTarget) {
    target = { x: orbTarget.x, y: orbTarget.y, vx: orbTarget.vx, vy: orbTarget.vy, hp: 1, kind: 'orb' };
  }
  // Lead the target: aim where it will be when the bullet arrives.
  const bd = Math.hypot(target.x - p.x, target.y - p.y) || 1;
  const flight = bd / 860;
  const tx = target.x + (target.vx || 0) * flight;
  const ty = target.y + (target.vy || 0) * flight;
  input._aim = Math.atan2(ty - p.y, tx - p.x);
  // Fire discipline: hold fire beyond bullet range (860 px/s x 0.9 s life),
  // and don't stack bullets on a target that already has enough flying at it
  // (each bullet deals 1; a 1-HP mote needs exactly one). A bullet counts as
  // inbound when it is flying at the target, not merely near it.
  let inbound = 0;
  for (const b of world.bullets) {
    const dx = target.x - b.x;
    const dy = target.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > 700) continue;
    const bl = Math.hypot(b.vx, b.vy) || 1;
    const dot = (b.vx / bl) * (dx / d) + (b.vy / bl) * (dy / d);
    if (dot > 0.85) inbound += 1;
  }
  input.firing = bd < 650 && inbound < (target.hp || 1);
  // Desired spot: ~200 px from the target (260 from a boss), on our side of
  // it, clear of the Heart — plus a slow weave so aimed shots miss us.
  const standOff = target.kind === 'boss' ? 260 : 200;
  let dx = p.x - target.x;
  let dy = p.y - target.y;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d;
  dy /= d;
  const weave = Math.sin(world.time * 0.9) * 60;
  let gx = target.x + dx * standOff + -dy * weave;
  let gy = target.y + dy * standOff + dx * weave;
  // Detour for a nearby pickup when nothing is about to bite the Heart.
  const urgent = world.enemies.some((e) => heartD(e) < 180 * 180);
  if (!urgent && world.pickups.length > 0) {
    let pk = null;
    let pd = 400 * 400;
    for (const u of world.pickups) {
      const dd = dist2(p.x, p.y, u.x, u.y);
      if (dd < pd) { pd = dd; pk = u; }
    }
    if (pk) { gx = pk.x; gy = pk.y; }
  }
  const hdx = gx - VIEW.width / 2;
  const hdy = gy - VIEW.height / 2;
  const hd = Math.hypot(hdx, hdy) || 1;
  if (hd < 110) {
    gx = VIEW.width / 2 + (hdx / hd) * 110;
    gy = VIEW.height / 2 + (hdy / hd) * 110;
  }
  gx = Math.min(VIEW.width - 30, Math.max(30, gx));
  gy = Math.min(VIEW.height - 30, Math.max(30, gy));
  let mx = gx - p.x;
  let my = gy - p.y;
  // Dodge overrides positioning: an orb close by means run sideways to its
  // path, now, and nothing else.
  let dodging = false;
  for (const b of world.enemyBullets) {
    const bod = dist2(p.x, p.y, b.x, b.y);
    if (bod < 130 * 130) {
      const bl = Math.hypot(b.vx, b.vy) || 1;
      mx = (-b.vy / bl) * 300;
      my = (b.vx / bl) * 300;
      dodging = true;
      break;
    }
  }
  // Never crowd the boss: inside 200 px, run straight away from it.
  if (!dodging && world.boss) {
    const bdx = p.x - world.boss.x;
    const bdy = p.y - world.boss.y;
    const bd2 = Math.hypot(bdx, bdy) || 1;
    if (bd2 < 200) {
      mx = (bdx / bd2) * 300;
      my = (bdy / bd2) * 300;
    }
  }
  // Hold still once we are on station: a stable firing platform hits more.
  if (Math.hypot(mx, my) < 40) { mx = 0; my = 0; }
  const m = Math.hypot(mx, my) || 1;
  input._mx = mx / m;
  input._my = my / m;
  return input;
}

/** Deep-copy the world's visible state (plain data only; rng/sfx untouched). */
function snapshotWorld(world) {
  const snap = structuredClone({
    time: world.time, score: world.score, combo: world.combo,
    comboTimer: world.comboTimer, wave: world.wave, waveState: world.waveState,
    bannerTimer: world.bannerTimer, bannerText: world.bannerText,
    spawnQueue: world.spawnQueue, spawnTimer: world.spawnTimer,
    spawnInterval: world.spawnInterval, heart: world.heart,
    player: world.player, bullets: world.bullets,
    enemyBullets: world.enemyBullets, enemies: world.enemies,
    shards: world.shards, pickups: world.pickups, particles: world.particles,
    floaters: world.floaters, shake: world.shake, kills: world.kills,
    shotsFired: world.shotsFired, shotsHit: world.shotsHit,
    shardsGot: world.shardsGot, mode: world.mode,
  });
  return snap;
}

/** Restore a snapshot taken by snapshotWorld. */
function restoreWorld(world, snap) {
  Object.assign(world, structuredClone(snap));
  world.boss = world.enemies.find((e) => e.kind === 'boss') || null;
}

/** How busy a frame looks: enemies weigh most, then orbs, bullets, shards. */
function actionScore(world) {
  return world.enemies.length * 3 + world.enemyBullets.length * 2
    + world.bullets.length + world.shards.length
    + Math.floor(world.particles.length / 4);
}
export function stageShot(name, world, seed) {
  world.reset(seed);
  if (name === 'play') {
    world.mode = MODE_PLAY;
    world._startWave(PLAY_WAVE);
    // Keep the busiest real moment: the autopilot clears waves fast, so the
    // field is sparsest at the end. Snapshot the peak-action state and show it.
    let best = null;
    let bestScore = -1;
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      if (world.mode !== MODE_PLAY) break;
      world.step(STEP, autopilotInput(world));
      const s = actionScore(world);
      if (s > bestScore) {
        bestScore = s;
        best = snapshotWorld(world);
      }
    }
    if (best) restoreWorld(world, best);
    return { mode: world.mode, wave: world.wave };
  }
  if (name === 'boss') {
    world.mode = MODE_PLAY;
    world._startWave(5);
    for (let i = 0; i < BOSS_SECONDS / STEP; i += 1) {
      if (world.mode !== MODE_PLAY) break;
      world.step(STEP, autopilotInput(world));
      if (world.boss && world.waveState === 'fighting') {
        // Keep fighting the boss a while so the frame is mid-battle.
        for (let j = 0; j < 14 / STEP; j += 1) {
          if (world.mode !== MODE_PLAY || !world.boss) break;
          world.step(STEP, autopilotInput(world));
        }
        break;
      }
    }
    return { mode: world.mode, wave: world.wave };
  }
  if (name === 'victory') {
    world.mode = MODE_PLAY;
    world._startWave(10);
    for (let i = 0; i < VICTORY_LIMIT_SECONDS / STEP; i += 1) {
      if (world.mode !== MODE_PLAY) break;
      world.step(STEP, autopilotInput(world));
    }
    return { mode: world.mode, wave: world.wave };
  }
  // Title: ambient drift behind the title screen.
  for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) world.stepAmbient(STEP);
  world.mode = MODE_TITLE;
  return { mode: MODE_TITLE, wave: 0 };
}

export { MODE_OVER, MODE_PLAY, MODE_TITLE, MODE_VICTORY };
