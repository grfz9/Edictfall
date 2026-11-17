// Effets sonores synthétisés, décrits en DONNÉES : id → couches synthétisées.
// Pour ajouter un son : une entrée dans SFX, rien d'autre.
//
// Identité sonore : attaque nette (clic de bruit très court) + corps grave (sinus/triangle qui chute)
// + queue courte de bruit filtré. Peu de carrés/dents de scie bruts, aigus adoucis par filtres.
// Jingles en sinus/triangle ; le « léger écho » est une copie retardée et plus douce de l'arpège.

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
  // ─── Tirs du joueur : très répétés → volume bas, aigus filtrés, durées courtes ───
  shoot: { v: 0.36, j: 1, p: 0, max: 3, l: [
    { w: 'noise', f: 2800, d: 0.012, v: 0.5, flt: 'bandpass', q: 1.2 },
    { w: 'triangle', f: 420, to: 140, d: 0.06, ff: 1800, flt: 'lowpass' },
    { w: 'noise', f: 1400, to: 400, d: 0.045, v: 0.35, at: 0.008 }] },
  rifle: { v: 0.34, j: 0.8, p: 0, max: 3, gap: 0.035, l: [
    { w: 'noise', f: 3200, d: 0.01, v: 0.6, flt: 'highpass' },
    { w: 'sine', f: 260, to: 80, d: 0.05, v: 1.1 },
    { w: 'noise', f: 1800, to: 500, d: 0.05, v: 0.45, flt: 'bandpass', q: 0.9, at: 0.006 }] },
  shotgun: { v: 0.5, j: 0.7, p: 1, max: 2, l: [
    { w: 'noise', f: 2200, d: 0.02, v: 0.7, flt: 'bandpass', q: 0.8 },
    { w: 'sine', f: 140, to: 42, d: 0.14, v: 1.2 },
    { w: 'noise', f: 1600, to: 220, d: 0.22, v: 0.7, at: 0.01 }] },
  laser: { v: 0.32, j: 0.8, p: 0, max: 3, l: [
    { w: 'sawtooth', f: 1100, to: 380, d: 0.08, ff: 2200, flt: 'lowpass', vib: [55, 0.04] },
    { w: 'noise', f: 4000, to: 1500, d: 0.06, v: 0.3, flt: 'bandpass', q: 6 },
    { w: 'sine', f: 220, to: 120, d: 0.05, v: 0.6 }] },
  bow: { v: 0.38, j: 1, p: 0, max: 3, l: [
    { w: 'triangle', f: 180, to: 120, d: 0.05, ff: 900, flt: 'lowpass' },
    { w: 'noise', f: 1200, to: 3800, d: 0.07, a: 0.008, v: 0.55, flt: 'bandpass', q: 3 }] },
  launch: { v: 0.46, j: 0.6, p: 1, max: 2, l: [
    { w: 'noise', f: 1800, d: 0.015, v: 0.5, flt: 'bandpass', q: 1 },
    { w: 'sine', f: 90, to: 45, d: 0.16, v: 1.2 },
    { w: 'noise', f: 500, to: 1400, d: 0.2, a: 0.02, v: 0.55, flt: 'bandpass', q: 1.5 }] },
  swing: { v: 0.42, j: 1.5, p: 0, max: 3, l: [
    { w: 'noise', f: 500, to: 2200, d: 0.12, a: 0.035, flt: 'bandpass', q: 1.8 },
    { w: 'noise', f: 300, to: 900, d: 0.1, a: 0.03, v: 0.5, flt: 'lowpass' }] },
  magic: { v: 0.32, j: 0.8, p: 0, max: 3, l: [
    { w: 'sine', f: 520, to: 880, d: 0.1, a: 0.008, vib: [18, 0.02] },
    { w: 'triangle', f: 1046, d: 0.05, n: [0, 7, 12], st: 0.022, v: 0.3, ff: 2500, flt: 'lowpass' },
    { w: 'noise', f: 2500, to: 5000, d: 0.08, v: 0.15, flt: 'bandpass', q: 5 }] },
  weird: { v: 0.34, j: 2, p: 0, max: 3, l: [
    { w: 'triangle', f: 200, to: 640, d: 0.15, vib: [26, 0.18] },
    { w: 'sine', f: 330, to: 160, d: 0.12, v: 0.5, vib: [9, 0.1], at: 0.02 }] },
  empty: { v: 0.3, j: 0.3, p: 0, max: 1, gap: 0.12, l: [
    { w: 'noise', f: 1800, d: 0.012, flt: 'bandpass', q: 2 },
    { w: 'triangle', f: 420, d: 0.02, v: 0.5, at: 0.04, ff: 1500, flt: 'lowpass' }] },

  // ─── Combat ───
  hit: { v: 0.3, j: 1.5, p: 0, max: 4, l: [
    { w: 'sine', f: 190, to: 70, d: 0.05, v: 1.1 },
    { w: 'noise', f: 1200, to: 300, d: 0.035, v: 0.5 }] },
  crit: { v: 0.42, j: 1, p: 1, max: 3, l: [
    { w: 'sine', f: 240, to: 70, d: 0.08, v: 1.1 },
    { w: 'noise', f: 2400, d: 0.015, v: 0.6, flt: 'bandpass', q: 1.5 },
    { w: 'triangle', f: 1320, to: 1760, d: 0.09, v: 0.35, ff: 3000, flt: 'lowpass' }] },
  explode: { v: 0.75, j: 0.8, p: 2, max: 3, gap: 0.05, l: [
    { w: 'sine', f: 90, to: 28, d: 0.6, v: 1.3 },
    { w: 'noise', f: 2500, d: 0.03, v: 0.8, flt: 'bandpass', q: 0.7 },
    { w: 'noise', f: 1100, to: 70, d: 0.6, v: 0.85, at: 0.01 },
    { w: 'noise', f: 3000, to: 900, d: 0.18, v: 0.3, at: 0.04, flt: 'bandpass', q: 1.2 }] },
  break: { v: 0.42, j: 1.5, p: 0, max: 3, l: [
    { w: 'noise', f: 1800, d: 0.06, flt: 'bandpass', q: 1.2 },
    { w: 'sine', f: 160, to: 60, d: 0.07, v: 0.8 },
    { w: 'noise', f: 3500, to: 1200, d: 0.08, v: 0.35, at: 0.03, flt: 'bandpass', q: 2 }] },
  die: { v: 0.4, j: 1.5, p: 1, max: 3, l: [
    { w: 'sine', f: 200, to: 50, d: 0.14, v: 1.1 },
    { w: 'noise', f: 1400, to: 200, d: 0.14, v: 0.6 },
    { w: 'triangle', f: 330, to: 120, d: 0.08, v: 0.3, ff: 1500, flt: 'lowpass' }] },
  bossdie: { v: 0.85, j: 0, p: 3, max: 1, gap: 0.5, l: [
    { w: 'sine', f: 70, to: 22, d: 1.6, v: 1.3 },
    { w: 'noise', f: 2000, to: 60, d: 1.5, v: 0.8 },
    { w: 'noise', f: 3000, to: 800, d: 0.3, v: 0.4, at: 0.05, flt: 'bandpass', q: 1 },
    { w: 'triangle', f: 523, d: 0.4, n: [0, -3, -7, -12, -15, -19, -24], st: 0.11, v: 0.35, at: 0.2 },
    { w: 'sine', f: 523, d: 0.4, n: [0, -3, -7, -12, -15, -19, -24], st: 0.11, v: 0.14, at: 0.35 }] },
  hurt: { v: 0.5, j: 0.5, p: 2, max: 1, gap: 0.08, l: [
    { w: 'sine', f: 300, to: 130, d: 0.15, v: 1, vib: [30, 0.05] },
    { w: 'triangle', f: 450, to: 200, d: 0.12, v: 0.4, ff: 1400, flt: 'lowpass' },
    { w: 'noise', f: 900, to: 250, d: 0.08, v: 0.35 }] },
  armor: { v: 0.38, j: 1, p: 1, max: 2, l: [
    { w: 'noise', f: 3000, d: 0.012, v: 0.5, flt: 'bandpass', q: 2 },
    { w: 'triangle', f: 1100, to: 880, d: 0.09, ff: 2500, flt: 'lowpass' },
    { w: 'sine', f: 1650, d: 0.07, v: 0.3 }] },
  armorup: { v: 0.4, j: 0, p: 2, max: 1, l: [
    { w: 'triangle', f: 392, d: 0.15, n: [0, 4, 7, 12], st: 0.05 },
    { w: 'sine', f: 392, d: 0.15, n: [0, 4, 7, 12], st: 0.05, v: 0.25, at: 0.11 },
    { w: 'sine', f: 98, to: 70, d: 0.15, v: 0.5 }] },
  death: { v: 0.7, j: 0, p: 3, max: 1, gap: 0.5, l: [
    { w: 'triangle', f: 330, d: 0.6, n: [0, -3, -7, -12], st: 0.18, vib: [6, 0.02] },
    { w: 'sine', f: 330, d: 0.6, n: [0, -3, -7, -12], st: 0.18, v: 0.25, at: 0.16 },
    { w: 'noise', f: 900, to: 80, d: 0.7, v: 0.5 },
    { w: 'sine', f: 90, to: 30, d: 0.9, v: 0.9 }] },

  // ─── Ennemis (plus doux que les armes du joueur) ───
  eshoot: { v: 0.2, j: 1.2, p: 0, max: 3, gap: 0.04, l: [
    { w: 'sine', f: 380, to: 200, d: 0.06 },
    { w: 'noise', f: 900, to: 400, d: 0.03, v: 0.3 }] },
  ering: { v: 0.26, j: 1, p: 0, max: 2, gap: 0.06, l: [
    { w: 'sine', f: 260, to: 520, d: 0.18, a: 0.02, vib: [14, 0.04] },
    { w: 'noise', f: 600, to: 1600, d: 0.15, a: 0.03, v: 0.25, flt: 'bandpass', q: 3 }] },
  elob: { v: 0.28, j: 1.5, p: 0, max: 2, l: [
    { w: 'sine', f: 160, to: 380, d: 0.12, a: 0.005 },
    { w: 'noise', f: 400, d: 0.04, v: 0.3 }] },
  elaser: { v: 0.28, j: 0.6, p: 1, max: 2, gap: 0.08, l: [
    { w: 'sawtooth', f: 140, to: 210, d: 0.35, a: 0.06, vib: [40, 0.03], ff: 900, flt: 'lowpass' },
    { w: 'noise', f: 2000, d: 0.3, a: 0.05, v: 0.25, flt: 'bandpass', q: 8 },
    { w: 'sine', f: 600, to: 150, d: 0.12, at: 0.25, v: 0.6 }] },
  summon: { v: 0.36, j: 0.5, p: 1, max: 2, l: [
    { w: 'sine', f: 196, d: 0.25, n: [0, 3, 7, 10, 15], st: 0.055, vib: [7, 0.015] },
    { w: 'noise', f: 300, to: 1800, d: 0.35, a: 0.15, v: 0.3, flt: 'bandpass', q: 4 },
    { w: 'sine', f: 65, to: 55, d: 0.4, a: 0.05, v: 0.5 }] },

  // ─── Mouvement ───
  dash: { v: 0.38, j: 1, p: 1, max: 1, l: [
    { w: 'noise', f: 400, to: 2000, d: 0.13, a: 0.02, flt: 'bandpass', q: 1.2 },
    { w: 'sine', f: 140, to: 80, d: 0.08, v: 0.5 }] },
  blink: { v: 0.32, j: 0.5, p: 1, max: 1, l: [
    { w: 'sine', f: 900, to: 1800, d: 0.06, a: 0.005 },
    { w: 'sine', f: 1800, to: 700, d: 0.09, at: 0.05, v: 0.6 },
    { w: 'noise', f: 4000, d: 0.08, v: 0.15, flt: 'bandpass', q: 6 }] },
  phase: { v: 0.34, j: 0.5, p: 1, max: 1, l: [
    { w: 'sine', f: 330, to: 660, d: 0.24, a: 0.03, vib: [9, 0.06] },
    { w: 'triangle', f: 660, to: 330, d: 0.24, a: 0.03, v: 0.35, ff: 1800, flt: 'lowpass' }] },

  // ─── Déroulement ───
  boss: { v: 0.7, j: 0, p: 3, max: 1, gap: 1, l: [
    { w: 'sine', f: 55, to: 45, d: 1.4, a: 0.04, v: 1.2 },
    { w: 'sawtooth', f: 55, d: 1.2, a: 0.1, ff: 350, flt: 'lowpass', v: 0.5 },
    { w: 'noise', f: 250, d: 1.0, a: 0.25, v: 0.4 },
    { w: 'triangle', f: 110, d: 0.5, n: [0, 6, 12], st: 0.3, v: 0.45 }] },
  wave: { v: 0.36, j: 0, p: 2, max: 1, gap: 0.3, l: [
    { w: 'triangle', f: 330, d: 0.15, n: [0, 5], st: 0.1 },
    { w: 'sine', f: 82, to: 65, d: 0.18, v: 0.6 }] },
  lock: { v: 0.45, j: 0, p: 2, max: 1, gap: 0.2, l: [
    { w: 'sine', f: 110, to: 50, d: 0.18, v: 1.2 },
    { w: 'noise', f: 700, to: 200, d: 0.12, v: 0.6 },
    { w: 'noise', f: 2500, d: 0.015, v: 0.5, at: 0.07, flt: 'bandpass', q: 2 }] },
  clear: { v: 0.4, j: 0, p: 2, max: 1, gap: 0.3, l: [
    { w: 'triangle', f: 523, d: 0.3, n: [0, 4, 7, 12], st: 0.07 },
    { w: 'sine', f: 523, d: 0.3, n: [0, 4, 7, 12], st: 0.07, v: 0.25, at: 0.14 },
    { w: 'sine', f: 1046, d: 0.3, v: 0.25, at: 0.22, vib: [5, 0.008] }] },
  chest: { v: 0.42, j: 0, p: 2, max: 1, gap: 0.2, l: [
    { w: 'sine', f: 110, to: 70, d: 0.12, v: 0.7 },
    { w: 'triangle', f: 392, d: 0.3, n: [0, 4, 7, 11, 14], st: 0.055, at: 0.03 },
    { w: 'sine', f: 392, d: 0.3, n: [0, 4, 7, 11, 14], st: 0.055, v: 0.22, at: 0.15 },
    { w: 'noise', f: 6000, d: 0.25, v: 0.12, at: 0.2, flt: 'bandpass', q: 3 }] },
  mimic: { v: 0.46, j: 0, p: 2, max: 1, gap: 0.3, l: [
    { w: 'sawtooth', f: 180, d: 0.25, n: [0, -1, 6, -6], st: 0.07, ff: 900, flt: 'lowpass' },
    { w: 'sine', f: 90, to: 45, d: 0.3, v: 0.8 },
    { w: 'noise', f: 700, to: 200, d: 0.2, v: 0.4, at: 0.1 }] },
  portal: { v: 0.4, j: 0, p: 2, max: 1, gap: 0.5, l: [
    { w: 'sine', f: 180, to: 900, d: 0.6, a: 0.1, vib: [7, 0.04] },
    { w: 'noise', f: 400, to: 3000, d: 0.6, a: 0.2, v: 0.25, flt: 'bandpass', q: 5 },
    { w: 'sine', f: 60, to: 90, d: 0.5, a: 0.1, v: 0.5 }] },
  secret: { v: 0.4, j: 0, p: 2, max: 1, gap: 0.5, l: [
    { w: 'triangle', f: 392, d: 0.35, n: [0, 3, 7, 10, 14, 17], st: 0.075 },
    { w: 'sine', f: 392, d: 0.35, n: [0, 3, 7, 10, 14, 17], st: 0.075, v: 0.22, at: 0.15 },
    { w: 'sine', f: 1568, d: 0.35, at: 0.45, v: 0.25, vib: [5, 0.01] }] },

  // ─── Ramassage : cristallin et doux (coin / orb / gem montent en série) ───
  coin: { v: 0.26, j: 0, p: 0, max: 3, gap: 0.03, rise: true, l: [
    { w: 'sine', f: 1318, d: 0.12, n: [0, 7], st: 0.04 },
    { w: 'triangle', f: 2637, d: 0.06, v: 0.12, ff: 4000, flt: 'lowpass' }] },
  orb: { v: 0.26, j: 0, p: 0, max: 3, gap: 0.03, rise: true, l: [
    { w: 'sine', f: 330, to: 720, d: 0.07, a: 0.004 },
    { w: 'sine', f: 520, to: 980, d: 0.05, at: 0.03, v: 0.4 }] },
  heal: { v: 0.38, j: 0, p: 2, max: 1, gap: 0.2, l: [
    { w: 'sine', f: 523, d: 0.28, n: [0, 4, 7, 12], st: 0.065, vib: [5, 0.01] },
    { w: 'sine', f: 523, d: 0.28, n: [0, 4, 7, 12], st: 0.065, v: 0.22, at: 0.13 },
    { w: 'noise', f: 2000, to: 5000, d: 0.3, a: 0.1, v: 0.08, flt: 'bandpass', q: 6 }] },
  gem: { v: 0.34, j: 0, p: 1, max: 2, rise: true, l: [
    { w: 'sine', f: 1046, d: 0.18, n: [0, 12, 7, 19], st: 0.04 },
    { w: 'triangle', f: 1046, d: 0.12, n: [0, 12, 7, 19], st: 0.04, v: 0.15, at: 0.09, ff: 3500, flt: 'lowpass' }] },
  pickup: { v: 0.36, j: 0.3, p: 1, max: 2, l: [
    { w: 'triangle', f: 523, d: 0.1, n: [0, 5, 12], st: 0.04, ff: 2500, flt: 'lowpass' },
    { w: 'sine', f: 130, to: 100, d: 0.06, v: 0.4 }] },
  swap: { v: 0.3, j: 0.5, p: 1, max: 1, l: [
    { w: 'noise', f: 1500, d: 0.012, v: 0.4, flt: 'bandpass', q: 2 },
    { w: 'triangle', f: 330, to: 520, d: 0.05, ff: 1800, flt: 'lowpass' },
    { w: 'triangle', f: 520, to: 400, d: 0.05, at: 0.05, ff: 1800, flt: 'lowpass' }] },

  // ─── Interface / hall ───
  buy: { v: 0.38, j: 0, p: 2, max: 1, l: [
    { w: 'sine', f: 784, d: 0.14, n: [0, 4, 7, 12], st: 0.045 },
    { w: 'triangle', f: 1568, d: 0.1, v: 0.15, at: 0.12, ff: 3500, flt: 'lowpass' },
    { w: 'noise', f: 2500, d: 0.012, v: 0.3, flt: 'bandpass', q: 2 }] },
  deny: { v: 0.36, j: 0, p: 2, max: 1, gap: 0.15, l: [
    { w: 'triangle', f: 196, d: 0.08, ff: 900, flt: 'lowpass' },
    { w: 'triangle', f: 147, d: 0.12, at: 0.09, ff: 900, flt: 'lowpass' }] },
  unlock: { v: 0.42, j: 0, p: 3, max: 1, gap: 0.3, l: [
    { w: 'triangle', f: 523, d: 0.32, n: [0, 4, 7, 12, 16, 19], st: 0.05 },
    { w: 'sine', f: 523, d: 0.32, n: [0, 4, 7, 12, 16, 19], st: 0.05, v: 0.22, at: 0.13 },
    { w: 'sine', f: 131, d: 0.3, n: [0, 7, 12], st: 0.1, v: 0.45 }] },
  select: { v: 0.22, j: 0, p: 1, max: 2, gap: 0.04, l: [
    { w: 'sine', f: 880, d: 0.035 },
    { w: 'noise', f: 3000, d: 0.008, v: 0.3, flt: 'bandpass', q: 3 }] },
  skill: { v: 0.4, j: 0.5, p: 2, max: 1, l: [
    { w: 'sine', f: 300, to: 1100, d: 0.15, a: 0.01 },
    { w: 'noise', f: 600, to: 3500, d: 0.16, a: 0.02, v: 0.35, flt: 'bandpass', q: 2 },
    { w: 'sine', f: 80, to: 55, d: 0.12, v: 0.5 }] },
  offer: { v: 0.38, j: 0, p: 2, max: 1, gap: 0.3, l: [
    { w: 'triangle', f: 440, d: 0.4, n: [0, 7, 12], st: 0.09, vib: [5, 0.01] },
    { w: 'sine', f: 440, d: 0.4, n: [0, 7, 12], st: 0.09, v: 0.22, at: 0.15 },
    { w: 'sine', f: 1760, d: 0.3, v: 0.12, at: 0.22 }] },
  buff: { v: 0.36, j: 0.3, p: 2, max: 1, l: [
    { w: 'sine', f: 440, to: 880, d: 0.14, a: 0.01 },
    { w: 'triangle', f: 880, d: 0.14, n: [0, 7], st: 0.06, v: 0.3, at: 0.08, ff: 3000, flt: 'lowpass' }] },
  pet: { v: 0.3, j: 1, p: 1, max: 1, gap: 0.2, l: [
    { w: 'sine', f: 880, d: 0.07, n: [0, 7, 12], st: 0.045, vib: [20, 0.025] }] },

  // ─── Jingles : arpèges sinus/triangle + écho (copie retardée plus douce) ───
  edict: { v: 0.55, j: 0, p: 3, max: 1, gap: 0.5, l: [
    { w: 'triangle', f: 262, d: 0.55, n: [0, 7, 12, 15, 19], st: 0.1 },
    { w: 'sine', f: 262, d: 0.55, n: [0, 7, 12, 15, 19], st: 0.1, v: 0.28, at: 0.18 },
    { w: 'sine', f: 65, d: 0.9, n: [0, 7], st: 0.4, v: 0.7 },
    { w: 'sine', f: 1046, d: 0.6, at: 0.42, v: 0.22, vib: [5, 0.01] },
    { w: 'noise', f: 300, to: 2000, d: 0.45, a: 0.25, v: 0.12, flt: 'bandpass', q: 4 }] },
  synergy: { v: 0.5, j: 0, p: 3, max: 1, gap: 0.5, l: [
    { w: 'triangle', f: 523, d: 0.4, n: [0, 4, 7, 11, 14, 19], st: 0.06 },
    { w: 'sine', f: 523, d: 0.4, n: [0, 4, 7, 11, 14, 19], st: 0.06, v: 0.25, at: 0.15 },
    { w: 'sine', f: 131, d: 0.4, n: [0, 7, 12], st: 0.12, v: 0.5 },
    { w: 'sine', f: 2093, d: 0.35, at: 0.36, v: 0.15, vib: [6, 0.008] }] },
  victory: { v: 0.55, j: 0, p: 3, max: 1, gap: 1, l: [
    { w: 'triangle', f: 523, d: 0.7, n: [0, 4, 7, 12, 7, 12, 16, 19], st: 0.11 },
    { w: 'sine', f: 523, d: 0.7, n: [0, 4, 7, 12, 7, 12, 16, 19], st: 0.11, v: 0.25, at: 0.17 },
    { w: 'sine', f: 131, d: 0.7, n: [0, 5, 7, 12], st: 0.22, v: 0.7 },
    { w: 'noise', f: 5000, d: 0.5, at: 0.8, a: 0.05, v: 0.1, flt: 'bandpass', q: 4 }] },
  gameover: { v: 0.55, j: 0, p: 3, max: 1, gap: 1, l: [
    { w: 'triangle', f: 330, d: 0.8, n: [7, 3, 0, -5, -12], st: 0.24 },
    { w: 'sine', f: 330, d: 0.8, n: [7, 3, 0, -5, -12], st: 0.24, v: 0.22, at: 0.2 },
    { w: 'sine', f: 82, to: 55, d: 1.2, v: 0.6, vib: [4, 0.02] }] },

  // ─── Sons utilisés par le contenu (armes typées : chacun reconnaissable) ───
  zap: { v: 0.32, j: 1.2, p: 0, max: 3, l: [
    { w: 'sawtooth', f: 1400, to: 300, d: 0.07, ff: 2400, flt: 'lowpass', vib: [70, 0.08] },
    { w: 'noise', f: 3500, d: 0.05, v: 0.35, flt: 'bandpass', q: 5 }] },
  bubble: { v: 0.3, j: 2, p: 0, max: 3, l: [
    { w: 'sine', f: 240, to: 720, d: 0.06, a: 0.004 },
    { w: 'sine', f: 380, to: 1000, d: 0.05, at: 0.045, v: 0.55 }] },
  thud: { v: 0.5, j: 1.2, p: 1, max: 3, l: [
    { w: 'sine', f: 110, to: 38, d: 0.18, v: 1.2 },
    { w: 'noise', f: 350, to: 120, d: 0.1, v: 0.6 }] },
  pew: { v: 0.32, j: 1.5, p: 0, max: 3, l: [
    { w: 'triangle', f: 1000, to: 280, d: 0.08, ff: 2400, flt: 'lowpass' },
    { w: 'sine', f: 180, to: 90, d: 0.04, v: 0.4 }] },
  boing: { v: 0.4, j: 1, p: 1, max: 2, l: [
    { w: 'sine', f: 140, to: 440, d: 0.25, vib: [16, 0.2], lin: true },
    { w: 'noise', f: 500, d: 0.02, v: 0.3 }] },
  honk: { v: 0.36, j: 1, p: 1, max: 2, gap: 0.1, l: [
    { w: 'sawtooth', f: 330, to: 310, d: 0.18, a: 0.01, ff: 1100, flt: 'lowpass', q: 5 },
    { w: 'triangle', f: 336, to: 316, d: 0.18, v: 0.5 }] },
  splash: { v: 0.4, j: 1.5, p: 0, max: 3, l: [
    { w: 'noise', f: 2500, to: 400, d: 0.28, a: 0.005 },
    { w: 'sine', f: 300, to: 900, d: 0.05, v: 0.45 },
    { w: 'sine', f: 450, to: 1200, d: 0.04, at: 0.06, v: 0.3 }] },
  fire: { v: 0.4, j: 1.5, p: 0, max: 3, l: [
    { w: 'noise', f: 1200, to: 300, d: 0.3, a: 0.03 },
    { w: 'sine', f: 90, to: 60, d: 0.15, a: 0.02, v: 0.5 },
    { w: 'noise', f: 2500, d: 0.06, v: 0.3, at: 0.06, flt: 'bandpass', q: 4 }] },
  ice: { v: 0.34, j: 1.2, p: 0, max: 3, l: [
    { w: 'sine', f: 1760, to: 2200, d: 0.1 },
    { w: 'triangle', f: 2637, d: 0.15, at: 0.03, v: 0.3, ff: 4000, flt: 'lowpass' },
    { w: 'noise', f: 5000, d: 0.04, v: 0.2, flt: 'bandpass', q: 3 }] },
  charge: { v: 0.36, j: 0.5, p: 1, max: 2, l: [
    { w: 'sine', f: 180, to: 720, d: 0.35, a: 0.05, lin: true, vib: [12, 0.03] },
    { w: 'noise', f: 400, to: 2500, d: 0.35, a: 0.1, v: 0.25, flt: 'bandpass', q: 4 }] },
};

/** Bip générique discret pour un id inconnu. */
export const SFX_FALLBACK: SfxDef = { v: 0.2, j: 0.5, p: 0, max: 2, l: [{ w: 'sine', f: 660, d: 0.05 }] };

/** Demi-tons de la gamme majeure, utilisés pour la montée coin/orb/gem. */
export const RISE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];
