// Monde 1 « Sylve Murmurante » — patterns propres et utilitaires de sprites.
import { definePattern } from '../../core/registry';
import { enemyBullet } from '../../sim/patterns';
import type { Enemy, Player } from '../../core/types';
import type { Ctx } from '../../sim/ctx';

const TAU = Math.PI * 2;

/** Sprite symétrique : chaque ligne donnée est la moitié gauche, complétée par son miroir. */
export function sym(rows: string[]): string[] {
  return rows.map((r) => r + [...r].reverse().join(''));
}

const aim = (e: Enemy, t: Player | null) => (t ? Math.atan2(t.y - e.y, t.x - e.x) : e.facing > 0 ? 0 : Math.PI);

/** Anneau de spores lentes (empoisonnées) — utilisé par les champignons à leur mort. */
export function sporeRing(ctx: Ctx, e: Enemy, n = 6, speed = 45, poison = 2.5): void {
  const off = ctx.rng.range(0, TAU);
  const spec = enemyBullet({ speed, life: 2.2, radius: 3, sprite: 'eb_small' }, { drag: 0.35, status: { kind: 'poison', dur: poison } });
  for (let i = 0; i < n; i++) ctx.spawnBullet(spec, e.x, e.y, off + (i / n) * TAU, 'enemy', e);
  ctx.burst(e.x, e.y, 0x9ad860, 10, 50, 0.5);
  ctx.sfx('ering', 0.35);
}

/** w1_petales — éventail de pétales ondulants. count, spread, speed, amp, freq. */
definePattern('w1_petales', (ctx, e, p, t) => {
  const n = p.count ?? 5, spread = p.spread ?? 0.9;
  const base = aim(e, t);
  const spec = enemyBullet(p, { speed: p.speed ?? 85, wave: { amp: p.amp ?? 8, freq: p.freq ?? 6 } });
  for (let i = 0; i < n; i++) ctx.spawnBullet(spec, e.x, e.y, base + (n > 1 ? -spread / 2 + (spread * i) / (n - 1) : 0), 'enemy', e);
  ctx.sfx('eshoot', 0.4);
});

/** w1_racines — lignes annoncées (rayon fin) puis épines qui jaillissent du sol le long de chaque ligne.
 *  count, spread (rad, total), warn (s), length (px), step (px). Trous entre les lignes. */
definePattern('w1_racines', (ctx, e, p, t) => {
  const n = p.count ?? 3, spread = p.spread ?? 0.9, warn = Math.max(0.4, p.warn ?? 0.6);
  const len = p.length ?? 170, step = p.step ?? 15;
  const base = (p.full ? ctx.rng.range(0, TAU) : aim(e, t));
  const ox = e.x, oy = e.y;
  for (let i = 0; i < n; i++) {
    const a = base + (n > 1 ? (p.full ? (i / n) * TAU : -spread / 2 + (spread * i) / (n - 1)) : 0);
    ctx.spawnBullet({ kind: 'beam', damage: 0, life: warn, width: 1, length: len, color: 0xc08040, data: { warn: true } }, ox, oy, a, 'enemy', e);
    const c = Math.cos(a), s = Math.sin(a);
    for (let k = 1; k * step <= len; k++) {
      ctx.after(warn + k * 0.035, () => {
        const x = ox + c * k * step, y = oy + s * k * step;
        if (ctx.isSolid(x, y)) return;
        ctx.spawnBullet(enemyBullet({ speed: 0, life: 0.55, radius: 4, sprite: 'eb_shard' }), x, y, a, 'enemy', e);
        if (k % 3 === 0) ctx.burst(x, y, 0x7a5030, 3, 40, 0.25);
      }, e);
    }
  }
  ctx.after(warn, () => { ctx.sfx('elaser', 0.4); ctx.shake(2); }, e);
});

/** w1_couronne — anneaux successifs avec une brèche (gap balles) d'abord face au joueur, qui tourne de rotate à chaque vague. */
definePattern('w1_couronne', (ctx, e, p, t) => {
  const waves = p.waves ?? 3, n = p.count ?? 22, gap = p.gap ?? 4, rot = p.rotate ?? 0.45;
  const base = aim(e, t);
  const dir = ctx.rng.chance(0.5) ? 1 : -1;
  for (let k = 0; k < waves; k++) {
    ctx.after(k * (p.interval ?? 0.55), () => {
      const g = base + dir * k * rot;
      const spec = enemyBullet(p, { speed: p.speed ?? 78 });
      for (let i = 0; i < n; i++) {
        if (i < gap) continue; // la brèche est centrée sur g
        ctx.spawnBullet(spec, e.x, e.y, g + ((i - gap / 2 + 0.5) / n) * TAU, 'enemy', e);
      }
      ctx.sfx('ering', 0.5);
    }, e);
  }
});

/** w1_ecrasement — bond vers la cible puis onde de choc (anneau avec brèche face au joueur). */
definePattern('w1_ecrasement', (ctx, e, p, t) => {
  const a = aim(e, t), sp = p.dashSpeed ?? 220, dur = p.dur ?? 0.45;
  e.data.dash = { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: dur };
  ctx.sfx('dash', 0.6);
  ctx.after(dur + 0.08, () => {
    const n = p.count ?? 18, gap = p.gap ?? 3;
    const tt = e.target ?? t;
    const g = tt ? Math.atan2(tt.y - e.y, tt.x - e.x) : 0;
    const spec = enemyBullet(p, { speed: p.speed ?? 85 });
    for (let i = 0; i < n; i++) {
      if (i < gap) continue;
      ctx.spawnBullet(spec, e.x, e.y, g + ((i - gap / 2 + 0.5) / n) * TAU, 'enemy', e);
    }
    ctx.shake(6);
    ctx.ring(e.x, e.y, 40, 0xb98a52);
    ctx.burst(e.x, e.y, 0x7a5030, 14, 90, 0.5, 2);
    ctx.sfx('explode', 0.6);
  }, e);
});
