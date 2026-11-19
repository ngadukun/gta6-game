// Leo's progress, kept in the browser's local storage: cash, story progress,
// side-work record and lifetime stats. A save is written after every job and
// offered back on the title screen as Continue.

const KEY = 'sunhaven-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function storeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Private mode and full storage both land here: the game simply goes on.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear, then.
  }
}

// Preferences ride along separately: they survive a New Game.
const PREFS_KEY = 'sunhaven-prefs-v1';

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function storePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Preferences are a courtesy, not a promise.
  }
}
