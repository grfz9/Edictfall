// Monde 1 — premiers ennemis + boss. Modèle à suivre pour les autres.
import { defineEnemy, defineSprite } from '../../core/registry';
import { enemyBullet } from '../../sim/patterns';
import type { Enemy } from '../../core/types';
import type { Ctx } from '../../sim/ctx';
import { sym } from './w1_patterns';

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
// Phase 1 « Racines » : épines qui jaillissent le long de lignes annoncées.
// Phase 2 « Couronne » : anneaux à brèche tournante + kamikazes ; écorce durcie à l'entrée.
// Phase 3 « Fureur » : bonds écrasants + onde de choc, spirales, couronne d'épines au sol.
defineSprite('boss_souche', sym([
  '....y....y...', '....yy..yy..y', '....yyyyyyyyy', '.....yRyyyRyy', '..f..yyyyyyyy', '.ffdddddddddd', 'fFdNNNNNNNNNN',
  '.dNnnnnnnnnnn', '.dNnnfnnnnnnn', '.dNnn000nnnnn', '.dNnn0rr0nnnn', '.dNnnn00nnnnn', '.dNnnnnnnnnnn', 'ddNnnnnnnnnnn',
  'dNNnnnn000000', 'dNdNnn0wkwkwk', 'dNdNnnn000000', '.d.Nnnnnnnnnn', '...NnnfnnnNnn', '...NnfffnnNnn', '...NNnnnnnNnn',
  '..dNNNNNNNNNN', '.dNNdNNNdNNNN', '.dNd.dNd.dNNd', 'dNd..dNd..dNd', 'd....d....d..',
]), {
  frames: [sym([
    '.....y....y..', '.....yy..yy.y', '....yyyyyyyyy', '.....yRyyyRyy', 'f....yyyyyyyy', '.Ffdddddddddd', '.fdNNNNNNNNNN',
    '.dNnnnnnnnnnn', '.dNnnfnnnnnnn', '.dNnn000nnnnn', '.dNnn0rr0nnnn', '.dNnnn00nnnnn', '.dNnnnnnnnnnn', 'ddNnnnnnnnnnn',
    'dNNnnn0000000', 'dNdNnn0kkkkkk', 'dNdNnnn0wwwww', '.d.Nnnnnnnnnn', '...NnnfnnnNnn', '...NnfffnnNnn', '...NNnnnnnNnn',
    '..dNNNNNNNNNN', '.dNNdNNNdNNNN', '.dNd.dNd.dNNd', '.dNd.dNd..dNd', '..d...d...d..',
  ])],
});

/** Écorce durcie : réduit fortement les dégâts subis pendant `dur` s (annoncé visuellement). */
function hardenBark(ctx: Ctx, e: Enemy, dur: number): void {
  e.data.bark = dur;
  ctx.text(e.x, e.y - 24, 'ÉCORCE !', 0xd8b070, true);
  ctx.ring(e.x, e.y, 30, 0xb98a52);
}

defineEnemy({
  id: 'boss_souche', name: 'Souche-Roi', world: 1, sprite: 'boss_souche', hp: 620, speed: 30, radius: 13, contact: 1, knockbackResist: 1,
  immune: ['slow'], noChampion: true,
  move: { kind: 'chase', range: 80 },
  onUpdate: (ctx, e, dt) => {
    if (!(e.data.bark > 0)) return;
    e.data.bark -= dt;
    if ((e.data.barkFx = (e.data.barkFx ?? 0) - dt) <= 0) {
      e.data.barkFx = 0.25;
      ctx.burst(e.x + ctx.rng.range(-10, 10), e.y + ctx.rng.range(-10, 10), 0xb98a52, 3, 30, 0.3);
    }
  },
  onHurt: (_ctx, e, ev) => {
    if (e.data.bark > 0 && ev.cause !== 'status') ev.amount *= 0.3;
  },
  boss: {
    title: 'Monarque des racines mortes',
    phases: [
      {
        hp: 1, move: { kind: 'chase', range: 80 }, speed: 28,
        attacks: [
          { pattern: 'w1_racines', cooldown: 3.8, first: 1.5, telegraph: 0.45, stop: 1.2, weight: 1.4, params: { count: 3, spread: 0.8, warn: 0.6, length: 180 } },
          { pattern: 'spread', cooldown: 2.4, telegraph: 0.4, params: { count: 5, spread: 0.9, speed: 90 } },
          { pattern: 'burst', cooldown: 4, telegraph: 0.45, params: { shots: 3, interval: 0.25, count: 3, spread: 0.5, speed: 100 } },
          { pattern: 'summon', cooldown: 10, first: 5, telegraph: 0.7, stop: 0.6, params: { id: 'w1_souchon', count: 2, max: 4 } },
        ],
      },
      {
        hp: 0.66, move: { kind: 'wander', period: 1.4 }, speed: 40,
        onEnter: (ctx, e) => {
          hardenBark(ctx, e, 2.5);
          for (const s of [-1, 1]) {
            const x = e.x + s * 26, y = e.y + 10;
            if (!ctx.isSolid(x, y)) ctx.spawnEnemy('w1_souchon', x, y, { summoned: true, delay: 0.6 });
          }
        },
        attacks: [
          { pattern: 'w1_couronne', cooldown: 5, telegraph: 0.6, stop: 1.8, weight: 1.4, params: { waves: 3, count: 22, gap: 4, rotate: 0.45, interval: 0.55, speed: 78 } },
          { pattern: 'rain', cooldown: 4, telegraph: 0.5, params: { count: 6, area: 60, radius: 20, interval: 0.15 } },
          { pattern: 'homing', cooldown: 5.5, telegraph: 0.45, params: { count: 2, speed: 70, turn: 1.2, life: 3.2 } },
          { pattern: 'summon', cooldown: 11, first: 6, telegraph: 0.7, stop: 0.6, params: { id: 'vesse_de_loup', count: 2, max: 4 } },
        ],
      },
      {
        hp: 0.33, move: { kind: 'chase', range: 30 }, speed: 50,
        onEnter: (ctx, e) => {
          hardenBark(ctx, e, 2);
          // couronne d'épines au sol, ouverte du côté du joueur
          const t = e.target ?? ctx.nearestPlayer(e.x, e.y);
          const g = t ? Math.atan2(t.y - e.y, t.x - e.x) : 0;
          const n = 16;
          for (let i = 0; i < n; i++) {
            if (i < 3) continue;
            const a = g + ((i - 1) / n) * Math.PI * 2;
            const x = e.x + Math.cos(a) * 62, y = e.y + Math.sin(a) * 62;
            if (!ctx.isSolid(x, y)) ctx.spawnBullet(enemyBullet({ speed: 0, life: 5, radius: 4, sprite: 'eb_shard' }), x, y, a, 'enemy', e);
          }
          ctx.shake(5);
        },
        attacks: [
          { pattern: 'w1_ecrasement', cooldown: 4, telegraph: 0.6, stop: 1, range: 220, weight: 1.4, params: { dashSpeed: 220, dur: 0.45, count: 18, gap: 3, speed: 85 } },
          { pattern: 'spiral', cooldown: 5.5, telegraph: 0.5, stop: 1.4, params: { arms: 3, shots: 20, interval: 0.08, step: 0.28, speed: 80 } },
          { pattern: 'w1_racines', cooldown: 4.6, telegraph: 0.45, stop: 1, params: { count: 5, full: true, warn: 0.6, length: 160 } },
          { pattern: 'summon', cooldown: 9, telegraph: 0.7, params: { id: 'w1_souchon', count: 2, max: 4 } },
        ],
      },
    ],
  },
});
