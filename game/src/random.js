// HEARTSTAR — random: one tiny seeded generator (mulberry32).
// One job: deterministic randomness. The live game seeds from the clock;
// screenshot scenes seed from the URL, so the same seed always stages the same frame.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] from a rng. */
export function int(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Pick one element of an array from a rng. */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
