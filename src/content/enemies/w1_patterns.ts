// Monde 1 « Sylve Murmurante » — patterns propres et utilitaires de sprites.
import { definePattern, R } from '../../core/registry';
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

// =================================================================== v2 : outils de sprites partagés (lot Ennemis)
/** Remplace des lignes par index (frames d'animation). */
export const rep = (rows: string[], m: Record<number, string>): string[] => rows.map((r, i) => m[i] ?? r);
/** Échange des caractères (yeux qui clignent, lueur qui pulse…). */
export const swapCh = (rows: string[], m: Record<string, string>): string[] => rows.map((r) => [...r].map((c) => m[c] ?? c).join(''));
/** Décale tout le sprite d'1 px vers le haut (petit saut) ; la ligne du bas devient vide. */
export const up1 = (rows: string[]): string[] => [...rows.slice(1), '.'.repeat(rows[0].length)];
/** Décale tout le sprite d'1 px vers le bas (écrasement) ; la ligne du haut devient vide. */
export const down1 = (rows: string[]): string[] => ['.'.repeat(rows[0].length), ...rows.slice(0, -1)];

// =================================================================== v2 : patterns « malins » partagés
/** Angle d'interception : vise là où le joueur SERA (vitesse de la balle `speed`), pondéré par `lead` (0..1). */
export function leadAngle(e: Enemy, t: Player | null, speed: number, lead = 1): number {
  if (!t) return e.facing > 0 ? 0 : Math.PI;
  const dx = t.x - e.x, dy = t.y - e.y;
  const vx = (t.vx ?? 0) * lead, vy = (t.vy ?? 0) * lead;
  const a = vx * vx + vy * vy - speed * speed, b = 2 * (dx * vx + dy * vy), c = dx * dx + dy * dy;
  let tt = 0;
  if (Math.abs(a) < 1e-6) tt = b < 0 ? -c / b : 0;
  else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const s = Math.sqrt(disc), t1 = (-b - s) / (2 * a), t2 = (-b + s) / (2 * a);
      tt = Math.min(t1 > 0 ? t1 : Infinity, t2 > 0 ? t2 : Infinity);
      if (!Number.isFinite(tt)) tt = 0;
    }
  }
  tt = Math.min(tt, 1.4);
  const r = Math.atan2(dy + vy * tt, dx + vx * tt);
  return Number.isFinite(r) ? r : Math.atan2(dy, dx);
}

/** predictif — tir prédictif : vise la position future du joueur. count, spread, speed, lead (0..1), shots, interval, mix (true = 1 balle sur 2 visée « bêtement », pour piéger les esquives). */
definePattern('predictif', (ctx, e, p, t) => {
  const shots = p.shots ?? 1, sp = p.speed ?? 110;
  for (let k = 0; k < shots; k++) {
    ctx.after(k * (p.interval ?? 0.14), () => {
      const tt = e.target ?? t;
      const dumb = p.mix && k % 2 === 1;
      const a = dumb ? aim(e, tt) : leadAngle(e, tt, sp, p.lead ?? 1);
      const n = p.count ?? 1, spread = p.spread ?? 0.3, spec = enemyBullet(p);
      for (let i = 0; i < n; i++) ctx.spawnBullet(spec, e.x, e.y, a + (n > 1 ? -spread / 2 + (spread * i) / (n - 1) : 0), 'enemy', e);
      ctx.sfx('eshoot', 0.35);
    }, e);
  }
});

/** combo — enchaîne plusieurs patterns : steps = [{ pattern, at (s), params }]. Chaque étape vise la cible du moment. */
definePattern('combo', (ctx, e, p, t) => {
  const steps: { pattern: string; at?: number; params?: Record<string, any> }[] = p.steps ?? [];
  for (const s of steps) {
    const fn = R.patterns.get(s.pattern);
    if (!fn || s.pattern === 'combo') continue;
    const run = () => { if (!e.dead) fn(ctx, e, s.params ?? {}, e.target ?? t); };
    if (!s.at) run(); else ctx.after(s.at, run, e);
  }
});

/** Bulle protectrice : un allié proche (ou soi-même si `self`) voit les tirs du joueur s'écraser sur sa bulle (`hits` impacts), puis la bulle casse et se recharge.
 *  À appeler depuis onUpdate. L'état est rangé dans e.data. */
export function wardAllies(ctx: Ctx, e: Enemy, dt: number, o: { radius?: number; hits?: number; recharge?: number; color?: number; self?: boolean } = {}): void {
  const range = o.radius ?? 90, hitsMax = o.hits ?? 6, color = o.color ?? 0x9ae8ff;
  if (e.data.wardCd > 0) { e.data.wardCd -= dt; return; }
  let ward: Enemy | null = e.data.wardOn ?? null;
  if (!ward || ward.dead || Math.hypot(ward.x - e.x, ward.y - e.y) > range * 1.4) {
    ward = null;
    let best = Infinity;
    for (const x of ctx.enemiesIn(e.x, e.y, range)) {
      if (x === e || x.def.boss || x.charmed) continue;
      const d = Math.hypot(x.x - e.x, x.y - e.y);
      if (d < best) { best = d; ward = x; }
    }
    if (!ward && o.self) ward = e;
    if (!ward) return;
    e.data.wardOn = ward;
    e.data.wardHits = hitsMax;
    ctx.ring(ward.x, ward.y, ward.radius * ward.scale + 7, color);
  }
  const rr = ward.radius * ward.scale + 7;
  if ((e.data.wardFx = (e.data.wardFx ?? 0) - dt) <= 0) {
    e.data.wardFx = 0.45;
    ctx.ring(ward.x, ward.y, rr, color);
  }
  for (const b of ctx.bullets) {
    if (b.dead || b.team !== 'player' || b.kind !== 'shot') continue;
    if (Math.hypot(b.x - ward.x, b.y - ward.y) > rr) continue;
    b.dead = true;
    ctx.burst(b.x, b.y, color, 3, 50, 0.2);
    if (--e.data.wardHits <= 0) {
      ctx.text(ward.x, ward.y - 12, 'Bulle crevée !', color);
      ctx.burst(ward.x, ward.y, color, 12, 90, 0.4);
      ctx.sfx('break', 0.5);
      e.data.wardOn = null;
      e.data.wardCd = o.recharge ?? 4;
      break;
    }
  }
}

/** Ralliement : les alliés proches rechargent plus vite leur prochaine attaque (cdCut s) et s'élancent. */
export function rallyAllies(ctx: Ctx, e: Enemy, radius: number, cdCut: number, color = 0xffd23a): number {
  let n = 0;
  for (const o of ctx.enemiesIn(e.x, e.y, radius)) {
    if (o === e || o.def.boss || o.charmed) continue;
    for (let k = 0; k < o.atkCd.length; k++) o.atkCd[k] = Math.max(0.15, o.atkCd[k] - cdCut);
    ctx.burst(o.x, o.y - 6, color, 4, 40, 0.35);
    n++;
  }
  if (n) ctx.ring(e.x, e.y, radius, color);
  return n;
}

/** lobPredictif — tir en cloche qui retombe là où le joueur VA (position + vitesse × durée × lead). count, scatter, radius, time, lead. */
definePattern('lobPredictif', (ctx, e, p, t) => {
  const n = p.count ?? 1, time = p.time ?? 1, lead = p.lead ?? 0.8;
  for (let i = 0; i < n; i++) {
    const sc = p.scatter ?? (n > 1 ? 26 : 4);
    const px = t ? t.x + (t.vx ?? 0) * time * lead : e.x, py = t ? t.y + (t.vy ?? 0) * time * lead : e.y;
    const tx = px + ctx.rng.range(-sc, sc), ty = py + ctx.rng.range(-sc, sc);
    if (p.mark) ctx.ring(tx, ty, p.radius ?? 22, p.mark);
    ctx.spawnBullet({ kind: 'lob', damage: p.damage ?? 1, life: time, sprite: p.sprite ?? 'eb_orb', color: p.color, tx, ty, explode: { radius: p.radius ?? 22, status: p.status }, ...(p.bullet ?? {}) }, e.x, e.y, 0, 'enemy', e);
  }
  ctx.sfx('elob', 0.5);
});
