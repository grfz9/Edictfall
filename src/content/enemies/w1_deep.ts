// Monde 1 « Sylve Murmurante » — cœur de la forêt (étages 3-5) et invocations.
import { defineEnemy, defineSprite } from '../../core/registry';
import type { Bullet, Enemy } from '../../core/types';
import { sym, sporeRing } from './w1_patterns';

// ------------------------------------------------------------------ Souchon (invocation : petit rejeton de souche)
defineSprite('e_souchon', sym(['...g', '.NNN', 'Nnnn', 'Nn0n', 'Nnnn', '.NNN', 'd..d']), {
  frames: [sym(['...g', '.NNN', 'Nnnn', 'Nn0n', 'Nnnn', '.NNN', '.d.d'])],
});
defineEnemy({
  id: 'w1_souchon', name: 'Souchon', world: 0, sprite: 'e_souchon', hp: 8, speed: 66, radius: 4, contact: 1, coins: [0, 0], energy: 0, noChampion: true,
  move: { kind: 'chase' },
});

// ------------------------------------------------------------------ Souchette (se divise en deux souchons)
defineSprite('e_souchette', sym(['.....g', '....gl', '.....G', '.NNNNN', 'Nnnnnn', 'Nn0rnn', 'Nnnnnn', 'Nnnnkk', 'NNnnnn', '.dNNNN', 'd.d..d']), {
  frames: [sym(['....g.', '....gl', '.....G', '.NNNNN', 'Nnnnnn', 'Nn0rnn', 'Nnnnnn', 'Nnnnkk', 'NNnnnn', '.dNNNN', '.d..d.'])],
});
defineEnemy({
  id: 'souchette', name: 'Souche bougonne', world: 1, sprite: 'e_souchette', hp: 30, speed: 40, radius: 7, contact: 1, cost: 2, minFloor: 3, coins: [1, 3],
  knockbackResist: 0.5,
  move: { kind: 'chase', range: 18 },
  attacks: [
    { pattern: 'melee', cooldown: 1.8, telegraph: 0.4, range: 34, stop: 0.3, params: { range: 28, arc: 1.6 } },
    { pattern: 'aimed', cooldown: 3.2, telegraph: 0.4, params: { count: 2, spread: 0.35, speed: 85 } },
  ],
  onDeath: (ctx, e) => {
    for (const s of [-1, 1]) {
      const x = e.x + s * 8, y = e.y;
      ctx.spawnEnemy('w1_souchon', ctx.isSolid(x, y) ? e.x : x, y, { summoned: true, delay: 0.25 });
    }
    ctx.burst(e.x, e.y, 0xb98a52, 10, 70, 0.4, 2);
  },
});

// ------------------------------------------------------------------ Druidelle (soigne ses voisins)
defineSprite('e_druide', sym(['n.n...', '.nn...', '..ffff', '.fssss', '.fs0ss', '..ssss', '.ffFff', 'ffFfff', 'fFffff', '.FFFFF', '..d..d']), {
  frames: [sym(['.n.n..', '..nn..', '..ffff', '.fssss', '.fs0ss', '..ssss', '.ffFff', 'ffFfff', 'fFffff', '.FFFFF', '.d..d.'])],
});
defineEnemy({
  id: 'druidelle', name: 'Druidelle rebouteuse', world: 1, sprite: 'e_druide', hp: 20, speed: 44, radius: 6, contact: 0, cost: 2, minFloor: 3, coins: [1, 4],
  move: { kind: 'keepDistance', range: 115 },
  attacks: [{ pattern: 'ring', cooldown: 3.4, telegraph: 0.45, params: { count: 8, speed: 75 } }],
  onSpawn: (_ctx, e) => { e.data.healT = 2; },
  onUpdate: (ctx, e, dt) => {
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

// ------------------------------------------------------------------ Cerf-esprit (rayon annoncé)
defineSprite('e_cerf', sym(['c.c....', '.c.c...', '..cc...', '....iii', '...i0ii', '....iii', '..iiiii', '.iIiiii', '.iIIiii', '.iIiIii', '.I..I..']), {
  frames: [sym(['c.c....', '.c.c...', '..cc...', '....iii', '...i0ii', '....iii', '..iiiii', '.iIiiii', '.iIIiii', '.iIiIii', '..I..I.'])],
  outline: '#1a3050',
});
defineEnemy({
  id: 'cerf_esprit', name: 'Cerf des brumes', world: 1, sprite: 'e_cerf', hp: 28, speed: 50, radius: 7, contact: 0, cost: 2, minFloor: 3, coins: [1, 4],
  phasing: true,
  move: { kind: 'keepDistance', range: 130 },
  attacks: [
    { pattern: 'laser', cooldown: 4.2, telegraph: 0.4, stop: 1.1, params: { warn: 0.7, width: 5, damage: 1, length: 260, color: 0x9ae8ff } },
    { pattern: 'spread', cooldown: 2.8, telegraph: 0.4, params: { count: 3, spread: 0.5, speed: 90 } },
  ],
});

// ------------------------------------------------------------------ Tisseuse (toiles collantes)
defineSprite('e_tisseuse', sym(['0.....', '.0.PPP', '0.PPpp', '.0Ppr1', '0.PPpp', '.0PPPP', '0..PP.', '.0....']), {
  frames: [sym(['.0....', '0..PPP', '.0PPpp', '0.Ppr1', '.0PPpp', '0.PPPP', '.0.PP.', '0.....'])],
});
defineEnemy({
  id: 'tisseuse', name: 'Tisseuse de ronces', world: 1, sprite: 'e_tisseuse', hp: 20, speed: 52, radius: 6, contact: 1, cost: 1, minFloor: 3, coins: [0, 3],
  move: { kind: 'wander', period: 1.1 },
  attacks: [
    { pattern: 'mines', cooldown: 4.2, telegraph: 0.4, params: { count: 3, scatter: 30, life: 5, bullet: { status: { kind: 'slow', dur: 1.5 }, radius: 4 } } },
    { pattern: 'aimed', cooldown: 2.4, telegraph: 0.35, params: { count: 2, spread: 0.3, speed: 95 } },
  ],
});

// ------------------------------------------------------------------ Garde-écorce (bouclier frontal)
const BARK = [
  '....NNNN......', '...NnnnnN.....', '...Nn0n0N.aa..', '...NnnnnN.aAa.', '..dNNNNNNdaAAa', '.dNnnnnnNdaAAa',
  '.dNnnnnnNdaAAa', '.dNnnnnnNdaAAa', '..NnnnnnN.aAa.', '..NNNNNNN..a..',
];
defineSprite('e_garde_ecorce', [...BARK, '..dd...dd.....'], { frames: [[...BARK, '...dd.dd......']] });
defineEnemy({
  id: 'garde_ecorce', name: 'Garde-écorce', world: 1, sprite: 'e_garde_ecorce', hp: 40, speed: 32, radius: 7, contact: 1, cost: 3, minFloor: 4, coins: [2, 4],
  knockbackResist: 0.8,
  move: { kind: 'chase', range: 22 },
  attacks: [
    { pattern: 'wall', cooldown: 3.8, telegraph: 0.5, stop: 0.4, params: { count: 9, spacing: 14, speed: 75, gapWidth: 2 } },
    { pattern: 'melee', cooldown: 1.7, telegraph: 0.4, range: 34, params: { range: 30, arc: 1.8 } },
  ],
  // Le bouclier encaisse les tirs venant de face (côté joueur) : il faut le contourner.
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
      if ((e.data.clang = (e.data.clang ?? 0) + 1) % 3 === 1) { ctx.burst(e.x + Math.cos(faceA) * 7, e.y + Math.sin(faceA) * 7, 0xc8d0e0, 4, 60, 0.2); ctx.sfx('armor', 0.25); }
    }
  },
});

// ------------------------------------------------------------------ Vesse-de-loup (kamikaze)
defineSprite('e_vesse', sym(['...ww', '.wwww', 'w1www', 'ww0ww', 'wwwwS', '.SwwS', '..SSS', '...SS']), {
  frames: [sym(['.....', '...ww', '.w1ww', 'ww0ww', 'wwwwS', 'wSwwS', '.SSSS', '...SS'])],
});
function vesseBoom(ctx: import('../../sim/ctx').Ctx, e: Enemy): void {
  e.data.boom = true;
  ctx.explode(e.x, e.y, 30, 1, 'enemy');
  ctx.burst(e.x, e.y, 0xd8c890, 16, 90, 0.6, 2);
  ctx.killEnemy(e);
}
defineEnemy({
  id: 'vesse_de_loup', name: 'Vesse-de-loup kamikaze', world: 1, sprite: 'e_vesse', hp: 10, speed: 74, radius: 5, contact: 0, cost: 1, minFloor: 4, coins: [0, 2],
  noChampion: true,
  move: { kind: 'chase' },
  onUpdate: (ctx, e, dt) => {
    const t = e.target;
    if (e.data.fuse === undefined) {
      if (t && Math.hypot(t.x - e.x, t.y - e.y) < 28) {
        e.data.fuse = 0.65; // mèche : le temps de s'écarter
        e.stop = 1;
        ctx.text(e.x, e.y - 10, '!', 0xff5566, true);
        ctx.sfx('dash', 0.4);
      }
      return;
    }
    e.data.fuse -= dt;
    e.stop = 1;
    if (Math.floor(e.data.fuse * 12) % 2 === 0) e.flash = 0.05;
    if (e.data.fuse <= 0 && !e.data.boom) vesseBoom(ctx, e);
  },
  onDeath: (ctx, e) => { if (!e.data.boom) sporeRing(ctx, e, 5, 40, 2); },
});

// ------------------------------------------------------------------ Moucheron (invocation de la ruche)
defineSprite('e_moucheron', sym(['c...', 'cc.d', '.ddd', '.d1r', '..dd']), { frames: [sym(['....', 'cc..', 'cddd', '.d1r', '..dd'])] });
defineEnemy({
  id: 'w1_moucheron', name: 'Moucheron', world: 0, sprite: 'e_moucheron', hp: 6, speed: 78, radius: 4, contact: 1, coins: [0, 0], energy: 0, noChampion: true,
  phasing: true,
  move: { kind: 'zigzag' },
});

// ------------------------------------------------------------------ Ruche ambulante (invoque + nuée)
defineSprite('e_ruche', sym(['....YYY', '..YYyyy', '.Yyyyyy', '.YNNNNN', 'Yyyyyyy', 'YNNNNkk', 'Yyyyyyy', '.YNNNNN', '.Yyyyyy', '..YYYYY', '....n..']), {
  frames: [sym(['.....YY', '...YYyy', '.YYyyyy', '.YNNNNN', 'Yyyyyyy', 'YNNNNkk', 'Yyyyyyy', '.YNNNNN', '.Yyyyyy', '..YYYYY', '...n...'])],
});
defineEnemy({
  id: 'ruche', name: 'Ruche vagabonde', world: 1, sprite: 'e_ruche', hp: 50, speed: 24, radius: 8, contact: 1, cost: 3, minFloor: 4, coins: [2, 5],
  knockbackResist: 0.6,
  move: { kind: 'wander', period: 1.8 },
  attacks: [
    { pattern: 'summon', cooldown: 6, first: 1.5, telegraph: 0.6, stop: 0.4, params: { id: 'w1_moucheron', count: 2, max: 5 } },
    { pattern: 'spray', cooldown: 4, telegraph: 0.45, params: { shots: 8, arc: 1, interval: 0.09, speed: 85, sprite: 'eb_small' } },
  ],
});

// ------------------------------------------------------------------ Hibou-sorcier (clignement + anneau)
defineSprite('e_hibou', sym(['.P....', '.PP...', '.PPPPP', 'Py0yPP', 'PyyyPP', 'PPPPPo', '.Pppnn', '.Ppppp', '.Ppppp', '..PPPP', '..o..o']), {
  frames: [sym(['......', '.P....', '.PPPPP', 'Py0yPP', 'PyyyPP', 'PPPPPo', 'PPppnn', 'PPpppp', '.Ppppp', '..PPPP', '..o..o'])],
});
defineEnemy({
  id: 'hibou_sorcier', name: 'Hibou-sorcier', world: 1, sprite: 'e_hibou', hp: 24, speed: 40, radius: 6, contact: 0, cost: 2, minFloor: 4, coins: [1, 4],
  move: { kind: 'wander', period: 1.5 },
  attacks: [
    { pattern: 'blink', cooldown: 4.2, telegraph: 0.45, params: { min: 60, max: 95, delay: 0.45, then: { count: 8, speed: 80 } } },
    { pattern: 'homing', cooldown: 3.6, telegraph: 0.45, params: { count: 2, speed: 70, turn: 1.4, life: 3 } },
  ],
});

// ------------------------------------------------------------------ Sylvain colosse (mini-tank)
defineSprite('e_sylvain', sym([
  '......fff', '...ffffFf', '..fFfffff', '.ffffgfff', '..fNNNNNN', '...Nnnnnn', '...Nny0nn', '...Nnnnnn', '.NNNnnnkk',
  'Nn.Nnnnnn', 'Nn.Nnnnnn', 'N..NnnNnn', '...NNNNNN', '...NnN...', '..dddd...',
]), {
  frames: [sym([
    '.....fff.', '...fffFff', '..fFfffff', '.ffffgfff', '..fNNNNNN', 'N..Nnnnnn', 'Nn.Nny0nn', 'Nn.Nnnnnn', '.NNNnnnkk',
    '...Nnnnnn', '...Nnnnnn', '...NnnNnn', '...NNNNNN', '..NnN....', '..dddd...',
  ])],
});
defineEnemy({
  id: 'sylvain', name: 'Sylvain colosse', world: 1, sprite: 'e_sylvain', hp: 80, speed: 26, radius: 9, contact: 1, cost: 4, minFloor: 5, coins: [3, 6],
  knockbackResist: 0.85, energy: 2,
  move: { kind: 'chase', range: 40 },
  attacks: [
    { pattern: 'rings', cooldown: 4.4, telegraph: 0.5, stop: 0.9, params: { waves: 2, count: 10, interval: 0.4, speed: 80 } },
    { pattern: 'rain', cooldown: 5.2, telegraph: 0.5, params: { count: 5, area: 50, radius: 20, interval: 0.15 } },
    { pattern: 'melee', cooldown: 2, telegraph: 0.45, range: 40, stop: 0.4, params: { range: 34, arc: 2.2 } },
  ],
});

// ------------------------------------------------------------------ Dryade d'écume (orbite + pétales)
defineSprite('e_dryade', sym(['..ggg', '.gggg', 'gglss', 'ggs0s', 'g.sss', '..ttt', '.tttt', 'tttTt', '.tTtt', '..t.t']), {
  frames: [sym(['...gg', '.gggg', 'gglss', 'ggs0s', 'g.sss', '..ttt', '.tttt', 'tttTt', '.tTtt', '.t..t'])],
});
defineEnemy({
  id: 'dryade', name: "Dryade d'écume", world: 1, sprite: 'e_dryade', hp: 34, speed: 52, radius: 6, contact: 0, cost: 2, minFloor: 5, coins: [1, 4],
  move: { kind: 'orbit', range: 95 },
  attacks: [
    { pattern: 'w1_petales', cooldown: 2.6, telegraph: 0.4, params: { count: 5, spread: 1, speed: 85 } },
    { pattern: 'spiral', cooldown: 5, telegraph: 0.5, stop: 1, params: { arms: 3, shots: 10, interval: 0.1, step: 0.3, speed: 80 } },
  ],
});
