// Croâsimir, Directeur des Opérations Marécageuses : une grenouille en costume, cravate rouge et attaché-case.
// Compétence « Langue de bois » : une langue-grappin qui attire un ennemi et l'avale (ou l'ajourne s'il est trop gros).
// Trait « Pattes palmées » : insensible aux sols piégés et retombe toujours sur ses pattes (invulnérabilité prolongée).
import { defineHero } from '../../core/registry';
import type { Enemy, Player } from '../../core/types';
import type { Ctx } from '../../sim/ctx';
import { heroArt } from './_kit';

const RANGE = 130;
const PULL = 460; // px/s
const TONGUE = 0xff6f9c;

heroArt('croasimir', {
  pal: {
    x: '#2c3352', X: '#4a5584', z: '#191c30', // costume trois-pièces
    u: '#e4f4a8', // gorge
    h: '#7a4a26', H: '#a86a38', // cuir de l'attaché-case
  },
  base: [
    '..............',
    '...lgg...lgg..',
    '..lGGGg.gGGGg.',
    '..g1y0g.g1y0g.',
    '.lggggggggggg.',
    '.lgggggggggGg.',
    '.gFFFFFFFFFFF.',
    '..guuuuuuuug..',
    '..xXwwrrwwXx..',
    '.xxXXwRrwXyXx.',
    '.gxXxxrRxxXxg.',
    'hHhxxxRrxxxx..',
    'hyhxxzxxzxx...',
    'hhh.xxx.xxx...',
    '....zxz.zxz...',
    '...ggGg.ggGg..',
  ],
  waist: 10,
  walk: [
    {
      10: '.gxXxxrRxxXxg.', 11: '.hHhxxRrxxxx..', 12: '.hyhxzxxxzxx..', 13: '.hhhxxx..xxx..',
      14: '...zxz....zxz.', 15: '..ggGg....ggGg',
    },
    { 11: 'hHhxxxRrxxxx..', 12: 'hyhxxzxzxx....', 13: 'hhh..xxxx.....', 14: '.....zxzx.....', 15: '....ggGggGg...' },
    {
      10: '.gxXxxrRxxXxg.', 11: '..hHhxRrxxxx..', 12: '..hyhzxxxzxx..', 13: '..hhhxx..xxx..',
      14: '....zxz...zxz.', 15: '...ggGg..ggGg.',
    },
  ],
  bob: [false, true, false],
  blink: { 3: '..gGGGg.gGGGg.' },
});

/** L'ennemi le plus proche le long de la visée (ligne de vue requise). */
function tongueTarget(ctx: Ctx, p: Player): Enemy | null {
  const ca = Math.cos(p.aim), sa = Math.sin(p.aim);
  let best: Enemy | null = null, bt = Infinity;
  for (const e of ctx.enemiesIn(p.x, p.y, RANGE + 16)) {
    if (e.charmed || e.dead || e.spawnT > 0) continue;
    const dx = e.x - p.x, dy = e.y - p.y;
    const t = dx * ca + dy * sa;
    if (t <= 0 || t > RANGE + e.radius * e.scale) continue;
    if (Math.abs(dx * sa - dy * ca) > 10 + e.radius * e.scale) continue;
    if (t < bt && ctx.los(p.x, p.y, e.x, e.y)) { bt = t; best = e; }
  }
  return best;
}

function drawTongue(ctx: Ctx, p: Player, x: number, y: number): void {
  const d = Math.hypot(x - p.x, y - p.y);
  const n = Math.max(2, Math.floor(d / 7));
  for (let i = 1; i <= n; i++) ctx.burst(p.x + ((x - p.x) * i) / n, p.y - 3 + ((y - p.y + 3) * i) / n, TONGUE, 1, 4, 0.12);
}

const canSwallow = (ctx: Ctx, e: Enemy) => !e.def.boss && !e.champion && e.hp <= 30 + 20 * ctx.worldNum;

function swallow(ctx: Ctx, p: Player, e: Enemy): void {
  ctx.killEnemy(e);
  ctx.addArmor(p, 1);
  ctx.addEnergy(p, 15);
  ctx.text(p.x, p.y - 16, 'Avalé !', 0xa8f070);
  ctx.burst(p.x, p.y - 2, 0xa8f070, 12, 70, 0.4);
  ctx.sfx('pickup', 0.8);
}

function adjourn(ctx: Ctx, p: Player, e: Enemy): void {
  ctx.damageEnemy(e, 26 + 8 * ctx.worldNum, { cause: 'skill', source: p });
  ctx.addStatus(e, 'freeze', 1.2);
  const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
  const k = 200 * (1 - (e.def.knockbackResist ?? 0));
  e.kx -= ((e.x - p.x) / d) * k; e.ky -= ((e.y - p.y) / d) * k;
  ctx.text(e.x, e.y - 14, 'Ajourné !', 0xff6f9c);
  ctx.burst(e.x, e.y, TONGUE, 10, 80, 0.35);
  ctx.shake(2);
}

defineHero({
  id: 'croasimir', name: 'Croâsimir', title: 'le Cadre Sup\'',
  desc: 'Directeur des Opérations Marécageuses. Il a une réunion à 14 h, et vous êtes à l\'ordre du jour.',
  sprite: 'hero_croasimir', hp: 6, armor: 5, energy: 190, speed: 92, crit: 0.05, weapon: 'pistol_rusty', cost: 250,
  skill: {
    name: 'Langue de bois', desc: 'Langue-grappin : avale un ennemi, ou ajourne violemment les gros.', cooldown: 9, duration: 0.45,
    use: (ctx, p) => {
      p.data.tongue = null;
      const e = tongueTarget(ctx, p);
      if (!e) {
        drawTongue(ctx, p, p.x + Math.cos(p.aim) * RANGE, p.y + Math.sin(p.aim) * RANGE);
        ctx.text(p.x, p.y - 16, 'Réunion annulée', 0xc8d0e0);
        p.skillCd *= 0.3; // rien à l'ordre du jour : on rend presque tout le temps de recharge
        return;
      }
      drawTongue(ctx, p, e.x, e.y);
      ctx.sfx('dash', 0.6);
      if (!canSwallow(ctx, e)) { adjourn(ctx, p, e); return; }
      p.data.tongue = e.id;
      ctx.addStatus(e, 'freeze', 0.6);
      ctx.text(e.x, e.y - 14, 'Point suivant !', 0xffd23a);
    },
    tick: (ctx, p, dt) => {
      if (p.data.tongue == null) return;
      const e = ctx.enemies.find((o) => o.id === p.data.tongue && !o.dead);
      if (!e) { p.data.tongue = null; return; }
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
      if (d < 10) { p.data.tongue = null; swallow(ctx, p, e); return; }
      const s = Math.min(d, PULL * dt);
      e.x += (dx / d) * s; e.y += (dy / d) * s;
      e.kx = 0; e.ky = 0;
      drawTongue(ctx, p, e.x, e.y);
    },
    end: (ctx, p) => {
      if (p.data.tongue == null) return;
      const e = ctx.enemies.find((o) => o.id === p.data.tongue && !o.dead);
      p.data.tongue = null;
      if (!e) return;
      if (Math.hypot(e.x - p.x, e.y - p.y) < 40) swallow(ctx, p, e);
      else adjourn(ctx, p, e);
    },
  },
  // Trait « Pattes palmées » : les sols piégés ne le blessent pas (le chrono du moteur ne descend jamais à 0)
  // et il reste invulnérable 25 % plus longtemps après un coup.
  modify: (m, p) => {
    m.invulnTime *= 1.25;
    m.hazardImmune = true;
  },
});
