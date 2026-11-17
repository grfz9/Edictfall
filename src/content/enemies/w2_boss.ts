// Monde 2 — boss : l'Horlogère Givrale, gardienne d'un temps qui ne coule plus.
// Phase 1 « Cadran » : aiguilles-lasers annoncées + engrenages (deux anneaux troués qui ondulent en sens contraires).
// Phase 2 « Carillon » (verre fendu, cornes de glace) : murs à trou mobile ET stalactites, spirale, rayons.
// Phase 3 « Minuit figé » (cadran noir, aiguilles folles) : douze coups + minuit, gerbes qui reviennent, ruées givrantes.
import { defineEnemy, defineSprite, definePattern, R } from '../../core/registry';
import type { BulletSpec, Enemy } from '../../core/types';
import type { Ctx } from '../../sim/ctx';
import { enemyBullet } from '../../sim/patterns';
import { Px, phaseShow, breachRing, aimAt } from './boss_kit';

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

/** w2_engrenages — deux anneaux troués qui tournent en sens opposés (ondulation), à intervalle : il faut lire les deux brèches. */
definePattern('w2_engrenages', (ctx, e, p, t) => {
  const n = p.count ?? 18, gap = p.gap ?? 3, waves = p.waves ?? 2;
  const base = aimAt(e, t);
  for (let k = 0; k < waves; k++) {
    ctx.after(k * (p.interval ?? 0.5), () => {
      const g = base + (k % 2 ? 0.6 : -0.6);
      breachRing(ctx, e, { count: n, gap, speed: p.speed ?? 95, sprite: 'eb_w2_glacon', bullet: { wave: { amp: k % 2 ? 6 : -6, freq: 3 } } }, g);
      ctx.ring(e.x, e.y, 24, 0xc8d0e0);
      ctx.sfx('ering', 0.45);
    }, e);
  }
});

/** w2_rembobine — « Retour en arrière » : une gerbe part, s'arrête, puis revient vers l'Horlogère (brèche face au joueur). */
definePattern('w2_rembobine', (ctx, e, p, t) => {
  const n = p.count ?? 20, gap = p.gap ?? 4;
  const g = aimAt(e, t);
  ctx.text(e.x, e.y - 30, '« RETOUR ! »', 0xc070ff, true);
  guard(e, 0.8);
  breachRing(ctx, e, { count: n, gap, speed: p.speed ?? 120, life: p.life ?? 2.6, sprite: 'eb_w2_glacon', bullet: { boomerang: true } }, g);
  ctx.after(0.25, () => breachRing(ctx, e, { count: n, gap, speed: (p.speed ?? 120) * 0.8, life: p.life ?? 2.6, sprite: 'eb_w2_flocon', bullet: { boomerang: true } }, g + 0.5), e);
  ctx.sfx('ering', 0.6);
});

/** w2_carillon_glas — signature P2 : murs du carillon ET stalactites qui tombent sur le joueur pendant qu'il cherche le trou. */
definePattern('w2_carillon_glas', (ctx, e, p, t) => {
  R.patterns.get('w2_carillon')?.(ctx, e, p, t);
  ctx.after(0.5, () => R.patterns.get('rain')?.(ctx, e, { count: p.rain ?? 5, area: 50, interval: 0.25, time: 1.1, radius: 16, sprite: 'eb_w2_glacon' }, e.target ?? t), e);
  ctx.text(e.x, e.y - 30, 'DONG !', 0x9ae8ff, true);
});

/** w2_douze_coups — signature P3 : cadran éclair (aiguilles rapides) qui se termine par « Minuit » (couronne figée). */
definePattern('w2_douze_coups', (ctx, e, p, t) => {
  R.patterns.get('w2_cadran')?.(ctx, e, { count: p.count ?? 8, interval: 0.14, warn: 0.6, damage: 2, length: 320 }, t);
  ctx.after((p.count ?? 8) * 0.14 + 0.7, () => R.patterns.get('w2_minuit')?.(ctx, e, { count: p.shards ?? 20, speed: 130, hold: 1.1, relaunch: 110 }, e.target ?? t), e);
});

// ------------------------------------------------------------------ sprites 36×40 (dessinés par primitives, 3 phases × 4 frames)
const HORL_PAL = { x: '#1a2648', q: '#eefaff', h: '#fff0a0', u: '#5a3a9a' };
/** ph 0-2, f 0-3 : le pendule balance, l'aiguille avance, les bras se balancent, les éclats tournent. */
function horloge(ph: number, f: number): string[] {
  const W = 36, H = 40, cx = 18, cy = 14;
  const P = new Px(W, H);
  const sw = [-2, 0, 2, 0][f], arm = [0, 1, 0, -1][f];
  // --- robe (trapèze, plis, ourlet de givre)
  P.shape((x, y) => {
    if (y < 23) return null;
    const hw = 6 + (y - 23) * 0.66, d = Math.abs(x - cx);
    if (d > hw) return null;
    const torn = ph === 2 && y > H - 3 && (Math.floor(x) * 7 + f) % 5 < 2;
    if (torn) return null;
    if (y > H - 2.5) return (Math.floor(x) + (y > H - 1.5 ? 1 : 0)) % 2 ? 'i' : 'c';
    if (x < cx - hw + 1.5) return 'b';
    if (x > cx + hw - 1.6) return 'x';
    if (Math.floor(d) % 5 === 3) return 'x';
    return ph === 2 ? 'u' : 'B';
  });
  // fenêtre du pendule
  P.rect(15, 26, 6, 11, 'x').rect(15, 26, 6, 1, 'a');
  P.line(17, 26, 17 + sw, 33, 'Y').line(18, 26, 18 + sw, 33, 'y');
  P.disc(18 + sw, 34.5, 2, 'y').set(17 + sw, 34, 'h').set(19 + sw, 35, 'Y');
  // --- bras (manches + mains de givre)
  for (const s of [-1, 1]) {
    const x0 = cx + s * 7, x1 = cx + s * 14.5, y1 = 30 + arm;
    P.line(x0, 24, x1, y1, 'B').line(x0, 25, x1, y1 + 1, s < 0 ? 'b' : 'B').line(x0, 26, x1, y1 + 2, 'x');
    P.disc(x1, y1 + 3, 1.6, 'q').set(x1 - s, y1 + 2, 'i');
  }
  // --- engrenage derrière le cadran (dès la phase 2)
  if (ph >= 1) for (let k = 0; k < 14; k++) {
    const a = (k / 14) * TAU + f * 0.11;
    P.set(cx - 0.5 + Math.cos(a) * 12.2, cy - 0.5 + Math.sin(a) * 12.2, 'a');
  }
  // --- couronne de stalactites
  const spikes: [number, number, number][] = ph === 0 ? [[17, 0, 4], [13, 2, 5], [9, 5, 8]] : [[17, 0, 4], [13, 1, 5], [9, 3, 8]];
  for (const [x, y0, y1] of spikes) for (const xx of [x, W - 2 - x]) {
    P.line(xx, y0 + 1, xx, y1, 'i').line(xx + 1, y0 + 1, xx + 1, y1, 'C').set(xx + (xx < cx ? 1 : 0), y0, 'c');
  }
  // cornes de glace (phase 2+)
  if (ph >= 1) for (const s of [-1, 1]) {
    const bx = cx + s * 9, tip = ph === 2 ? 10 : 8;
    P.line(bx, 8, cx + s * (9 + tip * 0.6), 8 - tip, 'c').line(bx - s, 9, cx + s * (8 + tip * 0.6), 9 - tip, 'i');
  }
  // --- cadran
  const rim = ph === 2 ? ['P', 'p'] : ['Y', 'y'];
  P.disc(cx, cy, 11, rim[0]).disc(cx, cy, 10, rim[1]).disc(cx, cy, 9, ph === 2 ? 'x' : 'w');
  P.shape((x, y) => (Math.hypot(x - cx, y - cy) <= 9 && x - cx + (y - cy) > 6 ? (ph === 2 ? '5' : '2') : null));
  P.shape((x, y) => (Math.hypot(x - cx, y - cy) <= 10.3 && Math.hypot(x - cx, y - cy) > 9.6 && x < cx - 2 && y < cy - 2 ? (ph === 2 ? 'm' : 'h') : null));
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU - Math.PI / 2;
    P.set(cx - 0.5 + Math.cos(a) * 7.6, cy - 0.5 + Math.sin(a) * 7.6, ph === 2 ? 'm' : k % 3 === 0 ? 'B' : 'A');
  }
  // aiguilles : la grande avance d'un cran par frame (et s'affole en phase 3)
  const minute = -Math.PI / 2 + f * (ph === 2 ? TAU / 4 : TAU / 12), hour = -Math.PI / 2 - (ph === 2 ? f * 0.9 : 1);
  const hc = ph === 2 ? 'r' : 'k';
  P.ray(cx - 0.5, cy - 0.5, minute, 6.5, hc).ray(cx - 0.5, cy - 0.5, hour, 4.2, hc);
  P.disc(cx, cy, 1.2, 'r');
  // fissures (phase 2+)
  if (ph >= 1) P.line(10, 9, 13, 12, '4').line(13, 12, 12, 17, '4').line(25, 8, 22, 11, '4').line(22, 11, 24, 13, '4');
  if (ph === 2) P.line(20, 19, 23, 21, '4').line(11, 17, 9, 20, '4');
  // reflet du verre
  P.line(11, 9, 13, 7, '1').set(10, 11, 'q');
  // yeux
  const eye = ph === 0 ? ['c', 'C'] : ph === 1 ? ['b', 'B'] : ['m', 'M'];
  for (const ex of [12, 20]) {
    const L = ex < cx;
    if (ph === 0 && f === 3) { P.rect(ex, 13, 4, 1, '0'); continue; }
    P.rect(ex, 11, 4, 4, '0').rect(ex + 1, 12, 2, 2, eye[0]).set(ex + (L ? 1 : 2), 12, '1').set(ex + (L ? 2 : 1), 13, eye[1]);
    if (ph >= 1) P.line(ex - (L ? 1 : -1) + (L ? 0 : 3), 9 + (ph === 2 ? 0 : 1), L ? ex + 3 : ex, 11, '0'); // sourcils froncés
  }
  // éclats en orbite (phase 3)
  if (ph === 2) for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + f * 0.26;
    const x = cx - 0.5 + Math.cos(a) * 16, y = cy + 2 + Math.sin(a) * 13;
    P.set(x, y, 'c').set(x + 1, y, 'i').set(x, y - 1, 'q');
  }
  return P.rows();
}
for (const [ph, id] of [[0, 'boss_w2_horlogere'], [1, 'boss_w2_horlogere_2'], [2, 'boss_w2_horlogere_3']] as const) {
  defineSprite(id, horloge(ph, 0), { frames: [1, 2, 3].map((f) => horloge(ph, f)), pal: HORL_PAL });
}

// ------------------------------------------------------------------ boss
defineEnemy({
  id: 'boss_w2_horlogere', name: 'Horlogère Givrale', world: 2, sprite: 'boss_w2_horlogere', hp: 1420, speed: 28, radius: 15, contact: 1, knockbackResist: 1,
  move: { kind: 'orbit', range: 120 },
  onHurt: (ctx, e, ev) => {
    if ((e.data.guard ?? 0) > e.age && ev.cause !== 'status') {
      ev.amount *= 0.35;
      if ((e.data.gfx = (e.data.gfx ?? 0) - 1) <= 0) { e.data.gfx = 6; ctx.burst(e.x, e.y, 0x9ae8ff, 3, 50, 0.25); }
    }
  },
  onUpdate: (ctx, e, dt) => {
    if (e.phase < 2) return;
    if ((e.data.fx = (e.data.fx ?? 0) - dt) <= 0) {
      e.data.fx = 0.2;
      const a = ctx.rng.range(0, TAU);
      ctx.burst(e.x + Math.cos(a) * 18, e.y + Math.sin(a) * 16, ctx.rng.chance(0.5) ? 0xc070ff : 0x9ae8ff, 2, 25, 0.5);
    }
  },
  boss: {
    title: 'Gardienne du temps figé',
    phases: [
      {
        hp: 1, move: { kind: 'orbit', range: 120 }, speed: 30, aura: 0x9ae8ff,
        attacks: [
          { pattern: 'w2_cadran', cooldown: 7, first: 2.5, telegraph: 0.7, stop: 3.2, range: 600, weight: 1.4, params: { count: 12, interval: 0.2, warn: 0.75, damage: 2 } },
          { pattern: 'burst', cooldown: 2.4, telegraph: 0.4, range: 600, params: { shots: 4, interval: 0.18, count: 3, spread: 0.45, speed: 118, sprite: 'eb_w2_glacon' } },
          { pattern: 'w2_engrenages', cooldown: 3.8, telegraph: 0.5, range: 600, params: { waves: 2, count: 18, gap: 3, speed: 92, interval: 0.55 } },
          { pattern: 'summon', cooldown: 10, first: 6, telegraph: 0.6, range: 600, params: { id: 'w2_rouage', count: 2, max: 4 } },
        ],
      },
      {
        hp: 0.66, move: { kind: 'chase', range: 90 }, speed: 36,
        sprite: 'boss_w2_horlogere_2', scale: 1.06, aura: 0x48a8ff,
        onEnter: (ctx, e) => {
          phaseShow(ctx, e, 'LE CARILLON SONNE', 'Le verre se fend. Les engrenages grincent.', 0x9ae8ff, '#9ae8ff');
          guard(e, 1.6);
          for (const s of [-1, 1]) ctx.spawnEnemy('w2_rouage', e.x + s * 30, e.y + 14, { summoned: true, delay: 0.7 });
        },
        attacks: [
          { pattern: 'w2_carillon_glas', cooldown: 6.2, first: 1.5, telegraph: 0.6, stop: 2.4, range: 600, weight: 1.5, params: { waves: 5, interval: 0.62, count: 15, spacing: 14, speed: 90, gapWidth: 3, sprite: 'eb_w2_glacon', rain: 5 } },
          { pattern: 'w2_engrenages', cooldown: 4, telegraph: 0.5, range: 600, params: { waves: 3, count: 20, gap: 3, speed: 98, interval: 0.5 } },
          { pattern: 'spiral', cooldown: 5, telegraph: 0.5, stop: 1.4, range: 600, params: { arms: 4, shots: 18, interval: 0.07, step: 0.3, speed: 95 } },
          { pattern: 'laser', cooldown: 5.5, telegraph: 0.5, range: 600, params: { count: 3, spread: 0.9, warn: 0.75, width: 6, damage: 2, length: 320, color: 0x9ae8ff } },
          { pattern: 'summon', cooldown: 11, telegraph: 0.6, range: 600, params: { id: 'w2_floconnet', count: 2, max: 4 } },
        ],
      },
      {
        hp: 0.33, move: { kind: 'chase', range: 75 }, speed: 52,
        sprite: 'boss_w2_horlogere_3', scale: 1.14, tint: 0xe8dcff, aura: 0xc070ff,
        onEnter: (ctx, e) => {
          phaseShow(ctx, e, 'MINUIT FIGÉ', "Plus une seconde à perdre. Plus une seule.", 0xc070ff, '#c070ff');
          guard(e, 1.6);
          ctx.after(0.9, () => R.patterns.get('w2_minuit')?.(ctx, e, { count: 16, speed: 120, hold: 1.2, relaunch: 100 }, e.target), e);
        },
        attacks: [
          { pattern: 'w2_douze_coups', cooldown: 6.5, first: 2, telegraph: 0.7, stop: 2.4, range: 600, weight: 1.5, params: { count: 8, shards: 20 } },
          { pattern: 'w2_rembobine', cooldown: 4, telegraph: 0.55, stop: 0.6, range: 600, params: { count: 22, gap: 4, speed: 120, life: 2.6 } },
          { pattern: 'w2_engrenages', cooldown: 3.6, telegraph: 0.45, range: 600, params: { waves: 3, count: 20, gap: 3, speed: 105, interval: 0.45 } },
          { pattern: 'rings', cooldown: 3.4, telegraph: 0.5, stop: 0.8, range: 600, params: { waves: 3, count: 16, interval: 0.32, speed: 108 } },
          { pattern: 'dash', cooldown: 3.6, telegraph: 0.6, range: 220, params: { speed: 250, dur: 0.4, trail: true, sprite: 'eb_w2_flocon', trailLife: 1.4 } },
          { pattern: 'lob', cooldown: 3.4, telegraph: 0.45, range: 600, params: { count: 4, scatter: 45, radius: 20, status: { kind: 'slow', dur: 1 } } },
          { pattern: 'summon', cooldown: 10, first: 5, telegraph: 0.6, range: 600, params: { id: 'w2_rouage', count: 2, max: 4 } },
        ],
      },
    ],
  },
});
