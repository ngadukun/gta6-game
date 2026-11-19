// What the browser remembers for Leo: one save (cash, story progress, the
// side-work tally, lifetime stats, where he stood) and one small set of
// preferences that outlives any single run. Everything here is best-effort —
// private mode, a full disk, a blocked store: the game shrugs and plays on.

const SAVE_KEY = 'sunhaven-save-v1';
const PREFS_KEY = 'sunhaven-prefs-v1';

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage said no. Nothing here is worth stopping the game for.
  }
}

/** The saved game, or null when there is none worth offering as Continue.
 * The check is stricter than "it parsed": a hand-edited or half-written
 * save with a poisoned cash figure or story pointer is worse than none. */
export function loadSave() {
  const data = readJson(SAVE_KEY);
  if (typeof data !== 'object' || data === null) return null;
  if (typeof data.cash !== 'number' || !Number.isFinite(data.cash)) return null;
  if (data.storyIndex !== undefined && typeof data.storyIndex !== 'number') return null;
  if (data.jobsDone !== undefined && typeof data.jobsDone !== 'number') return null;
  return data;
}

export function storeSave(data) {
  writeJson(SAVE_KEY, data);
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Already gone, or never writable in the first place.
  }
}

/** Preferences (the mute switch today) — kept apart from the save so a
 * New Game never un-mutes a player who likes the quiet. */
export function loadPrefs() {
  const prefs = readJson(PREFS_KEY);
  return typeof prefs === 'object' && prefs !== null ? prefs : {};
}

export function storePrefs(prefs) {
  writeJson(PREFS_KEY, prefs);
}
