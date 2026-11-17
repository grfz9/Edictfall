// Monde 2 — « Glacier Fendu » : bestiaire des cavernes de glace (23 ennemis + 3 invocations).
import { defineEnemy, defineSprite, definePattern } from '../../core/registry';
import type { Enemy } from '../../core/types';
import type { Ctx } from '../../sim/ctx';
import { enemyBullet } from '../../sim/patterns';
import { R } from '../../core/registry';
import { swapCh, wardAllies, rallyAllies } from './w1_patterns';
import { tileAt, T, TILE } from '../../sim/dungeon';

const TAU = Math.PI * 2;

// ------------------------------------------------------------------ outils
/** Sprite symétrique : chaque ligne est la moitié gauche, miroir ajouté à droite. */
export const sym = (rows: string[]): string[] => rows.map((r) => r + r.split('').reverse().join(''));
/** Copie de lignes avec remplacements par index. */
const alt = (rows: string[], rep: Record<number, string>): string[] => rows.map((r, i) => rep[i] ?? r);
/** Échange deux caractères (scintillement de 2e frame). */
const swap = (rows: string[], a: string, b: string): string[] =>
  rows.map((r) => r.split('').map((ch) => (ch === a ? b : ch === b ? a : ch)).join(''));

/** L'ennemi est-il sur une tuile glissante ? */
export function onSlick(ctx: Ctx, e: Enemy): boolean {
  const f = ctx.world.floor;
  return !!f && tileAt(f, Math.floor(e.x / TILE), Math.floor(e.y / TILE)) === T.SLICK;
}
/** Vitesse boostée sur la glace (base mémorisée au spawn). */
function slickBoost(ctx: Ctx, e: Enemy, mult: number): void {
  if (e.data.w2base === undefined) e.data.w2base = e.speed;
  const on = onSlick(ctx, e);
  e.speed = e.data.w2base * (on ? mult : 1);
  if (on && (e.data.w2fx = (e.data.w2fx ?? 0) - 1) <= 0) { e.data.w2fx = 12; ctx.burst(e.x, e.y + 4, 0xd8f0ff, 2, 30, 0.25); }
}

// ------------------------------------------------------------------ balles
defineSprite('eb_w2_glacon', ['.eee...', 'e1iiee.', 'eiiiiee', 'e1iiee.', '.eee...'], { outline: '#5a0a1e' });
defineSprite('eb_w2_flocon', ['.e.e.', 'eeiee', '.iii.', 'eeiee', '.e.e.'], { outline: '#5a0a1e' });

// ------------------------------------------------------------------ patterns personnels
/** w2_eclats — couronne d'échardes, alignée sur la cible (count, speed). */
definePattern('w2_eclats', (ctx, e, p, t) => {
  const n = p.count ?? 6;
  const off = t ? Math.atan2(t.y - e.y, t.x - e.x) + Math.PI / n : ctx.rng.range(0, TAU);
  const spec = enemyBullet(p, { sprite: 'eb_shard', speed: p.speed ?? 95 });
  for (let i = 0; i < n; i++) ctx.spawnBullet(spec, e.x, e.y, off + (i / n) * TAU, 'enemy', e);
  ctx.sfx('ering', 0.4);
});

// ================================================================== ÉTAGE 1 (7)
const PINGOUIN = sym(['...aaa', '..aAAA', '..5555', '.55iii', '.5i0ii', '.5iiio', '55iiii', '55iirr', '.5iiii', '..5iii', '..oo..']);
defineSprite('e_w2_pingouin', PINGOUIN, { frames: [alt(PINGOUIN, { 6: sym(['.5iiii'])[0], 10: sym(['.oo...'])[0] })] });
defineEnemy({
  id: 'w2_pingouin_fusilier', name: 'Pingouin fusilier', world: 2, sprite: 'e_w2_pingouin', hp: 26, speed: 46, radius: 5, contact: 0, cost: 1, minFloor: 1, coins: [0, 2],
  move: { kind: 'keepDistance', range: 100 },
  attacks: [
    { pattern: 'burst', cooldown: 3, telegraph: 0.4, params: { shots: 3, interval: 0.16, speed: 118 } },
    // rafale « intelligente » : une balle sur deux vise où vous allez
    { pattern: 'predictif', cooldown: 3.4, telegraph: 0.4, params: { shots: 4, interval: 0.14, speed: 120, mix: true } },
  ],
});

const YETI = sym(['n.....', 'nniiii', '.i1111', 'i1cccc', 'i1cbcc', 'iicccc', 'IIcrrr', 'IiiIii', 'Iiiiii', '.Iiiii', '.II.II']);
defineSprite('e_w2_yeti', YETI, { frames: [alt(YETI, { 7: sym(['iiiIii'])[0], 10: sym(['..II.I'])[0] })] });
defineEnemy({
  id: 'w2_yeti_nabot', name: 'Yéti nabot', world: 2, sprite: 'e_w2_yeti', hp: 36, speed: 58, radius: 6, contact: 1, cost: 1, minFloor: 1, coins: [0, 2],
  move: { kind: 'chase', range: 16 },
  attacks: [
    { pattern: 'melee', cooldown: 1.4, telegraph: 0.4, range: 34, params: { range: 26, arc: 1.9 } },
    // bond puis claque dans la foulée
    { pattern: 'combo', cooldown: 3.6, telegraph: 0.45, range: 110, params: { steps: [
      { pattern: 'dash', params: { speed: 240, dur: 0.25 } },
      { pattern: 'melee', at: 0.3, params: { range: 28, arc: 2 } },
    ] } },
  ],
});

const FLOCON = sym(['.....c', '.c...c', '..c.ci', '...cIi', '.ccIb1', 'ccIiii', 'ccIiii', '.ccIii', '...cIi', '..c.ci', '.c...c', '.....c']);
defineSprite('e_w2_flocon', FLOCON, { frames: [swap(FLOCON, 'c', 'C')] });
defineEnemy({
  id: 'w2_flocon_errant', name: 'Flocon errant', world: 2, sprite: 'e_w2_flocon', hp: 22, speed: 40, radius: 5, contact: 1, cost: 1, minFloor: 1, coins: [0, 2], phasing: true,
  move: { kind: 'wander', period: 1.4 },
  attacks: [{ pattern: 'ring', cooldown: 3.4, telegraph: 0.5, params: { count: 8, speed: 85, bullet: { sprite: 'eb_w2_flocon', status: { kind: 'freeze', dur: 0.6 } } } }],
});

const LUGE = sym(['...5555', '..55555', '.55i0ii', 'o5iiiii', '.5iiiii', '.5iiiir', 'AAAAAAA', '.A...A.']);
defineSprite('e_w2_luge', LUGE, { frames: [alt(LUGE, { 0: sym(['....555'])[0], 7: sym(['.A..A..'])[0] })] });
defineEnemy({
  id: 'w2_pingouin_luge', name: 'Pingouin-luge', world: 2, sprite: 'e_w2_luge', hp: 29, speed: 45, radius: 6, contact: 1, cost: 1, minFloor: 1, coins: [0, 2],
  move: { kind: 'charge', range: 180, period: 1.2, mult: 4, dur: 0.55 },
  // Sur la glace, la ruée devient franchement dangereuse.
  onUpdate: (ctx, e) => slickBoost(ctx, e, 1.7),
});

const CHAUVE = ['....B..', 'c...BB.', 'cc.BBBB', 'ccCByBB', 'cCCBBBB', '.CCBBik', '..C.BB.', '....B..'];
const CHAUVE2 = ['c...B..', 'cc..BB.', '.cCBBBB', '..CByBB', '...BBBB', '....Bik', '....BB.', '....B..'];
defineSprite('e_w2_chauve', sym(CHAUVE), { frames: [sym(CHAUVE2), sym(swapCh(CHAUVE, { y: 'r' })), sym(swapCh(CHAUVE2, { c: 'i' }))] });
defineEnemy({
  id: 'w2_chauve_givre', name: 'Chauve-givre', world: 2, sprite: 'e_w2_chauve', hp: 19, speed: 98, radius: 5, contact: 1, cost: 1, minFloor: 1, coins: [0, 1], phasing: true,
  move: { kind: 'zigzag' },
  // Piqué : toutes les ~2.5 s, plonge droit sur vous (cri annoncé 0.4 s avant).
  onUpdate: (ctx, e, dt) => {
    const t = e.target;
    if (!t || e.data.diving) return;
    e.data.dive = (e.data.dive ?? 1.5 + ctx.rng.range(0, 1)) - dt;
    if (e.data.dive > 0) return;
    if (Math.hypot(t.x - e.x, t.y - e.y) > 130) { e.data.dive = 0.5; return; }
    e.data.diving = true;
    e.data.windup = 0.4;
    e.stop = 0.4;
    ctx.text(e.x, e.y - 10, 'Kiii !', 0x9ae8ff);
    ctx.after(0.4, () => {
      e.data.windup = 0;
      e.data.diving = false;
      e.data.dive = 2.5;
      const tt = e.target;
      if (!tt) return;
      const a = Math.atan2(tt.y - e.y, tt.x - e.x);
      e.data.dash = { vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, t: 0.32 };
      ctx.sfx('dash', 0.4);
    }, e);
  },
});

const LIEVRE = sym(['.i...', '.Ii..', '.Ii..', '.Ii.i', '..iii', '.i111', '.i1b1', '.i11m', '.iiii', 'iiiii', '.iiii', '.II..']);
defineSprite('e_w2_lievre', LIEVRE, { frames: [alt(LIEVRE, { 1: sym(['Ii...'])[0], 11: sym(['..II.'])[0] })] });
defineEnemy({
  id: 'w2_lievre_givre', name: 'Lièvre des congères', world: 2, sprite: 'e_w2_lievre', hp: 22, speed: 72, radius: 5, contact: 0, cost: 1, minFloor: 1, coins: [0, 2],
  move: { kind: 'flee', range: 95 },
  attacks: [
    { pattern: 'aimed', cooldown: 2.4, telegraph: 0.35, params: { count: 2, spread: 0.3, speed: 112 } },
    { pattern: 'predictif', cooldown: 2.8, telegraph: 0.35, params: { count: 2, spread: 0.18, speed: 118 } },
  ],
});

const CRISTAL = sym(['....p', '...pc', '..pcc', '.pc1c', 'pcc1c', 'pcbcc', 'pcccc', '.pccc', '..pcC', '...pC', '....C']);
defineSprite('e_w2_cristal', CRISTAL, { frames: [swap(CRISTAL, 'c', 'i')] });
defineEnemy({
  id: 'w2_cristal_eclat', name: 'Cristal vivant', world: 2, sprite: 'e_w2_cristal', hp: 31, speed: 50, radius: 5, contact: 1, cost: 1, minFloor: 1, coins: [0, 2],
  move: { kind: 'orbit', range: 75 },
  attacks: [{ pattern: 'cross', cooldown: 2.7, telegraph: 0.45, params: { arms: 4, perArm: 3, speed: 80, sprite: 'eb_shard' } }],
  // Éclate en échardes à sa mort : ne le tuez pas à bout portant.
  onDeath: (ctx, e) => {
    const off = ctx.rng.range(0, TAU);
    const spec = enemyBullet({ speed: 95, sprite: 'eb_shard', life: 2 });
    for (let i = 0; i < 8; i++) ctx.spawnBullet(spec, e.x, e.y, off + (i / 8) * TAU, 'enemy', e);
    ctx.burst(e.x, e.y, 0x9ae8ff, 10, 90, 0.4);
    ctx.sfx('break', 0.6);
  },
});

// ================================================================== ÉTAGE 2 (5)
const PALET = sym(['..AAAA', '.Aaaai', 'Aai0aa', 'Aaaaaa', 'AAaaaa', '5AAAAA', '.55555', '..5555']);
defineSprite('e_w2_palet', PALET, { frames: [alt(PALET, { 1: sym(['.Aiaaa'])[0], 3: sym(['Aaaaai'])[0] })] });
defineEnemy({
  id: 'w2_palet_fou', name: 'Palet fou', world: 2, sprite: 'e_w2_palet', hp: 34, speed: 0, radius: 6, contact: 1, cost: 1, minFloor: 2, coins: [0, 2], knockbackResist: 0.6,
  move: { kind: 'stationary' },
  attacks: [{ pattern: 'w2_eclats', cooldown: 3, telegraph: 0.45, params: { count: 6, speed: 90 } }],
  onSpawn: (ctx, e) => {
    const a = ctx.rng.range(0, TAU);
    e.data.pvx = Math.cos(a) * 78;
    e.data.pvy = Math.sin(a) * 78;
    e.data.pcd = 0;
  },
  // Glisse en ligne droite et rebondit sur les murs ; plus vite sur la glace ; tire à chaque rebond.
  onUpdate: (ctx, e, dt) => {
    if (!(dt > 0)) return;
    const k = onSlick(ctx, e) ? 1.5 : 1;
    const r = e.radius;
    let bounced = false;
    const room = ctx.room && ctx.world.inRoom(ctx.room, e.x, e.y) ? ctx.room : null;
    const ok = (x: number, y: number) => ctx.isFree(x, y, r) && (!room || ctx.world.inRoom(room, x, y));
    const nx = e.x + e.data.pvx * k * dt;
    if (ok(nx, e.y)) e.x = nx; else { e.data.pvx = -e.data.pvx; bounced = true; }
    const ny = e.y + e.data.pvy * k * dt;
    if (ok(e.x, ny)) e.y = ny; else { e.data.pvy = -e.data.pvy; bounced = true; }
    e.data.pcd -= dt;
    if (bounced && e.data.pcd <= 0) {
      e.data.pcd = 0.8;
      ctx.burst(e.x, e.y, 0xd8f0ff, 4, 50, 0.25);
      const t = e.target;
      if (t) ctx.spawnBullet(enemyBullet({ speed: 100 }), e.x, e.y, Math.atan2(t.y - e.y, t.x - e.x), 'enemy', e);
    }
  },
});

const PHOQUE = sym(['.....AA', '....AaA', '..33AAA', '.322222', '3220222', '322222k', '32wwwww', '.3wwwww', '33.3333', '3...33.']);
defineSprite('e_w2_phoque', PHOQUE, { frames: [alt(PHOQUE, { 8: sym(['.3.3333'])[0], 9: sym(['.3..33.'])[0] })] });
defineEnemy({
  id: 'w2_phoque_canon', name: 'Phoque-canon', world: 2, sprite: 'e_w2_phoque', hp: 54, speed: 40, radius: 7, contact: 1, cost: 2, minFloor: 2, coins: [1, 3],
  move: { kind: 'hop', period: 1.1, mult: 2.2, dur: 0.3 },
  attacks: [
    { pattern: 'lob', cooldown: 3, telegraph: 0.5, params: { count: 2, scatter: 24, radius: 20, time: 1, status: { kind: 'slow', dur: 1.2 } } },
    { pattern: 'lobPredictif', cooldown: 3.6, telegraph: 0.5, params: { count: 1, radius: 22, time: 1, lead: 1, mark: 0x9ae8ff, status: { kind: 'slow', dur: 1.2 } } },
  ],
});

const ESPRIT = sym(['...ccc', '..cii1', '.ci111', 'ci1b11', 'ci1111', 'ci11kk', 'ciiiii', 'cIiiii', 'cIiIii', '.IiIIi', '.c.Ic.', '....c.']);
defineSprite('e_w2_esprit', ESPRIT, { frames: [alt(ESPRIT, { 10: sym(['..cI.c'])[0], 11: sym(['.c....'])[0] })] });
defineEnemy({
  id: 'w2_esprit_givre', name: 'Esprit du givre', world: 2, sprite: 'e_w2_esprit', hp: 29, speed: 30, radius: 5, contact: 0, cost: 1, minFloor: 2, coins: [0, 2], phasing: true,
  move: { kind: 'teleport', period: 2.4, range: 110 },
  attacks: [{ pattern: 'homing', cooldown: 2.6, telegraph: 0.45, params: { count: 1, turn: 1.6, speed: 85, bullet: { sprite: 'eb_w2_flocon', status: { kind: 'freeze', dur: 0.8 } } } }],
});

const STALAG = sym(['.....i', '....iI', '....iI', '...iiI', '...i1I', '..ii1I', '..iiyr', '.iiiyy', '.iiiiI', '.IiiiI', 'IIiiII', 'aAAAAA', 'AAaaaa', '.AAAAA']);
defineSprite('e_w2_stalag', STALAG, { frames: [alt(STALAG, { 6: sym(['..iiyy'])[0], 7: sym(['.iiiII'])[0] })] });
defineEnemy({
  id: 'w2_stalagmite', name: 'Stalagmite guetteuse', world: 2, sprite: 'e_w2_stalag', hp: 48, speed: 0, radius: 6, contact: 1, cost: 2, minFloor: 2, coins: [1, 3], knockbackResist: 1,
  move: { kind: 'stationary' },
  attacks: [{ pattern: 'spiral', cooldown: 3.3, telegraph: 0.5, params: { arms: 2, shots: 16, interval: 0.1, step: 0.35, speed: 90, sprite: 'eb_w2_glacon' } }],
});

const BONHOMME = sym(['...kkk', '...kkk', '..rrrr', '..1111', '.11011', '.1111o', '..1111', '.oooOo', '.11111', '1111b1', '111111', '111111', '.11111', '..1111']);
defineSprite('e_w2_bonhomme', BONHOMME, { frames: [alt(BONHOMME, { 8: sym(['n11111'])[0], 2: sym(['..rrro'])[0] })] });
defineEnemy({
  id: 'w2_bonhomme', name: 'Bonhomme de rancune', world: 2, sprite: 'e_w2_bonhomme', hp: 53, speed: 26, radius: 7, contact: 1, cost: 2, minFloor: 2, coins: [1, 3],
  move: { kind: 'chase', range: 40 },
  attacks: [
    { pattern: 'spread', cooldown: 2.8, telegraph: 0.45, params: { count: 5, spread: 0.9, speed: 96 } },
    { pattern: 'combo', cooldown: 3.4, telegraph: 0.45, params: { steps: [
      { pattern: 'aimed', params: { count: 3, spread: 0.4, speed: 100 } },
      { pattern: 'predictif', at: 0.35, params: { speed: 110 } },
    ] } },
  ],
  // Grossit avec le temps (taille + PV), puis se scinde en deux boules à sa mort.
  onUpdate: (ctx, e, dt) => {
    if (e.data.s0 === undefined) e.data.s0 = e.scale;
    if (e.scale < e.data.s0 * 1.5) {
      e.scale = Math.min(e.data.s0 * 1.5, e.scale + e.data.s0 * 0.035 * dt);
      e.data.gh = (e.data.gh ?? 0) + dt;
      if (e.data.gh >= 1) { e.data.gh -= 1; e.maxHp += 1.5; e.hp += 1.5; }
    }
  },
  onDeath: (ctx, e) => {
    for (let i = 0; i < 2; i++) {
      const a = ctx.rng.range(0, TAU), x = e.x + Math.cos(a) * 10, y = e.y + Math.sin(a) * 10;
      ctx.spawnEnemy('w2_boule', ctx.isSolid(x, y) ? e.x : x, ctx.isSolid(x, y) ? e.y : y, { summoned: true, delay: 0.3 });
    }
  },
});

// ================================================================== ÉTAGE 3 (5)
const PATINEUR = sym(['...ppp', '..pPPP', '..Pccc', '..cbcc', '..cccc', '.pPPPP', 'p.pPPP', '..pPPP', '..PP.P', '..P..P', '.aaa.a']);
defineSprite('e_w2_patineur', PATINEUR, { frames: [alt(PATINEUR, { 6: sym(['.ppPPP'])[0], 9: sym(['...P.P'])[0], 10: sym(['..aaa.'])[0] })] });
defineEnemy({
  id: 'w2_patineur', name: 'Patineur spectral', world: 2, sprite: 'e_w2_patineur', hp: 36, speed: 60, radius: 5, contact: 1, cost: 1, minFloor: 3, coins: [0, 2],
  move: { kind: 'zigzag' },
  attacks: [{ pattern: 'spray', cooldown: 2.5, telegraph: 0.4, range: 180, params: { shots: 9, arc: 0.9, interval: 0.07, speed: 115 } }],
  onUpdate: (ctx, e) => slickBoost(ctx, e, 1.8),
});

const SNIPER = sym(['..aaaa', '.aAAAA', '.55555', '.5yyii', '.5yyii', '.5iiio', '55iiii', '55iiii', '.5iiii', '..5iii', '..oo..']);
defineSprite('e_w2_sniper', SNIPER, { frames: [alt(SNIPER, { 3: sym(['.5yrii'])[0], 10: sym(['.oo...'])[0] })] });
defineEnemy({
  id: 'w2_pingouin_lunette', name: 'Pingouin à lunette', world: 2, sprite: 'e_w2_sniper', hp: 41, speed: 40, radius: 5, contact: 0, cost: 2, minFloor: 3, coins: [1, 3],
  move: { kind: 'keepDistance', range: 150 },
  attacks: [
    { pattern: 'laser', cooldown: 4.4, telegraph: 0.5, stop: 1.4, range: 320, params: { warn: 0.9, damage: 2, width: 4, length: 320, color: 0xff6688 } },
    { pattern: 'predictif', cooldown: 2, telegraph: 0.35, params: { speed: 130, lead: 1 } },
  ],
});

const AUTOMATE = sym(['.....y', '.....A', '.AAAAA', '.Aaaaa', '.Aayaa', '.Aaaaa', '.AAkkk', 'AAiAAA', 'Aaiiaa', 'Aaaaaa', '.AaAAA', '.44.44']);
defineSprite('e_w2_automate', AUTOMATE, { frames: [alt(AUTOMATE, { 0: sym(['.....r'])[0], 11: sym(['..44.4'])[0] })] });
defineEnemy({
  id: 'w2_automate_gele', name: 'Automate dégivreur', world: 2, sprite: 'e_w2_automate', hp: 72, speed: 30, radius: 7, contact: 1, cost: 2, minFloor: 3, coins: [1, 3],
  move: { kind: 'wander', period: 1.6 },
  attacks: [{ pattern: 'rings', cooldown: 3.8, telegraph: 0.5, stop: 0.8, params: { waves: 2, count: 10, interval: 0.4, speed: 90 } }],
  // Se régénère s'il n'est pas touché pendant 2.5 s : il faut le harceler.
  onHurt: (_ctx, e) => { e.data.lastHit = e.age; },
  onUpdate: (ctx, e, dt) => {
    if (e.age - (e.data.lastHit ?? 0) > 2.5 && e.hp < e.maxHp) {
      e.hp = Math.min(e.maxHp, e.hp + 5 * dt);
      if ((e.data.rfx = (e.data.rfx ?? 0) - dt) <= 0) { e.data.rfx = 0.5; ctx.burst(e.x, e.y - 6, 0x58d858, 3, 30, 0.4); }
    }
  },
});

const FOREUSE = sym(['......a', '.....aA', '....aaA', '...aAaA', '..ooooo', '.oO0OOO', '.oOOOOO', 'oOiiiii', 'oOOOOOO', '.444444']);
defineSprite('e_w2_foreuse', FOREUSE, { frames: [alt(FOREUSE, { 1: sym(['.....Aa'])[0], 2: sym(['....AAa'])[0], 3: sym(['...AaAa'])[0] })] });
defineEnemy({
  id: 'w2_foreuse_gelee', name: 'Foreuse gelée', world: 2, sprite: 'e_w2_foreuse', hp: 66, speed: 40, radius: 7, contact: 1, cost: 2, minFloor: 3, coins: [1, 3], knockbackResist: 0.5,
  move: { kind: 'charge', range: 160, period: 1.8, mult: 3.4, dur: 0.45 },
  attacks: [{ pattern: 'dash', cooldown: 4.2, telegraph: 0.55, range: 180, params: { speed: 230, dur: 0.35, trail: true, trailLife: 1.4, sprite: 'eb_w2_flocon' } }],
});

const MORSE = sym(['..nnnny', '.nNNNNN', 'nNN0NNN', 'nNNNNNN', 'nNNswss', '.nNNN1.', '.nNN.1.', 'nNNNNNN', 'nNNNNNN', '.NN.NN.']);
defineSprite('e_w2_morse', MORSE, { frames: [alt(MORSE, { 0: sym(['..nnnno'])[0], 9: sym(['..NN.N.'])[0] })] });
defineEnemy({
  id: 'w2_morse_mineur', name: 'Morse mineur', world: 2, sprite: 'e_w2_morse', hp: 70, speed: 32, radius: 7, contact: 1, cost: 2, minFloor: 3, coins: [1, 4],
  move: { kind: 'wander', period: 1.5 },
  attacks: [
    { pattern: 'mines', cooldown: 3.6, telegraph: 0.4, params: { count: 4, scatter: 30, life: 7, sprite: 'eb_w2_flocon' } },
    { pattern: 'aimed', cooldown: 2, telegraph: 0.35, params: { speed: 105 } },
  ],
});

// ================================================================== ÉTAGE 4 (4)
const AURORE = sym(['....g', '...gt', '..gtc', '.gtcc', 'gtb1c', 'gtccc', '.gtcc', '..gtc', '...tg', '....t']);
defineSprite('e_w2_aurore', AURORE, { frames: [swap(AURORE, 'g', 't')] });
defineEnemy({
  id: 'w2_feu_aurore', name: 'Feu d\'aurore', world: 2, sprite: 'e_w2_aurore', hp: 31, speed: 55, radius: 5, contact: 0, cost: 1, minFloor: 4, coins: [0, 2], phasing: true,
  move: { kind: 'orbit', range: 85 },
  attacks: [{ pattern: 'homing', cooldown: 3, telegraph: 0.45, params: { count: 2, turn: 1.5, speed: 82 } }],
  // Drape un allié d'un voile d'aurore qui avale vos 6 prochains tirs.
  onUpdate: (ctx, e, dt) => wardAllies(ctx, e, dt, { radius: 110, hits: 6, recharge: 4, color: 0x58d8a8 }),
});

const GOLEM = sym(['...IIIII', '..IiiiiI', '..Ii0iii', '..Iiiiii', '..IIIkkk', '.ccIIIII', 'cCccIiii', 'cCccIiii', 'cCccIIii', 'cCccIiii', 'cCccIIIi', '.ccIIiii', '...IIiii', '...IIIII', '...III..', '..IIII..']);
defineSprite('e_w2_golem', GOLEM, { frames: [alt(GOLEM, { 14: sym(['....III.'])[0], 15: sym(['...IIII.'])[0] })] });
defineEnemy({
  id: 'w2_golem_bouclier', name: 'Golem au pavois', world: 2, sprite: 'e_w2_golem', hp: 120, speed: 30, radius: 8, contact: 1, cost: 3, minFloor: 4, coins: [2, 5], knockbackResist: 0.8,
  move: { kind: 'chase', range: 10 },
  attacks: [{ pattern: 'wall', cooldown: 3.6, telegraph: 0.55, stop: 0.5, params: { count: 9, spacing: 13, speed: 85, gapWidth: 2 } }],
  onSpawn: (_ctx, e) => { e.data.shield = 40; },
  // Pavois de glace : absorbe tout jusqu'à rupture, puis le golem s'énerve.
  onHurt: (ctx, e, ev) => {
    if (!(e.data.shield > 0) || ev.cause === 'status') return;
    const a = Math.min(e.data.shield, ev.amount);
    e.data.shield -= a;
    ev.amount -= a;
    ctx.burst(e.x, e.y, 0x9ae8ff, 2, 40, 0.2);
    if (e.data.shield <= 0) {
      ctx.text(e.x, e.y - 14, 'CRAC !', 0x9ae8ff, true);
      ctx.burst(e.x, e.y, 0xd8f0ff, 14, 110, 0.5, 2);
      ctx.sfx('break', 0.8);
      ctx.shake(3);
      e.speed *= 1.45;
      e.attacks = [...e.attacks, { pattern: 'melee', cooldown: 1.5, telegraph: 0.45, range: 36, params: { range: 28, arc: 2 } }];
      e.atkCd.push(0.6);
    }
  },
});

const SOUFFLEUR = sym(['...iiii', '.ii1111', 'i111111', 'i11b111', 'i111111', 'i1111kk', '.iiIIII', '..I.c.c', '.c.c.c.', '..c...c']);
defineSprite('e_w2_souffleur', SOUFFLEUR, { frames: [alt(SOUFFLEUR, { 7: sym(['..Ic.c.'])[0], 8: sym(['..c.c.c'])[0], 9: sym(['.c...c.'])[0] })] });
defineEnemy({
  id: 'w2_souffleur', name: 'Souffle-blizzard', world: 2, sprite: 'e_w2_souffleur', hp: 72, speed: 35, radius: 7, contact: 0, cost: 3, minFloor: 4, coins: [1, 4], phasing: true,
  move: { kind: 'keepDistance', range: 120 },
  attacks: [
    { pattern: 'summon', cooldown: 6, first: 2, telegraph: 0.6, params: { id: 'w2_floconnet', count: 2, max: 5 } },
    { pattern: 'aimed', cooldown: 2.4, telegraph: 0.4, params: { count: 3, spread: 0.5, speed: 105, bullet: { wave: { amp: 10, freq: 6 } } } },
  ],
});

const CANON = sym(['.....Aa', '.....Aa', '....AAa', '..iiAAa', '.iIIAaa', 'iII4444', 'iI4y444', 'iI44444', '.444444', '4i4i4i4', '5555555']);
defineSprite('e_w2_canon', CANON, { frames: [alt(CANON, { 0: '..............', 6: sym(['iI4r444'])[0] })] });
defineEnemy({
  id: 'w2_canon_gele', name: 'Canon de banquise', world: 2, sprite: 'e_w2_canon', hp: 60, speed: 0, radius: 7, contact: 1, cost: 2, minFloor: 4, coins: [1, 3], knockbackResist: 1,
  move: { kind: 'stationary' },
  attacks: [
    { pattern: 'wall', cooldown: 3.4, telegraph: 0.5, params: { count: 9, spacing: 14, speed: 90, gapWidth: 2, sprite: 'eb_w2_glacon' } },
    { pattern: 'w2_eclats', cooldown: 2.6, telegraph: 0.4, params: { count: 5, speed: 100 } },
  ],
});

// ================================================================== ÉTAGE 5 (2)
const HURLEUR = sym(['n.......', 'nn..iiii', '.niii111', '..i11111', '.i11cccc', '.i1cbccc', 'ii1ccccc', 'iiccwrwr', 'Iiicrrrr', 'IIiiiiii', 'IIIiiiii', 'IiIiiiii', '.IIiiiii', '.IIIiiiI', '..IIII.I', '.IIII...']);
defineSprite('e_w2_hurleur', HURLEUR, { frames: [alt(HURLEUR, { 7: sym(['iicccccc'])[0], 14: sym(['...III.I'])[0], 15: sym(['..IIII..'])[0] })] });
defineEnemy({
  id: 'w2_yeti_hurleur', name: 'Yéti hurleur', world: 2, sprite: 'e_w2_hurleur', hp: 140, speed: 38, radius: 9, contact: 1, cost: 4, minFloor: 5, coins: [3, 6], energy: 2, knockbackResist: 0.7,
  move: { kind: 'chase', range: 20 },
  attacks: [
    { pattern: 'rain', cooldown: 4.4, telegraph: 0.6, stop: 0.6, params: { count: 7, area: 70, interval: 0.12, time: 1.1, radius: 18, sprite: 'eb_w2_glacon' } },
    { pattern: 'melee', cooldown: 2.4, telegraph: 0.6, range: 46, stop: 0.5, params: { damage: 2, range: 32, arc: 2.2 } },
    { pattern: 'ring', cooldown: 3.6, telegraph: 0.5, params: { count: 15, speed: 92 } },
  ],
  // Hurlement : toute la meute recharge ses attaques d'un coup.
  onUpdate: (ctx, e, dt) => {
    e.data.howl = (e.data.howl ?? 3) - dt;
    if (e.data.howl > 0) return;
    e.data.howl = 6.5;
    if (rallyAllies(ctx, e, 140, 1.5, 0x9ae8ff)) { ctx.text(e.x, e.y - 18, 'AOUUUH !', 0x9ae8ff, true); ctx.shake(2); }
  },
});

const SPECTRE = sym(['.....P', '....PP', '...PPp', '..PPpp', '..Pccb', '..Pccc', '.PPPpp', 'PPpPpp', '.PpPpp', '..PPpp', '.PPPpp', 'PP.PPp', 'P..P.P']);
defineSprite('e_w2_spectre', SPECTRE, { frames: [alt(SPECTRE, { 11: sym(['.PP.Pp'])[0], 12: sym(['.P..P.'])[0] })] });
defineEnemy({
  id: 'w2_spectre_blizzard', name: 'Spectre de blizzard', world: 2, sprite: 'e_w2_spectre', hp: 60, speed: 45, radius: 6, contact: 0, cost: 3, minFloor: 5, coins: [1, 4], phasing: true,
  move: { kind: 'orbit', range: 110 },
  attacks: [
    { pattern: 'blink', cooldown: 3.6, telegraph: 0.5, params: { min: 55, max: 90, delay: 0.45, then: { count: 10, speed: 90, sprite: 'eb_w2_flocon' } } },
    { pattern: 'burst', cooldown: 2.3, telegraph: 0.4, params: { shots: 3, interval: 0.15, speed: 122 } },
    { pattern: 'predictif', cooldown: 3, telegraph: 0.35, params: { shots: 2, interval: 0.2, speed: 125 } },
  ],
});

// ================================================================== invocations (world 0)
const ROUAGE = sym(['..a.a', '.aAAA', 'aAAaa', '.Aa0a', 'aAaaa', 'aAaaa', '.Aaaa', 'aAAaa', '.aAAA', '..a.a']);
defineSprite('e_w2_rouage', ROUAGE, { frames: [alt(ROUAGE, { 0: sym(['.a.a.'])[0], 9: sym(['.a.a.'])[0] })] });
defineEnemy({
  id: 'w2_rouage', name: 'Rouage fugueur', world: 0, sprite: 'e_w2_rouage', hp: 19, speed: 55, radius: 5, contact: 1, coins: [0, 0], energy: 0, noChampion: true,
  move: { kind: 'chase' },
});

const FLOCONNET = sym(['...c', '.c.c', '..ci', '.cbi', 'cci1', '.cii', '.c.c', '...c']);
defineSprite('e_w2_floconnet', FLOCONNET, { frames: [swap(FLOCONNET, 'c', 'C')] });
defineEnemy({
  id: 'w2_floconnet', name: 'Floconnet', world: 0, sprite: 'e_w2_floconnet', hp: 14, speed: 84, radius: 4, contact: 1, coins: [0, 0], energy: 0, noChampion: true, phasing: true,
  move: { kind: 'zigzag' },
});

const BOULE = sym(['..111', '.1111', '11011', '11111', '1111o', '11111', '11111', '.1111', '..111']);
defineSprite('e_w2_boule', BOULE, { frames: [sym(['.....', '..111', '.1111', '11011', '1111o', '11111', '11111', '.1111', '..111'])] });
defineEnemy({
  id: 'w2_boule', name: 'Boule rancunière', world: 0, sprite: 'e_w2_boule', hp: 19, speed: 50, radius: 5, contact: 1, coins: [0, 0], energy: 0, noChampion: true,
  move: { kind: 'hop', period: 0.7, mult: 2.4, dur: 0.28 },
});

// ================================================================== v2 : frames supplémentaires (regard qui s'allume, scintillement)
const EXTRA: [string, Record<string, string>][] = [
  ['e_w2_pingouin', { i: '1', b: 'r' }], ['e_w2_yeti', { b: 'r', c: 'C' }], ['e_w2_flocon', { b: 'y', i: '1' }], ['e_w2_luge', { '0': 'r' }],
  ['e_w2_lievre', { b: 'r', m: 'r' }], ['e_w2_cristal', { p: 'P', b: 'y' }], ['e_w2_palet', { '0': 'r' }], ['e_w2_phoque', { '0': 'b' }],
  ['e_w2_esprit', { i: '1', b: 'y' }], ['e_w2_stalag', { y: 'v', r: 'y' }], ['e_w2_bonhomme', { '0': 'r' }], ['e_w2_patineur', { b: 'y', p: 'P' }],
  ['e_w2_sniper', { y: 'r' }], ['e_w2_automate', { y: 'r' }], ['e_w2_foreuse', { '0': 'r', o: 'v' }], ['e_w2_morse', { '0': 'r' }],
  ['e_w2_aurore', { b: 'y', c: 'i' }], ['e_w2_golem', { '0': 'b' }], ['e_w2_souffleur', { b: 'y' }], ['e_w2_canon', { y: 'r' }],
  ['e_w2_hurleur', { b: 'r', w: '1' }], ['e_w2_spectre', { b: 'y', c: 'i' }], ['e_w2_rouage', { '0': 'r' }], ['e_w2_floconnet', { b: 'y' }],
  ['e_w2_boule', { '0': 'r' }],
];
for (const [id, m] of EXTRA) {
  const sp = R.sprites.get(id);
  if (!sp || (sp.frames?.length ?? 0) >= 3) continue;
  const f1 = sp.frames?.[0] ?? sp.px;
  sp.frames = [f1, swapCh(sp.px, m), swapCh(f1, m)];
}
