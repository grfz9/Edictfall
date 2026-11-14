// Monde 2 — boss : l'Horlogère Givrale, gardienne d'un temps qui ne coule plus.
// Phase 1 « Cadran » : douze aiguilles-lasers annoncées qui balaient l'arène heure par heure.
// Phase 2 « Carillon » : murs de glace successifs dont le trou se décale, pluie de stalactites.
// Phase 3 « Minuit figé » : une couronne d'échardes s'immobilise… puis repart vers le joueur.
import { defineEnemy, defineSprite, definePattern, R } from '../../core/registry';
import type { BulletSpec, Enemy } from '../../core/types';
import type { Ctx } from '../../sim/ctx';
import { enemyBullet } from '../../sim/patterns';
import { sym } from './w2_bestiaire';

const TAU = Math.PI * 2;

/** Pendant une attaque signature, le mécanisme se verrouille : dégâts subis réduits. */
function guard(e: Enemy, sec: number): void {
  e.data.guard = Math.max(e.data.guard ?? 0, e.age + sec);
}

// ------------------------------------------------------------------ patterns signature
/** w2_cadran — count aiguilles (lasers) tirées l'une après l'autre en tournant ; chacune annoncée warn s. */
definePattern('w2_cadran', (ctx, e, p, t) => {
  const n = p.count ?? 12, iv = p.interval ?? 0.22, warn = Math.max(0.5, p.warn ?? 0.75), len = p.length ?? 340;
  const base = (t ? Math.atan2(t.y - e.y, t.x - e.x) : 0) + Math.PI / n;
  const dir = p.dir ?? (ctx.rng.chance(0.5) ? 1 : -1);
  guard(e, n * iv + warn);
  ctx.text(e.x, e.y - 22, 'TIC… TAC…', 0x9ae8ff, true);
  for (let k = 0; k < n; k++) {
    ctx.after(k * iv, () => {
      const ox = e.x, oy = e.y, a = base + dir * (k / n) * TAU;
      ctx.spawnBullet({ kind: 'beam', damage: 0, life: warn, width: 1, length: len, color: 0x9ae8ff, data: { warn: true } }, ox, oy, a, 'enemy', e);
      ctx.after(warn, () => {
        ctx.spawnBullet({ kind: 'beam', damage: p.damage ?? 2, life: 0.2, width: p.width ?? 6, length: len, color: 0xff5577 }, ox, oy, a, 'enemy', e);
        ctx.sfx('elaser', 0.35);
        ctx.shake(1.5);
      }, e);
    }, e);
  }
});

/** w2_carillon — waves murs visés successifs ; le trou se décale de shift à chaque coup. */
definePattern('w2_carillon', (ctx, e, p, t) => {
  const waves = p.waves ?? 4, n = p.count ?? 13, gw = p.gapWidth ?? 3;
  let gap = ctx.rng.int(2, n - gw - 2);
  const shift = ctx.rng.chance(0.5) ? 2 : -2;
  const wall = R.patterns.get('wall');
  guard(e, waves * (p.interval ?? 0.7));
  for (let k = 0; k < waves; k++) {
    const g = gap;
    ctx.after(k * (p.interval ?? 0.7), () => {
      if (wall) wall(ctx, e, { ...p, count: n, gap: g, gapWidth: gw }, e.target ?? t);
      ctx.ring(e.x, e.y, 26, 0x9ae8ff);
    }, e);
    gap = Math.max(1, Math.min(n - gw - 1, gap + shift));
    if (gap <= 1 || gap >= n - gw - 1) gap = Math.max(1, Math.min(n - gw - 1, gap - 2 * shift));
  }
});

/** w2_minuit — couronne d'échardes qui freinent jusqu'à l'arrêt puis repartent (en décalé) vers le joueur. */
definePattern('w2_minuit', (ctx, e, p) => {
  const n = p.count ?? 18, sp = p.speed ?? 130, hold = p.hold ?? 1.3, relaunch = p.relaunch ?? 105;
  const off = ctx.rng.range(0, TAU);
  guard(e, hold + 0.6);
  ctx.flash(0x9ae8ff, 0.18);
  ctx.text(e.x, e.y - 22, 'MINUIT !', 0x9ae8ff, true);
  for (let i = 0; i < n; i++) {
    const spec: BulletSpec = {
      ...enemyBullet({ speed: sp, sprite: 'eb_w2_glacon', life: hold + 4 }),
      drag: 2.6,
      data: { hold: hold + (i % 6) * 0.12 },
      onTick: (c: Ctx, b) => {
        if (b.drag && b.age >= b.data.hold) {
          b.drag = 0;
          const pl = c.nearestPlayer(b.x, b.y);
          const a = pl ? Math.atan2(pl.y - b.y, pl.x - b.x) : b.dir;
          b.dir = a;
          b.vx = Math.cos(a) * relaunch;
          b.vy = Math.sin(a) * relaunch;
        }
      },
    };
    ctx.spawnBullet(spec, e.x, e.y, off + (i / n) * TAU, 'enemy', e);
  }
  ctx.sfx('ering', 0.6);
});

// ------------------------------------------------------------------ sprite 26×26
const BOSS = [
  '...........ic', //  0 couronne
  '......i....iC',
  '......iC..iIC',
  '......iIiiIIC',
  '.....BBBBBBBB', //  4 cadran
  '....BbiiiiiiI',
  '...Bbiiii2iii',
  '..Bbii2iiiiiy',
  '..Bbiiiiiiiiy',
  '.Bbi2iiiiiiiy',
  '.Bbiiiiiiiiiy',
  '.Bbiiii0iiiiy',
  '.Bbiiii0iiiyy',
  '.Bb2iiiiiiiyr', // 13 pivot
  '.Bbiiiiiiiiii',
  '.Bbiiiiiiiiii',
  '..Bbii2iiiiii',
  '..Bbiiiii0000',
  '...Bbiiiiiiii',
  '....BBbbbbbbb',
  '.....aBBBBBBB', // 20 balancier / robe
  '....aAAaaaaaa',
  '..CcaAaAaaaaa',
  '.Cc.aAaaAaaaa',
  'Cc..aAAAAAAAA',
  '....AA...AA..',
];
const BOSS2 = BOSS.map((r, i) =>
  i === 0 ? '..........ic.' :
  i === 22 ? '...CaAaAaaaaa' :
  i === 23 ? '..CcaAaaAaaaa' :
  i === 24 ? '.Cc.aAAAAAAAA' :
  i === 25 ? '.....AA..AA..' :
  i === 11 || i === 12 ? r.replace('0', 'b') : r);
defineSprite('boss_w2_horlogere', sym(BOSS), { frames: [sym(BOSS2)] });

// ------------------------------------------------------------------ boss
defineEnemy({
  id: 'boss_w2_horlogere', name: 'Horlogère Givrale', world: 2, sprite: 'boss_w2_horlogere', hp: 1000, speed: 28, radius: 13, contact: 1, knockbackResist: 1,
  move: { kind: 'orbit', range: 120 },
  onHurt: (ctx, e, ev) => {
    if ((e.data.guard ?? 0) > e.age && ev.cause !== 'status') {
      ev.amount *= 0.35;
      if ((e.data.gfx = (e.data.gfx ?? 0) - 1) <= 0) { e.data.gfx = 6; ctx.burst(e.x, e.y, 0x9ae8ff, 3, 50, 0.25); }
    }
  },
  boss: {
    title: 'Gardienne du temps figé',
    phases: [
      {
        hp: 1, move: { kind: 'orbit', range: 120 }, speed: 28,
        attacks: [
          { pattern: 'w2_cadran', cooldown: 7.5, first: 2.5, telegraph: 0.7, stop: 3.4, range: 600, weight: 1.4, params: { count: 12, interval: 0.2, warn: 0.75, damage: 2 } },
          { pattern: 'burst', cooldown: 2.6, telegraph: 0.4, range: 600, params: { shots: 4, interval: 0.18, count: 3, spread: 0.4, speed: 115, sprite: 'eb_w2_glacon' } },
          { pattern: 'ring', cooldown: 3.6, telegraph: 0.5, range: 600, params: { count: 16, speed: 90 } },
          { pattern: 'summon', cooldown: 10, first: 6, telegraph: 0.6, range: 600, params: { id: 'w2_rouage', count: 2, max: 4 } },
        ],
      },
      {
        hp: 0.66, move: { kind: 'chase', range: 90 }, speed: 34,
        onEnter: (ctx, e) => { ctx.text(e.x, e.y - 24, 'LE CARILLON SONNE', 0x9ae8ff, true); ctx.flash(0x9ae8ff, 0.2); },
        attacks: [
          { pattern: 'w2_carillon', cooldown: 6.5, first: 1.5, telegraph: 0.6, stop: 2.2, range: 600, weight: 1.4, params: { waves: 4, interval: 0.7, count: 13, spacing: 15, speed: 85, gapWidth: 3, sprite: 'eb_w2_glacon' } },
          { pattern: 'rain', cooldown: 4.2, telegraph: 0.5, range: 600, params: { count: 8, area: 80, interval: 0.1, time: 1, radius: 18, sprite: 'eb_w2_glacon' } },
          { pattern: 'spiral', cooldown: 5, telegraph: 0.5, stop: 1.4, range: 600, params: { arms: 3, shots: 18, interval: 0.07, step: 0.3, speed: 90 } },
          { pattern: 'summon', cooldown: 12, telegraph: 0.6, range: 600, params: { id: 'w2_rouage', count: 2, max: 4 } },
        ],
      },
      {
        hp: 0.33, move: { kind: 'wander', period: 1 }, speed: 52,
        onEnter: (ctx, e) => { ctx.text(e.x, e.y - 24, 'PLUS UNE SECONDE À PERDRE', 0xff5577, true); ctx.flash(0xd8f0ff, 0.3); },
        attacks: [
          { pattern: 'w2_minuit', cooldown: 6.5, first: 1.5, telegraph: 0.7, stop: 1.6, range: 600, weight: 1.4, params: { count: 18, speed: 130, hold: 1.3, relaunch: 105 } },
          { pattern: 'rings', cooldown: 4, telegraph: 0.5, stop: 0.8, range: 600, params: { waves: 3, count: 12, interval: 0.35, speed: 100 } },
          { pattern: 'dash', cooldown: 3.8, telegraph: 0.6, range: 220, params: { speed: 240, dur: 0.4 } },
          { pattern: 'lob', cooldown: 3.4, telegraph: 0.45, range: 600, params: { count: 3, scatter: 40, radius: 20, status: { kind: 'slow', dur: 1 } } },
        ],
      },
    ],
  },
});
