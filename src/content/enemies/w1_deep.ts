// Monde 1 « Sylve Murmurante » — cœur de la forêt (étages 3-5) et invocations. v2 : sprites 4 frames, soutien entre ennemis.
import { defineEnemy, defineSprite } from '../../core/registry';
import type { Bullet, Enemy } from '../../core/types';
import { sym, sporeRing, rep, swapCh, up1, down1, wardAllies, rallyAllies } from './w1_patterns';

/** Pattes qui gigotent : échange les 2 premières et 2 dernières colonnes. */
const wiggle = (rows: string[]) => rows.map((r) => r[1] + r[0] + r.slice(2, -2) + r[r.length - 1] + r[r.length - 2]);

// ------------------------------------------------------------------ Souchon (invocation : petit rejeton de souche)
const SOUCHON = sym(['...g', '.NNN', 'Nkkn', 'N10n', 'Nnnk', '.NNN', 'd..d']);
defineSprite('e_souchon', SOUCHON, {
  frames: [rep(SOUCHON, { 6: '.d.dd.d.' }), swapCh(SOUCHON, { '0': 'k', '1': 'n' }), rep(SOUCHON, { 6: 'd.d..d.d' })],
});
defineEnemy({
  id: 'w1_souchon', name: 'Souchon', world: 0, sprite: 'e_souchon', hp: 10, speed: 74, radius: 4, contact: 1, coins: [0, 0], energy: 0, noChampion: true,
  move: { kind: 'chase' },
});

// ------------------------------------------------------------------ Souchette (se divise en deux souchons)
const SOUCHE = sym(['....g.', '...lgG', '.NNNNN', 'NnnNnn', 'Nnkknn', 'Nn10nn', 'Nnnnnn', 'Nnnkkk', 'Nnnnnn', 'NNnnnn', '.NdNNd', 'd.d..d']);
defineSprite('e_souchette', SOUCHE, {
  frames: [
    rep(SOUCHE, { 11: '.d.d....d.d.' }),
    swapCh(SOUCHE, { '0': 'k', '1': 'n' }),
    rep(SOUCHE, { 0: '.....g......', 11: 'd..d....d..d' }),
  ],
});
defineEnemy({
  id: 'souchette', name: 'Souche bougonne', world: 1, sprite: 'e_souchette', hp: 36, speed: 44, radius: 7, contact: 1, cost: 2, minFloor: 3, coins: [1, 3],
  knockbackResist: 0.5,
  move: { kind: 'chase', range: 18 },
  attacks: [
    { pattern: 'melee', cooldown: 1.6, telegraph: 0.4, range: 34, stop: 0.3, params: { range: 28, arc: 1.7 } },
    { pattern: 'aimed', cooldown: 2.8, telegraph: 0.4, params: { count: 2, spread: 0.35, speed: 88 } },
    // racine-dard : une écharde sur votre trajectoire
    { pattern: 'predictif', cooldown: 3.6, telegraph: 0.4, params: { speed: 100, sprite: 'eb_shard' } },
  ],
  onDeath: (ctx, e) => {
    for (const s of [-1, 1]) {
      const x = e.x + s * 8, y = e.y;
      ctx.spawnEnemy('w1_souchon', ctx.isSolid(x, y) ? e.x : x, y, { summoned: true, delay: 0.25 });
    }
    ctx.burst(e.x, e.y, 0xb98a52, 10, 70, 0.4, 2);
  },
});

// ------------------------------------------------------------------ Druidelle (soigne ET protège ses voisins d'une bulle de sève)
const DRUI = sym(['n..n..', '.nn...', '..ffff', '.fFFFF', '.Fssss', '.Fs0ss', '.Fsmss', '..sssk', '.ffgff', 'ffgfff', 'fFffff', 'fFfFff', '.FFFFF', '..d...']);
defineSprite('e_druide', DRUI, {
  frames: [
    rep(DRUI, { 13: '...d....d...' }),
    swapCh(DRUI, { g: 'l', m: 'r' }),
    rep(DRUI, { 0: '.n..n..n..n.' }),
  ],
});
defineEnemy({
  id: 'druidelle', name: 'Druidelle rebouteuse', world: 1, sprite: 'e_druide', hp: 24, speed: 46, radius: 6, contact: 0, cost: 2, minFloor: 3, coins: [1, 4],
  move: { kind: 'keepDistance', range: 120 },
  attacks: [{ pattern: 'ring', cooldown: 3, telegraph: 0.45, params: { count: 9, speed: 78 } }],
  onSpawn: (_ctx, e) => { e.data.healT = 2; },
  onUpdate: (ctx, e, dt) => {
    // bulle de sève sur l'allié le plus proche : 5 tirs encaissés puis elle crève
    wardAllies(ctx, e, dt, { radius: 95, hits: 5, recharge: 4.5, color: 0x6ee06e });
    e.data.healT = (e.data.healT ?? 2) - dt;
    if (e.data.healT > 0) return;
    e.data.healT = 2.6;
    let healed = false;
    for (const o of ctx.enemiesIn(e.x, e.y, 75)) {
      if (o === e || o.def.boss || o.hp >= o.maxHp) continue;
      o.hp = Math.min(o.maxHp, o.hp + Math.max(3, o.maxHp * 0.15));
      ctx.burst(o.x, o.y, 0x6ee06e, 6, 40, 0.5);
      healed = true;
    }
    if (healed) { ctx.ring(e.x, e.y, 75, 0x6ee06e); ctx.sfx('heal', 0.3); }
  },
});

// ------------------------------------------------------------------ Cerf-esprit (rayon annoncé, puis éventail qui coupe la fuite)
const CERF = sym(['c.c....', '.c.c...', '..cc...', '....iii', '...i0ii', '....iii', '..iiiii', '.iIiiii', '.iIIiii', '.iIiIii', '.I..I..']);
defineSprite('e_cerf', CERF, {
  frames: [
    rep(CERF, { 10: '..I..I....I..I' }),
    swapCh(CERF, { c: 'C', '0': 'b' }),
    rep(CERF, { 10: '.I...I....I...' }),
  ],
  outline: '#1a3050',
});
defineEnemy({
  id: 'cerf_esprit', name: 'Cerf des brumes', world: 1, sprite: 'e_cerf', hp: 34, speed: 54, radius: 7, contact: 0, cost: 2, minFloor: 3, coins: [1, 4],
  phasing: true,
  move: { kind: 'keepDistance', range: 130 },
  attacks: [
    { pattern: 'laser', cooldown: 4, telegraph: 0.4, stop: 1.1, params: { warn: 0.7, width: 5, damage: 1, length: 260, color: 0x9ae8ff } },
    // éventail, puis une flèche de brume sur votre trajectoire
    { pattern: 'combo', cooldown: 2.6, telegraph: 0.4, params: { steps: [
      { pattern: 'spread', params: { count: 3, spread: 0.5, speed: 92 } },
      { pattern: 'predictif', at: 0.3, params: { speed: 105 } },
    ] } },
  ],
});

// ------------------------------------------------------------------ Tisseuse (toiles collantes + crachat anticipé)
const TISS = sym(['0......', '.0..PPP', '0.0PPpp', '.0PpPpp', '0.Pr1pr', '.0PpppR', '0.PPppp', '.0.PPPP', '0...m.k', '.0.....']);
const TISS2 = wiggle(TISS);
defineSprite('e_tisseuse', TISS, { frames: [TISS2, swapCh(TISS, { r: 'e', R: 'r' }), swapCh(TISS2, { r: 'e' })] });
defineEnemy({
  id: 'tisseuse', name: 'Tisseuse de ronces', world: 1, sprite: 'e_tisseuse', hp: 24, speed: 56, radius: 6, contact: 1, cost: 1, minFloor: 3, coins: [0, 3],
  move: { kind: 'wander', period: 1 },
  attacks: [
    { pattern: 'mines', cooldown: 3.8, telegraph: 0.4, params: { count: 3, scatter: 30, life: 5, bullet: { status: { kind: 'slow', dur: 1.5 }, radius: 4 } } },
    { pattern: 'predictif', cooldown: 2.2, telegraph: 0.35, params: { count: 2, spread: 0.25, speed: 98, lead: 0.8 } },
  ],
});

// ------------------------------------------------------------------ Garde-écorce (bouclier frontal ; parade puis riposte)
const BARK = [
  '....NNNN......', '...NnnnnN.....', '...Nn0n0N.aa..', '...NnnnnN.aAa.', '..dNNNNNNdaAAa', '.dNnnnnnNdaAAa',
  '.dNnnnnnNdaAAa', '.dNnnnnnNdaAAa', '..NnnnnnN.aAa.', '..NNNNNNN..a..',
];
defineSprite('e_garde_ecorce', [...BARK, '..dd...dd.....'], {
  frames: [[...BARK, '...dd.dd......'], [...swapCh(BARK, { '0': 'r' }), '..dd...dd.....'], [...BARK, '.dd.....dd....']],
});
defineEnemy({
  id: 'garde_ecorce', name: 'Garde-écorce', world: 1, sprite: 'e_garde_ecorce', hp: 48, speed: 34, radius: 7, contact: 1, cost: 3, minFloor: 4, coins: [2, 4],
  knockbackResist: 0.8,
  move: { kind: 'chase', range: 22 },
  attacks: [
    { pattern: 'wall', cooldown: 3.4, telegraph: 0.5, stop: 0.4, params: { count: 9, spacing: 14, speed: 78, gapWidth: 2 } },
    { pattern: 'melee', cooldown: 1.5, telegraph: 0.4, range: 34, params: { range: 30, arc: 1.8 } },
  ],
  // Le bouclier encaisse les tirs de face. Chaque série de 4 parades déclenche une riposte d'échardes.
  onHurt: (ctx, e, ev) => {
    if (ev.cause !== 'bullet' && ev.cause !== 'melee') return;
    const b = ev.source as Bullet | null;
    const t = e.target;
    if (!b || !t) return;
    const fromA = Math.atan2(b.sy - e.y, b.sx - e.x), faceA = Math.atan2(t.y - e.y, t.x - e.x);
    let d = Math.abs(fromA - faceA) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    if (d < 1.1) {
      ev.amount *= 0.15;
      e.data.clang = (e.data.clang ?? 0) + 1;
      if (e.data.clang % 3 === 1) { ctx.burst(e.x + Math.cos(faceA) * 7, e.y + Math.sin(faceA) * 7, 0xc8d0e0, 4, 60, 0.2); ctx.sfx('armor', 0.25); }
      if (e.data.clang % 8 === 0) {
        ctx.text(e.x, e.y - 14, 'Riposte !', 0xc8d0e0);
        for (const o of [-0.3, 0, 0.3]) ctx.spawnBullet({ damage: 1, speed: 100, sprite: 'eb_shard', radius: 3, life: 2 }, e.x, e.y, faceA + o, 'enemy', e);
      }
    }
  },
});

// ------------------------------------------------------------------ Vesse-de-loup (kamikaze : sprinte quand il vous sent)
const VESSE = sym(['...www', '.ww1ww', 'w11www', 'wwwwww', 'w0wwww', 'wwwkkk', 'Swwkrr', 'SSwwkk', '.SSwww', '..SSSS', '...S.S']);
defineSprite('e_vesse', VESSE, { frames: [down1(VESSE), swapCh(VESSE, { '0': 'r' }), up1(VESSE)] });
function vesseBoom(ctx: import('../../sim/ctx').Ctx, e: Enemy): void {
  e.data.boom = true;
  ctx.explode(e.x, e.y, 32, 1, 'enemy');
  ctx.burst(e.x, e.y, 0xd8c890, 16, 90, 0.6, 2);
  sporeRing(ctx, e, 6, 55, 1.5);
  ctx.killEnemy(e);
}
defineEnemy({
  id: 'vesse_de_loup', name: 'Vesse-de-loup kamikaze', world: 1, sprite: 'e_vesse', hp: 12, speed: 92, radius: 5, contact: 0, cost: 1, minFloor: 4, coins: [0, 2],
  noChampion: true,
  move: { kind: 'chase' },
  onUpdate: (ctx, e, dt) => {
    const t = e.target;
    if (e.data.fuse === undefined) {
      if (e.data.base === undefined) e.data.base = e.speed;
      const d = t ? Math.hypot(t.x - e.x, t.y - e.y) : 999;
      // à l'odeur : sprint final
      e.speed = e.data.base * (d < 90 ? 1.35 : 1);
      if (d < 30) {
        e.data.fuse = 0.55; // mèche : le temps de s'écarter
        e.stop = 1;
        e.data.look = { tint: 0xff8080 };
        ctx.text(e.x, e.y - 10, '!', 0xff5566, true);
        ctx.ring(e.x, e.y, 32, 0xff5566);
        ctx.sfx('dash', 0.4);
      }
      return;
    }
    e.data.fuse -= dt;
    e.stop = 1;
    if (Math.floor(e.data.fuse * 14) % 2 === 0) e.flash = 0.05;
    if (e.data.fuse <= 0 && !e.data.boom) vesseBoom(ctx, e);
  },
  onDeath: (ctx, e) => { if (!e.data.boom) sporeRing(ctx, e, 5, 40, 2); },
});

// ------------------------------------------------------------------ Moucheron (invocation de la ruche)
const MOUCH = sym(['c...', 'cc.d', '.ddd', '.d1r', '..dd']);
defineSprite('e_moucheron', MOUCH, { frames: [sym(['....', 'cc..', 'cddd', '.d1r', '..dd']), swapCh(MOUCH, { r: 'e' }), sym(['....', '.c..', 'cddd', '.d1r', '..dd'])] });
defineEnemy({
  id: 'w1_moucheron', name: 'Moucheron', world: 0, sprite: 'e_moucheron', hp: 7, speed: 88, radius: 4, contact: 1, coins: [0, 0], energy: 0, noChampion: true,
  phasing: true,
  move: { kind: 'zigzag' },
});

// ------------------------------------------------------------------ Ruche ambulante (invoque + nuée ; ses moucherons foncent quand elle bourdonne)
const RUCHE = sym(['....YYY', '..YYyyy', '.Yyyyyy', '.YNNNNN', 'Yyyyyyy', 'YNNNNkk', 'Yyyyyyy', '.YNNNNN', '.Yyyyyy', '..YYYYY', '....n..']);
const RUCHE2 = sym(['.....YY', '...YYyy', '.YYyyyy', '.YNNNNN', 'Yyyyyyy', 'YNNNNkk', 'Yyyyyyy', '.YNNNNN', '.Yyyyyy', '..YYYYY', '...n...']);
defineSprite('e_ruche', RUCHE, { frames: [RUCHE2, swapCh(RUCHE, { k: 'o' }), swapCh(RUCHE2, { y: 'Y', Y: 'y' })] });
defineEnemy({
  id: 'ruche', name: 'Ruche vagabonde', world: 1, sprite: 'e_ruche', hp: 60, speed: 26, radius: 8, contact: 1, cost: 3, minFloor: 4, coins: [2, 5],
  knockbackResist: 0.6,
  move: { kind: 'wander', period: 1.8 },
  attacks: [
    { pattern: 'summon', cooldown: 5.5, first: 1.5, telegraph: 0.6, stop: 0.4, params: { id: 'w1_moucheron', count: 2, max: 5 } },
    { pattern: 'spray', cooldown: 3.6, telegraph: 0.45, params: { shots: 9, arc: 1, interval: 0.09, speed: 88, sprite: 'eb_small' } },
  ],
  onUpdate: (ctx, e, dt) => {
    e.data.buzz = (e.data.buzz ?? 3) - dt;
    if (e.data.buzz > 0) return;
    e.data.buzz = 4;
    // bourdonnement : les moucherons proches piquent un sprint vers le joueur
    const t = e.target;
    if (!t) return;
    for (const o of ctx.enemiesIn(e.x, e.y, 140)) {
      if (o.def.id !== 'w1_moucheron') continue;
      const a = Math.atan2(t.y - o.y, t.x - o.x);
      o.data.dash = { vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, t: 0.35 };
    }
  },
});

// ------------------------------------------------------------------ Hibou-sorcier (clignement + anneau, puis missiles qui suivent)
const HIBOU = sym(['.....P', '....Pp', '...PpP', '..PPPP', 'PPPPPP', '.Nnnnn', 'Nyyynn', 'Ny0ynn', 'Nyyyno', '.Nnnno', 'Nnwwnn', 'Nnwwwn', '.NnnnN', '..o...']);
defineSprite('e_hibou', HIBOU, {
  frames: [
    rep(HIBOU, { 13: '...o....o...' }),
    rep(HIBOU, { 6: sym(['Nnnnnn'])[0], 7: sym(['Nkkknn'])[0], 8: sym(['Nnnnno'])[0] }),
    rep(HIBOU, { 0: '......P.....', 1: '.....PPp....' }),
  ],
});
defineEnemy({
  id: 'hibou_sorcier', name: 'Hibou-sorcier', world: 1, sprite: 'e_hibou', hp: 29, speed: 42, radius: 6, contact: 0, cost: 2, minFloor: 4, coins: [1, 4],
  move: { kind: 'wander', period: 1.4 },
  attacks: [
    { pattern: 'blink', cooldown: 3.8, telegraph: 0.45, params: { min: 60, max: 95, delay: 0.45, then: { count: 9, speed: 82 } } },
    { pattern: 'homing', cooldown: 3.4, telegraph: 0.45, params: { count: 2, speed: 72, turn: 1.4, life: 3 } },
  ],
});

// ------------------------------------------------------------------ Sylvain colosse (mini-tank : ses cris galvanisent la forêt)
const SYLV = [
  '......fff', '...ffffFf', '..fFfffff', '.ffffgfff', '..fNNNNNN', '...Nnnnnn', '...Nny0nn', '...Nnnnnn', '.NNNnnnkk',
  'Nn.Nnnnnn', 'Nn.Nnnnnn', 'N..NnnNnn', '...NNNNNN', '...NnN...', '..dddd...',
];
const SYLV2 = [
  '.....fff.', '...fffFff', '..fFfffff', '.ffffgfff', '..fNNNNNN', 'N..Nnnnnn', 'Nn.Nny0nn', 'Nn.Nnnnnn', '.NNNnnnkk',
  '...Nnnnnn', '...Nnnnnn', '...NnnNnn', '...NNNNNN', '..NnN....', '..dddd...',
];
defineSprite('e_sylvain', sym(SYLV), { frames: [sym(SYLV2), sym(swapCh(SYLV, { y: 'r', '0': 'y' })), sym(rep(SYLV2, { 13: '...NnN...' }))] });
defineEnemy({
  id: 'sylvain', name: 'Sylvain colosse', world: 1, sprite: 'e_sylvain', hp: 90, speed: 28, radius: 9, contact: 1, cost: 4, minFloor: 5, coins: [3, 6],
  knockbackResist: 0.85, energy: 2,
  move: { kind: 'chase', range: 40 },
  attacks: [
    { pattern: 'rings', cooldown: 4, telegraph: 0.5, stop: 0.9, params: { waves: 2, count: 11, interval: 0.4, speed: 82 } },
    { pattern: 'rain', cooldown: 4.8, telegraph: 0.5, params: { count: 6, area: 50, radius: 20, interval: 0.15 } },
    { pattern: 'w1_racines', cooldown: 5.5, telegraph: 0.5, stop: 0.8, params: { count: 3, spread: 0.8, warn: 0.6, length: 150 } },
    { pattern: 'melee', cooldown: 1.8, telegraph: 0.45, range: 40, stop: 0.4, params: { range: 34, arc: 2.2 } },
  ],
  onUpdate: (ctx, e, dt) => {
    e.data.roar = (e.data.roar ?? 4) - dt;
    if (e.data.roar > 0) return;
    e.data.roar = 6;
    if (rallyAllies(ctx, e, 120, 1.2, 0x6ee06e)) ctx.text(e.x, e.y - 16, 'HOOOUM !', 0x6ee06e, true);
  },
});

// ------------------------------------------------------------------ Dryade d'écume (orbite + pétales ; esquive les tirs)
const DRYA = sym(['...ggg', '.gglgg', 'gglggg', 'ggssss', 'g.s0ss', 'g.ssmk', '..tttt', '.tttTt', 'tt.tTt', '..tTtt', '.ttTtt', '..t...']);
const DRYA1 = rep(DRYA, { 11: '...t....t...' });
defineSprite('e_dryade', DRYA, { frames: [DRYA1, swapCh(DRYA, { g: 'l', l: 'g' }), swapCh(DRYA1, { g: 'l', l: 'g' })] });
defineEnemy({
  id: 'dryade', name: "Dryade d'écume", world: 1, sprite: 'e_dryade', hp: 41, speed: 56, radius: 6, contact: 0, cost: 2, minFloor: 5, coins: [1, 4],
  move: { kind: 'orbit', range: 95 },
  attacks: [
    { pattern: 'w1_petales', cooldown: 2.3, telegraph: 0.4, params: { count: 5, spread: 1, speed: 88 } },
    { pattern: 'spiral', cooldown: 4.6, telegraph: 0.5, stop: 1, params: { arms: 3, shots: 11, interval: 0.1, step: 0.3, speed: 82 } },
  ],
  // Pas de côté : quand une balle arrive tout près, elle glisse sur le côté (rechargement 1.4 s).
  onUpdate: (ctx, e, dt) => {
    if ((e.data.dodge = (e.data.dodge ?? 0) - dt) > 0) return;
    for (const b of ctx.bullets) {
      if (b.dead || b.team !== 'player' || b.kind !== 'shot') continue;
      const dx = e.x - b.x, dy = e.y - b.y, d = Math.hypot(dx, dy);
      if (d > 34 || d < 1) continue;
      if (dx * b.vx + dy * b.vy <= 0) continue; // s'éloigne
      const s = ctx.rng.chance(0.5) ? 1 : -1;
      const v = Math.hypot(b.vx, b.vy) || 1;
      e.data.dash = { vx: (-b.vy / v) * s * 190, vy: (b.vx / v) * s * 190, t: 0.18 };
      e.data.dodge = 1.4;
      ctx.burst(e.x, e.y, 0x30c0b0, 5, 50, 0.3);
      break;
    }
  },
});
