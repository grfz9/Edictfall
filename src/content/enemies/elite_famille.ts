// Famille « Élites » : ennemis rares, lourds (cost 3-4), étages 3-5 de chaque monde. Un design, un piège, une faiblesse.
import { defineEnemy, defineSprite, definePattern } from '../../core/registry';
import type { Bullet, Enemy } from '../../core/types';
import type { Ctx } from '../../sim/ctx';
import { enemyBullet } from '../../sim/patterns';
import { sym, rep, swapCh, leadAngle, wardAllies, rallyAllies } from './w1_patterns';
import { gapRing, emberPuddle } from './w3_patterns';

const TAU = Math.PI * 2;
const angTo = (e: Enemy, x: number, y: number) => Math.atan2(y - e.y, x - e.x);

// =================================================================== MONDE 1
// ------------------------------------------------------------------ Heaume-Vide : armure sans personne dedans… jusqu'à ce qu'on la casse.
const HEAUME = sym([
  '.......m', '......mr', '....aaaa', '...a2222', '...a2aaa', '...akkkk', '...akckk', '...aAAAA', '.aa2aaaa',
  'a222aAyy', 'a2aa5kay', 'aa.a5k.2', 'a..aak.2', '...aAa.2', '...aa..2', '..aaa..2', '..AA...1',
]);
defineSprite('e_elite_heaume', HEAUME, {
  frames: [
    rep(HEAUME, { 15: '..aaa..22..aa...', 16: '..AA...11...AA..' }),
    swapCh(HEAUME, { c: 'm' }),
    rep(HEAUME, { 0: '........m.......', 1: '.......mrm......', 15: '...aa..22..aaa..', 16: '...AA..11...AA..' }),
  ],
});
const LOCAT = sym(['....m', '...mm', '..mpm', '.mppp', 'mpk0p', 'mpppp', 'mppkk', '.Mppp', '..MMp', '...M.']);
defineSprite('e_elite_locataire', LOCAT, {
  frames: [rep(LOCAT, { 0: '.....m....', 1: '....mmm...' }), swapCh(LOCAT, { '0': 'y' }), rep(LOCAT, { 0: '...m......', 1: '...mmm....' })],
  outline: '#3a1030',
});
defineEnemy({
  id: 'elite_locataire', name: 'Le Locataire', world: 0, sprite: 'e_elite_locataire', hp: 16, speed: 92, radius: 5, contact: 1, coins: [0, 0], energy: 0, noChampion: true,
  phasing: true,
  move: { kind: 'zigzag' },
  attacks: [{ pattern: 'predictif', cooldown: 1.6, telegraph: 0.35, params: { speed: 110, sprite: 'eb_small' } }],
  onSpawn: (ctx, e) => ctx.text(e.x, e.y - 12, 'Je déménage !', 0xff70b8),
});
defineEnemy({
  id: 'elite_heaume_vide', name: 'Heaume-Vide', world: 1, sprite: 'e_elite_heaume', hp: 88, speed: 40, radius: 8, contact: 1, cost: 4, minFloor: 4, coins: [3, 6], energy: 2,
  knockbackResist: 0.85, scale: 1.1,
  move: { kind: 'chase', range: 22 },
  attacks: [
    // estoc : ruée, puis taille en arc dans la foulée
    { pattern: 'combo', cooldown: 3.4, telegraph: 0.5, range: 130, params: { steps: [
      { pattern: 'dash', params: { speed: 250, dur: 0.3 } },
      { pattern: 'melee', at: 0.32, params: { range: 32, arc: 2.4 } },
    ] } },
    { pattern: 'wall', cooldown: 4.2, telegraph: 0.55, stop: 0.4, params: { count: 9, spacing: 14, speed: 82, gapWidth: 2, sprite: 'eb_shard' } },
    { pattern: 'predictif', cooldown: 2.6, telegraph: 0.4, params: { shots: 3, interval: 0.15, speed: 105, sprite: 'eb_shard', mix: true } },
  ],
  // Parade : de face, l'armure dévie 65 % des dégâts. Personne dedans pour avoir mal.
  onHurt: (ctx, e, ev) => {
    if (ev.cause !== 'bullet') return;
    const b = ev.source as Bullet | null, t = e.target;
    if (!b || !t) return;
    let d = Math.abs(angTo(e, b.sx, b.sy) - angTo(e, t.x, t.y)) % TAU;
    if (d > Math.PI) d = TAU - d;
    if (d < 1) {
      ev.amount *= 0.35;
      if ((e.data.clang = (e.data.clang ?? 0) + 1) % 4 === 1) { ctx.burst(e.x, e.y - 4, 0xc8d0e0, 4, 60, 0.2); ctx.sfx('armor', 0.25); }
    }
  },
  onDeath: (ctx, e) => {
    ctx.burst(e.x, e.y, 0xa0a8c0, 18, 110, 0.6, 2);
    ctx.spawnEnemy('elite_locataire', e.x, e.y, { summoned: true, delay: 0.3 });
  },
});

// ------------------------------------------------------------------ Reine-Essaim : intouchable tant que sa garde bourdonne autour d'elle.
const REINE = sym([
  '....y.y.', '....yyyy', '....yryy', 'cc..NNNN', 'cIc.N1NN', 'cIIcN0NN', '.cIcNNNk', '..ccyyyy',
  '...ykkkk', '...yyyyy', '...ykkkk', '....yyyy', '.....kkk', '......yy', '.......k',
]);
const REINE_W = rep(REINE, { 3: sym(['....NNNN'])[0], 4: sym(['.cc.N1NN'])[0], 5: sym(['cIIcN0NN'])[0], 6: sym(['cIc.NNNk'])[0], 7: sym(['.c..yyyy'])[0] });
defineSprite('e_elite_reine', REINE, { frames: [REINE_W, swapCh(REINE, { r: 'm', '0': 'r' }), REINE_W] });
const BOURDON = sym(['c....', 'cc.yy', '.cykk', '..y0y', '..ykk', '...yk']);
defineSprite('e_elite_bourdon', BOURDON, { frames: [sym(['.....', 'cc.yy', 'ccykk', '..y0y', '..ykk', '...yk']), swapCh(BOURDON, { '0': 'r' }), sym(['.....', '.c.yy', 'ccykk', '..y0y', '..ykk', '...yk'])] });
defineEnemy({
  id: 'elite_bourdon', name: 'Bourdon de la garde', world: 0, sprite: 'e_elite_bourdon', hp: 10, speed: 70, radius: 4, contact: 1, coins: [0, 0], energy: 0, noChampion: true,
  phasing: true,
  move: { kind: 'orbit', range: 55 },
  attacks: [{ pattern: 'aimed', cooldown: 2.6, telegraph: 0.4, params: { speed: 95, sprite: 'eb_small' } }],
});
const gardes = (ctx: Ctx, e: Enemy) => ctx.enemies.filter((o) => !o.dead && o.def.id === 'elite_bourdon' && Math.hypot(o.x - e.x, o.y - e.y) < 160).length;
defineEnemy({
  id: 'elite_reine_essaim', name: 'Reine-Essaim', world: 1, sprite: 'e_elite_reine', hp: 80, speed: 44, radius: 8, contact: 1, cost: 4, minFloor: 3, coins: [3, 6], energy: 2,
  phasing: true, scale: 1.1,
  move: { kind: 'keepDistance', range: 115 },
  attacks: [
    { pattern: 'summon', cooldown: 5, first: 0.8, telegraph: 0.5, params: { id: 'elite_bourdon', count: 3, max: 6 } },
    { pattern: 'predictif', cooldown: 2.4, telegraph: 0.4, params: { shots: 3, interval: 0.14, speed: 110, sprite: 'eb_shard', mix: true } },
    { pattern: 'spray', cooldown: 4, telegraph: 0.45, params: { shots: 10, arc: 1.1, interval: 0.08, speed: 90, sprite: 'eb_small' } },
  ],
  // Garde royale : avec 2 bourdons ou plus à proximité, elle ne prend que 30 % des dégâts. Tuez les gardes d'abord !
  onUpdate: (ctx, e, dt) => {
    if ((e.data.gT = (e.data.gT ?? 0) - dt) > 0) return;
    e.data.gT = 0.25;
    const g = gardes(ctx, e) >= 2;
    if (g !== !!e.data.guarded) {
      e.data.guarded = g;
      e.data.look = g ? { aura: 0xffd23a } : undefined;
      if (!g) ctx.text(e.x, e.y - 14, 'Garde rompue !', 0xffd23a);
    }
  },
  onHurt: (ctx, e, ev) => {
    if (!e.data.guarded || ev.cause === 'status') return;
    ev.amount *= 0.3;
    if ((e.data.gfx = (e.data.gfx ?? 0) + 1) % 3 === 0) ctx.burst(e.x, e.y, 0xffd23a, 3, 40, 0.2);
  },
});

// =================================================================== MONDE 2
// ------------------------------------------------------------------ Mage-Miroir : en posture miroir, vos balles vous reviennent. La lame, elle, passe.
const MIROIR = sym([
  '......p', '.....pp', '....pPP', '...pP11', '..pP1ic', '..pPkic', '..pPici', '..pPPci', '..ppPPP',
  '.pppPPy', 'pPpppPP', 'pPpppPp', 'p.pPppp', '..pPppp', '.ppPPpp', 'ppPPPpp', '.PPPPPP',
]);
defineSprite('e_elite_miroir', MIROIR, {
  frames: [
    rep(MIROIR, { 15: 'ppPPPppppPPPpp', 16: '..PPPPPPPPPPP.' }),
    swapCh(MIROIR, { i: '1', c: '1' }),
    swapCh(MIROIR, { c: 'i', i: 'c' }),
  ],
});
defineEnemy({
  id: 'elite_mage_miroir', name: 'Mage-Miroir', world: 2, sprite: 'e_elite_miroir', hp: 120, speed: 40, radius: 7, contact: 0, cost: 3, minFloor: 3, coins: [3, 6], energy: 2,
  move: { kind: 'keepDistance', range: 120 },
  attacks: [
    { pattern: 'laser', cooldown: 4.4, telegraph: 0.45, stop: 1.2, params: { count: 3, spread: 0.7, warn: 0.75, width: 4, damage: 1, length: 280, color: 0x9ae8ff } },
    { pattern: 'predictif', cooldown: 2.2, telegraph: 0.35, params: { count: 2, spread: 0.2, speed: 120, sprite: 'eb_shard' } },
    { pattern: 'blink', cooldown: 6, telegraph: 0.5, params: { min: 70, max: 110, delay: 0.4, then: { count: 10, speed: 95, sprite: 'eb_w2_flocon' } } },
  ],
  onSpawn: (_ctx, e) => { e.data.mT = 2.5; e.data.mirror = 0; },
  // Cycle : 2.5 s exposé → annonce 0.5 s → 2 s de miroir.
  onUpdate: (ctx, e, dt) => {
    e.data.rT = (e.data.rT ?? 0) - dt;
    if (e.data.mirror > 0) {
      e.data.mirror -= dt;
      if (e.data.mirror <= 0) { e.data.look = undefined; e.data.mT = 2.5; ctx.burst(e.x, e.y, 0x9ae8ff, 8, 60, 0.3); }
      return;
    }
    e.data.mT -= dt;
    if (e.data.mT <= 0.5 && !e.data.warned) {
      e.data.warned = true;
      e.data.windup = 0.5;
      ctx.text(e.x, e.y - 16, 'MIROIR !', 0x9ae8ff, true);
      ctx.ring(e.x, e.y, 20, 0x9ae8ff);
    }
    if (e.data.mT <= 0) {
      e.data.warned = false;
      e.data.windup = 0;
      e.data.mirror = 2;
      e.data.look = { tint: 0xd8f0ff, aura: 0x9ae8ff };
      ctx.sfx('blink', 0.5);
    }
  },
  onHurt: (ctx, e, ev) => {
    if (!(e.data.mirror > 0) || ev.cause !== 'bullet') return;
    const b = ev.source as Bullet | null;
    if (!b) return;
    if (b.kind === 'beam') { ev.amount *= 0.5; return; }
    ev.cancel = true;
    b.dead = true;
    if (e.data.rT > 0) return; // cadence de renvoi plafonnée (fusils à pompe…)
    e.data.rT = 0.07;
    const src = b.owner && !b.owner.dead ? b.owner : e.target;
    const a = src ? angTo(e, src.x, src.y) : b.dir + Math.PI;
    ctx.spawnBullet(enemyBullet({ speed: 125, sprite: 'eb_shard', life: 2.5 }), e.x, e.y, a + ctx.rng.range(-0.08, 0.08), 'enemy', e);
    ctx.burst(b.x, b.y, 0xffffff, 3, 50, 0.15);
  },
});

// ------------------------------------------------------------------ Louve-Alpha : hurle, rameute sa meute, bondit là où vous serez.
const LOUVE = [
  '............2.2...', '...........22122..', '..........2iiii2..', '..........2ib1ii22', '.2.......22iiiiiik', '22.....2222iiiRwww',
  '.2222222iiiiiiii..', '..2iiiiiiiiiiii3..', '..2iiiIiiiIiiii3..', '..22iiIIiiiIIii3..', '...2I3..2I3.2I3...', '...I3...I3..I3....',
];
const LOUVE2 = rep(LOUVE, { 10: '..2I3...2I3..2I3..', 11: '..I3....I3...I3...' });
defineSprite('e_elite_louve', LOUVE, { frames: [LOUVE2, swapCh(LOUVE, { b: 'r', w: '1' }), swapCh(LOUVE2, { b: 'r' })] });
const LOUVETEAU = ['........2.2.', '.......2ii2.', '.......ib1ik', '2.....2iiiR.', '.22222iiiii.', '..iiiiiiii3.', '..2i3..2i3..', '..i3...i3...'];
const LOUVETEAU2 = rep(LOUVETEAU, { 6: '.2i3...2i3..', 7: '.i3....i3...' });
defineSprite('e_elite_louveteau', LOUVETEAU, { frames: [LOUVETEAU2, swapCh(LOUVETEAU, { b: 'r' }), LOUVETEAU2] });
defineEnemy({
  id: 'elite_louveteau', name: 'Louveteau du blizzard', world: 0, sprite: 'e_elite_louveteau', hp: 24, speed: 92, radius: 5, contact: 1, coins: [0, 0], energy: 0, noChampion: true,
  move: { kind: 'zigzag' },
  attacks: [{ pattern: 'melee', cooldown: 1.4, telegraph: 0.35, range: 30, params: { range: 22, arc: 1.8 } }],
});
/** elite_bond — bond prédictif : vise où le joueur sera à l'atterrissage, puis onde de givre trouée. */
definePattern('elite_bond', (ctx, e, p, t) => {
  const sp = p.speed ?? 260, dur = p.dur ?? 0.38;
  const a = leadAngle(e, t, sp, p.lead ?? 0.8);
  e.data.dash = { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: dur };
  ctx.sfx('dash', 0.6);
  ctx.after(dur + 0.05, () => {
    gapRing(ctx, e, { count: p.count ?? 14, gap: 3, speed: p.ringSpeed ?? 90, sprite: 'eb_w2_flocon', life: 1.6, bullet: { status: { kind: 'slow', dur: 1 } } });
    ctx.shake(3);
  }, e);
});
defineEnemy({
  id: 'elite_louve_alpha', name: 'Louve-Alpha', world: 2, sprite: 'e_elite_louve', hp: 135, speed: 62, radius: 8, contact: 2, cost: 4, minFloor: 4, coins: [3, 6], energy: 2,
  knockbackResist: 0.6,
  move: { kind: 'orbit', range: 80 },
  attacks: [
    { pattern: 'elite_bond', cooldown: 3.4, telegraph: 0.55, range: 200, stop: 0.6, params: { speed: 260, dur: 0.38, count: 14 } },
    { pattern: 'summon', cooldown: 7, first: 1.2, telegraph: 0.6, stop: 0.5, params: { id: 'elite_louveteau', count: 2, max: 4 } },
    { pattern: 'predictif', cooldown: 2.6, telegraph: 0.4, params: { count: 3, spread: 0.4, speed: 120, sprite: 'eb_w2_glacon' } },
  ],
  onUpdate: (ctx, e, dt) => {
    e.data.howl = (e.data.howl ?? 2.5) - dt;
    if (e.data.howl > 0) return;
    e.data.howl = 5.5;
    if (rallyAllies(ctx, e, 150, 1.4, 0x9ae8ff)) { ctx.text(e.x, e.y - 16, 'AOOOUUH !', 0x9ae8ff, true); ctx.shake(2); }
  },
});

// =================================================================== MONDE 3
// ------------------------------------------------------------------ Greffier incandescent : enregistre vos positions… et les fait exploser.
const GREFF = sym([
  '....444', '....455', '...4555', '...4vvv', '..44444', '...ssss', '..sy0ys', '...sSSs', '...skkk',
  '..45555', '.455v55', '4555555', '45ww555', '45wwk55', '.455555', '.45v555', '.455555', '..44.44',
]);
defineSprite('e_elite_greffier', GREFF, {
  frames: [
    rep(GREFF, { 17: '.44.......44..' }),
    swapCh(GREFF, { v: 'y', '0': 'v' }),
    rep(GREFF, { 17: '...44..44.....' }),
  ],
});
/** elite_sceaux — pose `count` sceaux (cercles annoncés) autour de la position future du joueur ; chacun éclate en croix de rayons courts. */
definePattern('elite_sceaux', (ctx, e, p, t) => {
  const n = p.count ?? 3, warn = Math.max(0.6, p.warn ?? 0.9), len = p.length ?? 60;
  const tt = e.target ?? t;
  if (!tt) return;
  const cx = tt.x + (tt.vx ?? 0) * warn * 0.7, cy = tt.y + (tt.vy ?? 0) * warn * 0.7;
  ctx.text(e.x, e.y - 18, 'Enregistré !', 0xffd23a);
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU + ctx.rng.range(0, 1), r = i === 0 ? 0 : ctx.rng.range(28, 50);
    const x = cx + Math.cos(a0) * r, y = cy + Math.sin(a0) * r;
    if (ctx.isSolid(x, y)) continue;
    const rot = ctx.rng.chance(0.5) ? 0 : Math.PI / 4;
    ctx.ring(x, y, 12, 0xffb040);
    for (let k = 0; k < 4; k++) {
      const a = rot + (k / 4) * TAU;
      ctx.spawnBullet({ kind: 'beam', damage: 0, life: warn, width: 1, length: len, color: 0xffb040, data: { warn: true } }, x, y, a, 'enemy', e);
      ctx.after(warn, () => ctx.spawnBullet({ kind: 'beam', damage: p.damage ?? 1, life: 0.2, width: 5, length: len, color: 0xff5030 }, x, y, a, 'enemy', e), e);
    }
    ctx.after(warn, () => { ctx.burst(x, y, 0xffb040, 8, 80, 0.3); }, e);
  }
  ctx.after(warn, () => { ctx.sfx('elaser', 0.5); ctx.shake(2); }, e);
});
defineEnemy({
  id: 'elite_greffier', name: 'Greffier incandescent', world: 3, sprite: 'e_elite_greffier', hp: 180, speed: 34, radius: 7, contact: 1, cost: 4, minFloor: 3, coins: [3, 6], energy: 2,
  immune: ['burn'],
  move: { kind: 'teleport', period: 3, range: 130 },
  attacks: [
    { pattern: 'elite_sceaux', cooldown: 3.6, telegraph: 0.45, stop: 0.5, params: { count: 3, warn: 0.9, length: 60 } },
    { pattern: 'predictif', cooldown: 2.2, telegraph: 0.35, params: { shots: 3, interval: 0.15, speed: 140, sprite: 'eb_w3_ember', mix: true } },
  ],
  // Tient aussi le registre de ses collègues : une bulle de cire chaude protège l'allié le plus proche.
  onUpdate: (ctx, e, dt) => wardAllies(ctx, e, dt, { radius: 120, hits: 8, recharge: 4, color: 0xffb040, self: true }),
});

// ------------------------------------------------------------------ Matrone du creuset : mini-tank ; à mi-vie, le creuset déborde.
const MATRONE = sym([
  '.......444', '......4vvv', '......4yvy', '.......444', '......ssss', '.....sssss', '.....sk0ss', '.....sssss', '.....ssSRR',
  '...VVVVVVV', '..nnNNNNNN', '.snnNnnnnn', 'ssnnNnnvnn', 'ss.nNnnnnn', 's..nNnnnnn', '...nNNNNNN', '...444....', '..4444....',
]);
const MATRONE2 = rep(MATRONE, { 16: '....444......444....', 17: '...4444......4444...' });
defineSprite('e_elite_matrone', MATRONE, { frames: [MATRONE2, swapCh(MATRONE, { v: 'y', y: 'v', '0': 'r' }), swapCh(MATRONE2, { v: 'y', y: 'v' })] });
defineEnemy({
  id: 'elite_matrone', name: 'Matrone du creuset', world: 3, sprite: 'e_elite_matrone', hp: 220, speed: 30, radius: 9, contact: 2, cost: 4, minFloor: 5, coins: [4, 7], energy: 3,
  knockbackResist: 0.9, immune: ['burn'],
  move: { kind: 'chase', range: 30 },
  attacks: [
    { pattern: 'w3_mortar', cooldown: 3.4, telegraph: 0.55, params: { count: 3, scatter: 40, radius: 22, shards: 5, shardSpeed: 100, time: 1.15 } },
    { pattern: 'w3_verdict', cooldown: 4.6, telegraph: 0.6, range: 170, stop: 0.6, params: { speed: 220, dur: 0.4, count: 18, gap: 4, ringSpeed: 100 } },
    { pattern: 'melee', cooldown: 2, telegraph: 0.6, range: 40, stop: 0.5, params: { range: 34, arc: 2.4, damage: 2, color: 0xff7030 } },
    { pattern: 'summon', cooldown: 8, first: 3, telegraph: 0.6, params: { id: 'w3_spark', count: 2, max: 5 } },
  ],
  onHurt: (ctx, e, ev) => {
    if (e.data.boil || e.hp - ev.amount > e.maxHp * 0.5 || e.hp - ev.amount <= 0) return;
    e.data.boil = true;
    e.speed *= 1.35;
    e.attacks = e.attacks.map((a) => ({ ...a, cooldown: a.cooldown * 0.75 }));
    e.data.look = { tint: 0xffb080, aura: 0xff5030 };
    ctx.text(e.x, e.y - 20, 'ÇA DÉBORDE !', 0xff7030, true);
    ctx.shake(4);
  },
  onUpdate: (ctx, e, dt) => {
    if (!e.data.boil) return;
    e.data.pt = (e.data.pt ?? 0.6) - dt;
    if (e.data.pt <= 0) { e.data.pt = 0.7; emberPuddle(ctx, e, e.x, e.y + 6, 2.6); }
  },
});
