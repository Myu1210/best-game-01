// HEARTSTAR — world: the whole simulation, one fixed 1/60 s step at a time.
// One job: rules. Player, enemies, bullets, shards, pickups, particles,
// waves, the boss, the Heart, scoring and win/lose. No drawing, no DOM.
import { BOSS, COLORS, COMBO_MAX, COMBO_WINDOW, ENEMY, HEART, PLAYER, SCORE, STEP, VIEW, WIN_WAVE, waveSpec } from './config.js';
import { int, makeRng, pick } from './random.js';

export const MODE_TITLE = 'title';
export const MODE_PLAY = 'play';
export const MODE_PAUSED = 'paused';
export const MODE_OVER = 'over';
export const MODE_VICTORY = 'victory';

const TAU = Math.PI * 2;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export class World {
  constructor(sfx) {
    this.sfx = sfx;
    this.rng = makeRng(1);
    this.time = 0;
    this.mode = MODE_TITLE;
    this.stars = [];
    this.reset(1);
  }

  reset(seed) {
    this.rng = makeRng(seed);
    this.time = 0;
    this.mode = MODE_TITLE;
    this.score = 0;
    this.best = 0;
    try {
      this.best = Number(window.localStorage.getItem('heartstar-best') || 0) || 0;
    } catch { this.best = 0; }
    this.combo = 0;
    this.comboTimer = 0;
    this.wave = 0;
    this.waveState = 'idle'; // idle | banner | spawning | fighting
    this.bannerTimer = 0;
    this.bannerText = '';
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.spawnInterval = 1;
    this.boss = null;
    this.heart = { hp: HEART.maxHp, maxHp: HEART.maxHp, flash: 0 };
    this.player = this._freshPlayer();
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.shards = [];
    this.pickups = [];
    this.particles = [];
    this.floaters = [];
    this.shake = 0;
    this.kills = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.shardsGot = 0;
    this.ambientTimer = 0;
    this.stars = [];
    for (let i = 0; i < 150; i += 1) {
      this.stars.push({
        x: this.rng() * VIEW.width,
        y: this.rng() * VIEW.height,
        r: 0.6 + this.rng() * 1.6,
        tw: this.rng() * TAU,
      });
    }
  }

  _freshPlayer() {
    return {
      x: VIEW.width / 2,
      y: VIEW.height - 110,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      r: PLAYER.radius,
      lives: PLAYER.lives,
      fireCd: 0,
      spread: 0,
      rapid: 0,
      shield: 0,
      invuln: 0,
      alive: true,
      respawnTimer: 0,
    };
  }

  /** Begin a fresh run from the title screen. */
  startGame() {
    const seed = (Date.now() % 2147483647) | 0;
    this.reset(seed === 0 ? 1 : seed);
    this.mode = MODE_PLAY;
    this._startWave(1);
    this.sfx.ensure();
    this.sfx.startDrone();
    this.sfx.wave();
  }

  _startWave(n) {
    this.wave = n;
    const spec = waveSpec(n);
    this.spawnInterval = spec.spawnInterval;
    this.spawnQueue = [];
    for (let i = 0; i < spec.motes; i += 1) this.spawnQueue.push('mote');
    for (let i = 0; i < spec.darts; i += 1) this.spawnQueue.push('dart');
    for (let i = 0; i < spec.brutes; i += 1) this.spawnQueue.push('brute');
    for (let i = 0; i < spec.spitters; i += 1) this.spawnQueue.push('spitter');
    // Shuffle so kinds arrive mixed.
    for (let i = this.spawnQueue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.rng() * (i + 1));
      [this.spawnQueue[i], this.spawnQueue[j]] = [this.spawnQueue[j], this.spawnQueue[i]];
    }
    if (spec.boss) this.spawnQueue.unshift('boss'); // the boss leads; mobs trickle in behind it
    this.spawnTimer = 0.6;
    this.waveState = 'banner';
    this.bannerTimer = 2.0;
    this.bannerText = spec.boss ? `WAVE ${n} — ${BOSS[n].name}` : `WAVE ${n}`;
  }

  _edgePoint() {
    const side = int(this.rng, 0, 3);
    const m = 30;
    if (side === 0) return { x: this.rng() * VIEW.width, y: -m };
    if (side === 1) return { x: this.rng() * VIEW.width, y: VIEW.height + m };
    if (side === 2) return { x: -m, y: this.rng() * VIEW.height };
    return { x: VIEW.width + m, y: this.rng() * VIEW.height };
  }

  _spawnEnemy(kind) {
    const p = this._edgePoint();
    if (kind === 'boss') {
      const def = BOSS[this.wave];
      // The boss warps in on its orbit ring, never crossing the Heart on entry.
      const a = this.rng() * TAU;
      const bx = HEART.x + Math.cos(a) * 260;
      const by = HEART.y + Math.sin(a) * 260;
      const boss = {
        kind: 'boss', x: bx, y: by, vx: 0, vy: 0, r: def.r, hp: def.hp, maxHp: def.hp,
        speed: def.speed, score: def.score, heartDmg: def.heartDmg, t: 0,
        fireCd: 2.0, burstCd: 3.0, spawnCd: 6.0, orbit: a,
      };
      this.enemies.push(boss);
      this.boss = boss;
      this.sfx.boss();
      this._burst(bx, by, COLORS.boss, 40);
      return;
    }
    const def = ENEMY[kind];
    const wob = this.rng() * TAU;
    this.enemies.push({
      kind, x: p.x, y: p.y, vx: 0, vy: 0, r: def.r, hp: def.hp, maxHp: def.hp,
      speed: def.speed * (0.9 + this.rng() * 0.25) + this.wave * 2,
      score: def.score, heartDmg: def.heartDmg, t: 0, wob, fireCd: 1.5 + this.rng(),
    });
  }

  /** Ambient drift behind the title screen: motes wander in, never hurt the Heart. */
  stepAmbient(dt) {
    this.time += dt;
    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0 && this.enemies.length < 9) {
      this.ambientTimer = 0.9;
      this._spawnEnemy(pick(this.rng, ['mote', 'mote', 'dart']));
    }
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i];
      this._steerEnemy(e, dt, true);
      if (dist2(e.x, e.y, HEART.x, HEART.y) < (HEART.r + e.r) * (HEART.r + e.r)) {
        this._burst(e.x, e.y, COLORS.heart, 12);
        this.enemies.splice(i, 1);
      }
    }
    this._stepParticles(dt);
    this.shake = Math.max(0, this.shake - dt * 1.5);
  }

  /** One fixed play step. `input` is the Input instance. */
  step(dt, input) {
    if (this.mode !== MODE_PLAY) return;
    this.time += dt;
    this._stepBanner(dt);
    this._stepSpawns(dt);
    this._stepPlayer(dt, input);
    this._stepBullets(dt);
    this._stepEnemies(dt);
    this._stepEnemyBullets(dt);
    this._stepShards(dt);
    this._stepPickups(dt);
    this._stepParticles(dt);
    this._stepFloaters(dt);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    if (this.heart.flash > 0) this.heart.flash -= dt;
    this.shake = Math.max(0, this.shake - dt * 1.6);
    this._checkWaveClear();
  }

  _stepBanner(dt) {
    if (this.waveState === 'banner') {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.waveState = 'spawning';
    }
  }

  _stepSpawns(dt) {
    if (this.waveState !== 'spawning' && this.waveState !== 'fighting') return;
    if (this.spawnQueue.length > 0) {
      this.waveState = 'spawning';
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.spawnInterval;
        this._spawnEnemy(this.spawnQueue.shift());
      }
    } else if (this.waveState === 'spawning') {
      this.waveState = 'fighting';
    }
  }

  _stepPlayer(dt, input) {
    const p = this.player;
    if (!p.alive) {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0 && p.lives > 0) {
        p.alive = true;
        p.x = VIEW.width / 2;
        p.y = VIEW.height - 110;
        p.invuln = PLAYER.respawnInvuln;
      }
      return;
    }
    const mv = input.moveVec();
    p.vx = mv.x * PLAYER.speed;
    p.vy = mv.y * PLAYER.speed;
    p.x = Math.min(VIEW.width - p.r, Math.max(p.r, p.x + p.vx * dt));
    p.y = Math.min(VIEW.height - p.r, Math.max(p.r, p.y + p.vy * dt));
    p.angle = input.aimAngle(p.x, p.y);
    if (p.fireCd > 0) p.fireCd -= dt;
    if (p.spread > 0) p.spread -= dt;
    if (p.rapid > 0) p.rapid -= dt;
    if (p.shield > 0) p.shield -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (input.firing && p.fireCd <= 0) {
      p.fireCd = p.rapid > 0 ? PLAYER.rapidInterval : PLAYER.fireInterval;
      this._fireBullets();
    }
  }

  _fireBullets() {
    const p = this.player;
    const angles = p.spread > 0 ? [-0.16, 0, 0.16] : [0];
    for (const off of angles) {
      const a = p.angle + off;
      this.bullets.push({
        x: p.x + Math.cos(a) * (p.r + 6),
        y: p.y + Math.sin(a) * (p.r + 6),
        vx: Math.cos(a) * PLAYER.bulletSpeed,
        vy: Math.sin(a) * PLAYER.bulletSpeed,
        r: 5, life: 0.9, dmg: 1,
      });
    }
    this.shotsFired += angles.length;
    this.sfx.shoot();
  }

  _stepBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i -= 1) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < -20 || b.x > VIEW.width + 20 || b.y < -20 || b.y > VIEW.height + 20;
      if (!dead) {
        // Bullets can shoot down enemy orbs: the only defence against a burst.
        for (let k = this.enemyBullets.length - 1; k >= 0; k -= 1) {
          const ob = this.enemyBullets[k];
          const rr = ob.r + b.r;
          if (dist2(b.x, b.y, ob.x, ob.y) < rr * rr) {
            this.enemyBullets.splice(k, 1);
            this._burst(ob.x, ob.y, COLORS.orb, 4);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (let j = this.enemies.length - 1; j >= 0; j -= 1) {
          const e = this.enemies[j];
          const rr = e.r + b.r;
          if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
            e.hp -= b.dmg;
            this.shotsHit += 1;
            this.sfx.enemyHit();
            this._burst(b.x, b.y, '#ffffff', 3);
            dead = true;
            if (e.hp <= 0) this._killEnemy(j);
            break;
          }
        }
      }
      if (dead) this.bullets.splice(i, 1);
    }
  }

  _steerEnemy(e, dt, ambient) {
    e.t += dt;
    const dx = HEART.x - e.x;
    const dy = HEART.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    if (e.kind === 'boss') {
      // Ride the orbit ring exactly: advance the angle at speed/radius so the
      // boss never cuts the corner and spirals into the Heart.
      e.orbit += dt * (e.speed / 250);
      e.x = HEART.x + Math.cos(e.orbit) * 250;
      e.y = HEART.y + Math.sin(e.orbit) * 250;
      // Velocity along the ring, for anything that leads its aim.
      e.vx = -Math.sin(e.orbit) * e.speed;
      e.vy = Math.cos(e.orbit) * e.speed;
      return;
    }
    if (e.kind === 'spitter' && !ambient && d < 330) {
      // Hold a standoff ring and strafe.
      const strafe = Math.sin(e.t * 1.4 + e.wob) * 60;
      e.vx = (-dy / d) * strafe + (dx / d) * e.speed * 0.25;
      e.vy = (dx / d) * strafe + (dy / d) * e.speed * 0.25;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      return;
    }
    let mx = dx / d;
    let my = dy / d;
    if (e.kind === 'dart') {
      const wob = Math.sin(e.t * 6 + e.wob) * 0.45;
      const px = -my * wob;
      const py = mx * wob;
      mx += px;
      my += py;
      const m = Math.hypot(mx, my) || 1;
      mx /= m;
      my /= m;
    }
    e.vx = mx * e.speed;
    e.vy = my * e.speed;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
  }

  _stepEnemies(dt) {
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i];
      this._steerEnemy(e, dt, false);
      if (e.kind === 'boss') this._stepBoss(e, dt, i);
      if (e.kind === 'spitter') {
        e.fireCd -= dt;
        if (e.fireCd <= 0 && this.player.alive) {
          e.fireCd = 2.3;
          const a = Math.atan2(this.player.y - e.y, this.player.x - e.x);
          this.enemyBullets.push({
            x: e.x, y: e.y,
            vx: Math.cos(a) * 160, vy: Math.sin(a) * 160,
            r: 7, life: 5,
          });
          this.sfx.blip(300, 180, 0.12, 'square', 0.05);
        }
      }
      // Reached the Heart: it bites, the Heart bleeds.
      const rr = HEART.r + e.r;
      if (dist2(e.x, e.y, HEART.x, HEART.y) < rr * rr) {
        this._hurtHeart(e.heartDmg, e.x, e.y);
        this._burst(e.x, e.y, COLORS.heart, 16);
        this.enemies.splice(i, 1);
        if (e.kind === 'boss') this.boss = null;
        continue;
      }
      // Touched the player.
      const p = this.player;
      if (p.alive && p.invuln <= 0) {
        const pr = p.r + e.r;
        if (dist2(p.x, p.y, e.x, e.y) < pr * pr) {
          if (e.kind === 'boss') {
            // The boss is too big to die by ramming: it only hurts you.
            this._hurtPlayer();
          } else if (p.shield > 0) {
            this._killEnemy(i, false);
            this._addScore(e.score, e.x, e.y);
            this._burst(p.x, p.y, COLORS.good, 10);
          } else {
            this._killEnemy(i, false);
            this._hurtPlayer();
          }
        }
      }
    }
  }

  _stepBoss(boss, dt, index) {
    boss.fireCd -= dt;
    boss.burstCd -= dt;
    boss.spawnCd -= dt;
    const p = this.player;
    if (boss.fireCd <= 0 && p.alive) {
      boss.fireCd = 2.2;
      const base = Math.atan2(p.y - boss.y, p.x - boss.x);
      for (const off of [-0.22, 0, 0.22]) {
        this.enemyBullets.push({
          x: boss.x, y: boss.y,
          vx: Math.cos(base + off) * 190, vy: Math.sin(base + off) * 190,
          r: 8, life: 6,
        });
      }
    }
    if (boss.burstCd <= 0) {
      boss.burstCd = 4.0;
      const n = 8;
      for (let k = 0; k < n; k += 1) {
        const a = (k / n) * TAU + boss.t;
        this.enemyBullets.push({
          x: boss.x, y: boss.y,
          vx: Math.cos(a) * 135, vy: Math.sin(a) * 135,
          r: 7, life: 5.5,
        });
      }
      this.sfx.blip(140, 60, 0.4, 'sawtooth', 0.15);
    }
    if (boss.spawnCd <= 0) {
      boss.spawnCd = 7.0;
      this._spawnEnemy('mote');
    }
    // Boss death is handled in _killEnemy; index unused here.
    void index;
  }

  _stepEnemyBullets(dt) {
    const p = this.player;
    for (let i = this.enemyBullets.length - 1; i >= 0; i -= 1) {
      const b = this.enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < -30 || b.x > VIEW.width + 30 || b.y < -30 || b.y > VIEW.height + 30;
      if (!dead && p.alive && p.invuln <= 0) {
        const rr = p.r + b.r;
        if (dist2(b.x, b.y, p.x, p.y) < rr * rr) {
          dead = true;
          if (p.shield > 0) {
            this._burst(p.x, p.y, COLORS.good, 8);
          } else {
            this._hurtPlayer();
          }
        }
      }
      // Orbs can also bite the Heart.
      if (!dead) {
        const rr = HEART.r + b.r;
        if (dist2(b.x, b.y, HEART.x, HEART.y) < rr * rr) {
          dead = true;
          this._hurtHeart(1, b.x, b.y);
        }
      }
      if (dead) this.enemyBullets.splice(i, 1);
    }
  }

  _stepShards(dt) {
    const p = this.player;
    for (let i = this.shards.length - 1; i >= 0; i -= 1) {
      const s = this.shards[i];
      s.t += dt;
      s.life -= dt;
      if (p.alive) {
        const d = Math.hypot(p.x - s.x, p.y - s.y) || 1;
        if (d < 160) {
          const pull = 520 * (1 - d / 200);
          s.vx += ((p.x - s.x) / d) * pull * dt * 4;
          s.vy += ((p.y - s.y) / d) * pull * dt * 4;
        }
      }
      s.vx *= 0.98;
      s.vy *= 0.98;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.life <= 0) { this.shards.splice(i, 1); continue; }
      if (p.alive && dist2(s.x, s.y, p.x, p.y) < 26 * 26) {
        this.shards.splice(i, 1);
        this.shardsGot += 1;
        this._addScore(SCORE.shard, s.x, s.y, true);
        this.sfx.shard();
      }
    }
  }

  _stepPickups(dt) {
    const p = this.player;
    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      const u = this.pickups[i];
      u.t += dt;
      u.life -= dt;
      u.y += Math.sin(u.t * 2) * 12 * dt;
      if (p.alive) {
        const d = Math.hypot(p.x - u.x, p.y - u.y) || 1;
        if (d < 120) {
          u.x += ((p.x - u.x) / d) * 160 * dt;
          u.y += ((p.y - u.y) / d) * 160 * dt;
        }
        if (d < 30) {
          this.pickups.splice(i, 1);
          if (u.kind === 'spread') p.spread = 10;
          if (u.kind === 'rapid') p.rapid = 10;
          if (u.kind === 'shield') p.shield = 6;
          this._floater(u.x, u.y - 14, u.label, COLORS.good);
          this.sfx.pickup();
          continue;
        }
      }
      if (u.life <= 0) this.pickups.splice(i, 1);
    }
  }

  _stepParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) { this.particles.splice(i, 1); continue; }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.96;
      pt.vy *= 0.96;
    }
  }

  _stepFloaters(dt) {
    for (let i = this.floaters.length - 1; i >= 0; i -= 1) {
      const f = this.floaters[i];
      f.life -= dt;
      f.y -= 34 * dt;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
  }

  _checkWaveClear() {
    if (this.mode !== MODE_PLAY) return;
    if (this.waveState === 'idle' || this.waveState === 'banner') return;
    if (this.spawnQueue.length === 0 && this.enemies.length === 0 && !this.boss) {
      if (this.wave >= WIN_WAVE) return; // victory is set on the boss kill
      this._startWave(this.wave + 1);
      this.sfx.wave();
    }
  }

  _killEnemy(index, award = true) {
    const e = this.enemies[index];
    this.enemies.splice(index, 1);
    const color = e.kind === 'boss' ? COLORS.boss : COLORS[e.kind] || '#ffffff';
    this._burst(e.x, e.y, color, e.kind === 'boss' ? 60 : e.kind === 'brute' ? 22 : 12);
    this.shake = Math.min(1, this.shake + (e.kind === 'boss' ? 0.9 : e.kind === 'brute' ? 0.35 : 0.12));
    this.sfx.boom(e.kind === 'boss' || e.kind === 'brute');
    if (e.kind === 'boss') {
      this.boss = null;
      if (award) this._addScore(e.score, e.x, e.y);
      this.kills += 1;
      // Boss shards rain.
      for (let k = 0; k < 8; k += 1) this._dropShard(e.x, e.y);
      if (this.wave >= WIN_WAVE) {
        this._winGame();
        return;
      }
      return;
    }
    if (award) {
      this._addScore(e.score, e.x, e.y);
      this.kills += 1;
      const n = e.kind === 'brute' ? 3 : e.kind === 'spitter' ? 2 : 1;
      for (let k = 0; k < n; k += 1) this._dropShard(e.x, e.y);
      if (this.rng() < 0.10) this._dropPickup(e.x, e.y);
    }
  }

  _addScore(base, x, y, quiet = false) {
    this.combo = Math.min(this.combo + 1, COMBO_MAX);
    this.comboTimer = COMBO_WINDOW;
    const mult = Math.max(1, this.combo);
    const gained = base * mult;
    this.score += gained;
    if (!quiet) this._floater(x, y - 10, `+${gained}`, mult > 1 ? COLORS.shard : COLORS.hud);
  }

  _dropShard(x, y) {
    const a = this.rng() * TAU;
    const sp = 40 + this.rng() * 90;
    this.shards.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      t: 0, life: 9,
    });
  }

  _dropPickup(x, y) {
    const kind = pick(this.rng, ['spread', 'spread', 'rapid', 'shield']);
    const label = kind === 'spread' ? 'SPREAD' : kind === 'rapid' ? 'RAPID' : 'SHIELD';
    this.pickups.push({ kind, label, x, y, t: 0, life: 12 });
  }

  _hurtPlayer() {
    const p = this.player;
    this._burst(p.x, p.y, COLORS.player, 30);
    this.shake = Math.min(1, this.shake + 0.6);
    this.sfx.hurt();
    p.lives -= 1;
    p.alive = false;
    p.respawnTimer = 1.2;
    this.combo = 0;
    this.comboTimer = 0;
    if (p.lives <= 0) this._endGame();
  }

  _hurtHeart(dmg, x, y) {
    this.heart.hp -= dmg;
    this.heart.flash = 0.35;
    this.shake = Math.min(1, this.shake + 0.5);
    this.sfx.heartHit();
    this._floater(HEART.x, HEART.y - HEART.r - 18, `-${dmg} HEART`, COLORS.warn);
    if (this.heart.hp <= 0) {
      this.heart.hp = 0;
      this._burst(HEART.x, HEART.y, COLORS.heart, 70);
      this._endGame();
    }
    void x;
    void y;
  }

  _endGame() {
    this.mode = MODE_OVER;
    this.sfx.stopDrone();
    this.sfx.lose();
    this._saveBest();
  }

  _winGame() {
    this.mode = MODE_VICTORY;
    this.sfx.stopDrone();
    this.sfx.win();
    this._saveBest();
  }

  _saveBest() {
    if (this.score > this.best) {
      this.best = this.score;
      try {
        window.localStorage.setItem('heartstar-best', String(this.best));
      } catch { /* storage unavailable */ }
    }
  }

  _burst(x, y, color, n) {
    for (let i = 0; i < n; i += 1) {
      const a = this.rng() * TAU;
      const sp = 40 + this.rng() * 260;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.35 + this.rng() * 0.5, max: 0.85,
        size: 1.5 + this.rng() * 3, color,
      });
    }
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
  }

  _floater(x, y, text, color) {
    this.floaters.push({ x, y, text, color, life: 1.0 });
    if (this.floaters.length > 24) this.floaters.shift();
  }

  get accuracy() {
    return this.shotsFired === 0 ? 0 : Math.round((this.shotsHit / this.shotsFired) * 100);
  }

  get mult() {
    return Math.max(1, this.combo);
  }
}
