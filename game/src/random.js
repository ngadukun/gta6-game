// mulberry32: a tiny seeded random stream. Sunhaven is built from a seed, so
// seed 7 is the same city on every machine, every time — the screenshot
// scenes lean on that, and so does anyone replaying a run to check it.

export function makeRng(seed) {
  let state = seed >>> 0;

  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    /** A float somewhere in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** A whole number in [min, max], both ends included. */
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    /** True with probability p. */
    chance(p) {
      return next() < p;
    },
    /** One element of a non-empty array. */
    pick(array) {
      return array[Math.floor(next() * array.length)];
    },
    /** A random direction, in radians: one draw, the whole compass. */
    angle() {
      return next() * Math.PI * 2;
    },
    /** A shuffled copy of the array, dealt from this same stream. */
    shuffle(array) {
      const out = [...array];
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}
