// BOSS SECRET (world 0, hors pool) : le Grimoire Raturé — le livre où les Édits sont écrits avant d'exister.
// Utilisé par les salles spéciales / le mode infini via son id : 'boss_secret_grimoire'.
// Phase 1 « Brouillon » : lignes d'écriture trouées, plumes chercheuses, encre en anneau.
// Phase 2 « Ratures » (le livre s'ouvre, tentacules d'encre) : rayons en croix sur le joueur, téléportations, invités des trois mondes.
// Phase 3 « Point final » (pages en feu violet) : « Plagiat » des signatures des trois boss + spirale du point final.
import { defineEnemy, defineSprite, definePattern, R } from '../../core/registry';
import type { Enemy } from '../../core/types';
import type { Ctx } from '../../sim/ctx';
import { Px, phaseShow, breachRing, aimAt, TAU } from './boss_kit';

// ------------------------------------------------------------------ balles
defineSprite('eb_secret_glyph', ['.eee.', 'e1m1e', 'em1me', 'e1m1e', '.eee.'], { outline: '#5a0a1e' });
defineSprite('eb_secret_quill', ['ee.....', 'emmee..', '.e111ee', 'emmee..', 'ee.....'], { outline: '#5a0a1e' });

// ------------------------------------------------------------------ sprite 40×38 (3 phases × 4 frames)
const GRIM_PAL = { x: '#2a1240', u: '#4a2470', h: '#fff4c8', q: '#efe6d0', j: '#9a8a70' };
function grimoire(ph: number, f: number): string[] {
  const W = 40, H = 38, cx = 20, cy = 18;
  const P = new Px(W, H);
  const bob = [0, -1, -1, 0][f];
  // --- tentacules d'encre (phase 2+) qui ondulent sous le livre
  if (ph >= 1) for (let k = 0; k < 5; k++) {
    const x0 = 10 + k * 5;
    for (let y = 30; y < 38; y++) {
      const x = x0 + Math.round(Math.sin(y * 0.7 + f * 1.6 + k) * 1.5);
      P.set(x, y, ph === 2 ? 'P' : 'k').set(x + 1, y, y > 35 ? '.' : ph === 2 ? 'p' : '5');
    }
  }
  if (ph === 0) {
    // --- livre fermé : couverture violette, coins dorés, tranche de pages à droite
    P.rect(9, 5, 22, 27, 'u').rect(10, 5, 20, 26, 'P').rect(10, 5, 2, 26, 'p').rect(28, 6, 3, 26, 'q');
    for (let y = 7; y < 31; y += 2) P.rect(29, y, 2, 1, 'j');
    for (const [x, y, sx, sy] of [[10, 5, 1, 1], [27, 5, -1, 1], [10, 30, 1, -1], [27, 30, -1, -1]] as const) {
      P.set(x, y, 'Y').set(x + sx, y, 'y').set(x, y + sy, 'y').set(x + 2 * sx, y, 'Y').set(x, y + 2 * sy, 'Y');
    }
    P.rect(11, 9, 16, 1, 'Y').rect(11, 26, 16, 1, 'Y');
  } else {
    // --- livre ouvert : deux pages en éventail, reliure au centre, lignes de texte
    const flap = ph === 2 ? [0, 1, 2, 1][f] : [0, 1, 0, -1][f];
    P.shape((x, y) => {
      const d = Math.abs(x - cx), top = 6 + d * 0.18 - (d > 14 ? flap * 0.5 : 0), bot = 30 - d * 0.1;
      if (d > 19 || y < top || y > bot) return null;
      if (d < 1.2) return 'u';
      if (y > bot - 1.2) return 'j';
      if (d > 18) return 'P';
      return d > 16.5 ? 'p' : 'q';
    });
    for (let y = 10; y < 28; y += 3) for (const s of [-1, 1]) {
      const len = 6 + ((y * 7 + (s > 0 ? 3 : 0)) % 6);
      P.line(cx + s * 4, y, cx + s * (4 + len), y, ph === 2 && (y + f) % 2 ? 'm' : '3');
    }
  }
  // --- l'œil (grand, expressif)
  const R0 = ph === 0 ? 6.5 : 7.5, ey = cy + bob;
  P.disc(cx, ey, R0 + 1, '0').disc(cx, ey, R0, 'w').shape((x, y) => (Math.hypot(x - cx, y - ey) <= R0 && x - cx + (y - ey) > 3 ? '2' : null));
  const iris = ph === 0 ? ['b', 'B'] : ph === 1 ? ['m', 'M'] : ['r', 'R'];
  const look = [0, -1.5, 0, 1.5][f];
  if (ph === 0 && f === 3) {
    P.disc(cx, ey, R0, 'P').disc(cx, ey - 1, R0 - 1, 'p').rect(cx - 6, ey, 12, 1, '0').rect(cx - 5, ey + 1, 10, 1, 'k'); // clignement
  } else {
    P.disc(cx + look, ey, 4, iris[1]).disc(cx + look - 0.4, ey - 0.4, 3.2, iris[0]);
    P.rect(cx - 1 + Math.round(look), ey - 3, 2, 6, 'k'); // pupille fendue
    P.set(cx - 2 + look, ey - 3, '1').set(cx - 3 + look, ey - 2, '1').set(cx + 2 + look, ey + 2, 'h');
    // paupières : la colère monte avec les phases
    const lid = ph === 0 ? 0 : ph === 1 ? 2 : 3;
    for (let k = 0; k < lid; k++) for (const s of [-1, 1]) P.line(cx + s * (R0 + 1), ey - R0 + k, cx - (s < 0 ? 1 : 0), ey - R0 + 3 + k, ph === 2 ? 'R' : 'P');
  }
  // --- plumes flottantes de part et d'autre
  for (const s of [-1, 1]) {
    const qx = cx + s * 17, qy = 14 + (s < 0 ? bob : -bob - 1) + (ph === 2 ? -1 : 0);
    P.line(qx, qy - 6, qx - s * 2, qy + 5, 'w').line(qx + s, qy - 5, qx - s, qy + 3, '2').line(qx - s, qy - 4, qx - s * 2, qy + 1, 'q');
    P.set(qx - s * 2, qy + 6, 'Y').set(qx - s * 3, qy + 7, 'y');
  }
  // --- gouttes d'encre / flammes
  if (ph < 2) {
    const dx = [14, 25, 19][f % 3], dy = 31 + (f % 2) * 2;
    P.set(dx, dy, 'k').set(dx, dy + 1, '5');
  } else {
    const fl = [['.m.', 'mpm', 'p1p'], ['..m', '.mp', 'mp1'], ['m..', 'pm.', '1pm'], ['.m.', 'm1m', 'p1p']][f];
    for (const x of [3, 9, 15, 22, 28, 34]) P.stamp(fl, x, 2 + ((x + f) % 3));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU + f * 0.3;
      P.set(cx + Math.cos(a) * 18, cy + Math.sin(a) * 15, 'y').set(cx + Math.cos(a) * 18 + 1, cy + Math.sin(a) * 15, 'Y');
    }
  }
  return P.rows();
}
const GRIM_IDS = ['boss_secret_grimoire', 'boss_secret_grimoire_2', 'boss_secret_grimoire_3'];
GRIM_IDS.forEach((id, ph) => defineSprite(id, grimoire(ph, 0), { frames: [1, 2, 3].map((f) => grimoire(ph, f)), pal: GRIM_PAL }));

// ------------------------------------------------------------------ patterns
/** secret_lignes — « Lignes d'écriture » : murs de glyphes successifs, chaque trou à un autre endroit. */
definePattern('secret_lignes', (ctx, e, p, t) => {
  const n = p.count ?? 13, lines = p.lines ?? 3;
  for (let k = 0; k < lines; k++) {
    const gap = ctx.rng.int(1, n - 4);
    ctx.after(k * (p.interval ?? 0.55), () => R.patterns.get('wall')?.(ctx, e, { count: n, spacing: 14, gap, gapWidth: 3, speed: p.speed ?? 95, sprite: 'eb_secret_glyph' }, e.target ?? t), e);
  }
});

/** secret_plumes — plumes chercheuses lentes + éventail visé au même moment. */
definePattern('secret_plumes', (ctx, e, p, t) => {
  R.patterns.get('homing')?.(ctx, e, { count: p.count ?? 3, speed: 80, turn: 1.4, life: 3.4, sprite: 'eb_secret_quill' }, t);
  ctx.after(0.25, () => R.patterns.get('spread')?.(ctx, e, { count: p.fan ?? 7, spread: 1.1, speed: 120, sprite: 'eb_secret_glyph' }, e.target ?? t), e);
});

/** secret_rature — deux rayons en X qui se croisent sur le joueur (annoncés), + anneau à brèche pendant l'annonce. */
definePattern('secret_rature', (ctx, e, p, t) => {
  const tt = e.target ?? t;
  if (!tt) return;
  const L = p.length ?? 150, warn = Math.max(0.6, p.warn ?? 0.75);
  ctx.text(e.x, e.y - 32, 'RATURÉ !', 0xff70b8, true);
  for (const a of [Math.PI / 4, -Math.PI / 4]) {
    const ox = tt.x - Math.cos(a) * L, oy = tt.y - Math.sin(a) * L;
    ctx.spawnBullet({ kind: 'beam', damage: 0, life: warn, width: 1, length: 2 * L, color: 0xff70b8, data: { warn: true } }, ox, oy, a, 'enemy', e);
    ctx.after(warn, () => {
      ctx.spawnBullet({ kind: 'beam', damage: p.damage ?? 2, life: 0.22, width: 7, length: 2 * L, color: 0xff3388 }, ox, oy, a, 'enemy', e);
      ctx.sfx('elaser', 0.5);
      ctx.shake(3);
    }, e);
  }
  breachRing(ctx, e, { count: p.ring ?? 20, gap: 4, speed: 90, sprite: 'eb_secret_glyph' }, aimAt(e, tt));
});

/** secret_invites — invite un monstre de chaque monde (dans la limite de max invocations vivantes). */
definePattern('secret_invites', (ctx, e, p) => {
  const ids = ['w1_souchon', 'w2_rouage', 'w3_spark'].filter((id) => R.enemies.has(id));
  const alive = ctx.enemies.filter((o) => o.summoned && !o.dead).length;
  const n = Math.min(ids.length, (p.max ?? 5) - alive);
  for (let i = 0; i < n; i++) {
    const a = (i / Math.max(1, n)) * TAU + ctx.rng.range(0, 1), x = e.x + Math.cos(a) * 28, y = e.y + Math.sin(a) * 28;
    if (!ctx.isSolid(x, y)) ctx.spawnEnemy(ids[i], x, y, { summoned: true, delay: 0.6 });
  }
  ctx.text(e.x, e.y - 32, 'INVITÉS SURPRISE', 0xc070ff, true);
  ctx.sfx('summon', 0.6);
});

/** secret_plagiat — recopie (mal) la signature d'un des trois boss. */
definePattern('secret_plagiat', (ctx, e, p, t) => {
  const k = (e.data.plagiat = ((e.data.plagiat ?? ctx.rng.int(0, 2)) + 1) % 3);
  ctx.text(e.x, e.y - 32, ['PLAGIAT : RACINES', 'PLAGIAT : CARILLON', 'PLAGIAT : MÉTÉORES'][k], 0xffd23a, true);
  if (k === 0) R.patterns.get('w1_racines')?.(ctx, e, { count: 6, full: true, warn: 0.65, length: 190 }, t);
  else if (k === 1) R.patterns.get('w2_carillon')?.(ctx, e, { waves: 4, interval: 0.65, count: 15, spacing: 14, speed: 95, gapWidth: 3, sprite: 'eb_secret_glyph' }, t);
  else R.patterns.get('w3_meteors')?.(ctx, e, { count: 9, area: 90, interval: 0.12, time: 1.2, radius: 20 }, t);
});

/** secret_point_final — spirale à 5 bras, puis anneau troué qui accélère : le point final. */
definePattern('secret_point_final', (ctx, e, p, t) => {
  ctx.text(e.x, e.y - 32, 'POINT FINAL.', 0xff3030, true);
  R.patterns.get('spiral')?.(ctx, e, { arms: p.arms ?? 5, shots: p.shots ?? 22, interval: 0.08, step: 0.22, speed: 100, sprite: 'eb_secret_glyph' }, t);
  ctx.after(1.9, () => breachRing(ctx, e, { count: 28, gap: 5, speed: 60, sprite: 'eb_round', bullet: { accel: 70 }, life: 4 }, aimAt(e, e.target ?? t)), e);
});

function guardFor(e: Enemy, sec: number): void { e.data.guardUntil = e.age + sec; }

defineEnemy({
  id: 'boss_secret_grimoire', name: 'Grimoire Raturé', world: 0, sprite: 'boss_secret_grimoire', hp: 1800, speed: 32, radius: 15, contact: 1, knockbackResist: 1,
  phasing: true, noChampion: true, immune: ['slow', 'freeze'],
  move: { kind: 'orbit', range: 110 },
  onHurt: (ctx: Ctx, e, ev) => {
    if ((e.data.guardUntil ?? 0) > e.age && ev.cause !== 'status') {
      ev.amount *= 0.25;
      if ((e.data.gfx = (e.data.gfx ?? 0) - 1) <= 0) { e.data.gfx = 6; ctx.burst(e.x, e.y, 0xc070ff, 3, 50, 0.25); }
    }
  },
  onUpdate: (ctx, e, dt) => {
    if ((e.data.fx = (e.data.fx ?? 0) - dt) <= 0) {
      e.data.fx = e.phase >= 2 ? 0.12 : 0.35;
      ctx.burst(e.x + ctx.rng.range(-16, 16), e.y + 14, e.phase >= 2 ? 0xc070ff : 0x2a1240, 2, 25, 0.6);
    }
  },
  boss: {
    title: "Celui qui écrit les Édits avant qu'ils n'existent",
    phases: [
      {
        hp: 1, move: { kind: 'orbit', range: 110 }, speed: 32, aura: 0x7038b8,
        attacks: [
          { pattern: 'secret_lignes', cooldown: 4.6, first: 1.8, telegraph: 0.55, stop: 1.2, weight: 1.5, params: { lines: 3, count: 13, speed: 95 } },
          { pattern: 'secret_plumes', cooldown: 3.4, telegraph: 0.45, params: { count: 3, fan: 7 } },
          { pattern: 'rings', cooldown: 4, telegraph: 0.5, params: { waves: 2, count: 18, interval: 0.4, speed: 100, sprite: 'eb_secret_glyph' } },
          { pattern: 'blink', cooldown: 6, first: 4, telegraph: 0.5, params: { min: 70, max: 110, delay: 0.45, then: { count: 12, speed: 90, sprite: 'eb_secret_glyph' } } },
        ],
      },
      {
        hp: 0.66, move: { kind: 'chase', range: 100 }, speed: 40,
        sprite: 'boss_secret_grimoire_2', scale: 1.06, aura: 0xff70b8,
        onEnter: (ctx, e) => {
          phaseShow(ctx, e, 'RATURES', 'Le livre s’ouvre. Il n’aime pas ce que tu as écrit.', 0xff70b8, '#ff70b8');
          guardFor(e, 1.6);
          R.patterns.get('secret_invites')?.(ctx, e, { max: 5 }, e.target);
        },
        attacks: [
          { pattern: 'secret_rature', cooldown: 4.4, first: 1.5, telegraph: 0.55, stop: 0.8, weight: 1.5, params: { ring: 20 } },
          { pattern: 'secret_lignes', cooldown: 5, telegraph: 0.5, stop: 1, params: { lines: 4, count: 15, speed: 100, interval: 0.5 } },
          { pattern: 'secret_plumes', cooldown: 3.2, telegraph: 0.45, params: { count: 4, fan: 9 } },
          { pattern: 'blink', cooldown: 5, telegraph: 0.5, params: { min: 60, max: 100, delay: 0.45, then: { count: 16, speed: 95, sprite: 'eb_secret_glyph' } } },
          { pattern: 'secret_invites', cooldown: 12, first: 7, telegraph: 0.7, params: { max: 5 } },
        ],
      },
      {
        hp: 0.33, move: { kind: 'orbit', range: 85 }, speed: 52,
        sprite: 'boss_secret_grimoire_3', scale: 1.14, tint: 0xf0d8ff, aura: 0xc070ff,
        onEnter: (ctx, e) => {
          phaseShow(ctx, e, 'POINT FINAL', 'Les pages brûlent. Il recopie tes pires souvenirs.', 0xc070ff, '#c070ff');
          guardFor(e, 1.6);
          ctx.after(0.8, () => { for (let i = 0; i < 3; i++) ctx.after(i * 0.3, () => ctx.ring(e.x, e.y, 50 + i * 40, 0xff3388), e); }, e);
        },
        attacks: [
          { pattern: 'secret_plagiat', cooldown: 5.6, first: 1.6, telegraph: 0.6, stop: 1.6, weight: 1.6 },
          { pattern: 'secret_point_final', cooldown: 5.5, first: 3, telegraph: 0.6, stop: 1.8, params: { arms: 5, shots: 22 } },
          { pattern: 'secret_rature', cooldown: 3.4, telegraph: 0.5, params: { ring: 22 } },
          { pattern: 'secret_plumes', cooldown: 2.6, telegraph: 0.45, params: { count: 4, fan: 9 } },
          { pattern: 'secret_lignes', cooldown: 4.6, telegraph: 0.45, params: { lines: 4, count: 15, speed: 108, interval: 0.45 } },
          { pattern: 'secret_invites', cooldown: 11, telegraph: 0.7, params: { max: 5 } },
        ],
      },
    ],
  },
});

/** Id à utiliser par les modes (salle secrète, mode infini). */
export const SECRET_BOSS_ID = 'boss_secret_grimoire';
