// Outils partagés par les boss : construction de sprites (miroir, calques, recoloration) et effets de transition.
import type { Enemy, Player } from '../../core/types';
import type { Ctx } from '../../sim/ctx';
import { enemyBullet } from '../../sim/patterns';

export const TAU = Math.PI * 2;
export const aimAt = (e: Enemy, t: Player | null) => (t ? Math.atan2(t.y - e.y, t.x - e.x) : e.facing > 0 ? 0 : Math.PI);

/** Moitié gauche → sprite symétrique (largeur paire). */
export const mirror = (half: string[]) => half.map((h) => h + [...h].reverse().join(''));
/** Remplace des caractères partout (ou seulement dans les colonnes [x0, x1[ et lignes [y0, y1[). */
export function swap(rows: string[], m: Record<string, string>, x0 = 0, x1 = 999, y0 = 0, y1 = 999): string[] {
  return rows.map((r, y) => (y < y0 || y >= y1 ? r : [...r].map((c, x) => (x >= x0 && x < x1 ? m[c] ?? c : c)).join('')));
}
/** Calque : '.' = garder, '_' = effacer (transparent), autre caractère = remplacer. Hors cadre ignoré. */
export function stamp(rows: string[], patch: string[], x: number, y: number): string[] {
  const out = rows.map((r) => [...r]);
  patch.forEach((pr, j) => {
    const yy = y + j;
    if (yy < 0 || yy >= out.length) return;
    [...pr].forEach((c, i) => {
      const xx = x + i;
      if (xx < 0 || xx >= out[yy].length || c === '.') return;
      out[yy][xx] = c === '_' ? '.' : c;
    });
  });
  return out.map((r) => r.join(''));
}
/** Calque posé à gauche en (x, y) et son miroir à droite. */
export function stampSym(rows: string[], patch: string[], x: number, y: number): string[] {
  const W = rows[0].length, pw = patch[0].length;
  const flipped = patch.map((r) => [...r].reverse().join(''));
  return stamp(stamp(rows, patch, x, y), flipped, W - x - pw, y);
}
/** Décale verticalement un bloc de colonnes [x0, x1[ de dy lignes (bras qui se lèvent, racines qui ondulent). */
export function shiftCols(rows: string[], x0: number, x1: number, dy: number): string[] {
  const H = rows.length;
  const out = rows.map((r) => [...r]);
  for (let y = 0; y < H; y++) {
    const sy = y - dy;
    for (let x = x0; x < x1; x++) out[y][x] = sy >= 0 && sy < H ? rows[sy][x] : '.';
  }
  return out.map((r) => r.join(''));
}

/** Transition de phase spectaculaire : éclair, secousse, anneaux, gerbes, bandeau. */
export function phaseShow(ctx: Ctx, e: Enemy, title: string, sub: string, color: number, css: string): void {
  ctx.banner(title, sub, css);
  ctx.flash(color, 0.45);
  ctx.shake(10);
  ctx.hitstop(0.12);
  ctx.ring(e.x, e.y, 40, color);
  ctx.after(0.12, () => ctx.ring(e.x, e.y, 80, color), e);
  ctx.after(0.24, () => ctx.ring(e.x, e.y, 130, 0xffffff), e);
  for (let i = 0; i < 6; i++) ctx.burst(e.x + Math.cos(i) * 12, e.y + Math.sin(i * 1.7) * 12, color, 10, 110, 0.6, 2);
  ctx.text(e.x, e.y - 30, title, color, true);
}

/** Bouclier de transition : le boss encaisse peu pendant `sec` s (le temps de lire la nouvelle phase). */
export function shield(e: Enemy, sec: number): void {
  e.data.guardUntil = Math.max(e.data.guardUntil ?? 0, e.age + sec);
}
export const guarded = (e: Enemy) => (e.data.guardUntil ?? 0) > e.age;

/** Anneau à brèche (gap balles manquantes, centrée sur l'angle g). */
export function breachRing(ctx: Ctx, e: Enemy, p: Record<string, any>, g: number, x = e.x, y = e.y): void {
  const n = p.count ?? 18, gap = p.gap ?? 3;
  const spec = enemyBullet(p);
  for (let i = gap; i < n; i++) ctx.spawnBullet(spec, x, y, g + ((i - gap / 2 + 0.5) / n) * TAU, 'enemy', e);
}

/** Toile de pixels pour dessiner un sprite par primitives (disques, anneaux, traits) quand l'ASCII brut serait trop fastidieux. */
export class Px {
  g: string[][];
  constructor(public w: number, public h: number, rows?: string[]) {
    this.g = rows ? rows.map((r) => [...r]) : Array.from({ length: h }, () => Array(w).fill('.'));
  }
  static of(rows: string[]): Px { return new Px(rows[0].length, rows.length, rows); }
  clone(): Px { return Px.of(this.rows()); }
  rows(): string[] { return this.g.map((r) => r.join('')); }
  get(x: number, y: number): string { return this.g[y]?.[x] ?? '.'; }
  set(x: number, y: number, c: string): this {
    x = Math.round(x); y = Math.round(y);
    if (y >= 0 && y < this.h && x >= 0 && x < this.w) this.g[y][x] = c;
    return this;
  }
  /** Pose c et son symétrique horizontal. */
  sym(x: number, y: number, c: string): this { return this.set(x, y, c).set(this.w - 1 - Math.round(x), y, c); }
  /** Remplit chaque pixel dont le centre est à distance <= r de (cx, cy) ; fn choisit le caractère (ou null = ne rien faire). */
  shape(test: (x: number, y: number) => string | null): this {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const c = test(x + 0.5, y + 0.5); if (c) this.g[y][x] = c; }
    return this;
  }
  disc(cx: number, cy: number, r: number, c: string): this { return this.shape((x, y) => ((x - cx) ** 2 + (y - cy) ** 2 <= r * r ? c : null)); }
  ring(cx: number, cy: number, r0: number, r1: number, c: string): this {
    return this.shape((x, y) => { const d = Math.hypot(x - cx, y - cy); return d > r0 && d <= r1 ? c : null; });
  }
  rect(x: number, y: number, w: number, h: number, c: string): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
    return this;
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string): this {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let k = 0; k <= n; k++) this.set(Math.floor(x0 + ((x1 - x0) * k) / n), Math.floor(y0 + ((y1 - y0) * k) / n), c);
    return this;
  }
  /** Rayon depuis (cx, cy) dans la direction a (0 = droite, sens horaire écran), longueur len. */
  ray(cx: number, cy: number, a: number, len: number, c: string): this { return this.line(cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len, c); }
  /** Remplace des caractères dans une zone. */
  swap(m: Record<string, string>, x0 = 0, y0 = 0, x1 = this.w, y1 = this.h): this {
    for (let y = Math.max(0, y0); y < Math.min(this.h, y1); y++) for (let x = Math.max(0, x0); x < Math.min(this.w, x1); x++) this.g[y][x] = m[this.g[y][x]] ?? this.g[y][x];
    return this;
  }
  /** Calque ASCII ('.' garder, '_' effacer). */
  stamp(patch: string[], x: number, y: number): this { this.g = stamp(this.rows(), patch, x, y).map((r) => [...r]); return this; }
}
