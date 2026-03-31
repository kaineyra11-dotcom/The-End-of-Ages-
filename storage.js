const SAVE_KEY = "km_feudal_save_v1";
const META_KEY = "km_feudal_meta_v1";

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // ignore (storage may be blocked)
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

export function exportSaveJson(state) {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      state,
    },
    null,
    2,
  );
}

export function importSaveJson(text) {
  const obj = JSON.parse(text);
  if (!obj || typeof obj !== "object") throw new Error("Invalid save file.");
  if (obj.version !== 1) throw new Error("Unsupported save version.");
  if (!obj.state || typeof obj.state !== "object") throw new Error("Missing state.");
  return obj.state;
}

export function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { version: 1, legacyBank: 0, upgrades: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { version: 1, legacyBank: 0, upgrades: {} };
    parsed.version ??= 1;
    parsed.legacyBank ??= 0;
    parsed.upgrades ??= {};
    return parsed;
  } catch {
    return { version: 1, legacyBank: 0, upgrades: {} };
  }
}

export function writeMeta(meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // ignore
  }
}

