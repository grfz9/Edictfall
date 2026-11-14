// Effets sonores rétro (façon jsfxr) décrits en DONNÉES : id → couches synthétisées.
// Pour ajouter un son : une entrée dans SFX, rien d'autre.

export type Wave = 'square' | 'sawtooth' | 'triangle' | 'sine' | 'noise';

export interface SfxLayer {
  /** Forme d'onde ('noise' = bruit blanc filtré). */
  w: Wave;
  /** Fréquence de départ (Hz). Pour 'noise' : fréquence du filtre. */
  f: number;
  /** Fréquence d'arrivée (glissando ; balayage du filtre pour 'noise'). */
  to?: number;
  /** Durée de la décroissance (s) ; pour un arpège : durée de la dernière note. */
  d: number;
  /** Attaque (s). */
  a?: number;
  /** Volume relatif de la couche. */
  v?: number;
  /** Décalage de départ (s). */
  at?: number;
  /** Vibrato : [fréquence Hz, profondeur en fraction de la fréquence]. */
  vib?: [number, number];
  /** Filtre (défaut 'lowpass' pour le bruit, aucun pour les oscillateurs). */
  flt?: BiquadFilterType;
  /** Fréquence du filtre d'un oscillateur. */
  ff?: number;
  q?: number;
  /** Arpège : demi-tons relatifs à f, joués toutes les `st` secondes. */
  n?: number[];
  st?: number;
  /** Glissando linéaire au lieu d'exponentiel. */
  lin?: boolean;
}

export interface SfxDef {
  l: SfxLayer[];
  /** Volume global du son. */
  v?: number;
  /** Variation aléatoire de hauteur (± demi-tons). Défaut 0.7. */
  j?: number;
  /** Intervalle minimal entre deux lectures (s). Défaut 0.03. */
  gap?: number;
  /** Priorité (0 = jetable, 3 = jamais sacrifié). Défaut 1. */
  p?: number;
  /** Instances simultanées max de ce son. Défaut 4. */
  max?: number;
  /** Monte en hauteur quand on en enchaîne plusieurs. */
  rise?: boolean;
  /** Passe par le bitcrusher léger. */
  crush?: boolean;
}

export const SFX: Record<string, SfxDef> = {
  // ─── Tirs du joueur : percutants, courts, peu fatigants ───
  shoot: { v: 0.5, j: 1.2, p: 0, max: 3, l: [
    { w: 'square', f: 900, to: 300, d: 0.055, ff: 3500, flt: 'lowpass' },
    { w: 'noise', f: 6000, d: 0.02, v: 0.45, flt: 'highpass' }] },
  rifle: { v: 0.48, j: 1, p: 0, max: 3, gap: 0.035, l: [
    { w: 'square', f: 640, to: 150, d: 0.045, ff: 3000, flt: 'lowpass' },
    { w: 'noise', f: 2600, d: 0.04, v: 0.7, flt: 'bandpass', q: 1.4 }] },
  shotgun: { v: 0.65, j: 0.8, p: 1, max: 2, l: [
    { w: 'noise', f: 2600, to: 280, d: 0.2 },
    { w: 'square', f: 170, to: 45, d: 0.1, v: 0.8 }] },
  laser: { v: 0.42, j: 1, p: 0, max: 3, l: [
    { w: 'sawtooth', f: 1500, to: 420, d: 0.09, ff: 4000, flt: 'lowpass' },
    { w: 'sine', f: 3000, to: 1200, d: 0.05, v: 0.4 }] },
  bow: { v: 0.5, j: 1, p: 0, max: 3, l: [
    { w: 'triangle', f: 280, to: 820, d: 0.06 },
    { w: 'noise', f: 5000, to: 2000, d: 0.05, v: 0.5, flt: 'bandpass', q: 2 }] },
  launch: { v: 0.55, j: 0.8, p: 1, max: 2, l: [
    { w: 'square', f: 140, to: 420, d: 0.14, ff: 1800, flt: 'lowpass' },
    { w: 'noise', f: 600, to: 1600, d: 0.18, v: 0.7, flt: 'bandpass', q: 1 }] },
  swing: { v: 0.5, j: 1.5, p: 0, max: 3, l: [
    { w: 'noise', f: 900, to: 3200, d: 0.11, a: 0.03, flt: 'bandpass', q: 2.5 }] },
  magic: { v: 0.42, j: 1, p: 0, max: 3, l: [
    { w: 'sine', f: 620, to: 1240, d: 0.12, vib: [22, 0.03] },
    { w: 'triangle', f: 1240, d: 0.05, n: [0, 7, 12], st: 0.025, v: 0.5 }] },
  weird: { v: 0.42, j: 2, p: 0, max: 3, crush: true, l: [
    { w: 'sawtooth', f: 260, to: 900, d: 0.16, vib: [30, 0.15], ff: 2500, flt: 'lowpass' }] },
  empty: { v: 0.35, j: 0.3, p: 0, max: 1, gap: 0.12, l: [
    { w: 'square', f: 1300, d: 0.018 },
    { w: 'square', f: 950, d: 0.018, at: 0.045 }] },

  // ─── Combat ───
  hit: { v: 0.42, j: 2, p: 0, max: 4, l: [
    { w: 'square', f: 320, to: 90, d: 0.05, ff: 2500, flt: 'lowpass' },
    { w: 'noise', f: 3000, to: 800, d: 0.04, v: 0.6 }] },
  crit: { v: 0.5, j: 1, p: 1, max: 3, l: [
    { w: 'square', f: 420, to: 110, d: 0.06, ff: 3000, flt: 'lowpass' },
    { w: 'triangle', f: 1760, to: 2400, d: 0.1, v: 0.7 },
    { w: 'noise', f: 5000, d: 0.04, v: 0.5, flt: 'highpass' }] },
  explode: { v: 0.8, j: 1, p: 2, max: 3, gap: 0.05, crush: true, l: [
    { w: 'noise', f: 1400, to: 90, d: 0.55 },
    { w: 'sine', f: 120, to: 32, d: 0.45, v: 1.1 },
    { w: 'square', f: 75, to: 30, d: 0.25, v: 0.45, ff: 400, flt: 'lowpass' }] },
  break: { v: 0.5, j: 1.5, p: 0, max: 3, l: [
    { w: 'noise', f: 2400, d: 0.1, flt: 'bandpass', q: 1.5 },
    { w: 'square', f: 520, to: 180, d: 0.05, v: 0.5 },
    { w: 'noise', f: 6000, d: 0.06, v: 0.5, at: 0.04, flt: 'highpass' }] },
  die: { v: 0.45, j: 1.5, p: 1, max: 3, l: [
    { w: 'square', f: 420, to: 70, d: 0.15, ff: 2200, flt: 'lowpass' },
    { w: 'noise', f: 1800, to: 300, d: 0.12, v: 0.6 }] },
  bossdie: { v: 0.9, j: 0, p: 3, max: 1, gap: 0.5, crush: true, l: [
    { w: 'noise', f: 2400, to: 70, d: 1.4 },
    { w: 'sawtooth', f: 220, to: 28, d: 1.1, v: 0.5, ff: 900, flt: 'lowpass' },
    { w: 'sine', f: 70, to: 24, d: 1.4, v: 1 },
    { w: 'square', f: 880, d: 0.25, n: [0, -2, -5, -7, -12, -14, -17, -24], st: 0.09, v: 0.35, at: 0.15 }] },
  hurt: { v: 0.6, j: 0.6, p: 2, max: 1, gap: 0.08, l: [
    { w: 'square', f: 230, to: 105, d: 0.16, vib: [40, 0.08] },
    { w: 'noise', f: 1500, to: 400, d: 0.1, v: 0.5 }] },
  armor: { v: 0.45, j: 1, p: 1, max: 2, l: [
    { w: 'triangle', f: 1300, to: 900, d: 0.08 },
    { w: 'square', f: 2600, d: 0.03, v: 0.35 }] },
  armorup: { v: 0.42, j: 0, p: 2, max: 1, l: [
    { w: 'triangle', f: 440, d: 0.12, n: [0, 4, 7, 12], st: 0.045 },
    { w: 'square', f: 1760, d: 0.05, v: 0.2, at: 0.13 }] },
  death: { v: 0.75, j: 0, p: 3, max: 1, gap: 0.5, l: [
    { w: 'sawtooth', f: 330, d: 0.45, n: [0, -3, -6, -12], st: 0.16, vib: [7, 0.03], ff: 1600, flt: 'lowpass' },
    { w: 'noise', f: 1200, to: 100, d: 0.6, v: 0.6 },
    { w: 'sine', f: 110, to: 40, d: 0.8, v: 0.7 }] },

  // ─── Ennemis (plus doux que les armes du joueur) ───
  eshoot: { v: 0.26, j: 1.5, p: 0, max: 3, gap: 0.04, l: [
    { w: 'triangle', f: 520, to: 260, d: 0.07 }] },
  ering: { v: 0.32, j: 1, p: 0, max: 2, gap: 0.06, l: [
    { w: 'triangle', f: 300, to: 620, d: 0.18, vib: [16, 0.04] },
    { w: 'sine', f: 620, to: 1240, d: 0.12, v: 0.5 }] },
  elob: { v: 0.32, j: 1.5, p: 0, max: 2, l: [
    { w: 'sine', f: 190, to: 520, d: 0.13 }] },
  elaser: { v: 0.32, j: 0.6, p: 1, max: 2, gap: 0.08, l: [
    { w: 'sawtooth', f: 160, to: 240, d: 0.35, a: 0.05, vib: [12, 0.05], ff: 1200, flt: 'lowpass' },
    { w: 'square', f: 1000, to: 220, d: 0.12, at: 0.25, v: 0.5, ff: 2500, flt: 'lowpass' }] },
  summon: { v: 0.4, j: 0.5, p: 1, max: 2, l: [
    { w: 'sine', f: 220, d: 0.2, n: [0, 3, 7, 10, 15], st: 0.05, vib: [9, 0.02] },
    { w: 'noise', f: 400, to: 2400, d: 0.3, a: 0.15, v: 0.4, flt: 'bandpass', q: 3 }] },

  // ─── Mouvement ───
  dash: { v: 0.42, j: 1, p: 1, max: 1, l: [
    { w: 'noise', f: 700, to: 2600, d: 0.12, a: 0.02, flt: 'bandpass', q: 1.5 },
    { w: 'sine', f: 300, to: 620, d: 0.08, v: 0.5 }] },
  blink: { v: 0.38, j: 0.5, p: 1, max: 1, l: [
    { w: 'sine', f: 1500, to: 3000, d: 0.06 },
    { w: 'sine', f: 3000, to: 1500, d: 0.07, at: 0.05 }] },
  phase: { v: 0.38, j: 0.5, p: 1, max: 1, l: [
    { w: 'triangle', f: 400, to: 820, d: 0.22, vib: [11, 0.08] },
    { w: 'sine', f: 820, to: 400, d: 0.22, v: 0.5 }] },

  // ─── Déroulement ───
  boss: { v: 0.75, j: 0, p: 3, max: 1, gap: 1, l: [
    { w: 'sawtooth', f: 55, to: 50, d: 1.3, a: 0.05, ff: 500, flt: 'lowpass', v: 0.9 },
    { w: 'noise', f: 300, d: 1.0, a: 0.2, v: 0.6 },
    { w: 'square', f: 110, d: 0.45, n: [0, 6, 12], st: 0.28, ff: 900, flt: 'lowpass', v: 0.45 }] },
  wave: { v: 0.4, j: 0, p: 2, max: 1, gap: 0.3, l: [
    { w: 'square', f: 330, d: 0.12, n: [0, 5], st: 0.09, ff: 2000, flt: 'lowpass' }] },
  lock: { v: 0.5, j: 0, p: 2, max: 1, gap: 0.2, l: [
    { w: 'square', f: 150, to: 110, d: 0.12, ff: 800, flt: 'lowpass' },
    { w: 'noise', f: 600, d: 0.1, v: 0.7 },
    { w: 'triangle', f: 620, d: 0.05, at: 0.06, v: 0.5 }] },
  clear: { v: 0.42, j: 0, p: 2, max: 1, gap: 0.3, l: [
    { w: 'triangle', f: 523, d: 0.25, n: [0, 4, 7, 12], st: 0.065 },
    { w: 'square', f: 1046, d: 0.15, v: 0.15, at: 0.2, ff: 3000, flt: 'lowpass' }] },
  chest: { v: 0.45, j: 0, p: 2, max: 1, gap: 0.2, l: [
    { w: 'triangle', f: 392, d: 0.3, n: [0, 4, 7, 11, 14], st: 0.055 },
    { w: 'noise', f: 7000, d: 0.25, v: 0.3, at: 0.15, flt: 'highpass' }] },
  mimic: { v: 0.5, j: 0, p: 2, max: 1, gap: 0.3, crush: true, l: [
    { w: 'sawtooth', f: 200, d: 0.25, n: [0, -1, 6, -6], st: 0.07, ff: 1500, flt: 'lowpass' },
    { w: 'noise', f: 900, d: 0.2, v: 0.5, at: 0.1 }] },
  portal: { v: 0.45, j: 0, p: 2, max: 1, gap: 0.5, l: [
    { w: 'sine', f: 200, to: 1200, d: 0.6, a: 0.1, vib: [8, 0.05] },
    { w: 'noise', f: 500, to: 4000, d: 0.6, a: 0.2, v: 0.35, flt: 'bandpass', q: 4 }] },
  secret: { v: 0.42, j: 0, p: 2, max: 1, gap: 0.5, l: [
    { w: 'triangle', f: 392, d: 0.35, n: [0, 3, 7, 10, 14, 17], st: 0.075 },
    { w: 'sine', f: 1568, d: 0.3, at: 0.45, v: 0.4, vib: [6, 0.01] }] },

  // ─── Ramassage (coin / orb montent en hauteur en série) ───
  coin: { v: 0.32, j: 0, p: 0, max: 3, gap: 0.03, rise: true, l: [
    { w: 'square', f: 988, d: 0.09, n: [0, 7], st: 0.045, ff: 4000, flt: 'lowpass' }] },
  orb: { v: 0.3, j: 0, p: 0, max: 3, gap: 0.03, rise: true, l: [
    { w: 'sine', f: 660, to: 990, d: 0.08 },
    { w: 'triangle', f: 1980, d: 0.04, v: 0.3 }] },
  heal: { v: 0.42, j: 0, p: 2, max: 1, gap: 0.2, l: [
    { w: 'sine', f: 523, d: 0.25, n: [0, 4, 7, 12], st: 0.06, vib: [6, 0.01] },
    { w: 'triangle', f: 1046, d: 0.2, v: 0.3, at: 0.12 }] },
  gem: { v: 0.4, j: 0, p: 1, max: 2, rise: true, l: [
    { w: 'triangle', f: 1046, d: 0.15, n: [0, 12, 7, 19], st: 0.04 }] },
  pickup: { v: 0.4, j: 0.3, p: 1, max: 2, l: [
    { w: 'square', f: 660, d: 0.08, n: [0, 5, 12], st: 0.04, ff: 3500, flt: 'lowpass' }] },
  swap: { v: 0.35, j: 0.5, p: 1, max: 1, l: [
    { w: 'triangle', f: 400, to: 800, d: 0.04 },
    { w: 'triangle', f: 800, to: 400, d: 0.04, at: 0.05 }] },

  // ─── Interface / hall ───
  buy: { v: 0.42, j: 0, p: 2, max: 1, l: [
    { w: 'square', f: 784, d: 0.12, n: [0, 4, 7, 12], st: 0.045, ff: 3500, flt: 'lowpass' },
    { w: 'triangle', f: 1568, d: 0.06, v: 0.3, at: 0.02 }] },
  deny: { v: 0.42, j: 0, p: 2, max: 1, gap: 0.15, l: [
    { w: 'square', f: 180, d: 0.07, ff: 1200, flt: 'lowpass' },
    { w: 'square', f: 135, d: 0.12, at: 0.09, ff: 1200, flt: 'lowpass' }] },
  unlock: { v: 0.45, j: 0, p: 3, max: 1, gap: 0.3, l: [
    { w: 'triangle', f: 523, d: 0.3, n: [0, 4, 7, 12, 16, 19], st: 0.05 },
    { w: 'square', f: 262, d: 0.25, n: [0, 7, 12], st: 0.1, v: 0.3, ff: 2000, flt: 'lowpass' }] },
  select: { v: 0.28, j: 0, p: 1, max: 2, gap: 0.04, l: [
    { w: 'square', f: 1046, d: 0.03, ff: 4000, flt: 'lowpass' }] },
  skill: { v: 0.45, j: 0.5, p: 2, max: 1, l: [
    { w: 'sawtooth', f: 400, to: 1600, d: 0.15, ff: 3000, flt: 'lowpass' },
    { w: 'noise', f: 1000, to: 5000, d: 0.15, v: 0.4, flt: 'bandpass', q: 2 }] },
  offer: { v: 0.42, j: 0, p: 2, max: 1, gap: 0.3, l: [
    { w: 'triangle', f: 440, d: 0.35, n: [0, 7, 12], st: 0.09, vib: [5, 0.012] },
    { w: 'sine', f: 1760, d: 0.25, v: 0.25, at: 0.2 }] },
  buff: { v: 0.4, j: 0.3, p: 2, max: 1, l: [
    { w: 'triangle', f: 440, to: 880, d: 0.14 },
    { w: 'sine', f: 880, d: 0.12, n: [0, 7], st: 0.06, v: 0.4, at: 0.08 }] },
  pet: { v: 0.35, j: 1, p: 1, max: 1, gap: 0.2, l: [
    { w: 'sine', f: 1200, d: 0.06, n: [0, 7, 12], st: 0.04, vib: [25, 0.03] }] },

  // ─── Jingles ───
  edict: { v: 0.6, j: 0, p: 3, max: 1, gap: 0.5, l: [
    { w: 'square', f: 262, d: 0.5, n: [0, 7, 12, 15, 19], st: 0.09, ff: 2500, flt: 'lowpass' },
    { w: 'triangle', f: 131, d: 0.7, n: [0, 7], st: 0.36, v: 0.8 },
    { w: 'sine', f: 1046, d: 0.5, at: 0.36, v: 0.35, vib: [6, 0.01] },
    { w: 'noise', f: 400, to: 3000, d: 0.4, a: 0.2, v: 0.2, flt: 'bandpass', q: 3 }] },
  synergy: { v: 0.55, j: 0, p: 3, max: 1, gap: 0.5, l: [
    { w: 'triangle', f: 523, d: 0.35, n: [0, 4, 7, 11, 14, 19], st: 0.06 },
    { w: 'square', f: 262, d: 0.3, n: [0, 7, 12], st: 0.12, v: 0.4, ff: 2200, flt: 'lowpass' },
    { w: 'sine', f: 2093, d: 0.3, at: 0.36, v: 0.3 }] },
  victory: { v: 0.6, j: 0, p: 3, max: 1, gap: 1, l: [
    { w: 'square', f: 523, d: 0.6, n: [0, 4, 7, 12, 7, 12, 16, 19], st: 0.11, ff: 3000, flt: 'lowpass' },
    { w: 'triangle', f: 131, d: 0.6, n: [0, 5, 7, 12], st: 0.22, v: 0.8 },
    { w: 'noise', f: 8000, d: 0.4, at: 0.77, v: 0.2, flt: 'highpass' }] },
  gameover: { v: 0.6, j: 0, p: 3, max: 1, gap: 1, l: [
    { w: 'triangle', f: 330, d: 0.7, n: [7, 3, 0, -5, -12], st: 0.22 },
    { w: 'sawtooth', f: 82, d: 1.1, v: 0.4, ff: 500, flt: 'lowpass', vib: [4, 0.02] }] },

  // ─── Sons utilisés par le contenu ───
  zap: { v: 0.4, j: 1.5, p: 0, max: 3, crush: true, l: [
    { w: 'sawtooth', f: 2000, to: 200, d: 0.08 },
    { w: 'noise', f: 5000, d: 0.04, v: 0.5, flt: 'highpass' }] },
  bubble: { v: 0.35, j: 2, p: 0, max: 3, l: [
    { w: 'sine', f: 300, to: 900, d: 0.06 },
    { w: 'sine', f: 420, to: 1250, d: 0.05, at: 0.05, v: 0.7 }] },
  thud: { v: 0.6, j: 1.5, p: 1, max: 3, l: [
    { w: 'sine', f: 130, to: 40, d: 0.16 },
    { w: 'noise', f: 400, d: 0.08, v: 0.6 }] },
  pew: { v: 0.42, j: 1.5, p: 0, max: 3, l: [
    { w: 'square', f: 1250, to: 300, d: 0.08, ff: 3500, flt: 'lowpass' }] },
  boing: { v: 0.45, j: 1, p: 1, max: 2, l: [
    { w: 'triangle', f: 150, to: 480, d: 0.25, vib: [18, 0.25], lin: true }] },
  honk: { v: 0.4, j: 1, p: 1, max: 2, gap: 0.1, l: [
    { w: 'sawtooth', f: 330, to: 310, d: 0.18, a: 0.01, ff: 1400, flt: 'lowpass', q: 4 },
    { w: 'square', f: 336, to: 316, d: 0.18, v: 0.5, ff: 1400, flt: 'lowpass' }] },
  splash: { v: 0.45, j: 1.5, p: 0, max: 3, l: [
    { w: 'noise', f: 3500, to: 500, d: 0.3 },
    { w: 'sine', f: 620, to: 200, d: 0.1, v: 0.5 }] },
  fire: { v: 0.45, j: 1.5, p: 0, max: 3, l: [
    { w: 'noise', f: 1600, to: 380, d: 0.32, a: 0.04 },
    { w: 'noise', f: 3000, d: 0.08, v: 0.4, at: 0.05, flt: 'bandpass', q: 3 }] },
  ice: { v: 0.4, j: 1.5, p: 0, max: 3, l: [
    { w: 'triangle', f: 2000, to: 2600, d: 0.12 },
    { w: 'sine', f: 3100, d: 0.2, at: 0.03, v: 0.5 },
    { w: 'noise', f: 8000, d: 0.05, v: 0.3, flt: 'highpass' }] },
  charge: { v: 0.4, j: 0.5, p: 1, max: 2, l: [
    { w: 'sawtooth', f: 200, to: 820, d: 0.35, a: 0.05, lin: true, vib: [14, 0.03], ff: 2400, flt: 'lowpass' }] },
};

/** Bip générique discret pour un id inconnu. */
export const SFX_FALLBACK: SfxDef = { v: 0.25, j: 0.5, p: 0, max: 2, l: [{ w: 'sine', f: 660, d: 0.05 }] };

/** Demi-tons de la gamme majeure, utilisés pour la montée coin/orb/gem. */
export const RISE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];
