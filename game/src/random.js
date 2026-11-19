// random.js — mulberry32, a small seeded random stream.
//
// Everything Sunhaven builds — the city, the traffic, the crowds — is
// dealt from a seed, so seed 7 deals the same world on every machine,
// every run. The screenshot scenes are staged on that promise, and so is
// anyone replaying a world to check it was dealt fairly.

export function makeRng(seed) {
  let state = seed >>> 0;

  /** The next float in [0, 1). Every helper below is this, dressed. */
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,

    /** A float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },

    /** A whole number in [min, max], endpoints included. An inverted
     * range is a caller bug, but a quiet swap beats a nonsense draw. */
    int(min, max) {
      if (max < min) {
        const held = min;
        min = max;
        max = held;
      }
      return Math.floor(min + next() * (max - min + 1));
    },

    /** True with probability p. */
    chance(p) {
      return next() < p;
    },

    /** One element of an array. An empty array has nothing to deal:
     * hand back undefined without spending a draw on it. */
    pick(array) {
      if (array.length === 0) return undefined;
      return array[Math.floor(next() * array.length)];
    },

    /** A direction in radians — the whole compass in a single draw. */
    angle() {
      return next() * Math.PI * 2;
    },

    /** A shuffled copy of the array, dealt from this same stream. */
    shuffle(array) {
      const out = [...array];
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const held = out[i];
        out[i] = out[j];
        out[j] = held;
      }
      return out;
    },
  };
}
