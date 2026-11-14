// Monde 3 — BOSS FINAL : le Primat Fondeur, qui coule les Édits dans le magma.
import { defineEnemy, defineSprite } from '../../core/registry';
import type { Ctx } from '../../sim/ctx';
import type { Enemy } from '../../core/types';
import { mirrorHalf, swapPx, emberPuddle, gapRing } from './w3_patterns';

// Sprite 30×28 construit par moitié (symétrique) : heaume cornu, yeux de braise, sceau rouge de l'Édit sur le torse.
const HALF = [
  '..Y............',
  '..YY...........',
  '...YY.....y....',
  '....YY...yYy...',
  '.....YaaaaaYaaa',
  '.....a2222222a2',
  '....aaaaaaaaaaa',
  '....a44444444a4',
  '...a45555y1k555',
  '...a455555yyy55',
  '...a4555555555v',
  '..aa44555vvvvvv',
  '.aaaa45vvoooooo',
  'a2222a4vvoyyyyy',
  'a2aa2a4voyRRRRR',
  'aaaaaa4voyR1111',
  '.a44a.4voyR1RRR',
  '.a44a.4voyR1RR1',
  '.a44a.4voyRRRRR',
  '.aaaa.4vvoyyyyy',
  '.v..v.44vvooooo',
  '.v..v..4455vvvv',
  '..v...45555555v',
  '......45554....',
  '.....455554....',
  '.....455554....',
  '....4vvvvvv4...',
  '....44444444...',
];
const BOSS = mirrorHalf(HALF);
defineSprite('boss_w3_primat', BOSS, { frames: [swapPx(BOSS, { v: 'o', o: 'v', '1': 'y', y: '1' })] });

/** Transition de phase : bouclier bref + annonce. */
function enter(ctx: Ctx, e: Enemy, title: string, sub: string, color: number): void {
  e.data.shieldUntil = ctx.time + 1.2;
  ctx.banner(title, sub, '#ff7a30');
  ctx.flash(color, 0.3);
  ctx.ring(e.x, e.y, 90, color);
  ctx.shake(8);
}

defineEnemy({
  id: 'boss_primat_fondeur', name: 'Primat Fondeur', world: 3, sprite: 'boss_w3_primat', hp: 1500, speed: 28, radius: 14, contact: 2, knockbackResist: 1,
  immune: ['burn'],
  move: { kind: 'chase', range: 100 },
  onHurt: (ctx, e, ev) => { if (ctx.time < (e.data.shieldUntil ?? 0)) ev.cancel = true; },
  onUpdate: (ctx, e, dt) => {
    // dès la phase 3, la forge déborde : le Primat laisse des flaques de braises derrière lui
    if (e.phase < 2) return;
    e.data.pt = (e.data.pt ?? 1.5) - dt;
    if (e.data.pt <= 0) { e.data.pt = e.phase >= 3 ? 1 : 1.5; emberPuddle(ctx, e, e.x, e.y + 10, 3); }
  },
  boss: {
    title: 'Celui qui coule les Édits dans le magma',
    phases: [
      // ---------------- Phase 1 — Le Sceau : anneaux décalés, spirale, salves ; signature « Frappe du Sceau ».
      {
        hp: 1, move: { kind: 'chase', range: 100 }, speed: 28,
        attacks: [
          { pattern: 'rings', cooldown: 3.6, telegraph: 0.5, stop: 1, params: { waves: 3, count: 14, interval: 0.45, rotate: Math.PI / 14, speed: 95, sprite: 'eb_w3_ember' } },
          { pattern: 'spiral', cooldown: 4.6, telegraph: 0.6, stop: 1.8, params: { arms: 3, shots: 22, interval: 0.09, step: 0.22, speed: 100, sprite: 'eb_w3_ember' } },
          { pattern: 'burst', cooldown: 2.8, telegraph: 0.4, params: { shots: 3, interval: 0.2, count: 3, spread: 0.45, speed: 140 } },
          { pattern: 'w3_seal_stamp', cooldown: 7, first: 3, telegraph: 0.8, stop: 0.6, params: { stamps: 3, interval: 0.55, radius: 28, damage: 2, shards: 10 } },
        ],
      },
      // ---------------- Phase 2 — La Coulée : rayons en éventail, météores, coulées ; signature « Décret tournant ».
      {
        hp: 0.66, move: { kind: 'wander', period: 1.4 }, speed: 40,
        onEnter: (ctx, e) => {
          enter(ctx, e, 'LA COULÉE', 'Le Primat ouvre les vannes de la forge.', 0xff8030);
          for (let i = 0; i < 2; i++) ctx.spawnEnemy('w3_spark', e.x + (i ? 30 : -30), e.y + 20, { summoned: true, delay: 0.6 });
        },
        attacks: [
          { pattern: 'laser', cooldown: 4.6, telegraph: 0.5, stop: 1.4, params: { count: 5, spread: 1.5, warn: 0.85, width: 7, damage: 2, length: 320, color: 0xff6030 } },
          { pattern: 'w3_meteors', cooldown: 5, telegraph: 0.5, params: { count: 7, area: 85, interval: 0.15, time: 1.25, radius: 20 } },
          { pattern: 'w3_lava_flow', cooldown: 4.4, telegraph: 0.5, params: { lines: 3, count: 9, spread: 1, life: 2.8 } },
          { pattern: 'w3_edict_cross', cooldown: 7.5, first: 2.5, telegraph: 0.7, stop: 2.3, params: { arms: 4, steps: 3, rot: 0.35, warn: 0.75, damage: 2, width: 7 } },
          { pattern: 'w3_gapring', cooldown: 3, telegraph: 0.45, params: { count: 22, gap: 4, speed: 100 } },
          { pattern: 'summon', cooldown: 11, telegraph: 0.7, params: { id: 'w3_spark', count: 2, max: 4 } },
        ],
      },
      // ---------------- Phase 3 — La Forge vivante : ruées, soufflets, bombes ; signature « Marteau du Verdict ».
      {
        hp: 0.33, move: { kind: 'chase', range: 50 }, speed: 52,
        onEnter: (ctx, e) => {
          enter(ctx, e, 'LA FORGE VIVANTE', 'Le Primat descend de son trône.', 0xffb040);
          gapRing(ctx, e, { count: 24, gap: 5, speed: 90 });
        },
        attacks: [
          { pattern: 'w3_verdict', cooldown: 4.4, telegraph: 0.65, range: 280, params: { speed: 230, dur: 0.45, count: 20, gap: 4, ringSpeed: 105 } },
          { pattern: 'spiral', cooldown: 4.6, telegraph: 0.55, stop: 1.4, params: { arms: 4, shots: 18, interval: 0.08, step: -0.25, speed: 105, sprite: 'eb_w3_ember' } },
          { pattern: 'w3_bellows', cooldown: 3.6, telegraph: 0.55, range: 120, params: { range: 115, push: 360, cone: 0.9, count: 10, speed: 125 } },
          { pattern: 'rings', cooldown: 4, telegraph: 0.5, params: { waves: 2, count: 16, interval: 0.4, speed: 110, sprite: 'eb_w3_ember' } },
          { pattern: 'summon', cooldown: 9, telegraph: 0.7, first: 4, params: { id: 'w3_bomb_minion', count: 2, max: 3 } },
        ],
      },
      // ---------------- Phase 4 — Rage (< 12 %) : tout s'emballe, brièvement ; signature « Effondrement ».
      {
        hp: 0.12, move: { kind: 'chase', range: 30 }, speed: 62,
        onEnter: (ctx, e) => {
          enter(ctx, e, 'EFFONDREMENT', "La forge s'écroule — l'Édit final brûle !", 0xff3030);
          ctx.text(e.x, e.y - 26, 'RAGE', 0xff3030, true);
        },
        attacks: [
          { pattern: 'spiral', cooldown: 3.4, telegraph: 0.45, stop: 1.6, params: { arms: 4, shots: 24, interval: 0.07, step: 0.2, speed: 112, sprite: 'eb_w3_ember' } },
          { pattern: 'w3_meteors', cooldown: 4, telegraph: 0.4, params: { count: 9, area: 95, interval: 0.1, time: 1.1, radius: 18 } },
          { pattern: 'w3_verdict', cooldown: 3.6, telegraph: 0.5, range: 280, params: { speed: 250, dur: 0.4, count: 18, gap: 4, ringSpeed: 110 } },
          { pattern: 'cross', cooldown: 3, telegraph: 0.45, params: { arms: 8, perArm: 3, speed: 95, sprite: 'eb_w3_ember' } },
        ],
      },
    ],
  },
});
