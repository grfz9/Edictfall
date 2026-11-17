// Monde 3 — BOSS FINAL : le Primat Fondeur, qui coule les Édits dans le magma.
// Phase 1 « Le Sceau » : armure intacte, heaume cornu — sceaux qui s'abattent + spirale lente par-dessus.
// Phase 2 « La Coulée » : l'armure se fend de lave, les cornes s'allongent — rayons ET coulées en même temps.
// Phase 3 « La Forge vivante » : le heaume s'ouvre sur un visage de braise — double Verdict, soufflets, météores.
// Phase 4 « Effondrement » : tout brûle — croix de l'Édit final, spirales et pluie de météores.
import { defineEnemy, defineSprite, definePattern, R } from '../../core/registry';
import type { Ctx } from '../../sim/ctx';
import type { Enemy } from '../../core/types';
import { emberPuddle, gapRing } from './w3_patterns';
import { Px, phaseShow, aimAt } from './boss_kit';

// ------------------------------------------------------------------ sprites 38×38 (4 phases × 4 frames)
const PRIMAT_PAL = { x: '#3a0a10', h: '#fff2c0', j: '#ffb070', u: '#7a1a10' };
function primat(ph: number, f: number): string[] {
  const W = 38, H = 38, cx = 19;
  const P = new Px(W, H);
  const hb = [0, -1, -2, -1][f]; // le marteau se soulève
  const lava = ph >= 1 ? ([['v', 'o'], ['y', 'v'], ['o', 'V'], ['v', 'y']] as const)[f] : null;
  const steel = ph === 3 ? { a: '4', A: '5', s: '3' } : { a: 'a', A: 'A', s: '2' };
  // --- jambes et pieds
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? cx - 9 : cx + 3;
    P.rect(x0, 29, 6, 7, steel.A).rect(x0 + (s < 0 ? 0 : 1), 29, 5, 6, steel.a).rect(x0 - (s < 0 ? 1 : 0), 35, 7, 3, '5').rect(x0, 35, 6, 1, steel.s);
    P.rect(x0 + 1, 31, 4, 1, steel.A); // genouillère
  }
  // --- tabard de l'Édit
  P.rect(cx - 4, 27, 8, 9, 'R').rect(cx - 3, 27, 6, 8, 'r').rect(cx - 4, 35, 8, 1, 'Y').set(cx - 1, 31, 'y').set(cx, 31, 'y').rect(cx - 1, 30, 2, 3, 'y');
  // --- torse (trapèze arrondi) + ceinture
  P.shape((x, y) => {
    if (y < 14 || y > 28) return null;
    const hw = 11 - (y - 14) * 0.25, d = x - cx;
    if (Math.abs(d) > hw) return null;
    if (d < -hw + 2) return steel.s;
    if (d > hw - 2.5) return steel.A;
    return steel.a;
  });
  P.rect(cx - 9, 26, 18, 2, 'N').rect(cx - 2, 26, 4, 2, 'Y').set(cx - 1, 26, 'h');
  P.line(cx - 7, 18, cx - 7, 24, steel.s).line(cx + 6, 18, cx + 6, 24, steel.A); // plaques
  // sceau rouge sur la poitrine
  P.disc(cx, 20.5, 4, 'Y').disc(cx, 20.5, 3.2, ph >= 2 ? 'V' : 'R').disc(cx, 20.5, 2, ph >= 2 ? 'v' : 'r');
  P.rect(cx - 1, 18, 2, 5, ph >= 2 ? 'h' : 'y').rect(cx - 2, 19, 4, 1, ph >= 2 ? 'h' : 'y');
  // --- bras + poings
  for (const s of [-1, 1]) {
    const ax = s < 0 ? cx - 15 : cx + 11;
    P.rect(ax, 17, 4, 9, steel.A).rect(ax + (s < 0 ? 0 : 1), 17, 2, 9, steel.a);
    P.disc(cx + s * 13, 27.5 + (s > 0 ? hb : 0), 2.8, '4').disc(cx + s * 13 - 0.6, 27 + (s > 0 ? hb : 0), 1.4, '3');
  }
  // marteau (main droite) : manche + tête
  P.line(cx + 13, 11 + hb, cx + 13, 30 + hb, 'N').line(cx + 14, 11 + hb, cx + 14, 30 + hb, 'd');
  P.rect(cx + 9, 6 + hb, 10, 6, '5').rect(cx + 9, 6 + hb, 10, 1, '3').rect(cx + 9, 6 + hb, 1, 6, '4');
  P.rect(cx + 10, 11 + hb, 8, 1, ph >= 1 ? lava![0] : '4');
  if (ph >= 2) P.rect(cx + 10, 8 + hb, 8, 2, lava![1]);
  // --- épaulières
  for (const s of [-1, 1]) {
    const px = cx + s * 11;
    P.disc(px, 15, 5.5, steel.A).disc(px - 0.6, 14.4, 4.6, steel.a).disc(px - 1.8, 13, 1.6, steel.s);
    P.set(px - 3, 16, 'y').set(px + 2, 17, 'y').set(px, 11, 'y');
    // pointes
    P.line(px + s * 2, 10, px + s * 4, 7, steel.s).set(px + s * 4, 6, 'w');
  }
  // --- heaume
  P.disc(cx, 10, 6.3, steel.A).disc(cx - 0.6, 9.4, 5.4, steel.a).disc(cx - 2.5, 7, 1.5, steel.s);
  P.rect(cx - 1, 3, 2, 3, 'R').set(cx - 1, 3, 'r'); // crête
  // cornes
  const hl = [6, 9, 10, 11][ph];
  for (const s of [-1, 1]) {
    for (let k = 0; k < hl; k++) {
      const t = k / hl, x = cx + s * (5 + t * 7 + t * t * 2), y = 8 - t * 7 - (k > hl * 0.7 ? 1 : 0);
      P.set(x - (s < 0 ? 1 : 0), y, k < hl - 2 ? 'w' : '2').set(x - (s < 0 ? 1 : 0), y + 1, k < hl - 1 ? '2' : '.');
    }
  }
  if (ph < 2) {
    // visière : fente sombre et deux braises
    P.rect(cx - 5, 10, 10, 2, '0');
    const ec = ph === 0 ? (f === 3 ? 'v' : 'y') : f % 2 ? 'h' : 'y';
    P.rect(cx - 4, 10, 2, 1, ec).rect(cx + 2, 10, 2, 1, ec).set(cx - 4, 11, 'v').set(cx + 3, 11, 'v');
  } else {
    // heaume ouvert : visage de braise
    P.rect(cx - 4, 8, 8, 6, 'x').rect(cx - 3, 9, 6, 4, 'V');
    P.rect(cx - 3, 9, 2, 2, '1').rect(cx + 1, 9, 2, 2, '1').set(cx - 2, 10, ph === 3 ? 'r' : 'y').set(cx + 1, 10, ph === 3 ? 'r' : 'y');
    P.line(cx - 3, 8, cx - 1, 9, '0').line(cx + 2, 9, cx + 2, 8, '0').set(cx + 1, 9, '0'); // sourcils de rage
    P.rect(cx - 2, 12, 4, 1, f % 2 ? 'y' : 'o').set(cx - 3, 12, '0').set(cx + 2, 12, '0');
  }
  // --- fissures de lave (phase 2+)
  if (lava) {
    const [l0, l1] = lava;
    P.line(cx - 8, 15, cx - 5, 19, l0).line(cx - 5, 19, cx - 6, 24, l1).line(cx + 7, 16, cx + 4, 22, l0).line(cx + 4, 22, cx + 6, 25, l1);
    P.line(cx - 13, 12, cx - 10, 16, l0).line(cx + 9, 13, cx + 12, 17, l1);
    if (ph >= 2) {
      P.line(cx - 7, 30, cx - 6, 34, l0).line(cx + 5, 29, cx + 6, 33, l1); // coulures sur les jambes
      P.set(cx - 6, 36 - (f % 2), l1).set(cx + 6, 37 - ((f + 1) % 2), l0);
    }
  }
  // --- flammes (phase 4) : sur les épaulières et le heaume
  if (ph === 3) {
    const fl = [['..y..', '.yvy.', 'yvVvy'], ['.y...', '.vy..', 'yvVy.'], ['...y.', '..yv.', '.yVvy'], ['..y..', '.vyv.', 'vVyVv']][f];
    P.stamp(fl, cx - 13, 6).stamp(fl, cx + 9, 6 + hb).stamp(fl, cx - 2, 0);
  }
  return P.rows();
}
const PRIMAT_IDS = ['boss_w3_primat', 'boss_w3_primat_2', 'boss_w3_primat_3', 'boss_w3_primat_4'];
PRIMAT_IDS.forEach((id, ph) => defineSprite(id, primat(ph, 0), { frames: [1, 2, 3].map((f) => primat(ph, f)), pal: PRIMAT_PAL }));

// ------------------------------------------------------------------ patterns signature
/** primat_sceaux — sceaux qui s'abattent sur le joueur PENDANT qu'une spirale lente balaie l'arène. */
definePattern('primat_sceaux', (ctx, e, p, t) => {
  R.patterns.get('w3_seal_stamp')?.(ctx, e, { stamps: p.stamps ?? 3, interval: 0.6, radius: 28, damage: 2, shards: 10 }, t);
  R.patterns.get('spiral')?.(ctx, e, { arms: 2, shots: p.shots ?? 20, interval: 0.1, step: 0.24, speed: 85, sprite: 'eb_w3_ember' }, t);
});

/** primat_coulee — éventail de rayons annoncés + coulées de lave tracées ENTRE les rayons. */
definePattern('primat_coulee', (ctx, e, p, t) => {
  const n = p.count ?? 5, spread = p.spread ?? 1.6;
  R.patterns.get('laser')?.(ctx, e, { count: n, spread, warn: 0.85, width: 7, damage: 2, length: 330, color: 0xff6030 }, t);
  const a = aimAt(e, t), step = spread / (n - 1);
  for (let l = 0; l < n - 1; l++) {
    const ang = a - spread / 2 + step * (l + 0.5);
    for (let k = 0; k < 8; k++) ctx.after(0.3 + k * 0.08, () => emberPuddle(ctx, e, e.x + Math.cos(ang) * 16 * (k + 1), e.y + Math.sin(ang) * 16 * (k + 1), 2.6), e);
  }
});

/** primat_verdicts — deux (ou trois) ruées du marteau, chacune annoncée, onde trouée à chaque arrivée. */
definePattern('primat_verdicts', (ctx, e, p, t) => {
  const n = p.count ?? 2, every = p.every ?? 1.1, warn = Math.max(0.45, p.warn ?? 0.5);
  for (let k = 0; k < n; k++) {
    ctx.after(k * every, () => {
      if (k > 0) { e.data.windup = warn; ctx.ring(e.x, e.y, 30, 0xff6030); ctx.text(e.x, e.y - 30, '!', 0xff6030, true); }
      ctx.after(k > 0 ? warn : 0, () => R.patterns.get('w3_verdict')?.(ctx, e, { speed: p.speed ?? 240, dur: 0.42, count: p.ring ?? 22, gap: 4, ringSpeed: 105 + k * 10 }, e.target ?? t), e);
    }, e);
  }
});

/** primat_edit_final — croix de l'Édit à 6 branches qui tourne, puis onde trouée qui s'emballe. */
definePattern('primat_edit_final', (ctx, e, p, t) => {
  ctx.text(e.x, e.y - 32, "L'ÉDIT FINAL", 0xff3030, true);
  R.patterns.get('w3_edict_cross')?.(ctx, e, { arms: p.arms ?? 6, steps: p.steps ?? 4, rot: 0.3, warn: 0.7, interval: 0.55, damage: 2, width: 7 }, t);
  ctx.after(1.6, () => gapRing(ctx, e, { count: 26, gap: 5, speed: 70, accel: 60, life: 4 }), e);
});

/** Transition : bouclier bref + grand spectacle. */
function enter(ctx: Ctx, e: Enemy, title: string, sub: string, color: number, css: string): void {
  e.data.shieldUntil = ctx.time + 1.4;
  phaseShow(ctx, e, title, sub, color, css);
}

defineEnemy({
  id: 'boss_primat_fondeur', name: 'Primat Fondeur', world: 3, sprite: 'boss_w3_primat', hp: 2150, speed: 28, radius: 16, contact: 2, knockbackResist: 1,
  immune: ['burn'],
  move: { kind: 'chase', range: 100 },
  onHurt: (ctx, e, ev) => { if (ctx.time < (e.data.shieldUntil ?? 0)) ev.cancel = true; },
  onUpdate: (ctx, e, dt) => {
    if (e.data.windup > 0) e.data.windup -= dt;
    // dès la phase 3, la forge déborde : le Primat laisse des flaques de braises derrière lui
    if (e.phase >= 1 && (e.data.fx = (e.data.fx ?? 0) - dt) <= 0) {
      e.data.fx = e.phase >= 3 ? 0.1 : 0.25;
      ctx.burst(e.x + ctx.rng.range(-16, 16), e.y + ctx.rng.range(-18, 10), ctx.rng.chance(0.5) ? 0xff7030 : 0xffd23a, 2, 35, 0.5);
    }
    if (e.phase < 2) return;
    e.data.pt = (e.data.pt ?? 1.5) - dt;
    if (e.data.pt <= 0) { e.data.pt = e.phase >= 3 ? 0.9 : 1.4; emberPuddle(ctx, e, e.x, e.y + 12, 3); }
  },
  boss: {
    title: 'Celui qui coule les Édits dans le magma',
    phases: [
      // ---------------- Phase 1 — Le Sceau
      {
        hp: 1, move: { kind: 'chase', range: 100 }, speed: 30, aura: 0xffb040,
        attacks: [
          { pattern: 'primat_sceaux', cooldown: 6.5, first: 2.5, telegraph: 0.8, stop: 1.2, weight: 1.5, params: { stamps: 3, shots: 20 } },
          { pattern: 'rings', cooldown: 3.4, telegraph: 0.5, stop: 1, params: { waves: 3, count: 16, interval: 0.42, rotate: Math.PI / 16, speed: 98, sprite: 'eb_w3_ember' } },
          { pattern: 'burst', cooldown: 2.6, telegraph: 0.4, params: { shots: 4, interval: 0.18, count: 3, spread: 0.45, speed: 140 } },
          { pattern: 'w3_gapring', cooldown: 4, telegraph: 0.45, params: { count: 22, gap: 4, speed: 100 } },
          { pattern: 'summon', cooldown: 12, first: 7, telegraph: 0.7, params: { id: 'w3_spark', count: 2, max: 3 } },
        ],
      },
      // ---------------- Phase 2 — La Coulée
      {
        hp: 0.7, move: { kind: 'chase', range: 90 }, speed: 42,
        sprite: 'boss_w3_primat_2', scale: 1.05, aura: 0xff8030,
        onEnter: (ctx, e) => {
          enter(ctx, e, 'LA COULÉE', "L'armure se fend : la forge coule par les fissures.", 0xff8030, '#ff8030');
          for (let i = 0; i < 3; i++) ctx.spawnEnemy('w3_spark', e.x + (i - 1) * 30, e.y + 22, { summoned: true, delay: 0.7 });
        },
        attacks: [
          { pattern: 'primat_coulee', cooldown: 5.2, first: 1.8, telegraph: 0.55, stop: 1.6, weight: 1.5, params: { count: 5, spread: 1.6 } },
          { pattern: 'w3_meteors', cooldown: 4.6, telegraph: 0.5, params: { count: 8, area: 85, interval: 0.14, time: 1.25, radius: 20 } },
          { pattern: 'w3_edict_cross', cooldown: 7, first: 3.5, telegraph: 0.7, stop: 2.3, params: { arms: 4, steps: 4, rot: 0.35, warn: 0.75, damage: 2, width: 7 } },
          { pattern: 'w3_gapring', cooldown: 2.6, telegraph: 0.45, params: { count: 24, gap: 4, speed: 105 } },
          { pattern: 'burst', cooldown: 2.8, telegraph: 0.4, params: { shots: 4, interval: 0.16, count: 3, spread: 0.5, speed: 145 } },
          { pattern: 'summon', cooldown: 10, telegraph: 0.7, params: { id: 'w3_spark', count: 2, max: 4 } },
        ],
      },
      // ---------------- Phase 3 — La Forge vivante
      {
        hp: 0.4, move: { kind: 'chase', range: 50 }, speed: 54,
        sprite: 'boss_w3_primat_3', scale: 1.1, tint: 0xffe8d8, aura: 0xff5020,
        onEnter: (ctx, e) => {
          enter(ctx, e, 'LA FORGE VIVANTE', 'Le heaume tombe. Dessous : une fournaise qui sourit.', 0xffb040, '#ffb040');
          gapRing(ctx, e, { count: 26, gap: 5, speed: 90 });
        },
        attacks: [
          { pattern: 'primat_verdicts', cooldown: 5, first: 1.6, telegraph: 0.65, stop: 1, range: 300, weight: 1.6, params: { count: 2, every: 1.15, warn: 0.5, speed: 240, ring: 22 } },
          { pattern: 'spiral', cooldown: 4.4, telegraph: 0.55, stop: 1.4, params: { arms: 4, shots: 20, interval: 0.08, step: -0.25, speed: 105, sprite: 'eb_w3_ember' } },
          { pattern: 'w3_bellows', cooldown: 3.6, telegraph: 0.55, range: 120, params: { range: 115, push: 360, cone: 0.9, count: 12, speed: 125 } },
          { pattern: 'w3_meteors', cooldown: 4.2, telegraph: 0.45, params: { count: 8, area: 90, interval: 0.12, time: 1.2, radius: 20 } },
          { pattern: 'summon', cooldown: 9, telegraph: 0.7, first: 4, params: { id: 'w3_bomb_minion', count: 2, max: 3 } },
        ],
      },
      // ---------------- Phase 4 — Effondrement
      {
        hp: 0.15, move: { kind: 'chase', range: 30 }, speed: 62,
        sprite: 'boss_w3_primat_4', scale: 1.18, tint: 0xffd0c0, aura: 0xff2020,
        onEnter: (ctx, e) => {
          enter(ctx, e, 'EFFONDREMENT', "La forge s'écroule — l'Édit final brûle !", 0xff3030, '#ff3030');
          ctx.after(0.5, () => { ctx.flash(0xff3030, 0.3); ctx.shake(12); }, e);
        },
        attacks: [
          { pattern: 'primat_edit_final', cooldown: 6.4, first: 1.6, telegraph: 0.7, stop: 2.2, weight: 1.6, params: { arms: 6, steps: 4 } },
          { pattern: 'spiral', cooldown: 3.6, telegraph: 0.45, stop: 1.6, params: { arms: 4, shots: 24, interval: 0.07, step: 0.2, speed: 112, sprite: 'eb_w3_ember' } },
          { pattern: 'w3_meteors', cooldown: 4, telegraph: 0.4, params: { count: 10, area: 95, interval: 0.1, time: 1.1, radius: 18 } },
          { pattern: 'primat_verdicts', cooldown: 4.6, telegraph: 0.55, range: 300, params: { count: 3, every: 1.05, warn: 0.45, speed: 255, ring: 20 } },
          { pattern: 'cross', cooldown: 3.2, telegraph: 0.45, params: { arms: 8, perArm: 3, speed: 95, sprite: 'eb_w3_ember' } },
        ],
      },
    ],
  },
});
