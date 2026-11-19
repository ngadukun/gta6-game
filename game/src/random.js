// A small seeded random number generator (mulberry32) so a world built from a
// seed is the same world every time: the screenshot scenes rely on it, and so
// does anyone replaying a run.

export function makeRng(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** Float in [min, max). */
    range: (min, max) => min + next() * (max - min),
    /** Integer in [min, max]. */
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    /** True with probability p. */
    chance: (p) => next() < p,
    /** One element of a non-empty array. */
    pick: (array) => array[Math.floor(next() * array.length)],
    /** A shuffled copy of an array (Fisher–Yates on this stream). */
    shuffle: (array) => {
      const out = [...array];
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}
