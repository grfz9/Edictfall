/** RNG déterministe (mulberry32). Aucune utilisation de Math.random dans la simulation. */
export class Rng {
  private s: number;
  constructor(seed: number | string) {
    this.s = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
    if (this.s === 0) this.s = 0x9e3779b9;
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** Flottant dans [a, b). */
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  /** Entier dans [a, b] inclus. */
  int(a: number, b: number): number {
    return Math.floor(a + (b - a + 1) * this.next());
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  weighted<T>(arr: readonly T[], w: (t: T) => number): T {
    let total = 0;
    for (const a of arr) total += Math.max(0, w(a));
    let r = this.next() * total;
    for (const a of arr) {
      r -= Math.max(0, w(a));
      if (r <= 0) return a;
    }
    return arr[arr.length - 1];
  }
  /** Sous-générateur indépendant, stable pour un label donné. */
  fork(label: string): Rng {
    return new Rng((this.s ^ hashSeed(label)) >>> 0);
  }
}
export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function randomSeedString(): string {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}
