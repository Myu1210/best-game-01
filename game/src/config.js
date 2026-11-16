// HEARTSTAR — config: every tuning number in one place.
// One job: constants, palette and the wave table. Nothing here runs the game.
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const WIN_WAVE = 10;
export const BOSS_WAVES = [5, 10];

export const HEART = { x: 640, y: 360, r: 34, maxHp: 12 };
export const PLAYER = {
  radius: 14,
  speed: 340,
  fireInterval: 0.16,
  rapidInterval: 0.09,
  bulletSpeed: 860,
  lives: 3,
  respawnInvuln: 2.0,
};

export const COLORS = {
  bg0: '#05010d',
  bg1: '#0d0221',
  nebulaA: '#2b0f54',
  nebulaB: '#0d2b4d',
  player: '#7df9ff',
  playerCore: '#ffffff',
  bullet: '#ffe066',
  shard: '#ffd166',
  mote: '#ff4d8d',
  dart: '#4de3ff',
  brute: '#ff9f1c',
  spitter: '#b967ff',
  boss: '#ff2e63',
  orb: '#ff5c8a',
  heart: '#ff5e78',
  heartCore: '#fff3f5',
  hud: '#eaf6ff',
  dim: '#8fa3c8',
  good: '#5cffb1',
  warn: '#ffb020',
};

export const SCORE = { mote: 50, dart: 80, brute: 200, spitter: 150, boss5: 2000, boss10: 5000, shard: 10 };
export const COMBO_WINDOW = 3.0;
export const COMBO_MAX = 8;

/** Enemy kinds: radius, hp, speed, score, damage dealt to the Heart on contact. */
export const ENEMY = {
  mote: { r: 12, hp: 1, speed: 58, score: SCORE.mote, heartDmg: 1 },
  dart: { r: 10, hp: 1, speed: 128, score: SCORE.dart, heartDmg: 1 },
  brute: { r: 24, hp: 6, speed: 36, score: SCORE.brute, heartDmg: 2 },
  spitter: { r: 14, hp: 3, speed: 48, score: SCORE.spitter, heartDmg: 1 },
};

/** Boss stats per boss wave. */
export const BOSS = {
  5: { r: 46, hp: 180, speed: 26, score: SCORE.boss5, heartDmg: 3, name: 'GLOOM MAW' },
  10: { r: 54, hp: 320, speed: 30, score: SCORE.boss10, heartDmg: 3, name: 'VOID SOVEREIGN' },
};

/** What wave n throws at the player. Counts grow, spawn pace quickens. */
export function waveSpec(n) {
  return {
    motes: Math.min(5 + 3 * n, 20),
    darts: n >= 2 ? Math.min(2 * n, 10) : 0,
    brutes: n >= 3 ? Math.min(n - 1, 5) : 0,
    spitters: n >= 4 ? Math.min(Math.floor(n / 2), 3) : 0,
    boss: BOSS_WAVES.includes(n) ? 1 : 0,
    spawnInterval: Math.max(0.5, 0.85 - 0.05 * n),
  };
}
