import type { SaveData } from './types';

const KEY = 'edictfall.save.v1';
export function defaultSave(): SaveData {
  return {
    v: 1,
    gems: 0,
    heroes: [],
    weapons: [],
    pets: [],
    pet: null,
    hero: '',
    options: { autoAim: true, sfx: 0.7, music: 0.5, shake: 1, touch: 'auto', damageNumbers: true },
    stats: { runs: 0, wins: 0, kills: 0, best: '', bosses: 0 },
    seenRules: [],
    seenSynergies: [],
  };
}
export function loadSave(): SaveData {
  const d = defaultSave();
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      Object.assign(d, p);
      d.options = { ...defaultSave().options, ...(p.options ?? {}) };
      d.stats = { ...defaultSave().stats, ...(p.stats ?? {}) };
    }
  } catch {
    /* sauvegarde corrompue : on repart des valeurs par défaut */
  }
  return d;
}
export function storeSave(s: SaveData): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(s));
  } catch {
    /* stockage indisponible (navigation privée) */
  }
}
export function wipeSave(): void {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    /* rien */
  }
}
