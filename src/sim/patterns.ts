// Bibliothèque de patterns d'attaque, partagée par tous les ennemis et boss.
// Un pattern = (ctx, ennemi, params, cible). Paramètres communs :
//   damage (1), speed (110), sprite ('eb_round'), color, radius (3), life (4), bullet: Partial<BulletSpec> (prioritaire)
// Ajouter un pattern : definePattern('nom', fn) dans n'importe quel fichier de src/content/.
import { definePattern } from '../core/registry';
import type { BulletSpec, Enemy, Player } from '../core/types';
import type { Ctx } from './ctx';

const TAU = Math.PI * 2;

export function enemyBullet(p: Record<string, any>, over: Partial<BulletSpec> = {}): BulletSpec {
  return {
    damage: p.damage ?? 1,
    speed: p.speed ?? 110,
    sprite: p.sprite ?? 'eb_round',
    color: p.color,
    radius: p.radius ?? 3,
    life: p.life ?? 4,
    ...over,
    ...(p.bullet ?? {}),
  };
}
const aimAt = (e: Enemy, t: Player | null) => (t ? Math.atan2(t.y - e.y, t.x - e.x) : e.facing > 0 ? 0 : Math.PI);
function fan(ctx: Ctx, e: Enemy, spec: BulletSpec, angle: number, count: number, spread: number): void {
  for (let i = 0; i < count; i++) {
    const off = count > 1 ? -spread / 2 + (spread * i) / (count - 1) : 0;
    ctx.spawnBullet(spec, e.x, e.y, angle + off, 'enemy', e);
  }
}

/** aimed — tir visé. count, spread (rad, cône total), jitter. */
definePattern('aimed', (ctx, e, p, t) => {
  const a = aimAt(e, t) + (p.jitter ? ctx.rng.range(-p.jitter, p.jitter) : 0);
  fan(ctx, e, enemyBullet(p), a, p.count ?? 1, p.spread ?? 0.4);
  ctx.sfx('eshoot', 0.4);
});
definePattern('spread', (ctx, e, p, t) => {
  fan(ctx, e, enemyBullet(p), aimAt(e, t), p.count ?? 3, p.spread ?? 0.6);
  ctx.sfx('eshoot', 0.4);
});
/** burst — shots rafales visées espacées de interval. */
definePattern('burst', (ctx, e, p, t) => {
  const shots = p.shots ?? 3;
  for (let i = 0; i < shots; i++) {
    ctx.after(i * (p.interval ?? 0.15), () => {
      fan(ctx, e, enemyBullet(p), aimAt(e, e.target ?? t), p.count ?? 1, p.spread ?? 0.4);
      ctx.sfx('eshoot', 0.35);
    }, e);
  }
});
/** ring — cercle de count balles. offset (rad) ou aléatoire. */
definePattern('ring', (ctx, e, p) => {
  const n = p.count ?? 12;
  const off = p.offset ?? ctx.rng.range(0, TAU);
  const spec = enemyBullet(p);
  for (let i = 0; i < n; i++) ctx.spawnBullet(spec, e.x, e.y, off + (i / n) * TAU, 'enemy', e);
  ctx.sfx('ering', 0.5);
});
/** rings — waves cercles successifs, décalés de rotate. */
definePattern('rings', (ctx, e, p) => {
  const waves = p.waves ?? 3, n = p.count ?? 10;
  const base = ctx.rng.range(0, TAU);
  for (let k = 0; k < waves; k++) {
    ctx.after(k * (p.interval ?? 0.4), () => {
      const spec = enemyBullet(p);
      for (let i = 0; i < n; i++) ctx.spawnBullet(spec, e.x, e.y, base + k * (p.rotate ?? Math.PI / n) + (i / n) * TAU, 'enemy', e);
      ctx.sfx('ering', 0.45);
    }, e);
  }
});
/** spiral — arms bras tournants, shots tirs espacés de interval, pas angulaire step. */
definePattern('spiral', (ctx, e, p) => {
  const arms = p.arms ?? 2, shots = p.shots ?? 16, step = p.step ?? 0.32;
  const base = ctx.rng.range(0, TAU);
  const dir = p.dir ?? (ctx.rng.chance(0.5) ? 1 : -1);
  for (let k = 0; k < shots; k++) {
    ctx.after(k * (p.interval ?? 0.08), () => {
      const spec = enemyBullet(p);
      for (let a = 0; a < arms; a++) ctx.spawnBullet(spec, e.x, e.y, base + dir * k * step + (a / arms) * TAU, 'enemy', e);
      if (k % 3 === 0) ctx.sfx('eshoot', 0.25);
    }, e);
  }
});
/** spray — shots tirs dans des directions aléatoires autour de la visée (arc). */
definePattern('spray', (ctx, e, p, t) => {
  const shots = p.shots ?? 14, arc = p.arc ?? 1.2;
  for (let k = 0; k < shots; k++) {
    ctx.after(k * (p.interval ?? 0.06), () => {
      const a = aimAt(e, e.target ?? t) + ctx.rng.range(-arc / 2, arc / 2);
      ctx.spawnBullet(enemyBullet(p, { speed: (p.speed ?? 110) * ctx.rng.range(0.8, 1.2) }), e.x, e.y, a, 'enemy', e);
      if (k % 3 === 0) ctx.sfx('eshoot', 0.25);
    }, e);
  }
});
/** wall — mur de count balles perpendiculaire à la visée, avec un trou (gap) pour passer. spacing px. */
definePattern('wall', (ctx, e, p, t) => {
  const n = p.count ?? 9, spacing = p.spacing ?? 14;
  const a = aimAt(e, t);
  const gap = p.gap ?? ctx.rng.int(1, n - 2);
  const gapW = p.gapWidth ?? 2;
  const spec = enemyBullet(p, { speed: p.speed ?? 80 });
  for (let i = 0; i < n; i++) {
    if (i >= gap && i < gap + gapW) continue;
    const o = (i - (n - 1) / 2) * spacing;
    ctx.spawnBullet(spec, e.x - Math.sin(a) * o, e.y + Math.cos(a) * o, a, 'enemy', e);
  }
  ctx.sfx('ering', 0.5);
});
/** cross — arms branches de perArm balles à vitesses croissantes. offset (rad), aimed (bool). */
definePattern('cross', (ctx, e, p, t) => {
  const arms = p.arms ?? 4, per = p.perArm ?? 4;
  const base = p.aimed ? aimAt(e, t) : p.offset ?? ctx.rng.range(0, TAU);
  for (let a = 0; a < arms; a++)
    for (let k = 0; k < per; k++) ctx.spawnBullet(enemyBullet(p, { speed: (p.speed ?? 70) * (1 + k * 0.28) }), e.x, e.y, base + (a / arms) * TAU, 'enemy', e);
  ctx.sfx('ering', 0.5);
});
/** homing — count missiles à tête chercheuse. turn (rad/s). */
definePattern('homing', (ctx, e, p, t) => {
  const n = p.count ?? 1;
  const a = aimAt(e, t);
  for (let i = 0; i < n; i++) ctx.spawnBullet(enemyBullet(p, { speed: p.speed ?? 75, homing: p.turn ?? 1.8, life: p.life ?? 3.5 }), e.x, e.y, a + (n > 1 ? (i - (n - 1) / 2) * 0.7 : 0), 'enemy', e);
  ctx.sfx('eshoot', 0.4);
});
/** lob — count tirs en cloche qui explosent au sol près de la cible. scatter px, radius, time. */
definePattern('lob', (ctx, e, p, t) => {
  const n = p.count ?? 1;
  for (let i = 0; i < n; i++) {
    const sc = p.scatter ?? (n > 1 ? 34 : 8);
    const tx = (t?.x ?? e.x) + ctx.rng.range(-sc, sc), ty = (t?.y ?? e.y) + ctx.rng.range(-sc, sc);
    ctx.spawnBullet({ kind: 'lob', damage: p.damage ?? 1, life: p.time ?? 0.9, sprite: p.sprite ?? 'eb_orb', color: p.color, tx, ty, explode: { radius: p.radius ?? 24, status: p.status }, ...(p.bullet ?? {}) }, e.x, e.y, 0, 'enemy', e);
  }
  ctx.sfx('elob', 0.5);
});
/** rain — count tirs en cloche répartis dans une zone autour de la cible. area px, interval. */
definePattern('rain', (ctx, e, p, t) => {
  const n = p.count ?? 6, area = p.area ?? 70;
  for (let i = 0; i < n; i++) {
    ctx.after(i * (p.interval ?? 0.12), () => {
      const tt = e.target ?? t;
      const tx = (tt?.x ?? e.x) + ctx.rng.range(-area, area), ty = (tt?.y ?? e.y) + ctx.rng.range(-area, area);
      ctx.spawnBullet({ kind: 'lob', damage: p.damage ?? 1, life: p.time ?? 1, sprite: p.sprite ?? 'eb_orb', color: p.color, tx, ty, explode: { radius: p.radius ?? 22, status: p.status }, ...(p.bullet ?? {}) }, e.x, e.y, 0, 'enemy', e);
    }, e);
  }
  ctx.sfx('elob', 0.5);
});
/** laser — ligne d'avertissement (warn s) puis rayon. length, width, count, spread, sweep. */
definePattern('laser', (ctx, e, p, t) => {
  const n = p.count ?? 1, spread = p.spread ?? 0.5, warn = p.warn ?? 0.6;
  const base = p.aimed === false ? ctx.rng.range(0, TAU) : aimAt(e, t);
  for (let i = 0; i < n; i++) {
    const a = base + (n > 1 ? (p.full ? (i / n) * TAU : -spread / 2 + (spread * i) / (n - 1)) : 0);
    ctx.spawnBullet({ kind: 'beam', damage: 0, life: warn, width: 1, length: p.length ?? 300, color: p.color ?? 0xff3355, data: { warn: true } }, e.x, e.y, a, 'enemy', e);
    ctx.after(warn, () => {
      ctx.spawnBullet({ kind: 'beam', damage: p.damage ?? 2, life: 0.22, width: p.width ?? 6, length: p.length ?? 300, color: p.color ?? 0xff3355 }, e.x, e.y, a, 'enemy', e);
      ctx.sfx('elaser', 0.5);
      ctx.shake(2);
    }, e);
  }
});
/** summon — invoque count ennemis `id` autour de soi (max vivants : max). */
definePattern('summon', (ctx, e, p) => {
  const alive = ctx.enemies.filter((o) => o.summoned && !o.dead).length;
  const n = Math.min(p.count ?? 2, (p.max ?? 6) - alive);
  for (let i = 0; i < n; i++) {
    const a = ctx.rng.range(0, TAU), r = ctx.rng.range(18, 34);
    const x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r;
    if (!ctx.isSolid(x, y)) ctx.spawnEnemy(p.id, x, y, { summoned: true, delay: 0.5 });
  }
  ctx.sfx('summon', 0.5);
});
/** dash — ruée en ligne droite vers la cible. speed px/s, dur s. */
definePattern('dash', (ctx, e, p, t) => {
  const a = aimAt(e, t);
  const sp = p.speed ?? 260;
  e.data.dash = { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: p.dur ?? 0.35 };
  ctx.sfx('dash', 0.5);
  if (p.trail) {
    const steps = 4;
    for (let i = 1; i <= steps; i++) ctx.after(((p.dur ?? 0.35) * i) / steps, () => ctx.spawnBullet(enemyBullet(p, { speed: 0, life: p.trailLife ?? 1.6 }), e.x, e.y, 0, 'enemy', e), e);
  }
});
/** melee — coup en arc devant soi. range, arc. */
definePattern('melee', (ctx, e, p, t) => {
  ctx.spawnBullet({ kind: 'slash', damage: p.damage ?? 1, range: p.range ?? 24, arc: p.arc ?? 1.8, color: p.color ?? 0xff6677 }, e.x, e.y, aimAt(e, t), 'enemy', e);
  ctx.sfx('swing', 0.5);
});
/** mines — pose count balles immobiles de longue durée autour de soi. */
definePattern('mines', (ctx, e, p) => {
  const n = p.count ?? 3;
  for (let i = 0; i < n; i++) {
    const a = ctx.rng.range(0, TAU), r = ctx.rng.range(4, p.scatter ?? 26);
    const x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r;
    if (!ctx.isSolid(x, y)) ctx.spawnBullet(enemyBullet(p, { speed: 0, life: p.life ?? 6, sprite: p.sprite ?? 'eb_orb' }), x, y, 0, 'enemy', e);
  }
});
/** blink — se téléporte près de la cible puis (optionnel) tire un ring : then = { ...params ring }. */
definePattern('blink', (ctx, e, p, t) => {
  if (!t) return;
  for (let k = 0; k < 12; k++) {
    const a = ctx.rng.range(0, TAU), r = ctx.rng.range(p.min ?? 40, p.max ?? 80);
    const x = t.x + Math.cos(a) * r, y = t.y + Math.sin(a) * r;
    if (ctx.isFree(x, y, e.radius)) {
      ctx.burst(e.x, e.y, 0xc070ff, 10);
      e.x = x; e.y = y;
      ctx.burst(x, y, 0xc070ff, 10);
      ctx.sfx('blink', 0.5);
      break;
    }
  }
  if (p.then) ctx.after(p.delay ?? 0.35, () => {
    const n = p.then.count ?? 8, off = ctx.rng.range(0, TAU), spec = enemyBullet(p.then);
    for (let i = 0; i < n; i++) ctx.spawnBullet(spec, e.x, e.y, off + (i / n) * TAU, 'enemy', e);
    ctx.sfx('ering', 0.5);
  }, e);
});
