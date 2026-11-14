// Monde 3 « Forge Abyssale » — patterns personnels + sprites de balles + outils partagés.
import { definePattern, defineSprite } from '../../core/registry';
import { enemyBullet } from '../../sim/patterns';
import { angDiff } from '../../sim/combat';
import type { Enemy, Player } from '../../core/types';
import type { Ctx } from '../../sim/ctx';

const TAU = Math.PI * 2;
const aim = (e: Enemy, t: Player | null) => (t ? Math.atan2(t.y - e.y, t.x - e.x) : e.facing > 0 ? 0 : Math.PI);

// ------------------------------------------------------------------ balles
defineSprite('eb_w3_ember', ['.eee.', 'evyve', 'ey1ye', 'evyve', '.eee.'], { outline: '#5a0a1e' });
defineSprite('eb_w3_slag', ['..EEEE..', '.EerreE.', 'EerVVreE', 'ErV11VrE', 'ErV11VrE', 'EerVVreE', '.EerreE.', '..EEEE..'], { outline: '#3a0610' });

/** Remplace des caractères (frames d'animation : lave qui pulse, yeux qui s'allument…). */
export const swapPx = (rows: string[], m: Record<string, string>) => rows.map((r) => [...r].map((c) => m[c] ?? c).join(''));
/** Miroir horizontal (sprites symétriques construits par moitié). */
export const mirrorHalf = (half: string[]) => half.map((h) => h + [...h].reverse().join(''));
export const flipPx = (rows: string[]) => rows.map((r) => [...r].reverse().join(''));

/** Flaque de braises : balle immobile (zonage). Plafonnée pour ne pas saturer l'écran. */
export function emberPuddle(ctx: Ctx, e: Enemy, x: number, y: number, life = 2.6): void {
  if (ctx.bullets.length > 560 || ctx.isSolid(x, y)) return;
  ctx.spawnBullet({ damage: 1, speed: 0, life, radius: 4, sprite: 'eb_w3_slag' }, x, y, 0, 'enemy', e);
}

/** Anneau avec une brèche de `gap` balles (toujours un passage). */
export function gapRing(ctx: Ctx, e: Enemy, p: Record<string, any>, x = e.x, y = e.y): void {
  const n = p.count ?? 16, gap = p.gap ?? 3;
  const off = p.offset ?? ctx.rng.range(0, TAU);
  const g0 = ctx.rng.int(0, n - 1);
  const spec = enemyBullet(p, { speed: p.speed ?? 100, sprite: p.sprite ?? 'eb_w3_ember', accel: p.accel, life: p.life ?? 3 });
  for (let i = 0; i < n; i++) {
    if ((i - g0 + n) % n < gap) continue;
    ctx.spawnBullet(spec, x, y, off + (i / n) * TAU, 'enemy', e);
  }
  ctx.sfx('ering', 0.5);
}

/** Tir en cloche qui éclate en éclats à l'impact. Un cercle marque le point de chute. */
function shardLob(ctx: Ctx, e: Enemy, tx: number, ty: number, p: Record<string, any>): void {
  ctx.ring(tx, ty, p.radius ?? 22, 0xff7030);
  ctx.spawnBullet({
    kind: 'lob', damage: p.damage ?? 1, life: p.time ?? 1.1, sprite: 'eb_orb', color: 0xffa050, scale: p.scale ?? 1.2, tx, ty,
    explode: { radius: p.radius ?? 22 },
    split: p.shards ? { count: p.shards, spec: { damage: 1, speed: p.shardSpeed ?? 100, life: p.shardLife ?? 1, radius: 3, sprite: 'eb_w3_ember' } } : undefined,
  }, e.x, e.y, 0, 'enemy', e);
}

/** w3_gapring — anneau troué (accel optionnelle : onde de choc qui s'emballe). */
definePattern('w3_gapring', (ctx, e, p) => {
  gapRing(ctx, e, p);
  if (p.shake) ctx.shake(p.shake);
});

/** w3_bellows — souffle en cône : repousse le joueur (vers la lave !) et crache des escarbilles freinées. */
definePattern('w3_bellows', (ctx, e, p, t) => {
  const a = aim(e, t), range = p.range ?? 95, push = p.push ?? 320, cone = p.cone ?? 0.8;
  for (const pl of ctx.players) {
    if (pl.downed) continue;
    const dx = pl.x - e.x, dy = pl.y - e.y, d = Math.hypot(dx, dy);
    if (d < range && d > 0.1 && Math.abs(angDiff(Math.atan2(dy, dx), a)) < cone) {
      pl.kx += (dx / d) * push;
      pl.ky += (dy / d) * push;
    }
  }
  const n = p.count ?? 7;
  for (let i = 0; i < n; i++) {
    ctx.spawnBullet(enemyBullet(p, { speed: (p.speed ?? 120) * ctx.rng.range(0.8, 1.15), life: p.life ?? 0.9, sprite: 'eb_w3_ember', drag: 0.7 }), e.x, e.y, a + ctx.rng.range(-cone * 0.6, cone * 0.6), 'enemy', e);
  }
  ctx.burst(e.x + Math.cos(a) * 10, e.y + Math.sin(a) * 10, 0xffb060, 10, 120, 0.4);
  ctx.sfx('dash', 0.5);
});

/** w3_mortar — obus en cloche qui éclatent en éclats. count, scatter, radius, shards, time. */
definePattern('w3_mortar', (ctx, e, p, t) => {
  const n = p.count ?? 1, sc = p.scatter ?? 10;
  for (let i = 0; i < n; i++) {
    const tx = (t?.x ?? e.x) + ctx.rng.range(-sc, sc), ty = (t?.y ?? e.y) + ctx.rng.range(-sc, sc);
    shardLob(ctx, e, tx, ty, p);
  }
  ctx.sfx('elob', 0.6);
});

/** w3_meteors — pluie de météores : cercles d'impact affichés dès le lancement. */
definePattern('w3_meteors', (ctx, e, p, t) => {
  const n = p.count ?? 6, area = p.area ?? 80;
  for (let i = 0; i < n; i++) {
    ctx.after(i * (p.interval ?? 0.14), () => {
      const tt = e.target ?? t;
      const tx = (tt?.x ?? e.x) + ctx.rng.range(-area, area), ty = (tt?.y ?? e.y) + ctx.rng.range(-area, area);
      if (ctx.isSolid(tx, ty)) return;
      shardLob(ctx, e, tx, ty, { time: p.time ?? 1.25, radius: p.radius ?? 20, damage: p.damage ?? 1, scale: 1.4, shards: p.shards, shardSpeed: p.shardSpeed });
    }, e);
  }
  ctx.sfx('elob', 0.6);
});

/** w3_seal_stamp — « Frappe du Sceau » : trois enclumes-sceaux suivent le joueur, chacune éclate en anneau. */
definePattern('w3_seal_stamp', (ctx, e, p, t) => {
  const n = p.stamps ?? 3;
  ctx.text(e.x, e.y - 22, 'SCELLÉ !', 0xffd23a, true);
  for (let k = 0; k < n; k++) {
    ctx.after(k * (p.interval ?? 0.55), () => {
      const tt = e.target ?? t;
      if (!tt) return;
      shardLob(ctx, e, tt.x, tt.y, { time: p.time ?? 1.15, radius: p.radius ?? 28, damage: p.damage ?? 2, scale: 1.8, shards: p.shards ?? 10, shardSpeed: p.shardSpeed ?? 95, shardLife: 1.4 });
      ctx.sfx('elob', 0.7);
    }, e);
  }
});

/** w3_lava_flow — coulées : lignes de flaques immobiles qui avancent vers le joueur (zonage). */
definePattern('w3_lava_flow', (ctx, e, p, t) => {
  const a = aim(e, t), n = p.count ?? 9, step = p.step ?? 15, lines = p.lines ?? 3, spread = p.spread ?? 0.9;
  const x0 = e.x, y0 = e.y;
  for (let l = 0; l < lines; l++) {
    const ang = a + (lines > 1 ? -spread / 2 + (spread * l) / (lines - 1) : 0);
    for (let k = 0; k < n; k++) {
      ctx.after(k * (p.interval ?? 0.07), () => emberPuddle(ctx, e, x0 + Math.cos(ang) * step * (k + 1), y0 + Math.sin(ang) * step * (k + 1), p.life ?? 2.6), e);
    }
  }
  ctx.sfx('ering', 0.5);
});

/** w3_edict_cross — croix de rayons qui tourne par crans, chaque cran annoncé (ligne fine) avant de brûler. */
definePattern('w3_edict_cross', (ctx, e, p, t) => {
  const arms = p.arms ?? 4, steps = p.steps ?? 3, rot = p.rot ?? 0.35, warn = p.warn ?? 0.7, interval = p.interval ?? 0.6, len = p.length ?? 280;
  const base = aim(e, t) + Math.PI / arms; // le premier cran ne vise jamais le joueur
  const dir = ctx.rng.chance(0.5) ? 1 : -1;
  for (let k = 0; k < steps; k++) {
    ctx.after(k * interval, () => {
      for (let i = 0; i < arms; i++) {
        const ang = base + dir * k * rot + (i / arms) * TAU;
        ctx.spawnBullet({ kind: 'beam', damage: 0, life: warn, width: 1, length: len, color: 0xffb040, data: { warn: true } }, e.x, e.y, ang, 'enemy', e);
        ctx.after(warn, () => {
          ctx.spawnBullet({ kind: 'beam', damage: p.damage ?? 1, life: 0.22, width: p.width ?? 6, length: len, color: 0xff5030 }, e.x, e.y, ang, 'enemy', e);
        }, e);
      }
      ctx.after(warn, () => { ctx.sfx('elaser', 0.5); ctx.shake(2); }, e);
    }, e);
  }
});

/** w3_verdict — ruée du marteau puis onde de choc trouée à l'arrivée. */
definePattern('w3_verdict', (ctx, e, p, t) => {
  const a = aim(e, t), sp = p.speed ?? 230, dur = p.dur ?? 0.45;
  e.data.dash = { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: dur };
  ctx.sfx('dash', 0.6);
  ctx.after(dur + 0.05, () => {
    gapRing(ctx, e, { count: p.count ?? 20, gap: p.gap ?? 4, speed: p.ringSpeed ?? 105, accel: p.accel });
    ctx.ring(e.x, e.y, 40, 0xff6030);
    ctx.shake(6);
  }, e);
});

// ------------------------------------------------------------------ comportements partagés
/** Bombe ambulante : s'arme près du joueur (0.7 s d'annonce clignotante) puis explose. */
export function bombUpdate(ctx: Ctx, e: Enemy, dt: number, radius = 30, dmg = 2): void {
  const t = e.target;
  if (e.data.fuse === undefined) {
    if (t && Math.hypot(t.x - e.x, t.y - e.y) < 26) {
      e.data.fuse = 0.7;
      e.stop = 1;
      ctx.text(e.x, e.y - 12, '!', 0xffd23a, true);
      ctx.ring(e.x, e.y, radius, 0xff5030);
      ctx.sfx('elob', 0.4);
    }
    return;
  }
  e.data.fuse -= dt;
  e.flash = Math.floor(e.data.fuse * 12) % 2 ? 0.05 : 0;
  if (e.data.fuse <= 0 && !e.data.boomed) {
    e.data.boomed = true;
    ctx.explode(e.x, e.y, radius, dmg, 'enemy', { owner: e });
    ctx.killEnemy(e);
  }
}
/** Mort d'une bombe désamorcée : petite gerbe d'escarbilles. */
export function bombDeath(ctx: Ctx, e: Enemy): void {
  if (e.data.boomed) return;
  gapRing(ctx, e, { count: 6, gap: 1, speed: 95, life: 1.4 });
}
