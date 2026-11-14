// Musique de donjon procédurale et adaptative.
// Chaque monde a une composition déterministe (PRNG seedé) : progression de 8 mesures,
// boucle de 16 mesures (A B A' B') avec variations mélodiques et breaks de batterie.
// L'intensité (= nombre d'édits actifs, +2 en boss) ajoute des couches.
import { Engine, mtof, rng, softClip, noiseSource } from './engine';

export type Kit = 'soft' | 'wood' | 'glass' | 'metal';
/** [pas (0..15), ton d'accord (0 fond., 1 tierce, 2 quinte, 3 octave), durée en pas] */
type BassNote = [number, number, number];
/** [pas, degré de gamme, durée en pas] */
type MelNote = [number, number, number];

export interface WorldMusic {
  name: string;
  bpm: number;
  /** Note MIDI fondamentale. */
  root: number;
  /** Gamme (demi-tons). */
  scale: number[];
  seed: number;
  bass: OscillatorType; pad: OscillatorType; arp: OscillatorType; lead: OscillatorType;
  /** Octaves (en demi-tons) relatives à root. */
  bassOct: number; padOct: number; arpOct: number; leadOct: number;
  padCut: number;
  /** Fréquence de coupure du filtre général à intensité 0. */
  cut: number;
  swing: number;
  echo: number;
  leadVib: number;
  kit: Kit;
  /** Progressions de 4 accords (degrés de la gamme). */
  progs: number[][];
  bassPats: BassNote[][];
  /** Motifs d'arpège (indices de ton d'accord 0..3). */
  arpPats: number[][];
  /** Cellules rythmiques autorisées pour la mélodie (indices dans CELLS). */
  cells: number[];
}

// bpm/root/scale des mondes 1-3 = ThemeDef.music des thèmes (content/misc/core.ts).
export const WORLDS: WorldMusic[] = [
  { // 0 — hall / titre : dorien, lent, brumeux
    name: 'hall', bpm: 84, root: 45, scale: [0, 2, 3, 5, 7, 9, 10], seed: 7,
    bass: 'triangle', pad: 'triangle', arp: 'sine', lead: 'sine',
    bassOct: 0, padOct: 12, arpOct: 24, leadOct: 12,
    padCut: 1100, cut: 1700, swing: 0, echo: 0.42, leadVib: 0.006, kit: 'soft',
    progs: [[0, 3, 0, 6], [0, 6, 5, 3], [0, 1, 3, 0], [5, 3, 0, 6]],
    bassPats: [[[0, 0, 16]], [[0, 0, 10], [10, 2, 6]], [[0, 0, 6], [8, 2, 8]]],
    arpPats: [[0, 2, 1, 3, 2, 1, 0, 2], [3, 2, 1, 0, 1, 2, 3, 1]],
    cells: [3, 6, 1],
  },
  { // 1 — forêt : la mineur naturel, 104 bpm, flûte et cordes pincées
    name: 'forest', bpm: 104, root: 45, scale: [0, 2, 3, 5, 7, 8, 10], seed: 1013,
    bass: 'triangle', pad: 'sawtooth', arp: 'square', lead: 'triangle',
    bassOct: 0, padOct: 12, arpOct: 24, leadOct: 24,
    padCut: 850, cut: 2100, swing: 0.12, echo: 0.18, leadVib: 0.012, kit: 'wood',
    progs: [[0, 5, 2, 6], [0, 3, 5, 4], [0, 5, 3, 4], [0, 6, 5, 6]],
    bassPats: [[[0, 0, 6], [6, 0, 2], [8, 2, 4], [12, 3, 4]], [[0, 0, 3], [3, 0, 3], [6, 2, 2], [8, 0, 4], [12, 2, 4]]],
    arpPats: [[0, 1, 2, 3, 2, 1, 2, 1], [0, 2, 1, 2, 3, 2, 1, 2]],
    cells: [0, 1, 2, 3, 4, 5],
  },
  { // 2 — glacier : pentatonique majeure de ré, 116 bpm, cloches et échos
    name: 'glacier', bpm: 116, root: 50, scale: [0, 2, 4, 7, 9], seed: 2029,
    bass: 'sine', pad: 'triangle', arp: 'sine', lead: 'square',
    bassOct: -12, padOct: 12, arpOct: 24, leadOct: 24,
    padCut: 2400, cut: 2800, swing: 0, echo: 0.45, leadVib: 0.004, kit: 'glass',
    progs: [[0, 4, 3, 0], [0, 3, 4, 1], [4, 3, 0, 0], [0, 2, 4, 3]],
    bassPats: [[[0, 0, 3], [3, 0, 3], [6, 2, 2], [8, 0, 4], [12, 2, 4]], [[0, 0, 8], [8, 2, 4], [12, 3, 4]]],
    arpPats: [[0, 1, 2, 3, 1, 2, 3, 2], [3, 2, 1, 0, 1, 2, 3, 1]],
    cells: [0, 2, 4, 5, 1],
  },
  { // 3 — volcan : sol phrygien, 132 bpm, basse en dents de scie qui martèle
    name: 'volcano', bpm: 132, root: 43, scale: [0, 1, 3, 5, 7, 8, 10], seed: 3041,
    bass: 'sawtooth', pad: 'sawtooth', arp: 'square', lead: 'sawtooth',
    bassOct: -12, padOct: 12, arpOct: 24, leadOct: 24,
    padCut: 700, cut: 1300, swing: 0, echo: 0.1, leadVib: 0.008, kit: 'metal',
    progs: [[0, 1, 0, 6], [0, 5, 1, 0], [0, 6, 5, 1], [0, 1, 6, 1]],
    bassPats: [
      [[0, 0, 2], [2, 0, 2], [4, 3, 1], [6, 0, 2], [8, 0, 2], [10, 1, 2], [12, 0, 2], [14, 3, 2]],
      [[0, 0, 3], [3, 0, 3], [6, 0, 2], [8, 1, 2], [10, 0, 2], [12, 0, 1], [13, 0, 1], [14, 3, 2]]],
    arpPats: [[0, 1, 0, 2, 0, 1, 3, 2], [0, 0, 1, 0, 2, 0, 3, 1]],
    cells: [0, 2, 4, 5],
  },
];

/** Cellules rythmiques d'une mesure : [début, durée] en doubles croches. */
const CELLS: [number, number][][] = [
  [[0, 4], [4, 2], [6, 2], [8, 8]],
  [[0, 6], [6, 2], [8, 4], [12, 4]],
  [[0, 2], [2, 2], [4, 4], [10, 2], [12, 4]],
  [[0, 8], [8, 2], [10, 2], [12, 4]],
  [[0, 3], [3, 3], [6, 2], [8, 4], [12, 2], [14, 2]],
  [[0, 4], [6, 2], [8, 2], [10, 2], [12, 4]],
  [[0, 12], [12, 4]],
];

export type LayerName = 'bass' | 'pad' | 'drums' | 'arp' | 'lead' | 'dist';
export const LAYERS: LayerName[] = ['bass', 'pad', 'drums', 'arp', 'lead', 'dist'];
const LVOL: Record<LayerName, number> = { bass: 0.55, pad: 0.5, drums: 0.6, arp: 0.45, lead: 0.5, dist: 0 };

/** Couches actives pour une intensité donnée. */
export function layersFor(n: number): Record<LayerName, boolean> {
  return { bass: true, pad: true, drums: n >= 1, arp: n >= 3, lead: n >= 5, dist: n >= 7 };
}
/** 0 : aucune ; 1 : légère ; 2 : + caisse claire ; 3 : dense ; 4 : doubles croches. */
export function drumTier(n: number): number {
  return n >= 7 ? 4 : n >= 5 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0;
}
/** Accélération du tempo (jusqu'à +12 %) à partir de 7 édits. */
export function tempoBoost(n: number): number {
  return n >= 7 ? Math.min(0.12, 0.03 * (n - 6)) : 0;
}

export interface Comp { chords: number[]; mel: MelNote[][]; bass: BassNote[]; arp: number[] }

/** Composition déterministe d'un monde. */
export function compose(wm: WorldMusic): Comp {
  const r = rng(wm.seed);
  const pick = <T>(a: T[]): T => a[Math.floor(r() * a.length) % a.length];
  const L = wm.scale.length;
  const ia = Math.floor(r() * wm.progs.length);
  let ib = Math.floor(r() * (wm.progs.length - 1));
  if (ib >= ia) ib++;
  const A = wm.progs[ia], B = wm.progs[ib % wm.progs.length];
  const chords = [...A, ...B, ...A, ...B];
  const lo = -2, hi = L + 5;
  const clamp = (d: number) => Math.max(lo, Math.min(hi, d));
  const cells = wm.cells.map((i) => CELLS[i]);
  let prev = 2;
  const nearest = (ch: number, p: number): number => {
    let best = ch, bd = 1e9;
    for (let k = -1; k <= 2; k++) for (const o of [0, 2, 4]) {
      const d = ch + o + k * L;
      if (d < lo || d > hi) continue;
      const dist = Math.abs(d - p);
      if (dist < bd) { bd = dist; best = d; }
    }
    return best;
  };
  const gen = (ch: number, cell: [number, number][]): MelNote[] => cell.map(([st, len]) => {
    const d = st % 8 === 0 ? nearest(ch, prev) : clamp(prev + pick([-1, 1, 1, -1, 2, -2, 0]));
    prev = d;
    return [st, d, len] as MelNote;
  });
  const shift = (m: MelNote[], by: number): MelNote[] => m.map(([s, d, l]) => [s, clamp(d + by), l] as MelNote);
  const cad = (ch: number): MelNote[] => {
    const a = clamp(prev + pick([-1, 1]));
    const b = nearest(ch, a);
    prev = b;
    return [[0, a, 4], [4, clamp(b + 1), 4], [8, b, 8]];
  };
  const half: MelNote[][] = [];
  half[0] = gen(chords[0], pick(cells));
  half[1] = gen(chords[1], pick(cells));
  half[2] = shift(half[0], chords[2] - chords[0]);
  half[3] = cad(chords[3]);
  half[4] = gen(chords[4], pick(cells));
  half[5] = gen(chords[5], pick(cells));
  half[6] = shift(half[4], chords[6] - chords[4]);
  half[7] = cad(chords[7]);
  // Seconde moitié : mêmes phrases, mais réponses variées et cadence finale différente.
  const second = half.map((m) => m.map((x) => [...x] as MelNote));
  prev = second[0][second[0].length - 1][1];
  second[1] = gen(chords[9], pick(cells));
  prev = second[4][second[4].length - 1][1];
  second[5] = gen(chords[13], pick(cells));
  prev = second[6][second[6].length - 1][1];
  second[7] = cad(chords[15]);
  return { chords, mel: [...half, ...second], bass: pick(wm.bassPats), arp: pick(wm.arpPats) };
}

/** Un morceau en cours : ses bus persistants + son séquenceur. */
export class Song {
  readonly wm: WorldMusic;
  readonly comp: Comp;
  readonly out: GainNode;
  private filt: BiquadFilterNode;
  private gains: Record<LayerName, GainNode>;
  private persist: AudioNode[] = [];
  private on: Record<LayerName, boolean> = { bass: true, pad: true, drums: false, arp: false, lead: false, dist: false };
  private offAt: Record<LayerName, number> = { bass: -1e9, pad: -1e9, drums: -1e9, arp: -1e9, lead: -1e9, dist: -1e9 };
  n = 0;
  private tempo = 1;
  private tempoTarget = 1;
  private next: number;
  pos = 0;
  notes = 0;
  dead = false;

  constructor(private e: Engine, readonly world: number, dest: AudioNode, fadeIn: number) {
    const ac = e.ac;
    this.wm = WORLDS[world];
    this.comp = compose(this.wm);
    const now = ac.currentTime;
    const P = <T extends AudioNode>(n: T): T => { this.persist.push(n); return n; };
    this.out = P(ac.createGain());
    this.out.gain.setValueAtTime(0.0001, now);
    this.out.gain.setTargetAtTime(1, now, Math.max(0.02, fadeIn / 3));
    this.filt = P(ac.createBiquadFilter());
    this.filt.type = 'lowpass';
    this.filt.Q.value = 0.7;
    this.filt.frequency.setValueAtTime(this.wm.cut, now);
    this.filt.connect(this.out);
    this.out.connect(dest);
    const mix = P(ac.createGain());
    mix.connect(this.filt);
    // Couche de distorsion douce (envoi parallèle).
    const shaper = P(ac.createWaveShaper());
    shaper.curve = softClip(3) as any;
    const distPost = P(ac.createGain());
    distPost.gain.value = 0.6;
    // Écho (croche pointée).
    const delay = P(ac.createDelay(1));
    delay.delayTime.value = Math.min(0.95, this.stepDur() * 3);
    const fb = P(ac.createGain());
    fb.gain.value = 0.32;
    const wet = P(ac.createGain());
    wet.gain.value = this.wm.echo;
    delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(this.filt);
    const padLP = P(ac.createBiquadFilter());
    padLP.type = 'lowpass';
    padLP.frequency.value = this.wm.padCut;
    padLP.connect(mix);
    const g = {} as Record<LayerName, GainNode>;
    for (const name of LAYERS) {
      const gn = P(ac.createGain());
      gn.gain.setValueAtTime(this.on[name] ? LVOL[name] : 0, now);
      g[name] = gn;
    }
    g.bass.connect(mix); g.drums.connect(mix);
    g.pad.connect(padLP);
    g.arp.connect(mix); g.arp.connect(delay);
    g.lead.connect(mix); g.lead.connect(delay);
    mix.connect(g.dist); g.dist.connect(shaper); shaper.connect(distPost); distPost.connect(this.filt);
    this.gains = g;
    this.next = now + 0.06;
  }

  stepDur(): number { return 60 / (this.wm.bpm * this.tempo) / 4; }
  bpm(): number { return this.wm.bpm * this.tempo; }

  activeLayers(): LayerName[] { return LAYERS.filter((l) => this.on[l]); }

  setIntensity(n: number, now: number): void {
    this.n = n;
    const want = layersFor(n);
    const tc = this.stepDur() * 4; // ~1 mesure pour atteindre la cible
    for (const name of LAYERS) {
      if (want[name] !== this.on[name]) {
        if (!want[name]) this.offAt[name] = now;
        this.on[name] = want[name];
      }
      const target = name === 'dist' ? (want.dist ? 0.12 + 0.05 * Math.min(3, n - 7) : 0) : want[name] ? LVOL[name] : 0;
      this.gains[name].gain.setTargetAtTime(target, now, tc);
    }
    const open = n >= 7 ? 1.8 + 0.15 * (n - 7) : 1;
    const cut = Math.min(16000, this.wm.cut * (1 + 0.12 * Math.min(n, 6)) * open);
    this.filt.frequency.setTargetAtTime(cut, now, tc);
    this.tempoTarget = 1 + tempoBoost(n);
  }

  fadeOut(now: number, dur: number): void {
    this.dead = true;
    this.out.gain.setTargetAtTime(0, now, Math.max(0.02, dur / 4));
  }

  dispose(): void {
    for (const n of this.persist) { try { n.disconnect(); } catch { /* déjà déconnecté */ } }
    this.persist.length = 0;
  }

  /** Planifie toutes les doubles croches tombant dans [now, now + ahead). */
  pump(now: number, ahead: number, silent: boolean): void {
    if (this.dead) return;
    // Onglet en arrière-plan / contexte suspendu : on se recale sans rafale de notes.
    if (this.next < now - 0.05) this.next = now + 0.03;
    let guard = 0;
    while (this.next < now + ahead && guard++ < 64) {
      if (!silent) this.step(this.pos, this.next);
      this.tempo += (this.tempoTarget - this.tempo) * 0.05;
      this.next += this.stepDur();
      this.pos = (this.pos + 1) % 256;
    }
  }

  private live(name: LayerName, t: number): boolean {
    return this.on[name] || t < this.offAt[name] + this.stepDur() * 32;
  }

  private dm(base: number, deg: number): number {
    const sc = this.wm.scale, L = sc.length;
    const o = Math.floor(deg / L);
    return base + sc[deg - o * L] + 12 * o;
  }

  private step(pos: number, t: number): void {
    const s = pos & 15, bar = (pos >> 4) & 15;
    const sd = this.stepDur(), barDur = sd * 16;
    const wm = this.wm, n = this.n, L = wm.scale.length, c = this.comp;
    const tt = t + (s & 1 ? wm.swing * sd : 0);
    const ch = c.chords[bar];
    const tones = [0, 2, 4, L];
    const fill = (bar & 7) === 7;

    if (this.live('drums', t)) this.drums(s, tt, drumTier(n), fill);

    if (this.live('bass', t)) {
      const base = wm.root + wm.bassOct;
      const bm = (k: number) => { let m = this.dm(base, ch + tones[k]); if (m > base + 14) m -= 12; return m; };
      if (n >= 7) {
        if ((s & 1) === 0) this.tone(this.gains.bass, wm.bass, bm([0, 0, 3, 0, 2, 0, 3, 2][s >> 1]), tt, sd * 1.6, 0.5, 0.005, 0.04, false);
      } else {
        for (const [st, k, len] of c.bass) if (st === s) this.tone(this.gains.bass, wm.bass, bm(k), tt, len * sd * 0.9, 0.5, 0.01, 0.06, false);
      }
    }

    if (s === 0 && this.live('pad', t)) {
      const base = wm.root + wm.padOct;
      [0, 2, 4].forEach((k, i) => this.tone(this.gains.pad, wm.pad, this.dm(base, ch + k), t, barDur * 0.92, 0.17,
        Math.min(0.5, barDur * 0.3), barDur * 0.25, false, 0, [-5, 4, -2][i]));
    }

    if (this.live('lead', t)) {
      for (const [st, d, len] of c.mel[bar]) if (st === s) {
        this.tone(this.gains.lead, wm.lead, this.dm(wm.root + wm.leadOct, d), tt, len * sd * 0.85, wm.lead === 'sine' || wm.lead === 'triangle' ? 0.26 : 0.16,
          0.012, 0.08, false, len >= 4 ? wm.leadVib : 0);
      }
    }

    if (this.live('arp', t)) {
      const rate = n >= 7 ? 1 : 2;
      if (s % rate === 0) {
        const k = c.arp[(s / rate) % c.arp.length];
        const v = wm.arp === 'square' || wm.arp === 'sawtooth' ? 0.09 : 0.16;
        this.tone(this.gains.arp, wm.arp, this.dm(wm.root + wm.arpOct, ch + tones[k]), tt, sd * rate * 0.8, v, 0.004, 0, true);
      }
    }
  }

  private drums(s: number, t: number, tier: number, fill: boolean): void {
    if (tier <= 0) return;
    const kit = this.wm.kit;
    const kick = tier === 1 ? [0, 8] : tier === 2 ? [0, 8] : tier === 3 ? [0, 7, 8] : [0, 3, 8, 10];
    if (kit === 'metal' && tier >= 3) kick.push(14);
    const snare = tier === 1 ? [] : tier === 2 ? [12] : [4, 12];
    let hats: number[] = tier === 1 ? [4, 12] : tier === 2 ? [2, 6, 10, 14] : tier === 3 ? [0, 2, 4, 6, 8, 10, 12, 14] : [];
    if (tier === 4) hats = Array.from({ length: 16 }, (_, i) => i);
    const hum = 0.9 + Math.random() * 0.2;
    if (kick.includes(s)) this.kick(t, (tier === 1 ? 0.55 : 0.85) * hum);
    if (snare.includes(s) && !(fill && tier >= 3 && s === 12)) this.snare(t, 0.5 * hum);
    if (tier === 4 && s === 14 && !fill) this.snare(t, 0.15 * hum); // note fantôme
    if (fill && tier >= 3 && s >= 12) this.snare(t, (0.25 + 0.1 * (s - 12)) * hum);
    if (hats.includes(s)) this.hat(t, (s % 4 === 2 ? 0.3 : 0.18) * (tier === 1 ? 0.7 : 1) * hum, tier >= 3 && s === 14);
  }

  // ─── Voix ───

  private tone(bus: AudioNode, type: OscillatorType, midi: number, t: number, dur: number, vol: number,
    att: number, rel: number, pluck: boolean, vib = 0, detune = 0): void {
    if (!this.e.take('m')) return;
    const ac = this.e.ac;
    const o = ac.createOscillator(), g = ac.createGain();
    const f = mtof(midi);
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (detune) o.detune.setValueAtTime(detune, t);
    const a = Math.max(0.002, Math.min(att, dur * 0.5));
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    let end: number;
    if (pluck) {
      g.gain.exponentialRampToValueAtTime(0.0005, t + a + dur);
      end = t + a + dur + 0.02;
    } else {
      const hold = Math.max(a + 0.001, dur);
      g.gain.setValueAtTime(vol, t + hold);
      g.gain.linearRampToValueAtTime(0, t + hold + Math.max(0.01, rel));
      end = t + hold + Math.max(0.01, rel) + 0.02;
    }
    const nodes: AudioNode[] = [o, g];
    if (vib > 0) {
      const lfo = ac.createOscillator(), lg = ac.createGain();
      lfo.frequency.value = 5.5;
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * vib, t + Math.min(0.3, dur));
      lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t); lfo.stop(end);
      nodes.push(lfo, lg);
    }
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(end);
    this.e.own(o, nodes, 'm');
    this.notes++;
  }

  private kick(t: number, v: number): void {
    if (!this.e.take('m')) return;
    const ac = this.e.ac;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    const f0 = this.wm.kit === 'metal' ? 190 : this.wm.kit === 'soft' ? 120 : 160;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(v * (this.wm.kit === 'soft' ? 0.6 : 1), t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.3);
    o.connect(g); g.connect(this.gains.drums);
    o.start(t); o.stop(t + 0.32);
    this.e.own(o, [o, g], 'm');
    this.notes++;
  }

  private noiseHit(t: number, v: number, type: BiquadFilterType, freq: number, q: number, dur: number): void {
    if (!this.e.take('m')) return;
    const ac = this.e.ac;
    const src = noiseSource(this.e, t, dur + 0.02);
    const f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f); f.connect(g); g.connect(this.gains.drums);
    this.e.own(src, [src, f, g], 'm');
    this.notes++;
  }

  private snare(t: number, v: number): void {
    const kit = this.wm.kit;
    if (kit === 'soft') { this.tone(this.gains.drums, 'triangle', 84, t, 0.03, v * 0.5, 0.001, 0, true); return; }
    this.noiseHit(t, v, kit === 'glass' ? 'highpass' : 'bandpass', kit === 'wood' ? 1400 : 2000, 0.8, 0.15);
    if (kit !== 'glass') this.tone(this.gains.drums, 'triangle', kit === 'metal' ? 50 : 55, t, 0.06, v * 0.6, 0.001, 0, true);
  }

  private hat(t: number, v: number, open: boolean): void {
    const kit = this.wm.kit;
    const freq = kit === 'glass' ? 9500 : kit === 'wood' ? 5000 : kit === 'soft' ? 6000 : 7500;
    this.noiseHit(t, v * (kit === 'soft' ? 0.4 : 1), kit === 'wood' ? 'bandpass' : 'highpass', freq, kit === 'wood' ? 2 : 0.7, open ? 0.14 : 0.035);
  }
}
