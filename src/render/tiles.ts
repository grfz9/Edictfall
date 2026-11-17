// Peint le sol et les murs d'un étage dans un canvas, selon le thème (couleurs) et le style (motifs) du monde.
// Tout est peint pixel par pixel dans un Uint32Array (rapide : un étage entier en quelques ms), une seule fois
// par étage / par mur cassé. Les éléments animés (lave, ronces, reflets, torches) sont rendus par le renderer
// à partir des `FloorFeatures` collectées ici.
import type { ThemeDef } from '../core/types';
import { T, TILE, tileAt, type Floor } from '../sim/dungeon';
import { styleFor, DECO, DECO_LIGHT, type WorldStyle } from './style';

export const DEFAULT_THEME: ThemeDef = {
  world: 0, name: 'Le Hall',
  floor: ['#3b3550', '#433c5a', '#35304a'], floorDeco: '#544c74',
  wallTop: '#6a5f8c', wallTopLight: '#9a8fc4', wallFace: '#4a4168', wallFaceDark: '#2e2844',
  voidColor: '#0b0812', hazard: ['#5a1f3e', '#e05a8a'], slick: ['#4a6a98', '#9ac0e8'], door: '#c8901c',
  ambient: 0xffffff, music: { bpm: 96, root: 45, scale: [0, 2, 3, 5, 7, 8, 10] }, hazardRate: 0, slickRate: 0,
};

/** Éléments du décor que le renderer anime / éclaire. Coordonnées en pixels monde. */
export interface FloorFeatures {
  /** Sources murales (x, y = base de la flamme). */
  torches: { x: number; y: number; ph: number }[];
  /** Tuiles dangereuses / glissantes (coin haut-gauche) avec une phase d'animation. */
  hazards: { x: number; y: number; ph: number }[];
  slicks: { x: number; y: number; ph: number }[];
  /** Petites lumières de décor (cristaux, braises, bougies). */
  lights: { x: number; y: number; color: number; r: number; ph: number }[];
}
export const emptyFeatures = (): FloorFeatures => ({ torches: [], hazards: [], slicks: [], lights: [] });

export function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const wallish = (t: number) => t === T.WALL || t === T.CRACK || t === T.BLOCK;
const floorish = (t: number) => t === T.FLOOR || t === T.DOOR || t === T.DOORC || t === T.HAZARD || t === T.SLICK;

// ------------------------------------------------------------------ couleurs
export function hexNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}
function mix(a: number, b: number, t: number): number {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = (a & 255) + (((b & 255) - (a & 255)) * t);
  return ((r & 255) << 16) | ((g & 255) << 8) | (bl & 255);
}
const lit = (c: number, k: number) => mix(c, 0xffffff, k);
const dk = (c: number, k: number) => mix(c, 0x000000, k);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x: number, y: number) => BAYER[(x & 3) + ((y & 3) << 2)];

// ------------------------------------------------------------------ tampon de pixels
class Pix {
  readonly d: Uint32Array;
  constructor(readonly w: number, readonly h: number) { this.d = new Uint32Array(w * h); }
  set(x: number, y: number, c: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[x + y * this.w] = (0xff000000 | ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff)) >>> 0;
  }
  get(x: number, y: number): number {
    const v = this.d[x + y * this.w];
    return ((v & 0xff) << 16) | (v & 0xff00) | ((v >> 16) & 0xff);
  }
  rect(x: number, y: number, w: number, h: number, c: number): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }
  blend(x: number, y: number, c: number, a: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.set(x, y, mix(this.get(x, y), c, a));
  }
  blendRect(x: number, y: number, w: number, h: number, c: number, a: number): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.blend(xx, yy, c, a);
  }
  toCanvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    const g = c.getContext('2d')!;
    g.putImageData(new ImageData(new Uint8ClampedArray(this.d.buffer as ArrayBuffer), this.w, this.h), 0, 0);
    return c;
  }
}

// ------------------------------------------------------------------ bruit (grille 4 px, interpolée)
function vnoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix + seed, iy), b = hash(ix + 1 + seed, iy), c = hash(ix + seed, iy + 1), d = hash(ix + 1 + seed, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
class Noise {
  private g: Float32Array;
  private gw: number;
  private w: number;
  private h: number;
  constructor(w: number, h: number, seed: number) {
    this.w = w; this.h = h;
    this.gw = (w >> 2) + 2;
    const gh = (h >> 2) + 2;
    this.g = new Float32Array(this.gw * gh);
    for (let y = 0; y < gh; y++)
      for (let x = 0; x < this.gw; x++) {
        const X = x * 4, Y = y * 4;
        this.g[x + y * this.gw] = vnoise(X / 52, Y / 52, seed) * 0.62 + vnoise(X / 15, Y / 15, seed + 77) * 0.38;
      }
  }
  at(x: number, y: number): number {
    if (x < 0 || x >= this.w) x = ((x % this.w) + this.w) % this.w;
    if (y < 0 || y >= this.h) y = ((y % this.h) + this.h) % this.h;
    const gx = x >> 2, gy = y >> 2, fx = (x & 3) / 4, fy = (y & 3) / 4, w = this.gw, g = this.g;
    const i = gx + gy * w;
    const a = g[i], b = g[i + 1], c = g[i + w], d = g[i + w + 1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
}

/** Dessine un motif de décor (DECO) avec une ombre portée 1 px. */
function stamp(px: Pix, pat: string[], x: number, y: number, pal: Record<string, number>): void {
  for (let yy = 0; yy < pat.length; yy++)
    for (let xx = 0; xx < pat[yy].length; xx++) {
      const ch = pat[yy][xx];
      if (ch === '.') continue;
      const below = pat[yy + 1]?.[xx + 1];
      if (!below || below === '.') px.blend(x + xx + 1, y + yy + 1, 0, 0.35);
    }
  for (let yy = 0; yy < pat.length; yy++)
    for (let xx = 0; xx < pat[yy].length; xx++) {
      const ch = pat[yy][xx];
      if (ch !== '.') px.set(x + xx, y + yy, pal[ch] ?? 0xff00ff);
    }
}

interface Pal {
  st: WorldStyle;
  ramp: number[];
  alt: number[];
  fd: number;
  wt: number; wtl: number; wf: number; wfd: number;
  h0: number; h1: number; s0: number; s1: number;
  door: number;
}

function makePal(theme: ThemeDef, st: WorldStyle): Pal {
  const f0 = hexNum(theme.floor[0]), f1 = hexNum(theme.floor[1]), f2 = hexNum(theme.floor[2]);
  const wt = hexNum(theme.wallTop), wf = hexNum(theme.wallFace);
  let alt: number[];
  switch (st.floor) {
    case 'grass': alt = [dk(mix(wt, f2, 0.35), 0.25), dk(mix(wt, f2, 0.45), 0.12), mix(wt, f0, 0.5)]; break; // terre
    case 'snow': alt = [mix(f1, 0x9ad0ff, 0.25), lit(mix(f1, 0x9ad0ff, 0.3), 0.15), lit(f1, 0.35)]; break; // glace vive
    case 'basalt': alt = [dk(f2, 0.14), mix(f2, 0x5a2a20, 0.15), mix(f2, 0x6a3020, 0.3)]; break; // roche brûlée
    default: alt = [dk(f2, 0.12), f2, mix(f0, wf, 0.3)];
  }
  return {
    st, alt,
    ramp: [dk(f2, 0.2), f2, f0, f1, lit(f1, 0.08)],
    fd: hexNum(theme.floorDeco),
    wt, wtl: hexNum(theme.wallTopLight), wf, wfd: hexNum(theme.wallFaceDark),
    h0: hexNum(theme.hazard[0]), h1: hexNum(theme.hazard[1]), s0: hexNum(theme.slick[0]), s1: hexNum(theme.slick[1]),
    door: hexNum(theme.door),
  };
}

// ------------------------------------------------------------------ sol
function paintFloorTile(px: Pix, nz: Noise, P: Pal, f: Floor, tx: number, ty: number, t: number): void {
  const x0 = tx * TILE, y0 = ty * TILE, h = hash(tx, ty), st = P.st.floor;
  const ramp = P.ramp, alt = P.alt;
  // base : bruit + tramage ordonné → dégradés pixel-art organiques
  for (let yy = 0; yy < TILE; yy++)
    for (let xx = 0; xx < TILE; xx++) {
      const X = x0 + xx, Y = y0 + yy;
      const n = nz.at(X, Y);
      const b = bayer(X, Y) - 0.5;
      let c: number;
      if ((st === 'grass' && n < 0.3) || (st === 'snow' && n > 0.7) || (st === 'basalt' && n > 0.72)) {
        const k = st === 'grass' ? (0.3 - n) / 0.3 : (n - 0.7) / 0.3;
        c = alt[Math.max(0, Math.min(2, Math.floor(k * 3 + b * 1.4 + 0.3)))];
      } else c = ramp[Math.max(0, Math.min(4, Math.floor(n * 5 + b * 1.2)))];
      px.set(X, Y, c);
    }
  const fd = P.fd;
  if (st === 'flag' || st === 'basalt') {
    // dalles : joints sombres + biseau clair ; rangées décalées
    const off = st === 'basalt' && (ty & 1) ? 8 : 0;
    const mortar = st === 'basalt' ? 0x000000 : dk(ramp[0], 0.3);
    for (let i = 0; i < TILE; i++) {
      px.blend(x0 + i, y0, mortar, 0.45);
      px.blend(x0 + ((off + 0) & 15), y0 + i, mortar, 0.45);
      px.blend(x0 + i, y0 + 1, 0xffffff, 0.05);
      px.blend(x0 + ((off + 1) & 15), y0 + i, 0xffffff, 0.04);
    }
    if (h < 0.2 && st === 'flag') {
      // pavés 4×
      for (let i = 0; i < TILE; i++) { px.blend(x0 + 8, y0 + i, mortar, 0.35); px.blend(x0 + i, y0 + 8, mortar, 0.35); }
    } else if (h >= 0.2 && h < 0.3) {
      // fissure
      let cx = x0 + 3 + ((h * 97) % 8 | 0), cy = y0 + 2;
      for (let k = 0; k < 11; k++) { px.blend(cx, cy, 0, 0.4); cy++; cx += hash(tx * 5 + k, ty) < 0.5 ? 1 : -1; if (k === 5) px.blend(cx + 2, cy, 0, 0.3); }
    }
    if (st === 'basalt') {
      // joints incandescents (braises), cendres, grilles
      if (h > 0.86) for (let i = 2; i < 14; i++) { px.blend(x0 + i, y0, 0xff6a20, 0.55 - Math.abs(i - 8) * 0.05); if (i % 3 === 0) px.blend(x0 + i, y0 + 1, 0xffb040, 0.25); }
      if (h > 0.4 && h < 0.42) {
        px.rect(x0 + 3, y0 + 3, 10, 10, 0x1a0c0c);
        for (let i = 4; i < 13; i += 2) for (let j = 4; j < 13; j++) px.set(x0 + i, y0 + j, j % 3 === 0 ? 0xff7a30 : 0x3a1c18);
        for (let i = 3; i < 13; i++) { px.set(x0 + i, y0 + 3, 0x6a5a6a); px.set(x0 + 3, y0 + i, 0x6a5a6a); px.set(x0 + i, y0 + 12, 0x2a1a1e); }
      }
      for (let k = 0; k < 3; k++) { const v = hash(tx * 11 + k, ty * 13); if (v < 0.5) px.blend(x0 + ((v * 211) % 15 | 0), y0 + ((v * 157) % 15 | 0), 0x8a8a90, 0.5); }
    } else if (h > 0.965) {
      // rune gravée (Hall)
      stamp(px, DECO.rune, x0 + 5, y0 + 5, { f: lit(fd, 0.2) });
    } else if (h > 0.5 && h < 0.58) {
      for (let k = 0; k < 6; k++) px.blend(x0 + 3 + ((hash(k, tx) * 10) | 0), y0 + 3 + ((hash(ty, k) * 10) | 0), fd, 0.8);
    }
  } else if (st === 'grass') {
    // brins d'herbe clairs/sombres
    const nb = 3 + ((h * 7) | 0);
    const light = lit(ramp[3], 0.18), dark = dk(ramp[1], 0.15);
    for (let k = 0; k < nb; k++) {
      const v = hash(tx * 7 + k, ty * 3 + k), bx = x0 + 1 + ((v * 977) % 14 | 0), by = y0 + 2 + ((v * 613) % 13 | 0);
      if (nz.at(bx, by) < 0.3) continue; // pas d'herbe dans la terre
      const c = v < 0.5 ? light : fd;
      px.set(bx, by, c); px.set(bx, by + 1, c); px.set(bx + (v < 0.25 ? -1 : 1), by - 1, c);
      px.set(bx, by + 2, dark);
    }
    if (h < 0.045 && t === T.FLOOR) {
      // pierre de gué moussue
      const sx = x0 + 3, sy = y0 + 5;
      for (let yy = 0; yy < 6; yy++) for (let xx = 0; xx < 10; xx++) {
        const dx = (xx - 4.5) / 5, dy = (yy - 2.5) / 3;
        if (dx * dx + dy * dy > 1) continue;
        px.set(sx + xx, sy + yy, yy < 2 ? 0x8a93a8 : yy > 3 ? 0x4a5060 : 0x6a7088);
        if (bayer(xx, yy) > 0.7 && yy < 3) px.set(sx + xx, sy + yy, 0x58a050);
      }
      for (let xx = 1; xx < 9; xx++) px.blend(sx + xx, sy + 6, 0, 0.35);
    }
  } else if (st === 'snow') {
    // creux de pas / bosses et paillettes
    for (let k = 0; k < 2; k++) {
      const v = hash(tx * 9 + k, ty * 5 - k);
      if (v > 0.6) continue;
      const bx = x0 + 2 + ((v * 911) % 11 | 0), by = y0 + 2 + ((v * 577) % 11 | 0);
      px.blend(bx, by, 0xffffff, 0.35); px.blend(bx + 1, by, 0xffffff, 0.35);
      px.blend(bx, by + 1, 0x203050, 0.18); px.blend(bx + 1, by + 1, 0x203050, 0.18);
    }
    for (let k = 0; k < 3; k++) { const v = hash(tx * 3 + k * 17, ty * 7 + k); if (v < 0.35) px.set(x0 + ((v * 431) % 16 | 0), y0 + ((v * 271) % 16 | 0), 0xffffff); }
    if (nz.at(x0 + 8, y0 + 8) > 0.72 && h < 0.4) {
      // fissure dans la glace vive
      let cx = x0 + 2 + ((h * 50) % 10 | 0), cy = y0 + 3;
      for (let k = 0; k < 10; k++) { px.blend(cx, cy, 0x2858c8, 0.35); px.blend(cx + 1, cy, 0xffffff, 0.25); cx += hash(k, tx + ty) < 0.5 ? 1 : 0; cy++; }
    }
  }
  if (t === T.DOOR || t === T.DOORC) {
    // seuil : dalle claire bordée
    const c = mix(P.ramp[3], P.door, 0.12);
    for (let yy = 1; yy < 15; yy++) for (let xx = 1; xx < 15; xx++) px.set(x0 + xx, y0 + yy, mix(c, P.ramp[1], bayer(xx, yy) * 0.5));
    for (let i = 1; i < 15; i++) { px.blend(x0 + i, y0 + 1, 0xffffff, 0.12); px.blend(x0 + i, y0 + 14, 0, 0.3); }
  }
}

/** Distance (0..2) au bord le plus proche partagé avec une tuile d'un autre type ; 9 = intérieur. */
function rimDist(f: Floor, tx: number, ty: number, xx: number, yy: number, same: number): number {
  let d = 9;
  if (tileAt(f, tx, ty - 1) !== same) d = Math.min(d, yy);
  if (tileAt(f, tx, ty + 1) !== same) d = Math.min(d, 15 - yy);
  if (tileAt(f, tx - 1, ty) !== same) d = Math.min(d, xx);
  if (tileAt(f, tx + 1, ty) !== same) d = Math.min(d, 15 - xx);
  return d;
}

function paintHazardBase(px: Pix, nz: Noise, P: Pal, f: Floor, tx: number, ty: number): void {
  const x0 = tx * TILE, y0 = ty * TILE, st = P.st.hazard;
  for (let yy = 0; yy < TILE; yy++)
    for (let xx = 0; xx < TILE; xx++) {
      const X = x0 + xx, Y = y0 + yy;
      const d = rimDist(f, tx, ty, xx, yy, T.HAZARD) + (bayer(X, Y) > 0.6 ? 1 : 0) * (st === 'bramble' ? 0 : 1) - (nz.at(X, Y) > 0.6 ? 1 : 0);
      const n = nz.at(X * 3, Y * 3);
      let c: number;
      if (st === 'lava' || st === 'goo') {
        if (d <= 0) c = dk(P.h0, 0.55);
        else if (d === 1) c = dk(P.h0, 0.2);
        else c = mix(P.h0, P.h1, Math.min(1, Math.max(0, n * 1.3 - 0.25 + (bayer(X, Y) - 0.5) * 0.5)) > 0.5 ? 0.75 : 0.25);
      } else if (st === 'bramble') {
        // sol sombre et enchevêtrement de tiges
        const g = dk(P.ramp[1], 0.45);
        c = d <= 0 ? dk(g, 0.2) : g;
        const vine = Math.abs(Math.sin((X + Y * 0.6) * 0.55) + Math.sin((X * 0.7 - Y) * 0.4)) < 0.25;
        if (vine) c = P.h0;
      } else {
        // glace fine sur eau sombre
        if (d <= 0) c = lit(P.h1, 0.55);
        else if (d === 1) c = lit(P.h1, 0.2);
        else c = n > 0.55 ? mix(P.h0, P.h1, 0.55) : P.h0;
      }
      px.set(X, Y, c);
    }
  if (st === 'bramble') {
    // épines
    for (let k = 0; k < 7; k++) { const v = hash(tx * 13 + k, ty * 7 - k); px.set(x0 + 1 + ((v * 211) % 14 | 0), y0 + 1 + ((v * 97) % 14 | 0), P.h1); }
  }
}

function paintSlickBase(px: Pix, P: Pal, f: Floor, tx: number, ty: number): void {
  const x0 = tx * TILE, y0 = ty * TILE, st = P.st.slick;
  for (let yy = 0; yy < TILE; yy++)
    for (let xx = 0; xx < TILE; xx++) {
      const X = x0 + xx, Y = y0 + yy;
      const d = rimDist(f, tx, ty, xx, yy, T.SLICK);
      let c: number;
      if (st === 'ice') {
        c = d <= 0 ? lit(P.s1, 0.3) : ((X + Y) % 11 === 0 || (X + Y) % 11 === 1) && d > 1 ? P.s1 : mix(P.s0, P.s1, bayer(X, Y) > 0.75 ? 0.3 : 0);
      } else if (st === 'oil') {
        c = d <= 0 ? dk(P.s0, 0.4) : d === 1 ? mix(P.s0, (X + Y) % 3 ? 0x6a3a8a : 0x3a7a6a, 0.5) : P.s0;
      } else {
        c = d <= 0 ? dk(P.s0, 0.3) : mix(P.s0, P.s1, d === 1 ? 0.45 : bayer(X, Y) > 0.85 ? 0.3 : 0);
      }
      px.set(X, Y, c);
    }
}

// ------------------------------------------------------------------ murs
function torchHere(f: Floor, tx: number, ty: number): boolean {
  if (tileAt(f, tx, ty + 1) !== T.FLOOR || tileAt(f, tx, ty) !== T.WALL) return false;
  if (!wallish(tileAt(f, tx - 1, ty)) || !wallish(tileAt(f, tx + 1, ty))) return false;
  return (tx * 7 + ty * 3) % 6 === 0 && hash(tx * 31, ty * 17) < 0.75;
}

function paintWall(px: Pix, nz: Noise, P: Pal, f: Floor, tx: number, ty: number, t: number, feats: FloorFeatures): void {
  const x0 = tx * TILE, y0 = ty * TILE, h = hash(tx * 3, ty * 7), st = P.st.wall;
  const below = tileAt(f, tx, ty + 1), above = tileAt(f, tx, ty - 1);
  const face = floorish(below) || below === T.VOID;
  const topH = face ? 6 : TILE;
  const wt = P.wt, wtl = P.wtl, wf = P.wf, wfd = P.wfd;
  // --- dessus
  for (let yy = 0; yy < topH; yy++)
    for (let xx = 0; xx < TILE; xx++) {
      const X = x0 + xx, Y = y0 + yy, n = nz.at(X * 2, Y * 2), b = bayer(X, Y);
      let c = n + (b - 0.5) * 0.3 > 0.62 ? lit(wt, 0.08) : n + (b - 0.5) * 0.3 < 0.35 ? dk(wt, 0.12) : wt;
      if (st === 'roots' && n > 0.55 && b < 0.7) c = mix(c, P.ramp[2], 0.65); // mousse
      if (st === 'ice') c = n + (b - 0.5) * 0.25 > 0.45 ? lit(wtl, 0.15) : wtl; // calotte de neige
      if (st === 'forge' && Math.abs(Math.sin(X * 0.45 + Y * 0.9) + Math.sin(Y * 0.3 - X * 0.2)) < 0.035 && hash(X >> 3, Y >> 3) < 0.35) c = 0xff6a20; // fissure rougeoyante
      if (st === 'brick' && !face && ((Y & 7) === 0 || ((X + ((Y >> 3) & 1) * 8) & 15) === 0)) c = dk(wt, 0.18);
      px.set(X, Y, c);
    }
  // --- face avant
  if (face) {
    for (let yy = 6; yy < TILE; yy++)
      for (let xx = 0; xx < TILE; xx++) {
        const X = x0 + xx, Y = y0 + yy, b = bayer(X, Y);
        let c = wf;
        if (st === 'brick' || st === 'forge') {
          const row = (yy - 6) >> 2, by = (yy - 6) & 3;
          const bw = st === 'forge' ? 6 : 8;
          const bx = (X + row * (bw >> 1)) % bw;
          if (by === 3 || bx === 0) c = wfd;
          else if (by === 0) c = lit(wf, 0.12);
          else c = hash((X + row * 4) / bw | 0, row + ty * 3) < 0.3 ? dk(wf, 0.1) : wf;
          if (st === 'forge' && (by === 3 || bx === 0) && yy > 9 && hash(X >> 2, ty) < 0.4) c = mix(wfd, 0xff5020, 0.5);
        } else if (st === 'roots') {
          c = b < 0.5 ? wf : mix(wf, wfd, ((X * 3 + (yy >> 1)) % 5 === 0) ? 1 : 0.25);
          if (yy < 8 && hash(X, ty) < 0.55) c = mix(P.ramp[2], P.fd, b); // mousse qui coule
        } else if (st === 'ice') {
          const row = (yy - 6) / 5 | 0, bx = (X + row * 5) % 10;
          if ((yy - 6) % 5 === 4 || bx === 0) c = wfd;
          else if ((bx + yy) % 7 === 0) c = lit(wf, 0.45);
          else c = (yy - 6) % 5 === 0 ? lit(wf, 0.2) : wf;
        }
        px.set(X, Y, c);
      }
    px.blendRect(x0, y0 + 15, TILE, 1, 0, 0.35);
    // détails de face
    if (st === 'roots') {
      const nr = h < 0.5 ? 1 : 2;
      for (let k = 0; k < nr; k++) {
        let rx = x0 + 2 + ((hash(tx + k * 7, ty) * 12) | 0);
        const len = 9 + ((hash(tx, ty + k) * 6) | 0);
        for (let yy = 0; yy < len; yy++) {
          const Y = y0 + 6 + yy;
          px.set(rx, Y, 0x2c2018); px.set(rx + 1, Y, yy < len - 2 ? 0x5a4028 : 0x2c2018);
          if (hash(rx, Y) < 0.25) rx += hash(Y, rx) < 0.5 ? -1 : 1;
        }
      }
      if (h > 0.8) { px.set(x0 + 5, y0 + 8, 0xff70b8); px.set(x0 + 4, y0 + 9, 0xff70b8); px.set(x0 + 6, y0 + 9, 0xff70b8); px.set(x0 + 5, y0 + 9, 0xffd23a); }
    } else if (st === 'ice') {
      // stalactites qui pendent sur la tuile du dessous
      for (let k = 0; k < 3; k++) {
        const v = hash(tx * 5 + k, ty * 11);
        if (v > 0.55) continue;
        const ix = x0 + 2 + ((v * 977) % 12 | 0), len = 2 + ((v * 31) % 5 | 0);
        for (let yy = 0; yy < len; yy++) {
          const w = yy < len / 2 ? 2 : 1;
          px.set(ix, y0 + 16 + yy, lit(wf, 0.55)); if (w === 2) px.set(ix + 1, y0 + 16 + yy, lit(wf, 0.25));
        }
        px.set(ix, y0 + 16, 0xffffff);
        px.blend(ix + 1, y0 + 16 + len, 0, 0.25);
      }
      // corniche de neige qui déborde
      for (let xx = 0; xx < TILE; xx++) if (hash(x0 + xx, ty) < 0.6) px.set(x0 + xx, y0 + 6, lit(wtl, 0.1));
    } else if (st === 'forge') {
      if (h < 0.18) {
        // chaîne pendante
        const cx = x0 + 4 + ((h * 40) | 0);
        for (let yy = 6; yy < 18; yy++) {
          const link = (yy >> 1) & 1;
          px.set(cx, y0 + yy, link ? 0x8a93a8 : 0x555c70);
          if (link) px.set(cx + 1, y0 + yy, 0x2e3244);
        }
      } else if (h > 0.82) {
        // plaque rivetée
        px.rect(x0 + 3, y0 + 8, 10, 6, 0x555c70);
        px.rect(x0 + 3, y0 + 8, 10, 1, 0x8a93a8);
        px.rect(x0 + 3, y0 + 13, 10, 1, 0x2e3244);
        px.set(x0 + 4, y0 + 9, 0xc8d0e0); px.set(x0 + 11, y0 + 9, 0xc8d0e0); px.set(x0 + 4, y0 + 12, 0x8a93a8); px.set(x0 + 11, y0 + 12, 0x8a93a8);
      }
    } else if (st === 'brick' && h > 0.85) {
      // bannière du Hall
      px.rect(x0 + 5, y0 + 6, 6, 8, 0x7038b8);
      px.rect(x0 + 5, y0 + 6, 6, 1, 0xc8901c);
      px.rect(x0 + 7, y0 + 9, 2, 2, 0xffd23a);
      px.set(x0 + 5, y0 + 14, 0x7038b8); px.set(x0 + 10, y0 + 14, 0x7038b8); px.set(x0 + 7, y0 + 14, 0x7038b8); px.set(x0 + 8, y0 + 14, 0x7038b8);
    }
    // torche murale
    if (torchHere(f, tx, ty) && !(st === 'brick' && h > 0.85)) {
      const cx = x0 + 8;
      if (st === 'roots') {
        px.set(cx, y0 + 6, 0x2c2018); px.set(cx, y0 + 7, 0x2c2018);
        feats.torches.push({ x: cx, y: y0 + 8, ph: h * 10 });
      } else {
        px.rect(cx - 2, y0 + 11, 5, 1, 0x2e3244);
        px.rect(cx - 1, y0 + 9, 3, 3, st === 'ice' ? 0x6a7088 : 0x3a2c28);
        px.set(cx, y0 + 12, 0x2e3244); px.set(cx, y0 + 13, 0x2e3244);
        feats.torches.push({ x: cx, y: y0 + 10, ph: h * 10 });
      }
    }
  }
  // --- arêtes
  if (!wallish(above)) {
    for (let xx = 0; xx < TILE; xx++) px.set(x0 + xx, y0, st === 'ice' ? 0xffffff : wtl);
    if (st === 'roots') for (let xx = 0; xx < TILE; xx++) if (hash(x0 + xx, y0) < 0.4) px.set(x0 + xx, y0, P.fd); // herbe sur la crête
  }
  if (!wallish(tileAt(f, tx - 1, ty))) for (let yy = 0; yy < (face ? 6 : TILE); yy++) px.set(x0, y0 + yy, wtl);
  if (!wallish(tileAt(f, tx + 1, ty))) for (let yy = 0; yy < TILE; yy++) px.set(x0 + TILE - 1, y0 + yy, wfd);
  if (face) for (let xx = 0; xx < TILE; xx++) px.set(x0 + xx, y0 + 5, dk(wt, 0.3)); // lèvre entre dessus et face
  if (t === T.BLOCK) {
    // obstacle : dessus bombé + reflet
    px.rect(x0 + 2, y0 + 1, 12, 1, lit(wtl, 0.2));
    px.rect(x0 + 3, y0 + 2, 3, 1, 0xffffff);
    px.blendRect(x0 + 1, y0 + 3, 1, 2, 0xffffff, 0.3);
  }
  if (t === T.CRACK) {
    const pts = [[7, 1], [8, 2], [8, 3], [7, 4], [6, 5], [7, 6], [8, 7], [9, 8], [8, 9], [7, 10], [7, 11], [8, 12], [6, 13], [9, 4], [10, 5], [5, 8], [4, 9]];
    for (const [qx, qy] of pts) { px.set(x0 + qx, y0 + qy, wfd); px.blend(x0 + qx + 1, y0 + qy, 0xffffff, 0.15); }
  }
}

// ------------------------------------------------------------------ étage complet
export function paintFloor(f: Floor, theme: ThemeDef, feats: FloorFeatures = emptyFeatures()): HTMLCanvasElement {
  const st = styleFor(theme.world);
  const P = makePal(theme, st);
  const W = f.w * TILE, H = f.h * TILE;
  const px = new Pix(W, H);
  const seed = (f.world * 131 + f.floor * 17) | 0;
  const nz = new Noise(W, H, seed);
  const vc = hexNum(theme.voidColor);
  px.d.fill((0xff000000 | ((vc & 0xff) << 16) | (vc & 0xff00) | ((vc >> 16) & 0xff)) >>> 0);
  // vide : quelques reflets très sombres pour éviter le noir plat
  for (let i = 0; i < (W * H) / 900; i++) { const v = hash(i, seed); px.blend((v * W) | 0, (hash(seed, i) * H) | 0, lit(vc, 0.5), 0.5); }

  // --- sols
  for (let ty = 0; ty < f.h; ty++)
    for (let tx = 0; tx < f.w; tx++) {
      const t = f.tiles[tx + ty * f.w];
      if (!floorish(t)) continue;
      if (t === T.HAZARD) { paintHazardBase(px, nz, P, f, tx, ty); feats.hazards.push({ x: tx * TILE, y: ty * TILE, ph: (hash(tx + 3, ty * 5) * 4) | 0 }); continue; }
      if (t === T.SLICK) { paintSlickBase(px, P, f, tx, ty); feats.slicks.push({ x: tx * TILE, y: ty * TILE, ph: (hash(tx * 5, ty + 3) * 4) | 0 }); continue; }
      paintFloorTile(px, nz, P, f, tx, ty, t);
    }

  // --- bordures : mousse / congère / cendres le long des murs
  for (let ty = 1; ty < f.h; ty++)
    for (let tx = 0; tx < f.w; tx++) {
      if (f.tiles[tx + ty * f.w] !== T.FLOOR || !wallish(tileAt(f, tx, ty - 1))) continue;
      const x0 = tx * TILE, y0 = ty * TILE;
      const c = st.floor === 'grass' ? P.fd : st.floor === 'snow' ? 0xf0f8ff : st.floor === 'basalt' ? 0x5a5058 : lit(P.ramp[3], 0.1);
      for (let xx = 0; xx < TILE; xx++) {
        const depth = 2 + ((hash(x0 + xx, y0) * 4) | 0) - (st.floor === 'flag' ? 2 : 0);
        for (let yy = 0; yy < depth; yy++) if (bayer(xx, yy) < 0.75 - yy * 0.15) px.set(x0 + xx, y0 + yy, c);
      }
    }

  // --- décor de sol (non bloquant)
  for (let ty = 0; ty < f.h; ty++)
    for (let tx = 0; tx < f.w; tx++) {
      if (f.tiles[tx + ty * f.w] !== T.FLOOR) continue;
      if (hash(tx * 13 + 5, ty * 17 + 3) >= st.decoRate) continue;
      let nearDoor = false;
      for (let k = 0; k < 4 && !nearDoor; k++) { const n = tileAt(f, tx + [1, -1, 0, 0][k], ty + [0, 0, 1, -1][k]); nearDoor = n === T.DOOR || n === T.DOORC; }
      if (nearDoor) continue;
      const name = st.deco[(hash(tx + 91, ty + 7) * st.deco.length) | 0];
      const pat = DECO[name];
      if (!pat) continue;
      const pw = pat[0].length, ph = pat.length;
      const x = tx * TILE + 1 + ((hash(tx, ty + 51) * (TILE - pw - 2)) | 0);
      const y = ty * TILE + 1 + ((hash(tx + 77, ty) * (TILE - ph - 2)) | 0);
      stamp(px, pat, x, y, st.decoPal);
      const lc = DECO_LIGHT[name];
      if (lc) feats.lights.push({ x: x + pw / 2, y: y + ph / 2, color: lc, r: 14, ph: hash(tx, ty) * 6 });
    }

  // --- ombres portées sous les murs (dégradé) et sur les côtés
  const SH = [0.46, 0.36, 0.27, 0.19, 0.12, 0.06];
  for (let ty = 0; ty < f.h; ty++)
    for (let tx = 0; tx < f.w; tx++) {
      if (!floorish(f.tiles[tx + ty * f.w])) continue;
      const x0 = tx * TILE, y0 = ty * TILE;
      if (wallish(tileAt(f, tx, ty - 1))) for (let i = 0; i < SH.length; i++) px.blendRect(x0, y0 + i, TILE, 1, 0x000000, SH[i]);
      if (wallish(tileAt(f, tx - 1, ty))) { px.blendRect(x0, y0, 1, TILE, 0, 0.3); px.blendRect(x0 + 1, y0, 1, TILE, 0, 0.16); px.blendRect(x0 + 2, y0, 1, TILE, 0, 0.06); }
      if (wallish(tileAt(f, tx + 1, ty))) { px.blendRect(x0 + 15, y0, 1, TILE, 0, 0.2); px.blendRect(x0 + 14, y0, 1, TILE, 0, 0.08); }
    }

  // --- murs
  for (let ty = 0; ty < f.h; ty++)
    for (let tx = 0; tx < f.w; tx++) {
      const t = f.tiles[tx + ty * f.w];
      if (wallish(t)) paintWall(px, nz, P, f, tx, ty, t, feats);
    }
  // les stalactites/racines débordent : on repeint la base des murs du dessous éventuels (déjà fait dans l'ordre y croissant)
  return px.toCanvas();
}

// ------------------------------------------------------------------ frames animées (lave, ronces, glace…)
/** Bande 4 frames × 16 px : ligne 0 = tuile dangereuse, ligne 1 = tuile glissante. Superposées (transparentes) au sol peint. */
export const ANIM_FRAMES = 4;
export function paintAnimTiles(theme: ThemeDef): HTMLCanvasElement {
  const st = styleFor(theme.world);
  const P = makePal(theme, st);
  const px = new Pix(TILE * ANIM_FRAMES, TILE * 2);
  px.d.fill(0);
  for (let fi = 0; fi < ANIM_FRAMES; fi++) {
    const x0 = fi * TILE;
    // ---- danger
    if (st.hazard === 'lava' || st.hazard === 'goo') {
      const hot = st.hazard === 'lava' ? 0xffe070 : lit(P.h1, 0.5);
      const bubbles = [[4, 5, 0], [11, 9, 1], [7, 12, 2], [12, 3, 3]];
      for (const [bx, by, o] of bubbles) {
        const k = (fi + o) % ANIM_FRAMES;
        if (k === 0) px.set(x0 + bx, y0Hz(by), P.h1);
        else if (k === 1) { px.set(x0 + bx, y0Hz(by), hot); px.set(x0 + bx + 1, y0Hz(by), P.h1); px.set(x0 + bx, y0Hz(by - 1), P.h1); }
        else if (k === 2) { px.set(x0 + bx - 1, y0Hz(by), P.h1); px.set(x0 + bx + 1, y0Hz(by), P.h1); px.set(x0 + bx, y0Hz(by - 1), hot); px.set(x0 + bx, y0Hz(by + 1), P.h1); }
        else { px.set(x0 + bx - 1, y0Hz(by - 1), hot); px.set(x0 + bx + 1, y0Hz(by - 1), hot); }
      }
      // veines claires qui ondulent
      for (let xx = 2; xx < 14; xx++) {
        const yy = 7 + Math.round(Math.sin(xx * 0.7 + fi * 1.57) * 1.5);
        px.set(x0 + xx, yy, (xx + fi) % 3 === 0 ? hot : P.h1);
      }
    } else if (st.hazard === 'bramble') {
      // tiges épineuses qui se balancent
      const sway = [0, 1, 0, -1][fi];
      const stems = [[3, 14, 6], [9, 15, 9], [13, 13, 5]];
      for (const [sx, sy, len] of stems) {
        for (let k = 0; k < len; k++) {
          const x = x0 + sx + Math.round((sway * k) / len * 1.6), y = sy - k;
          px.set(x, y, P.h0); px.set(x + 1, y, dk(P.h0, 0.3));
          if (k % 2 === 1) px.set(x + (k % 4 === 1 ? -1 : 2), y, P.h1);
        }
        px.set(x0 + sx + sway, sy - len, lit(P.h1, 0.3));
      }
    } else {
      // glace fine : reflet qui traverse + ondulation
      const d = fi * 5 - 3;
      for (let k = 0; k < 16; k++) { const x = d + k, y = 15 - k; if (x >= 1 && x < 15 && y > 0) { px.set(x0 + x, y, 0xffffff); if (x + 1 < 15) px.set(x0 + x + 1, y, lit(P.h1, 0.6)); } }
      px.set(x0 + 4 + fi, 10, lit(P.h1, 0.4)); px.set(x0 + 5 + fi, 10, lit(P.h1, 0.4));
    }
    // ---- glisse
    const y1 = TILE;
    if (st.slick === 'ice') {
      if (fi < 3) {
        const d = fi * 6 - 2;
        for (let k = 0; k < 6; k++) { const x = d + k, y = 12 - k; if (x >= 1 && x < 15) px.set(x0 + x, y1 + y, 0xffffff); }
      }
      if (fi === 1 || fi === 3) { px.set(x0 + 11, y1 + 4, 0xffffff); px.set(x0 + 10, y1 + 4, lit(P.s1, 0.5)); px.set(x0 + 12, y1 + 4, lit(P.s1, 0.5)); px.set(x0 + 11, y1 + 3, lit(P.s1, 0.5)); px.set(x0 + 11, y1 + 5, lit(P.s1, 0.5)); }
    } else if (st.slick === 'oil') {
      const cols = [0x8a4ab8, 0x3a9a8a, 0xb8a040, 0x4a6ac8];
      for (let k = 0; k < 6; k++) px.set(x0 + 4 + k, y1 + 6 + ((k + fi) & 1), cols[(fi + (k >> 1)) % 4]);
    } else {
      const r = 1 + fi * 1.5;
      for (let a = 0; a < 16; a++) {
        const x = Math.round(8 + Math.cos((a / 16) * 6.283) * r), y = Math.round(8 + Math.sin((a / 16) * 6.283) * r * 0.6);
        if (fi < 3) px.set(x0 + x, y1 + y, lit(P.s1, 0.3));
      }
    }
  }
  return px.toCanvas();
}
const y0Hz = (y: number) => y; // lisibilité : ligne 0 de la bande
