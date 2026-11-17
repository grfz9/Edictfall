// Monde 1 — premiers ennemis + boss. Modèle à suivre pour les autres.
import { defineEnemy, defineSprite, definePattern, R } from '../../core/registry';
import { enemyBullet } from '../../sim/patterns';
import type { Enemy } from '../../core/types';
import type { Ctx } from '../../sim/ctx';
import { mirror, swap, stamp, shiftCols, phaseShow, breachRing, aimAt, TAU } from './boss_kit';

defineSprite('e_slime', ['...gggggg...', '..glllllgg..', '.gl1lllllgg.', '.gll0ll0lgG.', 'gglllllllgGG', 'ggllllllggGG', 'gggggggggGGG', '.GGGGGGGGGG.'], {
  frames: [['............', '...gggggg...', '.gglllllggg.', 'gl1llllllggG', 'gll0lll0lgGG', 'gglllllllgGG', 'gggggggggGGG', '.GGGGGGGGGG.']],
});
defineEnemy({
  id: 'slime', minFloor: 1, name: 'Gelée des mousses', world: 1, sprite: 'e_slime', hp: 14, speed: 55, radius: 6, contact: 1, cost: 1, coins: [0, 2],
  move: { kind: 'hop', period: 0.8, mult: 2.4, dur: 0.3 },
});

defineSprite('e_lutin', ['.f......f.', '.ffffffff.', 'ffffffffff', 'ff1kff1kff', 'ffffffffff', '.ffFFFFff.', '..nnnnnn..', '.nNnnnnNn.', '.nNnnnnNn.', '..nnnnnn..', '..dd..dd..'], {
  frames: [['.f......f.', '.ffffffff.', 'ffffffffff', 'ff1kff1kff', 'ffffffffff', '.ffFFFFff.', '..nnnnnn..', '.nNnnnnNn.', '.nNnnnnNn.', '..nnnnnn..', '.dd....dd.']],
});
defineEnemy({
  id: 'lutin', minFloor: 1, name: 'Lutin frondeur', world: 1, sprite: 'e_lutin', hp: 12, speed: 48, radius: 5, contact: 0, cost: 1, coins: [0, 3],
  move: { kind: 'keepDistance', range: 90 },
  attacks: [{ pattern: 'aimed', cooldown: 1.9, telegraph: 0.3, params: { speed: 105 } }],
});

defineSprite('e_bat', ['P............P', 'PP..PPPPPP..PP', 'PPPPPpppPPPPPP', '.PPPp1pp1pPPP.', '..PPppppppPP..', '...PPpkkpPP...', '....PP..PP....'], {
  frames: [['..............', '....PPPPPP....', '..PPPpppPPPP..', '.PPPp1pp1pPPP.', 'PPPPppppppPPPP', 'PP.PPpkkpPP.PP', 'P...PP..PP...P']],
});
defineEnemy({
  id: 'bat', minFloor: 1, name: 'Chauve-furie', world: 1, sprite: 'e_bat', hp: 8, speed: 82, radius: 5, contact: 1, cost: 1, coins: [0, 1], phasing: true,
  move: { kind: 'zigzag' },
});

defineSprite('e_sprout', ['..l..l..', '..lGGl..', '...GG...', '.NnnnnN.', 'Nn0nn0nN', 'NnnnnnnN', '.NnnnnN.', '..d..d..']);
defineEnemy({
  id: 'sprout', name: 'Rejeton', world: 0, sprite: 'e_sprout', hp: 9, speed: 70, radius: 4, contact: 1, coins: [0, 0], energy: 0, noChampion: true,
  move: { kind: 'chase' },
});

// ------------------------------------------------------------------ BOSS : Souche-Roi
// Phase 1 « Racines » : épines annoncées + double éventail de ronces + rejetons.
// Phase 2 « Écorce fendue » : la sève bout dans les fissures — couronnes à brèche ET pluie de sève en même temps.
// Phase 3 « Fureur sylvestre » : feuilles en feu, triple bond écrasant, tempête d'épines (spirale + racines).

const SOUCHE_PAL = { h: '#e2bd7e', x: '#2a1a10', u: '#fff4b0', z: '#ff6a2a', j: '#5c1a0e' };
const SOUCHE = mirror([
  '..................',
  '..l...........y...',
  '.lgl.........yYy..',
  'lgGgl...y....yYy..',
  'lgfGl..yYy...yYy.y',
  '.fGf...yYy..yyYyyY',
  '..F.....YyyyyYYYyy',
  '..F.....YrryYYrryY',
  '...F....YYYYYYYYYY',
  '...F...xddddddddNN',
  '...F..xdNNNnnnnnhh',
  '..F..xdNnnnnnnnhhh',
  '.lF..xdNnNnnnnnnnn',
  'lgF..xdNn000nnnnnn',
  'gGFl.xdNnn0yy0nnnn',
  'gfGF.xdNnn0y10nnNn',
  '.FgFFxdNnnn00nnnNn',
  '..FFdNdNnnnnnnnnNn',
  '....dNNNnnnnnnnnnn',
  '.....xdNnn000000kk',
  '.....xdNnn0wkwkwkk',
  '.....xdNnn0kkkkkkk',
  '.....xdNnnn0wkwkwk',
  '.....xdNnnnn00000k',
  '.....xdNnfnnnnnnnn',
  '.....xdNffnnnnNnnn',
  '.....xdNfGfnnnNnnn',
  '......xdNnnnnnNnnn',
  '......xdNNnnnnNNnn',
  '.....xddNNNNNNNNNN',
  '....xdNdxdNNNdNNNx',
  '...xdNd.xdNNd.xdNN',
  '..xdNd..xdNd..xdNd',
  '.xdNd...xdd...xdNd',
  'xdNd....xd.....xdd',
  'xdd......d......xd',
]);
/** Lumière en haut à gauche, ombre à droite : l'écorce prend du volume. */
const sLit = (rows: string[]) => swap(swap(rows, { n: 'N', h: 'n' }, 28, 36, 9, 30), { N: 'n' }, 7, 10, 10, 20);
/** 4 frames : feuillage qui ondule, bras-branches qui se lèvent, regard qui s'allume, clignement. */
function sFrames(base: string[], eye: string, glow: string): string[][] {
  const f1 = swap(shiftCols(shiftCols(base, 0, 5, 1), 31, 36, -1), { [eye]: glow }, 9, 27, 13, 17);
  const f2 = swap(shiftCols(shiftCols(base, 0, 5, -1), 31, 36, 1), { y: 'Y' }, 6, 30, 0, 9);
  const f3 = stamp(stamp(base, ['0000'], 10, 14), ['0000'], 22, 14);
  return [f1, f2, f3];
}
const S1 = sLit(SOUCHE);
defineSprite('boss_souche', S1, { frames: sFrames(S1, 'y', 'u'), pal: SOUCHE_PAL });

// Phase 2 : bois de cerf qui percent la couronne, fissures de sève, champignons sur les épaules, regard orange.
const ANTLER = ['xd______', 'Nxd___xd', '_Nxd_xN_', '__NxdN__', '___NN___', '___Nd___', '___xN___', '____N___', '____N___'];
let S2 = stamp(stamp(S1, ANTLER, 0, 0), ANTLER.map((r) => [...r].reverse().join('')), 28, 0);
S2 = stamp(S2, ['..v', '.vo', 'vo.', '.v.', '..o', '.ov', 'o..'], 8, 17);
S2 = stamp(S2, ['v..', 'ov.', '.ov', '..v', '.vo', 'v..'], 26, 9);
S2 = stamp(S2, ['.v', 'vo', 'o.', 'v.'], 15, 24);
S2 = stamp(S2, ['.mm.', 'mm1m', 'MMMM', '.w..'], 3, 15);
S2 = stamp(S2, ['.mm', 'm1M', 'MMM', '.w.'], 30, 16);
S2 = swap(S2, { y: 'o', '1': 'u' }, 9, 27, 13, 17);
S2 = swap(S2, { g: 'o', G: 'O', l: 'y' });
S2 = stamp(stamp(S2, ['00..', '.000'], 9, 12), ['..00', '000.'], 23, 12); // sourcils froncés
defineSprite('boss_souche_2', S2, { frames: sFrames(S2, 'o', 'y'), pal: SOUCHE_PAL });

// Phase 3 : forme enragée — feuillage en flammes, fissures de lave, gueule béante, yeux rouges.
let S3 = swap(S2, { o: 'V', v: 'z', O: 'j', y: 'v', m: 'r', M: 'R', n: 'N', h: 'n' });
S3 = swap(S3, { u: '1', V: 'r' }, 9, 27, 13, 17);
S3 = stamp(S3, ['kkkkkkkkkkkkkkkk', 'kwkwkwkwkwkwkwkw', 'kkkkkkkzzkkkkkkk', 'kkkkkkzvvzkkkkkk', 'wkwkwkwkwkwkwkwk'], 10, 19);
S3 = stamp(S3, ['..z...', '.zvz..', 'zvyvz.', '.zvz..'], 1, 9);
S3 = stamp(S3, ['...z..', '..zvz.', '.zvyvz', '..zvz.'], 29, 9);
S3 = stamp(S3, ['.....z.......z....z.......z...', '....zvz.....zvz..zvz.....zvz..', '....vyv.....vyv..vyv.....vyv..'], 3, 0);
S3 = stamp(stamp(S3, ['0...', '000.', '.000'], 9, 11), ['...0', '.000', '000.'], 23, 11); // rage
defineSprite('boss_souche_3', S3, {
  frames: sFrames(S3, 'r', 'u').map((f, k) => (k === 1 ? swap(f, { z: 'v', v: 'y' }, 0, 36, 0, 12) : f)),
  pal: SOUCHE_PAL,
});

/** Écorce durcie : réduit fortement les dégâts subis pendant `dur` s (annoncé visuellement). */
function hardenBark(ctx: Ctx, e: Enemy, dur: number): void {
  e.data.bark = dur;
  ctx.text(e.x, e.y - 30, 'ÉCORCE !', 0xd8b070, true);
  ctx.ring(e.x, e.y, 34, 0xb98a52);
}
/** Annonce interne d'un pattern en plusieurs temps (« ! » au-dessus du boss + cercle). */
function windup(ctx: Ctx, e: Enemy, sec: number, color = 0xff8040): void {
  e.data.windup = Math.max(e.data.windup ?? 0, sec);
  ctx.ring(e.x, e.y, 26, color);
}

/** souche_ronces — double éventail : un large, puis un second décalé qui bouche les trous du premier… en ralenti. */
definePattern('souche_ronces', (ctx, e, p, t) => {
  const n = p.count ?? 7, spread = p.spread ?? 1.3, base = aimAt(e, t);
  const fan = (off: number, sp: number) => {
    for (let i = 0; i < n; i++) ctx.spawnBullet(enemyBullet({ ...p, speed: sp, sprite: 'eb_shard' }), e.x, e.y, base + off - spread / 2 + (spread * i) / (n - 1), 'enemy', e);
  };
  fan(0, p.speed ?? 100);
  ctx.after(0.32, () => fan(spread / (n - 1) / 2, (p.speed ?? 100) * 0.72), e);
  ctx.sfx('eshoot', 0.5);
});

/** souche_seve — signature P2 : couronne à brèche tournante + pluie de sève visée, en même temps. */
definePattern('souche_seve', (ctx, e, p, t) => {
  R.patterns.get('w1_couronne')?.(ctx, e, { waves: p.waves ?? 3, count: p.count ?? 24, gap: p.gap ?? 4, rotate: 0.5, interval: 0.6, speed: p.speed ?? 80 }, t);
  ctx.after(0.3, () => R.patterns.get('rain')?.(ctx, e, { count: p.rain ?? 6, area: 55, radius: 18, interval: 0.2, time: 1.1, sprite: 'eb_orb', color: 0xffa040 }, e.target ?? t), e);
  ctx.text(e.x, e.y - 30, 'SÈVE BOUILLANTE', 0xffa040, true);
});

/** souche_bonds — signature P3 : enchaîne `jumps` bonds écrasants, chacun annoncé (« ! » + cercle), onde à brèche à l'atterrissage. */
definePattern('souche_bonds', (ctx, e, p, t) => {
  const jumps = p.jumps ?? 3, every = p.every ?? 0.95, warn = Math.max(0.4, p.warn ?? 0.45);
  for (let k = 0; k < jumps; k++) {
    ctx.after(k * every, () => {
      if (k > 0) windup(ctx, e, warn, 0xff5030);
      ctx.after(k > 0 ? warn : 0, () => {
        const tt = e.target ?? t;
        const a = aimAt(e, tt), sp = p.dashSpeed ?? 230, dur = p.dur ?? 0.38;
        e.data.dash = { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: dur };
        ctx.sfx('dash', 0.6);
        ctx.after(dur + 0.05, () => {
          const t2 = e.target ?? tt;
          breachRing(ctx, e, { count: p.count ?? 20, gap: p.gap ?? 4, speed: (p.speed ?? 85) + k * 8, sprite: 'eb_shard' }, aimAt(e, t2));
          ctx.shake(6);
          ctx.ring(e.x, e.y, 44, 0xff6030);
          ctx.burst(e.x, e.y, 0xff6a2a, 16, 100, 0.5, 2);
          ctx.sfx('explode', 0.6);
        }, e);
      }, e);
    }, e);
  }
});

/** souche_tempete — spirale lente d'épines + racines qui jaillissent en étoile (les deux se chevauchent). */
definePattern('souche_tempete', (ctx, e, p, t) => {
  R.patterns.get('spiral')?.(ctx, e, { arms: p.arms ?? 3, shots: p.shots ?? 22, interval: 0.09, step: 0.26, speed: p.speed ?? 75, sprite: 'eb_shard' }, t);
  ctx.after(0.5, () => R.patterns.get('w1_racines')?.(ctx, e, { count: p.roots ?? 5, full: true, warn: 0.65, length: 170 }, e.target ?? t), e);
});

defineEnemy({
  id: 'boss_souche', name: 'Souche-Roi', world: 1, sprite: 'boss_souche', hp: 880, speed: 30, radius: 15, contact: 1, knockbackResist: 1,
  immune: ['slow'], noChampion: true,
  move: { kind: 'chase', range: 80 },
  onUpdate: (ctx, e, dt) => {
    if (e.data.windup > 0) e.data.windup -= dt;
    if (e.phase >= 2 && (e.data.fireFx = (e.data.fireFx ?? 0) - dt) <= 0) {
      e.data.fireFx = 0.18;
      ctx.burst(e.x + ctx.rng.range(-14, 14), e.y - 16 + ctx.rng.range(-4, 4), ctx.rng.chance(0.5) ? 0xff6a2a : 0xffd23a, 2, 30, 0.45);
    }
    if (!(e.data.bark > 0)) return;
    e.data.bark -= dt;
    if ((e.data.barkFx = (e.data.barkFx ?? 0) - dt) <= 0) {
      e.data.barkFx = 0.25;
      ctx.burst(e.x + ctx.rng.range(-12, 12), e.y + ctx.rng.range(-12, 12), 0xb98a52, 3, 30, 0.3);
    }
  },
  onHurt: (_ctx, e, ev) => {
    if (e.data.bark > 0 && ev.cause !== 'status') ev.amount *= 0.3;
  },
  boss: {
    title: 'Monarque des racines mortes',
    phases: [
      {
        hp: 1, move: { kind: 'chase', range: 80 }, speed: 30,
        attacks: [
          { pattern: 'w1_racines', cooldown: 3.6, first: 1.5, telegraph: 0.45, stop: 1.2, weight: 1.4, params: { count: 4, spread: 1.1, warn: 0.6, length: 190 } },
          { pattern: 'souche_ronces', cooldown: 2.6, telegraph: 0.4, stop: 0.4, params: { count: 7, spread: 1.3, speed: 100 } },
          { pattern: 'burst', cooldown: 3.6, telegraph: 0.45, params: { shots: 4, interval: 0.22, count: 3, spread: 0.5, speed: 105 } },
          { pattern: 'summon', cooldown: 9, first: 5, telegraph: 0.7, stop: 0.6, params: { id: 'w1_souchon', count: 2, max: 4 } },
        ],
      },
      {
        hp: 0.66, move: { kind: 'wander', period: 1.3 }, speed: 42,
        sprite: 'boss_souche_2', scale: 1.06, aura: 0xffa040,
        onEnter: (ctx, e) => {
          phaseShow(ctx, e, 'ÉCORCE FENDUE', 'La sève bout sous le bois mort.', 0xffa040, '#ffa040');
          hardenBark(ctx, e, 2.5);
          for (const s of [-1, 1]) {
            const x = e.x + s * 28, y = e.y + 12;
            if (!ctx.isSolid(x, y)) ctx.spawnEnemy(s < 0 ? 'w1_souchon' : 'vesse_de_loup', x, y, { summoned: true, delay: 0.7 });
          }
        },
        attacks: [
          { pattern: 'souche_seve', cooldown: 5.4, first: 1.6, telegraph: 0.6, stop: 2, weight: 1.5, params: { waves: 3, count: 24, gap: 4, speed: 80, rain: 6 } },
          { pattern: 'w1_racines', cooldown: 3.8, telegraph: 0.45, stop: 0.8, params: { count: 6, full: true, warn: 0.6, length: 170 } },
          { pattern: 'homing', cooldown: 5, telegraph: 0.45, params: { count: 3, speed: 72, turn: 1.3, life: 3.2 } },
          { pattern: 'souche_ronces', cooldown: 2.6, telegraph: 0.4, params: { count: 9, spread: 1.5, speed: 105 } },
          { pattern: 'summon', cooldown: 10, first: 6, telegraph: 0.7, stop: 0.6, params: { id: 'vesse_de_loup', count: 2, max: 4 } },
        ],
      },
      {
        hp: 0.33, move: { kind: 'chase', range: 30 }, speed: 54,
        sprite: 'boss_souche_3', scale: 1.14, tint: 0xffe0d0, aura: 0xff4020,
        onEnter: (ctx, e) => {
          phaseShow(ctx, e, 'FUREUR SYLVESTRE', 'Le bois mort prend feu. Il est furieux.', 0xff5020, '#ff6a2a');
          hardenBark(ctx, e, 2);
          // couronne d'épines au sol, ouverte du côté du joueur
          const t = e.target ?? ctx.nearestPlayer(e.x, e.y);
          const g = t ? Math.atan2(t.y - e.y, t.x - e.x) : 0;
          const n = 18;
          for (let i = 3; i < n; i++) {
            const a = g + ((i - 1) / n) * TAU;
            const x = e.x + Math.cos(a) * 66, y = e.y + Math.sin(a) * 66;
            if (!ctx.isSolid(x, y)) ctx.spawnBullet(enemyBullet({ speed: 0, life: 5, radius: 4, sprite: 'eb_shard' }), x, y, a, 'enemy', e);
          }
        },
        attacks: [
          { pattern: 'souche_bonds', cooldown: 5.2, first: 1.4, telegraph: 0.6, stop: 2.4, range: 260, weight: 1.6, params: { jumps: 3, every: 0.95, warn: 0.45, dashSpeed: 230, dur: 0.38, count: 20, gap: 4, speed: 85 } },
          { pattern: 'souche_tempete', cooldown: 5.4, telegraph: 0.5, stop: 1.6, params: { arms: 3, shots: 22, speed: 78, roots: 5 } },
          { pattern: 'souche_ronces', cooldown: 2.8, telegraph: 0.4, params: { count: 9, spread: 1.4, speed: 110 } },
          { pattern: 'rain', cooldown: 4.4, telegraph: 0.5, params: { count: 7, area: 70, radius: 20, interval: 0.14, sprite: 'eb_orb', color: 0xff8040 } },
          { pattern: 'summon', cooldown: 8, telegraph: 0.7, params: { id: 'w1_souchon', count: 3, max: 5 } },
        ],
      },
    ],
  },
});
