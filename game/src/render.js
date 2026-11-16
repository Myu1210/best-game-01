// HEARTSTAR — render: everything the player sees, drawn on one canvas.
// One job: drawing. It reads the world, never changes it. All art is code:
// shapes, gradients and glow — no image files, so screenshots are pure game.
import { COLORS, HEART, VIEW, WIN_WAVE } from './config.js';
import { MODE_OVER, MODE_PAUSED, MODE_TITLE, MODE_VICTORY } from './world.js';

const TAU = Math.PI * 2;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function star(ctx, x, y, r, points, rot) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = rot + (i / (points * 2)) * TAU;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function glowCircle(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function draw(ctx, world) {
  const w = world;
  ctx.save();
  // Screen shake: deterministic wobble from world time, scaled by trauma.
  if (w.shake > 0.01) {
    const s = w.shake * w.shake * 14;
    ctx.translate(Math.sin(w.time * 91.7) * s, Math.cos(w.time * 113.3) * s);
  }
  drawBackground(ctx, w);
  drawHeart(ctx, w);
  drawPickups(ctx, w);
  drawShards(ctx, w);
  drawEnemies(ctx, w);
  drawBullets(ctx, w);
  drawPlayer(ctx, w);
  drawParticles(ctx, w);
  drawFloaters(ctx, w);
  ctx.restore();
  drawHud(ctx, w);
  if (w.waveState === 'banner' && w.mode === 'play') drawBanner(ctx, w);
  if (w.mode === MODE_TITLE) drawTitle(ctx, w);
  else if (w.mode === MODE_PAUSED) drawPaused(ctx, w);
  else if (w.mode === MODE_OVER) drawOver(ctx, w);
  else if (w.mode === MODE_VICTORY) drawVictory(ctx, w);
}

function drawBackground(ctx, w) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  g.addColorStop(0, COLORS.bg1);
  g.addColorStop(1, COLORS.bg0);
  ctx.fillStyle = g;
  ctx.fillRect(-20, -20, VIEW.width + 40, VIEW.height + 40);
  glowCircle(ctx, 220, 150, 320, COLORS.nebulaA, 0.5);
  glowCircle(ctx, 1080, 580, 340, COLORS.nebulaB, 0.45);
  glowCircle(ctx, 1050, 120, 220, '#3d0a4d', 0.4);
  for (const s of w.stars) {
    const a = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(w.time * 1.7 + s.tw));
    ctx.globalAlpha = a;
    ctx.fillStyle = '#cfe4ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHeart(ctx, w) {
  const pulse = 1 + 0.08 * Math.sin(w.time * 2.4);
  const r = HEART.r * pulse;
  const flash = w.heart.flash > 0 ? 0.5 : 0;
  glowCircle(ctx, HEART.x, HEART.y, r * 4.2, COLORS.heart, 0.55 + flash);
  ctx.save();
  ctx.translate(HEART.x, HEART.y);
  ctx.rotate(w.time * 0.25);
  ctx.fillStyle = COLORS.heart;
  star(ctx, 0, 0, r * 1.5, 8, 0);
  ctx.fill();
  ctx.rotate(-w.time * 0.5);
  ctx.fillStyle = COLORS.heartCore;
  star(ctx, 0, 0, r * 0.8, 8, 0);
  ctx.fill();
  ctx.restore();
  // HP ring around the Heart.
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.arc(HEART.x, HEART.y, r + 16, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = w.heart.hp <= 3 ? COLORS.warn : COLORS.heart;
  ctx.beginPath();
  ctx.arc(HEART.x, HEART.y, r + 16, -Math.PI / 2, -Math.PI / 2 + TAU * (w.heart.hp / w.heart.maxHp));
  ctx.stroke();
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`HEART ${w.heart.hp}/${w.heart.maxHp}`, HEART.x, HEART.y + r + 36);
}

function drawPickups(ctx, w) {
  for (const u of w.pickups) {
    const bob = Math.sin(u.t * 3) * 3;
    glowCircle(ctx, u.x, u.y + bob, 26, COLORS.good, 0.5);
    ctx.fillStyle = '#062b16';
    ctx.strokeStyle = COLORS.good;
    ctx.lineWidth = 2;
    rr(ctx, u.x - 15, u.y + bob - 15, 30, 30, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.good;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(u.kind === 'spread' ? 'S' : u.kind === 'rapid' ? 'R' : 'H', u.x, u.y + bob + 4);
  }
}

function drawShards(ctx, w) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const s of w.shards) {
    const a = Math.min(1, s.life);
    ctx.globalAlpha = a;
    ctx.fillStyle = COLORS.shard;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.t * 3);
    ctx.fillRect(-3.5, -3.5, 7, 7);
    ctx.restore();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawEnemies(ctx, w) {
  for (const e of w.enemies) {
    if (e.kind === 'boss') { drawBoss(ctx, e, w); continue; }
    const toHeart = Math.atan2(HEART.y - e.y, HEART.x - e.x);
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.kind === 'mote') {
      glowCircle(ctx, 0, 0, e.r * 2.4, COLORS.mote, 0.5);
      ctx.fillStyle = COLORS.mote;
      ctx.rotate(w.time * 2 + e.wob);
      star(ctx, 0, 0, e.r, 6, 0);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, TAU);
      ctx.fill();
    } else if (e.kind === 'dart') {
      glowCircle(ctx, 0, 0, e.r * 2.2, COLORS.dart, 0.5);
      ctx.rotate(toHeart);
      ctx.fillStyle = COLORS.dart;
      ctx.beginPath();
      ctx.moveTo(e.r + 6, 0);
      ctx.lineTo(-e.r, -e.r * 0.8);
      ctx.lineTo(-e.r * 0.4, 0);
      ctx.lineTo(-e.r, e.r * 0.8);
      ctx.closePath();
      ctx.fill();
    } else if (e.kind === 'brute') {
      glowCircle(ctx, 0, 0, e.r * 2, COLORS.brute, 0.5);
      ctx.fillStyle = COLORS.brute;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * TAU + w.time * 0.6;
        const px = Math.cos(a) * e.r;
        const py = Math.sin(a) * e.r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3d1c00';
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.45, 0, TAU);
      ctx.fill();
      ctx.fillStyle = COLORS.brute;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.2, 0, TAU);
      ctx.fill();
    } else if (e.kind === 'spitter') {
      glowCircle(ctx, 0, 0, e.r * 2.2, COLORS.spitter, 0.5);
      ctx.rotate(Math.PI / 4 + Math.sin(w.time + e.wob) * 0.3);
      ctx.fillStyle = COLORS.spitter;
      ctx.fillRect(-e.r * 0.75, -e.r * 0.75, e.r * 1.5, e.r * 1.5);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // Small hp ticks for tough enemies.
    if (e.maxHp > 1 && e.hp < e.maxHp) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(e.x - 14, e.y - e.r - 10, 28, 4);
      ctx.fillStyle = COLORS.brute;
      ctx.fillRect(e.x - 14, e.y - e.r - 10, 28 * (e.hp / e.maxHp), 4);
    }
  }
}

function drawBoss(ctx, b, w) {
  glowCircle(ctx, b.x, b.y, b.r * 3, COLORS.boss, 0.6);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(w.time * 0.5);
  ctx.strokeStyle = COLORS.boss;
  ctx.lineWidth = 6;
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const a0 = (i / 8) * TAU;
    ctx.arc(0, 0, b.r, a0, a0 + TAU / 16);
  }
  ctx.stroke();
  ctx.rotate(-w.time * 1.1);
  ctx.fillStyle = '#2b0213';
  star(ctx, 0, 0, b.r * 0.85, 7, 0);
  ctx.fill();
  ctx.fillStyle = COLORS.boss;
  ctx.beginPath();
  ctx.arc(0, 0, b.r * 0.32, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, b.r * 0.14, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawBullets(ctx, w) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = COLORS.bullet;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const b of w.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const b of w.enemyBullets) {
    glowCircle(ctx, b.x, b.y, b.r * 2.6, COLORS.orb, 0.7);
    ctx.fillStyle = COLORS.orb;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.35, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayer(ctx, w) {
  const p = w.player;
  if (!p.alive) return;
  if (p.invuln > 0 && Math.floor(w.time * 12) % 2 === 0) return; // respawn blink
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.shield > 0) {
    ctx.strokeStyle = COLORS.good;
    ctx.globalAlpha = 0.6 + 0.3 * Math.sin(w.time * 6);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, p.r + 10, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  glowCircle(ctx, 0, 0, p.r * 2.6, COLORS.player, 0.55);
  ctx.rotate(p.angle);
  // Engine flame when moving.
  const moving = Math.abs(p.vx) + Math.abs(p.vy) > 1;
  if (moving) {
    ctx.fillStyle = '#ff9f1c';
    ctx.beginPath();
    ctx.moveTo(-p.r * 0.8, -5);
    ctx.lineTo(-p.r - 10 - Math.random() * 6, 0);
    ctx.lineTo(-p.r * 0.8, 5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.moveTo(p.r + 8, 0);
  ctx.lineTo(-p.r, -p.r * 0.85);
  ctx.lineTo(-p.r * 0.45, 0);
  ctx.lineTo(-p.r, p.r * 0.85);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.playerCore;
  ctx.beginPath();
  ctx.arc(2, 0, 4.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawParticles(ctx, w) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const pt of w.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawFloaters(ctx, w) {
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const f of w.floaters) {
    ctx.globalAlpha = Math.min(1, f.life * 1.4);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, w) {
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(`SCORE ${w.score.toLocaleString('en-US')}`, 18, 36);
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText(`BEST ${Math.max(w.best, w.score).toLocaleString('en-US')}`, 18, 58);
  if (w.combo > 1) {
    ctx.fillStyle = COLORS.shard;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(`COMBO x${w.mult}`, 18, 86);
    ctx.fillStyle = 'rgba(255,209,102,0.35)';
    ctx.fillRect(18, 94, 90 * (w.comboTimer / 3), 5);
  }
  // Wave, top centre.
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(w.wave > 0 ? `WAVE ${w.wave} / ${WIN_WAVE}` : 'HEARTSTAR', VIEW.width / 2, 34);
  // Boss bar.
  if (w.boss) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    rr(ctx, VIEW.width / 2 - 180, 46, 360, 10, 5);
    ctx.fill();
    ctx.fillStyle = COLORS.boss;
    rr(ctx, VIEW.width / 2 - 180, 46, 360 * Math.max(0, w.boss.hp / w.boss.maxHp), 10, 5);
    ctx.fill();
    ctx.fillStyle = COLORS.hud;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(w.wave === 10 ? 'VOID SOVEREIGN' : 'GLOOM MAW', VIEW.width / 2, 72);
  }
  // Lives + Heart, top right.
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 18px system-ui, sans-serif';
  let hearts = '';
  for (let i = 0; i < w.heart.maxHp; i += 1) hearts += i < w.heart.hp ? '♥' : '♡';
  ctx.fillStyle = w.heart.hp <= 3 ? COLORS.warn : COLORS.heart;
  ctx.fillText(hearts, VIEW.width - 18, 34);
  ctx.fillStyle = COLORS.player;
  let ships = '';
  for (let i = 0; i < w.player.lives; i += 1) ships += '▲ ';
  ctx.fillText(`SHIPS ${ships}`, VIEW.width - 18, 58);
  // Power-up timers, bottom left.
  const p = w.player;
  ctx.textAlign = 'left';
  ctx.font = 'bold 14px system-ui, sans-serif';
  let y = VIEW.height - 18;
  if (p.spread > 0) { ctx.fillStyle = COLORS.good; ctx.fillText(`SPREAD ${Math.ceil(p.spread)}s`, 18, y); y -= 20; }
  if (p.rapid > 0) { ctx.fillStyle = COLORS.good; ctx.fillText(`RAPID ${Math.ceil(p.rapid)}s`, 18, y); y -= 20; }
  if (p.shield > 0) { ctx.fillStyle = COLORS.good; ctx.fillText(`SHIELD ${Math.ceil(p.shield)}s`, 18, y); y -= 20; }
  if (p.invuln > 0 && p.alive) { ctx.fillStyle = COLORS.dim; ctx.fillText('INVULNERABLE', 18, y); }
}

function drawBanner(ctx, w) {
  const a = Math.min(1, w.bannerTimer > 1.6 ? (2.0 - w.bannerTimer) / 0.4 : w.bannerTimer / 0.6);
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.shadowColor = COLORS.boss;
  ctx.shadowBlur = 24;
  ctx.fillText(w.bannerText, VIEW.width / 2, 190);
  ctx.restore();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(4, 2, 16, 0.82)';
  rr(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(125, 249, 255, 0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawTitle(ctx, w) {
  ctx.fillStyle = 'rgba(3, 1, 10, 0.45)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  panel(ctx, 290, 110, 700, 470);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.player;
  ctx.font = 'bold 76px system-ui, sans-serif';
  ctx.shadowColor = COLORS.player;
  ctx.shadowBlur = 30;
  ctx.fillText('HEARTSTAR', VIEW.width / 2, 205);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('Defend the Heart Star. Survive 10 waves.', VIEW.width / 2, 248);
  ctx.fillStyle = COLORS.dim;
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('Void creatures hunt the Heart — if it shatters, the run ends.', VIEW.width / 2, 282);
  ctx.fillText('Kill them for score. Shards feed your combo. Bosses on waves 5 and 10.', VIEW.width / 2, 308);
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText('WASD / ARROWS — fly      MOUSE — aim      HOLD CLICK / SPACE — fire', VIEW.width / 2, 356);
  ctx.fillText('P — pause      M — mute', VIEW.width / 2, 384);
  ctx.fillStyle = COLORS.shard;
  ctx.font = 'bold 24px system-ui, sans-serif';
  const blink = 0.6 + 0.4 * Math.sin(w.time * 4);
  ctx.globalAlpha = blink;
  ctx.fillText('CLICK OR PRESS ENTER TO START', VIEW.width / 2, 448);
  ctx.globalAlpha = 1;
  if (w.best > 0) {
    ctx.fillStyle = COLORS.dim;
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(`BEST SCORE ${w.best.toLocaleString('en-US')}`, VIEW.width / 2, 492);
  }
  ctx.fillStyle = COLORS.dim;
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('An original game. No network, no files beyond this page.', VIEW.width / 2, 540);
}

function drawPaused(ctx, w) {
  ctx.fillStyle = 'rgba(3, 1, 10, 0.6)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.fillText('PAUSED', VIEW.width / 2, 340);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('Press P to resume — R to restart the run', VIEW.width / 2, 384);
  void w;
}

function endPanel(ctx, title, titleColor, lines, w) {
  panel(ctx, 340, 130, 600, 440);
  ctx.textAlign = 'center';
  ctx.fillStyle = titleColor;
  ctx.font = 'bold 58px system-ui, sans-serif';
  ctx.shadowColor = titleColor;
  ctx.shadowBlur = 22;
  ctx.fillText(title, VIEW.width / 2, 220);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(`SCORE ${w.score.toLocaleString('en-US')}`, VIEW.width / 2, 280);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = COLORS.dim;
  let y = 322;
  for (const line of lines) {
    ctx.fillText(line, VIEW.width / 2, y);
    y += 30;
  }
  const isBest = w.score >= w.best && w.score > 0;
  if (isBest) {
    ctx.fillStyle = COLORS.shard;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('★ NEW BEST SCORE ★', VIEW.width / 2, y + 8);
    y += 30;
  }
  ctx.fillStyle = COLORS.shard;
  ctx.font = 'bold 22px system-ui, sans-serif';
  const blink = 0.6 + 0.4 * Math.sin(w.time * 4);
  ctx.globalAlpha = blink;
  ctx.fillText('PRESS ENTER OR CLICK TO PLAY AGAIN', VIEW.width / 2, 520);
  ctx.globalAlpha = 1;
}

function drawOver(ctx, w) {
  ctx.fillStyle = 'rgba(10, 1, 4, 0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const cause = w.heart.hp <= 0 ? 'The Heart Star shattered.' : 'Your last ship was destroyed.';
  endPanel(ctx, 'GAME OVER', COLORS.boss, [
    cause,
    `Reached wave ${w.wave} of ${WIN_WAVE}`,
    `${w.kills} creatures destroyed  •  ${w.shardsGot} shards gathered  •  ${w.accuracy}% accuracy`,
    `Best score ${w.best.toLocaleString('en-US')}`,
  ], w);
}

function drawVictory(ctx, w) {
  ctx.fillStyle = 'rgba(1, 8, 4, 0.5)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  endPanel(ctx, 'VICTORY!', COLORS.good, [
    'The Void Sovereign is gone. The Heart Star burns on.',
    `Cleared all ${WIN_WAVE} waves`,
    `${w.kills} creatures destroyed  •  ${w.shardsGot} shards gathered  •  ${w.accuracy}% accuracy`,
    `Best score ${w.best.toLocaleString('en-US')}`,
  ], w);
}
