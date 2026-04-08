const KEYS = {
  blueprints: 'archwerx_blueprints',
  activeSession: 'archwerx_active_session',
  apiKey: 'archwerx_api_key',
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    if (err.name === 'QuotaExceededError' || err.code === 22) {
      const event = new CustomEvent('archwerx:quota_exceeded', {
        detail: { key, bytesUsed: estimateUsage() },
      });
      window.dispatchEvent(event);
      throw err;
    }
    throw err;
  }
}

/** Estimate total archwerx localStorage usage in characters. */
export function estimateUsage() {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith('archwerx_')) {
      total += k.length + (localStorage.getItem(k) || '').length;
    }
  }
  return total;
}

/** Clear all blueprint history from localStorage. */
export function clearHistory() {
  localStorage.removeItem(KEYS.blueprints);
  localStorage.removeItem(KEYS.activeSession);
}

/** Save a blueprint. Pushes layer to active session; on complete, appends to history and clears session. */
export function save(blueprint) {
  // Always update active session with current state
  writeJSON(KEYS.activeSession, blueprint);

  // If blueprint is marked complete, persist to history and clear session
  if (blueprint.complete) {
    const all = readJSON(KEYS.blueprints, []);
    const idx = all.findIndex((b) => b.id === blueprint.id);
    if (idx >= 0) {
      all[idx] = blueprint;
    } else {
      all.push(blueprint);
    }
    writeJSON(KEYS.blueprints, all);
    localStorage.removeItem(KEYS.activeSession);
  }

  return blueprint;
}

/** Load a single blueprint by id. Checks active session first, then history. */
export function load(id) {
  const session = readJSON(KEYS.activeSession, null);
  if (session && session.id === id) return session;

  const all = readJSON(KEYS.blueprints, []);
  return all.find((b) => b.id === id) || null;
}

/** List all completed blueprints from history. */
export function list() {
  return readJSON(KEYS.blueprints, []);
}

/** Delete a blueprint by id from history. */
export function remove(id) {
  const all = readJSON(KEYS.blueprints, []);
  const filtered = all.filter((b) => b.id !== id);
  writeJSON(KEYS.blueprints, filtered);

  // Also clear active session if it matches
  const session = readJSON(KEYS.activeSession, null);
  if (session && session.id === id) {
    localStorage.removeItem(KEYS.activeSession);
  }

  return filtered;
}
export { remove as delete };

/** Update a blueprint in history (by id). */
export function update(blueprint) {
  const all = readJSON(KEYS.blueprints, []);
  const idx = all.findIndex((b) => b.id === blueprint.id);
  if (idx >= 0) {
    all[idx] = blueprint;
    writeJSON(KEYS.blueprints, all);
  }
  return blueprint;
}

/** Clear the active session. */
export function clearActive() {
  localStorage.removeItem(KEYS.activeSession);
}

/** Load the active session (if any). */
export function loadActiveSession() {
  return readJSON(KEYS.activeSession, null);
}

export default { save, load, list, delete: remove, update, clearActive, clearHistory, estimateUsage, loadActiveSession };
